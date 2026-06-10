# Opus 4.8 실행 플레이북 — 인프라 견고화 마스터 플랜 구현 가이드

> **용도**: `MASTER_PLAN.md`(같은 디렉토리) 결재 후, 코딩 구현을 **Claude Code (Opus 4.8)** 세션들로 차질 없이 진행하기 위한 세션 분할·실행 프롬프트·게이트 정의.
> **작성**: 2026-06-10 (Fable 5 — design-audit 워크플로우 산출 기반). 결재 전 사용 금지 항목은 세션별 "진입 조건"에 명시.
> **사용법**: 진산이 세션마다 §3의 해당 "실행 프롬프트" 코드블록을 새 Claude Code 세션에 붙여넣는다. 한 세션 = 한 워크스트림 조각 (컨텍스트 예산·4-Pass 품질 보전).

---

## 1. Opus 4.8 세션 공통 수칙 (모든 세션에 적용 — 프롬프트가 이 절을 읽도록 지시함)

프로젝트 CLAUDE.md(자동 로드)가 1차 규율이다. 그 위에 본 플랜 특화 수칙:

1. **인용 라인 드리프트 주의**: 마스터 플랜·감사 보고서의 file:line은 2026-06-10 스냅샷이다. **수정 전 반드시 실코드를 다시 열어** 현재 라인·내용을 확인하라. 어긋나면 보고 후 진행.
2. **스키마 존재 ≠ 데이터 populate** (2026-05-16 교훈): 데이터 전제가 있는 작업(answer 형태, related_nodes, confusion_type 등)은 가능하면 production 1-쿼리(진산 인증 필요 시 요청) 또는 repo 내 적재 SQL/기록으로 선검증.
3. **L3 절차 (2026-05-29 실수 로그)**: 마이그레이션/formula-engine/constants 접촉 작업은 "진행" 지시를 받아도 **plan `approved_by` 명시 전환(또는 명시 확인) 후** 코딩. 선작성 시 "선작성본(formal sign-off 대기)" STATUS 라벨 의무.
4. **측정 정직성**: AI 자기 채점 금지. 재측정은 golden 파일 직접 채점 + assertRemote(fabricate 차단) 경로만. 테스트 출력은 원문 그대로 보고.
5. **완료 선언 = 4-Pass 후**: L2+ 변경 완료 전 `.claude/workflows/4pass-review.js` 워크플로우(또는 독립 에이전트 4-Pass)를 실행하고 CRITICAL 0 확인. 산출물 파일명 `review-*` prefix.
6. **금지어**: 천장 근거 없는 실현가능성 단언 금지(G-1 — CLAUDE.md 상단 블록의 금지어 형식 참조). GO/STOP·옵션 채택을 스스로 결정 금지(RULE #5) — 갈림길은 선택지+권고로 보고.
7. **회귀 0 증명**: 변경 후 영향 패키지 vitest 전체 + (루트 package.json의 turbo 스크립트 확인 후) typecheck/lint. 수치는 원문 출력으로.
8. **기각된 발견 8건(마스터 플랜 §7) 재추적 금지** — 적대 반증으로 닫힌 건이다.
9. **커밋은 진산 지시 시에만**. 산출물은 작업 디렉토리에 영속하고 미커밋 상태를 최종 보고에 명시.

---

## 2. 세션 분할표 (의존성·결재 전제 포함)

| 세션 | 범위 (WS)                             | 결재 전제 (마스터 플랜 §6)   | L3 여부                                   | 예상 산출물                          |
| ---- | ------------------------------------- | ---------------------------- | ----------------------------------------- | ------------------------------------ |
| S1   | WS-0 즉시 지혈 (0a/0b/0c/0e/0f)       | 없음 (#9는 0d만 — 별도)      | 무                                        | 코드 + 테스트 + review-\*            |
| S2   | WS-0d 모드 정직성                     | #9 (방식 채택)               | 무                                        | UI/route 변경 + E2E                  |
| S3   | WS-1 MC 채점 3중 모순                 | #2 (answer 계약)             | learning-modes 채점 코어 = 사실상 L3 취급 | 계약 모듈 + 3경로 통일 + 결합 테스트 |
| S4   | WS-2a/2c 무결성 러너 + QG-2           | #1 (플랜 채택)               | 무 (러너는 read-only)                     | scripts/ 러너 + 테스트               |
| S5   | WS-2b 엣지 가드 plan→SQL              | #3 (plan 착수) → 승인 후 SQL | **L3** (2단계)                            | plan + (승인 후) 마이그 0039+        |
| S6   | WS-3a 드리프트 동기 배치              | #1                           | 무 (문서+타입)                            | 문서/스키마 타입 diff                |
| S7   | WS-3b/3c feasibility 갱신 + 산식 동기 | #5, (3c는 L3 plan)           | 3c = **L3**                               | 문서 갱신 + manifest+대조 테스트     |
| S8   | WS-4a/4c depth1 + 잣대 강화           | #6 (+#7/#8 방향)             | 무                                        | 코드 + 재측정 리포트                 |
| S9   | WS-5a/5c/5d 배선 1차                  | #1 (+#10 weak_score)         | 무                                        | route 필터 + due UI + ADR            |
| S10  | WS-5b/5e confusion 영속 + 백필        | #11 + L3 plan 승인           | **L3** + 진산 인증                        | plan → 마이그/백필                   |
| S11  | WS-6 생성층 게이트 plan 일괄          | #12/#13                      | **L3 plan들**                             | plan 2~3건 + ADR 2건                 |

> 세션 순서는 마스터 플랜 §4 권고 시퀀스. S1·S4·S6은 상호 독립 — 병행 가능.

---

## 3. 세션별 실행 프롬프트 (복붙용)

### S1 — WS-0 즉시 지혈

```
[세션 목표] 마스터 플랜 WS-0 중 결재 불요 5건(0a/0b/0c/0e/0f)을 구현한다. 한 항목씩 완결(구현→테스트→다음).

[먼저 읽기]
1. docs/plans/master-remediation-20260610/MASTER_PLAN.md §3 WS-0 + §5 가드레일 + OPUS48_EXECUTION_PLAYBOOK.md §1 공통 수칙
2. docs/audit/DESIGN_AUDIT_REPORT_20260610-140529.md §7 해당 발견 행(contract-gate-omits-learning-core-packages / srs-depends-on-learning-modes / generation-layer-north-star-stub / eval-parser-and-ceiling-copies / distractor-safety-no-answer-equality-guard)
3. 실코드: scripts/verify-engine-contracts.ts:168-179 / .github/workflows/ci.yml:53-64 / packages/srs/package.json / packages/study-material-generator/package.json / apps/api/src/eval/multihop-accuracy.ts:36-66 + apps/api/src/study/routes.ts:478-493 / routes.ts:393-417

[작업]
0a. learning-modes(116 tests)+srs(35 tests)를 VITEST_PACKAGES와 ci.yml 테스트 필터에 등록. 등록 후 CI와 동일 명령을 로컬 실행해 151건 PASS 원문 출력.
0b. srs→learning-modes 역의존(FsrsRating type-only 2건)을 해소 — FsrsRating 소유를 @thepick/shared 또는 srs로 이동(phase3 plan §7.3:375 금지 명문과 정합한 방향 선택, 선택 사유 보고). 순환 의존 미발생 확인.
0c. study-material-generator의 --passWithNoTests 무음 PASS를 제거하되, "의도된 stub(ADR-023 §2.4 이연)"임이 로그에 보이게 — stub 명단 상수 또는 명시 경고 중 택1(권고: verify-engine-contracts에 KNOWN_STUB_PACKAGES 명단 + stub인데 src 증가 시 경고).
0e. parseRelatedNodes ↔ enrichRelatedNodes 양쪽을 같은 malformed 픽스처(빈문자열/이중직렬화/비배열 JSON/512자 초과)로 묶는 route-level 계약 테스트 신설. 두 파서의 의도적 비동치(무절단)는 테스트 주석에 명문.
0f. 객관식 서빙 직전 distractor 동치/중복 가드 — 정답 텍스트와 동일(공백·전각 정규화 후)한 distractor 존재 시 해당 문항 서빙 거부 + 구조화 로그. 기존 545 기출이 가드에 걸리지 않음을 픽스처로 확인.

[금지] L3 접촉(마이그·formula-engine) / exam_questions 데이터 변경 / 모드 UI 변경(0d는 별도 세션) / 커밋(지시 전).

[완료 게이트 — 전부 PASS 후에만 "완료"]
G1: CI 필터 등록 + 로컬 151건 PASS 원문. G2: srs package.json에서 learning-modes 의존 제거 증명(grep). G3: stub 무음 PASS 불가 증명 로그. G4: malformed 계약 테스트 양 파서 PASS. G5: 동치 distractor 거부 테스트 PASS. G6: api 전체 vitest 회귀 0 원문. G7: 4pass-review 워크플로우 실행 CRITICAL 0 (review-* 영속).
[보고] 항목별 변경 파일 + 테스트 원문 + 미커밋 상태 명시.
```

### S2 — WS-0d 모드 정직성 (결재 #9 후)

```
[진입 조건 확인] MASTER_PLAN.md §6 결재 #9 체크 여부 + 채택 방식(2종 한정 노출 vs 비활성 표기)을 진산에게 확인받은 상태인가? 아니면 중단·보고.

[세션 목표] 학습 모드 5종 중 실동작 2종(weak/mixed)만 정직하게 노출(채택 방식대로). ADR-039 위반 상태의 사용자 노출 차단 — 기능 추가가 아니라 정직성 조치다.

[먼저 읽기] MASTER_PLAN.md WS-0d / 감사 보고서 learning-modes-3of5-no-filter 행 / apps/api/src/study/routes.ts:814-846(서빙 풀)·:1441-1448(available 카운트) / docs/adr ADR-039 / apps/web 모드 선택 UI 컴포넌트(grep으로 위치 확인)

[작업] 채택 방식 구현 + /mode 응답·UI 라벨이 실동작과 1:1 일치하도록. category/topic/confusion 모드의 백엔드 코드는 삭제하지 말 것(WS-5에서 배선 예정) — 노출만 제어.
[완료 게이트] E2E(또는 route 테스트): 노출 모드 목록 = 실필터 동작 모드 목록. 회귀 0. 4-Pass CRITICAL 0.
```

### S3 — WS-1 MC 채점 3중 모순 (결재 #2 후 — **정확성 1순위**)

```
[진입 조건 확인] MASTER_PLAN.md §6 결재 #2(answer 데이터형 계약: 라벨형 vs 텍스트형) 체크 여부 확인. 미결이면: production 기출 545의 answer 컬럼 실태 조사(진산 인증 1-쿼리 요청 또는 repo 적재 SQL 분석)를 수행해 PITR 1장(두 계약의 마이그 비용·위험 비교)을 상신하고 중단.

[세션 목표] 정답 안전 Hard Stop 결함 해소: 객관식 정답 표현 계약을 단일 정본으로 만들고 3경로를 통일한다. 이 작업이 끝나기 전 어떤 distractor BATCH 작업도 착수 금지다.

[먼저 읽기]
1. MASTER_PLAN.md WS-1 / 감사 보고서 mc-grading-answer-index-contradiction 행
2. 실코드 3경로 전체: apps/api/src/study/routes.ts:385-417(buildShuffledChoices)·:620-635(채점), packages/learning-modes/src/multiple-choice.ts:58-77, packages/learning-modes/src/shuffle.ts:80-100
3. 기출 적재 SQL의 answer 실데이터 형태(scripts/ 또는 migrations/ 내 INSERT 표본 grep)

[작업]
1. 채택된 계약을 명명된 타입+상수로 단일 모듈에 정의(@thepick/shared 또는 learning-modes — 의존 방향 검토 후, Hard Rule 15 위반 없는 위치).
2. 3경로가 전부 그 모듈을 import 하도록 통일. 변환(라벨↔index↔텍스트)은 한 곳에서만.
3. 결합 경로 테스트: 적재 형태 → buildShuffledChoices → 셔플 → 채점까지 end-to-end. 5지선다 정답 위치 1~5 전 순열 × 셔플 시드 ≥10 = 채점 100% 정합. 4지선다·"모두 고른 것" 유형 포함.
4. 기존 545 기출 호환: 실데이터 표본이 신 계약 파서를 통과함을 픽스처로 증명. 비호환 발견 시 즉시 중단·보고(데이터 마이그는 L3 별건).
5. distractor BATCH plan(docs/plans/phase3-learning-ux-modes.plan.md 7b 항)에 "본 계약 테스트 PASS = 선결 게이트" 1줄 삽입.

[금지] exam_questions 데이터 UPDATE(0038 화이트리스트 무관하게 본 세션 범위 밖) / 셔플 결정성(일자 시드) 의미 변경.
[완료 게이트] G1: 3경로 동일 모듈 import grep 증명. G2: 순열×시드 결합 테스트 PASS 원문. G3: 기존 데이터 호환 픽스처 PASS. G4: learning-modes+api 회귀 0. G5: 4-Pass CRITICAL 0.
[보고] 계약 채택 내용 ↔ 구현 1:1 대조표 포함.
```

### S4 — WS-2a/2c 무결성 러너 + QG-2 동기 (결재 #1 후)

```
[세션 목표] production 지식 그래프(794 노드/1274 엣지)의 누적 무결성을 기계 검증하는 read-only 러너를 만든다. production 쓰기 0. + QG-2 게이트 드리프트 수정.

[먼저 읽기] MASTER_PLAN.md WS-2 / 감사 보고서 RC-1 + cumulative-graph-integrity-machine-zero·navigability-gate-absent·qg2-gate-target-and-threshold-drift 행 / packages/quality/src/graph-integrity.ts(특히 validateGraphIntegrity DI 시그니처) / apps/batch/src/qg2-validator.ts:4-38,96-105,216 / migrations/0013·0014(SUPERSEDES·is_current_active 의미)

[작업]
1. scripts/run-graph-integrity-production.ts 신설: 입력 = D1 덤프(JSON/SQL — wrangler d1 execute --remote 출력 형식, 진산 인증 세션이 생성) 또는 로컬 재현 DB. 검증 = ①고아 노드 ②끊긴 엣지 ③SUPERSEDES 다단 순환(DFS — 0014:176-178이 위임한 그 검증) ④활성 엣지→비활성 노드 ⑤[신규] 항해성: inbound-only(outbound 0 + whitelist 엣지로 도달 불가) 노드 리스트.
2. 기지 양성 대조: CONCEPT-023(자기부담금, 연결 엣지 부재 확증 건)이 ⑤에서 검출되는 픽스처 테스트.
3. fabricate 차단: 덤프 파일 부재 시 명시 에러(가짜 PASS 금지) — assertRemote 패턴 준용.
4. QG-2 동기: qg2-validator.ts 헤더 주석을 코드 정본(40/80/7)에 일치 + batchId 파라미터 배선 + BATCH-6+ 누적 임계 정의(설계서 v1.1 대조 후 — 임계값 자체 변경은 결재 사안이므로 발견 시 보고만).
5. 정기 실행 경로 제안(CI cron vs 수동 프로토콜) 1장 — 결정은 진산.

[금지] production 쓰기 일체 / 마이그레이션 / 임계값 임의 변경.
[완료 게이트] G1: 러너가 합성 픽스처(정상/고아/순환/도달불가 4종)에서 정확 분류 테스트 PASS. G2: CONCEPT-023 기지 양성 검출. G3: 덤프 부재 시 명시 에러 테스트. G4: batch 패키지 회귀 0. G5: 4-Pass CRITICAL 0.
[보고] 러너 사용법(진산 인증 세션에서의 덤프 생성 명령 포함) 문서화.
```

### S5 — WS-2b knowledge_edges 가드 (L3 — 2단계)

```
[진입 조건 확인] 결재 #3(plan 착수 승인) 확인. 본 세션은 ①plan 작성까지가 기본 범위 — SQL 작성은 plan approved_by=진산 명시 후(같은 세션 내 승인이 와도 plan 문서에 결재 기록 먼저).

[세션 목표] knowledge_edges UPDATE/DELETE 차단 트리거 plan(docs/plans/knowledge-edges-guard.plan.md) 작성 → (승인 후) 마이그 작성.

[먼저 읽기] MASTER_PLAN.md WS-2b / 감사 보고서 knowledge-edges-temporal-guard-asymmetry 행 / 선례 전수: migrations/0003:66-71·0013:101-108·0014:34-53,105-121,181-200(nodes 가드 패턴) + 0038(화이트리스트 패턴) + docs/plans/tr-0-backend-c7-trigger-redesign.plan.md(L3 plan 형식·ADR-046 절차)
[plan 필수 내용] ①현 비대칭 증거 ②is_active 플립 화이트리스트 설계(SUPERSEDES 전이·revision 경로가 필요로 하는 합법 UPDATE 전수 조사 — draft-loader.ts:362-364·R-BATCH 기록 grep) ③Binary Gate(UPDATE ABORT + 플립 허용 + 기존 1274 엣지 무영향) ④롤백 ⑤결재란.
[주의] 합법 UPDATE 경로 전수 조사가 본 plan의 생명 — 0004 트리거가 related_nodes 백필을 막았던 TR-0 사고(전면 ABORT의 부작용)를 반복하지 말 것.
[완료 게이트] plan 영속 + (승인 시) 마이그 SQL + 테스트 선작성(G-TR0 패턴) + 4-Pass CRITICAL 0. 미승인 시 plan 상신으로 종료.
```

### S6 — WS-3a 드리프트 일괄 동기 (결재 #1 후)

```
[세션 목표] 진실원 드리프트 일괄 수리 — 코드 동작 변경 0, 문서·타입·주석·포인터만. stale 오염 재발 차단이 목적.

[먼저 읽기] MASTER_PLAN.md WS-3a / 감사 보고서 RC-5 + schema-ts-type-sot-drift·year2-migration-slot-pointer-rot·hybrid-fusion-absent-pipeline-doc-conflict 행

[작업 — 각 항목 실코드 재확인 후]
1. Year 2 슬롯 포인터 6곳(draft-loader.ts:36-38 / progress/routes.ts:104-116 일대 4곳 / .claude/rules/production-quality.md:102): 소진된 마이그 번호(0005/0017/0019) 참조를 "차기 가용 번호(작성 시점 확정)" 상대 표기로 전환.
2. apps/api/src/db/schema.ts: 헤더('14 tables') 실태 동기 + is_current_active·superseded_by 등 누락 컬럼 타입 선언 + batch_runs/review_decisions/review_queue 테이블 타입 추가. ※타입 전용 정본(NC-1) — DB 마이그 아님. 추가 타입이 raw SQL(approved-nodes-sql.ts:52 등)과 일치하는지 대조 테스트 1건.
3. CLAUDE.md: 스택 절("Drizzle ORM (D1 네이티브)"→"Drizzle = 타입 파생 전용(런타임 raw SQL)·D1 26테이블") + 명령어 절(루트 package.json turbo 스크립트 실재 반영) + 오프라인 동기화 캐비엇("PWA 캐싱만 구현, IndexedDB 동기화 미구현") — CLAUDE.md '현재 상태' 동기 의무 규칙에 따라 본 마스터 플랜 존재도 1줄 추가.
4. docs/architecture/SEARCH_PIPELINE.md: ADR-045 정합 개정(코드 위치 apps/api/src/search/ 정정·Concurrent Pipeline 서술·재귀CTE vow 3축) — 설계 의도 변경이 아니라 실태 기록임을 개정 이력에 명시.
5. docs/architecture/ARCHITECTURE.md: graph 라우트·eval harness·신규 테이블 반영 + '최종 수정' 갱신.

[금지] 동작 코드 변경 / feasibility·ceiling 본문(S7 별건) / 임계값 변경.
[완료 게이트] G1: 소진 번호를 미래 슬롯으로 가리키는 참조 grep 0건. G2: schema.ts 신규 타입 ↔ raw SQL 대조 테스트 PASS. G3: typecheck 전체 PASS. G4: 문서 diff 목록 보고(진산 일람용). G5: 4-Pass(문서 중심 — Pass 4 Contract 강조) CRITICAL 0.
```

### S7 — WS-3b/3c feasibility 갱신 + 산식 동기 장치 (결재 #5 후 / 3c는 L3 plan)

```
[진입 조건 확인] 결재 #5(feasibility/ceiling 갱신 승인) 확인. 3c는 L3 — plan 작성까지, formula-engine 코드 접촉은 승인 후.

[작업 A — G-1 권위 산출물 갱신(승인分)]
docs/feasibility/thepick.feasibility.md R3/R4 + docs/feasibility/ceiling.md 에 06-05 2차 실측 반영: baseline 83.3%(N=6, queryBody 정화)·graphOnlyRecovery 0 both·depth1 Δ0%/depth2 −20%·"1차 100%는 답안키 패딩 아티팩트" 정정. R5(GO/STOP)는 결정란만 — 채우는 것은 진산. 출처 = docs/plans/s5-6-measurements/s5-6-g-s5-2026-06-05-querybody-analysis.md.

[작업 B — 산식 동기 plan(docs/plans/formula-sync-manifest.plan.md)]
①코드 레지스트리 68(F-01~F-68) vs D1 formulas 157 차분 정밀 조사(가능 범위: repo 적재 SQL — production 라이브는 진산 인증 시) ②manifest 설계: engine-backed(계산 가능) / display-only(전시 전용) 구분 명문 ③equationTemplate ↔ D1 equation_template 문자열 대조 테스트 설계 ④supersededBy·ConstantsProvider 실구현은 2027 R-BATCH plan으로 명시 이월 ⑤Binary Gate·결재란.
[완료 게이트] feasibility/ceiling에 '83.3%·06-05' 반영 grep + R5 무단 기재 0 확인 / plan 영속 + 4-Pass CRITICAL 0.
```

### S8 — WS-4a/4c depth1 기본화 + 잣대 강화 (결재 #6 후, #7/#8 방향 확인)

```
[진입 조건 확인] 결재 #6(Phase 0a depth 2→1) 확인. #8(G-S5 본 결재) 결과에 따라 4c 범위가 달라지므로 결재 상태를 먼저 보고받아라.

[작업]
1. DEFAULT_MAX_DEPTH 2→1 (apps/api/src/search/graph-walk/index.ts:66 — 실라인 재확인). /api/search/graph 명시 maxDepth 파라미터 동작 불변.
2. 재측정: scripts/measure-s5-6-multihop-accuracy.ts --golden docs/plans/s5-6-measurements/golden-pilot-approved.querybody.json 으로 depth1 기본값 형상 재실측 — regression 0 유지 확인. 결과는 s5-6-measurements/에 일자 리포트로 영속(원문 수치 그대로 — 불리해도).
3. 잣대 강화 3종(#8 방향 허용 시):
   a. expandedNodes 디버그 노출 — graph-search-route 응답에 debug 플래그 한정 확장 전체집합(graph 채택 잣대에는 불산입 명시).
   b. golden 빌더 일반화 — build-querybody-golden.mjs RULES 하드코딩을 일반 분리기로(answer-leak assert 보존·기존 6문항 출력 바이트 동일성 회귀 테스트).
   c. query 500자 천장 — 측정 전용 우회(debug 플래그 + 측정 출처 한정) PITR 1장 후 구현(서빙 계약 변경은 별도 결재).
[금지] 랭킹 알고리즘 변경(Phase 1~2 = #8 결재 후 별건) / golden 원본 수정.
[완료 게이트] G1: depth1 재실측 리포트(regression 0). G2: 빌더 동일성 회귀 PASS. G3: expandedNodes가 Q-015 headroom 2노드의 미도달/랭크미달을 판별한 기록. G4: api 회귀 0 + 4-Pass CRITICAL 0.
```

### S9 — WS-5a/5c/5d 배선 1차 (결재 #1, #10 후)

```
[세션 목표] "계산되는 전시물" 해소 1차 — 모드 필터 실배선 + FSRS due 소비 경로 + weak_score 의미 확정.

[먼저 읽기] MASTER_PLAN.md WS-5 / 감사 보고서 RC-3 해당 행들 / apps/api/src/study/routes.ts:814-846(/next)·:1063-1070(weak_score) / packages/srs/src/types.ts:54-61 / apps/api/src/progress/routes.ts(/due) / ADR-039

[작업]
5a. /next 모드 WHERE 필터: category(subject 컬럼 — populate 여부 1-쿼리 선검증)·topic 배선. confusion은 데이터 NULL 상태이므로 S10 전까지 비활성 유지(S2 정직성 조치와 정합).
5c. /api/progress/due 소비자: web에 복습 큐 UI 1개(최소: due 카운트 + due 카드 우선 학습 진입). /study/next의 due 반영은 PITR 1장(즉시 반영 vs 별도 복습 모드) 상신 후.
5d. weak_score: 결재 #10 채택안대로 — (a) D2 정의 복원(과목 정답률+concept stability 집계 구현) 또는 (b) 정의 재정의. 어느 쪽이든 Silent Pivot 해소 ADR 작성(현 카드 단위 구현이 'D2 lock' 주석 하에 정의와 다름을 기록). 원천 데이터 영속 확인 → 재계산 가역성 명시.
[완료 게이트] G1: 모드별 /next 풀 = available 카운트 E2E. G2: due UI 노출 E2E(픽스처 유저). G3: weak_score ADR Accepted + 구현-정의 일치 테스트. G4: 회귀 0 + 4-Pass CRITICAL 0.
```

### S10 — WS-5b/5e confusion 영속 + 0038 적용·백필 (L3 + 진산 인증)

```
[진입 조건 확인] ①결재 #11(0038 production 적용 — 진산 인증 실행 또는 위임) ②5b L3 plan 승인 상태. 양쪽 미결이면 plan 상신까지만.

[작업]
5b-plan: confusion_level 영속 plan — draft-loader INSERT 컬럼 추가(draft-loader.ts:423-425)가 0014:84-85 트리거 차단 목록과 충돌하는 지점 정밀 분석 → 0038식 화이트리스트 재설계 vs Temporal INSERT 경로 PITR. 기지 양성(단감 1.0115/떫은감 0.9662 → danger) 게이트 포함.
5e(인증 가용 시): 0038 production 적용 → related_nodes 백필(golden-pilot-approved.json 출처, 기존 백필 SQL 초안 28c25f3 실코드 대조 후) → 근거보기 E2E(빈 citation → 실 citation 전환 확인). 모든 원격 명령은 실행 전 진산에게 명령문 그대로 보고.
[완료 게이트] plan 영속(+승인 시 구현) / 백필 후 SELECT 검증 원문 / citation E2E / 4-Pass CRITICAL 0.
```

### S11 — WS-6 생성층 진입 게이트 plan 일괄 (결재 #12/#13 후)

```
[세션 목표] Phase 2(생성) 착수 전 게이트 체계를 plan·ADR로 고정한다. 생성 엔진 코드는 1줄도 쓰지 않는다.

[작업 — 전부 문서·plan (L3 코드는 각 plan 승인 후 별도 세션)]
1. mnemonic_cards 게이트 plan: status CHECK + draft-only INSERT 트리거 + reverse_verified 게이트 설계(0002:41-52 현황 → 목표 상태, knowledge_nodes 3중 방어 패턴 준용).
2. exam_questions draft 표현 ADR: 결재 #12 채택안(CHECK 재정의=테이블 재생성 vs mock_exam_questions 별도 테이블) 구체 설계 + "AI 생성물이 exam_questions에 무게이트 적재되는 경로 0" Binary Gate.
3. Table-as-Micro-KG ADR: 소문자 supersedes 채널(0021:112-117) 처분 + 표→표 supersession 표현 + 표 벡터 433 검색 잠식(인덱스 분리 vs 필터) — 결재 #13 채택안 반영.
4. tables[] 봉합 구현(L2 — 이 세션 유일 코드): parseContractJson expectedKeys에 tables + 무음 폐기 경고 + draft-loader table_* 적재 경로(자동 파이프라인 승격 결재 전이므로 dry-run 테스트까지).
5. Phase 2 진입 체크리스트 문서: containment Layer2 validator 4종 + prompt injection + output PII 필터 + G-1 R1~R5 전수 = 생성 착수 선결 명문.
[완료 게이트] plan 2 + ADR 2 + 체크리스트 영속 / tables[] 봉합 테스트 PASS / batch 회귀 0 / 4-Pass CRITICAL 0.
```

---

## 4. 세션 횡단 운영 규칙

1. **세션당 1 WS 조각** — 컨텍스트가 길어지면 무리하게 이어가지 말고 handoff(.jjokjipge/) 작성 후 종료. 다음 세션이 handoff + 본 플레이북으로 재진입.
2. **결재 대기 발생 시**: 해당 항목만 보류하고 같은 세션의 무결재 항목을 계속한다. 결재 건은 PITR 1장(선택지+권고+근거)으로 압축 상신 — 지엽 결정은 올리지 않는다(기존 위임 원칙).
3. **막히면 (불가능 판명)**: 꼼수 금지. "불가능 + 대안 A/B/C" 보고 (CRITICAL RULE #5).
4. **같은 증상 fix 2회 실패** → zoom-out 의무 (root cause 재정의).
5. **각 세션 종료 시**: ①4-Pass review-\* 영속 ②테스트 원문 ③미커밋 파일 목록 ④마스터 플랜 §6 결재란 상태 변화 보고 ⑤다음 세션 진입 조건.
6. **본 플레이북 자체의 갱신**: 세션이 플레이북 가정(파일 위치·라인·결재 상태)과 실태의 괴리를 발견하면 본 문서를 직접 수정하고 수정 이력을 하단에 남긴다 (살아있는 운영 문서).

---

## 실행 기록 (세션별)

### S1 — WS-0 즉시 지혈 (2026-06-10, Opus 4.8 구현 / 자체검증 완료 · Fable 5 감사 대기)

**상태: 구현 완료 + self-verified. 독립 4-Pass 감사 = Fable 5 위임(진산 지시). 미커밋.**

| 항목                              | 결과 | 증거                                                                                                                                                                                                                                                                 |
| --------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0a CI 게이트 등록                 | ✅   | learning-modes(116)·srs(35) 를 `verify-engine-contracts.ts` VITEST_PACKAGES + `ci.yml` test 필터 동시 등록. 실측 카운트(116/35) 주입. verify 게이트 전체 **Overall PASS (7 PASS/0 FAIL/1 SKIP)**                                                                     |
| 0b srs→learning-modes 역의존 해소 | ✅   | `FsrsRating`/`FSRS_RATINGS` 를 learning-modes → **srs 로 이관**(plan §7.3:375 "learning-modes→srs 허용" 정합). srs/package.json learning-modes 의존 제거. 소비처 census 전수(srs 2 + apps/api 1) 재배선. api/srs/learning-modes typecheck clean, 카운트 불변(35/116) |
| 0c stub 기계 경고                 | ✅   | `KNOWN_STUB_PACKAGES` + `checkKnownStubsIntegrity()` 신설(Cat 7). study-material-generator 가 실구현 전환 시 FAIL → VITEST_PACKAGES 등록 + --passWithNoTests 제거 강제(silent PASS tripwire). 현 stub 상태 PASS                                                      |
| 0e 파서 계약 테스트               | ✅   | multihop-accuracy.test.ts +1(절단 비동치 잠금: parseRelatedNodes 무절단 vs enrichRelatedNodes RELATED_NODES_MAX=20). study/routes.test.ts +1(malformed related_nodes → 빈 surface route 바인딩). enrichRelatedNodes(L3 user path) **무수정**                         |
| 0f distractor 서빙 가드           | ✅   | buildShuffledChoices 에 normalizeAnswer 동치/중복 가드 추가 → 충돌 시 셔플 거부(fill_blank 강등) + index 쌍만 로깅(정답 원문 미노출). study/routes.test.ts +3(정답-distractor 동치/distractor 중복/정상 5보기)                                                       |

**검증 원문**: api `676 passed / 0 failed`(671+5, 회귀 0) · srs 35 · learning-modes 116 · multihop 17 · verify-engine-contracts **Overall PASS** · `pnpm -r lint` clean(변경분).

**⚠️ 발견(S1 범위 밖·기존 CI 블로커)**: `pnpm -r typecheck` 가 `apps/admin-web/src/components/GraphVisualizer.tsx:17` 에서 **기존 FAIL** — `Record<NodeType,string>` 색상맵이 NodeType 의 Table-KG 확장(TABLE/ROW_HEADER/COL_HEADER/CELL)을 미추종. **내 변경과 인과 무관 확정**(admin-web 의존 = @thepick/shared 뿐, 내 변경 패키지 import 0건, GraphVisualizer 마지막 커밋이 NodeType 확장 이전). RC-5 type-drift 클래스 = WS-3 후보 또는 즉시 trivial 수정 대상. **본 블로커가 미해소면 0a 의 CI test 게이트가 typecheck 단계에서 차단돼 실행 안 됨** → 진산 판단 필요(WS-3 병합 vs 즉시 색상 4종 추가).

**독립 리뷰(프로젝트 review-gate 훅 강제, 2026-06-10)**: 5-페르소나 병렬(Surgeon/Architect/Advocate/Contract/Debt) + 발견별 적대 반증 → `review-20260610-153259-s1-wd0-implementation.md`. **15 발견 → 4 확증 / 11 기각, Critical 0 / Major 0 / Minor 4, 판정 완료가능.** S1 변경분 자체 코드 결함 0. Minor 4 = ARCH-1(schema.ts FSRS_RATINGS 3중 사본·선재)·ARCH-3+DEBT-2(0c tripwire 비재귀 보강갭)·C-1(선세션 미커밋 잔여물 커밋 위생). **연관 2건 즉시 강화**: ① schema.ts:149 정본 교차참조 주석(srs 이관 반영) ② checkKnownStubsIntegrity `readdirSync` **재귀화**(서브디렉토리 우회 차단). 적용 후 재검증 = api 676/srs 35/learning-modes 116/verify Overall PASS 유지. (0034 마이그 주석 stale 는 **적용 마이그 불변 원칙**으로 미수정 — schema.ts 주석에 3번째 사본으로 문서화.)

**커밋 위생(C-1, 차단 아님)**: 커밋 시 `git add` 를 S1 세트(11파일)로 한정 — 선세션 미커밋 잔여물(`multihop-accuracy.ts` 코어=WS-4c 결재항목·`s5-6-g-s5-analysis.md`·sw.js·AuthForm·settings.json)과 물리 분리.

**다음**: Fable 5 독립 감사 → (통과 시) S4(WS-2a/2c 무결성 러너)·S6(WS-3a 드리프트 동기) 병행 가능(결재 #1만 의존).

## 수정 이력

- 2026-06-10 v1.0 최초 작성 (Fable 5, design-audit 기반)
- 2026-06-10 S1 실행 기록 추가 (Opus 4.8) — WS-0 5항목 구현·자체검증 완료, admin-web 기존 typecheck 블로커 발견 영속
