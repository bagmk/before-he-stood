/*
 * js/ui.js - DOM rendering for "Before He Stood" (BHS.view).
 * Draws the stage (art, light, POV, hush, caption, echo verse, pinned thought), the text box with a
 * typewriter, choices (with the gentle removal of a scolded option), press buttons, optional persistent
 * actions, the true-ending cards (title, memory verse), the snip card of a cut branch, and the page
 * screens (title, route select, story trees), plus the header, settings, and in-page confirm dialog.
 * It never decides story flow; js/main.js drives it with views from BHS.engine.
 */
(function () {
  "use strict";

  var BHS = (window.BHS = window.BHS || {});
  var doc = document;
  var SVG_NS = "http://www.w3.org/2000/svg";

  var SIZE_STEPS = [0.9, 1, 1.12, 1.25, 1.4];
  var RATES = { slow: 56, normal: 28, instant: 0 };
  // Removal of a scolded option: it shows for a moment, fades, then the others glide into place.
  var REMOVE_HOLD = 140;
  var REMOVE_FADE = 260;
  var REMOVE_GLIDE = 300;

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
    choiceTimers: [],
    lastChoice: "",
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

  function svgIcon(paths, cls) {
    var svg = doc.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    if (cls) svg.setAttribute("class", cls);
    paths.forEach(function (p) {
      var el = doc.createElementNS(SVG_NS, p.tag || "path");
      Object.keys(p).forEach(function (k) {
        if (k !== "tag") el.setAttribute(k, p[k]);
      });
      svg.appendChild(el);
    });
    return svg;
  }

  // Scissors: two finger loops and two blades crossing (the snip mark; never the U+2702 glyph,
  // which some systems draw as an emoji).
  function scissorsIcon(cls) {
    return svgIcon(
      [
        { tag: "circle", cx: "6", cy: "6.5", r: "2.8" },
        { tag: "circle", cx: "6", cy: "17.5", r: "2.8" },
        { d: "M8.4 8 20.5 17.6" },
        { d: "M8.4 16 20.5 6.4" }
      ],
      cls
    );
  }

  function starIcon(cls) {
    var svg = svgIcon([{ d: "M12 2.6l2.75 6.1 6.65.7-4.98 4.47 1.4 6.55L12 17.1l-5.82 3.32 1.4-6.55L2.6 9.4l6.65-.7z" }], cls);
    svg.setAttribute("stroke-width", "1.4");
    return svg;
  }

  // A fan of paper leaves behind the star at the top of a finished story tree.
  var CROWN_LEAVES = [
    [-172, "#5f6d33"],
    [-148, "#7c8a42"],
    [-124, "#6a7838"],
    [-102, "#8a9850"],
    [-78, "#6a7838"],
    [-56, "#7c8a42"],
    [-32, "#5f6d33"],
    [-8, "#6a7838"],
    [168, "#56622e"],
    [12, "#56622e"]
  ];

  function crownIcon(cls) {
    var svg = doc.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 120 84");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("class", cls);
    CROWN_LEAVES.forEach(function (lf) {
      var g = doc.createElementNS(SVG_NS, "g");
      g.setAttribute("transform", "translate(60 52) rotate(" + lf[0] + ") translate(9 0)");
      var leaf = doc.createElementNS(SVG_NS, "path");
      leaf.setAttribute("d", "M0 0C7 -8 19 -8 28 0C19 8 7 8 0 0Z");
      leaf.setAttribute("fill", lf[1]);
      var rib = doc.createElementNS(SVG_NS, "path");
      rib.setAttribute("d", "M2 0H24");
      rib.setAttribute("stroke", "rgba(255, 248, 220, 0.35)");
      rib.setAttribute("stroke-width", "1");
      g.appendChild(leaf);
      g.appendChild(rib);
      svg.appendChild(g);
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

  // Verse text as displayed (verse cards, echo boxes, pinned thoughts): verseDisplay adds the leading
  // "…" to English excerpts that start mid-sentence (SPEC 4.3).
  function verseOf(key, l) {
    var eng = E();
    var txt = eng && (eng.verseDisplay ? eng.verseDisplay(key, l) : eng.verseText(key, l));
    if (txt) return txt;
    return S.debug ? "[" + key + "]" : "…";
  }

  // The memory-verse card's text: the display form plus a trailing "…" when the key stops mid-sentence
  // (BHS.engine.memoryDisplay, SPEC 4.6).
  function memoryOf(key, l) {
    var eng = E();
    var txt = eng && eng.memoryDisplay ? eng.memoryDisplay(key, l) : null;
    return txt || verseOf(key, l);
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

  // The typewriter timeline: [{ c, t }] sorted by t (ms from the start). Each group (one language) gets
  // its natural timeline (its rate, longer pauses after punctuation). In "both" mode the languages type
  // in parallel: every group starts at t = 0, and the shorter timelines are stretched (longest / own
  // duration) so that the last characters of all groups appear together.
  function typeTimeline(groups) {
    var lines = groups.map(function (g) {
      var t = 0;
      var times = g.chars.map(function (c) {
        var at = t;
        t += g.rate * pauseAfter(c.textContent);
        return at;
      });
      return { chars: g.chars, times: times, end: times.length ? times[times.length - 1] : 0 };
    });
    var longest = 0;
    lines.forEach(function (ln) {
      if (ln.end > longest) longest = ln.end;
    });
    var seq = [];
    lines.forEach(function (ln) {
      var k = ln.end > 0 ? longest / ln.end : 1;
      ln.chars.forEach(function (c, i) {
        // The last character lands exactly on `longest`, whatever rounding the stretch gives.
        seq.push({ c: c, t: ln.end > 0 && i === ln.chars.length - 1 ? longest : ln.times[i] * k });
      });
    });
    // Array sort is stable (ES2019), so at equal times the first language stays first.
    seq.sort(function (a, b) {
      return a.t - b.t;
    });
    return seq;
  }

  function typeStart(groups, onDone) {
    typeStop();
    var seq = typeTimeline(groups);
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
    var bg = stage.bg,
      time = stage.time;
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
    var play = $("play");
    if (!panel || panel.hidden || play.hidden || play.classList.contains("play--sign") || play.classList.contains("play--last") || play.classList.contains("play--memory")) return;
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
        var txt = opts.memory ? memoryOf(opts.verseKey, l) : verseOf(opts.verseKey, l);
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

  function stopChoiceTimers() {
    S.choiceTimers.forEach(function (t) {
      clearTimeout(t);
    });
    S.choiceTimers = [];
  }

  function resetPlay() {
    stopChoiceTimers();
    var play = $("play");
    play.className = "play";
    var panel = $("panel");
    panel.className = "panel";
    panel.removeAttribute("data-testid");
    panel.style.removeProperty("--memory-fit");
    panel.hidden = false;
    clear($("text"));
    $("ref").hidden = true;
    clear($("ref"));
    setPlate(null);
    var choices = $("choices");
    clear(choices);
    choices.hidden = true;
    choices.className = "choices";
    var pressbox = $("pressbox");
    clear(pressbox);
    pressbox.hidden = true;
    var card = $("card");
    clear(card);
    card.hidden = true;
    card.className = "card";
    card.removeAttribute("data-testid");
    var snip = $("snip");
    if (snip) {
      clear(snip);
      snip.hidden = true;
    }
    doc.body.classList.remove("is-last");
  }

  // The memory-verse card sits centered in the dock. A long verse (the friend's whole Matt 9:2) at a large
  // text size could grow past it, so the card's type is scaled down, never up, until it fits.
  var MEMORY_FIT_MIN = 0.5;

  function fitMemory() {
    var panel = $("panel");
    var dock = $("dock");
    if (!panel || !dock || panel.hidden || !panel.classList.contains("panel--memory")) return;
    panel.style.removeProperty("--memory-fit");
    var cs = window.getComputedStyle(dock);
    var room = dock.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0);
    // The speaker plate (Jesus' words) sticks out above the card.
    var plate = $("plate");
    if (plate && !plate.hidden) room -= plate.offsetHeight * 0.6;
    if (!(room > 0)) return;
    var fit = 1;
    for (var i = 0; i < 6 && panel.offsetHeight > room && fit > MEMORY_FIT_MIN; i++) {
      fit = Math.max(MEMORY_FIT_MIN, fit * Math.min(0.97, (room / panel.offsetHeight) * 0.99));
      panel.style.setProperty("--memory-fit", fit.toFixed(3));
    }
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
    // Portraits step back while a choice, a card or the snip card is open; the engine keeps them.
    var castLayer = $("cast");
    if (castLayer) castLayer.classList.toggle("is-away", step.kind === "choice" || step.kind === "snip" || step.kind === "memory");
    var panel = $("panel");
    var text = $("text");
    var hush = !!(v.now && v.now.hush);
    var groups = [];
    // A choice that comes back after another screen is a new presentation (see renderChoice).
    if (step.kind !== "choice") S.lastChoice = "";

    switch (step.kind) {
      case "line": {
        var sp = step.speaker || "narrator";
        if (sp === "sign") $("play").classList.add("play--sign");
        else if (sp === "thought") panel.classList.add("panel--thought");
        else if (sp !== "narrator") setPlate(sp, ctx.routeId);
        groups = fillText(text, step.text, state, { instant: ctx.instant, hush: hush });
        break;
      }
      case "verse":
      case "memory": {
        panel.classList.add("panel--verse");
        panel.setAttribute("data-testid", step.kind === "memory" ? "memory-verse" : "verse-card");
        var vs = step.speaker || "narrator";
        if (vs === "jesus") panel.classList.add("panel--jesus");
        if (vs === "jesus" || vs === "scribes") setPlate(vs, ctx.routeId);
        if (step.kind === "memory") {
          // The memory verse of the true ending: large, centered, in the light.
          $("play").classList.add("play--memory");
          panel.classList.add("panel--memory");
          setLight("bright");
        }
        groups = fillText(text, null, state, { instant: ctx.instant, hush: hush, verseKey: step.key, memory: step.kind === "memory" });
        var ref = $("ref");
        ref.textContent = refLine(step.key);
        ref.hidden = !ref.textContent;
        if (step.kind === "memory") fitMemory();
        break;
      }
      case "choice":
        panel.hidden = true;
        renderChoice(step, state, ctx.marks || {}, !!ctx.instant);
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
      case "snip":
        panel.hidden = true;
        $("play").classList.add("play--snip");
        renderSnip(step);
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

  // An option button. `leaving` marks the scolded option on its way out (no click, no test id).
  function optionButton(o, idx, state, marks, leaving) {
    var props = { type: "button", class: "opt" + (leaving ? " opt--leaving" : "") };
    if (leaving) {
      props.disabled = true;
      props["aria-hidden"] = "true";
      props.tabindex = "-1";
      props["data-leaving"] = o.id;
    } else {
      props["data-testid"] = "choice-" + o.id;
      props["data-option"] = o.id;
      props["aria-keyshortcuts"] = String(idx + 1);
      if (marks[o.id]) props["data-snipped"] = "true";
    }
    var kids = [h("span", { class: "opt__body" }, biRich(o.text, state))];
    // The small scissors: this option's cut branch was already seen on this device (no text).
    if (!leaving && marks[o.id]) kids.push(scissorsIcon("opt__snip"));
    var b = h("button", props, kids);
    if (!leaving) {
      b.addEventListener("click", function (ev) {
        ev.stopPropagation();
        if (S.handlers.onChoose) S.handlers.onChoose(o.id);
      });
    }
    return b;
  }

  function rectsOf(nodes) {
    return nodes.map(function (n) {
      return n.getBoundingClientRect();
    });
  }

  // The scolded option leaves gently: it shows for a moment, fades, and the others glide to their new
  // places while the list height follows (FLIP), so nothing jumps.
  function animateRemoval(list, leavingBtn, count) {
    S.choiceTimers.push(
      setTimeout(function () {
        if (!leavingBtn.isConnected) return;
        leavingBtn.classList.add("is-going");
        S.choiceTimers.push(
          setTimeout(function () {
            if (!leavingBtn.isConnected) return;
            var stay = Array.prototype.slice.call(list.querySelectorAll(".opt:not(.opt--leaving)"));
            var first = rectsOf(stay);
            var h0 = list.getBoundingClientRect().height;
            list.removeChild(leavingBtn);
            list.setAttribute("data-n", String(count));
            list.style.height = "auto";
            var h1 = list.getBoundingClientRect().height;
            list.style.height = h0 + "px";
            var now = rectsOf(stay);
            stay.forEach(function (b, i) {
              var dx = first[i].left - now[i].left;
              var dy = first[i].top - now[i].top;
              b.style.transition = "none";
              b.style.transform = dx || dy ? "translate(" + dx + "px," + dy + "px)" : "";
            });
            void list.offsetWidth;
            var ease = "cubic-bezier(0.2, 0.7, 0.1, 1)";
            list.style.transition = "height " + REMOVE_GLIDE + "ms " + ease;
            list.style.height = h1 + "px";
            stay.forEach(function (b) {
              b.style.transition = "transform " + REMOVE_GLIDE + "ms " + ease;
              b.style.transform = "";
            });
            S.choiceTimers.push(
              setTimeout(function () {
                list.style.removeProperty("height");
                list.style.removeProperty("transition");
                stay.forEach(function (b) {
                  b.style.removeProperty("transition");
                  b.style.removeProperty("transform");
                });
              }, REMOVE_GLIDE + 40)
            );
          }, REMOVE_FADE)
        );
      }, REMOVE_HOLD)
    );
  }

  // Choice panel (SPEC 5.6): 2-4 options, no number badges (keys 1-4 still pick by position, the focus
  // ring shows the current option). After a scold the same choice comes back without that option.
  function renderChoice(step, state, marks, instant) {
    var box = $("choices");
    clear(box);
    var again = !!step.again;
    box.classList.toggle("is-again", again);
    var pid = "prompt-" + step.id;
    if (step.prompt) box.appendChild(h("p", { class: "choices__prompt", id: pid }, biRich(step.prompt, state)));
    // The scolded option leaves once, when the re-ask first appears. Re-rendering the same screen
    // (a language switch, A+/A-, Continue after a reload) shows the options as they are now.
    var choiceKey = step.id + "|" + (step.removed || []).join(",");
    var animate = !!(step.justRemoved && !S.test && !S.reduced && !instant && choiceKey !== S.lastChoice);
    S.lastChoice = choiceKey;
    var count = step.options.length;
    var list = h("div", {
      class: "choices__list" + (again ? " is-again" : ""),
      role: "group",
      "aria-labelledby": step.prompt ? pid : null,
      "aria-label": step.prompt ? null : flat(u("choiceGroup")),
      "data-n": String(animate ? count + 1 : count),
      "data-removed": step.removed && step.removed.length ? step.removed.join(",") : null
    });
    var leavingBtn = null;
    var buttons = step.options.map(function (o, idx) {
      return optionButton(o, idx, state, marks, false);
    });
    if (animate) {
      leavingBtn = optionButton(step.justRemoved, -1, state, marks, true);
      var at = Math.max(0, Math.min(buttons.length, step.justRemoved.at));
      buttons.splice(at, 0, leavingBtn);
    }
    buttons.forEach(function (b) {
      list.appendChild(b);
    });
    box.appendChild(list);
    box.hidden = false;
    box.scrollTop = 0;
    clear($("reply"));
    // Long options (verse texts) would overflow a 2x2 grid; full-width rows wrap far less.
    box.classList.remove("is-stacked");
    if (box.scrollHeight > box.clientHeight + 2) box.classList.add("is-stacked");
    if (leavingBtn) animateRemoval(list, leavingBtn, count);
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

  // Persistent actions (optional route-level `actions`); a route without them shows no buttons.
  function renderActions(actions, step) {
    var bar = $("actions");
    clear(bar);
    var off = { endingTitle: true, last: true, choice: true, memory: true, snip: true };
    if (!actions.length || (step && off[step.kind])) {
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

  function titleNode(cls, t) {
    var ls = langs();
    var title = h("h2", { class: cls });
    if (ls.length === 1) title.appendChild(doc.createTextNode(pick(t, ls[0])));
    else {
      title.appendChild(doc.createTextNode(pick(t, "ko")));
      if (pick(t, "en") !== pick(t, "ko")) title.appendChild(h("span", { class: "en", lang: "en" }, pick(t, "en")));
    }
    return title;
  }

  // The true ending's title card: only the title (no number, no label).
  function renderCard(step) {
    var card = $("card");
    clear(card);
    card.className = "card card--good";
    card.appendChild(titleNode("card__title", step.title));
    card.appendChild(h("p", { class: "card__hint" }, flat(u("endingCardHint"))));
    card.setAttribute("data-testid", "ending-title");
    card.setAttribute("aria-live", "polite");
    card.hidden = false;
  }

  // The snip card of a cut branch: the stamp, the branch title, one line, Try again (default) and
  // Title screen. No number and no "ending" anywhere.
  function renderSnip(step) {
    var box = $("snip");
    clear(box);
    var retry = btn("btn--primary", u("snipRetry"), "snip-retry", function (ev) {
      ev.stopPropagation();
      if (S.handlers.onRetry) S.handlers.onRetry();
    });
    var home = btn("btn--ghost", u("snipHome"), "snip-home", function (ev) {
      ev.stopPropagation();
      if (S.handlers.onSnipHome) S.handlers.onSnipHome();
    });
    retry.setAttribute("data-pagebtn", "");
    retry.setAttribute("data-default", "true");
    home.setAttribute("data-pagebtn", "");
    var card = h("div", { class: "snip__card", role: "dialog", "aria-modal": "false", "aria-labelledby": "snip-title", "data-testid": "snip-card", "data-branch": step.badId || null }, [
      h("div", { class: "snip__cut", "aria-hidden": "true" }, scissorsIcon("snip__scissors")),
      h("p", { class: "snip__stamp", "data-testid": "snip-stamp" }, bi(u("snipStamp"))),
      (function () {
        var t = titleNode("snip__title", step.title);
        t.id = "snip-title";
        t.setAttribute("data-testid", "snip-title");
        return t;
      })(),
      h("p", { class: "snip__text" }, bi(u("snipLine"))),
      h("div", { class: "snip__actions" }, [retry, home])
    ]);
    box.appendChild(card);
    box.hidden = false;
    focusDefault(retry);
  }

  function focusDefault(el) {
    if (!el) return;
    try {
      el.focus({ preventScroll: true });
    } catch (err) {
      el.focus();
    }
  }

  // ------------------------------------------------------------------ page screens

  function showLayer(screen) {
    var playing = screen === "prologue" || screen === "play" || screen === "endingCard" || screen === "ending" || screen === "snip";
    $("play").hidden = !playing;
    if (playing) clear($("screen"));
    $("topbar").hidden = screen === "title";
    if (!playing) {
      typeStop();
      stopChoiceTimers();
      clear($("reply"));
      S.lastChoice = "";
      // The darker veil of the last line belongs to the story only (not the tree or the title).
      doc.body.classList.remove("is-last");
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
        mode === "both" ? [t.ko, h("span", { class: "en", lang: "en" }, t.en)] : [t.ko]
      );
    };

    // A clicker's next key presses the default button: Continue when there is a save (so it never
    // starts over by accident), otherwise Start. With a save, Continue also takes the focus, so its ring
    // shows what the next key will do (main.js, buttonScreenKey).
    var startBtn = btn("btn--primary", u("start"), "start", o.onStart);
    var contBtn = o.hasSave ? btn("btn--ghost", u("continueGame"), "continue", o.onContinue, o.saveLabel || null) : null;
    var actions = [startBtn];
    if (contBtn) actions.push(contBtn);
    actions.push(btn("btn--text", u("treesOpen"), "trees-open", o.onTrees));
    actions.forEach(function (b) {
      b.setAttribute("data-pagebtn", "");
    });
    (contBtn || startBtn).setAttribute("data-default", "true");

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
    if (contBtn) focusDefault(contBtn);
  }

  // "#rrggbb" -> "rgba(r, g, b, a)" for the soft wash behind a route card's figure.
  function hexAlpha(hex, a) {
    var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || ""));
    if (!m) return null;
    var x = m[1].length === 3 ? m[1].replace(/./g, "$&$&") : m[1];
    var n = parseInt(x, 16);
    return "rgba(" + ((n >> 16) & 255) + ", " + ((n >> 8) & 255) + ", " + (n & 255) + ", " + a + ")";
  }

  // The protagonist on a route card: a cut-paper bust rising from the divider above the first line
  // (Menahem, Yonah), or Asher in his lying pose laid across the band; never Asher standing (that is
  // the ending). Decorative only (aria-hidden); without a portrait module the card stays text-only.
  function routeArt(rid, charId, color) {
    var lying = charId === "asher";
    var markup = charId ? portraitMarkup(charId, lying ? "lying" : null, "") : null;
    if (!markup) return null;
    var svgBox = h("span", { class: "routecard__svg" });
    svgBox.innerHTML = namespaceSvg(markup, "r" + ++S.artSeq + "-");
    var svg = svgBox.querySelector("svg");
    if (!svg) return null;
    svg.setAttribute("preserveAspectRatio", "xMidYMax meet");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    var wash = hexAlpha(color, 0.3);
    return h("span", { class: "routecard__art" + (lying ? " routecard__art--lying" : ""), "data-testid": "routecard-portrait-" + rid, "aria-hidden": "true", style: wash ? "--wash:" + wash : null }, [
      h("span", { class: "routecard__wash" }),
      h("span", { class: "routecard__fig" }, svgBox)
    ]);
  }

  // The busts on the route cards share one size, set by the smallest bust band (a bigger bust in a
  // smaller band would lose its head), so the cards read as a set; Asher lying sizes on his own band.
  // Band heights follow the text (language, text size, fonts loading, window size), hence the observer.
  var routeArtObserver = null;

  function equalizeRouteArt(list) {
    var min = Infinity;
    Array.prototype.forEach.call(list.querySelectorAll(".routecard__art:not(.routecard__art--lying)"), function (band) {
      var bh = band.clientHeight;
      if (bh > 0 && bh < min) min = bh;
    });
    if (min < Infinity) list.style.setProperty("--band-min", min + "px");
    else list.style.removeProperty("--band-min");
  }

  function watchRouteArt(list) {
    if (routeArtObserver) routeArtObserver.disconnect();
    routeArtObserver = null;
    equalizeRouteArt(list);
    if (typeof window.ResizeObserver !== "function") return;
    routeArtObserver = new window.ResizeObserver(function () {
      if (list.isConnected) equalizeRouteArt(list);
      else if (routeArtObserver) routeArtObserver.disconnect();
    });
    Array.prototype.forEach.call(list.querySelectorAll(".routecard__art"), function (band) {
      routeArtObserver.observe(band);
    });
  }

  // The played stamp: in "both" mode the two languages share one check mark; otherwise one language.
  function playedText() {
    var t = u("routePlayed");
    if (S.lang === "ko") return t.ko;
    if (S.lang === "en") return t.en;
    return t.ko + " · " + t.en.replace(/^\s*✓\s*/, "");
  }

  // Played = the route's true ending was seen on this device.
  function routePlayed(seen, rid) {
    return seen.indexOf(rid + "-good") >= 0;
  }

  function seenList(seen) {
    return (seen || []).filter(function (x) {
      return typeof x === "string";
    });
  }

  // Route select. o.seen (ids seen on this device) marks the routes already played; once any route
  // has been played, the keyboard focus starts on the first unplayed route in meta.routeOrder, so the
  // class can go on with Enter (SPEC 5.8).
  function renderRouteSelect(o) {
    var meta = BHS.meta || {};
    var order = meta.routeOrder || ["scribe", "friend", "asher"];
    var rs = (BHS.common && BHS.common.routeSelect) || {};
    var prompt = rs.prompt || { ko: "", en: "" };
    var seen = seenList(o.seen);
    var cards = order.map(function (id, idx) {
      var r = (meta.routes && meta.routes[id]) || {};
      var c = (BHS.characters && BHS.characters[r.protagonist]) || {};
      var ready = !!(BHS.routes && BHS.routes[id]);
      var played = routePlayed(seen, id);
      var art = routeArt(id, r.protagonist, c.color);
      // The badge sits in the free top-left corner of the portrait band (never on the figure or the
      // text); the band is aria-hidden, so a hidden copy carries the status for screen readers.
      // Without a portrait band it follows the tagline in the text flow.
      var badge = played ? h("span", { class: "routecard__played" + (art ? "" : " routecard__played--flow"), "data-testid": "routecard-played-" + id }, playedText()) : null;
      if (badge && art) art.appendChild(badge);
      var plateKids = langs().length === 1 ? [pick(r.name, langs()[0])] : [pick(r.name, "ko"), h("span", { class: "plate__en plate__en--stack", lang: "en" }, pick(r.name, "en"))];
      var plate = h("span", { class: "plate", style: c.color ? "--plate:" + c.color : null }, plateKids);
      return h(
        "button",
        {
          type: "button",
          class: "routecard" + (ready ? "" : " routecard--missing"),
          "data-testid": "route-" + id,
          "data-route": id,
          "data-played": played ? "true" : null,
          "aria-keyshortcuts": idx < 9 ? String(idx + 1) : null,
          on: {
            click: function () {
              if (o.onPick) o.onPick(id);
            }
          }
        },
        [
          plate,
          h("span", { class: "routecard__title" }, bi(r.title || { ko: id, en: id })),
          r.tagline ? h("span", { class: "routecard__tag" }, bi(r.tagline)) : null,
          badge && !art ? badge : null,
          art,
          played && art ? h("span", { class: "vh" }, " " + flat(u("routePlayed"))) : null,
          r.firstLine ? h("span", { class: "routecard__first" }, bi(r.firstLine)) : null
        ]
      );
    });
    var list = h("div", { class: "routes-list" }, cards);
    var head = h("div", { class: "routes-head" }, [h("h2", { class: "routes-prompt" }, bi(prompt)), rs.hint ? h("p", { class: "routes-hint", "data-testid": "routes-hint" }, bi(rs.hint)) : null]);
    page("routes-page", [head, o.notice ? h("p", { class: "notice", role: "status" }, bi(o.notice)) : null, list]);
    watchRouteArt(list);
    var anyPlayed = order.some(function (id) {
      return routePlayed(seen, id);
    });
    if (anyPlayed) {
      for (var i = 0; i < order.length; i++) {
        if (routePlayed(seen, order[i])) continue;
        var next = list.querySelector('[data-route="' + order[i] + '"]');
        if (next) {
          // Focus set by script on arrival shows no :focus-visible ring; data-next keeps it visible.
          next.setAttribute("data-next", "true");
          // The page stays at its top (prompt and hint first); on a TV all cards are on screen anyway.
          focusDefault(next);
        }
        break;
      }
    }
  }

  // ---- story trees (SPEC 5.8)

  function plateNode(rid, extraCls) {
    var meta = BHS.meta || {};
    var r = (meta.routes && meta.routes[rid]) || {};
    var c = (BHS.characters && BHS.characters[r.protagonist]) || {};
    var name = r.name || { ko: rid, en: rid };
    var kids = langs().length === 1 ? [pick(name, langs()[0])] : [pick(name, "ko"), h("span", { class: "plate__en plate__en--stack", lang: "en" }, pick(name, "en"))];
    return h("span", { class: "plate" + (extraCls ? " " + extraCls : ""), style: c.color ? "--plate:" + c.color : null }, kids);
  }

  // A cut branch: a short bough with the scissors and the branch title when seen; a faint, unlabeled
  // stub when not.
  function branchNode(rid, b, seen, side) {
    var isSeen = seen.indexOf(b.id) >= 0;
    var kids = [h("span", { class: "branch__wood", "aria-hidden": "true" }, h("span", { class: "branch__stem" }))];
    if (isSeen) {
      kids.push(scissorsIcon("branch__snip"));
      kids.push(h("span", { class: "branch__tag" }, b.title ? bi(b.title) : null));
    } else {
      kids.push(h("span", { class: "vh" }, flat(u("treeBranchUnseen"))));
    }
    return h("div", { class: "branch branch--" + side, "data-state": isSeen ? "seen" : "unseen", "data-testid": "tree-branch-" + rid + "-" + b.badId }, kids);
  }

  // One route's story tree, bottom to top: the root with the character's name, a knot at every choice
  // point (cut branches grow sideways there, alternating sides), the star of the true ending at the top.
  // Before the true ending was seen the trunk and the star stay faint.
  function treeNode(rid, seen, opts) {
    opts = opts || {};
    var eng = E();
    var tree = eng && typeof eng.treeOf === "function" ? eng.treeOf(rid) : null;
    var meta = BHS.meta || {};
    var r = (meta.routes && meta.routes[rid]) || {};
    var done = !!tree && seen.indexOf(tree.good.id) >= 0;
    var sec = h("section", {
      class: "tree" + (opts.compact ? " tree--compact" : ""),
      "data-route": rid,
      "data-done": done ? "true" : "false",
      "data-current": opts.current ? "true" : null,
      "data-testid": "tree-" + rid,
      "aria-label": flat(r.name || { ko: rid, en: rid }) + " · " + flat(u("treeTitle"))
    });
    var goal = h("div", { class: "tree__goal", "data-testid": "tree-goal-" + rid, "data-state": done ? "seen" : "unseen" }, [
      done && tree.good.title ? h("p", { class: "tree__goaltitle" }, bi(tree.good.title)) : h("span", { class: "vh" }, flat(u("treeGoalUnseen"))),
      h("span", { class: "tree__star" }, [crownIcon("tree__crown"), starIcon("tree__staricon")]),
      h("span", { class: "tree__tip", "aria-hidden": "true" }, h("span", { class: "tree__bark" }))
    ]);
    var levels = h("ol", { class: "tree__levels" });
    var n = tree ? tree.levels.length : 0;
    var turn = 0;
    (tree ? tree.levels : []).forEach(function (lv, k) {
      // Trunk width tapers from the root (k = 0) to the star; each level's segment is a trapezoid.
      var tb = n ? k / n : 0;
      var tt = n ? (k + 1) / n : 1;
      var row = h("li", { class: "tree__level", "data-choice": lv.id, style: "--tb:" + tb.toFixed(3) + ";--tt:" + tt.toFixed(3) });
      var L = h("div", { class: "tree__side tree__side--l" });
      var R = h("div", { class: "tree__side tree__side--r" });
      lv.branches.forEach(function (b) {
        var right = turn % 2 === 0;
        turn++;
        (right ? R : L).appendChild(branchNode(rid, b, seen, right ? "r" : "l"));
      });
      row.appendChild(L);
      row.appendChild(h("div", { class: "tree__trunk", "aria-hidden": "true" }, [h("span", { class: "tree__bark" }), h("span", { class: "tree__knot" })]));
      row.appendChild(R);
      levels.appendChild(row);
    });
    var rootRow = h("div", { class: "tree__root" }, [h("span", { class: "tree__base", "aria-hidden": "true" }, h("span", { class: "tree__bark" })), h("span", { class: "tree__ground", "aria-hidden": "true" }), plateNode(rid, "tree__plate")]);
    append(sec, [goal, levels, rootRow]);
    return sec;
  }

  function pageButton(cls, t, testid, onClick, isDefault) {
    var b = btn(cls, t, testid, onClick);
    b.setAttribute("data-pagebtn", "");
    if (isDefault) b.setAttribute("data-default", "true");
    return b;
  }

  function headTitle(t) {
    return h("h2", { class: "treepage-title" }, langs().length > 1 ? [t.ko, h("span", { class: "en", lang: "en" }, t.en)] : [pick(t, langs()[0])]);
  }

  // After a true ending: that route's tree, "Next character" (default focus) and "Title screen".
  function renderTree(o) {
    var rid = o.route;
    var meta = BHS.meta || {};
    var r = (meta.routes && meta.routes[rid]) || {};
    var seen = seenList(o.seen);
    var next = pageButton("btn--primary", u("treeNext"), "tree-next", o.onNext, true);
    var home = pageButton("btn--ghost", u("treeHome"), "tree-home", o.onHome, false);
    page("treepage", [
      h("div", { class: "treepage-head" }, [
        headTitle(u("treeTitle")),
        r.title ? h("p", { class: "treepage-route" }, bi(r.title)) : null,
        h("p", { class: "treepage-hint" }, bi(u("treeHint")))
      ]),
      h("div", { class: "treepage-tree" }, treeNode(rid, seen, { current: true })),
      h("div", { class: "treepage-actions" }, [next, home])
    ]);
    focusDefault(next);
  }

  // From the title screen: the three trees side by side (stacked on a phone).
  function renderTrees(o) {
    var meta = BHS.meta || {};
    var order = meta.routeOrder || ["scribe", "friend", "asher"];
    var seen = seenList(o.seen);
    var home = pageButton("btn--ghost", u("treeHome"), "trees-home", o.onHome, true);
    page("treespage", [
      h("div", { class: "treespage-head" }, [headTitle(u("treesTitle")), h("p", { class: "treepage-hint" }, bi(u("treeHint")))]),
      h(
        "div",
        { class: "treespage-list" },
        order.map(function (rid) {
          return treeNode(rid, seen, { compact: true });
        })
      ),
      h("div", { class: "treespage-actions" }, [home])
    ]);
    focusDefault(home);
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
          svgIcon(fs ? [{ d: "M9 4v5H4" }, { d: "M15 4v5h5" }, { d: "M9 20v-5H4" }, { d: "M15 20v-5h5" }] : [{ d: "M4 9V4h5" }, { d: "M20 9V4h-5" }, { d: "M4 15v5h5" }, { d: "M20 15v5h-5" }])
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
    // The dialog is modal: Tab and Shift+Tab stay on its two buttons.
    m.onkeydown = function (ev) {
      if (ev.key !== "Tab") return;
      var items = [yes, no];
      var at = items.indexOf(doc.activeElement);
      ev.preventDefault();
      var next = at < 0 ? 0 : (at + (ev.shiftKey ? -1 : 1) + items.length) % items.length;
      focusDefault(items[next]);
    };
    no.focus({ preventScroll: true });
  }

  function closeModal() {
    var m = $("modal");
    m.hidden = true;
    m.onkeydown = null;
    clear(m);
  }

  function isModalOpen() {
    return !$("modal").hidden || !$("settings").hidden;
  }

  // ------------------------------------------------------------------ settings application

  function applySettings(o) {
    if (o.lang) S.lang = o.lang;
    if (o.speed) S.speed = o.speed;
    if (typeof o.size === "number" && isFinite(o.size)) S.size = Math.max(0, Math.min(SIZE_STEPS.length - 1, Math.round(o.size)));
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
    adv.addEventListener("click", function (ev) {
      // A pointer click must not leave the full-screen stage button focused (Chrome and Edge focus a
      // clicked button): Enter/Space at a choice would then press it instead of showing the options.
      if (ev.detail > 0 && typeof adv.blur === "function") adv.blur();
      if (S.handlers.onAdvance) S.handlers.onAdvance();
    });
    var resizeTimer = 0;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        anchorCast();
        placeLight();
        fitMemory();
      }, 120);
    });
    try {
      if (doc.fonts && doc.fonts.ready) {
        doc.fonts.ready.then(function () {
          anchorCast();
          fitMemory();
        });
      }
      // Web fonts that arrive later change the memory card's size too.
      if (doc.fonts && doc.fonts.addEventListener) doc.fonts.addEventListener("loadingdone", fitMemory);
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
    renderTree: renderTree,
    renderTrees: renderTrees,
    treeNode: treeNode,
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
    isTyping: isTyping,
    typeTimeline: typeTimeline
  };
})();
