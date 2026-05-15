#!/usr/bin/env tsx
/**
 * S5-6 multi-hop 정답률 측정 harness — **REMOTE runner** (Node-only IO).
 *
 * 근거: docs/plans/graph-walk-s5-6a-eval-harness.plan.md §3.
 *   순수 채점 코어(apps/api/src/eval/multihop-accuracy.ts, Workers-safe,
 *   vitest G-6a-2/3/4/5)와 분리 — 본 파일은 remote fetch / golden 파일
 *   읽기 / 리포트 쓰기 IO 만. Worker 번들 미포함.
 *
 * ★ LOCAL_SMOKE 는 본 CLI 가 아니라 vitest 가 소유한다:
 *   `apps/api/src/eval/__tests__/measure-runner.test.ts` 가 in-process Hono
 *   + sqlite + stub Vectorize 로 합성 픽스처 end-to-end 를 **결정적·CI 게이트**
 *   로 검증(G-6a-1/3). CLI 가 test helper(`__tests__/helpers`, C-CODE-2
 *   no-restricted-imports)를 import 하지 않도록 remote 전용화 — 4-Pass
 *   Pass3/4 M-1(lint 차단) + Pass1 M-1/M-2(스코프 외·취약 가드) 동시 해소.
 *
 * 사용 (진산 Cloudflare 인증 세션):
 *   THEPICK_API_BASE=https://<배포 Worker> \
 *     pnpm tsx scripts/measure-s5-6-multihop-accuracy.ts \
 *       --golden <eval.json> [--limit N] [--out <dir>]
 *   → 실 /api/search/graph 측정. REMOTE_G_S5. golden 파일·env 미충족 시
 *     비측정 종료 (수치 fabricate 차단 — CLAUDE.md RULE #4/#5 / plan §3).
 *     실 평가셋 golden 은 인증 세션이 remote D1 에서 추출한 산출물.
 *
 * 보안 (plan §4 G-6a-5): baseURL/자격증명은 **env 만** (인자/repo 평문 0).
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXAM_IDS } from '@thepick/shared';
import {
  parseRelatedNodes,
  scoreQuestion,
  aggregate,
  formatReportMarkdown,
  assertRemoteMeasurementInputs,
  type EvalGoldenItem,
  type GraphSearchResponseShape,
  type PerQuestionResult,
} from '../apps/api/src/eval/multihop-accuracy.js';

const HERE = dirname(fileURLToPath(import.meta.url));

/** golden 파일 (진산 인증 세션이 remote D1 에서 추출). */
interface GoldenFile {
  examId?: string;
  items: Array<{ questionId: string; content: string; relatedNodesRaw: string | null }>;
  coverageNote?: string;
}

interface Args {
  goldenPath: string | null;
  outDir: string;
  limit: number | null;
}

/**
 * 인자 파싱. `--limit` 은 silent 흡수 금지 (4-Pass Pass1 M-3) — 양의 정수
 * 아니면 throw (0/음수/NaN 이 전량·음수 slice 로 모집단을 무음 왜곡 차단).
 */
function parseArgs(argv: string[]): Args {
  let goldenPath: string | null = null;
  let limit: number | null = null;
  let outDir = join(HERE, '..', 'docs', 'plans', 's5-6-measurements');
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--golden') goldenPath = argv[++i] ?? null;
    else if (a === '--out') outDir = argv[++i] ?? outDir;
    else if (a === '--limit') {
      const rawLimit = argv[++i] ?? '';
      const n = Number.parseInt(rawLimit, 10);
      if (!Number.isInteger(n) || n <= 0) {
        throw new Error(`--limit 은 양의 정수여야 함 (받은 값: ${JSON.stringify(rawLimit)})`);
      }
      limit = n;
    } else if (a === '--local') {
      throw new Error(
        '--local 은 본 CLI 가 제공하지 않는다. LOCAL_SMOKE 는 vitest 소유 — ' +
          'pnpm --filter @thepick/api test src/eval (G-6a-1/3 결정적 게이트).',
      );
    }
  }
  return { goldenPath, outDir, limit };
}

async function runRemote(
  goldenPath: string | null,
  limit: number | null,
): Promise<{ per: PerQuestionResult[]; golden: EvalGoldenItem[]; coverage: string }> {
  // 사전조건 = 순수 코어 단일 진실원 (G-6a-5 — 게이트 정책 drift 0).
  const { apiBase, goldenPath: gp } = assertRemoteMeasurementInputs(
    process.env.THEPICK_API_BASE,
    goldenPath,
  );
  const goldenFile = JSON.parse(readFileSync(gp, 'utf-8')) as GoldenFile;
  const examId = goldenFile.examId ?? EXAM_IDS.SON_HAE_PYEONG_GA_SA;
  const itemsRaw = limit !== null ? goldenFile.items.slice(0, limit) : goldenFile.items;

  const per: PerQuestionResult[] = [];
  const golden: EvalGoldenItem[] = [];
  for (const it of itemsRaw) {
    const parsed = parseRelatedNodes(it.relatedNodesRaw);
    // remote: expected 의 approved 교집합은 golden 추출 SQL 이 이미 적용
    // (인증 세션 책임). 본 runner 는 추출 결과를 그대로 채점.
    const item: EvalGoldenItem = {
      questionId: it.questionId,
      content: it.content,
      expected: parsed.ids,
      relatedRawCount: parsed.ids.length,
      relatedMalformed: parsed.malformed,
    };
    golden.push(item);
    const r = await fetch(`${apiBase.replace(/\/$/, '')}/api/search/graph`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ examId, query: it.content, topK: 5 }),
    });
    if (!r.ok) {
      // fail-loud — 빈결과 삼킴 금지 (측정 무신뢰 차단).
      throw new Error(`remote graph search ${r.status} for ${it.questionId}`);
    }
    const body = (await r.json()) as GraphSearchResponseShape;
    per.push(scoreQuestion(item, body));
  }
  return {
    per,
    golden,
    coverage: goldenFile.coverageNote ?? `REMOTE: ${itemsRaw.length} questions measured`,
  };
}

async function main(): Promise<void> {
  const { goldenPath, outDir, limit } = parseArgs(process.argv);
  const { per, golden, coverage } = await runRemote(goldenPath, limit);

  const report = aggregate(per, golden, coverage);
  const generatedAt = new Date().toISOString();
  const md = formatReportMarkdown(report, 'REMOTE_G_S5', generatedAt);

  mkdirSync(outDir, { recursive: true });
  const stamp = generatedAt.replace(/[:.]/g, '').replace('T', '-').slice(0, 15);
  const base = join(outDir, `s5-6-remote-g-s5-${stamp}`);
  writeFileSync(`${base}.json`, JSON.stringify({ generatedAt, report }, null, 2));
  writeFileSync(`${base}.md`, md);
  // 성공만 조용히 — 산출물 경로 + 사실(수치 해석/판정은 진산, AI 자기채점 금지).
  process.stdout.write(`${md}\n\n[written] ${base}.md / ${base}.json\n[mode] REMOTE_G_S5\n`);
}

// CLI 전용 (어떤 모듈도 본 runner 를 import 하지 않음 — vitest 는 순수 코어
// /helper 를 직접 사용). 따라서 무조건 실행 (취약한 argv 가드 불요 —
// 4-Pass Pass1 M-2 해소: tsx/symlink 경로 불일치 no-op 위험 제거).
void main().catch((err: unknown) => {
  process.stderr.write(`[FAIL] ${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
});
