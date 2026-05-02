## 4-PASS REVIEW (Pass 3 + 4) — telemetry-client wire-up (Step 037 CRITICAL-DO-S1-1)

**리뷰 일시**: 2026-05-02
**리뷰 방식**: 독립 에이전트 (Opus 4.7 1M, code-reviewer 역할). 코드 작성 컨텍스트 0건 진입. 본 메시지 내 직전 요약/판단 미수신.
**리뷰 범위**: 변경 4개 파일 + 연관 3개 파일

변경 4개:

- `apps/batch/src/adapters/telemetry-client.ts` (신규, 244 lines)
- `apps/batch/src/__tests__/telemetry-client.test.ts` (신규, 358 lines, 14 tests)
- `apps/batch/src/pipeline.ts` (수정 — PipelineContext.telemetryClient + 6 emit 지점 + finally flushPending)
- `apps/batch/bin/batch.ts` (수정 — createTelemetryClientFromEnv + ctx 주입)

연관 3개:

- `apps/api/src/telemetry/types.ts` (ENGINE_TELEMETRY_GAUGES + PHASE_1_GAUGES + PHASE_2_GAUGES enum 출처)
- `apps/api/src/telemetry/admin-token.ts` (X-Admin-Token fallback 인증 경로)
- `scripts/verify-engine-contracts.ts` (apps/batch required 311 → 325)

**테스트 실행 결과** (실측): `pnpm exec vitest run src/__tests__/telemetry-client.test.ts` → 14 passed / 0 failed (487ms).

---

## Pass 3 (Advocate — UX + 보안)

🔴 0건 / 🟠 2건 / ✅ 8건 확인 / N/A 1건

### 확인 (PASS — 실제 검증한 항목 + 파일:라인)

1. **PASS — Token leak 차단**: `telemetry-client.ts:104-125` (emit 의 catch) + `:155` (logger.error 호출) 모두 `err`/`reason` 만 인용 + `gauge`/`sourceId`/`reason` context 만 포함. `adminToken` 자체를 logger 에 흘리는 경로 0건. `pipeline.ts:734` finally 분기도 동일.
2. **PASS — Timing attack 비대상**: 본 모듈은 _발신 측_ (X-Admin-Token 헤더 송신). 비교는 _수신 측_ `apps/api/src/telemetry/admin-token.ts:43-50` `timingSafeEqual` 이 담당. 발신 측에서 timingSafeEqual 가 필요한 분기 없음.
3. **PASS — non-fatal 보장**: `telemetry-client.ts:113-120` (catch + logger.error) + `pipeline.ts:728-743` finally try-catch — emit 실패가 BATCH `qg2Passed`/`recoveryStatus` 에 영향 0. `metaPersistenceFailures` 누적으로 가시화됨 (`pipeline.ts:737-742`).
4. **PASS — 4xx 즉시 fail (인증 실패 retry 폭주 차단)**: `telemetry-client.ts:167-169` `nonRetryable=true` + 테스트 `telemetry-client.test.ts:186-210` 422 응답 시 callCount=1 검증.
5. **PASS — fire-and-forget 누적 보장**: `telemetry-client.ts:121-124` `pending.add(promise)` + `:127-131` `flushPending` Promise.allSettled. 테스트 `:285-310` 3개 emit 동시 발사 후 flushPending 모두 완료 검증.
6. **PASS — metric refine 정합 (DB CHECK)**: `telemetry-client.ts:104-112` metricValue/metricJson 둘 다 부재 시 logger.error + return (fetch 미호출) — `apps/api/types.ts:54-57` Zod refine 과 정합. 테스트 `:162-182` 검증.
7. **PASS — timeout AbortController 정상 동작**: `telemetry-client.ts:146-159` setTimeout + controller.abort + finally clearTimeout. 테스트 `:326-356` timeout=50ms 후 retry 동작 + callCount=2 검증.
8. **PASS — emit 데이터 PII 회피**: `pipeline.ts:619-626` (batch_progress) / `:683-691` (cost) / `:1036-1047` (d1_slo) / `:1113-1126` (graph_integrity) / `:1184-1208` (quality_gate + formula_accuracy) 모든 metricJson 본문에 사용자 식별자 / 토큰 / API key / 학습자 PII 0건. `model` 이름은 `cost` 의 `breaches` 내부에 한정 (CostMeter `threshold_breaches`) — 외부 모델 SKU 노출은 운영 진단상 필수 + Anthropic 공개 SKU.

### N/A

- **접근성**: CLI 도구. WCAG/aria-label 적용 대상 0.

### 반론 (Devil's Advocate)

**시나리오 — production ENV 망각으로 8 게이지 silent 0 데이터**: 운영자가 `THEPICK_TELEMETRY_API_BASE` / `THEPICK_TELEMETRY_ADMIN_TOKEN` 둘 중 하나라도 미설정한 채 `thepick-batch run BATCH-1 --pdf=...` 실행 시:

1. `telemetry-client.ts:226-232` warn 1회 출력 (`logger.warn("telemetry disabled — ...")`)
2. `bin/batch.ts:199-202` 의 telemetryLogger 가 `service: 'thepick-batch-cli'` 로 stdout 출력하지만 — `printHelp()` (`:496-516`) 의 `Environment:` 섹션에 `THEPICK_TELEMETRY_*` 두 변수 누락, `--help` 사용자가 인지 불가
3. 결과: BATCH 정상 종료 (exit 0) + admin-web 대시보드 8 게이지 모두 `no_data` 무한 정착
4. 메모리 `project_engine_observability` "엔진 완성 시점 알림 의무" 직접 위반 재발

본 시나리오는 14개 테스트 어느 것도 커버하지 않음. 테스트는 `createTelemetryClientFromEnv` 의 noop 분기를 검증하나, `bin/batch.ts:496-516` printHelp 의 Environment 섹션 누락이라는 _문서 차원_ 결함은 단위 테스트로 커버 불가.

### 결과 분류

#### 🟠 MAJOR-3-1 — printHelp Environment 섹션에 THEPICK*TELEMETRY*\* 누락 (production ENV 망각 위험)

- **증거**: `apps/batch/bin/batch.ts:506-511` Environment 섹션 4개 변수 (`ANTHROPIC_API_KEY`, `THEPICK_BATCH_DB`, `THEPICK_BATCH_OUT`, `THEPICK_BATCH_LOG_DIR`) 만 명시. `THEPICK_TELEMETRY_API_BASE` / `THEPICK_TELEMETRY_ADMIN_TOKEN` 누락.
- **영향**: production 운영자 `thepick-batch help` 실행 시 telemetry ENV 인지 불가 → ENV 설정 망각 → NoopTelemetryClient silent 활성 → 메모리 `project_engine_observability` 위반 재발.
- **수정 권고**: `bin/batch.ts:506-511` Environment 섹션에 다음 2개 라인 추가:
  ```
    THEPICK_TELEMETRY_API_BASE     — apps/api 엔드포인트 (production: https://api.thepick.app)
    THEPICK_TELEMETRY_ADMIN_TOKEN  — Telemetry write 인증 토큰 (apps/api ADMIN_API_TOKEN 동일값)
  ```

  - `Notes:` 섹션 끝에 "telemetry ENV 부재 시 8 게이지 emit 비활성 — production 의무" 1줄 추가.
- **차단 여부**: production 운영 alarm 트리거 차단. Phase 2 진입 전 의무.

#### 🟠 MAJOR-3-2 — `.env.example` / `docs/runbooks/` 에 THEPICK*TELEMETRY*\* 미문서화 (운영 핸드오프 결함)

- **증거**: `grep -rn "THEPICK_TELEMETRY" docs/ apps/batch/` 결과 — `apps/batch/src/adapters/telemetry-client.ts` + `apps/batch/src/__tests__/telemetry-client.test.ts` 만 hit. `docs/runbooks/production-deployment.md` / `docs/runbooks/engine-telemetry-gc.md` / 이 외 docs 어디에도 명시 없음. `.env.example` 은 본 리뷰에서 권한 부재로 직접 검증 불가했으나, 현 grep 결과 + 직전 변경 파일 목록에 부재 → 미반영 추정.
- **영향**: 신규 운영자 인수 인계 시 ENV 누락 가능성. 메모리 `feedback_document_first_workflow` (영속 문서 우선) 정합 결함.
- **수정 권고**:
  1. `.env.example` 에 두 변수 추가 (값 비워두고 주석으로 production 의무 명시).
  2. `docs/runbooks/production-deployment.md` 에 BATCH 진입 전 ENV 체크리스트 항목 추가.
  3. (선택) `docs/runbooks/engine-telemetry-gc.md` 의 §0 정책에 "wire-up source: apps/batch (THEPICK*TELEMETRY*\*)" 1 단락 추가.
- **차단 여부**: production 진입 전 의무. Phase 1 closeout 게이트 권장.

#### MINOR (보고만, 수정 비차단)

- **MINOR-3-1**: `telemetry-client.ts:148-150` 주석 ("nonRetryable: 4xx 응답 — retry 의미 없음") 의 본문 의도 OK 이나 414/429 등 _retry-after 의미 있는 4xx_ (특히 429 Too Many Requests) 도 즉시 fail. Phase 2 alarm 정책 도입 시 429 → backoff retry 분기 검토 필요. 본 변경 비차단.
- **MINOR-3-2**: `pipeline.ts:1184-1208` formula_accuracy emit 분기 — `c.name.startsWith('Formula ')` 매칭이 `qg2-validator.ts` checkFormulaAccuracy 산출 prefix 에 강결합. prefix 변경 시 formula_accuracy 게이지 silent 미발사. 단위 테스트가 본 emit 분기 미커버. 본 변경 비차단 (Phase 2 alarm rule 활성 직전 통합 테스트 권고).

---

## Pass 4 (Contract — 기획 대조 + Silent Pivot)

🔴 0건 / 🟠 1건 / ✅ 8건 확인 / N/A 0건

### 확인 (PASS)

1. **PASS — TELEMETRY_GAUGES enum 1:1 정합**: `telemetry-client.ts:31-40` 8 게이지 배열 vs `apps/api/src/telemetry/types.ts:14-23` `ENGINE_TELEMETRY_GAUGES` 동일 순서 + 동일 8 entry. 테스트 `telemetry-client.test.ts:46-58` 명시 검증. JSDoc `:28-30` "변경 시 apps/api 측 동시 갱신 의무" 명시.
2. **PASS — Hard Rule 17 examId 단일 출처**: `telemetry-client.ts` 본문 + 테스트 모두 `EXAM_IDS.SON_HAE_PYEONG_GA_SA` 만 사용 (총 13회). 리터럴 `'son-hae-pyeong-ga-sa'` 직접 사용 0건 (grep 검증). JSDoc `:18-20` 정합 명시. `bin/batch.ts:204+224` 진입점도 `EXAM_IDS` 경유.
3. **PASS — production-quality.md 7개 금지 패턴 0건**: `grep -nE "any |console\.log|TODO|HACK|catch \{ ?\}|console\.warn"` 양 파일에서 결과 0건. `any` 0건 (Readonly + readonly + brand type). console.\* 0건 (logger.error/warn 만). 빈 catch 0건. TODO/HACK 0건. 하드코딩 — DEFAULT_TIMEOUT_MS 등 명명 상수.
4. **PASS — handoff-036 §3.1 7 게이지 wire-up 충족 (6 active + 1 deferred)**: handoff `.jjokjipge/handoff-session-036.md:111-120` "7 게이지 wire-up (Phase 1 활성)" 列:
   - cost ✓ (`pipeline.ts:683-691`)
   - batch_progress ✓ (`pipeline.ts:617-627`)
   - d1_slo ✓ (`pipeline.ts:1036-1047`)
   - quality_gate ✓ (`pipeline.ts:1184-1194`)
   - formula_accuracy ✓ (`pipeline.ts:1199-1209`)
   - graph_integrity ✓ (`pipeline.ts:1113-1126`)
   - reviewer_queue ✗ (handoff `:118` "Phase 2 deferred OK" 명시) — 6/7 wire-up + 1 명시 deferred.
5. **PASS — VERIFY_GATE 동시 갱신**: `scripts/verify-engine-contracts.ts:148` `apps/batch required: 325` (직전 311 → +14 본 신규 테스트 = 325). 본 변경 14 tests 와 정확히 일치. baseline 311 + 14 = 325 산식 검증 OK.
6. **PASS — emit 시점 stage 종료 직후**: `pipeline.ts:614-627` (batch_progress) result.status==='success' 후 즉시 emit + `:1036-1047` (d1_slo) loadResult 산출 후 즉시 emit + `:1113-1126` (graph_integrity) report 산출 후 throw 분기 _이전_ emit (위반 분기는 throw 후 runStage 가 status='failed' wrap — 의도 명시 주석 :1112). cost 는 `:679-693` `if (!aborted)` 정상 완료 분기에 한정 emit — 실패 시 cost 게이지 미발사 정합.
7. **PASS — flushPending finally drain**: `pipeline.ts:728-743` finally try-catch 로 flushPending 호출 + `metaPersistenceFailures` 'finalize_telemetry' 누적. fire-and-forget 의 in-flight Promise leak 차단.
8. **PASS — apps/api admin-token fallback 호환**: `telemetry-client.ts:155-158` `'X-Admin-Token': adminToken` 헤더 직접 송신. `apps/api/src/telemetry/admin-token.ts:74-83` `extractAdminToken` 의 cookie 우선 + header fallback 경로의 fallback 분기 직접 일치. server-to-server 의도 정합.

### 반론 (Devil's Advocate)

**시나리오 — handoff-036 vs apps/api PHASE_1_GAUGES 정의 불일치 (운영 진실 출처 충돌)**:

- handoff `.jjokjipge/handoff-session-036.md:111-118` "7 게이지 wire-up (Phase 1 활성)" + `reviewer_queue (Phase 2 deferred OK)` — handoff 본문에서 reviewer_queue 를 _Phase 1 게이지 7개 중 1개_ 로 분류하고 동시에 _Phase 2 deferred OK_ 라고 모순적으로 표기.
- 한편 `apps/api/src/telemetry/types.ts:28-36` `PHASE_1_GAUGES` 는 reviewer_queue 를 _명시적으로 Phase 1 활성_ 으로 코드화 (7개 entry 중 마지막).
- 즉 **handoff 본문 내부 모순** + **handoff vs API const 사이 contract 불일치** 동시 존재. 본 변경의 wire-up 결정 (reviewer_queue 미발사) 은 handoff §3.1 line 118 의 "Phase 2 deferred OK" 표현을 신뢰한 결과. apps/api `PHASE_1_GAUGES` 는 reviewer_queue 를 Phase 1 으로 분류 → admin-web 대시보드는 reviewer_queue 게이지 슬롯을 Phase 1 영역에 표시 → batch wire-up 부재 → "no_data" 영구 표시 → Phase 1 5-페르소나 quality 페르소나가 차후 발견 시 silent failure 분류 가능.

본 변경 단독으로는 silent failure 가 아니나, contract 진실 출처 (handoff vs apps/api types.ts) 가 동시 갱신되어야 정합.

### 결과 분류

#### 🟠 MAJOR-4-1 — reviewer_queue gauge 진실 출처 contract 충돌 (handoff §3.1 vs apps/api types.ts PHASE_1_GAUGES)

- **증거 1**: `apps/api/src/telemetry/types.ts:28-36` `PHASE_1_GAUGES = ['batch_progress', 'cost', 'd1_slo', 'graph_integrity', 'quality_gate', 'formula_accuracy', 'reviewer_queue']` (7개 — reviewer_queue 포함, Phase 1 활성).
- **증거 2**: `.jjokjipge/handoff-session-036.md:111-118` "7 게이지 wire-up (Phase 1 활성)" + `reviewer_queue (Phase 2 deferred OK)` (모순).
- **증거 3**: 본 변경 `pipeline.ts` 6곳 emit — reviewer_queue emit 0건.
- **영향**: admin-web `/telemetry` 대시보드 reviewer_queue 슬롯 영구 `no_data`. Phase 1 5-페르소나 (quality / backend) 차후 검수 시 wire-up 누락으로 분류 가능. 메모리 `project_engine_observability` 8 게이지 항상성 차원 결함 (1/8 = 12.5% 데드 게이지).
- **수정 권고 (택일)**:
  - **A안 (recommend)**: `apps/api/src/telemetry/types.ts:28-36` 에서 `reviewer_queue` 를 `PHASE_2_GAUGES` 로 재분류. `PHASE_1_GAUGES` 6개 + `PHASE_2_GAUGES` 2개 (`reviewer_queue`, `learning_slo`). handoff-036 §3.1 의 "Phase 2 deferred OK" 표현과 정합. admin-web 대시보드 phase=2 표시 → 정확한 contract.
  - **B안**: 본 PR 에 `reviewer_queue` emit 추가 (예: status_transitions 큐 길이 측정 후 stageDbLoad 또는 별도 stage 에서 emit). production-deployment 시점에 큐 데이터 부재 시 metricValue=0 + metricJson={ pendingCount: 0, ... } emit. 단 현 가-0 기간 status_transitions 큐 미가동 → 의미 있는 metric 산출 불가. **A안 권고**.
- **차단 여부**: 본 PR 수정 비차단 (contract 정합 의도 본 PR 외부에서 동시 갱신 가능). Phase 1 closeout 또는 Phase B 4-Pass 흡수 시 동시 처리 권고. 차세션 우선 처리 의무.

#### MINOR (보고만)

- **MINOR-4-1**: handoff-036 §5.2 line 118 "Phase 2 deferred OK" 와 §3.1 line 112 "7 게이지 wire-up (Phase 1 활성)" 사이 _handoff 본문 내부 모순_. 차세션 핸드오프 (handoff-session-038) 작성 시 정정 권고.
- **MINOR-4-2**: handoff-036 §3.1 "e2e: BATCH dry-run → admin-web `/telemetry` 데이터 흐름 시각 확인" — 본 PR 14 단위 테스트는 e2e 미커버. 차세션 admin-web vitest 8 tests (CRIT-QPHASE1-1) + production staging dry-run 시 동시 검증 필요. 본 PR 차단 비대상 (handoff 자체가 동시 처리 가능 분리 표기).

---

## 판정

**완료 가능** (단, MAJOR 3건 차세션 즉시 흡수 의무).

- CRITICAL 0건 — 4-Pass 진행 차단 0건.
- MAJOR 3건 (Pass 3-1, Pass 3-2, Pass 4-1) — 모두 **본 PR 단독 수정 비차단**, 그러나 production 진입 (Phase 2) 또는 Phase 1 closeout 게이트 *전*에 의무 흡수.
  - Pass 3-1 (printHelp): 5분 작업, 차세션 즉시 흡수 권고.
  - Pass 3-2 (.env.example + runbook): 15분 작업, 차세션 즉시 흡수 권고.
  - Pass 4-1 (PHASE_1_GAUGES 재분류): 10분 작업 + admin-web 대시보드 영향 검증 필요. **차세션 우선 처리 의무**.
- MINOR 4건 (3-1, 3-2, 4-1, 4-2): 보고만, Phase 2 진입 전 검토.

본 변경의 핵심 의무 (메모리 `project_engine_observability` 직접 위반 해소) 는 6개 게이지 wire-up + flushPending finally + ENV-driven noop fallback 으로 충족됨. handoff-036 §3.1 contract 6/7 wire-up + 1 명시 deferred 정합.

production-quality.md 7개 금지 패턴 0건 (any/console.log/빈catch/TODO/HACK/하드코딩/import\* 모두 0).

────────────────────────────────────
