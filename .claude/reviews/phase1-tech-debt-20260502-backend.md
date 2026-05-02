# Phase 1 5-페르소나 기술부채 심층 리뷰 — backend-architect

**작성일**: 2026-05-02 ~15:30 KST
**리뷰 방식**: 독립 에이전트 (`backend-architect`, agentId `a15b4ca611de6fa2a`)
**페르소나 핵심 질문**: "2년차에 뭐가 아플까?"
**리뷰 범위**: D1 17 마이그레이션 + 4 라우트 + Drizzle schema + Vectorize 메타 + Hard Rule 16/17 + Temporal Graph + Year 2 zero-cost 4 레벨

---

## CRITICAL — BATCH-1 적재 전 의무 (3건)

### B-C1 — Hard Rule 16 zero-cost 약속 위반 — 9 지식 테이블 全 examId 시그니처 부재

**증거**:

- `apps/api/src/db/schema.ts:116-339` 9 테이블 (knowledge_nodes / knowledge_edges / formulas / constants / revision_changes / exam_questions / mnemonic_cards / user_progress / topic_clusters) 어디에도 `exam_id` 컬럼 부재. `engine_telemetry` (line 600-626) 만 examId 도입
- `apps/api/src/progress/routes.ts:114-123, 174, 189-194, 249-256` — 모든 D1 쿼리 (`/summary`, `/review`, `/due`) 가 `WHERE user_id = ?` 만 — `grep -n "examId"` 0건
- `apps/api/src/auth/routes.ts:240-300` — users 테이블 (시험 무관 OK), 그러나 `subscribed_exams` JSON 만 — progress 자동 격리 없음

**Year 2 영향**: 동일 user 가 손해평가사+공인중개사 양쪽 구독 시 (`subscribed_exams: ["...", "..."]`) `/api/progress/summary` 가 두 시험 데이터 합산 응답. 호출 측 전원 수정 필요 → zero-cost 약속 파산.

**Hard Rule 16 v1.2 본문**: "Year 1 시점에 데이터 조회 함수에 examId 가 없다 = Year 2 전환 시 호출 측 전원 수정 필요 = Rule 16 위반" — **현 시점 이미 위반 판정**.

**즉시 의무**:

1. BATCH-1 적재 진입 차단 — progress/routes.ts 의 3 엔드포인트 시그니처에 `examId: ExamId` query 강제 (telemetry/routes.ts:214-226 `parseExamIdQuery` 패턴 재사용)
2. Year 1 단일 시험 — `examId === DEFAULT_EXAM_ID` assertion. PWA 는 `EXAM_IDS.SON_HAE_PYEONG_GA_SA` 고정 전달

### B-C2 — production 환경 마이그레이션 0/17 적용 — staging dry-run 의무

**증거**:

- `wrangler.toml:126-137` `[env.production]` `database_id = "a9b8d521-..."` 정의됨
- v1.2 §10.7 #1 명시 "production 환경 마이그레이션 미적용 — local·dev 만 PASS"
- `migrations/` 17 파일에 down 스크립트 부재 (주석만 — 0017:127-133, 0016:92-97)
- 0016 line 96-97 — "SQLite는 ALTER DROP COLUMN 미지원 — knowledge_nodes 테이블 재생성 필요"

**Year 2 영향**: BATCH-1 적재 시점 production D1 첫 실행 → 트리거 12종 + CHECK 제약 + partial UNIQUE 인덱스 first-run 검증 0회. 0016 이 0014 트리거 DROP 후 재생성 → DDL ordering 검증 0회.

**즉시 의무**:

1. BATCH-1 적재 1주 전 staging D1 (`edacc775-b11c-...`) freshly 초기화 → 17 마이그레이션 순차 + 트리거 12종 INSERT/UPDATE 차단 시나리오 smoke test
2. production 적용 절차에 `wrangler d1 migrations list --env production --remote` 결과 BATCH-1 plan 첨부 의무

### B-C3 — engine_telemetry 1년 보존 GC runbook 부재

**증거**:

- `migrations/0017_engine_telemetry.sql:111-123` — `prevent_engine_telemetry_update` + `prevent_engine_telemetry_delete` 트리거 RAISE(ABORT) 차단
- 동 파일 line 115 안내 "Phase 2 retention policy via wrangler d1 execute manual override only" — runbook 없음
- v1.2 §10.7 #11 / 0017:48-54 — FK 부재 의도 명시

**Year 2 영향**: Phase 2 시점 1년 누적 row (8 게이지 × 매분 = 4.2M/년) DELETE 시도 → 트리거 ABORT. 운영자 `DROP TRIGGER → DELETE → CREATE TRIGGER` 3-step 수동 — 새벽 3시 SQL 실수로 WHERE 누락 시 전체 텔레메트리 손실. down 스크립트도 주석만 → wrangler 자동 rollback 0회.

**즉시 의무**:

1. `docs/runbooks/engine-telemetry-gc.md` 신규 — 1년 보존 GC 정확한 SQL 시퀀스 (트랜잭션 + cutoff 파라미터 + dry-run COUNT(\*) 선행)
2. Phase 2 진입 plan — "GC 1차 실행 시점 4-Pass 리뷰 + 진산님 승인" 게이트

---

## MAJOR — 6건 (Phase 2 명시 트래킹)

|  #  | ID   | 제목                                                         | 위치                                       | 흡수 시점                          |
| :-: | :--- | :----------------------------------------------------------- | :----------------------------------------- | :--------------------------------- |
|  1  | B-M1 | API v1 prefix 부재 — breaking change 시 deprecation 0건      | apps/api/src/index.ts:119-122              | Phase 1 막바지 (옵션) 또는 Phase 2 |
|  2  | B-M2 | webhook_events 1년 보존 정책 부재                            | apps/api/src/db/schema.ts:413-442          | Phase 3 PG 4종 진입 직전           |
|  3  | B-M3 | status_transitions exam_id 동기화 부재                       | apps/api/src/db/schema.ts:519-545          | Year 2                             |
|  4  | B-M4 | Vectorize 메타데이터 exam_id 강제 코드 경로 부재             | packages/shared/src/exam-adapter.ts:49-54  | Phase 2 진입 직전                  |
|  5  | B-M5 | engine_telemetry 인덱스 cardinality 변화 (Year 2)            | migrations/0017_engine_telemetry.sql:84-94 | Year 2                             |
|  6  | B-M6 | progress/review user_progress UNIQUE 부재 — 동시 INSERT race | apps/api/src/db/schema.ts:300-319          | Phase 2 FSRS                       |

---

## MINOR — 4건

- B-mn1: EXAM_IDS allowlist runtime check 1곳 — Year 1 영향 없음
- B-mn2: webhook payload signature 검증 통과 여부 분리 컬럼 부재
- B-mn3: dashboard 16 round-trip — performance 페르소나 dedupe (CRITICAL-PERF-1)
- B-mn4: engine_version major bump compatibility check 로직 미구현 — devops 페르소나 dedupe

---

## Devil's Advocate (4 시나리오)

1. **B-C1**: "Year 1 단일 시험이라 영향 없다" 판단 — Hard Rule 16 v1.2 명시 "Year 1 시점 이미 위반 판정". BATCH-1 직전 = 변경 비용 0 (PWA 미호출). 이 창 놓치면 Phase 2 admin-web + PWA + offline queue + IndexedDB 동시 마이그레이션
2. **B-C2**: "0017까지 staging 적용 PASS" — 0016 0014 트리거 DDL ordering 보장 없음. dry-run 의무
3. **B-M1**: "Hono path mount cheap — Phase 2 도입 가능" — 보호 쿠키 path fixed. 발급된 쿠키 호환성 = breaking change 증폭
4. **B-C3**: "telemetry GC = Phase 2 일이라 BATCH-1 무관" — BATCH-1 첫 24시간 폭발적 row 증가 (게이지 × 매분 = 11,520/일). 1주 만에 80K row. runbook 없으면 새벽 3시 on-call

---

## 누적 이월 MAJOR 36건 흡수 — backend 영역 통합 sprint

직전 4-Pass MAJOR-A2 (CHA-06 row count) + MAJOR-A3 (Hard Rule 16 시그니처) 본 리뷰 B-C1 + B-C2 와 직접 합치.

**BATCH-1 진입 차단 단일 게이트 (제안)**:

1. progress/routes.ts 3 엔드포인트 examId query 의무화 (B-C1 + 4-Pass MAJOR-A3 동시)
2. CHA-06 row count invariant 테스트 (4-Pass MAJOR-A2)
3. staging dry-run smoke test 결과 BATCH-1 plan 첨부 (B-C2)
4. engine-telemetry-gc.md runbook (B-C3)

위 4건 단일 sprint (~1.5일) — 통과 후 BATCH-1 적재 trigger 허용.

---

## 판정

**BATCH-1 적재 차단 의무 (B-C1, B-C2, B-C3 해소 전)**

---

**원본 에이전트**: `backend-architect` (agentId: `a15b4ca611de6fa2a`)
