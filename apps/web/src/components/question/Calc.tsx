/**
 * Calc — 계산식 수치 입력 + (선택) 단위 보조 라벨 + (선택) 산식 변수 surface.
 * 서버 채점 시 calcTolerance 적용. 클라이언트는 단순 문자열 송신 (서버에서 parseFloat).
 */

interface CalcProps {
  readonly value: string;
  readonly disabled: boolean;
  readonly onChange: (next: string) => void;
  readonly variables: Record<string, number> | null;
}

function formatVariableValue(v: number): string {
  if (Number.isInteger(v)) return v.toLocaleString('ko-KR');
  return v.toLocaleString('ko-KR', { maximumFractionDigits: 4 });
}

export function Calc({ value, disabled, onChange, variables }: CalcProps) {
  const hasVariables = variables !== null && Object.keys(variables).length > 0;
  return (
    <div>
      {hasVariables && (
        <dl className="mb-4 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs">
          <dt className="mb-1 font-medium uppercase tracking-wide text-gray-500">산식 변수</dt>
          <dd className="space-y-0.5">
            {Object.entries(variables).map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between">
                <span className="text-gray-700">{k}</span>
                <span className="font-mono tabular-nums text-gray-900">
                  {formatVariableValue(v)}
                </span>
              </div>
            ))}
          </dd>
        </dl>
      )}
      <label
        htmlFor="study-calc"
        className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500"
      >
        수치 입력
      </label>
      <div className="flex items-center gap-2">
        <input
          id="study-calc"
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="숫자 입력 (예: 7500000)"
          autoComplete="off"
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm leading-relaxed text-gray-900 tabular-nums focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-50 disabled:text-gray-500"
          style={{ minHeight: 44 }}
        />
      </div>
      <p className="mt-2 text-[11px] text-gray-400">Ctrl+Enter 채점 · 단위는 정답과 자동 비교</p>
    </div>
  );
}
