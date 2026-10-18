/*
 * tests/fixtures/routes.js - FIXTURE ONLY. Three short demo routes (ids scribe / friend / asher)
 * that exercise every beat type, condition form, token, and FX in SPEC 4.5. Used by
 * tests/engine.test.mjs and tests/fixture.html. Real routes live in data/routes/*.js.
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

  // ------------------------------------------------------------------ scribe
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
      filler("c2", "제자의 두 번째 질문에 뭐라고 할까?", "What do you say to his second question?", [1, 1, 2, 3], [
        ["“나단은 하나님의 용서를 전했을 뿐이다.”", "“Nathan only announced God's forgiveness.”"],
        ["“그 선을 넘으면 돌로 친다({{r:LV_24_16A}}).”", "“Cross that line and you are stoned ({{r:LV_24_16A}}).”"],
        ["“다윗은 그 한마디를 듣고 어땠을까.”", "“How did David feel hearing that?”"],
        ["“걷지 못하는 사람은 성전까지 어떻게 가지?”", "“How would a man who can't walk get to the temple?”"]
      ]),
      line("sign", "― 문 두드리는 소리 ―", "— a knock at the door —"),
      line("neighbor", "예수라는 사람이 돌아온대요!", "That Jesus is coming back!"),
      filler("c3", "소문을 듣고 뭐라고 할까?", "What do you say to the rumor?", [1, 2, 3, 1], [
        ["“이적만으로는 모른다.”", "“Miracles alone prove nothing.”"],
        ["“바람과 바다를 말로? 시편은 그 일을 하나님께 돌리는데.”", "“Wind and sea, by a word? The psalm gives that to God.”"],
        ["“그 마을은 왜 그를 내보냈을까.”", "“Why did that town send him away?”"],
        ["“직접 보고 판단하겠다.”", "“I'll see for myself.”"]
      ]),
      { type: "scene", bg: "lane", caption: T("늦은 아침 · 골목", "Late morning · The lane") },
      line("passerby", "고통 뒤에 무슨 사연이 있는지 누가 알겠어. 저 사람은 무슨 잘못을 했기에 저렇게 됐을까.", "Who knows what's behind suffering like that. What did he do to end up like that?"),
      filler("c4", "침상이 지나간다. 무슨 생각이 들까?", "A bed passes by. What crosses your mind?", [1, 2, 2, 3], [
        ["저 사람을 고친다면, 저 선생이 누구인지 드러나겠군.", "If he heals that man, we'll learn who this teacher is."],
        ["혹시 죄의 징계일까.", "Could it be discipline for sin?"],
        ["병의 이유를 우리가 알 수 있나.", "Can we even know why someone is sick?"],
        ["길을 비키고, 옆 사람들에게도 비켜 달라고 한다.", "You step aside and ask the others to make room."]
      ]),
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
      { type: "fx", fx: "pinThought", items: ["verse:MT_9_3Q"] },
      line("thought", "말이 목까지 차오른다. 그러나 입 밖으로는 나오지 않는다.", "The words rise in your throat. They never leave your mouth."),
      filler("c5", "그다음 무슨 생각을 할까?", "What do you think next?", [1, 1, 2, 3], [
        ["“넘어서는 안 될 선을 넘었다.”", "“He crossed a line no one may cross.”"],
        ["“하나님의 용서를 전하는 건가, 자기 권한으로 말하는 건가?”", "“Is he announcing God's forgiveness, or speaking on his own authority?”"],
        ["“왜 고치기 전에 용서부터? 아침의 그 순서처럼.”", "“Why forgive before healing? Like this morning's order.”"],
        ["“저 사람에게 직접 말하는구나.”", "“He speaks to the man directly.”"]
      ]),
      { type: "fx", fx: "pinThought", items: ["verse:MT_9_3Q", "choice:c5"] },
      { type: "fx", fx: "readReceipt" },
      { type: "verse", key: "MT_9_4N" },
      { type: "verse", key: "MT_9_4Q" },
      filler("c6", "속생각이 읽혔다. 무슨 생각이 들까?", "Your thought was read. What now?", [1, 1, 2, 3], [
        ["“그래도 내 질문은 정당하다.”", "“My question is still fair.”"],
        ["“소리 내지 않은 생각을 어떻게 아셨지?”", "“How did he know a thought I never spoke?”"],
        ["“악한 생각이라니. 나는 말씀을 지키려 했을 뿐인데.”", "“Evil? I only tried to guard the Word.”"],
        ["“나는 저 사람의 얼굴을 보기도 전에 판단했구나.”", "“I judged before I even saw his face.”"]
      ]),
      { type: "fx", fx: "unpinThought" },
      { type: "verse", key: "MT_9_5" },
      filler("c7", "어느 것이 쉬울까?", "Which is easier?", [1, 1, 2, 3], [
        ["“죄 사함은 증거 없이도 말할 수 있다.”", "“Forgiveness can be claimed without proof.”"],
        ["“걸으라는 말은 거짓이면 바로 드러난다.”", "“'Walk' is exposed at once if false.”"],
        ["“왜 둘을 묶으시지?”", "“Why tie the two together?”"],
        ["“저 사람에겐 둘 다 필요하다.”", "“That man needs both.”"]
      ]),
      { type: "verse", key: "MT_9_6A" },
      filler("c8", "그 선언을 듣고 무슨 생각을 할까?", "What do you make of that claim?", [1, 2, 3, 1], [
        ["“그 권한이 자기에게 있다고 말하는군.”", "“He says the authority is his.”"],
        ["“용서가 먼저, 치유는 그 증거.”", "“Forgiveness first; healing is the proof.”"],
        ["“머리 둘 곳도 없다던 그 사람이.”", "“The one with nowhere to lay his head.”"],
        ["“정확한 말을 기억해 두자.”", "“Remember the exact words.”"]
      ]),
      { type: "verse", key: "MT_9_6N" },
      { type: "fx", fx: "light", level: "bright" },
      { type: "verse", key: "MT_9_6B" },
      { type: "verse", key: "MT_9_7" },
      filler("c9", "므나헴의 눈은 어디로 갈까?", "Where do your eyes go?", [1, 2, 3, 3], [
        ["예수라는 사람을 다시 본다.", "You look at this Jesus again."],
        ["아침의 구절을 속으로 다시 읽는다.", "You reread the morning's verse in your head."],
        ["그 사람의 걸음을 본다.", "You watch the man walk."],
        ["그를 데려온 사람들의 얼굴을 본다.", "You look at the faces of those who carried him."]
      ]),
      { type: "verse", key: "MT_9_8" },
      { type: "fx", fx: "light", level: "off" },
      { type: "scene", bg: "lamp_night", caption: T("밤 · 므나헴의 방", "Night · Menahem's room") },
      filler("c10", "기록장의 마지막 줄에 무엇을 적을까?", "What do you write on the last line of your notes?", [1, 2, 3, 1], [
        ["“그 주장은 받아들일 수 없다. 신성모독.”", "“That claim cannot stand. Blasphemy.”"],
        ["“말씀은 그대로다. 오늘 그 말씀이 한 사람의 입에서 나왔다.”", "“The Word stands. Today it came from one man's mouth.”"],
        ["“그는 그 권한으로 한 사람을 집에 보냈다.”", "“He used that authority to send one man home.”"],
        ["“결론은 비워 둔다. 내일 다시 가겠다.”", "“I leave the conclusion blank. I'll go back tomorrow.”"]
      ])
    ],
    endingPreface: [line("thought", "등잔 심지가 짧아진다.", "The lamp wick burns low.")],
    endings: {
      "1": {
        beats: [
          line(null, "므나헴은 그 주장을 누구보다 정확히 알아들었다.", "Menahem understood the claim more precisely than anyone."),
          line(null, "그는 *신성모독*이라고 적는다. 이 단어는 {{r:MT_26_65}}에서 다시 나온다.", "He writes *blasphemy*. The word returns in {{r:MT_26_65}}.", { when: { all: [{ c10lens: 1 }, { choice: "c10", is: "a" }] } }),
          line(null, "그는 결론 칸을 비워 둔다.", "He leaves the conclusion blank.", { when: { choice: "c10", is: "d" } })
        ],
        last: T("하나님에 대해서는 네가 옳았다. 남은 질문은 그에 대한 것이다.", "About God, you were right. The question left is about him.")
      },
      "2": {
        beats: [line(null, "밤, 시편 103편을 다시 편다. {{v:PS_103_3}}", "At night, you open Psalm 103 again. {{v:PS_103_3}}")],
        last: T("말씀은 바뀌지 않았다. 내 질문이 바뀌었다.", "The Word did not change. My question did.")
      },
      "3": {
        beats: [line(null, "그는 그 권한으로 한 사람을 집에 보냈다.", "With that authority, he sent one man home.")],
        last: T("나는 오늘 율법으로 그 사람을 판단했다. 그는 권한으로 그 사람을 일으켰다.", "Today I judged that man by the Law. He raised him by authority.")
      }
    },
    endingCoda: [line("sign", "― 등잔이 꺼진다 ―", "— the lamp goes out —")]
  };

  // ------------------------------------------------------------------ friend
  var friend = {
    id: "friend",
    beats: [
      { type: "scene", bg: "shore_dawn", caption: T("새벽 · 바닷가", "Dawn · The shore") },
      line(null, "그물을 손질하는데 누군가 외친다.", "You're mending nets when someone shouts."),
      line("partners", "그분이 배로 돌아오신대!", "He's coming back by boat!"),
      filler("c1", "무엇이 먼저 떠오를까?", "What comes to mind first?", [1, 3, 2, 3], [
        ["“폭풍을 말로? 그런 분이라면.”", "“A storm, by a word? If he's like that...”"],
        ["“아셀!” 그물을 내려놓는다.", "“Asher!” You drop the net."],
        ["“가서 아무것도 안 바뀌면, 아셀이 또 무너질 텐데.”", "“If nothing changes, Asher will fall apart again.”"],
        ["“오늘 하루 품삯은 한 데나리온인데({{r:MT_20_2}}).”", "“Today's wage is a denarius ({{r:MT_20_2}}).”"]
      ]),
      { type: "scene", bg: "asher_home", caption: T("아침 · 아셀의 집", "Morning · Asher's house") },
      line("asher", "갔는데 아무것도 안 달라지면?", "What if we go and nothing changes?"),
      filler("c2", "아셀에게 뭐라고 할까?", "What do you tell Asher?", [3, 2, 1, 3], [
        ["“결과는 약속 못 해. 같이 갈 수는 있어.”", "“I can't promise how it ends. I can go with you.”"],
        ["“무엇 때문에 망설이는지 말해 줘.”", "“Tell me what's holding you back.”"],
        ["“그분이라면 할 수 있어.”", "“He can do it.”"],
        ["“싫다고 해도 데려갈 거야.”", "“Even if you say no, I'm taking you.”"]
      ]),
      line("asher", "내가 뭘 잘못해서 이렇게 된 걸까?", "What did I do wrong to end up like this?"),
      choice("c3", "뭐라고 답할까?", "How do you answer?", [
        opt("a", "“너 잘못 아니야.”", "“It's not your fault.”", 1, {
          reaction: [line("asher", "네가 그걸 어떻게 알아?", "How would you know?"), line(null, "요나는 대답하지 못한다.", "Yonah has no answer.")]
        }),
        opt("b", "“내 도움을 받으려고 네 고통을 해명할 필요는 없어.”", "“You don't have to explain your pain to get my help.”", 3),
        opt("c", "“사람들이 너한테 그런 말을 했어?”", "“Did people say that to you?”", 2),
        opt("d", "“왜 이렇게 됐는지는 나도 몰라.”", "“I don't know why this happened either.”", 2)
      ]),
      filler("c4", "침상은 혼자 못 든다. 누구를 부를까?", "You can't carry the bed alone. Who do you call?", [1, 2, 3, 3], [
        ["그물 동료들에게: “오늘 품삯보다 큰일이 있어.”", "To your partners: “There's something bigger than a day's wage.”"],
        ["아셀이 덜 부끄럽도록, 그를 아는 얼굴들만 부른다.", "You call only people he knows, so he feels less ashamed."],
        ["동료들에게 부탁한다. 다들 품삯을 내려놓는다.", "You ask your partners. They all give up the day's wage."],
        ["혼자 업어 보겠다.", "You try to carry him on your back alone."]
      ]),
      choice("c5", "하나만 챙길 수 있다.", "You can bring only one thing.", [
        opt("a", "침상을 단단히 묶을 끈", "Rope to tie the bed tight", null, { set: { item: "rope" } }),
        opt("b", "아셀이 늘 덮던 겉옷", "The cloak Asher always uses", null, { set: { item: "cloak" } }),
        opt("c", "물주머니", "A waterskin", null, { set: { item: "water" } }),
        opt("d", "음식 보따리", "A bundle of food", null, { set: { item: "food" }, reaction: [line("yonah", "돌아와서 같이 먹자.", "We'll eat together when we're back.")] })
      ]),
      { type: "scene", bg: "lane", caption: T("늦은 아침 · 골목", "Late morning · The lane") },
      line(null, "침상이 기운다. 끈이 버텨 준다.", "The bed tilts. The rope holds.", { when: { flag: "item", is: "rope" } }),
      line(null, "사람들 시선이 아셀에게 꽂힌다. 겉옷으로 그를 덮는다.", "Eyes fix on Asher. You cover him with the cloak.", { when: { flag: "item", in: ["cloak"] } }),
      line("passerby", "고통 뒤에 무슨 사연이 있는지 누가 알겠어. 저 사람은 무슨 잘못을 했기에 저렇게 됐을까.", "Who knows what's behind suffering like that. What did he do to end up like that?"),
      choice("c6", "행인의 말이 들린다.", "You hear the passerby.", [
        opt("a", "“우리는 그분께 가는 길이에요.”", "“We're on our way to him.”", 1),
        opt("b", "아셀에게 속삭인다. “신경 쓰지 마. 끝까지 간다.”", "You whisper to Asher, “Ignore him. We're going all the way.”", 2),
        opt("c", "“그걸 어떻게 아세요?” 행인 앞을 막아선다.", "“How would you know?” You step in front of him.", 3),
        opt("d", "침상을 내려놓는다. “…오늘은 안 되겠어.”", "You set the bed down. “...I can't today.”", null, {
          set: { far: true },
          reaction: [line(null, "다른 사람들이 침상을 들고 간다. 요나는 뒤에서 따라간다.", "Others pick up the bed. Yonah follows behind.")]
        })
      ]),
      { type: "scene", bg: "crowd", caption: T("정오 무렵 · 바닷가 공터", "Around noon · Open ground by the shore") },
      { type: "fx", fx: "light", level: "soft" },
      filler("c7", "무리가 많다.", "The crowd is huge.", [1, 2, 3, null], [
        ["“길 좀 비켜 주세요!”", "“Please make way!”"],
        ["아셀에게 묻는다. “어디서 기다리면 편해?”", "You ask Asher, “Where would be easier to wait?”"],
        ["사람들에게 함께 옮겨 달라고 청한다.", "You ask people to help carry him."],
        ["“지붕을 뚫을까?”", "“Should we dig through a roof?”"]
      ]),
      { type: "verse", key: "MT_9_2A" },
      line(null, "그 손들 가운데 네 손이 있다.", "Your hands are among them.", { when: { not: { flag: "far", is: true } } }),
      line(null, "그 손들 가운데 네 손은 없다.", "Your hands are not among them.", { when: { flag: "far", is: true } }),
      { type: "fx", fx: "light", level: "bright" },
      { type: "verse", key: "MT_9_2B" },
      { type: "fx", fx: "light", level: "soft" },
      filler("c8", "기대와 다른 첫마디다.", "Not the first words you expected.", [1, 2, 2, 3], [
        ["“저 말은 하나님만 하실 수 있는 말인데.”", "“Only God can say that.”"],
        ["“왜 그 말부터 하셨지?”", "“Why start with that?”"],
        ["아셀의 얼굴을 본다.", "You look at Asher's face."],
        ["“하지만 우리는 걷게 해 달라고 왔는데.”", "“But we came so he could walk.”"]
      ]),
      line(null, "어떤 서기관들이 굳은 얼굴로 입을 다문다.", "Some scribes go silent, their faces stiff."),
      { type: "verse", key: "MT_9_4N" },
      { type: "verse", key: "MT_9_4Q" },
      line("yonah", "누구한테 하시는 말씀이지? 저 사람들은 아무 말도 안 했는데.", "Who is he talking to? They didn't say anything."),
      { type: "verse", key: "MT_9_6A" },
      { type: "verse", key: "MT_9_6N" },
      { type: "fx", fx: "light", level: "bright" },
      { type: "verse", key: "MT_9_6B" },
      filler("c9", "아셀이 움직인다.", "Asher moves.", [1, 2, 3, 3], [
        ["예수님을 본다. “누구시길래.”", "You look at Jesus. “Who is he?”"],
        ["“손 잡아 줄까?” 하고 묻는다.", "You ask, “Want my hand?”"],
        ["잡아당기지 않고 손만 내민다.", "You hold out your hand without pulling."],
        ["물러서서 아셀이 자기 침상을 들게 한다.", "You step back and let Asher lift his own bed."]
      ]),
      line(null, "물주머니를 걸음에 걸리지 않게 치운다.", "You move the waterskin out of his way.", { when: { all: [{ flag: "item", is: "water" }, { not: { flag: "far", is: true } }] } }),
      line(null, "아셀이 겉옷을 직접 집어 든다.", "Asher picks up the cloak himself.", { when: { any: [{ flag: "item", is: "cloak" }, { choice: "c9", in: ["zzz"] }] } }),
      { type: "verse", key: "MT_9_7" },
      { type: "verse", key: "MT_9_8" },
      { type: "fx", fx: "light", level: "off" },
      { type: "scene", bg: "road_home", caption: T("오후 · 집으로 가는 길", "Afternoon · The road home") },
      line("crowd", "무슨 일이 있었어?", "What happened?"),
      filler("c10", "뭐라고 대답할까?", "What do you say?", [1, 2, 3, 3], [
        ["“그분이 죄를 사하는 권능이 있다고 하셨어.”", "“He said he has authority to forgive sins.”"],
        ["“먼저 죄 사함을 말씀하셨어.”", "“He spoke of forgiveness first.”"],
        ["“못 걷던 애가 걷잖아!”", "“He couldn't walk, and now he's walking!”"],
        ["“본인한테 물어봐.”", "“Ask him yourself.”"]
      ])
    ],
    endingPreface: [
      line(null, "그분은 ‘그들의 믿음’을 보셨다. 그날 그 ‘그들’ 안에 너는 없었다.", "He saw ‘their faith.’ That day, you weren't among ‘them.’", { when: { flag: "far", is: true } })
    ],
    endings: {
      "1": {
        beats: [
          line(null, "우리는 다리를 구하러 갔다.", "We went asking for legs."),
          line(null, "아침에 “너 잘못 아니야”라고밖에 못 했던 일이 떠오른다.", "You remember that all you could say this morning was “It's not your fault.”", { when: { choice: "c3", is: "a" } })
        ],
        last: T("우리는 걷게 해 달라고 했다. 그분은 그보다 깊은 데서 시작하셨다.", "We asked for walking. He started somewhere deeper.")
      },
      "2": {
        beats: [line("yonah", "맞아. 하지만 그게 첫 말씀은 아니었어.", "Right. But that wasn't the first thing he said.")],
        last: T("그분은 다리보다 먼저, 아셀이 가장 무서워하던 질문에 답하셨다.", "Before his legs, he answered the question Asher feared most.")
      },
      "3": {
        beats: [
          line(null, "요나는 처음으로 빈손으로 그 옆을 걷는다.", "For the first time, Yonah walks beside him empty-handed."),
          line(null, "그날 저녁, 그 보따리를 아셀의 집에서 같이 푼다.", "That evening, you open the bundle together at Asher's house.", { when: { flag: "item", is: "food" } })
        ],
        last: T("너는 그를 여기까지 들고 왔다. 집까지는 그가 침상을 들고 갔다.", "You carried him this far. He carried the bed home.")
      }
    }
  };

  // ------------------------------------------------------------------ asher
  var asher = {
    id: "asher",
    actions: [
      { id: "getup", label: T("일어나기", "Get up"), replies: [T("다리가 대답하지 않는다.", "Your legs don't answer."), T("여전히.", "Still nothing."), T("네 해째다.", "Four years now.")], counter: "getup_count" },
      { id: "goout", label: T("밖으로", "Go out"), replies: [T("문까지가 너무 멀다.", "The door is too far.")], counter: "goout_count" }
    ],
    beats: [
      { type: "scene", bg: "asher_ceiling", pov: "lying", caption: T("새벽 · 아셀의 집", "Dawn · Asher's house") },
      line(null, "서까래. 갈대와 진흙 지붕. 문틈의 빛.", "Rafters. A roof of reeds and mud. Light at the door."),
      filler("c1", "오늘은 어느 기도로 시작할까?", "Which prayer do you start with today?", [2, 2, 1, 1], [
        ["{{v:PS_103_3}}", "{{v:PS_103_3}}"],
        ["시편 41편의 기도 ({{r:PS_41_4}})", "The prayer of Psalm 41 ({{r:PS_41_4}})"],
        ["원망도 하나님을 향한 말이다.", "Even a complaint is spoken to God."],
        ["용서와 치유를 노래하는 시편", "The psalm of forgiving and healing"]
      ]),
      filler("c2", "어느 소리에 귀를 기울일까?", "Which sound do you listen to?", [3, 3, 3, 2], [
        ["어머니가 물 긷는 소리", "Mom drawing water"],
        ["문틈으로 들어오는 바닷바람", "Sea wind through the door"],
        ["문 앞에서 노는 동생의 목소리", "Your little brother playing by the door"],
        ["우물가의 수군거림", "Whispers at the well"]
      ]),
      filler("c3", "기억 하나가 떠오른다.", "A memory surfaces.", [2, 2, 1, 3], [
        ["“혹시 그 일 때문에 이렇게 된 걸까.”", "“Is that why I ended up like this?”"],
        ["“잘못한 것과 병든 것은 같은 이야기일까.”", "“Are doing wrong and getting sick the same story?”"],
        ["“그 잘못은 누가 용서해 줄 수 있지?”", "“Who can forgive that?”"],
        ["“오늘은 동생에게 먼저 말을 걸어 봐야겠다.”", "“Today I'll talk to my brother first.”"]
      ]),
      { type: "fx", fx: "actionReply", action: "goout", text: T("요나가 오는 소리가 들린다.", "You hear Yonah coming.") },
      line("yonah", "그분이 돌아오셨어. 가자!", "He's back. Let's go!"),
      filler("c4", "요나에게 뭐라고 할까?", "What do you tell Yonah?", [2, 1, 2, 3], [
        ["“가고 싶어. 근데 겁나.”", "“I want to go. But I'm scared.”"],
        ["“그분이 어떤 분인데?”", "“What is he like?”"],
        ["“싫어. 이 꼴로 나가기 싫어.”", "“No. Not like this.”"],
        ["“내 겉옷 좀 줘. 그리고 가자.”", "“Hand me my cloak. Then let's go.”"]
      ]),
      line("sign", "네가 망설여도, 사람들이 너를 든다.", "Even if you hesitate, they lift you."),
      { type: "scene", bg: "sky_carried", caption: T("늦은 아침 · 골목", "Late morning · The lane") },
      filler("c5", "몇 해 만의 하늘이다.", "The first sky in years.", [2, 3, 3, 1], [
        ["“내가 뭔가 했다는 뜻이겠지.”", "“He means I did something.”"],
        ["“저 사람은 내 삶을 몰라.”", "“He doesn't know my life.”"],
        ["요나에게 묻는다. “방금 들었어?”", "You ask Yonah, “Did you hear that?”"],
        ["“하늘이 이렇게 넓었나.”", "“Was the sky always this wide?”"]
      ]),
      { type: "fx", fx: "actionsHide" },
      { type: "scene", bg: "crowd_lying", caption: T("정오 무렵 · 그분 앞", "Around noon · Before Jesus") },
      { type: "fx", fx: "light", level: "soft" },
      filler("c6", "무슨 말을 하려 했나?", "What were you going to say?", [3, 3, 2, 1], [
        ["“저를 도와주세요.”", "“Please help me.”"],
        ["“걷고 싶습니다.”", "“I want to walk.”"],
        ["“저는 하나님께 버림받은 건가요?”", "“Has God abandoned me?”"],
        ["“당신은 누구십니까?”", "“Who are you?”"]
      ]),
      { type: "fx", fx: "actionsShow" },
      { type: "fx", fx: "light", level: "bright" },
      { type: "verse", key: "MT_9_2B1" },
      filler("c7", "“작은 자야”", "“My son”", [2, 2, 3, 1], [
        ["“나에 대해 말하는 게 아니라, 나에게 말씀하신다.”", "“He isn't talking about me. He's talking to me.”"],
        ["“내가 얼마나 무서운지 아시는 걸까.”", "“Does he know how scared I am?”"],
        ["“아이를 부르듯 부르셨어.”", "“He called me like a child.”"],
        ["“다음 말을 듣고 싶다.”", "“I want to hear what comes next.”"]
      ]),
      { type: "verse", key: "MT_9_2B2" },
      filler("c8", "네 죄 사함을 받았느니라.", "Your sins are forgiven.", [2, 2, 3, 1], [
        ["“그럼 병이 내 잘못이었다는 뜻인가?”", "“Then was the sickness my fault?”"],
        ["“정말 나에게 하시는 말씀인가.”", "“Is he really saying this to me?”"],
        ["“하지만 나는 아직 누워 있는데.”", "“But I'm still lying here.”"],
        ["“누가 이렇게 확실하게 말할 수 있지?”", "“Who can say this so surely?”"]
      ]),
      { type: "fx", fx: "light", level: "soft" },
      { type: "verse", key: "MT_9_6A" },
      { type: "fx", fx: "light", level: "bright" },
      { type: "verse", key: "MT_9_6B" },
      { type: "press", action: "getup", hint: T("일어나기", "Get up") },
      { type: "fx", fx: "pov", pov: "standing" },
      { type: "scene", bg: "crowd", caption: T("정오 무렵 · 바닷가 공터", "Around noon · Open ground by the shore") },
      filler("c9", "가장 먼저 든 생각은?", "Your very first thought?", [1, 2, 3, 3], [
        ["“이분은 누구시길래.”", "“Who is he?”"],
        ["“일어나기 전에 먼저 하신 말이 있었다.”", "“He said something before I stood.”"],
        ["“이게 나를 싣고 다니던 침상이다.”", "“This is the bed that carried me.”"],
        ["“친구들이 나를 올려다보고 있다.”", "“My friends are looking up at me.”"]
      ]),
      { type: "press", label: T("침상을 들어", "Pick up your bed") },
      { type: "press", label: T("집으로", "Go home") },
      { type: "verse", key: "MT_9_7" },
      { type: "fx", fx: "light", level: "off" },
      { type: "scene", bg: "doorway_evening", caption: T("저녁 · 아셀의 집 앞", "Evening · Asher's doorway") },
      filler("c10", "어머니에게 첫마디를 한다.", "Your first words to Mom.", [1, 2, 3, 2], [
        ["“어머니, 그분이 누구신지 알아야겠어요.”", "“Mom, I need to know who he is.”"],
        ["“어머니, 그분이 제 죄가 사함을 받았대요.”", "“Mom, he said my sins are forgiven.”"],
        ["“어머니, 저 걸어요!”", "“Mom, I'm walking!”"],
        ["“옆에 앉아 주세요. 처음부터 말하고 싶어요.”", "“Sit with me. I want to tell it from the start.”"]
      ])
    ],
    endings: {
      "1": { beats: [line(null, "오늘 밤 아셀은 처음으로 그분을 생각하며 잠든다.", "Tonight, for the first time, Asher falls asleep thinking about him.")], last: T("다리를 고칠 분을 만나러 갔다. 죄를 사하는 분을 만나고 왔다.", "I went to meet someone who could heal legs. I came back from meeting the one who forgives sins.") },
      "2": { beats: [line(null, "아셀은 누워 있던 자기에게 그분이 말을 거신 순간부터 이야기를 시작한다.", "Asher starts the story at the moment he spoke to him lying there.")], last: T("왜 병들었는지는 모른다. 오늘 그분이 나에게 하신 말씀은 안다.", "I don't know why I got sick. I know what he said to me today.") },
      "3": { beats: [line(null, "아침에 누워서 듣던 그 소리를, 지금은 서서 듣는다.", "The sound you heard lying down this morning, you now hear standing.")], last: T("너를 들고 다니던 침상을, 이제 네가 들고 문을 연다.", "The bed that carried you, you now carry as you open the door.") }
    },
    endingCoda: [line("sign", "일어나기 시도 {{var:getup_count}}번", "Tried to get up {{var:getup_count}} times")]
  };

  if (force || !BHS.routes.scribe) BHS.routes.scribe = scribe;
  if (force || !BHS.routes.friend) BHS.routes.friend = friend;
  if (force || !BHS.routes.asher) BHS.routes.asher = asher;
  BHS.fixtureRoutes = { scribe: scribe, friend: friend, asher: asher };
})();
