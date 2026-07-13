/* eslint-env node */
/**
 * public-analytics-reader (순수 로직) — 공개 표면 AE 이벤트 조회 소비자 (5-페르소나 D-20).
 *
 * analytics.ts 는 writer-only 였고(지표·결함율 유일 원천인데 읽는 자 0) AE 데이터는 ~90일 롤오프.
 * 본 모듈 = AE SQL 쿼리 구성 + 응답 파싱 + 지표 요약(부수효과 0, 테스트 검증).
 * 실행 오케스트레이터 = ../read-public-analytics.mjs.
 *
 * blob 레이아웃(analytics.ts recordPublicEvent 정합, 실 production 대조 확인):
 *   blob1=kind blob2=subject blob3=round blob4=inputType blob5=examType blob6=defectReason
 *   double1=isCorrect(1/0/-1) index1=kind
 * AE 는 고볼륨에서 샘플링하므로 카운트는 count() 아닌 **sum(_sample_interval)** 로 추정.
 */

/** env → AE dataset (wrangler.toml [[analytics_engine_datasets]] 정본). */
export const DATASETS = Object.freeze({
  dev: 'thepick_public_events_dev',
  staging: 'thepick_public_events_staging',
  production: 'thepick_public_events_production',
});

/**
 * 정합성 신호 defectReason (D-17) — 콘텐츠 결함(422)이 아니라 choiceId 미복원(무음 오채점).
 * 결함율 집계에서 콘텐츠 결함과 분리 버킷(4-Pass: 신호 희석·정답률 오염 방지).
 */
export const INTEGRITY_REASONS = Object.freeze(['choice_id_malformed', 'choice_id_unresolved']);

function assertPositiveInt(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name}: 양의 정수 필요 (받음: ${String(value)})`);
  }
}

/**
 * env·windowDays 로 지표 SQL 3종 구성. dataset 은 화이트리스트, windowDays 는 정수 검증 → 주입 안전.
 * @returns {{byKind:string, accuracyBySubject:string, defectByReason:string}}
 */
export function buildQueries(env, windowDays) {
  const dataset = DATASETS[env];
  if (dataset === undefined) {
    throw new Error(`buildQueries: 미지원 env '${String(env)}' (${Object.keys(DATASETS).join('|')})`);
  }
  assertPositiveInt(windowDays, 'windowDays');
  const since = `timestamp > now() - INTERVAL '${windowDays}' DAY`;
  return {
    byKind: `SELECT blob1 AS kind, sum(_sample_interval) AS n FROM ${dataset} WHERE ${since} GROUP BY kind ORDER BY n DESC`,
    accuracyBySubject: `SELECT blob2 AS subject, sum(_sample_interval) AS total, sum(if(double1=1,_sample_interval,0)) AS correct FROM ${dataset} WHERE blob1='grade' AND ${since} GROUP BY subject ORDER BY total DESC`,
    defectByReason: `SELECT blob6 AS reason, sum(_sample_interval) AS n FROM ${dataset} WHERE blob1='defect' AND ${since} GROUP BY reason ORDER BY n DESC`,
  };
}

/**
 * AE SQL API 응답({meta,data,rows} 또는 {success:false,errors}) → data 배열.
 * 실패·형식 이상은 throw(무음 금지) — 호출 측이 진단 가능하도록 사유 포함.
 */
export function parseAeResult(json) {
  if (json === null || typeof json !== 'object') {
    throw new Error('AE 응답이 객체가 아님');
  }
  if (json.success === false || json.errors !== undefined) {
    throw new Error(`AE 쿼리 실패: ${JSON.stringify(json.errors ?? json)}`);
  }
  if (!Array.isArray(json.data)) {
    throw new Error(`AE 응답에 data 배열 없음: ${JSON.stringify(json).slice(0, 200)}`);
  }
  return json.data;
}

/** AE 카운트는 문자열(UInt64)로 옴 — 안전 변환(NaN 차단). */
function toCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`카운트 파싱 실패: ${String(value)}`);
  return n;
}

/**
 * 이벤트 종류별 rows([{kind,n}]) → n 을 number 로 정규화(--json/텍스트 두 경로 타입 통일,
 * 4-Pass MINOR: 미변환 시 --json 소비자가 문자열 산술 오염 '16'+'12'='1612').
 */
export function summarizeKinds(rows) {
  return rows.map((r) => ({ kind: r.kind, n: toCount(r.n) }));
}

/**
 * grade 정답률 rows([{subject,total,correct}]) → 과목별 요약(정답률 %). total=0 은 accuracyPct=null.
 */
export function summarizeAccuracy(rows) {
  return rows.map((r) => {
    const total = toCount(r.total);
    const correct = toCount(r.correct);
    return {
      subject: r.subject === '' || r.subject == null ? '(미상)' : r.subject,
      total,
      correct,
      accuracyPct: total > 0 ? Math.round((correct / total) * 1000) / 10 : null,
    };
  });
}

/**
 * defect rows([{reason,n}]) → 콘텐츠 결함 vs 정합성 신호(D-17) 분리 집계.
 * @returns {{content:Array, integrity:Array, contentTotal:number, integrityTotal:number}}
 */
export function classifyDefects(rows) {
  const content = [];
  const integrity = [];
  let contentTotal = 0;
  let integrityTotal = 0;
  for (const r of rows) {
    const n = toCount(r.n);
    const reason = r.reason === '' || r.reason == null ? '(무사유)' : r.reason;
    if (INTEGRITY_REASONS.includes(reason)) {
      integrity.push({ reason, n });
      integrityTotal += n;
    } else {
      content.push({ reason, n });
      contentTotal += n;
    }
  }
  return { content, integrity, contentTotal, integrityTotal };
}

/** 사람이 읽는 리포트 문자열. */
export function formatReport({ env, windowDays, kinds, accuracy, defects }) {
  const lines = [];
  lines.push(`# 공개 표면 AE 지표 — env=${env} / 최근 ${windowDays}일`);
  lines.push('');
  lines.push('## 이벤트 종류별 (추정 카운트, 샘플보정)');
  if (kinds.length === 0) lines.push('  (이벤트 없음)');
  for (const k of kinds) lines.push(`  ${k.kind.padEnd(8)} ${k.n}`);
  lines.push('');
  lines.push('## 과목별 정답률 (grade)');
  if (accuracy.length === 0) lines.push('  (grade 이벤트 없음)');
  for (const a of accuracy) {
    const pct = a.accuracyPct === null ? 'n/a' : `${a.accuracyPct}%`;
    lines.push(`  ${String(pct).padStart(6)}  (${a.correct}/${a.total})  ${a.subject}`);
  }
  lines.push('');
  lines.push('## 결함/정합성 (defect)');
  lines.push(`  콘텐츠 결함 계: ${defects.contentTotal}`);
  for (const d of defects.content) lines.push(`    - ${d.reason}: ${d.n}`);
  lines.push(`  ★정합성 신호 계(D-17, 스파이크=secret 회전·위조): ${defects.integrityTotal}`);
  for (const d of defects.integrity) lines.push(`    - ${d.reason}: ${d.n}`);
  return lines.join('\n');
}
