// tests/ui-extra.mjs - focused browser checks that complement tests/ui-playtest.mjs.
// Run: node tests/ui-extra.mjs [--shots]
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const shots = process.argv.includes("--shots");
const shotDir = path.join(root, "qa/engine");
fs.mkdirSync(shotDir, { recursive: true });

// Playwright 1.56.1 lives outside the project (/tmp/pwqa); the browsers are preinstalled in /opt/pw-browsers.
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync("/opt/pw-browsers")) process.env.PLAYWRIGHT_BROWSERS_PATH = "/opt/pw-browsers";
let chromium;
try {
  ({ chromium } = createRequire(import.meta.url)("/tmp/pwqa/node_modules/playwright"));
} catch {
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    ({ chromium } = await import("/opt/npm-tools/node_modules/playwright/index.mjs"));
  }
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

async function toStep(page, pred, max = 400, picks = {}) {
  for (let i = 0; i < max; i++) {
    const s = await page.evaluate(() => {
      const g = window.BHS_DEBUG.game();
      const echo = document.getElementById("echo");
      return { st: window.BHS_DEBUG.state(), step: g && g.step, echo: !!(echo && !echo.hidden) };
    });
    if (pred(s)) return s;
    const k = s.step && s.step.kind;
    if (k === "choice") await page.click(`[data-testid="choice-${picks[s.step.id] || "a"}"]`);
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

  // 2b. "Both" mode types the two languages in parallel (teacher request): every language starts at
  //     t = 0 and the last characters land together. First the timeline itself, exactly ...
  {
    const { ctx, page, errors } = await open(browser, index + "?test=1");
    const r = await page.evaluate(() => {
      const mk = (str) => Array.from(str).map((ch) => ({ textContent: ch }));
      const ko = mk("등잔불이 흔들린다. 두루마리가 펼쳐져 있다.");
      const en = mk("The lamp flickers. A scroll lies open.");
      const seq = window.BHS.view.typeTimeline([{ chars: ko, rate: 28 }, { chars: en, rate: 28 * 0.4 }]);
      const at = (c) => seq.find((x) => x.c === c).t;
      const one = window.BHS.view.typeTimeline([{ chars: mk("가. 나"), rate: 10 }]).map((x) => x.t);
      return {
        firstKo: at(ko[0]),
        firstEn: at(en[0]),
        lastKo: at(ko[ko.length - 1]),
        lastEn: at(en[en.length - 1]),
        sorted: seq.every((x, i) => i === 0 || seq[i - 1].t <= x.t),
        count: seq.length === ko.length + en.length,
        enMonotone: en.every((c, i) => i === 0 || at(en[i - 1]) <= at(c)),
        single: one
      };
    });
    check(r.firstKo === 0 && r.firstEn === 0, `both mode: both languages start at t=0 (ko ${r.firstKo}, en ${r.firstEn})`);
    check(Math.abs(r.lastKo - r.lastEn) < 1e-6 && r.lastKo > 0, `both mode: last ko and en chars land together (${r.lastKo} / ${r.lastEn})`);
    check(r.sorted && r.count && r.enMonotone, "both mode: one sorted timeline holding every character");
    // The syllable +1 step, "." +6 steps (a full stop pauses), " " +1 step: 0, 10, 70, 80 at 10 ms a step.
    check(JSON.stringify(r.single) === JSON.stringify([0, 10, 70, 80]), `one language keeps its natural timeline (${r.single})`);
    check(errors.length === 0, "timeline: console errors " + errors.join(" | "));
    await ctx.close();
  }
  // ... then the live typewriter on the first scribe line: within one animation frame (about 17 ms).
  {
    const init = () => {
      try {
        localStorage.setItem("bhs.v1.settings", JSON.stringify({ lang: "both", speed: "normal", size: 1 }));
      } catch (e) {
        /* storage off */
      }
      window.__typed = [];
      document.addEventListener("DOMContentLoaded", () => {
        new MutationObserver((list) => {
          const now = performance.now();
          for (const m of list) {
            const el = m.target;
            if (el.className !== "c on" || el.__seen) continue;
            el.__seen = true;
            const p = el.closest("p");
            const all = p ? Array.from(p.querySelectorAll("span.c")) : [];
            window.__typed.push({ lang: p && p.getAttribute("lang"), i: all.indexOf(el), n: all.length, t: now });
          }
        }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ["class"] });
      });
    };
    const { ctx, page, errors } = await open(browser, index + "#scribe", { init });
    await page.waitForFunction(() => window.BHS_DEBUG && window.BHS_DEBUG.state().typing === false, null, { timeout: 15000 });
    const r = await page.evaluate(() => {
      const pick = (lang, which) => {
        const xs = window.__typed.filter((x) => x.lang === lang && x.i === (which === "first" ? 0 : x.n - 1));
        return xs.length ? xs[0].t : null;
      };
      return { firstKo: pick("ko", "first"), firstEn: pick("en", "first"), lastKo: pick("ko", "last"), lastEn: pick("en", "last"), n: window.__typed.length };
    });
    const frame = 17;
    check(r.firstKo != null && r.firstEn != null && Math.abs(r.firstEn - r.firstKo) <= frame, `live both mode: English starts with Korean (${JSON.stringify(r)})`);
    check(r.lastKo != null && r.lastEn != null && Math.abs(r.lastKo - r.lastEn) <= frame, `live both mode: the last ko and en chars land within one frame (${r.lastKo} / ${r.lastEn})`);
    notes.push(`live both-mode typing of the first scribe line: ${(r.lastKo - r.firstKo).toFixed(0)} ms, ${r.n} characters`);
    check(errors.length === 0, "live typing: console errors " + errors.join(" | "));
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
    await toStep(page, (s) => s.st.screen === "gallery", 1500);
    check((await state(page)).screen === "gallery", "no storage: reaches the gallery");
    const seen = await page.locator('[data-seen="true"]').count();
    check(seen === 1, "no storage: gallery still shows this session's ending");
    check((await page.locator('[data-seen="true"][data-current="true"]').count()) === 1, "no storage: that ending is highlighted");
    check(errors.length === 0, "no storage: console errors " + errors.join(" | "));
    await ctx.close();
  }

  // 6. Debug panel + jump.
  {
    const { ctx, page, errors } = await open(browser, index + "?debug=1&test=1#friend");
    check(await page.isVisible("#debug pre"), "debug panel visible");
    const ids = await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid="debug-select"] option')).map((o) => o.value));
    check(ids.join(",") === "c1,c2,c3,c4", `debug jump lists the route's choices (${ids.join(",")})`);
    await page.selectOption('[data-testid="debug-select"]', "c3");
    await page.click('[data-testid="debug-jump"]');
    const st = await state(page);
    check(st.step === "choice" && st.stepId === "c3" && Object.keys(st.choices).length === 2 && !st.cut, `debug jump lands on c3 (${st.stepId} ${JSON.stringify(st.choices)})`);
    await shot(page, "tv-debug");
    await page.click('[data-testid="debug-autoplay"]');
    check((await state(page)).screen === "gallery", "debug auto-play reaches the gallery");
    check((await page.locator('[data-seen="true"][data-current="true"]').count()) === 1, "debug auto-play: the ending is marked seen and highlighted");
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

  // 7b. Continue during an ending after a reload, then finish: the gallery marks and highlights it.
  {
    const { ctx, page, errors } = await open(browser, index + "?test=1#friend");
    const s = await toStep(page, (x) => x.st.screen === "ending" && x.step && x.step.kind === "line", 900);
    await page.goto(index + "?test=1");
    await page.waitForSelector('[data-testid="continue"]');
    await page.click('[data-testid="continue"]');
    const after = await state(page);
    check(after.screen === "ending" && after.list === s.st.list && after.beatIndex === s.st.beatIndex, `continue restores the ending screen (${after.screen} ${after.list}#${after.beatIndex})`);
    await toStep(page, (x) => x.st.screen === "gallery", 200);
    const cur = await page.locator('[data-seen="true"][data-current="true"]').first().getAttribute("data-testid", { timeout: 2000 }).catch(() => null);
    check(cur === "gallery-cell-" + s.st.ending, `resumed ending is marked seen and highlighted (${cur}, expected gallery-cell-${s.st.ending})`);
    check(errors.length === 0, "resume in ending: console errors " + errors.join(" | "));
    await ctx.close();
  }

  // 8. Fixture routes (every beat type and FX) end to end.
  for (const rid of ["scribe", "friend", "asher"]) {
    const { ctx, page, errors } = await open(browser, fixture + "?test=1#" + rid);
    await toStep(page, (s) => s.st.screen === "gallery", 600);
    check(errors.length === 0, `fixture ${rid}: console errors ${errors.join(" | ")}`);
    await ctx.close();
  }

  // 8b. A cut ending (scribe): the card names the cut, a reload during the cut ending resumes there,
  //     the gallery marks the cut cell; then an Asher ending unlocks Asher's note in the cut column.
  {
    const { ctx, page, errors } = await open(browser, index + "?test=1#scribe");
    const cut = await page.evaluate(() => {
      for (const b of window.BHS.routes.scribe.beats) {
        if (b.type !== "choice") continue;
        const o = b.options.find((x) => x.cut === true);
        if (o) return { [b.id]: o.id };
      }
      return {};
    });
    const card = await toStep(page, (x) => x.st.screen === "endingCard", 300, cut);
    check(card.step && card.step.cut === true && card.st.cut === true && card.st.ending === "scribe-cut", `cut: the ending card is the cut card (${card.st.ending})`);
    check((await page.getAttribute('[data-testid="ending-title"]', "data-cut")) === "true", "cut: card marked data-cut");
    const title = await page.textContent('[data-testid="ending-title"]');
    const meta = await page.evaluate(() => ({ label: window.BHS.meta.cut.label.ko, title: window.BHS.meta.endings.scribe.cut.ko }));
    check(title.includes(meta.label) && title.includes(meta.title), `cut: the card shows "${meta.label}" and "${meta.title}"`);
    check((await page.locator('[data-testid="thought-bubble"]').count()) === 0, "cut: no pinned thought on the card");
    const s = await toStep(page, (x) => x.st.screen === "ending" && x.step && x.step.kind === "line", 50, cut);
    await page.goto(index + "?test=1");
    await page.waitForSelector('[data-testid="continue"]');
    await page.click('[data-testid="continue"]');
    const back = await state(page);
    check(back.screen === "ending" && back.list === s.st.list && back.beatIndex === s.st.beatIndex && back.ending === "scribe-cut", `cut: continue restores the cut ending (${back.screen} ${back.list}#${back.beatIndex})`);
    await toStep(page, (x) => x.st.screen === "gallery", 100, cut);
    check((await page.getAttribute('[data-testid="gallery-cell-scribe-cut"]', "data-current")) === "true", "cut: the gallery highlights scribe-cut");
    check((await page.getAttribute('[data-testid="gallery-cell-asher-cut"]', "data-state")) === "locked", "cut: Asher's note is locked before an Asher ending");
    await page.goto(index + "?test=1#asher");
    await toStep(page, (x) => x.st.screen === "gallery", 400);
    check((await page.getAttribute('[data-testid="gallery-cell-asher-cut"]', "data-state")) === "note", "Asher's note shows after an Asher ending");
    check((await page.getAttribute('[data-testid="gallery-cell-scribe-cut"]', "data-seen")) === "true", "the scribe cut stays seen");
    await shot(page, "tv-gallery-v3");
    check(errors.length === 0, "cut: console errors " + errors.join(" | "));
    await ctx.close();
  }

  // 8c. Route cards show the protagonist (teacher request): a bust rising from the divider (Menahem,
  //     Yonah) or Asher lying across the band; aria-hidden; never over the text; no overflow on TV
  //     (1920x1080, 1280x720) or phone (390x844); keys 1-3 and arrows work; no portraits -> text-only.
  const toRouteSelect = async (page) => {
    await page.evaluate(() => {
      try {
        localStorage.setItem("bhs.v1.save", JSON.stringify({ v: 2, at: 1, screen: "routeSelect", routeId: null, state: null }));
      } catch (e) {
        /* storage off */
      }
    });
    await page.goto(index + "?test=1");
    await page.click('[data-testid="continue"]');
    await page.waitForFunction(() => document.body.dataset.screen === "routeSelect");
  };
  for (const [w, h, dpr] of [
    [1920, 1080, 1],
    [1280, 720, 1],
    [390, 844, 2]
  ]) {
    const { ctx, page, errors } = await open(browser, index + "?test=1", { viewport: { width: w, height: h }, dpr });
    await toRouteSelect(page);
    const m = await page.evaluate(() => {
      const out = {};
      for (const rid of ["scribe", "friend", "asher"]) {
        const card = document.querySelector(`[data-testid="route-${rid}"]`);
        const art = document.querySelector(`[data-testid="routecard-portrait-${rid}"]`);
        if (!card || !art) {
          out[rid] = null;
          continue;
        }
        const r = (el) => el.getBoundingClientRect();
        const svg = art.querySelector("svg");
        const fig = r(art.querySelector(".routecard__fig"));
        out[rid] = {
          inCard: art.closest(".routecard") === card,
          hidden: art.getAttribute("aria-hidden"),
          lying: art.classList.contains("routecard__art--lying"),
          svg: !!svg && svg.getAttribute("data-portrait"),
          gapTop: r(art).top - r(card.querySelector(".routecard__tag")).bottom,
          gapBottom: r(card.querySelector(".routecard__first")).top - r(art).bottom,
          title: r(card.querySelector(".routecard__title")).bottom <= r(art).top,
          band: Math.round(r(art).height),
          fig: Math.round(fig.height),
          cardH: Math.round(r(card).height)
        };
      }
      const scr = document.getElementById("screen");
      return { cards: out, overX: document.documentElement.scrollWidth - innerWidth, scrollY: scr.scrollHeight - scr.clientHeight };
    });
    const tag = `${w}x${h}`;
    for (const rid of ["scribe", "friend", "asher"]) {
      const c = m.cards[rid];
      check(c && c.inCard && c.hidden === "true" && c.svg === (rid === "scribe" ? "menahem" : rid === "friend" ? "yonah" : "asher"), `${tag} ${rid}: portrait present, aria-hidden, right character (${JSON.stringify(c)})`);
      if (!c) continue;
      check(c.lying === (rid === "asher"), `${tag} ${rid}: ${rid === "asher" ? "Asher lies (never standing)" : "upright bust"}`);
      check(c.gapTop >= -0.5 && c.gapBottom >= -0.5 && c.title, `${tag} ${rid}: the portrait band sits between the tagline and the first line (gaps ${c.gapTop.toFixed(1)} / ${c.gapBottom.toFixed(1)})`);
      check(c.band >= (w > 900 ? 50 : 80), `${tag} ${rid}: the band has room for the figure (${c.band}px)`);
    }
    check(m.overX <= 1, `${tag}: no horizontal overflow on the route select (${m.overX}px)`);
    if (w > 900) check(m.scrollY <= 1, `${tag}: the route select fits the TV screen (${m.scrollY}px too tall)`);
    notes.push(`${tag} route cards: bands ${["scribe", "friend", "asher"].map((r) => m.cards[r] && m.cards[r].band + "px").join(" / ")} of ${m.cards.scribe && m.cards.scribe.cardH}px cards; figures ${["scribe", "friend", "asher"].map((r) => m.cards[r] && m.cards[r].fig + "px").join(" / ")}`);
    if (w === 1920) {
      // Keys: arrows move the focus between the cards, 1-3 start a route.
      await page.keyboard.press("ArrowRight");
      const f1 = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute("data-testid"));
      await page.keyboard.press("ArrowRight");
      const f2 = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute("data-testid"));
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("ArrowLeft");
      const f3 = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute("data-testid"));
      check(f1 === "route-scribe" && f2 === "route-friend" && f3 === "route-asher", `route select: arrows move the focus (${f1}, ${f2}, ${f3})`);
      await page.keyboard.press("3");
      const st = await state(page);
      check(st.screen === "play" && st.routeId === "asher", `route select: key 3 starts the third route (${st.screen} ${st.routeId})`);
    }
    check(errors.length === 0, `${tag} route cards: console errors ${errors.join(" | ")}`);
    await ctx.close();
  }
  {
    // Class flow: the suggested order under the prompt; played routes get a "Played" stamp that covers
    // neither text nor figure, and the focus starts on the first unplayed route (none of this when
    // nothing has been played; no focus change when everything has).
    const { ctx, page, errors } = await open(browser, index + "?test=1");
    const look = async (seen) => {
      await page.evaluate((g) => {
        localStorage.setItem("bhs.v1.gallery", JSON.stringify(g));
      }, seen);
      await toRouteSelect(page);
      return page.evaluate(() => {
        const r = (el) => (el ? el.getBoundingClientRect() : null);
        const cards = {};
        document.querySelectorAll(".routecard").forEach((c) => {
          const badge = c.querySelector('[data-testid^="routecard-played-"]');
          const b = r(badge);
          const fig = r(c.querySelector(".routecard__fig"));
          const tag = r(c.querySelector(".routecard__tag"));
          const first = r(c.querySelector(".routecard__first"));
          cards[c.getAttribute("data-route")] = {
            played: c.getAttribute("data-played"),
            badge: badge ? badge.innerText.trim() : null,
            clear: b ? b.top >= tag.bottom - 0.5 && b.bottom <= first.top + 0.5 && (!fig || b.right <= fig.left + 0.5) : null,
            sr: (c.querySelector(".vh") || {}).textContent || null
          };
        });
        const hint = document.querySelector('[data-testid="routes-hint"]');
        return { cards, focus: document.activeElement && document.activeElement.getAttribute("data-testid"), hint: hint ? hint.innerText : null, next: (document.querySelector('[data-next="true"]') || {}).id || (document.querySelector('[data-next="true"]') ? "set" : null) };
      });
    };
    const none = await look([]);
    check(none.hint && /서기관/.test(none.hint) && /Suggested order/.test(none.hint), `route select: the suggested order shows under the prompt ("${none.hint}")`);
    check(Object.values(none.cards).every((c) => !c.played && !c.badge) && none.focus !== "route-scribe" && none.focus !== "route-friend" && none.focus !== "route-asher", `nothing played: no stamp, no focus on a card (${none.focus})`);
    const one = await look(["scribe-cut"]);
    check(one.cards.scribe.played === "true" && one.cards.scribe.badge === "✓ 함 · Played" && one.cards.scribe.clear, `scribe played (cut): stamp shown clear of text and figure (${JSON.stringify(one.cards.scribe)})`);
    check(/Played|함/.test(one.cards.scribe.sr || ""), "the played status is also in the card's accessible text");
    check(!one.cards.friend.played && !one.cards.asher.played, "only the played route is stamped");
    check(one.focus === "route-friend", `focus starts on the next unplayed route (${one.focus})`);
    await page.keyboard.press("Enter");
    const st = await state(page);
    check(st.screen === "play" && st.routeId === "friend", `Enter starts the focused next route (${st.screen} ${st.routeId})`);
    const two = await look(["scribe-1", "asher-2"]);
    check(two.focus === "route-friend" && two.cards.asher.played === "true" && two.cards.asher.clear, `scribe + asher played: focus on friend, Asher's stamp clear of his figure (${two.focus})`);
    const three = await look(["scribe-1", "friend-cut", "asher-3"]);
    check(["scribe", "friend", "asher"].every((k) => three.cards[k].played === "true") && !/^route-/.test(three.focus || ""), `all played: every card stamped, no focus change (${three.focus})`);
    check(errors.length === 0, "played routes: console errors " + errors.join(" | "));
    await ctx.close();
  }
  {
    // Without the portrait module the cards stay text-only, silently.
    const init = () => {
      const B = (window.BHS = window.BHS || {});
      Object.defineProperty(B, "portraits", { get: () => undefined, set: () => {}, configurable: false });
    };
    const { ctx, page, errors } = await open(browser, index + "?test=1", { init });
    await toRouteSelect(page);
    const n = await page.locator('[data-testid^="routecard-portrait-"]').count();
    const cards = await page.locator(".routecard").count();
    check(n === 0 && cards === 3, `no portrait module: text-only cards (${n} portraits, ${cards} cards)`);
    check(errors.length === 0, "no portrait module: console errors " + errors.join(" | "));
    await ctx.close();
  }

  // 8d. Verse display rule (SPEC 4.3): an English excerpt that starts with a lowercase letter is shown
  //     with a leading "…" on verse cards, in echo boxes and in {{v:}} tokens inside options. Korean is
  //     unchanged and the stored data stays an exact substring of the verse.
  {
    const { ctx, page, errors } = await open(browser, index + "?test=1");
    await page.click('[data-testid="lang-en"]');
    await page.click('[data-testid="start"]');
    await toStep(page, (s) => s.st.screen === "routeSelect");
    await page.click('[data-testid="route-scribe"]');
    const ps = await page.evaluate(() => window.BHS.scripture.PS_103_3);
    await toStep(page, (x) => x.step && x.step.kind === "verse" && x.step.key === "PS_103_3");
    const card = (await page.textContent('[data-testid="textbox"]')).trim();
    check(/^[a-z]/.test(ps.en) && card === "…" + ps.en, `en verse card: "…" before a lowercase excerpt (${card.slice(0, 32)})`);
    await toStep(page, (x) => x.echo, 200);
    const echo = await page.evaluate(() => {
      const e = document.getElementById("echo");
      const span = e.querySelector('[lang="en"]');
      return { text: span ? span.textContent : "", marks: e.querySelectorAll("mark").length };
    });
    check(echo.text === "…" + ps.en && echo.marks >= 1, `en echo box: "…" kept and the noted word still marked (${echo.text.slice(0, 32)}, ${echo.marks} marks)`);
    await shot(page, "tv-verse-ellipsis-echo");
    check(errors.length === 0, "verse ellipsis (en): console errors " + errors.join(" | "));
    await ctx.close();
  }
  {
    // "Both" mode: the English line gets the "…", the Korean line never does; options with {{v:}} tokens too.
    const { ctx, page, errors } = await open(browser, index + "?test=1#scribe");
    const ps = await page.evaluate(() => window.BHS.scripture.PS_103_3);
    await toStep(page, (x) => x.step && x.step.kind === "verse" && x.step.key === "PS_103_3");
    const both = await page.evaluate(() => {
      const box = document.querySelector('[data-testid="textbox"]');
      const ko = box.querySelector('[lang="ko"]');
      const en = box.querySelector('[lang="en"]');
      return { lang: window.BHS_DEBUG.state().lang, ko: ko ? ko.textContent : null, en: en ? en.textContent : null };
    });
    check(both.lang === "both" && both.ko === ps.ko && both.en === "…" + ps.en, `both: Korean unchanged, English with "…" (${JSON.stringify(both).slice(0, 120)})`);
    await page.goto(index + "?test=1#asher");
    await page.waitForFunction(() => window.BHS_DEBUG && document.body.dataset.screen);
    const s = await toStep(page, (x) => x.step && x.step.kind === "choice" && x.step.id === "c1");
    const opts = await page.evaluate(() => {
      const S = window.BHS.scripture;
      const out = [];
      document.querySelectorAll('[data-testid^="choice-"]').forEach((b) => {
        const ko = b.querySelector('[lang="ko"]');
        const en = b.querySelector('[lang="en"]');
        out.push({ id: b.getAttribute("data-testid"), ko: ko ? ko.textContent : "", en: en ? en.textContent : "" });
      });
      return { out, ps38: S.PS_38_3B, ps103: S.PS_103_3 };
    });
    const optA = opts.out.find((o) => o.id === "choice-a") || {};
    const optD = opts.out.find((o) => o.id === "choice-d") || {};
    check(optA.en === "“…" + opts.ps38.en + "”" && optA.ko === "“" + opts.ps38.ko + "”", `asher c1 a: {{v:PS_38_3B}} shows "…" in English only (${optA.en && optA.en.slice(0, 30)} / ${optA.ko && optA.ko.slice(0, 12)})`);
    check(optD.en === "“…" + opts.ps103.en + "”" && optD.ko === "“" + opts.ps103.ko + "”", `asher c1 d: {{v:PS_103_3}} shows "…" in English only (${optD.en && optD.en.slice(0, 30)})`);
    await shot(page, "tv-verse-ellipsis-options");
    check(errors.length === 0, "verse ellipsis (both): console errors " + errors.join(" | "));
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
