# ADR-031 — Formula ID Pattern 확장 (`^F-\d{2}$` → `^F-\d{2,3}$`)

**상태**: Accepted
**결정 일자**: 2026-05-06 (Session 043)
**결정자**: 진산 (트리거 발화) + Claude Opus 4.7 (옵션 선택)
**관련 영역**: Hard Limit 5 (Ontology Lock) / `packages/parser/src/ontology-registry.json`

---

## 1. 컨텍스트

ThePick BATCH 적재 누적 결과:

- BATCH-1 (2차 적과전 종합위험): F-01~F-13 (13 산식)
- BATCH-2 (종합위험 수확감소·과실손해): F-14~F-33 (20)
- BATCH-3 (논작물 + §4 마무리): F-34~F-60 (27)
- BATCH-4 (밭작물): F-61~F-97 (37)
- **본 시점 누적 F-97 사용 / F-99 한계까지 단 2 슬롯**

차세션 BATCH-5 (인삼·시설작물·버섯·농업수입감소) 추정 산식 ~33개 → **F-98~F-130 필요 → 기존 pattern `^F-\d{2}$` 위반**.

Layer 2~6 잔여 BATCH 진입 시 산식 추가 누적 — F-99 한계 결국 도달 불가피.

## 2. 결정

`packages/parser/src/ontology-registry.json` 의 formula ID pattern 을 다음과 같이 확장한다:

```diff
-  "version": "1.1.0",
+  "version": "1.2.0",
...
   "node_id_patterns": {
     "LAW": "^LAW-\\d{3}$",
-    "FORMULA": "^F-\\d{2}$",
+    "FORMULA": "^F-\\d{2,3}$",
     ...
   },
-  "formula_id_pattern": "^F-\\d{2}$",
+  "formula_id_pattern": "^F-\\d{2,3}$",
```

- **백워드 호환**: 기존 F-01~F-99 모두 새 pattern 통과 (실측 PASS).
- **신규 허용**: F-100 ~ F-999 (3자리).
- **거부 유지**: F-1, F-1000, F-0099 등.
- **버전 bump**: 1.1.0 → 1.2.0 (SemVer MINOR — 백워드 호환 확장).

## 3. 검토한 대안

### 옵션 A (★ 채택): pattern 확장 `^F-\d{2,3}$`

- 장점: 1줄 fix, 백워드 호환, 즉시 BATCH-5+ 진입 가능, F-999 한계까지 869 슬롯 추가
- 단점: F-999 한계 미래 재발 가능 (Layer 5 기출 누적 시 산식 추가 폭발 가능성), zero-pad 충돌(F-99 vs F-099 — 정합 정책 명문화 필요)

### 옵션 B (보류): 도메인 prefix 재설계 (`F-CROP-NN`, `F-LIVESTOCK-NN` 등)

- 장점: 시험 확장(공인중개사·전기기사 등) 시 namespace 분리, 멀티시험 격리 정합 (Hard Rule 15~17)
- 단점: 대규모 변경 (BATCH-1~4 의 F-01~F-97 모두 rewrite + DB 마이그레이션 + ontology-registry full revision), 본 시점 진산 결정 정합 X (시간 단축 우선)

### 옵션 C (보류): `^F-\d+$` 무한 확장

- 장점: 한계 영구 제거
- 단점: 정합성 약화 (F-1 = 1자리 허용으로 ID quality 강제 X)

## 4. 결정 근거

**진산님 메모리 정합**:

- `feedback_no_granular_decisions` — "구현은 최상 품질 기본값" → 옵션 A 자동 채택 (지엽 결정 X)
- `feedback_focus_reliability_not_schedule` — "안정성·신뢰성·항상성 집중" → 백워드 호환 100% 통과 + 회귀 0
- `project_completion_notification_obligation` — "기술 부채 0 정책" → BATCH-5 진입 차단 위험 즉시 해소

**Hard Limit 5 (Ontology Lock) 정합**:

- 본 변경 = ontology-registry.json **자체 갱신** (외부 ID 생성 X — 정책 정합).
- 변경 권한 = ontology-registry.json 의 의도된 진화 (version bump 정합 = SemVer MINOR).

**verify-engine-contracts.ts 회귀 0 재확인 (Pass 1+2 독립 리뷰)**:

- run = PASS 5/0/1 (entry 동일).
- BATCH-1~5 누적 130 산식 ID 100% 신 패턴 PASS (실측).

## 5. 영향 범위 + 후속 조치

### 5.1 본 fix 직접 영향 (즉시 처리)

| 파일                                         | 변경                                                                                | 상태 |
| :------------------------------------------- | :---------------------------------------------------------------------------------- | :--: |
| `packages/parser/src/ontology-registry.json` | version + 2 pattern 갱신                                                            |  ✅  |
| `packages/parser/src/batch-processor.ts:113` | LLM prompt "FORMULA: F-NN" → "F-NN 또는 F-NNN" 갱신 (Path B 자동 적재 부활 시 정합) |  ✅  |
| `docs/architecture/LLM_CONTAINMENT.md:85`    | 사실관계 정정 `F-\d{2}` → `F-\d{2,3}`                                               |  ✅  |
| `docs/engines/parser/research.md:25`         | 사실관계 정정 동일                                                                  |  ✅  |

### 5.2 명시 이월 (다음 step)

| 항목                                                                                 | 출처 (4-Pass MAJOR) | 이월 사유                                                  |
| :----------------------------------------------------------------------------------- | :------------------ | :--------------------------------------------------------- |
| schema-validator.test.ts boundary 어서션 (F-100/F-999 acceptance + F-1000 rejection) | M-1                 | 회귀 방어 강화 — 본 fix scope 외, 다음 step 첫 태스크      |
| zero-pad 충돌 명문화 (F-99 vs F-099 동치 처리 — 약관 의도 검증 필요)                 | M-2                 | 진산 메모리 명시 결정 의무 (본 ADR 본문에 정책 명시 안 됨) |
| 도메인 prefix ADR (F-999 한계 재발 방지 옵션)                                        | M-3                 | 본 BATCH-5 적재 영향 0, Phase 2 진입 시 재검토             |

### 5.3 BATCH-1~4 KG `_meta.ontology_registry_version` 표기 불일치 (정합 영향 X)

- BATCH-1 = (필드 부재)
- BATCH-2/3/4 = "1.1.0"
- BATCH-5 = "1.2.0"
- production 코드 미참조 (ontology-registry.ts 로드 시 version 필드 무시) — **런타임 영향 0**
- audit 도구 추가 시 일관성 검증 의무 — Phase 2 진입 시 결정.

## 6. 검증

### 6.1 4-Pass 독립 리뷰 결과 (2026-05-06)

|     Pass      | 에이전트                        | Critical | Major | Minor |          판정           |
| :-----------: | :------------------------------ | :------: | :---: | :---: | :---------------------: |
|  1 (Surgeon)  | pr-review-toolkit:code-reviewer |    0     |   0   |   0   |        완료 가능        |
| 2 (Architect) | pr-review-toolkit:code-reviewer |    0     |   0   |   1   |        완료 가능        |
| 3 (Advocate)  | system-architect                |    0     |   3   |   0   | 수정 필요 → fix 후 완료 |
| 4 (Contract)  | system-architect                |    0     |   2   |   0   | 수정 필요 → fix 후 완료 |

**총 0 Critical / 5 Major / 1 Minor**. M-5 ★ blocker (batch-processor.ts:113 LLM prompt 미갱신) + 2 docs 사실관계 오류 = 본 ADR §5.1 fix 완료. M-1/M-2/M-3 = 명시 이월.

### 6.2 보고서 영속

- `.claude/reviews/review-20260506-ontology-registry-fix-pass12.md`
- `.claude/reviews/review-20260506-ontology-registry-fix-pass34.md`
- `.claude/reviews/review-20260506-091948-ontology-registry-fix-summary.md` (통합)

## 7. SemVer / 버전 정책

ontology-registry.json 은 ThePick 의 contract 정의. SemVer 정합:

- MAJOR: 기존 ID 무효화 / 호환성 깨짐 (예: pattern 축소 — F-99 거부)
- MINOR: 백워드 호환 확장 (본 case — F-100~F-999 추가)
- PATCH: 정합성 개선 (정규식 동치 단순화 등)

본 변경 = MINOR (1.1.0 → 1.2.0). MAJOR bump (2.0.0) 은 Year 2 멀티시험 격리 시 도메인 prefix 도입 시점.
