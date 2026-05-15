# S5-6a — multi-hop 정답률 eval harness + golden 평가셋 (자율 구축)

> **DEFCON L2** (측정 도구 — 코어 엔진/사용자 데이터 무변경). 진산 결재
> 2026-05-15 "평가셋 자율 구축 + 인증 대기" 경로 ([[project_s5_6_eval_measurement_gate]]).
> **document-first** (memory feedback_document_first_workflow): 본 plan 이
> 방법론을 고정한 뒤 구현. 측정 도구가 틀리면 G-S5 결론 전체가 무효이므로
> harness 자체를 Binary Gate 로 검증한다("잘 됨" 금지).

---

## 0. Reality Anchor — 이것이 불가능/틀릴 이유 3가지 (먼저)

1. **평가셋 편향**: `related_nodes` 가 "교재 인용 노드"일 뿐 "검색이 회수해야
   할 정답 노드"와 다를 수 있다 → recall 측정이 검색 품질이 아닌 적재
   링크 품질을 잴 위험. 완화: expected = `related_nodes ∩ approved
knowledge_nodes` 로 한정 + 측정불가(미적재/미승인) 문항을 **명시 집계·제외**
   (silent drop 금지). 해석 시 "related_nodes 기준 recall" 로 한정 보고.
2. **로컬 측정 = 가짜 정답률**: Workers AI(bge-m3 임베딩)/Vectorize 는 로컬
   재현 불가. 로컬 smoke 의 정답률 수치는 합성 stub 산물이라 **G-S5 가 아니다**.
   완화: 로컬은 harness *로직*만 검증(G-6a-\*), 실 G-S5 는 remote 전용 —
   진산 Cloudflare 인증 게이트. 수치 fabricate 금지(RULE #4/#5).
3. **`/api/search/graph` 가 baseline·graph 동시 반환** → 별도 baseline 콜
   불요. 그러나 둘이 _같은_ 임베딩/시드에서 파생되므로 "graph 가 baseline 을
   이긴다"가 자명하게 보일 수 있다(상위 K 병합이라 graph ⊇ baseline 경향).
   완화: 핵심 지표를 **graph-only recovery**(baseline 미회수·graph 회수
   문항수)로 둔다 — 이것이 multi-hop 의 _순_ 기여. 동률·악화도 보고.

## 1. scope

### In

1. `scripts/measure-s5-6-multihop-accuracy.ts` (`pnpm tsx` 관행 —
   verify-engine-contracts.ts 동일 패턴). `--local` / `--remote <baseURL>`.
2. golden 평가셋 추출기: `exam_questions` → `{id, content, expected[]}`
   (related_nodes JSON 파서 = `enrichRelatedNodes` 시맨틱 정본 복제).
3. 지표 계산 (결정적, 입력→출력) + 영속 리포트 (JSON + markdown).
4. 로컬 합성 픽스처 (`scripts/fixtures/s5-6-eval-smoke.json`) + harness
   로직 vitest (`apps/api/src/.../__tests__/` 또는 scripts 인접).
5. Binary Gate G-6a-1~5 정의+PASS. 4-Pass 독립 리뷰.

### Out (anti-overreach — 자율 금지)

- 실 remote 측정 실행 (진산 Cloudflare 인증 게이트 — G-S5 산출은 인증 후).
- S5-7 A 정상경로(Stage 2.5) 통합 — 차기 별도 결재.
- `/api/search`·`/api/search/graph`·graph-walk·user-search 코드 변경
  (측정 도구는 read-only 소비자). FSRS / 혼동감지 / UX.
- Pass2 m-2 (D-2 description 재측정) = remote 측정 세션 in-scope, 본 plan 은
  harness 가 `graphExpansion` (truncated/elapsed) 를 수집·리포트만.

## 2. 방법론 (G-S5 정의 고정)

문항당 **1콜** `POST /api/search/graph {examId, query=content, topK}`.
응답 `{ baseline:{results[]}, graphExpansion:{truncated,…}, results[] }`.

expected = parse(related_nodes) ∩ {is_current_active=1 ∧ 최신 status=approved}
(approved-nodes-sql 진실원과 동일 기준 — 측정 대상이 검색 가능 집합이어야).
expected = ∅ → **측정불가**: `excluded.unmeasurable++` (사유 로깅), 분모 제외.

문항당 (K = 응답 topK):

- `baselineHit` = (expected ∩ baseline.results.id) ≠ ∅
- `graphHit` = (expected ∩ results.id) ≠ ∅
- `graphOnlyRecovery` = graphHit ∧ ¬baselineHit ★ multi-hop 순 기여
- `regression` = baselineHit ∧ ¬graphHit ★ 악화(병합/정렬로 expected 탈락)
- `recallB` = |exp∩baseline|/|exp|, `recallG` = |exp∩results|/|exp|
- `truncated` = graphExpansion.truncated (m-1: 절단표본 **별도 버킷**)

집계 (전체 / 절단표본 제외 / 절단표본 만 — 3 분할):

- hit-rate: ΣbaselineHit/N vs ΣgraphHit/N, Δ
- mean recall: B vs G, Δ
- **graphOnlyRecovery 수 + 문항 id 목록** (G-S5 "개선 입증" 1차 증거)
- regression 수 + 문항 id (반증 의무 — 악화 은폐 금지)
- excluded: unmeasurable / no-seed(graphExpansion.applied=false) 분리 집계

판정 보고서: "Vector-only 대비 multi-hop 정답률" = graphHit-rate −
baselineHit-rate (절단표본 제외 기준) + graphOnlyRecovery 절대수. 개선·동률·
악화 모두 수치로 (AI 자기채점 금지 — 진산이 수치 직접 확인).

## 3. 실행 모드

- **LOCAL_SMOKE = vitest 소유** (CLI 아님 — 4-Pass Pass3/4 M-1 흡수): CLI
  runner 가 test helper(`__tests__/helpers`, C-CODE-2 no-restricted-imports)
  를 import 하면 lint 게이트 차단 → runner 는 **remote 전용**. 합성 픽스처
  end-to-end(createD1FromAllMigrations + stub Vectorize + in-process Hono)는
  `apps/api/src/eval/__tests__/measure-runner.test.ts` 가 결정적·CI 게이트로
  검증(G-6a-1/3). **정답률 수치는 G-S5 아님**(픽스처 산물) — `formatReport
Markdown` LOCAL_SMOKE 워터마크. runner CLI 에 `--local` 전달 시 명시 throw
  (vitest 로 안내).
- `--remote <baseURL> [--limit N]`: golden = remote D1 추출(읽기 전용 SELECT).
  실 배포 Worker `/api/search/graph` 에 `fetch`. 자격증명은 **env 만**
  (`THEPICK_API_BASE`, 필요 시 토큰) — repo/인자 평문 금지(check-no-secrets.sh
  정합). 미설정 시 즉시 종료(측정 fabricate 차단). → G-S5 산출 (인증 후).

## 4. Binary Gates (harness 신뢰성 — "잘 됨" 금지)

| Gate     | 입력                                                         | 기대 출력                                                | 판정             |
| :------- | :----------------------------------------------------------- | :------------------------------------------------------- | :--------------- |
| G-6a-1   | 동일 픽스처 2회 `--local`                                    | 지표 byte-identical (비결정 0)                           | 기계 비교        |
| G-6a-2   | related_nodes 변형(정상/비배열/parse-fail/빈문자)            | enrichRelatedNodes 와 동일 시맨틱(파서 골든)             | 단위 테스트      |
| G-6a-3   | 손계산 픽스처(baseline/graphOnly/regression/truncated 각 1+) | harness 집계 == 손계산값 정확 일치                       | 단위 테스트      |
| G-6a-4   | expected 노드 미승인/미적재 문항                             | excluded.unmeasurable 집계·로깅, 분모 제외(silent 0)     | 단위 테스트      |
| G-6a-5   | repo grep + remote 모드 env 미설정                           | 자격증명 0건 + env 미설정 시 비측정 종료                 | grep + 테스트    |
| **G-S5** | **remote 실 평가셋**                                         | **graphHit-rate − baselineHit-rate + graphOnly 수 보고** | **인증 후 산출** |

→ G-6a-1~5 PASS = harness 신뢰 확보(자율 완료 가능). G-S5 = 진산 Cloudflare
인증 게이트(본 plan Out — 인증 세션에서 산출 + Pass2 m-2 D-2 재측정 동반).

## 5. Build sequence

1. golden 추출 + related_nodes 파서 모듈(enrichRelatedNodes 시맨틱 단일화)
2. 지표 계산 순수함수 (입력 응답+expected → per-Q + 집계)
3. 리포트 생성기 (JSON + markdown, MODE 워터마크)
4. `--local` 모드: 합성 픽스처 + stub Vectorize + in-process Hono
5. `--remote` 모드: env 게이트 + remote SELECT + fetch (미실행, 코드만)
6. vitest: G-6a-2/3/4/5 + G-6a-1 결정성
7. 4-Pass 독립 리뷰 → 흡수 → 영속 → handoff

## 5b. 4-Pass carry-over (S5-6a 흡수 후 잔여)

- **CO-6a-1 (Pass2/Pass3·4 M-1, drift):** `parseRelatedNodes` 와
  `enrichRelatedNodes` 는 물리 분리 정본. 현 파싱 술어 동치 + cross-ref 주석
  양쪽 부착(study/routes.ts ↔ multihop-accuracy.ts) + G-6a-2 골든. 진짜
  단일화(enrichRelatedNodes 가 parseRelatedNodes import)는 **study L3 사용자
  라우트 변경 = S5-6a 범위 외** → 차기 step carry-over. `RELATED_NODES_MAX`
  비동치는 측정 무결성상 의도(분모 인위 축소 방지) — 영속 결정.
- **CO-6a-2 (Pass1 M-1):** scripts/ runner 가 apps/api typecheck/CI 스코프
  밖. remote 전용화로 코드 최소화(parseArgs/runRemote/main 만, 채점·게이트는
  순수 코어 vitest 게이트). 잔여: 루트 `scripts/*.ts` 전용 typecheck CI
  단계 추가는 build config 변경 → 별도 결재 carry-over (verify-engine-
  contracts.ts 등 기존 scripts 와 일괄).
- **CO-6a-3 (Pass2 반론):** S5-7 A 통합 시 graph-search-route 응답 계약 변경
  가능 → 그 때 `GraphSearchResponse extends GraphSearchResponseShape` 컴파일
  가드 추가 (consumer-driven contract). S5-7 결재 자료 in-scope.
- **CO-6a-4 (Pass3 m-2):** REMOTE 워터마크가 baseURL 신뢰성을 진산 인증
  세션에 위임 — env 가 실 배포 Worker 임을 코드가 검증 안 함(stub 서버로
  가짜 REMOTE 가능). 인증 세션 운영 규율로 보강.

## 6. 잔존 위험

- related_nodes 적재 커버리지: 문항 다수가 related_nodes 빈값이면 N 과소 →
  remote 추출 시 커버리지(추출 N / 전체 active) 동시 보고(표본 신뢰성).
- graph ⊇ baseline 경향으로 Δ 상향 편향 → graphOnlyRecovery·regression 양면
  보고로 상쇄, "개선 입증"은 순 기여(graphOnly)와 악화수 동시 제시.
- 합성 픽스처가 실 토폴로지 미반영 → 로컬은 G-S5 아님 명시(워터마크), 실
  결론은 remote 만.
