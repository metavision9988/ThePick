# 5-Persona Tech Debt — Performance Engineer (Phase 2 Eval MVP 종착)

> **세션**: 066 / **Phase**: Phase 2 Eval MVP 종착 / **Persona**: 2/5 — performance-engineer
> **트리거**: Session 065 누적 (Step 5 production deploy + ADR-034/035/036 + 옵션 3) 종착 점검
> **북극성**: "10K 사용자에서 뭐가 터지나?"
> **작성**: 2026-05-11 KST

---

## 리뷰 메타 (4-Pass 인계 + 중복 회피)

### 4-Pass 직전 결과 (★ 본 리뷰 0 중복 보장)

| 4-Pass 항목                     | 직전 분류 | 본 리뷰 처리                                                       |
| ------------------------------- | --------- | ------------------------------------------------------------------ |
| DUMMY_HASH bytes drift          | C-1       | 보안/정합 영역 — performance 측면 신규 지적 X (PBKDF2 비용 별개)   |
| ADR-005 supersedes              | M         | 거버넌스 — performance 영역 X                                      |
| 임시 정책 env 분기              | M         | 거버넌스/UX — performance 영역 X                                   |
| register rate-limit (per-email) | M         | 보안 — performance side-effect 만 본 리뷰 §MAJOR-P3 에서 분리 지적 |

### 본 리뷰 범위 (Session 065 누적 diff 기준)

- `apps/api/src/auth/routes.ts` — 인증 hot path
- `apps/api/src/auth/constants.ts` — PBKDF2_ITERATIONS=100000 (ADR-035)
- `apps/api/src/auth/password.ts` — PBKDF2 derive 호출
- `apps/api/src/auth/dummy-verify.ts` — login 실패 timing 평탄화 비용
- `apps/api/src/auth/hibp.ts` — 외부 fetch 비용
- `apps/api/src/auth/rate-limit.ts` — Cloudflare RateLimiter 바인딩
- `apps/api/src/study/routes.ts` — /next + /grade hot path
- `apps/api/src/index.ts` — CORS allowlist 확장
- `apps/web/src/components/AuthForm.tsx` — 신규 island
- `apps/web/src/pages/study.astro` — 1차 default 변경
- `apps/web/dist/` — production 번들 크기 실측
- `apps/api/src/db/schema.ts` + `migrations/0001~0028.sql` — 인덱스 실측

### 측정 근거 (직접 확인)

- `apps/web/dist` 총 크기 **304 KB** (gzip 전, 17 file)
  - `client.DYKcjN1Z.js` = **186,619 bytes** (React + ReactDOM client runtime, 단일 파일)
  - `QuestionCard.C3NDmsjQ.js` = 7,331 bytes
  - `AuthForm.CttSnwhR.js` = 3,943 bytes
  - 합산 island 크기 < 30 KB
- user_progress 인덱스 (migrations/0002): `idx_progress_user(user_id)`, `idx_progress_next(fsrs_next_review)`, `idx_progress_node(node_id)` — **(user_id, card_id, card_type) 복합 인덱스 부재**
- exam_questions 인덱스: `idx_exam_type(exam_type)`, `idx_exam_topic(topic_cluster)`, `idx_exam_year(year)`, `idx_exam_status(status)` — **(status, exam_type) 복합 부재**
- PBKDF2_ITERATIONS = 100,000 (constants.ts L23) + ADR-035 주석 "20~30ms CPU per hash" 자체 추정

---

## 요약 (Phase 2 Eval MVP 종착 — performance 부채)

Phase 2 Eval MVP 평가 환경은 **단일 평가자(진산)** 기준 정상 동작. 그러나 본 코드를 **그대로 10K 누적 user / 동시 200 active user 평가 풀**에 노출하면 **3건이 즉시 SLO 위반**한다.

1. **/api/study/next** — LEFT JOIN + 1+N enrichment 직렬 `await` 루프 → 5건 요청 시 D1 round-trip **최대 6회 직렬**. p95 200~400ms (현 1건도 cold start 시 250ms 관측 가능 추정).
2. **user_progress** — `(user_id, card_id, card_type)` 복합 인덱스 부재 → /grade 의 existing lookup이 **idx_progress_user 만 사용 후 row-level filter**. user당 누적 525건+ 시 카드 lookup이 O(progress_per_user). 10K user × 평균 100건 review 누적 = 1M row 후 /grade p95 100~300ms 증가.
3. **PBKDF2 100k + login dummy verify** — login 실패/성공 모두 PBKDF2 1회 의무 = **약 25~40ms Workers CPU** (Free tier 10ms / Paid tier 30s 상한 대비 안전하나 비용 측면 부담). 600k 복원 시 비용 6배 (150~240ms) — bcrypt-WASM/Argon2id 대안 검토 carry-over 의무 (ADR-035 §"복원 의무").

기타 부채는 §CRITICAL/MAJOR/MINOR.

---

## CRITICAL (4-Pass 중복 0)

### P-CRIT-1: user_progress (user_id, card_id, card_type) 복합 인덱스 부재 — /grade 핫패스 row filter

**증거**:

- `migrations/0002_1st_exam_extension.sql` L76-78: `idx_progress_user(user_id)` 단일. 복합 인덱스 0.
- `apps/api/src/study/routes.ts` L444-454 (/grade existing lookup):
  ```sql
  SELECT id, total_reviews, correct_count
    FROM user_progress
   WHERE user_id = ?
     AND card_id = ?
     AND card_type = 'exam'
     AND node_id IS NULL
   LIMIT 1
  ```
- `apps/api/src/study/routes.ts` L335-345 (/next LEFT JOIN):
  ```sql
  LEFT JOIN user_progress up
    ON up.card_id = eq.id
   AND up.user_id = ?
   AND up.card_type = 'exam'
  ```

**파괴 시나리오 (10K user / 100건 review 평균 시)**:

- user_progress 누적 row = 10K × 100 = **1,000,000 row**
- /grade의 SELECT는 `idx_progress_user(user_id)` 만 사용 → user당 평균 100 row scan → card_id 매칭 1건. **100 row 스캔/요청**.
- /next의 LEFT JOIN은 더 심각 — 525건 exam_questions × user당 100 progress = 카르테시안 후보 → SQLite 옵티마이저가 idx_progress_user 사용해도 user의 100건을 525건 outer loop마다 hash join. **D1 SLO 50ms p95 위반 가능**.

**해결책 (Year 2 이전 의무)**:

- 마이그레이션 0029 (handoff §"8. carry-over M3+M5"에 명시되어 있으나 본 시점에 미수행):
  ```sql
  CREATE UNIQUE INDEX IF NOT EXISTS uq_user_progress_user_card
    ON user_progress(user_id, card_id, card_type)
    WHERE node_id IS NULL;
  CREATE INDEX IF NOT EXISTS idx_user_progress_user_card
    ON user_progress(user_id, card_type, card_id);
  ```
- 본 인덱스 추가 시 /grade existing lookup이 covering index seek로 전환 → **O(log N) 50~100 us**.
- /next LEFT JOIN도 (user_id, card_type, card_id) idx로 nested loop이 효율화.

**우선순위**: Phase 2 Eval MVP 종착 → Phase 2 carry-over 0순위 (UNIQUE 제약 + 인덱스 동시 처리, M3+M5 통합).

**반론 (이게 안 터질 시나리오)**: "단일 평가자 진산만 사용 → 누적 525건 한정 → SQLite full scan도 1ms 미만". **하지만** D1 production은 already 평가 environments에서도 cold start + edge-to-D1 RTT가 30~80ms 기본이며, full scan SQL이 D1 wire layer에서 row-streaming 비용을 증폭시킨다. 본 D1 cost는 SQLite local cost로 추정 금지.

---

### P-CRIT-2: /api/study/next — relatedNodes enrichment 직렬 `for await` 루프 (N+1 amplifier)

**증거**: `apps/api/src/study/routes.ts` L360-374:

```ts
const enriched: NextQuestionOut[] = [];
for (const q of questions) {
  const relatedNodes = await enrichRelatedNodes(c.env.DB, q.related_nodes, logger);
  enriched.push({ ... });
}
```

**파괴 시나리오**:

- count=5 (MAX_NEXT_COUNT) 요청 → **5회 직렬 D1 round-trip** (relatedNodes IN ... 쿼리).
- Edge → D1 RTT 평균 30~50ms × 5 = **150~250ms 직렬 대기**.
- 본 라우트는 require-auth 미들웨어 통과 후 1차 SELECT + N차 enrichment → **총 (1+5) D1 round-trip**.
- 10K user 시나리오: 동시 100 user /next 호출 시 D1 connection pool 압박 (Cloudflare D1 동시 connection ~6 권고).

**해결책**:

- Option A (즉시): `Promise.all` 병렬화 → 5회 round-trip을 1회 wallclock로 압축.
  ```ts
  const enriched = await Promise.all(
    questions.map(async (q) => {
      const relatedNodes = await enrichRelatedNodes(c.env.DB, q.related_nodes, logger);
      return { ...q, relatedNodes, sourceCitations: buildSourceCitations(q, relatedNodes) };
    }),
  );
  ```
- Option B (장기): exam_questions에 related_nodes_enriched JSON 컬럼 dehydrate 또는 batch IN 쿼리로 단일 round-trip.

**handoff §F.4 M4 carry-over에 명시**되어 있으나 Phase 2 종착까지 미수행. **본 CRIT 분류 근거**: Phase 3 launch 시 동시 user 증가 즉시 wallclock 부담 가시화 + 본 fix 비용 < 30 LoC.

**반론**: "DEFAULT_NEXT_COUNT=1이라 보통 1건만 호출". **하지만** MAX_NEXT_COUNT=5가 enable이라 모바일 미리로딩 패턴에서 client가 count=5 사용 가능 + UX 본격(memory `project_ux_north_star_phase3.md`) 진입 시 prefetch 가 늘어남.

---

### P-CRIT-3: PBKDF2 100k iterations — Workers CPU 비용 + ADR-005 600k 복원 시 6배 폭증 carry-over 미산정

**증거**:

- `apps/api/src/auth/constants.ts` L23 + L21-22 주석: "약 20~30ms CPU per hash"
- `apps/api/src/auth/routes.ts` L153 (register hash 1회) + L291-295 (login verify 1회) + L269/282 (login 실패 시 dummy verify 1회 추가)
- ADR-035 §"복원 의무": Phase 3 launch 직전 Argon2id WASM 검토 + brute-force cost 재산정 + 기존 user re-hash

**정량 분석 (10K user 시나리오)**:

본 분석은 §"10K user 시나리오 정량 분석" 절에서 상세 산정. 핵심:

- **login peak**: 정상 트래픽 5 login/min × 10K user × 일중 4시간 압축 (출퇴근/저녁) = 평균 35 req/sec
- PBKDF2 100k 25ms × 1 (or 1 dummy + 1 real = 50ms 실패 시) → **35 req/sec × 25~50ms = 875~1750 CPU-ms/sec** Workers 풀 점유
- Cloudflare Workers Free tier 10ms CPU/req → **100k iter 자체가 Free tier 미준수**. Paid tier 30s/req 한도 내 OK이나 비용 발생.
- ADR-005 600k 복원 시: 25ms × 6 = **150ms CPU/hash** → 동일 트래픽 5,250~10,500 CPU-ms/sec → Workers 가격 6배.

**해결책 (carry-over chain)**:

- Phase 3 launch 직전 ADR-035 §"복원 의무"로 본 CRIT 영속.
- Argon2id WASM (예: argon2-browser ~80 KB WASM) 도입 시 동일 보안 50ms 미만으로 압축 가능 — Workers CPU 부담 절반.
- 또는 외부 hash service (Cloudflare D1 SQL function? Workers KV로 우회? — engine 검토 carry-over).

**반론**: "현재 Workers Paid tier 30s/req → 100k는 0.025s = 0.083% 사용 안전". **하지만** (a) free → paid 강제 이행으로 Cloudflare 비용 폭증, (b) login 1초 응답이 UX 부담, (c) 600k 복원 시 cold start + PBKDF2 = p95 200~400ms로 NOTABLE.

**우선순위**: §MAJOR 가능하나 ADR-035 carry-over chain 영속이 미흡 (현 ADR 본문은 "검토 의무"만 명시, **정량 추정 미산정**) → CRIT 분류.

---

## MAJOR (4-Pass 중복 0)

### P-MAJOR-1: login 모든 실패 경로에 dummy verify — timing 평탄화 비용 2배

**증거**: `apps/api/src/auth/routes.ts` L268-273 (missing-row branch) + L281-287 (inactive-status branch):

```ts
try {
  await performDummyVerify(password);  // PBKDF2 25ms
} catch (err) {
  logger.warn(...);
}
return c.json(genericFailure, 401);
```

- `apps/api/src/auth/dummy-verify.ts` L54-57: `performDummyVerify` → `verifyPassword` (PBKDF2 100k 1회) → ~25ms CPU 부담

**부채 측면**:

- 정상 login의 PBKDF2는 1회 — 실패 login도 PBKDF2 1회 의무로 attack timing 평탄화. **이건 보안적으로 OK**.
- 하지만 brute-force 공격자 입장에서 **실패당 25ms × cost를 일으킨다**. 공격자가 의도적으로 wrong email로 spam 시 → **공격자가 Workers CPU 비용 폭증을 일으킬 수 있다 (DoS amplification via rate-limit bypass)**.
- 현 rate-limit: per-IP 20 req/60s — 분산 IP 봇넷 (1000 IP × 20 = 20,000 req/min) 가능 → **8,300 CPU-min/min (= 138 CPU-hours)**. **Cloudflare billing alarm 직접 트리거 가능**.

**해결책**:

- Option A: dummy verify의 PBKDF2를 별도 lower-cost iteration (예: 10k iter) 으로 timing 평탄화 추정 (실제 verify는 100k → diff 90k iter ≈ 22ms 차이 → 통계적으로 식별 불가능 수준일지 추가 검증 필요).
- Option B: 새벽 시간 brute-force 봇넷 패턴 감지 시 PBKDF2 skip + 400 fast-fail (단, timing oracle 재오픈 위험 — engine 검토).
- Option C: Cloudflare Turnstile pre-gate (ADR-006 단일 벤더 정합) — login form에 BOT 차단 1초 추가.

**우선순위**: Phase 3 launch 직전 Cloudflare cost cap (memory `project_anthropic_cap_pre_install.md` 패턴 — Cloudflare 별도 cap 사전 설정 의무 신규 권고).

**반론**: "AUTH_RATE_LIMITER_IP가 20 req/60s 차단 → DoS 불가". 봇넷 분산 IP는 **per-IP 차단을 무력화한다**. AUTH_RATE_LIMITER_EMAIL은 5 실패/600s이나 login만 (register는 없음) + 공격자가 random email 시 무력화.

---

### P-MAJOR-2: register에 per-email rate-limit 미적용 — PBKDF2 100k 비용 증폭 경로

**증거**: `apps/api/src/auth/routes.ts` L118-130 (register entry):

```ts
const ipAllowed = await checkIpRateLimit(...);  // per-IP only
// per-email rate limit 미적용
```

vs login L211-239: `checkEmailRateLimit` 추가.

**파괴 시나리오**:

- register는 PBKDF2 100k 1회 + HIBP fetch 1회 (3s timeout) = **약 25ms CPU + 외부 round-trip**
- 봇이 random email로 100 IP × 20 req/min = 2000 req/min register spam → Workers CPU 50 CPU-sec/min 무익 소비 + HIBP 외부 호출 2000건/min (HIBP 측 rate limit 차단 가능).
- **register 실패 (Zod 422)는 PBKDF2 호출 전 차단되어 안전**. **register 성공 (random email)** 시 D1 INSERT까지 진행 → users 테이블 spam INSERT.

**해결책**:

- register에도 `checkEmailRateLimit` 적용 (동일 이메일 5 시도/600s) — handoff 4-Pass에 명시된 "register rate-limit" MAJOR 중복 회피용 정량 분석.
- 또는 별도 `AUTH_RATE_LIMITER_REGISTER` 바인딩 (per-IP 5 req/600s) — 정상 user는 회원가입 1회뿐.

**반론**: 4-Pass에서 이미 보고 → 본 리뷰는 **정량 추정만 신규 기여** (CPU 비용 정확화).

---

### P-MAJOR-3: HIBP fetch — Workers fetch budget + 3s timeout (cold path latency floor)

**증거**: `apps/api/src/auth/hibp.ts` L35-62 + `constants.ts` L54 `HIBP_REQUEST_TIMEOUT_MS = 3000`:

- register 매 호출마다 HIBP api.pwnedpasswords.com 외부 fetch
- 3s timeout — HIBP 장애 시 register p99 = 3000ms 직선
- Cloudflare Workers subrequests 제한: Free 50/req, Paid 1000/req — 충분하나 외부 latency floor

**부채**:

- **HIBP는 ADR-034로 일시 disable** (register에서 분기 주석 처리 — `apps/api/src/auth/routes.ts` L141-149). **그러나 fetch 자체는 여전히 호출** (audit trail 보존).
- 즉 **HIBP 차단 효과 0 + HIBP 비용 100%** 상태. Phase 2 Eval MVP 한정 평가 환경이라 무관하나, **Phase 3 launch 직전 복원 의무에 본 비용 carry-over 미산정**.

**해결책 (Phase 3 복원 시 의무)**:

- Option A: HIBP timeout 1500ms로 단축 (3s → 1.5s p99) — UX 부담 절반.
- Option B: HIBP 결과 KV cache (5 byte prefix → SHA-1 prefix 캐시) — 같은 prefix 반복 register 시 fetch 0회.
- Option C: register 동기 fetch → async background 검증 + 1차 가입 통과 후 cron으로 비밀번호 강제 변경 알림.

**반론**: HIBP 자체는 fail-safe (unavailable → register 진행)이나 latency floor는 user perceived UX 부담.

---

### P-MAJOR-4: /api/study/next ORDER BY (up.id IS NULL) DESC — boolean sort 인덱스 미적용

**증거**: `apps/api/src/study/routes.ts` L341-344:

```sql
ORDER BY (up.id IS NULL) DESC,
         COALESCE(up.correct_count, 0) ASC,
         COALESCE(up.total_reviews, 0) ASC,
         eq.id ASC
```

**부채 측면**:

- `(up.id IS NULL)` 는 **boolean 표현식 → 인덱스 사용 불가** → SQLite는 모든 후보 row 정렬 (filesort).
- 후보 row = `exam_questions.exam_type='1st' AND status='active'` 매칭 = 525건 (production 실측, handoff §"누적 통합 통계").
- 525건 filesort는 SQLite 빠르나 D1 wire 비용 + 정렬된 525건 중 LIMIT 1 — **불필요한 525건 row materialization**.

**해결책**:

- Option A: 2-step query:
  1. `SELECT id FROM exam_questions eq WHERE NOT EXISTS (SELECT 1 FROM user_progress up WHERE up.card_id = eq.id AND up.user_id = ? AND up.card_type='exam') AND eq.status='active' AND eq.exam_type=? ORDER BY eq.id ASC LIMIT 1` (먼저 미시도 시도)
  2. 결과 0건이면 `SELECT eq.*, ... ORDER BY correct_count ASC, total_reviews ASC LIMIT 1` (시도된 카드 중 약한 카드)
- Option B: user_progress에 (user_id, card_type, correct_count) 복합 인덱스 + 위 P-CRIT-1과 통합.

**handoff §F.4 M2 "LEFT JOIN tiebreak (WHERE up.node_id IS NULL)"** carry-over에 일부 명시. **정량 효과**: 525 row scan → 1~10 row seek (인덱스).

**반론**: "525건 정렬 < 1ms". **하지만** D1 wire transfer + edge cold start 누적 시 의미 있는 응답시간 차이.

---

### P-MAJOR-5: AuthForm 신규 island + ProgressSummary/QuestionCard 별도 island — React runtime 중복 적재

**증거**:

- `apps/web/dist/_astro/client.DYKcjN1Z.js` = **186,619 bytes** (gzip 전, React + ReactDOM)
- AuthForm.js 3,943 bytes / QuestionCard.js 7,331 bytes / ProgressSummary.js / OfflineIndicator.js — **각 페이지마다 React runtime 1회 적재**
- `apps/web/src/pages/study.astro` L13/L22/L25: 3개 island (`client:load`) — 모두 React runtime 의존
- `apps/web/src/pages/auth/login.astro`: AuthForm 1 island — 별도 client.js 적재 (Astro shared runtime 정합)

**부채 측면**:

- 자체로는 정상. **하지만** mobile 80% 사용자 (CLAUDE.md) 3G 환경:
  - 186 KB client runtime gzip 후 ~60 KB → 3G 시 1~2초 다운로드 + parse/compile 추가 ~300ms
  - LCP (Core Web Vital) > 2.5s 위험 — Phase 3 launch UX 본격 시 차단 요인
- React 18+ 의 client runtime은 Astro Island 별도 페이지 캐시되지만, **첫 진입 페이지** (auth/login 또는 study/index) 비용 1회 직격

**해결책 (Phase 3 launch 직전 의무)**:

- Option A: AuthForm을 Astro 순수 form + view transition으로 전환 (React 의존 제거) — auth/login.astro 진입 페이지 React runtime 0
- Option B: study/ 페이지의 ProgressSummary + OfflineIndicator를 client:idle 또는 client:visible 로 변경 (LCP 우선)
- Option C: React → Preact alias (Astro config) — 60 KB → 12 KB

**우선순위**: Phase 3 launch UX 본격 진입 (memory `project_ux_north_star_phase3.md`) 시 1순위.

**반론**: "현재 평가 환경 단일 user → Core Web Vitals 무관". **하지만** Phase 3 launch 직전 carry-over 명시 의무 (memory `project_ux_north_star_phase3.md` 정합).

---

### P-MAJOR-6: refresh 라우트 — user_status 추가 SELECT (rotation hot path D1 round-trip +1)

**증거**: `apps/api/src/auth/routes.ts` L440-468 (refresh user status 재검증):

```ts
const userRow = await c.env.DB.prepare(`SELECT status FROM users WHERE id = ? LIMIT 1`)
  .bind(lookup.userId)
  .first<{ status: 'active' | 'suspended' | 'deleted' }>();
```

**부채 측면**:

- refresh rotation은 access token 만료 시 (15분 TTL 추정) 호출 → **사용 빈도 (login의 ~10배)**.
- 현재 round-trip: lookupRefreshSession (1) + user status (1) + revokeSession (1) + createRefreshSession (1) + signAccessToken (0, JWT) = **4 D1 round-trip per refresh**.
- 10K user × 일중 5회 refresh = 50K refresh/day × 4 round-trip = **200K D1 query/day**. D1 Free 5M/day 한도 내이나 4건 → 2건 단축 가능 시 50% 절감.

**해결책**:

- Option A: lookupRefreshSession에 JOIN users 추가 — `SELECT s.*, u.status FROM sessions s JOIN users u ON u.id = s.user_id WHERE ...` 1 round-trip.
- Option B: JWT에 status 클레임 stale 허용 + 매 N분 cron으로 suspended user의 sessions 일괄 revoke.

**반론**: "C-1 보안 우선 (BAN 우회 방지) — round-trip 1건 안전성 trade-off OK". 본 부채는 보안 vs 비용 trade-off — Phase 3 launch 시 D1 비용 명시 carry-over.

---

### P-MAJOR-7: scenarios.test.ts vitest 비결정성 (TD-VRF-001) — CI 시간 비용

**증거**:

- handoff §"주의사항 ★ TD-VRF-001": "verify vitest 비결정성 / 본 세션 entry run1=PASS / run2=PASS (불변)"
- 본 부채는 4-Pass에서 보고된 silent failure가 아닌 **테스트 재현성 비용**

**부채 측면**:

- CI 시 비결정성 1% 실패 → CI 재실행 비용 + Cloudflare Worker preview deploy 시간 (~2~3 min/round)
- 10K user 진입 단계에서 매 PR 마다 CI 신뢰성 차감 → 개발 속도 저하

**해결책**: Phase 3 launch 직전 vitest snapshot 결정성 보강 (random seed 고정 + Date.now mock + setTimeout mock 일관화).

**우선순위**: Phase 3 launch 의무 carry-over (현재 진산 평가만은 영향 0).

---

## MINOR (4-Pass 중복 0)

### P-MIN-1: AuthForm fetch에 timeout/abort signal 부재

`apps/web/src/components/AuthForm.tsx` L60-77 — 네트워크 hang 시 user "처리 중..." 영구 stuck. AbortController + 10s timeout 권고.

### P-MIN-2: scheduled cron rate_limits GC — `DELETE WHERE bucket_minute < ?` 인덱스 사용 OK이나 D1 batch delete 500 row/round 권장 (LIMIT 절 부재)

`apps/api/src/scheduled/rate-limit-gc.ts` (별도 검증) — 단일 DELETE 시 큰 row count 처리 시 D1 30s 제한 위반 가능. `GC_DELETE_COUNT_WARN_THRESHOLD = 30M`은 monitoring만, 실제 batch 처리 없음.

### P-MIN-3: index.ts CORS allowlist 7개 origin — array linear scan (`.includes()`) 매 요청

`apps/api/src/index.ts` L78-80: `CORS_ALLOWED_ORIGINS.includes(origin)`. 현재 7건 O(7) → 무시 가능하나 admin/staging/prod custom domain 추가 시 Set 변환 권고.

### P-MIN-4: dummy-verify DUMMY_HASH base64 decode 매 호출

`apps/api/src/auth/dummy-verify.ts` L42-48 + `password.ts` L65 `base64ToBytes(stored.hash)`: login 실패 매 회 base64 → Uint8Array (32 byte) 디코딩. Module 레벨 pre-decode 시 ms급 절약.

### P-MIN-5: study/routes.ts crypto.randomUUID() 매 /grade insert

L475: progress UUID 매 신규 진행 시 생성. UUIDv7 (시간순) 대안 검토 — B-tree insert 순차성 → page fragmentation 감소.

### P-MIN-6: AuthForm useState 5개 — controlled re-render

`AuthForm.tsx` L38-43: email/password/name/phase/errorMsg 5 state. useReducer 단일 state로 reduce 가능 (re-render 5회 → 1회).

### P-MIN-7: ProgressSummary client:load — LCP 비차단 권고

`study.astro` L13: `<ProgressSummary client:load />` → 초기 페이지 진입 시 React hydrate 의무. `client:idle` 또는 `client:visible` 로 LCP 우선화.

### P-MIN-8: CORS exposeHeaders 미니멀 — `Retry-After` 만 노출, `RateLimit-*` 표준 헤더 미노출

`index.ts` L84: `exposeHeaders: ['Retry-After']`. Cloudflare RateLimiter가 표준 `RateLimit-Remaining` 응답 시 client가 못 읽음 — UX 부담.

---

## 10K user 시나리오 정량 분석

### 가정 (보수적 추정)

| 항목                            | 수치                                 | 근거                                      |
| ------------------------------- | ------------------------------------ | ----------------------------------------- |
| 총 누적 user                    | 10,000                               | 시나리오 가정                             |
| 동시 active user (peak hour)    | 200 (2% peak ratio)                  | SaaS 일반 통계                            |
| login 평균 빈도                 | 5/min per active user                | "출퇴근 + 저녁 학습" 패턴 (handoff §G UX) |
| /next 평균 빈도                 | 30/min per active user (1~2초당 1회) | 자격증 학습 패턴                          |
| /grade 평균 빈도                | 30/min per active user               | /next와 1:1 매핑                          |
| /refresh 빈도                   | 4/hour per active user (15분 TTL)    | ACCESS_TOKEN_TTL_SECONDS 추정             |
| user_progress 누적 row per user | 평균 100 (95% percentile 500)        | 525 exam questions × 평균 진척 20%        |

### Workers CPU 시간 (req/sec 환산)

| 라우트                 | peak req/sec              | CPU/req                             | total CPU-ms/sec    | 비고                                    |
| ---------------------- | ------------------------- | ----------------------------------- | ------------------- | --------------------------------------- |
| /api/auth/login        | 16.7 (200×5/60)           | 25~50 ms                            | 420~835 ms          | 정상 + dummy verify 평균                |
| /api/auth/login (실패) | 0.5 (5%)                  | 50 ms (real + dummy)                | 25 ms               | per-IP rate-limit 통과한 실패           |
| /api/auth/register     | 0.05 (10K 누적/30일 평균) | 25 + HIBP fetch latency 100~3000 ms | 무시                | 트래픽 0 (Phase 3 launch 후 spike 별도) |
| /api/auth/refresh      | 0.22 (200×4/3600)         | 5 ms (D1 4 round-trip 우세)         | 1.1 ms              |                                         |
| /api/study/next        | 100 (200×30/60)           | 50~150 ms (D1 cold start + N+1)     | **5,000~15,000 ms** | **★ Workers CPU 풀 단일 라우트 점유**   |
| /api/study/grade       | 100                       | 30~80 ms                            | 3,000~8,000 ms      |                                         |

**총 Workers CPU-ms/sec**: 약 **8,500 ~ 24,000 ms/sec** = peak hour 동시 8.5~24 CPU-sec 진행.

Cloudflare Workers는 isolate 기반 → 단일 region 동시 100 isolate 권고 → **24 CPU-sec/sec = 24% capacity 점유** (Cloudflare 자동 scaling 정합).

### D1 query 수 (peak hour)

| 라우트   | peak req/sec | D1 round-trip/req                                                              | total D1 query/sec |
| -------- | ------------ | ------------------------------------------------------------------------------ | ------------------ |
| /next    | 100          | 1 (main) + 1~5 (enrichment)                                                    | **200~600**        |
| /grade   | 100          | 1 (rate-limit check) + 1 (question lookup) + 1 (existing) + 1 (upsert) = **4** | **400**            |
| /login   | 16.7         | 2 (user select + last_login_at update)                                         | 33                 |
| /refresh | 0.22         | 4                                                                              | 0.9                |

**총 D1 query/sec**: **약 640 ~ 1040 q/s** = peak hour 약 2.3M ~ 3.7M query/hour.

Cloudflare D1 권장 한도: 단일 DB 동시 query 6 (서버리스 connection pool 우회). **640 q/s = 일중 평균 throughput 가능하나 burst 시 D1 queue 누적 위험**.

### PBKDF2 비용 정량 (login 단일 라우트)

- 100k iter @ 25ms × login 17 req/sec × dummy verify 50% 추가 = **약 425 + 200 = 625 CPU-ms/sec PBKDF2 전용**
- 600k 복원 시 (ADR-005 정합): **3,750 CPU-ms/sec** → 단일 라우트 25 CPU-sec/sec (= 100% capacity 단일 region) 위험.

**→ ADR-035 §"복원 의무"의 "Argon2id WASM 검토"가 비용 단순 비교가 아닌 SLO 차단 단계**.

### /api/study/next 단일 user 1세션 (30분 학습) 시 query 수

- 30분 × 30/min = 900 /next 호출
- 매 호출 1 main + 1~5 enrichment = 평균 3 D1 query
- **1 세션 = 2,700 D1 query** (단일 user, single session)
- 10K user 동시 1세션 = 27M D1 query — D1 5M Free / 25M Paid 한도 정확하게 시계열 한계.

**→ Phase 3 launch 직전 /next 응답 캐시 (5초 TTL D1 KV) 또는 user_progress 1차 SELECT만 + exam_questions 클라이언트 캐시 strategy carry-over 의무**.

---

## Devil's Advocate (10K 진입 시 첫 사고)

### "본 코드 그대로 10K 진입 시 가장 먼저 터지는 시나리오 — 3 후보"

#### 사고 #1 (가장 먼저, 약 동시 50 active user에서): /api/study/next p95 SLO 위반

**시나리오**:

1. Phase 3 launch 후 입소문으로 동시 50명 진입 → /next 75 req/sec 도달
2. user_progress 누적 row 0 → user당 525 candidate full-scan + filesort + 1+5 N+1 enrichment
3. D1 edge round-trip 30~80ms × 6회 직렬 = **wallclock 200~500ms p95**
4. Astro client fetch 5s timeout 도달 전이지만 UX "느림" 누적 → bounce rate 증가

**조기 경보 신호**:

- Cloudflare Workers Analytics — /api/study/next p95 > 300ms
- D1 Analytics — query throughput > 500 q/s 지속

**대응**: §P-CRIT-1 (인덱스 추가) + §P-CRIT-2 (Promise.all) 즉시 시행 (총 < 60 LoC). **fix 후 p95 < 100ms 회귀 가능**.

#### 사고 #2 (동시 200 active user에서): Workers PBKDF2 CPU 폭증 → Cloudflare 비용 alarm

**시나리오**:

1. Bot scanner 분산 IP (1000 IP × per-IP 20 req/min) → register/login spam
2. 매 시도 PBKDF2 100k + dummy verify = 50ms CPU × 333 req/sec = **16,650 CPU-ms/sec = 16.6 CPU-sec/sec**
3. Cloudflare Workers Paid tier ($5/10M req) — 추정 일중 1M req 추가 → **+$0.5/day** (사실 미미하나) → **합법 user 응답 latency 누적**

**조기 경보**: Cloudflare cost alarm $20/day, Workers req count > 10x baseline

**대응**: §P-MAJOR-1 + §P-MAJOR-2 + Cloudflare Turnstile pre-gate (auth 페이지). Cloudflare cap 사전 설정 (memory `project_anthropic_cap_pre_install.md` 패턴 — Cloudflare 별도 cap 의무 carry-over 신규 권고).

#### 사고 #3 (10K 누적 / 1M user_progress row 도달): /api/study/grade existing lookup O(N) row scan

**시나리오**:

1. 누적 10K user × user당 100 progress = 1M row
2. /grade existing lookup `WHERE user_id=? AND card_id=? AND card_type='exam' AND node_id IS NULL` — idx_progress_user 사용 후 user당 100 row → card_id filter (100 scan/req)
3. peak 100 req/sec /grade = **10,000 row scan/sec** → D1 SLO 부담

**조기 경보**: D1 Analytics — /grade p95 > 200ms

**대응**: §P-CRIT-1 (UNIQUE 복합 인덱스) — fix 후 O(log N) seek.

---

## 우선순위 매트릭스 (Phase 2 종착 carry-over)

| 항목      | 분류  | Phase 3 이전 의무 | 비용 (LoC)           | Devil's Advocate 시나리오 |
| --------- | ----- | ----------------- | -------------------- | ------------------------- |
| P-CRIT-1  | CRIT  | 의무 (M3+M5)      | ~10                  | 사고 #1, #3               |
| P-CRIT-2  | CRIT  | 의무 (M4)         | ~15                  | 사고 #1                   |
| P-CRIT-3  | CRIT  | ADR-035 carry     | (engine)             | (PBKDF2 600k 복원 시)     |
| P-MAJOR-1 | MAJOR | Phase 3 launch    | (engine + Turnstile) | 사고 #2                   |
| P-MAJOR-2 | MAJOR | Phase 3 launch    | ~10                  | 사고 #2                   |
| P-MAJOR-3 | MAJOR | ADR-034 carry     | ~5                   | (UX latency floor)        |
| P-MAJOR-4 | MAJOR | M2 carry-over     | ~30                  | 사고 #1                   |
| P-MAJOR-5 | MAJOR | Phase 3 launch UX | ~20 + Astro config   | (Core Web Vitals)         |
| P-MAJOR-6 | MAJOR | 검토              | ~15                  | (D1 비용)                 |
| P-MAJOR-7 | MAJOR | TD-VRF-001 carry  | (deep dive)          | (CI 비용)                 |

---

## 신규 carry-over 권고

### NEW: Cloudflare Cost Cap 사전 설정 (memory `project_anthropic_cap_pre_install.md` 패턴 확장)

**근거**: §P-MAJOR-1, §사고 #2 — Bot brute-force amplification 시 Cloudflare Workers 비용 폭증 가능. Anthropic API에 적용된 $200 monthly cap을 Cloudflare에도 사전 설정 의무.

**구체 항목**:

- Cloudflare Workers monthly cap: $50 (Phase 3 launch 직후 baseline 측정 후 재산정)
- Workers req count alert: > 10x baseline (예: 1M/day baseline 시 10M/day 알람)
- D1 query alert: > 5M/day (Free 한도)
- 본 cap은 Phase 3 launch 직전 의무 carry-over.

---

## 판정

**Phase 2 Eval MVP 종착 performance 부채 — 3 CRIT / 7 MAJOR / 8 MINOR**

**Phase 3 launch 차단 의무 carry-over**:

- P-CRIT-1 (인덱스 0029 마이그레이션) — Phase 3 launch 의무
- P-CRIT-2 (Promise.all enrichment) — Phase 3 launch 의무
- P-CRIT-3 (ADR-035 §"복원 의무" 정량 산정 보완) — Phase 3 launch 의무
- NEW Cloudflare Cost Cap — Phase 3 launch 직전 의무

**Phase 2 Eval MVP 평가 환경 한정 (진산 단일 user)**: 본 CRIT 3건은 **현재 평가 시점에 절단 X** (단일 user 525건 한정 SQLite full-scan 1ms 미만). 그러나 Phase 3 launch 이전 fix 의무.

**Devil's Advocate 최종**: "본 부채 0건이라도, /next 1 API에 D1 query 6회 직렬 패턴은 10K 진입 시 첫 사고를 결정한다. 본 종착에서 carry-over 명시는 반드시 handoff-075 §"다음 할 일" 우선순위 상위 (M2/M3/M4 묶음 0순위)에 영속해야 한다."

---

**작성**: Claude (Opus 4.7 1M context) — Session 066 5-페르소나 2/5 performance-engineer
**리뷰 방식**: 독립 컨텍스트 (코드 작성 컨텍스트 ≠ 본 리뷰 컨텍스트)
**소요**: 단일 round
**다음 페르소나**: 3/5 quality-engineer (테스트 부채) → 4/5 backend-architect → 5/5 devops-architect
