# Multi-Exam Extension — 자격증 도메인 확장 가이드 (v2.0)

> Content Build Engine 의 멀티시험 확장 패턴. ADR-007 본격화.
> v1 → v2.0: **`packages/exams/_common/`** 네임스페이스 예약 (검토서 §2-F).
> 상위: [`CONTENT_BUILD_ENGINE.md`](./CONTENT_BUILD_ENGINE.md)
> 메모리: `project_v3_final_multi_exam_deferred.md`

---

## 1. 본 모듈의 책임

진산님 명시: _"이 손해평가사 외에 다른 자격증 서비스를 개발할 때도 이 엔진을 기본으로 하고 해당 자격증 도메인에 특화된 부분을 보강하는 구조."_

핵심: **본 엔진은 공통 / 도메인은 plugin**. 자격증 추가 = plugin 추가, 코어 변경 0.

---

## 2. 디렉토리 구조 (Year 2 본격, v2.0)

```
packages/
├── content-build-engine/        ← 공통 코어 (변경 0)
│   ├── ontology/
│   ├── validation/
│   ├── version-management/      Materialized Active View (v2.0)
│   ├── loader/
│   └── source-citation/
│
├── cbiv/                        ← 5번째 코어 (도메인 무관, v2.0)
│
└── exams/
    ├── _common/                 ← Year 1 예약, Year 2 본격 (v2.0 신설)
    │   ├── README.md            "다중 자격증 공유 도메인 전용"
    │   ├── manual/
    │   │   ├── civil-law/       민법 (Year 2)
    │   │   ├── commercial-law/  상법 (Year 2 — 손해평가사도 일부 공유)
    │   │   └── ...
    │   ├── domain-types.ts      CIVIL-LAW-NNN, COMMON-LAW-NNN
    │   ├── ontology-extension.json
    │   └── exam-metadata.ts     exam_id = '_common'
    │
    ├── son-hae-pyeong-ga-sa/    ← Year 1 instance
    │   ├── manual/
    │   ├── domain-types.ts      INS / CROP / INV
    │   ├── ontology-extension.json  # _common 참조 가능
    │   ├── formula-family/      F-01~F-N + Golden Test
    │   └── exam-metadata.ts
    │
    └── gong-in-jung-gae-sa/     ← Year 2 추가 (예시)
        └── (민법은 _common.civil-law REFERENCES 로 참조)
```

---

## 3. 코어 ↔ Plugin 책임 분리

### 코어 (`packages/content-build-engine/` + `packages/cbiv/`)

- 모든 자격증 공통: 노드 ID 패턴 (LAW / FORMULA / CONCEPT / TERM)
- 모든 자격증 공통: 엣지 관계
- 모든 자격증 공통: 검증 Framework 4단계
- 모든 자격증 공통: Temporal Graph + Materialized Active View
- 모든 자격증 공통: Loader + state-machine
- 모든 자격증 공통: **CBIV 6단계 자동 검증** (v2.0)

코어는 **자격증 무관**. `if (examId === 'X')` 분기 0건 (Hard Rule 15).

### Plugin (`packages/exams/{exam_id}/`)

- 도메인 특화 노드 타입: 손해평가사의 INS / CROP / INV
- 도메인 특화 ID 패턴 + Adaptive Threshold (v2.1)
- 도메인 산식 family
- 도메인 자료
- 도메인 출제영역

### **`_common/` (v2.0 신설)**

- 여러 자격증 공유 도메인 (민법, 상법 등)
- exam_id = `_common`
- 다른 도메인 plugin 이 `REFERENCES` 엣지로 참조

---

## 4. Year 1 ↔ Year 2 전환

### Year 1 한시 예외 (현)

`production-quality.md` Hard Rule 15:

> _"신규 코드는 예외 대상에 포함 금지. 본 예외는 Year 1 시점에 이미 존재하는 코드에만 적용."_

Year 1 에 이미 작성된 코드 (`packages/shared/src/types.ts` NodeType INSURANCE/CROP 등) 는 Year 2 까지 유지. 신규 코드는 Rule 15 본문 (분기 금지) 엄수.

### Year 2 전환 PR

| 작업                                            | 상세                                                            |
| :---------------------------------------------- | :-------------------------------------------------------------- |
| 1. 코어 추출                                    | parser/quality/batch → `packages/content-build-engine/`         |
| 2. CBIV 그대로                                  | 이미 `packages/cbiv/` (Year 1 부터 별도)                        |
| 3. 도메인 분리                                  | 손해평가사 특화 → `packages/exams/son-hae-pyeong-ga-sa/`        |
| 4. **`_common/` 본격 활용**                     | 민법 / 상법 일부 공유 도메인 적재                               |
| 5. D1 마이그레이션 0018 (R-2 정정, 0014 → 0018) | `exam_id` default 제거 (Year 1 부터 default 값으로 도입됨, R-3) |
| 6. examId 시그니처                              | TD-042 (가-1 Group C) 에서 이미 적용 → zero-cost 전환           |
| 7. 새 자격증 plugin                             | `packages/exams/{새 자격증}/`                                   |

전환 후: 코어 변경 0 / 호출 측 변경 0 / 도메인 plugin 추가만.

---

## 5. 새 자격증 추가 절차 (Year 2)

```
Step 1: packages/exams/{새 자격증}/ 디렉토리 생성
Step 2: manual/ 자료 수집 (교재 + 기출 + 법령 + 개정 + 출제영역)
Step 3: domain-types.ts 작성 (도메인 특화 노드 타입)
Step 4: ontology-extension.json 작성:
        - id-patterns
        - deduplication_thresholds (v2.1 Adaptive Threshold)
        - allowed-relations
Step 5: formula-family/ 작성 (도메인 산식 + Golden Test)
Step 6: exam-metadata.ts 작성 (시험 일정 / 합격 기준 / 출제 영역)
Step 7: BATCH 적재 진행 (현 손해평가사와 동일 10단계 절차)
Step 8: D1 (exam_id 컬럼 채워서 INSERT)
```

코어 (`packages/content-build-engine/` + `packages/cbiv/`) 는 단 1줄도 변경 안 함.

---

## 6. **`_common/` 활용 패턴 (v2.0 신설)**

### 6.1 교차 참조 메커니즘

```typescript
// 손해평가사 노드가 _common.civil-law 참조
{
  "id": "INS-01",
  "name": "보험계약의 성립",
  "exam_id": "son-hae-pyeong-ga-sa",
  "edges": [
    {
      "to_node": "CIVIL-LAW-001",   // _common 의 노드
      "to_exam_id": "_common",       // 명시적 cross-domain
      "relation": "REFERENCES"
    }
  ]
}
```

### 6.2 격리 정책 보존

학습자가 손해평가사 학습 시 → 메인 도메인 + 명시적 REFERENCES 만 노출. `_common` 의 다른 자격증 전용 노드는 비노출.

운영 RAG (Hybrid Search Stage 2) 의 `exam_id = ?` 필터 + REFERENCES 엣지 추적으로 격리 보장.

### 6.3 Year 1 placeholder

```
packages/exams/_common/
└── README.md  ← Year 1 에는 이 파일만 (placeholder)
```

```markdown
# Common Foundation (Reserved)

> **현 상태:** 예약 (Year 1)
> **본격 구현:** Year 2 (멀티시험 진입 시)

이 디렉토리는 여러 자격증이 공유하는 도메인 전용 (예: 민법, 상법).
Year 1 (손해평가사 단독) 에서는 적재 금지.
Year 2 진입 시 ADR-017 에 따라 본격 활용.
```

Hard Rule 23 (`_common/` Year 1 데이터 적재 금지).

---

## 7. 검증 절차 (Year 2 plugin 추가 시)

새 자격증 plugin 작성 후:

1. **코어 무결성** — 기존 자격증 (손해평가사) 영향 0 (CBIV 회귀 Golden 자동 실행)
2. **새 자격증 적재** — 본 엔진의 10단계 + 4단계 검증 통과
3. **격리 검증** — 자격증 A 학습자가 자격증 B 데이터 못 봄
4. **확장성** — 3번째 자격증 시도 시 코어 변경 0 유지

---

## 8. 무결성 위배 (즉시 차단)

- ❌ 코어 모듈에 `if (examId === ...)` 분기 → ESLint 차단 (Hard Rule 15)
- ❌ 코어 모듈이 도메인 plugin import → 단방향 의존성 위반
- ❌ 자격증 A 코드가 자격증 B 데이터 직접 접근 → `exam_id` 격리 위반
- ❌ 새 자격증 추가가 코어 변경 요구 → 설계 결함, plugin 패턴 재검토
- ❌ **`_common/` 에 Year 1 데이터 적재 → Hard Rule 23 위반** (v2.0)

본 무결성이 깨지면 멀티시험 확장 비용 폭증 → 본 엔진의 핵심 가치 (공통 코어 재사용) 무효.
