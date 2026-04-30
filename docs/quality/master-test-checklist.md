# 종합 테스트 마스터 체크리스트 (Master Test Checklist)

**버전:** v0 (골격 — 차세션 본격 작성 의무)
**작성일:** 2026-04-30 (세션 022 — 진산님 명시 트리거)
**효력:** Engine Hardening Step 19 (BATCH-1 직전 게이트) 진입 시점에 모든 항목 PASS 의무
**근거 메모리:** `project_completion_notification_obligation` (기술 부채 0 정책 + 완료 시점 알림 의무)

> **진산님 2026-04-30 명시:** "엔진이 완성되어도 분명 미흡한 것이나 오류가 잇을 듯 해서 충분한 품질 과 성능 테스트 를 위한 체크항목, 시나리오, 단위, 모듈, 종합 테스트를 해야 할 거야.. 기록을 해두고.. 완료 시점이 되면 알려줘"

---

## 0. 효력 + 진입 게이트

### 0.1 의무 시점

- **Step 19 진입 시:** 본 체크리스트 v1 (정식판) 모든 카테고리 PASS 검증 의무
- **Step 20 BATCH-1 적재 진입 차단 게이트:** 본 체크리스트 미PASS = BATCH-1 적재 진입 거부
- **매 phase 종료 시:** 본 체크리스트 진척도 진산님 보고

### 0.2 8 카테고리 (v0 골격)

|  #  | 카테고리                      | 책임                                                | 산출 단위                    |
| :-: | :---------------------------- | :-------------------------------------------------- | :--------------------------- |
|  1  | **단위 테스트** (Unit)        | 함수/메서드 단독 결정성 + 경계값                    | tests / 패키지               |
|  2  | **모듈 테스트** (Module)      | 패키지 내 상호작용 + 인터페이스 계약                | tests / 패키지               |
|  3  | **통합 테스트** (Integration) | 패키지 간 단방향 의존성 + 데이터 흐름               | apps/batch e2e               |
|  4  | **E2E 테스트** (End-to-End)   | runPipeline 풀 실행 + D1 영속화                     | apps/batch **tests**/        |
|  5  | **성능 테스트** (Performance) | Workers 50ms CPU + 토큰 비용 + DB latency           | benchmark / load             |
|  6  | **품질 테스트** (Quality)     | Golden Test + 산식 정확도 + 정답 100%               | qg-validator + golden-test   |
|  7  | **보안 테스트** (Security)    | API key / SQL injection / XSS / 동적 코드 실행 차단 | security 단위 + e2e          |
|  8  | **출력 검증** (Output)        | LLM 생성 콘텐츠 신뢰성·정확성 + 출처 추적성         | reviewer 검수 + AI 자동 검수 |

### 0.3 v0 → v1 차세션 의무

본 v0 은 골격만. 차세션에 다음 의무 (handoff-023 §"종합 테스트 마스터 체크리스트 v1 작성 의무"):

1. 각 카테고리별 시나리오 매트릭스 (현재 ~3 줄 → 20~50 줄 확장)
2. 체크 항목별 PASS 기준 명시 (numeric / boolean)
3. 자동화 가능 항목 → CI 통합 (Step 18 자동 검증 스크립트 연계)
4. 수동 검수 항목 → 진산님 검수 의무 명시
5. 진척도 추적 매트릭스 (Step 19 진입 시 PASS/FAIL 기록)

---

## 1. 단위 테스트 (Unit)

### 1.1 패키지별 단위 테스트 현황 (2026-04-30 기준)

| 패키지                    | 현재 tests |   목표 (Step 19 진입 시)    |        상태        |
| :------------------------ | :--------: | :-------------------------: | :----------------: |
| `@thepick/formula-engine` |    251     |            251+             |         ✅         |
| `@thepick/parser`         |    136     |   200+ (LLM 통합 후 +60)    |    🟡 14b 이연     |
| `@thepick/quality`        |     41     | 80+ (15b arbitraryGraph 후) |    🟡 15b 이연     |
| `@thepick/batch`          |    205     |    250+ (16b/16c e2e 후)    | 🟡 16b/16c 진행 중 |
| `@thepick/shared`         |     33     |             33+             |         ✅         |
| `@thepick/ai-adapter`     |     13     |      30+ (LLM 통합 후)      |         🟡         |
| 기타 패키지               |    ~199    |            250+             |         🟡         |
| **합계**                  |  **~878**  |         **~1100+**          |     🟡 진행 중     |

### 1.2 핵심 단위 테스트 시나리오 (v1 의무)

- [ ] Null/Undefined/Empty/Whitespace 모든 입력 차단
- [ ] 경계값 (0, 1, MAX_SAFE_INTEGER, NaN, Infinity)
- [ ] 결정성 100회 반복 (Mulberry32 PRNG seeded)
- [ ] 충돌 차단 (다른 입력 → 다른 출력)
- [ ] multi-byte / 매우 긴 input (UTF-8 1000자 이상) ← Phase 이월 부채 M-3
- [ ] Throw 경로 (idempotency 키 부재 / 패턴 위반)
- [ ] Exports / 상수 일치

---

## 2. 모듈 테스트 (Module)

### 2.1 책임

패키지 내 상호작용 검증 — 단위가 아닌 **모듈 경계** + **인터페이스 계약**.

### 2.2 핵심 시나리오 (v1 의무)

- [ ] `@thepick/parser` schema-validator + ontology-registry-loader + normalizer 3 모듈 연계
- [ ] `@thepick/quality` graph-integrity + supersede-cycle + normalizer 3 모듈 연계
- [ ] `@thepick/formula-engine` ast-parser + engine + sandbox 3 모듈 연계
- [ ] `@thepick/batch` loader + cost-meter + checkpoint + recover 4 모듈 연계
- [ ] **인터페이스 계약 위반 차단** — TypeScript readonly + Zod 런타임 검증

---

## 3. 통합 테스트 (Integration)

### 3.1 책임

패키지 간 단방향 의존성 + 데이터 흐름 검증.

### 3.2 핵심 시나리오 (v1 의무)

- [ ] `apps/batch/src/__tests__/pipeline.integration.test.ts` (Step 11.6 9 AC e2e — 195/195 PASS 유지)
- [ ] parser → batch (KnowledgeContract 단방향)
- [ ] quality → batch (IntegrityReport 단방향)
- [ ] formula-engine → batch (산식 검증 단방향)
- [ ] **역방향 import 0건** (Hexagonal 위반)
- [ ] **Hard Rule 16 — 시험 경계 강제** examId 시그니처 모든 데이터 함수
- [ ] **Hard Rule 17 — EXAM_IDS 경유** 'son-hae-pyeong-ga-sa' 리터럴 0건

---

## 4. E2E 테스트 (End-to-End)

### 4.1 책임

`runPipeline` 풀 실행 + D1 영속화 + checkpoint/recover 시나리오.

### 4.2 핵심 시나리오 (v1 의무 — Step 16b/16c 산출 흡수)

- [ ] **AC-RP-1 시나리오 A — Reproducibility** 동일 fixture + 동일 seed → invariant_fields 100% 동일
- [ ] **AC-RP-2 시나리오 B — Concurrent** Promise.all 2개 → 1개만 'completed', 중복 0건
- [ ] **AC-RP-3 시나리오 C — Recover** 50% kill → recover → 정상 동일 + 중복 0건
- [ ] **AC-RP-4 시나리오 E — Rerun** 동일 batch_run_id → skip + 결과 보존
- [ ] **AC-RP-5 시나리오 D — Cron** Phase 2 SKIP (별도 plan)
- [ ] **AC-RP-6 — 0016 마이그레이션 + 0014 트리거 e2e**
- [ ] **AC-RP-7 — source_id 결정성 e2e** 100회 반복 동일

---

## 5. 성능 테스트 (Performance)

### 5.1 책임

Workers 런타임 제약 + 토큰 비용 + DB latency.

### 5.2 핵심 시나리오 (v1 의무)

- [ ] Workers CPU 50ms (free) / 30s (paid) 한도 내 동작
- [ ] 노드 1000건 INSERT 시 D1 batch atomicity ← Pass 2 M-2 흡수
- [ ] CostMeter SLO — soft warn / hard throttle / kill switch 3 임계
- [ ] BATCH-1~5 적재 토큰 비용 < $200 (Anthropic cap)
- [ ] Vectorize 쿼리 latency < 500ms p95
- [ ] PWA 콜드 스타트 < 3s
- [ ] FSRS 간격 계산 < 50ms

---

## 6. 품질 테스트 (Quality)

### 6.1 책임

Golden Test + 산식 정확도 + 기출 정답 100% 일치.

### 6.2 핵심 시나리오 (v1 의무)

- [ ] **Formula Engine 산식 정확도 100%** — 교재 예시값 (소수점 정밀도 포함)
- [ ] **기출 파서 ↔ 공식 정답 100%** — 1건 불일치 시 즉시 원인 규명
- [ ] **Constants 추출 0건 오류** — 65%를 60%로 잘못 추출 차단 (서비스 사망 조건)
- [ ] **Graph 무결성** — 고아 노드 0 / 끊긴 엣지 0 / SUPERSEDES 순환 0
- [ ] **Tarjan SCC vs naive DFS 비교** ← Step 15b 의무
- [ ] **AI 생성 데이터 — draft 만 적재** + 인간 검수 후 approved
- [ ] **암기법 역방향 검증** — 두문자어 → 원래 항목 복원 100%

---

## 7. 보안 테스트 (Security)

### 7.1 책임

API key 보호 + SQL injection / XSS 차단 + 동적 코드 실행 차단.

### 7.2 핵심 시나리오 (v1 의무)

- [ ] **Formula Engine 동적 코드 실행 차단** — math.js AST 만 허용 (eval/Function 0건)
- [ ] **D1 prepared statement 의무** — SQL injection 0%
- [ ] **API key 클라이언트 노출 0건** — Workers 서버 사이드만
- [ ] **innerHTML 사용 0건** — XSS 차단 (textContent 또는 React/Astro 자동 escape)
- [ ] **사용자 입력 검증** — Zod 런타임 검증 + 길이 제한
- [ ] **Constants 직접 수정 차단** — 0014 트리거 화이트리스트
- [ ] **Temporal Graph UPDATE 차단** — 0014 prevent_knowledge_nodes_update 트리거

---

## 8. 출력 검증 (Output)

### 8.1 책임

LLM 생성 콘텐츠 신뢰성·정확성 + 출처 추적성 (메모리 `project_source_citation_requirement` 정합).

### 8.2 핵심 시나리오 (v1 의무)

- [ ] **OX/빈칸/변형 문제 정답 100% 정확** — Hard Stop 조건
- [ ] **모든 생성 콘텐츠에 출처 FK** — 교재 페이지 / 법조문 / 기출 ID
- [ ] **근거 0건 = approved 차단** — draft 상태 영구 잔존
- [ ] **수험자 "근거 보기" UX** — 1급 기능 작동
- [ ] **Reviewer 검수 큐** — Phase 1 후반 (사용자 노출 전) 의무
- [ ] **AI 자동 검수 — 낮은 신뢰도 자동 reject** — Vectorize 유사도 + LLM 재검증

---

## 9. 진척도 매트릭스 (Step 19 진입 시 갱신 의무)

| 카테고리 | v0 골격 |   v1 시나리오 매트릭스   |         자동화 비율          |    PASS/FAIL    |
| :------- | :-----: | :----------------------: | :--------------------------: | :-------------: |
| 1 단위   |   ✅    |        ⏳ 차세션         |        100% (vitest)         |     🟡 진행     |
| 2 모듈   |   ✅    |        ⏳ 차세션         |        100% (vitest)         |     🟡 진행     |
| 3 통합   |   ✅    |        ⏳ 차세션         |        100% (vitest)         |     🟡 진행     |
| 4 E2E    |   ✅    | ⏳ 차세션 (16b/16c 산출) |        100% (vitest)         | 🔴 16b/16c 의존 |
| 5 성능   |   ✅    |        ⏳ 차세션         |   80% (벤치) + 20% (수동)    |    🔴 미구현    |
| 6 품질   |   ✅    |        ⏳ 차세션         |      100% (golden test)      |     🟡 진행     |
| 7 보안   |   ✅    |        ⏳ 차세션         |      100% (단위 + e2e)       |     🟡 진행     |
| 8 출력   |   ✅    | ⏳ 차세션 (Phase 1 후반) | 50% (자동) + 50% (인간 검수) | 🔴 LLM 통합 후  |

---

## 10. 차세션 의무 (handoff-023 흡수)

1. 본 체크리스트 v0 → v1 정식판 작성 (각 카테고리 시나리오 매트릭스 20~50 줄)
2. Step 19 진입 게이트에 본 체크리스트 PASS 의무 명시
3. Step 18 자동 검증 스크립트 (`scripts/verify-engine-contracts.ts`) 와 연계 — CI 통합
4. 수동 검수 항목 → 진산님 검수 절차 정립

---

**v0 작성자:** Claude (Opus 4.7) — 진산님 2026-04-30 명시 트리거 흡수
**v1 작성 시점:** Engine Hardening 차세션 또는 Step 19 진입 시점 (둘 중 빠른 시점)
