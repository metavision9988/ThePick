/**
 * 각도 규약 lint (G-FE-3 C축 — formula-engine-expansion.plan.md §2-(b)·§7 Q3 A+C 결재).
 *
 * 규약: 도(degree) 단위 변수는 `_deg` 접미로 명명하고, 삼각함수에 넣을 때는
 * 반드시 `deg2rad(...)` 로 감싼다. 위반(= `_deg` 변수가 deg2rad 경유 없이
 * 삼각함수 인자 서브트리에 등장)은 라디안 무음 평가 — 65↔60 동급의 무음 오답
 * 클래스이므로 저작 단계에서 기계 검출한다 (런타임 차단이 아닌 저작 lint —
 * 적재 파이프라인/검수 시트 생성 시 호출).
 *
 * 보수 원칙 (fail-loud): 파싱 불가·복잡도 한도 초과 표현식은 위반 0 이 아니라
 * lint 불능으로 위반 1건을 보고한다 (무음 통과 금지 — 예외 탈출도 금지, P1-M1/P3-MAJ-1).
 *
 * ★검출 불가 인접 클래스 (정직 한계 명문화 — P3-MIN-1. 명명 규약 기반 lint 의 구조적 한계):
 *   ① 역방향 과보정 sin(deg2rad(omega)) — 라디안 변수를 감싼 ×π/180 무음 값오류
 *   ② 이중 적용 sin(deg2rad(deg2rad(x_deg)))
 *   ③ 명명 변형 theta_deg_2 (접미가 _deg 로 끝나지 않음 — 저작 규약: 다각도는 a1_deg 형)
 *   ①②는 골든 테스트(교재/공학 정본 예시값)가 값 층에서 잡는 것이 방어선.
 */

import { ANGLE_ARGUMENT_FUNCTIONS, safeParse } from './sandbox';
import { CalculationTimeoutError } from './errors';
import type { MathNode } from 'mathjs';
const DEG_SUFFIX = /_deg$/;

interface NodeLike {
  readonly type: string;
  readonly name?: string;
  readonly fn?: { readonly name?: string };
  readonly args?: ReadonlyArray<MathNode>;
  forEach(callback: (child: MathNode) => void): void;
}

/** 서브트리에서 deg2rad 로 보호되지 않은 `_deg` 심볼을 수집. */
function collectUnwrappedDegSymbols(node: MathNode, out: Set<string>): void {
  const n = node as unknown as NodeLike;
  if (n.type === 'FunctionNode' && n.fn?.name === 'deg2rad') {
    return; // deg2rad 내부는 규약 충족 — 하위 탐색 중단
  }
  if (n.type === 'SymbolNode' && n.name !== undefined && DEG_SUFFIX.test(n.name)) {
    out.add(n.name);
  }
  n.forEach((child) => collectUnwrappedDegSymbols(child, out));
}

/**
 * 각도 규약 위반 목록 반환 (빈 배열 = 위반 없음).
 * 위반 = 삼각함수 인자 서브트리에 deg2rad 미경유 `_deg` 변수 등장.
 */
export function lintAngleConvention(expression: string): string[] {
  let parsed: ReturnType<typeof safeParse>;
  try {
    parsed = safeParse(expression);
  } catch (e) {
    // 복잡도 예산 초과(CalculationTimeoutError)는 engine.calculate() 경유가 아니면 raw
    // throw — lint 의 string[] 계약 안으로 수렴시킨다 (P1-M1/P3-MAJ-1 교차 확증:
    // 배치 루프에서 1건의 과대 산식이 전체 런을 abort 하거나, 소비자 try/catch-continue
    // 가 무음 통과로 전락하는 경로 차단).
    if (e instanceof CalculationTimeoutError) {
      return [`lint 불능: 복잡도 한도 초과 — ${e.message}`];
    }
    throw e;
  }
  if (!parsed.ok) {
    // fail-loud: 파싱 실패를 "위반 없음" 으로 무음 통과시키지 않는다.
    return [`lint 불능: 표현식 파싱 실패 — ${parsed.message}`];
  }
  const violations: string[] = [];
  parsed.node.traverse((node: MathNode) => {
    const n = node as unknown as NodeLike;
    if (n.type !== 'FunctionNode' || n.fn?.name === undefined) return;
    if (!ANGLE_ARGUMENT_FUNCTIONS.has(n.fn.name)) return;
    const unwrapped = new Set<string>();
    for (const arg of n.args ?? []) {
      collectUnwrappedDegSymbols(arg, unwrapped);
    }
    for (const sym of unwrapped) {
      const inverseTrigNote =
        n.fn.name.startsWith('a') && n.fn.name !== 'atan2'
          ? ' ★역삼각 인자는 무차원 비율 — deg2rad 감싸기 전에 단위·명명이 맞는지부터 재확인'
          : '';
      violations.push(
        `${n.fn.name}(...) 인자에 도 단위 변수 '${sym}' 가 deg2rad 미경유로 등장 — ` +
          `해당 심볼 자리를 'deg2rad(${sym})' 로 감쌀 것 (라디안 무음 평가 차단).${inverseTrigNote}`,
      );
    }
  });
  return violations;
}
