/* Scribe route (v4 story mode): Menahem, "The Line I Read This Morning". Owner: scribe writer.
   Rules: docs/SPEC.md, version 4 (route shape, choices and endings: sections 3.5, 4.5, 4.6, 8).
   Schema basics, canon and guardrails: docs/SPEC.md sections 4.5, 6, 7.
   Shape: dawn (c1) -> THE LANE (c2) -> THE CROWD in the fixed order of SPEC 6.4 (c3 after 9:3,
   c4 after 9:5, c5 after 9:8) -> the true ending with the memory verse MT_9_6A.
   Each option does exactly one thing: continues (default), ends in a cut branch (bad: id), or is
   scolded away by Hanan (scold: { speaker, text }) and the same choice is asked again.
   Jesus speaks only through verse beats. Menahem says nothing aloud at the crowd on the true path.
   Scribe POV: Jesus is "this Jesus" / "that man" / "he" in both languages, never with Korean
   honorific verb endings (SPEC 3.4, 6.1). */
(function () {
  var BHS = (window.BHS = window.BHS || {});
  BHS.routes = BHS.routes || {};

  BHS.routes.scribe = {
    id: "scribe",

    beats: [
      // ---------------------------------------------------------------
      // DAWN: Psalm 103:3 with Hanan, then the rumor (c1)
      // ---------------------------------------------------------------
      { id: "dawn", type: "scene", bg: "dawn_lamp", caption: { ko: "새벽 · 므나헴의 방", en: "Dawn · Menahem's room" } },
      { type: "line", text: { ko: "등잔불 아래, 므나헴이 제자 하난과 시편을 읽는다.", en: "By lamplight, Menahem reads the Psalms with his student, Hanan." } },
      { type: "verse", key: "PS_103_3" },
      {
        type: "choice",
        id: "c1",
        prompt: {
          ko: "하난이 말한다. “선생님, 예수라는 사람이 오늘 돌아온대요. 병도 고친대요!”",
          en: "Hanan says, “Teacher, this Jesus is coming back today. They say he heals the sick, too!”"
        },
        options: [
          {
            id: "a",
            // The flag drives the highlight of the Ps 103:3 echo at the first words.
            set: { dawn: "lord" },
            text: { ko: "“병은 주님이 고치신다. 직접 가서 보자.”", en: "“Healing is the Lord's work. Let's go and see.”" }
          },
          {
            id: "b",
            bad: "typo",
            text: { ko: "“잠깐, 이 글자 오타 아니냐?”", en: "“Wait—is this letter a typo?”" },
            reaction: [
              { type: "line", speaker: "menahem", text: { ko: "하난, 등잔 좀 더 가까이 대 봐라.", en: "Hanan, bring the lamp closer." } }
            ]
          }
        ]
      },

      // ---------------------------------------------------------------
      // LATE MORNING: THE LANE (SPEC 6.3). The passerby's line is byte-identical to the SPEC.
      // They step aside; Menahem's eyes meet Asher's; neither says a word to the other.
      // No reactions in c2: the cut branch at c4 must stay within 20 screens.
      // ---------------------------------------------------------------
      { id: "lane", type: "scene", bg: "lane", caption: { ko: "늦은 아침 · 골목", en: "Late morning · The lane" } },
      { type: "line", text: { ko: "므나헴과 하난이 골목을 내려간다. 뒤에서 사람들이 누군가를 침상째 들고 온다.", en: "Menahem and Hanan head down the lane. Behind them, some men are carrying someone on a bed." } },
      { id: "lane-passerby", type: "line", speaker: "passerby", text: { ko: "고통 뒤에 무슨 사연이 있는지 누가 알겠어. 저 사람은 무슨 잘못을 했기에 저렇게 됐을까.", en: "Who knows what's behind suffering like that. What did he do to end up like that?" } },
      { type: "line", text: { ko: "두 사람은 벽 쪽으로 비켜선다. 그 순간, 므나헴과 침상 위 아셀의 눈이 마주친다. 서로 아무 말도 하지 않는다.", en: "The two step back against the wall. For a moment, Menahem looks right at Asher, the man on the bed, and Asher looks back. Neither says a word." } },
      {
        type: "choice",
        id: "c2",
        prompt: { ko: "행인의 말이 아직 귀에 남아 있다. 므나헴은?", en: "The passerby's words still hang in the air. What does Menahem do?" },
        options: [
          {
            id: "a",
            text: { ko: "속으로 그 사람을 위해 기도한다.", en: "Silently pray for the man." }
          },
          {
            id: "b",
            // Job's friends said it too, and God rebuked them (Job 42:7).
            text: { ko: "“그러게. 다 이유가 있겠지.”", en: "“Right. There's always a reason.”" },
            scold: {
              speaker: "hanan",
              text: { ko: "선생님, 그건 좀… 욥의 친구들도 그렇게 말했다가 혼났잖아요.", en: "Teacher, um… Job's friends said the same thing, and God told them off." }
            }
          },
          {
            id: "c",
            text: { ko: "“하난, 서둘러라. 앞자리 다 찬다.”", en: "“Hurry, Hanan. The front row's filling up.”" }
          }
        ]
      },

      // ---------------------------------------------------------------
      // AROUND NOON: THE CROWD, fixed order of SPEC 6.4 (MT_9_1 omitted; optional).
      // ---------------------------------------------------------------
      { id: "crowd", type: "scene", bg: "crowd", caption: { ko: "정오 무렵 · 바닷가", en: "Around noon · By the shore" } },
      { type: "fx", fx: "light", level: "soft" },
      // One screen either way: a small callback to c2.
      { when: { choice: "c2", is: "a" }, type: "line", text: { ko: "므나헴은 맨 앞, 서기관 몇 사람 틈에 선다. 골목에서 기도해 준 그 사람이 침상째 실려 들어온다.", en: "Menahem stands at the very front with a few other scribes. The man he prayed for in the lane is carried in on his bed." } },
      { when: { not: { choice: "c2", is: "a" } }, type: "line", text: { ko: "서두른 보람이 있다. 므나헴은 맨 앞줄, 서기관 몇 사람 틈에 선다. 곧 골목의 그 침상이 들어온다.", en: "Hurrying paid off. Menahem gets the front row, with a few other scribes. Soon the bed from the lane comes through." } },
      { type: "verse", key: "MT_9_2A" },

      // The first words: bright light, the world goes quiet, the morning's psalm comes back.
      { id: "first-words", type: "fx", fx: "light", level: "bright" },
      { type: "fx", fx: "hush" },
      { type: "verse", key: "MT_9_2B" },
      {
        type: "fx",
        fx: "echoVerse",
        key: "PS_103_3",
        highlight: { flag: "dawn", map: { lord: { ko: ["그가", "사하시며"], en: ["who forgives"] } } }
      },
      { type: "line", speaker: "thought", text: { ko: "병 고치는 걸 보러 왔는데… 죄를 사한다고? 그건 주님이 하시는 일이다.", en: "I came to see a healing. He's forgiving sins? That's the Lord's work." } },
      { type: "fx", fx: "light", level: "soft" },

      // Matt 9:3 as Menahem's own unspoken thought; it stays pinned until the read receipt at 9:4.
      { id: "thought-9-3", type: "verse", key: "MT_9_3Q", speaker: "scribes" },
      { type: "fx", fx: "pinThought", items: ["verse:MT_9_3Q"] },
      {
        type: "choice",
        id: "c3",
        prompt: { ko: "므나헴은 아직 한마디도 입 밖에 내지 않았다. 이제 어떻게 할까?", en: "Menahem hasn't said a word out loud. Now what?" },
        options: [
          {
            id: "a",
            bad: "guardhouse",
            text: { ko: "“신성모독이다!” 외치며 앞으로 나간다.", en: "Shout “Blasphemy!” and push forward." }
          },
          {
            id: "b",
            text: { ko: "기록장에 ‘신성모독’이라고 크게 쓴다.", en: "Write ‘BLASPHEMY’ in his notes, in huge letters." },
            scold: {
              speaker: "hanan",
              text: { ko: "선생님, 그건 좀… 그렇게 크게 쓰시면 소리치시는 거랑 똑같아요.", en: "Teacher, um… writing it that big is basically shouting." }
            }
          },
          {
            id: "c",
            // A sincere reason, not a quit button: staying would feel like taking part in blasphemy.
            bad: "leftEarly",
            text: { ko: "신성모독은 못 들어 준다. 자리를 뜬다.", en: "I won't stand for blasphemy. Walk out." }
          },
          {
            id: "d",
            text: { ko: "속으로 삼킨다. 끝까지 지켜본다.", en: "Keep it inside. Watch to the end." }
          }
        ]
      },

      // Matt 9:4: the thought no one heard is answered. Read receipt on the pinned bubble.
      { id: "read-receipt", type: "fx", fx: "readReceipt" },
      { type: "verse", key: "MT_9_4N" },
      { type: "verse", key: "MT_9_4Q" },
      { type: "fx", fx: "unpinThought" },
      { type: "verse", key: "MT_9_5" },
      {
        type: "choice",
        id: "c4",
        prompt: { ko: "어느 쪽이 쉬울까?", en: "Which is easier?" },
        options: [
          {
            id: "a",
            text: { ko: "죄 사함이지. 아무도 확인 못 하니까.", en: "Forgiveness. Nobody can check that." },
            reaction: [
              { type: "line", speaker: "thought", text: { ko: "확인 못 하는 말은 누구나 할 수 있지.", en: "Anyone can say something nobody can check." } }
            ]
          },
          {
            id: "b",
            bad: "rebuttal",
            text: { ko: "당장 집에 가서 반박문을 쓴다.", en: "Rush home and write a rebuttal." }
          },
          {
            id: "c",
            text: { ko: "말로는 둘 다 쉽다. 증명이 어렵지.", en: "Both are easy to say. Proving it is hard." },
            reaction: [
              { type: "line", speaker: "thought", text: { ko: "그럼 증명해 봐라.", en: "Then prove it." } }
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
      {
        type: "choice",
        id: "c5",
        prompt: { ko: "모두가 하나님께 영광을 돌린다. 그 사이에서 므나헴은?", en: "Everyone around him is giving glory to God. What does Menahem do?" },
        options: [
          {
            id: "a",
            text: { ko: "침상을 들고 가는 그 사람을 본다.", en: "Watch the man carry his bed away." }
          },
          {
            id: "b",
            text: { ko: "예수라는 사람을 다시 본다. 누구지?", en: "Look at this Jesus again. Who is he?" }
          },
          {
            id: "c",
            text: { ko: "소리 없이 하나님께 영광을 돌린다.", en: "Give glory to God, without a sound." }
          },
          {
            id: "d",
            text: { ko: "못 본 걸로 한다.", en: "Pretend it never happened." },
            scold: {
              speaker: "hanan",
              text: { ko: "선생님, 그건 좀… 저 사람 지금 침상 들고 바로 앞을 지나가는데요.", en: "Teacher, um… he's walking right past us. With his bed." }
            }
          }
        ]
      }
    ],

    endings: {
      // The one true ending: title card -> memory verse (engine) -> beats -> last.
      good: {
        title: { ko: "남은 질문 하나", en: "One Question Left" },
        verse: "MT_9_6A",
        beats: [
          // The light leaves with the moment, after the memory verse card.
          { type: "fx", fx: "light", level: "off" },
          // One screen, varied by where his eyes went at c5. "He" here is always Jesus.
          { when: { choice: "c5", is: "a" }, type: "line", speaker: "thought", text: { ko: "그 권능으로 아무도 벌하지 않았다. 그저 한 사람을 집으로 돌려보냈다.", en: "He didn't use that authority to punish anyone. He just sent a man home." } },
          { when: { choice: "c5", is: "b" }, type: "line", speaker: "thought", text: { ko: "죄를 사하는 건 하나님의 일이다. 그런데 그 일을 저 사람이 했다.", en: "Forgiving sins is God's work. And that man just did it." } },
          { when: { choice: "c5", is: "c" }, type: "line", text: { ko: "무리 속에서 므나헴의 입술도 소리 없이 움직인다. 하나님께 영광을.", en: "In the crowd, Menahem's lips move too, without a sound. Glory to God." } }
        ],
        last: { ko: "하나님에 대해서는 네가 옳았다. 남은 질문은 하나다. 저 사람은 누구인가.", en: "You were right about God. That leaves one question: who is this man?" }
      },

      // Cut branches: the story stops here (snip card, Try again). The event itself never changes.
      bad: {
        // c1 b: the scroll eats the whole day.
        typo: {
          title: { ko: "오타 사냥", en: "Typo Hunt" },
          beats: [
            { type: "line", text: { ko: "므나헴은 시편을 처음부터 한 글자씩 짚어 나간다. 하난은 자꾸 문 쪽을 본다.", en: "Menahem goes through the Psalms letter by letter, from the very start. Hanan keeps glancing at the door." } },
            { type: "line", text: { ko: "해가 높이 떴다. 바닷가 쪽에서 큰 함성이 들린다. 므나헴은 고개도 들지 않는다.", en: "The sun is high now. A huge shout rises from the shore. Menahem doesn't even look up." } },
            { type: "line", speaker: "hanan", text: { ko: "선생님! 걷지 못하던 사람이 자기 침상을 들고 걸어서 집에 갔대요!", en: "Teacher! They say a man who couldn't walk just carried his own bed home!" } }
          ],
          last: { ko: "그날 므나헴은 ‘고치시며’라는 단어를 백 번은 확인했다. 정작 병이 나은 건 바닷가에서였다.", en: "That day, Menahem checked the word ‘heals’ a hundred times. The actual healing happened down at the shore." }
        },

        // c3 a: he shouts; a Roman soldier keeps the peace (the centurion of Matt 8:5-13 lives here).
        guardhouse: {
          title: { ko: "경비대 하룻밤", en: "A Night in the Guardhouse" },
          beats: [
            { type: "fx", fx: "unpinThought" },
            { type: "line", text: { ko: "무리가 웅성거린다. 로마 군인 하나가 므나헴 앞을 막아선다. “어르신, 소란은 곤란합니다. 따라오시죠.”", en: "The crowd stirs. A Roman soldier steps in front of Menahem. “Sir, no disturbances. Come with me.”" } },
            { type: "fx", fx: "light", level: "off" },
            { type: "scene", bg: "black", caption: { ko: "밤 · 로마 경비대", en: "Night · The Roman guardhouse" } },
            { type: "line", text: { ko: "므나헴은 밤새 레위기를 처음부터 설명한다. 군인은 하품을 참다가, 결국 포기한다.", en: "All night, Menahem explains Leviticus from the very beginning. The soldier fights a yawn, then gives up." } },
            { type: "line", text: { ko: "새벽녘, 군인이 하품하며 말한다. “어제 그 침상 사람, 걸어서 집에 갔대요. 우리 백부장님은 놀라지도 않으시던데요.”", en: "Near dawn, the soldier yawns and says, “The man on the bed yesterday? Walked home, I heard. My centurion wasn't even surprised.”" } }
          ],
          // Matt 8:5-13: the centurion trusted that one word from Jesus was enough to heal his servant.
          last: { ko: "그 백부장은 자기 하인 일로 벌써 알고 있었다. 예수라는 그 사람은 말 한마디면 된다는 걸.", en: "That centurion already knew, from what happened to his own servant: one word from this Jesus is enough." }
        },

        // c3 c: he leaves after the first words and sees only the result.
        leftEarly: {
          title: { ko: "중간 퇴장", en: "Walked Out Early" },
          beats: [
            { type: "fx", fx: "unpinThought" },
            { type: "fx", fx: "light", level: "off" },
            { type: "scene", bg: "lane", caption: { ko: "정오 무렵 · 골목", en: "Around noon · The lane" } },
            { type: "line", text: { ko: "므나헴은 혼자 골목을 올라간다. 얼마 뒤, 바닷가에서 함성이 터진다.", en: "Menahem walks back up the lane alone. A little later, a shout goes up from the shore." } },
            { type: "line", text: { ko: "곧 누군가 침상을 들고 골목을 올라온다. 므나헴은 아침처럼 벽 쪽으로 비켜선다.", en: "Soon someone comes up the lane carrying a bed. Menahem steps back against the wall, just like this morning." } },
            { type: "line", text: { ko: "아침에 그 침상에 누워 있던 사람이다. 이번엔 자기가 침상을 들고 간다.", en: "It's the man who was lying on that bed this morning. This time, he's the one carrying it." } }
          ],
          last: { ko: "므나헴은 하루에 두 번, 같은 침상에 길을 비켜 주었다. 그 사이에 무슨 일이 있었는지는 하난이 밤새 들려줬다. 아주 자세히.", en: "Menahem stepped aside for the same bed twice in one day. Hanan spent all night telling him what happened in between. In great detail." }
        },

        // c4 b: he leaves before the answer (9:6) to write. Exactly two beats: this path is at the 20-screen cap.
        rebuttal: {
          title: { ko: "반박문 마흔 장", en: "Forty Pages" },
          beats: [
            { type: "fx", fx: "light", level: "off" },
            { type: "scene", bg: "lamp_night", caption: { ko: "밤 · 므나헴의 방", en: "Night · Menahem's room" } },
            { type: "line", text: { ko: "므나헴은 밤새 반박문을 쓴다. 열 장, 스무 장, 마흔 장.", en: "Menahem writes all night. Ten pages. Twenty. Forty." } },
            { type: "line", speaker: "hanan", text: { ko: "선생님, 침상에 누워 있던 그 사람이요, 일어나서 침상 들고 집에 갔어요!", en: "Teacher, the man on the bed—he got up, picked up his bed, and walked home!" } }
          ],
          last: { ko: "반박문은 마흔 장이나 됐다. 그 사람이 어떻게 일어났는지는 한 줄도 없었다.", en: "The rebuttal ran forty pages. Not one line on how the man on the bed got up." }
        }
      }
    }
  };
})();
