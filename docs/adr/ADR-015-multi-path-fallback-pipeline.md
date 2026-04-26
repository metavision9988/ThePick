# ADR-015: Multi-Path Fallback Pipeline

작성일: 2026-04-26
상태: Accepted
관련: ADR-008, ADR-019
검토서 §2 결함 A (P1)

## Context

기존 ADR-008 의 Graceful Degradation: 유사도 < 0.60 → "교재 O장 O절 참고" 안내.

비판자 (검토서 §2-A): _"유사도 < 0.60 = 컨텍스트 미파악인데, 어떻게 정확한 'O장 O절' 을 매핑하는가? 논리적 모순. 사용자에게 실패한 응답."_

학습자 시나리오:

- 질문: "낙엽률이 이상하게 나오는데" (구어체)
- Vectorize 유사도 0.55, 그러나 키워드 "낙엽률" 100% 일치
- 현 설계: LOW_SIMILARITY 거부 → 어디인지 모르는 페이지 안내 → 이탈

## Decision

**Multi-Path Fallback** 4단계 (단일 경로 → 다중 경로):

```
[학습자 질문]
    ↓
Stage 1: Vector Search (유사도 ≥ 0.75) → 정상 경로 (→ ADR-012)
    ↓ Miss
Stage 2: Keyword/N-gram Match (kkma/khaiii)
    ↓ Miss
Stage 3: Topic Cluster Routing (zero-shot 분류)
    ↓ Miss
Stage 4: Honest Refusal (검수 큐 자동 기록)
```

**Hard Rule 21**: 유사도 < 0.60 시 Multi-Path Fallback 의무 (단일 안내문 금지).

ADR-019 (Concurrent Execution) 와 결합 — 4 stage 를 병렬 실행 + Short-circuit.

## Consequences

### 긍정적

- 학습자 이탈 감소 — 폴백 경로 다양화
- 거부 응답 시 검수 큐 자동 기록 → 시스템 자체 학습
- Stage 4 "정직한 거부" 가 잘못된 정보보다 안전

### Trade-offs

- 형태소 분석기 (kkma/khaiii) Workers 호환 검토 필요 (POC 의무, R4.1.1)
- 응답 시간 우려 → ADR-019 (Concurrent) 로 해소

### 테스트 기준

| ID      | 통과 기준                                     |
| :------ | :-------------------------------------------- |
| MPF-T01 | 키워드 단독 질문 50건 → 90%+ 정확 토픽 라우팅 |
| MPF-T02 | 영역별 질문 100건 → 85%+ 정확 영역            |
| MPF-T04 | 정상 질문 → 거부율 < 5%                       |
| MPF-T05 | 거부된 질문 100% 진산님 검수 큐               |
