# 4-PASS REVIEW — Pass 2 (ARCHITECT / system-architect)

**대상**: Sprint 1 §5.4 PARTIAL 7건 + ADR-029 + ESLint rule (8 commits)
**리뷰 일시**: 2026-05-02
**리뷰 방식**: 독립 system-architect 에이전트 (Pass 2 / 다중 에이전트 병렬 중 1)
**관점**: "이 코드가 다른 모듈과 만나면 터지는가?" — Top-Down 연계 검증

---

## 리뷰 범위

### 변경 파일 (8 commits)

| Commit    | 영역                                     | 파일 수 |
| :-------- | :--------------------------------------- | :------ |
| `a258f36` | apps/batch + docs/adr (REC-02 + ADR-029) | 2       |
| `cd25854` | apps/batch (REC-01 parametrized)         | 1       |
| `8dc2c13` | formula-engine + ADR-029 (PRC-01 + 한도) | 4       |
| `b6891ed` | formula-engine (PRF-01 + iterative DFS)  | 2       |
| `02d95b6` | quality (PRF-02)                         | 1       |
| `cec2aae` | formula-engine (FUZ-04)                  | 1       |
| `11b366f` | apps/api/scheduled (CHA-06)              | 1       |
| `50c8bb3` | .eslintrc.json (no-restricted-imports)   | 1       |

### 연관 파일 (확인 대상)

- `packages/formula-engine/src/sandbox.ts` (한도 변경 + iterative DFS + perf.now)
- `packages/formula-engine/src/ast-parser.ts` (cache hit 시 한도 재검증)
- `packages/formula-engine/src/engine.ts` (COMPUTE_TIMEOUT 매핑)
- `packages/shared/src/test-helpers/perf.ts` (PRF measure utility)
- `packages/shared/package.json` (`./test-helpers/perf` exports)
- `packages/quality/package.json` / `packages/formula-engine/package.json` (의존 단방향)
- `apps/api/src/scheduled/rate-limit-gc.ts` (CHA-06 대상)
- `apps/api/wrangler.toml` (compatibility_date 2026-04-01)
- `apps/batch/package.json` (Node CLI — node:fs 허용 검증)
- `docs/adr/ADR-029-formula-engine-resource-limit.md` (정합 검증)
- `docs/architecture/ARCHITECTURE.md` (다이어그램 정합)
- `.eslintrc.json` overrides + 전 패키지 lint 회귀

---

## Pass 2 (Architect) 결과

✅ **15건 확인** / 🔴 **0건** / 🟠 **3건** / N/A **2건**

### ✅ 확인 (Top-Down 연계 검증)

1. **Import 방향 단방향 정합** — `packages/formula-engine/package.json:14-16` deps `@thepick/shared` + `mathjs` 만. `packages/quality/package.json:13-15` deps `@thepick/shared` 만. quality → parser 역방향 import 0건 (`grep -rn "from '@thepick/parser'" packages/quality` empty). 본 8 commits 가 신규 cross-package 의존성 도입 0건.
2. **`@thepick/shared/test-helpers/perf` 공식 sub-export 경로 정합** — `packages/shared/package.json:11` `"./test-helpers/perf": "./src/test-helpers/perf.ts"` 선언. PRF-01 (`prf-01-formula-engine-perf.test.ts:18`) 와 PRF-02 (`prf-02-naive-vs-tarjan.test.ts:21`) 가 동일 경로 import — workspace resolution 정상. `pnpm -r lint` clean.
3. **Workers 제약 — fs/path 사용 0건 (formula-engine + quality)** — `grep -rn "node:fs\|node:path\|node:os" packages/formula-engine packages/quality` empty. apps/api 도 마찬가지. Workers isolate 호환.
4. **apps/batch Node CLI — node:fs 허용 정합** — `apps/batch/package.json` 은 `bin: thepick-batch` Node CLI (wrangler.toml 부재). REC-01/02 의 `node:fs/promises`/`node:os`/`node:path` 임포트 (rec-02 line 26-28) 정합. Workers 번들 진입 0건.
5. **performance.now() — Workers compatibility_date 2026-04-01 정합** — `apps/api/wrangler.toml:5` `compatibility_date = "2026-04-01"` + `compatibility_flags = ["nodejs_compat"]`. `globalThis.performance` 보장 시점. `sandbox.ts:369-376` fallback 도 `Date.now()` — 양쪽 환경 안전.
6. **iterative computeAstDepth — V8 stack overflow 방어** — `sandbox.ts:265-281` 명시 stack DFS. 이전 순수 재귀가 V8 max-call-stack 초과 시 RangeError 가 `engine.ts` catch 우회 throw propagate 가능했던 이슈 흡수. 동일 결과 보장 (depth = root→leaf 최장 + 1).
7. **AST 한도 보수화 — ADR-029 §2.4 절차 정합** — ADR-029 Decision Log (line 199) 갱신 + `cha-02-compute-timeout.test.ts` 한도 회귀 갱신 (라인 28-50 영역) + cache invalidation 본질 자동 (`ast-parser.ts:52` cache hit 시 `assertWithinComplexityBudget` 재실행). §2.4 (1) Decision Log / (2) cache invalidation / (3) 회귀 게이트 / (4) L3 ADR 모두 충족.
8. **parseFormula cache hit 시 한도 재검증** — `ast-parser.ts:46-58` cache hit 분기에서 `assertWithinComplexityBudget(cached.node)` 재실행. 한도 변경 시점 캐시된 산식이 신규 검증 우회 회귀 vector 차단. C-CODE-1 흡수 정합.
9. **D1 스키마 — rate_limits / bucket_minute 정합** — `purgeOldRateLimits` (rate-limit-gc.ts:54-57) `DELETE FROM rate_limits WHERE bucket_minute < ?` + `migrations/0012` 의 `idx_rate_limits_bucket` 인덱스 활용. CHA-06 시드 (`cha-06-cron-24h-miss.test.ts:48-52`) 가 동일 컬럼 사용 — Drizzle ORM ↔ D1 shape 일치.
10. **REC checkpoint — atomic temp+rename 정합 무위배** — REC-02 시나리오 1/5 의 `writeFile(filePath, tampered, 'utf8')` 는 비-atomic 단순 overwrite (테스트 의도). 본 commit이 production write 경로(`writeCheckpoint` atomic path)를 변경하지 않음 (`grep "writeCheckpoint" apps/batch/src/checkpoint.ts` 미수정).
11. **ESLint patterns 단방향 정합** — `.eslintrc.json:24-28` patterns `**/__tests__/helpers/**` / `**/__tests__/**` / `**/test-helpers/**` 모두 production code → test resource 단방향 차단. overrides (line 41-50) 가 test 파일 자체를 면제.
12. **D1 mock helpers — production 격리** — `apps/api/src/__tests__/helpers/d1-disconnect-mock.ts:7-8` `@testOnly` 명시 + Sprint 1 §5.4 ESLint 차단 의무 명시. 본 commit `50c8bb3` 가 그 약속 이행. `grep "from .*d1-disconnect-mock"` 결과 `__tests__/scenarios/cha-01-d1-disconnect.test.ts` 단 1건 (test 영역).
13. **FUZ-04 — sandbox 화이트리스트 정합** — `fuz-04-sandbox-bypass-12-vectors.test.ts:44-61` 12 vectors (Function/eval/setTimeout/import/process.env/globalThis/**proto**/circular/Symbol/BigInt/Promise/Reflect) 모두 `safeParse` 화이트리스트 (sandbox.ts:45-62 ALLOWED_FUNCTIONS) 외부. 검증 결과 vector 8 (`a + a + a` AST tree 자연 통과) 외 11/11 거부.
14. **PRF-02 graph generator — DAG invariant 보존** — `prf-02-naive-vs-tarjan.test.ts:42-55` cross-link `to = min(from + 1 + (i % 5), N - 1)` 항상 `from < to` → DAG 보존. `findSupersedeCycles` 가 violations=0 sanity 통과 (line 144).
15. **테스트 결과 회귀 0건** — formula-engine: 264 → 301 PASS (+37), quality: 48 → 57 PASS (+9), apps/api: 273 → 277 PASS (+4). 본 시점 `pnpm -F @thepick/formula-engine test` 재실행 301 PASS 확인. `pnpm -r lint` clean.

### 🟠 MAJOR (3건)

#### MAJOR-A2-1 — ESLint patterns "**/test-helpers/**" 광역 매칭으로 shared lib 내부 import 표면 차단 위험 (defense-in-depth 부족)

**파일**: `.eslintrc.json:24-28`
**증거**:

- pattern `**/test-helpers/**` 가 `packages/shared/src/test-helpers/perf.ts` 자체와 `node_modules/.../test-helpers/...` 등 어떤 경로든 매칭
- 현재 lint는 통과 (overrides 가 `**/test-helpers/**` 파일들을 면제) — 그러나 production 코드 (예: `packages/shared/src/index.ts`) 가 internal `./test-helpers/perf` 임포트 시도 시 ESLint error 발화 가능
- `packages/shared/src/index.ts` 가 향후 `export * from './test-helpers/perf'` 같은 re-export 시도 시 즉시 차단 (의도? 의도라면 명시 필요)

**시나리오**: shared 패키지가 자체 source 내에서 test-helpers 를 internal import 시 ESLint 막힘 → 회피 위해 `// eslint-disable-next-line` 우회 → 규칙 약화 시작.

**권고**: pattern 을 `@thepick/shared/test-helpers/**` (npm 경로) 또는 `**/src/test-helpers/**` 등 명시적 절대 패턴으로 좁히고, relative `./test-helpers/...` 는 자연 미차단. 또는 `packages/shared/src/**` 자체 면제 override 추가.

#### MAJOR-A2-2 — ARCHITECTURE.md Mermaid 다이어그램에 `apps/api/src/scheduled/` Cron Trigger 표상 부재

**파일**: `docs/architecture/ARCHITECTURE.md`
**증거**:

- `grep -n "rate-limit-gc\|purgeOldRateLimits\|scheduled\|Cron" docs/architecture/ARCHITECTURE.md` empty
- CHA-06 commit (`11b366f`) 이 검증하는 `purgeOldRateLimits` 는 Cloudflare Workers Cron Trigger (rate-limit-gc.ts:1-3 헤더 명시) 일일 발화 운영 컴포넌트
- Workers Cron Trigger 는 동기화/배치/비동기 모두와 다른 트리거 — ARCHITECTURE.md §"오프라인 동기화" 시퀀스에도 부재

**시나리오**: 새 세션 Claude 가 ARCHITECTURE.md 만 읽고 작업 시 Cron 존재 인지 못함 → rate_limits row 운영 누적 가설로 잘못된 D1 storage 분석 → 재구현 위험.

**권고**: ARCHITECTURE.md 에 Cron Trigger 흐름 1 다이어그램 추가 (Workers Cron → purgeOldRateLimits → D1 DELETE), 또는 §"배치 파이프라인" 다이어그램 내 Cron 노드 추가. CHA-06 commit 별도 docs commit 으로 흡수 의무.

#### MAJOR-A2-3 — apps/batch REC-01/02 테스트가 BatchCheckpoint atomic write 시그니처 가정 (production 변경 시 회귀 위험 검출 부재)

**파일**: `apps/batch/__tests__/rec-02-checkpoint-tampering.test.ts:115` (writeFile direct overwrite), `rec-01-kill-points-parametrized.test.ts` 유사
**증거**:

- REC-02 시나리오 1/2/5 가 `writeCheckpoint` 결과 파일을 `writeFile(filePath, tampered, 'utf8')` 로 직접 overwrite — production atomic write (temp+rename) 가정과 충돌
- 만약 `writeCheckpoint` 가 향후 multi-file (예: state_hash 별도 파일) 으로 진화 시, REC-02 테스트가 single-file mutation 만 검증 → multi-file 일관성 검증 누락
- ADR-029 §4.3 회귀 추적 표 line 167 "compiled.evaluate() async 변환" 등 typecheck 회귀는 명시되어 있으나, `writeCheckpoint` 시그니처 변경에 대한 회귀 게이트 명시 없음

**시나리오**: Phase 1 후반에 BatchCheckpoint 가 raw + integrity 분리 파일 구조로 진화하면, REC-02 테스트가 single-file 변조만 검증 → integrity 파일은 그대로 → throw 되지 않으나 테스트 PASS 잘못된 안전 신호.

**권고**: REC-02 commit 메시지의 진산님 결정 옵션 B/C 선택 시점에 contract test (`writeCheckpoint` shape invariant) 추가. 본 시점은 옵션 결정 대기 중이므로 handoff-033 §3 Master Plan §REC-02 v1.0.1 patch 선택 결과에 따라 처리.

### N/A (해당 없음)

- **Ontology Lock** — 본 8 commits 가 신규 노드/엣지 ID 생성 0건 (테스트 fixture `CONCEPT-042` 는 sampleSnapshot 의 last_inserted_node_id 기존 ID 재사용)
- **Hexagonal 위반 — domain → infrastructure 직접 참조** — modules/ 영역 변경 0건. 본 8 commits 모두 packages/ + apps/ 한정

### 반론 (Devil's Advocate)

**깨질 수 있는 시나리오 1**: `MAX_AST_NODE_COUNT` 500 → 200 보수화 후, 정상 산식이 향후 BATCH-2~5 자료 도입 시점에 200 nodes 초과 — 정상 산식이 사후 차단. 측정 근거는 "현 BATCH-1 6 산식 ≤ 50 nodes" 만 — 미래 BATCH 산식이 200 초과하면 production 회귀. 현재 한도 보수화 검증은 **6/68 산식 sample** 만으로 결정. ADR-029 Decision Log 의 "정상 산식 ≤ 50" 근거 데이터셋이 BATCH-1 한정.

**권고**: BATCH-2~5 자료 도입 시점에 nodeCount/depth 재측정 + 한도 재검토 의무를 ADR-029 §4.3 회귀 vector 표에 추가 (handoff §3 보고).

**깨질 수 있는 시나리오 2**: PRF-01 (b) 의 "BATCH1 6 산식 < 12ms" 임계가 CI environment (느린 GitHub Actions runner) 에서 flaky 할 수 있음. `prf-01-formula-engine-perf.test.ts:78` `result.medianMs < 12` 는 local Node 22 native 측정 — CI containerized cold start 에서 p99 50ms 초과 가능. PRF wrapper 의 warmup=3 은 GC stall + cold compile cache 회피 부족.

**권고**: CI flaky 발생 시 임계를 환경 분기 (CI 임계 = local × 3) 또는 measure 결과 telemetry 만 기록하고 hard threshold 제거.

**깨질 수 있는 시나리오 3**: ESLint pattern `**/__tests__/**` 가 monorepo turbo cache + node_modules 내 `__tests__` 폴더에도 반응할 수 있음. `ignorePatterns: ["node_modules", "dist", ".turbo"]` (line 53) 으로 차단되지만, future drift (예: 외부 의존이 `__tests__` 명명 시) 회귀 가능. 본 시점 위배 0건이지만 명시적 sentinel 부재.

---

## 판정

**수정 필요** — MAJOR 3건 (CRITICAL 0건). MAJOR-A2-2 (ARCHITECTURE.md 다이어그램 갱신) 은 별도 docs commit 의무로 명시 흡수 가능. MAJOR-A2-1 (ESLint pattern 정밀화) 은 .eslintrc.json 1-line 수정으로 즉시 흡수 가능. MAJOR-A2-3 (REC contract test) 는 진산님 옵션 결정 대기로 이월 명시.

**4-Pass 통합 판정 의무**: 본 Pass 2 결과를 Pass 1/3/4 와 dedupe 후 통합 보고. 본 시점 dedupe 후보:

- MAJOR-A2-1 ESLint pattern 표면 차단 — Pass 4 (Contract) 의 `__tests__` 매칭 정합 가능성
- MAJOR-A2-2 ARCHITECTURE.md Cron 부재 — Pass 4 (Contract) 의 다이어그램 정합 의무 가능성
- MAJOR-A2-3 REC contract test — Pass 1 (Surgeon) 의 file 시그니처 회귀 가능성

dedupe 통합 시 본 Pass 2 가 발견한 "monorepo 단방향 의존성 / Cron 다이어그램 부재" 는 Architect 고유 관점 — Pass 1/3/4 와 중복 가능성 낮음.

---

**Pass 2 작성**: system-architect (Claude Opus 4.7 1M context) — 독립 에이전트
**리뷰 정합**: auto-review-protocol.md "Pass 2 ARCHITECT" 본문
**증거 기반 보고**: ✅ 15건 확인 모두 파일:라인 + 확인 내용 명시
**반론 의무**: ✅ 3개 깨질 시나리오 제시
