/**
 * @thepick/payment — 결제 어댑터 계약.
 *
 * 프로덕션 안전: MockPaymentProvider 는 barrel 에 노출하지 않는다.
 * 테스트/개발에서는 subpath import 로만 사용:
 *   import { MockPaymentProvider } from '@thepick/payment/mock';
 */
export * from './types.js';
