# Review — W3 Revision Watch L3 plan (독립 2렌즈 + 적대 검증)

- **대상**: `docs/plans/revision-watch.plan.md` (신규 L3 설계 plan, W3)
- **일시**: 2026-07-05 17:09
- **방식**: Workflow `wf_eca982ec-69d` — 2 렌즈(FACT-CHECK 환각사냥 + ADVERSARIAL 설계비평) 병렬 → **발견별 독립 적대 검증**(REFUTED 기본값) = **10 에이전트**. 자가 리뷰 금지(auto-review-protocol 규칙 0) 준수.
- **결과**: **raw 8 / survived 8 / refuted 0** (MAJOR 3 · MINOR 5). 전건 rev2 반영 완료.
- **선행**: 자산 실사 Workflow `wf_d0871ca3-e03`(survey 5축·585K tok·0에러) = plan 근거.

## 판정 요약

| #   | Sev             | category                              | 상태      | 반영                       |
| :-- | :-------------- | :------------------------------------ | :-------- | :------------------------- |
| F1  | **MAJOR** (C→M) | correctness-blocker-fix-incomplete    | CONFIRMED | §3-C-1·§5-D·§4·§6-G2·§9-Q2 |
| F2  | **MAJOR**       | false-single-filter-point             | CONFIRMED | §3-A-2·§6-G1               |
| F3  | **MAJOR**       | internal-contradiction (C-3↔B)        | CONFIRMED | §3-C-3·§5-D·§9-Q2          |
| F4  | MINOR           | inverted-citation (G-RW-6c)           | CONFIRMED | §2-G6c                     |
| F5  | MINOR           | numeric-error (R2 CROSS_REF)          | CONFIRMED | §1.1 (26→19)               |
| F6  | MINOR           | citation-attribution (ContentQueue)   | CONFIRMED | §1.3                       |
| F7  | MINOR (M→m)     | L3-autonomy-mislabel (Phase 4)        | CONFIRMED | §8 (👤→🤖)                 |
| F8  | MINOR (PARTIAL) | gap-characterization / §10 carry-over | PARTIAL   | §10 (선재 carry-over)      |

## MAJOR 상세

### F1 — G-RW-4 지뢰 수정 A안 불완전 (핵심)

- **결함**: C-1 §5-D A안(mav_supersedes 트리거를 superseder `status='approved'` 게이트)은 **불완전**.
  - (1) `knowledge_nodes.status`는 INSERT 스냅샷(0018 draft 고정 + 0013 body UPDATE ABORT) → 실 status(status_transitions 최신) 못 읽음 → WHEN 게이트 **영원히 미통과** (approved-nodes-sql.ts:37-39).
  - (2) 승격 draft→approved = status_transitions INSERT일 뿐 **엣지 재INSERT 아님** → AFTER INSERT ON knowledge_edges 트리거 재발화 없음 → old 노드 **영구 활성** = 이중 active 위반 (0013:101-108이 유일 노드 비활성화 경로, status_transitions 트리거는 is_current_active 미접촉).
- **검증**: measure-runner.test.ts:66-83(승격=status_transitions INSERT)·approved-nodes-sql.ts:44-53(ROW_NUMBER 최신 status)로 재확증. CRITICAL→MAJOR(DRAFT plan·§9 Q2 미결·B안 병존).
- **반영**: 동반 트리거 명세 추가 = `AFTER INSERT ON status_transitions WHEN to_status='approved' AND target_type='node' → SUPERSEDES lookup flip`. §6 G-RW-2를 2단(승격 후 flip + 이중 active 0) 검증으로 확장. §9 Q2에 "A 단독 불완전" 명시.

### F2 — "단일 필터점 = approved-nodes-sql.ts" 거짓

- **결함**: §3-A-2가 미시행 노드 배제를 approved-nodes-sql 단일점으로 주장하나, 학습자 경로 누출 2건:
  - `study/routes.ts:579-582` enrichRelatedNodes = `is_current_active=1`만 필터(status·valid_from 무) → GET /next(:1001)·POST /grade(:1149) sourceCitation에 **미시행 법령 노드 이름/페이지 노출**.
  - `vectorize/routes.ts:329-333` = 전 노드 임베딩 → 미시행 노드 후보화.
  - G-RW-1이 approved-nodes-sql만 테스트 → **게이트 PASS인데 누출 잔존**.
- **반영**: §3-A-2에 전 read 경로 3종 열거 + 각 valid_from 게이트. G-RW-1을 study/grade 경로 포함으로 확장.

### F3 — C-3 ↔ §5-D B안 트리거 충돌

- **결함**: C-3(prevent_knowledge_edges_update)가 B안(승격시 edge status UPDATE)을 ABORT → Q2=B 선택 시 B **구현 불가**. plan은 A/B를 등가("둘 다 지뢰 해소")로 오표기.
- **검증**: 0013:64-70(is_current_active WHEN OLD=NEW 화이트리스트 선례) = B가 필요로 하는 carve-out. 0013 헤더가 동일 충돌클래스(P-C3) 기해결 기록.
- **반영**: §3-C-3에 B안 화이트리스트 필요 명시. §5-D·§9 Q2에 A/B 비용 상이 표기.

## MINOR (전건 반영)

- **F4/F8**: §2 G-RW-6c 재타깃 — 진짜 드리프트 = `SEARCH_PIPELINE.md §4` / `ADR-012`(없는 knowledge_nodes.valid_from 가정), user-search.ts:490-492는 교정 주석. §10에 선재 carry-over(phase2a §2.2/handoff-067) 참조 추가.
- **F5**: §1.1 R2 CROSS_REF `26→19`(26=노드 수 혼동, batch-loadmap.md:78).
- **F6**: §1.3 "BATCH 1 후 API 연동 예정" 인용 = `pages/index.astro:40` 재귀속(ContentQueue.tsx는 props-only 미배선=사실).
- **F7**: §8 Phase 4 = 👤→🤖 (revision_review_queue CREATE TABLE=L3 결재 후 / 배선·telemetry만 🤖).

## 메타

- 적대 검증이 **예상 지뢰(F1)를 확증 + 심화**(스냅샷 status 동결 = 처음 설계 시 미인지) → 독립 리뷰 프로토콜 유효 재입증.
- 잔여 CRITICAL 0 → plan은 §9 진산 결재 상신 가능 상태(코드·SQL 착수는 결재 후·자율 금지).
