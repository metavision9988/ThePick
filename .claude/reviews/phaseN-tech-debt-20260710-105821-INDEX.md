# Phase N (promo-1st P0~P4) 5-페르소나 기술부채 통합 인덱스

- 일시: 2026-07-10 10:58:21 (ts=20260710-105821)
- 프로토콜: `.claude/rules/auto-review-protocol.md` §"Phase 단위 5-페르소나 기술부채 리뷰" (horizon 6개월~2년, 직전 4-Pass 와 중복 금지)
- 리뷰 대상: promo-1st P0~P4 체인 — 공개 무인증 표면 `/api/public/*` + MC 521 production 적재(P3) + `/practice/` 프론트(P4) + 연관 표면(인증 study 라우트, local-progress, wrangler.toml, CI, runbooks)
- 개별 보고서 (본 INDEX 와 동일 디렉토리):
  - `phaseN-tech-debt-20260710-105821-refactoring-expert.md`
  - `phaseN-tech-debt-20260710-105821-performance-engineer.md`
  - `phaseN-tech-debt-20260710-105821-quality-engineer.md`
  - `phaseN-tech-debt-20260710-105821-backend-architect.md`
  - `phaseN-tech-debt-20260710-105821-devops-architect.md`

## §0 페르소나 실행 상태 (은폐 금지 — 전수 확인)

| 페르소나             | 실행         | raw 발견 (C/M/m)                             | 비고                 |
| -------------------- | ------------ | -------------------------------------------- | -------------------- |
| refactoring-expert   | ✅ 실행 완료 | 0 / 4 / 4                                    | 미실행·0건 은폐 없음 |
| performance-engineer | ✅ 실행 완료 | 0 / 4 / 3                                    | 미실행·0건 은폐 없음 |
| quality-engineer     | ✅ 실행 완료 | **1** / 3 / 3                                | CRITICAL 1 (Q-C1)    |
| backend-architect    | ✅ 실행 완료 | **1** / 5 / 2                                | CRITICAL 1 (B-C1)    |
| devops-architect     | ✅ 실행 완료 | 0 / 4 / 3                                    | 미실행·0건 은폐 없음 |
| **raw 합계**         | 5/5          | **CRITICAL 2 / MAJOR 20 / MINOR 15** (계 37) | 누락 페르소나 0      |

## §1 자기 채점 금지 교차검증 — raw ↔ dedup 정합

- **raw CRITICAL 2 > 0 → dedup critical 은 0 이 될 수 없다.** 본 INDEX dedup critical = **1** (병합이지 소멸 아님 — 거짓 음성 없음).
- **raw CRITICAL 병합 귀속 (전수 명시)**:
  - `Q-C1` (quality — 오답 36 old 행이 인증 경로에서 무방비 서빙·채점 + 회귀 테스트 0) → **통합 C-1** 로 병합
  - `B-C1` (backend — old 525 + -MC 521 이중 진실 행, 인증 /next 무가드 + FSRS 분열 + 통계 이중 계상) → **통합 C-1** 로 병합
  - 근거: 동일 파일(`apps/api/src/study/routes.ts`)·동일 라인대(936-938)·동일 뿌리(P3 순수 INSERT 후 old 행 처분 무기한 이연). 두 페르소나가 서로 다른 각도(채점 오답/테스트 공백 vs 데이터 이원화/파생 오염)로 **독립 교차 합의**.
- dedup 산술: raw 37 − 병합 흡수 6건 = **31건** (C 1 / M 19 / m 11). 흡수 내역은 §3 병합 원장 참조.

## §2 CRITICAL 한 줄 매트릭스

| #   | 페르소나 (교차 합의)                                                                                        | 요지                                                                                                                                                                           | 영향                                                                                                                                       | 우선 버킷                                                                                                                                                                                              |
| --- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C-1 | **quality + backend** (2 페르소나 독립 교차 합의, refactoring 은 R-m7 로 MINOR 수위 반향 = 사실상 3중 수렴) | 인증 study `/next` 가 old 525행(확정 오답 36 포함, MC-in-disguise)과 -MC 521행을 이중 무가드 서빙 — 채점은 fill_blank fallback 으로 위치라벨 오답을 정답 기준화, 방어 테스트 0 | '정답 100%' Hard Stop 위반 잔존 + FSRS 이력 이원화 + 통계 이중 계상(525→1,046) + 자연키 중복 — 인증 학습 오픈 즉시 사용자 데이터 영구 오염 | **인증 1차 학습 표면 오픈 전 선결 (L3)**: ① 36 id 회귀 테스트 즉시(자율 가능) ② old 행 처분 상태머신 마이그를 '별도 plan'에서 **오픈 선결 게이트로 승격**(진산 결재) ③ 인증 경로에 서빙 자격 가드 이식 |

- 4-Pass 대비 비중복 확인: 직전 4-Pass(P3/P4)는 공개 표면의 fail-safe 를 검증·통과시켰고(公개 = 안전), C-1 은 그 fail-safe 가 **인증 표면에 부재**하다는 비대칭 — 4-Pass 스코프 밖의 신규 발견(이중 서빙·FSRS 분열·통계 이중 계상은 incident 정본에도 미기재).

## §3 교차 dedup 병합 원장 (동일 file:line·동일 증상 = 1건, 교차 합의 표기)

| 통합 ID | 심각도   | 병합 구성 (raw ID)        | 교차 합의                           | 병합 근거                                                                                                            |
| ------- | -------- | ------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| C-1     | CRITICAL | Q-C1 + B-C1 (+ R-m7 흡수) | quality+backend (+refactoring 반향) | 동일 file(study/routes.ts:936-938)·동일 뿌리(old↔-MC 이중 행). 심각도 = max(CRITICAL)                                |
| M-1     | MAJOR    | R-M1 + B-M6               | refactoring+backend                 | 동일 file(public/routes.ts:236-260 등)·동일 증상(Rule 16 위반 — wrapper/examId 부재). 각도: 3중 복제 vs 종목 축 부재 |
| M-8     | MAJOR    | P-M1 + D-m7 흡수          | performance+devops                  | 동일 file:line(public/routes.ts:256-260)·동일 증상(ORDER BY RANDOM() 풀스캔). devops 는 캐시 0·free tier 각도 반향   |
| M-9     | MAJOR    | P-M2 + Q-m5 흡수          | performance+quality                 | 동일 file(routes.ts:156~277)·동일 증상(결함행 50% 혼합 풀의 확률적 404). quality 는 '통계 잣대 부재' 각도 반향       |
| M-14    | MAJOR    | B-M5 + D-m5 흡수          | backend+devops                      | 동일 file(analytics.ts:38-56)·동일 증상(AE 90일 보존창 증발). 각도: 무버전 스키마 vs 소비자 0                        |

흡수로 소멸한 raw 항목: R-m7(→C-1), Q-m5(→M-9), D-m5(→M-14), D-m7(→M-8) — 내용은 통합 항목과 개별 보고서에 보존, 은폐 없음.

## §4 dedup 발견 전수 목록 (31건 = C 1 / M 19 / m 11)

### CRITICAL (1)

| ID  | raw              | 파일                                              | 요지                                                                     |
| --- | ---------------- | ------------------------------------------------- | ------------------------------------------------------------------------ |
| C-1 | Q-C1+B-C1(+R-m7) | apps/api/src/study/routes.ts:681,823,936-938,1569 | old↔-MC 이중 진실 행 + 오답 36 인증 경로 무가드 서빙·채점, 회귀 테스트 0 |

### MAJOR (19)

| ID   | raw       | 페르소나            | 파일                                                                | 요지                                                                                                 | 진앙 |
| ---- | --------- | ------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---- |
| M-1  | R-M1+B-M6 | refactoring+backend | apps/api/src/public/routes.ts:48,236-260,328-335,440-447            | Rule 16 위반 — examId 무경유 인라인 SQL 3중 복제, 종목 축 부재                                       | RC-2 |
| M-2  | R-M2      | refactoring         | apps/api/src/public/routes.ts:316-422↔428-504                       | /grade↔/reveal ~75줄 동형 중복(계약 코드 5블록 2벌)                                                  | RC-5 |
| M-3  | R-M3      | refactoring         | apps/web/src/components/public/constants.ts:50-57                   | 과목·회차 목록 프론트 하드코딩 — 연 1회 회차 적재마다 무음 stale                                     | RC-5 |
| M-4  | R-M4      | refactoring         | apps/web/src/lib/local-progress/export.ts:1-206                     | export/import·getDueCards 등 UI 소비자 0 — '안전망' 주석과 실체 불일치                               | RC-5 |
| M-5  | Q-M2      | quality             | docs/batch-load/promo-mc-distractors/answer-corrections.json        | 정답 교정 정본 ↔ production 자동 대조(answer-sync) 게이트 부재                                       | RC-1 |
| M-6  | Q-M3      | quality             | apps/web/src/components/public/types.ts:23-50 (api↔web↔e2e)         | 공개 API 계약 3중 수기 선언 + explanation-부재 지배 케이스 미커버                                    | RC-5 |
| M-7  | Q-M4      | quality             | apps/api/src/public/rate-limit.ts:19-35                             | 유일 남용 방어선(IP rate limit) 전 경로 무테스트(fail-closed·429 계약)                               | RC-5 |
| M-8  | P-M1+D-m7 | performance+devops  | apps/api/src/public/routes.ts:256-260                               | ORDER BY RANDOM() = 요청당 풀 전체 스캔 + 캐시 0 — 트래픽×풀 양축 성장 구조                          | RC-4 |
| M-9  | P-M2+Q-m5 | performance+quality | apps/api/src/public/routes.ts:156,166-177,254-277                   | isServable 앱측 사후 필터 + 결함행 50% 풀 잔류 — blank 상시 404·flip 확률적 404                      | RC-1 |
| M-10 | P-M3      | performance         | apps/web/src/pages/index.astro:98                                   | LandingEmbed client:load — 랜딩 뷰마다 무조건 hydration+API+AE(지표 분모 오염)                       | RC-4 |
| M-11 | P-M4      | performance         | apps/api/wrangler.toml:108-112                                      | per-IP 60req/60s — 한국 CGNAT·공유망에서 정상 사용자 집단 429                                        | RC-4 |
| M-12 | B-M2      | backend             | docs/batch-load/promo-mc-distractors/answer-corrections.json        | 정답 진실원 이원화 — 원 소스 batch-Q JSON 오답 36 미정정, 교정이 국지 오버레이 고립                  | RC-1 |
| M-13 | B-M3      | backend             | apps/api/src/db/schema.ts:342-349                                   | schema.ts 0038 화이트리스트 주석 ↔ production 0004 전면 ABORT 드리프트 + 마이그 상태 정본 3중 불일치 | RC-5 |
| M-14 | B-M5+D-m5 | backend+devops      | apps/api/src/public/analytics.ts:38-56                              | AE = 유일 서버 기록인데 ~90일 보존창 + 무버전 blob 스키마 + 소비 경로 0                              | RC-3 |
| M-15 | B-M4      | backend             | docs/plans/s5-6-measurements/backfill-related-nodes-pilot.draft.sql | 출처 추적성 파이프라인이 old id 축 — 서빙 정본(-MC)은 related_nodes NULL 동결, 백필 미커버           | RC-1 |
| M-16 | D-M1      | devops              | docs/adr/ADR-043:3,60                                               | 알림 채널 0 — 홍보 런칭 게이트 BE-6 ② 와 정면 충돌 + cron at-most-once 무재시도                      | RC-3 |
| M-17 | D-M2      | devops              | apps/api/package.json:8-10                                          | 배포 자동화·post-deploy smoke 0 — stale 빌드 사고 전력 구조로 3-아티팩트 표면 런칭                   | RC-3 |
| M-18 | D-M3      | devops              | docs/runbooks/migration-rollback.md:16,109                          | D1 DR 부재 — 정기 백업 0, RPO/RTO 미정의, Time Travel 30일 밖 복원 불가                              | RC-3 |
| M-19 | D-M4      | devops              | apps/api/src/public/routes.ts:360-365,386-394                       | 데이터 결함 신호(422 계약 위반)가 휘발 로그에만 — 결함율 계기판 0 (인시던트 직후인데)                | RC-3 |

### MINOR (11)

| ID   | raw  | 페르소나    | 파일                                                       | 요지                                                                                       | 진앙                                       |
| ---- | ---- | ----------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------ | ---- |
| m-1  | R-m5 | refactoring | apps/web/src/components/public/PublicQuestionCard.tsx 외   | 프론트 컴포넌트 행위·표현 중복(doGrade 2벌·키가드 2벌·헤더 3벌·버튼 ~22곳)                 | RC-5                                       |
| m-2  | R-m6 | refactoring | PublicQuestionCard.tsx:25-40                               | 공용 유틸이 컴포넌트 파일 거주 — 형제 컴포넌트 수평 import                                 | RC-5                                       |
| m-3  | R-m8 | refactoring | apps/web/src/components/session/types.ts:16 외             | stage 리터럴 '1st'                                                                         | '2nd' 다중 선언 — ExamStage 단일 선언 부재 | RC-2 |
| m-4  | P-m5 | performance | apps/api/src/public/choice-id.ts:43-54                     | HMAC importKey 호출마다 재수행 (grade 당 최대 ~10회)                                       | RC-4                                       |
| m-5  | P-m6 | performance | apps/web/src/components/public/PublicPracticeApp.tsx:60-71 | 클라 중복회피 직렬 3회 재시도 — 소풀 필터에서 RTT×3 + 스캔 3배                             | RC-4                                       |
| m-6  | P-m7 | performance | apps/web/src/layouts/BaseLayout.astro:53-60                | 가변폰트 main 505KB preload — 사용 웨이트 400/500뿐                                        | RC-4                                       |
| m-7  | Q-m6 | quality     | apps/web/src/lib/share-image.ts                            | share-image 테스트 0 + E2E adverse-path(429 UX·오프라인) 0                                 | RC-5                                       |
| m-8  | Q-m7 | quality     | docs/plans/promo-1st-p4-frontend-ledger.md:43,52           | 모드별 라이브 데이터 존재 smoke 게이트 부재 — E2E mock 은 영원히 green                     | RC-3                                       |
| m-9  | B-m7 | backend     | docs/batch-load/promo-mc-distractors/REPORT.md:63          | '-MC' 접미사 규약 임시성 — LIKE '%-MC' 가 유일 계열 식별자, 후속 규약 미정의               | RC-1                                       |
| m-10 | B-m8 | backend     | apps/web/src/lib/local-progress/db.ts:33-34                | 로컬 FSRS cardId 가 -MC id 결합 — 정본화 방향 결정 시 이력 고아화 리스크                   | RC-1                                       |
| m-11 | D-m6 | devops      | apps/api/src/public/routes.ts:282,367-374                  | JWT_SECRET 이중 용도 + '' 폴백 — 로테이션 시 in-flight 객관식 무음 오답 처리, runbook 부재 | RC-3                                       |

## §5 진앙 (Root Clusters) — 여러 페르소나가 같은 뿌리를 가리킨 부채 묶음

### RC-1: 이중 진실 행·정답 정본 미봉합 (exam_questions old↔-MC 체제의 나머지 절반)

- **합의 페르소나**: quality + backend + performance (+refactoring 반향) — 4/5 수렴, 최다 합의 진앙
- **구성**: C-1, M-5, M-9, M-12, M-15, m-9, m-10 (흡수: R-m7, Q-m5)
- **뿌리**: P3 가 순수 INSERT(-MC 521)로 공개 표면만 정화하고, old 525행 처분(상태머신 마이그)·원 소스 JSON 정정·정본 판별 규약·메타 이중 계열 동기를 전부 '별도 plan/carry-over'로 시한 없이 이연 — 정본이 무엇인지 DB·소스·게이트 어디도 못 박지 못한 상태.
- **권고 액션**: old 행 처분 L3 plan 1건으로 묶어 상신하되 **'인증 1차 학습 표면 오픈의 선결 게이트'로 승격**(진산 결재). 동봉 항목: ① servable 파생 컬럼/전용 status ② superseded_by 마킹 ③ -MC 접미사 규약 결정 ④ 로컬 cardId 연속성 평가 기준. plan 과 독립으로 **즉시(자율 가능)**: 36 id 회귀 테스트 + packages/quality answer-sync 워터마크 게이트(formula-sync 패턴 복제) + corrections 오버레이 승격·소비 가드.

### RC-2: 멀티시험 경계 계약(Rule 16/17) — 신규 public 코드의 미이행

- **합의 페르소나**: refactoring + backend — 2/5 교차 합의
- **구성**: M-1, m-3
- **뿌리**: 신규 코드 예외 봉쇄(Rule 15/16)에도 공개 라우트가 examId 무경유 인라인 SQL 로 작성 — 07-04 R5(플랫폼 공유 D1 + 종목 서브도메인) 확정 체제에서 2호 적재 즉시 무음 교차 서빙·복붙 재오염 궤도.
- **권고 액션**: public/queries.ts wrapper 추출(첫 인자 ExamId) + createPublicRoutes(config) mount 주입 파라미터화 (~1h, 행위 불변). ExamStage 단일 선언은 M1(exams/ 골격) plan 에 1줄 편승.

### RC-3: 공개 표면 운영 안전망 공백 (알림·배포검증·DR·결함 계기판)

- **합의 페르소나**: devops + backend + quality — 3/5 수렴
- **구성**: M-14, M-16, M-17, M-18, M-19, m-8, m-11 (흡수: D-m5)
- **뿌리**: 무인증 공개 표면이 인터넷 직결 런칭 궤도인데 서버측 안전망이 전부 0 — 알림 채널 0(자체 게이트 BE-6 ② 위반 상태), post-deploy smoke 0(stale 빌드 사고 전력), D1 백업/DR 0, 결함·429 계기판 0, AE 는 write-only + 90일 증발.
- **권고 액션**: **P5 배포 체크리스트에 blocking 3항 등재**: ① BE-6 ② 알림 1채널 ② scripts/smoke-public-surface.ts(next→grade→reveal 왕복 + 모드×3 기대 상태 assert) ③ 422 defect 경로 AE/telemetry 편입. 후속: d1-disaster-recovery runbook(주 1회 export→R2, RPO/RTO 명문화) + AE 롤업 cron + secret-rotation runbook.

### RC-4: 홍보 hot path 스케일 구조 (트래픽 스파이크 = 설계 목표인데 요청당 비용 O(pool))

- **합의 페르소나**: performance + devops — 2/5 교차 합의
- **구성**: M-8, M-10, M-11, m-4, m-5, m-6 (흡수: D-m7)
- **뿌리**: 서빙 골격이 '무상태 랜덤 + 풀 전체 스캔 + 클라 재시도 + 뷰마다 무조건 fan-out' — 풀 크기(멀티시험)와 트래픽(홍보 성공) 두 축이 동시에 자라면 D1 rows_read·429·지연이 곱연산으로 악화.
- **권고 액션**: 1개 마이그로 동승 — random_key 컬럼+복합 인덱스 범위 픽 + /next exclude 파라미터. 프론트는 client:visible 전환(1줄). rate limit 은 120~180/min 상향 또는 네임스페이스 분리 + 429 발생률 계측 후 런칭 첫 주 실측 조정.

### RC-5: 계약·정본 단일원 부재 — 지도(선언)와 실체의 드리프트 그물 없음

- **합의 페르소나**: quality + refactoring + backend — 3/5 수렴
- **구성**: M-2, M-3, M-4, M-6, M-7, M-13, m-1, m-2, m-7
- **뿌리**: 같은 진실이 여러 곳에 수기 복제(공개 API 계약 3중, grade/reveal 계약 코드 2벌, 과목·회차 스냅샷 하드코딩, schema.ts 주석 ↔ production 트리거, 주석의 '안전망' ↔ 미배선 실체)돼 있고 드리프트를 잡을 기계 장치(공유 타입·계약 테스트·상태 정본 동기 의무)가 없다 — 'web E2E 15건 전체 파손'(06-12) 실증 클래스의 재축적.
- **권고 액션**: ① 공개 계약 타입 packages/shared 단일화(web·e2e-mock import) + explanation-absent 픽스처 ② schema.ts 에 'production = 0004 현행, 0038 미적용' 1줄 + production-migration-status.md 동기(CLAUDE.md 동기 의무와 동일 규칙) ③ GET /api/public/meta 로 하드코딩 상수 폴백 강등 ④ rate-limit 정책 단위 테스트 3건 ⑤ local-progress 주석 정정 또는 export 버튼 1개 배선.

## §6 합계 및 "완료" 판정

| 구분                  | CRITICAL | MAJOR  | MINOR  | 계     |
| --------------------- | -------- | ------ | ------ | ------ |
| raw (5 페르소나 합산) | 2        | 20     | 15     | 37     |
| **dedup (통합)**      | **1**    | **19** | **11** | **31** |

- **판정: "완료" 선언 불가.** 기준(auto-review-protocol.md) = 4-Pass CRITICAL 0 **AND** 5-페르소나 CRITICAL 0 — 본 리뷰 5-페르소나 CRITICAL **1건(C-1)** 잔존.
- C-1 처분 경로: 즉시 자율 가능분(36 id 회귀 테스트) + L3 결재분(old 행 상태머신 마이그 = 인증 학습 오픈 선결 게이트 승격, RULE — 자율 코딩 금지·진산 결재 후).
- **MAJOR 19건 처분 규칙**: phase 종료 전 해결 또는 다음 phase(P5 배포 / 인증 런칭 스프린트) 초기 태스크로 **명시 이월** — 권고 버킷: P5 배포 blocking = M-16·M-17(smoke 한정)·M-7 / 인증 오픈 선결 = C-1 연동(M-5·M-12·M-15) / 2호 착수 전 = M-1·M-13 / 마이그 동승 = M-8·M-9 / 저비용 즉시 = M-2·M-3·M-4·M-6·M-10·M-14·M-19 / 실측 후 조정 = M-11·M-18.
- 본 INDEX 는 문제 사실·권고까지만 못박는다 — 이월 vs 즉시 해소의 최종 결재는 진산 (RULE #5).
