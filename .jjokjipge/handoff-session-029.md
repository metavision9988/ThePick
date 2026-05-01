# Handoff — Session 029 → Sprint 1 §5.2~§5.4 + ENGINE_HARDENING_COMPLETION_REPORT v1.2

작성일: 2026-05-01 ~23:50 KST
직전 세션: 028 (Phase A → B → C + 두 차례 4-Pass 흡수 + Sprint 1 §5.1 완료)

---

## 0. 본 세션(028) 누적 결과

### 0.1 7 commits 체인

|  #  | Commit    | 단계                  | 핵심                                                                                                                                   |
| :-: | :-------- | :-------------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
|  1  | `7248133` | Phase A               | ENGINE_HARDENING_COMPLETION_REPORT v1.0 → v1.1 (7가지 인지 부조화 흡수, §10.7 검증되지 않은 영역 15 항목 신설)                         |
|  2  | `e5273da` | Phase B               | localStorage → httpOnly cookie 전환 (Sentinel CRITICAL 흡수). api 257 PASS, +18 cookie 테스트                                          |
|  3  | `afb323d` | Phase C               | Sprint 0 baseline P0 17건 정직 측정 (PASS 3 / PARTIAL 7 / NOT-IMPL 7). Mephisto 예언 적중률 ~37.5%                                     |
|  4  | `33f5d3f` | 4-Pass 흡수 (Phase B) | CRITICAL-3-1 (cache-policy /api/telemetry/) + MAJOR 4 즉시 흡수. api 261 PASS                                                          |
|  5  | `1c54a85` | Sprint 1 §5.1         | naive recursive DFS → iterative DFS + MAX_SUPERSEDE_CHAIN_DEPTH=50000 sentinel + SupersedeChainTooDeepError. quality 41 → 48           |
|  6  | (포함됨)  | (review 인덱스)       | review-20260501-231032-phaseB-4pass.md (commit 4 인덱스)                                                                               |
|  7  | `b587bdc` | 4-Pass 흡수 (§5.1)    | CRITICAL-1 caller 통합 (qg2-validator graceful + pipeline 명시 분기 + index.ts re-export + JSDoc) + MAJOR 2 즉시 흡수. batch 236 → 238 |

### 0.2 본 세션 핵심 발견

#### CRITICAL 발견 (총 4건 모두 즉시 흡수)

|  #  | 발견 위치            | 내용                                                                                                                       |
| :-: | :------------------- | :------------------------------------------------------------------------------------------------------------------------- |
|  1  | Phase B 4-Pass       | `cache-policy.ts` PRIVATE_PATH_PREFIXES 에 `/api/telemetry/` 누락 — Vary: Cookie 미부착, cross-admin leak 위험 (OWASP A01) |
|  2  | Sprint 0 baseline    | naive recursive DFS V8 stack overflow @ N=10K deep chain                                                                   |
|  3  | Sprint 0 baseline    | anthropic-adapter sendMessage/sendVision NOT_IMPLEMENTED throw (CHA-03 측정 불가, P1 재분류 권고)                          |
|  4  | Sprint 1 §5.1 4-Pass | SupersedeChainTooDeepError caller 통합 누락 (silent breaking change + DoS 2차 위험)                                        |

#### Mephisto 예언 검증 결과

- 적중률 ~37.5% (4건 평가 가능 중 1.5건)
- "8~12 PASS" 낙관 예측 → 실제 3 PASS = **더 비관적**
- v1.1 §10.7 미검증 15 항목과 baseline 14 미검증 항목 정확히 정합 = 정직화 사후 검증 효과

### 0.3 본 세션 게이트 통과 누적 검증

- `apps/api` test 257 → 261 PASS (+18 cookie + +4 examId 422)
- `apps/admin-web` typecheck clean
- `packages/quality` test 41 → 48 PASS (+7 deep chain regression)
- `apps/batch` test 236 → 238 PASS (+2 SupersedeChainTooDeepError graceful)
- `packages/shared` test 33 PASS
- `verify-engine-contracts.ts` PASS=4 FAIL=0 SKIP=2 (every step)
- 4-Pass 독립 에이전트 리뷰 2회 (Phase B + Sprint 1 §5.1) — review-20260501-\* 산출물 영속

---

## 1. Sprint 1 진행 상태 (handoff-028 §2.D + Sprint 0 baseline §5)

```
[x] §5.1  CRITICAL-N1   iterative DFS + MAX_SUPERSEDE_CHAIN_DEPTH sentinel    ← 본 세션
[x] §5.1  4-Pass 흡수   caller 통합 (qg2-validator/pipeline/index.ts/JSDoc)   ← 본 세션
[ ] §5.2  Day 1 도구    MSW/Workers Pool/sinon/fixtures/perf wrapper          ← 차세션 (~1일)
[ ] §5.3  NOT-IMPL 7    CHA-01/02/04/05 + FUZ-01/02 신규 구현                  ← 차세션 (~3일)
[ ] §5.4  PARTIAL 7     CHA-06/FUZ-04/PRF/PRC/REC 보강                        ← 차세션 (~2일)
[ ] 종료   17/17 PASS   verify-engine-contracts.ts Cat 5 부분 자동화           ← BATCH-1 진입 트리거
```

**P0 17건 현재 상태** (review-sprint0-baseline §1):

- PASS 3건: REG-01 / REG-02 / PRC-02
- PARTIAL 7건: CHA-06 / FUZ-04 (5/12) / PRF-01 (119/255) / PRF-02 (정확성 PASS, 성능 비교 부재) / PRC-01 (119/255) / REC-01 (1/50) / REC-02 (1/5)
- NOT-IMPLEMENTED 7건: CHA-01 / CHA-02 / CHA-03 / CHA-04 / CHA-05 / FUZ-01 / FUZ-02

**§5.1 흡수 후 변동**:

- PRF-02 정확성 측면 → PASS 승격 가능 (iterative DFS + sentinel 정확성 검증 완료, +7 회귀 테스트). 다만 "naive vs Tarjan SCC 비교" 시나리오는 미구현 → PARTIAL 유지가 정확.
- 새 발견: deep chain stack overflow 차단 = §10.7 #6 결론 도출 → Tarjan SCC **미도입 결정** (Year 2 재검토)

---

## 2. 차세션 진입 액션 명세 (Sprint 1 §5.2~§5.4)

### 2.A — §5.2 Day 1 도구 정비 (~1일)

**목적**: §5.3 NOT-IMPLEMENTED 7건 + §5.4 PARTIAL 7건 신규 구현의 기반 도구 도입.

| 액션                                                         | 위치                                                                  | 시간 | 사유                                                                                                       |
| :----------------------------------------------------------- | :-------------------------------------------------------------------- | :--: | :--------------------------------------------------------------------------------------------------------- |
| MSW Anthropic mock 확장                                      | `apps/api/src/__tests__/helpers/msw-anthropic.ts` 신규                |  2h  | CHA-03 (Phase 2 재분류 권고) + FUZ-02 (Claude 변조 응답)                                                   |
| Workers Vitest Pool 도입 검토                                | `apps/api/vitest.config.ts` + 별도 ADR                                |  3h  | CHA-01 D1 disconnect / CHA-05 Vectorize timeout — 현재 Hono mock 으로 충분한지 결정                        |
| sinon.useFakeTimers (또는 Vitest vi.useFakeTimers 패턴 정립) | 패턴 문서                                                             | 0.5h | CHA-04 wall clock skew. Vitest `vi.useFakeTimers()` 가 이미 사용 가능 — 신규 의존성 0건                    |
| `tests/fixtures/pdf-malicious/` 5종 + README                 | 신규 디렉토리                                                         | 1.5h | FUZ-01 (0바이트 / 헤더만 / 압축폭탄 / malformed xref / JS embedded)                                        |
| `tests/fixtures/claude-malformed/` 8종 + README              | 신규 디렉토리                                                         |  2h  | FUZ-02 (빈 JSON / parse 에러 / XSS / examId 누락 / ontology 미등록 / 깊이 100 / 100MB / Hard Rule 17 위반) |
| `performance.now()` 측정 wrapper                             | `packages/shared/src/test-helpers/perf.ts` 또는 `tools/test-helpers/` |  1h  | PRF-01 / PRF-02 / PRF-04 — p99 / cache hit rate / 직렬 latency 측정                                        |

**산출물**:

- ADR — Workers Vitest Pool 도입 결정 (도입 / dev-only / N/A 중 1)
- `tools/test-helpers/perf.ts` (또는 packages/shared) — `measure(label, fn, runs)` 패턴
- `tests/fixtures/{pdf-malicious,claude-malformed}/` 디렉토리 + 13 fixtures + 각 README

**커밋**: `chore(test): Sprint 1 §5.2 Day 1 도구 정비 — MSW + fixtures + perf wrapper`

### 2.B — §5.3 NOT-IMPLEMENTED 7건 신규 구현 (~3일)

§5.3 권고 작업 (review-sprint0-baseline §5.3):

| 시나리오 | 작업                                             | 시간 | 특이사항                                                  |
| :------- | :----------------------------------------------- | :--: | :-------------------------------------------------------- |
| CHA-01   | D1 disconnect 10% MSW + retry 검증               | 0.5d | apps/batch wire-up (telemetry MAJOR-S2) 와 동시 진행 가능 |
| CHA-02   | CalculationTimeoutError 추가 + 무거운 산식       | 0.5d | packages/formula-engine engine.ts 수정                    |
| CHA-03   | **P1 재분류 권고**                               |  —   | anthropic-adapter NOT_IMPL 정합. handoff §3 정책 결정     |
| CHA-04   | sinon (vi.useFakeTimers) clock skew + recover Q1 | 0.5d | apps/batch recover.ts 의 elapsed abs 처리 검증            |
| CHA-05   | **P1 재분류 권고**                               |  —   | hybrid-search Phase 1 후반 활성. handoff §3 정책 결정     |
| FUZ-01   | 5종 PDF + PdfParseError 분류                     | 0.5d | packages/parser pdf-extractor.ts                          |
| FUZ-02   | 8종 변조 응답 + KnowledgeContractValidationError |  1d  | packages/parser schema-validator.ts                       |

**진산님 정책 결정 필요**: CHA-03 + CHA-05 P1 재분류. Year 1 BATCH-1 적재는 Claude Code 직접 처리이므로 anthropic-adapter / Vectorize 활성 미필요. 본 baseline 의 평가 보류 사유 정합.

**커밋 단위**: 시나리오별 1 commit + Day 별 4-Pass 리뷰 의무.

### 2.C — §5.4 PARTIAL 7건 보강 (~2일)

| 시나리오 | 작업                                                       | 시간 | 본 세션 흡수된 부채                                             |
| :------- | :--------------------------------------------------------- | :--: | :-------------------------------------------------------------- |
| CHA-06   | wrangler cron + GC catch-up                                | 0.5d | —                                                               |
| FUZ-04   | 7 vectors 추가 (12-5=7)                                    | 0.5d | —                                                               |
| PRF-01   | 성능 메트릭 wrapper + p99 측정                             | 0.5d | §5.2 perf wrapper 의존                                          |
| PRF-02   | N=5K/10K/50K Tarjan vs iterative-DFS 비교                  | 0.5d | **§5.1 흡수로 iterative DFS 검증 완료. Tarjan SCC 비교만 잔존** |
| PRC-01   | batch6~10-golden 또는 5 시나리오 expansion                 | 0.5d | 119/255 → 255/255                                               |
| REC-01   | 4 시점 × 10 반복 추가 (5/25/75/95% × 10)                   | 0.5d | parameterize test                                               |
| REC-02   | 4 변조 케이스 추가 (trailing 0 / key reorder / 공백 / BOM) | 0.5d | checkpoint.test.ts                                              |

**§5.4 동시 흡수 권고 — 본 세션 4-Pass 이월 MAJOR 5건**:

- **MAJOR-2 (path.indexOf O(depth))**: `pathIndex: Map<string, number>` 보조 자료구조 도입 → graph-integrity.ts:241 cycle 발견 시 O(1) 탐색. cycle-heavy graph 회귀 microbench 추가
- **MAJOR-3 (heap sentinel)**: `validateGraphIntegrity` 진입점에 `MAX_GRAPH_NODES`/`MAX_GRAPH_EDGES` sentinel 추가
- **MAJOR-6 (boundary 회귀)**: `MAX_SUPERSEDE_CHAIN_DEPTH = 50000` 정확 boundary 회귀 (=50000 통과 / =50001 throw) + nested cycle 회귀 추가
- **MAJOR-7 (multi-cycle determinism)**: `determinism.property.test.ts` 에 multi-cycle 3개 분리 fixture × 100 iter shuffle 회귀 추가

### 2.D — Sprint 1 종료 게이트 + ENGINE_HARDENING_COMPLETION_REPORT v1.2 (별도)

**Sprint 1 종료 조건** (handoff-028 §2.D 정합):

- P0 17/17 PASS (CHA-03/05 P1 재분류 시 P0 = 15/15 PASS)
- `verify-engine-contracts.ts` Cat 5 부분 자동화 추가
- JSON 리포트 생성 (`apps/batch/sprint1-final-report.json`)
- BATCH-1 진입 진산님 트리거 대기

**ENGINE_HARDENING_COMPLETION_REPORT v1.1 → v1.2 갱신** (MAJOR-5 흡수, 별도 commit):

- §10.7 #6 항목 갱신 — "✅ Sprint 0 baseline (PRF-02) 측정 완료 + Sprint 1 §5.1 commit 1c54a85 + b587bdc 흡수. iterative DFS + sentinel 50000 으로 stack overflow 차단. Tarjan SCC 미도입 결정 (Year 2 멀티시험 재검토)."
- §10.7 #16 신규 — anthropic-adapter NOT_IMPLEMENTED throw (CHA-03 측정 불가)
- §0 Executive Summary "naive DFS 임계 노드 수 미검증" → "✅ Sprint 1 §5.1 흡수"
- §14 결론 갱신

---

## 3. 진산님 정책 결정 사항

### 3.1 CHA-03 / CHA-05 P0 → P1 재분류

**근거**:

- CHA-03: anthropic-adapter sendMessage/sendVision NOT_IMPLEMENTED throw — Year 1 BATCH 적재는 Claude Code 직접 처리이므로 본 어댑터 미경유. 메모리 `project_batch_load_workflow` 정합.
- CHA-05: hybrid-search Phase 1 후반 활성 — 사용자 노출 후 본격 작동.

**진산님 트리거 옵션**:

- A) "P0 → P1 재분류 승인" → P0 = 15/15 PASS 가 Sprint 1 종료 게이트. ai-adapter / hybrid-search 측정은 Phase 2 진입 직전 의무.
- B) "P0 유지 + Year 1 ai-adapter retry/backoff 사전 구현" → CHA-03 만 즉시 구현 (~1일 추가). CHA-05 는 Phase 2.
- C) "본 baseline 에 추가 측정" → 진산님 지적 항목 baseline 갱신 후 재진입.

**권고**: A (P1 재분류). 메모리 `project_batch_load_workflow` + `feedback_no_shortcuts` 정합.

### 3.2 ENGINE_HARDENING_COMPLETION_REPORT v1.2 흡수 시점

**옵션**:

- A) Sprint 1 §5.4 완료 후 v1.2 일괄 갱신 (MAJOR-5 + 본 세션 모든 변경 일괄 흡수)
- B) Sprint 1 §5.2 진입 직전 v1.2 갱신 (§10.7 #6 우선 흡수)
- C) handoff-029 진입 직후 v1.2 갱신

**권고**: A. v1.1 흡수 패턴 (Phase B 머지 후 v1.1.1 별도 commit 안 함, Sprint 1 종료 시점 일괄) 정합.

### 3.3 본 세션 한계 명시 (정직)

본 세션은 명목상 5일 분량의 Sprint 1 권고 중 §5.1 + 4-Pass 흡수 (1일 분량) 만 완료. 누적 7 commits + ~3시간+ 도달로 session-monitor 90분 임계 다중 초과. **§5.2 진입은 차세션 의무**.

---

## 4. 차세션 진입 직후 1차 읽기

### 4.1 핵심 문서 (의무, 우선순위 순)

1. **본 핸드오프** — `.jjokjipge/handoff-session-029.md`
2. **Sprint 0 baseline** — `.claude/reviews/review-sprint0-baseline-20260501-230231.md` (P0 17건 정직 측정 + Mephisto 예언 매트릭스 + §5 권고 작업 순서)
3. **Phase B 4-Pass 인덱스** — `.claude/reviews/review-20260501-231032-phaseB-4pass.md`
4. **Sprint 1 §5.1 4-Pass 인덱스** — `.claude/reviews/review-20260501-233844-sprint1-step5-1-4pass.md` (이월 MAJOR 5건 명세)
5. **ENGINE_HARDENING_COMPLETION_REPORT** v1.1 — `docs/ENGINE_HARDENING_COMPLETION_REPORT.md` (특히 §10.7 검증되지 않은 영역 + §14 결론)
6. **테스트 마스터 플랜** — `docs/ThePick Engine Quality Test Master Plan v1.0.md` §11.1 P0 17건 + §11.2 P1 18건 + §11.3 P2 15건

### 4.2 직전 세션 핸드오프 (체인)

7. `.jjokjipge/handoff-session-028.md` (Phase A → B → C → D 명세)
8. `.jjokjipge/handoff-session-027.md` (Step 19 = Phase 1 closeout)

### 4.3 진산님 메모리 정합 (자동 로드)

- `project_completion_notification_obligation` (Sprint 1 종료 = ★ 알림 의무)
- `feedback_two_fix_failures_zoom_out` (§5.4 PRF-02 / FUZ-04 보강 시 정합)
- `feedback_no_shortcuts` (CHA-03/05 P1 재분류 정당화)
- `project_v3_final_multi_exam_deferred` (Tarjan SCC 미도입 결정 = Year 2 멀티시험 재검토)
- `feedback_review_filename_pattern` (review-\* prefix — 본 세션 산출물 정합)

---

## 5. 진산님 차세션 트리거 키워드

| 트리거                                 | 진행                                                                              |
| :------------------------------------- | :-------------------------------------------------------------------------------- |
| **"§5.2 Day 1 도구 정비 진입"** (권고) | MSW + Workers Pool + sinon + fixtures + perf wrapper (~1일). 차세션 첫 작업.      |
| **"P0 → P1 재분류 + §5.2 진입"**       | CHA-03 + CHA-05 P1 재분류 결정 + §5.2 도구 정비 (Sprint 1 P0 = 15/15 종료 게이트) |
| **"Sprint 1 §5.4 PARTIAL 보강 먼저"**  | 도구 정비 없이 PRF-02 Tarjan 비교 + REC-01/02 + PRC-01 보강 (~2일)                |
| **"이월 MAJOR 5건 먼저 흡수"**         | path.indexOf O(depth) + heap sentinel + boundary + multi-cycle 우선 (~1일)        |
| **"v1.2 보고서 갱신 먼저"**            | ENGINE_HARDENING_COMPLETION_REPORT v1.1 → v1.2 (§10.7 #6 + #16 + §14)             |
| **"Sprint 1 풀 진행"**                 | §5.2 → §5.3 → §5.4 → 종료 게이트 (~5~9일) — 다중 세션 분할 의무                   |

**권고**: "P0 → P1 재분류 + §5.2 진입" — 정책 결정 + 작업 진입 동시. P0 = 15/15 가 종료 게이트로 단순화되며 §5.3 작업량 1/3 감소.

---

## 6. 본 세션이 차세션에 넘기는 의무 (정직)

본 세션 작성자(Claude Opus 4.7)가 차세션 Claude 에게 명시 의무:

1. **본 세션의 7 commits 가 모두 4-Pass 통과 확인됨을 신뢰** — 다만 commit 4 (Phase B 4-Pass) + commit 7 (Sprint 1 §5.1 4-Pass) 의 통합 인덱스를 직접 읽어 어떤 MAJOR 가 이월되었는지 인지 의무.
2. **MAJOR 5건 이월 명시** — Sprint 1 §5.4 또는 v1.2 보고서 갱신 시 동시 흡수 의무. 단순 "Sprint 1 P0 17/17 PASS" 만으로 종료 게이트 통과 안 됨 — auto-review-protocol.md "MAJOR phase 종료 전 해결 또는 다음 phase 명시 이월" 정합.
3. **Mephisto 예언 검증 결과 (~37.5% 적중)** — 본 세션 측정값. 차세션이 §5.4 보강 시점에 다시 측정하면 다를 수 있음. 진산님이 "Mephisto 가 이렇게 말했다" 인용 시 본 baseline 측정값과 대조 의무.
4. **session-health 의무** — 본 세션은 명백히 임계 초과. 차세션도 90분 / 30턴 전 handoff-030 작성 의무.

---

**핸드오프 작성**: Claude (Opus 4.7 1M context) — Session 028
**다음 세션**: Session 029 — Sprint 1 §5.2~§5.4 + v1.2 보고서 갱신
**작성 효력**: 2026-05-01 ~23:50 KST
**예상 완료**: handoff-030 (Sprint 1 P0 17/17 또는 15/15 GREEN 후 → BATCH-1 진입 트리거 대기)
