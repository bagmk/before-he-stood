/* Game metadata: titles, lenses, route cards, ending titles, notices. Owner: lead. */
(function () {
  var BHS = (window.BHS = window.BHS || {});

  BHS.meta = {
    // 2.0.0: short routes (4 choices, cut endings), no final screen, no teacher page.
    version: "2.0.0",

    title: { ko: "그가 일어나기 전", en: "Before He Stood" },
    subtitle: { ko: "그날, 가버나움 · 마태복음 9:1–8", en: "Capernaum, That Day · Matthew 9:1–8" },

    disclaimer: {
      ko: "사건은 마태복음 9:1–8을 따릅니다. 이름, 대화, 이전 이야기와 결말은 창작입니다.",
      en: "The event follows Matthew 9:1–8. Names, conversations, backstories, and endings are imagined."
    },

    bibleNotice: {
      ko: "성경 본문: 성경전서 개역개정판 © 대한성서공회. 영어 본문: ESV® Bible © 2001 Crossway.",
      en: "Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved. Korean: 성경전서 개역개정판 © 대한성서공회."
    },

    // The three lenses. Every option carries one; endings are grouped by them.
    lenses: {
      1: {
        label: { ko: "누가?", en: "Who?" },
        desc: { ko: "이 말을 할 수 있는 이는 누구인가", en: "Who has the right to say this?" }
      },
      2: {
        label: { ko: "왜 먼저?", en: "Why first?" },
        desc: { ko: "왜 다리보다 이 말이 먼저였나", en: "Why did these words come before his legs?" }
      },
      3: {
        label: { ko: "어디로?", en: "Where to?" },
        desc: { ko: "그 권한은 어디로 갔나", en: "Where did that authority go?" }
      }
    },

    routeOrder: ["scribe", "friend", "asher"],

    routes: {
      scribe: {
        protagonist: "menahem",
        name: { ko: "서기관 므나헴", en: "Menahem, the scribe" },
        title: { ko: "아침에 읽은 문장", en: "The Line I Read This Morning" },
        tagline: { ko: "말씀을 지키려는 사람", en: "He guards what belongs to God." },
        firstLine: {
          ko: "하나님께 속한 것을 사람이 함부로 말하게 둘 수는 없다.",
          en: "What belongs to God must not be claimed lightly by anyone."
        },
        lensDesc: {
          1: { ko: "권한과 증거를 따지는 생각", en: "weighing authority and evidence" },
          2: { ko: "아침의 말씀과 맞춰 보는 생각", en: "checking it against the morning's Scripture" },
          3: { ko: "침상 위의 사람을 보는 생각", en: "looking at the man on the bed" }
        }
      },
      friend: {
        protagonist: "yonah",
        name: { ko: "친구 요나", en: "Yonah, the friend" },
        title: { ko: "침상의 귀퉁이", en: "A Corner of the Bed" },
        tagline: { ko: "한 사람을 예수님께 데려가는 사람", en: "He carries a friend to Jesus." },
        firstLine: {
          ko: "그가 다시 걸을 수 있다면, 오늘 내가 할 수 있는 건 뭐든 하겠다.",
          en: "If he could walk again, I'd do whatever I can today."
        },
        lensDesc: {
          1: { ko: "그분이 누구시고 무엇을 하실 수 있는지", en: "who he is and what he can do" },
          2: { ko: "아셀의 마음과 두려움", en: "Asher's heart and his fears" },
          3: { ko: "아셀의 삶, 곁, 집", en: "Asher's life, staying beside him, home" }
        }
      },
      asher: {
        protagonist: "asher",
        name: { ko: "침상의 아셀", en: "Asher, on the bed" },
        title: { ko: "나를 뭐라고 부르셨지", en: "What Did He Call Me?" },
        tagline: { ko: "예수님 앞에 누워 있는 사람", en: "He lies on a bed in front of Jesus." },
        firstLine: {
          ko: "사람들은 내가 왜 이렇게 됐는지 묻는다. 이제는 나도 그 이유가 두렵다.",
          en: "People ask why I ended up like this. Now I'm afraid of the answer too."
        },
        lensDesc: {
          1: { ko: "이 말을 하는 분은 누구인가", en: "who is saying this" },
          2: { ko: "이 말이 나에게 무슨 뜻인가", en: "what these words mean for me" },
          3: { ko: "집, 사람들, 다시 시작될 삶", en: "home, people, a life starting again" }
        }
      }
    },

    // The fourth gallery column: routes that stop midway (SPEC v3 §3).
    cut: {
      label: { ko: "중간에 끝남", en: "Cut short" },
      desc: { ko: "끝까지 가지 않은 길", en: "a path that stopped midway" }
    },

    // Canonical ending titles. Route files must not redefine these.
    endings: {
      scribe: {
        1: { ko: "누가 말했는가", en: "Who Spoke" },
        2: { ko: "다시 읽는 시편", en: "The Psalm, Read Again" },
        3: { ko: "침상을 든 뒷모습", en: "A Man Carrying His Bed" },
        cut: { ko: "끝까지 듣지 않은 사람", en: "The One Who Left Early" }
      },
      friend: {
        1: { ko: "우리가 구했던 것보다", en: "More Than We Asked For" },
        2: { ko: "첫마디도 기억한다", en: "I Remember the First Words" },
        3: { ko: "집까지 같이", en: "All the Way Home" },
        cut: { ko: "멀리서 들은 사람", en: "Heard from Afar" }
      },
      asher: {
        1: { ko: "그분은 누구신가", en: "Who Is He?" },
        2: { ko: "나에게 하신 말씀", en: "Words Spoken to Me" },
        3: { ko: "집으로", en: "Home" },
        // Asher has no cut ending by design: he cannot walk away. Shown in the gallery once his route is finished.
        cutNote: { ko: "없음 · 아셀은 걸어서 떠날 수 없었다", en: "None · Asher couldn't walk away" }
      }
    }
  };
})();
