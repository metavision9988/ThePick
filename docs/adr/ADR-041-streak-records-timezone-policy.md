# ADR-041: streak_records timezone — KST-only 정책 영속

- **상태:** Accepted (Year 1)
- **결정일:** 2026-05-13 (Session 072 Step 3-UX-6e 5-페르소나 backend C-D2 흡수)
- **결정자:** Claude Opus 4.7 (backend-architect 진단) + 진산 (우선순위 위임)
- **관련 영역:** streak_records.last_study_date / current_streak / longest_streak, study_reviews KST day boundary, /grade streak UPSERT, /mode + /progress streak 응답

---

## 맥락 (Context)

5-페르소나 backend C-D2 진단 발견:

- `streak_records.last_study_date` 컬럼은 `todayDateString()` 호출 결과 (KST YYYY-MM-DD) 저장.
- 그러나 schema CHECK 또는 timezone 메타데이터 컬럼 부재.
- 사용자 한국 거주 가정이 코드에만 박혀 있고 schema 무명시.

**위협:**

- Year 2 멀티시험 확장 시 일본 시험 (JST) / 베트남 시험 (ICT) 도입 가능. 동일 user_id가 다국적 시험 학습 시 streak 일자가 어느 timezone 기준인지 모호.
- 서버 시간대 변경 또는 admin batch가 UTC 기준 INSERT 시 silent 자정 boundary drift.
- 사용자가 KST 23:00~01:00 review가 streak에서 어느 일자로 카운트되었는지 forensic 불가.

**근본 원인** — `packages/learning-modes/src/session-progress.ts`의 `todayDateString(now, offsetHours)` / `dayBoundsUtc(date, offsetHours)` 두 helper는 offsetHours 인자를 받지만 **호출 측 (apps/api/src/study/routes.ts)은 default KST를 그대로 사용**. 사용자 timezone 메타데이터 영속 안 됨.

---

## 결정 (Decision)

**Year 1 단일 시험 (손해평가사 = 한국) 정합으로 KST-only 정책 명시 영속.** 본 ADR로 정책 lock, schema 변경 0.

### 1. KST 단일 timezone 정책 — Year 1 lock

- `streak_records.last_study_date`는 항상 KST 기준 YYYY-MM-DD.
- `study_reviews.reviewed_at`는 UTC ISO 8601 (timezone-naive UTC).
- `todayDateString()` / `dayBoundsUtc()` 둘 다 default `KST_OFFSET_HOURS = 9`로 호출.
- 손해평가사 시험은 한국 단일 시험 → 사용자 100% KST 거주 가정.

### 2. 코드 명시 강화 (본 step 흡수)

- `apps/api/src/study/routes.ts` streak UPSERT (`grade` endpoint) + `/mode` streak 응답 + `/progress` streak 응답 모두 주석으로 "KST 기준" 명시.
- `apps/api/src/db/schema.ts` streak_records 정의 옆에 "KST YYYY-MM-DD" 주석.
- 신규 endpoint 추가 시 본 ADR 정합 의무 (offsetHours 인자 무시 X — 명시 의무).

### 3. Year 2 멀티시험 확장 시 재평가 trigger

Year 2 Phase 4 (ADR-007 정합) 진입 시 본 ADR 의무 재검토:

- 옵션 A: `streak_records.timezone_id TEXT` 컬럼 추가 ('Asia/Seoul' 기본 / 'Asia/Tokyo' 일본 시험 / 'Asia/Ho_Chi_Minh' 베트남).
- 옵션 B: `user_settings.timezone_id` 별도 테이블 (사용자 단위 timezone, 시험 무관).
- 옵션 C: KST 강제 유지 (다른 국가 사용자는 별도 streak 미적용).

Year 2 trigger 시 별도 ADR (ADR-XX2) 작성하여 옵션 lock.

### 4. forensic 보강 (선택, Phase 3 launch 후 30일)

- engine_telemetry 'learning_slo' 게이지에 streak UPSERT 시 timezone metadata (default 'Asia/Seoul') 추가.
- 운영자가 D1 streak_records 조회 시 항상 KST 가정 가능.

---

## 채택 근거

1. **Schema CHECK 또는 컬럼 추가는 영향 면적 큼** — 본 step은 Quick-win 1h 작업. ADR + 코드 주석으로 정책 영속이 정합.
2. **Year 1 단일 시험은 한국** — KST-only 가정이 product 정합. ADR-007 (Year 2 이월) 정책 정합.
3. **`packages/learning-modes` helper는 이미 offsetHours 인자 지원** — Year 2 재평가 시 호출 측만 변경하면 zero-cost 전환 가능 (Engine-First doctrine 정합).
4. **`engine_telemetry` 게이지로 forensic 보강 가능** — 마이그레이션 0건으로 가시화.

---

## 영향 (Consequences)

### 1. 본 ADR 영속 항목

- ☑ ADR-041 신규 영속 (본 문서)
- ☑ `apps/api/src/db/schema.ts` streak_records 정의 주석 강화 (KST YYYY-MM-DD)
- ☑ `apps/api/src/study/routes.ts` streak UPSERT + /mode streak 응답 + /progress streak 응답 주석 강화

### 2. 향후 의무 (Year 2 trigger 시)

- ☐ Year 2 Phase 4 진입 시 본 ADR 재검토 + 별도 ADR로 옵션 A/B/C 결정
- ☐ Year 2 신규 시험 도입 PR에 본 ADR 정합 검증 필수

### 3. carry-over (Phase 3 launch 후 30일)

- ☐ engine_telemetry timezone metadata 추가 (선택)
- ☐ master-dashboard.md v2 (Phase 3 wire-up) 시 streak forensic 게이지 정의

---

## 관련 문서

- `packages/learning-modes/src/session-progress.ts` (todayDateString / dayBoundsUtc / KST_OFFSET_HOURS = 9)
- `apps/api/src/db/schema.ts` (streak_records 정의)
- `apps/api/src/study/routes.ts` (streak UPSERT + 응답 path)
- `migrations/0035_study_sessions_streak.sql` (schema 본문)
- ADR-007 (멀티시험 Year 2 이월 — 본 ADR 정합 source)
- 5-페르소나 통합 보고서: `.claude/reviews/phase3-tech-debt-20260513-163000.md` §"CRITICAL Phase 3 launch 직전 의무 흡수" #4

---

## 결정 책임

본 ADR은 다음만 lock:

- ✅ Year 1 KST-only 정책 영속 (schema 변경 0)
- ✅ 코드 주석 명시 의무
- ✅ Year 2 멀티시험 확장 시 재평가 trigger

다음은 lock 안 함:

- ❌ schema 컬럼 추가 (Year 2 trigger 시 결정)
- ❌ 다국적 사용자 사용자 단위 timezone 정책 (Year 2 별도 ADR)
- ❌ engine_telemetry timezone metadata 활성 시점 (Phase 3 launch 후 30일 carry-over)
