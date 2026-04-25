---
phase: 1
step: 1-5 (가-1) — BATCH 1 실적재
approved_by: TBD
risk_level: L3
gates_yaml: tasks/step-1-5-ga-1.gates.yaml
scope:
  # 산출 (실측 결과)
  - docs/measurements/claude-api-smoke-{YYYYMMDD}.md (A-1)
  - docs/measurements/pdfplumber-smoke-{YYYYMMDD}.md (A-2)
  - docs/measurements/vision-ocr-smoke-{YYYYMMDD}.md (A-3)
  # Simulation Harness
  - sim/pipeline-adversarial.ts (B-1)
  - sim/__tests__/pipeline-adversarial.invariants.test.ts (B-2)
  # Tech-Debt 코드 패치 (Group C)
  - apps/batch/src/loader/draft-loader.ts (TD-042 examId 시그니처 + TD-044 lost-update race)
  - apps/batch/src/loader/state-machine.ts (TD-042)
  - apps/api/src/progress/rate-limit.ts (TD-042)
  - apps/batch/src/batch-processor.ts (TD-043 withRetry non-retryable)
  - migrations/0013_supersedes_edges.sql (TD-045 — 신규 D1 마이그레이션, 0011 충돌 회피)
  - apps/api/src/scheduled/* (TD-037 외부 알림 경로)
  # 리뷰 산출
  - .claude/reviews/review-{YYYYMMDD-HHMMSS}-step1-5-ga-1-level3.md (D-2)
  - .claude/reviews/review-{YYYYMMDD-HHMMSS}-step1-5-ga-1-4pass.md (D-3)
---

## 목적

가-0 (스켈레톤 + fixture) ✅ 완료 → 가-1 은 **BATCH-1 (적과전 종합위험, 교재 p.403~434, 32 pages) 실적재**.

핵심 전환:

- fixture/mock → **실 Claude API + 실 pdfplumber + 실 Vision OCR + 실 D1 INSERT**
- "상상 adversarial" → **실측 기반 adversarial** (3차 리뷰 결론)

본 plan 은 `tasks/step-1-5-ga-1.gates.yaml` 의 5개 Gate Group(A→B→C→D→E) 진입 절차를 정의한다. CRITICAL RULE #7 에 따라 모든 gate id 가 "pass" 로 명시 기록되기 전 "완료" 선언 금지.

## 기술 선택 근거 (PITR 간단판)

**선정: Group A 실호출 우선 → B Mock 설계 → C TD 해소 → D 품질 → E 승인 (역순 금지).**

비교:

- (A) **A→B→C→D→E 순차** ← 선정. 실측 없는 Mock 무가치 (3차 리뷰).
- (B) C(TD) 먼저 + A/B 병렬 — TD-042 examId 시그니처 변경이 batch-processor 호출부에 영향 → A 실호출 코드와 충돌 가능. 순차가 안전.
- (C) Group D(품질) 먼저 — typecheck/lint 는 코드 작성 후라야 의미. 부적합.

A 선정 이유:

- A-1 실측이 B-1 MockClaudeClient 의 latency/에러 분포 파라미터 소스 (가-1 gates §B-1 `adversarial_params_source: "Gate Group A 실측값 기반 (추측 금지)"` 명시)
- C 가 A/B 보다 먼저 들어가면 TD-042 시그니처 변경이 A 호출 코드에 미반영 → 재작성 비용
- D/E 는 정의상 마지막

## 대상 변경 상세

### Group A — 외부 계약 실측 smoke (코드 변경 ~50 LoC, 산출물 측정 결과)

**A-1. Claude API 실 smoke (5~10회)**

- 입력: BATCH-1 1페이지 단위 (p.403, p.412, p.420, p.430 등 4종 샘플 + 변형 6회 = 10회)
- 코드: `apps/batch/src/__manual__/claude-smoke.ts` (수동 실행 스크립트, 반복 사용 자산)
- 산출: `docs/measurements/claude-api-smoke-{YYYYMMDD}.md` — 응답 shape 표 / stop_reason 분포 / 토큰 실측 / p50·p99 latency / 응답 잘림 케이스 1건 이상 확보
- 환경: 진산님 ANTHROPIC_API_KEY 주입 (`.dev.vars` 또는 wrangler secret) — **실 비용 발생**

**A-2. pdfplumber subprocess 실 smoke**

- 입력: `docs/manual/2026년도 이론서_수정본(26.3.31.).pdf` p.403~405
- 코드: `apps/batch/src/__manual__/pdfplumber-smoke.ts` (이미 `extractPdf` 구현 있을 시 호출만)
- 산출: `docs/measurements/pdfplumber-smoke-{YYYYMMDD}.md` — 추출 text/table shape / stderr 로그 / 실행 시간

**A-3. Vision OCR 실 smoke (1회)**

- 입력: 적과전 §의 도표 페이지 1장 (VisionTrigger 선별 결과 상위 1건)
- 코드: 기존 `vision-client` 의 `enableRealCalls=true` 안전 경로
- 산출: `docs/measurements/vision-ocr-smoke-{YYYYMMDD}.md` — 응답 shape / 토큰 비용 / latency / 추출 정확도(≥80% 검증)

### Group B — Simulation Harness (1000 시드 adversarial)

**B-1. `sim/pipeline-adversarial.ts` 설계**

- MockClaudeClient: A-1 실측 p50/p99 기반 latency 분포, malformed JSON(코드펜스 중복/잘림), timeout, 429, retry-exhaustion
- MockPDF: 가변 페이지(1~500), 빈 페이지, 표 포함/비포함
- MockVisionClient: 성공/실패 확률, 잘못된 페이지 응답
- VirtualClock: token-cost-logger 시간 흐름 통제

**B-2. 1000 시드 반복 + Invariant 6종**

- contract schema-validator 통과 OR 명확한 fail-fast
- maxRetries 초과 0건
- node heap < 500MB
- token-cost-logger 누락 0건 (성공/실패 모두)
- state-machine 불법 전이 0건
- qg2-validator Golden 정확성 1000 시드 100% 유지 (float drift 0)

### Group C — Tech-Debt 5건 해소 (코드 변경 ~300 LoC)

| ID     | 핵심 변경                                                                                                                                                                                                                                                                                    | 예상 LoC |
| :----- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- |
| TD-042 | loadDraft/transitionStatus/checkAndIncrementRateLimit 래퍼 1번째 인자 `examId: ExamId` 추가 (Rule 16)                                                                                                                                                                                        | ~80      |
| TD-043 | withRetry 에서 `AnthropicNonRetryableError` (400/401/403/404/422) 즉시 throw — 토큰 비용 3배 + 14초 낭비 차단                                                                                                                                                                                | ~40      |
| TD-044 | **scope 확장** (3차 5-페르소나 M-8): (a) draft-loader SELECT→INSERT race → `meta.changes` 기반 실삽입 수 측정, (b) `apps/api/src/progress/routes.ts` `/review` UPSERT atomic counter (`UPDATE ... SET total_reviews = total_reviews + 1`) — Year 1 배포 즉시 영향, draft-loader 와 동일 패턴 | ~90      |
| TD-045 | migrations/0013 — CONST-900→901 SUPERSEDES 엣지 (Temporal Graph 무결성, 0011 충돌 회피)                                                                                                                                                                                                      | ~30 SQL  |
| TD-037 | Scheduled 외부 알림 (Cloudflare Email Routing 또는 webhook) — GC 연속 N회 실패 시 운영자 페이저                                                                                                                                                                                              | ~80      |

### Group D — 품질 검증

**D-1**: `pnpm typecheck && pnpm lint && pnpm -r test` 14 워크스페이스 green / 350+ tests PASS
**D-2**: Guide Level 3 전면 점검 (`Guide/3단계리뷰.md` 1~4단계) → CRITICAL 0 / MAJOR ≤ 3 (TD 이월 명시)
**D-3**: 4-Pass 독립 에이전트 리뷰 (Surgeon/Architect/Advocate/Contract) — 가-1 전체 변경 대상, 증거 3개+ 반론 1개+

### Group E — 인간 승인 (L3 Final Gate)

E-1 체크리스트:

- Gate A/B/C/D 전부 pass 증거 제시
- 실 Claude 호출 예상 비용 (BATCH-1 전체 적재 견적)
- 롤백 전략 (적재 실패 시 status_transitions 기반 복구)
- 본 plan 의 "## 승인 기록" 섹션 갱신 + 대화 인용

## 비용 견적 (실 Claude 호출)

**Group A smoke 비용 (가-1 진입 직후):**

- A-1: Haiku 10회 × ~3500토큰/회 (입력 ~1500 + 출력 ~2000) = 35K 토큰
  - 입력 15K × $0.25/1M + 출력 20K × $1.25/1M = **$0.029**
- A-3: Vision Sonnet 1회 × 이미지 1500 + 출력 1000 토큰
  - $3/1M × 1.5K + $15/1M × 1K = **$0.020**
- **소계: ~$0.05** (50원 미만)

**BATCH-1 전체 실적재 (가-1 통과 후 본 적재 시):**

- 32 pages × 페이지당 ~3500 토큰 = 112K 토큰 (Haiku)
- Vision 추가 도표 1~3장 (Sonnet)
- **총 견적: ~$0.20~0.50** (300~700원)

⚠️ A-1 실측 후 페이지당 토큰 정확값 기반으로 재계산하여 E-1 체크리스트에 갱신.

## 위험 분석

| 위험                                                            | 완화                                                                                                                                                                                                 |
| :-------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-1 실호출 비용 폭주 (의도하지 않은 루프)                       | maxRetries 강제 + token-cost-logger 실시간 감시 + smoke 스크립트 호출 횟수 상수 (`SMOKE_CALLS = 10`) 하드코딩 + 진산님 사전 승인 비용 한도 합의                                                      |
| Group C TD-042 examId 시그니처 변경이 가-0 산출물 회귀 유발     | 시그니처 변경 후 즉시 typecheck → 호출부 전수 갱신. 가-0 시나리오 테스트 350+ 재실행 의무                                                                                                            |
| TD-045 마이그레이션 0013 — 기존 D1 데이터 손상                  | local-db.ts idempotent 처리 (가-0 에서 확장) + dry-run 먼저. UPDATE 금지 패턴 준수 (INSERT + SUPERSEDES 엣지만). 번호 0013 은 기존 0011_revision_2026_constants_seed / 0012_rate_limits 와 충돌 회피 |
| B-1 Mock 파라미터를 A 실측 없이 추측 → /simulate 가치 0         | gates.yaml `B-1.adversarial_params_source: "Gate Group A 실측값 기반 (추측 금지)"` 강제. A 미통과 시 B 진입 차단                                                                                     |
| Vision OCR 추출률 < 80% — A-3 실패                              | 가-1 전체 중단. 도표 처리 전략 재검토 (Phase 2 이월 또는 수동 입력 fallback) → 별도 ADR                                                                                                              |
| Scheduled 알림(TD-037) Cloudflare Email Routing API 변경 가능성 | Context7 또는 공식 문서로 실제 API 시그니처 확인 후 코드 작성. 추측 금지                                                                                                                             |
| 4-Pass 자가 리뷰 편향 재발                                      | 독립 에이전트 4~5개 병렬 호출 의무 (`auto-review-protocol.md` 규칙 0). 메인 컨텍스트 직접 4-Pass 실행 = 무효                                                                                         |

## 검증 계획

각 Group 종료 시점:

- [ ] **Group A 종료**: 3개 measurement 산출물 작성 / 응답 잘림 1건 이상 확보 / Vision 추출 ≥ 80%
- [ ] **Group B 종료**: 1000 시드 Invariant 0건 위반 / 결정론적 재현 확인 (실패 시드 N → 동일 실패)
- [ ] **Group C 종료**: TD-042/043/044/045/037 모두 코드 + 테스트 + tech-debt.md 체크박스 ✅
- [ ] **Group D 종료**: typecheck/lint/test 14 워크스페이스 green / Guide L3 CRITICAL 0 / 4-Pass CRITICAL 0 + 증거 3개+ + 반론 1개+
- [ ] **Group E 종료**: 진산님 승인 메시지 본 plan 에 인용 기록

## 롤백 전략

- **Group A**: smoke 스크립트는 `__manual__/` 격리. 단순 삭제 또는 보존 (자산화 가능). DB 영향 0
- **Group B**: `sim/` 디렉토리 신규 — 단순 삭제
- **Group C**:
  - TD-042: examId 시그니처 revert (호출부 전수). 영향 큰 변경이므로 Group 내 단위 커밋 필수
  - TD-043: withRetry 분기 revert (단일 함수)
  - TD-044: meta.changes 사용 revert
  - TD-045: D1 migrations idempotent 설계로 재실행 안전. 롤백 시 `DELETE FROM knowledge_edges WHERE relation = 'SUPERSEDES' AND created_at >= '{deploy_time}'` (시간 기반)
  - TD-037: Scheduled 핸들러 분기 revert
- **BATCH-1 적재 실패 시 (가-1 본 적재 단계, E-1 통과 후)**: status_transitions 테이블의 draft 상태 노드 전수 삭제 후 재실행. SUPERSEDES 엣지는 보존(과거 운영 데이터 무관)

## 범위 외 (가-2 또는 Phase 2 이월)

- BATCH-2~7 적재 (가-2~가-7 별도 plan)
- Phase 2 FSRS v4.5 알고리즘 본격 도입
- Phase 2 출처 추적성 `citations` 구조 본격 설계 (수험자 "근거 보기" UX)
- Phase 2 문제 자동 생성기 + 근거 역방향 검증
- SLM/LoRA 도입 (2027-04 재검토 — 동결)

## 검토 흡수 — 3차 5-페르소나 Critical 5건 (2026-04-25)

선행 산출물: `.claude/reviews/review-20260425-204720-step1-5-ga-1-mid-level3.md`

옵션 A 4건 즉시 수정 + 옵션 B 5건 plan 보강 (코드 변경 0). 옵션 A 후속 검증: `review-20260425-211626-step1-5-ga-1-option-a-fix.md`.

### B-1. C-3 IndexedDB → D1 sync 코드 0건 (BE C-1) — Phase 2 명시 이월

- 본질: `apps/web/src/lib/db.ts` 헤더 "9 stores mirroring D1 tables for offline-first PWA" 가 양방향 mirroring 으로 보이나 실제로는 단방향 read. `offlineActions` 큐는 schema 만 정의 / enqueue/replay 0건.
- 처리: `apps/web/src/lib/db.ts:1-12` 헤더 정정 (단방향 read 명시 + Phase 2 sync-engine 모듈 신설 예고).
- 학습자 진도 무결성 보장 시점: Phase 2 진입 직전 별도 plan. 현 가-1~가-7 본 적재 동안 학습자 화면 자체가 Phase 2 책임이라 본 단계 영향 없음.

### B-2. C-4 admin status 전이 API endpoint 부재 (BE C-2) — 가-1 Group B 책임 명시

- 본질: `apps/admin-web/src/components/ContentQueue.tsx` 의 `onStatusChange` prop 정의됨 / `apps/admin-web/src/pages/index.astro:38-42` caller 비어 있음. `apps/api/src` 에 `POST /api/admin/transitions` 라우트 0건. BATCH-1 적재 후 검수 차단.
- 처리: 가-1 **Group B (Simulation Harness)** 의 부산물로 admin transition API endpoint 작성 책임 명시. Group B 완료 정의에 추가:
  - **B-3 (신규)**: `POST /api/admin/transitions` 라우트 + admin-web fetch 호출자 — BATCH-1 적재 직후 검수 가능 상태 보장. (LoC ~60)
- 또는 별도 step 분리 — 진산님 결정 영역. 본 plan 은 "Group B 책임" 으로 우선 기록. 분리 시 plan 갱신.

### B-3. C-5 운영 회로 부재 (DO OP-C-1 + OP-C-2) — Group D 진입 plan 보강

- 본질: Workers Logs 알림 도달 경로 0 + GD 케이스 KV 폴백 0. `apps/api/wrangler.toml:49-51` `[observability]` 만 enable / `apps/api/src/middleware/retry.ts:11-14` "KV 폴백" 주석만. 단일 벤더 원칙 (메모리 등록) 준수 필요.
- 처리: Group D **D-4 (신규)** 추가:
  - D-4-1: `apps/api/wrangler.toml` 에 `analytics_engine_datasets` binding + scheduled 핸들러 `env.TELEMETRY.writeDataPoint(...)` 1줄 추가 (GC 실패 카운터 + deletedCount). (LoC ~10)
  - D-4-2: Tail Worker 별도 작성 — error level 만 선별 → Email Routing 발송 (TD-037 Discord webhook 권장에서 **Email Routing 으로 재선택** — 단일 벤더 원칙). 별도 Worker 1개 (LoC ~50)
  - D-4-3: read-only 핵심 테이블 (`knowledge_nodes`, `formulas`, `constants`) KV 폴백 활성화 — `retry.ts` 주석 코드화. TTL 24h, key=`{table}:{id}`. (LoC ~80)
  - 통과 기준: 503 상황 시뮬 시 KV 폴백 응답 정상 + 임의 GC 실패 시 Email 도달 검증

### B-4. M-8 progress lost-update race — TD-044 scope 확장

- 본 plan §Group C 표 TD-044 행에 직접 반영 (위 §Group C 표 갱신 — `apps/api/src/progress/routes.ts` `/review` UPSERT atomic counter 추가 명시).

### B-5. BE C-4 Year 2 백필 SQL 부재 — 명시 이월

- 본질: ADR-007 §"Year 2 마이그레이션 0005" 가 docs 안에만 존재. 실제 SQL backfill 템플릿 0건. `prevent_X_update` 트리거가 `ALTER TABLE ADD COLUMN NOT NULL` 차단 — Year 2 진입 시 발견 위험.
- 처리: `migrations/_year2_simulation/` 디렉토리 신설 (가-1 Group C 종결 시점) — 시뮬 fixtures (1년차 100행) + backfill SQL 스켈레톤 + golden test 1건. **Phase 2 종료 전 작성 의무**. 가-1 본 작업 외, Phase 1 후반전 별도 plan.

## 진행 권장 단계 (Group A 진입 시점부터)

1. 본 plan 에 진산님 승인 기록 (E 진입 전 사전 승인이 아닌 **plan 자체 승인** — Group A 진입 허가)
2. **Group A 진입**: A-1 → A-2 → A-3 순차 (의존 없음, 병렬 가능하나 비용 모니터링 위해 순차 권장)
3. A 종료 후 measurement 산출물 진산님 검토 → B 진입 허가
4. **Group B 진입**: B-1 (Mock 설계) → B-2 (1000 시드 실행)
5. B 종료 후 **Group C 진입**: TD-042 → TD-043 → TD-044 → TD-045 → TD-037 (의존 순서)
6. C 종료 후 **Group D 진입**: D-1 → D-2 → D-3
7. D 종료 후 **Group E 진입**: 본 plan E-1 체크리스트 모두 충족 → 진산님 최종 승인 (BATCH-1 본 적재 착수 허가)

## 승인 기록

- TBD — 본 plan 에 대한 진산님 승인 메시지 인용 (Group A 진입 허가)
- TBD — Group D 종료 후 E-1 체크리스트 충족 시 BATCH-1 본 적재 착수 허가
