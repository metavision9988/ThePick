# Phase 3 학습 UX 모드 본격 plan — `phase3-learning-ux-modes.plan`

> **목적**: Phase 2 Eval MVP /study 단일 textarea 평가 baseline을 Phase 3 정식 학습자 경험으로 본격 확장. 진산님 명시 발화 (Session 065) "신뢰성 담보 후 학습자 몰입·재미·효율 UX가 성공요인" 정합.
> **북극성 reference**: memory `project_ux_north_star_phase3.md` (2차 축 = 학습자 UX 본격) + `project_source_citation_requirement.md` (출처 1급) + `project_vision_mvp_generalization.md` (자격증 자동 훈련 엔진 MVP)
> **본 plan 작성 시점**: Session 070+ 진입 직전, Phase 3 launch 1주 스프린트 전.

---

phase: 3
step: 3-UX-1 (본 plan = 메타. 실 구현은 Step 3-UX-2 이후 chunk 분할)
approved_by: TBD (진산님 §13 결정 후 코딩)
scope:

- 신규 패키지: `packages/learning-modes/` (학습 모드 core 엔진 + 답안 채점 invariant — Engine-First)
- 신규 패키지: `packages/srs/` (FSRS 알고리즘 + 가중치 + 약점 영역) ★ §6.1 PITR 결정 후 확정
- API 변경: `apps/api/src/study/routes.ts` 확장 + 신규 `/api/study/mode` + `/api/study/session`
- UI 변경: `apps/web/src/components/QuestionCard.tsx` 분기 + 신규 `MultipleChoice` / `FillBlank` / `Essay` / `Calc` 컴포넌트
- DB 스키마 변경: `exam_questions` 확장 + 신규 `study_sessions` / `study_modes` / `streak_records` 테이블 (마이그레이션 0032~0035 예상)
- L3 영역: user_progress + DB 스키마 + exam_questions 처리 (CLAUDE.md L3 정합)

risk_level: **L3** (사용자 학습 데이터 + DB 스키마 변경 + 코어 학습 경험)

---

## 1. 목적 + 북극성

### 1.1 진산님 명시 발화 (Session 065, 2026-05-11)

> "학습 자료의 신뢰성이나 정확성이 담보가 된다면.. 이 프로젝트의 성공요인은 사용자가 얼마나 효과적으로 학습을 하게 하거나 몰입/재미/효율 등등을 위한 사용자 인터페이스나 경험을 잘 기획, 설계 디자인 해야 하는 것이지"

본 plan은 진산 발화의 "사용자 인터페이스나 경험"을 5축으로 분해하여 Phase 3 launch 시점의 학습자 경험 자체를 코어 product의 차별점으로 격상한다.

### 1.2 본 plan이 달성해야 할 5축

1. **답안 입력 type 차별화** (객관식/단답/서술/계산식 — 4 type)
2. **보기 번호 랜덤화** (객관식 1/2/3/4/5 위치 매번 랜덤)
3. **학습 흐름 다양화** (카테고리/주제/헷갈림/약점 — 4 mode)
4. **게이미피케이션** (streak / 일일 목표 / 마스터 비율 / 진도 시각화)
5. **세션 흐름** (warm-up → main → cool-down, 모바일 80% 정합)

### 1.3 출처 추적성 1급 (memory `project_source_citation_requirement` 정합)

본 plan으로 만드는 모든 학습 UI는 "근거 보기" UX를 1급 기능으로 유지. Phase 2 Eval MVP QuestionCard `relatedNodes` + `sourceCitations` surface는 본 plan 전 mode에 대해 강제 유지.

---

## 2. ★ Reality Anchor — 학습 UX의 함정 3가지

> CLAUDE.md `## v2 추가 — 단계별 소환 커맨드` §"새 기능 기획 직후 → /user:anchor" 정합. "가능합니다" 함정 차단 의무 영속.

### 함정 1 — "객관식 라디오는 단순 UI 교체"

**환상**: textarea를 라디오 5개로 바꾸기만 하면 끝.

**현실**:

- 손해평가사 1차 기출 ~525문 중 **현재 D1 `exam_questions.answer` 컬럼은 단일 정답 string** (예: "③" 또는 "1"). 5지선다의 4개 distractor (오답 후보) 데이터가 **없다**.
- distractor 생성 전략 필요: (a) 기출 원문 5지선다 원본 추출 + adminUI 검수, (b) LLM 자동 생성 + 인간 검수, (c) 다른 유사 문제 정답을 풀로 추출 후 분포 매칭. **각 path마다 별도 BATCH 보강 작업** 필요.
- 본 plan 진입 전 진산 결정 필요: distractor 데이터 출처 정책 (§13 D1).

### 함정 2 — "FSRS 도입은 라이브러리만 import"

**환상**: FSRS-4 npm 패키지 import → 약점 모드 완성.

**현실**:

- FSRS는 **각 카드별 review 이력 (rating: again/hard/good/easy + interval + stability)** 필요. 현 `user_progress` 스키마는 `total_reviews` + `correct_count`만 있음 → FSRS 입력 데이터 부재.
- 마이그레이션 의무: `user_progress.fsrs_state` JSON 컬럼 + `study_reviews` 별도 테이블 (review별 timestamp + rating + interval). 본 plan §8 데이터 모델 변경 §2.
- FSRS 알고리즘 자체는 Workers 호환 (순수 계산) 가능. 그러나 학습 운영 단계 trick: cold start (신규 user 100% 카드 미경험), GC (10K user × 평균 1000 review = 1000만 row), 약점 영역 정의 (subject별? cluster별? confusion_type별?).
- "FSRS 도입하면 약점 모드 자동" 환상 차단. **약점 영역의 정의 자체가 design 결정** (진산 §13 D2).

### 함정 3 — "보기 랜덤화는 클라이언트 셔플"

**환상**: 보기 5개를 클라이언트에서 `Math.random()` 셔플 → 끝.

**현실**:

- 다중 device sync: 같은 user가 데스크탑/모바일/iPad 각각 다른 셔플 → 부정 행위 의심 + 학습자 혼란 ("아까 ②번이었는데 지금 ④번")
- 시드 결정성: 같은 user + 같은 문제 = 같은 셔플 시드 → server-side seed 생성 (예: `hash(userId || questionId || YYYYMMDD)` → 일자별 동일, 다음날 새 셔플)
- 정답 위치 telemetry: A/B/C/D/E 정답 분포 통계 → 학습자가 "③번 정답 빈도 높음" 같은 메타 학습 차단
- 클라이언트가 정답을 알면 안 됨: 셔플 후 라벨만 보내고, 채점은 server 측에서 정답 라벨 매칭. **client에 정답 정보 비노출 의무**.
- **서버 측 결정성 시드 + 클라이언트 stateless 라벨 입력** 패턴 강제. §6.2 PITR.

### Reality Anchor 결론

본 plan은 "UI 변경 plan"이 아니라 **데이터 모델 + 알고리즘 + 운영 정책 + UI** 4축 통합 plan. 4축 중 1축이라도 빠지면 production 회귀.

---

## 3. 현 baseline 상태 (Phase 2 Eval MVP — Session 064 종착)

### 3.1 /study 페이지 구조 (`apps/web/src/pages/study.astro` + `apps/web/src/components/QuestionCard.tsx`)

- 단일 textarea + Ctrl+Enter 채점 + Ctrl+N 다음 문제
- 정답 normalize: ① / 1 / 1번 모두 동일 처리 (서버 측 `normalizeAnswer()` 정합)
- 출처 surface: examReferences + manualPages + lawArticles + relatedNodes
- "loading / answering / graded / exhausted / error" 5 phase
- 인증 401 → /auth/login redirect
- 약술/계산형 → 422 QUESTION_HAS_NO_ANSWER (자동 채점 불가)

### 3.2 /api/study/{next,grade} API (`apps/api/src/study/routes.ts`)

- `GET /api/study/next` — exam_questions 단순 가중치 추출, 1건 단위 (max 5)
  - Hard Rule 16 examId 강제, Hard Rule 17 EXAM_IDS 경유
  - FSRS 미적용, total_reviews/correct_count만 갱신
- `POST /api/study/grade` — user_progress UPSERT (`card_type='exam'`)
  - normalize 후 `answer` 컬럼과 대조
  - sourceCitations + relatedNodes 응답
- L3: user_progress 사용자 데이터

### 3.3 데이터 모델 baseline (★ Session 070 진입 시점 검증 정합)

```sql
-- exam_questions (Phase 2 baseline, 0001 + 0002 schema)
CREATE TABLE exam_questions (
  id TEXT PRIMARY KEY,
  -- exam_id 컬럼 부재 (Hard Rule 16 Year 2 zero-cost — 함수 시그니처 examId 의무, WHERE 절은 Year 2 도입)
  year INTEGER NOT NULL,
  round INTEGER,
  question_number INTEGER,
  exam_type TEXT,          -- '1st' | '2nd'
  subject TEXT,
  content TEXT NOT NULL,
  answer TEXT,             -- 단일 정답 (★ distractor 없음)
  explanation TEXT,
  related_nodes TEXT,      -- JSON array of knowledge_nodes.id
  related_constants TEXT,
  topic_cluster TEXT,
  confusion_type TEXT,     -- 헷갈림 type (cross_crop 등)
  valid_from TEXT,
  valid_until TEXT,
  superseded_by TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active','deprecated','flagged'))
);

-- user_progress (Phase 2 baseline, 0002 + 0029)
CREATE TABLE user_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  node_id TEXT REFERENCES knowledge_nodes(id),
  card_id TEXT,
  card_type TEXT NOT NULL,
  -- ★ FSRS 컬럼 4종 이미 존재 (Phase 2 baseline) — Session 070 진입 시점 검증
  fsrs_difficulty REAL DEFAULT 0.3,
  fsrs_stability REAL DEFAULT 1.0,
  fsrs_interval INTEGER DEFAULT 1,
  fsrs_next_review TEXT,
  total_reviews INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  last_confusion_type TEXT,
  created_at TEXT,
  updated_at TEXT
);
```

★ **Session 070 진입 시 정합 발견**: `user_progress`에 이미 FSRS 컬럼 4종 존재 (fsrs_difficulty + stability + interval + next_review). plan §13 D7 lock 정합 — option C 채택 (컬럼 확장).

### 3.4 baseline의 명확한 한계

- 객관식 5지선다 UI 없음
- 보기 데이터 없음
- 보기 랜덤화 없음
- 학습 모드 (카테고리/주제/헷갈림/약점) 분기 없음
- FSRS 미적용 → 약점 가중 없음
- streak / 일일 목표 / 마스터 비율 없음
- 세션 흐름 없음 (단일 카드 무한 stream)
- 모바일 touch target 검증 부재 (textarea + 작은 버튼)

→ Phase 3 본격 학습 UX는 본 baseline 위에 **6 step 분할 구현**.

---

## 4. 학습 모드 5축 분류

### 4.1 답안 입력 type 차별화 (4 type)

| Type   | UI 컴포넌트      | 채점 방식               | 입력 패턴                                                  |
| ------ | ---------------- | ----------------------- | ---------------------------------------------------------- |
| 객관식 | `MultipleChoice` | 라벨 매칭 (서버)        | 라디오 5지선다 + 마우스 클릭 + 키보드 1~5 단축키           |
| 단답형 | `FillBlank`      | normalize + 정답 string | `[ ___ ]` 빈칸 inline input + 자동 focus                   |
| 서술식 | `Essay`          | self-grade or LLM grade | textarea + "정답 확인" 토글 + 자체 채점 라디오 (맞음/틀림) |
| 계산식 | `Calc`           | Formula Engine AST 비교 | 단계별 풀이 입력 + 최종값 입력 + 산식 변수 입력 (선택)     |

**API 변경**: `/api/study/next` 응답에 `inputType: 'multiple_choice' | 'fill_blank' | 'essay' | 'calc'` 추가. exam_questions 신규 컬럼 `input_type` (마이그레이션 0032).

**채점 invariant**: 4 type 모두 server-side 채점. 클라이언트 채점 0건 (보안 + 회귀 차단).

### 4.2 보기 번호 랜덤화 (객관식 전용)

§2 Reality Anchor 함정 3 영속 정합:

- 시드: `hash(userId || questionId || YYYYMMDD)` — 일자별 결정성, 다음날 새 시드
- 클라이언트: 셔플된 라벨 (A/B/C/D/E)만 표시, 정답 라벨 비노출
- 채점: 서버 측 `originalIndex = shuffleMap.indexOf(submittedLabel)` 역추적 → `answer` 컬럼 매칭
- telemetry: 정답 위치 분포 통계 추적 X (정답 라벨 정보가 metric에 누설되지 않도록)

### 4.3 학습 흐름 다양화 (4 mode)

| Mode     | 추출 정책                                                       | UI 진입점                                 |
| -------- | --------------------------------------------------------------- | ----------------------------------------- |
| 카테고리 | 과목 / 단원 / 난이도 필터                                       | /study/category 또는 /study?mode=category |
| 주제     | concept 단위 (knowledge_nodes id) — 1 concept = 관련 5~10문     | /study/topic/[conceptId]                  |
| 헷갈림   | confusion_type 자동 surface (cross_crop / 숫자 / 연도 / 법조문) | /study/confusion                          |
| 약점     | FSRS 약한 영역 가중 + 사용자 history 기반                       | /study/weak (default `/study` route)      |

**API 변경**: `/api/study/next` 응답 + 신규 `/api/study/mode` 엔드포인트 — mode 별 추출 정책 분기.

### 4.4 게이미피케이션 (streak / 일일 목표 / 마스터 비율 / 진도 시각화)

- **streak**: 연속 일자 학습 (예: 7일 연속). `streak_records` 테이블 신규.
- **일일 목표**: user 설정 가능 (default 20문/일). 진도 표시.
- **마스터 비율**: FSRS stability ≥ 임계값 카드 / 전체 카드.
- **진도 시각화**: ProgressSummary 확장 — 주차/월별 chart (Recharts 또는 D3.js 경량 chart).

**비-과시 정책**: 게이미피케이션은 동기부여 도구. **부정 강조 (예: "당신은 너무 약하다") 금지**. 진산 추후 결정 §13 D5.

### 4.5 세션 흐름 (warm-up → main → cool-down)

- **warm-up** (3~5문): 최근 정답률 높은 쉬운 카드 → 자신감 + 워밍업
- **main** (15~25문): 약점/헷갈림/주제 mode 본격
- **cool-down** (3~5문): 마스터 카드 review → 종료감 + reinforcement

**UI**: 세션 진입 시 mode + 분량 선택 (default: 약점 mode + 일일 목표). progress bar로 phase 표시. 세션 종료 시 요약 (정답률 + streak update + 차주 권장).

---

## 5. UI 구성요소 변경 사양

### 5.1 신규 컴포넌트 (4 type별)

```
apps/web/src/components/study/
├── QuestionCard.tsx           — type 분기 + 공통 (header/footer/source)
├── MultipleChoice.tsx         — 객관식 5지선다 + 셔플 인덱스 + 키보드 1~5
├── FillBlank.tsx              — 단답 빈칸 inline input
├── Essay.tsx                  — 서술 textarea + self-grade 토글
├── Calc.tsx                   — 계산 단계별 입력 + Formula Engine 호출
├── SessionStart.tsx           — 세션 진입 mode + 분량 선택
├── SessionSummary.tsx         — 세션 종료 요약
├── ProgressVisualization.tsx  — streak / 일일 / 마스터 chart
└── ModeSelector.tsx           — 학습 mode 4종 분기
```

### 5.2 모바일 80% 정합

- touch target ≥ 44px (라디오 + 버튼 + 단축키 fallback)
- 한 손 조작 (single thumb zone 5지선다 라디오 우측 정렬)
- gesture: swipe (다음 문제) — 진산 §13 D6 결정 영역
- 입력 type 별 키보드 (number / text / textarea autoresize)

### 5.3 디자인 anchor (memory `feedback_focus_reliability_not_schedule` + AESTHETIC.md)

- 현 indigo-600 primary + gray-50 background 톤 유지
- 객관식 라디오: 선택 시 indigo border + 약한 fill, hover gray-50, focus ring-2
- 정답/오답 표시: emerald (정답) + amber (오답, 부정적 아님)
- 게이미피케이션 chart: pastel + Recharts default. 화려한 색상 X (학습 집중 방해 우려)
- 본격 구현 진입 시 `AESTHETIC.md` 갱신 의무 + 3안 (A/B/C) 디자인 제시

---

## 6. ★ PITR — 기술 선택지 비교 (각 영역별 ~2일 결정 의무)

> CLAUDE.md `## v2 추가 — 단계별 소환 커맨드` §"PITR (선택지 비교)" 정합. "첫 번째 떠오르는 방법" 차단 의무 영속.

### 6.1 SRS 알고리즘 (3 path)

| 옵션    | 장점                                           | 단점                                                  | 추천              |
| ------- | ---------------------------------------------- | ----------------------------------------------------- | ----------------- |
| FSRS-4  | 최신 (2024) + paper + open source + npm 패키지 | 알고리즘 복잡 (params 17개), cold start 어려움        | ★ Phase 3 default |
| SM2     | Anki 기본, 단순, 검증 (Anki 사용자 수억)       | 90년대 알고리즘, 학습 효율 FSRS 대비 20% 낮음 (paper) | fallback          |
| Leitner | 5 박스 단순, UI 직관적                         | 비최적, scaling 안 됨                                 | 비채택            |

**Claude 권고**: FSRS-4. 단점은 docs로 보완, npm 패키지 (ts-fsrs) 안정성 검증 후. 진산 §13 D2 결정.

### 6.2 보기 셔플 시드 (3 path)

| 옵션                                     | 장점                            | 단점                                   |
| ---------------------------------------- | ------------------------------- | -------------------------------------- |
| `hash(userId\|\|questionId\|\|YYYYMMDD)` | 일자별 결정성, device sync 보장 | 자정에 한꺼번에 시드 변경 (운영 spike) |
| `hash(userId\|\|questionId)` (영구)      | 영구 sync, simpler              | 학습자가 위치 기억 가능                |
| 첫 시도 후 영구 lock                     | 자연스러운 학습 흐름            | DB 컬럼 추가 (`shuffle_seed` per row)  |

**Claude 권고**: option 1 (일자별). 자정 spike는 minor (전체 user 1만 미만 시점). 진산 §13 D3.

### 6.3 distractor (오답 후보 5지선다) 데이터 출처 (3 path)

§2 Reality Anchor 함정 1 정합:

| 옵션                                     | 장점             | 단점                                  | 비용                         |
| ---------------------------------------- | ---------------- | ------------------------------------- | ---------------------------- |
| 기출 원문 5지선다 + adminUI 검수         | 정확 (기출 원본) | BATCH 보강 작업 별도 필요             | 1~2주 진산 + admin           |
| LLM (Claude Haiku) 자동 생성 + 인간 검수 | 빠름             | 환상 distractor 위험, 인간 검수 cost  | 1-2일 자동화 + 1주 검수      |
| 유사 문제 정답 풀 분포 매칭              | 데이터 활용      | 부정확, "Q1의 정답이 Q2의 distractor" | 알고리즘 1d + admin 검수 2주 |

**Claude 권고**: option 1. 기출은 진산님 영역 + memory `project_source_citation_requirement` 정합 (출처 1급). LLM 자동은 환상 위험. 진산 §13 D1.

### 6.4 약점 영역 정의 (4 path)

§2 Reality Anchor 함정 2 정합:

| 옵션                        | 정의                            | 데이터 출처                               |
| --------------------------- | ------------------------------- | ----------------------------------------- |
| subject별                   | 과목별 정답률 < 60% subject     | exam_questions.subject                    |
| topic_cluster별             | cluster별 정답률 < 60% cluster  | exam_questions.topic_cluster              |
| confusion_type별            | 헷갈림 type별 정답률 < 60% type | exam_questions.confusion_type             |
| concept (knowledge_nodes)별 | concept별 정답률 < 60% concept  | knowledge_nodes.id (related_nodes 역추적) |

**Claude 권고**: 4종 OR 조합 (예: subject + concept 우선, confusion 보조). 진산 §13 D2.

### 6.5 progressive disclosure 정책 (3 path)

채점 후 정보 노출 순서:

| 옵션             | 노출 순서                                             | 학습 효율                 |
| ---------------- | ----------------------------------------------------- | ------------------------- |
| 전체 동시 노출   | 정답 + 해설 + 출처 + 관련 자료 한꺼번에               | 인지 부하 高, 빠른 review |
| 단계별 토글      | 정답만 → 클릭 → 해설 → 클릭 → 출처 → 클릭 → 관련 자료 | 능동 학습, 시간 더 소요   |
| 정답 즉시 + 토글 | 정답 + 해설 동시, 출처/관련 자료는 토글               | 균형 (★ default 권고)     |

**Claude 권고**: option 3. 진산 §13 D4.

### 6.6 모바일 gesture (2 path)

| 옵션            | 장점            | 단점                             |
| --------------- | --------------- | -------------------------------- |
| swipe 다음 문제 | 한 손 빠른 학습 | 실수 trigger, accessibility 우려 |
| 큰 버튼만       | 명확, 실수 0    | 한 손 어렵 (큰 화면)             |

**Claude 권고**: 큰 버튼 + optional swipe (설정 toggle). 진산 §13 D6.

---

## 7. ★ Engine-First — 학습 모드 core 모듈 분리

> CLAUDE.md `## v2 추가 — 단계별 소환 커맨드` §"여러 모듈이 의존할 코어 → engine" 정합.

### 7.1 신규 패키지 `packages/learning-modes/`

학습 모드 분기 + 답안 채점 invariant + 보기 셔플 시드 + progressive disclosure 정책을 단일 패키지로 격리. apps/api + apps/web 양쪽 import.

```
packages/learning-modes/
├── src/
│   ├── input-types/
│   │   ├── multiple-choice.ts     — 셔플 시드 + 라벨 매칭 + 채점
│   │   ├── fill-blank.ts          — normalize + string 매칭
│   │   ├── essay.ts               — self-grade or LLM grade interface
│   │   └── calc.ts                — Formula Engine 호출 + 단계별 검증
│   ├── modes/
│   │   ├── category.ts            — 카테고리 추출 정책
│   │   ├── topic.ts               — concept 단위 추출
│   │   ├── confusion.ts           — confusion_type surface
│   │   └── weak.ts                — FSRS + 약점 영역 가중
│   ├── session/
│   │   ├── flow.ts                — warm-up → main → cool-down state machine
│   │   └── summary.ts             — 세션 종료 요약 계산
│   ├── shuffle.ts                  — deterministic seed (옵션 6.2 채택 후)
│   ├── normalize.ts                — 답안 normalize (기존 study/routes.ts에서 분리)
│   └── types.ts                    — InputType / LearningMode / SessionPhase 타입
├── tests/
│   └── ... (Golden test 100% 포함)
└── package.json
```

### 7.2 신규 패키지 `packages/srs/` (FSRS 알고리즘)

§6.1 PITR FSRS 채택 시 별도 패키지로 격리. ts-fsrs npm 패키지를 import하되, 우리 도메인 (knowledge_nodes / confusion_type 가중) wrapper layer.

### 7.3 외부 의존성 정합

- `learning-modes/` → `@thepick/shared` + `@thepick/formula-engine` (calc 입력 type)
- `srs/` → `ts-fsrs` (npm) + `@thepick/shared`
- 단방향: apps/api + apps/web → `learning-modes` + `srs`
- learning-modes → srs (약점 모드)
- srs → learning-modes 금지 (역의존 차단)

### 7.4 RTV (Reverse Transitivity Validation) 의무

신규 패키지는 단독 테스트 PASS + apps/api + apps/web 통합 후에야 UI 진입. Phase 1 §"Engine-First" 절차 정합.

---

## 8. 데이터 모델 변경 (마이그레이션 0032 ~ 0035 예상)

### 8.1 마이그레이션 0032 — exam_questions 확장

```sql
ALTER TABLE exam_questions ADD COLUMN input_type TEXT NOT NULL DEFAULT 'fill_blank'
  CHECK (input_type IN ('multiple_choice', 'fill_blank', 'essay', 'calc'));

-- 객관식 distractor 저장 (JSON array of 4 strings, 정답은 answer 컬럼 유지)
ALTER TABLE exam_questions ADD COLUMN distractors TEXT;  -- JSON array

-- 계산식 산식 변수 (예: { "보험가액": 1000000, "보상한도": 80% })
ALTER TABLE exam_questions ADD COLUMN calc_variables TEXT;  -- JSON object

CREATE INDEX idx_exam_questions_input_type ON exam_questions(input_type);
```

### 8.2 마이그레이션 0033 — user_progress FSRS 컬럼 확장 (D7 lock option C)

★ Session 070 진입 시 정합 발견: 기존 fsrs_difficulty/stability/interval/next_review 4 컬럼 활용. 신규 4 컬럼만 추가 (option C 채택).

```sql
-- 기존 컬럼 유지: fsrs_difficulty REAL, fsrs_stability REAL, fsrs_interval INTEGER, fsrs_next_review TEXT

-- 신규 FSRS-4 컬럼 (column 확장 패턴)
ALTER TABLE user_progress ADD COLUMN fsrs_reps INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_progress ADD COLUMN fsrs_lapses INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_progress ADD COLUMN fsrs_state TEXT NOT NULL DEFAULT 'new'
  CHECK (fsrs_state IN ('new', 'learning', 'review', 'relearning'));
ALTER TABLE user_progress ADD COLUMN fsrs_last_review TEXT;  -- nullable, 첫 review 전 NULL

-- 약점/마스터 (D2 lock 정합)
ALTER TABLE user_progress ADD COLUMN mastered_at TEXT;  -- fsrs_stability ≥ 30일 도달 시점
ALTER TABLE user_progress ADD COLUMN weak_score REAL NOT NULL DEFAULT 0;  -- 0~1 (높을수록 약점)

CREATE INDEX idx_user_progress_weak ON user_progress(user_id, weak_score DESC);
```

packages/srs `FsrsCardState` → column 매핑 (apps/api Step 3-UX-5 통합 시):

| FsrsCardState | column                  |
| ------------- | ----------------------- |
| due           | fsrs_next_review (ISO)  |
| stability     | fsrs_stability          |
| difficulty    | fsrs_difficulty         |
| reps          | fsrs_reps (신규)        |
| lapses        | fsrs_lapses (신규)      |
| state         | fsrs_state (신규)       |
| lastReview    | fsrs_last_review (신규) |
| scheduledDays | fsrs_interval (INTEGER) |

backward-compat:

- 기존 row의 fsrs_state default='new' → packages/srs `createFreshCard` 첫 review 시 정상 동작
- 기존 fsrs_difficulty=0.3 + fsrs_stability=1.0 default → ts-fsrs 첫 review 시 자체 갱신 (paper 정합 확인 의무)
- 기존 progress/routes.ts SELECT/INSERT은 4 신규 컬럼 NOT NULL DEFAULT 정합으로 그대로 동작

### 8.3 마이그레이션 0034 — study_reviews 신규 (review 이력)

```sql
CREATE TABLE study_reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,             -- exam_questions.id
  card_type TEXT NOT NULL,           -- 'exam' | 'concept'
  reviewed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  rating TEXT NOT NULL CHECK (rating IN ('again', 'hard', 'good', 'easy')),
  interval_days INTEGER NOT NULL,
  stability_before REAL,
  stability_after REAL,
  shuffle_seed TEXT,                  -- 객관식 셔플 시드 audit (정답 위치 metric 노출 X)
  session_id TEXT REFERENCES study_sessions(id) ON DELETE SET NULL
);

CREATE INDEX idx_study_reviews_user_at ON study_reviews(user_id, reviewed_at DESC);
CREATE INDEX idx_study_reviews_card ON study_reviews(card_id, card_type);
```

### 8.4 마이그레이션 0035 — study_sessions + streak_records

```sql
CREATE TABLE study_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ended_at TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('category', 'topic', 'confusion', 'weak', 'mixed')),
  mode_params TEXT,                   -- JSON: { subject, conceptId, confusionType, ... }
  phase TEXT NOT NULL CHECK (phase IN ('warmup', 'main', 'cooldown', 'completed')),
  cards_planned INTEGER NOT NULL,
  cards_completed INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0
);

CREATE INDEX idx_study_sessions_user_started ON study_sessions(user_id, started_at DESC);

CREATE TABLE streak_records (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_study_date TEXT,               -- YYYY-MM-DD (UTC 기준)
  daily_goal INTEGER NOT NULL DEFAULT 20
);
```

### 8.5 backward-compat

- 모든 컬럼은 NOT NULL DEFAULT 또는 nullable. 기존 row 영향 0.
- input_type default='fill_blank' → Phase 2 baseline 그대로 동작 (Phase 3 launch toggle 후 본 컬럼 활용)
- fsrs_state nullable → cold start 후 첫 review에서 채워짐
- user_progress 기존 row는 fsrs_state IS NULL → 약점 모드는 weak_score=0으로 시작

### 8.6 마이그레이션 0030/0031 정합

본 chain은 Session 069 적용한 0030 (login_history) + 0031 (event_type) 이후. 본 plan으로 0032~0035 신설.

---

## 9. API 변경

### 9.1 `/api/study/next` 확장

응답 schema에 추가:

```typescript
interface NextQuestion {
  // 기존 필드 ...
  readonly inputType: 'multiple_choice' | 'fill_blank' | 'essay' | 'calc';
  readonly choices?: ReadonlyArray<{ label: string; text: string }>; // 객관식만, 셔플 후 라벨 매핑
  readonly calcVariables?: Record<string, number>; // 계산식만
  readonly mode: 'category' | 'topic' | 'confusion' | 'weak' | 'mixed';
  readonly sessionId: string; // 세션 추적
  readonly sessionPhase: 'warmup' | 'main' | 'cooldown';
}
```

### 9.2 `/api/study/grade` 확장

요청 schema:

```typescript
interface GradeRequest {
  readonly questionId: string;
  readonly inputType: 'multiple_choice' | 'fill_blank' | 'essay' | 'calc';
  readonly userAnswer: string; // multiple_choice: 라벨 (A~E), 기타: 텍스트
  readonly selfRating?: 'again' | 'hard' | 'good' | 'easy'; // FSRS 입력 (essay self-grade or general)
  readonly sessionId: string;
}
```

응답 schema:

```typescript
interface GradeResponse {
  // 기존 필드 ...
  readonly correctLabel?: string; // 객관식만, 셔플 후 정답 라벨 (채점 후 노출 OK)
  readonly fsrsState: {
    readonly stabilityBefore: number;
    readonly stabilityAfter: number;
    readonly nextReviewAt: string; // ISO 8601
  };
  readonly streak: {
    readonly current: number;
    readonly dailyGoalProgress: number; // 0~1
  };
}
```

### 9.3 신규 `/api/study/mode`

mode 별 메타데이터 + 카드 풀 통계:

- `GET /api/study/mode?examId=...` — 4 mode 별 available 카드 수 + 약점 영역 surface
- `POST /api/study/mode/start` — 세션 시작 (mode + params + cards_planned)
- `POST /api/study/mode/end` — 세션 종료

### 9.4 신규 `/api/study/session/:id`

세션 진척 추적:

- `GET /api/study/session/:id` — 진행 중 세션 상태
- `POST /api/study/session/:id/complete` — 세션 종료 + summary

### 9.5 progress API 영향

기존 `/api/progress/*`는 concept-based. 본 plan 변경 없음 (card_type='concept' 별도 유지).

---

## 10. 단계별 구현 (Step 3-UX-2 ~ 3-UX-7)

### Step 3-UX-2 — packages/learning-modes 신설 + Engine-First

- 신규 패키지 + types + input-types/{multiple-choice, fill-blank, essay, calc}
- normalize + shuffle (시드 정책 §13 D3 결정 후)
- Golden Test 100% (각 input type별 10+ 케이스)
- 단독 vitest PASS

### Step 3-UX-3 — packages/srs 신설 + FSRS 통합 (조건부)

- §13 D2 진산 FSRS 결정 시 진행
- ts-fsrs npm 도입 + wrapper (knowledge_nodes 도메인 + weak_score)
- cold start 정책 + 약점 영역 가중 산식
- Golden Test (paper 검증 + 우리 도메인 검증)

### Step 3-UX-4 — 마이그레이션 0032 ~ 0035

- 0032 exam_questions 확장
- 0033 user_progress FSRS 컬럼
- 0034 study_reviews 신규
- 0035 study_sessions + streak_records 신규
- L3 영역 — plan 영속 + 진산 승인 후 코딩
- production apply 별도 chain (Session 069 deploy pattern)

### Step 3-UX-5 — apps/api study routes 확장

- `/api/study/next` inputType 분기 + choices 셔플
- `/api/study/grade` 4 type 채점 + FSRS state 업데이트 + streak 갱신
- `/api/study/mode` 4 mode + 세션 생명주기
- `/api/study/session/:id` 진척 추적
- 4-Pass 의무 (Session 068 9 에이전트 패턴)

### Step 3-UX-6 — apps/web 신규 컴포넌트

- QuestionCard.tsx 분기 + 4 input type 컴포넌트
- ModeSelector + SessionStart + SessionSummary
- ProgressVisualization (streak / 일일 / 마스터)
- AESTHETIC.md 갱신 + 3안 디자인 제출 — **하이브리드 외주 채택 (ADR-038)**
- 모바일 80% touch target 검증 (Playwright + 실 device)

**Step 3-UX-6 sub-step 분해 (Session 071 영속, ADR-038 정합)**:

| Sub-step            | 작업                                               | 의존                                   | 산출물                                                                                                                                                               |
| :------------------ | :------------------------------------------------- | :------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3-UX-6a (★ 진행 중) | 디자인 lock 워크플로우 영속                        | 없음                                   | `docs/design/AESTHETIC.md` + `docs/design/rfp-step-3-ux-6.md` + ADR-038. 진산 Claude Design 응답 수령 + LOCK 결정 영속 (`docs/design/responses/step-3-ux-6-LOCK.md`) |
| 3-UX-6b             | 4 input type 컴포넌트 분기 (QuestionCard 리팩토링) | 6a LOCK                                | `MultipleChoice` / `FillBlank` / `Essay` / `Calc` 4 컴포넌트 + QuestionCard 분기                                                                                     |
| 3-UX-6c             | ModeSelector + SessionStart + SessionSummary       | 6a LOCK + `/api/study/mode` 매핑 layer | 3 신규 컴포넌트 + study.astro 통합                                                                                                                                   |
| 3-UX-6d             | ProgressVisualization                              | 6a LOCK                                | streak / 일일 / 마스터 chart 컴포넌트                                                                                                                                |
| 3-UX-6e             | 검증 (Playwright + 4-Pass + 5-페르소나)            | 6b-d 완료                              | 모바일 80% 통과 + CRIT 0건                                                                                                                                           |

### Step 3-UX-7 — distractor BATCH 보강 (§13 D1 결정 후)

- 기출 원문 5지선다 추출 (pdfplumber + admin UI 검수)
- adminUI에서 distractor 검수 + approved
- production seed (별도 BATCH)

---

## 11. 게이트 / 검증

### 11.1 본 plan 자체 게이트

- [ ] 진산님 §13 결정 D1~D6 모두 회신
- [ ] AESTHETIC.md 갱신 + 3안 디자인 제출
- [ ] Reality Anchor 함정 3개 모두 plan 본문에 반영 ✓ (§2)
- [ ] PITR 6 영역 선택지 비교 ✓ (§6)

### 11.2 Step 3-UX-2 게이트

- [ ] packages/learning-modes vitest 100% Golden
- [ ] 4 input type 각 10+ 케이스 (정답/오답/edge)
- [ ] shuffle 시드 결정성 검증 (동일 user+question+date → 동일 셔플)
- [ ] 4-Pass 독립 에이전트 리뷰 CRITICAL 0

### 11.3 Step 3-UX-3 게이트

- [ ] FSRS paper 검증 (10 카드 × 100 review trace 정합)
- [ ] cold start 정책 정합
- [ ] weak_score 산식 검증 (Golden 20 케이스)

### 11.4 Step 3-UX-4 게이트 (마이그레이션, L3)

- [ ] plan 작성 + 진산 승인 (본 plan 자체로 갈음)
- [ ] backward-compat 영향 분석
- [ ] production 사전 staging dry-run (D1 staging 환경 도입 후 — Session 067 carry-over)
- [ ] verify-engine-contracts PASS (Cat 9/10 정합)

### 11.5 Step 3-UX-5 + 3-UX-6 게이트

- [ ] apps/api typecheck + lint + tests PASS
- [ ] apps/web typecheck + lint + tests PASS
- [ ] 4-Pass 독립 에이전트 리뷰 CRITICAL 0
- [ ] 5-페르소나 기술부채 리뷰 (Phase 3 종료 게이트 정합)
- [ ] 모바일 80% touch target Playwright + 실 device 검증
- [ ] 출처 surface UX 1급 유지 (Phase 2 baseline 회귀 0)

### 11.6 Step 3-UX-7 게이트 (distractor)

- [ ] 기출 원본 정합 100% (admin 검수)
- [ ] 환상 distractor 0건 (인간 검수 PASS)
- [ ] golden test: 객관식 자동 채점 100% 정확도

---

## 12. carry-over / out of scope

### 12.1 본 plan에서 명시 제외

- **LLM 자동 채점 (서술식)**: §4.1 essay type은 self-grade default. LLM 채점은 별도 plan (Phase 3 후반).
- **음성 입력**: 한국어 STT는 본 plan 제외. carry-over.
- **collaborative 학습 (스터디 그룹)**: 별도 plan. carry-over.
- **랭킹 / 리더보드**: 게이미피케이션 §4.4 부정 강조 정책 정합. carry-over.
- **AI 튜터 (personalized hint)**: SLM/LoRA chain (memory `project_slm_lora_deferred_2027` 정합). 2027-04 이후.

### 12.2 carry-over (Session 070+ 또는 Phase 3 launch 후)

- 학습 데이터 telemetry (게이지 추가) — memory `project_engine_observability` 정합
- admin login_history 조회 API + 학습 행동 forensics
- A/B 테스트 framework (학습 UX variant 검증)
- 다른 시험 (전기기사 등) 학습 모드 적용 — Year 2 Phase 4

---

## 13. 진산님 결정 의무 항목 (D1~D6) — ★ Session 070 진산 회신 lock (2026-05-12 KST)

본 plan 본격 구현 진입 (Step 3-UX-2 코딩) 전 진산 결정 의무. **6 항목 모두 Claude 권고대로 lock**.

| ID  | 영역                          | 결정 (lock)                                                                                                     |
| --- | ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| D1  | distractor 데이터 출처        | ★ **기출 원문 5지선다 추출 + adminUI 검수** — BATCH 보강 1-2주 (Step 3-UX-7)                                    |
| D2  | SRS 알고리즘 + 약점 영역 정의 | ★ **FSRS-4 + subject+concept** — `packages/srs/` 신규 (Step 3-UX-3), weak_score = subject 정답률 + concept 가중 |
| D3  | 보기 셔플 시드 정책           | ★ **`hash(userId\|\|questionId\|\|YYYYMMDD)`** — 일자별 결정성, device sync 보장                                |
| D4  | progressive disclosure        | ★ **정답 즉시 + 토글** — 정답 + 해설 동시 노출, 출처 + 관련 자료는 토글                                         |
| D5  | 게이미피케이션 강도           | ★ **표준 (streak + 마스터 + 일일)** — 부정 강조 X, 랭킹 chunk 추후 진산 결정 carry-over                         |
| D6  | 모바일 gesture                | ★ **큰 버튼 + optional toggle** — default 큰 버튼, 설정에서 swipe 활성 선택                                     |

### 13.1 lock 결정 영향 정리 (Step 3-UX-2~7 implementation 진입 직접 정합)

- **§6.1 SRS**: FSRS-4 채택 → `packages/srs/` 신규 + ts-fsrs npm 도입 (Step 3-UX-3)
- **§6.2 셔플**: 일자별 결정성 → `packages/learning-modes/src/shuffle.ts` `dailySeed(userId, questionId)` (Step 3-UX-2)
- **§6.3 distractor**: 기출 원문 → adminUI 검수 BATCH (Step 3-UX-7, 진산 + admin 1-2주)
- **§6.4 약점**: subject+concept 결합 → `weakScore = α·(1 - subject_correct_rate) + β·(1 - concept_stability)` (Step 3-UX-3)
- **§6.5 disclosure**: 정답 즉시 + 토글 → `GradedResultPanel` 정답/해설 always-on + 출처/관련 자료 `<details>` (Step 3-UX-6)
- **§6.6 gesture**: 큰 버튼 + toggle → `SwipeToggle` setting + accessibility ARIA 정합 (Step 3-UX-6)

### 13.2 본 plan 다음 단계

진산 §13 회신 + 본 plan §13.1 lock 완료. **Step 3-UX-2 (packages/learning-modes 신설)** 진입 가능 상태. 단, Phase 3 launch 1주 스프린트 chain 정합 (memory `project_launch_legal_bundle_deferred`)으로 본격 구현 진입 시점은 진산 추가 발화 의무.

후속 carry-over 결정 (Step 3-UX 진행 중 또는 본격 launch 시점):

- D8 (carry-over): D5 랭킹 서비스 도입 여부
- D9 (carry-over): D2 약점 영역 α/β 가중치 정밀 조정
- D10 (carry-over): 학습 데이터 telemetry (게이지 추가 — memory `project_engine_observability`)

### 13.3 추가 결정 lock — Session 070 진입 시 발견 정합

| ID  | 영역                  | 결정 (lock)                                                                                  |
| --- | --------------------- | -------------------------------------------------------------------------------------------- |
| D7  | FSRS column 정합 정책 | ★ **option C: 기존 fsrs\_\* 4 컬럼 유지 + 신규 4 컬럼 추가** (reps/lapses/state/last_review) |

근거: `user_progress` 테이블에 이미 fsrs_difficulty/stability/interval/next_review 4 컬럼 존재 (0002 마이그레이션). apps/api/{study,progress}/routes.ts에서 광범위 사용 중. JSON 단일 전환 시 routes 전면 재작성 + 진산 G9 임시 row 15건 데이터 마이그레이션 필요.

option C 영향:

- 마이그레이션 0033 (§8.2) — 신규 4 컬럼 추가만 (idempotent ALTER ADD COLUMN NOT NULL DEFAULT)
- packages/srs `FsrsCardState` ↔ column 매핑 layer만 신설 (apps/api Step 3-UX-5)
- 기존 progress/routes.ts SELECT/INSERT 100% 호환 (column 추가만)
- backward-compat 완전 (마이그레이션 적용 후 기존 row의 fsrs_state default='new' → 첫 review 시 ts-fsrs 정상 동작)

---

## 14. 출처 / 정합 reference

- memory `project_ux_north_star_phase3.md` (★ 1순위 — 진산 명시 발화 영속)
- memory `project_source_citation_requirement.md` (출처 1급)
- memory `project_vision_mvp_generalization.md` (북극성 1차 축 — 생성물 신뢰성)
- memory `feedback_focus_reliability_not_schedule.md` (안정성/신뢰성/항상성)
- memory `project_engine_observability.md` (학습 데이터 게이지)
- memory `project_launch_legal_bundle_deferred.md` (Phase 3 launch 1주 스프린트 chain)
- memory `feedback_test_env_password_dont_nag.md` (Phase 3 launch 시점 password toggle)
- handoff-session-078.md (Session 069 종착 — 본 plan 진입 baseline)
- `docs/plans/phase2-eval-mvp.plan.md` (Phase 2 Eval MVP baseline — §3 baseline 참조)
- `docs/plans/phase3-launch-chain.plan.md` (Phase 3 launch chain — §1 §13 chain 동기)
- ADR-005 (PBKDF2) + ADR-034/035/036/037 (임시 정책 + governance)
- `.claude/rules/auto-review-protocol.md` (4-Pass + 5-페르소나 의무)
- CLAUDE.md `## v2 추가 — 단계별 소환 커맨드` (anchor / pitr / engine / design / verify / gates)

---

## 15. 영향 매트릭스 (sentry baseline)

| 영역                      | 영향                                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| 패키지                    | 신규 2 (learning-modes + srs)                                                                         |
| 마이그레이션              | 4 (0032~0035)                                                                                         |
| API 라우트                | 기존 2 확장 + 신규 4                                                                                  |
| UI 컴포넌트               | 신규 9 (QuestionCard 분기 + 4 input type + Session 3 + Mode 1 + Progress 1)                           |
| L3 영역 변경              | user_progress 스키마 + exam_questions 스키마 + 학습 데이터 처리                                       |
| 출처 surface 회귀         | 0건 의무 (Phase 2 baseline 그대로 유지)                                                               |
| 모바일 80% touch target   | 검증 신규 (Playwright + 실 device)                                                                    |
| BATCH 보강 (distractor)   | 1주~2주 진산 + admin (D1 결정 후)                                                                     |
| 전체 작업 분량            | Step 3-UX-2~6 약 2~3주 + Step 3-UX-7 distractor 보강 1~2주                                            |
| Phase 3 launch chain 정합 | ADR-034/035/036 복원 + 본 plan 활성 동시 (memory `project_launch_legal_bundle_deferred` 1주 스프린트) |

---

**작성**: Claude (Opus 4.7 1M context) — Session 070 진입 직전 (handoff-078 §"다음 세션 할 일" §2 정합)
**작성 효력**: 2026-05-12 KST
**다음 단계**: 진산 §13 D1~D6 결정 회신 → Step 3-UX-2 (packages/learning-modes 신설) 진입
**관련 commit**: 본 plan 신설 commit + ADR (필요 시) + 마이그레이션 plan (Step 3-UX-4)
