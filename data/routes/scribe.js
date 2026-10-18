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
      { type: "line", speaker: "hanan", text: { ko: "선생님, 누가 용서하시고, 누가 고치시는 거예요?", en: "Teacher, who forgives? And who heals?" } },
      {
        type: "choice",
        id: "c1",
        prompt: { ko: "무엇부터 짚어 줄까?", en: "Where to begin?" },
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
              { type: "line", speaker: "hanan", text: { ko: "그렇게 읽으니 새롭네요.", en: "I've never read it that way." } }
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
      { type: "line", speaker: "hanan", text: { ko: "하나 더 여쭤볼게요. 선지자도 죄를 사할 수 있나요? 나단은 다윗에게 이렇게 말했잖아요.", en: "May I ask one more thing? Can a prophet forgive sins? Nathan told David this:" } },
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
              { type: "line", speaker: "hanan", text: { ko: "살았다 싶었겠죠. 아니면 울었거나요.", en: "I bet he felt he could breathe again. Or maybe he wept." } }
            ]
          },
          {
            id: "d",
            lens: 3,
            text: { ko: "“속죄는 성전에서 받는데 못 걷는 사람은 거기까지 어떻게 가지?” ({{r:LV_4_31B}})", en: "“Atonement happens at the temple. How does a man who can't walk get there?” ({{r:LV_4_31B}})" },
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
      { type: "line", speaker: "neighbor", text: { ko: "서기관님, 들으셨어요? 예수라는 사람이 배 타고 돌아온대요!", en: "Have you heard, sir? That man Jesus is coming back by boat!" } },
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
      { type: "line", text: { ko: "누구도 므나헴에게 말을 걸지 않고, 므나헴도 말이 없다.", en: "No one says a word to Menahem, and he says nothing either." } },
      {
        type: "choice",
        id: "c4",
        prompt: { ko: "침상이 곁을 지나간다. 그 짧은 순간에…", en: "The bed goes right past him. In that moment…" },
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
            text: { ko: "길을 비켜 주고, 손짓으로 옆 사람들도 비켜 서게 한다.", en: "He makes room, and with a wave of his hand gets the people beside him to step back too." },
            reaction: [
              { type: "line", text: { ko: "좁은 골목에, 침상이 지나갈 자리가 조금 넓어진다.", en: "In the narrow lane, there's a little more room for the bed." } }
            ]
          }
        ]
      },
      // Callback: c2 d asked how a man who cannot walk reaches the temple.
      { when: { choice: "c2", is: "d" }, type: "line", speaker: "thought", text: { ko: "못 걷는 사람이 성전까지 어떻게 가느냐고 아침에 물었지. 저렇게, 남의 손에 들려서 가는구나.", en: "This morning I asked how a man who can't walk gets to the temple. Like that: carried by other people's hands." } },
      { type: "line", text: { ko: "침상은 골목 아래 무리 속으로 사라진다. 두 사람도 그 뒤를 따라 내려간다.", en: "The bed disappears into the crowd below. The two of them follow it down." } },

      // ---------------------------------------------------------------
      // AROUND NOON: THE CROWD, fixed sequence of SPEC 6.4 (c5, c6)
      // Menahem says nothing aloud from here until he leaves.
      // ---------------------------------------------------------------
      { id: "crowd", type: "scene", bg: "crowd", caption: { ko: "정오 무렵 · 바닷가 빈터", en: "Around noon · Open ground by the shore" } },
      { type: "fx", fx: "light", level: "soft" },
      { type: "line", text: { ko: "바닷가 빈터가 사람들로 가득하다. 므나헴은 서기관 몇 사람과 함께 앞쪽에 선다.", en: "The open ground by the shore is packed. Menahem stands near the front with a few other scribes." } },
      { type: "line", text: { ko: "무리 한가운데에 예수라는 사람이 있다.", en: "At the center of the crowd is this Jesus." } },
      { type: "line", text: { ko: "골목에서 본 그 침상이 무리 사이를 지나온다. 사람들이 침상을 그 앞에 내려놓는다.", en: "The bed from the lane comes through the crowd. The men set it down in front of him." } },
      { type: "verse", key: "MT_9_2A" },

      // The first words: the world goes quiet, the light rises, the morning's psalm returns.
      { id: "first-words", type: "fx", fx: "light", level: "bright" },
      { type: "fx", fx: "hush" },
      { type: "verse", key: "MT_9_2B" },
      // One echo per underline value so the line right after each echo is always shown with it.
      { when: { flag: "underline", is: "subject" }, type: "fx", fx: "echoVerse", key: "PS_103_3", highlight: underlineHighlight() },
      { when: { flag: "underline", is: "subject" }, type: "line", speaker: "thought", text: { ko: "아침에 밑줄 그은 주어가 번진다. 사하시는 분은 주님이셨다.", en: "The subject I underlined this morning bleeds through. The one who forgives was the Lord." } },
      { when: { flag: "underline", is: "order" }, type: "fx", fx: "echoVerse", key: "PS_103_3", highlight: underlineHighlight() },
      { when: { flag: "underline", is: "order" }, type: "line", speaker: "thought", text: { ko: "아침에 찍어 둔 작은 점이 떠오른다. 용서가 먼저, 치유는 그다음.", en: "The little dot from this morning comes back. Forgiving first, healing after." } },
      { when: { flag: "underline", is: "sick" }, type: "fx", fx: "echoVerse", key: "PS_103_3", highlight: underlineHighlight() },
      { when: { flag: "underline", is: "sick" }, type: "line", speaker: "thought", text: { ko: "아침에 밑줄 그은 *병*이라는 글자가 번진다. 저 침상 위의 사람에게로.", en: "The word I underlined this morning, *diseases*, bleeds toward the man on the bed." } },
      { when: { flag: "underline", is: "whole" }, type: "fx", fx: "echoVerse", key: "PS_103_3", highlight: underlineHighlight() },
      { when: { flag: "underline", is: "whole" }, type: "line", speaker: "thought", text: { ko: "아침에 처음부터 읽은 시 한 편이, 통째로 겹쳐 온다.", en: "The whole psalm I read from the top this morning rises over the moment." } },
      { type: "fx", fx: "light", level: "soft" },

      // Matt 9:3, shown as Menahem's own unspoken thought.
      { type: "line", text: { ko: "막을 새도 없이 생각 하나가 떠오른다. 곁의 서기관들도 굳어 있다.", en: "Before he can stop it, a thought rises in him. The scribes beside him have gone stiff." } },
      { id: "thought-9-3", type: "verse", key: "MT_9_3Q", speaker: "scribes" },
      {
        type: "choice",
        id: "c5",
        prompt: { ko: "그다음엔 무슨 생각이 들까?", en: "And after that, what comes to mind?" },
        options: [
          {
            id: "a",
            lens: 1,
            text: { ko: "넘어서는 안 될 선을 넘었다.", en: "He has crossed a line no one may cross." },
            reaction: [
              { type: "line", text: { ko: "기록장을 쥔 손에 힘이 들어간다.", en: "His grip tightens on his notes." } }
            ]
          },
          {
            id: "b",
            lens: 1,
            text: { ko: "하나님의 용서를 전하는 건가, 자기 권한으로 말하는 건가?", en: "Is he passing on God's forgiveness, or speaking on his own authority?" },
            reaction: [
              { type: "line", speaker: "thought", text: { ko: "나단은 여호와께서 사하셨다고 전했다. 이 사람은 그 이름을 대지 않았다.", en: "Nathan said it was the Lord who forgave. This man never named the Lord." } }
            ]
          },
          {
            id: "c",
            lens: 2,
            text: { ko: "왜 고치기 전에 용서부터? 아침의 그 순서처럼.", en: "Why forgiveness before healing? Like the order this morning." },
            reaction: [
              // Callback to the dot placed at c1 b.
              { when: { flag: "underline", is: "order" }, type: "line", speaker: "thought", text: { ko: "아침에 두 낱말 사이에 찍은 점. 바로 그 자리다.", en: "The dot I put between those two words this morning. Right there." } },
              { when: { not: { flag: "underline", is: "order" } }, type: "line", speaker: "thought", text: { ko: "아침의 시편도 같은 순서로 말했다.", en: "This morning's psalm said it in the same order." } }
            ]
          },
          {
            id: "d",
            lens: 3,
            text: { ko: "저 사람에게 직접 말하는구나. 아이를 부르듯이.", en: "He's speaking to the man himself—calling him son." },
            reaction: [
              { type: "line", speaker: "thought", text: { ko: "골목에서 나는 침상 위의 그를 보며 생각만 했다. 이 사람은 그에게 말을 건다.", en: "In the lane I only looked at the man on the bed and thought. This man talks to him." } }
            ]
          }
        ]
      },
      { type: "fx", fx: "pinThought", items: ["verse:MT_9_3Q", "choice:c5"] },
      { type: "line", text: { ko: "아무도 그 생각을 듣지 못했다. 그는 입 밖에 내지 않았다.", en: "No one heard that thought. He never said it out loud." } },

      // Matt 9:4: the unspoken thought is answered.
      { id: "read-receipt", type: "fx", fx: "readReceipt" },
      { type: "verse", key: "MT_9_4N" },
      { type: "verse", key: "MT_9_4Q" },
      { type: "line", text: { ko: "하난이 므나헴을 돌아본다. 므나헴의 입술은 한 번도 움직이지 않았다.", en: "Hanan turns to look at Menahem. Menahem's lips never moved." } },
      {
        type: "choice",
        id: "c6",
        prompt: { ko: "소리 내지 않은 생각에 대답이 왔다.", en: "A thought he never spoke has been answered." },
        options: [
          {
            id: "a",
            lens: 1,
            text: { ko: "그래도 내 질문은 정당하다. 누가 죄를 사할 수 있는가.", en: "Still, my question is fair. Who can forgive sins?" },
            reaction: [
              { type: "line", text: { ko: "질문은 거두지 않는다. 다만 이제 예수라는 사람에게서 눈을 떼지 못한다.", en: "He doesn't take the question back. But now he can't take his eyes off this Jesus." } }
            ]
          },
          {
            id: "b",
            lens: 2,
            text: { ko: "말하지 않은 생각을 어떻게 알았지? 마음은 하나님만 아시는데. ({{r:KI1_8_39B}})", en: "How did he know a thought I never spoke? Only God knows the heart. ({{r:KI1_8_39B}})" },
            reaction: [
              { type: "line", speaker: "thought", text: { ko: "성전을 봉헌하던 솔로몬의 기도가 떠오른다. {{v:KI1_8_39B}}", en: "Solomon's prayer at the temple's dedication comes back to me. {{v:KI1_8_39B}}" } }
            ]
          },
          {
            id: "c",
            lens: 2,
            text: { ko: "악한 생각이라니. 나는 말씀을 지키려 했을 뿐인데.", en: "Evil? I was only trying to guard God's word." },
            reaction: [
              { type: "line", text: { ko: "새벽에 두루마리를 펼 때도 그 마음이었다. 그 마음이 지금 시험받는다.", en: "That was his heart at dawn, opening the scroll. Now that heart is being tested." } }
            ]
          },
          {
            id: "d",
            lens: 3,
            text: { ko: "침상 위 저 사람의 얼굴을 보기도 전에, 나는 판단부터 했구나.", en: "I judged before I had even looked at the face of the man on the bed." },
            reaction: [
              // Callback to what Menahem did in the lane (c4).
              { when: { choice: "c4", is: "d" }, type: "line", speaker: "thought", text: { ko: "골목에서 길은 비켜 주었다. 그런데 얼굴은 제대로 보지 않았다.", en: "In the lane I made room for him. But I never really looked at his face." } },
              { when: { choice: "c4", in: ["a", "b", "c"] }, type: "line", speaker: "thought", text: { ko: "골목에서 눈이 마주쳤었다. 그때도 내 생각은 다른 데 있었다.", en: "Our eyes met in the lane. Even then, my mind was somewhere else." } }
            ]
          }
        ]
      },
      { type: "fx", fx: "unpinThought" },

      // Matt 9:5: the question (c7).
      { type: "verse", key: "MT_9_5" },
      {
        type: "choice",
        id: "c7",
        prompt: { ko: "어느 쪽이 쉬울까?", en: "Which is easier?" },
        options: [
          {
            id: "a",
            lens: 1,
            text: { ko: "죄 사함은 증거 없이도 말할 수 있다.", en: "Forgiveness can be announced without any proof." },
            reaction: [
              { type: "line", speaker: "thought", text: { ko: "확인할 길이 없으니까. 말하기는 그쪽이 쉽다.", en: "No one can check it. That one is easier to say." } }
            ]
          },
          {
            id: "b",
            lens: 3,
            text: { ko: "걸으라고 했는데 거짓이면, 침상 위 저 사람이 제일 먼저 다친다.", en: "If he tells him to walk and it isn't true, the man on the bed gets hurt first." },
            reaction: [
              { type: "line", speaker: "thought", text: { ko: "또 한 번의 헛된 기대. 그 무게는 저 사람이 진다.", en: "One more false hope, and he's the one who has to carry it." } }
            ]
          },
          {
            id: "c",
            lens: 2,
            text: { ko: "왜 둘을 묶지? 시편 103편도 둘을 묶었는데.", en: "Why tie the two together? Psalm 103 ties them too." },
            reaction: [
              { type: "line", speaker: "thought", text: { ko: "한 문장 안에 둘이 다 있다. {{v:PS_103_3}}", en: "Both are in one sentence. {{v:PS_103_3}}" } }
            ]
          },
          {
            id: "d",
            lens: 3,
            text: { ko: "어느 쪽이든, 침상 위 저 사람에겐 둘 다 필요하다.", en: "Either way, the man on the bed needs both." },
            reaction: [
              { type: "line", speaker: "thought", text: { ko: "다리만 낫거나, 마음만 놓이거나. 어느 쪽도 반쪽이다.", en: "Healed legs and a heavy heart, or the other way round. Either would be half." } }
            ]
          }
        ]
      },

      // Matt 9:6a: the claim (c8).
      { type: "verse", key: "MT_9_6A" },
      {
        type: "choice",
        id: "c8",
        prompt: { ko: "무엇을 마음에 붙잡을까?", en: "What does he hold on to?" },
        options: [
          {
            id: "a",
            lens: 1,
            text: { ko: "그 권한이 자기에게 있다고 말하는군.", en: "He's saying that authority is his." },
            reaction: [
              { type: "line", speaker: "thought", text: { ko: "돌려 말하지도 않는다.", en: "He isn't hedging at all." } }
            ]
          },
          {
            id: "b",
            lens: 2,
            text: { ko: "용서가 먼저, 치유는 그 증거. 순서에 이유가 있었다.", en: "Forgiveness first, healing as the proof. The order had a reason." },
            reaction: [
              // Callback to the dot placed at c1 b.
              { when: { flag: "underline", is: "order" }, type: "line", speaker: "thought", text: { ko: "아침에 찍은 그 작은 점에, 이유가 있었다.", en: "That little dot from this morning meant something." } },
              { when: { not: { flag: "underline", is: "order" } }, type: "line", speaker: "thought", text: { ko: "아침의 시편과 같은 순서다.", en: "The same order as this morning's psalm." } }
            ]
          },
          {
            id: "c",
            lens: 3,
            text: { ko: "인자라… 머리 둘 곳도 없다던 그 사람이.", en: "The Son of Man… the one who said he has nowhere to lay his head." },
            reaction: [
              { type: "line", speaker: "thought", text: { ko: "집 한 칸 없는 사람이, 하나님의 권한을 말한다.", en: "A man without a roof of his own, speaking of God's authority." } }
            ]
          },
          {
            id: "d",
            lens: 2,
            text: { ko: "정확한 말을 기억해 두자. 아침의 시편 옆에 적게.", en: "Remember the exact words, to write them beside this morning's psalm." },
            reaction: [
              { type: "line", text: { ko: "므나헴은 그 말을 속으로 한 자 한 자 되새긴다.", en: "Menahem goes over the words in his head, one by one." } }
            ]
          }
        ]
      },

      // Matt 9:6b-9:7: the command, and he rises (c9).
      { type: "verse", key: "MT_9_6N" },
      { type: "fx", fx: "light", level: "bright" },
      { type: "verse", key: "MT_9_6B" },
      { type: "fx", fx: "light", level: "soft" },
      { type: "line", text: { ko: "아셀이 몸을 일으킨다. 자기를 싣고 왔던 침상을 든다.", en: "Asher pushes himself up. He picks up the bed that carried him here." } },
      { type: "verse", key: "MT_9_7" },
      {
        type: "choice",
        id: "c9",
        prompt: { ko: "그가 일어났다. 므나헴의 눈은 어디로 갈까?", en: "He is on his feet. Where do Menahem's eyes go?" },
        options: [
          {
            id: "a",
            lens: 1,
            text: { ko: "예수라는 그 사람을 다시 본다.", en: "He looks at this Jesus again." },
            reaction: [
              { type: "line", speaker: "thought", text: { ko: "소문 속의 사람이 아니다. 지금 여기 있는 사람이다.", en: "Not the man in the rumors. The man here, now." } }
            ]
          },
          {
            id: "b",
            lens: 2,
            text: { ko: "아침의 구절을 속으로 다시 읽는다.", en: "He silently reads the morning's verse again." },
            reaction: [
              // Underline callback: the psalm returns with the same mark.
              { type: "fx", fx: "echoVerse", key: "PS_103_3", highlight: underlineHighlight() },
              { type: "line", speaker: "thought", text: { ko: "같은 문장이다. 그런데 오늘은 다르게 읽힌다.", en: "The same words. Today they read differently." } }
            ]
          },
          {
            id: "c",
            lens: 3,
            text: { ko: "그 사람의 걸음을 본다. 침상을 들고 집으로 간다.", en: "He watches the man walk, carrying his bed, heading home." },
            reaction: [
              { type: "line", speaker: "thought", text: { ko: "아침엔 남의 손에 들려 왔던 사람이, 이제 자기 침상을 들고 간다.", en: "This morning other hands carried him. Now he carries his own bed." } }
            ]
          },
          {
            id: "d",
            lens: 3,
            text: { ko: "그를 데려온 사람들의 얼굴을 본다.", en: "He looks at the faces of the men who brought him." },
            reaction: [
              { type: "line", speaker: "thought", text: { ko: "땀에 젖은 얼굴들. 그가 본 그들의 믿음이 저 얼굴들이다.", en: "Faces wet with sweat. These are the faces of the faith he saw." } }
            ]
          }
        ]
      },

      // Matt 9:8, then leaving the crowd.
      { type: "verse", key: "MT_9_8" },
      { type: "line", text: { ko: "무리가 흩어진다. 므나헴은 끝내 한마디도 하지 않았다. 하난도 묻지 않는다.", en: "The crowd breaks up. Menahem never said a word. Hanan doesn't ask." } },
      { type: "fx", fx: "light", level: "off" },

      // ---------------------------------------------------------------
      // NIGHT: the last line of his notes (c10)
      // ---------------------------------------------------------------
      { id: "night", type: "scene", bg: "lamp_night", caption: { ko: "밤 · 므나헴의 방", en: "Night · Menahem's room" } },
      { type: "line", text: { ko: "긴 하루가 저문다. 등잔불 아래 기록장이 펼쳐져 있다.", en: "The long day is over. His notes lie open under the oil lamp." } },
      // Callback: c8 d memorized the exact words for this page.
      { when: { choice: "c8", is: "d" }, type: "line", text: { ko: "낮에 외워 둔 말을, 아침의 시편 옆에 한 자 한 자 옮겨 적는다.", en: "Next to the morning's psalm, he copies out the words he memorized at noon, one by one." } },
      { type: "line", speaker: "hanan", text: { ko: "선생님, 오늘 일을 뭐라고 적으실 거예요?", en: "Teacher, what are you going to write about today?" } },
      {
        type: "choice",
        id: "c10",
        prompt: { ko: "기록장의 마지막 줄에 무엇을 적을까?", en: "What goes on the last line of his notes?" },
        options: [
          {
            id: "a",
            lens: 1,
            text: { ko: "“그 주장은 받아들일 수 없다. 신성모독.”", en: "“That claim cannot be accepted. Blasphemy.”" },
            reaction: [
              { type: "line", text: { ko: "갈대 펜 끝이 그 단어 위에 오래 머문다.", en: "The tip of his reed pen rests on that word for a long time." } }
            ]
          },
          {
            id: "b",
            lens: 2,
            text: { ko: "“말씀은 그대로다. 오늘 그 말씀이 한 사람의 입에서 나왔다.”", en: "“The Word stands as it was. Today it came from one man's mouth.”" },
            reaction: [
              { type: "line", text: { ko: "다 적고 나서도, 그는 그 줄을 한참 들여다본다.", en: "Even after he finishes, he keeps looking at that line." } }
            ]
          },
          {
            id: "c",
            lens: 3,
            text: { ko: "“그는 권한으로 한 사람을 집에 보냈다. 나는 내 권한으로 오늘 무엇을 했나.”", en: "“He used that authority to send one man home. What did I do with mine today?”" },
            reaction: [
              { type: "line", text: { ko: "마지막 물음까지 적고, 그는 펜을 내려놓는다.", en: "He writes the question out to the end and sets down his pen." } }
            ]
          },
          {
            id: "d",
            lens: 1,
            text: { ko: "“결론은 비워 둔다. 내일 다시 가겠다.”", en: "“Conclusion left blank. I will go again tomorrow.”" },
            reaction: [
              { type: "line", text: { ko: "결론 칸은 비어 있다. 하난이 그 빈칸을 오래 본다.", en: "The space for a conclusion stays empty. Hanan looks at it for a long time." } }
            ]
          }
        ]
      }
    ],

    endingPreface: [],

    // Titles come from data/meta.js (BHS.meta.endings.scribe); none are defined here.
    endings: {
      // (1) Who? "Who Spoke"
      "1": {
        beats: [
          { type: "line", text: { ko: "므나헴은 그 주장을 누구보다 정확히 알아들었다.", en: "Menahem understood that claim more precisely than anyone there." } },
          { type: "line", text: { ko: "하나님만 하실 수 있는 말을, 한 사람이 자기 권한으로 했다.", en: "One man said, on his own authority, what only God can say." } },
          // Underline callback: what he marked at dawn.
          { when: { flag: "underline", is: "subject" }, type: "line", text: { ko: "아침에 밑줄 그은 주어는 주님이셨다. 오늘 한 사람이 바로 그 자리에서 말했다.", en: "The subject he underlined this morning was the Lord. Today a man spoke from that very place." } },
          { when: { flag: "underline", is: "order" }, type: "line", text: { ko: "아침에 그는 용서와 치유 사이에 점을 찍었다. 오늘은 두 일이 한 입에서 나왔다.", en: "This morning he put a dot between forgiving and healing. Today both came from one mouth." } },
          { when: { flag: "underline", is: "sick" }, type: "line", text: { ko: "아침에 그는 *병*에 밑줄을 그었다. 오늘 그 병을 고친 사람이, 죄도 사한다고 했다.", en: "This morning he underlined *diseases*. Today the man who healed a disease also claimed to forgive sins." } },
          { when: { flag: "underline", is: "whole" }, type: "line", text: { ko: "아침에 그는 시 전체를 처음부터 읽었다. 그 시가 주님께 돌린 일을, 오늘 한 사람이 했다.", en: "This morning he read the whole psalm from the top. What that psalm gives to the Lord, a man did today." } },
          // Variant by the last line he wrote (c10).
          { when: { choice: "c10", is: "a" }, type: "line", text: { ko: "그는 마지막 줄에 *신성모독*이라고 적었다.", en: "On the last line he wrote: *blasphemy*." } },
          { when: { choice: "c10", is: "a" }, type: "line", text: { ko: "같은 말이 마태복음 끝, 대제사장의 입에서 다시 나온다. {{v:MT_26_65Q}} ({{r:MT_26_65}})", en: "The same charge comes back at the end of Matthew, from the high priest: {{v:MT_26_65Q}} ({{r:MT_26_65}})" } },
          { when: { choice: "c10", is: "d" }, type: "line", text: { ko: "그는 결론 칸을 비워 두었다.", en: "He left the conclusion blank." } },
          { when: { choice: "c10", is: "d" }, type: "line", text: { ko: "그는 누구인가. 그 질문이 내일도 그를 그 자리로 데려갈 것이다.", en: "Who is he? That question will take him back there tomorrow." } },
          { when: { choice: "c10", in: ["b", "c"] }, type: "line", text: { ko: "기록장에는 다른 문장이 남았다. 그래도 밤늦도록 그를 붙든 물음은 하나다. 누가 말했는가.", en: "His notes say something else. But one question holds him late into the night: who spoke?" } }
        ],
        last: { ko: "하나님에 대해서는 네가 옳았다. 남은 질문은 그에 대한 것이다.", en: "About God, you were right. What's left is a question about him." }
      },

      // (2) Why first? "The Psalm, Read Again"
      "2": {
        beats: [
          { type: "line", text: { ko: "밤. 므나헴은 시편 103편을 다시 편다.", en: "Night. Menahem opens Psalm 103 again." } },
          // Underline callback: the same highlight as at dawn and at the first words.
          { when: { flag: "underline", is: "subject" }, type: "fx", fx: "echoVerse", key: "PS_103_3", highlight: underlineHighlight() },
          { when: { flag: "underline", is: "subject" }, type: "line", text: { ko: "아침에 그은 밑줄이 그대로 있다. 사하시는 분도, 고치시는 분도 주님이시다.", en: "This morning's underline is still there. The one who forgives and heals is the Lord." } },
          { when: { flag: "underline", is: "order" }, type: "fx", fx: "echoVerse", key: "PS_103_3", highlight: underlineHighlight() },
          { when: { flag: "underline", is: "order" }, type: "line", text: { ko: "아침에 찍은 작은 점이 그대로 있다. 용서, 그리고 치유.", en: "The little dot from this morning is still there. Forgiving, then healing." } },
          { when: { flag: "underline", is: "sick" }, type: "fx", fx: "echoVerse", key: "PS_103_3", highlight: underlineHighlight() },
          { when: { flag: "underline", is: "sick" }, type: "line", text: { ko: "아침에 그은 밑줄이 그대로 있다. *병*이라는 글자 아래.", en: "This morning's underline is still there, under *diseases*." } },
          { when: { flag: "underline", is: "whole" }, type: "fx", fx: "echoVerse", key: "PS_103_3", highlight: underlineHighlight() },
          { when: { flag: "underline", is: "whole" }, type: "line", text: { ko: "아침처럼, 그 시를 다시 처음부터 읽는다.", en: "As he did this morning, he reads the psalm again from the top." } },
          { type: "line", text: { ko: "오늘 그 두 일이 그 순서대로, 한 사람의 말로 일어났다.", en: "Today both of those things happened, in that order, at one man's word." } },
          // Callback: c6 c felt the rebuke about evil thoughts.
          { when: { choice: "c6", is: "c" }, type: "line", text: { ko: "악한 생각이라는 말이 아직 아프다. 그래도 그는 두루마리를 덮지 않는다.", en: "The words about evil thoughts still sting. Even so, he doesn't roll up the scroll." } },
          { type: "line", speaker: "thought", text: { ko: "아침엔 하난이 물었다. 누가 용서하시고, 누가 고치시느냐고. 오늘 밤엔 내가 묻는다.", en: "This morning Hanan asked who forgives and who heals. Tonight I'm the one asking." } }
        ],
        last: { ko: "말씀은 바뀌지 않았다. 내 질문이 바뀌었다.", en: "The Word hasn't changed. My question has." }
      },

      // (3) Where to? "A Man Carrying His Bed"
      "3": {
        beats: [
          { type: "line", text: { ko: "그는 하나님만 가지신 권한을 말했다.", en: "He claimed an authority that belongs to God alone." } },
          { type: "line", text: { ko: "그리고 그 권한으로 우리를 벌하지도, 무리를 모으지도 않았다. 한 사람을 집에 보냈다.", en: "And with it he didn't punish us or rally the crowd. He sent one man home." } },
          // Callback: c3 c wondered why the town sent him away.
          { when: { choice: "c3", is: "c" }, type: "line", text: { ko: "그 동네는 그를 떠나보냈다. 그는 오늘 한 사람을 집으로 돌려보냈다.", en: "That town sent him away. Today he sent a man back home." } },
          // Callback: where his eyes went at c9.
          { when: { choice: "c9", is: "c" }, type: "line", text: { ko: "침상을 들고 멀어지던 뒷모습이 아직 눈에 선하다.", en: "He can still see the man's back as he walked away with his bed." } },
          { when: { choice: "c9", is: "d" }, type: "line", text: { ko: "그를 들고 왔던 사람들이 빈손으로 그 뒤를 따라가던 모습이 떠오른다.", en: "He remembers the men who carried him there, following him home empty-handed." } },
          // Underline callback for the word "diseases".
          { when: { flag: "underline", is: "sick" }, type: "line", text: { ko: "아침에 *병*에 그은 밑줄 위로, 오늘 본 얼굴 하나가 겹친다.", en: "Over the word he underlined this morning, *diseases*, he now sees a face from today." } }
        ],
        last: { ko: "나는 오늘 율법으로 그 사람을 판단했다. 그는 권한으로 그 사람을 일으켰다.", en: "Today I judged that man by the Law. He raised him up by his authority." }
      }
    },

    endingCoda: []
  };
})();
