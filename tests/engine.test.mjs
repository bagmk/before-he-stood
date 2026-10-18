// tests/engine.test.mjs - engine unit tests. Run: node tests/engine.test.mjs
// Plain Node assert, no dependencies. Uses fixture routes (version 3 format) and fixture scripture only.
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

// Synthetic route with n choices: option a -> lens 1, b -> lens 2, c -> lens 3, d -> null.
function scoringRoute(n = 4) {
  const beats = [];
  for (let i = 1; i <= n; i++) {
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

// "abcd" -> { c1: "a", c2: "b", c3: "c", c4: "d" }; "aaaabbbbd|c" -> c1..c9 then c10.
function picks(str) {
  const [first, last] = str.split("|");
  const out = {};
  first.split("").forEach((ch, i) => (out["c" + (i + 1)] = ch));
  if (last) out["c" + (first.length + 1)] = last;
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

const texts = (log) => log.filter((s) => s.text).map((s) => s.text.ko);
const snapshot = (g) => JSON.parse(JSON.stringify(g.serialize()));

// ---------------------------------------------------------------- computeLens (SPEC 5.1)

test("computeLens: clear winner, the last choice (c4) counts double", () => {
  const r = E.computeLens(scoringRoute(), picks("aaaa"));
  assert.deepEqual(r, { lens: 1, scores: { 1: 5, 2: 0, 3: 0 }, lastLens: 1, c10Lens: 1, mismatch: false, cut: false });
});

test("computeLens: tie broken by the last choice's lens when it is among the tied", () => {
  // c1 a, c2 a, c3 d -> {2,0,0}; c4 b (+2) -> {2,2,0}
  const r = E.computeLens(scoringRoute(), picks("aadb"));
  assert.deepEqual(r.scores, { 1: 2, 2: 2, 3: 0 });
  assert.equal(r.lens, 2);
  assert.equal(r.lastLens, 2);
  assert.equal(r.mismatch, false);
});

test("computeLens: tie without the last choice's lens -> smallest tied lens, mismatch (10-choice route)", () => {
  // c1-c9: a x4, b x4, d x1 -> {4,4,0}; c10 c (+2) -> {4,4,2}
  const r = E.computeLens(scoringRoute(10), picks("aaaabbbbd|c"));
  assert.deepEqual(r.scores, { 1: 4, 2: 4, 3: 2 });
  assert.equal(r.lens, 1);
  assert.equal(r.lastLens, 3);
  assert.equal(r.c10Lens, 3, "c10Lens stays an alias of lastLens");
  assert.equal(r.mismatch, true);
});

test("computeLens: mismatch when the ending lens differs from the last choice's lens", () => {
  const r = E.computeLens(scoringRoute(), picks("bbba"));
  assert.deepEqual(r.scores, { 1: 2, 2: 3, 3: 0 });
  assert.equal(r.lens, 2);
  assert.equal(r.lastLens, 1);
  assert.equal(r.mismatch, true);
});

test("computeLens: null lens at the last choice -> lastLens null, no mismatch", () => {
  const r = E.computeLens(scoringRoute(), picks("aaad"));
  assert.equal(r.lastLens, null);
  assert.equal(r.mismatch, false);
  assert.deepEqual(r.scores, { 1: 3, 2: 0, 3: 0 });
});

test("computeLens: no choices -> lens 1 with zero scores", () => {
  const r = E.computeLens(scoringRoute(), {});
  assert.deepEqual(r, { lens: 1, scores: { 1: 0, 2: 0, 3: 0 }, lastLens: null, c10Lens: null, mismatch: false, cut: false });
});

test("computeLens: accepts a route id; ignores unknown option ids and choice ids the route lacks (old c5-c10 picks)", () => {
  const r = E.computeLens("scribe", { c1: "a", c2: "zz", c5: "a", c7: "c", c10: "b" });
  assert.deepEqual(r.scores, { 1: 1, 2: 0, 3: 0 });
  assert.equal(r.lens, 1);
  assert.equal(r.lastLens, null, "c10 is not the last choice of a 4-choice route");
});

test("computeLens: string lens tags are normalised", () => {
  const route = scoringRoute();
  route.beats[0].options[1].lens = "2";
  const r = E.computeLens(route, { c1: "b" });
  assert.equal(r.scores[2], 1);
});

test("lastChoiceId: the highest cN, whatever the beat order; falls back to the last choice beat", () => {
  assert.equal(E.lastChoiceId(scoringRoute(4)), "c4");
  assert.equal(E.lastChoiceId(scoringRoute(10)), "c10");
  assert.equal(E.lastChoiceId("asher"), "c4");
  const shuffled = scoringRoute(3);
  shuffled.beats.reverse(); // c3, c2, c1
  assert.equal(E.lastChoiceId(shuffled), "c3");
  const r = E.computeLens(shuffled, picks("bba"));
  assert.deepEqual(r.scores, { 1: 2, 2: 2, 3: 0 }, "c3 (option a) is weight 2 even though it comes first");
  assert.equal(r.lens, 1, "the tie goes to c3's lens");
  const odd = { id: "x", beats: [{ type: "choice", id: "first", options: [] }, { type: "choice", id: "second", options: [] }] };
  assert.equal(E.lastChoiceId(odd), "second");
  assert.equal(E.lastChoiceId({ id: "y", beats: [] }), null);
});

test("computeLens: a picked cut option gives the cut outcome (no lens, no mismatch)", () => {
  const r = E.computeLens("scribe", { c1: "b", c2: "b", c3: "d" });
  assert.deepEqual(r, { lens: null, scores: { 1: 0, 2: 2, 3: 0 }, lastLens: null, c10Lens: null, mismatch: false, cut: true });
  const f = E.computeLens("friend", { c1: "a", c2: "d" });
  assert.equal(f.cut, true);
  assert.equal(E.computeLens("friend", { c1: "a", c2: "c" }).cut, false);
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
  const st = { choices: {}, flags: { mark: "he", stood: true } };
  assert.equal(E.evalCond({ flag: "stood", is: true }, st), true);
  assert.equal(E.evalCond({ flag: "mark", in: ["he", "order"] }, st), true);
  assert.equal(E.evalCond({ flag: "mark", in: ["whole"] }, st), false);
  assert.equal(E.evalCond({ flag: "missing", is: true }, st), false);
  assert.equal(E.evalCond({ flag: "missing", is: false }, st), true);
  assert.equal(E.evalCond({ flag: "stood" }, st), true);
});

test("evalCond: all / any / not and implicit array", () => {
  const st = { choices: { c1: "a" }, flags: { stood: true } };
  assert.equal(E.evalCond({ all: [{ choice: "c1", is: "a" }, { flag: "stood", is: true }] }, st), true);
  assert.equal(E.evalCond({ all: [{ choice: "c1", is: "a" }, { flag: "stood", is: false }] }, st), false);
  assert.equal(E.evalCond({ any: [{ choice: "c1", is: "b" }, { flag: "stood", is: true }] }, st), true);
  assert.equal(E.evalCond({ any: [] }, st), false);
  assert.equal(E.evalCond({ not: { flag: "stood", is: true } }, st), false);
  assert.equal(E.evalCond({ not: { all: [{ choice: "c1", is: "b" }] } }, st), true);
  assert.equal(E.evalCond([{ choice: "c1", is: "a" }, { flag: "stood" }], st), true);
  assert.equal(E.evalCond(null, st), true);
});

test("evalCond: lastLens (and the c10lens alias) from the state or from the route", () => {
  assert.equal(E.evalCond({ lastLens: 2 }, { lastLens: 2 }), true);
  assert.equal(E.evalCond({ lastLens: 1 }, { lastLens: 2 }), false);
  assert.equal(E.evalCond({ c10lens: 2 }, { lastLens: 2 }), true, "c10lens is an alias");
  assert.equal(E.evalCond({ lastLens: 2 }, { c10Lens: 2 }), true, "older callers may pass c10Lens");
  // scribe fixture c4 option b carries lens 2
  assert.equal(E.evalCond({ lastLens: 2 }, { routeId: "scribe", choices: { c4: "b" } }), true);
  assert.equal(E.evalCond({ c10lens: 2 }, { routeId: "scribe", choices: { c4: "b" } }), true);
  assert.equal(E.evalCond({ lastLens: 3 }, { routeId: "scribe", choices: { c4: "b" } }), false);
  assert.equal(E.evalCond({ lastLens: 1 }, { routeId: "scribe", choices: { c10: "a" } }), false, "c10 is not the last choice");
  assert.equal(E.evalCond({ lastLens: 1 }, { routeId: "scribe", choices: {} }), false);
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
  assert.equal(E.resolveText(t, "en", {}), "You read. “…who forgives all your iniquity, who heals all your diseases,”");
});

test("verse display rule (SPEC 4.3): an English excerpt that starts with a lowercase letter gets a leading …", () => {
  // Display only: the stored text stays an exact substring of the verse.
  assert.equal(E.verseText("MT_9_2B2", "en"), "your sins are forgiven.");
  assert.equal(E.verseDisplay("MT_9_2B2", "en"), "…your sins are forgiven.");
  assert.equal(E.verseDisplay("PS_103_3", "en"), "…who forgives all your iniquity, who heals all your diseases,");
  // Capitalized English, a text that starts with a dash, and Korean are unchanged; missing keys give null.
  assert.equal(E.verseDisplay("MT_9_2B1", "en"), "Take heart, my son;");
  assert.equal(E.verseDisplay("MT_9_6N", "en"), "—he then said to the paralytic—");
  assert.equal(E.verseDisplay("MT_9_2B2", "ko"), "네 죄 사함을 받았느니라");
  assert.equal(E.verseDisplay("PS_103_3", "ko"), E.verseText("PS_103_3", "ko"));
  assert.equal(E.verseDisplay("MT_20_2", "en"), null);
  assert.equal(E.verseDisplay("NOPE_1", "en"), null);
  // {{v:}} tokens in lines and options show the display form inside the quotes.
  const t = { ko: "그 말 {{v:MT_9_2B2}}", en: "The words {{v:MT_9_2B2}}" };
  assert.equal(E.resolveText(t, "en", {}), "The words “…your sins are forgiven.”");
  assert.equal(E.resolveText(t, "ko", {}), "그 말 “네 죄 사함을 받았느니라”");
  assert.equal(E.plainText(t, "en", {}), "The words “…your sins are forgiven.”");
  const seg = E.resolveSegments(t, "en", {}).find((s) => s.kind === "v");
  assert.equal(seg.key, "MT_9_2B2");
  assert.equal(seg.text, "“…your sins are forgiven.”");
  assert.equal(E.resolveText({ ko: "x", en: "{{v:MT_9_2B1}} {{v:MT_9_2B2}}" }, "en", {}), "“Take heart, my son;” “…your sins are forgiven.”");
  // Verse steps keep the key; renderers ask verseDisplay for the text.
  const g = E.createSequence([{ type: "verse", key: "MT_9_2B2" }]);
  assert.equal(g.step.kind, "verse");
  assert.equal(g.step.key, "MT_9_2B2");
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
  assert.ok(E.createGame("scribe").fastForward({ until: (s) => s.id === "c3" }).options.every((o) => o.cut === undefined), "choice steps must not expose cut flags");
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

test("scribe: echo highlight '*' and other map entries", () => {
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
  playTo(g, (s) => s.kind === "verse" && s.key === "MT_9_4N", (s) => (s.id === "c3" ? "c" : "a"));
  const pin = g.view().stage.pinned;
  assert.equal(pin.read, true);
  assert.equal(pin.items.length, 2);
  assert.equal(pin.items[1].id, "c3");
  assert.equal(pin.items[1].option, "c");
  assert.match(pin.items[1].text.ko, /얼굴을 본다/);
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
  assert.equal(g.step.id, "c4");
  assert.equal(g.view().stage.light, "soft");
  g.choose("b");
  assert.equal(g.view().stage.light, "off");
  assert.equal(g.view().stage.bg, "crowd");
});

// ---------------------------------------------------------------- lens endings

test("ending sequence: preface, title, beats with lastLens, last, coda, end (no mismatch)", () => {
  const g = E.createGame("scribe");
  const log = stepsUntilEnd(g, {}); // all "a" -> lens 1, last choice c4 a (lens 1)
  const kinds = log.map((s) => s.kind);
  const iTitle = kinds.indexOf("endingTitle");
  assert.ok(iTitle > 0);
  assert.ok(!log.some((s) => s.mismatch), "no mismatch line expected");
  assert.equal(log[iTitle - 1].text.ko, "기록장을 편다.", "endingPreface right before the title card");
  const title = log[iTitle];
  assert.equal(title.lens, 1);
  assert.equal(title.cut, false);
  assert.equal(title.lensLabel.ko, BHS.meta.lenses[1].label.ko);
  assert.equal(title.title.ko, BHS.meta.endings.scribe[1].ko);
  assert.equal(log[iTitle + 1].text.ko, "므나헴은 그 주장을 누구보다 정확히 알아들었다.");
  assert.match(log[iTitle + 2].text.ko, /신성모독/, "lastLens + choice condition line plays");
  assert.ok(!texts(log).includes("그는 결론 칸을 비워 둔다."), "c4=d line skipped");
  const iLast = kinds.indexOf("last");
  assert.equal(log[iLast].text.ko, "하나님에 대해서는 네가 옳았다. 남은 질문은 그에 대한 것이다.");
  assert.equal(log[iLast + 1].speaker, "sign", "endingCoda after the last line");
  assert.equal(log[iLast + 1].text.ko, "― 등잔이 꺼진다 ―");
  assert.equal(kinds[kinds.length - 1], "end", "the route ends right after the coda");
  assert.equal(kinds.length - 1, iLast + 2, "nothing between the coda and the end");
  assert.deepEqual(g.state.ending, { routeId: "scribe", id: "scribe-1", lens: 1, cut: false, scores: { 1: 5, 2: 0, 3: 0 }, lastLens: 1, c10Lens: 1, mismatch: false });
  assert.equal(g.state.done, true);
});

test("ending sequence: mismatch line plays before endingPreface; c10lens alias in ending beats", () => {
  // c1-c3 option c (lens 3), c4 option a (lens 1, +2): {1:2, 3:3} -> lens 3, mismatch
  const map = { c1: "c", c2: "c", c3: "c", c4: "a" };
  const expected = E.computeLens("scribe", map);
  assert.equal(expected.lens, 3);
  assert.equal(expected.mismatch, true);
  const log = stepsUntilEnd(E.createGame("scribe"), map);
  const iMis = log.findIndex((s) => s.mismatch);
  assert.ok(iMis > 0, "mismatch line present");
  assert.equal(log[iMis].text.ko, BHS.common.mismatchLine.ko);
  assert.equal(log[iMis + 1].text.ko, "기록장을 편다.");
  assert.equal(log[iMis + 2].kind, "endingTitle");
  assert.equal(log[iMis + 2].lens, 3);
  assert.ok(!texts(log).includes("그는 그 권한으로 한 사람을 집에 보냈다."), "c10lens:3 line skipped when the last pick has lens 1");
  const log2 = stepsUntilEnd(E.createGame("scribe"), { c1: "c", c2: "c", c3: "c", c4: "c" });
  assert.ok(texts(log2).includes("그는 그 권한으로 한 사람을 집에 보냈다."), "c10lens:3 line plays when the last pick has lens 3");
  assert.ok(!log2.some((s) => s.mismatch));
});

test("game lens equals computeLens on recorded choices", () => {
  const g = E.createGame("friend");
  const map = { c1: "c", c2: "b", c3: "b", c4: "b" };
  stepsUntilEnd(g, map);
  assert.deepEqual(g.state.choices, map);
  const r = E.computeLens("friend", map);
  assert.equal(g.state.ending.lens, r.lens);
  assert.equal(r.lens, 2);
  assert.equal(g.state.lastLens, 2);
});

// ---------------------------------------------------------------- cut endings

test("cut (scribe c3/d): reaction, then cut card, cut beats, last, coda; nothing else from the route", () => {
  const g = E.createGame("scribe");
  const log = stepsUntilEnd(g, { c1: "a", c2: "b", c3: "d" });
  const kinds = log.map((s) => s.kind);
  const iPick = log.findIndex((s) => s.kind === "choice" && s.id === "c3");
  assert.equal(log[iPick + 1].text.ko, "므나헴은 대답을 듣기 전에 무리를 빠져나온다.", "the cut option's reaction plays");
  const card = log[iPick + 2];
  assert.equal(card.kind, "endingTitle", "the ending card follows the reaction at once");
  assert.equal(card.cut, true);
  assert.equal(card.lens, null);
  assert.deepEqual(card.lensLabel, BHS.meta.cut.label);
  assert.deepEqual(card.title, BHS.meta.endings.scribe.cut);
  assert.ok(!log.some((s) => s.mismatch), "no mismatch line on a cut");
  assert.ok(!texts(log).includes("기록장을 편다."), "no endingPreface on a cut");
  assert.ok(!log.some((s) => s.kind === "verse" && /^MT_9_(4|5|6|7|8)/.test(s.key)), "the rest of the route is skipped");
  assert.ok(!log.some((s) => s.kind === "choice" && s.id === "c4"), "c4 is never asked");
  assert.deepEqual(texts(log.slice(iPick + 3)), [
    "몇 시간 뒤",
    "선생님, 그 사람이 일어나 침상을 들고 집으로 갔어요.",
    "아침에 밑줄 그은 글자가 떠오른다.",
    "너는 첫마디까지 들었다. 그다음 말은 하난이 대신 들었다.",
    "― 등잔이 꺼진다 ―"
  ]);
  assert.equal(log[kinds.indexOf("last")].text.ko, BHS.fixtureRoutes.scribe.endings.cut.last.ko);
  assert.equal(kinds[kinds.length - 1], "end");
  assert.deepEqual(g.state.ending, {
    routeId: "scribe",
    id: "scribe-cut",
    lens: null,
    cut: true,
    scores: { 1: 1, 2: 1, 3: 0 },
    lastLens: null,
    c10Lens: null,
    mismatch: false,
    cutAt: { choice: "c3", option: "d" }
  });
  assert.equal(g.lens().cut, true);
  assert.equal(g.state.done, true);
});

test("cut: the protagonist leaves the scene - pinned thought cleared, light off at the card", () => {
  const g = E.createGame("scribe");
  playTo(g, (s) => s.kind === "choice" && s.id === "c3");
  assert.ok(g.view().stage.pinned, "the thought is pinned when the cut option is offered");
  assert.equal(g.view().stage.light, "soft");
  g.choose("d");
  assert.equal(g.step.kind, "line", "the reaction still plays at the crowd");
  assert.ok(g.view().stage.pinned, "and the pinned thought stays during it");
  g.next();
  assert.equal(g.step.kind, "endingTitle");
  assert.equal(g.view().stage.pinned, null);
  assert.equal(g.view().stage.light, "off");
});

test("cut: flags set by the cut option reach the cut ending; a route without a coda ends after the last line", () => {
  const g = E.createGame("friend");
  const log = stepsUntilEnd(g, { c1: "a", c2: "d" });
  const t = texts(log);
  const iReact = t.indexOf("다른 사람들이 침상을 들고 간다. 요나는 골목에 남는다.");
  assert.ok(iReact > 0);
  assert.equal(g.state.flags.stayed, true);
  assert.ok(t.includes("아셀이 자기 침상을 들고 요나 곁을 지나간다."), "the flag condition in endings.cut holds");
  assert.ok(!log.some((s) => s.kind === "verse"), "the crowd scene is skipped");
  assert.equal(log[log.length - 2].kind, "last");
  assert.equal(log[log.length - 1].kind, "end");
  assert.equal(g.state.ending.id, "friend-cut");
  assert.equal(g.view().stage.bg, "lane", "the scene stays where the route was cut");
});

test("cut: a cut option without a reaction goes straight to the card; condState has no lastLens", () => {
  const route = JSON.parse(JSON.stringify(BHS.fixtureRoutes.scribe));
  delete route.beats.find((b) => b.id === "c3").options[3].reaction;
  BHS.routes.__cut = Object.assign(route, { id: "__cut" });
  try {
    const g = E.createGame("__cut");
    playTo(g, (s) => s.kind === "choice" && s.id === "c3");
    g.choose("d");
    assert.equal(g.step.kind, "endingTitle");
    assert.equal(g.step.cut, true);
    assert.equal(g.condState().lastLens, null);
    assert.equal(E.evalCond({ lastLens: 1 }, g.condState()), false);
  } finally {
    delete BHS.routes.__cut;
  }
});

test("save + restore across a cut: at the reaction, the card, a cut beat and the last line", () => {
  const map = { c1: "a", c2: "a", c3: "d" };
  const full = stepsUntilEnd(E.createGame("scribe"), map);
  const at = [
    (s) => s.kind === "line" && /빠져나온다/.test(s.text.ko),
    (s) => s.kind === "endingTitle",
    (s) => s.kind === "line" && s.speaker === "hanan" && /집으로 갔어요/.test(s.text.ko),
    (s) => s.kind === "last"
  ];
  for (const pred of at) {
    const a = E.createGame("scribe");
    playTo(a, pred, (s) => map[s.id]);
    assert.ok(pred(a.step), "reached the save point");
    const snap = snapshot(a);
    assert.equal(E.canRestore(snap), true);
    const b = E.restoreGame(snap);
    assert.deepEqual(b.step, a.step);
    const la = stepsUntilEnd(a, map);
    const lb = stepsUntilEnd(b, map);
    assert.deepEqual(lb, la);
    assert.deepEqual(b.state.ending, a.state.ending);
    assert.equal(b.state.ending.id, "scribe-cut");
    assert.deepEqual(la, full.slice(full.length - la.length), "the resumed tail matches an uninterrupted run");
  }
});

test("every path of every fixture route ends with the ending computeLens predicts (256 paths each)", () => {
  const ids = ["a", "b", "c", "d"];
  for (const rid of ["scribe", "friend", "asher"]) {
    const counts = { 1: 0, 2: 0, 3: 0, cut: 0 };
    for (let n = 0; n < 256; n++) {
      const map = {};
      for (let i = 0; i < 4; i++) map["c" + (i + 1)] = ids[(n >> (2 * i)) & 3];
      const g = E.createGame(rid);
      const log = stepsUntilEnd(g, map);
      const exp = E.computeLens(rid, map);
      const want = exp.cut ? rid + "-cut" : rid + "-" + exp.lens;
      assert.equal(g.state.ending.id, want, `${rid} ${JSON.stringify(map)}`);
      assert.equal(log.some((s) => s.mismatch), exp.mismatch, `${rid} mismatch line ${JSON.stringify(map)}`);
      counts[exp.cut ? "cut" : exp.lens]++;
    }
    if (rid === "asher") assert.equal(counts.cut, 0, "asher has no cut");
    else assert.equal(counts.cut, 64, `${rid}: one cut option of four at one choice = 25% of paths`);
    assert.equal(counts[1] + counts[2] + counts[3] + counts.cut, 256);
  }
});

// ---------------------------------------------------------------- friend: flags + conditions

test("friend: flags drive conditional beats, reactions with two lines", () => {
  const g = E.createGame("friend");
  const log = stepsUntilEnd(g, { c1: "b", c2: "c", c3: "d" });
  const t = texts(log);
  assert.ok(t.includes("아셀한테 가야 해."), "c1 reaction");
  assert.ok(t.includes("침상이 기운다. 요나가 모서리를 다시 잡는다."), "choice condition");
  assert.ok(t.includes("그 손들 가운데 네 손이 있다."), "not(flag) condition");
  assert.ok(t.includes("요나는 물러서서 아셀이 자기 침상을 들게 둔다."), "any[] condition");
  assert.ok(t.includes("행인 앞을 막아섰던 손이 이제는 비어 있다."), "all[] + not condition");
  assert.equal(g.state.flags.stood, true);
  const g2 = E.createGame("friend");
  const t2 = texts(stepsUntilEnd(g2, { c2: "b" }));
  const i = t2.indexOf("네가 그걸 어떻게 알아?");
  assert.ok(i > 0, "c2 reaction line 1");
  assert.equal(t2[i + 1], "요나는 대답하지 못한다.", "c2 reaction line 2");
  assert.ok(!t2.includes("침상이 기운다. 요나가 모서리를 다시 잡는다."));
  assert.ok(!t2.includes("요나는 물러서서 아셀이 자기 침상을 들게 둔다."));
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
  playTo(g, (s) => s.kind === "choice" && s.id === "c2");
  assert.equal(g.actions().length, 0, "hidden after actionsHide");
  assert.equal(g.tapAction("getup"), null);
  g.choose("a");
  assert.equal(g.actions().length, 2, "shown again after actionsShow");
  playTo(g, (s) => s.kind === "press");
  assert.equal(g.step.action, "getup");
  assert.deepEqual(
    g.actions().map((a) => [a.id, a.lit]),
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
  assert.equal(g.step.kind, "press");
  assert.equal(g.step.action, null, "the getup press is answered; the next press is the labelled one");
  assert.equal(g.step.label.ko, "침상을 들어");
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

// ---------------------------------------------------------------- save / restore + fingerprints

test("serialize / restoreGame resumes identically", () => {
  const map = { c1: "b", c2: "c", c3: "a", c4: "d" };
  const a = E.createGame("scribe");
  playTo(a, (s) => s.kind === "choice" && s.id === "c3", (s) => map[s.id]);
  const snap = snapshot(a);
  assert.equal(snap.v, E.STATE_VERSION);
  assert.equal(snap.fp, E.fingerprint("scribe"));
  const b = E.restoreGame(snap);
  const la = stepsUntilEnd(a, map);
  const lb = stepsUntilEnd(b, map);
  assert.deepEqual(lb, la);
  assert.deepEqual(b.state.ending, a.state.ending);
});

test("fingerprint: stable, structural (text edits keep it; beat, option and cut changes alter it)", () => {
  const base = BHS.fixtureRoutes.scribe;
  const fp = E.fingerprint("scribe");
  assert.match(fp, /^r[0-9a-z]+$/);
  assert.equal(E.fingerprint(base), fp);
  assert.notEqual(E.fingerprint("friend"), fp);
  const edited = JSON.parse(JSON.stringify(base));
  edited.beats[1].text = { ko: "다른 문장.", en: "Another line." };
  assert.equal(E.fingerprint(edited), fp, "a text edit keeps the fingerprint");
  const added = JSON.parse(JSON.stringify(base));
  added.beats.splice(2, 0, { type: "line", text: { ko: "새 줄", en: "New line" } });
  assert.notEqual(E.fingerprint(added), fp, "an added beat changes it");
  const cutMoved = JSON.parse(JSON.stringify(base));
  delete cutMoved.beats.find((b) => b.id === "c3").options[3].cut;
  assert.notEqual(E.fingerprint(cutMoved), fp, "a cut flag change changes it");
  const reacted = JSON.parse(JSON.stringify(base));
  reacted.beats.find((b) => b.id === "c2").options[0].reaction = [{ type: "line", text: { ko: "가", en: "a" } }];
  assert.notEqual(E.fingerprint(reacted), fp, "a new reaction changes it");
  assert.match(E.fingerprint("prologue"), /^p[0-9a-z]+$/);
  assert.equal(E.fingerprint("nope"), null);
});

test("restoreGame rejects incompatible snapshots", () => {
  assert.throws(() => E.restoreGame(null));
  assert.throws(() => E.restoreGame({ routeId: "scribe", v: 999 }));
  assert.throws(() => E.createGame("nope"));
  const g = E.createGame("friend");
  playTo(g, (s) => s.kind === "choice" && s.id === "c2");
  const good = snapshot(g);
  assert.equal(E.canRestore(good), true);
  assert.equal(E.canRestore(Object.assign({}, good, { fp: "r0" })), false, "stale fingerprint");
  assert.equal(E.canRestore(Object.assign({}, good, { routeId: "scribe" })), false, "another route's fingerprint");
  assert.equal(E.canRestore(Object.assign({}, good, { routeId: "nope" })), false);
  assert.equal(E.canRestore(Object.assign({}, good, { stack: null })), false, "damaged");
  assert.equal(E.canRestore(Object.assign({}, good, { step: null })), false, "damaged");
  assert.equal(E.canRestore({}), false);
  assert.equal(E.canRestore("x"), false);
  assert.throws(() => E.restoreGame(Object.assign({}, good, { fp: "r0" })), /Incompatible saved state/);
});

// A snapshot exactly as release 1.0 stored it (10-choice routes): version 1, no fingerprint,
// c1-c10 picks, a c10Lens field and beat indexes of the old route files.
function v1Snapshot() {
  return {
    v: 1,
    routeId: "scribe",
    segs: ["beats", "@ending"],
    seg: 0,
    stack: [{ list: "beats", i: 57 }],
    choices: { c1: "a", c2: "b", c3: "c", c4: "d", c5: "a", c6: "b", c7: "c", c8: "d", c9: "a" },
    flags: { mark: "he" },
    vars: {},
    picks: ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9"],
    c10Lens: null,
    stage: { bg: "lamp_night", caption: null, time: "day", pov: "normal", light: "off", pinned: null, actionsVisible: false, actionReplies: {}, actionCounts: {}, sceneSeq: 9, cast: [], speaking: null, castSeq: 4, risen: true },
    pending: { hush: false, echo: null },
    now: { hush: false, echo: null },
    step: { kind: "choice", id: "c10", prompt: { ko: "기록장의 마지막 줄에 무엇을 적을까?", en: "What do you write?" }, options: [] },
    at: { list: "beats", index: 56 },
    ending: null,
    steps: 140,
    done: false
  };
}

test("a release 1.0 (v1, 10-choice) save is dropped cleanly: canRestore false, restoreGame throws, nothing runs", () => {
  const old = v1Snapshot();
  const warned = E.warnings.length;
  assert.equal(E.canRestore(old), false);
  assert.throws(() => E.restoreGame(old), /Incompatible saved state/);
  // Even with the version patched, the missing fingerprint keeps it out.
  assert.equal(E.canRestore(Object.assign({}, old, { v: E.STATE_VERSION })), false);
  // A 1.0 save whose ending tail still listed the removed final screen.
  const tail = Object.assign(v1Snapshot(), { segs: ["beats", "@ending", "endingCoda", "@final", "@end"], step: { kind: "final", routeId: "scribe", lens: 1 } });
  assert.equal(E.canRestore(tail), false);
  assert.equal(E.warnings.length, warned, "no engine warnings: the snapshot was never run");
  // Its stray picks do not disturb scoring when passed in.
  assert.deepEqual(E.computeLens("scribe", old.choices).scores, { 1: 3, 2: 1, 3: 1 }, "only c1-c4 count (c4 d is lens 1, weight 2)");
});

test("the prologue can be saved and restored", () => {
  const g = E.createGame("prologue");
  g.next();
  const snap = snapshot(g);
  assert.equal(E.canRestore(snap), true);
  const r = E.restoreGame(snap);
  assert.deepEqual(r.step, g.step);
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
  const s = g.fastForward({ until: (st) => st.kind === "choice" && st.id === "c3", pick: () => "b" });
  assert.equal(s.id, "c3");
  assert.deepEqual(g.state.choices, { c1: "b", c2: "b" });
});

test("all 4^4 paths: computeLens returns a valid outcome and is fast", () => {
  const ids = ["a", "b", "c", "d"];
  const counts = { 1: 0, 2: 0, 3: 0, cut: 0 };
  const t0 = Date.now();
  const choices = {};
  for (let rep = 0; rep < 40; rep++) {
    for (let n = 0; n < 256; n++) {
      for (let i = 0; i < 4; i++) choices["c" + (i + 1)] = ids[(n >> (2 * i)) & 3];
      const r = E.computeLens("scribe", choices);
      if (rep === 0) counts[r.cut ? "cut" : r.lens]++;
    }
  }
  assert.equal(counts[1] + counts[2] + counts[3] + counts.cut, 256);
  assert.equal(counts.cut, 64);
  assert.ok(Date.now() - t0 < 10000);
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
