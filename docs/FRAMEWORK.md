# 🧰 ThePick 프레임워크 지도 — 단일 진입점 (v1.0, 2026-07-04)

> 진산 지시 "프레임워크를 별도 관리해서 라이브러리(표준)처럼 활용" 의 이행체.
> **별도 `FrameWork/` 폴더는 신설하지 않는다** — 기결 A안(모노레포 참조+주입) 구조에서 프레임워크는 이미 아래 위치에 실재하며, 이 문서가 그 단일 지도다. 폴더 재배치는 import 경로·기결 구조와 충돌하는 무익한 churn.

## 프레임워크 6층 (T1~T6) — 정본 위치와 소비 규칙

| 층                 | 내용                                                                                                                                                                                | 정본 위치                                                                                                                                                        | 종목이 쓰는 법                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| T1 코어 코드       | FSRS(srs)·채점(learning-modes)·그래프 무결성(quality)·산식 엔진 코어(formula-engine)·파서 범용부(parser, parser-1st-exam)·공용 인프라(shared: logger/errors/auth/exam-adapter 계약) | `packages/`                                                                                                                                                      | pnpm workspace 참조 — 수정 금지(템플릿 트랙 전속, L3). 커밋 1개 = 전 종목 상속 |
| T2 배포 셸         | api(Workers)·web(PWA)·admin-web·batch                                                                                                                                               | `apps/`                                                                                                                                                          | `wrangler.{exam}.toml` + `EXAM_ID` vars 주입 → 종목별 스택 배포                |
| T3 종목 도메인 팩  | registry(온톨로지)·domain·exam.config·프롬프트·산식 정의·golden·콘텐츠                                                                                                              | `exams/{id}/` (M1에서 골격 신설)                                                                                                                                 | **종목 트랙이 작성하는 유일한 층** — 코어가 DI로 주입받음                      |
| T4 프로세스 자산   | 적재 플레이북·이진 게이트(G-GAP)·검수표 서식·에스컬레이션 규칙·독립 리뷰 워크플로우(`.claude/workflows/`)·hooks                                                                     | `docs/playbooks/_template/` (✅ 신설 2026-07-04 — `README.md` + `content-load.playbook.template.md`. 원형: `docs/plans/e0-8-gap-remediation-sonnet-playbook.md`) | 종목별 인스턴스화(README §절차) + 산출물에 플레이북 버전 스탬프                |
| T5 중립 스키마     | lv1/lv2/lv3 generic DDL + registry 생성 CHECK + 거버넌스 트리거                                                                                                                     | `migrations-v2/` (신설 예정 — 1호 구체인 `migrations/`는 동결)                                                                                                   | 신규 종목 D1 생성 체인                                                         |
| T6 AutoVerify Gate | V1 결정론 대조 / V2 독립 AI 솔버 / V3 검증셋 회귀 — draft 차단 필터(승격=인간)                                                                                                      | `packages/autoverify/` (신설 예정 — 별건 G-1 선행)                                                                                                               | GT(기출 정답·산식)는 종목 팩이 주입                                            |

## 횡단 표준 (전 종목 의무)

- **출처 추적성**: 노드·문항에 근거 FK + `answer_provenance`(official/reconstructed/generated) + `effective_date`
- **개정 대응(Revision Watch)**: 감지 배치 → diff → 진산 알림 → SUPERSEDES 개정 적재 (설계: `docs/plans/revision-watch.plan.md` 예정) — 최신성 = 서비스 신뢰성의 성립 조건(2026-07-04 진산 지시)
- **산식 이원 정본**: ID 정본=D1 / 계산 정본=코드 + 크로스워크 매니페스트(G-WS3c 게이트) — 첫 산식 등록부터
- **통합 계정**: 플랫폼 공유 D1(users/구독/결제) + 쿠키 `Domain={루트도메인}` SSO — `exams/_platform/`
- **검증**: draft-only·행당 인간 검수·독립 에이전트 리뷰(4-Pass)·기출 정답 대조 100%

## 신규 종목 온보딩 진입점

`docs/plans/exam2-electrical-onboarding.plan.md` §4(수렴식) + §7 체크리스트가 표준 절차의 원형. 실행 지침: `docs/plans/opus-dual-track-playbook-20260704.md`.
