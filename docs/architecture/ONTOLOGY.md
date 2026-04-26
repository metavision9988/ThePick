# Ontology — 노드/엣지/산식/상수 ID 체계 + Adaptive Threshold (v2.1)

> Content Build Engine 의 4 코어 모듈 중 첫 번째.
> v1 → v2.1: **Adaptive Deduplication Threshold** (타입별, v2.1 신설).
> 상위: [`CONTENT_BUILD_ENGINE.md`](./CONTENT_BUILD_ENGINE.md)

---

## 1. 노드 타입 + ID 패턴

| 타입              | ID 패턴       | 예시        | 의미      |
| :---------------- | :------------ | :---------- | :-------- |
| **LAW**           | `LAW-NNN`     | LAW-001     | 법령 조항 |
| **FORMULA**       | `F-NN`        | F-01        | 산식      |
| **INVESTIGATION** | `INV-NNN`     | INV-001     | 조사 절차 |
| **INSURANCE**     | `INS-NN`      | INS-01      | 보험 상품 |
| **CROP**          | `CROP-NNN`    | CROP-001    | 작물      |
| **CONCEPT**       | `CONCEPT-NNN` | CONCEPT-001 | 일반 개념 |
| **TERM**          | `TERM-NNN`    | TERM-001    | 용어 정의 |

Year 1 한시 예외 (Hard Rule 15): INSURANCE / CROP / INV 같은 손해평가사 특화 타입이 코어에 혼재.

---

## 2. 엣지 관계

| 관계         | 의미                 | 예시                                             |
| :----------- | :------------------- | :----------------------------------------------- |
| `RELATES_TO` | 일반 연관            | "적과전 종합위험" RELATES_TO "종합위험 수확감소" |
| `PART_OF`    | 부분-전체            | F-01 PART_OF F-08                                |
| `USES`       | 산식 사용            | CONCEPT-001 USES F-04                            |
| `SUPERSEDES` | 신구 대체 (Temporal) | CONST-901 SUPERSEDES CONST-900                   |
| `REFERENCES` | 법적 근거            | INS-01 REFERENCES LAW-005                        |
| `GROUNDS`    | 출처 (기출 ↔ 노드)   | EXAM-Q-2024-2-1 GROUNDS F-06                     |
| `PRECEDES`   | 워크플로우 순서      | "보험 가입" PRECEDES "사고 발생"                 |

---

## 3. 산식 (formulas)

| 필드                  | 형식                                   | 예시                                                    |
| :-------------------- | :------------------------------------- | :------------------------------------------------------ |
| id                    | `F-NN`                                 | F-06                                                    |
| name                  | 한국어                                 | "단감 인정피해율"                                       |
| equation_template     | math.js AST                            | `(1.0115 * 낙엽률) - (0.0014 * 경과일수)`               |
| variables             | 정의                                   | `{낙엽률: number 0~1, 경과일수: number ≥0}`             |
| page_ref              | **`"page:section"` 형식 (R-10, v2.2)** | **"422:§3-2-1"** (단일 페이지 다중 노드 시 정밀도 보장) |
| status                | canonical                              | `approved` (ADR-010)                                    |
| **is_current_active** | **0/1 (v2.0)**                         | **1** (default, 트리거가 SUPERSEDES 시 0)               |

### Hard Limit

- formulas UPDATE 금지 (Temporal — 변경 = 신규 F-NN + SUPERSEDES)
- equation_template 동적 코드 실행 금지 (math.js AST 만)
- LLM 수식 계산 금지 (Formula Engine 만)
- **page_ref 는 `"page:section"` 형식 의무** (R-10) — 한 페이지에 다중 산식 시 정밀도. Stage 3 (도메인 분석) 시 Claude Code 가 자동 추출.

---

## 4. 상수 (constants)

| 필드                  | 형식                             | 예시                     |
| :-------------------- | :------------------------------- | :----------------------- |
| id                    | `CONST-NNN`                      | CONST-901                |
| name                  | 한국어                           | "손해정도비율 임계값"    |
| numeric_value         | `number`                         | 0.10                     |
| unit                  | 단위                             | "ratio"                  |
| page_ref              | **`"page:section"` 형식 (R-10)** | **"525:§4-2"**           |
| valid_from            | 적용 시작                        | "2026-01-01"             |
| supersedes            | 이전 상수                        | "CONST-900"              |
| **is_current_active** | **0/1 (v2.0)**                   | **1** (트리거 자동 갱신) |

### Hard Limit

- constants UPDATE 금지
- LLM 추론 금지 (DB 쿼리만)
- 65% → 60% 같은 1자리 오타도 서비스 사망 — 교재 원문 + 기출 정답 역검증 의무
- **CBIV Stage 3 exact-match 정책** (v2.0): 같은 name + 겹치는 valid_from~valid_to 구간 + 다른 numeric_value → 충돌 (임계값 무관)

---

## 5. **Adaptive Deduplication Threshold (v2.1 신설, ADR-021)**

### 5.1 배경 (검토서 §2 MR-4)

단일 임계값 0.85 의 문제:

- "사과 낙엽률 산식 (F-04)" vs "단감 낙엽률 산식 (F-06)" — 텍스트 99% 동일, 다른 산식
- 단일 임계값 → False Positive 폭증 → alert fatigue

### 5.2 해법 — Ontology 타입별 임계값

`packages/parser/src/ontology-registry.json`:

```json
{
  "node_types": {
    "LAW": {
      "id_pattern": "^LAW-\\d{3}$",
      "deduplication_threshold": 0.88,
      "confusion_priority": "critical"
    },
    "FORMULA": {
      "id_pattern": "^F-\\d{2}$",
      "deduplication_threshold": 0.95,
      "confusion_priority": "critical",
      "rationale": "텍스트 거의 동일하나 작물별 별개 산식 — 0.95+ 만 중복 의심"
    },
    "INVESTIGATION": {
      "id_pattern": "^INV-\\d{3}$",
      "deduplication_threshold": 0.9,
      "confusion_priority": "high"
    },
    "INSURANCE": {
      "id_pattern": "^INS-\\d{2}$",
      "deduplication_threshold": 0.93,
      "confusion_priority": "high"
    },
    "CROP": {
      "id_pattern": "^CROP-\\d{3}$",
      "deduplication_threshold": 0.97,
      "confusion_priority": "medium",
      "rationale": "작물명만 다름, 0.97+ 만 중복"
    },
    "CONCEPT": {
      "id_pattern": "^CONCEPT-\\d{3}$",
      "deduplication_threshold": 0.85,
      "confusion_priority": "medium"
    },
    "TERM": {
      "id_pattern": "^TERM-\\d{3}$",
      "deduplication_threshold": 0.88,
      "confusion_priority": "low"
    }
  },
  "constants_dedup_policy": {
    "strategy": "exact_match",
    "fields": ["name", "valid_from", "valid_to"],
    "rationale": "Constants are exact-match domain — 임계값 무관"
  }
}
```

### 5.3 적용

CBIV Stage 2 가 본 레지스트리 직접 참조 (`packages/cbiv/src/stages/2-deduplication.ts`).

Hard Rule 28 (Adaptive Threshold 의무).

---

## 6. Ontology Lock — 위반 시 자동 차단

신규 노드/엣지 ID 가 본 패턴 외이면:

1. `validateKnowledgeContract` 거부
2. schema-validator 거부
3. D1 INSERT 거부 (CHECK constraints)

ID 추가는 본 문서 + `ontology-registry.json` 동시 갱신 필요.

---

## 7. 도메인 확장 패턴 (Year 2)

자격증 추가 시:

```
packages/exams/{exam_id}/
└── ontology-extension.json
    ├── domain-types: ["새 노드 타입 1", ...]
    ├── id-patterns: { "새 타입": "PATTERN-\\d{3}" }
    ├── deduplication_thresholds: { ... }     # 도메인별 임계값 (v2.1)
    └── allowed-relations: [...]
```

코어 `ontology-registry.json` 변경 0. 도메인 plugin 만 추가.

세부: [`MULTI_EXAM_EXTENSION.md`](./MULTI_EXAM_EXTENSION.md)
