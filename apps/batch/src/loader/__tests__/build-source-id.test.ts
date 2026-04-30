import { describe, expect, test } from 'vitest';
import { buildSourceId, PAGE_REF_FALLBACK, SOURCE_ID_SEPARATOR } from '../build-source-id.js';

describe('buildSourceId — Step 5 plan v1.1 §"v1.1 명시 이연" 권고 (B) 결정성 헬퍼', () => {
  test('case 1: 정상 page_ref + ontology nodeId → `{pageRef}#{nodeId}`', () => {
    // Step 16a 정상 caller 형식 — 정수 문자열 ('403') 만 (pageRefString via preValidate)
    expect(buildSourceId('123', 'CONCEPT-001')).toBe('123#CONCEPT-001');
    expect(buildSourceId('45', 'INS-01')).toBe('45#INS-01');
    expect(buildSourceId('220', 'CROP-001')).toBe('220#CROP-001');
    // 헬퍼 자체의 결정성 입증 — migration 0010 CHECK 제약 형식 (범위/section). 16b/16c 진입 시 caller 보강 의무.
    expect(buildSourceId('p.123-125', 'F-01')).toBe('p.123-125#F-01');
  });

  test('case 2: null page_ref → fallback `<no_page>#{nodeId}`', () => {
    expect(buildSourceId(null, 'CONCEPT-001')).toBe(`${PAGE_REF_FALLBACK}#CONCEPT-001`);
    expect(buildSourceId(null, 'F-01')).toBe('<no_page>#F-01');
  });

  test('case 3: undefined page_ref → fallback', () => {
    expect(buildSourceId(undefined, 'CONCEPT-001')).toBe('<no_page>#CONCEPT-001');
  });

  test('case 4: empty / whitespace page_ref → fallback', () => {
    expect(buildSourceId('', 'CONCEPT-001')).toBe('<no_page>#CONCEPT-001');
    expect(buildSourceId('   ', 'F-01')).toBe('<no_page>#F-01');
    expect(buildSourceId('\t\n', 'INS-01')).toBe('<no_page>#INS-01');
  });

  test('case 5: 결정성 100회 반복 — 동일 입력 → 동일 출력', () => {
    const inputs: ReadonlyArray<readonly [string | null, string]> = [
      ['123', 'CONCEPT-001'],
      ['p.123-125', 'F-01'],
      [null, 'INS-01'],
      ['', 'CROP-001'],
      ['220', 'CONCEPT-099'],
    ];

    for (const [pageRef, nodeId] of inputs) {
      const baseline = buildSourceId(pageRef, nodeId);
      for (let i = 0; i < 100; i++) {
        expect(buildSourceId(pageRef, nodeId)).toBe(baseline);
      }
    }
  });

  test('case 6: 빈 nodeId → throw (idempotency 키 부재 차단)', () => {
    expect(() => buildSourceId('123', '')).toThrow(/nodeId must be a non-empty string/);
    expect(() => buildSourceId('123', '   ')).toThrow(/nodeId must be a non-empty string/);
    expect(() => buildSourceId('123', '\t')).toThrow(/nodeId must be a non-empty string/);
  });

  test('case 7: 충돌 차단 — 다른 (pageRef, nodeId) → 다른 source_id', () => {
    const ids = new Set<string>();
    const pairs: ReadonlyArray<readonly [string | null, string]> = [
      ['123', 'CONCEPT-001'],
      ['123', 'CONCEPT-002'],
      ['124', 'CONCEPT-001'],
      [null, 'CONCEPT-001'],
      ['', 'CONCEPT-001'],
    ];

    for (const [pageRef, nodeId] of pairs) {
      ids.add(buildSourceId(pageRef, nodeId));
    }

    // null + empty 는 동일 fallback `<no_page>` → 동일 source_id (4건)
    expect(ids.size).toBe(4);
  });

  test('exports — PAGE_REF_FALLBACK 와 SOURCE_ID_SEPARATOR 가 plan v1.1 정의와 일치', () => {
    expect(PAGE_REF_FALLBACK).toBe('<no_page>');
    expect(SOURCE_ID_SEPARATOR).toBe('#');
  });

  test('Pass 3 M-3 흡수 — 매우 긴 ASCII nodeId (1024자) 결정성 보장', () => {
    // 헬퍼 자체는 길이 제한 없음 (preValidate 가 ontology 패턴 차단). 결정성 입증.
    const longId = 'A'.repeat(1024);
    const result = buildSourceId('123', longId);
    expect(result).toBe(`123#${longId}`);
    expect(result.length).toBe('123#'.length + 1024);
    // 결정성 100회 반복
    for (let i = 0; i < 100; i++) {
      expect(buildSourceId('123', longId)).toBe(result);
    }
  });

  test('Pass 3 M-3 흡수 — multi-byte (한글/일본어/이모지) nodeId 결정성 보장 (헬퍼 자체)', () => {
    // 정상 흐름 caller 는 isValidNodeId(type, id) 가 차단 (draft-loader.ts preValidate).
    // 본 헬퍼 자체는 임의 string 결정성 — UTF-8 multi-byte 안전성 입증.
    expect(buildSourceId('123', '개념-001')).toBe('123#개념-001');
    expect(buildSourceId('123', '概念-001')).toBe('123#概念-001');
    expect(buildSourceId('123', 'CONCEPT-001-🔥')).toBe('123#CONCEPT-001-🔥');
    // 결정성 — 동일 multi-byte 입력 → 동일 출력
    for (let i = 0; i < 100; i++) {
      expect(buildSourceId('123', '개념-001')).toBe('123#개념-001');
    }
  });

  test('Pass 3 M-3 흡수 — 제어 문자 nodeId (\\t/\\n/\\0) 결정성 보장 (헬퍼 자체)', () => {
    // 정상 흐름 caller 는 ontology 패턴이 차단. 헬퍼 자체는 throw 0건 + 결정성 보장.
    expect(buildSourceId('123', 'A\tB')).toBe('123#A\tB');
    expect(buildSourceId('123', 'A\nB')).toBe('123#A\nB');
    expect(buildSourceId('123', 'A\0B')).toBe('123#A\0B');
  });
});
