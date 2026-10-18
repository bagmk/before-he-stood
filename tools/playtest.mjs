#!/usr/bin/env node
/*
 * tools/playtest.mjs - end-to-end browser playtest for "Before He Stood".
 * Owner: QA agent. Node 22+, Playwright (npm package installed outside the project) + preinstalled Chromium.
 *
 * Usage:
 *   node tools/playtest.mjs [--route scribe,friend,asher] [--strategies a,d,b,r1,r2,far]
 *                           [--profiles phone,tv1080,tv720] [--no-keyboard] [--quick]
 *                           [--root DIR] [--headed] [--no-dist] [--no-teacher] [--no-shots]
 *                           [--step-timeout MS] [--run-timeout S] [--budget-min N]
 *
 * One-time setup (outside the project; the version must match the preinstalled chromium-1194 build):
 *   npm i --prefix /tmp/pwqa playwright@1.56.1
 * The module is looked up in $PLAYWRIGHT_MODULE, /tmp/pwqa/node_modules, ./node_modules and the global
 * npm root. PLAYWRIGHT_BROWSERS_PATH defaults to /opt/pw-browsers when that folder exists.
 *
 * Run matrix (per route):
 *   phone  390x844, isMobile, touch, DPR 2: strategies a, d, b (reduced motion), r1, r2 (+ far on friend)
 *   tv1080 1920x1080, DPR 1, mouse: strategy a (TV screenshots qa/playtest/tv-*.png)
 *   tv1080 keyboard only (Space/Enter/ArrowRight/PageDown/ArrowDown advance, 1-4 pick, Tab+Enter for
 *          page buttons, no mouse): strategy r3
 *   tv720  1280x720, DPR 1, mouse: strategy c, language ko (scribe) / en (friend) / both (asher)
 * Every run starts at the title, goes through the prologue, route select, every beat, the ending card,
 * the final screen (types an answer) and the gallery. Checks on every screen: console/page errors,
 * failed local requests, unresolved text, horizontal overflow, tap targets >= 44 px. The shown text
 * screens must match the SPEC reference sequence (tools/validate.mjs simulate) one by one, and the ending
 * lens must match SPEC 5.1. TV runs also check SPEC 5.6: story text >= 36 px and options >= 30 px at
 * 1080p (>= 24 / 20 px at 720p), nothing outside the viewport, and the text panel below the top 60%.
 * Also loads teacher.html and plays one route from dist/before-he-stood.html via file:// when present.
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
import {
  loadProject, computeLensFor, simulate, renderText, Report, mulberry32, CHOICE_IDS, OPTION_IDS, ROUTE_IDS, isObj
} from './validate.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(HERE, '..');
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힣]/;
const T0 = Date.now();

const PROFILES = {
  phone: { id: 'phone', viewport: { width: 390, height: 844 }, mobile: true, scale: 2, tv: null },
  tv1080: { id: 'tv1080', viewport: { width: 1920, height: 1080 }, mobile: false, scale: 1, tv: { story: 36, option: 30 } },
  tv720: { id: 'tv720', viewport: { width: 1280, height: 720 }, mobile: false, scale: 1, tv: { story: 24, option: 20 } }
};
const ADVANCE_KEYS = ['Space', 'Enter', 'ArrowRight', 'PageDown', 'ArrowDown'];
const REQUIRED_KEYS = ['Space', 'Enter', 'ArrowRight'];

// ---------------------------------------------------------------------------------------------
// Arguments

function parseArgs(argv) {
  const a = {
    root: DEFAULT_ROOT, routes: null, strategies: ['a', 'd', 'b', 'r1', 'r2', 'far'], profiles: ['phone', 'tv1080', 'tv720'],
    keyboard: true, quick: false, headed: false, dist: true, teacher: true, shots: true,
    stepTimeout: 5000, runTimeout: 150, budgetMin: 9.5
  };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    const val = () => argv[++i];
    if (x === '--root') a.root = path.resolve(val());
    else if (x === '--route' || x === '--routes') a.routes = val().split(',').map((s) => s.trim()).filter(Boolean);
    else if (x === '--strategies') a.strategies = val().split(',').map((s) => s.trim()).filter(Boolean);
    else if (x === '--profiles') a.profiles = val().split(',').map((s) => s.trim()).filter((p) => PROFILES[p]);
    else if (x === '--no-keyboard') a.keyboard = false;
    else if (x === '--quick') a.quick = true;
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
const norm = (s) => String(s || '').replace(/[\s​]+/g, '');

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

function makeStrategy(rid, n) {
  const picks = {};
  if (/^[abcd]$/.test(n)) CHOICE_IDS.forEach((c) => { picks[c] = n; });
  else if (/^r\d+$/.test(n)) {
    const rng = mulberry32(hashStr(rid + ':' + n));
    CHOICE_IDS.forEach((c) => { picks[c] = OPTION_IDS[Math.floor(rng() * 4)]; });
  } else if (n === 'far') {
    if (rid !== 'friend') return null;
    CHOICE_IDS.forEach((c) => { picks[c] = 'c'; });
    picks.c6 = 'd';
  } else return null;
  return { name: n, picks, reduced: n === 'b' };
}

function buildPlan(routes, args) {
  const plan = [];
  const phoneStrats = args.quick ? ['a'] : args.strategies;
  for (const rid of routes) {
    if (args.profiles.includes('phone')) {
      phoneStrats.forEach((n, i) => {
        const st = makeStrategy(rid, n);
        if (st) plan.push({ rid, st, profile: 'phone', input: 'touch', lang: 'both', shots: i === 0 });
      });
    }
    if (args.profiles.includes('tv1080')) {
      if (!args.quick) plan.push({ rid, st: makeStrategy(rid, 'a'), profile: 'tv1080', input: 'mouse', lang: 'both', shots: true });
      if (args.keyboard) plan.push({ rid, st: makeStrategy(rid, 'r3'), profile: 'tv1080', input: 'keyboard', lang: 'both', shots: false });
    }
    if (args.profiles.includes('tv720') && !args.quick) {
      plan.push({ rid, st: makeStrategy(rid, 'c'), profile: 'tv720', input: 'mouse', lang: { scribe: 'ko', friend: 'en', asher: 'both' }[rid] || 'both', shots: false });
    }
  }
  return plan;
}

// Normalized prefixes of texts that are centered by design: "sign" captions and the large ending line.
function specialTexts(data) {
  const out = new Set();
  const add = (t) => {
    if (!t) return;
    for (const l of ['ko', 'en']) {
      const r = norm(renderText(String(t[l] || '').split('{{var:')[0], l, data.scripture)).replace(/[\u201c\u201d"]/g, '').slice(0, 12);
      if (r.length >= 4) out.add(r);
    }
  };
  const visit = (v) => {
    if (Array.isArray(v)) { v.forEach(visit); return; }
    if (!isObj(v)) return;
    if (v.type === 'line' && v.speaker === 'sign') add(v.text);
    Object.values(v).forEach(visit);
  };
  visit(data.common && data.common.prologue);
  for (const rid of ROUTE_IDS) {
    const r = data.routes[rid];
    if (!isObj(r)) continue;
    visit(r);
    if (isObj(r.endings)) Object.values(r.endings).forEach((e) => e && add(e.last));
  }
  return [...out];
}

function runLabel(p) {
  return `${p.rid}/${p.st.name}@${p.profile}${p.input === 'keyboard' ? '+kbd' : ''}${p.lang !== 'both' ? '(' + p.lang + ')' : ''}`;
}

// Expected text screens (textbox contents) for a route path, as normalized prefixes.
function expectedTranscript(data, rid, picks, lang) {
  const l = lang === 'en' ? 'en' : 'ko';
  const out = [];
  const add = (raw, kind) => {
    let s = String(raw || '');
    const cut = s.indexOf('{{var:');
    if (cut >= 0) s = s.slice(0, cut);
    const r = norm(kind === 'verse' ? s : renderText(s, l, data.scripture)).replace(/[“”"]/g, '');
    out.push(r.slice(0, 14));
  };
  for (const b of (data.common && data.common.prologue) || []) {
    if (!isObj(b)) continue;
    if (b.type === 'line' && b.text) add(b.text[l], 'line');
    if (b.type === 'verse' && data.scripture && data.scripture[b.key]) add(data.scripture[b.key][l], 'verse');
  }
  const sim = simulate(data.routes[rid], data, picks);
  for (const it of sim.out) {
    if (it.kind === 'line') add(it.beat.text && it.beat.text[l], 'line');
    else if (it.kind === 'verse') add(data.scripture && data.scripture[it.beat.key] ? data.scripture[it.beat.key][l] : '', 'verse');
  }
  const dedup = [];
  for (const x of out) if (dedup[dedup.length - 1] !== x) dedup.push(x);
  return dedup;
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
    // Like Playwright, opacity does not count: elements fading in (opacity 0 at the first frame) are visible.
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      if (e.hidden) return false;
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
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
  const isKo = (t) => /[가-힣]/.test(t);
  // Font sizes of visible text inside an element, split into Korean and other text.
  const fontsIn = (root, skip) => {
    const out = { ko: [], en: [] };
    if (!root || !vis(root)) return out;
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = tw.nextNode())) {
      const t = n.nodeValue.replace(/\s+/g, '');
      if (!t || (skip && skip.test(t))) continue;
      const el = n.parentElement;
      if (!el || !vis(el)) continue;
      out[isKo(t) ? 'ko' : 'en'].push({ fs: parseFloat(getComputedStyle(el).fontSize), t: t.slice(0, 16) });
    }
    return out;
  };
  const sum = (arr) => (arr.length ? { min: Math.min(...arr.map((x) => x.fs)), max: Math.max(...arr.map((x) => x.fs)), sample: arr.reduce((a, b) => (b.fs < a.fs ? b : a)).t } : null);
  const tv = () => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const tb = document.querySelector('[data-testid="textbox"]');
    const story = fontsIn(tb);
    const opts = { ko: [], en: [] };
    const choiceEls = Array.from(document.querySelectorAll('[data-testid^="choice-"]')).filter(vis);
    choiceEls.forEach((b) => { const f = fontsIn(b, /^[1-4A-Da-d.)]+$/); opts.ko.push(...f.ko); opts.en.push(...f.en); });
    const sp = fontsIn(document.querySelector('[data-testid="speaker"]'));
    let panel = null;
    if (tb && vis(tb)) {
      // The visual panel is the nearest ancestor with a background, but never a (near) full-screen container.
      for (let e = tb; e && e !== document.body; e = e.parentElement) {
        if (e.getBoundingClientRect().height > 0.9 * H) break;
        const cs = getComputedStyle(e);
        const bg = cs.backgroundColor;
        if ((cs.backgroundImage && cs.backgroundImage !== 'none') || (bg && bg !== 'transparent' && !/rgba\(\d+, \d+, \d+, 0\)/.test(bg))) { panel = e; break; }
      }
      if (!panel) panel = tb;
    }
    const pr = panel ? panel.getBoundingClientRect() : null;
    const stage = document.getElementById('stage');
    const offenders = [];
    let minAll = null;
    const all = document.body.querySelectorAll('*');
    for (const el of all) {
      if (stage && stage.contains(el)) continue;
      if (el.closest('[aria-hidden="true"], noscript, script, style')) continue;
      const hasText = Array.from(el.childNodes).some((c) => c.nodeType === 3 && c.nodeValue.trim());
      const isContent = hasText || el.matches('button, a[href], input, textarea, select, [data-testid]');
      if (!isContent) continue;
      if (!vis(el)) continue;
      const r = el.getBoundingClientRect();
      if (offenders.length < 8 && (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1)) {
        offenders.push({
          id: el.getAttribute('data-testid') || el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : ''),
          r: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)],
          text: (el.innerText || '').trim().slice(0, 24)
        });
      }
      if (hasText) {
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (!minAll || fs < minAll.fs) minAll = { fs, id: el.getAttribute('data-testid') || el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : ''), t: (el.innerText || '').trim().slice(0, 20) };
      }
    }
    const light = document.getElementById('light');
    let fsBtn = null;
    document.querySelectorAll('button, [role="button"]').forEach((b) => {
      const k = (b.getAttribute('data-testid') || '') + ' ' + (b.getAttribute('aria-label') || '') + ' ' + (b.getAttribute('title') || '');
      if (/fullscreen|full screen|전체\s?화면/i.test(k) && vis(b)) fsBtn = b.getAttribute('data-testid') || 'button';
    });
    return {
      W, H,
      story: { ko: sum(story.ko), en: sum(story.en) },
      options: { ko: sum(opts.ko), en: sum(opts.en) },
      speaker: sum(sp.ko.concat(sp.en)),
      panel: pr ? { top: pr.top, bottom: pr.bottom, left: pr.left, right: pr.right, width: pr.width } : null,
      choices: choiceEls.map((b) => { const r = b.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), text: (b.innerText || '').trim().slice(0, 40) }; }),
      offenders,
      scrollH: document.documentElement.scrollHeight,
      minAll,
      light: light ? light.getAttribute('data-level') : null,
      fullscreenButton: fsBtn,
      dialogOpen: Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"], dialog[open]')).some(vis)
    };
  };
  const snap = (opts) => {
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
    const ae = document.activeElement;
    return {
      screen: document.body.dataset.screen || '',
      ids,
      dbg: b.d,
      dbgSource: b.src,
      textbox: text('[data-testid="textbox"]'),
      speaker: text('[data-testid="speaker"]'),
      endingTitle: text('[data-testid="ending-title"]'),
      choiceTexts,
      litActions,
      overflow: sw - iw,
      scrollWidth: sw,
      innerWidth: iw,
      small,
      leaks,
      bodyText: bodyText.slice(0, 4000),
      focus: ae && ae !== document.body ? ae.getAttribute('data-testid') || ae.tagName.toLowerCase() : null,
      tv: opts && opts.tv ? tv() : null,
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
  const prof = PROFILES[opts.profile || 'phone'];
  const context = await browser.newContext({
    viewport: opts.viewport || prof.viewport,
    isMobile: opts.mobile != null ? opts.mobile : prof.mobile,
    hasTouch: opts.mobile != null ? opts.mobile : prof.mobile,
    deviceScaleFactor: opts.scale || prof.scale,
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
    const where = msg.location() || {};
    if (!isLocal(where.url)) return;
    if (/net::ERR_FAILED/.test(msg.text()) && /Failed to load resource/.test(msg.text())) return;
    log.console.push(`${snip(msg.text(), 200)}${where.url ? ` (${where.url.replace(/^.*\//, '')}:${where.lineNumber})` : ''}`);
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
const snapOf = (page, tv) => page.evaluate((o) => window.__qa.snap(o), { tv: !!tv });

async function visible(page, id) {
  try { return await loc(page, id).isVisible(); } catch (e) { return false; }
}

// Pointer activation: touch tap on phones, mouse click on TV; falls back to a DOM click.
async function tap(page, id, run, input, timeout = 2500) {
  const l = loc(page, id);
  try {
    if (input === 'touch') await l.tap({ timeout });
    else await l.click({ timeout });
    return 'click';
  } catch (e) {
    try {
      await l.dispatchEvent('click', {}, { timeout: 1000 });
      if (run) {
        const screen = await page.evaluate(() => document.body.dataset.screen).catch(() => '?');
        const why = (e.message.match(/(intercepts pointer events|not stable|not visible|not enabled|outside of the viewport|detached)[^\n]*/) || [e.message.split('\n')[0]])[0];
        run.fallbacks = (run.fallbacks || 0) + 1;
        run.note(`"${id}" could not be ${input === 'touch' ? 'tapped' : 'clicked'} normally on "${screen}" (${snip(why, 110)}); used a DOM click`);
      }
      return 'dispatch';
    } catch (e2) { return null; }
  }
}

// Keyboard-only activation of a page button: Tab until it has focus, then Enter.
async function keyActivate(page, id, run, maxTabs = 60) {
  for (let i = 0; i <= maxTabs; i++) {
    const f = await page.evaluate(() => (document.activeElement ? document.activeElement.getAttribute('data-testid') : null));
    if (f === id) {
      // SPEC 5.4: visible focus. The focused control needs an outline or a focus box-shadow.
      if (run && !run.focusChecked.has(id)) {
        run.focusChecked.add(id);
        const ring = await page.evaluate(() => {
          const cs = getComputedStyle(document.activeElement);
          const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
          return { outline, shadow: cs.boxShadow !== 'none' };
        });
        if (!ring.outline && !ring.shadow) run.warn(`keyboard: "${id}" has no visible focus indicator (SPEC 5.4)`, true);
      }
      await page.keyboard.press('Enter');
      return true;
    }
    await page.keyboard.press('Tab');
  }
  if (run) run.fail(`keyboard: could not reach "${id}" with Tab (${maxTabs} presses)`, true);
  return false;
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

// ---------------------------------------------------------------------------------------------
// Per-snapshot checks

function checkSnapshot(s, run, R) {
  R.screensChecked++;
  const where = run.where;
  if (s.overflow > 1) {
    const k = `${run.profile}|${s.screen}`;
    if (!R.overflow.has(k)) R.overflow.set(k, `${where}: horizontal overflow on "${s.screen}" (scrollWidth ${s.scrollWidth} > innerWidth ${s.innerWidth})`);
    run.fail(`horizontal overflow on screen "${s.screen}" (scrollWidth ${s.scrollWidth} > ${s.innerWidth})`, true);
  }
  for (const b of s.small) {
    // SPEC 5.4 tap targets are a touch rule: FAIL on the phone profile, WARN on mouse/keyboard TV profiles.
    const k = `${run.profile}|${b.id}`;
    if (!R.small.has(k)) R.small.set(k, `[${run.profile}] ${b.id} is ${b.w}x${b.h} px${b.text ? ` ("${snip(b.text, 24)}")` : ''}, first on "${s.screen}" (${where})`);
    const msg = `tap target smaller than 44x44: ${b.id} ${b.w}x${b.h} (first on "${s.screen}")`;
    if (run.small.has(b.id)) continue;
    run.small.add(b.id);
    if (PROFILES[run.profile].tv) run.warn(msg, true);
    else run.fail(msg, true);
  }
  if (s.leaks.length) run.fail(`unresolved or broken text on "${s.screen}": "${s.leaks[0]}"`, true);
  if (run.lang === 'both' && s.screen === 'play' && s.textbox && s.textbox.length > 6) {
    const hasKo = HANGUL.test(s.textbox);
    const hasEn = /[A-Za-z]{3,}/.test(s.textbox);
    if (!hasKo || !hasEn) run.warn(`"both" language mode shows only ${hasKo ? 'Korean' : 'English'} in the text box: "${snip(s.textbox, 50)}"`, true);
  }
  if (run.lang === 'en' && s.textbox && HANGUL.test(s.textbox)) run.warn(`English mode shows Hangul in the text box: "${snip(s.textbox, 50)}"`, true);
  if (run.lang === 'ko' && s.textbox && /[A-Za-z]{4,}\s+[A-Za-z]{4,}/.test(s.textbox)) run.warn(`Korean mode shows English in the text box: "${snip(s.textbox, 50)}"`, true);
  if (s.tv) checkTv(s, run);
}

// SPEC 5.6 TV checks (coordinator thresholds: 1080p story >= 36 px, options >= 30 px; 720p 24 / 20 px).
function checkTv(s, run) {
  const tv = s.tv;
  const prof = PROFILES[run.profile].tv;
  const vh = tv.H / 100;
  const primary = run.lang === 'en' ? 'en' : 'ko';
  const m = run.tvm;
  const playLike = s.screen === 'play' || s.screen === 'prologue' || s.screen === 'ending';
  if (playLike && s.textbox && tv.story[primary]) {
    const st = tv.story[primary];
    if (st.min < m.storyMin) { m.storyMin = st.min; m.storySample = st.sample; }
    if (run.lang === 'both' && tv.story.en && tv.story.en.min < m.storyEnMin) { m.storyEnMin = tv.story.en.min; m.storyEnSample = tv.story.en.sample; }
    const special = run.special && run.special.some((x) => norm(s.textbox).includes(x));
    if (tv.panel && special) {
      const topPct = (tv.panel.top / tv.H) * 100;
      if (topPct < m.specialTopMin) m.specialTopMin = topPct;
    } else if (tv.panel) {
      const topPct = (tv.panel.top / tv.H) * 100;
      if (topPct < m.panelTopMin) { m.panelTopMin = topPct; m.panelTopText = s.textbox; }
      if (tv.panel.top < 0.6 * tv.H - 2 && !m.panelBad.some((x) => x.text === s.textbox)) m.panelBad.push({ pct: topPct, text: s.textbox });
      const centerOff = Math.abs((tv.panel.left + tv.panel.right) / 2 - tv.W / 2);
      if (centerOff > tv.W * 0.03) run.warn(`TV: text panel is not centered (center ${Math.round(centerOff)} px off)`, true);
      if (tv.panel.width > tv.W * 0.9) run.warn(`TV: text panel spans ${Math.round(tv.panel.width / tv.W * 100)}% of the width (SPEC 5.6: comfortable max width)`, true);
    }
    if (s.speaker && tv.speaker && tv.speaker.min < 3 * vh - 0.5) run.warn(`TV: speaker name ${tv.speaker.min.toFixed(1)} px < 3vh (${(3 * vh).toFixed(1)} px)`, true);
  }
  if (s.screen === 'play' && tv.options[primary]) {
    const op = tv.options[primary];
    if (op.min < m.optionMin) { m.optionMin = op.min; m.optionSample = op.sample; }
    if (tv.choices.length === 4 && run.profile === 'tv1080') {
      const xs = new Set(tv.choices.map((c) => Math.round(c.x / 20)));
      const ys = new Set(tv.choices.map((c) => Math.round(c.y / 20)));
      if (!(xs.size === 2 && ys.size === 2)) run.warn(`TV: options are not in a 2x2 grid at 1920 wide (SPEC 5.6; ${xs.size} columns x ${ys.size} rows)`, true);
      const badges = tv.choices.every((c, i) => new RegExp('(^|\\s)' + (i + 1) + '(\\s|$|[.)])').test(c.text));
      if (!badges) run.warn('TV: options show no number badges 1-4 (SPEC 5.6)', true);
    }
  }
  for (const o of tv.offenders) {
    const k = `${s.screen}|${o.id}|${o.r.join(',')}`;
    if (m.offenderKeys.has(k)) continue;
    m.offenderKeys.add(k);
    m.offenders++;
    if (!m.offendersByScreen.has(s.screen)) m.offendersByScreen.set(s.screen, []);
    m.offendersByScreen.get(s.screen).push(`${o.id} [${o.r.join(', ')}]${o.text ? ` "${snip(o.text, 18)}"` : ''}`);
  }
  if (tv.scrollH > tv.H + 1 && !m.scrollScreens.has(s.screen)) {
    m.scrollScreens.add(s.screen);
    run.fail(`TV: page scrolls vertically on "${s.screen}" (scrollHeight ${tv.scrollH} > ${tv.H})`, true);
  }
  if (tv.minAll && tv.minAll.fs < 2.2 * vh - 0.5) {
    run.warn(`TV: text below 2.2vh on "${s.screen}": ${tv.minAll.id} at ${tv.minAll.fs.toFixed(1)} px ("${snip(tv.minAll.t, 20)}") (SPEC 5.6: nothing below 2.2vh)`, true);
  }
}

// Turns the per-screen TV measurements of a run into a few aggregated failure lines.
function finalizeTv(run, prof) {
  const m = run.tvm;
  const [W, H] = [prof.viewport.width, prof.viewport.height];
  if (m.storyMin < prof.tv.story - 0.25) run.fail(`TV: story text down to ${m.storyMin.toFixed(1)} px at ${W}x${H} (needs >= ${prof.tv.story} px; "${m.storySample}")`, true);
  if (m.storyEnMin < 2.2 * H / 100 - 0.25) run.fail(`TV: English story line down to ${m.storyEnMin.toFixed(1)} px (< 2.2vh = ${(2.2 * H / 100).toFixed(1)} px; "${m.storyEnSample}")`, true);
  if (m.optionMin < prof.tv.option - 0.25) run.fail(`TV: option text down to ${m.optionMin.toFixed(1)} px at ${W}x${H} (needs >= ${prof.tv.option} px; "${m.optionSample}")`, true);
  if (m.panelBad.length) {
    const worst = m.panelBad.reduce((a, b) => (b.pct < a.pct ? b : a));
    const eg = m.panelBad.slice(0, 3).map((x) => `${x.pct.toFixed(0)}% "${snip(x.text, 28)}"`).join('; ');
    run.fail(`TV: the text panel reaches above 60% of the screen height on ${m.panelBad.length} text screen(s); worst ${worst.pct.toFixed(0)}% ("${snip(worst.text, 40)}"); e.g. ${eg}`, true);
  }
  for (const [screen, list] of m.offendersByScreen) {
    run.fail(`TV: ${list.length} element(s) outside the ${W}x${H} viewport on "${screen}": ${list.slice(0, 3).join('; ')}${list.length > 3 ? '; ...' : ''}`, true);
  }
}

// ---------------------------------------------------------------------------------------------
// One playthrough

function newRun(p) {
  const run = {
    rid: p.rid, strategy: p.st.name, profile: p.profile, input: p.input, lang: p.lang, where: runLabel(p),
    picks: p.st.picks, made: {}, failures: [], warnings: [], notes: [], screens: new Set(), steps: 0, shots: [],
    expected: null, observed: null, title: '', result: 'PASS', ms: 0, last: { screen: '', beat: '', text: '' },
    texts: [], dbgSource: null, keys: { ok: {}, fail: {} }, small: new Set(), special: p.special || null, focusChecked: new Set(),
    tvm: {
      storyMin: Infinity, storyEnMin: Infinity, optionMin: Infinity, panelTopMin: Infinity, panelTopText: '', specialTopMin: Infinity,
      offenders: 0, offenderKeys: new Set(), offendersByScreen: new Map(), panelBad: [], scrollScreens: new Set(),
      storySample: '', storyEnSample: '', optionSample: ''
    }
  };
  run.fail = (m, once) => { if (!once || !run.failures.includes(m)) run.failures.push(m); };
  run.warn = (m, once) => { if (!once || !run.warnings.includes(m)) run.warnings.push(m); };
  run.note = (m) => { if (!run.notes.includes(m)) run.notes.push(m); };
  return run;
}

async function playRun(browser, R, cfg) {
  const { url, data, args, p, fileMode } = cfg;
  const rid = p.rid;
  const strat = p.st;
  const run = newRun(p);
  if (cfg.label) run.where = cfg.label;
  const t0 = Date.now();
  const prof = PROFILES[p.profile];
  const kbd = p.input === 'keyboard';
  const { context, page, log } = await newPage(browser, R, { profile: p.profile, reduced: strat.reduced, stepTimeout: args.stepTimeout });
  const route = data.routes[rid];
  const meta = data.meta || {};
  const common = data.common || {};
  const extras = !fileMode && strat.name === 'a';
  const shotTaken = new Set();
  const takeShot = async (name, enabled) => {
    if (!enabled || !args.shots || shotTaken.has(name)) return;
    shotTaken.add(name);
    const f = await shot(page, path.join(args.shotDir, name + '.png'), R);
    if (f) run.shots.push(f);
  };
  const phoneShots = p.profile === 'phone' && p.shots && !fileMode;
  const tvShots = p.profile === 'tv1080' && p.shots && !fileMode;
  const firstShots = cfg.firstOfProfile;
  const actionReplies = new Set();
  if (route && Array.isArray(route.actions)) route.actions.forEach((a) => (a.replies || []).forEach((t) => { if (t) { actionReplies.add(t.ko); actionReplies.add(t.en); } }));
  JSON.stringify(route || {}, (k, v) => { if (isObj(v) && v.fx === 'actionReply' && v.text) { actionReplies.add(v.text.ko); actionReplies.add(v.text.en); } return v; });
  const tapped = new Set();
  let choiceCount = 0;
  const did = {};
  let sawThought = false;
  let sawReceipt = false;
  let done = false;
  let advIdx = 0;
  const press = async (id) => (kbd ? keyActivate(page, id, run) : tap(page, id, run, p.input));
  const snapNow = () => snapOf(page, !!prof.tv);
  try {
    const resp = await page.goto(url, { waitUntil: 'load', timeout: 20000 });
    if (resp && resp.status && resp.status() >= 400) { run.fail(`index page returned HTTP ${resp.status()}`); throw new Error('stop'); }
    if (!(await waitScreen(page, 'title', 10000))) {
      const s0 = await snapOf(page, false).catch(() => ({ screen: '?' }));
      run.fail(`title screen never appeared (body data-screen="${s0.screen}")`);
      throw new Error('stop');
    }
    let s = await snapNow();
    run.dbgSource = s.dbgSource;
    checkSnapshot(s, run, R);
    await takeShot('phone-title', phoneShots && firstShots);
    await takeShot('tv-title', tvShots && firstShots);
    for (const id of ['start', 'lang-ko', 'lang-en', 'lang-both', 'gallery-open', 'teacher-link']) {
      if (!s.ids.includes(id)) run.fail(`title screen: data-testid="${id}" not visible`, true);
    }
    if (kbd) {
      const pressed = await page.evaluate(() => { const b = document.querySelector('[data-testid="lang-both"]'); return b ? b.getAttribute('aria-pressed') : null; });
      if (pressed !== 'true') run.warn(`title: lang-both is not the default selection (aria-pressed=${JSON.stringify(pressed)}; SPEC 5.2)`, true);
    } else if (s.ids.includes('lang-' + p.lang)) await tap(page, 'lang-' + p.lang, run, p.input);
    const before = await page.evaluate(() => window.__qa.sig());
    if (!(await press('start'))) { run.fail('could not activate "start"'); throw new Error('stop'); }
    await waitChange(page, before, args.stepTimeout);
    let stuck = 0;
    for (let guard = 0; guard < 900 && !done; guard++) {
      s = await snapNow();
      run.steps++;
      run.screens.add(s.screen);
      run.last = { screen: s.screen, beat: s.dbg ? s.dbg.beatIndex : '', text: s.textbox || s.endingTitle };
      if (s.dbgSource && !run.dbgSource) run.dbgSource = s.dbgSource;
      checkSnapshot(s, run, R);
      if (s.textbox && /^(prologue|play|ending)$/.test(s.screen) && run.texts[run.texts.length - 1] !== s.textbox) run.texts.push(s.textbox);
      if (s.ids.includes('thought-bubble')) sawThought = true;
      if (s.ids.includes('read-receipt')) sawReceipt = true;
      const prev = s.sig;
      let acted = null;
      switch (s.screen) {
        case 'title':
          acted = s.ids.includes('start') ? await press('start') : null;
          break;
        case 'prologue':
          acted = kbd ? 'key' : await tap(page, 'advance', run, p.input);
          break;
        case 'routeSelect':
          await takeShot('phone-route-select', phoneShots && firstShots);
          await takeShot('tv-route-select', tvShots && firstShots);
          for (const r of ROUTE_IDS) if (!s.ids.includes('route-' + r)) run.fail(`route select: data-testid="route-${r}" not visible`, true);
          acted = await press('route-' + rid);
          break;
        case 'play': {
          const choiceVisible = s.ids.includes('choice-a');
          if (!choiceVisible && s.textbox) await takeShot(`phone-${rid}-1-first-scene`, phoneShots);
          if (s.ids.includes('verse-card')) {
            await takeShot(`phone-${rid}-3-verse-card`, phoneShots);
            if (s.tv && (s.tv.light === 'soft' || s.tv.light === 'bright')) await takeShot(`tv-${rid}-verse-light`, tvShots);
          }
          if (tvShots && !did.cursor && s.textbox && !choiceVisible && firstShots) { did.cursor = true; await cursorCheck(page, run); }
          if (!did.aria && s.textbox) {
            did.aria = true;
            const live = await page.evaluate(() => { const t = document.querySelector('[data-testid="textbox"]'); return t ? t.getAttribute('aria-live') || (t.closest('[aria-live]') ? 'inherited' : null) : null; });
            if (!live) run.warn('the text box has no aria-live (SPEC 5.4)', true);
          }
          if (prof.tv && !did.fsButton && s.tv) {
            did.fsButton = true;
            if (!s.tv.fullscreenButton) run.warn('TV: no visible fullscreen button during play (SPEC 5.6)', true);
          }
          if (kbd && !did.esc && choiceCount >= 1 && s.textbox && !choiceVisible) { did.esc = true; await escMenuCheck(page, run, args); continue; }
          if (kbd && !did.fkey && choiceCount >= 2 && s.textbox && !choiceVisible) { did.fkey = true; await fullscreenKeyCheck(page, run); }
          if (choiceVisible) {
            const cid = CHOICE_IDS[choiceCount] || 'c?';
            await takeShot(`phone-${rid}-2-first-choice`, phoneShots);
            await takeShot(`tv-${rid}-choice`, tvShots);
            if (extras && p.profile === 'phone' && !did.lang) { did.lang = true; await langSwitchCheck(page, run, s, p.input); }
            if (extras && cfg.settingsCheck && !did.settings) { did.settings = true; await settingsCheck(page, run, p.input); }
            const pick = strat.picks[cid] || 'a';
            if (!s.ids.includes('choice-' + pick)) { run.fail(`${cid}: option "${pick}" not visible (visible: ${s.ids.filter((x) => /^choice-/.test(x)).join(', ')})`); throw new Error('stop'); }
            let ok = false;
            if (kbd) {
              const digit = String(OPTION_IDS.indexOf(pick) + 1);
              if (cid === 'c3') {
                await page.keyboard.press(pick);
                ok = await waitChange(page, prev, 1500);
                if (!ok) run.warn(`keyboard: letter key "${pick.toUpperCase()}" did not pick an option at ${cid} (SPEC 5.6: A-D pick)`, true);
              }
              if (!ok) {
                await page.keyboard.press(digit);
                ok = await waitChange(page, prev, args.stepTimeout);
                if (!ok) run.fail(`keyboard: digit key "${digit}" did not pick option ${pick} at ${cid}`, true);
              }
              acted = ok ? 'key' : null;
            } else {
              acted = await tap(page, 'choice-' + pick, run, p.input);
              ok = acted ? await waitChange(page, prev, args.stepTimeout) : false;
            }
            if (ok) {
              run.made[cid] = pick;
              choiceCount++;
              const s2 = await snapOf(page, false);
              if (s2.dbg && s2.dbg.choices && s2.dbg.choices[cid] !== pick) run.fail(`${cid}: debugState().choices.${cid} is ${JSON.stringify(s2.dbg.choices[cid])}, expected "${pick}"`, true);
              stuck = 0;
              continue;
            }
            if (!acted) { run.fail(`${cid}: could not pick option ${pick}`); throw new Error('stop'); }
          } else if (s.ids.includes('press')) {
            if (kbd) {
              acted = 'key';
              const okKey = await keyAdvance(page, run, prev, args, ['Space', 'Enter', 'ArrowRight']);
              if (okKey) { stuck = 0; continue; }
              run.warn(`keyboard: press beat "${snip((await snapOf(page, false)).bodyText.match(/\S.{0,30}/) || '', 30)}" could not be activated with Space/Enter/ArrowRight; needed Tab+Enter (a clicker could not continue)`, true);
              acted = (await keyActivate(page, 'press', run)) ? 'key' : null;
            } else acted = await tap(page, 'press', run, p.input);
          } else {
            if (rid === 'asher' && route && Array.isArray(route.actions) && !kbd) {
              await grayActionCheck(page, run, s, choiceCount, tapped, actionReplies, p.input);
            }
            if (extras && p.profile === 'phone' && !did.resume && choiceCount >= 2 && s.textbox) {
              did.resume = true;
              if (!(await resumeCheck(page, run, s, p.input))) throw new Error('stop');
              continue;
            }
            acted = kbd ? 'key' : await tap(page, 'advance', run, p.input);
          }
          break;
        }
        case 'endingCard': {
          await takeShot(`phone-${rid}-4-ending-card`, phoneShots);
          await takeShot(`tv-${rid}-ending-card`, tvShots);
          endingChecks(s, run, route, meta, common, strat, rid);
          acted = kbd ? 'key' : await tap(page, 'advance', run, p.input);
          break;
        }
        case 'ending':
          acted = kbd ? 'key' : await tap(page, 'advance', run, p.input);
          break;
        case 'final': {
          await finalChecks(page, run, s, kbd, p.input);
          await takeShot(`phone-${rid}-5-final`, phoneShots);
          await takeShot(`tv-${rid}-final`, tvShots);
          if (!s.ids.includes('final-next')) { run.fail('final screen: data-testid="final-next" not visible'); throw new Error('stop'); }
          acted = await press('final-next');
          break;
        }
        case 'gallery': {
          await galleryChecks(page, run, rid);
          await takeShot('phone-gallery', phoneShots && firstShots);
          await takeShot('tv-gallery', tvShots && firstShots);
          done = true;
          acted = 'done';
          break;
        }
        default:
          run.fail(`unexpected body data-screen="${s.screen}"`, true);
          acted = kbd ? 'key' : await tap(page, 'advance', run, p.input);
      }
      if (done) break;
      if (!acted) {
        run.fail(`no actionable control on screen "${s.screen}" (visible testids: ${s.ids.join(', ') || 'none'})`);
        break;
      }
      let changed;
      if (acted === 'key') {
        const keys = ADVANCE_KEYS.slice(advIdx).concat(ADVANCE_KEYS.slice(0, advIdx));
        advIdx = (advIdx + 1) % ADVANCE_KEYS.length;
        changed = await keyAdvance(page, run, prev, args, keys);
      } else changed = await waitChange(page, prev, args.stepTimeout);
      if (!changed && !kbd) {
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
    if (done) transcriptCheck(run, data, rid, p);
    if (prof.tv) finalizeTv(run, prof);
    if (kbd) {
      for (const k of REQUIRED_KEYS) if (!run.keys.ok[k]) run.fail(`keyboard: ${k} never advanced the story`, true);
      for (const k of ADVANCE_KEYS) if (run.keys.fail[k] && run.keys.ok[k]) run.warn(`keyboard: ${k} advanced on ${run.keys.ok[k]} screen(s) but not on ${run.keys.fail[k]}`, true);
      for (const k of ADVANCE_KEYS.filter((x) => !REQUIRED_KEYS.includes(x))) if (!run.keys.ok[k]) run.warn(`keyboard: ${k} never advanced (SPEC 5.6 lists it for presentation clickers)`, true);
    }
  } catch (e) {
    if (e && e.message !== 'stop') run.fail(`exception: ${snip(e.message, 200)}`);
  }
  for (const c of log.console) run.fail(`console error: ${c}`, true);
  for (const pe of log.pageErrors) run.fail(`page error: ${pe}`, true);
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
  return run;
}

// Presses advance keys in order until the page changes; records which keys worked.
async function keyAdvance(page, run, prev, args, keys) {
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    await page.keyboard.press(k);
    const ok = await waitChange(page, prev, i === 0 ? args.stepTimeout : 1200);
    const s = await snapOf(page, false);
    if (s.ids.includes('confirm-yes') || s.ids.includes('speed-instant')) {
      run.fail(`keyboard: ${k} opened a dialog/menu instead of advancing (focus was on "${s.focus || 'body'}")`, true);
      await page.keyboard.press('Escape');
      await sleep(100);
      if (await visible(page, 'confirm-no')) await keyActivate(page, 'confirm-no', run);
      if (await visible(page, 'settings-close')) await keyActivate(page, 'settings-close', run);
      return false;
    }
    if (ok) {
      run.keys.ok[k] = (run.keys.ok[k] || 0) + 1;
      return true;
    }
    run.keys.fail[k] = (run.keys.fail[k] || 0) + 1;
  }
  return false;
}

function endingChecks(s, run, route, meta, common, strat, rid) {
  const exp = computeLensFor(route, run.made);
  run.expected = exp;
  run.observed = s.dbg ? s.dbg.lens : null;
  run.title = s.endingTitle;
  if (s.dbg && s.dbg.lens != null && Number(s.dbg.lens) !== exp.lens) run.fail(`ending lens from debugState is ${s.dbg.lens}, SPEC 5.1 expects ${exp.lens} (scores ${JSON.stringify(exp.scores)}, c10 lens ${exp.c10Lens})`, true);
  if (!s.dbg) run.fail('debugState() not available (expected BHS.ui.debugState() or BHS_DEBUG.state())', true);
  const want = meta.endings && meta.endings[rid] && meta.endings[rid][exp.lens];
  if (want) {
    const need = run.lang === 'en' ? [want.en] : run.lang === 'ko' ? [want.ko] : [want.ko, want.en];
    if (need.some((x) => !s.endingTitle.includes(x))) run.fail(`ending card shows "${snip(s.endingTitle, 60)}", expected the title "${need.join('" / "')}" (lens ${exp.lens})`, true);
  }
  const mm = common.mismatchLine;
  if (mm) {
    const needle = norm(run.lang === 'en' ? mm.en : mm.ko).slice(0, 14);
    const saw = run.texts.some((t) => norm(t).includes(needle));
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
}

// Every text screen shown must match the SPEC reference sequence (prologue + route path), in order.
function transcriptCheck(run, data, rid, p) {
  const exp = expectedTranscript(data, rid, run.made, p.lang);
  const got = run.texts.map((t) => norm(t).replace(/[“”"]/g, ''));
  let i = 0;
  let j = 0;
  while (i < exp.length && j < got.length) {
    if (!exp[i] || got[j].includes(exp[i])) { i++; j++; continue; }
    run.fail(`transcript: text screen #${j + 1} shows "${snip(run.texts[j], 40)}" but the reference expects "${exp[i]}…" (${exp.length} expected, ${got.length} shown)`, true);
    return;
  }
  if (i < exp.length) run.fail(`transcript: ${exp.length - i} expected text screen(s) were never shown (next expected "${exp[i]}…")`, true);
  else if (j < got.length) run.fail(`transcript: ${got.length - j} extra text screen(s) after the reference ended (first "${snip(run.texts[j], 40)}")`, true);
}

async function finalChecks(page, run, s, kbd, input) {
  if (!s.ids.includes('final-blank')) { run.fail('final screen: data-testid="final-blank" not visible', true); return; }
  const answer = '테스트 answer';
  if (kbd) {
    for (let i = 0; i < 60; i++) {
      const f = await page.evaluate(() => (document.activeElement ? document.activeElement.getAttribute('data-testid') : null));
      if (f === 'final-blank') break;
      await page.keyboard.press('Tab');
    }
    await page.keyboard.type(answer);
  } else {
    await loc(page, 'final-blank').fill(answer).catch((e) => run.fail(`could not type into final-blank: ${snip(e.message, 80)}`));
  }
  const value = await page.evaluate(() => { const el = document.querySelector('[data-testid="final-blank"]'); return el ? el.value || el.textContent : ''; });
  if (!String(value).includes('answer')) run.fail(`final-blank did not receive the typed answer (value ${JSON.stringify(value)})`, true);
  const stored = await page.evaluate(() => { try { return localStorage.getItem('bhs.v1.blanks') || ''; } catch (e) { return 'ERR'; } });
  if (!stored.includes('answer')) run.warn('final-blank text was not saved to localStorage bhs.v1.blanks (SPEC 5.3)', true);
}

async function galleryChecks(page, run, rid) {
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
}

// Header language buttons: the contract names lang-ko/en/both; the header may use hdr-lang-*.
async function langButton(page, mode) {
  for (const id of [`lang-${mode}`, `hdr-lang-${mode}`]) if (await visible(page, id)) return id;
  return null;
}

async function langSwitchCheck(page, run, s, input) {
  const idEn = await langButton(page, 'en');
  const idKo = await langButton(page, 'ko');
  const idBoth = await langButton(page, 'both');
  if (!idEn || !idKo || !idBoth) { run.fail('language cannot be switched during play: no visible lang-ko/en/both (or hdr-lang-*) buttons (SPEC 5.2)', true); return; }
  if (idEn.startsWith('hdr-')) run.note(`header language buttons use data-testid "hdr-lang-*" instead of "lang-*"`);
  const texts = async () => (await snapOf(page, false)).choiceTexts;
  await tap(page, idEn, run, input);
  await sleep(120);
  const en = await texts();
  if (Object.values(en).some((t) => HANGUL.test(t))) run.warn(`English mode still shows Hangul in options: "${snip(Object.values(en).find((t) => HANGUL.test(t)), 50)}"`, true);
  await tap(page, idKo, run, input);
  await sleep(120);
  const ko = await texts();
  if (Object.values(ko).some((t) => !HANGUL.test(t))) run.warn('Korean mode shows an option without Hangul', true);
  if (Object.values(ko).some((t) => /[A-Za-z]{4,}\s+[A-Za-z]{4,}/.test(t))) run.warn('Korean mode still shows English text in options', true);
  await tap(page, idBoth, run, input);
  await sleep(120);
  const both = await texts();
  if (Object.values(both).some((t) => !HANGUL.test(t) || !/[A-Za-z]{3,}/.test(t))) run.warn('"both" mode options do not show both languages', true);
  const after = await snapOf(page, false);
  if (after.screen !== s.screen || !after.ids.includes('choice-a')) run.fail('switching language left the choice screen', true);
}

async function settingsCheck(page, run, input) {
  if (!(await visible(page, 'settings-open'))) { run.fail('settings-open not visible during play', true); return; }
  await tap(page, 'settings-open', run, input);
  try { await loc(page, 'speed-instant').waitFor({ state: 'visible', timeout: 2000 }); } catch (e) { run.fail('settings panel did not show speed-instant', true); return; }
  await tap(page, 'speed-instant', run, input);
  const stored = await page.evaluate(() => { try { return localStorage.getItem('bhs.v1.settings') || ''; } catch (e) { return 'ERR'; } });
  if (!/instant/.test(stored)) run.warn('text speed "instant" was not saved to localStorage bhs.v1.settings (SPEC 5.3)', true);
  if (await visible(page, 'settings-close')) await tap(page, 'settings-close', run, input);
  else await page.keyboard.press('Escape').catch(() => {});
  await sleep(150);
  if (await visible(page, 'speed-instant')) {
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(150);
    if (await visible(page, 'speed-instant')) run.fail('settings panel could not be closed (settings-close / Escape)', true);
  }
}

async function grayActionCheck(page, run, s, choiceCount, tapped, replies, input) {
  // Tap Asher's gray actions at a few moments before c9; they must not advance the story.
  const plan = [[0, 'getup'], [3, 'getup'], [3, 'goout'], [6, 'getup']];
  for (const [at, id] of plan) {
    const key = at + ':' + id;
    if (choiceCount !== at || tapped.has(key)) continue;
    tapped.add(key);
    if (!s.ids.includes('action-' + id)) { run.fail(`gray action "${id}" not visible before c${at + 1} (SPEC 4.5: visible from the first beat)`, true); continue; }
    const b = await snapOf(page, false);
    const counter = id === 'getup' ? 'getup_count' : 'goout_count';
    const before = b.dbg && b.dbg.vars ? Number(b.dbg.vars[counter] || 0) : null;
    await tap(page, 'action-' + id, run, input);
    await sleep(150);
    const a = await snapOf(page, false);
    if (a.screen !== 'play' || (b.dbg && a.dbg && a.dbg.beatIndex !== b.dbg.beatIndex) || a.textbox !== b.textbox) {
      run.fail(`tapping gray action "${id}" changed the story position (beat ${b.dbg ? b.dbg.beatIndex : '?'} -> ${a.dbg ? a.dbg.beatIndex : '?'})`, true);
    }
    if (before !== null && a.dbg && a.dbg.vars) {
      const after = Number(a.dbg.vars[counter] || 0);
      if (after !== before + 1) run.fail(`gray action "${id}": counter ${counter} went ${before} -> ${after}, expected +1`, true);
    }
    if (![...replies].some((t) => t && a.bodyText.includes(t))) run.warn(`gray action "${id}": no reply text visible after the tap`, true);
  }
  if (choiceCount >= 9 && s.ids.includes('action-getup') && !s.litActions.includes('getup')) {
    run.warn('gray action "getup" is still visible after the getup press (SPEC 4.5: hidden after the press on getup)', true);
  }
}

async function resumeCheck(page, run, s, input) {
  // Home -> confirm-no keeps the place; home -> confirm-yes -> continue resumes at the same place.
  const where = { text: s.textbox, beat: s.dbg ? s.dbg.beatIndex : null, choices: s.dbg ? JSON.stringify(s.dbg.choices || {}) : null };
  if (!(await visible(page, 'home'))) { run.fail('home button not visible during play', true); return true; }
  await tap(page, 'home', run, input);
  try { await loc(page, 'confirm-no').waitFor({ state: 'visible', timeout: 2000 }); } catch (e) { run.fail('home did not open a confirm dialog with confirm-no', true); return true; }
  await tap(page, 'confirm-no', run, input);
  await sleep(150);
  let a = await snapOf(page, false);
  if (a.screen !== 'play' || a.textbox !== where.text) run.fail(`confirm-no did not return to the same place (screen ${a.screen}, text "${snip(a.textbox, 40)}")`, true);
  await tap(page, 'home', run, input);
  try { await loc(page, 'confirm-yes').waitFor({ state: 'visible', timeout: 2000 }); } catch (e) { run.fail('second home press did not open the confirm dialog', true); return false; }
  await tap(page, 'confirm-yes', run, input);
  if (!(await waitScreen(page, 'title', 3000))) { run.fail('confirm-yes did not go to the title screen', true); return false; }
  if (!(await visible(page, 'continue'))) { run.fail('title screen has no "continue" button after leaving mid-route (SPEC 5.3 resume)', true); return false; }
  await tap(page, 'continue', run, input);
  if (!(await waitScreen(page, 'play', 3000))) { run.fail('"continue" did not return to the play screen', true); return false; }
  await sleep(100);
  a = await snapOf(page, false);
  if (where.beat != null && a.dbg && a.dbg.beatIndex !== where.beat) run.fail(`resume: beatIndex ${a.dbg.beatIndex}, expected ${where.beat}`, true);
  if (a.textbox !== where.text) run.warn(`resume: text after "continue" differs ("${snip(a.textbox, 40)}" vs "${snip(where.text, 40)}")`, true);
  if (where.choices && a.dbg && JSON.stringify(a.dbg.choices || {}) !== where.choices) run.fail('resume: choices differ after "continue"', true);
  return true;
}

async function cursorCheck(page, run) {
  // SPEC 5.6: the mouse cursor hides after a few seconds of inactivity.
  const x = 960;
  const y = 260;
  await page.mouse.move(x - 40, y);
  await page.mouse.move(x, y);
  await sleep(4500);
  const cur = await page.evaluate(([px, py]) => {
    const el = document.elementFromPoint(px, py);
    return el ? getComputedStyle(el).cursor : null;
  }, [x, y]);
  if (cur !== 'none') run.warn(`TV: mouse cursor still "${cur}" after 4.5 s without movement (SPEC 5.6: hide after a few seconds)`, true);
  else run.note('mouse cursor hides after 4.5 s idle');
}

async function escMenuCheck(page, run, args) {
  // SPEC 5.6: Esc opens the menu; a second Esc (or the dialog's own button) closes it.
  const before = await snapOf(page, true);
  await page.keyboard.press('Escape');
  await sleep(250);
  const a = await snapOf(page, true);
  const opened = a.ids.includes('confirm-yes') || a.ids.includes('speed-instant') || (a.tv && a.tv.dialogOpen) || a.ids.some((x) => /menu/i.test(x) && !before.ids.includes(x));
  if (!opened) { run.warn('keyboard: Esc did not open a menu or dialog (SPEC 5.6)', true); return; }
  run.note(`Esc opened: ${a.ids.filter((x) => !before.ids.includes(x)).join(', ') || 'a dialog'}`);
  await page.keyboard.press('Escape');
  await sleep(250);
  let c = await snapOf(page, false);
  if (c.ids.includes('confirm-yes') || c.ids.includes('speed-instant')) {
    run.warn('keyboard: a second Esc did not close the menu', true);
    if (c.ids.includes('confirm-no')) await keyActivate(page, 'confirm-no', run);
    else if (c.ids.includes('settings-close')) await keyActivate(page, 'settings-close', run);
    await sleep(150);
    c = await snapOf(page, false);
  }
  if (c.screen !== before.screen || c.textbox !== before.textbox) run.fail(`keyboard: opening and closing the Esc menu moved the story (screen ${before.screen} -> ${c.screen})`, true);
}

async function fullscreenKeyCheck(page, run) {
  const before = await page.evaluate(() => !!document.fullscreenElement);
  await page.keyboard.press('f');
  await sleep(300);
  const on = await page.evaluate(() => !!document.fullscreenElement);
  if (on === before) { run.warn('keyboard: F did not toggle fullscreen (SPEC 5.6; headless Chromium may block it)', true); return; }
  await page.keyboard.press('f');
  await sleep(300);
  const off = await page.evaluate(() => !!document.fullscreenElement);
  if (off !== before) run.warn('keyboard: a second F did not leave fullscreen', true);
  else run.note('F toggles fullscreen on and off');
}

// ---------------------------------------------------------------------------------------------
// Extra page checks

async function titleSmoke(browser, R, base, args, data) {
  const out = [];
  const { context, page, log } = await newPage(browser, R, { profile: 'phone', stepTimeout: args.stepTimeout });
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
    await tap(page, 'gallery-open', null, 'touch');
    if (await waitScreen(page, 'gallery', 3000)) {
      const n = await page.locator('[data-testid^="gallery-cell-"]').count();
      out.push(n === 9 ? 'ok   gallery opens from the title with 9 cells' : `FAIL gallery from title shows ${n} cells (expected 9)`);
      const back = (await visible(page, 'gallery-home')) ? 'gallery-home' : (await visible(page, 'home')) ? 'home' : null;
      if (back) {
        await tap(page, back, null, 'touch');
        out.push((await waitScreen(page, 'title', 3000)) ? `ok   "${back}" returns from the gallery to the title` : `FAIL "${back}" did not return to the title`);
      } else out.push('FAIL no home/gallery-home button on the gallery');
    } else out.push('FAIL gallery-open did not open the gallery screen');
    for (const rid of ROUTE_IDS.filter((r) => data.routes[r])) {
      await page.goto(base + `index.html?test=1#${rid}`, { waitUntil: 'load', timeout: 20000 });
      const ok = await waitScreen(page, ['play'], 4000);
      const s = ok ? await snapOf(page, false) : null;
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
    for (const pe of log.pageErrors) out.push(`FAIL page error (title/deep-link/debug checks): ${pe}`);
    for (const r of log.requestFailed) out.push(`FAIL failed request: ${r}`);
    await context.close().catch(() => {});
  }
  return out;
}

async function teacherCheck(browser, R, base, args) {
  const out = [];
  const modes = [
    { name: 'phone 390x844', profile: 'phone', shot: 'teacher-phone.png' },
    { name: 'TV 1920x1080', profile: 'tv1080', shot: 'teacher-tv.png' }
  ];
  for (const mode of modes) {
    const { context, page, log } = await newPage(browser, R, { profile: mode.profile, stepTimeout: args.stepTimeout });
    try {
      const resp = await page.goto(base + 'teacher.html', { waitUntil: 'load', timeout: 20000 });
      if (!resp || resp.status() !== 200) { out.push(`FAIL teacher.html (${mode.name}) returned ${resp ? resp.status() : 'no response'}`); continue; }
      await sleep(600);
      const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, title: document.title, text: (document.body.innerText || '').length }));
      if (m.sw > m.iw + 1) out.push(`WARN teacher.html (${mode.name}) overflows horizontally (scrollWidth ${m.sw} > ${m.iw})`);
      if (m.text < 200) out.push(`WARN teacher.html (${mode.name}) shows very little text (${m.text} chars)`);
      if (args.shots) await shot(page, path.join(args.shotDir, mode.shot), R);
      for (const c of log.console) out.push(`FAIL teacher.html (${mode.name}) console error: ${c}`);
      for (const pe of log.pageErrors) out.push(`FAIL teacher.html (${mode.name}) page error: ${pe}`);
      for (const r of log.requestFailed) out.push(`FAIL teacher.html (${mode.name}) failed request: ${r}`);
      if (!log.console.length && !log.pageErrors.length && !log.requestFailed.length) out.push(`ok   teacher.html (${mode.name}) loads without console errors ("${snip(m.title, 50)}")`);
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

function fmtPx(x) { return Number.isFinite(x) ? x.toFixed(1) : '-'; }

function formatReport(R, ctx) {
  const L = [];
  const failedRuns = R.runs.filter((r) => r.result === 'FAIL');
  const globalFails = R.global.failures.length;
  const pass = !failedRuns.length && !globalFails && R.runs.length > 0;
  L.push('Before He Stood - browser playtest (tools/playtest.mjs)');
  L.push(`Date: ${new Date().toISOString().replace('T', ' ').slice(0, 19)}Z   Node ${process.version}   Playwright ${ctx.pwVersion || '?'} (${ctx.pwFrom || '?'})`);
  L.push(`Browser: Chromium ${ctx.browserVersion || '?'} (${ctx.launchHow || '?'}); external requests blocked (offline check)`);
  L.push('Profiles: phone 390x844 isMobile+touch DPR2 | tv1080 1920x1080 DPR1 mouse/keyboard | tv720 1280x720 DPR1 mouse');
  L.push(`Server: ${ctx.base || '-'} (tools/serve.mjs)   Root: ${ctx.root}`);
  L.push(`Duration: ${elapsedMin().toFixed(1)} min`);
  L.push('');
  L.push(`Summary: ${R.runs.length} runs, ${R.runs.length - failedRuns.length} passed, ${failedRuns.length} failed; ${globalFails} other failure(s); ${R.screensChecked} screen snapshots checked  ->  ${pass ? 'PASS' : 'FAIL'}`);
  if (ctx.skipped.length) L.push(`Skipped: ${ctx.skipped.join('; ')}`);
  L.push('');
  L.push('Runs');
  L.push('  ' + [pad('route/strategy@profile', 28), pad('picks', 11), pad('expected', 14), pad('observed', 9), pad('ending card', 30), pad('steps', 6), pad('time', 7), 'result'].join(' '));
  for (const r of R.runs) {
    const picks = CHOICE_IDS.map((c) => r.made[c] || '-').join('');
    const exp = r.expected ? `${r.expected.lens}${r.expected.mismatch ? ' (mismatch)' : ''}` : '-';
    L.push('  ' + [pad(r.where, 28), pad(picks, 11), pad(exp, 14), pad(r.observed == null ? '-' : r.observed, 9), pad(snip(r.title, 28), 30), pad(r.steps, 6), pad((r.ms / 1000).toFixed(1) + 's', 7), r.result].join(' '));
  }
  const tvRuns = R.runs.filter((r) => PROFILES[r.profile] && PROFILES[r.profile].tv);
  if (tvRuns.length) {
    L.push('');
    L.push('TV metrics (SPEC 5.6; thresholds 1080p story >= 36 px, options >= 30 px; 720p 24 / 20 px; panel top >= 60%)');
    L.push('  ' + [pad('run', 28), pad('story min', 10), pad('en line min', 12), pad('option min', 11), pad('panel top min', 14), pad('sign/last top', 14), pad('outside viewport', 17), 'keys that advanced'].join(' '));
    for (const r of tvRuns) {
      const keys = r.input === 'keyboard' ? Object.keys(r.keys.ok).map((k) => `${k}x${r.keys.ok[k]}`).join(' ') : '-';
      const pctOf = (x) => (Number.isFinite(x) ? x.toFixed(0) + '%' : '-');
      L.push('  ' + [pad(r.where, 28), pad(fmtPx(r.tvm.storyMin), 10), pad(fmtPx(r.tvm.storyEnMin), 12), pad(fmtPx(r.tvm.optionMin), 11), pad(pctOf(r.tvm.panelTopMin), 14), pad(pctOf(r.tvm.specialTopMin), 14), pad(r.tvm.offenders, 17), keys].join(' '));
    }
    L.push('  (sign captions and the large ending line are centered by design and exempt from the 60% rule; their top is listed for review)');
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
    console.log('Usage: node tools/playtest.mjs [--route scribe,friend,asher] [--strategies a,d,b,r1,r2,far] [--profiles phone,tv1080,tv720] [--no-keyboard] [--quick] [--root DIR] [--headed] [--no-dist] [--no-teacher] [--no-shots] [--step-timeout MS] [--run-timeout S] [--budget-min N]');
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
  // Failure screenshots from earlier runs would be misleading; other screenshots are overwritten by name.
  for (const f of fs.readdirSync(args.shotDir)) if (/^FAIL-.*\.png$/.test(f)) fs.rmSync(path.join(args.shotDir, f), { force: true });
  let srv;
  let browser;
  try {
    srv = await startServer({ root, port: 0 });
    ctx.base = srv.url;
    const launched = await launchBrowser(pwInfo.pw, args.headed);
    browser = launched.browser;
    ctx.launchHow = launched.how;
    ctx.browserVersion = browser.version();
    const plan = buildPlan(routes, args);
    // Writers may still be editing: reload the data before every run so the reference matches what the browser loads.
    const freshData = () => {
      const d = loadProject(root, new Report(), { partial: true }).data;
      return isObj(d.routes) ? d : data;
    };
    console.log(`playtest: serving ${root} at ${srv.url}; Chromium ${ctx.browserVersion}; ${plan.length} runs planned`);
    ctx.titleSmoke = await withTimeout(titleSmoke(browser, R, srv.url, args, data), 90000, () => ['FAIL title smoke test timed out after 90 s']);
    const firstOf = new Set();
    let first = true;
    for (const p of plan) {
      const label = runLabel(p);
      if (elapsedMin() > args.budgetMin) { ctx.skipped.push(`${label} (time budget of ${args.budgetMin} min used up)`); continue; }
      process.stdout.write(`  ${pad(label, 28)} ... `);
      const firstOfProfile = !firstOf.has(p.profile);
      firstOf.add(p.profile);
      const runData = freshData();
      if (!isObj(runData.routes[p.rid])) { ctx.skipped.push(`${label} (route data failed to load)`); continue; }
      p.special = specialTexts(runData);
      const cfg = { url: srv.url + 'index.html?test=1', data: runData, args, p, firstOfProfile, settingsCheck: first };
      first = false;
      const run = await withTimeout(playRun(browser, R, cfg), args.runTimeout * 1000, () => {
        const r = newRun(p);
        r.result = 'FAIL';
        r.fail(`run timed out after ${args.runTimeout} s`);
        r.ms = args.runTimeout * 1000;
        return r;
      });
      R.runs.push(run);
      console.log(`${run.result} (${(run.ms / 1000).toFixed(1)}s, ${run.steps} steps${run.failures.length ? ', ' + run.failures.length + ' failure(s): ' + snip(run.failures[0], 90) : ''})`);
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
      const distData = freshData();
      const p = { rid, st: makeStrategy(rid, 'a'), profile: 'tv1080', input: 'mouse', lang: 'both', shots: false, special: specialTexts(distData) };
      const label = `dist:${rid}/a@tv1080`;
      const cfg = { url: pathToFileURL(distFile).href + '?test=1', data: distData, args, p, fileMode: true, label };
      // A bundle older than its sources plays stale text (and will not match the reference transcript).
      const builtAt = fs.statSync(distFile).mtimeMs;
      const sources = ['index.html', 'css/style.css'].concat(...['data', 'data/routes', 'js'].map((d) => {
        try { return fs.readdirSync(path.join(root, d)).filter((f) => /\.(js|css)$/.test(f)).map((f) => d + '/' + f); } catch (e) { return []; }
      }));
      const newer = sources.filter((f) => { try { return fs.statSync(path.join(root, f)).mtimeMs > builtAt + 1000; } catch (e) { return false; } });
      if (newer.length) R.warn(`dist/before-he-stood.html is older than ${newer.slice(0, 4).join(', ')}${newer.length > 4 ? ` and ${newer.length - 4} more` : ''}; rebuild with node tools/build-single.mjs`);
      process.stdout.write(`  ${pad(label, 28)} ... `);
      const run = await withTimeout(playRun(browser, R, cfg), args.runTimeout * 1000, () => {
        const r = newRun(p);
        r.where = label;
        r.result = 'FAIL';
        r.fail(`run timed out after ${args.runTimeout} s`);
        return r;
      });
      R.runs.push(run);
      console.log(`${run.result} (${(run.ms / 1000).toFixed(1)}s)`);
      ctx.distLine = `${run.result}: played ${rid} with strategy "a" at 1920x1080 from file:// (${run.steps} steps)`;
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
