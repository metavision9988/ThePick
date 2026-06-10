G-AUDIT 독립 감사 보고서 — 쪽집게(ThePick)

▎ 감사 방식: 5개 독립 read-only 조사 에이전트 병렬 + 메인 세션 직접 교차검증
▎ 원칙: 코드/문서 직접 확인 사실만, 추측 시 [확인 필요], 파일:라인 인용

---

§ 1. 프로젝트 아이덴티티

- 프로젝트 이름: 쪽집게(ThePick) — 손해평가사 자격시험 AI 학습 서비스 (CLAUDE.md:7)
- 도메인: 대한민국 손해평가사 자격시험(1차+2차). 교재 835쪽 + 기출 ~581문항(7회분, 제5~11회) (CLAUDE.md:9)
- 응시 규모: Year 1 손해평가사 ~1만 명 시장; Year 2+ 공인중개사·전기기사 확장 (docs/쪽집게(ThePick) — 구현 재정립서 v3.0 FINAL.md:65) — 정확 수치는 [확인 필요] (재정립서 인용은 시장 추정치)
- 현재 마일스톤: 상충 발견 (§10에 상술). .jjokjipge/wbs-quality-progress.md:§0은 "Phase 3 launch 직전 production deploy chain 종착 (Session 069, 2026-05-12)". 그러나 CLAUDE.md:현재 상태는 "Phase 0 착수 대기"로 명시 —
  문서 드리프트 확정.
- 한 줄 정의: "Graph RAG 기반 교재 835쪽 + 기출 ~581문항 구조화 + 룰 엔진 산식 연산 + 혼동 유형 자동 감지 + FSRS 간격반복" (CLAUDE.md:9-11)
- 한 줄 정의 plan.md 일치: [확인 필요] — 조사 에이전트는 핵심 미션은 일관되나 Phase 단계 표기가 문서별 상이(Step-based vs Phase-based)라고 보고. 전수 대조는 미수행.

---

§ 2. Cloudflare 컴포넌트 인벤토리

설정 출처: apps/api/wrangler.toml

┌─────────────────┬─────────────┬───────────────────────────────────────────────────────────┬────────────────────────────────────────────────────────┐
│ 컴포넌트 │ 상태 │ 용도 │ 설정 위치 │
├─────────────────┼─────────────┼───────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ Workers │ 사용중 │ Core API (Hono) │ apps/api/wrangler.toml:1-6 │
├─────────────────┼─────────────┼───────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ Workers AI │ 사용중 │ bge-m3 임베딩 (1024d, cosine) │ wrangler.toml:106,112-114 │
├─────────────────┼─────────────┼───────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ D1 │ 사용중 │ thepick-db-{dev/staging/production}, ~26~28 테이블 │ wrangler.toml:47-51,130-134,191-195 │
├─────────────────┼─────────────┼───────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ Vectorize │ 사용중 │ thepick-embeddings (1024d cosine), staging 분리 │ wrangler.toml:108-110,166-168,227-229 │
├─────────────────┼─────────────┼───────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ KV │ 사용중 │ CACHE 1 네임스페이스 │ wrangler.toml:53-55 │
├─────────────────┼─────────────┼───────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ R2 │ 미사용 │ 바인딩 없음 │ — │
├─────────────────┼─────────────┼───────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ Durable Objects │ 미사용 │ 주석 참조만 │ — │
├─────────────────┼─────────────┼───────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ Queues │ 미사용 │ 바인딩 없음 │ — │
├─────────────────┼─────────────┼───────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ Pages │ 계획중/부분 │ admin-web (Astro), production 도메인 미정 │ apps/admin-web/astro.config.mjs │
├─────────────────┼─────────────┼───────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ AI Gateway │ 미사용 │ 타입 정의만 │ apps/api/worker-configuration.d.ts │
├─────────────────┼─────────────┼───────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ Hyperdrive │ 미사용 │ 바인딩 없음 │ — │
├─────────────────┼─────────────┼───────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ Cron Triggers │ 사용중 │ rate_limits GC (UTC 03:00 일 1회) + silent_failure 모니터 │ wrangler.toml:240-247, apps/api/src/index.ts scheduled │
└─────────────────┴─────────────┴───────────────────────────────────────────────────────────┴────────────────────────────────────────────────────────┘

외부 vendor (단일 벤더 정합 검증):

- Anthropic API: 런타임 직접 호출 없음. packages/ai-adapter/src/anthropic-adapter.ts:64-66은 NOT_IMPLEMENTED throw 스텁. 명시 인용: "Year 1 BATCH 적재는 Claude Code (Opus 4.7) 직접 처리이므로 본 어댑터 미경유."
  packages/parser/src/batch-processor.ts:96에 claude-haiku-4-5-20251001 모델 명세가 존재하나, 이는 contract/프롬프트 스펙이며 Year 1 런타임 호출 경로인지는 [확인 필요] (메모리 project_batch_load_workflow는 "본 프로젝트
  Claude API 호출 X, Opus 4.7 직접 처리" 명시).
- OpenAI API: 미사용 (직접 호출/임포트 0건).
- 그 외 외부 서비스: 미발견. ADR-022가 Cloudflare 단일 벤더 5년 lock 명문화 (docs/adr/ADR-022-cloudflare-single-vendor-lockin.md).

---

§ 3. Graph RAG 구현 패턴 식별

판정: Pattern A (D1 native KG + Vectorize). B/C/D/E 해당 없음.

- (1) 스키마 정의: migrations/0001_initial_schema.sql:11-51 — knowledge_nodes(id/type/name/description/page_ref/truth_weight/status/is_current_active), knowledge_edges(from_node/to_node/edge_type/condition/priority).
  7 node type CHECK: LAW/FORMULA/INVESTIGATION/INSURANCE/CROP/CONCEPT/TERM. 표 확장: migrations/0021_table_as_micro_kg.sql:50-142.
- (2) 엔티티 추출: 하이브리드. Claude(Haiku) 구조화 + 인간 검수. INSERT는 draft만 (migrations/0018_enforce_draft_only_insert.sql), 상태 전이 status_transitions 테이블 (migrations/0013).
- (3) 관계 추출: LLM-auto via knowledge_edges + SUPERSEDES (migrations/0014_phase05_critical_hardening.sql:56-89, temporal graph).
- (4) Community detection / 계층 요약: 미구현. topic_clusters(50개)는 정적 도메인 분류(보험종목/점수)이며 modularity 알고리즘 기반 아님. 동적 계층 집계 [확인 필요] (미발견).
- (5) 인덱싱 트리거: manual(admin /admin/vectorize/bootstrap) + status-gated + idempotent batch_run_id.
- (6) 증분 인덱싱: YES. migrations/0016_knowledge_nodes_batch_idempotency.sql:46-52 UNIQUE partial index (batch_run_id, source_id), apps/api/src/vectorize/upserter.ts idempotent upsert.

---

§ 4. 검색 인터페이스

┌────────────────────────────┬──────────────────────┬──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 인터페이스 │ 상태 │ 파일 경로 │
├────────────────────────────┼──────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 키워드 검색 (D1 LIKE) │ 구현됨 │ apps/api/src/search/multi-path-fallback/keyword-fallback.ts:72-140 │
├────────────────────────────┼──────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 벡터 시맨틱 (Vectorize) │ 구현됨 │ apps/api/src/search/user-search.ts:198-285 │
├────────────────────────────┼──────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 그래프 순회 (depth-N walk) │ 미구현 │ [확인 필요] (재귀 walk 코드 미발견) │
├────────────────────────────┼──────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 인과 DAG 추론 │ 미구현 │ [확인 필요] (SUPERSEDES 검증만 존재, 인과 쿼리 없음) │
├────────────────────────────┼──────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Adaptive Router │ 부분 (fallback only) │ apps/api/src/search/multi-path-fallback/index.ts:58-99 (3-stage cascade, 질문유형 자동분기 아님) │
├────────────────────────────┼──────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Hybrid fusion (RRF) │ 미구현 │ [확인 필요] (Truth Weight rerank만, RRF 아님) │
├────────────────────────────┼──────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Re-ranking (cross-encoder) │ 계획중 │ docs/plans/phase2a-multi-path-fallback.plan.md:48-58 (bge-rerank = Option B carry-over) │
└────────────────────────────┴──────────────────────┴──────────────────────────────────────────────────────────────────────────────────────────────────┘

라우팅 로직: 3-stage 폴백 (apps/api/src/search/multi-path-fallback/index.ts): vector recall(sim≥0.60) → 키워드 폴백(한국어 조사 strip, keyword-fallback.ts:59-60) → topic-cluster 라우팅 → honest-refusal(review_queue
INSERT). Truth Weight 재정렬: LAW=10 > FORMULA=8 > INVESTIGATION=7 > CONCEPT=5 > TERM=3 (@thepick/shared/src/constants.ts).

---

§ 5. LLM 통합 (4 Layer Isolation)

- 공급자: 임베딩 = Cloudflare Workers AI(bge-m3, 1024d, cosine, docs/adr/ADR-004-vectorize-embedding-spec.md:29). 생성/구조화 = Year 1은 Claude Code Opus 4.7 직접(런타임 어댑터 미경유). 엔티티 추출 = 동일 (스텁).
- Layer 1 Schema validation: YES — packages/parser/src/schema-validator.ts:442-480 (JSON depth 50 limit, 100KB, Ontology Lock 검증).
- Layer 2 Constraint validation: YES — schema-validator.ts:241-245 (source_page 양의 정수), truth_weight 1~10 범위, node ID regex 화이트리스트.
- Layer 3 Cross-validation: NO [확인 필요] — dangling edge 참조 검증만 존재. Self-Consistency/Critic LLM/Ground Truth 대조 미발견.
- Layer 4 Graceful Degradation: YES — docs/adr/ADR-008-graceful-degradation-thresholds.md:20-82 (429 retry 3x exponential, D1 timeout→KV fallback, sim<0.60→"교재 N쪽 참고", write-path 실패→503+Retry-After).
- Cost cap per request (USD): [확인 필요] — 명시 USD 캡 미발견. 가격 상수만 (packages/shared/src/constants/claude-pricing.ts:25-34, Haiku $1/$5 per M tok). ADR-025 2-layer cost control: Layer 1 ≤$10/BATCH
  (docs/adr/ADR-025-two-layer-cost-control.md).
- Cost cap per user per day: [확인 필요].
- Timeout: batch-processor 30,000ms (packages/parser/src/batch-processor.ts:98), pdf 300,000ms, Vectorize 800ms (ADR-008).
- Prompt injection 방어: Ontology Lock regex 시스템 프롬프트(batch-processor.ts:105-150) + JSON depth 50 + HTML escape(schema-validator.ts:618). 단, Year 1 런타임 LLM 호출 부재로 실효 표면 제한적.
- Output PII filter: YES — packages/shared/src/logger.ts:45-93 (40+ 키 재귀 마스킹). 한계: 대문자 정규화 미흡(MAJOR-3-1 식별).

---

§ 6. 데이터 수집 및 인덱싱

- 입력 소스: Q-Net 기출+정답(PDF, 공공누리 1유형), 농업정책보험금융원 교재(PDF), 법제처 법령(PDF/HTML) — docs/adr/ADR-001.
- 소스 형식: PDF 주력 (pdfplumber Python subprocess, packages/parser/src/pdf-extractor.ts).
- 저작권: verbatim 차단 = [확인 필요] (ADR-001 의도 명시, 코드 메커니즘 미확인). 라이선스 추적 = YES (source_page 메타 + Q-Net attribution). (메모리 feedback_copyright_skip: 진산 "문제없음" 명시 — 본 항목 감사 비중
  낮춤 권고)
- 청킹: 계층 섹션 경계(장→절→항), packages/parser/src/section-splitter.ts. 청크 크기/오버랩 토큰 = [확인 필요] (구조 경계 기반, 명시 토큰 한도 미노출).
- 임베딩: bge-m3, 1024d, cosine (ADR-004).
- 인덱싱 비용/시간: 1문서 비용/시간 = [확인 필요] (실측 미수집). ADR-004:96 "수천 노드 × $0.001 수준" 추정만. current.plan §비용: BATCH-1 smoke ~$0.05, full ~$0.20-0.50 (추정).

---

§ 7. 인용 및 출처 추적

- 모든 답변 출처 명시 가능: 부분 — BATCH 적재 단계는 강제, 런타임 응답 단계는 [확인 필요] (L3/BATCH-1 미진입).
- 출처 최소 단위: 페이지 + 챕터/절 4컬럼 구조화 — book_page(int, 사용자노출), pdf_page(int, 추적), chapter, section (docs/adr/ADR-030-knowledge-nodes-page-chapter-meta.md:65-79).
- 그래프 엔티티→소스 매핑: YES — source_page/source_id 필드 + ontology-registry 정합 (packages/parser/src/schema-validator.ts:60-61,241-245).
- 원문 verbatim 차단: [확인 필요] — 코드 수준 명시 차단 로직 미발견. DB 스키마는 출처 보유하나 응답 생성 필터는 BATCH-1/L3 후 확인 대상.
- 출처 불가 답변 차단: 사전(BATCH) = YES (schema-validator.ts:241-245 MISSING_SOURCE_PAGE 에러 + migration 0019 NOT NULL 트리거). 런타임 = [확인 필요].
- Hard Limit 인용: CLAUDE.md:62 — "knowledge_nodes, formulas 테이블 UPDATE 금지(개정 시 신규 노드 + SUPERSEDES 엣지)" + page_ref NOT NULL. 강제 위치: schema-validator.ts:241-245 + migration 0019 트리거 + 메모리
  project_source_citation_requirement ("근거 0건 = approved 불가").

---

§ 8. 현재 규모 및 성능

┌────────────────────────────────┬────────────────────────────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 지표 │ 현재 값 │ 측정 출처 │
├────────────────────────────────┼────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 엔티티 수 (knowledge_nodes) │ [확인 필요] │ BATCH-1 미적재, docs/measurements/ 미populate │
├────────────────────────────────┼────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 관계 수 (edges) │ [확인 필요] │ 동일 │
├────────────────────────────────┼────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 청크 수 │ [확인 필요] │ 동일 │
├────────────────────────────────┼────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 벡터 수 (Vectorize) │ 1277 (1024d cosine, +50 topic_cluster) │ .jjokjipge/handoff-session-069.md:169-170 (2026-05-12). 단 topic_cluster + smoke 데이터 위주, 전체 KG 아님 │
├────────────────────────────────┼────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ D1 DB 크기 │ [확인 필요] │ migration 0001~0037 적용, 크기 메트릭 부재 │
├────────────────────────────────┼────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 쿼리 지연 simple/multi-hop/p95 │ [확인 필요] │ Phase 2 Eval MVP 평가 미동기 │
├────────────────────────────────┼────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 1문서 인덱싱 지연 │ [확인 필요] │ BATCH-1 smoke (Group A) 진입 대기 │
└────────────────────────────────┴────────────────────────────────────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

전 성능 지표 [확인 필요] — BATCH-1 실적재 미진입. vectorCount 1277은 BATCH-1 이전 topic_cluster/smoke 수치.

---

§ 9. 검증 환경 (6 Layer Verification Pyramid)

┌────────────────────────────┬────────┬────────────────────────────────────────────┬─────────────────────────────────────────────────────────────────────────────┐
│ Layer │ 상태 │ 커버리지 │ 핵심 파일 │
├────────────────────────────┼────────┼────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────┤
│ L1 단위 (Vitest) │ 구현됨 │ 96 .test.ts 파일 (직접 카운트) │ packages/_/src/**tests**/, apps/_/src/**tests**/ │
├────────────────────────────┼────────┼────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────┤
│ L2 통합 (miniflare/sqlite) │ 부분 │ D1 트리거/sqlite-backed 시나리오 │ apps/api/src/**tests**/scenarios/cha-01-d1-disconnect.test.ts (node:sqlite) │
├────────────────────────────┼────────┼────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────┤
│ L3 Contract (Zod/Schema) │ 구현됨 │ 8종 ValidationErrorCode │ packages/parser/src/schema-validator.ts:170-197 │
├────────────────────────────┼────────┼────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────┤
│ L4 회귀 │ 구현됨 │ determinism property test │ packages/formula-engine/src/**tests**/determinism.property.test.ts │
├────────────────────────────┼────────┼────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────┤
│ L5 E2E (Playwright) │ 구현됨 │ 5 .spec.ts (chromium 12 PASS 본 세션 검증) │ apps/web/e2e/\*.spec.ts │
├────────────────────────────┼────────┼────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────┤
│ L6 Human Gate │ 구현됨 │ 진산 승인 프로토콜 + 4-Pass/5-페르소나 │ .claude/rules/auto-review-protocol.md │
└────────────────────────────┴────────┴────────────────────────────────────────────┴─────────────────────────────────────────────────────────────────────────────┘

- L5 E2E 정의: apps/web/playwright.config.ts — happy-path/session-restoration/mobile-375/api-errors/silent-failure-surface. 도메인 골든 자산: apps/batch/src/fixtures/ +
  packages/formula-engine/src/**tests**/batch\*-golden.test.ts (조사 에이전트 보고, 메인 세션 미직접확인 → [확인 필요]).
- G1 Foundation Drift: IDEA_PITCH 한 줄 정의 plan 전수 일치 = [확인 필요]. WORLDVIEW Hard Limit 모듈 CLAUDE.md 인용 = [확인 필요]. NORTH_STAR↔ROADMAP 모순 = 확인 (§10 CLAUDE.md vs WBS 마일스톤 불일치).

---

§ 10. 알려진 문제 / 미해결 ADR / Discovery

- ADR 총수: 42개 (ls docs/adr/\*.md 직접 카운트).
- 임시(temporary) 정책 ADR: ADR-034(테스트 비번 정책), ADR-035(pbkdf2 iterations), ADR-036(auth cookie SameSite), ADR-037(임시 정책 거버넌스 + carry-over 만료 점검 의무). 만료 deadline = [확인 필요].
- Concept Pollution: ADR-010 (status_canonical 컬럼 "Phase 2 후 DROP, deprecated 마크"), ADR-039 (4-mode 표 deprecated → 5-mode contract). 폐기 개념은 ADR로 추적 관리됨.
- 미해결 carry-over (handoff-083): ADR-040 §8.1 매트릭스 #3~#8 — 본 감사 직전 세션(078)에서 6건 전부 흡수 완료, commit 1f34b0d (감사 시점 정정). Year 2 carry-over 4건(examId whitelist 추출, fixture per-exam,
  multi-tenant X-Test-Session, endpoint contract sync) 잔존.
- ★ Foundation drift 확정 지점: CLAUDE.md:현재 상태가 "Phase 0 착수 대기 (DB 스키마 + PWA 셸부터)"로 명시. 실제는 .jjokjipge/wbs-quality-progress.md:§0 "Phase 3 launch 직전 production deploy chain 종착(Session 069)" +
  production D1 0001~0031 적용 + production Worker 배포 + 83 핸드오프 누적. CLAUDE.md "현재 상태" 섹션이 심각하게 stale — 신규 세션 컨텍스트 오염 위험.
- state.json/WBS 진실성: .jjokjipge/wbs-quality-progress.md는 handoff-N+1 sync 의무 살아있는 문서이나 Session 069 부분 sync만 (§0+footer). Session 040~069 전체 reconstruction은 carry-over 미해소. WBS의 HEAD 표기
  a5a8dac(Session 069)는 현재 HEAD 1f34b0d(Session 078)와 불일치 = stale. 자동 갱신 아닌 수동 sync 의존.
- Hard Rule 위반: 0건 (조사 에이전트 scripts/verify-engine-contracts.ts PASS 보고, 메인 세션 미재실행 → [확인 필요]).

---

§ 11. 다음 마일스톤 진입 조건

- 현 마일스톤 합격 조건: Phase 3 launch — 5 CRITICAL 매트릭스 + production D1 0030/0031 + login_history smoke + ADR-034/035/036 retrofit (.jjokjipge/wbs-quality-progress.md:§0, Session 069 시점 5/5 보고).
- 합격까지 잔여 (handoff-083 + 본 세션): ADR-040 §8.1 #3~#8 = 본 세션 흡수 완료. 잔여: #7 SameSite=None+Secure는 unit contract 선행 흡수했으나 실 HTTPS E2E 환경 빌드는 Phase 3 launch 스프린트 carry-over. Step 3-UX-7b
  distractor BATCH(L3, 진산 승인 필요), Year 2 foundation 4건.
- 차기 마일스톤: Phase 3 launch 후 학습 UX plan (launch 1주 직전 신규) + quarterly carry-over (.jjokjipge/wbs-quality-progress.md:65-66).
- Kill Switch:
  - K1/K2/K3: [확인 필요] — 4종 명시 정의 문서 미발견. ADR-025 cost control은 'ok'|'soft_warn'|'hard_throttle'|'kill_switch' 상태 머신 정의 (docs/adr/ADR-025-two-layer-cost-control.md).
  - K4 (60일 commit 0 휴면): 유보(미발동) — 최근 commit 1f34b0d authored 2026-05-14, push 2026-05-15. 휴면 카운터 0일.

---

§ 12. 자유 진술 — 인지 한계 자수 (Honest Escalation)

- 추측/환각 가능성 의심 섹션:
  - §4 그래프 순회·인과 DAG "미구현" 판정: 조사 에이전트가 "재귀 walk 코드 미발견"으로 보고했으나, 미발견 ≠ 부재. 별도 패키지/미인덱싱 경로에 존재할 가능성 배제 못 함. 메인 세션이 전수 grep 미재검증.
  - §9 골든 자산 경로: apps/batch/src/fixtures/batch-1-golden.json 등은 조사 에이전트 보고이며 메인 세션이 파일 존재를 직접 확인하지 않음 → [확인 필요] 표기했으나 보고서에 사실처럼 흐를 위험.
  - §5 Layer 3 "NO" 판정: cross-validation 부재는 "미발견" 기반. Self-Consistency가 다른 명칭(Truth Weight rerank PoC 등)으로 부분 존재할 여지.
  - §2 batch-processor.ts 런타임 경로: line 96의 Haiku 모델 명세가 Year 1에 실제 실행되는지 vs Opus-direct 스펙인지 메인 세션이 코드 실행 경로를 추적 못 함. 메모리 진술에 의존.
- 발견했으나 정확한 의미 불명: table_cells_new/table_structures_new 테이블 — migration 0021 계열 재구성 artifact로 추정되나 logical table 카운트(26 vs 28) 영향. 정확한 운영 여부 [확인 필요].
- 진산 암묵 합의 가정 중 명시 확인 필요: (a) CLAUDE.md "현재 상태" stale을 진산이 인지하고 방치 중인지 vs 갱신 누락 사고인지. (b) BATCH-1 미진입 상태에서 "Phase 3 launch 직전"이 production 인프라 기준인지 콘텐츠
  기준인지 — 두 정의가 충돌(인프라는 배포 완료, 콘텐츠 KG는 0건).
- 외부 검토자 오전달 위험: 본 보고서가 "Phase 3 launch 직전"을 그대로 전달하면 외부 리뷰어가 콘텐츠/RAG가 작동하는 제품으로 오인할 수 있음. 실제: production 인프라·인증·스키마는 배포됐으나 핵심 지식
  그래프(knowledge_nodes BATCH)는 미적재. vectorCount 1277은 topic_cluster/smoke 수치. 이 구분이 본 감사의 가장 중요한 정정 포인트.

---

§ 13. 자기 검증

☑ Q1. §1~12 전 섹션 채움 ([확인 필요] 포함) — YES
☑ Q2. 사실 보고 파일경로 인용 누락 — §1 응시규모, §6 청킹 등 일부는 [확인 필요]로 후퇴 처리. 의도적.
☑ Q3. 주관 평가어 사용 — 메인 보고 본문에서 "좋다/괜찮다/안정적" 미사용. 조사 에이전트 원문의 "✅/Excellent/Low risk"는 본 종합에서 사실/수치로 치환.
☑ Q4. §12 환각 자수 1건+ — 4건 자수 (§2/§4/§5/§9). 충족.
☑ Q5. 외부 검토자 단독 파악 가능 — 부분. §10 foundation drift + §12 "인프라 vs 콘텐츠" 정정으로 오인 방어. 단 §8 전 지표 [확인 필요]라 성능 판단 불가 명시.
☑ Q6. 시간 캘린더 침투("이번 주/곧") — 미사용. 절대 날짜(2026-05-14 등)만 사용.

---

종결 메타정보

- 작성 일시: 2026-05-15 (commit 기준일 2026-05-14)
- 보고서 출력 토큰 추정: ~6,500 tokens
- git 최신 commit SHA: 1f34b0d1fdd6a0d33b2f9b196600dc6c7d024062 (origin/main 동기화 완료)
- 외부 메타 검토 세션 제출 가능 형태 확인: YES

---

감사관 핵심 정정 (외부 리뷰어 필독):

1. CLAUDE.md "현재 상태"(Phase 0) ↔ WBS(Phase 3 launch 직전) 문서 드리프트 확정 — 신규 세션 컨텍스트 오염 위험. 갱신 필요.
2. "Phase 3 launch 직전"은 production 인프라 기준 (Worker/D1/인증 배포 완료). 핵심 지식 그래프 KG는 미적재 — BATCH-1 Group A smoke test 진입 대기. vectorCount 1277 = topic_cluster/smoke.
3. Year 1 LLM 런타임 호출 0건 — 구조화는 Claude Code Opus 4.7 직접 처리, anthropic-adapter는 스텁.

✻ Cooked for 8m 52s

※ recap: G-AUDIT 감사 보고서를 완성해 전달했습니다. 핵심 발견은 CLAUDE.md가 Phase 0이라 표기하지만 실제는 Phase 3 인프라 배포 완료(단 지식그래프 미적재) 드리프트입니다. 다음: 진산님이 ②~④ 중 진행 방향 결정.
