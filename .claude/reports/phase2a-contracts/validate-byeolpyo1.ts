import { readFileSync } from 'node:fs';
import { validateKnowledgeContract } from '../../../packages/parser/src/schema-validator.ts';
import type { KnowledgeContract } from '../../../packages/parser/src/schema-validator.ts';

const raw = readFileSync(new URL('./tbl-001-byeolpyo-1.json', import.meta.url), 'utf8');
const parsed = JSON.parse(raw) as KnowledgeContract;
const result = validateKnowledgeContract(parsed);
console.log(
  JSON.stringify(
    {
      valid: result.valid,
      errorCount: result.errors.length,
      errors: result.errors.slice(0, 30),
      stats: result.stats,
    },
    null,
    2,
  ),
);
process.exit(result.valid ? 0 : 1);
