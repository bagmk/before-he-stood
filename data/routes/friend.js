/*
 * Friend route: "A Corner of the Bed" (Yonah). Owner: friend writer.
 * Schema: docs/SPEC.md section 4.5. Story: docs/scenario-v2.md (friend route).
 *
 * Flags set in this route:
 * - item: "rope" | "cloak" | "water" | "food"  (c5; each item pays off later via `when`)
 * - far: true                                  (c6 option d; Yonah follows behind from then on)
 *
 * Narration refers to Yonah in the third person. Second person (Korean informal
 * "you" / English "you") appears only in the two "hands" captions at Matthew 9:2,
 * the ending preface, ending narration and last lines, as in scenario-v2.
 * Jesus speaks only through verse beats; the scribes' thought (9:3) is never shown here.
 */
(function () {
  var BHS = (window.BHS = window.BHS || {});
  BHS.routes = BHS.routes || {};

  // Shorthand conditions used by several beats.
  var FAR = { flag: "far", is: true };
  var NEAR = { not: { flag: "far", is: true } };

  BHS.routes.friend = {
    id: "friend",

    beats: [
      // ===== Dawn: the shore =====
      { type: "scene", bg: "shore_dawn", caption: { ko: "새벽 · 바닷가", en: "Dawn · The shore" } },
      {
        type: "line",
        text: {
          ko: "요나는 밤새 젖은 그물을 손질한다. 손끝이 차다.",
          en: "Yonah is mending a net still wet from the night. His fingertips are cold."
        }
      },
      {
        type: "line",
        speaker: "partners",
        text: {
          ko: "요나! 건너편에서 온 배가 그러는데, 그분이 돌아오신대! 폭풍도 말 한마디로 잠잠하게 하셨대!",
          en: "Yonah! Men on a boat from across the lake say Jesus is coming back! They say he stilled a storm with one word!"
        }
      },
      {
        type: "line",
        speaker: "thought",
        text: {
          ko: "어릴 적엔 아셀과 이 모래밭을 달리곤 했다. 늘 아셀이 이겼다.",
          en: "When we were boys, Asher and I used to race on this sand. He always won."
        }
      },
      {
        type: "line",
        speaker: "thought",
        text: {
          ko: "그 아셀이 걷지 못한 지, 네 해째다.",
          en: "And now Asher hasn't walked in four years."
        }
      },
      {
        type: "choice",
        id: "c1",
        prompt: { ko: "그물을 잡은 손이 멈춘다. 가장 먼저 떠오른 것은?", en: "Yonah's hands stop on the net. What comes to him first?" },
        options: [
          {
            id: "a",
            text: { ko: "“폭풍을 말로? 그런 분이라면.”", en: "“A storm, with a word? If he's someone like that…”" },
            lens: 1,
            reaction: [
              {
                type: "line",
                speaker: "thought",
                text: {
                  ko: "바다가 그 말을 들었다면… 아셀의 다리도.",
                  en: "If the sea listened to him… then maybe Asher's legs will too."
                }
              }
            ]
          },
          {
            id: "b",
            text: { ko: "“아셀!” 그물을 내려놓는다.", en: "“Asher!” Drop the net." },
            lens: 3,
            reaction: [
              {
                type: "line",
                text: {
                  ko: "그물이 모래 위에 털썩 놓인다. 요나는 벌써 달리고 있다.",
                  en: "The net lands in a heap on the sand. Yonah is already running."
                }
              }
            ]
          },
          {
            id: "c",
            text: {
              ko: "“가서 아무것도 안 바뀌면, 아셀이 또 무너질 텐데.”",
              en: "“If we go and nothing changes, Asher will fall apart again.”"
            },
            lens: 2,
            reaction: [
              {
                type: "line",
                speaker: "thought",
                text: {
                  ko: "지난번 의원이 다녀간 뒤로, 아셀은 한 달 내내 웃지 않았다.",
                  en: "After the last healer came and went, Asher didn't laugh for a whole month."
                }
              },
              {
                type: "line",
                text: { ko: "그래도 요나는 그물을 내려놓는다.", en: "Still, Yonah sets down the net." }
              }
            ]
          },
          {
            id: "d",
            text: {
              ko: "“오늘 하루 품삯은 한 데나리온인데({{r:MT_20_2}}).”",
              en: "“But today's wage is a whole denarius ({{r:MT_20_2}}).”"
            },
            lens: 3,
            reaction: [
              {
                type: "line",
                text: {
                  ko: "정직한 계산이다. 그래도 발은 아셀의 집 쪽으로 향한다.",
                  en: "An honest calculation. Still, his feet turn toward Asher's house."
                }
              }
            ]
          }
        ]
      },

      // ===== Morning: Asher's house =====
      { type: "scene", bg: "asher_home", caption: { ko: "아침 · 아셀의 집", en: "Morning · Asher's house" } },
      {
        type: "line",
        text: {
          ko: "요나가 숨을 몰아쉬며 문을 들어선다. 아셀은 침상에 누워 있고, 동생은 문 앞에서 논다.",
          en: "Yonah comes through the door, out of breath. Asher lies on his bed; his little brother plays by the doorway."
        }
      },
      {
        type: "line",
        speaker: "asher",
        text: { ko: "아침부터 숨이 넘어가네. 누가 쫓아와?", en: "Out of breath this early? Who's chasing you?" }
      },
      {
        type: "line",
        speaker: "yonah",
        text: { ko: "그분이 돌아오신대. 같이 가자!", en: "Jesus is coming back. Come with me!" }
      },
      {
        type: "choice",
        id: "c2",
        prompt: {
          ko: "아셀의 웃음기가 사라진다. “갔는데 아무것도 안 달라지면?”",
          en: "The smile leaves Asher's face. “What if we go and nothing changes?”"
        },
        options: [
          {
            id: "a",
            text: { ko: "“결과는 약속 못 해. 같이 갈 수는 있어.”", en: "“I can't promise how it ends. But I can go with you.”" },
            lens: 3,
            reaction: [
              {
                type: "line",
                speaker: "asher",
                text: {
                  ko: "…다들 약속부터 하더라. 네 말이 제일 정직하다.",
                  en: "…Everyone else started with promises. That's the most honest thing anyone's said."
                }
              }
            ]
          },
          {
            id: "b",
            text: { ko: "“무엇 때문에 망설이는지 말해 줘.”", en: "“Tell me what's holding you back.”" },
            lens: 2,
            reaction: [
              {
                type: "line",
                speaker: "asher",
                text: {
                  ko: "사람들 눈. 그리고… 또 아무 일도 없을까 봐.",
                  en: "People's eyes. And… that nothing will happen. Again."
                }
              }
            ]
          },
          {
            id: "c",
            text: { ko: "“그분이라면 할 수 있어. 폭풍도 잠재웠대.”", en: "“He can do it. They say he calmed a storm.”" },
            lens: 1,
            reaction: [
              {
                type: "line",
                speaker: "asher",
                text: { ko: "바다는 말을 들었겠지. 내 다리는 고집이 세.", en: "Maybe the sea listened. My legs are stubborn." }
              }
            ]
          },
          {
            id: "d",
            text: {
              ko: "“싫다고 해도 데려갈 거야. 그분은 꼭 만나 봐야 돼.”",
              en: "“Even if you say no, I'm taking you. You need to meet him.”"
            },
            lens: 1,
            reaction: [
              {
                type: "line",
                speaker: "asher",
                text: { ko: "협박이네. 넌 어릴 때부터 그랬어.", en: "That's a threat. You've been like this since we were kids." }
              }
            ]
          }
        ]
      },
      {
        type: "choice",
        id: "c3",
        prompt: {
          ko: "아셀이 천장을 보며 묻는다. “내가 뭘 잘못해서 이렇게 된 걸까?”",
          en: "Staring at the ceiling, Asher asks, “What did I do wrong to end up like this?”"
        },
        options: [
          {
            id: "a",
            text: { ko: "“너 잘못 아니야.”", en: "“It's not your fault.”" },
            lens: 1,
            reaction: [
              { type: "line", speaker: "asher", text: { ko: "네가 그걸 어떻게 알아?", en: "How would you know?" } },
              { type: "line", text: { ko: "요나는 대답하지 못한다.", en: "Yonah has no answer." } }
            ]
          },
          {
            id: "b",
            text: {
              ko: "“내 도움을 받으려고 네 고통을 해명할 필요는 없어.”",
              en: "“You don't have to explain your pain to get my help.”"
            },
            lens: 3,
            reaction: [
              {
                type: "line",
                speaker: "asher",
                text: { ko: "…다들 이유부터 궁금해하던데.", en: "…Everyone else wants the reason first." }
              }
            ]
          },
          {
            id: "c",
            text: { ko: "“사람들이 너한테 그런 말을 했어?”", en: "“Did people say that to you?”" },
            lens: 2,
            reaction: [
              {
                type: "line",
                speaker: "asher",
                text: { ko: "대놓고는 안 해. 눈으로 하지.", en: "Not out loud. They say it with their eyes." }
              }
            ]
          },
          {
            id: "d",
            text: { ko: "“왜 이렇게 됐는지는 나도 몰라.”", en: "“I don't know why this happened either.”" },
            lens: 1,
            reaction: [
              {
                type: "line",
                speaker: "asher",
                text: { ko: "…그래. 차라리 그게 낫다.", en: "…Yeah. Honestly, that's better." }
              }
            ]
          }
        ]
      },
      {
        type: "line",
        speaker: "asher",
        text: { ko: "…좋아. 가 보자. 대신 떨어뜨리지 마.", en: "…Fine. Let's go. Just don't drop me." }
      },

      // ===== Gathering helpers =====
      {
        type: "choice",
        id: "c4",
        prompt: { ko: "가벼운 침상이라도 혼자서는 못 든다. 어떻게 할까?", en: "Even a light bed is too much for one person. What now?" },
        options: [
          {
            id: "a",
            text: {
              ko: "그물 동료들에게 말한다. “오늘 품삯보다 큰일이 있어. 그분이 오신대.”",
              en: "Tell the partners, “This is bigger than a day's wage. He's coming.”"
            },
            lens: 1,
            reaction: [
              {
                type: "line",
                speaker: "partners",
                text: { ko: "폭풍을 잠재웠다는 그분? …좋아, 가자.", en: "The one who calmed the storm? …All right, let's go." }
              }
            ]
          },
          {
            id: "b",
            text: { ko: "아셀이 덜 부끄럽도록, 그를 아는 얼굴들만 부른다.", en: "Call only faces Asher knows, so he feels less exposed." },
            lens: 2,
            reaction: [
              {
                type: "line",
                speaker: "asher",
                text: { ko: "낯선 손에 들려 가는 것보단 낫네.", en: "Better than being carried off by strangers." }
              }
            ]
          },
          {
            id: "c",
            text: { ko: "동료들에게 하루만 같이 들어 달라고 부탁한다.", en: "Ask the partners to help carry him, just for today." },
            lens: 3,
            reaction: [
              {
                type: "line",
                text: {
                  ko: "아무도 품삯 이야기를 꺼내지 않는다. 다들 그물을 내려놓고 따라나선다.",
                  en: "No one mentions the wage. They all set down their nets and come."
                }
              }
            ]
          },
          {
            id: "d",
            text: { ko: "혼자 아셀을 업어 본다.", en: "Try to carry Asher piggyback, alone." },
            lens: 3,
            reaction: [
              {
                type: "line",
                text: {
                  ko: "세 걸음 만에 주저앉는다. 결국 사람들이 모여든다.",
                  en: "Three steps in, Yonah's knees buckle. In the end, people gather to help."
                }
              },
              { type: "line", speaker: "asher", text: { ko: "…다음엔 처음부터 불러.", en: "…Next time, just call them first." } }
            ]
          }
        ]
      },

      // ===== Packing =====
      {
        type: "choice",
        id: "c5",
        prompt: {
          ko: "침상을 들면 손이 남지 않는다. 딱 하나만 챙길 수 있다.",
          en: "With the bed to carry, there's room for only one thing. What will it be?"
        },
        options: [
          {
            id: "a",
            text: { ko: "침상을 단단히 묶을 끈", en: "A rope to tie the bed securely" },
            lens: null,
            set: { item: "rope" },
            reaction: [
              {
                type: "line",
                text: { ko: "요나가 끈으로 침상 틀을 두 번 감아 묶는다.", en: "Yonah loops the rope twice around the frame and ties it off." }
              },
              {
                type: "line",
                speaker: "asher",
                text: { ko: "이렇게 묶어 두면, 나 도망도 못 가겠네.", en: "Tied down like this, I can't even run away." }
              }
            ]
          },
          {
            id: "b",
            text: { ko: "아셀의 낡은 갈색 겉옷", en: "Asher's worn brown wool cloak" },
            lens: null,
            set: { item: "cloak" },
            reaction: [
              {
                type: "line",
                text: { ko: "요나가 갈색 겉옷을 아셀의 무릎에 덮어 준다.", en: "Yonah spreads the brown cloak over Asher's knees." }
              },
              {
                type: "line",
                speaker: "asher",
                text: { ko: "이거 덮으면, 좀 덜 보여.", en: "Under this, people see a little less of me." }
              }
            ]
          },
          {
            id: "c",
            text: { ko: "물을 가득 채운 물주머니", en: "A waterskin, filled to the top" },
            lens: null,
            set: { item: "water" },
            reaction: [
              {
                type: "line",
                text: { ko: "요나가 물주머니를 채워 허리에 찬다.", en: "Yonah fills the waterskin and ties it at his waist." }
              },
              {
                type: "line",
                speaker: "thought",
                text: { ko: "해가 높아지면 아셀이 목마를 거다.", en: "Once the sun climbs, Asher will get thirsty." }
              }
            ]
          },
          {
            id: "d",
            text: { ko: "빵과 말린 생선 보따리", en: "A bundle of bread and dried fish" },
            lens: null,
            set: { item: "food" },
            reaction: [
              {
                type: "line",
                text: {
                  ko: "요나가 빵과 말린 생선을 보자기에 싸서 허리에 맨다.",
                  en: "Yonah wraps bread and dried fish in a cloth and ties it at his waist."
                }
              },
              {
                type: "line",
                speaker: "asher",
                text: { ko: "놀러 가는 줄 알겠다.", en: "Anyone would think we're going on an outing." }
              }
            ]
          }
        ]
      },
      {
        type: "line",
        text: { ko: "“들자.” 요나의 말에 침상이 땅에서 뜬다.", en: "“Lift,” says Yonah, and the bed leaves the ground." }
      },
      {
        type: "line",
        id: "hands-lift",
        text: {
          ko: "귀퉁이를 잡은 손들. 그물에 튼 손, 굳은살 박인 손. 그 가운데 요나의 손이 있다.",
          en: "Hands on the corners: chapped from nets, thick with calluses. Yonah's are among them."
        }
      },

      // ===== Late morning: THE LANE (SPEC 6.3) =====
      { type: "scene", bg: "lane", caption: { ko: "늦은 아침 · 골목", en: "Late morning · The lane" } },
      {
        type: "line",
        text: {
          ko: "검은 현무암 집들 사이로, 좁은 골목이 바다 쪽으로 기운다. 바닷바람이 분다.",
          en: "Between houses of black basalt, a narrow lane slopes toward the sea. A breeze comes off the water."
        }
      },
      {
        type: "line",
        text: {
          ko: "골목 끝으로 바다가 보인다. 배 한 척이 뭍에 닿고 있다.",
          en: "At the bottom of the lane, the sea opens up. A boat is coming ashore."
        }
      },
      { type: "verse", id: "lane-9-1", key: "MT_9_1" },
      {
        type: "line",
        id: "rope-lane",
        when: { flag: "item", is: "rope" },
        text: {
          ko: "내리막에서 침상이 한쪽으로 기운다. 묶어 둔 끈이 팽팽해지며 버틴다.",
          en: "On the steep part, the bed tips to one side. The rope pulls taut and holds."
        }
      },
      {
        type: "line",
        id: "water-lane",
        when: { flag: "item", is: "water" },
        text: {
          ko: "해가 뜨겁다. 잠깐 쉬는 사이, 요나는 아셀에게 물을 먹이고 물주머니를 그의 발치에 둔다.",
          en: "The sun is hot. During a short rest, Yonah gives Asher a drink and sets the waterskin by his feet."
        }
      },
      {
        type: "line",
        id: "food-lane",
        when: { flag: "item", is: "food" },
        text: { ko: "빵 냄새에 아셀이 보따리를 힐끔거린다.", en: "At the smell of bread, Asher eyes the bundle." }
      },
      {
        type: "line",
        id: "food-lane-promise",
        when: { flag: "item", is: "food" },
        speaker: "yonah",
        text: { ko: "돌아와서 같이 먹자.", en: "We'll eat when we're back." }
      },
      {
        type: "line",
        text: { ko: "사람들이 길을 비켜서며 침상을 쳐다본다.", en: "People step aside and stare at the bed." }
      },
      {
        type: "line",
        id: "cloak-lane",
        when: { flag: "item", is: "cloak" },
        text: {
          ko: "요나가 갈색 겉옷을 아셀의 턱밑까지 끌어올린다. 쏟아지던 눈길이 조금 덜 닿는다.",
          en: "Yonah pulls the brown cloak up to Asher's chin. The stares land a little less."
        }
      },
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
        text: {
          ko: "서기관 므나헴이 젊은 제자와 함께 내려오다 길을 비켜선다. 요나도 얼굴은 아는 사람이다.",
          en: "Menahem the scribe, coming down with a young student, steps aside to let them pass. Yonah knows him by sight."
        }
      },
      {
        type: "line",
        text: {
          ko: "므나헴이 침상을 힐끗 본다. 잠깐, 아셀과 눈이 마주친다.",
          en: "Menahem glances at the bed. For a moment, his eyes meet Asher's."
        }
      },
      {
        type: "choice",
        id: "c6",
        prompt: { ko: "행인의 말이 침상 위에 떨어진다. 요나는 어떻게 할까?", en: "The passerby's words land on the bed. What does Yonah do?" },
        options: [
          {
            id: "a",
            text: {
              ko: "“우리는 그분께 가는 길이에요. 폭풍도 잠재운 분이요.”",
              en: "“We're on our way to Jesus. The one who calmed the storm.”"
            },
            lens: 1,
            reaction: [
              {
                type: "line",
                speaker: "asher",
                text: { ko: "…이제 나를 폭풍이랑 비교하는 거야?", en: "…So now I'm being compared to a storm?" }
              }
            ]
          },
          {
            id: "b",
            text: { ko: "아셀에게 속삭인다. “신경 쓰지 마. 끝까지 간다.”", en: "Whisper to Asher, “Don't listen. We're going all the way.”" },
            lens: 2,
            reaction: [
              {
                type: "line",
                speaker: "asher",
                text: { ko: "…알았어. 근데 네 손이 떨려.", en: "…Okay. But your hands are shaking." }
              }
            ]
          },
          {
            id: "c",
            text: { ko: "“그걸 어떻게 아세요?” 행인 앞을 막아선다.", en: "“How would you know that?” Block the passerby's way." },
            lens: 3,
            reaction: [
              { type: "line", text: { ko: "행인이 눈을 피하고 걸음을 서두른다.", en: "The passerby looks away and hurries off." } },
              {
                type: "line",
                speaker: "asher",
                text: { ko: "…고마워. 근데 침상은 똑바로 들어.", en: "…Thanks. But keep the bed level." }
              }
            ]
          },
          {
            id: "d",
            text: { ko: "침상을 내려놓는다. “…오늘은 안 되겠어.”", en: "Set the bed down. “…I can't do this today.”" },
            lens: null,
            set: { far: true },
            reaction: [
              {
                type: "line",
                text: {
                  ko: "요나의 손이 귀퉁이에서 떨어진다. 동료들이 말없이 침상을 다시 든다.",
                  en: "Yonah's hands come away from the corner. Without a word, the partners lift the bed again."
                }
              },
              {
                type: "line",
                text: { ko: "요나는 몇 걸음 떨어져, 그 뒤를 따라간다.", en: "Yonah follows behind, a few steps back." }
              }
            ]
          }
        ]
      },

      // ===== Around noon: THE CROWD (SPEC 6.4) =====
      { type: "scene", bg: "crowd", caption: { ko: "정오 무렵 · 바닷가 공터", en: "Around noon · Open ground by the shore" } },
      { type: "fx", fx: "light", level: "soft" },
      {
        type: "line",
        text: {
          ko: "바닷가 공터에 무리가 빽빽하다. 그 한가운데에 그분이 계신다.",
          en: "The open ground by the shore is packed with people. Jesus is there, at the center."
        }
      },
      {
        type: "line",
        id: "far-edge",
        when: FAR,
        text: {
          ko: "요나는 무리 가장자리에서 멈춘다. 침상은 동료들의 손에 들려 앞으로 간다.",
          en: "Yonah stops at the edge of the crowd. The bed moves on ahead in his partners' hands."
        }
      },
      {
        type: "choice",
        id: "c7",
        prompt: { ko: "무리가 너무 많다. 그분 앞까지 어떻게 갈까?", en: "The crowd is too thick. How will they get to him?" },
        options: [
          {
            id: "a",
            text: { ko: "“길 좀 비켜 주세요!” 앞으로 나아간다.", en: "“Make way, please!” Push forward." },
            lens: 1,
            reaction: [
              {
                type: "line",
                when: NEAR,
                text: { ko: "사람들이 조금씩 갈라진다. 침상이 그 틈으로 들어간다.", en: "Bit by bit, people part. The bed slips into the gap." }
              },
              {
                type: "line",
                when: FAR,
                text: {
                  ko: "요나가 몇 걸음 나아가다 멈춘다. 그 틈으로 동료들이 침상을 들고 들어간다.",
                  en: "Yonah pushes a few steps forward, then stops. His partners carry the bed into the gap."
                }
              }
            ]
          },
          {
            id: "b",
            text: { ko: "아셀에게 묻는다. “어디서 기다리면 편해?”", en: "Ask Asher, “Where would be easiest for you to wait?”" },
            lens: 2,
            reaction: [
              {
                type: "line",
                when: NEAR,
                speaker: "asher",
                text: {
                  ko: "맨 앞. 어차피 다 쳐다볼 거면, 빨리 끝내자.",
                  en: "Right up front. If they're all going to stare anyway, let's get it over with."
                }
              },
              {
                type: "line",
                when: FAR,
                speaker: "asher",
                text: { ko: "…넌 어디 있을 건데?", en: "…And where will you be?" }
              }
            ]
          },
          {
            id: "c",
            text: { ko: "사람들에게 함께 옮겨 달라고 청한다.", en: "Ask the people nearby to help pass the bed along." },
            lens: 3,
            reaction: [
              {
                type: "line",
                when: NEAR,
                text: {
                  ko: "낯선 손들이 귀퉁이를 함께 잡는다. 침상이 무리 사이로 나아간다.",
                  en: "Strangers' hands join on the corners. The bed moves forward through the crowd."
                }
              },
              {
                type: "line",
                when: FAR,
                text: {
                  ko: "낯선 손들이 귀퉁이를 함께 잡는다. 요나는 그 손들을 뒤에서 본다.",
                  en: "Strangers' hands join on the corners. Yonah watches those hands from behind."
                }
              }
            ]
          },
          {
            id: "d",
            text: { ko: "“지붕을 뚫을까?”", en: "“Should we go in through a roof?”" },
            lens: null,
            reaction: [
              {
                type: "line",
                speaker: "partners",
                text: { ko: "요나, 여긴 공터야. 지붕이 어디 있어.", en: "Yonah, we're out in the open. What roof?" }
              },
              {
                type: "line",
                id: "roof-easter-egg",
                speaker: "sign",
                text: {
                  ko: "지붕을 뚫은 이야기는 마가복음에 나온다({{r:MK_2_4}}). 마태복음에서는 그냥 데려온다.",
                  en: "The roof story is in Mark ({{r:MK_2_4}}). In Matthew, they simply bring him."
                }
              }
            ]
          }
        ]
      },
      {
        type: "line",
        text: { ko: "마침내 침상이 그분 앞에 내려진다.", en: "At last, the bed is set down in front of Jesus." }
      },
      { type: "verse", id: "crowd-9-2a", key: "MT_9_2A" },
      {
        type: "line",
        text: {
          ko: "침상 귀퉁이를 잡았던 손들. 그물에 튼 손, 굳은살 박인 손.",
          en: "The hands that held the corners of the bed: chapped from nets, thick with calluses."
        }
      },
      {
        type: "line",
        id: "hands-near",
        when: NEAR,
        speaker: "sign",
        text: { ko: "그 손들 가운데 네 손이 있다.", en: "Your hands are among them." }
      },
      {
        type: "line",
        id: "hands-far",
        when: FAR,
        speaker: "sign",
        text: { ko: "그 손들 가운데 네 손은 없다.", en: "Your hands are not among them." }
      },
      { type: "fx", fx: "light", level: "bright" },
      { type: "verse", id: "crowd-9-2b", key: "MT_9_2B" },
      { type: "fx", fx: "light", level: "soft" },
      {
        type: "line",
        when: NEAR,
        text: { ko: "요나의 손은 아직 침상 끝을 잡고 있다.", en: "Yonah's hands are still gripping the end of the bed." }
      },
      {
        type: "line",
        when: FAR,
        text: {
          ko: "요나는 가장자리에서, 사람들 어깨 너머로 그 말을 듣는다.",
          en: "From the edge, over people's shoulders, Yonah hears it."
        }
      },
      {
        type: "choice",
        id: "c8",
        prompt: {
          ko: "기다리던 말이 아니다. 요나의 머릿속에 먼저 떠오른 것은?",
          en: "Not the words he was waiting for. What's the first thing in Yonah's mind?"
        },
        options: [
          {
            id: "a",
            text: { ko: "“저 말은 하나님만 하실 수 있는 말인데.”", en: "“Only God can say that.”" },
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
            text: { ko: "“왜 그 말부터 하셨지?”", en: "“Why did he say that first?”" },
            lens: 2,
            reaction: [
              {
                type: "line",
                speaker: "thought",
                text: {
                  ko: "아침에 아셀이 붙들고 있던 질문도, 다리 얘기가 아니었다.",
                  en: "The question Asher was holding onto this morning wasn't about his legs either."
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
                when: NEAR,
                text: {
                  ko: "아셀의 얼굴에서, 아침 내내 굳어 있던 무언가가 풀린다.",
                  en: "In Asher's face, something that was clenched all morning comes loose."
                }
              },
              {
                type: "line",
                when: FAR,
                text: {
                  ko: "어깨들 사이로 아셀의 얼굴이 보인다. 아침 내내 굳어 있던 무언가가 풀린다.",
                  en: "Between shoulders, Yonah catches Asher's face. Something clenched all morning comes loose."
                }
              }
            ]
          },
          {
            id: "d",
            text: { ko: "“하지만 우리는 걷게 해 달라고 왔는데.”", en: "“But we came so he could walk.”" },
            lens: 3,
            reaction: [
              {
                type: "line",
                speaker: "thought",
                text: {
                  ko: "아셀은 아직 누워 있다. 그런데 아무도 자리를 뜨지 않는다.",
                  en: "Asher is still lying there. But no one is leaving."
                }
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
        text: {
          ko: "누구한테 하시는 말씀이지? 저 사람들은 아무 말도 안 했는데.",
          en: "Who's he talking to? Those men didn't say a word."
        }
      },
      { type: "verse", id: "crowd-9-5", key: "MT_9_5" },
      { type: "verse", id: "crowd-9-6a", key: "MT_9_6A" },
      { type: "verse", id: "crowd-9-6n", key: "MT_9_6N" },
      { type: "fx", fx: "light", level: "bright" },
      { type: "verse", id: "crowd-9-6b", key: "MT_9_6B" },
      { type: "fx", fx: "light", level: "soft" },
      {
        type: "line",
        when: NEAR,
        text: { ko: "아셀이 움직인다. 요나의 손이 저도 모르게 뻗는다.", en: "Asher moves. Yonah's hand reaches out before he can think." }
      },
      {
        type: "line",
        when: FAR,
        text: {
          ko: "아셀이 움직인다. 가장자리에서, 닿을 리 없는 요나의 손이 저도 모르게 뻗는다.",
          en: "Asher moves. At the edge, Yonah's hand reaches out on its own, though it can't possibly reach."
        }
      },
      {
        type: "choice",
        id: "c9",
        prompt: { ko: "아셀이 몸을 일으킨다. 그 순간, 요나는?", en: "Asher begins to rise. In that moment, Yonah…" },
        options: [
          {
            id: "a",
            text: { ko: "그분을 본다. “누구시길래.”", en: "Look at Jesus. “Who *is* he?”" },
            lens: 1,
            reaction: [
              {
                type: "line",
                speaker: "thought",
                text: {
                  ko: "폭풍에 말씀하셨다는 분이, 오늘 아셀에게 말씀하셨다.",
                  en: "They say he spoke to a storm. Today he spoke to Asher."
                }
              }
            ]
          },
          {
            id: "b",
            text: { ko: "“손 잡아 줄까?” 하고 묻는다.", en: "Ask, “Want my hand?”" },
            lens: 2,
            reaction: [
              {
                type: "line",
                when: NEAR,
                speaker: "asher",
                text: { ko: "괜찮아. 네 손은 오늘 할 만큼 했어.", en: "I'm okay. Your hands have done enough today." }
              },
              {
                type: "line",
                when: FAR,
                text: {
                  ko: "요나의 목소리는 무리 소리에 묻힌다. 그래도 아셀이 이쪽을 돌아본다.",
                  en: "Yonah's voice is lost in the noise of the crowd. Still, Asher turns this way."
                }
              }
            ]
          },
          {
            id: "c",
            text: { ko: "잡아당기지 않고, 손만 내민다.", en: "Hold out a hand, without pulling." },
            lens: 2,
            reaction: [
              {
                type: "line",
                when: NEAR,
                text: {
                  ko: "아셀이 그 손을 잠깐 본다. 그리고 혼자 일어선다.",
                  en: "Asher looks at the hand for a moment. Then he stands up on his own."
                }
              },
              {
                type: "line",
                when: FAR,
                text: { ko: "닿지 않는 거리다. 그래도 요나는 손을 거두지 않는다.", en: "It's too far to reach. Still, Yonah doesn't lower his hand." }
              }
            ]
          },
          {
            id: "d",
            text: { ko: "물러서서, 아셀이 자기 침상을 들게 한다.", en: "Step back and let Asher pick up his own bed." },
            lens: 3,
            reaction: [
              {
                type: "line",
                when: NEAR,
                text: {
                  ko: "요나는 한 걸음 물러선다. 아셀이 자기 침상 쪽으로 몸을 굽힌다.",
                  en: "Yonah steps back. Asher bends down toward his own bed."
                }
              },
              {
                type: "line",
                when: FAR,
                text: {
                  ko: "요나는 한 걸음 더 물러선다. 아셀이 걸어 나올 길을 비워 둔다.",
                  en: "Yonah steps back further, leaving the way open for Asher to walk out."
                }
              }
            ]
          }
        ]
      },
      {
        type: "line",
        id: "rope-rise",
        when: { flag: "item", is: "rope" },
        text: {
          ko: "요나가 묶어 둔 끈이, 침상을 드는 아셀의 손잡이가 된다.",
          en: "The rope Yonah tied becomes a handle as Asher lifts his bed."
        }
      },
      {
        type: "line",
        id: "cloak-rise",
        when: { flag: "item", is: "cloak" },
        text: {
          ko: "아셀이 덮고 있던 갈색 겉옷을 직접 집어 든다.",
          en: "Asher picks up the brown cloak that covered him, with his own hands."
        }
      },
      {
        type: "line",
        id: "water-rise",
        when: { all: [{ flag: "item", is: "water" }, NEAR] },
        text: {
          ko: "요나는 발치의 물주머니를 얼른 치운다. 아셀의 걸음에 걸리지 않게.",
          en: "Yonah quickly moves the waterskin from by his feet, out of Asher's way."
        }
      },
      {
        type: "line",
        id: "water-rise-far",
        when: { all: [{ flag: "item", is: "water" }, FAR] },
        text: {
          ko: "동료 하나가, 요나가 채워 온 물주머니를 아셀의 걸음 밖으로 치운다.",
          en: "One of the partners moves the waterskin Yonah filled out of Asher's way."
        }
      },
      { type: "verse", id: "crowd-9-7", key: "MT_9_7" },
      { type: "verse", id: "crowd-9-8", key: "MT_9_8" },
      { type: "fx", fx: "light", level: "off" },

      // ===== Afternoon: the road home =====
      { type: "scene", bg: "road_home", caption: { ko: "오후 · 집으로 가는 길", en: "Afternoon · The road home" } },
      {
        type: "line",
        text: {
          ko: "집으로 가는 길. 이번에는 소문이 그들보다 먼저 달린다.",
          en: "The road home. This time, the news runs ahead of them."
        }
      },
      {
        type: "line",
        id: "food-road",
        when: { flag: "item", is: "food" },
        text: {
          ko: "요나의 허리춤에서 보따리가 흔들린다. 아직 풀지 않았다.",
          en: "The bundle at Yonah's waist swings as he walks. It's still unopened."
        }
      },
      {
        type: "choice",
        id: "c10",
        prompt: { ko: "사람들이 몰려든다. “무슨 일이 있었어?”", en: "People crowd around them. “What happened?”" },
        options: [
          {
            id: "a",
            text: {
              ko: "“그분이 죄를 사할 권능이 있다고 하셨어. 그게 무슨 뜻일까.”",
              en: "“He said he has authority to forgive sins. What could that mean?”"
            },
            lens: 1,
            reaction: [
              {
                type: "line",
                text: {
                  ko: "웅성거림이 커진다. 요나도 그 말을 속으로 다시 굴려 본다.",
                  en: "The murmuring grows. Yonah is still turning the words over himself."
                }
              }
            ]
          },
          {
            id: "b",
            text: {
              ko: "“먼저 죄 사함을 말씀하셨어. 일어나라는 건 그다음이었어.”",
              en: "“He spoke of forgiveness of sins first. Telling him to get up came after.”"
            },
            lens: 2,
            reaction: [
              {
                type: "line",
                text: { ko: "사람들은 다리 이야기를 더 듣고 싶어 한다.", en: "People want to hear more about the legs." }
              }
            ]
          },
          {
            id: "c",
            text: {
              ko: "“못 걷던 애가 걷잖아! 우리가 데려갔다고!”",
              en: "“He couldn't walk, and look at him now! We're the ones who brought him!”"
            },
            lens: 3,
            reaction: [
              {
                type: "line",
                when: NEAR,
                text: {
                  ko: "요나의 목소리가 길 끝까지 울린다. 아셀이 피식 웃는다.",
                  en: "Yonah's voice carries to the end of the road. Asher snorts a laugh."
                }
              },
              {
                type: "line",
                when: FAR,
                text: {
                  ko: "말해 놓고, 요나는 말끝을 흐린다. 마지막까지 든 손은 그의 손이 아니었다.",
                  en: "Yonah trails off. The hands that carried him all the way weren't his."
                }
              }
            ]
          },
          {
            id: "d",
            text: {
              ko: "“본인한테 물어봐. 그 자리에 누워 있던 사람이잖아.”",
              en: "“Ask him. He's the one who was lying there.”"
            },
            lens: 3,
            reaction: [
              {
                type: "line",
                text: {
                  ko: "눈길이 모두 아셀에게 쏠린다. 아셀이 잠깐 머뭇거리다 입을 연다.",
                  en: "Every eye turns to Asher. He hesitates a moment, then starts to speak."
                }
              }
            ]
          }
        ]
      }
    ],

    // Played before any ending; only the "far" path (c6 option d) has lines here.
    endingPreface: [
      {
        type: "line",
        id: "far-preface-1",
        when: FAR,
        text: {
          ko: "그분은 *그들의* 믿음을 보셨다. 그날 그 *그들* 안에 너는 없었다.",
          en: "He saw *their* faith. That day, you were not one of *them*."
        }
      },
      {
        type: "line",
        id: "far-preface-2",
        when: FAR,
        text: {
          ko: "그래도 아셀은 일어났고, 가장자리에 선 너를 지나며 웃었다.",
          en: "Still, Asher rose, and as he passed you at the edge, he smiled."
        }
      }
    ],

    // Titles come from data/meta.js (BHS.meta.endings.friend).
    endings: {
      "1": {
        beats: [
          { type: "scene", bg: "doorway_evening", caption: { ko: "저녁 · 아셀의 집 앞", en: "Evening · Asher's doorway" } },
          {
            type: "line",
            speaker: "thought",
            text: {
              ko: "우리는 다리를 구하러 갔다. 그분은 하나님만 하실 수 있는 말을 하셨다.",
              en: "We went to ask for his legs. He said what only God can say."
            }
          },
          {
            type: "line",
            text: {
              ko: "요나는 한 번도 ‘누가 죄를 사할 수 있나’를 물어본 적이 없었다.",
              en: "Yonah had never once asked who can forgive sins."
            }
          },
          {
            type: "line",
            id: "e1-callback-c3a",
            when: { choice: "c3", is: "a" },
            text: {
              ko: "아침에 “너 잘못 아니야”라고밖에 못 했던 일이 떠오른다.",
              en: "He remembers this morning, when all he could say was “It's not your fault.”"
            }
          },
          {
            type: "line",
            id: "e1-callback-c3d",
            when: { choice: "c3", is: "d" },
            text: {
              ko: "아침에 “나도 몰라”라고밖에 못 했던 일이 떠오른다.",
              en: "He remembers this morning, when all he could say was “I don't know either.”"
            }
          },
          {
            type: "line",
            when: { choice: "c3", in: ["a", "d"] },
            text: {
              ko: "그 질문에 답할 수 있는 분이, 오늘 거기 계셨다.",
              en: "Today, the one who could answer that question was there."
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
          { type: "scene", bg: "road_home" },
          {
            type: "line",
            text: { ko: "누군가 묻는다. “그러니까, 걸을 수 있게 됐다는 거지?”", en: "Someone asks, “So he can walk now, right?”" }
          },
          {
            type: "line",
            speaker: "yonah",
            text: { ko: "맞아. 하지만 그게 첫 말씀은 아니었어.", en: "Yes. But that wasn't the first thing he said." }
          },
          { type: "verse", id: "e2-memory-9-2b1", key: "MT_9_2B1" },
          {
            type: "line",
            text: {
              ko: "그 말을 들을 때 아셀의 얼굴이 어땠는지, 요나는 기억한다.",
              en: "Yonah remembers Asher's face when he heard those words."
            }
          }
        ],
        last: {
          ko: "그분은 다리보다 먼저, 아셀이 가장 무서워하던 질문에 답하셨다.",
          en: "Before a word about his legs, Jesus answered the question Asher feared most."
        }
      },

      "3": {
        beats: [
          { type: "scene", bg: "road_home" },
          { type: "line", text: { ko: "아셀이 자기 침상을 들고 걷는다.", en: "Asher walks, carrying his own bed." } },
          {
            type: "line",
            when: NEAR,
            text: { ko: "요나는 처음으로 빈손으로 그 옆을 걷는다.", en: "For the first time, Yonah walks beside him with empty hands." }
          },
          {
            type: "line",
            when: FAR,
            text: { ko: "요나는 이번에는 뒤가 아니라, 그 옆을 걷는다.", en: "This time Yonah walks not behind him, but beside him." }
          },
          {
            type: "line",
            id: "e3-c10c",
            when: { choice: "c10", is: "c" },
            text: {
              ko: "할 이야기가 너무 많아, 정작 곁에서 함께 걷는 걸 놓칠 뻔했다.",
              en: "There was so much to tell that he almost missed simply walking beside him."
            }
          },
          {
            type: "line",
            id: "e3-c10d",
            when: { choice: "c10", is: "d" },
            text: {
              ko: "아침에는 그가 도착하도록 도왔다. 저녁에는 그가 말하도록 기다렸다.",
              en: "In the morning, Yonah helped him get there. In the evening, he waited for him to speak."
            }
          },
          {
            type: "scene",
            when: { flag: "item", is: "food" },
            bg: "doorway_evening",
            caption: { ko: "저녁 · 아셀의 집", en: "Evening · Asher's house" }
          },
          {
            type: "line",
            id: "e3-food",
            when: { flag: "item", is: "food" },
            text: {
              ko: "그날 저녁, 그 보따리를 아셀의 집에서 같이 푼다.",
              en: "That evening, they open the bundle together at Asher's house."
            }
          }
        ],
        last: {
          ko: "너는 그를 여기까지 들고 왔다. 집까지는 그가 침상을 들고 갔다.",
          en: "You carried him this far. The rest of the way home, he carried the bed."
        }
      }
    }
  };
})();
