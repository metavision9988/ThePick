# promo-1st P4 프론트엔드 — 구현 원장 (디자인 매핑 + 위임 결정 기록)

- **작성**: 2026-07-10 (Fable 5). 스코프 정본 = `docs/plans/promo-1st-free-service-scope-20260708.md` §P4 + 핸드오프 `.jjokjipge/handoff-promo-1st-p4-20260710.md`.
- **거버넌스**: 2026-07-08 진산 위임 체제 — 갈림길 = 위임 결정 기록 후 바로 구현, 진산 사후 거부권.

## 1. 디자인 입력 흡수 결과 (토큰·컴포넌트 매핑)

정본 시각 언어 = `docs/design/claudeDesign/`(shared.jsx + 화면 5종 + app.jsx 토큰 명세). AESTHETIC.md 와 완전 정합(1강조색·플랫·얇은 보더·rx8·리스트 우선).

### 1.1 토큰 (Tailwind 매핑)

| 축        | 값                                                                                          | 이식 위치                                     |
| :-------- | :------------------------------------------------------------------------------------------ | :-------------------------------------------- |
| 주색      | indigo-600 `#4f46e5` (hover 700, focus ring indigo-200/500, deep `#1e40af`)                 | 유틸 클래스 (기존 관례 유지)                  |
| 강조      | amber-500/100 — **화면당 1곳**                                                              | 〃                                            |
| 정오 표식 | 내 답 맞음=indigo 좌보더 / 내 답 틀림=amber 좌보더+bg+X / 정답 표식=emerald 좌보더+bg+Check | ChoiceRow 상태 계약                           |
| 회색      | gray 9단계, 배경 3층: gray-50 → white 카드 → gray-50 결과패널                               | 〃                                            |
| 서체      | Pretendard 400/500 (**700 금지**), 본문 lh 1.7 / 제목 1.3, 수치 tabular-nums                | tailwind.config fontFamily + 전역 CSS         |
| 반경/보더 | rounded-lg(8px)·rounded-full 만, 보더 1px gray-200 (강조 좌보더 2px), **그림자 금지**       | 컴포넌트 관례                                 |
| 터치      | 인터랙티브 min 44px (주버튼 48~52)                                                          | 인라인 minHeight (전역 CSS 텍스트 input 보강) |
| 금지      | 그라디언트·신호등 정오색·트로피/폭죽·과장 카피("잘했어요!")·이모지 장식·bold 700            | 전 화면                                       |

### 1.2 컴포넌트 매핑 (시안 → 구현)

| 시안 (claudeDesign)          | P4 구현                                     | 비고                                            |
| :--------------------------- | :------------------------------------------ | :---------------------------------------------- |
| QuestionCard A/B/C           | `public/PublicQuestionCard.tsx` (FE-2)      | A 골격 + C 의 상단 진행 스트립 채택             |
| ChoiceRow (원문자 ①~⑤)       | `public/ChoiceRow.tsx`                      | choiceId 계약 ({label} 아님 — 공개 API 형태)    |
| ResultBlock                  | `public/ResultBlock.tsx`                    | 해설 없으면 필드 생략(빈 상태)                  |
| ModeSelector A               | `public/PracticePicker.tsx` (FE-3)          | 모드=4지선다/빵꾸노트/카드플립 + 과목/회차 필터 |
| SessionSummary A + Sparkline | `public/PracticeSummary.tsx` (FE-8 포함)    | canvas 공유 이미지 = `share-image.ts`           |
| ProgressViz C (30일 dot)     | `public/StreakPanel.tsx` (FE-7)             | local-progress getStreak + reviews 버킷         |
| MODES 토큰                   | 공개 표면 모드 상수 (`public/constants.ts`) | warmup/main 대신 mc/blank/flip 3모드            |

기존 인증 컴포넌트(`MultipleChoice.tsx` 등)는 **불변** — 공개 표면은 choices 형태({choiceId,text})와 API 가 달라 `components/public/` 신설(복붙 아닌 시각 계약 공유, 인증 경로 회귀 0).

## 2. 위임 결정 기록 (재논의 금지 — 진산 사후 거부권)

| #     | 결정                                                                                                                                                                                                                     | 사유 / 기각 대안                                                                                                                                                                                                                                                                                                                                     |
| :---- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P4-D1 | **additive `POST /api/public/reveal`** {questionId} → {correctAnswer, explanation?, correctChoiceIds?} + AE **'card' 이벤트** 기록                                                                                       | FE-5 플립 뒷면·FE-4 힌트 사다리가 정답 파생 필요. `/grade` 가 이미 동일 정보 노출 = 신규 유출 표면 0(동일 rate limit·경계 강제). carry-over "'card' AE 배선" 동시 해소. 기각: (a) `/grade` 더미 답 전송(지표 오염·MC 는 choiceId 강제) (b) 서빙 projection 에 힌트 동봉(정답 부분 유출 상시화 — drip 제어 위반)                                      |
| P4-D2 | **FE-1 랜딩 = B안** (정적 소개 + 라이브 1문항 인라인 체험). 임베드 실패 시 CTA-only 정적 축퇴                                                                                                                            | 방문자가 클릭 0회로 실기출 체험(홍보 전환 핵심) + 정적 SEO/OG 표면 유지. 기각 A(교과서: 체험까지 클릭 1회, 실증 없이 설명만) / 기각 C(제품=랜딩 급진: SEO·OG 약화, NO_QUESTION 시 랜딩 공동화, AESTHETIC "급진 목업 함정" 전례)                                                                                                                      |
| P4-D3 | **FE-5 플립 콘텐츠 = MC 포함** (앞면=문항+보기 → 머릿속 선택 → 플립=정답 보기 하이라이트+해설 → 4버튼 자평). fill_blank 도 지원(앞=문항, 뒤=correctAnswer)                                                               | ★production 실측: 라이브 서빙 가능 = **MC 521 뿐** (fill_blank 525 전부 위치라벨 정답 = isServable 거부). 기각: fill_blank 전용(라이브 빈 상태로 기능 사장)                                                                                                                                                                                          |
| P4-D4 | **FSRS rating 매핑** — MC 자동기록: 맞음→3(good)/틀림→1(again), isCorrect 동봉. 빵꾸노트: 틀림→1 / 맞음·힌트0→3 / 맞음·힌트≥1→2(hard). 플립: 4버튼 직접(1~4), isCorrect=null                                             | M9 "사용 힌트 수를 FSRS 간격에 반영" 이행. 4(easy)는 자평 전용 — 자동 채점이 easy 를 주지 않음(과대 간격 방지). 기각: 힌트 수 비례 감점 세분(근거 데이터 없이 과설계)                                                                                                                                                                                |
| P4-D5 | 라우트 `/practice/` 신설 + `index.astro` 랜딩 재작성. `astro.config` site = env `PUBLIC_SITE_URL` ?? `https://thepick-study.pages.dev`(G-5). OG 이미지 = 기존 icon-512                                                   | 전용 OG 이미지는 P5 배포 시점 검토(현 정적 자산 재사용이 정직). sitemap.xml/robots.txt 정적 추가                                                                                                                                                                                                                                                     |
| P4-D6 | **i18n**: 지배 관례(한국어 상수) 준수 + 공개 API 에러코드→사용자 문구 **단일 매핑 모듈**(`public/api.ts`)                                                                                                                | carry-over "i18n 오류코드 매핑" 해소. 전면 I18nProvider 전환은 별도 트랙(현 사용처 2곳뿐 — 과설계 회피)                                                                                                                                                                                                                                              |
| P4-D7 | **sw.js: `/api/public/` → NetworkOnly** + CACHE_VERSION bump                                                                                                                                                             | 현 SWR 버킷이 랜덤 서빙 `/next` 를 캐시 — 같은 문항 재서빙 부작용. 채점·공개 표면은 캐시 부적합                                                                                                                                                                                                                                                      |
| P4-D8 | **Pretendard 자가호스팅 2단 서브셋** (`public/fonts/` — main 505KB=라틴+기호+KS X 1001 상용 2,350자 preload / ext 1.3MB=잔여 음절 8,822자 unicode-range 요청 시 로드, `pretendard.css` @font-face 2단·font-display swap) | 4-Pass MAJOR-1/3/4 해소: 제3자 jsdelivr CDN = Cloudflare 단일 벤더 위반 + SRI 부재 + SW 오프라인 캐시 불가 + 랜딩 LCP 서드파티 결합. 기각: (a) CDN 유지+preconnect(원칙 위반 존속) (b) 전량 단일 파일(1.8MB 첫 로드 과중) (c) 시스템 폰트 폴백만(디자인 정본 서체 명세 위반). 재생성 = pyftsubset(fonttools), 소스 = pretendard v1.3.9 (SIL OFL 1.1) |

## 3. 정직 보고 (스코프 사실)

- **빵꾸노트(FE-4) 라이브 데이터 = 0**: fill_blank 서빙 자격 문항이 production 에 없음(위 P4-D3). 화면·mock·테스트는 완비하되 라이브는 빈 상태(NO_QUESTION 안내)로 동작 — fill_blank 콘텐츠 승급은 후속 콘텐츠 트랙. **무음 아님 — 최종 보고에 명시.**
- `/api/public/*` 는 여전히 미배포(라이브 404) — P5 배포 게이트. P4 는 mock + 로컬 dev 로 검증.

## 4. FE-1 랜딩 3안 (G-7 — 자체 선정, 기각안 근거 §2 P4-D2)

- **A (교과서)**: 좌정렬 720px 단일 컬럼. 로고+로그인 헤더 / 평서체 H1("손해평가사 1차, 기출로 시작한다") / 주 CTA 1개("바로 풀어보기 — 가입 없음 · 무료") / 실데이터 수치 리스트(7회분·MC 521·3과목) / 학습 모드 3종 리스트(좌 2px 컬러 보더).
- **B (밀도·채택)**: A 구조 + **라이브 문항 1개 인라인 임베드**("지금 바로 한 문제") — PublicQuestionCard 재사용, 풀면 "계속 풀기 → /practice/". API 실패 시 임베드 섹션 자동 축퇴.
- **C (급진)**: 랜딩 = 문제 그 자체(헤더 최소, 화면 주인 = 라이브 문항, 마케팅 표면 제거).

## 5. 구현 파일 계획

- api: `public/routes.ts` +`/reveal` · `__tests__/routes.test.ts` 회귀+신규
- web 신규: `components/public/{types,api,constants}.ts` · `PublicPracticeApp/PracticePicker/PublicQuestionCard/ChoiceRow/ResultBlock/BlankNote/FlipDeck/StreakPanel/PracticeSummary}.tsx` · `lib/hangul-hint.ts`(초성 등 순수 파생) · `lib/share-image.ts`(canvas) · `pages/practice.astro` · `pages/index.astro` 재작성 · `public/{robots.txt,sitemap.xml}` · sw.js·BaseLayout·tailwind.config·astro.config 갱신
- 테스트: web 유닛(힌트 파생·rating 매핑·ChoiceRow 상태·api 매핑) + mock server `/api/public/*` 핸들러·픽스처 + E2E 공개 플로우 스모크

Binary Gate: `pnpm --filter @thepick/web build`(m-8) + typecheck + lint + web/api 테스트 회귀 0 → 독립 4-Pass(CRITICAL 0) → 커밋·push.

## 6. 독립 4-Pass 리뷰 처분 (2026-07-10, `review-20260710-102835-4pass-changes.md`)

- **결과**: CRITICAL 0 / MAJOR 4 / MINOR 24 (11 에이전트, 발견별 적대 반증 — 강등 1·격추 반영 후).
- **MAJOR 전건 즉시 수정**: ①②③ Pretendard CDN 동일근원 3렌즈 → **P4-D8 자가호스팅 집행**(preload+2단 서브셋, CDN 링크 제거) / ④ FlipDeck 전역 Space 키가 포커스된 '건너뜀' 버튼 표준 활성화 가로채기 → 버튼/링크 포커스 시 비개입 가드(PublicQuestionCard 숫자 키에도 동형 적용).
- **MINOR 즉시 수정 5**: 복수정답 시 나머지 정답 보기 표식 유지(gradeStateOf) / PracticeSummary 공유 실패 'busy' 고착 → try-catch 'failed' 전이 / fetchNext 세션 세대 가드(in-flight 응답 착지 차단) / StreakPanel 최고칸 KST 경계 +1일 조회 / (키 핸들러 통일 — MAJOR-2 에 포함).
- **MINOR 잔여 처분**: 보고서 §처분 매트릭스 등재 — 핵심: API_BASE localhost 무음 폴백(선재 5파일 공통 패턴) = **P5 배포 Binary Gate 에 PUBLIC_API_BASE_URL 검증 명기**(일괄 카드) / JWT_SECRET 회전 in-flight 오채점 창(MINOR-12 강등 유지) = 운영 원장 1줄(회전 배포 시 공개 표면 고지) / sw.js syncOfflineActions stub = 기존 RC-3 원장 유지. 나머지 = 보고서 기록 보존(후속 재량).

## 7. 5-페르소나 기술부채 리뷰 처분 (2026-07-10, `phaseN-tech-debt-20260710-105821-INDEX.md`)

결과: **CRITICAL 1(C-1) / MAJOR 19 / MINOR 11**, 진앙 클러스터 RC-1~RC-5.

- **C-1 즉시 처분 완료** (old↔-MC 이중 진실 행 — 오답 36 포함 old 525행이 **인증** 학습 경로에서 무가드 서빙·fill_blank fallback 오채점, 공개 표면 fail-safe 의 인증판 부재 비대칭):
  - ③ **서빙·채점 가드 이식**: `apps/api/src/study/serving-guard.ts` `isMisgradableRow` — /next 오버샘플(×3) 후 필터 + /grade 422 QUESTION_NOT_GRADABLE. ★**1차 한정**(1차=전 문항 객관식 → fill_blank+위치라벨=확정 MC-in-disguise / 2차는 텍스트·수치 정답이 우연히 숫자일 수 있어 비대상 — 무분별 적용 시 기존 2차 계약 테스트 37건 파손 실측으로 확정).
  - ① **회귀 테스트 4건**: old 행 /next 제외·유자격 0 시 정직 exhausted·/grade 422·비대상(1차 MC/2차 fill_blank) 불변. api 101/101.
  - ② old 행 처분 상태머신 마이그 = **L3, 인증 1차 학습 표면 오픈 선결 게이트로 승격 기록**(자율 금지 — 진산 결재. incident-1st-answer-errors-20260710.md 연계). 본 가드가 그 전까지의 fail-safe.
- **MAJOR 즉시 처분 1**: RC-4 LandingEmbed `client:visible`(below-fold hydration — 랜딩 LCP 보호).
- **MAJOR 명시 이월 18** (진앙별 지정 트랙):
  - **RC-1 잔여**(M-5 answer-sync 워터마크·M-9/12/15 통계 이중 계상 등) → old 행 처분 L3 plan 에 동승(위 ② 게이트).
  - **RC-2**(M-1 public queries examId wrapper·Rule 16/17) → **M1 exams/ 골격 plan 편승**(`m1-exams-scaffold-shared-detox.plan.md`).
  - **RC-3**(M-14/16~19 알림 1채널·smoke-public-surface·DR runbook·결함 텔레메트리) → **P5 배포 체크리스트 blocking 항목**으로 승격.
  - **RC-4 잔여**(M-8/10/11 random_key 마이그+인덱스+exclude 파라미터) → L3 마이그 슬롯(old 행 처분 마이그와 동승 검토).
  - **RC-5**(M-2/3/4/6/7/13 공개 계약 타입 shared 단일화·schema.ts 라벨 동기·/api/public/meta) → P5 전 정리 카드.

## 8. P5 — 지형도·지표·배포 (2026-07-10, 본 원장 연속 사용)

### 8.1 위임 결정 기록 (P5)

| #     | 결정                                                                                                                                                       | 사유 / 기각 대안                                                                                                                                                                                                                                                                                       |
| :---- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P5-D1 | **Web Analytics = env 주입 수동 비콘** (BaseLayout, `PUBLIC_CF_BEACON_TOKEN` 설정 시에만 출력 + 배포 스크립트가 미설정 경고 표면화). SRI 미적용(사유 주석) | 스코프 문면 "Pages 스니펫"의 대시보드 자동 주입은 콘솔 행위 의존(G-8 최소화 원칙) + 코드 불가시·재현 불가. env 비콘 = 코드로 재현 가능·토큰만 진산 1줄 행위. 기각: (a) Pages 자동 스니펫(콘솔 토글 — 코드 0줄이지만 IaC 불가) (b) 미구현(지표 원천 부재). **4-Pass MAJOR-5(위임 기록 부재) 해소 기록** |
| P5-D2 | **지형도 v1 = MOC 아웃라인**(과목→회차→문항수, 회차 탭=필터 세션). overview 만 200 한정 공용 캐시 5분                                                      | 지형도 방법론 모바일 기본값 = 그래프 아닌 아웃라인 + G-4 기출-only(노드 축 없음). D3 그래프는 노드 축 확보 후(후속 트랙)                                                                                                                                                                               |

### 8.2 P5 4-Pass 처분 (`review-20260710-140338-4pass-changes.md`)

- **결과**: CRITICAL 0 / MAJOR 6(실질 4 — 2쌍은 동일 결함 독립 재발견) / MINOR 16.
- **MAJOR 즉시 수정**: ①③ overview 캐시 carve-out 이 429/500 에도 public 5분 스탬프 → **200 한정 게이트** / ②④ 공개 표면 캐시 경계 단위 테스트 0 → **회귀 3건 신설**(overview 200 공용·비-200 no-store·next/grade/reveal no-store = 지뢰 #5 기계 차단) / ⑤ 비콘 위임 기록 부재 → **P5-D1 등재** / ⑥ RC-5 무언 미이행+overview 계약 3곳 중복 확대 → **정직 기록**: RC-5 정리 카드(공개 계약 타입 shared 단일화)는 미이행 상태이며 overview 로 중복 +1 — **카드 스코프에 overview 포함해 이월**(P5 배포를 막지 않되 은폐 없음).
- **MINOR 즉시 수정 4**: 스모크 fetch 타임아웃 15s / mock overview total 파생 계산(불변식 고정) / PracticeMap key sentinel / defectReason 정직 라벨(`mc_in_disguise_or_numeric_short_answer` — 진성 숫자 단답 무구분 명시). 잔여 12 = 보고서 기록 보존.
