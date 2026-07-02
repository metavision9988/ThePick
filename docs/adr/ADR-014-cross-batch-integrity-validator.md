# ADR-014: Cross-Batch Integrity Validator (CBIV)

작성일: 2026-04-26
상태: **Amended** (2026-07-02 C 축소 개정 — 원 Accepted 2026-04-26. 현행 효력 = 하단 §개정 이력)
관련: ADR-011, ADR-018, ADR-021
검토서 §2 결함 D + G (P0 Critical, 핵심)

> ⚠️ **2026-07-02 Amended**: 이하 본문(Context/Decision/Consequences)은 2026-04-26
> 원문 그대로 보존한다(원안 설계 이력 — 삭제 금지). **현행 효력은 하단 §개정 이력
> (2026-07-02 C 축소 개정)이 우선한다** — `packages/cbiv/` 풀스펙은 구현하지 않으며,
> 공식 경로 = 수동 프로토콜 + A안 무결성 러너. Hard Rule 20/24 재정의 포함.

## Context

기존 Validation Framework (Level 1~3) 는 **단일 BATCH 내부 검증**에 집중. BATCH 간 회귀는 진산님 수기 검수에 의존 — 14 BATCH × 6 Layer 누적 시 인간이 모든 cross-reference 추적 **불가능**.

핵심 위험 시나리오:

- BATCH-4 적재 시 신규 산식 F-30 이 임계값 0.20 하드코딩
- 그러나 26년 개정 (BATCH-R1, CONST-901, 0.10) 적용 영역
- 인간이 모든 BATCH 의 모든 Golden Test 를 매번 재실행 못함
- → BATCH-R1 의 Golden ("손해정도비율 = 0.10") 깨짐을 인지 못한 채 적재
- → 학습자가 잘못된 정보로 시험 준비 → **서비스 사망**

진산님 명시 (검토서 §2-D, G):

> _"Claude Code 가 스스로 생성한 JSON 산출물이 기존에 적재된 다른 BATCH 의 Graph 노드들과 논리적으로 충돌하지 않는지, 시스템적(자동화된)으로 교차 검증할 수 있는 장치는 어떻게 구체화할 계획이십니까?"_

## Decision

**CBIV (Cross-Batch Integrity Validator)** — 5번째 코어 모듈 신설.

별도 패키지 `packages/cbiv/` 에 6단계 자동 검증 (5 차단 + 1 인간 결정):

1. **참조 무결성** (외래키 + exam_id + approved) — 즉시 차단
2. **의미 중복** (Adaptive Threshold, ADR-021) — flag → 인간 결정
3. **상수 일관성** (exact-match) — 즉시 차단
4. **SUPERSEDES 체인** (DFS 순환 + revision_change_id) — 즉시 차단
5. **회귀 Golden Test 재실행** (D1 Preview, ADR-018) — 즉시 차단 + root-cause-analyzer
6. **출제영역 정합성** — 경고 → 인간 결정

세부: [`docs/architecture/CBIV.md`](../architecture/CBIV.md)

**Hard Rule 20**: 신규 BATCH 적재는 CBIV 6단계 통과 후에만 D1 INSERT.
**Hard Rule 24**: Golden Test 영구 보존 + CI/CD 자동 재실행.

### Stage 6.5: BATCH Load Protocol 통합

기존 8단계 → **10단계** ([`BATCH_LOAD_PROTOCOL.md`](../architecture/BATCH_LOAD_PROTOCOL.md)):

- Stage 6.5: CBIV 6단계 자동 검증 (NEW)
- Stage 7.5: 의미 중복 인간 결정 (NEW, [`ADMIN_REVIEW_UI.md`](../architecture/ADMIN_REVIEW_UI.md))
- Stage 10: Golden Test 영구 보존 + CI/CD 등록 (NEW)

## Consequences

### 긍정적

- Cross-BATCH 회귀 자동화 — 인간 검수 한계 돌파
- BATCH 누적 시 시스템 자살 방지
- root-cause-analyzer 로 실패 원인 자동 분석 — 디버깅 시간 단축
- Golden Test 영구 보존 — CI/CD 매 PR 마다 자동 재실행

### Trade-offs

- ~600 LOC + 4 마이그레이션 추가
- BATCH 적재당 +30초 (회귀 Golden 재실행)
- D1 Preview Database 비용 (CI 1회 ~$0, 무료 한도 내)

### 코드 위치

```
packages/cbiv/                       # 5번째 코어 패키지
├── src/
│   ├── stages/
│   │   ├── 1-referential.ts
│   │   ├── 2-deduplication.ts        # Adaptive Threshold (ADR-021)
│   │   ├── 3-coherence.ts
│   │   ├── 4-supersedes.ts
│   │   ├── 5-regression.ts            # ★ 핵심
│   │   └── 6-scope.ts
│   ├── runner/
│   │   ├── d1-preview-runner.ts       # ADR-018
│   │   ├── golden-test-runner.ts
│   │   └── root-cause-analyzer.ts
│   └── reports/
└── tests/
```

### 진산님 결정 1: BATCH-1 dry-run 전 완성 (메타 관찰자, 확정)

---

## 개정 이력 (Amendment)

### 2026-07-02 — C 축소 개정 (결재 #4 (b), MASTER_PLAN WS-2d / Binary Gate G-WS2 ④)

> 결재: 진산 2026-07-02 일괄 결재("결재 카드 전부 권고대로", 기록 커밋 3adb10a) —
> `docs/plans/master-remediation-20260610/decision-card-4-adr-014-cbiv.md` (b) 채택.
> 개정 사유: 원안 `packages/cbiv/` 는 BATCH-1~7 + L/R production 적재 완료
> (794 노드 / 1274 엣지) 시점까지 **0 LOC** — "Accepted ADR 미이행" 모순(카드 #4
> 실조사 표: `grep -rn "CBIV|cbiv" packages/ apps/` = 0건, `.github/workflows/` 에
> `cbiv-regression.yml` 부재)을 실태 맞춤 축소 개정으로 해소한다. MASTER_PLAN §2.3
> 기존 처분("풀스펙 즉시 구현 = 이연 — 수일 규모 투자 대비 러너 수십 줄로 동일 보호",
> MASTER_PLAN.md:91)과 정합.

#### A-1. 공식 경로 재정의 — "수동 프로토콜 + A안 러너"

원안 Decision 의 `packages/cbiv/` 6단계 자동 검증 패키지는 구현하지 않는다.
Cross-Batch 무결성의 **공식 경로**를 다음 2축으로 명문화한다:

1. **A안 무결성 러너** (실재 코드 — production 실측으로 보호 능력 입증):
   - `packages/quality/src/graph-integrity.ts:329` `validateGraphIntegrity` —
     고아 노드 / 끊긴 엣지 / SUPERSEDES 순환(DFS) / ID 중복 (원안 Stage 1·4 상당)
   - `packages/quality/src/production-audit.ts` (헤더 :1-23, 순수 코어·IO 무의존) —
     ① 활성 엣지→비활성 노드(유령 참조) ② 항해성(whitelist in-degree 0 도달불가) 추가
   - `scripts/run-graph-integrity-production.ts` (:1-24) — production D1 read-only
     덤프 IO 러너 (production 쓰기 0 · fabricate 차단 — 덤프 부재 시 가짜 PASS 없이 명시 에러)
   - 실측 입증: E0-2 1차 실측(2026-06-10)에서 유령 참조 103 · 고아 24 · 도달불가 133
     검출 → Track A-1 수리(커밋 c426f2c: 본체 11 복원·유령 103 전소) → 러너 재검증으로
     유령 0 확인 (`docs/plans/e0-2-graph-repair.plan.md` §0·§8).
2. **수동 프로토콜**: `docs/architecture/BATCH_LOAD_PROTOCOL.md` 의 Level 1~3 검증 +
   진산 샘플 검수 게이트. 동 문서 "Stage 6.5: CBIV 6단계 자동 검증" 단계는 본 개정
   이후 **"A안 러너 실행 + 수동 검수"** 로 읽는다 (연계 문서 본문 동기는 §A-7).

#### A-2. Hard Rule 20 재정의

- 구(원안): "신규 BATCH 적재는 CBIV 6단계 통과 후에만 D1 INSERT."
- **신(현행)**: "신규 BATCH 적재는 **① A안 무결성 러너 gatePass(고아 · 끊긴 엣지 ·
  SUPERSEDES 순환 · 유령 참조) + ② 수동 프로토콜(Level 1~3 검증 + 진산 검수) 통과**
  후에만 D1 INSERT."
- §A-3 러너 확장 완료 후에는 상수 대조·Golden 회귀 게이트도 ①의 gatePass 에 편입된다.

#### A-3. 잔여 의무 — Stage 3(상수 대조) · Stage 5(Golden 회귀) 러너 확장

원안 Context 의 핵심 위험 시나리오(26년 개정 상수 0.10 vs 하드코딩 0.20 회귀)는
Stage 3(상수 일관성 exact-match) + Stage 5(회귀 Golden Test) 영역이며, 현 A안 러너의
미커버 공백(입력 = knowledge_nodes/edges 만)과 정확히 겹친다(카드 #4 실조사). 따라서:

- **Stage 3 상수 대조 + Stage 5 Golden 회귀를 A안 러너(quality 패키지) 위 증축으로
  구현하는 것이 본 개정의 잔여 의무다.** 별도 plan(Binary Gate 동봉) → 진산 결재 →
  구현 절차를 따른다.
- **데드라인: 2027 개정 R-BATCH 착수 전.** 미이행 상태로 R-BATCH 진입 금지 — 본 조항이
  R-BATCH 진입 게이트다.

#### A-4. Stage 2(의미 중복) · Stage 6(출제영역) — 수동 프로토콜 잔존

- Stage 2(ADR-021 Adaptive Threshold, flag→인간 결정) · Stage 6(출제영역 정합성,
  경고→인간 결정)은 원안에서도 최종 판정 주체가 인간이었다 — 자동 flag 생성기 없이
  **수동 프로토콜로 잔존**한다.
- **재상신 조건**: R-BATCH 규모 확대(대상 노드/엣지 건수는 재상신 시 명시)로 수동 검수
  부담이 임계를 넘으면, Stage 2/6 자동화(flag 생성기 + Admin 결정 큐 — 원안
  ADMIN_REVIEW_UI 범위)를 별도 결재로 재상신한다.

#### A-5. Path A(Claude 직접 적재) 전제 정합화 — ADR-018 CI 전제 캐비엇

- 원안 Hard Rule 24("Golden Test 영구 보존 + **CI/CD 자동 재실행**")와 ADR-018 의
  `cbiv-regression.yml` PR-트리거 CI 파이프라인은 "BATCH 적재 = 코드 PR" 전제였다.
  실태는 **Path A = Claude Code 직접 적재**(메모리 project_batch_load_workflow —
  BATCH-1~7 production 적재가 실질적으로 json-to-sql→wrangler 채널) — PR 이벤트가
  적재 행위를 대표하지 않는다.
- 정합화: Golden Test **영구 보존** 의무는 불변. **재실행 트리거는 "적재 세션 내
  러너/vitest 실행"(Stage 5 확장 후)으로 재정의**한다. ADR-018 의 D1 Preview 실행
  환경(로컬 `--local` 1차 + `--preview` 최종)은 Stage 5 러너 확장 시 실행 환경으로
  유효하게 승계하되, **CI PR-트리거 전제는 본 캐비엇이 대체한다** (ADR-018 본문은
  원안 보존 — 캐비엇 정본 = 본 섹션).

#### A-6. 스테이지별 처분 총괄

| 원안 Stage    | 원안 방식                             | 현행 (Amended)                                                              |
| :------------ | :------------------------------------ | :-------------------------------------------------------------------------- |
| 1 참조 무결성 | packages/cbiv 즉시 차단               | **A안 러너** (graph-integrity + production-audit 유령 참조·항해성)          |
| 2 의미 중복   | Adaptive Threshold flag → 인간        | **수동 프로토콜 잔존** (§A-4 재상신 조건부)                                 |
| 3 상수 일관성 | exact-match 즉시 차단                 | **잔여 의무 — 러너 확장** (§A-3, 2027 R-BATCH 착수 전)                      |
| 4 SUPERSEDES  | DFS 순환 즉시 차단                    | **A안 러너** (findSupersedeCycles) + DB 트리거 1단계 가드(0014:181-200)     |
| 5 회귀 Golden | D1 Preview + CI 자동 재실행 (ADR-018) | **잔여 의무 — 러너 확장** (§A-3) + 재실행 트리거는 적재 세션 내 실행 (§A-5) |
| 6 출제영역    | 경고 → 인간                           | **수동 프로토콜 잔존** (§A-4 재상신 조건부)                                 |

#### A-7. 연계 문서 처분

- `docs/architecture/CBIV.md` · `BATCH_LOAD_PROTOCOL.md`(Stage 6.5/8/10) ·
  `ADMIN_REVIEW_UI.md` 는 **원안 설계 문서로 보존**한다. 현행 효력은 본 개정 기준이며,
  세 문서의 본문 동기(CBIV 언급을 A안 러너+수동 프로토콜로 치환)는 §A-3 Stage 3/5
  확장 plan 에서 일괄 처리한다 — 그때까지의 문서↔실태 간극은 본 섹션이 정본으로 차단.
- 원안 "Trade-offs / 코드 위치 / 진산님 결정 1(BATCH-1 dry-run 전 완성)"은 미이행
  이력으로 보존 — 카드 #4 실조사 표가 약속 vs 실태 대조의 영속 기록이다.
