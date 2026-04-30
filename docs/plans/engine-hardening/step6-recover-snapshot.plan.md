# Step 11.5 — apps/batch recover() + snapshot() 구현

---

phase: 1
step: engine-hardening-11.5
approved_by: TBD
risk_level: L3
scope:

- apps/batch/src/checkpoint.ts (신규)
- apps/batch/src/recover.ts (신규)
- apps/batch/src/pipeline.ts (수정 — checkpoint 호출 추가)
- apps/batch/**tests**/recover.test.ts (신규)
- migrations/00NN_batch_run_metadata.sql (신규 — batch_run_id 메타테이블)
- .gitignore (`.checkpoint/` 추가)

---

## 목적

L3 엔진 `apps/batch`의 비정상 종료 시 데이터 손실 차단. **Review B-2 핵심** — Solo-Builder라도 L3는 `recover()` 이연 불가. ThePick 환경(Node.js 로컬 BATCH)에서 발생 가능한 시나리오:

- Claude Code 90분 세션 단절
- 진산님 Ctrl+C / 노트북 슬립 / 시스템 재부팅
- Node.js 비정상 종료 (메모리 부족, 디스크 가득 참)
- D1 INSERT 도중 네트워크 단절

→ recover() 없이 처음부터 재시작 = 인간 검수 비용 폭발 + 토큰 비용 재청구.

## 근거

- v3.0 Vol V.2 (Lifecycle 5종 hook — recover/snapshot 의무)
- v3.0 Vol VIII (DEFCON 매트릭스 — L3는 Resurrection Chaos 의무)
- ADR-023 (Engine-First Before BATCH-1)
- Engine Hardening Roadmap v1.1 Section 0.5 보완점 B-2

---

## 대상 파일

### 신규

- `apps/batch/src/checkpoint.ts` — Checkpoint 직렬화/저장/로드/무결성 검증
- `apps/batch/src/recover.ts` — Recovery 결정 트리 (v3.0 Vol V.4 4단계) 구현
- `apps/batch/__tests__/recover.test.ts` — AC-R1/R2/R3 검증

### 수정

- `apps/batch/src/pipeline.ts` — 매 Stage 종료 시 checkpoint 발행. 시작 시 recover() 시도.
- `migrations/00NN_batch_run_metadata.sql` — `batch_runs` 테이블 (`batch_run_id`, `started_at`, `last_completed_stage`, `last_node_id`, `state`) — Idempotency 차단용

### .gitignore 추가

```
.checkpoint/
```

---

## 인터페이스 설계

```typescript
// checkpoint.ts
export interface BatchCheckpoint {
  batch_run_id: string; // UUID (per BATCH 실행)
  engine_name: '@thepick/batch';
  engine_version: string; // package.json version
  timestamp: string; // ISO 8601
  pipeline_stage: PipelineStage; // pdf_extract | section_split | ... | qg2_gate
  progress: {
    current_stage_index: number; // 1~10
    total_stages: number; // 10
    nodes_processed: number;
    nodes_total: number;
  };
  pipeline_state_snapshot: object; // Stage별 직렬화 가능한 state
  state_hash: string; // SHA-256 of normalized snapshot
  pii_filtered: true; // BATCH는 PII 미포함 (자료 적재)
  encryption: 'none'; // 로컬 파일 (.gitignore + .checkpoint/)
}

// recover.ts
export interface RecoveryResult {
  status: 'fully_recovered' | 'partially_recovered' | 'recovery_failed';
  resumed_from_stage: PipelineStage;
  data_loss_estimate: {
    nodes_lost: number;
    stages_skipped: number;
    severity: 'none' | 'minor' | 'major' | 'critical';
  };
  fallback_strategy?: 'restart' | 'manual_review_required';
  user_notification_required: boolean;
  message: string; // 진산님에게 표시할 한글 메시지
}

export async function snapshot(state: PipelineState): Promise<BatchCheckpoint>;
export async function recover(batch_run_id: string): Promise<RecoveryResult>;
```

---

## 저장 위치 (ThePick 환경 매핑)

| 데이터            | 위치                                     | 사유                                               |
| :---------------- | :--------------------------------------- | :------------------------------------------------- |
| Checkpoint 파일   | `.checkpoint/{batch_run_id}.json` (로컬) | Node.js 로컬 환경 — Cloudflare KV 미사용           |
| batch_run_id 메타 | D1 `batch_runs` 테이블                   | Idempotency 보장 — 두 번째 실행이 중복 INSERT 차단 |
| .checkpoint/      | `.gitignore` 추가                        | 잠재 PII는 없으나 로컬 임시 데이터                 |

D1 메타테이블 스키마:

```sql
CREATE TABLE IF NOT EXISTS batch_runs (
  batch_run_id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,           -- ISO 8601
  completed_at TEXT,                  -- NULL = 진행 중 또는 비정상 종료
  last_completed_stage TEXT NOT NULL, -- PipelineStage enum
  last_node_id TEXT,                  -- 마지막 INSERT된 노드
  state TEXT NOT NULL,                -- 'in_progress' | 'completed' | 'failed' | 'recovered'
  resume_count INTEGER DEFAULT 0,     -- recover() 호출 횟수
  fixture_path TEXT NOT NULL,
  state_hash TEXT NOT NULL            -- 마지막 checkpoint의 state_hash
);
```

---

## 위험 분석

| 위험                                         | 완화                                                                                 |
| :------------------------------------------- | :----------------------------------------------------------------------------------- |
| Checkpoint 파일 변조                         | SHA-256 무결성 검증 (AC-R2) — 변조 감지 시 거부 + 진산님 알림                        |
| 동시 실행으로 인한 Race Condition            | `batch_runs.state = 'in_progress'` 행 존재 시 신규 실행 차단 (Idempotency, B-4 연동) |
| `engine_version` major 변경 후 recover       | v3.0 Vol V.4 Q3 — major 다르면 recover 거부 + Migration 권고                         |
| Stage별 state 직렬화 누락 (예: 임시 변수)    | Pipeline 작성 시 명시적 직렬화 — 테스트로 검증                                       |
| `.checkpoint/` 디렉토리 손상                 | recover() 실패 시 처음부터 재시작 (`fully_recovered` 아님 — `recovery_failed`)       |
| Idempotency 충돌 (이미 INSERT된 노드 재실행) | `INSERT OR IGNORE` 또는 `(batch_run_id, source_id)` 유니크 제약                      |

---

## 검증 계획 (Acceptance Criteria)

### AC-R1: OOM 부활 시나리오 (v3.0 Vol VII.5 R1)

- BATCH-1 fixture를 50% (5/10 stage) 진행 후 `process.exit(1)` 강제
- recover(batch_run_id) 호출
- **검증:**
  - `status === 'fully_recovered'`
  - `resumed_from_stage === 'integrity_check'` (Stage 6, 5번째 완료 다음)
  - `data_loss_estimate.nodes_lost === 0`
  - 최종 Stage 10 (`qg2_gate`) 통과 시 INSERT된 총 노드 수 = 정상 실행과 동일

### AC-R2: Checkpoint 변조 감지

- BATCH 50% 진행 후 정상 checkpoint 발행
- `.checkpoint/{batch_run_id}.json` 파일을 외부에서 1바이트 수정
- recover() 호출
- **검증:**
  - `status === 'recovery_failed'`
  - `message`에 "체크포인트 무결성 검증 실패" 포함
  - 자동으로 처음부터 재시작 시도 X (인간 결정 의무)
  - `user_notification_required === true`

### AC-R3: 동일 batch_run_id 재실행 차단 (Idempotency, B-4)

- BATCH-1 1회 정상 완료 후 동일 `batch_run_id`로 재실행 시도
- **검증:**
  - `batch_runs.state === 'completed'` 감지
  - 신규 INSERT 0건 (중복 방지)
  - 기존 결과 재사용 (skip with success message)

### AC-R4: 동시 실행 차단 (Idempotency, B-4)

- BATCH-1 진행 중 (state='in_progress') 두 번째 진산님 트리거 시도
- **검증:**
  - 두 번째 실행이 즉시 거부됨 (`message` = "BATCH-1 이미 실행 중")
  - 첫 번째 실행 정상 완료
  - 두 번째 실행은 첫 번째 완료 후 (Idempotency로 skip)

### AC-R5: 버전 불일치 거부 (v3.0 Vol VII.5 R3)

- BATCH `@thepick/batch` v0.1.0으로 checkpoint 생성
- 패키지 버전을 v0.2.0으로 변경 (major bump 가정 — 실제론 minor)
- recover() 호출
- **검증:**
  - `status === 'recovery_failed'`
  - `message`에 "버전 불일치 — Migration 가이드 참조" 포함

---

## 롤백 전략

본 plan 구현 중 또는 후 결함 발견 시:

- `apps/batch/src/checkpoint.ts` `recover.ts` 파일 삭제
- `pipeline.ts`의 checkpoint 호출 코드 revert (git)
- D1 `batch_runs` 테이블은 그대로 보존 — 향후 재구현 시 활용
- `.checkpoint/` 로컬 파일 삭제

영향 범위: 본 plan은 **신규 추가** — 기존 BATCH 파이프라인 동작 변경 없음 (checkpoint는 부수 효과).

---

## 승인 기록

- Claude 독립 리뷰: Step 19 4-Pass + 5-페르소나 (CRITICAL 0건 후 진행)
- 진산님 승인 메시지: 2026-04-27 Engine Hardening Roadmap v1.1 승인 (본 plan 포함)

---

## 의존성

- **Blocked by:** Task #5 (엔진 contract.yaml 3종) → 완료
- **Blocks:** Task #8 (코드 구현 단계)
- **참조:** ADR-023, Engine Hardening Roadmap v1.1 §0.5 B-2

---

## v1.1 정정 — 4-Pass 리뷰 결과 반영 (2026-04-27)

리뷰: `.claude/reviews/review-20260427-230149-step11-5-recover-4pass.md`

### 본 단계에서 정정 완료 (코드 + 문서)

| 항목                                         | 정정                                                                         |
| :------------------------------------------- | :--------------------------------------------------------------------------- |
| 0015 트리거 — UPDATE 무방비 (CRITICAL P1-C1) | `BEFORE UPDATE OF state` 트리거 2종 추가 (downgrade 차단 + concurrent guard) |
| JSON.parse silent 전파 (P1-M3)               | `try/catch → CheckpointCorruptedError` 통합 + shape 검증                     |
| `parseMajor` raw throw (P1-M2)               | `try/catch → CheckpointVersionMismatchError` 통합                            |
| Q4 `depends_on` stub (P1-M4)                 | 발견 시 `recovery_failed + manual_review` 명시 거부                          |
| `canonicalJson` Date silent collapse (P1-m3) | 사전 walk 로 Date/Map/Set/BigInt/Function 명시 throw                         |
| 24h 매직넘버 (P1-m2)                         | `STALE_LOCK_THRESHOLD_MS` 상수 추출 + `Math.max(0, ...)` clock skew 방어     |
| `nodes_total` 의미 부정확 (P1-m1)            | `nodes_completed` + `edges_completed` 분리                                   |
| `BatchRunState` 5종 ('killed' 추가)          | plan 명시 (4종 → 5종 의도적)                                                 |
| BatchCheckpoint shape 강화                   | `schema_version` 검증 + runtime typeof guard                                 |

### 본 단계에서 명시 이연 (다음 단계로 이전)

#### 이연 1 — pipeline.ts 통합 → **Step 11.6 신설**

본 plan §"대상 파일" 의 `pipeline.ts (수정)` 항목은 본 단계에서 미수행. 이유:

- pipeline.ts 의 `PipelineState` 가 직렬화 가능한 형태로 정규화 필요 (현재 `PipelineState` 에 직렬화 불가능한 객체 포함 가능)
- 매 stage 종료 시 snapshot() 호출 + 시작 시 recover() 호출 통합 = 별도 ~1일 작업
- AC-R1 e2e ("BATCH 50% 진행 → kill → recover → 정확 재개") 검증을 본 단계 mock 으로는 불가

→ **Step 11.6 신설**: pipeline.ts 통합 + e2e AC-R1 + fsync 도입 + SIGINT/SIGTERM handler.
산출물: `docs/plans/engine-hardening/step11-6-pipeline-recover-integration.plan.md` (2026-04-28 작성 완료, v1.0 Draft).

#### 이연 2 — `(batch_run_id, source_id)` UNIQUE 제약 → **Step 5 plan 의무**

본 plan §"위험 분석" 의 "Idempotency 충돌" 항목은 Step 5 plan 책임. 본 plan 0015 마이그레이션은 `batch_runs` 메타테이블만. `knowledge_nodes` 등에 `batch_run_id` 컬럼 추가 + UNIQUE 인덱스는 Step 5 (`step5-reproducibility-idempotency.plan.md`) 의 핵심 요구.

→ Step 5 plan 진입 시 다음 마이그레이션(0016)에서 추가:

```sql
ALTER TABLE knowledge_nodes ADD COLUMN batch_run_id TEXT REFERENCES batch_runs(batch_run_id);
CREATE UNIQUE INDEX idx_knowledge_nodes_batch_source ON knowledge_nodes(batch_run_id, source_id);
-- formulas, constants, knowledge_edges 도 동일
```

#### 이연 3 — `writeCheckpoint` fsync 누락 (P1-M1)

본 단계는 `writeFile + rename` 만 — Node.js 21+ 의 `flush:true` 옵션 또는 fdatasync 미적용. power loss 시 0바이트 가능성. 현재는 `readCheckpoint` 의 `JSON.parse` 가드(P1-M3 정정)로 silent failure 차단.

→ Step 11.6 (pipeline 통합) 에서 production 환경 fsync 옵션 도입.

#### 이연 4 — exam_id 격리 (Hard Rule 16)

`BatchRunsDb.selectByRunId(batchRunId)` 시그니처에 `examId` 미포함. 현재 단일 시험(손해평가사) 단계라 batch_run_id UUID 자체 격리로 충분. Year 2 멀티시험 진입 시 선두 인자로 추가 필요 — 메모리 `project_v3_final_multi_exam_deferred` 정합.

#### 이연 5 — D1 Preview/실 D1 통합 테스트

현재 mock `BatchRunsDb` 만 검증. 0015 트리거 자체의 발화는 ADR-018 D1 Preview 환경에서 별도 검증. → Step 11.6 통합 단계 또는 Step 7 contract verify 에 흡수.

---

## 작업 추정

- 낙관: 0.5d
- 현실: 1d (×1.5 calibration)
- 비관: 1.5d
- **v1.1 정정 후 실측: 약 1.2d** (4-Pass 리뷰 + 정정 포함)
