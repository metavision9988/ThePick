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

export type PublicEventKind = 'serve' | 'grade' | 'card' | 'defect';

export interface PublicEventFields {
  readonly subject?: string | null;
  readonly round?: number | null;
  readonly inputType?: string | null;
  /** 시험 종목 차원 — 호출 측 FIXED_EXAM_TYPE 주입(리터럴 중복 드리프트 방지, m-9). */
  readonly examType?: string | null;
  /** grade 이벤트만 — 정오. serve/card 는 미전달. */
  readonly isCorrect?: boolean;
  /**
   * defect 이벤트만 (5-페르소나 M-19) — 데이터 결함으로 서빙·채점이 422 거부된 사유.
   * 휘발 로그 외 유일 결함율 집계 원천(문항 id 미기록 — PII 0 유지, id 는 로그에서).
   *
   * ★ 정합성 신호(D-17) 포함 — 채점이 200 인 채 choiceId 미복원(무음 오답화)은 콘텐츠
   *   결함(422)이 아니다. 두 원인 분리 버킷: `choice_id_malformed`(길이 불일치 = 위조·쓰레기
   *   노이즈) / `choice_id_unresolved`(정상 길이 미매칭 = secret 회전·stale = 인시던트 후보).
   *   결함율 소비자는 defectReason 별 버킷팅으로 콘텐츠 결함과 정합성 신호를 분리 집계할 것.
   */
  readonly defectReason?: string;
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
        // blob[5] = defect 사유 (M-19 — defect 이벤트 외 빈 문자열).
        fields.defectReason ?? '',
      ],
      doubles: [fields.isCorrect === undefined ? -1 : fields.isCorrect ? 1 : 0],
    });
  } catch (err) {
    // 무음 금지 — AE 기록 실패는 warn (학습 응답 흐름엔 영향 없음).
    console.warn('[public] analytics writeDataPoint failed', err);
  }
}
