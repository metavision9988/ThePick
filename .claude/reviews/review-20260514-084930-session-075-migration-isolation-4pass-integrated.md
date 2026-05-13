# Session 075 — migrations `.mutation-test-bak` 잔재 항상성 강화 4-Pass 통합 리뷰

**대상:** `verify-cat9-mutation.test.ts` 격리 패턴 전환 (live rename → tmpdir copy + env override)
**일시:** 2026-05-14 08:49 KST (Session 075)
**리뷰 방식:** 2 독립 에이전트 병렬 — silent-failure-hunter (Pass 1) + quality-engineer (Pass 2+4)
**리뷰 범위:** 변경 2 파일 (`scripts/verify-engine-contracts.ts`, `packages/quality/src/__tests__/verify-cat9-mutation.test.ts`) + 연관 6 파일

---

## 통합 판정

| Pass          | Critical             | Major | Minor | N/A   | 흡수                           |
| :------------ | :------------------- | :---- | :---- | :---- | :----------------------------- |
| 1 (Surgeon)   | 0                    | 1     | 1     | 5     | 2/2 즉시 흡수                  |
| 2 (Architect) | 0                    | 3     | 2     | 1     | 1/3 (주석) + 2 carry-over      |
| 3 (Advocate)  | (Pass 1+3 통합 위임) |       |       |       |                                |
| 4 (Contract)  | 0                    | 1     | 1     | 2     | carry-over                     |
| **합계**      | **0**                | **5** | **4** | **8** | **3 즉시 흡수 + 5 carry-over** |

**판정: 완료 가능** — Critical 0건. 본 step 핵심 목적 (self-verification 회귀 차단의 자체 회귀 차단) 달성.

---

## 즉시 흡수 3건 (본 step)

### MAJOR-1 (Pass 1) — mutation test assertion이 Cat 9 boolean 직접 검증 (self-verification 회귀 차단 강화)

`countMigrations()` numeric 부수효과로 Cat 9 status='FAIL' 자동 달성 → boolean 검증 제거 시 회귀 silently 통과. 본 step 핵심 가치 절반 무력화 위험. 흡수:

- 위치: `packages/quality/src/__tests__/verify-cat9-mutation.test.ts:225-243`
- 추가 assertion: `cat9.booleans`에서 mutation.fileName stem 매칭 항목 찾아 명시 FAIL 검증

### MINOR-1 (Pass 1) — beforeAll legacy cleanup 로깅

`.mutation-test-bak` silent unlink → 구버전 crash 흔적 디버깅 단서 소실. 흡수:

- 위치: `verify-cat9-mutation.test.ts:166-176`
- `stale.length > 0` 시 `console.warn` 명시 정리 알림

### MAJOR-A2 부분 (Pass 2) + MINOR-A1 (Pass 2) — 인라인 주석 보강

- `scripts/verify-engine-contracts.ts:88-96`: `MIGRATIONS_DIR` env 이름이 apps/api/apps/batch 로컬 const와 collision — 의미 충돌 0이나 가독성 부채. 주석으로 영속 (rename은 carry-over).
- `scripts/verify-engine-contracts.ts:774-779`: `pair.migrationFile`은 flat 단일 segment 가정 명시. nested 경로 도입 시 tmpdir copy 로직 재설계 필요 경고.

---

## Carry-over 5건 (handoff/ADR 영속)

| 우선도 | ID              | 설명                                                                                                                                                                            | 권장 시점                     |
| :----- | :-------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :---------------------------- |
| Major  | Pass 2 MAJOR-A1 | `runVerify` SIGKILL이 spawn된 자식 vitest까지 cascade 안 됨 (PID-group 미사용). CI flake 발생 시 우선 조사 — `detached: true` + `process.kill(-proc.pid)` 또는 `tree-kill` 도입 | CI flake 발생 시              |
| Major  | Pass 2 MAJOR-A3 | `apps/api/src/__tests__/helpers/d1-from-sqlite.ts:32,106,123`는 여전히 실 migrations 직접 readFileSync. 다른 mutation test 도입 시 동일 race 재발 위험                          | 별도 chunk                    |
| Major  | Pass 4 MAJOR-C1 | ADR 미등록 (architectural choice 영속화). 본 격리 패턴이 표준이 될 가능성 → ADR-044 (또는 가용 번호) "test-isolation env-override + tmpdir copy" 등록 권고                      | 차후 step                     |
| Minor  | Pass 2 MINOR-A2 | `countMigrations` required=25 vs 실측 36 freshness (기존 부채, 본 step 무관)                                                                                                    | master-test-checklist 갱신 시 |
| Minor  | Pass 4 MINOR-C1 | `.jjokjipge/wbs-quality-progress.md` 갱신 의무 — memory `reference_quality_wbs_dashboard.md` 정합                                                                               | 흡수 chain 종료 시            |

---

## 검증 완료 증거 (Pass 별 3건+)

### Pass 1 (Surgeon) — PASS 9건

1. `MIGRATIONS_BASE` 빈 문자열 가드 정합 (line 91-94)
2. 7개 migration path 모두 MIGRATIONS_BASE 경유 grep 0 잔존
3. basename(pair.migrationFile) path traversal 0 — hardcoded literal
4. mkdtempSync atomic — partial 디렉토리 잔재 0
5. afterEach + afterAll + try/finally 3중 cleanup
6. rmSync recursive force — tmp 인자 항상 mkdtempSync 결과 (user input 0)
7. timer + close + error 3 reject 경로 정합
8. IS_SUBPROCESS describe.skipIf 재귀 spawn 차단
9. apps/api d1-from-sqlite.ts는 env 미참조 → MIGRATIONS_DIR propagate silent 미감염

### Pass 2 (Architect) — PASS 12건

1. MIGRATIONS_BASE 전수 적용 확인 (9곳 grep)
2. 재귀 spawn 차단 정합 (IN_VERIFY_SUBPROCESS=1)
3. CI passpath 정합 (.github/workflows/ci.yml:74)
4. 연관 모듈 격리 (d1-from-sqlite.ts 로컬 const 무관)
5. tmpdir 결정성 (Linux WSL2/macOS/CI 동일)
6. cleanup 3중 방어선 — /tmp 잔재 0
7. beforeAll legacy 정리 — 실 migrations 0 .bak
8. 격리 검증 assertion (REAL_MIGRATIONS_DIR 무손상 PASS 조건)
9. timeout SIGKILL 정합 (단, PID-group MAJOR-A1 carry-over)
10. basename flat 가정 안전 (현 5건 모두 단일 segment)
11. 빈 문자열 env 방어
12. turbo cache 영향 0

### Pass 4 (Contract) — PASS 8건

1. production-quality.md 8 체크리스트 정합 (any 0/TODO 0/빈 catch 0)
2. auto-review-protocol.md 4-Pass 의무 정합 (Pass 1+3+2+4 위임)
3. CLAUDE.md Hard Limit 정합 (knowledge_nodes/formulas UPDATE 0)
4. dev-guide.md "테스트 통과 = 안전 차단" — 격리 assertion 추가
5. engine-first doctrine 정합 (test infra, 코어 무관)
6. Cloudflare 단일 벤더 정합 (외부 SaaS 0)
7. handoff carry-over 핵심 흡수 (Session 074 §주의사항 1번)
8. Session 060 무한 spawn 사건 재발 차단

---

## Devil's Advocate (각 Pass 1건+)

- **Pass 1**: 미래 d1-from-sqlite.ts에 env override 도입 시 자식 vitest의 routes.test.ts가 tmpdir 사본 읽음 → 0024 삭제된 SQL로 D1 초기화 → FAIL. 본 패턴은 "d1-from-sqlite.ts가 env 미사용" 현재 사실에 의존, 명시적 격리 계약 없음 → MAJOR-A1+A3 carry-over.
- **Pass 2**: 미래 nested migration 경로 도입 시 readdirSync non-recursive로 tmpdir copy silent miss → 잘못된 FAIL 보고 → MINOR-A1 주석 흡수.
- **Pass 4**: ADR 미등록 → 차후 다른 mutation test 작성 시 본 패턴 모르고 실 파일 rename 패턴 재도입 → 동일 race 재발 → MAJOR-C1 carry-over.

---

## 검증 결과 (최종)

```
$ pnpm -F @thepick/quality test verify-cat9-mutation
✓ src/__tests__/verify-cat9-mutation.test.ts (3 tests) 139s
  ✓ 0024 → Cat 9 FAIL + boolean FAIL  47s
  ✓ 0025 → Cat 9 FAIL + boolean FAIL  46s
  ✓ 0026 → Cat 9 FAIL + boolean FAIL  46s

$ pnpm exec turbo run test --filter=@thepick/quality
Test Files  5 passed (5)
     Tests  60 passed (60)

$ ls migrations/*.bak  →  (empty)
$ find /tmp -name "thepick-mut-*"  →  (empty)
```

판정: **완료 가능 — Critical 0건, Major 1건 즉시 흡수 + 3건 carry-over 명시**.
