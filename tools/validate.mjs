#!/usr/bin/env node
/*
 * tools/validate.mjs - data validator for "Before He Stood" (SPEC version 3: short routes).
 * Owner: engine + tools agent. Node 22+, no npm dependencies.
 *
 * Route rules checked (SPEC 4.5, 5.1, 8): exactly 4 choices c1-c4, the last counts double; lens balance;
 * cut options (scribe and friend: exactly one, in c2 or c3, lens null, endings.cut required; asher: none);
 * all 4^4 = 256 paths enumerated for the ending shares (cut <= 25%, each lens 20-50% of the non-cut paths),
 * the screen budget (<= 32 screens on every path), the crowd order (every non-cut path), the passerby
 * line, ending lengths and reading time; the engine (js/engine.js) is cross-checked against the
 * reference scoring and, step by step, against the reference simulation on every path.
 *
 * Usage:
 *   node tools/validate.mjs [--route scribe|friend|asher] [--json] [--partial]
 *                           [--root DIR] [--no-write] [--selftest]
 *
 *   --route     run route-level checks for one route only (global checks always run)
 *   --json      print the report as JSON instead of text
 *   --partial   work-in-progress mode: a missing route file is a WARN instead of an ERROR
 *   --root      project root (default: the parent folder of tools/)
 *   --no-write  do not write qa/reports/validate.txt
 *   --selftest  run the built-in fixture tests and exit
 *
 * The data files are classic scripts (IIFE writing to window.BHS). They are loaded
 * in a node:vm context with a `window` shim, in the same order as index.html.
 *
 * Exit code: 1 if any ERROR was reported, 0 otherwise, 2 on an internal failure.
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_ROOT = path.resolve(HERE, '..');

export const ROUTE_IDS = ['scribe', 'friend', 'asher'];
export const OPTION_IDS = ['a', 'b', 'c', 'd'];
// SPEC 4.5 (version 3): exactly four choices, c1-c4; the last one (c4) counts double.
export const CHOICE_COUNT = 4;
export const CHOICE_IDS = Array.from({ length: CHOICE_COUNT }, (_, i) => 'c' + (i + 1));
export const LAST_CHOICE = CHOICE_IDS[CHOICE_COUNT - 1];
export const PATH_COUNT = 4 ** CHOICE_COUNT;
const LENSES = [1, 2, 3];
// Cut endings (SPEC 4.5): these routes have exactly one cut option, in one of CUT_CHOICES; the others none.
export const CUT_ROUTES = ['scribe', 'friend'];
const CUT_CHOICES = ['c2', 'c3'];
// Budgets (SPEC 3.3 / 8). Screens: ERROR above 32 on any path; WARN when a path exceeds 31 (31 is
// expected on a path that shows the mismatch line) or when the median non-cut path exceeds 30.
// Ending shares over the 256 paths: cut <= 25%; each lens 20-50% of the non-cut paths (WARN outside),
// 15-55% (ERROR outside).
const SCREENS = { max: 32, warn: 31, medianMax: 30, target: [24, 30] };
const SHARE = { cutMax: 0.25, warn: [0.20, 0.50], error: [0.15, 0.55] };
// Ending lengths in screens (SPEC 4.5): lens endings 1-3 beats, cut endings 2-4 beats, each plus the last line.
const ENDING_BEATS = { lens: [1, 3], cut: [2, 4] };
const BEAT_TYPES = ['scene', 'line', 'verse', 'choice', 'fx', 'press'];
const PSEUDO_SPEAKERS = ['narrator', 'thought', 'sign'];
const VERSE_SPEAKERS = ['jesus', 'scribes', 'narrator'];
const POV_VALUES = ['normal', 'lying', 'standing'];
const TIME_VALUES = ['day', 'evening', 'night'];
const LIGHT_LEVELS = ['off', 'soft', 'bright'];

// Fallbacks used when docs/SPEC.md cannot be parsed.
const FALLBACK = {
  bgIds: ['black', 'dawn_lamp', 'shore_dawn', 'asher_ceiling', 'asher_home', 'lane', 'sky_carried', 'crowd',
    'crowd_lying', 'road_home', 'doorway_evening', 'lamp_night'],
  forbidden: ['메나헴', '므나햄', '하넌', '요나스', '아셰르',
    '아쉐르', 'Menachem', 'Jonah', 'Asel', 'Asser'],
  passerby: {
    ko: '고통 뒤에 무슨 사연이 있는지 누가 알겠어. ' +
      '저 사람은 무슨 잘못을 했기에 저렇게 됐을까.',
    en: "Who knows what's behind suffering like that. What did he do to end up like that?"
  },
  limits: {
    line: { ko: [80, 110], en: [150, 200] },
    option: { ko: [45, 60], en: [90, 120] },
    prompt: { ko: [50, 70], en: [100, 130] }
  }
};

// FX names and their allowed parameters (SPEC 4.5).
const FX_PARAMS = {
  light: ['level'],
  hush: [],
  echoVerse: ['key', 'highlight'],
  pinThought: ['items'],
  readReceipt: [],
  unpinThought: [],
  pov: ['pov'],
  actionReply: ['action', 'text'],
  actionsHide: [],
  actionsShow: []
};
// The route each FX was designed for (used for INFO notes only).
const FX_HOME = {
  hush: 'scribe', echoVerse: 'scribe', pinThought: 'scribe', readReceipt: 'scribe', unpinThought: 'scribe',
  pov: 'asher', actionReply: 'asher', actionsHide: 'asher', actionsShow: 'asher'
};
const BEAT_KEYS = {
  scene: ['type', 'bg', 'caption', 'pov', 'time', 'when', 'id'],
  line: ['type', 'speaker', 'text', 'when', 'id'],
  verse: ['type', 'key', 'speaker', 'when', 'id'],
  choice: ['type', 'id', 'prompt', 'options', 'when'],
  fx: ['type', 'fx', 'when', 'id'],
  press: ['type', 'action', 'label', 'hint', 'when', 'id']
};
const OPTION_KEYS = ['id', 'text', 'lens', 'set', 'reaction', 'cut'];
const ROUTE_KEYS = ['id', 'actions', 'beats', 'endingPreface', 'endings', 'endingCoda'];

// The fixed crowd sequence (SPEC 6.4). Each key maps to an event group; sub-order is checked separately.
const EVENT_GROUP = {
  MT_9_1: 1, MT_9_2A: 2, MT_9_2B: 3, MT_9_2B1: 3, MT_9_2B2: 3, MT_9_3: 4, MT_9_3Q: 4,
  MT_9_4: 5, MT_9_4N: 5, MT_9_4Q: 5, MT_9_5: 6, MT_9_6A: 7, MT_9_6N: 7, MT_9_6B: 7, MT_9_7: 8, MT_9_8: 9
};
const EVENT_LABEL = {
  1: '9:1 boat', 2: '9:2a brought', 3: '9:2b first words', 4: '9:3 scribes', 5: '9:4 answer',
  6: '9:5 which is easier', 7: '9:6 authority + rise', 8: '9:7 rose', 9: '9:8 crowd'
};
const SUB_ORDER = [['MT_9_2B1', 'MT_9_2B2'], ['MT_9_4N', 'MT_9_4Q'], ['MT_9_6A', 'MT_9_6N'], ['MT_9_6N', 'MT_9_6B'],
  ['MT_9_6A', 'MT_9_6B']];

const BOOKS = {
  MT: ['마', 'Matt'], MK: ['막', 'Mark'], LK: ['눅', 'Luke'], JN: ['요', 'John'],
  PS: ['시', 'Ps'], DT: ['신', 'Deut'], IS: ['사', 'Isa'], LV: ['레', 'Lev'],
  SA2: ['삼하', '2 Sam'], KI1: ['왕상', '1 Kgs'], JB: ['욥', 'Job']
};

// Character classes. Hangul syllables, jamo, and compatibility jamo.
const HANGUL_RE = /[ᄀ-ᇿ㄰-㆏가-힣]/g;
const HANGUL_TEST = /[ᄀ-ᇿ㄰-㆏가-힣]/;
const LATIN_RE = /[A-Za-z]/g;
export const TOKEN_RE = /\{\{(v|r|var):([A-Za-z0-9_]+)\}\}/g;

// Story-text heuristics (player-facing story text only). Comments stay in English, so each
// Korean pattern's meaning is given in the comment above it.
// ko mechanics words: cham/jin/good/bad/happy ending, "ending", "score", "lens", "correct answer".
const MECH_KO = /(참|진|좋은|나쁜|배드|해피|굿)\s?엔딩|엔딩|점수|렌즈|정답/;
const MECH_EN = /\b(true|good|bad|happy|best|real|secret)\s+ending\b|\bending\b(?!\s+up)|\bscores?\b|\b\d+\s*points?\b|\blens(es)?\b|\bcorrect answer\b/i;
// ko "four people" (Mark 2:3): "ne myeong" (not followed by ryeong/ye/dan), "net-iseo", "ne saram-i".
const FOUR_KO = /네\s?명(?![령예단])|넷이서|네 사람이/;
const FOUR_EN = /\bfour\s+(men|of them|friends|people|carriers|bearers)\b/i;
// ko "roof".
const ROOF_KO = /지붕/;
// The idioms "a roof of his own" / "a roof over his head" (homelessness) are not Mark's roof.
const ROOF_EN = /\broof\b(?!\s+(of\s+(his|her|their|my|your|one's)\s+own|over\s+\S+\s+head))/i;
// Mark 2:7 wording: ko "hananim han bun oe-e", "nuga neunghi joe-reul saha".
const MK27_KO = /하나님\s?한\s?분\s?외에|누가\s?능히\s?죄를\s?사하/;
const MK27_EN = /\bbut god alone\b|\bwho can forgive sins but\b/i;
// Talmud (Nedarim 41a) must not be quoted in first-century scenes.
const TALMUD = /탈무드|네다림|Talmud|Nedarim/i;
// Mentions of Jesus, gestures/emotions, and other people (to limit false positives).
const JESUS_REF = /예수님|예수께서|예수라는|그분|\bJesus\b/;
const GESTURE = /미소|웃으|웃는|웃었|끄덕|한숨|눈물|울먹|\bsmil|\blaugh|\bnod(s|ded)?\b|\bsigh|\bgrin|\bwink|\btears?\b|\bwept\b/i;
const OTHER_PEOPLE = /아셀|요나|므나헴|하난|어머니|동생|\bAsher\b|\bYonah\b|\bMenahem\b|\bHanan\b|\bMom\b|\bbrother\b/;
const MARK_LABEL = /MK_\d|마가|\bMark\b/;
const QUOTE_BEFORE = /["“'‘「『]$/;
const QUOTE_AFTER = /^["”'’」』]/;

// ---------------------------------------------------------------------------------------------
// Small helpers

export function isObj(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }
function isT(x) { return isObj(x) && typeof x.ko === 'string' && typeof x.en === 'string'; }
function snip(s, n = 34) {
  s = String(s == null ? '' : s).replace(/\s+/g, ' ');
  return s.length > n ? s.slice(0, n) + '…' : s;
}
function cpLen(s) { return Array.from(s).length; }
function stripTokens(s) { return String(s).replace(TOKEN_RE, ' '); }
function countRe(s, re) { const m = String(s).match(re); return m ? m.length : 0; }
function pct(x) { return (x * 100).toFixed(1) + '%'; }
export function median(arr) {
  const a = [...arr].sort((x, y) => x - y);
  const n = a.length;
  if (!n) return 0;
  return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
}
export function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pad(s, n) { s = String(s); return s.length >= n ? s : s + ' '.repeat(n - s.length); }
function padL(s, n) { s = String(s); return s.length >= n ? s : ' '.repeat(n - s.length) + s; }

// ---------------------------------------------------------------------------------------------
// Report

export class Report {
  constructor() {
    this.findings = [];
    this.stats = [];
    this.files = [];
    this.seen = new Set();
  }
  add(level, code, where, msg) {
    const key = level + '|' + code + '|' + where + '|' + msg;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.findings.push({ level, code, where, msg });
  }
  error(code, where, msg) { this.add('ERROR', code, where, msg); }
  warn(code, where, msg) { this.add('WARN', code, where, msg); }
  info(code, where, msg) { this.add('INFO', code, where, msg); }
  count(level) { return this.findings.filter((f) => f.level === level).length; }
  has(level, code, re) {
    return this.findings.some((f) => f.level === level && (!code || f.code === code) &&
      (!re || re.test(f.msg + ' ' + f.where)));
  }
  section(title, lines) { this.stats.push({ title, lines }); }
}

// ---------------------------------------------------------------------------------------------
// SPEC parsing (keeps the validator in sync with docs/SPEC.md)

export function parseSpec(root) {
  const out = { ok: false, keys: new Map(), refOnlyRefs: new Map(), bgIds: null, forbidden: null, passerby: null, limits: null };
  let src;
  try { src = fs.readFileSync(path.join(root, 'docs', 'SPEC.md'), 'utf8'); } catch (e) { return out; }
  out.ok = true;
  let section = '';
  for (const ln of src.split('\n')) {
    const h = ln.match(/^#{2,4}\s+(\d+(?:\.\d+)*)\s/);
    if (h) section = h[1];
    if (section === '4.3') {
      const m = ln.match(/^\|\s*([A-Z][A-Z0-9]*_[0-9][A-Z0-9_]*)\s*\|(.*)\|\s*$/);
      if (m) {
        const cells = m[2].split('|').map((s) => s.trim());
        const sp = cells.find((c) => VERSE_SPEAKERS.includes(c)) || null;
        out.keys.set(m[1], { speaker: sp, refOnly: false });
      }
      if (/^Reference-only/.test(ln)) {
        for (const mm of ln.matchAll(/([A-Z][A-Z0-9]*_[0-9][0-9_]*)\s*\(([^)]+)\)/g)) {
          out.keys.set(mm[1], { speaker: null, refOnly: true });
          out.refOnlyRefs.set(mm[1], mm[2].trim());
        }
      }
    }
    if (section === '6.6') {
      const m = ln.match(/^\|\s*([a-z][a-z_]*)\s*\|/);
      if (m) (out.bgIds = out.bgIds || []).push(m[1]);
    }
    if (section === '6.5' && /Forbidden variants/.test(ln)) {
      const after = ln.split(':').slice(1).join(':');
      out.forbidden = after.split(',').map((s) => s.replace(/\(.*?\)/g, '').replace(/[.`]/g, '').trim()).filter(Boolean);
    }
    if (section === '6.3') {
      let m = ln.match(/KO:\s*「(.+)」/);
      if (m) (out.passerby = out.passerby || {}).ko = m[1];
      m = ln.match(/EN:\s*"(.+)"\s*$/);
      if (m) (out.passerby = out.passerby || {}).en = m[1];
    }
    if (section === '3.3') {
      const m = ln.match(/^\|\s*(line text|option text|choice prompt)\s*\|\s*(\d+)\s*\/\s*(\d+)[^|]*\|\s*(\d+)\s*\/\s*(\d+)/);
      if (m) {
        const k = m[1].startsWith('line') ? 'line' : m[1].startsWith('option') ? 'option' : 'prompt';
        (out.limits = out.limits || {})[k] = { ko: [+m[2], +m[3]], en: [+m[4], +m[5]] };
      }
    }
  }
  return out;
}

function canonFromSpec(spec) {
  return {
    bgIds: spec.bgIds && spec.bgIds.length >= 8 ? spec.bgIds : FALLBACK.bgIds,
    forbidden: spec.forbidden && spec.forbidden.length ? spec.forbidden : FALLBACK.forbidden,
    passerby: spec.passerby && spec.passerby.ko && spec.passerby.en ? spec.passerby : FALLBACK.passerby,
    limits: Object.assign({}, FALLBACK.limits, spec.limits || {})
  };
}

function expectedRef(key, spec) {
  const m = key.match(/^([A-Z]+[0-9]?)_(\d+)_(\d+)(?:_(\d+))?([A-Z][A-Z0-9]*)?$/);
  if (!m || !BOOKS[m[1]]) return null;
  const [ko, en] = BOOKS[m[1]];
  const specKo = spec.refOnlyRefs.get(key);
  if (specKo && /장$/.test(specKo)) {
    // Chapter range such as "Lev 13-15".
    return { ko: specKo.replace(/-/g, '–'), en: en + ' ' + m[2] + '–' + m[3] };
  }
  const v = m[4] ? m[3] + '–' + m[4] : m[3];
  return { ko: ko + ' ' + m[2] + ':' + v, en: en + ' ' + m[2] + ':' + v };
}

// ---------------------------------------------------------------------------------------------
// Lexer for comments and code (strings/comments blanked) - used for the comment-language check
// and for classic-script checks (import/export/fetch, ES2020+ syntax).

export function lexJs(src) {
  const n = src.length;
  const code = [];
  const comments = [];
  const stack = [];
  let depth = 0;
  let i = 0;
  let prevValue = false;
  const blank = (from, to) => { for (let k = from; k < to; k++) code.push(src[k] === '\n' ? '\n' : ' '); };
  const readTemplate = () => {
    while (i < n) {
      const c = src[i];
      if (c === '\\') { blank(i, Math.min(n, i + 2)); i += 2; continue; }
      if (c === '`') { code.push('`'); i++; return 'end'; }
      if (c === '$' && src[i + 1] === '{') { code.push('$', '{'); i += 2; stack.push(depth); depth++; return 'expr'; }
      code.push(c === '\n' ? '\n' : ' ');
      i++;
    }
    return 'end';
  };
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '\n' || c === ' ' || c === '\t' || c === '\r') { code.push(c); i++; continue; }
    if (c === '/' && d === '/') {
      let j = src.indexOf('\n', i);
      if (j < 0) j = n;
      comments.push({ text: src.slice(i + 2, j), index: i });
      blank(i, j);
      i = j;
      continue;
    }
    if (c === '/' && d === '*') {
      let j = src.indexOf('*/', i + 2);
      const end = j < 0 ? n : j + 2;
      comments.push({ text: src.slice(i + 2, j < 0 ? n : j), index: i });
      blank(i, end);
      i = end;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c) {
        if (src[j] === '\\') j++;
        else if (src[j] === '\n') break;
        j++;
      }
      j = Math.min(n, j + 1);
      code.push(c);
      blank(i + 1, j - 1);
      code.push(c);
      i = j;
      prevValue = true;
      continue;
    }
    if (c === '`') {
      code.push('`');
      i++;
      prevValue = readTemplate() === 'end';
      continue;
    }
    if (c === '{') { depth++; code.push(c); i++; prevValue = false; continue; }
    if (c === '}') {
      if (stack.length && stack[stack.length - 1] === depth - 1) {
        depth--;
        stack.pop();
        code.push(c);
        i++;
        prevValue = readTemplate() === 'end';
        continue;
      }
      depth--;
      code.push(c);
      i++;
      prevValue = true;
      continue;
    }
    if (c === '/') {
      if (prevValue) { code.push(c); i++; prevValue = false; continue; }
      let j = i + 1;
      let inClass = false;
      while (j < n) {
        const e = src[j];
        if (e === '\\') { j += 2; continue; }
        if (e === '\n') break;
        if (inClass) { if (e === ']') inClass = false; } else if (e === '[') inClass = true; else if (e === '/') break;
        j++;
      }
      j = Math.min(n, j + 1);
      while (j < n && /[a-z]/i.test(src[j])) j++;
      code.push('/');
      blank(i + 1, j);
      i = j;
      prevValue = true;
      continue;
    }
    if (/[A-Za-z_$0-9]/.test(c) || c > '\x7f') {
      let j = i;
      while (j < n && (/[A-Za-z_$0-9]/.test(src[j]) || src[j] > '\x7f')) j++;
      const w = src.slice(i, j);
      code.push(w);
      i = j;
      prevValue = !/^(return|typeof|case|do|else|in|of|new|delete|void|throw|instanceof|yield|await)$/.test(w);
      continue;
    }
    if (c === ')' || c === ']') { code.push(c); i++; prevValue = true; continue; }
    code.push(c);
    i++;
    prevValue = false;
  }
  return { code: code.join(''), comments };
}

function lineAt(src, index) {
  let line = 1;
  for (let k = 0; k < index && k < src.length; k++) if (src.charCodeAt(k) === 10) line++;
  return line;
}

function scanSourceFile(rep, root, rel) {
  let src;
  try { src = fs.readFileSync(path.join(root, rel), 'utf8'); } catch (e) { return; }
  const ext = path.extname(rel);
  const comments = [];
  const codeChunks = [];
  if (ext === '.js' || ext === '.mjs') {
    const lx = lexJs(src);
    lx.comments.forEach((c) => comments.push({ text: c.text, line: lineAt(src, c.index) }));
    codeChunks.push({ code: lx.code, offset: 0 });
  } else if (ext === '.css') {
    for (const m of src.matchAll(/\/\*([\s\S]*?)\*\//g)) comments.push({ text: m[1], line: lineAt(src, m.index) });
  } else if (ext === '.html') {
    for (const m of src.matchAll(/<!--([\s\S]*?)-->/g)) comments.push({ text: m[1], line: lineAt(src, m.index) });
    for (const m of src.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (/\bsrc\s*=/.test(m[1])) continue;
      const off = m.index + m[0].indexOf('>') + 1;
      const lx = lexJs(m[2]);
      lx.comments.forEach((c) => comments.push({ text: c.text, line: lineAt(src, off + c.index) }));
      codeChunks.push({ code: lx.code, offset: off });
    }
    for (const m of src.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
      const off = m.index + m[0].indexOf('>') + 1;
      for (const c of m[1].matchAll(/\/\*([\s\S]*?)\*\//g)) comments.push({ text: c[1], line: lineAt(src, off + c.index) });
    }
  }
  const bad = comments.filter((c) => HANGUL_TEST.test(c.text));
  if (bad.length) {
    rep.warn('comment', rel, `Korean text in ${bad.length} code comment(s) (SPEC 0: comments in English only), first at line ` +
      `${bad[0].line}: "${snip(bad[0].text.trim(), 40)}"`);
  }
  const classic = /^(data|js)\//.test(rel) && ext === '.js';
  if (classic) {
    for (const ch of codeChunks) {
      const code = ch.code;
      const checks = [
        [/(^|[;\n])\s*import\s+[\w{*'"]/, 'ERROR', 'uses an import statement (classic scripts only, SPEC 2)'],
        [/(^|[;\n])\s*export\s+(default|const|let|var|function|class|\{)/, 'ERROR', 'uses an export statement (classic scripts only, SPEC 2)'],
        [/\bfetch\s*\(/, 'ERROR', 'calls fetch() (no network/fetch allowed, SPEC 0/2)'],
        [/\?\.(?!\d)/, 'WARN', 'uses optional chaining ?. (SPEC 2 targets ES2019)'],
        [/\?\?/, 'WARN', 'uses nullish coalescing ?? (SPEC 2 targets ES2019)'],
        [/(\|\||&&)=/, 'WARN', 'uses logical assignment (SPEC 2 targets ES2019)']
      ];
      for (const [re, level, msg] of checks) {
        const m = code.match(re);
        if (m) rep.add(level, 'script', `${rel}:${lineAt(src, ch.offset + m.index + (m[1] ? m[1].length : 0))}`, msg);
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Loading the project data in a vm context

const DATA_FILES = ['data/meta.js', 'data/characters.js', 'data/scripture.js', 'data/common.js', 'data/ui-strings.js'];

export function loadProject(root, rep, opts = {}) {
  const files = {};
  const sandbox = { console: { log() {}, info() {}, warn() {}, error() {}, debug() {} } };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  const ctx = vm.createContext(sandbox);
  const readRel = (rel) => {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) return null;
    const src = fs.readFileSync(abs, 'utf8');
    files[rel] = { src };
    return src;
  };
  const run = (rel, src) => {
    try {
      vm.runInContext(src, ctx, { filename: rel, timeout: 5000 });
      return null;
    } catch (e) {
      const where = (String(e.stack || '').match(new RegExp(rel.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + ':(\\d+)')) || [])[1];
      return `${e.name || 'Error'}: ${e.message}${where ? ' (line ' + where + ')' : ''}`;
    }
  };
  const status = [];
  for (const rel of DATA_FILES) {
    const src = readRel(rel);
    if (src == null) {
      status.push({ rel, status: 'MISSING' });
      if (rel === 'data/ui-strings.js') rep.info('load', rel, 'not present yet (engine agent); skipped');
      else if (rel === 'data/scripture.js') rep.warn('load', rel, 'missing; token keys are checked against the SPEC 4.3 key list');
      else rep.error('load', rel, 'missing');
      continue;
    }
    const err = run(rel, src);
    status.push({ rel, status: err ? 'LOAD ERROR' : 'OK', bytes: Buffer.byteLength(src) });
    if (err) rep.error('load', rel, err);
  }
  const BHS = sandbox.BHS || {};
  for (const rid of ROUTE_IDS) {
    const rel = `data/routes/${rid}.js`;
    if (opts.routeFilter && opts.routeFilter !== rid) continue;
    const src = readRel(rel);
    if (src == null) {
      status.push({ rel, status: 'MISSING' });
      if (opts.partial) rep.warn('load', rel, 'missing (route writer still working?); route checks skipped');
      else rep.error('load', rel, 'missing; route checks skipped (use --partial while writers are still working)');
      continue;
    }
    const before = Object.assign({}, (sandbox.BHS && sandbox.BHS.routes) || {});
    const err = run(rel, src);
    status.push({ rel, status: err ? 'LOAD ERROR' : 'OK', bytes: Buffer.byteLength(src) });
    if (err) { rep.error('load', rel, err); continue; }
    const after = (sandbox.BHS && sandbox.BHS.routes) || {};
    for (const k of Object.keys(after)) {
      if (k !== rid && before[k] !== after[k]) rep.warn('load', rel, `also defines or replaces BHS.routes.${k}`);
    }
    if (!after[rid]) rep.error('load', rel, `does not define BHS.routes.${rid}`);
  }
  // Optional: the engine, loaded after the data with the same window shim (SPEC 2: no DOM at load time).
  let engine = null;
  const engRel = 'js/engine.js';
  const engSrc = readRel(engRel);
  if (engSrc == null) {
    status.push({ rel: engRel, status: 'MISSING' });
    rep.info('engine', engRel, 'not present yet; computeLens cross-check skipped');
  } else {
    const err = run(engRel, engSrc);
    status.push({ rel: engRel, status: err ? 'LOAD ERROR' : 'OK', bytes: Buffer.byteLength(engSrc) });
    if (err) rep.error('engine', engRel, `failed to load in Node with a window shim (SPEC 2: no DOM access at load time): ${err}`);
    else if (!sandbox.BHS || !sandbox.BHS.engine) rep.error('engine', engRel, 'loaded but BHS.engine is not defined');
    else engine = sandbox.BHS.engine;
  }
  const B = sandbox.BHS || {};
  return {
    files,
    status,
    bhs: sandbox.BHS || null,
    data: {
      meta: B.meta, characters: B.characters, scripture: B.scripture, common: B.common, ui: B.ui,
      routes: B.routes || {}, engine
    }
  };
}

// ---------------------------------------------------------------------------------------------
// Lens scoring (SPEC 5.1) - the reference implementation shared with tools/playtest.mjs

function choiceNum(id) {
  const m = /^c(\d+)$/.exec(String(id));
  return m ? Number(m[1]) : -1;
}

// The double-weight choice: the highest cN among the route's choice beats.
export function lastChoiceOf(route) {
  let best = null;
  for (const b of (route && Array.isArray(route.beats) ? route.beats : [])) {
    if (!isObj(b) || b.type !== 'choice') continue;
    if (best === null || choiceNum(b.id) > choiceNum(best)) best = b.id;
  }
  return best;
}

export function isCutOption(o) { return isObj(o) && o.cut === true; }

export function lensTable(route) {
  // Returns { table, cuts, ok }: table[i][j] = lens of option j at choice c(i+1) (null if none),
  // cuts[i][j] = true when that option ends the route early (cut: true).
  const byId = {};
  for (const b of (route && Array.isArray(route.beats) ? route.beats : [])) {
    if (isObj(b) && b.type === 'choice' && typeof b.id === 'string' && !byId[b.id]) byId[b.id] = b;
  }
  let ok = true;
  const cuts = [];
  const table = CHOICE_IDS.map((cid) => {
    const b = byId[cid];
    const row = [];
    const cutRow = [];
    if (!b || !Array.isArray(b.options)) { ok = false; cuts.push([false, false, false, false]); return [null, null, null, null]; }
    for (const oid of OPTION_IDS) {
      const o = b.options.find((x) => isObj(x) && x.id === oid);
      if (!o) ok = false;
      row.push(o && LENSES.includes(o.lens) ? o.lens : null);
      cutRow.push(isCutOption(o));
    }
    cuts.push(cutRow);
    return row;
  });
  if (Object.keys(byId).length !== CHOICE_COUNT) ok = false;
  return { table, cuts, ok };
}

// Reference for BHS.engine.computeLens: each pick adds its weight (1; 2 for the last choice) to its
// lens; highest score wins; a tie goes to the last choice's lens if it is tied, else the smallest lens.
// A picked cut option gives the cut outcome: no lens, no mismatch.
export function computeLensFor(route, choices) {
  const scores = { 1: 0, 2: 0, 3: 0 };
  const lastId = lastChoiceOf(route);
  let lastLens = null;
  let cut = false;
  const seen = new Set();
  for (const b of (route && Array.isArray(route.beats) ? route.beats : [])) {
    if (!isObj(b) || b.type !== 'choice' || seen.has(b.id)) continue;
    seen.add(b.id);
    const pick = choices ? choices[b.id] : undefined;
    const o = Array.isArray(b.options) ? b.options.find((x) => isObj(x) && x.id === pick) : null;
    if (!o) continue;
    if (isCutOption(o)) cut = true;
    const lens = LENSES.includes(o.lens) ? o.lens : null;
    if (b.id === lastId) lastLens = lens;
    if (lens) scores[lens] += b.id === lastId ? 2 : 1;
  }
  if (cut) return { lens: null, scores, lastLens: null, c10Lens: null, mismatch: false, cut: true };
  const max = Math.max(scores[1], scores[2], scores[3]);
  const tied = LENSES.filter((l) => scores[l] === max);
  const lens = lastLens && tied.includes(lastLens) ? lastLens : tied[0];
  return { lens, scores, lastLens, c10Lens: lastLens, mismatch: lastLens !== null && lens !== lastLens, cut: false };
}

function lensFromTable(table, cuts, picks) {
  const L = table.length - 1;
  let cut = false;
  let s1 = 0;
  let s2 = 0;
  let s3 = 0;
  for (let c = 0; c <= L; c++) {
    if (cuts && cuts[c][picks[c]]) cut = true;
    const l = table[c][picks[c]];
    const w = c === L ? 2 : 1;
    if (l === 1) s1 += w; else if (l === 2) s2 += w; else if (l === 3) s3 += w;
  }
  if (cut) return { lens: null, last: null, tie: false, cut: true };
  const last = table[L][picks[L]];
  const max = Math.max(s1, s2, s3);
  const tied = [];
  if (s1 === max) tied.push(1);
  if (s2 === max) tied.push(2);
  if (s3 === max) tied.push(3);
  const lens = last && tied.includes(last) ? last : tied[0];
  return { lens, last, tie: tied.length > 1, cut: false };
}

// Every combination of picks (4^4 = 256). A path that picks a cut option counts as a cut path even if
// later picks exist in the combination (they are never asked in play).
export function* allPicks(n = CHOICE_COUNT) {
  const picks = new Array(n).fill(0);
  const N = 4 ** n;
  for (let k = 0; k < N; k++) {
    let m = k;
    for (let c = 0; c < n; c++) { picks[c] = m & 3; m >>= 2; }
    yield picks;
  }
}

export function picksToChoices(picks) {
  return Object.fromEntries(CHOICE_IDS.map((c, i) => [c, OPTION_IDS[picks[i]]]));
}

export function enumerateEndings(table, cuts) {
  const res = { total: 0, counts: { 1: 0, 2: 0, 3: 0 }, cut: 0, mismatch: 0, ties: 0, byLast: [0, 1, 2, 3].map(() => ({ 1: 0, 2: 0, 3: 0, cut: 0, n: 0 })) };
  const L = table.length - 1;
  for (const picks of allPicks(table.length)) {
    const r = lensFromTable(table, cuts, picks);
    res.total++;
    const bl = res.byLast[picks[L]];
    bl.n++;
    if (r.cut) { res.cut++; bl.cut++; continue; }
    res.counts[r.lens]++;
    bl[r.lens]++;
    if (r.last && r.lens !== r.last) res.mismatch++;
    if (r.tie) res.ties++;
  }
  return res;
}

// ---------------------------------------------------------------------------------------------
// Conditions

// An unset value (undefined/null) matches `false`, so {flag:"far", is:false} is true before "far" is set.
// This mirrors js/engine.js (looseEq); SPEC 4.5 is silent on it.
function condEq(v, x) {
  if (v === undefined) v = null;
  if (x === false && v === null) return true;
  if (x === null) return v === null;
  return v === x;
}
export function evalCond(c, st) {
  if (!isObj(c)) return false;
  if ('choice' in c || 'flag' in c) {
    const v = 'choice' in c ? (st.choices ? st.choices[c.choice] : undefined) : (st.flags ? st.flags[c.flag] : undefined);
    return 'in' in c ? Array.isArray(c.in) && c.in.some((x) => condEq(v, x)) : condEq(v, c.is);
  }
  if ('var' in c) {
    const n = Number((st.vars || {})[c.var] || 0);
    if ('is' in c) return n === Number(c.is);
    if ('gte' in c) return n >= Number(c.gte);
    if ('gt' in c) return n > Number(c.gt);
    if ('lte' in c) return n <= Number(c.lte);
    if ('lt' in c) return n < Number(c.lt);
    return n !== 0;
  }
  if ('lastLens' in c) return (st.lastLens != null ? st.lastLens : st.c10Lens != null ? st.c10Lens : null) === c.lastLens;
  if ('c10lens' in c) return (st.lastLens != null ? st.lastLens : st.c10Lens != null ? st.c10Lens : null) === c.c10lens;
  if ('all' in c) return Array.isArray(c.all) && c.all.every((x) => evalCond(x, st));
  if ('any' in c) return Array.isArray(c.any) && c.any.some((x) => evalCond(x, st));
  if ('not' in c) return !evalCond(c.not, st);
  return false;
}

function isPrimitive(v) { return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'; }

function checkCond(cond, cx, w) {
  const rep = cx.rep;
  if (!isObj(cond)) { rep.error('cond', w, 'condition must be an object'); return; }
  const keys = Object.keys(cond);
  const extra = (allowed) => keys.filter((k) => !allowed.includes(k));
  if ('choice' in cond) {
    const ex = extra(['choice', 'is', 'in']);
    if (ex.length) rep.error('cond', w, `unknown key(s) in choice condition: ${ex.join(', ')}`);
    if (!CHOICE_IDS.includes(cond.choice)) rep.error('cond', w, `unknown choice id "${cond.choice}" (choices are ${CHOICE_IDS.join(', ')})`);
    else if (!cx.seen.has(cond.choice)) {
      if (cx.inCutEnding) rep.error('cond', w, `references ${cond.choice}, which is never asked on a cut path (endings.cut follows the cut at ${cx.cutChoice})`);
      else rep.error('cond', w, `references ${cond.choice}, which does not appear earlier in the beat order`);
    }
    if ('is' in cond && 'in' in cond) rep.error('cond', w, 'use either "is" or "in", not both');
    else if ('is' in cond) { if (!OPTION_IDS.includes(cond.is)) rep.error('cond', w, `"is" must be one of a-d, got ${JSON.stringify(cond.is)}`); }
    else if ('in' in cond) {
      if (!Array.isArray(cond.in) || !cond.in.length || !cond.in.every((x) => OPTION_IDS.includes(x))) {
        rep.error('cond', w, `"in" must be a non-empty array of a-d, got ${JSON.stringify(cond.in)}`);
      }
    } else rep.error('cond', w, 'choice condition needs "is" or "in"');
    return;
  }
  if ('flag' in cond) {
    const ex = extra(['flag', 'is', 'in']);
    if (ex.length) rep.error('cond', w, `unknown key(s) in flag condition: ${ex.join(', ')}`);
    const f = cond.flag;
    if (typeof f !== 'string' || !f) { rep.error('cond', w, 'flag name must be a non-empty string'); return; }
    const avail = cx.flags.get(f);
    if (!avail) {
      if (cx.allFlags && cx.allFlags.has(f)) rep.error('cond', w, `flag "${f}" is only set later in the route (must be set earlier)`);
      else rep.error('cond', w, `flag "${f}" is never set by any option "set"`);
    }
    const vals = 'in' in cond ? cond.in : [cond.is];
    if ('is' in cond && 'in' in cond) rep.error('cond', w, 'use either "is" or "in", not both');
    else if (!('is' in cond) && !('in' in cond)) rep.error('cond', w, 'flag condition needs "is" or "in"');
    else if ('in' in cond && (!Array.isArray(cond.in) || !cond.in.length)) rep.error('cond', w, '"in" must be a non-empty array');
    else {
      for (const v of vals) {
        if (!isPrimitive(v)) rep.error('cond', w, `flag value must be a string, number or boolean, got ${JSON.stringify(v)}`);
        // An unset flag counts as false (confirmed by the lead), so {flag, is:false} needs no report.
        else if (v === false) continue;
        else if (avail && !avail.has(v)) rep.warn('cond', w, `flag "${f}" is never set to ${JSON.stringify(v)} (set values: ${[...avail].map((x) => JSON.stringify(x)).join(', ')})`);
      }
    }
    return;
  }
  if ('var' in cond) {
    const ex = extra(['var', 'is', 'gte', 'gt', 'lte', 'lt']);
    if (ex.length) rep.error('cond', w, `unknown key(s) in var condition: ${ex.join(', ')}`);
    rep.warn('cond', w, 'var condition is an engine extension, not in SPEC 4.5');
    if (!cx.counters.has(cond.var)) rep.error('cond', w, `var "${cond.var}" is not an action counter of this route`);
    return;
  }
  for (const k of ['lastLens', 'c10lens']) {
    if (!(k in cond)) continue;
    const ex = extra([k]);
    if (ex.length) rep.error('cond', w, `unknown key(s) in ${k} condition: ${ex.join(', ')}`);
    if (!LENSES.includes(cond[k])) rep.error('cond', w, `${k} must be 1, 2 or 3, got ${JSON.stringify(cond[k])}`);
    if (!cx.allowLast) rep.error('cond', w, `${k} may only be used inside endings, endingPreface or endingCoda`);
    else if (cx.inCutEnding) rep.warn('cond', w, `${k} is never true inside endings.cut (a cut path has no last choice)`);
    if (k === 'c10lens') rep.info('cond', w, 'c10lens is the old name of lastLens (the lens of the last, double-weight choice)');
    return;
  }
  for (const k of ['all', 'any']) {
    if (k in cond) {
      const ex = extra([k]);
      if (ex.length) rep.error('cond', w, `unknown key(s) next to "${k}": ${ex.join(', ')}`);
      if (!Array.isArray(cond[k]) || !cond[k].length) { rep.error('cond', w, `"${k}" must be a non-empty array`); return; }
      cond[k].forEach((c, i) => checkCond(c, cx, `${w}.${k}[${i}]`));
      return;
    }
  }
  if ('not' in cond) {
    const ex = extra(['not']);
    if (ex.length) rep.error('cond', w, `unknown key(s) next to "not": ${ex.join(', ')}`);
    checkCond(cond.not, cx, `${w}.not`);
    return;
  }
  rep.error('cond', w, `unrecognized condition ${snip(JSON.stringify(cond), 60)}`);
}

// ---------------------------------------------------------------------------------------------
// Text rendering for length and reading time

export function renderText(str, lang, scripture, vars) {
  return String(str)
    .replace(TOKEN_RE, (m, kind, key) => {
      const s = scripture ? scripture[key] : null;
      if (kind === 'v') return s && s[lang] ? '“' + s[lang] + '”' : m;
      if (kind === 'r') return s && s.ref && s.ref[lang] ? s.ref[lang] : m;
      return String(vars && vars[key] != null ? vars[key] : 0);
    })
    .replace(/\*([^*\n]+)\*/g, '$1');
}

// ---------------------------------------------------------------------------------------------
// Typed-scripture detector: n-gram index over every verse text (ko: 4 words, en: 5 words).

function normWords(s, lang) {
  let t = String(s);
  if (lang === 'en') t = t.toLowerCase().replace(/[‘’']/g, '').replace(/[^a-z0-9\s]/g, ' ');
  else t = t.replace(/[^가-힣ᄀ-ᇿ㄰-㆏0-9A-Za-z\s]/g, ' ');
  return t.split(/\s+/).filter(Boolean);
}
function buildScriptureIndex(scripture) {
  const idx = { ko: new Map(), en: new Map() };
  if (!isObj(scripture)) return idx;
  const N = { ko: 4, en: 5 };
  for (const [key, e] of Object.entries(scripture)) {
    if (!isObj(e) || e.refOnly) continue;
    for (const lang of ['ko', 'en']) {
      const texts = [e[lang]];
      if (isObj(e.full) && typeof e.full[lang] === 'string') texts.push(e.full[lang]);
      for (const t of texts) {
        const w = normWords(t, lang);
        for (let i = 0; i + N[lang] <= w.length; i++) {
          const g = w.slice(i, i + N[lang]).join(' ');
          if (!idx[lang].has(g)) idx[lang].set(g, key);
        }
      }
    }
  }
  return idx;
}
function findTypedScripture(str, lang, idx) {
  const N = lang === 'en' ? 5 : 4;
  const w = normWords(stripTokens(str), lang);
  for (let i = 0; i + N <= w.length; i++) {
    const g = w.slice(i, i + N).join(' ');
    if (idx[lang].has(g)) return { key: idx[lang].get(g), gram: g };
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// T checks

function checkT(t, cx, w, o = {}) {
  // o: { kind: 'line'|'option'|'prompt'|null, story: bool, allowMixed: bool, allowEmpty: bool }
  const rep = cx.rep;
  if (!isT(t)) {
    rep.error('T', w, `expected a bilingual text {ko, en}, got ${snip(JSON.stringify(t), 50)}`);
    return false;
  }
  const extraKeys = Object.keys(t).filter((k) => k !== 'ko' && k !== 'en');
  if (extraKeys.length) rep.warn('T', w, `unexpected key(s) in text object: ${extraKeys.join(', ')}`);
  for (const lang of ['ko', 'en']) {
    const s = t[lang];
    if (!s.trim()) {
      if (!o.allowEmpty) rep.error('T', w, `empty ${lang} text`);
      continue;
    }
    if (/[\r\n]/.test(s)) rep.warn('T', w, `${lang} text contains a line break (use separate beats, SPEC 3.1)`);
    if (/<\/?[a-z][^>]*>/i.test(s)) rep.warn('T', w, `${lang} text contains HTML (plain text only, SPEC 3.1)`);
    if (s !== s.trim()) rep.info('T', w, `${lang} text has leading/trailing spaces`);
    if (countRe(stripTokens(s), /\*/g) % 2) rep.warn('T', w, `${lang} text has an unbalanced * emphasis marker`);
  }
  if (!t.ko.trim() || !t.en.trim()) return true;
  // Language sanity.
  const en = stripTokens(t.en);
  const ko = stripTokens(t.ko);
  const hEn = countRe(en, HANGUL_RE);
  const lEn = countRe(en, LATIN_RE);
  const sev = o.ui ? 'INFO' : null;
  if (hEn && !o.allowMixed) {
    if (hEn / (hEn + lEn) >= 0.3) rep.add(sev || 'ERROR', 'lang', w, `en text is mostly Hangul (languages swapped?): "${snip(t.en)}"`);
    else rep.add(sev || 'WARN', 'lang', w, `en text contains Hangul: "${snip(t.en)}"`);
  }
  const hKo = countRe(ko, HANGUL_RE);
  const lKo = countRe(ko, LATIN_RE);
  if (!hKo && lKo > 3) rep.add(sev || 'ERROR', 'lang', w, `ko text has no Hangul (languages swapped or untranslated?): "${snip(t.ko)}"`);
  if (t.ko.trim() === t.en.trim() && hKo + lKo > 0 && !o.ui) rep.warn('lang', w, `ko and en are identical: "${snip(t.ko)}"`);
  // Tokens.
  for (const lang of ['ko', 'en']) checkTokens(t[lang], lang, cx, w);
  const kt = [...t.ko.matchAll(TOKEN_RE)].map((m) => m[0]).sort().join(' ');
  const et = [...t.en.matchAll(TOKEN_RE)].map((m) => m[0]).sort().join(' ');
  if (kt !== et) rep.warn('token', w, `ko and en use different tokens (ko: ${kt || 'none'}; en: ${et || 'none'})`);
  // Length limits.
  if (o.kind) {
    const lim = cx.canon.limits[o.kind];
    for (const lang of ['ko', 'en']) {
      const len = cpLen(renderText(t[lang], lang, cx.data.scripture));
      const [soft, hard] = lim[lang];
      if (len > hard) rep.error('length', w, `${o.kind} ${lang} is ${len} chars (hard limit ${hard}): "${snip(t[lang], 40)}"`);
      else if (len > soft) rep.warn('length', w, `${o.kind} ${lang} is ${len} chars (soft limit ${soft}): "${snip(t[lang], 40)}"`);
    }
  }
  // Names (everywhere).
  for (const lang of ['ko', 'en']) {
    for (const re of cx.forbiddenRes) {
      if (re.test(t[lang])) rep.error('names', w, `forbidden name variant "${re.source.replace(/\\b/g, '')}" in ${lang}: "${snip(t[lang])}"`);
    }
  }
  if (o.story) storyChecks(t, cx, w);
  cx.allTexts.push({ t, w, story: !!o.story, speaker: o.speaker || null, egg: !!cx.egg, bg: cx.bgNow ? cx.bgNow() : null });
  return true;
}

function checkTokens(s, lang, cx, w) {
  const rep = cx.rep;
  const rest = s.replace(TOKEN_RE, '');
  if (/\{\{|\}\}/.test(rest)) rep.error('token', w, `malformed token in ${lang} (expected {{v:KEY}}, {{r:KEY}} or {{var:NAME}}): "${snip(s, 50)}"`);
  const scr = cx.data.scripture;
  for (const m of s.matchAll(TOKEN_RE)) {
    const [whole, kind, key] = m;
    if (kind === 'v' || kind === 'r') {
      if (!isObj(scr)) {
        if (cx.spec.keys.has(key)) {
          rep.warn('token', w, `{{${kind}:${key}}} checked against the SPEC 4.3 key list only (data/scripture.js missing)`);
          if (kind === 'v' && cx.spec.keys.get(key).refOnly) rep.error('token', w, `{{v:${key}}} uses a reference-only key (use {{r:${key}}})`);
        } else rep.error('token', w, `unknown scripture key ${key} (not in SPEC 4.3)`);
        continue;
      }
      const e = scr[key];
      if (!isObj(e)) { rep.error('token', w, `unknown scripture key ${key} in ${whole}`); continue; }
      if (kind === 'v' && e.refOnly) rep.error('token', w, `{{v:${key}}} uses a reference-only key (only {{r:${key}}} is allowed)`);
      else if (kind === 'v' && !(typeof e[lang] === 'string' && e[lang])) rep.error('token', w, `{{v:${key}}} has no ${lang} text in data/scripture.js`);
      if (kind === 'v') {
        const before = s.slice(0, m.index).replace(/\s+$/, '');
        const after = s.slice(m.index + whole.length).replace(/^\s+/, '');
        if (QUOTE_BEFORE.test(before) || QUOTE_AFTER.test(after)) {
          rep.warn('token', w, `quotation marks around ${whole} in ${lang} (the engine adds quotes, SPEC 3.2)`);
        }
      }
      if (cx.usage) cx.usage.add(key);
    } else if (kind === 'var') {
      if (!cx.counters.has(key)) rep.error('token', w, `{{var:${key}}} is not an action counter of this route (counters: ${[...cx.counters].join(', ') || 'none'})`);
    }
  }
}

function storyChecks(t, cx, w) {
  const rep = cx.rep;
  if (MECH_KO.test(stripTokens(t.ko))) rep.warn('guard', w, `game-mechanics word in story text (ko): "${snip(t.ko)}" (SPEC 3.4/7.3)`);
  if (MECH_EN.test(stripTokens(t.en))) rep.warn('guard', w, `game-mechanics word in story text (en): "${snip(t.en)}" (SPEC 3.4/7.3)`);
  if (!cx.egg) {
    if (FOUR_KO.test(t.ko) || FOUR_EN.test(t.en)) rep.warn('guard', w, `"four men" (Mark 2:3 detail) outside a labeled Easter egg: "${snip(t.ko)}" (SPEC 6.1/7.5)`);
    if (MK27_KO.test(t.ko) || MK27_EN.test(t.en)) rep.warn('guard', w, `Mark 2:7 wording ("who can forgive sins but God alone") outside an Easter egg (SPEC 7.5)`);
    const bg = cx.bgNow ? cx.bgNow() : null;
    if ((bg === 'crowd' || bg === 'crowd_lying') && (ROOF_KO.test(t.ko) || ROOF_EN.test(t.en))) {
      const lang = ROOF_KO.test(t.ko) ? 'ko' : 'en';
      rep.warn('guard', w, `roof mentioned in the crowd scene outside an Easter egg (no house/roof in Matthew, SPEC 6.2/7.5), ${lang}: "${snip(t[lang], 60)}"`);
    }
  }
  if (TALMUD.test(t.ko) || TALMUD.test(t.en)) rep.warn('guard', w, 'mentions the Talmud/Nedarim in story text (SPEC 7.9)');
  for (const lang of ['ko', 'en']) {
    const s = stripTokens(t[lang]);
    if (JESUS_REF.test(s) && GESTURE.test(s) && !OTHER_PEOPLE.test(s)) {
      rep.warn('guard', w, `possible invented gesture/emotion for Jesus (${lang}): "${snip(t[lang], 50)}" (SPEC 6.1/7.1)`);
    }
  }
  for (const lang of ['ko', 'en']) {
    const hit = findTypedScripture(t[lang], lang, cx.scrIndex);
    if (!hit) continue;
    // Inside quotation marks it reads as a quotation (must be a token); otherwise it may be a paraphrase.
    const quoted = /[\u201c"\u300c\u300e]|\u2018[^\u2019]*\u2019/.test(stripTokens(t[lang]));
    if (quoted) rep.warn('quote', w, `quotes scripture wording from ${hit.key} inside quotation marks (${lang}: "${hit.gram}"); use {{v:KEY}} (SPEC 3.2)`);
    else rep.info('quote', w, `shares scripture wording with ${hit.key} (${lang}: "${hit.gram}"); fine as an unquoted paraphrase, otherwise use {{v:KEY}} (SPEC 3.2)`);
  }
  if (cx.rid === 'asher' && /\bMother\b/.test(t.en)) rep.warn('voice', w, `Asher route uses "Mother" (SPEC 3.4: Asher says "Mom"): "${snip(t.en)}"`);
}

// ---------------------------------------------------------------------------------------------
// Beat checks

function checkBeats(list, cx, label) {
  if (list === undefined) return;
  if (!Array.isArray(list)) { cx.rep.error('schema', `${cx.path} › ${label}`, `${label} must be an array of beats`); return; }
  list.forEach((b, i) => checkBeat(b, cx, `${label}[${i}]`));
}

function beatWhere(cx, label, b) {
  let w = `${cx.path} › ${label}`;
  if (isObj(b)) {
    w += `:${b.type || '?'}`;
    if (b.type === 'choice' && b.id) w += `(${b.id})`;
    else if (b.id) w += `#${b.id}`;
  }
  if (cx.phase === 'main' && !cx.inReaction && cx.lastChoice) w += ` (after ${cx.lastChoice})`;
  return w + locate(cx, b);
}

function locate(cx, b) {
  // Best-effort file:line for a beat, searching forward from the last located position.
  const f = cx.files && cx.files[cx.file];
  if (!f || !isObj(b)) return '';
  let needle = null;
  const fromT = (t) => {
    if (!isT(t)) return null;
    for (const s of [t.ko, t.en]) {
      const cut = s.split(/["'\\\n{]/)[0].slice(0, 18);
      if (cpLen(cut) >= 5) return cut;
    }
    return null;
  };
  const q = (k, v) => new RegExp(k + '\\s*:\\s*["\']' + v + '["\']|\\(\\s*["\']' + v + '["\']');
  const needles = [];
  if (b.type === 'choice' && b.id) needles.push(q('id', b.id));
  needles.push(fromT(b.text), fromT(b.prompt), fromT(b.label), fromT(b.caption));
  if (b.key) needles.push(q('key', b.key));
  if (b.fx) needles.push(q('fx', b.fx));
  if (b.bg) needles.push(q('bg', b.bg));
  const src = f.src;
  const start = cx.cursor ? cx.cursor.pos : 0;
  let idx = -1;
  for (const needle of needles.filter(Boolean)) {
    if (typeof needle === 'string') {
      idx = src.indexOf(needle, start);
      if (idx < 0) idx = src.indexOf(needle);
    } else {
      const re = new RegExp(needle.source, 'g');
      re.lastIndex = start;
      let m = re.exec(src);
      if (!m) { re.lastIndex = 0; m = re.exec(src); }
      idx = m ? m.index : -1;
    }
    if (idx >= 0) break;
  }
  if (idx < 0) return '';
  if (cx.cursor) cx.cursor.pos = idx + 1;
  return ` [${cx.file}:${lineAt(src, idx)}]`;
}

function checkBeat(b, cx, label) {
  const rep = cx.rep;
  const w = beatWhere(cx, label, b);
  if (!isObj(b)) { rep.error('schema', w, 'beat must be an object'); return; }
  if (!BEAT_TYPES.includes(b.type)) { rep.error('schema', w, `unknown beat type ${JSON.stringify(b.type)}`); return; }
  if (b.when !== undefined) checkCond(b.when, cx, `${w} › when`);
  const allowed = b.type === 'fx' ? BEAT_KEYS.fx.concat(FX_PARAMS[b.fx] || []) : BEAT_KEYS[b.type];
  const unknown = Object.keys(b).filter((k) => !allowed.includes(k));
  if (unknown.length) rep.warn('schema', w, `unknown key(s) on ${b.type} beat: ${unknown.join(', ')}`);
  if (b.id !== undefined && b.type !== 'choice') {
    if (typeof b.id !== 'string' || !b.id) rep.error('schema', w, 'beat id must be a non-empty string');
    else if (cx.ids.has(b.id)) rep.warn('schema', w, `duplicate beat id "${b.id}"`);
    else cx.ids.add(b.id);
  }
  switch (b.type) {
    case 'scene': {
      if (!cx.canon.bgIds.includes(b.bg)) rep.error('schema', w, `unknown bg ${JSON.stringify(b.bg)} (SPEC 6.6: ${cx.canon.bgIds.join(', ')})`);
      else if (cx.setBg) cx.setBg(b.bg);
      if (cx.rid && (b.time === 'evening' || b.time === 'night' || ['lamp_night', 'road_home', 'doorway_evening'].includes(b.bg))) {
        rep.info('scene', w, `evening/epilogue setting (${b.bg}${b.time ? ', ' + b.time : ''}); SPEC 6.2: short routes end at the crowd or one step away`);
      }
      if (b.caption !== undefined) checkT(b.caption, cx, `${w} › caption`, { story: cx.story });
      if (b.pov !== undefined && !POV_VALUES.includes(b.pov)) rep.error('schema', w, `pov must be one of ${POV_VALUES.join('|')}`);
      if (b.time !== undefined && !TIME_VALUES.includes(b.time)) rep.error('schema', w, `time must be one of ${TIME_VALUES.join('|')} (SPEC 4.5), got ${JSON.stringify(b.time)}`);
      break;
    }
    case 'line': {
      const sp = b.speaker === undefined ? 'narrator' : b.speaker;
      if (sp === 'jesus') rep.error('guard', w, 'line beat with speaker "jesus" (Jesus speaks only through verse beats or tokens, SPEC 4.5/7.1)');
      else if (!PSEUDO_SPEAKERS.includes(sp) && !(isObj(cx.data.characters) && cx.data.characters[sp])) {
        rep.error('schema', w, `unknown speaker ${JSON.stringify(sp)}`);
      }
      checkT(b.text, cx, `${w} › text`, { kind: 'line', story: cx.story, speaker: sp });
      break;
    }
    case 'verse': {
      const scr = cx.data.scripture;
      const e = isObj(scr) ? scr[b.key] : null;
      if (typeof b.key !== 'string') rep.error('schema', w, 'verse beat needs a key');
      else if (!isObj(scr)) {
        if (!cx.spec.keys.has(b.key)) rep.error('token', w, `unknown scripture key ${b.key} (not in SPEC 4.3)`);
        else if (cx.spec.keys.get(b.key).refOnly) rep.error('token', w, `verse beat uses reference-only key ${b.key}`);
      } else if (!e) rep.error('token', w, `unknown scripture key ${b.key}`);
      else if (e.refOnly) rep.error('token', w, `verse beat uses reference-only key ${b.key}`);
      if (b.speaker !== undefined && !VERSE_SPEAKERS.includes(b.speaker)) rep.error('schema', w, `verse speaker must be one of ${VERSE_SPEAKERS.join('|')}`);
      const keySpeaker = e ? e.speaker : cx.spec.keys.get(b.key) ? cx.spec.keys.get(b.key).speaker : null;
      if (b.speaker === 'jesus' && keySpeaker !== 'jesus') rep.warn('guard', w, `verse beat attributes ${b.key} to Jesus, but its scripture speaker is ${keySpeaker || 'unset'}`);
      if (b.speaker && b.speaker !== 'jesus' && keySpeaker === 'jesus') rep.warn('guard', w, `verse beat attributes Jesus' words (${b.key}) to "${b.speaker}"`);
      if (cx.usage && b.key) cx.usage.add(b.key);
      break;
    }
    case 'choice': {
      if (cx.phase !== 'main' || cx.inReaction) rep.error('schema', w, 'choice beats are only allowed in the route\'s main beats');
      else checkChoice(b, cx, w);
      break;
    }
    case 'fx':
      checkFx(b, cx, w);
      break;
    case 'press': {
      if (b.action === undefined && b.label === undefined) rep.error('schema', w, 'press beat needs "action" or "label"');
      if (b.action !== undefined && !cx.actions.has(b.action)) rep.error('schema', w, `press action "${b.action}" is not a route action (${[...cx.actions].join(', ') || 'none'})`);
      if (b.label !== undefined) checkT(b.label, cx, `${w} › label`, { story: cx.story });
      if (b.hint !== undefined) checkT(b.hint, cx, `${w} › hint`, { story: cx.story });
      if (b.action && b.label) rep.info('schema', w, 'press beat has both action and label');
      break;
    }
    default:
      break;
  }
}

function checkFx(b, cx, w) {
  const rep = cx.rep;
  const name = b.fx;
  if (!Object.prototype.hasOwnProperty.call(FX_PARAMS, name)) { rep.error('fx', w, `unknown fx ${JSON.stringify(name)} (SPEC 4.5 FX list)`); return; }
  if (FX_HOME[name] && cx.rid && FX_HOME[name] !== cx.rid) rep.info('fx', w, `fx "${name}" was designed for the ${FX_HOME[name]} route`);
  const scr = cx.data.scripture;
  switch (name) {
    case 'light':
      if (!LIGHT_LEVELS.includes(b.level)) rep.error('fx', w, `light level must be one of ${LIGHT_LEVELS.join('|')}, got ${JSON.stringify(b.level)}`);
      break;
    case 'echoVerse': {
      const e = isObj(scr) ? scr[b.key] : null;
      if (typeof b.key !== 'string') { rep.error('fx', w, 'echoVerse needs a key'); break; }
      if (isObj(scr) && !e) { rep.error('fx', w, `echoVerse: unknown scripture key ${b.key}`); break; }
      if (e && e.refOnly) rep.error('fx', w, `echoVerse uses reference-only key ${b.key}`);
      if (cx.usage) cx.usage.add(b.key);
      if (b.highlight !== undefined) {
        const h = b.highlight;
        if (!isObj(h) || typeof h.flag !== 'string' || !isObj(h.map)) { rep.error('fx', w, 'echoVerse highlight must be {flag, map}'); break; }
        const extra = Object.keys(h).filter((k) => k !== 'flag' && k !== 'map');
        if (extra.length) rep.warn('fx', w, `unknown key(s) in highlight: ${extra.join(', ')}`);
        checkCond({ flag: h.flag, in: [...(cx.flags.get(h.flag) || cx.allFlags.get(h.flag) || new Set(['?']))] }, cx, `${w} › highlight.flag`);
        const setVals = cx.flags.get(h.flag) || new Set();
        for (const v of setVals) {
          if (!Object.prototype.hasOwnProperty.call(h.map, String(v))) rep.info('fx', w, `highlight.map has no entry for ${h.flag}=${JSON.stringify(v)} (nothing will be highlighted)`);
        }
        for (const [val, spec] of Object.entries(h.map)) {
          if (spec === null || spec === '*') continue;
          if (!isObj(spec) || !Array.isArray(spec.ko) || !Array.isArray(spec.en)) {
            rep.error('fx', w, `highlight.map["${val}"] must be {ko:[...], en:[...]}, "*" or null`);
            continue;
          }
          if (!setVals.has(val) && !setVals.has(val === 'true' ? true : val === 'false' ? false : Number(val))) {
            rep.info('fx', w, `highlight.map has an entry "${val}" that ${h.flag} is never set to`);
          }
          for (const lang of ['ko', 'en']) {
            for (const sub of spec[lang]) {
              if (typeof sub !== 'string' || !sub) rep.error('fx', w, `highlight.map["${val}"].${lang} must contain non-empty strings`);
              else if (e && typeof e[lang] === 'string' && !e[lang].includes(sub)) {
                rep.error('fx', w, `highlight "${sub}" is not a substring of ${b.key} (${lang})`);
              }
            }
          }
        }
      }
      break;
    }
    case 'pinThought': {
      if (!Array.isArray(b.items) || !b.items.length) { rep.error('fx', w, 'pinThought needs a non-empty items array'); break; }
      for (const it of b.items) {
        const m = typeof it === 'string' ? it.match(/^(verse|choice):(.+)$/) : null;
        if (!m) { rep.error('fx', w, `pinThought item ${JSON.stringify(it)} must be "verse:KEY" or "choice:cN"`); continue; }
        if (m[1] === 'verse') {
          const e = isObj(scr) ? scr[m[2]] : null;
          if (isObj(scr) && !e) rep.error('fx', w, `pinThought: unknown scripture key ${m[2]}`);
          else if (e && e.refOnly) rep.error('fx', w, `pinThought uses reference-only key ${m[2]}`);
          if (cx.usage) cx.usage.add(m[2]);
        } else if (!CHOICE_IDS.includes(m[2])) rep.error('fx', w, `pinThought: unknown choice ${m[2]}`);
        else if (!cx.seen.has(m[2])) rep.error('fx', w, `pinThought references ${m[2]}, which does not appear earlier`);
      }
      break;
    }
    case 'pov':
      if (!POV_VALUES.includes(b.pov)) rep.error('fx', w, `pov must be one of ${POV_VALUES.join('|')}`);
      break;
    case 'actionReply':
      if (!cx.actions.has(b.action)) rep.error('fx', w, `actionReply action "${b.action}" is not a route action (${[...cx.actions].join(', ') || 'none'})`);
      checkT(b.text, cx, `${w} › text`, { kind: 'line', story: cx.story });
      break;
    default:
      break;
  }
}

function checkChoice(b, cx, w) {
  const rep = cx.rep;
  if (!CHOICE_IDS.includes(b.id)) rep.error('schema', w, `choice id must be ${CHOICE_IDS[0]}..${LAST_CHOICE}, got ${JSON.stringify(b.id)}`);
  if (b.when !== undefined) rep.warn('schema', w, `choice beat has a "when" condition; all ${CHOICE_COUNT} choices must be reached on every path that is not cut`);
  checkT(b.prompt, cx, `${w} › prompt`, { kind: 'prompt', story: cx.story });
  if (!Array.isArray(b.options)) { rep.error('schema', w, 'options must be an array of 4 options'); return; }
  if (b.options.length !== 4) rep.error('schema', w, `expected 4 options, found ${b.options.length}`);
  const newFlags = new Map();
  b.options.forEach((o, i) => {
    const ow = `${w} › ${b.id}/${isObj(o) && o.id ? o.id : '#' + i}`;
    if (!isObj(o)) { rep.error('schema', ow, 'option must be an object'); return; }
    if (o.id !== OPTION_IDS[i]) rep.error('schema', ow, `option ids must be a, b, c, d in order; position ${i + 1} has ${JSON.stringify(o.id)}`);
    const unknown = Object.keys(o).filter((k) => !OPTION_KEYS.includes(k));
    if (unknown.length) rep.warn('schema', ow, `unknown key(s) on option: ${unknown.join(', ')}`);
    if (!('lens' in o)) rep.error('schema', ow, 'option has no lens (use null for no lens)');
    else if (!(o.lens === null || LENSES.includes(o.lens))) rep.error('schema', ow, `lens must be 1, 2, 3 or null, got ${JSON.stringify(o.lens)}`);
    if ('cut' in o) {
      if (o.cut !== true) rep.error('cut', ow, `"cut" must be the boolean true (or left out), got ${JSON.stringify(o.cut)}`);
      else {
        if (cx.cutOptions) cx.cutOptions.push({ choice: b.id, option: o.id, w: ow });
        if (o.lens !== null) rep.error('cut', ow, `a cut option must have lens null (SPEC 4.5), got ${JSON.stringify(o.lens)}`);
      }
    }
    const egg = (cx.rid === 'friend' && b.id === 'c7' && o.id === 'd') || MARK_LABEL.test(JSON.stringify([o.text, o.reaction || []]));
    const ocx = Object.assign({}, cx, { egg });
    checkT(o.text, ocx, `${ow} › text`, { kind: 'option', story: cx.story });
    const optFlags = new Map([...cx.flags].map(([k, v]) => [k, new Set(v)]));
    if (o.set !== undefined) {
      if (!isObj(o.set) || !Object.keys(o.set).length) rep.error('schema', ow, '"set" must be a non-empty object {flag: value}');
      else {
        for (const [f, v] of Object.entries(o.set)) {
          if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(f)) rep.warn('schema', ow, `flag name "${f}" is not a plain identifier`);
          if (!isPrimitive(v)) rep.error('schema', ow, `set.${f} must be a string, number or boolean, got ${JSON.stringify(v)}`);
          if (!optFlags.has(f)) optFlags.set(f, new Set());
          optFlags.get(f).add(v);
          if (!newFlags.has(f)) newFlags.set(f, new Set());
          newFlags.get(f).add(v);
        }
      }
    }
    if (o.reaction !== undefined) {
      if (!Array.isArray(o.reaction)) rep.error('schema', ow, 'reaction must be an array of beats');
      else {
        const seen = new Set(cx.seen);
        if (CHOICE_IDS.includes(b.id)) seen.add(b.id);
        const rcx = Object.assign({}, cx, { seen, flags: optFlags, inReaction: true, egg, path: `${ow} › reaction` });
        o.reaction.forEach((rb, ri) => checkBeat(rb, rcx, `[${ri}]`));
        const plain = o.reaction.filter((rb) => isObj(rb) && (rb.type === 'line' || rb.type === 'verse' || rb.type === 'press') && rb.when === undefined).length;
        const most = isCutOption(o) ? 2 : 1;
        if (plain > most) {
          rep.warn('schema', ow, `reaction has ${plain} unconditional beats (SPEC 4.5: ${isCutOption(o) ? 'a cut option keeps at most two' : 'at most one short reaction beat; two only when a "when" variant needs it'})`);
        }
      }
    }
  });
  // After the choice: it becomes "earlier" for later beats, and its flags become available.
  if (CHOICE_IDS.includes(b.id)) cx.seen.add(b.id);
  for (const [f, vals] of newFlags) {
    if (!cx.flags.has(f)) cx.flags.set(f, new Set());
    for (const v of vals) cx.flags.get(f).add(v);
  }
  cx.lastChoice = b.id;
  cx.choiceList.push(b);
}

// ---------------------------------------------------------------------------------------------
// Path simulation (SPEC 4.5 ending order); used for screens, crowd order and passerby coverage.
// A cut option plays its reaction, then the route's remaining beats are skipped and the cut ending runs:
// card -> endings.cut beats -> last -> endingCoda (no mismatch line, no endingPreface; light off).

export function simulate(route, data, choices) {
  const st = { choices: {}, flags: {}, vars: {}, lastLens: null, c10Lens: null, lens: null };
  const out = [];
  let bg = null;
  let light = 'off';
  let cutAt = null;
  const runList = (list, phase) => {
    if (!Array.isArray(list)) return;
    for (const b of list) {
      if (cutAt && /^main/.test(phase)) return;
      if (!isObj(b)) continue;
      if (b.when !== undefined && !evalCond(b.when, st)) continue;
      if (b.type === 'scene') bg = b.bg;
      if (b.type === 'fx' && b.fx === 'light') light = b.level;
      if (b.type === 'choice') {
        const opts = Array.isArray(b.options) ? b.options : [];
        const pick = choices ? choices[b.id] : undefined;
        const o = opts.find((x) => isObj(x) && x.id === pick) || opts[0] || null;
        st.choices[b.id] = o ? o.id : undefined;
        if (o && isObj(o.set)) Object.assign(st.flags, o.set);
        out.push({ kind: 'choice', beat: b, opt: o, phase, bg, light });
        if (o) runList(o.reaction, phase + '/reaction');
        if (isCutOption(o)) cutAt = { choice: b.id, option: o.id };
      } else {
        out.push({ kind: b.type, beat: b, phase, bg, light });
      }
    }
  };
  runList(route && route.beats, 'main');
  const lr = computeLensFor(route, st.choices);
  if (cutAt) {
    light = 'off';
    out.push({ kind: 'card', lens: null, cut: true, phase: 'card', bg, light });
    const end = route && isObj(route.endings) ? route.endings.cut : null;
    if (isObj(end)) {
      runList(end.beats, 'ending');
      if (isT(end.last)) out.push({ kind: 'line', beat: { type: 'line', text: end.last }, phase: 'last', bg, light });
    }
    runList(route && route.endingCoda, 'coda');
    return { out, lens: lr, state: st, cut: cutAt };
  }
  st.lastLens = lr.lastLens;
  st.c10Lens = lr.lastLens;
  st.lens = lr.lens;
  if (lr.mismatch && data && data.common && isT(data.common.mismatchLine)) {
    out.push({ kind: 'line', beat: { type: 'line', text: data.common.mismatchLine }, phase: 'mismatch', bg, light });
  }
  runList(route && route.endingPreface, 'preface');
  out.push({ kind: 'card', lens: lr.lens, cut: false, phase: 'card', bg, light });
  const end = route && isObj(route.endings) ? route.endings[String(lr.lens)] : null;
  if (end) {
    runList(end.beats, 'ending');
    if (isT(end.last)) out.push({ kind: 'line', beat: { type: 'line', text: end.last }, phase: 'last', bg, light });
  }
  runList(route && route.endingCoda, 'coda');
  return { out, lens: lr, state: st, cut: null };
}

function textsOfItem(it, lang, data) {
  // Rendered strings shown for one simulated item (for reading time and token scans).
  const scr = data.scripture;
  const b = it.beat || {};
  const r = (t) => (isT(t) ? renderText(t[lang], lang, scr) : '');
  switch (it.kind) {
    case 'line': return [r(b.text)];
    case 'verse': {
      const e = isObj(scr) ? scr[b.key] : null;
      return e ? [e[lang] || '', e.ref ? e.ref[lang] || '' : ''] : [];
    }
    case 'choice': return [r(b.prompt)].concat((b.options || []).map((o) => r(o && o.text)));
    case 'press': return [r(b.label), r(b.hint)];
    case 'scene': return [r(b.caption)];
    case 'fx': {
      if (b.fx === 'echoVerse' && isObj(scr) && scr[b.key]) return [scr[b.key][lang] || ''];
      if (b.fx === 'actionReply') return [];
      return [];
    }
    case 'card': {
      const m = data.meta;
      if (it.cut) return [m && isObj(m.cut) ? r(m.cut.label) : ''];
      const lab = m && m.lenses && m.lenses[it.lens] ? r(m.lenses[it.lens].label) : '';
      return [lab];
    }
    default: return [];
  }
}

function keysShown(it) {
  // Scripture keys displayed by an item (verse beats, {{v:}} tokens, echoVerse, pinned verses).
  const keys = [];
  const b = it.beat || {};
  const tok = (t) => {
    if (!isT(t)) return;
    for (const m of (t.ko + ' ' + t.en).matchAll(TOKEN_RE)) if (m[1] === 'v') keys.push(m[2]);
  };
  if (it.kind === 'verse') keys.push(b.key);
  if (it.kind === 'line') tok(b.text);
  if (it.kind === 'choice') { tok(b.prompt); (b.options || []).forEach((o) => o && tok(o.text)); }
  if (it.kind === 'fx' && b.fx === 'echoVerse') keys.push(b.key);
  if (it.kind === 'fx' && b.fx === 'pinThought' && Array.isArray(b.items)) {
    b.items.forEach((x) => { const m = String(x).match(/^verse:(.+)$/); if (m) keys.push(m[1]); });
  }
  return [...new Set(keys)];
}

const SCREEN_KINDS = new Set(['line', 'verse', 'choice', 'press']);

function readingStats(items, data) {
  let screens = 0;
  let choices = 0;
  let koChars = 0;
  let enWords = 0;
  for (const it of items) {
    if (SCREEN_KINDS.has(it.kind)) screens++;
    if (it.kind === 'choice') choices++;
    for (const s of textsOfItem(it, 'ko', data)) koChars += cpLen(s.replace(/\s+/g, ''));
    for (const s of textsOfItem(it, 'en', data)) enWords += s.split(/\s+/).filter((x) => /[A-Za-z0-9]/.test(x)).length;
  }
  return { screens, choices, koChars, enWords };
}

// Reading time. Silent: ko 450 chars/min, en 200 words/min, +4 s per choice. Read aloud on a TV with
// the class (SPEC 3.3, about 5 minutes per route): ko 260 chars/min, en 150 words/min, +10 s per choice
// (the class decides) and +1 s per screen (the tap and the scene change).
function minutes(st) {
  return {
    ko: (st.koChars / 450 * 60 + st.choices * 4) / 60,
    en: (st.enWords / 200 * 60 + st.choices * 4) / 60,
    koAloud: (st.koChars / 260 * 60 + st.choices * 10 + st.screens) / 60,
    enAloud: (st.enWords / 150 * 60 + st.choices * 10 + st.screens) / 60
  };
}

// ---------------------------------------------------------------------------------------------
// Global data checks

function makeCx(rep, data, spec, canon, files, extra) {
  return Object.assign({
    rep, data, spec, canon, files,
    rid: null, file: null, path: '', story: false, phase: 'global', inReaction: false, egg: false,
    seen: new Set(), flags: new Map(), allFlags: new Map(), allowLast: false, counters: new Set(), actions: new Set(),
    ids: new Set(), choiceList: [], lastChoice: null, allTexts: [], usage: null, cursor: { pos: 0 },
    forbiddenRes: canon.forbidden.map((n) => (/^[A-Za-z]+$/.test(n) ? new RegExp('\\b' + n + '\\b') : new RegExp(n))),
    scrIndex: buildScriptureIndex(data.scripture)
  }, extra || {});
}

function checkScripture(rep, data, spec, root) {
  const scr = data.scripture;
  if (!isObj(scr)) return;
  const W = (k) => `scripture › ${k}`;
  for (const [key, e] of Object.entries(scr)) {
    if (!isObj(e)) { rep.error('scripture', W(key), 'entry must be an object'); continue; }
    const extra = Object.keys(e).filter((k) => !['ref', 'ko', 'en', 'speaker', 'refOnly', 'full'].includes(k));
    if (extra.length) rep.warn('scripture', W(key), `unknown key(s): ${extra.join(', ')}`);
    if (!isT(e.ref) || !e.ref.ko.trim() || !e.ref.en.trim()) rep.error('scripture', W(key), 'ref must be {ko, en} with non-empty strings');
    else {
      if (/\d-\d/.test(e.ref.ko + e.ref.en)) rep.warn('scripture', W(key), `ref range uses a hyphen; use an en dash (SPEC 4.3): ${e.ref.ko} / ${e.ref.en}`);
      const exp = expectedRef(key, spec);
      if (exp && (exp.ko !== e.ref.ko || exp.en !== e.ref.en)) rep.warn('scripture', W(key), `ref is "${e.ref.ko}" / "${e.ref.en}", expected "${exp.ko}" / "${exp.en}"`);
    }
    if (e.refOnly) {
      if (e.refOnly !== true) rep.warn('scripture', W(key), 'refOnly should be the boolean true');
      if (e.ko || e.en) rep.warn('scripture', W(key), 'reference-only key has non-empty text');
    } else {
      for (const lang of ['ko', 'en']) {
        if (typeof e[lang] !== 'string' || !e[lang].trim()) rep.error('scripture', W(key), `missing ${lang} text`);
        else {
          if (/\s{2,}/.test(e[lang]) || e[lang] !== e[lang].trim()) rep.warn('scripture', W(key), `${lang} text has doubled or edge whitespace`);
        }
      }
      if (typeof e.ko === 'string' && e.ko && !HANGUL_TEST.test(e.ko)) rep.error('scripture', W(key), 'ko text has no Hangul');
      if (typeof e.en === 'string' && HANGUL_TEST.test(e.en)) rep.error('scripture', W(key), 'en text contains Hangul');
      if (e.speaker === undefined) rep.warn('scripture', W(key), 'speaker not set (jesus|scribes|narrator)');
      else if (!VERSE_SPEAKERS.includes(e.speaker)) rep.error('scripture', W(key), `speaker must be jesus|scribes|narrator, got ${JSON.stringify(e.speaker)}`);
      if ((e.speaker === 'jesus' || e.speaker === 'scribes') && typeof e.en === 'string') {
        if (/^["“‘']/.test(e.en) || /["”’']$/.test(e.en)) rep.warn('scripture', W(key), 'speech key en text starts/ends with a quotation mark (the engine adds quotes)');
      }
      if (e.full !== undefined) {
        if (!isObj(e.full) || typeof e.full.ko !== 'string' || typeof e.full.en !== 'string' || !e.full.ko.trim() || !e.full.en.trim()) {
          rep.error('scripture', W(key), 'full must be {ko: string, en: string} with non-empty text (SPEC 4.3)');
        } else {
          const fx = Object.keys(e.full).filter((k) => k !== 'ko' && k !== 'en');
          if (fx.length) rep.warn('scripture', W(key), `unknown key(s) in full: ${fx.join(', ')}`);
          if (!HANGUL_TEST.test(e.full.ko)) rep.error('scripture', W(key), 'full.ko has no Hangul');
          if (HANGUL_TEST.test(e.full.en)) rep.error('scripture', W(key), 'full.en contains Hangul');
          if (typeof e.ko === 'string' && !e.full.ko.includes(e.ko)) rep.error('scripture', W(key), 'ko text is not an exact substring of full.ko');
          if (typeof e.en === 'string' && !e.full.en.includes(e.en)) rep.error('scripture', W(key), 'en text is not an exact substring of full.en');
        }
      } else if (/_\d+[A-Z][A-Z0-9]*$/.test(key)) {
        rep.info('scripture', W(key), 'partial-looking key without a "full" verse; substring cannot be verified');
      }
    }
    const sk = spec.keys.get(key);
    if (spec.ok && !sk) rep.warn('scripture', W(key), 'key is not listed in SPEC 4.3 (writers may only use listed keys)');
    else if (sk && sk.speaker && e.speaker && sk.speaker !== e.speaker) rep.warn('scripture', W(key), `speaker "${e.speaker}" differs from SPEC 4.3 ("${sk.speaker}")`);
    else if (sk && sk.refOnly && !e.refOnly) rep.warn('scripture', W(key), 'SPEC lists this key as reference-only');
  }
  for (const [key, sk] of spec.keys) {
    if (!scr[key]) {
      if (/^MT_9_/.test(key)) rep.error('scripture', W(key), 'required Matthew 9 key is missing');
      else rep.warn('scripture', W(key), `SPEC 4.3 key is missing${sk.refOnly ? ' (reference-only)' : ''}`);
    }
  }
  for (const key of Object.keys(EVENT_GROUP)) if (!scr[key]) rep.error('scripture', W(key), 'required Matthew 9 key is missing');
  // Cross-consistency of partial keys of the same verse.
  const fullsByRef = new Map();
  for (const [key, e] of Object.entries(scr)) {
    if (!isObj(e) || !isObj(e.full) || !isT(e.ref)) continue;
    const r = e.ref.en;
    if (!fullsByRef.has(r)) fullsByRef.set(r, []);
    fullsByRef.get(r).push({ key, full: e.full });
  }
  for (const [r, list] of fullsByRef) {
    const a = list[0];
    for (const b of list.slice(1)) {
      if (a.full.ko !== b.full.ko || a.full.en !== b.full.en) rep.warn('scripture', W(b.key), `"full" text differs from ${a.key} for the same verse (${r})`);
    }
    for (const [key, e] of Object.entries(scr)) {
      if (isObj(e) && !e.full && !e.refOnly && isT(e.ref) && e.ref.en === r && typeof e.ko === 'string' && e.ko.length > 10) {
        if (e.ko !== a.full.ko || e.en !== a.full.en) rep.warn('scripture', W(key), `whole-verse text differs from the "full" text of ${a.key}`);
      }
    }
  }
  const b1 = scr.MT_9_2B1;
  const b2 = scr.MT_9_2B2;
  const bb = scr.MT_9_2B;
  if (isObj(b1) && isObj(b2) && isObj(bb)) {
    if (bb.ko !== b1.ko + ' ' + b2.ko) rep.warn('scripture', W('MT_9_2B'), 'ko is not MT_9_2B1 + " " + MT_9_2B2');
    if (bb.en !== b1.en + ' ' + b2.en) rep.warn('scripture', W('MT_9_2B'), 'en is not MT_9_2B1 + " " + MT_9_2B2');
  }
  // Verification status.
  try {
    const src = fs.readFileSync(path.join(root, 'data', 'scripture.js'), 'utf8');
    if (/NOT YET VERIFIED|STATUS:\s*DRAFT/i.test(src)) rep.warn('scripture', 'data/scripture.js', 'header still marks the texts as DRAFT / NOT YET VERIFIED');
  } catch (e) { /* fixture mode */ }
  try {
    const doc = fs.readFileSync(path.join(root, 'docs', 'scripture-sources.md'), 'utf8');
    const status = {};
    const lines = doc.split('\n');
    for (const key of Object.keys(scr)) {
      if (scr[key] && scr[key].refOnly) continue;
      const re = new RegExp('\\b' + key + '\\b');
      let st = null;
      for (let i = 0; i < lines.length && !st; i++) {
        if (!re.test(lines[i])) continue;
        for (let j = i; j < Math.min(lines.length, i + 8); j++) {
          const m = lines[j].match(/\b(SINGLE-SOURCE|UNVERIFIED|VERIFIED)\b/);
          if (m) { st = m[1]; break; }
          if (j > i && /^#{1,4}\s/.test(lines[j])) break;
        }
      }
      status[key] = st || 'no entry';
    }
    const tally = {};
    Object.values(status).forEach((s) => { tally[s] = (tally[s] || 0) + 1; });
    rep.info('scripture', 'docs/scripture-sources.md', 'verification status: ' + Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(', '));
    const mt9 = Object.keys(status).filter((k) => /^MT_9_/.test(k) && status[k] !== 'VERIFIED');
    if (mt9.length) rep.warn('scripture', 'docs/scripture-sources.md', `Matthew 9 keys not marked VERIFIED: ${mt9.join(', ')}`);
    const other = Object.keys(status).filter((k) => !/^MT_9_/.test(k) && status[k] !== 'VERIFIED');
    if (other.length) rep.info('scripture', 'docs/scripture-sources.md', `keys not marked VERIFIED: ${other.map((k) => `${k} (${status[k]})`).join(', ')}`);
  } catch (e) { /* no sources doc */ }
}

function checkMeta(rep, data, cx) {
  const m = data.meta;
  if (!isObj(m)) { rep.error('meta', 'data/meta.js', 'BHS.meta missing'); return; }
  const W = (p) => `meta › ${p}`;
  ['title', 'subtitle', 'disclaimer'].forEach((k) => checkT(m[k], cx, W(k), {}));
  checkT(m.bibleNotice, cx, W('bibleNotice'), { allowMixed: true });
  for (const l of LENSES) {
    const L = m.lenses && m.lenses[l];
    if (!isObj(L)) { rep.error('meta', W(`lenses.${l}`), 'missing'); continue; }
    checkT(L.label, cx, W(`lenses.${l}.label`), {});
    checkT(L.desc, cx, W(`lenses.${l}.desc`), {});
  }
  if (!Array.isArray(m.routeOrder) || ROUTE_IDS.some((r) => !m.routeOrder.includes(r))) rep.error('meta', W('routeOrder'), `must list ${ROUTE_IDS.join(', ')}`);
  for (const rid of ROUTE_IDS) {
    const r = m.routes && m.routes[rid];
    if (!isObj(r)) { rep.error('meta', W(`routes.${rid}`), 'missing'); continue; }
    if (!isObj(data.characters) || !data.characters[r.protagonist]) rep.error('meta', W(`routes.${rid}.protagonist`), `unknown character ${JSON.stringify(r.protagonist)}`);
    ['name', 'title', 'tagline', 'firstLine'].forEach((k) => checkT(r[k], cx, W(`routes.${rid}.${k}`), {}));
    for (const l of LENSES) checkT(r.lensDesc && r.lensDesc[l], cx, W(`routes.${rid}.lensDesc.${l}`), {});
    for (const l of LENSES) checkT(m.endings && m.endings[rid] && m.endings[rid][l], cx, W(`endings.${rid}.${l}`), {});
    const er = (m.endings && m.endings[rid]) || {};
    if (CUT_ROUTES.includes(rid)) {
      if (er.cut === undefined) rep.error('meta', W(`endings.${rid}.cut`), 'missing (the title of the cut ending, SPEC 4.1)');
      else checkT(er.cut, cx, W(`endings.${rid}.cut`), {});
    } else if (er.cutNote === undefined) rep.warn('meta', W(`endings.${rid}.cutNote`), 'missing (the note shown in the gallery\'s cut column, SPEC 4.1)');
    else checkT(er.cutNote, cx, W(`endings.${rid}.cutNote`), {});
  }
  if (!isObj(m.cut)) rep.error('meta', W('cut'), 'missing { label, desc } for the cut column and the cut ending card (SPEC 4.1)');
  else {
    checkT(m.cut.label, cx, W('cut.label'), {});
    checkT(m.cut.desc, cx, W('cut.desc'), {});
  }
}

function checkCharacters(rep, data, cx) {
  const c = data.characters;
  if (!isObj(c)) { rep.error('characters', 'data/characters.js', 'BHS.characters missing'); return; }
  for (const [id, ch] of Object.entries(c)) {
    const W = `characters › ${id}`;
    if (!isObj(ch)) { rep.error('characters', W, 'must be an object'); continue; }
    checkT(ch.name, cx, `${W} › name`, {});
    checkT(ch.role, cx, `${W} › role`, { allowEmpty: id === 'jesus' });
    if (typeof ch.color !== 'string' || !/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(ch.color)) rep.warn('characters', W, `color should be "#hex", got ${JSON.stringify(ch.color)}`);
    if (PSEUDO_SPEAKERS.includes(id)) rep.error('characters', W, 'id collides with a pseudo-speaker');
  }
  const needed = ['menahem', 'hanan', 'yonah', 'asher', 'mother', 'brother', 'neighbor', 'partners', 'passerby', 'crowd', 'scribes', 'jesus'];
  for (const id of needed) if (!c[id]) rep.error('characters', `characters › ${id}`, 'SPEC 6.1 character missing');
}

function checkCommon(rep, data, cx) {
  const c = data.common;
  if (!isObj(c)) { rep.error('common', 'data/common.js', 'BHS.common missing'); return; }
  const pcx = Object.assign({}, cx, { path: 'common › prologue', story: true, phase: 'prologue', file: 'data/common.js', cursor: { pos: 0 } });
  let bgNow = null;
  pcx.setBg = (bg) => { bgNow = bg; };
  pcx.bgNow = () => bgNow;
  if (!Array.isArray(c.prologue) || !c.prologue.length) rep.error('common', 'common › prologue', 'prologue must be a non-empty beat list');
  else checkBeats(c.prologue, pcx, 'beats');
  checkT(c.routeSelect && c.routeSelect.prompt, cx, 'common › routeSelect.prompt', { kind: 'prompt' });
  checkT(c.mismatchLine, Object.assign({}, cx, { story: true }), 'common › mismatchLine', { kind: 'line', story: true });
}

function checkUi(rep, data, cx) {
  const ui = data.ui;
  if (ui === undefined) return;
  if (!isObj(ui)) { rep.error('ui', 'data/ui-strings.js', 'BHS.ui must be an object of T strings'); return; }
  let n = 0;
  const walk = (o, p, depth) => {
    if (depth > 6) return;
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'function') continue;
      if (isObj(v) && ('ko' in v || 'en' in v)) { n++; checkT(v, cx, `ui › ${p}${k}`, { ui: true }); } else if (isObj(v)) walk(v, `${p}${k}.`, depth + 1);
    }
  };
  walk(ui, '', 0);
  rep.info('ui', 'data/ui-strings.js', `${n} UI strings checked`);
}

// ---------------------------------------------------------------------------------------------
// Route checks

function prescanFlags(route) {
  const all = new Map();
  for (const b of Array.isArray(route.beats) ? route.beats : []) {
    if (!isObj(b) || b.type !== 'choice' || !Array.isArray(b.options)) continue;
    for (const o of b.options) {
      if (isObj(o) && isObj(o.set)) {
        for (const [f, v] of Object.entries(o.set)) {
          if (!all.has(f)) all.set(f, new Set());
          all.get(f).add(v);
        }
      }
    }
  }
  return all;
}

function checkRoute(rep, data, rid, gcx, opts) {
  const route = data.routes[rid];
  if (route === undefined) return null;
  const file = `data/routes/${rid}.js`;
  if (!isObj(route)) { rep.error('schema', rid, 'route must be an object'); return null; }
  const usage = new Set();
  const allFlags = prescanFlags(route);
  let bgNow = null;
  const cx = Object.assign({}, gcx, {
    rid, file, path: rid, story: true, phase: 'main', seen: new Set(), flags: new Map(), allFlags,
    counters: new Set(), actions: new Set(), ids: new Set(), choiceList: [], lastChoice: null, usage, cursor: { pos: 0 },
    allTexts: [], cutOptions: []
  });
  cx.setBg = (bg) => { bgNow = bg; };
  cx.bgNow = () => bgNow;
  if (route.id !== rid) rep.error('schema', rid, `route id is ${JSON.stringify(route.id)}, expected "${rid}"`);
  const unknown = Object.keys(route).filter((k) => !ROUTE_KEYS.includes(k));
  if (unknown.length) rep.warn('schema', rid, `unknown top-level key(s): ${unknown.join(', ')} (route titles live in meta.js)`);
  // Actions (Asher).
  if (route.actions !== undefined) {
    if (!Array.isArray(route.actions)) rep.error('schema', `${rid} › actions`, 'must be an array');
    else {
      if (rid !== 'asher' && route.actions.length) rep.warn('schema', `${rid} › actions`, 'persistent actions are an Asher-route device (SPEC 4.5)');
      route.actions.forEach((a, i) => {
        const w = `${rid} › actions[${i}]`;
        if (!isObj(a)) { rep.error('schema', w, 'action must be an object'); return; }
        const ex = Object.keys(a).filter((k) => !['id', 'label', 'replies', 'counter'].includes(k));
        if (ex.length) rep.warn('schema', w, `unknown key(s): ${ex.join(', ')}`);
        if (typeof a.id !== 'string' || !a.id) rep.error('schema', w, 'action id must be a string');
        else if (cx.actions.has(a.id)) rep.error('schema', w, `duplicate action id ${a.id}`);
        else cx.actions.add(a.id);
        checkT(a.label, cx, `${w} › label`, { story: true });
        if (!Array.isArray(a.replies) || !a.replies.length) rep.error('schema', w, 'replies must be a non-empty array of texts');
        else a.replies.forEach((t, j) => checkT(t, cx, `${w} › replies[${j}]`, { kind: 'line', story: true }));
        if (typeof a.counter !== 'string' || !a.counter) rep.error('schema', w, 'counter must be a non-empty string');
        else if (cx.counters.has(a.counter)) rep.error('schema', w, `duplicate counter ${a.counter}`);
        else cx.counters.add(a.counter);
      });
    }
  }
  if (rid === 'asher') {
    for (const id of ['getup', 'goout']) if (!cx.actions.has(id)) rep.error('schema', `${rid} › actions`, `missing persistent action "${id}" (SPEC 4.5)`);
  }
  // Main beats.
  if (!Array.isArray(route.beats) || !route.beats.length) rep.error('schema', `${rid} › beats`, 'beats must be a non-empty array');
  else checkBeats(route.beats, cx, 'beats');
  // Choice order (SPEC 4.5: exactly four choices c1..c4 in order; the last counts double).
  const ids = cx.choiceList.map((b) => b.id);
  if (ids.length !== CHOICE_COUNT || ids.some((id, i) => id !== CHOICE_IDS[i])) {
    rep.error('schema', `${rid} › beats`, `expected exactly ${CHOICE_COUNT} choices ${CHOICE_IDS.join(', ')} in order, found [${ids.join(', ')}]`);
  }
  // Cut options (SPEC 4.5): scribe and friend exactly one, in c2 or c3; asher none (he cannot walk away).
  const cuts = cx.cutOptions;
  const cutRoute = CUT_ROUTES.includes(rid);
  if (cutRoute) {
    if (!cuts.length) rep.error('cut', `${rid} › beats`, `no cut option; the ${rid} route needs exactly one option with cut: true, in ${CUT_CHOICES.join(' or ')} (SPEC 4.5)`);
    else if (cuts.length > 1) rep.error('cut', `${rid} › beats`, `${cuts.length} cut options (${cuts.map((c) => c.choice + '/' + c.option).join(', ')}); exactly one is allowed (SPEC 4.5)`);
    for (const c of cuts) if (!CUT_CHOICES.includes(c.choice)) rep.error('cut', c.w, `the cut option sits in ${c.choice}; it must be in ${CUT_CHOICES.join(' or ')} (SPEC 4.5)`);
  } else if (cuts.length) {
    rep.error('cut', `${rid} › beats`, `the ${rid} route must not have a cut option (SPEC 4.5${rid === 'asher' ? ': Asher cannot walk away' : ''}); found ${cuts.map((c) => c.choice + '/' + c.option).join(', ')}`);
  }
  const cutChoice = cuts.length ? cuts[0].choice : null;
  // Endings.
  const ecx = Object.assign({}, cx, { phase: 'ending', allowLast: true, seen: new Set(CHOICE_IDS), flags: new Map([...allFlags].map(([k, v]) => [k, new Set(v)])), lastChoice: null });
  if (route.endingPreface !== undefined) checkBeats(route.endingPreface, Object.assign({}, ecx, { path: `${rid} › endingPreface` }), 'beats');
  if (!isObj(route.endings)) rep.error('schema', `${rid} › endings`, `endings must be an object with keys "1", "2", "3"${cutRoute ? ' and "cut"' : ''}`);
  else {
    const ek = Object.keys(route.endings);
    for (const l of ['1', '2', '3']) {
      const e = route.endings[l];
      const w = `${rid} › endings.${l}`;
      if (!isObj(e)) { rep.error('schema', w, 'missing ending'); continue; }
      const ex = Object.keys(e).filter((k) => k !== 'beats' && k !== 'last');
      if (ex.length) rep.warn('schema', w, `unknown key(s): ${ex.join(', ')} (ending titles live in meta.js)`);
      if (!Array.isArray(e.beats)) rep.error('schema', w, 'beats must be an array');
      else checkBeats(e.beats, Object.assign({}, ecx, { path: w }), 'beats');
      checkT(e.last, Object.assign({}, ecx, { path: w }), `${w} › last`, { kind: 'line', story: true });
    }
    const ce = route.endings.cut;
    const cw = `${rid} › endings.cut`;
    if (cutRoute && !isObj(ce)) rep.error('cut', cw, 'missing; a route with a cut option needs endings.cut = { beats, last } (SPEC 4.5)');
    else if (!cutRoute && ce !== undefined) rep.error('cut', cw, `the ${rid} route has no cut ending by design; remove endings.cut (meta.endings.${rid}.cutNote fills the gallery cell)`);
    else if (isObj(ce)) {
      // Only choices up to the cut are asked on a cut path, and only their flags can be set.
      const upto = cutChoice ? CHOICE_IDS.slice(0, CHOICE_IDS.indexOf(cutChoice) + 1) : CHOICE_IDS;
      const cutFlags = new Map();
      for (const cb of cx.choiceList) {
        if (!upto.includes(cb.id)) continue;
        for (const o of cb.options || []) {
          if (!isObj(o) || !isObj(o.set)) continue;
          for (const [f, v] of Object.entries(o.set)) { if (!cutFlags.has(f)) cutFlags.set(f, new Set()); cutFlags.get(f).add(v); }
        }
      }
      const ccx = Object.assign({}, ecx, { path: cw, inCutEnding: true, cutChoice, seen: new Set(upto), flags: cutFlags });
      const ex = Object.keys(ce).filter((k) => k !== 'beats' && k !== 'last');
      if (ex.length) rep.warn('schema', cw, `unknown key(s): ${ex.join(', ')} (ending titles live in meta.js)`);
      if (!Array.isArray(ce.beats)) rep.error('schema', cw, 'beats must be an array');
      else checkBeats(ce.beats, ccx, 'beats');
      checkT(ce.last, ccx, `${cw} › last`, { kind: 'line', story: true });
    }
    const extraE = ek.filter((k) => !['1', '2', '3', 'cut'].includes(k));
    if (extraE.length) rep.warn('schema', `${rid} › endings`, `unexpected ending key(s): ${extraE.join(', ')}`);
  }
  if (route.endingCoda !== undefined) checkBeats(route.endingCoda, Object.assign({}, ecx, { path: `${rid} › endingCoda` }), 'beats');
  // Asher press on getup.
  if (rid === 'asher') {
    const flat = JSON.stringify(route.beats || []);
    if (!/"type":"press","action":"getup"|"action":"getup"[^}]*"type":"press"/.test(flat)) {
      const hasPress = (route.beats || []).some((b) => isObj(b) && b.type === 'press' && b.action === 'getup');
      if (!hasPress) rep.error('schema', `${rid} › beats`, 'no press beat with action "getup" (SPEC 4.5/scenario c9)');
    }
  }
  // Unused flags.
  const usedFlags = new Set();
  const collectFlags = (c) => {
    if (!isObj(c)) return;
    if ('flag' in c) usedFlags.add(c.flag);
    ['all', 'any'].forEach((k) => Array.isArray(c[k]) && c[k].forEach(collectFlags));
    if ('not' in c) collectFlags(c.not);
  };
  JSON.stringify(route, (k, v) => { if (k === 'when') collectFlags(v); if (k === 'highlight' && isObj(v)) usedFlags.add(v.flag); return v; });
  for (const f of allFlags.keys()) if (!usedFlags.has(f)) rep.info('cond', `${rid}`, `flag "${f}" is set but never used in a condition or highlight`);
  // Guardrail: MT_9_3 / MT_9_3Q only in the scribe route.
  if (rid !== 'scribe') {
    for (const k of ['MT_9_3', 'MT_9_3Q']) if (usage.has(k)) rep.error('guard', rid, `${k} (the scribes' unspoken thought) appears in the ${rid} route (SPEC 6.4: scribe route only)`);
  }
  return { cx, usage };
}

function routeStats(rep, data, rid, rcx, canon, engine) {
  const route = data.routes[rid];
  const { table, cuts, ok } = lensTable(route);
  const L = CHOICE_COUNT - 1;
  const fmtRow = (i) => table[i].map((l, j) => (cuts[i][j] ? 'x' : l === null ? '-' : l)).join('');
  // ---- Balance (SPEC 8): c1-c3 cover lenses 1-3 (the fourth option any lens or null; a cut option is
  // the null one); the last choice has four lensed options covering 1-3.
  const balanceLines = [];
  if (ok) {
    const counts = { 1: 0, 2: 0, 3: 0, null: 0 };
    const covers = (arr) => LENSES.every((l) => arr.includes(l));
    for (let c = 0; c < CHOICE_COUNT; c++) {
      const cid = CHOICE_IDS[c];
      const lz = table[c];
      const w = `${rid} › ${cid}`;
      if (c < L) {
        lz.forEach((l) => { counts[l === null ? 'null' : l]++; });
        if (!covers(lz)) rep.error('balance', w, `options must include lenses 1, 2 and 3 (SPEC 8), got [${fmtRow(c)}]`);
      } else if (lz.some((l) => l === null) || !covers(lz)) {
        rep.error('balance', w, `${cid} (the last choice) needs four options with a lens, covering 1, 2 and 3 (SPEC 8), got [${fmtRow(c)}]`);
      }
    }
    balanceLines.push(`${pad(rid, 7)} c1-c3: L1 ${counts[1]}  L2 ${counts[2]}  L3 ${counts[3]}  null ${counts.null}   ${LAST_CHOICE} [${table[L].join(',')}]`);
    balanceLines.push('        ' + CHOICE_IDS.map((cid, i) => `${cid}:${fmtRow(i)}`).join(' '));
  } else {
    balanceLines.push(`${pad(rid, 7)} (choices incomplete; balance and enumeration skipped)`);
  }
  // ---- Enumeration of all 4^4 paths (SPEC 5.1, 8).
  const distLines = [];
  let dist = null;
  if (ok) {
    dist = enumerateEndings(table, cuts);
    const nonCut = dist.total - dist.cut;
    const cutShare = dist.cut / dist.total;
    if (cutShare > SHARE.cutMax + 1e-9) rep.error('dist', rid, `cut paths are ${pct(cutShare)} of all ${dist.total} paths (SPEC 8: at most ${pct(SHARE.cutMax)})`);
    const share = (l) => (nonCut ? dist.counts[l] / nonCut : 0);
    for (const l of LENSES) {
      const sh = share(l);
      if (sh < SHARE.error[0] || sh > SHARE.error[1]) rep.error('dist', rid, `ending ${l} is ${pct(sh)} of the ${nonCut} non-cut paths (allowed 15-55%; SPEC 8: 20-50%)`);
      else if (sh < SHARE.warn[0] - 1e-9 || sh > SHARE.warn[1] + 1e-9) rep.warn('dist', rid, `ending ${l} is ${pct(sh)} of the ${nonCut} non-cut paths (SPEC 8: 20-50%)`);
    }
    distLines.push(`${pad(rid, 7)} non-cut ${padL(nonCut, 3)}/${dist.total}: ① ${padL(pct(share(1)), 6)}  ② ${padL(pct(share(2)), 6)}  ③ ${padL(pct(share(3)), 6)}   ` +
      `cut ${padL(pct(cutShare), 6)}   mismatch ${padL(pct(nonCut ? dist.mismatch / nonCut : 0), 6)}   tie-break ${padL(pct(nonCut ? dist.ties / nonCut : 0), 6)}`);
    distLines.push(`        by ${LAST_CHOICE} pick (ending ①/②/③ % of its non-cut paths): ` + OPTION_IDS.map((oid, i) => {
      const bl = dist.byLast[i];
      const n = bl.n - bl.cut;
      return `${oid}(L${table[L][i]})→ ${LENSES.map((l) => (n ? Math.round(bl[l] / n * 100) : 0)).join('/')}`;
    }).join('  '));
  }
  // ---- Engine cross-check on every path.
  const engineLines = [];
  if (engine && ok) {
    if (typeof engine.computeLens !== 'function') rep.error('engine', 'js/engine.js', 'BHS.engine.computeLens is not a function (SPEC 5.1)');
    else {
      let bad = 0;
      let first = null;
      let threw = null;
      let nCut = 0;
      const num = (v) => (v == null ? null : Number(v));
      for (const picks of allPicks()) {
        const ch = picksToChoices(picks);
        const mine = computeLensFor(route, ch);
        if (mine.cut) nCut++;
        let theirs;
        try { theirs = engine.computeLens(rid, Object.assign({}, ch)); } catch (e) { threw = e; break; }
        const sc = theirs && theirs.scores ? theirs.scores : {};
        const same = theirs && num(theirs.lens) === mine.lens && !!theirs.mismatch === mine.mismatch && !!theirs.cut === mine.cut &&
          num(theirs.lastLens) === mine.lastLens && num(theirs.c10Lens) === mine.lastLens &&
          LENSES.every((l) => Number(sc[l] != null ? sc[l] : sc[String(l)]) === mine.scores[l]);
        if (!same) { bad++; if (!first) first = { ch, mine, theirs }; }
      }
      if (threw) rep.error('engine', `${rid}`, `BHS.engine.computeLens threw: ${threw.message}`);
      else if (bad) {
        rep.error('engine', `${rid}`, `BHS.engine.computeLens disagrees with SPEC 5.1 on ${bad}/${PATH_COUNT} paths; e.g. choices ${CHOICE_IDS.map((c) => first.ch[c]).join('')} → engine ${snip(JSON.stringify(first.theirs), 140)}, expected ${JSON.stringify(first.mine)}`);
      } else engineLines.push(`${pad(rid, 7)} computeLens agrees on ${PATH_COUNT}/${PATH_COUNT} paths (${nCut} of them cut)`);
    }
    if (typeof engine.createGame === 'function') {
      const r = enginePathCheck(rep, data, rid, engine);
      if (r) engineLines.push(`${pad(rid, 7)} ${r}`);
    }
    if (typeof engine.evalCond !== 'function') rep.warn('engine', 'js/engine.js', 'BHS.engine.evalCond is not exposed (SPEC 5.1)');
    if (typeof engine.resolveText !== 'function') rep.warn('engine', 'js/engine.js', 'BHS.engine.resolveText is not exposed (SPEC 5.1)');
  }
  // ---- Every path: screens, reading time, crowd order, passerby, light, ending lengths.
  const prologueItems = [];
  if (data.common && Array.isArray(data.common.prologue)) {
    for (const b of data.common.prologue) if (isObj(b)) prologueItems.push({ kind: b.type, beat: b });
  }
  const pro = readingStats(prologueItems, data);
  const res = [];
  const orderProblems = new Map();
  const passerbyMissing = [];
  const lightProblems = new Map();
  const endingLen = {};
  const overMax = [];
  const overWarn = [];
  let simFailed = false;
  for (const picks of allPicks()) {
    const label = picks.map((p) => OPTION_IDS[p]).join('');
    const ch = picksToChoices(picks);
    let sim;
    try { sim = simulate(route, data, ch); } catch (e) { rep.error('internal', rid, `simulation failed on ${label}: ${e.message}`); simFailed = true; break; }
    const st = readingStats(sim.out, data);
    const total = { screens: st.screens + pro.screens, choices: st.choices, koChars: st.koChars + pro.koChars, enWords: st.enWords + pro.enWords };
    const endKey = sim.cut ? 'cut' : String(sim.lens.lens);
    res.push({ label, cut: !!sim.cut, st, mins: minutes(st), totalMins: minutes(total), lens: sim.lens.lens, endKey });
    if (st.screens > SCREENS.max) overMax.push({ label, n: st.screens });
    else if (st.screens > SCREENS.warn) overWarn.push({ label, n: st.screens });
    // Ending length: screens of the ending beats (the last line not counted).
    const eb = sim.out.filter((it) => /^ending/.test(it.phase) && SCREEN_KINDS.has(it.kind)).length;
    const el = endingLen[endKey] || (endingLen[endKey] = { min: Infinity, max: -Infinity, eg: label });
    if (eb < el.min) el.min = eb;
    if (eb > el.max) { el.max = eb; el.eg = label; }
    // Crowd order on the main beats (with reactions). A cut path may stop early: on it only the order
    // of what was shown is checked, not what is missing.
    const first = {};
    sim.out.forEach((it, idx) => {
      if (!/^main/.test(it.phase)) return;
      for (const k of keysShown(it)) {
        if (!(k in EVENT_GROUP)) continue;
        if (first[k] === undefined) first[k] = idx;
        if ((k === 'MT_9_2B' || k === 'MT_9_2B2' || k === 'MT_9_6B') && it.light !== 'bright' && it.kind === 'verse') {
          lightProblems.set(k, (lightProblems.get(k) || 0) + 1);
        }
      }
    });
    const probs = [];
    const has = (k) => first[k] !== undefined;
    // Each event group spans from its first shown key to its last required key; groups must not overlap
    // out of order. Later recalls (callbacks) of a key do not count, only first appearances.
    const reqSet = (g) => {
      if (g === 3) return has('MT_9_2B1') && has('MT_9_2B2') ? ['MT_9_2B1', 'MT_9_2B2'] : ['MT_9_2B'];
      if (g === 4) return has('MT_9_3Q') ? ['MT_9_3Q'] : ['MT_9_3'];
      if (g === 5) return has('MT_9_4N') && has('MT_9_4Q') ? ['MT_9_4N', 'MT_9_4Q'] : ['MT_9_4'];
      if (g === 7) return ['MT_9_6A', 'MT_9_6N', 'MT_9_6B'];
      return Object.keys(EVENT_GROUP).filter((k) => EVENT_GROUP[k] === g);
    };
    const groups = [];
    for (let g = 1; g <= 9; g++) {
      const keys = Object.keys(EVENT_GROUP).filter((k) => EVENT_GROUP[k] === g && has(k));
      if (!keys.length) continue;
      const start = Math.min(...keys.map((k) => first[k]));
      const req = reqSet(g).filter(has);
      const endKey2 = req.length ? req.reduce((x, y) => (first[x] >= first[y] ? x : y)) : keys[0];
      groups.push({ g, start, end: first[endKey2], endKey: endKey2, startKey: keys.find((k) => first[k] === start) });
    }
    for (let i = 1; i < groups.length; i++) {
      const ga = groups[i - 1];
      const gb = groups[i];
      if (ga.end > gb.start) probs.push(`${gb.startKey} (${EVENT_LABEL[gb.g]}) is shown before ${ga.endKey} (${EVENT_LABEL[ga.g]})`);
    }
    for (const [x, y] of SUB_ORDER) if (has(x) && has(y) && first[x] > first[y]) probs.push(`${y} is shown before ${x}`);
    if (!sim.cut) {
      if (!has('MT_9_2A')) probs.push('MT_9_2A (9:2a) not shown');
      if (!(has('MT_9_2B') || (has('MT_9_2B1') && has('MT_9_2B2')))) probs.push('first words (MT_9_2B or MT_9_2B1+2B2) not shown');
      if (!(has('MT_9_4') || (has('MT_9_4N') && has('MT_9_4Q')))) probs.push('9:4 (MT_9_4N + MT_9_4Q) not shown');
      for (const k of ['MT_9_5', 'MT_9_6A', 'MT_9_6N', 'MT_9_6B', 'MT_9_7', 'MT_9_8']) if (!has(k)) probs.push(`${k} not shown`);
      if (!has('MT_9_1')) probs.push('MT_9_1 (boat) not shown; optional in the short routes (INFO only)');
      if (rid === 'scribe' && !has('MT_9_3Q') && !has('MT_9_3')) probs.push('MT_9_3Q (scribes\' thought) not shown in the scribe route (WARN only)');
    }
    for (const pr of probs) {
      if (!orderProblems.has(pr)) orderProblems.set(pr, []);
      orderProblems.get(pr).push(label);
    }
    // Passerby line coverage (friend and asher must show it on every path).
    const shownKo = sim.out.filter((it) => it.kind === 'line').map((it) => (isT(it.beat.text) ? it.beat.text.ko : '')).join(' ');
    const shownEn = sim.out.filter((it) => it.kind === 'line').map((it) => (isT(it.beat.text) ? it.beat.text.en : '')).join(' ');
    if (rid !== 'scribe' && (!shownKo.includes(canon.passerby.ko) || !shownEn.includes(canon.passerby.en))) passerbyMissing.push(label);
  }
  const nPaths = res.length;
  const nonCutPaths = res.filter((r) => !r.cut).length;
  for (const [pr, labels] of orderProblems) {
    const level = /INFO only/.test(pr) ? 'INFO' : /WARN only/.test(pr) ? 'WARN' : 'ERROR';
    const scope = /not shown/.test(pr) ? `${labels.length}/${nonCutPaths} non-cut paths` : `${labels.length}/${nPaths} paths`;
    rep.add(level, 'canon', rid, `crowd sequence (SPEC 6.4): ${pr.replace(/ \((WARN|INFO) only\)/, '')} on ${scope} (e.g. ${labels[0]})`);
  }
  for (const [k, n] of lightProblems) rep.warn('fx', rid, `${k} is shown without fx light "bright" on ${n}/${nPaths} paths (SPEC 4.5)`);
  if (rid !== 'scribe' && passerbyMissing.length) {
    rep.error('canon', rid, `the SPEC 6.3 passerby line (verbatim, ko and en) is not shown on ${passerbyMissing.length}/${nPaths} paths (e.g. ${passerbyMissing[0]})`);
  }
  // Screen budget (SPEC 3.3): at most 32 screens on any path; warn above 30.
  if (overMax.length) {
    const worst = overMax.reduce((x, y) => (y.n > x.n ? y : x));
    rep.error('screens', rid, `${overMax.length}/${nPaths} paths exceed ${SCREENS.max} screens (SPEC 3.3); worst ${worst.n} on ${worst.label}`);
  }
  if (overWarn.length) {
    const worst = overWarn.reduce((x, y) => (y.n > x.n ? y : x));
    const band = SCREENS.warn + 1 === SCREENS.max ? `${SCREENS.max}` : `${SCREENS.warn + 1}-${SCREENS.max}`;
    rep.warn('screens', rid, `${overWarn.length}/${nPaths} paths have ${band} screens (SPEC 3.3: up to ${SCREENS.warn} expected, ${SCREENS.max} at most); worst ${worst.n} on ${worst.label}`);
  }
  // Ending lengths (SPEC 4.5): lens endings 1-3 beats, endings.cut 2-4 beats (plus the last line).
  for (const [k, el] of Object.entries(endingLen)) {
    const [lo, hi] = k === 'cut' ? ENDING_BEATS.cut : ENDING_BEATS.lens;
    if (el.max > hi || el.min < lo) {
      rep.warn('ending', `${rid} › endings.${k}`, `shows ${el.min === el.max ? el.min : el.min + '-' + el.max} beat screen(s) before the last line (SPEC 4.5: ${lo}-${hi}); e.g. ${el.eg}`);
    }
  }
  // Lane and crowd backgrounds at the shared moments.
  const simA = !simFailed ? simulate(route, data, picksToChoices([0, 0, 0, 0])) : null;
  if (simA) {
    for (const it of simA.out) {
      if (it.kind === 'line' && it.beat.speaker === 'passerby' && !['lane', 'sky_carried'].includes(it.bg)) {
        rep.warn('canon', rid, `the passerby (SPEC 6.3, the lane) speaks on bg "${it.bg}" (expected lane${rid === 'asher' ? ' or sky_carried' : ''})`);
      }
    }
    const v = simA.out.find((x) => x.kind === 'verse' && x.beat.key === 'MT_9_2A');
    if (v && !['crowd', 'crowd_lying'].includes(v.bg)) rep.warn('canon', rid, `MT_9_2A is shown on bg "${v.bg}" (expected crowd or crowd_lying)`);
    const lastLight = simA.out.filter((x) => x.kind === 'fx' && x.beat.fx === 'light').pop();
    if (!simA.cut && lastLight && lastLight.beat.level !== 'off') rep.info('fx', rid, `the light is still "${lastLight.beat.level}" at the end of the aaaa path (SPEC 4.5: off when leaving)`);
  }
  // Screens and time summary.
  const timeLines = [];
  let summary = null;
  if (res.length) {
    const byLabel = (label) => res.find((r) => r.label === label);
    const row = (label, r) => `${pad(rid, 7)} ${pad(label, 13)} screens ${padL(r.st.screens, 3)}  choices ${r.st.choices}  ` +
      `silent ko ${r.mins.ko.toFixed(1)} / en ${r.mins.en.toFixed(1)} min   aloud ko ${r.mins.koAloud.toFixed(1)} / en ${r.mins.enAloud.toFixed(1)} min   ending ${r.endKey}`;
    timeLines.push(row('aaaa', byLabel('aaaa')));
    timeLines.push(row('dddd', byLabel('dddd')));
    const nc = res.filter((r) => !r.cut);
    const cutRes = res.filter((r) => r.cut);
    const stat = (arr, f, d = 1) => (arr.length ? `${Math.min(...arr.map(f)).toFixed(d)} / ${median(arr.map(f)).toFixed(d)} / ${Math.max(...arr.map(f)).toFixed(d)}` : '-');
    if (nc.length) {
      timeLines.push(`${pad(rid, 7)} ${pad(`non-cut ${nc.length}`, 13)} screens min/median/max ${stat(nc, (r) => r.st.screens, 0)}   aloud ko ${stat(nc, (r) => r.mins.koAloud)} min   en ${stat(nc, (r) => r.mins.enAloud)} min   silent ko ${stat(nc, (r) => r.mins.ko)}`);
    }
    if (cutRes.length) {
      timeLines.push(`${pad(rid, 7)} ${pad(`cut ${cutRes.length}`, 13)} screens min/median/max ${stat(cutRes, (r) => r.st.screens, 0)}   aloud ko ${stat(cutRes, (r) => r.mins.koAloud)} min   en ${stat(cutRes, (r) => r.mins.enAloud)} min`);
    }
    const medScreens = nc.length ? median(nc.map((r) => r.st.screens)) : 0;
    if (nc.length && medScreens > SCREENS.medianMax) {
      rep.warn('screens', rid, `the typical (median) non-cut path has ${medScreens} screens (SPEC 3.3 target ${SCREENS.target[0]}-${SCREENS.target[1]})`);
    } else if (nc.length && medScreens < SCREENS.target[0]) {
      rep.info('screens', rid, `the typical (median) non-cut path has ${medScreens} screens (SPEC 3.3 target ${SCREENS.target[0]}-${SCREENS.target[1]})`);
    }
    summary = {
      medianScreens: medScreens,
      maxScreens: Math.max(...res.map((r) => r.st.screens)),
      aloudKo: nc.length ? median(nc.map((r) => r.mins.koAloud)) : 0,
      aloudEn: nc.length ? median(nc.map((r) => r.mins.enAloud)) : 0,
      silentKo: nc.length ? median(nc.map((r) => r.mins.ko)) : 0
    };
  }
  return { balanceLines, distLines, engineLines, timeLines, dist, prologue: pro, summary };
}

// Signature of one shown step, comparable between the reference simulation and the engine.
function sigOfItem(it, data) {
  const b = it.beat || {};
  const ko = (t) => (isT(t) ? t.ko : '');
  if (it.kind === 'line') return it.phase === 'last' ? `last|${ko(b.text)}` : `line|${b.speaker || 'narrator'}|${ko(b.text)}`;
  if (it.kind === 'verse') return `verse|${b.key}`;
  if (it.kind === 'choice') return `choice|${b.id}`;
  if (it.kind === 'press') return `press|${b.action || ''}|${ko(b.label)}`;
  if (it.kind === 'card') return `title|${it.cut ? 'cut' : it.lens}`;
  return null;
}
function sigOfStep(st) {
  const ko = (t) => (isT(t) ? t.ko : typeof t === 'string' ? t : '');
  switch (st.kind) {
    case 'line': return `line|${st.speaker || 'narrator'}|${ko(st.text)}`;
    case 'verse': return `verse|${st.key}`;
    case 'choice': return `choice|${st.id}`;
    case 'press': return `press|${st.action || ''}|${ko(st.label)}`;
    case 'endingTitle': return `title|${st.cut ? 'cut' : st.lens}`;
    case 'last': return `last|${ko(st.text)}`;
    default: return `${st.kind}|`;
  }
}

// Drives BHS.engine.createGame() along every choice path (4^4) and compares every shown step with
// simulate(), cut paths included, plus the ending id ("<route>-<lens>" or "<route>-cut").
function enginePathCheck(rep, data, rid, engine) {
  const route = data.routes[rid];
  const warnBefore = Array.isArray(engine.warnings) ? engine.warnings.length : 0;
  let diffs = 0;
  let firstDiff = null;
  let n = 0;
  let nCut = 0;
  for (const picks of allPicks()) {
    const label = picks.map((p) => OPTION_IDS[p]).join('');
    const ch = picksToChoices(picks);
    const sim = simulate(route, data, ch);
    const mine = sim.out.map((it) => sigOfItem(it, data)).filter(Boolean);
    const theirs = [];
    let game;
    try { game = engine.createGame(rid); } catch (e) { rep.error('engine', rid, `createGame("${rid}") threw: ${e.message}`); return null; }
    let endId = null;
    for (let guard = 0; guard < 4000; guard++) {
      const st = game.step;
      if (!st || st.kind === 'end') {
        const v = st && typeof game.view === 'function' ? game.view() : null;
        if (v && v.ending) endId = v.ending.id;
        break;
      }
      theirs.push(sigOfStep(st));
      try {
        if (st.kind === 'choice') { if (!game.choose(ch[st.id])) { theirs.push('choose-failed|' + st.id); break; } } else if (st.kind === 'press') game.press();
        else game.next();
      } catch (e) { theirs.push('threw|' + e.message); break; }
    }
    n++;
    if (sim.cut) nCut++;
    const len = Math.max(mine.length, theirs.length);
    let at = -1;
    for (let i = 0; i < len; i++) if (mine[i] !== theirs[i]) { at = i; break; }
    const expId = rid + '-' + (sim.cut ? 'cut' : sim.lens.lens);
    if (at >= 0 || endId !== expId) {
      diffs++;
      if (!firstDiff) firstDiff = { label, at, mine: mine[at], theirs: theirs[at], endId, expId };
    }
  }
  if (Array.isArray(engine.warnings) && engine.warnings.length > warnBefore) {
    const uniq = [...new Set(engine.warnings.slice(warnBefore))].slice(0, 5);
    rep.warn('engine', rid, `engine warnings during simulated play: ${uniq.map((x) => snip(x, 80)).join(' | ')}`);
  }
  if (diffs) {
    const f = firstDiff;
    const detail = f.at >= 0 ? `step ${f.at + 1}: reference "${snip(f.mine || '(end)', 60)}" vs engine "${snip(f.theirs || '(end)', 60)}"` : `ending ${f.endId} vs reference ${f.expId}`;
    rep.error('engine', rid, `engine play differs from the SPEC reference simulation on ${diffs}/${n} paths; first on ${f.label} at ${detail}`);
    return null;
  }
  return `engine play (createGame) matches the reference step by step on ${n}/${n} paths (${nCut} cut), ending ids included`;
}

function checkPasserbyText(rep, rid, texts, canon) {
  const want = canon.passerby;
  const pb = texts.filter((x) => x.speaker === 'passerby');
  const norm = (s) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
  let okKo = false;
  let okEn = false;
  for (const x of texts) {
    if (x.t.ko.includes(want.ko)) { okKo = true; if (x.speaker && x.speaker !== 'passerby') rep.warn('canon', x.w, `the passerby line is spoken by "${x.speaker}" (expected speaker "passerby")`); }
    if (x.t.en.includes(want.en)) okEn = true;
  }
  if (rid === 'scribe' && !pb.length && !okKo) { rep.info('canon', rid, 'the passerby line is not shown in the scribe route (optional there)'); return; }
  for (const [lang, ok] of [['ko', okKo], ['en', okEn]]) {
    if (ok) continue;
    const joined = pb.map((x) => x.t[lang]).join(' ');
    if (joined.includes(want[lang])) { rep.info('canon', rid, `the passerby line (${lang}) is split across beats`); continue; }
    const close = texts.find((x) => norm(x.t[lang]).includes(norm(want[lang])));
    if (close) { rep.warn('canon', close.w, `the passerby line (${lang}) matches SPEC 6.3 only after normalizing quotes/apostrophes/spaces`); continue; }
    const near = pb.length ? pb.map((x) => `"${snip(x.t[lang], 60)}"`).join(' | ') : 'no passerby line found';
    rep.error('canon', rid, `the SPEC 6.3 passerby line (${lang}) is missing or altered; expected "${want[lang]}"; found: ${near}`);
  }
}

// ---------------------------------------------------------------------------------------------
// Orchestration

export function validateData(data, opts = {}) {
  const rep = opts.report || new Report();
  const spec = opts.spec || parseSpec(opts.root || DEFAULT_ROOT);
  const canon = canonFromSpec(spec);
  const root = opts.root || DEFAULT_ROOT;
  const files = opts.files || {};
  const gcx = makeCx(rep, data, spec, canon, files);
  const routes = ROUTE_IDS.filter((r) => !opts.routeFilter || r === opts.routeFilter);
  if (!spec.ok) rep.warn('spec', 'docs/SPEC.md', 'could not read SPEC; using built-in fallbacks');
  const safe = (label, fn) => {
    try { return fn(); } catch (e) { rep.error('internal', label, `validator crashed: ${e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`); return null; }
  };
  safe('scripture', () => checkScripture(rep, data, spec, opts.fixture ? '/nonexistent' : root));
  safe('characters', () => checkCharacters(rep, data, Object.assign({}, gcx, { file: 'data/characters.js' })));
  safe('meta', () => checkMeta(rep, data, Object.assign({}, gcx, { file: 'data/meta.js' })));
  safe('common', () => checkCommon(rep, data, Object.assign({}, gcx, { file: 'data/common.js' })));
  safe('ui', () => checkUi(rep, data, Object.assign({}, gcx, { file: 'data/ui-strings.js' })));
  const out = { balance: [], dist: [], engine: [], time: [], routes: {} };
  for (const rid of routes) {
    if (data.routes[rid] === undefined) continue;
    const r = safe(rid, () => checkRoute(rep, data, rid, gcx, opts));
    if (!r) continue;
    safe(rid + ' passerby', () => checkPasserbyText(rep, rid, r.cx.allTexts, canon));
    const s = safe(rid + ' stats', () => routeStats(rep, data, rid, r.cx, canon, data.engine));
    if (s) {
      out.balance.push(...s.balanceLines);
      out.dist.push(...s.distLines);
      out.engine.push(...s.engineLines);
      out.time.push(...s.timeLines);
      out.routes[rid] = { dist: s.dist ? { total: s.dist.total, counts: s.dist.counts, cut: s.dist.cut, mismatch: s.dist.mismatch, ties: s.dist.ties } : null, summary: s.summary };
      out.prologue = s.prologue;
    }
  }
  if (data.engine) safe('engine', () => checkEngineExtras(rep, data, routes));
  if (out.balance.length) rep.section(`Balance - lens per option a,b,c,d (SPEC 8; x = cut option, - = no lens; ${LAST_CHOICE} counts double)`, out.balance);
  if (out.dist.length) rep.section(`Ending distribution - all 4^${CHOICE_COUNT} = ${PATH_COUNT} choice combinations per route (SPEC 5.1, 8; lens shares are of the non-cut paths)`, out.dist);
  if (out.engine.length) rep.section('Engine cross-check', out.engine);
  if (out.time.length) {
    const sums = Object.values(out.routes).map((r) => r.summary).filter(Boolean);
    const lesson = [];
    if (out.prologue) lesson.push(`prologue: ${out.prologue.screens} screens (played once per lesson; not in the route numbers)`);
    if (sums.length) {
      const add = (k) => sums.reduce((x, y) => x + y[k], 0);
      lesson.push(`all ${sums.length} routes in one lesson (median non-cut path each): ${add('medianScreens')} screens, read aloud ~${add('aloudKo').toFixed(1)} min (ko) / ~${add('aloudEn').toFixed(1)} min (en), silent ~${add('silentKo').toFixed(1)} min (ko)`);
    }
    rep.section(`Screens and reading time over all ${PATH_COUNT} paths (screens = line+verse+choice+press, budget <= ${SCREENS.max}; silent ko 450 chars/min, en 200 words/min, +4 s per choice; aloud ko 260 chars/min, en 150 words/min, +10 s per choice, +1 s per screen)`,
      out.time.concat(lesson));
  }
  return { report: rep, stats: out };
}

function checkEngineExtras(rep, data, routes) {
  const eng = data.engine;
  if (typeof eng.evalCond === 'function') {
    const rng = mulberry32(7);
    let bad = 0;
    let first = null;
    let n = 0;
    for (const rid of routes) {
      const route = data.routes[rid];
      if (!isObj(route)) continue;
      const conds = [];
      JSON.stringify(route, (k, v) => { if (k === 'when' && isObj(v)) conds.push(v); return v; });
      const flagVals = prescanFlags(route);
      for (const c of conds) {
        for (let t = 0; t < 12; t++) {
          const choices = {};
          CHOICE_IDS.forEach((cid) => { choices[cid] = OPTION_IDS[Math.floor(rng() * 4)]; });
          const flags = {};
          for (const [f, vals] of flagVals) {
            const arr = [...vals];
            if (rng() < 0.75) flags[f] = arr[Math.floor(rng() * arr.length)];
          }
          const lastLens = 1 + Math.floor(rng() * 3);
          const st = { routeId: rid, choices, flags, vars: {}, lastLens, c10Lens: lastLens, lens: lastLens };
          let theirs;
          try { theirs = !!eng.evalCond(c, st); } catch (e) { theirs = 'threw ' + e.message; }
          n++;
          if (theirs !== evalCond(c, st)) { bad++; if (!first) first = { c, st, theirs }; }
        }
      }
    }
    if (bad) rep.warn('engine', 'js/engine.js', `evalCond disagrees with the reference on ${bad}/${n} samples (assumed state {choices, flags, vars, lastLens}); e.g. ${snip(JSON.stringify(first.c), 80)} -> ${first.theirs}`);
    else if (n) rep.info('engine', 'js/engine.js', `evalCond agrees with the reference on ${n} samples`);
  }
  if (typeof eng.resolveText === 'function') {
    let bad = 0;
    let first = null;
    let n = 0;
    const st = { choices: {}, flags: {}, vars: {}, lastLens: 1 };
    const visit = (t) => {
      if (!isT(t)) return;
      for (const lang of ['ko', 'en']) {
        let s;
        try { s = String(eng.resolveText(t, lang, st)); } catch (e) { s = 'THREW ' + e.message; }
        n++;
        if (/\{\{|\[MT_|\bundefined\b|\bnull\b|THREW/.test(s)) { bad++; if (!first) first = { t: t[lang], s }; }
      }
    };
    const walk = (o, depth) => {
      if (depth > 12 || o === null || typeof o !== 'object') return;
      if (isT(o)) { visit(o); return; }
      for (const v of Array.isArray(o) ? o : Object.values(o)) walk(v, depth + 1);
    };
    for (const rid of routes) walk(data.routes[rid], 0);
    walk(data.common, 0);
    if (bad) rep.error('engine', 'js/engine.js', `resolveText leaves unresolved text in ${bad}/${n} strings; e.g. "${snip(first.t, 40)}" -> "${snip(first.s, 60)}"`);
    else if (n) rep.info('engine', 'js/engine.js', `resolveText resolved ${n} strings without leftovers`);
  }
}

export function formatText(res, meta) {
  const rep = res.report;
  const L = [];
  const E = rep.count('ERROR');
  const W = rep.count('WARN');
  const I = rep.count('INFO');
  L.push('Before He Stood - data validator (tools/validate.mjs)');
  L.push(`Date: ${meta.date}   Node ${process.version}   Root: ${meta.root}`);
  L.push(`Routes: ${meta.routes.join(', ')}${meta.partial ? '   (--partial)' : ''}`);
  L.push('');
  if (meta.status && meta.status.length) {
    L.push('Files');
    for (const s of meta.status) L.push(`  ${pad(s.status, 10)} ${s.rel}${s.bytes ? '  (' + s.bytes + ' bytes)' : ''}`);
    L.push('');
  }
  L.push(`Summary: ${E} ERROR, ${W} WARN, ${I} INFO  ->  ${E ? 'FAIL' : 'PASS'}`);
  for (const level of ['ERROR', 'WARN', 'INFO']) {
    const items = rep.findings.filter((f) => f.level === level);
    L.push('');
    L.push(`${level} (${items.length})`);
    if (!items.length) { L.push('  (none)'); continue; }
    const order = (f) => {
      const r = ROUTE_IDS.findIndex((x) => f.where.startsWith(x));
      return r < 0 ? -1 : r;
    };
    items.sort((a, b) => order(a) - order(b) || a.code.localeCompare(b.code));
    for (const f of items) L.push(`  [${f.code}] ${f.where}: ${f.msg}`);
  }
  for (const s of rep.stats) {
    L.push('');
    L.push(s.title);
    for (const ln of s.lines) L.push('  ' + ln);
  }
  return L.join('\n') + '\n';
}

function parseArgs(argv) {
  const a = { route: null, json: false, partial: false, root: DEFAULT_ROOT, write: true, selftest: false };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === '--route') a.route = argv[++i];
    else if (x.startsWith('--route=')) a.route = x.slice(8);
    else if (x === '--json') a.json = true;
    else if (x === '--partial') a.partial = true;
    else if (x === '--root') a.root = path.resolve(argv[++i]);
    else if (x === '--no-write') a.write = false;
    else if (x === '--selftest') a.selftest = true;
    else if (x === '-h' || x === '--help') a.help = true;
    else { a.bad = x; }
  }
  return a;
}

export function runValidation(args) {
  const root = args.root || DEFAULT_ROOT;
  const rep = new Report();
  const spec = parseSpec(root);
  const loaded = loadProject(root, rep, { routeFilter: args.route, partial: args.partial });
  // Source scans: comment language and classic-script rules.
  const scanList = [];
  const addDir = (dir, re) => {
    try { for (const f of fs.readdirSync(path.join(root, dir))) if (re.test(f)) scanList.push(path.posix.join(dir, f)); } catch (e) { /* absent */ }
  };
  addDir('data', /\.js$/);
  addDir('data/routes', /\.js$/);
  addDir('js', /\.js$/);
  addDir('css', /\.css$/);
  addDir('tools', /\.(mjs|js)$/);
  const pages = ['index.html'];
  for (const f of pages) if (fs.existsSync(path.join(root, f))) scanList.push(f);
  for (const rel of scanList) scanSourceFile(rep, root, rel);
  // Forbidden names in the HTML pages (Jonah there is only a WARN: the prophet Jonah may be meant).
  for (const f of pages) {
    let src;
    try { src = fs.readFileSync(path.join(root, f), 'utf8'); } catch (e) { continue; }
    const text = src.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
    for (const n of canonFromSpec(spec).forbidden) {
      const re = /^[A-Za-z]+$/.test(n) ? new RegExp('\\b' + n + '\\b') : new RegExp(n);
      if (re.test(text)) rep.add(n === 'Jonah' ? 'WARN' : 'ERROR', 'names', f, `forbidden name variant "${n}" in page text`);
    }
  }
  const res = validateData(loaded.data, { report: rep, spec, root, files: loaded.files, routeFilter: args.route, partial: args.partial });
  const meta = {
    date: new Date().toISOString().replace('T', ' ').slice(0, 19) + 'Z',
    root,
    routes: ROUTE_IDS.filter((r) => !args.route || r === args.route),
    partial: args.partial,
    status: loaded.status
  };
  return { res, meta, loaded };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.bad) {
    if (args.bad) console.error(`Unknown argument: ${args.bad}`);
    console.log('Usage: node tools/validate.mjs [--route scribe|friend|asher] [--json] [--partial] [--root DIR] [--no-write] [--selftest]');
    process.exit(args.bad ? 2 : 0);
  }
  if (args.route && !ROUTE_IDS.includes(args.route)) {
    console.error(`--route must be one of ${ROUTE_IDS.join(', ')}`);
    process.exit(2);
  }
  if (args.selftest) {
    process.exit(selfTest() ? 0 : 1);
  }
  const { res, meta } = runValidation(args);
  const text = formatText(res, meta);
  if (args.write) {
    try {
      fs.mkdirSync(path.join(args.root, 'qa', 'reports'), { recursive: true });
      fs.writeFileSync(path.join(args.root, 'qa', 'reports', 'validate.txt'), text);
    } catch (e) { console.error('could not write qa/reports/validate.txt: ' + e.message); }
  }
  if (args.json) {
    process.stdout.write(JSON.stringify({
      meta, summary: { ERROR: res.report.count('ERROR'), WARN: res.report.count('WARN'), INFO: res.report.count('INFO') },
      findings: res.report.findings, stats: res.report.stats
    }, null, 2) + '\n');
  } else process.stdout.write(text);
  process.exit(res.report.count('ERROR') ? 1 : 0);
}

// ---------------------------------------------------------------------------------------------
// Self-test with inline fixtures (node tools/validate.mjs --selftest)

function T(ko, en) { return { ko, en }; }

export function fixtureData(root, opts = {}) {
  // Uses the real meta/characters/scripture/common when available, plus generated short routes (SPEC v3):
  // four choices, scribe cut at c3 (after the scribes' thought), friend cut at c2 (in the lane), asher none.
  const rep = new Report();
  const loaded = loadProject(root, rep, { routeFilter: '__none__', partial: true });
  const d = loaded.data;
  const H = '가나다';
  const ko = (s) => H + ' ' + s;
  const line = (s, sp) => ({ type: 'line', speaker: sp, text: T(ko(s), 'Line ' + s + '.') });
  const choice = (n, lenses, extra) => ({
    type: 'choice', id: 'c' + n, prompt: T(ko('prompt ' + n), 'Prompt ' + n + '?'),
    options: OPTION_IDS.map((oid, i) => Object.assign({ id: oid, text: T(ko('opt ' + n + oid), 'Option ' + n + oid + '.'), lens: lenses[i] }, (extra && extra[oid]) || {}))
  });
  const canon = canonFromSpec(parseSpec(root));
  const pass = { type: 'line', speaker: 'passerby', text: T(canon.passerby.ko, canon.passerby.en) };
  const me = { scribe: 'menahem', friend: 'yonah', asher: 'asher' };
  const cutOpt = { cut: true, reaction: [line('leaving', 'narrator')] };
  const mk = (rid) => {
    const beats = [{ type: 'scene', bg: rid === 'asher' ? 'asher_ceiling' : 'shore_dawn', caption: T(ko('cap'), 'Dawn') }, { type: 'verse', key: 'MT_9_1' }, line('a1')];
    beats.push(choice(1, [1, 2, 3, 1]), line('after 1', me[rid]));
    // The lane.
    beats.push({ type: 'scene', bg: rid === 'asher' ? 'sky_carried' : 'lane' });
    if (rid !== 'scribe') beats.push(pass);
    beats.push(line('lane'));
    if (rid === 'friend') beats.push(choice(2, [1, 2, 3, null], { a: { set: { near: true } }, d: cutOpt }));
    // The crowd (SPEC 6.4).
    beats.push({ type: 'scene', bg: rid === 'asher' ? 'crowd_lying' : 'crowd' }, { type: 'fx', fx: 'light', level: 'soft' }, { type: 'verse', key: 'MT_9_2A' }, { type: 'fx', fx: 'light', level: 'bright' });
    if (rid === 'asher') beats.push({ type: 'verse', key: 'MT_9_2B1' }, { type: 'verse', key: 'MT_9_2B2' });
    else beats.push({ type: 'verse', key: 'MT_9_2B' });
    beats.push({ type: 'fx', fx: 'light', level: 'soft' });
    if (rid === 'scribe') beats.push(choice(2, [1, 2, 3, 2]), { type: 'verse', key: 'MT_9_3Q', speaker: 'scribes' }, choice(3, [1, 2, 3, null], { d: cutOpt }));
    if (rid === 'friend') beats.push(choice(3, [1, 2, 3, 3]), { type: 'line', when: { flag: 'near', is: true }, text: T(ko('near'), 'Close by.') });
    if (rid === 'asher') beats.push(choice(2, [1, 2, 3, 3]), line('scribes stiff'), choice(3, [1, 2, 3, 2]));
    beats.push({ type: 'verse', key: 'MT_9_4N' }, { type: 'verse', key: 'MT_9_4Q' }, { type: 'verse', key: 'MT_9_5' },
      { type: 'verse', key: 'MT_9_6A' }, { type: 'verse', key: 'MT_9_6N' }, { type: 'fx', fx: 'light', level: 'bright' }, { type: 'verse', key: 'MT_9_6B' });
    if (rid === 'asher') beats.push({ type: 'press', action: 'getup' });
    beats.push({ type: 'verse', key: 'MT_9_7' }, { type: 'verse', key: 'MT_9_8' }, { type: 'fx', fx: 'light', level: 'soft' });
    beats.push(choice(4, [1, 2, 3, rid === 'friend' ? 2 : 1]), { type: 'fx', fx: 'light', level: 'off' });
    const r = {
      id: rid, beats,
      endings: {
        1: { beats: [line('e1')], last: T(ko('last1'), 'Last one.') },
        2: { beats: [line('e2')], last: T(ko('last2'), 'Last two.') },
        3: { beats: [line('e3'), { type: 'line', when: { lastLens: 3 }, text: T(ko('c4'), 'Last pick three.') }], last: T(ko('last3'), 'Last three.') }
      }
    };
    if (rid !== 'asher') r.endings.cut = { beats: [line('cut 1'), line('cut 2', rid === 'scribe' ? 'hanan' : 'narrator')], last: T(ko('cut last'), 'Cut last.') };
    if (rid === 'asher') {
      r.actions = [{ id: 'getup', label: T(ko('up'), 'Get up'), replies: [T(ko('no'), 'No.'), T(ko('no2'), 'Still no.'), T(ko('no3'), 'No again.')], counter: 'getup_count' },
        { id: 'goout', label: T(ko('out'), 'Go out'), replies: [T(ko('door'), 'The door is far.')], counter: 'goout_count' }];
      r.endingCoda = [{ type: 'line', text: T(ko('{{var:getup_count}}'), 'Tries: {{var:getup_count}}') }];
    }
    return r;
  };
  d.routes = { scribe: mk('scribe'), friend: mk('friend'), asher: mk('asher') };
  if (opts.withEngine) return { data: d, engine: loaded.data.engine, bhs: loaded.bhs };
  d.engine = null;
  return d;
}

function selfTest() {
  const root = DEFAULT_ROOT;
  const results = [];
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const base = fixtureData(root);
  const run = (data, routeFilter) => validateData(data, { root, fixture: true, routeFilter }).report;
  const errorsIn = (rep) => rep.findings.filter((f) => f.level === 'ERROR' && !/^scripture|^data\/scripture|^docs|^meta/.test(f.where));
  const t = (name, fn) => {
    try { const ok = fn(); results.push({ name, ok: !!ok }); } catch (e) { results.push({ name, ok: false, err: e.stack }); }
  };
  const find = (d, rid, pred) => d.routes[rid].beats.find(pred);
  const cho = (d, rid, id) => find(d, rid, (x) => x.type === 'choice' && x.id === id);
  // Pads a route's main beats with narration so every path shows exactly `n` more screens.
  const pad = (d, rid, n) => {
    const at = d.routes[rid].beats.findIndex((x) => x.type === 'choice' && x.id === 'c1');
    for (let i = 0; i < n; i++) d.routes[rid].beats.splice(at, 0, { type: 'line', text: T('가 채움 ' + i, 'Filler ' + i + '.') });
  };
  const maxScreens = (d, rid) => {
    let m = 0;
    for (const picks of allPicks()) m = Math.max(m, readingStats(simulate(d.routes[rid], d, picksToChoices(picks)).out, d).screens);
    return m;
  };
  t('good fixture has no route/common ERROR', () => {
    const rep = run(clone(base));
    const errs = errorsIn(rep);
    if (errs.length) console.log(errs.map((f) => `   ${f.code} ${f.where}: ${f.msg}`).join('\n'));
    return errs.length === 0;
  });
  t('good fixture: no cut/dist/screens/canon WARN either', () => {
    const rep = run(clone(base));
    const w = rep.findings.filter((f) => f.level === 'WARN' && ['cut', 'dist', 'screens', 'canon', 'balance', 'ending', 'schema', 'cond'].includes(f.code));
    if (w.length) console.log(w.map((f) => `   ${f.code} ${f.where}: ${f.msg}`).join('\n'));
    return w.length === 0;
  });
  t('line speaker jesus -> ERROR guard', () => { const d = clone(base); d.routes.scribe.beats.push({ type: 'line', speaker: 'jesus', text: T('가 a', 'b') }); return run(d).has('ERROR', 'guard', /speaker "jesus"/); });
  t('MT_9_3Q in friend -> ERROR guard', () => { const d = clone(base); d.routes.friend.beats.splice(5, 0, { type: 'verse', key: 'MT_9_3Q' }); return run(d).has('ERROR', 'guard', /MT_9_3Q/); });
  t('MT_9_3 token in asher -> ERROR guard', () => { const d = clone(base); d.routes.asher.beats.splice(5, 0, { type: 'line', text: T('가 {{v:MT_9_3}}', 'x {{v:MT_9_3}}') }); return run(d).has('ERROR', 'guard', /MT_9_3 /); });
  t('passerby altered -> ERROR canon', () => {
    const d = clone(base);
    const b = find(d, 'friend', (x) => x.speaker === 'passerby');
    b.text = T(b.text.ko.replace('사연', '이유'), b.text.en);
    const rep = run(d);
    return rep.has('ERROR', 'canon', /passerby line \(ko\)/) && !rep.has('ERROR', 'canon', /passerby line \(en\)/);
  });
  t('passerby curly apostrophe -> WARN canon only', () => {
    const d = clone(base);
    const b = find(d, 'asher', (x) => x.speaker === 'passerby');
    b.text = T(b.text.ko, b.text.en.replace("'", '’'));
    const rep = run(d);
    return rep.has('WARN', 'canon', /normalizing/) && !rep.has('ERROR', 'canon', /passerby line \(en\) is missing/);
  });
  t('passerby only after the friend cut -> ERROR canon (shown on every path)', () => {
    const d = clone(base);
    const bs = d.routes.friend.beats;
    const p = bs.splice(bs.findIndex((x) => x.speaker === 'passerby'), 1)[0];
    bs.splice(bs.findIndex((x) => x.type === 'verse' && x.key === 'MT_9_2A'), 0, p);
    return run(d).has('ERROR', 'canon', /passerby line \(verbatim, ko and en\) is not shown on 64\/256 paths/);
  });
  t('condition on a later choice -> ERROR cond', () => { const d = clone(base); d.routes.scribe.beats.splice(4, 0, { type: 'line', when: { choice: 'c3', is: 'a' }, text: T('가 x', 'x') }); return run(d).has('ERROR', 'cond', /c3, which does not appear earlier/); });
  t('condition on c5 (no such choice) -> ERROR cond', () => { const d = clone(base); d.routes.scribe.beats.push({ type: 'line', when: { choice: 'c5', is: 'a' }, text: T('가 x', 'x') }); return run(d).has('ERROR', 'cond', /unknown choice id "c5"/); });
  t('flag never set -> ERROR cond', () => { const d = clone(base); d.routes.scribe.beats.push({ type: 'line', when: { flag: 'nope', is: true }, text: T('가 x', 'x') }); return run(d).has('ERROR', 'cond', /never set/); });
  t('flag set only later -> ERROR cond', () => { const d = clone(base); d.routes.friend.beats.splice(3, 0, { type: 'line', when: { flag: 'near', is: true }, text: T('가 x', 'x') }); return run(d).has('ERROR', 'cond', /only set later/); });
  t('lastLens / c10lens in main beats -> ERROR cond', () => {
    const d = clone(base);
    d.routes.scribe.beats.push({ type: 'line', when: { lastLens: 2 }, text: T('가 x', 'x') });
    const d2 = clone(base);
    d2.routes.scribe.beats.push({ type: 'line', when: { c10lens: 2 }, text: T('가 x', 'x') });
    return run(d).has('ERROR', 'cond', /lastLens may only/) && run(d2).has('ERROR', 'cond', /c10lens may only/);
  });
  t('c10lens alias accepted in endings (INFO), lastLens in endings.cut -> WARN', () => {
    const d = clone(base);
    d.routes.scribe.endings['2'].beats.push({ type: 'line', when: { c10lens: 2 }, text: T('가 x', 'x') });
    d.routes.scribe.endings.cut.beats.push({ type: 'line', when: { lastLens: 1 }, text: T('가 y', 'y') });
    const rep = run(d);
    return !rep.has('ERROR', 'cond') && rep.has('INFO', 'cond', /old name of lastLens/) && rep.has('WARN', 'cond', /never true inside endings.cut/);
  });
  t('endings.cut condition on a choice after the cut -> ERROR cond', () => {
    const d = clone(base);
    d.routes.scribe.endings.cut.beats.push({ type: 'line', when: { choice: 'c4', is: 'a' }, text: T('가 x', 'x') });
    d.routes.scribe.endings.cut.beats.push({ type: 'line', when: { choice: 'c2', is: 'a' }, text: T('가 y', 'y') });
    const rep = run(d);
    return rep.has('ERROR', 'cond', /c4, which is never asked on a cut path/) && !rep.has('ERROR', 'cond', /c2, which/);
  });
  t('reaction may reference its own choice', () => {
    const d = clone(base);
    const c = cho(d, 'scribe', 'c3');
    c.options[1].reaction = [{ type: 'line', when: { choice: 'c3', is: 'b' }, text: T('가 x', 'x') }];
    return !run(d).has('ERROR', 'cond');
  });
  t('two unconditional reaction lines -> WARN (one allowed; two on a cut option)', () => {
    const d = clone(base);
    cho(d, 'scribe', 'c2').options[0].reaction = [{ type: 'line', text: T('가 x', 'x') }, { type: 'line', text: T('가 y', 'y') }];
    const ok1 = run(d).has('WARN', 'schema', /2 unconditional beats/);
    const d2 = clone(base);
    cho(d2, 'scribe', 'c3').options[3].reaction.push({ type: 'line', text: T('가 z', 'z') });
    return ok1 && !run(d2).has('WARN', 'schema', /unconditional beats/);
  });
  t('{{v:}} on refOnly key -> ERROR token', () => { const d = clone(base); d.routes.scribe.beats.push({ type: 'line', text: T('가 {{v:MT_8_19_20}}', 'x {{v:MT_8_19_20}}') }); return run(d).has('ERROR', 'token', /reference-only/); });
  t('unknown key -> ERROR token', () => { const d = clone(base); d.routes.scribe.beats.push({ type: 'line', text: T('가 {{r:MT_99_1}}', 'x {{r:MT_99_1}}') }); return run(d).has('ERROR', 'token', /unknown scripture key/); });
  t('malformed token -> ERROR token', () => { const d = clone(base); d.routes.scribe.beats.push({ type: 'line', text: T('가 {{v: MT_9_5}}', 'x {{v: MT_9_5}}') }); return run(d).has('ERROR', 'token', /malformed/); });
  t('{{var:}} outside asher -> ERROR token', () => { const d = clone(base); d.routes.scribe.beats.push({ type: 'line', text: T('가 {{var:getup_count}}', 'x {{var:getup_count}}') }); return run(d).has('ERROR', 'token', /not an action counter/); });
  t('quotes around token -> WARN', () => { const d = clone(base); d.routes.scribe.beats.push({ type: 'line', text: T('가 "{{v:MT_9_5}}"', 'x "{{v:MT_9_5}}"') }); return run(d).has('WARN', 'token', /quotation marks/); });
  t('unknown bg -> ERROR schema', () => { const d = clone(base); d.routes.scribe.beats.unshift({ type: 'scene', bg: 'roof' }); return run(d).has('ERROR', 'schema', /unknown bg/); });
  t('Hangul-only en -> ERROR lang', () => { const d = clone(base); d.routes.scribe.beats.push({ type: 'line', text: T('가나다', '가나다라') }); return run(d).has('ERROR', 'lang', /mostly Hangul/); });
  t('English-only ko -> ERROR lang', () => { const d = clone(base); d.routes.scribe.beats.push({ type: 'line', text: T('Hello there', 'Hello there') }); return run(d).has('ERROR', 'lang', /no Hangul/); });
  t('forbidden name -> ERROR names', () => { const d = clone(base); d.routes.scribe.beats.push({ type: 'line', text: T('메나헴이 온다', 'Menahem comes.') }); return run(d).has('ERROR', 'names'); });
  t('forbidden English name Jonah -> ERROR names', () => { const d = clone(base); d.routes.friend.beats.push({ type: 'line', text: T('요나가 온다', 'Jonah comes.') }); return run(d).has('ERROR', 'names', /Jonah/); });
  t('crowd order swapped -> ERROR canon', () => {
    const d = clone(base);
    const bs = d.routes.scribe.beats;
    const i5 = bs.findIndex((x) => x.key === 'MT_9_5');
    const i4 = bs.findIndex((x) => x.key === 'MT_9_4Q');
    [bs[i5], bs[i4]] = [bs[i4], bs[i5]];
    return run(d).has('ERROR', 'canon', /crowd sequence/);
  });
  t('missing MT_9_7 -> ERROR canon (on the non-cut paths)', () => { const d = clone(base); d.routes.asher.beats = d.routes.asher.beats.filter((x) => x.key !== 'MT_9_7'); return run(d).has('ERROR', 'canon', /MT_9_7 not shown on 256\/256 non-cut paths/); });
  t('cut paths may stop early: no "not shown" errors from them', () => {
    const rep = run(clone(base));
    return !rep.has(null, 'canon', /not shown/);
  });
  t('three choices -> ERROR schema', () => { const d = clone(base); d.routes.asher.beats = d.routes.asher.beats.filter((x) => x.id !== 'c3'); return run(d).has('ERROR', 'schema', /exactly 4 choices/); });
  t('five choices -> ERROR schema', () => { const d = clone(base); d.routes.asher.beats.push(Object.assign(clone(cho(d, 'asher', 'c4')), { id: 'c5' })); return run(d).has('ERROR', 'schema', /exactly 4 choices|choice id must be c1\.\.c4/); });
  t('option without lens -> ERROR schema', () => { const d = clone(base); delete cho(d, 'scribe', 'c2').options[0].lens; return run(d).has('ERROR', 'schema', /no lens/); });
  t('option ids out of order -> ERROR schema', () => { const d = clone(base); const c = cho(d, 'scribe', 'c2'); c.options[0].id = 'b'; return run(d).has('ERROR', 'schema', /option ids/); });
  t('cut option in asher -> ERROR cut', () => { const d = clone(base); Object.assign(cho(d, 'asher', 'c2').options[3], { cut: true, lens: null }); return run(d).has('ERROR', 'cut', /must not have a cut option/); });
  t('endings.cut in asher -> ERROR cut', () => { const d = clone(base); d.routes.asher.endings.cut = clone(d.routes.scribe.endings.cut); return run(d).has('ERROR', 'cut', /no cut ending by design/); });
  t('scribe without a cut option -> ERROR cut', () => { const d = clone(base); const o = cho(d, 'scribe', 'c3').options[3]; delete o.cut; o.lens = 2; return run(d).has('ERROR', 'cut', /no cut option/); });
  t('two cut options -> ERROR cut and ERROR dist (share over 25%)', () => {
    const d = clone(base);
    Object.assign(cho(d, 'scribe', 'c2').options[3], { cut: true, lens: null });
    const rep = run(d);
    return rep.has('ERROR', 'cut', /2 cut options/) && rep.has('ERROR', 'dist', /cut paths are 43\.8%/);
  });
  t('cut option in c4 or c1 -> ERROR cut', () => {
    const d = clone(base);
    const o = cho(d, 'friend', 'c2').options[3];
    delete o.cut;
    o.lens = 2;
    Object.assign(cho(d, 'friend', 'c4').options[3], { cut: true, lens: null });
    const d2 = clone(base);
    const o2 = cho(d2, 'friend', 'c2').options[3];
    delete o2.cut;
    o2.lens = 2;
    Object.assign(cho(d2, 'friend', 'c1').options[0], { cut: true, lens: null });
    return run(d).has('ERROR', 'cut', /sits in c4/) && run(d2).has('ERROR', 'cut', /sits in c1/);
  });
  t('cut option with a lens -> ERROR cut; cut: "yes" -> ERROR cut', () => {
    const d = clone(base);
    cho(d, 'scribe', 'c3').options[3].lens = 2;
    const d2 = clone(base);
    cho(d2, 'scribe', 'c3').options[3].cut = 'yes';
    return run(d).has('ERROR', 'cut', /must have lens null/) && run(d2).has('ERROR', 'cut', /boolean true/);
  });
  t('missing endings.cut -> ERROR cut', () => { const d = clone(base); delete d.routes.friend.endings.cut; return run(d).has('ERROR', 'cut', /endings\.cut = \{ beats, last \}/); });
  t('screens: 33 on a path -> ERROR, 32 -> WARN, 31 -> no path warning, median over 30 -> WARN', () => {
    const at = (extra) => { const d = clone(base); pad(d, 'asher', extra); return d; };
    const m0 = maxScreens(base, 'asher');
    const dE = at(33 - m0);
    const dW = at(32 - m0);
    const d31 = at(31 - m0);
    const d30 = at(30 - m0);
    const med = (d) => median(Array.from({ length: PATH_COUNT }, (_, k) => {
      const picks = [0, 1, 2, 3].map((i) => (k >> (2 * i)) & 3);
      return readingStats(simulate(d.routes.asher, d, picksToChoices(picks)).out, d).screens;
    }));
    const r31 = run(d31, 'asher');
    const medianOk = med(d31) > 30 ? r31.has('WARN', 'screens', /typical \(median\)/) : !r31.has('WARN', 'screens', /typical/);
    return maxScreens(dE, 'asher') === 33 && run(dE, 'asher').has('ERROR', 'screens', /exceed 32 screens/) &&
      run(dW, 'asher').has('WARN', 'screens', /paths have 32 screens/) && !run(dW, 'asher').has('ERROR', 'screens') &&
      !r31.has(null, 'screens', /exceed|have 32/) && medianOk &&
      !run(d30, 'asher').has('WARN', 'screens');
  });
  t('ending lengths: 4 beats in a lens ending or 1 in endings.cut -> WARN ending', () => {
    const d = clone(base);
    d.routes.scribe.endings['1'].beats.push({ type: 'line', text: T('가 1', 'One.') }, { type: 'line', text: T('가 2', 'Two.') }, { type: 'line', text: T('가 3', 'Three.') });
    d.routes.friend.endings.cut.beats.pop();
    const rep = run(d);
    return rep.has('WARN', 'ending', /shows 4 beat.*scribe › endings\.1/) && rep.has('WARN', 'ending', /shows 1 beat.*friend › endings\.cut/);
  });
  t('skewed lenses -> ERROR dist', () => {
    const d = clone(base);
    d.routes.scribe.beats.filter((x) => x.type === 'choice').forEach((c) => c.options.forEach((o) => { if (!o.cut) o.lens = 1; }));
    cho(d, 'scribe', 'c4').options[1].lens = 2;
    cho(d, 'scribe', 'c4').options[2].lens = 3;
    return run(d, 'scribe').has('ERROR', 'dist', /ending 1 is/);
  });
  t('missing lens coverage in c3 -> ERROR balance; null lens at c4 -> ERROR balance', () => {
    const d = clone(base);
    cho(d, 'asher', 'c3').options.forEach((o) => { o.lens = 1; });
    const d2 = clone(base);
    cho(d2, 'asher', 'c4').options[3].lens = null;
    return run(d).has('ERROR', 'balance', /c3/) && run(d2).has('ERROR', 'balance', /c4 \(the last choice\)/);
  });
  t('echoVerse highlight not a substring -> ERROR fx', () => {
    const d = clone(base);
    const c1 = cho(d, 'scribe', 'c1');
    c1.options[0].set = { underline: 'he' };
    d.routes.scribe.beats.splice(d.routes.scribe.beats.indexOf(c1) + 1, 0, { type: 'fx', fx: 'echoVerse', key: 'PS_103_3', highlight: { flag: 'underline', map: { he: { ko: ['없는 말'], en: ['who forgives'] } } } });
    return run(d).has('ERROR', 'fx', /not a substring/);
  });
  t('unknown fx -> ERROR fx', () => { const d = clone(base); d.routes.scribe.beats.push({ type: 'fx', fx: 'shake' }); return run(d).has('ERROR', 'fx', /unknown fx/); });
  t('press with unknown action -> ERROR schema', () => { const d = clone(base); d.routes.asher.beats.push({ type: 'press', action: 'jump' }); return run(d).has('ERROR', 'schema', /press action/); });
  t('asher without goout -> ERROR schema', () => { const d = clone(base); d.routes.asher.actions.pop(); return run(d).has('ERROR', 'schema', /goout/); });
  t('flag compared to false is accepted, and unset matches false', () => {
    const d = clone(base);
    d.routes.friend.beats.push({ type: 'line', when: { flag: 'near', is: false }, text: T('가 x', 'x') });
    const rep = run(d);
    return !rep.has(null, 'cond', /false/) && evalCond({ flag: 'near', is: false }, { flags: {} }) && !evalCond({ flag: 'near', is: false }, { flags: { near: true } });
  });
  t('scene time day/evening/night accepted, other values -> ERROR schema', () => {
    const d = clone(base);
    d.routes.asher.endings['1'].beats.unshift({ type: 'scene', bg: 'asher_home', time: 'evening' });
    d.routes.asher.endings['2'].beats.unshift({ type: 'scene', bg: 'asher_home', time: 'night' });
    const rep = run(d);
    const ok = !rep.has(null, 'schema', /time/) && rep.has('INFO', 'scene', /evening\/epilogue/);
    d.routes.asher.endings['3'].beats.unshift({ type: 'scene', bg: 'asher_home', time: 'dusk' });
    return ok && run(d).has('ERROR', 'schema', /time must be one of/);
  });
  t('scripture full must be {ko, en} -> ERROR scripture', () => {
    const d = clone(base);
    d.scripture = clone(d.scripture);
    d.scripture.MT_9_2B = Object.assign({}, d.scripture.MT_9_2B, { full: { ko: '' } });
    return run(d).has('ERROR', 'scripture', /full must be/);
  });
  t('meta without cut column or cut titles -> ERROR meta', () => {
    const d = clone(base);
    d.meta = clone(d.meta);
    delete d.meta.cut;
    delete d.meta.endings.friend.cut;
    const rep = run(d);
    return rep.has('ERROR', 'meta', /cut/) && rep.has('ERROR', 'meta', /endings\.friend\.cut/);
  });
  t('engine cross-check: correct engine passes', () => {
    const d = clone(base);
    d.engine = { computeLens: (rid, ch) => computeLensFor(d.routes[rid], ch), evalCond: (c, st) => evalCond(c, st), resolveText: (t2, lang) => renderText(t2[lang], lang, d.scripture) };
    const rep = run(d);
    return !rep.has('ERROR', 'engine') && !rep.has('WARN', 'engine');
  });
  t('engine cross-check: wrong tie-break fails', () => {
    const d = clone(base);
    d.engine = {
      computeLens: (rid, ch) => {
        const r = computeLensFor(d.routes[rid], ch);
        if (r.cut) return r;
        const max = Math.max(r.scores[1], r.scores[2], r.scores[3]);
        const lens = LENSES.find((l) => r.scores[l] === max);
        return Object.assign({}, r, { lens, mismatch: r.lastLens !== null && lens !== r.lastLens });
      }
    };
    return run(d).has('ERROR', 'engine', /disagrees/);
  });
  t('engine cross-check: a hardcoded c10 weight (no double weight on c4) fails', () => {
    const d = clone(base);
    d.engine = {
      computeLens: (rid, ch) => {
        const r = computeLensFor(d.routes[rid], ch);
        if (r.cut) return r;
        const scores = { 1: 0, 2: 0, 3: 0 };
        for (const b of d.routes[rid].beats) {
          if (b.type !== 'choice') continue;
          const o = b.options.find((x) => x.id === ch[b.id]);
          if (o && o.lens) scores[o.lens] += b.id === 'c10' ? 2 : 1;
        }
        const max = Math.max(scores[1], scores[2], scores[3]);
        const lens = LENSES.find((l) => scores[l] === max);
        return { lens, scores, lastLens: null, c10Lens: null, mismatch: false, cut: false };
      }
    };
    return run(d).has('ERROR', 'engine', /disagrees/);
  });
  t('engine cross-check: an engine that ignores cut options fails', () => {
    const d = clone(base);
    d.engine = {
      computeLens: (rid, ch) => {
        const r = computeLensFor(d.routes[rid], ch);
        if (!r.cut) return r;
        const c = {};
        for (const [k, v] of Object.entries(ch)) {
          const b = d.routes[rid].beats.find((x) => x.type === 'choice' && x.id === k);
          const o = b && b.options.find((x) => x.id === v);
          if (!(o && o.cut)) c[k] = v;
        }
        return Object.assign(computeLensFor(d.routes[rid], c), { cut: false });
      }
    };
    return run(d).has('ERROR', 'engine', /disagrees/);
  });
  t('real js/engine.js matches the reference on the fixture routes (computeLens + createGame, all 256 paths, cut paths included)', () => {
    const fx = fixtureData(root, { withEngine: true });
    if (!fx.engine || !fx.bhs) return false;
    fx.bhs.routes = fx.data.routes;
    fx.data.engine = fx.engine;
    const rep = run(fx.data);
    const engErr = rep.findings.filter((f) => f.code === 'engine' && f.level !== 'INFO');
    if (engErr.length) console.log(engErr.map((f) => `   ${f.level} ${f.where}: ${f.msg}`).join('\n'));
    const lines = rep.stats.find((x) => x.title === 'Engine cross-check');
    return !engErr.length && lines && lines.lines.filter((l) => /matches the reference step by step on 256\/256 paths/.test(l)).length === 3 &&
      lines.lines.some((l) => /scribe .*\(64 cut\)/.test(l)) && lines.lines.some((l) => /friend .*\(64 cut\)/.test(l)) && lines.lines.some((l) => /asher .*\(0 cut\)/.test(l));
  });
  t('lexer: Korean inside strings is not a comment', () => {
    const lx = lexJs('var a = "// 가"; /* ok */ var r = /\\/\\*x/; // 나\n`${"/*"}` // end');
    return lx.comments.length === 3 && lx.comments.filter((c) => HANGUL_TEST.test(c.text)).length === 1;
  });
  t('enumeration matches the per-path rule (256 paths, cut paths counted apart)', () => {
    const { table, cuts } = lensTable(base.routes.scribe);
    const dist = enumerateEndings(table, cuts);
    let agree = true;
    let nCut = 0;
    for (const picks of allPicks()) {
      const r = computeLensFor(base.routes.scribe, picksToChoices(picks));
      const r2 = lensFromTable(table, cuts, picks);
      if (r.cut !== r2.cut || r.lens !== r2.lens) agree = false;
      if (r.cut) nCut++;
    }
    return agree && dist.total === 256 && nCut === 64 && dist.cut === 64 && dist.counts[1] + dist.counts[2] + dist.counts[3] === 192;
  });
  t('reference scoring: c4 counts double; ties go to the last lens; lastChoiceOf is the highest cN', () => {
    const r = base.routes.asher;
    // asher fixture lenses: c1 [1,2,3,1], c2 [1,2,3,3], c3 [1,2,3,2], c4 [1,2,3,1]
    const a = computeLensFor(r, { c1: 'b', c2: 'b', c3: 'b', c4: 'a' }); // {1:2, 2:3} -> 2, last 1: mismatch
    const b = computeLensFor(r, { c1: 'a', c2: 'a', c3: 'c', c4: 'b' }); // {1:2, 2:2, 3:1} tie -> last lens 2
    const shuffled = { id: 'x', beats: clone(r.beats).filter((x) => x.type === 'choice').reverse() };
    return a.lens === 2 && a.mismatch && a.lastLens === 1 && b.lens === 2 && !b.mismatch && lastChoiceOf(shuffled) === 'c4';
  });
  let pass = 0;
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.err ? '\n' + r.err : ''}`);
    if (r.ok) pass++;
  }
  console.log(`\nselftest: ${pass}/${results.length} passed`);
  return pass === results.length;
}

const invokedDirectly = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (invokedDirectly) {
  main().catch((e) => { console.error(e && e.stack ? e.stack : e); process.exit(2); });
}
