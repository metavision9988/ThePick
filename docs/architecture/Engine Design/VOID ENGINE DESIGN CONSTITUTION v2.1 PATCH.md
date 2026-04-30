# 🔥 VOID ENGINE DESIGN CONSTITUTION v2.1 PATCH

## 메타 관찰자 검토 반영판 — v2.0 → v2.1

> _"완벽한 헌법을 쓰느라 첫 박동을 지연시키지 마라._  
> _그러나 박동을 시작하기 전, 죽었을 때 어떻게 부활하는지는 정해놔야 한다."_  
> — MEPHISTO (메타 관찰자의 마지막 경고를 받아들이며)

---

**Version:** 2.1 (Patch on v2.0)  
**Date:** 2026-04-26  
**Patch Source:** 메타 관찰자(Meta-Observer) 5대 지적사항  
**Approach:** v2.0 본체는 그대로 유지. 5개 영역에 PATCH 적용 + 새 Volume 1개 신설  
**Aligned with:** VOID DEV UNIFIED CONSTITUTION v3.3  
**Backwards Compatibility:** v2.0 contract.yaml은 그대로 유효 (필드 추가만 발생, 제거 없음)

---

## 📑 v2.1 패치 구성

| 섹션    | 내용                                                           |
| :------ | :------------------------------------------------------------- |
| Part 0  | DEV COVEN 페르소나별 평가 회의록 (5개 지적사항 채택/거부 판정) |
| Part 1  | PATCH-1: Resurrection 메커니즘 (Volume V Stage 3 확장)         |
| Part 2  | PATCH-2: Zero-Trust 엔진 통신 (Volume IV 확장)                 |
| Part 3  | PATCH-3: Cost as 5th SLI (Volume VI 확장)                      |
| Part 4  | PATCH-4: S-V-F 매핑 옵션 (Volume I 확장)                       |
| Part 5  | PATCH-5: Chaos Blast Radius (Volume VII 확장)                  |
| Part 6  | 신설 Volume XIII: First Heartbeat Protocol — 첫 박동 지연 방지 |
| Part 7  | 안티패턴 갤러리 확장 (11 → 16)                                 |
| Part 8  | engine.contract.yaml v2.1 (전체 템플릿)                        |
| Part 9  | DEFCON × Engine 매트릭스 업데이트 (5개 차원 추가)              |
| Part 10 | v2.0 → v2.1 마이그레이션 가이드                                |

---

# Part 0: DEV COVEN 평가 회의록

## 0.1 회의 소집

```
🎩 MEPHISTO: "메타 관찰자가 5가지를 지적했다. 동조하기 전에 해체한다.
              모든 지적은 반론을 거친 후에야 헌법에 들어간다."
```

## 0.2 5개 지적사항 — 페르소나별 채택 판정

각 페르소나가 헌법 v3.3 Part 2.4의 COT 14문항을 적용하여 평가.

|  #  | 지적사항                       |         ORACLE         |       ADVOCATE        |         ARCHITECT         |         HACKER          |           BREAKER            |        SENTINEL         |        GHOST         |          **종합 판정**          |
| :-: | :----------------------------- | :--------------------: | :-------------------: | :-----------------------: | :---------------------: | :--------------------------: | :---------------------: | :------------------: | :-----------------------------: |
|  1  | Resurrection (부활 메커니즘)   |      ✅ LTV 직결       | ✅ "처음부터?"는 모욕 |  ✅ Lifecycle 진짜 누락   | ✅ OPFS 체크포인트 가능 |     ✅ Tier 5 Chaos 의무     | 🟡 PII 스냅샷 보안 추가 | ✅ WorkManager 표준  |       **★★★★★ 즉시 채택**       |
|  2  | Zero-Trust 엔진 통신           |   🟡 비용 유발 우려    |     🟡 UX 영향 X      |   ✅ v3.3 Part 10 정합    | 🟡 mTLS는 부정확, HMAC  |  ✅ Token tampering 테스트   |      ✅ 강력 동의       | ✅ Service Mesh 표준 |    **★★★★ 채택 (용어 정정)**    |
|  3  | Cost per Operation (5번째 SLI) | ✅ Unit Economics 핵심 |     🟡 UX 영향 X      |      ✅ FinOps 표준       | ✅ Cost meter 구현 가능 | ✅ Financial Circuit Breaker |      ✅ DDoS 방어       |  ✅ FinOps SLI 표준  |       **★★★★★ 즉시 채택**       |
|  4  | S-V-F 구조적 융합              |    🟡 진입장벽 우려    |     🟡 학습 곡선      | 🟡 Bounded Context로 충분 |   ❌ 명명 강제는 과잉   |     🟡 mapping 정도면 OK     |     🟡 보안 영향 X      |    🟡 운영 영향 X    | **★★★ 조건부 채택 (옵션 매핑)** |
|  5  | Chaos Blast Radius             |  ✅ 사용자 영향 차단   | ✅ 무고한 사용자 보호 | ✅ Production canary 정정 |  ✅ Feature flag 표준   |      ✅ 정말 빠진 부분       |   ✅ Tenant isolation   | ✅ Traffic shadowing |       **★★★★★ 즉시 채택**       |

## 0.3 종합 평가 (MEPHISTO)

```
✅ 즉시 채택 (3개): #1, #3, #5 — 만장일치 채택
✅ 채택 + 정정 (1개): #2 — 'mTLS' → 'Authenticated Inter-Engine Communication (AIEC)'
🟡 조건부 채택 (1개): #4 — 명명 강제 ❌ / 매핑 가이드 ✅

추가 발견:
  메타 관찰자의 마지막 경고 ("완벽 만드느라 첫 박동 지연시키지 마라") —
  이것은 단순한 격언이 아니라 헌법의 별도 항목이 되어야 한다.
  → Volume XIII (First Heartbeat Protocol) 신설
```

## 0.4 채택 거부의 트레이드오프 (#4 SVF 명명 강제)

```
🔨 BREAKER:
  "SVF를 inputs/outputs/constraints의 이름까지 바꾸는 것은
   '모두가 새 용어를 배워야 한다'는 비용을 발생시킨다.
   학습 곡선 = 1주, 발생하는 가치 = 가독성 약간 향상.
   ROI 음수다. 매핑 표(Volume I Part 1.4와 같은) 정도가 적정선이다."

💻 HACKER:
  "TypeScript/Rust/Python 어디에도 'scalars/vectors/fields'라는
   표준 명명은 없다. JSON Schema 표준과도 충돌한다.
   v2.0의 비유 보존(Part 1.4)이 이미 충분하다."

🎩 MEPHISTO 최종 판정:
  "철학은 코드의 종이 아니다. 비유로 빛나야 한다.
   강제하지 않고 권장 매핑만 제공한다."
```

---

# Part 1: PATCH-1 — Resurrection 메커니즘

## 1.1 변경 위치

**Volume V Stage 3 (Bootstrapping)** 확장 + **Stage 3.5 (Resurrection) 신설**

## 1.2 v2.0의 결함

```typescript
// v2.0 — Lifecycle 4종만 정의
interface EngineLifecycle {
  start(config: EngineConfig): Promise<void>;
  stop(graceful: boolean): Promise<void>;
  healthCheck(): Promise<HealthStatus>;
  reload(newConfig: EngineConfig): Promise<void>;
}
```

**누락된 시나리오:**

- FileBeam 10GB 전송 도중 OS가 Worker를 OOM kill
- Scoreforge 5분 오디오 처리 도중 사용자가 탭을 닫음
- Damoa.pro PDF 변환 50% 지점에서 디스크 공간 부족

→ `start()`로 처음부터 다시 시작 = **재앙**

## 1.3 v2.1의 강화 — Lifecycle 5종 + Recovery Protocol

```typescript
// v2.1 — Lifecycle 5종 (recover 추가)
interface EngineLifecycle {
  start(config: EngineConfig): Promise<void>;
  stop(graceful: boolean): Promise<void>;
  healthCheck(): Promise<HealthStatus>;
  reload(newConfig: EngineConfig): Promise<void>;

  // [v2.1 NEW] 비정상 종료 후 부활
  recover(checkpoint: EngineCheckpoint): Promise<RecoveryResult>;

  // [v2.1 NEW] 주기적 체크포인트 발행 (Stateful 엔진 의무)
  snapshot(): Promise<EngineCheckpoint>;
}
```

## 1.4 EngineCheckpoint 표준 구조

```typescript
interface EngineCheckpoint {
  // 메타데이터
  engine_name: string;
  engine_version: string; // 동일 major version 내에서만 복원 가능
  checkpoint_id: string; // UUID
  timestamp: string; // ISO 8601

  // 상태 (도메인별 정의)
  domain_state: object; // 엔진 고유의 상태 (직렬화 가능)
  progress: {
    current_step: number;
    total_steps: number;
    bytes_processed?: number;
    items_processed?: number;
  };

  // 무결성
  state_hash: string; // SHA-256 of domain_state
  signature?: string; // [v2.1 PATCH-2 연동] 변조 방지 HMAC

  // 보안 (PATCH-2와 연동)
  pii_filtered: boolean; // PII가 체크포인트에 포함되어 있는지
  encryption: 'none' | 'aes-256-gcm';

  // 의존성
  depends_on?: {
    engine: string;
    checkpoint_id: string;
  }[];
}
```

## 1.5 RecoveryResult 표준 구조

```typescript
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

## 1.6 Checkpoint 저장 위치 표준

| 환경                        | 저장 위치                         | 빈도                    |
| :-------------------------- | :-------------------------------- | :---------------------- |
| 브라우저 (Worker/Wasm)      | OPFS (Origin Private File System) | 매 step or 5초 단위     |
| 브라우저 (메인 스레드)      | IndexedDB                         | 매 step (작은 데이터만) |
| Cloudflare Edge (Stateful)  | Durable Objects Storage           | 매 message 처리 후      |
| Cloudflare Edge (Stateless) | KV (cold) + R2 (대용량)           | 큰 작업의 phase 단위    |
| 서버 (Node)                 | Local SQLite + S3 sync            | 주기적 fsync            |

## 1.7 Recovery 결정 트리

```
엔진 비정상 종료 감지
    ↓
Q1. 마지막 체크포인트 존재?
    ├── NO  → 사용자에게 처음부터 시작 안내 (UX: 사과 + 진행률 0% 명시)
    └── YES → Q2

Q2. 체크포인트 무결성(hash) 검증?
    ├── 실패 → 처음부터 시작 + 사용자 알림 + 로그 기록
    └── 통과 → Q3

Q3. 체크포인트 engine_version과 현재 version의 major가 동일?
    ├── 다름 → 처음부터 시작 + Migration 권장 알림
    └── 동일 → Q4

Q4. 의존 체크포인트(depends_on) 모두 존재?
    ├── 아님 → partially_recovered (부분 복구) + 손실 추정 보고
    └── 모두 → recover() 실행 → fully_recovered
```

## 1.8 DEFCON × Resurrection 의무

|     DEFCON     | 체크포인트 의무 | recover() 의무              | snapshot() 빈도    |
| :------------: | :-------------- | :-------------------------- | :----------------- |
|       L1       | ❌ 선택         | ❌ 선택                     | N/A                |
| L2 (Stateless) | ⚠️ 권장         | ⚠️ 권장                     | phase 단위         |
| L2 (Stateful)  | ✅ 의무         | ✅ 의무                     | message 단위       |
|       L3       | ✅ 의무         | ✅ 의무 + Tier 5 Chaos 통과 | message + 5초 단위 |

## 1.9 Tier 5 Chaos에 추가될 시나리오 (Resurrection Test)

```
시나리오 R1: "OOM 부활"
  Step 1: 엔진을 60% 진행시킨 상태에서 강제 종료
  Step 2: recover() 호출
  Step 3: 검증 — 60% 지점에서 정확히 재개되는가?
  Step 4: 검증 — 손실된 데이터가 0건인가?

시나리오 R2: "체크포인트 변조"
  Step 1: 체크포인트 파일을 외부에서 1바이트 수정
  Step 2: recover() 호출
  Step 3: 검증 — 무결성 검증 실패로 거부하는가?
  Step 4: 검증 — 사용자에게 명확한 메시지를 보내는가?

시나리오 R3: "버전 불일치 부활"
  Step 1: v1.0으로 체크포인트 생성
  Step 2: 엔진을 v2.0으로 업그레이드
  Step 3: recover() 호출
  Step 4: 검증 — Major version 차이를 감지하고 거부하는가?
```

---

# Part 2: PATCH-2 — Authenticated Inter-Engine Communication (AIEC)

## 2.1 메타 관찰자 지적의 정정

```
🛡️ SENTINEL:
  "메타 관찰자가 'mTLS 개념의 애플리케이션 레벨 적용'이라 표현했다.
   정확하지만 오해를 부른다.
   브라우저 환경에서 진짜 mTLS는 클라이언트 인증서를 의미하고,
   이는 일반 사용자 환경에서 사실상 불가능하다.

   우리가 필요한 것은:
   ① 엔진 간 호출 시 발신자 검증
   ② 데이터 무결성 검증
   ③ Replay attack 방어

   이를 'AIEC (Authenticated Inter-Engine Communication)'로 명명한다."
```

## 2.2 변경 위치

**Volume IV (LLM 격리)** 옆에 **Volume IV-B (AIEC)** 신설.

## 2.3 위협 모델

| 위협              | 설명                                      | DEFCON L3 의무 방어    |
| :---------------- | :---------------------------------------- | :--------------------- |
| **Bypass Attack** | 메타 엔진 우회하여 마이크로엔진 직접 호출 | 토큰 검증              |
| **Tampering**     | 메시지 페이로드 변조                      | HMAC 서명              |
| **Replay**        | 동일 메시지 재전송으로 중복 작업          | nonce + timestamp      |
| **Token Theft**   | 발급된 토큰의 탈취·재사용                 | 단기 토큰 (TTL ≤ 60초) |
| **Cross-Tenant**  | 다른 사용자의 컨텍스트로 호출             | tenant_id 강제 검증    |

## 2.4 AIEC 표준 메시지 봉투 (Envelope)

```typescript
interface AIECEnvelope<T> {
  // 식별
  message_id: string; // UUID, 중복 검출용
  trace_id: string; // OpenTelemetry trace ID
  timestamp: number; // Unix epoch ms

  // 발신/수신
  from_engine: string;
  to_engine: string;
  caller_chain: string[]; // 메타 → 마이크로 호출 경로

  // 권한
  tenant_id: string;
  user_id?: string; // PII 필터링 후 (해시 가능)
  capabilities: string[]; // ["read:audio", "write:score"]

  // 무결성
  payload: T;
  payload_hash: string; // SHA-256
  signature: string; // HMAC-SHA256(payload_hash + timestamp + nonce, shared_secret)
  nonce: string; // Replay 방어

  // TTL
  expires_at: number; // timestamp + 60_000 (60초)
}
```

## 2.5 발신자/수신자 검증 의무

```typescript
// 모든 엔진의 message handler 첫 줄
async function handleMessage<T>(envelope: AIECEnvelope<T>): Promise<Response> {
  // 1. TTL 검증 (Replay 방어)
  if (Date.now() > envelope.expires_at) {
    throw new AIECError('TOKEN_EXPIRED');
  }

  // 2. 무결성 검증
  const expectedHash = sha256(envelope.payload);
  if (expectedHash !== envelope.payload_hash) {
    throw new AIECError('PAYLOAD_TAMPERED');
  }

  // 3. 서명 검증
  const expectedSig = hmacSha256(
    envelope.payload_hash + envelope.timestamp + envelope.nonce,
    sharedSecret,
  );
  if (expectedSig !== envelope.signature) {
    throw new AIECError('SIGNATURE_INVALID');
  }

  // 4. Nonce 중복 검증 (KV/Redis 사용, TTL 60초)
  if (await nonceStore.exists(envelope.nonce)) {
    throw new AIECError('REPLAY_DETECTED');
  }
  await nonceStore.set(envelope.nonce, true, { ttl: 60 });

  // 5. Capability 검증
  if (!hasCapability(envelope.capabilities, requiredCapability)) {
    throw new AIECError('INSUFFICIENT_CAPABILITY');
  }

  // 6. 처리 시작
  return await processMessage(envelope.payload);
}
```

## 2.6 DEFCON × AIEC 의무

|         DEFCON          | TTL 검증 | 무결성 |  서명   |  Nonce  |       Capability       |
| :---------------------: | :------: | :----: | :-----: | :-----: | :--------------------: |
|           L1            |    ❌    |   ❌   |   ❌    |   ❌    |           ❌           |
|           L2            | ⚠️ 권장  |   ✅   | ⚠️ 권장 | ⚠️ 권장 |        ⚠️ 권장         |
|           L3            |    ✅    |   ✅   |   ✅    |   ✅    |           ✅           |
| **자동 L3 (결제·인증)** |    ✅    |   ✅   |   ✅    |   ✅    | ✅ + 매 호출 audit log |

## 2.7 적용 사례 — Damoa.pro

```
시나리오: 사용자가 PDF 변환 시도

기존 (v2.0):
  WorkflowMetaEngine → PDFEngine.convert(file)
  ↓
  악의 사용자가 fetch('/api/internal/pdf-engine/convert', ...)로 직접 호출 가능
  ↓
  Quota 우회, 무한 변환

v2.1 적용:
  WorkflowMetaEngine은 발급 권한이 있는 SHORT_SECRET을 알고 있음
  PDFEngine은 SHORT_SECRET를 알고 있음 (양측만 공유)

  WorkflowMetaEngine.convert(file):
    envelope = createEnvelope({
      from: "workflow",
      to: "pdf",
      payload: { file },
      tenant_id: user.id,
      capabilities: ["convert:pdf"],
      expires_at: Date.now() + 30000
    })
    PDFEngine.handleMessage(envelope)

  PDFEngine.handleMessage(envelope):
    ↑ 위 verify 단계 6개 모두 통과해야 처리

  악의 사용자 직접 호출:
    → 서명 검증 실패 → 거부
    → 탈취한 토큰 재사용 → Nonce 중복 검출 → 거부
    → 30초 후 만료 → TTL 검증 실패 → 거부
```

## 2.8 트레이드오프 인정

```
👻 GHOST:
  "AIEC는 호출당 약 0.2~0.5ms 오버헤드를 추가한다.
   초당 10,000 호출 환경에서는 측정 가능한 비용이다.
   따라서 L1 PoC에서는 비활성화, L3에서만 의무화한다."

🔨 BREAKER:
  "AIEC는 만능이 아니다. 양 엔진이 같은 호스트의 같은 메모리에 있다면
   메모리 변조는 막지 못한다. 신뢰 경계를 넘는 통신에 한정한다."
```

---

# Part 3: PATCH-3 — Cost as 5th SLI

## 3.1 변경 위치

**Volume VI Part 6.1**: 4종 SLI → **5종 SLI**

## 3.2 v2.0의 결함

v2.0은 LLM 엔진의 cost_cap만 명시. 그러나:

- Durable Objects 무한 메시지 루프 → 비용 폭발
- 잘못된 React 리렌더링 → Workers AI 무한 호출
- DDoS 공격 → Edge 비용 폭발 (수천 USD)
- WebGPU 메모리 누수 → 사용자 디바이스 배터리 폭발

## 3.3 v2.1의 강화 — 5종 SLI

```yaml
sli:
  # v2.0 기존 4종
  latency_p99_ms: 5000
  throughput_per_sec: 100
  availability: 0.995
  correctness: 0.95

  # [v2.1 NEW] Cost SLI
  cost_per_operation_usd: 0.05 # 단위 연산당 비용 상한
  cost_per_user_per_day_usd: 1.00 # 사용자당 일일 누적
  cost_per_tenant_per_day_usd: 50 # 테넌트당 일일 누적
  cost_per_engine_per_day_usd: 200 # 엔진 전체 일일 누적
```

## 3.4 비용 측정의 4단계

```
Tier 1: 직접 측정 가능 (LLM API, 외부 서비스)
  → 정확한 USD 단가 × 사용량

Tier 2: 추정 가능 (Cloudflare Workers, R2, KV)
  → CPU time × per-ms rate
  → Storage × per-GB rate

Tier 3: 비례 측정 (사용자 디바이스 자원)
  → CPU time → 배터리 소모 추정 (mAh)
  → Memory peak → 사용성 영향 추정

Tier 4: 측정 불가 (외부 영향)
  → 평판 비용 (사용자 분노 등)
  → SLI에서 제외, ORACLE이 별도 추적
```

## 3.5 Financial Circuit Breaker (재무적 서킷 브레이커)

```typescript
interface FinancialCircuitBreaker {
  thresholds: {
    soft_warn_usd: number; // 일 한도의 70% — 경고만
    hard_throttle_usd: number; // 일 한도의 90% — 처리 속도 50% 감속
    kill_switch_usd: number; // 일 한도의 100% — 완전 중단
  };

  // 폭발 감지 (단기 비용 급증)
  explosion_detection: {
    rate_limit_per_minute_usd: number; // 분당 비용 상한
    auto_pause_on_exceed: boolean;
  };

  // 회복 정책
  recovery_policy: 'manual' | 'auto_at_midnight' | 'tenant_self_service_topup';

  // 사용자 알림
  notifications: {
    on_soft_warn: ('email' | 'slack' | 'webhook')[];
    on_hard_throttle: ('email' | 'slack' | 'webhook')[];
    on_kill_switch: ('email' | 'slack' | 'webhook' | 'sms')[];
  };
}
```

## 3.6 SLO 템플릿 업데이트 (Volume VI Part 6.2)

### Tier S (Critical) — Cost 추가

```yaml
slo:
  availability: 99.95%
  latency_p99: 500ms
  correctness: 99.9%
  cost_per_operation_usd: 0.001
  error_budget_per_month: 21.6_minutes
  cost_budget_per_month_usd: 5000
```

### Tier A (Important) — Cost 추가

```yaml
slo:
  availability: 99.5%
  latency_p99: 5000ms
  correctness: 95.0%
  cost_per_operation_usd: 0.05
  error_budget_per_month: 3.6_hours
  cost_budget_per_month_usd: 1000
```

### Tier B (Standard) — Cost 추가

```yaml
slo:
  availability: 99.0%
  latency_p99: 30000ms
  correctness: 90.0%
  cost_per_operation_usd: 0.10
  error_budget_per_month: 7.2_hours
  cost_budget_per_month_usd: 200
```

## 3.7 새로운 안티패턴 — "Free Tier Trap"

```
🔮 ORACLE:
  "Cloudflare 무료 티어가 넉넉하다고 비용 모니터링을 안 하는 것 —
   이것이 v2.1의 새 안티패턴이다.
   '월 10만 요청 무료'는 광고이고, 11만 요청은 즉시 결제 시작이다.
   바이럴 한 번에 1000% 비용 점프가 발생한다."

처방:
  □ 모든 엔진은 Day 1부터 Cost SLI 측정
  □ 50% / 80% / 100% 알림 설정
  □ Kill Switch는 Cost에도 적용
```

---

# Part 4: PATCH-4 — S-V-F 옵션 매핑 (조건부 채택)

## 4.1 채택 거부의 명확화

```
🎩 MEPHISTO:
  "메타 관찰자는 contract.yaml의 inputs/outputs/constraints를
   scalars/vectors/field_rules로 바꾸자고 했다.
   이것은 채택하지 않는다.

   이유:
   1. JSON Schema 표준과 충돌
   2. TypeScript/OpenAPI 도구 호환성 깨짐
   3. 신규 개발자 학습 곡선 1주 추가
   4. 가치는 '가독성 약간 향상' — ROI 음수

   대신:
   문서 레벨에서 'S-V-F 매핑 가이드'를 권장 매핑으로 제공한다.
   강제하지 않는다."
```

## 4.2 권장 매핑 가이드 (Volume I Part 1.4 확장)

| 코드 영역             | 표준 명명 (계속 사용)        | S-V-F 철학 매핑 (참고용)    | 예시                  |
| :-------------------- | :--------------------------- | :-------------------------- | :-------------------- |
| 함수/메서드 입출력    | `inputs` / `outputs`         | **Scalars** (순수 데이터)   | `audio: Float32Array` |
| 인터페이스/이벤트/API | `interface` / `events`       | **Vectors** (방향성)        | `engine.transcribe()` |
| 검증 규칙/제약        | `constraints` / `validators` | **Field Rules** (장의 법칙) | `note in [21, 108]`   |
| Lifecycle 상태        | `state` / `phase`            | **Field State** (장의 상태) | `engine.status`       |
| 시간/순서             | `timestamps` / `sequence`    | **Time (T)**                | `created_at`          |

## 4.3 옵션: contract.yaml에 SVF 메타 주석

```yaml
# 표준 contract.yaml (변경 없음)
interface:
  inputs:
    - name: 'audio'
      type: 'Float32Array'
      # [v2.1 OPTIONAL] S-V-F 철학 매핑 (선택 사용)
      svf_role: 'scalar'
      svf_note: '도메인 입력 — 가공되지 않은 순수 데이터'
```

이 필드는 **선택적**이며, CI/CD는 검증하지 않는다. 단, 문서 생성 도구가 이를 활용해 철학 다이어그램을 자동 생성할 수 있다.

---

# Part 5: PATCH-5 — Chaos Test Blast Radius

## 5.1 v2.0의 결함

```
🔨 BREAKER:
  "v2.0 Volume VII는 'Production canary 5%'로 카오스 테스트를 한다고 했다.
   이것 자체가 위험하다. 5% 트래픽이 진짜 결제 사용자라면?
   카오스 테스트가 진짜 사고가 된다."
```

## 5.2 변경 위치

**Volume VII Tier 5 (Chaos Test)** 확장.

## 5.3 Blast Radius 통제 5계층

```
Layer 1: Tenant Isolation (테넌트 격리)
  → 카오스 테스트 전용 가상 테넌트 생성
  → 진짜 사용자 데이터는 절대 접근 불가
  → 예: tenant_id = "chaos-test-{date}"

Layer 2: Synthetic Traffic (합성 트래픽)
  → 진짜 사용자가 아닌 합성 봇이 트래픽 생성
  → 사용자가 영향을 받지 않음
  → 예: User-Agent: "VOID-Chaos-Bot/1.0"

Layer 3: Traffic Shadowing (트래픽 그림자)
  → 진짜 트래픽을 복제만, 응답은 사용자에게 미반환
  → 진짜 시스템에 부하만 시뮬레이션
  → 예: nginx mirror, Envoy traffic shadowing

Layer 4: Feature Flag Quarantine (기능 플래그 격리)
  → 카오스 시나리오는 Feature Flag로 ON/OFF
  → 즉시 비활성화 가능
  → 예: chaos_oom_test_enabled = false (기본값)

Layer 5: Kill Switch (즉시 중단)
  → 카오스 테스트 자체에 30초 자동 중단 타이머
  → 인간이 수동으로 즉시 중단 가능
  → 예: chaos_runner.abort() 단축키 또는 대시보드 버튼
```

## 5.4 카오스 시나리오별 권장 격리 레벨

| 시나리오                | 최소 격리 레벨                    |
| :---------------------- | :-------------------------------- |
| 메모리 80% 점유         | Layer 1 (Tenant Isolation)        |
| 의존 엔진 응답 5초 지연 | Layer 1 + 4                       |
| Network 50% 패킷 드롭   | Layer 1 + 2 (Synthetic만)         |
| 데이터 손상 시뮬레이션  | Layer 1 + 2 + 3 (Shadow만)        |
| OOM 강제 종료           | Layer 1 + 4 + 5                   |
| LLM API 응답 변조       | Layer 1 + 2 (절대 진짜 사용자 X)  |
| **결제·인증 카오스**    | **Layer 1 + 2 + 4 + 5 모두 의무** |

## 5.5 카오스 실행 표준 절차

```
Pre-flight 체크리스트:
  □ 카오스 시나리오의 격리 레벨 결정
  □ 영향 범위 명시 (어떤 엔진? 어떤 사용자?)
  □ 자동 중단 타이머 설정 (기본 30초, 최대 5분)
  □ Kill Switch 버튼 활성화 확인
  □ 모니터링 대시보드 준비
  □ 전담 인간 1명이 화면을 보고 있을 것

실행:
  □ 1단계: Staging 환경에서 100% 통과
  □ 2단계: Production 격리 환경 (Synthetic 트래픽만)
  □ 3단계: Production Shadow (응답 미반환)
  □ 4단계: Production Canary (1% 진짜 사용자, 30초 한정)
  □ 5단계: Production 점진 확장 (1% → 5% → 10%, 단계별 5분 관찰)

종료:
  □ 영향받은 사용자 추적 + 보상 (있으면)
  □ 데이터 손실 확인 (Lineage 분석)
  □ Postmortem (24시간 내) → CLAUDE.md 기록
```

## 5.6 카오스 테스트 안티패턴

| 안티패턴              | 증상                                 | 처방                           |
| :-------------------- | :----------------------------------- | :----------------------------- |
| **YOLO Chaos**        | 격리 없이 Production에 직접 카오스   | Layer 1 의무화                 |
| **Forgotten Chaos**   | 카오스 끝났는데 Feature Flag 안 끄기 | 자동 30초 타이머               |
| **Untested Recovery** | 카오스 일으키고 회복 검증 안 함      | recover() Tier 5 시나리오 의무 |
| **Silent Chaos**      | 카오스 결과를 사용자에게 알리지 않음 | Postmortem 의무                |

---

# Part 6: 신설 Volume XIII — First Heartbeat Protocol

## 6.1 메타 관찰자의 마지막 경고

```
메타 관찰자 인용:
  "가장 위험한 것은 완벽한 헌법을 만드느라
   첫 번째 엔진의 박동을 지연시키는 것입니다."

🎩 MEPHISTO:
  "이것은 단순한 격언이 아니다. 헌법의 영혼이다.
   v3.3 헌법은 '문서가 없으면 코딩 금지'를 강제한다.
   그러나 '문서를 완벽하게 만드느라 코딩을 시작 못 함'은 더 큰 죄다.

   v2.1은 'First Heartbeat Protocol'로 이 균형을 잡는다."
```

## 6.2 First Heartbeat Protocol — 첫 박동 7일 안에

새 엔진의 **첫 박동 (= 가장 단순한 입력으로 동작 확인)**을 7일 이내에 달성하기 위한 의무 프로토콜.

### 6.2.1 7일 압축 절차 (DEFCON L3 엔진도 적용)

| Day | 작업                                        | 산출물                     | 페르소나            |
| :-: | :------------------------------------------ | :------------------------- | :------------------ |
|  1  | research.md (간소화 — 기존 코드 분석만)     | 5섹션 research.md          | ARCHITECT           |
|  2  | contract.yaml (최소 AC 3개)                 | engine.contract.yaml       | ARCHITECT + BREAKER |
|  3  | plan.md + RAR Cycle 1회                     | engine.plan.md             | HACKER + 인간       |
| 4-5 | Stage 2 구현 (가장 단순한 입력 1개만)       | 코드 + Tier 1 Test         | HACKER              |
|  6  | Lifecycle 5종 hook 구현 + healthCheck       | 가동 가능 엔진             | HACKER              |
|  7  | **첫 박동** — 가장 단순한 시나리오 1개 통과 | 동작 데모 + SLI 0번째 측정 | 인간                |

### 6.2.2 First Heartbeat 후 — 점진적 강화

7일 후, 본 헌법의 모든 의무사항 (DEFCON L3 전수 검증)을 점진적으로 적용:

```
Week 2: Tier 2 (Integration) 테스트 추가
Week 3: Tier 3 (Contract) + Tier 4 (Property) 테스트 추가
Week 4: AIEC 통합 (PATCH-2)
Week 5: Resurrection 메커니즘 (PATCH-1)
Week 6: Cost SLI (PATCH-3)
Week 7: Tier 5 Chaos 시나리오 1개 (PATCH-5)
Week 8: Production 배포 (모든 의무 충족)
```

### 6.2.3 First Heartbeat가 강조하는 트레이드오프

```
🔮 ORACLE:
  "헌법은 안전을 위한 것이지, 안전을 핑계로 출시를 미루기 위한 것이 아니다.
   8주의 점진적 강화는 '7일 안에 동작하는 것'이라는 절대 우선순위를 흔들지 않는다."

🔨 BREAKER:
  "첫 박동 = 절대 프로덕션 노출 금지.
   First Heartbeat는 내부 검증용이다.
   8주차에 모든 의무 통과 후에야 사용자에게 노출한다."

🎩 MEPHISTO 최종:
  "헌법의 양면: 'No coding without contract' (v3.3)
   + 'No paralysis without heartbeat' (v2.1).
   두 줄은 모순이 아니다. 균형이다."
```

## 6.3 8주 vs 즉시 적용 결정 매트릭스

| 상황                        | First Heartbeat 8주 | 즉시 전수 적용 |
| :-------------------------- | :-----------------: | :------------: |
| 새 엔진 (PoC 단계)          |         ✅          |       ❌       |
| 새 엔진 (시장 검증 후)      |     ⚠️ 4주 압축     |       ✅       |
| 기존 엔진 마이그레이션      |         ❌          |       ✅       |
| 결제·인증 엔진 (greenfield) |   ❌ (안전 우선)    |       ✅       |
| 비즈니스 핵심 데이터        |         ❌          |       ✅       |

---

# Part 7: 안티패턴 갤러리 확장 (11 → 16)

v2.0의 11개 안티패턴에 5개 추가:

|  #  | 안티패턴                 | 증상                                | 처방                                   | 출처     |
| :-: | :----------------------- | :---------------------------------- | :------------------------------------- | :------- |
| 12  | **Resurrection Amnesia** | 죽으면 처음부터. 체크포인트 없음    | recover() 의무화 (PATCH-1)             | v2.1 NEW |
| 13  | **Unauthenticated Hops** | 엔진 간 호출 시 발신자 검증 없음    | AIEC 의무 (PATCH-2)                    | v2.1 NEW |
| 14  | **Free Tier Trap**       | 무료 한도 넘는 순간 비용 폭발       | Cost SLI 의무 (PATCH-3)                | v2.1 NEW |
| 15  | **YOLO Chaos**           | 격리 없이 Production 카오스         | Blast Radius 5계층 (PATCH-5)           | v2.1 NEW |
| 16  | **Heartbeat Paralysis**  | 완벽한 헌법 만드느라 코딩 시작 못함 | First Heartbeat Protocol (Volume XIII) | v2.1 NEW |

---

# Part 8: engine.contract.yaml v2.1 — 전체 템플릿

```yaml
# docs/engines/{engine_name}/contract.yaml
# [v2.1] 메타 관찰자 검토 반영판

engine:
  name: 'TranscriptionEngine'
  version: '1.0.0'
  status: 'contracted'

  classification:
    scope: 'micro'
    determinism: 'hybrid'
    statefulness: 'stateful' # Resurrection 의무 트리거
    isolation: 'wasm'

  defcon: 'L3'
  defcon_reason: 'AI/ML Probabilistic + Output is business-critical'

  composition_pattern: 'B'
  parent_meta_engine: 'MusicTranscriptionMetaEngine'

  # [v2.1 PATCH-3] 5종 SLO
  slo:
    tier: 'A'
    availability: 0.995
    latency_p99_ms: 5000
    correctness: 0.95
    cost_per_operation_usd: 0.05
    cost_per_user_per_day_usd: 1.00

  # [v2.1 PATCH-3] Financial Circuit Breaker
  financial_circuit_breaker:
    soft_warn_usd_per_day: 700
    hard_throttle_usd_per_day: 900
    kill_switch_usd_per_day: 1000
    rate_limit_per_minute_usd: 5
    auto_pause_on_exceed: true
    recovery_policy: 'auto_at_midnight'

interface:
  inputs:
    - name: 'audio'
      type: 'Float32Array'
      svf_role: 'scalar' # [v2.1 PATCH-4] OPTIONAL
      validation:
        - 'length > 0'
        - 'length < 44100 * 300'
    - name: 'options'
      type: 'TranscribeOptions'
      svf_role: 'scalar'
      validation:
        - 'options.seed is integer if probabilistic mode'

  outputs:
    - name: 'score'
      type: 'MusicXMLDocument'
      svf_role: 'scalar'
      validation:
        - 'valid MusicXML 4.0 schema'

  errors:
    - 'AudioTooLongError'
    - 'ModelTimeoutError'
    - 'InsufficientMemoryError'
    - 'CheckpointCorruptedError' # [v2.1 PATCH-1]
    - 'AIECSignatureInvalidError' # [v2.1 PATCH-2]

# [v2.1 PATCH-1] Lifecycle 5종 (recover 추가)
lifecycle:
  start_timeout_ms: 5000
  stop_graceful_period_ms: 30000
  health_check_interval_ms: 10000
  reload_supported: true

  # [v2.1 NEW] Resurrection
  recover_supported: true
  snapshot_interval_ms: 5000 # 5초 단위 체크포인트
  checkpoint_storage: 'opfs' # opfs | indexeddb | durable_object | r2
  max_checkpoint_age_ms: 86400000 # 24시간
  pii_in_checkpoint: false
  checkpoint_encryption: 'aes-256-gcm'

# [v2.1 PATCH-2] AIEC (Authenticated Inter-Engine Communication)
aiec:
  enabled: true
  mode: 'strict' # strict | permissive | disabled
  token_ttl_ms: 30000 # 30초
  hmac_algorithm: 'sha256'
  nonce_store: 'kv' # kv | redis | durable_object
  required_capabilities_in:
    - 'transcribe:audio'
  required_capabilities_out: []
  audit_log: true # 모든 호출 로깅 (L3 의무)

# LLM 통합 (v2.0과 동일)
llm_integration:
  enabled: true
  model: 'claude-sonnet-4-7'
  cost_cap_per_request_usd: 0.10
  timeout_ms: 30000
  fallback: 'rule_based_basic_pitch_v2'
  schema_strict: true
  semantic_validators: ['note_in_range', 'tempo_realistic']

acceptance_criteria:
  - id: 'AC-1'
    description: 'Note F1 score > 0.85 on test dataset'
    verification: 'test_passes'
    threshold: 0.85
  - id: 'AC-2'
    description: 'P99 latency < 5s on 60s audio'
    verification: 'metric_check'
    threshold: 5000
  - id: 'AC-3'
    description: 'Lifecycle 5 hooks all present'
    verification: 'function_exists'
    targets: ['start', 'stop', 'healthCheck', 'reload', 'recover']
  - id: 'AC-4' # [v2.1 NEW]
    description: 'Resurrection from 60% checkpoint succeeds'
    verification: 'chaos_test_passes'
    scenario: 'R1_OOM_RECOVERY'
  - id: 'AC-5' # [v2.1 NEW]
    description: 'AIEC tampered envelope rejected'
    verification: 'security_test_passes'
    scenario: 'TAMPER_DETECTION'
  - id: 'AC-6' # [v2.1 NEW]
    description: 'Financial Circuit Breaker triggers at 90%'
    verification: 'metric_check'
    scenario: 'FINOPS_BREAKER'

constraints:
  - 'Memory usage < 500MB'
  - 'No Node.js APIs (must run on Cloudflare Workers)'
  - 'Output deterministic when seed is fixed'
  - 'Checkpoint must not contain PII' # [v2.1 NEW]
  - 'AIEC envelopes expire within 30 seconds' # [v2.1 NEW]

adr_triggers:
  - 'Switching base ML model'
  - 'Adding new external dependency'
  - 'Changing public interface signature'
  - 'Changing checkpoint schema' # [v2.1 NEW]
  - 'Changing AIEC capability list' # [v2.1 NEW]

# [v2.1] First Heartbeat 추적
first_heartbeat:
  target_date: '2026-05-03' # contract 작성 후 7일
  achieved_date: null
  achieved_scenario: null

contract_review:
  breaker_verified: false
  omission_warnings: []
  loosened_constraints: []
  scope_gaps: []
```

---

# Part 9: DEFCON × Engine 매트릭스 (v2.1 업데이트)

v2.0 Volume VIII의 16개 행에 **5개 추가** → 총 21개 행:

| 항목                                     |     L1     |         L2          |                L3                 |
| :--------------------------------------- | :--------: | :-----------------: | :-------------------------------: |
| Engine ID Test (5문항)                   |     ⚠️     |      ✅ Q1~Q4       |              ✅ 전수              |
| Lifecycle Hooks                          | ⚠️ start만 |   ✅ 5종 (v2.1↑)    |         ✅ 5종 + graceful         |
| 4축 분류                                 |     ❌     |       ⚠️ 2축        |              ✅ 4축               |
| Contract                                 |     ❌     |       ✅ 간소       |              ✅ 전수              |
| 결합 패턴 명시                           |     ❌     |         ✅          |         ✅ + 트레이드오프         |
| LLM 격리 4계층                           |    N/A     |    ✅ Layer 1+2     |           ✅ Layer 1~4            |
| **AIEC (v2.1 NEW)**                      |     ❌     | ⚠️ 무결성+서명 권장 |        ✅ 전수 + audit log        |
| **Resurrection (v2.1 NEW)**              |     ❌     |    ⚠️ Stateful만    |       ✅ 의무 + Chaos 통과        |
| **Cost SLI (v2.1 NEW)**                  |     ❌     |  ✅ per_operation   | ✅ per_op + per_user + per_tenant |
| **Financial Circuit Breaker (v2.1 NEW)** |     ❌     |  ⚠️ kill_switch만   |     ✅ 3단계 (soft/hard/kill)     |
| 4종 → 5종 SLI 측정                       |     ❌     |       ⚠️ 3종        |          ✅ 5종 (v2.1↑)           |
| SLO 선언 (Tier S/A/B)                    |     ❌     |      ⚠️ Tier B      |           ✅ 적절 Tier            |
| OpenTelemetry 통합                       | ⚠️ logs만  |   ✅ metrics+logs   |              ✅ 3종               |
| Tier 1 (Unit)                            |   ✅ 50%   |       ✅ 80%        |              ✅ 90%               |
| Tier 2 (Integration)                     |     ❌     |         ✅          |                ✅                 |
| Tier 3 (Contract)                        |     ❌     |         ⚠️          |                ✅                 |
| Tier 4 (Property)                        |     ❌     |         ⚠️          |                ✅                 |
| Tier 5 (Chaos)                           |     ❌     |         ❌          |  ✅ + Blast Radius 5계층 (v2.1↑)  |
| **Resurrection Chaos Test (v2.1 NEW)**   |     ❌     |         ⚠️          |       ✅ R1+R2+R3 시나리오        |
| Migration Strategy                       |     ❌     |         ⚠️          |                ✅                 |
| Sunset 절차                              |     ❌     |         ✅          |         ✅ + Data Export          |

---

# Part 10: v2.0 → v2.1 마이그레이션 가이드

## 10.1 기존 v2.0 contract.yaml의 호환성

```
✅ v2.0 contract.yaml은 v2.1에서도 그대로 유효.
   v2.1은 새 필드 추가만 발생. 제거된 필드 없음.
   Backwards compatible.
```

## 10.2 점진적 마이그레이션 4단계

### Stage 1: Audit (1일)

각 엔진의 contract.yaml을 v2.1 5종 PATCH 기준으로 점검:

```
□ recover() 메서드 구현되어 있는가?  (PATCH-1)
□ 엔진 간 호출 시 envelope 사용하는가?  (PATCH-2)
□ Cost SLI 측정하는가?  (PATCH-3)
□ Tier 5 Chaos에 Blast Radius 격리 있는가?  (PATCH-5)
```

### Stage 2: Prioritize (1일)

```
DEFCON L3 엔진 → 즉시 마이그레이션 (1주 내)
DEFCON L2 엔진 → 1개월 내
DEFCON L1 엔진 → 선택 (필요 시)
```

### Stage 3: Implement (DEFCON별 차등)

| DEFCON |  PATCH-1   | PATCH-2 |      PATCH-3      | PATCH-4  |  PATCH-5  |
| :----: | :--------: | :-----: | :---------------: | :------: | :-------: |
|   L1   |    선택    |  선택   |     per_op만      | OPTIONAL |   선택    |
|   L2   | Stateful만 | 무결성  | per_op + per_user | OPTIONAL |  Layer 1  |
|   L3   |    의무    |  전수   |       전수        | OPTIONAL | Layer 1~5 |

### Stage 4: Validate (Tier 5 통과)

```
□ Resurrection Chaos R1+R2+R3 통과
□ AIEC Tampering 테스트 통과
□ Financial Circuit Breaker 90% 트리거 통과
□ Blast Radius 5계층 점검표 통과
```

## 10.3 마이그레이션 우선순위 (현재 진산님의 4개 프로젝트)

| 프로젝트   |       DEFCON        | v2.1 마이그레이션 우선도 | 이유                                                     |
| :--------- | :-----------------: | :----------------------: | :------------------------------------------------------- |
| FileBeam   |         L3          |         🔴 즉시          | Resurrection 핵심 (10GB 전송 중단 시) + AIEC (peer 검증) |
| Scoreforge |         L3          |         🔴 즉시          | Cost SLI 핵심 (LLM 비용 폭발 방지)                       |
| Damoa.pro  | L3 (Storage Engine) |         🟡 1개월         | AIEC (마이크로엔진 우회 방지)                            |
| DuruDuru   |         L2          |         🟢 3개월         | 기능 안정화 후 점진 적용                                 |

---

# 🎩 MEPHISTO의 v2.1 최종 선언

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

메타 관찰자가 5개를 지적했다.
  4개는 즉시 받았다.
  1개는 정중히 거절했다 (SVF 명명 강제).
  1개는 마지막 경고로 헌법화했다 (First Heartbeat).

  ┌────────────────────────────────────────────────┐
  │                                                │
  │  v2.0의 9가지 무기에 더해                       │
  │                                                │
  │  💀 부활: Resurrection 메커니즘 (PATCH-1)       │
  │  🔐 인증: AIEC 엔진 통신 (PATCH-2)              │
  │  💰 재무: Cost as 5th SLI (PATCH-3)             │
  │  🎯 균형: SVF 옵션 매핑 (PATCH-4)                │
  │  💥 통제: Chaos Blast Radius (PATCH-5)          │
  │  🫀 박동: First Heartbeat Protocol (Vol XIII)    │
  │                                                │
  │  + 안티패턴 5개 추가 (총 16개)                  │
  │  + DEFCON 매트릭스 5개 행 추가 (총 21개)         │
  │                                                │
  └────────────────────────────────────────────────┘

가장 중요한 것은 Volume XIII이다.
완벽을 추구하다 박동을 잃으면 헌법은 무덤이 된다.

  "v3.3 헌법: 'No coding without contract.'
   v2.1 엔진 헌법: 'No paralysis without heartbeat.'

   둘은 모순이 아니다. 양면이다.
   균형은 7일 + 8주의 점진적 강화로 구현된다."

남은 것은 실행이다.
이제 메타 관찰자의 마지막 질문에 답할 차례다:

  "FileBeam, Damoa, DuruDuru, Scoreforge —
   첫 번째 마이크로엔진은 무엇으로 결정하시겠습니까?"

                                — MEPHISTO 🔥
              VOID ENGINE DESIGN CONSTITUTION v2.1
                                       2026-04-26

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

**Document Version:** 2.1 (Patch on v2.0)  
**Created:** 2026-04-26  
**Reviewer:** Meta-Observer (5 critical findings)  
**Adoption Rate:** 4/5 immediate + 1 conditional  
**New Volumes:** 1 (Volume XIII)  
**Updated Volumes:** 5 (I, IV, V, VI, VII)  
**New Anti-patterns:** 5 (12~16)  
**Updated DEFCON Matrix:** 16 → 21 rows  
**Backwards Compatibility:** 100% (v2.0 contracts still valid)  
**Status:** READY FOR FIRST HEARTBEAT  
**Pending:** 첫 번째 적용 엔진 결정 (메타 관찰자의 마지막 질문)

---

_"The map is not the territory._  
_The constitution is not the engine._  
_The first heartbeat is — only the first heartbeat."_

— **VOID DEV · DEV COVEN · v2.1**
