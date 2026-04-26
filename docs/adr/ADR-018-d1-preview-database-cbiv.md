# ADR-018: D1 Preview Database for CBIV Regression

작성일: 2026-04-26
상태: Accepted (v2.1 보강)
관련: ADR-014 (CBIV)
검토서 v2.1 §2 MR-1 (P0 Critical)

## Context

v2.0 의 CBIV Stage 5 (회귀 Golden Test) 는 in-memory `better-sqlite3` 기반 가상 D1 (`createVirtualDb()`) 사용.

비판 (메타 관찰자, MR-1):

- BATCH-14 누적 시 ~620 노드 + 2000 엣지 + 1000+ Golden Test → Cloudflare Workers 메모리 한계 (128MB) **OOM 위험**
- in-memory SQLite ≠ 실제 D1 (SQL 방언 차이 — `RANDOM()` 시드, JSON 처리)
- "통과했지만 production 에서 fail" 시나리오 — 검증의 본질 위반

## Decision

CBIV 회귀 검증은 **Cloudflare D1 Preview Database** 만 사용 (in-memory 폐기).

### 1단계: CI/CD 통합

```yaml
# .github/workflows/cbiv-regression.yml
on:
  pull_request:
    paths: [packages/parser/**, packages/cbiv/**, migrations/**, ...]

jobs:
  regression:
    steps:
      - run: |
          DB_NAME="cbiv-pr-${{ github.event.pull_request.number }}"
          wrangler d1 create $DB_NAME --preview
      - run: wrangler d1 migrations apply $DB_NAME --preview
      - run: pnpm cbiv:seed --target $DB_NAME --preview
      - run: pnpm cbiv:regression --target $DB_NAME --preview
      - if: always()
        run: wrangler d1 delete $DB_NAME --preview --yes
```

### 2단계: 로컬 분리 — Wrangler `--local`

개발자 PR 전 1차 검증:

```bash
wrangler d1 execute cbiv-local --local --file=migrations/0001_init.sql
pnpm cbiv:regression --target cbiv-local --local
```

`--local` 은 better-sqlite3 사용 (1차 필터). **CI 의 `--preview` 가 최종 진실**.

### 3단계: CBIV 패키지 인터페이스

```typescript
export interface DbTarget {
  type: 'local' | 'preview' | 'production';
  databaseName: string;
}

export async function runCbiv(
  newBatchData: BatchData,
  prevBatches: number[],
  target: DbTarget, // ★ v2.1
): Promise<CbivResult>;
```

**Hard Rule 25**: CBIV 회귀 검증은 D1 Preview Database 환경에서만 수행. in-memory SQLite 는 로컬 1차 검증용으로만 사용.

## Consequences

### 긍정적

- OOM 방지 (BATCH-14 수준에서도 안전)
- production D1 정합성 100% (SQL 방언 일치)
- CI 비용 무료 (Cloudflare D1 무료 한도 내, BATCH-14 ≈ 50MB < 5GB)

### Trade-offs

- CI 시간 +5초 (D1 프로비저닝)
- Wrangler 의존성 (이미 인프라에 존재 — 영향 0)

### 코드 위치

```
packages/cbiv/src/runner/
├── db-target.ts                # DbTarget 인터페이스
├── d1-preview-runner.ts         # ★ Cloudflare D1 Preview
├── d1-local-runner.ts           # 로컬 1차 검증
├── golden-test-runner.ts
└── (virtual-db.ts 폐기)
```

### 테스트 기준

| ID       | 통과 기준                                   |
| :------- | :------------------------------------------ |
| CBIV-T08 | BATCH-14 시뮬, 메모리 100MB 이하            |
| CBIV-T09 | D1 Preview ↔ Production 같은 SQL 결과 (5종) |
