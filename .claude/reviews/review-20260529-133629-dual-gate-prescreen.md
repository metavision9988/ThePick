# TR-0 이중 게이트 사전심사 — 진산 결재 지원 브리프

> **작성**: 2026-05-29 13:36:29 (Session 093) / ts `20260529-133629`
> **연계**: `docs/plans/phase2-tech-debt-workflow.md` §2 이중 게이트 A/B
> **파일명 prefix**: `review-*` (review-gate.sh hook 정합)

---

## ★ 워터마크 (영속 — 본 브리프 헤더 의무)

> ⚠️ **본 측정/검수는 방법론·신호 방향 검증용 pilot(N=12), 통계 일반화 아님,
> 손해평가 실무 도메인 한정.** (S5-6b README §"N=12 통계 워터마크" 원문 인용:)
>
> > ⚠️ **본 측정은 방법론·신호 방향 검증용 pilot 이며 통계 일반화가 아니다.**
> > N=12 (measurable 7 / unmeasurable 5) 는 통계 유의도를 산출하지 않는다.
> > graphOnlyRecovery / regression / Δ 의 절대값 해석 금지. 본 측정은 (a)
> > harness 정확성 (b) graph walk 신호의 방향성 (c) pilot 외 30~50 확대
> > 가치 평가의 3가지에만 사용된다. 결론의 일반화는 N≥30 확대 + 진산
> > 결재 후에만 가능. 추가 제한: 손해평가 실무 도메인 한정 (상법/농학/재해
> > 법령 거버넌스 측정 0건).

> **본 문서는 결재가 아니라 결재 지원 — 진산 최종 권위.**
> **read-only: D1 write 0, exam_questions 무변경, vector/graph 호출 0
> (순환차단 G-6b-1).** Gate A 는 plan/마이그/스키마 정적 대조, Gate B 는
> golden draft × approved-nodes-corpus.json 정적 grep/Read 만 사용.

---

## 0. 한 줄 요약

> **이중 게이트 사전심사 결과 — Gate B(golden 12): APPROVE 7 / FIX 5 / REJECT 0,
> 순환위반 0건(골든 신뢰성 정상). Gate A(TR-0 plan): 4 리뷰어 전원 A안 권고,
> 단 결재 전 plan §2 본문/메타 분류에 `confusionType`·`calcVariables` 2컬럼
> 누락(치명)과 §5.1 G-TR0-4 의 "0008 정책 트리거" 허위 참조(CRITICAL) 정정 필수.**

---

# 게이트 B — golden 12문항 (검수 지원)

## ★ 순환위반 플래그: **0건** (정상)

> circularViolation=true 항목 **0건**. 12문항 전부 순환편향 차단(G-6b-1) 렌즈
> APPROVE — expected 가 측정대상(vector/graph) 검색 랭킹을 베낀 흔적 없음, 모든
> 검수자 usedMeasurementSystem=false. **골든 자체의 신뢰성 위협 없음.**
> (>0 이었다면 본 절 최상단 적색 경고 표시 후 측정 중단 권고했을 것.)

## 요약 카운트

| 권고        | 건수 | questionId                                                              |
| :---------- | :--: | :---------------------------------------------------------------------- |
| **APPROVE** |  7   | Q-2022-08-045, Q-2023-09-045, Q-2025-11-2ND-001, -002, -003, -005, -009 |
| **FIX**     |  5   | Q-2019-05-031, Q-2025-11-2ND-004, -012, -014, -015                      |
| **REJECT**  |  0   | (없음)                                                                  |
| **미결**    |  0   | (없음)                                                                  |

> 표현은 전부 **"권고"** — 진산이 문항당 수초로 최종 APPROVE/FIX/REJECT 확정.

## per-item 표

| questionId        | measurable | expected                        |    권고     | 3렌즈 핵심 근거 요약                                                                                                                                                                                                                                                                                                                                   | suggestedFix(요지)                                                                                                                                                                                                                                  |
| :---------------- | :--------: | :------------------------------ | :---------: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q-2019-05-031     |    true    | LAW-002                         |   **FIX**   | 정답근거 사실성 PASS(손해평가요령 제3조 = 손해평가인 업무). **그러나 expected LAW-002 는 상위 수권법(농어업재해보험법 제11조)이라 정답 변별내용 미보유 = 근사(approximate) 노드.** 정밀 노드(요령 제3조) 코퍼스 부재 확정(LAW 전수 LAW-001~015, 요령 노드는 LAW-003/004뿐). drafter confidence=med 자기고지 정직. loose golden → recall 과대평가 위험. | 신규노드 자율생성 금지(Ontology Lock). 택1: (1) expected 유지 + `approximateGolden=true` 메타로 G-S5 집계 시 '근사 회수' 분리 태깅 / (2) 요령 제3조 노드 별도 코퍼스 확대(Hard Limit·별도 결재) 후 교체.                                            |
| Q-2022-08-045     |    true    | LAW-003                         | **APPROVE** | 노드명 자구 직결(손해평가요령 제11조 검증). LAW-003 description 이 4보기 전부 커버. 법령 원문(batch-1-raw p.403~434) 대조 일치. LAW-002(법 제11조)·INV-015 경쟁 노드 정확 배제.                                                                                                                                                                        | (없음) 단 INV-015(검증조사) 의미동치 근접중복 → false-negative 채점 방어 원하면 accepted-equivalent 추가 검토(선택).                                                                                                                                |
| Q-2023-09-045     |    true    | LAW-004                         | **APPROVE** | 노드명 직결(요령 제12조 손해평가 단위). 보기 ㄱㄴㄷ 3개 모두 제12조 단일조문 도출. single-hop 완전. LAW-002/003 동일 조번호 정확 구분.                                                                                                                                                                                                                 | (없음) 비차단 note: LAW-004 description 이 '단위별 현지조사'만 서술, '단위 정의'(농지별 등) 미포함 → 코퍼스 description 보강 권고(라벨 차단 아님).                                                                                                  |
| Q-2025-11-2ND-001 |   false    | (없음)                          | **APPROVE** | 농업위험 4유형·정책수단 = 농업위험관리론 영역. 코퍼스 488 전수 grep: 핵심어(생산/가격/제도/인적위험·정책수단) 0건, '위험' 121회 전부 보험 보장구분. INS-29 표면 인접뿐. unmeasurable 정직(분모 제외 정당).                                                                                                                                             | (없음) note: INS-29 수입보험 표면 인접이 measurable 오인 소지 → '인접≠근거' 명시.                                                                                                                                                                   |
| Q-2025-11-2ND-002 |   false    | (없음)                          | **APPROVE** | 가축재해보험 돼지 특약 질병명(TGE/PED). 코퍼스 가축/돼지/질병 키워드 0건, 매칭 3종(특별약관 10/보통약관 2/수의 3) 전수 농작물 오탐 확인. 도메인 경계 밖 정직 라벨.                                                                                                                                                                                     | (없음) note: 가축 코퍼스 확대 시 measurable 재분류 대상(현 시점 한정 유효).                                                                                                                                                                         |
| Q-2025-11-2ND-003 |   false    | (없음)                          | **APPROVE** | 과수 인수제한 목적물 재식면적 수치. '인수제한' 등 개념 0건, 4품목 CROP 노드는 산식/조사뿐(인수제한 기준 미보유). 정답 수치(3.3/1,200) 0건. unmeasurable 정직.                                                                                                                                                                                          | (없음) note: 인수제한은 약관/업무방법서 영역 → 코퍼스 갭. 향후 코퍼스 확대 carry-over 가치.                                                                                                                                                         |
| Q-2025-11-2ND-004 |    true    | CONCEPT-080                     |   **FIX**   | **양면 multi-hop(감자∩고추)인데 expected 는 감자 절반(CONCEPT-080)만 anchor.** 감자측 정확(1급 역병·2급 시들음병 description 직결). 고추측 등급→해충 매핑 노드 코퍼스 부재(INV-068/CROP-049/F-94 는 등급 인정비율 언급뿐). CONCEPT-080 단독으로 정답 도출 불가. why='고추측 부재' 약간 과장(개념노드는 존재).                                          | expected 노드 변경 불요(CONCEPT-080 유지 정당). why 문구 정정('고추 등급→해충 매핑 미수록'). 진산 택1: (a) 단일 anchor 유지+측정 시 partial 처리, (b) INV-068 보조 anchor 추가(정답도출력 미개선 명기), (c) measurable=false 재분류.                |
| Q-2025-11-2ND-005 |   false    | (없음)                          | **APPROVE** | 급부 반대급부 균등의 원칙·보험료 산정 = 보험계리 영역. 코퍼스 grep: 급부/반대급부/균등/보험료/사고발생확률 0건, FORMULA 129 전부 손해평가 산식. unmeasurable 정직. 문항 self-contained(풀이 본문 포함)이나 grounding 노드 없으면 measurable=false 가 맞음.                                                                                             | (없음) note: 보험이론 유형은 별도 코퍼스 확대 전까지 측정 대상 불가(carry-over 정합).                                                                                                                                                               |
| Q-2025-11-2ND-009 |   false    | (없음)                          | **APPROVE** | 과수 8품목 보험기간 보장종료 한도일 8개. INS-07/08 보장방식 정의뿐(품목별 날짜표 미포함). 정답 날짜 grep 0건(10.31=마늘·8.1=무화과 무관). unmeasurable 정직.                                                                                                                                                                                           | (없음) note: 보험기간 날짜표 노드 코퍼스 부재 = 실 커버리지 공백(Phase C BATCH carry-over). why 포괄단정 표현은 '이 8품목 한해' 로 정밀화 권고.                                                                                                     |
| Q-2025-11-2ND-012 |    true    | INS-08, INV-035                 |   **FIX**   | **4작물(오디/두릅/블루베리/감귤) 조사시기 span 인데 expected 는 감귤(INV-035)+우산개념(INS-08) 2개만 = 1.x 작물만 직접 커버.** name/page_ref PASS. 두 노드 description 에 정답 조사시기 라벨(결실완료/정아발아/개화/수확직전) 부재. 오디·두릅 전용 조사노드 코퍼스 부재(진성 갭). confidence=med 정직.                                                 | expected 에 CROP-018(오디)/CROP-019(두릅)/CROP-020(블루베리) 추가 권고(①②③ 칸 정답 주체). 보조 INV-038(블루베리 꽃피해) 검토. 오디/두릅 INVESTIGATION 노드 fabricate 금지. 진산 택: (A) CROP 3노드 확장 / (B) measurable=false·confidence=low 강등. |
| Q-2025-11-2ND-014 |    true    | INS-21, INV-060                 |   **FIX**   | **why 전제가 사실 오류**: "구체 일수는 constants 영역 노드 미보유"는 거짓. **5개 답 전부 담은 정밀노드(CROP-028 고구마·CROP-038 감자가을·CROP-035 차·TERM-037/038)가 코퍼스에 실재**하나 expected 누락. ★결정적: 차(茶) ④4.8·⑤2.8 은 expected 두 노드 어디에도 없음(INV-060 적기표에 차 미열거). confidence=low 가 거짓전제 산물.                      | expected 추가(과소 해소): **CROP-035(차)·TERM-038(신초) 필수**(④⑤ 정답원), CROP-038(감자가을) 권고(②③), 선택 CROP-028/TERM-037(①). why "노드 미보유" 문구 삭제/정정. confidence low→med/high 상향. INS-21 잉여 성향(진산 재량).                     |
| Q-2025-11-2ND-015 |    true    | F-103, CONCEPT-105, CONCEPT-023 |   **FIX**   | **CONCEPT-105(비례보상)은 spurious/distractor** — 정답은 min(손해액−자부, 보험가입금액) 단일산식, 비례보상 비율연산 세 물음 모두 부재(손계산: 비례보상 적용 시 A동 9.6M≠정답 19.6M). F-103 정확(min 산식 직결). CONCEPT-023 자부 주제 타당하나 농업용시설물 자부 근거는 INS-27. confidence=high 인데 비례보상 손계산 반증 = 정직성 미달.               | **CONCEPT-105 제거**(비례보상 미적용). 멀티홉 2홉 필요 시 INS-27(p.579, MIN산식+단지·1사고 자부)로 대체. 권장 expected=[F-103, CONCEPT-023, INS-27]. confidence high→med 정정.                                                                      |

### FIX 5건 공통 패턴 (진산 결재 가이드)

- **2건(Q-031, Q-004)** = "정밀 노드 코퍼스 부재 → 근사/부분 anchor" — fabricate 금지(RULE #5), Ontology Lock(신규노드 자율생성 금지). 진산 택: 근사 태깅 유지 vs 별도 코퍼스 확대(Hard Limit·별도 결재) vs unmeasurable 강등.
- **2건(Q-012, Q-014)** = "정답원 노드가 코퍼스에 실재하나 expected 누락(과소 라벨)" — **이건 즉시 보강 가능** (CROP/TERM 노드 추가, Ontology Lock 위반 아님). Q-014 는 추가로 why 거짓전제 정정 필요.
- **1건(Q-015)** = "spurious 노드 포함(과대 라벨)" — CONCEPT-105 제거 또는 의미(cap vs 곱셈) 확정 후 처리. F-103/CONCEPT-023 은 정확.

---

# 게이트 A — TR-0 plan (사전심사 지원)

## A안 vs B안 의사결정 표 (4 리뷰어 종합)

| 리뷰어                          | 권고  | 핵심 근거                                                                                                                                                                                                                        |
| :------------------------------ | :---: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A안 회의론자 (devil's advocate) | **A** | A안 방향 옳음, 폐기 사유 없음. 단 WHEN-절 극성(default-allow vs default-deny) 미결정·미분류 4컬럼·G-TR0-4 전제 정정이 결재 선결조건.                                                                                             |
| backend (B안 채택 자기반박)     | **A** | G-S5 pilot 측정은 파일 골든(readFileSync)만 사용 → B안 question_node_links 없어도 진행, A안 trigger 교체조차 측정 전제 아님. B안 "C-4 동시해결"은 4-leg 중 1-leg(related_nodes)만 해소 = 과장. B안은 폐기 아닌 TR-1 이월이 정확. |
| backend (마이그 0038 안전성)    | **A** | WHEN 절 화이트리스트는 0014 검증 패턴 재사용 = 회귀 표면 좁음. D1 단일 트랜잭션 DROP+CREATE 안전, Hard Limit 무충돌. 단 confusionType/calcVariables 분류·G-TR0-4 허위참조·distractors 보호등급 정정 선결.                        |
| quality-engineer                | **A** | 게이트 G-TR0-1~3 잘 커버, G-TR0-4 공허·G-TR0-5 no-op 통과 결함. 5개 게이트 보강(G-TR0-6~12) 시 A안 안전 진행. backend C-7 권장과 정합.                                                                                           |

### ▶ 다수결 권고: **A안 (4/4 만장일치)**

**이유**: (1) G-S5 pilot 측정은 파일 골든 경로라 트리거·question_node_links 무관 → B안이 측정 차단을 더 오래 묶는 역효과. (2) A안은 0014 `prevent_knowledge_nodes_update` 가 production 검증한 동형 WHEN-절 패턴 = 회귀 표면 최소(마이그 1건, schema shape 무변경). (3) B안(question_node_links)은 폐기 아닌 **TR-1 이월**이 정확(table_node_links 동형 선례 존재, Phase B/Year2 자연 확장). **단 A안 채택 ≠ 무조건 코딩 진입 — 아래 선결 정정 필수.**

## bodyColumnGap — 본문 컬럼 enumeration 완전성 (★치명 경고)

> **불완전(incomplete)** — schema.ts:319~342 examQuestions **22컬럼** 중 plan §2
> 3분류(본문8/메타6/상태4 + id/createdAt)가 **`confusionType`(337) + `calcVariables`(341)
> 2컬럼을 누락.** 4 리뷰어 중 3명(skeptic·safety-backend·quality)이 독립 발견.

| 누락 컬럼           | schema.ts                                  | 위험                                                                                                                                                                                          |
| :------------------ | :----------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`calcVariables`** | 341 (JSON, calc형 Formula Engine 입력변수) | **0032:14 가 BATCH UPDATE 명시 대상.** 답안 산식 정확도 직결(L3 Formula Engine). default-deny 극성이면 향후 calc BATCH 재차단(C-7 사고 재발). default-allow 면 무방비 UPDATE 허용(답안 회귀). |
| **`confusionType`** | 337 (enum CONFUSION_TYPES)                 | 혼동유형 라벨, 명백히 메타인데 미분류 → 화이트리스트 enumeration 에서 누락 위험.                                                                                                              |

추가 우려(컬럼은 분류됐으나 보호등급 의심):

- **`distractors`**(340, 객관식 오답 후보) = plan §2 가 자유 UPDATE 메타로 분류했으나 buildShuffledChoices(routes.ts:883) 거쳐 학습자 노출 → **답안 안전 표면(Pass3 Hard Stop)**. answer 와 다른 보호등급은 4지선다 정답 무결성상 비일관.
- **`id`(PK)·`createdAt`** = WHEN-절 극성에 따라 default-allow 면 PK/타임스탬프 재키잉 허용 위험(skeptic 지적).

> **실측 확인**: schema.ts 22컬럼 = id,year,round,questionNumber,subject,content,answer,
> explanation,validFrom,validUntil,supersededBy,relatedNodes,relatedConstants,status,
> examType,topicCluster,memorizationType,confusionType,inputType,distractors,calcVariables,
> createdAt. plan §2 는 confusionType·calcVariables 외 20컬럼 분류. **ADR-046 의 schema.ts
> 1:1 대조표 작성 시 22컬럼 전수(본문 ABORT / 메타 허용 / 불변 ABORT / status 결정) 강제 필요.**

## ★ plan 의 0008 status 트리거 참조 정확성 검증 결과 (명시 의무)

> **plan §2(52-53) + §5.1 G-TR0-4(92) 의 "exam_questions status 는 0008 정책
> 트리거가 별도 보호" 전제는 실코드 대조 결과 거짓(CRITICAL).**

실측 증거:

1. **0008 = webhook_events 전용**. `migrations/0008_webhook_events.sql:84` =
   `enforce_webhook_events_status_transition` — exam_questions 와 무관.
2. **status_transitions(0010) CHECK** = `target_type IN ('node','formula','constant')`
   (0010:27) — **exam_question 미커버.**
3. **exam_questions 트리거 전수**: 0004(UPDATE 전면 ABORT) + 0005(year/content/status/
   created_at NOT NULL INSERT 4종)뿐. **status 전이 가드 0건.**
4. **0004:13-14 주석** 이 약속한 `deprecate_exam_question()` 저장 프로시저 = 미구현
   (SQLite 저장 프로시저 개념 부재).

→ **결론**: exam_questions.status(active/deprecated/flagged) active→deprecated 전이는
오직 UPDATE 로만 가능한데 현 전면 ABORT 트리거가 이를 막고 있고, **0038 후에도 status
전이 보호/허용 정책이 미설계인 채 G-TR0-4 가 vacuously PASS 처리될 위험.** approved-nodes-sql.ts
invariant(flagged 노드 학습자 노출 절대 불가, backend C-6 직결)와 직접 충돌 소지. plan 이
"status 는 별도 가드 보호"로 결재자를 오도 → **status 전이 경로를 본 plan 이 명시 결정해야 함.**

## binaryGateGaps (G-TR0 보강 제안 — 4 리뷰어 종합)

- **G-TR0-4 재정의(CRITICAL)**: "0008 충돌 0 확인"은 존재하지 않는 트리거 대상 → vacuously PASS. exam_questions status 전이 경로(active→deprecated/flagged) 자체를 본문분류 ABORT 로 막을지 별도 게이트 둘지 결정 + 테스트. (C-6 flagged 노출 직결)
- **G-TR0-6(신규) 트리거 부재 fail-open 검출**: 0038 적용 후 sqlite_master 에서 `prevent_exam_questions_body_update` COUNT=1 + 구 `prevent_exam_questions_update` COUNT=0 확인. 현 G-TR0-5(COUNT/NULL 보존)는 no-op 마이그/신규트리거 생성실패도 녹색 통과(본문 가드 소실 위양성).
- **G-TR0-9(신규) 미분류 컬럼 전수 커버**: 22컬럼 전수를 본문/메타/불변(id·createdAt)/status 로 분류·각 ABORT/허용 명시. calcVariables/confusionType 사각 제거.
- **G-TR0-10/11(신규)**: NULL→값 vs 값→값 덮어쓰기 의도 명시 + 545행 단일 UPDATE 멀티행 원자성(1행 변동 시 전체 ABORT) 검증.
- **G-TR0-12(신규) 테스트 하네스 명시**: `createD1FromAllMigrations`(readdir 자동, 0038 포함) 강제. `SCENARIO_MIGRATIONS` 큐레이션 배열(0037까지, TD-API-001 부채) 사용 시 0038 누락 → 트리거 미적용 환경 위양성.
- **G-TR0-3 WHEN 식 명시**: nullable 본문(answer/explanation) NULL↔값 전이 ABORT 위해 `IS NOT`(NULL-safe) 비교 필수. `OLD.content <> NEW.content` 만 쓰면 `NULL <> x`=거짓으로 백필 우회.

## CRITICAL 6 / MAJOR 7 종합

| #   | 심각도   | 리뷰어           | 제목                                                                                        |
| :-- | :------- | :--------------- | :------------------------------------------------------------------------------------------ |
| 1   | CRITICAL | skeptic          | §2 상태머신 전제 거짓 — exam_questions status 전이는 본 트리거 외 가드 없음, 현재 영구 차단 |
| 2   | CRITICAL | skeptic          | WHEN 절 극성(default-allow vs default-deny) 미결정 — A안 핵심 함정                          |
| 3   | CRITICAL | safety-backend   | 본문/메타 분류 누락 — confusionType, calcVariables (답안 안전 직결)                         |
| 4   | CRITICAL | safety-backend   | G-TR0-4 "0008 정책 트리거" 허위 참조 — exam_questions status 가드 부재                      |
| 5   | CRITICAL | quality          | G-TR0-4 가 존재하지 않는 트리거 전제 → 공허 + 무가드 status 전이 미검출                     |
| 6   | CRITICAL | quality          | G-TR0-5 production smoke 가 트리거 교체 자체 미검증 — fail-open 녹색 통과                   |
| 1   | MAJOR    | skeptic          | §2 본문/메타 분류 schema 22컬럼 1:1 대응 실패 (calcVariables/confusionType/id/createdAt)    |
| 2   | MAJOR    | skeptic          | G-TR0-5 가 본문 실제 보호 미검증 + 구 트리거 DROP 누락 시 잔존 공존                         |
| 3   | MAJOR    | B-anchor backend | plan §4.1 B안 "C-4 4-way sync 동시 해결"은 1/4 leg 만 해결 — 결재자 오인                    |
| 4   | MAJOR    | safety-backend   | distractors 자유 UPDATE 메타 분류 — 객관식 오답 후보 = 답안 안전 표면                       |
| 5   | MAJOR    | quality          | plan §2 분류가 실제 컬럼 전수 미커버 — 약 5컬럼 게이트 사각                                 |
| 6   | MAJOR    | quality          | 혼합 UPDATE NULL→값 backfill 멀티행 원자성·값 덮어쓰기 의도 미검증                          |
| 7   | MAJOR    | quality          | 신규 테스트 D1 하네스(All vs SCENARIO) 미명시 — 후자면 0038 누락 위양성                     |

(MINOR 다수: §7 down 마이그=backfill 재차단 트레이드오프 미명시·D1 forward-only 수동 SQL / 0013 선례 미인용 / WHEN 식 OR-AND 오류 위험 등 — 보고만, 비차단)

## ▶ 옵션 권고 (A/B 다수결 + 이유)

**A안 채택 권고 (4/4 만장일치)** — 단, **무조건 코딩 진입이 아니라 아래 3건 결재 선결조건**:

1. plan §2 에 `confusionType`·`calcVariables` 분류 추가 (calcVariables 는 본문급 보호 여부 결재 = L3 Formula Engine 결합).
2. §2/§5.1 G-TR0-4 의 "0008 정책 트리거" 허위 참조 정정 + exam_questions status 전이 경로 명시 결정.
3. WHEN-절 극성(default-allow vs default-deny) 결재 — 보안 정책 결정이지 구현 디테일 아님.

B안(question_node_links)은 폐기 아닌 **TR-1 이월** — backend C-4 별도 plan 에서 4-leg closure 게이트 명시 후 평가.

---

# 다음 액션 — workflow §2 이중 게이트 연결

> `docs/plans/phase2-tech-debt-workflow.md` §2 이중 게이트 A/B 와 연동.
> **오늘 진산 할 일 체크리스트** (둘 다 결재되어야 다음 코딩 진입):

### 게이트 A — TR-0 plan 결재 (5~10분)

- [ ] §4.1 옵션 **A안 채택** (4/4 권고) — plan `approved_by` 갱신
- [ ] **선결 정정 지시 1**: §2 에 confusionType·calcVariables 분류 추가 (calcVariables 본문급 보호 여부 결정)
- [ ] **선결 정정 지시 2**: §5.1 G-TR0-4 "0008 트리거" 허위 참조 정정 + status 전이 경로 명시
- [ ] **선결 정정 지시 3**: WHEN-절 극성(default-allow/deny) 결재
- [ ] G-TR0-6/9/10/11/12 보강 게이트 ADR-046 반영 지시

### 게이트 B — golden pilot 12 검수 (~10분)

- [ ] APPROVE 7 문항 확인(Q-2022-08-045, Q-2023-09-045, Q-2025-11-2ND-001/002/003/005/009)
- [ ] FIX 5 문항 결정:
  - [ ] Q-2025-11-2ND-012·014 = **즉시 보강 가능**(CROP/TERM 정답원 노드 추가, Ontology Lock 무관)
  - [ ] Q-2025-11-2ND-015 = CONCEPT-105 제거 또는 cap/곱셈 의미 확정
  - [ ] Q-2019-05-031·Q-2025-11-2ND-004 = 근사 anchor → 태깅 유지 vs 코퍼스 확대(별도 결재) vs unmeasurable 강등
- [ ] `golden-pilot-draft.json` 의 `items[].jinsanReview.decision` 갱신

### 묶음 진행 (A+B 모두 결재 후, Claude 자동)

1. ADR-046 Draft (22컬럼 1:1 대조표 + status 전이 정책 + 보강 게이트)
2. golden-pilot-approved.json 동결 (mechanical, D1 write 0)
3. 마이그 0038 SQL (L3, 4-Pass — createD1FromAllMigrations 하네스 명시)
4. G-TR0-1~12 테스트
5. D1 preview dry-run
6. 진산 인증 게이트 ×2 (production trigger 적용 / wrangler dev --remote 측정)

---

## 부록 — 검증 무결성

- **Gate B**: 12문항 × 3렌즈(근거정확성·과대과소·순환차단) = 36 verdict. usedMeasurementSystem=false 전수. approved-nodes-corpus.json(488 노드) 정적 grep/Read 만 사용. circularViolation 0건.
- **Gate A**: 4 리뷰어 plan/마이그/스키마 정적 대조. 본 브리프 작성 시 실코드 재확인: 0008(webhook_events)·0010(target_type CHECK)·exam_questions 트리거 전수·schema.ts 22컬럼 — 전부 일치.
- **D1 write 0 / exam_questions 무변경 / vector·graph 호출 0** (순환차단 G-6b-1 준수).
