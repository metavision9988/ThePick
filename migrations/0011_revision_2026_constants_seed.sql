-- ============================================================
-- 쪽집게 스키마 패치 v1.7 (Phase 1 Step 1-5 가-0)
-- 26년 교재 개정 Constants seed — SUPERSEDES 인프라 검증용 샘플 1건.
--
-- 배경 (2026-04-23):
--   손해정도비율 20% → 10% 개정이 handoff 에 예시로 제시됨.
--   본 마이그레이션은 Temporal Graph pattern (version_year 기반) 이 실제 데이터 흐름에서
--   작동하는지 검증하는 인프라 seed — 전체 개정사항 반영은 가-1 교재 대조 시 누적.
--
-- 적용 원칙:
--   - 기존 레코드 UPDATE 금지 (prevent_constants_update trigger 준수)
--   - 신/구 버전 모두 INSERT. 조회 시 version_year DESC 로 최신 선택.
--   - revision_changes 에 개정 사실 append-only 기록.
--
-- ID 컨벤션: 가-0 샘플 전용 예약 번호 CONST-900 번대 사용 (가-1 실 데이터는 001~899).
--
-- 주의: applies_to / insurance_type 값은 교재 원문 대조 전 placeholder.
--       가-1 교재 적재 시 정확한 분류 체계로 교정될 수 있으며, 이 경우
--       기존 레코드는 그대로 두고 추가 revision_changes 로 문서화한다.
-- ============================================================

PRAGMA foreign_keys = ON;

-- 1. 기존 (2025) 레코드 — 20% 기준
INSERT OR IGNORE INTO constants
  (id, category, name, value, numeric_value, applies_to, insurance_type,
   confusion_risk, confusion_level, unit, page_ref, version_year, exam_frequency)
VALUES
  ('CONST-900', 'ratio', '손해정도비율',
   '0.20', 0.20,
   '과수 착과감소보험금', '농작물재해보험',
   '2026 개정으로 0.10 으로 변경됨', 'danger',
   '%', '410', 2025, 0);

-- 2. 신규 (2026) 레코드 — 10% 기준
INSERT OR IGNORE INTO constants
  (id, category, name, value, numeric_value, applies_to, insurance_type,
   confusion_risk, confusion_level, unit, page_ref, version_year, exam_frequency)
VALUES
  ('CONST-901', 'ratio', '손해정도비율',
   '0.10', 0.10,
   '과수 착과감소보험금', '농작물재해보험',
   '2025 기준 0.20 에서 개정됨 (CONST-900 의 후속)', 'danger',
   '%', '410', 2026, 0);

-- 3. revision_changes 에 개정 사실 기록 (append-only 감사 로그)
INSERT OR IGNORE INTO revision_changes
  (id, version_year, revision_date, category,
   target_section, target_crops,
   change_type, before_value, after_value,
   exam_priority, related_constants, related_nodes)
VALUES
  ('REV-2026-LOSS-DEGREE', 2026, '2026-03-31', 'constants',
   '적과전 종합위험 / 손해정도비율', '사과, 배, 단감, 떫은감',
   'modified', '0.20', '0.10',
   10, 'CONST-900,CONST-901', NULL);

-- ============================================================
-- 롤백 (비상시 수동 실행 — 기존 레코드 UPDATE 금지 준수)
-- ============================================================
-- DELETE 또한 Temporal 원칙 상 비권장. 비상시 운영자 직접 판단.
-- DELETE FROM constants WHERE id IN ('CONST-900', 'CONST-901');
-- DELETE FROM revision_changes WHERE id = 'REV-2026-LOSS-DEGREE';
