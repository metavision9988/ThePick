# S5-6a eval harness — 4-Pass 통합 독립 리뷰

- **세션:** 088 (2026-05-15)
- **대상:** S5-6a — multi-hop 정답률 eval harness + golden 평가셋 자율 구축
  (진산 결재 "평가셋 자율 구축 + 인증 대기", [[project_s5_6_eval_measurement_gate]])
- **리뷰 방식:** 독립 에이전트 **3개** (자가 0). Pass1 silent-failure-hunter /
  Pass2 system-architect / Pass3+4 code-reviewer. 코드 미작성 컨텍스트 +
  증거(파일:라인) + Devil's Advocate.
- **realcode 게이트:** parseRelatedNodes ↔ enrichRelatedNodes 시맨틱 동치를
  study/routes.ts 실코드로 대조 (Pass1·Pass2·Pass4 3중).

---

## 1. 대상 (신규)

- `apps/api/src/eval/multihop-accuracy.ts` — 순수 코어 (Workers-safe, import
  0건): parseRelatedNodes / scoreQuestion / aggregate / formatReportMarkdown
  / assertRemoteMeasurementInputs
- `apps/api/src/eval/__tests__/multihop-accuracy.test.ts` (16) +
  `measure-runner.test.ts` (6, local-smoke E2E + G-6a-5)
- `scripts/measure-s5-6-multihop-accuracy.ts` — REMOTE runner (Node IO)
- `scripts/fixtures/s5-6-eval-smoke.json`, `docs/plans/graph-walk-s5-6a-…plan.md`

## 2. 판정 요약

| Pass            | CRITICAL | MAJOR | 처리                            |
| :-------------- | :------: | :---: | :------------------------------ |
| Pass1 Surgeon   |    0     |   3   | M-1/M-2/M-3 **즉시 해소**       |
| Pass2 Architect |    0     |   1   | M-1 정밀화+cross-ref+carry-over |
| Pass3 Advocate  |    0     |   0   | Minor 1 → carry-over            |
| Pass4 Contract  |    0     |   1   | M-1(=lint 차단) **즉시 해소**   |

→ realcode 게이트 후 **behavioral CRITICAL 0**. MAJOR 전건 즉시 해소 또는
명시 carry-over (auto-review-protocol "Critical/Major 즉시 수정 / 미해소 ≠
누락"). graph-search-route·user-search·graph-walk·study **코드 무변경**
(git diff 무변경 3 에이전트 공통 입증) — 측정 도구가 측정 대상 불침범.

## 3. 즉시 수정 반영 (5건)

| #   | 출처                     | 내용                                                                                                                                                                                                                            | 파일                                   |
| :-- | :----------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------- |
| F1  | Pass3/4 M-1 (★lint 차단) | runner 가 `__tests__/helpers`(C-CODE-2 no-restricted-imports) import → 커밋 차단. **runner remote 전용화** (LOCAL_SMOKE = vitest measure-runner.test.ts 소유, 결정적 CI 게이트). test-helper import 제거 → scripts ESLint CLEAN | scripts/measure-s5-6-…ts               |
| F2  | Pass1 M-2                | 취약 argv 자동실행 가드(tsx/symlink 경로 불일치 → main no-op 무음) **제거** — runner 를 어떤 모듈도 import 안 함(F1 결과) → 무조건 main()                                                                                       | scripts/measure-s5-6-…ts               |
| F3  | Pass1 M-3                | `--limit` 0/음수/NaN silent 흡수(전량·음수 slice 모집단 무음 왜곡) → 양의 정수 아니면 throw                                                                                                                                     | scripts/measure-s5-6-…ts               |
| F4  | Pass2/Pass3·4 M-1        | parseRelatedNodes "정본 단일화" 주장 → "파싱 술어 동치 + 측정상 무절단(RELATED_NODES_MAX=20 의도적 비동치, 분모 인위축소 방지)" 정밀화 + study/routes.ts enrichRelatedNodes 양방향 cross-ref 주석 (drift 회귀 G-6a-2 감지)      | multihop-accuracy.ts / study/routes.ts |
| F5  | Hard Rule 17             | runner exam id 리터럴 → `EXAM_IDS.SON_HAE_PYEONG_GA_SA` 경유 (@thepick/shared, test-helper 무관)                                                                                                                                | scripts/measure-s5-6-…ts               |

검증: scripts **ESLint CLEAN** / api `typecheck`·`lint` 클린 / `test`
**643 passed | 2 skipped (42 files)** — S5-6a 진입 전 621 → 신규 22
(multihop-accuracy 16 + measure-runner 6) 만 증가, 회귀 0.

## 4. realcode 게이트 — parseRelatedNodes 동치 (3 에이전트 교차)

Pass1: study/routes.ts:470~482 vs multihop-accuracy.ts:35~50 분기 1:1 대조
— null/''/parse-fail/비배열/배열필터(`typeof==='string' && length>0`)
**바이트 동일**. 차이 1건 = `slice(0,RELATED_NODES_MAX=20)` (study surface
상한) — 측정은 의도적 무절단(분모 보존). Pass2/Pass4 동일 결론 + drift 표면
지적 → F4 로 계약 정밀화·cross-ref·carry-over (CO-6a-1).

## 5. carry-over 원장 (plan §5b — 미해소 ≠ 누락)

- **CO-6a-1:** parseRelatedNodes↔enrichRelatedNodes 진짜 단일화는 study L3
  사용자 라우트 변경 = S5-6a 범위 외 → 차기 step. 현 동치+cross-ref+G-6a-2
  골든으로 방어. RELATED_NODES_MAX 비동치는 측정무결성상 영속 결정.
- **CO-6a-2 (Pass1 M-1):** scripts/\*.ts 전용 typecheck CI 단계 = build
  config 변경(verify-engine-contracts.ts 등 기존 scripts 일괄) → 별도 결재.
  현 완화: runner remote 전용 최소화, 방법론은 vitest-게이트 순수 코어.
- **CO-6a-3 (Pass2 반론):** S5-7 A 통합 시 `GraphSearchResponse extends
GraphSearchResponseShape` 컴파일 가드 (consumer-driven contract) — S5-7
  결재 자료 in-scope.
- **CO-6a-4 (Pass3 m-2):** REMOTE 워터마크 baseURL 신뢰성 = 진산 인증 세션
  운영 규율 위임 (stub 서버 가짜 REMOTE 방지).

## 6. 종합 판정

**S5-6a 완료 가능.** 독립 3 에이전트 4-Pass realcode 게이트 후 behavioral
CRITICAL 0, MAJOR 즉시 해소 5건(특히 lint 차단 F1) + 명시 carry-over 4건,
회귀 0(643 PASS). G-6a-1(결정성 2회 deep-equal)·G-6a-2(파서 골든)·G-6a-3
(손계산 fixture 직접 재도출, Pass4 수동 재계산 일치)·G-6a-4(측정불가 분모
제외+사유 카운트)·G-6a-5(자격증명 env-only, 미충족 throw) **전 PASS**.
범위 침범 0 (S5-7/A통합/검색코드/실 remote측정 미착수, git diff 무변경
입증). **G-S5 본체(실 정답률)는 미산출 = 진산 Cloudflare 인증 게이트**
(harness READY, fabricate 차단 정직 — RULE #4/#5). plan §7 / handoff 인계.
