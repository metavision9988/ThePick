# 옵션 A fix 차분 검증 — 가-1 Group A-2 (4차 리뷰)

**리뷰 방식: 독립 에이전트 1개 (`pr-review-toolkit:code-reviewer`)**

작성일: 2026-04-25 KST 21:16
선행 리뷰: `.claude/reviews/review-20260425-{110225,142105,204720}-*.md` (1차+2차 4-Pass + 3차 5-페르소나)
검증 범위: 옵션 A 4건 fix 차분만 (직전 발견 중복 금지)

---

## 종합 판정 (1차 보고 → M-1 정정 후 재검증 통합)

```
초기: Critical 1 (M-1 미반영) / Major 2 / Minor 1
정정: Critical 0 / Major 0 / Minor 1 (NEW-MIN-2 README 흡수)
```

agent 가 발견한 **M-1 미반영** Critical 즉시 정정 후 통합:

### 각 fix 별 PASS/FAIL 최종

| Fix                          | 초기 판정        | 정정 후                                                                                                           |
| :--------------------------- | :--------------- | :---------------------------------------------------------------------------------------------------------------- |
| **C-1 cost-cap timeout**     | ✅ PASS          | ✅ PASS — `Promise.race` + `{ once: true }` listener + finally clearTimeout, 23/23 테스트 통과                    |
| **C-2 pdfplumber-smoke cwd** | ✅ PASS          | ✅ PASS — `import.meta.url` 4 levels up, `/tmp` cwd 실측 정상                                                     |
| **M-1 tsconfig 격리**        | 🔴 FAIL (미반영) | ✅ PASS (정정 후) — `apps/batch/tsconfig.json:7` exclude 에 `src/**/__manual__/**` 추가 + `tsc --showConfig` 검증 |

### NEW 발견 → 흡수

| ID        | 발견                                           | 처리                                                                  |
| :-------- | :--------------------------------------------- | :-------------------------------------------------------------------- |
| NEW-M-1   | tsconfig.json exclude 미반영                   | ✅ 즉시 정정 (Edit 적용 + `tsc --showConfig` 검증)                    |
| NEW-MIN-1 | timeoutMs 가 옵션 — 호출자 누락 시 hang        | ✅ README 강화 (smoke 항상 명시 의무 + ESLint Phase 1 후반 이월 명시) |
| NEW-MIN-2 | timeout 시 fn background 잔존 + 회계 미달 가능 | ✅ README 강화 (signal 전달 책임 + estimatedMaxUsd 보수 산정 가이드)  |

### 확인된 PASS (실 inspect 증거)

1. `cost-cap.ts:135-137` invalid timeoutMs 사전 거부 + callCount 미증가 — 테스트 line 301-324 검증
2. `cost-cap.ts:200-226` AbortController + `{ once: true }` listener — leak 없음
3. `tsconfig.manual.json:1-8` `extends ../../tsconfig.base.json` 으로 strict 옵션 상속 (showConfig 결과 strict:true)
4. `apps/batch/src/index.ts`, `bin/batch.ts` — `__manual__/` import grep 0건 (운영 entry 누설 부재)
5. modules + packages 6개 `passWithNoTests` 적용 / 핵심 4개 (shared/parser/quality/formula-engine) 의도적 미적용

### 반론 (다음 사이클 깨짐 시나리오)

1. **typecheck `&&` 직렬 단락**: main fail 시 manual 미도달 — 의도적 fail-fast 트레이드오프, 현 상태 유지
2. **passWithNoTests 일관성 부재**: 핵심 4개 패키지에서 모든 테스트 일시 삭제 시 CI 차단 (의도된 안전망), 신생 패키지는 silent green 허용
3. **C-2 cross-platform**: 4 levels up 하드코딩 — 향후 `__manual__/sub/` 같이 더 깊은 위치 이동 시 PROJECT_ROOT 깨짐. monorepo root 마커(`pnpm-workspace.yaml`) 탐색 함수 일반화는 Phase 1 후반 이월

---

## 통합 검증 (정정 후)

```
pnpm --filter @thepick/batch typecheck : 두 tsconfig 모두 통과 (main + manual)
                                         tsc --showConfig 결과 __manual__ 정확히 exclude
pnpm --filter @thepick/batch test      : 6 files / 73 tests PASS (cost-cap 23 신규 포함)
pnpm --filter @thepick/batch lint      : 위반 0건
/tmp cwd smoke 실측                    : pdfplumber-smoke 정상 (918ms)
```

---

## 서명

- Agent (pr-review-toolkit:code-reviewer): `agentId: a98213a1eb977a3ac`, 26 tool uses, 162s
- 초기 보고 → M-1 미반영 발견 → 즉시 정정 → 재검증 (5분 내)
- 직전 1차/2차/3차 리뷰 발견 중복 0건 검증
