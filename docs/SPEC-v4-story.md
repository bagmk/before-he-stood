# SPEC addendum v4 — Story mode: one true ending, funny bad endings (2026-10-18)

The teacher's direction (verbatim intent): "Rather than a dating-sim where you collect different endings, it's more fun to push the story forward. A wrong choice can just end the game (e.g. Asher refuses to go → not healed, the end; the scribe says something outrageous → spends the night in a guardhouse), or a friend / another scribe scolds you ('그건 아니지!') and the option disappears. Only ONE final ending per character; reaching it shows Scripture and the ending. Options can be 2 or 4. Make the options snappy and fun, and weird choices lead to weird (funny) endings — fun for the kids, but not unbiblical."

Second note from the teacher (same day): "The wording is awkward. Write in easier words, like a native speaker, not translationese. Make the text easier, readable and natural. Trying to steer toward endings and having numbers pop up in the middle makes it awkward. Focus on the story; don't force it into a format."

Fifth note from the teacher (with a screenshot of the old 「① 누가? · 그분은 누구신가」 card): "Don't force the story along with choices like this — it can just end. Numbers that keep appearing feel off. Keep ONE ending; before it, the story can get cut off. At the very end just show, as a tree, what we saw. Twelve endings aren't needed — one is enough. Only the branches that got pruned (cut off) go in the tree."

So: one true ending per character. Wrong choices "prune" the story: a short funny scene, then the story stops (with Try again). The old endings gallery is replaced by a **story tree**. No numbers anywhere on screen during play (no ①②③, no counts, no visible 1–4 badges on options).

## 0. Writing first (applies to every string)
- **Native Korean first.** Write each line as a Korean speaker would actually say or write it today — then write the English as a native English speaker would, not as a translation of the Korean. Meaning should match; wording should not be word-for-word.
- **Easy words, short sentences.** High-school readers, read aloud on a TV. One idea per sentence. Avoid literary/archaic vocabulary (e.g. 해명, 연유, 무릇), stiff written forms (~하는 것이다, ~에 대한, ~을 통해, 하나의, 그는 ~했다 in every line), and English calques in Korean (그녀/그 for every reference, passive constructions, "그것은").
- **Dialogue sounds like people.** Yonah and Asher talk like close friends (반말, teasing, short). Hanan speaks politely but bluntly to his teacher. Menahem is precise and a bit stiff — that is his character, but still natural Korean. Narration is plain and visual.
- **Story, not scaffolding.** No numbers or game labels inside the story: no lens numbers, no counters, no "sentence count", no stats, no meta-commentary about choices or endings. The story should never stop to explain itself. Endings are part of the story, not a scoreboard.
- Scripture text stays exactly as published (개역개정 / ESV) through verse beats and tokens; only our own lines change.

This addendum OVERRIDES docs/SPEC.md (v3) on: route shape, choices, endings, scoring, gallery, balance, screen budget. Everything else in SPEC.md still applies: schema basics §4.5 (beats, T text, tokens, `when`, `set`, FX, scenes, Asher's actions and press beats), canon §6 (characters, THE LANE §6.3, THE CROWD order §6.4, glossary §6.5, backgrounds §6.6), guardrails §7, style §3.4, lengths §3.3.

## 1. What changes
- No lenses, no scoring, no double weight, no mismatch line, no cut endings, no 3×4 gallery.
- Each route = ONE linear story with 5–6 choices. Each option either **continues**, ends the game in a **bad ending**, or is **scolded** away.
- Each route has exactly ONE **true ending** (the good ending), reached only by continuing through every choice. It closes with the character's **memory verse** (big verse card), then the last line.
- Each route has **3–4 cut branches** (data key `endings.bad`): short, funny, a little absurd, never mean, never unbiblical — the story stops there. They are not "endings" to collect; on screen they are pruned branches. After one, the class can **try again from that choice**.

## 2. Choices and options
- 5–6 choices per route (`c1`…`c6`), each with **2–4 options** (use both: at least one 2-option choice and at least two 4-option choices per route).
- Option outcomes (exactly one per option):
  - **continue** (default): optional reaction (0–1 beat, 2 only with `when` variants); may `set` flags for later callbacks.
  - **bad**: `bad: "<endingId>"`. Its reaction (0–1 beat) plays, then the route ends in `endings.bad[<endingId>]`.
  - **scold** (also used for "nope" options): `scold: { speaker: "<id>", text: T }`. The line plays (as a normal line with that speaker; `speaker` may be "thought", or omitted for narration), the option is **removed**, and the same choice is asked again. Optional `reaction` plays before the scold line. Examples: Hanan scolds his teacher; Asher picks 「일어나기」 and his own thought answers 「다리가 대답하지 않는다.」 — then the option is gone.
- Every choice keeps at least one continue option, and after all of its scold options are removed at least one continue option remains (no dead ends).
- Per route: 3–4 bad endings, 2–3 scold options, and at least one "weird" option (bad or scold) in most choices. A bad ending may be reachable from more than one option.
- **Scolders**: scribe route → Hanan (his student, polite but blunt: 「선생님, 그건 좀…」); friend route → a net partner (`partners`) or Asher himself; Asher route → Yonah. Scold lines are short and funny (「그건 아니지!」 energy), never cruel.

## 3. Option voice — 톡톡 튀게
- Short: aim ≤ 24 Korean characters / ≤ 48 English characters; hard limit SPEC §3.3.
- Spoken words in “ ”, thoughts without quotes, actions as plain verbs (e.g. 「침상을 내려놓는다.」).
- Each choice should feel like a real debate for a class: one sincere option, one bold option, one funny/weird option. No option names its outcome; a weird option should be tempting because it's funny, not because it's labeled.
- Humor comes from situations and characters' wit (Asher's dry voice, Yonah's impulsiveness, Menahem's pedantry, Hanan's bluntness) — never from Asher's body or disability, never from violence or injury.

## 4. Endings
```js
endings: {
  good: { title: T, verse: "<KEY>", beats: [ ... 1–3 beats ... ], last: T },
  bad: {
    <id>: { title: T, beats: [ ... 2–3 beats ... ], last: T },
    ...
  }
},
endingCoda: [ ... ]   // optional, after the good ending only; no numbers or stats
```
- Titles live in the route file (no longer in data/meta.js). A cut branch's `title` labels its branch in the story tree: keep it short and funny (2–8 Korean characters, e.g. 「오타 사냥」, 「5분만 더」). Ids: short ascii, e.g. `typo`, `guardhouse`, `nap`.
- **True ending sequence (engine):** title card with the ending `title` only (no number, no lens label) → the memory-verse card (`verse` key, shown big, with its reference) → `beats` → `last` → `endingCoda` → the route's story tree.
- **Cut-branch sequence (engine):** the option's reaction → `beats` → `last` (the punchline) → snip card: a playful stamp 「싹둑!」 / "Snip!", the branch `title`, and 「여기서 이야기가 끊겼어요.」 / "The story got cut off here." (no number, no "BAD END", no "ending") with two buttons: 「다시 고르기 · Try again」 (default focus; returns to that choice with the state exactly as it was when the choice was shown, scolded options stay removed) and 「처음 화면 · Title screen」.
- Memory verses (one per character; already in data/scripture.js):
  - scribe → `MT_9_6A` (the authority to forgive sins — the answer to his question; the sermon's theme)
  - friend → `MT_9_2A` (Jesus saw *their* faith)
  - asher → `MT_9_2B` (「작은 자야 안심하라 네 죄 사함을 받았느니라」 — what he was called)
- Bad endings: the biblical event itself never changes — Jesus still forgives and heals Asher in Capernaum that day. In a bad ending the protagonist misses it, leaves, mixes something up, or ends up somewhere silly (and plausible for first-century Galilee). The `last` line is a light twist with a tiny "아, 이렇구나", not a sermon. Never shame the player; the class should laugh and press "Try again".
- Allowed comic settings (examples, not requirements): a typo hunt in a scroll; a 40-page rebuttal; a night in the guardhouse of Capernaum's Roman garrison (the centurion of Matt 8:5 lives here) explaining Leviticus to a bored soldier; a huge catch of fish; winning an argument with the passerby while the crowd goes home; the hot springs of Tiberias (warm water, same legs); "5 more minutes" and waking up at dusk to the town's excitement; counting the roof beams again (42). Not allowed: violence, injury, mocking disability, Jesus refusing or failing, Jesus' words outside verse beats, anything that makes the scribes villains or caricatures (comic flaws are universal: pedantry, pride, overthinking), Mark/Luke-only details (no roof opening), the Talmud.

## 5. Route skeletons (adapt; keep THE LANE §6.3 and THE CROWD §6.4 on the good path)
Good path target **24–28 screens** (line + verse + choice + press beats, the ending included), hard max **30**. Each bad-ending path ≤ 20 screens. About 5 minutes per character on the good path, plus about a minute per bad ending the class runs into.

**Scribe — Menahem (Hanan scolds)**
1. Dawn, Psalm 103:3 with Hanan → c1 (e.g. explain it / a typo hunt → bad `typo` / go and see this Jesus).
2. THE LANE: passerby line, step aside, eye contact → c2 (e.g. a short prayer for the man / agree with the passerby → Hanan scolds / hurry to get a good spot).
3. THE CROWD: MT_9_1 (optional), 9:2A, first words 9:2B (hush, bright light, Ps 103:3 echo), his unspoken 9:3 thought (pinned) → c3 (e.g. shout "Blasphemy!" and push forward → bad `guardhouse` / leave before the answer → bad `leftEarly` / write "BLASPHEMY" in big letters → Hanan scolds / keep it inside and watch).
4. 「읽음」 at 9:4 (read receipt on the pinned 9:3 thought), 9:4Q, 9:5 → c4 ("which is easier?": e.g. run home to write a 40-page rebuttal → bad `rebuttal` / "Both are easy to say; proof is different" / wait for the answer).
5. 9:6A, 6N, 6B, 7, 8 → c5 (what goes in his notes tonight; e.g. pretend it never happened → bad / "He sent one man home with that authority. What did I do with mine?" / glorify God with the crowd).
6. Good ending: memory verse MT_9_6A; last line candidates from the reviewed routes (e.g. 「하나님에 대해서는 네가 옳았다. 남은 질문은 그에 대한 것이다.」).

**Friend — Yonah (net partner or Asher scolds)**
1. Shore at dawn: the rumor → c1 (e.g. "Let's get Asher!" / "Great day for fishing" → bad `bigCatch` / "Let's check if it's true first" → partner scolds).
2. Asher's house: Asher asks 「내가 뭘 잘못해서 이렇게 된 걸까?」 → c2 (e.g. "Not your fault" / "You don't have to explain to get my help" / "Hmm, any guesses?" → Asher scolds: 「너까지 그러기야?」).
3. THE LANE: passerby (exact line), Menahem steps aside → c3 (e.g. "We're on our way to him!" / a debate with the passerby → bad `debate` / set the bed down 「…다들 쳐다보잖아」 → bad `stayedInLane` / whisper to Asher "All the way").
4. THE CROWD: the bed set down, 9:2A, 「그 손들 가운데 네 손이 있다」, 9:2B → c4 (e.g. "Excuse me—his legs, please!" → Asher scolds 「쉿! 나한테 하신 말씀이야」 / look at Asher's face / "Only God can say that…").
5. Scribes go stiff, 9:4–9:8 → c5 (what he tells the people crowding around; e.g. "We should've charged admission!" → bad / "He spoke of forgiveness first" / "Ask him yourself!").
6. Good ending: memory verse MT_9_2A; last line (e.g. 「너는 그를 여기까지 들고 왔다. 집까지는 그가 침상을 들고 갔다.」).

**Asher (Yonah scolds; lying POV and the final press sequence stay; NO persistent gray buttons)**
Third note from the teacher: "Make 일어나기 / 밖으로 just options among the choices — it says it can't, and the option turns off. Don't keep them in the middle of the screen." So: drop `actions` and the actionShow/actionReply/actionHide FX. Instead, 「일어나기」 and 「밖으로 나가기」 appear as ordinary options in early choices; picking one gives a short "can't" line (his thought) and the option disappears (scold mechanic). After the first words (9:2B2) an option like 「일어나 본다」 answers 「다리는 그대로다.」 and disappears (the neutral observation; no "sin removed → body released"). At 9:6B the 「일어나기」 press finally works — the payoff.
1. Dawn, ceiling → c1 (e.g. pray a psalm (tokens) / 「일어나기」 → 「다리가 대답하지 않는다.」, removed / "5 more minutes…" → bad `nap` / count the beams again).
2. Yonah bursts in (「아셀! 그분이 배로 돌아오신대. 같이 가자!」) → c2 (e.g. "I want to go. But I'm scared." / "No. I'm not going out." → bad `stayedHome` / "Let's go to the hot springs of Tiberias instead" → bad `hotSprings` / "Hand me my cloak. Let's go."). Fourth note from the teacher: **if Asher says he won't go out, end the route right there** — he stays home and is not healed (bad ending; no scolding, no second chance inside the story; the class can use Try again).
3. THE LANE (carried POV): passerby → c3 (e.g. a dry comeback 「다 들리거든요?」 / close his eyes / "Put me down, I'm going home" → Yonah scolds).
4. THE CROWD (lying): 9:2A, 9:2B1, 「나를 뭐라고 부르셨지?」, 9:2B2 → c4 (e.g. 「일어나 본다」 → 「다리는 그대로다.」, removed / "Um, my legs?" → Yonah scolds 「쉿!」 / "Is he really saying this to me?" / "So it was my fault?" + 「그 말 어디에도 ‘그래서’는 없었다」).
5. 9:3–9:6B, press 「일어나기」, POV standing, presses 「침상을 들어」 → 「집으로」, 9:7, 9:8 → c5 (first words standing; e.g. "Race you home!" / "Yonah, you carry the bed" → Yonah scolds 「그건 아니지! 네 침상은 네가 들어!」 / "He spoke to me first.").
6. Good ending: memory verse MT_9_2B; last line (e.g. 「너를 들고 다니던 침상을, 이제 네가 들고 문을 연다.」). No numeric coda (the old 「일어나기 시도 N번 · 걸린 문장 1개」 is dropped).

## 6. Story tree and route select
- After the true ending, the route's **story tree** appears: the trunk runs from the opening through each choice point to the ★ true ending at the top (or left→right on wide screens); at each choice point, the cut branches grow sideways as short branches with a snip mark. Branches the class has seen on this device are drawn with their `title` (and optionally the first words of their punchline); unseen ones are faint, unlabeled stubs. No numbers, no counts, no percentages anywhere. Buttons: 「다른 인물로 하기」 / "Next character" (default focus; goes to route select) and 「처음 화면」 / "Title screen".
- The title screen's endings button becomes 「이야기 나무」 / "Story trees": the three trees side by side (a route not yet finished shows a faint trunk).
- Route cards keep portraits, the order hint and the played badge (played = the true ending seen). No counters on the cards.
- Options show no visible number badges (keys 1–4 / A–D and arrow keys + Enter still work; the focus ring shows the current option). An option whose cut branch the class has already seen may carry a tiny scissors mark ✂ (no text).
- Title cards carry no numbers: the true ending card shows only its title; the snip card shows 「싹둑!」, the branch title and the line above.

## 7. Guardrails (unchanged from SPEC §7 unless stated)
Jesus speaks only through verse beats and is never drawn. The crowd sequence of §6.4 runs in order on the good path (bad endings may cut it short). Narration never ties Asher's illness to sin (he may fear it; nothing confirms it). No "sin removed → body released" framing (after 9:2B2, trying to get up still answers 「다리는 그대로다」). The good path follows the biblical story; "right" options are the ones that keep the person in the story (going, carrying, staying, listening), not the ones with the most correct doctrine. Honorifics per §3.4 (scribe POV: no honorifics for Jesus; friend/Asher POV: 그분 + honorific verbs).
