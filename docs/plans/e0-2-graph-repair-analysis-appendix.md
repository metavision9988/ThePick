# E0-2 그래프 수리 — 분석 전문 부록 (4-에이전트 워크플로우, 2026-06-11)

> 본 파일은 `e0-2-graph-repair.plan.md` §7 의 입력 전문 영속본. 결재 검수용 후보 전수표.
> 적대 검증(④)이 ①~③ 의 수치를 덤프 독립 재계산으로 확인 — 반증·정정 5건/과신 5건은 plan 에 반영됨.

---

## ① 고아 노드 24건 전수 분석

## 과제 1 — 고아 노드 24건 전수 분석

### 0. 검증 전제 (실측 사실)

- **정본 리포트 24건 재확인**: `docs/plans/master-remediation-20260610/g-ws2-integrity/integrity-2026-06-10T23-47-26.json` → ORPHAN_NODE 24건, stats = totalNodes 794 / totalEdges 1274 / activeNodes 783 / activeEdges 1274.
- **덤프 직접 재계산 = 33건**: 활성 노드(783) 중 활성 엣지 0건 = 33건. 차이 9건은 전부 TERM 노드(TERM-019/020/022/023/027/028/032/034/037) — `packages/quality/src/graph-integrity.ts:124-125`가 "TERM 노드는 독립 용어 정의 — 엣지 없이 존재 가능"으로 **의도적 면제**. 따라서 24건 = CONCEPT 7 + LAW 17.
- **edge_type whitelist 실확인** (`apps/api/src/search/graph-walk/index.ts:50-63`, `DEFAULT_EDGE_TYPE_WHITELIST` 12종): DEPENDS_ON / USES_FORMULA / APPLIES_TO / DEFINED_AS / PREREQUISITE / REQUIRES_INVESTIGATION / CROSS_REF / GOVERNED_BY / DIFFERS_FROM / SHARED_WITH / TIME_CONSTRAINT / EXCEPTION. ※ 과제문의 "REQUIRES/CALCULATED_BY"는 실코드에 **부재** — 아래 제안은 실재 12종만 사용. (SUPERSEDES는 whitelist 제외 — 버전 시계열 전용.)
- 후보 옆 `(degN)` = 해당 후보의 현재 활성 엣지 수(덤프 실측). 제안 방향은 기존 그래프 관례(시행령→모법 DEPENDS_ON, F-xx→CONCEPT DEPENDS_ON, INV→LAW GOVERNED_BY, CONCEPT-213/214→LAW CROSS_REF)를 따름.

### 1. 전수 표 (24건)

| #   | ID          | type    | name                                                     | 인접 후보 (제안 edge_type)                                                                                                                                                                                                                |                                                분류                                                 |
| --- | ----------- | ------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------: |
| 1   | CONCEPT-030 | CONCEPT | 재조달가액                                               | ① CONCEPT-111 재조달가액 (시설·해가림시설)(deg4) — SHARED_WITH ② CONCEPT-029 손해액(deg3) — DEPENDS_ON(029→030) [추정: 비가림시설 손해액=재조달가액 기준] ③ F-21 종합위험 비가림시설 보험금(deg3) — DEPENDS_ON(F-21→030)                  | **C** (무한정어 일반 개념이 CONCEPT-111과 명칭 중복 — 통합(SUPERSEDES) 또는 ②③ 엣지 보강 양자택일)  |
| 2   | CONCEPT-037 | CONCEPT | 표본구간                                                 | ① CONCEPT-082 표본구간 수확량 합계(deg2) — DEPENDS_ON(082→037) ② INV-048 표본조사 (논작물)(deg6) — CROSS_REF ③ LAW-138 별표1 표본주(구간)수 표(deg1) — GOVERNED_BY(037→LAW-138)                                                           |                       A (TERM-030 동명 존재하나 TERM=용어 계층이라 허용 패턴)                       |
| 3   | CONCEPT-053 | CONCEPT | 면적피해율                                               | ① F-54 논작물 면적피해율(deg1) — DEPENDS_ON(F-54→053) [ID 인접 052/054=논작물 클러스터] ② F-63 면적피해율 (논·밭작물 공통)(deg8) — DEPENDS_ON ③ CONCEPT-073 면적피해율 (밭작물)(deg2) — DIFFERS_FROM(논↔밭)                               |                                                  A                                                  |
| 4   | CONCEPT-057 | CONCEPT | 자연수정불량률 (복분자)                                  | ① F-40 수정불량환산계수(deg1) — DEPENDS_ON(F-40→057) ② F-39 수정불량환산 고사결과모지수(deg3) — DEPENDS_ON ③ INV-054 복분자 (특정위험) 과실손해조사(deg4) — CROSS_REF                                                                     |                                                  A                                                  |
| 5   | CONCEPT-066 | CONCEPT | 피해면적 보정계수                                        | ① F-60 피해면적 보정계수(deg2, 동명 산식) — DEPENDS_ON(F-60→066) ② LAW-014 별표 피해면적 보정계수(deg2, 동명 별표) — GOVERNED_BY(066→LAW-014) ③ INV-047 수량요소조사 (벼만)(deg7) — CROSS_REF                                             | A (동명 3계층 CONCEPT/F/LAW는 설계상 정상 — 단 F-60·LAW-014가 이미 상호 연결돼 있어 CONCEPT만 누락) |
| 6   | CONCEPT-069 | CONCEPT | 통상적 영농활동 (벼)                                     | ① CONCEPT-027 미보상비율(deg5) — DEPENDS_ON(027→069) [추정: 영농활동 미실시=미보상 판정 기준] ② CROP-023 벼(deg11) — APPLIES_TO(069→CROP-023) ③ INV-026 미보상비율 확인(deg5) — CROSS_REF                                                 |                                                  A                                                  |
| 7   | CONCEPT-084 | CONCEPT | 미보상감수량 (밭작물)                                    | ① F-81 미보상감수량 (밭작물)(deg3, 동명 산식) — DEPENDS_ON(F-81→084) ② INV-063 미보상비율 조사 (밭작물)(deg2) — CROSS_REF ③ CONCEPT-026 미보상감수량(deg2) — SHARED_WITH                                                                  |  A (참고: 미보상감수량 CONCEPT 3개 007/026/084 병존 — 084는 (밭작물) 한정어로 의도적 분리로 판단)   |
| 8   | LAW-022     | LAW     | 법 제2조의3 (실태조사)                                   | ① LAW-021 법 제2조의2 기본계획(deg1) — DEPENDS_ON(022→021) [추정: 기본계획에 실태조사 결과 반영] ② LAW-024 법 제3조 심의회(deg2) — CROSS_REF [추정] ③ CONCEPT-214 [1차] 법령 출제영역(deg3) — CROSS_REF(214→022)                          |                                                  A                                                  |
| 9   | LAW-031     | LAW     | 법 제10조의2 (사고예방의무 등)                           | ① LAW-028 법 제7조 보험가입자(deg2) — APPLIES_TO(031→028) [추정: 의무 주체] ② LAW-133 상법 제680조 손해방지의무(deg3) — DIFFERS_FROM [추정: 사전예방 vs 사고후 손해방지 혼동 포인트]                                                      |                                                  A                                                  |
| 10  | LAW-040     | LAW     | 법 제13조 (보험목적물의 양도에 따른 권리 및 의무의 승계) | ① LAW-132 상법 제679조 보험목적의 양도(deg1) — CROSS_REF(특별법↔일반법 동일 주제) ② LAW-026 법 제5조 보험목적물(deg2) — DEPENDS_ON                                                                                                        |                                                  A                                                  |
| 11  | LAW-042     | LAW     | 법 제15조 (회계 구분)                                    | ① LAW-001 법 제8조 재해보험사업자(deg6) — APPLIES_TO(042→001) [추정: 회계구분 의무 주체] ② LAW-051 법 제25조 기금의 회계기관(deg2) — CROSS_REF [추정]                                                                                     |                                                  A                                                  |
| 12  | LAW-043     | LAW     | 법 제17조 (분쟁조정)                                     | ① LAW-038 법 제11조의8 이의신청(deg2) — DIFFERS_FROM [추정: 이의신청↔분쟁조정 혼동 포인트] ② LAW-044 법 제18조(동시 고아·인접 조문) — CROSS_REF                                                                                           |                                                  A                                                  |
| 13  | LAW-044     | LAW     | 법 제18조 (「보험업법」 등의 적용)                       | ① LAW-001 법 제8조 재해보험사업자(deg6) — APPLIES_TO [추정: 보험업법 적용 주체] ② LAW-043 법 제17조(인접) — CROSS_REF ③ CONCEPT-214 출제영역(deg3) — CROSS_REF                                                                            |                                                  A                                                  |
| 14  | LAW-064     | LAW     | 시행령 제2조의3 (기본계획 및 시행계획의 수립ㆍ시행)      | ① LAW-021 법 제2조의2(deg1, **제목 동일 모법**) — DEPENDS_ON(064→021) [기존 시행령→모법 패턴 7건과 동일: LAW-063→019 등] ② LAW-022 법 제2조의3 실태조사 — CROSS_REF [추정]                                                                |                                                  A                                                  |
| 15  | LAW-065     | LAW     | 시행령 제3조 (심의회 회의)                               | ① LAW-024 법 제3조 농업재해보험심의회(deg2, 모법) — DEPENDS_ON(065→024)                                                                                                                                                                   |                                                  A                                                  |
| 16  | LAW-093     | LAW     | 상법 제641조 (증권에 관한 이의약관의 효력)               | ① LAW-092 상법 제640조 보험증권의 교부(deg1) — DEPENDS_ON(093→092) ② LAW-119 상법 제666조 손해보험증권(deg1) — CROSS_REF                                                                                                                  |                                                  A                                                  |
| 17  | LAW-094     | LAW     | 상법 제643조 (소급보험)                                  | ① LAW-095 상법 제644조(동시 고아) — DEPENDS_ON(094→095) [추정: 소급보험 유효요건=644조] ② LAW-109 상법 제656조 책임개시(deg2) — DIFFERS_FROM [추정: 책임개시 시점 비교]                                                                   |                                                  A                                                  |
| 18  | LAW-095     | LAW     | 상법 제644조 (보험사고의 객관적 확정의 효과)             | ① LAW-094 소급보험(동시 고아) — DEPENDS_ON ② LAW-099 상법 제648조 보험료반환청구(동시 고아) — DEPENDS_ON(099→095) [추정: 644 무효→648 반환]                                                                                               |                                                  A                                                  |
| 19  | LAW-096     | LAW     | 상법 제646조 (대리인이 안 것의 효과)                     | ① LAW-097 제646조의2(동시 고아·인접) — DEPENDS_ON ② LAW-103 상법 제651조 고지의무위반(deg4) — CROSS_REF [추정: 대리인의 知=고지의무 판단] ③ CONCEPT-143 고지의무(deg2) — CROSS_REF                                                        |                                                  A                                                  |
| 20  | LAW-097     | LAW     | 상법 제646조의2 (보험대리상 등의 권한)                   | ① LAW-096(인접) — DEPENDS_ON ② LAW-030 법 제10조 보험모집(deg1) — CROSS_REF [추정: 모집종사자↔대리상]                                                                                                                                     |                                                  A                                                  |
| 21  | LAW-098     | LAW     | 상법 제647조 (특별위험의 소멸로 인한 보험료의 감액청구)  | ① LAW-105 상법 제652조 위험변경증가(deg4) — DIFFERS_FROM [추정: 위험 감소↔증가 대칭 혼동 포인트] ② LAW-099 제648조(인접·보험료 환급 계열) — CROSS_REF                                                                                     |                                                  A                                                  |
| 22  | LAW-099     | LAW     | 상법 제648조 (보험계약의 무효로 인한 보험료반환청구)     | ① LAW-095 제644조(무효 원인) — DEPENDS_ON ② LAW-122 상법 제669조 초과보험(deg5) — CROSS_REF [추정: 초과보험 무효시 보험료반환]                                                                                                            |                                                  A                                                  |
| 23  | LAW-114     | LAW     | 상법 제661조 (재보험)                                    | ① LAW-046 법 제20조 재보험사업(deg2) — CROSS_REF(특별법 재보험의 일반법 근거) ② LAW-136 상법 제719조 책임보험자의 책임(deg1) — CROSS_REF [추정: 재보험의 책임보험 성질] ③ CONCEPT-213 [1차] 상법 출제영역(deg3) — CROSS_REF               |                                                  A                                                  |
| 24  | LAW-128     | LAW     | 상법 제675조 (사고발생 후의 목적멸실과 보상책임)         | ① LAW-127 상법 제674조 일부보험(deg5) — DEPENDS_ON(127→128) ② LAW-129 상법 제676조 손해액 산정기준(deg3) — DEPENDS_ON(128→129) [기존 127→129 직결 체인 사이 삽입] ③ INV-089 보험사고 발생 시 절차 (상법)(deg3) — GOVERNED_BY(INV-089→128) |                                                  A                                                  |

### 2. 분류 합계

| 분류                          | 건수   | 내역                                                                                  |
| ----------------------------- | ------ | ------------------------------------------------------------------------------------- |
| **A** 엣지 보강으로 연결 가능 | **23** | CONCEPT-037/053/057/066/069/084 + LAW 17건 전부                                       |
| **B** 본질적 독립 개념        | **0**  | 해당 없음 — 24건 전부 동일 도메인 내 의미상 인접 노드 실재                            |
| **C** 중복·결함 노드 의심     | **1**  | CONCEPT-030 (재조달가액 — CONCEPT-111과 명칭·의미 중복, 통합 또는 엣지보강 결재 필요) |

### 3. 패턴 요약 (plan 입력용)

1. **상법 고아 9건은 연속 결손 구간**: 제641~648조(LAW-093~099) 7건이 한 덩어리 — BATCH 적재 시 해당 조문 구간의 엣지 생성이 통째로 누락된 것으로 보임 [추정]. 인접 조문 DEPENDS_ON 체인 + INV-089/090류 GOVERNED_BY 허브 + CONCEPT-14x DEFINED_AS 3패턴으로 복구 가능.
2. **시행령 고아 2건(LAW-064/065)은 기계적 복구 가능**: 기존 시행령→모법 DEPENDS_ON 패턴(LAW-063→019 등 7건 실재)과 제목 매칭이 1:1 확정적 — 최저위험 보강 대상.
3. **CONCEPT 고아 7건 중 5건은 동명/동주제 FORMULA·별표가 이미 상호 연결돼 있고 CONCEPT만 누락** (066↔F-60/LAW-014, 084↔F-81, 053↔F-54/F-63, 057↔F-39/F-40, 037↔CONCEPT-082) — F-xx→CONCEPT DEPENDS_ON 1~2개씩이면 해소.
4. **수리 경로 제약**: 노드 UPDATE 불필요(전부 엣지 INSERT만으로 해소 가능) — Hard Limit(UPDATE 금지) 비저촉. C 1건(CONCEPT-030)만 SUPERSEDES 신규 INSERT 경로 검토 대상. 신규 엣지는 draft 적재 후 인간 검수 의무.
5. **TERM 9건(재계산 33−24)은 결함 아님**: graph-integrity.ts:124-125 의도적 면제와 일치 — plan에서 재집계 시 혼동 금지.

참조 파일: `/tmp/kn-dump.json` · `/tmp/ke-dump.json` · `/home/soo/ClaudePro/ThePick/docs/plans/master-remediation-20260610/g-ws2-integrity/integrity-2026-06-10T23-47-26.json` · `/home/soo/ClaudePro/ThePick/apps/api/src/search/graph-walk/index.ts` (whitelist :50-63) · `/home/soo/ClaudePro/ThePick/packages/quality/src/graph-integrity.ts` (TERM 면제 :124-125)

---

## ② 유령 참조 103건 전수 분석

# 과제 2 — 유령 참조 103건 전수 분석 (활성 non-SUPERSEDES 엣지 → 비활성 노드)

## 0. 검증 총괄

- 정본 `staleEdgeRefs` 103건 ↔ 덤프(/tmp/kn-dump.json 794노드, /tmp/ke-dump.json 1274엣지) 독립 재도출 결과 **집합 완전 일치** (edgeId/side/nodeId 103/103).
- 103 참조 = **상이한 엣지 103개** (양끝 모두 비활성인 엣지 0건 — 중복 카운트 없음). side 분포: from측 70 / to측 33.
- 덤프상 엣지 is_active=1이 1274 전부 (비활성 엣지 0) — 즉 유령은 전부 "살아있는 엣지"다.
- 비활성 노드는 전체 794 중 정확히 11개로, 유령 진앙 11노드와 동일 집합.

## ★ 핵심 발견 — 처분 전제를 뒤집는 진앙 (plan 최우선 반영)

**11개 비활성 노드의 "후계"는 전부 1:1 대체 노드가 아니라 `[26년 개정]` 개정노트 CONCEPT 노드다.** BATCH-R1이 SUPERSEDES 엣지(EDGE-BATCH-R1-0024~0034, 11건, 전부 is_active=1)를 "이 개정이 저 노드에 영향"이라는 참조 의미로 사용했고, 0013 트리거가 to_node를 전부 비활성화하면서 살아있는 콘텐츠 노드 11개가 통째로 죽었다. 증거:

1. 비활성 11개 중 5개가 **그 자체로 "★ 26년 신규" 콘텐츠**(CROP-042 참깨, CROP-045 녹두, CROP-046 생강, F-71 재파종 보험금, CONCEPT-081 손해정도비율 10단계) — 신규 추가를 알리는 개정노트가 신규 콘텐츠 본체를 비활성화한 역설.
2. 명칭 차원 표적 불일치 2건: CONCEPT-160 "[26년 개정] **감귤** 잔존비율 산식 변경"이 INS-09 "수확전 종합위험 과실손해보장방식(**복분자·무화과** 담보)"을, CONCEPT-161 "[26년 개정] **블루베리** 과실손해피해율 괄호 정정"이 INS-12 "종합위험 **비가림시설** 손해보장방식(포도·참다래·대추)"을 supersede — [추정] SUPERSEDES 표적 자체가 오류.
3. 비활성 6개 제품/품목 노드(INS-01 적과전종합위험II, INS-09, INS-12, INS-33 가축재해보험 총칙, CROP-058 인삼, CROP-059 해가림시설)는 26년 약관에도 존속하는 실체 — "의미 소멸" 아님 [추정: 명칭·개정노트 내용 기준, 교재 원문 대조는 인간 검수].

**따라서 (가) 후계 재배선은 의미적으로 전건 부적합** (예: "INS-01 APPLIES_TO 사과"를 "개정노트 APPLIES_TO 사과"로 재배선 = 의미 파괴). 권고 수리 경로는 엣지 103건 개별 처분이 아니라 **노드 11건 활성 복원(= R1 SUPERSEDES 11엣지의 오용 해소) 단일 결정**이며, 복원 시 유령 103건 전원 자동 해소 + 고아 24·도달불가 133 일부 연동 해소 가능 [추정]. 복원 방법(트리거 우회 마이그레이션 vs v2 신규 INSERT+전 엣지 재배선)은 Hard Limit·L3 = 인간 결재.

## ① + ② 11그룹 표 (진앙 노드 / 후계 / 엣지 구성)

| 진앙 (비활성) | 노드명                                         | 건수 | 후계 (SUPERSEDES from) | 후계명                                                                  | SUPERSEDES 엣지 | 엣지타입 분포                                                                                                                         | side           |
| ------------- | ---------------------------------------------- | ---- | ---------------------- | ----------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| INS-33        | 가축재해보험 (총칙)                            | 26   | CONCEPT-176            | [26년 개정] 가축재해보험 — 소 1년 이내 출하 가입조건 + 국고지원율       | R1-0031         | DEPENDS_ON 10 / DEFINED_AS 5 / PREREQUISITE 4 / USES_FORMULA 3 / CROSS_REF 2 / REQUIRES_INVESTIGATION 1 / APPLIES_TO 1                | from 18 / to 8 |
| INS-01        | 적과전 종합위험 II                             | 23   | CONCEPT-159            | [26년 개정] 종합위험 수확감소보장 과수4종 보험기간 통일                 | R1-0034         | REQUIRES_INVESTIGATION 6 / CROSS_REF 5 / APPLIES_TO 4 / DEPENDS_ON 3 / TIME_CONSTRAINT 2 / EXCEPTION 1 / DEFINED_AS 1 / GOVERNED_BY 1 | from 15 / to 8 |
| INS-09        | 수확전 종합위험 과실손해보장방식               | 17   | CONCEPT-160            | [26년 개정] 감귤(온주밀감) 수확기 잔존비율 산식 변경 ⚠️표적 불일치 의심 | R1-0032         | REQUIRES_INVESTIGATION 6 / USES_FORMULA 5 / APPLIES_TO 2 / EXCEPTION 1 / GOVERNED_BY 1 / CROSS_REF 1 / SHARED_WITH 1                  | from 15 / to 2 |
| CROP-059      | 해가림시설 (시설)                              | 9    | CONCEPT-170            | [26년 개정] 인삼·해가림시설 — 1·2형 통합 + 보험료 할인                  | R1-0030         | DEFINED_AS 3 / APPLIES_TO 2 / USES_FORMULA 2 / CROSS_REF 2                                                                            | from 5 / to 4  |
| INS-12        | 종합위험 비가림시설 손해보장방식               | 8    | CONCEPT-161            | [26년 개정] 블루베리 산출식 괄호 정정 ⚠️표적 불일치 의심                | R1-0033         | APPLIES_TO 3 / USES_FORMULA 1 / REQUIRES_INVESTIGATION 1 / GOVERNED_BY 1 / CROSS_REF 1 / EXCEPTION 1                                  | from 8         |
| CROP-058      | 인삼                                           | 6    | CONCEPT-170            | (CROP-059와 동일 후계)                                                  | R1-0029         | APPLIES_TO 2 / DEFINED_AS 2 / USES_FORMULA 2                                                                                          | from 4 / to 2  |
| F-71          | 가을무·감자(가을재배) 재파종 보험금 ★26년 신규 | 6    | CONCEPT-168            | [26년 개정] 재파종·재정식 보장 품목 + 보험금 산식                       | R1-0025         | USES_FORMULA 3 / DIFFERS_FROM 2 / DEPENDS_ON 1                                                                                        | from 3 / to 3  |
| CONCEPT-081   | 손해정도비율 (생산비보장 — 26년 신규 10단계)   | 3    | CONCEPT-171            | [26년 개정] 준비기생산비계수 + 손해정도비율 20→10% 변경                 | R1-0024         | DEFINED_AS 1 / DEPENDS_ON 1 / CROSS_REF 1                                                                                             | to 3           |
| CROP-042      | 참깨 ★26년 신규                                | 2    | CONCEPT-167            | [26년 개정] 밭작물 신규 품목 + 보장방식 변경                            | R1-0028         | APPLIES_TO 1 / DEFINED_AS 1                                                                                                           | from 1 / to 1  |
| CROP-045      | 녹두 ★26년 신규                                | 2    | CONCEPT-167            | (동일 후계)                                                             | R1-0026         | APPLIES_TO 1 / DEFINED_AS 1                                                                                                           | from 1 / to 1  |
| CROP-046      | 생강 ★26년 신규                                | 1    | CONCEPT-167            | (동일 후계)                                                             | R1-0027         | APPLIES_TO 1                                                                                                                          | to 1           |

후계는 그룹당 정확히 1개(다중 후계 0건), 후계 8노드 전부 활성. CONCEPT-167은 3그룹(CROP-042/045/046), CONCEPT-170은 2그룹(CROP-058/059)의 공동 후계 = N:1 supersede (1:1 대체가 아니라는 추가 증거).

**그룹별 유령 엣지 ID 전수** (prefix EDGE-BATCH- 생략):

- INS-33 (26): 6-0001~0011, 6-0071~0077, 6-0084~0088, L2-0078, R2-0052, S1-0011
- INS-01 (23): 1-0001~0006, 1-0011~0017, 1-0104, 1-0107~0109, 1-0125, 1-0126, 1-0129, 1-0130, R2-0044, S1-0010
- INS-09 (17): 2-0021, 2-0022, 2-0122~0125, 2-0193, 3-0015~0019, 3-0077, 3-0078, 3-0107, 5-0195, 6-0092
- CROP-059 (9): 4-0032, 5-0087, 5-0136~0138, 5-0168, 5-0169, R2-0047, R2-0048
- INS-12 (8): 2-0033~0035, 2-0052, 2-0126, 2-0156, 2-0185, 2-0191
- CROP-058 (6): 4-0031, 5-0086, 5-0134, 5-0135, 5-0166, 5-0167
- F-71 (6): 4-0044, 4-0078, 4-0148, 4-0149, 4-0172, 4-0173
- CONCEPT-081 (3): 4-0150, 4-0207, 7-0028
- CROP-042 (2): 4-0015, 4-0157 / CROP-045 (2): 4-0018, 4-0158 / CROP-046 (1): 4-0019

## ④ 후계 동일의미 엣지 기보유 (재배선 불요 — 중복 방지) 3건

| 유령 엣지          | 내용                             | 후계의 기존 동일 엣지                                   |
| ------------------ | -------------------------------- | ------------------------------------------------------- |
| EDGE-BATCH-R2-0052 | CONCEPT-203 -CROSS_REF→ INS-33   | EDGE-BATCH-R2-0043: CONCEPT-203 -CROSS_REF→ CONCEPT-176 |
| EDGE-BATCH-R2-0047 | CONCEPT-194 -CROSS_REF→ CROP-059 | EDGE-BATCH-R2-0039: CONCEPT-194 -CROSS_REF→ CONCEPT-170 |
| EDGE-BATCH-7-0028  | LAW-141 -CROSS_REF→ CONCEPT-081  | EDGE-BATCH-7-0029: LAW-141 -CROSS_REF→ CONCEPT-171      |

**부수 발견 — 유령 셋 내부 진성 중복 2쌍** (동일 from/type/to 이중 적재, 처분과 무관하게 1건씩 정리 대상): ① EDGE-BATCH-4-0032 ≡ EDGE-BATCH-5-0087 (INS-24 -APPLIES_TO→ CROP-059) ② EDGE-BATCH-4-0031 ≡ EDGE-BATCH-5-0086 (INS-23 -APPLIES_TO→ CROP-058).

## ③ 처분 합계

**(A) 과제 정의 기계적 적용 시** (후계 존재=재배선, ④중복=비활성화만): **(가) 100 / (나) 3 / (다) 0**.

**(B) 의미 검증 후 권고 분류** — 후계가 전부 개정노트(비대체물)이므로 기계적 (가)는 의미 파괴: **(가) 0 / (나) 2** (진성 중복 쌍의 후순위 1건씩: 5-0087, 5-0086 — 비활성화만으로 무손실) **/ (다) 101** (전건 단일 진앙 귀속). 단 (다) 101은 엣지별 개별 검수가 아니라 **"R1 SUPERSEDES 11엣지(EDGE-BATCH-R1-0024~0034) 오용 → 노드 11건 복원" 단일 결정 1건으로 수렴** — 복원 시 103건 전원 자동 해소(유령 엣지 자체가 정답 상태). 복원 불채택 그룹이 있을 경우에만 해당 그룹 엣지를 (나) is_active=0 처리. GO/STOP·복원 방식(트리거 우회 마이그 vs v2 INSERT) = 인간 결재(RULE #5, L3).

데이터 근거: /tmp/kn-dump.json, /tmp/ke-dump.json, /home/soo/ClaudePro/ThePick/docs/plans/master-remediation-20260610/g-ws2-integrity/integrity-2026-06-10T23-47-26.json

---

## ③ 수리 실행 경로 제약 분석

## 과제 3 — 수리 실행 경로 제약 분석 (실코드 인용, 2026-06-11)

### ① knowledge_edges UPDATE 차단 트리거 — **존재하지 않음 (가드 공백 확정)**

migrations 전수 grep (`grep -rn "ON knowledge_edges" migrations/*.sql`) 결과, knowledge_edges 에 걸린 트리거는 **4개 전부 INSERT 계열**이며 BEFORE UPDATE / BEFORE DELETE 트리거는 0건:

| 트리거                                      | 종류                                             | 위치                                                           |
| ------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------- |
| `enforce_edges_created_at_not_null`         | BEFORE INSERT (created_at NULL 차단)             | `migrations/0003_temporal_guard_not_null.sql:66-71`            |
| `mav_supersedes_knowledge_nodes_deactivate` | AFTER INSERT                                     | `migrations/0013_active_view_and_review_decisions.sql:101-108` |
| `prevent_supersedes_reverse_cycle`          | BEFORE INSERT (A→B 존재 시 B→A SUPERSEDES ABORT) | `migrations/0014_phase05_critical_hardening.sql:181-192`       |
| `prevent_supersedes_self`                   | BEFORE INSERT (from=to 자기참조 ABORT)           | `migrations/0014_phase05_critical_hardening.sql:195-200`       |

- `prevent_*_update` 화이트리스트 체계는 **knowledge_nodes / formulas / constants 3 테이블 전용**: 0003:17-27 (전면 차단) → 0013:64-86 (is_current_active 플립만 허용) → 0014:34-95 (컬럼별 IS NOT 화이트리스트 최종형). DELETE 차단(0014:105-121)도 동일 3 테이블만. **knowledge_edges 는 이 체계에서 처음부터 제외** — 즉 `UPDATE knowledge_edges SET is_active=0/1` 은 물론, edge_type·to_node 등 본문 컬럼 UPDATE / 행 DELETE 까지 DB 레벨 무차단.
- 이 갭은 이미 마스터 플랜이 인지: `docs/plans/master-remediation-20260610/MASTER_PLAN.md:132` — "**[결재·L3]** 2b: knowledge_edges UPDATE/DELETE 가드 마이그 1건 — is_active 플립 화이트리스트 패턴... plan 별도 작성 → 진산 승인 → SQL (TR-0/0038 선례 절차)".
- **공통 배경 전제 교정**: 0013 트리거는 SUPERSEDES 엣지 INSERT 시 **knowledge_nodes 의 to_node 행** `is_current_active=0` 으로 갱신한다 (0013:104-107 `UPDATE knowledge_nodes SET is_current_active = 0 WHERE id = NEW.to_node`). **knowledge_edges.is_active 를 자동 변경하는 트리거는 어디에도 없음** — 엣지 비활성화는 전적으로 수동/애플리케이션 책임. 따라서 "활성엣지→비활성노드 103건"(STALE_EDGE_REF)은 이 비대칭(노드는 자동 꺼지나 그 노드를 가리키는 엣지는 켜진 채 잔존)의 구조적 산물이다.
- 수리 함의: **is_active 플립에 의한 stale 엣지 정리(UPDATE)는 현재 트리거가 막지 않아 기술적으로 즉시 가능**하나, CLAUDE.md Hard Limit("knowledge_nodes/edges UPDATE 금지") 명문과 충돌 — 거버넌스상 WS-2b 가드 마이그(L3 결재)와 묶어 "허용 플립 범위"를 먼저 못박는 것이 정합 [권고, 판단은 진산].

### ② 신규 엣지 INSERT 제약

**DB 레벨 (스키마 `migrations/0001_initial_schema.sql:37-46`)**:

- FK: `from_node TEXT NOT NULL REFERENCES knowledge_nodes(id)` / `to_node` 동일 (0001:39-40). `PRAGMA foreign_keys = ON` (0001:9 외 각 마이그 헤더). D1 은 FK 강제 기본 활성 → 부재 노드 참조 INSERT 는 거부됨 (현 "끊긴 엣지 0" 실측과 정합).
- `edge_type TEXT NOT NULL` 이나 **CHECK 제약 없음** (0001:42) — DB 는 임의 edge_type 문자열을 수용. allowlist 는 애플리케이션 계층 전용.
- `created_at` NULL 차단 트리거 (0003:66-71). SUPERSEDES 한정 자기참조·역순환 가드 (0014:181-200, ① 표 참조). SUPERSEDES INSERT 시 0013:101-108 이 **to_node 노드를 자동 비활성화하는 부작용** 주의(수리용으로 SUPERSEDES 타입 오용 금지).
- **status 개념 없음**: knowledge_edges 컬럼 = id/from_node/to_node/edge_type/condition/priority/is_active(DEFAULT 1)/created_at 전부 (0001:37-46). draft 강제 트리거 `prevent_non_draft_insert` 는 **knowledge_nodes 전용** (`migrations/0018_enforce_draft_only_insert.sql:20-25`). ⇒ **엣지는 INSERT 즉시 활성(is_active=1 default)** — Hard Limit "AI 생성 데이터 draft 적재"를 DB 가 엣지에 강제할 수단이 없고, 인간 검수는 절차로만 보장. 보완 장치: `review_decisions.target_type` CHECK 에 `'edge'` 포함 (0013:131) — 엣지 승인 결정의 INSERT-only 기록은 가능.
- **batch_id 컬럼도 없음** — 수리 엣지의 출처 표식은 id 네이밍 또는 condition 텍스트로만 가능.

**애플리케이션 레벨 (Ontology Lock)** — `packages/parser/src/schema-validator.ts` `validateKnowledgeContract`(:936):

- edge_type allowlist: registry `edge_types` 18종 외 거부 (:1164-1172, `packages/parser/src/ontology-registry.json` edge_types = APPLIES_TO/REQUIRES_INVESTIGATION/PREREQUISITE/USES_FORMULA/DEPENDS_ON/GOVERNED_BY/DEFINED_AS/EXCEPTION/TIME_CONSTRAINT/SUPERSEDES/SHARED_WITH/DIFFERS_FROM/CROSS_REF/HAS_ROW/HAS_COLUMN/BELONGS_TO_ROW/BELONGS_TO_COLUMN/CONTAINS_TABLE).
- source/target ID 가 node_id_patterns 정규식과 불일치 시 거부 (:1177-1186, :1200-1209). registry 에 **엣지 ID 자체 패턴 키는 없음** (node_id_patterns/formula/constant/topic_cluster 만).
- `DANGLING_EDGE_REFERENCE`: source/target 이 **동일 contract 내 선언 노드에 없으면 거부** (:1188-1194, :1211-1219) — **기존 production 노드끼리 잇는 "엣지만" contract 는 통과 불가**, 노드 재선언 동봉 필요(재선언분은 draft-loader 가 `INSERT OR IGNORE`+기존ID skip 으로 무해 처리, `apps/batch/src/loader/draft-loader.ts:250-296`).
- 엣지 ID 컨벤션 2종 병존: 실 production 1274건 = `EDGE-{BATCH-N}-{idx:04d}` (`scripts/json-to-sql-batch.py:78-91`) vs draft-loader 결정적 ID `E-{source}-{edge_type}-{target}` (draft-loader.ts:294-296, INSERT SQL :361-364 — priority=0·is_active=1 하드코딩).
- graph-walk 가시성: 순회 whitelist 는 registry 18종이 아닌 **12종** (`apps/api/src/search/graph-walk/index.ts:50-63`, SUPERSEDES·테이블 4종 제외) — 수리 엣지가 walk 에 기여하려면 이 12종 중 하나여야 함.

### ③ 수리 SQL 실행 채널

- 데이터 INSERT(ad-hoc): `npx wrangler d1 execute thepick-db-production --remote ...` (cd apps/api) — 무결성 러너 헤더가 정본 사용례 (`scripts/run-graph-integrity-production.ts:13-19`). production binding = `database_name = "thepick-db-production"` / `database_id = "a9b8d521-..."` (`apps/api/wrangler.toml:191-194`).
- 마이그레이션 경로(스키마/가드 추가 시): `pnpm db:migrate:production` = `wrangler d1 migrations apply DB --remote --env production` (`apps/api/package.json:18`).
- **인증 게이트**: `--remote` 실행 = 진산 Cloudflare 인증 (CLAUDE.md "현재 상태" — Session 086 라이브 count 확정도 동일 채널·진산 6-A 위임). MASTER_PLAN 결재란 #11 류와 같은 "진산 인증 실행/위임" 항목으로 처리 (`MASTER_PLAN.md:247`). [참고] memory `project_deployment_reality` 에 "wrangler 세션 유효" 기록 — 세션 잔존 여부는 실행 시점 재확인 필요 [추정].
- L3 절차 선례: plan 결재 → (ADR) → 마이그/SQL → production 적용 = TR-0/0038 체인 (`MASTER_PLAN.md:132` 명문). 데이터-only INSERT 라도 BATCH 순차 실행 Hard Limit·draft 검수 원칙상 인간 승인 선행.

### ④ 수리 후 검증 경로

`scripts/run-graph-integrity-production.ts` (read-only, production 쓰기 0 — :11):

1. 신규 덤프 2개 생성(진산 인증): nodes = `SELECT id,type,name,is_current_active FROM knowledge_nodes`, edges = `SELECT id,from_node,to_node,edge_type,is_active FROM knowledge_edges` (각 `--json`, :14-18).
2. `pnpm tsx scripts/run-graph-integrity-production.ts --nodes <kn.json> --edges <ke.json>` (:19). 필수 컬럼 누락·0행·파일 부재 시 fabricate 차단 명시 실패 (:42-48, :56-80).
3. 코어 = `auditProductionGraph` (`packages/quality/src/production-audit.ts`), whitelist 단일 진실원 = graph-walk 12종 (:36, :103-107).
4. 게이트 판정: `gatePass = integrity.valid && staleEdgeRefs.length === 0` (`production-audit.ts:208`) — **walkUnreachable(도달불가 133)은 게이트 불산입**(정보 지표, production-audit.ts:188-191 / 러너 :135). exit 0=PASS, 2=FAIL (:165). 리포트 md+json 영속, 기본 출력처 `docs/plans/master-remediation-20260610/g-ws2-integrity/` (:40, :158-161). 덤프 mtime 기록으로 stale 덤프 인용 차단 (:122).

### ⑤ BATCH 파이프라인 경유 vs 직접 SQL trade-off

| 축                    | BATCH 경유 (contract→validate→loader/SQL생성)                                                                                      | 직접 SQL (wrangler d1 execute --remote)                                                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ontology Lock         | **기계 강제**: edge_type 18종·ID 패턴·dangling 검증 (schema-validator.ts:1164-1219)                                                | **없음** — edge_type CHECK 부재(0001:42)로 오타 타입이 조용히 적재 → graph-walk whitelist(12종)에서만 탈락 = silent 무효 엣지                               |
| FK/노드 실재          | contract 내 선언 노드 대조 + DB FK                                                                                                 | DB FK 만 (부재 ID 는 차단되나 "의미상 틀린 연결"은 무방어)                                                                                                  |
| 멱등성                | `INSERT OR IGNORE` + 결정적 ID (draft-loader.ts:294-296, 361-374 / json-to-sql-batch.py:83)                                        | 작성자가 직접 `INSERT OR IGNORE` 포함해야 함                                                                                                                |
| 엣지-only 수리 적합성 | **마찰 큼**: DANGLING_EDGE_REFERENCE 로 노드 재선언 동봉 필요 + draft-loader 는 priority=0 고정(:363) + BATCH 순차 Hard Limit 절차 | **적합**: 엣지 단독·소량(예: CONCEPT-023 연결 보강)·priority/condition 자유                                                                                 |
| 감사 추적             | batch_runs·batch_run_id 체계(노드측), 산출물 문서 체인                                                                             | 없음 — 엣지에 batch_id 컬럼 자체가 없어 id prefix(예: `EDGE-REPAIR-...`)+condition+`review_decisions(target_type='edge')` INSERT(0013:131)로 수동 보전 의무 |
| 거버넌스(draft 검수)  | contract 산출물 단계에서 인간 검수 자연 개입                                                                                       | 엣지는 status 부재로 INSERT 즉시 활성 — SQL 파일 자체를 검수 대상으로 결재(TR-0/0038 선례) 필요                                                             |
| 트리거 상호작용       | 동일 (DB 레벨이라 채널 무관: SUPERSEDES 역순환·자기참조 가드, 0013 to_node 자동 비활성화)                                          | 동일                                                                                                                                                        |

**종합 [권고, 결정은 진산]**: (a) 소량 연결 보강·stale 엣지 정리 같은 "그래프 수리"는 **검수된 SQL 파일 + wrangler --remote 직접 실행**이 현실 경로 (역대 BATCH-1~7 production 적재도 실질적으로 json-to-sql-batch.py 가 생성한 SQL→wrangler 채널이었음). 단 ①의 가드 공백 때문에 동일 인증 세션에서 UPDATE/DELETE 오발이 물리적으로 가능하므로, **WS-2b 엣지 가드 마이그(L3, MASTER_PLAN.md:132)를 수리 SQL 과 같은 결재 묶음으로 선행/동시 적용**하고, 수리 엣지는 ontology 12종 whitelist 내 타입 + `EDGE-REPAIR-*` 식 식별 id + review_decisions 기록을 의무화. (b) 수십 건 이상 대량 보강은 BATCH 파이프라인(검증기 통과 의무) 경유. (c) 어느 경로든 종결 = ④ 러너 재실행 gatePass + 리포트 영속.

---

## ④ 적대 검증 (반증·정정·과신 판정)

## 적대 검증 결과 — ① 정합 확인 / ② 반증·정정 5건 / ③ 과신 판정 5건

### ① 수치 정합 — **정합 확인** (전수 재계산, /tmp 덤프 직접)

반증 없음. 검증 증거:

1. **진앙 11**: 비활성 노드 재계산 = 정확히 11 (CONCEPT-081, CROP-042/045/046/058/059, F-71, INS-01/09/12/33) — 분석 2 표와 집합 일치.
2. **고아 24**: 활성노드(783) 중 활성엣지 0 = 33건 → TERM 9건(TERM-019/020/022/023/027/028/032/034/037) 제외 = 24건. ID·명칭 24/24가 정본 violations 및 분석 1 표와 일치. TERM 면제는 `packages/quality/src/graph-integrity.ts`의 `if (node.type === 'TERM') continue;` 실코드 확인.
3. **유령 103**: 활성 non-SUPERSEDES 엣지→비활성 노드 재계산 103건, (edgeId, side, nodeId) 3-튜플 집합이 정본 staleEdgeRefs와 **완전 일치**(차집합 양방향 0). side from 70 / to 33, 양끝 모두 비활성 엣지 0, 비활성 엣지 0(1274 전부 active) — 분석 2 서술 그대로.
4. **그룹 표·엣지 ID 전수**: 11그룹 건수(26/23/17/9/8/6/6/3/2/2/1)·side 분포·edge_type 분포·그룹별 엣지 ID 목록이 분석 2와 11/11 그룹 모두 정확히 일치. ④의 3건(R2-0052↔R2-0043, R2-0047↔R2-0039, 7-0028↔7-0029)도 재계산 일치 — "기존 엣지와의 중복" 범주에서는 이 3건이 전부임을 확인. 진성 중복 2쌍(4-0031≡5-0086, 4-0032≡5-0087) 확인 — 전 그래프에서 정확 중복 triple은 이 2쌍뿐.
5. **SUPERSEDES 구조**: 정확 11건(EDGE-BATCH-R1-0024~0034, 전부 active), 진앙당 후계 정확 1개(다중 supersede 0), 후계 8노드 전부 활성, N:1(CONCEPT-167←3그룹, CONCEPT-170←2그룹) 확인.
6. 분석 1 후보 노드 deg 클레임 **44/44 일치**, 인용 명칭 전수 일치. graph-walk whitelist 12종(`apps/api/src/search/graph-walk/index.ts:50-63`), gatePass 식(`production-audit.ts` `integrity.valid && staleEdgeRefs.length === 0`) 실코드 일치.

### ② 처분 분류 위험 — 반증·정정 5건

**R-1 [반증] (A)안 기계적 재배선의 중복 산정 누락 — "(가) 100 / (나) 3"은 과소.** 103건을 후계로 치환 시뮬레이션한 결과, ④의 3건(기존 엣지와 중복) 외에 **재배선된 엣지끼리의 충돌 4그룹**이 추가 발생:

- (INS-21, APPLIES_TO, CONCEPT-167) ×3 — 4-0015(참깨)/4-0018(녹두)/4-0019(생강)이 동일 triple로 수렴 → 2건 잉여
- (CONCEPT-167, DEFINED_AS, TERM-036) ×2 — 4-0157/4-0158 수렴 → 1건 잉여
- (INS-23, APPLIES_TO, CONCEPT-170) ×2, (INS-24, APPLIES_TO, CONCEPT-170) ×2 — 진성 중복 2쌍이 재배선 후에도 중복 유지
  즉 기계적 (가)는 100이 아니라 최대 95 + (나) 8 수준. DB에 UNIQUE(from,type,to) 제약이 없어 중복 INSERT는 조용히 적재됨(차단 장치 0).

**R-2 [반증] 재배선이 새 순환을 만드는 케이스 실재 — 5건.** 전 그래프에서 상호 same-type 쌍은 정확히 5쌍이며 **전부 INS-33↔INS-34/35/36/37/38 상호 DEPENDS_ON**(6-0001~0005 ↔ 6-0084~0088). 기계적 재배선 시 CONCEPT-176↔INS-34..38 **상호 DEPENDS_ON 2-순환 5개가 개정노트 노드에 신규 생성**된다. 순환 가드 트리거는 SUPERSEDES 전용(`prevent_supersedes_reverse_cycle`)이라 DB가 차단하지 않음.

**R-3 [정정] "트리거 우회 마이그레이션" 표현 부정확 — 노드 복원은 DB 레벨 무차단.** `migrations/0014` `prevent_knowledge_nodes_update`의 WHEN절은 본문 14컬럼 변경 시에만 ABORT하고 **is_current_active는 화이트리스트에서 의도적으로 제외** — `UPDATE knowledge_nodes SET is_current_active=1` 단독 플립은 트리거를 통과한다(실코드 확인). 제약은 거버넌스(CLAUDE.md:108 Hard Limit + 0013 주석 "Only SUPERSEDES trigger may flip") 뿐. 단 복원 시 **"활성 SUPERSEDES 엣지(R1-0024~0034) → 활성 to_node" 상태가 MAV 불변식 위반으로 잔존** — R1 엣지 11건의 동시 처분(비활성화/삭제, 이 역시 트리거 무차단 = 분석 3 ① 확인)이 없으면 향후 MAV 재구축·재적재 시 재비활성화 위험. 복원 결정은 "노드 플립 + R1 엣지 처분" 원자 묶음이어야 함.

**R-4 [정정] 분석 3의 CLAUDE.md 인용 오류.** CLAUDE.md:108 명문은 "knowledge_nodes, formulas 테이블 UPDATE 금지" — **knowledge_edges는 CLAUDE.md Hard Limit에 미포함**(grep 확인). "knowledge_nodes/edges UPDATE 금지 명문과 충돌"의 'edges' 부분은 과제 배경 텍스트이지 프로젝트 헌법 명문이 아님. plan에서 인용 출처를 분리해야 함.

**R-5 [정정] 표적 불일치 논거의 명칭 인용이 덤프 초과.** 분석 2가 따옴표로 인용한 INS-09 "수확전 종합위험 과실손해보장방식**(복분자·무화과 담보)**", INS-12 "종합위험 비가림시설 손해보장방식**(포도·참다래·대추)**"의 괄호 한정어는 **덤프 name 필드에 없음**(실명: 한정어 없는 명칭). 도메인 지식 보강이면 [추정] 라벨 필수 — 표적 불일치 2건 판정의 핵심 증거이므로.

(SUPERSEDES 2단 이상 체인·다중 후계·후계 비활성: **반증 없음** — 체인 0, 그룹당 1:1, 후계 전부 활성 재계산 확인.)

### ③ 고아 분류 과신 판정 — 5건

**O-1 [과신] CONCEPT-030의 C(중복 의심) 판정은 기준 비일관.** 030 "재조달가액"(무한정어) vs 111 "재조달가액 (시설·해가림시설)"(한정어) 패턴은, 행 7에서 084 "미보상감수량 (밭작물)" vs 007/026 "미보상감수량"을 "의도적 분리 = A"로 판정한 것과 동일 구조다. 게다가 코퍼스에는 **완전 동명 활성 중복쌍이 8쌍 실재**(CONCEPT-007≡026, CONCEPT-014≡022, F-10≡F-20, INV-008≡027, LAW-017≡135, LAW-018≡133, TERM-019≡026, TERM-020≡025)하며 이들의 기존 처리 관례는 SUPERSEDES가 아니라 **CROSS_REF 상호 연결**(LAW-135-CROSS_REF→LAW-017, LAW-133-CROSS_REF→LAW-018 실재). 덤프에 description이 없어 의미 중복을 단정할 수 없으므로 030의 "통합(SUPERSEDES)" 선택지는 증거 부족 — 행 7 기준 일관 적용 시 A.

**O-2 [과신] LAW-095 행은 후보 2개 전부 동시 고아**(LAW-094, LAW-099) — 행 단위 시행 시 라이브 그래프 연결 0인 고아 섬만 형성. LAW-094 ①, LAW-096 ①, LAW-097 ①, LAW-098 ②, LAW-043 ②도 고아 후보 포함(각자 live 후보는 1+ 보유). 상법 641~648 블록은 "일괄 시행 + LAW-093→092·096→103·098→105·099→122 등 live 앵커 경유"가 전제 조건임을 plan에 명시해야 함.

**O-3 [과신] 전 후보가 [추정]인 행 3건**: LAW-031(①②), LAW-042(①②), LAW-094(①=고아, ②=[추정]). A 판정("연결 가능")의 증거가 가장 약한 행들 — 시행령 2건(LAW-064/065)의 1:1 제목 매칭과 같은 등급으로 묶이면 안 됨.

**O-4 [주의] 후보 deg 수치가 유령 엣지 포함 산정**: F-21 deg3 중 1건은 비활성 INS-12발 USES_FORMULA, CONCEPT-111 deg4 중 1건은 비활성 CROP-059발 DEFINED_AS. 과제 2의 복원/비활성화 결정에 따라 이 후보들의 실효 연결도가 변동 — 고아 수리와 유령 처분은 순서 의존(유령 먼저).

**O-5 [사실 정정] "시행령→모법 DEPENDS_ON 패턴 7건 실재" → 실측 23건**(EDGE-BATCH-L1-0027~0049; 그중 시행령→법 17건, 시행령→시행령 6건). 패턴 주장 자체는 오히려 강화되나 수치 오기 — plan 입력 전 정정 필요.

### 종합

①은 전 수치 정합. ②는 분석 2의 권고 경로(B안 복원)는 유지 가능하나 R-1/R-2가 대안 경로(A안 재배선)의 비용 산정을, R-3이 복원 실행 설계를 수정시킴. ③은 24건 중 LAW-064/065·CONCEPT-066·CONCEPT-084 류(구조적 1:1 매칭)와 LAW-031/042/094/095 류(전 후보 추정/고아)의 증거 등급 분리가 필요.

검증 파일: `/tmp/kn-dump.json` · `/tmp/ke-dump.json` · `/home/soo/ClaudePro/ThePick/docs/plans/master-remediation-20260610/g-ws2-integrity/integrity-2026-06-10T23-47-26.json` · `/home/soo/ClaudePro/ThePick/migrations/0013_active_view_and_review_decisions.sql` · `/home/soo/ClaudePro/ThePick/migrations/0014_phase05_critical_hardening.sql` · `/home/soo/ClaudePro/ThePick/CLAUDE.md:108` · `/home/soo/ClaudePro/ThePick/apps/api/src/search/graph-walk/index.ts` · `/home/soo/ClaudePro/ThePick/packages/quality/src/graph-integrity.ts` · `/home/soo/ClaudePro/ThePick/packages/quality/src/production-audit.ts`
