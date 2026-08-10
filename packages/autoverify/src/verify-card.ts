/**
 * 카드 검증 종합 — 4개 검사를 ThePick 도메인(knowledge_nodes/formulas/constants)에 붙인다.
 *
 * ★층을 섞지 않는 것이 이 파일의 전부다 (plan §파일럿이 측정할 수 없는 것):
 *   · 3-1 인용 진위   = **인용 ↔ 원본 PDF 텍스트**   (description 과 대조하면 안 된다)
 *   · 3-2 수치 정합   = **카드 주장 ↔ 인용**
 *   · 3-3 짜깁기      = **인용 ↔ 원본 PDF 텍스트**
 *   · 3-4 앵커 충분성 = **카드 주장 ↔ 인용**
 *   description 은 요약·편집본이므로 인용과 축자 일치할 이유가 없다. 층을 섞으면 무의미해진다.
 *
 * 처분 3종(이식원 계승): `pass` / `queue`(사람) / `reject`.
 * ★**자동 승격은 하지 않는다** — 승격 가동은 autoverify plan §8 별도 게이트다.
 *   이 모듈은 판정만 내리고, 판정이 곧 승인이 아니다.
 */
import { checkQuoteFaithfulness, QUOTE_COVERAGE_THRESHOLD } from './bigram.js';
import { lcsRatio, LCS_RATIO_THRESHOLD } from './lcs.js';
import { missingAnchors } from './anchors.js';
import { valueGrounded } from './numeric.js';

export type Disposition = 'pass' | 'queue' | 'reject';
export type CheckId = 'S3-1-quote' | 'S3-2-value' | 'S3-3-splice' | 'S3-4-anchor';

export interface Finding {
  readonly check: CheckId;
  readonly cardId: string;
  readonly pass: boolean;
  readonly disposition: Disposition;
  readonly evidence: string;
}

export interface CardInput {
  readonly id: string;
  /** 카드가 주장하는 내용 (knowledge_nodes.description · formulas.equation_template 등). */
  readonly claim: string;
  /** 카드가 근거로 든 원문 축자 (source_quote). 없으면 검증 대상 밖 = 미검증. */
  readonly quote: string | null;
  /**
   * 인용의 출처 텍스트 — 원본 PDF 에서 뽑은 **해당 조문 청크**.
   * ★전문을 넣지 말 것: 바이그램 풀이 포화해 임계 0.95 의 변별력이 죽는다(bigram.ts §한계 2).
   * 없으면 3-1·3-3 은 판정 불가(queue) — 자동 통과로 바꾸지 않는다.
   */
  readonly sourceText: string | null;
}

export interface CardVerdict {
  readonly cardId: string;
  /** 가장 무거운 처분이 카드의 처분이다 (reject > queue > pass). */
  readonly disposition: Disposition;
  readonly findings: readonly Finding[];
}

const WEIGHT: Record<Disposition, number> = { pass: 0, queue: 1, reject: 2 };

function worst(a: Disposition, b: Disposition): Disposition {
  return WEIGHT[a] >= WEIGHT[b] ? a : b;
}

export function verifyCard(card: CardInput): CardVerdict {
  const findings: Finding[] = [];
  const push = (
    check: CheckId,
    pass: boolean,
    disposition: Disposition,
    evidence: string,
  ): void => {
    findings.push({ check, cardId: card.id, pass, disposition, evidence });
  };

  // 인용 자체가 없으면 검증 대상 밖이다. **"통과"가 아니라 "미검증"** 으로 표기한다
  // (STAGE 2 · 2-5 와 같은 규율 — 검사 못 한 것을 통과로 세는 것이 가장 위험한 상태다).
  if (card.quote === null || card.quote.trim() === '') {
    push('S3-1-quote', false, 'queue', '근거 원문 부재 — 검사 대상 밖(미검증). STAGE 2 백필 필요');
    return { cardId: card.id, disposition: 'queue', findings };
  }

  // --- 3-1 인용 진위 · 3-3 짜깁기 — 둘 다 원본 텍스트가 있어야 판정 가능 ---
  if (card.sourceText === null || card.sourceText.trim() === '') {
    push('S3-1-quote', false, 'queue', '출처 청크 부재 — 인용 진위 판정 불가(fail-closed)');
    push('S3-3-splice', false, 'queue', '출처 청크 부재 — 짜깁기 판정 불가(fail-closed)');
  } else {
    const q = checkQuoteFaithfulness(card.quote, card.sourceText);
    push(
      'S3-1-quote',
      q.pass,
      q.pass ? 'pass' : 'queue',
      q.reason ??
        `바이그램 커버리지 ${q.coverage.toFixed(3)} (임계 ${QUOTE_COVERAGE_THRESHOLD}) — ` +
          (q.pass
            ? '인용이 출처 청크에 실재'
            : // ★단정 금지: 이 검사는 "인용 ↔ **선언 주소에서 뽑은** 청크"를 본다.
              // 실패의 원인은 **세 갈래**이고 검사기는 셋을 구분하지 못한다 —
              //   (a) 인용이 지어낸 것  (b) 선언 주소가 틀린 것  (c) **인용이 엉뚱한 곳에서 온 것**.
              // ⛔ 이 주석은 한때 "실측 9건이 **전부 (b)**"라고 적었다 — **거짓이었다**(독립 리뷰 C-1).
              //   LAW-178 은 선언 주소(요령 p.817)가 **옳았고** 인용이 교재 본문 서술 조각이었다(= (c)).
              //   즉 3-1 이 잡은 것을 내가 "주소 탓"으로 오분류해 **진짜 데이터 결함을 덮을 뻔했다**.
              //   근본 수리(호 열거 오인 절단 + 헤드 괄호형 강제) 후 실측은 **8건 전부 (b)**(상법 페이지축).
              '인용이 출처 청크에 없다 — 지어낸 인용 / 선언 주소 오류 / 인용 오귀속(전부 사람 확인 대상)'),
    );

    const ratio = lcsRatio(card.quote, card.sourceText);
    const splicePass = ratio >= LCS_RATIO_THRESHOLD;
    push(
      'S3-3-splice',
      splicePass,
      splicePass ? 'pass' : 'queue',
      `LCS 연속 비율 ${ratio.toFixed(3)} (임계 ${LCS_RATIO_THRESHOLD} = 정확 포함) — ` +
        (splicePass
          ? '인용이 출처 청크에 통짜로 존재(정규화 후 부분문자열)'
          : '★연속성 미달 = 원문 단어 재조합(짜깁기·주체/속성 스왑) 또는 선언 주소 오류'),
    );
  }

  // --- 3-2 수치 정합 (주장 ↔ 인용) ---
  const v = valueGrounded(card.claim, card.quote);
  // ★진앙 분리 (독립 리뷰 M-3 처분) — `mismatch` 를 무조건 `reject`(카드 반려)로 돌리면
  //   **처분 등급이 진앙과 어긋난다.** 08-08 리뷰의 전수 재분류 결과가 정확히 그랬다:
  //   reject 11건의 진앙은 **카드 오류 0 / 인용 부족 8 / 과탐 3** 이었다.
  //   구분 기준은 추측이 아니라 데이터로 있다 — **주장 값이 출처 청크에는 있는데 인용에만
  //   없다면**, 틀린 것은 카드가 아니라 **너무 짧게 잘린 인용**이다. 그때는 `queue`(인용 보강).
  //   STAGE 4 자동 라우터가 붙으면 이 구분 없이는 정상 카드를 반려하게 된다.
  const quoteTooShort =
    v.kind === 'mismatch' &&
    card.sourceText !== null &&
    valueGrounded(card.claim, card.sourceText).kind === 'grounded';
  push(
    'S3-2-value',
    v.kind === 'grounded',
    v.kind === 'grounded'
      ? 'pass'
      : quoteTooShort
        ? 'queue'
        : v.kind === 'mismatch'
          ? 'reject'
          : 'queue',
    quoteTooShort
      ? `${v.detail} — ★단, 그 값이 **출처 청크에는 실재**한다 = 카드가 아니라 ` +
          '**인용이 짧게 잘린 것**(진앙 = STAGE 2 추출). 처분: 카드 반려가 아니라 인용 보강'
      : v.detail,
  );

  // --- 3-4 앵커 충분성 (주장 ↔ 인용) ---
  const missing = missingAnchors(card.claim, card.quote);
  push(
    'S3-4-anchor',
    missing.length === 0,
    missing.length === 0 ? 'pass' : 'queue',
    missing.length === 0
      ? '주장의 날짜·수치 앵커가 전부 인용 안에 실재'
      : `앵커 불충분 — [${missing.join(', ')}] 가 인용에 없다. ` +
          '인용은 주장값을 증거하는 최소 문장 전체여야 한다(인용 확장 요구)',
  );

  const disposition = findings.reduce<Disposition>((acc, f) => worst(acc, f.disposition), 'pass');
  return { cardId: card.id, disposition, findings };
}

export interface PilotSummary {
  readonly total: number;
  readonly pass: number;
  readonly queue: number;
  readonly reject: number;
  /** 검사별 실패 건수 — "무엇이 몇 건 걸렸는지"를 숫자로 보고하기 위한 집계. */
  readonly byCheck: Readonly<Record<CheckId, number>>;
}

export function summarize(verdicts: readonly CardVerdict[]): PilotSummary {
  const byCheck: Record<CheckId, number> = {
    'S3-1-quote': 0,
    'S3-2-value': 0,
    'S3-3-splice': 0,
    'S3-4-anchor': 0,
  };
  let pass = 0;
  let queue = 0;
  let reject = 0;
  for (const v of verdicts) {
    if (v.disposition === 'pass') pass += 1;
    else if (v.disposition === 'queue') queue += 1;
    else reject += 1;
    for (const f of v.findings) if (!f.pass) byCheck[f.check] += 1;
  }
  return { total: verdicts.length, pass, queue, reject, byCheck };
}
