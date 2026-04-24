# ADR-010: formulas/constants 의 상태(status) canonical 원천 정의

- **상태:** Accepted
- **결정일:** 2026-04-24 (Session 11)
- **결정자:** 진산 (위임: 지엽 결정 delegation 금지 원칙에 따라 기본값 채택) + Claude Opus 4.7
- **관련 문서:**
  - `migrations/0010_status_transitions_and_page_ref_guard.sql`
  - `apps/batch/src/loader/state-machine.ts`
  - `apps/batch/src/loader/draft-loader.ts`
  - `.claude/reviews/review-20260424-104000-step1-5-ga-0-4pass.md` (CR-5c 지적)
  - ADR-008 (graceful-degradation-thresholds)

## 맥락 (Context)

Phase 1 Step 1-5 (가-0) 4-Pass 독립 리뷰에서 Pass 4 (Contract) 가 제기한 **canonical 원천 불일치** 문제:

- `knowledge_nodes` 테이블에는 `status` 컬럼 존재 (migrations/0001 원본 스키마)
- `formulas`, `constants` 테이블에는 `status` 컬럼 **부재** (migrations/0001 원본에 미설계)
- migrations/0010 은 `status_transitions` append-only 로그 테이블을 도입하여 세 타입(node/formula/constant) 모두의 상태 전이를 외부화
- 결과: knowledge_nodes 는 "컬럼 + 로그" **이중 진실 원천** 구조, formulas/constants 는 "로그만" **단일 진실 원천** 구조 — **같은 파이프라인 내 두 패턴 공존**

이 비대칭은 다음과 같은 모호함을 낳는다:

1. knowledge_nodes 의 실시간 현재 상태는 "컬럼의 값" 인가 "로그의 최신 레코드" 인가?
2. formulas/constants 와 knowledge_nodes 간 조회 API를 통일할 수 있는가?
3. 향후 formulas/constants 에 `status` 컬럼을 추가하는 마이그레이션이 필요한가?
4. draft-loader 의 INSERT 시점에 status 를 어느 경로로 기록해야 하는가?

## 결정 (Decision)

### 1. 상태 canonical 원천은 **항상 `status_transitions` 테이블 (append-only 로그)**

세 타입 모두 **"status_transitions 의 최신 레코드 (target_type, target_id) 조건 + transitioned_at DESC LIMIT 1"** 이 canonical 현재 상태다. 로그에 레코드가 없으면 DEFAULT `'draft'`.

### 2. knowledge_nodes.status 컬럼은 **초기 스냅샷 전용**

- INSERT 시점의 최초 status (대부분 `'draft'`) 를 기록하는 **역사적 스냅샷**
- 이후 **절대 UPDATE 하지 않는다** (migrations/0010 의 `prevent_nodes_update` 트리거로 DB 강제)
- 실시간 조회에 사용해서는 안 되며, 마이그레이션 당시 존재한 레코드의 초기값 보존 목적에 한정

### 3. formulas/constants 에 status 컬럼 **추가하지 않는다**

- 단일 원천 구조가 더 단순하고 정합적
- 마이그레이션 추가는 L3 리스크, 이득 없음
- draft-loader 는 formulas/constants INSERT 시 status 필드를 기록하지 않으며, 상태 전이는 loader/state-machine 의 `transitionStatus()` 호출 한 경로로만 발생

### 4. knowledge_nodes.status 컬럼은 **미래 deprecation 예약**

- 새로운 조회 API/대시보드/관리자 UI 는 **반드시 status_transitions 최신 레코드** 를 조회한다 (COALESCE 패턴 참고: `batch.ts:326-334`)
- knowledge_nodes.status 를 읽는 기존 코드는 차차 COALESCE 패턴으로 마이그레이션
- Phase 2 이후 컬럼 자체 DROP 고려 (현 시점 deprecated 마크, 즉시 DROP 은 비권장 — 기존 쿼리 영향 범위 파악 후)

## 구현 규칙 (Implementation Rules)

### 조회 (Read)

```sql
-- canonical 상태 조회 패턴
SELECT t.id,
       COALESCE(
         (SELECT to_status FROM status_transitions
           WHERE target_type = ? AND target_id = t.id
           ORDER BY transitioned_at DESC LIMIT 1),
         'draft'
       ) AS current_status
FROM {table} t
WHERE ...
```

- `{table}` ∈ `{knowledge_nodes, formulas, constants}`
- `target_type` ∈ `{'node', 'formula', 'constant'}`
- knowledge_nodes.status 컬럼을 직접 읽는 코드는 **신규 작성 금지**
- 관리자 쿼리, 대시보드 쿼리, API 응답 모두 위 패턴 통일

### 쓰기 (Write)

- **INSERT**: draft-loader 가 knowledge_nodes 에는 `status='draft'` 기록 (역사 스냅샷), formulas/constants 에는 status 필드 없음
- **상태 전이**: `loader/state-machine.ts` 의 `transitionStatus(db, { targetType, targetId, toStatus, reviewerId, ... })` **한 경로만** 사용
- 다른 어떤 코드도 status 를 갱신하지 않는다 (0010 트리거가 DB 강제)

### 테스트 규약

- F1 통합 테스트 보강 시 "approved 노드의 knowledge_nodes.status 컬럼은 여전히 `'draft'`, status_transitions 최신 레코드는 `'approved'`" 를 명시적으로 검증 (canonical 분리 회귀 방지)

## 결과 / 영향 (Consequences)

### 긍정

- 단일 상태 원천 → 구현 단순화
- status_transitions 의 append-only 특성으로 감사 추적 자연스럽게 확보
- 타입별 상태 컬럼 유무 비대칭이 개념적으로 해소 (모두 로그 기반 조회)
- formulas/constants 도 Temporal Graph 원칙 (UPDATE 금지) 완전 부합

### 부정

- 모든 상태 조회가 status_transitions JOIN/서브쿼리 경유 → **읽기 부하 증가**
  - 완화: `idx_status_transitions_target` 인덱스 (migrations/0010:38) 로 `(target_type, target_id, transitioned_at DESC)` 커버리지 확보
  - 완화: 대시보드 자주 조회되는 상태는 Phase 2 에서 materialized view 또는 Durable Objects 캐시 검토
- knowledge_nodes.status 컬럼이 "읽지 마라" 라는 암묵 규칙으로 남음 → **코드 리뷰어가 놓칠 위험**
  - 완화: ESLint 커스텀 룰 또는 검색 기반 CI 체크 Phase 2 에서 검토
  - 완화: 본 ADR 을 `.claude/rules/` 에 요약 참조 링크 추가

### 중립

- knowledge_nodes.status 컬럼 DROP 은 Phase 2 이후 별도 결정 (본 ADR 스코프 외)
- 공인중개사 등 Year 2 시험 확장 시에도 동일 규칙 적용 (ExamAdapter 와 무관)

## 롤백 (Rollback)

본 ADR 결정의 롤백은 불필요 — 기존 코드(migrations/0010, state-machine.ts, draft-loader.ts) 가 이미 본 규칙대로 구현되어 있고, 본 ADR 은 규칙을 **명시적으로 문서화**하는 역할이다.

만약 향후 canonical 을 knowledge_nodes.status 컬럼으로 되돌려야 한다면:

1. formulas/constants 에 status 컬럼 추가 마이그레이션
2. status_transitions 로그를 소스로 하여 각 타입의 status 컬럼 백필
3. migrations/0010 의 UPDATE 차단 트리거를 status 컬럼에만 예외 추가
4. 조회 쿼리 전수 수정

→ 추정 공수 1~2주 + L3 리스크. 본 ADR 을 먼저 번복하는 별도 ADR 필수.

## 참조

- Hard Limit: `CLAUDE.md` "knowledge_nodes, formulas 테이블 UPDATE 금지"
- Hard Limit: `CLAUDE.md` "AI 생성 데이터는 draft 상태로만 적재"
- 리뷰 원전: `.claude/reviews/review-20260424-104000-step1-5-ga-0-4pass.md` CR-5c
