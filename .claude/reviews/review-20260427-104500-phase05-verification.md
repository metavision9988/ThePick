# Phase 0.5 — CRITICAL 7건 정정 재검증

**리뷰 방식: 독립 에이전트 (general-purpose) 단독 검증**

작성일: 2026-04-27 KST
대상: Phase 0.5 5 commit (`457d90b` ~ `d2e4bf5`)

선행: review-20260426-233916-phase0-4pass.md (CRITICAL 7 발견)

---

## 종합 판정

```
재검증 결과: 1차 6/7 PASS (C-1 부분 잔존) → 보강 commit (d2e4bf5) → 7/7 PASS
판정: ✅ Phase 0 + 0.5 "완료" 가능 — CRITICAL 0건
```

---

## CRITICAL 별 정정 검증

| #   | 발견                                      | 정정 commit              | 검증                                                                       |
| :-- | :---------------------------------------- | :----------------------- | :------------------------------------------------------------------------- |
| C-1 | prevent_X_update 화이트리스트 우회        | 457d90b + d2e4bf5 (보강) | ✅ PASS — 14/12/16 컬럼 IS NOT 화이트리스트 + constants.superseded_by 보강 |
| C-2 | DELETE 트리거 부재                        | 457d90b                  | ✅ PASS — 3 트리거 등재                                                    |
| C-3 | formulas/constants SUPERSEDES 트리거 부재 | 457d90b                  | ✅ PASS — ALTER + mav\_\*\_supersedes_deactivate + 자기참조 차단           |
| C-4 | ADR-013 column drift                      | 349fef9                  | ✅ PASS — `relation` 0건, `edge_type` 정합                                 |
| C-5 | SUPERSEDES 1단계 순환 가드                | 457d90b                  | ✅ PASS — prevent_supersedes_reverse_cycle + self                          |
| C-6 | ai-adapter unit test 부재                 | 95712c1                  | ✅ PASS — pnpm test 13/13                                                  |
| C-7 | reviewer_id 인증 / AI 자동 채택           | 457d90b                  | ✅ PASS — 시스템 prefix 차단 + AI silent adoption 차단                     |

## 1차 검증 잔존 (즉시 정정)

**C-1 부분 잔존**: constants 트리거에 `superseded_by` 컬럼 IS NOT 비교 누락 → `UPDATE constants SET superseded_by='X'` 통과 → SUPERSEDES 체인 위조 가능.

**정정**: d2e4bf5 — 1줄 추가 (`OR NEW.superseded_by IS NOT OLD.superseded_by`).

**T10 검증**: `UPDATE constants SET superseded_by='C-B' WHERE id='C-A'` → ABORT 확인.

---

## 검증 시나리오 종합 (T1~T10 모두 PASS)

| T   | 시나리오                                       | 결과          |
| :-- | :--------------------------------------------- | :------------ |
| T1  | knowledge_nodes UPDATE 본문 + active flip 동시 | ABORT         |
| T2  | knowledge_nodes active flip 단독               | 통과          |
| T3  | knowledge_nodes DELETE                         | ABORT         |
| T4  | formulas SUPERSEDES 자동 비활성화              | old=0 / new=1 |
| T5  | constants SUPERSEDES 자동 비활성화             | old=0 / new=1 |
| T6  | SUPERSEDES 역방향 순환 INSERT                  | ABORT         |
| T7  | reviewer_id='system' INSERT                    | ABORT         |
| T8  | AI 추천 == decision_type, rationale 부재       | ABORT         |
| T9  | 인간 검증 rationale (≥10)                      | 통과          |
| T10 | constants.superseded_by UPDATE                 | ABORT         |

추가:

- sqlite3 dry-run 0001~0014 — 0 error
- ai-adapter pnpm test — 13/13 passed (303ms)

---

## MAJOR 7건 (Phase 1 초기 이월)

| #   | 발견                                                | 우선순위                             |
| :-- | :-------------------------------------------------- | :----------------------------------- |
| M-1 | references_decision_id 자기 참조 차단               | Phase 1 초기                         |
| M-2 | ai_recommendation/ai_confidence pair CHECK          | Phase 1 초기                         |
| M-3 | rollback_deadline 형식 검증                         | Phase 1 초기                         |
| M-4 | ontology-registry SoT 분열                          | Phase 1 초기 (NodeType 추가 시 사고) |
| M-5 | describe() Object.freeze 반복                       | Phase 1 후반                         |
| M-6 | review_decisions ↔ status_transitions 책임 경계 ADR | Phase 1 초기                         |
| M-7 | SUPERSEDES 다중 체인 회귀 테스트                    | Phase 1 초기                         |

→ docs/plans/current.plan.md 또는 별도 backlog 에 명시 이월. BATCH-1 진입 차단 아님.

---

## 결론

**Phase 0 + 0.5 종결 (총 11 commit)**:

- c5f82d1 / b38120d / 60676cf / 468ae88 / 6bde63f / 6ff9241 (Phase 0)
- 457d90b / 349fef9 / 95712c1 / 0135ce1 / d2e4bf5 (Phase 0.5)

CRITICAL 0건. MAJOR 7건 Phase 1 명시 이월. **BATCH-1 dry-run 진입 가능**.

진산님 명시 트리거 ("BATCH-1 적재" / "다음 배치 적재" / "계속 적재") 시 docs/plans/batch-loadmap.md 의 BATCH-1 (p.403~434, 32p, 적과전 종합위험, 60 노드 / 200 엣지 / 13 산식) 자동 진입.
