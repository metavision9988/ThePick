/**
 * Mock PaymentProvider — 개발/테스트 전용.
 *
 * ⚠️ 프로덕션 번들 포함 금지: `packages/payment/src/index.ts` barrel 에서 재노출하지 않는다.
 *    subpath import (`@thepick/payment/mock`) 로만 접근 가능.
 *    생성자 가드가 NODE_ENV='production' 에서 throw한다.
 *
 * 실 PG사 구현체는 Phase 3 착수 시점에 추가 (ADR-002).
 */

import { z } from 'zod';
import {
  PaymentNotSupportedError,
  WebhookPayloadError,
  WebhookSignatureError,
  type BuyerInfo,
  type CheckoutParams,
  type CheckoutSession,
  type PaymentEvent,
  type PaymentProvider,
  type RefundResult,
  type TaxInvoiceResult,
} from '../types.js';

/** Mock 전용 상수 (다른 파일 복제 방지 위해 export). */
export const MOCK_WEBHOOK_SIGNATURE = 'mock-signature' as const;
const MOCK_SESSION_TTL_MS = 15 * 60 * 1000;
const MOCK_SDK_VERSION = 'mock-v0.1.0';
const MOCK_PAYLOAD_SCHEMA = 'mock/v1';

const MockWebhookPayload = z.object({
  userId: z.string().min(1).max(128),
  transactionId: z.string().min(1).max(128),
  amountKRW: z.number().int().positive().max(100_000_000),
});

export class MockPaymentProvider implements PaymentProvider {
  public readonly name = 'mock' as const;

  constructor() {
    // Cloudflare Workers 에는 process.env 가 기본 존재하지 않으나,
    // Node/Vitest/Next.js 에서는 존재. production NODE_ENV 에서 하드 블록.
    const env = (globalThis as { process?: { env?: Record<string, string> } }).process?.env;
    if (env?.NODE_ENV === 'production') {
      throw new Error(
        'MockPaymentProvider must never be instantiated in production. ' +
          'Check your PaymentProviderFactory wiring.',
      );
    }
  }

  async createCheckoutSession(params: CheckoutParams): Promise<CheckoutSession> {
    if (params.amountKRW <= 0) {
      throw new Error(`Invalid amountKRW: ${params.amountKRW}`);
    }
    const sessionId = `mock_${crypto.randomUUID()}`;
    return {
      sessionId,
      redirectUrl: `${params.successUrl}?session=${sessionId}&mock=true`,
      expiresAt: new Date(Date.now() + MOCK_SESSION_TTL_MS),
      provider: this.name,
    };
  }

  async verifyWebhook(rawBody: string, signature: string): Promise<PaymentEvent> {
    if (signature !== MOCK_WEBHOOK_SIGNATURE) {
      throw new WebhookSignatureError('Mock webhook signature mismatch');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new WebhookPayloadError(`Invalid JSON: ${msg}`);
    }
    const result = MockWebhookPayload.safeParse(parsed);
    if (!result.success) {
      throw new WebhookPayloadError(`Payload validation failed: ${result.error.message}`);
    }
    const data = result.data;
    return {
      eventId: crypto.randomUUID(),
      userId: data.userId,
      provider: this.name,
      providerTransactionId: data.transactionId,
      eventType: 'checkout_completed',
      amountKRW: data.amountKRW,
      occurredAt: new Date(),
      idempotencyKey: `mock_${data.transactionId}_checkout_completed`,
      providerSdkVersion: MOCK_SDK_VERSION,
      payloadSchemaVersion: MOCK_PAYLOAD_SCHEMA,
      rawPayload: rawBody,
    };
  }

  async refund(transactionId: string, amountKRW: number): Promise<RefundResult> {
    if (!transactionId) {
      throw new Error('Empty transactionId');
    }
    if (amountKRW <= 0) {
      throw new Error(`Invalid refund amount: ${amountKRW}`);
    }
    return {
      refundId: `mock_refund_${crypto.randomUUID()}`,
      providerTransactionId: transactionId,
      refundedAmountKRW: amountKRW,
      refundedAt: new Date(),
    };
  }

  async cancelSubscription(_subscriptionId: string): Promise<void> {
    // Mock: no-op. Real providers call PG API to stop auto-renewal.
  }

  async issueTaxInvoice(transactionId: string, buyer: BuyerInfo): Promise<TaxInvoiceResult> {
    if (!buyer.businessRegistrationNumber) {
      // 사업자등록번호 없으면 개인 거래 → 현금영수증 경로로 가거나 미발행
      throw new PaymentNotSupportedError('Mock: tax invoice requires businessRegistrationNumber');
    }
    return {
      kind: 'kr',
      invoiceId: `mock_invoice_${transactionId}`,
      issuedAt: new Date(),
      ntsApprovalNumber: 'MOCK-NTS-000000',
    };
  }
}
