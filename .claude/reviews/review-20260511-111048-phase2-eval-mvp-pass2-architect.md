# 4-Pass Review — Pass 2 (Architect, Top-Down)

## 리뷰 메타

- **세션**: 066 (cold start 독립 리뷰 — Session 065 누적 7 commits 검증)
- **범위**: `f98532d..HEAD` (Phase 2 Eval MVP Step 5 + ADR-034/035/036 + 옵션 3)
- **리뷰어**: Pass 2 Architect (코드 작성 컨텍스트 미보유)
- **리뷰 일시**: 2026-05-11 11:10:48 KST
- **타깃 카테고리**: 13 categories (Workers 제약 / D1 스키마 / Import 방향 / Hexagonal / CORS+SameSite / Ontology Lock / IDX↔D1 / Hard Rule 15-17 / i18n / ADR-005 supersedes / Migration 0028 idempotency / 다이어그램 정합성 / d1-from-sqlite 정합)
- **본 리뷰 방식**: 독립 (자가 리뷰 아님). 변경 파일 26개 + 연관 파일 (ADR-005, password.ts, dummy-verify.ts, 0007 migration, scenarios.test.ts, study/**tests**/routes.test.ts, progress/**tests**/routes.test.ts, 아키텍처 docs/) 누적 검증.

## 요약

| 분류         | 건수 | 영향                                                                                                           |
| ------------ | ---- | -------------------------------------------------------------------------------------------------------------- |
| **CRITICAL** | 2    | ADR-005 supersedes 표기 부재 / dummy-verify.ts 문서 drift                                                      |
| **MAJOR**    | 4    | 마이그레이션 0028 idempotency / 테스트 fixture 600000 잔존 / ADR-005 본문 갱신 누락 / 0020 누락 의문           |
| **MINOR**    | 5    | docs/architecture 도메인 정합 누락 / API_BASE fallback / examType default plan 정합 / dummy-verify 주석 / etc. |

**핵심 판정**: Step 5 production deploy + G9 PASS는 정합하나, **PBKDF2 상수 변경(600k → 100k)의 supersedes chain이 ADR-005 본문에 반영되지 않음**으로 미래 세션이 "ADR-005 정합" 가정 하에 600k로 되돌릴 silent regression 위험. 추가로 dummy-verify.ts 내 모든 주석/문서가 "600,000"으로 표기되어 코드 리뷰어가 잘못된 invariant 가정으로 미래 dummy hash 재생성 시 600k 사용 → timing parity 깨짐.

---

## CRITICAL

### CRIT-PASS2-1 — ADR-005 본문 supersedes 표기 부재 (silent regression risk)

**파일**: `docs/adr/ADR-005-authentication-pbkdf2-sha256.md:76, 81, 280`

**증거**:

- L76: "**Iterations:** 600,000 (OWASP 2024 권고 기준 PBKDF2-SHA256)" — 변경 없음
- L81: "SELECT password_iterations FROM users WHERE password_iterations < 600000" — 변경 없음
- L280: "`PBKDF2_ITERATIONS = 600000`, ... 트리거 하한 600000 상향" — 변경 없음
- `grep -n "supersedes\|Superseded\|ADR-035" docs/adr/ADR-005*.md` → **0 hits**
- ADR-035 §"결정" L29: "본 ADR-035가 일부 supersedes" — ADR-035 측에서는 표기되어 있으나 ADR-005 측에서 역참조 없음

**영향**:

- 미래 세션이 "ADR-005 600k 원칙 정합" 가정으로 PBKDF2_ITERATIONS를 600,000으로 되돌리면 Workers 런타임 NotSupportedError 재발현
- ADR-005 L81의 운영 쿼리 `password_iterations < 600000`이 이제 모든 user를 rotation 대상으로 표기 → 운영 시그널 false-positive
- ADR-035 §"복원 의무" L51 "ADR-005 supersedes 표기"는 carry-over 체크리스트로 영속되나, Phase 3 launch까지 ADR-005 본문이 미갱신 상태 = supersedes chain 단방향 누수

**Pass 2 본질 매핑**: "ADR 문서와 코드가 만나면" — ADR-005 본문은 600k, 코드는 100k → "이 문서 + 저 코드"가 충돌. 향후 어떤 PR이 ADR-005 본문을 기준으로 100k를 다시 600k로 되돌리면 prod 100% fail로 회귀.

**수정 권고 (즉시)**:

1. ADR-005 헤더에 "**Superseded in part by**: ADR-035 (2026-05-10, Workers 호환 100k)" 명시
2. L76 옆 inline 주석: "★ Workers 호환 100k 운영 — ADR-035 참조"
3. L81 운영 쿼리 inline 주석: "< 100000 (현 runtime baseline, ADR-035)"
4. L280 변경 이력 줄 아래 신규 줄: "- 2026-05-10 (Session 065 ADR-035 Workers 호환 100k 채택)"

---

### CRIT-PASS2-2 — dummy-verify.ts 문서 invariant 600,000 잔존 (timing parity drift 잠재)

**파일**: `apps/api/src/auth/dummy-verify.ts:8, 18, 27, 43`

**증거**:

```
L8:  * PBKDF2 600k 반복 + 상수시간 비교의 CPU 시간을 소비.
L18:  * 고정 더미 해시. 실제 PBKDF2-SHA256 600,000 반복 산출물 (Step 1-1 M-dummy-hash 해소).
L27:  *   const hash = c.pbkdf2Sync(pt, salt, 600000, 32, 'sha256');
L43:   // base64 decoded bytes — PBKDF2-SHA256(sentinel, salt, 600000, 32)
```

`L47` 실제 코드: `iterations: PBKDF2_ITERATIONS` → 현재 **100,000** 사용. base64 hash 바이트는 600k로 생성된 산출물. `verifyPassword(plaintext, DUMMY_HASH)` 호출 시:

- `stored.iterations < PBKDF2_ITERATIONS` 분기 (password.ts:59) → 100k < 100k 거짓 → 통과
- `derivePbkdf2Bits(plaintext, salt, 100000)` 실행 — CPU 100k consume
- `timingSafeEqual(candidate, expected)` → expected는 600k bytes, candidate는 100k bytes → false (의도된 결과)

**현 시점 동작**: 결과는 항상 false (정상), CPU 시간은 ~100k (real verify와 동일). **timing parity 보존** — 직접 functional bug 아님.

**그러나** invariant 위반:

1. **재생성 시 silent timing parity 파괴**: 미래 세션이 dummy-verify.ts 주석을 신뢰하여 "600k bytes가 박혀있으니 PBKDF2_ITERATIONS도 600k여야 한다" 추론 → constants.ts를 600k로 되돌리면 Workers crash 재발현
2. **L37-L38 주석**: "iterations 를 현재 PBKDF2_ITERATIONS 와 **반드시** 동일하게 유지" → 현재 코드는 이를 지키나, hash bytes 자체는 600k 산출물 → "재생성 절차" L23-L29 스크립트 실행 시 100k로 재생성 의무. 그러나 주석에 "600000" 그대로.
3. **timing 시간 측정 테스트**: `dummy-verify.test.ts:32` `expect(elapsed).toBeGreaterThan(10)` 는 100k 환경에서 ~20-30ms이라 통과. 그러나 주석 L30: "PBKDF2 600k 반복은 Workers/Node 에서 수십 ms 소요" — 거짓.

**영향 (장기)**:

- 미래 dummy hash 재생성 (예: salt v1 → v2 rotation) 시 "L23-L29 절차 그대로 사용" → `pbkdf2Sync(pt, salt, 600000, 32, 'sha256')` 실행 → 100k 환경에서 verifyPassword 호출 시 100k consume + 600k bytes 비교 → 타이밍 정합 + 결과 false (동일). 그러나 인지 부담은 영속

**Pass 2 본질 매핑**: 모듈 간 invariant drift. constants.ts와 dummy-verify.ts 모듈이 "600k" vs "100k" 양쪽 가정 공존 → 미래 cross-module 변경 시 충돌.

**수정 권고 (필수)**:

1. dummy-verify.ts L8, L18, L27, L43 본문에서 "600,000" / "600000" → "PBKDF2_ITERATIONS (현 100k, ADR-035)" 갱신
2. L23-L29 절차 스크립트의 `pbkdf2Sync(pt, salt, 600000, ...)` → `pbkdf2Sync(pt, salt, 100000, ...)` 갱신 + 주석으로 "ADR-035 Workers 호환" 인지
3. dummy hash 자체를 100k로 재생성하여 일관성 복원 (선택적, timing 정합은 이미 유지되므로 후순위)
4. 또는 ADR-035에 "dummy-verify.ts 문서 잔존 600k는 운영상 무해. Phase 3 hash service 변경 시 일괄 갱신" 명시

---

## MAJOR

### MAJ-PASS2-1 — 마이그레이션 0028 idempotency 부재 (재실행 시 trigger duplicate error)

**파일**: `migrations/0028_pbkdf2_iterations_workers_compat.sql:18`

**증거**:

```sql
-- (1) 기존 600k trigger drop
DROP TRIGGER IF EXISTS enforce_users_password_iterations_min;

-- (2) 신규 100k trigger create (Workers 호환 minimum)
CREATE TRIGGER enforce_users_password_iterations_min
BEFORE INSERT ON users
WHEN NEW.password_iterations < 100000
```

L18 `CREATE TRIGGER` — `IF NOT EXISTS` 누락. 0007의 trigger를 DROP 후 신규 CREATE이므로 첫 적용은 OK. 그러나 **재실행 시나리오** (예: D1 마이그레이션 재플레이, 테스트 헬퍼가 같은 in-memory DB에 두 번 적용, restore 시점):

- (1) DROP IF EXISTS → 통과 (no-op)
- (2) CREATE TRIGGER → trigger가 이미 존재하면 `already exists` 에러

대조: 0007:21도 `CREATE TRIGGER`만 사용 (IF NOT EXISTS 없음) → 동일한 idempotency 결함. 그러나 0007은 이미 적용된 자산. 0028은 신규.

**연관 영향**: `apps/api/src/__tests__/helpers/d1-from-sqlite.ts` L64 — SCENARIO_MIGRATIONS 배열에 0028 추가됨. `createD1FromSqlite()` 매 `beforeEach`마다 신규 :memory: DB 생성하므로 영향 없음. 그러나 향후 incremental DB 마이그레이션 도구 도입 시 (예: `wrangler d1 migrations apply` 재실행 안전) 결함.

**Workers production 영향**:

- `wrangler d1 migrations apply thepick-db-production --remote` 는 d1_migrations 테이블 기반 idempotency 보장 → 실 production 영향 없음
- 그러나 incident response 시나리오 (마이그레이션 history 손상, 수동 SQL 재실행) → 회복 비용 증가

**수정 권고 (선택)**:

1. `CREATE TRIGGER IF NOT EXISTS enforce_users_password_iterations_min` 변경 (sqlite IF NOT EXISTS 지원)
2. 또는 d1 migrations 체계 의존만으로 충분 — TD 로그에 idempotency 부재 인지 영속

### MAJ-PASS2-2 — 테스트 fixture `password_iterations = 600000` 잔존 (trigger silent drift)

**파일**: `apps/api/src/study/__tests__/routes.test.ts:86`, `apps/api/src/progress/__tests__/routes.test.ts:43`

**증거**:

```typescript
// study/__tests__/routes.test.ts:86
`INSERT INTO users (id, email, password_hash, password_salt, password_iterations, status)
 VALUES (?, ?, ?, ?, 600000, 'active')`,
```

- d1-from-sqlite.ts SCENARIO_MIGRATIONS 배열은 0028을 마지막에 적용 → trigger 신규 `>= 100000` 강제
- 본 테스트 fixture는 `600000` 삽입 → 100k 이상이므로 trigger 통과 (정합)
- 그러나 fixture가 ADR-005 정합 가정으로 작성됨 → ADR-035 흡수 후 "100000" 정합으로 갱신되지 않음 → **silent drift**

**향후 위험**:

- 누군가 password_iterations 컬럼 의미를 "현재 PBKDF2_ITERATIONS와 일치해야 한다"고 해석하고 hashPassword().iterations로 교체 → 실 데이터에서는 100k 사용 → fixture만 600k 유지 → 테스트는 통과 (trigger 100k 이상이면 OK) → 그러나 fixture의 의도가 불명확화

**연관**: dummy-verify.test.ts L81 `expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(100000)` — 새 baseline 인지 반영. 다른 fixture는 미반영.

**수정 권고**: `password_iterations = 100000` 으로 통일 (또는 헬퍼 함수 `seedUserWithCurrentIterations()` 도입). 본 step 의무 아님 — TD-PASS2-MAJ2 영속.

### MAJ-PASS2-3 — ADR-005 본문 변경 이력 line만으로는 supersedes chain 추적 부족

**파일**: `docs/adr/ADR-005-authentication-pbkdf2-sha256.md` (전체)

**증거**:

- ADR-005 헤더 L3-L6: "Accepted" + "결정일: 2026-04-14" — 변경 없음
- L280 "변경 이력" 1줄만 (Session 8). ADR-035 흡수 (Session 065) 추가 줄 없음

**ADR 작성 컨벤션 위반**: ADR 헤더는 `Status: Accepted (superseded in part by ADR-XXX)` 또는 별도 `Supersedes` / `Superseded-by` 필드 보유 필요. 본 프로젝트 ADR-035, ADR-036는 헤더에 supersedes 명시. ADR-005만 누락.

**연관 위반**: ADR-035 §"복원 의무" L51 "ADR-005 supersedes 표기"가 Phase 3 launch carry-over로 영속되었으나, **carry-over는 단방향**. ADR-005 측에서는 자체 추적 부재 → 미래 어떤 세션이 ADR-005를 직접 읽으면 supersedes chain 미인지.

**수정 권고**:

1. ADR-005 L3 상태 갱신: `Accepted (PBKDF2 iterations Workers 호환 100k로 일부 supersedes — ADR-035, 2026-05-10)`
2. L1-L7 헤더 영역에 `Supersedes` / `Superseded-by` field 추가
3. L280 변경 이력에 신규 줄 추가

### MAJ-PASS2-4 — d1-from-sqlite.ts SCENARIO_MIGRATIONS 배열에 0020-0027 누락

**파일**: `apps/api/src/__tests__/helpers/d1-from-sqlite.ts:44-67`

**증거**:

```typescript
const SCENARIO_MIGRATIONS = [
  '0001_initial_schema.sql',
  ...'0019_knowledge_nodes_page_chapter_meta.sql',
  // ★ ADR-035: ... 본 마이그레이션이 0007 이후 적용되어야 인증 시나리오 통과
  '0028_pbkdf2_iterations_workers_compat.sql',
];
```

migrations 디렉토리 실제 파일: 0021-0027 존재 (table_structures, table_cells, review_queue 등). SCENARIO_MIGRATIONS는 0019 직접 0028로 점프.

**의도된 design** (L44 주석 "시나리오 테스트에 필요한 migration 만 로드"): 일부 마이그레이션 선택적 로드 — 그러나 0021~0027은 Pattern-H 표 처리 / review_queue 등 BATCH 적재 관련. 본 step 인증 + study 시나리오 테스트에서는 무관하므로 의도 정합.

**잠재 위험**:

- L40-L42 주석 "TD-API-001 ... 본 배열 + scripts/verify-engine-contracts.ts 의 readdir 자동 wrapper 가 분리되어 ... silent dual-schema dormancy 회귀 위험" 명시 — 누적 TD 인지됨
- 0028이 0019와 0020-0027 사이 mismatch — 일관성 가정 깨짐 (`d1 migrations apply --remote`는 전체 0001-0028 순차 적용하나, 테스트는 부분 적용)

**production drift 시나리오**:

- production: 0001-0028 전체 적용. table_structures 트리거 활성
- 테스트: 0001-0019 + 0028. table_structures 트리거 없음
- → 향후 table_structures 와 users / sessions 간 cross-table 트리거 추가 시 production만 reject, 테스트는 통과 = silent prod regression 경로

**Pass 2 본질 매핑**: 본 step 자체는 OK. 그러나 마이그레이션 0028과 기존 0020-0027 정합 검증 누락 = 모듈 (테스트 헬퍼) ↔ 모듈 (production migrations) 간 silent drift.

**수정 권고**:

- TD-API-001 ledger에 본 step도 추가 (0028은 인증 시나리오에 필수, 다른 0020-0027은 미적용 영속)
- Sprint 2 자동 readdir 통합 의무 영속

---

## MINOR

### MIN-PASS2-1 — docs/architecture/ ARCHITECTURE.md 도메인 정합 누락

**파일**: `docs/architecture/ARCHITECTURE.md` (변경 없음)

**증거**: `grep -rn "thepick-study\|thepick.app\|pages.dev" docs/architecture/` → **0 hits**

`apps/api/src/index.ts:35` `https://thepick-study.pages.dev` 추가됨. `docs/architecture/ARCHITECTURE.md` Mermaid 다이어그램은 아직 `thepick-staging.pages.dev` / `thepick.app` 만 표기 (또는 도메인 미표기).

**영향**: Pass 2 §"다이어그램 정합성" — Mermaid 다이어그램 vs 실제 CORS allowlist mismatch. silent 도메인 drift.

**수정 권고**: Phase 2 종착 시점 ARCHITECTURE.md 갱신 (apps/web Pages 도메인 `thepick-study.pages.dev` + apps/api Workers `thepick-api-production.metavision9988.workers.dev` 명시 + ADR-036 cross-origin 흐름 추가).

### MIN-PASS2-2 — AuthForm.tsx `API_BASE` fallback `http://localhost:8787` (잘못된 production 진입 위험)

**파일**: `apps/web/src/components/AuthForm.tsx:11`, `apps/web/src/components/QuestionCard.tsx:14`

**증거**: `const API_BASE: string = import.meta.env.PUBLIC_API_BASE_URL ?? 'http://localhost:8787';`

production build 시점에 `PUBLIC_API_BASE_URL` 환경 변수가 누락되면 localhost로 fallback. apps/web/.env.example는 staging/production URL 명시되어 있으나, Cloudflare Pages 빌드 환경에서 변수 누락 시 localhost fetch → 100% CORS/네트워크 fail → AuthForm 사용자에게 "네트워크 오류" surface.

**대조**: 현재 빌드 산출물 `apps/web/dist/_astro/AuthForm.CttSnwhR.js` L1에 `"https://thepick-api-production.metavision9988.workers.dev"` 임베드됨 → **현 시점 production 정상**. 그러나 미래 빌드에서 env miss 시 silent localhost drift.

**수정 권고**: env 누락 시 build fail 강제 (ASTRO build-time validation 또는 `??` 대신 `??` + throw). 본 step 의무 아님 — TD-PASS2-MIN2.

### MIN-PASS2-3 — examType default '1st' 변경의 다른 호출자 영향 미검증

**파일**: `apps/api/src/study/routes.ts:309`

**증거**: `const examTypeRaw = c.req.query('examType') ?? '1st';` (이전 '2nd')

study/**tests**/routes.test.ts는 explicit `?examType=2nd` 명시 (handoff §G "filter 검증 의도 보존"). 그러나:

- QuestionCard.tsx L86 explicit `examType=${examType}` (props default '2nd' → study.astro L22 `examType="1st"`) → OK
- 다른 클라이언트 / 직접 curl / future BATCH 통합 / admin tool 등이 `?examType` 미명시 시 → 1차 525건 default surface 이전 코드 (2nd default) 정합 의도와 다름

**영향**: 옵션 3 결정 (Session 065 진산 명시)으로 의도된 변경. 그러나 plan §3 결정 갱신 시점 (handoff §G) 외 ADR 또는 docs/architecture 갱신 부재 → 미래 세션이 "왜 default '1st'?" 추적 시 plan §3만 발견. ADR 신규 작성 또는 ADR-034/035/036 chain에 옵션 3 명시 권고.

**수정 권고**: docs/plans/phase2-eval-mvp.plan §3 갱신은 이미 commit `3178eba`에 포함. 추가 ADR 작성은 선택적 (옵션 3 = 진산 결정 영역, plan으로 충분).

### MIN-PASS2-4 — `void examIdParam.examId` 패턴 (Hard Rule 16 zero-cost 의도 안전한가)

**파일**: `apps/api/src/study/routes.ts:304, 391`

**증거**:

```typescript
const examIdParam = requireExamId(c.req.query('examId'));
if (examIdParam.error || !examIdParam.examId) {
  return c.json(...);
}
void examIdParam.examId;  // ← 사용 표명만
```

Hard Rule 16 "데이터 조회 함수에 examId 파라미터" 충족 의도. 그러나 본 코드에서 examId는 D1 쿼리에 주입되지 않음 (Year 1 단일 시험). `void examIdParam.examId`는 ESLint unused warning 회피 패턴.

**Pass 2 §Hard Rule 16 매핑**:

- Year 1 단계: examId 인자 받음 + 내부 미사용 = OK (Year 2 zero-cost 전환 시그니처 보존)
- 그러나 `void` 패턴은 "받았지만 의도적으로 무시"의 약한 명시. `_examId` 명명 또는 ESLint `// @ts-expect-error TD-Year2` 주석 패턴 권고

**영향 (Year 2)**: 본 step에서는 정합 (Year 1 단일). 그러나 Year 2 Phase 4 시점에 `void` 줄을 발견하고 "이미 사용된다고 마킹된 변수"로 오인할 위험. zero-cost 전환 시 `WHERE exam_id = ?` 추가가 누락되면 silent multi-tenant leak.

**수정 권고**: 본 step 영속. Year 2 마이그레이션 직전 검토 필수 — TD-PASS2-MIN4 ledger.

### MIN-PASS2-5 — i18n 한국어 하드코딩 (AuthForm.tsx, QuestionCard.tsx)

**파일**: `apps/web/src/components/AuthForm.tsx:22-26, 88-93, 97, 109, 122-123, 142, 152`, `apps/web/src/components/QuestionCard.tsx:131, 144, 187, 214-215, 246, 255, 266, 274, 285, 289, 293-295, 300, 305, 313, 320, 329`

**증거**: 한국어 사용자 노출 문자열 다수. 예시:

```typescript
// AuthForm.tsx:22
EMAIL_TAKEN: ('이미 등록된 이메일입니다. 로그인을 시도해 주세요.',
  // QuestionCard.tsx:255
  (placeholder = '정답을 입력하세요 (① / 1 / 1번 모두 동일 처리)'));
```

**대조**: production-quality.md 또는 본 프로젝트 i18n 규약 없음 (Phase 0 / 1 누적 검증 결과 한국어 기본 정합). multi-language carry-over는 Phase 3 launch 직전 결정.

**Pass 2 §i18n 매핑**: 본 step 정합 (한국어 단일 사용자). Hard Rule 위반 아님.

**수정 권고**: Phase 3 launch 직전 i18n 키 도입 검토 — 본 step 영속.

---

## 확인 증거 (카테고리별 최소 3개)

### 1. Workers 제약 (fs/path 금지 / Web Crypto / CPU)

- ✅ `apps/api/src/auth/password.ts:124` `derivePbkdf2Bits` — Web Crypto `crypto.subtle.deriveBits` 사용 (Node crypto 불사용). Workers 호환.
- ✅ `apps/api/src/auth/dummy-verify.ts:13` — `crypto` 직접 사용 없음. `verifyPassword` 경유. Workers 호환.
- ✅ `apps/api/src/auth/routes.ts:159` `crypto.randomUUID()` — Workers 표준 API.
- ✅ `migrations/0028_pbkdf2_iterations_workers_compat.sql` — pure SQL, Workers 무관.
- ⚠️ `apps/api/src/__tests__/helpers/d1-from-sqlite.ts:23-26` `node:sqlite`, `node:fs`, `node:path` — 테스트 한정 사용, Workers 코드 아님 (별도 build target). 정합.

**N/A**: 본 변경 범위에 Workers production 코드에 fs/path 추가 없음.

### 2. D1 스키마 일치 (Drizzle ORM vs 실제 D1)

- ✅ `apps/api/src/auth/routes.ts:106-113` `StoredUserRow` interface — `id/email/password_hash/password_salt/password_iterations/status` 6 필드. migrations/0006/0007 users 테이블 컬럼과 일치.
- ✅ `apps/api/src/study/routes.ts:97-110` `ExamQuestionRow` — 11 필드. migrations/0001:114-129 exam_questions + 0002:20 exam_type 추가 정합.
- ✅ 마이그레이션 0028 trigger `users.password_iterations` 컬럼 참조 — 0006 신규 + 0007 trigger 갱신 + 0028 trigger 재갱신. 컬럼 자체 변경 없음, trigger만 갱신. D1 schema state 정합.

### 3. Import 방향 (단방향 의존)

- ✅ `apps/web/src/components/AuthForm.tsx` — 외부 의존 0 (`react` + Tailwind 클래스만). apps/api 직접 import 없음. fetch 경유 통신.
- ✅ `apps/web/src/components/QuestionCard.tsx:12` `import { EXAM_IDS } from '@thepick/shared'` — apps → packages 단방향. 정합.
- ✅ `apps/api/src/auth/routes.ts:44` `@thepick/shared` — apps/api → packages/shared 단방향.
- ✅ `apps/api/src/study/routes.ts:33` `requireAuth` import (auth/middleware) → study 의존 — apps/api 내부, 단방향.

### 4. Hexagonal 규칙 (domain → infrastructure 직접 참조 없음)

- ✅ `apps/api/src/auth/password.ts` — Web Crypto API (infrastructure) 직접 사용. 그러나 auth/password.ts는 application layer (L3 Fortress). hexagonal 위반 아님 — 인증은 본 프로젝트 hexagonal 분리 대상 외 (Phase 0 ADR).
- ✅ `apps/api/src/study/routes.ts` — `c.env.DB.prepare()` 직접 사용. routes는 transport layer, domain logic은 normalize/isAnswerCorrect 단순 함수. hexagonal 분리 의무 없음 (Phase 2 단순 surface 의도).
- N/A `packages/formula-engine/`, `packages/parser/` 등 core 모듈 — 본 step 변경 범위에 포함되지 않음.

### 5. CORS / Origin (cross-origin pages.dev↔workers.dev 보안)

- ✅ `apps/api/src/index.ts:35` `https://thepick-study.pages.dev` 추가. allowlist closed-set 유지.
- ✅ `apps/api/src/index.ts:75-87` `buildCorsOptions` — origin callback 함수. `CORS_ALLOWED_ORIGINS.includes(origin)` 검증. wildcard 없음.
- ✅ `apps/api/src/auth/routes.ts:526` `authCookieSameSite('production') → 'None'` + `isSecureCookieEnv('production') → true` + Secure 플래그. 브라우저 SameSite=None + Secure 정합 강제. ADR-036 결정 정합.
- ✅ `apps/api/src/auth/__tests__/routes.test.ts:223-226` test 환경 'Lax' + Secure 미적용 검증 — ADR-036 환경별 분기 회귀 방어.
- ⚠️ CRIT-1 / MAJ-3 — ADR-005 supersedes chain 미반영

### 6. Ontology Lock (변경 범위 내 신규 노드 추가 0)

- ✅ 본 변경 범위에 `ontology-registry.json` 갱신 없음 (`git diff f98532d..HEAD --stat | grep -i ontology` → 결과 없음)
- ✅ AuthForm / QuestionCard / study routes는 사용자 데이터 surface, knowledge_nodes INSERT 경로 아님
- N/A — 신규 ID 생성 0

### 7. IndexedDB ↔ D1 동기화 (오프라인 흐름)

- N/A `apps/web/src/components/OfflineIndicator.tsx`는 본 step 변경 없음 (study.astro L25에서 사용)
- N/A AuthForm은 credentials='include' + Set-Cookie 의존, IndexedDB 큐 무관
- N/A QuestionCard 401 → /auth/login redirect 흐름은 ServiceWorker offlineActions 큐와 분리 (online 가정)

### 8. Hard Rule 15/16/17 (examId 격리)

- ✅ Rule 17 `apps/web/src/components/QuestionCard.tsx:15` `EXAM_IDS.SON_HAE_PYEONG_GA_SA` 경유 — 리터럴 0. 정합.
- ✅ Rule 16 `apps/api/src/study/routes.ts:74-88` `requireExamId(c.req.query('examId'))` — examId 강제. 정합.
- ⚠️ Rule 16 §"Year 1 한시 예외" — examId 인자 받지만 D1 쿼리에 미주입 (`void examIdParam.examId`). Year 2 zero-cost 의도 정합. MIN-PASS2-4 권고.
- ✅ Rule 15 — `packages/formula-engine/`, `packages/parser/` 변경 없음. 시험 특화 분기 위반 0.

### 9. i18n / 한국어 하드코딩

- ⚠️ MIN-PASS2-5 영속

### 10. ADR-005 supersedes chain

- ❌ CRIT-PASS2-1 영속

### 11. 마이그레이션 0028 idempotency

- ⚠️ MAJ-PASS2-1 영속

### 12. 다이어그램 정합성 (ARCHITECTURE.md Mermaid)

- ⚠️ MIN-PASS2-1 영속 (도메인 정합 누락)

### 13. 테스트 헬퍼 0028 정합

- ✅ `d1-from-sqlite.ts:66` 0028 추가됨. SCENARIO_MIGRATIONS 배열 마지막 위치 (0007 이후 보장).
- ✅ `study/__tests__/routes.test.ts:86` fixture 600000 → trigger 100k 통과 (현 시점 정합, MAJ-PASS2-2 인지)
- ⚠️ MAJ-PASS2-4 — 0020-0027 누락 silent drift

---

## Devil's Advocate (깨질 시나리오 5건)

### Scenario A — Phase 3 launch 직전 ADR-035 §"복원 의무" 망각 (PBKDF2 100k 영속)

진산 G9 PASS 후 Phase 3 launch가 1년 뒤로 지연되면 ADR-035 carry-over chain이 memory 누적 부하로 우선순위 하락. 실제 launch 시점에 PBKDF2 100k는 OWASP 2023 권고 (310k) 미달 → 4자리 password 등 평가 환경 user가 prod 진입 후 brute-force 노출. **대책**: 본 review의 CRIT-1을 ADR-005 본문에 즉시 반영 — 미래 어떤 세션이 ADR-005를 직접 읽어도 supersedes chain 인지.

### Scenario B — Workers production CPU 시간 폭증 (PBKDF2 100k × 동시 100 register)

`PBKDF2_ITERATIONS = 100000` × Workers PBKDF2 ~20-30ms per request × 100 동시 register = 2-3초 누적 CPU. Workers Paid tier 30s 상한 대비 10% 사용. 그러나 동시 1000 register (PG 결제 후 폭증 시나리오) → 20-30초 CPU = Workers timeout 근접. 결제 모듈 + Webhooks 연동 시 동시 register 폭증 가능성 — Rate Limit 의무 (현 이미 구현 routes.ts:121-130 IP rate limit).

### Scenario C — CORS_ALLOWED_ORIGINS 누수 (thepick-study.pages.dev 외 도메인 추가 시)

apps/api/src/index.ts:24-36 allowlist는 closed-set. 그러나 Cloudflare Pages 자동 생성 PR preview URL (`pr-N.thepick-study.pages.dev`) 같은 sub-domain 시나리오 미고려. PR preview에서 credentialed fetch 시 cookie 미전송 → AuthForm 로그인 실패. **대책**: PR preview workflow 미사용 (직접 wrangler deploy) → 영향 0. carry-over.

### Scenario D — dummy-verify.ts L8 timing 측정 테스트 환경별 변동

`dummy-verify.test.ts:32` `expect(elapsed).toBeGreaterThan(10)` — Workers Free vs Paid vs Node 22 native vs CI runner CPU 환경별 변동. 100k iterations Node 22 native에서는 ~10-20ms이라 10ms 임계 통과. 그러나 매우 빠른 CI runner (M2 native) 또는 향후 Bun runtime 등 PBKDF2 가속 → 100k <10ms → 테스트 false negative. **대책**: 본 step 변경 아님, 현재 CI Node 22 통과. carry-over.

### Scenario E — Year 2 시험 확장 시 examType '1st' default 충돌

옵션 3 채택으로 study/routes.ts:309 default '1st'. Year 2 공인중개사 (또는 다른 자격증) 도입 시 시험별 examType semantic 충돌:

- 손해평가사: '1st' (객관식) / '2nd' (서술형)
- 공인중개사: '1st' (오전) / '2nd' (오후) / 다른 분류 체계?
  → `examType` enum이 Hard Rule 15 위반 잠재. ExamAdapter 도입 시 examType 의미 추상화 필요. **대책**: Year 2 Phase 4 carry-over (Hard Rule 15 Year 1 한시 예외 chain). 본 step 영향 0.

---

## ADR-034/035/036 carry-over 시스템 영향 평가

### 단기 (Phase 2 종착 시점)

| ADR | 영향                                      | 위험 수준                                                             |
| --- | ----------------------------------------- | --------------------------------------------------------------------- |
| 034 | PASSWORD_MIN_LENGTH 4 + HIBP 분기 disable | LOW — 진산 단독 사용, 외부 노출 0                                     |
| 035 | PBKDF2 100k baseline, OWASP 미달          | MEDIUM — production user가 본격 사용자 단계 진입 직전까지 미루어야 함 |
| 036 | cookie SameSite='None' cross-origin       | LOW — Origin allowlist + httpOnly 다층 방어                           |

### 중기 (Phase 3 진입까지 carry-over chain)

3 ADR 모두 "Phase 3 launch 직전 복원" 명시. carry-over chain 영속 메커니즘:

1. memory `project_launch_legal_bundle_deferred.md` chain 동기
2. 각 ADR §"복원 의무" 체크리스트 보유
3. 다음 session entry handoff-074 §주의사항에 명시

**그러나 silent drift 위험**:

- ADR-005 본문 미갱신 → 미래 누군가 ADR-005를 직접 읽으면 supersedes 인지 불가 (CRIT-1)
- dummy-verify.ts 주석 잔존 → 미래 dummy hash 재생성 시 600k 가정 코드 작성 위험 (CRIT-2)
- 테스트 fixture 600000 잔존 → MAJ-2 — silent drift carry-over

### 장기 (Phase 3 launch 후 본격 production)

복원 의무 PASS 시 모두 강력한 보안 baseline 복원 (PASSWORD_MIN_LENGTH 8 + HIBP + PBKDF2 Argon2id + SameSite Strict). 그러나 복원 자체에 **추가 마이그레이션 + redeploy + user re-hash** 비용 발생:

1. ADR-035 §"복원 의무" L50 "기존 평가 환경 user (PBKDF2 100k stored) 일괄 re-hash 마이그레이션" — Argon2id WASM 도입 또는 PBKDF2 → bcrypt rotation 정책 필요
2. ADR-034 §"복원 의무" L45 "4자리 password 일괄 reset 또는 grandfather clause" — 운영 결정 영역
3. ADR-036 §"복원 의무" L60 "custom domain 적용" — DNS + 인증서 + Cloudflare Pages/Workers 도메인 통합

→ Phase 3 launch는 단순 "기능 추가"가 아닌 **보안 정책 회복 sprint** 의무. 1주 carry-over (memory `project_launch_legal_bundle_deferred.md`) 합리적이나, 추가 시간 예비 필요.

### 누적 supersedes chain 시스템 영향

ADR 본 프로젝트 누적 36건. 그 중 supersedes chain:

- ADR-035 supersedes part of ADR-005
- ADR-036 supersedes part of ADR-005 §Addendum
- ADR-034 supersedes part of ADR-005 (password 길이) + ADR-008 (HIBP)

→ ADR-005 가 3 ADR의 supersedes source. 본 review CRIT-1 미해소 시 ADR-005 본문이 "single source of truth"라는 ADR 작성 원칙 위반 — 신규 세션은 supersedes chain 추적을 위해 36 ADR 전체를 grep 필요 = O(n²) 복잡도.

### 권고 ranking

1. **즉시**: CRIT-PASS2-1 (ADR-005 헤더 supersedes 표기) — 30분 작업, 미래 silent regression 차단
2. **즉시**: CRIT-PASS2-2 (dummy-verify.ts 주석 600,000 → 100,000) — 10분 작업, invariant drift 차단
3. **Phase 2 종착 전**: MAJ-PASS2-1 (0028 idempotency `IF NOT EXISTS` 추가) — 5분
4. **Phase 2 종착 전**: MAJ-PASS2-3 (ADR-005 변경 이력 line + Supersedes/Superseded-by field) — 10분
5. **Phase 3 launch 전**: ADR-035 §"복원 의무" 6항목 + ADR-034 §"복원 의무" 6항목 + ADR-036 §"복원 의무" 5항목 모두 PASS
6. **carry-over (Sprint 2+)**: MAJ-PASS2-2 (fixture 600000 → 100000), MAJ-PASS2-4 (TD-API-001 readdir 통합), MIN-PASS2-1~5

---

## 판정

**수정 필요** — 본 step "완료" 선언 전 최소 다음 2건 해소 의무:

1. **CRIT-PASS2-1 ADR-005 본문 supersedes 표기** (단방향 supersedes chain 차단 — silent regression risk)
2. **CRIT-PASS2-2 dummy-verify.ts 주석 갱신** (invariant drift 차단)

MAJ 4건은 본 step 영속 가능 (TD ledger 등록 시), MIN 5건은 모두 carry-over OK.

**Phase 2 Eval MVP Step 5 G9 PASS 자체는 architectural 정합** — 진산 단독 평가 환경에서 silent drift는 즉시 영향 0. 그러나 Phase 3 launch 직전 carry-over chain이 silent drift에 압도당하지 않도록 본 review 출력을 다음 session entry handoff에 명시 의무.

---

**작성자**: Pass 2 Architect 독립 리뷰어 (Claude Opus 4.7 1M context)
**파일 경로**: `/home/soo/ClaudePro/ThePick/.claude/reviews/review-20260511-111048-phase2-eval-mvp-pass2-architect.md`
**검증 데이터**: 26 changed files + ADR-005/034/035/036 + 9 연관 modules (password.ts, dummy-verify.ts, scenarios.test.ts, study/**tests**/routes.test.ts, progress/**tests**/routes.test.ts, 0007/0028 migrations, 0001-0019 schema, docs/architecture/)
