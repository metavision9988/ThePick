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

## Session 065 (2026-05-10 ~ 2026-05-11 KST) — Step 5 + ADR-034/035/036 + 옵션 3

| #   | version (8 char) | timestamp                    | commit (8 char)    | ADR / sketch                                   | rollback hint                                      |
| --- | ---------------- | ---------------------------- | ------------------ | ---------------------------------------------- | -------------------------------------------------- |
| 1   | 82b11658         | 2026-05-10 (staging)         | 661dccc            | Step 5-A — CORS + M6 AuthForm 흡수 (staging)   | staging only, rollback skip 가능                   |
| 2   | ab9f5533         | 2026-05-10                   | 661dccc            | Step 5-B — production 초기 deploy              | pre Session 065 base 복귀 시 Step 5 전 commit 필요 |
| 3   | 870d87d2         | 2026-05-10                   | 65ba0bf            | ADR-034 — PASSWORD_MIN_LENGTH 4 + HIBP disable | rollback 시 register 422 (PWNED) 재발              |
| 4   | c1524d07         | 2026-05-10                   | 661c320            | ADR-035 — PBKDF2_ITERATIONS 100k Workers 호환  | rollback 시 register 500 HASH_ERROR 재발           |
| 5   | 9640ceb5         | 2026-05-10                   | 4db5527            | ADR-036 — Cookie SameSite=None cross-origin    | rollback 시 login 후 /study 401 redirect 재발      |
| 6   | b221cd18         | 2026-05-11                   | bba35fa            | root 진입점 surface + PWA meta (apps/web 동기) | apps/api 무영향 (apps/web 빌드 매개)               |
| 7   | b1941b5f         | 2026-05-11                   | 3178eba            | 옵션 3 — examType default '1st'                | rollback 시 /api/study/next default '2nd' 복원     |
| 8   | **cf498ca0**     | 2026-05-11 (★ 현 production) | 3178eba (~4405c92) | Session 065 종착 안정 버전                     | **본 버전 = Phase 2 Eval MVP 평가 PASS baseline**  |

★ **매핑 정확도**: ★★ (handoff-074 §B/§C 본문에서 인용한 chronological 순서 기반 추정. wrangler 토큰 발급 후 `wrangler deployments list --name thepick-api-production` 출력으로 정확 매핑 갱신 의무 — Session 066 C-14 처리 시 동시 갱신).

---

## staging (thepick-api-staging)

| #   | version  | timestamp  | commit  | 비고                                        |
| --- | -------- | ---------- | ------- | ------------------------------------------- |
| 1   | 82b11658 | 2026-05-10 | 661dccc | Step 5-A staging — /api/study/next 401 PASS |

---

## Carry-Over

- **C-14 (migration 0028 production 적용 증거 영속)**: wrangler 토큰 발화 후 `wrangler d1 migrations list thepick-prod --remote` 출력을 `.claude/reports/production-migration-status.md` 영속. 동시에 본 파일 §"매핑 정확도" 갱신.
- **Phase 3 launch 시**: 본 파일 reset 또는 `production-version-trail-phase3.md` 분기 carry-over (Phase 2 평가 trail은 archive).
- **GitHub Actions deploy automation** (Persona5-MAJOR carry-over): wrangler CLI 수동 호출 → Actions job 전환 시 본 파일 entry 자동 append script (`.github/workflows/deploy-prod.yml` post-step) 의무.

---

**작성**: Session 066 (Claude Opus 4.7) — 4-Pass + 5-Persona 통합 리뷰 C-13 즉시 흡수
**일자**: 2026-05-11 KST
