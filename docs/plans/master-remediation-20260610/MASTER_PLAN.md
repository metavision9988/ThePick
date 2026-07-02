# 쪽집게(ThePick) 인프라 견고화 마스터 플랜 v1.0

> **상태: DRAFT — 진산 결재 대기 (§6 결재란 전부 미체크. 결재 전 코드 착수 금지 항목은 각 WS에 명시)**
> 작성: 2026-06-10 / 작성 주체: Claude (Fable 5, design-audit 워크플로우 73 에이전트 — 9 엔진 실측 지도 + 7 페르소나 독립 감사 55건 → 적대 반증 생존 45건)
> 근거(정본): `docs/audit/DESIGN_AUDIT_REPORT_20260610-140529.md` — 본 플랜의 모든 발견 인용은 그 보고서에서 file:line 적대 재대조됨.
> 실행 가이드: `OPUS48_EXECUTION_PLAYBOOK.md` (같은 디렉토리) — Opus 4.8 세션별 실행 프롬프트.
> **RULE #5 준수**: 본 문서는 사실(🟢🟡🔴) + 선택지 + 권고만 제공한다. GO/STOP·옵션 채택·심각도 최종 확정 = 진산.

---

## 0. 목표 재정리 (모든 작업의 잣대)

권위 출처 교차 도출 (CLAUDE.md 요약 아닌 원전: feasibility/ceiling/헌법 v3.6/재정립서 v2.0/ARCHITECTURE/06-05 실측):

- **궁극 비전**: "자격증 교재+기출 입력 → Graph RAG 지식 구조화 → 신뢰 가능한 도메인 지식 DB → 난이도별 훈련 문제·암기법 무한 자동 생성" 엔진의 MVP. 손해평가사는 그 1호 도메인.
- **북극성**: 생성물(검색결과·해설·생성문제)의 **정답률·신뢰성 실측**. 조작화 3단:
  ① Formula Engine 교재 예시값 골든 100% (실측 100% PASS)
  ② G-S5 golden 채점 — queryBody 정화 baseline hit-rate@5 = **83.3% (N=6)**, graph 채택 잣대 = graphOnlyRecovery>0 AND regression=0 (현 실측: 채택 근거 0)
  ③ 수험생 합격률 60% (런칭 후에만 실측 가능)
- **Year 1 구체**: 손해평가사 1차(객관식 3과목) + 2차(100% 서술·계산형). 교재 835쪽 + 기출 ~581문항. MVP 베타 100명.
- **본 플랜의 주안점 (진산 지시, 2026-06-10)**: 자격시험 특수성 = **정보 정확성(출제 문제·정답·근거)이 최우선**. 견고한 엔진·파이프라인 인프라가 목적 — UI·응용 서비스는 그 위에 짓는다.

**우선순위 공리** (작업 충돌 시 이 순서로 판정):

1. 정답 안전 (오답이 정답 처리되는 경로 = Hard Stop)
2. 지식 DB 무결성 (production 그래프·산식·상수의 보호 기계)
3. 측정 정직성 (잣대가 자기기만하지 않을 것)
4. 엔진 효과의 학습자 전달 (산출-소비 배선)
5. 북극성 확장 (생성층) — 단 게이트 선행
6. UI·응용 — 본 플랜 범위 밖

---

## 1. 진단 요약

### 1.1 엔진 9종 북극성 정렬 (실측)

| 엔진                  | 판정       | 한 줄 진단                                                                                  |
| --------------------- | ---------- | ------------------------------------------------------------------------------------------- |
| 평가·측정 (G-S5 잣대) | **serves** | 유일하게 북극성 직접 떠받침. 한계(N=6·커버리지 종속·진단 맹점)는 자기 인지됨                |
| Formula Engine        | partial    | 골든 100% 그러나 소비자 = batch QG 단 1곳. 학습자 런타임 배선 0                             |
| Graph RAG+Walk        | partial    | vector 축 작동(83.3%) / graph 축 효용 0 (graphOnlyRecovery 0 both·depth2 −20%)              |
| Content Build Engine  | partial    | 코어 real(테스트 PASS) — 그러나 production 데이터가 이 엔진을 한 번도 통과 안 함            |
| 데이터 계층·D1        | partial    | Temporal 트리거 125·draft-only 기계강제 = 강점 / 엣지 가드 비대칭·생성물 게이트 공백 = 침식 |
| FSRS+학습 모드        | partial    | 채점·영속 real / due 미구동·모드 3/5 무필터 — "계산되는 전시물"                             |
| 혼동 감지+품질        | partial    | graph-integrity 검증기 real·production 미배선 / 혼동 8종 감지 코드 0                        |
| LLM 격리              | partial    | Layer4(draft-only) 기계강제 real / Layer2·3·injection·PII 코드 0 (현 공격면 0 = 시점 정합)  |
| **콘텐츠 생성 엔진**  | **stub**   | `export {};` 1줄. 북극성 본체가 0 LOC — **현 서비스 실체 = 기출 풀이 서비스**               |

### 1.2 진앙 6 (confirmed 45건 클러스터)

| 진앙 | 심각도   | 요지                                                                                                                                                                                                                |
| ---- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RC-1 | CRITICAL | Production 그래프 보호·검증 기계 공백 — 검증 기계(5,347 LOC·327 테스트)는 로컬 전용, production 794노드/1274엣지는 한 번도 기계 검증 안 됨. 누적 무결성 러너 0·CBIV(ADR-014 Accepted) 미이행·knowledge_edges 가드 0 |
| RC-2 | CRITICAL | Graph 신호의 랭킹층 전량 폐기 — score=0 주입 + truthWeight-first 비교자 + hop-depth 폐기 + priority 사장 + forward-only = graphOnlyRecovery 0의 구조적 원인 (S5-8 plan과 동일 기전 식별, 결재 대기)                 |
| RC-3 | CRITICAL | 산출-소비 단절 5개 지점 — 혼동 감지 체인 0%·FSRS due 미구동·모드 3/5 무필터·weak_score 의미 축소·Formula Engine 학습자 미배선. 엔진 효과가 사용자에게 미전달                                                        |
| RC-4 | CRITICAL | 생성층 공백 + 생성물 게이트 부재 + **무장 잠복 결함(MC 채점 3중 모순 — distractor 적재 순간 발화)**                                                                                                                 |
| RC-5 | MAJOR    | 이원 진실원·드리프트 — 산식 계수 5중 보관 동기 0, schema.ts 드리프트, Year 2 슬롯 포인터 부패, stale 권위 문서 (2026-05-15 오염 사고 클래스 서식지)                                                                 |
| RC-6 | MAJOR    | G-S5 잣대 구조 한계 — 커버리지가 서빙 계약(query≤500)에 종속·N=6·진단 맹점(expandedNodes 미노출)                                                                                                                    |

---

## 2. 문제점 / 보완·개선점 / 배제할 것

### 2.1 문제점 (정확성 직격 순)

1. **[정답 안전·발화 최근접] 객관식 채점 정답 인덱스 3중 모순** — `apps/api/src/study/routes.ts:385,410`(정답텍스트 index0) vs `:627`+`packages/learning-modes/src/multiple-choice.ts:58-77`(①~⑤ 마커 파싱) vs `shuffle.ts:91`(0=① 계약): 어떤 데이터 컨벤션으로도 3경로 동시 성립 불가. distractor BATCH 적재 순간 오답이 정답 처리. 결합 테스트 0건.
2. **[지식 DB 무방비] production 그래프 누적 무결성 기계 검증 경로 0** — `pipeline.ts:1077-1092`는 contract 단독 스코프, schema-validator는 cross-batch 엣지 구조적 거부, SUPERSEDES 다단 순환 DFS는 production에서 영영 안 돎(0013 자동비활성과 결합 시 노드군 무음 소실 기전 실재). knowledge_edges만 UPDATE/DELETE 가드 0(타 7테이블 보유 비대칭).
3. **[산식 정확성 서식지] 계수 5중 보관·동기 검증 0** — 코드 인라인/D1 formulas/D1 constants/자유텍스트/골든. 코드 68 vs D1 157 이원. supersededBy 사문 = 2027 개정 시 65↔60 클래스 오류의 구조적 서식지.
4. **[근거 추적 기아] 출처 추적 체인 데이터 기아** — buildSourceCitations 코드는 real이나 기출 525/545 related_nodes NULL → 근거보기 빈 배열 서빙. 백필 = 0038 production 적용(진산 게이트 #3) 대기.
5. **[검색 순손실 형상 잔존] production 기본값 DEFAULT_MAX_DEPTH=2** — 실측 hit-rate −20% 형상이 public 무인증 라우트 기본값 그대로 (옵션 C 격리로 학습자 노출은 0).
6. **[측정 맹점] G-S5 잣대 3중 결손** — query≤500 서빙 계약 상속(Q-004 영구 제외)·expandedNodes 미노출(랭크미달 vs 미도달 미분)·빌더 문항별 하드코딩(N 확대 병목).
7. **[배선 단절] RC-3 5개 지점** — §1.2 참조. 특히 2차 시험(합격 병목) 훈련 루프: calc=최종값 비교 skeleton·essay=self-grade·2차 answer 전량 null.
8. **[생성층 역순 리스크] 생성물 표적 테이블 환각 차단 DB 게이트 0중** — mnemonic_cards CHECK·트리거·reverse_verified 검증 전무, exam_questions status에 'draft' 부재 + 0038 status 동결로 사후 격리 불가. AI distractor→exam_questions는 ADR-046 D-6 결재 완료 = 확정 경로인데 게이트가 후행.
9. **[무음 데이터 삭제] LLM tables[] 출력 무음 폐기** — `batch-processor.ts:395,404-409` (프롬프트 '의무' 지시와 자기모순). Table-as-Micro-KG 자동 적재 경로 입구 단절 + 표 벡터 433개(인덱스 34%)가 검색 top-20 슬롯 잠식 후 무음 탈락.
10. **[드리프트] RC-5 일괄** — Year 2 슬롯 포인터 3번호×6곳 부패(자기증식 실증), schema.ts 핵심 필터 컬럼(is_current_active) 타입 부재, CLAUDE.md 스택 서술 stale, SEARCH_PIPELINE.md 3축 충돌, CI 미실행 테스트 151건(learning-modes 116+srs 35), feasibility/ceiling이 06-05 실측 미반영(G-1 권위 산출물이 최신 데이터보다 stale).

### 2.2 보완·개선점 (신규 기여분 — 기존 plan 미커버)

- **lexical fusion 비교군** — SEARCH_PIPELINE.md:42-43 자체 스펙(ADR-019 Accepted)이 미구현인데 S5-8 재설계 plan 비교군에 0건. 실측 실패(Q-015 0.02차 변별 불능)와 직결된 가장 싼 지렛대 → S5-8 Phase 1 PITR에 D안으로 추가 상신.
- **G-S5 잣대 강화 3종** — golden 빌더 일반화(정답/해설 분리기) + expandedNodes 디버그 노출 + query 500자 천장 처리. Phase 0b(N 확대) 결재에 게이트로 병합하지 않으면 확대 후에도 한계 상속.
- **항해성(navigability) 게이트** — orphan/broken/cycle만으로는 CONCEPT-023 류 "연결됐지만 도달 불가" 클래스를 못 잡음 → 무결성 러너에 도달성 지표 추가.
- **게이트 선행 원칙** — "생성 코드 1줄 전 DB 게이트 마이그 선행"을 Phase 2 진입 규칙으로 명문화.

### 2.3 배제·동결·이연 (명시적 — 미련 금지)

| 항목                                     | 처분                                                                                                     | 근거                                                                                                              |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| graph-walk depth2 기본값                 | **차단 후보** (Phase 0a: 2→1, 단독 결재 가능)                                                            | 실측 순손실 −20%, S5-8 plan 자체가 "개선 아닌 확정 손해 차단"으로 분리                                            |
| graph-walk Phase 1~2 알고리즘 투자       | **보류** — lexical fusion(D안) 비교군 결재 전 착수 금지                                                  | graphOnlyRecovery 0 both + 진짜 headroom 2노드 중 1(CONCEPT-023)은 엣지 부재 데이터 천장 = 알고리즘으로 해결 불가 |
| CBIV 풀스펙(packages/cbiv) 즉시 구현     | **이연** — A안 최소 러너 우선, B(풀스펙) vs C(ADR-014 축소 개정) 는 2027 개정 R-BATCH 전 결재            | 수일 규모 투자 대비 러너 수십 줄로 동일 보호                                                                      |
| 오프라인 동기화 실구현                   | **이연** — 문서 캐비엇 정정만 (CLAUDE.md 스택·ARCHITECTURE.md 현재형 서술 → "PWA 캐싱만 구현" 정직 표기) | 3중 부재(sw.js stub·enqueue 0·IndexedDB 쓰기 0)는 사실이나 기능 결정은 별건                                       |
| 혼동 유형 감지 엔진 신설                 | **신규 Epic — G-1 R1~R5 전수 후** (자동 발동 조건: AI 출력 정확도 핵심)                                  | 감지 코드 0 = 신규 개발이지 수리가 아님. feasibility 없이 plan 금지                                               |
| 생성 엔진 본체(study-material-generator) | **착수 금지 — 게이트 선행(WS-6) + G-1 전수 후 별도 Epic**                                                | 북극성 본체이나 환각 차단 게이트가 0중인 상태의 착수 = 역순 리스크                                                |
| SLM/LoRA                                 | 동결 유지 (2027-04)                                                                                      | 기존 결재                                                                                                         |
| Year 2 멀티시험 실전환                   | 이월 유지 (Year 2 Phase 4)                                                                               | ADR-007. 단 슬롯 포인터 부패는 지금 수리(WS-3)                                                                    |
| 신규 UI·응용 기능                        | **본 플랜 기간 동결**                                                                                    | 진산 주안점: 튼튼한 기반 먼저                                                                                     |
| 기각된 발견 8건 추적                     | **금지** (§7)                                                                                            | 적대 반증으로 기각 — 재추적은 토큰 낭비 + 거짓 전제 위험                                                          |

---

## 3. 워크스트림 설계 (WS-0 ~ WS-7)

> 표기: [L1/L2/L3] = DEFCON. **[결재]** = 해당 항목 코드 착수 전 진산 결재 필수. (file:line) = 감사 확증 증거.
> 모든 WS 공통 완료 조건: 4-Pass 독립 에이전트 리뷰 CRITICAL 0 + api 전체 vitest 회귀 0 + Binary Gate 전부 PASS.

### WS-0 즉시 지혈 — 저위험·고가치 (결재 부담 최소, 선행 의존 0)

| #   | 작업                                                                                                                                                                  | 등급 | 증거                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------- |
| 0a  | CI 회귀 게이트 등록: learning-modes(116)+srs(35) 테스트를 `scripts/verify-engine-contracts.ts:168-179` VITEST_PACKAGES + `.github/workflows/ci.yml:53-64` 필터에 등록 | L2   | CI 미실행 151건                                       |
| 0b  | srs→learning-modes 역의존 해소: FsrsRating(type-only 2건)을 @thepick/shared 또는 srs 소유로 이동 (`packages/srs/package.json:21`, plan §7.3:375 명시 금지 위반)       | L2   | 의존 방향 역전                                        |
| 0c  | stub 기계 경고: study-material-generator `--passWithNoTests` 제거 또는 stub-허용 명시 라벨 + verify-engine-contracts에 stub 패키지 명단 관리                          | L1   | 빈 패키지 3게이트 무음 PASS                           |
| 0d  | **[결재-경량]** 학습 모드 정직성: 실동작 2종(weak/mixed)만 노출 또는 미동작 모드 비활성 표기 — ADR-039 위반 상태의 베타 노출 차단                                     | L2   | `/mode` available(필터 풀) vs `/next`(무필터 풀) 모순 |
| 0e  | eval 파서 계약 테스트: parseRelatedNodes ↔ enrichRelatedNodes를 route-level malformed 픽스처로 묶는 테스트 (L3 무접촉)                                                | L2   | 이중 정본, 방어=주석뿐                                |
| 0f  | distractor 서빙층 최후 가드: 정답-오답 동치/중복 텍스트 검사 (`routes.ts:393-417`)                                                                                    | L2   | 가드 0                                                |

**Binary Gate G-WS0**: ① ci.yml 실행 로그에 learning-modes+srs 151건 PASS 표시 ② `grep -r "learning-modes" packages/srs/package.json` = 0건(또는 type re-export 경유 명시) ③ stub 패키지가 test 게이트에서 무음 PASS 불가 증명(로그) ④ 모드 UI 실동작/비동작 일치 스크린샷 또는 E2E ⑤ malformed 픽스처 테스트 PASS ⑥ 동치 distractor 픽스처 거부 테스트 PASS.

### WS-1 정답 안전 — MC 채점 3중 모순 해소 (critical 1순위)

- **[결재]** 1a: answer 데이터형 계약 확정 — **라벨형('③') vs 텍스트형(정답 본문)** PITR 1장 상신 → 진산 채택. (현 production 기출 545의 answer 실태 조사 1-쿼리 포함 — "스키마 존재 ≠ 데이터 형태" 검증.)
- 1b: 채택된 계약으로 3경로 통일 — `buildShuffledChoices`(routes.ts:385-417) / 채점 마커 파서(routes.ts:627, multiple-choice.ts:58-77) / shuffle 계약(shuffle.ts:91) [L2~L3: learning-modes는 채점 코어]
- 1c: **결합 경로 테스트 신설** — 적재→셔플→채점 end-to-end 픽스처 (정답 위치 전수 순열) [L2]
- 1d: distractor BATCH(7b~7f) plan에 "본 계약 통과 = 선결 게이트" 명문 삽입 [L1 문서]

**Binary Gate G-WS1**: ① 3경로가 동일 계약 상수/타입을 import (grep 증명) ② 결합 테스트: 5지선다 정답 위치 1~5 전 순열 × 셔플 시드 10종 = 채점 100% 정합 ③ 기존 545 기출 answer 형태와 신 계약의 호환성 1-쿼리 검증 기록.

### WS-2 Production 그래프 보호 기계 (RC-1)

- 2a: **무결성 러너 A안** — production D1 read-only 덤프를 `validateGraphIntegrity`(순수 DI 함수)에 입력하는 스크립트 + 누적 SUPERSEDES 순환 DFS + **항해성 지표(고아 inbound-only 도달불가 클래스)** 추가. production 쓰기 0. 실행 = 진산 인증 위임 시(wrangler --remote) 또는 정기 cron [L2 코드 / 실행은 인증 게이트]
- **[결재·L3]** 2b: knowledge_edges UPDATE/DELETE 가드 마이그 1건 — is_active 플립 화이트리스트 패턴(nodes 전례 4회: 0003:66-71, 0013:101-108, 0014 등). **plan 별도 작성 → 진산 승인 → SQL** (TR-0/0038 선례 절차)
- 2c: QG-2 드리프트 수정 — 헤더 주석을 코드 정본(40/80/7)에 동기 + batchId 배선 + BATCH-6+ 누적 임계 정의 + (옵션) D1 적재물 카운트 모드 (`qg2-validator.ts:4-8,96-105,216`) [L2] **(S4 세션 미수행 — S6 으로 명시 이월, 리뷰 P4-2 흡수 2026-06-11. 동 세션의 '정기 실행 경로 제안' 항목 처분 = 수동 프로토콜 우선·cron 은 결재 #18 묶음에서 진산 결정)** **(S6 이행 기록: 헤더 동기+batchId 배선 완료. BATCH-6+ 누적 임계 "정의"는 임계값=결재 사안이라 보류 — 결재 #19 상신. 약화 fallback(7)은 BatchId 타입이 BATCH-1~5 한정이라 파이프라인 경유 도달 불가, 리뷰 MAJOR-4 완화 확인)**
- **[결재]** 2d: ADR-014(CBIV) 처분 — B(풀스펙 구현) vs C(축소 개정: "수동 프로토콜 + A 러너"를 공식 경로로 명문화). 2027 개정 R-BATCH 전 결재. Accepted ADR의 미이행 상태를 기록으로 해소하는 것 자체가 의무 [문서+결재]

**Binary Gate G-WS2**: ① 러너가 2026-05-15 실측 스냅샷(794/1274) 또는 로컬 재현 덤프에서 고아 0·끊긴엣지 0·순환 0·도달불가 노드 리스트 출력 ② ~~CONCEPT-023 기지 양성~~ **(2026-06-11 실측 반증 정정 — CONCEPT-023 은 유효 inbound 1(F-21 활성)의 약연결이라 올바른 검출기로는 영구 불충족 조건. 대체 = 도달불가 검출기 작동 입증(1차 실측 133건) + 합성 픽스처 양성 테스트. 근거 EXPANSION_GATE_DESIGN E0-2 행)** ③ 가드 마이그: UPDATE 시도 ABORT + is_active 플립 허용 테스트 (G-TR0 패턴) ④ ADR-014 상태 변경 기록.

### WS-3 진실원·드리프트 동기화 (RC-5 + 결재 #7)

- 3a: 저비용 동기 배치 [L1~L2]:
  - Year 2 슬롯 포인터 6곳 → "다음 가용 번호" 상대 표기 (`draft-loader.ts:36-38`, `progress/routes.ts:104-116` 등 4곳, `production-quality.md:102`)
  - schema.ts 헤더('14 tables'→실태) + 누락 컬럼(is_current_active·superseded_by) + 누락 3테이블(batch_runs/review_decisions/review_queue) 선언 — 타입 전용, DB 무접촉
  - CLAUDE.md 스택 정정: "Drizzle = 타입 파생 전용(런타임 raw SQL)·D1 26테이블" + 명령어 섹션(turbo 스크립트 실재 반영) + 오프라인 동기화 캐비엇
  - SEARCH_PIPELINE.md ADR-045 정합 개정(3축: 코드 위치·Concurrent·재귀CTE vow) / ARCHITECTURE.md 갱신(graph 라우트·eval·신규 테이블)
  - qg2 주석(2c와 병합 가능)
- **[결재·G-1 산출물]** 3b: feasibility.md R3/R4 + ceiling.md에 06-05 2차 실측(baseline 83.3%·graphOnlyRecovery 0 both·depth2 −20%) 반영 — **G-1 권위 판정서가 최신 데이터보다 stale한 상태의 해소. R4/R5 본문 변경 = 진산 승인 후**
- **[결재·L3]** 3c: 산식 동기 장치 — 코드 equationTemplate ↔ D1 equation_template 문자열 대조 테스트 1건 + 코드 68 vs D1 157 manifest(engine-backed/display-only 구분). formula-engine 접촉 = L3 plan 선행. 2027 개정 전 의무. ✅ **plan 작성 완료 (2026-06-13)**: `../formula-sync-manifest.plan.md` (DRAFT — 코드 68=F-01~F-68·D1 89건 display-only·RC-5 5중보관 file:line·PITR·G-WS3c-1~6·§9 결재 6항. 독립 사실검증 PASS/FAIL 0. **코드 착수 = §9 결재 후**). 실측: D1 formulas 157/157 equation_template·variables_schema·node_id 채움 / equation_display·expected_inputs·graceful_degradation 0/157.

**Binary Gate G-WS3**: ① `grep -rn "0017\|0019\|0005" --include="*.ts"` 중 소진 번호를 미래 슬롯으로 가리키는 참조 0건 ② schema.ts에 is_current_active 타입 존재 + `approved-nodes-sql.ts` SQL 컬럼과 대조 테스트 ③ CLAUDE.md/ARCHITECTURE.md/SEARCH_PIPELINE.md 정정 diff 진산 확인 ④ feasibility/ceiling에 '83.3%·06-05' 문자열 grep ≥1 (승인 후) ⑤ manifest: 68 engine-backed ID 전수 D1 대조 스크립트 PASS.

### WS-4 검색 엔진 정상화 + 잣대 강화 (RC-2·RC-6) — **전 항목 결재 의존**

- **[결재]** 4a: Phase 0a — DEFAULT_MAX_DEPTH 2→1 (`graph-walk/index.ts:66`). S5-8 plan이 "확정 손해 차단·단독 결재 가능"으로 분리해 둠 → 단독 상신.
- **[결재]** 4b: S5-8 plan 개정 상신 — Phase 1 PITR 비교군에 **D안(graph-walk 동결 + lexical fusion)** 추가 (ADR-019 Accepted 미구현 스펙). ✅ **집행 완료 (2026-06-12)**: S5-8 plan §3 Phase 1-D·§4·§7·§9 등재 (결재 #7 ☑ — 구현 착수는 §9 별도 체크).
- 4c: G-S5 잣대 강화 3종 (결재된 Phase 0b의 게이트로 병합) [L2]:
  - golden 빌더 일반화 — 문항 ID 하드코딩 RULES(`build-querybody-golden.mjs:36-67`) → 일반화된 정답/해설 분리기
  - expandedNodes 디버그 노출 — route 디버그 플래그로 확장 전체집합 surface(랭크미달 vs 미도달 진단)
  - query 500자 천장 처리 — 측정 경로 한정 우회 또는 계약 분리(Q-004 영구 제외 해소)
- **[결재]** 4d: golden N≥20~30 확대 (Phase 0b) + 절대값 임계 N≥30 한정 규칙 채택 (06-02 감사 결재 큐 잔여).
- **[결재·RULE #5]** 4e: G-S5 GO/NO-GO 본 결재 — 사실 고정: 🟢 vector 83.3%(N=6) / 🔻 graph 순기여 0·depth2 순손실 / 🟡 "알고리즘 사망" 단정 시기상조. 선택지 = S5-8 §9 6옵션 + D안. **결정은 진산 단독.**

**Binary Gate G-WS4**: ① depth1 기본화 후 G-S5 재실측 = regression 0 유지 ② 빌더 일반화: 신규 문항 1건을 RULES 추가 없이 처리 ③ expandedNodes로 Q-015 headroom 2노드의 미도달/랭크미달 판별 기록 ④ 500자 초과 Q-004 측정 포함 확인.

### WS-5 산출-소비 배선 (RC-3) — 베타 품질

- 5a: /next 모드 WHERE 필터 — category(subject populate 됨 = 즉시)·topic (`routes.ts:814-846`) [L2]
- **[결재·L3]** 5b: confusion_level INSERT 영속 — draft-loader INSERT 컬럼 추가(`draft-loader.ts:423-425`)는 트리거 0014:84-85 차단 목록과 충돌 → 0038식 화이트리스트 재설계 또는 Temporal INSERT. **plan 선행**
- 5c: FSRS due 소비 경로 — /api/progress/due의 web 소비자 1개 신설(복습 큐 UI) + /study/next due 반영 여부 PITR [L2]
- **[결재-경량]** 5d: weak_score 집계 수준 — D2 lock 정의(과목+개념) 재확인 vs types.ts 재정의 중 택1 = **Silent Pivot 해소 ADR 필수** (`srs/types.ts:54-61` vs `routes.ts:1063-1070`). 원천 데이터 영속 = 후행 재계산 가능(가역)
- **[진산 게이트]** 5e: 출처 추적 백필 — 0038 production 적용(wrangler --remote, 게이트 #3) → related_nodes 백필(golden-pilot-approved.json) → 근거보기 E2E
- **[결재·L3]** 5f: 2차 훈련 루프 1단계 — formula-engine 학습자 배선 plan(Step 3-UX-5 잔여의 재이연 여부 명시 ADR 포함). calc 단계채점·essay 루브릭은 별도 G-1 분해 후

**Binary Gate G-WS5**: ① 모드별 /next 응답이 available 카운트와 동일 풀 (모순 해소 E2E) ② confusion_level 영속: 단감 1.0115/떫은감 0.9662 쌍이 'danger' 영속 (기지 양성) ③ due 소비 UI에서 due 카드 노출 E2E ④ weak_score ADR Accepted + 구현-정의 일치 테스트 ⑤ 근거보기: related_nodes 백필 후 비어있지 않은 citation 응답 E2E.

### WS-6 생성층 진입 게이트 (RC-4) — Phase 2 선결 (생성 코드보다 먼저)

- **[결재]** 6a: "게이트 선행 원칙" 명문화 — 생성 코드 1줄 전 DB 게이트 마이그 선행 (Phase 2 진입 규칙)
- **[결재·L3]** 6b: mnemonic_cards 게이트 마이그 — status CHECK + draft-only INSERT 트리거 + reverse_verified=1 없이 approved 전이 금지 (0002:41-52 현 전무) [plan 선행]
- **[결재·L3]** 6c: exam_questions draft 표현 PITR 2안 — CHECK 재정의(테이블 재생성, 지연될수록 비용 증가) vs 별도 mock_exam_questions 테이블(0020+ 슬롯) [plan 선행]
- 6d: tables[] 무음 폐기 봉합 — parseContractJson expectedKeys에 tables + 무음 삭제 경고 + loader table\_\* 적재 (자동 파이프라인 승격 결재와 묶음) [L2]
- **[결재]** 6e: Table-as-Micro-KG supersedes 이중 채널 ADR — 소문자 'supersedes'(0021:112-117)가 SUPERSEDES 트리거 기계 전부 우회 + 표→표 supersession FK 표현 불가. 첫 표 개정 전 결정 필요. + 표 벡터 433 슬롯 잠식(검색 분리 vs 필터) 처분
- 6f: containment Layer2 validator 4종 + prompt injection + output PII 필터 — **Phase 2(생성) 진입 게이트로 지정** (현 user-facing LLM 0 = 시점 정합, 착수 시점만 못박음)

**Binary Gate G-WS6**: ① mnemonic_cards에 draft 외 status INSERT ABORT 테스트 ② reverse_verified=0 approved 전이 ABORT 테스트 ③ tables[] 포함 응답이 경고 없이 폐기되지 않음(테스트) ④ ADR 2건(6c·6e) Accepted ⑤ Phase 2 진입 체크리스트에 6f 게이트 명문.

### WS-7 북극성 확장 (신규 Epic — 본 플랜 범위 밖, 진입 조건만 고정)

- 혼동 유형 감지 엔진: **G-1 R1~R5 전수**(ceiling: 혼동 자동 감지의 업계 천장 조사 포함) → feasibility → plan
- 생성 엔진 본체(M20~M24): WS-6 게이트 전부 PASS + **G-1 R1~R5 전수** + ai-adapter 단일 정본 결정(ADR-023 §2.4 경로) 후
- golden 확대 Phase B/C(보기별 라벨), 상법/농학 코퍼스 확대: 기존 결재 체계 유지

---

## 4. 실행 순서·의존성

```
[즉시 가능 (결재 경량/불요)]          [결재 후]                [진산 단독 게이트]
WS-0 (0a,0b,0c,0e,0f) ──────┐
WS-2a 러너 코드, 2c ─────────┤
WS-3a 드리프트 배치 ─────────┼──> WS-1 (1a 계약 결재 → 1b,1c,1d)
                             │    WS-2b 엣지 가드 (L3 plan→승인→SQL)
                             │    WS-3b feasibility 갱신 (승인)
                             │    WS-3c 산식 동기 (L3 plan)
                             │    WS-4a depth1 (단독 결재)
                             │    WS-5b,5d,5f (L3/ADR)
                             │    WS-6b,6c,6e (L3 plan)
                             │
                             └──> WS-4e G-S5 GO/NO-GO ──> WS-4b/4c/4d (방향 확정 후)
                                  WS-5e 0038 적용+백필 (wrangler 인증)
                                  WS-2a 러너 production 실행 (wrangler 인증)
```

**권고 시퀀스** (채택 = 진산): ① WS-0 + WS-3a (지혈·동기) → ② WS-1 (정답 안전) → ③ WS-2 (그래프 보호) → ④ WS-5 (배선) → ⑤ WS-4 (결재 동기화) → ⑥ WS-6 (Phase 2 선결) → ⑦ WS-7 (확장).
정확성 최우선 공리에 따라 **WS-1을 distractor BATCH 어떤 작업보다 먼저** 통과시키는 것이 본 플랜의 단일 최대 권고.

---

## 5. 리스크·가드레일

- **L3 영역 재확인**: 마이그레이션 전부(2b·5b·6b·6c)·formula-engine(3c·5f)·constants — **plan 작성 → 진산 승인 → 코딩**. "진행" 지시만으로 SQL 작성 금지(2026-05-29 실수 로그 — approved_by 명시 전환 선행).
- **Hard Limit 불변**: knowledge_nodes/formulas UPDATE 금지(INSERT+SUPERSEDES)·LLM 수식 계산 금지·동적 코드 금지·Ontology Lock·draft-only·BATCH 순차.
- **측정 정직성**: 모든 재측정은 golden 파일 직접 채점 + fabricate 차단(assertRemote) 유지. AI 자기 채점 금지. N=6 절대값 일반화 금지(N≥30 규칙 결재 전).
- **stale 문서 방어**: 본 플랜 인용 file:line은 2026-06-10 감사 시점 기준 — 실행 세션은 반드시 실코드 재확인 후 수정 (라인 드리프트 가능).
- **미커밋 산출물**: 06-05 측정 산출물 + 본 감사/플랜 산출물 전부 미커밋 — 재현 근거 영속(커밋) 여부 = 결재 #8.

---

## 6. 진산 결재란

> **2026-06-10 진산 위임**: "너가 결정해서 정리 구현해줘. 내가 반드시 결정할 것이 있으면 알려주고."
> → 운영·가역 결정은 Claude 위임 처리(아래 ☑ 표기 + 결정 내용 기록). **위임 불가로 잔존하는 것** =
> RULE #5(G-S5 GO/NO-GO #8) · L3 마이그 SQL 승인(#3·WS-5b·WS-6b/c) · 정답 안전 계약(#2, Hard Stop 직격 —
> 증거 기반 권고 후 확인 1회) · production 원격 실행(#11, wrangler 인증).

> ★ **2026-07-02 일괄 결재 (진산 "결재 카드 전부 권고대로 진행해줘")**: #3 (a) plan 착수+Track B 묶음 /
> #4 (b) C 축소 개정 / #10 (a) D2 복원·단계 집행 / #12 (a) 명문화+(b-2) mock 격리 / #13 (b) ADR 영속+잠식
> 필터 즉시 / #18 ①소급 승인+②(a) 수동 유지 / #19 (a) engine 기준 fail-closed / #22 (b) E0-8 뒤 이연 +
> WS-5c PITR (C) / S5-8 §9 Phase 0b ☑ / WS-3c §9 ①②③⑥ ☑(④89건 분류·⑤F-55 = 권고 부재로 미결 유지).
> **미포함**: #8(조건부 보류 유지)·#14 push(권고 부재 — 명시 지시 대기)·#20 Track B 검수(데이터 검수 =
> 진산 고유)·E0-8 갭 처분(§2 A~D군, 권고 없음 RULE #5).
> → **집행 완료 (동일 일자)**: 코드 4(#19·#13+4c·#10·WS-3c) + 문서 3(#4 ADR-014 Amended·#3 WS-2b
> plan·#12 체크리스트+WS-6c plan). 5-페르소나+반증 15에이전트 리뷰 C0/M10 전건 수정
> (`review-20260702-133800`). ★WS-3c 실측 = **산식 드리프트 55건(F-14~68 코드↔D1 계보 분화)** —
> 진실원 방향 = 신규 L3 결재 대기. G-WS3 ⑤ = 도구 PASS·측정 FAIL(정직 보고).

| #    | 결재 건                                                     | 연계 | 상태                                                                                                                                                                                                                                                                                                 |
| ---- | ----------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ☑ 1  | 본 마스터 플랜 채택 + 권고 시퀀스                           | 전체 | **위임 승인** (2026-06-10 진산 위임 발화 — S1 완료, S4/S6 진행)                                                                                                                                                                                                                                      |
| ☑ 2  | MC 채점 answer 계약 (1a)                                    | WS-1 | **진산 채택 (2026-06-11 "추천한 것으로") = (a) 위치 라벨형** — plain 숫자 "1"~"4" 현행 유지 + 복수정답 콤마 계약 (`decision-card-2-mc-answer-contract.md`). → S3 착수                                                                                                                                |
| ☑ 3  | knowledge_edges 가드 마이그 plan 착수 (2b)                  | WS-2 | 승인 / 보류 — **카드: `decision-card-3-knowledge-edges-guard.md`** (2026-06-12 상신, 권고 (a) 지금 plan 착수 + Track B 결재 묶음)                                                                                                                                                                    |
| ☑ 4  | ADR-014 CBIV 처분 (2d)                                      | WS-2 | B 풀스펙 / C 축소 개정 (2027 R-BATCH 전) — **카드: `decision-card-4-adr-014-cbiv.md`** (2026-06-12 상신, 권고 (b) C 축소 개정)                                                                                                                                                                       |
| ☑ 5  | feasibility/ceiling 06-05 반영 갱신 (3b)                    | WS-3 | **진산 승인 (2026-06-11 "추천한 것으로")** — S7 에서 R3/R4 갱신, R5 결정란은 진산 전용 유지                                                                                                                                                                                                          |
| ☑ 6  | Phase 0a depth 2→1 (4a) — 단독 분리 건                      | WS-4 | **진산 승인 (2026-06-11 "추천한 것으로")** — S8 에서 구현+재측정                                                                                                                                                                                                                                     |
| ☑ 7  | S5-8 plan에 lexical fusion D안 추가 (4b)                    | WS-4 | **진산 승인 (2026-06-11 "추천한 것으로")** — Phase 1 PITR 비교군에 D안 등재 + **집행 완료 (2026-06-12)**: S5-8 plan §3 Phase 1-D·§4·§7·§9 (구현 착수는 S5-8 §9 별도 체크)                                                                                                                            |
| ◐ 8  | G-S5 GO/NO-GO 본 결재 (4e) + N≥30 임계 규칙                 | WS-4 | **조건부 보류 기록 (2026-06-11)** — Claude 는 옵션 권고 불가(RULE #5)·진산 "추천대로" 위임의 적용 불가 항목. 실질 처분 = #6(depth1 차단)+#7(D안 비교군) 집행 후 **D안 vs graph 재설계 비교 측정 결과로 재상신**. E0-5 는 "미결만 차단"이므로 본 조건부 보류 기록으로 충족                            |
| ☑ 9  | 모드 정직성 임시 조치 방식 (0d)                             | WS-0 | **위임 결정 = 비활성 표기**(미동작 모드 "준비 중" disabled — 로드맵 가시성 유지, 백엔드 무삭제로 WS-5a 배선 시 즉시 재활성. S2 세션에서 구현)                                                                                                                                                        |
| ☑ 10 | weak_score 의미 확정 (5d)                                   | WS-5 | D2 정의 복원 / 정의 재정의 ADR — **카드: `decision-card-10-weak-score.md`** (2026-06-12 상신, 권고 (a) D2 복원·단계 집행)                                                                                                                                                                            |
| ☑ 11 | 0038 production 적용 + related_nodes 백필                   | TR-0 | **집행 완료 (2026-06-11, cfut\_ 토큰)**: 0038 적용(트리거 prevent_exam_questions_body_update 교체 확인) + 백필 7건 문자단위 정확(STEP 0 게이트 7좌표 현행 1행·골든 동결본 대조 7/7)·538 NULL 유지(N=12 워터마크). + **Worker 재배포(8d2e6ea3 — depth1·S1~S3 누적) + G-R0a PASS**(Δ0.0%·regression 0) |
| ☑ 12 | 생성층 게이트 선행 원칙 + exam_questions draft 표현 (6a·6c) | WS-6 | CHECK 재정의 / mock 테이블 — **카드: `decision-card-12-generation-gate-draft-pitr.md`** (2026-06-12 상신, 권고 (a) 명문화 + (b-2) mock 격리 스테이징)                                                                                                                                                |
| ☑ 13 | Table supersedes 이중 채널 + 표 벡터 433 처분 (6e)          | WS-6 | ADR 상신 후 결정 — **카드: `decision-card-13-table-micro-kg.md`** (2026-06-12 상신, 권고 (b) ADR 1건 영속 + 잠식만 쿼리측 필터 즉시 차단)                                                                                                                                                            |
| ☐ 14 | 감사·측정·플랜 산출물 커밋 (재현 근거 영속)                 | 전체 | **위임 결정 = 분리 커밋 실행** (2026-06-10, 로컬 5커밋 — 훅 인프라/선세션 잔여/감사·플랜/S1/CI수리. **push 는 보류** — 진산 확인 후)                                                                                                                                                                 |

> **위임 하 추가 결정 (2026-06-10)**: 기존 CI typecheck 블로커 2건 즉시 수리 — ① admin-web GraphVisualizer
> NODE_COLORS Table-KG 4종 누락 ② batch pipeline.integration 픽스처 ADR-030 필드 누락. 둘 다 S1 무관
> 선재 RC-5 type-drift. 수리 후 **`pnpm -r typecheck` 전체 green 최초 달성** (exit 0). 독립 리뷰
> `review-20260610-211221-ci-blockers-typefix.md` C0/M0. → WS-3a 의 "드리프트 동기" 일부 선행 소화.

---

## 6b. 증보 v1.1 (2026-06-10 — 이식성·목표 커버리지 감사 A-1~A-6)

> 근거: `docs/audit/PORTABILITY_GOAL_COVERAGE_20260610-225125.md` (진산 1차 목표 F1~F7 전수 매핑 +
> 별도-프로젝트 이식성 실측 — 직전 감사 미커버 렌즈 2종. 판정 17건·적대 반증 13건·production D1
> read-only 라이브 실측 포함). 핵심: **F6(관리자 포맷→키워드 변형 생성) = 전층위 설계 부재 확정**
> (4회 교차 grep 0건) / 이식성은 연산 코어층만 실측 뒷받침, engine-export 6문서 = stale(결재 0·실코드
> 괴리) / F7 데이터 기아 라이브 확정(related_nodes 0/545·explanation 0/545·**2차 answer NULL 20건 신규**).

| #   | 증보                                                                                                                                                                                                                                                                                                                                                                    | 반영 위치     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| A-1 | distractor BATCH 선결 게이트에 "0038:57 distractors ABORT — 기존 545행 UPDATE 백필 불가 → SUPERSEDES(신규 INSERT) 경로 의무 + 0038 미적용 시 0004 전면 ABORT(input_type 백필도 차단)" 명문                                                                                                                                                                              | WS-1 1d·WS-5e |
| A-2 | 백필 초안 28c25f3 = measurable 7건 한정(538/545 출처 공백 잔존) → 545 전수 백필은 별도 BATCH 결재 분리 + **2차 answer NULL 20/545 처분 항목 신설**(정답 표시 공백 — 라이브 실측)                                                                                                                                                                                        | WS-5e         |
| A-3 | **F6를 WS-7 신규 Epic 후보 등재** — 1차 목표 중 유일 전층위 공백, 착수 = G-1 R1~R5 전수(R3 = "변형 후 정답 100% 보존" GT Spike 선행). 추정 설계 방향: 템플릿 슬롯화 → constants DB/노드 검증값 주입(LLM 추론 금지) → Formula Engine 재계산/원본 대조 검증 → draft-only → 인간 검수. + F5 "챕터별 생성" 설계 공백·M22 변형 알고리즘 미정의를 생성 Epic R2 분해 축에 포함 | WS-7          |
| A-4 | **결재 #15 신설** (아래 표) — 별도-프로젝트 추출 모델 3택. 결재 전 engine-export 6문서에 STALE 라벨(defineExamAdapter 부재·/api/v1 허구·마이그 19 vs 38 괴리) + "재사용 55~75%" 수치 인용 금지(QG-M2 2번째 시험 실증 0회 = 측정 전 추정)                                                                                                                                | 신규          |
| A-5 | section-splitter:56 PAGE_HEADER_RE = Hard Rule 15 미등재 위반 → 예외 등재 또는 어댑터 분리 택1 + batch-processor 프롬프트 truth_weight 이중 기재 동기 표식 + v2.0 우선순위 매트릭스 stale 주석                                                                                                                                                                          | WS-3a         |
| A-6 | WS-6b(mnemonic_cards 게이트)는 F2 체인(M18→M19→M23) 전체 부재가 전제 — 게이트 신설 = F2 진전이 아닌 착수 전 안전장치임을 plan에 명문(기대치 오인 방지). mnemonic_cards production COUNT 0 라이브 확정                                                                                                                                                                   | WS-6b         |

| #    | 결재 건                                            | 연계        | 선택지                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---- | -------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ◐ 15 | 별도-프로젝트 엔진 추출 모델                       | 확장 전략   | **진산 방향 천명 (2026-06-11)**: (b) 달력 대기 폐기 → **성공 게이트 기반 시퀀스** 채택 방향 (1호 성공 → 2~3호 실증 → 범용 자격시험 인프라 → closed-domain 사업 엔진). 적대 검증 = 조건부 지지(`docs/audit/EXPANSION_GATE_DESIGN_20260611-073814.md` H1~H5). **형식 종결 잔여**: E0~E4 게이트 채택(#16) + ADR-007 supersede ADR 작성·결재                                                                                                                                         |
| ☑ 16 | **E0~E4 확장 게이트 채택**                         | 확장 전략   | **진산 승인 (2026-06-11 "권고대로")** — 설계안 채택. 하한값 4곳은 E0-4 측정 후 확정으로 이연. 게이트 문구 개정 = L3급 결재(침식 차단). ADR-007 supersede = E3-4 시점                                                                                                                                                                                                                                                                                                             |
| ☑ 17 | **2호 후보 R3 spike 착수 승인**                    | 확장 전략   | **진산 승인 (2026-06-11 "권고대로")** — 후보: 공인중개사/소방/산업안전, PDF 1건 구조화→무결성 PASS 실측(버려질 스파이크·전 게이트 병렬). 전기기사 = 2호 배제(E2-0) → 3호. **선결: 후보 시험 공개 기출/교재 PDF 확보(진산 공급 또는 출처 지정) 후 착수** **+ (2026-06-11 보충) 자료 확보 = 데드라인 없음·진산 여유 시 — 공개 기출 1회분 1건이면 충분(버려질 스파이크·정확성 검증 불요). 1호 E0 집중이 우선**                                                                      |
| ☑ 18 | **E0-2 판정방법 문구 개정 소급 승인**              | 확장 게이트 | 러너 1차 실측이 "CONCEPT-023 기지양성" 전제를 반증(유효 inbound 1) → 판정방법을 "고아0·끊김0·순환0·stale참조0(러너 gatePass)"로 개정(EXPANSION_GATE_DESIGN E0-2 행, 강화 방향·판정 결과 불변). 채택 규칙 "게이트 문구 개정=L3급 결재"의 첫 사례라 소급 결재 상신(리뷰 P4-3). + 무결성 러너 정기 실행 경로(수동 vs CI cron) 동시 결정 — **카드: `decision-card-18-e0-2-wording-runner-cadence.md`** (2026-06-12 상신, 권고 ① 소급 승인 + ② 수동 유지·E0-2 첫 PASS 시 cron 재상신) |
| ☑ 19 | **QG-2 BATCH-6+ 누적 산식 임계값 정의**            | WS-2c       | BATCH-6(누적 88?)·7·L·R 임계 — 임계값 = 매직넘버/L3 인접이라 결재. 현 fallback(7)은 파이프라인 타입상 도달 불가(완화) — **카드: `decision-card-19-qg2-batch6-threshold.md`** (2026-06-12 상신, 권고 (a) engine 기준 89/95/95유지 fail-closed. ★"누적 88?" 산출 근거 미발견 — 실측 89)                                                                                                                                                                                            |
| ☑ 21 | **콘텐츠 커버리지 역감사 (E0-8 신설)**             | E0          | **진산 승인 + 시기 지정 (2026-06-11)**: 토큰 리셋(~06-15) 후 즉시 실행. 산출물 = 출처단위→노드ID→상태 검수용 목록 리스트. memory `project_content_coverage_audit_20260615` 영속                                                                                                                                                                                                                                                                                                  |
| ◐ 20 | **E0-2 데이터 수리** (고아 24+유령 103)            | WS-2        | plan 작성 ✓(`docs/plans/e0-2-graph-repair.plan.md`+부록, 2026-06-11). ★분석 발견: 유령 진앙 = R1 SUPERSEDES 오용 — **본체 11노드(적과전II·가축재해 등) 비활성 = 검색 제외 상태**. 권고 A-1 = 복원+R1 엣지 원자 처분(103 자동 해소). **→ plan §6 결재 대기 잔여 4항**(CROSS_REF 선택·B-1·B-2·B-3 — A-1·Track C·진성중복 3항은 집행 완료 [x]) + SQL 실행 인증. **검수 안내 카드: `../e0-2-track-b-review-card.md`** (2026-06-12 — 정밀 집계 24 = B-1 2·B-2 12·B-3 9·C 1)           |
| ☑ 22 | **근거 보기 Phase B(보기별 라벨 pilot) 진입 시점** | WS-7·M4     | G-S5 pilot 측정 3회 완료(06-01/05/11)로 기결(2026-05-21 단계분리) 상신 의무 이행 — **카드: `decision-card-phase-b-choice-basis.md`** (2026-06-12 상신, 권고 (b) E0-8/M1 뒤 이연). 선택지: (a) 지금 진입 / (b) E0-8 후 / (c) Phase C 병합 재설계                                                                                                                                                                                                                                  |

> **부수 실측 (2026-06-10)**: `wrangler d1 execute --remote` **읽기 세션 현재 유효**(본 감사 중 실 쿼리
> 성공 — success:true 원문 확인). 결재 #11 의 "진산 인증 게이트"는 **쓰기(마이그 적용·백필)에만 잔존** —
> 읽기 기반 작업(무결성 러너 production 실행, 데이터 실태 조사)은 지금 가능.

---

## 7. 기각된 발견 (적대 반증 — 추적 금지)

| 기각 발견                                                      | 기각 사유 요지                                                                                                                                                    |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| production-load-path-bypasses-pipeline (critical 프레임)       | 사실관계 전부 실재하나 northstar-redteam의 production-data-bypasses-quality-machine(RC-1 confirmed)과 동일 진앙 — critical/major 충돌 병기로 흡수, 별건 추적 불요 |
| layer5-stub-plus-dual-ai-contract (critical 프레임)            | ADR-023 §2.4(Accepted, 진산 서명)가 ai-adapter 실구현·생성 착수 시점을 명문 이연 — "무계획 산개" 프레임 반증. stub 자체는 RC-4로 추적                             |
| second-exam-training-loop-disconnected (critical 프레임)       | 사실 5건 전부 확인 — 단 major(second-exam-training-loop-absent)로 생존, critical 격상 프레임만 기각                                                               |
| generation-engine-zero-loc-silent-pass                         | generation-layer-north-star-stub와 중복 — 병합                                                                                                                    |
| containment-4layer-two-implemented (major 해석 3건)            | 원자 사실 재확인 — 단 현 user-facing LLM 0 = 공격면 부재로 시점 정합. Phase 2 진입 게이트로만 유효 (WS-6f 반영)                                                   |
| retry-unclassified-and-stub-golden-paradox                     | anthropic-client.ts:5-9가 트레이드오프·완화책까지 명문화한 자인된 TD — 설계 오류 아님                                                                             |
| stage1-fixed-recall-budget-attrition                           | "over-fetch 부재" 산술적 거짓(topK 3~10 대비 20 선취) — 과장 기각                                                                                                 |
| eval-yardstick-inside-app-boundary ("major Engine-First 위반") | 파서 이원화는 4-Pass가 이미 적발·문서화한 의도적 이연(plan §5b CO-6a-1) — 신규 위반 아님. 계약 테스트(0e)만 채택                                                  |

---

## 8. 참조

- 감사 정본: `docs/audit/DESIGN_AUDIT_REPORT_20260610-140529.md` (진앙·발견 전수 file:line·환각 자수)
- 실행 가이드: `docs/plans/master-remediation-20260610/OPUS48_EXECUTION_PLAYBOOK.md`
- G-S5 실측: `docs/plans/s5-6-measurements/s5-6-g-s5-2026-06-05-querybody-analysis.md`
- graph 재설계: `docs/plans/graph-walk-s5-8-redesign.plan.md` (§9 결재란)
- TR-0 선례(L3 절차): `docs/plans/tr-0-backend-c7-trigger-redesign.plan.md` + ADR-046
- 헌법: `docs/consti/VOID_DEV_UNIFIED_CONSTITUTION_v3_6.md` Part 0.4 (G-1)

> **환각 자수(본 플랜)**: ① production D1 라이브 수치(794/1274/157/193/545·NULL 카운트·0038 적용 여부)는 전부 문서·코드 주석 기록 인용 — 라이브 재검증은 진산 인증 게이트. ② "graph 순손실/무익" 서술은 N=6·단일 도메인·현 파라미터 한정 신호. ③ file:line은 감사 시점(2026-06-10) 기준 — 실행 시 재확인 의무.
