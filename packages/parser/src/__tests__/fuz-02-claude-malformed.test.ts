/**
 * FUZ-02 — Claude 변조 응답 8종 graceful 분류 throw
 *
 * Sprint 1 §5.3 NOT-IMPL P0 시나리오 신규 구현.
 * 근거 문서:
 *   - `packages/parser/__fixtures__/claude-malformed/README.md` (fixture 의도 + 분류)
 *   - `docs/quality/test-patterns.md` §2 (현 시점 FUZ-02 우회 패턴 — fs.readFile 직접)
 *   - `.jjokjipge/handoff-session-030.md` §2.A (시나리오 명세)
 *
 * 검증 invariants:
 *   - 8 fixtures 각각이 정확한 KnowledgeContractErrorClassification 으로 throw
 *   - 정상 (well-formed) contract 는 통과 — 회귀 방어
 */

import { describe, it, expect } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import {
  validateRawClaudeResponse,
  KnowledgeContractValidationError,
  type KnowledgeContractErrorClassification,
} from '../index';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(__dirname, '../../__fixtures__/claude-malformed');

interface MalformedFixture {
  file: string;
  classification: KnowledgeContractErrorClassification;
  description: string;
}

const FIXTURES: readonly MalformedFixture[] = [
  {
    file: '01-empty.json',
    classification: 'EMPTY_RESPONSE',
    description: '빈 응답 즉시 거부 (네트워크 끊김 / stop_reason)',
  },
  {
    file: '02-parse-error.json',
    classification: 'PARSE_ERROR',
    description: 'JSON 문법 오류 (잘림 / cutoff)',
  },
  {
    file: '03-xss-payload.json',
    classification: 'XSS_PAYLOAD_DETECTED',
    description: '<script> / javascript: / onerror= UI 렌더링 차단',
  },
  {
    file: '04-missing-required-field.json',
    classification: 'MISSING_REQUIRED_FIELD',
    description: 'truth_weight 부재 — node 검증 단계 거부',
  },
  {
    file: '05-ontology-unregistered-id.json',
    classification: 'ONTOLOGY_UNREGISTERED_ID',
    description: 'FAKE-999 / X-Y-Z — registry 미등록',
  },
  {
    file: '06-deeply-nested-100.json',
    classification: 'JSON_DEPTH_EXCEEDED',
    description: '100 단계 nested → 50 maxDepth 초과',
  },
  {
    file: '07-large-payload.json',
    classification: 'RESPONSE_SIZE_EXCEEDED',
    description: '~120 KB > 100 KB threshold (D1 transaction 보호)',
  },
  {
    file: '08-hard-rule-17-violation.json',
    classification: 'HARD_RULE_17_VIOLATION',
    description: 'son-hae-pyeong-ga-sa literal — EXAM_IDS catalogue 우회',
  },
] as const;

describe('FUZ-02 — Claude 변조 응답 8종 graceful 분류 거부', () => {
  for (const { file, classification, description } of FIXTURES) {
    it(`rejects ${file} as ${classification} — ${description}`, async () => {
      const raw = await readFile(resolve(FIXTURE_DIR, file), 'utf-8');

      expect(() => validateRawClaudeResponse(raw)).toThrow(KnowledgeContractValidationError);
      try {
        validateRawClaudeResponse(raw);
        throw new Error(`expected throw for ${file}`);
      } catch (err) {
        expect(err).toBeInstanceOf(KnowledgeContractValidationError);
        const ke = err as KnowledgeContractValidationError;
        expect(ke.classification).toBe(classification);
      }
    });
  }

  it('정상 contract 는 통과 (회귀 방어)', () => {
    const valid = JSON.stringify({
      nodes: [
        {
          id: 'CONCEPT-001',
          type: 'CONCEPT',
          title: '정상 노드',
          content: '정상 콘텐츠',
          truth_weight: 5,
          source_page: 100,
          book_page: 100,
          pdf_page: 100,
        },
      ],
      edges: [],
      formulas: [],
      constants: [],
    });
    const result = validateRawClaudeResponse(valid);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].id).toBe('CONCEPT-001');
  });

  it('classification 별 metadata 보존 (debugging trail)', async () => {
    const raw = await readFile(resolve(FIXTURE_DIR, '07-large-payload.json'), 'utf-8');
    try {
      validateRawClaudeResponse(raw);
      throw new Error('expected throw for large payload');
    } catch (err) {
      expect(err).toBeInstanceOf(KnowledgeContractValidationError);
      const ke = err as KnowledgeContractValidationError;
      expect(ke.classification).toBe('RESPONSE_SIZE_EXCEEDED');
      expect(ke.metadata.size).toBeGreaterThan(100 * 1024);
      expect(ke.metadata.maxAllowed).toBe(100 * 1024);
    }
  });

  it('options.maxSizeBytes 가 임계값 override (회귀 방어)', () => {
    const small = JSON.stringify({ nodes: [], edges: [], formulas: [], constants: [] });
    expect(() => validateRawClaudeResponse(small, { maxSizeBytes: 10 })).toThrow(
      /RESPONSE_SIZE_EXCEEDED/,
    );
  });

  it('options.maxDepth 가 깊이 임계값 override (회귀 방어)', () => {
    const nested = '{"a":' + '{"b":'.repeat(20) + 'null' + '}'.repeat(20) + '}';
    // 21 단계 — default 50 통과, custom 5 실패
    expect(() => validateRawClaudeResponse(nested, { maxDepth: 5 })).toThrow(/JSON_DEPTH_EXCEEDED/);
  });
});
