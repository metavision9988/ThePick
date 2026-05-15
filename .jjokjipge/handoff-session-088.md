# Session 088 종착 핸드오프 — ThePick (쪽집게)

> **본 핸드오프 = 088** (handoff-087 직계 후속, Session 088 종착).
> **본 세션(088) 종착**: **S5-6 선결 CO6-1~CO6-4 완료** (코드+테스트+독립
> 3 에이전트 4-Pass, CRITICAL 0, MAJOR 1 즉시해소, api 621 PASS, 회귀 0).
> 진산 결재로 **S5-6a(eval harness+golden 평가셋) 자율 구축 경로** 확정 —
> 본 세션은 CO6 영속화 + 정밀 설계 핸드오프에서 종착(컨텍스트 누적,
> 신규 다파일 L2 는 신 세션 권고 — 세션 규율).

---

## 브랜치 & 컨텍스트

- 브랜치: `main` — 본 세션 코드 commit **0건** (전부 미커밋, 진산 확인 후 커밋)
- 직전 핸드오프: `handoff-session-087.md`
- 미커밋 변경: 아래 "수정/신규 파일" (handoff-087 의 S5-2~5 미커밋분 **+** 본 세션 CO6)

## 이번 세션(088)에서 한 일 — S5-6 선결 CO6

`review-20260515-202957-graph-walk-s5-2-s5-3.md` §4 carry-over 원장
CO6-1~CO6-4 (baseline 신뢰성 전제) 전부 해소:

- **CO6-1**: graph-walk `approved` CTE projection 에 `kn.description` 동봉 →
  graph-search-route 잉여 2차 `fetchApprovedNodes`(windowed scan) 제거,
  graph-walk 노드를 `NodeHitSource`(buildHit 최소입력 신설 인터페이스,
  `ApprovedNodeRow extends NodeHitSource`)로 직접 매핑. 최종 SELECT
  `description` 은 GROUP BY key 아닌 `MIN(a3.description)` 집계(id=PK 그룹
  동치 + 긴 법령 본문 group-key 비교 CPU 차단 = D-2 free 마진 보호).
- **CO6-2**: `GraphExpansionMeta.truncated` surface (다중 시드 OR 집계).
- **CO6-3**: 성공 `logger.info('graph_search_ok',{...elapsedMs})` + 실패
  경로 3곳 elapsedMs 대칭(관측 무결성).
- **CO6-4**: buildHit `Number.isFinite(rawTruthWeight)?:0` 가드(`?? 0` 는
  NaN 미차단 → 보강) + 누락 테스트 — `ranking-core.test.ts`(신규 8: 비교자
  골든/score-0 tie/NaN 반증/buildHit 가드 5) + graph-search-route.test.ts
  +4 (CO6-1 description / CO6-2 truncated / CO6-4(a) baseline 충돌 보존 /
  CO6-4(c) mid-loop fail-loud).

### 독립 4-Pass (3 에이전트, 자가 0)

`review-20260515-220647-graph-walk-s5-6-co6-4pass-integrated.md`:
CRITICAL 0 / MAJOR 1(Pass2 헤더·주석 stale → F1 즉시정정) / Pass2 Devil's
Advocate(GROUP BY description 폭 → 측정무결성) → F2 `MIN()` 구조해소 /
Pass1 Minor-2 → F3 실패경로 elapsedMs / Pass3·4 Minor → F4 NaN 단언 강화.
검증: typecheck/lint 클린, **api test 621 passed | 2 skipped (40 files)**
(직전 S5-5 609 → 신규 12 만 증가, 회귀 0).

## 수정/신규 파일 (본 세션 누적 — 전부 미커밋, handoff-087 분 포함)

### 신규 (088)

- `apps/api/src/search/__tests__/ranking-core.test.ts` (8 tests)
- `.claude/reviews/review-20260515-220647-graph-walk-s5-6-co6-4pass-integrated.md`
- `.jjokjipge/handoff-session-088.md` (본 파일)

### 수정 (088)

- `apps/api/src/search/graph-walk/index.ts` (description projection +
  `MIN()` 집계 GROUP BY + WalkRow/GraphWalkNode.description)
- `apps/api/src/search/user-search.ts` (`NodeHitSource` 신설 +
  `ApprovedNodeRow extends`, buildHit 시그니처·finite 가드)
- `apps/api/src/search/graph-search-route.ts` (2차 fetch 제거·NodeHitSource
  매핑 / truncated / 성공·실패 telemetry / 헤더·주석 정정 / logger try밖)
- `apps/api/src/search/__tests__/graph-search-route.test.ts` (+4 tests)
- `CLAUDE.md` (현재상태 실평가축·다음진입조건 — 동기 의무 이행)

> handoff-087 의 S5-2~5 미커밋분(approved-nodes-sql.ts 등)도 여전히 미커밋.
> 진산 커밋 지시 시 S5-2~5 + CO6 = 1 commit 권장(또는 2: S5-5 / S5-6선결).

## 다음 할 일 — S5-6a (★ 자율 구축, 진산 결재 경로)

> 진산 결재(2026-05-15): **"평가셋 자율 구축 + 인증 대기 (권고)"**.
> S5-6a = eval harness + golden 평가셋을 L2 자율 구축(4-Pass 포함).
> remote 실행만 진산 Cloudflare 인증 게이트 잔존.

1. **golden 평가셋 출처 = `exam_questions.related_nodes`** (TEXT, Q↔expected
   knowledge_node 링크. schema: migrations/0001 `exam_questions`. 기출
   ~545문항 production 적재됨). related_constants 도 보조 신호 가능.
2. **harness 설계** (신규, Workers 아닌 Node 스크립트 — pdfplumber 류
   빌드 파이프라인 위치 정합. `apps/api` 또는 `packages/` 별도):
   - 입력: eval 픽스처(Q content + expected related_nodes) — 추출 SQL 은
     remote D1 대상(인증 시 실행), 로컬은 sqlite 합성 픽스처로 harness
     자체 smoke.
   - 측정: 각 Q → baseline(`/api/search`) vs `/api/search/graph` 호출,
     expected node 가 results top-K 포함 여부 → **recall@K / hit-rate**.
     multi-hop 개선 = expected 가 vector 직접 미회수·graph 확장으로만
     도달하는 문항군의 정답률 Δ (G-S5 "개선 입증").
   - 출력: 측정 리포트(영속) — baseline vs graph 정답률 + 절단 표본 별도
     집계(리뷰 m-1) + 문항군 분해.
3. **Binary Gate**: G-S5 = "Vector-only 대비 multi-hop 정답률 측정값 보고
   (개선 입증)". harness 는 입력→출력 결정적이어야(가짜 green 금지).
4. **L3/주의**: harness 는 측정 도구(코어 엔진 무변경). `/api/search`·
   graph-search-route **불변**. 측정 자체 fabricate 금지(RULE #4/#5) —
   실데이터 측정은 진산 Cloudflare 인증 후.
5. **S5-6 측정 동시**: Pass2 m-2 — `description`-포함 projection 으로 D-2
   1회 실 D1 재측정 → `measurement.md §3.1` 각주(게이트 재판정 아닌 전제
   동기화). m-3 — graphExpansion 응답형상 = 측정 계약, plan 명시.
6. **S5-7** = A 정상경로(Stage 2.5) 통합 — 차기 별도 결재(자율 금지).

## 주의사항

- 본 세션 commit 0건. `/api/search` 정상경로·`searchKnowledgeNodesForUser`
  **불변** 입증(typecheck 클린 + git status). 옵션 C 격리 유지.
- 검증 명령: `pnpm --filter @thepick/api test` (621 PASS / 2 skip) /
  `typecheck` / `lint` (클린).
- CLAUDE.md 현재상태 = handoff/WBS 갱신 시 동기 의무(재 stale=재오염).
  본 핸드오프와 CLAUDE.md 동기 완료. plan §6 진행기록 S5-6 갱신은 차세션.
- 외부/AI 리뷰 채택 전 realcode 대조 의무 (본 세션 Pass2 핵심질문 CO6-1
  동치를 approved-nodes-sql.ts 단일 진실원으로 입증 = 패턴 유효 재확인).
- 잔여 carry-over: 리뷰 §5 m-1(truncated per-seed count)·m-2·m-3 = S5-6
  측정 in-scope. REMEDIATION (CRIT-5 L3 Year2, B-1~4 Tier3) + Step
  3-UX-7b distractor BATCH(L3) 미해소 영속.

## TaskList 상태 (인계 — 세션 간 비영속, 차세션 재생성)

- #1 CO6-1 ✅ / #2 CO6-2 ✅ / #3 CO6-3 ✅ / #4 CO6-4 ✅ / #5 4-Pass+검증 ✅
- #6 S5-6 in_progress — CO6 선결·4-Pass 완료. S5-6a(eval harness 자율
  구축) 차세션 착수, remote 측정은 진산 Cloudflare 인증 게이트 대기.

이 핸드오프를 읽고 프로젝트 CLAUDE.md 확인 후 S5-6a(eval harness + golden
평가셋 자율 구축, `exam_questions.related_nodes` 출처)부터 이어가세요.
