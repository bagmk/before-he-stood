/* Scene backgrounds for "Before He Stood", drawn as inline SVG strings.
   Owner: art agent. See docs/SPEC.md §5.6 (look), §6.6 (BG ids), §7 (guardrails).
   - Classic script, no modules, no fetch, no external assets, no SVG filters.
   - Every scene is composed for a 900x1600 portrait viewBox with the focal point in the
     central band (y ~560-880) so it survives a landscape "slice" crop and the text panel
     that covers the bottom ~35% of the stage.
   - Jesus is never drawn: crowd scenes only leave an empty, luminous space.
   - Ids inside each SVG are prefixed with the bg id plus a per-render counter, so any
     number of SVGs (even the same scene twice) can live in one page. */
(function () {
  "use strict";
  var BHS = (window.BHS = window.BHS || {});

  var W = 900;
  var H = 1600;
  var IDS = ["black", "dawn_lamp", "shore_dawn", "asher_ceiling", "asher_home", "lane",
    "sky_carried", "crowd", "crowd_lying", "road_home", "doorway_evening", "lamp_night"];
  var renderCount = 0;

  // ---------------------------------------------------------------- utilities

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ri(v) { return Math.round(v); }
  function r1(v) { return Math.round(v * 10) / 10; }
  function r2(v) { return Math.round(v * 100) / 100; }

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // Small deterministic PRNG (mulberry32) so every scene draws the same way each time.
  function prng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hexRgb(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgbHex(c) {
    return "#" + ((1 << 24) | (clamp(ri(c[0]), 0, 255) << 16) | (clamp(ri(c[1]), 0, 255) << 8) | clamp(ri(c[2]), 0, 255)).toString(16).slice(1);
  }
  function mix(a, b, t) {
    var x = hexRgb(a), y = hexRgb(b);
    return rgbHex([lerp(x[0], y[0], t), lerp(x[1], y[1], t), lerp(x[2], y[2], t)]);
  }

  // Joins numbers for path data; a negative number needs no separator.
  function nums(arr) {
    var s = "";
    for (var i = 0; i < arr.length; i++) s += (i === 0 || arr[i] < 0 ? "" : " ") + arr[i];
    return s;
  }

  // Closed polygon with integer coordinates, written as relative moves to keep strings short.
  function poly(pts) {
    var x0 = ri(pts[0][0]), y0 = ri(pts[0][1]), px = x0, py = y0, out = [];
    for (var i = 1; i < pts.length; i++) {
      var x = ri(pts[i][0]), y = ri(pts[i][1]);
      out.push(x - px, y - py);
      px = x; py = y;
    }
    return "M" + nums([x0, y0]) + "l" + nums(out) + "z";
  }

  // Smooth curve through points (Catmull-Rom converted to cubic Beziers).
  function smooth(pts, closed) {
    var n = pts.length, d = "M" + nums([ri(pts[0][0]), ri(pts[0][1])]);
    var last = closed ? n : n - 1;
    for (var i = 0; i < last; i++) {
      var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      if (!closed) { if (i === 0) p0 = p1; if (i + 2 >= n) p3 = p2; }
      d += "C" + nums([ri(p1[0] + (p2[0] - p0[0]) / 6), ri(p1[1] + (p2[1] - p0[1]) / 6),
        ri(p2[0] - (p3[0] - p1[0]) / 6), ri(p2[1] - (p3[1] - p1[1]) / 6), ri(p2[0]), ri(p2[1])]);
    }
    return d + (closed ? "z" : "");
  }

  // Ridge line from x=0 to x=900 closed down to yBottom (hills, crowds, roofs).
  function ridge(rnd, y, amp, steps, yBottom) {
    var pts = [];
    for (var i = 0; i <= steps; i++) pts.push([-20 + (940 * i) / steps, y + (rnd() - 0.5) * 2 * amp]);
    return smooth(pts, false) + "L920 " + yBottom + "L-20 " + yBottom + "z";
  }

  // Element helpers.
  function path(d, fill, extra) { return '<path d="' + d + '" fill="' + fill + '"' + (extra || "") + "/>"; }
  function rect(x, y, w, h, fill, extra) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + fill + '"' + (extra || "") + "/>";
  }
  function full(fill, extra) { return '<rect width="900" height="1600" fill="' + fill + '"' + (extra || "") + "/>"; }
  function ell(cx, cy, rx, ry, fill, extra) {
    return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + fill + '"' + (extra || "") + "/>";
  }
  function op(v) { return ' opacity="' + v + '"'; }
  function stroke(color, width, extra) {
    return ' fill="none" stroke="' + color + '" stroke-width="' + width + '" stroke-linecap="round"' + (extra || "");
  }
  function line(d, color, width, extra) { return '<path d="' + d + '"' + stroke(color, width, extra) + "/>"; }

  function stops(list) {
    var s = "";
    for (var i = 0; i < list.length; i++) {
      var st = list[i];
      s += '<stop offset="' + st[0] + '" stop-color="' + st[1] + '"' +
        (st[2] !== undefined && st[2] !== 1 ? ' stop-opacity="' + st[2] + '"' : "") + "/>";
    }
    return s;
  }

  // ---------------------------------------------------------------- render context

  function Ctx(bg, uid) {
    this.bg = bg;
    this.pre = bg + "-" + uid + "-";
    this.rnd = prng(hash(bg));
    this.defs = [];
    this.body = [];
  }
  Ctx.prototype.id = function (name) { return this.pre + name; };
  Ctx.prototype.url = function (name) { return "url(#" + this.pre + name + ")"; };
  Ctx.prototype.def = function (s) { this.defs.push(s); };
  Ctx.prototype.add = function (s) { this.body.push(s); };
  Ctx.prototype.lin = function (name, x1, y1, x2, y2, list) {
    this.def('<linearGradient id="' + this.id(name) + '" gradientUnits="userSpaceOnUse" x1="' + x1 + '" y1="' + y1 +
      '" x2="' + x2 + '" y2="' + y2 + '">' + stops(list) + "</linearGradient>");
    return this.url(name);
  };
  // Radial gradient; ry (optional) squashes it into an ellipse around its center.
  Ctx.prototype.rad = function (name, cx, cy, r, list, ry) {
    var tf = ry && ry !== r ? ' gradientTransform="translate(' + cx + " " + cy + ")scale(1 " + r2(ry / r) + ")translate(" + -cx + " " + -cy + ')"' : "";
    this.def('<radialGradient id="' + this.id(name) + '" gradientUnits="userSpaceOnUse" cx="' + cx + '" cy="' + cy + '" r="' + r + '"' +
      tf + ">" + stops(list) + "</radialGradient>");
    return this.url(name);
  };
  // Soft round light: a full-frame rect filled with a radial falloff.
  Ctx.prototype.glow = function (name, cx, cy, r, color, alpha, ry, mid) {
    var m = mid === undefined ? 0.35 : mid;
    this.add(full(this.rad(name, cx, cy, r, [[0, color, alpha], [m, color, r2(alpha * 0.45)], [1, color, 0]], ry)));
  };
  Ctx.prototype.vignette = function (color, alpha, cx, cy, r) {
    this.add(full(this.rad("vig", cx || 450, cy || 760, r || 980, [[0, color, 0], [0.55, color, 0], [1, color, alpha]])));
  };
  // Cheap film grain: a deterministic speckle tile instead of feTurbulence.
  // light = relative strength of the pale specks (keep low in dark scenes).
  Ctx.prototype.grain = function (alpha, light) {
    var g = prng(91), dk = "", lt = "";
    for (var i = 0; i < 70; i++) {
      var x = r1(g() * 150), y = r1(g() * 150), s = r1(1.4 + g() * 1.1);
      var sq = "M" + x + " " + y + "h" + s + "v" + s + "h-" + s + "z";
      if (i % 2) dk += sq; else lt += sq;
    }
    this.def('<pattern id="' + this.id("grain") + '" width="150" height="150" patternUnits="userSpaceOnUse">' +
      path(dk, "#000", op(0.5)) + path(lt, "#fff", op(r2(0.4 * (light === undefined ? 1 : light)))) + "</pattern>");
    this.add(full(this.url("grain"), op(alpha)));
  };
  Ctx.prototype.svg = function () {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1600" preserveAspectRatio="xMidYMid slice" width="100%" height="100%"' +
      ' class="bhs-art" data-bg="' + this.bg + '" aria-hidden="true" focusable="false">' +
      (this.defs.length ? "<defs>" + this.defs.join("") + "</defs>" : "") + this.body.join("") + "</svg>";
  };

  // ---------------------------------------------------------------- shared builders

  // Fieldstone generator for basalt walls. Stones are laid in courses in wall-local units
  // (u along the wall, v down the wall) and mapped to the viewBox by map(u, v) -> [x, y],
  // which lets the same code draw flat walls and walls in perspective.
  // o.tone(cx, cy, rnd, u, v) returns a tone index, or -1 to leave the stone in darkness.
  function stones(rnd, map, o) {
    var out = [], i;
    for (i = 0; i < o.n; i++) out.push("");
    var v = o.v0 - rnd() * o.ch[0] * 0.5;
    while (v < o.v1) {
      var ch = lerp(o.ch[0], o.ch[1], rnd());
      var u = o.u0 - rnd() * o.sw[1] * 0.8;
      while (u < o.u1) {
        var sw = lerp(o.sw[0], o.sw[1], rnd());
        var skip = rnd() < (o.skip || 0);
        if (!skip && !(o.keep && !o.keep(u + sw / 2, v + ch / 2))) {
          var g = o.gap, a = u + g, b = u + sw - g, t = v + g, e = v + ch - g, j = o.jit || 0;
          var k = Math.min(b - a, e - t), c1 = k * (0.12 + rnd() * 0.3), c2 = k * (0.08 + rnd() * 0.3);
          var pts = rnd() < 0.5
            ? [[a + c1, t], [b, t], [b, e - c2], [b - c2, e], [a, e], [a, t + c1]]
            : [[a, t], [b - c1, t], [b, t + c1], [b, e], [a + c2, e], [a, e - c2]];
          var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
          for (i = 0; i < pts.length; i++) {
            var p = map(pts[i][0] + (rnd() - 0.5) * j, pts[i][1] + (rnd() - 0.5) * j);
            pts[i] = p;
            if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
            if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
          }
          var visible = maxX > -10 && minX < W + 10 && maxY > -10 && minY < H + 10 && maxX - minX >= (o.minW || 0);
          if (visible) {
            var ti = o.tone((minX + maxX) / 2, (minY + maxY) / 2, rnd, u, v);
            if (ti >= 0) out[clamp(ti, 0, o.n - 1)] += poly(pts);
          }
        }
        u += sw;
      }
      v += ch;
    }
    return out;
  }
  function addStones(c, list, tones) {
    for (var i = 0; i < list.length; i++) if (list[i]) c.add(path(list[i], tones[i]));
  }

  // Herodian-style oil lamp seen from the side, nozzle to the left, flame at the nozzle tip.
  // (x, y) is the wick point, k the lamp scale, fh the flame height in viewBox units.
  // Returns { body, flame } strings so the light can be layered between them.
  function oilLamp(c, x, y, fh, k, name) {
    var w = fh * 0.24, b = y, t = y - fh;
    var body = '<g transform="translate(' + x + " " + y + ")scale(" + k + ')">' +
      ell(61, 25, 52, 6, "#000", op(0.5)) +
      path("M30 4L7-3Q-4-4-3 3Q-2 9 8 10L33 15Z", c.lin(name + "n", 0, 0, 40, 0, [[0, "#c88a57"], [1, "#7a4b2f"]])) +
      path("M27 13C29-9 93-11 98 11C91 23 35 24 27 13Z", c.lin(name + "b", 25, 0, 99, 0, [[0, "#c98a56"], [0.45, "#94603c"], [1, "#4f3020"]])) +
      ell(61, -2, 8, 2.6, "#2a180e") +
      path("M96 6q9-2 10 4q-1 6-9 5z", "#5a3824") + "</g>";
    var flame =
      path("M" + x + " " + b + "C" + r1(x - w) + " " + r1(b - fh * 0.2) + " " + r1(x - w * 0.85) + " " + r1(b - fh * 0.56) + " " + x + " " + t +
        "C" + r1(x + w * 0.85) + " " + r1(b - fh * 0.56) + " " + r1(x + w) + " " + r1(b - fh * 0.2) + " " + x + " " + b + "Z",
        c.lin(name + "f", 0, b, 0, t, [[0, "#fff7df"], [0.35, "#ffd47e"], [1, "#f2902f", 0.85]])) +
      path("M" + x + " " + (b - 1) + "C" + r1(x - w * 0.5) + " " + r1(b - fh * 0.15) + " " + r1(x - w * 0.45) + " " + r1(b - fh * 0.38) + " " + x + " " + r1(b - fh * 0.6) +
        "C" + r1(x + w * 0.45) + " " + r1(b - fh * 0.38) + " " + r1(x + w * 0.5) + " " + r1(b - fh * 0.15) + " " + x + " " + (b - 1) + "Z", "#fffdf4") +
      ell(x, b - 1, r1(w * 0.55), r1(w * 0.3), "#6f8fd0", op(0.45));
    return { body: body, flame: flame };
  }

  // ---------------------------------------------------------------- scenes

  var scenes = {};

  scenes.black = function (c) {
    c.add(full("#090807"));
    c.glow("warm", 450, 720, 760, "#3a2614", 0.5, 900, 0.4);
    c.vignette("#000", 0.6);
    return c.svg();
  };

  // Menahem's room. Shared by dawn_lamp and lamp_night so both read as the same place.
  function room(c, night) {
    var rnd = c.rnd;
    var wx = 591, wy = 854;                  // wick point of the lamp on the table
    var fh = night ? 27 : 42;                // flame height ("lower" at night)
    var gx = wx, gy = wy - fh * 0.5;         // glow center
    var reach = night ? 420 : 590;

    c.add(full(night ? "#0c0d0f" : "#111215"));

    // Back wall: fieldstones lit by the lamp, fading into darkness.
    var tones = night
      ? ["#17181a", "#1e1d1d", "#28241f", "#332c25", "#3f352a"]
      : ["#1a1b1e", "#242322", "#302b26", "#3f362d", "#524435"];
    addStones(c, stones(rnd, function (u, v) { return [u, v]; }, {
      u0: 0, u1: W, v0: 166, v1: 966, ch: [46, 72], sw: [72, 140], gap: 4, jit: 5, n: 5,
      tone: function (x, y, r) {
        var dx = x - gx, dy = (y - gy) * 1.15;
        var L = clamp(1 - Math.sqrt(dx * dx + dy * dy) / reach, 0, 1);
        if (L <= 0.03 && r() < 0.6) return -1;
        return Math.floor(L * 4.3 + (r() - 0.5) * 1.3);
      }
    }), tones);

    // Ceiling: dark reeds above a heavy wall-plate beam.
    c.add(rect(0, 0, W, 132, night ? "#09090a" : "#0b0b0c"));
    c.add(path("M0 128L900 122V166L0 172Z", night ? "#221a14" : "#2a2019"));
    c.add(path("M0 168L900 162V172L0 178Z", night ? "#2c2219" : "#3b2c20"));

    // Window with the first blue of dawn (or night), deep basalt reveal.
    c.add(path("M146 538L338 534V560L146 564Z", night ? "#241b14" : "#2c2119"));
    c.add(path("M146 558L338 554V562L146 566Z", night ? "#33271c" : "#47362a"));
    c.add(path(poly([[160, 564], [189, 582], [189, 722], [160, 722]]), night ? "#1a1f29" : "#38414f"));
    c.add(path(poly([[160, 564], [322, 562], [322, 582], [189, 582]]), night ? "#141922" : "#2a313c"));
    c.glow("win", 250, 660, 250, night ? "#5b74a0" : "#86a2c8", night ? 0.08 : 0.2);

    // Wall niche on the right with two rolled scrolls.
    c.add(path(poly([[698, 548], [816, 546], [816, 566], [698, 568]]), night ? "#2c2620" : "#3b332b"));
    c.add(rect(706, 566, 102, 126, "#0a0a0b"));
    c.add(rect(722, 628, 76, 20, night ? "#5d4c36" : "#7a6548", ' rx="9"'));
    c.add(rect(716, 648, 84, 22, night ? "#6b583e" : "#8a7353", ' rx="10"'));
    c.add(ell(727, 638, 5, 9, night ? "#9c8762" : "#c2ab80"));
    c.add(ell(721, 659, 5, 10, night ? "#a8916a" : "#d0b98c"));

    // Floor.
    c.add(rect(0, 958, W, 642, c.lin("floor", 0, 958, 0, 1500, [[0, night ? "#141210" : "#1a1612"], [1, "#0a0908"]])));

    // Low table.
    c.add(path(poly([[262, 846], [758, 846], [780, 878], [240, 878]]),
      c.lin("top", 240, 0, 780, 0, [[0, night ? "#241a12" : "#2b1f15"], [0.62, night ? "#4a3523" : "#5c4129"], [1, night ? "#33251a" : "#3e2c1d"]])));
    c.add(rect(240, 878, 540, 20, "#1e150e"));
    c.add(rect(256, 898, 24, 64, "#150f0a"));
    c.add(rect(740, 898, 24, 64, "#150f0a"));
    c.add(ell(510, 964, 300, 14, "#000", op(0.55)));

    if (!night) {
      // Open scroll: parchment between two rolled ends, faint ruled columns (no letters).
      c.add(path(poly([[352, 850], [572, 850], [586, 875], [338, 875]]),
        c.lin("sheet", 338, 0, 586, 0, [[0, "#c9b086"], [1, "#efdcb2"]])));
      c.add(line("M370 855h80M473 855h82M368 860h84M471 860h86M366 865h70M469 865h88M364 870h86M467 870h76", "#6d5a40", 1.6, op(0.45)));
      c.add(path("M325 878L337 847Q347 843 357 847L349 878Q337 883 325 878Z", "#a4865b"));
      c.add(ell(337, 878, 12, 4.5, "#d9c294"));
      c.add(path("M599 878L587 847Q577 843 567 847L575 878Q587 883 599 878Z", "#b89a6c"));
      c.add(ell(587, 878, 12, 4.5, "#ead39f"));
    } else {
      // Notes for the night: a closed scroll, loose sheets, ink and a reed pen.
      c.add(rect(300, 834, 172, 16, "#7e6849", ' rx="8"'));
      c.add(ell(304, 842, 5, 8, "#b49b70"));
      c.add(path(poly([[392, 853], [480, 850], [486, 872], [388, 875]]), "#b8a07a"));
      c.add(path(poly([[452, 857], [540, 860], [535, 879], [447, 876]]), "#cdb88f"));
      c.add(line("M461 864l62 2M460 868l66 2M459 872l46 1", "#5d4a35", 1.4, op(0.5)));
      c.add(line("M498 884L566 870", "#6e5638", 3));
      c.add(rect(552, 846, 20, 20, "#1b1714"));
      c.add(ell(562, 846, 10, 3, "#2e2721"));
      c.add(ell(562, 846, 6, 1.8, "#070606"));
    }

    var lamp = oilLamp(c, wx, wy, fh, "lamp");
    c.add(lamp.body);

    // Lamplight on the wall, the table and the floor.
    c.add(full(c.rad("light", gx, gy, reach, night
      ? [[0, "#ffbf72", 0.4], [0.14, "#f0a050", 0.22], [0.42, "#b86a2c", 0.08], [1, "#6a3d18", 0]]
      : [[0, "#ffd08c", 0.48], [0.14, "#f5ae5e", 0.28], [0.42, "#c77a33", 0.11], [1, "#7a4a1f", 0]], reach * 0.92)));

    // Sky seen through the window stays cool (drawn after the warm light).
    c.add(rect(189, 582, 133, 140, c.lin("sky", 0, 582, 0, 722, night
      ? [[0, "#05080f"], [0.6, "#0d1424"], [1, "#172036"]]
      : [[0, "#1b2a49"], [0.5, "#3a5679"], [0.85, "#8ba3b9"], [1, "#b9b4a8"]])));
    c.add(path("M189 702L262 696L322 691V722H189Z", night ? "#030406" : "#0e121a"));
    c.add(rect(292, 684, 10, 8, night ? "#030406" : "#0e121a"));
    c.add(ell(296, 604, 1.8, 1.8, "#eef2f9", op(night ? 0.9 : 0.7)));
    if (night) c.add(ell(232, 628, 1.3, 1.3, "#dfe6f2", op(0.7)));
    c.add(rect(160, 720, 162, 5, night ? "#1f2633" : "#4b5667"));

    // Flame and halo on top.
    c.glow("halo", wx, wy - fh * 0.55, night ? 60 : 84, "#fff0c8", night ? 0.7 : 0.85, 0, 0.3);
    c.add(lamp.flame);

    c.vignette("#000", night ? 0.85 : 0.7, gx, gy - 60, night ? 900 : 1000);
    c.grain(0.5);
    return c.svg();
  }
  scenes.dawn_lamp = function (c) { return room(c, false); };
  scenes.lamp_night = function (c) { return room(c, true); };

  // Narrow lane of black basalt houses sloping down to the lake, late morning.
  // Drawn with a simple pinhole camera so stones, steps and shadows share one perspective.
  scenes.lane = function (c) {
    var rnd = c.rnd;
    var F = 700, CX = 450, CY = 600, EYE = 1.6, G = 0.11;
    var XL = -1.55, XR = 1.5, ZN = 1.12, ZEND = 15.5;
    function fl(z) { return -G * z; }
    function P(x, y, z) { return [CX + (F * x) / z, CY - (F * (y - EYE)) / z]; }
    function Pf(x, z) { return P(x, fl(z), z); }
    var i, z;

    // Sky, far hills, lake.
    c.add(rect(0, 0, W, 606, c.lin("sky", 0, 0, 0, 600, [[0, "#6894b9"], [0.55, "#a6c3d4"], [1, "#e1e8e3"]])));
    c.add(path(ridge(rnd, 588, 5, 7, 606), "#b3bfc2"));
    c.add(path(ridge(rnd, 595, 4, 9, 606), "#95a5ad"));
    c.add(rect(0, 600, W, 150, c.lin("lake", 0, 600, 0, 745, [[0, "#b4cad0"], [0.18, "#86abbb"], [1, "#4f7f97"]])));
    var gl = "";
    for (i = 0; i < 16; i++) {
      var gy = 606 + Math.pow(rnd(), 1.4) * 110, gw = 6 + rnd() * 24 * (gy - 590) / 100;
      gl += "M" + ri(390 + rnd() * 130) + " " + ri(gy) + "h" + ri(gw);
    }
    c.add(line(gl, "#f6f3e8", 2, op(0.7)));

    // Open shore at the bottom of the slope, a beached boat with its mast.
    c.add(path(poly([Pf(-14, 24), Pf(14, 24), Pf(14, ZEND), Pf(-14, ZEND)]), "#dccba7"));
    c.add(line("M300 724H600", "#f2f0e6", 2, op(0.8)));
    c.add(path("M440 707L506 705L501 723Q470 729 446 723Z", "#3e3129"));
    c.add(path("M440 707L506 705L505 709L441 711Z", "#7a6450"));
    c.add(line("M476 707V656M466 664L487 663", "#4a3b30", 2));

    // Houses: [z0, z1, height]. Roofs step down with the slope.
    var left = [[1.0, 6.4, 3.55], [6.4, 11.2, 3.3], [11.2, ZEND, 2.65]];
    var right = [[1.0, 5.6, 3.6], [5.6, 10.6, 3.25], [10.6, ZEND, 2.7]];

    function wall(x, houses, lit) {
      for (var h = 0; h < houses.length; h++) {
        var z0 = houses[h][0], z1 = houses[h][1], top = fl(z0) + houses[h][2];
        var face = [P(x, top, z0), P(x, top, z1), Pf(x, z1), Pf(x, z0)];
        c.add(path(poly(face), lit ? "#3a3733" : "#1c1f23"));
        var tones = lit ? ["#4b4944", "#58554f", "#66625a", "#747066", "#848075"] : ["#24272c", "#2a2e33", "#30353b", "#383d43"];
        (function (topY) {
          addStones(c, stones(rnd, function (u, v) { return P(x, topY - v, u); }, {
            u0: z0, u1: z1, v0: 0.26, v1: houses[h][2] + G * (z1 - z0) + 0.2, ch: [0.24, 0.36], sw: [0.38, 0.78],
            gap: 0.035, jit: 0.05, n: tones.length, skip: lit ? 0.12 : 0.38, minW: 3.5,
            keep: function (u, v) { return topY - v > fl(u) - 0.1; },
            tone: function (cx, cy, r, u, v) {
              var t = r() * tones.length;
              if (lit && v < 0.9) t += 0.8;
              return Math.floor(t);
            }
          }), tones);
        })(top);
        // Roof edge band (packed mud over reeds) and protruding beam ends.
        c.add(path(poly([P(x, top + 0.04, z0), P(x, top + 0.04, z1), P(x, top - 0.26, z1), P(x, top - 0.26, z0)]), lit ? "#6f6253" : "#2a2927"));
        var be = "", bl = "";
        if (z0 < 11) {
          for (z = z0 + 0.35; z < z1 - 0.2; z += 0.75) {
            var dx = lit ? -0.24 : 0.24;
            be += poly([P(x, top - 0.12, z), P(x + dx, top - 0.12, z), P(x + dx, top - 0.27, z), P(x, top - 0.27, z)]);
            bl += poly([P(x + dx, top - 0.12, z), P(x + dx, top - 0.12, z + 0.15), P(x + dx, top - 0.27, z + 0.15), P(x + dx, top - 0.27, z)]);
          }
          c.add(path(be, lit ? "#4a3a2a" : "#1c1712"));
          c.add(path(bl, lit ? "#a58c69" : "#2e2720"));
        }
      }
    }
    wall(XL, left, false);
    wall(XR, right, true);

    // Doorway in the sunlit wall, with a wooden lintel and a clay jar beside it.
    var dz0 = 4.0, dz1 = 4.8, dtop = fl(dz0) + 1.62;
    c.add(path(poly([P(XR, dtop, dz0), P(XR, dtop, dz1), Pf(XR, dz1), Pf(XR, dz0)]),
      c.lin("door", 0, 660, 0, 960, [[0, "#191817"], [1, "#2b2926"]])));
    c.add(path(poly([P(XR, dtop + 0.16, dz0 - 0.15), P(XR, dtop + 0.16, dz1 + 0.12), P(XR, dtop, dz1 + 0.12), P(XR, dtop, dz0 - 0.15)]), "#5b4733"));
    var jz = 3.55, jx = 1.22, jb = Pf(jx, jz), jt = P(jx, fl(jz) + 0.62, jz), jw = (F * 0.19) / jz;
    c.add(path("M" + ri(jb[0] - jw * 0.55) + " " + ri(jb[1]) + "C" + ri(jb[0] - jw * 1.25) + " " + ri(lerp(jb[1], jt[1], 0.5)) + " " +
      ri(jb[0] - jw * 0.9) + " " + ri(jt[1] + 8) + " " + ri(jb[0] - jw * 0.32) + " " + ri(jt[1]) + "H" + ri(jb[0] + jw * 0.32) + "C" +
      ri(jb[0] + jw * 0.9) + " " + ri(jt[1] + 8) + " " + ri(jb[0] + jw * 1.25) + " " + ri(lerp(jb[1], jt[1], 0.5)) + " " + ri(jb[0] + jw * 0.55) + " " + ri(jb[1]) + "Z",
    c.lin("jar", jb[0] - jw, 0, jb[0] + jw, 0, [[0, "#c27a4e"], [0.5, "#9a5c3a"], [1, "#5e3622"]])));

    // Lane floor: sunlit limestone dust with shallow steps; the left houses shade part of it.
    c.add(path(poly([Pf(XL, ZN), Pf(XL, ZEND), Pf(XR, ZEND), Pf(XR, ZN)]),
      c.lin("lanef", 0, 760, 0, 1500, [[0, "#e2d3b2"], [1, "#c9b48c"]])));
    var cob = "";
    for (i = 0; i < 34; i++) {
      z = 1.4 + Math.pow(rnd(), 1.6) * 8;
      var cx0 = lerp(XL + 0.1, XR - 0.1, rnd()), a = 0.06 + rnd() * 0.1, b2 = 0.05 + rnd() * 0.07;
      cob += poly([Pf(cx0 - a, z), Pf(cx0, z - b2), Pf(cx0 + a, z), Pf(cx0 + a * 0.6, z + b2), Pf(cx0 - a * 0.7, z + b2)]);
    }
    c.add(path(cob, "#b29f7e"));
    var stepD = "", stepL = "";
    for (z = 2.1; z < 14.6; z += 1.05) {
      stepD += poly([Pf(XL, z), Pf(XR, z), P(XR, fl(z) - 0.09, z), P(XL, fl(z) - 0.09, z)]);
      stepL += poly([P(XL, fl(z) + 0.012, z - 0.03), P(XR, fl(z) + 0.012, z - 0.03), Pf(XR, z), Pf(XL, z)]);
    }
    c.add(path(stepD, "#a8957a"));
    c.add(path(stepL, "#efe4ca", op(0.8)));
    var sh = [Pf(XL, ZN)], prev = null;
    for (i = 0; i < left.length; i++) {
      var hh = left[i][2], e = 0.42 * hh, d = 0.5 * hh;
      var za = Math.max(ZN, left[i][0] - d), zb = left[i][1] - d;
      if (!prev) sh.push(Pf(XL + e, ZN));
      sh.push(Pf(XL + e, za), Pf(XL + e, zb));
      prev = true;
    }
    sh.push(Pf(XL, ZEND));
    c.add(path(poly(sh), "#58606a", op(0.55)));

    // Haze that makes the bottom of the slope glow, light vignette and grain.
    c.glow("haze", 455, 650, 330, "#fffaf0", 0.32, 260);
    c.vignette("#1a1c20", 0.35, 450, 700, 1000);
    c.grain(0.45);
    return c.svg();
  };

  // Figure templates for crowds, in local units: head radius 1, head center at the origin,
  // feet at y = 14.5. Fill comes from the <use> element; "color" sets hair on bare heads.
  function crowdDefs(c) {
    var shade = path("M-2.2 7.5H2.2L2.45 14.5H-2.45Z", "#000", op(0.16));
    c.def('<g id="' + c.id("fb") + '">' +
      '<path d="M-.45.8Q-1.9 1-2.05 2.3L-2.3 14.5H2.3L2.05 2.3Q1.9 1 .45.8Z"/>' + shade +
      path("M-.45.8Q-1.9 1-2.05 2.3Q-1.5 1.5-.3 1.25ZM.45.8Q1.9 1 2.05 2.3Q1.5 1.5.3 1.25Z", "#fff", op(0.18)) +
      '<ellipse rx=".9" ry="1.05" fill="currentColor"/>' +
      path("M-.72-.5C-.55-1.12.55-1.12.72-.5C.4-.82-.4-.82-.72-.5Z", "#fff", op(0.22)) + "</g>");
    c.def('<g id="' + c.id("fh") + '">' +
      '<path d="M0-1.25C1.25-1.25 1.32.4 1.15 1.1Q2.2 1.4 2.3 2.6L2.45 14.5H-2.45L-2.3 2.6Q-2.2 1.4-1.15 1.1C-1.32.4-1.25-1.25 0-1.25Z"/>' + shade +
      path("M-.5 3.2L-.85 14.5H-.45L-.2 3.4Z", "#000", op(0.12)) +
      path("M-1.05-.55C-.95-1.32.95-1.32 1.05-.55C.7-1.02-.7-1.02-1.05-.55ZM-1.15 1.1Q-2.2 1.4-2.3 2.6Q-1.7 1.75-1 1.45ZM1.15 1.1Q2.2 1.4 2.3 2.6Q1.7 1.75 1 1.45Z", "#fff", op(0.2)) + "</g>");
    // Scribe: pale mantle drawn over the head with dark bands near the hem, tunic below.
    c.def('<g id="' + c.id("fs") + '">' +
      path("M-2.2 9.5H2.2L2.35 14.5H-2.35Z", "#8f918c") +
      '<path d="M0-1.3C1.3-1.3 1.36.4 1.2 1.1Q2.25 1.4 2.4 2.6L2.6 10.2Q0 10.9-2.6 10.2L-2.4 2.6Q-2.25 1.4-1.2 1.1C-1.36.4-1.3-1.3 0-1.3Z"/>' +
      path("M-2.4 6.5H2.4L2.6 10.2Q0 10.9-2.6 10.2Z", "#000", op(0.1)) +
      path("M-2.57 9.2Q0 9.85 2.57 9.2L2.58 9.6Q0 10.25-2.58 9.6ZM-2.53 8.4Q0 9 2.53 8.4L2.54 8.7Q0 9.3-2.54 8.7Z", "#2d3340") +
      path("M-2.62 10.1l.16 1.2h.24l-.06-1.15ZM2.62 10.1l-.16 1.2h-.24l.06-1.15Z", "#efe9da") +
      path("M-1.1-.6C-1-1.38 1-1.38 1.1-.6C.75-1.08-.75-1.08-1.1-.6ZM-1.2 1.1Q-2.25 1.4-2.4 2.6Q-1.75 1.75-1 1.45ZM1.2 1.1Q2.25 1.4 2.4 2.6Q1.75 1.75 1 1.45Z", "#fff", op(0.3)) + "</g>");
  }
  function useFig(c, kind, x, y, sx, sy, fill, color) {
    return '<use href="#' + c.id(kind) + '" transform="translate(' + r1(x) + " " + r1(y) + ")scale(" + r2(sx) + " " + r2(sy) + ')" fill="' + fill + '"' +
      (color ? ' color="' + color + '"' : "") + "/>";
  }

  var CLOTH = ["#b7a785", "#6e5642", "#45506a", "#7b4536", "#a3824e", "#5d6243", "#3d3b38", "#c9bea6", "#8a6f55", "#5a4c5e", "#94846a"];
  var HAIR = ["#2b231d", "#3a2c22", "#1f1b18", "#4a3a2c"];

  // Open ground at the edge of town near the shore, noon. Layered crowd silhouettes around
  // an empty clearing; the clearing holds only light (Jesus is never drawn).
  scenes.crowd = function (c) {
    var rnd = c.rnd;
    var F = 700, CX = 450, CY = 600, CAM = 2.4;
    var clr = { x: 0, z: 12.3, rx: 2.0, rz: 2.4 };
    function inClearing(x, z) { var a = (x - clr.x) / clr.rx, b = (z - clr.z) / clr.rz; return a * a + b * b < 1; }
    var i;

    // Noon sky with glare, the far shore, the lake and the boat that brought him.
    c.add(rect(0, 0, W, 640, c.lin("sky", 0, 0, 0, 610, [[0, "#9dbccf"], [0.6, "#cbdbe0"], [1, "#efeee6"]])));
    c.glow("glare", 450, -80, 760, "#fffef8", 0.6, 520);
    c.add(path(ridge(rnd, 584, 6, 8, 606), "#bcc5c6"));
    c.add(path(ridge(rnd, 592, 4, 10, 606), "#a9b5b8"));
    c.add(rect(0, 600, W, 44, c.lin("lake", 0, 600, 0, 640, [[0, "#c3d2d4"], [1, "#94b2bf"]])));
    var gl = "";
    for (i = 0; i < 18; i++) gl += "M" + ri(rnd() * 900) + " " + ri(604 + rnd() * 30) + "h" + ri(8 + rnd() * 26);
    c.add(line(gl, "#ffffff", 2, op(0.75)));
    c.add(line("M640 628V522M626 538L656 536", "#4d4239", 2.4));
    c.add(path("M606 628L676 626L670 640Q640 645 612 639Z", "#4a3c31"));
    c.add(line("M510 470q6-5 12 0q6-5 12 0M560 446q5-4 10 0q5-4 10 0", "#5d656c", 1.8, op(0.7)));

    // Ground, the bright clearing, then people far to near.
    c.add(rect(0, 634, W, 966, c.lin("ground", 0, 634, 0, 1150, [[0, "#e6dbbe"], [0.3, "#e0cfaa"], [1, "#c8af86"]])));
    c.add(ell(450, 742, 190, 40, c.rad("clr", 450, 742, 190, [[0, "#fff6df", 0.95], [0.6, "#fbefd4", 0.5], [1, "#f6e8c8", 0]], 40)));

    // Place people by rejection sampling, keeping the clearing and the approach path open.
    var people = [];
    var fixed = [[-1.95, 3.7, "fb"], [-3.1, 4.5, "fh"], [2.05, 3.9, "fh"], [3.3, 4.9, "fb"], [-1.3, 5.3, "fh"], [1.45, 5.6, "fb"]];
    for (i = 0; i < fixed.length; i++) people.push({ x: fixed[i][0], z: fixed[i][1], k: fixed[i][2] });
    var scribes = [[-1.05, 9.9], [-1.7, 10.3], [-2.35, 10.0]];
    for (i = 0; i < scribes.length; i++) people.push({ x: scribes[i][0], z: scribes[i][1], k: "fs" });
    var tries = 0;
    while (people.length < 96 && tries < 5000) {
      tries++;
      var z = 5.2 + Math.pow(rnd(), 0.75) * 27;
      var x = (rnd() * 2 - 1) * (z * 0.66 + 0.5);
      if (inClearing(x, z)) continue;
      if (z < 12.3 && Math.abs(x) < 0.95 + 0.012 * z) continue;
      if (z > 6.8 && z < 9.7 && x < -0.9 && x > -2.9) continue; // keep the scribes visible
      var dc = Math.sqrt(x * x + (z - clr.z) * (z - clr.z));
      if (rnd() > 0.35 + 0.65 * Math.exp(-((dc - 2.4) * (dc - 2.4)) / 14)) continue;
      var ok = true;
      for (var k = 0; k < people.length; k++) {
        var q = people[k], ddx = q.x - x, ddz = q.z - z;
        if (ddx * ddx + ddz * ddz < 0.36) { ok = false; break; }
      }
      if (ok) people.push({ x: x, z: z, k: rnd() < 0.55 ? "fh" : "fb" });
    }
    people.sort(function (a, b) { return b.z - a.z; });

    var shadows = "";
    var figs = [];
    for (i = 0; i < people.length; i++) {
      var p = people[i];
      var s = (F * 0.11) / p.z, hx = CX + (F * p.x) / p.z, hy = CY + (F * (CAM - 1.6)) / p.z;
      if (hx + 3 * s < -10 || hx - 3 * s > W + 10) continue;
      var haze = clamp((p.z - 4) / 26, 0, 0.72), dark = clamp((6.2 - p.z) / 6, 0, 0.32);
      var cloth = p.k === "fs" ? (rnd() < 0.5 ? "#e6dfcc" : "#ddd5c0") : CLOTH[Math.floor(rnd() * CLOTH.length)];
      var fill = mix(mix(cloth, "#dcd6c8", haze), "#25211e", dark);
      var hair = mix(mix(HAIR[Math.floor(rnd() * HAIR.length)], "#dcd6c8", haze), "#25211e", dark);
      var wf = 0.88 + rnd() * 0.26, hf = p.k === "fs" ? 1.04 : 0.94 + rnd() * 0.1;
      if (p.z > 8.5 && p.z < 17) {
        var fy = hy + 14.5 * s * hf, rx = 2.3 * s * wf, ry = 0.45 * s;
        shadows += "M" + r1(hx - rx) + " " + r1(fy) + "a" + r1(rx) + " " + r1(ry) + " 0 1 0 " + r1(2 * rx) + " 0a" + r1(rx) + " " + r1(ry) + " 0 1 0 " + r1(-2 * rx) + " 0z";
      }
      figs.push({ z: p.z, svg: useFig(c, p.k, hx, hy, s * wf * (rnd() < 0.5 ? -1 : 1), s * hf, fill, p.k === "fb" ? hair : null) });
    }
    crowdDefs(c);
    c.add(path(shadows, "#8c7a5c", op(0.35)));
    for (i = 0; i < figs.length && figs[i].z >= clr.z; i++) c.add(figs[i].svg);
    // The luminous space where he stands: only light, no figure.
    c.glow("presence", 450, 682, 250, "#fff8e8", 0.9, 270, 0.3);
    for (; i < figs.length; i++) c.add(figs[i].svg);

    c.vignette("#5a4a32", 0.3, 450, 700, 1050);
    c.grain(0.4);
    return c.svg();
  };

  // Calm neutral gradient for unknown ids.
  function fallback(c) {
    c.add(full(c.lin("bg", 0, 0, 0, 1600, [[0, "#3b3e44"], [0.6, "#5a5751"], [1, "#2c2b29"]])));
    c.vignette("#000", 0.4);
    return c.svg();
  }

  // ---------------------------------------------------------------- public API

  // Point of view can swap a scene for its lying or eye-level counterpart, so a camera
  // change (fx "pov") can simply re-render the current background with the new pov.
  var LYING = { asher_home: "asher_ceiling", lane: "sky_carried", crowd: "crowd_lying" };
  var STANDING = { asher_ceiling: "asher_home", sky_carried: "lane", crowd_lying: "crowd" };

  function resolve(bgId, pov) {
    var id = typeof bgId === "string" ? bgId : "";
    if (pov === "lying" && LYING[id]) return LYING[id];
    if (pov === "standing" && STANDING[id]) return STANDING[id];
    return id;
  }

  BHS.art = {
    ids: IDS.slice(),
    // Returns the bg id that render() will actually draw for this pov.
    resolve: resolve,
    render: function (bgId, opts) {
      var o = opts || {};
      var id = resolve(bgId, o.pov);
      var known = Object.prototype.hasOwnProperty.call(scenes, id);
      var uid = typeof o.uid === "string" && /^[A-Za-z0-9_-]{1,24}$/.test(o.uid) ? o.uid : (++renderCount).toString(36);
      try {
        return known ? scenes[id](new Ctx(id, uid)) : fallback(new Ctx("unknown", uid));
      } catch (err) {
        try { return fallback(new Ctx("unknown", uid)); } catch (e2) {
          return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1600" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" aria-hidden="true"><rect width="900" height="1600" fill="#3b3e44"/></svg>';
        }
      }
    }
  };
})();
