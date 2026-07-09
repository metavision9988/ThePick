/**
 * public/analytics — 무인증 공개 표면 익명 이벤트 (Analytics Engine, PII 0).
 *
 * G-1(로컬 진도·서버 user 데이터 0) 하에서 서버측 **유일 기록** = 익명 집계 이벤트.
 * 홍보 지표·오답 통계 원천(과목별 정답률 등). Cloudflare 단일 벤더(AE) — 외부 SaaS 0.
 *
 * PII 0 불변: IP·userId·문항 본문·정답 텍스트 미기록. 기록 = 이벤트 종류 + 과목/회차/
 * inputType/정오(집계 차원)뿐. 바인딩 미설정(dev/test) 시 무음 no-op.
 */

/** Cloudflare Analytics Engine dataset 바인딩 (writeDataPoint fire-and-forget). */
export interface AnalyticsEngineDataset {
  writeDataPoint(event: {
    readonly indexes?: readonly string[];
    readonly blobs?: readonly string[];
    readonly doubles?: readonly number[];
  }): void;
}

export type PublicEventKind = 'serve' | 'grade' | 'card';

export interface PublicEventFields {
  readonly subject?: string | null;
  readonly round?: number | null;
  readonly inputType?: string | null;
  /** 시험 종목 차원 — 호출 측 FIXED_EXAM_TYPE 주입(리터럴 중복 드리프트 방지, m-9). */
  readonly examType?: string | null;
  /** grade 이벤트만 — 정오. serve/card 는 미전달. */
  readonly isCorrect?: boolean;
}

/**
 * 익명 이벤트 기록. 바인딩 없으면 no-op. AE 는 fire-and-forget이므로 실패해도
 * 학습 응답에 영향 0 — 단 무음 금지(warn) 정책 준수.
 *
 * doubles[0] = 정오 (grade: 1/0, serve·card: -1 = 해당 없음) — 집계 시 필터.
 */
export function recordPublicEvent(
  ae: AnalyticsEngineDataset | undefined,
  kind: PublicEventKind,
  fields: PublicEventFields = {},
): void {
  if (ae === undefined) return;
  try {
    ae.writeDataPoint({
      indexes: [kind],
      blobs: [
        kind,
        fields.subject ?? '',
        fields.round === null || fields.round === undefined ? '' : String(fields.round),
        fields.inputType ?? '',
        // exam_type 차원 — 호출 측 주입(공개 표면 = FIXED_EXAM_TYPE '1st').
        fields.examType ?? '',
      ],
      doubles: [fields.isCorrect === undefined ? -1 : fields.isCorrect ? 1 : 0],
    });
  } catch (err) {
    // 무음 금지 — AE 기록 실패는 warn (학습 응답 흐름엔 영향 없음).
    console.warn('[public] analytics writeDataPoint failed', err);
  }
}
