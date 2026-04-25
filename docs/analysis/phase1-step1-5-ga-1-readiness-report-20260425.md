# Phase 1 Step 1-5 (가-1) 진입 판단 — 종합 보고서

작성일: 2026-04-25
작성자: Claude (메인 컨텍스트 — 자가 작성, 독립 검증 아님)
용도: 진산님 가-1 plan 승인 판단 자료

---

## 1. 프로젝트 좌표

**제품**: 쪽집게(ThePick) — 손해평가사 자격시험 AI 학습 서비스
**비전 (메모리 인덱스 기준)**: 자격증 도메인별 Graph RAG + 훈련 콘텐츠 자동 생성 엔진 MVP
**합격률 목표**: 60%
**Year 1 범위**: 손해평가사 단일 시험. Year 2 Phase 4에 멀티시험 확장 (ADR-007).

**현재 위치**:

```
Phase 0 [완료] → Phase 1 [진행 중]
  ├─ Step 1-1 PBKDF2 인증 [완료]
  ├─ Step 1-2 결제 webhook [완료]
  ├─ Step 1-3 Logger DI 전환 [완료]
  ├─ Step 1-4 JWT 세션 + Refresh Rotation [완료]
  ├─ Step 1-5 (나) 진도 API 엔진 통합 [완료]  ← 인증 엔진 첫 실전 마운트
  ├─ Step 1-5 (가-0) 교재 파이프라인 스켈레톤 [완료]  ← fixture/mock 기반
  └─ Step 1-5 (가-1) BATCH-1 실적재 [대기 중]  ← 본 plan
```

브랜치: `main` / origin/main 대비 9 commits ahead (미푸시) / 미커밋 변경 0건 (Guide/ untracked 2건은 Hard Limit 영역, 본 작업 무관)

---

## 2. 코드베이스 현황

### 2.1 모노레포 구조 (4 apps + 7 packages = 11 워크스페이스 + 루트)

| 영역     | 워크스페이스               | 상태                                         |
| :------- | :------------------------- | :------------------------------------------- |
| apps     | `web`                      | 골격 (PWA shell)                             |
| apps     | `admin-web`                | 골격                                         |
| apps     | `api`                      | **Production-ready** (인증/결제/진도 마운트) |
| apps     | `batch`                    | **가-0 완료** (스켈레톤 + fixture)           |
| packages | `shared`                   | 정착 (logger/exam-adapter/types/constants)   |
| packages | `formula-engine`           | 정착 (math.js AST + sandbox + Golden 통과)   |
| packages | `parser`                   | 정착 (PDF/Vision/Section/Schema/Ontology)    |
| packages | `parser-1st-exam`          | 골격 (시험특화 분리 자리)                    |
| packages | `quality`                  | 정착 (graph-integrity)                       |
| packages | `payment`                  | 정착 (Step 1-2)                              |
| packages | `study-material-generator` | 골격 (Phase 2)                               |

### 2.2 코드 규모

- 소스 파일: **92개 .ts/.tsx** (테스트 제외)
- 테스트 파일: **33개**
- 테스트 케이스: **591개** (grep 기준 추정 — `it(` / `test(` 시작 라인)

### 2.3 D1 마이그레이션 12종 적용 완료

```
0001 initial_schema             — 9 base tables
0002 1st_exam_extension         — exam_questions / mnemonic_cards 등
0003 temporal_guard_not_null    — 개정 무결성
0004 temporal_guard_extension   —
0005 not_null_triggers_completion
0006 users_and_auth             — Step 1-1
0007 users_strict_hardening
0008 webhook_events             — Step 1-2
0009 sessions                   — Step 1-4
0010 status_transitions_and_page_ref_guard  — 가-0
0011 revision_2026_constants_seed   — 가-0
0012 rate_limits                — 가-0 NC-2
```

가-1 신규 예정: `0011_supersedes_edges` (TD-045) — 기존 0011과 번호 충돌 가능, plan에서 0013으로 재할당 필요(★ 결정 포인트).

---

## 3. 가-0 완료 상태 (가-1 진입 직전 인프라)

### 3.1 파이프라인 골격

`apps/batch/src/pipeline.ts` — 9 stage 파이프라인 + BATCH 1~5 정의

| BATCH  | 페이지      | 영역                | 예상 노드 | 예상 엣지 | 예상 산식 |
| :----- | :---------- | :------------------ | --------: | --------: | --------: |
| 1      | p.403~434   | 적과전 종합위험     |        60 |       200 |        13 |
| 2      | p.435~500   | 종합위험 수확감소   |        80 |       300 |        17 |
| 3      | p.501~521   | 논작물 (벼/맥류)    |        40 |       120 |         8 |
| 4      | p.522~576   | 밭작물              |        60 |       200 |        15 |
| 5      | p.577~647   | 시설작물 + 수입감소 |        60 |       200 |        15 |
| **합** | (245 pages) |                     |   **300** |  **1020** |    **68** |

### 3.2 가-0에서 검증된 자산

- **Formula Engine**: math.js AST 파서 + sandbox + Golden Test (BATCH-1 fixture 13 산식 100% 정확도)
- **Parser**: pdfplumber subprocess + Vision OCR client + Section splitter + Ontology registry + Schema validator
- **Loader**: draft-loader (status 전이 draft→review→approved) + state-machine + local-db (idempotent migrations)
- **Quality**: graph-integrity (고아 노드 / 끊긴 엣지 / SUPERSEDES 순환 0건 검증)
- **Adapters**: anthropic-client + token-cost-logger + vision-client (실 호출은 가-1에서)
- **CLI smoke 통과 (커밋 f8dfb51)**: BATCH-1 dry-run JSON 2499 bytes / list / status 전이 E2E / migrations 멱등성

### 3.3 가-0 4차 리뷰 수렴 (CRITICAL 0건 도달)

```
1차: CRITICAL 5 (커밋 0f62860 해소)
2차: CRITICAL 2 + MAJOR 5 (커밋 a6ffc3d 해소)
3차: F4 CRITICAL + F1 HIGH (커밋 529104b 해소)
4차: S-1 CRITICAL (커밋 4b41f0a 해소)
→ 가-0 완료 선언 (2026-04-24)
```

---

## 4. 미해결 Tech-Debt 인벤토리 (52건 등록 / 가-1 차단·관련 5건)

`.claude/tech-debt.md` 기준 — 해소되지 않은 TD만 다룸. 전체는 파일 직접 참조.

### 가-1 Gate Group C 직결 (5건, plan 명시)

| ID         | 영역                               | 위험 등급             |
| :--------- | :--------------------------------- | :-------------------- |
| **TD-042** | examId 시그니처 주입 (Rule 16)     | Year 2 전환 차단      |
| **TD-043** | withRetry non-retryable 즉시 throw | 토큰 비용 3배 낭비    |
| **TD-044** | draft-loader lost-update race      | 메트릭 신뢰성         |
| **TD-045** | migrations SUPERSEDES 엣지         | Temporal Graph 무결성 |
| **TD-037** | Scheduled 외부 알림 (GC 실패 감지) | 운영 가용성           |

### 가-1 진입 전 권장 해소 (3차 리뷰 권고)

| ID         | 핵심                                                  |
| :--------- | :---------------------------------------------------- |
| **TD-038** | 200/201 응답 타이밍 oracle (현재 jitter 미적용)       |
| **TD-039** | 422/503 응답 jitter 미적용 (방어 일관성)              |
| **TD-040** | local-db.batch 중첩 트랜잭션 runtime 가드 (현재 주석) |
| **TD-041** | `@deprecated` 정적 검증 ESLint 룰                     |
| **TD-046** | mnemonic 역방향 검증 누락 (Hard Limit)                |
| **TD-049** | F1 보강 통합 테스트 10건 (회귀 방지선)                |

★ 결정 포인트: TD-038~041, TD-046, TD-049를 가-1 Group C 범위에 포함시킬지 / 별도 가-1.5로 분리할지 (현 plan은 5건만 명시).

### 가-1 외 누적 (Phase 1 후반전~Phase 2 이월)

- **인증/세션 계열**: TD-019~027 (활성 세션 상한 / dead code / JWT rotation 문서 등)
- **Progress API 계열**: TD-029~036 (CSRF / enumeration oracle / lost-update / FSRS 인라인 등)
- **인프라 잡음**: TD-001~018 (Step 1-2/1-3 잔여)
- **기타**: TD-047 (재정립서 v2.0 본문 정본 갱신), TD-048 (BATCH_CONFIGS 한국어 분리), TD-050~052 (가-1 Gate B 직결 + CLI 자동 회귀)

---

## 5. ADR 10건 (아키텍처 결정 기록)

| 번호 | 결정                                  | 영향                            |
| :--- | :------------------------------------ | :------------------------------ |
| 001  | 저작권 / 공개 라이선스                | 진산님 "신경끄라" — 메모리 등록 |
| 002  | Payment adapter 추상화                | Step 1-2 기반                   |
| 003  | FSRS-5 알고리즘 채택                  | Phase 2 본격 도입               |
| 004  | Vectorize embedding spec              | exam_id 메타데이터 필수         |
| 005  | PBKDF2-SHA256 인증                    | Step 1-1 적용                   |
| 006  | Cloudflare 단일 벤더                  | Sentry/PostHog/Resend 불채택    |
| 007  | 멀티시험 Year 2 이월                  | Hard Rule 15~17 도입            |
| 008  | Graceful Degradation 임계값           | 유사도 0.60 거부                |
| 009  | PII 마스킹 정책                       | 로그 마스킹 적용                |
| 010  | status canonical (formulas/constants) | 가-0에서 적용                   |

★ 가-1에서 신규 ADR 발생 가능 영역:

- TD-045 마이그레이션 번호 0011 충돌 → 0013 재할당 결정
- Cloudflare Email Routing API 선택 (TD-037)

---

## 6. 가-1 Gate 정의 요약 (`tasks/step-1-5-ga-1.gates.yaml`)

A → B → C → D → E 순차 (역순 금지 / 부분 통과 개념 없음 / CRITICAL RULE #7 기계적 게이트키퍼)

| Gate  | 그룹       | 핵심                                    | 통과 기준                                        |
| :---- | :--------- | :-------------------------------------- | :----------------------------------------------- |
| A-1   | 외부 계약  | 실 Claude API 5~10회 smoke              | 응답 잘림 1건+ / p99 < 30s / 유효 JSON 파싱 80%+ |
| A-2   | 외부 계약  | 실 pdfplumber p.403~405                 | text/table shape 일치 / stderr 분리 로깅         |
| A-3   | 외부 계약  | 실 Vision OCR 1회 (적과전 도표)         | 추출률 ≥ 80% / token-cost-logger 기록 확인       |
| B-1   | Simulation | `sim/pipeline-adversarial.ts` Mock 설계 | A 실측값 기반 (추측 금지)                        |
| B-2   | Simulation | 1000 시드 반복 + Invariant 6종          | 0 위반 / 결정론적 재현                           |
| C-1~5 | Tech-Debt  | TD-042/043/044/045/037 코드 패치        | tech-debt.md 5건 ✅                              |
| D-1   | 품질       | typecheck + lint + `pnpm -r test`       | 14 워크스페이스 green / 591+ tests PASS          |
| D-2   | 품질       | Guide Level 3 (1~4단계 전면)            | CRITICAL 0 / MAJOR ≤ 3 (TD 이월 명시)            |
| D-3   | 품질       | 4-Pass 독립 에이전트 리뷰               | CRITICAL 0 / 증거 3개+ / 반론 1개+               |
| E-1   | 인간 승인  | 진산님 BATCH-1 본 적재 착수 허가        | A/B/C/D 증거 + 비용 견적 + 롤백 + plan 갱신      |

---

## 7. 비용 견적 (실 Claude 호출)

| 단계                                      | 호출            | 토큰 추정 | 비용 (USD)        |
| :---------------------------------------- | :-------------- | :-------- | :---------------- |
| A-1 Claude smoke                          | Haiku 10회      | 35K       | **~$0.029**       |
| A-3 Vision smoke                          | Sonnet 1회      | 2.5K      | **~$0.020**       |
| **소계 (smoke)**                          |                 |           | **~$0.05** (50원) |
|                                           |                 |           |                   |
| BATCH-1 실적재                            | Haiku 32 페이지 | 112K      | ~$0.092           |
| Vision 도표 추가                          | Sonnet 1~3장    | 5~7.5K    | ~$0.10~0.30       |
| **소계 (BATCH-1)**                        |                 |           | **~$0.20~0.50**   |
|                                           |                 |           |                   |
| BATCH 1~5 전체 (Phase 1 가-1~5 합산 추정) |                 | ~5x       | **~$1.0~2.5**     |

⚠️ 정밀 비용은 A-1 실측 후 페이지당 토큰 정확값 기반 재계산 (E-1 체크리스트).

---

## 8. 위험 평가 (가-1 진입 시 관리 항목)

### 8.1 본 plan에 명시된 7건 (각 완화책 있음)

1. A-1 비용 폭주 → `SMOKE_CALLS=10` 하드코딩 + 사전 합의
2. C TD-042 시그니처 변경 회귀 → 가-0 시나리오 350+ 재실행 의무
3. C TD-045 마이그레이션 D1 데이터 손상 → idempotent + dry-run + UPDATE 금지
4. B Mock 추측 → gates.yaml 강제 (A 미통과 시 B 차단)
5. A-3 Vision 추출률 < 80% → 가-1 전체 중단 + 별도 ADR
6. TD-037 Cloudflare API 변경 → Context7 공식 문서 확인 후 작성
7. 4-Pass 자가 리뷰 편향 → 독립 에이전트 4~5개 병렬 의무

### 8.2 본 plan에 미반영된 잠재 리스크 (★ 진산님 판단 필요)

1. **마이그레이션 번호 충돌**: 기존 `0011_revision_2026_constants_seed.sql` 존재. TD-045 신규는 0013으로 재할당 필요. plan 본문 0011 표기는 오기 → 수정 필요.
2. **세션 길이**: 본 보고서 작성 시점 4턴. 가-1 전체 (A→B→C→D→E)는 1세션 내 불가. 핸드오프 전제로 plan 진행 또는 단계별 세션 분할 권장.
3. **TD 이월 잔량**: 가-1 Group C는 5건만 다룸. 권장 해소 6건 (TD-038~041/046/049)을 가-1.5로 분리할지 결정.
4. **smoke 자산화**: `__manual__/*-smoke.ts`가 git 추적 대상인지 .gitignore인지 미정. 자산화 시 보안 (API 키 누설 방지) 추가 검토 필요.
5. **smoke 결과 재현성**: A-1 실측 결과는 시간/네트워크에 따라 변동. measurement 산출에 timestamp + 환경 명시 필수.

### 8.3 알려진 약점 (변경 안 하면 가-1 통과 후에도 잠재 노출)

- TD-038 (200/201 jitter 미적용 — 통계 oracle, 1000+ 시도 필요로 실효 위협 낮음)
- TD-040 (local-db.batch 중첩 트랜잭션 runtime 가드 부재 — 주석만)
- TD-046 (mnemonic 역방향 검증 — Hard Limit 명시지만 가-1 대상 아님 / 가-N 이월 ADR 필요)

---

## 9. 결정 포인트 (진산님 판단 항목)

| #   | 결정 사항                                                  | Claude 추천                                                                   |
| :-- | :--------------------------------------------------------- | :---------------------------------------------------------------------------- |
| 1   | 가-1 plan 자체 승인 여부                                   | ✅ 진행 (Group A 진입 허가)                                                   |
| 2   | ANTHROPIC_API_KEY 주입 방식 (.dev.vars vs wrangler secret) | smoke는 `.dev.vars` (로컬 개발) / 본 적재는 `wrangler secret put` (배포 환경) |
| 3   | smoke 비용 한도 합의                                       | $1 cap (50원 견적의 20배 여유) — 의도 안한 루프 fail-safe                     |
| 4   | TD-045 마이그레이션 번호 0011 → 0013 재할당                | ✅ 0013 (기존 0011은 revision_2026_constants_seed로 점유 중)                  |
| 5   | 가-1.5 분리 여부 (TD-038~041/046/049 6건을 별도 plan으로)  | 분리 권장 — 가-1 범위 비대화 방지. 본 적재 후 순차 해소                       |
| 6   | 세션 분할 vs 단일 세션 진행                                | 분할 — Group A → B → C → D → E를 5~6 세션으로. 핸드오프 의무                  |
| 7   | smoke 스크립트 자산화 (`__manual__/`)                      | 자산화 (git 추적). API 키 .gitignore 분리. 회귀 시 재호출 가치                |

---

## 10. Claude의 권고

본 보고서 자체가 **메인 컨텍스트 자가 작성**임을 명시. 4-Pass 독립 검증 아님.

**진입 권고**: 결정 포인트 7개를 먼저 결정한 후 plan 본문에 반영하고 Group A 진입.

특히 **결정 포인트 #4 (마이그레이션 번호 충돌)** 는 plan의 명시적 오기 — 진산님 승인 전 본 보고서 정정사항 plan 반영 필수.

세션 모니터링: 현재 4턴, 본 보고서 작성으로 5~6턴 도달 예상. 가-1 본격 진입은 새 세션에서 핸드오프받는 것이 권장.

---

## 11. 다음 단계 (승인 시)

1. **plan 본문 정정**: TD-045 마이그레이션 0011 → 0013 (+ scope 라인 수정)
2. **결정 포인트 #2 / #3 / #5 / #6 / #7** 진산님 응답 → plan에 명시
3. **신 세션 핸드오프 작성** → Group A 진입은 새 세션에서 시작
4. Group A-1 → A-2 → A-3 순차 (`__manual__/*-smoke.ts` + `docs/measurements/*` 산출)

---

## 부록 A. 산출 파일 위치 인덱스 (가-1 관련)

```
docs/plans/current.plan.md              ← 본 plan
docs/plans/archive/20260423-phase1-step1-5-na.plan.md  ← (나) 직전 archive
tasks/step-1-5-ga-1.gates.yaml          ← 5개 Gate 정의
docs/measurements/                       ← 가-1 진입 시 신규 (smoke 결과)
sim/                                     ← 가-1 진입 시 신규 (B 그룹)
.claude/tech-debt.md                     ← 52건 TD 인벤토리
.claude/reviews/                         ← 36개 리뷰 산출물 누적
docs/adr/ADR-001~010                     ← 10건 결정 기록
docs/architecture/ARCHITECTURE.md        ← Mermaid 다이어그램
docs/쪽집게(ThePick) — 구현 재정립서 v2.0.md  ← Pass 4 Contract 기준
docs/쪽집게(ThePick) — 구현 재정립서 v3.0 FINAL.md  ← Year 2 이월 체계
```
