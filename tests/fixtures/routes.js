/*
 * tests/fixtures/routes.js - FIXTURE ONLY. Three short demo routes (ids scribe / friend / asher) in the
 * version 3 format (4 choices, the last counts double, cut endings) that exercise every beat type,
 * condition form, token, and FX in SPEC 4.5. Used by tests/engine.test.mjs and tests/fixture.html.
 * Real routes live in data/routes/*.js.
 *   scribe: cut option c3/d (leaves after the first words), endingPreface, endingCoda, pinned thought.
 *   friend: cut option c2/d (sets the bed down in the lane), flags, all/any/not conditions.
 *   asher:  no cut option (by design), persistent actions, presses, pov, var token in the coda.
 * Option "a" is never a cut option, so fastForward's default pick plays a route to its lens ending.
 * Each fixture route registers only if the real route is absent, unless window.BHS_FORCE_FIXTURE.
 */
(function () {
  var BHS = (window.BHS = window.BHS || {});
  BHS.routes = BHS.routes || {};
  var force = !!window.BHS_FORCE_FIXTURE;

  function T(ko, en) {
    return { ko: ko, en: en };
  }
  function line(speaker, ko, en, extra) {
    var b = { type: "line", text: T(ko, en) };
    if (speaker) b.speaker = speaker;
    if (extra) Object.keys(extra).forEach(function (k) { b[k] = extra[k]; });
    return b;
  }
  function opt(id, ko, en, lens, extra) {
    var o = { id: id, text: T(ko, en), lens: lens };
    if (extra) Object.keys(extra).forEach(function (k) { o[k] = extra[k]; });
    return o;
  }
  function choice(id, pko, pen, options) {
    return { type: "choice", id: id, prompt: T(pko, pen), options: options };
  }
  // A plain choice whose four options carry the given lenses (fixture filler).
  function filler(id, pko, pen, lenses, texts) {
    var ids = ["a", "b", "c", "d"];
    return choice(
      id,
      pko,
      pen,
      ids.map(function (oid, i) {
        return opt(oid, texts[i][0], texts[i][1], lenses[i]);
      })
    );
  }
  var PASSERBY = line(
    "passerby",
    "고통 뒤에 무슨 사연이 있는지 누가 알겠어. 저 사람은 무슨 잘못을 했기에 저렇게 됐을까.",
    "Who knows what's behind suffering like that. What did he do to end up like that?"
  );

  // ------------------------------------------------------------------ scribe (cut at c3)
  var scribe = {
    id: "scribe",
    beats: [
      { type: "scene", bg: "dawn_lamp", caption: T("새벽 · 므나헴의 방", "Dawn · Menahem's room") },
      line(null, "등잔불이 흔들린다. 두루마리가 펼쳐져 있다.", "The lamp flickers. A scroll lies open."),
      { type: "verse", key: "PS_103_3" },
      line("hanan", "선생님, 누가 용서하고, 누가 고치시는 거예요?", "Teacher, who forgives, and who heals?"),
      choice("c1", "하난에게 뭐라고 답할까?", "How do you answer Hanan?", [
        opt("a", "“주님이시다. 주어를 분명히 해라.”", "“The Lord. Be clear about who acts.”", 1, { set: { mark: "he" }, reaction: [line("thought", "*그가*에 밑줄을 긋는다.", "You underline *who*.")] }),
        opt("b", "“용서가 먼저, 치유가 그다음에 나오는구나.”", "“Forgiving comes first, then healing.”", 2, { set: { mark: "order" } }),
        opt("c", "“아픈 사람에게 이 구절은 어떻게 들릴까.”", "“How would this verse sound to someone sick?”", 3, { set: { mark: "disease" } }),
        opt("d", "“설명하기 전에 시 전체를 읽자.”", "“Let's read the whole psalm before explaining.”", 2, { set: { mark: "whole" } })
      ]),
      line("thought", "하나님께 속한 것은 하나님께 속한 것이다.", "What belongs to God belongs to God."),
      line("sign", "― 문 두드리는 소리 ―", "— a knock at the door —"),
      line("neighbor", "예수라는 사람이 돌아온대요!", "That Jesus is coming back!"),
      { type: "verse", key: "MT_9_1" },
      { type: "scene", bg: "lane", caption: T("늦은 아침 · 골목", "Late morning · The lane") },
      PASSERBY,
      line(null, "므나헴은 길을 비킨다. 침상 위의 눈과 잠깐 마주친다.", "Menahem steps aside. For a moment he meets the eyes of the man on the bed."),
      { type: "scene", bg: "crowd", caption: T("정오 무렵 · 바닷가 공터", "Around noon · Open ground by the shore") },
      { type: "fx", fx: "light", level: "soft" },
      { type: "verse", key: "MT_9_2A" },
      { type: "fx", fx: "light", level: "bright" },
      { type: "fx", fx: "hush" },
      {
        type: "fx",
        fx: "echoVerse",
        key: "PS_103_3",
        highlight: {
          flag: "mark",
          map: {
            he: { ko: ["그가"], en: ["who forgives"] },
            order: { ko: ["사하시며", "고치시며"], en: ["forgives", "heals"] },
            disease: { ko: ["병"], en: ["diseases"] },
            whole: "*"
          }
        }
      },
      { type: "verse", key: "MT_9_2B" },
      { type: "fx", fx: "light", level: "soft" },
      filler("c2", "첫마디를 듣고 무슨 생각이 들까?", "What crosses your mind at the first words?", [1, 2, 3, 1], [
        ["“넘어서는 안 될 선을 넘었다.”", "“He crossed a line no one may cross.”"],
        ["“왜 고치기 전에 용서부터? 아침의 그 순서처럼.”", "“Why forgive before healing? Like this morning's order.”"],
        ["“저 사람에게 직접 말하는구나.”", "“He speaks to the man directly.”"],
        ["“하나님의 용서를 전하는 건가, 자기 권한으로 말하는 건가?”", "“Is he announcing God's forgiveness, or speaking on his own authority?”"]
      ]),
      { type: "fx", fx: "pinThought", items: ["verse:MT_9_3Q"] },
      line("thought", "말이 목까지 차오른다. 그러나 입 밖으로는 나오지 않는다.", "The words rise in your throat. They never leave your mouth."),
      choice("c3", "이제 어떻게 할까?", "What now?", [
        opt("a", "“그래도 내 질문은 정당하다.”", "“My question is still fair.”", 1),
        opt("b", "“아침의 구절을 다시 떠올린다.”", "“You recall the morning's verse.”", 2),
        opt("c", "“저 사람의 얼굴을 본다.”", "“You look at the man's face.”", 3),
        opt("d", "“들을 만큼 들었다.” 돌아선다.", "“I have heard enough.” You turn away.", null, {
          cut: true,
          reaction: [line(null, "므나헴은 대답을 듣기 전에 무리를 빠져나온다.", "Menahem leaves the crowd before the answer comes.")]
        })
      ]),
      { type: "fx", fx: "pinThought", items: ["verse:MT_9_3Q", "choice:c3"] },
      { type: "fx", fx: "readReceipt" },
      { type: "verse", key: "MT_9_4N" },
      { type: "verse", key: "MT_9_4Q" },
      { type: "fx", fx: "unpinThought" },
      { type: "verse", key: "MT_9_5" },
      { type: "verse", key: "MT_9_6A" },
      { type: "verse", key: "MT_9_6N" },
      { type: "fx", fx: "light", level: "bright" },
      { type: "verse", key: "MT_9_6B" },
      { type: "verse", key: "MT_9_7" },
      { type: "verse", key: "MT_9_8" },
      { type: "fx", fx: "light", level: "soft" },
      filler("c4", "므나헴의 눈은 어디에 머물까?", "Where do your eyes finally rest?", [1, 2, 3, 1], [
        ["예수라는 사람을 다시 본다.", "You look at this Jesus again."],
        ["아침의 구절을 속으로 다시 읽는다.", "You reread the morning's verse in your head."],
        ["침상을 들고 가는 그 사람의 등을 본다.", "You watch the man carry his bed away."],
        ["기록장에 정확한 말을 적는다.", "You write down the exact words."]
      ]),
      { type: "fx", fx: "light", level: "off" }
    ],
    endingPreface: [line("thought", "기록장을 편다.", "You open your notes.")],
    endings: {
      "1": {
        beats: [
          line(null, "므나헴은 그 주장을 누구보다 정확히 알아들었다.", "Menahem understood the claim more precisely than anyone."),
          line(null, "그는 *신성모독*이라고 적는다. 이 단어는 {{r:MT_26_65}}에서 다시 나온다.", "He writes *blasphemy*. The word returns in {{r:MT_26_65}}.", { when: { all: [{ lastLens: 1 }, { choice: "c4", is: "a" }] } }),
          line(null, "그는 결론 칸을 비워 둔다.", "He leaves the conclusion blank.", { when: { choice: "c4", is: "d" } })
        ],
        last: T("하나님에 대해서는 네가 옳았다. 남은 질문은 그에 대한 것이다.", "About God, you were right. The question left is about him.")
      },
      "2": {
        beats: [line(null, "시편 103편을 다시 편다. {{v:PS_103_3}}", "You open Psalm 103 again. {{v:PS_103_3}}")],
        last: T("말씀은 바뀌지 않았다. 내 질문이 바뀌었다.", "The Word did not change. My question did.")
      },
      "3": {
        beats: [line(null, "그는 그 권한으로 한 사람을 집에 보냈다.", "With that authority, he sent one man home.", { when: { c10lens: 3 } })],
        last: T("나는 오늘 율법으로 그 사람을 판단했다. 그는 권한으로 그 사람을 일으켰다.", "Today I judged that man by the Law. He raised him by authority.")
      },
      cut: {
        beats: [
          line("sign", "몇 시간 뒤", "Hours later"),
          line("hanan", "선생님, 그 사람이 일어나 침상을 들고 집으로 갔어요.", "Teacher, that man got up, picked up his bed, and went home."),
          line(null, "아침에 밑줄 그은 글자가 떠오른다.", "The word you underlined this morning comes back to you.", { when: { flag: "mark", is: "he" } })
        ],
        last: T("너는 첫마디까지 들었다. 그다음 말은 하난이 대신 들었다.", "You heard the first words. Hanan heard the rest for you.")
      }
    },
    endingCoda: [line("sign", "― 등잔이 꺼진다 ―", "— the lamp goes out —")]
  };

  // ------------------------------------------------------------------ friend (cut at c2, in the lane)
  var friend = {
    id: "friend",
    beats: [
      { type: "scene", bg: "shore_dawn", caption: T("새벽 · 바닷가", "Dawn · The shore") },
      line(null, "그물을 손질하는데 누군가 외친다.", "You're mending nets when someone shouts."),
      line("partners", "그분이 배로 돌아오신대!", "He's coming back by boat!"),
      choice("c1", "무엇이 먼저 떠오를까?", "What comes to mind first?", [
        opt("a", "“폭풍을 말로? 그런 분이라면.”", "“A storm, by a word? If he's like that...”", 1),
        opt("b", "“아셀!” 그물을 내려놓는다.", "“Asher!” You drop the net.", 3, { reaction: [line("yonah", "아셀한테 가야 해.", "I have to get to Asher.")] }),
        opt("c", "“가서 아무것도 안 바뀌면, 아셀이 또 무너질 텐데.”", "“If nothing changes, Asher will fall apart again.”", 2),
        opt("d", "“오늘 하루 품삯은 한 데나리온인데({{r:MT_20_2}}).”", "“Today's wage is a denarius ({{r:MT_20_2}}).”", 3)
      ]),
      { type: "scene", bg: "asher_home", caption: T("아침 · 아셀의 집", "Morning · Asher's house") },
      line("asher", "내가 뭘 잘못해서 이렇게 된 걸까?", "What did I do wrong to end up like this?"),
      { type: "scene", bg: "lane", caption: T("늦은 아침 · 골목", "Late morning · The lane") },
      line(null, "침상이 기운다. 요나가 모서리를 다시 잡는다.", "The bed tilts. Yonah grabs the corner again.", { when: { choice: "c1", is: "b" } }),
      PASSERBY,
      choice("c2", "행인의 말이 들린다.", "You hear the passerby.", [
        opt("a", "“우리는 그분께 가는 길이에요.”", "“We're on our way to him.”", 1),
        opt("b", "아셀에게 속삭인다. “신경 쓰지 마.”", "You whisper to Asher, “Ignore him.”", 2, {
          reaction: [line("asher", "네가 그걸 어떻게 알아?", "How would you know?"), line(null, "요나는 대답하지 못한다.", "Yonah has no answer.")]
        }),
        opt("c", "“그걸 어떻게 아세요?” 행인 앞을 막아선다.", "“How would you know?” You step in front of him.", 3, { set: { stood: true } }),
        opt("d", "침상을 내려놓는다. “…오늘은 안 되겠어.”", "You set the bed down. “...I can't today.”", null, {
          cut: true,
          set: { stayed: true },
          reaction: [line(null, "다른 사람들이 침상을 들고 간다. 요나는 골목에 남는다.", "The others pick up the bed. Yonah stays in the lane.")]
        })
      ]),
      { type: "scene", bg: "crowd", caption: T("정오 무렵 · 바닷가 공터", "Around noon · Open ground by the shore") },
      { type: "fx", fx: "light", level: "soft" },
      { type: "verse", key: "MT_9_2A" },
      line(null, "그 손들 가운데 네 손이 있다.", "Your hands are among them.", { when: { not: { flag: "stayed", is: true } } }),
      { type: "fx", fx: "light", level: "bright" },
      { type: "verse", key: "MT_9_2B" },
      { type: "fx", fx: "light", level: "soft" },
      filler("c3", "기대와 다른 첫마디다.", "Not the first words you expected.", [1, 2, 2, 3], [
        ["“저 말은 하나님만 하실 수 있는 말인데.”", "“Only God can say that.”"],
        ["“왜 그 말부터 하셨지?”", "“Why start with that?”"],
        ["아셀의 얼굴을 본다.", "You look at Asher's face."],
        ["“하지만 우리는 걷게 해 달라고 왔는데.”", "“But we came so he could walk.”"]
      ]),
      line(null, "어떤 서기관들이 굳은 얼굴로 입을 다문다.", "Some scribes go silent, their faces stiff."),
      { type: "verse", key: "MT_9_4N" },
      { type: "verse", key: "MT_9_4Q" },
      line("yonah", "누구한테 하시는 말씀이지? 저 사람들은 아무 말도 안 했는데.", "Who is he talking to? They didn't say anything."),
      { type: "verse", key: "MT_9_5" },
      { type: "verse", key: "MT_9_6A" },
      { type: "verse", key: "MT_9_6N" },
      { type: "fx", fx: "light", level: "bright" },
      { type: "verse", key: "MT_9_6B" },
      { type: "verse", key: "MT_9_7" },
      line(null, "요나는 물러서서 아셀이 자기 침상을 들게 둔다.", "Yonah steps back and lets Asher lift his own bed.", { when: { any: [{ flag: "stood", is: true }, { choice: "c3", in: ["d"] }] } }),
      line(null, "행인 앞을 막아섰던 손이 이제는 비어 있다.", "The hand that blocked the passerby is empty now.", { when: { all: [{ flag: "stood", is: true }, { not: { choice: "c3", is: "a" } }] } }),
      { type: "verse", key: "MT_9_8" },
      line("crowd", "무슨 일이 있었어?", "What happened?"),
      filler("c4", "뭐라고 대답할까?", "What do you say?", [1, 2, 3, 3], [
        ["“그분이 죄를 사하는 권능이 있다고 하셨어.”", "“He said he has authority to forgive sins.”"],
        ["“먼저 죄 사함을 말씀하셨어.”", "“He spoke of forgiveness first.”"],
        ["“못 걷던 애가 걷잖아!”", "“He couldn't walk, and now he's walking!”"],
        ["“본인한테 물어봐.”", "“Ask him yourself.”"]
      ]),
      { type: "fx", fx: "light", level: "off" }
    ],
    endings: {
      "1": {
        beats: [
          line(null, "우리는 다리를 구하러 갔다.", "We went asking for legs."),
          line(null, "골목에서 아셀에게 속삭였던 말이 떠오른다.", "You remember what you whispered to Asher in the lane.", { when: { choice: "c2", is: "b" } })
        ],
        last: T("우리는 걷게 해 달라고 했다. 그분은 그보다 깊은 데서 시작하셨다.", "We asked for walking. He started somewhere deeper.")
      },
      "2": {
        beats: [line("yonah", "맞아. 하지만 그게 첫 말씀은 아니었어.", "Right. But that wasn't the first thing he said.")],
        last: T("그분은 다리보다 먼저, 아셀이 가장 무서워하던 질문에 답하셨다.", "Before his legs, he answered the question Asher feared most.")
      },
      "3": {
        beats: [line(null, "요나는 처음으로 빈손으로 그 옆을 걷는다.", "For the first time, Yonah walks beside him empty-handed.")],
        last: T("너는 그를 여기까지 들고 왔다. 집까지는 그가 침상을 들고 갔다.", "You carried him this far. He carried the bed home.")
      },
      cut: {
        beats: [
          line("sign", "얼마 뒤", "A while later"),
          line(null, "골목 아래쪽이 시끄러워진다. 누군가 침상을 들고 걸어 올라온다.", "The lower lane grows loud. Someone is walking up, carrying a bed."),
          line(null, "아셀이 자기 침상을 들고 요나 곁을 지나간다.", "Asher walks past Yonah, carrying his own bed.", { when: { flag: "stayed", is: true } })
        ],
        last: T("그분은 ‘그들의 믿음’을 보셨다. 그날 그 ‘그들’ 안에 너는 없었다.", "He saw ‘their faith.’ That day, you weren't among ‘them.’")
      }
    }
  };

  // ------------------------------------------------------------------ asher (no cut option by design)
  var asher = {
    id: "asher",
    actions: [
      { id: "getup", label: T("일어나기", "Get up"), replies: [T("다리가 대답하지 않는다.", "Your legs don't answer."), T("여전히.", "Still nothing."), T("네 해째다.", "Four years now.")], counter: "getup_count" },
      { id: "goout", label: T("밖으로", "Go out"), replies: [T("문까지가 너무 멀다.", "The door is too far.")], counter: "goout_count" }
    ],
    beats: [
      { type: "scene", bg: "asher_ceiling", pov: "lying", caption: T("새벽 · 아셀의 집", "Dawn · Asher's house") },
      line(null, "서까래. 갈대와 진흙 지붕. 문틈의 빛.", "Rafters. A roof of reeds and mud. Light at the door."),
      filler("c1", "오늘은 어느 기도로 시작할까?", "Which prayer do you start with today?", [2, 2, 1, 3], [
        ["{{v:PS_103_3}}", "{{v:PS_103_3}}"],
        ["시편 41편의 기도 ({{r:PS_41_4}})", "The prayer of Psalm 41 ({{r:PS_41_4}})"],
        ["원망도 하나님을 향한 말이다.", "Even a complaint is spoken to God."],
        ["어머니가 물 긷는 소리를 듣는다.", "You listen to Mom drawing water."]
      ]),
      { type: "fx", fx: "actionReply", action: "goout", text: T("요나가 오는 소리가 들린다.", "You hear Yonah coming.") },
      line("yonah", "그분이 돌아오셨어. 가자!", "He's back. Let's go!"),
      line("sign", "네가 망설여도, 사람들이 너를 든다.", "Even if you hesitate, they lift you."),
      { type: "scene", bg: "sky_carried", caption: T("늦은 아침 · 골목", "Late morning · The lane") },
      PASSERBY,
      { type: "fx", fx: "actionsHide" },
      { type: "scene", bg: "crowd_lying", caption: T("정오 무렵 · 그분 앞", "Around noon · Before Jesus") },
      { type: "fx", fx: "light", level: "soft" },
      { type: "verse", key: "MT_9_2A" },
      filler("c2", "무슨 말을 하려 했나?", "What were you going to say?", [3, 3, 2, 1], [
        ["“저를 도와주세요.”", "“Please help me.”"],
        ["“걷고 싶습니다.”", "“I want to walk.”"],
        ["“저는 하나님께 버림받은 건가요?”", "“Has God abandoned me?”"],
        ["“당신은 누구십니까?”", "“Who are you?”"]
      ]),
      { type: "fx", fx: "actionsShow" },
      { type: "fx", fx: "light", level: "bright" },
      { type: "verse", key: "MT_9_2B1" },
      filler("c3", "“작은 자야”", "“My son”", [2, 2, 3, 1], [
        ["“나에 대해 말하는 게 아니라, 나에게 말씀하신다.”", "“He isn't talking about me. He's talking to me.”"],
        ["“내가 얼마나 무서운지 아시는 걸까.”", "“Does he know how scared I am?”"],
        ["“아이를 부르듯 부르셨어.”", "“He called me like a child.”"],
        ["“다음 말을 듣고 싶다.”", "“I want to hear what comes next.”"]
      ]),
      { type: "verse", key: "MT_9_2B2" },
      { type: "fx", fx: "light", level: "soft" },
      line(null, "몇몇 서기관이 굳은 얼굴로 입을 다문다.", "A few scribes go silent, their faces stiff."),
      { type: "verse", key: "MT_9_4N" },
      { type: "verse", key: "MT_9_4Q" },
      { type: "verse", key: "MT_9_5" },
      { type: "verse", key: "MT_9_6A" },
      { type: "verse", key: "MT_9_6N" },
      { type: "fx", fx: "light", level: "bright" },
      { type: "verse", key: "MT_9_6B" },
      { type: "press", action: "getup", hint: T("일어나기", "Get up") },
      { type: "fx", fx: "pov", pov: "standing" },
      { type: "scene", bg: "crowd", caption: T("정오 무렵 · 바닷가 공터", "Around noon · Open ground by the shore") },
      { type: "press", label: T("침상을 들어", "Pick up your bed") },
      { type: "press", label: T("집으로", "Go home") },
      { type: "verse", key: "MT_9_7" },
      { type: "verse", key: "MT_9_8" },
      { type: "fx", fx: "light", level: "off" },
      filler("c4", "가장 먼저 든 생각은?", "Your very first thought?", [1, 2, 3, 2], [
        ["“이분은 누구시길래.”", "“Who is he?”"],
        ["“일어나기 전에 먼저 하신 말이 있었다.”", "“He said something before I stood.”"],
        ["“이게 나를 싣고 다니던 침상이다.”", "“This is the bed that carried me.”"],
        ["“나에게 하신 말씀을 잊지 말자.”", "“I won't forget what he said to me.”"]
      ])
    ],
    endings: {
      "1": { beats: [line(null, "아셀은 그분이 누구신지 묻기 시작한다.", "Asher begins to ask who he is.")], last: T("다리를 고칠 분을 만나러 갔다. 죄를 사하는 분을 만나고 왔다.", "I went to meet someone who could heal legs. I came back from meeting the one who forgives sins.") },
      "2": { beats: [line(null, "아셀은 누워 있던 자기에게 그분이 말을 거신 순간을 떠올린다.", "Asher remembers the moment he spoke to him lying there.")], last: T("왜 병들었는지는 모른다. 오늘 그분이 나에게 하신 말씀은 안다.", "I don't know why I got sick. I know what he said to me today.") },
      "3": { beats: [line(null, "아셀은 침상을 어깨에 메고 걷는다.", "Asher walks with the bed on his shoulder.")], last: T("너를 들고 다니던 침상을, 이제 네가 들고 간다.", "The bed that carried you, you now carry.") }
    },
    endingCoda: [line("sign", "일어나기 시도 {{var:getup_count}}번", "Tried to get up {{var:getup_count}} times")]
  };

  if (force || !BHS.routes.scribe) BHS.routes.scribe = scribe;
  if (force || !BHS.routes.friend) BHS.routes.friend = friend;
  if (force || !BHS.routes.asher) BHS.routes.asher = asher;
  BHS.fixtureRoutes = { scribe: scribe, friend: friend, asher: asher };
})();
