-- ============================================================
-- Migration 0042: Revision Watch Phase 1 — GAP-RW-4 트리거 지뢰 수정 (draft SUPERSEDES 게이트)
-- ============================================================
-- STATUS: 선작성본 (formal sign-off 대기) — §9 Q2 위임 결재(2026-07-07) = A안 + 승격시 flip 동반 트리거.
--   production 적용 = 진산 인증 게이트 별도.
-- 정책 출처: docs/plans/revision-watch.plan.md §3-C C-1 (rev2 확증: A 단독 불완전 — 2단 트리거 필수)
--
-- 지뢰(수정 전 0013:101-108): SUPERSEDES 엣지 INSERT 즉시 old 노드 비활성화 — superseder 가
--   draft 여도. 즉 AI draft 개정 반영이 approved production 노드를 즉사시킴 ("draft-only" 정면충돌).
--
-- 수정 = 2단 트리거:
--   [1] mav_supersedes_knowledge_nodes_deactivate 재구축 — superseder 의 "실 status" 가
--       approved 일 때만 old 비활성화. ★실 status 도출 = APPROVED_NODES_STATUS_CORE
--       (apps/api/src/search/approved-nodes-sql.ts — 단일 진실원) 미러:
--       최신 status_transitions.to_status, 전이 무이력 = 'draft' (knowledge_nodes.status
--       스냅샷은 신뢰하지 않음 — 0018 draft 고정 + 0016 status UPDATE ABORT 로 영구 동결이므로).
--   [2] mav_promotion_flip_superseded_nodes 신설 — draft 시절 걸어둔 SUPERSEDES 엣지는
--       [1]에서 발화하지 않으므로, 승격(status_transitions INSERT to_status='approved') 시점에
--       그 노드가 가진 활성 SUPERSEDES 엣지의 old 노드들을 비활성화. WHERE is_current_active=1
--       = idempotency 가드(0013 원본 선례 — 중복 flip 무해).
--
-- 의미론(문서화): 승격 flip 은 직접 엣지 1-hop 만 — 다중홉 체인(A sup B sup C)에서 A 승격은
--   B 만 비활성화(C 는 B 승격 시점에 이미/별도 처리). 테스트가 이 의미론을 고정.
-- ★타이 결정성(독립 리뷰 wf_83d2aa9a MAJOR 반영): 동일 transitioned_at 타이에서 트리거·검색
--   게이트가 정반대 행을 선택하는 발산이 실증됨 → 전 도출 지점(본 트리거·approved-nodes-sql
--   CORE·state-machine·batch)에 `rowid DESC` 타이브레이커 동시 도입("동시각 = 삽입순 최후 승").
-- ★백데이트 게이트(동 리뷰 MAJOR): [2] 는 "INSERT 이벤트 = 최신"을 가정하지 않는다 — 과거
--   시각으로 backdate 된 approved INSERT 는 실 최신 status 재도출로 걸러낸다.
-- 스코프 아님(알려진 한계 — §10 후속 원장): ① formulas/constants 의 동일 클래스 지뢰
--   (0014 무조건 supersede-deactivate — E0-2 에서 nodes 폭발 전력 실재. 후속 마이그 0043 후보,
--   그 전까지 formulas/constants 적재에 superseded_by 사용 금지) ② 강등(approved→flagged)
--   경로 — 승격 flip 후 superseder 강등 시 계보 서빙 공백(복원 자동화 = 정책 결재 사안,
--   무결성 러너 불변식 추가 후속) ③ knowledge_edges UPDATE/DELETE 가드 = WS-2b 슬롯 0039 별건.
-- ============================================================

-- ---------- [1] SUPERSEDES INSERT 게이트: superseder 실 status = approved 일 때만 ----------
DROP TRIGGER IF EXISTS mav_supersedes_knowledge_nodes_deactivate;
CREATE TRIGGER mav_supersedes_knowledge_nodes_deactivate
AFTER INSERT ON knowledge_edges
WHEN NEW.edge_type = 'SUPERSEDES'
  AND NEW.is_active = 1
  AND COALESCE(
        (SELECT st.to_status
           FROM status_transitions st
          WHERE st.target_type = 'node' AND st.target_id = NEW.from_node
          ORDER BY st.transitioned_at DESC, st.rowid DESC
          LIMIT 1),
        'draft') = 'approved'
BEGIN
  UPDATE knowledge_nodes
    SET is_current_active = 0
    WHERE id = NEW.to_node AND is_current_active = 1;
END;

-- ---------- [2] 승격 동반 flip: draft 시절 SUPERSEDES 엣지의 지연 발화 ----------
-- DROP 선행 = [1]과 대칭(재적용 시 구본 무음 잔존 차단). 실 최신 재도출 = 백데이트 INSERT 무발화.
DROP TRIGGER IF EXISTS mav_promotion_flip_superseded_nodes;
CREATE TRIGGER mav_promotion_flip_superseded_nodes
AFTER INSERT ON status_transitions
WHEN NEW.target_type = 'node' AND NEW.to_status = 'approved'
  AND COALESCE(
        (SELECT st.to_status
           FROM status_transitions st
          WHERE st.target_type = 'node' AND st.target_id = NEW.target_id
          ORDER BY st.transitioned_at DESC, st.rowid DESC
          LIMIT 1),
        'draft') = 'approved'
BEGIN
  UPDATE knowledge_nodes
    SET is_current_active = 0
    WHERE is_current_active = 1
      AND id IN (
        SELECT ke.to_node
          FROM knowledge_edges ke
         WHERE ke.from_node = NEW.target_id
           AND ke.edge_type = 'SUPERSEDES'
           AND ke.is_active = 1
      );
END;

-- ============================================================
-- 롤백 (비상시 수동): [1] 을 0013 원본으로 재적용 + DROP TRIGGER mav_promotion_flip_superseded_nodes.
--   ⚠️ 롤백 = 지뢰 복원(draft 즉사 경로 재개방) — 비상 외 금지.
-- ============================================================
