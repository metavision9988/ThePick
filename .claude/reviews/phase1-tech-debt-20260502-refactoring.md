# Phase 1 5-페르소나 기술부채 심층 리뷰 — refactoring-expert

**작성일**: 2026-05-02 ~15:30 KST
**리뷰 방식**: 독립 에이전트 (`refactoring-expert`, agentId `accd4c03ca79d1294`)
**페르소나 핵심 질문**: "6개월 뒤 이 코드가 버틸까?"
**리뷰 범위**: 7 컴포넌트 + scripts/ + apps/web — formula-engine (1,395 LOC) + parser (2,400+ LOC) + quality (364 LOC) + shared + ai-adapter + batch (3,500+ LOC) + api (3,200+ LOC) + scripts/verify-engine-contracts (725 LOC)
**4-Pass 중복 회피**: §5.4 MAJOR 16건 + §5.5 MAJOR 12건 dedup 후 본 페르소나 = 코드 품질 부채만

---

## 결과 종합

| 분류     | 카운트 |
| :------- | :----: |
| CRITICAL |   2    |
| MAJOR    |   10   |
| MINOR    |   5    |

---

## CRITICAL — 즉시 흡수 의무 (2건)

### C-RF-1: `resolveLoggerEnv` + `KNOWN_ENVIRONMENTS` 6중 복제 (Logger bootstrap 표준화 부재)

**위치 (6 파일 동일 본문)**:

- `apps/api/src/index.ts:49-58`
- `apps/api/src/auth/routes.ts:75-86`
- `apps/api/src/progress/routes.ts:35-46`
- `apps/api/src/telemetry/routes.ts:48-59`
- `apps/api/src/webhooks/payment.ts:71-104`
- `apps/batch/src/pipeline.ts:68-81` + `apps/batch/src/recover.ts:39-49` (변형 `VALID_LOGGER_ENVS`)

**위험 (6개월 후 시나리오)**:

- `LoggerEnvironment` 에 `staging-canary` 추가 시 6+ 파일 수동 동기화 누락 → silent enumeration drift
- `apps/api/src/webhooks/payment.ts:71` 와 `apps/batch/src/pipeline.ts:68` 의 변형 (Set 타입 다름) 이미 silent drift 발생

**권고**:

1. `packages/shared/src/logger.ts` 에 `resolveLoggerEnv(envName: string | undefined): LoggerEnvironment` 단일 export 추가
2. 6 파일 모두 `import { resolveLoggerEnv } from '@thepick/shared'` 로 교체 (~50 lines net 감소)
3. ESLint `no-restricted-syntax` 로 `KNOWN_ENVIRONMENTS` 동일 본문 재선언 차단

### C-RF-2: `withRetry` 중복 구현 — Claude API 경로 vs D1 경로 분기 (정책 fragmentation)

**위치**:

- `apps/api/src/middleware/retry.ts:65-91` — D1 retry (3 attempts, 100ms→400ms exp backoff, NON_RETRYABLE_MESSAGE_PATTERNS 6 패턴)
- `packages/parser/src/batch-processor.ts:236-259` — Claude API retry (모든 에러 retry — TD 이월 명시됨)
- `apps/batch/src/adapters/anthropic-client.ts:8` 주석 — 이미 인지된 부채

**위험 (6개월 후)**:

- 4xx Anthropic 인증 오류(API key 만료) 도 무한 retry → CostMeter `kill_switch` 전까지 budget 폭주
- 두 구현이 별개 evolution path → jitter / patterns 비대칭 → thundering-herd 가능

**권고**:

1. `packages/shared/src/retry.ts` 에 `withRetry<T>(fn, policy: RetryPolicy)` 통합
2. `createD1Policy()` / `createClaudeApiPolicy()` 팩토리 분리
3. 4xx 인증/검증은 즉시 throw (retryable patterns 주입 의무)

---

## MAJOR — 10건 (Phase 2 명시 트래킹)

|  #  | ID      | 제목                                                     | 위치                                                                 | 흡수 시점                          |
| :-: | :------ | :------------------------------------------------------- | :------------------------------------------------------------------- | :--------------------------------- |
|  1  | M-RF-1  | pipeline.ts 1104 lines God File                          | apps/batch/src/pipeline.ts                                           | Phase 2 초기                       |
|  2  | M-RF-2  | BATCH_CONFIGS 시험-특화 한국어 하드코딩                  | apps/batch/src/pipeline.ts:172-233                                   | Year 2 zero-cost                   |
|  3  | M-RF-3  | validateKnowledgeContract 305 lines (사이클로매틱 30+)   | packages/parser/src/schema-validator.ts:139-456                      | Phase 1 종료 게이트                |
|  4  | M-RF-4  | parser console.warn/error 5건 (logger 마이그레이션 누락) | packages/parser/src/batch-processor.ts:199, 299, 367, 378, 398, 405  | Phase 1 종료 게이트                |
|  5  | M-RF-5  | scripts/verify-engine-contracts.ts 725 lines             | scripts/verify-engine-contracts.ts                                   | Phase 2 Cat 5B/Cat 8 활성 직전     |
|  6  | M-RF-6  | isActive !== false 8+ 회 반복 (도메인 의미 누출)         | packages/quality/src/graph-integrity.ts:115, 123, 149, 189, 344, 348 | Phase 2                            |
|  7  | M-RF-7  | LoadDraftContext 손해평가사 특화 누출                    | apps/batch/src/loader/draft-loader.ts:60-63                          | Year 2 zero-cost                   |
|  8  | M-RF-8  | Formula 5 파일 산식 schema DRY 위반                      | packages/formula-engine/src/formulas/batch{1-5}-definitions.ts       | BATCH-1 적재 후 (PRC-01 expansion) |
|  9  | M-RF-9  | admin-web 0 tests + TelemetryDashboard 482 lines         | apps/admin-web/src/components/TelemetryDashboard.tsx                 | CRIT-Q1 통합 (Phase 1 종료 게이트) |
| 10  | M-RF-10 | sandbox MAX_AST_NODE_COUNT 매직 넘버 (Constants DB 부재) | packages/formula-engine/src/sandbox.ts:253-255                       | Phase 2 Constants DB 활성          |

---

## MINOR — 5건 (보고만)

- m-RF-1: `apps/batch/src/pipeline.ts:74` `_envName` underscore prefix
- m-RF-2: `packages/parser/src/schema-validator.ts:217` type guard 캐스트
- m-RF-3: `apps/api/src/auth/routes.ts:545 lines` 라우터 분할 권고
- m-RF-4: `roundTo` JSDoc Number.EPSILON 출처 명시 누락
- m-RF-5: `apps/web/src/i18n/hooks/use-translation.ts:23, 29` console.warn (frontend 컨텍스트)

---

## Devil's Advocate (4 시나리오)

1. **resolveLoggerEnv silent drift**: `staging-canary` 추가 시 6+ 파일 silent 폴백 → SLO 알람 룰 mismatch
2. **withRetry 정책 fragmentation**: Anthropic 401 무한 retry → ADR-006 cost cap $200 의 0.75% 한 batch 에서 소진
3. **BATCH_CONFIGS 한국어 하드코딩**: Year 2 공인중개사 진입 시 schema 분리 못 한 비용 1주 소요
4. **Formula DRY 위반**: BATCH-2 골든 테스트 수정 → 13곳 반복 → 1곳 누락 → "보험금 0원" 컴플레인

---

## 누적 이월 MAJOR 36건 흡수 권고 — refactoring-expert 영역 7건

| #   | 출처             | 항목                                  | 흡수 매핑    |
| --- | ---------------- | ------------------------------------- | ------------ |
| 1   | §5.4 MAJOR-3     | logger.child 인라인 context 잔존      | M-RF-4 통합  |
| 2   | §5.4 MAJOR-7     | withRetry 중복 patterns               | C-RF-2 통합  |
| 3   | §5.4 MAJOR-9     | BATCH_CONFIGS 한국어 hardcoded        | M-RF-2 통합  |
| 4   | §5.5 MAJOR-2     | scripts/verify 단일 파일 700+ lines   | M-RF-5 통합  |
| 5   | §5.5 MAJOR-4     | TelemetryDashboard 482 lines          | M-RF-9 통합  |
| 6   | §5.3 CHA MAJOR-1 | sandbox MAX\_\* 매직 넘버 외부화 부재 | M-RF-10 통합 |
| 7   | §5.2 MAJOR-3     | LoadDraftContext applies_to 누출      | M-RF-7 통합  |

---

## PASS 항목 (증거 기반 6건)

1. Hard Rule 17 EXAM_IDS literal 단일 출처 PASS — ESLint `no-restricted-syntax` 강제 동작 중
2. `import *` wildcard import 0 건
3. `as any` 0 건 / `as unknown` 3 건만 (모두 documented)
4. TODO/HACK 1 건만 (`packages/formula-engine/src/formulas/batch5-definitions.ts:62`)
5. Engine-First Doctrine (ADR-023) PASS
6. graph-integrity iterative DFS 전환 PASS (Sprint 1 §5.1 흡수)

---

## 판정

**수정 필요** — CRITICAL 2건 즉시 흡수 의무.

- C-RF-1 흡수 우선 (1일, ~50 lines 감소, observability invariant 단일 출처)
- C-RF-2 흡수 (1일, 4xx 무한 retry 비용 폭주 차단 직접 효과)
- MAJOR 10건은 Phase 1 종료 게이트 충족 의무 (4건) + Phase 2 진입 시 흡수 (6건)

---

**원본 에이전트**: `refactoring-expert` (agentId: `accd4c03ca79d1294`)
