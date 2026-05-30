# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚧 G-1 REALITY GATE 규칙 (코드 1줄 전 — 최우선)

> **헌법:** VOID DEV UNIFIED CONSTITUTION v3.6 (`docs/consti/`). 이 프로젝트의 모든 새 기능·아이디어는
> 코드를 쓰기 전에 G-1을 통과해야 한다. G-1은 ACAP Stage -1(Deep Dive)보다도 앞에 온다.
> **현 적용 상태 (2026-05-30 소급 형식화, 프롬프트 C):** 상태 **C**(가장 성숙). 판정서
> `docs/feasibility/thepick.feasibility.md` + `ceiling.md`. **🟢 아키텍처(콘텐츠+산식+Vector RAG+FSRS)
> = 축소 GO·production 배포 완료 / 🟡 graph-walk 정답률 = R3 BLOCKED(=기존 G-S5 측정 게이트, 미측정 0%).
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
- State: Zustand + IndexedDB (Dexie.js) 오프라인 동기화
- Backend: Cloudflare Workers + Hono (Edge)
- ORM: Drizzle ORM (D1 네이티브)
- DB: Cloudflare D1 (9개 테이블) + Vectorize (벡터 검색)
- AI: Claude API (Haiku 배치 구조화 + Vision OCR)
- Formula Engine: math.js AST 파서
- PDF: pdfplumber (Python subprocess)
- Test: Vitest + Playwright
- Lint: ESLint + Prettier + husky (lint-staged)
- 시각화: D3.js Force Graph

## 명령어

```
# build: (Astro 프로젝트 초기화 후 확정)
# test:  (Vitest 도입 후 확정)
# lint:  (ESLint + Prettier 도입 후 확정)
# dev:   (확정 후 업데이트)
```

## 아키텍처

3계층 데이터: 정밀(constants DB) → 구조(Graph nodes/edges) → 맥락(Vectorize 임베딩)
7 Layer × 28 모듈: 수집(5) → 구조화(6) → 품질검증(3) → Core엔진(5) → 생성(5) → 학습서비스(3) → 관리자(1)
모노레포: apps/(web PWA, admin-web, api Workers, batch) + packages/(parser, parser-1st-exam, formula-engine, study-material-generator, quality)
상세: `docs/쪽집게(ThePick) — 구현 재정립서 v2.0.md` 참조
구현: `docs/쪽집게(ThePick) — 구현 설계서 및 개발 로드맵.md` 참조
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
- **다음 진입 조건**: **⛔ G-S5 측정 차단 + TR-0 trigger 차단 (이중 게이트)**
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
