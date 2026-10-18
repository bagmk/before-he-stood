# SPEC — 그가 일어나기 전 · Before He Stood

Version 1.0 (2026-10-18). Single source of truth for every agent on this project.
- docs/scenario-v2.md (Korean) owns story beats, options, callbacks, ending prose and tone.
- THIS FILE owns structure, schema, canon facts, glossary, and guardrails. On conflict about structure or facts, this file wins.
- Never edit a file you do not own (see §1). Put needed changes under "Requests" in your final report.

---

## 0. What we are building

- A mobile-first, bilingual (Korean/English) visual novel for a Korean-American church youth class (4–5 students, ages 14–18). Based on Matthew 9:1–8.
- Each student picks one of three characters and plays ~8–9 minutes on their own phone: 10 choices × 4 options, 3 endings per character (9 total). Then the class fills a 3×3 grid on the whiteboard (columns = three lenses, rows = three characters) and the sermon on Matthew 8:23–9:8 follows.
- Choices never change the biblical event. They change how the protagonist hears it. Endings are never graded (no good/bad/true endings, no visible score).
- Static site: plain HTML/CSS/JS. No framework, no build step to play, no network required (Google Fonts optional, always with fallbacks). Must run (a) by double-clicking index.html (file://), (b) on GitHub Pages, (c) as a claude.ai artifact (single-file build, see §5.7).
- **All code comments in English only. Never write Korean in code comments.** Korean is fine inside data strings.
- No audio. No external images. All art is code (SVG).

## 1. Files and ownership

| Path | Owner | Notes |
| --- | --- | --- |
| docs/SPEC.md, docs/scenario-v2.md | lead | read-only for agents |
| data/meta.js | lead | titles, lenses, route cards, ending titles, notices |
| data/characters.js | lead | speaker ids, names, colors |
| data/common.js | lead | prologue, route-select prompt, mismatch line, final screen |
| data/scripture.js, docs/scripture-sources.md | scripture agent | exact verse text; keys fixed in §4.3 |
| data/routes/scribe.js | scribe writer | |
| data/routes/friend.js | friend writer | |
| data/routes/asher.js | asher writer | |
| index.html, css/style.css, js/engine.js, js/ui.js, js/main.js, data/ui-strings.js, tools/build-single.mjs, tests/fixtures/* | engine agent | |
| js/art.js | art agent | scene backgrounds as SVG |
| teacher.html, css/teacher.css, js/teacher.js, tools/make-qr.mjs, assets/qr.svg | teacher agent | |
| tools/validate.mjs, tools/playtest.mjs, qa/* | QA agent (phase 2) | |
| README.md | lead | |

Do not run `git commit`; the lead commits.

## 2. Global namespace and load order

Every data/JS file is a classic script (no `import`/`export`, no `fetch`, no modules), ES2019, wrapped in an IIFE:

```js
(function () {
  var BHS = (window.BHS = window.BHS || {});
  BHS.routes = BHS.routes || {};
  BHS.routes.scribe = { /* ... */ };
})();
```

Load order in index.html (fixed):
1. data/meta.js
2. data/characters.js
3. data/scripture.js
4. data/common.js
5. data/ui-strings.js
6. data/routes/scribe.js, data/routes/friend.js, data/routes/asher.js
7. js/engine.js, js/art.js, js/ui.js, js/main.js

Data files must not depend on each other at load time. js/engine.js must not touch the DOM at load time, so Node can load it with a `window` shim (`globalThis.window = globalThis`).

## 3. Text model

### 3.1 T — bilingual text
`T = { ko: string, en: string }`. Both required and non-empty. Plain text only, no HTML, no line breaks (use separate beats). Allowed inline markup: `*emphasis*` → rendered as `<em>`.

### 3.2 Tokens inside T strings
- `{{v:KEY}}` → verse text of KEY in the same language. The engine adds curly quotes “…” around it. Writers never add quotes around a token.
- `{{r:KEY}}` → verse reference in the same language (`시 107:17` / `Ps 107:17`).
- `{{var:NAME}}` → integer runtime variable (Asher's counters).

**Rule:** any text presented as a quotation of Scripture must be a `{{v:KEY}}` token or a `verse` beat. Never type scripture wording directly into a string. Paraphrase without quotation marks is fine and may cite `{{r:KEY}}`.

### 3.3 Length limits (per language, checked by the validator)
| Field | ko soft / hard | en soft / hard |
| --- | --- | --- |
| line text | 80 / 110 chars | 150 / 200 chars |
| option text | 45 / 60 | 90 / 120 |
| choice prompt | 50 / 70 | 100 / 130 |

Token text counts as its rendered length. Route budget: ≤ 80 screens on a typical path (line + verse + choice beats), target 8–9 minutes.

### 3.4 Style per language
Korean
- Narration: short declarative sentences, mostly present tense (「등잔불이 흔들린다.」). Second person 「너」 only in ending narration and last lines (as in scenario-v2).
- `thought` speaker: the protagonist's inner voice, 반말 monologue.
- Honorifics: Hanan → Menahem 존댓말 (~요/~습니다; calls him 「선생님」). Menahem → Hanan 반말 (~해라/~지). Yonah ↔ Asher 반말. Asher → mother 존댓말 (~요; 「어머니」). Mother → Asher 반말. Neighbor, passerby, partners: casual.
- Teen-readable. No modern slang, no heavy archaic style outside Scripture.

English
- Natural, concise, contemporary, not slangy. Present tense narration. Second person "you" only where the Korean uses 너.
- Hanan calls Menahem "Teacher". Asher calls his mother "Mom" in casual lines and "Mother" never; pick "Mom".
- Scripture only via tokens (ESV).

Both
- Same meaning, same beats. No jokes in one language only.
- Never mention game mechanics in story text (no "points", "lens", "ending").

## 4. Data schema

### 4.1 data/meta.js (lead)
`BHS.meta = { version, title: T, subtitle: T, lenses: {1,2,3: {label: T, desc: T}}, routeOrder: [...], routes: {routeId: {protagonist, name: T, title: T, tagline: T, firstLine: T, lensDesc: {1,2,3: T}}}, endings: {routeId: {1,2,3: T}}, bibleNotice: T, disclaimer: T }`.
Route files do not define titles. The engine reads route titles and ending titles from meta.

### 4.2 data/characters.js (lead)
`BHS.characters[id] = { name: T, role: T, color: "#hex", drawn?: false }`. Speaker ids for `line` beats come from here, plus the pseudo-speakers in §4.5.

### 4.3 data/scripture.js (scripture agent)
`BHS.scripture[KEY] = { ref: T, ko: string, en: string, speaker?: "jesus"|"scribes"|"narrator", refOnly?: true }`.
- Korean = 성경전서 개역개정판. English = ESV. Exact wording and punctuation of the published text (partial verses are exact substrings of the verse).
- `refOnly` keys have empty `ko`/`en` and may only be used with `{{r:KEY}}`.
- Writers may use ONLY these keys. Need another? Ask in your report; do not invent keys.

Matthew 9 (the fixed event):
| Key | ref ko / en | Speaker | Content (approximate; agent verifies) |
| --- | --- | --- | --- |
| MT_9_1 | 마 9:1 / Matt 9:1 | narrator | 예수께서 배에 오르사 건너가 본 동네에 이르시니 |
| MT_9_2A | 마 9:2 | narrator | 침상에 누운 중풍병자를 사람들이 데리고 오거늘 예수께서 그들의 믿음을 보시고 중풍병자에게 이르시되 / "And behold, some people brought to him a paralytic, lying on a bed. And when Jesus saw their faith, he said to the paralytic," |
| MT_9_2B | 마 9:2 | jesus | 작은 자야 안심하라 네 죄 사함을 받았느니라 / Take heart, my son; your sins are forgiven. |
| MT_9_2B1 | 마 9:2 | jesus | 작은 자야 안심하라 / Take heart, my son; |
| MT_9_2B2 | 마 9:2 | jesus | 네 죄 사함을 받았느니라 / your sins are forgiven. |
| MT_9_3 | 마 9:3 | narrator | whole verse |
| MT_9_3Q | 마 9:3 | scribes | 이 사람이 신성을 모독하도다 / This man is blaspheming. |
| MT_9_4 | 마 9:4 | narrator | whole verse |
| MT_9_4N | 마 9:4 | narrator | 예수께서 그 생각을 아시고 이르시되 / But Jesus, knowing their thoughts, said, |
| MT_9_4Q | 마 9:4 | jesus | 너희가 어찌하여 마음에 악한 생각을 하느냐 / Why do you think evil in your hearts? |
| MT_9_5 | 마 9:5 | jesus | whole verse (spoken) |
| MT_9_6A | 마 9:6 | jesus | 그러나 인자가 세상에서 죄를 사하는 권능이 있는 줄을 너희로 알게 하려 하노라 / But that you may know that the Son of Man has authority on earth to forgive sins |
| MT_9_6N | 마 9:6 | narrator | 하시고 중풍병자에게 말씀하시되 / —he then said to the paralytic— |
| MT_9_6B | 마 9:6 | jesus | 일어나 네 침상을 가지고 집으로 가라 / Rise, pick up your bed and go home. |
| MT_9_7 | 마 9:7 | narrator | 그가 일어나 집으로 돌아가거늘 / And he rose and went home. |
| MT_9_8 | 마 9:8 | narrator | whole verse |

Context:
| Key | Speaker | Content |
| --- | --- | --- |
| MT_7_29 | narrator | 이는 그 가르치시는 것이 권위 있는 자와 같고 그들의 서기관들과 같지 아니함일러라 |
| MT_8_20Q | jesus | 여우도 굴이 있고 공중의 새도 거처가 있으되 인자는 머리 둘 곳이 없다 |
| MT_8_26B | narrator | 곧 일어나사 바람과 바다를 꾸짖으시니 아주 잔잔하게 되거늘 |
| MT_8_34 | narrator | 온 시내가 예수를 만나려고 나가서 보고 그 지방에서 떠나시기를 간구하더라 |
| MT_26_65Q | narrator | (대제사장) 그가 신성 모독하는 말을 하였으니 / He has uttered blasphemy. |
| JN_9_2 | narrator | 랍비여 이 사람이 맹인으로 난 것이 누구의 죄로 인함이니이까 자기니이까 그의 부모니이까 |
| JN_9_3 | jesus | 이 사람이나 그 부모의 죄로 인한 것이 아니라 그에게서 하나님이 하시는 일을 나타내고자 하심이라 |
| PS_103_3 | narrator | 그가 네 모든 죄악을 사하시며 네 모든 병을 고치시며 / who forgives all your iniquity, who heals all your diseases, |
| PS_107_17 | narrator | 미련한 자들은 그들의 죄악의 길을 따르고 그들의 악을 범하기 때문에 고난을 받아 |
| PS_107_20 | narrator | 그가 그의 말씀을 보내어 그들을 고치시고 위험한 지경에서 건지시는도다 |
| PS_107_29 | narrator | 광풍을 고요하게 하사 물결도 잔잔하게 하시는도다 |
| PS_38_3 | narrator | 주의 진노로 말미암아 내 살에 성한 곳이 없사오며 나의 죄로 말미암아 내 뼈에 평안함이 없나이다 |
| PS_41_4 | narrator | 내가 말하기를 여호와여 내게 은혜를 베푸소서 내가 주께 범죄하였사오니 나를 고치소서 하였나이다 |
| PS_41_4Q | narrator | 여호와여 내게 은혜를 베푸소서 내가 주께 범죄하였사오니 나를 고치소서 (the prayer only; use this when a character prays it) |
| PS_22_1A | narrator | 내 하나님이여 내 하나님이여 어찌 나를 버리셨나이까 |
| DT_6_4 | narrator | 이스라엘아 들으라 우리 하나님 여호와는 오직 유일한 여호와이시니 |
| IS_43_25 | narrator | 나 곧 나는 나를 위하여 네 허물을 도말하는 자니 네 죄를 기억하지 아니하리라 |
| LV_4_31B | narrator | 제사장이 그를 위하여 속죄한즉 그가 사함을 받으리라 |
| LV_24_16A | narrator | 여호와의 이름을 모독하는 자는 반드시 죽일지니 온 회중이 돌로 그를 칠 것이니라 |
| SA2_12_13B | narrator | 여호와께서도 당신의 죄를 사하셨나니 |
| KI1_8_39B | narrator | 주만 홀로 모든 인생들의 마음을 다 아심이니이다 |

Reference-only (`refOnly: true`): MT_8_19_20 (마 8:19–20), MT_8_23_27 (마 8:23–27), MT_8_28_34 (마 8:28–34), MT_20_2 (마 20:2), MT_26_65 (마 26:65), MK_2_4 (막 2:4), MK_2_7 (막 2:7), DT_13_1_3 (신 13:1–3), JB_42_7 (욥 42:7), LK_13_2_3 (눅 13:2–3), LV_13_15 (레 13–15장).

Reference format: ko uses 개역개정 abbreviations (마, 막, 눅, 요, 시, 신, 사, 레, 삼하, 왕상, 욥); en uses Matt, Mark, Luke, John, Ps, Deut, Isa, Lev, 2 Sam, 1 Kgs, Job. Ranges use an en dash (–).

### 4.4 data/common.js (lead)
`BHS.common = { prologue: [Beat], routeSelect: {prompt: T}, mismatchLine: T, final: {key, blanks: {routeId: T}, othersHint: T, question: T, closing: [KEY...]} }`.

### 4.5 Route files (writers)

```js
BHS.routes.scribe = {
  id: "scribe",
  actions: [ /* asher only, see below */ ],
  beats: [ /* Beat */ ],
  endingPreface: [ /* optional Beat list, played before any ending */ ],
  endings: {
    "1": { beats: [ /* Beat */ ], last: T },
    "2": { beats: [...], last: T },
    "3": { beats: [...], last: T }
  },
  endingCoda: [ /* optional Beat list, played after the last line of any ending */ ]
};
```

**Beat types.** Any beat may carry `when: Cond`; a beat whose condition is false is skipped. Any beat may carry an optional unique `id` (string) for debugging.

1. `{ type: "scene", bg: BG_ID, caption?: T, pov?: "normal"|"lying"|"standing" }` — change background; optional place/time chip, e.g. `{ko:"새벽 · 므나헴의 방", en:"Dawn · Menahem's room"}`.
2. `{ type: "line", speaker?: SPEAKER, text: T }` — one text box. SPEAKER = a character id (§6.1) | `"narrator"` (default) | `"thought"` (protagonist's inner voice; rendered italic, no name plate) | `"sign"` (centered caption such as 「― 두루마리 펴는 소리 ―」 or 「몇 시간 뒤 / Hours later」).
3. `{ type: "verse", key: KEY, speaker?: "jesus"|"scribes"|"narrator" }` — scripture card (text + reference). Speaker defaults to the key's speaker. Jesus' words appear ONLY as verse beats or tokens.
4. `{ type: "choice", id: "c1"…"c10", prompt: T, options: [Option ×4] }` — exactly ten per route, ids in order c1…c10. c10 counts double automatically.
   `Option = { id: "a"|"b"|"c"|"d", text: T, lens: 1|2|3|null, set?: { flag: value }, reaction?: [Beat] }`. Reaction beats (0–2 short lines, may use `when`) play right after the pick. Option ids a–d in order.
5. `{ type: "fx", fx: FX_NAME, ...params }` — see FX list.
6. `{ type: "press", action?: ACTION_ID, label?: T, hint?: T }` — waits for the player to tap one glowing button. With `action`: that persistent action button turns on and must be tapped. With `label`: a one-off button appears (e.g. 「침상을 들어 / Pick up your bed」).

**Conditions (Cond).** May only reference earlier choices and flags set earlier.
- `{ choice: "c3", is: "a" }`, `{ choice: "c3", in: ["a","b"] }`
- `{ flag: "far", is: true }`, `{ flag: "item", in: ["rope","water"] }`
- `{ c10lens: 2 }` — lens of the option chosen at c10 (endings only)
- `{ all: [Cond...] }`, `{ any: [Cond...] }`, `{ not: Cond }`

**FX list** (the engine implements exactly these):
- `{ fx: "light", level: "off"|"soft"|"bright" }` — the light that marks Jesus' presence. `soft` while he is present, `bright` for MT_9_2B and MT_9_6B, `off` when leaving the scene.
- `{ fx: "hush" }` — the world goes quiet for the next beat (dim + slower text). Scribe route at the first words.
- `{ fx: "echoVerse", key: KEY, highlight?: { flag: FLAG, map: { [flagValue]: { ko: [string], en: [string] } | "*" | null } } }` — overlays a verse on the scene for one beat, highlighting the listed substrings for the current flag value (`"*"` = whole verse). Scribe route.
- `{ fx: "pinThought", items: ["verse:KEY" | "choice:cN"] }` — pins a thought bubble that stays on screen. Scribe route.
- `{ fx: "readReceipt" }` — stamps 「읽음 ✓ / Read ✓」 on the pinned bubble. Scribe route.
- `{ fx: "unpinThought" }`
- `{ fx: "pov", pov: "lying"|"standing"|"normal" }` — camera. Asher route.
- `{ fx: "actionReply", action: ACTION_ID, text: T }` — from now on, tapping that gray action shows this reply. Asher route.
- `{ fx: "actionsHide" }`, `{ fx: "actionsShow" }` — Asher route.

**Asher's persistent actions** (route-level `actions`):
```js
actions: [
  { id: "getup", label: T, replies: [T, T, T], counter: "getup_count" },
  { id: "goout", label: T, replies: [T], counter: "goout_count" }
]
```
Gray buttons sit under the text box from the first beat until `actionsHide` or the `press` on getup. The n-th tap shows `replies[min(n-1, last)]` as a transient line that does not advance the story, and increments `vars[counter]`.

**Endings.** At the end of `beats` the engine:
1. computes the ending lens (§5.1);
2. plays `common.mismatchLine` if the ending lens ≠ c10 lens;
3. plays `endingPreface`;
4. shows the ending title card: lens label + title from `meta.endings` (e.g. 「① 누가? · 누가 말했는가」);
5. plays `endings[lens].beats`, then `endings[lens].last` as a large final line;
6. plays `endingCoda`;
7. shows the final screen (`common.final`), then the gallery.

### 4.6 data/ui-strings.js (engine agent)
All UI chrome strings (buttons, labels, settings, gallery, errors) as T objects in `BHS.ui`.

## 5. Engine rules

### 5.1 Lens scoring (QA reuses this exact function)
- Each picked option adds its weight (1; 2 at c10) to `score[lens]` when lens is not null.
- Ending lens = highest score. Tie → the c10 option's lens if it is among the tied lenses; otherwise the smallest tied lens number.
- `BHS.engine.computeLens(routeId, choices)` → `{ lens, scores: {1,2,3}, c10Lens, mismatch }` where `choices = { c1: "a", …, c10: "d" }`. Pure function, no DOM.
- Also expose `BHS.engine.evalCond(cond, state)` and `BHS.engine.resolveText(t, lang, state)` (lang ∈ "ko"|"en").

### 5.2 Language modes
`ko`, `en`, `both`. The title screen asks first (default highlight: `both`). In `both`, Korean first, English below in a secondary style. Changeable anytime from the header. Option buttons in `both` show both lines.

### 5.3 Persistence (localStorage, every access in try/catch; game must work without it)
- `bhs.v1.settings` — language, text speed, text size.
- `bhs.v1.save` — current route, position, state (resume after an accidental refresh).
- `bhs.v1.gallery` — endings seen on this device (`"scribe-1"` …).
- `bhs.v1.blanks` — what the player typed on the final screen.

### 5.4 Controls and accessibility
Tap/click/Enter/Space to advance; typewriter with tap-to-complete; text speed (slow/normal/instant); text size (A−/A+); tap targets ≥ 44px; visible focus; `aria-live` on the text box; `prefers-reduced-motion` → no typewriter, no shake, fades ≤ 150ms.

### 5.5 Debug and deep links
`?debug=1` → panel with route, beat index, choices, scores, flags, a "jump to cN" control and an auto-pick button. `#scribe`, `#friend`, `#asher` → start that route directly (bare hash tokens only).

### 5.6 Look and feel (engine + art agents)
Committed single look (not a light/dark pair): scene art fills the stage; text sits on a parchment-like panel with dark ink for daylight legibility. Palette from the place: black basalt (Capernaum's houses), limestone, Galilee blue, olive, lamp amber; Jesus' presence = warm white light, never a figure. Korean serif for story text, a clean sans for UI; real fallback stacks. Portrait phones first (360–430px wide), safe-area insets, works on tablets and laptops too. No emoji in UI.

### 5.7 Builds
`node tools/build-single.mjs` writes:
- `dist/before-he-stood.html` — one self-contained file (all CSS/JS/data inlined) that runs offline.
- `dist/artifact.html` — same content as a body fragment for claude.ai artifacts: no doctype/html/head/body tags, `<title>` and `<style>` first, `<meta name="claude:viewport-fit-sides" content="cover">`, side gutters `max(16px, env(safe-area-inset-*))`, explicit body background, colors as tokens on `:root`, no external scripts, Google Fonts stylesheet allowed.

## 6. Canon

### 6.1 Characters — fixed facts (do not contradict)
| id | KO / EN name | Facts | Voice |
| --- | --- | --- | --- |
| menahem | 므나헴 / Menahem | Scribe (서기관) of Capernaum, about 50. Gray-streaked beard, ink-stained fingers. Keeps notes (기록장 / his notes). Loves Scripture sincerely; worries that what belongs to God not be claimed lightly. Not a villain; never sneers. Teaches Hanan. At the crowd he stands among "some of the scribes" near the front and says nothing aloud the whole time. | measured, precise |
| hanan | 하난 / Hanan | Menahem's student, 17. Sharp and curious; asks the dawn questions; walks with Menahem to the crowd. | polite, eager |
| yonah | 요나 / Yonah | Fisherman, about 24. Asher's childhood friend (they raced each other on the beach as boys). Works the nets with his partners; a day's wage is one denarius. | warm, impulsive, plain-spoken |
| asher | 아셀 / Asher | About 24. Has not been able to walk for four years (네 해째 / four years now). The cause is never stated. Lives with his mother and his little brother (about 10). Dry humor, says what he feels, hates being stared at, prays the Psalms. Owns a worn brown wool cloak (겉옷). Years ago he said cruel words to his little brother and never apologized (Asher route, choice 3). | wry, guarded, honest |
| mother | 어머니 / Mom (label "Asher's mother" outside Asher's POV) | Draws water every morning; hears talk at the well. Tired and tender. | |
| brother | 동생 / Little brother | About 10, plays by the doorway. Unnamed. | |
| neighbor | 이웃 / Neighbor | Brings the rumor to Menahem's door (scribe c3). | |
| partners | 그물 동료들 / net partners | Two or three fishermen, unnamed. Help carry the bed. Never state a number of carriers (avoid Mark's "four"). | |
| passerby | 행인 / Passerby | One person in the lane (§6.3). | |
| crowd | 무리 / The crowd | | |
| scribes | 서기관들 / The scribes | "Some of the scribes" (9:3). | |
| jesus | 예수님 / Jesus | Never drawn; shown only as light. Speaks only through scripture keys. No invented words, emotions, smiles or gestures. Narration may say only what the text says he did: came by boat, saw their faith, said, knew their thoughts, said to the paralytic. | scripture only |

How characters refer to Jesus: scribe POV — 「예수라는 사람」, 「그 사람」, 「그」 / "this Jesus", "the man", "he". Friend and Asher POV — 「그분」 / "him", "Jesus". Neutral narration and his speaker label — 「예수님」 / "Jesus".

### 6.2 Timeline of the day
1. **새벽 / Dawn** — Menahem reads Psalm 103 by lamplight with Hanan. Yonah mends nets on the shore. Asher wakes and prays.
2. **아침 / Morning** — Rumor: Jesus' boat is coming back across the sea. Stories of the storm (8:23–27) and of the demoniacs and the town that begged him to leave (8:28–34) got here first (how is invented). Yonah runs to Asher's house; his partners gather. A neighbor tells Menahem.
3. **늦은 아침 / Late morning — THE LANE** (§6.3).
4. **정오 무렵 / Around noon — THE CROWD** (§6.4), on open ground at the edge of town near the shore where Jesus has landed. No house, no roof, no door.
5. **오후–저녁 / Afternoon–evening** — Endings: Menahem's room at lamplight; the road home; Asher's doorway.

### 6.3 THE LANE — one moment, three routes (scribe c4 · friend c6 · asher c5)
- A narrow lane of black basalt houses sloping down toward the shore. Late morning, bright, a breeze off the water.
- Yonah and his net partners carry Asher on his bed toward the crowd.
- A passerby mutters this exact line wherever it is shown:
  - KO: 「고통 뒤에 무슨 사연이 있는지 누가 알겠어. 저 사람은 무슨 잘못을 했기에 저렇게 됐을까.」
  - EN: "Who knows what's behind suffering like that. What did he do to end up like that?"
- Menahem and Hanan, walking down to see the teacher, step aside to let the bed pass. Menahem glances at the bed; for a moment his eyes meet Asher's. Neither speaks to the other.
- Player-chosen lines (Yonah answering the passerby, Asher whispering to Yonah) belong to that route only and must not contradict the facts above.

### 6.4 THE CROWD — fixed sequence (identical order in every route)
1. MT_9_1 — the boat arrives (may be narrated before the lane, seen from a distance).
2. The bed is set down before Jesus. MT_9_2A.
3. MT_9_2B — the first words. (Asher route may split it: MT_9_2B1, then MT_9_2B2.)
4. MT_9_3 — the scribes' unspoken thought. Scribe route: show MT_9_3Q as Menahem's own thought. Friend and Asher routes: never show the thought's words; show only that some scribes go silent and stiff.
5. MT_9_4N + MT_9_4Q — Jesus answers thoughts no one spoke aloud. Friend/Asher react: no one said anything.
6. MT_9_5.
7. MT_9_6A → MT_9_6N → MT_9_6B.
8. MT_9_7 — he rises and goes home (Asher route: press beats).
9. MT_9_8 — the crowd is afraid and glorifies God.
Nobody is punished. Jesus does nothing to the scribes. The scribes do nothing.

### 6.5 Glossary (use these exact terms)
| KO | EN |
| --- | --- |
| 예수님 (narration, label) | Jesus |
| 그분 | he / him |
| 서기관, 서기관들 | scribe, the scribes |
| 율법 | the Law |
| 회당 | synagogue |
| 침상 | bed (ESV's word; narration may say "his bed" — a light frame you can carry) |
| 중풍병자 | the paralytic (scripture only; narration uses Asher / 아셀) |
| 죄 사함 | forgiveness of sins |
| 네 죄 사함을 받았느니라 | your sins are forgiven |
| 안심하라 | take heart |
| 작은 자야 | my son (ESV); note: the word means "child" |
| 인자 | the Son of Man |
| 권능 | authority |
| 신성모독 | blasphemy |
| 가버나움 | Capernaum |
| 갈릴리 바다 | the Sea of Galilee |
| 예루살렘 성전 | the temple in Jerusalem |
| 데나리온, 품삯 | denarius, a day's wage |
| 두루마리 | scroll |
| 등잔 | oil lamp |
| 무리 | the crowd |
| 겉옷 | cloak |
| 그물 | nets |
| 나단, 다윗, 욥, 엘리야, 엘리사 | Nathan, David, Job, Elijah, Elisha |

Name spellings are fixed. Forbidden variants (validator errors): 메나헴, 므나햄, 하넌, 요나스, 아셰르, 아쉐르, Menachem, Jonah (for Yonah), Asel, Asser.

### 6.6 Backgrounds (BG ids — writers use only these; art agent draws all)
| BG id | Scene |
| --- | --- |
| black | dark screen for prologue and transitions |
| dawn_lamp | Menahem's room before dawn: basalt wall, oil lamp, open scroll |
| shore_dawn | Sea of Galilee at dawn: beached boats, nets, pale light |
| asher_ceiling | lying POV inside Asher's house: wooden beams, reed-and-mud roof, light from the doorway |
| asher_home | Asher's house at eye level: water jar, doorway, mat |
| lane | narrow lane between black basalt houses, late morning |
| sky_carried | lying POV outdoors: sky, the bed's corners and hands at the edges |
| crowd | open ground near the shore, crowd silhouettes, a place of warm light at the center, a few scribes at the front |
| crowd_lying | lying POV before Jesus: faces at the edges looking down, light above |
| road_home | the road home in afternoon light |
| doorway_evening | Asher's doorway at dusk |
| lamp_night | Menahem's room at night: lamp, notes |

## 7. Theology and accuracy guardrails
1. Jesus speaks only through scripture keys. No invented words, emotions, or gestures for him.
2. The game never states or implies that Asher's illness was caused by his sin. Characters may fear it in thoughts or options; narration never confirms it. No "sin removed → body released" visuals. No option gets a correct-answer sound, sparkle, or score.
3. No ending is better than another. Never write "true/good/bad ending", never show scores or ranks to players.
4. Scribes are sincere, not villains. Menahem's concern (what belongs to God) is right; the open question is the premise "he is just a man".
5. Mark- or Luke-only details (roof, four men, house, "who can forgive sins but God alone" as spoken words) appear only as clearly labeled Easter eggs or teacher notes.
6. The crowd's response is exactly 9:8.
7. Cultural views are individual characters' views, never "everyone back then believed X".
8. Invented material (names, families, backstories, how rumors traveled, dialogue, endings) is acknowledged on the start screen (meta.disclaimer).
9. Never quote the Talmud (Nedarim 41a) in the first-century scenes; it is a later text.
10. Psalm 103:3's order (forgive, then heal) is literary, not a rule that one must be forgiven before being healed.

## 8. Balance rules (lenses)
- c1–c9: the four options must include lens 1, 2 and 3 at least once each; the fourth may be any lens or null.
  - Exceptions: friend c5 (item pick) is all null. friend c6 option d (the "far" path) and friend c7 option d (roof Easter egg) are null; the other three options of those choices must cover 1, 2 and 3.
- c10: four options covering lenses 1, 2 and 3 (one lens repeats).
- Per route, across c1–c9, each lens appears 10–14 times.
- Uniform random play should give each ending 20–45% (QA checks by full enumeration of all 4^10 paths).
- Lens must not be obvious from wording. Options are natural thoughts or actions, never labels.

## 9. Deviation policy and report format
- Keep scenario-v2's beats, options, callbacks and ending prose. You may tighten wording, split long lines, translate, and adjust lens tags or rewrite an option only when needed for §7 or §8 or for canon consistency (§6). Log every deviation.
- Final report: (1) files written; (2) deviation log; (3) requests to other owners; (4) self-check results (commands you ran and their output summary).
