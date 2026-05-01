# Handoff — Session 028 → v1.1 흡수 + Sprint 0 Baseline + P0 17건 GREEN

작성일: 2026-05-01 ~19:30 KST
직전 세션: 027 (Step 19 = Phase 1 closeout 완료) → 028 (검토서 + 테스트 계획서 흡수 + Sprint 0/1)

---

## 0. 본 세션 진입 사유

진산님이 외부 검토 산출물 2건을 받아왔다 (Mephisto + DEV COVEN 7 페르소나 작성):

1. **`docs/Engine Hardening 완료 보고서 v1.0 — 최종 검토.md`** — 본 프로젝트 ENGINE_HARDENING_COMPLETION_REPORT v1.0 의 7가지 인지 부조화 발견 + 사인 전 필수 7건 (~30분 작업) 권고
2. **`docs/ThePick Engine Quality Test Master Plan v1.0.md`** — 셀프체크 한계를 넘는 10 차원 × 50 시나리오 × 207 SLO 테스트 마스터 플랜 (P0 17 / P1 18 / P2 15)

진산님 명시 트리거: **"실행계획 수립 + 시행. 새 세션이 좋으면 handoff 프롬프트 작성"**

세션 027 누적 ~9시간 / turn 250+ → 세션 모니터 90분 임계 다중 초과. **새 세션 의무**.

---

## 1. 본 세션이 받은 산출물 핵심 요약

### 1.1 검토서 — 7가지 인지 부조화 (Mephisto 종합)

|  #  | 부조화                                                               | 위험도 | 흡수 필수도 |
| :-: | :------------------------------------------------------------------- | :----: | :---------: |
|  1  | "Phase 1 100% 완료" + "1주 후속 PR 필수"                             |   🔴   |   사인 전   |
|  2  | "이월 부채 0건" + "MAJOR 23건 트래킹" (분류 트릭)                    |   🔴   |   사인 전   |
|  3  | "Engine Observability 8 게이지 가동" + "wire-up 미완 (no_data 표시)" |   🟠   |   사인 전   |
|  4  | "Engine 범위 CRITICAL 0건" + "admin-web vitest = Engine 외부"        |   🟠   |    권장     |
|  5  | "모노레포 합계 949" + "apps/web/admin-web/payment 미포함"            |   🟠   |   사인 전   |
|  6  | "Year 2 zero-cost" + "4 레벨 중 1 레벨만 검증"                       |   🟡   |    권장     |
|  7  | "100% 회복성" + "1개 시나리오 PASS"                                  |   🟡   |    권장     |

### 1.2 검토서 — 사인 전 필수 7건 (총 ~30분 작업)

| 항목                                                        | 위치                                                                                             |
| :---------------------------------------------------------- | :----------------------------------------------------------------------------------------------- |
| §0.3 두 단계 분리 (Engine 코어 / 운영 활성화)               | `docs/ENGINE_HARDENING_COMPLETION_REPORT.md`                                                     |
| §10.1 헤더 정정 (모노레포 → Engine+API+Shared 합계)         | 동                                                                                               |
| §10.6 [x] 마킹 옆 명시 ("인프라 가동, 데이터 wire-up 후속") | 동                                                                                               |
| §10.7 "검증되지 않은 영역" 섹션 신설                        | 동                                                                                               |
| §1.1 북극성 연결고리 한 단락 (합격률 60% ↔ 본 Phase)        | 동                                                                                               |
| §1.2 BATCH-1 정의 명시 (교재? 기출? 둘 다?)                 | 동                                                                                               |
| **localStorage → httpOnly cookie 패치 (코드 1 PR)**         | `apps/admin-web/src/components/TelemetryDashboard.tsx` + `apps/api/src/telemetry/admin-token.ts` |

### 1.3 테스트 마스터 플랜 — P0 17건 (BATCH-1 진입 전 필수)

```
[CHA] 6건: D1 disconnect / Worker timeout / Anthropic 5xx / Wall clock /
            Vectorize timeout / Cron 미실행
[FUZ] 3건: PDF 손상 / Claude 변조 / 산식 sandbox 우회
[PRF] 2건: Formula Engine 51 산식 속도 / naive DFS 폭발 임계점
[REG] 2건: BATCH-0 fixture 회귀 / engine_version major bump
[PRC] 2건: 산식 51개 6 decimal / Cost Meter 정수 누적
[REC] 2건: Kill 5 시점 다변화 / checkpoint 1바이트 변조

추정 작업: ~5일 / 자동화 100% (Vitest + MSW + Workers Vitest Pool)
```

### 1.4 Mephisto 예언 (Sprint 0 baseline)

> "내 메피스토적 직감으로는 — 8~12건. 절반이 이미 깨져 있을 가능성이 높아."

구체적 예측 5건:

1. **PRF-02**: naive DFS는 N=5000에서 50ms 초과 → Tarjan SCC 즉시 도입 트리거
2. **CHA-03**: Anthropic 5xx 폭주 시 backoff = linear (exponential 아님)
3. **FUZ-01**: PDF 폭탄에서 subprocess 좀비 시나리오 미검증
4. **FUZ-05**: examId 화이트스페이스 통과 (`'son-hae-pyeong-ga-sa '` trailing space)
5. **REG-01**: BATCH-0 fixture 재실행 invariant timestamp 차이로 미세 불일치

---

## 2. 본 세션 작업 순서 (Phase A → D)

### Phase A — 검토서 사인 전 필수 7건 흡수 (~1시간)

**산출물**: `docs/ENGINE_HARDENING_COMPLETION_REPORT.md` v1.0 → v1.1

**액션**:

1. §0.3 한 줄 요약 두 단계로 분리 (Engine 코어 949 PASS / 운영 활성화 별도)
2. §1.1 북극성 합격률 60% ↔ 본 Phase 7가지 품질 목표의 연결 경로 한 단락 추가
3. §1.2 BATCH-1 정의 명시 ("BATCH-1 = 교재 835p Stage 1~10 + 기출 7회분 일부 / 양 정의는 batch-loadmap.md 참조")
4. §10.1 헤더 정정 ("모노레포 합계 949" → "Engine + API + Shared 7 컴포넌트 합계 949 / apps/web 0 / apps/admin-web 0 / payment 0 / study-material-generator 0 / parser-1st-exam 0")
5. §10.6 [x] 마킹 갱신 ("Engine Observability 8 게이지 가동 (인프라 가동, 데이터 wire-up은 BATCH-1 진입 직전 후속 PR 의무)")
6. §10.7 "검증되지 않은 영역" 섹션 신설:
   - production 환경 미검증 (17 마이그레이션은 local/dev PASS, production 첫 적용 = §11.2 절차 3번)
   - 카오스/퍼즈 테스트 미실시 (AC-RP-3 1개 시나리오만)
   - LLM 출력 품질 (Cat 8) 미검증
   - naive DFS 임계 노드 수 미측정
   - engine_version major bump 시 runbook 부재
   - Two-Layer Cost Control layer 간 연동 시나리오 미정의
   - localStorage admin_api_token 의 XSS 공격면

**커밋**: `docs(report): v1.1 — 7가지 인지 부조화 흡수 + 검증되지 않은 영역 §10.7 신설`

### Phase B — localStorage → httpOnly cookie 보안 패치 (~1.5시간)

**산출물**: 보안 코드 1 PR

**액션 (apps/api 측)**:

1. `apps/api/src/telemetry/admin-token.ts` 갱신 — 헤더 검증 → cookie 검증 fallback 추가 (헤더는 server-to-server 호환 유지)
2. `apps/api/src/telemetry/routes.ts` POST /login 신규 — admin token 검증 후 `Set-Cookie: admin_session=...; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`
3. POST /logout 신규 — `Set-Cookie: admin_session=; Max-Age=0`
4. cookie 검증 미들웨어 추가 (헤더 fallback 유지)
5. 테스트: cookie path PASS / 401 mask 정합 / timing-safe 정합 / 만료 동작

**액션 (apps/admin-web 측)**:

1. `apps/admin-web/src/components/TelemetryDashboard.tsx` — TokenForm onSubmit 시 `fetch('/api/telemetry/login', { credentials: 'include', body: { token } })` → Set-Cookie
2. localStorage 사용 제거 (XSS 방어)
3. 모든 fetch 에 `credentials: 'include'` 추가
4. logout 버튼 → POST `/api/telemetry/logout`

**액션 (CORS)**:

1. `apps/api/src/index.ts` `/api/telemetry/*` CORS 에 `credentials: true` 추가
2. `allowHeaders` 에서 `X-Admin-Token` 유지 (server-to-server 호환)

**커밋**: `fix(security): admin-web localStorage → httpOnly cookie 전환 (Sentinel CRITICAL 흡수)`

### Phase C — Sprint 0 Baseline (~3일, 6 commits 권장)

**목적**: P0 17건 현 시점 PASS/FAIL 정직 측정 (Mephisto 예언 검증)

**Day 1 — 도구 정비**:

- k6 도입 검토 (`apps/batch/__loadtest__/` 또는 `tools/k6/` 신규)
- MSW 확장 (Anthropic API mock 추가)
- Workers Vitest Pool 도입 (Cloudflare Workers 환경 통합 테스트)
- fixture 정비 (`tests/fixtures/`)

**Day 2-3 — P0 17건 baseline 측정**:

| Sprint Day | 차원    | 시나리오                                                                       |
| :--------: | :------ | :----------------------------------------------------------------------------- |
|  Day 2 AM  | CHA 6건 | D1 disconnect / Worker timeout / Anthropic 5xx / Wall clock / Vectorize / Cron |
|  Day 2 PM  | FUZ 3건 | PDF 손상 / Claude 변조 / 산식 sandbox                                          |
|  Day 3 AM  | PRF 2건 | Formula Engine 속도 / **naive DFS 폭발 임계점 (Mephisto 예언 #1)**             |
|  Day 3 AM  | REG 2건 | BATCH-0 fixture 회귀 (예언 #5) / engine_version major bump                     |
|  Day 3 PM  | PRC 2건 | 산식 6 decimal / Cost Meter 정수                                               |
|  Day 3 PM  | REC 2건 | Kill 5 시점 / checkpoint 1바이트 변조                                          |

**산출물**: `.claude/reviews/sprint0-baseline-{TIMESTAMP}.md` — 17건 PASS/FAIL + Mephisto 예언 검증 매트릭스

**커밋 단위**: 차원별 1 commit (CHA / FUZ / PRF / REG / PRC / REC)

### Phase D — Sprint 1 P0 17건 GREEN (~5일)

Sprint 0 결과 흡수 후 진행:

- FAIL 건은 fix → 재실행 PASS 확인
- PASS 건은 회귀 방어 (CI 통합 의무)
- 모든 17건 GREEN 확인 + JSON 리포트 생성

**Sprint 1 종료 게이트**: 17/17 PASS + `verify-engine-contracts.ts` 확장 (Cat 5 = 부분 자동화) → BATCH-1 진입 진산님 트리거 대기

---

## 3. 새 세션 진입 직후 1차 읽기

### 3.1 본 세션 핵심 문서 (의무)

1. **본 핸드오프** — `.jjokjipge/handoff-session-028.md`
2. **검토서** — `docs/Engine Hardening 완료 보고서 v1.0 — 최종 검토.md` (Mephisto + 7 페르소나)
3. **테스트 마스터 플랜** — `docs/ThePick Engine Quality Test Master Plan v1.0.md` (10 차원 × 50 시나리오)
4. **본 프로젝트 완료 보고서 v1.0** — `docs/ENGINE_HARDENING_COMPLETION_REPORT.md` (수정 대상 = v1.0 → v1.1)

### 3.2 직전 세션 핸드오프 (체인)

5. `.jjokjipge/handoff-session-027.md` (Step 19 완료)
6. `docs/plans/engine-hardening/ROADMAP.md §8` (100% 게이트)

### 3.3 진산님 메모리 (자동 로드, 본 세션 정합)

- `project_completion_notification_obligation` (★ 완료 시점 알림 의무 — Phase A 사인 전)
- `feedback_two_fix_failures_zoom_out` (Mephisto 예언 5건 = zoom-out 신호)
- `project_anthropic_cap_pre_install` (Phase 2 진입 의무 — Sprint 1 후 활성)
- `feedback_no_shortcuts` (상용 품질 — Cat 8 Phase 2 deferred 정합)
- `project_v3_final_multi_exam_deferred` (Year 2 zero-cost 4 레벨 검증 = 권장)
- `feedback_review_filename_pattern` (review-\* prefix — Sprint 0 산출물 정합)
- `feedback_focus_reliability_not_schedule` (신뢰성 우선 — 본 세션 본질)

---

## 4. 진산님 트리거 키워드

다음 메시지 중 1개로 본 세션 진입:

| 트리거                                | 진행                                  |
| :------------------------------------ | :------------------------------------ |
| **"v1.1 흡수 + Sprint 0 진입"**       | Phase A → B → C 순차 진행 (~5일)      |
| **"v1.1 흡수만"**                     | Phase A 단독 (~1시간)                 |
| **"Sprint 0 baseline 즉시"**          | Phase C 단독 (Phase A/B 차세션 위임)  |
| **"localStorage 보안 패치 먼저"**     | Phase B 단독 (~1.5시간)               |
| **"Sprint 1 P0 GREEN 까지 권고대로"** | Phase A → B → C → D 풀 진행 (~9-10일) |

권고: **"v1.1 흡수 + Sprint 0 진입"** — 검토서 권고 사인 전 7건 흡수 후 baseline 측정. Mephisto 예언 검증으로 진짜 위험 발견.

---

## 5. 본 세션 작업 시 주의 사항

### 5.1 검토서의 핵심 메시지 (Mephisto 종합)

> "이 보고서는 **'기술적으로 정직하지만 의사결정 메시지로는 두 얼굴'**이야. 진산이 6개월 뒤 이 문서를 다시 펼치면, §0.3과 §14의 100% 마케팅에 매몰될 거야."

**본 세션 의무**: §0.3 + §10.1 + §10.6 + §10.7 의 **자기방어적 분류 트릭 제거**. v1.1 은 v1.0 보다 정직해야 한다.

### 5.2 Sprint 0 baseline 의 진정한 가치

> "Sprint 0의 baseline 측정을 진산이 가장 두려워해야 해. 그 시점에 PASS는 17건 중 몇 건일까?"

**본 세션 의무**: PASS 수치를 먼저 결정하지 말 것. 측정 결과 그대로 정직 보고. Mephisto 예언이 맞으면 8~12건 PASS = **5~9건의 진짜 결함 발견**. 이게 949 + 50 시나리오의 진짜 가치.

### 5.3 진산님 통제 영역 (Claude 비개입)

- 시험 일정 / 사용자 모집 / 가격 / 광고
- 법무 3종 (메모리 `project_launch_legal_bundle_deferred`)
- Cloudflare Access / Anthropic 콘솔 cap (Phase 2)
- 교재 저작권 (메모리 `feedback_copyright_skip` — 신경 끄라 명시)

### 5.4 cap=3회 정책 (5-페르소나 정합)

P0 17건 중 CRITICAL FAIL 발견 시:

- 1차: 즉시 fix → 재실행
- 2차: 재실행 FAIL 시 zoom-out (메모리 `feedback_two_fix_failures_zoom_out`) — 가설 보류 + 다른 layer brainstorm
- 3차: zoom-out 후에도 FAIL 시 진산님 명시 보고 + 트리거 대기

---

## 6. 메타 통계 (본 세션 027 종료 시점)

| 항목                        | 값                                                                                                       |
| :-------------------------- | :------------------------------------------------------------------------------------------------------- |
| 누적 commit (Step 0~19)     | ~70+ (handoff-027 §1 9 commits + 직전 누적)                                                              |
| 모노레포 테스트             | 949 PASS                                                                                                 |
| 마이그레이션                | 17 (production 미적용)                                                                                   |
| ROADMAP §8 진척률           | 100% (8/8 항목 [x])                                                                                      |
| 본 세션 후속 작업 (Phase A) | 검토서 7건 흡수 + 보안 패치 + Sprint 0 baseline ~3일 + Sprint 1 P0 GREEN ~5일 = **~9-10일 새 세션 분량** |

---

## 7. 본 핸드오프의 한계 (정직)

검토서가 본 보고서에 던진 7가지 인지 부조화는 **본 핸드오프 작성자 (Claude Opus 4.7) 자신이 작성한 보고서의 결함**이다. 따라서 본 핸드오프는:

1. **Phase A 흡수 시 본 핸드오프 작성자 자신이 자기 작성물을 수정** = 자기방어 편향 위험
2. **새 세션의 Claude 가 검토서를 진지하게 받아들일 의무** — 검토서 7건 모두 흡수 (선택적 흡수 금지)
3. **Sprint 0 baseline 측정 시 PASS 수치를 사전 결정 금지** — Mephisto 예언이 5/5 적중하든 0/5 적중하든 측정값 그대로 보고

새 세션의 Claude 에게: **본 핸드오프 작성자보다 검토서 + 테스트 계획서를 더 신뢰해라**. 본 핸드오프는 navigation, 검토서는 substance.

---

**핸드오프 작성자**: Claude (Opus 4.7 1M context) — Session 027
**다음 세션**: Session 028 — Phase A → B → C → D
**작성 효력**: 2026-05-01 ~19:30 KST
**예상 종료**: Sprint 1 P0 17건 GREEN 후 → handoff-029 (BATCH-1 진입 트리거 대기)
