# Handoff — Session 031 → Sprint 1 §5.3 NOT-IMPL 3건 (CHA-01/02/04) + §5.4 PARTIAL 7건 + v1.2

작성일: 2026-05-02 ~10:40 KST
직전 세션: 030 (FUZ-01/02 fixtures 우선 옵션 B 진행 + 4-Pass CRITICAL 5건 즉시 흡수)

---

## 0. 본 세션(030) 누적 결과

### 0.1 3 commits 체인

|  #  | Commit    | 단계             | 핵심                                                                                                                                                                                                                                             |
| :-: | :-------- | :--------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  1  | `2beb282` | §5.3 FUZ-01      | pdf-extractor pre-flight byte scan + PdfParseError 5분류 + getActivePdfSubprocessCount 카운터. parser 136 → 143 PASS (+7).                                                                                                                       |
|  2  | `71a97c9` | §5.3 FUZ-02      | schema-validator validateRawClaudeResponse + KnowledgeContractValidationError 8분류 + computeMaxJsonDepth + EXAM_IDS 동적 차단 패턴. parser 143 → 155 PASS (+12).                                                                                |
|  3  | `4baccac` | §5.3 4-Pass 흡수 | CRITICAL 5건 + MAJOR 5건 즉시 흡수. C-1 idempotent decrement / C-2 XSS 태그 컨텍스트 한정 / C-3 batch-processor validateRawResponseSecurity 통합 / C-4 fs.open 부분 read + HARD_FILE_SIZE_LIMIT / C-5 escapeHtmlSnippet. 4-Pass 산출물 5개 영속. |

### 0.2 본 세션 4-Pass 통합 결과

**4-Pass 독립 에이전트 4개 병렬** (silent-failure-hunter / system-architect / security-engineer / quality-engineer) 결과:

| Pass        | CRITICAL | MAJOR  | MINOR  |  N/A  |  PASS  |
| :---------- | :------: | :----: | :----: | :---: | :----: |
| 1 SURGEON   |    2     |   5    |   4    |   0   |   12   |
| 2 ARCHITECT |    1     |   3    |   2    |   2   |   8    |
| 3 ADVOCATE  |    2     |   6    |   3    |   3   |   7    |
| 4 CONTRACT  |    0     |   3    |   4    |   2   |   13   |
| **합계**    |  **5**   | **17** | **13** | **7** | **40** |

**CRITICAL 5건 흡수**:

- C-1 (P1): subprocess counter race / 영구 누수 → idempotent decrement
- C-2 (P1+P3): XSS regex `\bon\w+\s*=` false positive → HTML 태그 컨텍스트 한정
- C-3 (P2+P4): validateRawClaudeResponse batch-processor 미통합 → validateRawResponseSecurity 분리 + parseContractJson 진입 직전 호출
- C-4 (P3): readFile OOM 우회 → fs.open + fd.read 부분 read + 200MB hard ceiling
- C-5 (P3): rawSnippet XSS 평문 → escapeHtmlSnippet 헬퍼 적용

**MAJOR 12건 dedupe → 5건 즉시 + 7건 §5.4 이월** (§6 ledger 참조).

### 0.3 본 세션 게이트 통과 누적 검증

- `packages/parser` test 136 → **155 PASS** (+19)
- `apps/api` test 261 PASS (회귀 0건)
- `apps/admin-web` typecheck clean
- `packages/quality` test 48 PASS (회귀 0건)
- `apps/batch` test 238 PASS (회귀 0건)
- `packages/parser` typecheck / lint clean
- 4-Pass 독립 에이전트 리뷰 1회 영속 (5개 산출물 — Pass 1~4 + 통합 인덱스)

---

## 1. Sprint 1 진행 상태 (handoff-030 §1 갱신)

```
[x] §5.1  CRITICAL-N1   iterative DFS + MAX_SUPERSEDE_CHAIN_DEPTH sentinel    ← 028
[x] §5.1  4-Pass 흡수   caller 통합                                           ← 028
[x] §5.2  Day 1 도구    perf + fakeTimers + fixtures + ADR-028                ← 029
[x] §5.2  4-Pass 흡수   CRITICAL 1 + MAJOR 6 즉시                              ← 029
[x] §5.3  FUZ-01/02     fixtures 우선 옵션 B 진행 (handoff-030 §3.3 권고)     ← 본 세션
[x] §5.3  4-Pass 흡수   CRITICAL 5 + MAJOR 5 즉시 + MAJOR 7 §5.4 이월         ← 본 세션
[ ] §5.3  NOT-IMPL 3건  CHA-01 / CHA-02 / CHA-04 신규 구현                     ← 차세션 (~1.5d)
[ ] §5.4  PARTIAL 7건   CHA-06 / FUZ-04 / PRF-01/02 / PRC-01 / REC-01/02       ← 차세션 (~2d)
[ ] §5.4  MAJOR 7건 흡수 §5.3 4-Pass 이월 + §5.2 4-Pass 이월                    ← §5.4 commit 동시
[ ] §5.5  종료 게이트   15/15 PASS + verify-engine-contracts Cat 5 자동화       ← BATCH-1 진입 트리거
[ ] v1.2  보고서        ENGINE_HARDENING_COMPLETION_REPORT v1.1 → v1.2          ← §5.4 완료 후
```

**P0 15건 (재분류 후) 현재 상태**:

- **PASS 5건**: REG-01 / REG-02 / PRC-02 + **FUZ-01 / FUZ-02 (본 세션 신규)**
- PARTIAL 6건: CHA-06 / FUZ-04 / PRF-01 / PRF-02 / PRC-01 / REC-01 / REC-02
- **NOT-IMPLEMENTED 3건**: CHA-01 / CHA-02 / CHA-04

---

## 2. 차세션 진입 액션 명세 (Sprint 1 §5.3 잔존 + §5.4)

### 2.A — §5.3 NOT-IMPL 3건 신규 구현 (~1.5d)

**근거**: handoff-030 §2.A + 본 세션 §5.2 도구 산출물 + 본 세션 4-Pass 흡수 산출물 활용.

| 시나리오 | 작업                                                  | 시간 | 도구 의존                                                             |
| :------- | :---------------------------------------------------- | :--: | :-------------------------------------------------------------------- |
| CHA-01   | D1 disconnect 10% Proxy wrap + retry 검증             | 0.5d | `d1-from-sqlite.ts` + `withDisconnect` Proxy 패턴 (ADR-028 §4.1 정합) |
| CHA-02   | CalculationTimeoutError + 무거운 산식 setTimeout bail | 0.5d | `packages/formula-engine/engine.ts` setTimeout-based bail-out         |
| CHA-04   | vi.useFakeTimers clock skew + recover Q1 (24h 가드)   | 0.5d | `test-patterns.md` §1 정합 + apps/batch/recover.ts elapsed abs()      |

**커밋 단위**: 시나리오별 1 commit + Day 별 4-Pass 리뷰 의무.

### 2.B — §5.4 PARTIAL 7건 보강 (~2d)

handoff-030 §2.B 명세 그대로 유지 (CHA-06 / FUZ-04 / PRF-01/02 / PRC-01 / REC-01/02).

**§5.4 동시 흡수 의무 — 본 세션 §5.3 4-Pass 이월 MAJOR 7건** (§6 ledger 참조).

### 2.C — Sprint 1 종료 게이트 + v1.2 보고서

handoff-030 §2.C 명세 그대로. P0 15/15 PASS + verify-engine-contracts Cat 5 자동화 + JSON 리포트 + BATCH-1 진입 트리거.

---

## 3. 진산님 정책 결정 사항 (Session 031 신규 + 030 잔존 0건)

### 3.1 (해결됨) §5.3 진입 순서 — 옵션 B (fixtures 우선)

- 진산님 권고 옵션 B 진행 → commit `2beb282` + `71a97c9` + `4baccac` 적용. 본 §0.1 / §1 정합.

### 3.2 (해결됨) MAJOR 이월 흡수 시점 — 옵션 A (§5.4 동시 묶음)

- handoff-030 §3.4 옵션 A 채택. 본 §5.3 4-Pass 이월 MAJOR 7건 → §6 ledger 등재. §5.2 이월 7건과 합쳐 총 14건 §5.4 commit 동시 흡수 의무.

### 3.3 (신규) §5.3 잔존 3건 진입 순서 결정 필요

**옵션**:

- A) **CHA-01 → CHA-02 → CHA-04** (handoff 명세 순서)
- B) **CHA-04 → CHA-01 → CHA-02** (vi.useFakeTimers 도구 패턴 우선 활용)
- C) **CHA-02 → CHA-01 → CHA-04** (formula-engine isolation 우선)

**권고**: **옵션 A** — handoff 명세 순서 정합, ADR-028 §4.1 (CHA-01) 의 Proxy 패턴이 §5.2 산출이라 즉시 활용. CHA-02 / CHA-04 는 독립.

### 3.4 (신규) §5.4 진입 시점 — §5.3 NOT-IMPL 3건 완료 후 vs 병렬

**옵션**:

- A) **§5.3 3건 완료 → §5.4 7건 진입** (선형 순차 — 권고)
- B) §5.3 진행 중 §5.4 PARTIAL 보강 동시 진행 (병렬 — 다중 세션 분할 의무)

**권고**: **옵션 A** — 4-Pass 리뷰 의무 정합 + 회귀 추적 단순화.

---

## 4. 차세션 진입 직후 1차 읽기

### 4.1 핵심 문서 (의무, 우선순위 순)

1. **본 핸드오프** — `.jjokjipge/handoff-session-031.md`
2. **§5.3 4-Pass 통합 인덱스** — `.claude/reviews/review-20260502-090418-sprint1-step5-3-fuz-01-02-4pass-index.md` (이월 MAJOR 7건 명세)
3. **decision-2026-05-02** — `docs/plans/engine-hardening/decision-2026-05-02-cha-03-05-p1-reclassification.md` (P0→P1 재분류)
4. **§5.2 4-Pass 통합 인덱스** — `.claude/reviews/review-20260502-003506-sprint1-step5-2-4pass.md` (이월 MAJOR 7건 명세)
5. **test-patterns.md** — `docs/quality/test-patterns.md` (CHA-04 vi.useFakeTimers 정합)
6. **ADR-028** — `docs/adr/ADR-028-workers-vitest-pool-deferred-to-phase-2.md` (CHA-01 D1 disconnect Proxy 패턴 §4.1)
7. **Sprint 0 baseline** — `.claude/reviews/review-sprint0-baseline-20260501-230231.md`
8. **테스트 마스터 플랜** — `docs/ThePick Engine Quality Test Master Plan v1.0.md` (v1.0.1 패치 적용)

### 4.2 직전 세션 핸드오프 체인

9. `.jjokjipge/handoff-session-030.md` (P0→P1 재분류 + §5.3 옵션 B 명세)
10. `.jjokjipge/handoff-session-029.md` (§5.2 도구 정비)
11. `.jjokjipge/handoff-session-028.md` (Phase A → B → C → D)

### 4.3 진산님 메모리 정합 (자동 로드)

- `project_completion_notification_obligation` (Sprint 1 종료 = ★ 알림 의무)
- `feedback_two_fix_failures_zoom_out` (§5.4 PRF-02 / FUZ-04 보강 시 정합)
- `feedback_no_shortcuts` (CHA-03/05 P1 재분류 정당화)
- `feedback_review_filename_pattern` (review-\* prefix — 본 세션 5개 산출물 정합)
- `feedback_document_first_workflow` (decision / ADR / test-patterns 영속 문서 우선)

---

## 5. 진산님 차세션 트리거 키워드

| 트리거                                            | 진행                                                           |
| :------------------------------------------------ | :------------------------------------------------------------- |
| **"§5.3 잔존 — CHA-01/02/04 옵션 A 순서"** (권고) | CHA-01 → CHA-02 → CHA-04 (~1.5d)                               |
| **"§5.3 — CHA-04 먼저 (fakeTimers 패턴 우선)"**   | 옵션 B. CHA-04 → CHA-01 → CHA-02                               |
| **"§5.3 + §5.4 풀 진행"**                         | NOT-IMPL 3건 + PARTIAL 7건 일괄 (~3.5d) — 다중 세션 분할 의무  |
| **"§5.4 진입 — CHA-01/02/04 보류"**               | PARTIAL 7건 우선. CHA 3건은 Sprint 1 종료 직전 또는 P1         |
| **"§5.4 이월 MAJOR 14건 먼저 흡수"**              | §5.2 7건 + §5.3 7건 일괄 흡수 (~1d)                            |
| **"v1.2 보고서 즉시 갱신"**                       | §5.4 완료 전 v1.2 갱신 (handoff-029 §3.2 권고 A 위배 — 신중)   |
| **"Sprint 1 종료 게이트 즉시 검증"**              | 현 시점 P0 PASS = 5 / 15 — 종료 미충족. NOT-IMPL 3건 진입 의무 |

**권고**: **"§5.3 잔존 — CHA-01/02/04 옵션 A 순서"** — handoff 명세 순서 정합 + ADR-028 §4.1 Proxy 패턴 즉시 활용.

---

## 6. 본 세션이 차세션에 넘기는 의무 (정직)

본 세션 작성자(Claude Opus 4.7)가 차세션 Claude 에게 명시 의무:

### 6.1 §5.3 4-Pass 이월 MAJOR 7건 ledger (§5.4 commit 들과 동시 흡수 의무)

|  #  |       Pass       | 적발 내용                                                            | 흡수 위치                                                                |
| :-: | :--------------: | :------------------------------------------------------------------- | :----------------------------------------------------------------------- |
|  1  |       1 M2       | `/Length \d{6,}` Number overflow (24자리 declared 정밀도 손실)       | 자릿수 컷 / BigInt 비교 — `pdf-extractor.ts`                             |
|  2  | 1 M3 / 2 M1 중복 | XSS / Hard Rule 17 / DEPTH 검사 순서 단일 시그널만 표면화            | multi-classification metadata.allViolations 도입 — `schema-validator.ts` |
|  3  | 1 M4 / 3 M3 중복 | `apps/batch/src/pipeline.ts:776` caller PdfParseError 분기 부재      | telemetry 적재 (`engine_telemetry` 통합 시점) — `pipeline.ts`            |
|  4  | 1 M5 / 3 M2 중복 | `Object.values(EXAM_IDS)` substring Year 2 false positive            | word boundary regex + Unicode normalize — `schema-validator.ts`          |
|  5  |       3 M3       | `pdfPath` 절대경로 평문 노출 (path traversal info disclosure)        | `basename` message + metadata 절대경로 — `pdf-extractor.ts`              |
|  6  |       3 M4       | 영어 에러 메시지 — 한국어 graceful 안내 부재                         | i18n 키 도입 (`pdf.empty` 등) — Phase 1 후반 일괄                        |
|  7  |       3 M6       | FUZ-01 zombie 검증 in-process counter 한정 (실 OS process 검증 부재) | `pgrep -P $$ python3` test 추가 — `fuz-01-pdf-malicious.test.ts`         |

### 6.2 §5.2 4-Pass 이월 MAJOR 7건 ledger (handoff-030 §6.1 정합)

handoff-030 §6.1 그대로 유지 — 본 세션 미흡수, §5.4 commit 들과 동시 흡수 의무.

### 6.3 §5.3 NOT-IMPL 3건 (CHA-01/02/04) 진입 시 4-Pass 의무

CHA-01/02/04 본격 구현 commit 별 4-Pass 의무 — 본 §5.3 (FUZ-01/02) 처럼 시나리오별 1 commit / Day 별 1 4-Pass / 1 흡수 commit 패턴 유지. auto-review-protocol §"L2 이상 구현 작업 완료 시" 정합.

### 6.4 §5.3 4-Pass 통합 인덱스 + Pass 1~4 보고서 직접 읽기 의무

차세션 Claude 는 commit `4baccac` 의 흡수만 신뢰하지 말고, 통합 인덱스 (`.claude/reviews/review-20260502-090418-sprint1-step5-3-fuz-01-02-4pass-index.md`) + 각 Pass 보고서 직접 읽기. 이월 MAJOR 7건의 정확한 위치 / 흡수 방법 / 회귀 시나리오 인지 의무.

### 6.5 session-health 의무

본 세션 (030) 은 ~110분 도달 시점 (commit 3 + 4-Pass + 흡수 commit 직후) — 90분 임계 초과. 차세션 Claude 도 90분 / 30턴 전 handoff-032 작성 의무.

---

**핸드오프 작성**: Claude (Opus 4.7 1M context) — Session 030
**다음 세션**: Session 031 — Sprint 1 §5.3 NOT-IMPL 3건 (CHA-01/02/04) + §5.4 PARTIAL 7건 + v1.2 보고서
**작성 효력**: 2026-05-02 ~10:40 KST
**예상 완료**: handoff-032 (Sprint 1 P0 15/15 GREEN 후 → BATCH-1 진입 트리거 대기)
