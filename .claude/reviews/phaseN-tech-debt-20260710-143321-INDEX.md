# Phase N (promo-1st P0~P5) 5-페르소나 기술부채 통합 인덱스

- ts: 20260710-143321 (2026-07-10)
- 스코프: promo-1st P0~P5 체인(공개 학습 표면 BE+FE, serving-guard, MC 적재 스크립트, 배포 게이트) + 잔존 데이터·운영 부채
- 프로토콜: `.claude/rules/auto-review-protocol.md` Phase 단위 5-페르소나 기술부채 심층 리뷰
- 개별 보고서:
  - `phaseN-tech-debt-20260710-143321-refactoring-expert.md` (M6/m5)
  - `phaseN-tech-debt-20260710-143321-performance-engineer.md` (M4/m3)
  - `phaseN-tech-debt-20260710-143321-quality-engineer.md` (C1/M4/m2)
  - `phaseN-tech-debt-20260710-143321-backend-architect.md` (C1/M2/m3)
  - `phaseN-tech-debt-20260710-143321-devops-architect.md` (C1/M3/m3)

## 0. 페르소나 실행 상태 (은폐 금지)

| 페르소나             | 실행    | 발견 (raw C/M/m) |
| -------------------- | ------- | ---------------- |
| refactoring-expert   | ✅ 실행 | 0 / 6 / 5        |
| performance-engineer | ✅ 실행 | 0 / 4 / 3        |
| quality-engineer     | ✅ 실행 | 1 / 4 / 2        |
| backend-architect    | ✅ 실행 | 1 / 2 / 3        |
| devops-architect     | ✅ 실행 | 1 / 3 / 3        |

**5/5 전 페르소나 실행 — 미실행·누락(0건 페르소나) 없음.** backend-architect 는 직전 보고서(`phaseN-tech-debt-20260710-105821-backend-architect.md` B-C1~B-m8)와의 중복 배제를 명시 적용(잔존 부채는 그쪽 원장 유효).

## 1. 합계 (자기 채점 금지 교차검증)

| 구분              | CRITICAL |  MAJOR |  MINOR |     계 |
| ----------------- | -------: | -----: | -----: | -----: |
| **raw 발견 합계** |    **3** | **19** | **16** |     38 |
| 교차 dedup 병합   |       −0 |     −1 |     −1 |     −2 |
| **dedup 확정**    |    **3** | **18** | **15** | **36** |

- 병합 2건: ① RF-M3 + BE-M3 (서빙 자격 이원화·비물질화, MAJOR×2 → MAJOR 1) ② QA-M4 + DO-m5 (스모크 미배선, MAJOR+MINOR → 상위 MAJOR 1 유지).
- **raw CRITICAL 3 의 병합 귀속 (거짓 음성 차단)**: QA-C1 → D-01 / BE-C1 → D-02 / DO-C1 → D-03. 세 건 모두 파일·증상·소유 축이 상이하여 **병합 없이 각각 독립 CRITICAL 로 생존** — dedup 후에도 CRITICAL = 3 (0 아님).

## 2. CRITICAL 한 줄 매트릭스

| #            | 페르소나 | 요지                                                                                                                                                      | 영향                                                                               | 우선 버킷                                                                                                  |
| ------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| D-01 (QA-C1) | quality  | @thepick/web 단위 테스트 전체 CI 미배선 (ci.yml:56-69 필터 누락 — WS-0a 151테스트 사고 동일 클래스 재발)                                                  | 공개 표면·FSRS 로컬 진도 회귀가 CI green 인 채 무음 병합                           | **즉시** (1줄 픽스 + `--if-present` 근본책)                                                                |
| D-02 (BE-C1) | backend  | /study/next 결정적 정렬 × serving-guard 사후필터 = 오버샘플 창을 미시도 old 행이 영구 점유 → 조기 거짓 `exhausted:true` (study/routes.ts:879-888,930-955) | 인증 1차 학습 루프 전체 사망 — 첫 도그푸딩 세션에서 문항 2~14개 후 즉시 재현       | **인증 1차 도그푸딩 전 선결** (단기 SQL 근사 / 정본 = old 행 상태머신 L3 마이그를 오픈 선결 게이트로 승격) |
| D-03 (DO-C1) | devops   | D1 DR = Time Travel 30일 단일 의존, 자동 off-DB export 0 (runbook:130,165)                                                                                | 30일+ 잠복 결함(실전 전력 2건) 발견 시 user_progress·검수 승급 이력 영구 복구 불가 | **런칭 전** (주간 d1 export → R2 cron + RPO/RTO 런북)                                                      |

## 3. dedup 발견 원장 (36건)

표기: 페르소나 약칭 RF/PF/QA/BE/DO. ★ = 교차 합의 병합.

### CRITICAL (3)

| ID   | 심각도   | 위치                                           | 요지                                              | 페르소나 | 진앙 |
| ---- | -------- | ---------------------------------------------- | ------------------------------------------------- | -------- | ---- |
| D-01 | CRITICAL | .github/workflows/ci.yml:56-69                 | @thepick/web 테스트 CI 미배선                     | QA       | RC-4 |
| D-02 | CRITICAL | apps/api/src/study/routes.ts:879-888,930-955   | 결정적 정렬×가드 = 거짓 exhausted, 학습 루프 사망 | BE       | RC-1 |
| D-03 | CRITICAL | docs/runbooks/production-deployment.md:130,165 | D1 DR = Time Travel 30일 단일, export 자동화 0    | DO       | RC-6 |

### MAJOR (18)

| ID     | 위치                                                                         | 요지                                                                                                                            | 페르소나                                           | 진앙   |
| ------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------ |
| D-04   | apps/api/src/public/routes.ts:48 외 7사이트                                  | ExamType('1st'\|'2nd') 유니온 6곳+ 독립 선언, Rule 15/16/17 계열 부채 신규 증식                                                 | RF                                                 | RC-3   |
| D-05   | apps/api/src/public/routes.ts:378-499 vs 505-587                             | /grade↔/reveal ~110줄 준중복 — 이미 드리프트(reveal defect AE 부재 = 결함율 과소집계 진행 중)                                   | RF                                                 | RC-2   |
| D-06 ★ | apps/api/src/public/routes.ts:166-177,229-256 + study/serving-guard.ts:41-49 | 서빙 자격 판정 이원화(양성 isServable vs 음성 isMisgradableRow) + DB 비물질화 — 술어 2종·소비 3표면 분산, overview 전 행 풀스캔 | **RF×BE 교차 합의** (RF-M3+BE-M3 병합)             | RC-2   |
| D-07   | apps/web/src/components/public/constants.ts:50-57                            | 픽커 과목·회차 하드코딩 — 같은 화면 overview API 와 이중 진실원, 제12회 적재·개정 직격                                          | RF                                                 | RC-3   |
| D-08   | apps/web/src/components/public/PracticeMap.tsx:69                            | 소스에 리터럴 NUL(0x00) — git 바이너리 판정, diff/blame/4-Pass 스코핑 상실                                                      | RF                                                 | (단독) |
| D-09   | apps/api/src/study/serving-guard.ts:15-17                                    | 오답 36 포함 old 525행 status='active' 잔존 — 차단이 소비자별 JS 술어 위탁(shotgun), 3번째 소비자 = 가드 누락 기본값            | RF                                                 | RC-1   |
| D-10   | apps/api/src/public/routes.ts:312-316                                        | /next ORDER BY RANDOM() 전 풀 스캔/요청 — 무료 플랜이면 ~600 DAU 에서 D1 다운, 플랜 자체 미확인                                 | PF                                                 | RC-5   |
| D-11   | apps/api/src/middleware/cache-policy.ts:63-71                                | overview '5분 공용 캐시' 전제가 workers.dev 에서 미실현 — 방문자당 전 행 전송+O(N) 파스                                         | PF                                                 | RC-5   |
| D-12   | apps/api/src/index.ts:145-162                                                | 읽기 전용 공개 hot path 에 매 요청 PRAGMA exec = 직렬 D1 RTT +1                                                                 | PF                                                 | RC-5   |
| D-13   | apps/web/src/components/public/PublicPracticeApp.tsx:61-72                   | 중복 회피 직렬 3회 재호출 — exclude 부재로 좁은 필터에서 요청·스캔 3배 + 429 경계                                               | PF                                                 | RC-5   |
| D-14   | docs/batch-load/promo-mc-distractors/answer-corrections.json                 | 정답 교정 36건 영속 기계 게이트 부재 — 검증이 수동 1회, old 행 마이그 시 재검산 수단 0                                          | QA                                                 | RC-1   |
| D-15   | apps/web/src/components/public/types.ts:8-69                                 | 공개 API 계약 이원 수작업 정의 + E2E 수기 mock — 드리프트가 전 테스트 green 인 채 진행 가능                                     | QA                                                 | RC-3   |
| D-16 ★ | scripts/smoke-public-surface.mjs:1-17                                        | 배포 스모크(정답 비노출 assert 포함 14체크)가 어떤 자동 파이프라인에도 미배선 — 기억 의존 게이트                                | **QA×DO 교차 합의** (QA-M4+DO-m5 병합, 상위 MAJOR) | RC-4   |
| D-17   | apps/api/src/public/routes.ts:436-448                                        | choiceId HMAC secret 회전 시 무음 오채점 — resolve null 텔레메트리·테스트 0, 진단 불능                                          | QA                                                 | RC-6   |
| D-18   | apps/api/src/study/routes.ts:1589,1653-1674                                  | 통계·categoryAvailable 이중 계상 잔존 + ':1668 동치 불변식' 주석이 C-1 가드로 파손 — 공개(521) vs 인증(1,046) 발산              | BE                                                 | RC-1   |
| D-19   | apps/api/src/scheduled/silent-failure-monitor.ts:14-18                       | 공개 표면 라이브인데 alert 채널 0 + cron dead-man switch 0                                                                      | DO                                                 | RC-6   |
| D-20   | apps/api/src/public/analytics.ts:1-9,44-67                                   | AE = 지표·결함율 유일 원천인데 조회 소비자 0(writer-only) + 보존 ~90일 롤링 소멸                                                | DO                                                 | RC-6   |
| D-21   | apps/web/package.json:10                                                     | 배포물↔git SHA 추적성 단절 (`--commit-dirty=true` + 수동 wrangler + push 보류 관행) — 404 3주 사고 동일 클래스                  | DO                                                 | RC-6   |

### MINOR (15)

| ID   | 위치                                                 | 요지                                                                      | 페르소나 | 진앙   |
| ---- | ---------------------------------------------------- | ------------------------------------------------------------------------- | -------- | ------ |
| D-22 | apps/api/src/public/routes.ts:338,436,555            | choiceId secret 해석 2단 분산(`?? ''` ×3 + 은닉 폴백)                     | RF       | RC-3   |
| D-23 | apps/web/src/components/public/api.ts:19-30          | 공개 API 에러코드 서버·클라 이중 선언                                     | RF       | RC-3   |
| D-24 | apps/web/src/components/public/BlankNote.tsx:16      | sourceTextOf 가 카드 컴포넌트 파일에 기생 — 역의존                        | RF       | (단독) |
| D-25 | apps/api/src/public/analytics.ts:50-63               | AE blob 위치 스키마 무버전                                                | RF       | RC-6   |
| D-26 | apps/api/src/study/routes.ts:1-2252                  | study/routes God 모듈 지속 성장(+135줄)                                   | RF       | (단독) |
| D-27 | apps/api/src/public/choice-id.ts:43-54               | HMAC importKey 매 호출 재수행 + 직렬 await                                | PF       | RC-5   |
| D-28 | apps/api/src/public/routes.ts:292-333                | blank 모드 = 항상 404 인데 매번 525행 스캔(dead-weight)                   | PF       | RC-5   |
| D-29 | apps/web/src/components/public/StreakPanel.tsx:33-44 | 채점마다 31일 리뷰 전량 toArray 재조회                                    | PF       | (단독) |
| D-30 | docs/batch-load/promo-mc-distractors/REPORT.md §6-§7 | old 525+MC 521 이원 행 워터마크 영속 테스트 부재 — 집계 분모 오염         | QA       | RC-1   |
| D-31 | apps/api/src/public/routes.ts:156,310-333            | 결함행 밀집 버킷의 확률적 404 — 경계(결함>10) 테스트 미커버               | QA       | RC-2   |
| D-32 | apps/web/src/lib/local-progress/db.ts:46-57,100-108  | reviews 스토어 append-only 무한 성장 — GC/보존 정책 0                     | BE       | (단독) |
| D-33 | apps/api/src/middleware/cache-policy.ts:68           | overview 예외 경로 리터럴 이중 선언                                       | BE       | RC-3   |
| D-34 | apps/api/src/study/serving-guard.ts:31               | GUARDED_EXAM_TYPES·OVERSAMPLE = 데이터 상태 결부 상수, 해제 조건 미기계화 | BE       | RC-1   |
| D-35 | apps/api/src/index.ts:38-52                          | CORS origin 하드코딩 — 서브도메인 전개 결재와 긴장                        | DO       | RC-3   |
| D-36 | apps/api/src/auth/session.ts:53-56                   | secret 로테이션 설계·runbook 부재(kid/이중 검증 0)                        | DO       | RC-6   |

## 4. 진앙 (root clusters) — 6개

### RC-1. old 행 상태머신 미처분 — 오답 36 포함 old 525행 active 잔존이 낳는 파생 부채군

- 구성: **D-02(C)**, D-09, D-14, D-18, D-30, D-34 (+ D-28 연관)
- 교차: backend·refactoring·quality 3 페르소나 합의. 이번 리뷰 최대 진앙 — CRITICAL 1 + MAJOR 3 + MINOR 2 가 전부 "old 행이 데이터 계층에서 여전히 정상 행"이라는 단일 뿌리에서 파생.
- 권고 액션: ① old 행 superseded 상태머신 L3 마이그(plan+진산 결재)를 **인증 1차 오픈 선결 게이트로 승격** ② 그 전 단기: /study/next 정렬·오버샘플 SQL 근사 수리(D-02) + 통계 4쿼리 가드 동기(D-18) ③ answer-integrity 영속 스크립트(교정 36 + 이원 행 워터마크 assert, D-14+D-30)를 마이그 Binary Gate 선결 조건으로 명기 ④ 마이그 완료 게이트에 serving-guard 폐기 경로(D-34) 등재.

### RC-2. 서빙 자격 판정 정본 부재 — 술어 2종·3표면 분산 + DB 비물질화

- 구성: **D-06★(RF×BE 병합)**, D-05, D-31
- 권고 액션: packages/learning-modes 에 assessGradability(row) 코어 판정 신설(위치라벨×보기 계약), isServable/isMisgradableRow 는 표면 정책 어댑터로 축소. 중기: servable/serving_class 물질화 컬럼(0038 화이트리스트 등재) 후 overview GROUP BY 강하. grade/reveal 공통 함수 추출 + reveal defect AE 보강(D-05).

### RC-3. exam 축·계약 선언 분산 — packages/shared 단일 정본 부재의 재생산

- 구성: D-04, D-07, D-15, D-22, D-23, D-33, D-35
- 교차: refactoring·quality·backend·devops 4 페르소나가 같은 패턴(리터럴/타입/경로/origin 의 다중 선언)을 각자 표면에서 적발. 07-04 엔진분리 리뷰의 '오염 진앙 = shared 유니온 3중선언'과 동일 클래스 — M1 plan 탈오염 표적에 exam_type·공개 계약 축 미포함.
- 권고 액션: packages/shared 에 EXAM_TYPES/ExamType·PUBLIC_ERROR_CODES·공개 응답 타입 단일 선언 → 전 사이트 import 수렴(기계 치환). 픽커는 overview 응답을 필터 원천으로(하드코딩 폴백 강등). M1 plan 원장에 exam_type 축 + CORS env 주입 항목 추가.

### RC-4. 게이트 배선 공백 — 게이트가 존재하나 어느 자동 경로에도 연결 안 됨

- 구성: **D-01(C)**, D-16★(QA×DO 병합)
- 근거: WS-0a(151 테스트 무음 미실행) 동일 클래스의 실증 재발. "만들었으나 배선 안 함" = 이 레포 반복 사고 패턴.
- 권고 액션: ① ci.yml 에 `--filter @thepick/web` 즉시 추가 + 근본책 `pnpm -r --if-present test` 전환(3차 재발 차단) ② deploy:production 을 `wrangler deploy && smoke-public-surface.mjs` 체인으로 재정의(실패 exit 1) + 런북 §추가.

### RC-5. 공개 무인증 hot path 스케일 비용 — RANDOM 풀스캔·캐시 미실현·RTT 직렬 증폭

- 구성: D-10, D-11, D-12, D-13, D-27, D-28
- 권고 액션: ⓪ production Workers/D1 플랜 실측 확인(선결 — D-10 심각도 확정 변수) ① servable id 목록 캐시 후 단건 PK 조회(rows-read O(1)) ② /next exclude 파라미터(또는 세션 일괄 서빙)로 재시도 루프 제거 ③ 커스텀 도메인 전환 시 overview Cache Rule 명시 ④ PRAGMA 를 쓰기 라우트 한정.

### RC-6. 운영 관측·복구·추적성 공백 — 기록은 있으나 읽는 자·알리는 자·되돌릴 자 없음

- 구성: **D-03(C)**, D-17, D-19, D-20, D-21, D-25, D-36
- 권고 액션: ① 주간 d1 export → R2 cron + RPO/RTO 런북(D-03, 최우선) ② ADR-043 Email Routing carry-over 이행 + cron heartbeat dead-man(D-19) ③ AE 조회 스크립트 + 일일 D1 스냅샷 적재·defect 임계 편입(D-20) + blob 버전 규약(D-25) ④ `--commit-dirty` 제거 + SHA 스탬프(D-21) ⑤ choiceId resolve null AE 이벤트+테스트(D-17), secret 로테이션 runbook 은 런칭 하드닝 chunk 편입(D-36).

- (진앙 외 단독 4건: D-08 NUL 바이트 — 1줄 치환 즉시 처리 권고 / D-24 / D-26 / D-29 / D-32)

## 5. "완료" 선언 판정

- 기준: 4-Pass CRITICAL 0 **AND** 5-페르소나 CRITICAL 0.
- **판정: 완료 선언 불가 — 5-페르소나 CRITICAL 3건 (D-01, D-02, D-03).**
- MAJOR 18건: phase 종료 전 해결 또는 다음 phase 초기 태스크로 **명시 이월** 의무. 이월 시 본 인덱스 ID(D-04~D-21)로 원장 추적.
- 참고: D-02 의 정본 해소(old 행 마이그)와 D-14 의 answer-integrity 게이트는 **L3 영역(마이그/데이터) = 진산 결재 후 착수** — 페르소나 권고는 즉시 수정 지시가 아니라 결재 자료다 (RULE #5 준수, GO/STOP = 인간).

## 6. 우선 버킷 요약

| 버킷                         | 항목                                                                 |
| ---------------------------- | -------------------------------------------------------------------- |
| 즉시 (저비용·비L3)           | D-01 (ci.yml 1줄+근본책), D-08 (NUL 치환), D-16 (deploy 체인)        |
| 인증 1차 오픈 선결           | D-02 (단기 SQL 수리 + 정본 = old 행 마이그 게이트 승격), D-18        |
| 런칭 전                      | D-03 (백업 cron), D-19 (alert), D-17 (choiceId 회전), D-36           |
| L3 결재 대기 (진산)          | old 행 상태머신 마이그 (RC-1 정본 해소), servable 물질화 컬럼 (RC-2) |
| 다음 phase 이월 후보 (MAJOR) | D-04~D-07, D-10~D-15, D-20, D-21 — 이월 시 명시 기록                 |
