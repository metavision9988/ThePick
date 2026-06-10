/**
 * AuthForm — 진산님 평가 환경 진입용 임시 인증 페이지 (Phase 2 Eval MVP M6 즉시 흡수, Session 065).
 *
 * login + register toggle 단일 컴포넌트. apps/api `/api/auth/{login,register}` 호출.
 * 성공 시 ?next 파라미터 또는 /study/ 로 redirect (cookie 자동 설정 — credentials='include').
 * Phase 3 launch 직전 디자인 본격 + 비밀번호 재설정 / 이메일 인증 등 carry-over (memory `project_launch_legal_bundle_deferred.md`).
 */

import { useEffect, useState } from 'react';
import { PASSWORD_MIN_LENGTH_RELAXED, PASSWORD_MAX_LENGTH } from '@thepick/shared';

const API_BASE: string = import.meta.env.PUBLIC_API_BASE_URL ?? 'http://localhost:8787';

// Stage E P-δ C-δ-2 흡수 — 클라이언트-서버 정책 sync.
// PUBLIC_PASSWORD_MIN_LENGTH Astro env (build-time) → 서버 PASSWORD_MIN_LENGTH와 동기 갱신.
// Phase 3 toggle 시 web 재배포 의무 (wrangler.toml + .env 동시 변경).
// fallback: RELAXED (Phase 2 default, 4자) — env 미설정 시 server enforcement이 최종 게이트.
const PUBLIC_PASSWORD_MIN: string | undefined = import.meta.env.PUBLIC_PASSWORD_MIN_LENGTH;
const PASSWORD_MIN_HINT = (() => {
  if (PUBLIC_PASSWORD_MIN === undefined || PUBLIC_PASSWORD_MIN === '') {
    return PASSWORD_MIN_LENGTH_RELAXED;
  }
  const parsed = Number.parseInt(PUBLIC_PASSWORD_MIN, 10);
  if (
    !Number.isFinite(parsed) ||
    parsed < PASSWORD_MIN_LENGTH_RELAXED ||
    parsed > PASSWORD_MAX_LENGTH
  ) {
    return PASSWORD_MIN_LENGTH_RELAXED;
  }
  return parsed;
})();

type Mode = 'login' | 'register';
type Phase = 'idle' | 'submitting' | 'error';

// Stage E P-δ C-δ-1 흡수 — 422 응답 issues 배열 파싱.
// 서버 enforcePasswordPolicy / Zod validation 모두 동일 형식: {issues: [{path, code, minimum?, message}]}
interface AuthErrorIssue {
  readonly path?: ReadonlyArray<string | number>;
  readonly code?: string;
  readonly minimum?: number;
  readonly message?: string;
}

interface AuthError {
  readonly error: string;
  readonly message?: string;
  readonly issues?: ReadonlyArray<AuthErrorIssue>;
}

const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  EMAIL_TAKEN: '이미 등록된 이메일입니다. 로그인을 시도해 주세요.',
  PASSWORD_PWNED: '안전하지 않은 비밀번호입니다. 다른 비밀번호를 사용해 주세요.',
  INVALID_CREDENTIALS: '이메일 또는 비밀번호가 일치하지 않습니다.',
  RATE_LIMITED: '시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.',
  VALIDATION_ERROR: '입력값을 확인해 주세요.',
  TOO_MANY_REQUESTS: '시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.',
};

/**
 * Stage E P-δ C-δ-1 — 422 응답에서 사용자 친화 메시지 추출.
 *
 * 우선순위:
 *   1. password too_small issue → "비밀번호는 N자 이상이어야 합니다"
 *   2. email validation issue → "이메일 형식이 올바르지 않습니다"
 *   3. 기타 issues[0].message → 그대로 표시
 *   4. fallback → ERROR_MESSAGES.VALIDATION_ERROR
 */
function extractValidationMessage(issues: ReadonlyArray<AuthErrorIssue> | undefined): string {
  if (issues === undefined || issues.length === 0) {
    return ERROR_MESSAGES.VALIDATION_ERROR ?? '입력값을 확인해 주세요.';
  }
  const passwordIssue = issues.find((iss) => iss.path?.[0] === 'password');
  if (passwordIssue !== undefined) {
    if (passwordIssue.code === 'too_small' && typeof passwordIssue.minimum === 'number') {
      return `비밀번호는 ${passwordIssue.minimum}자 이상이어야 합니다.`;
    }
    if (passwordIssue.message !== undefined && passwordIssue.message !== '') {
      return `비밀번호: ${passwordIssue.message}`;
    }
  }
  const emailIssue = issues.find((iss) => iss.path?.[0] === 'email');
  if (emailIssue !== undefined) {
    return '이메일 형식이 올바르지 않습니다.';
  }
  return issues[0]?.message ?? ERROR_MESSAGES.VALIDATION_ERROR ?? '입력값을 확인해 주세요.';
}

/**
 * Stage E P-δ M-δ-1 흡수 — 429 응답 Retry-After 헤더 파싱 + 사용자 친화 안내.
 *
 * Retry-After 초 단위 → "약 N분 후" 또는 "약 N초 후" 표시.
 */
function formatRateLimitMessage(retryAfterSeconds: number | null): string {
  if (retryAfterSeconds === null || !Number.isFinite(retryAfterSeconds) || retryAfterSeconds <= 0) {
    return ERROR_MESSAGES.RATE_LIMITED ?? '시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.';
  }
  if (retryAfterSeconds >= 60) {
    const minutes = Math.ceil(retryAfterSeconds / 60);
    return `시도가 너무 많습니다. 약 ${minutes}분 후 다시 시도해 주세요.`;
  }
  return `시도가 너무 많습니다. 약 ${retryAfterSeconds}초 후 다시 시도해 주세요.`;
}

function resolveNext(): string {
  if (typeof window === 'undefined') return '/study/';
  const params = new URLSearchParams(window.location.search);
  const next = params.get('next');
  if (next === null || next === '') return '/study/';
  if (!next.startsWith('/') || next.startsWith('//')) return '/study/';
  return next;
}

export function AuthForm() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setErrorMsg(null);
  }, [mode]);

  // 테스트 환경 자동 로그인 — PUBLIC_TEST_AUTOLOGIN=1 빌드에서만 동작(production launch 시 미설정).
  // /study/ 401 → /auth/login 리다이렉트 시 테스트 계정으로 자동 제출 → 타이핑 없이 진입.
  // 서버 인증은 그대로(실 세션 쿠키 발급) — 클라이언트 편의일 뿐. 실패 시 수동 폼으로 조용히 폴백.
  useEffect(() => {
    const auto = import.meta.env.PUBLIC_TEST_AUTOLOGIN;
    const tEmail = import.meta.env.PUBLIC_TEST_EMAIL;
    const tPassword = import.meta.env.PUBLIC_TEST_PASSWORD;
    if (auto !== '1' || tEmail === undefined || tPassword === undefined) return;
    let cancelled = false;
    setPhase('submitting');
    void (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: tEmail, password: tPassword }),
        });
        if (cancelled) return;
        if (res.ok) {
          window.location.href = resolveNext();
          return;
        }
        setEmail(tEmail);
        setPhase('idle');
      } catch {
        if (!cancelled) setPhase('idle');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setPhase('submitting');
    setErrorMsg(null);

    const path = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const body =
      mode === 'login'
        ? { email, password }
        : { email, password, name: name.trim() === '' ? undefined : name };

    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        window.location.href = resolveNext();
        return;
      }
      const errBody = (await res.json().catch(() => null)) as AuthError | null;
      const code = errBody?.error ?? 'UNKNOWN';

      // Stage E P-δ C-δ-1 흡수 — 422 issues 우선 파싱 (사용자 친화 메시지)
      let resolvedMsg: string;
      if (res.status === 422 && errBody !== null) {
        resolvedMsg = extractValidationMessage(errBody.issues);
      } else if (res.status === 429) {
        // Stage E P-δ M-δ-1 흡수 — Retry-After 헤더 파싱
        const retryAfterRaw = res.headers.get('Retry-After');
        const retryAfter = retryAfterRaw !== null ? Number.parseInt(retryAfterRaw, 10) : null;
        resolvedMsg = formatRateLimitMessage(retryAfter);
      } else {
        resolvedMsg = ERROR_MESSAGES[code] ?? `요청 실패 (HTTP ${res.status})`;
      }
      setErrorMsg(resolvedMsg);
      setPhase('error');
    } catch (err) {
      console.error('auth fetch failed', err);
      setErrorMsg('네트워크 오류 — 잠시 후 다시 시도해 주세요.');
      setPhase('error');
    }
  }

  return (
    <div className="mx-auto max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
      <h1 className="mb-1 text-xl font-semibold text-gray-900">
        {mode === 'login' ? '로그인' : '회원가입'}
      </h1>
      <p className="mb-6 text-xs text-gray-500">
        {mode === 'login' ? '쪽집게 평가 환경에 진입합니다.' : '평가 환경 계정을 새로 만듭니다.'}
      </p>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-700">이메일</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-700">비밀번호</span>
          <input
            type="password"
            required
            minLength={PASSWORD_MIN_HINT}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </label>

        {mode === 'register' && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-700">이름 (선택)</span>
            <input
              type="text"
              maxLength={100}
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </label>
        )}

        {errorMsg !== null && (
          <p
            role="alert"
            aria-live="polite"
            className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700"
          >
            {errorMsg}
          </p>
        )}

        <button
          type="submit"
          disabled={phase === 'submitting'}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:bg-gray-300"
        >
          {phase === 'submitting' ? '처리 중…' : mode === 'login' ? '로그인' : '회원가입'}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        className="mt-4 block w-full text-center text-xs text-indigo-600 hover:text-indigo-500"
      >
        {mode === 'login' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
      </button>
    </div>
  );
}
