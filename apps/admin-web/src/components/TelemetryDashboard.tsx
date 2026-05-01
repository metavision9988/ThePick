/**
 * TelemetryDashboard — Engine Observability v1 7+1 게이지 read-only.
 *
 * Phase 1: 7 게이지 활성 + learning_slo placeholder
 * 인증 (Phase B 전환, handoff-028 + v1.1 §10.7 #9):
 *   - 사용자 토큰 입력 → POST /api/telemetry/login → server Set-Cookie admin_session (HttpOnly)
 *   - 이후 요청은 `credentials: 'include'` 로 쿠키 자동 전송 (XSS 1건에 토큰 노출 차단)
 *   - localStorage 사용 금지 (이전 anti-pattern)
 *   - logout 버튼 → POST /api/telemetry/logout → cookie 즉시 만료
 * 자동 폴링: 30초 (manual refresh 버튼 제공)
 *
 * 근거: docs/plans/engine-hardening/step19-observability.plan.md §5
 *      + ENGINE_HARDENING_COMPLETION_REPORT.md v1.1 §10.7 #9 (Sentinel)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ENGINE_TELEMETRY_GAUGES,
  GAUGE_LABELS,
  STATUS_COLORS,
  type DashboardResponse,
  type GaugeSnapshot,
} from '../types/telemetry';

const POLL_INTERVAL_MS = 30_000;
const MIN_TOKEN_LENGTH = 16;
// CRITICAL-DO-1 흡수 (Step 19 5-페르소나 devops): localhost fallback 은 dev 만.
// production 빌드 시 PUBLIC_API_BASE_URL 미설정 = misconfig → 빌드 시점에 throw 가
// 가장 안전하나 Astro static 빌드 환경에서는 client-side detection 으로 mode 분기.
const LOCALHOST_API_BASE = 'http://localhost:8787';

type AuthStatus = 'checking' | 'unauthenticated' | 'authenticated';

interface FetchState {
  readonly status: 'idle' | 'loading' | 'success' | 'unauthorized' | 'error';
  readonly data: DashboardResponse | null;
  readonly error: string | null;
  readonly fetchedAt: string | null;
}

/**
 * API base URL resolution.
 * - Astro 환경변수 PUBLIC_API_BASE_URL 우선
 * - dev 환경 (import.meta.env.DEV === true) 만 localhost fallback
 * - production 환경 + PUBLIC_API_BASE_URL 미설정 = misconfig → throw (silent localhost 차단)
 *
 * 근거: Step 19 5-페르소나 devops CRITICAL-DO-1 흡수.
 * 이전 동작은 production build 에서 localhost:8787 로 fallback → mixed-content 차단 +
 * 진산님 30분 진단 휘발 위험. 현재는 명시적 misconfig throw 로 즉시 가시화.
 */
function resolveApiBase(): string {
  const env = typeof import.meta.env !== 'undefined' ? import.meta.env : undefined;
  const fromEnv = env !== undefined ? (env.PUBLIC_API_BASE_URL as string | undefined) : undefined;
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv;

  const isDev = env?.DEV === true || env?.MODE === 'development';
  if (isDev) return LOCALHOST_API_BASE;

  throw new Error(
    'PUBLIC_API_BASE_URL not configured. Set in apps/admin-web/.env or Cloudflare Pages env. ' +
      'Phase 1 임시 — Cloudflare Access 도입 후 인증 + base URL 모두 콘솔 정책으로 이전.',
  );
}

function GaugeCard({ snapshot }: { snapshot: GaugeSnapshot }) {
  const label = GAUGE_LABELS[snapshot.gauge];
  const color = STATUS_COLORS[snapshot.status];
  const phaseTag = snapshot.phase === 2 ? 'Phase 2' : 'Phase 1';
  const isPlaceholder = snapshot.phase === 2;

  return (
    <div
      className="gauge-card"
      style={{
        background: '#fff',
        borderRadius: 8,
        padding: 16,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        opacity: isPlaceholder ? 0.55 : 1,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: '#0f172a' }}>{label}</h3>
        <span
          style={{
            fontSize: 11,
            color: '#475569',
            background: '#e2e8f0',
            padding: '2px 6px',
            borderRadius: 4,
          }}
        >
          {phaseTag}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span
          style={{
            display: 'inline-block',
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: color,
          }}
        />
        <span style={{ fontSize: 13, color: '#334155', textTransform: 'uppercase' }}>
          {snapshot.status}
        </span>
      </div>

      {snapshot.latest ? (
        <>
          <div
            style={{
              fontSize: 24,
              fontWeight: 600,
              color: '#0f172a',
              marginBottom: 4,
              fontFamily: 'monospace',
            }}
          >
            {snapshot.latest.metricValue !== null
              ? snapshot.latest.metricValue.toLocaleString()
              : '—'}
          </div>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            {new Date(snapshot.latest.recordedAt).toLocaleString('ko-KR')}
          </div>
          {snapshot.latest.metricJson && (
            <pre
              style={{
                fontSize: 10,
                color: '#475569',
                marginTop: 8,
                background: '#f8fafc',
                padding: 6,
                borderRadius: 4,
                overflow: 'auto',
                maxHeight: 80,
              }}
            >
              {JSON.stringify(snapshot.latest.metricJson, null, 2)}
            </pre>
          )}
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>
            24h count: <strong>{snapshot.count24h}</strong>
          </div>
        </>
      ) : (
        <div style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>
          {isPlaceholder ? 'Phase 2 활성 예정 (사용자 노출 후)' : '데이터 없음'}
        </div>
      )}
    </div>
  );
}

function TokenForm({ apiBase, onAuthenticated }: { apiBase: string; onAuthenticated: () => void }) {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (value.length < MIN_TOKEN_LENGTH || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/telemetry/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: value }),
      });
      if (res.ok) {
        setValue('');
        onAuthenticated();
        return;
      }
      if (res.status === 401) {
        setError('토큰이 일치하지 않습니다.');
      } else {
        setError(`서버 오류 (HTTP ${res.status})`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        background: '#fff',
        padding: 24,
        borderRadius: 8,
        maxWidth: 480,
        margin: '40px auto',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}
    >
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: '#0f172a' }}>
        Admin Token 입력
      </h2>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
        ADMIN_API_TOKEN 환경변수와 일치해야 합니다 (Phase 1 임시 인증). 토큰은 HttpOnly 쿠키로
        저장되어 24시간 유효하며, JS 메모리·localStorage 에 보관되지 않습니다. Phase 2 Cloudflare
        Access 도입 후 본 폼은 제거됩니다.
      </p>
      <input
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="X-Admin-Token"
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
        }}
        disabled={submitting}
        style={{
          width: '100%',
          padding: 10,
          fontSize: 13,
          fontFamily: 'monospace',
          border: '1px solid #cbd5e1',
          borderRadius: 4,
          marginBottom: 12,
        }}
      />
      {error && (
        <div
          role="alert"
          style={{
            background: '#fef2f2',
            color: '#7f1d1d',
            padding: 8,
            borderRadius: 4,
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={value.length < MIN_TOKEN_LENGTH || submitting}
        style={{
          width: '100%',
          padding: 10,
          fontSize: 14,
          fontWeight: 600,
          background: value.length >= MIN_TOKEN_LENGTH && !submitting ? '#1e293b' : '#cbd5e1',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          cursor: value.length >= MIN_TOKEN_LENGTH && !submitting ? 'pointer' : 'not-allowed',
        }}
      >
        {submitting ? '인증 중...' : '저장 (≥16자)'}
      </button>
    </div>
  );
}

export default function TelemetryDashboard() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking');
  const [state, setState] = useState<FetchState>({
    status: 'idle',
    data: null,
    error: null,
    fetchedAt: null,
  });

  const apiBase = useMemo(() => resolveApiBase(), []);

  const fetchDashboard = useCallback(async () => {
    setState((prev) => ({ ...prev, status: 'loading' }));
    try {
      const res = await fetch(`${apiBase}/api/telemetry/dashboard`, {
        credentials: 'include',
      });
      if (res.status === 401) {
        setAuthStatus('unauthenticated');
        setState({
          status: 'unauthorized',
          data: null,
          error: 'Cookie expired or invalid',
          fetchedAt: null,
        });
        return;
      }
      if (!res.ok) {
        setState({
          status: 'error',
          data: null,
          error: `HTTP ${res.status}`,
          fetchedAt: null,
        });
        return;
      }
      const data = (await res.json()) as DashboardResponse;
      setState({
        status: 'success',
        data,
        error: null,
        fetchedAt: new Date().toISOString(),
      });
      setAuthStatus('authenticated');
    } catch (err) {
      setState({
        status: 'error',
        data: null,
        error: err instanceof Error ? err.message : String(err),
        fetchedAt: null,
      });
    }
  }, [apiBase]);

  // 첫 로드 시 cookie 유효성 probe — 401 → TokenForm, 200 → dashboard
  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  // 인증 상태에서 30초 자동 폴링
  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    const id = window.setInterval(() => {
      void fetchDashboard();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [authStatus, fetchDashboard]);

  const handleLogout = useCallback(async () => {
    try {
      await fetch(`${apiBase}/api/telemetry/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // logout 실패 시에도 로컬 상태는 unauthenticated 으로 강제 — 쿠키 만료 까지 24h.
      // 서버 도달 실패 시 다음 fetchDashboard 호출이 401 → unauthenticated 자연 전이.
    }
    setAuthStatus('unauthenticated');
    setState({ status: 'idle', data: null, error: null, fetchedAt: null });
  }, [apiBase]);

  if (authStatus === 'checking') {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#64748b', fontSize: 14 }}>
        세션 확인 중...
      </div>
    );
  }

  if (authStatus === 'unauthenticated') {
    return (
      <TokenForm
        apiBase={apiBase}
        onAuthenticated={() => {
          setAuthStatus('authenticated');
          void fetchDashboard();
        }}
      />
    );
  }

  // 8 게이지 ordering — ENGINE_TELEMETRY_GAUGES 순서 (Phase 1 7개 → Phase 2 1개)
  const orderedSnapshots: GaugeSnapshot[] = state.data
    ? [...state.data.gauges].sort(
        (a, b) =>
          ENGINE_TELEMETRY_GAUGES.indexOf(a.gauge) - ENGINE_TELEMETRY_GAUGES.indexOf(b.gauge),
      )
    : ENGINE_TELEMETRY_GAUGES.map((gauge) => ({
        gauge,
        latest: null,
        count24h: 0,
        status: 'no_data' as const,
        phase: gauge === 'learning_slo' ? (2 as const) : (1 as const),
      }));

  return (
    <div style={{ padding: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          padding: '12px 16px',
          background: '#1e293b',
          borderRadius: 8,
          color: '#f8fafc',
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
          Engine Telemetry — 8 게이지 (Phase 1: 7 활성)
        </h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 12, opacity: 0.8 }}>
            {state.fetchedAt
              ? `Updated ${new Date(state.fetchedAt).toLocaleTimeString('ko-KR')}`
              : 'Not yet fetched'}
          </span>
          <button
            type="button"
            onClick={() => void fetchDashboard()}
            disabled={state.status === 'loading'}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              background: '#475569',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            {state.status === 'loading' ? 'Loading...' : 'Refresh'}
          </button>
          <button
            type="button"
            onClick={() => void handleLogout()}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              background: '#7f1d1d',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {state.status === 'error' && state.error && (
        <div
          style={{
            background: '#fef2f2',
            color: '#7f1d1d',
            padding: 12,
            borderRadius: 4,
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          Error: {state.error}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 12,
        }}
      >
        {orderedSnapshots.map((snapshot) => (
          <GaugeCard key={snapshot.gauge} snapshot={snapshot} />
        ))}
      </div>
    </div>
  );
}
