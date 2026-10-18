/* Asher route, version 4 (story mode): "What Did He Call Me?" Owner: asher writer.
 * Rules: docs/SPEC-v4-story.md (overrides docs/SPEC.md on route shape, choices and endings).
 * Schema basics, canon and guardrails: docs/SPEC.md §4.5, §6, §7.
 *
 * Shape: five choices c1-c5. Every option has exactly one outcome:
 * - continue (no `bad`, no `scold`), with an optional one-beat reaction;
 * - `bad: "<id>"`: its reaction plays, then endings.bad[<id>] (a cut branch, closed by the snip card);
 * - `scold: { speaker, text }`: the line plays, the option is removed, the same choice is asked again.
 *   Asher's "can't" options (Get up / Go outside / Try to get up) use the scold mechanic with
 *   speaker "thought"; every other scold comes from Yonah.
 * No persistent action buttons (teacher's third note): the old gray buttons are ordinary options,
 * and the "Get up" press after MT_9_6B is a one-off label press that finally works.
 * Conditions on a choice refer to the pick that moved the story on (a scolded pick is not a pick).
 * True path: 28 screens on every combination of continue options (choice, line, verse and press
 * beats, plus the memory verse card, the ending beat and the last line).
 */
(function () {
  var BHS = (window.BHS = window.BHS || {});
  BHS.routes = BHS.routes || {};

  // Tiny builders. They only return plain objects in the SPEC §4.5 / SPEC-v4 §2 shape.
  function t(ko, en) {
    return { ko: ko, en: en };
  }
  function withId(b, id) {
    if (id) b.id = id;
    return b;
  }
  function line(ko, en, id) {
    return withId({ type: "line", text: t(ko, en) }, id);
  }
  function say(speaker, ko, en, id) {
    return withId({ type: "line", speaker: speaker, text: t(ko, en) }, id);
  }
  function thought(ko, en, id) {
    return say("thought", ko, en, id);
  }
  function sign(ko, en, id) {
    return say("sign", ko, en, id);
  }
  function verse(key, id) {
    return withId({ type: "verse", key: key }, id);
  }
  function scene(bg, pov, ko, en, time) {
    var b = { type: "scene", bg: bg, pov: pov };
    if (ko) b.caption = t(ko, en);
    if (time) b.time = time;
    return b;
  }
  function fx(name, params) {
    var b = { type: "fx", fx: name };
    if (params) {
      for (var k in params) {
        if (Object.prototype.hasOwnProperty.call(params, k)) b[k] = params[k];
      }
    }
    return b;
  }
  function press(ko, en, id) {
    return withId({ type: "press", label: t(ko, en) }, id);
  }
  function when(cond, beat) {
    beat.when = cond;
    return beat;
  }
  function choice(id, ko, en, options) {
    return { type: "choice", id: id, prompt: t(ko, en), options: options };
  }

  // Option builders: go = continue, snip = cut branch (endings.bad), nope = scold (option removed).
  function go(id, ko, en, reaction) {
    var o = { id: id, text: t(ko, en) };
    if (reaction) o.reaction = reaction;
    return o;
  }
  function snip(id, ko, en, endingId, reaction) {
    var o = { id: id, text: t(ko, en), bad: endingId };
    if (reaction) o.reaction = reaction;
    return o;
  }
  function nope(id, ko, en, speaker, sko, sen) {
    return { id: id, text: t(ko, en), scold: { speaker: speaker, text: t(sko, sen) } };
  }

  BHS.routes.asher = {
    id: "asher",

    beats: [
      // ---------- Dawn, on his back (lying POV) ----------
      scene("asher_ceiling", "lying", "새벽 · 아셀의 집", "Dawn · Asher's house"),

      // c1: one psalm among livelier options. Neither continue option has a reaction:
      // Yonah's arrival (the c2 prompt) cuts into the prayer or the counting.
      choice("c1", "눈 뜨면 또 이 천장. 벌써 네 해째다. 오늘 아침엔 뭘 하지?", "Same ceiling again. Four years now. What should I do this morning?", [
        go("a", "{{v:PS_41_4Q}}", "{{v:PS_41_4Q}}"),
        nope("b", "일어나기", "Get up", "thought", "다리가 대답하지 않는다.", "My legs don't answer."),
        snip("c", "“오 분만 더…”", "“Five more minutes…”", "nap", [
          line("아셀이 갈색 겉옷을 머리끝까지 끌어당긴다.", "Asher pulls his brown cloak up over his head.")
        ]),
        go("d", "들보를 또 센다. 하나, 둘, 셋…", "Count the beams again. One, two, three…")
      ]),

      // ---------- Morning: Yonah at the door ----------
      scene("asher_ceiling", "lying", "아침 · 아셀의 집", "Morning · Asher's house"),
      // Yonah's words are the friend route's words. "Shouts" (not "bursts in") so the prompt still
      // reads naturally when the choice is asked again after a removed option.
      choice("c2", "문간에서 요나가 숨을 헐떡이며 외친다. “아셀! 그분이 배로 돌아오신대. 같이 가자!”", "Yonah stands in the doorway, out of breath. “Asher! Jesus is coming back by boat. Come with me!”", [
        go("a", "“가고 싶어. 근데 겁나.”", "“I want to go. But I'm scared.”", [
          say("yonah", "겁나도 돼. 드는 건 우리가 할게.", "It's okay to be scared. We'll do the carrying.")
        ]),
        snip("b", "“차라리 디베랴 온천에 데려가 줘.”", "“Take me to the Tiberias hot springs instead.”", "hotSprings", [
          say("yonah", "온천? …좋아, 배 타고 가면 금방이지!", "Hot springs? …Sure. By boat it's no time at all!")
        ]),
        nope("c", "밖으로 나가기", "Go outside", "thought", "문은 바로 저긴데, 혼자서는 못 간다.", "The door is right there. I can't get there on my own."),
        // Teacher's fourth note: if he won't go out, the story stops here. No scold, no second chance.
        snip("d", "“싫어. 안 나가.”", "“No. I'm not going out.”", "stayedHome", [
          say("yonah", "…알았어. 억지로는 안 데려가.", "…Okay. I won't drag you.")
        ])
      ]),

      // ---------- THE LANE (SPEC §6.3), carried POV ----------
      scene("sky_carried", "lying", "늦은 아침 · 골목", "Late morning · The lane"),
      say(
        "passerby",
        "고통 뒤에 무슨 사연이 있는지 누가 알겠어. 저 사람은 무슨 잘못을 했기에 저렇게 됐을까.",
        "Who knows what's behind suffering like that. What did he do to end up like that?",
        "lane-passerby"
      ),
      // c3: the comeback answers the passerby; Menahem's silent moment closes the lane after it.
      choice("c3", "저 사람, 내가 못 듣는 줄 아나?", "Does he think I can't hear him?", [
        go("a", "“다 들리거든요?”", "“I can hear you, you know.”"),
        snip("b", "“요나, 사람 없는 뒷길로 가자.”", "“Yonah, take the back way. Away from people.”", "longWay", [
          say("yonah", "…알았어. 좀 돌아가도 괜찮겠지.", "…Okay. A little detour can't hurt.")
        ]),
        nope("c", "“요나, 내려 줘. 집에 갈래.”", "“Yonah, put me down. I'm going home.”", "yonah", "안 돼! 다 왔는데 어딜 가.", "Nope! We're almost there!")
      ]),
      line(
        "회당에서 보던 서기관 므나헴이 제자와 함께 비켜선다. 잠깐, 그와 눈이 마주친다. 둘 다 아무 말이 없다.",
        "Menahem, a scribe from the synagogue, steps aside with his student. For a moment, his eyes meet Asher's. Neither says a word.",
        "lane-menahem"
      ),

      // ---------- THE CROWD (SPEC §6.4), lying POV before Jesus ----------
      // The scene sets the bed down before him (faces above, light); MT_9_2A narrates it.
      scene("crowd_lying", "lying", "정오 무렵 · 그분 앞", "Around noon · Before Jesus"),
      fx("light", { level: "soft" }),
      verse("MT_9_2A"),
      fx("light", { level: "bright" }),
      verse("MT_9_2B1", "first-words-1"),
      // Route title moment. The word means "child"; paraphrased, never quoted.
      thought("나를 뭐라고 부르셨지? 꼭 어린아이를 부르듯이.", "What did he just call me? Son—like I'm a little kid.", "what-did-he-call-me"),
      fx("hush"),
      verse("MT_9_2B2", "first-words-2"),
      fx("light", { level: "soft" }),

      // c4: no option carries a "right answer" feel. Trying to stand still answers that nothing has
      // changed (no "sin removed, body released"; SPEC §7.2).
      choice("c4", "내 죄가 사함을 받았다고 하셨다. 이제 어쩌지?", "He said my sins are forgiven. Now what?", [
        nope("a", "일어나 본다.", "Try to get up.", "thought", "다리는 그대로다.", "My legs haven't changed."),
        go("b", "정말 나한테 하시는 말씀인가?", "Is he really saying this to me?", [
          // Calls back his only way out of the house: "I want to go. But I'm scared."
          thought("다른 누구도 아니고, 아침에 겁난다던 나한테.", "Not to anyone else. To me, the guy who said he was scared this morning.")
        ]),
        nope("c", "“저기요… 제 다리는요?”", "“Um… what about my legs?”", "yonah", "쉿! 아직 말씀 중이시잖아.", "Shh! He's not finished!"),
        go("d", "그럼 내 잘못이었다는 건가?", "So it was my fault after all?", [
          // His own noticing, not a narrator's ruling (SPEC §7.2). The variant recalls the c1 psalm.
          when(
            { choice: "c1", is: "a" },
            thought("아침에 기도할 때도 그게 무서웠다. 그런데 그 말 어디에도 ‘그래서’는 없었다.", "That's what scared me when I prayed this morning. But nothing he said had a “because” in it.")
          ),
          when({ not: { choice: "c1", is: "a" } }, thought("그런데 그 말 어디에도 ‘그래서’는 없었다.", "But nothing he said had a “because” in it."))
        ])
      ]),

      // Fixed sequence. The scribes' thought text is never shown in this route.
      line(
        "앞쪽에 선 서기관 몇 사람의 얼굴이 굳는다. 므나헴도 있다. 아무도 입을 열지 않는다.",
        "Up front, a few scribes' faces go stiff. Menahem is one of them. None of them says a word.",
        "scribes-stiff"
      ),
      verse("MT_9_4N"),
      verse("MT_9_4Q"),
      verse("MT_9_5"),
      verse("MT_9_6A"),
      verse("MT_9_6N"),
      fx("light", { level: "bright" }),
      verse("MT_9_6B", "rise"),

      // The payoff: the same words that answered "can't" at dawn now work. Then eye level.
      press("일어나기", "Get up", "press-getup"),
      fx("pov", { pov: "standing" }),
      scene("crowd", "standing"),
      fx("light", { level: "soft" }),
      press("침상을 들어", "Pick up your bed", "press-bed"),
      press("집으로", "Go home", "press-home"),
      verse("MT_9_7"),
      verse("MT_9_8"),

      // c5: his first words standing. The question leads straight into the memory verse card.
      choice("c5", "집으로 가는 길. 네 해 만에 사람들과 눈높이가 같다. 첫마디는?", "On the way home, eye to eye with people for the first time in four years. What do I say first?", [
        nope("a", "“요나, 침상은 네가 들어.”", "“Yonah, you carry the bed.”", "yonah", "그건 아니지! 네 침상은 네가 들어!", "No way! Your bed—you carry it!"),
        go("b", "“요나, 들었어? 나를 뭐라고 부르셨는지.”", "“Yonah, did you hear what he called me?”")
      ]),

      // He has gone home (MT_9_7): the light of his presence leaves before the ending card.
      fx("light", { level: "off" })
    ],

    endings: {
      // True ending: title card -> memory verse MT_9_2B (the answer to his question) -> beat -> last.
      good: {
        title: t("내가 일어나기 전", "Before I Stood"),
        verse: "MT_9_2B",
        beats: [
          scene("lane", "standing", "오후 · 골목", "Afternoon · The lane"),
          say("yonah", "들었지. 나도 바로 옆에 있었잖아. 자, 집까지 달리기다!", "I heard. I was right there. Now—race you home!", "end-race")
        ],
        // The passerby asked why; nothing in the story answers it. What he was called, he knows.
        last: t("왜 아팠는지는 모른다. 그분이 나를 뭐라고 부르셨는지는 안다.", "I still don't know why I got sick. But I know what he called me.")
      },

      // Cut branches (story-tree twigs). That day Jesus still comes to Capernaum; Asher misses it.
      bad: {
        // c1 c: "Five more minutes…"
        nap: {
          title: t("오 분만 더", "Five More Minutes"),
          beats: [
            scene("asher_ceiling", "lying", "해 질 녘 · 아셀의 집", "Dusk · Asher's house", "evening"),
            line("눈을 뜨니 문밖이 주황빛이다. 온 동네가 그분 얘기로 떠들썩하다.", "When Asher opens his eyes, the doorway is glowing orange. The whole town is buzzing about Jesus.", "nap-dusk"),
            say("brother", "아침에 요나 형이 와서 형을 막 흔들었어. 근데 하나도 안 깨더라.", "Yonah came this morning and shook you like crazy. You didn't even budge.", "nap-brother")
          ],
          last: t("온 동네가 깨어난 날, 나만 잤다.", "The day the whole town woke up, I slept in.")
        },

        // c2 d: "No. I'm not going out." He stays home and is not healed (teacher's fourth note).
        stayedHome: {
          title: t("들보 세기", "Counting Beams"),
          beats: [
            line("요나의 발소리가 골목 아래로 멀어진다.", "Yonah's footsteps fade down the lane.", "home-footsteps"),
            when({ choice: "c1", is: "d" }, thought("아침에 세다 만 들보를 끝까지 센다. 마흔둘.", "I finish counting the beams I started this morning. Forty-two.", "home-beams-again")),
            when({ not: { choice: "c1", is: "d" } }, thought("들보나 끝까지 세 본다. 마흔둘.", "I count the beams all the way through. Forty-two.", "home-beams")),
            scene("asher_ceiling", "lying", "정오 무렵 · 아셀의 집", "Around noon · Asher's house"),
            sign("― 바닷가 쪽에서 함성이 들려온다 ―", "— A roar goes up from the shore —", "home-roar")
          ],
          last: t("안 나가면 아무 일도 안 생긴다. 오늘은 그게 문제였다.", "Stay inside, and nothing happens. Today, that was the problem.")
        },

        // c2 b: the hot springs of Tiberias instead (Korean text uses the Korean Revised Version spelling,
        // as in John 6:1). Warm water, same legs; his boat came the other way.
        hotSprings: {
          title: t("디베랴 온천", "Tiberias Hot Springs"),
          beats: [
            scene("shore_dawn", "normal", "아침 · 갈릴리 바다", "Morning · The Sea of Galilee"),
            line("요나의 배가 남쪽으로 간다. 반대편에서 배 한 척이 가버나움 쪽으로 지나간다.", "Yonah's boat heads south. Another boat passes the other way, toward Capernaum.", "springs-boat"),
            thought("디베랴 온천. 물은 뜨끈하다. 다리는 그대로다.", "The hot springs of Tiberias. The water is nice and hot. My legs are the same.", "springs-water")
          ],
          last: t("그분은 배를 타고 오셨다. 우리는 반대로 갔다.", "He came by boat. We went the other way.")
        },

        // c3 b: the back way, where nobody stares.
        longWay: {
          title: t("뒷길", "The Back Way"),
          beats: [
            scene("sky_carried", "lying", "오후 · 언덕 뒷길", "Afternoon · The back way"),
            line("침상이 언덕을 빙 돌아간다. 쳐다보는 사람이 아무도 없다.", "The bed goes the long way around the hill. Nobody stares.", "back-hill"),
            line("바닷가 공터에 닿았을 때, 사람들은 벌써 집으로 돌아가고 있다.", "By the time they reach the shore, people are already heading home.", "back-late")
          ],
          last: t("아무도 나를 쳐다보지 않았다. 쳐다볼 사람이 남아 있지 않았으니까.", "Nobody stared at me. There was nobody left to stare.")
        }
      }
    }
  };
})();
