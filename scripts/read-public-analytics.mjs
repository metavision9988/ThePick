#!/usr/bin/env node
/* eslint-env node */
/**
 * read-public-analytics — 공개 표면 AE 이벤트 조회 소비자 (5-페르소나 D-20 처분).
 *
 * analytics.ts 가 writer-only 라 지표·결함율·D-17 정합성 신호를 읽는 자가 0 이었다.
 * 본 스크립트가 Cloudflare Analytics Engine SQL API 로 production dataset 을 조회해
 * 이벤트 종류·과목별 정답률·결함/정합성 신호를 요약한다.
 *
 * 실행:
 *   CLOUDFLARE_API_TOKEN=<Account Analytics Read 토큰> \
 *     node scripts/read-public-analytics.mjs [--env production|staging|dev] [--days 7] [--json] [--alert]
 *   (계정 ID 는 CLOUDFLARE_ACCOUNT_ID 로 주입하거나 단일 계정이면 자동 탐색.)
 *
 * 종료 코드(cron 경보 구분 — 4-Pass MINOR: 보안 스파이크 ≠ 인프라 실패):
 *   0 = 정상  /  1 = 인프라·사용 오류(토큰·계정·쿼리·인자)  /  2 = --alert 정합성 신호 감지(보안).
 * --alert: 정합성 신호(choice_id_*)가 1건이라도 있으면 exit 2 (secret 회전·위조 스파이크 = 조사 필요).
 */
import {
  buildQueries,
  parseAeResult,
  summarizeKinds,
  summarizeAccuracy,
  classifyDefects,
  formatReport,
  DATASETS,
} from './lib/public-analytics-reader.mjs';

/** 종료 코드 = 2 (인프라 실패 1 과 구분 — cron 이 보안 스파이크를 알림피로에 묻지 않도록). */
const EXIT_INTEGRITY_ALERT = 2;

const CF_API = 'https://api.cloudflare.com/client/v4';

function parseArgs(argv) {
  const opts = { env: 'production', days: 7, json: false, alert: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--alert') opts.alert = true;
    else if (a === '--env') opts.env = argv[++i];
    else if (a.startsWith('--env=')) opts.env = a.slice('--env='.length);
    else if (a === '--days') opts.days = Number(argv[++i]);
    else if (a.startsWith('--days=')) opts.days = Number(a.slice('--days='.length));
    else throw new Error(`알 수 없는 인자: ${a}`);
  }
  if (DATASETS[opts.env] === undefined) {
    throw new Error(`--env '${opts.env}' 미지원 (${Object.keys(DATASETS).join('|')})`);
  }
  if (!Number.isInteger(opts.days) || opts.days <= 0) {
    throw new Error(`--days 는 양의 정수 (받음: ${opts.days})`);
  }
  return opts;
}

function fail(msg) {
  console.error(`🔴 ${msg}`);
  process.exit(1);
}

async function cfFetch(path, token, body) {
  const res = await fetch(`${CF_API}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'text/plain' } : {}) },
    body,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`CF 응답 파싱 실패 (${res.status}): ${text.slice(0, 200)}`);
  }
  return json;
}

async function resolveAccountId(token) {
  const envId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (envId !== undefined && envId !== '') return envId;
  const json = await cfFetch('/accounts', token);
  const accounts = json.result;
  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new Error('계정 조회 실패 (토큰에 Account 읽기 권한 필요 또는 계정 0)');
  }
  if (accounts.length > 1) {
    throw new Error(`계정 ${accounts.length}개 — CLOUDFLARE_ACCOUNT_ID 로 명시 필요`);
  }
  return accounts[0].id;
}

async function runQuery(accountId, token, sql) {
  const json = await cfFetch(`/accounts/${accountId}/analytics_engine/sql`, token, sql);
  return parseAeResult(json);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (token === undefined || token === '') {
    fail('CLOUDFLARE_API_TOKEN 미설정 (Account Analytics Read 토큰 필요).');
  }

  let accountId;
  try {
    accountId = await resolveAccountId(token);
  } catch (err) {
    fail(`계정 확인 실패: ${err instanceof Error ? err.message : String(err)}`);
  }

  const q = buildQueries(opts.env, opts.days);
  let kindsRows, accRows, defectRows;
  try {
    [kindsRows, accRows, defectRows] = await Promise.all([
      runQuery(accountId, token, q.byKind),
      runQuery(accountId, token, q.accuracyBySubject),
      runQuery(accountId, token, q.defectByReason),
    ]);
  } catch (err) {
    fail(`AE 쿼리 실패: ${err instanceof Error ? err.message : String(err)}`);
  }

  const accuracy = summarizeAccuracy(accRows);
  const defects = classifyDefects(defectRows);
  const kinds = summarizeKinds(kindsRows);

  if (opts.json) {
    console.log(JSON.stringify({ env: opts.env, windowDays: opts.days, kinds, accuracy, defects }, null, 2));
  } else {
    console.log(formatReport({ env: opts.env, windowDays: opts.days, kinds, accuracy, defects }));
  }

  if (opts.alert && defects.integrityTotal > 0) {
    console.error(
      `\n🟡 정합성 신호 ${defects.integrityTotal}건 감지 — secret 회전·choiceId 위조 스파이크 조사 필요 (D-17).`,
    );
    process.exit(EXIT_INTEGRITY_ALERT); // 인프라 실패(1)와 구분되는 코드 2 (경보 피로 방지).
  }
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
