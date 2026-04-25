# 옵션 B plan 보강 차분 검증 — 가-1 Group A-2 (5차 리뷰)

**리뷰 방식: 독립 에이전트 1개 (`pr-review-toolkit:code-reviewer`)**

작성일: 2026-04-25 KST 21:28
선행: `.claude/reviews/review-20260425-{110225,142105,204720,211626}-*.md` (1~4차)
검증 범위: 옵션 B 차분 (db.ts 헤더 + plan + gates.yaml) — 직전 발견 중복 금지

---

## 종합 판정

```
초기: Critical 0 / Major 0 / Minor 1 (gates.yaml B-3 결정 보류 주석 부재)
정정 후: Critical 0 / Major 0 / Minor 0
```

---

## 보강별 PASS/FAIL

| ID                                 | 발견 매핑                       | 결과                                                                                                        |
| :--------------------------------- | :------------------------------ | :---------------------------------------------------------------------------------------------------------- |
| **B-1** db.ts 헤더 정정            | 3차 BE C-1 (IndexedDB sync 0건) | ✅ PASS — `apps/web/src/stores/progress.ts:28` write 경로 grep 0건, 헤더 주장과 코드 100% 정합              |
| **B-2** admin status API 책임 명시 | 3차 BE C-2                      | ✅ CONDITIONAL PASS — plan 본문 결정 보류 + gates.yaml 동기화 책임 갭 → 즉시 정정 (아래)                    |
| **B-3** D-4 신규 게이트            | 3차 DO OP-C-1 + OP-C-2          | ✅ PASS — sub_gates 3개 plan ↔ gates 1:1 매핑, TD-037 Email Routing 재선택 양쪽 명시                        |
| **B-4** TD-044 scope 확장          | 3차 Q NEW-M-1                   | ✅ PASS — `progress/routes.ts:190-212` 실 SELECT-then-UPDATE race 위치 검증, plan ↔ gates target_files 일치 |
| **B-5** Year 2 백필 SQL 이월       | 3차 BE C-4                      | ✅ PASS — Phase 2 종료 전 작성 의무 명시 + ADR-007 trigger 충돌 위험 본문에 명시                            |

---

## Minor 1건 → 즉시 정정

**MIN-1**: `tasks/step-1-5-ga-1.gates.yaml` `gates_b_simulation` 에 B-3 (admin transitions API) 결정 보류 주석 부재 — plan ↔ gates 단일 진실원천 silent drift 위험.

**정정**: `gates_b_simulation` 끝에 결정 보류 주석 3줄 추가:

```yaml
# B-3 admin transitions API endpoint 추가 여부 — 진산님 결정 대기.
# plan §검토 흡수 B-2 (3차 5-페르소나 C-4) 참조.
# 결정 후 본 게이트에 정식 항목으로 추가 또는 별도 step 으로 분리.
```

---

## 진산님 메모리 정합 검증

| 메모리                                       | 정합                                                              |
| :------------------------------------------- | :---------------------------------------------------------------- |
| `feedback_single_vendor_cloudflare.md`       | ✅ TD-037 Discord → Email Routing 재선택 (plan B-3 + gates D-4-2) |
| `feedback_focus_reliability_not_schedule.md` | ✅ 일정 추정 0 / 신뢰성·운영 회로 집중                            |
| `project_launch_legal_bundle_deferred.md`    | ✅ 법무 권고 미게시                                               |
| `feedback_no_shortcuts.md`                   | ✅ "주석만 → 코드화" 명시 이월 (Hard 약정)                        |
| `auto-review-protocol.md` 규칙 0             | ✅ 메인 컨텍스트 외부 위임                                        |

---

## 확인된 PASS (실 inspect 5건)

1. `apps/web/src/lib/db.ts:8-11` 헤더 ↔ `progress.ts:28` read-only 정합 (write 경로 grep 0)
2. `gates.yaml:105-107` C-3 target_files ↔ `plan:101` TD-044 (a)/(b) 1:1 매핑
3. `progress/routes.ts:190-212` SELECT-then-UPDATE race 실코드 위치 (3차 M-8 정합)
4. `gates.yaml:148-160` D-4 sub_gates 3개 ↔ `plan:199-206` D-4-1/D-4-2/D-4-3 LoC 견적까지 일치
5. `apps/api/src/middleware/retry.ts:11-14` "KV 폴백" 주석만 + `wrangler.toml:49-51` `[observability]` 만 — D-4 가 진단한 갭이 실제 존재함 확인

---

## 반론 (Devil's Advocate)

**D-4-2 Cloudflare Email Routing outbound 지원 검증 미흡** — Cloudflare Email Routing 은 inbound routing 위주, outbound 발송은 Workers Send Email API binding (`send_email`) 또는 MailChannels 별도 필요할 수 있음. plan §위험 분석에 "Context7 또는 공식 문서로 실제 API 시그니처 확인 후 코드 작성. 추측 금지" 가 헤지하고 있어 PASS 처리하나, **Group D 착수 직전 Context7 로 실 API 확인 의무**.

---

## 옵션 A + B 합산 최종 상태 (5차 누적)

✅ 옵션 A 4건 코드 fix (회귀 0건)
✅ 옵션 B 5건 plan 보강 + Minor 1건 정정
✅ 1차/2차/3차/4차/5차 리뷰 발견 모두 처리 (즉시 수정 / plan 명시 이월)
✅ 진산님 메모리 5종 정합

---

## 서명

- Agent (`pr-review-toolkit:code-reviewer`): `agentId: acd437657ed567748`, 18 tool uses, 141s
- Minor 1건 즉시 정정 (gates.yaml B-3 결정 보류 주석)
- 1~4차 리뷰 발견 중복 0건 검증 완료
