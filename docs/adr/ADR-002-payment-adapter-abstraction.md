# ADR-002: 결제 플랫폼 어댑터 추상화

- **상태:** Accepted (인터페이스 수준), 구현 Phase 3로 연기
- **결정일:** 2026-04-18
- **결정자:** 진산 + Claude Opus 4.7 (Session 7)
- **관련 위협:** Opus 4.7 재검토 보고서 §2① (비즈니스 모델)

## 맥락 (Context)

쪽집게는 유료 구독/일시불 모델을 채택할 예정이나, Session 7 기준 다음이 미확정:

- 가격·무료/유료 경계·환불 정책: 개발 후반(Phase 3)에 시장 반응 보고 결정
- 결제 PG사 선택:
  - **진산 1차 후보:** Polar (`polar.sh`) — 글로벌 Merchant-of-Record, 세금계산서 자동화 기대
  - **Claude 지적:** Polar는 Stripe 기반 글로벌 플랫폼. 한국 로컬 결제수단(카카오페이 KR, 네이버페이, 토스페이, 계좌이체) 및 한국 세금계산서/현금영수증 자동 발행은 원칙적으로 미지원
  - **실제 한국 로컬 요건을 충족하는 대안:** 포트원(PortOne/아임포트), 토스페이먼츠, NICE페이

DB 스키마(특히 `user_progress.subscription_tier`, `payment_events` 테이블)가 PG사 선택에 얽매이면 향후 교체 시 마이그레이션 비용이 커진다.

## 결정 (Decision)

### 1. 결제 구현은 Phase 3(런칭 직전)으로 연기

- Phase 1~2에는 결제 연동 코드를 작성하지 않음
- DB 스키마는 PG사 무관한 추상 모델로 먼저 설계 (아래 §2)

### 2. PaymentProvider 어댑터 인터페이스 우선 정의

`packages/payment` 워크스페이스를 신설하여 **인터페이스만 먼저** 정의한다. 구체 구현체(PolarAdapter, PortOneAdapter 등)는 Phase 3에 추가.

```typescript
// packages/payment/src/types.ts
export interface PaymentProvider {
  readonly name: 'polar' | 'portone' | 'tosspayments' | 'mock';

  /** 결제 세션 생성 → redirect URL 반환 */
  createCheckoutSession(params: CheckoutParams): Promise<CheckoutSession>;

  /** Webhook 검증 및 이벤트 파싱 */
  verifyWebhook(rawBody: string, signature: string): Promise<PaymentEvent>;

  /** 환불 실행 */
  refund(transactionId: string, amountKRW: number): Promise<RefundResult>;

  /** 구독 취소 (자동 갱신 중단) */
  cancelSubscription(subscriptionId: string): Promise<void>;

  /** 세금계산서/현금영수증 발행 (PG사가 지원 시) */
  issueTaxInvoice?(transactionId: string, buyerInfo: BuyerInfo): Promise<TaxInvoiceResult>;
}
```

상세 타입 정의는 `packages/payment/src/types.ts`에서 관리.

### 3. DB 스키마는 PG-중립 모델로 설계

```sql
-- payment_events: 모든 PG사 공통 스키마
CREATE TABLE payment_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,           -- 'polar' | 'portone' | 'tosspayments'
  provider_transaction_id TEXT NOT NULL,
  event_type TEXT NOT NULL,         -- 'checkout_completed' | 'refund' | 'subscription_cancelled'
  amount_krw INTEGER NOT NULL,
  raw_payload TEXT NOT NULL,        -- 원본 페이로드 JSON (감사용)
  occurred_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- subscriptions: 활성 구독 상태
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  provider_subscription_id TEXT,
  tier TEXT NOT NULL,               -- 'free' | 'paid_monthly' | 'paid_annual'
  status TEXT NOT NULL,             -- 'active' | 'cancelled' | 'expired'
  current_period_end INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

`provider` 필드를 둠으로써 향후 PG사 병행 운영 가능 (예: 기존 사용자 Polar, 신규 PortOne).

### Migrations 연결 (C-7 4-Pass 리뷰 반영)

위 스키마는 ADR 문서에만 존재하며 실제 `migrations/` 파일에 반영되지 않은 상태다. 다음 시점에 migration 파일로 구체화:

| 단계                            | Migration 파일                                | 포함 테이블                                          |
| ------------------------------- | --------------------------------------------- | ---------------------------------------------------- |
| **Phase 1 초기 (Session 8~10)** | `migrations/0005_users_and_subscriptions.sql` | `users`, `subscriptions` (tier='free' 기본값)        |
| **Phase 3 (결제 실구현)**       | `migrations/0006_payment_events.sql`          | `payment_events` + R2 오프로드 설계 (row 100KB 한계) |

### 타입 계약 링크 (2026-04-18 Session 7 업데이트)

위 인터페이스 정의는 축약형이며 **진실공급원은 `packages/payment/src/types.ts`**다. Session 7 변경으로 다음이 ADR 본문 코드 블록과 달라졌으니 구현 시 코드 파일 참조:

- `issueTaxInvoice` **non-optional** 로 변경 (호출자 existence check 부담 제거, `PaymentNotSupportedError` throw 또는 `TaxInvoiceResult.kind='not_supported'` 반환)
- `TaxInvoiceResult` **discriminated union** (`kr` | `intl` | `not_supported`)
- `CheckoutParams.providerOptions` **discriminated union** (escape hatch `Record<string, unknown>` 제거)
- `PaymentEvent` 필수 필드 추가: `idempotencyKey`, `providerSdkVersion`, `payloadSchemaVersion`
- 에러 클래스 3종 export: `WebhookSignatureError`, `WebhookPayloadError`, `PaymentNotSupportedError`

### 4. Phase 3 착수 시 PG 최종 결정 프로세스

PG사 선정 기준 (Phase 3 재검토 시):

1. **한국 결제수단 네이티브 지원** (카카오페이/네이버페이/토스페이)
2. **세금계산서·현금영수증 자동 발행** (간이/일반 과세자 모두)
3. **웹훅 서명 검증 방식** (HMAC-SHA256 이상)
4. **환불/부분환불 API** 제공
5. **수수료율 + 정산 주기** (실수령액 기준)
6. **담당자 응대 SLA** (한국어 지원)

## 결과 (Consequences)

### 긍정적

- Phase 1~2에서 결제 고민 제거 → 핵심 엔진 구현에 집중
- 스키마가 PG-중립이므로 향후 교체 비용 최소화
- 실구현은 Phase 3에 시장 데이터(가격·환불률)가 모인 뒤 결정

### 부정적

- 인터페이스만 있고 구현이 없는 "허공 레이어" 3~4개월간 존재 → 개발자가 헷갈릴 수 있음 → **README에 "Phase 3 구현 예정" 명시**
- `packages/payment`에 구현체 스텁조차 없으면 Phase 3 착수 시 재발명 위험 → **최소 MockPaymentProvider 1개는 초기 작성** (개발/테스트용)

### 중립

- Polar 실제 한국 호환성 확인은 Phase 3 착수 시점 재검증 (Polar 자체가 빠르게 진화 중)

## 권고 후속 조치

- [ ] Phase 3 착수 1개월 전 Polar + PortOne + 토스페이먼츠 실제 샌드박스 테스트 (각 0.5일)
- [ ] 세금계산서 발행 요건(간이과세자 vs 일반과세자) 사업자등록 상태에 따라 결정
- [ ] 환불 정책 확정 (전자상거래법 7일 청약철회 의무 준수)

## 참고

- 전자상거래 등에서의 소비자보호에 관한 법률 제17조 (청약철회)
- Polar: https://polar.sh/
- PortOne(구 아임포트): https://portone.io/
- 토스페이먼츠: https://docs.tosspayments.com/

## 수정 이력

- 2026-04-18: 초안 작성
