# Decision Note — CHA-03 / CHA-05 P0 → P1 재분류

**작성일**: 2026-05-02
**작성자**: Claude (Opus 4.7 1M context) — Session 029
**효력**: 즉시 (Sprint 1 종료 게이트 17/17 → 15/15)
**근거 문서**:

- `.claude/reviews/review-sprint0-baseline-20260501-230231.md` §2.2, §3.1, §5.3
- `.jjokjipge/handoff-session-029.md` §3.1 (권고 A)
- `docs/ThePick Engine Quality Test Master Plan v1.0.md` §11.1 / §11.2
- 메모리 `project_batch_load_workflow` (BATCH 적재 = Claude Code 직접 처리)
- 메모리 `feedback_no_shortcuts` (땜빵 금지 — 측정 불가 시나리오를 P0 유지 = 게이트 거짓 통과 위험)

---

## 1. 결정 요약

| 시나리오   | 종전 분류 | 신 분류 | 진입 시점 게이트                                   |
| :--------- | :-------: | :-----: | :------------------------------------------------- |
| **CHA-03** |    P0     |   P1    | Phase 2 진입 직전 (BATCH-1 적재 후 사용자 노출 전) |
| **CHA-05** |    P0     |   P1    | Phase 2 진입 직전 (hybrid-search 활성 시점)        |

**Sprint 1 종료 게이트**: P0 17/17 PASS → **P0 15/15 PASS**.
**P1 게이트 건수**: 18 → **20** (CHA-03/05 합류).

---

## 2. 재분류 근거

### 2.1 CHA-03 — Anthropic API 5xx → exponential backoff

**증거 위치**: `packages/ai-adapter/src/anthropic-adapter.ts:62-77`

```typescript
async sendMessage(_req: AIMessageRequest): Promise<AIMessageResponse> {
  throw new AIAdapterError(
    `AnthropicAdapter.sendMessage not yet implemented (model=${this.modelDefault}, baseUrl=${this.config.baseUrl}). Phase 3 운영 RAG 진입 시점 본격 구현 예정. Year 1 BATCH 적재는 Claude Code (Opus 4.7) 직접 처리이므로 본 어댑터 미경유.`,
    'NOT_IMPLEMENTED',
  );
}
```

**핵심 사실**:

1. **Year 1 BATCH-1 적재는 본 어댑터 미경유** — 메모리 `project_batch_load_workflow` 정합. 진산님이 Claude Code (Opus 4.7) 로 직접 BATCH 적재 처리하므로 Anthropic API 호출 경로 부재.
2. **본 어댑터 자체가 NOT_IMPLEMENTED throw** — sendMessage / sendVision 모두 즉시 throw. 따라서 retry / backoff 로직이 존재하지 않음 (테스트 불가능 상태).
3. **CHA-03 시나리오의 의의는 Phase 2 진입 직전 (사용자 노출 = 운영 RAG 활성)** — 사용자 추론 호출 시점에 5xx 폭주 / linear backoff 위험이 비로소 발생.

**P0 유지 시 발생하는 거짓 통과 위험**:

- 본 어댑터를 사용하지 않는 BATCH-1 진입 게이트에서 "측정 불가능한 항목" 을 PASS 로 위장하면 v1.1 §10.7 "검증되지 않은 영역" 정직화 정책 위반.
- 또는 형식만의 mock 테스트로 "PASS" 마킹하면 미래의 자기 자신을 속이는 결과.

**P1 재분류 시 게이트 책임**:

- Phase 2 진입 직전 (BATCH-1 적재 후 → 사용자 노출 전) 에 본격 구현 + 측정 의무 (Sprint 2 또는 별도 sprint 트리거).
- 의무 구현 항목: retry 로직 (exponential backoff with jitter) / cost-meter 연동 / Anthropic 콘솔 cap 정합 / 5xx 폭주 시 graceful degradation.

### 2.2 CHA-05 — Vectorize timeout 2초 fallback

**증거 위치**: `apps/api/src/search/` (hybrid-search 자체가 Phase 1 후반 활성)

**핵심 사실**:

1. **hybrid-search 가 Phase 1 후반 활성 예정** — BATCH-1 적재 완료 후 구조화 데이터 → Vectorize 업서트 → hybrid-search 본격 작동.
2. **현재 시점에서 Vectorize binding 실제 호출 경로 부재** — admin-web / batch / api 모두 Vectorize 직접 사용 미존재.
3. **2초 timeout fallback 시나리오는 사용자 노출 시점에 비로소 의미** — BATCH-1 진입 직전은 데이터 적재 단계로 fallback 요건 부재.

**P0 유지 시 거짓 통과 위험**:

- hybrid-search 자체가 부재한 상태에서 "PASS" 마킹은 형식만의 통과.
- Vectorize binding mock 으로 시뮬레이션하더라도 실제 운영 시점의 timeout 동작과 정합하지 않음.

**P1 재분류 시 게이트 책임**:

- hybrid-search 활성 직전 (Phase 1 후반 → Phase 2 진입) 에 본격 측정 + 검증 의무.
- 의무 구현 항목: 2초 timeout 분류 / fallback (FTS5 단독 모드) / 사용자 안내 UX / 운영 알람 발동.

---

## 3. 효력 영향

### 3.1 Sprint 1 종료 게이트 (handoff-028 §2.D / handoff-029 §1)

```
변경 전: P0 17/17 PASS + Critical 0건 + verify-engine-contracts.ts Cat 5 부분 자동화
변경 후: P0 15/15 PASS + Critical 0건 + verify-engine-contracts.ts Cat 5 부분 자동화
```

**나머지 15건 (Sprint 1 GREEN 대상)**:

- CHA: 4건 (CHA-01 / CHA-02 / CHA-04 / CHA-06)
- FUZ: 3건 (FUZ-01 / FUZ-02 / FUZ-04)
- PRF: 2건 (PRF-01 / PRF-02)
- REG: 2건 (REG-01 / REG-02) ← 이미 PASS
- PRC: 2건 (PRC-01 / PRC-02) ← PRC-02 이미 PASS
- REC: 2건 (REC-01 / REC-02)

### 3.2 P1 게이트 (BATCH-1 적재 후 사용자 노출 전)

- 종전 18건 → **신 20건**.
- 추가 2건 (CHA-03 / CHA-05) 의 진입 시점 명세는 본 결정 §2.1 / §2.2 의 "P1 재분류 시 게이트 책임" 정합.

### 3.3 v1.1 §10.7 검증되지 않은 영역 (별도 갱신)

`docs/ENGINE_HARDENING_COMPLETION_REPORT.md` v1.1 §10.7 에 다음 항목이 본 결정 직후 추가됨 (handoff-029 §3.2 권고 A 정합 — Sprint 1 §5.4 완료 후 v1.2 일괄 갱신):

- **항목 #16 (신규)**: anthropic-adapter sendMessage / sendVision NOT_IMPLEMENTED throw → CHA-03 측정 불가 → P1 재분류.
- **항목 #17 (신규)**: hybrid-search Phase 1 후반 활성 → CHA-05 측정 불가 → P1 재분류.

### 3.4 ENGINE_HARDENING_COMPLETION_REPORT v1.1 → v1.2 갱신 시점

handoff-029 §3.2 권고 A 정합. **Sprint 1 §5.4 완료 후 일괄 갱신** (현 시점 미진행). 다만 본 결정 문서 자체는 v1.2 갱신과 무관하게 즉시 효력 (§5.2 진입 의 게이트 단순화 효과를 즉시 발휘).

---

## 4. 본 결정으로 차단되는 위험

1. **거짓 통과 (false PASS)**: NOT_IMPLEMENTED 어댑터를 형식 mock 으로 "측정 완료" 처리하는 자기기만 차단.
2. **순서 역전**: BATCH-1 진입 (=> 데이터 적재 단계) 게이트에 사용자 노출 시점 시나리오 (=> Phase 2) 강제 → Sprint 1 일정 비현실 이월 위험 차단.
3. **메모리 정합성 위배**: `project_batch_load_workflow` 가 명시한 "Claude Code 직접 처리" 정책과 모순되는 어댑터 구현 강제 차단.
4. **§5.2 도구 정비 작업량 1/3 감소**: MSW Anthropic mock 우선순위 강등 가능 (CHA-03 P1 진입 직전 의무 → Sprint 2 또는 별도 sprint 로 일정 분산).

---

## 5. 본 결정으로 발생하는 후속 의무

### 5.1 즉시 (본 세션 029 의무)

- [x] 본 결정 문서 작성 (현재 파일).
- [ ] `docs/ThePick Engine Quality Test Master Plan v1.0.md` §11.1 / §11.2 갱신.
- [ ] `.claude/reviews/review-sprint0-baseline-20260501-230231.md` 상단 banner 추가.
- [ ] §5.2 도구 정비 진입 (MSW Anthropic mock 우선순위는 P1 의무 → 즉시 구현 또는 stub 만 둠).

### 5.2 Sprint 1 §5.4 완료 후 (별도 commit)

- [ ] `docs/ENGINE_HARDENING_COMPLETION_REPORT.md` v1.1 → v1.2 갱신:
  - §10.7 항목 #16 (anthropic-adapter NOT_IMPL) + 항목 #17 (hybrid-search 미활성) 신규.
  - §0 Executive Summary "naive DFS 임계 노드 수 미검증" → "✅ Sprint 1 §5.1 흡수 (commit 1c54a85 / b587bdc)".
  - §14 결론 갱신 (P0 17 → 15 + P1 18 → 20).

### 5.3 Phase 2 진입 직전 (BATCH-1 적재 후 사용자 노출 전)

- [ ] CHA-03 본격 구현 (anthropic-adapter retry / backoff / cost-meter 연동) + 측정 PASS 의무.
- [ ] CHA-05 hybrid-search 활성 + Vectorize timeout fallback 측정 PASS 의무.
- [ ] P1 게이트 20/20 PASS 종료 조건.

---

## 6. 진산님 검증 가능 항목

본 결정의 정직성을 검증하려면 다음을 확인:

1. **anthropic-adapter NOT_IMPLEMENTED 사실 검증**:
   ```bash
   grep -n "NOT_IMPLEMENTED" packages/ai-adapter/src/anthropic-adapter.ts
   ```
2. **hybrid-search 부재 검증**:
   ```bash
   grep -rn "hybrid-search\|Vectorize" apps/api/src/ packages/ | head
   ```
3. **메모리 정합 검증**: 메모리 `project_batch_load_workflow` 본문 확인.

---

**결정 효력 시점**: 2026-05-02 09:00 KST (Session 029 진입 직후)
**다음 검토 시점**: Phase 2 진입 직전 (CHA-03 / CHA-05 본격 구현 + P1 게이트 평가)
**본 결정 변경 트리거**: 진산님 명시 reverse 지시 또는 Phase 2 진입 시 추가 위험 발견
