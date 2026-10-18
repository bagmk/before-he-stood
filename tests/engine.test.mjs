// tests/engine.test.mjs - engine unit tests. Run: node tests/engine.test.mjs
// Plain Node assert, no dependencies. Uses fixture routes and fixture scripture only.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

globalThis.window = globalThis;
globalThis.BHS_FORCE_FIXTURE = true;

function load(rel) {
  const file = path.join(root, rel);
  vm.runInThisContext(fs.readFileSync(file, "utf8"), { filename: file });
}

load("data/meta.js");
load("data/characters.js");
load("tests/fixtures/scripture.js");
load("data/common.js");
load("tests/fixtures/routes.js");
load("js/engine.js");

const BHS = globalThis.BHS;
const E = BHS.engine;

let passed = 0;
const failures = [];
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    failures.push({ name, err });
  }
}

// ---------------------------------------------------------------- helpers

// Synthetic route: option a -> lens 1, b -> lens 2, c -> lens 3, d -> null.
function scoringRoute() {
  const beats = [];
  for (let i = 1; i <= 10; i++) {
    beats.push({
      type: "choice",
      id: "c" + i,
      prompt: { ko: "p", en: "p" },
      options: [
        { id: "a", text: { ko: "a", en: "a" }, lens: 1 },
        { id: "b", text: { ko: "b", en: "b" }, lens: 2 },
        { id: "c", text: { ko: "c", en: "c" }, lens: 3 },
        { id: "d", text: { ko: "d", en: "d" }, lens: null }
      ]
    });
  }
  return { id: "t", beats };
}

function picks(str) {
  // "aaaabbccd|b" -> { c1: "a", ..., c9: "d", c10: "b" }
  const [first, last] = str.split("|");
  const out = {};
  first.split("").forEach((ch, i) => (out["c" + (i + 1)] = ch));
  if (last) out.c10 = last;
  return out;
}

function playTo(game, predicate, pick) {
  return game.fastForward({ until: predicate, pick: pick || ((s) => s.options[0].id) });
}

function stepsUntilEnd(game, pickMap) {
  const log = [];
  for (let i = 0; i < 2000; i++) {
    const s = game.step;
    log.push(s);
    if (s.kind === "end" || s.kind === "routeSelect") break;
    if (s.kind === "choice") game.choose(pickMap[s.id] || "a");
    else if (s.kind === "press") game.press();
    else game.next();
  }
  return log;
}

// ---------------------------------------------------------------- computeLens

test("computeLens: clear winner, c10 counts double", () => {
  const r = E.computeLens(scoringRoute(), picks("aaaaaaaaa|a"));
  assert.deepEqual(r, { lens: 1, scores: { 1: 11, 2: 0, 3: 0 }, c10Lens: 1, mismatch: false });
});

test("computeLens: tie broken by c10 lens when it is among the tied", () => {
  // c1-c9: a x4, b x2, c x3 -> {4,2,3}; c10 b (+2) -> {4,4,3}
  const r = E.computeLens(scoringRoute(), picks("aaaabbccc|b"));
  assert.deepEqual(r.scores, { 1: 4, 2: 4, 3: 3 });
  assert.equal(r.lens, 2);
  assert.equal(r.c10Lens, 2);
  assert.equal(r.mismatch, false);
});

test("computeLens: tie without the c10 lens -> smallest tied lens, mismatch", () => {
  // c1-c9: a x4, b x4, d x1 -> {4,4,0}; c10 c (+2) -> {4,4,2}
  const r = E.computeLens(scoringRoute(), picks("aaaabbbbd|c"));
  assert.deepEqual(r.scores, { 1: 4, 2: 4, 3: 2 });
  assert.equal(r.lens, 1);
  assert.equal(r.c10Lens, 3);
  assert.equal(r.mismatch, true);
});

test("computeLens: three-way tie resolved by c10", () => {
  // c1-c9: a x3, b x3, c x2, d x1 -> {3,3,2}; c10 c (+2) -> {3,3,4}? no: lens 3 wins outright
  const r1 = E.computeLens(scoringRoute(), picks("aaabbbccd|c"));
  assert.deepEqual(r1.scores, { 1: 3, 2: 3, 3: 4 });
  assert.equal(r1.lens, 3);
  // c1-c9: a x3, b x2, c x1, d x3 -> {3,2,1}; c10 b -> {3,4,1} lens 2
  const r2 = E.computeLens(scoringRoute(), picks("aaabbcddd|b"));
  assert.equal(r2.lens, 2);
  // exact three-way: c1-c9 a x2, b x2, c x4, d x1 -> {2,2,4}; c10 a -> {4,2,4} tie 1/3, c10=1 -> 1
  const r3 = E.computeLens(scoringRoute(), picks("aabbccccd|a"));
  assert.deepEqual(r3.scores, { 1: 4, 2: 2, 3: 4 });
  assert.equal(r3.lens, 1);
  assert.equal(r3.mismatch, false);
});

test("computeLens: mismatch when the ending lens differs from the c10 lens", () => {
  const r = E.computeLens(scoringRoute(), picks("bbbbbbbbb|a"));
  assert.equal(r.lens, 2);
  assert.equal(r.c10Lens, 1);
  assert.equal(r.mismatch, true);
});

test("computeLens: null lens at c10 -> c10Lens null, no mismatch", () => {
  const r = E.computeLens(scoringRoute(), picks("aaaaaaaaa|d"));
  assert.equal(r.c10Lens, null);
  assert.equal(r.mismatch, false);
  assert.deepEqual(r.scores, { 1: 9, 2: 0, 3: 0 });
});

test("computeLens: no choices -> lens 1 with zero scores", () => {
  const r = E.computeLens(scoringRoute(), {});
  assert.deepEqual(r, { lens: 1, scores: { 1: 0, 2: 0, 3: 0 }, c10Lens: null, mismatch: false });
});

test("computeLens: accepts a route id, ignores unknown option ids", () => {
  const r = E.computeLens("scribe", { c1: "a", c2: "zz" });
  assert.equal(r.scores[1], 1);
  assert.equal(r.lens, 1);
});

test("computeLens: string lens tags are normalised", () => {
  const route = scoringRoute();
  route.beats[0].options[1].lens = "2";
  const r = E.computeLens(route, { c1: "b" });
  assert.equal(r.scores[2], 1);
});

// ---------------------------------------------------------------- evalCond

test("evalCond: choice is / in", () => {
  const st = { choices: { c3: "a" }, flags: {} };
  assert.equal(E.evalCond({ choice: "c3", is: "a" }, st), true);
  assert.equal(E.evalCond({ choice: "c3", is: "b" }, st), false);
  assert.equal(E.evalCond({ choice: "c3", in: ["b", "a"] }, st), true);
  assert.equal(E.evalCond({ choice: "c4", in: ["a"] }, st), false);
  assert.equal(E.evalCond({ choice: "c4", is: "a" }, st), false);
});

test("evalCond: flag is / in, unset counts as false", () => {
  const st = { choices: {}, flags: { item: "rope", far: true } };
  assert.equal(E.evalCond({ flag: "far", is: true }, st), true);
  assert.equal(E.evalCond({ flag: "item", in: ["rope", "water"] }, st), true);
  assert.equal(E.evalCond({ flag: "item", in: ["cloak"] }, st), false);
  assert.equal(E.evalCond({ flag: "missing", is: true }, st), false);
  assert.equal(E.evalCond({ flag: "missing", is: false }, st), true);
  assert.equal(E.evalCond({ flag: "far" }, st), true);
});

test("evalCond: all / any / not and implicit array", () => {
  const st = { choices: { c1: "a" }, flags: { far: true } };
  assert.equal(E.evalCond({ all: [{ choice: "c1", is: "a" }, { flag: "far", is: true }] }, st), true);
  assert.equal(E.evalCond({ all: [{ choice: "c1", is: "a" }, { flag: "far", is: false }] }, st), false);
  assert.equal(E.evalCond({ any: [{ choice: "c1", is: "b" }, { flag: "far", is: true }] }, st), true);
  assert.equal(E.evalCond({ any: [] }, st), false);
  assert.equal(E.evalCond({ not: { flag: "far", is: true } }, st), false);
  assert.equal(E.evalCond({ not: { all: [{ choice: "c1", is: "b" }] } }, st), true);
  assert.equal(E.evalCond([{ choice: "c1", is: "a" }, { flag: "far" }], st), true);
  assert.equal(E.evalCond(null, st), true);
});

test("evalCond: c10lens from state or from the route", () => {
  assert.equal(E.evalCond({ c10lens: 2 }, { c10Lens: 2 }), true);
  assert.equal(E.evalCond({ c10lens: 1 }, { c10Lens: 2 }), false);
  // scribe fixture c10 option b carries lens 2
  assert.equal(E.evalCond({ c10lens: 2 }, { routeId: "scribe", choices: { c10: "b" } }), true);
  assert.equal(E.evalCond({ c10lens: 3 }, { routeId: "scribe", choices: { c10: "b" } }), false);
  assert.equal(E.evalCond({ c10lens: 1 }, { routeId: "scribe", choices: {} }), false);
});

test("evalCond: unknown condition is false; var extension works", () => {
  assert.equal(E.evalCond({ bogus: 1 }, {}), false);
  assert.equal(E.evalCond({ var: "n", gte: 2 }, { vars: { n: 3 } }), true);
  assert.equal(E.evalCond({ var: "n", is: 0 }, { vars: {} }), true);
});

// ---------------------------------------------------------------- tokens

test("resolveText: verse tokens get curly quotes in both languages", () => {
  const t = { ko: "읽는다. {{v:PS_103_3}}", en: "You read. {{v:PS_103_3}}" };
  assert.equal(E.resolveText(t, "ko", {}), "읽는다. “그가 네 모든 죄악을 사하시며 네 모든 병을 고치시며”");
  assert.equal(E.resolveText(t, "en", {}), "You read. “who forgives all your iniquity, who heals all your diseases,”");
});

test("resolveText: inner double quotes become single curly quotes inside the token quotes", () => {
  assert.equal(
    E.resolveText({ ko: "{{v:MT_9_3}}", en: "{{v:MT_9_3}}" }, "en", {}),
    "“And behold, some of the scribes said to themselves, ‘This man is blaspheming.’”"
  );
  assert.equal(
    E.resolveText({ ko: "x", en: "{{v:PS_41_4}}" }, "en", {}),
    "“As for me, I said, ‘O LORD, be gracious to me; heal me, for I have sinned against you!’”"
  );
  // Existing single quotes are kept (MT_9_5 nests correctly already).
  assert.equal(
    E.resolveText({ ko: "x", en: "{{v:MT_9_5}}" }, "en", {}),
    "“For which is easier, to say, ‘Your sins are forgiven,’ or to say, ‘Rise and walk’?”"
  );
  // Straight quotes: open after start/space/dash, close otherwise.
  assert.equal(E.quoteVerse('He said, "Go." Then "stay"'), "“He said, ‘Go.’ Then ‘stay’”");
  assert.equal(E.quoteVerse('"Hi"—"there"'), "“‘Hi’—‘there’”");
  // Korean text without quotes is untouched apart from the wrapper.
  assert.equal(E.resolveText({ ko: "{{v:MT_9_3}}", en: "x" }, "ko", {}), "“어떤 서기관들이 속으로 이르되 이 사람이 신성을 모독하도다”");
});

test("resolveText: references and vars", () => {
  const t = { ko: "({{r:PS_103_3}}) 시도 {{var:getup_count}}번", en: "({{r:PS_103_3}}) tried {{var:getup_count}} times" };
  assert.equal(E.resolveText(t, "ko", { vars: { getup_count: 3 } }), "(시 103:3) 시도 3번");
  assert.equal(E.resolveText(t, "en", { vars: {} }), "(Ps 103:3) tried 0 times");
  assert.equal(E.resolveText({ ko: "{{r:MT_20_2}}", en: "{{r:MT_20_2}}" }, "en", {}), "Matt 20:2");
});

test("resolveText: missing keys show [KEY] in debug and a placeholder otherwise", () => {
  const t = { ko: "{{v:NOPE_1}}", en: "{{r:NOPE_1}}" };
  assert.equal(E.resolveText(t, "ko", { debug: true }), "[NOPE_1]");
  assert.equal(E.resolveText(t, "en", { debug: true }), "[NOPE_1]");
  assert.equal(E.resolveText(t, "ko", {}), "“…”");
  assert.equal(E.resolveText(t, "en", {}), "…");
  // refOnly keys have no text for {{v:}}
  assert.equal(E.resolveText({ ko: "{{v:MT_20_2}}", en: "x" }, "ko", { debug: true }), "[MT_20_2]");
});

test("resolveText keeps *emphasis* markers; plainText and resolveSegments handle them", () => {
  const t = { ko: "*그가*에 밑줄", en: "You underline *who*." };
  assert.equal(E.resolveText(t, "ko", {}), "*그가*에 밑줄");
  assert.equal(E.plainText(t, "ko", {}), "그가에 밑줄");
  const segs = E.resolveSegments(t, "en", {});
  assert.deepEqual(segs, [
    { text: "You underline ", em: false },
    { text: "who", em: true },
    { text: ".", em: false }
  ]);
  const vs = E.resolveSegments({ ko: "a {{v:MT_9_7}} b", en: "x" }, "ko", {});
  assert.equal(vs[1].kind, "v");
  assert.equal(vs[1].key, "MT_9_7");
  assert.equal(vs[1].text, "“그가 일어나 집으로 돌아가거늘”");
});

test("resolveText accepts plain strings", () => {
  assert.equal(E.resolveText("{{r:MT_9_7}}", "ko", {}), "마 9:7");
});

// ---------------------------------------------------------------- game: scribe FX

test("scribe: reaction plays right after the pick", () => {
  const g = E.createGame("scribe");
  playTo(g, (s) => s.kind === "choice" && s.id === "c1");
  assert.equal(g.step.options.length, 4);
  assert.equal(g.step.options[0].lens, undefined, "choice steps must not expose lens");
  g.choose("a");
  assert.equal(g.step.kind, "line");
  assert.equal(g.step.speaker, "thought");
  assert.equal(g.step.text.ko, "*그가*에 밑줄을 긋는다.");
  assert.equal(g.state.flags.mark, "he");
  g.next();
  assert.equal(g.step.text.en, "What belongs to God belongs to God.");
});

test("scribe: hush + echoVerse apply to the next beat only, with flag highlights", () => {
  const g = E.createGame("scribe");
  playTo(g, (s) => s.kind === "verse" && s.key === "MT_9_2B");
  const v = g.view();
  assert.equal(v.now.hush, true);
  assert.deepEqual(v.now.echo, { key: "PS_103_3", marks: { ko: ["그가"], en: ["who forgives"] } });
  assert.equal(v.stage.light, "bright");
  assert.equal(v.step.speaker, "jesus");
  g.next();
  assert.equal(g.view().now.hush, false);
  assert.equal(g.view().now.echo, null);
});

test("scribe: echo highlight '*' and missing map entries", () => {
  const g = E.createGame("scribe");
  playTo(g, (s) => s.kind === "verse" && s.key === "MT_9_2B", (s) => (s.id === "c1" ? "d" : "a"));
  assert.equal(g.view().now.echo.marks, "*");
  const g2 = E.createGame("scribe");
  playTo(g2, (s) => s.kind === "verse" && s.key === "MT_9_2B", (s) => (s.id === "c1" ? "c" : "a"));
  assert.deepEqual(g2.view().now.echo.marks, { ko: ["병"], en: ["diseases"] });
});

test("scribe: pinThought, readReceipt, unpinThought", () => {
  const g = E.createGame("scribe");
  playTo(g, (s) => s.kind === "line" && s.speaker === "thought" && /목까지/.test(s.text.ko));
  assert.deepEqual(g.view().stage.pinned, { items: [{ type: "verse", key: "MT_9_3Q" }], read: false });
  playTo(g, (s) => s.kind === "verse" && s.key === "MT_9_4N", (s) => (s.id === "c5" ? "c" : "a"));
  const pin = g.view().stage.pinned;
  assert.equal(pin.read, true);
  assert.equal(pin.items.length, 2);
  assert.deepEqual(pin.items[1].id, "c5");
  assert.equal(pin.items[1].option, "c");
  assert.match(pin.items[1].text.ko, /고치기 전에 용서부터/);
  playTo(g, (s) => s.kind === "verse" && s.key === "MT_9_5");
  assert.equal(g.view().stage.pinned, null);
});

test("scribe: scene sets bg + caption; light levels follow fx", () => {
  const g = E.createGame("scribe");
  assert.equal(g.view().stage.bg, "dawn_lamp");
  assert.equal(g.view().stage.caption.en, "Dawn · Menahem's room");
  assert.equal(g.view().stage.light, "off");
  playTo(g, (s) => s.kind === "verse" && s.key === "MT_9_2A");
  assert.equal(g.view().stage.light, "soft");
  playTo(g, (s) => s.kind === "verse" && s.key === "MT_9_8");
  assert.equal(g.view().stage.light, "bright");
  g.next();
  assert.equal(g.view().stage.light, "off");
  assert.equal(g.view().stage.bg, "lamp_night");
});

// ---------------------------------------------------------------- endings

test("ending sequence: preface, title, beats with c10lens, last, coda, final, end (no mismatch)", () => {
  const g = E.createGame("scribe");
  const log = stepsUntilEnd(g, {}); // all "a" -> lens 1, c10 a (lens 1)
  const kinds = log.map((s) => s.kind);
  const iTitle = kinds.indexOf("endingTitle");
  assert.ok(iTitle > 0);
  assert.ok(!log.some((s) => s.mismatch), "no mismatch line expected");
  assert.equal(log[iTitle - 1].text.ko, "등잔 심지가 짧아진다.", "endingPreface right before the title card");
  const title = log[iTitle];
  assert.equal(title.lens, 1);
  assert.equal(title.lensLabel.ko, "누가?");
  assert.equal(title.title.ko, "누가 말했는가");
  assert.equal(log[iTitle + 1].text.ko, "므나헴은 그 주장을 누구보다 정확히 알아들었다.");
  assert.match(log[iTitle + 2].text.ko, /신성모독/, "c10lens + choice condition line plays");
  assert.ok(!log.some((s) => s.text && s.text.ko === "그는 결론 칸을 비워 둔다."), "c10=d line skipped");
  const iLast = kinds.indexOf("last");
  assert.equal(log[iLast].text.ko, "하나님에 대해서는 네가 옳았다. 남은 질문은 그에 대한 것이다.");
  assert.equal(log[iLast + 1].speaker, "sign", "endingCoda after the last line");
  assert.equal(kinds[kinds.length - 2], "final");
  assert.equal(kinds[kinds.length - 1], "end");
  assert.equal(g.state.ending.id, "scribe-1");
});

test("ending sequence: mismatch line plays before endingPreface", () => {
  const g = E.createGame("scribe");
  // scribe fixture: c1..c9 option b; c10 option a (lens 1) -> lenses of b vary, check computed result
  const map = {};
  for (let i = 1; i <= 9; i++) map["c" + i] = "c";
  map.c10 = "a";
  const expected = E.computeLens("scribe", map);
  assert.equal(expected.mismatch, true, "fixture picks should produce a mismatch");
  const log = stepsUntilEnd(g, map);
  const iMis = log.findIndex((s) => s.mismatch);
  assert.ok(iMis > 0, "mismatch line present");
  assert.equal(log[iMis].text.ko, BHS.common.mismatchLine.ko);
  assert.equal(log[iMis + 1].text.ko, "등잔 심지가 짧아진다.");
  assert.equal(log[iMis + 2].kind, "endingTitle");
  assert.equal(log[iMis + 2].lens, expected.lens);
});

test("game lens equals computeLens on recorded choices", () => {
  const g = E.createGame("friend");
  const map = { c1: "c", c2: "b", c3: "d", c4: "b", c5: "b", c6: "b", c7: "b", c8: "c", c9: "b", c10: "b" };
  stepsUntilEnd(g, map);
  assert.deepEqual(g.state.choices, map);
  const r = E.computeLens("friend", map);
  assert.equal(g.state.ending.lens, r.lens);
  assert.equal(r.lens, 2);
});

// ---------------------------------------------------------------- friend: flags + conditions

test("friend: flags drive conditional beats, reactions with multiple lines", () => {
  const g = E.createGame("friend");
  const map = { c3: "a", c5: "c", c6: "d" };
  const log = stepsUntilEnd(g, map);
  const texts = log.filter((s) => s.text).map((s) => s.text.ko);
  const i3 = texts.indexOf("네가 그걸 어떻게 알아?");
  assert.ok(i3 > 0, "c3 reaction line 1");
  assert.equal(texts[i3 + 1], "요나는 대답하지 못한다.", "c3 reaction line 2");
  assert.ok(!texts.includes("침상이 기운다. 끈이 버텨 준다."), "rope line skipped");
  assert.ok(texts.includes("다른 사람들이 침상을 들고 간다. 요나는 뒤에서 따라간다."), "far reaction");
  assert.ok(texts.includes("그 손들 가운데 네 손은 없다."), "far line");
  assert.ok(!texts.includes("그 손들 가운데 네 손이 있다."), "not-far line skipped");
  assert.ok(!texts.includes("물주머니를 걸음에 걸리지 않게 치운다."), "all[water, not far] skipped when far");
  assert.ok(texts.some((t) => /그날 그 .그들. 안에 너는 없었다/.test(t)), "endingPreface far variation");
  assert.equal(g.state.flags.item, "water");
  assert.equal(g.state.flags.far, true);
});

test("friend: default path shows the near-path lines", () => {
  const g = E.createGame("friend");
  const log = stepsUntilEnd(g, { c5: "a" });
  const texts = log.filter((s) => s.text).map((s) => s.text.ko);
  assert.ok(texts.includes("침상이 기운다. 끈이 버텨 준다."));
  assert.ok(texts.includes("그 손들 가운데 네 손이 있다."));
  assert.ok(!texts.some((t) => /안에 너는 없었다/.test(t)));
});

// ---------------------------------------------------------------- asher: actions

test("asher: persistent actions, replies, counters, actionReply override", () => {
  const g = E.createGame("asher");
  assert.deepEqual(
    g.actions().map((a) => [a.id, a.lit]),
    [
      ["getup", false],
      ["goout", false]
    ]
  );
  const replies = [1, 2, 3, 4].map(() => g.tapAction("getup").text.ko);
  assert.deepEqual(replies, ["다리가 대답하지 않는다.", "여전히.", "네 해째다.", "네 해째다."]);
  assert.equal(g.state.vars.getup_count, 4);
  assert.equal(g.step.kind, "line", "tapping an action never advances the story");
  assert.equal(g.tapAction("goout").text.ko, "문까지가 너무 멀다.");
  playTo(g, (s) => s.kind === "line" && s.speaker === "yonah");
  assert.equal(g.tapAction("goout").text.ko, "요나가 오는 소리가 들린다.", "actionReply override");
  assert.equal(g.state.vars.goout_count, 2);
  assert.equal(g.tapAction("nope"), null);
});

test("asher: actionsHide / actionsShow, press on getup, pov, label presses, var token in coda", () => {
  const g = E.createGame("asher");
  g.tapAction("getup");
  g.tapAction("getup");
  assert.equal(g.view().stage.pov, "lying");
  playTo(g, (s) => s.kind === "choice" && s.id === "c6");
  assert.equal(g.actions().length, 0, "hidden after actionsHide");
  assert.equal(g.tapAction("getup"), null);
  g.choose("a");
  assert.equal(g.actions().length, 2, "shown again after actionsShow");
  playTo(g, (s) => s.kind === "press");
  assert.equal(g.step.action, "getup");
  const acts = g.actions();
  assert.deepEqual(
    acts.map((a) => [a.id, a.lit]),
    [
      ["getup", true],
      ["goout", false]
    ]
  );
  const res = g.tapAction("getup");
  assert.equal(res.pressed, true);
  assert.equal(g.state.vars.getup_count, 2, "the lit press is not counted as an attempt");
  assert.equal(g.view().stage.pov, "standing");
  assert.equal(g.actions().length, 0, "persistent buttons gone after the getup press");
  playTo(g, (s) => s.kind === "press");
  assert.equal(g.step.label.ko, "침상을 들어");
  g.press();
  assert.equal(g.step.kind, "press");
  assert.equal(g.step.label.en, "Go home");
  g.press();
  const log = stepsUntilEnd(g, {});
  const coda = log.find((s) => s.kind === "line" && s.speaker === "sign" && /getup_count/.test(s.text.ko));
  assert.ok(coda, "coda line with var token");
  assert.equal(E.resolveText(coda.text, "ko", g.state), "일어나기 시도 2번");
});

test("asher: press via game.press() also works and next() refuses at a press", () => {
  const g = E.createGame("asher");
  playTo(g, (s) => s.kind === "press");
  assert.equal(g.next(), false);
  assert.equal(g.choose("a"), false);
  assert.equal(g.press(), true);
  assert.notEqual(g.step.kind, "press");
});

// ---------------------------------------------------------------- portrait cast

test("cast: speakers enter stable slots, protagonist and pseudo-speakers never do", () => {
  const g = E.createGame("scribe");
  assert.deepEqual(g.view().stage.cast, [], "narration does not add anyone");
  playTo(g, (s) => s.kind === "line" && s.speaker === "hanan");
  assert.deepEqual(g.view().stage.cast.map((c) => [c.id, c.slot]), [["hanan", 0]]);
  assert.equal(g.view().stage.speaking, "hanan");
  g.next(); // c1
  assert.equal(g.view().stage.speaking, null, "nobody speaks during a choice");
  g.choose("b"); // no reaction on b in the fixture
  assert.equal(g.step.speaker, "thought");
  assert.equal(g.view().stage.speaking, null);
  assert.equal(g.view().stage.cast.length, 1, "thought keeps the cast");
  playTo(g, (s) => s.kind === "line" && s.speaker === "neighbor");
  assert.deepEqual(g.view().stage.cast.map((c) => [c.id, c.slot]), [["hanan", 0], ["neighbor", 1]]);
  assert.equal(g.view().stage.speaking, "neighbor");
  playTo(g, (s) => s.kind === "line" && s.speaker === "passerby");
  assert.deepEqual(g.view().stage.cast.map((c) => c.id), ["passerby"], "scene change cleared the cast first");
});

test("cast: a third speaker replaces the least recent one in its slot", () => {
  const g = E.createSequence(
    [
      { type: "scene", bg: "lane" },
      { type: "line", speaker: "hanan", text: { ko: "1", en: "1" } },
      { type: "line", speaker: "neighbor", text: { ko: "2", en: "2" } },
      { type: "line", speaker: "hanan", text: { ko: "3", en: "3" } },
      { type: "line", speaker: "passerby", text: { ko: "4", en: "4" } },
      { type: "line", speaker: "jesus", text: { ko: "x", en: "x" } },
      { type: "line", speaker: "crowd", text: { ko: "5", en: "5" } }
    ],
    { routeId: "scribe" }
  );
  g.next();
  g.next();
  g.next();
  assert.deepEqual(g.view().stage.cast.map((c) => [c.id, c.slot]), [["hanan", 0], ["passerby", 1]], "neighbor was least recent");
  g.next();
  assert.equal(g.view().stage.speaking, null, "jesus is never a portrait");
  g.next();
  assert.equal(g.view().stage.speaking, null, "crowd has no portrait");
  assert.equal(g.view().stage.cast.length, 2);
});

test("cast: Jesus' verse clears the stage; Asher stands after MT_9_6B; endings clear", () => {
  const g = E.createGame("friend");
  playTo(g, (s) => s.kind === "line" && s.speaker === "asher");
  assert.deepEqual(g.view().stage.cast, [{ id: "asher", slot: 0, pose: "lying", t: g.view().stage.cast[0].t }]);
  playTo(g, (s) => s.kind === "verse" && s.key === "MT_9_2B");
  assert.deepEqual(g.view().stage.cast, []);
  playTo(g, (s) => s.kind === "line" && s.speaker === "yonah");
  assert.equal(g.view().stage.speaking, null, "the friend route never shows Yonah");
  assert.ok(!g.view().stage.cast.some((c) => c.id === "yonah"));
  playTo(g, (s) => s.kind === "verse" && s.key === "MT_9_6B");
  assert.equal(g.view().stage.risen, true);
  const seq = E.createSequence(
    [
      { type: "verse", key: "MT_9_6B" },
      { type: "line", speaker: "asher", text: { ko: "a", en: "a" } }
    ],
    { routeId: "friend" }
  );
  seq.next();
  assert.equal(seq.view().stage.cast[0].pose, "standing");
  const e = E.createGame("asher");
  playTo(e, (s) => s.kind === "line" && s.speaker === "yonah");
  assert.equal(e.view().stage.cast[0].id, "yonah", "Yonah appears in Asher's route");
  e.fastForward({ until: (s) => s.kind === "endingTitle" });
  assert.deepEqual(e.view().stage.cast, []);
});

// ---------------------------------------------------------------- save / restore

test("serialize / restoreGame resumes identically", () => {
  const map = { c1: "b", c2: "c", c3: "a", c4: "d", c5: "b", c6: "a", c7: "c", c8: "b", c9: "d", c10: "c" };
  const a = E.createGame("scribe");
  playTo(a, (s) => s.kind === "choice" && s.id === "c5", (s) => map[s.id]);
  const snap = JSON.parse(JSON.stringify(a.serialize()));
  const b = E.restoreGame(snap);
  const la = stepsUntilEnd(a, map);
  const lb = stepsUntilEnd(b, map);
  assert.deepEqual(lb, la);
  assert.deepEqual(b.state.ending, a.state.ending);
});

test("restoreGame rejects incompatible snapshots", () => {
  assert.throws(() => E.restoreGame(null));
  assert.throws(() => E.restoreGame({ routeId: "scribe", v: 999 }));
  assert.throws(() => E.createGame("nope"));
});

// ---------------------------------------------------------------- prologue + sequence

test("prologue game plays common.prologue then stops at routeSelect", () => {
  const g = E.createGame("prologue");
  const log = stepsUntilEnd(g, {});
  const lines = log.filter((s) => s.kind === "line");
  assert.equal(lines.length, BHS.common.prologue.filter((b) => b.type === "line").length);
  assert.equal(log[log.length - 1].kind, "routeSelect");
  assert.equal(g.view().stage.bg, "shore_dawn");
  assert.equal(g.next(), false);
});

test("createSequence: when-skips, unknown fx tolerated, verse speaker defaults to key speaker", () => {
  const g = E.createSequence([
    { type: "fx", fx: "sparkle" },
    { type: "line", text: { ko: "x", en: "x" }, when: { flag: "nope", is: true } },
    { type: "verse", key: "MT_9_6B" },
    { type: "verse", key: "MT_9_7", speaker: "narrator" }
  ]);
  assert.equal(g.step.kind, "verse");
  assert.equal(g.step.speaker, "jesus");
  g.next();
  assert.equal(g.step.speaker, "narrator");
  g.next();
  assert.equal(g.step.kind, "end");
});

test("fastForward picks and stops at a predicate", () => {
  const g = E.createGame("friend");
  const s = g.fastForward({ until: (st) => st.kind === "choice" && st.id === "c4", pick: () => "b" });
  assert.equal(s.id, "c4");
  assert.deepEqual(g.state.choices, { c1: "b", c2: "b", c3: "b" });
});

test("all 4^10 paths: computeLens returns a valid lens and is fast", () => {
  const ids = ["a", "b", "c", "d"];
  const counts = { 1: 0, 2: 0, 3: 0 };
  const t0 = Date.now();
  const choices = {};
  for (let n = 0; n < 1 << 20; n++) {
    for (let i = 0; i < 10; i++) choices["c" + (i + 1)] = ids[(n >> (2 * i)) & 3];
    counts[E.computeLens("scribe", choices).lens]++;
  }
  const total = counts[1] + counts[2] + counts[3];
  assert.equal(total, 1 << 20);
  assert.ok(Date.now() - t0 < 30000);
});

// ---------------------------------------------------------------- report

if (failures.length) {
  for (const f of failures) {
    console.error("FAIL  " + f.name);
    console.error("      " + (f.err && f.err.stack ? f.err.stack.split("\n").slice(0, 4).join("\n      ") : f.err));
  }
  console.error(`\n${passed} passed, ${failures.length} failed`);
  process.exit(1);
} else {
  console.log(`engine tests: ${passed} passed, 0 failed`);
}
