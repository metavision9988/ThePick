# Claude Malformed Response Fixtures — FUZ-02

> Sprint 1 §5.2 도구 정비 (handoff-029 §2.A) 산출물.
> P0 시나리오 **FUZ-02 — Claude 변조 응답 8종** 신규 구현 시 사용.

---

## 1. 목적

`packages/parser/src/schema-validator.ts` 가 Claude API (또는 BATCH 적재 단계 LLM 출력) 의 8 종 변조 응답에 대해 **graceful 분류 실패** (= `KnowledgeContractValidationError(<분류>)` throw) 하는지 검증한다. 각 fixture 는 실제 위협 vector 의 **단순화 재현** 이며, 본 README §4 의 한계를 함께 읽어야 한다.

| 파일                                       | 분류                       | 검증 대상                                              |
| :----------------------------------------- | :------------------------- | :----------------------------------------------------- |
| `01-empty.json` (0 B)                      | `EMPTY_RESPONSE`           | 빈 응답 즉시 거부                                      |
| `02-parse-error.json` (66 B)               | `PARSE_ERROR`              | JSON.parse 실패 — 따옴표 / 닫힘 brace 누락             |
| `03-xss-payload.json` (320 B)              | `XSS_PAYLOAD_DETECTED`     | content / title 필드의 `<script>` / `javascript:` 차단 |
| `04-missing-required-field.json` (254 B)   | `MISSING_REQUIRED_FIELD`   | `truth_weight` 등 필수 필드 부재                       |
| `05-ontology-unregistered-id.json` (462 B) | `ONTOLOGY_UNREGISTERED_ID` | `FAKE-999` / `X-Y-Z` 등 registry 미등록 ID             |
| `06-deeply-nested-100.json` (2.4 KB)       | `JSON_DEPTH_EXCEEDED`      | 100 단계 nested → JSON.parse stack 위험                |
| `07-large-payload.json` (~120 KB)          | `RESPONSE_SIZE_EXCEEDED`   | content 단일 노드 120 KB — D1 transaction 1 MB 보호    |
| `08-hard-rule-17-violation.json` (313 B)   | `HARD_RULE_17_VIOLATION`   | content 에 `'son-hae-pyeong-ga-sa'` literal            |

---

## 2. 각 fixture 의 의도

### 2.1 `01-empty.json` (0 바이트)

**목적**: Claude API 가 empty body 반환 시 (네트워크 끊김 / 토큰 0 / 모델 거부) schema-validator 가 즉시 거부하는지 검증.

**예상 동작**:

- `JSON.parse('')` → `SyntaxError` → schema-validator 에서 `KnowledgeContractValidationError('EMPTY_RESPONSE')` 변환.
- 비정상 stream 으로 진입하지 않음.

### 2.2 `02-parse-error.json` (JSON 문법 오류)

**목적**: Claude 가 정상 JSON 형식을 깨뜨린 응답 반환 시 (예: 잘린 응답 / 토큰 한도 초과 후 cutoff) graceful 거부.

**파일 내용**:

```text
{"nodes": [{"id": "CONCEPT-001", type: CONCEPT, "title": "broken"
```

(닫히지 않은 brace + 따옴표 없는 키)

**예상 동작**: `KnowledgeContractValidationError('PARSE_ERROR', { lineNumber, columnNumber })` throw + 원본 응답 일부 (앞 200자) 에러 메타데이터에 보존 (debugging trail).

### 2.3 `03-xss-payload.json` (스크립트 주입)

**목적**: Claude 가 (의도치 않게 또는 공격자 주입으로) `<script>` / `javascript:` / `<img onerror>` 같은 XSS payload 를 content / title 에 포함했을 때 **즉시 거부**.

**위험 회귀 (탐지 의무)**:

- content 가 사용자 UI 에 raw HTML 로 렌더링되면 (React 의 unsafe innerHTML props 등) XSS 실행.
- markdown 변환 단계가 `<script>` 를 그대로 통과시키면 XSS.

**예상 동작**: schema-validator 의 sanitization 단계에서 `<script>` / `javascript:` 정규식 매칭 → `KnowledgeContractValidationError('XSS_PAYLOAD_DETECTED', { field, snippet })` throw.

### 2.4 `04-missing-required-field.json` (필수 필드 누락)

**handoff-029 §2.A 명세 매핑**: 원래 명세는 "examId 누락" 이지만, 현 schema-validator 의 `KnowledgeContract` 타입에 `examId` 필드가 부재 (Hard Rule 16 정합 — examId 는 함수 파라미터로 주입). 따라서 본 fixture 는 **node 레벨 필수 필드 (truth_weight) 누락** 으로 동등한 vector 를 재현.

**예상 동작**: schema-validator 의 node 검증 단계에서 `truth_weight` 부재 감지 → `KnowledgeContractValidationError('MISSING_REQUIRED_FIELD', { field: 'truth_weight', nodeId })` throw.

### 2.5 `05-ontology-unregistered-id.json` (Registry 미등록)

**목적**: Claude 가 hallucinate 한 node ID (`FAKE-999`) 또는 ID 패턴 위반 (`X-Y-Z`) 을 registry 에 등록되지 않은 채 반환했을 때 **즉시 거부**.

**예상 동작**: ontology-registry.ts 의 `isValidNodeId()` / `isValidNodeType()` 검증 실패 → `KnowledgeContractValidationError('ONTOLOGY_UNREGISTERED_ID', { id, expectedPattern })` throw + 후속 노드 검증 계속 진행 (full error list 반환 — 재수행 효율).

### 2.6 `06-deeply-nested-100.json` (100 단계 nested DoS)

**목적**: Claude 응답이 100 단계 nested object 를 포함할 때 (모델 hallucination / prompt injection) **JSON.parse 단계에서 stack overflow 발생 전 차단**.

**위험 회귀**:

- V8 의 JSON.parse 는 default ~10K depth 까지 안전. 100 단계는 V8 기본값에서는 통과하지만, schema-validator 가 자체 깊이 제한을 두지 않으면 사용자 입력 복합 시 (= attacker 가 입력에 100 단계 nested 추가) 위험.
- Sprint 1 §5.1 에서 흡수한 graph DFS stack overflow 와 동일 클래스 위험 (재귀 깊이).

**예상 동작**: schema-validator 의 pre-flight depth check 단계 (예: max depth 50) → `KnowledgeContractValidationError('JSON_DEPTH_EXCEEDED', { depth: 100, maxAllowed: 50 })` throw.

### 2.7 `07-large-payload.json` (~120 KB)

**handoff-029 §2.A 명세 매핑**: 원래 명세는 "100MB" 이지만, **git LFS 미설정 + repo 부담 회피** 를 위해 sentinel 크기 (~120 KB) 로 재현. 검증 의도는 동일 — **D1 transaction 1 MB 한도 보호**.

**예상 동작**:

- schema-validator 가 `JSON.stringify(contract).length` 또는 raw bytes 측정 → 임계값 (예: 100 KB 또는 1 MB) 초과 시 `KnowledgeContractValidationError('RESPONSE_SIZE_EXCEEDED', { size, maxAllowed })` throw.
- 또는 stream-based parser 사용 시 부분 파싱 후 size sentinel 발동.

**위험 회귀**: D1 single transaction 1 MB 한도 초과 시 INSERT 실패 → checkpoint 누락 → recover 시 부분 적재 위험.

### 2.8 `08-hard-rule-17-violation.json` (Hard Rule 17 위반)

**목적**: Claude 응답 content / title 에 `'son-hae-pyeong-ga-sa'` literal 이 직접 포함된 경우 **거부**. Hard Rule 17 (`production-quality.md` §"멀티시험 격리 Hard Rules") 정합 — exam_id literal 은 `EXAM_IDS` 경유만 허용.

**예상 동작**: schema-validator 의 sanitization 단계에서 알려진 examId literal 패턴 (`'son-hae-pyeong-ga-sa'`) 매칭 → `KnowledgeContractValidationError('HARD_RULE_17_VIOLATION', { field, snippet })` throw.

**위험 회귀**:

- Year 2 멀티시험 확장 시 본 응답이 그대로 DB 적재되면 `'son-hae-pyeong-ga-sa'` 가 다른 시험 데이터에 오염 가능.
- 또는 응답을 그대로 사용자 UI 렌더링 시 시험 ID 가 노출.

---

## 3. 사용 방법 (예시 테스트)

```typescript
import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

import { validateKnowledgeContract } from '../src/schema-validator.js';
import { KnowledgeContractValidationError } from '../src/errors.js';

const FIXTURE_DIR = resolve(__dirname, '../__fixtures__/claude-malformed');

describe('FUZ-02 — Claude 변조 응답 8종', () => {
  const cases: Array<{ file: string; classification: string }> = [
    { file: '01-empty.json', classification: 'EMPTY_RESPONSE' },
    { file: '02-parse-error.json', classification: 'PARSE_ERROR' },
    { file: '03-xss-payload.json', classification: 'XSS_PAYLOAD_DETECTED' },
    { file: '04-missing-required-field.json', classification: 'MISSING_REQUIRED_FIELD' },
    { file: '05-ontology-unregistered-id.json', classification: 'ONTOLOGY_UNREGISTERED_ID' },
    { file: '06-deeply-nested-100.json', classification: 'JSON_DEPTH_EXCEEDED' },
    { file: '07-large-payload.json', classification: 'RESPONSE_SIZE_EXCEEDED' },
    { file: '08-hard-rule-17-violation.json', classification: 'HARD_RULE_17_VIOLATION' },
  ];

  for (const { file, classification } of cases) {
    it(`rejects ${file} as ${classification}`, async () => {
      const raw = await readFile(resolve(FIXTURE_DIR, file), 'utf-8');
      expect(() => validateKnowledgeContract(raw)).toThrow(KnowledgeContractValidationError);
      try {
        validateKnowledgeContract(raw);
      } catch (err) {
        expect((err as KnowledgeContractValidationError).classification).toBe(classification);
      }
    });
  }
});
```

---

## 4. 본 fixtures 의 한계 (정직)

1. **fixture #4 의 명세 변경**: handoff-029 "examId 누락" → "필수 필드 누락" 으로 적응. 근거는 §2.4 본문. 동등한 검증 효과 보장.
2. **fixture #7 의 크기 변경**: handoff-029 "100MB" → "~120KB" sentinel. 근거는 §2.7 본문. 검증 의도는 임계값 초과 시 거부 — sentinel 크기 자체는 schema-validator 의 임계값에 따라 가변.
3. **PII Masking 검증 부재**: 본 fixtures 는 schema 단계 거부에 집중. PII Masking (사용자 식별자 노출) 은 별도 fixtures 로 P1 이상 확장 (handoff §2.A 본 시점 미포함).
4. **Claude API real response 재현 한계**: 본 fixtures 는 schema 위반의 단순화. 실제 Claude 가 반환하는 변조 응답은 더 정교 / 미묘할 수 있음.
5. **fixture #6 의 depth 100 적용 한계**: V8 JSON.parse 는 default ~10K depth 까지 안전. 본 fixture 는 schema-validator 의 자체 depth check 의무화를 검증하는 것이 목적 (즉, V8 한계 도달 전 거부).

---

## 5. fixture 추가 / 변경 시 의무

본 디렉토리 fixture 변경 시:

1. 본 README 의 §1 / §2 표 갱신 의무.
2. Sprint 1 §5.3 테스트 코드 동시 갱신 (회귀 방어).
3. PR 에 fixture 의 **의도** + **검증 방법** 명시.
4. 4-Pass 리뷰 시 본 fixtures 의 분류 정합성 + 본 README 의 §4 한계 섹션 동시 갱신.

---

**작성**: Claude (Opus 4.7 1M context) — Sprint 1 §5.2 / Session 029
**작성일**: 2026-05-02
**FUZ-02 본격 구현**: handoff-030 §5.3 (Sprint 1 §5.3) 시점
