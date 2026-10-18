/* Shared narrative: prologue, route select, mismatch line, final screen. Owner: lead. */
(function () {
  var BHS = (window.BHS = window.BHS || {});

  BHS.common = {
    prologue: [
      { type: "scene", bg: "black" },
      { type: "line", speaker: "sign", text: { ko: "― 두루마리 펴는 소리 ―", en: "— a scroll unrolling —" } },
      { type: "line", speaker: "sign", text: { ko: "― 돌길 위 발소리 ―", en: "— footsteps on a stone lane —" } },
      { type: "line", speaker: "sign", text: { ko: "― 바닥에 끌리는 침상 ―", en: "— a bed scraping across the floor —" } },
      { type: "scene", bg: "shore_dawn", caption: { ko: "갈릴리 바다 · 가버나움", en: "Sea of Galilee · Capernaum" } },
      { type: "line", text: { ko: "가버나움. 예수라는 사람이 배를 타고 돌아온다.", en: "Capernaum. A man named Jesus is coming back by boat." } },
      {
        type: "line",
        text: {
          ko: "바다 위 폭풍이 그의 말 한마디에 잠잠해졌다는 소문이 그보다 먼저 도착했다.",
          en: "A rumor got here before he did: a storm on the sea went still at a single word from him."
        }
      },
      {
        type: "line",
        text: {
          ko: "건너편 마을에서 귀신들이 쫓겨났다는 소문도 함께.",
          en: "Another rumor came with it: across the lake, demons were driven out."
        }
      },
      {
        type: "line",
        text: {
          ko: "하지만 오늘 그가 할 첫마디는 아무도 예상하지 못했다.",
          en: "But no one expected the first thing he would say today."
        }
      }
    ],

    routeSelect: {
      prompt: { ko: "누구의 눈으로 이 하루를 보겠습니까?", en: "Through whose eyes will you see this day?" }
    },

    // Shown before the ending when the ending lens differs from the lens of the c10 pick.
    mismatchLine: {
      ko: "마지막 말은 다른 데로 가려 했다. 그런데 하루 종일 네 눈이 머문 곳은 따로 있었다.",
      en: "Your last words leaned one way. But all day, your eyes kept resting somewhere else."
    },

    final: {
      key: "MT_9_2B2",
      blanks: {
        scribe: { ko: "서기관에게 이 말은 ___였다.", en: "To the scribe, these words were ___." },
        friend: { ko: "친구에게 이 말은 ___였다.", en: "To the friend, these words were ___." },
        asher: { ko: "아셀에게 이 말은 ___였다.", en: "To Asher, these words were ___." }
      },
      othersHint: { ko: "나머지 두 칸은 모임 시간에 함께 채워요.", en: "Fill in the other two together as a class." },
      question: {
        ko: "네 인물은 무엇을 들었지? 그리고 예수님은 무엇을 알게 하려 하셨지?",
        en: "What did your character hear? And what did Jesus say he wanted them to know?"
      },
      closing: ["MT_9_6A", "MT_9_6B", "MT_9_7"]
    }
  };
})();
