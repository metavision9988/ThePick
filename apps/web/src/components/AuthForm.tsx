/**
 * AuthForm — 진산님 평가 환경 진입용 임시 인증 페이지 (Phase 2 Eval MVP M6 즉시 흡수, Session 065).
 *
 * login + register toggle 단일 컴포넌트. apps/api `/api/auth/{login,register}` 호출.
 * 성공 시 ?next 파라미터 또는 /study/ 로 redirect (cookie 자동 설정 — credentials='include').
 * Phase 3 launch 직전 디자인 본격 + 비밀번호 재설정 / 이메일 인증 등 carry-over (memory `project_launch_legal_bundle_deferred.md`).
 */

import { useEffect, useState } from 'react';

const API_BASE: string = import.meta.env.PUBLIC_API_BASE_URL ?? 'http://localhost:8787';

type Mode = 'login' | 'register';
type Phase = 'idle' | 'submitting' | 'error';

interface AuthError {
  readonly error: string;
  readonly message?: string;
}

const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  EMAIL_TAKEN: '이미 등록된 이메일입니다. 로그인을 시도해 주세요.',
  PASSWORD_PWNED: '안전하지 않은 비밀번호입니다. 다른 비밀번호를 사용해 주세요.',
  INVALID_CREDENTIALS: '이메일 또는 비밀번호가 일치하지 않습니다.',
  RATE_LIMITED: '시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.',
};

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
      const fallback =
        res.status === 429
          ? ERROR_MESSAGES.RATE_LIMITED
          : (ERROR_MESSAGES[code] ?? `요청 실패 (HTTP ${res.status})`);
      setErrorMsg(fallback);
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
            minLength={4}
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
          <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{errorMsg}</p>
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
