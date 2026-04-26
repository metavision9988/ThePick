# Validation Framework — 4단계 검증 정식 명세 (v2.0)

> Content Build Engine 의 4 코어 모듈 중 둘째.
> 진산님 비유 (2026-04-26): _"사람으로 치면 머릿속에 넣은 지식이 제대로 되었는지 확인하는 것."_
> v1 (3단계) → **v2.0 (4단계, Cross-BATCH = CBIV 추가)**.
> 상위: [`CONTENT_BUILD_ENGINE.md`](./CONTENT_BUILD_ENGINE.md)

---

## 1. 핵심 원칙

DB INSERT 됐다 ≠ 지식이 제대로 적재됐다.
학습자가 시험 문제를 풀 수 있어야 진짜 적재 완료.
**그리고 새 BATCH 가 기존 BATCH 의 진실을 깨뜨리면 안 된다 (v2.0).**

따라서 검증은 **4단계** — 표면 / 내용 / 학습 효과 / **Cross-BATCH**.

---

## 2. Level 1 — 표면 검증 (DB INSERT 직전)

### 책임

JSON 산출물이 schema 정확하고 코어 무결성을 깨지 않는가.

### 검증 항목

| 항목             | 방법                                                                         | 자동/수동 |
| :--------------- | :--------------------------------------------------------------------------- | :-------- |
| Ontology Lock    | `validateKnowledgeContract` 가 `LAW-NNN` / `F-NN` / `INS-NN` 등 ID 형식 검증 | 자동      |
| schema-validator | JSON 구조 (`nodes` / `edges` / `formulas` / `constants`) 통과                | 자동      |
| graph-integrity  | 고아 0 / 끊긴 0 / SUPERSEDES 순환 0                                          | 자동      |
| sample 노드 5건  | 무작위. `name` 이 교재 본문 표현과 일치                                      | 진산님    |

### 실패 시

JSON 재생성 (Ontology Lock 자체 준수 강화).

---

## 3. Level 2 — 내용 검증 (DB INSERT 후 또는 dry-run)

### 책임

적재된 정보가 교재·법령 원본과 사실관계가 일치하는가.

### 검증 항목

| 항목                      | 방법                                                | 자동/수동   |
| :------------------------ | :-------------------------------------------------- | :---------- |
| qg2-validator Golden Test | `formulas` 정확도 — `batch-N-golden.json` 100% 일치 | 자동        |
| page_ref 무작위 5건       | 실제 교재 페이지 일치                               | 진산님      |
| 산식 변수명 정합          | `equation_template` 변수명이 레지스트리와 일치      | 자동 + 수동 |
| 26년 개정 적용            | 변경 영역 노드는 `revision_changes` + SUPERSEDES    | 자동        |
| 출처 추적성               | `page_ref` 또는 `revision_change_id` NOT NULL       | 자동        |

### 실패 시

- 자동 실패 → JSON 정정 후 재검증
- 적재 후 발견 → SUPERSEDES 신규 노드 (UPDATE 금지)

---

## 4. Level 3 — 학습 효과 역검증

### 책임 (진산님 비유 대응)

_"머릿속에 넣은 지식으로 시험 문제를 풀 수 있는가?"_

### 검증 항목

| 항목                   | 방법                                                                    |
| :--------------------- | :---------------------------------------------------------------------- |
| **기출문제 자동 풀이** | 본 BATCH 영역 기출 1~2건 → 적재 노드/산식만으로 정답 도출 → 일치율 100% |
| 혼동 유형 감지         | 비슷한 노드 차이 명확 (예: 사과 낙엽률 vs 단감 낙엽률)                  |
| 누락 페이지 식별       | 적재 노드 page_ref 합 vs BATCH 페이지 범위                              |
| 출처 추적성 깊이       | "근거 보기" 클릭 → 교재 정확한 위치 이동 가능                           |

### 기출문제 매핑

| BATCH   | 영역                   | 역검증 기출                      |
| :------ | :--------------------- | :------------------------------- |
| BATCH-1 | 적과전 종합위험        | 2024 제10회 / 2025 제11회 2차    |
| BATCH-2 | 종합위험 수확감소 16종 | 2023 제9회 / 2024 제10회 2차     |
| BATCH-3 | 논작물 (벼/맥류)       | 2022 제8회 / 2024 제10회 2차     |
| BATCH-4 | 밭작물                 | 2025 제11회 2차 (26년 개정 영향) |
| BATCH-5 | 시설작물 + 수입감소    | 2023 제9회 / 2025 제11회 2차     |

---

## 5. **Level 4 — Cross-BATCH 검증 = CBIV (v2.0 신설)**

### 책임 (검토서 §2-D, G 핵심)

> _"BATCH-1 만 검증하면 BATCH-1 만 안전하다._
> _BATCH-N 적재 시 BATCH-1~(N-1) 모두 재검증해야 시스템이 안전하다._
> _그 재검증은 인간이 할 수 없다. 그래서 CBIV 가 한다."_

기존 Level 1~3 은 **단일 BATCH 내부 검증**. Level 4 는 **Cross-BATCH 회귀**.

### 본 Level 의 책임은 CBIV 모듈로 이관

5번째 코어 모듈 [`CBIV.md`](./CBIV.md) 참조.

CBIV 6단계 자동 검증:

1. 참조 무결성 (외래키 + exam_id + approved)
2. 의미 중복 (**Adaptive Threshold**, v2.1)
3. 상수 일관성 (exact-match, 임계값 무관)
4. SUPERSEDES 체인 (DFS 순환 + revision_change_id)
5. **회귀 Golden Test 재실행 (D1 Preview Database)** ★ 핵심
6. 출제영역 정합성 (경고)

### 자동화 수준

| Stage             | 자동화    | 차단 권한             |
| :---------------- | :-------- | :-------------------- |
| 1 참조 무결성     | 100%      | 즉시 차단             |
| 2 의미 중복       | 100% 감지 | flag (인간 결정)      |
| 3 상수 일관성     | 100%      | 즉시 차단             |
| 4 SUPERSEDES 체인 | 100%      | 즉시 차단             |
| 5 **회귀 Golden** | 100%      | 즉시 차단 + 자동 분석 |
| 6 출제영역        | 100% 감지 | 경고 (인간 결정)      |

### Hard Rule

> **Hard Rule 20**: 신규 BATCH 적재는 CBIV 6단계 통과 후에만 D1 INSERT.
> **Hard Rule 24**: Golden Test 영구 보존 + CI/CD 자동 재실행.
> **Hard Rule 25**: CBIV 회귀 검증은 D1 Preview Database 환경에서만 수행 (in-memory 금지, v2.1).

---

## 6. 검증 우선순위 (진산님 메모리 정합)

진산님 메모리 `project_vision_mvp_generalization.md` 북극성 = "생성물 신뢰성·정확성".

| 순서  | 단계                           | 시간                                  |
| :---- | :----------------------------- | :------------------------------------ |
| 1     | Level 1 표면                   | 빠름 (자동)                           |
| 2     | Level 2 내용                   | 자동 + sample 5건 진산님              |
| 3     | Level 3 학습 효과              | 시간 들지만 critical                  |
| **4** | **Level 4 Cross-BATCH (CBIV)** | **자동 30초 + 인간 결정 (의미 중복)** |

검증 우회 시도 시 본 엔진의 무결성 0 — 즉 본 프로젝트 전체 의미 0.

---

## 7. 검증 산출물 (v2.0 보강)

```
docs/measurements/
├── batch-N-validation-{date}.md           # Level 1~3 결과
└── cbiv-reports/
    └── batch-N-cbiv-{date}.md             # Level 4 결과 (CBIV)

docs/measurements/golden-tests/             # ★ Golden 영구 보존 (Stage 10)
├── _registry.json
├── batch-1-golden.json
└── ...
```

---

## 8. dry-run vs 실 적재 검증 차이 (v2.0)

| 단계                      | dry-run                             | 실 적재                                |
| :------------------------ | :---------------------------------- | :------------------------------------- |
| Level 1 (표면)            | JSON 자체                           | 동일                                   |
| Level 2 (내용)            | qg2-validator dry-run + sample 검수 | qg2-validator + page_ref 대조          |
| Level 3 (학습 효과)       | JSON 만으로 기출 풀이 (D1 미사용)   | 적재된 D1 데이터로 기출 풀이           |
| **Level 4 (Cross-BATCH)** | **D1 Preview 환경에서 회귀 Golden** | **production D1 적재 후 PR CI 트리거** |

dry-run 의 Level 4 통과가 실 적재 후 통과를 보장 (idempotent).

---

## 9. 본 Framework 의 무결성 (Vows, v2.0)

- ❌ 검증 우회 (직접 D1 INSERT) 금지
- ❌ Level 3 통과 없이 approved 승격 금지
- ❌ **Level 4 (CBIV) 통과 없이 D1 INSERT 금지** (Hard Rule 20, v2.0)
- ❌ "테스트 통과" 만으로 안전 가정 금지 — 학습 효과 + Cross-BATCH 역검증이 본질
- ❌ **Golden Test 삭제 (진산님 승인 없이) 금지** (Hard Rule 24, v2.0)
- ❌ **in-memory SQLite 로 CBIV 회귀 검증 금지** (Hard Rule 25, v2.1)

본 무결성이 깨지면 학습자가 잘못된 정보로 시험 준비 → 서비스 사망.
