# v2.2 거대 설계 6 페르소나 다각 검토 종합

**리뷰 방식: 독립 에이전트 6개 병렬 호출 (5-페르소나 + 사업 전략 패널)**

작성일: 2026-04-26 KST 17:41
선행 검토 (중복 금지):

- v2.0 / v2.1 / review2 (감사 13건 + 결정 6~10)
- 모든 6 페르소나가 직전 발견 미중복 검증 의무 수행

---

## 종합 판정

```
신규 발견 합계: Critical 26 / Major 39 / Minor 22 = 87건
사업 전략 정합도: 78/100 (현 상태) → (B) 채택 시 88~92
권고: BATCH-1 진입 가속을 위한 (B) 핵심 4종 + 5 Core Rule만 우선 / 나머지 후순위
```

핵심: 검토 결과 **v2.2 설계는 큰 그림 80점 / 구현 디테일 60점**. R-1~R-13 후속 작업이 또 88건 발견됨. 87건 모두 처리는 30~40h 추가 작업 → **MVP-α 8월 출시 일정 직접 위협**.

---

## 페르소나별 핵심 (87건 중 진산님 의사결정 직결 7건)

### 🔴 시스템 차단 발견 (BATCH-1 즉시 차단 위협)

#### **D-1. 마이그레이션 0013~0018 + D1 컬럼/테이블 부재** (Quality C-2/3/4 + Arch SA-C3)

| 부재 항목                                                    | 영향                                      |
| :----------------------------------------------------------- | :---------------------------------------- |
| `is_current_active` 컬럼                                     | BATCH-1 INSERT 시 즉시 SQL 에러           |
| `review_decisions` 테이블                                    | Admin Review UI 차단                      |
| `ontology-registry.json` 의 `deduplication_threshold` 데이터 | CBIV Stage 2 무음 fallback                |
| 마이그레이션 0013/0014/0015/0016/0017 모두 미작성            | 5개 신규 마이그레이션 의존 코어 작동 불가 |

**시나리오**: BATCH-1 dry-run 진산님 click → SQL 에러 → 디버깅 → MVP-α 5~8일 손실

#### **D-2. page_ref 형식 정면 충돌** (Quality C-1)

- D1 트리거 (`migrations/0010_status_transitions_and_page_ref_guard.sql:126`): `'NNN' or 'NNN-MMM'` 만 허용
- ADMIN_REVIEW_UI.md: `"525:§4-2"` 또는 JSON 배열
- → Merge 액션 시 트리거 ABORT → 검수자 영원히 처리 불가

#### **D-3. Hard Rule 번호 드리프트 17개 파일** (Arch SA-C1 + Refactor TD-101)

R-1 정정 후 HARD_RULES.md 만 새 번호 (15~31). 그러나 17개 다른 문서는 옛 번호 (15~25) 그대로:

- `VALIDATION_FRAMEWORK.md`, `CBIV.md`, `CONTENT_BUILD_ENGINE.md`, `OVERVIEW.md`, `SEARCH_PIPELINE.md`, `VERSION_MANAGEMENT.md`, `MULTI_EXAM_EXTENSION.md`, `BATCH_LOAD_PROTOCOL.md`, `ONTOLOGY.md`, `ADMIN_REVIEW_UI.md`, `production-quality.md`
- ADR-013~021 9개 ADR
- → "Rule 16=is_current_active" (옛) ↔ "Rule 16=examId 강제" (신) 의미 충돌
- `production-quality.md` ↔ `HARD_RULES.md` 양원 SoT 분열 (TD-101)

### 🔴 보안 차단 발견 (운영 진입 시 위협)

#### **D-4. integrity SPOF** (Security 종합 반론)

진산님 GitHub + Cloudflare **단일 계정 탈취** = 31 Rule 모두 우회 chain:

1. PR 생성 → 악의 BATCH JSON + Golden 수정 + `/cbiv override`
2. CI 진산님 본인 확인 안 함 → wrangler d1 execute → production 적재
3. Hard Rule 1 UPDATE 금지로 SUPERSEDES만 가능 → Rollback 24h 만료 후 영구
4. **북극성 직접 사망**

ADVOCATE 가 burnout (가용성)은 다뤘으나 **계정 탈취 (integrity)** 미커버.

#### **D-5. CBIV / Materialized Active View / Hybrid Search 핵심 가정 불성립** (Performance C-1/C-2/C-3)

| 가정                                    | 실측 추정                        | 영향                                                   |
| :-------------------------------------- | :------------------------------- | :----------------------------------------------------- |
| CBIV 30초 이내 (BATCH-14)               | ~50~70초                         | CBIV-T06 직접 위반                                     |
| Hybrid Search p50 200ms                 | 250~300ms (cold)                 | SP-T07 거부율 < 5% 즉시 위반                           |
| Materialized Active View 트리거 cascade | `prevent_*_update` 트리거와 충돌 | 마이그레이션 0014/0015 적용 시 BATCH-R1 트랜잭션 ABORT |

#### **D-6. CBIV LOC 추정 2~3배 underestimate** (Refactor TD-100)

- 진산님 추정: ~600 LOC (BATCH-1 dry-run 전 의무)
- 실측 비교 (parser ~3,500 LOC 기반): **1,800~2,500 LOC**
- 단일 패키지 SRP 위반 — 분리 의무

### 🟠 사업 전략 (business-panel)

#### **D-7. (B) 권고 — 핵심 4종 + 5 Core Rule만 BATCH-1 전 / 나머지 후순위**

| 분류                             | 항목                                                                                      | 시점                     |
| :------------------------------- | :---------------------------------------------------------------------------------------- | :----------------------- |
| **Core 5 Rule** (북극성 직접)    | LLM 산식 계산 금지 / draft→approved / Source Citation FK / Constants DB only / BATCH 순차 | BATCH-1 전               |
| **Core 4 인프라**                | CBIV (단순 버전) / Hybrid Search / Materialized Active View / Source Citation             | BATCH-1 전               |
| **Auxiliary 26 Rule**            | 위반 시 사망 안 가는 것                                                                   | BATCH-1 후 retrospective |
| **Admin UI 8h** (현 추정 14~16h) | 가설 기반 → 데이터 기반 재설계                                                            | BATCH-1 후               |

(B) 동반 3종:

1. Sunset 메커니즘 (위반 0건 Rule deprecated)
2. CBIV monitoring 주기 = BATCH 단위 (Phase 1~2)
3. AI Adapter 격리 레이어 (Anthropic 단일 의존 antifragile)

---

## 페르소나별 합계

| 페르소나             | C / M / m | 핵심 발견                                                                                  |
| :------------------- | :-------- | :----------------------------------------------------------------------------------------- |
| system-architect     | 5 / 6 / 3 | Hard Rule 드리프트 17파일, 마이그레이션 0014~0018 부재, ARCHITECTURE.md v1 동결            |
| security-engineer    | 7 / 9 / 4 | Rule 17 ESLint 우회, /cbiv override 인증 부재, AI Auto-Fix injection, integrity SPOF       |
| performance-engineer | 4 / 5 / 3 | CBIV 30초 가정 깨짐, Hybrid 200ms p50 cold 환경 위반, 트리거 cascade                       |
| quality-engineer     | 4 / 7 / 5 | page_ref 충돌, is_current_active/review_decisions 부재, Adaptive Threshold 데이터 0건      |
| refactoring-expert   | 2 / 6 / 4 | CBIV 1,800~2,500 LOC, production-quality vs HARD_RULES SoT 분열, 47% Rule enforcement 부재 |
| devops-architect     | 4 / 6 / 3 | D1 Preview 인스턴스 누수, "진산님 active" 메커니즘 미정의, Email Routing outbound 모순     |
| business-panel       | (B) 권고  | 78/100 → (B) 채택 시 88~92                                                                 |

---

## 진산님 의사결정 (커밋/구현 진입 전)

### 옵션 A: 87건 모두 정정 후 BATCH-1 진입

- 작업 시간: ~30~40 spread (Day 1~7+)
- 안전: 최상
- 위험: MVP-α 8월 출시 일정 직접 위협 (BATCH-1 dry-run + 콘텐츠 생성 + 학습자 화면 시간 축소)
- 진산님 메모리 `feedback_focus_reliability_not_schedule` 정합 (일정 X 신뢰성 O) → A 가 정합

### 옵션 B: business-panel 권고 — 핵심 4종 + 5 Core Rule만 우선

- 작업 시간: ~10~12 spread (Day 1~3)
- 안전: 핵심 무결성 보장 + 26 Auxiliary BATCH-1 후 데이터 기반 재설계
- 위험: 후순위 26 Auxiliary Rule 의 일부가 BATCH-2~3 시점에 cascading 발견 가능
- 메모리 `feedback_no_shortcuts` 정합성: **범위 축소 OK / 품질 축소 NOT OK** — Auxiliary Rule 후순위는 범위 축소 (NOT 품질 축소) 로 정합

### 옵션 C: D1/D2/D3/D4 (시스템 차단 4건)만 정정 후 BATCH-1 진입

- 작업 시간: ~3~5 spread
- 안전: 차단 발견만 해소 / 나머지 87-4=83건은 진행 중 발견 시 처리
- 위험: 페르소나가 짚은 가정 깨짐 (CBIV 50초, Hybrid 250ms 등) 이 BATCH-N 진입 시 발견되어 cascading 정정

### 옵션 D: 무한 검토 루프 정지 — v2.2 그대로 BATCH-1 진입 + 진행 중 발견 처리

- 작업 시간: 0 (즉시 진입)
- 안전: 최저
- 위험: D-1/D-2 가 **즉시 차단** — BATCH-1 자체 진입 불가
- 사실상 불가능

---

## Claude 권고 — 옵션 B 변형 (B+)

**옵션 B (business-panel 권고) + D-1/D-2/D-3 (시스템/문서 차단) 강제 정정**:

### Phase 0 (BATCH-1 진입 직전, ~5~7 spread)

| 단위                                         | 작업                                                                                             |
| :------------------------------------------- | :----------------------------------------------------------------------------------------------- | ---------------------------------------- |
| (1) D-1 마이그레이션 0013 신설               | `is_current_active` 컬럼 + `review_decisions` 테이블 + Adaptive Threshold registry 데이터 적재   |
| (2) D-2 page_ref 형식 통일                   | 마이그레이션 0010 트리거 정규식 확장 (`^\d+(-\d+)?$                                              | ^\d+:§.\*$`) + ADMIN_REVIEW_UI 명세 정합 |
| (3) D-3 Hard Rule 번호 드리프트 정정         | 17개 문서 + 9 ADR 일괄 sed (15→18, 16→19, ..., 25→28) + grep 검증                                |
| (4) Core 5 Rule 분류 + Auxiliary 26 deferred | HARD_RULES.md 에 Core/Auxiliary 표시 (메모리 `feedback_no_shortcuts` 정합 — 품질 X, 범위 축소 O) |
| (5) AI Adapter 격리 레이어                   | `packages/ai-adapter/` 신설 — Anthropic 호출 단일 인터페이스 (antifragile)                       |

### Phase 1 (BATCH-1 dry-run, ~5 spread)

- (6) CBIV Core 만 (Stage 1+3+4+5 차단 + Stage 5 self-validation) — Stage 2 (의미 중복) 와 Stage 6 (출제영역) 은 Phase 2
- (7) Hybrid Search Core (Concurrent → Hybrid 통합 흐름) — Multi-Path Fallback Stage 1~3, Stage 4 honest refusal 은 Phase 2
- (8) Materialized Active View 마이그레이션 + 트리거 (P-C3 충돌 해결: prevent\_\*\_update 화이트리스트 컬럼 방식)
- (9) BATCH-1 dry-run 실행 — 실측 데이터 확보 (CBIV timing / Hybrid latency / 검수 시간 / Adaptive Threshold flag 빈도)

### Phase 2 (BATCH-1 결과 retrospective, ~3~5 spread)

- (10) Auxiliary 26 Rule 검증 — 위반 0건은 deprecated 후보, 위반 발생은 본격 enforcement
- (11) Admin Review UI v0.5 (큐 3 차단 정정 only — 가장 critical) — 가설 기반 X 데이터 기반 설계
- (12) BATCH-2 진입 (CBIV Stage 5 진짜 회귀 검증 시점)

총 작업: ~13~17 spread (옵션 A 30~40 spread 의 절반).

### Year 1 후반 (BATCH-3~7 진행 중)

- (13) 1인 운영 antifragility — 14일 미접속 자동 동결 + Year 2 외주 매뉴얼 (Core 5 Rule만)
- (14) integrity SPOF 강화 — 진산님 GitHub Hardware 2FA + Cloudflare 별도 IAM
- (15) CBIV BATCH 별 timing 실측 → CBIV-T06 budget 동적 갱신

---

## 진산님 결정 항목

| #   | 항목                                                                             |
| :-- | :------------------------------------------------------------------------------- |
| 1   | **(A) 87건 모두 정정** vs **(B+) 핵심만 + 후순위** vs **(C) 시스템 차단만** 선택 |
| 2   | (B+) 채택 시 — Phase 0 5~7 spread 즉시 진입 동의                                 |
| 3   | Core 5 Rule 분류 동의 (북극성 직접 5건만) — 나머지 26 Auxiliary 사후 선별        |
| 4   | AI Adapter 격리 레이어 신설 동의 (Anthropic 의존 antifragile)                    |
| 5   | integrity SPOF 보강 — Hardware 2FA / 별도 IAM 진산님 직접 적용 의지              |

**Claude 권고**: **(B+) — business-panel + D-1/D-2/D-3 강제 정정**.

근거:

- 진산님 메모리 `feedback_focus_reliability_not_schedule` (일정 X / 신뢰성 O) — (A) 가 더 정합이나
- 메모리 `feedback_no_shortcuts` 의 "범위 축소 OK / 품질 축소 NOT OK" 와 business-panel 의 "Hedgehog 강화만 BATCH-1 전" 정합 — (B+) 는 범위 축소이지 품질 축소 아님
- BATCH-1 dry-run 결과 데이터로 Auxiliary 26 Rule + Admin UI 재설계가 더 정확
- (A) 는 가설 기반 설계 검증의 위험 (현 87건이 가설 기반 검증 부재의 결과)

진산님 응답 주시면 Phase 0 즉시 진입.

---

## 서명

| 페르소나               | agentId           | 발견            |
| :--------------------- | :---------------- | :-------------- |
| system-architect       | ae0f1768618783207 | 14건            |
| security-engineer      | a06f4aba088999dc4 | 20건            |
| performance-engineer   | ae55be0bc5881289e | 12건            |
| quality-engineer       | ad4965eaffeefe3ee | 16건            |
| refactoring-expert     | a4475c6263e1c7d93 | 12건            |
| devops-architect       | a96594326104ee6f3 | 13건            |
| business-panel-experts | aba827c5816aeb7ec | (B) 권고 78/100 |

총 87건 신규 발견 / 6 페르소나 / ~25분 / 직전 1차+2차+3차+review2 발견 중복 0건.
