/*
 * js/ui.js - DOM rendering for "Before He Stood" (BHS.view).
 * Draws the stage (art, light, POV, hush, caption, echo verse, pinned thought), the text box with a
 * typewriter, choices, press buttons, Asher's persistent actions, and the page screens (title, route
 * select, gallery), plus the header, settings, and in-page confirm dialog.
 * It never decides story flow; js/main.js drives it with views from BHS.engine.
 */
(function () {
  "use strict";

  var BHS = (window.BHS = window.BHS || {});
  var doc = document;

  var SIZE_STEPS = [0.9, 1, 1.12, 1.25, 1.4];
  var RATES = { slow: 56, normal: 28, instant: 0 };

  var S = {
    lang: "both",
    speed: "normal",
    size: 1,
    test: false,
    debug: false,
    reduced: false,
    artKey: null,
    artFlip: false,
    artSeq: 0,
    artTimer: 0,
    capKey: "",
    pinKey: "",
    pinItemsKey: "",
    replyTimer: 0,
    riseTimer: 0,
    handlers: {}
  };

  // ------------------------------------------------------------------ DOM helpers

  function $(id) {
    return doc.getElementById(id);
  }

  function append(node, kids) {
    if (kids == null) return node;
    if (!Array.isArray(kids)) kids = [kids];
    for (var i = 0; i < kids.length; i++) {
      var c = kids[i];
      if (c == null || c === false) continue;
      if (Array.isArray(c)) append(node, c);
      else node.appendChild(typeof c === "string" ? doc.createTextNode(c) : c);
    }
    return node;
  }

  function h(tag, props, kids) {
    var n = doc.createElement(tag);
    if (props) {
      for (var k in props) {
        if (!Object.prototype.hasOwnProperty.call(props, k)) continue;
        var v = props[k];
        if (v == null || v === false) continue;
        if (k === "class") n.className = v;
        else if (k === "text") n.textContent = v;
        else if (k === "on") {
          for (var ev in v) if (Object.prototype.hasOwnProperty.call(v, ev)) n.addEventListener(ev, v[ev]);
        } else if (k === "style") n.setAttribute("style", v);
        else n.setAttribute(k, v === true ? "" : String(v));
      }
    }
    return append(n, kids);
  }

  function clear(n) {
    while (n && n.firstChild) n.removeChild(n.firstChild);
    return n;
  }

  function svgIcon(paths) {
    var ns = "http://www.w3.org/2000/svg";
    var svg = doc.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    paths.forEach(function (p) {
      var el = doc.createElementNS(ns, p.tag || "path");
      Object.keys(p).forEach(function (k) {
        if (k !== "tag") el.setAttribute(k, p[k]);
      });
      svg.appendChild(el);
    });
    return svg;
  }

  // ------------------------------------------------------------------ language helpers

  function E() {
    return BHS.engine;
  }

  function langs() {
    return S.lang === "en" ? ["en"] : S.lang === "ko" ? ["ko"] : ["ko", "en"];
  }

  function pick(t, l) {
    if (E()) return E().pickLang(t, l);
    if (!t) return "";
    return typeof t === "string" ? t : t[l] || t.ko || "";
  }

  function u(key) {
    return (BHS.ui && BHS.ui[key]) || { ko: key, en: key };
  }

  // One string for attributes (aria-label, title). In "both" mode joins with a middle dot.
  function flat(t) {
    if (!t) return "";
    if (S.lang === "ko") return pick(t, "ko");
    if (S.lang === "en") return pick(t, "en");
    var ko = pick(t, "ko");
    var en = pick(t, "en");
    return ko === en ? ko : ko + " · " + en;
  }

  // Plain bilingual nodes: the second language goes in a span.en (styled per context).
  function bi(t) {
    var ls = langs();
    if (ls.length === 1) return [pick(t, ls[0])];
    var ko = pick(t, "ko");
    var en = pick(t, "en");
    if (ko === en) return [ko];
    return [h("span", { class: "ko", lang: "ko" }, ko), h("span", { class: "en", lang: "en" }, en)];
  }

  // Rich text into a host: tokens resolved, *emphasis* -> <em>, verse tokens in span.q.
  function richInto(host, t, l, state, chars) {
    var segs = E() ? E().resolveSegments(t, l, state) : [{ text: pick(t, l), em: false }];
    for (var i = 0; i < segs.length; i++) {
      var s = segs[i];
      var wrap = null;
      var target = host;
      if (s.em) {
        wrap = h("em");
        target = wrap;
      }
      if (s.kind === "v") {
        var q = h("span", { class: "q" });
        if (wrap) wrap.appendChild(q);
        else wrap = q;
        target = q;
      }
      if (chars) {
        var arr = Array.from(s.text);
        for (var j = 0; j < arr.length; j++) {
          var c = doc.createElement("span");
          c.className = "c";
          c.textContent = arr[j];
          target.appendChild(c);
          chars.push(c);
        }
      } else {
        target.appendChild(doc.createTextNode(s.text));
      }
      if (wrap) host.appendChild(wrap);
    }
    return host;
  }

  function biRich(t, state) {
    var ls = langs();
    if (ls.length === 1) return richInto(h("span", { lang: ls[0] }), t, ls[0], state, null);
    var frag = doc.createDocumentFragment();
    frag.appendChild(richInto(h("span", { class: "ko", lang: "ko" }), t, "ko", state, null));
    frag.appendChild(richInto(h("span", { class: "en", lang: "en" }), t, "en", state, null));
    return frag;
  }

  function verseOf(key, l) {
    var txt = E() && E().verseText(key, l);
    if (txt) return txt;
    return S.debug ? "[" + key + "]" : "…";
  }

  function refOf(key, l) {
    var r = E() && E().verseRef(key, l);
    return r || (S.debug ? "[" + key + "]" : "");
  }

  function refLine(key) {
    var ls = langs();
    var parts = [];
    ls.forEach(function (l) {
      var r = refOf(key, l);
      if (r && parts.indexOf(r) < 0) parts.push(r);
    });
    return parts.join(" · ");
  }

  function characterName(id, routeId) {
    var c = BHS.characters && BHS.characters[id];
    if (!c) return null;
    // SPEC 6.1: outside Asher's POV the mother is labelled "Asher's mother".
    if (id === "mother" && routeId !== "asher" && c.role) return c.role;
    return c.name;
  }

  // ------------------------------------------------------------------ typewriter

  var typer = { raf: 0, seq: null, i: 0, start: 0, done: true, onDone: null };

  function instantText() {
    return S.speed === "instant" || S.reduced || S.test;
  }

  function pauseAfter(ch) {
    if (".?!…。".indexOf(ch) >= 0) return 6;
    if (",;:、—―".indexOf(ch) >= 0) return 3;
    return 1;
  }

  function typeStart(groups, onDone) {
    typeStop();
    var seq = [];
    var t = 0;
    groups.forEach(function (g) {
      g.chars.forEach(function (c) {
        seq.push({ c: c, t: t });
        t += g.rate * pauseAfter(c.textContent);
      });
      t += g.rate * 4;
    });
    typer.seq = seq;
    typer.i = 0;
    typer.done = false;
    typer.onDone = onDone || null;
    if (!seq.length) {
      typeFinish();
      return;
    }
    typer.start = performance.now();
    typer.raf = requestAnimationFrame(typeTick);
  }

  function typeTick(now) {
    var seq = typer.seq;
    if (!seq) return;
    var elapsed = now - typer.start;
    while (typer.i < seq.length && seq[typer.i].t <= elapsed) {
      seq[typer.i].c.className = "c on";
      typer.i++;
    }
    if (typer.i >= seq.length) typeFinish();
    else typer.raf = requestAnimationFrame(typeTick);
  }

  function typeFinish() {
    cancelAnimationFrame(typer.raf);
    var seq = typer.seq || [];
    for (var i = typer.i; i < seq.length; i++) seq[i].c.className = "c on";
    typer.i = seq.length;
    var wasDone = typer.done;
    typer.done = true;
    var cb = typer.onDone;
    typer.onDone = null;
    if (!wasDone && cb) cb();
  }

  function typeStop() {
    cancelAnimationFrame(typer.raf);
    typer.seq = null;
    typer.i = 0;
    typer.done = true;
    typer.onDone = null;
  }

  function completeTyping() {
    if (typer.done) return false;
    typeFinish();
    return true;
  }

  function isTyping() {
    return !typer.done;
  }

  // ------------------------------------------------------------------ stage

  var FALLBACK = {
    black: "linear-gradient(180deg,#131210,#1d1b18)",
    dawn_lamp: "radial-gradient(60% 40% at 50% 62%,#7a5326 0%,#3a2a1b 45%,#1c1712 100%)",
    shore_dawn: "linear-gradient(180deg,#8fa7b6 0%,#d9c7a2 55%,#4d5a5e 56%,#2b3236 100%)",
    asher_ceiling: "linear-gradient(180deg,#2d241c 0%,#5c4835 60%,#c9a46a 100%)",
    asher_home: "linear-gradient(180deg,#4d3e30 0%,#7e6850 70%,#3b3027 100%)",
    lane: "linear-gradient(90deg,#26231f 0 22%,#cfd6d6 22% 78%,#26231f 78%)",
    sky_carried: "linear-gradient(180deg,#78a9c9 0%,#cfe4ee 70%,#a88d6a 100%)",
    crowd: "radial-gradient(50% 35% at 50% 40%,#fff0c8 0%,#d9cdb0 40%,#5b5a52 100%)",
    crowd_lying: "radial-gradient(45% 30% at 50% 20%,#fff2cf 0%,#c5d3d8 45%,#3c3a36 100%)",
    road_home: "linear-gradient(180deg,#e4c58a 0%,#f0dcb3 55%,#8a7556 100%)",
    doorway_evening: "linear-gradient(180deg,#3d3247 0%,#a9744c 70%,#2d241f 100%)",
    lamp_night: "radial-gradient(45% 30% at 50% 60%,#8a5a22 0%,#2a1f15 50%,#100e0b 100%)"
  };

  function namespaceSvg(svg, prefix) {
    return svg
      .replace(/(\s)id=(["'])([^"']*)\2/g, function (m, sp, q, id) {
        return sp + "id=" + q + prefix + id + q;
      })
      .replace(/url\(\s*(["']?)#([^)"'\s]+)\1\s*\)/g, function (m, q, id) {
        return "url(#" + prefix + id + ")";
      })
      .replace(/(xlink:href|href)=(["'])#([^"']*)\2/g, function (m, attr, q, id) {
        return attr + "=" + q + "#" + prefix + id + q;
      });
  }

  function artNode(bg, pov, time) {
    var markup = null;
    var opts = { pov: pov };
    if (time) opts.time = time;
    try {
      if (BHS.art && typeof BHS.art.render === "function") markup = BHS.art.render(bg, opts);
    } catch (err) {
      if (window.console) console.warn("[BHS.view] art.render failed for " + bg, err);
      markup = null;
    }
    var holder = doc.createElement("div");
    holder.style.cssText = "position:absolute;inset:0";
    if (typeof markup === "string" && markup.indexOf("<svg") >= 0) {
      holder.innerHTML = namespaceSvg(markup, "a" + ++S.artSeq + "-");
      var svg = holder.querySelector("svg");
      if (svg) {
        svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "100%");
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("focusable", "false");
        return svg;
      }
    }
    return h("div", { class: "art__fallback", style: "background:" + (FALLBACK[bg] || FALLBACK.black) });
  }

  function setArt(bg, pov, time) {
    bg = bg || "black";
    var key = bg + "|" + pov + "|" + (time || "");
    if (key === S.artKey) return;
    S.artKey = key;
    var a = $("artA");
    var b = $("artB");
    var incoming = S.artFlip ? a : b;
    var outgoing = S.artFlip ? b : a;
    S.artFlip = !S.artFlip;
    clear(incoming);
    incoming.appendChild(artNode(bg, pov, time));
    // Force a style flush so the fade runs even when both layers change in one frame.
    void incoming.offsetWidth;
    incoming.classList.add("is-on");
    outgoing.classList.remove("is-on");
    clearTimeout(S.artTimer);
    S.artTimer = setTimeout(
      function () {
        if (!outgoing.classList.contains("is-on")) clear(outgoing);
      },
      S.test ? 0 : 900
    );
  }

  function setPov(pov) {
    var stage = $("stage");
    var prev = stage.getAttribute("data-pov") || "normal";
    if (prev === pov) return;
    stage.setAttribute("data-pov", pov);
    if (prev === "lying" && pov !== "lying" && !S.reduced && !S.test) {
      stage.classList.remove("is-rising");
      void stage.offsetWidth;
      stage.classList.add("is-rising");
      clearTimeout(S.riseTimer);
      S.riseTimer = setTimeout(function () {
        stage.classList.remove("is-rising");
      }, 2800);
    }
  }

  function setLight(level) {
    $("light").setAttribute("data-level", level || "off");
  }

  // Anchor the light on the place the art reserves for it (BHS.art.lightAt, in canvas units),
  // mapping canvas -> screen through the SVG's xMidYMid slice transform. Falls back to CSS.
  function placeLight() {
    var light = $("light");
    var art = BHS.art;
    var key = S.artKey ? S.artKey.split("|") : null;
    var drawn = key ? (art && typeof art.resolve === "function" ? art.resolve(key[0], key[1]) : key[0]) : null;
    var pt = drawn && art && art.lightAt && art.lightAt[drawn];
    if (!pt) {
      light.style.removeProperty("--light-x");
      light.style.removeProperty("--light-y");
      return;
    }
    var stage = $("stage");
    var W = stage.clientWidth;
    var H = stage.clientHeight;
    var artEl = $("art");
    if (!W || !H || !artEl) return;
    var vbW = 1600;
    var vbH = 1600;
    var svg = artEl.querySelector(".art__layer.is-on svg");
    var vb = svg && svg.getAttribute("viewBox");
    if (vb) {
      var parts = vb.split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
        vbW = parts[2];
        vbH = parts[3];
      }
    }
    // Layout box of the art (ignores the small pov tilt) relative to the stage.
    var ax = artEl.offsetLeft;
    var ay = artEl.offsetTop;
    var aw = artEl.offsetWidth;
    var ah = artEl.offsetHeight;
    var s = Math.max(aw / vbW, ah / vbH);
    var x = ax + (aw - vbW * s) / 2 + pt[0] * s;
    var y = ay + (ah - vbH * s) / 2 + pt[1] * s;
    var lx = light.offsetLeft;
    var ly = light.offsetTop;
    var lw = light.offsetWidth || W;
    var lh = light.offsetHeight || H;
    light.style.setProperty("--light-x", (((x - lx) / lw) * 100).toFixed(2) + "%");
    light.style.setProperty("--light-y", (((y - ly) / lh) * 100).toFixed(2) + "%");
  }

  function setCaption(t) {
    var c = $("caption");
    var key = t ? JSON.stringify(t) + "|" + S.lang : "";
    if (key === S.capKey) return;
    S.capKey = key;
    clear(c);
    if (!t) {
      c.hidden = true;
      return;
    }
    append(c, bi(t));
    c.hidden = false;
  }

  function markedNodes(text, marks) {
    if (marks === "*") return [h("mark", null, text)];
    var list = Array.isArray(marks) ? marks : [];
    var hits = [];
    list.forEach(function (m) {
      if (!m) return;
      var i = text.indexOf(m);
      if (i >= 0) hits.push({ i: i, j: i + m.length });
    });
    hits.sort(function (x, y) {
      return x.i - y.i;
    });
    var out = [];
    var pos = 0;
    hits.forEach(function (hit) {
      if (hit.i < pos) return;
      if (hit.i > pos) out.push(text.slice(pos, hit.i));
      out.push(h("mark", null, text.slice(hit.i, hit.j)));
      pos = hit.j;
    });
    if (pos < text.length) out.push(text.slice(pos));
    return out;
  }

  function setEcho(echo) {
    var e = $("echo");
    clear(e);
    if (!echo) {
      e.hidden = true;
      return;
    }
    var ls = langs();
    ls.forEach(function (l, idx) {
      var marks = echo.marks === "*" ? "*" : echo.marks ? echo.marks[l] : null;
      var span = h("span", { class: idx > 0 ? "en" : "ko", lang: l });
      append(span, markedNodes(verseOf(echo.key, l), marks));
      e.appendChild(span);
    });
    var ref = refLine(echo.key);
    if (ref) e.appendChild(h("span", { class: "echo__ref" }, ref));
    e.hidden = false;
  }

  function receiptText() {
    var t = u("readReceipt");
    if (S.lang === "ko") return t.ko;
    if (S.lang === "en") return t.en;
    return t.ko.replace(/\s*✓\s*$/, "") + " · " + t.en;
  }

  function setPinned(pinned, state) {
    var p = $("pin");
    var key = pinned ? JSON.stringify(pinned) + "|" + S.lang : "";
    if (key === S.pinKey) return;
    var itemsKey = pinned ? JSON.stringify(pinned.items) + "|" + S.lang : "";
    var onlyReadChanged = pinned && itemsKey === S.pinItemsKey && pinned.read && !p.querySelector(".receipt");
    S.pinKey = key;
    S.pinItemsKey = itemsKey;
    if (onlyReadChanged) {
      p.appendChild(h("span", { class: "receipt", "data-testid": "read-receipt" }, receiptText()));
      return;
    }
    clear(p);
    if (!pinned) {
      p.hidden = true;
      p.removeAttribute("data-testid");
      return;
    }
    p.setAttribute("data-testid", "thought-bubble");
    p.setAttribute("aria-label", flat(u("pinnedThought")));
    var ls = langs();
    pinned.items.forEach(function (it) {
      var row = h("div", { class: "pin__item" });
      if (it.type === "verse") {
        ls.forEach(function (l, idx) {
          var vt = verseOf(it.key, l);
          row.appendChild(h("span", { class: idx > 0 ? "en" : "ko", lang: l }, E() ? E().quoteVerse(vt) : "“" + vt + "”"));
        });
        var ref = refLine(it.key);
        if (ref) row.appendChild(h("span", { class: "pin__ref" }, ref));
      } else if (it.text) {
        row.appendChild(biRich(it.text, state));
      }
      p.appendChild(row);
    });
    if (pinned.read) p.appendChild(h("span", { class: "receipt", "data-testid": "read-receipt" }, receiptText()));
    p.hidden = false;
  }

  function setHush(on) {
    doc.body.classList.toggle("is-hush", !!on);
  }

  // ------------------------------------------------------------------ portraits (VN-style busts)

  var portraitCache = {};

  // Scene light washes for portraits so figures sit in lamp, dusk, or night light.
  function portraitLight(stage) {
    if (!stage) return "";
    var bg = stage.bg, time = stage.time;
    if (bg === "dawn_lamp") return "lamp";
    if (bg === "lamp_night") return "night";
    if (bg === "doorway_evening") return "dusk";
    if (bg === "asher_home" || bg === "asher_ceiling") {
      if (time === "night") return "night";
      if (time === "evening") return "dusk";
    }
    return "";
  }

  function portraitMarkup(id, pose, light) {
    var key = id + "|" + (pose || "") + "|" + (light || "");
    if (Object.prototype.hasOwnProperty.call(portraitCache, key)) return portraitCache[key];
    var m = null;
    try {
      var opts = {};
      if (pose) opts.pose = pose;
      if (light) opts.light = light;
      if (BHS.portraits && typeof BHS.portraits.render === "function") m = BHS.portraits.render(id, opts);
    } catch (err) {
      if (window.console) console.warn("[BHS.view] portraits.render failed for " + id, err);
      m = null;
    }
    if (typeof m !== "string" || m.indexOf("<svg") < 0) m = null;
    portraitCache[key] = m;
    return m;
  }

  function dropFigure(fig) {
    fig.removeAttribute("data-testid");
    fig.classList.add("is-out");
    fig.setAttribute("data-slot", "gone");
    setTimeout(
      function () {
        if (fig.parentNode) fig.parentNode.removeChild(fig);
      },
      S.test || S.reduced ? 0 : 260
    );
  }

  function makeFigure(entry, key, markup) {
    // Busts face inward: mirror the art when it faces away from the stage centre.
    var facing = BHS.portraits && BHS.portraits.facing && BHS.portraits.facing[entry.id];
    var mirror = (facing === "left" && entry.slot === 0) || (facing === "right" && entry.slot === 1);
    var fig = h("div", { class: "figure is-in" + (mirror ? " is-mirror" : ""), "data-slot": String(entry.slot), "data-key": key, "data-testid": "portrait-" + entry.id, "data-id": entry.id });
    fig.innerHTML = namespaceSvg(markup, "p" + ++S.artSeq + "-");
    var svg = fig.querySelector("svg");
    if (svg) {
      svg.setAttribute("preserveAspectRatio", "xMidYMax meet");
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "100%");
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("focusable", "false");
    }
    return fig;
  }

  function setCast(stage) {
    var layer = $("cast");
    if (!layer) return;
    var cast = (stage && stage.cast) || [];
    [0, 1].forEach(function (slot) {
      var entry = null;
      for (var i = 0; i < cast.length; i++) if (cast[i].slot === slot) entry = cast[i];
      var fig = layer.querySelector('.figure[data-slot="' + slot + '"]');
      var light = portraitLight(stage);
      var markup = entry ? portraitMarkup(entry.id, entry.pose, light) : null;
      var key = entry ? entry.id + "|" + (entry.pose || "") + "|" + light : "";
      if (!entry || !markup) {
        if (fig) dropFigure(fig);
        return;
      }
      if (!fig || fig.getAttribute("data-key") !== key) {
        if (fig) dropFigure(fig);
        fig = makeFigure(entry, key, markup);
        layer.appendChild(fig);
      }
      fig.classList.toggle("is-dim", stage.speaking !== entry.id);
    });
  }

  // Portraits stand on the top edge of the text panel; remember where that edge is.
  function anchorCast() {
    var panel = $("panel");
    var app = $("app");
    if (!panel || panel.hidden || $("play").hidden || $("play").classList.contains("play--sign") || $("play").classList.contains("play--last")) return;
    var pr = panel.getBoundingClientRect();
    var ar = app.getBoundingClientRect();
    if (!pr.height) return;
    app.style.setProperty("--panel-top", Math.max(0, Math.round(ar.bottom - pr.top)) + "px");
  }

  function updateStage(v, state) {
    var st = v.stage;
    setArt(st.bg, st.pov, st.time);
    setPov(st.pov);
    setLight(st.light);
    placeLight();
    setCaption(st.caption);
    setPinned(st.pinned, state);
    setEcho(v.now && v.now.echo);
    setHush(v.now && v.now.hush);
    setCast(st);
  }

  // A page screen keeps scene art behind it but clears all play overlays.
  function pageStage(bg) {
    setArt(bg || "black", "normal");
    setPov("normal");
    setLight("off");
    setCaption(null);
    setPinned(null);
    setEcho(null);
    setHush(false);
    setCast(null);
  }

  // ------------------------------------------------------------------ play layer

  function setPlate(speaker, routeId) {
    var plate = $("plate");
    clear(plate);
    plate.className = "plate";
    plate.removeAttribute("style");
    if (!speaker) {
      plate.hidden = true;
      plate.removeAttribute("data-testid");
      return;
    }
    var name = characterName(speaker, routeId);
    if (!name) {
      plate.hidden = true;
      plate.removeAttribute("data-testid");
      return;
    }
    var ls = langs();
    if (ls.length === 1) plate.appendChild(doc.createTextNode(pick(name, ls[0])));
    else {
      plate.appendChild(doc.createTextNode(pick(name, "ko")));
      plate.appendChild(h("span", { class: "plate__en", lang: "en" }, " · " + pick(name, "en")));
    }
    var c = BHS.characters[speaker];
    if (speaker === "jesus") plate.classList.add("plate--jesus");
    else if (c && c.color) plate.style.setProperty("--plate", c.color);
    plate.setAttribute("data-testid", "speaker");
    plate.hidden = false;
  }

  function rateFor(l, hush) {
    var base = RATES[S.speed] == null ? RATES.normal : RATES[S.speed];
    // Latin letters are narrower; in "both" mode the second language types faster still.
    var r = l === "en" ? base * (S.lang === "both" ? 0.4 : 0.5) : base;
    return hush ? r * 2.2 : r;
  }

  // Fill the text box with one or both languages; returns typewriter groups.
  function fillText(host, t, state, opts) {
    clear(host);
    var ls = langs();
    var groups = [];
    var typing = !opts.instant && !instantText();
    ls.forEach(function (l, idx) {
      var p = h("p", { class: ls.length > 1 && idx > 0 ? "en" : "ko", lang: l });
      var chars = typing ? [] : null;
      if (opts.verseKey) {
        var txt = verseOf(opts.verseKey, l);
        if (chars) {
          Array.from(txt).forEach(function (ch) {
            var c = doc.createElement("span");
            c.className = "c";
            c.textContent = ch;
            p.appendChild(c);
            chars.push(c);
          });
        } else p.textContent = txt;
      } else {
        richInto(p, t, l, state, chars);
      }
      host.appendChild(p);
      if (chars) groups.push({ chars: chars, rate: rateFor(l, opts.hush) });
    });
    return groups;
  }

  function resetPlay() {
    var play = $("play");
    play.className = "play";
    var panel = $("panel");
    panel.className = "panel";
    panel.removeAttribute("data-testid");
    panel.hidden = false;
    clear($("text"));
    $("ref").hidden = true;
    clear($("ref"));
    setPlate(null);
    var choices = $("choices");
    clear(choices);
    choices.hidden = true;
    var pressbox = $("pressbox");
    clear(pressbox);
    pressbox.hidden = true;
    var card = $("card");
    clear(card);
    card.hidden = true;
    card.className = "card";
    card.removeAttribute("data-testid");
    card.removeAttribute("data-cut");
    doc.body.classList.remove("is-last");
  }

  function renderPlay(v, ctx) {
    ctx = ctx || {};
    var step = v.step;
    var state = ctx.state || {};
    var hd = S.handlers;
    typeStop();
    updateStage(v, state);
    resetPlay();
    $("play").hidden = false;
    renderActions(v.actions || [], step);
    // Portraits step back while a choice is open; the engine keeps them for the next line.
    var castLayer = $("cast");
    if (castLayer) castLayer.classList.toggle("is-away", step.kind === "choice");
    var panel = $("panel");
    var text = $("text");
    var hush = !!(v.now && v.now.hush);
    var groups = [];

    switch (step.kind) {
      case "line": {
        var sp = step.speaker || "narrator";
        if (sp === "sign") $("play").classList.add("play--sign");
        else if (sp === "thought") panel.classList.add("panel--thought");
        else if (sp !== "narrator") setPlate(sp, ctx.routeId);
        if (step.mismatch) panel.classList.add("panel--mismatch");
        groups = fillText(text, step.text, state, { instant: ctx.instant, hush: hush });
        break;
      }
      case "verse": {
        panel.classList.add("panel--verse");
        panel.setAttribute("data-testid", "verse-card");
        var vs = step.speaker || "narrator";
        if (vs === "jesus") panel.classList.add("panel--jesus");
        if (vs === "jesus" || vs === "scribes") setPlate(vs, ctx.routeId);
        groups = fillText(text, null, state, { instant: ctx.instant, hush: hush, verseKey: step.key });
        var ref = $("ref");
        ref.textContent = refLine(step.key);
        ref.hidden = !ref.textContent;
        break;
      }
      case "choice":
        panel.hidden = true;
        renderChoice(step, state);
        break;
      case "press":
        panel.hidden = true;
        $("play").classList.add("play--press");
        renderPress(step);
        break;
      case "endingTitle":
        panel.hidden = true;
        renderCard(step);
        break;
      case "last":
        $("play").classList.add("play--last");
        doc.body.classList.add("is-last");
        groups = fillText(text, step.text, state, { instant: ctx.instant, hush: false });
        break;
      default:
        panel.hidden = true;
    }

    anchorCast();

    if (!panel.hidden) {
      panel.classList.remove("is-ready");
      typeStart(groups, function () {
        panel.classList.add("is-ready");
        if (hd.onTyped) hd.onTyped();
      });
    }
  }

  function renderChoice(step, state) {
    var box = $("choices");
    clear(box);
    var pid = "prompt-" + step.id;
    if (step.prompt) box.appendChild(h("p", { class: "choices__prompt", id: pid }, biRich(step.prompt, state)));
    var list = h("div", { class: "choices__list", role: "group", "aria-labelledby": step.prompt ? pid : null, "aria-label": step.prompt ? null : flat(u("choiceGroup")) });
    step.options.forEach(function (o, idx) {
      var b = h("button", { type: "button", class: "opt", "data-testid": "choice-" + o.id, "data-option": o.id, "aria-keyshortcuts": String(idx + 1) + " " + o.id.toUpperCase() }, [
        h("span", { class: "opt__num", "aria-hidden": "true" }, String(idx + 1)),
        h("span", { class: "opt__body" }, biRich(o.text, state))
      ]);
      b.addEventListener("click", function (ev) {
        ev.stopPropagation();
        if (S.handlers.onChoose) S.handlers.onChoose(o.id);
      });
      list.appendChild(b);
    });
    box.appendChild(list);
    box.hidden = false;
    box.scrollTop = 0;
    clear($("reply"));
    // Long options (verse texts) would overflow a 2x2 grid; full-width rows wrap far less.
    box.classList.remove("is-stacked");
    if (box.scrollHeight > box.clientHeight + 2) box.classList.add("is-stacked");
  }

  function renderPress(step) {
    var box = $("pressbox");
    clear(box);
    if (step.hint && !step.action) box.appendChild(h("p", { class: "pressbox__hint" }, bi(step.hint)));
    if (!step.action) {
      var b = h("button", { type: "button", class: "glow", "data-testid": "press" }, bi(step.label || u("pressDefault")));
      b.addEventListener("click", function (ev) {
        ev.stopPropagation();
        if (S.handlers.onPress) S.handlers.onPress();
      });
      box.appendChild(b);
    } else if (step.hint) {
      box.appendChild(h("p", { class: "pressbox__hint" }, bi(step.hint)));
    }
    box.hidden = !box.firstChild;
  }

  function renderActions(actions, step) {
    var bar = $("actions");
    clear(bar);
    // While a choice is open the gray buttons step aside so the options have the room.
    if (!actions.length || (step && (step.kind === "endingTitle" || step.kind === "last" || step.kind === "choice"))) {
      bar.hidden = true;
      return;
    }
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", flat(u("actionsGroup")));
    actions.forEach(function (a) {
      var b;
      if (a.lit) {
        // The lit button answers both selectors: press (outer) and action-<id> (inner).
        b = h("button", { type: "button", class: "act glow", "data-testid": "press", "data-action": a.id }, h("span", { "data-testid": "action-" + a.id }, bi(a.label)));
      } else {
        b = h("button", { type: "button", class: "act", "data-testid": "action-" + a.id, "data-action": a.id }, bi(a.label));
      }
      b.addEventListener("click", function (ev) {
        ev.stopPropagation();
        if (S.handlers.onAction) S.handlers.onAction(a.id, b);
      });
      bar.appendChild(b);
    });
    bar.hidden = false;
  }

  function showReply(t, state) {
    var r = $("reply");
    clear(r);
    if (!t) return;
    append(r, biRich(t, state));
    void r.offsetWidth;
    r.classList.add("is-on");
    clearTimeout(S.replyTimer);
    S.replyTimer = setTimeout(function () {
      r.classList.remove("is-on");
      S.replyTimer = setTimeout(function () {
        clear(r);
      }, 300);
    }, 2600);
  }

  function shake(btn) {
    if (!btn || S.reduced || S.test) return;
    btn.classList.remove("is-shake");
    void btn.offsetWidth;
    btn.classList.add("is-shake");
  }

  var LENS_NUM = { 1: "①", 2: "②", 3: "③" };
  // The mark of a route that stopped midway (the cut column and the cut ending card).
  var CUT_MARK = "…";

  // Ending title card. A cut ending shows meta.cut.label over meta.endings[route].cut.
  function renderCard(step) {
    var card = $("card");
    clear(card);
    var ls = langs();
    card.className = "card" + (step.cut ? " card--cut" : "");
    card.appendChild(h("span", { class: "card__num", "aria-hidden": "true" }, step.cut ? CUT_MARK : LENS_NUM[step.lens] || ""));
    card.appendChild(h("p", { class: "card__lens" }, flat(step.lensLabel)));
    var title = h("h2", { class: "card__title" });
    if (ls.length === 1) title.appendChild(doc.createTextNode(pick(step.title, ls[0])));
    else {
      title.appendChild(doc.createTextNode(pick(step.title, "ko")));
      title.appendChild(h("span", { class: "en", lang: "en" }, pick(step.title, "en")));
    }
    card.appendChild(title);
    card.appendChild(h("p", { class: "card__hint" }, flat(u("endingCardHint"))));
    card.setAttribute("data-testid", "ending-title");
    card.setAttribute("data-cut", step.cut ? "true" : "false");
    card.setAttribute("aria-live", "polite");
    card.hidden = false;
  }

  // ------------------------------------------------------------------ page screens

  function showLayer(screen) {
    var playing = screen === "prologue" || screen === "play" || screen === "endingCard" || screen === "ending";
    $("play").hidden = !playing;
    if (playing) clear($("screen"));
    $("topbar").hidden = screen === "title";
    if (!playing) {
      typeStop();
      clear($("reply"));
    }
  }

  function page(cls, kids) {
    var scr = $("screen");
    clear(scr);
    var p = h("div", { class: "page " + cls }, kids);
    scr.appendChild(p);
    scr.scrollTop = 0;
    return p;
  }

  function btn(cls, t, testid, onClick, sub) {
    var kids = bi(t);
    if (sub) kids = kids.concat([h("span", { class: "btn__sub" }, sub)]);
    return h("button", { type: "button", class: "btn " + cls, "data-testid": testid, on: { click: onClick } }, kids);
  }

  function renderTitle(o) {
    var meta = BHS.meta || {};
    var title = meta.title || { ko: "그가 일어나기 전", en: "Before He Stood" };
    var ko = title.ko || "";
    var cut = ko.indexOf(" ");
    var titleLines = cut > 0 ? [h("span", { class: "title-main__line" }, ko.slice(0, cut)), h("span", { class: "title-main__line" }, ko.slice(cut + 1))] : [h("span", { class: "title-main__line" }, ko)];

    var langBtn = function (mode, t, testid) {
      return h(
        "button",
        {
          type: "button",
          class: "langbtn",
          "data-testid": testid,
          "aria-pressed": S.lang === mode ? "true" : "false",
          lang: mode === "en" ? "en" : "ko",
          on: {
            click: function () {
              if (o.onLang) o.onLang(mode);
            }
          }
        },
        mode === "both" ? [t.ko, h("span", { class: "en", lang: "en" }, t.en)] : [t.ko === t.en ? t.ko : t.ko]
      );
    };

    var actions = [btn("btn--primary", u("start"), "start", o.onStart)];
    if (o.hasSave) actions.push(btn("btn--ghost", u("continueGame"), "continue", o.onContinue, o.saveLabel || null));
    actions.push(btn("btn--text", u("galleryOpen"), "gallery-open", o.onGallery));

    var kids = [
      h("div", { class: "title-head" }, [
        meta.subtitle ? h("p", { class: "title-sub" }, bi(meta.subtitle)) : null,
        h("h1", { class: "title-main", lang: "ko" }, titleLines),
        h("p", { class: "title-en", lang: "en" }, title.en || "")
      ]),
      h("div", { class: "title-side" }, [
        meta.disclaimer ? h("p", { class: "title-disclaimer" }, bi(meta.disclaimer)) : null,
        o.notice ? h("p", { class: "notice", role: "status" }, bi(o.notice)) : null,
        h("div", { class: "langpick" }, [
          h("p", { class: "langpick__label", id: "langpick-label" }, flat(u("langPrompt"))),
          h("div", { class: "langpick__row", role: "group", "aria-labelledby": "langpick-label" }, [langBtn("ko", u("langKo"), "lang-ko"), langBtn("en", u("langEn"), "lang-en"), langBtn("both", u("langBoth"), "lang-both")])
        ]),
        h("div", { class: "title-actions" }, actions),
        h("div", { class: "title-foot" }, [
          // The English notice already carries the Korean credit, so "both" shows it alone.
          meta.bibleNotice ? h("p", { class: "fineprint", lang: S.lang === "ko" ? "ko" : "en" }, pick(meta.bibleNotice, S.lang === "ko" ? "ko" : "en")) : null
        ])
      ])
    ];
    page("title-page", kids);
  }

  function renderRouteSelect(o) {
    var meta = BHS.meta || {};
    var order = meta.routeOrder || ["scribe", "friend", "asher"];
    var prompt = (BHS.common && BHS.common.routeSelect && BHS.common.routeSelect.prompt) || { ko: "", en: "" };
    var cards = order.map(function (id) {
      var r = (meta.routes && meta.routes[id]) || {};
      var c = (BHS.characters && BHS.characters[r.protagonist]) || {};
      var ready = !!(BHS.routes && BHS.routes[id]);
      var plateKids = langs().length === 1 ? [pick(r.name, langs()[0])] : [pick(r.name, "ko"), h("span", { class: "plate__en plate__en--stack", lang: "en" }, pick(r.name, "en"))];
      var plate = h("span", { class: "plate", style: c.color ? "--plate:" + c.color : null }, plateKids);
      return h(
        "button",
        {
          type: "button",
          class: "routecard" + (ready ? "" : " routecard--missing"),
          "data-testid": "route-" + id,
          "data-route": id,
          on: {
            click: function () {
              if (o.onPick) o.onPick(id);
            }
          }
        },
        [plate, h("span", { class: "routecard__title" }, bi(r.title || { ko: id, en: id })), r.tagline ? h("span", { class: "routecard__tag" }, bi(r.tagline)) : null, r.firstLine ? h("span", { class: "routecard__first" }, bi(r.firstLine)) : null]
      );
    });
    page("routes-page", [h("h2", { class: "routes-prompt" }, bi(prompt)), o.notice ? h("p", { class: "notice", role: "status" }, bi(o.notice)) : null, h("div", { class: "routes-list" }, cards)]);
  }

  // Endings gallery: rows = characters, columns = lenses 1-3 plus the "cut" column (SPEC 4.5).
  // A cut cell unlocks with "<route>-cut". A route without a cut ending (Asher) shows its cutNote
  // there once any of its endings has been seen: a note, not an ending (data-state="note").
  var GALLERY_COLS = [1, 2, 3, "cut"];

  function galleryCell(meta, rid, col, seen, current) {
    var titles = (meta.endings && meta.endings[rid]) || {};
    var id = rid + "-" + col;
    var state = "locked";
    var kids = null;
    if (col === "cut" && !titles.cut) {
      var seenAny = [1, 2, 3].some(function (l) {
        return seen.indexOf(rid + "-" + l) >= 0;
      });
      if (titles.cutNote && seenAny) {
        state = "note";
        kids = bi(titles.cutNote);
      } else if (!titles.cutNote) {
        state = "none";
        kids = ["—"];
      }
    } else if (seen.indexOf(id) >= 0 && titles[col]) {
      state = "seen";
      kids = bi(titles[col]);
    }
    var cell = h("div", {
      class: "cell" + (col === "cut" ? " cell--cut" : "") + (state === "note" ? " cell--note" : ""),
      role: "cell",
      "data-testid": "gallery-cell-" + id,
      "data-col": String(col),
      "data-state": state,
      "data-seen": state === "seen" ? "true" : "false",
      "data-current": state === "seen" && current === id ? "true" : null
    });
    if (kids) append(cell, kids);
    else append(cell, bi(u("galleryLocked")));
    if (state === "seen" && current === id) cell.appendChild(h("span", { class: "cell__yours" }, flat(u("galleryYours"))));
    return cell;
  }

  function renderGallery(o) {
    var meta = BHS.meta || {};
    var order = meta.routeOrder || ["scribe", "friend", "asher"];
    var seen = (o.seen || []).filter(function (x) {
      return typeof x === "string";
    });
    var grid = h("div", { class: "grid", role: "table", "aria-label": flat(u("galleryTitle")) });
    grid.appendChild(h("div", { class: "grid__corner", role: "presentation" }));
    GALLERY_COLS.forEach(function (col) {
      if (col === "cut") {
        var cm = meta.cut || { label: u("galleryCut"), desc: null };
        grid.appendChild(
          h("div", { class: "grid__lens grid__lens--cut", role: "columnheader", "data-testid": "gallery-col-cut" }, [
            h("span", { class: "grid__label" }, [h("span", { class: "grid__mark", "aria-hidden": "true" }, CUT_MARK + " "), bi(cm.label)]),
            cm.desc ? h("span", { class: "grid__desc" }, bi(cm.desc)) : null
          ])
        );
        return;
      }
      var lm = (meta.lenses && meta.lenses[col]) || { label: { ko: String(col), en: String(col) } };
      grid.appendChild(h("div", { class: "grid__lens", role: "columnheader", "data-testid": "gallery-col-" + col }, h("span", { class: "grid__label" }, [LENS_NUM[col] + " ", bi(lm.label)])));
    });
    order.forEach(function (rid) {
      var r = (meta.routes && meta.routes[rid]) || {};
      var c = (BHS.characters && BHS.characters[r.protagonist]) || {};
      var nm = c.name || r.name || { ko: rid, en: rid };
      grid.appendChild(h("div", { class: "grid__row", role: "rowheader", style: c.color ? "--plate:" + c.color : null }, [h("span", { class: "grid__swatch", "aria-hidden": "true" }), h("span", { class: "grid__name" }, bi(nm))]));
      GALLERY_COLS.forEach(function (col) {
        grid.appendChild(galleryCell(meta, rid, col, seen, o.current || null));
      });
    });
    var titleT = u("galleryTitle");
    var heading = h("h2", { class: "gallery-title" }, langs().length > 1 ? [titleT.ko, h("span", { class: "en", lang: "en" }, titleT.en)] : [pick(titleT, langs()[0])]);
    page("gallery-page", [
      h("div", { class: "gallery-head" }, [heading, h("p", { class: "gallery-intro" }, bi(u("galleryIntro")))]),
      h("div", { class: "grid-wrap" }, grid),
      h("div", { class: "gallery-actions" }, [btn("btn--primary", u("galleryReplay"), "gallery-replay", o.onReplay), btn("btn--ghost", u("galleryHome"), "gallery-home", o.onHome)])
    ]);
  }

  // ------------------------------------------------------------------ header, settings, confirm

  function renderHeader(o) {
    var bar = $("topbar");
    clear(bar);
    var home = h("button", { type: "button", class: "iconbtn", "data-testid": "home", "aria-label": flat(u("home")), title: flat(u("home")), on: { click: o.onHome } }, svgIcon([{ d: "M4 11.5 12 5l8 6.5" }, { d: "M6.5 10v9h11v-9" }, { d: "M10.5 19v-4.5h3V19" }]));
    var seg = h("div", { class: "seg", role: "group", "aria-label": flat(u("langGroup")) });
    [
      ["ko", "langShortKo", "hdr-lang-ko"],
      ["en", "langShortEn", "hdr-lang-en"],
      ["both", "langShortBoth", "hdr-lang-both"]
    ].forEach(function (d) {
      var t = u(d[1]);
      seg.appendChild(
        h(
          "button",
          {
            type: "button",
            class: "seg__btn",
            "data-testid": d[2],
            "aria-pressed": S.lang === d[0] ? "true" : "false",
            "aria-label": d[0] === "ko" ? u("langKo").ko : d[0] === "en" ? u("langEn").en : u("langBoth").ko + " · " + u("langBoth").en,
            on: {
              click: function () {
                o.onLang(d[0]);
              }
            }
          },
          S.lang === "en" ? t.en : t.ko
        )
      );
    });
    var gear = h(
      "button",
      { type: "button", class: "iconbtn", "data-testid": "settings-open", "aria-label": flat(u("settingsOpen")), title: flat(u("settingsOpen")), "aria-expanded": "false", "aria-controls": "settings", on: { click: o.onSettings } },
      svgIcon([{ d: "M4 7h9" }, { d: "M17 7h3" }, { tag: "circle", cx: "15", cy: "7", r: "2" }, { d: "M4 17h3" }, { d: "M11 17h9" }, { tag: "circle", cx: "9", cy: "17", r: "2" }])
    );
    var kids = [home, h("span", { class: "topbar__spacer" }), seg];
    if (o.canFullscreen) {
      var fs = !!o.isFullscreen;
      var label = flat(u(fs ? "fullscreenExit" : "fullscreenEnter"));
      kids.push(
        h(
          "button",
          { type: "button", class: "iconbtn", "data-testid": "fullscreen", "aria-pressed": fs ? "true" : "false", "aria-label": label, title: label + " (F)", on: { click: o.onFullscreen } },
          svgIcon(
            fs
              ? [{ d: "M9 4v5H4" }, { d: "M15 4v5h5" }, { d: "M9 20v-5H4" }, { d: "M15 20v-5h5" }]
              : [{ d: "M4 9V4h5" }, { d: "M20 9V4h-5" }, { d: "M4 15v5h5" }, { d: "M20 15v5h-5" }]
          )
        )
      );
    }
    kids.push(gear);
    append(bar, kids);
    // After a pointer click, give focus back so Space/Enter keep driving the story.
    Array.prototype.forEach.call(bar.querySelectorAll("button"), function (b) {
      b.addEventListener("click", function (ev) {
        if (ev.detail > 0 && typeof b.blur === "function") b.blur();
      });
    });
  }

  function renderSettings(o) {
    var box = $("settings");
    clear(box);
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", flat(u("settingsTitle")));
    var speeds = [
      ["slow", "speedSlow", "speed-slow"],
      ["normal", "speedNormal", "speed-normal"],
      ["instant", "speedInstant", "speed-instant"]
    ].map(function (d) {
      return h("button", { type: "button", class: "chip", "data-testid": d[2], "aria-pressed": S.speed === d[0] ? "true" : "false", on: { click: function () { o.onSpeed(d[0]); } } }, flat(u(d[1])));
    });
    var smaller = h("button", { type: "button", class: "chip", "data-testid": "size-down", "aria-label": flat(u("sizeSmaller")), disabled: S.size <= 0 ? true : null, on: { click: function () { o.onSize(-1); } } }, "A−");
    var larger = h("button", { type: "button", class: "chip", "data-testid": "size-up", "aria-label": flat(u("sizeLarger")), disabled: S.size >= SIZE_STEPS.length - 1 ? true : null, on: { click: function () { o.onSize(1); } } }, "A+");
    append(box, [
      h("p", { class: "settings__title" }, flat(u("settingsTitle"))),
      h("div", { class: "settings__group" }, [h("span", { class: "settings__label" }, flat(u("textSpeed"))), h("div", { class: "choicerow" }, speeds)]),
      h("div", { class: "settings__group" }, [h("span", { class: "settings__label" }, flat(u("textSize"))), h("div", { class: "choicerow" }, [smaller, larger])]),
      btn("btn--ghost settings__close", u("close"), "settings-close", o.onClose)
    ]);
  }

  function openSettings(o) {
    renderSettings(o);
    $("settings").hidden = false;
    var gear = doc.querySelector('[data-testid="settings-open"]');
    if (gear) gear.setAttribute("aria-expanded", "true");
  }

  function closeSettings() {
    $("settings").hidden = true;
    var gear = doc.querySelector('[data-testid="settings-open"]');
    if (gear) gear.setAttribute("aria-expanded", "false");
  }

  function askDialog(o) {
    var m = $("modal");
    clear(m);
    var titleId = "dlg-title";
    var no = btn("btn--ghost", o.no, "confirm-no", function () {
      closeModal();
      if (o.onNo) o.onNo();
    });
    var yes = btn("btn--primary", o.yes, "confirm-yes", function () {
      closeModal();
      if (o.onYes) o.onYes();
    });
    var dialog = h("div", { class: "dialog", role: "alertdialog", "aria-modal": "true", "aria-labelledby": titleId }, [
      h("h2", { class: "dialog__title", id: titleId }, bi(o.title)),
      o.body ? h("p", { class: "dialog__body" }, bi(o.body)) : null,
      h("div", { class: "dialog__actions" }, [yes, no])
    ]);
    m.appendChild(dialog);
    m.hidden = false;
    m.onclick = function (ev) {
      if (ev.target === m) {
        closeModal();
        if (o.onNo) o.onNo();
      }
    };
    no.focus({ preventScroll: true });
  }

  function closeModal() {
    var m = $("modal");
    m.hidden = true;
    clear(m);
  }

  function isModalOpen() {
    return !$("modal").hidden || !$("settings").hidden;
  }

  // ------------------------------------------------------------------ settings application

  function applySettings(o) {
    if (o.lang) S.lang = o.lang;
    if (o.speed) S.speed = o.speed;
    if (typeof o.size === "number") S.size = Math.max(0, Math.min(SIZE_STEPS.length - 1, o.size));
    doc.documentElement.style.setProperty("--text-scale", String(SIZE_STEPS[S.size]));
    doc.documentElement.setAttribute("lang", S.lang === "en" ? "en" : "ko");
    // Language-dependent caches must be rebuilt.
    S.capKey = "";
    S.pinKey = "";
    S.pinItemsKey = "";
  }

  function init(o) {
    o = o || {};
    S.test = !!o.test;
    S.debug = !!o.debug;
    S.handlers = o.handlers || {};
    try {
      var mq = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
      S.reduced = !!(mq && mq.matches);
      if (mq && mq.addEventListener) {
        mq.addEventListener("change", function (e) {
          S.reduced = e.matches;
        });
      }
    } catch (err) {
      S.reduced = false;
    }
    var adv = $("advance");
    adv.addEventListener("click", function () {
      if (S.handlers.onAdvance) S.handlers.onAdvance();
    });
    var resizeTimer = 0;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        anchorCast();
        placeLight();
      }, 120);
    });
    try {
      if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(anchorCast);
    } catch (err) {
      /* font loading API unavailable */
    }
  }

  BHS.view = {
    init: init,
    h: h,
    clear: clear,
    bi: bi,
    flat: flat,
    applySettings: applySettings,
    sizeSteps: SIZE_STEPS,
    state: S,
    showLayer: showLayer,
    pageStage: pageStage,
    renderPlay: renderPlay,
    renderTitle: renderTitle,
    renderRouteSelect: renderRouteSelect,
    renderGallery: renderGallery,
    renderHeader: renderHeader,
    openSettings: openSettings,
    closeSettings: closeSettings,
    renderSettings: renderSettings,
    ask: askDialog,
    closeModal: closeModal,
    isModalOpen: isModalOpen,
    showReply: showReply,
    shake: shake,
    anchorCast: anchorCast,
    completeTyping: completeTyping,
    isTyping: isTyping
  };
})();
