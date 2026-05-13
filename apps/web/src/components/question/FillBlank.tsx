/**
 * FillBlank — 단답형 단일 라인 입력. Enter 채점 (외부 onSubmit으로 위임).
 */

interface FillBlankProps {
  readonly value: string;
  readonly disabled: boolean;
  readonly onChange: (next: string) => void;
}

export function FillBlank({ value, disabled, onChange }: FillBlankProps) {
  return (
    <div>
      <label
        htmlFor="study-fillblank"
        className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500"
      >
        정답 입력
      </label>
      <input
        id="study-fillblank"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="단답형 입력 (① / 1 / 1번 모두 동일 처리)"
        autoComplete="off"
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm leading-relaxed text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-50 disabled:text-gray-500"
        style={{ minHeight: 44 }}
      />
      <p className="mt-2 text-[11px] text-gray-400">Ctrl+Enter 채점</p>
    </div>
  );
}
