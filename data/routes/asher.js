/* Asher route: "What Did He Call Me?" Owner: asher writer. Schema: docs/SPEC.md §4.5. */
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
  function say(speaker, ko, en) {
    return { type: "line", speaker: speaker, text: t(ko, en) };
  }
  function sign(ko, en) {
    return { type: "line", speaker: "sign", text: t(ko, en) };
  }
  function verse(key) {
    return { type: "verse", key: key };
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
  function opt(id, ko, en, lens, reaction, set) {
    var o = { id: id, text: t(ko, en), lens: lens, reaction: reaction || [] };
    if (set) o.set = set;
    return o;
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
      // ---------- Dawn at home (lying POV) ----------
      scene("asher_ceiling", "lying", "새벽 · 아셀의 집", "Dawn · Asher's house"),
      // Explicit for robustness; a no-op if the engine already shows them from the first beat.
      fx("actionsShow"),
      line(
        "들보와 갈대 지붕. 네 해째, 아셀이 아침마다 가장 먼저 보는 풍경이다.",
        "Wooden beams and a reed roof. For four years now, it's the first thing Asher sees every morning."
      ),
      thought("천장의 금은 이제 눈 감고도 센다. 열한 개.", "I can count the cracks in the ceiling with my eyes shut. Eleven."),
      line(
        "아셀은 아침마다 시편으로 기도한다. 아픈 사람들이 오래 붙들어 온 기도들이다.",
        "Every morning, Asher prays the Psalms, prayers that sick people have held on to for a long time."
      ),

      // c1: the morning prayer. Options are the psalms themselves (tokens only).
      {
        type: "choice",
        id: "c1",
        prompt: t("오늘은 어느 기도로 시작할까?", "Which prayer do I start with today?"),
        options: [
          opt("a", "{{v:PS_38_3}}", "{{v:PS_38_3}}", 2, [
            thought("이 기도는 내 마음을 너무 잘 안다. 그래서 가끔 무섭다.", "This prayer knows me a little too well. That's what scares me sometimes.")
          ]),
          opt("b", "{{v:PS_41_4Q}}", "{{v:PS_41_4Q}}", 3, [
            thought("고쳐 달라는 대목에서, 눈이 자꾸 문 쪽으로 간다.", "When I get to the part about healing, my eyes keep drifting to the door."),
            thought("저 문을 내 발로 나가 본 게 언제였더라.", "When did I last walk out that door on my own?")
          ]),
          opt("c", "{{v:PS_22_1A}}", "{{v:PS_22_1A}}", 1, [
            thought("원망도 결국 하나님을 향해 하는 말이다.", "Even a complaint is still something you say to God.")
          ]),
          opt("d", "{{v:PS_103_3}}", "{{v:PS_103_3}}", 1, [
            thought("용서하시는 분과 고치시는 분. 같은 분이다.", "The one who forgives and the one who heals. The same one.")
          ])
        ]
      },

      // c2: the sounds of the house. Sets flag "sound" (returns at dusk and in ending 3).
      line(
        "누워 있어도 집 안팎의 소리는 다 들린다. 아셀은 소리만 듣고도 시간을 안다.",
        "From his bed, Asher hears everything in and around the house. He can tell the time by sound alone."
      ),
      {
        type: "choice",
        id: "c2",
        prompt: t("오늘 아침, 어느 소리에 귀를 기울일까?", "This morning, which sound do I listen to?"),
        options: [
          opt("a", "어머니가 물 긷는 소리", "Mom drawing water", 3, [
            thought(
              "물동이 내려놓는 소리만 들어도, 오늘 어머니가 얼마나 지치셨는지 안다.",
              "From the way she sets the jar down, I can tell how tired Mom is today."
            )
          ], { sound: "water" }),
          opt("b", "바람에 실려 오는 옆집 할아버지의 아침 기도", "The morning prayer of the old man next door, drifting in on the breeze", 1, [
            line("날마다 같은 기도다. {{v:DT_6_4}}", "Every day, the same prayer: {{v:DT_6_4}}"),
            thought("오직 한 분. 기도를 들으시는 분도, 죄를 용서하시는 분도.", "Only one. He hears prayers, and he forgives sins.")
          ], { sound: "prayer" }),
          opt("c", "문 앞에서 노는 동생의 목소리", "My little brother's voice as he plays by the door", 3, [
            line("동생이 문 앞에서 돌멩이를 던지며 숫자를 센다. 또 틀렸다.", "His little brother is tossing pebbles by the door, counting out loud. Wrong again."),
            thought("고쳐 줄까 하다가, 그만둔다.", "I almost correct him. Then I don't.")
          ], { sound: "brother" }),
          opt("d", "우물가의 수군거림", "Whispers at the well", 2, [
            line("우물가에서 누군가 아셀의 이름을 낮게 말한다.", "At the well, someone says Asher's name, low."),
            thought("무슨 말인지는 안 들어도 안다.", "I don't need to hear the rest. I know how it goes.")
          ], { sound: "whisper" })
        ]
      },

      // c3: one memory. A fault anyone could have; never linked to the illness.
      line(
        "문득 몇 해 전 일이 떠오른다. 동생에게 꼴도 보기 싫다고 소리쳤던 날.",
        "Out of nowhere, a day from a few years back: the day he yelled at his little brother that he couldn't stand the sight of him."
      ),
      line(
        "동생은 울며 뛰어나갔고, 아셀은 끝내 사과하지 못했다. 누구에게나 있을 법한 잘못이다.",
        "The boy ran out crying, and Asher never apologized. It's the kind of wrong anyone might do."
      ),
      {
        type: "choice",
        id: "c3",
        prompt: t("그 기억 끝에 드는 생각은?", "Where does that memory take me?"),
        options: [
          opt("a", "혹시 그 일 때문에 이렇게 된 걸까.", "What if that's why I ended up like this?", 2, [
            thought("이 질문은 네 해째 나를 따라다닌다. 대답은 한 번도 오지 않았다.", "This question has followed me for four years. No answer has ever come.")
          ]),
          opt("b", "잘못한 것과 병든 것은 같은 이야기일까.", "Is doing wrong the same story as getting sick?", 2, [
            thought("속 시원히 대답해 준 사람은 아직 없다.", "Nobody has ever given me a straight answer.")
          ]),
          opt("c", "그 잘못은 누가 용서해 줄 수 있지? 동생? 하나님?", "Who can forgive that? My brother? God?", 1, [
            thought("둘 다에게, 아직 아무 말도 못 했다.", "I haven't said a word about it to either of them.")
          ]),
          opt("d", "오늘은 동생에게 먼저 말을 걸어 봐야겠다.", "Today, I'll talk to my brother first.", 3, [
            thought("미안하다는 말은 짧은데, 왜 이렇게 안 나올까.", "“Sorry” is such a short word. Why won't it come out?")
          ])
        ]
      },

      // ---------- Morning: Yonah arrives ----------
      scene("asher_ceiling", "lying", "아침 · 아셀의 집", "Morning · Asher's house"),
      line("골목에서 누가 뛰어오는 소리. 발소리만 들어도 안다. 요나다.", "Someone is running up the lane. Asher knows that stride anywhere. Yonah."),
      // The boat is still on its way; it lands while the bed goes down the lane (as in the scribe and friend routes).
      say("yonah", "아셀! 그분이 배로 돌아오신대! 바닷가에 벌써 사람들이 모이고 있어. 가자!", "Asher! Jesus is coming back by boat! People are already gathering on the shore. Let's go!"),

      // c4: whatever he says, the bed is lifted.
      {
        type: "choice",
        id: "c4",
        prompt: t("요나가 침상 옆에 섰다. 뭐라고 할까?", "Yonah is standing over my bed. What do I say?"),
        options: [
          opt("a", "가고 싶어. 근데 겁나.", "I want to go. But I'm scared.", 2, [
            say("yonah", "나도 겁나. 그래도 가자.", "Me too. Let's go anyway.")
          ]),
          opt("b", "그분이 어떤 분인데? 들은 거 다 말해 줘.", "Who is he, anyway? Tell me everything you've heard.", 1, [
            say("yonah", "바다에서 폭풍을 말 한마디로 잠재우셨대!", "They say he calmed a storm at sea with a single word!"),
            say("asher", "그분이 너도 좀 잠잠하게 해 주시면 좋겠다.", "Then maybe he can calm you down, too.")
          ]),
          opt("c", "싫어. 이 꼴로 사람들 앞에 나가기 싫어.", "No. I'm not going out in front of people like this.", 3, [
            say("yonah", "그럼 들고 갈 거야.", "Then we'll carry you."),
            thought("요나는 어릴 때부터 이랬다.", "Yonah has been like this since we were kids.")
          ]),
          opt("d", "내 겉옷 좀 줘. 그리고 가자.", "Hand me my cloak. Then let's go.", 3, [
            line("요나가 낡은 갈색 겉옷을 아셀에게 덮어 준다.", "Yonah tucks the worn brown cloak around him.")
          ])
        ]
      },
      line(
        "그물 동료들이 들어와 요나와 함께 침상을 잡는다. 바닥이 멀어진다.",
        "Yonah's net partners come in and take hold of the bed with him. The floor drops away."
      ),
      line(
        "문간에서 물동이를 든 어머니와 마주친다. 어머니는 아무것도 묻지 않고 길을 비킨다.",
        "At the doorway they meet his mother, carrying her water jar. She asks nothing. She just steps aside."
      ),
      sign("네가 망설여도, 사람들이 너를 든다.", "Even if you hesitate, people lift you."),

      // ---------- THE LANE (SPEC §6.3), carried POV ----------
      scene("sky_carried", "lying", "늦은 아침 · 골목", "Late morning · The lane"),
      fx("actionReply", { action: "goout", text: t("나왔다. 내 발로 나온 건 아니지만.", "I'm out. Not on my own feet, but I'm out.") }),
      line(
        "몇 해 만의 하늘이다. 검은 현무암 담장 사이로, 눈이 시리게 파랗다.",
        "Sky, for the first time in years. Between the walls of black basalt, it's so blue it stings."
      ),
      // SPEC 6.4 step 1: the boat lands while the bed goes down the lane (same moment in all three routes).
      say("yonah", "배가 들어온다! 저기, 골목 끝에.", "The boat's coming in! Down there, at the end of the lane."),
      { type: "verse", id: "lane-9-1", key: "MT_9_1" },
      {
        type: "line",
        id: "lane-passerby",
        speaker: "passerby",
        text: t(
          "고통 뒤에 무슨 사연이 있는지 누가 알겠어. 저 사람은 무슨 잘못을 했기에 저렇게 됐을까.",
          "Who knows what's behind suffering like that. What did he do to end up like that?"
        )
      },
      when({ choice: "c4", is: "d" }, line("아셀은 겉옷을 턱밑까지 끌어올린다.", "Asher pulls the cloak up to his chin.")),
      line(
        "두 사람이 벽 쪽으로 비켜선다. 예전에 회당에서 보던 서기관 므나헴과, 젊은 제자다.",
        "Two men step aside against the wall: Menahem, the scribe Asher used to see at the synagogue, and a young student."
      ),
      line(
        "서기관이 침상을 힐끗 본다. 잠깐, 아셀과 눈이 마주친다. 둘 다 아무 말도 하지 않는다.",
        "The scribe glances at the bed. For a moment, his eyes meet Asher's. Neither of them says a word."
      ),

      // c5: what he does with the passerby's words.
      {
        type: "choice",
        id: "c5",
        prompt: t("침상이 골목을 내려간다. 무슨 생각이 들까?", "The bed moves on down the lane. What's on my mind?"),
        options: [
          opt("a", "내가 뭔가 했다는 뜻이겠지.", "Guess that means I did something.", 2, [
            line("행인은 벌써 저만치 갔다. 그 사람의 짐작만 침상 위에 남는다.", "The passerby is already gone. Only his guess stays behind on the bed.")
          ]),
          opt("b", "저 사람은 내 삶을 몰라.", "He doesn't know my life.", 3, [
            thought("우리 집 아침이 무슨 소리로 시작하는지도 모르면서.", "He doesn't even know what mornings sound like at my house.")
          ]),
          opt("c", "요나에게 묻는다. “방금 들었어?”", "Ask Yonah: “Did you hear that?”", 3, [
            say("yonah", "들었어. 그래도 안 내려놔.", "I heard. I'm still not putting you down.")
          ]),
          opt("d", "하늘을 본다. “하늘이 이렇게 넓었나.”", "Look up. “Was the sky always this big?”", 1, [
            thought("이 하늘 아래 어딘가에 그분이 와 계신다. 어떤 분일까.", "Somewhere under this sky, he has arrived. Who is he?")
          ])
        ]
      },

      // ---------- THE CROWD (SPEC §6.4), lying POV before Jesus ----------
      scene("crowd_lying", "lying", "정오 무렵 · 바닷가 공터", "Around noon · Open ground by the shore"),
      line("사람들 사이로 침상이 나아간다. 얼굴들이 사방에서 내려다본다.", "The bed pushes through the crowd. Faces stare down at him from every side."),
      when({ choice: "c4", is: "c" }, thought("이래서 나오기 싫었던 거다.", "This is exactly why I didn't want to come.")),
      when({ not: { choice: "c4", is: "c" } }, thought("쳐다보는 눈이 너무 많다.", "Too many eyes.")),
      fx("light", { level: "soft" }),
      line("침상이 땅에 내려진다. 위에서 따뜻한 빛이 비친다.", "The bed is set down. A warm light falls from above."),
      line("그분 앞이다. 무슨 말이든 해야 한다.", "He is lying in front of Jesus now. He has to say something."),

      // c6: the words he prepared. Jesus speaks first; never framed as a missed chance.
      {
        type: "choice",
        id: "c6",
        prompt: t("입을 열려는 순간이다. 무슨 말을 하려 했지?", "I'm about to speak. What was I going to say?"),
        options: [
          opt("a", "저를 도와주세요.", "Please help me.", 3, [
            thought("짧게. 이 한마디면 된다.", "Keep it short. That's all I need to say.")
          ]),
          opt("b", "걷고 싶습니다.", "I want to walk.", 3, [
            thought("네 해 동안 삼켜 온 말이다.", "Four years of swallowing those words.")
          ]),
          opt("c", "저는 하나님께 버림받은 건가요?", "Has God abandoned me?", 2, [
            thought("목소리가 떨리지 않기를.", "Please don't let my voice shake.")
          ]),
          opt("d", "당신은 누구십니까?", "Who are you?", 1, [
            thought("누구신지도 모르고 여기까지 왔다.", "I came all this way without knowing who he is.")
          ])
        ]
      },
      verse("MT_9_2A"),
      fx("light", { level: "bright" }),
      { type: "verse", id: "first-words-1", key: "MT_9_2B1" },
      sign("네가 준비한 말보다, 그분의 말이 먼저 왔다.", "His words came before the words you had ready."),

      // c7: the pause after the first half of the first words. Route title moment.
      {
        type: "choice",
        id: "c7",
        prompt: t("나를 뭐라고 부르셨지?", "What did he just call me?"),
        options: [
          opt("a", "나에 대해 말하는 게 아니라, 나에게 말씀하신다.", "He isn't talking about me. He's talking to me.", 2, [
            thought("다들 내 얘기는 해도, 나한테 말을 거는 사람은 드물다.", "Everyone talks about me. Hardly anyone talks to me.")
          ]),
          opt("b", "내가 얼마나 무서운지 아시는 걸까.", "Does he know how scared I am?", 1, [
            thought("말한 적도 없는데, 어떻게 아셨을까.", "I never said a word. How did he know?")
          ]),
          opt("c", "아이를 부르듯 부르셨어.", "He called me the way you'd call a child.", 3, [
            thought("어릴 적 저녁마다, 어머니가 문간에서 나를 부르던 것처럼.", "Like Mom calling me in from the doorway every evening when I was little.")
          ]),
          opt("d", "다음 말을 듣고 싶다.", "I want to hear what he says next.", 1, [
            line("아셀은 숨을 죽인다.", "Asher holds his breath.")
          ])
        ]
      },
      fx("hush"),
      { type: "verse", id: "first-words-2", key: "MT_9_2B2" },
      fx("light", { level: "soft" }),
      // Neutral observation: nothing here suggests forgiveness is unlocking his body (SPEC 7.2; lead decision).
      fx("actionReply", { action: "getup", text: t("다리는 그대로다.", "My legs haven't changed.") }),

      // The c3 memory returns right after the first words.
      line("동생의 우는 얼굴이 스친다. 아직 사과하지 못한 그날.", "His little brother's crying face flashes before him. The day he never apologized for."),
      when({ choice: "c3", is: "c" }, thought("아침에 물었다. 그 잘못은 누가 용서해 줄 수 있냐고.", "This morning I asked who could ever forgive that.")),

      // c8: no option carries any "right answer" feel.
      {
        type: "choice",
        id: "c8",
        prompt: t("내 죄가 사함을 받았다고 하셨다. 가장 먼저 든 생각은?", "He said my sins are forgiven. What's my first thought?"),
        options: [
          opt("a", "그럼 병이 내 잘못이었다는 뜻인가?", "So does that mean my illness was my fault?", 2, [
            // Asher's own noticing, not a narrator ruling (SPEC 7.2: narration neither confirms nor settles the cause).
            thought("그 말 어디에도 ‘그래서’는 없었다.", "There was no “because” anywhere in what he said.")
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
      { type: "verse", id: "rise", key: "MT_9_6B" },

      // The gray "Get up" lights for the first time. Then eye level, for the first time.
      { type: "press", id: "press-getup", action: "getup" },
      fx("actionsHide"),
      fx("pov", { pov: "standing" }),
      scene("crowd", "standing"),
      fx("light", { level: "soft" }),
      thought("이번에는 다리가 대답한다.", "This time, my legs answer."),
      when(
        { choice: "c4", is: "d" },
        line("겉옷이 어깨에서 흘러내린다. 아셀이 허리를 굽혀 직접 집어 든다.", "The cloak slides off his shoulders. Asher bends down and picks it up himself.")
      ),
      line("네 해 만에, 사람들과 같은 높이에서 본다.", "For the first time in four years, he is looking at people eye to eye."),

      // c9: first thought at eye level.
      {
        type: "choice",
        id: "c9",
        prompt: t("그 순간, 가장 먼저 든 생각은?", "In that moment, what's my first thought?"),
        options: [
          opt("a", "이분은 누구시길래.", "Who is he, to do this?", 1, [
            thought("죄를 사하는 권능이 있다고 하셨다. 그리고 내 다리가 그분의 말을 들었다.", "He said he has authority to forgive sins. And my legs listened to him.")
          ]),
          opt("b", "일어나기 전에 먼저 하신 말이 있었다.", "Before I ever stood, he said something else first.", 2, [
            thought("다리보다 먼저 들은 말. 그 말이 아직 더 크게 울린다.", "The words I heard before my legs moved. They're still the loudest thing.")
          ]),
          opt("c", "이게 나를 싣고 다니던 침상이다.", "This is the bed that's been carrying me around.", 3, [
            line("작다. 그리고 많이 낡았다.", "It's small. And so worn.")
          ]),
          opt("d", "친구들이 나를 올려다보고 있다.", "My friends are looking up at me.", 3, [
            thought("네 해 동안은 내가 올려다보던 얼굴들이다.", "For four years, I was the one looking up at these faces.")
          ])
        ]
      },
      { type: "press", id: "press-bed", label: t("침상을 들어", "Pick up your bed") },
      line("침상은 생각보다 가볍다.", "The bed is lighter than he expected."),
      { type: "press", id: "press-home", label: t("집으로", "Go home") },
      verse("MT_9_7"),
      line("등 뒤에서 무리의 소리가 커진다.", "Behind him, the crowd's voices swell."),
      verse("MT_9_8"),
      fx("light", { level: "off" }),

      // ---------- Home at dusk (eye level) ----------
      scene("road_home", "standing", "오후 · 집으로 가는 길", "Afternoon · The road home"),
      line(
        "아침에 실려 내려온 골목을, 이번엔 걸어서 올라간다. 요나가 빈손으로 옆에서 걷는다.",
        "He walks back up the lane he was carried down this morning. Yonah keeps pace beside him, empty-handed."
      ),
      say("asher", "다음엔 바닷가까지 달리기 시합이다. 안 봐준다.", "Next time, we race to the beach. I'm not going easy on you."),
      scene("doorway_evening", "standing", "해 질 녘 · 아셀의 집 앞", "Dusk · Asher's doorway"),
      // The c2 sound comes back, heard standing this time.
      when({ flag: "sound", is: "water" }, line("안에서 물 붓는 소리가 난다. 아침의 그 소리다.", "Inside, someone is pouring water. The same sound as this morning.")),
      when(
        { flag: "sound", is: "prayer" },
        line("옆집에서 할아버지의 저녁 기도가 들려온다. 아침의 그 목소리다.", "From next door comes the old man's evening prayer. The same voice as this morning.")
      ),
      when({ flag: "sound", is: "brother" }, line("문 앞에서 동생이 숫자를 센다. 또 틀렸다.", "By the door, his little brother is counting. Wrong again.")),
      when(
        { flag: "sound", is: "whisper" },
        line("우물가에서 또 수군거린다. 오늘 저녁엔, 걸어서 돌아온 아셀 이야기다.", "The whispers at the well are back. This evening, they're about Asher walking home.")
      ),
      line("문이 열린다. 어머니가 그대로 멈춰 선다.", "The door opens. His mother stops right where she is."),

      // c10: first words to Mom (counts double).
      {
        type: "choice",
        id: "c10",
        prompt: t("어머니께 하는 첫마디는?", "What do I say to Mom first?"),
        options: [
          opt("a", "어머니, 그분이 누구신지 알아야겠어요.", "Mom, I need to find out who he is.", 1, [
            say("mother", "그래, 같이 알아보자. 일단 들어와.", "All right. We'll find out together. Come inside first.")
          ]),
          opt("b", "어머니, 그분이 제 죄가 사함을 받았대요.", "Mom, he said my sins are forgiven.", 2, [
            line("어머니의 눈이 아셀의 다리로 내려갔다가, 천천히 얼굴로 돌아온다.", "Her eyes drop to his legs, then slowly come back up to his face.")
          ]),
          opt("c", "어머니, 저 걸어요!", "Mom, I'm walking!", 3, [
            say("mother", "알아. 보고 있어.", "I know. I'm looking right at you.")
          ]),
          opt("d", "옆에 앉아 주세요. 처음부터 말하고 싶어요.", "Sit with me. I want to tell you from the beginning.", 2, [
            line("어머니가 문턱에 앉는다. 아셀도 그 옆에 앉는다. 이번엔 자기 힘으로.", "His mother sits down on the threshold. Asher sits beside her, on his own this time.")
          ])
        ]
      }
    ],

    // Titles come from data/meta.js (BHS.meta.endings.asher).
    endings: {
      // Lens 1: who is he?
      "1": {
        beats: [
          scene("asher_home", "normal", "밤 · 아셀의 집", "Night · Asher's house", "night"),
          thought("나를 걷게 하신 분이, 하나님만 하실 수 있는 말을 하셨다.", "The one who got me walking said what only God can say."),
          when(
            { choice: "c6", is: "d" },
            thought("그분 앞에서 하려던 질문이, 이제 평생 물을 질문이 됐다.", "The question I meant to ask him has become one I'll keep asking all my life.")
          ),
          line(
            "그날 밤, 아셀은 천장의 금을 세지 않는다. 처음으로, 자기 병이 아니라 그분을 생각하며 잠든다.",
            "That night, Asher doesn't count the cracks in the ceiling. For the first time, he falls asleep thinking not about his illness, but about him."
          )
        ],
        last: t("다리를 고칠 분을 만나러 갔다. 죄를 사하는 분을 만나고 왔다.", "I went to find someone who could heal my legs. I came home having met the one who forgives sins.")
      },

      // Lens 2: why these words first?
      "2": {
        beats: [
          scene("asher_home", "normal", "저녁 · 아셀의 집", "Evening · Asher's house", "evening"),
          line("아셀은 ‘걸었다’로 이야기를 시작하지 않는다.", "Asher doesn't start the story with “I walked.”"),
          line("누워 있던 자기에게, 그분이 먼저 말을 거신 순간부터 시작한다.", "He starts from the moment Jesus spoke to him first, while he was still lying on his bed."),
          // The c3 memory returns; variant when he resolved this morning to speak first.
          when(
            { not: { choice: "c3", is: "d" } },
            thought("그날 동생에게 한 말이 떠오른다. 내일은 동생에게 먼저 말을 걸어야겠다.", "I think of what I said to my brother that day. Tomorrow, I'll talk to him first.")
          ),
          when(
            { choice: "c3", is: "d" },
            thought("아침의 다짐은 내일까지 미룰 필요가 없다. 동생이 문 앞에 있다.", "No need to put off this morning's promise until tomorrow. My brother is right there by the door.")
          )
        ],
        last: t("왜 병들었는지는 모른다. 오늘 그분이 나에게 하신 말씀은 안다.", "I don't know why I got sick. I do know what he said to me today.")
      },

      // Lens 3: where to? Home, people, a life starting again.
      "3": {
        beats: [
          line("아침에 누워서 듣던 그 소리를, 지금은 서서 듣는다.", "The sound he heard lying down this morning, he now hears standing up."),
          line("아셀은 자기를 싣고 다니던 침상을 들고 문을 넘는다.", "Asher carries the bed that used to carry him, and steps through the door."),
          // The c2 sound returns as tomorrow's first plan.
          when({ flag: "sound", is: "water" }, thought("내일 아침엔, 내가 물을 길어 와야지.", "Tomorrow morning, I'll be the one bringing the water.")),
          when(
            { flag: "sound", is: "prayer" },
            thought("내일 아침엔, 문 앞에 서서 할아버지 기도를 따라 해야지.", "Tomorrow morning, I'll stand in the doorway and pray along with the old man.")
          ),
          when(
            { flag: "sound", is: "brother" },
            thought("내일 아침엔, 동생이랑 문 앞에서 같이 놀아야지. 숫자도 고쳐 주고.", "Tomorrow morning, I'll play with my brother by the door. And fix his counting.")
          ),
          when({ flag: "sound", is: "whisper" }, thought("내일 아침엔, 우물까지 내 발로 걸어가 봐야지.", "Tomorrow morning, I'll walk to the well on my own.")),
          when({ choice: "c4", is: "d" }, line("갈색 겉옷은 문 옆에 걸어 둔다. 내일 입고 나갈 것이다.", "He hangs the brown cloak by the door. He'll wear it out tomorrow."))
        ],
        last: t("너를 들고 다니던 침상을, 이제 네가 들고 문을 연다.", "Now you carry the bed that used to carry you, and you open the door.")
      }
    },

    // Shared record line after any ending.
    endingCoda: [
      sign(
        "일어나기 시도 {{var:getup_count}}번 · 걸린 문장 1개",
        "Attempts to get up: {{var:getup_count}} · Sentences it took: 1"
      )
    ]
  };
})();
