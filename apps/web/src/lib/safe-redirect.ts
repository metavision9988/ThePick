/**
 * safe-redirect — 개방 리다이렉트(open redirect) 차단 (4-Pass M-1).
 *
 * 로그인 후 `?next=` 파라미터를 **내부 경로로만** 해석한다. promo-1st 로 로그인 화면이
 * 공개 표면화되며 노출면이 커져, 절대/프로토콜-상대/백슬래시 우회 URL 을 그대로
 * `window.location.href` 에 넘기면 피싱 사이트로 리다이렉트된다.
 *
 * 차단 대상(전부 fallback):
 *   - 스킴 URL: `https://evil.com`, `javascript:...`
 *   - 프로토콜-상대: `//evil.com`
 *   - 백슬래시 우회: `/\evil.com` (URL 디코드 후 WHATWG 파서가 `\`→`/` 정규화 = `//evil.com`)
 */
export function resolveSafeNext(search: string, fallback = '/study/'): string {
  const next = new URLSearchParams(search).get('next');
  if (next === null || next === '') return fallback;
  // '/' 로 시작 + 두 번째 문자가 '/'·'\' 가 아니어야 내부 경로(single-slash absolute path).
  if (!/^\/[^/\\]/.test(next)) return fallback;
  return next;
}
