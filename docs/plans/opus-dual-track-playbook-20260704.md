# 🎯 Opus 4.8 실행 플레이북 — 1호·2호 동시진행 체제 (v1.0)

> **작성**: 2026-07-04, Claude Fable 5 (주간 한도 임박 → Opus 4.8 인수인계). **다음 주 Fable 5 복귀 시 §7 검토 게이트 실행.**
> **모델 체제**: Opus 4.8 = 실행 / Fable 5 = 주간 검토(§7) / 진산 = R5·L3 결재 (불변 — RULE #5).
> **이 문서가 실행 정본이다.** 세션 시작 시 읽기 순서: ①CLAUDE.md ②본 플레이북 ③해당 트랙 문서(§1 표).
> **선례**: `docs/plans/e0-8-gap-remediation-sonnet-playbook.md`(하위 모델 실행 체제 — P1~P3 CRITICAL 0 실적). 본 문서는 그 Opus·이중트랙판.

---

## §0 오늘(2026-07-04) 결재 확정 사항 — 전제

| 축        | 확정 내용                                                                                                                                                                                | 정본                                                                            |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 구조      | A안: 단일 레포 + `exams/{id}` + 종목별 Cloudflare 스택 + `{exam}.thepick.co.kr` 서브도메인(루트 도메인 미정 — 하드코딩 금지) + **통합 계정**(플랫폼 D1+SSO 쿠키)                         | `decision-card-20260704-engine-separation-r5.md`                                |
| 2호       | **전기기사** (`jeon-gi-gi-sa`). R5 Q1~Q5 전건 결재: 동시진행 / 패밀리 ID `ELEC-{SUBJ}-###`·F-A / **회로도 생성 = 킬러 서비스**(S10) / 복원분 노출 허용("복원" 라벨) / 현행 출제기준 착수 | `exam2-electrical.feasibility.md` R5 + `exam2-electrical-onboarding.plan.md` §7 |
| 신규 의무 | **Revision Watch**(개정 대응·최신성 모듈 — Q5 "반드시 해야 함") + AutoVerify Gate(별건 G-1 선행)                                                                                         | 본 문서 W3·W4                                                                   |
| 검증      | AutoVerify = draft **차단 필터**, approved 승격 = 인간 (Hard Rule 7 불변)                                                                                                                | 결재 카드 §4                                                                    |

## §1 트랙 구조와 문서 지도

| 트랙                             | 워크스페이스                                    | 브랜치                | 접촉 허용 경로                                                                                                                 | 1차 참조 문서                                                                        |
| -------------------------------- | ----------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| **1호+템플릿** (손해평가사·코어) | `/home/soo/ClaudePro/ThePick` (main)            | main                  | 전체 (코어 packages/·apps/ 는 이 트랙 전속)                                                                                    | `docs/plans/ROADMAP_TO_SERVICE_20260702.md` + CLAUDE.md 현재 상태                    |
| **2호** (전기기사)               | `/home/soo/ClaudePro/ThePick-jeongi` (worktree) | `track/jeon-gi-gi-sa` | `exams/jeon-gi-gi-sa/`·`docs/plans/exam2*`·`docs/feasibility/exam2*`·`docs/manual-electrical/`(신설)·`docs/batch-load/exam2-*` | `exam2-electrical-onboarding.plan.md` + `EXAM2_UNBOUNDED_SCOPE_STRATEGY_20260704.md` |

**프레임워크 정본 위치 (FrameWork/ 폴더 신설 불채택 — 기결 A안 구조 유지)**: 코드 표준 = `packages/`(T1) / 프로세스 표준 = `docs/playbooks/_template/`(T4, W1에서 신설) / 스키마 표준 = `migrations-v2/`(T5) / 단일 진입점 지도 = `docs/FRAMEWORK.md`.
**프론트엔드**: 진산이 Claude Design 프로젝트(claude.ai/design/p/019e1f64-97db-78b0-9c4e-cca2e1f07cd1)에서 UI 산출 → `apps/web` 통합은 트랙 세션이 수행(디자인 결정은 진산 영역).

## §2 워크스페이스 셋업 (1회, 메인에서 실행)

```bash
cd /home/soo/ClaudePro/ThePick
git branch track/jeon-gi-gi-sa                      # main 기점
git worktree add ../ThePick-jeongi track/jeon-gi-gi-sa
# VSCode 창 2개: code /home/soo/ClaudePro/ThePick  +  code /home/soo/ClaudePro/ThePick-jeongi
# 각 창에서 Claude Code 병행 실행 (CLAUDE.md·hooks·설정은 트리에 있어 양쪽 자동 적용)
```

**worktree 운영 규율** (위반 = 드리프트 사고 재발 경로):

1. 2호 트랙은 §1 허용 경로만 수정. **packages/·apps/ 수정 필요 발견 = 즉시 STOP** → 필요 diff를 `docs/plans/exam2-core-diff-ledger.md`에 기록(E2-2 원장) → 메인 트랙에서 처리.
2. 병합 주기: **매 세션 종료 시** track → main 병합(경로 분리로 충돌 최소 설계됨). 3세션 이상 미병합 금지.
3. 커밋·푸시는 진산 지시 게이트 유지(현재 미커밋 산출물 다수 — 지시 수신 시 일괄 커밋부터).
4. 동시 배포 금지: wrangler deploy 는 한 트랙씩(1호 production 보호).

## §3 실행 순서 (W0~W6 — 순서 위반 금지)

### W0. 세션 시작 프로토콜 (매 세션)

읽기: CLAUDE.md(멀티트랙 섹션+현재 상태 최신 블록) → 본 플레이북 → 트랙 문서. 워킹트리 상태 확인(`git status`, 병합 필요 여부). 완료 선언 전 = 독립 리뷰(§6) 의무.

### W1. 문면 정합 (D-6 — 문서만, 코드 0, 양 트랙 공통 선행)

- `docs/plans/master-remediation-20260610/MASTER_PLAN.md` #17 + `docs/audit/EXPANSION_GATE_DESIGN_20260611-073814.md` E2-0의 "전기기사=2호 배제" 문면에 **2026-07-04 결재 번복 주석 블록 추가**(원문 보존+개정 기록 — 삭제 금지).
- ADR-007 Amend(시점 조기집행) + ADR-036에 "서브도메인 통합 = 복원 의무 조기 이행 예정" 표기 + `auto-review-protocol.md` Pass 2 truth_weight 서술에 "종목별 registry 정렬 따름" 각주.
- `docs/playbooks/_template/` 신설(D-7): e0-8 플레이북 골격을 종목 파라미터 템플릿으로 + 산출물 버전 스탬프 규약.
- `docs/FRAMEWORK.md` 유지·갱신(이미 신설됨).

### W2. R3 Spike S1~S10 (2호 트랙 — 스테이징 한정, production 무접촉)

표본: 2021~2022 지필 기출 2~3회분(Tier-1) + 전기설비기술기준 과목. 산출물: `docs/feasibility/spike-exam2-{S번호}.md` + feasibility R4 갱신.

- S1 기출↔세세항목 매핑률(게이트 ≥90%) / S2 반복률 실측(산출물) / S3 파싱 정답 대조 **100%** / S4 그림 의존도 3~5회분 전수(도해·수식 분리) / S5 KEC 파일럿 20~30노드(**스테이징 D1**) 역검증 ≥90%+수치 불일치 0 / S6 formula-engine 표현률(17함수 기준 3분류 — 표현+우회 ≥70%면 확장 L3 plan 근거) / S7 복원분 결정론 재검증률 N=30 / S8 KEC 전문 hwp(40.3MB) 파싱 수율(hwp5html — 출제기준 107KB는 실증 완료) / **S9 전기 도메인 vector baseline**(파일럿 노드+문항 20~30, bge-m3 hit-rate — 최대 공백, 생략 금지) / **S10 회로 생성·풀이 PoC — ★오픈소스 확정: lcapy(넷리스트→기호해·수치해·단계별 유도)+schemdraw(SVG)**.
- **S10 상세** (근거: `docs/학습자료저장및도출/EXTERNAL_ELECTRICAL_EXPANSION_ANALYSIS_20260704.md` + 대조 `docs/audit/crosscheck-external-diagnosis-20260704.md`): 수직 관통 PoC = RLC 직렬 템플릿 1개 → 값 난수화(변수 유효범위 명세) → lcapy 풀이(빌드타임 Python 사이드카 — pdfplumber .venv 선례 패턴) → schemdraw SVG → 정적 JSON(넷리스트+풀이단계+정답+SVG) → 기존 web 렌더 확인. + **Solver-Validated Gate G1 테스트**(특이행렬 토폴로지 입력 시 거부). 게이트 = 관통 성공 + G1 차단 실증 + 렌더 품질 인간 확인. ⚠️스코프: **클래스 A(1차 회로이론)만** — 수변전 단선도·시퀀스(클래스 B·C)는 2차 실기 축 = 백로그 BL-3.
- ⚠️ ID·CHECK 소성 주의: S5 적재도 `ELEC-{SUBJ}-###` 규약(D-1 기결)으로만. 수식 표기는 W4 canonical form 확정 전 **임시 표기 라벨**을 달아 재적재 가능 상태 유지.

### W3. Revision Watch 설계 + L3 plan (Q5 필수 지시 — 1호 포함 전 종목 표준)

- 현존 자산 실사 기록: SUPERSEDES 엣지·revision_changes 테이블·R1/R2 개정 배치 실적(수동)·E0-8 발견(미시행 개정 선반영 4건 = 시행시점 축 부재).
- 설계 문서 `docs/plans/revision-watch.plan.md`(L3): ①감지 = law.go.kr·kec.kea.kr·큐넷 공시 주기 폴링 배치(Workers cron — Cloudflare 단일 벤더) ②반영 = 감지→diff 요약→진산 알림→R1/R2형 개정 배치(draft·SUPERSEDES·**effective_date 1급**) ③알람 채널 신설(현재 0 — 후보: 이메일/Workers→Slack 없이 Cloudflare 내 수단 우선) ④커버리지: 1호(법령·요령·고시) + 2호(KEC·기술기준·출제기준). **코드 착수 = plan 진산 결재 후.**

### W4. M1 준비 + 결정 카드 (템플릿 트랙)

- M1 plan 작성(exams/ 골격 + shared 탈오염 — 엔진분리 검토서 §5-M1 사양, L3): **plan까지만, 코드는 진산 결재 후.**
- ExamConfig 확장 설계(합격판정 메타모델: 과락·배점·문항수·시행횟수 — 1호·2호 공통).
- **수식 canonical form 결정 카드**(3안 비교: 유니코드 평문/LaTeX 소스+KaTeX 렌더/하이브리드 — D1 저장·임베딩 입력·MC UI 렌더 3층 일관성 기준) → 진산 결재 상신. **첫 적재 전 확정 의무(사후 변경 = 전량 SUPERSEDES 재적재).**
- AutoVerify Gate feasibility(`docs/feasibility/self-verification.feasibility.md`) R1~R4 초안(R5 진산).
- **도면/미디어 스키마 설계**(migrations-v2에 포함): exam_questions·knowledge_nodes에 diagram(netlist/svg_ref)·미디어 R2 연결 필드 — 현재 전무 실측(grep 0건). 회로도 킬러 서비스(Q3 기결)의 데이터 그릇 — L3.
- **결재 카드 상신: 결정론 변형의 검수 단위** — 개별 문항 전수 검수 vs **템플릿 승인제**(인간은 [토폴로지 템플릿+배치 힌트+규칙셋]을 승인, 개별 변형은 Solver Gate 자동 검증+샘플 감사) — Hard Rule 7 강도 조절 사안(외부 분석 Sentinel 제안, 채택 여부 = 진산).

### W5. 자료 인입 (진산 제공 시)

기출·복원분·교재류 수신 → `docs/manual-electrical/` 인벤토리(batch-loadmap.md:8-17 형식) → Tier 분리(official/reconstructed) + 회차·정답표 대조 → 페이지/문항 축 실측. 복원분은 Q4 흐름(자체 검증→수정·보완→검수→"복원" 라벨) 전용 큐로.

### W6. 백로그 (여유 시에만)

BL-1 국가자격 전수 카테고리 맵(유사 형태·도메인·분야 묶음 — 공공데이터포털 출제기준 데이터셋 활용, 웹 리서치. 산출: 후보 종목 × 자료수급 5조건 × 패밀리 후보 매트릭스) / BL-2 1호 농학개론 back-port(과락 방지 모드 — related_nodes 라벨 확보 후) / BL-3 **전기기사 2차(실기) 확장 예비 검토** — 외부 분석 확인: 실기 = 필답형(작업형 아님)·단답 70~85%(=암기 축, 재사용 高)·그리기 3종(수변전 단선도=커스텀 심볼+규칙엔진 / 시퀀스·래더=부울 시뮬레이터 — 클래스 B·C 신규 엔진). 1차 안착 후 별건 feasibility.

**1호 트랙은 기존 로드맵 그대로 병행**: E0-8 갭 P4~P6(검수 후)·G-S5 0b 재측정·F6 준비 — `ROADMAP_TO_SERVICE_20260702.md` 순서 유지. 검수 대기물은 트랙별 검수표로 분리 상신(1호/2호 큐 혼합 금지).

## §4 크리티컬 가드레일 (불변 — 위반 시 산출물 무효)

1. **G-1 언어**: 측정 없는 가능성 단언 금지(G-1 금지어 형식 회피). 천장/목표/측정 형식. 측정 전 수치는 추정 라벨(G1~G15 표 참조).
2. **draft-only**: AI 생성물 전건 draft. approved 승격 = 진산. AutoVerify는 차단 필터일 뿐.
3. **LLM 수식 계산 절대 금지**: 정답 산출 = formula-engine AST만. 학습자 런타임 LLM 0 유지.
4. **L3 선결재**: formula-engine 확장(sin/cos/tan/atan/exp/pi)·스키마(migrations-v2·effective_date·provenance 컬럼)·registry 확정·user 데이터 이전 — plan+진산 승인 전 코드 금지.
5. **비가역 3종 소성 주의**: ID/CHECK enum(=`ELEC-{SUBJ}-###` 기결 준수)·수식 canonical form(W4 확정 전 본 적재 금지)·D1 DDL. 첫 적재가 되돌릴 수 없게 만든다.
6. **production 무접촉**: 2호 작업 전부 스테이징. 1호 production(857노드·유저)은 이 플레이북 범위 밖.
7. **1호 green 유지**: 코어(packages/·apps/) 접촉 시 api 711+·web 31·E2E 20·typecheck·lint·g1 전체 green 재확인. 테스트 출력은 원문 보고(요약 금지).
8. **Hard Rule 15**: 신규 코드에서 shared/types.ts 도메인 유니온 확장 금지 — 종목 타입은 exams/ 팩+DI.
9. **기출 정답 대조 100%**: 불일치 1건 = 원인 규명 전 진행 금지.
10. **출처 추적성**: 모든 노드·문항에 근거 FK(KEC 코드번호·출제기준 세세항목·기출 회차) + provenance + effective_date.
11. **KEC 2021 필터**: 2020년 이전 기출의 설비 과목 문항 = 현행 정합 라벨 없이 적재 금지.
12. **독립 리뷰 의무**(§6): 자가 리뷰 금지. "완료" 선언 = 4-Pass CRITICAL 0 후.
13. **Silent Pivot 금지**: 계획·기결과 다르게 가려면 먼저 보고(결재 카드 상신). 기결 문서 원문 삭제 금지(주석 블록 개정).
14. **CLAUDE.md 현재 상태 동기**: 주요 마일스톤마다 갱신 블록 추가(stale = 사고 진앙 — 2026-05-15 실증).
15. **저작권 관련 언급 금지**(오너 지시) / 일정 약속 금지(세션 수 추정치 인용 금지).
16. **회로 생성 3원칙**: ①무작위 토폴로지 생성 금지 — 인간 승인된 **양호 토폴로지 템플릿에서 값만 난수화**(lcapy 특이행렬 경고) ②무거운 Python 툴체인(lcapy·schemdraw)은 **빌드타임 전용 격리** — Workers·브라우저 반입 금지(런타임은 정적 JSON+SVG만) ③**Solver-Validated Gate 통과 없이 생성물 노출 절대 금지**(G1 유일해/G2 난이도/G3 레이아웃 청결/G4 단위 — 실패=폐기·재생성, "사일런트 드롭" 런타임 방어 금지).
17. **외부 산출물 인용 전 대조 의무**: 외부 진단·분석은 `docs/audit/crosscheck-external-diagnosis-20260704.md` 유형의 실코드 대조 후에만 전제로 사용 — 특히 "콘텐츠 미로딩"류 D1 상태 주장은 라이브 카운트 없이 신뢰 금지(2026-05-15 사고 클래스).

## §5 에스컬레이션 7규칙 (즉시 STOP → 진산 상신)

E-1 계획에 없는 비가역 작업 필요 발견(스키마·ID·production) / E-2 기출 정답 불일치 원인 불명 / E-3 코어 수정 없이는 진행 불가(2호 트랙 — diff 원장 기록 후) / E-4 spike 게이트 미달(S1<90%·S3<100%·S5 미달·S9 붕괴) — 결과 조작·완화 금지, 미달 사실 그대로 / E-5 기존 노드·기결과의 충돌(중복·모순) 발견 / E-6 자료 신뢰성 의심(복원분 정답 상충·출처 불명) / E-7 세션 컨텍스트 불안·서두름 충동(솔직 보고 후 핸드오프).

## §6 검증 프로토콜 (기존 체계 그대로)

- L2+ 산출물 완료 전: `Skill(4pass-review)` 독립 에이전트 리뷰(자가 금지) — CRITICAL 0 + 보고서 `review-YYYYMMDD-HHMMSS-*.md`.
- 콘텐츠·측정 산출물: 독립 적대검증 에이전트(원문 재추출 대조 — gap-P1~P3 패턴, CRITICAL 0).
- 마일스톤: 5persona-debt. 커밋 전: `pnpm g1:check` + quality-gate 훅 통과.
- 검수표: 행당 APPROVE/FIX/REJECT 형식(1호 gap-P\*-review-sheet 서식) — 진산 검수는 트랙별 분리 큐.

## §7 Fable 5 검토 게이트 (다음 주 — Opus는 여기 대비해 산출물 정리)

| #   | 검토 대상                                                                                        | Opus가 준비할 것                            |
| --- | ------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| F-1 | spike S1~S10 결과 해석(특히 S9 vector baseline·S2 반복률·S7 복원 재검증률) — 과잉/과소 해석 감사 | spike-exam2-\*.md + 원시 데이터 + R4 갱신본 |
| F-2 | 수식 canonical form 결정 카드 + registry 초안                                                    | 3안 비교표 + 파일럿 표기 샘플               |
| F-3 | M1 plan(shared 탈오염 — 1호 green 담보 최대 리스크 지점)                                         | plan + 영향 파일 목록 + 롤백 설계           |
| F-4 | Revision Watch 설계                                                                              | plan + 현존 자산 실사                       |
| F-5 | 플레이북 준수 감사(가드레일 위반·Silent Pivot·미커밋 위험)                                       | 세션별 핸드오프 기록                        |

## §8 입력 대기 (진산 — 비차단이나 조기 제공 시 가속)

1. ~~회로도 생성 오픈소스~~ → ✅ **해소(2026-07-04)**: **lcapy + schemdraw** (진산 제공 외부 분석 — `EXTERNAL_ELECTRICAL_EXPANSION_ANALYSIS_20260704.md`). S10 착수 가능
2. 복원 문항 수집 데이터(전달 형식 자유 — W5 큐)
3. 지필 기출 아카이브 원본(2021~2022 회분 우선)
4. 루트 도메인 확정(비차단 — config 주입 유지)
5. 미커밋 산출물 일괄 커밋·푸시 지시 (07-03~04 문서 다수)
