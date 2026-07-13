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

### 8.2b P5 5-페르소나 기술부채 리뷰 처분 (2026-07-10, `phaseN-tech-debt-20260710-143321-INDEX.md`)

결과: **CRITICAL 3 / MAJOR 18 / MINOR 15**, 진앙 RC-1~RC-6.

- **CRITICAL 전건 즉시 처분**:
  - **D-01** web 유닛 74 가 CI 미배선(WS-0a 151 테스트 사고 동일 클래스 재발) → ci.yml test 필터에 `@thepick/web` 추가.
  - **D-02** ★실버그(당일 C-1 가드의 파생): 인증 `/next` 미시도-우선 정렬에서 영구 미서빙 old 행이 오버샘플 창을 점차 독점 → 유자격 문항 잔존한데 **조기 거짓 exhausted**(도그푸딩 세션 문항 2~14개 후 재현) → **2-pass 적응형 전 풀 재조회**(창 고갈 시에만 rows_read 비용 — 정본 해소는 old 행 처분 L3 마이그) + 재현 회귀 테스트. api 재배포 필요(아래 8.3b).
  - **D-03** D1 DR = Time Travel 30일 단일 의존 → **첫 오프사이트 백업 실물**(R2 `thepick-backups/d1/production/20260710T054633Z.sql` 2.8MB) + `scripts/backup-d1-to-r2.sh`(크기 하한 가드) + 런북 §10(복구 경로·RPO/RTO). 주간 자동화 = CLOUDFLARE_API_TOKEN 시크릿(진산 1줄) 후 GH Actions 배선 이월 — 그 전까지 production 쓰기 작업 직전 수동 실행 의무.
- **MAJOR 18 명시 이월(진앙별)**: RC-1(old 행 파생 부채군)·RC-2(서빙 자격 술어 2종 분산 — isServable↔isMisgradableRow 통합) = **old 행 처분 L3 plan 동승** / RC-3(exam 축·계약 선언 분산) = **RC-5 카드+M1 plan** / RC-4(배포 스모크 CI 미배선) = **GH Actions 배선 시 동승** / RC-5(RANDOM 풀스캔 스케일) = **실측 후 조정**(현 트래픽 무해) / RC-6(alert 0·AE writer-only·배포 SHA 추적) = **인증 런칭 스프린트**. 전 항목 INDEX §처분 매트릭스 보존.

### 8.3 배포 기록 (2026-07-10)

- **api staging** 배포(Version `4c73f7e5`) — ★부수 발견·정비: **staging D1 스키마 선재 드리프트**(0022~0042 등 13 마이그 미적용 → input_type/distractors 부재로 공개 라우트 500). 기결·production 기적용 마이그 13건 staging 동기화(0041/0042 RW 선작성분 포함 — staging 한정, production RW 게이트 불변). 동기화 후 overview 라이브 검증(캐시 헤더 포함). next 404 = staging 데이터 빈곤(서빙 자격 행 희소) — 정직 fail-safe 동작 확인.
- **api production** 배포(Version `7c08abd6`, 불가역 1줄 고지 후) → **스모크 14/14 PASS** — overview total=**521**(P3 적재분 정확 일치), next/grade/reveal 라운드트립, 정답 비노출, no-store/공용캐시 경계, 미존재 id 404.
- **web Pages** 배포(`thepick-study.pages.dev`, PUBLIC_API_BASE_URL 게이트 통과. PUBLIC_CF_BEACON_TOKEN 미설정 경고와 함께 — 진산 1줄 행위: 대시보드 Web Analytics 토큰 발급 후 재배포 시 주입). 번들 검증: production API base 인라인·localhost 0건.
- **라이브 브라우저 스모크 PASS**(모바일 375): 랜딩 H1·라이브 임베드·픽커·기출 지도·실기출 서빙(제5회 문45)·채점 Pill. 스크린샷 확인 — 디자인 정본 정합.

### 8.4 D-21 배포 SHA 추적성 복원 (2026-07-12, RC-6 조기 집행)

INDEX §8.2b 가 RC-6 을 "인증 런칭 스프린트"로 이월했으나, **D-21(배포물↔git SHA 추적 단절)**은 비-L3·자율·독립 항목이라 선집행. "404 3주 인시던트" = 배포물 정체 불명 동일 클래스의 근본 차단.

- **문제**: 구 `deploy:production` = `... && wrangler pages deploy dist ... --commit-dirty=true` — `--commit-dirty=true` 가 dirty 상태를 무조건 은폐 + git SHA 미스탬프 → CF 대시보드·라이브 산출물 어디에도 "무엇이 배포됐나" 링크 부재.
- **처분**:
  - `apps/web/scripts/deploy-lib.mjs` (순수 로직) + `deploy-production.mjs` (오케스트레이터) 신설. 구 인라인 셸 체인 대체.
  - **git 계보 스탬프**: `wrangler pages deploy` 에 `--commit-hash=<HEAD>` + `--commit-message=<subject>` + `--commit-dirty=<실제 dirty>` (무조건 true 은폐 폐기 — dirty 배포는 차단하지 않되 CF 메타·version.json 에 `dirty:true` 로 표면화).
  - **런타임 조회원**: 빌드 후 `dist/version.json` 스탬프(sha·shortSha·branch[배포타겟]·checkoutBranch[실측 HEAD]·dirty·commitSubject·builtAt·apiBase) → Pages 정적 서빙으로 `curl https://thepick-study.pages.dev/version.json` = "무엇이 라이브인가" 즉시 확인.
  - **게이트 배선**: `apps/web/scripts/__tests__/deploy-lib.test.mjs`(node:test 7) + 루트 `test:scripts` 글롭에 `apps/web/scripts/__tests__/*.test.mjs` 추가 → CI ci.yml:84 커버(D-01/D-16 "게이트 미배선" 동일 클래스 예방).
- **operator-facing 명령 불변**: `PUBLIC_API_BASE_URL=https://... pnpm --filter @thepick/web deploy:production` 그대로. 내부만 추적성 강화.
- **독립 4-Pass**(`review-20260712-223342-4pass-changes.md`, 7 에이전트): **CRITICAL 0 / MAJOR 0 / MINOR 6** → 판정 "완료 가능". MINOR 6 = 3 실질 이슈 dedup, **전건 처분**:
  - ① wrangler workspace 미핀(`pnpm exec wrangler` 전역 4.78.0 폴백) → apps/web devDeps `wrangler ^4.83.0` 명시(클린 환경·CI 재현성 + `--commit-*` 지원 버전 고정).
  - ② cwd 의존 상대경로 → `process.chdir(import.meta.url 기준)` 고정(루트·래퍼 호출 무관) + `run()` 자식 exit code clean 전파(Node 스택 덤프 제거, 구 `&&` 셸 체인 동등 UX).
  - ③ branch 하드코딩 오인 → BRANCH='main'=배포 타겟 주석 + 실측 `checkoutBranch` version.json 별도 필드.
- **검증**: env 게이트 차단(exit 1 clean)/통과(exit 0)·version.json 유효 JSON·wrangler 인자 형상·test:scripts 20(13+7)·web 74·typecheck·lint·build·g1 全 PASS. (실배포는 운영자 행위 — 다음 web 배포 시 자동 스탬프.)
- **RC-6 잔여**(인증 런칭 스프린트 유지): D-19 alert 채널·D-20 AE reader·D-17 choiceId 회전·D-36 secret 로테이션 runbook.

### 8.5 D-16★ 배포-시점 스모크 게이트 배선 (2026-07-12, RC-4 조기 집행)

D-21 과 같은 "배포 하드닝" 결. `smoke-public-surface.mjs`(14체크, 정답 비노출 assert 포함)가 ops.yml **일간 cron** 에만 걸려 있어 **배포 직후 검증 부재** — 나쁜 배포(404 3주 인시던트 클래스)가 다음 cron 발화까지 무음.

- **처분**: `apps/api` `deploy:production` = `wrangler deploy --env production && node ../../scripts/smoke-public-surface.mjs <prod-url>` — 배포 성공 시에만 스모크, 스모크 실패 시 exit 1 전파(배포는 이미 라이브 = 롤백 판단용 loud 신호. D-16 스펙 정확 일치).
- **staging 제외(의도)**: staging 공개 표면은 데이터 빈곤(-MC 0·overview total=0)이라 스모크 `total>0` 에서 false-fail → `deploy:staging` 은 미배선(원장 기록). production 만 배선.
- **검증**: 라이브 production 스모크 **14/14 PASS**(조합 동작 + production 건강 확인) · `../../scripts` 경로 apps/api 해석 확인 · api package.json JSON 유효. (실배포 wrangler 반부는 미실행 = 운영자 행위.)
- **RC-4 잔여**: GH Actions deploy 워크플로우 자체는 부재(수동 wrangler 관행) — 완전 CD 배선은 인증 런칭 스프린트. 현 배선 = 수동 배포에도 스모크 자동 동반.
- MINOR(관측): production URL 이중 선언(ops.yml + deploy 스크립트) — package.json script 는 상수 import 불가, ops.yml 하드코딩 패턴과 일관(신규 부채 아님).

### 8.6 MINOR 하드닝 번들 — D-27·D-29 처분 + D-32 플래그 (2026-07-12)

진산 방향("MINOR 하드닝 번들 계속") 하 자율 처리. 순수 자율·검증가능·비게이트 항목만.

- **D-27**(perf, RC-5) `public/choice-id.ts` — HMAC `importKey` 매 호출 재수행 → keyMaterial 별 `CryptoKey` 캐싱(module Map, per-isolate, rejection evict). 공개 채점 hot-path(`resolveChoiceId` 가 보기 수만큼 `issueChoiceId` 반복 → 채점당 importKey ≤5회 낭비 제거). **출력 불변**(왕복·결정성·폴백·정답비노출 테스트 green) + 캐시 격리 테스트 신규(6/6). 파생 키 캐시(재계산 가능)라 "인메모리 임시 저장" 금지 규칙 무관.
- **D-29**(perf, single) `StreakPanel.tsx` — `loadStreakView` 의 studiedDates map / todayCount filter **이중 순회+이중 날짜파싱** → 순수 `buildStreakStrip`(`streak-strip.ts` 신설, 컴포넌트 파일 로직 기생 회피=D-24 교훈) 단일 순회 + **테스트 커버리지 0→4**. reviews `.toArray()` 재조회 자체는 최근 31일 유계 = 수용(인메모리 중복만 제거).
- **★D-32 자율 제외·플래그**(BE, single): `local-progress/db.ts` reviews GC/보존 정책 0. **블라인드 구현 불가** — reviews 는 코드 주석(db.ts:11,54)이 명시한 **"FSRS replay 원천 + export 백본"**이라 GC = replay 완전성·export 훼손 = 데이터모델 Silent Pivot. IndexedDB 는 디스크 기반이라 "무한 성장"도 메모리 크래시가 아닌 **장기 쿼터** 이슈이며 `requestPersistentStorage()`+export 로 완화됨. ⇒ **보존 정책 결정 사항**(보관 기간·replay 정확도 영향 = 진산/설계 판단) 으로 이월. 인증 학습 오픈 시 서버 동기화 설계와 함께 재검토 권고.
- **독립 4-Pass**(`review-20260713-091049-4pass-changes.md`, 6 에이전트): **CRITICAL 0 / MAJOR 0 / MINOR 6** → 판정 "완료 가능". MINOR 6 = 3 실질 dedup, **전건 처분**:
  - ① `buildStreakStrip` 손상 reviewedAt(Invalid Date) → `new Date(NaN).toISOString()` RangeError 로 스트립 전체 throw → 패널 전면 은닉 degrade(import 경유 오염 벡터). → 손상 레코드만 스킵 가드 + invalid-iso 테스트(streak-strip 4→5).
  - ② DAY_MS 이중 선언(streak-strip.ts + StreakPanel.tsx) = 31일 조회창↔30일 버킷 계약 드리프트. → streak-strip 에서 `export const DAY_MS`, StreakPanel import 공유.
  - ③ 스트립 aria-label 정량 미전달(스크린리더 공백). → `최근 N일 중 M일 학습, 오늘 K회` view 값 주입(a11y).
- **검증**: api choice-id 6·786 pass 무회귀 / web streak-strip 5·79 pass 무회귀 / typecheck·lint·build·g1 api+web PASS.

### 8.7 D-17 choiceId 미복원 관측 신호 (2026-07-13, RC-6 조기 집행)

공개 채점 MC 경로에서 `resolveChoiceId` 가 null(secret 회전·choiceId 위조·손상) 반환 시 **텔레메트리 0 = 무음 오채점 진단 불능**(secret 회전 시 전 채점이 resolve-null→전부 오답이 돼도 'grade' 이벤트는 isCorrect 만 기록, 구분 불가).

- **처분**: `routes.ts` grade 핸들러 `submittedIndex===null` 분기에서 `recordPublicEvent('defect', defectReason:'choice_id_unresolved')` 발행. **채점 로직 불변**(null → 여전히 isCorrect=false), AE fire-and-forget(바인딩 없으면 no-op). `analytics.ts` defectReason 문서에 정합성 신호(422 콘텐츠 결함과 분리 버킷) 명시.
- **콘텐츠 결함율 오염 차단**: `choice_id_unresolved` 는 200 응답(422 거부 아님)이라 콘텐츠 결함이 아님 → 결함율 소비자(D-20 reader, 미구현)는 defectReason 별 버킷팅으로 분리 집계(문서 명문화).
- **독립 4-Pass**(`review-20260713-104323-4pass-changes.md`, 7 에이전트): **CRITICAL 0 / MAJOR 0 / MINOR 6** → 판정 "완료 가능". 처분:
  - ① ★신호 희석 해소 — `resolveChoiceId` null 이 (a)길이불일치 쓰레기·(b)정상길이 미매칭 둘을 병합 → **`choice_id_malformed`(위조 노이즈) vs `choice_id_unresolved`(회전·stale 인시던트 후보) 분리 버킷**(routes.ts length 선판별). D-17 핵심 가치(회전 감지) 정제.
  - ② 테스트 갭 — 거짓양성 테스트가 정답-유효만 커버 → **오답이지만 유효(index 0) 경로도 미발행 고정**(발행 조건 = null 복원, isCorrect 무관) + malformed 테스트 추가.
  - ③~⑤ 이월/기록(스코프 밖): subject 귀속 스키마(JSDoc 계약+reason 분리로 완화)·secret 회전 사용자 복구(별건 dual-key 기능)·grade double-emission 정답률 오염(리뷰도 "기록" 처분, D-20 reader 버킷팅 사안). RC-6 잔여에 편입.
- **검증**: 캡처 AE mock 테스트(null 발행·malformed 분리·정답/오답 유효 미발행) — api public routes 28→31, 49 파일 789 PASS, typecheck·lint·g1 PASS.
- **RC-6 잔여**: D-19 alert 채널(Email Routing = 외부 채널 설정)·D-36 secret 로테이션 runbook(dual-key 유예 포함 검토).

### 8.8 D-20 AE reader — 조회 소비자 신설 (2026-07-13, RC-6 조기 집행)

`analytics.ts` 는 writer-only(지표·결함율 유일 원천인데 읽는 자 0) + AE ~90일 롤오프 → 라이브 지표를 아무도 안 봄. Cloudflare Analytics Engine SQL API 로 production dataset 을 조회하는 소비자 신설.

- **산출**: `scripts/lib/public-analytics-reader.mjs`(순수 — 쿼리 구성·응답 파싱·요약, 테스트 6) + `scripts/read-public-analytics.mjs`(오케스트레이터 — 토큰·계정·fetch·포맷). 루트 `test:scripts` 글롭 자동 배선(CI ci.yml:84).
- **지표 3종**: 이벤트 종류별(serve/grade/card), 과목별 정답률(grade), 결함/정합성(defect). ★**D-17 정합성 신호(choice_id_malformed·choice_id_unresolved)를 콘텐츠 결함과 분리 버킷**(4-Pass 지적 반영 — 결함율·정답률 오염 방지). 샘플 보정 `sum(_sample_interval)`.
- **실 production end-to-end 검증**: serve 16/grade 12/card 11, 과목 정답률(상법 20%·법령 25%·재배학 0%), 정합성 0. `--json`/`--alert`(정합성 신호 ≥1 → exit 1, cron 경보용)/fail-closed(토큰·env 미설정 exit 1) 확인.
- **실행**: `CLOUDFLARE_API_TOKEN=<Account Analytics Read> node scripts/read-public-analytics.mjs [--env production] [--days 7] [--json] [--alert]`. 계정 ID = env 주입 또는 단일계정 자동 확인.
- **독립 4-Pass**(`review-20260713-154806-4pass-changes.md`, 6 에이전트): **CRITICAL 0 / MAJOR 0 / MINOR 9** → 판정 "완료 가능". 처분:
  - ① kinds[].n 문자열 유출(--json 타입 비일관, MINOR-1/3/7) → `summarizeKinds` 순수 fn 으로 number 정규화(두 경로 통일) + 테스트.
  - ② `--alert` exit code 혼동(보안 스파이크 vs 인프라 실패, MINOR-6) → **정합성 신호 exit 2 / 인프라·사용 오류 exit 1** 분리(cron 경보 피로 방지).
  - ③ INTEGRITY_REASONS writer↔reader 드리프트 → 보안 false-negative(MINOR-5) → analytics.ts 에 **드리프트 트립와이어 주석**(reader 동시개정 의무) + RC-5 shared 단일화 이월.
  - ④~⑥ 이월/기록: blob 레이아웃 교차가드(MINOR-2 → D-25)·account-list 권한(MINOR-4 → cron 배선 시 ACCOUNT_ID 주입)·dataset 이중선언(MINOR-8, fail-loud 무해)·정답률 unresolved 오염(MINOR-9 → 기존 §8.7 이월).
- **RC-6 잔여**: ops.yml 주간 cron 에 `--alert`(exit 2 감시) 배선은 **GH 시크릿 CLOUDFLARE_API_TOKEN 이 Analytics Read 포함 필요**(현 D1/R2) + **CLOUDFLARE_ACCOUNT_ID 동반 주입**(협소 토큰 시 계정 자동탐색 우회) → 진산 시크릿 갱신 후 배선. D-25 blob 스키마 버전 규약·D-19 Email 채널은 별건.

### 8.9 D-36 secret 로테이션 runbook (2026-07-13, RC-6 대응 절차)

D-17(탐지 신호)+D-20(--alert 리더)의 **"대응"** 짝 — secret 회전 시 blast radius·절차·모니터링·롤백 부재 해소. `docs/runbooks/secret-rotation.md` 신설.

- **★blast radius 실측 정정**: JWT_SECRET 회전은 통념("전 세션 로그아웃")과 달리 **auth = graceful**(access 15분 JWT 만 무효 / refresh = SHA-256 DB 검증 = JWT_SECRET 무관 → 재로그인 없이 ≤15분 투명 회복, `session.ts:192`) + **공개 choiceId = in-flight 한정 스파이크 → 자가 교정**(재조회분 정상). webhook HMAC 독립.
- **핵심 운영 지식**: 회전 직후 `choice_id_unresolved` 스파이크 = **예상 양성**(악의 위조와 §4 구분표) → on-call 오판·D-20 --alert 오경보 방지. 탐지(D-17/D-20)↔대응(본 runbook) 루프 완성.
- **권고 이월**: ①CHOICE_ID_SECRET 분리(choiceId 가 auth JWT_SECRET 재사용 = 불필요 결합, RC-5 연동) ②dual-key grace(D-17 4-Pass 제안, ①선행 시 우선순위 하락) ③회전 로그 원장.
- 문서 전용(코드 0). 모든 주장 실코드 근거(JWT_SECRET 사용처 6곳·refresh SHA-256·TTL 15분/30일·D-16 스모크 체인).

### 8.10 D-22 choiceId secret 단일 seam + RC-3 정리 판정 (2026-07-14)

RC-3(계약·리터럴 중복 드리프트) 잔여 MINOR 4건 실측 후 **의미 있는 것만** 집행 (범위 축소 OK·품질 축소 NOT).

- **D-22 집행**: 공개 표면 choiceId HMAC secret 해석이 3개 핸들러(serve `routes.ts:343`·grade `:441`·reveal `:576`)에 `c.env.JWT_SECRET ?? ''` 로 **분산**돼 있던 것을 `choice-id.ts` 단일 헬퍼 `resolvePublicChoiceSecret(env)` 로 중앙화. **동작 불변**(byte-identical) 순수 리팩터 — 폴백 `''` 유지(hmacHex 가 `CHOICE_ID_FALLBACK_KEY` 로 승격, dev/스모크 결정성 보존). ★목적 = 8.9 runbook §7-1 `CHOICE_ID_SECRET` 분리의 **zero-touch seam** 을 1곳에 확보(분리 시 `env.CHOICE_ID_SECRET ?? env.JWT_SECRET ?? ''` 1줄 변경으로 3개 호출부 자동 전환). 단위 테스트 3 추가(설정/폴백/흐름 동치). api 789 PASS 회귀 0.
- **D-23 = 비-finding(이미 해소)**: web `ERROR_MESSAGES` 는 `Record<PublicErrorCode, string>` 이고 `PublicErrorCode` 는 web `types.ts:15-22` 가 `@thepick/shared` 에서 **재수출**(RC-5 단일 소스) — 서버 코드 추가 시 web 컴파일 에러로 강제. 이중선언 아님. 조치 불요.
- **D-24/D-33 = 저가치 이연**: D-24(`sourceTextOf` 가 `PublicQuestionCard.tsx` 에서 export → 형제 2개가 import = 경미한 역의존)·D-33(overview 경로 리터럴 `cache-policy.ts:68`) 는 tree-shaking·단일 사용처로 실해 없음 → util 이관/상수화의 churn 비용이 가치를 상회. 인증 런칭 스프린트 정리 시 동반 처리(비차단).
