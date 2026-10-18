/* Asher route, short version: "What Did He Call Me?" Owner: asher writer.
 * Schema: docs/SPEC.md §4.5. Shape, scoring and screen budget: docs/SPEC-v3-short.md (4 choices, c4 counts double).
 * By design this route has NO cut option: Asher cannot walk away (meta.endings.asher.cutNote).
 * Budget: 30 screens on every path, 31 when the mismatch line plays (hard max 32).
 */
(function () {
  var BHS = (window.BHS = window.BHS || {});
  BHS.routes = BHS.routes || {};

  // Tiny builders. They only return plain objects in the SPEC §4.5 shape.
  function t(ko, en) {
    return { ko: ko, en: en };
  }
  function line(ko, en) {
    return { type: "line", text: t(ko, en) };
  }
  function thought(ko, en) {
    return { type: "line", speaker: "thought", text: t(ko, en) };
  }
  function sign(ko, en) {
    return { type: "line", speaker: "sign", text: t(ko, en) };
  }
  function verse(key, id) {
    var b = { type: "verse", key: key };
    if (id) b.id = id;
    return b;
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
  function when(cond, beat) {
    beat.when = cond;
    return beat;
  }
  function opt(id, ko, en, lens, reaction) {
    return { id: id, text: t(ko, en), lens: lens, reaction: reaction || [] };
  }

  BHS.routes.asher = {
    id: "asher",

    // Gray buttons under the text box from the first beat (SPEC §4.5).
    actions: [
      {
        id: "getup",
        label: t("일어나기", "Get up"),
        replies: [
          t("다리가 대답하지 않는다.", "My legs don't answer."),
          t("여전히.", "Still nothing."),
          t("포기한 줄 알았는데. 아닌가 보다.", "I thought I'd given up. Guess not.")
        ],
        counter: "getup_count"
      },
      {
        id: "goout",
        label: t("밖으로", "Go outside"),
        replies: [t("그러려면 다리가 필요하다.", "That would take legs.")],
        counter: "goout_count"
      }
    ],

    beats: [
      // ---------- 1. Dawn at home (lying POV) ----------
      scene("asher_ceiling", "lying", "새벽 · 아셀의 집", "Dawn · Asher's house"),
      // Explicit for robustness; a no-op if the engine already shows them from the first beat.
      fx("actionsShow"),
      line(
        "들보와 갈대 지붕. 네 해째, 아셀이 아침마다 가장 먼저 보는 풍경이다.",
        "Wooden beams and a reed roof. For four years now, it's the first thing Asher sees every morning."
      ),

      // c1: the morning prayer. Options are the psalms themselves (tokens only).
      {
        type: "choice",
        id: "c1",
        prompt: t("아픈 사람들이 붙들어 온 시편들. 오늘은 어느 기도로 시작할까?", "Psalms that sick people have long held on to. Which prayer do I start with today?"),
        options: [
          opt("a", "{{v:PS_38_3B}}", "{{v:PS_38_3B}}", 2, [
            thought("이 기도는 내 마음을 너무 잘 안다. 그래서 가끔 무섭다.", "This prayer knows me a little too well. That's what scares me sometimes.")
          ]),
          opt("b", "{{v:PS_41_4Q}}", "{{v:PS_41_4Q}}", 3, [
            thought("고쳐 달라는 대목에서, 눈이 자꾸 문 쪽으로 간다.", "When I get to the part about healing, my eyes keep drifting to the door.")
          ]),
          opt("c", "{{v:PS_22_1A}}", "{{v:PS_22_1A}}", 1, [
            thought("원망도 결국 하나님을 향해 하는 말이다.", "Even a complaint is still something you say to God.")
          ]),
          opt("d", "{{v:PS_103_3}}", "{{v:PS_103_3}}", 1, [
            thought("용서하시는 분과 고치시는 분. 같은 분이다.", "The one who forgives and the one who heals. The same one.")
          ])
        ]
      },

      // ---------- 2. Morning: Yonah bursts in (the boat is still on its way) ----------
      scene("asher_ceiling", "lying", "아침 · 아셀의 집", "Morning · Asher's house"),
      // c2: whatever he answers, the bed is lifted (the sign below answers every option).
      {
        type: "choice",
        id: "c2",
        prompt: t("요나가 뛰어 들어온다. “그분이 배로 돌아오신대! 가자!” 뭐라고 하지?", "Yonah bursts in. “Jesus is coming back by boat! Let's go!” What do I say?"),
        options: [
          opt("a", "가고 싶어. 근데 겁나.", "I want to go. But I'm scared.", 2),
          opt("b", "그분이 어떤 분인데?", "Who is he, anyway?", 1),
          opt("c", "싫어. 이 꼴로 사람들 앞에 나가기 싫어.", "No. I'm not going out in front of people like this.", 2),
          opt("d", "내 겉옷 좀 줘. 그리고 가자.", "Hand me my cloak. Then let's go.", 3)
        ]
      },

      // ---------- 3. THE LANE (SPEC §6.3), carried POV ----------
      scene("sky_carried", "lying", "늦은 아침 · 골목", "Late morning · The lane"),
      fx("actionReply", { action: "goout", text: t("나왔다. 내 발로 나온 건 아니지만.", "I'm out. Not on my own feet, but I'm out.") }),
      sign("네가 망설여도, 사람들이 너를 든다.", "Even if you hesitate, people lift you."),
      {
        type: "line",
        id: "lane-passerby",
        speaker: "passerby",
        text: t(
          "고통 뒤에 무슨 사연이 있는지 누가 알겠어. 저 사람은 무슨 잘못을 했기에 저렇게 됐을까.",
          "Who knows what's behind suffering like that. What did he do to end up like that?"
        )
      },
      line(
        "두 사람이 벽 쪽으로 비켜선다. 회당에서 보던 서기관 므나헴과 젊은 제자다. 잠깐, 서기관과 눈이 마주친다. 아무도 말하지 않는다.",
        "Two men step aside: Menahem, a scribe Asher knows from the synagogue, and a young student. For a moment the scribe's eyes meet his. No one speaks."
      ),

      // ---------- 4. THE CROWD (SPEC §6.4), lying POV before Jesus ----------
      // The scene itself sets the bed down before him (faces above, light); MT_9_2A narrates it.
      scene("crowd_lying", "lying", "정오 무렵 · 그분 앞", "Around noon · Before Jesus"),
      fx("light", { level: "soft" }),
      verse("MT_9_2A"),
      fx("light", { level: "bright" }),
      verse("MT_9_2B1", "first-words-1"),
      // Route title moment. The word means "child"; paraphrased, never quoted.
      thought("나를 뭐라고 부르셨지? 꼭 아이를 부르듯이.", "What did he just call me? The way you'd call a child."),
      fx("hush"),
      verse("MT_9_2B2", "first-words-2"),
      fx("light", { level: "soft" }),
      // Neutral observation: nothing suggests forgiveness is unlocking his body (SPEC §7.2; lead decision).
      fx("actionReply", { action: "getup", text: t("다리는 그대로다.", "My legs haven't changed.") }),

      // c3: no option carries any "right answer" feel.
      {
        type: "choice",
        id: "c3",
        prompt: t("내 죄가 사함을 받았다고 하셨다. 가장 먼저 든 생각은?", "He said my sins are forgiven. What's my first thought?"),
        options: [
          opt("a", "그럼 병이 내 잘못이었다는 뜻인가?", "So does that mean my illness was my fault?", 2, [
            // Asher's own noticing, not a narrator ruling (SPEC §7.2). Variant recalls the c1 psalm.
            when(
              { choice: "c1", is: "a" },
              thought("아침 기도와 같은 두려움이다. 그런데 그 말 어디에도 ‘그래서’는 없었다.", "The same fear as my morning prayer. But there was no “because” anywhere in what he said.")
            ),
            when({ not: { choice: "c1", is: "a" } }, thought("그 말 어디에도 ‘그래서’는 없었다.", "There was no “because” anywhere in what he said."))
          ]),
          opt("b", "정말 나에게 하시는 말씀인가.", "Is he really saying this to me?", 2, [
            thought("다른 누구도 아니라, 침상에 누운 사람에게. 그게 나다.", "Not to anyone else. To the man lying on the bed. That's me.")
          ]),
          opt("c", "하지만 나는 아직 누워 있는데.", "But I'm still lying here.", 3, [
            thought("다리는 아침과 똑같다.", "My legs are the same as this morning.")
          ]),
          opt("d", "누가 이렇게 확실하게 말할 수 있지? 성전도 제물도 없이.", "Who can say that so surely? No temple, no sacrifice.", 1, [
            thought("용서받을 거라는 말이 아니었다. 이미 받았다는 말이었다.", "He didn't say I would be forgiven. He said I am.")
          ])
        ]
      },

      // Fixed sequence. The scribes' thought text is never shown in this route.
      line(
        "앞쪽에 선 서기관 몇 사람의 얼굴이 굳는다. 골목에서 마주친 그 얼굴도 있다. 아무도 입을 열지 않는다.",
        "Near the front, a few scribes' faces go still. The face from the lane is one of them. None of them says a word."
      ),
      verse("MT_9_4N"),
      verse("MT_9_4Q"),
      thought("누구한테 하시는 말씀이지? 아무도 아무 말 안 했는데.", "Who is he talking to? Nobody said anything."),
      verse("MT_9_5"),
      verse("MT_9_6A"),
      verse("MT_9_6N"),
      fx("light", { level: "bright" }),
      verse("MT_9_6B", "rise"),

      // The gray "Get up" lights for the first time. Then eye level, for the first time.
      { type: "press", id: "press-getup", action: "getup" },
      fx("actionsHide"),
      fx("pov", { pov: "standing" }),
      scene("crowd", "standing"),
      fx("light", { level: "soft" }),
      { type: "press", id: "press-bed", label: t("침상을 들어", "Pick up your bed") },
      { type: "press", id: "press-home", label: t("집으로", "Go home") },
      verse("MT_9_7"),
      verse("MT_9_8"),

      // c4 (counts double): his first words standing.
      {
        type: "choice",
        id: "c4",
        prompt: t("네 해 만에, 사람들과 같은 높이에 서 있다. 내 첫마디는?", "For the first time in four years, I'm standing eye to eye with people. What do I say first?"),
        options: [
          opt("a", "그분이 나한테 먼저 말을 거셨어. 일어나기도 전에.", "He spoke to me first. Before I even stood up.", 2),
          opt("b", "요나, 그분이 누구신지 알아야겠어.", "Yonah, I need to find out who he is.", 1),
          opt("c", "요나, 집까지 달리기 시합이다. 안 봐준다.", "Yonah, race you home. I'm not going easy on you.", 3),
          opt("d", "이 침상, 생각보다 가볍네.", "This bed's lighter than I thought.", 3)
        ]
      }
    ],

    // He has gone home (MT_9_7): the light leaves before any ending's title card (SPEC §4.5).
    endingPreface: [fx("light", { level: "off" })],

    // Titles come from data/meta.js (BHS.meta.endings.asher). One beat each, then the last line.
    endings: {
      // Lens 1: who is he?
      "1": {
        beats: [
          when(
            { choice: "c2", is: "b" },
            thought("아침엔 그분이 어떤 분이냐고 물었다. 나를 걷게 하신 분이, 하나님만 하실 수 있는 말을 하셨다.", "This morning I asked who he was. The one who got me walking said what only God can say.")
          ),
          when(
            { not: { choice: "c2", is: "b" } },
            thought("나를 걷게 하신 분이, 하나님만 하실 수 있는 말을 하셨다.", "The one who got me walking said what only God can say.")
          )
        ],
        last: t("다리를 고칠 분을 만나러 갔다. 죄를 사하는 분을 만나고 왔다.", "I went to find someone who could heal my legs. I came home having met the one who forgives sins.")
      },

      // Lens 2: why these words first?
      "2": {
        beats: [
          thought(
            "오늘 일을 이야기할 때, ‘걸었다’로 시작하지 않을 거다. 누워 있던 나에게 그분이 먼저 말을 거신 순간부터다.",
            "When I tell people about today, I won't start with “I walked.” I'll start with the moment he spoke to me first, while I was still lying there."
          )
        ],
        last: t("왜 병들었는지는 모른다. 오늘 그분이 나에게 하신 말씀은 안다.", "I don't know why I got sick. I do know what he said to me today.")
      },

      // Lens 3: where to? Home, people, a life starting again. Back up the same lane, at eye level, to the door.
      // Exactly one of the four variants plays (c4 first, then the c1 and c2 callbacks).
      "3": {
        beats: [
          scene("lane", "standing", "오후 · 골목", "Afternoon · The lane"),
          when(
            { choice: "c4", is: "c" },
            line("요나가 웃음을 터뜨린다. 아침에 실려 내려온 골목을, 이번엔 둘이 나란히 걸어 올라간다.", "Yonah bursts out laughing. Side by side, they walk back up the lane Asher was carried down this morning.")
          ),
          when(
            { all: [{ not: { choice: "c4", is: "c" } }, { choice: "c1", is: "b" }] },
            line("아침 기도 내내 눈이 가던 그 문을 향해, 아셀이 골목을 걸어 올라간다.", "Asher walks up the lane toward the door his eyes kept drifting to during his morning prayer.")
          ),
          when(
            { all: [{ not: { choice: "c4", is: "c" } }, { not: { choice: "c1", is: "b" } }, { choice: "c2", is: "d" }] },
            line("갈색 겉옷을 어깨에 걸치고, 아침에 실려 내려온 골목을 걸어 올라간다.", "The brown cloak over his shoulders, he walks back up the lane he was carried down this morning.")
          ),
          when(
            { all: [{ not: { choice: "c4", is: "c" } }, { not: { choice: "c1", is: "b" } }, { not: { choice: "c2", is: "d" } }] },
            line("아침에 실려 내려온 골목을, 이번엔 걸어서 올라간다.", "He walks back up the lane he was carried down this morning.")
          )
        ],
        last: t("너를 들고 다니던 침상을, 이제 네가 들고 문을 연다.", "Now you carry the bed that used to carry you, and you open the door.")
      }
    },

    // Shared record line after any ending.
    endingCoda: [
      sign("일어나기 시도 {{var:getup_count}}번 · 걸린 문장 1개", "Attempts to get up: {{var:getup_count}} · Sentences it took: 1")
    ]
  };
})();
