/*
  Teacher guide renderer for teacher.html.
  Reads the classic-script data files (window.BHS) and fills the data-driven parts:
  header titles, the 3x3 endings board, the ending last lines, discussion slots,
  Matthew 9:1-8 side by side, and the source notices.
  Every data access is defensive: a missing file or key shows a short placeholder.
*/
(function () {
  "use strict";

  var BHS = window.BHS || {};
  var LENS_IDS = ["1", "2", "3"];
  var ROUTE_FALLBACK = ["scribe", "friend", "asher"];
  var CIRCLED = { "1": "①", "2": "②", "3": "③" };
  var ROUTE_FILE = {
    scribe: "data/routes/scribe.js",
    friend: "data/routes/friend.js",
    asher: "data/routes/asher.js"
  };

  // Speaker fallback for the passage, used only when scripture.js omits `speaker`.
  var SPEAKER_FALLBACK = {
    MT_9_2B: "jesus",
    MT_9_2B2: "jesus",
    MT_9_4Q: "jesus",
    MT_9_5: "jesus",
    MT_9_6A: "jesus",
    MT_9_6B: "jesus"
  };

  // Matthew 9:1-8 assembled from the fixed keys (docs/SPEC.md section 4.3).
  // open/close add the ESV quotation marks that sit between partial-verse keys.
  // `inner` marks Jesus' words inside a whole-verse narrator key.
  var PASSAGE = [
    { n: 1, parts: [{ key: "MT_9_1" }] },
    { n: 2, parts: [{ key: "MT_9_2A" }, { key: "MT_9_2B", open: true, close: true }] },
    { n: 3, parts: [{ key: "MT_9_3" }] },
    { n: 4, parts: [{ key: "MT_9_4", inner: "MT_9_4Q" }] },
    { n: 5, parts: [{ key: "MT_9_5" }] },
    { n: 6, parts: [{ key: "MT_9_6A", close: true }, { key: "MT_9_6N" }, { key: "MT_9_6B", open: true, close: true }] },
    { n: 7, parts: [{ key: "MT_9_7" }] },
    { n: 8, parts: [{ key: "MT_9_8" }] }
  ];

  var missingNotes = [];

  /* ---------- Small DOM helpers ---------- */

  function byId(id) {
    return document.getElementById(id);
  }

  function append(node, kids) {
    if (kids == null || kids === false) return node;
    if (!Array.isArray(kids)) kids = [kids];
    for (var i = 0; i < kids.length; i++) {
      var c = kids[i];
      if (c == null || c === false) continue;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return node;
  }

  function el(tag, attrs, kids) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        var v = attrs[k];
        if (v == null || v === false) continue;
        if (k === "class") node.className = v;
        else node.setAttribute(k, v === true ? "" : String(v));
      }
    }
    return append(node, kids);
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  function placeholder(text, file) {
    var kids = [text];
    if (file) kids.push(" ", el("code", null, file));
    return el("p", { class: "placeholder" }, kids);
  }

  function noteMissing(what) {
    if (missingNotes.indexOf(what) === -1) missingNotes.push(what);
  }

  /* ---------- Data access ---------- */

  function isT(t) {
    return !!t && typeof t.ko === "string" && typeof t.en === "string" && (t.ko !== "" || t.en !== "");
  }

  function meta() {
    return BHS.meta && typeof BHS.meta === "object" ? BHS.meta : null;
  }

  function routeOrder() {
    var m = meta();
    if (m && Array.isArray(m.routeOrder) && m.routeOrder.length) return m.routeOrder;
    return ROUTE_FALLBACK;
  }

  function lensInfo(id) {
    var m = meta();
    var l = m && m.lenses ? m.lenses[id] : null;
    return l && isT(l.label) ? l : null;
  }

  function routeInfo(id) {
    var m = meta();
    var r = m && m.routes ? m.routes[id] : null;
    return r && isT(r.name) ? r : null;
  }

  function endingTitle(routeId, lensId) {
    var m = meta();
    var byRoute = m && m.endings ? m.endings[routeId] : null;
    var t = byRoute ? byRoute[lensId] : null;
    return isT(t) ? t : null;
  }

  function endingLast(routeId, lensId) {
    var routes = BHS.routes;
    var r = routes && routes[routeId];
    var e = r && r.endings ? r.endings[lensId] : null;
    return e && isT(e.last) ? e.last : null;
  }

  function verse(key) {
    var s = BHS.scripture;
    var v = s && s[key];
    if (!v || v.refOnly) return null;
    if (typeof v.ko !== "string" || typeof v.en !== "string") return null;
    if (!v.ko && !v.en) return null;
    return v;
  }

  function speakerOf(key) {
    var v = BHS.scripture && BHS.scripture[key];
    if (v && v.speaker) return v.speaker;
    return SPEAKER_FALLBACK[key] || "narrator";
  }

  function refText(key, lang) {
    var v = BHS.scripture && BHS.scripture[key];
    if (v && v.ref && typeof v.ref[lang] === "string" && v.ref[lang]) return v.ref[lang];
    return null;
  }

  /* ---------- Rich text: *emphasis*, {{v:KEY}}, {{r:KEY}}, {{var:NAME}}, ___ blanks ---------- */

  var TOKEN_RE = /\{\{(v|r|var):([A-Za-z0-9_]+)\}\}/g;

  function blankNode(lang) {
    return el("span", { class: "blank" }, el("span", { class: "sr" }, lang === "en" ? "blank" : "빈칸"));
  }

  function appendEmphasis(target, text) {
    var parts = String(text).split(/\*([^*]+)\*/);
    for (var j = 0; j < parts.length; j++) {
      if (!parts[j]) continue;
      if (j % 2 === 1) target.appendChild(el("em", null, parts[j]));
      else target.appendChild(document.createTextNode(parts[j]));
    }
  }

  function appendPlain(target, text, lang) {
    // Blanks first ("___"), then *emphasis* inside each piece.
    // A blank stays on one line with the word or punctuation glued right after it.
    var pieces = String(text).split(/_{3,}/);
    for (var i = 0; i < pieces.length; i++) {
      var piece = pieces[i];
      if (i > 0) {
        var glue = /^\S*/.exec(piece)[0];
        var nb = el("span", { class: "nb" }, blankNode(lang));
        if (glue) appendEmphasis(nb, glue);
        target.appendChild(nb);
        piece = piece.slice(glue.length);
      }
      appendEmphasis(target, piece);
    }
  }

  function tokenNode(kind, name, lang) {
    if (kind === "v") {
      var v = verse(name);
      if (v && v[lang]) return el("span", { class: "token-verse" }, "“" + v[lang] + "”");
      noteMissing("scripture:" + name);
      return el("span", { class: "missing", title: name }, "[" + name + "]");
    }
    if (kind === "r") {
      var r = refText(name, lang);
      if (r) return document.createTextNode(r);
      noteMissing("scripture:" + name);
      return el("span", { class: "missing", title: name }, "[" + name + "]");
    }
    // Runtime counters are only known in the game; show a neutral marker.
    return el("span", { class: "missing", title: name }, "N");
  }

  function rich(text, lang) {
    var frag = document.createDocumentFragment();
    var s = String(text == null ? "" : text);
    var last = 0;
    var m;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(s)) !== null) {
      if (m.index > last) appendPlain(frag, s.slice(last, m.index), lang);
      frag.appendChild(tokenNode(m[1], m[2], lang));
      last = TOKEN_RE.lastIndex;
    }
    if (last < s.length) appendPlain(frag, s.slice(last), lang);
    return frag;
  }

  /* ---------- Passage assembly ---------- */

  var OPEN_Q = /^[“"]/;
  var CLOSE_Q = /[”"]$/;

  function partText(part, lang) {
    var v = verse(part.key);
    if (!v || !v[lang]) return null;
    var t = v[lang];
    if (lang === "en") {
      if (part.open && !OPEN_Q.test(t)) t = "“" + t;
      if (part.close && !CLOSE_Q.test(t)) t = t + "”";
    }
    return t;
  }

  // Full published verse text, when scripture.js provides `full` on a partial-verse key.
  function fullText(plan, lang) {
    var s = BHS.scripture;
    for (var i = 0; i < plan.parts.length; i++) {
      var v = s && s[plan.parts[i].key];
      if (v && v.full && typeof v.full[lang] === "string" && v.full[lang]) return v.full[lang];
    }
    return null;
  }

  // Jesus' words inside a verse, in reading order.
  function jesusSegments(plan, lang) {
    var out = [];
    plan.parts.forEach(function (part) {
      var v = verse(part.key);
      if (v && v[lang] && speakerOf(part.key) === "jesus") out.push(v[lang]);
      if (part.inner) {
        var iv = verse(part.inner);
        if (iv && iv[lang] && speakerOf(part.inner) === "jesus") out.push(iv[lang]);
      }
    });
    return out;
  }

  // Wraps each segment found in `text` (searched in order) in span.jesus,
  // pulling in a directly adjacent curly quote so the marks share the color.
  function highlighted(text, segments) {
    var frag = document.createDocumentFragment();
    var cursor = 0;
    segments.forEach(function (seg) {
      var at = text.indexOf(seg, cursor);
      if (at < 0) return;
      var start = at;
      var end = at + seg.length;
      if (start > cursor && /[“‘]/.test(text.charAt(start - 1))) start -= 1;
      if (end < text.length && /[”’]/.test(text.charAt(end))) end += 1;
      if (start > cursor) frag.appendChild(document.createTextNode(text.slice(cursor, start)));
      frag.appendChild(el("span", { class: "jesus" }, text.slice(start, end)));
      cursor = end;
    });
    if (cursor < text.length) frag.appendChild(document.createTextNode(text.slice(cursor)));
    return frag;
  }

  // Returns the verse as a fragment with Jesus' words wrapped in span.jesus, or null.
  // Prefers the exact full verse; joins the partial keys only as a fallback.
  function verseFragment(plan, lang) {
    var full = fullText(plan, lang);
    if (!full && plan.parts.length === 1) {
      var single = verse(plan.parts[0].key);
      if (single && single[lang]) full = single[lang];
    }
    if (full) return highlighted(full, jesusSegments(plan, lang));
    return joinedFragment(plan, lang);
  }

  // Fallback: glue partial-verse keys together, adding the ESV quotation marks between them.
  function joinedFragment(plan, lang) {
    var frag = document.createDocumentFragment();
    var prev = null;
    var any = false;
    for (var i = 0; i < plan.parts.length; i++) {
      var part = plan.parts[i];
      var text = partText(part, lang);
      if (text == null) {
        noteMissing("scripture:" + part.key);
        if (prev !== null) frag.appendChild(document.createTextNode(" "));
        frag.appendChild(el("span", { class: "missing", title: part.key }, "[" + part.key + "]"));
        prev = "]";
        continue;
      }
      any = true;
      // English em dashes join without spaces (ESV 9:6); everything else gets one space.
      if (prev !== null) {
        var tight = lang === "en" && (/—$/.test(prev) || /^[“"]?—/.test(text) || /^”?—/.test(text));
        if (!tight) frag.appendChild(document.createTextNode(" "));
      }
      var isJesus = speakerOf(part.key) === "jesus";
      if (isJesus) {
        frag.appendChild(el("span", { class: "jesus" }, text));
      } else if (part.inner) {
        var inner = verse(part.inner);
        var innerText = inner && inner[lang];
        var at = innerText ? text.indexOf(innerText) : -1;
        if (at >= 0) {
          if (at > 0) frag.appendChild(document.createTextNode(text.slice(0, at)));
          frag.appendChild(el("span", { class: "jesus" }, innerText));
          var rest = text.slice(at + innerText.length);
          if (rest) frag.appendChild(document.createTextNode(rest));
        } else {
          frag.appendChild(document.createTextNode(text));
        }
      } else {
        frag.appendChild(document.createTextNode(text));
      }
      prev = text;
    }
    return any ? frag : null;
  }

  function passagePlan(n) {
    for (var i = 0; i < PASSAGE.length; i++) if (PASSAGE[i].n === n) return PASSAGE[i];
    return null;
  }

  /* ---------- Header and footer ---------- */

  function renderHeader() {
    var m = meta();
    if (!m) {
      noteMissing("data/meta.js");
      return;
    }
    if (isT(m.title)) {
      setText("title-ko", m.title.ko);
      setText("title-en", m.title.en);
      setText("sheet-title-ko", m.title.ko);
      setText("sheet-title-en", m.title.en);
      setText("footer-title", m.title.ko + " · " + m.title.en);
      document.title = "선생님용 안내 · " + m.title.ko;
    }
    if (isT(m.subtitle)) setText("subtitle", m.subtitle.ko);
    if (typeof m.version === "string" && m.version) setText("footer-version", " · v" + m.version);
  }

  function setText(id, text) {
    var node = byId(id);
    if (node && typeof text === "string" && text) node.textContent = text;
  }

  /* ---------- 4. Endings board ---------- */

  function lensHeaderCell(id) {
    var l = lensInfo(id);
    if (!l) {
      return el("th", { scope: "col" }, [el("span", { class: "lens-num" }, CIRCLED[id]), " ", el("span", { class: "missing" }, "lens " + id)]);
    }
    var hasDesc = isT(l.desc);
    return el("th", { scope: "col" }, [
      el("span", { class: "lens-head" }, [
        el("span", { class: "lens-num", "aria-hidden": "true" }, CIRCLED[id]),
        el("span", { class: "lens-label" }, l.label.ko),
        el("span", { class: "lens-label-en", lang: "en" }, l.label.en)
      ]),
      hasDesc ? el("span", { class: "lens-desc" }, l.desc.ko) : null,
      hasDesc ? el("span", { class: "lens-desc-en", lang: "en" }, l.desc.en) : null
    ]);
  }

  function lensLegend() {
    var list = el("ul", { class: "lens-legend", "aria-label": "세 가지 눈" });
    LENS_IDS.forEach(function (id) {
      var l = lensInfo(id);
      if (!l) return;
      list.appendChild(
        el("li", null, [
          el("span", { class: "ln", "aria-hidden": "true" }, CIRCLED[id]),
          el("span", null, [
            el("b", null, l.label.ko),
            isT(l.desc) ? " " + l.desc.ko : null,
            el("span", { class: "en", lang: "en" }, l.label.en + (isT(l.desc) ? " " + l.desc.en : ""))
          ])
        ])
      );
    });
    return list;
  }

  function renderBoard() {
    var host = byId("board-grid");
    if (!host) return;
    clear(host);
    var m = meta();
    if (!m || !m.endings) {
      noteMissing("data/meta.js");
      host.appendChild(placeholder("엔딩 정보를 불러오지 못했어요.", "data/meta.js"));
      return;
    }

    host.appendChild(lensLegend());

    var colgroup = el("colgroup", null, [el("col", { class: "c-row" }), el("col"), el("col"), el("col")]);
    var headRow = el("tr", null, [
      el("th", { scope: "col", class: "corner" }, ["인물 ↓ · 눈 →", el("br"), el("span", { lang: "en" }, "Character · Lens")])
    ]);
    LENS_IDS.forEach(function (id) {
      headRow.appendChild(lensHeaderCell(id));
    });

    var body = el("tbody");
    routeOrder().forEach(function (routeId) {
      var r = routeInfo(routeId);
      var rowHead = el("th", { scope: "row" }, r
        ? [
            el("span", { class: "who-ko" }, r.name.ko),
            el("span", { class: "who-en", lang: "en" }, r.name.en),
            isT(r.title) ? el("span", { class: "who-route" }, "「" + r.title.ko + "」") : null
          ]
        : [el("span", { class: "missing" }, routeId)]);
      var tr = el("tr", null, rowHead);

      LENS_IDS.forEach(function (lensId) {
        var l = lensInfo(lensId);
        var title = endingTitle(routeId, lensId);
        var cellLens = el("span", { class: "cell-lens" }, [
          el("span", { class: "lens-num", "aria-hidden": "true" }, CIRCLED[lensId]),
          l ? el("b", null, l.label.ko) : null,
          l ? el("span", { lang: "en" }, [el("br"), l.label.en]) : null
        ]);
        var bodyKids = title
          ? [el("span", { class: "ending-ko" }, title.ko), el("span", { class: "ending-en", lang: "en" }, title.en)]
          : [el("span", { class: "missing" }, "엔딩 제목 없음")];
        bodyKids.push(el("span", { class: "name-line" }, ["이름", "\u00A0·\u00A0", el("span", { lang: "en" }, "Name")]));
        tr.appendChild(el("td", null, [cellLens, el("div", { class: "cell-body" }, bodyKids)]));
      });
      body.appendChild(tr);
    });

    var table = el("table", { class: "board-table" }, [
      el("caption", { class: "sr" }, "엔딩 판: 세 인물(세로) × 세 가지 눈(가로)"),
      colgroup,
      el("thead", null, headRow),
      body
    ]);
    host.appendChild(table);
  }

  /* ---------- 4b. Ending last lines (teacher prep) ---------- */

  function renderLastLines() {
    var host = byId("lastlines-body");
    if (!host) return;
    clear(host);
    routeOrder().forEach(function (routeId) {
      var r = routeInfo(routeId);
      var group = el("div", { class: "ll-route" }, [
        el("h4", null, r ? [r.name.ko, el("span", { lang: "en" }, r.name.en)] : routeId)
      ]);
      var routeLoaded = !!(BHS.routes && BHS.routes[routeId]);
      if (!routeLoaded) noteMissing(ROUTE_FILE[routeId] || "data/routes/" + routeId + ".js");
      var list = el("ul", { class: "ll-list" });
      LENS_IDS.forEach(function (lensId) {
        var l = lensInfo(lensId);
        var title = endingTitle(routeId, lensId);
        var last = endingLast(routeId, lensId);
        var head = el("p", { class: "ll-head" }, [
          CIRCLED[lensId] + " ",
          l ? l.label.ko + " · " : "",
          el("b", null, title ? title.ko : "—"),
          title ? el("span", { lang: "en" }, " · " + title.en) : null
        ]);
        var item = el("li", null, head);
        if (last) {
          item.appendChild(el("p", { class: "ll-ko" }, rich(last.ko, "ko")));
          item.appendChild(el("p", { class: "ll-en", lang: "en" }, rich(last.en, "en")));
        } else if (routeLoaded) {
          item.appendChild(placeholder("이 엔딩의 마지막 문장이 아직 없어요.", ROUTE_FILE[routeId] || null));
        }
        list.appendChild(item);
      });
      group.appendChild(list);
      // One note per missing route file instead of one per ending.
      if (!routeLoaded) {
        group.appendChild(placeholder("대본 파일이 아직 없어서 마지막 문장을 보여 줄 수 없어요.", ROUTE_FILE[routeId] || "data/routes/" + routeId + ".js"));
      }
      host.appendChild(group);
    });
  }

  function setupLastLinesToggle() {
    var btn = byId("lastlines-toggle");
    var panel = byId("lastlines");
    if (!btn || !panel) return;
    var showLabel = "엔딩 마지막 문장 보기";
    var hideLabel = "엔딩 마지막 문장 숨기기";
    var wrap = btn.closest ? btn.closest(".reveal") : null;
    btn.addEventListener("click", function () {
      var open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", open ? "false" : "true");
      btn.textContent = open ? showLabel : hideLabel;
      panel.hidden = open;
      // Print includes the last lines only while they are open on screen.
      if (wrap) wrap.classList.toggle("is-open", !open);
    });
  }

  /* ---------- 5. Discussion slots ---------- */

  function renderStep3() {
    var verseHost = byId("step3-verse");
    var blanksHost = byId("step3-blanks");
    var common = BHS.common;
    var final = common && common.final ? common.final : null;
    var key = final && typeof final.key === "string" ? final.key : "MT_9_2B2";

    if (verseHost) {
      clear(verseHost);
      var v = verse(key);
      if (v) {
        verseHost.appendChild(el("p", { class: "verse-quote" }, ["“" + v.ko + "” ", refText(key, "ko") ? el("span", { class: "ref" }, refText(key, "ko")) : null]));
        verseHost.appendChild(el("p", { class: "verse-quote-en", lang: "en" }, ["“" + v.en + "” ", refText(key, "en") ? el("span", { class: "ref" }, refText(key, "en")) : null]));
      } else {
        noteMissing("scripture:" + key);
        verseHost.appendChild(placeholder("마지막 화면의 구절(" + key + ")을 아직 불러오지 못했어요.", "data/scripture.js"));
      }
    }

    if (blanksHost) {
      clear(blanksHost);
      var blanks = final && final.blanks ? final.blanks : null;
      var any = false;
      routeOrder().forEach(function (routeId) {
        var t = blanks ? blanks[routeId] : null;
        if (!isT(t)) return;
        any = true;
        blanksHost.appendChild(
          el("li", null, [el("p", { class: "say-ko" }, rich(t.ko, "ko")), el("p", { class: "say-en", lang: "en" }, rich(t.en, "en"))])
        );
      });
      if (!any) {
        noteMissing("data/common.js");
        blanksHost.appendChild(el("li", null, placeholder("마지막 화면의 빈칸 문장을 불러오지 못했어요.", "data/common.js")));
      }
    }
  }

  function renderStep4() {
    var qHost = byId("step4-question");
    var vHost = byId("step4-verse");
    var final = BHS.common && BHS.common.final ? BHS.common.final : null;

    if (qHost) {
      clear(qHost);
      if (final && isT(final.question)) {
        qHost.appendChild(el("p", { class: "say-ko" }, rich(final.question.ko, "ko")));
        qHost.appendChild(el("p", { class: "say-en", lang: "en" }, rich(final.question.en, "en")));
      } else {
        noteMissing("data/common.js");
        qHost.appendChild(placeholder("마지막 화면의 질문을 불러오지 못했어요.", "data/common.js"));
      }
    }

    renderReadVerse(vHost, 6);
  }

  // A whole verse of Matthew 9 in both languages, for reading aloud together.
  function renderReadVerse(host, n) {
    if (!host) return;
    clear(host);
    var plan = passagePlan(n);
    var firstKey = plan ? plan.parts[0].key : null;
    var ko = plan ? verseFragment(plan, "ko") : null;
    var en = plan ? verseFragment(plan, "en") : null;
    if (ko || en) {
      if (ko) host.appendChild(el("p", { class: "read-verse-ko" }, [ko, " ", el("span", { class: "ref" }, refText(firstKey, "ko") || "마 9:" + n)]));
      if (en) host.appendChild(el("p", { class: "read-verse-en", lang: "en" }, [en, " ", el("span", { class: "ref" }, refText(firstKey, "en") || "Matt 9:" + n)]));
    } else {
      host.appendChild(placeholder("9:" + n + " 본문을 아직 불러오지 못했어요.", "data/scripture.js"));
    }
  }

  function renderStep2() {
    renderReadVerse(byId("step2-verse"), 3);
  }

  /* ---------- 6. Scripture side by side ---------- */

  function renderScripture() {
    var host = byId("scripture");
    if (!host) return;
    clear(host);
    if (!BHS.scripture || typeof BHS.scripture !== "object") {
      noteMissing("data/scripture.js");
      host.appendChild(placeholder("본문 파일을 아직 불러오지 못했어요. 파일이 생기면 이 자리에 마태복음 9:1–8이 한영으로 나와요.", "data/scripture.js"));
      return;
    }

    host.appendChild(
      el("div", { class: "sc-head", "aria-hidden": "true" }, [
        el("span"),
        el("span", null, "개역개정"),
        el("span", { lang: "en" }, "ESV")
      ])
    );

    PASSAGE.forEach(function (plan) {
      var ko = verseFragment(plan, "ko");
      var en = verseFragment(plan, "en");
      host.appendChild(
        el("div", { class: "sc-row" }, [
          el("span", { class: "sc-num" }, String(plan.n)),
          el("p", { class: "sc-ko" }, ko || el("span", { class: "missing" }, "—")),
          el("p", { class: "sc-en", lang: "en" }, en || el("span", { class: "missing" }, "—"))
        ])
      );
    });

    host.appendChild(el("p", { class: "sc-ref" }, ["마태복음 9:1–8 · ", el("span", { lang: "en" }, "Matthew 9:1–8 (ESV)")]));
  }

  /* ---------- 9. Notices ---------- */

  function renderNotices() {
    var host = byId("notices");
    if (!host) return;
    clear(host);
    var m = meta();
    var any = false;
    if (m && isT(m.bibleNotice)) {
      any = true;
      host.appendChild(
        el("div", { class: "notice" }, [
          el("p", { class: "notice-label" }, "본문 출처"),
          el("p", null, m.bibleNotice.ko),
          el("p", { lang: "en" }, m.bibleNotice.en)
        ])
      );
    }
    if (m && isT(m.disclaimer)) {
      any = true;
      host.appendChild(
        el("div", { class: "notice" }, [
          el("p", { class: "notice-label" }, "창작 안내"),
          el("p", null, m.disclaimer.ko),
          el("p", { lang: "en" }, m.disclaimer.en)
        ])
      );
    }
    if (!any) {
      noteMissing("data/meta.js");
      host.appendChild(placeholder("출처 정보를 불러오지 못했어요.", "data/meta.js"));
    }
  }

  /* ---------- Copy link ---------- */

  function selectNode(node) {
    try {
      var sel = window.getSelection();
      var range = document.createRange();
      range.selectNodeContents(node);
      sel.removeAllRanges();
      sel.addRange(range);
      return true;
    } catch (e) {
      return false;
    }
  }

  function setupCopy() {
    var btn = byId("copy-btn");
    var urlNode = byId("game-url");
    var status = byId("copy-status");
    if (!btn || !urlNode) return;
    var label = btn.textContent;
    var timer = null;

    function say(msg) {
      if (status) status.textContent = msg;
    }

    function copied() {
      btn.textContent = "복사했어요";
      say("링크를 복사했어요. 단체 채팅방에 붙여 넣으세요.");
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () {
        btn.textContent = label;
      }, 2200);
    }

    function failed() {
      selectNode(urlNode);
      say("자동 복사가 안 돼요. 주소를 선택해 두었으니 길게 눌러(또는 Ctrl+C) 복사하세요.");
    }

    function legacyCopy() {
      if (!selectNode(urlNode)) return false;
      try {
        return document.execCommand("copy") === true;
      } catch (e) {
        return false;
      }
    }

    btn.addEventListener("click", function () {
      var text = (urlNode.textContent || "").trim();
      var fallback = function () {
        if (legacyCopy()) copied();
        else failed();
      };
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
          navigator.clipboard.writeText(text).then(copied, fallback);
          return;
        }
      } catch (e) {
        // Clipboard API threw synchronously; fall back below.
      }
      fallback();
    });
  }

  /* ---------- QR fallback check ---------- */

  function checkQr() {
    var img = byId("qr-img");
    var missing = byId("qr-missing");
    if (!img || !missing) return;
    function showMissing() {
      img.hidden = true;
      missing.hidden = false;
    }
    if (img.complete && img.naturalWidth === 0 && img.getAttribute("src")) showMissing();
    img.addEventListener("error", showMissing);
  }

  /* ---------- Print ---------- */

  function setupPrint() {
    var btn = byId("print-btn");
    var all = byId("print-all");
    var root = document.documentElement;
    if (all) {
      root.classList.toggle("print-all", !!all.checked);
      all.addEventListener("change", function () {
        root.classList.toggle("print-all", !!all.checked);
      });
    }
    if (btn) {
      btn.addEventListener("click", function () {
        try {
          window.print();
        } catch (e) {
          // Printing is unavailable in some embedded browsers; nothing else to do.
        }
      });
    }
  }

  /* ---------- Table of contents highlight ---------- */

  function setupScrollSpy() {
    var links = document.querySelectorAll('.toc a[href^="#"]');
    if (!links.length || !("IntersectionObserver" in window)) return;
    var byTarget = {};
    var sections = [];
    Array.prototype.forEach.call(links, function (a) {
      var id = a.getAttribute("href").slice(1);
      var target = byId(id);
      if (!target) return;
      byTarget[id] = a;
      sections.push(target);
    });
    var current = null;
    function setCurrent(id) {
      if (id === current) return;
      if (current && byTarget[current]) byTarget[current].removeAttribute("aria-current");
      current = id;
      if (byTarget[id]) byTarget[id].setAttribute("aria-current", "true");
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) setCurrent(entry.target.id);
        });
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 }
    );
    sections.forEach(function (s) {
      io.observe(s);
    });
  }

  /* ---------- Boot ---------- */

  function safely(name, fn) {
    try {
      fn();
    } catch (err) {
      if (window.console && console.error) console.error("[teacher] " + name + " failed", err);
    }
  }

  function boot() {
    safely("header", renderHeader);
    safely("board", renderBoard);
    safely("lastLines", renderLastLines);
    safely("lastLinesToggle", setupLastLinesToggle);
    safely("step2", renderStep2);
    safely("step3", renderStep3);
    safely("step4", renderStep4);
    safely("scripture", renderScripture);
    safely("notices", renderNotices);
    safely("copy", setupCopy);
    safely("qr", checkQr);
    safely("print", setupPrint);
    safely("scrollSpy", setupScrollSpy);
    if (missingNotes.length && window.console && console.info) {
      console.info("[teacher] Rendered with placeholders for: " + missingNotes.join(", "));
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
