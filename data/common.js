/* Shared narrative: prologue, route select, mismatch line. Owner: lead. */
(function () {
  var BHS = (window.BHS = window.BHS || {});

  BHS.common = {
    prologue: [
      { type: "scene", bg: "black" },
      {
        type: "line",
        speaker: "sign",
        text: {
          ko: "― 두루마리 펴는 소리. 돌길 위 발소리. 바닥에 끌리는 침상. ―",
          en: "— A scroll unrolling. Footsteps on a stone lane. A bed scraping the floor. —"
        }
      },
      { type: "scene", bg: "shore_dawn", caption: { ko: "갈릴리 바다 · 가버나움", en: "Sea of Galilee · Capernaum" } },
      { type: "line", text: { ko: "가버나움. 예수라는 사람이 배를 타고 돌아온다.", en: "Capernaum. A man named Jesus is coming back by boat." } },
      {
        type: "line",
        // Both rumors point to the sermon text (Matt 8:23-27 and 8:28-34) before the game's own story (9:1-8).
        text: {
          ko: "폭풍이 그의 말 한마디에 잠잠해졌다는 소문, 건너편에서 귀신들이 쫓겨났다는 소문이 그보다 먼저 도착했다.",
          en: "Rumors got here before he did: a storm went still at a single word from him, and demons were driven out across the lake."
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
      prompt: { ko: "누구의 눈으로 이 하루를 보겠습니까?", en: "Through whose eyes will you see this day?" },
      // The scribe's unspoken thought (route 1) is answered in routes 2 and 3; Asher standing up comes last.
      hint: { ko: "추천 순서: 서기관 → 친구 → 아셀", en: "Suggested order: scribe → friend → Asher" }
    },

    // Shown before the ending when the ending lens differs from the lens of the last (double-weight) pick.
    mismatchLine: {
      ko: "끝에서는 한쪽으로 기울었다. 그런데 오늘 내내 네 눈이 머문 곳은 따로 있었다.",
      en: "At the end, you leaned one way. But all day, your eyes kept going somewhere else."
    }
  };
})();
