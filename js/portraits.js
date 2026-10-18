/* Character portraits for "Before He Stood", drawn as inline SVG strings.
   Owner: portrait agent. See docs/SPEC.md §5.6 (look), §6.1 (fixed facts), §7 (guardrails).
   - Classic script, no modules, no fetch, no external assets, no SVG filters.
   - Each portrait is a half-body bust on a transparent background, viewBox 0 0 600 900,
     bottom edge cut by the frame. Faces sit above y ~560 because the text panel covers
     the lower part of the stage. The root <svg> uses preserveAspectRatio="xMidYMax meet",
     so a container of any size keeps the figure standing on its bottom edge.
   - FACING: every figure faces screen-LEFT (three-quarter view, gaze to the left).
     BHS.portraits.facing[id] says so too; the UI can mirror a portrait with CSS
     transform: scaleX(-1) when it stands on the left of the stage (the art has no text).
   - Style: cut-paper relief. Flat color planes in natural dyes, one warm shadow color and
     one warm light color laid over them as planes, no outlines. Light comes from the upper
     left (the side they face): a thin warm rim catches the upper-left edges and the figure
     casts a soft offset shadow, so it separates from dark interiors and bright noon scenes.
   - Jesus is never drawn: render("jesus") returns null. No crosses, halos or text.
   - Ids inside each SVG are prefixed with the character id plus a per-render counter. */
(function () {
  "use strict";
  var BHS = (window.BHS = window.BHS || {});

  var IDS = ["menahem", "hanan", "yonah", "asher", "mother", "brother", "neighbor", "passerby", "partners", "scribes"];
  var renderCount = 0;

  var SH = "#2a1409";   // shadow overlay (warm umber), used at a few fixed strengths
  var HI = "#fff1d6";   // light overlay
  var INK = "#1d130d";  // lash lines and pupils

  // ---------------------------------------------------------------- utilities

  var PREC = 1;         // path number precision: 1 = integers, 10 = one decimal (faces)
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rn(v) { var n = Math.round(v * PREC) / PREC; return n === 0 ? 0 : n; }
  function r1(v) { var n = Math.round(v * 10) / 10; return n === 0 ? 0 : n; }
  function op(o) { return o !== undefined && o !== 1 ? ' opacity="' + o + '"' : ""; }

  // Joins numbers for path data; a negative number needs no separator.
  function nums(arr) {
    var s = "";
    for (var i = 0; i < arr.length; i++) {
      var n = rn(arr[i]);
      s += (i === 0 || n < 0 ? "" : " ") + n;
    }
    return s;
  }

  function hexRgb(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) {
    var x = hexRgb(a), y = hexRgb(b), o = "#";
    for (var i = 0; i < 3; i++) {
      var v = Math.round(lerp(x[i], y[i], t));
      o += (v < 16 ? "0" : "") + v.toString(16);
    }
    return o;
  }

  // A frame maps local units (u right, v down) to viewBox coordinates: origin (x, y),
  // scale s, optional rotation in radians. Heads use 1 unit = half the head height.
  function frame(x, y, s, rot) {
    var c = Math.cos(rot || 0), n = Math.sin(rot || 0);
    var f = function (u, v) { return [x + s * (u * c - v * n), y + s * (u * n + v * c)]; };
    f.s = s;
    return f;
  }
  var V = frame(0, 0, 1, 0);  // plain viewBox coordinates

  function mapPts(f, list) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var p = list[i], q = f(p[0], p[1]);
      if (p[2]) q.push(1);
      out.push(q);
    }
    return out;
  }

  // Smooth path through points (Catmull-Rom as cubic Beziers). A point with a third entry
  // is a corner: its tangents point along the chords to its neighbours.
  function curve(p, closed) {
    var n = p.length, d = "M" + nums([p[0][0], p[0][1]]), last = closed ? n : n - 1;
    for (var i = 0; i < last; i++) {
      var p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n];
      if (!closed) { if (i === 0) p0 = p1; if (i + 2 >= n) p3 = p2; }
      var a = p1[2] ? [lerp(p1[0], p2[0], 0.3), lerp(p1[1], p2[1], 0.3)] : [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      var b = p2[2] ? [lerp(p2[0], p1[0], 0.3), lerp(p2[1], p1[1], 0.3)] : [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += "C" + nums([a[0], a[1], b[0], b[1], p2[0], p2[1]]);
    }
    return d + (closed ? "Z" : "");
  }
  function sm(f, list) { return curve(mapPts(f, list), true); }

  // Cubic Bezier point.
  function bez(p0, p1, p2, p3, t) {
    var m = 1 - t, a = m * m * m, b = 3 * m * m * t, c = 3 * m * t * t, d = t * t * t;
    return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
  }

  // Ellipse outline as smooth points (local units), starting at angle a0.
  function ellPts(cx, cy, rx, ry, k, a0) {
    var out = [];
    for (var i = 0; i < k; i++) {
      var a = (a0 || 0) + (i / k) * Math.PI * 2;
      out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
    }
    return out;
  }

  // ---------------------------------------------------------------- render context

  function Ctx(cid, uid) {
    this.cid = cid;
    this.pre = cid + "-" + uid + "-";
    this.defs = [];
    this.body = [];
    this.sil = [];
    this.n = 0;
    this.tint = null;
  }
  Ctx.prototype.id = function (name) { return this.pre + name; };
  Ctx.prototype.add = function (s) { this.body.push(s); };
  Ctx.prototype.def = function (s) { this.defs.push(s); };
  // Filled path. o = opacity; sil = also part of the outer silhouette (rim light, shadow).
  Ctx.prototype.fill = function (d, color, o, sil, extra) {
    this.body.push('<path d="' + d + '" fill="' + color + '"' + op(o) + (extra || "") + "/>");
    if (sil) this.sil.push(d);
    return d;
  };
  Ctx.prototype.shape = function (f, list, color, o, sil) { return this.fill(sm(f, list), color, o, sil); };
  // Open smooth stroke through frame-local points.
  Ctx.prototype.line = function (f, list, color, w, o) {
    this.body.push('<path d="' + curve(mapPts(f, list), false) + '" fill="none" stroke="' + color + '" stroke-width="' + r1(w) +
      '" stroke-linecap="round" stroke-linejoin="round"' + op(o) + "/>");
  };
  Ctx.prototype.clip = function (d) {
    var id = this.id("k" + (++this.n));
    this.def('<clipPath id="' + id + '"><path d="' + d + '"/></clipPath>');
    return "url(#" + id + ")";
  };
  Ctx.prototype.inside = function (d) { this.body.push('<g clip-path="' + this.clip(d) + '">'); };
  Ctx.prototype.end = function () { this.body.push("</g>"); };
  Ctx.prototype.circle = function (p, r, color, o) {
    this.body.push('<circle cx="' + r1(p[0]) + '" cy="' + r1(p[1]) + '" r="' + r1(r) + '" fill="' + color + '"' + op(o) + "/>");
  };

  Ctx.prototype.svg = function () {
    var sid = this.id("sil"), u = "#" + sid, i;
    var box = ' x="-40" y="-40" width="680" height="980"';
    var defs = '<g id="' + sid + '">';
    for (i = 0; i < this.sil.length; i++) defs += '<path d="' + this.sil[i] + '"/>';
    defs += "</g>" +
      // Rim: the silhouette minus itself shifted down-right leaves a thin upper-left edge.
      '<mask id="' + this.id("rim") + '" maskUnits="userSpaceOnUse"' + box + '><use href="' + u + '" fill="#fff"/>' +
      '<use href="' + u + '" fill="#000" transform="translate(6 5)"/></mask>' +
      '<mask id="' + this.id("in") + '" maskUnits="userSpaceOnUse"' + box + '><use href="' + u + '" fill="#fff"/></mask>' +
      // Light falls off toward the bottom, where the text panel sits.
      '<linearGradient id="' + this.id("fd") + '" gradientUnits="userSpaceOnUse" x1="0" y1="470" x2="0" y2="900">' +
      '<stop offset="0" stop-color="' + SH + '" stop-opacity="0"/><stop offset="1" stop-color="' + SH + '" stop-opacity=".34"/></linearGradient>';
    var shadow = '<g opacity=".12"><use href="' + u + '" transform="translate(10 12)" fill="#120904" stroke="#120904" stroke-width="36" stroke-linejoin="round"/></g>' +
      '<g opacity=".2"><use href="' + u + '" transform="translate(5 6)" fill="#120904" stroke="#120904" stroke-width="10" stroke-linejoin="round"/></g>';
    var over = '<rect' + box + ' fill="url(#' + this.id("fd") + ')" mask="url(#' + this.id("in") + ')"/>';
    if (this.tint) over += '<rect' + box + ' fill="' + this.tint[0] + '" opacity="' + this.tint[1] + '" mask="url(#' + this.id("in") + ')"/>';
    over += '<rect' + box + ' fill="#ffe8c4" opacity="' + (this.tint ? 0.45 : 0.6) + '" mask="url(#' + this.id("rim") + ')"/>';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 900" preserveAspectRatio="xMidYMax meet" width="100%" height="100%"' +
      ' class="bhs-portrait" data-portrait="' + this.cid + '" data-facing="left" aria-hidden="true" focusable="false">' +
      "<defs>" + defs + this.defs.join("") + "</defs>" + shadow + this.body.join("") + over + "</svg>";
  };

  // Lens-shaped tapered stroke from a through m to b, t thick at m (frame units).
  function leaf(c, f, a, m, b, t, color, o) {
    var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = (-dy / L) * t * 0.5, ny = (dx / L) * t * 0.5;
    c.shape(f, [[a[0], a[1], 1], [m[0] + nx, m[1] + ny], [b[0], b[1], 1], [m[0] - nx, m[1] - ny]], color, o);
  }

  // ---------------------------------------------------------------- face kit
  // Head-local units: head height 2 (crown v=-1, chin v=1), u to the right. Three-quarter
  // view facing screen-left: the far eye (left) is narrower, the near ear shows on the right.

  var FACE = {
    jaw: 1, chin: 1, round: 0, hollow: 0,                 // head shape
    eye: 1, open: 1, gaze: -0.2, crinkle: 0, tired: 0,    // eyes
    browIn: 0, browUp: 0, browT: 1, arch: 1,              // brows (browIn > 0 lifts the inner ends)
    smile: 0, part: 0, mouthW: 1, wry: 0,                 // mouth (wry lifts the near corner and brow)
    age: 0, nose: 1, ear: 1, lash: 1, blush: 0,
    skin: "#a6744f", lip: "#8a4a36", brow: "#2a1f19", iris: "#3a2416", sclera: "#d9ccb4"
  };
  function withFace(o) { var r = {}, k; for (k in FACE) r[k] = FACE[k]; for (k in o) r[k] = o[k]; return r; }

  function headPts(o) {
    var j = o.jaw, k = o.chin, r = o.round, h = o.hollow;
    return [
      [0.04, -1], [0.5, -0.92], [0.74, -0.62], [0.79, -0.22], [0.76 + r * 0.03, 0.18],
      [0.62 * j + r * 0.05, 0.54], [0.34 * j + r * 0.05, 0.85 * k], [-0.02, 0.98 * k], [-0.27, 0.99 * k],
      [-0.47 - r * 0.04, 0.875 * k], [-0.585 - r * 0.06 + h * 0.03, 0.62], [-0.65 - r * 0.04 + h * 0.015, 0.3],
      [-0.675, 0.02], [-0.665, -0.3], [-0.575, -0.64], [-0.33, -0.915]
    ];
  }

  // Tapered brow from the inner end a to the outer end b, arched upward.
  function brow(c, f, a, b, arch, t, color) {
    var top = [], bot = [];
    for (var i = 0; i <= 6; i++) {
      var s = i / 6, x = lerp(a[0], b[0], s);
      var y = lerp(a[1], b[1], s) - arch * Math.sin(Math.PI * Math.pow(s, 1.36));
      var th = t * (1 - 0.78 * Math.pow(s, 1.4));
      top.push([x, y - th * 0.5]);
      bot.push([x, y + th * 0.5]);
    }
    top[0].push(1); bot[0].push(1);
    c.shape(f, top.concat(bot.reverse()), color);
  }

  // One eye: sclera almond, iris clipped by the lids, lid shadow, lash line, crease.
  // inner = +1 when the inner corner is on the right (far eye), -1 when on the left.
  function eye(c, f, cx, cy, w, inner, o) {
    var h = w * 0.46 * o.open, d = w * 0.3;
    var I = [cx + inner * w, cy + 0.008], O = [cx - inner * w, cy - 0.012];
    var u1 = [lerp(I[0], O[0], 0.25), cy - h * 1.3], u2 = [lerp(I[0], O[0], 0.7), cy - h * 1.22];
    var l1 = [lerp(I[0], O[0], 0.72), cy + d * (1.25 - o.crinkle * 0.45)], l2 = [lerp(I[0], O[0], 0.28), cy + d * 1.2];
    function P(q) { return nums(f(q[0], q[1])); }
    var upper = "M" + P(I) + "C" + P(u1) + " " + P(u2) + " " + P(O);
    var almond = upper + "C" + P(l1) + " " + P(l2) + " " + P(I) + "Z";
    c.fill(almond, o.sclera);
    var r = w * 0.44, g = [cx + o.gaze * w, cy - h * 0.1 + d * 0.32], s = f.s;
    c.inside(almond);
    c.circle(f(g[0], g[1]), r * s, o.iris);
    c.circle(f(g[0], g[1]), r * 0.5 * s, INK);
    c.fill(upper + "C" + P([u2[0], u2[1] + h * 0.75]) + " " + P([u1[0], u1[1] + h * 0.75]) + " " + P(I) + "Z", SH, 0.3);
    c.end();
    c.circle(f(g[0] - r * 0.3, g[1] - r * 0.34), r * 0.2 * s, "#fff8ea", 0.85);
    // Lash line along the upper lid, a little past the outer corner.
    var t = 0.024 * o.lash, Oe = [O[0] - inner * w * (0.12 + 0.06 * o.lash), O[1] + w * 0.03];
    c.fill(upper + "L" + P(Oe) + "C" + P([u2[0], u2[1] - t * 1.6]) + " " + P([u1[0], u1[1] - t * 1.4]) + " " + P([I[0], I[1] - t * 0.3]) + "Z", INK, 0.92);
    // Upper-lid crease and a faint lower lid.
    var k = 0.035 + h * 0.55;
    c.add('<path d="M' + P([lerp(I[0], O[0], 0.12), lerp(I[1], O[1], 0.12) - k * 0.5]) + "C" + P([u1[0], u1[1] - k]) + " " + P([u2[0], u2[1] - k]) + " " +
      P([lerp(I[0], O[0], 0.92), lerp(I[1], O[1], 0.92) - k * 0.6]) + '" fill="none" stroke="' + SH + '" stroke-width="' + r1(s * 0.014) +
      '" stroke-linecap="round" opacity=".38"/>');
    var b1 = bez(O, l1, l2, I, 0.18), b2 = bez(O, l1, l2, I, 0.5), b3 = bez(O, l1, l2, I, 0.82);
    c.line(f, [[b1[0], b1[1] + 0.012], [b2[0], b2[1] + 0.016], [b3[0], b3[1] + 0.012]], SH, s * 0.012, r1(0.22 + o.tired * 0.2 + o.age * 0.1));
    if (o.tired > 0 || o.age > 0) {
      c.line(f, [[b1[0], b1[1] + 0.06], [b2[0], b2[1] + 0.075], [b3[0], b3[1] + 0.05]], SH, s * 0.012, r1(0.1 + o.tired * 0.14 + o.age * 0.06));
    }
    if (o.crinkle > 0 || o.age > 0.5) {
      var ox = O[0] - inner * 0.03;
      c.line(f, [[ox, O[1] + 0.01], [ox - inner * 0.06, O[1] + 0.035]], SH, s * 0.012, r1(0.22 + o.crinkle * 0.15));
      c.line(f, [[ox, O[1] + 0.045], [ox - inner * 0.05, O[1] + 0.09]], SH, s * 0.012, r1(0.18 + o.crinkle * 0.12));
    }
  }

  // Draws the head: skin, ear, light and shadow planes, eyes, brows, nose. The mouth is
  // separate so beards can go between. Returns the head outline path.
  function head(c, f, o) {
    var keep = PREC;
    PREC = 10;
    var hd = c.shape(f, headPts(o), o.skin, 1, true);
    if (o.ear) {
      c.shape(f, [[0.6, -0.05], [0.69, -0.1], [0.8, -0.06], [0.84, 0.1], [0.79, 0.29], [0.69, 0.38], [0.61, 0.33]], mix(o.skin, SH, 0.2), 1, true);
      c.shape(f, [[0.665, 0.0], [0.75, -0.03], [0.785, 0.1], [0.74, 0.25], [0.69, 0.21], [0.72, 0.1], [0.68, 0.06]], SH, 0.32);
    }
    c.inside(hd);
    // Near side plane, from the temple past the outer eye corner and down the cheek.
    c.shape(f, [[0.33, -1.05], [0.27, -0.55], [0.25, -0.22], [0.27, 0.06], [0.245, 0.3, 1], [0.16, 0.56], [0.03, 0.8], [-0.08, 1.02],
      [0.6, 1.3, 1], [1.1, 0.4, 1], [1.1, -1.1, 1]], SH, 0.2);
    if (o.hollow) {
      c.shape(f, [[0.245, 0.3], [0.1, 0.42], [0.03, 0.62], [0.18, 0.6]], SH, r1(0.14 * o.hollow));
      c.shape(f, [[-0.66, 0.3], [-0.52, 0.42], [-0.56, 0.64], [-0.64, 0.6]], SH, r1(0.12 * o.hollow));
    }
    if (o.blush) {
      c.shape(f, [[-0.06, 0.22], [0.14, 0.18], [0.24, 0.33], [0.1, 0.46], [-0.06, 0.38]], "#b8442a", r1(0.1 * o.blush));
      c.shape(f, [[-0.62, 0.22], [-0.47, 0.2], [-0.43, 0.34], [-0.56, 0.42]], "#b8442a", r1(0.07 * o.blush));
    }
    // Eye sockets under the brow ridge.
    c.shape(f, [[-0.12, -0.14], [0.05, -0.17], [0.23, -0.11], [0.21, 0.0], [0.05, -0.07], [-0.11, -0.03]], SH, 0.12);
    c.shape(f, [[-0.38, -0.13], [-0.52, -0.155], [-0.65, -0.11], [-0.63, -0.01], [-0.5, -0.06], [-0.39, -0.03]], SH, 0.1);
    // Light on the forehead, the far cheekbone and the chin.
    c.shape(f, [[-0.56, -0.58], [-0.3, -0.74], [0.0, -0.7], [0.06, -0.52], [-0.16, -0.4], [-0.47, -0.4]], HI, 0.08);
    c.shape(f, [[-0.66, 0.1], [-0.5, 0.14], [-0.42, 0.3], [-0.6, 0.38]], HI, 0.12);
    c.shape(f, [[-0.36, 0.84], [-0.22, 0.81], [-0.13, 0.9], [-0.3, 0.95]], HI, 0.1);
    if (o.age > 0) {
      c.line(f, [[-0.5, -0.47], [-0.25, -0.52], [0.0, -0.49]], SH, f.s * 0.012, r1(0.22 * o.age));
      c.line(f, [[-0.12, 0.43], [-0.06, 0.55], [-0.04, 0.66]], SH, f.s * 0.014, r1(0.3 * o.age));
    }
    c.end();
    // Eyes and brows.
    var ey = 0.03, es = o.eye;
    eye(c, f, -0.505, ey, 0.115 * es, 1, o);
    eye(c, f, 0.035, ey, 0.146 * es, -1, o);
    var bu = o.browUp, bi = o.browIn, t = 0.052 * o.browT, ar = 0.035 * o.arch;
    brow(c, f, [-0.37, -0.165 - bu - bi], [-0.655, -0.13 - bu], ar, t * 0.92, o.brow);
    brow(c, f, [-0.125, -0.175 - bu - bi], [0.245, -0.135 - bu - o.wry * 0.05], ar + o.wry * 0.02, t, o.brow);
    // Nose: shadow side plane, wing, nostril, ridge light, cast shadow below.
    var n = o.nose;
    c.shape(f, [[-0.228, -0.02], [-0.18, 0.1], [-0.162, 0.28 * n], [-0.112, 0.38 * n, 1], [-0.14, 0.432 * n], [-0.222, 0.44 * n], [-0.2, 0.37 * n], [-0.212, 0.2 * n]], SH, 0.24);
    c.line(f, [[-0.128, 0.33 * n], [-0.105, 0.39 * n], [-0.135, 0.435 * n]], SH, f.s * 0.016, 0.4);
    c.shape(f, [[-0.27, 0.425 * n], [-0.235, 0.41 * n], [-0.2, 0.425 * n], [-0.235, 0.44 * n]], SH, 0.6);
    c.line(f, [[-0.27, 0.0], [-0.3, 0.18 * n], [-0.322, 0.33 * n]], HI, f.s * 0.018, 0.32);
    c.shape(f, [[-0.37, 0.415 * n], [-0.28, 0.465 * n], [-0.15, 0.462 * n], [-0.11, 0.425 * n], [-0.24, 0.445 * n]], SH, 0.26);
    PREC = keep;
    return hd;
  }

  // Mouth: upper lip, lower lip, the line between, a shadow under the lower lip.
  function mouth(c, f, o, bearded) {
    var keep = PREC;
    PREC = 10;
    var s = o.smile * 0.035, w = o.mouthW, cx = -0.255, y = 0.628;
    var A = [cx - 0.168 * w, y - s], B = [cx + 0.18 * w, y - s * 1.15 - o.wry * 0.03];
    var mid = [cx, y + 0.01 + s * 0.25];
    var gap = 0.012 + o.part * 0.034;
    if (!bearded) c.shape(f, [A, [cx - 0.07, y - 0.035], [cx, y - 0.028], [cx + 0.07, y - 0.035], B, mid], o.lip, 0.55);
    c.shape(f, [[A[0] + 0.02, A[1] + 0.012], [cx, y + 0.07 + s * 0.2 + o.part * 0.02], [B[0] - 0.03, B[1] + 0.012], mid], o.lip, bearded ? 0.9 : 0.55);
    var line = [A, [cx - 0.08, mid[1] - gap * 0.6], [cx + 0.08, mid[1] - gap * 0.6], B, [cx + 0.08, mid[1] + gap * 0.5], [cx - 0.08, mid[1] + gap * 0.5]];
    var ld = c.shape(f, line, mix(o.lip, INK, 0.62), 0.95);
    if (o.part > 0.45) {
      c.inside(ld);
      c.shape(f, [[cx - 0.12, mid[1] - gap], [cx + 0.12, mid[1] - gap], [cx + 0.1, mid[1] - gap * 0.2], [cx - 0.1, mid[1] - gap * 0.2]], "#e8dccb", 0.85);
      c.end();
    }
    if (!bearded) c.shape(f, [[cx - 0.1, y + 0.085], [cx, y + 0.1], [cx + 0.1, y + 0.08], [cx, y + 0.125]], SH, 0.16);
    PREC = keep;
  }

  // ---------------------------------------------------------------- hair, beards, garments

  // Hair cap: hairline across the forehead (line raises it), sideburn in front of the near
  // ear (side = how low), then around the back of the head. bump > 0 gives curls, spiky
  // gives tousled points; locks are light leaves inside the hair.
  function hair(c, f, h) {
    var hl = h.line || 0, bump = h.bump || 0, n = h.n || 8, vol = h.vol || 1, sb = h.side === undefined ? 0.16 : h.side;
    c.shape(f, [[-0.63, -0.38], [-0.52, -0.5 - hl], [-0.3, -0.56 - hl], [-0.05, -0.57 - hl], [0.16, -0.5 - hl], [0.28, -0.38 - hl], [0.3, -0.62], [0.0, -0.8], [-0.62, -0.62]], SH, 0.16);
    var p = [[-0.668, -0.14, 1], [-0.63, -0.42], [-0.52, -0.58 - hl], [-0.3, -0.64 - hl], [-0.05, -0.65 - hl], [0.16, -0.58 - hl], [0.27, -0.47 - hl, 1],
      [0.33, -0.2], [0.4, 0.05], [0.45, sb, 1], [0.54, -0.01], [0.65, -0.1], [0.79, -0.12], [0.87, 0.02], [0.86, 0.3], [0.8, 0.52, 1]];
    var a0 = 6.38, a1 = 3.4, N = n * 2;
    for (var i = 0; i <= N; i++) {
      var t = i / N, a = lerp(a0, a1, t), r = vol * (1 + (i % 2 ? 0 : bump));
      p.push([0.09 + 0.83 * r * Math.cos(a), -0.22 + 0.9 * r * Math.sin(a), h.spiky && i % 2 === 0 ? 1 : 0]);
    }
    if (h.fringe) p.splice(3, 3, h.fringe[0], h.fringe[1], h.fringe[2]);
    var d = c.shape(f, p, h.color, 1, true);
    c.inside(d);
    c.shape(f, [[0.3, -1.4], [1.3, -1.2], [1.3, 0.8], [0.6, 0.6], [0.42, -0.2]], SH, 0.22);
    c.shape(f, [[-0.72, -0.6], [-0.42, -1.0], [0.1, -1.13], [0.02, -0.92], [-0.45, -0.74]], HI, 0.1);
    var L = h.locks || [];
    for (var j = 0; j < L.length; j++) leaf(c, f, L[j][0], L[j][1], L[j][2], L[j][3] || 0.05, h.hi || HI, L[j][4] || 0.16);
    c.end();
    return d;
  }

  // Beard over the jaw with a mustache; e widens it, len lengthens it. stubble draws it as
  // a faint shadow instead. locks are leaves in a lighter (gray) or darker color.
  function beard(c, f, b) {
    var e = b.e || 0, L = b.len || 0;
    var p = [[0.46, 0.12, 1], [0.58 + e, 0.42], [0.5 + e, 0.8], [0.24 + e * 0.5, 1.0 + L * 0.55], [-0.12, 1.07 + L], [-0.42, 0.99 + L * 0.7],
      [-0.62 - e * 0.5, 0.74], [-0.69 - e * 0.3, 0.4], [-0.68, 0.08, 1], [-0.6, 0.3], [-0.5, 0.47], [-0.45, 0.58], [-0.37, 0.515],
      [-0.255, 0.49], [-0.15, 0.51], [-0.05, 0.56], [0.04, 0.5], [0.2, 0.36], [0.35, 0.2]];
    if (b.stubble) { c.shape(f, p, SH, b.stubble); return null; }
    var d = c.shape(f, p, b.color, 1, true);
    c.inside(d);
    c.shape(f, [[0.12, 0.45], [0.7, 0.1], [0.8, 1.7], [0.0, 1.7], [0.05, 1.0]], SH, 0.24);
    c.shape(f, [[-0.6, 0.86 + L * 0.5], [0.4, 0.86 + L * 0.5], [0.4, 1.5 + L], [-0.6, 1.5 + L]], SH, 0.16);
    c.shape(f, [[-0.68, 0.2], [-0.54, 0.5], [-0.48, 0.78], [-0.64, 0.72]], HI, 0.1);
    var K = b.locks || [];
    for (var j = 0; j < K.length; j++) leaf(c, f, K[j][0], K[j][1], K[j][2], K[j][3] || 0.05, b.hi || HI, K[j][4] || 0.3);
    c.end();
    return d;
  }

  // Neck column from the jaw to below the collar, mostly in shadow.
  function neck(c, f, skin, w) {
    var k = w || 1;
    c.shape(f, [[-0.34 * k, 0.55], [0.42 * k, 0.4], [0.47 * k, 1.05], [0.56 * k, 1.72], [-0.44 * k, 1.76], [-0.36 * k, 1.05]], mix(skin, SH, 0.18), 1, true);
    c.shape(f, [[-0.4 * k, 0.72], [0.5 * k, 0.55], [0.5 * k, 1.05], [-0.06, 1.1], [-0.42 * k, 0.98]], SH, 0.2);
  }

  // Tunic over shoulders and chest (body frame: head center origin, head units). k scales
  // the width; nk the depth of the neckline.
  function tunic(c, b, color, k, nk) {
    var n = nk || 1;
    var d = c.shape(b, [[-1.86 * k, 5.7, 1], [-1.82 * k, 2.6], [-1.7 * k, 1.88], [-1.32 * k, 1.52], [-0.44, 1.32, 1], [0.02, 1.32 + 0.28 * n], [0.5, 1.28, 1],
      [1.38 * k, 1.46], [1.93 * k, 1.8], [2.04 * k, 2.6], [2.08 * k, 5.7, 1]], color, 1, true);
    c.inside(d);
    c.shape(b, [[0.95, 1.2], [2.4, 1.5], [2.4, 5.8], [1.25, 5.8], [1.1, 3.0]], SH, 0.15);
    c.shape(b, [[-0.44, 1.32], [0.02, 1.32 + 0.28 * n], [0.5, 1.28], [0.5, 1.4], [0.02, 1.43 + 0.28 * n], [-0.44, 1.43]], SH, 0.22);
    leaf(c, b, [-1.3 * k, 2.1], [-1.36 * k, 3.6], [-1.36 * k, 5.7], 0.07, SH, 0.2);
    leaf(c, b, [1.5 * k, 2.1], [1.56 * k, 3.6], [1.58 * k, 5.7], 0.07, SH, 0.22);
    c.shape(b, [[-1.66 * k, 1.9], [-1.2 * k, 1.56], [-0.6, 1.42], [-0.9, 1.62], [-1.4 * k, 1.9]], HI, 0.14);
    c.end();
    return d;
  }

  // Mantle drawn over the head (scribes): the part behind the head, then the front.
  function hoodBack(c, b, M) {
    c.shape(b, [[-0.3, -1.13], [0.25, -1.17], [0.73, -0.98], [0.98, -0.55], [1.04, 0.05], [1.02, 0.6], [0.6, 0.9], [-0.7, 0.6], [-0.86, -0.3], [-0.74, -0.84]], M.inner, 1, true);
  }
  function hoodFront(c, b, M, k) {
    var d = c.shape(b, [
      [-0.8, 5.7, 1], [-0.72, 2.3], [-0.78, 1.45], [-0.84, 0.6], [-0.8, 0.0], [-0.72, -0.6, 1], [-0.42, -0.75], [-0.05, -0.78], [0.25, -0.7],
      [0.4, -0.42], [0.47, 0.0], [0.52, 0.45], [0.55, 0.9], [0.64, 1.4], [0.74, 2.3], [0.7, 5.7, 1],
      [2.1 * k, 5.7, 1], [2.07 * k, 2.6], [1.98 * k, 1.9], [1.62 * k, 1.52], [1.14, 1.26], [1.04, 0.7], [1.05, 0.05], [0.98, -0.55], [0.73, -0.98],
      [0.25, -1.17], [-0.3, -1.13], [-0.73, -0.84], [-0.89, -0.3], [-0.94, 0.45], [-1.0, 1.1], [-1.32 * k, 1.44], [-1.7 * k, 1.62], [-1.86 * k, 1.98],
      [-1.92 * k, 2.6], [-1.96 * k, 5.7, 1]
    ], M.cloth, 1, true);
    c.inside(d);
    // Hood interior: a narrow band along the face opening.
    c.shape(b, [[-0.72, -0.6], [-0.42, -0.75], [-0.05, -0.78], [0.25, -0.7], [0.4, -0.42], [0.47, 0.0], [0.52, 0.45], [0.55, 0.9], [0.64, 1.4],
      [0.71, 1.4], [0.62, 0.9], [0.59, 0.45], [0.54, 0.0], [0.47, -0.46], [0.29, -0.78], [-0.05, -0.85], [-0.44, -0.82], [-0.78, -0.64]], M.inner, 0.55);
    // Shade on the right half; light on the crown; folds.
    c.shape(b, [[0.64, -0.3], [1.15, -0.6], [2.5, 1.7], [2.5, 5.8], [1.35, 5.8], [1.1, 3.0], [0.86, 1.7]], SH, 0.14);
    c.shape(b, [[-0.62, -0.96], [-0.1, -1.13], [0.5, -1.02], [0.3, -0.88], [-0.2, -0.92]], HI, 0.3);
    leaf(c, b, [1.2, 1.45], [1.34 * k, 2.3], [1.36 * k, 3.6], 0.1, M.dark, 0.9);
    leaf(c, b, [1.62 * k, 1.75], [1.74 * k, 2.7], [1.74 * k, 3.8], 0.09, M.dark, 0.9);
    leaf(c, b, [-1.38 * k, 1.7], [-1.48 * k, 2.5], [-1.5 * k, 3.6], 0.09, M.dark, 0.9);
    leaf(c, b, [-1.02, 1.42], [-1.1, 2.1], [-1.1, 3.0], 0.08, M.dark, 0.8);
    leaf(c, b, [0.75, -0.92], [0.97, -0.4], [1.0, 0.3], 0.08, M.dark, 0.7);
    // Two dark bands across the hanging panels.
    if (M.band) {
      c.shape(b, [[-2.3, 2.62], [-1.3, 2.7], [0, 2.6], [1.4, 2.72], [2.4, 2.64], [2.4, 2.86], [1.4, 2.94], [0, 2.82], [-1.3, 2.92], [-2.3, 2.84]], M.band, 0.92);
      c.shape(b, [[-2.3, 3.04], [-1.3, 3.12], [0, 3.02], [1.4, 3.14], [2.4, 3.06], [2.4, 3.14], [1.4, 3.22], [0, 3.1], [-1.3, 3.2], [-2.3, 3.12]], M.band, 0.92);
    }
    c.end();
    return d;
  }

  // Cloth wrapped around the head (townsmen): a tail behind the ear, the crown cap, folds.
  function headcloth(c, f, h) {
    c.shape(f, [[0.7, -0.4], [0.98, -0.25], [1.06, 0.4], [1.0, 1.1], [0.84, 1.3], [0.74, 0.8], [0.76, 0.2]], mix(h.color, SH, 0.25), 1, true);
    var lo = h.low || 0;
    var d = c.shape(f, [[-0.73, -0.3 + lo, 1], [-0.78, -0.7], [-0.54, -1.06], [0.0, -1.2], [0.55, -1.1], [0.88, -0.8], [0.95, -0.36], [0.84, -0.08], [0.62, -0.05],
      [0.5, -0.36 + lo], [0.25, -0.5 + lo], [-0.1, -0.56 + lo], [-0.48, -0.5 + lo]], h.color, 1, true);
    c.inside(d);
    c.shape(f, [[0.3, -1.4], [1.2, -1.2], [1.2, 0.2], [0.5, 0.0], [0.4, -0.6]], SH, 0.22);
    c.shape(f, [[-0.8, -0.62], [-0.45, -1.0], [0.1, -1.16], [0.0, -0.98], [-0.5, -0.78]], HI, 0.18);
    leaf(c, f, [-0.74, -0.58 + lo], [-0.1, -0.74 + lo], [0.86, -0.52], 0.09, mix(h.color, SH, 0.4), 0.8);
    leaf(c, f, [-0.62, -0.88], [0.0, -1.02], [0.82, -0.86], 0.06, mix(h.color, SH, 0.4), 0.7);
    c.end();
    return d;
  }

  // Simple hand as a rounded mitt with finger seams, in a hand-local frame.
  function mitt(c, h, pts, seams, skin) {
    var d = c.shape(h, pts, skin, 1, true);
    for (var i = 0; i < seams.length; i++) c.line(h, seams[i], SH, h.s * 0.014, 0.35);
    return d;
  }

  // ---------------------------------------------------------------- characters

  var draw = {};

  // Menahem: scribe of Capernaum, about 50. Cream mantle with dark bands drawn over his
  // head, a tassel on the corner thrown over his shoulder, gray-streaked beard, a small
  // scroll held to his chest, ink-darkened fingertips. Sincere and careful.
  draw.menahem = function (c) {
    var o = withFace({ skin: "#a6744f", lip: "#86493a", brow: "#3e3630", age: 1, open: 0.88, browIn: 0.022, gaze: -0.2, nose: 1.04, hollow: 0.4, jaw: 1.02 });
    var f = frame(290, 226, 122, -0.02), b = frame(290, 226, 122, 0);
    var M = { cloth: "#dcd1b6", dark: "#b6a88a", inner: "#8d806a", band: "#363a47" };
    neck(c, f, o.skin, 1.05);
    tunic(c, b, "#93703f", 1, 0.6);
    hoodBack(c, b, M);
    head(c, f, o);
    // Hair at the far temple and along the forehead, gray at the temple.
    c.shape(f, [[-0.72, -0.6], [-0.45, -0.76], [-0.05, -0.79], [0.22, -0.7], [0.12, -0.63], [-0.2, -0.67], [-0.5, -0.61], [-0.63, -0.42], [-0.67, -0.12, 1], [-0.75, -0.25]], "#463e37");
    leaf(c, f, [-0.71, -0.3], [-0.66, -0.5], [-0.5, -0.66], 0.05, "#aaa398", 0.9);
    leaf(c, f, [-0.4, -0.7], [-0.2, -0.73], [0.05, -0.74], 0.03, "#aaa398", 0.6);
    beard(c, f, { color: "#5a5047", e: 0.04, len: 0.36, hi: "#b3ac9f", locks: [
      [[-0.64, 0.42], [-0.6, 0.72], [-0.5, 1.02], 0.07, 0.75], [[-0.4, 0.8], [-0.36, 1.08], [-0.26, 1.36], 0.07, 0.8], [[-0.16, 0.86], [-0.12, 1.14], [-0.1, 1.4], 0.06, 0.65],
      [[0.04, 0.82], [0.06, 1.06], [0.02, 1.3], 0.06, 0.55], [[0.22, 0.66], [0.26, 0.9], [0.2, 1.12], 0.06, 0.5], [[-0.5, 0.5], [-0.46, 0.66], [-0.4, 0.8], 0.05, 0.6],
      [[-0.42, 0.53], [-0.3, 0.5], [-0.16, 0.53], 0.03, 0.7]
    ] });
    mouth(c, f, o, true);
    hoodFront(c, b, M, 1);
    // Corner thrown over the near shoulder; its tassel (one cord blue) hangs behind.
    c.shape(b, [[1.5, 1.42], [1.98, 1.52], [2.2, 1.78], [2.16, 2.12, 1], [1.82, 1.9], [1.56, 1.66]], mix(M.cloth, SH, 0.1), 1, true);
    c.circle(b(2.16, 2.16), b.s * 0.05, "#cdbfa0");
    leaf(c, b, [2.12, 2.18], [2.1, 2.45], [2.08, 2.8], 0.05, "#e7ddc5");
    leaf(c, b, [2.17, 2.18], [2.19, 2.47], [2.2, 2.84], 0.045, "#3e5d8a");
    leaf(c, b, [2.2, 2.18], [2.25, 2.44], [2.29, 2.76], 0.05, "#e7ddc5");
    c.sil.push(sm(b, [[2.04, 2.1], [2.3, 2.1], [2.32, 2.84], [2.06, 2.82]]));
    // Small scroll held to the chest; the fist grips its lower end, thumb over the top.
    var q = b(-0.74, 2.72), h = frame(q[0], q[1], 122, -0.5), skin = mix(o.skin, SH, 0.06);
    c.shape(h, [[-0.3, -0.1, 1], [1.1, -0.1, 1], [1.1, 0.1, 1], [-0.3, 0.1, 1]], "#d5c096", 1, true);
    c.shape(h, [[-0.3, -0.1, 1], [1.1, -0.1, 1], [1.1, -0.04, 1], [-0.3, -0.04, 1]], HI, 0.4);
    c.shape(h, [[-0.3, 0.05, 1], [1.1, 0.05, 1], [1.1, 0.1, 1], [-0.3, 0.1, 1]], SH, 0.2);
    c.shape(h, [[1.08, -0.1], [1.15, 0], [1.08, 0.1], [1.03, 0]], "#ecdcb5", 1, true);
    c.shape(h, [[-0.45, 0.12], [-0.2, 0.04], [-0.12, 0.3], [-0.4, 0.46]], mix("#93703f", SH, 0.2), 1, true);
    mitt(c, h, [[-0.22, -0.1], [-0.02, -0.16], [0.17, -0.14], [0.22, 0.03], [0.2, 0.2], [0.0, 0.25], [-0.17, 0.22], [-0.25, 0.06]],
      [[[-0.1, 0.0], [-0.1, 0.2]], [[0.0, 0.0], [0.0, 0.22]], [[0.1, 0.0], [0.1, 0.2]]], skin);
    leaf(c, h, [-0.2, -0.08], [-0.02, -0.17], [0.16, -0.12], 0.07, mix(skin, HI, 0.12));
    c.shape(h, [[0.1, -0.15], [0.16, -0.16], [0.19, -0.11], [0.13, -0.1]], "#262b38", 0.75);
    c.shape(h, [[0.12, 0.13], [0.19, 0.12], [0.2, 0.19], [0.13, 0.2]], "#262b38", 0.7);
    c.shape(h, [[0.02, 0.15], [0.08, 0.15], [0.08, 0.21], [0.02, 0.21]], "#262b38", 0.55);
    c.shape(h, [[-0.25, 0.1], [0.22, 0.1], [0.2, 0.2], [0.0, 0.25], [-0.17, 0.22]], SH, 0.18);
  };

  // Hanan: Menahem's student, 17. Barely a beard, bright curious eyes, a wax tablet held
  // up in one hand and a stylus in the other. Undyed tunic, olive mantle over one shoulder.
  draw.hanan = function (c) {
    var o = withFace({ skin: "#b4835b", lip: "#9b5443", brow: "#2a1e17", jaw: 0.95, chin: 0.96, round: 0.18, open: 1.08, gaze: -0.16, browUp: 0.035,
      browIn: 0.02, browT: 0.85, arch: 1.25, smile: 0.3, part: 0.3, blush: 1, eye: 1.06 });
    var f = frame(294, 238, 116, -0.03), b = frame(300, 238, 116, 0);
    neck(c, f, o.skin, 0.95);
    tunic(c, b, "#d2c4a3", 0.95, 1);
    // Olive mantle over the far shoulder, falling across the front.
    var man = c.shape(b, [[-0.42, 1.34], [-1.28, 1.48], [-1.64, 1.86], [-1.76, 2.6], [-1.8, 5.7, 1], [2.0, 5.7, 1], [1.98, 4.3], [1.1, 3.75], [0.3, 2.9], [-0.18, 2.0]], "#6c7744", 1, true);
    c.inside(man);
    c.shape(b, [[-0.42, 1.34], [-0.18, 2.0], [0.3, 2.9], [1.1, 3.75], [1.98, 4.3], [1.98, 4.5], [1.0, 3.95], [0.16, 3.05], [-0.32, 2.1], [-0.56, 1.4]], "#86915a");
    leaf(c, b, [-1.2, 1.7], [-1.3, 2.7], [-1.3, 4.2], 0.1, "#4f5730", 0.9);
    leaf(c, b, [-0.6, 2.4], [-0.5, 3.4], [-0.3, 4.6], 0.09, "#4f5730", 0.8);
    c.shape(b, [[-1.0, 1.4], [-1.7, 1.86], [-1.5, 2.0], [-0.9, 1.6]], HI, 0.16);
    c.end();
    head(c, f, o);
    beard(c, f, { stubble: 0.09 });
    mouth(c, f, o, false);
    hair(c, f, { color: "#241a14", line: 0.03, bump: 0.05, n: 7, vol: 1.05, side: 0.2,
      fringe: [[-0.5, -0.52], [-0.32, -0.62], [-0.12, -0.56]],
      locks: [[[-0.6, -0.7], [-0.3, -0.92], [0.1, -1.0], 0.05, 0.18], [[-0.2, -0.66], [0.1, -0.8], [0.4, -0.86], 0.04, 0.14]] });
    // Wax tablet, tilted, wood frame around dark wax with a few scratched strokes.
    var t = frame(b(0.05, 2.5)[0], b(0.05, 2.5)[1], 116, -0.1);
    c.shape(t, [[-0.66, -0.42, 1], [0.66, -0.42, 1], [0.66, 0.42, 1], [-0.66, 0.42, 1]], "#9c7348", 1, true);
    c.shape(t, [[-0.57, -0.33, 1], [0.57, -0.33, 1], [0.57, 0.33, 1], [-0.57, 0.33, 1]], "#3c3127");
    c.shape(t, [[-0.66, -0.42, 1], [0.66, -0.42, 1], [0.66, -0.36, 1], [-0.66, -0.36, 1]], HI, 0.3);
    c.line(t, [[-0.46, -0.18], [-0.3, -0.21], [-0.12, -0.17], [0.1, -0.2]], "#74624d", t.s * 0.014, 0.8);
    c.line(t, [[-0.46, -0.04], [-0.22, -0.07], [0.0, -0.03], [0.3, -0.06]], "#74624d", t.s * 0.014, 0.8);
    c.line(t, [[-0.46, 0.1], [-0.3, 0.08], [-0.1, 0.11]], "#74624d", t.s * 0.014, 0.8);
    var skin = mix(o.skin, SH, 0.05);
    // Near hand holds the right edge, fingers over the front.
    mitt(c, t, [[0.44, -0.28], [0.62, -0.36], [0.82, -0.3], [0.86, 0.2], [0.7, 0.36], [0.48, 0.3], [0.42, 0.12], [0.44, -0.08]],
      [[[0.47, -0.12], [0.62, -0.12]], [[0.46, 0.04], [0.62, 0.04]], [[0.46, 0.18], [0.62, 0.19]]], skin);
    c.shape(t, [[0.66, -0.4], [0.88, -0.3], [0.88, 0.3], [0.66, 0.4]], SH, 0.16);
    // Far hand pinches a bone stylus resting on the wax.
    leaf(c, t, [-0.42, 0.2], [-0.3, 0.02], [-0.14, -0.18], 0.035, "#e2d3b0");
    mitt(c, t, [[-0.54, 0.16], [-0.38, 0.1], [-0.3, 0.22], [-0.34, 0.46], [-0.5, 0.56], [-0.62, 0.4]], [[[-0.5, 0.26], [-0.38, 0.24]]], skin);
  };

  // Yonah: fisherman, about 24. Sun-darkened, short beard, sturdy, warm smile, sleeves
  // pushed up on a bare arm, a coil of rope over his far shoulder. Faded indigo tunic.
  draw.yonah = function (c) {
    var o = withFace({ skin: "#8b5a3a", lip: "#743e2d", brow: "#1d1611", jaw: 1.1, chin: 1.0, round: 0.05, open: 0.92, gaze: -0.16, crinkle: 0.8, smile: 0.7,
      browT: 1.18, arch: 0.8, browIn: 0.008, blush: 0.4 });
    var f = frame(300, 230, 124, -0.015), b = frame(306, 230, 124, 0);
    neck(c, f, o.skin, 1.2);
    tunic(c, b, "#3d5b74", 1.08, 0.9);
    // Near arm: sleeve bunched above the elbow, bare forearm below.
    var arm = c.shape(b, [[1.6, 2.2], [2.16, 2.24], [2.22, 3.4], [2.26, 5.7, 1], [1.58, 5.7, 1], [1.56, 3.3]], o.skin, 1, true);
    c.inside(arm);
    c.shape(b, [[1.98, 2.2], [2.4, 2.2], [2.4, 5.8], [2.04, 5.8]], SH, 0.24);
    leaf(c, b, [1.66, 3.0], [1.74, 3.6], [1.72, 4.4], 0.06, SH, 0.2);
    c.end();
    c.shape(b, [[1.48, 1.95], [1.98, 1.84], [2.26, 2.1], [2.28, 2.5], [1.94, 2.62], [1.56, 2.6]], "#4a6a84", 1, true);
    leaf(c, b, [1.6, 2.22], [1.9, 2.18], [2.22, 2.3], 0.06, "#2c4458", 0.9);
    leaf(c, b, [1.62, 2.44], [1.92, 2.4], [2.2, 2.46], 0.05, "#2c4458", 0.8);
    head(c, f, o);
    beard(c, f, { color: "#1f1813", e: 0.02, len: -0.04, hi: "#5b4a3d", locks: [[[-0.5, 0.62], [-0.44, 0.8], [-0.34, 0.94], 0.04, 0.4], [[0.1, 0.7], [0.14, 0.84], [0.1, 0.96], 0.04, 0.3]] });
    mouth(c, f, o, true);
    hair(c, f, { color: "#1e1712", bump: 0.07, n: 10, line: 0.05, vol: 1.0, side: 0.12, hi: "#6b5646",
      locks: [[[-0.55, -0.8], [-0.3, -0.98], [0.0, -1.06], 0.05, 0.3]] });
    // Rope coil over the far shoulder, twisted strands marked along the ring.
    var rc = b(-1.2, 2.56), r = frame(rc[0], rc[1], 124, 0.22);
    var outer = curve(mapPts(r, ellPts(0, 0, 0.66, 0.98, 16)), true), inner = curve(mapPts(r, ellPts(0, 0, 0.44, 0.76, 16)), true);
    c.fill(outer + inner, "#b39462", 1, false, ' fill-rule="evenodd"');
    c.sil.push(outer);
    c.inside(outer + inner);
    c.add('<path d="' + outer + inner + '" fill="none" stroke="#6f5636" stroke-width="3" stroke-dasharray="6 9" opacity=".6" clip-rule="evenodd"/>');
    c.shape(r, [[0.1, -1.2], [1.0, -0.4], [0.9, 1.2], [-0.3, 1.2]], SH, 0.2);
    c.shape(r, [[-0.8, -0.6], [-0.2, -1.1], [-0.1, -0.85], [-0.6, -0.4]], HI, 0.25);
    c.end();
    c.fill(curve(mapPts(r, ellPts(0, 0, 0.55, 0.87, 16)), true), "none", 1, false, ' stroke="#7d6440" stroke-width="2" opacity=".45"');
  };

  // Asher's face, shared by both poses: about 24, thinner, wry, guarded but kind eyes.
  function asherFace(x) {
    var o = withFace({ skin: "#a87b5c", lip: "#8a5141", brow: "#241b16", jaw: 0.94, chin: 1.0, hollow: 1, open: 0.8, gaze: -0.12, wry: 0.7,
      smile: 0.16, browIn: 0.012, browT: 0.95, arch: 0.9, tired: 0.3 });
    for (var k in x) o[k] = x[k];
    return o;
  }
  function asherHead(c, f, o) {
    head(c, f, o);
    beard(c, f, { color: "#2b211b", e: -0.01, len: -0.03, hi: "#5d4c40", locks: [[[-0.55, 0.5], [-0.5, 0.7], [-0.4, 0.86], 0.04, 0.35], [[0.2, 0.5], [0.24, 0.66], [0.2, 0.84], 0.04, 0.3]] });
    mouth(c, f, o, true);
    hair(c, f, { color: "#251b16", vol: 1.04, bump: 0.05, n: 8, line: 0.0, side: 0.24, hi: "#6a5444",
      fringe: [[-0.5, -0.5], [-0.34, -0.56], [-0.08, -0.6]],
      locks: [[[-0.6, -0.76], [-0.3, -0.95], [0.05, -1.02], 0.05, 0.25], [[-0.46, -0.5], [-0.3, -0.62], [-0.1, -0.7], 0.04, 0.2]] });
  }

  // Lying: on his bed (a light frame with a mat), seen from the foot end and slightly above,
  // head and shoulders on a rolled pillow, the worn brown cloak pulled up to his chest.
  function asherLying(c) {
    var o = asherFace({ open: 0.78, gaze: -0.08 });
    var WOOD = "#5a4231", MAT = "#a68d63";
    c.fill(sm(V, [[150, 262, 1], [450, 262, 1], [562, 905, 1], [38, 905, 1]]), MAT, 1, true);
    var mat = "M150 262L450 262L562 905L38 905Z";
    c.inside(mat);
    var weave = "";
    for (var i = 0; i < 16; i++) { var y = 262 + Math.pow(i / 15, 1.25) * 640; weave += "M0 " + Math.round(y) + "H600"; }
    c.add('<path d="' + weave + '" stroke="#7e6845" stroke-width="3" opacity=".45"/>');
    c.shape(V, [[300, 250], [600, 250], [600, 905], [330, 905]], SH, 0.12);
    c.end();
    c.fill("M128 250H150L50 905H22Z", WOOD, 1, true);
    c.fill("M450 250H472L578 905H550Z", WOOD, 1, true);
    c.fill("M120 244H480V264H120Z", mix(WOOD, HI, 0.08), 1, true);
    // Rolled pillow behind the head.
    var pil = c.shape(V, [[178, 250], [422, 250], [436, 296], [422, 342], [178, 342], [164, 296]], "#cfc2a2", 1, true);
    c.inside(pil);
    c.shape(V, [[150, 314], [450, 314], [450, 350], [150, 350]], SH, 0.18);
    c.shape(V, [[150, 252], [450, 252], [450, 266], [150, 266]], HI, 0.3);
    c.add('<path d="M196 250v94M210 250v94M390 250v94M404 250v94" stroke="#7d5c45" stroke-width="7" opacity=".8"/>');
    c.end();
    var f = frame(300, 322, 104, -0.1), b = frame(304, 322, 104, 0);
    neck(c, f, o.skin, 0.9);
    tunic(c, b, "#93604b", 0.95, 0.9);
    asherHead(c, f, o);
    // The cloak, pulled up over the body, its turned-down edge lighter and worn.
    var CL = "#6b4f3b";
    var cl = c.shape(b, [[-2.42, 5.8, 1], [-2.22, 2.2], [-2.0, 1.86], [-1.0, 1.72], [0.2, 1.8], [1.3, 1.72], [2.2, 1.9], [2.46, 2.3], [2.6, 5.8, 1]], CL, 1, true);
    c.inside(cl);
    c.shape(b, [[-2.3, 1.9], [-1.0, 1.72], [0.2, 1.8], [1.3, 1.72], [2.4, 1.92], [2.4, 2.18], [1.3, 2.0], [0.2, 2.08], [-1.0, 2.0], [-2.3, 2.16]], "#866650");
    c.shape(b, [[0.9, 1.6], [2.8, 1.6], [2.8, 5.9], [1.4, 5.9], [1.1, 3.6]], SH, 0.18);
    leaf(c, b, [-1.6, 2.3], [-1.75, 3.4], [-1.9, 5.0], 0.12, "#4e392b", 0.9);
    leaf(c, b, [-0.6, 2.3], [-0.72, 3.6], [-0.8, 5.4], 0.1, "#4e392b", 0.8);
    leaf(c, b, [0.6, 2.4], [0.7, 3.6], [0.66, 5.4], 0.1, "#4e392b", 0.8);
    leaf(c, b, [1.7, 2.3], [1.86, 3.4], [2.0, 5.0], 0.12, "#4e392b", 0.9);
    c.shape(b, [[-1.36, 3.0], [-0.92, 2.94], [-0.88, 3.46], [-1.32, 3.52]], "#5c4535");
    c.add('<path d="' + sm(b, [[-1.36, 3.0, 1], [-0.92, 2.94, 1], [-0.88, 3.46, 1], [-1.32, 3.52, 1]]) + '" fill="none" stroke="#a1825f" stroke-width="2" stroke-dasharray="4 6" opacity=".7"/>');
    c.end();
    // His near hand rests on the cloak.
    var hc = b(0.95, 2.45), h = frame(hc[0], hc[1], 104, 0.15), skin = mix(o.skin, SH, 0.05);
    c.shape(h, [[-0.3, -0.42], [-0.06, -0.5], [0.0, -0.28], [-0.14, -0.1], [-0.34, -0.16]], mix("#93604b", SH, 0.1), 1, true);
    mitt(c, h, [[-0.3, -0.2], [-0.08, -0.26], [0.18, -0.16], [0.36, 0.0], [0.36, 0.1], [0.12, 0.12], [-0.14, 0.1], [-0.3, 0.0]],
      [[[0.12, -0.02], [0.34, 0.04]], [[0.1, 0.05], [0.32, 0.09]]], skin);
    c.shape(h, [[-0.3, 0.0], [0.36, 0.06], [0.36, 0.12], [-0.14, 0.12]], SH, 0.2);
  }

  // Standing: upright for the first time, the same face, the cloak folded over one arm.
  function asherStanding(c) {
    var o = asherFace({ open: 0.88, smile: 0.24, wry: 0.45, gaze: -0.14 });
    var f = frame(298, 226, 118, -0.02), b = frame(302, 226, 118, 0);
    neck(c, f, o.skin, 0.9);
    tunic(c, b, "#93604b", 0.92, 0.9);
    asherHead(c, f, o);
    // Folded cloak over the near forearm, hanging in front; his hand shows at the end.
    var skin = mix(o.skin, SH, 0.05);
    var hc = b(0.02, 2.86), h = frame(hc[0], hc[1], 118, -0.06);
    mitt(c, h, [[-0.3, -0.12], [-0.08, -0.18], [0.1, -0.12], [0.12, 0.1], [-0.06, 0.2], [-0.28, 0.16], [-0.36, 0.02]],
      [[[-0.22, -0.02], [-0.04, 0.02]], [[-0.22, 0.08], [-0.04, 0.1]]], skin);
    var CL = "#6b4f3b";
    var cl = c.shape(b, [[0.06, 2.62], [0.6, 2.5], [1.3, 2.56], [1.86, 2.7], [1.98, 3.2], [1.92, 5.8, 1], [0.3, 5.8, 1], [0.24, 3.6], [0.0, 3.0]], CL, 1, true);
    c.inside(cl);
    c.shape(b, [[0.06, 2.62], [0.6, 2.5], [1.3, 2.56], [1.86, 2.7], [1.9, 2.92], [1.3, 2.8], [0.6, 2.76], [0.1, 2.86]], "#866650");
    c.shape(b, [[1.2, 2.4], [2.2, 2.4], [2.2, 5.9], [1.4, 5.9]], SH, 0.2);
    leaf(c, b, [0.5, 2.9], [0.56, 4.0], [0.5, 5.6], 0.12, "#4e392b", 0.9);
    leaf(c, b, [1.1, 2.9], [1.2, 4.2], [1.16, 5.6], 0.12, "#4e392b", 0.85);
    leaf(c, b, [1.6, 3.0], [1.7, 4.0], [1.66, 5.6], 0.1, "#4e392b", 0.8);
    c.end();
  }

  draw.asher = function (c, opts) {
    if (opts && opts.pose === "standing") asherStanding(c);
    else asherLying(c);
  };

  // Asher's mother: head covering, tired and tender, a clay water jar held at her side.
  draw.mother = function (c) {
    var o = withFace({ skin: "#9f6d4b", lip: "#87493b", brow: "#2a201b", jaw: 0.9, chin: 0.95, round: 0.2, open: 0.8, gaze: -0.14, tired: 0.9,
      browIn: 0.03, browT: 0.75, arch: 1.1, smile: 0.2, lash: 1.15, age: 0.4, blush: 0.5 });
    var f = frame(296, 248, 112, -0.07), b = frame(300, 248, 112, 0);
    var VE = "#6d4a58", VD = "#4f3441";
    // Veil behind the head.
    c.shape(b, [[-0.34, -1.12], [0.3, -1.16], [0.8, -0.95], [1.06, -0.5], [1.14, 0.2], [1.1, 0.8], [0.6, 1.0], [-0.7, 0.7], [-0.9, -0.3], [-0.76, -0.86]], VD, 1, true);
    neck(c, f, o.skin, 0.88);
    tunic(c, b, "#86705a", 0.9, 0.8);
    head(c, f, o);
    mouth(c, f, o, false);
    // Hair under the wrap: dark, one gray strand at the far temple.
    c.shape(f, [[-0.72, -0.58], [-0.4, -0.72], [0.1, -0.72], [0.3, -0.6], [0.36, -0.3], [0.2, -0.5], [-0.2, -0.6], [-0.56, -0.52], [-0.665, -0.2, 1], [-0.74, -0.3]], "#2b211b");
    leaf(c, f, [-0.7, -0.3], [-0.64, -0.46], [-0.48, -0.58], 0.04, "#958a7e", 0.85);
    // Undyed inner wrap across the forehead.
    c.shape(f, [[-0.8, -0.62], [-0.4, -0.78], [0.1, -0.8], [0.48, -0.66], [0.5, -0.86], [0.1, -1.0], [-0.4, -0.98], [-0.82, -0.8]], "#cdbf9f");
    c.shape(f, [[-0.8, -0.62], [-0.4, -0.78], [0.1, -0.8], [0.48, -0.66], [0.48, -0.7], [0.1, -0.85], [-0.4, -0.83], [-0.8, -0.67]], SH, 0.18);
    // Veil front: over the crown, down both sides of the face, over the shoulders.
    var vd = c.shape(b, [
      [-0.9, 5.7, 1], [-0.86, 2.6], [-0.78, 1.7], [-0.86, 0.9], [-0.86, 0.1], [-0.76, -0.66, 1], [-0.44, -0.84], [0.0, -0.9], [0.4, -0.78], [0.52, -0.5],
      [0.5, 0.0], [0.52, 0.6], [0.6, 1.2], [0.86, 1.7], [1.0, 2.6], [1.0, 5.7, 1], [2.0, 5.7, 1], [1.98, 2.6], [1.86, 1.84], [1.5, 1.5], [1.16, 1.2],
      [1.1, 0.5], [1.12, -0.1], [1.02, -0.66], [0.72, -1.04], [0.2, -1.22], [-0.36, -1.18], [-0.8, -0.92], [-0.98, -0.3], [-1.0, 0.5], [-1.08, 1.2],
      [-1.4, 1.52], [-1.64, 1.9], [-1.74, 2.6], [-1.78, 5.7, 1]
    ], VE, 1, true);
    c.inside(vd);
    c.shape(b, [[-0.76, -0.66], [-0.44, -0.84], [0.0, -0.9], [0.4, -0.78], [0.52, -0.5], [0.5, 0.0], [0.52, 0.6], [0.6, 1.2], [0.86, 1.7],
      [0.96, 1.66], [0.7, 1.2], [0.62, 0.6], [0.6, 0.0], [0.62, -0.5], [0.46, -0.88], [0.0, -0.98], [-0.46, -0.92], [-0.82, -0.7]], VD, 0.7);
    c.shape(b, [[0.66, -0.3], [1.2, -0.6], [2.4, 1.7], [2.4, 5.8], [1.5, 5.8], [1.2, 3.0], [0.9, 1.7]], SH, 0.18);
    c.shape(b, [[-0.66, -1.0], [-0.1, -1.18], [0.5, -1.06], [0.3, -0.94], [-0.2, -0.98]], HI, 0.2);
    leaf(c, b, [0.8, -0.95], [1.0, -0.4], [1.04, 0.4], 0.08, VD, 0.8);
    leaf(c, b, [-1.2, 1.6], [-1.36, 2.6], [-1.4, 3.8], 0.1, VD, 0.85);
    leaf(c, b, [1.3, 1.6], [1.5, 2.4], [1.56, 3.6], 0.1, VD, 0.85);
    c.end();
    // Clay water jar held against her side, her hand over its shoulder.
    var jc = b(1.42, 3.0), j = frame(jc[0], jc[1], 112, 0.08);
    var jar = c.shape(j, [[-0.17, -0.9, 1], [0.17, -0.9, 1], [0.15, -0.66], [0.48, -0.5], [0.58, -0.1], [0.52, 0.4], [0.3, 0.8], [0.0, 0.92], [-0.3, 0.8], [-0.52, 0.4], [-0.58, -0.1], [-0.48, -0.5], [-0.15, -0.66]], "#a6603c", 1, true);
    c.inside(jar);
    c.shape(j, [[0.1, -0.9], [0.8, -0.6], [0.8, 1.0], [0.0, 1.0], [0.24, 0.2]], SH, 0.26);
    c.shape(j, [[-0.46, -0.44], [-0.2, -0.56], [-0.28, -0.1], [-0.5, 0.1]], HI, 0.22);
    c.add('<path d="' + curve(mapPts(j, [[-0.56, -0.2], [0.0, -0.12], [0.56, -0.2]]), false) + '" fill="none" stroke="#6e3a22" stroke-width="3" opacity=".5"/>');
    c.end();
    c.shape(j, [[-0.22, -0.96, 1], [0.22, -0.96, 1], [0.22, -0.86, 1], [-0.22, -0.86, 1]], "#b97350", 1, true);
    var skin = mix(o.skin, SH, 0.05);
    mitt(c, j, [[-0.62, -0.52], [-0.36, -0.62], [-0.12, -0.56], [-0.04, -0.36], [-0.2, -0.26], [-0.48, -0.24], [-0.66, -0.34]],
      [[[-0.3, -0.5], [-0.12, -0.42]], [[-0.34, -0.42], [-0.14, -0.34]]], skin);
  };

  // Asher's little brother: about 10, tousled hair, lively grin.
  draw.brother = function (c) {
    var o = withFace({ skin: "#ad7650", lip: "#9b5644", brow: "#2a1f18", jaw: 0.86, chin: 0.9, round: 0.45, open: 1.12, gaze: -0.2, browUp: 0.04,
      browIn: 0.012, browT: 0.8, arch: 1.2, smile: 0.85, part: 0.7, eye: 1.14, blush: 1.2, nose: 0.88, mouthW: 0.95 });
    var f = frame(312, 352, 100, 0.07), b = frame(314, 352, 100, 0);
    neck(c, f, o.skin, 0.85);
    tunic(c, b, "#ad8a50", 0.82, 0.9);
    head(c, f, o);
    mouth(c, f, o, false);
    hair(c, f, { color: "#2a1f18", spiky: true, bump: 0.13, n: 9, vol: 1.06, line: -0.02, side: 0.14, hi: "#7a604a",
      fringe: [[-0.54, -0.44, 1], [-0.36, -0.6], [-0.2, -0.46, 1]],
      locks: [[[-0.6, -0.7], [-0.3, -0.96], [0.1, -1.04], 0.05, 0.3]] });
  };

  // Neighbor: an ordinary townsman, middle-aged, bringing news; head cloth, gray in the beard.
  draw.neighbor = function (c) {
    var o = withFace({ skin: "#9b6a45", lip: "#80463a", brow: "#2b231e", jaw: 1.06, round: 0.3, open: 1.04, gaze: -0.18, browUp: 0.045,
      browIn: 0.026, part: 0.5, smile: 0.05, age: 0.6, nose: 1.08 });
    var f = frame(296, 236, 120, -0.02), b = frame(302, 236, 120, 0);
    neck(c, f, o.skin, 1.1);
    tunic(c, b, "#7a5c44", 1.05, 0.8);
    // Gray-brown mantle over both shoulders, open in front.
    var mn = c.shape(b, [[-1.95, 5.7, 1], [-1.9, 2.6], [-1.76, 1.86], [-1.3, 1.46], [-0.56, 1.3], [-0.5, 1.6], [-0.7, 2.6], [-0.6, 5.7, 1],
      [0.8, 5.7, 1], [0.86, 2.6], [0.62, 1.56], [0.58, 1.26], [1.42, 1.4], [2.0, 1.76], [2.12, 2.6], [2.16, 5.7, 1]], "#8a7f70", 1, true);
    c.inside(mn);
    c.shape(b, [[0.6, 1.2], [2.4, 1.5], [2.4, 5.8], [1.3, 5.8], [1.1, 3.0]], SH, 0.16);
    leaf(c, b, [-1.3, 1.8], [-1.4, 2.8], [-1.42, 4.2], 0.1, "#6a6155", 0.9);
    leaf(c, b, [1.4, 1.8], [1.56, 2.8], [1.6, 4.2], 0.1, "#6a6155", 0.9);
    c.shape(b, [[-1.7, 1.9], [-1.2, 1.5], [-0.6, 1.36], [-0.9, 1.6], [-1.4, 1.9]], HI, 0.16);
    c.end();
    head(c, f, o);
    hair(c, f, { color: "#2c241e", line: 0.0, side: 0.18 });
    beard(c, f, { color: "#2e2620", e: 0.04, len: 0.08, hi: "#9b948a", locks: [[[-0.6, 0.5], [-0.56, 0.72], [-0.46, 0.92], 0.05, 0.6], [[-0.3, 0.8], [-0.26, 1.0], [-0.2, 1.12], 0.04, 0.5], [[0.16, 0.66], [0.2, 0.86], [0.14, 1.02], 0.04, 0.4]] });
    mouth(c, f, o, true);
    headcloth(c, f, { color: "#c4b28c" });
  };

  // Passerby: an ordinary person in the lane, a little in shadow, glancing sideways while
  // muttering. Still human and plain, never villainous.
  draw.passerby = function (c) {
    var o = withFace({ skin: "#8e6446", lip: "#76443a", brow: "#262019", open: 0.84, gaze: -0.42, browIn: -0.01, smile: -0.3, part: 0.12, age: 0.5, sclera: "#c7b9a0" });
    var f = frame(300, 240, 118, -0.03), b = frame(304, 240, 118, 0);
    var CL = "#5d554a";
    c.shape(b, [[-0.36, -1.1], [0.3, -1.15], [0.78, -0.94], [1.02, -0.5], [1.08, 0.2], [1.04, 0.8], [0.6, 1.0], [-0.7, 0.7], [-0.88, -0.3], [-0.76, -0.84]], mix(CL, SH, 0.4), 1, true);
    neck(c, f, o.skin, 1.0);
    tunic(c, b, "#6b5b49", 1.0, 0.8);
    head(c, f, o);
    beard(c, f, { color: "#3a3029", e: 0.0, len: 0.0, hi: "#8a8076", locks: [[[-0.56, 0.5], [-0.5, 0.7], [-0.4, 0.88], 0.04, 0.4]] });
    mouth(c, f, o, true);
    // Head cloth pulled forward; its edge shades the eyes.
    var hd = c.shape(b, [
      [-0.86, 5.7, 1], [-0.8, 2.4], [-0.84, 1.4], [-0.84, 0.5], [-0.8, -0.2], [-0.72, -0.48, 1], [-0.4, -0.58], [0.0, -0.6], [0.3, -0.52], [0.44, -0.3],
      [0.5, 0.1], [0.54, 0.6], [0.62, 1.2], [0.8, 1.7], [0.9, 2.4], [0.9, 5.7, 1], [2.04, 5.7, 1], [2.0, 2.6], [1.9, 1.86], [1.5, 1.48], [1.12, 1.2], [1.06, 0.5],
      [1.08, -0.1], [0.98, -0.62], [0.7, -1.02], [0.2, -1.2], [-0.34, -1.16], [-0.78, -0.9], [-0.96, -0.36], [-1.0, 0.5], [-1.06, 1.2], [-1.4, 1.5],
      [-1.7, 1.9], [-1.8, 2.6], [-1.84, 5.7, 1]
    ], CL, 1, true);
    c.inside(hd);
    c.shape(b, [[0.6, -0.3], [1.2, -0.6], [2.4, 1.7], [2.4, 5.8], [1.4, 5.8], [1.1, 3.0], [0.86, 1.7]], SH, 0.2);
    leaf(c, b, [-1.25, 1.7], [-1.4, 2.6], [-1.44, 3.8], 0.1, "#423c34", 0.9);
    leaf(c, b, [1.36, 1.7], [1.54, 2.5], [1.6, 3.8], 0.1, "#423c34", 0.9);
    leaf(c, b, [0.78, -0.9], [0.98, -0.4], [1.02, 0.3], 0.08, "#423c34", 0.8);
    c.end();
    c.shape(f, [[-0.75, -0.5], [-0.4, -0.6], [0.0, -0.62], [0.42, -0.5], [0.46, 0.06], [0.0, -0.02], [-0.4, 0.0], [-0.7, 0.02]], "#10131c", 0.22);
    c.tint = ["#141824", 0.2];
  };

  // One member of a group: neck, tunic, head, beard, mouth, hair or head cloth.
  function member(c, x, y, R, m) {
    var o = withFace(m.face);
    var f = frame(x, y, R, m.tilt || 0), b = frame(x + R * 0.05, y, R, 0);
    if (m.hood) hoodBack(c, b, m.hood);
    neck(c, f, o.skin, m.neck || 1);
    tunic(c, b, m.tunic, m.k || 0.86, 0.8);
    head(c, f, o);
    if (!m.hood) hair(c, f, m.hair);
    if (m.beard) beard(c, f, m.beard);
    mouth(c, f, o, !!m.beard);
    if (m.cloth) headcloth(c, f, m.cloth);
    if (m.hood) hoodFront(c, b, m.hood, m.k || 0.86);
    if (m.net) {
      var nd = c.shape(b, [[0.9, 1.3], [1.6, 1.42], [2.02, 1.86], [2.1, 3.6], [1.5, 3.8], [1.2, 2.6]], "#bca77f", 0.92, true);
      c.inside(nd);
      var g = "";
      for (var i = -6; i < 12; i++) {
        var p0 = b(0.8 + i * 0.16, 1.2), p1 = b(0.8 + i * 0.16 + 1.4, 3.9), p2 = b(0.8 + i * 0.16 + 1.4, 1.2), p3 = b(0.8 + i * 0.16, 3.9);
        g += "M" + nums(p0) + "L" + nums(p1) + "M" + nums(p2) + "L" + nums(p3);
      }
      c.add('<path d="' + g + '" stroke="#6e5c40" stroke-width="2" opacity=".55"/>');
      c.shape(b, [[1.5, 1.3], [2.3, 1.6], [2.3, 4.0], [1.6, 4.0]], SH, 0.2);
      c.end();
    }
  }

  // Yonah's net partners, together in one image (number deliberately not emphasized).
  draw.partners = function (c) {
    member(c, 300, 214, 80, {
      face: { skin: "#9a6943", lip: "#80463a", brow: "#2b231e", open: 0.9, smile: 0.3, crinkle: 0.5, gaze: -0.2, age: 0.7, jaw: 1.04 },
      tunic: "#c4b494", cloth: { color: "#b9a682" }, hair: { color: "#2c241e" },
      beard: { color: "#3a322b", e: 0.03, len: 0.1, hi: "#a59d92", locks: [[[-0.5, 0.6], [-0.44, 0.8], [-0.34, 0.98], 0.05, 0.7], [[0.1, 0.7], [0.14, 0.9], [0.1, 1.04], 0.05, 0.6]] }
    });
    member(c, 172, 322, 88, {
      face: { skin: "#7c5034", lip: "#6c392b", brow: "#1d1611", open: 0.95, smile: 0.5, crinkle: 0.6, gaze: -0.18, jaw: 1.05, browT: 1.1 },
      tunic: "#5a7262", hair: { color: "#1c1511", bump: 0.08, n: 10, line: 0.04, hi: "#5b4a3d" },
      beard: { color: "#1f1813", e: 0.0, len: -0.05 }
    });
    member(c, 432, 330, 88, {
      face: { skin: "#8a5a3a", lip: "#74402f", brow: "#211a15", open: 0.9, smile: 0.25, gaze: -0.2, jaw: 1.1, nose: 1.06, browT: 1.1 },
      tunic: "#6d5440", cloth: { color: "#9c7d57", low: 0.06 }, hair: { color: "#211a15" }, net: true,
      beard: { color: "#211a15", e: 0.05, len: 0.12, hi: "#5b4a3d", locks: [[[-0.5, 0.6], [-0.44, 0.84], [-0.34, 1.02], 0.05, 0.4]] }
    });
  };

  // Some of the scribes: mantles over their heads like Menahem's, composed and stern, not evil.
  draw.scribes = function (c) {
    var M1 = { cloth: "#e0d6be", dark: "#b8aa8d", inner: "#90836c", band: "#2f3442" };
    var M2 = { cloth: "#d6cbb0", dark: "#ae9f81", inner: "#867963", band: "#2f3442" };
    member(c, 304, 212, 80, {
      face: { skin: "#b07d55", lip: "#8e4c3c", brow: "#2a201a", open: 0.86, gaze: -0.12, browIn: -0.008, smile: -0.06, jaw: 0.98 },
      tunic: "#7d6a4c", hood: M2, k: 0.82, beard: { color: "#2a201a", e: -0.02, len: -0.02 }
    });
    member(c, 176, 320, 90, {
      face: { skin: "#a6744f", lip: "#86493a", brow: "#4a423b", open: 0.84, gaze: -0.14, browIn: -0.01, smile: -0.08, age: 1, hollow: 0.4 },
      tunic: "#8a6a3c", hood: M1, k: 0.84,
      beard: { color: "#6e665d", e: 0.05, len: 0.4, hi: "#c2bbaf", locks: [[[-0.6, 0.5], [-0.54, 0.82], [-0.44, 1.12], 0.07, 0.8], [[-0.3, 0.8], [-0.24, 1.1], [-0.16, 1.38], 0.07, 0.8], [[0.06, 0.78], [0.1, 1.04], [0.06, 1.3], 0.06, 0.6]] }
    });
    member(c, 430, 328, 88, {
      face: { skin: "#8f6244", lip: "#7a4234", brow: "#211a15", open: 0.84, gaze: -0.14, browIn: -0.012, smile: -0.08, jaw: 1.06, nose: 1.08, age: 0.4 },
      tunic: "#5e5444", hood: M2, k: 0.84,
      beard: { color: "#221b16", e: 0.04, len: 0.22, hi: "#5f5046", locks: [[[-0.5, 0.6], [-0.44, 0.86], [-0.34, 1.1], 0.05, 0.4]] }
    });
  };

  // ---------------------------------------------------------------- public API

  var FACING = {};
  for (var fi = 0; fi < IDS.length; fi++) FACING[IDS[fi]] = "left";

  BHS.portraits = {
    ids: IDS.slice(),
    // Every portrait looks toward screen-left; mirror with CSS scaleX(-1) to face right.
    facing: FACING,
    // render(id, { pose?: "standing"|"lying" (asher only, default "lying"), uid?: string })
    // -> SVG string, or null for unknown ids (including "jesus", who is never drawn).
    render: function (id, opts) {
      var o = opts || {};
      if (typeof id !== "string" || !Object.prototype.hasOwnProperty.call(draw, id)) return null;
      var uid = typeof o.uid === "string" && /^[A-Za-z0-9_-]{1,24}$/.test(o.uid) ? o.uid : (++renderCount).toString(36);
      PREC = 1;
      var c = new Ctx(id, uid);
      draw[id](c, o);
      return c.svg();
    }
  };
})();
