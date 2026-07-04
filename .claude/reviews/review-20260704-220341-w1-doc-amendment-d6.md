# 독립 리뷰 — W1 문면 정합 (D-6) amendment

- **일시**: 2026-07-04 22:03 KST
- **대상**: 플레이북 `opus-dual-track-playbook-20260704.md` W1 집행분 (엔진분리 R5 결재 → stale 문서 개정)
- **방식**: 독립 Workflow(`w1-doc-amendment-review`, run `wf_afe6d441-574`) — **14 에이전트**(4 리뷰 렌즈 + 발견별 적대 반증), 91 tool uses, ~14분. 자가 리뷰 금지(가드레일 #12) 준수.
- **모델**: 리뷰·반증 에이전트 = Opus 4.8 (독립 컨텍스트 — 산출 과정 미인지).

## 리뷰 범위 (변경 파일)

| #   | 파일                                                                         | 개정                                               |
| --- | ---------------------------------------------------------------------------- | -------------------------------------------------- |
| 1   | `docs/plans/master-remediation-20260610/MASTER_PLAN.md`                      | #17 인라인 마커 + 🔄 개정 블록(§2.3 부분개정 포함) |
| 2   | `docs/audit/EXPANSION_GATE_DESIGN_20260611-073814.md`                        | 상단 🔄 배너 + H3·E2-0·E3-1 인라인 마커 3          |
| 3   | `docs/adr/ADR-007-multi-exam-deferred-to-year-2.md`                          | 상태줄 + `## Amendment (2026-07-04)` + 수정이력    |
| 4   | `docs/adr/ADR-036-auth-cookie-samesite-cross-origin.md`                      | deadline 마커 + `## Amendment note (2026-07-04)`   |
| 5   | `.claude/rules/auto-review-protocol.md`                                      | Pass 2 truth_weight 종목-registry 각주             |
| 6   | `docs/playbooks/_template/README.md` **(신설, D-7)**                         | 인스턴스화 절차 + 버전 스탬프 규약                 |
| 7   | `docs/playbooks/_template/content-load.playbook.template.md` **(신설, D-7)** | e0-8 골격 종목 파라미터화                          |
| 8   | `docs/FRAMEWORK.md`                                                          | T4 정본 위치 "(신설 예정)" → 실재                  |

## 4 렌즈 판정

| 렌즈              | raw 발견 | CONFIRMED      | REFUTED | checked 증거                                                                                         |
| ----------------- | -------- | -------------- | ------- | ---------------------------------------------------------------------------------------------------- |
| **원문 보존**     | 0        | 0              | 0       | 7 (git --numstat 삭제6=교체6, strip-marker==HEAD 4/4 byte-match, 표 파이프 보존, 블록 표 밖 삽입)    |
| **R5 정확성**     | 2        | 0              | 2       | 8 (전기기사=2호·A안·supersede아님·in-place 이연·SameSite·미결정 명시·루트도메인 미정 전부 정본 일치) |
| **신규 모순**     | 4        | 0              | 4       | 6 (E3-4=B안 시점 유효 분리 확인, in-place 이연 일치, G-1 신규언어 0, CLAUDE.md 멀티트랙 정합)        |
| **템플릿 충실도** | 4        | 0              | 4       | 7 (불변규칙 9/9·Gate 7/7·에스컬레이션 7/7 보존, 손해평가사 하드코딩 0)                               |
| **합계**          | 10       | **1**(타 파일) | 9       | 28                                                                                                   |

### CONFIRMED 1건 (MINOR) — 즉시 해소

- **파일**: `docs/feasibility/exam2-electrical.feasibility.md` (W1 개정 대상 아님 — **선재 stale**)
- **내용**: 헤더 상태줄(line 5) "R5 진산 대기" ↔ 본문 §R5(line 62) "★2026-07-04 결재 완료 (Q1~Q5 ☑)" 상호모순. 5종 amendment가 이 문서 R5를 '2호=전기기사' 근거로 인용 → 인용 소스의 헤더 stale이 체인 약화.
- **처분**: 헤더 상태줄을 본문 §R5(실제 진산 결재) 기록에 정합 — "R5 진산 결재 완료 (2026-07-04 구두 — Q1~Q5 ☑)". **✅ 수정 완료** (2026-07-04 22:03). 순수 문면 정합(새 결정 0). D-6 취지 내.

### REFUTED 9건 (위양성 — 반증 근거 요지)

1. **truth_weight 각주 과잉**(MINOR) → 종목별 registry 소유는 R5 A안 결재 원칙(decision-card §3·FRAMEWORK T3·Hard Rule 15). 예시 대괄호+"등" 헤지, 구체 가중값 미확정. 손해평가사 규칙 후방호환.
2. **ADR-007 login_history 누락**(MINOR) → 산문 예시 괄호(범주 약칭 "구독" 혼재 = 비망라 자명), 정본 decision-card 1참조 거리. under-list는 과잉(초과기록) 아님.
3. **decision-card 자기모순**(MAJOR) → 헤더 "4건 확정+1건 미결"은 _엔진분리 R5 스냅샷_ 스코프. row#4 후속발화 병기 = 시계열 기록. 2호=전기기사 권위 기록은 feasibility §R5에 명확, amendment는 3근거 인용으로 카드 E-4 단일 비종속.
4. **EXPANSION_GATE E2-2 미정합**(MAJOR) → W1 스코프는 E2-0만(플레이북 §W1 명문). E2-2는 이미 "수정 발생 시 전건 목록화=E3 입력" + 플레이북 exam2-core-diff-ledger(E2-2 원장)로 정합. E2-2 개정 = R5 미결 정책 발명(과잉). 복소수 축은 spike S6 승계.
5. **MASTER_PLAN §2.3 line96 무마커**(MINOR) → #17(완전번복)과 §2.3(핵심 이연 유지·부분개정)은 구조 상이 → 차등 처리 정당. 🔄 블록이 자기해소. 원문 삭제 0.
6. **템플릿 {{exam}}/{{exam_id}} 분열**(MAJOR) → **의도적 2토큰 설계**(exam_id=풀 id 팩경로 / exam=짧은 라벨 manual-electrical). CLAUDE.md:93 규약(jeon-gi-gi-sa vs electrical) 정합. 발견의 카운트("3회")도 사실오류(실측 5). README와 스킴 일치.
7. **템플릿 중첩 placeholder**(MINOR) → "`{{` 잔존 0" 백스톱이 외부·내부 모두 강제 해소 = complete-by-construction. either/or 모호성 없음.
8. **템플릿 Ontology Lock "또는"**(MINOR) → "종목 registry"의 두 소재지 열거. ELEC ID는 1호 registry 패턴 부재로 검증 FAIL(무음혼입 구조 불가) + {{ID_PATTERN}} 분리 + 트랙 경계 3중 방어.
9. **README 스탬프 필드 누락**(MINOR) → 템플릿 파일=원형(파생 산출물 아님, 규약 스코프 밖). package는 다-패키지 플레이북 헤더에 부적용(산출물별 부착).

## 판정

**완료 가능** — 4-Pass/다렌즈 독립 리뷰 **CRITICAL 0 / MAJOR 0(생존)** + CONFIRMED 1(MINOR·타 파일 선재)= 즉시 해소. W1 개정 8파일 자체 결함 0(원문 보존·R5 정확·모순 0·템플릿 충실 전부 확증).

**메타 관찰**: 반증 단계가 raw 10건 중 9건을 위양성으로 격추(MAJOR 2건 포함) — 문서 개정 작업 특유의 "형식 비대칭 = 결함" 오탐을 적대 반증이 정확히 걸러냄(원문 보존·과잉 아님·불확실=REFUTED 원칙). 유일 생존 발견이 오히려 **W1이 개정하지 못한 선재 stale**(인용 소스)을 짚어 D-6 커버리지를 넓힘.
