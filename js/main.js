/*
 * js/main.js - app controller for "Before He Stood".
 * Owns screen flow (title -> prologue -> route select -> route -> ending card -> ending -> final ->
 * gallery), persistence (SPEC 5.3), keyboard input, deep links (#scribe/#friend/#asher), the
 * ?debug=1 panel, and the automated-test hooks:
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
    gallery: "bhs.v1.gallery",
    blanks: "bhs.v1.blanks"
  };
  var SAVE_VERSION = 1;
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

  // ------------------------------------------------------------------ save / gallery / blanks

  function persist() {
    if (!app.game) return;
    store.set(KEYS.save, {
      v: SAVE_VERSION,
      at: Date.now(),
      screen: app.screen,
      routeId: app.game.state.routeId,
      state: app.game.serialize()
    });
  }

  function persistRouteSelect() {
    store.set(KEYS.save, { v: SAVE_VERSION, at: Date.now(), screen: "routeSelect", routeId: null, state: null });
  }

  function loadSave() {
    var s = store.get(KEYS.save);
    if (!s || s.v !== SAVE_VERSION) return null;
    if (s.screen === "routeSelect") return s;
    if (!s.state || !s.routeId) return null;
    if (s.routeId !== "prologue" && !routeExists(s.routeId)) return null;
    return s;
  }

  function clearSave() {
    store.del(KEYS.save);
  }

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

  function loadBlanks() {
    var b = store.get(KEYS.blanks);
    return b && typeof b === "object" ? b : app.memBlanks || {};
  }

  function saveBlank(routeId, value) {
    var b = loadBlanks();
    b[routeId] = String(value || "").slice(0, 40);
    app.memBlanks = b;
    store.set(KEYS.blanks, b);
  }

  // ------------------------------------------------------------------ screens

  function setScreen(name) {
    app.screen = name;
    doc.body.setAttribute("data-screen", name);
    V.showLayer(name);
    V.closeSettings();
  }

  function headerHandlers() {
    return {
      onHome: askHome,
      onLang: setLang,
      onSettings: toggleSettings
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
    if (kind === "final") {
      showFinal();
      persist();
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

  function showFinal() {
    var g = app.game;
    var routeId = g.state.routeId;
    if (g.state.ending) app.lastEnding = g.state.ending.id;
    setScreen("final");
    V.renderFinal({
      routeId: routeId,
      blanks: loadBlanks(),
      storageOK: app.storageOK,
      onBlank: function (val) {
        saveBlank(routeId, val);
      },
      onNext: function () {
        if (app.game && app.game.step && app.game.step.kind === "final") app.game.next();
        finishRoute();
      }
    });
    refreshDebug();
  }

  function finishRoute() {
    clearSave();
    var current = app.lastEnding;
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

  function focusAdvance() {
    var adv = doc.getElementById("advance");
    if (adv && !adv.closest("[hidden]")) {
      try {
        adv.focus({ preventScroll: true });
      } catch (err) {
        adv.focus();
      }
    }
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

  function onKey(ev) {
    if (ev.defaultPrevented || ev.altKey || ev.ctrlKey || ev.metaKey) return;
    if (ev.key === "Escape") {
      if (!doc.getElementById("settings").hidden) {
        V.closeSettings();
        ev.preventDefault();
      } else if (!doc.getElementById("modal").hidden) {
        V.closeModal();
        ev.preventDefault();
      }
      return;
    }
    if (V.isModalOpen()) return;
    var tag = (ev.target && ev.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON" || tag === "A") return;
    if (!PLAY_SCREENS[app.screen] || !app.game) return;
    if (ev.key === "Enter" || ev.key === " " || ev.key === "Spacebar") {
      ev.preventDefault();
      onAdvance();
    } else if (/^[1-4]$/.test(ev.key) && app.game.step && app.game.step.kind === "choice") {
      var o = app.game.step.options[Number(ev.key) - 1];
      if (o) {
        ev.preventDefault();
        onChoose(o.id);
      }
    }
  }

  // ------------------------------------------------------------------ header actions

  function askHome() {
    V.closeSettings();
    if (app.screen === "title") return;
    // Nothing to lose outside the story itself.
    if (!PLAY_SCREENS[app.screen] && app.screen !== "final") {
      showTitle();
      return;
    }
    persist();
    V.confirm({
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
      case "final":
        showFinal();
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
        return prev[s.id] || s.options[0].id;
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

  function autoPlay() {
    var g = app.game;
    if (!g || !PLAY_SCREENS[app.screen]) return;
    g.fastForward({
      until: function (s) {
        return s.kind === "final";
      },
      pick: randomPick
    });
    renderGame({ instant: true });
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
      app.debugMin ? "DBG" : "hide"
    );
    box.appendChild(toggle);
    if (app.debugMin) return;
    var s = debugState();
    var info = [
      "screen " + s.screen + "  route " + (s.routeId || "-") + "  " + (s.list || "-") + "#" + (s.beatIndex == null ? "-" : s.beatIndex) + "  step " + (s.step || "-") + (s.stepId ? " " + s.stepId : ""),
      "choices " + JSON.stringify(s.choices),
      "scores " + JSON.stringify(s.scores) + "  projected " + (s.projectedLens || "-") + "  lens " + (s.lens || "-"),
      "flags " + JSON.stringify(s.flags) + "  vars " + JSON.stringify(s.vars),
      "light " + s.light + "  pov " + s.pov,
      E.warnings.length ? "warnings: " + E.warnings.slice(-3).join(" | ") : ""
    ].join("\n");
    box.appendChild(h("pre", null, info));
    var routes = (BHS.meta && BHS.meta.routeOrder) || ["scribe", "friend", "asher"];
    routes.forEach(function (rid) {
      box.appendChild(h("button", { type: "button", disabled: routeExists(rid) ? null : true, on: { click: function () { startRoute(rid); } } }, rid));
    });
    var sel = h("select", { "aria-label": "jump to choice" });
    for (var i = 1; i <= 10; i++) sel.appendChild(h("option", { value: "c" + i }, "c" + i));
    box.appendChild(sel);
    box.appendChild(h("button", { type: "button", on: { click: function () { jumpTo(sel.value); } } }, "jump"));
    box.appendChild(h("button", { type: "button", on: { click: autoPick } }, "auto-pick"));
    box.appendChild(h("button", { type: "button", on: { click: autoPlay } }, "auto-play"));
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
