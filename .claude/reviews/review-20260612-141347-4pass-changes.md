# 4-Pass 독립 리뷰 보고서 — WS-5a/5c 배선 1차 (ws5a5c-wiring)

- **생성**: 2026-06-12 14:13:47 (ts=20260612-141347)
- **프로토콜**: `.claude/rules/auto-review-protocol.md` 4-Pass (Surgeon/Architect/Advocate/Contract)
- **리뷰 방식**: 독립 에이전트 5개 (scope / Surgeon / Architect / Advocate / Contract) + **발견별 적대적 반증** (MAJOR 전건 실코드·실행 재현 반증 시도 → 전건 반증 실패 = 확정)
- **확정 발견 (반증 통과분만)**: **CRITICAL 0 / MAJOR 5 / MINOR 19**
- **판정**: **완료 가능** (CRITICAL 0건. 단 MAJOR 5건은 프로토콜 규칙 4에 따라 즉시 수정 또는 명시 이월 대상)

## 변경셋 요약

WS-5a/5c 배선 1차 (13 modified + 4 untracked 코드/테스트, +444/−36):

1. **WS-5a category 모드 배선** — `apps/api/src/study/routes.ts` WIRED_MODES 등재 + `/mode/start` modeParams.subject 필수 검증(MODE_PARAMS_INVALID 422) + `/next` WHERE eq.subject 필터 + `/mode` categorySubjects breakdown (topic 은 production topic_cluster 0/534 실측으로 미배선 잔류).
2. **WS-5c** — `/api/progress/due` 첫 web 소비자 DueQueue 위젯 신설(자체 I18nProvider 래핑, study.astro 탑재) + SessionStart category 과목 픽커 + StudyFlow modeParams 전달 + i18n 키 4종 + PITR 문서(코드 무변경, 결재 대기).
3. **선재 회귀 수정** — eval measure-runner local-smoke 가 S5-8 Phase 0a 엔진 depth 기본 2→1(기결 #6)로 red 였던 것을 픽스처 maxDepth:2 명시 주입으로 복원.

검증 주장: api 693 / web 31 PASS, typecheck·lint 17/17, g1 PASS. 연관 파일은 import/호출/동일 user_progress·exam_questions 테이블 사용처 실코드 grep 으로 확정. 워크트리의 타 트랙 untracked 문서(decision-card 3/4/12/13/18/19/phase-b, e0-8 audit, g-ws2-integrity 스냅샷, e0-2-track-b)는 본 리뷰 스코프 제외(별도 워크스트림 docs-only), 단 decision-card-10(weak-score)은 /study/next 가중치의 Pass-4 계약 참조로 포함.

---

── 4-PASS REVIEW ──────────────────
리뷰 방식: 독립 에이전트 5개 (scope/Surgeon/Architect/Advocate/Contract) + 발견별 적대적 반증
리뷰 범위: 변경 파일 17개 + 연관 파일 26개 (목록 §스코프 참조)

Pass 1 (Surgeon): ✅ 36건 확인 / 🔴 0건 / 🟠 2건 / N/A 3건 (+ MINOR 3건, NOTE 1건)
확인 (대표 — 전수는 §Pass별 확인 항목):

- apps/api/src/study/routes.ts:949-972 — /next category bind 순서(userId→examType→subject→count)가 SQL placeholder 순서와 정확 일치; routes.test.ts:1300-1318 교차 검증
- apps/api/src/study/routes.ts:922-947 — category 세션 mode_params JSON.parse try-catch + warn 로깅 + 422 MODE_PARAMS_INVALID (무필터 mixed 폴백 금지 = 정직 거부)
- node:sqlite 실비교 (2026-06-12 직접 실행) — datetime('now') vs ISO 문자열 비교 결과 {dueIso:0, dueYesterday:1} → MAJOR-1 실증
- 테스트 직접 재실행 (2026-06-12) — apps/api study routes 92 + measure-runner 6 = 98/98 PASS, apps/web 31/31 PASS (출력 원문 tail 확인)
  반론: 기존 /due 테스트(routes.test.ts:421-439)는 -24h ISO(항상 전날 날짜 접두사)만 검증해 당일 due 케이스를 마스킹 — "테스트 PASS = 안전" 가정이 정확히 이 지점에서 깨진다. 또 lint 17/17 PASS 주장과 exhaustive-deps 위반(StudyFlow deps 누락) 공존은 해당 규칙 비활성을 시사 = 동류 결함의 회귀 검출 공백.

Pass 2 (Architect): ✅ 18건 확인 / 🔴 0건 / 🟠 2건 / N/A 2건 (+ MINOR 4건)
확인 (대표):

- import 방향 — study/routes.ts:26-64 가 @thepick/shared·learning-modes·srs 만 의존, packages 간 역방향 0 / Workers 제약: crypto.randomUUID(Web Crypto)만, 런타임 변경분 fs/path 0
- D1 스키마 일치 — schema.ts:356(subject)·417-418(mastered_at·weak_score)·462(mode_params)·477(daily_goal) ↔ routes.ts 쿼리 컬럼 1:1, 0037 인덱스 실재(d1-from-sqlite.ts:83)
- WIRED_MODES 단일 진실원 → UI 자동 추종 체인: routes.ts:196-200 → /mode wired(:1653-1657) → pickRecommendedMode 제외(session/types.ts:181-190) → ModeSelector disabled(:38,46,75-78)
- Temporal Graph — knowledge_nodes/formulas UPDATE 0건, UPDATE 대상은 학습자 예외 테이블(user_progress/study_sessions/streak_records)만
  반론: DueQueue 가 count 만 쓰는 한 DueItem 타입 거짓은 영원히 무해할 수 있다 — 그러나 MAJOR-1(datetime 비교)을 고치는 순간 exam 행 유입이 즉시 활성화되어 두 결함이 맞물리고, ws-5c PITR 의 거짓 전제가 (B)안 채택 시 설계 오염원이 된다 = 스키마 존재≠데이터 실태 클래스의 재발 시나리오.

Pass 3 (Advocate): ✅ 18건 확인 / 🔴 0건 / 🟠 0건 / N/A 3건 (+ MINOR 7건)
확인 (대표):

- 에러 UX — StudyFlow.tsx:162-180 formatApiError kind별 한국어 안내(기술 에러 비노출), DueQueue 4상태(loading/unauthenticated/error/loaded) 전수 분기 + 미인증 null 렌더
- 보안 — XSS grep(dangerouslySetInnerHTML/innerHTML/eval) 0건, API 키 하드코딩 0건(PUBLIC_API_BASE_URL env 경유), subject 는 SQL bind 파라미터(인젝션 불가), requireAuth 전역 + 404/403/409 + rate-limit(grade 20/min·read 60/min)
- 정답 안전(Hard Stop) — NextQuestionOut 에 answer 필드 부재(서빙 시 정답 비노출), correctLabel 은 채점 후에만, category WHERE 필터는 채점 함수·buildShuffledChoices 계약 무변경
- 접근성 — 터치 타겟 minHeight 44 전수(DueQueue:84, SessionStart:124/156/218/234, ModeSelector:53) + aria(radiogroup/progressbar/sr-only radio)
  반론: 모바일 80% 사용자 기준 Tab+Enter 로 모든 기능 도달 가능하므로 radiogroup arrow-key 부재가 실질 차단은 아니다 — 그러나 "고치는 방향"이 arrow key 구현이 아니라 role 단순화(Essay.tsx aria-pressed 선례)일 수 있다는 점에서 현 구현은 어느 쪽 패턴도 아닌 어중간 상태다.

Pass 4 (Contract): ✅ 17건 확인 / 🔴 0건 / 🟠 1건 / N/A 4건 (+ MINOR 5건)
확인 (대표):

- ADR-039 category 계약(과목 단위 학습) ↔ 구현 일치 — Silent Pivot 아님; WS-0d 재활성 선행 게이트(통합 테스트 PASS 후 Set 등재) 준수, vitest 재실행 92/92 PASS 원문 확보
- WIRED_MODES 주석의 production 전제 독립 재검증 (스키마≠populate 실수 패턴 차단) — wrangler d1 execute --remote(read-only, 2026-06-12): active 534 / subject 결손 0(534/534) / topic_cluster 결손 534(0/534) = routes.ts:191-194 주장과 정확 일치
- 결재 #6(Phase 0a depth1) 비우회 — 엔진 DEFAULT_MAX_DEPTH=1 유지 + 기본값 회귀 테스트 실재, measure-runner 픽스처는 명시 maxDepth:2 주입(production 기본값 영향 0) / 결재 #7 집행 범위 docs-only, §9 진산 전용란 보존(RULE #5 — AI 가 GO 대신 결정하지 않음)
- L3 비접촉 — /grade·DB 스키마·formula-engine·constants 변경 0 (변경은 /next·/mode·/mode/start SELECT/INSERT mode_params 한정), WS-5a/5c 는 MASTER_PLAN §3 [L2] + 결재 #1 위임 승인 범위 내
  반론: 카드/plan 의 라인 좌표 인용은 커밋 해시 고정이 없는 한 같은 워킹트리의 후속 변경(+66~+100행 시프트)으로 즉시 stale 해진다 — decision-card-10 이 실제 사례이며, "본 카드 좌표가 현행" 류 주장은 결재 시점에 재동기하지 않으면 결재자 오독 표면이 된다.

판정: **완료 가능** (4-Pass 전체 CRITICAL 0건 / MAJOR 5건은 즉시 수정 또는 명시 이월)
────────────────────────────────────

---

## 확정 발견 상세 (반증 통과분 24건 = MAJOR 5 + MINOR 19)

> MAJOR 전건은 독립 적대적 반증을 통과(반증 실패 = 발견 확증, refuted=false, severity keep)했다. 반증 판정 전문을 각 발견에 동봉한다.

### MAJOR (5건)

#### [MAJOR-1] /api/progress/due — fsrs_next_review(ISO 8601 'T...Z') vs datetime('now')('YYYY-MM-DD HH:MM:SS') 문자열 비교 불일치 → 당일(UTC) due 카드 전부 무음 누락 (최대 ~24h 지연)

- **Pass**: Surgeon / **파일**: `apps/api/src/progress/routes.ts` :321-330 (predicate :325-326)
- **내용**: study /grade 는 fsrs_next_review 에 ts-fsrs due 를 ISO 8601 (`Date.toISOString()` → '2026-06-12T01:00:00.000Z', packages/srs/src/fsrs.ts:44-46 toIsoString, apps/api/src/study/routes.ts:1228/1265 nextState.due bind) 로 영속한다. 반면 /due 의 WHERE 절은 `fsrs_next_review <= datetime('now')` 로 SQLite datetime 포맷('2026-06-12 05:02:41', 공백 구분자)과 바이트 비교한다. 'T'(0x54) > ' '(0x20) 이므로 같은 날짜 접두사에서 ISO 문자열이 항상 더 크다 → 오늘(UTC) 안에 due 가 도래한 카드는 datetime('now') 의 날짜가 다음 날로 넘어가기 전까지 절대 매칭되지 않는다. node:sqlite 실측 재현: `SELECT ('2026-06-12T01:00:00.000Z' <= datetime('now'))` → 0 (4시간 전 due 인데 미포함), `('2026-06-11T23:00:00.000Z' <= ...)` → 1. FSRS learning/relearning 상태('again' 평가)는 분 단위 interval 이므로 재학습 카드가 하루 동안 큐에서 보이지 않는 체계적 왜곡. 본 결함은 progress/routes.ts 기존 코드이나 WS-5c(DueQueue 위젯, 본 변경셋)가 첫 사용자 노출 소비자를 배선하면서 표면화 — '이전 Step 산출물도 누적 검증 대상'(auto-review-protocol 규칙1) 해당.
- **확인 증거**:
  1. apps/api/src/progress/routes.ts:325-326 — `AND (fsrs_next_review IS NULL OR fsrs_next_review <= datetime('now'))` 직접 확인
  2. packages/srs/src/fsrs.ts:44-46,57-66 — toIsoString → card.due 를 Date.toISOString() ISO 포맷으로 직렬화 확인
  3. apps/api/src/study/routes.ts:1211/1228(UPDATE)·1248/1265(INSERT) — fsrs_next_review = nextState.due (ISO) bind 확인
  4. node:sqlite 실행 재현 (2026-06-12): {"now":"2026-06-12 05:02:41","dueIso":0,"dueYesterday":1} — 당일 due 미포함 확증
  5. apps/web/src/components/review/DueQueue.tsx:33-34 — fetchDueQueue().count 가 본 predicate 결과를 그대로 사용자에게 surface
- **반론(Devil's Advocate)**: POST /progress/review 가 만드는 node 카드 행은 fsrs_next_review NULL(IS NULL 분기로 항상 due)이라, 현 production 데이터에서 ISO 비교 분기를 타는 행은 study /grade 경로의 exam 카드뿐이고 그 interval 은 보통 ≥1일이라 '<24h 지연은 체감 미미'라는 반론이 가능하다. 그러나 FSRS 'again'/learning 단계 interval 은 분 단위이며, WS-5c 위젯의 존재 이유가 정확한 due 카운트 surface 이므로 0건 표시 오류는 기능 정의 자체를 깨뜨린다. 또 /study/next due 정렬(PITR A/B안)이 채택되는 순간 동일 predicate 가 서빙 경로로 승격되어 결함이 증폭된다.
- **권고 수정**: 비교 기준을 단일 포맷으로 통일: `fsrs_next_review <= ?` 로 바꾸고 `new Date().toISOString()` 을 bind (저장 포맷과 동일 ISO). 또는 `datetime(fsrs_next_review) <= datetime('now')` 정규화(인덱스 비활용 비용 주의). 회귀 테스트: 당일 1시간 전 ISO due 행이 count 에 포함되는 케이스 추가.
- **적대적 반증 판정 (refuted=false, severity keep)**: 반증 실패 — 발견은 실코드·실행 재현 모두에서 확증됨. (1) progress/routes.ts:325 의 `fsrs_next_review <= datetime('now')` 바이트 비교와 (2) srs/fsrs.ts:44-46 toIsoString → study/routes.ts:1228/1265 ISO bind 가 원문 그대로 존재하며 포맷 정규화 계층 없음. (3) 독립 node:sqlite 재현: 당일 4시간 전 ISO due → 0(제외), 동일 시각 SQLite 포맷 → 1(포함) = 'T'(0x54) > ' '(0x20) 불일치가 유일 원인임을 대조군으로 확정. (4) 기존 테스트(routes.test.ts:421-439)는 -24h ISO(항상 전날 날짜 접두사)만 검증해 당일 due 케이스를 마스킹 — 가드 부재. (5) DueQueue.tsx:33-34 가 결과 count 를 사용자에게 그대로 surface, 상위 보증 없음. "현 데이터 대부분 NULL 카드라 무해" 반론은 study /grade 가 이미 exam 카드에 ISO 영속 중 + FSRS learning/relearning interval 분 단위라는 점에서 기각. 데이터 파손 없음·UTC 자정 자동 회복이므로 CRITICAL 은 과잉, 그러나 사용자 노출 기능의 무음 오동작 + 테스트 마스킹 + /study/next due 정렬 채택 시 서빙 경로 증폭 진앙이므로 MAJOR 유지가 정확. suggestedFix(ISO bind 통일 또는 datetime() 정규화 + 당일 due 회귀 테스트)도 타당.

#### [MAJOR-2] DueItem.nodeId 타입 계약 거짓 (string 선언 vs 서버 null 반환 가능) + 'node 카드 기반' 주석 부정확 — 차기 소비자 잠재 null 크래시

- **Pass**: Surgeon / **파일**: `apps/web/src/lib/study-api.ts` :130-137
- **내용**: WS-5c 신설 DueItem 은 `readonly nodeId: string` (비-null) 로 선언하고 주석에 'node 카드 기반 user_progress 행'이라 적었다. 그러나 서버 /due 쿼리(progress/routes.ts:321-330)는 card_type/node_id 필터가 전혀 없고, ProgressDueRow.node_id 는 `string | null` (progress/routes.ts:88)이며 매핑(:332-337)이 null 을 그대로 통과시킨다. study /grade 가 만드는 행은 node_id=NULL + card_type='exam' + fsrs_next_review 영속(routes.ts:1252 `VALUES (?, ?, NULL, ?, 'exam'...`)이므로, due 도래 시(MAJOR-1 포맷 결함이 하루 지나면 결국 매칭됨) items 에 nodeId:null 항목이 실제로 들어온다. 현 유일 소비자 DueQueue 는 count 만 읽어 당장 크래시는 없지만, 타입이 거짓이라 TypeScript 가 차기 소비자의 `item.nodeId.startsWith(...)` 류 null 크래시를 잡아주지 못한다. fsrsNextReview 는 'ISO datetime 또는 null'로 정직하게 nullable 처리한 것과 대조되는 동일 변경셋 내 비일관.
- **확인 증거**:
  1. apps/web/src/lib/study-api.ts:131-137 — `readonly nodeId: string` + 'node 카드 기반' 주석 직접 확인
  2. apps/api/src/progress/routes.ts:86-91 — ProgressDueRow.node_id: string | null 선언
  3. apps/api/src/progress/routes.ts:321-337 — WHERE 에 card_type/node_id 필터 부재 + `nodeId: row.node_id` null 무가드 통과
  4. apps/api/src/study/routes.ts:1246-1252 — exam 카드 INSERT 가 node_id NULL + fsrs_next_review 영속 → /due 매칭 가능 행 실재
  5. apps/web/src/components/review/DueQueue.tsx:34 — 현 소비자는 res.count 만 사용 (당장 크래시 없음 확인)
- **반론(Devil's Advocate)**: '위젯은 count 만 쓰므로 무해하고, exam 행은 MAJOR-1 포맷 결함 때문에 당분간 거의 안 잡힌다'는 반론이 가능. 그러나 MAJOR-1 을 고치는 순간 exam 행 유입이 즉시 활성화되어 두 결함이 맞물리며, ws-5c PITR 문서(:11-12)까지 '/due = node 카드 기반'이라는 거짓 전제를 결재 자료로 영속하고 있어 (B)안 채택 시 설계 오염원이 된다 — 스키마 존재≠데이터 실태 클래스의 재발.
- **권고 수정**: 택1: (a) 타입을 `nodeId: string | null` 로 정정 + 주석을 '전 card_type (exam 카드는 nodeId null)'로 정직화, ws-5c PITR 문서 사실 절도 동기 수정. (b) 서버 /due 에 `AND node_id IS NOT NULL` (또는 card_type 필터)를 추가해 주석·타입 계약대로 좁힘 — 단 exam 카드 due 를 의도적으로 제외한다는 결정이 필요하므로 (b)는 결재 사항.
- **적대적 반증 판정 (refuted=false, severity keep)**: 전 확인점 5건을 실코드 Read 로 재검증 — 전부 사실. (1) study-api.ts:131-137 nodeId: string 비-null 선언 + 'node 카드 기반' 주석 실재. (2) progress/routes.ts:88 ProgressDueRow.node_id = string|null. (3) /due 쿼리(:321-337)에 card_type/node_id 필터 부재, nodeId: row.node_id null 무가드 통과. (4) study/routes.ts:1252 exam 카드 INSERT VALUES (?, ?, NULL, ?, 'exam', ...) = node_id NULL + fsrs_next_review 영속 행 실재 — ISO 'T' vs datetime('now') 공백 포맷 차이로도 날짜부가 지나면 문자열 비교상 due 매칭됨(하루 지연일 뿐 차단 아님). (5) DueQueue.tsx:34 는 count 만 소비 = 당장 크래시 없음도 정확. 반증 시도 전부 실패: safeFetch 는 런타임 검증 없는 캐스트, DueQueue.test.tsx 는 fetchDueQueue 전체 mock(계약 테스트 부재), 상위 호출 보증 없음. 추가로 ws-5c PITR 문서 :11-12 의 '/due = node 카드 기반' 거짓 전제도 실재 확인 — 결재 대기 문서에 영속 중. 따라서 거짓 양성 아님. 심각도는 MAJOR 유지: 현재 런타임 크래시 0(유일 소비자 count 전용)이므로 CRITICAL 아님, 그러나 타입 계약 거짓이 차기 소비자 null 크래시를 TS 가 못 잡게 하고 + 동일 변경셋 내 fsrsNextReview nullable 처리와 비일관 + 결재 문서 거짓 전제(과거 stale 문서 오염 연쇄와 동일 클래스)이므로 MINOR 강등도 부적절.

#### [MAJOR-3] DueItem 타입 계약 드리프트 — web nodeId: string vs API node_id: string|null + /due 는 exam 카드(node_id NULL) 행도 반환

- **Pass**: Architect / **파일**: `apps/web/src/lib/study-api.ts` :131-137
- **내용**: WS-5c 첫 web 소비자 계약이 서버 실 shape 와 어긋난다. (1) API /api/progress/due 의 row 는 node_id: string|null (progress/routes.ts:86-91 ProgressDueRow, :332-337 매핑)인데 web DueItem.nodeId 는 non-null string 으로 선언. (2) /due 쿼리(progress/routes.ts:321-330)는 card_type·node_id 필터가 전혀 없어, study /grade 가 생성하는 exam 카드 행(node_id NULL, card_type='exam', fsrs_next_review=FSRS due — study/routes.ts:1246-1256·1265)이 due 도래 시 그대로 포함된다. 즉 study-api.ts:130 주석 "node 카드 기반 user_progress 행" 은 실코드 반증. 현재 DueQueue 는 count 만 소비해 런타임 무해하나, items 를 소비하는 다음 컨슈머(예: nodeId 로 근거 보기 링크)가 'null' 문자열/크래시 경로를 타입 시스템이 못 막는 상태로 출발한다. 테스트 픽스처도 cardType:'node'(DueQueue.test.tsx:32-33) — CARD_TYPES enum('flashcard','ox','blank','exam','calculation', progress/routes.ts:74-78)에 존재하지 않는 가공 값이라 드리프트를 가려준다.
- **확인 증거**:
  1. apps/api/src/progress/routes.ts:86-91 — ProgressDueRow.node_id: string | null 선언 실확인
  2. apps/api/src/progress/routes.ts:321-330 — /due SELECT 에 card_type·node_id 조건 부재 실확인
  3. apps/api/src/study/routes.ts:1246-1256 — /grade INSERT VALUES (?, ?, NULL, ?, 'exam', …) = node_id NULL exam 행 생성 + :1265 fsrs_next_review 바인드
  4. apps/web/src/components/review/**tests**/DueQueue.test.tsx:32-33 — 픽스처 cardType 'node' = 실 enum 외 값
- **반론(Devil's Advocate)**: DueQueue 가 count 만 쓰는 한 영원히 무해하고, exam 카드가 due 큐에 합산되는 것은 오히려 위젯 의미상 바람직(복습 대상 총량)일 수 있다 — 그렇다면 고칠 것은 타입(nodeId: string|null)과 주석뿐이며 쿼리는 의도로 격상(ADR 1줄)하면 된다. 반대로 /due 가 node 전용이 설계 의도였다면 쿼리에 필터 추가가 정답 — 어느 쪽이든 현 상태(타입·주석·쿼리 3자 불일치)는 유지 불가.
- **권고 수정**: 즉시: DueItem.nodeId 를 string|null 로 정정 + study-api.ts:130 주석에서 'node 카드 기반' 단정 삭제 + 테스트 픽스처 cardType 을 실 enum 값으로. 후속(PITR/#10 결재와 묶음): /due 의 카드 축 의미(node 전용 vs 전 카드)를 1줄 결정으로 못박고 쿼리/문서 동기.
- **적대적 반증 판정 (refuted=false, severity keep)**: 발견의 4개 확인 사항 전부 실코드로 재확인됨 — 거짓 양성 아님. [실측 검증] (1) study-api.ts:133 `readonly nodeId: string` non-null 선언 + :130 주석 "node 카드 기반 user_progress 행" 실재. (2) progress/routes.ts:88 `ProgressDueRow.node_id: string | null` 실재, :332-337 매핑이 `nodeId: row.node_id` 를 그대로 통과 → 런타임 JSON 에 `nodeId: null` 가능. (3) /due SELECT 의 WHERE 는 user_id + fsrs_next_review 조건뿐, card_type/node_id 필터 부재. (4) study/routes.ts:1252 `VALUES (?, ?, NULL, ?, 'exam', …)` + :1265 nextState.due 바인드 — exam 카드는 FSRS due 도래 시(또는 fsrs_next_review NULL 행으로) /due 에 실제 포함. 주석 "node 카드 기반"은 실코드 반증. (5) DueQueue.test.tsx:32-33 픽스처 `cardType: 'node'` = enum 외 가공 값 + nodeId 전부 non-null → 드리프트를 테스트가 가려줌. [반증 각도 점검] "가드/테스트가 막는가?" — 아니오(safeFetch 는 컴파일타임 캐스트뿐, 런타임 검증 0; 테스트는 오히려 허구 enum 값으로 거짓 계약 고착). "상위 호출이 보증하는가?" — 아니오(study /grade 가 NULL node_id 행을 쓰고 /due 가 무필터 합산). "지금 터지는가?" — 아니오(web 내 items/DueItem 소비자 0 — grep 전수), 발견이 이미 인정한 사항이므로 반증 아님. [심각도] keep(MAJOR): ① 첫 web 소비 계약의 출생 시점 드리프트 ② study-api.ts:130 거짓 주석은 본 레포 문서화된 오염 클래스(stale 전제 → CRIT-2/3 연쇄)와 동일 패턴의 신규 씨앗 ③ 실재하지 않는 enum 값이 회귀 검출기 무력화 ④ 수정 비용 극소 vs 방치 비용(계약 동결 후 전파). /due 카드 축 의미는 RULE #5 대로 진산 1줄 결재 사항 — suggestedFix 의 즉시/후속 분리가 정확.

#### [MAJOR-4] 결재 대기 문서의 거짓 전제 — ws-5c PITR §사실 "due = node 카드 기반·exam 카드와 별개 축" 이 실코드 반증

- **Pass**: Architect / **파일**: `docs/plans/ws-5c-study-next-due-pitr.md` :11-12
- **내용**: 진산 결재 대기 PITR 의 '사실(실코드·실데이터)' 절이 /api/progress/due 를 "node 카드 기반 (node_id 중심 — exam 카드와 별개 축)" 으로 단정하나, 실 쿼리(progress/routes.ts:321-330)는 card_type/node_id 무필터라 study /grade 의 exam 카드 행(fsrs_next_review 실영속, study/routes.ts:1265)이 due 도래 시 포함된다. 이 전제는 선택지 (B) '별도 복습 모드: 풀 = due 카드만' 의 설계 폭(node 카드만인지 exam 카드 포함인지)과 (C) 보류 판단의 근거 데이터 해석에 직접 영향 — 본 프로젝트가 2026-05-15 G-AUDIT 에서 확인한 '루트 문서 거짓 전제 → 하위 결재 연쇄 오염' 과 동일 클래스다(결재 전 포착이므로 지금 정정 비용 최소).
- **확인 증거**:
  1. docs/plans/ws-5c-study-next-due-pitr.md:11-12 — "node 카드 기반 (node_id 중심 — exam 카드와 별개 축)" 문언 실확인
  2. apps/api/src/progress/routes.ts:321-330 — WHERE user_id + fsrs_next_review 조건만 (카드 축 필터 0)
  3. apps/api/src/study/routes.ts:1209-1211,1248,1265 — exam 카드 UPDATE/INSERT 양 경로 모두 fsrs_next_review 영속 = due 합류 경로 실재
- **반론(Devil's Advocate)**: PITR 의 핵심 권고 (C) '보류'는 이 전제가 틀려도 결론이 바뀌지 않을 수 있다(FSRS 원천 빈약이라는 더 강한 근거가 독립 성립). 또한 production 에서 아직 exam 카드 due 도래 행이 0건이라면 '현재 관측상' node 행만 나온다는 서술로 선해할 여지도 있다 — 그러나 §사실 절은 코드 계약 서술이므로 관측 아닌 계약 기준으로 정정해야 한다.
- **권고 수정**: PITR §사실 2째 항목을 "무필터 — node 행 + exam 카드 행(fsrs_next_review 영속분) 모두 포함" 으로 정정 후 결재 상신. decision-card-10 의 보조 사실(node-FSRS 미구현)과 교차 참조 1줄 추가.
- **적대적 반증 판정 (refuted=false, severity keep)**: 반증 시도 실패 — 발견은 실코드로 확증된다. [1] 문언 확인: PITR :11-12 의 §사실 절이 "/api/progress/due = ... **node 카드 기반** (node_id 중심 — exam 카드와 별개 축)" 으로 단정함을 직접 확인. [2] 계약 반증 확인: progress/routes.ts:321-330 실 쿼리는 `WHERE user_id = ? AND (fsrs_next_review IS NULL OR <= now)` 뿐 — card_type/node_id 필터 0건. 오히려 SELECT 프로젝션에 card_type 포함 + 응답에 cardType 그대로 노출(:332-337) = "전 카드 축 포함"이 명시적 계약. [3] exam 카드 due 합류 경로 실재: /grade UPDATE(1204-1237, :1228 바인딩)·INSERT(1246-1277, :1252 card_type='exam' 고정, :1248/1265) 양 경로 모두 FSRS scheduleReview 실값 영속 — exam 행은 fsrs_next_review 항상 non-NULL 이므로 due 도래 시 확정 포함. PITR 자신의 17행이 "exam 카드 행의 FSRS 필드는 시드값 위주"로 exam 행의 FSRS 값 실존을 인정 — 11-12행과 17행은 내적 모순. [4] 가드/테스트 부재: (a) DueQueue.tsx cardType 필터 0건, (b) progress 테스트 4종은 node-only 계약을 어디서도 강제 안 함, (c) study-api.ts:130 JSDoc 이 동일 거짓 전제를 이미 복제 — 오염이 코드 주석까지 전파된 상태로 발견을 강화. [5] devilsAdvocate 평가: "(C) 결론 불변 가능"은 결론의 우연한 생존일 뿐 §사실 절 정확성을 구제하지 못함. (B)안 풀 정의와 due 카운트 해석이 이 전제에 직접 의존하며, 결재 대기 문서의 '사실' 절 오류는 G-AUDIT 확정 '거짓 전제 → 하위 결재 연쇄 오염' 클래스 그대로. severity: 런타임 파손 없는 문서 결함이나 인간 결재 직전 의사결정 문서의 사실 왜곡 + 코드 주석 전파까지 확인 → MAJOR 유지 적정. suggestedFix 에 study-api.ts:130 JSDoc 동시 정정 추가 권고.

#### [MAJOR-5] 결재 상신 PITR 의 '사실' 섹션 오류 — /api/progress/due 는 node 카드 전용이 아님 (exam 카드 행 포함), study-api 타입·주석에 동일 오류 전파

- **Pass**: Contract / **파일**: `docs/plans/ws-5c-study-next-due-pitr.md` :11-12 (+ `apps/web/src/lib/study-api.ts` :130-137)
- **내용**: PITR §사실: "/api/progress/due = ... **node 카드 기반** (node_id 중심 — exam 카드와 별개 축)". 실코드는 progress/routes.ts:321-330 의 /due 쿼리가 `WHERE user_id = ? AND (fsrs_next_review IS NULL OR fsrs_next_review <= datetime('now'))` 뿐 — card_type/node_id 필터가 없다. study /grade 가 적재하는 exam 카드 행(card_type='exam', node_id NULL, fsrs_next_review = scheduleReview due 항상 채움 — study/routes.ts:1246-1256, 1211)은 due 도래 시 /due 풀에 포함된다. 즉 ① DueQueue 위젯 카운트는 node+exam 혼합이고 ② 결재 대기 중인 PITR 의 선택지 평가 전제("exam 카드와 별개 축"이라 due 반영이 별도 배선 필요 + 데이터 빈약)가 부분 부정확 — 진산이 실제로 채점해 온 exam 카드 due 가 이미 풀에 들어오므로 (B) 복습 모드 풀 구성·(C) 데이터 빈약 논거 평가가 달라질 수 있다 (RULE: 결재 문서의 사실 고정은 실코드 대조가 전제). 같은 오류가 web 첫 소비자 계약에 전파: study-api.ts DueItem 주석 "node 카드 기반 user_progress 행" + `nodeId: string` (실서버는 node_id NULL 가능 — progress/routes.ts:88 `node_id: string | null` → :334 그대로 매핑). 현 위젯은 count 만 소비해 런타임 무해하나, '첫 소비자'가 영속한 틀린 타입 계약을 후속 소비자(아이템 목록 렌더)가 신뢰하면 null 크래시 경로.
- **확인 증거**:
  1. apps/api/src/progress/routes.ts:321-330 — /due SELECT 에 card_type·node_id 조건 부재 (user_id + fsrs_next_review 조건만)
  2. apps/api/src/study/routes.ts:1246-1256 — user_progress INSERT VALUES (?, ?, NULL, ?, 'exam', ...) + fsrs_next_review=nextState.due 바인딩 (exam 행도 FSRS 스케줄 보유)
  3. apps/api/src/progress/routes.ts:86-91 — ProgressDueRow.node_id: string | null vs apps/web/src/lib/study-api.ts:133 DueItem.nodeId: string (null 비허용 타입 거짓)
  4. docs/plans/ws-5c-study-next-due-pitr.md:11-12 — "node 카드 기반 (node_id 중심 — exam 카드와 별개 축)" 원문
- **반론(Devil's Advocate)**: "node_id 중심"은 스키마 설계 의도 서술이고 PITR 의 결론(권고 C: 보류)은 어차피 'FSRS 원천 실측 후 재상신'이라 사실 정정 후에도 동일 결론일 수 있다. 또 현 production 사용자(진산 평가 계정)의 exam 행 due 가 실제로 도래했는지는 미실측 — count 가 0 인 동안은 위젯 표시도 동일하다. 그러나 결재 문서는 '사실' 섹션의 정확성이 존재 이유이고, 타입 거짓(nodeId: string)은 데이터 도래와 무관한 계약 결함이다.
- **권고 수정**: ① PITR §사실을 "card_type 무필터 — node·exam 카드 모두 포함(node 행은 fsrs_next_review NULL 시드 포함)"으로 정정 후 결재 유지 ② study-api.ts DueItem.nodeId 를 string | null 로, 주석 "node 카드 기반" 제거 ③ e2e fixtures.ts DueQueueFixture 동기 (또는 /due 에 의도적 card_type 필터를 넣는 결정을 PITR 에 선택지로 명시)
- **적대적 반증 판정 (refuted=false, severity keep)**: 실코드 대조로 발견의 4개 확증 전부 재현됨. (1) PITR :11-12 원문 확인. (2) progress/routes.ts:321-330 /due 쿼리는 user_id + fsrs_next_review 조건뿐 — card_type/node_id 필터 부재. (3) study/routes.ts:1246-1256 exam 카드 INSERT 는 node_id NULL·card_type 'exam'·fsrs_next_review=nextState.due(:1265 바인딩), UPDATE 경로(:1211)도 동일 — exam 행이 due 도래 시 /due 풀에 포함. (4) 서버 ProgressDueRow.node_id: string|null(:88)이 :334 에서 무가드 매핑되는데 web DueItem.nodeId: string(:133) = 타입 거짓, safeFetch 런타임 검증 없음. 추가 발견(발견 강화): progress/routes.ts:284 의 node 카드 /review INSERT 는 fsrs_next_review=NULL 시드 — 즉 현 /due 풀에서 실제 FSRS 스케줄을 가진 행은 exam 카드뿐으로, PITR 의 '별개 축' 서술은 거의 정반대이며 (B) 복습 풀 구성·(C) 데이터 빈약 논거 평가에 직접 영향. 반증 시도 3건 모두 실패: 위젯 count-only 소비(런타임 무해)는 발견이 이미 인정한 사항이고, exam due 미도래 가능성은 구조적 서술 오류·타입 거짓과 무관하며, '결론 (C) 불변 가능성'은 결재 문서 §사실 정확성 의무(프로젝트의 stale 전제 연쇄오염 이력)를 면제하지 않음. 런타임 크래시 현재 없음 → CRITICAL 아님, 결재 대기 문서의 거짓 전제 + 영속된 거짓 타입 계약 → MAJOR 유지.

> **MAJOR 군집 메모**: MAJOR-2/3/5 는 동일 진앙(DueItem 계약 + /due 카드 축)의 3개 Pass 독립 검출, MAJOR-4/5 는 동일 PITR 문서 결함의 2개 Pass 독립 검출 — 독립 에이전트 교차 검출로 신뢰도 상호 보강. 실수정 단위는 ① /due predicate ISO 통일(+당일 due 회귀 테스트) ② DueItem 타입/주석/픽스처 정직화 ③ PITR §사실 정정(결재 상신 전) 3건 + /due 카드 축 의미 1줄 결재(진산).

### MINOR (19건)

#### [MINOR-1] (Surgeon) StudyFlow.handleStart useCallback 의존성 배열에 streak 누락 (stale closure 잠재)

- **파일**: `apps/web/src/components/StudyFlow.tsx` :263-305 (deps :304, 사용 :280)
- handleStart 는 `streak.longest` 를 읽어 baselineLongest 로 영속하지만 deps 가 `[state]` 뿐. 현 흐름에서는 loadModes 가 setStreak/setState 를 같은 커밋에 배치해 실질 stale 창이 0에 가깝지만, exhaustive-deps 위반으로 향후 setStreak 단독 갱신 경로가 추가되면 잘못된 baselineLongest 가 sessionStorage 에 무음 영속(신기록 hero UX 왜곡).
- 확인: :280 `const startBaseline = streak.longest` (closure 캡처) / :304 `[state]` 에 streak 부재 / :188-243 loadModes 가 setStreak→setState 연속 호출(React 18 batch 동일 렌더 커밋 확인)
- 반론: questioning 상태에서만 streak 가 state 없이 갱신되는데(handleGraded) 그 상태에선 handleStart 도달 불가 — '현재는 버그 아님'이 맞다. 그러나 lint 17/17 PASS 주장과 exhaustive-deps 규칙 사이 간극(규칙 비활성 추정)이 동류 결함의 회귀 검출 공백을 시사.
- 권고: deps 를 `[state, streak.longest]` 로 보강 (또는 setStreak updater 내부에서 prev.longest 를 읽어 closure 의존 제거).

#### [MINOR-2] (Surgeon) SessionStart category — 안내문 '최대 N' 이 subject 선택 후에도 모드 전체 available 기준 (실 클램프 한도와 불일치 표시)

- **파일**: `apps/web/src/components/session/SessionStart.tsx` :162-164 (대조 :151, :82)
- input max(:151)와 handleChange 클램프(:82)는 effectiveAvailable(선택 과목 풀)인데 안내문(:163)은 `Math.min(MAX_CARDS, available)` 로 모드 전체 풀 표시. 작은 과목(예: 9문제) 선택 시 '최대 525' 표기 — 표시 불일치(기능 오류 아님).
- 확인: :151 `max={Math.min(MAX_CARDS, effectiveAvailable)}` / :163 `최대 {Math.min(MAX_CARDS, available)}` / :62 effectiveAvailable 정의
- 반론: '권장' 문구도 available 기준이라 일관 표기라는 항변 가능 — 그러나 안내 최대값 입력 시 onChange 클램프로 조용히 줄어들어 괴리 체감.
- 권고: :163-164 의 available 2곳을 effectiveAvailable 로 교체.

#### [MINOR-3] (Surgeon) WS-5a 신규 UI 문자열 한국어 하드코딩 — 동일 변경셋 DueQueue 의 i18n 원칙과 비일관

- **파일**: `apps/web/src/components/session/SessionStart.tsx` :104, 106, 108, 128-129
- DueQueue(신설)는 '신규 코드 한국어 하드코딩 금지 원칙' 명시(주석 :9-10) + i18n 키 4종 신설인데, 같은 변경셋의 SessionStart WS-5a 추가분('과목 선택', '선택할 수 있는 과목이 없습니다', '{n}문제', aria-label)은 하드코딩.
- 확인: DueQueue.tsx:9-10,56-87 t() 전면 / SessionStart.tsx:104,106,126-129 한국어 리터럴 / ko.ts:38,57-59 키 신설 역량 보유 확인
- 반론: SessionStart 전체가 하드코딩이라 부분 i18n 화는 혼재를 늘린다 — 컴포넌트 단위 일괄 전환 별도 태스크 이월이 합리적일 수 있음.
- 권고: learning.\* 네임스페이스 키 3종 추가 치환, 또는 SessionStart 전체 i18n 전환 태스크로 명시 이월(이월 기록 필수).

#### [MINOR-4] (Architect) SessionStart 신규 category 픽커 한국어 하드코딩 — DueQueue i18n 원칙과 자기모순

- **파일**: `apps/web/src/components/session/SessionStart.tsx` :102-135
- 같은 changeset 에서 DueQueue 는 i18n 원칙 명시 + 3파일 동기 키 추가까지 했는데 픽커 섹션은 하드코딩. en locale 사용자는 픽커에서 한국어를 본다.
- 확인: SessionStart.tsx:104,106,128 / DueQueue.tsx:9-10,56-87 대조군 / session/types.ts:144-175 MODE_META 기존 관례 확인
- 반론: 트리 전체 하드코딩 상태에서 픽커만 i18n 화 시 한 화면 키/리터럴 혼재 — i18n 마이그레이션 트랙 일괄 처리가 정합적, 그 경우 백로그 등재로 충분.
- 권고: i18n 일괄 마이그레이션 트랙에 session/_ 묶음 등재(차단 아님). 즉시 추가 시 learning.subjectPicker_ 3종.

#### [MINOR-5] (Architect) category 모드 안내 텍스트가 effectiveAvailable 미반영 — 입력 max 와 표기 불일치

- **파일**: `apps/web/src/components/session/SessionStart.tsx` :162-164
- 입력 max 는 effectiveAvailable(:151) 기준인데 안내문 '최대 {Math.min(MAX_CARDS, available)} · 권장 …' 은 모드 전체 기준. :99 '이 mode 대상 {available}문제' 도 동일.
- 확인: :151 input max / :163 안내문 / :62 effectiveAvailable 정의
- 반론: 클램프(:67,:82)가 실제 값을 항상 풀 내로 강제 — 순수 표기 문제이며 과목 행 per-subject 수(:128)로 정확 정보 노출 중.
- 권고: 안내문 두 곳(:99,:163)을 isCategory ? effectiveAvailable : available 로 통일.

#### [MINOR-6] (Architect) decision-card-10 좌표 stale — WS-5a 동일 워킹트리 +66~+100행 시프트로 "본 카드 좌표가 현행" 주장 실효

- **파일**: `docs/plans/master-remediation-20260610/decision-card-10-weak-score.md` :13-22
- 결재 대기 카드의 routes.ts 좌표 인용(1123-1125 등)이 WS-5a 상류 행 추가로 1189-1191 등으로 이동. 카드의 사실 관계(입력 축 축소 = Silent Pivot)는 현행 코드에서 여전히 참 — 좌표만 결재 시점 기준 부정확.
- 확인: routes.ts:1189-1195(현행) vs 카드 표기 1123-1129 / routes.ts:907-916 vs 카드 874-881 / 카드 :22 "본 카드 좌표가 현행" 문언
- 반론: 같은 날 같은 미커밋 워킹트리 산출물이고 ±100행 내 식별자가 유일해 추적 가능 — 커밋 해시 미고정 라인 인용의 본질적 한계로 비차단 처리 무방.
- 권고: 결재 상신 직전 좌표 1회 재동기 + 기준 워킹트리 명시(또는 심볼 인용).

#### [MINOR-7] (Architect) /mode/start modeParams 무상한 영속 — z.record(unknown) 그대로 JSON 직렬화 D1 저장 (subject 만 검증)

- **파일**: `apps/api/src/study/routes.ts` :170-176, 1903-1914
- modeParams 는 키·크기 무제한, 검증은 category subject 1키만(:1891). 유효 subject 에 임의 대형 키 동반 시 전부 study_sessions.mode_params 에 영속. 인증 + 60/min 하에서도 요청당 수백 KB × 60/min D1 비대화 표면.
- 확인: :173 z.record 제약 0 / :1903-1904 JSON.stringify 무가공 영속 / schema.ts:462 mode_params text 길이 제약 없음
- 반론: telemetry write-helper 는 동일 클래스 방어(64KB cap) 기보유 = 패턴 부재 아닌 누락 — 공격자는 인증 사용자뿐 + 비용 알람 관측 가능하므로 런칭 전 일괄 하드닝으로 미뤄도 실해 제한적.
- 권고: modeParamsJson 길이 cap(예: 1KB) 초과 422 — 또는 모드별 허용 키 화이트리스트(category={subject}) strip.

#### [MINOR-8] (Advocate) 신규 category 픽커 한국어 하드코딩 — DueQueue i18n 패턴과 비일관 (신규 코드 나쁜 패턴 복제)

- **파일**: `apps/web/src/components/session/SessionStart.tsx` :102-136
- aria-label 포함 4문자열 하드코딩 — auto-review-protocol Pass 2 i18n 항목 해당. en locale 사용자는 픽커에서 한국어를 본다.
- 확인: :104(헤더 p)·:108(aria-label 스크린리더 노출)·:106,128 / DueQueue.tsx:9-10,56-87 대조군 / ko.ts·en.ts:57-59 + types.ts:64-68 — DueQueue 용 키만 추가됨(픽커용 부재)
- 반론: 신규 섹션만 i18n 화 시 en locale 한 화면 한·영 혼합이라는 더 나쁜 UX — 일괄 i18n 트랙 처리가 합리적, 단 'carry-over 명시 기록'이 있어야 원칙 우회가 아니다.
- 권고: 옵션 A 픽커 4문자열 i18n 키 추가 / 옵션 B(권고) SessionStart/ModeSelector/StudyFlow 전체 i18n 화 명시 carry-over — 어느 쪽이든 결정 기록 필요.

#### [MINOR-9] (Advocate) category available 과대 카운트 가능 — subject NULL 문항 포함 total 표시 vs category 모드는 NULL 문항 영구 서빙 불가

- **파일**: `apps/api/src/study/routes.ts` :1653, 1626-1636
- /mode category available=total(subject NULL 포함)인데 categorySubjects 는 NOT NULL 만 집계 + /next 필터는 NULL 행 매칭 불가 → sum(categorySubjects) < category.available 데이터에서 과대 표기. production 실측 534/534 populate 라 현재 영향 0, 신규 적재·개정 시 표면화.
- 확인: :1562-1566 totalRow subject 무필터 / :1626-1636 IS NOT NULL 집계 / :1653 available: total / SessionStart.tsx:99,162-164 / routes.test.ts:1370-1390 — category.available 미단언
- 반론: SUM 으로 바꾸면 mixed(total)와 숫자가 달라져 새 혼란 + 현 데이터 수정 효과 0 — 드리프트 감지(테스트 단언)만으로 충분하다는 반론.
- 권고: category available 을 subject IS NOT NULL 카운트로 교체(categorySubjects 합산 재사용) + SessionStart 푸터 effectiveAvailable 정정. 최소한 'category.available == sum(categorySubjects)' 테스트 단언 추가.

#### [MINOR-10] (Advocate) /mode/start category subject 실존 미검증 — 비실존 과목으로 빈 세션 생성 가능 (direct API 한정)

- **파일**: `apps/api/src/study/routes.ts` :1891-1899
- extractCategorySubject 는 형식만 검증 — subject='없는과목' 직접 호출 시 세션 정상 생성(200) → /next 즉시 exhausted → 0장 summary 종료. WS-5a 자체가 topic 미배선 사유로 '빈 세션 = 정직성 위반'을 들었는데 category 는 비실존 subject 경로로 동일 빈 세션 가능. UI 경로는 서버 산출 categorySubjects 만 노출하므로 차단됨.
- 확인: :210-219 형식 검증만 / :1891-1899 null 여부만 422 / routes.test.ts:1320-1334 exhausted 정직 반환 / StudyFlow.tsx:351-355 graceful 종료
- 반론: 실존 검증을 추가해도 TOCTOU(start↔next 사이 상태 전이)는 못 막으므로 exhausted 정직 반환이 최종 방어선 — 검증 쿼리 1회는 가짜 안전감 우려 + 빈 세션은 공격자 자신 데이터만 오염.
- 권고: category 분기에서 `SELECT 1 ... WHERE status='active' AND subject=? LIMIT 1` 후 미존재 422. 미채택 시 현 exhausted 처리로 충분하다는 결정을 주석으로 영속.

#### [MINOR-11] (Advocate) modeParams 크기 무제한 — z.record(unknown) 그대로 JSON.stringify 영속 (bodyLimit 미들웨어 부재)

- **파일**: `apps/api/src/study/routes.ts` :170-176, 1903-1914
- index.ts 에 bodyLimit 류 미들웨어 부재(grep 0건) — 인증 사용자가 수백 KB~MB급 JSON 영속 가능. GET /session/:id 가 payload 파싱 후 그대로 응답(:1985-2003) = 저장·재전송 양쪽 비용 표면. 완화: 인증 필수 + 60/min + D1 statement 한도.
- 확인: :173 크기 가드 0 / :1903-1904,1914 INSERT bind / index.ts grep 'bodyLimit|MAX_BODY|content-length' 0건 / :202-203 subject 만 100자 캡 / :1858-1859 rate-limit 실재
- 반론: D1 statement/row 한도가 자연 상한으로 초대형 payload 는 INSERT 실패(503 처리) + 60/min 하 storage bloat 속도는 실질 위협 미달 — 다만 '실패가 한도'인 설계는 Cloudflare 내부 정책 암묵 의존.
- 권고: `.refine(p => JSON.stringify(p).length <= 1024)` 직렬화 길이 캡 + 키 수 상한(≤8) 병행.

#### [MINOR-12] (Advocate) DueItem.nodeId 타입·주석 부정확 — /due 는 card_type/node_id 무필터라 exam 카드 행(node_id NULL)도 반환 (+ count 50 절단 과소 표기)

- **파일**: `apps/web/src/lib/study-api.ts` :130-137
- MAJOR-2/3/5 와 동일 진앙의 Advocate 관점 검출 + 부수 발견: count 는 DUE_LIMIT=50 절단 후 items.length 라 실제 due 50+ 시 위젯이 '복습 예정 50장' 과소 표기(50+ 표기 없음).
- 확인: progress/routes.ts:321-330 필터 부재 / study/routes.ts:1246-1256 exam 행 생성 경로 / study-api.ts:133 non-null 타입 / progress/routes.ts:68,327,338 DUE_LIMIT 절단 카운트 / PITR :11-12 불일치
- 반론: exam 카드가 due 에 잡히는 것은 FSRS 복습 의미에 오히려 정합 — 고칠 것은 타입·문서 1줄뿐일 수 있고, 그렇다면 PITR (B)안 전제 사실도 'node+exam 양축'으로 정정돼야 결재 판단이 정확.
- 권고: nodeId string|null 정정 + 주석 갱신 + PITR 사실 절 정정(결재 전). count 절단은 서버 total 별도 COUNT 또는 위젯 '50+' 표기.

#### [MINOR-13] (Advocate) 과목 픽커 radiogroup 키보드 패턴 비준수 — arrow key 내비게이션/roving tabindex 부재

- **파일**: `apps/web/src/components/session/SessionStart.tsx` :108-133
- role="radiogroup"+role="radio" 인데 WAI-ARIA APG arrow-key/roving tabindex 없음 — Tab 개별 순회(라디오 그룹 관례와 다름). 스크린리더 상태 안내·Enter/Space 선택은 정상 = 사용 불능 아님. 터치 타겟 44px 충족(:124).
- 확인: :108 radiogroup 키보드 핸들러 부재 / :112-117 tabindex 관리 없음 / :124 minHeight 44 PASS / Essay.tsx:57 aria-pressed 선례
- 반론: 모바일 80% 기준 실질 차단 없음 — 고치는 방향이 arrow key 구현이 아니라 role 단순화(aria-pressed 패턴 통일)일 수 있음.
- 권고: 택1 (a) Essay.tsx 선례대로 aria-pressed 토글 버튼 단순화(권고 — 코드베이스 일관), (b) APG 준수 arrow key + roving tabindex.

#### [MINOR-14] (Advocate) 손상 category 세션의 /next 422 시 클라 에러 문구가 '다시 시도해 주세요'로 영구 재시도 유도 (자가 치유 불가 상태)

- **파일**: `apps/web/src/components/StudyFlow.tsx` :162-180
- /next MODE_PARAMS_INVALID 422(mode_params 결손/파손 — 수동/손상 행 한정)는 영구 실패인데 validation 분기 문구가 재시도 유도 → 재시도→복원→422 루프 가능. 현실 발생 경로 좁음: WS-5a 이전 category 는 /mode/start 가 MODE_NOT_AVAILABLE 422 거부라 레거시 행 부재 — DB 수동 조작/마이그 사고 시나리오만.
- 확인: :168-169 validation 문구 / routes.ts:938-947 정직 거부(올바름) / routes.ts:1878-1887 레거시 부재 논증 / StudyFlow.tsx:203-229 복원 경로 phase 만 검사
- 반론: 발생 전제가 'DB 수동 조작'뿐이면 UI 문구 투자 가치 없음 — 진짜 보완점은 서버 telemetry(현 /next 422 경로는 사유 구분 기록 없음).
- 권고: (a) MODE_PARAMS_INVALID 시 sessionStorage 정리 + mode-select 복귀(자가 치유), 또는 (b) 서버 422 분기 warn 로깅 + telemetry — 확률 고려 시 (b)만으로 충분.

#### [MINOR-15] (Contract) MASTER_PLAN §3 WS-5 5a 행 미갱신 — category 만 부분 배선·topic 미배선 잔류 사실이 plan 문서 미반영 (코드 주석에만 영속)

- **파일**: `docs/plans/master-remediation-20260610/MASTER_PLAN.md` :161
- 본 changeset 은 타 행(#3·#4·#7·#10·#18·#19·#20·#22)에 2026-06-12 상신/집행 주석을 달면서 같은 세션 부분 집행된 5a 행은 무주석. category 한정 집행(topic_cluster 0/534 — 공허 세션 정직성 사유)의 영속 위치가 routes.ts:190-194 주석뿐 — "plan 문서 stale = 하위 작업 오염원" 패턴 해당, 차기 세션 오독 표면.
- 확인: MASTER_PLAN.md:161 변경 0 / routes.ts:190-194 주석 / git diff — #7 행 "집행 완료 (2026-06-12)" 비대칭 갱신
- 반론: 태스크 #5 in_progress 라 워크스트림 완료 시점 일괄 갱신 예정일 수 있음 — 중간 주석이 노이즈일 수 있으나, '배선 1차' 커밋 시점에 문서-코드 어긋남이 영속된다.
- 권고: 5a 행에 "category 집행 완료(2026-06-12)·topic 은 topic_cluster 0/534 실측으로 populate 후 재상신" 1줄 추가 (G-WS5 ① 게이트 추적 정합).

#### [MINOR-16] (Contract) SessionStart category 모드 표시 수치 비일관 — 과목 선택 후에도 '이 mode 대상/최대/권장' 텍스트가 전체 풀 기준

- **파일**: `apps/web/src/components/session/SessionStart.tsx` :99, 163 (vs :151 input max) — 경유 StudyFlow.tsx
- 서버측 category available=total 은 subject NULL 행 포함(현 production 0건 — 본 리뷰 wrangler --remote read-only 실측) → categorySubjects 합과 어긋날 잠재 표면, G-WS5 ① "모드별 /next 응답이 available 카운트와 동일 풀" 게이트와 장차 모순 가능.
- 확인: SessionStart.tsx:99,163 available vs :151 effectiveAvailable 비대칭 / routes.ts:1653 available: total / production 실측(2026-06-12) active 534 중 subject 결손 0
- 반론: 현 데이터에서 수치 모순 미표시 + 과목 선택 전 전체 풀 표기는 자연스러움 — 그러나 BATCH 재적재로 NULL subject 발생 순간 무음 불일치.
- 권고: :99/:163 을 isCategory && selectedEntry 시 effectiveAvailable 로 전환, 서버 category available SUM(NOT NULL) 안을 G-WS5 ① E2E 와 함께 검토.

#### [MINOR-17] (Contract) 신규 사용자-노출 한국어 하드코딩 — SessionStart WS-5a 신규 블록이 같은 changeset 의 DueQueue 자기선언과 모순

- **파일**: `apps/web/src/components/session/SessionStart.tsx` :104, 106, 108, 127-129
- DueQueue.tsx:9-10 자기선언("신규 코드 한국어 하드코딩 금지") + 키 4종 신설 대비, 동일 워크스트림 픽커 블록 하드코딩 — Pass 2 i18n 항목 + CLAUDE.md "기존 나쁜 패턴 복제 금지" 충돌 신규 라인.
- 확인: DueQueue.tsx:9-10 자기선언 + t() / SessionStart.tsx:104,106,128 (diff + 구간) / i18n/types.ts:65-69 신설 키는 dueCards/dueEmpty 뿐
- 반론: 픽커 블록만 i18n 화 시 컴포넌트 내 혼재 심화 — 일괄 전환 별도 태스크가 합리적, 차단 사안 아님.
- 권고: SessionStart 일괄 i18n 전환 태스크에 신규 4 문자열 포함 carry-over 명시 (또는 픽커 키 3종 즉시 추가).

#### [MINOR-18] (Contract) e2e 픽스처 cardType 'node' 는 서버에서 발생 불가능한 값 — "실 서버 응답 shape 정합" 주장과 값 수준 불일치

- **파일**: `apps/web/e2e/helpers/fixtures.ts` :80, 91 (+ DueQueue.test.tsx:32-33)
- 실 서버 card_type 도메인은 CARD_TYPES('flashcard','ox','blank','exam','calculation') — 'node' 는 어떤 경로로도 영속 불가. 픽스처 헤더 "실 서버 응답 shape 정합" 주장이 값 수준에선 거짓. 후속 UI(카드 타입별 아이콘 등)가 가짜 값 기준으로 작성될 표면.
- 확인: progress/routes.ts:74-78 enum / fixtures.ts:91 'node' 하드코딩 / DueQueue.tsx cardType 미소비(현 무해)
- 반론: "shape 정합"을 타입 구조(키·널러빌리티)만의 주장으로 읽으면 위반 아님 + e2e 목적상 값 충실도 불요 — 그래도 실값 교체 비용 0.
- 권고: 픽스처 cardType 을 'flashcard'/'exam' 등 실 도메인 값으로 교체.

#### [MINOR-19] (Contract) WS-0d(2026-06-11) 이전 생성됐을 수 있는 subject 없는 category 세션이 sessionStorage 복원되면 /next 422 반복 — 자가 치유 불가 엣지

- **파일**: `apps/api/src/study/routes.ts` :938-947 (+ StudyFlow.tsx:200-233)
- /next 의 422 정직 거부 자체는 계약상 옳음(무필터 폴백 금지). 그러나 WS-0d 차단 전 생성됐을 수 있는 subject 없는 category 세션이 phase != completed 로 잔존 시: 복원 → questioning → 422 → '다시 시도' → loadModes → 동일 복원 루프. clearActiveSession 은 completed/404/403 에서만 동작. production 사용자가 사실상 진산 평가 계정뿐 + 해당 세션 존재 여부 [미조사] = 위험도 낮음.
- 확인: routes.ts:938-947 / StudyFlow.tsx:204-229 정리 조건 한정 / git diff routes.ts "그 전에 생성된 행/수동 행 방어로 재검증" 주석(작성자 인지)
- 반론: WS-0d 이전에도 UI category 시작 경로 사실상 미노출이면 레거시 0건 + sessionStorage 탭 수명 자연 소멸. 반대로 422 대신 강제 completed 처리는 무음 데이터 변조.
- 권고: web 측 /next MODE_PARAMS_INVALID 수신 시 복원 대상 제외(clearActiveSession) + 안내 — 서버 계약 불변 유지.

---

## Pass별 확인 항목 전수 (증거 기반 보고 — 규칙 2)

### Pass 1 — Surgeon (✅ 36 / N/A 3 / NOTE 1)

1. PASS apps/api/src/study/routes.ts:949-972 — /next category bind 순서 (userId→examType→subject→count) 가 SQL placeholder 순서와 정확 일치; 테스트 routes.test.ts:1300-1318 으로 교차 검증
2. PASS apps/api/src/study/routes.ts:891-899,1102-1110 — D1 .first() null 경로: 세션 lookup null→404, 타인→403, completed→409 (deref 전 전수 가드)
3. PASS apps/api/src/study/routes.ts:922-947 — category 세션 mode_params JSON.parse try-catch + warn 로깅 + 422 MODE_PARAMS_INVALID (무필터 mixed 폴백 금지 = 정직 거부); 테스트 :1336-1357
4. PASS apps/api/src/study/routes.ts:1135-1141 — question .first() null→404, answer null/''→422 QUESTION_HAS_NO_ANSWER
5. PASS apps/api/src/study/routes.ts:210-219 — extractCategorySubject 비문자/공백/길이>100 → null; 서버 테스트 6종 invalid 케이스 422 확인 (routes.test.ts:1259-1278)
6. PASS apps/api/src/study/routes.ts:559-603 — enrichRelatedNodes parse 실패 warn+[], 쿼리 실패 logger.error+[] (빈 catch 0건)
7. PASS apps/api/src/study/routes.ts:441-515 — buildShuffledChoices 무음 filter 금지(비문자 원소 전수검증 거부) + 중복 보기 거부 + 전 실패 경로 warn 로깅
8. PASS apps/api/src/study/routes.ts:763-792 — emitLearningTelemetry promise.catch 선부착 + waitUntil try-catch fallback (catch 블록은 주석+void promise 로 무음 아님)
9. PASS apps/api/src/study/routes.ts:1326-1366 — study_sessions UPDATE RETURNING null(race) → 직전 state fallback; 실패 → warn + telemetry emit
10. PASS apps/api/src/study/routes.ts:1450,1647,1826 — dailyGoalProgress 나눗셈 전부 dailyGoal>0 가드 + Math.min cap (0 나눗셈/NaN 경로 차단)
11. PASS apps/api/src/search/graph-walk/index.ts:75,158-164,187-188 — DEFAULT_MAX_DEPTH=1 (결재 #6) + clampInt 가 NaN/음수/초과 전부 clamp; golden test 가 clamp 노출 검증 (graph-walk.golden.test.ts:285-300)
12. PASS apps/api/src/eval/**tests**/measure-runner.test.ts:131-141 — maxDepth:2 명시 주입 (엔진 기본값 비종속 = G-6a-1 결정성 복원); zod 상한 4 이내 (graph-search-route.ts:86); DEFAULT_MAX_DEPTH 암묵 의존처 grep 0건 확인
13. PASS apps/api/src/eval/multihop-accuracy.ts:197-213 — buildBucket measured=0 → 전 지표 0 반환 (0 나눗셈 가드); scoreQuestion expected ∅ → unmeasurable 명시 제외
14. PASS apps/api/src/search/graph-search-route.ts:133-136,177-178,290-343 — body parse .catch(()=>null)→400, embedQuery await, 전 에러 경로 구조화 로깅 후 전파 (silent empty 0건)
15. PASS apps/web/src/components/review/DueQueue.tsx:29-48 — cancelled cleanup flag + 4상태(loading/unauthenticated/error/loaded) 전수 분기; 미인증 null 렌더 (redirect 미트리거); 테스트 4건 PASS (DueQueue.test.tsx:29-60)
16. PASS apps/web/src/i18n — learning.due/dueCards/dueEmpty/startSession 키가 types.ts:45,64-68 + ko.ts:38,57-59 + en.ts:38,57-59 3파일 동기 (누락 키 런타임 경로 없음); {{count}} 보간 지원 확인 (use-translation.ts:33-37)
17. PASS apps/web/src/components/session/SessionStart.tsx:71-77,64-68,227-232 — dailyGoalProgress/dailyGoal NaN·Infinity·음수 가드, 과목 선택 시 cardsPlanned 즉시 클램프, subject 미선택 시작 disabled (테스트 6건 PASS SessionStart.category.test.tsx)
18. PASS apps/web/src/components/StudyFlow.tsx:70-112 — sessionStorage read/write/clear 전부 try-catch + 스키마 검증 후 정리 (silent corruption 차단); finalizingRef 로 double-finalize 차단 (:307-333)
19. PASS apps/web/src/lib/study-api.ts:53-64 — fetch network throw → StudyApiError('network'), 비-ok status → kind 매핑 (빈 catch 0건)
20. PASS apps/api/src/progress/rate-limit.ts:53-84 — UPSERT+RETURNING 원자 카운트, DO UPDATE 분기 유지 (DO NOTHING 무력화 경고 주석 보존)
21. PASS apps/api/src/middleware/retry.ts:34-53,65-91 — UNIQUE/CONSTRAINT 즉시 전파 + 5xx/timeout 만 재시도 + 안전 기본 false
22. PASS apps/api/src/auth/middleware/require-auth.ts:53-87 — JWT_SECRET 미주입 fail-closed 500, 빈 sub/sid 거부 (downstream WHERE user_id='' 차단)
23. PASS apps/api/src/telemetry/write-helper.ts:51-64,95-102 — metricJson 직렬화 실패 throw + 64KB 상한 + INSERT 실패 로깅 후 throw (silent drop 0)
24. PASS packages/srs/src/weak-score.ts:40-66 — clamp01 이 비유한 subjectCorrectRate 0 처리; conceptStability 는 ts-fsrs 산출 유한값 경로 (fsrs.ts:57-66) — NaN 유입 현실 경로 없음 확인
25. PASS packages/srs/src/fsrs.ts:44-46 — due ISO 직렬화 확인 (MAJOR-1 의 근거 확정용)
26. PASS apps/api/src/index.ts:103-126,155-166 — /api/study·/api/progress CORS + 라우트 마운트 순서 (search/graph 가 search 보다 선행) 확인
27. PASS apps/web/src/pages/study.astro:23,26 — DueQueue client:load 탑재 + CTA href '#study-main' 앵커 대상 id 실재
28. PASS apps/web/src/components/session/types.ts:55-60,181-190 — categorySubjects optional (구버전 API graceful) + pickRecommendedMode 가 wired=false 제외
29. PASS apps/web/src/components/session/ModeSelector.tsx:34-39 — entry undefined → notWired 안전 간주 (available ?? 0)
30. PASS apps/web/src/components/question/MultipleChoice.tsx:19-31 — choices[idx] 경계 가드 (idx<choices.length); ResultSection.tsx:33 correctLabel ?? correctAnswer 폴백 (routes.ts:721 주석 계약과 일치)
31. PASS 금지 패턴 스캔 — 변경 7파일 grep: any/TODO/HACK/@ts-ignore/빈 catch 0건 (유일 'any' 히트 = StudyFlow.tsx:14 주석)
32. PASS 테스트 직접 재실행 (2026-06-12) — apps/api study routes 92 + measure-runner 6 = 98/98 PASS, apps/web 31/31 PASS (출력 원문 tail 확인)
33. PASS node:sqlite 실비교 — datetime('now') vs ISO 문자열 비교 결과 {dueIso:0, dueYesterday:1} (MAJOR-1 실증)
34. PASS docs/plans/ws-5c-study-next-due-pitr.md — 코드 무변경(결재 대기) 확인; 단 '/due = node 카드 기반' 서술은 MAJOR-2 와 연동 부정확 (해당 finding 에 포함)
35. PASS docs/plans/graph-walk-s5-8-redesign.plan.md:210 — Phase 0a depth 2→1 집행 기록이 graph-walk/index.ts:75 실코드와 일치 (결재 #6 정합)
36. PASS docs/plans/master-remediation-20260610/decision-card-10-weak-score.md:12 — α0.6/β0.4 산식 골격이 packages/srs/src/weak-score.ts:40-50 + types 와 '동일' 대조 기록 확인
37. N/A Formula Engine 동적 코드 실행 — 본 변경셋에 formula-engine/equation_template 경로 없음 (eval/Function/new Function grep 0건)
38. N/A Vectorize/Claude API/pdfplumber await 누락 — 변경셋에 해당 호출 신설 없음 (graph-search-route 는 비변경 연관 파일, embedQuery/searchKnowledgeNodesForUser await 확인 :177-178)
39. N/A 산식 정밀도 numeric_value vs value 혼용 — 변경셋에 constants 테이블 조회 없음
40. NOTE apps/api/src/study/routes.ts:1013 — shuffled.map((c)=>...) 가 Hono context c 를 shadow (현재 무해 — map 내부에서 choice 필드만 사용. 가독성 차원 리네임 권장, finding 미승격)

### Pass 2 — Architect (✅ 18 / N/A 2)

1. PASS — Import 방향(apps→packages 단방향): study/routes.ts:26-64 가 @thepick/shared·learning-modes·srs 만 의존, packages/srs/src/weak-score.ts:18 은 패키지 내부 ./types.js 만, packages 간 역방향 0
2. PASS — Workers 제약: study/routes.ts:1243,1295,1901 crypto.randomUUID(Web Crypto)만 사용, apps/api 런타임 변경분 fs/path import 0 (node:fs 는 vitest 전용 measure-runner.test.ts:15 한정)
3. PASS — D1 스키마 일치: schema.ts:356(exam_questions.subject)·417-418(mastered_at·weak_score)·462(study_sessions.mode_params)·477(streak_records.daily_goal) ↔ routes.ts 쿼리 컬럼 1:1, 신규 subject 필터용 0037 인덱스 실재(d1-from-sqlite.ts:83)
4. PASS — /next category bind 순서 정합: routes.ts:948-952 [userId, examType, subject, count] ↔ SQL placeholder 순서(:961-969) 일치, 통합 테스트 routes.test.ts:1300-1318 로 타과목·subject NULL 제외 검증
5. PASS — 무필터 폴백 금지(정직성): routes.test.ts:1320-1323 — 해당 subject 0건 시 exhausted (mixed 폴백 없음), /next 측 재검증 422 MODE_PARAMS_INVALID(routes.ts:938-947)
6. PASS — WIRED_MODES 단일 진실원 → UI 자동 추종 체인: routes.ts:196-200 (weak/mixed/category) → /mode wired 필드(:1653-1657) → pickRecommendedMode 미배선 제외(session/types.ts:181-190) → ModeSelector disabled+available 비표시(ModeSelector.tsx:38,46,75-78)
7. PASS — 서버/클라 이중 방어 동치: /mode/start subject 422(routes.ts:1891-1899) ↔ SessionStart 시작 버튼 subject 미선택 disabled(SessionStart.tsx:227-232) ↔ StudyFlow modeParams 전달(StudyFlow.tsx:274-277,406)
8. PASS — topic 미배선 잔류 근거 영속: routes.ts:190-194 주석 (production topic_cluster 0/534 = 배선 시 공허 세션 → 스키마 존재 ≠ 데이터 populate 원칙 명시), wired 테스트 routes.test.ts:869-877
9. PASS — truth_weight 정렬 단일 진실원 불변: graph-search-route.ts:267-269 compareByTruthWeightThenScore 병합 재정렬 — 본 changeset 무접촉
10. PASS — measure-runner 회귀 수정의 비종속화 설계: graph-walk/index.ts:75 DEFAULT_MAX_DEPTH 2→1 (S5-8 Phase 0a 결재 #6, plan :210 [x] 확인) ↔ measure-runner.test.ts:131-140 maxDepth:2 명시 주입 = 엔진 기본값 변경에 측정 입력 고정, route 계약 상한 내(graph-search-route.ts:86 max=MAX_ALLOWED_DEPTH=4)
11. PASS — eval↔study 파서 동치 의무 유지: multihop-accuracy.ts:64 필터 술어 === study/routes.ts:572 (typeof 'string' && length>0), RELATED_NODES_MAX 비동치 1건은 양측 주석으로 의도 명시(routes.ts:555-557)
12. PASS — Temporal Graph: knowledge_nodes/formulas UPDATE 0건 — UPDATE 대상은 user_progress(:1204)·study_sessions(:1328)·streak_records(:1419 UPSERT) = 학습자 예외 테이블(schema.ts:38-40 예외 정책 정합), exam_questions 무변경
13. PASS — i18n 신규 위젯 3계층 동기: DueQueue.tsx:56-87 전량 t() 키, types.ts:64-68 + ko.ts:57-59 + en.ts:57-59 키 4종 일치, {{count}} interpolation 지원 실확인(use-translation.ts:33-37)
14. PASS — DueQueue CTA 정직성 계약: href '#study-main' 앵커 실재(study.astro:26), 라벨 learning.startSession='학습 시작'(ko.ts:38) — /next 의 fsrs_next_review 참조 0건(routes.ts:907-916 ORDER BY 양 분기)과 정합('복습 시작' 참칭 없음), 위젯 미인증 시 null 렌더(DueQueue.tsx:50-52)
15. PASS — 라우트 마운트/CORS 배선: index.ts:166 /api/study, :164-165 /api/search/graph·/api/search exact 분리 불변, :103-105 progress·study CORS
16. PASS — rate_limits suffix key 안전: schema.ts:770 user_id 일반 text(FK 없음) → ':study-read' suffix group(routes.ts:153,811) PK (user_id,bucket_minute) 충돌 없음
17. PASS — 테스트 인프라 정합: d1-from-sqlite.ts:76-83 SCENARIO_MIGRATIONS 에 0032~0037 포함 → category/세션 테스트가 실 트리거·인덱스 위에서 실행, routes.test.ts:1258-1323 WS-5a 신규 describe 실재
18. PASS — sw/PWA 오프라인 경로 무접촉: DueQueue·StudyFlow 는 fetch 실패 시 error/unauthenticated state(DueQueue.tsx:35-43) — IDB 동기화 stub(RC-3 기보고) 표면 변화 없음
19. N/A — Ontology Lock: 본 changeset 신규 노드/엣지 ID 생성 0 (라우트·UI·테스트·문서 한정 — eval 픽스처는 기존 합성 ID 재사용 measure-runner.test.ts:57-59)
20. N/A — Hexagonal modules/domain 분리: apps/api study 라우트는 기존 D1 직조회 패턴 답습(신규 계층 도입 없음) — 위반 신설 0

### Pass 3 — Advocate (✅ 18 / N/A 3)

1. PASS: 에러 UX Graceful(기술 에러 비노출) — apps/web/src/components/StudyFlow.tsx:162-180 formatApiError 가 kind별 한국어 안내로 변환(HTTP 상태/스택 비노출), apps/web/src/components/review/DueQueue.tsx:65-67 t('errors.generic'), apps/web/src/components/session/SessionSummary.tsx:56-57,124 weakDelta available=false 를 정상 0건과 구분 안내
2. PASS: 상태 표현 4상태(로딩/빈/에러/미인증) — DueQueue.tsx:19-23 DueState 판별 유니온 + :62-70 loading/error/dueEmpty 분기 + :50-52 미인증 null 렌더(사이드바 위젯이 redirect 미트리거 — 주 흐름에 위임, :37-40), StudyFlow.tsx:361-371 init role=status aria-live=polite / :373-390 error role=alert+재시도, SessionStart.tsx:105-106 과목 0건 빈 안내
3. PASS: 빈 데이터(기출 0건) 정직 처리 — apps/api/src/study/routes.ts:990-996 exhausted:true 반환(무필터 폴백 금지), routes.test.ts:1320-1334 subject 0건 → exhausted 테스트, ModeSelector.tsx:68-72 '대상 없음' 배지 + disabled
4. PASS: 접근성 터치 44px+ — DueQueue.tsx:84 CTA minHeight 44, SessionStart.tsx:124(과목 버튼),156(입력),218,234(뒤로/시작) minHeight 44, ModeSelector.tsx:53 minHeight 44, ResultSection.tsx:87 summary minHeight 32(비탭 타겟·토글로 허용 범위)
5. PASS: 접근성 aria — SessionStart.tsx:108 radiogroup aria-label + :116 aria-checked, :197-203 progressbar aria-valuemin/max/now, DueQueue.tsx:56 section aria-label, ModeSelector.tsx:47-51 모드 버튼 aria-label('준비 중' 상태 포함), MultipleChoice.tsx:42-65 fieldset/legend + sr-only radio (단 radiogroup arrow key 미지원은 MINOR-13 으로 보고)
6. PASS: 앵커 타겟 정합 — DueQueue.tsx:82 href="#study-main" ↔ study.astro:26 main id="study-main" 실존, e2e due-queue.spec.ts:31 toHaveAttribute 검증
7. PASS: 보안 XSS — grep dangerouslySetInnerHTML/innerHTML/document.write/eval(/new Function = apps/web/src/components + lib 전체 0건, subject·count 등 동적 값 전부 React 텍스트 노드 렌더(SessionStart.tsx:126-129, DueQueue.tsx:73-79)
8. PASS: 보안 API 키 하드코딩 — grep sk-/api_key/Bearer/SECRET = StudyFlow/DueQueue/session/study-api 0건, study-api.ts:22 PUBLIC_API_BASE_URL env 경유 + :56 credentials:'include' 쿠키 세션(토큰 클라 보관 0)
9. PASS: 보안 입력 검증(서버) — routes.ts:202-219 subject 형식 검증(비문자열/공백/100자 초과 → null→422), :948-951,967 subject 는 SQL bind 파라미터(인젝션 불가), :1870-1872 zod safeParse + json().catch(null), gradeSchema :155-167 userAnswer max 2000 (단 modeParams 크기 무제한은 MINOR-11 로 보고)
10. PASS: 인증·소유·상태 검증 — routes.ts:830-834 router.use('\*') requireAuth 전역, :891-899 /next sessionId 404/403/409, :1949-1983 /session/:id 소유 검증, require-auth.ts:54-60 JWT_SECRET 미설정 fail-closed, routes.test.ts:1400-1406 타 user 403 테스트
11. PASS: rate-limit — routes.ts:1056-1067 /grade 분당 20 + sleepJitter(타이밍 oracle 방어, rate-limit.ts:90-97), :805-825 study-read 그룹 분당 60 + Retry-After, /mode/start 도 :1858 경유 — 빈 세션 대량 생성·enumeration 완화 계층 확인
12. PASS: 정답 안전(Hard Stop) 비접촉 — NextQuestionOut(routes.ts:346-363)에 answer 필드 부재(서빙 시 정답 비노출 유지), choices 는 셔플 라벨+텍스트만(:1012-1013), correctLabel 은 채점 후에만(:722, GradeResultOut :395-396), category WHERE 필터(:948-967)는 SELECT 컬럼·채점 함수(gradeAnswerByType :685-748)와 buildShuffledChoices 계약(:441-515) 무변경 — MC 위치 라벨형 계약·중복 보기 거부(:472-502) 그대로
13. PASS: eval 회귀 수정의 측정 정직성 — measure-runner.test.ts:131-140 maxDepth:2 명시 주입은 테스트 픽스처 한정(채점 코어 scoreQuestion/aggregate 비접촉), 주석이 S5-8 Phase 0a 결재 #6 근거 명시, graph-walk/index.ts:66-75 DEFAULT_MAX_DEPTH=1 결재 좌표 일치, graph-search-route.ts:86 maxDepth HTTP 계약은 옵셔널 유지 — 사용자 노출 경로 아님
14. PASS: 정직성 표기(참칭 금지) — DueQueue.tsx:5-7,86 CTA '학습 시작'(due 우선 정렬 미배선이므로 '복습 시작' 비참칭) + ws-5c-study-next-due-pitr.md:3 '결재 대기'·코드 무변경(git diff 에 /next due 정렬 코드 0건) + :37 진산 확인란 미체크, routes.ts:192-194 topic 미배선 사유(topic_cluster 0/534 = 빈 세션 정직성) 명시, ModeSelector.tsx:36-38,75-78 미배선 모드 '준비 중'+available 비표시
15. PASS: 이중 방어(클라-서버) — SessionStart.tsx:227-232 subject 미선택 시 시작 disabled ↔ routes.ts:1891-1899 /mode/start 422 ↔ :921-947 /next 재검증 422(무필터 폴백 금지), session/types.ts:55-60 categorySubjects optional 의 구버전 API graceful 주석 + SessionStart.category.test.tsx:109-126 부재 시 시작 차단 테스트
16. PASS: i18n 키 3파일 동기 + 치환 — ko.ts:57-59 / en.ts:57-59 / types.ts:64-68 동시 추가, use-translation.ts:33-37 {{count}} 치환(0 포함 number toString 정상), 키 미존재 시 key 반환+warn(:23-25) — DueQueue 사용 키 6종 전부 실존 확인
17. PASS: 세션 영속·복원 안전 — StudyFlow.tsx:52-112 sessionStorage try-catch(프라이빗 모드)+스키마 검증+손상 시 정리, :203-229 복원 시 서버 phase 재검증(클라 신뢰 0), 카테고리 modeParams 는 sessionStorage 에 미영속(서버 mode_params 가 단일 진실원 — 복원 후 /next 가 서버 행에서 재추출 :924-937)
18. PASS: 문서-코드 정합(스코프 docs) — graph-walk-s5-8-redesign.plan.md diff = 결재 #7 등재만(구현 착수 별도 체크 명시·코드 무변경), MASTER_PLAN.md diff = #7 집행 완료·카드 좌표 추가만, decision-card-10-weak-score.md = weak_score Silent Pivot 실코드 좌표(routes.ts:1122-1129 외) 정확·'결재 대기' 상태 정직 — /next weak ORDER BY(routes.ts:907-912)가 카드 단위 weak_score 소비라는 본 리뷰 확인과 일치
19. N/A: Service Worker 캐싱 전략 — 본 변경셋 sw.js 비접촉(git status 17 modified + untracked 에 sw 0건), /api/progress/due 는 기존 정책 영역이며 오프라인 fetch 실패 시 DueQueue.tsx:42 error 상태로 graceful, study.astro:34 OfflineIndicator 탑재 유지
20. N/A: IndexedDB↔D1 오프라인 동기화 — 변경셋이 offlineActions/IDB 경로 비접촉(CLAUDE.md 기보고 RC-3 stub 은 본 스코프 외 별건)
21. N/A: 농학 미출제 라벨링·암기법 역검증·BATCH 순서 — 본 변경셋은 콘텐츠 적재/생성 비접촉(코드 diff 18파일 전수에 BATCH/mnemonic 0건)

### Pass 4 — Contract (✅ 17 / N/A 4)

1. PASS — ADR-039 category 계약(과목 단위 학습) ↔ 구현 일치: docs/adr/ADR-039:41-42 'category=과목별/과목 단위 학습' ↔ apps/api/src/study/routes.ts:948 'AND eq.subject = ?' + :1891-1899 /mode/start modeParams.subject 필수 검증 — Silent Pivot 아님
2. PASS — WS-0d 재활성 선행 게이트('Set 등재 전 해당 모드 /next 필터 통합 테스트 PASS') 준수: routes.ts:186-188 게이트 원문 + routes.test.ts 'WS-5a — category 모드 배선' describe 6건 (subject WHERE 필터/0건 exhausted 무필터폴백금지/결손파손 422/비-category 회귀/categorySubjects breakdown) — vitest 재실행 92/92 PASS 원문 확보
3. PASS — WIRED_MODES 주석의 production 전제를 독립 재검증 (스키마≠populate 실수 패턴 차단): wrangler d1 execute thepick-db-production --remote(read-only, 2026-06-12) → active 534 / subject 결손 0 (=534/534) / topic_cluster 결손 534 (=0/534) — routes.ts:191-194 주장과 정확 일치. topic 미배선(공허 세션 차단) 사유 사실로 확인
4. PASS — MAX_SUBJECT_PARAM_LEN=100 의 '실데이터 최장 ≈20자' 주석(routes.ts:202): 실측 MAX(LENGTH(subject))=18 ('농학개론 중 재배학 및 원예작물학') — 정합
5. PASS — Hard Rule 16 (examId 시그니처): apps/web/src/lib/study-api.ts:144-147 fetchDueQueue examId 주입 + apps/api/src/progress/routes.ts:310-316 /due requireExamId 422 강제
6. PASS — Hard Rule 17 (시험 ID 리터럴 단일 선언): 신규/변경 파일 grep 'son-hae-pyeong-ga-sa' 리터럴 0건, study-api.ts:8,23 EXAM_IDS.SON_HAE_PYEONG_GA_SA 경유
7. N/A — Hard Rule 15 (범용 계층 시험 분기 금지): packages/ 본 changeset 무변경 (git status — learning-modes/srs/shared 비접촉)
8. PASS — Hard Limit 전수: knowledge_nodes/formulas UPDATE 0 (신규 SQL = exam_questions SELECT GROUP BY subject routes.ts:1626-1636 + study_sessions INSERT/UPDATE 기존 경로), 동적 코드 실행 0, equation_template 비접촉, Constants DB 우회 0, 농학 라벨링 해당 없음
9. N/A — Ontology Lock/노드 ID 네이밍: 신규 노드/엣지 생성 0 — 테스트 픽스처 CONCEPT-001/002 는 컨벤션 정합 (테스트 픽스처는 Rule 17 예외 대상)
10. N/A — 수치/임계값 ↔ 교재 원문 대조: 본 changeset 에 constants·산식 수치 변경 0건 (DEFAULT_DAILY_GOAL 등 기존값 비접촉)
11. N/A — BATCH 순서 게이트: 본 changeset 데이터 적재 없음 (read-only 실측만)
12. PASS — 결재 #6(Phase 0a depth1) 비우회: 엔진 DEFAULT_MAX_DEPTH=1 유지 (graph-walk/index.ts:75) + 기본값 회귀 테스트 실재 (graph-search-route.test.ts:153 'maxDepth 미지정 → 기본 1') + measure-runner 픽스처는 명시 maxDepth:2 주입 (measure-runner.test.ts:131-140 — 손계산이 2-hop 전제라 G-6a-1 결정성 유지 목적, production 기본값 영향 0). 테스트 6/6 PASS 재현
13. PASS — 결재 #7 집행 범위 준수 (RULE #5): S5-8 plan Phase 1-D 등재는 docs-only, §9 'Phase 1-D 구현 착수 = 본 체크 + 상세 plan 별건' 체크박스 공란 유지 + 'PITR D-A/D-B/D-C 권고 채택/조정: \_\_\_\_' 진산 전용란 보존 — AI 가 GO 를 대신 결정하지 않음
14. PASS — WS-5c 정직성 계약 3중 검증: DueQueue.tsx:5-7 CTA '학습 시작'(복습 시작 참칭 금지) + DueQueue.test.tsx:39 + e2e due-queue.spec.ts:29-31 동일 계약 — /study/next 의 due 반영은 코드 무변경 (routes.ts /next 쿼리 fsrs_next_review 참조 0건, git diff 확인) + PITR(ws-5c-study-next-due-pitr.md:37) 진산 확인란 공란 = 결재 대기 정합
15. PASS — i18n 사전 3종 동기: i18n/types.ts:65-69 dueCards/dueEmpty 키 ↔ ko.ts:58-59 ↔ en.ts:58-59, interpolation {{count}} 지원 (use-translation.ts:33-36), DueQueue 사용 기존 키 실재 (ko.ts:15 loading/:38 startSession/:75 generic)
16. PASS — L3 비접촉 확인: /grade(user_progress 쓰기 경로)·DB 스키마(마이그레이션)·formula-engine·constants 본 diff 변경 0 (git diff 전수 — 변경은 /next·/mode·/mode/start 의 SELECT/INSERT mode_params 한정, study_sessions 는 L3 목록 외) → plan 선행 의무 해당 없음. WS-5a/5c 는 MASTER_PLAN §3 에 [L2] 표기 + 결재 #1 위임 승인 범위 내
17. PASS — additive API 계약: ModeStatsResponse.categorySubjects optional (session/types.ts:56-60) — 구버전 서버 호환 graceful (SessionStart.category.test.tsx 'categorySubjects 부재 → 시작 disabled' PASS) + 서버측 /mode/start 422 이중 방어 (routes.ts:1891)
18. PASS — 라우트 마운트·CORS 불변: apps/api/src/index.ts:103-105 (cors), :156 (/api/progress), :166 (/api/study) — 본 changeset 비접촉
19. PASS — stub/TODO/placeholder/빈 catch 신규 0건: grep TODO|HACK|FIXME → routes.ts/study-api.ts/DueQueue/SessionStart 0건. DueQueue 에러 4상태(loading/unauthenticated/error/loaded) 전부 분기 처리 — 무음 실패 없음
20. PASS — 테스트 재현 (자기 채점 불신 원칙): pnpm vitest 직접 재실행 — apps/api study routes.test.ts 92 + measure-runner.test.ts 6 = 98/98 PASS, apps/web SessionStart.category 6 + DueQueue 4 = 10/10 PASS (원문 출력 확보. 스코프 주장 'api 693/web 31 전체'는 표본 재현 — 전체 스위트는 미재실행)
21. PASS — 스코프 외 변경 파일 누수 점검 (규칙1 전체 범위): 리뷰 스코프 목록에 없던 변경분 apps/web/e2e/mock-api.ts·mock-server/server.ts·due-queue.spec.ts(untracked) 직접 열람 — mock /api/progress/due 핸들러 examId 검증 + unhandled fail-loud 404 유지, 계약 위반 없음 (단 fixtures cardType 'node' 는 MINOR-18 로 보고)

---

## 스코프 (변경 17 + 연관 26)

### 변경 파일 (17)

1. /home/soo/ClaudePro/ThePick/apps/api/src/study/routes.ts
2. /home/soo/ClaudePro/ThePick/apps/api/src/study/**tests**/routes.test.ts
3. /home/soo/ClaudePro/ThePick/apps/api/src/eval/**tests**/measure-runner.test.ts
4. /home/soo/ClaudePro/ThePick/apps/web/src/components/StudyFlow.tsx
5. /home/soo/ClaudePro/ThePick/apps/web/src/components/session/SessionStart.tsx
6. /home/soo/ClaudePro/ThePick/apps/web/src/components/session/types.ts
7. /home/soo/ClaudePro/ThePick/apps/web/src/components/session/**tests**/SessionStart.category.test.tsx
8. /home/soo/ClaudePro/ThePick/apps/web/src/components/review/DueQueue.tsx
9. /home/soo/ClaudePro/ThePick/apps/web/src/components/review/**tests**/DueQueue.test.tsx
10. /home/soo/ClaudePro/ThePick/apps/web/src/lib/study-api.ts
11. /home/soo/ClaudePro/ThePick/apps/web/src/i18n/types.ts
12. /home/soo/ClaudePro/ThePick/apps/web/src/i18n/locales/ko.ts
13. /home/soo/ClaudePro/ThePick/apps/web/src/i18n/locales/en.ts
14. /home/soo/ClaudePro/ThePick/apps/web/src/pages/study.astro
15. /home/soo/ClaudePro/ThePick/docs/plans/ws-5c-study-next-due-pitr.md
16. /home/soo/ClaudePro/ThePick/docs/plans/graph-walk-s5-8-redesign.plan.md
17. /home/soo/ClaudePro/ThePick/docs/plans/master-remediation-20260610/MASTER_PLAN.md

### 연관 파일 (26)

1. /home/soo/ClaudePro/ThePick/apps/api/src/index.ts
2. /home/soo/ClaudePro/ThePick/apps/api/src/progress/routes.ts
3. /home/soo/ClaudePro/ThePick/apps/api/src/progress/rate-limit.ts
4. /home/soo/ClaudePro/ThePick/apps/api/src/auth/middleware/require-auth.ts
5. /home/soo/ClaudePro/ThePick/apps/api/src/telemetry/write-helper.ts
6. /home/soo/ClaudePro/ThePick/apps/api/src/middleware/retry.ts
7. /home/soo/ClaudePro/ThePick/apps/api/src/db/schema.ts
8. /home/soo/ClaudePro/ThePick/apps/api/src/search/graph-walk/index.ts
9. /home/soo/ClaudePro/ThePick/apps/api/src/search/graph-search-route.ts
10. /home/soo/ClaudePro/ThePick/apps/api/src/eval/multihop-accuracy.ts
11. /home/soo/ClaudePro/ThePick/apps/api/src/**tests**/helpers/d1-from-sqlite.ts
12. /home/soo/ClaudePro/ThePick/packages/learning-modes/src/types.ts
13. /home/soo/ClaudePro/ThePick/packages/srs/src/weak-score.ts
14. /home/soo/ClaudePro/ThePick/packages/srs/src/index.ts
15. /home/soo/ClaudePro/ThePick/apps/web/src/components/session/ModeSelector.tsx
16. /home/soo/ClaudePro/ThePick/apps/web/src/components/session/SessionSummary.tsx
17. /home/soo/ClaudePro/ThePick/apps/web/src/components/question/ContextStrip.tsx
18. /home/soo/ClaudePro/ThePick/apps/web/src/components/question/Essay.tsx
19. /home/soo/ClaudePro/ThePick/apps/web/src/components/question/MultipleChoice.tsx
20. /home/soo/ClaudePro/ThePick/apps/web/src/components/question/ResultSection.tsx
21. /home/soo/ClaudePro/ThePick/apps/web/src/components/progress/ProgressViz.tsx
22. /home/soo/ClaudePro/ThePick/apps/web/src/components/progress/ProgressVizFull.tsx
23. /home/soo/ClaudePro/ThePick/apps/web/src/i18n/context.tsx
24. /home/soo/ClaudePro/ThePick/apps/web/src/i18n/hooks/use-translation.ts
25. /home/soo/ClaudePro/ThePick/docs/adr/ADR-039-mode-vs-phase-5-mode-contract.md
26. /home/soo/ClaudePro/ThePick/docs/plans/master-remediation-20260610/decision-card-10-weak-score.md

---

## 최종 판정

- **CRITICAL: 0건** → 프로토콜 기준 "완료 가능".
- **MAJOR: 5건** — 규칙 4("Critical/Major 즉시 수정")에 따라 본 변경셋 커밋 전 수정 또는 명시 이월 결정 필요. 실수정 단위 3건으로 압축 가능: ① /due predicate ISO 포맷 통일 + 당일 due 회귀 테스트 (MAJOR-1) ② DueItem 타입/주석/테스트 픽스처 정직화 (MAJOR-2/3, MINOR-12/18 동시 해소) ③ ws-5c PITR §사실 절 정정 후 결재 상신 (MAJOR-4/5). /due 카드 축 의미(node 전용 vs 전 카드)는 RULE #5 — 진산 1줄 결재 사항.
- **MINOR: 19건** — 보고만 (즉시 수정 비의무). i18n 하드코딩 군집(MINOR-3/4/8/17)은 SessionStart 일괄 i18n 전환 태스크 carry-over 기록 권고.

**판정: 완료 가능**

────────────────────────────────────
보고서 생성: 2026-06-12 14:13:47 / 독립 에이전트 5개 + 발견별 적대적 반증 / review-gate.sh hook 정합 (review-\* prefix)

---

## 해소 기록 (메인 세션, 2026-06-12 — 리뷰 직후)

- **MAJOR 5/5 해소** (근원 2개): ① /due predicate ISO bind 통일(`progress/routes.ts` — `datetime('now')` → `new Date().toISOString()` bind) + 당일 due 회귀 가드 테스트 신설(`progress/__tests__/routes.test.ts` "당일(1시간 전 ISO) → due 포함" — 구 predicate 에서 FAIL 하는 진짜 가드) ② DueItem.nodeId `string|null` 정정 + "node 카드 기반" 주석/PITR §사실/단위·e2e 픽스처 4곳 동기 정직화 (exam 카드 행 포함 계약).
- **MINOR 3건 즉시 해소**: SessionStart 안내문 effectiveAvailable 표시 일치 / StudyFlow handleStart deps `[state, streak.longest]` / 픽스처 cardType 실값화. 잔여 MINOR(SessionStart 신규 문자열 i18n 등)는 본 보고서가 carry-over 기록처.
- **재검증**: api 694 PASS(+1 회귀 가드) / web 31 / E2E 19 / typecheck·lint·g1 PASS.
