# ADR-003: FSRS-5 간격반복 알고리즘 선정

- **상태:** Accepted
- **결정일:** 2026-04-12 (Phase 0 설계), 기록화 2026-04-18
- **결정자:** 진산 + Claude Opus 4.7
- **관련 문서:** 구현 재정립서 v2.0 §학습서비스 레이어

## 맥락 (Context)

손해평가사 시험은 광범위한 개념/산식/법조문을 장기간(평균 6~12개월) 학습해야 하며, **망각 곡선에 맞춘 복습 스케줄링**이 학습 효율을 좌우한다. 2026년 시점 간격반복 알고리즘 선택지:

| 알고리즘                       | 설명                                       | 강점                                     | 약점                       |
| ------------------------------ | ------------------------------------------ | ---------------------------------------- | -------------------------- |
| **SM-2 (Anki)**                | SuperMemo 2 파생, 1987년                   | 단순, 충분한 문헌                        | 파라미터 고정, 개인화 부족 |
| **SM-15/SM-17/SM-18**          | SuperMemo 최신                             | 정확도 최상                              | 비공개(상용), 복잡         |
| **FSRS-5**                     | Free Spaced Repetition Scheduler v5 (2024) | 오픈소스, SM-17 대비 유사 정확도, 가볍다 | 비교적 신규                |
| **HLR (Half-Life Regression)** | Duolingo 2016                              | 언어 학습 최적화                         | 시험 도메인 적합성 낮음    |

## 결정 (Decision)

**FSRS-5** 를 채택하며, 다음 원칙을 적용한다.

### 1. 라이브러리: `ts-fsrs` (공식 TypeScript 포팅)

- 현재 최신 안정판 사용
- 의존성 최소 (순수 TypeScript, 브라우저·Node·Workers 전부 호환)

### 2. 클라이언트 로컬 실행 원칙

- FSRS 스케줄 계산은 **브라우저에서 IndexedDB 데이터로 실행**
- 서버 왕복 없이 즉시 다음 카드 결정 → 오프라인 학습 가능
- 서버 동기화는 Background Sync 로 비동기 수행 (사용자 차단 없음)

### 3. 파라미터 전략

- **초기값:** FSRS-5 기본 파라미터 (19개 실수 계수)
- **개인화:** 사용자당 100회 이상 평가 누적 시 **개별 파라미터 최적화** 적용 (Phase 2 말)
- **대량 학습자 데이터 축적 전까지** 글로벌 파라미터 공유

### 4. 평가 등급 4단계

사용자 입력 UI는 4단계로 표준화:

- **Again (1)** — 틀림 / 전혀 모름
- **Hard (2)** — 맞혔지만 어려움
- **Good (3)** — 알고 있음
- **Easy (4)** — 완전 쉬움

이 4단계 그대로 FSRS 입력으로 전달.

### 5. 데이터 모델

```typescript
// IndexedDB card table schema
interface FsrsCard {
  id: string;
  due: Date; // 다음 복습 예정일
  stability: number; // 안정성
  difficulty: number; // 난이도
  elapsed_days: number;
  scheduled_days: number;
  reps: number; // 총 복습 횟수
  lapses: number; // 망각 횟수
  state: 'new' | 'learning' | 'review' | 'relearning';
  last_review: Date | null;
}
```

서버 D1에는 **집계 통계만** 저장(월별 복습 건수, 정답률), 세부 스케줄은 클라이언트 주도.

## 결과 (Consequences)

### 긍정적

- 서버 비용 0 (스케줄 계산)
- 오프라인 완전 지원
- 최신 알고리즘으로 학습 효율 최적화
- 개인화 여지 확보 (사용자 데이터 누적 시)

### 부정적

- FSRS-5 파라미터 최적화 코드 직접 포팅 필요 시 복잡도 증가 → **초기에는 미적용, 데이터 축적 후 도입**
- 클라이언트 시계 변조 가능성 → 서버 side에서 다중 디바이스 동기화 시 최신 `last_review` 기준으로 충돌 해결

### 중립

- 사용자가 기기 변경 시 IndexedDB 유실 → 서버 백업으로 복구 (Background Sync 경로)

## 참고 자료

- FSRS 공식: https://github.com/open-spaced-repetition/fsrs-rs
- ts-fsrs: https://github.com/open-spaced-repetition/ts-fsrs
- Jarrett Ye, "A Stochastic Shortest Path Algorithm for Optimizing Spaced Repetition Scheduling" (2022)

## 수정 이력

- 2026-04-12: Phase 0 설계 시 확정 (비공식)
- 2026-04-18: ADR 기록화
