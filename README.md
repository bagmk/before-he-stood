# 그가 일어나기 전 · Before He Stood

마태복음 9:1–8을 세 인물의 눈으로 보는 한영 비주얼노벨이에요. 중고등부 20분 수업에서 TV 한 대로 반 전체가 세 인물을 차례로 함께 플레이하도록 만들었어요.

A bilingual (Korean/English) visual novel on Matthew 9:1–8. A youth class plays all three characters together on one TV in a 20-minute lesson.

- **플레이:** https://bagmk.github.io/before-he-stood/
- **오프라인:** 폴더의 `index.html`을 더블클릭하면 인터넷 없이 실행돼요. 파일 하나로 공유하려면 `dist/before-he-stood.html`을 보내면 돼요.

## TV로 함께 할 때

- 컴퓨터에서 주소를 열고 `F`(또는 오른쪽 위 전체 화면 버튼)로 전체 화면을 켜요. 언어는 「함께 보기」를 고르면 한국어와 영어가 같이 나와요.
- 다음으로: `Space` · `Enter` · `→` · `↓` · `PageDown` (프레젠테이션 리모컨도 돼요)
- 보기 고르기: `1`–`4` (또는 `A`–`D`)
- 메뉴: `Esc`
- 폰에서도 세로 화면으로 플레이할 수 있어요.

## 어떤 게임인가요

인물 하나에 약 5분이에요. 세 인물을 차례로 하면 15분 남짓이에요.

| 인물 | 루트 제목 |
| --- | --- |
| 서기관 므나헴 | 아침에 읽은 문장 |
| 친구 요나 | 침상의 귀퉁이 |
| 침상의 아셀 | 나를 뭐라고 부르셨지 |

- 인물마다 선택 4번(보기 4개)이에요. 마지막 선택은 두 배로 계산돼요.
- 엔딩은 세 가지 눈(누가? · 왜 먼저? · 어디로?)으로 나뉘고, 등급이 없어요.
- 서기관과 친구에게는 길이 중간에 끝나는 보기가 하나씩 있어요. 사건은 그대로 일어나지만 그 사람은 그 자리에 없어요. 아셀에게는 그런 보기가 없어요. 아셀은 걸어서 떠날 수 없었으니까요.
- 엔딩 갤러리는 인물 3 × (세 가지 눈 + 중간에 끝남) 판이에요.
- 선택은 성경의 사건을 바꾸지 않아요. 그 사건을 듣는 마음을 바꿔요.
- 예수님의 말씀은 개역개정과 ESV 본문 그대로만 나와요. 얼굴은 그리지 않고 빛으로만 보여요.

## 폴더 구조

```
index.html            게임
data/                 이야기와 본문 (여기만 고치면 내용이 바뀌어요)
  meta.js             제목, 세 가지 눈, 엔딩 제목
  characters.js       인물 이름과 색
  scripture.js        성경 본문 (개역개정, ESV)
  common.js           프롤로그, 인물 선택 질문 등 공통 문장
  routes/*.js         세 인물의 대본
js/, css/             엔진, 화면, 배경 그림
docs/                 설계 문서와 시나리오 원문
tools/                검사, 단일 파일 빌드, 자동 플레이 검사 도구
dist/                 파일 하나로 된 게임
```

## 내용을 고치려면

- 대사는 `data/routes/*.js`에서 고쳐요. 모든 문장이 `{ ko: "...", en: "..." }` 형태예요.
- 성경 구절은 문장에 직접 쓰지 않고 `{{v:KEY}}` 토큰으로 불러와요. 본문은 `data/scripture.js` 한 곳에만 있어요.
- 고친 뒤 검사: `node tools/validate.mjs`
- 단일 파일 다시 만들기: `node tools/build-single.mjs`
- 자동 플레이 검사(선택): `node tools/playtest.mjs` (Playwright 필요)

## 출처

성경 본문: 성경전서 개역개정판 © 대한성서공회. Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.

인물의 이름, 가족, 대화, 이전 이야기와 결말은 창작이에요.
