# ADR-038: Step 3-UX-6 디자인 단계 외주 하이브리드 채택

- **상태:** Accepted
- **결정일:** 2026-05-13
- **결정자:** 진산 (선택) + Claude Opus 4.7 (PITR 3안 권고)
- **관련 영역:** Step 3-UX-6 apps/web 5 컴포넌트 디자인

---

## 맥락 (Context)

Phase 3 학습 UX UI 단계 (Step 3-UX-6, plan §10) 진입. 본 단계 산출물:

- QuestionCard.tsx 분기 + 4 input type 컴포넌트 (`multiple-choice` / `fill-blank` / `essay` / `calc`)
- ModeSelector + SessionStart + SessionSummary (mode 생명주기)
- ProgressVisualization (streak / 일일 / 마스터)
- AESTHETIC.md 갱신 + 3안(A/B/C) 디자인 제출 의무 (글로벌 `~/.claude/AESTHETIC.md` §"3-Variant 규칙")
- 모바일 80% touch target 검증

진산 발화 (2026-05-13 Session 071): "클로드디자인 이라는 최근 출시된 디자인전문 ai를 활용해서 디자인 설계를 외주 용역을 주고.. 원하는 결과를 받아서 적용하는 것은 어떨지 검토."

본 ADR은 PITR 3안 비교 → 하이브리드 채택 근거 영속.

---

## 결정 (Decision)

**Step 3-UX-6 디자인 단계는 하이브리드 외주 채택**:

1. **시각 3안 (A/B/C) + moodboard만 Claude Design에 의뢰** (`docs/design/rfp-step-3-ux-6.md`)
2. **진산이 lock 결정** (A/B/C 중 선택 또는 "A 기본 + C의 X 요소" 같이 조합)
3. **Claude Code가 도메인 통합 + Tailwind/React 코드화** (Step 3-UX-6b/c/d 본격 진행)
4. **AESTHETIC.md (`docs/design/AESTHETIC.md`)는 인하우스 영속 + 누적 갱신**

---

## 대안 비교 (PITR)

| 안                                                    | 방식                                                        | 장점                                                                                                                     | 단점 / 리스크                                                                                                                  | 채택 여부 |
| :---------------------------------------------------- | :---------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------- | :-------: |
| **A. 인하우스 (Claude Code 직접)**                    | Claude Code가 AESTHETIC.md 3안 + 코드 동시 작성             | 컨텍스트 유지, AESTHETIC.md/Phase 2 baseline 직접 참조, 도메인 깊이 (4 input type, FSRS, Graph RAG) 이해, 토큰 정합 보장 | "AI 평균" 수렴 위험, 디자인 풍부도 한계                                                                                        |    ❌     |
| **B. 외주 (Claude Design RFP) 전량**                  | RFP → Claude Design 3안 + 코드 → 진산 lock                  | 전문 디자인 AI 출력, 인하우스 평균 수렴 회피                                                                             | 도메인 결핍 (4 input type/FSRS/mode 외부 AI 이해 결핍), 출력 형식 미지, 토큰 준수 미지, 기존 Phase 2 baseline 일관성 깨질 위험 |    ❌     |
| **C. 하이브리드 (시각만 외주, 도메인+코드 인하우스)** | Claude Design에 시각 3안 + moodboard만 → Claude Code가 통합 | 외부 AI 풍부도 + 인하우스 도메인 깊이, RFP scope 좁아 평가/통합 용이, 진산 lock 갈림길 명확                              | RFP 2번 round-trip 가능성, Claude Design 결과가 ThePick Phase 2 일관성 따르도록 RFP 가이드 의무                                |    ✅     |

---

## 채택 근거 (안 C)

1. **이미 lock된 design tokens 존재** — Phase 2 QuestionCard.tsx 본 코드베이스에 `Linear-style 1단 카드 + Indigo 600 + Gray 9단 + rx=8 + Pretendard` 진산 lock. Step 3-UX-6은 greenfield가 아닌 **incremental** (새 5개 컴포넌트가 기존 일관성 안에서 추가). 전량 외주는 일관성 깨질 위험.

2. **도메인 특수성** — ModeSelector는 단순 카드 4개가 아니라 `warmup/main/cooldown/review_weak` mode 의미 + FSRS weak_score 시각화 + streak 표현 필요. Claude Design에 ThePick 도메인 RFP 깊이 쓰는 비용 ≥ 인하우스 직접 작성 비용. 시각 영감만 외주 → 비용 효율 ↑.

3. **출력 형식 매칭 비용** — Claude Design 출력이 Figma/이미지면 Tailwind/React 코드화에 추가 라운드. 시각 3안만 받으면 Claude Code가 빠르게 코드화 — round-trip 절약.

---

## 영향 (Consequences)

### 1. 산출물 영속

| 산출물                     | 경로                                                                     | 책임                         |
| :------------------------- | :----------------------------------------------------------------------- | :--------------------------- |
| RFP (Claude Design 의뢰서) | `docs/design/rfp-step-3-ux-6.md`                                         | Claude Code 작성, 진산 제출  |
| 프로젝트 AESTHETIC.md      | `docs/design/AESTHETIC.md`                                               | Claude Code 작성 + 누적 갱신 |
| Claude Design 응답 (3안)   | `docs/design/responses/step-3-ux-6-{A,B,C}/` (미생성, 진산 수령 시 영속) | 진산 영속                    |
| 진산 lock 결정             | `docs/design/responses/step-3-ux-6-LOCK.md` (미생성, lock 시 영속)       | 진산 + Claude Code           |

### 2. 통합 워크플로우

```
[1] Claude Code: RFP (docs/design/rfp-step-3-ux-6.md) 영속 ← ★ 본 ADR 시점 (Session 071)
[2] 진산: Claude Design에 RFP 본문 제출
[3] 진산: Claude Design 응답 3안 (A/B/C) 수령
[4] 진산: docs/design/responses/step-3-ux-6-{A,B,C}/ 영속
[5] 진산: lock 결정 (A/B/C 단독 또는 조합) → docs/design/responses/step-3-ux-6-LOCK.md
[6] Claude Code: lock된 안 → Tailwind/React 코드화 (Step 3-UX-6b/c/d 진입)
[7] Claude Code: AESTHETIC.md 갱신 (lock 시 발견된 신규 토큰/패턴 누적)
[8] 4-Pass + 5-페르소나 부채 리뷰 (Step 3-UX-6e)
```

### 3. 게이트

- [ ] 진산 Claude Design 응답 수령 + LOCK 결정 영속 (`docs/design/responses/step-3-ux-6-LOCK.md`)
- [ ] LOCK 시 위반 안티패턴 0건 검증 (`docs/design/AESTHETIC.md` §4 안티패턴 체크리스트)
- [ ] LOCK 시 §2 토큰 준수 검증 (Indigo 600 / Gray 9단 / rx=8/12 / Pretendard / max-w-[1280px])
- [ ] LOCK 후 Step 3-UX-6b 진입 (4 input type 컴포넌트 분기)

### 4. carry-over

- **lock 미수령 시 Phase 3 학습 UX UI 본격 진입 차단**. handoff-082 또는 다음 Session에서 진산 응답 수령 시 즉시 재진입.
- Phase 3 종료 후 본 하이브리드 워크플로우 후평가 (lock 응답 품질 / 통합 비용 / 시간 → handoff에 누적 평가 영속)
- Year 2 (공인중개사 확장 등) 다른 시험 도메인 학습 UX 시 본 하이브리드 패턴 재사용 검토 (RFP `docs/design/rfp-*.md` 누적)

### 5. 위험 / 미해소 사항

- **Claude Design 출력 형식 미지** (PNG/Figma/HTML/Tailwind 중 무엇인지). 진산 첫 응답 수령 시 명확화. 본 RFP는 PNG mockup + Tailwind 힌트로 명시 요청.
- **Claude Design 한국어 컨텍스트 처리 미검증**. RFP를 한국어로 제출하므로 한글 마이크로카피 톤 (평서체 짧게, 격려성 늘림 금지) 준수 미지.
- **Claude Design이 진산 AESTHETIC.md (Linear/Craft 레퍼런스, 1페이지 1강조색)를 얼마나 정확히 반영할지 미지**. RFP §2~§4에 명시했으나 응답 평가 시 강하게 점검 의무.

---

## 관련 문서

- **글로벌 AESTHETIC.md**: `~/.claude/AESTHETIC.md` (모든 디자인 작업 선행 읽기 의무)
- **프로젝트 AESTHETIC.md**: `docs/design/AESTHETIC.md` (본 ADR 동시 영속)
- **RFP**: `docs/design/rfp-step-3-ux-6.md` (본 ADR 동시 영속)
- **Plan**: `docs/plans/phase3-learning-ux-modes.plan.md` §10 Step 3-UX-6 정합
- **Memory**: `project_ux_north_star_phase3.md` (Phase 3 진입 시점 학습 UX 북극성)

---

## 결정 책임

본 ADR는 다음 결정만 lock한다:

- ✅ Step 3-UX-6 디자인 단계 하이브리드 외주 (시각만 외주, 도메인 + 코드 인하우스)
- ✅ RFP는 Claude Code 작성, 진산이 Claude Design에 제출
- ✅ AESTHETIC.md (프로젝트)는 인하우스 누적 갱신

다음 결정은 lock하지 않음 (carry-over):

- ❌ 향후 다른 Step (3-UX-7 distractor 등)이나 다른 도메인의 디자인 외주 전략 (별도 ADR 또는 plan에서 결정)
- ❌ Claude Design 응답 수령 후 A/B/C 중 어느 안 lock (진산 lock 시 별도 LOCK 문서)
