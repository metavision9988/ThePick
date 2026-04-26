# ADR-017: Multi-Exam Common Foundation (Year 2 Reserved)

작성일: 2026-04-26
상태: Accepted (Year 1 placeholder, Year 2 본격)
관련: ADR-007, ADR-011
검토서 §2 결함 F (P2)

## Context

Year 1 (손해평가사 단독) 시점에는 본 결함 미발생. Year 2 진입 시 비판자 (검토서 §2-F) 옳음:

- 공인중개사 + 감정평가사가 민법 공유
- 동일 데이터 중복 적재는 "단일 진실 원천" 비전 위반
- Common Foundation 계층 + REFERENCES 교차 참조 구조 필요

농어업재해보험법은 손해평가사 전용 — 다른 시험과 공유 안 됨.
그러나 민법 / 상법 일부는 다중 자격증 공유.

## Decision

**`packages/exams/_common/`** 네임스페이스 예약 (Year 1 placeholder, Year 2 본격).

### 디렉토리 구조 (Year 2)

```
packages/exams/
├── _common/                     # 멀티시험 공유 도메인
│   ├── README.md
│   ├── manual/
│   │   ├── civil-law/           # 민법 (Year 2)
│   │   ├── commercial-law/      # 상법 (Year 2)
│   │   └── ...
│   ├── domain-types.ts          # CIVIL-LAW-NNN, COMMON-LAW-NNN
│   ├── ontology-extension.json
│   └── exam-metadata.ts         # exam_id = '_common'
│
├── son-hae-pyeong-ga-sa/        # Year 1 instance
└── gong-in-jung-gae-sa/         # Year 2 추가 — 민법은 _common.civil-law REFERENCES
```

### 교차 참조 메커니즘

```typescript
{
  "id": "INS-01",
  "exam_id": "son-hae-pyeong-ga-sa",
  "edges": [{
    "to_node": "CIVIL-LAW-001",
    "to_exam_id": "_common",      # 명시적 cross-domain
    "relation": "REFERENCES"
  }]
}
```

### 격리 정책 보존

학습자가 자격증 A 학습 → 메인 도메인 + `_common` 의 REFERENCES 만 노출. 다른 자격증 전용 노드는 비노출.

**Hard Rule 23**: `packages/exams/_common/` 네임스페이스 예약. Year 1 에는 placeholder 만, Year 2 에 본격 활용.

### Year 1 코드

```
packages/exams/_common/
└── README.md  ← Year 1 에는 이 파일만
```

## Consequences

### 긍정적

- Year 2 진입 비용 사전 절감 (네임스페이스만 미리 예약)
- 멀티시험 진입 시 "단일 진실 원천" 비전 보존
- 교차 참조 메커니즘으로 격리 + 공유 동시 달성

### Trade-offs

- Year 1 미완성 — 본격 구현 Year 2 진입 시
- Year 1 코드 단순 (placeholder), 실 가치는 Year 2

### 적용 시점

- **Year 1**: README.md 만 (예약)
- **Year 2**: 민법 / 상법 본격 적재 + plugin 패턴 활성
