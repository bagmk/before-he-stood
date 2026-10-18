/*
 * js/engine.js - pure game logic for "Before He Stood".
 * No DOM access anywhere in this file. Loadable in Node with `globalThis.window = globalThis`.
 *
 * Public API (BHS.engine):
 *   computeLens(routeOrId, choices)      -> { lens, scores: {1,2,3}, lastLens, c10Lens, mismatch, cut }   (SPEC 5.1)
 *                                           c10Lens is an alias of lastLens (older callers); a picked cut
 *                                           option gives { lens: null, lastLens: null, mismatch: false, cut: true }
 *   lastChoiceId(routeOrId)              -> id of the double-weight choice (the highest cN in the route), or null
 *   evalCond(cond, state)                -> boolean                                         (SPEC 4.5)
 *   resolveText(t, lang, state)          -> string, tokens resolved, *emphasis* markers kept
 *   plainText(t, lang, state)            -> string, tokens resolved, emphasis markers removed
 *   resolveSegments(t, lang, state)      -> [{ text, em, kind?, key? }] for renderers
 *   quoteVerse(text)                     -> “text” with inner double quotes turned into ‘ ’
 *   verseText(key, lang) / verseRef(key, lang) / verseSpeaker(key)
 *   verseDisplay(key, lang)              -> verse text as shown: an English excerpt that starts with a
 *                                           lowercase letter gets a leading "…" (SPEC 4.3); data unchanged
 *   fingerprint(routeOrId)              -> short structural hash of a route ("prologue" = common.prologue)
 *   canRestore(savedState)               -> true when a snapshot fits the current data (state version + fingerprint)
 *   createGame(routeId, opts)            -> Game   (routeId may be "prologue")
 *   createSequence(beats, opts)          -> Game   (plays an arbitrary beat list, for tests)
 *   restoreGame(savedState)              -> Game   (throws when canRestore(savedState) is false)
 *
 * Game (driven by the UI):
 *   game.step                 current blocking step (see STEP KINDS below)
 *   game.view()               { step, now: {hush, echo}, stage, actions, ending, routeId }
 *   game.next()               advance from line / verse / endingTitle / last
 *   game.choose(optionId)     answer the current choice
 *   game.press()              answer the current press beat
 *   game.tapAction(actionId)  tap a persistent action (Asher); returns { id, text, count } or null
 *   game.serialize()          JSON-safe snapshot; restore with restoreGame(snapshot)
 *   game.lens()               computeLens on the choices so far
 *   game.fastForward(opts)    debug helper: auto-play until a predicate holds
 *
 * STEP KINDS: line {speaker, text} | verse {key, speaker} | choice {id, prompt, options:[{id,text}]}
 *   | press {action?, label?, hint?} | endingTitle {lens, cut, lensLabel, title} | last {text}
 *   | routeSelect {} | end {}
 * A route ends: [mismatch line] -> endingPreface -> ending card -> ending beats -> last -> endingCoda -> end.
 * A cut option (option.cut === true) plays its reaction, skips the rest of the route's beats, then runs
 * ending card (meta.cut.label + meta.endings[route].cut) -> endings.cut.beats -> last -> endingCoda -> end,
 * with no mismatch line and no endingPreface; at the cut the pinned thought is cleared, the light goes off
 * and persistent actions hide. Ending ids: "<route>-1|2|3" and "<route>-cut".
 * Choice steps never expose lens tags or cut flags, so the UI cannot leak them (SPEC 7.2-7.3).
 */
(function () {
  "use strict";

  var root = typeof window !== "undefined" ? window : globalThis;
  var BHS = (root.BHS = root.BHS || {});

  var LENSES = [1, 2, 3];
  var LIGHT_LEVELS = { off: true, soft: true, bright: true };
  var POVS = { normal: true, lying: true, standing: true };
  var TIMES = { day: true, evening: true, night: true };
  // Speakers that may appear as portraits (never Jesus; the protagonist is excluded per route).
  var PORTRAIT_IDS = { menahem: true, hanan: true, yonah: true, asher: true, mother: true, brother: true, neighbor: true, passerby: true, partners: true, scribes: true };
  var MAX_CAST = 2;
  // 2 = short routes (version 3): last-choice weighting, cut endings, route fingerprints.
  // Snapshots of version 1 (10-choice routes) are never restored.
  var STATE_VERSION = 2;

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

  function isCutOption(opt) {
    return !!opt && opt.cut === true;
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

  function choiceNumber(id) {
    var m = /^c(\d+)$/.exec(String(id));
    return m ? parseInt(m[1], 10) : -1;
  }

  // The double-weight choice: the highest cN in the route (c4 in the short routes). Falls back to the
  // last choice in beat order when no id has the cN form.
  function lastChoiceId(routeOrId) {
    var list = choiceBeats(getRoute(routeOrId));
    var best = null;
    var bestN = -1;
    for (var i = 0; i < list.length; i++) {
      var n = choiceNumber(list[i].id);
      if (n > bestN) {
        bestN = n;
        best = list[i].id;
      }
    }
    if (best === null && list.length) best = list[list.length - 1].id;
    return best;
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

  // Display form of a verse text (SPEC 4.3). An English excerpt that starts mid-sentence (its first
  // character is a lowercase letter, e.g. "your sins are forgiven.") is shown with a leading ellipsis.
  // The stored text stays an exact substring of the verse; Korean text is never changed.
  var ELLIPSIS = "…";
  function verseDisplay(key, lang) {
    var txt = verseText(key, lang);
    if (txt == null) return null;
    return lang === "en" && /^[a-z]/.test(txt) ? ELLIPSIS + txt : txt;
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

  // Each pick adds its weight (1; 2 for the last choice) to its lens. Ending lens = highest score; a tie
  // goes to the last choice's lens when it is among the tied lenses, otherwise to the smallest tied lens.
  // Picks for choice ids the route does not have (for example c5-c10 from an old save) are ignored.
  function computeLens(routeOrId, choices) {
    var route = getRoute(routeOrId);
    var lastId = lastChoiceId(route);
    var scores = { 1: 0, 2: 0, 3: 0 };
    var lastLens = null;
    var cut = false;
    choices = choices || {};
    var list = choiceBeats(route);
    for (var i = 0; i < list.length; i++) {
      var cb = list[i];
      var pick = choices[cb.id];
      if (pick == null) continue;
      var opt = findOption(cb, pick);
      if (!opt) continue;
      if (isCutOption(opt)) cut = true;
      var lens = normLens(opt.lens);
      if (cb.id === lastId) lastLens = lens;
      if (lens === null) continue;
      scores[lens] += cb.id === lastId ? 2 : 1;
    }
    if (cut) return { lens: null, scores: scores, lastLens: null, c10Lens: null, mismatch: false, cut: true };
    var max = Math.max(scores[1], scores[2], scores[3]);
    var tied = LENSES.filter(function (l) {
      return scores[l] === max;
    });
    var lensOut = lastLens !== null && tied.indexOf(lastLens) >= 0 ? lastLens : tied[0];
    return {
      lens: lensOut,
      scores: scores,
      lastLens: lastLens,
      c10Lens: lastLens,
      mismatch: lastLens !== null && lensOut !== lastLens,
      cut: false
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

  // Lens of the option picked at the last (double-weight) choice: from the state when known,
  // otherwise looked up in the route. Accepts `c10Lens` from older callers.
  function lastLensOf(state) {
    if (!state) return null;
    if (state.lastLens !== undefined && state.lastLens !== null) return state.lastLens;
    if (state.c10Lens !== undefined && state.c10Lens !== null) return state.c10Lens;
    if (state.routeId && state.choices) {
      var route = getRoute(state.routeId);
      var id = lastChoiceId(route);
      if (id && state.choices[id] != null) {
        var opt = findOption(findChoice(route, id), state.choices[id]);
        return opt ? normLens(opt.lens) : null;
      }
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
    if (own(cond, "lastLens")) return lastLensOf(state) === normLens(cond.lastLens);
    // Alias kept from the 10-choice routes, where the last choice was c10.
    if (own(cond, "c10lens")) return lastLensOf(state) === normLens(cond.c10lens);
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
      var v = verseDisplay(key, lang);
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
  // Route fingerprints (save compatibility)
  // ---------------------------------------------------------------------------

  // A snapshot stores list names and beat indexes, so it only fits the route data it was made from.
  // The fingerprint hashes the route's skeleton: the beat types of every list in order, choice ids,
  // option ids and cut flags, reaction lengths, ending keys, and action ids. Text edits keep it;
  // added, removed or reordered beats change it.
  function skeletonOf(list) {
    if (!Array.isArray(list)) return "-";
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (!b || typeof b !== "object") {
        out.push("?");
        continue;
      }
      if (b.type === "choice") {
        var opts = (Array.isArray(b.options) ? b.options : []).map(function (o) {
          return o ? String(o.id) + (isCutOption(o) ? "!" : "") + "[" + skeletonOf(o.reaction) + "]" : "?";
        });
        out.push("choice:" + b.id + "(" + opts.join(",") + ")");
      } else out.push(String(b.type));
    }
    return out.join(".");
  }

  function hashString(s) {
    // FNV-1a, 32 bit.
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(36);
  }

  function fingerprint(routeOrId) {
    if (routeOrId === "prologue") return "p" + hashString(skeletonOf((BHS.common && BHS.common.prologue) || []));
    var route = getRoute(routeOrId);
    if (!route) return null;
    var parts = ["beats:" + skeletonOf(route.beats), "preface:" + skeletonOf(route.endingPreface)];
    var ends = route.endings && typeof route.endings === "object" ? Object.keys(route.endings).sort() : [];
    ends.forEach(function (k) {
      var e = route.endings[k];
      parts.push("ending " + k + ":" + skeletonOf(e && e.beats) + (e && e.last ? "+last" : ""));
    });
    parts.push("coda:" + skeletonOf(route.endingCoda));
    parts.push(
      "actions:" +
        routeActions(route)
          .map(function (a) {
            return a && a.id;
          })
          .join(",")
    );
    return "r" + hashString(parts.join("|"));
  }

  // True when a snapshot can be resumed against the data loaded now. Anything else (version 1 saves
  // from the 10-choice routes, saves from before a route edit, damaged objects) is refused.
  function canRestore(saved) {
    if (!saved || typeof saved !== "object" || saved.v !== STATE_VERSION) return false;
    if (typeof saved.routeId !== "string" || !saved.routeId) return false;
    if (saved.routeId !== "prologue" && !getRoute(saved.routeId)) return false;
    if (!Array.isArray(saved.segs) || !Array.isArray(saved.stack) || typeof saved.seg !== "number") return false;
    if (!saved.stage || typeof saved.stage !== "object" || !saved.step || typeof saved.step.kind !== "string") return false;
    if (!saved.choices || typeof saved.choices !== "object") return false;
    var fp = fingerprint(saved.routeId);
    return !!fp && saved.fp === fp;
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
      fp: custom ? "custom" : fingerprint(routeId === "prologue" ? "prologue" : route),
      segs: segs,
      seg: 0,
      stack: [{ list: segs[0], i: 0 }],
      choices: {},
      flags: {},
      vars: {},
      picks: [],
      lastLens: null,
      cutAt: null,
      stage: {
        bg: null,
        caption: null,
        time: "day",
        pov: "normal",
        light: "off",
        pinned: null,
        actionsVisible: routeActions(route).length > 0,
        actionReplies: {},
        actionCounts: {},
        sceneSeq: 0,
        cast: [],
        speaking: null,
        castSeq: 0,
        risen: false
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
      if (!canRestore(opts.state) || opts.state.routeId !== routeId) throw new Error("Incompatible saved state");
      this.state = clone(opts.state);
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
      lastLens: st.lastLens,
      c10Lens: st.lastLens,
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

  // Inserts the ending sequence right after the current segment.
  Game.prototype._queue = function (tail) {
    var st = this.state;
    Array.prototype.splice.apply(st.segs, [st.seg + 1, 0].concat(tail));
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
        // A cut pick always ends through the cut path (choose() normally queues it already).
        if (res.cut) return this._synthetic("@cut");
        st.ending = {
          routeId: st.routeId,
          id: st.routeId + "-" + res.lens,
          lens: res.lens,
          cut: false,
          scores: res.scores,
          lastLens: res.lastLens,
          c10Lens: res.lastLens,
          mismatch: res.mismatch
        };
        var tail = [];
        var hasEnding = !!(route && route.endings && route.endings[String(res.lens)]);
        if (res.mismatch && BHS.common && BHS.common.mismatchLine) tail.push("@mismatch");
        tail.push("endingPreface", "@title");
        if (hasEnding) tail.push("ending:" + res.lens, "@last");
        tail.push("endingCoda", "@end");
        this._queue(tail);
        return false;
      }
      case "@cut": {
        // The route was cut short: no lens scoring, no mismatch line, no endingPreface. The beats that
        // would have closed the scene were skipped, so the protagonist leaves it here: the pinned
        // thought goes, the light goes off, persistent actions hide. endings.cut beats may set them again.
        st.stage.pinned = null;
        st.stage.light = "off";
        st.stage.actionsVisible = false;
        var scored = computeLens(route, st.choices);
        st.ending = {
          routeId: st.routeId,
          id: st.routeId + "-cut",
          lens: null,
          cut: true,
          scores: scored.scores,
          lastLens: null,
          c10Lens: null,
          mismatch: false,
          cutAt: st.cutAt || null
        };
        var cutTail = ["@title"];
        if (route && route.endings && route.endings.cut) cutTail.push("ending:cut", "@last");
        cutTail.push("endingCoda", "@end");
        this._queue(cutTail);
        return false;
      }
      case "@mismatch":
        st.at = { list: "@mismatch", index: 0 };
        st.stage.speaking = null;
        this._setStep({ kind: "line", speaker: "narrator", text: BHS.common.mismatchLine, mismatch: true });
        return true;
      case "@title": {
        var ending = st.ending || {};
        this._castClear();
        var titles = (meta.endings && meta.endings[st.routeId]) || {};
        st.at = { list: "@title", index: 0 };
        if (ending.cut) {
          var cutMeta = meta.cut || {};
          this._setStep({
            kind: "endingTitle",
            routeId: st.routeId,
            lens: null,
            cut: true,
            lensLabel: cutMeta.label || { ko: "", en: "" },
            lensDesc: cutMeta.desc || null,
            title: titles.cut || { ko: "", en: "" }
          });
          return true;
        }
        var lens = ending.lens;
        var lensMeta = (meta.lenses && meta.lenses[lens]) || {};
        this._setStep({
          kind: "endingTitle",
          routeId: st.routeId,
          lens: lens,
          cut: false,
          lensLabel: lensMeta.label || { ko: String(lens), en: String(lens) },
          lensDesc: lensMeta.desc || null,
          title: titles[lens] || { ko: "", en: "" }
        });
        return true;
      }
      case "@last": {
        var key = st.ending && st.ending.cut ? "cut" : String(st.ending && st.ending.lens);
        var e = route && route.endings && route.endings[key];
        if (!e || !e.last) return false;
        st.at = { list: "@last", index: 0 };
        this._castClear();
        this._setStep({ kind: "last", text: e.last });
        return true;
      }
      case "@end":
        this._setStep({ kind: "end" });
        st.done = true;
        return true;
      default:
        warn("unknown synthetic segment " + seg);
        return false;
    }
  };

  // ---- portrait cast (who stands on stage)

  Game.prototype._protagonist = function () {
    var meta = BHS.meta || {};
    var r = meta.routes && meta.routes[this.state.routeId];
    return (r && r.protagonist) || null;
  };

  Game.prototype._castClear = function () {
    this.state.stage.cast = [];
    this.state.stage.speaking = null;
  };

  // A character line puts the speaker on stage (most recent two, stable left/right slots).
  Game.prototype._castLine = function (speaker) {
    var stage = this.state.stage;
    if (!stage.cast) stage.cast = [];
    if (!PORTRAIT_IDS[speaker] || speaker === this._protagonist()) {
      stage.speaking = null;
      return;
    }
    var pose = speaker === "asher" ? (stage.risen ? "standing" : "lying") : null;
    var t = (stage.castSeq = (stage.castSeq || 0) + 1);
    var cast = stage.cast;
    var found = null;
    for (var i = 0; i < cast.length; i++) if (cast[i].id === speaker) found = cast[i];
    if (found) {
      found.t = t;
      found.pose = pose;
    } else if (cast.length < MAX_CAST) {
      var used = cast.length ? cast[0].slot : 1;
      cast.push({ id: speaker, slot: cast.length ? 1 - used : 0, pose: pose, t: t });
    } else {
      var oldest = cast[0];
      for (var j = 1; j < cast.length; j++) if (cast[j].t < oldest.t) oldest = cast[j];
      oldest.id = speaker;
      oldest.pose = pose;
      oldest.t = t;
    }
    stage.speaking = speaker;
  };

  Game.prototype._apply = function (beat) {
    var st = this.state;
    switch (beat.type) {
      case "scene":
        // A scene never touches the light level, and changes pov only when it sets one.
        st.stage.bg = beat.bg || null;
        st.stage.caption = beat.caption || null;
        st.stage.time = TIMES[beat.time] ? beat.time : "day";
        if (beat.pov && POVS[beat.pov]) st.stage.pov = beat.pov;
        st.stage.sceneSeq++;
        this._castClear();
        return false;
      case "line":
        this._castLine(beat.speaker || "narrator");
        this._setStep({ kind: "line", speaker: beat.speaker || "narrator", text: beat.text, id: beat.id || null });
        return true;
      case "verse": {
        var vsp = beat.speaker || verseSpeaker(beat.key);
        // When Jesus speaks, the light takes the stage.
        if (vsp === "jesus") this._castClear();
        st.stage.speaking = null;
        if (beat.key === "MT_9_6B") st.stage.risen = true;
        this._setStep({
          kind: "verse",
          key: beat.key,
          speaker: vsp,
          id: beat.id || null
        });
        return true;
      }
      case "choice":
        st.stage.speaking = null;
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
        st.stage.speaking = null;
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

  // A cut option ends the route early: every list still open (the route's main beats) is exhausted,
  // and the coming "@ending" segment becomes "@cut". The option's reaction is pushed afterwards, so it
  // still plays. All of this lives in the state, so saving and resuming work across a cut.
  Game.prototype._cutFrom = function (choiceId, optId) {
    var st = this.state;
    st.cutAt = { choice: choiceId, option: optId };
    for (var i = 0; i < st.stack.length; i++) st.stack[i].i = this._list(st.stack[i].list).length;
    var at = st.segs.indexOf("@ending", st.seg);
    if (at >= 0) st.segs[at] = "@cut";
    else st.segs.splice(st.seg + 1, 0, "@cut");
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
    if (step.id === lastChoiceId(this.route)) st.lastLens = normLens(opt.lens);
    if (opt.set && typeof opt.set === "object") {
      Object.keys(opt.set).forEach(function (k) {
        st.flags[k] = opt.set[k];
      });
    }
    if (isCutOption(opt)) this._cutFrom(step.id, optId);
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
    version: "3.0.0",
    STATE_VERSION: STATE_VERSION,
    debug: false,
    warnings: warnings,
    LENSES: LENSES,
    PORTRAIT_IDS: PORTRAIT_IDS,
    getRoute: getRoute,
    choiceBeats: choiceBeats,
    lastChoiceId: lastChoiceId,
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
    verseDisplay: verseDisplay,
    verseRef: verseRef,
    verseSpeaker: verseSpeaker,
    fingerprint: fingerprint,
    canRestore: canRestore,
    createGame: createGame,
    createSequence: createSequence,
    restoreGame: restoreGame,
    Game: Game
  };

  BHS.engine = api;
})();
