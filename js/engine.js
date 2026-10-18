/*
 * js/engine.js - pure game logic for "Before He Stood".
 * No DOM access anywhere in this file. Loadable in Node with `globalThis.window = globalThis`.
 *
 * Public API (BHS.engine):
 *   computeLens(routeOrId, choices)      -> { lens, scores: {1,2,3}, c10Lens, mismatch }   (SPEC 5.1)
 *   evalCond(cond, state)                -> boolean                                         (SPEC 4.5)
 *   resolveText(t, lang, state)          -> string, tokens resolved, *emphasis* markers kept
 *   plainText(t, lang, state)            -> string, tokens resolved, emphasis markers removed
 *   resolveSegments(t, lang, state)      -> [{ text, em, kind?, key? }] for renderers
 *   quoteVerse(text)                     -> “text” with inner double quotes turned into ‘ ’
 *   verseText(key, lang) / verseRef(key, lang) / verseSpeaker(key)
 *   createGame(routeId, opts)            -> Game   (routeId may be "prologue")
 *   createSequence(beats, opts)          -> Game   (plays an arbitrary beat list, for tests)
 *   restoreGame(savedState)              -> Game
 *
 * Game (driven by the UI):
 *   game.step                 current blocking step (see STEP KINDS below)
 *   game.view()               { step, now: {hush, echo}, stage, actions, ending, routeId }
 *   game.next()               advance from line / verse / endingTitle / last / final
 *   game.choose(optionId)     answer the current choice
 *   game.press()              answer the current press beat
 *   game.tapAction(actionId)  tap a persistent action (Asher); returns { id, text, count } or null
 *   game.serialize()          JSON-safe snapshot; restore with restoreGame(snapshot)
 *   game.lens()               computeLens on the choices so far
 *   game.fastForward(opts)    debug helper: auto-play until a predicate holds
 *
 * STEP KINDS: line {speaker, text} | verse {key, speaker} | choice {id, prompt, options:[{id,text}]}
 *   | press {action?, label?, hint?} | endingTitle {lens, lensLabel, title} | last {text}
 *   | final {routeId, lens} | routeSelect {} | end {}
 * Choice steps never expose lens tags, so the UI cannot leak them (SPEC 7.2-7.3).
 */
(function () {
  "use strict";

  var root = typeof window !== "undefined" ? window : globalThis;
  var BHS = (root.BHS = root.BHS || {});

  var LENSES = [1, 2, 3];
  var LIGHT_LEVELS = { off: true, soft: true, bright: true };
  var POVS = { normal: true, lying: true, standing: true };
  var STATE_VERSION = 1;

  var warnings = [];

  function warn(msg) {
    if (warnings.length < 200) warnings.push(String(msg));
    if (api.debug && root.console && root.console.warn) root.console.warn("[BHS.engine] " + msg);
  }

  function own(o, k) {
    return o != null && Object.prototype.hasOwnProperty.call(o, k);
  }

  function clone(x) {
    return x == null ? x : JSON.parse(JSON.stringify(x));
  }

  function normLens(v) {
    var n = typeof v === "string" ? parseInt(v, 10) : v;
    return n === 1 || n === 2 || n === 3 ? n : null;
  }

  // ---------------------------------------------------------------------------
  // Data access
  // ---------------------------------------------------------------------------

  function getRoute(routeOrId) {
    if (routeOrId && typeof routeOrId === "object") return routeOrId;
    return (BHS.routes && BHS.routes[routeOrId]) || null;
  }

  function choiceBeats(route) {
    var out = [];
    var seen = {};
    if (!route || !route.beats) return out;
    for (var i = 0; i < route.beats.length; i++) {
      var b = route.beats[i];
      if (b && b.type === "choice") {
        if (seen[b.id]) {
          warn("duplicate choice id " + b.id + " in route " + route.id + "; only the first counts for scoring");
          continue;
        }
        seen[b.id] = true;
        out.push(b);
      }
    }
    return out;
  }

  function findChoice(route, id) {
    var list = choiceBeats(route);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function findOption(choiceBeat, optId) {
    if (!choiceBeat || !choiceBeat.options) return null;
    for (var i = 0; i < choiceBeat.options.length; i++) {
      if (choiceBeat.options[i] && choiceBeat.options[i].id === optId) return choiceBeat.options[i];
    }
    return null;
  }

  function scriptureEntry(key) {
    return (BHS.scripture && own(BHS.scripture, key) && BHS.scripture[key]) || null;
  }

  function verseText(key, lang) {
    var s = scriptureEntry(key);
    if (!s || s.refOnly) return null;
    var txt = s[lang === "en" ? "en" : "ko"];
    return typeof txt === "string" && txt.length ? txt : null;
  }

  function verseRef(key, lang) {
    var s = scriptureEntry(key);
    if (!s || !s.ref) return null;
    var r = s.ref[lang === "en" ? "en" : "ko"];
    return typeof r === "string" && r.length ? r : null;
  }

  function verseSpeaker(key) {
    var s = scriptureEntry(key);
    return (s && s.speaker) || "narrator";
  }

  // ---------------------------------------------------------------------------
  // Lens scoring (SPEC 5.1)
  // ---------------------------------------------------------------------------

  function computeLens(routeOrId, choices) {
    var route = getRoute(routeOrId);
    var scores = { 1: 0, 2: 0, 3: 0 };
    var c10Lens = null;
    choices = choices || {};
    var list = choiceBeats(route);
    for (var i = 0; i < list.length; i++) {
      var cb = list[i];
      var pick = choices[cb.id];
      if (pick == null) continue;
      var opt = findOption(cb, pick);
      if (!opt) continue;
      var lens = normLens(opt.lens);
      if (cb.id === "c10") c10Lens = lens;
      if (lens === null) continue;
      scores[lens] += cb.id === "c10" ? 2 : 1;
    }
    var max = Math.max(scores[1], scores[2], scores[3]);
    var tied = LENSES.filter(function (l) {
      return scores[l] === max;
    });
    var lensOut = c10Lens !== null && tied.indexOf(c10Lens) >= 0 ? c10Lens : tied[0];
    return {
      lens: lensOut,
      scores: scores,
      c10Lens: c10Lens,
      mismatch: c10Lens !== null && lensOut !== c10Lens
    };
  }

  // ---------------------------------------------------------------------------
  // Conditions (SPEC 4.5)
  // ---------------------------------------------------------------------------

  function looseEq(v, x) {
    if (v === undefined) v = null;
    // An unset flag or choice counts as `false` so `{ flag: "far", is: false }` reads naturally.
    if (x === false && v === null) return true;
    if (x === null) return v === null;
    return v === x;
  }

  function matchValue(v, cond) {
    if (own(cond, "is")) return looseEq(v, cond.is);
    if (own(cond, "in")) {
      var arr = Array.isArray(cond["in"]) ? cond["in"] : [];
      for (var i = 0; i < arr.length; i++) if (looseEq(v, arr[i])) return true;
      return false;
    }
    // A bare `{ flag: "x" }` tests truthiness.
    return v !== undefined && v !== null && v !== false;
  }

  function c10LensOf(state) {
    if (state && state.c10Lens !== undefined && state.c10Lens !== null) return state.c10Lens;
    if (state && state.routeId && state.choices && state.choices.c10) {
      var cb = findChoice(getRoute(state.routeId), "c10");
      var opt = findOption(cb, state.choices.c10);
      return opt ? normLens(opt.lens) : null;
    }
    return null;
  }

  function evalCond(cond, state) {
    if (cond == null) return true;
    state = state || {};
    if (Array.isArray(cond)) {
      for (var i = 0; i < cond.length; i++) if (!evalCond(cond[i], state)) return false;
      return true;
    }
    if (typeof cond !== "object") return !!cond;
    if (own(cond, "all")) {
      var all = cond.all || [];
      for (var a = 0; a < all.length; a++) if (!evalCond(all[a], state)) return false;
      return true;
    }
    if (own(cond, "any")) {
      var any = cond.any || [];
      for (var b = 0; b < any.length; b++) if (evalCond(any[b], state)) return true;
      return false;
    }
    if (own(cond, "not")) return !evalCond(cond.not, state);
    if (own(cond, "choice")) return matchValue((state.choices || {})[cond.choice], cond);
    if (own(cond, "flag")) return matchValue((state.flags || {})[cond.flag], cond);
    if (own(cond, "c10lens")) return c10LensOf(state) === normLens(cond.c10lens);
    if (own(cond, "var")) {
      // Extension (not in SPEC 4.5): numeric test on a runtime variable.
      var n = Number((state.vars || {})[cond["var"]] || 0);
      if (own(cond, "is")) return n === Number(cond.is);
      if (own(cond, "gte")) return n >= Number(cond.gte);
      if (own(cond, "gt")) return n > Number(cond.gt);
      if (own(cond, "lte")) return n <= Number(cond.lte);
      if (own(cond, "lt")) return n < Number(cond.lt);
      return n !== 0;
    }
    warn("unknown condition " + JSON.stringify(cond));
    return false;
  }

  // ---------------------------------------------------------------------------
  // Text and tokens (SPEC 3.1-3.2)
  // ---------------------------------------------------------------------------

  var TOKEN_SRC = "\\{\\{\\s*(v|r|var)\\s*:\\s*([A-Za-z0-9_]+)\\s*\\}\\}";
  var OPEN_Q = "“";
  var CLOSE_Q = "”";

  function isDebug(state) {
    return !!((state && state.debug) || api.debug);
  }

  function pickLang(t, lang) {
    if (t == null) return "";
    if (typeof t === "string") return t;
    var l = lang === "en" ? "en" : "ko";
    if (typeof t[l] === "string") return t[l];
    var other = l === "en" ? "ko" : "en";
    return typeof t[other] === "string" ? t[other] : "";
  }

  // Inside our curly double quotes, any double quote in the verse becomes a single curly quote,
  // so quotes never nest double-in-double. Straight quotes open after whitespace or an opening
  // bracket/dash, and close otherwise.
  function nestQuotes(text) {
    var out = "";
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (ch === "“") out += "‘";
      else if (ch === "”") out += "’";
      else if (ch === '"') {
        var prev = i > 0 ? text.charAt(i - 1) : "";
        out += prev === "" || /[\s(\[{—–]/.test(prev) ? "‘" : "’";
      } else out += ch;
    }
    return out;
  }

  function quoteVerse(text) {
    return OPEN_Q + nestQuotes(String(text)) + CLOSE_Q;
  }

  function tokenValue(kind, key, lang, state) {
    if (kind === "v") {
      var v = verseText(key, lang);
      if (v == null) {
        warn("missing verse text for " + key);
        return isDebug(state) ? "[" + key + "]" : OPEN_Q + "…" + CLOSE_Q;
      }
      return quoteVerse(v);
    }
    if (kind === "r") {
      var r = verseRef(key, lang);
      if (r == null) {
        warn("missing verse reference for " + key);
        return isDebug(state) ? "[" + key + "]" : "…";
      }
      return r;
    }
    if (kind === "var") {
      var vars = (state && state.vars) || {};
      var n = Number(vars[key]);
      return String(isFinite(n) ? Math.round(n) : 0);
    }
    return "";
  }

  function resolveText(t, lang, state) {
    var str = pickLang(t, lang);
    return str.replace(new RegExp(TOKEN_SRC, "g"), function (m, kind, key) {
      return tokenValue(kind, key, lang, state);
    });
  }

  function resolveSegments(t, lang, state) {
    var str = pickLang(t, lang);
    var re = new RegExp(TOKEN_SRC, "g");
    var out = [];
    var em = false;
    var last = 0;
    var m;

    function pushLiteral(s) {
      var parts = s.split("*");
      for (var i = 0; i < parts.length; i++) {
        if (i > 0) em = !em;
        if (parts[i]) out.push({ text: parts[i], em: em });
      }
    }

    while ((m = re.exec(str))) {
      pushLiteral(str.slice(last, m.index));
      out.push({ text: tokenValue(m[1], m[2], lang, state), em: em, kind: m[1], key: m[2] });
      last = re.lastIndex;
    }
    pushLiteral(str.slice(last));
    return out;
  }

  function plainText(t, lang, state) {
    return resolveSegments(t, lang, state)
      .map(function (s) {
        return s.text;
      })
      .join("");
  }

  // ---------------------------------------------------------------------------
  // Game state machine
  // ---------------------------------------------------------------------------

  function routeActions(route) {
    return (route && Array.isArray(route.actions) && route.actions) || [];
  }

  function initialState(routeId, route, custom) {
    var segs;
    if (custom) segs = ["custom", "@end"];
    else if (routeId === "prologue") segs = ["prologue", "@routeSelect"];
    else segs = ["beats", "@ending"];
    return {
      v: STATE_VERSION,
      routeId: routeId,
      segs: segs,
      seg: 0,
      stack: [{ list: segs[0], i: 0 }],
      choices: {},
      flags: {},
      vars: {},
      picks: [],
      c10Lens: null,
      stage: {
        bg: null,
        caption: null,
        pov: "normal",
        light: "off",
        pinned: null,
        actionsVisible: routeActions(route).length > 0,
        actionReplies: {},
        actionCounts: {},
        sceneSeq: 0
      },
      pending: { hush: false, echo: null },
      now: { hush: false, echo: null },
      step: null,
      at: { list: segs[0], index: -1 },
      ending: null,
      steps: 0,
      done: false
    };
  }

  function Game(routeId, opts) {
    opts = opts || {};
    this.routeId = routeId;
    this.custom = Array.isArray(opts.beats) ? opts.beats : null;
    this.route = routeId === "prologue" || this.custom ? opts.route || null : getRoute(routeId);
    if (!this.route && routeId !== "prologue" && !this.custom) throw new Error("Unknown route: " + routeId);
    this.debug = !!opts.debug;
    if (opts.state) {
      this.state = clone(opts.state);
      if (!this.state || this.state.v !== STATE_VERSION || this.state.routeId !== routeId) {
        throw new Error("Incompatible saved state");
      }
    } else {
      this.state = initialState(routeId, this.route, !!this.custom);
      this._run();
    }
  }

  Object.defineProperty(Game.prototype, "step", {
    get: function () {
      return this.state.step;
    }
  });

  Game.prototype.condState = function () {
    var st = this.state;
    return {
      routeId: this.route ? st.routeId : null,
      choices: st.choices,
      flags: st.flags,
      vars: st.vars,
      c10Lens: st.c10Lens,
      debug: this.debug
    };
  };

  Game.prototype._list = function (name) {
    var route = this.route;
    if (name === "custom") return this.custom || [];
    if (name === "prologue") return (BHS.common && BHS.common.prologue) || [];
    if (!route) return [];
    if (name === "beats") return route.beats || [];
    if (name === "endingPreface") return route.endingPreface || [];
    if (name === "endingCoda") return route.endingCoda || [];
    if (name.indexOf("ending:") === 0) {
      var e = route.endings && route.endings[name.slice(7)];
      return (e && e.beats) || [];
    }
    if (name.indexOf("react:") === 0) {
      var parts = name.split(":");
      var opt = findOption(findChoice(route, parts[1]), parts[2]);
      return (opt && opt.reaction) || [];
    }
    return [];
  };

  Game.prototype._run = function () {
    var st = this.state;
    var guard = 0;
    for (;;) {
      if (++guard > 20000) throw new Error("engine loop guard tripped");
      var frame = st.stack[st.stack.length - 1];
      if (!frame) {
        st.seg++;
        if (st.seg >= st.segs.length) {
          this._setStep({ kind: "end" });
          st.done = true;
          return;
        }
        var seg = st.segs[st.seg];
        if (seg.charAt(0) === "@") {
          if (this._synthetic(seg)) return;
          continue;
        }
        st.stack.push({ list: seg, i: 0 });
        continue;
      }
      var list = this._list(frame.list);
      if (frame.i >= list.length) {
        st.stack.pop();
        continue;
      }
      var index = frame.i;
      var beat = list[index];
      frame.i++;
      if (!beat || typeof beat !== "object") continue;
      if (beat.when && !evalCond(beat.when, this.condState())) continue;
      st.at = { list: frame.list, index: index };
      if (this._apply(beat)) return;
    }
  };

  Game.prototype._synthetic = function (seg) {
    var st = this.state;
    var route = this.route;
    var meta = BHS.meta || {};
    switch (seg) {
      case "@routeSelect":
        this._setStep({ kind: "routeSelect" });
        return true;
      case "@ending": {
        var res = computeLens(route, st.choices);
        st.ending = {
          routeId: st.routeId,
          lens: res.lens,
          scores: res.scores,
          c10Lens: res.c10Lens,
          mismatch: res.mismatch,
          id: st.routeId + "-" + res.lens
        };
        var tail = [];
        var hasEnding = !!(route && route.endings && route.endings[String(res.lens)]);
        if (res.mismatch && BHS.common && BHS.common.mismatchLine) tail.push("@mismatch");
        tail.push("endingPreface", "@title");
        if (hasEnding) tail.push("ending:" + res.lens, "@last");
        tail.push("endingCoda", "@final", "@end");
        Array.prototype.splice.apply(st.segs, [st.seg + 1, 0].concat(tail));
        return false;
      }
      case "@mismatch":
        st.at = { list: "@mismatch", index: 0 };
        this._setStep({ kind: "line", speaker: "narrator", text: BHS.common.mismatchLine, mismatch: true });
        return true;
      case "@title": {
        var lens = st.ending.lens;
        var lensMeta = (meta.lenses && meta.lenses[lens]) || {};
        var titles = (meta.endings && meta.endings[st.routeId]) || {};
        st.at = { list: "@title", index: 0 };
        this._setStep({
          kind: "endingTitle",
          routeId: st.routeId,
          lens: lens,
          lensLabel: lensMeta.label || { ko: String(lens), en: String(lens) },
          lensDesc: lensMeta.desc || null,
          title: titles[lens] || { ko: "", en: "" }
        });
        return true;
      }
      case "@last": {
        var e = route.endings[String(st.ending.lens)];
        if (!e || !e.last) return false;
        st.at = { list: "@last", index: 0 };
        this._setStep({ kind: "last", text: e.last });
        return true;
      }
      case "@final":
        st.at = { list: "@final", index: 0 };
        this._setStep({ kind: "final", routeId: st.routeId, lens: st.ending ? st.ending.lens : null });
        return true;
      case "@end":
        this._setStep({ kind: "end" });
        st.done = true;
        return true;
      default:
        warn("unknown synthetic segment " + seg);
        return false;
    }
  };

  Game.prototype._apply = function (beat) {
    var st = this.state;
    switch (beat.type) {
      case "scene":
        st.stage.bg = beat.bg || null;
        st.stage.caption = beat.caption || null;
        if (beat.pov && POVS[beat.pov]) st.stage.pov = beat.pov;
        st.stage.sceneSeq++;
        return false;
      case "line":
        this._setStep({ kind: "line", speaker: beat.speaker || "narrator", text: beat.text, id: beat.id || null });
        return true;
      case "verse":
        this._setStep({
          kind: "verse",
          key: beat.key,
          speaker: beat.speaker || verseSpeaker(beat.key),
          id: beat.id || null
        });
        return true;
      case "choice":
        this._setStep({
          kind: "choice",
          id: beat.id,
          prompt: beat.prompt || null,
          options: (beat.options || []).map(function (o) {
            return { id: o.id, text: o.text };
          })
        });
        return true;
      case "press":
        this._setStep({
          kind: "press",
          action: beat.action || null,
          label: beat.label || null,
          hint: beat.hint || null,
          id: beat.id || null
        });
        return true;
      case "fx":
        this._fx(beat);
        return false;
      default:
        warn("unknown beat type " + beat.type);
        return false;
    }
  };

  Game.prototype._fx = function (beat) {
    var st = this.state;
    var stage = st.stage;
    switch (beat.fx) {
      case "light":
        stage.light = LIGHT_LEVELS[beat.level] ? beat.level : "off";
        break;
      case "hush":
        st.pending.hush = true;
        break;
      case "echoVerse":
        st.pending.echo = { key: beat.key, highlight: beat.highlight || null };
        break;
      case "pinThought":
        stage.pinned = { items: this._pinItems(beat.items || []), read: false };
        break;
      case "readReceipt":
        if (stage.pinned) stage.pinned.read = true;
        else warn("readReceipt without a pinned thought");
        break;
      case "unpinThought":
        stage.pinned = null;
        break;
      case "pov":
        if (POVS[beat.pov]) stage.pov = beat.pov;
        break;
      case "actionReply":
        if (beat.action) stage.actionReplies[beat.action] = beat.text || null;
        break;
      case "actionsHide":
        stage.actionsVisible = false;
        break;
      case "actionsShow":
        stage.actionsVisible = routeActions(this.route).length > 0;
        break;
      default:
        warn("unknown fx " + beat.fx);
    }
  };

  Game.prototype._pinItems = function (items) {
    var st = this.state;
    var route = this.route;
    var out = [];
    for (var i = 0; i < items.length; i++) {
      var raw = String(items[i]);
      var cut = raw.indexOf(":");
      var kind = raw.slice(0, cut);
      var ref = raw.slice(cut + 1);
      if (kind === "verse") {
        out.push({ type: "verse", key: ref });
      } else if (kind === "choice") {
        var optId = st.choices[ref];
        var opt = findOption(findChoice(route, ref), optId);
        if (opt) out.push({ type: "choice", id: ref, option: optId, text: opt.text });
        else warn("pinThought: no pick for " + ref);
      } else {
        warn("pinThought: unknown item " + raw);
      }
    }
    return out;
  };

  Game.prototype._resolveEcho = function (echo) {
    if (!echo) return null;
    var st = this.state;
    var marks = null;
    var hl = echo.highlight;
    if (hl && hl.map) {
      var val;
      if (own(hl, "flag")) val = st.flags[hl.flag];
      else if (own(hl, "choice")) val = st.choices[hl.choice];
      var mapKey = val === undefined || val === null ? "null" : String(val);
      var m = own(hl.map, mapKey) ? hl.map[mapKey] : null;
      if (m === "*") marks = "*";
      else if (m && typeof m === "object") marks = { ko: m.ko || [], en: m.en || [] };
    }
    return { key: echo.key, marks: marks };
  };

  Game.prototype._setStep = function (step) {
    var st = this.state;
    st.now = { hush: !!st.pending.hush, echo: this._resolveEcho(st.pending.echo) };
    st.pending = { hush: false, echo: null };
    st.step = step;
    st.steps++;
  };

  Game.prototype._clearNow = function () {
    this.state.now = { hush: false, echo: null };
  };

  Game.prototype.next = function () {
    var k = this.state.step && this.state.step.kind;
    if (!k || k === "choice" || k === "press" || k === "end" || k === "routeSelect") return false;
    this._clearNow();
    this._run();
    return true;
  };

  Game.prototype.choose = function (optId) {
    var st = this.state;
    var step = st.step;
    if (!step || step.kind !== "choice") return false;
    var cb = findChoice(this.route, step.id);
    var opt = findOption(cb, optId);
    if (!opt) return false;
    st.choices[step.id] = optId;
    st.picks.push(step.id);
    if (step.id === "c10") st.c10Lens = normLens(opt.lens);
    if (opt.set && typeof opt.set === "object") {
      Object.keys(opt.set).forEach(function (k) {
        st.flags[k] = opt.set[k];
      });
    }
    if (Array.isArray(opt.reaction) && opt.reaction.length) {
      st.stack.push({ list: "react:" + step.id + ":" + optId, i: 0 });
    }
    this._clearNow();
    this._run();
    return true;
  };

  Game.prototype.press = function () {
    var st = this.state;
    var step = st.step;
    if (!step || step.kind !== "press") return false;
    // The persistent buttons stay until actionsHide or the press on an action (SPEC 4.5).
    if (step.action) st.stage.actionsVisible = false;
    this._clearNow();
    this._run();
    return true;
  };

  Game.prototype._action = function (id) {
    var acts = routeActions(this.route);
    for (var i = 0; i < acts.length; i++) if (acts[i].id === id) return acts[i];
    return null;
  };

  Game.prototype.tapAction = function (id) {
    var st = this.state;
    var step = st.step;
    if (step && step.kind === "press" && step.action === id) {
      this.press();
      return { id: id, pressed: true, text: null, count: st.stage.actionCounts[id] || 0 };
    }
    var act = this._action(id);
    if (!act || !st.stage.actionsVisible || !step || step.kind === "end") return null;
    var n = (st.stage.actionCounts[id] || 0) + 1;
    st.stage.actionCounts[id] = n;
    if (act.counter) st.vars[act.counter] = (Number(st.vars[act.counter]) || 0) + 1;
    var replies = Array.isArray(act.replies) ? act.replies : [];
    var override = st.stage.actionReplies[id];
    var text = override || (replies.length ? replies[Math.min(n - 1, replies.length - 1)] : null);
    return { id: id, pressed: false, text: text, count: n };
  };

  Game.prototype.actions = function () {
    var st = this.state;
    var step = st.step;
    var litId = step && step.kind === "press" ? step.action : null;
    return routeActions(this.route)
      .map(function (a) {
        var lit = a.id === litId;
        return {
          id: a.id,
          label: a.label,
          lit: lit,
          visible: lit || (st.stage.actionsVisible && !(litId && !st.stage.actionsVisible))
        };
      })
      .filter(function (a) {
        return a.visible;
      });
  };

  Game.prototype.view = function () {
    var st = this.state;
    return {
      routeId: st.routeId,
      step: st.step,
      now: st.now,
      stage: st.stage,
      actions: this.actions(),
      ending: st.ending,
      vars: st.vars,
      done: st.done
    };
  };

  Game.prototype.lens = function () {
    return computeLens(this.route, this.state.choices);
  };

  Game.prototype.position = function () {
    var st = this.state;
    return { seg: st.segs[st.seg], list: st.at.list, index: st.at.index, steps: st.steps };
  };

  Game.prototype.serialize = function () {
    return clone(this.state);
  };

  // Auto-play for debug and tests. `until(step, game)` stops the run; `pick(step, game)` picks an option id.
  Game.prototype.fastForward = function (opts) {
    opts = opts || {};
    var until =
      opts.until ||
      function () {
        return false;
      };
    var pick =
      opts.pick ||
      function (step) {
        return step.options[0].id;
      };
    var max = opts.maxSteps || 5000;
    for (var i = 0; i < max; i++) {
      var step = this.state.step;
      if (!step || step.kind === "end" || step.kind === "routeSelect") return step;
      if (until(step, this)) return step;
      if (step.kind === "choice") this.choose(pick(step, this));
      else if (step.kind === "press") this.press();
      else this.next();
    }
    return this.state.step;
  };

  // ---------------------------------------------------------------------------
  // Factories
  // ---------------------------------------------------------------------------

  function createGame(routeId, opts) {
    return new Game(routeId, opts);
  }

  function createSequence(beats, opts) {
    opts = opts || {};
    return new Game(opts.routeId || "custom", { beats: beats, route: opts.route || null, debug: opts.debug });
  }

  function restoreGame(saved, opts) {
    if (!saved || !saved.routeId) throw new Error("No saved state");
    opts = opts || {};
    return new Game(saved.routeId, { state: saved, debug: opts.debug });
  }

  var api = {
    version: "1.0.0",
    debug: false,
    warnings: warnings,
    LENSES: LENSES,
    getRoute: getRoute,
    choiceBeats: choiceBeats,
    findChoice: findChoice,
    findOption: findOption,
    computeLens: computeLens,
    evalCond: evalCond,
    resolveText: resolveText,
    resolveSegments: resolveSegments,
    plainText: plainText,
    pickLang: pickLang,
    quoteVerse: quoteVerse,
    nestQuotes: nestQuotes,
    verseText: verseText,
    verseRef: verseRef,
    verseSpeaker: verseSpeaker,
    createGame: createGame,
    createSequence: createSequence,
    restoreGame: restoreGame,
    Game: Game
  };

  BHS.engine = api;
})();
