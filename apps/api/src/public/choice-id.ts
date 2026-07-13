/**
 * public/choice-id — 무인증 공개 표면 객관식 **불투명 choiceId** (셔플시드 대체).
 *
 * 인증 학습 경로(study/routes)는 `hash(userId || questionId || 날짜)` 시드로 보기를
 * 셔플하고 채점 시 동일 시드로 셔플을 재생성해 위치를 역추적한다. 공개 표면은
 *   ① userId 부재 ② 날짜 시드 = KST 자정 걸친 서빙→채점 오채점(carry-over 지뢰)
 * 두 문제로 이 방식을 쓸 수 없다.
 *
 * 대체 = 보기별 **불투명 choiceId**:
 *   choiceId(qId, originalIndex) = HMAC-SHA256(secret, `${qId}:${originalIndex}`) 앞 N hex.
 *
 * 특성:
 *   - **무상태**: 서빙 시 저장 0. 채점 시 questionId 의 보기 수(≤5)만큼 HMAC 재계산 후
 *     제출 choiceId 와 매칭 → originalIndex 복원. (서버 상태·세션·PII 0 — G-1 정합.)
 *   - **불투명**: 클라이언트는 hex 만 관측 — originalIndex·정답 여부 판별 불가.
 *   - **정답 비노출**: choiceId 는 정답 여부와 무관(위치 식별자일 뿐) — 정답 판정은
 *     서버가 parseMcChoices 의 correctOriginalIndices 로만 수행.
 *   - **날짜 무의존**: 결정성이 (qId, originalIndex, secret) 에만 의존 → 자정 재셔플 0.
 *
 * ★ 보안 주: 채점 후 정답 노출은 제품 요건(F-3)이라 정답은 어차피 드립 노출된다.
 *   choiceId 의 secret 은 위조 방지·전역 사전계산 차단 hygiene 목적이며, 유출 속도
 *   제어는 rate limit 이 담당(choice-id 스킴이 아님).
 */

/** HMAC hex 절단 길이 (12 bytes = 24 hex — 문항당 보기 ≤5 충돌 저항 충분). */
export const CHOICE_ID_HEX_LENGTH = 24;

/**
 * 공개 표면 choiceId HMAC 서명 키 해석 — **단일 진실원**(RC-3, D-22).
 *
 * serve/grade/reveal 3개 핸들러가 각자 `c.env.JWT_SECRET ?? ''` 를 반복하던 것을 1곳으로
 * 모은다. 현재 auth 용 `JWT_SECRET` 을 재사용하나 F-3 하 보안 경계가 아니며, 미설정 시
 * 폴백 `''`(→ `hmacHex` 가 `CHOICE_ID_FALLBACK_KEY` 로 승격, dev/스모크 결정성 보존).
 *
 * ★ 미래 `CHOICE_ID_SECRET` 분리(`docs/runbooks/secret-rotation.md` §7-1)의 **seam**: 해석
 *   로직이 이 함수 1곳에 모여 있어, 분리 시 본문(`env.CHOICE_ID_SECRET ?? env.JWT_SECRET ?? ''`)
 *   + 파라미터 타입/`PublicRouteBindings`/wrangler 바인딩에 `CHOICE_ID_SECRET` 필드만 추가하면
 *   된다. 3개 호출부(serve/grade/reveal)는 `c.env` 만 전달하므로 **zero-touch**(auth secret
 *   회전이 공개 choiceId 를 안 깨뜨리게 됨).
 */
export function resolvePublicChoiceSecret(env: { readonly JWT_SECRET?: string }): string {
  return env.JWT_SECRET ?? '';
}

/**
 * secret 미설정(dev/test) 시 도메인 분리 상수 — 빈 키 importKey 거부 회피 + 결정성 보존.
 * 공개 표면 정답이 discoverable(F-3)하므로 이 폴백이 보안을 낮추지 않는다.
 */
const CHOICE_ID_FALLBACK_KEY = 'thepick-public-choice-id-v1';

const encoder = new TextEncoder();

/**
 * HMAC CryptoKey 캐시 — (resolved) keyMaterial 당 importKey 1회 (5-페르소나 D-27).
 * 채점 시 resolveChoiceId 가 보기 수만큼 issueChoiceId 를 반복 호출하므로 매 호출
 * importKey 재수행은 순수 낭비였다. keyMaterial 종류는 극소(운영 secret 1 + dev 폴백 1)
 * → Map 무한 성장 없음. 파생 키 캐시(재계산 가능)이므로 상태 데이터 저장이 아니다.
 * importKey rejection 은 캐시 고착 방지 위해 evict(다음 호출 재시도).
 */
const hmacKeyCache = new Map<string, Promise<CryptoKey>>();

function getHmacKey(keyMaterial: string): Promise<CryptoKey> {
  let cached = hmacKeyCache.get(keyMaterial);
  if (cached === undefined) {
    cached = crypto.subtle
      .importKey('raw', encoder.encode(keyMaterial), { name: 'HMAC', hash: 'SHA-256' }, false, [
        'sign',
      ])
      .catch((err: unknown) => {
        hmacKeyCache.delete(keyMaterial);
        throw err;
      });
    hmacKeyCache.set(keyMaterial, cached);
  }
  return cached;
}

function bytesToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    hex += bytes[i]!.toString(16).padStart(2, '0');
  }
  return hex;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const keyMaterial = secret.length > 0 ? secret : CHOICE_ID_FALLBACK_KEY;
  const key = await getHmacKey(keyMaterial);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return bytesToHex(sig).slice(0, CHOICE_ID_HEX_LENGTH);
}

/** (questionId, originalIndex) → 불투명 choiceId. */
export async function issueChoiceId(
  secret: string,
  questionId: string,
  originalIndex: number,
): Promise<string> {
  return hmacHex(secret, `${questionId}:${originalIndex}`);
}

/**
 * 제출 choiceId → originalIndex 복원. 보기 수만큼 HMAC 재계산 후 매칭(≤5회).
 * 매칭 실패(위조·타 문항·손상) 시 null → 호출 측이 오답/거부 처리.
 */
export async function resolveChoiceId(
  secret: string,
  questionId: string,
  choiceCount: number,
  submittedChoiceId: string,
): Promise<number | null> {
  if (submittedChoiceId.length !== CHOICE_ID_HEX_LENGTH) return null;
  for (let originalIndex = 0; originalIndex < choiceCount; originalIndex++) {
    const candidate = await issueChoiceId(secret, questionId, originalIndex);
    if (candidate === submittedChoiceId) return originalIndex;
  }
  return null;
}
