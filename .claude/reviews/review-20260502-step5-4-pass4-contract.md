# Pass 4 — CONTRACT (quality-engineer)

## 메타

- **리뷰 대상**: Sprint 1 §5.4 PARTIAL 7건 + ADR-029 + ESLint rule
- **commit 범위**: `a258f36` … `50c8bb3` (8 commits)
- **리뷰 방식**: 독립 에이전트 1개 (quality-engineer Pass 4) — 자가 리뷰 아님
- **리뷰 일자**: 2026-05-02
- **리뷰 범위**: 변경 11 파일 + 연관 (Master Plan v1.0 §CHA-06/FUZ-04/PRF-01/02/PRC-01/REC-01/02, ADR-029, handoff-032 §3, dev-guide.md L3 영역, eslintrc, batch1-definitions.ts)
- **관점**: "Master Plan v1.0 / 구현 재정립서 v3.0 / Hard Rules / handoff-032 §3 결정 대로 만들었는가? Silent pivot 명시 충분한가?"

---

## 1. 결과 요약 (CRITICAL/MAJOR/MINOR/N-A/PASS)

| 분류         | 건수 |
| :----------- | :--: |
| **CRITICAL** |  1   |
| **MAJOR**    |  4   |
| **MINOR**    |  3   |
| **N/A**      |  3   |
| **PASS**     |  10  |

**판정**: **수정 필요 (CRITICAL 1건)** — 단, CRITICAL은 forward-reference (handoff-033 미존재) 절차 결함이며, 본 §5.4 commit 들은 그 자체로 functional. handoff-033 작성 트리거 즉시 흡수 가능.

---

## 2. PASS 항목 (실제 확인 증거 — 규칙 2 정합)

| #   | 항목                                                                                               | 근거 파일:라인                                                                                                             |
| :-- | :------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------- |
| 1   | ADR-029 §1.2 setTimeout bail silent pivot 정당성 — sync 코드 preempt 불가 명시                     | `docs/adr/ADR-029-formula-engine-resource-limit.md:39-49`                                                                  |
| 2   | ADR-029 §2.4 한도 변경 절차 4 단계 (Decision Log + cache invalidation + 회귀 게이트 + 진산님 승인) | `docs/adr/ADR-029-formula-engine-resource-limit.md:111-118`                                                                |
| 3   | ADR-029 §6 Decision Log — 한도 보수화 (500→200 / 30→15) 정합 ★ 절차 준수                           | `docs/adr/ADR-029-formula-engine-resource-limit.md:199`                                                                    |
| 4   | sandbox.ts 한도 변경 시 ADR-029 §2.4 명시 참조                                                     | `packages/formula-engine/src/sandbox.ts:251` (주석 + 한도 라인)                                                            |
| 5   | Hard Rule 17 (EXAM_IDS 단일 출처) — 새 테스트 파일 내 `son-hae-pyeong-ga-sa` 리터럴 0건            | `apps/batch/__tests__/rec-01-kill-points-parametrized.test.ts:24,30` (EXAM_IDS.SON_HAE_PYEONG_GA_SA), `fuz-04-...:` 미사용 |
| 6   | Hard Rule 16 (시험 경계 examId 첫 인자) — `recoverBatch` 호출 시 examId 첫 인자 정합               | `apps/batch/__tests__/rec-01-kill-points-parametrized.test.ts:148`                                                         |
| 7   | Hard Rule 15 (범용 계층 시험 분기 금지) — formula-engine sandbox.ts 내 examId 분기 0건             | `packages/formula-engine/src/sandbox.ts:283-303`                                                                           |
| 8   | ESLint no-restricted-imports — production 코드 `__tests__/helpers/**` 차단 + override 정합         | `.eslintrc.json:21-31` + `:33-52` (test file override)                                                                     |
| 9   | REC-01 합격 기준 (a)/(b)/(d) 50/50 invariant + stage 1 영향 + data_loss=none 검증                  | `apps/batch/__tests__/rec-01-kill-points-parametrized.test.ts:227-239,241-248,264-301`                                     |
| 10  | FUZ-04 합격 기준 (b) sentinel counter 0건 mutation                                                 | `packages/formula-engine/src/__tests__/fuz-04-sandbox-bypass-12-vectors.test.ts:65-77,92-99`                               |

---

## 3. CRITICAL (1건)

### C-PROC-1: handoff-session-033 forward-reference 미해소 — silent pivot 보고 절차 미완

**증거**:

- `apps/batch/__tests__/rec-02-checkpoint-tampering.test.ts:6,17,355` — "handoff-session-033 §3 silent pivot 보고"
- `packages/formula-engine/src/__tests__/prc-01-precision-framework.test.ts:22` — "handoff-session-033 §3 신규 결정 사항 보고 의무"
- `packages/formula-engine/src/__tests__/prf-01-formula-engine-perf.test.ts:11` — "handoff-session-033 §3"
- `packages/quality/src/__tests__/prf-02-naive-vs-tarjan.test.ts:14` — "handoff-session-033 §3 silent pivot 보고"
- `.jjokjipge/handoff-session-033*` — **파일 미존재** (`ls` 결과 0)

**Master Plan 정합 위배**:

- 5개 silent pivot (REC-02 5/5→3/5, REC-01 atomic skip→fully_recovered, PRC-01 255→119, PRF-01 51→6 sample, PRF-02 Tarjan 미구현) 모두 handoff-033 §3 진산님 결정 의존 명시.
- 그러나 handoff-033 미작성 = 진산님이 결정을 내릴 plate 부재 = CRITICAL RULE #1 ("기획과 다르게 구현하려면 인간에게 보고") 절반만 충족 (코드 주석 보고 ✅, 진산님 결정 trigger ❌).

**즉시 흡수 액션**:

1. handoff-session-033.md 작성 — §3 신규 결정 사항 5건 명시:
   - 3.1: REC-02 5/5 vs 3/5 → 옵션 A/B/C 진산님 결정
   - 3.2: REC-01 95% atomic skip vs fully_recovered → Master Plan 명세 해석
   - 3.3: PRC-01 119/255 → BATCH-1 적재 후 fixture expansion 트리거 명시
   - 3.4: PRF-01 51 산식 → 동일 트리거
   - 3.5: PRF-02 Tarjan 도입 트리거 (3 조건) 정량 명세
2. 본 commit 들은 functional 정합 — handoff-033 작성 즉시 closure.

**분류 사유**: 본 §5.4 commit 들이 "완료" 선언 가능한 상태로 보고되었으나, 5건 silent pivot 의 진산님 결정 의무가 미실행. 4-Pass 통과 후 handoff-033 작성 동시 의무.

---

## 4. MAJOR (4건)

### M-1: Master Plan §FUZ-04 합격 기준 (a) "12/12 거부" vs 실 구현 "11/12 거부"

**증거**:

- `packages/formula-engine/src/__tests__/fuz-04-sandbox-bypass-12-vectors.test.ts:69-72,82-90` — vector 8 (circular) 의도된 통과
- Master Plan §FUZ-04 합격 기준: "(a) 12/12 모두 SandboxViolationError"
- 본 구현 정당화 주석: "vector 8 (circular) 는 정상 표현식 — AST tree 표현 불가로 자연 차단"

**문제**: Master Plan §FUZ-04 시나리오 (8) "circular reference" 의 의도는 JavaScript 객체 circular ref 인데, 본 구현은 `'a + a + a'` AST 표현 — Master Plan 의도와 본질적으로 다름. 본 vector 는 사실상 Master Plan 의도 미충족 (circular reference 검증 부재).

**흡수 권고**: Master Plan v1.0.2 patch 또는 ADR 작성:

- 옵션 A: Master Plan §FUZ-04 v1.0.2 — "(8) circular = N/A (AST tree 표현 불가)" 명시 변경
- 옵션 B: vector 8 재정의 — 예: `const a = {}; a.self = a` JSON serialize 시 Worker 영향 검증
- 옵션 C: vector 8 제거 → FUZ-04 11 vectors 로 명세 변경

handoff-033 §3 추가 결정 항목.

### M-2: PRF-01 BATCH1_SAMPLES 6 산식 — commit 메시지 "13 산식" 주석과 실 코드 6 산식 불일치

**증거**:

- `packages/formula-engine/src/__tests__/prf-01-formula-engine-perf.test.ts:22` 주석: "BATCH1 13 산식 sample inputs"
- `prf-01-formula-engine-perf.test.ts:28-35` 실 정의: 6 산식 (F-01,02,03,05,06,07)
- `prf-01-formula-engine-perf.test.ts:140` progress test: "BATCH1 6 sample / 51 산식 = 12%"
- commit `b6891ed` 메시지: "BATCH1 6 산식 sample 측정"

**문제**: 주석 line 22 와 (b) 테스트 line 64 ("BATCH1 = 13 산식") 가 실 정의 6 산식과 불일치. 주석은 BATCH-1 적재 시점에 13 산식 expansion 의도일 수 있으나, 본 시점 코드는 6 산식 = 12% coverage. 주석 정확성 필요.

**흡수**: 주석 line 22, 64, 73 (`BATCH1 = 13 산식` → `BATCH1 = 6 sample (full = 13 expected post-BATCH-1)`) 정정.

### M-3: PRC-01 progress test "119/255 = 47% PARTIAL" — 119 카운트 출처 미증명

**증거**:

- `packages/formula-engine/src/__tests__/prc-01-precision-framework.test.ts:124-132` — "현 시점 PRC-01 커버리지: batch1~5-golden 119 / 255 = 47% (PARTIAL)"
- 본 framework 신규 12 tests + 기존 batch1~5-golden 외 다른 fixture 카운트 미명시.
- Master Plan §PRC-01 합격 기준 (a) "255건 (51 × 5 시나리오)" — 본 framework 가 12건 / 255 = 4.7% 만 추가.

**문제**: "119" 라는 카운트 출처가 commit 시점 측정 결과인지, 추정인지 불명. PRC-01 (a) 합격 기준은 "255/255 6 decimal 일치" — 본 commit 으로 119/255 도달 자체 증거 부재 (테스트 실행 카운트 정합 검증 없음).

**흡수**: progress test에서 `npm test --reporter=json` 출력을 ingest 하거나, batch1~5-golden 의 정확 카운트를 reference 비교 (예: `batch1-golden.test.ts` 내 `it.each` 카운트 정량 측정).

### M-4: REC-01 (c) Master Plan 명세 해석 임의 변경 — atomic skip vs fully_recovered

**증거**:

- Master Plan §REC-01 (c): "95% kill = atomic skip (already_completed)"
- `apps/batch/__tests__/rec-01-kill-points-parametrized.test.ts:13-19` — "본 구현은 batch_runs.state='killed' 인 한 ... fully_recovered. already_completed 는 state='completed' 일 때만 발화"
- `rec-01-kill-points-parametrized.test.ts:250-262` — 합격 기준 (c) 의도된 변경

**문제**: Master Plan 명세 (atomic skip) ≠ 실 구현 (fully_recovered). 본 commit 은 코드 주석으로 "차이 명시" 하였으나, Master Plan v1.0.1 patch 또는 ADR 작성 등 영속 의사결정 없음. handoff-032 §3 에 본 항목 결정 옵션 부재 → silent pivot.

**흡수**: handoff-033 §3.2 추가 — "REC-01 (c) Master Plan v1.0.2 patch: '95% kill (state=killed) = fully_recovered (atomic skip 은 state=completed 일 때만 정합 — AC-R3 정합)'" 명세.

---

## 5. MINOR (3건)

### m-1: ADR-029 §4.3 "회귀 vector" 표 — Workers isolate kill 미발화 정합 회귀 vector 부재

**증거**: `docs/adr/ADR-029-formula-engine-resource-limit.md:163-169` — 4 회귀 vector 명시되었으나, "1/2차 우회 → Workers isolate kill 발화 = incident 신호" 회귀 vector 부재 (운영 측정 의무).

**개선**: Phase 2 진입 시 wrangler tail 모니터링 — Workers 50ms isolate kill 발화 시 즉시 incident 분류 정책 추가.

### m-2: REC-02 5종 시나리오 (a)/(b)/(c) 종합 it 의 결정성 검증 부재

**증거**: `apps/batch/__tests__/rec-02-checkpoint-tampering.test.ts:276-365` — `expect(threwCount).toBe(3)` / `expect(passedScenarios).toEqual(['key_reorder', 'whitespace'])` 정량 검증 ✅, 그러나 동일 입력 → 동일 결과 결정성 (10회 반복) 부재.

**개선**: 결정성 검증 — 동일 raw + 변조 → 매번 동일 결과 확인 (REC-01 패턴 정합).

### m-3: CHA-06 합격 기준 (b) "D1 쿼리 latency 변화 측정" 미실행

**증거**: `apps/api/src/scheduled/__tests__/cha-06-cron-24h-miss.test.ts:1-159` — (a) GC 100% 제거 ✅, (c) 알람 Phase 2 ✅ 명시, 그러나 (b) D1 쿼리 latency 측정 부재.

**개선**: GC 전후 `SELECT ... FROM rate_limits WHERE bucket_minute > ?` 의 `performance.now()` 측정 — 1500 row 전후 latency delta 명시.

---

## 6. N/A (3건, 사유 명시)

| #   | 항목                               | 사유                                                                                                   |
| :-- | :--------------------------------- | :----------------------------------------------------------------------------------------------------- |
| 1   | 배치 순서 (BATCH-1 진행 검증 완료) | 본 §5.4 PARTIAL 7건은 BATCH 적재 자체 미진행 — Sprint 1 = 엔진 hardening, BATCH-1 진입 전 차단점       |
| 2   | 노드 ID 컨벤션 (CONCEPT-001 등)    | 본 commit 들은 검증/측정 framework — 신규 노드 ID 생성 0건                                             |
| 3   | 수치/임계값 vs 교재 원문 일치      | 본 commit 들은 산식 검증 framework — 수치 변경 0건 (PRC-01 expected '0.310000' 은 F-12 교재 정합 검증) |

---

## 7. 반론 (Devil's Advocate, 규칙 3 정합)

### 7.1 깨질 수 있는 시나리오 1: handoff-033 작성 지연

진산님이 §5.4 4-Pass 통과 후 BATCH-1 진입 트리거 즉시 발화 시, handoff-033 §3 5건 결정 미실행 = silent pivot 5건 영속화. PRF-02 Tarjan 미구현 (BATCH-1 적재 시점 노드 700 추정) 같은 항목은 "낮은 위험" 평가되어 handoff-033 작성이 SKIP 될 수 있음. → C-PROC-1 흡수 의무화 권고.

### 7.2 깨질 수 있는 시나리오 2: PRC-01 119/255 카운트 회귀

`prc-01-precision-framework.test.ts:124` 의 119 라는 carved-in-stone 카운트는 batch1~5-golden 의 실 카운트 변경 시 (예: BATCH-1 적재 후 fixture 추가) 회귀 vector. 회귀 시 본 it 가 통과해도 (≥45% 임계) 의미 없는 검증으로 변질. → M-3 흡수 의무 (실 카운트 ingest).

### 7.3 깨질 수 있는 시나리오 3: ADR-029 한도 변경 절차 우회 가능성

§2.4 "Decision Log 갱신" 의무는 사람 절차 — `MAX_AST_NODE_COUNT` 다음 변경 시 ADR 갱신을 잊은 채 Edit/Write hook 만으로 sandbox.ts 변경 가능. dev-guide.md "L3 영역 변경 시 plan + 승인" 강제는 quality-gate.sh hook 이 currently 미구현. → ADR-029 자체는 정합, 그러나 enforcement gap 존재. Phase 2 진입 시 hook 강화 의무.

### 7.4 Tarjan 미구현 — N=BATCH-1 시점 안전 vs Year 2 Year 3 위험

`prf-02-naive-vs-tarjan.test.ts:165-177` 가 "본 시점 안전 (BATCH-1 추정 ~700 노드)" 정당화. 그러나 Year 2 멀티시험 (공인중개사 별도 ontology) + Year 3 (3rd 시험) 시 N=10K 도달 가능. PRF-02 (b) "N=10K naive 100ms" 임계 발화 시 Tarjan 도입 코드 변경 = 회귀 위험. → handoff-033 §3.5 에 정량 트리거 명세 의무.

---

## 8. dedupe 가능 항목 (다른 Pass 와 중복 방지)

본 Pass 4 (CONTRACT) 는 Master Plan / handoff / Hard Rules 정합 한정.

- M-2 (BATCH1 6 vs 13 산식 주석) — Pass 1 SURGEON 의 "주석/문서" 영역과 부분 중복 가능. Pass 4 에서는 "Master Plan §PRF-01 51 산식 명세 vs 본 시점 6 sample coverage" 정합 검증 관점으로 분리.
- m-1 (ADR-029 회귀 vector 표) — Pass 2 ARCHITECT 의 "회귀 vector 정합" 영역 가능. Pass 4 는 "Workers isolate kill 정합" 운영 절차 관점.
- C-PROC-1 (handoff-033 forward-reference) — Pass 1~3 와 중복 0 (CONTRACT 고유 영역).

---

## 9. 보고 형식 정합

```
── 4-PASS REVIEW (Pass 4 only — quality-engineer) ──
리뷰 방식: 독립 에이전트 1개 (자가 리뷰 아님)
리뷰 범위: 변경 11 파일 + 연관 (Master Plan, ADR-029, handoff-032 §3, dev-guide.md, eslintrc, batch1-definitions.ts)

Pass 4 (CONTRACT — quality-engineer):
  PASS 10건 / 🔴 1건 (C-PROC-1) / 🟠 4건 (M-1~M-4) / 🟡 3건 (m-1~m-3) / N/A 3건

확인:
  - ADR-029 §1.2 setTimeout bail silent pivot 정당성 (file:line 명시)
  - ADR-029 §2.4 한도 변경 4 단계 절차
  - ADR-029 §6 Decision Log 한도 보수화 정합
  - sandbox.ts ADR-029 §2.4 참조
  - Hard Rule 17 EXAM_IDS 정합 (rec-01 + fuz-04)
  - Hard Rule 16 examId 첫 인자 정합 (recoverBatch)
  - Hard Rule 15 범용 계층 시험 분기 0건 (sandbox)
  - ESLint no-restricted-imports + override 정합
  - REC-01 (a)/(b)/(d) 정량 검증
  - FUZ-04 (b) sentinel counter 0

반론:
  - handoff-033 작성 지연 → silent pivot 5건 영속화 (C-PROC-1)
  - PRC-01 119 정량 회귀 vector
  - ADR-029 한도 변경 절차 hook enforcement gap
  - Tarjan 미구현의 Year 2/3 위험

판정: 수정 필요 (CRITICAL 1 — handoff-033 흡수 즉시)
────────────────────────────────────
```

---

**Pass 4 작성**: Claude (Opus 4.7 1M context) — quality-engineer 독립 에이전트
**작성 효력**: 2026-05-02 ~step5-4-4-pass
**합격 판정**: 수정 필요 (handoff-033 작성 흡수 후 closure 가능)
