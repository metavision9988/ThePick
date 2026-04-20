/**
 * PaymentProvider 어댑터 계약.
 *
 * @experimental
 * 본 인터페이스는 Phase 3 착수 직전 샌드박스 검증(Polar/PortOne/TossPayments 각 Walking Skeleton)
 * 후 공통 계약을 역도출하여 재작성 예정. 현재는 DB 스키마 설계를 위한 최소 계약이며,
 * 실제 호출자(apps/api, modules/*)는 Phase 3 전까지 import 금지.
 *
 * 구현체 예정 (Phase 3):
 * - PolarProvider        — polar.sh (글로벌 Merchant-of-Record, 한국 결제수단 지원 여부 확인 필요)
 * - PortOneProvider      — 포트원 (한국 통합 PG)
 * - TossPaymentsProvider — 토스페이먼츠 (한국 PG)
 *
 * 관련 결정: `docs/adr/ADR-002-payment-adapter-abstraction.md`
 * 관련 기한: `packages/shared/src/constants/legal.ts` REFUND_MANDATORY_DAYS (전자상거래법 제17조)
 */

/** PG사 식별자. 추가 시 여기 + DB schema 동시 업데이트. */
export type PaymentProviderName = 'polar' | 'portone' | 'tosspayments' | 'mock';

export type SubscriptionTier = 'free' | 'paid_monthly' | 'paid_annual';

export type PaymentEventType =
  | 'checkout_completed'
  | 'checkout_failed'
  | 'subscription_renewed'
  | 'subscription_cancelled'
  | 'refund_issued'
  | 'dispute_opened';

/** 구매자 정보. 세금계산서 발행 시 사업자 필드 필수. */
export interface BuyerInfo {
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  /** 사업자등록번호. 세금계산서 발행 시에만 제공. PIPA 고유식별정보 대우, 로그 마스킹 필수. */
  readonly businessRegistrationNumber?: string;
  /** 사업자 상호. */
  readonly businessName?: string;
}

/**
 * PG별 타입-안전 옵션. discriminated union으로 자동완성 + 컴파일 타임 검증.
 * escape hatch(`Record<string, unknown>`) 대신 명시적 필드만 허용.
 */
export type ProviderOptions =
  | {
      readonly kind: 'polar';
      readonly taxRegion?: 'KR' | 'US' | 'EU';
      readonly subscriptionPlanId?: string;
    }
  | { readonly kind: 'portone'; readonly channelKey: string; readonly storeId: string }
  | { readonly kind: 'tosspayments'; readonly flowMode: 'DEFAULT' | 'DIRECT' }
  | { readonly kind: 'mock' };

export interface CheckoutParams {
  readonly userId: string;
  readonly tier: SubscriptionTier;
  readonly amountKRW: number;
  /**
   * 결제 성공 후 리디렉트. 보안: 호출 구현체는 ENV `ALLOWED_REDIRECT_HOSTS` 화이트리스트로
   * host 검증 후에만 반환. 오픈 리다이렉트 방지 (THREAT_MODEL T-3).
   */
  readonly successUrl: string;
  /** 결제 취소 시 리디렉트. 동일한 allowlist 검증. */
  readonly cancelUrl: string;
  readonly buyer: BuyerInfo;
  /** PG별 타입-안전 옵션. 없으면 기본 플로우. */
  readonly providerOptions?: ProviderOptions;
}

export interface CheckoutSession {
  readonly sessionId: string;
  readonly redirectUrl: string;
  readonly expiresAt: Date;
  readonly provider: PaymentProviderName;
}

export interface PaymentEvent {
  readonly eventId: string;
  readonly userId: string;
  readonly provider: PaymentProviderName;
  readonly providerTransactionId: string;
  readonly eventType: PaymentEventType;
  readonly amountKRW: number;
  readonly occurredAt: Date;
  /**
   * 멱등성 키. 같은 webhook 재수신 시 중복 처리 방지용.
   * DB `UNIQUE(provider, provider_transaction_id, event_type, idempotency_key)` 제약 보장.
   * Replay 공격 방지: receiver는 수신 timestamp ±5분 window 검증 필수.
   */
  readonly idempotencyKey: string;
  /** PG SDK 버전 (예: 'portone-v2.3.1'). 장기 감사 시 스키마 역추적용. */
  readonly providerSdkVersion: string;
  /** 페이로드 스키마 버전 (예: 'portone/v1.5'). 향후 PG 스키마 진화 대응. */
  readonly payloadSchemaVersion: string;
  /**
   * 원본 페이로드 (감사용). 변조 검증 완료 후 저장.
   * PCI-DSS 준수: PAN(카드 전체번호)/CVC는 **저장 전 마스킹 필수**. 구현체는
   * `sanitizeRawPayload(raw)` 로 전처리 후 전달. 크기 32KB 초과 시 R2 오프로드 권고.
   */
  readonly rawPayload: string;
}

export interface RefundResult {
  readonly refundId: string;
  readonly providerTransactionId: string;
  readonly refundedAmountKRW: number;
  readonly refundedAt: Date;
}

/**
 * 세금계산서 발행 결과. 국가/모델별로 구조가 크게 달라 discriminated union 사용.
 * - kr: 한국 국세청 e-Tax 발행 (사업자등록번호 필수)
 * - intl: 해외 Merchant-of-Record 담당 (우리는 영수증만 수신)
 * - not_supported: PG사가 발행 기능 미제공. 운영자 수동 발행 경로 사용.
 */
export type TaxInvoiceResult =
  | {
      readonly kind: 'kr';
      readonly invoiceId: string;
      readonly issuedAt: Date;
      readonly ntsApprovalNumber: string;
    }
  | {
      readonly kind: 'intl';
      readonly invoiceId: string;
      readonly issuedAt: Date;
      readonly merchantOfRecord: string;
    }
  | {
      readonly kind: 'not_supported';
      readonly reason: 'mor_handles' | 'unregistered_business' | 'pg_limitation';
    };

// --- 에러 클래스 (호출자가 구분하여 감사 로그 분리 가능) ---

export class WebhookSignatureError extends Error {
  override readonly name = 'WebhookSignatureError';
}

export class WebhookPayloadError extends Error {
  override readonly name = 'WebhookPayloadError';
}

export class PaymentNotSupportedError extends Error {
  override readonly name = 'PaymentNotSupportedError';
}

/**
 * 모든 결제 PG 어댑터가 구현해야 할 계약.
 *
 * 에러 처리 규칙:
 * - 서명 검증 실패 → `WebhookSignatureError`
 * - 페이로드 형식/검증 실패 → `WebhookPayloadError`
 * - 기능 미지원(PG가 지원 안 함) → `PaymentNotSupportedError`
 * - 사용자 귀책(결제 취소, 카드 거절) → 반환값의 status로 표현
 * - 빈 catch 금지. 에러는 로깅 후 상위로 전파.
 *
 * Idempotency 규칙:
 * - verifyWebhook 동일 idempotencyKey 재수신 → 호출자는 조용히 무시(throw 아님)
 * - refund 동일 transactionId 재호출 → `PaymentNotSupportedError` 또는 기존 결과 반환
 *
 * 환불 기한:
 * - `packages/shared/src/constants/legal.ts` REFUND_MANDATORY_DAYS 준수
 * - 전자상거래법 제17조 청약철회권. 디지털 콘텐츠 예외 조항은 법률 자문 후 판단.
 */
export interface PaymentProvider {
  readonly name: PaymentProviderName;

  /** 결제 세션 생성. 사용자를 redirectUrl로 보낸다. */
  createCheckoutSession(params: CheckoutParams): Promise<CheckoutSession>;

  /**
   * Webhook 서명 검증 + 이벤트 파싱.
   * 서명 실패 시 `WebhookSignatureError`, 페이로드 검증 실패 시 `WebhookPayloadError`.
   */
  verifyWebhook(rawBody: string, signature: string): Promise<PaymentEvent>;

  /**
   * 환불 실행. 이중 환불(같은 transactionId 재호출)은 구현체에서 idempotent 하게 처리.
   * amountKRW는 양수 + 원 결제 금액 이하여야 함 (구현체 검증).
   */
  refund(transactionId: string, amountKRW: number): Promise<RefundResult>;

  /** 자동 갱신 중단. 현재 기간 종료까지는 유효. */
  cancelSubscription(subscriptionId: string): Promise<void>;

  /**
   * 세금계산서/현금영수증 발행.
   * 구현체는 미지원 시 `{ kind: 'not_supported', ... }` 반환 또는 `PaymentNotSupportedError` throw.
   * optional 메서드 아님 → 호출자의 existence check 부담 제거.
   */
  issueTaxInvoice(transactionId: string, buyer: BuyerInfo): Promise<TaxInvoiceResult>;
}
