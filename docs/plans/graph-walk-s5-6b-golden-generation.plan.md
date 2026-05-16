# S5-6b — golden 평가셋 생성 (LLM draft → 진산 검수)

> **DEFCON L2 (콘텐츠 생성).** 진산 결재 2026-05-16: "LLM 생성 → 진산
> 검수 (소규모 먼저)". 배경: G-S5 차단 — production 기출 545 전부
> `related_nodes` NULL ([[project_g_s5_golden_data_gap]]).
> **document-first**: golden 생성 *방법론*이 틀리면 G-S5 결론 전체가
> 무효(harness 와 동급 리스크). 본 plan 이 방법론 고정 후 pilot 생성.
> **Hard Limit**: AI 생성 데이터는 draft 상태로만 — 진산 검수 후 approved.

---

## 0. Reality Anchor — golden 생성이 틀릴/무효일 이유 3가지

1. **순환편향(circular bias) — 치명.** golden expected-node 를 _측정
   대상 시스템_(vector `/api/search` · graph-walk)으로 뽑으면, "graph 가
   잘 찾는 노드"를 정답으로 박는 자기충족이 된다 → G-S5 가 무조건 高.
   **차단: expected 선정 시 vector/graph 검색 절대 미사용.** 오직
   (a) 문항 본문의 주제·요구지식 (b) approved 노드 코퍼스(id/name/type/
   page_ref) 의 _명칭·의미 대조_ 로만 선정. 사람(진산)이 최종 검증.
2. **"느슨한 연관" ≠ 정답 근거.** 한 문항에 의미상 관련 노드는 수십
   개일 수 있다. golden 은 "정답을 맞히려면 _반드시 알아야 하는_ 핵심
   노드"여야 한다(시험이 测定하는 지식). 과대 라벨 → recall 분모 팽창
   → graph/vector 둘 다 낮게 나와 비교 무의미. **정밀 라벨 원칙.**
3. **대표성 결여 → multi-hop 신호 소실.** 정의형 단일 문항만 샘플하면
   graph 가 기여할 여지(개념→산식→상수 연쇄)가 표본에 없어 "graph
   무의미" 가 인위적으로 나온다. **표본은 단일홉/멀티홉 plausible 을
   의도적으로 혼합** + 3 과목 + 2차 손해평가(산식 연쇄) 포함.

→ golden 신뢰 = 순환차단 + 정밀라벨 + 대표성 + **진산 인간검수**.

## 1. scope

### In

1. 본 plan (방법론 고정).
2. pilot 표본 추출(read-only D1) — 대표성 설계대로 ~12문항.
3. pilot golden **draft** 생성: 문항별 expected node id + **근거(노드명·
   왜 정답근거인지·단일/멀티홉 추정)**. 영속 artifact(JSON+md).
4. 진산 검수 프로토콜 + 검수 후 approved golden 파일 동결 절차.
5. (검수 통과 후) G-S5 pilot 측정 → 결과로 30-50 확대 여부 판단.

### Out (anti-overreach)

- D1 `exam_questions.related_nodes` 직접 write (Hard Limit AI=draft;
  golden 은 측정 입력 artifact 일 뿐 학습자 노출 콘텐츠 아님 — 미적재).
- 30-50 전량/534 BATCH populate (pilot 검증 후 별도 결재).
- 측정 대상 코드 변경 / S5-7 A 통합 / 실 G-S5 산출(pilot golden
  approved 전까지).
- LLM 의 수식 계산·constants 추론(Hard Limit) — 본 작업은 문항→개념
  노드 _대조_ 이지 산식 연산 아님(비대상이나 명시).

## 2. 데이터 grounding (실측, 2026-05-16 remote production)

- active 기출 534: 1차 525(상법 보험편 175 / 농학개론 175 / 농어업
  재해보험법령 175) + 2차 9(이론 6 / 손해평가 3).
- approved nodes 488: FORMULA 129 · CONCEPT 108 · CROP 85 ·
  INVESTIGATION 80 · TERM 42 · INSURANCE 29 · LAW 15.
- Q↔node 링크 0 (golden 전무) → 본 작업이 최초 생성.

## 3. golden 정의 + 생성 절차 (순환차단 핵심)

**expected node 정의:** 해당 문항의 정답을 도출하려면 _반드시_ 의존하는
approved knowledge_node(들). "정답 근거 노드". 보통 1~3개. 0개면 그
문항은 측정불가(harness `unmeasurable`, 분모 제외 — 은폐 아님).

**생성 절차 (각 문항):**

1. 문항 본문(+선택지) 읽고 _무엇을 묻는지_ 한 줄 요지 작성.
2. approved 노드 코퍼스에서 **명칭/의미 대조**로 후보 선정 —
   ★ vector/graph 검색 미사용(순환차단). 노드 name·type·page_ref 만 참조.
3. "이 노드를 모르면 이 문항을 못 푸는가?" 자문 → 통과만 expected.
4. 문항별 기록: `questionId, contentExcerpt, expected:[{id,name,why}],
hopGuess: 'single'|'multi', confidence: 'high'|'med'|'low'`.
   `why` = 진산이 5초 내 검증 가능한 근거(노드명+정답연결).
5. `single` = 문항 키워드가 노드명과 직결(vector 도 잡을 것).
   `multi` = 문항→중간개념→정답노드 연쇄 필요(graph 기여 가설 지점).

**표본 설계(pilot ~12, 대표성):**

- 상법 보험편 3 (LAW/CONCEPT) · 농학개론 3 (CROP/CONCEPT) ·
  농어업재해보험법령 3 (LAW/INSURANCE) · 2차 손해평가 3 (FORMULA
  연쇄 — multi-hop 신호 핵심).
- 각 과목 내 single/multi 혼합(최소 multi 1). 무작위 아닌 **의도적
  대표 추출**(편향 명시: pilot 은 방법론 검증용, 통계적 일반화 아님).

## 4. 진산 검수 프로토콜 (Hard Limit — draft→approved)

- 산출물: `docs/plans/s5-6-measurements/golden-pilot-draft.{json,md}`
  (status=`draft`, watermark "진산 미검수 — G-S5 입력 불가").
- 진산 검수: 문항별 expected 가 (a) 정답 근거 맞음 (b) 과대/과소 아님
  (c) 순환(검색결과 베낌) 아님 확인. 수정/승인/기각 표기.
- 승인분만 `golden-pilot-approved.json`(harness GoldenFile 형식:
  `{examId,items:[{questionId,content,relatedNodesRaw}],coverageNote}`)
  으로 동결 — `relatedNodesRaw` = 승인 expected id JSON.
- **G-S5 pilot 은 approved 파일로만** 실행(`assertRemoteMeasurementInputs`
  - harness). draft 로 측정 = RULE #4/#5 위반.

## 5. Binary Gates

| Gate              | 입력            | 기대                                                                               | 판정      |
| :---------------- | :-------------- | :--------------------------------------------------------------------------------- | :-------- |
| G-6b-1 순환차단   | draft 생성 로그 | expected 선정에 /api/search·graph-walk 호출 0 (절차상 미사용 + 근거가 노드명 대조) | 절차 감사 |
| G-6b-2 정밀라벨   | draft 문항별    | expected 평균 ≤ 3, 각 `why` 정답근거 명시                                          | 진산 검수 |
| G-6b-3 대표성     | pilot 표본      | 4 과목군 + single/multi 혼합 + multi ≥ 4                                           | 표본 대조 |
| G-6b-4 draft 격리 | artifact        | status=draft, D1 write 0, 워터마크                                                 | grep+검수 |
| **G-S5-pilot**    | approved golden | harness REMOTE 산출(graphOnly/regression/Δ)                                        | 검수 후   |

## 6. Build sequence

1. 본 plan(완료).
2. pilot 표본 문항 추출(read-only D1, 대표성 §3) → 생성 작업대.
3. golden draft 생성(§3 절차, 순환차단) → draft artifact.
4. 진산 검수 상신(§4).
5. 승인분 동결 → `wrangler dev --remote` + harness G-S5 pilot.
6. pilot 결과(graphOnly/regression/Δ) → 30-50 확대 vs NO-GO 판단(§7
   of S5-7 결재자료 연결).

## 7. 잔존 위험

- pilot 12 = 통계 표본 아님. "방법론·신호 방향" 검증용 — 일반화
  결론은 30-50(검수 후) 이후. 리포트 워터마크 명시.
- LLM expected 생성의 잔여 편향(검색 미사용해도 Claude 의 사전지식이
  vector 와 상관). 완화: 진산 인간검수(최종 권위) + `why` 투명화 +
  hopGuess 로 graph 기여 가설을 _사전_ 표기(사후 합리화 차단).
- 2차 손해평가 문항 9개뿐 → multi-hop 산식연쇄 표본 희소. pilot 3
  포함하되 신호 약하면 1차 농학/상법의 개념연쇄로 보강.
