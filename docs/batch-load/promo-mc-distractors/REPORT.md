# promo-1st P3 — 4지선다 서빙 MC 행 적재·검증 리포트

- **일시**: 2026-07-10 KST
- **목적**: 무인증 공개 홍보 서비스(promo-1st)의 4지선다 서빙/서버 채점용 신규 MC 행을 production D1 에 적재.
- **전략**: production 트리거(0004 전면 UPDATE ABORT / 0038 distractors·superseded_by·status ABORT)상 old 행 UPDATE 불가 → **신규 `{oldId}-MC` 행 순수 INSERT**(ADR-046 D-6(a) 정합). old 행 무접촉. content=stem만(보기는 distractors 배열 분리 서빙). answer=old 행에서 INSERT...SELECT 승계, 단 교정 문항은 교정값 리터럴.

## 1. 소스 및 규모

- 소스 = `docs/batch-load/batch-Q-{year}-{round}-1st/batch-Q-*.json` (원 적재 산출물, options 4지 배열 완비). 회차 5~11(2019~2025), 회차당 75문항 = 525.
- 서빙 대상 = **521** (525 − 구조훼손 제외 4).

## 2. ★ 정답 교정 (핵심)

회차별 독립 에이전트 PDF 대조(7)가 **원 JSON answer 36건이 공식 최종정답과 불일치**함을 적발. 원 JSON 은 production old 행의 정본 소스이므로 = production old 행도 동일 오답 보유(→ 별도 인시던트: `docs/audit/incident-1st-answer-errors-20260710.md`).

**검증 방법 (다중 독립):**

1. **1차** — 7 회차 독립 에이전트: 원본 PDF 발문+보기 추출 + 공식 정답지 표 판독 + 실제 풀이 교차검증 → 36건 불일치 적발.
2. **2차 맹검** — 3 에이전트(1차 결과 비공개): 6·7·8회 재확증 → **35건 전건 일치**.
3. **타이브레이커** — 5회 Q46 3중 발산(original 4 / 1차 1 / 2차 2): 정답지 400dpi 직접판독(A형·B형 46=1, 복수정답 표기 없음) + 손해평가요령 제13조 종합위험방식 풀이 + 적재 정본 LAW-179 원문 대조 → **1 확정**(2:1 다수).

**교정 36건 (회차별): 5회 1 · 6회 16 · 7회 11 · 8회 8 · 9~11회 0.** 정본 = `answer-corrections.json`.

교정 문항의 신규 MC 행 answer = **교정값 리터럴**(old 행 오답 승계 차단). production 검산: 신규 answer ≠ old answer = 정확히 36건.

## 3. 구조 훼손 정직 제외 (무음 skip 금지)

| id            | 사유                                   |
| ------------- | -------------------------------------- |
| Q-2019-05-021 | 보기 오배치 + ③④ 누락(원 추출 손상)    |
| Q-2024-10-048 | 표가 option[0] 오배치 + ④(복분자) 누락 |
| Q-2025-11-047 | [별표1] 표 선형화 뒤섞임               |
| Q-2025-11-048 | [별표2] 표 선형화 뒤섞임               |

→ 재구성 후속 트랙(별도). 현재는 서빙 제외(정직).

## 4. 결정적 게이트 (100% PASS 아니면 미생성 + exit 1)

- **빌드 V1~V5**: V1 parseMcChoices 계약(단일 정본, 교정 반영 answer 기준) / V2 4지 고정 / V3 무결성·문항번호 전단사 / V4 원 SQL↔JSON answer 자기일관성 / V5 교정 오버레이 original 정합 + 고아 검출.
- **오버레이 하드 사전조건**(독립 리뷰 C-1/C-2/m-5): 파일 부재 throw · pending 비어있지 않으면 throw · confirmed≠corrections throw · 교정∩제외 겹침/중복 throw.
- **리허설 R1~R5 + R2b byte-동등**: in-memory SQLite 에 전 마이그(0004/0038 트리거)+old 525+신규 MC 적용 후 계약·byte-동등 왕복·stem-only·old 무변경·트리거 통과 확증. violations 0 assert + 정본 직접 로드 + UPDATE/DELETE 부재 assert(m-1/m-3).

빌드 결과: `pass=521 excluded=4 corrected=36 / total=525 · violations=0 ✅`. 리허설: `R1~R5 전부 PASS ✅`.

## 5. 독립 리뷰

`.claude/reviews/review-20260710-091642-4pass-p3-build-rehearse.md` — 4관점 독립 에이전트, 초기 Critical 2/Major 1/Minor 5 → 전건 처분(C-1 fail-loud·C-2 pending 소비·M-1 정본 로드·m-3/m-5 심층방어) → 재검증 Critical 0/Major 0. 음성 테스트로 가드 발동 확증.

## 6. Production 적재 검산 (2026-07-10)

`wrangler d1 execute thepick-db-production --remote --file insert-round-{5..11}.sql`

| 검산 항목                                                       | 값                   | 기대    |
| --------------------------------------------------------------- | -------------------- | ------- |
| mc_total                                                        | 521                  | 521 ✅  |
| mc_wellformed (active·1st·multiple_choice·distractors NOT NULL) | 521                  | 521 ✅  |
| old_1st (무접촉)                                                | 525                  | 525 ✅  |
| old_distractors_leak                                            | 0                    | 0 ✅    |
| mc_stem_marker_leak (① 인라인)                                  | 0                    | 0 ✅    |
| 회차별 (5~11)                                                   | 74·75·75·75·75·74·73 | 동일 ✅ |
| 교정 반영(new answer ≠ old answer)                              | 36                   | 36 ✅   |

**롤백**: `DELETE FROM exam_questions WHERE id LIKE '%-MC';` (가역).

## 7. 잔여 (별건)

- **인시던트**: old 행 오답 36건 정정 = 상태머신 마이그(0004/0038 UPDATE ABORT 해소) 별도 plan. `docs/audit/incident-1st-answer-errors-20260710.md`.
- **구조훼손 4건 재구성** = 표 재추출 후속 트랙.
- old 행 superseded_by 마킹(D-6(a) 나머지 절반) = D-2 상태 동결 carry-over.
