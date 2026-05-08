# Session 056 — Phase 2A Vectorize 인덱싱 4-Pass 통합 보고서

> **세션**: 056 / 2026-05-08 KST
> **트리거**: plan `phase2a-vectorize-indexing.plan.md` §5.11 4-Pass 독립 에이전트 리뷰 의무 (CRITICAL 0건 → "완료" 조건)
> **prefix 정합**: memory `feedback_review_filename_pattern.md` (review-YYYYMMDD-HHMMSS-\* prefix 의무)

---

## 1. 리뷰 방식

5 페르소나 **병렬 독립 에이전트** (자가 리뷰 금지, .claude/rules/auto-review-protocol.md 정합):

| 순번 | 에이전트                                  | Pass 분담                        | 코드 작성 컨텍스트 외부 |
| ---- | ----------------------------------------- | -------------------------------- | ----------------------- |
| 1    | `pr-review-toolkit:silent-failure-hunter` | Pass 1 SURGEON                   | ✓                       |
| 2    | `system-architect`                        | Pass 2 ARCHITECT                 | ✓                       |
| 3    | `security-engineer`                       | Pass 3 ADVOCATE (보안)           | ✓                       |
| 4    | `quality-engineer`                        | Pass 4 CONTRACT (plan/Hard Rule) | ✓                       |
| 5    | `pr-review-toolkit:code-reviewer`         | 5번째 보너스 (style/conv)        | ✓                       |

각 에이전트에 **변경 파일 목록 + 연관 파일 + 본 step 결정 영속 (D-VEC-1=B / D-VEC-2=A / D-VEC-3=A)** 명시. 단일 메시지 내 5 Agent 병렬 실행.

---

## 2. 리뷰 범위

**변경 파일 (1차 review 대상)**:

- `apps/api/src/vectorize/upserter.ts` (신규) — bge-m3 임베딩 + Vectorize upsert
- `apps/api/src/vectorize/routes.ts` (신규) — Hono admin sub-router (/bootstrap, /search)
- `apps/api/src/vectorize/__tests__/upserter.test.ts` (신규, 13 단위 테스트)
- `apps/api/src/index.ts` (수정) — Bindings 확장 + route 등록
- `apps/api/wrangler.toml` (수정) — 3 env (dev/staging/production) Vectorize + AI binding
- `apps/api/.dev.vars` (신규, .gitignore 영속) — ADMIN_API_TOKEN dev placeholder
- `docs/adr/ADR-004-vectorize-embedding-spec.md` (Addendum §4 + 수정 이력)
- `docs/plans/phase2a-vectorize-indexing.plan.md` (신규)

**연관 파일 (참조)**:

- `packages/shared/src/{errors.ts, exam-adapter.ts, constants/exam-ids.ts}`
- `apps/api/src/telemetry/admin-token.ts` (requireAdminToken 패턴)
- `apps/api/src/auth/routes.ts` / `apps/api/src/telemetry/routes.ts` (Hono 정합)
- `docs/adr/ADR-004` / `ADR-007` / `ADR-008`
- `docs/architecture/SEARCH_PIPELINE.md`

---

## 3. 발견 분류 (5 페르소나 통합)

### 🔴 CRITICAL (3건, 모두 본 step 즉시 수정 PASS)

| ID  | 출처            | 요지                                                                              | 수정 위치                                                              | 상태 |
| --- | --------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---- |
| C1  | Pass 1 SURGEON  | `/search` AI 호출 try-catch 부재 → silent 500 + phase 정보 0건                    | `routes.ts:201-211` cause 전파 try-catch                               | ✅   |
| C2  | Pass 1 SURGEON  | `/search` Vectorize.query try-catch 부재 + matches null + ADR-008 graceful 미적용 | `routes.ts:226-249` try-catch + `gracefulDegradation` 플래그 (`<0.60`) | ✅   |
| C3  | Pass 3 ADVOCATE | `/api/admin/vectorize/*` CORS 미등록 → CSRF + preflight 우회 가능                 | `index.ts:97-101` cors() 등록 + `X-Admin-Token` allowHeaders           | ✅   |

### 🟠 MAJOR (13건 — 일부 즉시 수정, 나머지 carry-over)

**즉시 수정 (3건)**:

| ID      | 출처           | 요지                                                                | 수정 위치           |
| ------- | -------------- | ------------------------------------------------------------------- | ------------------- |
| M-imm-1 | Pass 1 SURGEON | D1 `.all()` 결과 silent skip — try-catch + cause 전파               | `routes.ts:140-149` |
| M-imm-2 | Pass 1 SURGEON | `parsePageRefToInt` null fallback 0 silent — `{value, parsed}` 반환 | `routes.ts:262-285` |
| M-imm-3 | Pass 1 SURGEON | `buildNodeForVectorize` page_ref parse 실패 시 console.warn         | `routes.ts:243-247` |

**Carry-over (10건, 별도 step)**:

| ID      | 출처             | 요지                                                                                                        | carry-over 영속 위치         |
| ------- | ---------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------- |
| M-co-1  | Pass 1 SURGEON   | partial commit 추적 (caller 8 batches 청크 운영자 책임) admin runbook 영속                                  | handoff-065 + admin runbook  |
| M-co-2  | Pass 2 ARCHITECT | ADR-008 800ms timeout / 1 retry — 정식 user 검색 라우트 별도 step                                           | plan §10.1 + handoff         |
| M-co-3  | Pass 2 ARCHITECT | SEARCH_PIPELINE Stage 2 hard filter (`status='approved' AND is_current_active=1`) — 정식 user 라우트 강제   | plan §10.1 + handoff         |
| M-co-4  | Pass 2 ARCHITECT | Workers CPU budget batch=100 paid bundled/unbound 의무 영속                                                 | handoff-065 주의사항         |
| M-co-5  | Pass 3 ADVOCATE  | D-VEC-1=B "검색단 단일 방어" Hard Rule 영속 (dev-guide.md 또는 ADR-004 §4 보강)                             | 별도 step (정식 user 라우트) |
| M-co-6  | Pass 3 ADVOCATE  | search route metadata allowlist (`superseded_by` 등 leak 차단)                                              | 별도 step                    |
| M-co-7  | Pass 3 ADVOCATE  | dev token rotate (`.dev.vars` 본 토큰 transcript 노출, staging/production 진입 시 wrangler secret put 필수) | handoff-065 carry-over       |
| M-co-8  | Pass 4 CONTRACT  | `routes.ts` 단위 테스트 0건 (Hono mock)                                                                     | 별도 step                    |
| M-co-9  | Pass 4 CONTRACT  | `scripts/run-vectorize-indexing.ts` Node script 미작성 (admin route + curl loop 대체)                       | 별도 step (정식 script)      |
| M-co-10 | 5번째 보너스     | `VectorizeBindingForRoute extends VectorizeBinding` DRY 약화 — `apps/api/src/vectorize/types.ts` 분리       | 별도 step                    |

### 🟡 MINOR (12건, 전부 carry-over)

전부 plan §10.1 + handoff-065 carry-over 영속. 본 step 코드 변경 0건.

세부 항목:

- P2-m1 `is_active=true` 하드코딩 → `superseded_by IS NULL` 도출
- P2-m2 SEARCH_PIPELINE.md v2.1 → v2.2 deferred 주석
- P2-m3 AiBinding 모델 lock-in
- P2-m4 i18n Korean 에러 admin-only 컨벤션
- P3-m1 `/search` rate-limit 미적용
- P3-m2 `parseCookieHeader` URI decode 부재
- P4-m1 `is_active` carry-over plan 영속
- P4-m2 `parsePageRefToInt` 페이지 범위 손실 (`'p.123-125'` → 123)
- P4-m3 plan §5 Gates 표 본문 5/5 → §3.5 Addendum 흡수
- 5th-m1 `parsePageRefToInt` null vs 0 sentinel 의도 명시
- 5th-m2 `mapPhaseToErrorCode` 결과를 routes.ts 직접 위임 가능
- 5th-m3 index.ts Bindings 타입 indexed access vs upserter.ts 직접 import

---

## 4. 통합 판정

| 단계                                     | 결과                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| CRITICAL 0건 (본 step 수정 후)           | ✅ PASS                                                                        |
| MAJOR 즉시 수정 3건 PASS                 | ✅                                                                             |
| MAJOR carry-over 10건 영속               | ✅ plan §10.1 + handoff-065                                                    |
| MINOR 12건 carry-over 영속               | ✅ plan §10.1 + handoff-065                                                    |
| 단위 테스트 13/13 PASS                   | ✅ `vitest run src/vectorize/__tests__/upserter.test.ts`                       |
| typecheck PASS                           | ✅ `pnpm typecheck` (apps/api)                                                 |
| post-fix verify run1 ≡ run2 = PASS 7/0/1 | ✅ `.claude/reports/sprint1-step5-5-verify-session-056-post-fix-run{1,2}.json` |
| Hard Rule 17 grep 런타임 리터럴 0건      | ✅                                                                             |
| graceful degradation 동작 검증           | ✅ Q1 false (top1=0.741) / Q2 true (top1=0.394)                                |
| CORS preflight 동작 검증                 | ✅ 204 + Access-Control-Allow-\* 정합 (X-Admin-Token allowHeaders)             |

**최종 판정**: **"완료" 선언 가능** (plan §5 Gate 5.11 PASS, CRITICAL 0건 + MAJOR carry-over 명시 영속).

---

## 5. Devil's Advocate 통합 (각 페르소나 반론 흡수)

> "CRITICAL 3건 수정 후에도 다음 시나리오에서 추가 위험: (a) production deploy 후 admin이 batch=100 호출 시 Workers AI bge-m3 70K tokens × Vectorize.upsert 850KB payload — Vectorize mutation size limit 명시 부재로 silent partial-fail 가능. mutationId만 봐서는 inserted_count 검증 안 됨. **방어**: `wrangler vectorize get-by-ids` 1건 sample 검증을 운영 runbook에 영속. (b) D-VEC-1=B 운영 시 별도 user 검색 라우트가 `status='approved'` floor를 미주입하면 검수 전 draft 노출 — Hard Rule 영속 의무 (carry-over M-co-5). (c) `.dev.vars` dev 토큰이 transcript에 노출 — staging/production 진입 시 wrangler secret put + dev 토큰 rotate 의무 (carry-over M-co-7). (d) plan §3.5 Addendum 4/5 합격 영속됐으나 LAW-138 미달 근본 원인 (description 정책? 데이터 결손?) 분석 영속 0건 → 다른 LAW 미달 시 동일 D-VEC-3=A 우회 패턴 정착 위험. **방어**: 별도 step에서 임베딩 텍스트 정책 강화 (chapter+section 메타 추가) 검증 + Truth Weight rerank PoC."

---

## 6. 참고

- 본 통합 보고서: `.claude/reviews/review-20260508-044304-session-056-vectorize-4pass.md`
- plan: `docs/plans/phase2a-vectorize-indexing.plan.md` §10.1 (4-Pass 결과 영속)
- 5 페르소나 raw 결과: 본 메시지 conversation 직전 turn 5 Agent tool 결과 (보존됨)
- handoff: `.jjokjipge/handoff-session-065.md` (carry-over 영속)
- memory `feedback_review_filename_pattern.md` 정합
- memory `feedback_auto_review.md` (4-Pass 독립 에이전트 의무) 정합
