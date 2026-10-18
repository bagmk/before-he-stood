/*
 * js/main.js - app controller for "Before He Stood".
 * Owns screen flow (title -> prologue -> route select -> route -> ending card -> ending -> gallery),
 * persistence (SPEC 5.3), keyboard input, deep links (#scribe/#friend/#asher), the ?debug=1 panel,
 * and the automated-test hooks:
 *   document.body.dataset.screen, window.BHS_DEBUG.state(), BHS.ui.debugState(), ?test=1.
 */
(function () {
  "use strict";

  var BHS = (window.BHS = window.BHS || {});
  var doc = document;
  var V = BHS.view;
  var E = BHS.engine;

  var KEYS = {
    settings: "bhs.v1.settings",
    save: "bhs.v1.save",
    gallery: "bhs.v1.gallery"
  };
  // 2 = short routes (version 3). Every save carries the route fingerprint of BHS.engine; a save
  // that no longer fits the loaded data (for example one from the 10-choice routes) is dropped silently.
  var SAVE_VERSION = 2;
  var PLAY_SCREENS = { prologue: true, play: true, endingCard: true, ending: true };

  // ------------------------------------------------------------------ storage (never throws)

  var store = {
    get: function (k) {
      try {
        var s = window.localStorage.getItem(k);
        return s ? JSON.parse(s) : null;
      } catch (err) {
        return null;
      }
    },
    set: function (k, v) {
      try {
        window.localStorage.setItem(k, JSON.stringify(v));
        return true;
      } catch (err) {
        return false;
      }
    },
    del: function (k) {
      try {
        window.localStorage.removeItem(k);
      } catch (err) {
        /* storage unavailable */
      }
    },
    probe: function () {
      try {
        var k = "bhs.v1.probe";
        window.localStorage.setItem(k, "1");
        window.localStorage.removeItem(k);
        return true;
      } catch (err) {
        return false;
      }
    }
  };

  // ------------------------------------------------------------------ app state

  function readParams() {
    var out = {};
    try {
      var q = (window.location.search || "").replace(/^\?/, "").split("&");
      q.forEach(function (pair) {
        if (!pair) return;
        var kv = pair.split("=");
        out[decodeURIComponent(kv[0])] = kv.length > 1 ? decodeURIComponent(kv[1]) : "1";
      });
    } catch (err) {
      /* ignore malformed query */
    }
    return out;
  }

  var params = readParams();

  var app = {
    screen: null,
    game: null,
    settings: { lang: "both", speed: "normal", size: 1 },
    storageOK: false,
    debug: params.debug === "1" || params.debug === "true",
    test: params.test === "1" || params.test === "true",
    lastEnding: null,
    guardUntil: 0,
    notice: null,
    debugMin: false
  };

  function now() {
    return window.performance && performance.now ? performance.now() : Date.now();
  }

  function routeExists(id) {
    return !!(BHS.routes && BHS.routes[id] && Array.isArray(BHS.routes[id].beats));
  }

  // ------------------------------------------------------------------ settings

  function loadSettings() {
    var s = store.get(KEYS.settings);
    if (s && typeof s === "object") {
      if (s.lang === "ko" || s.lang === "en" || s.lang === "both") app.settings.lang = s.lang;
      if (s.speed === "slow" || s.speed === "normal" || s.speed === "instant") app.settings.speed = s.speed;
      if (typeof s.size === "number" && isFinite(s.size)) app.settings.size = s.size;
    }
  }

  function saveSettings() {
    store.set(KEYS.settings, app.settings);
  }

  function applySettings() {
    V.applySettings({ lang: app.settings.lang, speed: app.settings.speed, size: app.settings.size });
    app.settings.size = V.state.size;
  }

  // ------------------------------------------------------------------ save / gallery

  function persist() {
    if (!app.game) return;
    var state = app.game.serialize();
    store.set(KEYS.save, {
      v: SAVE_VERSION,
      at: Date.now(),
      screen: app.screen,
      routeId: state.routeId,
      fp: state.fp,
      state: state
    });
  }

  function persistRouteSelect() {
    store.set(KEYS.save, { v: SAVE_VERSION, at: Date.now(), screen: "routeSelect", routeId: null, state: null });
  }

  // A save is offered only when it fits the data loaded now (save format, state version, route
  // fingerprint). Anything else is removed without a notice, so "Continue" never resumes a stale place.
  function loadSave() {
    var s = store.get(KEYS.save);
    if (!s) return null;
    var ok = false;
    try {
      if (s.v === SAVE_VERSION && s.screen === "routeSelect") ok = true;
      else if (s.v === SAVE_VERSION && s.state && typeof s.routeId === "string" && s.state.routeId === s.routeId) {
        ok = (s.routeId === "prologue" || routeExists(s.routeId)) && E.canRestore(s.state);
      }
    } catch (err) {
      ok = false;
    }
    if (!ok) {
      clearSave();
      return null;
    }
    return s;
  }

  function clearSave() {
    store.del(KEYS.save);
  }

  // Seen endings ("scribe-1" ... "friend-cut"). Ids from older releases stay valid; anything unknown
  // is simply never matched by a gallery cell.
  function loadGallery() {
    var g = store.get(KEYS.gallery);
    return Array.isArray(g) ? g.filter(function (x) { return typeof x === "string"; }) : app.memGallery || [];
  }

  function markSeen(id) {
    if (!id) return;
    var g = loadGallery();
    if (g.indexOf(id) < 0) g.push(id);
    app.memGallery = g;
    store.set(KEYS.gallery, g);
  }

  // ------------------------------------------------------------------ screens

  function setScreen(name) {
    var changed = app.screen !== name;
    app.screen = name;
    doc.body.setAttribute("data-screen", name);
    V.showLayer(name);
    // Re-rendering the same screen (for example after A+/A-) keeps the settings panel open.
    if (changed) V.closeSettings();
    if (!PLAY_SCREENS[name]) doc.body.classList.remove("is-idle");
  }

  function headerHandlers() {
    return {
      onHome: askHome,
      onLang: setLang,
      onSettings: toggleSettings,
      onFullscreen: toggleFullscreen,
      canFullscreen: canFullscreen(),
      isFullscreen: !!fullscreenElement()
    };
  }

  function renderHeader() {
    V.renderHeader(headerHandlers());
  }

  function showTitle() {
    V.closeModal();
    app.game = null;
    setScreen("title");
    V.pageStage("shore_dawn");
    var save = loadSave();
    var saveLabel = null;
    if (save && save.routeId && save.routeId !== "prologue" && BHS.meta && BHS.meta.routes && BHS.meta.routes[save.routeId]) {
      saveLabel = V.flat(BHS.meta.routes[save.routeId].name);
    }
    var notice = app.notice ? BHS.ui[app.notice] : !app.storageOK ? BHS.ui.storageOff : null;
    app.notice = null;
    V.renderTitle({
      hasSave: !!save,
      saveLabel: saveLabel,
      notice: notice,
      onStart: startPrologue,
      onContinue: continueGame,
      onGallery: function () {
        showGallery({});
      },
      onLang: function (mode) {
        setLang(mode);
      }
    });
    refreshDebug();
  }

  function startPrologue() {
    app.lastEnding = null;
    try {
      app.game = E.createGame("prologue", { debug: app.debug });
    } catch (err) {
      showRouteSelect();
      return;
    }
    renderGame();
  }

  function showRouteSelect(opts) {
    app.game = null;
    setScreen("routeSelect");
    V.pageStage("shore_dawn");
    persistRouteSelect();
    V.renderRouteSelect({
      seen: loadGallery(),
      notice: opts && opts.notice ? BHS.ui[opts.notice] : null,
      onPick: function (id) {
        if (!routeExists(id)) {
          showRouteSelect({ notice: "routeMissing" });
          return;
        }
        startRoute(id);
      }
    });
    refreshDebug();
  }

  function startRoute(id) {
    if (!routeExists(id)) {
      app.notice = "routeMissing";
      showTitle();
      return;
    }
    app.lastEnding = null;
    app.game = E.createGame(id, { debug: app.debug });
    renderGame();
  }

  function screenForGame(g) {
    var st = g.state;
    if (st.routeId === "prologue") return "prologue";
    if (st.step && st.step.kind === "endingTitle") return "endingCard";
    var t = st.segs.indexOf("@title");
    if (t >= 0 && st.seg > t) return "ending";
    return "play";
  }

  function tokenState(g) {
    return { vars: g.state.vars, debug: app.debug };
  }

  function playHandlers() {
    return {
      onAdvance: onAdvance,
      onChoose: onChoose,
      onPress: onPress,
      onAction: onAction
    };
  }

  function renderGame(opts) {
    var g = app.game;
    if (!g) return showTitle();
    var v = g.view();
    var kind = v.step && v.step.kind;
    if (kind === "routeSelect") {
      showRouteSelect();
      return;
    }
    if (kind === "end") {
      finishRoute();
      return;
    }
    if (kind === "endingTitle" && v.ending) {
      markSeen(v.ending.id);
      app.lastEnding = v.ending.id;
    }
    setScreen(screenForGame(g));
    V.renderPlay(v, { routeId: g.state.routeId, state: tokenState(g), instant: !!(opts && opts.instant) });
    app.guardUntil = app.test ? 0 : now() + 220;
    persist();
    refreshDebug();
  }

  // The route is over: record the ending (also when the game was resumed after its title card)
  // and open the gallery with it highlighted.
  function finishRoute() {
    var g = app.game;
    var current = g && g.state.ending ? g.state.ending.id : app.lastEnding;
    if (current) {
      markSeen(current);
      app.lastEnding = current;
    }
    clearSave();
    app.game = null;
    showGallery({ current: current });
  }

  function showGallery(opts) {
    opts = opts || {};
    app.game = null;
    setScreen("gallery");
    V.pageStage("black");
    V.renderGallery({
      seen: loadGallery(),
      current: opts.current || null,
      onReplay: function () {
        showRouteSelect();
      },
      onHome: showTitle
    });
    refreshDebug();
  }

  function continueGame() {
    var s = loadSave();
    if (!s) {
      showTitle();
      return;
    }
    if (s.screen === "routeSelect") {
      showRouteSelect();
      return;
    }
    try {
      app.game = E.restoreGame(s.state, { debug: app.debug });
      renderGame({ instant: true });
    } catch (err) {
      clearSave();
      app.notice = "resumeFailed";
      showTitle();
    }
  }

  // ------------------------------------------------------------------ input

  function onAdvance() {
    var g = app.game;
    if (!g || !PLAY_SCREENS[app.screen] || V.isModalOpen()) return;
    if (V.completeTyping()) return;
    var kind = g.step && g.step.kind;
    if (kind === "line" || kind === "verse" || kind === "endingTitle" || kind === "last") {
      if (now() < app.guardUntil) return;
      g.next();
      renderGame();
    }
  }

  // After a pick the chosen button disappears; hand focus back to the page so the
  // story keys (Space, Enter, arrows, PageDown) keep working without a stray ring.
  function focusAdvance() {
    var el = doc.activeElement;
    if (el && el !== doc.body && typeof el.blur === "function" && !doc.getElementById("play").contains(el)) return;
    if (el && el !== doc.body && typeof el.blur === "function") el.blur();
  }

  function onChoose(optId) {
    var g = app.game;
    if (!g || !g.step || g.step.kind !== "choice") return;
    if (!g.choose(optId)) return;
    renderGame();
    focusAdvance();
  }

  function onPress() {
    var g = app.game;
    if (!g || !g.step || g.step.kind !== "press") return;
    g.press();
    renderGame();
    focusAdvance();
  }

  function onAction(id, btn) {
    var g = app.game;
    if (!g) return;
    var res = g.tapAction(id);
    if (!res) return;
    if (res.pressed) {
      renderGame();
      focusAdvance();
      return;
    }
    V.showReply(res.text, tokenState(g));
    V.shake(btn);
    persist();
    refreshDebug();
  }

  // Keyboard and presentation-clicker control (SPEC 5.6, TV display).
  var ADVANCE_KEYS = { " ": true, Spacebar: true, Enter: true, ArrowRight: true, ArrowDown: true, PageDown: true };
  var INERT_KEYS = { ArrowLeft: true, ArrowUp: true, PageUp: true };

  function choiceIndexForKey(key) {
    if (/^[1-4]$/.test(key)) return Number(key) - 1;
    var i = "abcd".indexOf(String(key).toLowerCase());
    return key && key.length === 1 && i >= 0 ? i : -1;
  }

  function moveChoiceFocus(dir) {
    var opts = Array.prototype.slice.call(doc.querySelectorAll("#choices .opt"));
    if (!opts.length) return;
    var cur = opts.indexOf(doc.activeElement);
    var next = cur < 0 ? (dir < 0 ? opts.length - 1 : 0) : dir === 0 ? cur : (cur + dir + opts.length) % opts.length;
    try {
      opts[next].focus({ preventScroll: false });
    } catch (err) {
      opts[next].focus();
    }
  }

  function handleEscape(ev) {
    if (!doc.getElementById("settings").hidden) {
      ev.preventDefault();
      V.closeSettings();
      return;
    }
    if (!doc.getElementById("modal").hidden) {
      ev.preventDefault();
      V.closeModal();
      return;
    }
    if (PLAY_SCREENS[app.screen]) {
      ev.preventDefault();
      askHome();
    }
  }

  function onKey(ev) {
    if (ev.defaultPrevented || ev.altKey || ev.ctrlKey || ev.metaKey) return;
    var key = ev.key;
    var target = ev.target || {};
    var tag = target.tagName || "";
    var typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!target.isContentEditable;
    if (key === "Escape" || key === "Esc") {
      handleEscape(ev);
      return;
    }
    if (typing) return;
    if ((key === "f" || key === "F") && !ev.repeat) {
      ev.preventDefault();
      toggleFullscreen();
      return;
    }
    if (V.isModalOpen()) return;
    // Space/Enter on a focused button or link keep their native meaning.
    var nativeActivate = (key === " " || key === "Enter" || key === "Spacebar") && (tag === "BUTTON" || tag === "A");

    if (app.screen === "title") {
      if (ADVANCE_KEYS[key] && !nativeActivate && !ev.repeat) {
        ev.preventDefault();
        startPrologue();
      }
      return;
    }
    if (app.screen === "routeSelect") {
      routeSelectKey(ev, key);
      return;
    }
    if (!PLAY_SCREENS[app.screen] || !app.game) return;
    var step = app.game.step;
    var kind = step && step.kind;

    if (kind === "choice") {
      var idx = choiceIndexForKey(key);
      if (idx >= 0 && step.options[idx]) {
        ev.preventDefault();
        if (!ev.repeat) onChoose(step.options[idx].id);
        return;
      }
      if (key === "ArrowDown" || key === "ArrowRight" || key === "ArrowUp" || key === "ArrowLeft") {
        ev.preventDefault();
        moveChoiceFocus(key === "ArrowDown" || key === "ArrowRight" ? 1 : -1);
        return;
      }
      if (nativeActivate) return;
      if (ADVANCE_KEYS[key] || INERT_KEYS[key]) {
        // Never pick an option by accident: an advance key only shows where focus is.
        ev.preventDefault();
        if (ADVANCE_KEYS[key]) moveChoiceFocus(0);
      }
      return;
    }

    if (ADVANCE_KEYS[key]) {
      if (nativeActivate) return;
      ev.preventDefault();
      if (ev.repeat) return;
      if (kind === "press") onPress();
      else onAdvance();
      return;
    }
    if (INERT_KEYS[key]) ev.preventDefault();
  }

  // Route select on a TV: 1-3 start a route (in card order), arrows and PageUp/PageDown move the focus
  // between the cards (the focused card lifts its figure), Enter/Space start the focused one natively.
  function routeSelectKey(ev, key) {
    var cards = Array.prototype.slice.call(doc.querySelectorAll(".routecard"));
    if (!cards.length) return;
    if (/^[1-9]$/.test(key)) {
      var card = cards[Number(key) - 1];
      if (!card) return;
      ev.preventDefault();
      if (!ev.repeat) card.click();
      return;
    }
    var dir = { ArrowRight: 1, ArrowDown: 1, PageDown: 1, ArrowLeft: -1, ArrowUp: -1, PageUp: -1 }[key];
    if (!dir) return;
    ev.preventDefault();
    var cur = cards.indexOf(doc.activeElement);
    var next = cur < 0 ? (dir > 0 ? 0 : cards.length - 1) : (cur + dir + cards.length) % cards.length;
    try {
      cards[next].focus({ preventScroll: false });
    } catch (err) {
      cards[next].focus();
    }
  }

  // ------------------------------------------------------------------ fullscreen + idle cursor

  function fullscreenElement() {
    return doc.fullscreenElement || doc.webkitFullscreenElement || null;
  }

  function canFullscreen() {
    var el = doc.documentElement;
    var api = el.requestFullscreen || el.webkitRequestFullscreen;
    var enabled = doc.fullscreenEnabled !== undefined ? doc.fullscreenEnabled : doc.webkitFullscreenEnabled;
    return !!api && enabled !== false;
  }

  function toggleFullscreen() {
    function quiet(p) {
      if (p && typeof p.catch === "function") p.catch(function () {});
    }
    try {
      if (fullscreenElement()) {
        var exit = doc.exitFullscreen || doc.webkitExitFullscreen;
        if (exit) quiet(exit.call(doc));
      } else if (canFullscreen()) {
        var el = doc.documentElement;
        var req = el.requestFullscreen || el.webkitRequestFullscreen;
        quiet(req.call(el));
      }
    } catch (err) {
      /* fullscreen refused (for example inside a sandboxed frame) */
    }
  }

  var idleTimer = 0;

  function wakeCursor() {
    doc.body.classList.remove("is-idle");
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      if (PLAY_SCREENS[app.screen]) doc.body.classList.add("is-idle");
    }, 3000);
  }

  // ------------------------------------------------------------------ header actions

  function askHome() {
    V.closeSettings();
    if (app.screen === "title") return;
    // Nothing to lose outside the story itself.
    if (!PLAY_SCREENS[app.screen]) {
      showTitle();
      return;
    }
    persist();
    V.ask({
      title: BHS.ui.confirmHomeTitle,
      body: BHS.ui.confirmHomeBody,
      yes: BHS.ui.confirmHomeYes,
      no: BHS.ui.confirmNo,
      onYes: showTitle,
      onNo: focusAdvance
    });
  }

  function rerender() {
    renderHeader();
    switch (app.screen) {
      case "title":
        showTitle();
        break;
      case "routeSelect":
        showRouteSelect();
        break;
      case "gallery":
        showGallery({ current: app.lastEnding });
        break;
      default:
        if (app.game) renderGame({ instant: true });
    }
  }

  function setLang(mode) {
    if (mode !== "ko" && mode !== "en" && mode !== "both") return;
    app.settings.lang = mode;
    saveSettings();
    applySettings();
    rerender();
  }

  function settingsHandlers() {
    return {
      onSpeed: function (speed) {
        app.settings.speed = speed;
        saveSettings();
        applySettings();
        V.renderSettings(settingsHandlers());
      },
      onSize: function (delta) {
        app.settings.size = V.state.size + delta;
        applySettings();
        saveSettings();
        V.renderSettings(settingsHandlers());
        if (PLAY_SCREENS[app.screen] && app.game) renderGame({ instant: true });
      },
      onClose: function () {
        V.closeSettings();
        var gear = doc.querySelector('[data-testid="settings-open"]');
        if (gear) gear.focus({ preventScroll: true });
      }
    };
  }

  function toggleSettings() {
    if (!doc.getElementById("settings").hidden) {
      V.closeSettings();
      return;
    }
    V.openSettings(settingsHandlers());
  }

  // ------------------------------------------------------------------ debug + test hooks

  function debugState() {
    var g = app.game;
    var st = g ? g.state : null;
    var rid = st && st.routeId !== "prologue" ? st.routeId : null;
    var lensNow = rid && routeExists(rid) ? E.computeLens(rid, st.choices) : null;
    return JSON.parse(
      JSON.stringify({
        screen: app.screen,
        routeId: rid,
        beatIndex: st ? st.at.index : null,
        list: st ? st.at.list : null,
        step: st && st.step ? st.step.kind : null,
        stepId: st && st.step ? st.step.id || null : null,
        choices: st ? st.choices : {},
        scores: lensNow ? lensNow.scores : null,
        projectedLens: lensNow ? lensNow.lens : null,
        flags: st ? st.flags : {},
        vars: st ? st.vars : {},
        lastLens: st ? st.lastLens : null,
        cut: st && st.ending ? !!st.ending.cut : st && st.cutAt ? true : null,
        lens: st && st.ending ? st.ending.lens : null,
        ending: st && st.ending ? st.ending.id : app.lastEnding,
        mismatch: st && st.ending ? st.ending.mismatch : null,
        light: st ? st.stage.light : null,
        pov: st ? st.stage.pov : null,
        lang: app.settings.lang,
        typing: V.isTyping()
      })
    );
  }

  function exposeHooks() {
    window.BHS_DEBUG = {
      state: debugState,
      game: function () {
        return app.game;
      },
      startRoute: startRoute,
      showTitle: showTitle,
      jump: jumpTo
    };
    if (BHS.ui) {
      try {
        Object.defineProperty(BHS.ui, "debugState", { value: debugState, enumerable: false, configurable: true, writable: true });
      } catch (err) {
        /* ui strings object frozen; window.BHS_DEBUG still works */
      }
    }
  }

  function currentRouteId() {
    var st = app.game && app.game.state;
    if (st && st.routeId !== "prologue") return st.routeId;
    return (BHS.meta && BHS.meta.routeOrder && BHS.meta.routeOrder[0]) || "scribe";
  }

  function isCutPick(rid, cid, optId) {
    var opt = E.findOption(E.findChoice(E.getRoute(rid), cid), optId);
    return !!(opt && opt.cut === true);
  }

  // Replays the route up to choice `cid`, keeping earlier picks; a cut option on the way is replaced
  // by the first option that does not end the route.
  function jumpTo(cid, routeId) {
    var rid = routeId || currentRouteId();
    if (!routeExists(rid)) return;
    var prev = app.game && app.game.state.routeId === rid ? JSON.parse(JSON.stringify(app.game.state.choices)) : {};
    var g = E.createGame(rid, { debug: app.debug });
    g.fastForward({
      until: function (s) {
        return s.kind === "choice" && s.id === cid;
      },
      pick: function (s) {
        if (prev[s.id] && !isCutPick(rid, s.id, prev[s.id])) return prev[s.id];
        for (var i = 0; i < s.options.length; i++) if (!isCutPick(rid, s.id, s.options[i].id)) return s.options[i].id;
        return s.options[0].id;
      }
    });
    app.game = g;
    renderGame({ instant: true });
  }

  function randomPick(step) {
    return step.options[Math.floor(Math.random() * step.options.length)].id;
  }

  function autoPick() {
    var g = app.game;
    if (!g || !PLAY_SCREENS[app.screen]) return;
    if (g.step.kind === "choice") g.choose(randomPick(g.step));
    else {
      g.fastForward({
        until: function (s) {
          return s.kind === "choice";
        }
      });
    }
    renderGame({ instant: true });
  }

  // Plays the rest of the route, ending included; renderGame then opens the gallery.
  function autoPlay() {
    var g = app.game;
    if (!g || !PLAY_SCREENS[app.screen]) return;
    g.fastForward({
      until: function (s) {
        return s.kind === "end";
      },
      pick: randomPick
    });
    renderGame({ instant: true });
  }

  // The debug panel is a developer tool, so it always uses the English labels.
  function dbg(key) {
    return (BHS.ui && BHS.ui[key] && BHS.ui[key].en) || key;
  }

  function refreshDebug() {
    if (!app.debug) return;
    var h = V.h;
    var box = doc.getElementById("debug");
    box.hidden = false;
    V.clear(box);
    box.className = "debug" + (app.debugMin ? " is-min" : "");
    var toggle = h(
      "button",
      {
        type: "button",
        on: {
          click: function () {
            app.debugMin = !app.debugMin;
            refreshDebug();
          }
        }
      },
      app.debugMin ? dbg("debugTitle") : dbg("debugHide")
    );
    box.appendChild(toggle);
    if (app.debugMin) return;
    var s = debugState();
    var info = [
      "screen " + s.screen + "  route " + (s.routeId || "-") + "  " + (s.list || "-") + "#" + (s.beatIndex == null ? "-" : s.beatIndex) + "  step " + (s.step || "-") + (s.stepId ? " " + s.stepId : ""),
      "choices " + JSON.stringify(s.choices),
      "scores " + JSON.stringify(s.scores) + "  projected " + (s.projectedLens || "-") + "  lens " + (s.lens || "-") + (s.cut ? "  (cut)" : ""),
      "flags " + JSON.stringify(s.flags) + "  vars " + JSON.stringify(s.vars),
      "light " + s.light + "  pov " + s.pov,
      E.warnings.length ? "warnings: " + E.warnings.slice(-3).join(" | ") : ""
    ].join("\n");
    box.appendChild(h("pre", null, info));
    var routes = (BHS.meta && BHS.meta.routeOrder) || ["scribe", "friend", "asher"];
    routes.forEach(function (rid) {
      box.appendChild(h("button", { type: "button", disabled: routeExists(rid) ? null : true, on: { click: function () { startRoute(rid); } } }, rid));
    });
    var sel = h("select", { "aria-label": dbg("debugJump"), "data-testid": "debug-select" });
    var jumpRoute = currentRouteId();
    E.choiceBeats(routeExists(jumpRoute) ? E.getRoute(jumpRoute) : null).forEach(function (cb) {
      sel.appendChild(h("option", { value: cb.id }, cb.id));
    });
    box.appendChild(sel);
    box.appendChild(h("button", { type: "button", "data-testid": "debug-jump", on: { click: function () { jumpTo(sel.value); } } }, dbg("debugJump")));
    box.appendChild(h("button", { type: "button", "data-testid": "debug-autopick", on: { click: autoPick } }, dbg("debugAutoPick")));
    box.appendChild(h("button", { type: "button", "data-testid": "debug-autoplay", on: { click: autoPlay } }, dbg("debugAutoPlay")));
  }

  // ------------------------------------------------------------------ boot

  function routeFromHash() {
    var hash = (window.location.hash || "").replace(/^#/, "");
    return /^(scribe|friend|asher)$/.test(hash) ? hash : null;
  }

  function boot() {
    if (!V || !E) {
      if (window.console) console.error("[BHS] engine or view missing");
      return;
    }
    if (app.test) doc.documentElement.classList.add("is-test");
    E.debug = app.debug;
    app.storageOK = store.probe();
    loadSettings();
    applySettings();
    V.init({ test: app.test, debug: app.debug, handlers: playHandlers() });
    renderHeader();
    exposeHooks();
    doc.addEventListener("keydown", onKey);
    doc.addEventListener("mousemove", wakeCursor, { passive: true });
    doc.addEventListener("mousedown", wakeCursor, { passive: true });
    doc.addEventListener("fullscreenchange", renderHeader);
    doc.addEventListener("webkitfullscreenchange", renderHeader);
    window.addEventListener("hashchange", function () {
      var rid = routeFromHash();
      if (rid) startRoute(rid);
    });
    var rid = routeFromHash();
    if (rid) startRoute(rid);
    else showTitle();
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
