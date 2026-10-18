// tests/ui-extra.mjs - focused browser checks that complement tests/ui-playtest.mjs.
// Run: node tests/ui-extra.mjs [--shots]
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const shots = process.argv.includes("--shots");
const shotDir = path.join(root, "qa/engine");
fs.mkdirSync(shotDir, { recursive: true });

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  ({ chromium } = await import("/opt/npm-tools/node_modules/playwright/index.mjs"));
}

const index = pathToFileURL(path.join(root, "index.html")).href;
const fixture = pathToFileURL(path.join(root, "tests/fixture.html")).href;
const failures = [];
const notes = [];
const check = (c, m) => {
  if (!c) failures.push(m);
};
const ignorable = (t) => /fonts\.(googleapis|gstatic)\.com|ERR_TUNNEL_CONNECTION_FAILED|ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED/.test(t);

async function open(browser, url, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1920, height: 1080 }, deviceScaleFactor: opts.dpr || 1, reducedMotion: opts.reducedMotion || "no-preference" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !ignorable(m.text())) errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  if (opts.init) await page.addInitScript(opts.init);
  await page.goto(url);
  await page.waitForFunction(() => window.BHS_DEBUG && document.body.dataset.screen);
  return { ctx, page, errors };
}

const state = (page) => page.evaluate(() => window.BHS_DEBUG.state());
const shot = async (page, name) => {
  if (shots) await page.screenshot({ path: path.join(shotDir, name + ".png") });
};

async function toStep(page, pred, max = 400) {
  for (let i = 0; i < max; i++) {
    const s = await page.evaluate(() => {
      const g = window.BHS_DEBUG.game();
      return { st: window.BHS_DEBUG.state(), step: g && g.step };
    });
    if (pred(s)) return s;
    const k = s.step && s.step.kind;
    if (k === "choice") await page.click('[data-testid="choice-a"]');
    else if (k === "press") await page.click('[data-testid="press"]');
    else await page.click('[data-testid="advance"]');
  }
  throw new Error("step not reached");
}

const browser = await chromium.launch();
try {
  // 1. Language modes on TV.
  for (const lang of ["ko", "en"]) {
    const { ctx, page, errors } = await open(browser, index + "?test=1");
    await page.click(`[data-testid="lang-${lang}"]`);
    check((await page.getAttribute(`[data-testid="lang-${lang}"]`, "aria-pressed")) === "true", `${lang}: title toggle pressed`);
    await page.click('[data-testid="start"]');
    await toStep(page, (s) => s.st.screen === "routeSelect");
    await page.click('[data-testid="route-scribe"]');
    const s = await toStep(page, (x) => x.step && x.step.kind === "line" && x.step.speaker === "hanan");
    const plate = await page.textContent('[data-testid="speaker"]');
    check(lang === "ko" ? plate.trim() === "하난" : plate.trim() === "Hanan", `${lang}: plate shows one language (${plate})`);
    const text = await page.textContent('[data-testid="textbox"]');
    check(lang === "ko" ? /[가-힣]/.test(text) && !/[A-Za-z]{4,}/.test(text) : !/[가-힣]/.test(text), `${lang}: text box shows one language`);
    await shot(page, `tv-lang-${lang}-line`);
    await toStep(page, (x) => x.step && x.step.kind === "choice");
    await shot(page, `tv-lang-${lang}-choice`);
    // Header toggle switches back to both without losing the place.
    const before = await state(page);
    await page.click('[data-testid="hdr-lang-both"]');
    const after = await state(page);
    check(after.lang === "both" && after.beatIndex === before.beatIndex, `${lang}: header language switch keeps the place`);
    check(errors.length === 0, `${lang}: console errors ${errors.join(" | ")}`);
    await ctx.close();
  }

  // 2. Reduced motion: no typewriter even without ?test=1.
  {
    const { ctx, page, errors } = await open(browser, index + "#friend", { reducedMotion: "reduce" });
    await page.waitForTimeout(50);
    const st = await state(page);
    check(st.typing === false, "reduced motion: text appears at once");
    check(errors.length === 0, "reduced motion: console errors " + errors.join(" | "));
    await ctx.close();
  }

  // 3. Typewriter at normal speed: first tap completes, second tap advances.
  {
    const { ctx, page } = await open(browser, index + "#scribe", { viewport: { width: 390, height: 844 } });
    await page.waitForTimeout(80);
    const s0 = await state(page);
    check(s0.typing === true, "typewriter runs at normal speed");
    await page.click('[data-testid="advance"]');
    const s1 = await state(page);
    check(s1.typing === false && s1.beatIndex === s0.beatIndex, "first tap completes the line");
    await page.waitForTimeout(260);
    await page.click('[data-testid="advance"]');
    const s2 = await state(page);
    check(s2.beatIndex > s1.beatIndex, "second tap advances");
    await ctx.close();
  }

  // 4. 360x640: Asher c1 (long verse options) wraps and scrolls inside the sheet.
  {
    const { ctx, page, errors } = await open(browser, index + "?test=1#asher", { viewport: { width: 360, height: 640 }, dpr: 2 });
    await toStep(page, (x) => x.step && x.step.kind === "choice" && x.step.id === "c1");
    const m = await page.evaluate(() => {
      const box = document.getElementById("choices");
      const opts = Array.from(document.querySelectorAll(".opt"));
      return { scroll: box.scrollHeight > box.clientHeight, boxH: box.clientHeight, widthOk: opts.every((o) => o.scrollWidth <= o.clientWidth + 1), docOver: document.documentElement.scrollWidth > document.documentElement.clientWidth };
    });
    check(m.widthOk && !m.docOver, "360x640: options wrap without horizontal overflow");
    notes.push(`360x640 asher c1: sheet ${m.boxH}px tall, scrolls=${m.scroll}`);
    await shot(page, "small-asher-c1");
    await page.click('[data-testid="choice-d"]');
    check((await state(page)).choices.c1 === "d", "360x640: last option reachable and clickable");
    check(errors.length === 0, "360x640: console errors " + errors.join(" | "));
    await ctx.close();
  }

  // 5. No storage at all: the game still plays.
  {
    const init = () => {
      const deny = () => {
        throw new Error("storage disabled");
      };
      Object.defineProperty(window, "localStorage", { get: deny, configurable: true });
    };
    const { ctx, page, errors } = await open(browser, index + "?test=1", { init });
    const notice = await page.textContent(".notice").catch(() => "");
    check(/저장|Saving/.test(notice || ""), "no storage: title explains that saving is off");
    await page.click('[data-testid="start"]');
    await toStep(page, (s) => s.st.screen === "routeSelect");
    await page.click('[data-testid="route-asher"]');
    await toStep(page, (s) => s.st.screen === "final", 1500);
    await page.fill('[data-testid="final-blank"]', "x");
    await page.click('[data-testid="final-next"]');
    check((await state(page)).screen === "gallery", "no storage: reaches the gallery");
    const seen = await page.locator('[data-seen="true"]').count();
    check(seen === 1, "no storage: gallery still shows this session's ending");
    check(errors.length === 0, "no storage: console errors " + errors.join(" | "));
    await ctx.close();
  }

  // 6. Debug panel + jump.
  {
    const { ctx, page, errors } = await open(browser, index + "?debug=1&test=1#friend");
    check(await page.isVisible("#debug pre"), "debug panel visible");
    await page.selectOption("#debug select", "c6");
    await page.click("#debug >> text=jump");
    const st = await state(page);
    check(st.step === "choice" && st.stepId === null && Object.keys(st.choices).length === 5, `debug jump lands on c6 (${JSON.stringify(st.choices)})`);
    await shot(page, "tv-debug");
    await page.click("#debug >> text=auto-play");
    check((await state(page)).screen === "final", "debug auto-play reaches the final screen");
    check(errors.length === 0, "debug: console errors " + errors.join(" | "));
    await ctx.close();
  }

  // 7. Continue mid-route after a reload.
  {
    const { ctx, page } = await open(browser, index + "?test=1#scribe");
    const s = await toStep(page, (x) => x.step && x.step.kind === "choice" && x.step.id === "c3");
    await page.click('[data-testid="choice-b"]');
    const before = await state(page);
    await page.goto(index + "?test=1");
    await page.waitForSelector('[data-testid="continue"]');
    await page.click('[data-testid="continue"]');
    const after = await state(page);
    check(after.routeId === "scribe" && after.beatIndex === before.beatIndex && after.choices.c3 === "b", `continue restores the place (${before.beatIndex} -> ${after.beatIndex})`);
    await ctx.close();
  }

  // 8. Fixture routes (every beat type and FX) end to end.
  for (const rid of ["scribe", "friend", "asher"]) {
    const { ctx, page, errors } = await open(browser, fixture + "?test=1#" + rid);
    await toStep(page, (s) => s.st.screen === "final", 600);
    check(errors.length === 0, `fixture ${rid}: console errors ${errors.join(" | ")}`);
    await ctx.close();
  }

  // 9. Larger text on TV keeps the panel inside the screen.
  {
    const { ctx, page } = await open(browser, index + "?test=1#friend");
    await page.click('[data-testid="settings-open"]');
    await page.click('[data-testid="size-up"]');
    await page.click('[data-testid="size-up"]');
    await page.click('[data-testid="settings-close"]');
    const r = await page.evaluate(() => document.getElementById("panel").getBoundingClientRect().toJSON());
    check(r.top > 0 && r.bottom <= 1080, "A+ A+: panel stays on screen");
    await shot(page, "tv-text-larger");
    await ctx.close();
  }
} catch (err) {
  failures.push("crash: " + (err && err.stack ? err.stack.split("\n").slice(0, 3).join(" / ") : err));
} finally {
  await browser.close();
}
notes.forEach((n) => console.log("note  " + n));
failures.forEach((f) => console.log("FAIL  " + f));
console.log(`\nui-extra: ${failures.length} failures`);
process.exit(failures.length ? 1 : 0);
