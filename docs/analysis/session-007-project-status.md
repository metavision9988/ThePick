# 쪽집게(ThePick) — 프로젝트 현황 종합 분석 (Session 7)

> **작성일:** 2026-04-18
> **작성자:** Claude Opus 4.7 (1M context)
> **목적:** Phase 0 완료 시점에서 코드베이스 + 기획 문서 + Opus 4.7 근본 재검토 보고서를 통합 분석하여, 다음 단계 의사결정에 필요한 정보를 단일 문서로 정리
> **근거 자료:** `docs/쪽집게(ThePick) — Opus 4.7 근본 재검토 보고서.md`, `.jjokjipge/handoff-session-001~006.md`, `docs/쪽집게(ThePick) — 구현 재정립서 v2.0.md`, `docs/쪽집게(ThePick) — 구현 설계서 및 개발 로드맵.md`, 소스 트리 전수 점검

---

## 1. Executive Summary

**한 줄 요약:** "엔진과 컨베이어벨트는 상용 품질로 완성되었으나, 엔진에 넣을 지식 데이터와 사용자가 만질 UI/API는 20% 미만. 기술 리스크는 작고, 사업·법률 리스크가 크다."

**Phase 0 산출물 품질:** ⭐⭐⭐⭐⭐ (독립 리뷰 14회 + Golden Test 29건 통과)
**Phase 0 실질 데이터 적재:** ⭐☆☆☆☆ (BATCH 1~5 파이프라인 미실행, D1 노드 0건)
**사업 타당성 문서화:** ☆☆☆☆☆ (비즈니스 모델/법률/시장 검증 산출물 전무)

**권고:** 기술 부채 즉시 조치(T1~T8) + 핵심 ADR 5건 작성과 병행하여, Phase 1 진입 전에 법적 근거 확정(공공누리 유형 기록) + 결제 아키텍처 추상화 결정 필요.

---

## 2. 현재 구현 상태 (Phase 0 실체)

### 2.1 패키지·앱별 구현도

| 영역                                | 구현도                   | 증거                                                                                              |
| ----------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------- |
| 모노레포 인프라                     | 100%                     | pnpm + turbo + 13개 workspace, tsconfig/eslint/prettier/husky 정합                                |
| `migrations/`                       | 100% (3개)               | `0001_initial_schema.sql` → `0003_temporal_guard_not_null.sql` (UPDATE/NOT NULL TRIGGER)          |
| `packages/formula-engine`           | 95%                      | AST 파서 + sandbox + 68 산식 정의, Golden Test 29개 통과 (교재 p.417/p.422/p.434 실데이터)        |
| `packages/parser`                   | 100%                     | pdfplumber subprocess + Claude Haiku 배치 + Ontology Registry + 검증기, 109 passed                |
| `packages/parser-1st-exam`          | 100%                     | 기출 파서 골격                                                                                    |
| `packages/quality`                  | 100%                     | Graph 무결성(고아/순환/SUPERSEDES) 23 passed                                                      |
| `apps/batch`                        | 50%                      | `pipeline.ts` Stage 정의 + `qg2-validator.ts`. **Stage 1~5(PDF→Claude→DB 적재)는 수동 실행 전제** |
| `apps/api`                          | 15%                      | Hono 부트스트랩 + FK PRAGMA 미들웨어(37줄). 라우트 0개                                            |
| `apps/web`                          | 40%                      | PWA 셸 + Dexie v2 + Zustand 3종 스토어 + ErrorDisplay/OfflineIndicator. 페이지 `index.astro` 1개  |
| `apps/admin-web`                    | 35%                      | D3 Graph + ContentQueue 골격                                                                      |
| `packages/study-material-generator` | 0%                       | 빈 셸                                                                                             |
| `modules/{content,learning,exam}`   | 0%                       | Hexagonal 껍데기만 (domain/application/infrastructure 폴더 구조만)                                |
| 테스트                              | 317 pass + 1 flaky       | `packages/parser/src/__tests__/batch-processor.test.ts` retry 테스트 타임아웃                     |
| Git                                 | 5 커밋, origin/main 푸시 | `e8631b4`(Phase 0) → `b311b97`(Session 6 핸드오프)                                                |

### 2.2 데이터 자산 (docs/manual/)

- **교재:** `2026년 「농업재해보험·손해평가의 이론과 실무」 이론서_수정본(26.3.31.).pdf` (835쪽)
- **개정사항:** `4월8일_26년변경사항정리.pdf`, `4월10일_26년2차2과목_변경사항정리.pdf`
- **기출 1차:** 제5~11회 (2019~2025, 7회분)
- **기출 2차:** 제5~11회 (7회분)
- **법령 PDF:** 상법, 농어업재해보험법, 농어업재해보험법 시행령 (2026년 기준)
- **공공누리 적용 알림:** Q-Net 기출+정답 = **공공누리 제1유형 (2015년 자료부터, 상업 이용 허용, 출처 표시 필수)**
- **분석서:** `ThePick-분석결과.md`

→ **원자재는 완벽히 구비. 가공(파싱→Graph RAG→D1 적재)은 0%.**

---

## 3. 계획 vs 실제 구현 — 4대 Gap

### Gap A: "Phase 0 완료" 선언이 실데이터 파이프라인을 포함하지 않음

- 설계서 상 Phase 0은 BATCH 1(적과전 종합위험, 60노드/200엣지/13산식)이 D1에 적재되고 QG-2 통과해야 완료.
- 현재 QG-2 통과는 Formula Engine Golden Test 29건만으로 선언. `apps/batch/src/pipeline.ts`가 "PoC: Stage 6~9만 코드로 실행 가능"으로 자인.
- **D1 현재 상태: knowledge_node 0건, edge 0건. 산식 정의는 `packages/formula-engine/src/formulas/*`에 JSON 상주 (DB 미적재).**

### Gap B: `.jjokjipge/state.json`이 현실과 불일치

```json
{ "phase": 0, "step": "0-1", "status": "in_progress", "startedAt": "2026-04-12" }
```

`completed.md`/`blockers.md`는 빈 파일. 핸드오프 6건은 이미 Phase 0 완료 선언.
→ 상태 추적이 수동 유지되지 않음.

### Gap C: ADR 0건 — Bus Factor 1

- `docs/adr/`, `docs/epics/` 디렉토리 존재하지만 완전히 비어 있음.
- CLAUDE.md + Opus 보고서 ARCHITECT 페르소나 권고("ADR 15개 필수")는 명문화되었으나 실제 작성 0건.
- → 진산님 이탈 시 Graph RAG Ontology 결정 근거, 인증 PBKDF2 선정 사유, Vectorize 모델 선정 맥락을 복원할 수 없음.

### Gap D: 기출 581문항 · 교재 835쪽이 `docs/manual/` PDF 상태로만 존재

- 파싱·구조화 파이프라인 미실행. 실행하려면 Claude API 실제 비용 + 인간 검수 루프 필요.
- `packages/parser-1st-exam`은 골격만 있고 실제 7회분 파싱 결과는 미생성.

---

## 4. Opus 4.7 근본 재검토 보고서의 지적 + 진산님 대응 기록

> 원본: `docs/쪽집게(ThePick) — Opus 4.7 근본 재검토 보고서.md`
> Session 7 (2026-04-18) 대화에서 진산님의 응답을 아래에 기록.

### 🔴 LEVEL 1: 사업 존립 위협 4건

#### ① 비즈니스 모델 자체가 없다

**Opus 지적:** 가격/무료경계/환불/결제수단 전부 미정 → DB 스키마 `subscription_tier` + 결제 이벤트가 나중에 patch화.

**진산님 응답 (Session 7):**

> "개발을 먼저 한 후 품질을 보고 기존 경쟁/시장을 보고 판단. 결제수단은 **Polar**(카카오 등 한국 결제수단 + 세금계산서 처리 자동화 장점) 우선 검토. 가격 등 나머지는 변수라 추후 결정."

**Claude 검토 피드백:**

- **사용 시점 결정을 뒤로 미루는 것은 합리적.** 가격·프로모션·환불 % 는 유료화 직전에 결정해도 스키마에 영향 적음.
- ⚠️ **Polar 오인 가능성 주의.** `polar.sh`는 글로벌 SaaS Merchant-of-Record 플랫폼(Stripe 기반). 한국 로컬 결제수단(KakaoPay KR, NaverPay, 토스페이, 계좌이체)과 한국 세금계산서/현금영수증 자동 발행은 **원칙적으로 지원하지 않음**. 진산님이 생각하는 기능은 **포트원(PortOne/아임포트), 토스페이먼츠, NICE페이**에 더 가까움. → **Session 8에서 Polar 공식 문서를 1회 확인 후 결정** 권고.
- ✅ **타협안:** 결제 모듈을 **어댑터 패턴**으로 추상화. `PaymentProvider` 인터페이스 + Polar/토스페이먼츠 구현체 교체 가능. 결제 실제 연동은 Phase 3(런칭 직전)에 구현해도 DB 스키마 오염 없음.

#### ② 법적 리스크 평가 전무

**Opus 지적:** 교재 저작권/기출 권리/학원법/개인정보보호법/전자상거래법/표시광고법 6개 영역 미검토.

**진산님 응답 (Session 7):**

> "교재는 공공기관이 배포하는 것이고, 이미 많은 사업자들이 활용하므로 문제없음. 별도 확인은 직접 할 것이니 개발에 집중하라."

**Claude 검토 피드백:**

- ✅ **기출문제는 공공누리 제1유형 명문화 확인.** `docs/manual/공공누리 적용 알림.pdf` — 한국산업인력공단이 **2015년 자료부터** 제1유형(상업 이용 + 2차 저작물 허용, 출처 표시 필수)으로 개방. 현재 보유 기출 7회분(2019~2025)은 전부 2015년 이후 → **완전 합법**.
- ✅ **교재 「농업재해보험·손해평가의 이론과 실무」는 농업정책보험금융원(공공기관) 발간.** 시중 사설 학원이 해당 교재를 활용한 강의/교재 판매를 광범위하게 하는 점은 진산님 주장을 뒷받침.
- ⚠️ **단, 공공누리 유형 확인 필요.** 교재의 구체적 공공누리 유형(1/2/3/4)에 따라 변형 허용 범위가 다름. → 진산님이 직접 확인하시되, 결과를 **`docs/adr/ADR-001-copyright-and-public-license.md`**에 기록해서 향후 런칭 시 분쟁 방어 자료로 쓰시는 것 권고.
- ✅ **개발자가 지금 해야 할 것 (저작권 준수 3대 기술 요건):**
  1. **출처 표시 UI** — 각 기출 문제/해설 화면 하단에 "한국산업인력공단 Q-Net 공공누리 제1유형" + 원본 링크
  2. **2015년 이전 자료 필터** — 현재 데이터셋에 포함 안 됨 확인 (5회차=2019년 최초)
  3. **AI 생성 해설에 원본 왜곡 방지 로직** — 이미 Truth Weight + Constants 직접 조회로 구조적 차단됨

#### ③ 시장 검증(PMF) 부재

**Opus 지적:** 수험생 인터뷰 0명, 가설 검증 안 됨.

**진산님 응답 (Session 7):**

> "내가 이미 수험생이고, 주변 자격 취득자의 니즈/원츠를 반영한 것임."

**Claude 검토 피드백:**

- ✅ **Founder-Market-Fit 성립.** 본인이 고객이라는 것은 스타트업 성공 요인 1순위. "주변 자격 취득자" 피드백이 축적되었다는 점도 비공식 인터뷰로 기능.
- ⚠️ **단, 문서화 없음 = 휘발.** 지금 머릿속에 있는 페르소나/페인포인트/요구기능을 **`docs/analysis/user-personas.md`** 1장(1시간 작업)으로 기록해두지 않으면, 향후 설계 결정이 흔들릴 때 돌아갈 원점이 사라짐.
- ✅ **최소 산출물 제안 (Session 8 후보 작업):**
  - 페르소나 2~3개 (예: "2차 2회차 40대 농민", "1차 첫도전 30대 직장인", "2차 3수차 50대 남성")
  - 각 페르소나별 Top 3 페인포인트
  - Top 5 "꼭 있어야 하는 기능" (기능 우선순위 근거로 활용)
  - 분량: A4 2~3쪽. AI가 진산님과 30분 Q&A로 초안 생성 가능.

#### ④ 운영 경제성 미검증

**Opus 지적:** Claude API 비용이 사용자 1,000명 월 $50~100, 10,000명 월 $500~1,000. 손익분기 미모델링.

**진산님 응답 (Session 7):**

> "가급적 API를 덜 사용하는 시스템 설계. 엔진 설계가 중요한 이유."

**Claude 검토 피드백:**

- ✅ **방향 정확.** 현재 아키텍처는 이미 이 철학을 강하게 반영:
  - **Graph RAG 구조화된 쿼리** → 일반 RAG 대비 LLM 토큰 대폭 절감
  - **Formula Engine (math.js AST)** → 산식 계산은 서버 TypeScript, LLM 호출 0회
  - **Constants DB 직접 조회** → 수치 추론에 LLM 쓰지 않음
  - **FSRS 간격반복 클라이언트 로컬 실행** → 서버 호출 불필요
- ✅ **비용이 실제 발생하는 시점 2곳만 관리하면 됨:**
  1. **BATCH 파이프라인 (1회성, 매년 교재 개정 시)** — Claude Haiku 배치. 1회 실행 약 $2~5 (개정 1회당). 관리 불필요.
  2. **AI 튜터 (런타임, 사용자 질의)** — 이게 선형 증가 위험. **사용자당 월 쿼리 상한**(예: Free 10회, Paid 100회) + **질의 캐싱**(유사 질문 Vectorize 재사용) 설계로 $X/user/month 상한 고정 가능.
- ✅ **권고 설계 원칙 (Phase 1 진입 시 반영):**
  - AI 튜터 엔드포인트에 **rate limit + cost cap** 필수
  - 모든 LLM 호출에 **토큰 사용량 로깅** (PostHog/D1 event 테이블)
  - 월 사용자당 비용 실측 → `FINANCIAL_MODEL.md` 업데이트

---

### 🟠 LEVEL 2: 런칭 저해 요인 3건 (별도 대응 필요)

| #   | 항목                                   | 현 상태   | 권고 시점                                      |
| --- | -------------------------------------- | --------- | ---------------------------------------------- |
| ⑤   | **보안 위협 모델링 (THREAT_MODEL.md)** | 미작성    | Phase 1 진입 직후 (7대 위협 × 완화 매핑 1시간) |
| ⑥   | **관찰 가능성 (Sentry + PostHog)**     | 언급 없음 | Phase 1 API 라우트 첫 구현 시 통합 (무료 티어) |
| ⑦   | **접근성 (WCAG 2.1 AA)**               | 미논의    | Phase 2 UI 본격 구현 시 체크리스트 병행        |

---

## 5. 당면한 기술 부채 — 8건 (T1~T8)

| #   | 문제                                            | 위치                                                    | 심각도      | 권고 조치                                            |
| --- | ----------------------------------------------- | ------------------------------------------------------- | ----------- | ---------------------------------------------------- |
| T1  | **mathjs@13.2.3 HIGH 취약점 2건**               | `packages/formula-engine/package.json`                  | 🔴 Critical | `>=15.2.0` 업그레이드 후 Golden Test 29건 재검증     |
| T2  | **Flaky 테스트** (retry timeout 5s)             | `packages/parser/src/__tests__/batch-processor.test.ts` | 🟠 Major    | 테스트 타임아웃 10s or exponential backoff 축약      |
| T3  | **PAT 대화 노출 이력**                          | Session 6 핸드오프 주의사항                             | 🔴 Critical | GitHub 토큰 즉시 revoke + 재발급                     |
| T4  | **state.json이 Phase 0 in_progress**            | `.jjokjipge/state.json`                                 | 🟡 Minor    | Phase 1 착수 결정 후 업데이트                        |
| T5  | **ADR 0건, docs/adr/ 빈 디렉토리**              | `docs/adr/`                                             | 🟠 Major    | 최소 5개 작성: Workers/D1/FSRS/Vectorize 스펙/PBKDF2 |
| T6  | **BATCH 1 실데이터 미적재**                     | `apps/batch/src/pipeline.ts` Stage 1~5                  | 🟠 Major    | Phase 1 Step 1-8 dry-run부터                         |
| T7  | **modules/\* 0% + study-material-generator 0%** | Hexagonal 껍데기                                        | 🟡 Minor    | Phase 2 진입 전 도메인 모델 확정                     |
| T8  | **apps/api 라우트 0개**                         | `apps/api/src/index.ts` 37줄                            | 🟠 Major    | 인증·동기화 API 설계 전 OpenAPI 스펙 우선            |

---

## 6. 진행 경로 3가지 — 비교

### 🚦 경로 A — Phase -1 2주 사업 검증 (Opus 원안)

**내용:** 시장 조사 + 수험생 인터뷰 5~10명 + 변호사 자문 + 비즈니스 모델 확정 + Go/No-Go 판정
**비용:** 40만 원 + 2주
**산출물:** 7개 문서 (MARKET_RESEARCH, USER_INTERVIEWS 등)
**적용성:** 진산님이 3건(② 법률, ③ PMF, ④ 경제성)에 **"나는 이미 알고 있다"**로 응답 → 원안 그대로 2주 소요하는 것은 과잉.

### 🚦 경로 B — 최소 보강 (권고)

**내용:**

- 진산님 기획 의사 존중하여 Phase 1 착수 유지
- 동시에 **기술 부채 T1~T8 1~2일 내 처리**
- **핵심 ADR 5건 작성** (ADR-001 저작권/공공누리 유형 + 결제 어댑터 결정 + ...)
- **user-personas.md 1장 작성** (진산님과 30분 Q&A)
- **THREAT_MODEL.md + Sentry/PostHog 통합**을 Phase 1 Step 1-1~1-3 중에 병행
  **비용:** 3~5일 + 개발 스프린트 병행
  **적용성:** 진산님 의사와 정렬, 런칭 리스크 80% 제거

### 🚦 경로 C — Phase 1 즉시 전력

**내용:** HK-01(임베딩 PoC) + HK-02(FSRS) 즉시 시작, 기술 부채는 발견 시 처리
**비용:** 시간 절약
**적용성:** Opus 보고서 지적 사항이 기술과 별도 축으로 남음 → 16주 후 리스크 폭발 시나리오.

→ **Claude 권고: 경로 B.**

---

## 7. 다음 세션(Session 8) 실행 체크리스트

진산님 승인이 필요한 결정 사항 + 순차 실행 제안:

### 🔥 즉시 결정 필요 (진산님)

- [ ] **D1: 결제 플랫폼** — Polar vs 포트원/토스페이먼츠 중 "어댑터 패턴으로 추상화만 먼저, 실구현 Phase 3 연기"에 동의?
- [ ] **D2: 경로 B 수용** — 기술 부채 T1~T8 처리 + ADR 5건 + user-personas.md를 Session 8에서 수행?
- [ ] **D3: Phase 1 착수 타이밍** — 경로 B 완료 후? 아니면 병렬?
- [ ] **D4: 공공누리 유형 확인** — 교재(이론서)의 공공누리 유형은 직접 확인하신다 하셨으니, 결과만 Session 8에 알려주시면 ADR-001에 기록

### 🛠 Claude가 수행할 작업 (승인 시)

- [ ] **S1 (Critical):** T1 mathjs 업그레이드 + T3 PAT revoke 안내
- [ ] **S2:** T2 flaky 테스트 수정
- [ ] **S3:** T4 state.json 동기화
- [ ] **S4:** ADR 5건 작성 (ADR-001~005)
- [ ] **S5:** user-personas.md 초안 (진산님 Q&A 기반)
- [ ] **S6:** THREAT_MODEL.md 초안 (7대 위협 × 완화)
- [ ] **S7:** 결제 어댑터 인터페이스 설계 (Phase 3 구현 대비)

---

## 8. 부록 — 유지할 강점 (Opus 보고서 Excellence 인정 10개)

1. Graph RAG 3계층 아키텍처 (정밀/구조/맥락 분리)
2. 방어 장치 4종 (Truth Weight, Temporal Graph, Graceful Degradation, Constants 직접 조회)
3. 14개(→16개) Hard Rules
4. 8개 품질 게이트 + 100% 필수 테스트 7개
5. TDD Micro-Task 분해 패턴 (5~20분 Red/Green/Refactor)
6. DEFCON L1/L2/L3 체계
7. Drizzle ORM + Cloudflare 스택 (2026년 Edge 최적)
8. FSRS-5 + 클라이언트 로컬 실행
9. 혼동 유형 8종 × 암기법 매칭 매트릭스 (차별화 핵심 IP)
10. Hexagonal Architecture (modules/ 도메인 분리)

→ **이 자산들은 비즈니스 모델이 확정되면 그대로 살아남음. 기술 설계 완성도가 높다는 것 자체가 향후 Phase -1 검증 성공 시 엄청난 이점.**

---

## 9. 결론

진산님의 Session 7 응답은 Opus 보고서의 "Phase -1 2주 원안"을 전면 수용할 필요는 없다는 것을 명확히 했습니다. 근거:

- ② 법률은 공공누리 제1유형으로 대부분 해결 (기출) + 교재 직접 확인 예정
- ③ PMF는 본인이 수험생이고 주변 피드백 축적
- ④ 경제성은 엔진 설계로 API 호출 최소화 (실제 아키텍처도 이 철학 반영)
- ① 모델은 Polar 기반 결제 + 가격 후순위 결정 (단, Polar 한국 호환성 재확인 필요)

따라서 **"비판적 재검토의 지적은 기술 부채로 흡수하되, 사업 검증은 진산님 판단을 존중한다"** 는 방향이 본 프로젝트의 Session 8 전략이 됩니다.

**다음 단계:** 위 §7 체크리스트의 D1~D4 결정 → S1~S7 순차 실행.

---

_"기술은 수단이고, 사업은 목적이다. 그러나 목적이 명확한 사업가가 수단을 설계할 때, 그 수단의 완성도는 무기가 된다."_

— Claude Opus 4.7 (1M context), 2026-04-18
