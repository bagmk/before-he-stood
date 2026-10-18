// tests/ui-playtest.mjs - browser playtest of index.html with Playwright (Chromium).
// Run: node tests/ui-playtest.mjs [--shots] [--sizes=phone,tv,hd] [--url=<file or http url>]
// Plays every route end to end, one route keyboard-only, checks console errors and the QA hooks,
// and with --shots saves screenshots to qa/engine/.
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v === undefined ? true : v];
  })
);

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  ({ chromium } = await import("/opt/npm-tools/node_modules/playwright/index.mjs"));
}

const SIZES = {
  phone: { width: 390, height: 844, dpr: 2 },
  tv: { width: 1920, height: 1080, dpr: 1 },
  hd: { width: 1280, height: 720, dpr: 1 },
  small: { width: 360, height: 640, dpr: 2 }
};
const sizes = String(args.sizes || "phone,tv,hd").split(",");
const baseUrl = args.url || pathToFileURL(path.join(root, "index.html")).href;
const shotDir = path.join(root, "qa/engine");
if (args.shots) fs.mkdirSync(shotDir, { recursive: true });

const failures = [];
const notes = [];
function check(cond, msg) {
  if (!cond) failures.push(msg);
}

function ignorable(text) {
  // Google Fonts are optional; the sandbox has no route to them.
  return /fonts\.(googleapis|gstatic)\.com|ERR_TUNNEL_CONNECTION_FAILED|ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED/.test(text);
}

async function snapshot(page) {
  return page.evaluate(() => {
    const g = window.BHS_DEBUG && window.BHS_DEBUG.game();
    return {
      st: window.BHS_DEBUG ? window.BHS_DEBUG.state() : null,
      step: g ? g.step : null,
      stage: g ? g.state.stage : null,
      now: g ? g.state.now : null,
      screen: document.body.dataset.screen
    };
  });
}

async function shot(page, name) {
  if (!args.shots) return;
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(shotDir, name + ".png") });
}

// Click through the story until `until(snap)` is true. `pick(step)` returns an option id.
async function playUntil(page, until, pick, label, max = 900) {
  for (let i = 0; i < max; i++) {
    const s = await snapshot(page);
    if (until(s)) return s;
    const kind = s.step && s.step.kind;
    if (s.screen === "routeSelect" || s.screen === "final" || s.screen === "gallery" || s.screen === "title") {
      throw new Error(`${label}: reached ${s.screen} before the target`);
    }
    if (kind === "choice") await page.click(`[data-testid="choice-${pick(s.step)}"]`);
    else if (kind === "press") await page.click('[data-testid="press"]');
    else await page.click('[data-testid="advance"]');
  }
  throw new Error(`${label}: target not reached`);
}

async function newPage(browser, sizeName, extra = "") {
  const sz = SIZES[sizeName];
  const ctx = await browser.newContext({ viewport: { width: sz.width, height: sz.height }, deviceScaleFactor: sz.dpr });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !ignorable(m.text())) errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("requestfailed", (r) => {
    if (!ignorable(r.url() + " " + (r.failure() && r.failure().errorText))) errors.push("requestfailed: " + r.url());
  });
  page.on("dialog", (d) => {
    errors.push("native dialog used: " + d.type());
    d.dismiss();
  });
  const url = baseUrl + (baseUrl.includes("?") ? "&" : "?") + "test=1" + extra;
  return { ctx, page, errors, url };
}

async function noHorizontalScroll(page, label) {
  const over = await page.evaluate(() => {
    const els = [document.documentElement, document.body, document.getElementById("screen")];
    return els.some((el) => el && el.scrollWidth > el.clientWidth + 1);
  });
  check(!over, `${label}: horizontal overflow`);
}

async function minFontPx(page) {
  // Smallest rendered font size among visible text nodes (debug panel excluded).
  return page.evaluate(() => {
    let min = 1e9;
    let who = "";
    const walker = document.createTreeWalker(document.getElementById("app"), NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (!n.textContent.trim()) continue;
      const el = n.parentElement;
      if (!el || el.closest(".debug") || el.closest("[hidden]")) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
      const fs = parseFloat(cs.fontSize);
      if (fs < min) {
        min = fs;
        who = el.className + " :: " + n.textContent.trim().slice(0, 30);
      }
    }
    return { min, who };
  });
}

async function fullRoute(browser, sizeName, routeId, picker, opts = {}) {
  const { ctx, page, errors, url } = await newPage(browser, sizeName);
  const tag = `${sizeName}/${routeId}`;
  await page.goto(url + "#" + routeId);
  await page.waitForSelector('[data-testid="advance"]');
  let s = await snapshot(page);
  check(s.screen === "play", `${tag}: deep link should open play, got ${s.screen}`);

  const shots = opts.shots || {};
  const taken = new Set();
  const vh = SIZES[sizeName].height;
  let minStory = 1e9;
  for (let i = 0; i < 1200; i++) {
    s = await snapshot(page);
    const step = s.step || {};
    for (const [name, pred] of Object.entries(shots)) {
      if (!taken.has(name) && pred(s)) {
        taken.add(name);
        if (name.startsWith("asher-actions")) {
          await page.click('[data-testid="action-getup"]');
          const reply = await page.textContent("#reply");
          check(reply && reply.trim().length > 0, `${tag}: getup reply shown`);
        }
        await shot(page, `${sizeName}-${name}`);
      }
    }
    if (s.screen === "final") break;
    if (step.kind === "line" && i % 3 === 0) {
      const protagonist = { scribe: "menahem", friend: "yonah", asher: "asher" }[routeId];
      const own = await page.locator(`[data-testid="portrait-${protagonist}"]`).count();
      check(own === 0, `${tag}: protagonist portrait shown at ${s.st.list}#${s.st.beatIndex}`);
    }
    if (step.kind === "line" && i % 7 === 0) {
      const fsz = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector("#text p")).fontSize));
      minStory = Math.min(minStory, fsz);
    }
    if (step.kind === "choice") {
      const n = await page.locator('[data-testid^="choice-"]').count();
      check(n === 4, `${tag}: ${step.id} shows ${n} options`);
      await page.click(`[data-testid="choice-${picker(step)}"]`);
    } else if (step.kind === "press") await page.click('[data-testid="press"]');
    else await page.click('[data-testid="advance"]');
  }
  s = await snapshot(page);
  check(s.screen === "final", `${tag}: should reach the final screen, got ${s.screen}`);
  const lens = s.st.lens;
  const blank = page.locator('[data-testid="final-blank"]');
  check((await blank.count()) === 1, `${tag}: one editable blank`);
  await blank.fill("시험 test");
  await shot(page, `${sizeName}-final-${routeId}`);
  await noHorizontalScroll(page, `${tag} final`);
  await page.click('[data-testid="final-next"]');
  s = await snapshot(page);
  check(s.screen === "gallery", `${tag}: gallery after final`);
  const seen = await page.getAttribute(`[data-testid="gallery-cell-${routeId}-${lens}"]`, "data-seen");
  check(seen === "true", `${tag}: gallery cell ${routeId}-${lens} marked seen`);
  if (opts.galleryShot) await shot(page, `${sizeName}-gallery`);
  const blanks = await page.evaluate(() => localStorage.getItem("bhs.v1.blanks"));
  check(blanks && blanks.includes("시험 test"), `${tag}: blank persisted`);
  if (sizeName !== "phone" && minStory < 1e9) {
    check(minStory >= vh * 0.036 - 0.5, `${tag}: story text ${minStory}px < 3.6vh`);
  }
  check(errors.length === 0, `${tag}: console errors: ${errors.join(" | ")}`);
  notes.push(`${tag}: ending ${routeId}-${lens}, min story font ${minStory.toFixed(1)}px`);
  await ctx.close();
}

async function titleAndPrologue(browser, sizeName) {
  const { ctx, page, errors, url } = await newPage(browser, sizeName);
  const tag = `${sizeName}/title`;
  await page.goto(url);
  await page.waitForSelector('[data-testid="start"]');
  check((await page.getAttribute('[data-testid="lang-both"]', "aria-pressed")) === "true", `${tag}: both is the default language`);
  check((await page.locator('[data-testid="continue"]').count()) === 0, `${tag}: no continue without a save`);
  await shot(page, `${sizeName}-title`);
  await noHorizontalScroll(page, tag);
  const mf = await minFontPx(page);
  if (sizeName !== "phone") check(mf.min >= SIZES[sizeName].height * 0.022 - 0.5, `${tag}: smallest text ${mf.min}px (${mf.who}) < 2.2vh`);
  notes.push(`${tag}: smallest text ${mf.min}px (${mf.who})`);
  await page.click('[data-testid="start"]');
  let s = await snapshot(page);
  check(s.screen === "prologue", `${tag}: start opens the prologue`);
  for (let i = 0; i < 40 && s.screen === "prologue"; i++) {
    await page.click('[data-testid="advance"]');
    s = await snapshot(page);
  }
  check(s.screen === "routeSelect", `${tag}: prologue ends at route select`);
  await shot(page, `${sizeName}-route-select`);
  await noHorizontalScroll(page, `${sizeName}/routeSelect`);
  const mf2 = await minFontPx(page);
  if (sizeName !== "phone") check(mf2.min >= SIZES[sizeName].height * 0.022 - 0.5, `${sizeName}/routeSelect: smallest text ${mf2.min}px (${mf2.who})`);
  // Continue appears after a reload (route select is saved).
  await page.reload();
  await page.waitForSelector('[data-testid="start"]');
  check((await page.locator('[data-testid="continue"]').count()) === 1, `${tag}: continue offered after reload`);
  // Settings + header controls.
  await page.click('[data-testid="continue"]');
  s = await snapshot(page);
  check(s.screen === "routeSelect", `${tag}: continue restores route select`);
  await page.click('[data-testid="route-asher"]');
  await page.click('[data-testid="settings-open"]');
  await page.click('[data-testid="speed-instant"]');
  await shot(page, `${sizeName}-settings`);
  await page.click('[data-testid="settings-close"]');
  await page.click('[data-testid="home"]');
  check((await page.locator('[data-testid="confirm-yes"]').count()) === 1, `${tag}: in-page confirm`);
  await shot(page, `${sizeName}-confirm`);
  await page.click('[data-testid="confirm-no"]');
  s = await snapshot(page);
  check(s.screen === "play", `${tag}: confirm-no stays in play`);
  await page.click('[data-testid="home"]');
  await page.click('[data-testid="confirm-yes"]');
  s = await snapshot(page);
  check(s.screen === "title", `${tag}: confirm-yes returns to title`);
  check(errors.length === 0, `${tag}: console errors: ${errors.join(" | ")}`);
  await ctx.close();
}

async function keyboardOnly(browser, sizeName, routeId) {
  const { ctx, page, errors, url } = await newPage(browser, sizeName);
  const tag = `${sizeName}/${routeId}/keyboard`;
  await page.goto(url);
  await page.waitForSelector('[data-testid="start"]');
  await page.keyboard.press("PageDown"); // title -> prologue
  let s = await snapshot(page);
  check(s.screen === "prologue", `${tag}: PageDown on the title starts`);
  const keys = ["Space", "Enter", "ArrowRight", "PageDown", "ArrowDown"];
  let k = 0;
  for (let i = 0; i < 60 && s.screen === "prologue"; i++) {
    await page.keyboard.press(keys[k++ % keys.length]);
    s = await snapshot(page);
  }
  check(s.screen === "routeSelect", `${tag}: keyboard reaches route select`);
  // Tab to the route card and activate it.
  await page.focus(`[data-testid="route-${routeId}"]`);
  await page.keyboard.press("Enter");
  s = await snapshot(page);
  check(s.screen === "play" && s.st.routeId === routeId, `${tag}: Enter on a route card starts it`);
  const pickKeys = ["1", "b", "3", "D", "2", "a", "4", "c", "1", "B"];
  let picks = 0;
  for (let i = 0; i < 1500 && s.screen !== "final"; i++) {
    const kind = s.step && s.step.kind;
    if (kind === "choice") {
      if (picks === 2) {
        // Arrow focus then Enter picks the focused option.
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("ArrowDown");
        const focused = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute("data-testid"));
        check(focused === "choice-b", `${tag}: arrows move focus (${focused})`);
        if (args.shots && sizeName === "tv") await shot(page, `${sizeName}-keyboard-focus`);
        await page.keyboard.press("Enter");
      } else await page.keyboard.press(pickKeys[picks % pickKeys.length]);
      picks++;
    } else if (kind === "press") await page.keyboard.press("ArrowRight");
    else {
      await page.keyboard.press(keys[k++ % keys.length]);
      if (i === 3) {
        // PageUp / ArrowLeft must never change anything.
        const before = (await snapshot(page)).st;
        await page.keyboard.press("PageUp");
        await page.keyboard.press("ArrowLeft");
        const after = (await snapshot(page)).st;
        check(before.beatIndex === after.beatIndex && before.list === after.list, `${tag}: PageUp/ArrowLeft are inert`);
      }
    }
    s = await snapshot(page);
  }
  check(s.screen === "final", `${tag}: keyboard reaches final (${s.screen})`);
  check(picks === 10, `${tag}: made ${picks} picks by keyboard`);
  // Esc opens the in-page menu on the final screen.
  await page.keyboard.press("Escape");
  check((await page.locator('[data-testid="confirm-yes"]').count()) === 1, `${tag}: Esc opens the menu`);
  await page.keyboard.press("Escape");
  check((await page.locator('[data-testid="confirm-yes"]').count()) === 0, `${tag}: Esc closes the menu`);
  check(errors.length === 0, `${tag}: console errors: ${errors.join(" | ")}`);
  notes.push(`${tag}: ended ${s.st.ending}`);
  await ctx.close();
}

const browser = await chromium.launch();
try {
  for (const size of sizes) {
    await titleAndPrologue(browser, size);
    const isPhone = size === "phone";
    await fullRoute(browser, size, "scribe", (st) => (st.id === "c1" ? "a" : "abcd"[(Number(st.id.slice(1)) + 1) % 4]), {
      galleryShot: true,
      shots: {
        "choice": (s) => s.step && s.step.kind === "choice" && s.step.id === "c1",
        "verse-light": (s) => s.step && s.step.kind === "verse" && s.step.key === "MT_9_2B",
        "echo": (s) => s.now && s.now.echo && s.step && s.step.kind === "line",
        "pinned-read": (s) => s.stage && s.stage.pinned && s.stage.pinned.read && s.step.kind !== "choice",
        "ending-card": (s) => s.screen === "endingCard",
        "last-line": (s) => s.step && s.step.kind === "last"
      }
    });
    await fullRoute(browser, size, "friend", (st) => "bcda"[Number(st.id.slice(1)) % 4], {
      shots: {
        "portrait": (s) => s.step && s.step.kind === "line" && s.stage && s.stage.speaking && s.stage.cast && s.stage.cast.length >= 1,
        "portrait-two": (s) => s.step && s.step.kind === "line" && s.stage && s.stage.speaking && s.stage.cast && s.stage.cast.length > 1,
        "sign": (s) => s.step && s.step.kind === "line" && s.step.speaker === "sign" && s.st.routeId === "friend"
      }
    });
    await fullRoute(browser, size, "asher", (st) => "dcba"[Number(st.id.slice(1)) % 4], {
      shots: {
        "asher-actions": (s) => s.step && s.step.kind === "line" && s.stage && s.stage.actionsVisible && s.stage.pov === "lying",
        "asher-press": (s) => s.step && s.step.kind === "press" && s.step.action === "getup",
        "asher-choice": (s) => s.step && s.step.kind === "choice" && s.step.id === "c1"
      }
    });
    if (!isPhone || sizes.length === 1) await keyboardOnly(browser, size, size === "hd" ? "friend" : "scribe");
  }
} catch (err) {
  failures.push("crash: " + (err && err.stack ? err.stack.split("\n").slice(0, 3).join(" / ") : err));
} finally {
  await browser.close();
}

notes.forEach((n) => console.log("note  " + n));
failures.forEach((f) => console.log("FAIL  " + f));
console.log(`\nui-playtest: ${failures.length} failures`);
process.exit(failures.length ? 1 : 0);
