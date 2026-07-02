# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚧 G-1 REALITY GATE 규칙 (코드 1줄 전 — 최우선)

> **헌법:** VOID DEV UNIFIED CONSTITUTION v3.6 (`docs/consti/`). 이 프로젝트의 모든 새 기능·아이디어는
> 코드를 쓰기 전에 G-1을 통과해야 한다. G-1은 ACAP Stage -1(Deep Dive)보다도 앞에 온다.
> **현 적용 상태 (2026-05-30 소급 형식화, 프롬프트 C):** 상태 **C**(가장 성숙). 판정서
> `docs/feasibility/thepick.feasibility.md` + `ceiling.md`. **🟢 아키텍처(콘텐츠+산식+Vector RAG+FSRS)
> = 축소 GO·production 배포 완료 / 🔻 graph-walk 정답률 = R3 **측정완료**(2026-06-01 1차 + 06-05 2차 queryBody depth1·2).
> graph 순기여 0(graphOnlyRecovery 0 both·depth2 순손실 −20%·depth1 무익 0%) / **R5 GO/NO-GO 진산 대기**(단 "알고리즘 사망"은 시기상조: 재설계 미시도·N극소).
> 🔴 조각 0.** graph-walk 전체 GO는 G-S5 실측 후 진산 R5 결재.

### AI(너)가 반드시 지킬 것

1. **"가능합니다"는 금지어다.** 실현 가능성을 단언하지 마라. 형식: ①"업계 SOTA 천장은 [수치/출처]" ②"목표는 천장 [위/아래]" ③"측정 전이므로 추정 — Feasibility Spike 필요".
2. **목표에 절대 수식어**(자동/완전/범용/지배적/출판급/전문가급)가 있으면 → 즉시 멈추고 R1~R5 전수 요구 (TYPE-11 서식지).
3. **한 문장 목표를 그대로 받지 마라.** 최소 2개 축으로 분해해 조각별 판정. 묶음 통째 가능/불가 판정 금지.
4. **AI 자체 점수로 가능성 판정 금지.** Ground Truth 대비 정량 비교 + 인간 직접 소비만이 진실 (A등급 환각 재발 방지).
5. **R5(GO/STOP)는 인간이 결정한다.** 너는 🟢/🟡/🔴 사실만 못박는다. "할 가치"를 네가 결론짓지 마라.
6. **feasibility.md 없이 research.md를 쓰지 마라.** 현실 판정이 코드베이스 분석보다 먼저다.

### G-1 5관문 (산출물 영속 의무)

|         관문          | 행동                                             | 산출물                                      |
| :-------------------: | :----------------------------------------------- | :------------------------------------------ |
|    R1 SOTA Ceiling    | 외부 리서치로 업계 천장 조사                     | `docs/feasibility/ceiling.md`               |
| R2 Goal Decomposition | 목표를 난이도 축으로 분해                        | (ceiling.md 내) 분해 매트릭스               |
| R3 Feasibility Spike  | GT로 내 데이터에서 실측 (버려질 스파이크만 허용) | `docs/feasibility/spike-*.md`               |
|   R4 3-Tier Verdict   | 🟢/🟡/🔴 못박기                                  | `docs/feasibility/{project}.feasibility.md` |
|      R5 GO/STOP       | 인간 결정 대기                                   | (feasibility.md 내) 결정 기록               |

### G-1 자동 발동 조건

- 절대 수식어 존재 → R1~R5 전수 / AI·ML 출력 정확도가 비즈니스 핵심 → R1~R5 전수
- "전 업계 미해결"로 들리는 목표 → R3 실측 BLOCKER / 검증된 기술 조합(CRUD·표준 SaaS) → R1 약식(천장 자명, ceiling.md 1줄 근거)

### 절대 하지 말 것 (G-1 위반)

- ❌ 천장 미조사 채 "가능합니다"/"어렵지 않습니다" 단언 ❌ 한 문장 목표를 분해 없이 통째 추진
- ❌ feasibility.md 없이 plan.md/contract.yaml 작성 ❌ 🔴(불가) 조각에 미련(재정의 없이 우회) ❌ R5 결정을 AI가 대신 내림

### ★ 신규 Epic/Feature 적용 (형식화 이후)

- 본 소급 형식화는 _기존_ 방향의 약식이다. **신규 Epic/Feature 착수 시 R1~R5 전수**를 `docs/feasibility/`에 작성한 뒤 plan.md를 쓴다.
- hook 기계강제(블록 C/D, `docs/consti/G1_REALITY_GATE_CLAUDE_MD_BLOCK.md`)는 **전체 GO(R5) 후 + 기존 61 plan 금지어 오탐 점검 후** 설치 (현 husky/lint-staged 통합).

## 프로젝트 정의

**쪽집게(ThePick)** — 손해평가사 자격시험(1차+2차) AI 학습 서비스

- Graph RAG 기반 교재 835쪽 + 기출 ~581문항(7회분, 제5~11회) 구조화
- 룰 엔진 산식 연산 + 혼동 유형 자동 감지 + FSRS 간격반복

## 스택

- Frontend: Astro + React Islands + Tailwind CSS + shadcn/ui (PWA)
- State: Zustand + IndexedDB(Dexie — 로컬 영속 구현) (★오프라인: PWA 캐싱·IDB 로컬 영속까지 실재, **IDB↔D1 동기화만 미구현** — sw.js syncOfflineActions stub. RC-3 정직 표기 2026-06-11)
- Backend: Cloudflare Workers + Hono (Edge)
- ORM: Drizzle = **타입 파생 전용** (NC-1 — 런타임 쿼리는 raw prepared statement, drizzle-kit 금지)
- DB: Cloudflare D1 (**26 테이블** — schema.ts 헤더가 전수 목록 정본) + Vectorize (벡터 검색)
- AI: Claude API (Haiku 배치 구조화 + Vision OCR)
- Formula Engine: math.js AST 파서
- PDF: pdfplumber (Python subprocess)
- Test: Vitest + Playwright
- Lint: ESLint + Prettier + husky (lint-staged)
- 시각화: D3.js Force Graph

## 명령어

```
pnpm build / test / lint / typecheck   # turbo run (루트 package.json)
pnpm --filter @thepick/api deploy:staging|deploy:production  # api 배포 (deploy:api 루트 스크립트는 의도적 차단)
# web = wrangler pages 수동 배포 (Git 자동배포 없음)
pnpm g1:check                          # G-1 금지어 게이트
# 단일 패키지: pnpm --filter @thepick/<pkg> test
```

## 아키텍처

3계층 데이터: 정밀(constants DB) → 구조(Graph nodes/edges) → 맥락(Vectorize 임베딩)
7 Layer × 28 모듈: 수집(5) → 구조화(6) → 품질검증(3) → Core엔진(5) → 생성(5) → 학습서비스(3) → 관리자(1)
모노레포: apps/(web PWA, admin-web, api Workers, batch) + packages/(parser, parser-1st-exam, formula-engine, study-material-generator, quality)
상세: `docs/쪽집게(ThePick) — 구현 재정립서 v2.0.md` 참조
구현: `docs/쪽집게(ThePick) — 구현 설계서 및 개발 로드맵.md` 참조
★ 인프라 견고화 마스터 플랜(2026-06-10~, 진행 중): `docs/plans/master-remediation-20260610/MASTER_PLAN.md` (WS-0~7 + 확장 게이트 E0~E4 + 결재란 — 차세션 1차 참조)
아키텍처 다이어그램: `docs/architecture/ARCHITECTURE.md` 참조 (Mermaid DaC — 시스템 조감도, 데이터 흐름, 의존관계, 배치 파이프라인, 오프라인 동기화, Hexagonal 규칙)

## 상용 품질 원칙 (★ 최우선)

이 서비스는 상용 출시를 목표한다. "당장 돌아가는 코드"가 아닌 "10K 유저, 매년 개정, 다른 시험 확장에서도 버티는 코드"를 작성한다.

- any 타입 금지 → 정확한 타입/제네릭
- 하드코딩 금지 → Constants DB 또는 명명된 상수
- 인메모리 임시 저장 금지 → D1/IndexedDB 영구 경로
- TODO/HACK 주석 금지 → 즉시 구현 or 기획 보고
- 빈 catch 금지 → 에러 로깅 + 전파/폴백
- `import *` 금지 → 선택적 임포트 (번들 최적화)
- 테스트 없이 완료 금지 → Golden Test 포함
- 상세: `.claude/rules/production-quality.md`
- Hook: `quality-gate.sh`가 any/console.log/빈catch/TODO 자동 감지

## Hard Limit (절대 제약)

- `.env*` 파일 커밋 금지
- Guide/ 디렉토리 수정 금지 (하네스 원본 문서)
- knowledge_nodes, formulas 테이블 UPDATE 금지 (개정 시 신규 노드 + SUPERSEDES 엣지)
- LLM에게 수식 계산 절대 금지 (Formula Engine AST 파서로만)
- 동적 코드 실행 금지 (equation_template 포함)
- Constants는 DB 쿼리로만 조회 (LLM 추론 금지)
- Ontology Lock: ontology-registry.json 외 ID 생성 금지
- AI 생성 데이터는 draft 상태로만 적재 (인간 검수 후 approved)
- BATCH 순차 실행 (전 배치 검증 없이 다음 배치 금지)
- 농학 미출제 영역 명시적 라벨링 필수
- shared 노드 수정 시 1차/2차 양쪽 검토
- 암기법 역방향 검증 실패 시 폐기 (두문자어→원래 항목 복원)

## L3 영역 (plan 필수 + 인간 승인 후 코딩)

- `packages/formula-engine/` — 산식 연산 (계산 오류 = 서비스 사망)
- `**/constants*` — 매직 넘버 (65%를 60%로 잘못 입력 = 서비스 사망)
- `**/ontology-registry*` — 허용 ID 목록
- DB 스키마 변경 (마이그레이션)
- 사용자 데이터 처리 (user_progress)

## 린터 강제 사항

(ESLint + Prettier 도입 시 업데이트)

## 현재 상태 (2026-05-29 기준 — 3축 분리 + Phase 2 기술부채 통합)

> ⚠️ 본 섹션은 2026-04-16~2026-05-15 약 1개월 stale였고, 그 사이 G-AUDIT 외부 검토
> 체인의 거짓 전제 2건(CRIT-2/3)을 유발한 단일 오염원이었다. 갱신 경위·검증:
> `docs/Graph_RAG+Graph_Walk/REMEDIATION 타당성 검증 — Claude Code 실코드 대조 v1.0.md`.
> **이 섹션은 handoff/WBS 갱신 시 동기 의무 (오염 재발 방지).**
>
> ★ **2026-05-29 갱신 (Session 092)**: 5-페르소나 독립 병렬 기술부채 리뷰
> 완료 (CRITICAL 27 / MAJOR 32 / MINOR 21). 통합 인덱스
> `.claude/reviews/phase2-tech-debt-20260529-INDEX.md` 영속. 진산 결재
> Q1~Q4 채택 + TR-0~TR-4 권고 액션 매트릭스. **즉시 차단선 발견**:
> backend C-7 `prevent_exam_questions_update` 트리거가 `related_nodes`
> 백필 ABORT → 진산 검수 완료해도 approved 동결 불가. TR-0 plan 작성 완료
> (`docs/plans/tr-0-backend-c7-trigger-redesign.plan.md`), 마이그 0038
> 코드 = 인간 승인 후 진행. 상세: [[project_phase2_tech_debt_review_20260529]].
>
> ★ **2026-05-29 갱신 (Session 093)**: 이중 게이트 **TR-0 측 대폭 진전**
> (전부 가역·미커밋·production 미접촉, 진산 "권고대로 진행" 승인 하). (1) **재사용 워크플로우
> 2종 영속** `.claude/workflows/{4pass-review,5persona-debt}.js` (의무 리뷰 프로토콜 실행 도구).
> (2) **이중 게이트 사전심사** 실행(`review-20260529-133629-dual-gate-prescreen.md`) =
> golden 12 APPROVE 7/FIX 5/순환위반 0 + TR-0 plan 만장일치 A안·CRITICAL 6 식별. (3) **TR-0
> plan 정정**: §2 exam_questions **22컬럼 4분류**(confusionType/calcVariables 누락 해소) +
> "0008 status 트리거" **유령 참조 제거**(실코드 대조: 0008=webhook_events, 0010 CHECK
> exam_question 미커버, status 영구 동결) + §2.1 진산 결재 **D-1 default-deny / D-2 status
> ABORT / D-3 calc_variables 본문급** + §5.1 G-TR0-6~12. (4) **ADR-046 Draft** 작성(22컬럼
> 동결 + D-1~3 + D-6 distractor OPEN). (5) **마이그 0038 SQL + G-TR0-1~12 테스트 선작성·검증**
> (28 PASS / api 671 회귀 0 / 4-Pass CRITICAL 0 `review-20260529-213954`). (6) **기획 대비
> 진척 평가** `docs/plans/roadmap-milestone-progress-20260529.md` (전체 ≈64% / production-ready
> 58~64%, 독립 오버클레임 감사 PASS, P0 95/P1 62/P2 48/P3 30/Y2 5·0·0). **잔여 진산 게이트 3**:
> ① plan formal 결재 + ADR-046 Accepted(선작성본 sign-off) ② D-4 distractor 결재(ADR §D-6)
> ③ production 적용(wrangler --remote) → backfill → G-S5 측정. 게이트 B golden 12 검수는 사전심사
> 권고 적용 가능. 상세: `.jjokjipge/handoff-session-094.md` + `phase2-tech-debt-workflow.md` §6.
>
> ★ **2026-05-30 갱신 (Session 094)**: (1) **VOID DEV 헌법 v3.6 G-1 Reality Gate 소급
> 형식화** (프롬프트 C) — 상태 C, `docs/feasibility/{thepick.feasibility,ceiling}.md`
> (split-verdict: 🟢 아키텍처 축소GO·배포완료 / 🟡 graph-walk 정답률 R3 **BLOCKED**=기존
> G-S5 동일물 / 🔴 0, fabricate 0) + CLAUDE.md 상단 G-1 블록(최우선) + **기계강제 hook**
> (`scripts/g1-forbidden-phrase.mjs` added-lines 스캔·execFileSync + husky + CI
> `g1-gate.yml`, 5/5+E2E 검증, 레거시 61 plan 영향 0 — "범용" 제외·added-lines 로 헌법
> 예시 개선). 커밋 `2a4aaa8`. (2) **TR-0 게이트 #1 결재 완료** = plan `approved_by=진산`
> (2026-05-30 "다음 진행") + ADR-046 **Accepted**. 마이그 0038 번들 커밋 `ecd375e`
> (선작성본 → formal sign-off, schema.ts/test/4-Pass 동봉). (3) **게이트 B golden 검수 완료**
> = `golden-pilot-approved.json` 동결(APPROVE 7+FIX 5/순환위반 0, 노드 코퍼스 488 실재검증,
> expected평균 1.57→2.71). 커밋 `180d986`. (4) **게이트 #2(D-4 distractor) 결재 = (a) SUPERSEDES**
> (ADR §D-6 OPEN 해소, 0038 불변·7c 직접UPDATE→SUPERSEDES 재설계 의무). 커밋 6개 push 완료.
> ⇒ **잔여 진산 게이트 = #3 단 하나**: production 적용(`wrangler --remote`, 진산 Cloudflare
> 인증, **미수행**) → 0038 적용 → related_nodes backfill(approved.json) → G-S5 측정(북극성).
> 상세 [[project_phase2_tech_debt_review_20260529]].
>
> ★ **2026-06-01 갱신 (Session 096) — 북극성 G-S5 1차 실측 완료**: 진산 위임 하 Claude 가
> production Worker 재배포(`wrangler deploy --env production`, Version `07b5f47d` — graph 라우트
> S5-3 가 2026-05-10 빌드에 미포함 → `/api/search/graph` 404였음. `/api/search` 불변·additive,
> api 671 PASS 회귀 0) 후 **G-S5 측정 실행**. **측정 ≠ DB 백필 의존**(runner 가 golden 파일
> relatedNodesRaw 직접 채점 + `/api/search/graph` vector+graph-walk 결과만) → 0038/백필 없이 측정
> (게이트 #3 의 마이그·백필은 여전히 미수행·진산 전용). **발견: graph route query max 500자**
> (graph-search-route.ts:79) → golden measurable 7 중 3건(Q-004/014/015 2차 서술형) 400 거부 →
> **진산 결재(2026-06-01) "초과 3건 제외, measurable 4건만 측정"**(subset `golden-pilot-approved.query-le500.json`,
> 원본 불변). **결과(절단제외 measured=3 / 전체 4): graphOnlyRecovery 0 · regression 1(Q-012) ·
> hit-rate Δ −33%(절단제외)~−25%(전체) = baseline 미달.** raw 적대검증: graph 확장이 Formula 노드
> (F-xx) 과다 유입(expandedNodeCount 6~53)으로 정답 축출(Q-012 = baseline 회수한 INV-035 를 top5 밖
> 으로). **§7 NO-GO 방향**(S5-7 §7.1~7.3 진산 결재 대기: NO-GO 확정 권고 / CONDITIONAL 재측정).
> ★ baseline(vector) hit-rate **100%** = 🟢 Vector RAG 바닥 실측 재확인. 한계: N=4 신호(통계
> 일반화 아님)·손해평가 도메인·현 graph 파라미터(maxDepth2/whitelist12) 기준 "순손실"(알고리즘
> 사망 단정 아님). feasibility R3 측정완료·R5 §7.3 대기 / ceiling R1·R2 graph-walk 행 🟡→🔻 갱신.
> 분석 `docs/plans/s5-6-measurements/s5-6-g-s5-analysis.md` + 리포트 `s5-6-remote-g-s5-2026-06-01-1242.md`.
> 상세 [[project_s5_6_eval_measurement_gate]]. (백필 SQL 초안 `28c25f3` 은 학습자 경로용·미실행 유지.)
>
> ★ **2026-06-02 갱신 (Session 096 후속) — G-S5 NO-GO "시기상조"로 교정 (5-페르소나 적대 감사)**:
> 진산 통찰("정확성 검증 ③층=판단·방법론은 사람이 어렵다, AI 다각 페르소나가 객관 검토 낫다")로
> 코드용 4-Pass/5-페르소나 패턴을 **콘텐츠·측정 정확성 층에 첫 적용**(워크플로우 5 독립 페르소나:
> 손해평가실무/RAG엔지니어/측정과학자/순환편향감사관/적대통계가 + 종합). **메타판정 = NO-GO
> 시기상조**(4 PREMATURE+1 SOUND한정). 결정적: (1) 유일 regression(Q-012)이 **maxDepth=1 로 가역**
> (메인 production raw 직접 재현: depth2 INV-035 축출 → depth1 rank3 유지) = `truthWeight 1차정렬×
score=0 병합` 튜닝 아티팩트, 알고리즘 한계 아님. (2) graph **유효표본 N=1**(measurable 4 중 3건
> 단일-hop LAW; graph 빛날 multi-hop 3건 Q-004/014/015 는 query>500 답안키 패딩으로 제외 = 표적 75%
> 빠짐). (3) baseline 100% 도 부분 아티팩트(생존편향+golden 명칭대조=vector 친화). ⇒ **1차 단독
> NO-GO 보고가 과잉 일반화였음 — 다각 감사가 교정**(진산 통찰 직접 입증). 순환편향 = 채점단계 코드차단
> 확인, 잔여=표적정의층(진산 검수가 차단막). **진산 결재 큐 7항**(절대값 임계 사용 여부 / 답안키-본문
> 분리 정책 / graph 재설계 (a)hop감쇠 (b)truthWeight우선권제거 / §7 임계규칙 N≥30 한정 / 등) +
> **AI 후속 7항**(maxDepth1 전수재측정 / 답안키제거 스크립트 / expandedNodes surface / timeout 정량 /
> mean-recall headline / 등 = 메인 자율 처리, 진산 부담 0). 감사 영속 `g-s5-multipersona-audit-20260602.md`.
> feasibility R3/R4/R5 + ceiling + S5-7 §7 전부 "NO-GO 시기상조"로 정정. 재사용 프로토콜
> `content-accuracy-audit` 신설 가치. 상세 [[project_s5_6_eval_measurement_gate]] + [[feedback_multipersona_accuracy_audit]].
>
> ★ **2026-06-05 갱신 (Session 097~098) — 북극성 G-S5 2차 실측 완료 (queryBody 정화·미커밋)**:
> (1) **진산 결재 #2 (2026-06-04)**: golden query = 출제 본문만(발문+보기+빈칸+자료표), 정답값·중복정답표·해설
> 제외(A안+자료표 포함). → 06-02 감사가 못박은 "답안키 패딩 → query>500 → graph 표적 multi-hop 75% 제외
> (유효표본 N=1)" 해소. 결재카드 `decision-card-q2-querybody-separation.md`. (2) **queryBody 파생**:
> `build-querybody-golden.mjs`(제거전용·결정적·answer-leak assert) → `golden-pilot-approved.querybody.json`
> (measurable **4→6** 회복: Q-014 501→270·Q-015 922→398 / Q-004 583자 미회복 정직제외). 원본 golden 불변,
> graph 유효 multi-hop 표본 **1→3**. (3) ★ **G-S5 2차 REMOTE 실측 (2026-06-05, production
> `/api/search/graph` 공개 무인증, maxDepth 1·2 양측)**: **depth1 = hit-rate Δ 0.0%(83.3→83.3)·recall
> −2.4%·graphOnlyRecovery 0·regression 0 = 무해·무익** / **depth2 = hit-rate Δ −20.0%(80→60 절단제외)·
> recall −6.9%·graphOnlyRecovery 0·regression 1(Q-012) = 순손실**(depth2 F-노드 범람 → INV-035 축출).
> (4) **06-02 감사 3대 가설 전부 실측 확증**: ①Q-012 regression=depth2 아티팩트(depth1 regression 0)
> ②유효표본 N=1→3 ③baseline 100%→**83.3%**(명칭-동형 아티팩트 부분확증 — 1차 "🟢 Vector RAG 100%"
> 서술은 stale, 정화 baseline 83.3% 가 진실). (5) **전제 정정**: "측정 = 진산 Cloudflare 인증 게이트" =
> 실코드 반증(`/api/search/graph` 공개 무인증, index.ts:54·123-126 / 인증은 배포·D1 추출 전용). G-S5 측정은
> golden 파일 직접 채점 = related_nodes 백필·TR-0 trigger 와 무관(별건, study 경로용). ⇒ **결론: 🟢 vector
> baseline 작동(83.3%) / 🔻 graph 현 파라미터 순손실(depth2)~무익(depth1)·graphOnlyRecovery 0 both /
> 🟡 "알고리즘 사망" 단정 시기상조**(진짜 graph-only headroom 2노드=CONCEPT-023·INS-27 전부 Q-015 단일
> 문항, 재설계 미시도). **CONCEPT-023(자기부담금)은 batch 1274 엣지 직접검증=연결 엣지 부재 = graph 영구
> 도달 불가(데이터 천장, BATCH 보강 외 해법 없음)**. (6) **재설계 plan** `graph-walk-s5-8-redesign.plan.md`
> (DRAFT·L3): 4 실패기전 + Phase 0a(depth1 기본화)~0b(golden N≥20~30 확대)~1(보수 algo)~2(ADR 랭킹)~
> 3(BATCH 엣지) + PITR + Binary Gate G-R-1~6 + §9 진산 결재란 6항 **전부 미체크**. 코드 착수 = 진산 결재 후
> (자율 금지). (7) **독립 검증 2회**: `review-20260604-145408`(queryBody 무결성 C0/M0/MINOR6) +
> `review-20260606-082005`(변경셋 4-Pass C0/**M1**/MINOR8). eval 코어 22 PASS 회귀 0. MAJOR-1 = AuthForm
> 테스트 자동로그인 평문 번들 인라인(런칭 차단 [[project_test_autologin_launch_blocker]], 런칭 스프린트 이연).
> ⚠️ **진산 결재 대기**: G-S5 GO/NO-GO(RULE #5, S5-8 §9 6옵션) + 감사 §4 결재 큐 잔여 6항. ⚠️ **Session
> 097~098 + 06-05 측정 산출물 전부 미커밋**(마지막 커밋 33f0387, 라이브 `/status/`만 커밋). feasibility
> R3=측정완료 / R4·R5=진산 대기. 상세 [[project_s5_6_eval_measurement_gate]] + [[project_g_s5_golden_data_gap]].

> ★ **2026-06-12 갱신 (셧다운 복귀 세션) — 자율 가능 작업 일괄 집행 (미커밋, 진산 검수·결재 대기)**:
> (1) **결재 #7 집행 완료** — S5-8 plan §3 Phase 1-D(D안: graph 동결+lexical fusion)·§4·§7·§9 등재
> (독립 검증 2회 FAIL 0, 구현 착수는 §9 별도 체크). (2) **결재 카드 9종 상신** — #3·#4·#10·#12·#13·
> #18·#19 PITR 카드 + **#22 신설**(Phase B 진입, 이행 누락이던 상신 의무 해소) + Track B 검수 안내
> 카드(`e0-2-track-b-review-card.md`, 정밀 집계 24 = B-1 2·B-2 12·B-3 9·C 1). 전부 MASTER_PLAN §6
> 결재란에 링크, 18 에이전트 드래프트+적대검증. (3) **E0-8 사전 자료** `docs/audit/e0-8-prestage-d1-
inventory-20260612.md` — 무결성 러너 재실행(고아 24 그대로·유령 0 유지) + 정본 approved 488/draft
> 306 + ★페이지축 발견: book_page 는 chapter 별 자체 축(교재 본문 p394~696 권역) — E0-8 대조는 출처
> 묶음 단위 매핑 필수. (4) **WS-5a/5c 배선 완료 (S9, [L2] 결재 #1 위임)** — category 모드 배선(/mode/
> start subject 검증 + /next WHERE 필터 + categorySubjects + web 과목 픽커). ★**topic 미배선 잔류**:
> production 실측 topic_cluster **0/534** → 배선 시 전 풀 공허(스키마≠populate, 기획 'category·topic'
> 대비 축소 — 보고 사항). due 복습 큐 위젯(DueQueue, /api/progress/due 첫 소비자) + `/study/next` due
> 반영 PITR 상신(`ws-5c-study-next-due-pitr.md` 권고 C). 4-Pass C0/M5→전부 해소(`review-20260612-
141347`) + 5-페르소나 C0/M4→전부 해소(`review-20260612-5persona-ws5a5c.md`: category 와이어 e2e
> `category-start.spec` + progress read rate-limit 60/min + **G1 게이트 = category available 을
> subject NOT NULL 풀로 정합 + 통합 테스트 충족(API 수준 — 브라우저 수준은 mock /next 모드 무시
> 한계, 부채 기록)). (4b) **WS-3c 산식 동기 plan 작성 완료** (2026-06-13, L3 plan까지만·코드 무접촉,
> 진입 결재 #5 ☑): `docs/plans/formula-sync-manifest.plan.md`. 실측 — 코드 68=formula-engine
> batch1~5-definitions.ts F-01~F-68(math.js AST·동적실행 throwing stub 차단) / D1 157 중 **89건
> (F-69~F-157 등)은 코드 미등록=계산 불가=display-only** / equation_display·expected_inputs·
> graceful_degradation 0/157(loader INSERT 제외) / RC-5 5중 보관처 file:line 확정 / 런타임 계산
> 소비자 0(학습자 미배선)·QG-2 는 code calculate(D1 안 읽음). PITR+G-WS3c-1~6+§9 결재 6항(★89건
> display-only 분류=검증 영구부재 명문화 RULE#5 / F-55 TODO 처분 / 정규화 모듈 경로). 독립 사실검증
> FAIL 0. **코드 착수 = §9 결재 후**. (5) **선재 결함 3건 발견·수리**(전부 HEAD red 재현으로 선재 확증): ① eval local-smoke 가
> Phase 0a depth1 기본화로 파손(픽스처 maxDepth:2 명시 복원) ② **web E2E 전체 15건이 S2(wired 도입)
> 부터 파손**(mock 픽스처 wired 미갱신 — 수리 후 19/19 PASS) ③ **/api/progress/due 당일 due 무음 누락**
> (ISO 'T' vs datetime('now') ' ' 바이트 비교 — ISO bind 통일+회귀 가드). 검증: api **694** PASS/web
> 31/E2E **19\*\*/typecheck·lint·G-1 PASS. ⚠️ 커밋 = 진산 지시 대기(플레이북 §1.9).

> ★ **2026-07-02 갱신 (재개 세션, Fable 5) — 3주 휴면 복귀 + ★E0-8 역감사 집행 완료**: (1) 워킹트리
> 무회귀 green 실측(api 695/web 31/E2E 20 — Playwright 브라우저 재설치 후/typecheck·lint 17/17/g1 PASS)
>
> - **06-12/13 산출물 43파일 로컬 커밋 8건 집행**(진산 "진행" 지시. push = #14 보류 유지). (2) **서비스
>   완성 로드맵 v2** `docs/plans/ROADMAP_TO_SERVICE_20260702.md` (06-11 완료 로드맵 후속 정본 — 현황 실측
>   §0~1 + 결재 큐 통합 §2 + R0~R6 실행 시퀀스. 독립 3렌즈 적대검증 C0/M0/MINOR3 정정 반영). (3) ★**E0-8
>   콘텐츠 커버리지 역감사 집행 완료 (결재 #21 이행)** — 23 에이전트(매핑 11+독립 적대검증 11+SQL↔D1
>   교차검산 1). D1 신선 덤프(07-02 SELECT-only: 794/1274/545/157/193 = 06-12 스냅샷 완전 일치, 휴면 중
>   production 무변경 확증) × 출처 PDF 21종 전문 추출(교재 835p·법령 3·개정 2·기출 14). 산출:
>   `docs/audit/content-coverage-20260702.md`(본 리포트) + `content-coverage-inventory-20260702.md`(검수용
>   전수 매핑표 — **571 출처단위 / 적재 356 / 미적재 146**). ★핵심 발견: ① **교재 1권 전체 미적재**(p1~389
>   장 5개 — 2차 1과목 출제영역 §1~4와 절 단위 1:1, 제3장 단독 252쪽) ② 부록 손해평가요령 전문·운영규정·
>   목적물고시 미적재(1차 출제영역 직결) ③ 법령 본체 조문 22 누락(법률 제8조·제11조/시행령 12/상법 8)
>   ④ 교재 2권 권역 내 실질 누락 ~25(적과전 감수과실수 산출 사슬 8건 포함 — 2차 계산형 직격) ⑤ **무음
>   skip 0**(로컬 SQL 3,011행↔D1 완전 정합 — 문제는 적재 실패가 아니라 미스케줄) ⑥ 부수: 라벨·앵커 오류
>   의심 노드 7건(CONCEPT-109·F-118·F-123/124·LAW-064·INV-086·LAW-138) + 미시행 개정(2026.8.15) 선반영
>   노드 4건(시행시점 축 부재). ⚠️ **잔여 = 갭 처분 결재**(리포트 §2 A~D군: A 보강 후보 5군/B 스코프 제외
>   확정 3군/C 자료 한계 2군/D 데이터 수리 11노드) → 결재 시 E0-8 ✓ = M1 출구. 결재 카드 §2A 10건 +
>   Track B 고아 24 검수 + S5-8 §9 0b·WS-3c §9는 **여전히 진산 대기** (로드맵 v2 §2 통합표 참조).

> ★ **2026-07-02 갱신 2 (동일 세션) — 일괄 결재 집행 완료**: 진산 "결재 카드 전부 권고대로 진행" →
> (1) 결재 기록 커밋 `3adb10a`: #3·#4·#10·#12·#13·#18·#19·#22 + WS-5c(C) + S5-8 §9 0b ☑ + WS-3c §9
> ①②③⑥ ☑ (**잔존**: WS-3c ④89건 분류·⑤F-55 / #14 push / Track B 검수 / E0-8 갭 처분 A~D군 / 감사
> §4 #5·#7). (2) **집행 7건 완료**: #19 QG-2 fail-closed(89/95×6) / #13 표벡터 433 필터+**ADR-047**+4c
> 잣대강화(expandedNodes 디버그·query 500→2000 debug 한정) / #10 weak_score D2 복원 1단계(α=subject
> 집계)+**ADR-048** / WS-3c manifest 3층 / #4 **ADR-014 Amended**(C 축소) / #3 WS-2b 엣지가드 L3
> plan(슬롯 0039, SQL 0줄·§8 결재 대기) / #12 Phase2 진입 체크리스트+WS-6c mock plan(슬롯 0040, §7
> 결재 대기). (3) ★★**WS-3c 첫 실행 실측 = 산식 선재 드리프트 55건**: 코드 레지스트리 F-14~F-68 이
> BATCH-2~5 적재물과 **ID 배정부터 계보 분화**(예: D1 F-68=마늘 표준피해율 vs 코드 F-68=무화과
> 잔여수확량비율. 일치 = F-01~13 뿐). G-WS3c-4 FAIL 정직 보고 + 워터마크 테스트 고정 — **진실원 방향
> (코드 수정 vs D1 재적재) = 신규 L3 결재 상신**(RC-5 리스크 실물 확인. 완화: 런타임 계산 소비자 0 =
> 학습자 영향 현재 0). 리포트 `g-ws3-formula-sync/formula-sync-2026-07-02*`. (4) **5-페르소나 독립
> 리뷰 + 적대 반증 15에이전트**: C0/**M10**(기각 0) → 전건 즉시 수정(골든 빌더 과제거 fail-loud 가드
> 3종·G-WS4② 테스트 pnpm test+CI 배선·러너 --debug+debug 측정파일(Q-004 포함)·0039/0040 슬롯 충돌
> 해소·레지스트리 동치 고정 테스트) + MINOR 15 처분 기록(`review-20260702-133800-5persona-*`).
> (5) **E0-8 갭 보강 Sonnet급 플레이북 v1.0** `docs/plans/e0-8-gap-remediation-sonnet-playbook.md`
> (P1~P6 패키지·G-GAP-1~7·에스컬레이션 7규칙·§8 결재란 — 파일럿 FIX율 게이트 시퀀스). 검증: turbo
> 17/17+scripts 13/13·api 711·batch 332·quality 85·E2E 20/20·typecheck·lint 全green. 세션 커밋 계
> 20건(로컬 — push = #14 보류). **다음**: S5-8 0b golden N≥20~30 확대 draft(잣대 도구 게이트 完) +
> 진산 잔여 결재(위 잔존 + WS-2b §8·WS-6c §7·★55건 진실원 방향).

> ★ **2026-07-02 갱신 3 (동일 세션) — 0b golden 확대 draft + 드리프트 크로스워크**: 진산 지시(0b 착수 +
> 드리프트 진실원 "승인 진행" + Sonnet 플레이북 P1 착수) 집행 — 워크플로우 39에이전트(선정 1+라벨 8+
> 적대검증 8 / 크로스워크 매칭 11+적대검증 11). (1) **golden 확대 draft**: 신규 22문항(2차 9+1차 법령 13,
> multi 20/single 2, 회차 7개 전부 커버) 라벨+증거 인용, 검증 APPROVE 21/FIX 1 반영 — **N=34 (pilot 12+22)**.
> `s5-6-measurements/golden-expansion-draft-20260702.{json,md}` = **진산 검수 대기** (행당 수초 검수표).
> 코퍼스 한계로 상법·재배학·가축·보험료 축 제외 정직 기록. (2) **드리프트 크로스워크**: 순열 0 실측 →
> **이원 정본 확정**(ID 정본=D1·계산 정본=코드) + 매핑층 `g-ws3-formula-sync/formula-crosswalk-20260702`
> — same 19 / **variant 24(계수·조건 차이 실재 — 교재 원문 대조 후속 큐, 65↔60 클래스 후보)** / none 12
> (D1 미적재분 — E0-8 A-4 교차 검토). (3) Sonnet 플레이북 §8 **P1 ☑**(진산 발화). ⚠️ 다음: ① 진산 golden
> draft 검수 → 병합 동결 → queryBody 파생 → 재측정(E0-4) ② variant 24 교재 대조 ③ Sonnet 세션 P1 실행.

> ★ **2026-07-02 갱신 4 (동일 세션, Opus 4.8) — E0-8 갭 보강 P1 실행 + production draft 적재 완료**:
> 진산 지시로 P1(법령 본체 조문 22)을 Opus 가 직접 실행(핸드오프는 Sonnet 설계였으나 진산이 Opus 세션
> 지정). (1) **계획 검토 중 결함 발견·결재**: 법률 제8·11조가 이미 approved(실측 draft) 노드 LAW-001/002
> (교재 개관장 요약본)로 존재 → 진산 **A안** 결재 = 법령 원문 노드 신규 + CROSS_REF(중복 아님·UPDATE 아님).
> (2) **산출**: `docs/batch-load/gap-P1/` insert.sql(22노드 LAW-144~165 + 28엣지 draft) + knowledge-graph.json
> (SQL 파생) + review-sheet + 재현 스크립트 3. (3) **검증 3중**: 로컬 G-GAP-1·2·5·6·7pre + quality 86 +
> 내부 적대검증(PDF 재추출 3에이전트) **CRITICAL 0** + **step7 독립리뷰**(3+종합, `review-20260702-165005-
gap-P1.md`) **CRITICAL 0 / MAJOR 1(게이트 증거 과대분모=정정완료) / MINOR 4**. (4) **production 적재**
> (진산 게이트 이행): `wrangler d1 execute --file --remote` → 카운트 검산 **정확 +22/+28** = knowledge_nodes
> **794→816** / knowledge_edges **1274→1302**, status='draft' 22/22. **무결성 러너: P1 신규 위반 0**(신규 노드
> 고아 0·끊김 0·순환 0·신규 28엣지 전부 활성) — 게이트 E0-2 는 **선재 24-고아 debt**(WS-2a 별도 트랙)로
> FAIL 유지(P1 무관·delta 0). (5) **커밋·푸시**: `0b9baec` push 완료(#14 push 보류 = 진산 지시로 해제).
> ⚠️ **잔여**: draft→approved 전이 = 진산 검수(`gap-P1-review-sheet.md` 행당) / P2~P6 = P1 FIX율 게이트 후
> (Opus 실행이라 Sonnet 프록시 아님) / approved 승급 전 정책 2건(상법 book_page 축·미시행 개정 시행시점 축).
> 상세 [[project_content_coverage_audit_20260615]] + batch-loadmap "E0-8 갭 보강 적재 이력".

> ★ **2026-07-03 갱신 (동일 세션, Opus 4.8) — E0-8 갭 보강 P2 실행 + production draft 적재 완료**:
> 진산 "P2 착수" + **override 결재**(P1 검수 FIX율 게이트 명시 생략 = 불변규칙 #5 예외 명문화, 근거 = P1
> 독립 적대검증 2회 CRITICAL 0 + Opus 실행이라 Sonnet-FIX율 프록시 무의미. 플레이북 §8 P2 [x]). (1) **P2 =
> 부록 요령 전문 18조 + 운영규정 18조 + 목적물고시 1 = 37노드(LAW-166~202)/41엣지** (교재 부록2-3/2-4/2-5,
> book 807~826). ★계획 중 발견: 요령 제11·12조가 기존 LAW-003/004(요약 스텁)로 존재 → P1 **A안 패턴**
> (요령 원문 신규 + CROSS_REF, 4건). ★ESCALATE: 별표1(산식)·별표2/3(표)·목적물 범위표·응시수수료 상수
> (노드 원문 참조만, formulas/constants INSERT 0). (2) **독립 리뷰 2에이전트(PDF 원문 재추출 대조)**:
> CRITICAL 0/MAJOR 0/MINOR 6 → 실행분 전건 수정(요령 제6조 ④항 보강·엣지 앵커 정밀화·주석 정리), 잔여
> 관측(LAW-004 기존 노드 라벨 결함 승계·draft 타깃 결합)은 검수 인지. 보고서 `review-20260703-gap-P2.md`.
> (3) **production 적재**: 카운트 검산 정확 +37/+41 = knowledge_nodes **816→853** / edges **1302→1343**,
> draft 37/37. **무결성 러너: P2 신규 위반 0**(고아 delta 0=24 유지·끊김 0·순환 0·신규 41엣지 전부 활성),
> 게이트 FAIL = 선재 24-고아 debt(WS-2a) = P2 무관. (4) ⚠️ **잔여**: draft→approved = 진산 검수
> (`gap-P2-review-sheet.md`, ★E-5 요령 제11·12조 중복 판정·E-3 응시수수료 constants·E-1 별표1 노드화) /
> P3~P6 = P2 검수 후. 상세 [[project_content_coverage_audit_20260615]].

- **인프라 축**: Phase 3 launch chain — production 배포 완료. production D1
  마이그레이션 0001~0037 적용(`.claude/reports/production-migration-status.md`),
  Worker 배포, 인증/login_history smoke PASS, ADR-034/035/036 retrofit.
- **콘텐츠 축**: BATCH-1~7 + L1/L2(법령) + R1/R2(개정) **production 적재 완료**
  (Session 041~045). 누적 ≈ knowledge_nodes 794 / knowledge_edges ~1274 /
  formulas 157 / constants 193 / exam_questions 545.
  - 출처: `docs/plans/batch-loadmap.md:41~78,148` per-BATCH "production 적재 완료"
    기록 + 산술 검산(75+118+84+123+98+70+20+84+65+24+26+6+1=794) + handoff
    066/068/069 3건 교차확인.
  - ✅ **라이브 D1 count 확정** (2026-05-15 Session 086, 진산 6-A 인증 위임):
    `wrangler d1 execute thepick-db-production --remote` 실행 — knowledge_nodes
    **794** / knowledge_edges **1274**(전부 is_active=1) / formulas 157 /
    constants 193 / exam_questions 545. 산술검산·handoff와 전부 일치. W2 해소.
    근거: `docs/plans/graph-walk-s5-co1-co2-measurement.md` §0.
  - 적재는 status='draft' 강제였으나 라이브 확인 결과 **approved 488/794**
    (status_transitions 전이). routes.ts:117 "production approved 0건" 주석은
    stale (S5-3 정정 예정).
- **실 평가 축 (진행)**: Phase 2 Eval MVP baseline·multi-hop 정답률 **미측정**.
  Graph walk PoC 엔진(S0~S4) → S5 통합 결재(옵션 C) → **S5-1~S5-5 완료**
  (Session 087): S5-2 공통 status SQL 단일 진실원(`approved-nodes-sql.ts`,
  4 호출 측 통합) / S5-3 독립 `/api/search/graph`(D-1 12종·D-2 MAX_DEPTH4·
  MATERIALIZED, `/api/search` **불변**) / S5-4 Binary Gate G-S1~S4·S6 PASS /
  S5-5 4-Pass+5-페르소나 8 독립 에이전트, realcode 게이트 후 CRITICAL 0,
  회귀 0 (api 609 PASS). **여전히 통합 미완 = S5-6 미측정 = 사실상 Vector
  RAG** (옵션 C 격리 — 학습자 경로 비노출, A 통합 차기 별도 결재).
  - ✅ **S5-6 선결 CO6-1~CO6-4 완료** (Session 088, 미커밋): CO6-1 graph-walk
    projection description 동봉 → 잉여 2차 fetchApprovedNodes 제거(`MIN()` 집계
    로 GROUP BY 폭 차단) / CO6-2 `truncated` surface / CO6-3 성공·실패 경로
    elapsedMs telemetry / CO6-4 buildHit `Number.isFinite` 가드 + 누락 테스트
    (ranking-core.test.ts 신규 8 + graph-search-route +4). 독립 3 에이전트
    4-Pass: CRITICAL 0 / MAJOR 1 즉시해소 / 회귀 0 (**api 621 PASS**).
    근거 `review-20260515-220647-graph-walk-s5-6-co6-4pass-integrated.md`.
  - ✅ **S5-6a eval harness + golden 평가셋 자율 구축 완료** (Session 088,
    미커밋): 순수 코어 `apps/api/src/eval/multihop-accuracy.ts`(Workers-safe,
    import 0 — parseRelatedNodes/scoreQuestion/aggregate/format/assertRemote)
    - REMOTE runner `scripts/measure-s5-6-multihop-accuracy.ts` + 합성 픽스처
    - plan `graph-walk-s5-6a-eval-harness.plan.md`. golden 출처 =
      `exam_questions.related_nodes`(enrichRelatedNodes 파싱 동치). 지표 =
      graphOnlyRecovery(multi-hop 순기여)+regression 양면, 3분할(절단제외 권장).
      Binary Gate **G-6a-1~5 PASS**(결정성/파서골든/손계산/측정불가제외/자격
      증명). 독립 3 에이전트 4-Pass: CRITICAL 0 / MAJOR 즉시해소 5(lint차단
      runner remote전용화 포함)+carry-over 4 / 회귀 0 (**api 643 PASS**). 근거
      `review-20260515-230435-s5-6a-eval-harness-4pass-integrated.md`.
- **다음 진입 조건**: ✅ **G-S5 측정 차단 = 해소됨** (golden-pilot 동결 + queryBody 파생 → 2026-06-01 1차 ·
  06-05 2차 실측 완료, 위 "2026-06-05 갱신" 블록). 채점 = golden 파일 직접 → DB `related_nodes` 백필·TR-0
  trigger 와 **무관**(별건, 백필은 학습자 study 경로용으로 여전히 유효). **이제 진입 = G-S5 GO/NO-GO 진산
  결재 + S5-8 재설계 plan §9.** 아래 ⛔ 이중 게이트 서술은 **2026-05-16~29 당시 기록(역사 보존)**:
  - ~~**다음 진입 조건**: **⛔ G-S5 측정 차단 + TR-0 trigger 차단 (이중 게이트)**~~ (해소, 상기 참조)
  - **G-S5 골든 차단** (2026-05-16): production 기출 545 전부
    `related_nodes` NULL = Q↔node 라벨 없음. harness 정확·READY 이나 채점
    기준 데이터 미존재 → 측정 불가, fabricate 금지(RULE #5).
  - **TR-0 trigger 차단** (2026-05-29 5-페르소나 backend C-7 발견):
    `migrations/0004:39-43` `prevent_exam_questions_update` 트리거가
    `related_nodes` 백필 UPDATE 를 ABORT → 진산 검수 완료해도 production
    approved 동결 자체 불가. 정상 경로 plan = `docs/plans/tr-0-backend-c7-
trigger-redesign.plan.md` (Q1 B안 채택, 마이그 0038 신설 = `prevent_
exam_questions_body_update` 컬럼 화이트리스트). **마이그 SQL 작성·실행
    = 인간 승인 후** (L3 영역, 자율 금지).
  - golden 확보 경로 **진산 결재 = A(LLM생성→진산검수, 소규모 먼저)** 채택(2026-05-16).
    근거 [[project_g_s5_golden_data_gap]]. → **S5-6b plan 고정**
    (`docs/plans/graph-walk-s5-6b-golden-generation.plan.md`): 순환편향
    차단(측정대상 vector/graph 로 golden 선정 금지)·정밀라벨·대표성·
    draft-only(Hard Limit) 방법론 + Binary Gate G-6b-1~4. grounding 실측
    (active 534: 상법/농학/재해법령 각175+2차9 / approved 488).
  - ✅ **S5-6b pilot golden draft 생성 완료** (Session 091, 미커밋):
    approved 코퍼스 488 추출(`approved-nodes-sql.ts` 단일 진실원 SQL,
    read-only) + `docs/plans/s5-6-measurements/golden-pilot-draft.{json,md}`
    12문항(measurable 7 / unmeasurable 5 / multi 4 / single 3, expected
    평균 1.57). G-6b-1~4 self-audit PASS(순환차단 = vector/graph 호출 0,
    draft 격리 = D1 write 0, exam_questions 무변경). **2차 발견(중요):**
    approved 488 전수 명칭/의미 대조 = **농작물재해보험 손해평가 실무
    단일 도메인**(p.400~630) — 상법/농학/재해법령 거버넌스 개념 코퍼스
    0건. §3 4-과목 표본설계 충돌 → **진산 결재 "손해평가 도메인 집중"**
    (2026-05-16). pilot 12 = 2차 9 전량 + 재해법령 손해평가요령 실무
    3(제5/8/9회). ⇒ **G-S5 결론은 손해평가 도메인 한정**(상법/농학
    측정 = 별도 코퍼스 확대 = Hard Limit·별도 결재 후). 근거 README +
    [[project_g_s5_golden_data_gap]]. **다음: 진산이 golden-pilot-draft.md
    검수(APPROVE/FIX/REJECT, 문항당 수초) → 승인분 golden-pilot-approved
    .json 동결 → wrangler dev --remote + harness G-S5 pilot.** 이하 게이트
    서술은 golden 확보 후 적용:
  - ⚠️ **carry-over (2026-05-21 진산 통찰·결재): 다중출처 보기별/물음별
    라벨 트랙** — 4지선다 "옳지 않은 것"·"모두 고른 것"·2차 실기 다중
    물음 계산형은 보기별/물음별 출처 분리 필요(학습자 "근거 보기" UX
    1급 기능, memory [[project_source_citation_requirement]]). 현 S5-6b
    문항통째 골든은 G-S5 측정에 충분하나 UX 라벨 깊이 부족. 진산 결재
    "단계분리": Phase A=현 S5-6b 측정 우선 → Phase B=pilot 12 보기별
    라벨 시범 → Phase C=545 전수 BATCH(DB 스키마 신규 + 공식 해설집
    조사 + Hard Limit 환각 차단). G-S5 pilot 측정 완료 직후 Phase B
    진입 결재 상신 의무. 상세 [[project_multi_source_choice_basis_track]].
- (참고, 데이터 확보 후) G-S5 본체 측정 = 진산 Cloudflare 인증 게이트 —
  harness READY(LOCAL_SMOKE vitest 게이트 / REMOTE 코드 完, fabricate 차단).
  `THEPICK_API_BASE`(env) + golden 파일(인증 세션이 remote D1 추출) 주입 시
  `pnpm tsx scripts/measure-s5-6-multihop-accuracy.ts --golden <f>` → 실
  정답률 산출. 동시 Pass2 m-2(D-2 description-포함 projection 1회 재측정 →
  measurement.md §3.1 각주) in-scope. carry-over: CO-6a-1~4(plan §5b) +
  S5-7=A 통합 결재(자율 금지). 잔여 REMEDIATION (CRIT-5 L3 Year2, B-1~4
  Tier3) + Step 3-UX-7b distractor BATCH(L3).
  - ✅ **S5-7 결재 자료 작성 완료** (2026-05-16, 코드 무변경, 미커밋):
    `docs/plans/graph-walk-s5-7-a-integration.plan.md` — 통합지점
    (routes.ts:111-142 Stage 2.5) / 회귀표면 / CPU예산 / PITR 3안(A-3
    섀도→A-2 플래그→전량 권고) / CO 통합원장(CO7-1·3 선결·CO7-2·4·5·
    L-1·CO-6a-3·Pass2 m-2) / Binary Gate G-S7-1~6 / **§7 ROI/GO = G-S5
    실측 의존 조건부(미정)**. 진산 결재 §8(통합방식·선결순서·L-1·GO).
    **A 코드 착수 = §7 GO + 별도 결재 후** (자율 금지 영속).
  - ✅ **Phase 2 기술부채 5-페르소나 독립 병렬 리뷰 완료** (Session 092,
    2026-05-29, 코드 무변경, 미커밋): refactoring / performance / quality /
    backend / devops 5 에이전트 단일 메시지 병렬 호출 (48.6m wallclock,
    1,853 LOC 보고서). 합산 **CRITICAL 27 / MAJOR 32 / MINOR 21**. 통합
    인덱스 `.claude/reviews/phase2-tech-debt-20260529-INDEX.md`. **6대 진앙**:
    #1 단일 진실원 우회(북극성 위반, backend C-5/C-6) / #2 Year 2 zero-cost
    위반(backend C-1 + refactoring C-1/C-2/M-1) / #3 G-S5 측정 차단·결론
    의미(backend C-7 + quality C-1 + perf C-3) / #4 시리얼 chain hot path
    (perf C-1~C-5) / #5 회귀 검출 공백(quality C-2~C-8) / #6 운영 자동화
    공백(devops C-1~C-4). **진산 결재 (2026-05-29)**: Q1=B안(trigger 컬럼
    화이트리스트) / Q2=A안(N=12 워터마크 영속) / Q3=직렬(Phase 2→3 closure)
    / Q4=인벤토리만 즉시(실시행 별도 결재). **권고 액션**: TR-0(즉시 ~8h) →
    TR-1(학습자 정직성 ~16h) → TR-2(Phase 2 closure ~30h) → TR-3(Phase 3
    launch ~25h) → TR-4(Year 2 인벤토리 즉시 / 실시행 별도). 즉시 영속물:
    `docs/plans/tr-0-backend-c7-trigger-redesign.plan.md` (마이그 0038,
    인간 승인 후 코딩) + `docs/plans/tr-4-year2-zero-cost-inventory.md`
    (인벤토리 6건) + `docs/plans/s5-6-measurements/README.md` §"N=12 워터
    마크" 추가 + ★`docs/plans/phase2-tech-debt-workflow.md` (살아있는 운영
    가이드: Mermaid 의존 다이어그램 + 이중 게이트 + G-S5 분기 트리 + TR-0~
    TR-4 단계별 액션 + 진척 추적 표 + 진산 행동 큐 + 롤백 체크포인트 —
    차세션 진입 시 1차 참조). 차세션 1차 액션 = TR-0 plan 결재 + 진산
    검수 시작 (이중 게이트 묶음). 상세 [[project_phase2_tech_debt_review_20260529]].

## 최근 실수

- 2026-04-12: ARCHITECTURE.md + 구현 설계서 작성 후 4-Pass 자동 리뷰를 실행하지 않음. 사용자 지적 후 셀프 점검에서 7건 발견(IndexedDB≠D1 혼동, 배치 흐름 순서 오류 등). → review-reminder.sh Stop Hook 추가로 재발 방지
- 2026-04-12: 세션 모니터 Hook이 4시간 동안 경고를 주지 않음. 원인: stderr 출력이 사용자에게 안 보임 + 대화 중간 점검 메커니즘 부재. → stdout 출력 + exit 2 + session-health.md 규칙 추가
- 2026-04-12: 4-Pass 자가 리뷰에서 0건 보고 → 독립 다각도 리뷰에서 CRITICAL 9건 + MAJOR 10건 발견. 원인 5가지: (1) 자기 확인 편향 — 코드 작성자=리뷰어라 의도를 기억하고 문제를 못 봄, (2) 스코프 축소 — 변경 파일만 검사하고 연관 파일 무시, (3) N/A=통과 착각, (4) 분석 깊이 부족 — 테스트 통과에 안심, (5) 독립성 제로. → 대책: 독립 에이전트 리뷰 의무화 + 증거 기반 보고 + 반론 의무 + auto-review-protocol.md 전면 개정
- 2026-05-15: G-AUDIT 외부 감사 보고서 §12 핵심정정 #2에서 "knowledge_nodes 미적재 / vectorCount=topic_cluster·smoke"로 단정 → 사실은 BATCH-1~7 production 적재 완료(794 노드). 원인: stale한 본 CLAUDE.md "현재 상태"(Phase 0)만 신뢰하고 `docs/plans/batch-loadmap.md`를 미열람(스코프 축소). 이 1차 환각이 외부 Review B+C(코드 미열람)→REMEDIATION CRIT-2/3로 5-Layer 연쇄 증폭. 차단: 진산이 처리계획 진입 전 "타당성 검증" 게이트 지시 → Claude Code 실코드 대조로 거짓 전제 발견. → 대책: (1) "현재 상태" 섹션을 handoff/WBS 갱신 시 동기 의무화, (2) 외부 SPDP 결과는 실코드 대조 Cycle-Closure로 닫는 패턴 영속(REMEDIATION 검증 §4 메타교훈), (3) 루트 문서 stale = 모든 하위 작업 진앙 — 30일+ 미갱신 감지 시 환기
- 2026-05-16: S5-6a eval harness 를 "golden 출처 = exam_questions.related_nodes" 전제로 자율 구축(plan §1) → 진산 Cloudflare 인증 세션 실측 착수 시 production 545 기출 전부 related_nodes NULL 확인, G-S5 측정 불가 판명. 원인: 스키마에 컬럼이 존재한다는 사실만으로 golden 출처 채택, **production 데이터 populate 여부 미검증**(2026-05-15 G-AUDIT stale 가정과 동일 클래스, 방향만 반대). 다행히 realcode 인증-게이트 경계에서 측정 실행 직전 포착(harness/plan/결재자료는 데이터 확보 시 그대로 가동 — 매몰 아님). → 대책: (1) 신규 데이터-의존 작업은 "스키마 존재 ≠ 데이터 populate" 를 plan Reality Anchor 에서 실 production 1-쿼리로 선검증 의무, (2) memory `project_g_s5_golden_data_gap` 영속, (3) Cycle-Closure(feedback_cycle_closure_realcode_gate)가 이번에도 유효 작동 — 외부 결과뿐 아니라 *자체 plan 전제*도 실행 게이트에서 실데이터 대조
- 2026-05-29 (Session 093): 진산 "권고대로 진행" 지시를 L3 마이그 0038 SQL **작성 승인**으로 해석해 plan formal 결재(`approved_by` 갱신)·ADR-046 Accepted **전에** SQL/테스트를 작성 → dogfood 4-Pass 가 MAJOR-2(L3 결재 순서 역전, Silent Pivot 오인 위험)로 적발. 원인: 모호한 "진행" 지시를 결재 순서(plan §6 step1 결재 → step2 ADR → step3 SQL) 확인 없이 코딩 착수로 해석. **무해 요인**: production 적용(wrangler --remote, 불가역)은 미수행 = 가역·데이터 회귀 0 + 자체 4-Pass 가 사전 포착 + SQL 내용 ADR-046 D-0 과 1:1 정합. → 대책: (1) L3(마이그/스키마/Formula Engine)은 "진행" 지시를 받아도 plan `approved_by`/ADR 상태를 **먼저 명시 전환(또는 명시 확인)** 후 코딩 — 가역 선작성 시 산출물에 "선작성본(formal sign-off 대기)" STATUS 라벨 의무, (2) 본 세션은 SQL 헤더·plan §8·ADR-046 상태에 라벨링으로 해소, production 게이트 보존. 메타교훈: 자체 dogfood(4pass-review 워크플로우)가 프로세스 위반을 독립 검출 = realcode 게이트 패턴 유효.
