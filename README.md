# 그가 일어나기 전 · Before He Stood

마태복음 9:1–8을 세 인물의 눈으로 보는 한영 비주얼노벨이에요. 중고등부 20분 수업용으로 만들었어요.

A bilingual (Korean/English) visual novel on Matthew 9:1–8, made for a 20-minute youth Sunday school lesson.

- **플레이:** https://bagmk.github.io/before-he-stood/
- **오프라인:** 폴더의 `index.html`을 더블클릭하면 인터넷 없이 실행돼요. 파일 하나로 공유하려면 `dist/before-he-stood.html`을 보내면 돼요.

## TV로 함께 할 때

- 컴퓨터에서 주소를 열고 `F`(또는 오른쪽 위 전체 화면 버튼)로 전체 화면을 켜요. 언어는 「함께 보기」를 고르면 한국어와 영어가 같이 나와요.
- 다음으로: `Space` · `Enter` · `→` · `↓` · `PageDown` (프레젠테이션 리모컨도 돼요)
- 보기 고르기: `1`–`4` (또는 `A`–`D`)
- 메뉴: `Esc`

## 어떤 게임인가요

학생마다 한 인물을 골라 자기 폰으로 약 9분 동안 플레이해요.

| 인물 | 루트 제목 |
| --- | --- |
| 서기관 므나헴 | 아침에 읽은 문장 |
| 친구 요나 | 침상의 귀퉁이 |
| 침상의 아셀 | 나를 뭐라고 부르셨지 |

- 인물마다 선택 10번(보기 4개), 엔딩 3개, 모두 9개 엔딩이에요.
- 선택은 성경의 사건을 바꾸지 않아요. 그 사건을 듣는 마음을 바꿔요.
- 엔딩은 세 가지 눈(누가? · 왜 먼저? · 어디로?)으로 나뉘고, 등급이 없어요. 플레이 뒤에 반 전체가 3×3 엔딩 판을 함께 채워요.
- 예수님의 말씀은 개역개정과 ESV 본문 그대로만 나와요.

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
tools/                검사, 단일 파일 빌드 도구
```

## 내용을 고치려면

- 대사는 `data/routes/*.js`에서 고쳐요. 모든 문장이 `{ ko: "...", en: "..." }` 형태예요.
- 성경 구절은 문장에 직접 쓰지 않고 `{{v:KEY}}` 토큰으로 불러와요. 본문은 `data/scripture.js` 한 곳에만 있어요.
- 고친 뒤 검사: `node tools/validate.mjs`
- 단일 파일 다시 만들기: `node tools/build-single.mjs`

## 출처

성경 본문: 성경전서 개역개정판 © 대한성서공회. Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.

인물의 이름, 가족, 대화, 이전 이야기와 결말은 창작이에요.
