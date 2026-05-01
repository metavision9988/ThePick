# Phase 1 종료 5-페르소나 (3/5) — quality-engineer

**리뷰 대상**: Phase 1 종료 (Step 19 = Engine Hardening 마지막 게이트)
**관점**: 테스트 부채 + 프로덕션 엣지 케이스 + 회귀 위험
**리뷰어**: quality-engineer (독립 서브에이전트)
**일시**: 2026-05-01 15:59:03 KST
**4-Pass MAJOR 6건 흡수 완료 — 본 리뷰는 중복 지적 금지 (테스트 부채 관점만)**

---

## 핵심 질문

> **"프로덕션에서 뭐가 물릴까?"**

프로덕션에서 BATCH-1~5 적재 + Reviewer 큐 + 30초 폴링 + 24시간 운영 시 어떤 시나리오에서
무음으로 깨질 수 있는가? 본 step 의 신규 production 코드 / 테스트 커버리지 갭 / 미관측 회귀 경로를
파일:라인 증거로 식별한다.

---

## 0. 리뷰 범위 + 검증한 항목

### 검증한 파일 (실제로 읽은 것 — N/A 와 PASS 구분 의무)

- **신규 production**: `apps/api/src/telemetry/{types,admin-token,write-helper,routes}.ts` (4 파일, ~22KB)
- **신규 마이그레이션**: `migrations/0017_engine_telemetry.sql` (134 lines)
- **신규 admin-web**: `apps/admin-web/src/components/TelemetryDashboard.tsx` (393 lines)
- **신규 테스트**: `apps/api/src/telemetry/__tests__/routes.test.ts` (28 tests, 328 lines)
- **테스트 헬퍼**: `apps/api/src/__tests__/helpers/d1-from-sqlite.ts` (200 lines)
- **품질 체크리스트**: `docs/quality/master-test-checklist.md` v2 (360 lines)
- **CI 통합**: `.github/workflows/ci.yml` `Verify engine contracts` step
- **batch logger 흡수**: `apps/batch/src/cost-meter.ts` (확인됨 logger.record 도입)

### 4-Pass 흡수 6건 (중복 지적 금지 영역)

본 리뷰는 4-Pass MAJOR 흡수 결과를 사전 인지하여 다음 영역 지적 금지:

- POST/GET examId optional query (MAJOR-A1)
- engine_telemetry FK 의도적 부재 (MAJOR-A2)
- logger.child() 패턴 + recover 흡수 (MINOR-A1)
- cost-meter.ts logger 흡수 (MINOR-3A)
- master-dashboard.md alarm rule (MINOR-A2)
- ENGINE_TELEMETRY_GAUGES 카운트 검증 (MAJOR-A1 후속)

**본 리뷰의 독립 관점**: 위 6건이 모두 흡수되었어도 **테스트 커버리지 갭 / 엣지 케이스 누락 /
회귀 위험**은 해결되지 않는다 — 그것을 증거로 식별한다.

---

## 1. CRITICAL

### CRIT-Q1 — admin-web 테스트 인프라 0건 (TelemetryDashboard.tsx 393 lines 미검증)

**증거**:

- `apps/admin-web/package.json` scripts 섹션: `dev / build / lint / typecheck` 만 존재. `test` 스크립트 부재.
- `devDependencies`: `vitest`, `@testing-library/react`, `@testing-library/jest-dom` 모두 미설치.
- `find apps/admin-web -name "*.test.*" -o -name "*.spec.*"` → 0건.
- `apps/admin-web/src/components/TelemetryDashboard.tsx` 393 lines:
  - 4 FetchState (`idle | loading | success | unauthorized | error`)
  - 30초 폴링 (line 273~278 `useEffect`)
  - localStorage token IO (line 31-42)
  - 401 응답 시 token clear + state reset (line 236-246)
  - JSON.stringify metric_json (line 143)
  - 8 게이지 sort by ENGINE_TELEMETRY_GAUGES.indexOf (line 293-296)

**프로덕션 리스크**:

1. **Token clear race**: 사용자가 Logout 클릭 시점에 in-flight `fetch` 응답이 도착 → setState 가
   `null` token 상태에서 success 로 전환 → "logged out 인데 데이터 보임" UI 깨짐.
2. **30s polling unmount leak**: 컴포넌트 unmount 직전 setInterval 발사 → 사라진 컴포넌트에
   setState → React 18 strict mode 경고. `useEffect` cleanup 은 있으나 in-flight Promise
   취소 없음 (AbortController 부재).
3. **localStorage 동시성**: 두 탭에서 동시 사용 시 한 탭 Logout → 다른 탭은 30초까지 stale token
   사용 → 401 → 재로그인 강요. `storage` 이벤트 리스너 없음.
4. **JSON.stringify(metric_json, null, 2)** (line 143): metric_json 이 비-object 손상 데이터일 때
   `routes.ts:84` 에서 null 마스크되어 안전하지만, **마스크 발생률 자체를 추적 안 함** —
   프로덕션에서 손상 데이터 발생 시 무음 (Cat 8 출력 검증 정합 위배).

**권고**:

- **Phase 2 진입 게이트로 admin-web vitest 도입 의무화** (Cat 1.1 admin-web 0 tests → ≥10 tests).
- `AbortController` 도입 (fetchDashboard 내부 + cleanup 시 abort()).
- TokenForm + TelemetryDashboard 렌더 + 401 → unauthorized 전이 + Logout 흐름 최소 5 tests.
- `master-test-checklist.md` Cat 1.1 에 `@thepick/admin-web` 행 추가 (현재 부재).

**판정**: CRITICAL — 393 line 신규 React 컴포넌트가 하나의 단위 테스트 없이 admin 운영 channel
을 담당. 진산님 관측 실수 1건 = 게이지 알람 무관측 = BATCH 비용 오버런 가능.

---

### CRIT-Q2 — write-helper.ts 단위 테스트 부재 (64KB throw / circular ref / cause unwrap 미검증)

**증거**:

- `apps/api/src/telemetry/__tests__/` 디렉토리: `routes.test.ts` 1개 파일만.
- `find apps/api/src/telemetry -name "write-helper*.test.ts"` → 0건.
- `write-helper.ts` 의 검증 안 된 경로:
  - **Line 56**: `throw new TelemetryWriteError('metricJson serialization failed', err)` — JSON.stringify circular reference 발생 시. 테스트 0건.
  - **Line 58-63**: `metricJsonText.length > 64 * 1024` throw — 64KB 초과 페이로드. 테스트 0건.
  - **Line 81-83**: `if (!result) throw` — D1 RETURNING 누락 시 (드라이버 버그). 테스트 0건.
  - **Line 95-102**: D1 INSERT throw → logger.error → TelemetryWriteError wrap. cause unwrap 안 됨 검증 0건.
  - **Line 47**: `assertValidExamId` 두 번째 차단 (Zod refine 우회 시) — Hard Rule 17 다층 방어. routes.test.ts 의 Zod refine 테스트는 첫 번째 layer 만 검증.

**프로덕션 리스크**:

1. **Circular reference**: BATCH 적재 중 `metricJson: { ...node, _parent: parentNode }` 처럼
   순환 참조가 무심코 들어가면 `JSON.stringify` throw → caller 503 응답 → BATCH halt.
   현 routes.test.ts 는 `{ test: true, gauge }` 단순 object 만 사용.
2. **64KB 경계**: BATCH-1 5장 적재 시 graph_integrity 게이지에 violation_details 가 1만건이면
   metricJson 이 100KB 초과 가능 → throw → telemetry 적재 자체 실패 → 게이지 무관측. 테스트 부재.
3. **D1 INSERT 실패**: 503 + Retry-After=5 응답하지만 retry 로직은 caller 책임. 호출 측
   (cost-meter / batch pipeline) retry 정책 검증 0건.

**권고**:

- `apps/api/src/telemetry/__tests__/write-helper.test.ts` 신규 — 최소 8 tests:
  - circular ref `const a = {}; a.self = a;` → throw `TelemetryWriteError 'metricJson serialization failed'`
  - 64KB exact (65536) → PASS / 65537 → throw
  - assertValidExamId 우회 시도 (raw bind) → throw
  - generateId 주입 결정성 (테스트 결정성 hooks)
  - D1 mock throw → TelemetryWriteError wrap + cause 보존
  - metricValue=0 vs metricValue=undefined 구분 (line 66)
  - sourceId / batchRunId null 매핑

**판정**: CRITICAL — write-helper 는 telemetry write hot path. 8 게이지 모두 본 함수 경유.
3 throw 경로 모두 테스트 0건 = 프로덕션 첫 발생 = no debugging breadcrumb.

---

### CRIT-Q3 — append-only 트리거 error message regex fragile (SQLite 버전 회귀)

**증거**:

- `routes.test.ts:312`, `:325`: `expect(...).toThrow(/forbidden|append-only/i)`.
- `migrations/0017_engine_telemetry.sql:115`:
  ```
  RAISE(ABORT, 'UPDATE on engine_telemetry is forbidden (append-only fact table). Use INSERT for new readings. Phase 2 retention policy via wrangler d1 execute manual override only.')
  ```
- 정규식 `/forbidden|append-only/i` 는 메시지 본문 일부 매칭. SQLite 가 RAISE 메시지를 wrap 시
  `SQLITE_CONSTRAINT_TRIGGER: ` prefix 추가하나, `forbidden` 키워드는 본문 그대로 통과.
- **그러나 메시지 본문이 "forbidden" 키워드 없이 변경되면 (예: `prohibited` / `not allowed`) 모든
  테스트가 회귀 통과** — 마이그레이션 텍스트와 정규식이 동기화되지 않음.

**프로덕션 리스크**:

- 진산님이 마이그레이션 메시지를 수정 (예: 영어 → 한국어 + 운영 가이드 링크 추가) 시
  정규식이 `forbidden|append-only` 둘 다 미매칭 → 테스트가 throw 메시지 부재 시에도 PASS.
- Step 16c MINOR-PA1-m1 (정규식 SQLite 버전 fragile) 이미 식별 — **본 step 동일 패턴 재발**.
- D1 production 환경에서 SQLite 버전 업그레이드 시 RAISE 포맷 변경 가능 (SQLite 3.45+).

**권고**:

- `expect(() => ...).toThrow(TypeError)` 식 클래스 매칭 도입 불가능 (RAISE 는 generic Error).
- 대안: 마이그레이션 SQL 의 message 상수를 코드로 추출 (e.g., `apps/api/src/telemetry/error-messages.ts`)
  - 마이그레이션 SQL 생성 시점 검증 (또는 grep 비교 스크립트).
- 최소: `/UPDATE on engine_telemetry is forbidden \(append-only fact table\)/` 처럼 정확 매칭 정규식 사용.
- master-test-checklist Cat 6 에 "Trigger message 정규식 정확 매칭" 추가.

**판정**: CRITICAL — 회귀 무음 차단 의무. 트리거 메시지가 1년 후 한국어 가이드로 바뀌면 테스트는
의미 없이 PASS 하면서 진짜 RAISE 동작 회귀를 미감지.

---

## 2. MAJOR

### MAJ-Q1 — 동시성 / 부하 테스트 0건 (UUID 충돌 + INSERT 경합)

**증거**:

- `routes.test.ts` 28 tests 중 **모든 tests 가 직렬 (sequential)** — `Promise.all` 사용 0건.
- write-helper.ts:49 `crypto.randomUUID()` v4 — **충돌 확률 1/2^122 이지만 검증 0건**.
- BATCH-1~5 적재 시점에 cost-meter / pipeline / quality / formula-engine 4 모듈이
  **동시 telemetry write 발생** (각 모듈이 비동기로 1초당 수십~수백건 INSERT).

**프로덕션 리스크**:

1. **D1 동시 INSERT 시 PRIMARY KEY 충돌**: UUID v4 무작위 충돌 사실상 0이지만, **mock generateId
   주입 시 (테스트 시점)** 결정성 위반 검증 0건.
2. **8 게이지 동시 INSERT 시 dashboard 쿼리** (`/dashboard` 16 sequential queries)
   read 와 write race 시 latest 가 stale 가능. master-test-checklist Cat 5 (성능) 가 Phase 2
   deferred 라 본 step 책임 아니지만, **boolean 검증 (race 시 RETURNING 정합성) 은 Cat 1
   범위**.
3. **Promise.all 100 telemetry INSERT** 시 D1 connection pool 부하 검증 0건. Workers 환경에서
   D1 동시 접속 한도 기본 6 connections — exceed 시 503.

**권고**:

- `routes.test.ts` 끝에 `describe('동시성')` 추가:
  - `await Promise.all(Array.from({length: 100}, () => authedPost({...})))` → 모두 201 + UUID 100건 unique 검증.
  - 동시 INSERT + GET /dashboard 2회 race → latest stale 1회 이내 허용 (eventual consistency).
- 단위 테스트 (write-helper) 에서 generateId 충돌 시뮬레이션 (`generateId: () => 'fixed-id'`) → 두 번째 INSERT D1 PK 위반 → wrap 정합성 검증.

**판정**: MAJOR — 8 게이지 × 4 모듈 동시 write 가 BATCH 적재 hot path. 직렬 테스트만으로는
프로덕션 race 검증 불가.

---

### MAJ-Q2 — Property-based testing 비율 불균형 (telemetry / quality / batch / api 0건)

**증거**:

- formula-engine: `sandbox-bypass.property.test.ts` 1 파일 (11 fc.assert 호출)
- parser: `determinism.property.test.ts` 1 파일 (2 fc.property)
- **quality**: 0 property tests (41 tests 모두 example-based)
- **batch**: 0 property tests (236 tests 모두 example-based)
- **apps/api**: 0 property tests (227 tests 모두 example-based)
- **telemetry**: 0 property tests (28 tests 모두 example-based — fuzz 0건)

**프로덕션 리스크**:

- master-test-checklist Cat 1.2 "multi-byte / 매우 긴 input (UTF-8 1000자 이상)" 미체크 (line 69).
- **Mulberry32 PRNG 결정성** (project memory 에 명시) — quality 41 tests 가 invariant_fields 만
  검증, fuzzing 부재 → seed 100~10000 범위 외 시나리오 미검증.
- Telemetry fuzz: `metricValue: fc.double()` × `gaugeName: fc.constantFrom(...8게이지)` ×
  `metricJson: fc.dictionary(...)` 조합으로 100+ 시나리오 자동 생성 가능 — 적용 0건.
- examId Hard Rule 17 우회 시도 — fc.string() × fc.constantFrom 조합으로 brand type 우회 경로
  탐색 가능, 적용 0건.

**권고**:

- Phase 2 초기 ToDo 로 명시 (Step 21 또는 별도 mini-step):
  - quality property tests +5 (Mulberry32 distribution 검증, normalizer cross-input determinism)
  - telemetry property tests +3 (Zod boundary fuzzing, examId 무작위 입력)
  - batch property tests +3 (cost-meter SLO threshold 경계)
- `master-test-checklist` Cat 1 에 "property test 카운트" 신규 numeric 지표 추가.

**판정**: MAJOR — Phase 1 종료 시점에 property test 가 2 패키지 만, 6 패키지 0건. 본 step 흡수
필요 없으나 Phase 2 진입 게이트 의무.

---

### MAJ-Q3 — Golden Test 누락 (Cat 6 BATCH-1 deferred 의 위험 명시 부재)

**증거**:

- `master-test-checklist.md` §6.1:
  - [x] Formula Engine 산식 정확도 100% (251 tests PASS)
  - [ ] **기출 파서 ↔ 공식 정답 100%** (BATCH-1~5 적재 후 검증)
  - [ ] **Constants 추출 0건 오류** (BATCH-1 적재 후 인간 검수)
  - [ ] **암기법 역방향 검증** (BATCH-1 mnemonic 생성 후)
- `master-test-checklist.md:347` 에서 `[x] BATCH-1 fixture 재실행 → seed 고정 시 동일 D1 INSERT
결과` 라고 표기되었으나, **BATCH-1 fixture 가 실제로 적재된 적 없음** — Step 19 종료 시점에
  fixture 만 존재.

**프로덕션 리스크**:

- BATCH-1 적재 후 정답 1건이라도 불일치 시 (project memory `project_source_citation_requirement`
  Hard Stop 조건) — 본 마스터 체크리스트 v2 가 그것을 사전 차단할 자동 게이트가 없다.
- 손해평가사 시험 정답 100% 의무 (CLAUDE.md "정답 안전: OX/빈칸/변형 문제의 정답이 100%
  정확한가 (Hard Stop 조건)") — 미검증 상태에서 Cat 6 PASS 표기는 위험.
- Cat 6 numeric 표 (line 191-195): `Constants 추출 정확도 (BATCH-1 후) | TBD | manual_check` —
  TBD 자체가 게이트 우회. PASS 조건 부재.

**권고**:

- `master-test-checklist.md:184~186` 행 하단에 "BATCH-1 진입 차단 게이트 / 자동 검증 부재 시 Cat 6
  PASS 선언 금지" 명시.
- §13 line 347 `BATCH-1 fixture 재실행` 항목을 `[~]` (부분 PASS — fixture 존재 + seed 결정성
  invariant_fields PASS / 적재 자체는 BATCH-1 진입 시 검증) 으로 명확화.
- §6.2 numeric 표 `Constants 추출 정확도` PASS 기준에 "BATCH-1 후 1건 불일치 = FAIL +
  진입 차단" 추가.

**판정**: MAJOR — Phase 1 종료 표기가 Cat 6 의 50% (4/8 항목) 미검증 상태에서 PASS 표기. 진산님
보고 시 "✅ Cat 6 PASS" 가 오해 유발 가능.

---

### MAJ-Q4 — admin-token timing-safe equal 측정 부재 + MIN_TOKEN_LENGTH 16 근거 미문서화

**증거**:

- `admin-token.ts:28-35` `timingSafeEqual` 함수:
  ```
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
  ```
- routes.test.ts:84-122 `admin-token 게이트` 4 tests — **timing 측정 0건**.
- **`a.length !== b.length` 즉시 return** 은 timing leak 가능 (길이 차이 → 시간 차이).
  주석 line 27-29 자체도 `MIN_TOKEN_LENGTH 강제로 < 16 차단` 으로 완화한다고 명시 — **16 의 근거
  미문서화**.

**프로덕션 리스크**:

1. 길이 비교 단축 회로 → timing side-channel 으로 token 길이 추정 가능. 16자 이상이면 brute force
   비현실적이라는 가정 — 검증 없음.
2. Web Crypto `crypto.subtle.timingSafeEqual` (Node.js `crypto.timingSafeEqual`) 사용 안 함 —
   주석은 "토큰 길이가 작아 native loop 충분" 이라 정당화하나, **벤치 0건**.
3. `MIN_TOKEN_LENGTH = 16` (line 21) 근거: 16 문자 = 96 bits entropy (assuming alphanumeric) →
   2^96 brute force 비현실적. 그러나 ADR / 주석에 명시 0건.

**권고**:

- 단위 테스트 `admin-token.test.ts` 신규:
  - `timingSafeEqual('abc', 'abd')` → false (3 char compare)
  - `timingSafeEqual('abc', 'abcd')` → false (early length exit)
  - `timingSafeEqual('a'.repeat(32), 'a'.repeat(32))` → true
- `admin-token.ts:21` MIN_TOKEN_LENGTH 주석에 `근거: 16자 alphanumeric ≈ 96 bit entropy, brute force 2^96` 추가.
- Phase 2 Cloudflare Access 도입 시점에 본 미들웨어 제거 plan 필수 (현 주석 line 4 "Cloudflare
  Access 정책 등록 후 별도 ADR + 본 미들웨어 제거 의무" 명시 양호).

**판정**: MAJOR — Phase 1 임시 인증의 보안 가정이 검증 0건. 16자 가정이 깨지면 (예: 운영자가
실수로 8자 토큰 환경변수 설정) 401 마스크 (line 47-48) 로 운영 실수 알림 0건.

---

### MAJ-Q5 — 마이그레이션 롤백 (DROP TRIGGER + DROP TABLE) 동작 검증 0건

**증거**:

- `migrations/0017_engine_telemetry.sql:127-133` 롤백 SQL 주석 처리:
  ```
  -- DROP TRIGGER IF EXISTS prevent_engine_telemetry_delete;
  -- DROP TRIGGER IF EXISTS prevent_engine_telemetry_update;
  -- DROP INDEX IF EXISTS idx_engine_telemetry_batch_run;
  ...
  -- DROP TABLE IF EXISTS engine_telemetry;
  ```
- `routes.test.ts` 와 `apps/api/src/__tests__/scenarios.test.ts` 모두 롤백 시나리오 0건.
- production D1 에서 본 마이그레이션을 비상 시 롤백 시 **순서 의존성**:
  1. DROP TRIGGER (UPDATE/DELETE 차단 해제 — RAISE(ABORT) 자체에 영향 없음)
  2. DROP INDEX (3개 — 순서 무관)
  3. DROP TABLE (CASCADE 없음 — FK 부재라 안전)

**프로덕션 리스크**:

- 진산님이 비상 시 본 SQL 을 주석 해제 → 실행 → 부분 실패 (예: TRIGGER drop 후 INDEX drop 실패) →
  부분 상태 진입 → 다음 마이그레이션 (0018?) 적용 시 충돌.
- `wrangler d1 execute` 트랜잭션 단위 미보장 (Cloudflare D1 multi-statement transaction 제약).

**권고**:

- 별도 마이그레이션 `0017a_rollback_engine_telemetry.sql` 작성 (BEGIN; ... COMMIT; 트랜잭션) +
  test scenario 1건 추가:
  - migration 적용 → INSERT → rollback migration 적용 → engine_telemetry 부재 확인.
- Phase 2 GC 정책 (1년 보존) 도입 시점에 트리거 일시 비활성화 ↔ 활성화 절차도 별도 마이그레이션으로
  분리.

**판정**: MAJOR — 비상 롤백은 새벽 3시 시나리오의 전형. 동작 검증 0건 = on-call 실패.

---

### MAJ-Q6 — JSON.parse 손상 데이터 silent mask + 발생률 추적 부재

**증거**:

- `routes.ts:75-87` `rowToEvent`:
  ```
  if (row.metric_json !== null) {
    try {
      const parsed = JSON.parse(row.metric_json) as unknown;
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        metricJson = parsed as Record<string, unknown>;
      }
      // 비-object 값은 손상 데이터 — null 로 마스크 (UI 깨짐 방어)
    } catch {
      // 파싱 실패도 null 로 마스크. 원본은 추후 admin-web "raw view" 에서 노출 가능 (Phase 2).
    }
  }
  ```
- 빈 catch (line 84-86) — 본 프로젝트 CLAUDE.md "빈 catch 금지" 규칙 정합 위배.
- `master-test-checklist` Cat 8 (출력 검증) 가 LLM 통합 후 deferred 라 본 step 책임 아니나,
  **Cat 7 (보안) 의 `D1 prepared statement 의무` 와 동일 파일 안에 silent mask 가 공존** — 이중 표준.

**프로덕션 리스크**:

1. D1 의 metric_json TEXT 컬럼이 손상 (예: 인코딩 깨짐, 부분 INSERT) 시 dashboard read 가
   조용히 null 마스크 → 진산님은 게이지 데이터가 부재하다고 인지, 실제로는 storage corruption 진행 중.
2. write-helper:54 의 JSON.stringify 결정적 INSERT 와 routes:79 의 JSON.parse 비결정적 read 비대칭.
3. 손상 발생률을 텔레메트리 자기 자신으로 측정해야 하나 (재귀 — 손상 추적도 손상 가능) 별도 채널 필요.

**권고**:

- 빈 catch 를 `logger.warn('metric_json corrupted', { id: row.id, gauge: row.gauge_name })` 로 교체.
- Phase 2 진입 시점에 `engine_telemetry` 옆에 `engine_telemetry_corruption_log` 별도 fact table 추가
  (1줄 row — 발견 시점/노드 ID 만).
- master-dashboard.md alarm rule 에 "JSON.parse 손상 발견 시 즉시 alert" 추가.

**판정**: MAJOR — 본 프로젝트 "빈 catch 0건" 규칙 직접 위반 + 손상 데이터 silent mask 는 Cat 8
의무 정합 위배.

---

## 3. MINOR

### MIN-Q1 — SCENARIO_MIGRATIONS 리스트 0013-0017 미포함 (다른 시나리오 테스트 영향)

**증거**:

- `apps/api/src/__tests__/helpers/d1-from-sqlite.ts:35-49` `SCENARIO_MIGRATIONS` 배열 → 0001~0012 (12개).
- 0013_active_view_and_review_decisions / 0014_phase05_critical_hardening / 0015_batch_runs /
  0016_knowledge_nodes_batch_idempotency / 0017_engine_telemetry **미포함**.
- 본 step 의 telemetry routes.test.ts:43 는 `createD1FromAllMigrations()` (line 86-91) 사용 — 17개
  전체 로드 → 본 테스트는 영향 없음.
- 그러나 `apps/api/src/__tests__/scenarios.test.ts` 가 `createD1FromSqlite()` (default 인자) 사용
  시 0013-0017 트리거 / 인덱스 부재 환경에서 시나리오 검증 → 회귀 무관측 가능.

**권고**: SCENARIO_MIGRATIONS 에 13~17 추가 또는 제거하고 default 를 createD1FromAllMigrations 로 변경.
**판정**: MINOR — 본 step 영향 없으나 Step 13~17 전반 시나리오 회귀 갭. Phase 2 트래킹 부채.

---

### MIN-Q2 — CI artifact retention-days: 30 (handoff 컨텍스트 90일 mismatch)

**증거**:

- `.github/workflows/ci.yml:80` `retention-days: 30`.
- 본 step 컨텍스트 message 에 "JSON artifact 보존 정책 (90일?)" 명시.
- master-test-checklist §9 / 0015_batch_runs 보존 정책과 별도 — engine-contracts-report.json 은
  CI artifact (Step 18 도입) 관련.

**권고**: 30일 vs 90일 명시 ADR. 30일이면 분기 1회 phase 후행 분석에 부족 가능.
**판정**: MINOR — 운영 정책 결정사항. Phase 2 까지 보류 가능.

---

### MIN-Q3 — TelemetryDashboard.tsx ENGINE_TELEMETRY_GAUGES.indexOf O(n²) sort

**증거**:

- `TelemetryDashboard.tsx:293-296`:
  ```
  [...state.data.gauges].sort(
    (a, b) => ENGINE_TELEMETRY_GAUGES.indexOf(a.gauge) - ENGINE_TELEMETRY_GAUGES.indexOf(b.gauge),
  )
  ```
- 8 게이지 × 8 비교 = 64 indexOf 호출 — 성능 영향 0이지만 패턴이 stale.

**권고**: `Map<EngineTelemetryGauge, number>` 사전 생성 후 sort. 또는 서버 측 정렬 보장.
**판정**: MINOR — 8 게이지 한정이라 성능 OK. 코드 품질 부채.

---

### MIN-Q4 — metricValue: 0 vs undefined 구분 테스트 부재

**증거**:

- `write-helper.ts:66`: `const metricValue = payload.metricValue ?? null;`
- `?? null` 연산은 `0` 입력 시 0 유지, `undefined` 입력 시 null. 의도적이나 테스트 0건.
- `routes.test.ts:184` `metricValue: 0.5` 만 사용 — 0 / -0 / Number.MIN_VALUE 미검증.
- Cat 1.2 boolean "경계값 (0 / 1 / MAX_SAFE_INTEGER / NaN / Infinity)" formula-engine PASS 표기 —
  telemetry write-helper 미적용.

**권고**: write-helper.test.ts 에 `[0, -0, Number.MIN_VALUE, Number.MAX_VALUE]` × 8 게이지 = 32 tests.
**판정**: MINOR — 4-Pass MAJOR 흡수에서 NaN 만 다룸 (z.finite()). 0 경계 누락.

---

### MIN-Q5 — vitest stdout 다중 JSON 파싱 부채 (handoff §6 MINOR-S2 재확인)

**증거**:

- handoff-026 §6 MINOR-S2 — Phase 2 트래킹.
- `scripts/verify-engine-contracts.ts` 가 vitest stdout multi-JSON 파싱 시 fragile.
- 본 step 신규 검증 부재 (master-test-checklist v2 §12.2 에 명시).

**권고**: Phase 2 진입 시 `--outputFile` 전환 의무.
**판정**: MINOR — 알려진 부채. 본 step 영향 없음.

---

## 4. Devil's Advocate (반론 의무)

### 시나리오: "프로덕션 새벽 3시, BATCH-3 적재 중 telemetry write 실패율 급등"

**상황 가정**:

- 진산님 BATCH-3 적재 트리거 (cost-meter / pipeline / quality / formula-engine 4 모듈 동시).
- 본 step 의 telemetry POST endpoint 는 **227 tests PASS + Cat 1~7 PASS** 상태로 production deploy.
- 02:47 시점에 graph_integrity 게이지에 `metricJson: { violations: [{...}, {...}, ... 1만건]}`
  적재 시도 → JSON.stringify 결과 100KB → write-helper:58 throw `metricJson too large` →
  routes.ts:140 503 응답 → caller (quality 모듈) 가 retry 안 함 → graph_integrity 게이지 무관측.

**현 시점 무관측**:

1. write-helper:58 throw 경로 단위 테스트 0건 (CRIT-Q2). 진산님은 503 응답이 발생한다는 것 자체를
   사전 인지 0%.
2. dashboard 의 graph_integrity 카드는 `latest: null` → status `no_data` 표시 → 진산님은
   "데이터 부재" 라고 인지 (정상 상태 평가). **실제로는 telemetry write 실패가 누적**.
3. routes.ts:206 logger.error 는 발생하지만, log destination (Workers Analytics) 역시 별도 telemetry
   체계 — 본 step 알람 rule 이 3시 새벽에 진산님에게 도달하지 않음 (master-dashboard.md alarm rule
   v1 은 admin-web 폴링 의존, 진산님 잠든 상태).
4. 24시간 지속 시 quality 모듈 자체가 violations 누적 → 다음 BATCH-4 적재 시 graph_integrity
   재계산이 stale 데이터 기반.

**3가지 다른 깨질 시나리오**:

1. **localStorage token 만료 race**: 진산님이 다른 탭에서 30분 전 token 입력 → 본 탭에서 5분 전
   입력 → 30초 폴링 중 첫 탭이 401 받음 → clearToken → 본 탭은 storage 이벤트 미수신 → 30초 후
   stale token 으로 401 → 두 탭 동시 로그아웃 → 진산님 혼란.

2. **D1 latency spike (p95 500ms → 5s)**: dashboard /dashboard 16 sequential queries × 5s = 80s →
   Workers CPU 50ms 초과 → 503. 본 시나리오 단위 테스트 0건 — 4-Pass MAJOR 흡수 후 UNION ALL 단일
   쿼리 최적화는 Phase 2 트래킹 (routes.ts:224 명시).

3. **마이그레이션 0018 적용 시 SCENARIO_MIGRATIONS 갱신 누락 (MIN-Q1 재확인)**: 진산님이 0018
   배포 → 본 step 의 routes.test.ts 는 createD1FromAllMigrations 라 양호하나, 다른 scenarios.test.ts
   는 SCENARIO_MIGRATIONS 정적 리스트 → 0018 의 새 트리거 미포함 → 회귀 무관측.

---

## 5. 판정

| 분류     | 카운트 | 핵심 항목                                                                                                                                               |
| :------- | :----: | :------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CRITICAL | **3**  | admin-web 테스트 0건 (Q1) / write-helper 단위 테스트 0건 (Q2) / 트리거 정규식 fragile (Q3)                                                              |
| MAJOR    | **6**  | 동시성 0건 (Q1) / property test 0건 (Q2) / Golden Test deferred PASS 표기 (Q3) / timing-safe 미검증 (Q4) / 롤백 미검증 (Q5) / silent mask 빈 catch (Q6) |
| MINOR    | **5**  | SCENARIO_MIGRATIONS / CI retention 30일 / O(n²) sort / metricValue 0 경계 / vitest stdout                                                               |

**결론**: **CRITICAL 3건 — Engine Hardening 완료 게이트 미통과**.

진산님 메모리 `project_completion_notification_obligation` (기술 부채 0 정책 + 종합 테스트
마스터 체크리스트 PASS 의무) 정합 위배. 본 5-페르소나 quality-engineer 는 다음 3건 흡수 전
**★★★ ENGINE HARDENING 완료 ★★★ 게이트 통과 거부**.

### 흡수 의무 (본 step / 차세션)

**본 step 즉시 흡수 (CRITICAL)**:

- CRIT-Q3 트리거 정규식 정확 매칭 (1줄 변경, 5분 작업)
- CRIT-Q2 write-helper.test.ts 신규 (8 tests, 2시간 작업)

**차세션 의무 (1주 이내)**:

- CRIT-Q1 admin-web vitest 도입 + TelemetryDashboard 5 tests (Cat 1.1 admin-web 행 추가).

**Phase 2 진입 게이트 의무 (이월 가능)**:

- MAJ-Q1 동시성 / MAJ-Q2 property tests / MAJ-Q3 Golden Test / MAJ-Q4 timing 검증 / MAJ-Q5
  롤백 / MAJ-Q6 silent mask 모두 Phase 2 초기 mini-step 으로 명시 이월.

### Devil's Advocate 반론에 대한 자기 검증

본 리뷰가 과도하게 보수적인가? — **그렇지 않다**. 본 service 는 손해평가사 자격시험 (project memory
`project_vision_mvp_generalization` 합격률 60% 목표 + 정답 100% 정확도). 텔레메트리 무관측 = BATCH
비용 오버런 + 게이지 알람 무발화 = on-call 실패. 본 3 CRITICAL 흡수는 1일 작업 분량으로, "기술 부채 0"
정책 정합.

---

## 결과 파일 경로

`/home/soo/ClaudePro/ThePick/.claude/reviews/phase1-tech-debt-20260501-155903-quality.md`

---

**리뷰어**: Claude (Opus 4.7) quality-engineer 페르소나 (독립 서브에이전트)
**4-Pass 6건 흡수 정합**: 본 리뷰 신규 지적 14건 모두 4-Pass MAJOR 와 중복 0건 검증 완료
**증거 기반 보고**: 모든 항목 파일:라인 인용 + Devil's Advocate 1개 시나리오 + 3개 부속 시나리오
