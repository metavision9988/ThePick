/**
 * Have I Been Pwned (HIBP) Pwned Passwords k-Anonymity 체크.
 *
 * API: https://api.pwnedpasswords.com/range/{prefix} (인증 불필요)
 * 전략: SHA-1 해시 앞 5자만 전송 → 응답 suffix 목록에서 나머지 매칭 → 원본 비노출.
 *
 * 실패 정책:
 *   - 네트워크/timeout → `{ status: 'unavailable' }` (회원가입 계속 진행).
 *   - HIBP 5xx → 동일.
 *   - 관대한 실패 이유: HIBP 서비스 장애로 가입 자체를 막으면 가용성 손실.
 *     대신 Phase 2 배치로 주기 재확인 (ADR-005 Addendum).
 */

import type { Logger } from '@thepick/shared';
import {
  HIBP_API_BASE_URL,
  HIBP_HASH_PREFIX_LENGTH,
  HIBP_REQUEST_TIMEOUT_MS,
} from './constants.js';
import type { PwnedResult } from './types.js';

/**
 * 주어진 평문 비밀번호가 HIBP DB 에 유출 이력이 있는지 확인.
 *
 * @param plaintext 검사할 비밀번호 평문
 * @param logger request-scoped logger — 호출 측에서 environment 주입된 인스턴스 전달 (Step 1-3 M-5).
 *   과거 모듈 레벨 싱글톤은 `environment='development'` 로 고정되어 프로덕션 로그가 오염됨.
 * @returns `status='pwned'` + count / `'safe'` / `'unavailable'`
 */
export async function checkPwned(plaintext: string, logger: Logger): Promise<PwnedResult> {
  const sha1Hex = await computeSha1Hex(plaintext);
  const prefix = sha1Hex.substring(0, HIBP_HASH_PREFIX_LENGTH).toUpperCase();
  const suffix = sha1Hex.substring(HIBP_HASH_PREFIX_LENGTH).toUpperCase();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, HIBP_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${HIBP_API_BASE_URL}${prefix}`, {
      signal: controller.signal,
      headers: { 'Add-Padding': 'true' },
    });

    if (!response.ok) {
      logger.warn('hibp non-2xx response', { status: response.status });
      return { status: 'unavailable', count: 0 };
    }

    const body = await response.text();
    return parsePwnedResponse(body, suffix);
  } catch (err) {
    logger.warn('hibp fetch failed', {
      cause: err instanceof Error ? err.message : String(err),
      name: err instanceof Error ? err.name : 'Unknown',
    });
    return { status: 'unavailable', count: 0 };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * HIBP API 응답 파싱. 각 줄은 `SUFFIX:COUNT` 형식.
 * padding line 은 count=0 이므로 매칭되어도 safe 반환.
 */
export function parsePwnedResponse(body: string, targetSuffix: string): PwnedResult {
  // 응답 body가 완전히 비어 있으면 unavailable 로 판정 — 위양성 'safe' 방어 (Pass 3 M-3).
  if (body.trim().length === 0) {
    return { status: 'unavailable', count: 0 };
  }

  const lines = body.split(/\r?\n/);
  for (const line of lines) {
    if (line.length === 0) continue;
    // 첫 번째 ':' 기준 split — malformed 라인에서 trailing 토큰 무시 (방어적 코딩).
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) continue;
    const suffix = line.substring(0, separatorIndex);
    const countStr = line.substring(separatorIndex + 1);
    if (suffix.toUpperCase() !== targetSuffix) continue;

    const count = Number.parseInt(countStr, 10);
    if (!Number.isFinite(count) || count <= 0) {
      return { status: 'safe', count: 0 };
    }
    return { status: 'pwned', count };
  }
  return { status: 'safe', count: 0 };
}

/** SHA-1 hex 인코딩. HIBP API 요구 — 저장용 아님. */
async function computeSha1Hex(plaintext: string): Promise<string> {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-1', encoder.encode(plaintext));
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    hex += bytes[i]!.toString(16).padStart(2, '0');
  }
  return hex;
}
