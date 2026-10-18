# SPEC addendum v3 — Short routes (2026-10-18)

The teacher wants the class to play ALL THREE characters together on one TV in a single lesson. Routes become short (about 5 minutes each when read aloud together), they end soon after the climax, and some choices cut a route short so students realize "아, 이렇구나" while playing. This addendum OVERRIDES docs/SPEC.md wherever they differ (choice counts, ending sequence, balance, screen budget). Everything else in SPEC.md still applies (schema, canon §6, glossary §6.5, backgrounds §6.6, guardrails §7, style §3.4, length limits §3.3).

## 1. Route shape
- Exactly **4 choices** per route, ids `c1`…`c4`, in order. The LAST choice (`c4`) counts double.
- Target **24–30 screens** on a typical path (line + verse + choice + press beats); hard maximum **32** on any path. About 4 minutes read silently, about 5 minutes read aloud on a TV.
- Each option keeps at most **one** short reaction beat (two only when a `when` variant needs it).
- Lines stay short (SPEC §3.3 soft limits); no long setups. Cut anything that is not needed for the moment.
- No evening/epilogue scenes. The route ends at the crowd (or at the doorway one step away) right after MT_9_7–MT_9_8, with the final choice and a short ending.

Shared skeleton (adapt per character, keep the order):
1. Opening (2–3 screens): who, where, the cultural question in one beat (e.g. the psalm, the rumor, "what did I do?").
2. `c1` — the morning choice (sets up a callback).
3. THE LANE (2–3 screens): SPEC §6.3 facts unchanged, including the passerby's exact line where that route shows it.
4. THE CROWD — the full fixed sequence of SPEC §6.4, unchanged and in order (MT_9_2A … MT_9_8). `c2` and `c3` sit inside it at the moments that matter for this character (e.g. right after the first words; right after MT_9_4Q/MT_9_5).
5. `c4` (double weight) right after MT_9_7/MT_9_8 — where this character's eyes finally rest.
6. Ending: title card (engine) → 1–3 short beats → `last` (one line).

## 2. Lens endings
`endings["1"|"2"|"3"] = { beats, last }` as before, but **1–3 beats only** plus `last`. Titles stay in data/meta.js (unchanged unless the lead changes them).

Scoring (replaces SPEC §5.1 c10 rules): each pick adds its weight (1; 2 for the last choice) to its lens; ending lens = highest score; ties → the last choice's lens if tied, else the smallest lens. The mismatch line plays when the ending lens differs from the last choice's lens.

## 3. Cut endings ("중간에 끊기는 선택")
- The **scribe** and **friend** routes each have exactly **one** cut option, in `c2` or `c3`. The **Asher** route has **none** — by design: he cannot walk away. Do not add one.
- A cut option is an ordinary option with `cut: true` and `lens: null`. After its reaction beat (≤ 2), the route ends immediately: the engine skips all remaining beats and plays `endings.cut` (no lens scoring, no mismatch line).
- `endings.cut = { beats, last }` with 2–4 short beats: the biblical event still happens without the protagonist (others carry the bed / the crowd still sees it); the protagonist learns of it afterwards (e.g. Hanan tells Menahem; Asher walks past Yonah carrying his own bed). The `last` line is the "아, 이렇구나" moment — concrete, never preachy, never shaming the player. The event itself never changes: Jesus still forgives and heals.
- Scribe cut: Menahem decides he has heard enough after the first words (and the unspoken 「신성모독」 thought) and leaves before the answer (MT_9_4 onward). Friend cut: Yonah sets the bed down in the lane (「…오늘은 안 되겠어」); the others carry Asher on.
- Titles: data/meta.js `endings.scribe.cut`, `endings.friend.cut`; Asher has `endings.asher.cutNote` (shown in the gallery once the Asher route is finished: 「없음 · 아셀은 걸어서 떠날 수 없었다」).

## 4. Balance (replaces SPEC §8)
- `c1`–`c3`: the options cover lenses 1, 2 and 3; the fourth option may be any lens or null; the cut option is the null one.
- `c4`: four options covering lenses 1, 2, 3.
- Enumerate all 4^4 = 256 paths: cut paths ≤ 25%; among non-cut paths each lens ending 20–50%.

## 5. Keep / drop
Keep: canon and voices; THE LANE facts; the whole crowd sequence; Jesus only through verse beats/tokens; scribe 「읽음」 (pinThought + readReceipt) and the dawn word in his notes; Asher's gray buttons, the lying POV, and the press sequence (일어나기 → 침상을 들어 → 집으로); the light FX.
Drop: friend item mechanic (rope/cloak/water/food), long dawn setups, evening scenes, multi-beat reactions, extra callbacks that need long setup.
