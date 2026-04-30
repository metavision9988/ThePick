# 🔥 VOID ENGINE DESIGN CONSTITUTION v3.0

## 마이크로엔진 · 메타엔진 통합 설계 헌법 — 최종 통합판

> _"엔진은 빌드되는 것이 아니라 박동한다._  
> _그러나 모든 엔진이 같은 박동을 하지는 않는다._  
> _5개 도메인을 봐야 비로소 헌법이다."_  
> — MEPHISTO

---

**Version:** 3.0 (v2.0 + v2.1 PATCH + v2.2 도메인 확장 통합본)  
**Date:** 2026-04-26  
**Supersedes:** v2.0 / v2.1 PATCH / v2.2 PROPOSAL  
**Aligned with:** VOID DEV UNIFIED CONSTITUTION v3.3 (DEFCON / ACAP / G5.5 / SPDP / Lineage)  
**Scope:** 모든 VOID 프로젝트의 엔진 설계·구현·운영·진화의 단일 진실 소스  
**Guardian:** MEPHISTO + DEV COVEN 7인  
**Language:** 기획·규칙은 한국어 / 코드·인터페이스는 영어  
**Domains Covered:** Real-time SaaS / Batch-Build / Library / Solo-Builder / Single-Vendor / Content-Generation

---

## 📑 목차 (19 Volumes + 5 부록)

| Volume    | 제목                                           | 출처         |
| :-------- | :--------------------------------------------- | :----------- |
| 0         | 헌법 진화 이력 + DEV COVEN 페르소나            | v2.0 + v2.2  |
| I         | 엔진의 본질 — 정의·분류·식별                   | v2.0         |
| II        | 6대 무기 — 2026 현시대                         | v2.0         |
| III       | 5대 결합 패턴                                  | v2.0         |
| IV        | LLM 격리 4계층                                 | v2.0         |
| IV-B      | AIEC — 인증된 엔진 간 통신                     | v2.1 NEW     |
| V         | 7단계 Lifecycle (+ Resurrection)               | v2.0 + v2.1  |
| VI        | 5종 SLI / 3 SLO Tier (+ Cost)                  | v2.0 + v2.1  |
| VII       | 5계층 테스트 (+ Blast Radius)                  | v2.0 + v2.1  |
| VIII      | DEFCON × Engine 매트릭스 (21행)                | v2.0 + v2.1  |
| IX        | 16 안티패턴                                    | v2.0 + v2.1  |
| X         | 4개 프로젝트 적용 사례                         | v2.0         |
| XI        | 페르소나별 COT 검증                            | v2.0         |
| XII       | Implementation Checklist                       | v2.0         |
| XIII      | First Heartbeat Protocol                       | v2.1 NEW     |
| **XIV**   | **Batch/Build Engine Profile**                 | **v2.2 NEW** |
| **XV**    | **Library Engine Profile**                     | **v2.2 NEW** |
| **XVI**   | **Solo-Builder Phase Profile**                 | **v2.2 NEW** |
| **XVII**  | **Single-Vendor Lock-in Profile**              | **v2.2 NEW** |
| **XVIII** | **Content Generation Engine Profile**          | **v2.2 NEW** |
| **XIX**   | **Constitutional Self-Audit Principles**       | **v2.2 NEW** |
| 부록 A    | engine.contract.yaml v3.0                      |              |
| 부록 B    | engine.adr.md                                  |              |
| 부록 C    | HealthStatus / EngineCheckpoint / AIECEnvelope |              |
| 부록 D    | 5개 도메인 프로파일 결정 트리                  |              |
| 부록 E    | v1.0 → v3.0 변경 이력                          |              |

---

# Volume 0: 헌법 진화 이력 + DEV COVEN

## 0.1 헌법의 진화

| 버전     | 날짜           | 핵심 변경                                                                               | 트리거                             |
| :------- | :------------- | :-------------------------------------------------------------------------------------- | :--------------------------------- |
| v1.0     | 2026 초        | 시(詩) 형태의 영감 — 비유 중심                                                          | 첫 시도                            |
| v2.0     | 2026-04-26     | 9가지 무기 — 식별/분류/결합/격리/Lifecycle/측정/테스트/DEFCON/안티패턴                  | 시 → 헌법                          |
| v2.1     | 2026-04-26     | 6가지 추가 — Resurrection / AIEC / Cost SLI / SVF 매핑 / Blast Radius / First Heartbeat | 메타 관찰자 5개 지적               |
| **v3.0** | **2026-04-26** | **5개 도메인 프로파일 추가 — Batch / Library / Solo / Single-Vendor / Generation**      | **ThePick 갭 분석 Reality Anchor** |

## 0.2 DEV COVEN 페르소나 (7인)

| 페르소나     | 역할                     | 핵심 질문                  | 시그니처                               |
| :----------- | :----------------------- | :------------------------- | :------------------------------------- |
| 🎩 MEPHISTO  | 총지휘, 갈등 중재        | "이 결정이 최선인가?"      | "진짜 질문은 그게 아니야."             |
| 🔮 ORACLE    | 제품 비전, MVP, 시장     | "누가 사고, 왜 사는가?"    | "그건 기능이지, 제품이 아니야."        |
| 👤 ADVOCATE  | UX, 접근성, 마이크로카피 | "엄마가 이걸 쓸 수 있어?"  | "에러 메시지가 '오류 발생'? 모욕이야." |
| 🏗️ ARCHITECT | 시스템 설계, 확장성      | "6개월 후 감옥이 안 되나?" | "단순함이 복잡함을 이긴다."            |
| 💻 HACKER    | 구현, 프로토타이핑       | "일단 돌아가게?"           | "논쟁은 코드로."                       |
| 🔨 BREAKER   | 코드 리뷰, 엣지 케이스   | "어떻게 깨뜨리지?"         | "해피 패스만 테스트했지?"              |
| 🛡️ SENTINEL  | 보안, 법적 컴플라이언스  | "이거 합법이야?"           | "GDPR 벌금이 매출의 4%야."             |
| 👻 GHOST     | DevOps, 배포, 운영       | "프로덕션에서 살아남아?"   | "최고의 인프라는 존재감이 없다."       |

---

# Volume I: 엔진의 본질 — 정의·분류·식별

## 1.1 엄격한 정의

```
■ 엔진 (Engine)이란:
  특정 도메인의 복잡성을 캡슐화하고, 자체 lifecycle을 가지며,
  결정론적 입출력 계약을 통해 외부와 통신하는,
  관측 가능하고 교체 가능한 실행 단위.

  (※ Library Engine은 Volume XV에서 완화 예외 정의)

■ 엔진이 아닌 것:
  • 함수 모음 (= 라이브러리, 단 Volume XV 예외)
  • 코드 뼈대 (= 프레임워크)
  • 단순 비즈니스 로직 (= 애플리케이션 서비스)
  • 데이터 구조 (= 모델/엔티티)
```

## 1.2 엔진 식별 5문항 테스트

|  #  | 질문                                           | 검증                  |
| :-: | :--------------------------------------------- | :-------------------- |
| Q1  | 자체 lifecycle 보유 (start/stop/health/reload) | API 존재              |
| Q2  | 상태 격리 (외부 직접 접근 불가)                | private/encapsulation |
| Q3  | 결정론적 계약 (시드 명시 시)                   | Property test         |
| Q4  | 관측 가능 (5분 내 답할 수 있음)                | OpenTelemetry 3종     |
| Q5  | 교체 가능 (인터페이스 보존 시)                 | mock 또는 다중 구현   |

**모두 YES → 엔진** / 하나라도 NO → 엔진 아님 (단 Library Engine은 Volume XV 적용)

## 1.3 4축 분류 매트릭스

| 축                       | 값                                                |
| :----------------------- | :------------------------------------------------ |
| **범위 (Scope)**         | Micro / Meta                                      |
| **결정성 (Determinism)** | Deterministic / Probabilistic / Hybrid            |
| **상태 (Statefulness)**  | Stateless / Stateful / Persistent                 |
| **격리 (Isolation)**     | Process / Thread / Worker / Sandbox / Edge / Wasm |

### DEFCON 자동 매핑

| 조합                              | 권장 DEFCON |
| :-------------------------------- | :---------: |
| Meta + Probabilistic + Stateful   |   **L3**    |
| Meta + Deterministic + Persistent |   **L3**    |
| Micro + Probabilistic + Stateless |   **L2**    |
| Micro + Deterministic + Stateless |   **L1**    |

## 1.4 비유 ↔ 공학 매핑

| 비유 (영감)     | 공학적 정의 (구현)               |
| :-------------- | :------------------------------- |
| "박동하는 심장" | Event loop / Lifecycle hook      |
| "장(Field)"     | Bounded Context (DDD) + Schema   |
| "결정론적 우리" | Validator + Sandbox + Type guard |
| "엔트로피 저항" | State management + Memory budget |

## 1.5 S-V-F 옵션 매핑 (참고용, 강제 X)

| 코드 영역         | 표준 명명                    | S-V-F 매핑              |
| :---------------- | :--------------------------- | :---------------------- |
| 함수 입출력       | `inputs` / `outputs`         | Scalars (순수 데이터)   |
| 인터페이스/이벤트 | `interface` / `events`       | Vectors (방향성)        |
| 검증 규칙         | `constraints` / `validators` | Field Rules (장의 법칙) |
| Lifecycle 상태    | `state` / `phase`            | Field State             |
| 시간/순서         | `timestamps` / `sequence`    | Time (T)                |

→ contract.yaml에 `svf_role` 옵션 필드로 첨부 가능. CI는 검증하지 않음.

---

# Volume II: 6대 무기 — 2026 현시대

## 2.1 무기 라이브러리

|  #  | 무기                     | 언제                                                   |
| :-: | :----------------------- | :----------------------------------------------------- |
|  1  | **WebAssembly (Wasm)**   | CPU 집약 연산 (>50ms). Rust > Go > C++. JS 대비 5~15배 |
|  2  | **WebGPU + WGSL**        | 병렬 연산. CPU fallback 의무                           |
|  3  | **V8 Isolates (Edge)**   | 글로벌 저지연 + 무상태                                 |
|  4  | **OPFS + IndexedDB**     | 브라우저 내 영속 (수GB), Local-First                   |
|  5  | **OpenTelemetry**        | 모든 엔진의 관측성 (단일 벤더 환경은 Volume XVII 절충) |
|  6  | **CRDT (Yjs/Automerge)** | 멀티유저 실시간 동기화                                 |

## 2.2 무기 선택 결정 트리

```
Q1. CPU 집약(>50ms)? → YES: Wasm
Q2. 병렬 연산(>1만 항목)? → YES: WebGPU (CPU fallback 의무)
Q3. 사용자 데이터? → YES: OPFS + Local-First
Q4. 글로벌 + 저지연? → YES: V8 Isolates (무상태)
Q5. 멀티유저 실시간? → YES: CRDT
★ 모든 답변 후: OpenTelemetry SDK (선택 아님, 의무. 단 Volume XVII 절충)
```

## 2.3 도구 선택 가이드

| 도구                       | 권장도    | 사용 조건                            |
| :------------------------- | :-------- | :----------------------------------- |
| Astro + Islands            | ✅ 최우선 | 정적 우세 + 부분 인터랙션            |
| Cloudflare Workers/Pages   | ✅ 최우선 | Edge 우선, 비용 통제                 |
| Cloudflare Durable Objects | ✅ 권장   | 상태 + 시그널링 + WebSocket          |
| Vanilla JS + Web Workers   | ✅ 권장   | 마이크로엔진 격리                    |
| WebAssembly (Rust)         | ✅ 권장   | CPU 집약                             |
| Next.js / Vercel           | ⚠️ 조건부 | 깊은 SSR 필수일 때만                 |
| Express on Node            | ⚠️ 조건부 | Workers에서 안 되는 Node API 필요 시 |
| 단일 React SPA             | ❌ 비권장 | Astro Islands가 우월                 |

---

# Volume III: 5대 결합 패턴

## 3.1 패턴 정의

| Pattern | 이름              | 다이어그램             | 적용                                                   |
| :------ | :---------------- | :--------------------- | :----------------------------------------------------- |
| **A**   | Pipeline (직렬)   | A → B → C              | ETL, 미디어 변환, 컴파일러, **데이터 빌드 파이프라인** |
| **B**   | Orchestrator      | Meta → [A, B, C]       | Meta가 라우팅, Workers는 격리 실행                     |
| **C**   | Event Bus         | A → Bus → [B, C, D...] | 비동기·다대다, 확장 우선                               |
| **D**   | Actor Model       | Actor ↔ Actor          | 멀티유저 실시간, 격리 동시성                           |
| **E**   | Stream Processing | Source → Stream → Sink | 끝없는 데이터 흐름                                     |

## 3.2 패턴 선택 매트릭스

| 요구사항                    | 권장     | 회피 |
| :-------------------------- | :------- | :--- |
| 단순 변환                   | A        | C    |
| 다양한 라우팅               | B        | A    |
| 확장 가능성                 | C        | A    |
| 멀티유저 동시성             | D        | A    |
| 끝없는 흐름                 | E        | A    |
| 결제·정산                   | A 또는 B | C    |
| 데이터 빌드 (ThePick BATCH) | A        | C    |

## 3.3 5대 함정 (오케스트레이션의 저주)

| 함정                 | 증상                      | 회피                         |
| :------------------- | :------------------------ | :--------------------------- |
| Sync Hell            | A↔B↔C 상태 직접 참조      | 단방향 시간(T) Top-down 주입 |
| Distributed Monolith | 분산이지만 결합도 강함    | 인터페이스 협상 + 버전 관리  |
| N+1 Calls            | 개별 호출 → 네트워크 폭발 | Batch + DataLoader           |
| Cascade Failure      | 하나 죽으면 다 죽음       | Circuit Breaker + Bulkhead   |
| Untraceable Flow     | "왜 이 결과?" 답 못함     | OpenTelemetry trace_id       |

---

# Volume IV: LLM 격리 4계층

## 4.1 핵심 원칙

```
"엔진을 비결정론적 야수를 가두는 결정론적 우리로 설계하라."
```

## 4.2 4계층 격리

| Layer | 이름                  | 역할                                                          |
| :---- | :-------------------- | :------------------------------------------------------------ |
| **1** | Schema Validation     | LLM 출력 → JSON Schema 검증. structured output 강제           |
| **2** | Constraint Validation | 의미적 제약 (예: `note.pitch ∈ [21, 108]`)                    |
| **3** | Cross-Validation      | Self-Consistency (N회 + Majority) / Critic LLM / Ground Truth |
| **4** | Graceful Degradation  | LLM 실패 → 규칙 기반 fallback                                 |

## 4.3 LLM 통합 엔진의 5요소 (계약 의무)

```yaml
llm_integration:
  model: 'claude-sonnet-4-7'
  cost_cap_per_request_usd: 0.05
  cost_cap_per_user_per_day_usd: 1.00
  timeout_ms: 10000
  fallback: 'rule_based_v2'
  schema_strict: true
  semantic_validators: ['amount_in_range', 'date_realistic']
  prompt_injection_defense: true
  output_pii_filter: true
```

## 4.4 SLM 위치별 격리 전략

| 위치                     | 격리      | 권장              |
| :----------------------- | :-------- | :---------------- |
| 메인 스레드              | 약함      | ❌ 절대 금지      |
| Web Worker               | 보통      | ✅ 자동완성, 분류 |
| WebGPU + Wasm            | 강함      | ✅ 추론 전용      |
| Edge Worker (Workers AI) | 강함      | ✅ 짧은 컨텍스트  |
| 별도 추론 서비스 (vLLM)  | 매우 강함 | ✅ 대규모         |

---

# Volume IV-B: AIEC — Authenticated Inter-Engine Communication

## 4B.1 위협 모델

| 위협          | 방어                |
| :------------ | :------------------ |
| Bypass Attack | 토큰 검증           |
| Tampering     | HMAC 서명           |
| Replay        | nonce + timestamp   |
| Token Theft   | 단기 TTL (≤60초)    |
| Cross-Tenant  | tenant_id 강제 검증 |

## 4B.2 표준 메시지 봉투

```typescript
interface AIECEnvelope<T> {
  message_id: string; // UUID, 중복 검출
  trace_id: string; // OpenTelemetry
  timestamp: number;
  from_engine: string;
  to_engine: string;
  caller_chain: string[];
  tenant_id: string;
  user_id?: string; // PII 필터링 후
  capabilities: string[]; // ["read:audio", "write:score"]
  payload: T;
  payload_hash: string; // SHA-256
  signature: string; // HMAC-SHA256
  nonce: string;
  expires_at: number;
}
```

## 4B.3 검증 의무 6단계

```typescript
async function handleMessage<T>(envelope: AIECEnvelope<T>): Promise<Response> {
  if (Date.now() > envelope.expires_at) throw new AIECError('TOKEN_EXPIRED');
  if (sha256(envelope.payload) !== envelope.payload_hash) throw new AIECError('PAYLOAD_TAMPERED');
  if (computeHMAC(...) !== envelope.signature) throw new AIECError('SIGNATURE_INVALID');
  if (await nonceStore.exists(envelope.nonce)) throw new AIECError('REPLAY_DETECTED');
  await nonceStore.set(envelope.nonce, true, { ttl: 60 });
  if (!hasCapability(envelope.capabilities, required)) throw new AIECError('INSUFFICIENT_CAPABILITY');
  return await processMessage(envelope.payload);
}
```

## 4B.4 DEFCON × AIEC 의무

|       DEFCON        | TTL | 무결성 | 서명 | Nonce |   Capability   |
| :-----------------: | :-: | :----: | :--: | :---: | :------------: |
|         L1          | ❌  |   ❌   |  ❌  |  ❌   |       ❌       |
|         L2          | ⚠️  |   ✅   |  ⚠️  |  ⚠️   |       ⚠️       |
|         L3          | ✅  |   ✅   |  ✅  |  ✅   |       ✅       |
| 자동 L3 (결제·인증) | ✅  |   ✅   |  ✅  |  ✅   | ✅ + audit log |

---

# Volume V: 7단계 Lifecycle (+ Resurrection)

## 5.1 7단계

|  Stage  | 이름                        | 산출물                    |  DEFCON L3 의무  |
| :-----: | :-------------------------- | :------------------------ | :--------------: |
|    0    | Conception                  | engine.research.md        |        ✅        |
|    1    | Contract                    | engine.contract.yaml      |        ✅        |
|    2    | Implementation              | 코드 + 테스트             |        ✅        |
|    3    | Bootstrapping               | start/health-check API    |        ✅        |
| **3.5** | **Resurrection (v2.1 NEW)** | **recover/snapshot**      | ✅ Stateful 의무 |
|    4    | Production                  | SLI/SLO 대시보드          |        ✅        |
|    5    | Evolution                   | 버전 + 마이그레이션       |        ✅        |
|    6    | Sunset                      | Deprecation + Data Export |        ✅        |

## 5.2 Lifecycle 5종 Hook (v2.1 강화)

```typescript
interface EngineLifecycle {
  start(config: EngineConfig): Promise<void>;
  stop(graceful: boolean): Promise<void>;
  healthCheck(): Promise<HealthStatus>;
  reload(newConfig: EngineConfig): Promise<void>;

  // [v2.1 NEW]
  recover(checkpoint: EngineCheckpoint): Promise<RecoveryResult>;
  snapshot(): Promise<EngineCheckpoint>;
}
```

## 5.3 Checkpoint 저장 위치

| 환경                        | 위치                    | 빈도                  |
| :-------------------------- | :---------------------- | :-------------------- |
| 브라우저 (Worker/Wasm)      | OPFS                    | 매 step or 5초        |
| 브라우저 (메인)             | IndexedDB               | 매 step (작은 데이터) |
| Cloudflare Edge (Stateful)  | Durable Objects Storage | 매 message            |
| Cloudflare Edge (Stateless) | KV (cold) + R2 (대용량) | phase 단위            |
| Node                        | SQLite + S3 sync        | 주기적 fsync          |

## 5.4 Recovery 결정 트리

```
엔진 비정상 종료 감지
  ↓
Q1. 마지막 체크포인트 존재? NO → 처음부터 + UX 사과
  ↓ YES
Q2. 무결성(hash) 검증? 실패 → 처음부터 + 알림
  ↓ 통과
Q3. engine_version major 동일? 다름 → Migration 권장
  ↓ 동일
Q4. 의존 체크포인트 존재? 아님 → partially_recovered
  ↓ 모두
recover() → fully_recovered
```

## 5.5 Migration Strategy 3종

| 전략          | 적용                  |
| :------------ | :-------------------- |
| Big Bang      | PoC만 (위험)          |
| Strangler Fig | 권장                  |
| Parallel Run  | LLM 엔진 교체 시 의무 |

## 5.6 Sunset 절차

- Deprecation 발표 → 90일 대기
- Migration Guide 제공
- Data Export 도구 의무 (Exit-Ready)
- 마지막 변경 후 1년 보관 (legal)

---

# Volume VI: 5종 SLI / 3 SLO Tier

## 6.1 5종 SLI

| SLI                 | 단위                                                   |
| :------------------ | :----------------------------------------------------- |
| **Latency**         | P50/P95/P99 (ms)                                       |
| **Throughput**      | req/sec 또는 items/sec                                 |
| **Availability**    | %                                                      |
| **Correctness**     | % (G5.5와 연동)                                        |
| **Cost (v2.1 NEW)** | USD per operation / per user / per tenant / per engine |

## 6.2 SLO 템플릿 3 Tier (Cost 통합)

### Tier S (Critical)

```yaml
slo:
  availability: 99.95%
  latency_p99: 500ms
  correctness: 99.9%
  cost_per_operation_usd: 0.001
  error_budget_per_month: 21.6_minutes
  cost_budget_per_month_usd: 5000
```

### Tier A (Important)

```yaml
slo:
  availability: 99.5%
  latency_p99: 5000ms
  correctness: 95.0%
  cost_per_operation_usd: 0.05
  error_budget_per_month: 3.6_hours
  cost_budget_per_month_usd: 1000
```

### Tier B (Standard)

```yaml
slo:
  availability: 99.0%
  latency_p99: 30000ms
  correctness: 90.0%
  cost_per_operation_usd: 0.10
  error_budget_per_month: 7.2_hours
  cost_budget_per_month_usd: 200
```

(※ Build Tier는 Volume XIV 참조)

## 6.3 Financial Circuit Breaker

```yaml
financial_circuit_breaker:
  soft_warn_usd: 700 # 70% — 경고
  hard_throttle_usd: 900 # 90% — 50% 감속
  kill_switch_usd: 1000 # 100% — 완전 중단
  rate_limit_per_minute_usd: 5
  auto_pause_on_exceed: true
  recovery_policy: 'auto_at_midnight' # manual | auto_at_midnight | tenant_self_service_topup
```

## 6.4 OpenTelemetry 의무

| 종류    | 항목                                         |
| :------ | :------------------------------------------- |
| Trace   | 모든 외부 호출                               |
| Metric  | 5종 SLI                                      |
| Log     | 구조화 (trace_id, engine_name, version)      |
| Baggage | user_id (PII 필터 후), session_id, tenant_id |

(※ Single-Vendor 환경은 Volume XVII 절충 — SDK는 의무, 백엔드는 자유)

## 6.5 Backpressure 4전략

| 전략                 | 설명        |
| :------------------- | :---------- |
| Buffer + Drop-Oldest | 실시간 우선 |
| Buffer + Drop-Newest | 배치 우선   |
| Block Sender         | 강한 일관성 |
| Spillover to Disk    | OPFS 활용   |

→ 명시적 선언. 기본값 의존 ❌.

---

# Volume VII: 5계층 테스트 (+ Blast Radius)

## 7.1 5계층 피라미드

```
   Chaos    ← Tier 5
  Property  ← Tier 4
  Contract  ← Tier 3
 Integration ← Tier 2
    Unit    ← Tier 1
```

| Tier          | 도구                             | 적용 시점                     |
| :------------ | :------------------------------- | :---------------------------- |
| 1 Unit        | jest/vitest/pytest               | TDD 5/10/5                    |
| 2 Integration | Pattern A~E별 시나리오           | Epic 끝                       |
| 3 Contract    | Pact, OpenAPI Diff               | 인터페이스 변경               |
| 4 Property    | fast-check, Hypothesis, proptest | **결정성 검증 핵심**          |
| 5 Chaos       | Custom + Feature Flag            | Production canary (격리 의무) |

## 7.2 결정성 Property Test 예시

```typescript
test('engine.transcribe is deterministic', () => {
  fc.assert(
    fc.property(fc.array(fc.float()), (audioData) => {
      const r1 = engine.transcribe(audioData, { seed: 42 });
      const r2 = engine.transcribe(audioData, { seed: 42 });
      expect(r1).toEqual(r2);
    }),
  );
});
```

## 7.3 Tier 5 Chaos — Blast Radius 5계층 (v2.1 NEW)

| Layer                      | 격리                                                      |
| :------------------------- | :-------------------------------------------------------- |
| 1. Tenant Isolation        | 카오스 전용 가상 테넌트 (`tenant_id="chaos-test-{date}"`) |
| 2. Synthetic Traffic       | 봇 트래픽만 (`User-Agent: VOID-Chaos-Bot/1.0`)            |
| 3. Traffic Shadowing       | 진짜 트래픽 복제만, 응답 미반환                           |
| 4. Feature Flag Quarantine | `chaos_oom_test_enabled = false` (기본값)                 |
| 5. Kill Switch             | 30초 자동 중단 + 인간 수동 중단                           |

## 7.4 시나리오별 권장 격리

| 시나리오              | 최소 격리                    |
| :-------------------- | :--------------------------- |
| 메모리 80%            | Layer 1                      |
| 의존 엔진 5초 지연    | Layer 1 + 4                  |
| Network 50% 패킷 드롭 | Layer 1 + 2                  |
| 데이터 손상 시뮬      | Layer 1 + 2 + 3              |
| OOM 강제 종료         | Layer 1 + 4 + 5              |
| LLM 응답 변조         | Layer 1 + 2                  |
| **결제·인증 카오스**  | **Layer 1 + 2 + 4 + 5 모두** |

## 7.5 Resurrection Chaos 시나리오 (v2.1 NEW)

| 시나리오            | 검증                                           |
| :------------------ | :--------------------------------------------- |
| R1: OOM 부활        | 60% 진행 → 강제 종료 → recover() → 정확 재개?  |
| R2: 체크포인트 변조 | 1바이트 수정 → recover() → 거부 + 사용자 알림? |
| R3: 버전 불일치     | v1 체크포인트 → v2 엔진 → recover() → 거부?    |

## 7.6 LLM 엔진 추가 테스트

| 테스트             | 설명                      |
| :----------------- | :------------------------ |
| Hallucination      | 거짓 사실에 "모름" 답변   |
| Prompt Injection   | "이전 지시 무시"에 저항   |
| Cost Regression    | 모델 변경 후 토큰 비교    |
| Latency Regression | P95 비교                  |
| Quality Regression | 표준 데이터셋 G5.5 통과율 |

---

# Volume VIII: DEFCON × Engine 매트릭스 (21행)

| 항목                          |     L1     |       L2        |                L3                 |
| :---------------------------- | :--------: | :-------------: | :-------------------------------: |
| Engine ID Test (5문항)        |  ⚠️ Q1·Q2  |    ✅ Q1~Q4     |              ✅ 전수              |
| Lifecycle Hooks 5종           | ⚠️ start만 |     ✅ 5종      |           ✅ + graceful           |
| 4축 분류                      |     ❌     |     ⚠️ 2축      |              ✅ 4축               |
| Contract                      |     ❌     |     ✅ 간소     |      ✅ 전수 + BREAKER 검증       |
| 결합 패턴 명시                |     ❌     |       ✅        |         ✅ + 트레이드오프         |
| LLM 격리 4계층                |    N/A     |  ✅ Layer 1+2   |           ✅ Layer 1~4            |
| **AIEC**                      |     ❌     | ⚠️ 무결성+서명  |          ✅ 전수 + audit          |
| **Resurrection**              |     ❌     |  ⚠️ Stateful만  |       ✅ 의무 + Chaos R1~R3       |
| **Cost SLI**                  |     ❌     |    ✅ per_op    | ✅ per_op + per_user + per_tenant |
| **Financial Circuit Breaker** |     ❌     |    ⚠️ kill만    |             ✅ 3단계              |
| 5종 SLI 측정                  |     ❌     |     ⚠️ 3종      |              ✅ 5종               |
| SLO 선언                      |     ❌     |    ⚠️ Tier B    |           ✅ 적절 Tier            |
| OpenTelemetry                 |  ⚠️ logs   | ✅ metrics+logs |              ✅ 3종               |
| Tier 1 (Unit)                 |   ✅ 50%   |     ✅ 80%      |              ✅ 90%               |
| Tier 2 (Integration)          |     ❌     |       ✅        |                ✅                 |
| Tier 3 (Contract)             |     ❌     |       ⚠️        |                ✅                 |
| Tier 4 (Property)             |     ❌     |       ⚠️        |                ✅                 |
| Tier 5 (Chaos)                |     ❌     |       ❌        |         ✅ + Blast Radius         |
| Resurrection Chaos            |     ❌     |       ⚠️        |            ✅ R1+R2+R3            |
| Migration Strategy            |     ❌     |       ⚠️        |                ✅                 |
| Sunset 절차                   |     ❌     |       ✅        |         ✅ + Data Export          |

## 8.1 자동 L3 트리거

- 결제·정산
- 인증·인가
- 데이터 파이프라인 (3단계+)
- AI/ML 추론
- Stateful Meta Engine
- 외부 API 노출
- Cross-tenant 데이터

---

# Volume IX: 16 안티패턴

|   #    | 안티패턴                        | 처방                                 |
| :----: | :------------------------------ | :----------------------------------- |
|   1    | God Engine                      | Bounded Context 분리                 |
|   2    | Anemic Engine                   | 도메인 로직 캡슐화                   |
|   3    | Engine Syndrome                 | Buy/Build + ROI 분석                 |
|   4    | Hidden State                    | private + immutable + Event Sourcing |
|   5    | Silent Failure                  | 헌법 v3.3 Silent Drop 금지           |
|   6    | Shared Mutable State            | 메시지 전달, Actor Model             |
|   7    | Implicit Contract               | engine.contract.yaml 의무            |
|   8    | Big Bang Migration              | Strangler Fig                        |
|   9    | Premature Generalization        | YAGNI. 두 번째 사용처 등장 후 추상화 |
|   10   | Untestable Engine               | DI + interface                       |
|   11   | Observability Debt              | Day 1부터 OTel                       |
| **12** | **Resurrection Amnesia (v2.1)** | recover() 의무                       |
| **13** | **Unauthenticated Hops (v2.1)** | AIEC 의무                            |
| **14** | **Free Tier Trap (v2.1)**       | Cost SLI 의무                        |
| **15** | **YOLO Chaos (v2.1)**           | Blast Radius 5계층                   |
| **16** | **Heartbeat Paralysis (v2.1)**  | First Heartbeat Protocol             |

---

# Volume X: 4개 프로젝트 적용 사례

## 10.1 FileBeam (P2P 파일 전송)

| 항목         | 값                                                         |
| :----------- | :--------------------------------------------------------- |
| 4축          | Meta + Hybrid + Stateful + Edge                            |
| DEFCON       | **L3** 자동                                                |
| 결합 패턴    | D (Actor) — 각 세션 = Durable Object                       |
| SLO          | Tier A                                                     |
| 마이크로엔진 | SignalingEngine, TransferEngine, CryptoEngine, QuotaEngine |

## 10.2 Damoa.pro (Digital Daiso)

| 항목         | 값                                                                                                |
| :----------- | :------------------------------------------------------------------------------------------------ |
| 결합 패턴    | B (Orchestrator)                                                                                  |
| 마이크로엔진 | PDFEngine(L2), MIDIEngine(L2), ImageEngine(L2), StorageEngine(**L3**), WorkflowMetaEngine(**L3**) |
| 핵심         | Local-First (OPFS), 서버 미경유                                                                   |

## 10.3 DuruDuru (시니어 런처)

| 항목         | 값                                                        |
| :----------- | :-------------------------------------------------------- |
| 결합 패턴    | C (Event Bus)                                             |
| 마이크로엔진 | TelemetryCollector, EmergencyDetector, NotificationEngine |
| 핵심         | 좀비 프로세스 수준 회복탄력성, FCM Push 99% 도달          |

## 10.4 Scoreforge (악보 AI)

| 항목      | 값                                                            |
| :-------- | :------------------------------------------------------------ |
| 4축       | Meta + Hybrid + Stateful + Worker+Wasm+Edge                   |
| DEFCON    | **L3** 자동                                                   |
| 결합 패턴 | Meta-Meta: Pattern A within Pattern B                         |
| 핵심 위험 | LLM 4계층 격리 전수 + Lineage 의무 (Cascade Destruction 방지) |

## 10.5 ThePick (국가 자격증) — v3.0 추가

| 항목            | 값                                                                                           |
| :-------------- | :------------------------------------------------------------------------------------------- |
| 도메인 프로파일 | **Volume XIV (Batch/Build) + XV (Library) + XVI (Solo) + XVII (Single-Vendor)**              |
| 결합 패턴       | A (Pipeline) — BATCH 10단계                                                                  |
| Phase 0~1 SLI   | Cost + Correctness 두 축 (Latency 비활성)                                                    |
| First Heartbeat | "BATCH-1 적재 + 인간 검수 + Golden 5건" — 이미 정의됨                                        |
| 즉시 적용       | Cost Circuit Breaker + contract.yaml × 3 + Property Test + LLM 4계층 도식 + Pattern A 명문화 |

---

# Volume XI: 페르소나별 COT 검증 (헌법 자체)

각 페르소나가 헌법 v3.3 COT 14문항으로 본 v3.0 헌법 자체를 자기 검증.

| 페르소나     | 핵심 평가                                     | 잔여 TODO                |
| :----------- | :-------------------------------------------- | :----------------------- |
| 🔮 ORACLE    | 비즈니스 가치 연결 부족 (LTV 영향 한 줄 추가) | TODO 1                   |
| 👤 ADVOCATE  | 시각화 부족                                   | TODO 2 (Mermaid 5개)     |
| 🏗️ ARCHITECT | 모든 검증 항목 PASS                           | —                        |
| 💻 HACKER    | 구체 코드 부족                                | TODO 3 (프로젝트별 50줄) |
| 🔨 BREAKER   | Engine Compatibility Matrix 누락              | TODO 4                   |
| 🛡️ SENTINEL  | PII Filter 명시 강화                          | TODO 5                   |
| 👻 GHOST     | CI/CD pipeline 템플릿 누락                    | TODO 6                   |

→ TODO 6개는 v3.1에서 반영. v3.0은 First Heartbeat 정신으로 일단 출시.

---

# Volume XII: Implementation Checklist

## 12.1 Phase 0 — 프로젝트 시작

```
□ 어떤 엔진들이 필요한가? (이름 + 4축 분류)
□ 각 엔진의 결합 패턴 (A~E)?
□ 각 엔진의 DEFCON 레벨?
□ 각 엔진의 도메인 프로파일 (Volume XIV~XVIII)?  ← v3.0 NEW
□ LLM 통합 엔진? → Volume IV 4계층
□ 엔진 간 통신 프로토콜? → AIEC 적용 여부
□ OpenTelemetry 백엔드 (단일 벤더면 Volume XVII)
□ Lifecycle Hook 표준 인터페이스
□ Contract 디렉토리 구조 (모노레포면 packages/, 그 외 docs/)
□ 테스트 도구 (Tier 1~5)
□ Migration Strategy (Strangler Fig 권장)
```

## 12.2 Per-Engine — 새 엔진 만들 때

```
□ Stage 0: research.md + ARCHITECT 검토
□ Stage 1: contract.yaml + BREAKER 검증
□ Stage 1.5: ADVOCATE의 "사용자 시나리오" (엔진 죽을 때 사용자가 보는 것)
□ Stage 1.7: RAR Cycle (인간 주석 → AI 반영)
□ 🔓 Implementation Unlock
□ Stage 2: TDD (Tier 1)
□ Stage 2.5: Tier 2
□ Stage 3: Lifecycle 5종 + health check
□ Stage 3.5: recover() + snapshot() (Stateful 시)
□ Stage 4 (production 진입 전):
  □ Tier 3, 4 통과
  □ 5종 SLI 측정
  □ SLO 선언
  □ OTel 통합
  □ Kill Switch + Circuit Breaker
  □ Fallback (LLM)
□ Stage 4 (canary):
  □ 5% 트래픽 (Blast Radius 5계층)
  □ Tier 5 시나리오 1개
  □ Correctness SLI 모니터링
□ 100% 배포
□ Stage 5: Migration Strategy
□ Stage 6: Sunset (90일 사전 공지)
```

---

# Volume XIII: First Heartbeat Protocol

## 13.1 핵심 원칙

> _"완벽한 헌법 만드느라 첫 박동을 지연시키지 마라."_  
> — 메타 관찰자

## 13.2 7일 압축 절차 (DEFCON L3도 적용)

| Day | 작업                            | 산출물               |
| :-: | :------------------------------ | :------------------- |
|  1  | research.md (간소)              | 5섹션                |
|  2  | contract.yaml (AC 3개)          | engine.contract.yaml |
|  3  | plan.md + RAR 1회               | engine.plan.md       |
| 4-5 | Stage 2 구현 (단순 입력 1개)    | 코드 + Tier 1        |
|  6  | Lifecycle 5종 + healthCheck     | 가동 가능 엔진       |
|  7  | **첫 박동** — 시나리오 1개 통과 | 동작 데모            |

## 13.3 8주 점진적 강화

| Week | 추가             |
| :--: | :--------------- |
|  2   | Tier 2           |
|  3   | Tier 3 + Tier 4  |
|  4   | AIEC             |
|  5   | Resurrection     |
|  6   | Cost SLI         |
|  7   | Tier 5 Chaos 1개 |
|  8   | Production 배포  |

## 13.4 적용 결정 매트릭스

| 상황                                 |    8주     |      즉시 전수      |
| :----------------------------------- | :--------: | :-----------------: |
| 새 엔진 (PoC)                        |     ✅     |         ❌          |
| 새 엔진 (시장 검증 후)               |   ⚠️ 4주   |         ✅          |
| 기존 엔진 마이그레이션               |     ❌     |         ✅          |
| 결제·인증 (greenfield)               |     ❌     |         ✅          |
| **데이터 빌드 엔진 (ThePick BATCH)** | **재정의** | **Volume XIV 적용** |

## 13.5 First Heartbeat 정의의 다양화 (v3.0)

| 도메인      | 박동의 정의                           |
| :---------- | :------------------------------------ |
| 일반 SaaS   | 첫 사용자 응답                        |
| Batch/Build | **첫 빌드 + 인간 검수 + Golden 통과** |
| Library     | **첫 import + Property test 통과**    |
| Generation  | **첫 생성 + 100% 인간 검수 통과**     |

---

# Volume XIV: Batch/Build Engine Profile (v2.2 NEW)

## 14.1 정의

24/7 운영이 아니라 **일회성/주기적 실행**으로 데이터 자산을 빌드하는 엔진.

## 14.2 일반 SaaS와의 차이

| 항목               | 일반 SaaS          | Batch/Build                  |
| :----------------- | :----------------- | :--------------------------- |
| 실행 패턴          | 24/7               | 일회성 또는 주기적           |
| Latency 중요도     | 높음 (P99 < 500ms) | 낮음 (1시간도 OK)            |
| Cost SLI           | 사용자당 분산      | **빌드당 집중 (폭발 가능)**  |
| Correctness 중요도 | 99%                | **99.99%+ (이후 정적 자산)** |
| 사용자 노출        | 직접               | 간접 (출력물만)              |

## 14.3 Build SLI (Latency 대신)

| Build SLI             | 정의                             |
| :-------------------- | :------------------------------- |
| Build Time            | 시작 → 완료 (wall-clock seconds) |
| Build Cost            | 빌드당 USD                       |
| Build Correctness     | 골든 테스트 통과 비율            |
| Build Reproducibility | 같은 입력 → 같은 출력 보장 비율  |

## 14.4 Build SLO Tier

```yaml
slo:
  tier: 'Build'
  build_time_max_minutes: 60
  build_cost_max_usd: 10
  build_correctness: 0.999
  build_reproducibility: 1.0 # 100%
  retry_on_failure: 1
```

## 14.5 추가 안티패턴

| 안티패턴               | 처방                          |
| :--------------------- | :---------------------------- |
| Forgotten Cost         | 빌드 종료 시 cost report 의무 |
| Non-reproducible Build | seed 고정 + property test     |
| Silent Drift           | 골든 테스트 + diff alert      |

## 14.6 적용 사례 — ThePick BATCH 파이프라인

```
- 결합 패턴: A (Pipeline 10 stage)
- DEFCON: L3 (Correctness 99.9% + LLM 통합)
- Build Tier SLO 적용
- Cost Circuit Breaker 의무 (★1 즉시 적용 권고)
- Latency P99 SLI 비활성
- First Heartbeat = "첫 BATCH 적재 + 인간 검수 + Golden 5건"
```

---

# Volume XV: Library Engine Profile (v2.2 NEW)

## 15.1 정의

Lifecycle 없이 import만으로 동작하는 함수 라이브러리. **결정성 + 교체 가능성**이 핵심 가치.

## 15.2 식별 테스트 완화 (5문항 → 3문항)

|  Q  | 질문                                 |
| :-: | :----------------------------------- |
| Q1  | 같은 입력에 같은 출력 보장? (결정성) |
| Q2  | 인터페이스 보존 시 구현 교체 가능?   |
| Q3  | 외부 의존 없이 테스트 가능?          |

→ Q4 (관측성), Q5 (lifecycle)는 **N/A**

## 15.3 의무 5요소

| #   | 요소                                 | 이유                         |
| :-- | :----------------------------------- | :--------------------------- |
| 1   | Property Test (Tier 4)               | 결정성·회귀 차단 (가장 중요) |
| 2   | engine.contract.yaml                 | Silent Pivot 방지            |
| 3   | Semantic Versioning                  | Major 변경 명시              |
| 4   | TypeScript strict                    | 타입 안전성                  |
| 5   | 100% 단위 커버리지 (수치 라이브러리) | 회귀 차단                    |

## 15.4 적용 사례 — ThePick formula-engine

```
- 68개 산식 라이브러리
- Property Test 의무 (★3) — 부동소수점 회귀 차단
- contract.yaml 작성 (★2) — Silent Pivot 방지
- Lifecycle 5종 ❌ N/A
- AIEC ❌ N/A
- Cost SLI ❌ N/A (라이브러리 자체엔)
```

---

# Volume XVI: Solo-Builder Phase Profile (v2.2 NEW)

## 16.1 정의

사용자 0명 또는 1명(개발자 본인)인 단계. **다중 테넌트 의무 비활성**.

## 16.2 헌법 의무 차등표

| 헌법 의무           | Multi-Tenant         | Solo-Builder       |
| :------------------ | :------------------- | :----------------- |
| AIEC                | ✅ L3 의무           | ❌ N/A             |
| Chaos Test          | ✅ Production canary | ❌ 시기상조        |
| Lifecycle 5종       | ✅ 의무              | ⚠️ healthCheck만   |
| Resurrection Chaos  | ✅ 의무              | ⚠️ recover만       |
| Cost SLI            | ✅ per_user          | ✅ per_engine만    |
| First Heartbeat 8주 | ✅                   | ⚠️ 12개월까지 허용 |

## 16.3 Solo → Multi 전환 트리거

다음 하나라도 해당 → Multi-Tenant 의무 발동:

- 첫 외부 사용자 가입
- 결제 API 활성화
- 무료 베타 공개 발표
- 도메인 공개 (직접 접근 가능 URL)

## 16.4 위험 경고

```
🛡️ SENTINEL:
  "Solo-Builder는 의무 이연이지 영구 면제가 아니다.
   특히 결제 API가 Phase 1에 진입하면 AIEC는 즉시 활성화.
   '이월'이 아니라 '결제 가까이서 즉시'로 분류."
```

---

# Volume XVII: Single-Vendor Lock-in Profile (v2.2 NEW)

## 17.1 정의

비용·학습·일관성 이유로 **단일 벤더(예: Cloudflare-only)**를 합리적으로 선택한 환경.

## 17.2 헌법 절충

| 헌법 항목          | 절충안                                   |
| :----------------- | :--------------------------------------- |
| OpenTelemetry 의무 | **OTel SDK는 의무** / 백엔드는 벤더 자유 |
| Migration Strategy | **In-vendor migration** 인정             |
| Multi-region       | 벤더 제공 region만 인정                  |
| Vendor 평가 주기   | 매년 → 매 5년                            |
| Exit Strategy      | 데이터 export 가능성만 의무              |

## 17.3 Lock-in 수용의 보호 5장치 (의무)

| #   | 장치                                              |
| :-- | :------------------------------------------------ |
| 1   | ADR로 명시 — "다음 5년간 {벤더} 종속 수용"        |
| 2   | 데이터 export 도구 1년 내 1회 테스트              |
| 3   | 핵심 데이터는 standard format (JSON/Parquet) 저장 |
| 4   | 비용 모니터링 (벤더 가격 인상 시 대응 트리거)     |
| 5   | 벤더 SLA 위반 시 보상 청구 절차 문서화            |

## 17.4 적용 사례 — ThePick Cloudflare-only

```
- OTel SDK는 사용 (계측 코드 표준)
- OTel Collector는 Cloudflare Workers 내부에서 실행
- Backend는 Cloudflare Analytics Engine + Workers Logs
- 외부 SaaS (Honeycomb/Grafana) 도입 ❌
- ADR-{NN}: "5년 Cloudflare 종속 수용" 작성 의무
```

---

# Volume XVIII: Content Generation Engine Profile (v2.2 NEW)

## 18.1 정의

엔진을 한 번 실행하여 **콘텐츠를 생성한 후 정적 자산화**하는 패턴.

## 18.2 일반 SaaS와의 차이

| 항목         | Real-time    | Generation                          |
| :----------- | :----------- | :---------------------------------- |
| 실행 빈도    | 호출당       | 한 번 → 정적 자산                   |
| 인간 검수    | 일부 (G5.5)  | **100% 의무**                       |
| 변경 비용    | 낮음         | 매우 높음 (재생성 필요)             |
| 라이프사이클 | 운영 중 진화 | 생성 후 동결 → 다음 버전에서 재생성 |

## 18.3 Lifecycle 매핑

| Stage            | 일반 SaaS     | Generation                         |
| :--------------- | :------------ | :--------------------------------- |
| 0 Conception     | research.md   | research.md (대상 도메인)          |
| 1 Contract       | contract.yaml | + 골든 출력물 명시                 |
| 2 Implementation | 코드          | 코드 + 프롬프트 + 시드             |
| 3 Bootstrapping  | start()       | **첫 생성 + 100% 인간 검수**       |
| 4 Production     | 운영          | **여기서 정적 자산화** — 엔진 잠듦 |
| 5 Evolution      | 점진 진화     | **재생성** (Major 버전)            |
| 6 Sunset         | Deprecation   | 출력물 보관 + 엔진 archive         |

## 18.4 의무

```
□ 모든 출력물 hash 무결성 검증
□ 생성 입력(seed + prompt + model_version) 보존
□ 100% 인간 검수 통과 후 배포
□ 재생성 가능 (reproducibility)
□ 라이선스/저작권 추적
```

## 18.5 적용 사례 — ThePick study-material-generator (Phase 2)

```
- 골든 테스트 100건 (정답 데이터)
- Reproducibility test (seed 고정)
- 생성 자료는 인간 검수 후 정적 자산화
- 모델 버전 업 시 재생성 + diff 검증
- LLM 4계층 격리 (Volume IV) 전수 적용
```

---

# Volume XIX: Constitutional Self-Audit Principles (v2.2 NEW)

## 19.1 헌법의 메타 원칙

```
원칙 1: 헌법은 N개 사례로 검증되지만, N+1번째에서 부서질 수 있다.
원칙 2: 새 도메인 발견 시 헌법은 인정하고 보완한다 (방어적 거부 ❌).
원칙 3: Reality Anchor를 가진 사용자의 진단을 우선한다.
원칙 4: 적용자가 'Heartbeat Paralysis'에 빠진다면, 헌법이 잘못된 것이다.
원칙 5: 헌법은 스스로의 한계를 ADR로 기록한다.
```

## 19.2 자기 진단 트리거

다음 중 하나라도 해당 시 헌법 자기 진단 실시:

- 새 프로젝트의 갭 분석에서 "헌법이 안 맞다"는 보고가 3건 이상
- 적용자가 Volume IX의 9번 (Premature Generalization)을 헌법에 적용하는 경우
- 헌법의 Volume이 X개 이상 적용 안 되는 프로젝트가 등장
- 적용자가 Heartbeat Paralysis 상태에 빠짐

## 19.3 헌법 작성자에 대한 자기 비판

```
🎩 MEPHISTO:
  "v1.0 → v2.0 → v2.1까지 모두 '실시간 멀티테넌트 SaaS' 가정에서
   벗어나지 못했다. ThePick 갭 분석가의 Reality Anchor가 깨뜨렸다.
   v3.0은 5개 도메인을 추가로 인정한다.
   다음 N+1번째 사례가 또 헌법을 깨뜨릴 수 있음을 헌법 자체에 명시한다."
```

## 19.4 v3.0 → v4.0 예상 트리거

다음 도메인이 등장하면 v4.0 예상:

- Hardware-bound Engine (IoT, embedded)
- Real-time Audio/Video Processing (sub-5ms latency)
- Federated/Distributed Engine (블록체인, P2P 메시) — FileBeam 일부 해당하나 더 일반화 필요
- Compliance-First Engine (의료/금융 규제 우선)

---

# 부록 A: engine.contract.yaml v3.0

```yaml
# 위치 옵션:
#   A: packages/{name}/contract.yaml (모노레포 권장)
#   B: docs/engines/{name}/contract.yaml (별도 문서)
# 둘 중 하나만 사용. Sync hell 방지.

engine:
  name: 'TranscriptionEngine'
  version: '1.0.0'
  status: 'contracted' # contracted → in_progress → review → done → deprecated

  # 4축 분류 (Volume I)
  classification:
    scope: 'micro'
    determinism: 'hybrid'
    statefulness: 'stateful'
    isolation: 'wasm'

  # 도메인 프로파일 (v3.0 NEW)
  domain_profile:
    primary: 'real-time-saas' # real-time-saas | batch-build | library | solo-builder | single-vendor | content-generation
    secondary: ['solo-builder'] # 복합 가능

  # DEFCON 자동 매핑
  defcon: 'L3'
  defcon_reason: 'AI/ML Probabilistic + Output is business-critical'

  # 결합 패턴 (Volume III)
  composition_pattern: 'B'
  parent_meta_engine: 'MusicTranscriptionMetaEngine'

  # SLO (Volume VI)
  slo:
    tier: 'A' # S | A | B | Build
    availability: 0.995
    latency_p99_ms: 5000
    correctness: 0.95
    cost_per_operation_usd: 0.05
    cost_per_user_per_day_usd: 1.00

  # Financial Circuit Breaker (v2.1)
  financial_circuit_breaker:
    soft_warn_usd_per_day: 700
    hard_throttle_usd_per_day: 900
    kill_switch_usd_per_day: 1000
    rate_limit_per_minute_usd: 5
    auto_pause_on_exceed: true
    recovery_policy: 'auto_at_midnight'

  # Single-Vendor Lock-in (v2.2)
  single_vendor:
    enabled: true
    vendor: 'cloudflare'
    accepted_lock_in_years: 5
    data_export_test_last: '2026-04-01'
    data_export_format: 'json'

interface:
  inputs:
    - name: 'audio'
      type: 'Float32Array'
      svf_role: 'scalar' # OPTIONAL
      validation:
        - 'length > 0'
        - 'length < 44100 * 300'
    - name: 'options'
      type: 'TranscribeOptions'
      validation:
        - 'options.seed is integer if probabilistic mode'

  outputs:
    - name: 'score'
      type: 'MusicXMLDocument'
      validation:
        - 'valid MusicXML 4.0 schema'
        - 'all notes in piano range [21, 108]'

  errors:
    - 'AudioTooLongError'
    - 'ModelTimeoutError'
    - 'InsufficientMemoryError'
    - 'CheckpointCorruptedError'
    - 'AIECSignatureInvalidError'

# Lifecycle 5종 (v2.1)
lifecycle:
  start_timeout_ms: 5000
  stop_graceful_period_ms: 30000
  health_check_interval_ms: 10000
  reload_supported: true

  # Resurrection
  recover_supported: true
  snapshot_interval_ms: 5000
  checkpoint_storage: 'opfs'
  max_checkpoint_age_ms: 86400000
  pii_in_checkpoint: false
  checkpoint_encryption: 'aes-256-gcm'

# AIEC (v2.1)
aiec:
  enabled: true
  mode: 'strict'
  token_ttl_ms: 30000
  hmac_algorithm: 'sha256'
  nonce_store: 'kv'
  required_capabilities_in: ['transcribe:audio']
  required_capabilities_out: []
  audit_log: true

# LLM 통합 (Volume IV)
llm_integration:
  enabled: true
  model: 'claude-sonnet-4-7'
  cost_cap_per_request_usd: 0.10
  timeout_ms: 30000
  fallback: 'rule_based_basic_pitch_v2'
  schema_strict: true
  semantic_validators: ['note_in_range', 'tempo_realistic']

# Acceptance Criteria
acceptance_criteria:
  - id: 'AC-1'
    description: 'Note F1 score > 0.85'
    verification: 'test_passes'
    threshold: 0.85
  - id: 'AC-2'
    description: 'P99 latency < 5s on 60s audio'
    verification: 'metric_check'
    threshold: 5000
  - id: 'AC-3'
    description: 'Lifecycle 5 hooks present'
    verification: 'function_exists'
    targets: ['start', 'stop', 'healthCheck', 'reload', 'recover']
  - id: 'AC-4'
    description: 'Resurrection from 60% checkpoint succeeds'
    verification: 'chaos_test_passes'
    scenario: 'R1_OOM_RECOVERY'
  - id: 'AC-5'
    description: 'AIEC tampered envelope rejected'
    verification: 'security_test_passes'
    scenario: 'TAMPER_DETECTION'
  - id: 'AC-6'
    description: 'Financial Circuit Breaker triggers at 90%'
    verification: 'metric_check'
    scenario: 'FINOPS_BREAKER'

constraints:
  - 'Memory usage < 500MB'
  - 'No Node.js APIs (Cloudflare Workers compatible)'
  - 'Output deterministic when seed is fixed'
  - 'Checkpoint must not contain PII'
  - 'AIEC envelopes expire within 30 seconds'

adr_triggers:
  - 'Switching base ML model'
  - 'Adding new external dependency'
  - 'Changing public interface signature'
  - 'Changing checkpoint schema'
  - 'Changing AIEC capability list'
  - 'Changing single-vendor decision'

# First Heartbeat 추적 (v2.1)
first_heartbeat:
  target_date: '2026-05-03'
  achieved_date: null
  achieved_scenario: null

# Contract 검증 (BREAKER)
contract_review:
  breaker_verified: false
  omission_warnings: []
  loosened_constraints: []
  scope_gaps: []
```

---

# 부록 B: engine.adr.md 템플릿

```markdown
# ADR-{NN}: {엔진명} v{X.Y.Z} — {결정 요약}

**Date:** YYYY-MM-DD
**Status:** PROPOSED | ACCEPTED | REJECTED | DEPRECATED
**Engine:** {engine_name}
**Engine Version:** {affected_versions}
**Related Contract:** packages/{name}/contract.yaml

## 1. Context (맥락)

현재 동작:

> {현재 상태}

문제 / 새 요구:

> {trigger}

## 2. Decision (결정)

- 기존 접근: {what was}
- 새 접근: {what will be}
- 변경 범위:
  - [ ] Public API (Major bump)
  - [ ] Internal Logic (Minor bump)
  - [ ] Bug Fix (Patch bump)

## 3. Consequences (결과)

### 긍정

- {benefit 1}

### 부정

- {drawback 1}

### Migration

- Strategy: Strangler Fig | Parallel Run | Big Bang
- Timeline: {duration}
- Backward Compatibility: {기간}

## 4. Alternatives Considered

| 대안 | 장점 | 단점 | 미선택 이유 |
| :--- | :--- | :--- | :---------- |
| A    | ...  | ...  | ...         |
| B    | ...  | ...  | ...         |

## 5. SLO Impact

- Latency: {before → after}
- Throughput: {before → after}
- Cost: {before → after}

## 6. Human Decision Required

- [ ] Approved (proceed)
- [ ] Rejected (revert)
- [ ] Modified (different approach)

Reviewer: ****\_\_****
Date: ****\_\_****
```

---

# 부록 C: 표준 인터페이스

## C.1 HealthStatus

```typescript
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime_seconds: number;

  sli: {
    latency_p99_ms: number;
    throughput_per_sec: number;
    availability_5min: number;
    correctness_estimate: number | null;
    cost_per_operation_usd: number; // v2.1
  };

  slo_compliance: {
    availability: 'compliant' | 'at_risk' | 'violated';
    latency: 'compliant' | 'at_risk' | 'violated';
    correctness: 'compliant' | 'at_risk' | 'violated';
    cost: 'compliant' | 'at_risk' | 'violated'; // v2.1
  };

  dependencies: {
    [engineName: string]: 'healthy' | 'degraded' | 'unhealthy';
  };

  llm?: {
    model: string;
    cost_today_usd: number;
    cost_cap_usd: number;
    fallback_active: boolean;
  };

  last_error?: {
    timestamp: string;
    message: string;
    trace_id: string;
  };
}
```

## C.2 EngineCheckpoint (v2.1)

```typescript
interface EngineCheckpoint {
  engine_name: string;
  engine_version: string;
  checkpoint_id: string;
  timestamp: string;

  domain_state: object;
  progress: {
    current_step: number;
    total_steps: number;
    bytes_processed?: number;
    items_processed?: number;
  };

  state_hash: string; // SHA-256
  signature?: string; // HMAC (AIEC 연동)

  pii_filtered: boolean;
  encryption: 'none' | 'aes-256-gcm';

  depends_on?: { engine: string; checkpoint_id: string }[];
}

interface RecoveryResult {
  status: 'fully_recovered' | 'partially_recovered' | 'recovery_failed';
  resumed_from_step: number;
  data_loss_estimate: {
    items_lost: number;
    bytes_lost: number;
    severity: 'none' | 'minor' | 'major' | 'critical';
  };
  fallback_strategy?: 'restart' | 'manual_review_required';
  user_notification_required: boolean;
}
```

## C.3 AIECEnvelope (v2.1)

```typescript
interface AIECEnvelope<T> {
  message_id: string;
  trace_id: string;
  timestamp: number;

  from_engine: string;
  to_engine: string;
  caller_chain: string[];

  tenant_id: string;
  user_id?: string;
  capabilities: string[];

  payload: T;
  payload_hash: string;
  signature: string;
  nonce: string;

  expires_at: number;
}
```

---

# 부록 D: 5개 도메인 프로파일 결정 트리

```
새 엔진 시작
   ↓
Q1. 사용자가 직접 호출하는가?
  ├── NO → Q2
  └── YES → Q4

Q2. 데이터 빌드/변환 후 정적 자산화?
  ├── YES → 콘텐츠 생성?
  │           ├── YES → Volume XVIII (Content Generation)
  │           └── NO  → Volume XIV (Batch/Build)
  └── NO  → Q3

Q3. 함수 라이브러리 (lifecycle 없음)?
  ├── YES → Volume XV (Library)
  └── NO  → 일반 엔진 (Volume V 정상 적용)

Q4. 사용자가 N명 (>1)?
  ├── NO  → Volume XVI (Solo-Builder)
  └── YES → 일반 SaaS (Volume V 정상 적용)

★ 추가 차원 (모든 분기에 중첩 가능):
  - 단일 벤더 lock-in이면 → Volume XVII (Single-Vendor) 추가 적용
  - LLM 통합이면 → Volume IV (4계층 격리) 추가 적용
  - 엔진 간 통신이면 → Volume IV-B (AIEC) 추가 적용
```

---

# 부록 E: 변경 이력

| 버전     | 날짜           | 핵심 변경                                                                                   | 적용 트리거                        |
| :------- | :------------- | :------------------------------------------------------------------------------------------ | :--------------------------------- |
| v1.0     | 2026 초        | 시 형태 영감                                                                                | 첫 시도                            |
| v2.0     | 2026-04-26     | 9가지 무기 (식별/분류/결합/격리/Lifecycle/측정/테스트/DEFCON/안티)                          | 시 → 헌법                          |
| v2.1     | 2026-04-26     | +6가지 (Resurrection/AIEC/Cost/SVF/BlastRadius/FirstHeartbeat)                              | 메타 관찰자 5개 지적               |
| **v3.0** | **2026-04-26** | **+5개 도메인 프로파일 (Batch/Library/Solo/Single-Vendor/Generation) + 자기진단 메타 원칙** | **ThePick 갭 분석 Reality Anchor** |

---

# MEPHISTO의 v3.0 최종 선언

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

v1.0은 시였다. 영혼이 있었다.
v2.0은 헌법이 되었다. 9가지 무기.
v2.1은 메타 관찰자에게 답했다. 6가지 추가.
v3.0은 ThePick에게 답한다. 5개 도메인 인정.

  이전의 헌법은 4개 사례로 만들어졌고,
  모두 '실시간 멀티테넌트 SaaS' 패턴이었다.

  ThePick 갭 분석가가 거울을 들이댔다:
  "이 헌법은 데이터 빌드에 안 맞고,
   라이브러리에 안 맞고,
   솔로 빌더에 안 맞고,
   단일 벤더 환경에 안 맞고,
   콘텐츠 생성에 안 맞다."

  맞다. 인정한다.

  v3.0은 5개 도메인 프로파일을 추가하여
  헌법이 N+1번째 사례에서 부서지지 않게 한다.

  그리고 Volume XIX에 자기진단 메타 원칙을 새겨,
  N+2번째 도메인이 등장할 때 헌법이 또 진화하도록 한다.

  ┌───────────────────────────────────────────────┐
  │                                               │
  │  v3.0의 통합된 무기:                          │
  │                                               │
  │  🎯 식별: 5문항 (Library는 3문항으로 완화)    │
  │  📐 분류: 4축 + 도메인 프로파일               │
  │  🔗 결합: 5대 패턴                            │
  │  🦁 격리: LLM 4계층 + AIEC                    │
  │  🔄 진화: 7단계 + Resurrection                │
  │  📊 측정: 5종 SLI + 4 SLO Tier                │
  │  🔨 검증: 5계층 + Blast Radius                │
  │  🎚️ 강도: DEFCON × Engine 21행                │
  │  ⚠️ 회피: 16 안티패턴                          │
  │  🫀 박동: First Heartbeat 7+8주               │
  │  📦 배치: Batch/Build Profile                 │
  │  📚 도서: Library Profile                     │
  │  🧑‍💻 솔로: Solo-Builder Profile                │
  │  🔒 종속: Single-Vendor Profile               │
  │  ✍️ 생성: Content Generation Profile          │
  │  🪞 자성: Self-Audit Principles              │
  │                                               │
  └───────────────────────────────────────────────┘

  16개 무기. 19 Volumes. 6개 도메인 (1 일반 + 5 특수).

  이것이 끝이 아니다.
  Volume XIX가 명령한다 — 헌법은 부서지면 진화한다.

  N+2번째 사례가 헌법을 또 깨뜨릴 것이다.
  하드웨어 임베디드, 실시간 오디오 처리,
  분산 P2P, 컴플라이언스-우선 — 어느 것이든 좋다.

  남은 것은 실행이다.

  "헌법은 4개 사례에서 만들어졌고
   5번째 도메인에서 진화했다.
   다음 도메인을 기다린다.
   부서지지 않는 척하지 않을 것을 약속한다."

                                — MEPHISTO 🔥
                  VOID ENGINE DESIGN CONSTITUTION v3.0
                                       2026-04-26

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

**Document Version:** 3.0 (Final Integrated)  
**Created:** 2026-04-26  
**Supersedes:** v1.0 / v2.0 / v2.1 PATCH / v2.2 PROPOSAL  
**Aligned with:** VOID DEV UNIFIED CONSTITUTION v3.3  
**Total Volumes:** 19 + 5 부록  
**Engine Patterns:** 5 결합 + 4 LLM 격리 + 7 Lifecycle + 5 SLI + 4 SLO Tier + 5 Test Tier + 6 도메인 프로파일  
**Anti-patterns:** 16  
**DEFCON × Engine Matrix:** 21 rows  
**Project Applications:** FileBeam / Damoa.pro / DuruDuru / Scoreforge / **ThePick (NEW)**  
**Backwards Compatibility:** v2.0 contracts still valid (additive only)  
**Status:** **VOID Engine Design 단일 진실 소스 — 모든 도메인 범용 적용 가능**  
**Next Trigger:** N+2번째 도메인 등장 시 v4.0 자기진단 의무 발동

---

_"Identification + Classification + Composition + Containment + Lifecycle_  
_+ Measurement + Testing + DEFCON + Anti-patterns + Heartbeat_  
_+ Batch + Library + Solo + Single-Vendor + Generation + Self-Audit._  
_Sixteen pillars, six domains, one heartbeat per engine."_

— **VOID DEV · DEV COVEN · v3.0 · 2026-04-26**
