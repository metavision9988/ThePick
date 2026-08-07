-- ============================================================
-- Migration 0045: 시행시점 정합 승격 게이트 — "오늘 유효하지 않은 판본은 승인할 수 없다"
-- ============================================================
-- STATUS: 선작성본 — **production 적용(wrangler --remote) 미승인**.
--   승인 범위 = SQL 작성·로컬 검증까지 (진산 2026-08-07 "c 진행" = 결정 카드 §5 (C) 채택).
--   적용은 0039 와 묶어 별도 게이트 (TR-0/0038 선례) → 결재 대시보드 §A 재상신.
--
-- plan   : docs/plans/current.plan.md (step = 결정 #9 (C) 집행)
-- 결정   : docs/plans/decision-card-20260807-supersedes-effectivity.md ((C) 정책 + 최소 가드)
-- 체크   : docs/plans/catchall-역이식-체크리스트.md STAGE 1 (1-5)
--
-- ── 무엇을 막는가 (결정 카드 §0~§1 실측 요약) ────────────────────────────────
-- 하나의 "현행" 개념을 두 장치가 서로 다르게 관리한다:
--   · is_current_active  (ADR-013)  — 승계당하지 않은 것 / 갱신 시점 = **승인 이벤트**
--   · valid_from·valid_until (0041) — 오늘이 유효기간 안인 것 / 갱신 시점 = **시각 경과(이벤트 없음)**
-- 둘이 어긋나는 구간은 정확히 하나, **"승인됨 + 아직 미시행"** 이다. 그 구간에서 0042 승계
-- 트리거가 구본을 은퇴시키면 신본은 아직 창 밖이라 **그 주제가 학습자 화면에서 사라진다**(blackout).
--
-- 대안으로 검토된 "승계자가 발효됐을 때만 은퇴"(카드 §0 (a))는 실측에서 기각됐다 —
-- 0042 는 이벤트 구동인데 **SQLite 에는 시간 기반 트리거가 없어** 시행일이 와도 은퇴를 발화시킬
-- 이벤트가 영영 오지 않는다. 결과는 blackout 이 아니라 **구·신 동시 노출**(더 나쁨).
-- ⇒ 채택안 (C): 위험 구간에 **애초에 들어가지 못하게** 한다.
--
-- ── 불변식 (본 마이그의 한 문장) ──────────────────────────────────────────────
--   **오늘 유효하지 않은 판본은 approved 상태로 서빙 자격을 얻을 수 없다.**
--
-- ★★ 정정 (2026-08-07, 5-페르소나 독립 리뷰 CRITICAL) — 아래 "문은 둘이고, 둘 다 잠근다"는
--    **틀렸다. 문은 셋이었다.** 세 번째 = "전이 선행 우회"(노드 부재 상태로 approved 전이를
--    먼저 INSERT → [A] 의 EXISTS 가 거짓이라 통과 → 그 id 로 미시행 노드 INSERT → SUPERSEDES
--    엣지 INSERT → 0042 [1] 이 도출 status 만 보고 구본 은퇴 = blackout). 3개 렌즈가 독립
--    수렴했고 전 마이그 하네스에서 재현됐다. **봉쇄 = 마이그 0046** (0039·0045 와 묶음 적용).
--    본 문면은 원문을 보존하고 주석으로 정정한다(마이그 파일 불변 원칙).
--
-- 그 구간에 도달하는 문은 둘이고, 둘 다 잠근다:
--   [A] 승격 게이트  — 미시행/만료 행을 approved 로 전이 (status_transitions INSERT)
--   [B] 백필 게이트  — 이미 서빙 중인 행을 미시행/만료로 만드는 valid_* 백필 (0041 이 연 경로)
--       ★[B] 는 결정 카드 §3 문면에 없는 **명시 확대**다. 카드가 "이 결정은 STAGE 2 의 선결"이라고
--       지목한 이유가 바로 STAGE 2 백필이며, [A] 만으로는 그 문이 열린 채 남는다 (plan §대상변경 근거).
--
-- ── 판정식 = 서빙 코어의 미러 (drift 금지) ────────────────────────────────────
--   apps/api/src/search/approved-nodes-sql.ts `buildEffectivityWindowSql` / `TODAY_KST_SQL` 와 동일:
--     · 반개구간 [valid_from, valid_until)  · NULL = 무제한
--     · KST 고정 date('now','+9 hours')     · date() 정규화 ('YYYY-MM-DD' 와 ISO datetime 동일 취급)
--     · 해석 불가한 값 = **fail-closed** (서빙이 감추는 값을 승격이 통과시키면 안 된다)
--   ★ SQLite 3값 논리 주의: date('쓰레기') 는 NULL 이고 `NULL = 0` 도 NULL 이라 WHEN 이 미발화한다
--     (= fail-open). 그래서 COALESCE(<비교>, 0) = 0 으로 명시 붕괴시킨다.
--   ★ 정책 개정 의무: 위 코어의 창 규약이 바뀌면 본 트리거는 **새 마이그레이션으로 재생성**해야 한다
--     (적용된 마이그는 불변). 미러 구성요소는 시나리오 테스트가 SQL 문자열로 핀 고정한다.
--
-- ── 정책의 대가 (명시 기록) ───────────────────────────────────────────────────
--   개정 준비물을 **미리 만들어 두는 것은 계속 가능**하다 (draft INSERT + SUPERSEDES 엣지 모두 허용 —
--   0042 [1] 이 draft superseder 를 발화시키지 않으므로). 막는 것은 **승격 시점**뿐이다.
--   즉 운영 규율은 "시행일에 승격한다" 한 줄이며, 그 한 줄을 기계가 지킨다.
--   ⚠️ 본 게이트가 못 잡는 잔여 위험 = **시각 경과형**(valid_until 도래로 후속본 없이 만료).
--      트리거로는 원리상 불가(시간 이벤트 부재) → 무결성 러너 계보 불변식이 사후 관측한다.
--      ★정정(2026-08-07 리뷰): 이 위임의 수신자로 적었던 초판 `LINEAGE_GAP` 은 **활성 SUPERSEDES
--        엣지가 있는 계보만** 순회했다. "후속본 없이" 만료면 엣지가 없으므로 그 노드를 한 번도
--        보지 않았다 = 위임받은 부류가 사각지대였다(3개 렌즈 독립 수렴). 해소 = 노드 전수 스캔
--        불변식 `LINEAGE_LAPSE` 신설(packages/quality). 수신자는 이제 GAP 이 아니라 LAPSE 다.
--      ★단 그 러너는 **수동 실행**이다 (`scripts/run-graph-integrity-production.ts` — cron/CI 미배선,
--        .github/workflows/{ops,ci,d1-schema-drift,g1-gate}.yml 전수 확인 2026-08-07). 즉 이 잔여 위험의
--        방어선은 "실행하면 보인다" 수준이며, **자동 감시가 아니다**. 자동화는 별건(대시보드 §C 후보).
--
-- 데이터 변경 0 (DDL only). 적용 시점 실측: valid_from/valid_until 채워진 행 = 0 (nodes 857·formulas·constants)
-- → 오늘자 행위 변화 0 (무회귀). 롤백 = 말미 down 주석.
-- ============================================================

-- ============================================================
-- [A] 승격 게이트 — status_transitions BEFORE INSERT (to_status='approved')
-- ============================================================
-- 대상 3종은 status_transitions.target_type CHECK ('node','formula','constant') 와 1:1.
-- 대상 행이 부재하면(EXISTS 거짓) 통과 — 본 트리거는 참조 무결성 담당이 아니다.
--   ★이 "부재 통과"가 세 번째 문의 입구였다 → 0046 [C-2] 가 반대편(행 INSERT)에서 막는다.
-- ★★ 3종 대칭 ≠ 3종 완전 커버 (2026-08-07 리뷰 정정): formulas/constants 의 **은퇴** 경로는
--    0014 `mav_formulas|constants_supersedes_deactivate` 이고, 이들은 `superseded_by` 가 채워진
--    행이 INSERT 되면 **status 도 시행일도 보지 않고** 구본을 은퇴시킨다. status_transitions 를
--    거치지 않으므로 [A] 는 발화 기회조차 없다(실측 재현). 처분 = 0042 헤더가 예약한 0043 슬롯.
--    그때까지 정책 불변: **formulas/constants 적재에 `superseded_by` 사용 금지.**

CREATE TRIGGER IF NOT EXISTS enforce_promotion_within_effectivity_nodes
BEFORE INSERT ON status_transitions
WHEN NEW.target_type = 'node' AND NEW.to_status = 'approved'
  AND EXISTS (
    SELECT 1 FROM knowledge_nodes kn
     WHERE kn.id = NEW.target_id
       AND (
            (kn.valid_from  IS NOT NULL AND COALESCE(date(kn.valid_from)  <= date('now','+9 hours'), 0) = 0)
         OR (kn.valid_until IS NOT NULL AND COALESCE(date(kn.valid_until) >  date('now','+9 hours'), 0) = 0)
       )
  )
BEGIN
  SELECT RAISE(ABORT, 'Promotion blocked: knowledge_node is not effective today (valid_from in the future, valid_until already passed, or an unparsable date). Policy (C) 2026-08-07: keep it draft and promote on/after its effective date. See docs/plans/decision-card-20260807-supersedes-effectivity.md');
END;

CREATE TRIGGER IF NOT EXISTS enforce_promotion_within_effectivity_formulas
BEFORE INSERT ON status_transitions
WHEN NEW.target_type = 'formula' AND NEW.to_status = 'approved'
  AND EXISTS (
    SELECT 1 FROM formulas f
     WHERE f.id = NEW.target_id
       AND (
            (f.valid_from  IS NOT NULL AND COALESCE(date(f.valid_from)  <= date('now','+9 hours'), 0) = 0)
         OR (f.valid_until IS NOT NULL AND COALESCE(date(f.valid_until) >  date('now','+9 hours'), 0) = 0)
       )
  )
BEGIN
  SELECT RAISE(ABORT, 'Promotion blocked: formula is not effective today (valid_from in the future, valid_until already passed, or an unparsable date). Policy (C) 2026-08-07: promote on/after its effective date.');
END;

CREATE TRIGGER IF NOT EXISTS enforce_promotion_within_effectivity_constants
BEFORE INSERT ON status_transitions
WHEN NEW.target_type = 'constant' AND NEW.to_status = 'approved'
  AND EXISTS (
    SELECT 1 FROM constants c
     WHERE c.id = NEW.target_id
       AND (
            (c.valid_from  IS NOT NULL AND COALESCE(date(c.valid_from)  <= date('now','+9 hours'), 0) = 0)
         OR (c.valid_until IS NOT NULL AND COALESCE(date(c.valid_until) >  date('now','+9 hours'), 0) = 0)
       )
  )
BEGIN
  SELECT RAISE(ABORT, 'Promotion blocked: constant is not effective today (valid_from in the future, valid_until already passed, or an unparsable date). Policy (C) 2026-08-07: promote on/after its effective date.');
END;

-- ============================================================
-- [B] 백필 게이트 — 서빙 중인 행을 오늘 무효로 만드는 valid_* 백필 차단
-- ============================================================
-- 0041 이 valid_from/valid_until 을 "NULL→값 1회" 로 열어 뒀다(Phase 2 백필의 합법 경로).
-- 그 경로로 **이미 approved + active 인 행**에 미래 valid_from(또는 과거 valid_until)을 넣으면
-- 그 행은 즉시 서빙에서 사라진다 — [A] 가 못 막는 두 번째 문이다.
--
-- ★ 0041/0039 트리거를 DROP·재생성하지 않는다. 재생성은 그 자체가 회귀 표면이고, 본 조건은
--   직교(값의 *내용* 판정 vs 화이트리스트 판정)라 독립 트리거가 더 안전하다 — 0039 와 동일 원칙.
-- ★ 발화 범위: UPDATE OF valid_from, valid_until — is_current_active 플립·다른 백필은 무접촉.
-- ★ "서빙 중" 판정 = is_current_active=1 AND 실 status(최신 status_transitions, 무이력='draft')='approved'
--   — 0042 와 동일한 단일 진실원 미러(rowid DESC 타이브레이커 포함).
-- ★ draft 행은 자유롭게 미래 시행일을 채울 수 있다 (0041 이 예고한 미시행 4노드 백필 = 정상 경로).

CREATE TRIGGER IF NOT EXISTS enforce_effectivity_backfill_keeps_serving_nodes
BEFORE UPDATE OF valid_from, valid_until ON knowledge_nodes
WHEN OLD.is_current_active = 1
  AND COALESCE(
        (SELECT st.to_status
           FROM status_transitions st
          WHERE st.target_type = 'node' AND st.target_id = OLD.id
          ORDER BY st.transitioned_at DESC, st.rowid DESC
          LIMIT 1),
        'draft') = 'approved'
  AND (
       (NEW.valid_from  IS NOT NULL AND COALESCE(date(NEW.valid_from)  <= date('now','+9 hours'), 0) = 0)
    OR (NEW.valid_until IS NOT NULL AND COALESCE(date(NEW.valid_until) >  date('now','+9 hours'), 0) = 0)
  )
BEGIN
  SELECT RAISE(ABORT, 'Effectivity backfill blocked: this knowledge_node is currently served (approved + active) and the new valid_from/valid_until would make it ineffective today — it would vanish from the learner surface with no successor. Insert a new version and promote it on its effective date instead.');
END;

CREATE TRIGGER IF NOT EXISTS enforce_effectivity_backfill_keeps_serving_formulas
BEFORE UPDATE OF valid_from, valid_until ON formulas
WHEN OLD.is_current_active = 1
  AND COALESCE(
        (SELECT st.to_status
           FROM status_transitions st
          WHERE st.target_type = 'formula' AND st.target_id = OLD.id
          ORDER BY st.transitioned_at DESC, st.rowid DESC
          LIMIT 1),
        'draft') = 'approved'
  AND (
       (NEW.valid_from  IS NOT NULL AND COALESCE(date(NEW.valid_from)  <= date('now','+9 hours'), 0) = 0)
    OR (NEW.valid_until IS NOT NULL AND COALESCE(date(NEW.valid_until) >  date('now','+9 hours'), 0) = 0)
  )
BEGIN
  SELECT RAISE(ABORT, 'Effectivity backfill blocked: this formula is currently served (approved + active) and the new valid_from/valid_until would make it ineffective today. Insert a new version and promote it on its effective date instead.');
END;

CREATE TRIGGER IF NOT EXISTS enforce_effectivity_backfill_keeps_serving_constants
BEFORE UPDATE OF valid_from, valid_until ON constants
WHEN OLD.is_current_active = 1
  AND COALESCE(
        (SELECT st.to_status
           FROM status_transitions st
          WHERE st.target_type = 'constant' AND st.target_id = OLD.id
          ORDER BY st.transitioned_at DESC, st.rowid DESC
          LIMIT 1),
        'draft') = 'approved'
  AND (
       (NEW.valid_from  IS NOT NULL AND COALESCE(date(NEW.valid_from)  <= date('now','+9 hours'), 0) = 0)
    OR (NEW.valid_until IS NOT NULL AND COALESCE(date(NEW.valid_until) >  date('now','+9 hours'), 0) = 0)
  )
BEGIN
  SELECT RAISE(ABORT, 'Effectivity backfill blocked: this constant is currently served (approved + active) and the new valid_from/valid_until would make it ineffective today. Insert a new version and promote it on its effective date instead.');
END;

-- ============================================================
-- down (수동 롤백 — DDL only, 데이터 영향 0):
--   DROP TRIGGER IF EXISTS enforce_promotion_within_effectivity_nodes;
--   DROP TRIGGER IF EXISTS enforce_promotion_within_effectivity_formulas;
--   DROP TRIGGER IF EXISTS enforce_promotion_within_effectivity_constants;
--   DROP TRIGGER IF EXISTS enforce_effectivity_backfill_keeps_serving_nodes;
--   DROP TRIGGER IF EXISTS enforce_effectivity_backfill_keeps_serving_formulas;
--   DROP TRIGGER IF EXISTS enforce_effectivity_backfill_keeps_serving_constants;
--   ⚠️ 롤백 = blackout 진입로 재개방. 롤백 시 결정 카드 §2 (A)/(B) 중 하나를 대체로 세울 것.
--   ⚠️★ 반쪽 롤백 금지 (2026-08-07 리뷰): 0039(부활 차단)가 켜진 채 본 마이그만 내리면
--      **"발생은 못 막고 복구만 막힌"** 최악 조합이 된다 — 0039 헤더가 원래 경고하던 그 상태다.
--      0039·0045·0046 은 한 묶음으로 적용·롤백한다.
-- ============================================================
