/* Scribe route: Menahem, "The Line I Read This Morning". Owner: scribe writer.
   Schema: docs/SPEC.md section 4.5. Story: docs/scenario-v2.md (scribe route).
   Every player-facing string is a T object { ko, en }. Scripture appears only as
   verse beats or {{v:KEY}} / {{r:KEY}} tokens. Jesus speaks only through verse beats. */
(function () {
  var BHS = (window.BHS = window.BHS || {});
  BHS.routes = BHS.routes || {};

  // Highlight map for the Psalm 103:3 echo, keyed by the flag set at c1.
  // Returns a fresh object each time so no two beats share a reference.
  function underlineHighlight() {
    return {
      flag: "underline",
      map: {
        subject: { ko: ["그가"], en: ["who"] },
        order: { ko: ["사하시며", "고치시며"], en: ["forgives", "heals"] },
        sick: { ko: ["병"], en: ["diseases"] },
        whole: "*"
      }
    };
  }

  BHS.routes.scribe = {
    id: "scribe",
    actions: [],

    beats: [
      // ---------------------------------------------------------------
      // DAWN: Menahem's room, Psalm 103 with Hanan (c1, c2)
      // ---------------------------------------------------------------
      { id: "dawn", type: "scene", bg: "dawn_lamp", caption: { ko: "새벽 · 므나헴의 방", en: "Dawn · Menahem's room" } },
      { type: "line", text: { ko: "등잔불이 흔들린다. 므나헴이 잉크 묻은 손가락으로 두루마리를 편다.", en: "The oil lamp flickers. Menahem unrolls the scroll with ink-stained fingers." } },
      { type: "line", text: { ko: "새벽마다 그는 같은 고백으로 하루를 연다. {{v:DT_6_4}}", en: "Every dawn he opens the day with the same words. {{v:DT_6_4}}" } },
      { type: "line", text: { ko: "맞은편에서 제자 하난이 두루마리를 들여다본다. 오늘 읽을 곳은 시편 103편이다.", en: "Across from him, his student Hanan leans over the scroll. Today's reading is Psalm 103." } },
      { type: "verse", key: "PS_103_3" },
      { type: "line", speaker: "hanan", text: { ko: "선생님, 누가 용서하고, 누가 고치시는 거예요?", en: "Teacher, who forgives? And who heals?" } },
      {
        type: "choice",
        id: "c1",
        prompt: { ko: "무엇부터 짚어 줄까?", en: "What to point out first?" },
        options: [
          {
            id: "a",
            lens: 1,
            set: { underline: "subject" },
            text: { ko: "“주님이시다. 주어를 분명히 해라.”", en: "“The Lord. Be clear about the subject.”" },
            reaction: [
              { type: "line", text: { ko: "므나헴은 첫 낱말 *그가* 아래에 밑줄을 긋는다.", en: "Menahem draws a line under the first word, *who*." } },
              { type: "line", speaker: "hanan", text: { ko: "다 주님이 하시는 일이군요.", en: "So it's all the Lord's doing." } }
            ]
          },
          {
            id: "b",
            lens: 2,
            set: { underline: "order" },
            text: { ko: "“용서가 먼저, 치유가 그다음에 나오는구나.”", en: "“Forgiving comes first. Healing comes after.”" },
            reaction: [
              { type: "line", text: { ko: "므나헴은 *사하시며*와 *고치시며* 사이에 작은 점을 찍는다.", en: "Menahem puts a small dot between *forgives* and *heals*." } },
              { type: "line", speaker: "hanan", text: { ko: "순서가 있네요.", en: "So there's an order." } }
            ]
          },
          {
            id: "c",
            lens: 3,
            set: { underline: "sick" },
            text: { ko: "“아픈 사람에게 이 구절은 어떻게 들릴까.”", en: "“I wonder how this line sounds to someone who is sick.”" },
            reaction: [
              { type: "line", text: { ko: "므나헴은 *병*이라는 글자 아래에 밑줄을 긋는다.", en: "Menahem draws a line under *diseases*." } },
              { type: "line", speaker: "hanan", text: { ko: "위로가 되겠죠. 아니면 더 아프거나요.", en: "It might comfort them. Or hurt even more." } }
            ]
          },
          {
            id: "d",
            lens: 2,
            set: { underline: "whole" },
            text: { ko: "“설명하기 전에 시 전체를 읽자.”", en: "“Before I explain, let's read the whole psalm.”" },
            reaction: [
              { type: "line", text: { ko: "므나헴은 두루마리를 시편의 첫 절로 되감는다.", en: "Menahem rolls the scroll back to the psalm's first verse." } },
              { type: "line", speaker: "hanan", text: { ko: "처음부터요?", en: "From the very top?" } }
            ]
          }
        ]
      },
      { type: "line", speaker: "hanan", text: { ko: "하나 더요. 선지자도 죄를 사할 수 있나요? 나단은 다윗에게 이렇게 말했잖아요.", en: "One more thing. Can a prophet forgive sins? Nathan told David this:" } },
      { type: "verse", key: "SA2_12_13B" },
      {
        type: "choice",
        id: "c2",
        prompt: { ko: "하난에게 어떻게 답할까?", en: "How to answer Hanan?" },
        options: [
          {
            id: "a",
            lens: 1,
            text: { ko: "“나단은 하나님의 용서를 전했을 뿐이다. 스스로 사하지 않았다.”", en: "“Nathan delivered God's forgiveness. He didn't forgive on his own.”" },
            reaction: [
              { type: "line", speaker: "hanan", text: { ko: "전하는 것과 사하는 것은 다르군요.", en: "So passing it on isn't the same as forgiving." } }
            ]
          },
          {
            id: "b",
            lens: 1,
            text: { ko: "“그 선을 넘어 하나님의 이름을 모독하면 돌로 치라고 했다.” ({{r:LV_24_16A}})", en: "“Cross that line—blaspheme God's name—and the Law calls for stoning.” ({{r:LV_24_16A}})" },
            reaction: [
              { type: "line", text: { ko: "하난이 침을 삼킨다.", en: "Hanan swallows." } },
              { type: "line", speaker: "thought", text: { ko: "무거운 율법이다. 그러니 더 조심해야 한다.", en: "A heavy law. All the more reason to be careful." } }
            ]
          },
          {
            id: "c",
            lens: 2,
            text: { ko: "“다윗은 그 한마디를 듣고 어떤 마음이었을까.”", en: "“I wonder what David felt when he heard those words.”" },
            reaction: [
              { type: "line", speaker: "hanan", text: { ko: "살았다 싶었겠죠. 아니면 울었거나요.", en: "Like he could breathe again, I bet. Or he wept." } }
            ]
          },
          {
            id: "d",
            lens: 3,
            text: { ko: "“속죄는 성전에서 받는데, 못 걷는 사람은 거기까지 어떻게 가지?” ({{r:LV_4_31B}})", en: "“Atonement happens at the temple. How does a man who can't walk get there?” ({{r:LV_4_31B}})" },
            reaction: [
              { type: "line", speaker: "hanan", text: { ko: "…그건 생각해 본 적이 없어요.", en: "…I've never thought about that." } }
            ]
          }
        ]
      },

      // ---------------------------------------------------------------
      // MORNING: the neighbor at the door with the rumor (c3)
      // ---------------------------------------------------------------
      { id: "knock", type: "line", speaker: "sign", text: { ko: "― 문 두드리는 소리 ―", en: "— a knock at the door —" } },
      { type: "line", speaker: "neighbor", text: { ko: "서기관님, 들으셨어요? 예수라는 사람이 배 타고 돌아온대요!", en: "Have you heard, sir? That Jesus is coming back by boat!" } },
      { type: "line", speaker: "neighbor", text: { ko: "바다에서 폭풍이 그 사람 말 한마디에 잠잠해졌대요. 건너편에선 귀신들이 쫓겨났고요.", en: "They say a storm on the sea went still at one word from him. And across the lake, demons were driven out." } },
      { type: "line", speaker: "neighbor", text: { ko: "그런데 그 동네 사람들은 떠나 달라고 빌었대요.", en: "But the people over there begged him to leave." } },
      { type: "line", speaker: "neighbor", text: { ko: "따라가겠다던 서기관한테는, 자기는 머리 둘 곳도 없다고 했다더라고요.", en: "And when a scribe offered to follow him, he said he had nowhere to lay his head." } },
      {
        type: "choice",
        id: "c3",
        prompt: { ko: "소문에 뭐라고 답할까?", en: "How to answer the rumor?" },
        options: [
          {
            id: "a",
            lens: 1,
            text: { ko: "“이적만으로는 알 수 없다. 무엇을 가르치는지 봐야 한다.” ({{r:DT_13_1_3}})", en: "“Signs alone don't settle it. We have to see what he teaches.” ({{r:DT_13_1_3}})" },
            reaction: [
              { type: "line", speaker: "neighbor", text: { ko: "역시 서기관님이세요. 그래도 보러는 가실 거죠?", en: "Spoken like a scribe. But you're still going to go look, right?" } }
            ]
          },
          {
            id: "b",
            lens: 2,
            text: { ko: "“바람과 바다를 말로? 시편은 그 일을 하나님께 돌리는데.” ({{r:PS_107_29}})", en: "“Wind and sea, with a word? The psalm credits that to God.” ({{r:PS_107_29}})" },
            reaction: [
              { type: "line", speaker: "thought", text: { ko: "{{v:PS_107_29}} 그 일을 사람이 했다고?", en: "{{v:PS_107_29}} And a man did that?" } }
            ]
          },
          {
            id: "c",
            lens: 3,
            text: { ko: "“그 동네는 왜 그를 내보냈을까.”", en: "“Why would that town send him away?”" },
            reaction: [
              { type: "line", speaker: "neighbor", text: { ko: "돼지 떼를 잃었대요. 귀신 들렸던 두 사람이 놓여났는데도요.", en: "They lost a whole herd of pigs, I hear. Even though the two men with demons were set free." } }
            ]
          },
          {
            id: "d",
            lens: 3,
            text: { ko: "“직접 가서 보겠다. 그가 사람들을 어떻게 대하는지.”", en: "“I'll go and see for myself how he treats people.”" },
            reaction: [
              { type: "line", speaker: "hanan", text: { ko: "저도 따라가겠습니다, 선생님.", en: "I'm coming with you, Teacher." } }
            ]
          }
        ]
      },
      { type: "line", text: { ko: "므나헴은 기록장을 챙겨 집을 나선다. 하난이 뒤를 따른다.", en: "Menahem takes his notes and heads out. Hanan follows." } },

      // ---------------------------------------------------------------
      // LATE MORNING: walking down with Hanan, then THE LANE (c4)
      // SPEC 6.3: they step aside, eyes meet, nobody speaks to anybody.
      // ---------------------------------------------------------------
      { id: "lane", type: "scene", bg: "lane", caption: { ko: "늦은 아침 · 골목", en: "Late morning · The lane" } },
      { type: "line", text: { ko: "검은 현무암 집들 사이로, 골목이 바닷가를 향해 내려간다.", en: "Between black basalt houses, the lane slopes down toward the shore." } },
      { type: "line", text: { ko: "골목 끝으로 바다가 보인다. 배 한 척이 물가에 닿는다.", en: "At the bottom of the lane the sea opens up. A boat is coming in to shore." } },
      { type: "verse", key: "MT_9_1" },
      { type: "line", speaker: "hanan", text: { ko: "선생님, 그 사람이 정말 폭풍을 잠잠하게 했을까요?", en: "Teacher, do you think he really calmed a storm?" } },
      { type: "line", speaker: "menahem", text: { ko: "보면 알겠지. 눈으로 보고, 말씀으로 달아 보자.", en: "We'll see. Watch with your eyes, and weigh it by the Word." } },
      { type: "line", text: { ko: "그때 위쪽에서 발소리가 내려온다. 사람들이 침상에 누운 사람을 들고 온다.", en: "Then footsteps come down from above. Some men are carrying a man on a bed." } },
      { type: "line", text: { ko: "므나헴과 하난은 벽 쪽으로 비켜 선다. 침상이 지나갈 만큼만.", en: "Menahem and Hanan step back against the wall, just enough for the bed to pass." } },
      { type: "line", speaker: "passerby", text: { ko: "고통 뒤에 무슨 사연이 있는지 누가 알겠어. 저 사람은 무슨 잘못을 했기에 저렇게 됐을까.", en: "Who knows what's behind suffering like that. What did he do to end up like that?" } },
      { type: "line", text: { ko: "므나헴은 침상을 힐끗 본다. 누운 사람은 아셀이다. 잠깐, 두 사람의 눈이 마주친다.", en: "Menahem glances at the bed. The man lying there is Asher. For a moment, their eyes meet." } },
      { type: "line", text: { ko: "누구도 서로에게 말을 걸지 않는다.", en: "Nobody says a word to anybody." } },
      {
        type: "choice",
        id: "c4",
        prompt: { ko: "침상이 곁을 지나가는 동안, 므나헴은…", en: "As the bed goes by, Menahem…" },
        options: [
          {
            id: "a",
            lens: 1,
            text: { ko: "저 사람을 고친다면, 오늘 저 선생이 누구인지 드러나겠군.", en: "If he heals that man, we'll know today who this teacher really is." },
            reaction: [
              { type: "line", text: { ko: "그의 눈은 침상 위의 사람을 지나, 길 아래쪽을 향한다.", en: "His eyes pass over the man on the bed and go on down the lane." } }
            ]
          },
          {
            id: "b",
            lens: 2,
            text: { ko: "혹시 죄의 징계일까. 시편의 미련한 자들처럼. ({{r:PS_107_17}})", en: "Could it be discipline for sin, like the fools in the psalm? ({{r:PS_107_17}})" },
            reaction: [
              { type: "line", speaker: "thought", text: { ko: "시편 한 구절이 떠오른다. {{v:PS_107_17}}", en: "A line from the psalms comes to mind. {{v:PS_107_17}}" } }
            ]
          },
          {
            id: "c",
            lens: 2,
            text: { ko: "병의 이유를 우리가 알 수 있나. 욥의 친구들도 틀렸다. ({{r:JB_42_7}})", en: "Can we even know why a man is sick? Job's friends got it wrong. ({{r:JB_42_7}})" },
            reaction: [
              { type: "line", speaker: "thought", text: { ko: "그들은 친구를 위로하러 와서, 친구를 정죄했다.", en: "They came to comfort their friend and ended up condemning him." } }
            ]
          },
          {
            id: "d",
            lens: 3,
            text: { ko: "길을 비켜 주고, 손짓으로 옆 사람들도 비켜 서게 한다.", en: "He makes room, and with a wave of his hand gets the people beside him to make room too." },
            reaction: [
              { type: "line", text: { ko: "좁은 골목에, 침상이 지나갈 자리가 조금 넓어진다.", en: "In the narrow lane, there's a little more room for the bed." } }
            ]
          }
        ]
      },
      // Callback: c2 d asked how a man who cannot walk reaches the temple.
      { when: { choice: "c2", is: "d" }, type: "line", speaker: "thought", text: { ko: "못 걷는 사람이 성전까지 어떻게 가느냐고 아침에 물었지. 저렇게, 남의 손에 들려서 가는구나.", en: "This morning I asked how a man who can't walk gets to the temple. Like that: carried by other people's hands." } },
      { type: "line", text: { ko: "침상은 골목 아래 무리 속으로 사라진다. 두 사람도 그 뒤를 따라 내려간다.", en: "The bed disappears into the crowd below. The two of them follow it down." } }

      // MARK: crowd (c5-c9) continues here
    ],

    endingPreface: [],

    endings: {
      // MARK: endings are filled in below
      "1": { beats: [], last: { ko: "하나님에 대해서는 네가 옳았다. 남은 질문은 그에 대한 것이다.", en: "About God, you were right. What's left is a question about him." } },
      "2": { beats: [], last: { ko: "말씀은 바뀌지 않았다. 내 질문이 바뀌었다.", en: "The Word hasn't changed. My question has." } },
      "3": { beats: [], last: { ko: "나는 오늘 율법으로 그 사람을 판단했다. 그는 권한으로 그 사람을 일으켰다.", en: "Today I judged that man by the Law. He raised him up by his authority." } }
    },

    endingCoda: []
  };
})();
