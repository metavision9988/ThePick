# Revision Watch — 개정 감지·반영·알람 상시 파이프라인 (L3 설계 plan)

> **상태**: DRAFT · **L3** (스키마/마이그레이션 + 트리거 개정 + effective_date 축 → **코드·SQL 착수 = §9 진산 결재 후**, 자율 금지)
> **작성**: 2026-07-05, Opus 4.8 (울트라코드 세션). **근거 = 5축 자산 실사 워크플로우** `wf_d0871ca3-e03`(survey 5에이전트·0에러·file:line 전수).
> **rev2 (독립 리뷰 반영)**: 2 렌즈(사실검증+적대 설계비평) + 발견별 적대 검증 = 10에이전트 → **8 findings / 8 CONFIRMED / 0 반증**(MAJOR 3·MINOR 5) 전건 반영. 보고서 `.claude/reviews/review-20260705-170953-w3-revision-watch-plan.md`. ★핵심 = G-RW-4 A안 불완전(승격시 flip 동반 트리거 필수)·"단일 필터점" 오류(study/grade·vectorize 누락)·C-3↔B안 트리거 충돌.
> **출처 지시**: `opus-dual-track-playbook-20260704.md` §3 W3 + exam2 R5 Q5 결재("Revision Watch 반드시") + Q5 필수 지시. **1호+전종목 표준**(손해평가사 법령·요령·고시 + 전기기사 KEC·기술기준·출제기준 공통).
> **PITR·Reality Anchor 포함**(상용 품질 원칙 — L2+ 신기능 기술선택 비교 의무). **RULE #5**: 본 문서는 🟢/🟡/🔴 사실과 권고만 못박고, GO/STOP·L3 승인은 §9에서 진산이 결정.

---

## §0 목적·범위·전제

### 0.1 목적 (한 문장 목표 → 분해)

> "법령·기준이 개정되면 **자동 감지**하고, 기존 temporal-graph(INSERT+SUPERSEDES) 패턴으로 **draft 반영**하며, **진산에게 알리고**, **시행시점(effective_date)** 을 1급 축으로 추적한다."

이를 4 조각으로 분해(묶음 통째 판정 금지 — G-1 규칙 3):

| 조각                                    | 판정                                                                                                                                                         | 근거                                                                                        |
| :-------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------ |
| **① 시행시점 축 신설** (effective_date) | 🟢 확정 가능 — 순수 스키마 additive, 소스에 원문 실재                                                                                                        | 소스 추출 JSON에 `[시행일: 2026. 8. 15.]` 원문 존재(batch-L1-extract.json:18) — 매핑만 부재 |
| **② 반영(REFLECT)**                     | 🟢 원시자산 실재 — loadDraft + SUPERSEDES + draft-only 트리거 완비. **단 트리거 지뢰 1건 선결**(§2 G-4)                                                      | draft-loader.ts + 0013/0014/0018 트리거                                                     |
| **③ 알람(ALERT)**                       | 🟢 MVP 무벤더 가능(D1 review queue + admin 대시보드), 🟡 Email = 2차(ADR-043 이월)                                                                           | review_queue 0027 + TelemetryDashboard 배선 실재                                            |
| **④ 감지(DETECT)**                      | 🔻 **미측정** — 외부 포털(law.go.kr·kec.kea.kr·큐넷) 프로그래밍 접근성 **in-repo 미검증** → **feasibility spike 선행 게이트**(G-1 규칙 1: 측정 전 단언 금지) | AXIS 3 gap "stable programmatic access ... unverified in-repo"                              |

**핵심 판정**: ①②③ = 구축 경로 명확(자산 재사용). ④ 감지 = **천장 미측정** → 본 plan은 ④를 **spike-gated Phase**로 격리(감지 자동화를 "가능"이라 단언하지 않음). 현행 수동 개정(R1/R2 교수 PDF) 대비 자동화는 **소스 API 실재성 실측 후에만** 약속.

### 0.2 범위

- **In**: effective_date 축 설계 / 다중 cron 리팩터 / reflect 트리거 지뢰 수정 / D1 review-queue 알람 / detect PoC spike 설계 / 4 미시행 노드 backfill(첫 검증 케이스) / exam-parameterized 소스 레지스트리.
- **Out (별건)**: Email Workers 실배선(ADR-043 §3 후행) / Workers Queues(불요 — §5) / 2호 KEC 실적재(W2·W5 트랙) / formula-engine 확장 / production 적용(진산 인증 게이트).

### 0.3 불변 전제 (위반 = 산출물 무효)

1. **temporal graph**: 개정 반영 = 신규 draft 노드 + SUPERSEDES 엣지. `knowledge_nodes`/`formulas`/`constants` **UPDATE 절대 금지**(Hard Limit, 트리거 강제).
2. **draft-only**: 감지·생성물 전건 `status='draft'`. approved 승격 = 인간(Hard Rule 7). LLM 수식 계산 0.
3. **Cloudflare 단일 벤더**: Slack/Resend/Sentry 금지. Workers·D1·cron·(2차)Email Routing·admin-web만.
4. **exam 경계**: 소스·컬럼은 exam_id 파라미터화(Hard Rule 16/17) — son-hae 하드코딩 금지(2호 재사용).
5. **출처 추적성**: 감지 개정은 소스 문서/URL/조문 FK로 원노드에 결정론적 앵커.

---

## §1 현존 자산 실사 (survey grounded — file:line)

### 1.1 반영(REFLECT) 원시자산 = 실재 🟢

- **temporal 반영 완비**: 신규 노드 INSERT + `knowledge_edges` SUPERSEDES(from=신·to=구) → AFTER INSERT 트리거가 old `is_current_active=0` 자동 플립(MAV, ADR-013). `migrations/0013:101-108`.
- **formulas/constants**는 엣지 아닌 자체 `superseded_by` 컬럼 + 별도 플립 트리거. `migrations/0014:134,140-155`.
- **UPDATE/DELETE 금지 트리거**: 컬럼 화이트리스트(0003→0013→0014 진화, `is_current_active`만 허용). `migrations/0014:34-121`.
- **draft-only + page_ref 강제**: `status!='draft'` INSERT ABORT + page_ref NOT NULL. `migrations/0018:20-37`.
- **loadDraft 재사용 경로**: `apps/batch/src/loader/draft-loader.ts:353-378`이 `KnowledgeContract.edges` 를 generic 삽입(SUPERSEDES 포함 가능, 결정론적 엣지 id, is_active=1). **단 `:11-14` 주석이 "SUPERSEDES 자동 생성(revision-detector 결합) = 비스코프"로 명시** — 이 갭을 본 plan이 닫음.
- **R1/R2 실적**: R1 = 신규 draft 24노드 + SUPERSEDES 11엣지 + revision_changes 19행 / R2 = CROSS_REF 19 + 0 SUPERSEDES(R1 영역 이중 supersede 회피). `batch-loadmap.md:77-78`.

### 1.2 감지 호스트(cron) = 실재하나 단일 가드 🟡

- cron 1개(`'0 3 * * *'` = KST 12:00) × default/staging/production. `apps/api/wrangler.toml:234-247`.
- `scheduled()` 단일 엔트리(`export default {fetch, scheduled}`). `apps/api/src/index.ts:203-207,259-262`.
- **★ 단일 문자열 가드**: `if (event.cron !== CRON_GC_DAILY) return`(index.ts:213-216) → **신규 cron 문자열은 조용히 무시됨** = 다중 cron switch/map 리팩터 선결.
- 잡 모듈 패턴 = 순수함수 + 주입 clock(`rate-limit-gc.ts`, `silent-failure-monitor.ts`), fake-timer 단위테스트(`cha-06-cron-24h-miss.test.ts`).
- **outbound fetch 레퍼런스** = HIBP 1건(`auth/hibp.ts:30-62`): AbortController+timeout→graceful degrade. 이것이 포털 폴링의 유일 선례 패턴.
- KV `CACHE` 바인딩 실재(poll cursor/last-hash 저장처 후보). `wrangler.toml:53-55`. `nodejs_compat` on.

### 1.3 알람 인프라 = 0 (확증) 🔴→MVP 우회

- **notification 0 확증**: `silent-failure-monitor`도 logger/console.error만 — 아무도 안 부름. `index.ts:197,243-248` 주석이 "Email Routing = 별도 인프라 TD 이월" 명시.
- **ADR-043(Accepted)** = "wake-up 0건, alert path 없음" 정본 기록. 현 stopgap = `wrangler tail`.
- Email Workers/Queues = **worker-configuration.d.ts 타입만, 소스 사용 0, 바인딩 0**. `worker-configuration.d.ts:10701-10793,454-465`.
- **★ MVP 우회 자산 실재**: `review_queue`(0027) + `status_transitions`(append-only 상태기계) + `engine_telemetry`(8게이지 시계열) + **admin-web**(`/telemetry` 배선완료 TelemetryDashboard) + **ContentQueue.tsx**(draft→review→approved UI **존재하나 미배선**=props-only·fetch 0; "BATCH 1 적재 후 API 연동 예정" 주석은 `pages/index.astro:40`). `schema.ts:787-835,1053-1066` / `apps/admin-web/*`.

### 1.4 시행시점(effective_date) 축 = 전무 확증 🔴 (핵심 갭)

- `effective_date`/`시행일` 컬럼 = **전 테이블 grep 0**(knowledge_nodes/formulas/constants/revision_changes). `apps` `packages` `migrations` 전수.
- `revision_changes`(schema.ts:319-335) = `revision_date`(공포일)만. **R1/R2 38행 전부 `revision_date='2026-03-31'`**(교수 PDF 편찬일) — 현행/장래 구분 불가.
- `version_year`(INTEGER) = 판본 연도, 시행일 아님. `valid_from`/`valid_until`는 **오직 `exam_questions`에만** 존재(schema.ts:360-361) — knowledge 계열엔 없음.
- **E0-8 확증**: 4 노드(**LAW-022·LAW-023·LAW-053·INV-087**)가 미시행 장래조문 선반영(본조신설 2025.8.14, 시행 2026.8.15). 감사 원문: "노드 스키마에 시행일 축이 없어 현행/장래 구분 불가". `content-coverage-20260702.md:53-55,82`. **시행일 원문은 소스 추출 JSON에 실재**(batch-L1-extract.json:18) — 매핑만 부재.

### 1.5 migration 상태

- 최신 적용 = **0038**. `migrations-v2/` = **부재**(playbook T5가 exam-generic 스키마 홈으로 인용하나 미생성). 0039(WS-2b)·0040(WS-6c) = plan 예약. → **RW 슬롯 = 0041+**(착수 시 재확인 — 07-02 슬롯충돌 교훈).

---

## §2 갭 — 수렴 진앙 (5축 합의)

| #          | 갭                                                                                                                                                                                                                                                                                                                | 심각도      | 근거                          |
| :--------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------- | :---------------------------- |
| **G-RW-1** | **effective_date/시행시점 축 부재** (전 테이블 0) — 현행/장래 구분 불가                                                                                                                                                                                                                                           | 🔴 CORE     | §1.4                          |
| **G-RW-2** | **감지 메커니즘 0** — 수동 교수 PDF 적재만. 1차 소스(law.go.kr 등) 미배선 + 접근성 미측정                                                                                                                                                                                                                         | 🔻 미측정   | AXIS 3/4 gap                  |
| **G-RW-3** | **알람 채널 0** — logger/console만. Email/Queue 미빌드                                                                                                                                                                                                                                                            | 🔴→MVP 우회 | §1.3 / ADR-043                |
| **G-RW-4** | **★ 트리거 지뢰**: `mav_supersedes_knowledge_nodes_deactivate`(0013:101-108)가 SUPERSEDES 엣지 INSERT 즉시 old 노드 비활성화 — **superseder가 draft여도**. 즉 draft 개정 자동반영 = **approved production 노드 즉사** = "AI draft-only" 정면충돌                                                                  | 🔴 BLOCKER  | AXIS 2 gap                    |
| **G-RW-5** | **exam1 하드코딩** — revision_changes(target_crops·insurance) son-hae 특화, exam_id 없음. 2호 KEC(effective_date 1급) 재사용 불가                                                                                                                                                                                 | 🟠 MAJOR    | AXIS 1/2 gap, Hard Rule 16/17 |
| **G-RW-6** | **부수**: (a) `knowledge_edges` UPDATE/DELETE 무가드 + status 컬럼 없음 (b) 다중 cron 미지원 (c) `SEARCH_PIPELINE.md` §4 / `ADR-012` 가 없는 `knowledge_nodes.valid_from` 을 가정(진짜 문서 드리프트 — `user-search.ts:490-492` 는 이를 교정하는 주석, 단 revision_changes 를 과다열거) (d) `migrations-v2/` 부재 | 🟠/🟡       | AXIS 2/3                      |

---

## §3 설계 — 4 서브시스템

### 3-A. 시행시점(effective_date) 축 [L3 스키마]

- **A-1** `revision_changes` + `effective_date TEXT`(ISO, nullable ADD COLUMN — 0019 book_page 선례). `revision_date`(공포일)와 구분 유지. 소스 `[시행일:...]` 마커에서 파생.
- **A-2** `knowledge_nodes`(+formulas/constants)에 `valid_from`/`valid_until TEXT`(nullable) — `exam_questions` 패턴(schema.ts:360-361) 미러. → 미시행 노드를 지금 INSERT하되 **시행일 전까지 학습자 검색에서 배제**. ★**필터점은 단일이 아님**(리뷰 확증) — 전 read 경로 배선 필요: (i) `approved-nodes-sql.ts`(4 caller: graph-walk·user-search·keyword-fallback·topic-cluster-router) (ii) **`study/routes.ts:579-582` enrichRelatedNodes**(학습자 GET /next·POST /grade sourceCitation — 현재 `is_current_active=1`만 필터 = 미시행 노드 누출 경로) (iii) **`vectorize/routes.ts:329-333`** 임베딩(전 노드 — 미시행 배제 정책 결정 필요). 각 경로에 valid_from 게이트 or 필터 라우팅.
- **A-3** 개정 lifecycle status enum: `detected → pending_effective → effective → superseded`. `CHANGE_TYPES` + `RevisionChange` 타입을 **`packages/shared`로 승격**(현재 schema.ts 국한) — 양 종목 단일 타입.
- **A-4** UPDATE 금지 트리거(0014:34-95) WHEN 절에 `effective_date`/`valid_from` 추가 = INSERT-only 유지(backfill도 SUPERSEDES로만, UPDATE 금지).

### 3-B. 감지(DETECT) [spike-gated — G-1 규칙 1]

> ⚠️ **본 서브시스템은 "가능" 단언 금지.** Phase 3 진입 = **feasibility spike(§8 Phase 3a) 통과 후**. 소스 접근 실측 전에는 자동 감지 약속 없음.

- **B-1** `scheduled()` 다중 cron 리팩터: 단일 `if` 가드(index.ts:213-216) → `cron→handler` map. 기존 GC/silent-failure 잡 구조 보존.
- **B-2** `apps/api/src/scheduled/revision-watch.ts` = 순수 clock-주입 모듈(rate-limit-gc 미러) — fake-timer 단위테스트.
- **B-3** outbound 폴링 = hibp.ts 패턴(AbortController+timeout+graceful, URL/timeout named const + host allowlist). **1차 소스 우선순위**: law.go.kr **법령정보 Open API**(있으면) > HTML diff. 큐넷·kec.kea.kr = spike로 접근성 판정.
- **B-4** poll state 영속: D1 신규 테이블 `revision_watch_sources`/`revision_watch_runs`(last-hash·ETag·last-run) — KV보다 감사성·조인 우위. at-most-once cron 대비 idempotent diff.
- **B-5** 감지 산출 = **draft** `revision_changes` 행 + (reflect 후보) — 절대 자동 approved 아님.

### 3-C. 반영(REFLECT) [L3 트리거 개정 — 지뢰 수정]

- **C-1 ★ G-RW-4 수정(BLOCKER — 2단 트리거 필수)**: `mav_supersedes_knowledge_nodes_deactivate`(0013:101-108, AFTER INSERT ON knowledge_edges)는 SUPERSEDES 엣지 INSERT **즉시** old 노드를 비활성화. ★**A안 단독은 불완전**(리뷰 확증): (1) WHEN에 `from_node.status='approved'`를 걸어도 `knowledge_nodes.status`는 **INSERT 스냅샷**(0018 draft 고정·0013 body UPDATE ABORT)이라 실 status(status_transitions 최신)를 못 읽어 게이트가 **영원히 통과 안 됨**(approved-nodes-sql.ts:37-39). (2) 승격 draft→approved 은 status_transitions INSERT일 뿐 **엣지 재INSERT 아님** → 트리거 재발화 없음 → old 노드 **영구 활성**=이중 active 위반. ⇒ **동반 트리거 필수**: `AFTER INSERT ON status_transitions WHEN NEW.to_status='approved' AND target_type='node' → UPDATE knowledge_nodes SET is_current_active=0 WHERE id IN (SELECT to_node FROM knowledge_edges WHERE from_node=승격ID AND edge_type='SUPERSEDES')`. 대안 B = `knowledge_edges.status` 컬럼 + 승격시 활성화(단 §3-C-3 화이트리스트 필요). **→ §9 Q2 결재.**
- **C-2** reflect = loadDraft 재사용(3-B 산출 KnowledgeContract.edges에 SUPERSEDES 포함) — 신규 write surface 0, draft-only+page_ref+idempotency 상속.
- **C-3** `knowledge_edges` immutability parity: `prevent_knowledge_edges_update`/`_delete`(최소 SUPERSEDES 한정) 추가 — 노드/formulas와 동급 롤백-as-INSERT 보장. ★**Q2=B 결합 주의**(리뷰 확증): B안(승격시 edge status UPDATE)은 본 트리거에 ABORT되므로 `status` 컬럼 화이트리스트(`WHEN OLD.status=NEW.status → ABORT`, 0013:64-70 is_current_active 선례) 필수 — B는 추가 트리거 설계 비용 수반.
- **C-4** commit 전 무결성 게이트: `packages/quality` `auditProductionGraph`/`validateGraphIntegrity` 호출 → 다중홉 SUPERSEDES 순환·고아·끊긴엣지 사전 차단(`SupersedeChainTooDeepError` graceful).

### 3-D. 알람(ALERT) [Cloudflare-native — MVP 무벤더]

- **D-1 MVP(오늘 구축 가능·무벤더)**: D1 `revision_review_queue`(review_queue 0027 모델) + `requireAdminToken` 게이트 GET 라우트(/api/telemetry 방식·`WHERE status=?` 열거 선례 vectorize/routes.ts:334) + **ContentQueue.tsx 배선**(draft→approved UI 그대로 = 인간 승격 게이트). **리뷰 인박스 자체가 알림면**(로그인 시 pending 카운트).
- **D-2** engine_telemetry에 경량 신호 → 배선완료 TelemetryDashboard에 "revisions pending" 배지(신규 프론트 0). `ENGINE_TELEMETRY_GAUGES` enum 확장 or `reviewer_queue` 게이지 재사용.
- **D-3 2차(후행)**: Email Workers = ADR-043 §3 carry-over. `[[send_email]]` 바인딩 + **config 주입 발신자 `{exam}.thepick.co.kr`**(★`thepick.app` 금지 — 3자 소유 collision `project_custom_domain_thepick_app_collision`). optional additive — D1+대시보드가 진실원, email은 best-effort.
- **D-4 불채택**: Workers Queues = 현 단일 운영자(진산) 규모에 불요(§5). cron→D1→admin-poll로 충분.

---

## §4 스키마 변경 목록 (L3 — plan only, SQL 0줄)

> 아래는 **설계 목록**이다. **SQL 작성·마이그 파일 생성 = §9 결재 후.** 슬롯 0041+(착수 시 재확인). ★ **결재 포인트**: RW 스키마 홈 = 기존 `migrations/`(0041+) vs 인용된-미생성 `migrations-v2/`(exam-generic T5)? → §9 Q7.

| 대상                            | 변경                                                                                             | 유형                 | 근거                        |
| :------------------------------ | :----------------------------------------------------------------------------------------------- | :------------------- | :-------------------------- |
| revision_changes                | `+effective_date`, `+exam_id`, `+source_ref`(URL/조문FK), `+status`                              | ADD COLUMN(nullable) | G-RW-1/5                    |
| knowledge_nodes                 | `+valid_from`,`+valid_until`,`+source_url`,`+source_article_code`                                | ADD COLUMN(nullable) | G-RW-1, exam_questions 미러 |
| formulas/constants              | `+valid_from`,`+valid_until`                                                                     | ADD COLUMN           | G-RW-1                      |
| UPDATE 금지 트리거(0014)        | WHEN 절에 신규 컬럼 추가(INSERT-only 유지)                                                       | 트리거 개정          | 3-A-4                       |
| **mav_supersedes 트리거(0013)** | draft superseder 비활성화 방지 **+ 승격시 flip 동반 트리거**(AFTER INSERT ON status_transitions) | 🔴 트리거 2종        | **G-RW-4**                  |
| knowledge_edges                 | `prevent_update`/`prevent_delete`(SUPERSEDES) + (선택)`status`                                   | 트리거/컬럼 신설     | G-RW-6a                     |
| 신규 테이블                     | `revision_review_queue`, `revision_watch_sources`, `revision_watch_runs`                         | CREATE TABLE         | 3-B-4/3-D-1                 |
| packages/shared                 | `RevisionChange`/`ChangeType`/`RevisionStatus` 타입 승격                                         | 타입(비 DB)          | 3-A-3                       |

---

## §5 PITR — 기술 선택지 비교 (권고 = 진산 결재 대상)

| 축                                  | A                                                                                               | B                                                         | C                        | 권고                                                          |
| :---------------------------------- | :---------------------------------------------------------------------------------------------- | :-------------------------------------------------------- | :----------------------- | :------------------------------------------------------------ |
| **감지 소스**                       | law.go.kr Open API(구조화 diff+시행일)                                                          | HTML 스크레이프                                           | 수동 유지(현행 교수 PDF) | **A(실재 시)+C 폴백** — spike 판정. B는 최후                  |
| **알람 채널**                       | D1 review-queue+admin 대시보드 폴                                                               | Email Workers                                             | Workers Queue fan-out    | **A(MVP)**, B 2차, C 불채택                                   |
| **effective_date 배치**             | revision_changes만                                                                              | +knowledge_nodes valid_from                               | 별도 effectivity 테이블  | **B** — 학습자 검색 필터에 직접 필요                          |
| **draft SUPERSEDES 게이트(G-RW-4)** | 트리거 status 조건 **+ 승격시 flip 동반 트리거**(A 단독=불완전: 스냅샷 status 동결·재발화 없음) | edge status 컬럼+승격시 활성화(**C-3 화이트리스트 필요**) | (현행 유지=위험)         | **A vs B = §9 결재** — 완전성·비용 상이(둘 다 companion 수반) |
| **스키마 홈**                       | migrations/ 0041+                                                                               | migrations-v2/ 신설(exam-generic)                         | —                        | **§9 결재**(M1 exams/·2호 재사용 연동)                        |

---

## §6 Binary Gates (완료 판정 = 입력→출력 기계 판정)

- **G-RW-1**: effective_date 축 도입 후, 4 미시행 노드(LAW-022/023/053/INV-087)가 `valid_from='2026-08-15'` 로 적재되고 **오늘(<시행일) 전 학습자 경로에서 배제**됨을 실측 — approved-nodes-sql **및 `study/routes` enrichRelatedNodes(/next·/grade sourceCitation)** 양쪽, PASS/FAIL. (단일 필터점 테스트는 불충분 — §3-A-2)
- **G-RW-2**: (a) draft superseder INSERT 시 approved old 노드 비활성화 **안 됨** + (b) 그 superseder **승격 후** old 노드가 `is_current_active=0` 로 flip + **이중 active 0** — 2단 트리거 검증 RED→GREEN.
- **G-RW-3**: 감지 잡이 신규 cron 문자열로 실제 dispatch됨(다중 cron 리팩터 검증) — fake-timer 테스트.
- **G-RW-4 (spike)**: 1차 소스 1종 이상에서 프로그래밍 접근 + diff 추출 실증 or **명시적 "접근 불가 → 수동 폴백 확정"**(fabricate 금지, 미달도 사실 그대로 — E-4).
- **G-RW-5**: exam_id 파라미터로 son-hae/전기 소스 분리 라우팅(하드코딩 grep 0) — Hard Rule 17 검증.
- **G-RW-6**: 알람 = admin 대시보드에 pending 카운트 실표시 + ContentQueue 승격 e2e — PASS/FAIL.
- **G-RW-7**: 반영 후 `auditProductionGraph` 순환/고아/끊김 0 — 무결성 러너.

---

## §7 리스크·에스컬레이션

- **E-1(비가역)**: effective_date/트리거 개정 = L3 스키마 → 마이그 SQL 작성 전 §9 결재. `migrations-v2` vs `migrations` 결정 선행.
- **E-2(정답 정확성)**: 감지 diff의 개정 해석 = LLM 요약이나 **수치/조문은 원문 대조 100%**(빈 catch 금지, 불일치 원인규명 전 진행 금지). draft-only이므로 학습자 노출 전 인간 검수.
- **E-3(소스 접근 미검증)**: law.go.kr/kec/큐넷 접근성 = **미측정**. spike 미달 시 "자동 감지 불가 → 수동 개정 배치(현행) 유지 + 알림만 자동"으로 정직 축소(RULE #5).
- **E-4(외부 인용)**: 소스 API 스펙은 실호출 대조 후에만 전제(가드레일 17).
- **E-5(2호 연동)**: exam-generic 스키마 = M1 exams/ 골격 결재(§9 M1)와 상호의존 — 순서 조율 필요.

---

## §8 단계 (Phase 0~5 — 순서 위반 금지)

| Phase  | 내용                                                                                                      | 게이트          | 자율/결재                    |
| :----- | :-------------------------------------------------------------------------------------------------------- | :-------------- | :--------------------------- |
| **0**  | effective_date/valid_from 스키마 + shared 타입 (마이그 SQL 선작성 라벨)                                   | G-RW-1 SQL 검증 | 👤 §9 결재 후 🤖             |
| **1**  | **★ G-RW-4 트리거 지뢰 수정** (draft superseder 게이트) + edge immutability                               | G-RW-2          | 👤 결재 후 🤖 (BLOCKER 우선) |
| **2**  | 4 미시행 노드 backfill = **첫 검증 케이스**(E0-8 §D / Track B 연동)                                       | G-RW-1 실측     | 👤 검수(도메인 대조)         |
| **3a** | **감지 feasibility spike**(law.go.kr 등 접근 실측 — 버려질 스파이크)                                      | G-RW-4          | 🤖 spike(무커밋)             |
| **3b** | 다중 cron 리팩터 + revision-watch.ts(spike PASS 시)                                                       | G-RW-3          | 👤 결재 후 🤖                |
| **4**  | 알람 = revision_review_queue(**CREATE TABLE = 👤 결재 후**) + ContentQueue 배선·telemetry 배지(코드 = 🤖) | G-RW-6          | 👤→🤖                        |
| **5**  | exam-generic 소스 레지스트리(2호 대비) + Email Workers(2차)                                               | G-RW-5          | 👤 M1 연동                   |

---

## §9 진산 결재란 (미체크 — 코드 착수 차단)

- [ ] **Q1 (GO/STOP)**: 본 Revision Watch L3 plan 진입 승인? (Q5 필수 지시 이행)
- [ ] **Q2 (G-RW-4 지뢰)**: draft SUPERSEDES 게이트 = §5-D **A안**(트리거 status 조건 **+ 승격시 flip 동반 트리거** 필수) vs **B안**(edge status 컬럼 **+ C-3 화이트리스트**)? — ★A 단독 불완전, 완전성·트리거 비용 상이.
- [ ] **Q3 (effective_date)**: §5 배치 **B안**(knowledge_nodes valid_from) 채택?
- [ ] **Q4 (감지 소스)**: spike 우선순위 = law.go.kr Open API 우선 + 미달 시 수동 폴백 정직 축소 동의?
- [ ] **Q5 (알람)**: MVP = D1 review-queue+admin 대시보드(무벤더) 채택 / Email = 2차 이월 동의?
- [ ] **Q6 (첫 검증)**: 4 미시행 노드(LAW-022/023/053/INV-087) backfill을 첫 케이스로 = E0-8 §D 트랙 통합?
- [ ] **Q7 (스키마 홈)**: RW 마이그 = `migrations/`(0041+) vs `migrations-v2/` 신설(exam-generic T5)? — M1 exams/ 연동.
- [ ] **Q8 (범위)**: Phase 0~2(1호 시행시점 축·지뢰수정·backfill) 선행 / Phase 3~5(감지·2호) 후행 = 단계 분리 승인?

---

## §10 연동

- **M1 plan**(`m1-exams-scaffold-shared-detox.plan.md`): exam-generic 소스 레지스트리·effective_date = exams/{id} 골격 연동(§9 Q7).
- **E0-8 §D / Track B**: 4 미시행 노드 = 데이터 수리 트랙 공유(첫 검증 케이스).
- **ADR-043**(silent-failure-alert-routing): Email Workers 이월 = 본 D-3와 동일 채널.
- **exam2-electrical.feasibility.md** P-5(effective_date 1급): 2호 KEC 연 1~3회 개정 = 본 축의 최대 소비자.
- **W2 spike**: 2호 자료 인입 후 S-단계에서 본 축 실적재.
- **선재 carry-over (중복 설계 방지)**: `phase2a-user-search-route.plan.md` §2.2 + handoff-067 §3 이 knowledge_nodes.valid_from effectivity 필터를 Year 2 이월로 추적 중 — 본 §3-A-2 가 이를 승계. 문서 드리프트 정리 대상 = `SEARCH_PIPELINE.md` §4 / `ADR-012`(없는 knowledge_nodes.valid_from 가정).

> **다음**: §9 진산 결재 → (Q1 GO 시) Phase 0~1 착수(마이그 SQL — L3). **코드·SQL 착수 = 결재 전 자율 금지.**
