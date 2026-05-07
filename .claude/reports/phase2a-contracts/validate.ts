/**
 * Phase 2A 별표 2/5/6/7 contract 4건 validate runner.
 * 사용: tsx packages/parser/node_modules/.bin 또는 packages/quality 의 tsx 사용.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateKnowledgeContract } from '../../../packages/parser/src/schema-validator.ts';
import type { KnowledgeContract } from '../../../packages/parser/src/schema-validator.ts';

const here = dirname(fileURLToPath(import.meta.url));
const files = [
  'tbl-012-byeolpyo-2.json',
  'tbl-013-byeolpyo-5.json',
  'tbl-014-byeolpyo-6.json',
  'tbl-015-byeolpyo-7.json',
];

interface RunResult {
  file: string;
  valid: boolean;
  errorCount: number;
  errors: { path: string; code: string; message: string }[];
  stats: Record<string, number>;
}

const results: RunResult[] = [];
for (const file of files) {
  const raw = readFileSync(resolve(here, file), 'utf8');
  const parsed = JSON.parse(raw) as KnowledgeContract;
  const result = validateKnowledgeContract(parsed);
  results.push({
    file,
    valid: result.valid,
    errorCount: result.errors.length,
    errors: result.errors.slice(0, 20).map((e) => ({
      path: e.path,
      code: e.code,
      message: e.message,
    })),
    stats: result.stats as unknown as Record<string, number>,
  });
}

console.log(JSON.stringify({ results }, null, 2));
const allValid = results.every((r) => r.valid);
process.exit(allValid ? 0 : 1);
