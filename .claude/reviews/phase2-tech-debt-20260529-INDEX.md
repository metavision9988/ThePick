# Phase 2 기술부채 5-페르소나 독립 병렬 리뷰 — 통합 인덱스

> **리뷰 시점**: 2026-05-29 (Session 092 진입 직후)
> **트리거**: 진산 명시 요청 — "전체 재점검, 자가 검증 편향 차단, 5개 전문 페르소나 독립 병렬, 기술부채 관점"
> **편향 차단**: 5 페르소나가 **단일 메시지 병렬 호출**(메인 대화 의도 0) + 영역 분할 명시(중복 금지) + 증거 의무(file:line) + 반론 의무
> **4-Pass 리뷰와의 관계**: 본 리뷰는 **6개월 ~ 2년 horizon 기술부채** 전용 (Surgeon/Architect/Advocate/Contract 와 중복 금지)

---

## 1. 5 보고서 인덱스

| 페르소나             | 보고서                                                                                 |   LOC | C / M / m        | 소요            |
| :------------------- | :------------------------------------------------------------------------------------- | ----: | :--------------- | :-------------- |
| refactoring-expert   | [phase2-tech-debt-20260529-refactoring.md](./phase2-tech-debt-20260529-refactoring.md) |   408 | **3** / 6 / 5    | 9.7m            |
| performance-engineer | [phase2-tech-debt-20260529-performance.md](./phase2-tech-debt-20260529-performance.md) |   297 | **5** / 8 / 5    | 11.0m           |
| quality-engineer     | [phase2-tech-debt-20260529-quality.md](./phase2-tech-debt-20260529-quality.md)         |   236 | **8** / 6 / 4    | 9.3m            |
| backend-architect    | [phase2-tech-debt-20260529-backend.md](./phase2-tech-debt-20260529-backend.md)         |   603 | **7** / 6 / 3    | 11.6m           |
| devops-architect     | [phase2-tech-debt-20260529-devops.md](./phase2-tech-debt-20260529-devops.md)           |   309 | **4** / 6 / 4    | 7.0m            |
| **합계**             | —                                                                                      | 1,853 | **27 / 32 / 21** | 48.6m wallclock |

---

## 2. CRITICAL 27건 한 줄 매트릭스 + 진산 결재 영향도

| #    | 페르소나    | 제목 (요지)                                                                                                                                             | 진산 단계 영향                                  | 우선 버킷     |
| :--- | :---------- | :------------------------------------------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------- | :------------ |
| C-B7 | backend     | ⛔ `prevent_exam_questions_update` 트리거가 `related_nodes` backfill 차단 → **golden BATCH 진행 자체 불가**                                             | **★진산 검수 완료해도 approved 동결 자체 막힘** | **TR-0 즉시** |
| C-Q1 | quality     | G-S5 golden N=12 통계 유의도 부재 — 도구는 정확, 분모 결정 못함                                                                                         | **★pilot 측정 결론 의미 결정**                  | **TR-0 즉시** |
| C-B6 | backend     | `study/routes.ts:496-516` 가 `approved-nodes-sql.ts` 단일 진실원 **우회** → flagged 노드 학습자 출처 화면 노출 위험                                     | ★북극성(생성물 신뢰성) 위반                     | TR-1          |
| C-B5 | backend     | Vectorize bootstrap (`vectorize/routes.ts:329-348`) 가 `is_current_active` 무시 + `is_active=true` 하드코딩 — `schema.ts:191-207` @deprecated 정책 위반 | ★북극성 위반                                    | TR-1          |
| C-B4 | backend     | 4-way 데이터 일관성(knowledge_nodes ↔ Vectorize ↔ exam_questions.related_nodes ↔ table_node_links) **sync 메커니즘 전체 부재**                          | G-S5 측정 신뢰도 + 학습자 회귀                  | TR-1          |
| C-B1 | backend     | 노드 ID 패턴 `\d{3}` **999 천장** + `table_structures` DB GLOB CHECK 잠금 → Year 2 진입 즉시 적재 거부                                                  | Year 2 진입 stop-the-world                      | TR-4          |
| C-R1 | refactoring | `lv1_insurance`/`lv2_crop`/`lv3_investigation` 시험 특화 컬럼이 **10+ 파일에 직접 박힘** (Hard Rule 15 위반)                                            | Year 2 zero-cost 위반                           | TR-4          |
| C-R2 | refactoring | `service: 'thepick-api'` 리터럴 + `resolveLoggerEnv()`/`buildLogger()` **6 파일 복제**                                                                  | 다음 시험 추가 시 N배                           | TR-4          |
| C-R3 | refactoring | `packages/study-material-generator` 가 `export {}` 만 — **빈 패키지 모노레포 점유**                                                                     | 의도/실태 drift                                 | TR-3          |
| C-B2 | backend     | Drizzle ↔ D1 shape drift — 0029/0033/0037 인덱스가 `schema.ts` 미반영, **NC-1 invariant 이미 깨짐**                                                     | 다음 마이그 시 silent drift                     | TR-2          |
| C-B3 | backend     | `status_transitions`/`review_decisions`/`engine_telemetry` 3 테이블 **무한 append-only** (트리거 잠금) + GC 0                                           | G-S5 측정 후 SLO 폭탄                           | TR-2          |
| C-Q2 | quality     | `parser-1st-exam` 테스트 **0건** — 545 기출문항이 검증 없이 production 적재 완료                                                                        | 매년 개정 회귀 0 검출                           | TR-2          |
| C-Q3 | quality     | `learning-modes` **OX/True-False input type 미구현** — Hard Stop 3종 중 1종 부재                                                                        | 정답 안전 Hard Stop 위반                        | TR-2          |
| C-Q4 | quality     | `SCENARIO_MIGRATIONS` 정적 배열 — 0021~0027 미커버 (Table-as-Micro-KG + review-queue)                                                                   | 시나리오 회귀 검출 0                            | TR-2          |
| C-Q5 | quality     | `AnthropicAdapter` 실 Claude API 호출 **부재** — `NOT_IMPLEMENTED` throw만 테스트                                                                       | BATCH 파이프라인 실연결 0                       | TR-2          |
| C-Q6 | quality     | 암기법 **역방향 검증** = master-checklist `[ ]` + 코드 부재 + 테스트 부재                                                                               | Hard Limit 정책 자체 미구현                     | TR-2          |
| C-Q7 | quality     | `@thepick/payment` `--passWithNoTests` + production 트래픽 영역 = 회귀 검출 인프라 0                                                                    | 결제 사고 시 진단 0                             | TR-3          |
| C-Q8 | quality     | Playwright E2E **전부 mock-server 기반** — 실 apps/api contract drift 검출 0                                                                            | 학습자 골든 패스 회귀 0                         | TR-3          |
| C-P1 | performance | `GET /api/study/mode` **7-쿼리 fan-out** + 2 cold table SCAN — 매 사용자 페이지 로드                                                                    | 시험 시즌 부하 진앙                             | TR-2          |
| C-P2 | performance | `/api/search` Multi-Path Fallback Stage 3.c **시리얼 + 최악 13 RTT**                                                                                    | 시험 시즌 학습자 첫 검색                        | TR-2          |
| C-P3 | performance | Graph walk WITH RECURSIVE depth4 = **41.5ms** (Workers free 50ms 한도와 동률) — S5-7 통합 시 hot path 진입                                              | S5-7 GO 차단/조건부                             | TR-1          |
| C-P4 | performance | `/api/study/grade` 한 요청당 **8+ D1 직렬 chain ~330ms** — FSRS 채점 hot path                                                                           | 시험 시즌 가장 빈번한 쓰기                      | TR-2          |
| C-P5 | performance | `app.use('*', PRAGMA foreign_keys=ON)` = **모든 요청에 D1 PRAGMA RTT** — **측정 1순위** (영향 면적 최대)                                                | 전 엔드포인트 지속 부담                         | **TR-1**      |
| C-D1 | devops      | Worker → R2 **Logpush 미연결** — wrangler tail 없으면 critical 알림 휘발                                                                                | 운영 시 사고 진단 0                             | TR-3          |
| C-D2 | devops      | production **deploy 자동화 0건** — 휴먼 에러 surface 영구 노출                                                                                          | Phase 3 launch 직전 폭주                        | TR-3          |
| C-D3 | devops      | D1 **disaster recovery runbook 부재** — RPO/RTO 정의 0 (30일 Time Travel 외)                                                                            | 신년 첫 사고 = 1인 즉흥 대응                    | TR-3          |
| C-D4 | devops      | **Secret 로테이션 정책 0건** — 한 번 박힌 production secret 영원 사용                                                                                   | Year 2까지 누적 → 회수 비용↑                    | TR-4          |

---

## 3. 페르소나 교차 합의 (진앙 = 부채 묶음의 뿌리)

### 진앙 #1 — **단일 진실원 우회 클러스터** (학습자 정직성 위협 = 북극성 직격)

- **backend C-5**: Vectorize bootstrap `is_active=true` 하드코딩
- **backend C-6**: study/routes.ts 가 `approved-nodes-sql.ts` 우회
- **quality C-1**: G-S5 측정이 단일 진실원 출처 검증 없이 가능
- **refactoring 잠재**: `approved-nodes-sql.ts` 가 4 호출 측을 통합했으나 신규 우회 발생 → **린트 강제 부재**
- → **권고**: ESLint custom rule 또는 runtime guard 로 "knowledge_nodes 직접 SELECT 시 approved 조건 강제" 차단

### 진앙 #2 — **Year 2 zero-cost 전환 위반 클러스터** (Hard Rule 15~17 실효성)

- **backend C-1**: ID 패턴 999 천장 + GLOB DB 잠금
- **refactoring C-1**: lv1_insurance 컬럼 10+ 파일
- **refactoring C-2**: 'thepick-api' 리터럴 6 파일
- **refactoring M-1**: parser/batch-processor.ts 시험 특화 prompt 144줄 하드코딩
- → **권고**: Year 2 진입 전 ExamAdapter 패키지 + ontology v2 + ESLint `no-restricted-syntax` (Hard Rule 17) 묶음 마이그레이션. 코드 변경량 ~30 파일.

### 진앙 #3 — **G-S5 측정 차단/결론 의미 클러스터** (현 단계 게이트)

- **backend C-7**: ⛔ **트리거가 backfill 차단** → 진산 검수해도 approved 동결 불가
- **quality C-1**: N=12 통계 유의도 부재 → 측정해도 결론 못 냄
- **quality M-3**: Formula PRC-01 = 47% PARTIAL (Phase 2 진입 차단 조건 자기 우회)
- **performance C-3**: Graph walk depth4 = 41.5ms → S5-7 통합 차단/조건부
- → **권고**: TR-0 묶음 = backend C-7 해소 우선 + quality C-1 워터마크 결정 + S5-7 §7 GO/NO-GO 와 묶기

### 진앙 #4 — **시리얼 chain hot path 클러스터** (시험 시즌 폭발)

- **performance C-1**: study/mode 7-쿼리 fan-out
- **performance C-2**: Stage 3.c 13 RTT 직렬
- **performance C-3**: Graph walk 5 시드 시리얼
- **performance C-4**: /grade 8+ D1 직렬
- **performance C-5**: PRAGMA FK 매 요청 (전체 영향)
- → **권고**: C-5 측정 우선 (영향 면적 최대) → C-1/C-4 batch/transaction 묶음 → C-2/C-3 병렬화

### 진앙 #5 — **회귀 검출 인프라 공백 클러스터** (매년 개정·확장 시 silent 회귀)

- **quality C-2**: parser-1st-exam 0 test
- **quality C-3**: OX Hard Stop 미구현
- **quality C-4**: SCENARIO_MIGRATIONS 정적 배열
- **quality C-5**: AnthropicAdapter NOT_IMPLEMENTED
- **quality C-6**: 암기법 역방향 검증 부재
- **quality C-7**: payment --passWithNoTests
- **quality C-8**: E2E 전부 mock
- → **권고**: Phase 2 closure 묶음 — Golden test 10건 + contract test + scenario 동적 발견. ~30h 추정.

### 진앙 #6 — **운영 자동화·관측 공백 클러스터** (Phase 3 launch 직전 closure)

- **devops C-1**: Logpush/Email Routing 미연결
- **devops C-2**: deploy 자동화 0
- **devops C-3**: D1 DR runbook 부재
- **devops C-4**: secret rotation 0
- → **권고**: Phase 3 launch 1주 스프린트로 묶음 closure (~25h, Cloudflare-native 솔루션만)

---

## 4. 페르소나 충돌 / 트레이드오프

| 충돌                               | 페르소나 A 주장                               | 페르소나 B 주장                                     | 해소 안                                                        |
| :--------------------------------- | :-------------------------------------------- | :-------------------------------------------------- | :------------------------------------------------------------- |
| **PBKDF2 100k iterations**         | performance M-5: login p99 100ms+ 부담        | (암묵적) ADR-035 = Workers CPU 호환 정착 / 보안 fix | ADR-035 = 결정사항. 본 부채 = 의도된 코스트. 측정만 carry-over |
| **단일 벤더 락인**                 | devops self-check: Cloudflare 장애 fallback 0 | ADR-022 = 의도된 트레이드오프                       | "트레이드오프 인지" + on-call runbook 추가 (devops C-3 묶음)   |
| **status_transitions append-only** | backend C-3: 무한 누적 SLO 폭탄               | ADR-010 = canonical 정책                            | trigger 잠금 유지 + GC 정책 신설 (별도 ADR)                    |
| **E2E mock-server**                | quality C-8: 실 contract drift 검출 0         | (암묵적) 개발 속도 / Workers vitest pool 미적용     | ADR-028 Phase 2 진입 이연 → 본 단계에서 closure 트리거         |

---

## 5. **진산 결재 갈림길** (즉시 결정 필요)

### Q1. **TR-0 묶음 (G-S5 게이트)** — 진산 검수 직전 차단선 해소 방식?

1. **A안**: 트리거 일시 DROP → backfill → 재설치 (운영 위험: 동시 INSERT 시 invariant 깨짐)
2. **B안**: `prevent_exam_questions_update` → `prevent_exam_questions_static_update` 로 재설계 (컬럼 화이트리스트 → related_nodes 만 UPDATE 허용, 신규 마이그)
3. **C안**: 트리거 우회 = exam_questions 신규 row + SUPERSEDES 패턴 (Temporal Graph 동일) — backend C-7 권고는 B안

### Q2. **G-S5 N=12 결론의 의미** — 워터마크 결정?

1. **A안**: pilot 12 측정 진행 + 리포트 워터마크 "방법론 신호 검증, 통계 일반화 아님" 영속 → S5-7 §7 GO 판단 = signal-direction 만 사용
2. **B안**: pilot 측정 전 30~50 확대 결재 선결 (검수 비용 ~3-4시간 추가)
3. ← 현 plan 은 A안 (S5-7 §7 GO/NO-GO 의존). 진산 결재 재확인 필요

### Q3. **Phase 2 closure vs Phase 3 launch 패키징** — 묶음 vs 직렬?

- **묶음안**: 진앙 #5 (회귀 검출 ~30h) + 진앙 #6 (운영 자동화 ~25h) 동시 진행 (~55h)
- **직렬안**: G-S5 측정 → 결과 분기 → Phase 2 closure → Phase 3 launch 직전 closure
- → 권고: 직렬 (진앙 #3 결론이 #5/#6 우선순위 변경 가능)

### Q4. **Year 2 zero-cost (진앙 #2) 처리 시점**

- **즉시안**: Phase 2 closure 와 묶음 (Hard Rule 15~17 위반 인벤토리 보여줘야 결재 가능, ~20h)
- **이연안**: Year 2 진입 1개월 전 burst (검수 비용 ↑, ID 천장 발견 위험)
- → 권고: **인벤토리 작성**은 즉시 (보고서 진앙 #2 ~20분), **실시행 timing**은 별도 결재

---

## 6. 권고 액션 매트릭스 (우선순위 = 진산 결재 의존)

| 버킷                            | 의미                               | 항목                                                                                                  | 예상 비용 |
| :------------------------------ | :--------------------------------- | :---------------------------------------------------------------------------------------------------- | :-------- |
| **TR-0 즉시** (G-S5 게이트)     | 검수 전 차단선 + 측정 의미         | C-B7 (trigger 재설계) + C-Q1 (워터마크 결정) + S5-7 §7 묶음                                           | ~8h       |
| **TR-1 학습자 정직성** (북극성) | 검수 게이트 통과 후 즉시           | C-B5/C-B6 (단일 진실원 강제) + C-B4 (4-way sync) + C-P5 (PRAGMA FK 측정) + C-P3 (graph walk CPU)      | ~16h      |
| **TR-2 Phase 2 closure**        | G-S5 결과 분기 후                  | C-Q2/C-Q3/C-Q4/C-Q5/C-Q6 (Golden test) + C-P1/C-P2/C-P4 (성능 chain) + C-B2/C-B3 (Drizzle drift + GC) | ~30h      |
| **TR-3 Phase 3 launch closure** | 1주 스프린트 (memory 정합)         | C-D1/C-D2/C-D3 (Cloudflare-native 운영) + C-Q7/C-Q8 (E2E + payment 회귀) + C-R3 (빈 패키지 정리)      | ~25h      |
| **TR-4 Year 2 진입 전**         | 인벤토리는 즉시 / 실시행 별도 결재 | C-B1 (ID 패턴 v2) + C-R1/C-R2 (Hard Rule 15~17 위반 정비) + C-D4 (secret rotation)                    | ~30h      |

**누적 ~109h** (실시간 1인 기준 ≈ 3주, Claude 협업 시 1.5~2주). Year 2 진입 항목 분리 시 Phase 2/3 합산 ~79h ≈ 2주.

---

## 7. 자기 검증 (이 통합 인덱스가 틀릴 시나리오)

- **5 페르소나가 비슷한 편향을 공유할 가능성**: 모두 "production-ready / 상용 horizon" 키워드 받음 → 보수적 편향 가능. 해소: 진산이 ADR-008 Graceful Degradation 임계값 (60% 등) 과 대조해 "충분히 좋음" 판정 가능 영역 직접 표시 권고.
- **N=12 결론 무의미라는 quality C-1 주장 vs S5-6b plan "방법론 검증" 의도**: pilot 의 목적이 통계가 아니라 방법론 신호이므로 워터마크로 해소되는 부채. C-1 = MAJOR 강등 가능 (본 인덱스는 CRITICAL 유지).
- **5명 모두 진산 인간검수 게이트 자체는 부채로 보지 않음**: AI draft → 인간 권위는 Hard Limit (CLAUDE.md). 검수 비용 부담은 부채 아닌 의도된 코스트.
- **TR-4 (Year 2) 인벤토리만 진행 권고가 안일할 수 있음**: 진앙 #2 의 ID 천장 도달은 Year 2 D-day 가 아닌 손해평가 도메인 단독 5~8년 안에도 가능 (backend C-1 §2). 즉시안으로 격상 가능. 진산 결재.

---

## 8. 차세션 진입 시 1차 액션

1. 본 인덱스 + 각 보고서 5개 → 진산 결재
2. Q1~Q4 결정 → CLAUDE.md "현재 상태" + memory 진척 갱신
3. TR-0 묶음 = handoff-091 §"다음 할 일" #2 (진산 검수) 와 **반드시 묶어서** 진행 — 검수만 진행 + 트리거 차단 미해소 = approved 동결 시 즉시 막힘

(코드 변경 0, 본 통합은 결재용 자료. 자율 실행 금지 — Q1 결정 후 plan + L3 마이그레이션 영역 = 인간 승인 후 코딩.)
