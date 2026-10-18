/*
 * Friend route (short, SPEC v3): "A Corner of the Bed" (Yonah). Owner: friend writer.
 * Schema: docs/SPEC.md section 4.5 as amended by docs/SPEC-v3-short.md.
 *
 * Shape: four choices c1-c4 (c4 counts double). No flags.
 * - c1 (Asher's house): Yonah's answer to "What did I do wrong?"
 * - c2 (THE LANE, SPEC 6.3): option d is the cut option (cut: true, lens: null). After its one
 *   reaction beat the engine skips the rest of the route and plays endings.cut.
 * - c3 (right after MT_9_2B) and c4 (right after MT_9_8) sit inside the fixed crowd sequence.
 *
 * Narration refers to Yonah in the third person. Second person appears only in the "hands"
 * caption at Matthew 9:2, ending narration and last lines, as in scenario-v2.
 * Jesus speaks only through verse beats; the scribes' thought (9:3) is never shown here.
 */
(function () {
  var BHS = (window.BHS = window.BHS || {});
  BHS.routes = BHS.routes || {};

  BHS.routes.friend = {
    id: "friend",

    beats: [
      // ===== Dawn: the shore =====
      { type: "scene", bg: "shore_dawn", caption: { ko: "새벽 · 바닷가", en: "Dawn · The shore" } },
      {
        type: "line",
        id: "shore-rumor",
        speaker: "partners",
        text: {
          ko: "요나! 그분이 배로 돌아오신대! 폭풍도 말 한마디로 잠잠하게 하셨대!",
          en: "Yonah! Jesus is coming back by boat! They say he stilled a storm with one word!"
        }
      },

      // ===== Morning: Asher's house =====
      { type: "scene", bg: "asher_home", caption: { ko: "아침 · 아셀의 집", en: "Morning · Asher's house" } },
      {
        type: "line",
        id: "home-arrive",
        text: {
          ko: "요나가 네 해째 누워 지내는 친구 아셀의 집에 뛰어든다. “아셀! 그분이 배로 돌아오신대. 같이 가자!”",
          en: "Yonah bursts into the house of Asher, his childhood friend, bedridden four years now. “Asher! Jesus is coming back by boat. Come with me!”"
        }
      },
      {
        type: "choice",
        id: "c1",
        prompt: {
          ko: "아셀이 천장을 보며 묻는다. “내가 뭘 잘못해서 이렇게 된 걸까?”",
          en: "Asher stares at the ceiling. “What did I do wrong to end up like this?”"
        },
        options: [
          {
            id: "a",
            text: { ko: "“너 잘못 아니야.”", en: "“It's not your fault.”" },
            lens: 1,
            reaction: [{ type: "line", speaker: "asher", text: { ko: "네가 그걸 어떻게 알아?", en: "How would you know?" } }]
          },
          {
            id: "b",
            text: {
              ko: "“왜 아픈지 나한테 설명 안 해도 돼. 그래도 도울 거야.”",
              en: "“You don't have to explain why you're hurting. I'm helping anyway.”"
            },
            lens: 3,
            reaction: [
              { type: "line", speaker: "asher", text: { ko: "…다들 이유부터 궁금해하던데.", en: "…Everyone else wants the reason first." } }
            ]
          },
          {
            id: "c",
            text: { ko: "“사람들이 너한테 그런 말을 했어?”", en: "“Did people say that to you?”" },
            lens: 2,
            reaction: [
              { type: "line", speaker: "asher", text: { ko: "대놓고는 안 해. 눈으로 하지.", en: "Not out loud. They say it with their eyes." } }
            ]
          },
          {
            id: "d",
            text: { ko: "“왜 이렇게 됐는지는 나도 몰라.”", en: "“I don't know why this happened either.”" },
            lens: 2,
            reaction: [{ type: "line", speaker: "asher", text: { ko: "그래. 아무도 모르지.", en: "Yeah. Nobody does." } }]
          }
        ]
      },
      {
        type: "line",
        id: "home-consent",
        speaker: "asher",
        text: { ko: "…좋아. 가 보자. 대신 떨어뜨리지 마.", en: "…Fine. Let's go. Just don't drop me." }
      },

      // ===== Late morning: THE LANE (SPEC 6.3) =====
      { type: "scene", bg: "lane", caption: { ko: "늦은 아침 · 골목", en: "Late morning · The lane" } },
      {
        type: "line",
        id: "lane-carry",
        text: {
          ko: "요나와 그물 동료들이 침상을 들고 골목을 내려간다. 골목 끝, 배 한 척이 뭍에 닿는다.",
          en: "Yonah and his net partners carry the bed down the lane. At the bottom, a boat is coming ashore."
        }
      },
      { type: "verse", id: "lane-9-1", key: "MT_9_1" },
      {
        type: "line",
        id: "lane-passerby",
        speaker: "passerby",
        text: {
          ko: "고통 뒤에 무슨 사연이 있는지 누가 알겠어. 저 사람은 무슨 잘못을 했기에 저렇게 됐을까.",
          en: "Who knows what's behind suffering like that. What did he do to end up like that?"
        }
      },
      {
        type: "line",
        id: "lane-menahem",
        text: {
          ko: "회당에서 보던 서기관 므나헴이 젊은 제자와 함께 길을 비켜선다. 잠깐, 그와 아셀의 눈이 마주친다.",
          en: "Menahem, the scribe from the synagogue, steps aside with a young student. For a moment, his eyes meet Asher's."
        }
      },
      {
        type: "choice",
        id: "c2",
        prompt: { ko: "행인의 말이 침상 위에 떨어진다. 요나는 어떻게 할까?", en: "The passerby's words land on the bed. What does Yonah do?" },
        options: [
          {
            id: "a",
            text: {
              ko: "“우리는 그분께 가는 길이에요. 폭풍도 잠재우신 분이요.”",
              en: "“We're on our way to Jesus. The one who calmed the storm.”"
            },
            lens: 1,
            reaction: [
              { type: "line", speaker: "asher", text: { ko: "이제 나를 폭풍이랑 비교하는 거야?", en: "So now I'm being compared to a storm?" } }
            ]
          },
          {
            id: "b",
            text: { ko: "아셀에게 속삭인다. “신경 쓰지 마. 끝까지 간다.”", en: "Whisper to Asher, “Don't listen. We're going all the way.”" },
            lens: 2,
            reaction: [
              { type: "line", speaker: "asher", text: { ko: "알았어. 근데 네 손이 떨려.", en: "Okay. But your hands are shaking." } }
            ]
          },
          {
            id: "c",
            text: { ko: "“그걸 어떻게 아세요?” 행인 앞을 막아선다.", en: "“How would you know that?” Block the passerby's way." },
            lens: 3,
            reaction: [
              { type: "line", speaker: "asher", text: { ko: "고마워. 근데 침상은 똑바로 들어.", en: "Thanks. But keep the bed level." } }
            ]
          },
          {
            // Cut option (SPEC v3 section 3): the route ends after this reaction; endings.cut follows.
            id: "d",
            // A real motive from the lane (the stares, the remark), not a quit button.
            text: { ko: "침상을 내려놓는다. “…다들 쳐다보잖아. 오늘은 안 되겠어.”", en: "Set the bed down. “…Everyone's staring. I can't do this today.”" },
            lens: null,
            cut: true,
            reaction: [
              {
                type: "line",
                id: "cut-let-go",
                text: {
                  ko: "요나가 귀퉁이를 놓는다. 동료들이 말없이 침상을 다시 들고 내려간다.",
                  en: "Yonah lets go of his corner. Without a word, his partners lift the bed again and carry it on down."
                }
              }
            ]
          }
        ]
      },

      // ===== Around noon: THE CROWD (SPEC 6.4, full sequence) =====
      { type: "scene", bg: "crowd", caption: { ko: "정오 무렵 · 바닷가 공터", en: "Around noon · Open ground by the shore" } },
      { type: "fx", fx: "light", level: "soft" },
      {
        type: "line",
        id: "crowd-bed-down",
        text: {
          ko: "마침내 침상이 그분 앞에 내려진다. 귀퉁이를 잡은 손들은 그물에 트고 굳은살이 박였다.",
          en: "At last, the bed is set down in front of Jesus. The hands on its corners are chapped from nets, thick with calluses."
        }
      },
      { type: "verse", id: "crowd-9-2a", key: "MT_9_2A" },
      { type: "line", id: "hands-yours", speaker: "sign", text: { ko: "그 손들 가운데 네 손이 있다.", en: "Your hands are among them." } },
      { type: "fx", fx: "light", level: "bright" },
      { type: "verse", id: "crowd-9-2b", key: "MT_9_2B" },
      { type: "fx", fx: "light", level: "soft" },
      {
        type: "choice",
        id: "c3",
        prompt: {
          ko: "기다리던 말이 아니다. 요나의 머릿속에 먼저 떠오른 것은?",
          en: "Not the words he was waiting for. What's the first thing in Yonah's mind?"
        },
        options: [
          {
            id: "a",
            text: { ko: "저 말은 하나님만 하실 수 있는 말인데.", en: "But only God can say that…" },
            lens: 1,
            reaction: [
              {
                type: "line",
                speaker: "thought",
                text: {
                  ko: "그 정도는 나도 안다. 죄 사함은 하나님께 구하는 거다.",
                  en: "Even I know that much. Forgiveness of sins is something you ask of God."
                }
              }
            ]
          },
          {
            id: "b",
            text: { ko: "왜 그 말부터 하셨지?", en: "Why did he say that first?" },
            lens: 2,
            reaction: [
              {
                type: "line",
                speaker: "thought",
                // Points at fear (what "take heart" answers), never at his question about a cause (SPEC 7.2).
                text: {
                  ko: "아침에 아셀을 짓누르던 것도 다리가 아니었다. 두려움이었다.",
                  en: "What weighed on Asher this morning wasn't his legs either. It was fear."
                }
              }
            ]
          },
          {
            id: "c",
            text: { ko: "아셀의 얼굴을 본다.", en: "Look at Asher's face." },
            lens: 2,
            reaction: [
              {
                type: "line",
                text: {
                  ko: "아셀의 얼굴에서, 아침 내내 굳어 있던 무언가가 풀린다.",
                  en: "In Asher's face, something that was clenched all morning comes loose."
                }
              }
            ]
          },
          {
            id: "d",
            text: { ko: "하지만 우리는 걷게 해 달라고 왔는데.", en: "But we came so he could walk." },
            lens: 3,
            reaction: [
              {
                type: "line",
                speaker: "thought",
                text: { ko: "아셀은 아직 누워 있다. 그런데 아무도 자리를 뜨지 않는다.", en: "Asher is still lying there. But no one is leaving." }
              }
            ]
          }
        ]
      },
      {
        type: "line",
        id: "scribes-stiff",
        text: {
          ko: "맨 앞에 선 서기관 몇이 말없이 굳는다. 골목에서 본 그 서기관도 있다.",
          en: "At the very front, a few scribes go silent and stiff. The scribe from the lane is one of them."
        }
      },
      { type: "verse", id: "crowd-9-4n", key: "MT_9_4N" },
      { type: "verse", id: "crowd-9-4q", key: "MT_9_4Q" },
      {
        type: "line",
        id: "no-one-spoke",
        speaker: "thought",
        text: { ko: "누구한테 하시는 말씀이지? 저 사람들은 아무 말도 안 했는데.", en: "Who's he talking to? Those men didn't say a word." }
      },
      { type: "verse", id: "crowd-9-5", key: "MT_9_5" },
      { type: "verse", id: "crowd-9-6a", key: "MT_9_6A" },
      { type: "verse", id: "crowd-9-6n", key: "MT_9_6N" },
      { type: "fx", fx: "light", level: "bright" },
      { type: "verse", id: "crowd-9-6b", key: "MT_9_6B" },
      { type: "fx", fx: "light", level: "soft" },
      { type: "verse", id: "crowd-9-7", key: "MT_9_7" },
      { type: "verse", id: "crowd-9-8", key: "MT_9_8" },
      {
        type: "choice",
        id: "c4",
        prompt: { ko: "아는 얼굴들이 요나에게 몰려든다. “대체 무슨 일이야?”", en: "Familiar faces crowd around Yonah. “What on earth just happened?”" },
        options: [
          {
            id: "a",
            text: {
              ko: "“그분이 죄를 사할 권능이 있다고 하셨어. 그게 무슨 뜻일까.”",
              en: "“He said he has authority to forgive sins. What could that mean?”"
            },
            lens: 1
          },
          {
            id: "b",
            text: {
              ko: "“먼저 죄 사함을 말씀하셨어. 일어나라는 건 그다음이었어.”",
              en: "“He talked about forgiveness of sins first. Getting up came after.”"
            },
            lens: 2
          },
          {
            id: "c",
            text: {
              ko: "“못 걷던 애가 걷잖아! 우리가 데려갔다고!”",
              en: "“He couldn't walk—now look at him! And we brought him!”"
            },
            lens: 3
          },
          {
            id: "d",
            text: {
              ko: "“본인한테 물어봐. 그 자리에 누워 있던 사람이잖아.”",
              en: "“Ask him. He's the one who was lying there.”"
            },
            lens: 3
          }
        ]
      },
      // The moment is over; the light of his presence fades before the ending (SPEC 4.5).
      { type: "fx", fx: "light", level: "off" }
    ],

    // Titles come from data/meta.js (BHS.meta.endings.friend, including "cut").
    // Ending 2's beat states that Jesus gave no reason for the illness (SPEC 7.2); its last line
    // echoes the ending title and the game title ("before he stood").
    endings: {
      "1": {
        beats: [
          {
            type: "line",
            id: "e1-default",
            when: { not: { choice: "c1", is: "a" } },
            text: {
              ko: "요나는 한 번도 물어본 적이 없었다. 누가 죄를 사할 수 있는지. 오늘 전까지는.",
              en: "Yonah had never once asked who can forgive sins. Not until today."
            }
          },
          {
            type: "line",
            id: "e1-callback-c1a",
            when: { choice: "c1", is: "a" },
            text: {
              ko: "아침에 아셀이 물었다. “네가 그걸 어떻게 알아?” 오늘 그분은 이유를 따지지 않으셨다. 하나님만 하실 수 있는 말을 하셨다.",
              en: "This morning Asher asked, “How would you know?” Today Jesus didn't weigh reasons. He said what only God can say."
            }
          }
        ],
        last: {
          ko: "우리는 걷게 해 달라고 했다. 그분은 그보다 깊은 데서 시작하셨다.",
          en: "We asked for him to walk. He began somewhere deeper."
        }
      },

      "2": {
        beats: [
          {
            type: "line",
            id: "e2-first-words",
            text: {
              ko: "그분은 아셀이 왜 아팠는지 한마디도 하지 않으셨다. 다리 이야기보다 먼저, 아셀에게 말을 거셨다.",
              en: "Jesus never said a word about why Asher had been sick. Before anything about his legs, he spoke to Asher himself."
            }
          }
        ],
        last: {
          ko: "다들 아셀이 걸은 것을 기억한다. 나는 그가 일어나기 전의 첫마디도 기억한다.",
          en: "Everyone remembers that Asher walked. I remember the first words too, the ones before he stood."
        }
      },

      "3": {
        beats: [
          {
            type: "line",
            id: "e3-beside",
            text: {
              ko: "요나는 처음으로 빈손으로 아셀 옆을 걷는다. 어릴 적처럼, 나란히.",
              en: "For the first time, Yonah walks beside Asher with empty hands. Side by side, like when they were boys."
            }
          }
        ],
        last: {
          ko: "너는 그를 여기까지 들고 왔다. 집까지는 그가 침상을 들고 갔다.",
          en: "You carried him this far. The rest of the way home, he carried the bed."
        }
      },

      // Cut ending (c2 d). The event itself is unchanged: the others carry Asher on, and he
      // comes back up the lane on his own feet.
      cut: {
        beats: [
          {
            type: "line",
            id: "cut-alone",
            text: {
              ko: "요나는 골목에 그대로 서 있다. 침상이 무리 속으로 사라진다.",
              en: "Yonah stays where he is in the lane. The bed disappears into the crowd."
            }
          },
          // The event happens without him. This path never reached the crowd, so the verse the
          // last line turns on ("their faith") is shown here; it breaks off before the words to Asher.
          { type: "verse", id: "cut-9-2a", key: "MT_9_2A" },
          {
            type: "line",
            id: "cut-walks-up",
            text: {
              ko: "함성이 잦아들고 한참 뒤, 누군가 골목을 걸어 올라온다. 자기 침상을 든 아셀이다.",
              en: "Long after the shout from below dies down, someone comes walking up the lane. It's Asher, carrying his own bed."
            }
          },
          {
            // Asher's own words carry the forgiveness this path never heard (Jesus still forgives and heals).
            type: "line",
            id: "cut-smile",
            text: {
              ko: "아셀이 요나를 지나며 웃는다. “그분이 나한테 먼저 하신 말이 있어. 나중에 들려줄게.”",
              en: "As he passes Yonah, Asher smiles. “He said something to me first. I'll tell you later.”"
            }
          }
        ],
        // Lands on the others' hands and on grace, not a verdict on the player; echoes the route title.
        last: {
          ko: "네가 놓은 귀퉁이는 다른 손들이 들었다. 그분이 보신 믿음은 그 손들에 있었다.",
          en: "Other hands took the corner you let go. The faith he saw was in those hands."
        }
      }
    }
  };
})();
