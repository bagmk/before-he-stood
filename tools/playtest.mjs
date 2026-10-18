#!/usr/bin/env node
/*
 * tools/playtest.mjs - end-to-end browser playtest for "Before He Stood".
 * Owner: QA agent. Node 22+, Playwright (npm package installed outside the project) + preinstalled Chromium.
 *
 * Usage:
 *   node tools/playtest.mjs [--route scribe,friend,asher] [--strategies a,d,b,r1,r2,far] [--quick]
 *                           [--root DIR] [--headed] [--no-dist] [--no-teacher] [--no-shots]
 *                           [--step-timeout MS] [--run-timeout S] [--budget-min N]
 *
 * One-time setup (outside the project; version must match the preinstalled chromium-1194 build):
 *   npm i --prefix /tmp/pwqa playwright@1.56.1
 * The module is looked up in $PLAYWRIGHT_MODULE, /tmp/pwqa/node_modules, ./node_modules and the global
 * npm root. PLAYWRIGHT_BROWSERS_PATH defaults to /opt/pw-browsers when that folder exists.
 *
 * What it does: serves the project with tools/serve.mjs, opens index.html?test=1 in a 390x844 touch
 * viewport, and plays every route with several choice strategies from the title screen through the
 * prologue, route select, every beat, the ending card, the final screen and the gallery. On every
 * screen it checks console/page errors, unresolved text, horizontal overflow and 44px tap targets; at
 * the end of each run it compares the ending lens with the SPEC 5.1 reference (tools/validate.mjs).
 * It also loads teacher.html and, when present, plays one route from dist/before-he-stood.html via file://.
 *
 * Output: qa/reports/playtest.txt and screenshots in qa/playtest/.
 * Exit code: 0 = all checks passed, 1 = failures, 2 = skipped (index.html or Playwright missing).
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startServer } from './serve.mjs';
import { loadProject, computeLensFor, Report, mulberry32, CHOICE_IDS, OPTION_IDS, ROUTE_IDS, isObj } from './validate.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(HERE, '..');
const VIEWPORT = { width: 390, height: 844 };
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힣]/;
const T0 = Date.now();

// ---------------------------------------------------------------------------------------------
// Arguments

function parseArgs(argv) {
  const a = {
    root: DEFAULT_ROOT, routes: null, strategies: ['a', 'd', 'b', 'r1', 'r2', 'far'], headed: false,
    dist: true, teacher: true, shots: true, stepTimeout: 5000, runTimeout: 150, budgetMin: 9.5
  };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    const val = () => argv[++i];
    if (x === '--root') a.root = path.resolve(val());
    else if (x === '--route' || x === '--routes') a.routes = val().split(',').map((s) => s.trim()).filter(Boolean);
    else if (x === '--strategies') a.strategies = val().split(',').map((s) => s.trim()).filter(Boolean);
    else if (x === '--quick') a.strategies = ['a'];
    else if (x === '--headed') a.headed = true;
    else if (x === '--no-dist') a.dist = false;
    else if (x === '--no-teacher') a.teacher = false;
    else if (x === '--no-shots') a.shots = false;
    else if (x === '--step-timeout') a.stepTimeout = Number(val());
    else if (x === '--run-timeout') a.runTimeout = Number(val());
    else if (x === '--budget-min') a.budgetMin = Number(val());
    else if (x === '-h' || x === '--help') a.help = true;
    else a.bad = x;
  }
  return a;
}

// ---------------------------------------------------------------------------------------------
// Small helpers

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const snip = (s, n = 60) => {
  s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n) + '…' : s;
};
const elapsedMin = () => (Date.now() - T0) / 60000;
const pad = (s, n) => { s = String(s); return s.length >= n ? s : s + ' '.repeat(n - s.length); };

function withTimeout(promise, ms, onTimeout) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((resolve) => { timer = setTimeout(() => resolve(onTimeout()), ms); })
  ]);
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function makeStrategies(rid, names) {
  const out = [];
  for (const n of names) {
    if (n === 'far' && rid !== 'friend') continue;
    const picks = {};
    if (/^[abcd]$/.test(n)) CHOICE_IDS.forEach((c) => { picks[c] = n; });
    else if (/^r\d+$/.test(n)) {
      const rng = mulberry32(hashStr(rid + ':' + n));
      CHOICE_IDS.forEach((c) => { picks[c] = OPTION_IDS[Math.floor(rng() * 4)]; });
    } else if (n === 'far') {
      CHOICE_IDS.forEach((c) => { picks[c] = 'c'; });
      picks.c6 = 'd';
    } else continue;
    out.push({ name: n, picks, reduced: n === 'b' });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Playwright loading

function loadPlaywright(root) {
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync('/opt/pw-browsers')) process.env.PLAYWRIGHT_BROWSERS_PATH = '/opt/pw-browsers';
  const candidates = [process.env.PLAYWRIGHT_MODULE, '/tmp/pwqa/node_modules/playwright', path.join(root, 'node_modules', 'playwright')];
  try {
    const g = execSync('npm root -g', { encoding: 'utf8', timeout: 8000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (g) candidates.push(path.join(g, 'playwright'));
  } catch (e) { /* npm not available */ }
  const req = createRequire(import.meta.url);
  for (const c of candidates.filter(Boolean)) {
    try {
      if (!fs.existsSync(path.join(c, 'package.json'))) continue;
      const mod = req(c);
      const version = JSON.parse(fs.readFileSync(path.join(c, 'package.json'), 'utf8')).version;
      return { pw: mod, from: c, version };
    } catch (e) { /* try next */ }
  }
  return null;
}

async function launchBrowser(pw, headed) {
  const errors = [];
  try {
    return { browser: await pw.chromium.launch({ headless: !headed }), how: 'default' };
  } catch (e) { errors.push(e.message.split('\n')[0]); }
  for (const exe of ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium']) {
    if (!fs.existsSync(exe)) continue;
    try {
      return { browser: await pw.chromium.launch({ headless: !headed, executablePath: exe }), how: exe };
    } catch (e) { errors.push(e.message.split('\n')[0]); }
  }
  throw new Error('could not launch Chromium: ' + errors.join(' | '));
}

// ---------------------------------------------------------------------------------------------
// In-page helpers (serialized into every page with addInitScript; must be self-contained)

function initQa() {
  const vis = (el) => {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      if (e.hidden) return false;
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    }
    return true;
  };
  const dbg = () => {
    try {
      const B = window.BHS || {};
      let d = null;
      let src = null;
      if (B.ui && typeof B.ui.debugState === 'function') { d = B.ui.debugState(); src = 'BHS.ui.debugState()'; }
      else if (window.BHS_DEBUG && typeof window.BHS_DEBUG.state === 'function') { d = window.BHS_DEBUG.state(); src = 'BHS_DEBUG.state()'; }
      return d ? { d: JSON.parse(JSON.stringify(d)), src } : { d: null, src: null };
    } catch (e) { return { d: null, src: 'error: ' + e.message }; }
  };
  const visibleIds = () => {
    const ids = [];
    document.querySelectorAll('[data-testid]').forEach((el) => { if (vis(el)) ids.push(el.getAttribute('data-testid')); });
    return ids;
  };
  const text = (sel) => {
    const el = document.querySelector(sel);
    return el && vis(el) ? (el.innerText || '').trim() : '';
  };
  const KEY_IDS = /^(choice-[a-d]|press|final-blank|final-next|route-\w+|start|ending-title|verse-card|confirm-yes|gallery-cell-.*)$/;
  const sig = () => {
    const b = dbg().d;
    const ids = visibleIds().filter((x) => KEY_IDS.test(x)).join(',');
    return [document.body.dataset.screen || '', b ? b.beatIndex : '', text('[data-testid="textbox"]'), text('[data-testid="ending-title"]'), ids].join('|');
  };
  const snap = () => {
    const ids = visibleIds();
    const b = dbg();
    const sw = document.documentElement.scrollWidth;
    const iw = window.innerWidth;
    const small = [];
    document.querySelectorAll('button, [role="button"], a[href], input[type="button"], input[type="submit"], summary').forEach((el) => {
      if (!vis(el)) return;
      const r = el.getBoundingClientRect();
      if (r.width < 43.5 || r.height < 43.5) {
        small.push({
          id: el.getAttribute('data-testid') || (el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '')),
          w: Math.round(r.width), h: Math.round(r.height),
          text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 30)
        });
      }
    });
    const bodyText = document.body.innerText || '';
    const leaks = [];
    const re = /\{\{[^}\n]*\}?\}?|\[MT_[A-Za-z0-9_]*\]?|\bundefined\b|\bnull\b|\bNaN\b|\[object Object\]/g;
    let m;
    while ((m = re.exec(bodyText)) && leaks.length < 5) leaks.push(bodyText.slice(Math.max(0, m.index - 24), m.index + m[0].length + 24).replace(/\s+/g, ' '));
    const choiceTexts = {};
    ['a', 'b', 'c', 'd'].forEach((o) => { const t = text('[data-testid="choice-' + o + '"]'); if (t) choiceTexts[o] = t; });
    const litActions = [];
    document.querySelectorAll('[data-testid="press"][data-action]').forEach((el) => { if (vis(el)) litActions.push(el.getAttribute('data-action')); });
    return {
      screen: document.body.dataset.screen || '',
      ids,
      dbg: b.d,
      dbgSource: b.src,
      textbox: text('[data-testid="textbox"]'),
      speaker: text('[data-testid="speaker"]'),
      verse: text('[data-testid="verse-card"]'),
      endingTitle: text('[data-testid="ending-title"]'),
      choiceTexts,
      litActions,
      overflow: sw - iw,
      scrollWidth: sw,
      innerWidth: iw,
      small,
      leaks,
      bodyText: bodyText.slice(0, 4000),
      sig: sig()
    };
  };
  window.__qa = { vis, dbg, sig, snap, visibleIds };
}

// ---------------------------------------------------------------------------------------------
// Results

class Results {
  constructor() {
    this.runs = [];
    this.global = { failures: [], warnings: [], info: [] };
    this.small = new Map();
    this.overflow = new Map();
    this.contract = new Set();
    this.external = new Set();
    this.screensChecked = 0;
  }
  fail(msg) { this.global.failures.push(msg); }
  warn(msg) { if (!this.global.warnings.includes(msg)) this.global.warnings.push(msg); }
  info(msg) { if (!this.global.info.includes(msg)) this.global.info.push(msg); }
}

// ---------------------------------------------------------------------------------------------
// Page plumbing

async function newPage(browser, R, opts = {}) {
  const context = await browser.newContext({
    viewport: opts.viewport || VIEWPORT,
    isMobile: opts.mobile !== false,
    hasTouch: opts.mobile !== false,
    deviceScaleFactor: opts.scale || 2,
    locale: 'ko-KR',
    reducedMotion: opts.reduced ? 'reduce' : 'no-preference'
  });
  // Offline check: only the local server, file:, data: and blob: URLs may load.
  await context.route('**/*', (route) => {
    let u;
    try { u = new URL(route.request().url()); } catch (e) { return route.continue(); }
    if (u.protocol === 'file:' || u.protocol === 'data:' || u.protocol === 'blob:' || u.hostname === '127.0.0.1' || u.hostname === 'localhost') return route.continue();
    R.external.add(u.hostname);
    return route.abort();
  });
  await context.addInitScript(initQa);
  const page = await context.newPage();
  page.setDefaultTimeout(opts.stepTimeout || 5000);
  const log = { console: [], pageErrors: [], requestFailed: [], dialogs: [] };
  const isLocal = (url) => !url || /^(file:|data:|blob:|http:\/\/(127\.0\.0\.1|localhost)[:/])/.test(url);
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const loc = msg.location() || {};
    if (!isLocal(loc.url) || /ERR_FAILED|ERR_BLOCKED|net::/.test(msg.text()) && !isLocal(loc.url)) return;
    log.console.push(`${snip(msg.text(), 200)}${loc.url ? ` (${loc.url.replace(/^.*\//, '')}:${loc.lineNumber})` : ''}`);
  });
  page.on('pageerror', (err) => log.pageErrors.push(snip(err && err.stack ? err.stack.split('\n').slice(0, 2).join(' ') : String(err), 240)));
  page.on('requestfailed', (req) => {
    if (!isLocal(req.url())) return;
    log.requestFailed.push(`${req.url()} (${req.failure() ? req.failure().errorText : 'failed'})`);
  });
  page.on('response', (res) => {
    if (res.status() >= 400 && isLocal(res.url())) log.requestFailed.push(`${res.url()} (HTTP ${res.status()})`);
  });
  page.on('dialog', (d) => { log.dialogs.push(`${d.type()}: ${snip(d.message(), 80)}`); d.dismiss().catch(() => {}); });
  return { context, page, log };
}

const loc = (page, id) => page.locator(`[data-testid="${id}"]:visible`).first();
const snap = (page) => page.evaluate(() => window.__qa.snap());

async function visible(page, id) {
  try { return await loc(page, id).isVisible(); } catch (e) { return false; }
}

// Real click first; if the element cannot be clicked normally (covered, animating) fall back to a DOM click.
async function tap(page, id, run, timeout = 2500) {
  const l = loc(page, id);
  try {
    await l.click({ timeout });
    return 'click';
  } catch (e) {
    try {
      await l.dispatchEvent('click', {}, { timeout: 1000 });
      if (run) run.note(`"${id}" could not be clicked normally (${snip(e.message.split('\n')[0], 80)}); used a DOM click`);
      return 'dispatch';
    } catch (e2) { return null; }
  }
}

async function waitChange(page, prevSig, timeout) {
  try {
    await page.waitForFunction((prev) => window.__qa && window.__qa.sig() !== prev, prevSig, { timeout, polling: 40 });
    return true;
  } catch (e) { return false; }
}

async function waitScreen(page, names, timeout) {
  const list = Array.isArray(names) ? names : [names];
  try {
    await page.waitForFunction((l) => l.includes(document.body.dataset.screen), list, { timeout, polling: 50 });
    return true;
  } catch (e) { return false; }
}

async function shot(page, file, R) {
  try {
    await page.screenshot({ path: file });
    return path.basename(file);
  } catch (e) {
    R.warn(`screenshot failed (${path.basename(file)}): ${snip(e.message, 80)}`);
    return null;
  }
}

// Layout and text checks on one snapshot; records unique problems on the run.
function checkSnapshot(s, run, R, ctx) {
  R.screensChecked++;
  if (s.overflow > 1) {
    const k = `${ctx.where}|${s.screen}`;
    if (!R.overflow.has(k)) R.overflow.set(k, `${ctx.where}: horizontal overflow on screen "${s.screen}" (scrollWidth ${s.scrollWidth} > innerWidth ${s.innerWidth})`);
    run.fail(`horizontal overflow on screen "${s.screen}" (scrollWidth ${s.scrollWidth} > ${s.innerWidth})`, true);
  }
  for (const b of s.small) {
    const k = `${b.id}|${s.screen}`;
    if (!R.small.has(k)) R.small.set(k, `${b.id} on "${s.screen}" is ${b.w}x${b.h} px${b.text ? ` ("${snip(b.text, 24)}")` : ''} (${ctx.where})`);
    run.fail(`tap target smaller than 44x44: ${b.id} ${b.w}x${b.h} on "${s.screen}"`, true);
  }
  if (s.leaks.length && !ctx.allowLeaks) run.fail(`unresolved or broken text on "${s.screen}": "${s.leaks[0]}"`, true);
  if (ctx.lang === 'both' && s.screen === 'play' && s.textbox && s.textbox.length > 6) {
    const hasKo = HANGUL.test(s.textbox);
    const hasEn = /[A-Za-z]{3,}/.test(s.textbox);
    if (!hasKo || !hasEn) run.warn(`"both" language mode shows only ${hasKo ? 'Korean' : 'English'} in the text box: "${snip(s.textbox, 50)}"`, true);
  }
}

// ---------------------------------------------------------------------------------------------
// One playthrough

function newRun(rid, strat, where) {
  const run = {
    rid, strategy: strat.name, where, picks: strat.picks, made: {}, failures: [], warnings: [], notes: [],
    screens: new Set(), steps: 0, shots: [], expected: null, observed: null, title: '', result: 'PASS', ms: 0,
    last: { screen: '', beat: '', text: '' }, seenTexts: [], dbgSource: null
  };
  run.fail = (m, once) => { if (!once || !run.failures.includes(m)) run.failures.push(m); };
  run.warn = (m, once) => { if (!once || !run.warnings.includes(m)) run.warnings.push(m); };
  run.note = (m) => { if (!run.notes.includes(m)) run.notes.push(m); };
  return run;
}

async function playRun(browser, R, cfg) {
  const { url, rid, strat, data, args, shotsPrefix, fileMode } = cfg;
  const run = newRun(rid, strat, cfg.where || `${rid}/${strat.name}`);
  const t0 = Date.now();
  const { context, page, log } = await newPage(browser, R, { reduced: strat.reduced, stepTimeout: args.stepTimeout });
  run.page = page;
  const route = data.routes[rid];
  const meta = data.meta || {};
  const common = data.common || {};
  const lang = 'both';
  const allowExtras = strat.name === 'a' && !fileMode;
  const shotsOn = !!shotsPrefix;
  const shotTaken = new Set();
  const takeShot = async (name) => {
    if (!shotsOn || shotTaken.has(name)) return;
    shotTaken.add(name);
    const f = await shot(page, path.join(args.shotDir, `${shotsPrefix}-${name}.png`), R);
    if (f) run.shots.push(f);
  };
  const actionReplies = new Set();
  if (route && Array.isArray(route.actions)) route.actions.forEach((a) => (a.replies || []).forEach((t) => { if (t) { actionReplies.add(t.ko); actionReplies.add(t.en); } }));
  JSON.stringify(route || {}, (k, v) => { if (isObj(v) && v.fx === 'actionReply' && v.text) { actionReplies.add(v.text.ko); actionReplies.add(v.text.en); } return v; });
  const tapped = new Set();
  let choiceCount = 0;
  let didLang = false;
  let didResume = false;
  let didSettings = false;
  let sawThought = false;
  let sawReceipt = false;
  let done = false;
  try {
    const resp = await page.goto(url, { waitUntil: 'load', timeout: 20000 });
    if (resp && resp.status && resp.status() >= 400) { run.fail(`index page returned HTTP ${resp.status()}`); throw new Error('stop'); }
    if (!(await waitScreen(page, 'title', 10000))) {
      const s0 = await snap(page).catch(() => ({ screen: '?' }));
      run.fail(`title screen never appeared (body data-screen="${s0.screen}")`);
      throw new Error('stop');
    }
    let s = await snap(page);
    run.dbgSource = s.dbgSource;
    checkSnapshot(s, run, R, { where: run.where, lang });
    if (shotsOn && cfg.titleShots) await takeShot('0-title');
    for (const id of ['start', 'lang-ko', 'lang-en', 'lang-both', 'gallery-open', 'teacher-link']) {
      if (!s.ids.includes(id)) run.fail(`title screen: data-testid="${id}" not visible`, true);
    }
    if (s.ids.includes('lang-both')) await tap(page, 'lang-both', run);
    const before = await page.evaluate(() => window.__qa.sig());
    if (!(await tap(page, 'start', run))) { run.fail('could not press "start"'); throw new Error('stop'); }
    await waitChange(page, before, args.stepTimeout);
    let stuck = 0;
    for (let guard = 0; guard < 900 && !done; guard++) {
      s = await snap(page);
      run.steps++;
      run.screens.add(s.screen);
      run.last = { screen: s.screen, beat: s.dbg ? s.dbg.beatIndex : '', text: s.textbox || s.endingTitle };
      if (s.dbgSource && !run.dbgSource) run.dbgSource = s.dbgSource;
      checkSnapshot(s, run, R, { where: run.where, lang });
      if (s.textbox && run.seenTexts[run.seenTexts.length - 1] !== s.textbox) run.seenTexts.push(s.textbox);
      if (s.ids.includes('thought-bubble')) sawThought = true;
      if (s.ids.includes('read-receipt')) sawReceipt = true;
      const prev = s.sig;
      let acted = null;
      switch (s.screen) {
        case 'title':
          acted = s.ids.includes('start') ? await tap(page, 'start', run) : null;
          break;
        case 'prologue':
          acted = await tap(page, 'advance', run);
          break;
        case 'routeSelect':
          if (shotsOn && cfg.titleShots) await takeShot('0-route-select');
          for (const r of ROUTE_IDS) if (!s.ids.includes('route-' + r)) run.fail(`route select: data-testid="route-${r}" not visible`, true);
          acted = await tap(page, 'route-' + rid, run);
          break;
        case 'play': {
          const choiceVisible = s.ids.includes('choice-a');
          if (!shotTaken.has('1-first-scene') && !choiceVisible) await takeShot('1-first-scene');
          if (s.ids.includes('verse-card')) await takeShot('3-verse-card');
          if (choiceVisible) {
            const cid = CHOICE_IDS[choiceCount] || 'c?';
            await takeShot('2-first-choice');
            if (allowExtras && !didLang) { didLang = true; await langSwitchCheck(page, run, s, args); }
            if (allowExtras && !didSettings && cfg.settingsCheck) { didSettings = true; await settingsCheck(page, run, args); }
            const pick = strat.picks[cid] || 'a';
            if (!s.ids.includes('choice-' + pick)) { run.fail(`${cid}: option "${pick}" not visible (visible: ${s.ids.filter((x) => /^choice-/.test(x)).join(', ')})`); throw new Error('stop'); }
            acted = await tap(page, 'choice-' + pick, run);
            if (acted) {
              run.made[cid] = pick;
              choiceCount++;
              const ok = await waitChange(page, prev, args.stepTimeout);
              if (ok) {
                const s2 = await snap(page);
                if (s2.dbg && s2.dbg.choices && s2.dbg.choices[cid] !== pick) run.fail(`${cid}: debugState().choices.${cid} is ${JSON.stringify(s2.dbg.choices[cid])}, expected "${pick}"`, true);
                stuck = 0;
                continue;
              }
            }
          } else if (s.ids.includes('press')) {
            acted = await tap(page, 'press', run);
          } else {
            if (rid === 'asher' && route && Array.isArray(route.actions)) {
              await grayActionCheck(page, run, s, choiceCount, tapped, actionReplies, args);
            }
            if (allowExtras && !didResume && choiceCount >= 2 && s.textbox) {
              didResume = true;
              const okResume = await resumeCheck(page, run, s, args);
              if (!okResume) throw new Error('stop');
              continue;
            }
            acted = await tap(page, 'advance', run);
          }
          break;
        }
        case 'endingCard': {
          await takeShot('4-ending-card');
          const exp = computeLensFor(route, run.made);
          run.expected = exp;
          run.observed = s.dbg ? s.dbg.lens : null;
          run.title = s.endingTitle;
          if (s.dbg && s.dbg.lens != null && Number(s.dbg.lens) !== exp.lens) run.fail(`ending lens from debugState is ${s.dbg.lens}, SPEC 5.1 expects ${exp.lens} (scores ${JSON.stringify(exp.scores)}, c10 lens ${exp.c10Lens})`, true);
          if (!s.dbg) run.fail('debugState() not available (expected BHS.ui.debugState() or BHS_DEBUG.state())', true);
          const want = meta.endings && meta.endings[rid] && meta.endings[rid][exp.lens];
          if (want && (!s.endingTitle.includes(want.ko) || !s.endingTitle.includes(want.en))) run.fail(`ending card shows "${snip(s.endingTitle, 60)}", expected the title "${want.ko}" / "${want.en}" (lens ${exp.lens})`, true);
          const mm = common.mismatchLine;
          if (mm) {
            const saw = run.seenTexts.some((t) => t.includes(mm.ko));
            if (exp.mismatch && !saw) run.fail('the mismatch line was not shown although the ending lens differs from the c10 lens', true);
            if (!exp.mismatch && saw) run.fail('the mismatch line was shown although the ending lens equals the c10 lens', true);
          }
          const madeStr = CHOICE_IDS.map((c) => run.made[c] || '-').join('');
          const wantStr = CHOICE_IDS.map((c) => strat.picks[c]).join('');
          if (madeStr !== wantStr) run.fail(`picked ${madeStr} but the strategy asked for ${wantStr} (some choices were never shown?)`, true);
          if (s.dbg && s.dbg.choices) {
            const dbgStr = CHOICE_IDS.map((c) => s.dbg.choices[c] || '-').join('');
            if (dbgStr !== madeStr) run.fail(`debugState().choices is ${dbgStr}, picked ${madeStr}`, true);
          }
          acted = await tap(page, 'advance', run);
          break;
        }
        case 'ending':
          acted = await tap(page, 'advance', run);
          break;
        case 'final': {
          if (!s.ids.includes('final-blank')) run.fail('final screen: data-testid="final-blank" not visible', true);
          else {
            const answer = '테스트 answer';
            await loc(page, 'final-blank').fill(answer).catch((e) => run.fail(`could not type into final-blank: ${snip(e.message, 80)}`));
            const stored = await page.evaluate(() => { try { return localStorage.getItem('bhs.v1.blanks') || ''; } catch (e) { return 'ERR'; } });
            if (!stored.includes('answer')) run.warn('final-blank text was not saved to localStorage bhs.v1.blanks (SPEC 5.3)', true);
          }
          await takeShot('5-final');
          if (!s.ids.includes('final-next')) { run.fail('final screen: data-testid="final-next" not visible'); throw new Error('stop'); }
          acted = await tap(page, 'final-next', run);
          break;
        }
        case 'gallery': {
          const lens = run.expected ? run.expected.lens : null;
          const cells = await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid^="gallery-cell-"]')).map((el) => [el.getAttribute('data-testid'), el.getAttribute('data-seen')]));
          const map = new Map(cells);
          for (const r of ROUTE_IDS) for (const l of [1, 2, 3]) if (!map.has(`gallery-cell-${r}-${l}`)) run.fail(`gallery: data-testid="gallery-cell-${r}-${l}" missing`, true);
          if (lens != null) {
            const v = map.get(`gallery-cell-${rid}-${lens}`);
            if (v !== 'true') run.fail(`gallery: gallery-cell-${rid}-${lens} has data-seen="${v}", expected "true"`, true);
          } else run.fail('gallery reached without an ending card', true);
          const seen = cells.filter((c) => c[1] === 'true').length;
          if (seen !== 1) run.note(`gallery shows ${seen} seen cells in a fresh browser profile`);
          if (shotsOn && cfg.titleShots) await takeShot('6-gallery');
          done = true;
          acted = 'done';
          break;
        }
        default:
          run.fail(`unexpected body data-screen="${s.screen}"`, true);
          acted = await tap(page, 'advance', run);
      }
      if (done) break;
      if (!acted) {
        run.fail(`no actionable control on screen "${s.screen}" (visible testids: ${s.ids.join(', ') || 'none'})`);
        break;
      }
      let changed = await waitChange(page, prev, args.stepTimeout);
      if (!changed) {
        // Fallbacks: keyboard advance (SPEC 5.4: Enter/Space), then a DOM click on advance.
        for (const fb of ['Enter', 'Space', 'dom-advance']) {
          if (fb === 'dom-advance') await loc(page, 'advance').dispatchEvent('click').catch(() => {});
          else await page.keyboard.press(fb).catch(() => {});
          changed = await waitChange(page, prev, 1500);
          if (changed) { run.note(`progress needed a fallback (${fb}) on screen "${s.screen}"`); break; }
        }
      }
      if (!changed) {
        stuck++;
        if (stuck >= 2) {
          run.fail(`stuck on screen "${s.screen}" beat ${s.dbg ? s.dbg.beatIndex : '?'} after ${choiceCount} choices; text "${snip(s.textbox || s.endingTitle, 50)}"; visible: ${s.ids.join(', ')}`);
          break;
        }
      } else stuck = 0;
    }
    if (!done && !run.failures.length) run.fail('did not reach the gallery within the step limit');
    if (route && JSON.stringify(route).includes('"pinThought"') && !sawThought) run.warn('the route pins a thought (fx pinThought) but data-testid="thought-bubble" never became visible', true);
    if (route && JSON.stringify(route).includes('"readReceipt"') && !sawReceipt) run.warn('the route uses fx readReceipt but data-testid="read-receipt" never became visible', true);
  } catch (e) {
    if (e && e.message !== 'stop') run.fail(`exception: ${snip(e.message, 200)}`);
  }
  for (const c of log.console) run.fail(`console error: ${c}`, true);
  for (const p of log.pageErrors) run.fail(`page error: ${p}`, true);
  for (const r of log.requestFailed) run.fail(`failed request: ${r}`, true);
  for (const d of log.dialogs) run.warn(`native dialog opened (${d}); SPEC 5.4 expects in-page UI`, true);
  if (run.failures.length) {
    run.result = 'FAIL';
    if (args.shots) {
      const f = await shot(page, path.join(args.shotDir, `FAIL-${run.where.replace(/[^\w-]+/g, '_')}.png`), R);
      if (f) run.shots.push(f);
    }
  }
  run.ms = Date.now() - t0;
  await context.close().catch(() => {});
  delete run.page;
  return run;
}

// Header language buttons: the contract names lang-ko/en/both; the header may use hdr-lang-*.
async function langButton(page, mode, R) {
  for (const id of [`lang-${mode}`, `hdr-lang-${mode}`]) if (await visible(page, id)) return id;
  return null;
}

async function langSwitchCheck(page, run, s, args) {
  const idEn = await langButton(page, 'en');
  const idKo = await langButton(page, 'ko');
  const idBoth = await langButton(page, 'both');
  if (!idEn || !idKo || !idBoth) { run.fail('language cannot be switched during play: no visible lang-ko/en/both (or hdr-lang-*) buttons (SPEC 5.2)', true); return; }
  if (idEn.startsWith('hdr-')) run.note(`header language buttons use data-testid "${idEn.replace('-en', '-*')}" instead of "lang-*"`);
  const texts = async () => (await snap(page)).choiceTexts;
  await tap(page, idEn, run);
  await sleep(120);
  const en = await texts();
  if (Object.values(en).some((t) => HANGUL.test(t))) run.warn(`English mode still shows Hangul in options: "${snip(Object.values(en).find((t) => HANGUL.test(t)), 50)}"`, true);
  await tap(page, idKo, run);
  await sleep(120);
  const ko = await texts();
  if (Object.values(ko).some((t) => !HANGUL.test(t))) run.warn('Korean mode shows an option without Hangul', true);
  if (Object.values(ko).some((t) => /[A-Za-z]{4,}\s+[A-Za-z]{4,}/.test(t))) run.warn('Korean mode still shows English text in options', true);
  await tap(page, idBoth, run);
  await sleep(120);
  const both = await texts();
  if (Object.values(both).some((t) => !HANGUL.test(t) || !/[A-Za-z]{3,}/.test(t))) run.warn('"both" mode options do not show both languages', true);
  const after = await snap(page);
  if (after.screen !== s.screen || !after.ids.includes('choice-a')) run.fail('switching language left the choice screen', true);
}

async function settingsCheck(page, run, args) {
  if (!(await visible(page, 'settings-open'))) { run.fail('settings-open not visible during play', true); return; }
  await tap(page, 'settings-open', run);
  try { await loc(page, 'speed-instant').waitFor({ state: 'visible', timeout: 2000 }); } catch (e) { run.fail('settings panel did not show speed-instant', true); return; }
  await tap(page, 'speed-instant', run);
  const stored = await page.evaluate(() => { try { return localStorage.getItem('bhs.v1.settings') || ''; } catch (e) { return 'ERR'; } });
  if (!/instant/.test(stored)) run.warn('text speed "instant" was not saved to localStorage bhs.v1.settings (SPEC 5.3)', true);
  if (await visible(page, 'settings-close')) await tap(page, 'settings-close', run);
  else await page.keyboard.press('Escape').catch(() => {});
  await sleep(150);
  if (await visible(page, 'speed-instant')) {
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(150);
    if (await visible(page, 'speed-instant')) run.fail('settings panel could not be closed (settings-close / Escape)', true);
  }
}

async function grayActionCheck(page, run, s, choiceCount, tapped, replies, args) {
  // Tap Asher's gray actions at a few moments before c9; they must not advance the story.
  const plan = [[0, 'getup'], [3, 'getup'], [3, 'goout'], [6, 'getup']];
  for (const [at, id] of plan) {
    const key = at + ':' + id;
    if (choiceCount !== at || tapped.has(key)) continue;
    tapped.add(key);
    if (!s.ids.includes('action-' + id)) { run.fail(`gray action "${id}" not visible before c${at + 1} (SPEC 4.5: visible from the first beat)`, true); continue; }
    const b = await snap(page);
    const before = b.dbg && b.dbg.vars ? Number(b.dbg.vars[id === 'getup' ? 'getup_count' : 'goout_count'] || 0) : null;
    await tap(page, 'action-' + id, run);
    await sleep(150);
    const a = await snap(page);
    if (a.screen !== 'play' || (b.dbg && a.dbg && a.dbg.beatIndex !== b.dbg.beatIndex) || a.textbox !== b.textbox) {
      run.fail(`tapping gray action "${id}" changed the story position (beat ${b.dbg ? b.dbg.beatIndex : '?'} -> ${a.dbg ? a.dbg.beatIndex : '?'})`, true);
    }
    if (before !== null && a.dbg && a.dbg.vars) {
      const after = Number(a.dbg.vars[id === 'getup' ? 'getup_count' : 'goout_count'] || 0);
      if (after !== before + 1) run.fail(`gray action "${id}": counter went ${before} -> ${after}, expected +1`, true);
    }
    if (![...replies].some((t) => t && a.bodyText.includes(t))) run.warn(`gray action "${id}": no reply text visible after the tap`, true);
  }
  if (choiceCount >= 9 && s.ids.includes('action-getup') && !s.litActions.includes('getup')) {
    run.warn('gray action "getup" is still visible after the getup press (SPEC 4.5: hidden after the press on getup)', true);
  }
}

async function resumeCheck(page, run, s, args) {
  // Home -> confirm-no keeps the place; home -> confirm-yes -> continue resumes at the same place.
  const where = { text: s.textbox, beat: s.dbg ? s.dbg.beatIndex : null, choices: s.dbg ? JSON.stringify(s.dbg.choices || {}) : null };
  if (!(await visible(page, 'home'))) { run.fail('home button not visible during play', true); return true; }
  await tap(page, 'home', run);
  try { await loc(page, 'confirm-no').waitFor({ state: 'visible', timeout: 2000 }); } catch (e) { run.fail('home did not open a confirm dialog with confirm-no', true); return true; }
  await tap(page, 'confirm-no', run);
  await sleep(150);
  let a = await snap(page);
  if (a.screen !== 'play' || a.textbox !== where.text) run.fail(`confirm-no did not return to the same place (screen ${a.screen}, text "${snip(a.textbox, 40)}")`, true);
  await tap(page, 'home', run);
  try { await loc(page, 'confirm-yes').waitFor({ state: 'visible', timeout: 2000 }); } catch (e) { run.fail('second home press did not open the confirm dialog', true); return false; }
  await tap(page, 'confirm-yes', run);
  if (!(await waitScreen(page, 'title', 3000))) { run.fail('confirm-yes did not go to the title screen', true); return false; }
  if (!(await visible(page, 'continue'))) { run.fail('title screen has no "continue" button after leaving mid-route (SPEC 5.3 resume)', true); return false; }
  await tap(page, 'continue', run);
  if (!(await waitScreen(page, 'play', 3000))) { run.fail('"continue" did not return to the play screen', true); return false; }
  await sleep(100);
  a = await snap(page);
  if (where.beat != null && a.dbg && a.dbg.beatIndex !== where.beat) run.fail(`resume: beatIndex ${a.dbg.beatIndex}, expected ${where.beat}`, true);
  if (a.textbox !== where.text) run.warn(`resume: text after "continue" differs ("${snip(a.textbox, 40)}" vs "${snip(where.text, 40)}")`, true);
  if (where.choices && a.dbg && JSON.stringify(a.dbg.choices || {}) !== where.choices) run.fail('resume: choices differ after "continue"', true);
  return true;
}

// ---------------------------------------------------------------------------------------------
// Extra page checks

async function titleSmoke(browser, R, base, args, data) {
  const out = [];
  const { context, page, log } = await newPage(browser, R, { stepTimeout: args.stepTimeout });
  try {
    await page.goto(base + 'index.html?test=1', { waitUntil: 'load', timeout: 20000 });
    if (!(await waitScreen(page, 'title', 8000))) { out.push('FAIL title screen did not appear'); return out; }
    const href = await page.locator('[data-testid="teacher-link"]').first().getAttribute('href').catch(() => null);
    if (!href || !/teacher\.html/.test(href)) out.push(`FAIL teacher-link href is ${JSON.stringify(href)}`);
    else {
      const r = await page.request.get(new URL(href, page.url()).href).catch(() => null);
      if (!r || r.status() !== 200) out.push(`FAIL teacher-link target ${href} is not reachable`);
      else out.push('ok   teacher-link points to teacher.html');
    }
    await tap(page, 'gallery-open', null);
    if (await waitScreen(page, 'gallery', 3000)) {
      const n = await page.locator('[data-testid^="gallery-cell-"]').count();
      out.push(n === 9 ? 'ok   gallery opens from the title with 9 cells' : `FAIL gallery from title shows ${n} cells (expected 9)`);
      const back = (await visible(page, 'gallery-home')) ? 'gallery-home' : (await visible(page, 'home')) ? 'home' : null;
      if (back) {
        await tap(page, back, null);
        out.push((await waitScreen(page, 'title', 3000)) ? `ok   "${back}" returns from the gallery to the title` : `FAIL "${back}" did not return to the title`);
      } else out.push('FAIL no home/gallery-home button on the gallery');
    } else out.push('FAIL gallery-open did not open the gallery screen');
    // Deep links (SPEC 5.5) and the debug panel.
    for (const rid of ROUTE_IDS.filter((r) => data.routes[r])) {
      await page.goto(base + `index.html?test=1#${rid}`, { waitUntil: 'load', timeout: 20000 });
      const ok = await waitScreen(page, ['play'], 4000);
      const s = ok ? await snap(page) : null;
      if (!ok) out.push(`FAIL #${rid} deep link did not open the play screen`);
      else if (s.dbg && s.dbg.routeId && s.dbg.routeId !== rid) out.push(`FAIL #${rid} deep link opened route ${s.dbg.routeId}`);
      else out.push(`ok   #${rid} deep link opens the route`);
      await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
    }
    await page.goto(base + 'index.html?test=1&debug=1#' + (ROUTE_IDS.find((r) => data.routes[r]) || 'scribe'), { waitUntil: 'load', timeout: 20000 });
    await sleep(400);
    const dbgVisible = await page.evaluate(() => { const d = document.getElementById('debug'); return !!(d && window.__qa.vis(d)); });
    out.push(dbgVisible ? 'ok   ?debug=1 shows the debug panel' : 'WARN ?debug=1 did not show a visible #debug panel');
  } catch (e) {
    out.push(`FAIL title smoke test threw: ${snip(e.message, 160)}`);
  } finally {
    for (const c of log.console) out.push(`FAIL console error (title/deep-link/debug checks): ${c}`);
    for (const p of log.pageErrors) out.push(`FAIL page error (title/deep-link/debug checks): ${p}`);
    for (const r of log.requestFailed) out.push(`FAIL failed request: ${r}`);
    await context.close().catch(() => {});
  }
  return out;
}

async function teacherCheck(browser, R, base, args) {
  const out = [];
  for (const mode of [{ name: 'mobile 390x844', viewport: VIEWPORT, mobile: true }, { name: 'desktop 1280x800', viewport: { width: 1280, height: 800 }, mobile: false, scale: 1 }]) {
    const { context, page, log } = await newPage(browser, R, { viewport: mode.viewport, mobile: mode.mobile, scale: mode.scale || 2, stepTimeout: args.stepTimeout });
    try {
      const resp = await page.goto(base + 'teacher.html', { waitUntil: 'load', timeout: 20000 });
      if (!resp || resp.status() !== 200) { out.push(`FAIL teacher.html (${mode.name}) returned ${resp ? resp.status() : 'no response'}`); continue; }
      await sleep(600);
      const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, title: document.title, text: (document.body.innerText || '').length }));
      if (m.sw > m.iw + 1) out.push(`WARN teacher.html (${mode.name}) overflows horizontally (scrollWidth ${m.sw} > ${m.iw})`);
      if (m.text < 200) out.push(`WARN teacher.html (${mode.name}) shows very little text (${m.text} chars)`);
      if (mode.mobile && args.shots) await shot(page, path.join(args.shotDir, 'teacher-mobile.png'), R);
      const errs = log.console.length + log.pageErrors.length + log.requestFailed.length;
      for (const c of log.console) out.push(`FAIL teacher.html (${mode.name}) console error: ${c}`);
      for (const p of log.pageErrors) out.push(`FAIL teacher.html (${mode.name}) page error: ${p}`);
      for (const r of log.requestFailed) out.push(`FAIL teacher.html (${mode.name}) failed request: ${r}`);
      if (!errs) out.push(`ok   teacher.html (${mode.name}) loads without console errors ("${snip(m.title, 50)}")`);
    } catch (e) {
      out.push(`FAIL teacher.html (${mode.name}) threw: ${snip(e.message, 160)}`);
    } finally {
      await context.close().catch(() => {});
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Report

function formatReport(R, ctx) {
  const L = [];
  const failedRuns = R.runs.filter((r) => r.result === 'FAIL');
  const globalFails = R.global.failures.length;
  const pass = !failedRuns.length && !globalFails && R.runs.length > 0;
  L.push('Before He Stood - browser playtest (tools/playtest.mjs)');
  L.push(`Date: ${new Date().toISOString().replace('T', ' ').slice(0, 19)}Z   Node ${process.version}   Playwright ${ctx.pwVersion || '?'} (${ctx.pwFrom || '?'})`);
  L.push(`Browser: Chromium ${ctx.browserVersion || '?'} (${ctx.launchHow || '?'}), viewport ${VIEWPORT.width}x${VIEWPORT.height}, isMobile, hasTouch; external requests blocked (offline check)`);
  L.push(`Server: ${ctx.base || '-'} (tools/serve.mjs)   Root: ${ctx.root}`);
  L.push(`Duration: ${elapsedMin().toFixed(1)} min`);
  L.push('');
  L.push(`Summary: ${R.runs.length} runs, ${R.runs.length - failedRuns.length} passed, ${failedRuns.length} failed; ${globalFails} other failure(s); ${R.screensChecked} screen snapshots checked  ->  ${pass ? 'PASS' : 'FAIL'}`);
  if (ctx.skipped.length) L.push(`Skipped: ${ctx.skipped.join('; ')}`);
  L.push('');
  L.push('Runs');
  L.push('  ' + [pad('route/strategy', 18), pad('picks', 11), pad('expected', 14), pad('observed', 9), pad('ending title (card)', 34), pad('steps', 6), pad('time', 7), 'result'].join(' '));
  for (const r of R.runs) {
    const picks = CHOICE_IDS.map((c) => r.made[c] || '-').join('');
    const exp = r.expected ? `${r.expected.lens}${r.expected.mismatch ? ' (mismatch)' : ''}` : '-';
    L.push('  ' + [pad(r.where, 18), pad(picks, 11), pad(exp, 14), pad(r.observed == null ? '-' : r.observed, 9), pad(snip(r.title, 32), 34), pad(r.steps, 6), pad((r.ms / 1000).toFixed(1) + 's', 7), r.result].join(' '));
  }
  for (const r of R.runs) {
    if (!r.failures.length && !r.warnings.length && !r.notes.length) continue;
    L.push('');
    L.push(`${r.where}  (${r.result}; last screen "${r.last.screen}", beat ${r.last.beat === '' ? '?' : r.last.beat}, text "${snip(r.last.text, 50)}")`);
    r.failures.forEach((m) => L.push(`  FAIL ${m}`));
    r.warnings.forEach((m) => L.push(`  WARN ${m}`));
    r.notes.forEach((m) => L.push(`  note ${m}`));
  }
  L.push('');
  L.push('Layout (all runs)');
  L.push(`  horizontal overflow: ${R.overflow.size ? R.overflow.size + ' problem(s)' : 'none'}`);
  for (const v of R.overflow.values()) L.push(`    ${v}`);
  L.push(`  tap targets under 44x44 px: ${R.small.size ? R.small.size + ' distinct' : 'none'}`);
  for (const v of R.small.values()) L.push(`    ${v}`);
  if (ctx.titleSmoke && ctx.titleSmoke.length) {
    L.push('');
    L.push('Title, gallery, deep links, debug panel');
    ctx.titleSmoke.forEach((m) => L.push('  ' + m));
  }
  if (ctx.teacher && ctx.teacher.length) {
    L.push('');
    L.push('Teacher page');
    ctx.teacher.forEach((m) => L.push('  ' + m));
  }
  L.push('');
  L.push('Single-file build (dist/before-he-stood.html via file://)');
  L.push('  ' + (ctx.distLine || 'not run'));
  if (R.global.failures.length || R.global.warnings.length || R.global.info.length) {
    L.push('');
    L.push('Other');
    R.global.failures.forEach((m) => L.push(`  FAIL ${m}`));
    R.global.warnings.forEach((m) => L.push(`  WARN ${m}`));
    R.global.info.forEach((m) => L.push(`  info ${m}`));
  }
  if (R.external.size) {
    L.push('');
    L.push(`External hosts requested and blocked: ${[...R.external].join(', ')} (the game must work without them)`);
  }
  const shots = R.runs.flatMap((r) => r.shots);
  if (shots.length) {
    L.push('');
    L.push(`Screenshots (qa/playtest/): ${shots.join(', ')}`);
  }
  return { text: L.join('\n') + '\n', pass };
}

function writeReport(root, text) {
  try {
    fs.mkdirSync(path.join(root, 'qa', 'reports'), { recursive: true });
    fs.writeFileSync(path.join(root, 'qa', 'reports', 'playtest.txt'), text);
  } catch (e) { console.error('could not write qa/reports/playtest.txt: ' + e.message); }
}

// ---------------------------------------------------------------------------------------------
// Main

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.bad) {
    if (args.bad) console.error(`Unknown argument: ${args.bad}`);
    console.log('Usage: node tools/playtest.mjs [--route scribe,friend,asher] [--strategies a,d,b,r1,r2,far] [--quick] [--root DIR] [--headed] [--no-dist] [--no-teacher] [--no-shots] [--step-timeout MS] [--run-timeout S] [--budget-min N]');
    process.exit(args.bad ? 2 : 0);
  }
  const root = args.root;
  args.shotDir = path.join(root, 'qa', 'playtest');
  const ctx = { root, skipped: [], base: null };
  const R = new Results();
  const finish = (code, extra) => {
    const { text, pass } = formatReport(R, ctx);
    const out = extra ? extra + '\n' + text : text;
    writeReport(root, out);
    process.stdout.write(out);
    process.exit(code == null ? (pass ? 0 : 1) : code);
  };
  if (!fs.existsSync(path.join(root, 'index.html'))) {
    ctx.skipped.push('index.html not found (engine/UI agent still working?)');
    finish(2, 'SKIPPED: index.html does not exist yet; nothing to play.');
    return;
  }
  const missingUi = ['js/ui.js', 'js/main.js', 'css/style.css'].filter((f) => !fs.existsSync(path.join(root, f)));
  if (missingUi.length) R.warn(`UI files missing: ${missingUi.join(', ')} (the game may not start)`);
  const loadRep = new Report();
  const loaded = loadProject(root, loadRep, { partial: true });
  const data = loaded.data;
  for (const f of loadRep.findings.filter((x) => x.level === 'ERROR')) R.warn(`data load: ${f.where}: ${f.msg}`);
  const wanted = (args.routes || ROUTE_IDS).filter((r) => ROUTE_IDS.includes(r));
  const routes = wanted.filter((r) => isObj(data.routes[r]));
  for (const r of wanted.filter((x) => !routes.includes(x))) ctx.skipped.push(`route ${r} (data/routes/${r}.js missing or broken)`);
  const pwInfo = loadPlaywright(root);
  if (!pwInfo) {
    ctx.skipped.push('Playwright npm package not found');
    finish(2, 'SKIPPED: Playwright not found. Install it outside the project:\n  npm i --prefix /tmp/pwqa playwright@1.56.1\nor set PLAYWRIGHT_MODULE=/path/to/node_modules/playwright');
    return;
  }
  ctx.pwVersion = pwInfo.version;
  ctx.pwFrom = pwInfo.from;
  fs.mkdirSync(args.shotDir, { recursive: true });
  let srv;
  let browser;
  try {
    srv = await startServer({ root, port: 0 });
    ctx.base = srv.url;
    const launched = await launchBrowser(pwInfo.pw, args.headed);
    browser = launched.browser;
    ctx.launchHow = launched.how;
    ctx.browserVersion = browser.version();
    console.log(`playtest: serving ${root} at ${srv.url}; Chromium ${ctx.browserVersion}; routes ${routes.join(', ') || 'none'}`);
    ctx.titleSmoke = await withTimeout(titleSmoke(browser, R, srv.url, args, data), 90000, () => ['FAIL title smoke test timed out after 90 s']);
    let firstRun = true;
    for (const rid of routes) {
      const strategies = makeStrategies(rid, args.strategies);
      strategies.forEach((st, i) => {
        st.shots = args.shots && i === 0;
      });
      for (const st of strategies) {
        if (elapsedMin() > args.budgetMin) { ctx.skipped.push(`${rid}/${st.name} (time budget of ${args.budgetMin} min used up)`); continue; }
        const label = `${rid}/${st.name}`;
        process.stdout.write(`  ${pad(label, 14)} ... `);
        const cfg = {
          url: srv.url + 'index.html?test=1', rid, strat: st, data, args, where: label,
          shotsPrefix: st.shots ? rid : null, titleShots: st.shots && firstRun, settingsCheck: firstRun
        };
        let runRef = null;
        const run = await withTimeout(playRun(browser, R, cfg).then((r) => { runRef = r; return r; }), args.runTimeout * 1000, () => {
          const r = newRun(rid, st, label);
          r.result = 'FAIL';
          r.fail(`run timed out after ${args.runTimeout} s`);
          r.ms = args.runTimeout * 1000;
          return r;
        });
        firstRun = false;
        R.runs.push(run);
        console.log(`${run.result} (${(run.ms / 1000).toFixed(1)}s, ${run.steps} steps${run.failures.length ? ', ' + run.failures.length + ' failure(s): ' + snip(run.failures[0], 90) : ''})`);
        void runRef;
      }
    }
    if (args.teacher && fs.existsSync(path.join(root, 'teacher.html'))) {
      ctx.teacher = await withTimeout(teacherCheck(browser, R, srv.url, args), 60000, () => ['FAIL teacher.html check timed out']);
    } else ctx.teacher = [args.teacher ? 'teacher.html not found; skipped' : 'skipped (--no-teacher)'];
    const distFile = path.join(root, 'dist', 'before-he-stood.html');
    if (!args.dist) ctx.distLine = 'skipped (--no-dist)';
    else if (!fs.existsSync(distFile)) ctx.distLine = 'dist/before-he-stood.html not found; skipped (run node tools/build-single.mjs)';
    else if (!routes.length) ctx.distLine = 'no route available; skipped';
    else if (elapsedMin() > args.budgetMin) ctx.distLine = 'skipped (time budget used up)';
    else {
      const rid = routes.includes('scribe') ? 'scribe' : routes[0];
      const st = makeStrategies(rid, ['a'])[0];
      const cfg = { url: pathToFileURL(distFile).href + '?test=1', rid, strat: st, data, args, where: `dist:${rid}/a`, shotsPrefix: null, fileMode: true };
      process.stdout.write(`  ${pad('dist:' + rid, 14)} ... `);
      const run = await withTimeout(playRun(browser, R, cfg), args.runTimeout * 1000, () => {
        const r = newRun(rid, st, `dist:${rid}/a`);
        r.result = 'FAIL';
        r.fail(`run timed out after ${args.runTimeout} s`);
        return r;
      });
      R.runs.push(run);
      console.log(`${run.result} (${(run.ms / 1000).toFixed(1)}s)`);
      ctx.distLine = `${run.result}: played ${rid} with strategy "a" from file:// (${run.steps} steps)`;
    }
    for (const t of [...(ctx.titleSmoke || []), ...(ctx.teacher || [])]) if (/^FAIL/.test(t)) R.fail(t.replace(/^FAIL\s*/, ''));
    const dbgSources = [...new Set(R.runs.map((r) => r.dbgSource).filter(Boolean))];
    if (dbgSources.length) R.info(`debug state read via ${dbgSources.join(', ')}`);
  } catch (e) {
    R.fail(`playtest aborted: ${snip(e.stack || e.message, 300)}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (srv) await srv.close().catch(() => {});
  }
  finish();
}

main().catch((e) => {
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
