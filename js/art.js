/* Scene backgrounds for "Before He Stood", drawn as inline SVG strings.
   Owner: art agent. See docs/SPEC.md §5.6 (look), §6.6 (BG ids), §7 (guardrails).
   - Classic script, no modules, no fetch, no external assets, no SVG filters.
   - Square canvas (viewBox 0 0 1600 1600) with preserveAspectRatio "xMidYMid slice":
       16:9 screens (TV, laptop) see the band y 350..1250 at full width (text panel covers ~y 980+);
       portrait phones see the band x ~430..1170 at full height (text panel covers ~y 1040+).
     Every scene keeps its focal point in the shared area x 430..1170, y 450..950 and extends
     scenery sideways for landscape and upward for portrait.
   - Jesus is never drawn: crowd scenes only leave an empty, luminous space.
   - No cross-like silhouettes: boats have no masts or yards; poles carry draped nets only.
   - Ids inside each SVG are prefixed with the bg id plus a per-render counter, so any
     number of SVGs (even the same scene twice) can live in one page. */
(function () {
  "use strict";
  var BHS = (window.BHS = window.BHS || {});

  var W = 1600;
  var H = 1600;
  var MX = 800; // horizontal center of the canvas
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

  // Ridge line across the whole canvas closed down to yBottom (hills, far shores).
  function ridge(rnd, y, amp, steps, yBottom) {
    var pts = [];
    for (var i = 0; i <= steps; i++) pts.push([-30 + ((W + 60) * i) / steps, y + (rnd() - 0.5) * 2 * amp]);
    return smooth(pts, false) + "L" + (W + 30) + " " + yBottom + "L-30 " + yBottom + "z";
  }

  // Element helpers.
  function path(d, fill, extra) { return '<path d="' + d + '" fill="' + fill + '"' + (extra || "") + "/>"; }
  function rect(x, y, w, h, fill, extra) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + fill + '"' + (extra || "") + "/>";
  }
  function full(fill, extra) { return '<rect width="1600" height="1600" fill="' + fill + '"' + (extra || "") + "/>"; }
  function ell(cx, cy, rx, ry, fill, extra) {
    return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + fill + '"' + (extra || "") + "/>";
  }
  function op(v) { return ' opacity="' + v + '"'; }
  function line(d, color, width, extra) {
    return '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="' + width + '" stroke-linecap="round"' + (extra || "") + "/>";
  }

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
  // Soft round light: a full-canvas rect filled with a radial falloff.
  Ctx.prototype.glow = function (name, cx, cy, r, color, alpha, ry, mid) {
    var m = mid === undefined ? 0.35 : mid;
    this.add(full(this.rad(name, cx, cy, r, [[0, color, alpha], [m, color, r2(alpha * 0.45)], [1, color, 0]], ry)));
  };
  Ctx.prototype.vignette = function (color, alpha, cx, cy, r) {
    this.add(full(this.rad("vig", cx || MX, cy || 760, r || 1350, [[0, color, 0], [0.5, color, 0], [1, color, alpha]])));
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
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1600" preserveAspectRatio="xMidYMid slice" width="100%" height="100%"' +
      ' class="bhs-art" data-bg="' + this.bg + '" aria-hidden="true" focusable="false">' +
      (this.defs.length ? "<defs>" + this.defs.join("") + "</defs>" : "") + this.body.join("") + "</svg>";
  };

  // ---------------------------------------------------------------- shared builders

  // Fieldstone generator for basalt walls. Stones are laid in courses in wall-local units
  // (u along the wall, v down the wall) and mapped to the canvas by map(u, v) -> [x, y],
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
  function flat(u, v) { return [u, v]; }

  // Herodian-style oil lamp seen from the side, nozzle to the left, flame at the nozzle tip.
  // (x, y) is the wick point, k the lamp scale, fh the flame height in canvas units
  // (0 = unlit). Returns { body, flame } strings so light can be layered between them.
  function oilLamp(c, x, y, fh, k, name) {
    var w = fh * 0.24, b = y, t = y - fh;
    var body = '<g transform="translate(' + x + " " + y + ")scale(" + k + ')">' +
      ell(61, 25, 52, 6, "#000", op(0.5)) +
      path("M30 4L7-3Q-4-4-3 3Q-2 9 8 10L33 15Z", c.lin(name + "n", 0, 0, 40, 0, [[0, "#c88a57"], [1, "#7a4b2f"]])) +
      path("M27 13C29-9 93-11 98 11C91 23 35 24 27 13Z", c.lin(name + "b", 25, 0, 99, 0, [[0, "#c98a56"], [0.45, "#94603c"], [1, "#4f3020"]])) +
      ell(61, -2, 8, 2.6, "#2a180e") +
      path("M96 6q9-2 10 4q-1 6-9 5z", "#5a3824") + "</g>";
    if (!fh) return { body: body, flame: "" };
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
    c.glow("warm", MX, 720, 900, "#3a2614", 0.5, 760, 0.4);
    c.vignette("#000", 0.6);
    return c.svg();
  };

  // Menahem's room. Shared by dawn_lamp and lamp_night so both read as the same place.
  // Portrait band shows window, table and niche; landscape adds a storage jar and an inner door.
  function room(c, night) {
    var rnd = c.rnd, i;
    var wx = 990, wy = 828;                  // wick point of the lamp on the table
    var fh = night ? 30 : 46;                // flame height ("lower" at night)
    var gx = wx, gy = wy - fh * 0.5;         // light center
    var reach = night ? 540 : 720;

    c.add(full(night ? "#0a0b0d" : "#0e0f12"));

    // Back wall: fieldstones that only show where lamp or window light reaches them.
    var tones = night
      ? ["#141517", "#1b1b1c", "#25221f", "#302a24", "#3d342b", "#151a22", "#1a2029"]
      : ["#17181b", "#211f1f", "#2d2824", "#3c332b", "#4f4133", "#1c222c", "#26303c"];
    addStones(c, stones(rnd, flat, {
      u0: 0, u1: W, v0: 150, v1: 852, ch: [46, 70], sw: [72, 138], gap: 4, jit: 5, n: 7,
      tone: function (x, y, r) {
        var dx = x - gx, dy = (y - gy) * 1.2;
        var L = Math.pow(clamp(1 - Math.sqrt(dx * dx + dy * dy) / reach, 0, 1), 1.3);
        var wdx = x - 590, wdy = (y - 600) * 1.25, wd = Math.sqrt(wdx * wdx + wdy * wdy);
        if (L < 0.16 && wd < 250 && r() < 0.85) return wd < 150 ? 6 : 5;
        if (L < 0.07 && r() < 0.75) return -1;
        return clamp(Math.floor(L * 5 + (r() - 0.5) * 1.1), 0, 4);
      }
    }), tones);

    // Ceiling: dark reeds above a heavy wall-plate beam (portrait only).
    c.add(rect(0, 0, W, 104, "#09090a"));
    c.add(path("M0 100L1600 92V140L0 148Z", night ? "#211913" : "#291f18"));
    c.add(path("M0 141L1600 133V144L0 152Z", night ? "#2b2118" : "#3a2b1f"));

    // Small high window: deep basalt reveal; its sky is drawn after the lamplight.
    c.add(path("M486 498L682 494V522L486 526Z", night ? "#221a13" : "#2b2018"));
    c.add(path("M486 518L682 514V522L486 526Z", night ? "#302419" : "#463428"));
    c.add(path(poly([[500, 522], [536, 527], [536, 674], [500, 690]]), night ? "#171c25" : "#353e4c"));
    c.add(path(poly([[500, 690], [668, 690], [668, 674], [536, 674]]), night ? "#1c2230" : "#56657a"));
    c.add(path(poly([[500, 522], [668, 520], [668, 527], [536, 527]]), night ? "#11151c" : "#28303b"));
    c.glow("win", 600, 610, 300, night ? "#5b74a0" : "#86a2c8", night ? 0.07 : 0.2);

    // Wall niche with two rolled scrolls.
    c.add(path(poly([[1018, 540], [1140, 538], [1140, 558], [1018, 560]]), night ? "#2a241e" : "#383029"));
    c.add(rect(1026, 558, 106, 124, "#09090a"));
    c.add(rect(1042, 620, 78, 20, night ? "#56462f" : "#6f5c41", ' rx="9"'));
    c.add(rect(1036, 640, 86, 22, night ? "#625138" : "#7f6a4c", ' rx="10"'));
    c.add(ell(1047, 630, 5, 9, night ? "#94805c" : "#b9a27a"));
    c.add(ell(1041, 651, 5, 10, night ? "#a08a64" : "#c8b088"));

    // Landscape extras: a doorway to the inner room and a storage jar, both in shadow.
    c.add(path("M1306 540L1486 536V562L1306 566Z", night ? "#1d1610" : "#261c14"));
    c.add(rect(1320, 562, 152, 286, "#050506"));
    c.add(path("M232 852C204 790 214 726 252 700C246 690 250 682 262 680H318C330 682 334 690 328 700C366 726 376 790 348 852Z",
      c.lin("sjar", 214, 0, 376, 0, [[0, "#141313"], [0.75, night ? "#1d2029" : "#262c38"], [1, "#151517"]])));

    // Floor.
    c.add(rect(0, 846, W, 754, c.lin("floor", 0, 846, 0, 1400, [[0, night ? "#14110f" : "#191511"], [1, "#090807"]])));
    c.add(rect(0, 846, W, 3, "#000", op(0.4)));

    // Low table with a deep top so the scroll reads clearly.
    c.add(path(poly([[576, 796], [1144, 796], [1202, 902], [518, 902]]),
      c.lin("top", 518, 0, 1202, 0, [[0, night ? "#20170f" : "#271c13"], [0.68, night ? "#4a3523" : "#5e432a"], [1, night ? "#33251a" : "#3e2c1d"]])));
    c.add(rect(518, 902, 684, 26, "#1c130c"));
    c.add(rect(536, 928, 28, 78, "#130d08"));
    c.add(rect(1156, 928, 28, 78, "#130d08"));
    c.add(ell(860, 1008, 360, 18, "#000", op(0.5)));

    var ln = "";
    if (!night) {
      // Open scroll: parchment between two rolled ends, faint ruled columns (no letters).
      c.add(path(poly([[684, 808], [916, 808], [944, 884], [654, 884]]),
        c.lin("sheet", 654, 0, 944, 0, [[0, "#bfa47a"], [0.7, "#ead6ab"], [1, "#f3e2b9"]])));
      for (i = 0; i < 8; i++) {
        var y = lerp(816, 876, i / 7), f = (y - 808) / 76;
        var xl = lerp(684, 654, f) + 18, xr = lerp(916, 944, f) - 18, mid = (xl + xr) / 2;
        ln += "M" + ri(xl) + " " + ri(y) + "h" + ri((mid - 10 - xl) * (i === 7 ? 0.5 : 0.86 + rnd() * 0.14)) +
          "M" + ri(mid + 10) + " " + ri(y) + "h" + ri((xr - mid - 10) * (0.78 + rnd() * 0.22));
      }
      c.add(line(ln, "#6b563b", 2, op(0.42)));
      c.add(path("M641 882L672 802Q683 799 692 810L667 892Q650 895 641 882Z", "#a3855a"));
      c.add(ell(654, 888, 14, 6, "#d6bf91"));
      c.add(path("M957 882L926 802Q915 799 906 810L931 892Q948 895 957 882Z", "#b8996b"));
      c.add(ell(944, 888, 14, 6, "#ead29f"));
    } else {
      // Notes for the night: a closed scroll, loose sheets, ink and a reed pen.
      c.add(rect(618, 800, 196, 18, "#7a6446", ' rx="9"'));
      c.add(ell(622, 809, 5, 9, "#b0976c"));
      c.add(path(poly([[680, 826], [796, 820], [806, 868], [676, 876]]), "#b39a73"));
      c.add(path(poly([[770, 834], [890, 840], [880, 888], [758, 882]]), "#cbb58c"));
      for (i = 0; i < 5; i++) {
        var yy = 848 + i * 8;
        ln += "M" + (776 - i) + " " + yy + "l" + ri(80 + rnd() * 18 - (i === 4 ? 40 : 0)) + " 3";
      }
      c.add(line(ln, "#5d4a35", 1.6, op(0.5)));
      c.add(line("M820 896L940 872", "#6e5638", 3.4));
      c.add(rect(924, 832, 26, 26, "#1b1714"));
      c.add(ell(937, 832, 13, 4, "#2e2721"));
      c.add(ell(937, 832, 8, 2.4, "#070606"));
    }

    var lamp = oilLamp(c, wx, wy, fh, 1.35, "lamp");
    c.add(lamp.body);

    // Lamplight on the wall, the table and the floor.
    c.add(full(c.rad("light", gx, gy, reach, night
      ? [[0, "#ffbf72", 0.42], [0.12, "#f0a050", 0.24], [0.4, "#b86a2c", 0.08], [1, "#6a3d18", 0]]
      : [[0, "#ffd08c", 0.5], [0.12, "#f5ae5e", 0.3], [0.4, "#c77a33", 0.11], [1, "#7a4a1f", 0]], reach * 0.9)));

    // Sky through the window stays cool (drawn after the warm light).
    c.add(rect(536, 527, 132, 147, c.lin("sky", 0, 527, 0, 674, night
      ? [[0, "#04070d"], [0.6, "#0b1222"], [1, "#141d31"]]
      : [[0, "#192846"], [0.5, "#34507a"], [0.85, "#829db6"], [1, "#b3b2a6"]])));
    c.add(path("M536 654L600 649L668 645V674H536Z", night ? "#020305" : "#0d1119"));
    c.add(rect(640, 637, 11, 9, night ? "#020305" : "#0d1119"));
    c.add(ell(648, 552, 1.8, 1.8, "#eef2f9", op(night ? 0.9 : 0.7)));
    if (night) c.add(ell(576, 586, 1.3, 1.3, "#dfe6f2", op(0.7)));

    // Flame and halo on top.
    c.glow("halo", wx, ri(wy - fh * 0.55), night ? 66 : 92, "#fff0c8", night ? 0.7 : 0.85, 0, 0.3);
    c.add(lamp.flame);

    c.vignette("#000", night ? 0.85 : 0.75, gx - 100, gy - 40, night ? 1100 : 1250);
    c.grain(0.35, 0.25);
    return c.svg();
  }
  scenes.dawn_lamp = function (c) { return room(c, false); };
  scenes.lamp_night = function (c) { return room(c, true); };

  // Narrow lane of black basalt houses sloping down to the lake, late morning.
  // Drawn with a simple pinhole camera so stones, steps and shadows share one perspective.
  scenes.lane = function (c) {
    var rnd = c.rnd;
    var F = 900, CY = 600, EYE = 1.6, G = 0.11;
    var XL = -1.55, XR = 1.5, ZN = 1.0, ZEND = 13.5;
    function fl(z) { return -G * z; }
    function P(x, y, z) { return [MX + (F * x) / z, CY - (F * (y - EYE)) / z]; }
    function Pf(x, z) { return P(x, fl(z), z); }
    var i, z;

    // Sky, far hills, lake.
    c.add(rect(0, 0, W, 606, c.lin("sky", 0, 0, 0, 600, [[0, "#6894b9"], [0.55, "#a6c3d4"], [1, "#e1e8e3"]])));
    c.add(path(ridge(rnd, 586, 6, 9, 606), "#b3bfc2"));
    c.add(path(ridge(rnd, 594, 4, 12, 606), "#95a5ad"));
    var shoreY = Pf(0, 26)[1];
    c.add(rect(0, 600, W, ri(shoreY - 596), c.lin("lake", 0, 600, 0, ri(shoreY), [[0, "#b4cad0"], [0.18, "#86abbb"], [1, "#4f7f97"]])));
    var gl = "";
    for (i = 0; i < 18; i++) {
      var gy = 606 + Math.pow(rnd(), 1.4) * (shoreY - 616), gw = 6 + (rnd() * 26 * (gy - 590)) / 100;
      gl += "M" + ri(690 + rnd() * 210) + " " + ri(gy) + "h" + ri(gw);
    }
    c.add(line(gl, "#f6f3e8", 2.2, op(0.7)));

    // Open shore at the bottom of the slope and a beached boat (no mast).
    c.add(path(poly([Pf(-30, 26), Pf(30, 26), Pf(30, ZEND), Pf(-30, ZEND)]), "#dccba7"));
    c.add(rect(0, ri(shoreY) - 1, W, 3, "#f2f0e6", op(0.8)));
    var b0 = P(-0.7, fl(22) + 0.75, 22), b1 = P(1.0, fl(22) + 0.75, 22), bb = Pf(0.15, 22);
    c.add(path("M" + ri(b0[0] - 6) + " " + ri(b0[1] - 5) + "Q" + ri(bb[0]) + " " + ri(b0[1] + 6) + " " + ri(b1[0] + 6) + " " + ri(b1[1] - 7) +
      "L" + ri(b1[0] - 4) + " " + ri(bb[1] - 6) + "Q" + ri(bb[0]) + " " + ri(bb[1] + 3) + " " + ri(b0[0] + 6) + " " + ri(bb[1] - 5) + "Z", "#3e3129"));
    c.add(path(poly([[b0[0] - 5, b0[1] - 5], [b1[0] + 5, b1[1] - 7], [b1[0] + 3, b1[1] - 2], [b0[0] - 3, b0[1]]]), "#7a6450"));

    // Houses: [z0, z1, height]. Roofs step down with the slope.
    var left = [[1.0, 5.6, 3.55], [5.6, 9.8, 3.3], [9.8, ZEND, 2.3]];
    var right = [[1.0, 4.9, 3.6], [4.9, 9.2, 3.25], [9.2, ZEND, 2.35]];

    function wall(x, houses, lit) {
      var tones = lit ? ["#4b4944", "#58554f", "#66625a", "#747066", "#848075"] : ["#24272c", "#2a2e33", "#30353b", "#383d43"];
      for (var h = 0; h < houses.length; h++) {
        var z0 = houses[h][0], z1 = houses[h][1], top = fl(z0) + houses[h][2];
        c.add(path(poly([P(x, top, z0), P(x, top, z1), Pf(x, z1), Pf(x, z0)]), lit ? "#3a3733" : "#1c1f23"));
        (function (topY) {
          addStones(c, stones(rnd, function (u, v) { return P(x, topY - v, u); }, {
            u0: z0, u1: z1, v0: 0.26, v1: houses[h][2] + G * (z1 - z0) + 0.2, ch: [0.26, 0.4], sw: [0.45, 0.9],
            gap: 0.035, jit: 0.05, n: tones.length, skip: lit ? 0.14 : 0.42, minW: 5,
            keep: function (u, v) { return topY - v > fl(u) - 0.1; },
            tone: function (cx, cy, r, u, v) {
              var t = r() * tones.length;
              if (lit && v < 0.9) t += 0.8;
              return Math.floor(t);
            }
          }), tones);
        })(top);
        // Roof edge band (packed mud over reeds) and short protruding beam ends.
        c.add(path(poly([P(x, top + 0.04, z0), P(x, top + 0.04, z1), P(x, top - 0.26, z1), P(x, top - 0.26, z0)]), lit ? "#6f6253" : "#2a2927"));
        if (z0 < 9.5) {
          var be = "", bl = "", dx = lit ? -0.17 : 0.17;
          for (z = z0 + 0.5; z < z1 - 0.3; z += 1.1) {
            be += poly([P(x, top - 0.1, z), P(x + dx, top - 0.1, z), P(x + dx, top - 0.22, z), P(x, top - 0.22, z)]);
            bl += poly([P(x + dx, top - 0.1, z), P(x + dx, top - 0.1, z + 0.12), P(x + dx, top - 0.22, z + 0.12), P(x + dx, top - 0.22, z)]);
          }
          c.add(path(be, lit ? "#4a3a2a" : "#1c1712"));
          c.add(path(bl, lit ? "#9c8463" : "#2e2720"));
        }
      }
    }
    wall(XL, left, false);
    wall(XR, right, true);

    // Doorway in the sunlit wall, with a wooden lintel and a clay jar beside it.
    var dz0 = 3.9, dz1 = 4.65, dtop = fl(dz0) + 1.62;
    c.add(path(poly([P(XR, dtop, dz0), P(XR, dtop, dz1), Pf(XR, dz1), Pf(XR, dz0)]),
      c.lin("door", 0, 620, 0, 1000, [[0, "#191817"], [1, "#2b2926"]])));
    c.add(path(poly([P(XR, dtop + 0.16, dz0 - 0.15), P(XR, dtop + 0.16, dz1 + 0.12), P(XR, dtop, dz1 + 0.12), P(XR, dtop, dz0 - 0.15)]), "#5b4733"));
    var jz = 3.45, jx = 1.22, jb = Pf(jx, jz), jt = P(jx, fl(jz) + 0.62, jz), jw = (F * 0.19) / jz;
    c.add(path("M" + ri(jb[0] - jw * 0.55) + " " + ri(jb[1]) + "C" + ri(jb[0] - jw * 1.25) + " " + ri(lerp(jb[1], jt[1], 0.5)) + " " +
      ri(jb[0] - jw * 0.9) + " " + ri(jt[1] + 8) + " " + ri(jb[0] - jw * 0.32) + " " + ri(jt[1]) + "H" + ri(jb[0] + jw * 0.32) + "C" +
      ri(jb[0] + jw * 0.9) + " " + ri(jt[1] + 8) + " " + ri(jb[0] + jw * 1.25) + " " + ri(lerp(jb[1], jt[1], 0.5)) + " " + ri(jb[0] + jw * 0.55) + " " + ri(jb[1]) + "Z",
    c.lin("jar", jb[0] - jw, 0, jb[0] + jw, 0, [[0, "#c27a4e"], [0.5, "#9a5c3a"], [1, "#5e3622"]])));

    // Lane floor: sunlit limestone dust with shallow steps; the left houses shade part of it.
    c.add(path(poly([Pf(XL, ZN), Pf(XL, ZEND), Pf(XR, ZEND), Pf(XR, ZN)]),
      c.lin("lanef", 0, 800, 0, 1500, [[0, "#e2d3b2"], [1, "#c9b48c"]])));
    var cob = "";
    for (i = 0; i < 26; i++) {
      z = 1.6 + Math.pow(rnd(), 1.5) * 7;
      var cx0 = lerp(XL + 0.15, XR - 0.15, rnd()), a = 0.04 + rnd() * 0.06, b2 = 0.03 + rnd() * 0.05;
      cob += poly([Pf(cx0 - a, z), Pf(cx0, z - b2), Pf(cx0 + a, z), Pf(cx0 + a * 0.6, z + b2), Pf(cx0 - a * 0.7, z + b2)]);
    }
    c.add(path(cob, "#bfae8c"));
    var stepD = "", stepL = "";
    for (z = 2.6; z < 13; z += 1.05) {
      stepD += poly([Pf(XL, z), Pf(XR, z), P(XR, fl(z) - 0.08, z), P(XL, fl(z) - 0.08, z)]);
      stepL += poly([P(XL, fl(z) + 0.01, z - 0.03), P(XR, fl(z) + 0.01, z - 0.03), Pf(XR, z), Pf(XL, z)]);
    }
    c.add(path(stepD, "#b7a586"));
    c.add(path(stepL, "#f1e7cf", op(0.55)));
    var sh = [Pf(XL, ZN)];
    for (i = 0; i < left.length; i++) {
      var hh = left[i][2], e = 0.26 * hh, d = 0.5 * hh;
      if (i === 0) sh.push(Pf(XL + e, ZN));
      sh.push(Pf(XL + e, Math.max(ZN, left[i][0] - d)), Pf(XL + e, left[i][1] - d));
    }
    sh.push(Pf(XL, ZEND));
    c.add(path(poly(sh), "#58606a", op(0.5)));

    // Haze that makes the bottom of the slope glow, light vignette and grain.
    c.glow("haze", 805, 660, 420, "#fffaf0", 0.34, 300);
    c.vignette("#1a1c20", 0.35, MX, 700, 1300);
    c.grain(0.3, 0.5);
    return c.svg();
  };

  // ---------------------------------------------------------------- crowd figures

  // Figure templates in local units: head radius 1, head center at the origin, feet at y = 14.5.
  // Fill comes from the <use> element; "color" sets hair (back views) or skin (front views).
  // Faces never get features: a skin oval, a hair or hood shadow, sometimes a beard shadow.
  function crowdDefs(c) {
    var body = '<path d="M-.45.8Q-1.9 1-2.05 2.3L-2.3 14.5H2.3L2.05 2.3Q1.9 1 .45.8Z"/>';
    var hood = '<path d="M0-1.25C1.25-1.25 1.32.4 1.15 1.1Q2.2 1.4 2.3 2.6L2.45 14.5H-2.45L-2.3 2.6Q-2.2 1.4-1.15 1.1C-1.32.4-1.25-1.25 0-1.25Z"/>';
    var shade = path("M-2.2 7.5H2.2L2.45 14.5H-2.45Z", "#000", op(0.16));
    var fold = path("M-.5 3.2L-.85 14.5H-.45L-.2 3.4Z", "#000", op(0.12));
    var sLight = path("M-.45.8Q-1.9 1-2.05 2.3Q-1.5 1.5-.3 1.25ZM.45.8Q1.9 1 2.05 2.3Q1.5 1.5.3 1.25Z", "#fff", op(0.18));
    var hLight = path("M-1.05-.55C-.95-1.32.95-1.32 1.05-.55C.7-1.02-.7-1.02-1.05-.55ZM-1.15 1.1Q-2.2 1.4-2.3 2.6Q-1.7 1.75-1 1.45ZM1.15 1.1Q2.2 1.4 2.3 2.6Q1.7 1.75 1 1.45Z", "#fff", op(0.2));
    function g(name, inner) { c.def('<g id="' + c.id(name) + '">' + inner + "</g>"); }
    // Back views.
    g("fb", body + shade + sLight + '<ellipse rx=".9" ry="1.05" fill="currentColor"/>' +
      path("M-.72-.5C-.55-1.12.55-1.12.72-.5C.4-.82-.4-.82-.72-.5Z", "#fff", op(0.22)));
    g("fh", hood + shade + fold + hLight);
    // Front views.
    g("fa", body + shade + sLight + '<ellipse cy=".05" rx=".85" ry="1.02" fill="currentColor"/>' +
      path("M-.88-.05C-.98-1.3.98-1.3.88-.05C.62-.62-.62-.62-.88-.05Z", "#000", op(0.6)) +
      path("M-.72.38Q-.62 1.16 0 1.22Q.62 1.16.72.38Q.36.72 0 .74Q-.36.72-.72.38Z", "#000", op(0.4)));
    g("fc", hood + shade + fold + '<ellipse cy=".2" rx=".62" ry=".8" fill="currentColor"/>' +
      path("M-.66.06Q0-.52.66.06Q.5-.38 0-.44Q-.5-.38-.66.06Z", "#000", op(0.35)) + hLight);
    // Scribe: pale mantle drawn over the head with dark bands near the hem, tunic below.
    g("fs", path("M-2.2 9.5H2.2L2.35 14.5H-2.35Z", "#8f918c") +
      '<path d="M0-1.3C1.3-1.3 1.36.4 1.2 1.1Q2.25 1.4 2.4 2.6L2.6 10.2Q0 10.9-2.6 10.2L-2.4 2.6Q-2.25 1.4-1.2 1.1C-1.36.4-1.3-1.3 0-1.3Z"/>' +
      path("M-2.4 6.5H2.4L2.6 10.2Q0 10.9-2.6 10.2Z", "#000", op(0.1)) +
      path("M-2.57 9.2Q0 9.85 2.57 9.2L2.58 9.6Q0 10.25-2.58 9.6ZM-2.53 8.4Q0 9 2.53 8.4L2.54 8.7Q0 9.3-2.54 8.7Z", "#2d3340") +
      path("M-2.62 10.1l.16 1.2h.24l-.06-1.15ZM2.62 10.1l-.16 1.2h-.24l.06-1.15Z", "#efe9da") +
      path("M-1.1-.6C-1-1.38 1-1.38 1.1-.6C.75-1.08-.75-1.08-1.1-.6ZM-1.2 1.1Q-2.25 1.4-2.4 2.6Q-1.75 1.75-1 1.45ZM1.2 1.1Q2.25 1.4 2.4 2.6Q1.75 1.75 1 1.45Z", "#fff", op(0.3)));
  }
  function useFig(c, kind, x, y, sx, sy, fill, color) {
    var p = Math.abs(sy) < 9 ? r1 : ri;
    return '<use href="#' + c.id(kind) + '" transform="translate(' + p(x) + " " + p(y) + ")scale(" + r2(sx) + " " + r2(sy) + ')" fill="' + fill + '"' +
      (color ? ' color="' + color + '"' : "") + "/>";
  }

  var CLOTH = ["#b7a785", "#6e5642", "#45506a", "#7b4536", "#a3824e", "#5d6243", "#3d3b38", "#c9bea6", "#8a6f55", "#5a4c5e", "#94846a"];
  var HAIR = ["#2b231d", "#3a2c22", "#1f1b18", "#4a3a2c"];
  var SKIN = ["#b07a55", "#9c6a49", "#c08a63", "#8a5c3f"];

  // Open ground at the edge of town near the shore, noon. Seen from a slight rise: a dense ring
  // of people frames an empty, brighter clearing; the scribes stand at its front-left edge.
  // The clearing holds only light (Jesus is never drawn); the crowd is parted toward his boat.
  scenes.crowd = function (c) {
    var rnd = c.rnd, wr = prng(4242), i, t, x, z;
    var F = 1100, HZ = 400, CAM = 2.5;
    var ZC = 8.4, RX = 1.75, RZ = 1.95;
    function X(px, pz) { return MX + (F * px) / pz; }
    function Y(py, pz) { return HZ + (F * (CAM - py)) / pz; }
    function ed(px, pz) { var a = px / RX, b = (pz - ZC) / RZ; return Math.sqrt(a * a + b * b); }
    var shoreY = Y(0, 36);

    // Noon sky with glare and thin high cloud, the far shore, the lake.
    c.add(rect(0, 0, W, HZ + 10, c.lin("sky", 0, 0, 0, HZ, [[0, "#98b9cf"], [0.65, "#cad9df"], [1, "#efeee6"]])));
    c.glow("glare", MX, -80, 950, "#fffef8", 0.55, 420);
    c.add(path("M180 220Q520 196 900 214Q620 232 180 220ZM860 300Q1160 284 1480 296Q1200 312 860 300Z", "#ffffff", op(0.4)));
    c.add(path(ridge(rnd, HZ - 14, 6, 10, HZ + 6), "#bcc5c6"));
    c.add(path(ridge(rnd, HZ - 6, 4, 14, HZ + 6), "#a8b4b7"));
    c.add(rect(0, HZ, W, ri(shoreY - HZ + 4), c.lin("lake", 0, HZ, 0, ri(shoreY), [[0, "#c4d3d5"], [1, "#8eafbd"]])));
    var gl = "";
    for (i = 0; i < 26; i++) gl += "M" + ri(rnd() * W) + " " + ri(HZ + 4 + rnd() * (shoreY - HZ - 10)) + "h" + ri(10 + rnd() * 30);
    c.add(line(gl, "#ffffff", 2.2, op(0.75)));

    // Edge of town on the left: basalt houses near the shore (landscape only).
    function house(x0, x1, z0, z1, h) {
      var a = [X(x0, z0), Y(h, z0)], b = [X(x1, z0), Y(h, z0)], b2 = [X(x1, z0), Y(0, z0)], a2 = [X(x0, z0), Y(0, z0)];
      var s1 = [X(x1, z1), Y(h, z1)], s2 = [X(x1, z1), Y(0, z1)];
      c.add(path(poly([b, s1, s2, b2]), "#8a8b88"));
      c.add(path(poly([a, b, b2, a2]), "#646a70"));
      c.add(path(poly([a, s1, [s1[0], s1[1] + 3], [a[0], a[1] + 3]]), "#c2bfb5"));
      var dx = lerp(a[0], b[0], 0.62), dw = (F * 0.45) / z0, dh = (F * 1.5) / z0;
      c.add(rect(ri(dx), ri(a2[1] - dh), ri(dw), ri(dh), "#3b3d40"));
    }
    house(-10.5, -6.6, 28, 32, 3.0);
    house(-17, -10.2, 21, 26, 3.2);

    // His boat, pulled up at the end of the parted crowd (no mast).
    var k0 = X(-2.1, 33), k1 = X(2.1, 33), kt = Y(0.85, 33), kb = Y(0, 33);
    c.add(path("M" + ri(k0) + " " + ri(kt - 4) + "Q" + MX + " " + ri(kt + 8) + " " + ri(k1) + " " + ri(kt - 8) + "L" + ri(k1 - 10) + " " + ri(kb - 4) +
      "Q" + MX + " " + ri(kb + 4) + " " + ri(k0 + 12) + " " + ri(kb - 3) + "Z", "#4a3c31"));
    c.add(path("M" + ri(k0 + 10) + " " + ri(kt - 1) + "Q" + MX + " " + ri(kt + 8) + " " + ri(k1 - 10) + " " + ri(kt - 4) + "L" + ri(k1 - 10) + " " + ri(kt + 1) +
      "Q" + MX + " " + ri(kt + 12) + " " + ri(k0 + 10) + " " + ri(kt + 4) + "Z", "#d9d0bb"));

    // Ground and the clearing: a brighter patch (the UI adds the warm light on top).
    c.add(rect(0, ri(shoreY), W, H - ri(shoreY), c.lin("ground", 0, ri(shoreY), 0, 1150, [[0, "#e4d8ba"], [0.35, "#ddcaa3"], [1, "#c6ab80"]])));
    c.add(rect(0, ri(shoreY) - 1, W, 3, "#f4f1e6", op(0.7)));
    var gy = Y(0, ZC), gry = (Y(0, ZC - RZ) - Y(0, ZC + RZ)) / 2, grx = (F * RX) / ZC;
    c.add(ell(MX, ri(gy), ri(grx * 1.3), ri(gry * 1.35), c.rad("clr", MX, ri(gy), ri(grx * 1.3),
      [[0, "#fffaea", 1], [0.55, "#fbf0d6", 0.85], [1, "#f3e4c2", 0]], ri(gry * 1.35))));

    // People live in world coordinates (meters); wr keeps their placement independent of decoration.
    var people = [];
    function open(px, pz) {
      if (ed(px, pz) < 1.12) return true;                                    // the clearing
      if (pz < ZC && Math.abs(px) < 1.0) return true;                        // open front, where the bed came in
      if (pz > ZC && Math.abs(px) < 0.7 + 0.12 * (pz - ZC)) return true;     // parted toward the boat
      if (pz > 5.2 && pz < 6.55 && px < -0.6 && px > -2.6) return true;      // keep the scribes in view
      if (px < -6 && pz > 19) return true;                                   // houses at the edge of town
      return false;
    }
    function spaced(px, pz, d) {
      for (var k = 0; k < people.length; k++) {
        var q = people[k], a = q.x - px, b = q.z - pz;
        if (a * a + b * b < d * d) return false;
      }
      return true;
    }
    function person(px, pz, kind) {
      people.push({ x: px, z: pz, k: kind, cloth: CLOTH[Math.floor(wr() * CLOTH.length)], hair: HAIR[Math.floor(wr() * HAIR.length)],
        skin: SKIN[Math.floor(wr() * SKIN.length)], hood: wr() < 0.5, w: 0.88 + wr() * 0.26, h: 0.94 + wr() * 0.1, flip: wr() < 0.5 });
    }
    person(-0.9, 6.6, "fs"); person(-1.5, 6.85, "fs"); person(-2.1, 7.2, "fs");
    var near = [[-1.2, 3.3], [1.25, 3.4], [-2.5, 3.9], [2.6, 3.7], [-4.0, 4.3], [4.1, 4.4], [-1.9, 4.9], [1.95, 5.0], [-5.6, 5.4], [5.5, 5.6], [-3.2, 5.9], [3.3, 6.0]];
    for (i = 0; i < near.length; i++) person(near[i][0], near[i][1]);
    t = 0;
    while (t++ < 3000 && people.length < 90) {
      var th = wr() * Math.PI * 2, d = 1.16 + Math.pow(wr(), 1.4) * 2.2;
      x = d * RX * Math.cos(th); z = ZC + d * RZ * Math.sin(th);
      if (!open(x, z) && spaced(x, z, 0.5)) person(x, z);
    }
    t = 0;
    while (t++ < 5000 && people.length < 170) {
      z = Math.sqrt(lerp(5.4 * 5.4, 30 * 30, wr()));
      x = (wr() * 2 - 1) * (z * 0.75 + 0.5);
      var dd = ed(x, z);
      if (open(x, z) || wr() > 0.22 + 0.78 * Math.exp(-((dd - 2) * (dd - 2)) / 12)) continue;
      if (spaced(x, z, z > 15 ? 0.7 : 0.58)) person(x, z);
    }
    people.sort(function (a, b) { return b.z - a.z; });

    crowdDefs(c);
    var shadows = "", figs = [];
    for (i = 0; i < people.length; i++) {
      var p = people[i], s = (F * 0.11) / p.z, hx = X(p.x, p.z), hy = Y(1.6, p.z);
      if (hx + 3 * s < -10 || hx - 3 * s > W + 10) continue;
      var front = p.z > ZC + 0.4;
      var kind = p.k || (front ? (p.hood ? "fc" : "fa") : (p.hood ? "fh" : "fb"));
      var haze = clamp((p.z - 7) / 26, 0, 0.6), dark = clamp((5.6 - p.z) / 4.5, 0, 0.38);
      var fill = mix(mix(kind === "fs" ? "#e4ddca" : p.cloth, "#dcd6c8", haze), "#25211e", dark);
      var col = kind === "fb" ? p.hair : kind === "fa" || kind === "fc" ? p.skin : null;
      if (col) col = mix(mix(col, "#dcd6c8", haze), "#25211e", dark);
      if (p.z > 4.6 && p.z < 20) {
        var fy = hy + 14.5 * s * p.h, rx = 2.3 * s * p.w, ry = 0.42 * s;
        shadows += "M" + r1(hx - rx) + " " + r1(fy) + "a" + r1(rx) + " " + r1(ry) + " 0 1 0 " + r1(2 * rx) + " 0a" + r1(rx) + " " + r1(ry) + " 0 1 0 " + r1(-2 * rx) + " 0z";
      }
      figs.push({ z: p.z, svg: useFig(c, kind, hx, hy, s * p.w * (p.flip ? -1 : 1), s * p.h, fill, col) });
    }
    c.add(path(shadows, "#8c7a5c", op(0.32)));
    for (i = 0; i < figs.length && figs[i].z > ZC + 0.4; i++) c.add(figs[i].svg);
    // The luminous space where he stands: only light, never a figure.
    c.glow("presence", MX, 640, 300, "#fff8e8", 0.55, 330, 0.3);
    for (; i < figs.length; i++) c.add(figs[i].svg);

    c.vignette("#5a4a32", 0.32, MX, 700, 1300);
    c.grain(0.25, 0.6);
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
  var TIMES = { day: 1, evening: 1, night: 1 };

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
    // opts: { pov?: "normal"|"lying"|"standing", time?: "day"|"evening"|"night", uid?: string }
    render: function (bgId, opts) {
      var o = opts || {};
      var id = resolve(bgId, o.pov);
      var known = Object.prototype.hasOwnProperty.call(scenes, id);
      var uid = typeof o.uid === "string" && /^[A-Za-z0-9_-]{1,24}$/.test(o.uid) ? o.uid : (++renderCount).toString(36);
      var so = { pov: o.pov, time: TIMES[o.time] ? o.time : "day" };
      try {
        return known ? scenes[id](new Ctx(id, uid), so) : fallback(new Ctx("unknown", uid));
      } catch (err) {
        try { return fallback(new Ctx("unknown", uid)); } catch (e2) {
          return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1600" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" aria-hidden="true"><rect width="1600" height="1600" fill="#3b3e44"/></svg>';
        }
      }
    }
  };
})();
