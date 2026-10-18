/* Scribe route: Menahem, "The Line I Read This Morning". Owner: scribe writer.
   Short version (docs/SPEC-v3-short.md, which overrides docs/SPEC.md on choice counts,
   endings, balance and screen budget). Schema: docs/SPEC.md section 4.5.
   Shape: dawn (c1) -> the lane -> the crowd, fixed sequence of SPEC 6.4 (c2, c3) -> c4 (double).
   c2 option d is the cut option: Menahem leaves before the answer and endings.cut plays.
   Every player-facing string is a T object { ko, en }. Scripture appears only as verse beats
   or {{v:KEY}} / {{r:KEY}} tokens. Jesus speaks only through scripture keys. */
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

  // Pins his unspoken thought (Matt 9:3). Placed first in each non-cut c2 reaction so the bubble
  // is seen unread for one screen before the read receipt at 9:4. Only the 9:3 thought is pinned:
  // the rebuke in 9:4 answers that thought, not whatever he thought next (c2).
  function pinThought() {
    return { type: "fx", fx: "pinThought", items: ["verse:MT_9_3Q"] };
  }

  BHS.routes.scribe = {
    id: "scribe",
    actions: [],

    beats: [
      // ---------------------------------------------------------------
      // DAWN: Menahem's room, Psalm 103:3 with Hanan (c1 sets the noted word)
      // ---------------------------------------------------------------
      { id: "dawn", type: "scene", bg: "dawn_lamp", caption: { ko: "새벽 · 므나헴의 방", en: "Dawn · Menahem's room" } },
      // He writes in his notes, never on the scroll (lead decision).
      { type: "line", text: { ko: "등잔불 아래, 므나헴이 잉크 묻은 손으로 시편 두루마리를 편다. 맞은편엔 제자 하난, 곁에는 기록장.", en: "By lamplight, Menahem unrolls the Psalms with ink-stained fingers. Across from him, his student Hanan. Beside him, his notes." } },
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
              { type: "line", text: { ko: "므나헴은 ‘그가’라는 첫 낱말을 기록장에 옮겨 적는다.", en: "Menahem copies the first word, *who*, into his notes." } }
            ]
          },
          {
            id: "b",
            lens: 2,
            set: { underline: "order" },
            text: { ko: "“용서가 먼저, 치유가 그다음에 나오는구나.”", en: "“So forgiving is named first, and healing after.”" },
            reaction: [
              { type: "line", text: { ko: "므나헴은 기록장에 ‘사하시며’와 ‘고치시며’를 나란히 적고, 그 사이에 작은 점을 찍는다.", en: "In his notes, Menahem writes *forgives* and *heals* side by side, with a small dot between them." } }
            ]
          },
          {
            id: "c",
            lens: 3,
            set: { underline: "sick" },
            text: { ko: "“아픈 사람에게 이 구절은 어떻게 들릴까.”", en: "“I wonder how this line sounds to someone who is sick.”" },
            reaction: [
              { type: "line", text: { ko: "므나헴은 ‘병’이라는 말을 기록장에 적는다.", en: "Menahem writes the word *diseases* in his notes." } }
            ]
          },
          {
            id: "d",
            lens: 2,
            set: { underline: "whole" },
            text: { ko: "“설명하기 전에 시 전체를 읽자.”", en: "“Before I explain, let's read the whole psalm.”" },
            reaction: [
              { type: "line", text: { ko: "므나헴은 아무것도 적지 않고, 두루마리를 시편의 첫 절로 되감는다.", en: "Menahem writes nothing down. He rolls the scroll back to the psalm's first verse." } }
            ]
          }
        ]
      },

      // ---------------------------------------------------------------
      // LATE MORNING: the rumor, the walk down, THE LANE (SPEC 6.3, no choice)
      // They step aside, his eyes meet Asher's, nobody speaks to anybody.
      // ---------------------------------------------------------------
      { id: "lane", type: "scene", bg: "lane", caption: { ko: "늦은 아침 · 골목", en: "Late morning · The lane" } },
      { type: "line", text: { ko: "예수라는 사람의 배가 돌아온다는 소문에, 므나헴과 하난도 골목을 내려간다. 뒤에서 사람들이 침상 하나를 들고 온다.", en: "Word comes that this Jesus is coming back by boat. Menahem and Hanan head down the lane. Behind them, some men are carrying a man on a bed." } },
      { type: "line", speaker: "passerby", text: { ko: "고통 뒤에 무슨 사연이 있는지 누가 알겠어. 저 사람은 무슨 잘못을 했기에 저렇게 됐을까.", en: "Who knows what's behind suffering like that. What did he do to end up like that?" } },
      { type: "line", text: { ko: "두 사람은 벽 쪽으로 비켜선다. 므나헴은 침상을 힐끗 보다가, 침상 위의 아셀과 눈이 마주친다. 서로 아무 말이 없다.", en: "They step back against the wall. Menahem glances at the bed, and for a moment his eyes meet Asher's. Neither says a word to the other." } },

      // ---------------------------------------------------------------
      // AROUND NOON: THE CROWD, fixed sequence of SPEC 6.4 (c2 after 9:3, c3 after 9:5, c4 after 9:8)
      // Menahem says nothing aloud the whole time.
      // ---------------------------------------------------------------
      { id: "crowd", type: "scene", bg: "crowd", caption: { ko: "정오 무렵 · 바닷가 공터", en: "Around noon · Open ground by the shore" } },
      { type: "fx", fx: "light", level: "soft" },
      { type: "verse", key: "MT_9_1" },
      { type: "line", text: { ko: "므나헴은 서기관 몇 사람과 함께 맨 앞에 선다. 골목의 그 침상이 무리 사이로 들어온다.", en: "Menahem stands at the front with a few other scribes. The bed from the lane comes through the crowd." } },
      { type: "verse", key: "MT_9_2A" },

      // The first words: the light rises, the world goes quiet, the morning's psalm returns.
      { id: "first-words", type: "fx", fx: "light", level: "bright" },
      { type: "fx", fx: "hush" },
      { type: "verse", key: "MT_9_2B" },
      // One echo per noted word, so each thought line below is always shown with its echo.
      { when: { flag: "underline", is: "subject" }, type: "fx", fx: "echoVerse", key: "PS_103_3", highlight: underlineHighlight() },
      { when: { flag: "underline", is: "subject" }, type: "line", speaker: "thought", text: { ko: "아침에 기록장에 적은 낱말, ‘그가’. 사하시는 분은 주님이시다.", en: "The word in my notes from this morning: *who*. The one who forgives is the Lord." } },
      { when: { flag: "underline", is: "order" }, type: "fx", fx: "echoVerse", key: "PS_103_3", highlight: underlineHighlight() },
      { when: { flag: "underline", is: "order" }, type: "line", speaker: "thought", text: { ko: "아침에 기록장에 찍어 둔 작은 점. 용서가 먼저, 치유는 그다음.", en: "The little dot in my notes from this morning. Forgiving first, healing after." } },
      { when: { flag: "underline", is: "sick" }, type: "fx", fx: "echoVerse", key: "PS_103_3", highlight: underlineHighlight() },
      { when: { flag: "underline", is: "sick" }, type: "line", speaker: "thought", text: { ko: "아침에 기록장에 적은 ‘병’이라는 말이, 저 침상 위의 사람에게로 번진다.", en: "The word I wrote in my notes this morning, *diseases*, spreads toward the man on the bed." } },
      { when: { flag: "underline", is: "whole" }, type: "fx", fx: "echoVerse", key: "PS_103_3", highlight: underlineHighlight() },
      { when: { flag: "underline", is: "whole" }, type: "line", speaker: "thought", text: { ko: "아침에 처음부터 다시 읽은 시 한 편이, 통째로 겹쳐 온다.", en: "The whole psalm I read from the top this morning comes flooding back." } },
      { type: "fx", fx: "light", level: "soft" },

      // Matt 9:3, shown as Menahem's own unspoken thought.
      { id: "thought-9-3", type: "verse", key: "MT_9_3Q", speaker: "scribes" },
      {
        type: "choice",
        id: "c2",
        prompt: { ko: "므나헴은 속으로만 생각했다. 아무도 듣지 못했다. 그다음엔?", en: "Menahem only thought it. No one heard. What next?" },
        options: [
          {
            id: "a",
            lens: 1,
            text: { ko: "하나님의 용서를 전하는 건가, 자기 권한으로 말하는 건가?", en: "Is he passing on God's forgiveness, or speaking on his own authority?" },
            reaction: [
              pinThought(),
              { type: "line", speaker: "thought", text: { ko: "말만 들어서는 모른다. 말한 사람이 누구냐에 달렸다.", en: "The words alone can't tell me. It depends on who is speaking." } }
            ]
          },
          {
            id: "b",
            lens: 2,
            text: { ko: "왜 고치기 전에 용서부터? 아침의 그 순서처럼.", en: "Why forgiveness before healing? Like the order this morning." },
            reaction: [
              pinThought(),
              // Callback to the dot placed at c1 b.
              { when: { flag: "underline", is: "order" }, type: "line", speaker: "thought", text: { ko: "아침에 두 낱말 사이에 찍은 점. 바로 그 자리다.", en: "The dot I put between those two words this morning. Right there." } },
              { when: { not: { flag: "underline", is: "order" } }, type: "line", speaker: "thought", text: { ko: "아침의 시편도 같은 순서로 말했다.", en: "This morning's psalm said it in the same order." } }
            ]
          },
          {
            id: "c",
            lens: 3,
            text: { ko: "저 사람에게 직접 말하는구나. 아이를 부르듯이.", en: "He's speaking to the man himself—calling him son." },
            reaction: [
              pinThought(),
              // Callback to the lane, where he only looked.
              { type: "line", speaker: "thought", text: { ko: "골목에서 나는 저 사람을 보며 생각만 했다. 예수라는 이 사람은 그에게 직접 말을 건다.", en: "In the lane, all I did was look at that man and think. This Jesus speaks to him directly." } }
            ]
          },
          {
            // CUT (SPEC v3 section 3): after this reaction the engine skips the rest of the
            // beats and plays endings.cut. No lens, no scoring, no mismatch line.
            id: "d",
            lens: null,
            cut: true,
            // A sincere reason, not a quit button: staying to hear blasphemy would feel like taking part in it.
            text: { ko: "신성모독을 듣고 서 있을 수는 없다. 자리를 뜨자.", en: "I can't stand here and listen to blasphemy. I'm leaving." },
            reaction: [
              { type: "line", text: { ko: "므나헴은 몸을 돌려 무리를 빠져나간다. 하난은 머뭇거리다, 그 자리에 남는다.", en: "Menahem turns and makes his way out of the crowd. Hanan hesitates, then stays where he is." } },
              { type: "fx", fx: "light", level: "off" }
            ]
          }
        ]
      },

      // Matt 9:4: the thought no one heard is answered. Read receipt on the pinned bubble.
      { id: "read-receipt", type: "fx", fx: "readReceipt" },
      { type: "verse", key: "MT_9_4N" },
      { type: "verse", key: "MT_9_4Q" },
      { type: "fx", fx: "unpinThought" },

      // Matt 9:5: the question (c3).
      { type: "verse", key: "MT_9_5" },
      {
        type: "choice",
        id: "c3",
        prompt: { ko: "어느 쪽이 쉬울까?", en: "Which is easier?" },
        options: [
          {
            id: "a",
            lens: 1,
            text: { ko: "죄 사함은 증거 없이도 말할 수 있다.", en: "Forgiveness of sins can be announced without any proof." },
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
              // Callback: the psalm returns with the word he noted at dawn highlighted.
              { type: "fx", fx: "echoVerse", key: "PS_103_3", highlight: underlineHighlight() },
              { type: "line", speaker: "thought", text: { ko: "아침의 그 한 문장 안에, 둘이 다 들어 있다.", en: "Both are right there, in the one line I read this morning." } }
            ]
          },
          {
            id: "d",
            lens: 3,
            text: { ko: "어느 쪽이든, 침상 위 저 사람에겐 둘 다 필요하다.", en: "Either way, the man on the bed needs both." },
            reaction: [
              { type: "line", speaker: "thought", text: { ko: "하나님 앞에 설 자리와, 땅을 디딜 다리. 어느 하나만으로는 반쪽이다.", en: "A place to stand before God, and legs to stand on. Either one alone is half." } }
            ]
          }
        ]
      },

      // Matt 9:6-9:8: the claim, the command, he rises, the crowd.
      { type: "verse", key: "MT_9_6A" },
      { type: "verse", key: "MT_9_6N" },
      { type: "fx", fx: "light", level: "bright" },
      { type: "verse", key: "MT_9_6B" },
      { type: "fx", fx: "light", level: "soft" },
      { type: "verse", key: "MT_9_7" },
      { type: "verse", key: "MT_9_8" },

      // c4 (double weight): the last line of his notes tonight.
      {
        type: "choice",
        id: "c4",
        prompt: { ko: "오늘 밤, 기록장의 마지막 줄에 무엇을 적을까?", en: "Tonight, what goes on the last line of his notes?" },
        options: [
          {
            id: "a",
            lens: 1,
            text: { ko: "“그 주장은 받아들일 수 없다. 신성모독.”", en: "“That claim cannot be accepted. Blasphemy.”" }
          },
          {
            id: "b",
            lens: 2,
            text: { ko: "“말씀은 그대로다. 다만 오늘은 그 말씀을 한 사람이 했다.”", en: "“The Word hasn't changed. Today, a man spoke it.”" }
          },
          {
            id: "c",
            lens: 3,
            text: { ko: "“그는 권한으로 한 사람을 집에 보냈다. 내 권한으로 나는 무엇을 했나.”", en: "“He used his authority to send a man home. What did I do with mine?”" }
          },
          {
            id: "d",
            lens: 1,
            text: { ko: "“결론은 비워 둔다. 내일 다시 가겠다.”", en: "“Conclusion left blank. I will go again tomorrow.”" }
          }
        ]
      },
      // The crowd breaks up; the light leaves with the moment.
      { type: "fx", fx: "light", level: "off" }
    ],

    endingPreface: [],

    // Titles come from data/meta.js (BHS.meta.endings.scribe, including "cut"); none are defined here.
    // Each lens ending: 1-2 short beats + last. The word he noted at dawn returns in every ending.
    endings: {
      // (1) Who? "Who Spoke"
      "1": {
        beats: [
          // Narration names Menahem so that "he" in the last line can only mean Jesus.
          { when: { flag: "underline", is: "subject" }, type: "line", text: { ko: "아침에 적은 ‘그가’는 주님이셨다. 그런데 오늘, 주님만 하실 말을 한 사람이 했다.", en: "This morning, *who* in his notes meant the Lord. Today a man said what only the Lord can say." } },
          { when: { flag: "underline", is: "order" }, type: "line", text: { ko: "아침에 므나헴은 용서와 치유 사이에 점을 찍었다. 오늘은 두 일이 한 사람의 입에서 나왔다.", en: "This morning Menahem put a dot between forgiving and healing. Today both came from one man's mouth." } },
          { when: { flag: "underline", is: "sick" }, type: "line", text: { ko: "아침에 므나헴은 ‘병’이라고 적었다. 오늘 한 사람이 죄를 사하는 권한을 말하고, 병까지 고쳤다.", en: "This morning Menahem wrote *diseases*. Today a man claimed the authority to forgive sins, and healed the disease too." } },
          { when: { flag: "underline", is: "whole" }, type: "line", text: { ko: "아침에 므나헴은 시 전체를 처음부터 읽었다. 그 시가 주님께 돌린 일을, 오늘 한 사람이 했다.", en: "This morning Menahem read the whole psalm from the top. What that psalm credits to the Lord, a man did today." } },
          // Variant by the line he will write (c4).
          { when: { choice: "c4", is: "a" }, type: "line", text: { ko: "므나헴이 적을 말은 ‘신성모독’. 마태복음 뒷부분에서 대제사장도 같은 말을 한다. {{v:MT_26_65Q}} ({{r:MT_26_65}})", en: "Menahem will write *blasphemy*. Near the end of Matthew, the high priest makes the same charge: {{v:MT_26_65Q}} ({{r:MT_26_65}})" } },
          { when: { choice: "c4", is: "d" }, type: "line", text: { ko: "결론 칸은 비어 있다. 그는 누구인가. 그 질문이 내일도 므나헴을 그 자리로 데려갈 것이다.", en: "The space for a conclusion stays empty. Who is he? That question will take Menahem back there tomorrow." } }
        ],
        last: { ko: "하나님에 대해서는 네가 옳았다. 남은 질문은 그에 대한 것이다.", en: "About God, you were right. What's left is a question about him." }
      },

      // (2) Why first? "The Psalm, Read Again"
      "2": {
        beats: [
          // The same highlight as at dawn and at the first words.
          { when: { flag: "underline", is: "subject" }, type: "fx", fx: "echoVerse", key: "PS_103_3", highlight: underlineHighlight() },
          { when: { flag: "underline", is: "subject" }, type: "line", text: { ko: "아침에 적은 ‘그가’라는 낱말이 다시 보인다. 사하시는 일도, 고치시는 일도 오늘 한 사람의 말로 일어났다.", en: "He sees this morning's word again: *who*. Forgiving and healing both happened today, at one man's word." } },
          { when: { flag: "underline", is: "order" }, type: "fx", fx: "echoVerse", key: "PS_103_3", highlight: underlineHighlight() },
          { when: { flag: "underline", is: "order" }, type: "line", text: { ko: "아침에 찍은 작은 점이 다시 보인다. 오늘 두 일이 그 순서대로, 한 사람의 말로 일어났다.", en: "He sees this morning's little dot again. Today both things happened in that order, at one man's word." } },
          { when: { flag: "underline", is: "sick" }, type: "fx", fx: "echoVerse", key: "PS_103_3", highlight: underlineHighlight() },
          { when: { flag: "underline", is: "sick" }, type: "line", text: { ko: "아침에 적은 ‘병’이라는 말이 다시 보인다. 오늘 그 병이 한 사람의 말로 나았다. 죄 사함의 말 다음에.", en: "He sees this morning's word again: *diseases*. Today a disease was healed at one man's word, right after the words of forgiveness." } },
          { when: { flag: "underline", is: "whole" }, type: "fx", fx: "echoVerse", key: "PS_103_3", highlight: underlineHighlight() },
          { when: { flag: "underline", is: "whole" }, type: "line", text: { ko: "아침에 처음부터 읽은 그 시가 다시 들린다. 오늘 그 두 일이 그 순서대로, 한 사람의 말로 일어났다.", en: "The psalm he read from the top this morning comes back. Today the two things it names happened, in that order, at one man's word." } },
          // Callback to Hanan's dawn question.
          { type: "line", speaker: "thought", text: { ko: "아침엔 하난이 물었다. 누가 용서하시고, 누가 고치시느냐고. 이제는 내가 묻는다.", en: "This morning Hanan asked who forgives and who heals. Now I'm the one asking." } }
        ],
        last: { ko: "말씀은 바뀌지 않았다. 내 질문이 바뀌었다.", en: "The Word hasn't changed. My question has." }
      },

      // (3) Where to? "A Man Carrying His Bed"
      "3": {
        // First-person thoughts, matching the last line; "he" is always Jesus here.
        beats: [
          { type: "line", speaker: "thought", text: { ko: "그는 하나님만 가지신 권한을 말했다. 그러고는 우리를 벌하지도, 무리를 모으지도 않고, 한 사람을 집에 보냈다.", en: "He claimed an authority that belongs to God alone. Then, instead of punishing us or rallying the crowd, he sent one man home." } },
          { when: { flag: "underline", is: "subject" }, type: "line", speaker: "thought", text: { ko: "아침엔 누가 하시는지를 적었다. 이제는 그 일이 누구에게 일어났는지가 눈에 걸린다.", en: "This morning I wrote down who does it. Now what catches my eye is who it is done for." } },
          { when: { flag: "underline", is: "order" }, type: "line", speaker: "thought", text: { ko: "아침엔 두 낱말 사이의 점만 보았다. 오늘은 그 사이에 누워 있던 한 사람을 보았다.", en: "This morning I saw only a dot between two words. Today I saw a man lying in between." } },
          { when: { flag: "underline", is: "sick" }, type: "line", speaker: "thought", text: { ko: "아침에 적은 ‘병’이라는 말 위로, 오늘 본 얼굴 하나가 겹친다.", en: "Over the word I wrote this morning, *diseases*, I now see a face from today." } },
          { when: { flag: "underline", is: "whole" }, type: "line", speaker: "thought", text: { ko: "아침에 처음부터 읽은 그 시가, 이제는 한 사람의 이야기로 읽힌다.", en: "The psalm I read from the top this morning now reads like one man's story." } }
        ],
        // What he judged on every path is Jesus (the fixed Matt 9:3 thought), not the man on the bed.
        last: { ko: "오늘 나는 율법으로 그를 판단했다. 그는 그 권한으로 한 사람을 일으켜 세웠다.", en: "Today I judged him by the Law. He used his authority to raise a man to his feet." }
      },

      // Cut ending (c2 d). The event does not change: the man still rises and goes home.
      cut: {
        beats: [
          // The light already went off in the cut option's reaction (it plays in full before this).
          { type: "scene", bg: "lane", caption: { ko: "정오 무렵 · 골목", en: "Around noon · The lane" } },
          { type: "line", text: { ko: "누가 죄를 사할 수 있는가. 그 질문을 안고, 므나헴은 혼자 골목을 오른다. 등 뒤에서 함성이 터진다.", en: "Who can forgive sins? Carrying that question, Menahem climbs the lane alone. Behind him, the crowd breaks into a shout." } },
          { type: "line", text: { ko: "나중에 하난이 달려와 전한다. 골목의 그 사람이 일어나, 자기 침상을 들고 걸어서 집에 갔다고.", en: "Later, Hanan catches up and tells him: the man from the lane got up, picked up his bed, and walked home." } },
          // Hanan reports the answer Menahem left before hearing (Matt 9:6a, via token only).
          { type: "line", speaker: "hanan", text: { ko: "선생님, 예수라는 그 사람이 먼저 이렇게 말했어요. {{v:MT_9_6A}}", en: "Teacher, that man Jesus said this first: {{v:MT_9_6A}}" } }
        ],
        last: { ko: "질문은 옳았다. 다만 그는 답이 보이기 전에 떠났다.", en: "His question was right. He left before the answer could be seen." }
      }
    },

    endingCoda: []
  };
})();
