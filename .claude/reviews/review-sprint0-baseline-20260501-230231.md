# Sprint 0 Baseline — P0 17건 정직 측정 보고서

> **2026-05-02 후속 결정 (Session 029)**
>
> 본 baseline §2.2 / §3.1 / §5.3 권고에 따라 **CHA-03 / CHA-05 P0 → P1 재분류 결정**.
> 근거: `docs/plans/engine-hardening/decision-2026-05-02-cha-03-05-p1-reclassification.md`
>
> **Sprint 1 종료 게이트 변경**: 17/17 PASS → **15/15 PASS** (P0 17건 → 15건).
> CHA-03 / CHA-05 는 Phase 2 진입 직전 본격 구현 + 측정 의무로 이월.
> 본 보고서 §3.1 (CHA-03 / CHA-05 항목) 의 "다음 행동" 은 P1 일정 정합으로 재해석.

**측정일**: 2026-05-01 ~23:02 KST
**측정자**: Claude (Opus 4.7 1M context) — handoff-028 Phase C
**근거 문서**:

- `docs/ThePick Engine Quality Test Master Plan v1.0.md` (P0 17 시나리오 정의)
- `docs/Engine Hardening 완료 보고서 v1.0 — 최종 검토.md` §1.4 (Mephisto 예언 5건)
- `docs/ENGINE_HARDENING_COMPLETION_REPORT.md` v1.1 §10.7 (검증되지 않은 영역)
- `.jjokjipge/handoff-session-028.md` Phase C

---

## 0. 본 baseline 의 목적 (Mephisto 종합)

> **"Sprint 0의 baseline 측정을 진산이 가장 두려워해야 해. 그 시점에 PASS는 17건 중 몇 건일까?"**
>
> **본 baseline 의 진정한 가치는 본 보고서가 놓친 영역의 객관적 지도다.**

본 baseline 은 **새 테스트 구현이 아니다**. 현 시점에서 P0 17건 각각이 "현재 어떤 상태인가" 를 정직하게 측정하는 것이다. 측정 결과를 사전 결정하지 않고, **Mephisto 예언이 5/5 적중하든 0/5 적중하든 측정값 그대로** 보고한다.

---

## 1. 종합 결과 (한눈에)

| 분류                |   건수   | 비고                                                                            |
| :------------------ | :------: | :------------------------------------------------------------------------------ |
| **PASS**            | **3건**  | REG-01, REG-02, PRC-02 — 기존 AC-RP / AC-R / cost-meter 자동 검증으로 완전 커버 |
| **PARTIAL**         | **7건**  | CHA-06, FUZ-04, PRF-01, PRF-02, PRC-01, REC-01, REC-02 — 일부 시나리오만 커버   |
| **NOT-IMPLEMENTED** | **7건**  | CHA-01, CHA-02, CHA-03, CHA-04, CHA-05, FUZ-01, FUZ-02 — 측정 자체가 불가능     |
| **합계**            | **17건** | —                                                                               |

**Mephisto 예언 (handoff-028 §1.4): "PASS 8~12건 가능성"**

→ **실제 PASS 3건. 예언보다 더 비관적인 결과** (5~9건 진짜 결함 발견을 예측했으나, **실제는 14건이 PARTIAL/NOT-IMPLEMENTED**). 즉 Mephisto 가 낙관적이었다.

**진산님 핵심 인지 사항**:

- **현 시점에서 BATCH-1 진입 게이트(13.1) "17/17 PASS" 통과율 = 3/17 = 17.6%**
- Phase 1 closeout 보고서 v1.1 §10.7 "검증되지 않은 영역 15 항목" 의 가시화 효과 = **이 baseline 측정 14건과 정합** (대부분 동일 미검증 영역)
- "엔진이 거짓말하지 않는다" 의 의미는 **자동 검증 영역 한정으로** PASS 라는 v1.1 의 정직한 표현이 **본 baseline 측정으로 사후 검증됨**

---

## 2. 본 측정에서 발견된 신규 CRITICAL / MAJOR

### 2.1 CRITICAL-N1 — naive DFS deep chain stack overflow (PRF-02 측정 부산물)

> **시간 복잡도가 아니라 V8 재귀 깊이 한계가 진짜 위험.**

**측정 결과** (microbench `/tmp/prf02-microbench-v2.ts`):

```
=== Shallow random DAG (cycle-free, fanout=4, max edge offset=50) ===
shallow-DAG  N=   100  E=   396  median=    0.15ms
shallow-DAG  N=  1000  E=  3996  median=    0.76ms
shallow-DAG  N=  5000  E= 19996  median=    3.04ms  ← Mephisto 예언 "50ms" 빗나감
shallow-DAG  N= 10000  E= 39996  median=    4.25ms
shallow-DAG  N= 50000  E=199996  median=   37.14ms  ← Worker 50ms CPU 한도 근접

=== Deep chain (worst case: N-1 depth recursion) ===
deep-chain   N=  5000  E=  4999  median=    1.03ms
deep-chain   N= 10000  E=  9999  ❌ ERROR: Maximum call stack size exceeded
```

**의미**:

- 시간 복잡도 측면에서는 N=5,000 노드에서 3ms 로 충분히 빠름. **Mephisto 예언 #1 "naive DFS @ N=5K > 50ms" 빗나감**.
- 그러나 **재귀 구현의 V8 default stack ~10,000 frames 한계가 진짜 임계점**. Deep SUPERSEDES chain 이 10K depth 에 도달하면 즉시 stack overflow.
- 현실적 위험: 매년 1번 개정 × 10년 = 10 chain depth → 폭발 안 함. 그러나 **fixture 실수 / 불량 데이터 / 악의적 입력으로 chain 이 깊어지면 폭발 보장**.

**증거 위치**: `packages/quality/src/graph-integrity.ts:136-189` `findSupersedeCycles` — `function dfs(node)` 재귀 호출.

**대책 (handoff-029 후속 PR 의무)**:

1. **반복 구현 (iterative DFS with explicit stack)** — 즉시 적용 가능. 시간 복잡도 동일, stack 한계 회피.
2. **Tarjan SCC 도입 (Phase 1 후반 → BATCH-1 진입 직전)** — 단일 패스 O(V+E) + iterative. v1.1 §10.7 #6 "naive DFS 임계 노드 수 미측정" 흡수 결론.
3. 즉시: 입력 깊이 sentinel (`MAX_RECURSION_DEPTH`) + early throw `SupersedeChainTooDeepError` (10K 이전에 명시 차단).

### 2.2 CRITICAL-N2 — anthropic-adapter NOT_IMPLEMENTED throw (CHA-03 측정 불가)

> **CHA-03 시나리오 자체가 현 시점에서 측정 불가.**

**증거 위치**: `packages/ai-adapter/src/anthropic-adapter.ts:62-77`

```typescript
async sendMessage(_req: AIMessageRequest): Promise<AIMessageResponse> {
  throw new AIAdapterError(
    `AnthropicAdapter.sendMessage not yet implemented (model=${this.modelDefault}, baseUrl=${this.config.baseUrl}). Phase 3 운영 RAG 진입 시점 본격 구현 예정. Year 1 BATCH 적재는 Claude Code (Opus 4.7) 직접 처리이므로 본 어댑터 미경유.`,
    'NOT_IMPLEMENTED',
  );
}
```

**의미**:

- ai-adapter 13 tests 는 어댑터의 **shape / config / describe()** 만 커버. **실제 API 호출 / retry / backoff 로직은 부재**.
- **Mephisto 예언 #2 "linear backoff" 부분 적중** — 실제는 linear 가 아니라 **backoff 자체가 부재** (NOT_IMPLEMENTED).
- 본 시점 Year 1 BATCH-1 적재는 Claude Code 직접 처리이므로 어댑터 미경유 = **CHA-03 시나리오는 Phase 2 진입 시 본격 구현 후 재측정 필요**.

**대책**:

1. CHA-03 P0 → P1 재분류 (Phase 2 진입 직전 측정 의무) + handoff-029 명시 트래킹
2. 또는 ai-adapter retry/backoff 로직을 Year 1 에 미리 구현 (Phase 2 사용을 위한 준비)
3. v1.1 §10.7 에 항목 #16 (anthropic-adapter NOT_IMPLEMENTED) 추가 후속 갱신

---

## 3. P0 17건 상세 측정 결과

### 3.1 CHA (카오스) 6건

#### CHA-01 — D1 무작위 disconnect 10% rate

| 항목              | 결과                                                                                           |
| :---------------- | :--------------------------------------------------------------------------------------------- |
| **판정**          | NOT-IMPLEMENTED                                                                                |
| **기존 테스트**   | 없음                                                                                           |
| **누락**          | MSW + Workers Vitest Pool 미도입 / 10% 503 주입 / BATCH retry 동작 검증 / checkpoint 보존 검증 |
| **Mephisto 예언** | —                                                                                              |
| **다음 행동**     | Sprint 1 Day 1 도구 정비 (MSW Anthropic + Workers Pool) → P0 17 GREEN 작업 시 첫 신규 구현     |

#### CHA-02 — Worker CPU 50ms 초과 (CalculationTimeoutError)

| 항목            | 결과                                                                                    |
| :-------------- | :-------------------------------------------------------------------------------------- |
| **판정**        | NOT-IMPLEMENTED                                                                         |
| **기존 테스트** | 없음                                                                                    |
| **누락**        | `CalculationTimeoutError` 클래스 부재 / 50ms 한도 sentinel 부재 / 메모리 누수 측정 부재 |
| **관련 코드**   | `packages/formula-engine/src/engine.ts` (timeout 진입점 부재)                           |
| **다음 행동**   | engine.ts 에 `setTimeout`-based bail-out + COMPUTE_TIMEOUT error 분류 추가              |

#### CHA-03 — Anthropic API 5xx → exponential backoff

| 항목              | 결과                                                                        |
| :---------------- | :-------------------------------------------------------------------------- |
| **판정**          | NOT-IMPLEMENTED (구현 부재 — CRITICAL-N2 참조)                              |
| **기존 테스트**   | `packages/ai-adapter/__tests__/anthropic-adapter.test.ts` (config/shape 만) |
| **누락**          | retry 로직 자체 부재 (NOT_IMPLEMENTED throw) / cost-meter 연동 부재         |
| **Mephisto 예언** | "linear backoff" — **부분 적중** (실제는 backoff 자체 부재)                 |
| **다음 행동**     | Phase 2 진입 시 본격 구현. 본 baseline 에서 **CRITICAL-N2 명시 트래킹**     |

#### CHA-04 — Wall clock skew ±10분

| 항목            | 결과                                                                              |
| :-------------- | :-------------------------------------------------------------------------------- |
| **판정**        | NOT-IMPLEMENTED                                                                   |
| **기존 테스트** | 없음                                                                              |
| **누락**        | sinon.useFakeTimers 시뮬레이션 / batch_runs.elapsed abs() 처리 / Q1 24h 가드 검증 |
| **관련 코드**   | `apps/batch/src/recover.ts` (Q1 elapsed 비교)                                     |

#### CHA-05 — Vectorize timeout 2초 fallback

| 항목            | 결과                                                                                              |
| :-------------- | :------------------------------------------------------------------------------------------------ |
| **판정**        | NOT-IMPLEMENTED                                                                                   |
| **기존 테스트** | 없음                                                                                              |
| **누락**        | hybrid-search 자체가 Phase 1 후반 활성 / Vectorize binding mock 부재 / 2초 timeout 발동 검증 부재 |
| **다음 행동**   | Phase 2 진입 직전 (BATCH-1 적재 후 / 사용자 노출 전) 신규 구현 + 측정                             |

#### CHA-06 — Cron Trigger 24h 미실행

| 항목            | 결과                                                                             |
| :-------------- | :------------------------------------------------------------------------------- |
| **판정**        | PARTIAL                                                                          |
| **기존 테스트** | `apps/api/src/scheduled/__tests__/rate-limit-gc.test.ts` — GC 로직 자체는 검증됨 |
| **누락**        | 24h 미실행 catch-up 시뮬레이션 / 알람 발동 (Phase 2)                             |
| **다음 행동**   | wrangler triggers cron 수동 트리거 + GC catch-up 동작 검증                       |

### 3.2 FUZ (퍼즈) 3건

#### FUZ-01 — 악의적 PDF 5종

| 항목              | 결과                                                                                                                       |
| :---------------- | :------------------------------------------------------------------------------------------------------------------------- |
| **판정**          | NOT-IMPLEMENTED                                                                                                            |
| **기존 테스트**   | parser/**tests**/schema-validator.test.ts (스키마만) / batch-processor.test.ts (정상 케이스만)                             |
| **누락**          | 5종 PDF fixture (0바이트/헤더만/압축폭탄/malformed xref/JS embedded) / PdfParseError 분류 / **subprocess zombie 0건 검증** |
| **Mephisto 예언** | "PDF 폭탄에서 subprocess 좀비 시나리오 미검증" — **적중**                                                                  |
| **다음 행동**     | `tests/fixtures/pdf-malicious/` 디렉토리 생성 + 5종 fixture + pdf-extractor.ts 에러 분기                                   |

#### FUZ-02 — Claude 변조 응답 8종

| 항목            | 결과                                                                                                                                                    |
| :-------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **판정**        | NOT-IMPLEMENTED                                                                                                                                         |
| **기존 테스트** | parser/**tests**/schema-validator.test.ts (정상 cases)                                                                                                  |
| **누락**        | 8종 fixture (빈/parse 에러/XSS/examId 누락/ontology 미등록/깊이 100/100MB/Hard Rule 17 위반) / KnowledgeContractValidationError 분류 / PII Masking 검증 |
| **다음 행동**   | tests/fixtures/claude-malformed/ 8종 + schema-validator.ts 에러 분류 코드화                                                                             |

#### FUZ-04 — 산식 sandbox 우회 12종

| 항목            | 결과                                                                                                                                                 |
| :-------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| **판정**        | PARTIAL                                                                                                                                              |
| **기존 테스트** | `packages/formula-engine/src/__tests__/sandbox-bypass.property.test.ts` (6 PASS) + `sandbox.test.ts` (29 PASS) = **35 PASS**                         |
| **커버리지**    | 5/12 vectors covered (AssignmentNode / BLOCKED_SYMBOLS / DISALLOWED_FUNCTIONS / SAFE_SYMBOL_PATTERN / MAX_LENGTH)                                    |
| **누락**        | 7/12 (Reflect API / Symbol.iterator / BigInt 폭탄 `2n**1000n` / Promise resolve / circular reference / Proxy 조작 / Function.prototype.call.bind 등) |
| **다음 행동**   | sandbox-bypass.property.test.ts 에 7 vectors 추가                                                                                                    |

### 3.3 PRF (성능) 2건

#### PRF-01 — Formula Engine 51 산식 처리 속도

| 항목            | 결과                                                                                     |
| :-------------- | :--------------------------------------------------------------------------------------- |
| **판정**        | PARTIAL                                                                                  |
| **기존 테스트** | batch1~5-golden.test.ts = 119 PASS (정확도)                                              |
| **커버리지**    | 51 산식 × 5 시나리오 = 255 케이스 중 119 = ~47%                                          |
| **누락**        | 성능 메트릭 (단일 calculate p99 / 51개 직렬 latency / AST cache hit rate) 측정 도구 부재 |
| **다음 행동**   | `packages/formula-engine/__tests__/perf/` 신규 + `performance.now()` 측정 wrapper        |

#### PRF-02 — naive DFS vs Tarjan SCC 비교 (BREAKER 핵심)

| 항목                      | 결과                                                                                              |
| :------------------------ | :------------------------------------------------------------------------------------------------ |
| **판정**                  | **PARTIAL + CRITICAL-N1**                                                                         |
| **기존 테스트**           | quality/graph-integrity.test.ts (정확성만)                                                        |
| **본 baseline 직접 측정** | shallow DAG: N=5K @ 3ms / N=50K @ 37ms / **deep chain: N=10K stack overflow**                     |
| **Mephisto 예언**         | "naive DFS @ N=5K > 50ms" — **빗나감** (시간), **부분 적중** (Tarjan 도입 결론은 동일, 다른 이유) |
| **CRITICAL 발견**         | **재귀 깊이 V8 ~10K 한계 = stack overflow.** §2.1 참조                                            |
| **다음 행동**             | 즉시 iterative DFS 전환 (1건) + Tarjan SCC 비교 검증 (Sprint 1)                                   |

### 3.4 REG (회귀) 2건

#### REG-01 — BATCH-0 fixture 재실행 invariant 일치

| 항목              | 결과                                                                     |
| :---------------- | :----------------------------------------------------------------------- |
| **판정**          | **PASS** ✅                                                              |
| **기존 테스트**   | `apps/batch/__tests__/reproducibility-idempotency.test.ts:158` AC-RP-1   |
| **검증**          | 15/15 PASS (1.16s) — contract JSON canonical + stage 결과 invariant 동일 |
| **Mephisto 예언** | "timestamp 차이로 미세 불일치" — **빗나감** (현재 PASS)                  |
| **다음 행동**     | 회귀 방어 (CI 통합 의무) — Sprint 1 작업 시 재확인                       |

#### REG-02 — engine_version major bump 시 recover 거부

| 항목            | 결과                                                                 |
| :-------------- | :------------------------------------------------------------------- |
| **판정**        | **PASS** ✅                                                          |
| **기존 테스트** | `apps/batch/__tests__/recover.test.ts:220` AC-R5 (8 PASS)            |
| **검증**        | recovery_failed + manual_review_required + VersionMismatchError 정합 |
| **다음 행동**   | 회귀 방어 + runbook 작성 (v1.1 §10.7 #7)                             |

### 3.5 PRC (정밀도) 2건

#### PRC-01 — Formula Engine 51 산식 vs 교재 6 decimal

| 항목            | 결과                                                                                                                            |
| :-------------- | :------------------------------------------------------------------------------------------------------------------------------ |
| **판정**        | PARTIAL                                                                                                                         |
| **기존 테스트** | batch1~5-golden.test.ts = 119 PASS (6 decimal 일치)                                                                             |
| **커버리지**    | 119/255 (~47%)                                                                                                                  |
| **누락**        | 51 산식 × 5 시나리오 (variation) 의 나머지 136 cases / decimal.js epsilon < 1e-9 자동 검증 / 단위 변환 (g/kg, ml/l) cross-check |
| **다음 행동**   | batch6~10-golden.test.ts 추가 또는 기존 batch1~5 에 5 시나리오 expansion                                                        |

#### PRC-02 — Cost Meter 정수 누적

| 항목            | 결과                                                                                                                  |
| :-------------- | :-------------------------------------------------------------------------------------------------------------------- |
| **판정**        | **PASS** ✅                                                                                                           |
| **기존 테스트** | `apps/batch/__tests__/cost-meter.test.ts:68` (31 PASS) "integer micro-USD accumulation has zero floating-point drift" |
| **검증**        | 1000건 누적 시 정수 정확. 부동소수점 누적 시 0.99999... drift 발생 = ADR-025 정수 정책 정당화 증거                    |
| **누락**        | 100,000건 부하 (시나리오 명세). 1000건은 PASS.                                                                        |
| **다음 행동**   | 부하 확장 (P1 분류 가능)                                                                                              |

### 3.6 REC (회복성) 2건

#### REC-01 — Kill 시점 다변화 (5/25/50/75/95%)

| 항목            | 결과                                                                                                               |
| :-------------- | :----------------------------------------------------------------------------------------------------------------- |
| **판정**        | PARTIAL                                                                                                            |
| **기존 테스트** | reproducibility-idempotency.test.ts AC-RP-3 (50% kill 1건만) + cost-meter-pipeline-kill.test.ts (kill switch 통합) |
| **커버리지**    | 1/50 (2%) — 50% kill 1건                                                                                           |
| **누락**        | 5/25/75/95% kill × 각 10회 반복 invariant 검증                                                                     |
| **다음 행동**   | reproducibility-idempotency.test.ts 에 4 시점 × 10 반복 추가 (Sprint 1 - REC parameterized test)                   |

#### REC-02 — Checkpoint 1바이트 변조 5종

| 항목            | 결과                                                                                            |
| :-------------- | :---------------------------------------------------------------------------------------------- |
| **판정**        | PARTIAL                                                                                         |
| **기존 테스트** | `apps/batch/__tests__/checkpoint.test.ts:150` "AC-R2: 변조 감지" + canonicalJson 6종            |
| **커버리지**    | 1바이트 flip / state_hash modified ✅ — 나머지 4종 (trailing 0 / key reorder / 공백 / BOM) 부재 |
| **누락**        | 5종 변조 시나리오 → 5/5 모두 CheckpointCorruptedError 분류 검증                                 |
| **다음 행동**   | checkpoint.test.ts 에 4 추가 변조 케이스                                                        |

---

## 4. Mephisto 예언 5건 검증 매트릭스

|  #  | 예언 (handoff-028 §1.4)                                              | 실제 측정                                                                                  | 판정                                                    |
| :-: | :------------------------------------------------------------------- | :----------------------------------------------------------------------------------------- | :------------------------------------------------------ |
|  1  | PRF-02 naive DFS @ N=5K > 50ms → Tarjan SCC 즉시 도입 트리거         | N=5K @ 3ms ✅ / **deep chain N=10K stack overflow ❌** / Tarjan 도입 결론 동일 (다른 이유) | **부분 적중** (시간 빗나감, 결론 적중)                  |
|  2  | CHA-03 Anthropic 5xx 폭주 시 backoff = linear (exponential 아님)     | **anthropic-adapter sendMessage NOT_IMPLEMENTED throw** — backoff 자체 부재                | **부분 적중** (linear 아님 적중, 그러나 더 심각한 부재) |
|  3  | FUZ-01 PDF 폭탄에서 subprocess zombie 시나리오 미검증                | NOT-IMPLEMENTED — 5종 PDF fixture 자체 부재                                                | **완전 적중** ✅                                        |
|  4  | FUZ-05 examId trailing space 통과                                    | P0 미포함 (P1 분류) — 본 baseline 평가 보류                                                | **평가 보류**                                           |
|  5  | REG-01 BATCH-0 fixture 재실행 invariant timestamp 차이로 미세 불일치 | 15/15 PASS — invariant 100% 일치                                                           | **빗나감** ❌                                           |

**예언 적중률**: 2/4 평가 가능 항목 중 1.5건 (~37.5%) — Mephisto 가 "8~12건 PASS" 라는 낙관 예측에 비해 **현실은 더 비관적** (3건 PASS).

**메타 결론**: Mephisto 의 정량 예언은 **빗나간 것이 더 많지만**, 핵심 결론 ("이 보고서가 너의 미래의 너 자신을 속이지 않게") 은 본 baseline 측정으로 **사후 검증됨** — v1.1 §10.7 검증되지 않은 영역 15 항목과 본 baseline 14 항목 (PARTIAL+NOT-IMPLEMENTED) 이 정확히 정합.

---

## 5. Sprint 1 권고 작업 순서 (P0 17 GREEN — ~5일)

### 5.1 즉시 흡수 (CRITICAL-N1 — 1일)

| 작업                                                         | 파일                                              | 시간 | 우선순위 |
| :----------------------------------------------------------- | :------------------------------------------------ | :--: | :------: |
| naive DFS → iterative DFS 전환 (stack overflow 차단)         | `packages/quality/src/graph-integrity.ts:136-189` |  2h  |    🔴    |
| MAX_RECURSION_DEPTH sentinel 추가 (10K 이전 명시 차단)       | 동                                                |  1h  |    🔴    |
| graph-integrity.test.ts 에 N=10K deep chain 회귀 테스트 추가 | quality/**tests**/                                |  1h  |    🔴    |
| Tarjan SCC 비교 구현 (sanity 검증용)                         | 동                                                |  4h  |    🟠    |

### 5.2 Sprint 1 Day 1 — 도구 정비 (1일)

| 작업                                 | 출처 명세       |
| :----------------------------------- | :-------------- |
| MSW 확장 (Anthropic API mock)        | CHA-03 / FUZ-02 |
| Workers Vitest Pool 도입             | CHA-01 / CHA-05 |
| sinon.useFakeTimers 도입             | CHA-04          |
| tests/fixtures/pdf-malicious/ 5종    | FUZ-01          |
| tests/fixtures/claude-malformed/ 8종 | FUZ-02          |
| performance.now() 측정 wrapper       | PRF-01          |

### 5.3 Sprint 1 Day 2-3 — NOT-IMPLEMENTED 7건 신규 구현 (~3일)

| 작업                                                    | 시간 | 분류 |
| :------------------------------------------------------ | :--: | :--- |
| CHA-01 D1 disconnect 10% MSW + retry 검증               | 0.5d | CHA  |
| CHA-02 CalculationTimeoutError 추가 + 무거운 산식       | 0.5d | CHA  |
| CHA-03 → P1 재분류 (Phase 2 진입 직전 의무)             |  —   | 정책 |
| CHA-04 sinon clock skew + recover Q1                    | 0.5d | CHA  |
| CHA-05 → P1 재분류 (hybrid-search Phase 1 후반)         |  —   | 정책 |
| FUZ-01 5종 PDF + PdfParseError 분류                     | 0.5d | FUZ  |
| FUZ-02 8종 변조 응답 + KnowledgeContractValidationError |  1d  | FUZ  |

### 5.4 Sprint 1 Day 4-5 — PARTIAL 7건 보강 (~2일)

| 작업                                                   | 시간 | 분류 |
| :----------------------------------------------------- | :--: | :--- |
| CHA-06 wrangler cron + GC catch-up                     | 0.5d | CHA  |
| FUZ-04 7 vectors 추가                                  | 0.5d | FUZ  |
| PRF-01 성능 메트릭 wrapper + p99 측정                  | 0.5d | PRF  |
| PRF-02 N=5K/10K/50K Tarjan vs iterative-DFS 비교       | 0.5d | PRF  |
| PRC-01 batch6~10-golden 또는 기존 5 시나리오 expansion | 0.5d | PRC  |
| REC-01 4 시점 × 10 반복 추가                           | 0.5d | REC  |
| REC-02 4 변조 케이스 추가                              | 0.5d | REC  |

### 5.5 Sprint 1 종료 게이트 (handoff-028 §2.4 정합)

- 17/17 PASS (CRITICAL 0건)
- `verify-engine-contracts.ts` 확장 — Cat 5 (성능) 부분 자동화 추가
- JSON 리포트 생성 (`apps/batch/sprint1-final-report.json`)
- BATCH-1 진입 진산님 트리거 대기

---

## 6. 본 baseline 의 한계 (정직)

본 baseline 작성자 Claude (Opus 4.7) 는 다음 한계를 명시한다:

1. **Mephisto 예언 #4 (FUZ-05 examId trailing space) 평가 보류** — P0 미포함이므로 본 baseline 외부.
2. **CHA-01 / CHA-04 / CHA-05 는 "측정 자체 불가"** — 도구 (MSW + Workers Pool + sinon) 부재 → Sprint 1 Day 1 도구 정비 후 재측정 필요.
3. **PRF-02 microbench 는 합성 그래프** — 실제 BATCH-1 적재 후 SUPERSEDES chain depth 분포는 다를 수 있음. 본 baseline 의 "stack overflow N=10K" 는 **이론적 한계** 로 해석.
4. **본 baseline 은 자동 측정만** — 수동 침투 / 수동 부하 / 24시간 soak 는 Phase 2 진입 직전 별도 baseline 의무.

---

## 7. 진산님 결정 트리거 (Sprint 1 진입)

다음 메시지 중 1개로 Sprint 1 진입:

| 트리거                           | 진행                                                                                               |
| :------------------------------- | :------------------------------------------------------------------------------------------------- |
| **"Sprint 1 즉시 진입"** (권고)  | §5.1 CRITICAL-N1 흡수 → §5.2 도구 정비 → §5.3 NOT-IMPLEMENTED 7건 → §5.4 PARTIAL 7건 → 17/17 GREEN |
| **"CRITICAL-N1 만 즉시"**        | naive DFS → iterative 전환 + 회귀 테스트 (~1일) — Sprint 1 본격은 별도 트리거                      |
| **"v1.1 §10.7 갱신 + Sprint 1"** | v1.1 §10.7 에 항목 #16 (anthropic-adapter NOT_IMPLEMENTED) 추가 후 Sprint 1 진입                   |
| **"본 baseline 에 추가 측정"**   | 진산님 지적 추가 항목 본 baseline 갱신 후 Sprint 1                                                 |

**권고**: **"Sprint 1 즉시 진입"** — CRITICAL-N1 은 1일 흡수 가능. NOT-IMPLEMENTED 7건은 도구 정비 후 일사천리. 17/17 GREEN 후 BATCH-1 진입 게이트 통과.

---

## 8. 메타 통계

| 항목                                 | 값                                                                               |
| :----------------------------------- | :------------------------------------------------------------------------------- |
| 본 baseline 측정 시간                | ~2시간 (handoff-028 Phase C Day 0)                                               |
| 직접 microbench 실행                 | 1건 (PRF-02 naive DFS)                                                           |
| 기존 테스트 실행 검증                | 4건 (REG-01/REG-02/PRC-02/FUZ-04)                                                |
| 코드베이스 탐색 (Explore agent 위임) | 17건 매핑 완료                                                                   |
| 신규 발견 CRITICAL                   | 2건 (CRITICAL-N1 stack overflow / CRITICAL-N2 anthropic-adapter NOT_IMPLEMENTED) |
| 본 baseline 페이지 수                | 보고서 1 + microbench 임시 파일 (사용 후 삭제 예정)                              |

---

**baseline 작성**: Claude (Opus 4.7 1M context)
**baseline 효력**: 2026-05-01 ~23:02 KST
**다음 단계**: 진산님 트리거 "Sprint 1 즉시 진입" → handoff-029 (Sprint 1 P0 17/17 GREEN 후)
**파일명 정합**: 메모리 `feedback_review_filename_pattern` 정합 (review-\* prefix)
