# thepick-api-production Version Trail

> **목적**: Cloudflare Workers production deploy version ↔ commit ↔ ADR/sketch mapping 영속.
> on-call incident 시 rollback 대상 식별 + version diff 추적 기준.
> **근거**: Session 066 4-Pass + 5-Persona 통합 리뷰 C-13 (Persona5-DCRIT2)
> **운영 의무**: 매 production redeploy 시 본 파일 1줄 append + commit

---

## 운영 규칙

- **append-only** — 과거 entry 수정 금지 (Temporal Ledger 원칙)
- 매 production redeploy 직후 본 파일에 entry 1행 추가 + git commit
- entry 형식: `| version | timestamp(KST) | commit | ADR/sketch | rollback hint |`
- `wrangler deployments list --name thepick-api-production` 출력과 정합 의무
- rollback 명령: `wrangler rollback --message "incident #N" <version-id>` (production)

---

## Pre Session 065 (archive — 2026-05-09 KST, handoff-073 직전 deploy 잔여)

| #     | version (8 char) | timestamp UTC           | KST   | 비고                                                |
| ----- | ---------------- | ----------------------- | ----- | --------------------------------------------------- |
| arc-1 | e5006698         | 2026-05-09 07:38:51 UTC | 16:38 | Phase 2 Eval MVP baseline (handoff-073 직전 deploy) |
| arc-2 | 3fe8305b         | 2026-05-09 07:39:46 UTC | 16:39 | 1분 후 secondary deploy                             |

## Session 065 (2026-05-10 ~ 2026-05-11 KST) — Step 5 + ADR-034/035/036 + 옵션 3 (★★★ 정확 매핑, Session 067 wrangler deployments list 정합)

| #   | version (8 char) | timestamp UTC           | KST   | commit (8 char)    | ADR / sketch                                                                 | rollback hint                                  |
| --- | ---------------- | ----------------------- | ----- | ------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------- |
| 1   | ab9f5533         | 2026-05-10 06:31:48 UTC | 15:31 | 661dccc            | Step 5-B — production 초기 deploy + CORS 갱신                                | pre Session 065 base (arc-2 3fe8305b) 복귀     |
| 2   | 870d87d2         | 2026-05-10 07:59:26 UTC | 16:59 | 65ba0bf            | ADR-034 — PASSWORD_MIN_LENGTH 4 + HIBP disable                               | rollback 시 register 422 (PWNED) 재발          |
| 3   | c1524d07         | 2026-05-10 11:57:18 UTC | 20:57 | 661c320            | ADR-035 — PBKDF2_ITERATIONS 100k Workers 호환                                | rollback 시 register 500 HASH_ERROR 재발       |
| 4   | 9640ceb5         | 2026-05-10 12:16:26 UTC | 21:16 | 4db5527            | ADR-036 — Cookie SameSite=None cross-origin                                  | rollback 시 login 후 /study 401 redirect 재발  |
| 5 ★ | **6ed7bea6**     | 2026-05-10 12:19:16 UTC | 21:19 | (4db5527 hotfix)   | ADR-036 직후 3분 hotfix (handoff-074 누락 entry, Session 067 정확 매핑 발견) | rollback 시 ADR-036 정확 적용 직전 상태        |
| 6   | b221cd18         | 2026-05-10 12:21:19 UTC | 21:21 | bba35fa            | root 진입점 surface + PWA meta (apps/web 동기)                               | apps/api 무영향 (apps/web 빌드 매개)           |
| 7   | b1941b5f         | 2026-05-10 12:32:43 UTC | 21:32 | 3178eba            | 옵션 3 — examType default '1st'                                              | rollback 시 /api/study/next default '2nd' 복원 |
| 8   | **cf498ca0**     | 2026-05-11 01:21:59 UTC | 10:21 | 3178eba (~4405c92) | Session 065 종착 안정 버전 (★ Session 066 entry baseline)                    | Phase 2 Eval MVP 평가 PASS baseline            |

★ **매핑 정확도**: ★★★ (Session 067 `wrangler deployments list --name thepick-api-production --env=production` 실측 정합 — handoff-074의 8 entry 추정 매핑에서 staging 82b11658 entry 제거 + 6ed7bea6 1건 누락 발견하여 본 갱신으로 보정).

## Session 067 (2026-05-12 KST) — C-14 흡수 deploy chain

| #   | version (8 char) | timestamp UTC        | KST   | commit (8 char) | ADR / sketch                                                     | rollback hint                                         |
| --- | ---------------- | -------------------- | ----- | --------------- | ---------------------------------------------------------------- | ----------------------------------------------------- |
| 9   | **dc25f807**     | 2026-05-12 (현 시점) | (KST) | 509de79         | C-01/06/07 활성화 (DUMMY_HASH v2 + /next Promise.all + mig 0029) | rollback 시 cf498ca0 — Session 065 종착 baseline 복귀 |

★ **smoke test (2026-05-12 KST)**:

- `GET /health` → `{"status":"healthy"}` ✅
- `GET /api/study/next?examType=1st&count=1` (no auth) → `HTTP 401` ✅ (인증 정합)

---

## staging (thepick-api-staging)

| #   | version  | timestamp  | commit  | 비고                                        |
| --- | -------- | ---------- | ------- | ------------------------------------------- |
| 1   | 82b11658 | 2026-05-10 | 661dccc | Step 5-A staging — /api/study/next 401 PASS |

---

## Carry-Over

- ✅ **C-14 (migration 0029 production 적용 증거 영속)**: Session 067에서 해소. `wrangler d1 migrations apply` PASS + `.claude/reports/production-migration-status.md` 영속 완료.
- ✅ **매핑 정확도 갱신**: Session 067에서 ★★→★★★ (wrangler deployments list 실측 정합).
- **Phase 3 launch 시**: 본 파일 reset 또는 `production-version-trail-phase3.md` 분기 carry-over (Phase 2 평가 trail은 archive).
- **GitHub Actions deploy automation** (Persona5-MAJOR carry-over): wrangler CLI 수동 호출 → Actions job 전환 시 본 파일 entry 자동 append script (`.github/workflows/deploy-prod.yml` post-step) 의무.

---

**작성**: Session 066 (Claude Opus 4.7) — 4-Pass + 5-Persona 통합 리뷰 C-13 즉시 흡수
**갱신**: Session 067 (2026-05-12 KST) — C-14 흡수, wrangler deployments list 실측 정합 (정확도 ★★★)
**일자**: 2026-05-11 KST (초안) / 2026-05-12 KST (정합 갱신)
