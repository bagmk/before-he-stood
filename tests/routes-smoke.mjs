// tests/routes-smoke.mjs - plays the REAL route files through the engine and reports anything the
// engine cannot handle. Run: node tests/routes-smoke.mjs   (exit code 1 on errors, 0 on warnings only)
// Complements tools/validate.mjs; this checks engine compatibility, not prose rules.
// Version 3 routes: 4 choices (c1-c4), the last counts double; scribe and friend have one cut option.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
globalThis.window = globalThis;

const FILES = [
  "data/meta.js",
  "data/characters.js",
  "data/scripture.js",
  "data/common.js",
  "data/ui-strings.js",
  "data/routes/scribe.js",
  "data/routes/friend.js",
  "data/routes/asher.js",
  "js/engine.js",
  "js/art.js"
];
const missingFiles = [];
for (const rel of FILES) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    missingFiles.push(rel);
    continue;
  }
  vm.runInThisContext(fs.readFileSync(file, "utf8"), { filename: file });
}

const BHS = globalThis.BHS;
const E = BHS.engine;
const errors = [];
const warns = [];
const err = (r, msg) => errors.push(`[${r}] ${msg}`);
const warn = (r, msg) => warns.push(`[${r}] ${msg}`);

const BG_IDS = ["black", "dawn_lamp", "shore_dawn", "asher_ceiling", "asher_home", "lane", "sky_carried", "crowd", "crowd_lying", "road_home", "doorway_evening", "lamp_night"];
const FX = ["light", "hush", "echoVerse", "pinThought", "readReceipt", "unpinThought", "pov", "actionReply", "actionsHide", "actionsShow"];
const PSEUDO = ["narrator", "thought", "sign"];
const TOKEN = /\{\{\s*(v|r|var)\s*:\s*([A-Za-z0-9_]+)\s*\}\}/g;

function isT(t) {
  return t && typeof t === "object" && typeof t.ko === "string" && typeof t.en === "string" && t.ko.length > 0 && t.en.length > 0;
}

function checkT(r, where, t) {
  if (!isT(t)) {
    err(r, `${where}: not a T {ko,en} with both non-empty`);
    return;
  }
  for (const lang of ["ko", "en"]) {
    let m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(t[lang]))) {
      const [, kind, key] = m;
      if (kind === "v" || kind === "r") {
        const s = BHS.scripture && BHS.scripture[key];
        if (!s) err(r, `${where}: unknown scripture key ${key}`);
        else if (kind === "v" && s.refOnly) err(r, `${where}: {{v:${key}}} uses a refOnly key`);
      }
    }
    if (/\n/.test(t[lang])) err(r, `${where}: line break inside ${lang}`);
    if (/<[a-z]/i.test(t[lang])) warn(r, `${where}: looks like HTML in ${lang}`);
  }
}

function walkBeats(r, route, list, where, ctx) {
  if (!Array.isArray(list)) {
    if (list != null) err(r, `${where}: not an array`);
    return;
  }
  list.forEach((b, i) => {
    const w = `${where}[${i}]${b && b.id ? "#" + b.id : ""}`;
    if (!b || typeof b !== "object") return err(r, `${w}: not an object`);
    switch (b.type) {
      case "scene":
        if (!BG_IDS.includes(b.bg)) err(r, `${w}: unknown bg ${b.bg}`);
        if (b.caption) checkT(r, w + ".caption", b.caption);
        if (b.pov && !["normal", "lying", "standing"].includes(b.pov)) err(r, `${w}: bad pov ${b.pov}`);
        if (b.time && !["day", "evening", "night"].includes(b.time)) err(r, `${w}: bad time ${b.time}`);
        if (BHS.art && BHS.art.ids && !BHS.art.ids.includes(b.bg)) warn(r, `${w}: art module does not list ${b.bg}`);
        break;
      case "line": {
        const sp = b.speaker || "narrator";
        if (!PSEUDO.includes(sp) && !(BHS.characters && BHS.characters[sp])) err(r, `${w}: unknown speaker ${sp}`);
        if (sp === "jesus") err(r, `${w}: Jesus may speak only through verse beats`);
        checkT(r, w + ".text", b.text);
        break;
      }
      case "verse": {
        const s = BHS.scripture && BHS.scripture[b.key];
        if (!s) err(r, `${w}: unknown verse key ${b.key}`);
        else if (s.refOnly) err(r, `${w}: verse beat uses refOnly key ${b.key}`);
        if (b.speaker && !["jesus", "scribes", "narrator"].includes(b.speaker)) err(r, `${w}: bad verse speaker ${b.speaker}`);
        break;
      }
      case "choice": {
        if (ctx.inReaction) err(r, `${w}: choice inside a reaction`);
        ctx.choices.push(b);
        checkT(r, w + ".prompt", b.prompt);
        if (!Array.isArray(b.options) || b.options.length !== 4) err(r, `${w}: needs exactly 4 options`);
        (b.options || []).forEach((o, k) => {
          const ow = `${w}.${o && o.id}`;
          if (!o || o.id !== "abcd"[k]) err(r, `${ow}: option ids must be a,b,c,d in order`);
          if (!(o.lens === null || o.lens === 1 || o.lens === 2 || o.lens === 3)) err(r, `${ow}: lens must be 1|2|3|null (got ${JSON.stringify(o.lens)})`);
          if (o.cut !== undefined && o.cut !== true) err(r, `${ow}: cut must be true when present`);
          if (o.cut === true) {
            ctx.cuts.push(b.id + "/" + o.id);
            if (o.lens !== null) err(r, `${ow}: a cut option must have lens null`);
          }
          checkT(r, ow + ".text", o.text);
          if (o.set && typeof o.set === "object") Object.keys(o.set).forEach((f) => ctx.flagsSet.add(f));
          if (o.reaction) {
            const n = o.reaction.length;
            if (n > 2) {
              // more than two is fine when `when` variants guarantee at most two play
              const unconditional = o.reaction.filter((x) => x && !x.when && x.type !== "fx" && x.type !== "scene").length;
              if (unconditional > 2) warn(r, `${ow}: ${unconditional} unconditional reaction beats (spec: 0-2)`);
            }
            walkBeats(r, route, o.reaction, ow + ".reaction", Object.assign({}, ctx, { inReaction: true }));
          }
        });
        break;
      }
      case "fx":
        if (!FX.includes(b.fx)) err(r, `${w}: unknown fx ${b.fx}`);
        if (b.fx === "light" && !["off", "soft", "bright"].includes(b.level)) err(r, `${w}: bad light level ${b.level}`);
        if (b.fx === "pov" && !["normal", "lying", "standing"].includes(b.pov)) err(r, `${w}: bad pov ${b.pov}`);
        if (b.fx === "echoVerse") {
          const s = BHS.scripture && BHS.scripture[b.key];
          if (!s) err(r, `${w}: echoVerse unknown key ${b.key}`);
          if (b.highlight && b.highlight.map && s) {
            Object.entries(b.highlight.map).forEach(([val, m]) => {
              if (m && typeof m === "object") {
                ["ko", "en"].forEach((l) =>
                  (m[l] || []).forEach((sub) => {
                    if (s[l].indexOf(sub) < 0) err(r, `${w}: highlight "${sub}" (${val}/${l}) not found in ${b.key}`);
                  })
                );
              }
            });
            ctx.flagsUsed.add(b.highlight.flag);
          }
        }
        if (b.fx === "pinThought") {
          (b.items || []).forEach((it) => {
            const [kind, ref] = String(it).split(":");
            if (kind === "verse" && !(BHS.scripture && BHS.scripture[ref])) err(r, `${w}: pin verse ${ref} unknown`);
            if (kind === "choice" && !ctx.choices.some((c) => c.id === ref)) err(r, `${w}: pin choice ${ref} not made yet`);
            if (kind !== "verse" && kind !== "choice") err(r, `${w}: bad pin item ${it}`);
          });
        }
        if (b.fx === "actionReply") {
          if (!(route.actions || []).some((a) => a.id === b.action)) err(r, `${w}: actionReply for unknown action ${b.action}`);
          checkT(r, w + ".text", b.text);
        }
        break;
      case "press":
        if (b.action && !(route.actions || []).some((a) => a.id === b.action)) err(r, `${w}: press on unknown action ${b.action}`);
        if (!b.action && !b.label) warn(r, `${w}: press without label or action`);
        if (b.label) checkT(r, w + ".label", b.label);
        if (b.hint) checkT(r, w + ".hint", b.hint);
        break;
      default:
        err(r, `${w}: unknown beat type ${b.type}`);
    }
    if (b.when) checkCond(r, w + ".when", b.when, ctx);
  });
}

function checkCond(r, where, c, ctx) {
  if (Array.isArray(c)) return c.forEach((x) => checkCond(r, where, x, ctx));
  if (!c || typeof c !== "object") return err(r, `${where}: bad condition`);
  const keys = Object.keys(c);
  if (c.all) return c.all.forEach((x) => checkCond(r, where, x, ctx));
  if (c.any) return c.any.forEach((x) => checkCond(r, where, x, ctx));
  if (c.not) return checkCond(r, where, c.not, ctx);
  if ("choice" in c) {
    if (!ctx.choices.some((x) => x.id === c.choice) && !ctx.allowAllChoices) err(r, `${where}: refers to ${c.choice} before it is asked`);
    if (keys.length !== 2 || !("is" in c || "in" in c)) err(r, `${where}: choice condition needs exactly one of is/in`);
    return;
  }
  if ("flag" in c) {
    ctx.flagsUsed.add(c.flag);
    if (keys.length > 2) err(r, `${where}: flag condition has extra keys ${keys}`);
    return;
  }
  if ("lastLens" in c || "c10lens" in c) {
    if (!ctx.allowAllChoices) warn(r, `${where}: ${"lastLens" in c ? "lastLens" : "c10lens"} used outside endings`);
    return;
  }
  if ("var" in c) {
    warn(r, `${where}: var condition is an engine extension, not in SPEC 4.5`);
    return;
  }
  err(r, `${where}: unknown condition ${JSON.stringify(c)}`);
}

const CHOICE_IDS = ["c1", "c2", "c3", "c4"];
const CUT_ROUTES = ["scribe", "friend"];

function staticChecks(r) {
  const route = BHS.routes[r];
  const ctx = { choices: [], flagsSet: new Set(), flagsUsed: new Set(), inReaction: false, cuts: [] };
  if (route.id !== r) err(r, `route.id is ${route.id}`);
  (route.actions || []).forEach((a, i) => {
    if (!a.id) err(r, `actions[${i}] without id`);
    checkT(r, `actions[${i}].label`, a.label);
    (a.replies || []).forEach((t, k) => checkT(r, `actions[${i}].replies[${k}]`, t));
  });
  walkBeats(r, route, route.beats, "beats", ctx);
  const ids = ctx.choices.map((c) => c.id);
  if (JSON.stringify(ids) !== JSON.stringify(CHOICE_IDS)) err(r, `choice ids ${JSON.stringify(ids)} (want c1..c4 in order, once each)`);
  if (E.lastChoiceId(r) !== "c4") err(r, `the double-weight choice is ${E.lastChoiceId(r)}, expected c4`);
  if (CUT_ROUTES.includes(r)) {
    if (ctx.cuts.length !== 1) err(r, `expected exactly one cut option, found ${ctx.cuts.length} (${ctx.cuts.join(", ")})`);
    else if (!/^c[23]\//.test(ctx.cuts[0])) err(r, `the cut option ${ctx.cuts[0]} must be in c2 or c3`);
  } else if (ctx.cuts.length) err(r, `no cut option allowed (found ${ctx.cuts.join(", ")})`);
  const endCtx = Object.assign({}, ctx, { allowAllChoices: true });
  walkBeats(r, route, route.endingPreface, "endingPreface", endCtx);
  const keys = ["1", "2", "3"].concat(CUT_ROUTES.includes(r) ? ["cut"] : []);
  keys.forEach((k) => {
    const e = route.endings && route.endings[k];
    if (!e) return err(r, `endings.${k} missing`);
    walkBeats(r, route, e.beats, `endings.${k}.beats`, endCtx);
    checkT(r, `endings.${k}.last`, e.last);
  });
  if (!CUT_ROUTES.includes(r) && route.endings && route.endings.cut) err(r, "endings.cut present in a route without a cut option");
  walkBeats(r, route, route.endingCoda, "endingCoda", endCtx);
  ctx.flagsUsed.forEach((f) => {
    if (!ctx.flagsSet.has(f)) err(r, `flag "${f}" is tested but never set`);
  });
}

function play(r, picker) {
  const g = E.createGame(r);
  let screens = 0;
  const seen = [];
  for (let i = 0; i < 3000; i++) {
    const s = g.step;
    if (s.kind === "end") break;
    // Screens as in SPEC 3.3 and tools/validate.mjs: line (including the last line), verse, choice, press.
    if (s.kind === "line" || s.kind === "last" || s.kind === "verse" || s.kind === "choice" || s.kind === "press") screens++;
    if (s.kind === "line") {
      ["ko", "en"].forEach((l) => {
        const txt = E.plainText(s.text, l, g.state);
        if (/\[[A-Z0-9_]+\]|…”/.test(txt) && /\{\{/.test(JSON.stringify(s.text))) err(r, `unresolved token in "${txt.slice(0, 40)}"`);
      });
    }
    seen.push(s.kind);
    if (s.kind === "choice") g.choose(picker(s, g));
    else if (s.kind === "press") g.press();
    else g.next();
  }
  return { g, screens, seen, ended: g.step.kind === "end" };
}

const report = {};
const routeIds = ["scribe", "friend", "asher"].filter((r) => BHS.routes && BHS.routes[r]);
for (const r of ["scribe", "friend", "asher"]) if (!routeIds.includes(r)) err(r, "route file missing or not registered");

for (const r of routeIds) {
  staticChecks(r);
  const out = { screens: [], cutScreens: [], endings: { 1: 0, 2: 0, 3: 0, cut: 0 } };
  // Uniform strategies.
  for (const fixed of ["a", "b", "c", "d"]) {
    const { screens, seen, ended } = play(r, () => fixed);
    // The route ends right after the ending (title card, beats, last line, coda); the UI then opens the gallery.
    if (!seen.includes("endingTitle") || !seen.includes("last") || !ended) err(r, `all-${fixed}: ending sequence incomplete`);
  }
  // Every path (4^4 = 256): the game must end with the ending computeLens predicts, within the screen budget,
  // and a saved game must resume to the same ending from any point.
  for (let n = 0; n < 256; n++) {
    const map = {};
    for (let i = 0; i < 4; i++) map["c" + (i + 1)] = "abcd"[(n >> (2 * i)) & 3];
    const { g, screens, ended } = play(r, (s) => map[s.id]);
    const exp = E.computeLens(r, map);
    const want = r + "-" + (exp.cut ? "cut" : exp.lens);
    if (!ended || !g.state.ending || g.state.ending.id !== want) err(r, `path ${JSON.stringify(map)}: ended ${g.state.ending && g.state.ending.id}, expected ${want}`);
    out.endings[exp.cut ? "cut" : exp.lens]++;
    (exp.cut ? out.cutScreens : out.screens).push(screens);
    if (screens > 32) err(r, `path ${JSON.stringify(map)}: ${screens} screens (budget 32)`);
  }
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  for (let k = 0; k < 40; k++) {
    const map = {};
    for (let i = 0; i < 4; i++) map["c" + (i + 1)] = "abcd"[Math.floor(rnd() * 4)];
    const a = E.createGame(r);
    const stopAt = 1 + Math.floor(rnd() * 30);
    for (let i = 0; i < stopAt && a.step.kind !== "end"; i++) {
      if (a.step.kind === "choice") a.choose(map[a.step.id]);
      else if (a.step.kind === "press") a.press();
      else a.next();
    }
    const snap = JSON.parse(JSON.stringify(a.serialize()));
    if (!E.canRestore(snap)) {
      err(r, `canRestore refused a fresh snapshot (${a.step.kind})`);
      continue;
    }
    const b = E.restoreGame(snap);
    const ra = play2(a, map);
    const rb = play2(b, map);
    if (JSON.stringify(ra) !== JSON.stringify(rb)) err(r, `resume after ${stopAt} steps differs from the uninterrupted game (${JSON.stringify(map)})`);
  }
  const pct = (v, total) => (100 * v / total).toFixed(1) + "%";
  const nonCut = out.endings[1] + out.endings[2] + out.endings[3];
  out.enumeration = { 1: pct(out.endings[1], nonCut), 2: pct(out.endings[2], nonCut), 3: pct(out.endings[3], nonCut), cut: pct(out.endings.cut, 256) };
  const sc = out.screens.sort((x, y) => x - y);
  out.screensMinMedMax = sc.length ? [sc[0], sc[Math.floor(sc.length / 2)], sc[sc.length - 1]] : null;
  const cs = out.cutScreens.sort((x, y) => x - y);
  out.cutScreensMinMax = cs.length ? [cs[0], cs[cs.length - 1]] : null;
  delete out.screens;
  delete out.cutScreens;
  report[r] = out;
}

// Plays a game to its end and returns the shown step kinds plus the ending id.
function play2(g, map) {
  const kinds = [];
  for (let i = 0; i < 3000 && g.step.kind !== "end"; i++) {
    kinds.push(g.step.kind + (g.step.id ? ":" + g.step.id : ""));
    if (g.step.kind === "choice") g.choose(map[g.step.id]);
    else if (g.step.kind === "press") g.press();
    else g.next();
  }
  return { kinds, ending: g.state.ending && g.state.ending.id };
}

E.warnings.forEach((w) => warns.push("[engine] " + w));
console.log(JSON.stringify(report, null, 1));
if (missingFiles.length) console.log("missing files:", missingFiles.join(", "));
const uniq = (a) => Array.from(new Set(a));
uniq(warns).forEach((w) => console.log("WARN  " + w));
uniq(errors).forEach((e) => console.log("ERROR " + e));
console.log(`\nroutes-smoke: ${uniq(errors).length} errors, ${uniq(warns).length} warnings`);
process.exit(errors.length ? 1 : 0);
