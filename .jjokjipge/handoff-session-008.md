# Session Handoff — 2026-04-18~20 (Session 8)

## 세션 요약

Session 8 (약 11시간) — **Phase 1 진입 게이트 G6 완료 + v3.0 FINAL 수용 + 기술부채 정리 + Phase 1 Step 1-1 PBKDF2 인증 구현 완료**.

총 독립 에이전트 리뷰 **16회** (4-Pass 2회 × 4 에이전트 + 축약 재리뷰 4회 × 2 에이전트 + 3차 1 에이전트 = 17 pass).

---

## 완료된 주요 작업

### 1. G6 Cloudflare D1 발급 + migrations 0001~0004 remote apply

- staging: `thepick-db-staging` (edacc775-b11c-4200-8a76-284c65fa0542, APAC)
- production: `thepick-db-production` (a9b8d521-dc99-46f7-835c-1f226cebdbf8, APAC)
- `apps/api/wrangler.toml` env 분리 (default/staging/production) + `migrations_dir = "../../migrations"`
- **D1 호환 수정**: `migrations/0003` `SELECT CASE WHEN...END` 구조가 wrangler splitter와 충돌 → 개별 trigger `WHEN` 절로 분해 (staging 1차 실패 후 수정 재적용)

### 2. v3.0 FINAL 재정립서 분석 → Year 2 이월 결정

**전환 내용**: "손해평가사 MVP" → "멀티시험 학습 SaaS 플랫폼"

- 2006줄 v3.0 FINAL vs 702줄 v2.0 비교 — 독립 에이전트 분석
- **옵션 B 채택** (Pilot First, Platform Second) — 스키마 전면 재설계는 Year 2 Phase 4로 이월
- 엣지 타입 13종 유지 (v3.0의 5종 축소는 조기 추상화로 판정)

**신규 ADR 3건** 작성:

- **ADR-007** `multi-exam-deferred-to-year-2.md` — v3.0 수용 + Year 1 유지 범위 + Year 2 마이그레이션 0005 순서 명시
- **ADR-008** `graceful-degradation-thresholds.md` — 정량 기준 8절 (D1 재시도, Vectorize, KV 폴백, Claude API, Write-path 503, 메시지 5종, Circuit Breaker, **L1 Edge Cache**)
- **ADR-009** `pii-masking-policy.md` — logger PII_KEYS 33종 카탈로그 (PIPA §23/§24 + PCI-DSS + OWASP)

**ADR-004 업데이트** — Vectorize 메타데이터 `exam_id` 필터 필수 원칙 추가

### 3. Step 1-0 기술부채 정리 (11건)

- **문서**: ADR-009 + ADR-008 §3 exam_questions KV stale 방어
- **인프라**: compatibility_date 2026-04-01, wrangler.toml placeholder UUID, dev observability 0.1, db:migrate binding SSOT, CI permissions + audit-level=high
- **스키마**: `migrations/0005_not_null_triggers_completion.sql` — 25개 NOT NULL 트리거 (constants/exam_questions/mnemonic_cards/user_progress/topic_clusters/revision_changes)
- **코드**: ESLint `no-restricted-syntax` Rule 17 (시험 ID 리터럴 단일 선언 강제)
- **deploy 가드**: `apps/api/package.json` deploy script를 `exit 1`로 변경 → default env 오용 차단

### 4. Step 1-1 PBKDF2 인증 구현 (B안 — 엄격)

**4-Pass 리뷰 Critical 9건 전부 해소**:

- PBKDF2 **600k** (OWASP 2024 ADR-005 원본 정합) + timing-safe compare
- **v3.0 §7.1 `name` 컬럼 복원** (7 레이어 정합: SQL → Drizzle → Zod → INSERT → 응답)
- `dummy-verify.ts` — Timing enumeration 공격 방어
- Enumeration 통합 (suspended/deleted → generic 401)
- **Cloudflare Workers Rate Limit API** — IP 20/60s + email 5/600s (ADR-006 단일 벤더)
- Cache-Control security floor (404 `no-store` fallback)
- users UPDATE 자동갱신 트리거 (재귀 방지 WHEN 절)
- **Production fail-closed** (binding 미설정 시 거부) — 2차 리뷰 M-1 해소

**신규 파일**:

- `apps/api/src/auth/{constants,types,password,hibp,routes,dummy-verify,rate-limit}.ts`
- `apps/api/src/middleware/{cache-policy,retry}.ts`
- `packages/shared/src/messages.ts` (ADR-008 §6 + AUTH_MESSAGES)
- `apps/api/src/auth/__tests__/{password,hibp,rate-limit}.test.ts`
- `apps/api/src/middleware/__tests__/{cache-policy,retry}.test.ts`

**Migrations**:

- `0006_users_and_auth.sql` — users 테이블 + 9 NOT NULL/format/iteration 트리거
- `0007_users_strict_hardening.sql` — name 컬럼 + iterations 600k + auto-timestamp 트리거

### 5. 독립 리뷰 이력 (8개 파일)

| 시각  | 파일                                  | 범위                          |
| ----- | ------------------------------------- | ----------------------------- |
| 09:23 | `review-20260418-092310.md`           | 1차 4-Pass (변경분 전체)      |
| 09:23 | `phase0-tech-debt-20260418-092310.md` | 5-페르소나 기술부채           |
| 10:09 | `review-20260418-100930.md`           | 2차 축약 4-Pass               |
| 11:03 | `review-20260418-110346.md`           | logger 전용                   |
| 16:21 | `review-20260418-162108.md`           | Session 8 전반 4-Pass         |
| 17:36 | `review-20260418-173647.md`           | 2차 축약 (Critical 6 해소)    |
| 17:53 | `review-20260418-175309.md`           | 3차 tech-debt 정리 검증       |
| 18:26 | `review-20260418-182605.md`           | Step 1-1 4-Pass (Critical 9)  |
| 20:19 | `review-20260418-201954.md`           | Step 1-1 2차 축약 — 완료 판정 |

---

## 현재 상태 (2026-04-20)

### Git (uncommitted)

- **수정**: 20개 (production-quality.md, eslint.json, gitignore, state.json, api wrangler.toml/package.json/tsconfig/index.ts/schema.ts, migrations/0003, schema, 포함)
- **신규**: 56개 (auth/, middleware/, migrations/0005~0007, ADRs 9종, 리뷰 8종, messages.ts, exam-adapter.ts, constants/exam-ids.ts, .github/ workflow 등)
- **통계**: 20 files, +1035 / -808 (modifications만)

### 코드 수치

| 항목                     | Session 7 종료  | Session 8 종료                    |
| ------------------------ | --------------- | --------------------------------- |
| typecheck                | 14/14           | 14/14 ✅                          |
| lint                     | 통과            | 14/14 (+Rule 17) ✅               |
| tests (monorepo)         | 351             | **406** (+55 api)                 |
| migrations 적용 (remote) | 없음            | **7개** (staging+production 양쪽) |
| D1 triggers              | —               | **47+** (staging/production)      |
| ADR                      | 6               | **9** (ADR-007/008/009 신규)      |
| Phase                    | 1 Step 1-0 대기 | **1 Step 1-1 완료**               |

### D1 스키마 상태 (remote)

- **10 tables**: knowledge_nodes, knowledge_edges, formulas, constants, revision_changes, exam_questions, mnemonic_cards, user_progress, topic_clusters, **users** (name 컬럼 포함)
- **47+ triggers**: 5 prevent_update (temporal guard) + 30 enforce_not_null (0005) + 9 users (0006+0007 NOT NULL/format/iteration/auto-timestamp)
- **indexes**: 38+ (기본 6 + 0002 확장 + users unique email + status + subscription_expires partial)

---

## 다음 작업 (Session 9 — Phase 1 Step 1-2)

### 1순위: 진산님 수동 작업 3건

| #   | 작업                      | 명령/위치                                                                                                                                                                         |
| --- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **L3 plan 새 파일 교체**  | `docs/plans/current.plan.md` — Step 1-2 scope로 새로 작성                                                                                                                         |
| 2   | **KV namespace 2개 발급** | `cd apps/api && wrangler kv:namespace create CACHE --env staging` 및 `--env production`. 발급된 `id` 2개를 wrangler.toml `[[env.{staging,production}.kv_namespaces]]` 블록에 주입 |
| 3   | **PBKDF2 600k CPU 실측**  | staging 배포 후 `wrangler tail --env staging` 로 register/login 요청 시 CPU 시간 확인. Free tier 50ms vs Paid tier 30s 대비 여유 측정                                             |

### 2순위: Step 1-2 구현 범위

- **`apps/api/src/webhooks/payment.ts`** — Replay/Idempotency 패턴 (ADR-002 + ADR-008 §5 write-path 503 준용)
- **Logger 마이그레이션** — `apps/api/src/auth/routes.ts` + `hibp.ts` `console.error/warn` 4건 → `@thepick/shared` logger. `maskEmail` 임시 함수 제거 (ADR-009 체크박스 해소)
- **KV 폴백 구현** — Step 1-2에서 read-only 공용 데이터에 Workers KV 캐싱 (ADR-008 §3). binding 발급 후 `apps/api/src/middleware/kv-fallback.ts` 신규 예정

### 3순위: 이월 Major (carry-over)

- **M-dummy-hash**: `dummy-verify.ts`의 `DUMMY_HASH`를 실제 PBKDF2 산출물로 교체 (현재 all-zero → 통계 공격 가능성)
- **M-rate-limit-namespace**: 환경별 `namespace_id` 분리 (현재 dev/staging/prod 공유 1001/1002 → 2001/3001 분리)
- **M-constants trigger**: `revision_changes.category` NOT NULL 트리거 0005 Addendum (현재 SQL CREATE TABLE에 `NOT NULL` 선언으로 방어선 1층은 있음)

### 4순위: Phase 완료 시 5-페르소나 리뷰

Phase 1 종료 시점(Step 1-1 + 1-2 + 1-3 이상 완료)에 refactoring-expert + performance-engineer + quality-engineer + backend-architect + devops-architect 5개 에이전트 병렬 기술부채 리뷰 **의무**.

---

## 핵심 문서 위치

### 반드시 먼저 읽기 (Session 9 시작 시)

1. `.jjokjipge/handoff-session-008.md` (이 파일)
2. `.jjokjipge/state.json` (Phase 1 Step 1-1 completed, next step 1-2)
3. `docs/plans/current.plan.md` (Step 1-1 scope — Step 1-2 plan으로 교체 예정)
4. `.claude/reviews/review-20260418-201954.md` (Step 1-1 완료 판정 + 이월 Major 4건)

### 규칙

- `CLAUDE.md` (프로젝트 원칙 + 최근 실수)
- `.claude/rules/auto-review-protocol.md` v2 (2단계 독립 리뷰 의무)
- `.claude/rules/production-quality.md` (Hard Rule 15~17 + Year 1 한시 예외)

### ADR (9건)

- ADR-001~006 (Session 7 수립)
- **ADR-007** 멀티시험 Year 2 이월
- **ADR-008** Graceful Degradation 8절 (§1~§9)
- **ADR-009** PII 마스킹 33종 카탈로그

### 아키텍처

- `docs/architecture/ARCHITECTURE.md` §7 Graceful Degradation + L3 KV Hard Limit 박스
- `docs/architecture/THREAT_MODEL.md`

### 기획

- `docs/쪽집게(ThePick) — 구현 재정립서 v2.0.md` (Year 1 현행)
- `docs/쪽집게(ThePick) — 구현 재정립서 v3.0 FINAL.md` (2026-04-17, 멀티시험 확장 미래 방향)

---

## 주의사항

1. **L3 경로 수정 시** `docs/plans/current.plan.md` scope 확장 필수 (protect-l3.sh 차단)
2. **완료 선언 전 독립 리뷰 필수** — L2+ 변경 = 4-Pass, Phase 마일스톤 = 5-페르소나
3. **외부 SaaS 벤더 금지** — ADR-006 강제. Cloudflare 내장으로 먼저 검토
4. **Hard Rule 17 시험 ID 리터럴** — `packages/shared/src/constants/exam-ids.ts` 외 사용 금지 (ESLint `no-restricted-syntax` 활성)
5. **Year 1 한시 예외** — `packages/shared/src/types.ts`의 NodeType(INSURANCE/CROP) 리터럴은 ADR-007에 따라 Year 2 Phase 4 이전 대상. **신규 코드에 복제 금지**
6. **session 피로 관리** — 이번 세션은 약 11시간 진행. 다음 세션도 90분 초과 시 즉시 handoff 생성

---

## 2026-04-20 시스템 셧다운 상황

- 시스템 업데이트를 위해 파워 온/오프 예정
- 현재 모든 D1 변경은 Cloudflare D1 원격 서버에 영구 저장됨 (staging + production)
- 로컬 uncommitted 변경 58건 — 작업 완료 후 git commit 필요 (현재 미수행)
- 재부팅 후 `wrangler whoami` 로 Cloudflare 세션 복원 확인 권장
