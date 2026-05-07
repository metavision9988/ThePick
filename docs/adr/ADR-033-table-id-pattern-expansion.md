# ADR-033 — Table ID Pattern 확장 (TBL/TROW/TCOL/TCELL)

**상태**: Proposed (Year 2 Phase 4 진입 전 적용 의무)
**결정 일자**: 2026-05-07 (Session 054 plan, Year 2 진입 전 의무 적용 carry-over)
**결정자**: 진산 (트리거 발화 — "권고 순서대로 해줘") + Claude Opus 4.7 (옵션 비교)
**관련 영역**: Hard Limit 5 (Ontology Lock) / `packages/parser/src/ontology-registry.json` / `migrations/0021_table_as_micro_kg.sql` / `migrations/0023_table_cells_pattern_h.sql` / `migrations/0024_table_structures_pattern_h.sql`
**연관 ADR**: ADR-031 (FORMULA `^F-\d{2}$` → `^F-\d{2,3}$` 확장 — 본 ADR과 동일 패턴 적용)
**연관 5-Persona Critical**: BA-C3 (Session 052 backend-architect)

---

## 1. 컨텍스트

ADR-032 Phase 1 도입 시 `migrations/0021_table_as_micro_kg.sql` 의 ID 패턴은 다음과 같이 정의됨:

```
TBL    ^TBL-[0-9][0-9][0-9]$                                      (999 한도)
TROW   ^TROW-[0-9][0-9][0-9]-[0-9][0-9]$                          (표별 99 행 한도)
TCOL   ^TCOL-[0-9][0-9][0-9]-[0-9][0-9]$                          (표별 99 열 한도)
TCELL  ^TCELL-[0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]$              (표별 99×99 셀 한도)
```

**Phase 1 적정성**: 손해평가사 1차+2차 단일 시험 + 별표 1·2·5·6·7·9 추정 ~125 노드 → 999 한도 내 안전.

**Year 2 한계 도래 시나리오** (5-Persona BA-C3 흡수):

1. **별표9 LAW-143 (75p 표)**: 행 100+ 가능성 — Phase 2A 첫 BATCH 적재에서 즉시 위배 가능.
2. **Year 2 multi-exam 5 시험 합산**: 손해평가사 + 공인중개사 + 위험물 + 소방 + 전기 = 표 합산 1,000+ 즉시 초과.
3. **TCELL-NNN-NN-NN (NNN 표 prefix)**: TBL `^\d{3}$` 한도와 연동 — TBL 확장 시 TCELL prefix 부분도 동시 확장 의무.

**5-Persona 비용 추정** (Session 052 BA-C3):

- **선제 (Year 2 진입 전)**: 1-2일 plan + 8-12일 마이그레이션 = **~10 work-day**
- **사후 (Year 2 가동 후)**: 30-50 work-day (data 마이그레이션 + 호환성 패치 + ID 재할당)
- **차이**: ~3-5배

---

## 2. 결정

`packages/parser/src/ontology-registry.json` + 4 마이그레이션 (0021/0023/0024) + Drizzle schema (`apps/api/src/db/schema.ts`) 의 ID 패턴을 다음과 같이 확장한다:

```diff
- "version": "1.5.0",
+ "version": "1.6.0",
...
   "node_id_patterns": {
     "LAW": "^LAW-\\d{3}$",
-    "TABLE":      "^TBL-\\d{3}$",
+    "TABLE":      "^TBL-\\d{3,4}$",
-    "ROW_HEADER": "^TROW-\\d{3}-\\d{2}$",
+    "ROW_HEADER": "^TROW-\\d{3,4}-\\d{2,3}$",
-    "COL_HEADER": "^TCOL-\\d{3}-\\d{2}$",
+    "COL_HEADER": "^TCOL-\\d{3,4}-\\d{2,3}$",
-    "CELL":       "^TCELL-\\d{3}-\\d{2}-\\d{2}$",
+    "CELL":       "^TCELL-\\d{3,4}-\\d{2,3}-\\d{2,3}$"
   }
```

D1 마이그레이션 GLOB CHECK 갱신:

```sql
-- 신규 마이그레이션 0027_table_id_pattern_expansion.sql (12-step procedure)
-- table_structures.CHECK (id GLOB 'TBL-[0-9][0-9][0-9]')
--   → table_structures.CHECK (
--       id GLOB 'TBL-[0-9][0-9][0-9]'
--       OR id GLOB 'TBL-[0-9][0-9][0-9][0-9]'
--     )
-- table_headers.CHECK 동일 패턴 — 9999 표 × 999 행/열
-- table_cells.CHECK 동일 패턴 — 9999 표 × 999 행 × 999 열
```

- **백워드 호환**: 기존 TBL-001~999 모두 새 pattern 통과 (실측 PASS 보장).
- **신규 허용**:
  - TBL-1000 ~ TBL-9999 (4자리, 9,000 슬롯 추가 — Year 2 multi-exam 5 시험 안전 범위)
  - TROW/TCOL-NNN-100 ~ -999 (3자리, 표별 900 행/열 추가)
  - TCELL-NNN-100-100 ~ TCELL-NNNN-999-999 (표별 ~1M 셀 — 별표9 75p 표 안전 범위)
- **거부 유지**: TBL-1, TBL-99, TBL-12345 (1/2/5자리), TROW-NNN-1, TROW-NNN-1234 등.
- **버전 bump**: 1.5.0 → 1.6.0 (SemVer MINOR — 백워드 호환 확장, ADR-031 동일 패턴).

---

## 3. 검토한 대안

### 옵션 A (★ 채택): pattern 확장 `\d{3,4}` / `\d{2,3}`

- **장점**:
  - 단일 SemVer MINOR bump, 백워드 호환 100%
  - 적재 row 0건 시 (현 시점) 마이그레이션 단순 (12-step + GLOB CHECK 갱신)
  - ADR-031 (FORMULA `^F-\d{2,3}$`) 와 동일 패턴 = 일관성 ↑
  - Year 2 multi-exam 5 시험 안전 범위 + 별표9 75p 표 안전 범위
- **단점**:
  - TBL-9999 한도 미래 재발 가능 (10 시험 합산 시) — 단, 현 비즈니스 로드맵 5 시험 한정 → 충분
  - zero-pad 충돌 정책 명문화 필요 (TBL-099 vs TBL-99 — 후자 거부, 전자 허용)

### 옵션 B (보류): 도메인 prefix 재설계 (`TBL-CROP-NN`, `TBL-LIVESTOCK-NN`)

- **장점**: 시험 확장 시 namespace 분리 자동, Hard Rule 15~17 (멀티시험 격리) 정합 ↑
- **단점**:
  - 대규모 변경 (Phase 2A BATCH 적재 후라면 모든 TBL ID rewrite + DB 마이그레이션 + ontology-registry full revision)
  - Hard Rule 17 (`ExamId` 타입 경유) 와 중복 — D1 컬럼 `exam_id` 추가 시점 (Year 2) 에 자동 격리 가능
  - ADR-031 옵션 B 와 동일 사유로 보류 (시간 단축 우선)

### 옵션 C (보류): `^TBL-\d+$` 무한 확장

- **장점**: 한계 영구 제거
- **단점**: 정합성 약화 (TBL-1 = 1자리 허용 시 ID quality 강제 X), ADR-031 옵션 C 와 동일

---

## 4. 결정 근거

**진산님 메모리 정합**:

- `feedback_no_granular_decisions` — "구현은 최상 품질 기본값" → 옵션 A 자동 채택 (지엽 결정 X)
- `feedback_focus_reliability_not_schedule` — "안정성·신뢰성·항상성 집중" → 백워드 호환 100%
- `project_completion_notification_obligation` — "Hard Rule 16/17 Year 2 zero-cost 전환 본 step 동시 처리" → Phase 2A 진입 전 의무 적용 carry-over

**Hard Limit 5 (Ontology Lock) 정합**:

- 본 변경 = ontology-registry.json **자체 갱신** (외부 ID 생성 X — 정책 정합).
- ADR-031 SemVer MINOR bump 패턴 영속 (1.5.0 → 1.6.0 = 백워드 호환 확장).

**5-Persona BA-C3 흡수 매트릭스**:

| 시나리오                       | 적정성 (현 패턴) | 적정성 (확장 후) |
| ------------------------------ | ---------------- | ---------------- |
| 손해평가사 단일 (Year 1)       | ✅ 999 한도 내   | ✅ 9999 한도 내  |
| 별표9 75p 표 (행 100+)         | ❌ 99 한도 위배  | ✅ 999 한도 내   |
| Year 2 5 시험 합산 (~1,500표)  | ❌ 999 한도 위배 | ✅ 9999 한도 내  |
| Year 3 10 시험 합산 (~3,000표) | ❌               | ✅               |

---

## 5. 적용 절차 (Year 2 Phase 4 진입 전 또는 별표9 적재 직전)

### 5.1 사전 단계 (1-2일)

1. ontology-registry.json version 1.5.0 → 1.6.0 + 4 ID 패턴 확장
2. `packages/shared/src/types.ts` ID 패턴 정규식 (있다면) 동시 갱신
3. `packages/parser/src/__tests__/ontology-registry.test.ts` 회귀 테스트 갱신 (구 패턴 + 신 패턴 모두 PASS)
4. `apps/api/src/db/schema.ts` Drizzle ColumnCheck 정규식 동시 갱신 (NC-1 정책 — Cat 10 Drizzle ↔ SQL enum sync 영향 0)

### 5.2 마이그레이션 (8-12일)

1. `migrations/0027_table_id_pattern_expansion.sql` 작성 (3 테이블 12-step procedure)
2. `docs/runbooks/migration-rollback/0027_rollback.sql` 작성 (적재 row > 0 시 신규 4자리 행 INSERT 차단)
3. staging 적용 → 검증 → production 적용
4. 적재 row 백업 (`wrangler d1 export`) — Phase 2A 적재 후 적용 시 의무
5. `verify-engine-contracts.ts` Cat 9 GLOB 패턴 검증 갱신

### 5.3 검증 단계 (1일)

1. `verify-engine-contracts.ts` 2회 PASS 일치
2. parser regression 179+ 모두 PASS
3. apps/api batch-loader-e2e 6+ PASS
4. A2 schema drift CI workflow PASS (staging↔production sqlite_master diff 0)

### 5.4 영속 의무

- ADR-033 status: Proposed → Accepted (Year 2 진입 시점 또는 별표9 적재 직전)
- ontology-registry.json `version_history` decision history 추가
- handoff 영속 + 진산 명시 결정

---

## 6. 트리거 (본 ADR 활성화 조건)

다음 중 **하나라도** 발현 시 본 ADR 즉시 적용:

1. **Year 2 Phase 4 진입 결정**: 진산 발화 "Year 2 진입" 또는 "공인중개사 시작" 등.
2. **별표9 LAW-143 적재 직전**: 75p 표 추정 행 100+ 사전 검토 시 한도 위배 발견.
3. **TBL-999 사용**: 현 시점 적재 0건이지만 Phase 2A 누적 시 ~125 노드 → ~800 노드 잔여. 800+ 추가 BATCH 시 즉시 적용.
4. **5-Persona MAJOR Carry-over Phase 진입**: 누적 이월 MAJOR ~131건 일괄 흡수 시.

---

## 7. carry-over (Phase 2A 적재 후 보강 의무)

본 ADR 적용 시점 적재 row 분포에 따라 12-step procedure 의 안전성 변동:

| 적재 시점        | 12-step 안전성  | 추가 의무                                        |
| ---------------- | --------------- | ------------------------------------------------ |
| Phase 2A 진입 전 | ★ 적재 0건      | 단순 12-step + GLOB 갱신                         |
| Phase 2A 적재 후 | 적재 ~125 노드  | 백업 dump + 신 패턴 행 INSERT 차단 정책 ADR 추가 |
| Year 2 진입 후   | 적재 ~1500 노드 | data 마이그레이션 + 호환 ID 재할당 (~3-5배 비용) |

본 ADR 활성화 시점 차세션 entry verify run1+run2 PASS 일치 의무 + 5-Persona BA-C3 회귀 검증 의무.

---

## 8. 검증 체크리스트 (활성화 시점)

- [ ] ontology-registry.json version 1.5.0 → 1.6.0 + 4 패턴 확장
- [ ] parser ontology-registry test 회귀 0
- [ ] migrations/0027_table_id_pattern_expansion.sql 작성 + staging 적용
- [ ] verify-engine-contracts.ts Cat 9 PASS
- [ ] parser regression 179+ PASS
- [ ] apps/api batch-loader-e2e 6+ PASS
- [ ] A2 schema drift CI PASS
- [ ] handoff + ADR-033 status: Accepted 갱신

---

**작성**: Claude Opus 4.7 1M context (Session 054 plan, Year 2 진입 전 의무 적용 carry-over)
**다음**: Phase 2A 첫 별표 재추출 직전 또는 Year 2 진입 트리거 시점에 본 ADR Activate.
