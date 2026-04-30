# ADR-024: Payment Mock → 실결제 전환 시 AIEC 자동 활성화 + Pre-trigger Window 14일

- **상태:** Accepted
- **결정일:** 2026-04-27
- **결정자:** 진산
- **관련 헌법:** v3.0 Vol XVI (Solo-Builder, Solo→Multi 전환 트리거), Vol IV-B (AIEC), Vol VIII.1 (자동 L3 트리거 — 결제·정산·인증)
- **관련 ADR:** ADR-002 (Payment Adapter Abstraction), ADR-005 (Authentication PBKDF2), ADR-023 (Engine-First)
- **트리거:** Engine Hardening Roadmap v1.1 Step 3 (Review A-3 Pre-trigger Window 권고)

---

## 1. Context (맥락)

### 1.1 현재 상태

- `packages/payment` — Mock provider 구현 (`packages/payment/src/providers/mock.ts`, Zod 검증 1건)
- 실결제 PG 미선택 (Polar / PortOne / TossPayments 후보 — Phase 3에서 결정 예정, ADR-006 §"불가피한 외부 의존")
- AIEC (Authenticated Inter-Engine Communication) 코드 0건 — Solo-Builder 단계라 Vol XVI 차등표상 비활성

### 1.2 v3.0 Vol XVI Solo→Multi 전환 트리거

다음 하나라도 발생 시 Solo-Builder 차등표 비활성, Multi-Tenant 의무 발동:

1. 첫 외부 사용자 가입
2. **결제 API 활성화** ← 본 ADR 대상
3. 무료 베타 공개 발표
4. 도메인 공개 (직접 접근 가능 URL)

→ 결제 활성화 = 자동 L3 트리거 (Vol VIII.1) + Multi-Tenant 의무.

### 1.3 위험: 트리거 발동 시점에 만들면 늦음

```
🛡️ SENTINEL (v3.0 Vol XVI 위험 경고):
  "이월이 아니라 '결제 가까이서 즉시'로 분류."
```

실결제 활성화 D-Day에 AIEC 코드를 0에서 만들면:

- HMAC 키 발급, nonce store 구축, capability 매트릭스, 통합 테스트, Tampering Chaos 시나리오 = 최소 1주 작업
- 이를 D-Day에 시작하면 결제 활성화 지연 또는 검증 미완 상태로 활성화 (TYPE-7 보안 사고 위험)

---

## 2. Decision (결정)

### 2.1 핵심

**결제 mock → 실결제 전환을 명시적 트리거로 정의하고, 트리거 발동 14일 전 (Pre-trigger Window)부터 AIEC 구현을 시작한다.**

### 2.2 Trigger 정의 (Solo→Multi 발동 조건)

다음 중 **첫 번째 발생** 시점이 D-Day:

1. 실결제 PG 키(API Secret)를 production 환경 변수에 입력하는 commit
2. Stripe/Polar/PortOne/TossPayments 가입 + 사업자등록번호 연결 완료
3. `apps/api/src/payment/route.ts`에서 mock provider → 실 provider 분기 변경 commit
4. 진산님이 트리거 키워드 "결제 활성화 진입" 명시

가장 빠른 1개 발생 시점이 D-Day.

### 2.3 Pre-trigger Window 14일 일정

|      Day      | 작업                                              | 산출물                                                                                             | 의무 페르소나         |
| :-----------: | :------------------------------------------------ | :------------------------------------------------------------------------------------------------- | :-------------------- |
|   **D-14**    | HMAC 키 발급 + nonce store 구축                   | Cloudflare KV 네임스페이스 `aiec_nonces` (TTL 60초), Workers Secret `AIEC_SHARED_SECRET`           | 🛡️ SENTINEL           |
| **D-13~D-10** | AIECEnvelope 인터페이스 + 검증 6단계 구현         | `packages/shared/src/aiec/envelope.ts`, `verify.ts` (TTL/Hash/Signature/Nonce/Capability/Tenant)   | 💻 HACKER             |
|  **D-9~D-8**  | capability 매트릭스 정의 + per-engine 적용        | `docs/architecture/AIEC_CAPABILITIES.md` (예: `payment:create`, `payment:refund`, `user:read_own`) | 🏗️ ARCHITECT          |
|    **D-7**    | 통합 테스트 (web → api 결제 호출 시 AIEC 통과)    | `apps/api/__tests__/aiec-payment.integration.test.ts`                                              | 🔨 BREAKER            |
|  **D-6~D-4**  | Tier 3 (Contract test) + Tampering Chaos 시나리오 | `aiec.contract.test.ts`, `aiec-tampering.chaos.test.ts` (envelope 변조, replay, expired token)     | 🔨 BREAKER + 👻 GHOST |
|    **D-3**    | Pre-flight 점검 — 모든 시나리오 PASS 확인         | 통과 보고서 `docs/incidents/aiec-readiness-{YYYY-MM-DD}.md`                                        | 진산님 + 🎩 MEPHISTO  |
|  **D-2~D-1**  | Buffer (실패 시 재시도)                           | —                                                                                                  | —                     |
|   **D-Day**   | **실결제 활성화 + AIEC strict mode 활성화 동시**  | `apps/api/wrangler.toml`에서 `AIEC_MODE = "strict"` 환경변수 설정                                  | 진산님                |
| **D+1~D+30**  | AIEC 차단 로그 일일 점검                          | `docs/incidents/aiec-daily-{YYYY-MM-DD}.md` (자동 또는 수동)                                       | 👻 GHOST              |

### 2.4 Pre-flight 통과 기준 (D-3)

D-3에 다음 모두 PASS 확인 후 D-Day 진입:

- [ ] Envelope 검증 6단계 모두 동작 (TTL/Hash/Signature/Nonce/Capability/Tenant)
- [ ] Tampering Chaos 5종 시나리오 모두 거부 (envelope 변조, replay, expired token, wrong capability, wrong tenant)
- [ ] 정상 결제 호출 95%+ 통과 (false positive 5% 이하)
- [ ] AIEC 차단 시 사용자 UX (`PAYMENT_AUTH_FAILED` 우아한 에러 페이지) 확인
- [ ] Audit log 활성 (모든 결제 호출 → Workers Logs JSON)
- [ ] Kill switch 확인 (`AIEC_MODE = "permissive"` 환경변수 토글로 즉시 비활성 가능)

D-3 PASS 실패 시 D-Day 연기 (D+N).

### 2.5 ADR-002 (Payment Adapter)와의 관계

ADR-002는 결제 어댑터 추상화 정의. 본 ADR은 그 위에 보안 봉투(AIEC)를 추가하는 결정.

- ADR-002의 `PaymentAdapter` 인터페이스 변경 없음
- AIEC는 `apps/api/src/payment/route.ts`의 호출 사이트에서 적용 (web → api 사이의 봉투)
- 결제 PG ↔ Cloudflare Workers 사이는 PG의 자체 인증 (API key + webhook signature)

---

## 3. Consequences (결과)

### 긍정적

- D-Day에 결제 활성화 + AIEC 활성화 동시 → "보안 미완 결제" 위험 0
- 14일 Pre-trigger Window가 AIEC 학습 곡선 + 디버깅 시간 확보
- v3.0 Vol XVI 위험 경고 ("결제 가까이서 즉시") 정확 충족
- AIEC 활성화 후 30일 일일 모니터링이 false positive 조기 발견

### 부정적 / 트레이드오프

- 결제 활성화 일정 14일 사전 확정 필요 (진산님 일정 통제 항목 — 메모리 `feedback_focus_reliability_not_schedule` 따라 진산님 자율)
- AIEC 구현 14일 작업 (D-14 ~ D-3)이 다른 Phase 작업과 충돌 가능 → 결제 활성화 후보 시점 14일 전부터 우선순위 격상
- Pre-flight 실패 시 D-Day 연기 가능성 (정상 워크플로우 — 위험 차단)

### 본 ADR 자체는 BATCH-1 진입 차단 X

ADR-024는 결제 활성화 시점에 발동하는 트리거 정의일 뿐, **BATCH-1 적재 진입을 차단하지 않는다**. Engine Hardening Roadmap의 "이연 항목"에 해당.

단, 본 ADR이 작성되어 있어야 결제 활성화 D-Day에 즉시 일정 적용 가능 → 작성 자체는 BATCH-1 진입 전 의무.

---

## 4. Alternatives Considered (대안)

| 대안                                   | 장점                   | 단점                                                          | 미선택 이유                             |
| :------------------------------------- | :--------------------- | :------------------------------------------------------------ | :-------------------------------------- |
| AIEC 즉시 구현 (Solo-Builder 단계에서) | 미래 위험 0            | Solo-Builder 단계엔 과도, Premature Generalization (Vol IX.9) | Vol XVI 차등표 위배                     |
| AIEC 결제 D-Day 당일 구현              | 일정 압축              | 1일 = 학습 곡선 미달, 검증 미완                               | TYPE-7 보안 사고 위험                   |
| Pre-trigger 7일                        | 일정 절약              | Tampering Chaos 시간 부족                                     | 14일 = Tier 3 + Tier 5 통과 가능 최소치 |
| **Pre-trigger 14일 (본 ADR)**          | 검증 충분 + Buffer 2일 | 14일 사전 확정 필요                                           | **선택**                                |
| Pre-trigger 30일                       | Buffer 충분            | 다른 Phase 작업 압박                                          | 14일이면 충분 (Tampering Chaos = 2~3일) |

---

## 5. Migration / Backward Compatibility

- 현재 mock provider — 변경 없음
- AIEC 구현 코드는 `packages/shared/src/aiec/` 신설 (기존 코드 영향 없음)
- D-Day에 `AIEC_MODE` 환경변수 토글로 활성/비활성 — backward compatible
- D+30 이후 `AIEC_MODE = "strict"` 영구 고정, `permissive` 모드 deprecation

---

## 6. SLO Impact

| 항목                 | D-14 ~ D-1        | D-Day 이후                                                   |
| :------------------- | :---------------- | :----------------------------------------------------------- |
| 결제 API Latency P99 | 측정 안 함 (mock) | < 1500ms (AIEC 검증 0.5ms 추가 — Vol IV-B 트레이드오프 인정) |
| 결제 API Cost        | 0 (mock)          | 결제 PG 수수료 + Workers 단가                                |
| AIEC 검증 통과율     | —                 | ≥ 99.5% (정상 호출, false positive ≤ 0.5%)                   |
| AIEC 차단 로그       | —                 | 100% 캡처 (audit log 의무 — Vol IV-B DEFCON L3)              |

---

## 7. Human Decision Required

- [x] Approved (진산님 2026-04-27 — Engine Hardening Roadmap v1.1 승인 메시지)
- [ ] Rejected
- [ ] Modified

**Reviewer:** 진산
**Date:** 2026-04-27

---

## 8. 부록 — 결제 외 추가 트리거 (참고)

본 ADR은 결제 전용. 다른 Solo→Multi 트리거 발동 시 별도 ADR 작성 검토:

| 트리거              | 별도 ADR 필요 여부                                      |
| :------------------ | :------------------------------------------------------ |
| 첫 외부 사용자 가입 | ✅ 필요 — 인증/세션 AIEC 적용 ADR (Phase 2 진입 시)     |
| 무료 베타 공개 발표 | ⚠️ 검토 — 사용자 트래픽 측정 + Cost SLI per_user 활성화 |
| 도메인 공개         | ⚠️ 검토 — Cloudflare WAF / Rate limit 강화              |

본 ADR 패턴(Pre-trigger Window + 일정 + Pre-flight)을 다른 트리거 ADR에 재사용 권장.
