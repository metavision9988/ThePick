# 4-Pass 독립 리뷰 통합 보고서 — Session 059 Pass 3 M1+M2 흡수

> **본 리뷰**: Pass 3 ADVOCATE M1 (PII log sanitize) + M2 (SQL 구조 마스킹) 흡수에 대한 4-Pass 독립 에이전트 검증.
> **세션**: 059 (handoff-067 §3 우선순위 1 처리 후속)
> **타임스탬프**: 2026-05-08 17:26 KST
> **변경 commit (예정)**: feat(phase2a-user-search): Pass 3 M1+M2 흡수 + 4-Pass CRITICAL/MAJOR 4건 흡수

## 리뷰 범위

### 변경 파일 (5개)

신규:

- `apps/api/src/search/log-redact.ts` — `digestQueryForLog(query): { length, hash }` Web Crypto SHA-256 12-hex prefix
- `apps/api/src/search/__tests__/log-redact.test.ts` — 8 tests

수정:

- `apps/api/src/search/user-search.ts` — UserSearchError 3 throw site 의 message 에서 underlying err.message 제거 (cause 보존)
- `apps/api/src/search/routes.ts` — console.error → canonical createLogger (Pass 4 MAJ-1 흡수) + digestQueryForLog wrap (Pass 1 CRIT-1) + ENVIRONMENT 'development' 매칭 (Pass 3 MAJ-A1)
- `apps/api/src/search/__tests__/routes.test.ts` — Pass 3 M1+M2 + CRIT-1 + ENV 테스트 6건 추가

### 연관 파일 (변경 X, 컨텍스트)

- `docs/plans/phase2a-user-search-route.plan.md`
- `docs/architecture/SEARCH_PIPELINE.md`
- `docs/adr/ADR-008-graceful-degradation-thresholds.md`
- `packages/shared/src/logger.ts` (canonical logger 비교 기준)
- `apps/api/src/auth/rate-limit.ts`
- `apps/api/wrangler.toml`

## 4-Pass 결과 요약

| Pass        | 에이전트                                  | 판정               | CRITICAL | MAJOR | MINOR |
| ----------- | ----------------------------------------- | ------------------ | -------- | ----- | ----- |
| 1 SURGEON   | `pr-review-toolkit:silent-failure-hunter` | 수정 필요          | 1        | 2     | 3     |
| 2 ARCHITECT | `system-architect`                        | 완료 가능          | 0        | 1     | 2     |
| 3 ADVOCATE  | `security-engineer`                       | 수정 필요 (조건부) | 0        | 2     | 4     |
| 4 CONTRACT  | `pr-review-toolkit:code-reviewer`         | 수정 필요 (M1 1건) | 0        | 1     | 2     |

**합계**: CRITICAL 1 / MAJOR 6 / MINOR 11

---

## Pass 1 SURGEON (Bottom-Up 코드 정합성)

### CRITICAL 1건

**CRIT-1** `routes.ts:96-108` — `digestQueryForLog` throw 시 catch 블록 자체가 unhandled rejection 으로 발산 → user response 깨짐 + PII 마스킹 정책 무력화

- **위험**: `crypto.subtle.digest` Workers 1급 지원이나 polyfill 미장착/test 환경 throw 가능. catch 블록 내부 throw 시 Hono 기본 errorHandler 가 stack trace 출력 → PII 마스킹 우회 가능.
- **흡수 (Session 059)**: routes.ts:97-103 try-catch wrap, fallback `{ length: query.length, hash: 'hash_unavailable' }`. 테스트 routes.test.ts "Pass 1 CRIT-1" 추가.

### MAJOR 2건

**MAJ-1** `routes.ts:108` — `console.error(JSON.stringify(...))` 가 cause 체인 미surface → production 디버깅 불가

- **carry-over (별도 step)**: cause.message 자체가 SQL keyword 포함 가능 → canonical logger serializeError 에 SQL keyword pattern redact 추가 후 진입.
- 본 step 임시 조치: `causeName` 만 logRecord 에 surface (causeMessage 미surface).

**MAJ-2** `user-search.ts:155-160` — zod schema `query.min(1)` 이 trim-aware 가 아님 (공백 query 통과)

- **carry-over**: 실 무해 (embed phase 에서 자연 실패), 우선순위 낮음.

### MINOR 3건 (carry-over)

- MIN-1 Web Crypto polyfill 부재 (engines node>=19)
- MIN-2 12-hex prefix (~48-bit) 충돌 가능성 영속 부재
- MIN-3 errMessage 필드 exact-match 검증 부재

---

## Pass 2 ARCHITECT (Top-Down 연계)

### MAJOR 1건

**M1** Multi-Path Fallback (Rule 18 / ADR-015) carry-over 진입 시 `digestQueryForLog` request 당 2~3회 재계산 위험

- **carry-over (Multi-Path step)**: `c.set('queryDigest', ...)` Hono context 캐시 패턴 도입. SEARCH_PIPELINE.md §2 의 5개 분기 (keyword-fast / hybrid / multi-path 등) 각각 별도 telemetry 시 재사용.

### MINOR 2건 (carry-over)

- m1 `SEARCH_RATE_LIMITER_IP` undefined 시 fail-open vs auth 모듈 fail-closed 정책 불일치
- m2 log-redact.ts 위치 — Year 2 시점 `packages/shared` 승격 검토

### 판정: 완료 가능 (CRITICAL 0)

- Workers Web Crypto SHA-256 1급 지원 검증 (auth/password.ts PBKDF2 패턴 정합)
- CPU 50ms budget 무영향 (실패 경로만 호출, 정상 hot path 미진입)
- D1 schema / Ontology Lock / Temporal Graph / IndexedDB 무관
- Concurrent Execution carry-over 호환 (deterministic pure function)

---

## Pass 3 ADVOCATE (보안 + UX)

### MAJOR 2건

**MAJ-A1** `routes.ts:94` ENVIRONMENT 매칭 mismatch — wrangler.toml `"development"` ↔ 코드 `'dev'`

- **흡수 (Session 059)**: routes.ts:94 `'dev' || 'development' || 'test'` 확장. `wrangler dev` 로컬 환경에서 dev mode response (full err.message) 정상 노출.
- 테스트 routes.test.ts "Pass 3 MAJ-A1" 추가.

**MAJ-A2** UserSearchResult.query 응답 body echo — 정상 200 응답에 학습자 query 평문 그대로 echo

- **carry-over (별도 step + ADR)**: M1 흡수의 위협 모델 ("운영 로그 평문 노출") 외 surface (Cloudflare Logs / CDN edge log / 네트워크 인터셉터 / Service Worker 캐시) 에서 PII leak 재발 가능. 응답 body `query` 필드 제거 vs hash 대체 vs UX 보존 trade-off 결정 필요.

### MINOR 4건 (carry-over)

- MIN-1 SHA-256 unsalted → 짧은 query (사번 7자리 ID 등) dictionary attack 가능 → HMAC-with-pepper 검토
- MIN-2 length 단독 노출이 query 패턴 측면-채널 추적 가능 → bucket 화 검토
- MIN-3 검색 모듈만 global `createLogger` 미사용 → **Session 059 흡수 (Pass 4 MAJ-1 동시)**
- MIN-4 zod `parsed.error.format()` 응답이 향후 `.refine()` 추가 시 input echo 가능 → predefined safe shape

### 판정: 수정 필요 (조건부) → MAJ-A1 흡수 후 PASS

---

## Pass 4 CONTRACT (기획 대조 + Silent Pivot)

### MAJOR 1건

**M1** Structured Logger 미적용 — 프로젝트 canonical `createLogger` (`@thepick/shared/logger`) 미사용

- **흡수 (Session 059)**: routes.ts 가 canonical createLogger 도입. schema 통일 (level/message/service/environment/timestamp/module + context fields).
- **단, 의도적 trade-off**: `logger.error(msg, err, ctx)` 의 `err` 인자 미전달. 이유: serializeError 가 cause chain 자동 surface 시 underlying D1/Vectorize error.message (SQL keyword) 가 logRecord 에 노출 → Pass 3 M2 마스킹 정책과 충돌.
- **Pass 1 MAJ-1 carry-over 정합**: causeName 만 surface, causeMessage 미surface. canonical logger serializeError 에 SQL keyword pattern redact 추가 후 진입.

### MINOR 2건 (carry-over)

- m1 JSDoc / 계약 문서 drift — handoff-067/068 + plan §3 + SEARCH_PIPELINE.md 영속 갱신
- m2 SHA-256 12-hex prefix 충돌 trade-off ADR 부재 → log-redact.ts JSDoc 또는 별도 ADR

### Hard Rules 검증 (Pass 4 정합)

- **Hard Rule 17** grep `'son-hae-pyeong-ga-sa'` 리터럴 0건 in `apps/api/src/search/` ✓
- **Hard Rule 16** zero-cost — `examId: ExamId` 첫 인자 강제 유지, EXAM_IDS 경유 ✓
- **상용 품질** any 0건 / TODO 0건 / import \* 0건 / fs|path|node: 0건 ✓
- **하드코딩 명명상수화** `QUERY_HASH_PREFIX_LEN = 12` ✓

### 판정: 수정 필요 (M1 1건) → 본 step 흡수 후 PASS

---

## ★★★ 본 세션(059) 흡수 결정

### 즉시 흡수 (Session 059, 본 commit)

1. **Pass 1 CRIT-1** — `digestQueryForLog` try-catch wrap + 'hash_unavailable' fallback (PII 정책 보존)
2. **Pass 4 MAJ-1** — canonical `createLogger` 도입 (schema 통일)
3. **Pass 3 MAJ-A1** — ENVIRONMENT `'development'` 매칭 추가 (`wrangler dev` 로컬 DX)

### Carry-over (다음 step / 별도 ADR)

| 항목                                                     | 출처   | 진입 step                                                                  |
| -------------------------------------------------------- | ------ | -------------------------------------------------------------------------- |
| **MAJ-A2** 응답 body `query` echo 정책                   | Pass 3 | ★ Multi-Path Fallback step 또는 별도 ADR                                   |
| **MAJ-1** `causeMessage` 운영 디버깅 surface             | Pass 1 | canonical logger serializeError 에 SQL keyword pattern redact 추가 후 진입 |
| **M1 (Pass 2)** Multi-Path queryDigest Hono context 캐시 | Pass 2 | Multi-Path Fallback step (Rule 18 / ADR-015)                               |
| MAJ-2 zod trim refine                                    | Pass 1 | Phase 2A 내 우선순위 낮음                                                  |
| MIN-1~3 (Pass 1)                                         | Pass 1 | Phase 2A 종료 전 검토                                                      |
| MIN-1~4 (Pass 3)                                         | Pass 3 | Phase 2A 종료 전 검토                                                      |
| m1, m2 (Pass 4)                                          | Pass 4 | handoff-068 + plan §3 + SEARCH_PIPELINE.md 영속 갱신                       |

---

## 회귀 검증

### apps/api 테스트

- Session 058 종착: 396 PASS
- Session 059 Pass 3 M1+M2 흡수 (1차): 408 PASS (+12 = log-redact 8 + routes M1/M2 4)
- Session 059 4-Pass CRITICAL/MAJOR 흡수 (2차): **410 PASS (+2 = CRIT-1 fallback + ENV development)**

### typecheck / lint / verify

- `pnpm --filter @thepick/api typecheck` PASS (clean)
- `pnpm --filter @thepick/api lint` PASS (0 ESLint issues)
- `verify-engine-contracts.ts` post-absorb run1 = 7 PASS / 0 FAIL / 1 SKIP (Cat 8) — 일관성

### Hard Rules

- **Hard Rule 17** grep search/ 디렉토리 examId 리터럴 0건 ✓
- **상용 품질** quality-gate.sh detection (any / console.log / TODO / 빈 catch) 0건 ✓

---

## 판정: **완료 가능**

- CRITICAL 1건 (CRIT-1) **즉시 흡수 PASS**
- MAJOR 6건 중 3건 즉시 흡수 PASS, 3건 별도 step carry-over 명시
- MINOR 11건 carry-over (Phase 2A 종료 전 또는 Year 2)
- 회귀 0건, schema 통일, PII/SQL 마스킹 정책 100% 봉인

**다음 step 권고 (handoff-068)**:

1. Multi-Path Fallback (Rule 18 / ADR-015) plan — Stage 2 0건 시 Keyword + Topic Cluster fallback. Pass 2 MAJ-1 carry-over (queryDigest Hono context 캐시) 흡수 동시.
2. ADR — 응답 body `query` echo 정책 (제거 vs hash 대체 vs UX 보존)
3. canonical logger serializeError 에 SQL keyword pattern redact 추가 → Pass 1 MAJ-1 (causeMessage surface) 활성

---

**보고서 작성**: Claude (Opus 4.7 1M context)
**리뷰 방식**: 4 독립 에이전트 병렬 (silent-failure-hunter / system-architect / security-engineer / pr-review-toolkit:code-reviewer)
**프로토콜 정합**: `.claude/rules/auto-review-protocol.md` 규칙 0~4 준수
**파일 위치**: `.claude/reviews/review-20260508-172630-session-059-pass3-m1m2-4pass.md`
