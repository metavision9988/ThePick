-- ============================================================
-- Migration 0039: knowledge_edges UPDATE/DELETE 가드 + knowledge_nodes 부활(0→1) 차단
-- ============================================================
-- STATUS: 선작성본 — **production 적용(wrangler --remote) 미승인**.
--   승인 범위 = SQL 작성·로컬 검증까지 (진산 2026-08-06 "0·1단계 진행").
--   집행 승인 = ws-2b plan §8 마지막 행 = 여전히 대기 (TR-0/0038 선례 절차).
--
-- plan   : docs/plans/ws-2b-knowledge-edges-guard.plan.md (D-1=A안 · D-2=(a) ABORT · Amendment 2026-08-06)
-- 근거   : docs/plans/catchall-역이식-분석-20260806.md §3-C
--          docs/plans/catchall-역이식-체크리스트.md STAGE 1 (1-1·1-2)
-- 카드   : docs/plans/master-remediation-20260610/decision-card-3-knowledge-edges-guard.md ((a) 채택)
--
-- ── 왜 필요한가 (실측) ────────────────────────────────────────────────────────
-- ① knowledge_edges = production 보호 체계의 **마지막 무가드 테이블**.
--    `BEFORE DELETE` 가드는 knowledge_nodes/formulas/constants(0014) · status_transitions(0010) ·
--    review_decisions(0013) · engine_telemetry(0017) 에 있는데 **knowledge_edges 에만 없다**.
--    현 엣지 1,347개가 DELETE·본문 UPDATE 무방비다.
-- ② knowledge_nodes 의 `is_current_active` 는 **어느 UPDATE 가드 WHEN 절에도 열거돼 있지 않다**
--    (0014 → 0019 → 0041 재구축 전수 확인). 설계 의도는 "은퇴 플립(1→0)만 허용"이었으나
--    실제로는 **부활(0→1)도 자유 통과**한다. 즉 개정으로 은퇴시킨 구본이 UPDATE 한 줄로 되살아나
--    학습자에게 옛 기준이 다시 서빙될 수 있다.
--    0013:58-60 이 *"방어: application 레이어 강제"* 라고 자인해 둔 지점 = 부탁이지 기계강제가 아니었다.
--
-- ── 설계 (A안: 컬럼별 IS NOT 화이트리스트) ────────────────────────────────────
-- 엣지 UPDATE: `is_active` 플립 **한 가지만** 허용. 그 외 7컬럼(id/from_node/to_node/
--   edge_type/condition/priority/created_at) 변경은 전부 ABORT (D-2 = (a) — condition·priority 도 차단).
--   → E0-2 류 그래프 수리(stale 엣지 비활성화)와 Track B 고아 수리(INSERT-only)는 그대로 살아 있다.
-- 엣지 DELETE: 전면 ABORT. 감사 이력 보존 = Temporal Graph 의 기본 계약.
-- 노드 부활 : `OLD.is_current_active = 0 AND NEW.is_current_active = 1` 만 정확히 겨냥한 **별도**
--   트리거로 차단. 0041 트리거를 DROP/재생성하지 않는다 — 재생성은 그 자체가 회귀 표면이고,
--   본 조건은 직교라 독립 트리거가 더 안전하다(최소 변경 원칙).
--
-- ★ 신규 컬럼 추가 시 의무: knowledge_edges 에 컬럼을 추가하면 아래 WHEN 절에 **반드시 등재**한다.
--   미등재 컬럼은 무음 통과한다 (0041 이 겪은 것과 동일한 함정 — 0038/ADR-046 §D-5 준용).
--
-- ★ 복구 절차 제약 (부활 차단의 대가 — 명시 기록):
--   은퇴(1→0)를 되돌릴 수 없게 되므로, 잘못 은퇴시킨 경우의 복구는
--   **신규 노드 INSERT + 승격**으로만 한다 (Temporal Graph 원칙 정합 — 과거를 고쳐 쓰지 않는다).
--
-- ★★ 적용 전 반드시 읽을 것 — 0042 승계 트리거와의 상호작용 (독립 리뷰 MAJOR, 실측 재현):
--   0042 는 개정본이 **승인되는 시점**에 구본을 은퇴시킨다(시행 시점이 아니라). 그런데
--   2026-08-06 배선된 시행시점 창은 **미발효 개정본을 서빙에서 제외**한다. 두 규칙이 만나면:
--     구본 = 은퇴(0042) · 신본 = 미발효로 배제(시행시점 창) → **그 주제가 학습자 화면에서 사라진다.**
--   그리고 본 마이그의 부활 차단이 in-place 복구를 막으므로, 복구는 위 "신규 INSERT + 승격"뿐이다.
--   현 데이터로는 미도달(valid_from 0/857 · 대상 노드 전부 draft)이나, **Phase 2 백필/미시행 승격
--   전에 정책 결정이 선행**돼야 한다 → 결재 대시보드 §A #9 상신됨.
--   ⇒ 본 파일의 production 적용을 그 결재보다 먼저 하지 말 것.
--
-- 데이터 변경 0 (DDL only). 롤백 = 말미 down 주석 참조.
-- ============================================================

-- ---------- 1) knowledge_edges UPDATE 가드 (is_active 플립만 허용) ----------
CREATE TRIGGER IF NOT EXISTS prevent_knowledge_edges_update
BEFORE UPDATE ON knowledge_edges
WHEN NEW.id         IS NOT OLD.id
  OR NEW.from_node  IS NOT OLD.from_node
  OR NEW.to_node    IS NOT OLD.to_node
  OR NEW.edge_type  IS NOT OLD.edge_type
  OR NEW.condition  IS NOT OLD.condition
  OR NEW.priority   IS NOT OLD.priority
  OR NEW.created_at IS NOT OLD.created_at
BEGIN
  SELECT RAISE(ABORT, 'UPDATE on knowledge_edges body columns is forbidden (Temporal Graph). Only is_active flip is allowed; use INSERT of a new edge for any other change.');
END;

-- ---------- 2) knowledge_edges DELETE 가드 (전면 차단) ----------
CREATE TRIGGER IF NOT EXISTS prevent_knowledge_edges_delete
BEFORE DELETE ON knowledge_edges
BEGIN
  SELECT RAISE(ABORT, 'DELETE on knowledge_edges is forbidden (Temporal Graph audit trail). Deactivate with is_active = 0 instead.');
END;

-- ---------- 3) knowledge_nodes 부활(0→1) 차단 ----------
-- 0041 의 prevent_knowledge_nodes_update 는 is_current_active 를 열거하지 않아 양방향 통과.
-- 여기서 **부활 방향만** 정확히 막는다 (은퇴 1→0 은 정당 경로이므로 계속 허용).
CREATE TRIGGER IF NOT EXISTS prevent_knowledge_nodes_reactivation
BEFORE UPDATE ON knowledge_nodes
WHEN OLD.is_current_active = 0 AND NEW.is_current_active = 1
BEGIN
  SELECT RAISE(ABORT, 'Reactivating a retired knowledge_node (is_current_active 0 -> 1) is forbidden (Temporal Graph). Insert a new node and promote it instead.');
END;

-- ============================================================
-- down (수동 롤백 — DDL only, 데이터 영향 0):
--   DROP TRIGGER IF EXISTS prevent_knowledge_edges_update;
--   DROP TRIGGER IF EXISTS prevent_knowledge_edges_delete;
--   DROP TRIGGER IF EXISTS prevent_knowledge_nodes_reactivation;
-- ============================================================
