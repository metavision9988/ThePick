# ADR-014: Cross-Batch Integrity Validator (CBIV)

작성일: 2026-04-26
상태: Accepted
관련: ADR-011, ADR-018, ADR-021
검토서 §2 결함 D + G (P0 Critical, 핵심)

## Context

기존 Validation Framework (Level 1~3) 는 **단일 BATCH 내부 검증**에 집중. BATCH 간 회귀는 진산님 수기 검수에 의존 — 14 BATCH × 6 Layer 누적 시 인간이 모든 cross-reference 추적 **불가능**.

핵심 위험 시나리오:

- BATCH-4 적재 시 신규 산식 F-30 이 임계값 0.20 하드코딩
- 그러나 26년 개정 (BATCH-R1, CONST-901, 0.10) 적용 영역
- 인간이 모든 BATCH 의 모든 Golden Test 를 매번 재실행 못함
- → BATCH-R1 의 Golden ("손해정도비율 = 0.10") 깨짐을 인지 못한 채 적재
- → 학습자가 잘못된 정보로 시험 준비 → **서비스 사망**

진산님 명시 (검토서 §2-D, G):

> _"Claude Code 가 스스로 생성한 JSON 산출물이 기존에 적재된 다른 BATCH 의 Graph 노드들과 논리적으로 충돌하지 않는지, 시스템적(자동화된)으로 교차 검증할 수 있는 장치는 어떻게 구체화할 계획이십니까?"_

## Decision

**CBIV (Cross-Batch Integrity Validator)** — 5번째 코어 모듈 신설.

별도 패키지 `packages/cbiv/` 에 6단계 자동 검증 (5 차단 + 1 인간 결정):

1. **참조 무결성** (외래키 + exam_id + approved) — 즉시 차단
2. **의미 중복** (Adaptive Threshold, ADR-021) — flag → 인간 결정
3. **상수 일관성** (exact-match) — 즉시 차단
4. **SUPERSEDES 체인** (DFS 순환 + revision_change_id) — 즉시 차단
5. **회귀 Golden Test 재실행** (D1 Preview, ADR-018) — 즉시 차단 + root-cause-analyzer
6. **출제영역 정합성** — 경고 → 인간 결정

세부: [`docs/architecture/CBIV.md`](../architecture/CBIV.md)

**Hard Rule 20**: 신규 BATCH 적재는 CBIV 6단계 통과 후에만 D1 INSERT.
**Hard Rule 24**: Golden Test 영구 보존 + CI/CD 자동 재실행.

### Stage 6.5: BATCH Load Protocol 통합

기존 8단계 → **10단계** ([`BATCH_LOAD_PROTOCOL.md`](../architecture/BATCH_LOAD_PROTOCOL.md)):

- Stage 6.5: CBIV 6단계 자동 검증 (NEW)
- Stage 7.5: 의미 중복 인간 결정 (NEW, [`ADMIN_REVIEW_UI.md`](../architecture/ADMIN_REVIEW_UI.md))
- Stage 10: Golden Test 영구 보존 + CI/CD 등록 (NEW)

## Consequences

### 긍정적

- Cross-BATCH 회귀 자동화 — 인간 검수 한계 돌파
- BATCH 누적 시 시스템 자살 방지
- root-cause-analyzer 로 실패 원인 자동 분석 — 디버깅 시간 단축
- Golden Test 영구 보존 — CI/CD 매 PR 마다 자동 재실행

### Trade-offs

- ~600 LOC + 4 마이그레이션 추가
- BATCH 적재당 +30초 (회귀 Golden 재실행)
- D1 Preview Database 비용 (CI 1회 ~$0, 무료 한도 내)

### 코드 위치

```
packages/cbiv/                       # 5번째 코어 패키지
├── src/
│   ├── stages/
│   │   ├── 1-referential.ts
│   │   ├── 2-deduplication.ts        # Adaptive Threshold (ADR-021)
│   │   ├── 3-coherence.ts
│   │   ├── 4-supersedes.ts
│   │   ├── 5-regression.ts            # ★ 핵심
│   │   └── 6-scope.ts
│   ├── runner/
│   │   ├── d1-preview-runner.ts       # ADR-018
│   │   ├── golden-test-runner.ts
│   │   └── root-cause-analyzer.ts
│   └── reports/
└── tests/
```

### 진산님 결정 1: BATCH-1 dry-run 전 완성 (메타 관찰자, 확정)
