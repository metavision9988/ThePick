# Phase N 기술부채 5-페르소나 통합 인덱스

- ts: `20260714-012918`
- 프로토콜: `.claude/rules/auto-review-protocol.md` — Phase 단위 5-페르소나 독립 병렬 기술부채 리뷰 (4-Pass 와 별개, 6개월~2년 horizon 전용)
- 페르소나 5종 **전원 실행·발견 접수** (누락/미실행 0 — 아래 §0 확인)
- 개별 보고서:
  - `phaseN-tech-debt-20260714-012918-refactoring-expert.md`
  - `phaseN-tech-debt-20260714-012918-performance-engineer.md`
  - `phaseN-tech-debt-20260714-012918-quality-engineer.md`
  - `phaseN-tech-debt-20260714-012918-backend-architect.md`
  - `phaseN-tech-debt-20260714-012918-devops-architect.md`

---

## §0 페르소나 실행 커버리지 (은폐 금지)

| 페르소나             | 실행 | 발견(C/M/m) | 비고                   |
| -------------------- | ---- | ----------- | ---------------------- |
| refactoring-expert   | ✅   | 0 / 2 / 2   | REF-1~4                |
| performance-engineer | ✅   | 0 / 3 / 2   | PE-1~5                 |
| quality-engineer     | ✅   | 0 / 3 / 2   | QA-1~5                 |
| backend-architect    | ✅   | 0 / 3 / 3   | BE-1~6                 |
| devops-architect     | ✅   | 1 / 3 / 3   | DO-1~7, ★유일 CRITICAL |

미실행 페르소나 **없음**. 0건 보고 페르소나 **없음**.

---

## §1 자기 채점 금지 교차검증 (raw → dedup)

- **raw 발견 합계 = CRITICAL 1 / MAJOR 14 / MINOR 12** (총 27건)
- **dedup 후 = CRITICAL 1 / MAJOR 14 / MINOR 11** (총 26건)
- 병합 1건: **REF-3(MINOR) → BE-1(MAJOR)** — 동일 file:line `apps/api/src/public/routes.ts:65`(FIXED_EXAM_TYPE) · 동일 근본증상(공개 표면 examId/종목 미파라미터화). refactoring 은 복붙유혹(MINOR), backend 는 Rule 16 zero-cost 파괴(MAJOR)로 프레이밍만 다름 → MAJOR 로 병합·교차합의 표기. MINOR 1 감소, MAJOR 불변.
- **★CRITICAL 병합 귀속 명시**: raw CRITICAL 1건 = **DO-1**(read-public-analytics --alert cron 미배선). 진앙 RC-2 로 귀속되나 quality QA-1(구조 백스톱 삭제)과는 상호보완(구조 vs 관측)이라 **동일 file:line 아님 → 병합 대상 아님 = CRITICAL 은 dedup 후에도 1로 존속**. raw CRITICAL 1 > 0 이므로 dedup critical=0 보고는 거짓음성 — 본 INDEX 는 **critical=1** 확정.

### 합계 표

| 심각도   | raw | dedup  | 병합 내역                           |
| -------- | --- | ------ | ----------------------------------- |
| CRITICAL | 1   | **1**  | 병합 없음 (DO-1 존속)               |
| MAJOR    | 14  | **14** | REF-3 흡수(순증 0, BE-1 이미 MAJOR) |
| MINOR    | 12  | **11** | REF-3 → BE-1 병합으로 −1            |
| 합계     | 27  | **26** | 교차 병합 1건                       |

---

## §2 CRITICAL 한 줄 매트릭스

| #          | 페르소나 | 요지                                                                                 | 영향                                                                                                                        | 우선 버킷                                                                         |
| ---------- | -------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| C-1 (DO-1) | devops   | 무음 오채점 텔레메트리 리더(`read-public-analytics --alert`)가 어떤 cron 에도 미배선 | 라이브 `/practice/` 채점 결함(422 defect + choice_id 정합성)이 인간에게 자동 도달 0 — 정답오류 36건 잠복 선례와 동일 클래스 | **즉시** (배선만 하면 됨: ops.yml 일간 job + CLOUDFLARE_API_TOKEN Analytics Read) |

CRITICAL 1건 = **"완료" 선언 차단** (§5 참조).

---

## §3 진앙(Root Cluster) — 다수 페르소나가 같은 뿌리를 가리키는 부채 묶음

### RC-1 — 공개 홍보 표면의 멀티종목 경계 부재 + 경계·채점 로직 복붙

- 구성: **REF-1**(MAJOR /grade·/reveal 복붙), **REF-4**(MINOR overview/next 인라인), **BE-1**(MAJOR examId 경계 우회, REF-3 병합)
- 교차 페르소나: refactoring + backend
- 뿌리: `apps/api/src/public/routes.ts` 4핸들러가 examId 미파라미터화 + 경계/채점 로직을 손으로 복제
- 권고 액션: `requireExamId` seam 도입(WHERE 는 Year 1 무적용) + `fetchGradableRow`/`reissueCorrectChoiceIds`/`parseMcOrRefuse`/`buildBaseServeWhere` 헬퍼 추출로 단일 정본화 + exam_id 컬럼 마이그 slot 예약·주석 seam

### RC-2 — 라이브 채점 무음 오채점 안전망 공백 (구조 백스톱 삭제 + 자동 알림 미배선) ★CRITICAL 소속

- 구성: **QA-1**(MAJOR serving-guard 삭제 = 구조 백스톱 결손), **DO-1**(CRITICAL 텔레메트리 미배선 = 관측 백스톱 결손), 연계 **BE-6**(choiceId 회전 오채점)
- 교차 페르소나: quality + devops (+ backend 연계)
- 뿌리: 실 수험생을 채점하는 라이브 표면이 오채점에 대해 구조 가드도 관측 알림도 자동으로 갖지 못함
- 권고 액션: (1) DO-1 즉시 배선 — ops.yml 일간 `read-public-analytics --alert`(exit 2 → 알림) (2) 인증 study 경로 fill_blank 분기에 공개 isServable 동형 구조 가드 복원 + 회귀 테스트를 데이터-스냅샷과 별도 영속

### RC-3 — 인증 grade hot path D1 과부하 + rate_limits 이중구현/무한성장

- 구성: **PE-1**(MAJOR rate-limit D1 write amplification), **PE-2**(MAJOR grade 8~10 왕복 직렬 chain), **BE-2**(MAJOR rate_limits retention 부재 부분)
- 교차 페르소나: performance + backend
- 뿌리: `apps/api/src/study/routes.ts` grade 경로가 요청당 D1 write + 직렬 왕복, rate_limits 는 네이티브 바인딩 미사용에 GC 도 없음
- 권고 액션: 인증 rate-limit 을 CF 네이티브 바인딩 통일 + 독립 read Promise.all 병렬화 + rate_limits 만료 버킷 prune cron

### RC-4 — 회귀 검출 게이트 자기무력화 (perf/coverage gate 영구 green)

- 구성: **QA-2**(MAJOR CI ×3 slack 이 BREAKER 무력화), **QA-3**(MAJOR PRF-01 6/51 동결 self-fulfilling green)
- 교차 페르소나: quality (단일 페르소나, 그러나 뿌리 동일 = 게이트가 구조적으로 red 안 됨)
- 뿌리: 성능/커버리지 회귀 게이트가 CI 에서 실제 회귀를 흡수·영구 통과
- 권고 액션: ×N 곱셈 slack → 상대-회귀 baseline(Δ% 임계) / 반복+중앙값·CPU-time 통계 흡수 + totalFormulas·sample 을 레지스트리 동적 도출(fixture-derive)

### RC-5 — 데이터 수명주기·상태전이 비대칭 (append-only 무한성장 + exam_questions 마이그전용)

- 구성: **BE-2**(MAJOR GC/retention 전반), **BE-3**(MAJOR exam_questions 마이그전용 mutable), **DO-3**(MAJOR R2 lifecycle 부재 부분)
- 교차 페르소나: backend + devops
- 뿌리: append-only 테이블·R2 객체에 retention SLO 부재, exam_questions status 만 마이그 전용(knowledge_nodes append-only 로그와 비대칭)
- 권고 액션: 테이블별 retention SLO + R2 lifecycle 규칙 + exam_questions status 전이의 status_transitions(또는 전용 로그) 외부화 ADR

### RC-6 — 운영 자격증명·DR 성숙도 공백

- 구성: **DO-2**(MAJOR CF token runbook/스코프 부재), **DO-3**(MAJOR R2 복원드릴 미검증), **DO-4**(MAJOR 60일 자동 비활성화 트랩), **DO-5**(MINOR 단일 알림채널), **DO-6**(MINOR Logpush 부재), **DO-7**(MINOR 배포 스모크 auth 미검증), **BE-6**(MINOR choiceId JWT_SECRET 재사용)
- 교차 페르소나: devops + backend
- 뿌리: crown-jewel 토큰·백업·자동화·시크릿 회전의 운영 성숙도가 라이브 서비스 기준 미달
- 권고 액션: CLOUDFLARE_API_TOKEN 인벤토리·스코프·회전 절차 + 분기 restore 드릴 + keep-alive 워크플로 + CHOICE_ID_SECRET 분리 + 알림 이중화

---

## §4 페르소나 교차 합의 맵

| 발견/뿌리                         | refactoring | performance | quality | backend | devops |
| --------------------------------- | :---------: | :---------: | :-----: | :-----: | :----: |
| RC-1 public 표면 경계·DRY         |      ●      |             |         |    ●    |        |
| RC-2 채점 무음 오채점 안전망 ★C   |             |             |    ●    |   (○)   |   ●    |
| RC-3 grade hot path + rate_limits |             |      ●      |         |    ●    |        |
| RC-4 회귀 게이트 자기무력화       |             |             |    ●    |         |        |
| RC-5 데이터 수명주기·상태전이     |             |             |         |    ●    |   ●    |
| RC-6 운영 자격증명·DR             |             |             |         |   (○)   |   ●    |

● 주도 발견 / (○) 연계

---

## §5 "완료" 선언 판정

- 기준: **4-Pass CRITICAL 0 AND 5-페르소나 CRITICAL 0**
- 현재: 5-페르소나 **CRITICAL 1건(C-1/DO-1)** 존재 → **"완료" 선언 불가**
- MAJOR 14건: phase 종료 전 해결 또는 다음 phase 초기 태스크로 **명시 이월** 의무

### 이월/처리 큐 (권고 순서)

1. **[즉시·CRITICAL] C-1(DO-1)** — ops.yml 일간 `read-public-analytics --alert` 배선 + CLOUDFLARE_API_TOKEN(Analytics Read). exit-code 규약 이미 cron 전제 → 배선만.
2. **[phase 종료 전·MAJOR] RC-2 QA-1** — 인증 study fill_blank 구조 가드 복원 + 회귀 테스트 (정답 100% 불변 직격, 다음 1차 적재 전 필수)
3. **[phase 종료 전·MAJOR] RC-3 PE-1/PE-2/BE-2** — 인증 rate-limit 네이티브 통일 + grade 병렬화 + rate_limits prune
4. **[다음 phase 초기·MAJOR] RC-1 REF-1/BE-1** — public 헬퍼 추출 + requireExamId seam (BE-1 보기추출 랜딩 전 시퀀싱)
5. **[다음 phase 초기·MAJOR] RC-4 QA-2/QA-3** — 회귀 게이트 상대-baseline / fixture-derive
6. **[다음 phase 초기·MAJOR] RC-5 BE-3/DO-3, RC-6 DO-2/DO-4** — 데이터 수명주기 + 운영 자격증명·DR
7. **[MINOR 관측·이월] REF-4·PE-3·PE-4·PE-5·QA-4·QA-5·BE-4·BE-5·BE-6·DO-5·DO-6·DO-7** (11건)

> ★ RULE #5: GO/STOP·GO-NO-GO 결재는 인간(진산)이 결정한다. 본 INDEX 는 사실(🟢/🟡/🔴)만 못박으며 처리 착수는 결재 후.
