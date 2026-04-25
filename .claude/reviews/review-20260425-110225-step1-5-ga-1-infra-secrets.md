# 독립 에이전트 4-Pass 리뷰 — 가-1 Group A 진입 직전 인프라 변경

**리뷰 방식: 독립 에이전트 2개 병렬 호출**

- Agent 1: `security-engineer` (Pass 3 Advocate — 보안·공격면)
- Agent 2: `pr-review-toolkit:code-reviewer` (Pass 1+2+4 — Surgeon/Architect/Contract)

작성일: 2026-04-25 KST
변경 커밋: 미커밋 (로컬 스테이징 예정)
관련 plan: `docs/plans/current.plan.md` (Phase 1 Step 1-5 가-1)
관련 gates: `tasks/step-1-5-ga-1.gates.yaml`

---

## 리뷰 범위

### 변경 파일 (7건)

1. `scripts/check-no-secrets.sh` (신규, 54행)
2. `.husky/pre-commit` (수정, 1행 추가)
3. `.gitignore` (수정, 5행 추가)
4. `apps/batch/src/__manual__/cost-cap.ts` (신규, 80행)
5. `apps/batch/src/__manual__/README.md` (신규)
6. `docs/measurements/README.md` (신규)
7. `docs/plans/current.plan.md` (수정, 마이그레이션 0011→0013 부분)

### 연관 파일 (변경 없으나 영향 / 검증 대상)

- `apps/batch/src/adapters/anthropic-client.ts`, `vision-client.ts`, `token-cost-logger.ts`
- `tasks/step-1-5-ga-1.gates.yaml`
- `migrations/0011_revision_2026_constants_seed.sql`, `0012_rate_limits.sql`
- `apps/batch/tsconfig.json`

---

## 종합 판정

```
🔴 CRITICAL 3건 / 🟠 MAJOR 7건 / 🟡 MINOR 7건
진입 판정: Group A 실호출 진입 차단 (수정 필수 3건)
```

Agent 1(security)이 Critical 3건 / 차단 판정, Agent 2(code)가 Critical 0건 / 조건부 진입. **보안 차원 판정을 수용** — Agent 1이 실증(실제 /tmp 에서 bypass 테스트)까지 완료한 쪽이고, Agent 2는 "운영 코드 import 없음"을 PASS로 해석했으나 이게 바로 security 가 지적한 "고아 코드" 문제의 이면.

---

## 🔴 CRITICAL 3건 (진입 차단 사유)

### C-1 [S-1 / M-3] 공백 파일명 단어분할 bypass — 실증 완료

- **파일/라인**: `scripts/check-no-secrets.sh:17-28`
- **코드**:
  ```bash
  STAGED=$(git diff --cached --name-only --diff-filter=ACM)
  for FILE in $STAGED; do
    if [ ! -f "$FILE" ]; then continue; fi
  ```
- **실증** (Agent 1 `/tmp` 테스트): 공백 포함 파일명(예: `config with secret.env`)에 `sk-ant-` 입력 후 스테이징 → `./check.sh` 실행 → **exit 0 (통과)**. IFS 단어분할로 파일명이 3조각 ([config], [with], [secret.env])으로 쪼개져 각각 `[ -f ]` 미존재 → skip.
- **양쪽 에이전트 모두 지적** — 독립 교차 검증 완료.
- **시나리오**: Guide/ 디렉토리 이미 공백 포함 파일 존재 (예: `"Guide/3단계리뷰.md"` 는 공백 없으나 향후 공백 파일 추가 위험). WSL/macOS 에서 공백 폴더명 흔함.
- **수정 방향**:
  ```bash
  set -euo pipefail
  git diff --cached --name-only -z --diff-filter=ACMR | \
  while IFS= read -r -d '' FILE; do
    [ -f "$FILE" ] || continue
    # ... inner
  done
  ```

  - NUL-split (`-z` + `read -r -d ''`)
  - `set -o pipefail` 추가
  - `--diff-filter=ACMR` (rename 포함)
  - `-- "$FILE"` 경로 구분자

### C-2 [S-2] 실 사용 key 패턴 다수 누락 — 실증 완료

- **파일/라인**: `scripts/check-no-secrets.sh:8-15` (PATTERNS 배열 6종)
- **누락된 실 사용 벡터**:
  - `ANTHROPIC_API_KEY=` 명명 패턴 (가-1 주요 키)
  - `CLOUDFLARE_API_TOKEN=` / Cloudflare 토큰 (단일 벤더 원칙 상 실 사용)
  - PEM private key 블록 (`-----BEGIN ... PRIVATE KEY-----`)
  - JWT 3-segment (`eyJ...\.eyJ...\....`)
  - DB URL with embedded credentials (postgres / postgresql / mysql / mongodb / redis schemes with `user:password@host` syntax)
  - GitHub fine-grained PAT (`github_pat_`)
  - Slack user/app token (`xoxp-`, `xapp-`)
- **실증** (Agent 1 `/tmp`): 5종 누락 패턴 스테이징 → exit 0 (전부 통과).
- **시나리오**: `.dev.vars` 복붙 실수로 `ANTHROPIC_API_KEY=sk-ant-xxx` 가 `.ts` 파일에 박히면 6종 중 `sk-ant-` 는 잡히나 named 패턴만 있는 경우 미감지.
- **수정 방향**: PATTERNS 에 최소 5종 추가 (named key, Cloudflare, PEM, JWT, DB URL). 장기적으로는 `gitleaks` 같은 검증 스캐너 검토 (별도 plan).

### C-3 [S-3] cost-cap.ts 가 adapter 와 연결 안 된 고아 코드

- **파일**: `apps/batch/src/__manual__/cost-cap.ts` 전체
- **증거** (Agent 1 `grep -rn "from.*cost-cap"`): 결과 **0건**. anthropic-client / vision-client / token-cost-logger 어디에서도 import 없음.
- **README 선언**: `__manual__/README.md:19-21` "모든 외부 호출은 cost-cap.ts 의 recordSpend(usd) 통과 후에만 진행" — **강제 고리 부재**. 문서 선언일 뿐.
- **CLAUDE.md §하네스 원칙 위반**: "부탁(텍스트)이 아닌 강제(훅/린터)"
- **시나리오**: 가-1 진입 시 smoke 스크립트 작성자가 `sdk.messages.create` 를 직접 호출하면 cap 존재 무관. 무한 재시도 / max_tokens 오타로 $5+ 폭주 시 차단 불가.
- **부가 문제 [S-4]**: 현 구조는 **사후 집계**. 단일 호출 $5 초과 발생 후 다음 호출 차단 — 이미 발생한 비용은 회수 불가.
- **수정 방향**:
  - `cost-cap.ts` 에 high-level wrapper API 추가:
    ```typescript
    export async function guardedCall<T>(
      estimatedMaxUsd: number,
      fn: () => Promise<{ result: T; actualUsd: number }>,
    ): Promise<T>;
    ```
    사전 guard (`accumulatedUsd + estimatedMaxUsd > MAX_USD` → throw) + 사후 recordSpend 를 단일 wrapper 에 묶음.
  - smoke 스크립트는 adapter 를 **직접 호출 금지**, `guardedCall` 경유 의무.
  - README 에 "SDK 직접 호출 금지, guardedCall 경유 의무" 명시.

---

## 🟠 MAJOR 7건

| ID  | 내용                                                                                 | Agent   | 해소 시점                  |
| :-- | :----------------------------------------------------------------------------------- | :------ | :------------------------- |
| M-1 | **plan 내 0011 잔존 3곳** — `current.plan.md:94`, `:133`, `gates.yaml:107`           | Agent 2 | 진입 전                    |
| M-2 | cost-cap `resetForNewSession` public export, guard 없음                              | 양쪽    | 진입 전                    |
| M-3 | cost-cap 모듈 수준 mutable state — 프로세스 재시작 시 상태 소멸 / 연속 smoke 시 오염 | 양쪽    | 진입 전                    |
| M-4 | `--diff-filter=ACMR` 미적용 → rename 시 skip (`git mv` bypass)                       | Agent 1 | C-1 함께                   |
| M-5 | `set -o pipefail` 미설정                                                             | 양쪽    | C-1 함께                   |
| M-6 | `--no-verify` 완전 우회 가능 — 서버사이드 방어선 없음                                | Agent 1 | **이월 명시** (Phase 1 말) |
| M-7 | measurement 요약 MD 의 PII 검증 자동화 부재 (가이드라인만)                           | Agent 1 | **이월 명시** (Phase 2 초) |

---

## 🟡 MINOR 7건

| ID  | 내용                                                      | 해소 시점    |
| :-- | :-------------------------------------------------------- | :----------- |
| m-1 | `getCurrentSpend()` 가 maxCalls 미반환 (디버깅성)         | 다음 터치 시 |
| m-2 | `MAX_CALLS_DEFAULT` 상수 위치 (state 선언 아래, 가독성)   | 다음 터치 시 |
| m-3 | check-no-secrets.sh 의 이모지(❌/🚫) — 터미널 인코딩 주의 | 다음 터치 시 |
| m-4 | measurement "90일 자동 만료" — 실제 수동 (stub 성격)      | 문구 정정    |
| m-5 | `.husky/pre-commit` 실행권한 0644 (v9 호환은 OK, 가독성)  | 다음 터치 시 |
| m-6 | cost-cap Vitest 테스트 0건                                | Group D 전   |
| m-7 | cost-cap persistent state 부재 (프로세스 재시작 시 0)     | M-3 함께     |

---

## 확인된 PASS 항목 (증거 3개+)

**Pass 1 (Surgeon)**:

- `cost-cap.ts:44` NaN/Infinity/음수 입력 검증 ✓
- `cost-cap.ts:17-37` 커스텀 에러 클래스 2종 context 필드 보존 ✓
- `cost-cap.ts` 전체 any 0 / console.\* 0 / TODO 0 / 빈 catch 0 ✓
- `check-no-secrets.sh:17-21` STAGED empty 안전 exit 0 ✓

**Pass 2 (Architect)**:

- `grep -rn "from.*cost-cap" apps/ packages/` 결과 0건 — 운영 코드 미침투 ✓ (다만 C-3 이 이면)
- husky v9 monorepo 루트 실행, `bash scripts/...` 정상 경로 ✓
- `migrations/0011` `0012` 존재 → `0013` 이 TD-045 정합 번호임을 디렉토리가 증명 ✓

**Pass 4 (Contract)**:

- `tasks/step-1-5-ga-1.gates.yaml` Gate Group A 와 cost-cap 목적 정합 ✓
- production-quality.md 금지 패턴 (any/console/TODO/빈 catch) 전수 통과 ✓
- `.gitignore` 신규 5행 README 선언과 일치 ✓

---

## Devil's Advocate — 이 변경의 가장 큰 빈틈

**[Agent 1]** 통합 부재. Critical 3건이 모두 해소되어도, cost-cap 이 adapter 내부에 강제 통합되지 않는 한 "방어 의도 선언"일 뿐이다. smoke 스크립트 작성 **전** 에 adapter 강제 wrapper 를 먼저 만들어야 한다.

**[Agent 2]** `--no-verify` 와 past-history 미스캔. pre-commit 은 local 교보험 수준. server-side `gitleaks` / GitHub push protection + `git log -p | grep -E 'sk-ant-|...'` 이력 스캔이 병행되어야 실질 방어.

**[Claude 종합]** 두 빈틈 모두 동일한 메타 원인 — "문서 선언이 강제 고리를 대체할 수 없다". 본 세션에서 C-3 를 해소해도 M-6 (`--no-verify` 우회)은 설계상 pre-commit hook 의 한계로 Phase 1 말 또는 별도 plan 으로 이월 필요.

---

## 진입 재개 조건 (Critical 3건 해소)

### 즉시 수정 (진산님 승인 하에 Claude 진행)

1. **C-1 / C-2 / M-4 / M-5 통합**: `scripts/check-no-secrets.sh` 재작성
   - NUL-split + pipefail + ACMR filter
   - PATTERNS 에 ANTHROPIC*API_KEY= / CLOUDFLARE_API_TOKEN / PEM / JWT / DB URL / github_pat* / xoxp- / xapp- 추가
   - 재실증 (`/tmp/` 스테이징 테스트)
2. **C-3 / M-2 / M-3 통합**: `cost-cap.ts` 재설계
   - `guardedCall<T>(estimatedMaxUsd, fn)` high-level wrapper 추가
   - `resetForNewSession` 을 별도 파일(`cost-cap-test-helpers.ts`)로 분리 또는 NODE_ENV guard
   - class-based 인스턴스화 검토
   - Vitest 테스트 5+건 추가 (누적/초과throw/음수reject/NaN/reset)
3. **M-1**: plan 0011 잔존 3곳 정정
4. **재검증**: `pnpm --filter @thepick/batch typecheck` + secret scan 재테스트

### 이월 명시 (본 Step 범위 외)

- **M-6** server-side secret scan (`gitleaks` or GHAS) — Phase 1 후반 별도 plan
- **M-7** measurement MD PII 자동 검증 — Phase 2 초

---

## 서명

- Agent 1 (security-engineer): `agentId: a7529a63dffeea721`, 24 tool uses, 245s
- Agent 2 (pr-review-toolkit:code-reviewer): `agentId: a80222c99eed0272e`, 20 tool uses, 150s
- 총 44 tool uses / 약 6.5분 / 독립 컨텍스트 2개
