# Phase 2 Eval MVP Session 065 종착 — 4-Pass + 5-Persona 통합 보고서

> **세션**: 066 (Session 065 종착 누적 리뷰)
> **범위**: 7 commits (f98532d..4405c92), 26 changed files
> **리뷰 방식**: 9 독립 에이전트 병렬 (4-Pass + 5-Persona, 자가 리뷰 0)
> **본 보고서 위치**: `.claude/reviews/review-20260511-111048-phase2-eval-mvp-session-065-final-integrated.md`
> **하위 보고서 9건**: `review-20260511-111048-phase2-eval-mvp-pass{1-4}-*.md` + `review-20260511-111048-phase2-eval-mvp-persona{1-5}-*.md`

---

## 1. 카운트 요약 (중복 제거 전)

| 리뷰어                  | CRIT   | MAJOR | MINOR | 본질                |
| ----------------------- | ------ | ----- | ----- | ------------------- |
| Pass 1 (Surgeon)        | 1      | 5     | 6     | 코드 단독 터짐 경로 |
| Pass 2 (Architect)      | 2      | 4     | 5     | cross-module 정합   |
| Pass 3 (Advocate)       | 3      | 4     | 5     | UX + 보안           |
| Pass 4 (Contract)       | 0      | 1     | 3     | plan 대조           |
| **4-Pass 합**           | **6**  | 14    | 19    |                     |
| Persona 1 (Refactoring) | 1      | 4     | 3     | 6개월 후 코드 부채  |
| Persona 2 (Performance) | 3      | 7     | 8     | 10K user 부채       |
| Persona 3 (Quality)     | 3      | 5     | 4     | 테스트 부채         |
| Persona 4 (Backend)     | 3      | 5     | 4     | 2년차 데이터 부채   |
| Persona 5 (DevOps)      | 3      | 6     | 5     | 새벽 3시 on-call    |
| **Persona 합**          | **13** | 27    | 24    |                     |
| **총합 (raw)**          | **19** | 41    | 43    | **103건**           |

---

## 2. CRITICAL dedupe — 14건 (Phase 3 launch chain 묶음)

| #    | 제목                                                   | 출처                             | 즉시 흡수 / Phase 3 |
| ---- | ------------------------------------------------------ | -------------------------------- | ------------------- |
| C-01 | DUMMY_HASH bytes vs PBKDF2_ITERATIONS drift + 주석     | Pass1-C1, Pass2-CRIT2, Pass3-C1  | 즉시 (30분)         |
| C-02 | ADR-005 supersedes 본문 미수정                         | Pass2-CRIT1, Pass4-MAJOR1        | 즉시 (5분)          |
| C-03 | 임시 정책 환경 변수 분기 부재 (Phase 3 망각 차단)      | Pass3-C2, Persona5-D1            | Phase 3 chain       |
| C-04 | register 엔드포인트 per-email rate-limit 부재          | Pass3-C3, Persona3-Q-M-5         | Phase 3 chain       |
| C-05 | PASSWORD_MIN 3중 source-of-truth (api/web/DB)          | Persona1-CRIT1                   | Phase 3 chain       |
| C-06 | user_progress 복합 인덱스 + UNIQUE 부재 (mig 0029)     | Persona2-PCRIT1, Persona4-BCRIT1 | 즉시 (1h, mig 0029) |
| C-07 | /api/study/next N+1 직렬 enrichment                    | Persona2-PCRIT2                  | 즉시 (15 LoC fix)   |
| C-08 | PBKDF2 100k→600k 복원 시 CPU 폭증 (정량 미산정)        | Persona2-PCRIT3                  | ADR-035 보강 즉시   |
| C-09 | ADR-034 skip 2건 자동 알람 부재                        | Persona3-QC1                     | Phase 3 chain       |
| C-10 | TD-VRF-001 비결정성 정체 미동정 (formula-engine 1건)   | Persona3-QC3                     | 별도 task           |
| C-11 | 0028 trigger Year 2 zero-cost chain 비용               | Persona4-BCRIT2                  | Year 2 carry-over   |
| C-12 | users.last_login_at UPDATE = audit trail 단절          | Persona4-BCRIT3                  | Phase 3 chain       |
| C-13 | production redeploy 6회 chain rollback / version trail | Persona5-DCRIT2                  | 즉시 (영속)         |
| C-14 | migration 0028 production 적용 증거 0건                | Persona5-DCRIT3                  | 즉시 (확인 + 영속)  |

**즉시 흡수 권고 6건**: C-01, C-02, C-06, C-07, C-08, C-13, C-14 (low cost, high risk if ignored)
**Phase 3 launch chain 6건**: C-03, C-04, C-05, C-09, C-10, C-12 (1주 스프린트 묶음)
**Year 2 carry-over 1건**: C-11 (Phase 4 마이그레이션 시점)

---

## 3. 판정

| 측면                         | 판정                 | 비고                                        |
| ---------------------------- | -------------------- | ------------------------------------------- |
| Phase 2 Eval MVP 동작        | ✅ PASS              | 진산 G9 PASS, apps/api 488 PASS + 2 skipped |
| Hard Rules 17/15/16 멀티시험 | ✅ PASS              | Pass 4 전수 검증                            |
| 옵션 3 Silent Pivot 탐지     | ✅ PASS              | Pass 4 — 코드/plan/handoff 4 layer 일관     |
| Phase 3 launch 준비도        | ❌ 42% (DevOps 추정) | C-03/04/05/09/12 chain 의무                 |
| Year 2 Phase 4 zero-cost     | ⚠️ 부분 위반         | Persona 4 — 42-66h 회수 비용 추정           |

**완료 선언 조건** (auto-review-protocol.md):

- 4-Pass CRIT 0 AND 5-Persona CRIT 0 → 현 14건 → **완료 미선언, carry-over 명시 chain 영속 후 종착**

**carry-over 정책**: 즉시 흡수 7건은 본 세션(066) 내 처리, 나머지 7건은 handoff-075 carry-over chain + Phase 3 launch 1주 스프린트 묶음.

---

## 4. handoff-073 §F.4 MAJOR 12 / MINOR 12 carry-over 재산정

본 통합 결과로 우선순위 재정렬:

### P0 (Phase 2 Eval MVP 종착 전 즉시 흡수)

1. **C-02 ADR-005 supersedes** (5분) — 본 세션 즉시
2. **C-13 production version trail** (10분) — 본 세션 즉시 (`.claude/reports/production-version-trail.md` 신규)
3. **C-14 migration 0028 production 적용 증거** (5분) — wrangler 토큰 재발급 시 확인 + 영속

### P0+ (본 세션 가능 시 흡수)

4. **C-01 DUMMY_HASH bytes 재생성** (30분) — 회귀 테스트 추가 묶음
5. **C-07 /next N+1 → Promise.all** (handoff-073 M4와 동일, 15 LoC) — 옵션
6. **C-06 mig 0029 user_progress UNIQUE + 복합 인덱스** (1h) — handoff-073 M3+M5+M2 통합

### P1 (Phase 3 launch 1주 스프린트 chain 묶음)

- C-03 ADR 복원 chain 환경 변수 분기 (env-based)
- C-04 register email rate-limit (ADR-034 §"복원 의무" 본 항목 추가)
- C-05 PASSWORD_MIN packages/shared 이관
- C-09 ADR-034 skip 자동 알람 (verify-engine-contracts 확장)
- C-12 users.last_login_at audit trail (login_history 테이블 신규)
- handoff-073 M8/M9/M10/M12 (UX/오프라인/TBL-/Playwright)

### P2 (별도 task)

- C-10 TD-VRF-001 비결정성 정체 동정 (`verify-determinism.ts` 100회 누적)
- C-08 ADR-035 §"검토 의무"에 600k 복원 CPU 정량 추가

### Year 2 carry-over

- C-11 0028 trigger Year 2 zero-cost chain (Phase 4 시점)

---

## 5. Devil's Advocate 통합 — Phase 3 launch 시점 첫 사고 시나리오

**복합 시나리오** (만약 본 carry-over chain 누락 시):

1. Phase 3 launch 30분 후 외부 user 1번째 등록 → PASSWORD_MIN 8 복원 누락 → 4자리 password 통과
2. PBKDF2 100k 복원 누락 → 8 GPU brute-force 0.025초/account
3. cookie SameSite=None 복원 누락 → custom domain 진입 후 cross-origin CSRF 노출
4. register email rate-limit 부재 → 다중 IP 풀 brute-force 가능
5. 6-24시간 내 첫 account 탈취 incident → user_progress audit trail 부재 (C-12) → forensics 불가능

**예방 비용 추정**: 1주 스프린트 chain 처리 시 약 40-50h
**incident 시 비용**: launch 연기 + GDPR/PIPA 신고 + 신뢰 손실 → 무한대

---

## 6. 본 통합 결과의 Carry-Over Chain 영속 영역

- 본 보고서: `.claude/reviews/review-20260511-111048-phase2-eval-mvp-session-065-final-integrated.md`
- 다음 핸드오프: `.jjokjipge/handoff-session-075.md` (작성 예정)
- Phase 3 launch chain memory: `project_launch_legal_bundle_deferred.md` (chain 동기 갱신)
- ADR-034/035/036 §"복원 의무" 본문에 본 통합 14 CRIT 매핑 추가 권고

---

**작성**: Claude Code (Opus 4.7 1M context) — Session 066 entry, 4-Pass + 5-Persona 9 독립 에이전트 통합 결과
**일자**: 2026-05-11 KST
