# 쪽집게 — SLM + LoRA 도입방안 기획 v1.1 FINAL

> **진산님 5건 결재 반영 최종본** (2026-04-24)
>
> 본 문서는 다음을 통합한 **단일 실행 지침서**:
>
> - Claude Code 기획서 v1.0
> - COVEN 검토서
> - META 분석 v1.0
> - 진산님 결재 의견 (2026-04-24)
>
> 다음 단계: 본 v1.1을 v3.0 FINAL Addendum-1로 등록 → ADR-013 작성 시작
>
> **핵심 변경점 3가지 (v1.0 → v1.1):**
>
> 1. **AI 모델 적용은 후순위.** 기존 기획(Graph RAG + Formula Engine + FSRS 등) 먼저, AI는 "감안하여 개발"
> 2. **LoRA는 향후, 소형 AI부터.** 단, LoRA용 자동 수집 시스템화는 지금부터 설계 격리
> 3. **법무 생략** (변호사 자문 완료) — Phase -1 Week B 일정 단축

---

## 목차

1. 결재 결과 반영 요약
2. 재배치된 실행 순서
3. 결재 3번 해설 — AIRouter 인터페이스 설계 원칙
4. LoRA 자동 수집 시스템 (결재 2번 심화)
5. 기존 기획대로 개발하되 AI 감안 — 구체 방법
6. AI Incident Response 안전장치
7. Fine-tune Equivalence Lock 전문
8. 모델 후보 재평가 — 한국어 강한 모델 우선
9. Base 모델 항상성·안정성 대책
10. 업데이트된 Phase -1 실행 순서
11. 향후 실행 체크리스트
12. 본 v1.1과 기존 문서 정합성 확인

---

## 1. 결재 결과 반영 요약

| #   | 결재 항목                              | 결재 결과                        | v1.1 반영 방법                          |
| --- | -------------------------------------- | -------------------------------- | --------------------------------------- |
| 1   | 본 META 분석을 v1.1 정식 입력으로 인정 | 승인                             | 기획서 v1.0 + 검토서 + META → v1.1 통합 |
| 2   | 사용자 피드백 등급 A/B 분리            | 승인 + "자동 수집 시스템화 필요" | §4에 자동 수집 파이프라인 상세 설계     |
| 3   | AIRouter source enum 분리              | 승인 + "잘 모르겠음"             | §3에서 평이한 언어로 재설명             |
| 4   | Phase -1 실행 순서 [B-6]를 Week C로    | 승인 + "법무 생략(검토완료)"     | §10에서 법무 단계 제거, [B-6] 당김 가능 |
| 5   | ADR 분리 작성                          | 승인                             | §11 실행 체크리스트                     |

**추가 지시 3건 반영:**

- **지시 A**: "LoRA는 향후, 소형 AI부터" — 전체 로드맵 재배치 (§2)
- **지시 B**: "기존 기획대로 개발하되, AI 모델 적용을 예상 감안하여 개발" — §5에서 "감안 개발"의 실제 의미를 코드 레벨로 정의
- **지시 C**: "한국어 강한 모델 우선" — §8 재평가
- **지시 D**: "base 모델 백업 등 항상성·안정성" — §9 항상성 대책 전문

---

## 2. 재배치된 실행 순서 (진산님 지시 반영)

### 2.1 원래 v1.0 순서

```
소형 AI + LoRA를 병행 논의 → 둘 다 Year 2에서 활성화 가정
```

### 2.2 수정된 v1.1 순서

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1: 기존 기획 우선 (Year 1 전체)                       │
│    Graph RAG, Formula Engine, FSRS, DB 스키마, Phase 0~3     │
│    → AI 없이도 완전히 동작하는 쪽집게 서비스를 먼저 완성     │
│                                                               │
│     ↓ "AI 모델 적용을 감안하여 개발" = 격리 설계만 (§5)       │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│  LAYER 2: 소형 AI 적용 (Year 1 Phase 2~3에 시범, Year 2 확대)│
│    Workers AI Llama 3.2 3B (또는 한국어 강한 대안)           │
│    단일 기능(Rephrase)으로 시범 → 검증 후 확대               │
│                                                               │
│     ↓ 운영하며 등급 A/B 데이터 수집                          │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│  LAYER 3: LoRA 어댑터 (Year 2 Phase 4 이후, 데이터 충분 시) │
│    운영 중 축적된 등급 B 데이터로 첫 LoRA 훈련               │
│    "LoRA는 향후 구축" 원칙 — 조급히 시작 금지                │
└─────────────────────────────────────────────────────────────┘
```

**핵심 원칙 (진산님 직접 지시):**

> **"먼저 기존 기획대로 개발하되, AI 모델 적용을 예상 감안하여 개발.
> LoRA는 향후 구축하고 소형 AI 모델부터."**

이 문장을 실제 개발 지침으로 번역하면:

```
Year 1 우선순위:
  P0: Graph RAG / Formula Engine / FSRS / 스키마 / 기출 파서 ← 지금 하는 것
  P1: AI 없이도 완전히 작동하는 학습 서비스 런칭 ← Year 1 목표
  P2: Phase 2~3에 소형 AI "Rephrase 단일 기능" 시범 ← 덤
  P3: LoRA 및 복잡 AI 기능 ← Year 2 이후

"감안하여 개발"의 의미:
  코드는 기존 기획대로 작성하되,
  AI가 "나중에 끼어들" 경계선을 지금 미리 격리
  (구체 방법은 §5)
```

---

## 3. 결재 3번 해설 — AIRouter 인터페이스 설계 원칙

진산님: "승인은 하되 잘 모르겠음"

**비유로 설명합니다.**

### 3.1 식당 주문으로 이해하기

카페에서 **아메리카노**를 주문한다고 해보겠습니다. 바리스타가 커피를 주는데:

- **나쁜 설계**: "원두는 에티오피아산이고, 추출은 에스프레소 머신 A를 썼고, 우유는 생략했습니다" — 손님이 **알 필요 없는 내부 사정**을 알려줌
- **좋은 설계**: "아메리카노 나왔습니다" — 손님은 맛과 가격만 보면 됨

**이유**: 내일 원두 산지가 바뀌거나 에스프레소 머신을 B로 교체해도, 손님은 아무 변화 없이 아메리카노를 마실 수 있어야 합니다.

### 3.2 우리 상황에 적용

```
사용자가 "해설 다시 설명해줘"를 클릭 → AI가 답변

나쁜 설계 (v1.0에서 제안된 것):
  UI 컴포넌트가 "이 답변이 browser 모델에서 왔어요"를 받아서 화면에 표시
  → 문제: 나중에 browser 모델을 끄고 서버 모델로 바꾸면 UI도 고쳐야 함

좋은 설계 (v1.1 확정):
  UI 컴포넌트는 "답변 내용"만 받음
  "어떤 모델이 답했는지"는 내부 로그/디버그용으로만 분리해서 보관
  → 내일 모델을 Llama 3.2 3B → EXAONE → Phi-4로 바꿔도 UI는 한 줄도 안 고쳐짐
```

### 3.3 코드로 보면

```typescript
// 클라이언트(화면)에게 보여주는 것 — 내용만
export interface AIResponse {
  readonly content: string; // 답변 텍스트
  readonly sources?: NodeId[]; // "이 정보는 어디서 왔나" (Graph RAG 근거)
  readonly aiGenerated: true; // UI에 "AI 자동 생성" 배지 띄우기용
  readonly meta?: AIResponseMeta; // ← 디버깅용. UI는 안 씀
}

// 내부 로그/디버깅 전용 — UI가 절대 쓰지 않음
export interface AIResponseMeta {
  readonly source: 'browser' | 'workers-ai' | 'claude';
  readonly modelUsed: string; // 'llama-3.2-3b' 같은
  readonly latencyMs: number; // 응답 시간
}
```

### 3.4 왜 이게 중요한가

우리는 Year 1에는 Claude Haiku, Phase 2에는 Llama 3.2 3B, Year 2에는 EXAONE, Year 3에는 자체 LoRA 모델로 **지속적으로 모델을 바꿀 예정**입니다.

만약 UI가 "browser" / "workers-ai" / "claude" 같은 구체적인 모델 이름에 매달려 있으면, **모델을 바꿀 때마다 UI도 고쳐야 하는 중복 작업**이 생깁니다.

인터페이스를 이렇게 분리해두면, 모델 교체는 **AIRouter 한 곳만 고치면 되는 로컬 변경**이 됩니다. 이게 "좋은 아키텍처"의 가장 중요한 특성입니다.

**→ 결재 3번의 실질적 가치**: 3년 뒤 Year 3에 "모델을 5번째로 교체"할 때 후회 안 하는 설계.

---

## 4. LoRA 자동 수집 시스템 (결재 2번 심화)

진산님 추가 지시:

> "승인 - 향후를 위해서 lora용 자동수집 시스템화 필요"

v1.0의 "PIPA 동의 후 DB 저장" 수준을 넘어, **실제 LoRA 훈련에 바로 투입 가능한 체계**를 Year 1부터 설계 격리합니다. 단, **구현은 Phase 2**부터 (AI 기능이 붙을 때 같이).

### 4.1 데이터 등급 시스템 (META 권고 확정)

```
┌─────────────────────────────────────────────────────────────┐
│  [등급 A] 원시 데이터 (Raw Data)                             │
│    출처:                                                      │
│      - 사용자 만족/불만족 클릭                               │
│      - 신고 로그                                              │
│      - AI 튜터 대화 로그 (PIPA 동의자만)                     │
│      - 사용자 오답 후 "이해됨" 클릭                          │
│    용도:                                                      │
│      - 진산님 대시보드 분석                                   │
│      - 룰 기반 필터링 보강                                    │
│      - 신고 많은 패턴 자동 차단                               │
│    LoRA 훈련 직접 사용: ❌ 절대 금지                         │
└─────────────────────────────────────────────────────────────┘
                        ↓ 인간 큐레이션
┌─────────────────────────────────────────────────────────────┐
│  [등급 B] LoRA 훈련 후보 데이터 (Curated Data)               │
│    조건 (모두 충족):                                          │
│      ✓ 진산님이 "훈련에 쓸만하다"고 명시적으로 승인           │
│      ✓ Graph RAG 근거 노드 ID 매핑 완료                       │
│      ✓ 사실 검증 통과 (AI-Safe Rule 1)                       │
│      ✓ 한국어 자연스러움 합격 (평가자 1~5점 중 4점 이상)      │
│      ✓ PII 마스킹 완료                                        │
│    추가 소스:                                                 │
│      - 진산님 직접 작성 암기법 200개                          │
│      - Graph RAG 자동 생성 + 10% 인간 샘플 통과               │
│    LoRA 훈련 직접 사용: ✅ Year 2 Phase 4부터                │
└─────────────────────────────────────────────────────────────┘
                        ↓ Unsloth/Axolotl 파이프라인
┌─────────────────────────────────────────────────────────────┐
│  [등급 C] JSONL 학습 세트 (Training Set)                     │
│    - ChatML 형식 변환                                         │
│    - 시스템 프롬프트 + 사용자 질문 + 답변 구조                │
│    - 버전 관리 (해시 + 타임스탬프)                            │
│    - 학습/검증/테스트 분할 (80/10/10)                         │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 DB 스키마 (Phase 2 구현)

```sql
-- 등급 A: 원시 피드백
CREATE TABLE user_ai_feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  exam_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  prompt_hash TEXT NOT NULL,        -- 동일 프롬프트 중복 방지
  ai_response_content TEXT NOT NULL,
  ai_source TEXT,                    -- 'workers-ai' / 'claude' (로그용)
  feedback_type TEXT NOT NULL,       -- 'helpful' / 'unhelpful' / 'report'
  feedback_detail TEXT,              -- 신고 사유 등
  graph_rag_source_nodes TEXT,       -- JSON array of node IDs
  pipa_consent_at TEXT,              -- 동의 시점 (없으면 삭제 대상)
  created_at TEXT DEFAULT (datetime('now'))
);

-- 등급 B: 큐레이션된 훈련 후보 (Year 2 Phase 4에 활성화)
CREATE TABLE lora_training_candidates (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL,
  source_feedback_id TEXT,           -- user_ai_feedback.id 참조 (nullable)
  source_type TEXT NOT NULL,         -- 'user_feedback' / 'human_written' / 'graph_rag_gen'
  prompt TEXT NOT NULL,
  expected_response TEXT NOT NULL,
  graph_rag_source_nodes TEXT NOT NULL,
  human_reviewer TEXT NOT NULL,      -- 진산님 또는 외주 검수자
  human_quality_score INTEGER,       -- 1~5
  korean_naturalness_score INTEGER,  -- 1~5 (한국어 평가 필수)
  fact_check_passed INTEGER DEFAULT 0,
  pii_masked INTEGER DEFAULT 0,
  approved_for_training INTEGER DEFAULT 0,
  dataset_version TEXT,              -- 'v1.0.0' 등
  created_at TEXT DEFAULT (datetime('now')),
  approved_at TEXT
);

-- 등급 C: 최종 학습 세트 (v2 Phase 4 시점)
CREATE TABLE lora_datasets (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL,
  dataset_version TEXT NOT NULL UNIQUE,
  chatml_jsonl_r2_key TEXT NOT NULL,  -- R2 저장소 경로
  record_count INTEGER NOT NULL,
  train_count INTEGER NOT NULL,
  val_count INTEGER NOT NULL,
  test_count INTEGER NOT NULL,
  content_hash TEXT NOT NULL,         -- 재현성 보장
  created_by TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### 4.3 자동 승격 파이프라인 (Year 2 Phase 4)

진산님이 수동으로 모든 데이터를 검수하기엔 시간이 부족합니다. **룰 기반 자동 1차 필터 + 인간 최종 승인**의 2단계 파이프라인:

```
[1단계: 자동 룰 필터 - 탈락시키기]
  ↓ user_ai_feedback 매일 0시 배치

  다음 중 하나라도 해당 → 등급 B 후보 탈락:
    - PIPA 동의 없음
    - feedback_type = 'report' (신고)
    - graph_rag_source_nodes 비어있음 (근거 없음)
    - content 50자 미만 또는 2,000자 초과
    - 이미 유사 프롬프트가 등급 B에 있음 (prompt_hash)
    - 수치/법조문이 Graph RAG와 불일치 (AI-Safe Rule 1)

  통과한 것만 lora_training_candidates에 INSERT (approved=0 상태)

[2단계: 인간 최종 승인 - 골라내기]
  ↓ 관리자 대시보드에서 주기적 검토 (주 1회 권장)

  진산님 또는 외주 검수자가:
    - 한국어 자연스러움 평가 (1~5점)
    - 사실 정확성 재검증
    - PII 마스킹 확인
    - approved_for_training = 1 설정

[3단계: 데이터셋 버전 빌드]
  ↓ Year 2 Phase 4 시점, LoRA 훈련 직전

  approved=1인 candidate를 dataset_version으로 그룹화
  ChatML JSONL 생성 → R2 업로드
  lora_datasets 레코드 생성
  content_hash로 재현성 보장
```

### 4.4 Phase 2에서 구현할 것 (Year 1)

- `user_ai_feedback` 테이블 스키마 + 마이그레이션
- 클릭 이벤트 수집 API (`POST /api/feedback`)
- 신고 버튼 UI + 사유 입력 modal
- PIPA 동의 UI + DB 플래그 관리
- **진산님 대시보드** (신고 알림, 자주 불만족 받은 프롬프트 리스트)

### 4.5 Year 2 Phase 4에서 구현할 것

- `lora_training_candidates` 스키마
- 자동 필터 배치 (nightly cron)
- 관리자 대시보드 큐레이션 UI
- `lora_datasets` 빌드 스크립트
- R2 업로드 + content_hash 검증

**핵심**: Phase 2 구현물만으로도 **등급 A 데이터는 축적**됩니다. Year 2 Phase 4에 등급 B/C가 활성화될 때 Year 1 동안 쌓인 등급 A가 **재료**가 됩니다. "자동 수집 시스템화"의 실체는 이 연결 구조입니다.

---

## 5. 기존 기획대로 개발하되 AI 감안 — 구체 방법

진산님 지시:

> "먼저 기존 기획대로 개발하되, AI 모델 적용을 예상 감안하여 개발"

"감안 개발"의 의미는 애매할 수 있습니다. 구체적인 코드 레벨 원칙 7가지로 정의합니다.

### 5.1 원칙 1 — 해설 생성 함수를 "인터페이스"로 먼저 정의

**지금 (Year 1 Phase 1):**

```typescript
// apps/api/src/services/explanation.service.ts
export class ExplanationService {
  async getExplanation(examId: string, nodeId: string): Promise<string> {
    // 현재 구현: Graph RAG에서 description 필드를 그대로 반환
    const node = await this.nodeRepo.findById(examId, nodeId);
    return node.description;
  }
}
```

**나중 (Phase 2에 AI 붙을 때):**

```typescript
// 인터페이스는 안 바뀜, 내부 구현만 교체
export class ExplanationService {
  async getExplanation(examId: string, nodeId: string): Promise<string> {
    const node = await this.nodeRepo.findById(examId, nodeId);

    // AI 붙기 전: return node.description;
    // AI 붙은 후: return await this.aiRouter.rephrase(node.description);
    // 언제든 롤백 가능
    return await this.aiRouter.rephrase(examId, node.description);
  }
}
```

**핵심**: `getExplanation`의 시그니처는 Year 1부터 Year 3까지 **절대 안 바뀐다**.

### 5.2 원칙 2 — 모든 AI 진입점은 단일 경로

```
금지:
  apps/web/ 컴포넌트에서 직접 fetch('https://api.anthropic.com/...')
  apps/web/ 컴포넌트에서 직접 Workers AI 호출
  apps/web/ 컴포넌트에서 직접 transformers.js 실행

허용:
  apps/web/ → /api/exams/:exam/ai/* 엔드포인트만 호출
  엔드포인트 내부에서 AIRouter만 사용
  AIRouter만 실제 모델(L1/L2/L3) 접근
```

**Year 1**: `/api/exams/:exam/ai/*` 엔드포인트 **아직 생성 안 함**. 대신 `apps/api/` 라우트 설계 시 "ai/" 서브패스를 미리 예약해둠 (다른 이름으로 선점되지 않도록).

### 5.3 원칙 3 — UI 컴포넌트에 "AI 생성" 표시 자리 미리 확보

해설 카드, 플래시카드 뒷면 등 **AI가 나중에 재가공할 가능성이 있는 UI**에는 지금부터 "AI 자동 생성" 배지가 들어갈 자리를 디자인에 포함:

```tsx
// 지금은 안 보이지만, 구조상 자리를 잡아둠
<ExplanationCard>
  <CardBody>{explanation}</CardBody>
  {isAiGenerated && <AiBadge />} {/* 현재는 항상 false */}
  {isAiGenerated && <ReportButton />} {/* 현재는 항상 false */}
</ExplanationCard>
```

Phase 2에 AI가 붙으면 `isAiGenerated`만 true로 바뀌면 됨. 디자인 재작업 없음.

### 5.4 원칙 4 — Graph RAG 검색 결과를 "AI 없이도 쓸 수 있는 형태"로 구조화

Year 1의 Graph RAG 검색 결과는 AI 컨텍스트용이 아니라 **사용자에게 직접 보여줄 수 있는 형태**여야 합니다.

```typescript
// Year 1부터 이 구조 고정
export interface GraphRAGResult {
  matchedNodes: Array<{
    nodeId: string;
    name: string;
    description: string; // 사용자에게 직접 노출 가능한 완성된 텍스트
    truthWeight: number;
    pageRef?: string;
  }>;
  similarityScore: number;
  retrievalMethod: 'vector' | 'hybrid';
}
```

Year 1 UI: `matchedNodes[0].description`을 그대로 화면에 표시.  
Year 2 AI: 같은 결과를 AI의 context로 전달해 Rephrase.

**같은 데이터 구조, 두 가지 용도**.

### 5.5 원칙 5 — 정답/산식/법조문은 절대 AI 경로에 두지 않음 (Hard Rule 2, 5 준수)

```
지금부터 코드 레벨에서 분리:

apps/api/src/services/formula.service.ts
  → math.js AST만 사용. AI 관련 코드 한 줄도 들어가면 안 됨

apps/api/src/services/constants.service.ts
  → D1 직접 조회만. AI 경로 없음

apps/api/src/services/explanation.service.ts
  → 여기만 AI가 나중에 붙을 수 있음
```

**리뷰 포인트**: 코드 리뷰 시 `formula.service.ts`나 `constants.service.ts`에 AI 관련 import가 보이면 **즉시 리젝**.

### 5.6 원칙 6 — 사용자 피드백 수집 훅(hook)을 미리 UI에 삽입

Phase 2에 AI가 붙어야 피드백이 의미 있지만, **UI 훅은 지금부터 자리를 잡아둠**:

```tsx
// 플래시카드 뒷면 UI
<FlashcardBack>
  <Answer>{answer}</Answer>
  <FeedbackButtons>
    <HelpfulButton onClick={() => recordFeedback('helpful')} />
    <UnhelpfulButton onClick={() => recordFeedback('unhelpful')} />
  </FeedbackButtons>
</FlashcardBack>

// recordFeedback 함수는 Year 1에는 no-op 또는 console.log
// Phase 2에 user_ai_feedback 테이블 INSERT로 교체
```

**실질 효과**: Year 1 베타 사용자가 UI에 익숙해진 상태에서 Phase 2 데이터 수집 활성화. 사용자 입장에서는 "기능이 갑자기 생겼다"가 아니라 "원래 있던 것이 동작하기 시작"으로 자연스러움.

### 5.7 원칙 7 — 모든 AI 관련 코드는 "Feature Flag" 뒤에

```typescript
// apps/api/src/config/features.ts
export const FEATURES = {
  AI_REPHRASE_ENABLED: false, // Year 1 전체 false
  AI_FEEDBACK_COLLECTION: false, // Phase 2부터 true
  AI_HINT_GENERATION: false, // Year 2 Phase 5부터
  LORA_DOMAIN_ADAPTER: false, // Year 2 Phase 4부터
} as const;
```

**실질 효과**:

- 프로덕션에서는 **기본값 false 유지** (문제 생기면 즉시 false로 롤백)
- 개발 환경에서만 true로 켜서 테스트
- 환경변수로 제어 가능 → 재배포 없이 비활성화

---

## 6. AI Incident Response 안전장치 (진산님 승인)

진산님:

> "AI Incident Response Runbook 부재는 중요한 사항이라 안전장치를 둘 것"

v1.0에는 제안만 있었음. v1.1에서 **Phase 2 AI 활성화 직전까지 반드시 완성**해야 할 Runbook 문서로 승격.

### 6.1 4단계 대응 체계

```
┌──────────────────────────────────────────────────────────────┐
│  [수준 1: Notice] — 관찰                                     │
│    조건: Workers AI 응답 시간이 평소 P95의 2배 초과          │
│    자동 조치: Slack/이메일 알림 (24시간 관찰 모드)           │
│    인간 조치: 없음                                            │
├──────────────────────────────────────────────────────────────┤
│  [수준 2: Warning] — 자동 폴백                               │
│    조건 (하나라도 해당):                                      │
│      - AI-Safe Rule 1 사실 검증 실패율 > 5% (5분 이동평균)   │
│      - Workers AI 에러율 > 10%                               │
│      - AI 응답 시간 P95 > 5초                                │
│    자동 조치:                                                 │
│      - AIRouter가 자동으로 L2 → L3 (Claude Haiku) 폴백       │
│      - 24시간 폴백 유지 후 자동 복귀 시도                    │
│    인간 조치: 진산님에게 슬랙 알림, 24시간 내 상태 확인      │
├──────────────────────────────────────────────────────────────┤
│  [수준 3: Incident] — 전체 AI 차단                           │
│    조건 (하나라도 해당):                                      │
│      - 사용자 신고 1건이라도 "산식 오류"로 분류              │
│      - 사용자 신고 1건이라도 "법조문 오류"로 분류            │
│      - 연속된 Warning이 1시간 내 3회 발생                    │
│    자동 조치:                                                 │
│      - FEATURES.AI_REPHRASE_ENABLED = false 자동 전환        │
│      - 모든 AI 응답 차단 → 원본 해설(Graph RAG description)  │
│        로 fallback                                            │
│      - 진산님에게 즉시 알림 (24시간 내 수동 검증 필수)       │
│    인간 조치:                                                 │
│      - 24시간 내 원인 규명 + 재검증                           │
│      - 검증 통과 후에만 AI 기능 재활성화                     │
│      - Postmortem 문서 작성 (docs/incidents/)                │
├──────────────────────────────────────────────────────────────┤
│  [수준 4: Major Incident] — Hard Stop                        │
│    조건 (하나라도 해당):                                      │
│      - 기존 Hard Stop 4개 위반 (기출 정답 불일치 등)         │
│      - AI가 생성한 잘못된 산식이 24시간 이상 사용자에 노출   │
│      - 데이터 유출 의심                                       │
│    자동 조치:                                                 │
│      - 서비스 읽기 전용 모드 (사용자 학습은 가능, AI 전면 차단)│
│      - AI 관련 모든 Feature Flag = false                     │
│    인간 조치:                                                 │
│      - 1시간 내 진산님 대응 시작                              │
│      - ADR로 재발 방지 결정 기록                              │
│      - 사용자 고지 (영향받은 사용자 개별 안내 검토)          │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 구현 체크리스트

```
[Phase 2 구현 시 필수 항목]
□ Workers AI 호출 래퍼에 메트릭 수집 (응답 시간, 에러율)
□ AI-Safe Rule 1 검증 실패율 집계 함수
□ 5분/1시간 이동평균 계산 (Cloudflare Analytics Engine)
□ Slack webhook 알림 (수준 1/2/3 각각 다른 템플릿)
□ FEATURES.AI_* 실시간 토글 (환경변수 또는 KV)
□ 신고 버튼 클릭 → "산식/법조문 오류" 자동 분류 룰
□ Postmortem 템플릿 (docs/incidents/TEMPLATE.md)

[Phase 2 런칭 전 필수 문서]
□ docs/runbooks/AI_INCIDENT_RESPONSE.md (본 §6.1 전문)
□ docs/runbooks/AI_ROLLBACK_PROCEDURE.md (Feature Flag 복구 절차)
□ docs/runbooks/POSTMORTEM_TEMPLATE.md
```

### 6.3 Hard Stop 5번째 규칙 추가

기존 4개에 AI 관련 1개 추가:

```
5. AI가 생성한 잘못된 산식/법조문이 사용자에게 24시간 이상 노출된 경우
   → 즉시 수준 4 Major Incident
```

---

## 7. Fine-tune Equivalence Lock 전문 (진산님 승인)

진산님:

> "Year 1 LoRA 금지의 우회로 3개 차단 필요 .. 당연한 사항임"

META §3.5에서 제안한 규칙을 정식 Hard Rule로 편입:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  HARD RULE (META-1) — Fine-tune Equivalence Lock
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

다음은 모두 LoRA와 동일하게 취급되어 Year 1 전체에서 금지된다:

  ❌ LoRA / QLoRA / DoRA 어댑터 학습
  ❌ Prompt Tuning (Soft Prompt) 학습
  ❌ 검증 안 된 Few-shot 예시 50개 이상의 정적 프롬프트 주입
  ❌ "튜닝 효과를 노린" 추가 RAG 컨텍스트 자동 합성
     (예: 사용자 질문에 따라 추가 예시 10개를 동적 추가해서
      사실상 ICL 효과를 내려는 시도)

다음은 허용된다:

  ✅ Graph RAG 정상 검색 결과 (top-K, K ≤ 20) 컨텍스트 주입
  ✅ 진산님이 명시적으로 작성한 system prompt (< 1000 토큰)
  ✅ 일회성 demo/PoC (코드 미반영, 측정 결과만 리포트)
  ✅ Few-shot 예시 3개 이하의 static prompt

해제 조건:
  - Year 2 Phase 4 도달
  - ADR-013 승인 (LoRA 정책)
  - 본 Hard Rule 해제에 대한 별도 ADR 작성 및 승인
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

이 룰은 `.claude/rules/production-quality.md`에 즉시 추가 (진산님 결재 완료).

---

## 8. 모델 후보 재평가 — 한국어 강한 모델 우선 (진산님 지시)

진산님:

> "활용할 모델은 다각적으로 검토가 필요.. 한국어에 강한 모델 우선 검토"

v1.0의 "Llama 3.2 3B 기본 채택" 가정을 재검토.

### 8.1 한국어 성능 기준 모델 후보 재평가

| 모델                   | 파라미터 | 한국어 수준 | 상용 라이선스             | Workers AI 제공 | 한국어 강함? |
| ---------------------- | -------- | ----------- | ------------------------- | --------------- | ------------ |
| EXAONE 3.5 2.4B        | 2.4B     | ★★★★★       | ⚠️ 연구용 (협상 필요)     | ❌              | **최강**     |
| Qwen 2.5 3B            | 3B       | ★★★★        | ✅ Apache 2.0             | ✅              | **강함**     |
| HyperCLOVA X Seed 1.5B | 1.5B     | ★★★★★       | ✅ 오픈웨이트 (조건 확인) | ❌              | **최강**     |
| Llama 3.2 3B           | 3B       | ★★★         | ✅ Llama Community        | ✅              | 중간         |
| Gemma 3 4B (다국어)    | 4B       | ★★★         | ✅ Gemma Terms            | ✅              | 중간         |
| Phi-4-mini 3.8B        | 3.8B     | ★★          | ✅ MIT                    | ⚠️ 미정         | 약함         |

### 8.2 Phase -1 [B-6A] 한국어 품질 비교 대상 확대

기존 v1.0: "Llama 3.2 3B만 측정"  
v1.1 수정: **다각적 비교 (4개 후보)**

```
[B-6A] 한국어 품질 비교 테스트 (2일로 확대)

샘플: 손해평가사 해설 20건 (Step 1-3 산출물)

비교 대상:
  - Claude Haiku (baseline)
  - Llama 3.2 3B (Workers AI)
  - Qwen 2.5 3B (Workers AI) ← 신규 추가, 한국어 강함
  - EXAONE 3.5 2.4B (Ollama 로컬, 연구용) ← 신규 추가

평가 4축 (META §2.4):
  1. 사실 정확성 — 환각 ≤ 5%
  2. 문맥 자연스러움 — 평균 ≥ 3.5/5 (블라인드)
  3. 번역투 카운트 — 응답당 ≤ 1개
  4. 응답 시간 — P95 ≤ 2초

판정:
  Top 1 모델이 4축 모두 합격 → L2 Phase 2 시범 도입
  4축 중 한 축이라도 실패 → Rephrase 기능을 Year 2 이월

  한국어 강한 모델 우선순위:
    EXAONE > Qwen 2.5 3B > Llama 3.2 3B

  단, Workers AI 미제공 모델 (EXAONE)은 Year 1에 자체 호스팅 불필요.
  Year 1 실전 투입은 Workers AI 제공 모델 중 선택.
  EXAONE은 "도달해야 할 품질 지표"로만 사용.
```

### 8.3 최종 모델 선정 프로세스

```
Phase -1 [B-6A] 결과:

시나리오 A (이상적):
  Qwen 2.5 3B가 Llama 3.2 3B보다 한국어 우수
  → Phase 2 시범 모델을 Qwen 2.5 3B로 변경
  → ADR-011에 선정 근거 명시

시나리오 B (무난):
  Llama 3.2 3B가 "합격선" 통과, Qwen도 동급
  → Workers AI에서 검증된 Llama 3.2 3B 유지
  → Qwen은 대체 후보로 목록 보관

시나리오 C (실패):
  Llama 3.2 3B와 Qwen 2.5 3B 모두 4축 중 하나 이상 실패
  → Rephrase 기능을 Year 2 이월
  → Year 1에는 Claude Haiku만 사용 (L3)
  → Year 2 Phase 5에 재평가
```

---

## 9. Base 모델 항상성·안정성 대책 (진산님 지시)

진산님:

> "base 모델 백업등 항상성, 안정성 대책 마련 필요"

META §3.1에서 제기한 "Workers AI deprecation 리스크"에 대한 완성된 대응 전략.

### 9.1 Base 모델 관련 4중 안전장치

```
┌──────────────────────────────────────────────────────────────┐
│  안전장치 1: 모델 ID 환경변수 분리                            │
├──────────────────────────────────────────────────────────────┤
│  코드에 모델 이름을 절대 하드코딩하지 않음.                   │
│  wrangler.toml / .env / Cloudflare Secret Store로 관리.       │
│                                                                │
│  // ❌ 금지                                                    │
│  const MODEL = '@cf/meta/llama-3.2-3b-instruct';             │
│                                                                │
│  // ✅ 허용                                                    │
│  const MODEL = env.AI_MODEL_ID;                               │
│                                                                │
│  → 모델 교체 시 코드 수정 없이 환경변수만 변경                │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  안전장치 2: 모델 해시 고정 + GGUF 보관                      │
├──────────────────────────────────────────────────────────────┤
│  Year 2 Phase 4에서 LoRA 훈련 시 사용한 base 모델의          │
│  정확한 체크포인트를 R2에 GGUF 형식으로 보관.                 │
│                                                                │
│  R2 경로 예시:                                                │
│    r2://thepick-models/base/                                  │
│      llama-3.2-3b-instruct-Q4_K_M-sha256-abc123.gguf          │
│                                                                │
│  → Workers AI가 deprecate해도 자체 호스팅 가능                │
│  → LoRA 어댑터와의 호환성 보장                                │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  안전장치 3: 6개월 사전 경보 체계                             │
├──────────────────────────────────────────────────────────────┤
│  Cloudflare 공지 모니터링:                                    │
│    - Workers AI 릴리스 노트 RSS 구독                          │
│    - Cloudflare 공식 Slack/Discord 모니터링                   │
│    - 분기별 "사용 중인 모델 상태 확인" 체크리스트             │
│                                                                │
│  Deprecation 경보 감지 시:                                    │
│    1. 즉시 진산님에게 통보                                    │
│    2. 2주 내 PITR 작성 (대체 모델 후보 비교)                  │
│    3. 1개월 내 대체 모델로 Phase 2 스테이징 전환              │
│    4. 2개월 내 프로덕션 전환                                  │
│    5. 3개월 여유 (시간 버퍼)                                  │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  안전장치 4: 폴백 라우트 3단계                                │
├──────────────────────────────────────────────────────────────┤
│  Primary:   Cloudflare Workers AI (현재 모델)                 │
│     ↓ 장애 시                                                  │
│  Secondary: Replicate / Fireworks / Together API              │
│             (동일 또는 유사 모델을 외부 API로 호출)            │
│     ↓ 장애 시                                                  │
│  Tertiary:  Claude Haiku (L3로 전면 폴백)                     │
│     ↓ 장애 시                                                  │
│  Emergency: 원본 Graph RAG description 직접 노출              │
│                                                                │
│  → AI 완전 장애 시에도 서비스 지속                            │
│  → 사용자는 "재설명 기능만 잠시 비활성화"로 체감              │
└──────────────────────────────────────────────────────────────┘
```

### 9.2 PITR 대상 목록 업데이트

META §2.1에서 ADR-011은 [B-6] 결과 후 작성. 그 ADR-011에 다음 PITR 시점을 명시:

```
PITR-AI-01: 한국어 SLM 모델 선정 (Phase -1 [B-6] 결과 반영)
PITR-AI-02: Workers AI deprecation 대응 (Cloudflare 공지 감지 시)
PITR-AI-03: LoRA base 모델 교체 (Year 3+, 하드웨어 전환 시)
PITR-AI-04: 외부 API 폴백 제공자 선정 (Year 2 Phase 5 직전)
```

### 9.3 LoRA 어댑터 호환성 보장 (Year 2+)

```
LoRA 훈련 시 메타데이터 필수 기록:
  - base_model_id: '@cf/meta/llama-3.2-3b-instruct'
  - base_model_sha256: 'abc123...'
  - base_model_gguf_r2_key: 'r2://.../xxx.gguf'
  - tokenizer_version: 'llama-3.2-tokenizer-v1'
  - training_framework: 'unsloth-2026.4'
  - lora_rank: 16, alpha: 16, use_dora: true

이 메타데이터를 lora_datasets.training_config (JSONB)에 저장.

Year 3에 base 모델을 교체할 경우:
  → 기존 LoRA는 호환성 실패 가능성
  → GGUF 보관본으로 자체 호스팅 계속 or
  → LoRA 재훈련 (등급 B 데이터 재사용, 비용 낮음)
```

---

## 10. 업데이트된 Phase -1 실행 순서 (법무 생략 반영)

진산님:

> "승인은 하되.. 법무는 생략(검토완료)"

META §3.3의 3주 계획에서 법무 단계 제거. 총 기간이 단축됨.

### 10.1 업데이트된 Phase -1 (2주로 축소)

```
Week A: 사업·시장 검증
─────────────────────────────
Day 1-2: B-1 시장 조사
  - Q-Net 연도별 응시자 통계
  - 경쟁 서비스 5개 조사
  - 커뮤니티 글 100개 분석
  산출: docs/research/MARKET_DATA.md

Day 3-5: B-2 수험생 인터뷰 5명
  - 네이버 카페 모집 (사례비 5만 원)
  - 1시간 심층 인터뷰
  - 페르소나 3종 도출
  산출: docs/research/USER_INTERVIEWS.md

Week B: 비즈니스 모델 + 기술 검증
─────────────────────────────
Day 1: [생략] L-1 변호사 자문  → 검토 완료
Day 1: [생략] L-2 출판사 접촉  → 검토 완료

Day 1-2: B-4 비즈니스 모델 확정
  - Single / Combo / All-Access 가격 확정
  - 무료/유료 경계 최종
  - 손익 모델 스프레드시트
  산출: docs/BUSINESS_MODEL.md

Day 3: B-5 1차 Go/Pivot/No-Go 판정
  - B-1, B-2, B-4 결과 종합
  - 판정
  산출: docs/GO_NOGO_DECISION.md

[Go 판정 시에만 실행]
Day 4-5: [B-6] 기술 PoC
  Day 4: B-6A 한국어 SLM 4개 모델 비교
    - Claude Haiku (baseline)
    - Llama 3.2 3B
    - Qwen 2.5 3B
    - EXAONE 3.5 2.4B (로컬)
    - 4축 평가 (§8.2)
  Day 5: B-6B 브라우저 SLM 실행 가능성 확인 (선택)
  산출: docs/research/B6_SLM_EVALUATION.md
```

### 10.2 [B-6] 결과 기반 다음 단계 자동 분기

```
시나리오 A: 한국어 강한 SLM (Qwen 등) 4축 합격
  → Phase 2 Rephrase를 해당 모델로 진행
  → ADR-011 작성 (Phase 2 착수 전)

시나리오 B: Workers AI 제공 모델 모두 실패
  → Phase 2 Rephrase를 Year 2로 이월
  → Year 1에는 Claude Haiku (L3)만 사용
  → ADR-011에 이월 사유 명시

시나리오 C: EXAONE만 합격, Workers AI 모델 실패
  → Rephrase를 Year 2 Phase 5로 이월 (EXAONE 상용 라이선스 협상 시점)
  → Year 1 L2 단계 자체를 포기
  → 3-Tier가 2-Tier (Claude Haiku + 브라우저)로 축소
```

---

## 11. 향후 실행 체크리스트 (결재 5번)

### 11.1 본 v1.1 발행 후 즉시 실행 (1주 내)

```
[문서 작업]
□ 본 v1.1을 v3.0 FINAL Addendum-1로 등록
□ ADR-013 (LoRA 어댑터 정책) 초안 작성
  - Year 1 금지 원칙
  - Year 2 Phase 4 시작 조건
  - 등급 A/B/C 데이터 체계
  - 모델 해시 고정 + GGUF 보관
  - 호환성 메타데이터 규칙
□ .claude/rules/production-quality.md 업데이트:
  - Hard Rule (META-1) Fine-tune Equivalence Lock 추가
  - AI-Safe Rule 1~6 + 1.5 초안 (비활성 상태)

[Phase -1 준비]
□ 수험생 인터뷰 모집 공고 작성
□ 인터뷰 질문지 작성 (10개)
□ 한국어 SLM 모델 4개 비교용 해설 샘플 20건 준비
□ 블라인드 평가자 1명 섭외 (손해평가사 합격자)
```

### 11.2 Phase -1 실행 (2주)

§10 실행 순서대로 진행.

### 11.3 [B-6A] 결과에 따른 분기 실행

```
Go + B-6A 시나리오 A (합격):
  □ ADR-011 (3-Tier AI Strategy) 작성
  □ Phase 2 L2 시범 계획 확정

Go + B-6A 시나리오 B/C (실패):
  □ ADR-011 초안 수정: "Phase 2 L2 이월" 명시
  □ 기존 기획대로 Year 1 진행 (AI 없이)
```

### 11.4 Phase 2 착수 전 (Year 1 Week 10 근처)

```
□ docs/runbooks/AI_INCIDENT_RESPONSE.md 완성
□ docs/runbooks/AI_ROLLBACK_PROCEDURE.md 완성
□ docs/runbooks/POSTMORTEM_TEMPLATE.md 완성
□ user_ai_feedback DB 스키마 마이그레이션 준비
□ Slack webhook 설정
□ Feature Flag 시스템 설계
```

### 11.5 Phase 2 착수 시 (Year 1 Week 11)

```
□ packages/ai-engine/ 디렉토리 신설 (DEFCON L3, plan 필수)
□ AIRouter 인터페이스 구현 (§3.3 형식)
□ /api/exams/:exam/ai/rephrase 엔드포인트
□ user_ai_feedback 수집 API
□ 신고 버튼 UI
□ AI 자동 생성 배지 UI
□ AI-Safe Rule 1~6 + 1.5 린터 활성화
```

### 11.6 Year 2 Phase 4 착수 시 (LoRA 시작)

```
□ ADR-013 최종 확정 (Year 1 운영 경험 반영)
□ lora_training_candidates 스키마 마이그레이션
□ 진산님 큐레이션 대시보드 구축
□ 자동 필터 배치 (nightly cron) 구축
□ 첫 LoRA 훈련 (Unsloth + Colab)
□ base 모델 GGUF R2 백업
```

---

## 12. 본 v1.1과 기존 문서 정합성 확인

### 12.1 v3.0 FINAL과 충돌 없음

| v3.0 FINAL 요소  | v1.1 영향                                            | 정합성 |
| ---------------- | ---------------------------------------------------- | ------ |
| Hard Rules 17개  | 유지 (AI-Safe Rule과 Fine-tune Lock은 별도 카테고리) | ✅     |
| DEFCON L1/L2/L3  | 유지 (packages/ai-engine은 L3)                       | ✅     |
| Phase 0~3 로드맵 | 유지 (AI는 Phase 2부터 선택적 추가)                  | ✅     |
| Graph RAG 3계층  | 유지 (AI가 Graph RAG 결과를 소비)                    | ✅     |
| 8개 품질 게이트  | 유지 + Hard Stop 5번째 규칙 추가                     | ✅     |
| ExamAdapter 패턴 | 유지 (Year 2에 LoRA 어댑터로 확장)                   | ✅     |

### 12.2 기존 ADR 001~010과의 관계

```
ADR-006 (Cloudflare 단일 벤더):
  → Workers AI는 이미 예외 조항에 포함
  → Replicate/Fireworks 폴백은 "장애 시 한정" 단서
  → 정합성 유지

ADR-007 (멀티시험 Year 2 이월):
  → LoRA도 Year 2 Phase 4 이후
  → 자연 정합

ADR-004 (Vectorize 임베딩 스펙):
  → Graph RAG는 그대로
  → AI는 Vectorize 결과의 소비자
  → 정합

ADR-008 (Graceful Degradation 임계값):
  → AI 검증 실패 시에도 동일 임계값 적용
  → 정합

ADR-009 (PIPA/PII):
  → 등급 A 데이터 수집에 적용
  → 정합
```

### 12.3 신규 작성 예정 ADR

```
ADR-011 (AI 3-Tier Hybrid Strategy)
  → 작성 시점: Phase -1 [B-6] 결과 후

ADR-012 (HF 모델 CDN R2 미러링)
  → 작성 시점: Year 2 Phase 5 직전

ADR-013 (LoRA 어댑터 정책)
  → 작성 시점: v1.1 발행 후 1주 내 (§11.1)
```

---

## 맺음말

> 진산님의 5가지 결재와 3가지 추가 지시를 모두 반영했습니다.
>
> **"먼저 기존 기획대로, AI는 감안하여 개발. LoRA는 향후, 소형 AI부터."**
>
> 이 한 문장이 v1.1 전체를 관통하는 원칙입니다.
>
> v1.1이 v1.0과 본질적으로 다른 점:
>
> - **Year 1 초점 재확립**: Graph RAG, Formula Engine, FSRS가 주인공.
>   AI는 옵션. LoRA는 후순위 중의 후순위.
> - **"감안 개발"의 코드 레벨 정의 7원칙**: 모호한 방침 아닌 실행 지침.
> - **LoRA 자동 수집 시스템의 3등급 체계**: 나중에 추가하는 것이 아니라
>   Phase 2부터 설계 격리. 단, 실제 LoRA 훈련은 Year 2 Phase 4까지 대기.
> - **Base 모델 항상성 4중 안전장치**: Workers AI deprecation, LoRA 호환성,
>   외부 API 폴백까지 전체 경로 커버.
> - **AI Incident Response 4단계**: 구체적 조건·자동 조치·인간 조치 명시.
> - **Phase -1 법무 생략**: 2주 계획으로 단축.
> - **한국어 강한 모델 4개 비교**: Llama, Qwen, EXAONE, Gemma — [B-6A]에서
>   실제 측정 후 선정.
>
> 쪽집게는 **"AI 서비스"가 아니라 "AI를 활용하는 자격시험 학습 SaaS"** 입니다.
> 중심은 Graph RAG와 Formula Engine. AI는 이를 사용자에게 더 친절하게 전달하는
> **도구**일 뿐입니다.
>
> 이 인식이 v1.1의 가장 중요한 전언입니다.
>
> — DEV COVEN SLM+LoRA Integration Plan v1.1 FINAL
> — 2026-04-24

---

_"기술은 옵션이다. 사용자가 시험에 합격하는 것만이 목적이다._
_AI는 이 목적에 복무할 때만 쓸모 있다._
_Year 1의 승리는 AI 없이도 시험에 합격시키는 서비스를 만드는 것이다._
_Year 2의 승리는 그 서비스에 AI를 얹어 더 빨리 합격시키는 것이다."_
