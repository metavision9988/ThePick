# 4-Pass 독립 리뷰 — G-OLD-8 가드 폐기 커밋 (serving-guard 삭제 + status='active' 데이터 정본 전환)

- **일시**: 2026-07-12 17:53:50
- **리뷰 방식**: 독립 에이전트 5개 (scope / Surgeon / Architect / Advocate / Contract) + 발견별 적대적 반증
- **근거 프로토콜**: `.claude/rules/auto-review-protocol.md` 4-Pass (규칙 0 독립 에이전트 / 규칙 1 전체 범위 / 규칙 2 증거 기반 / 규칙 3 반론 의무)
- **확정 발견 (적대적 반증 통과분만)**: **CRITICAL 0 / MAJOR 1 / MINOR 8**

## 리뷰 범위

**변경 파일 3개** (git status 실측, 순변경 33+/159−):

- `apps/api/src/study/routes.ts` (M)
- `apps/api/src/study/__tests__/routes.test.ts` (M)
- `apps/api/src/study/serving-guard.ts` (D — 삭제)

**연관 파일 9개**:

- `migrations/0044_exam_questions_old_rows_retirement.sql`
- `docs/runbooks/migration-rollback/0044_rollback.sql`
- `docs/plans/old-rows-retirement-0044.plan.md` (§5 G-OLD-8 의무 리뷰 근거)
- `apps/api/src/index.ts` (유일 런타임 마운트)
- `apps/api/src/public/routes.ts` + `apps/api/src/public/__tests__/routes.test.ts` (동일 exam_questions 테이블·isServable 계약 공유)
- `packages/shared/src/public-learning-contract.ts`
- `apps/api/src/scheduled/silent-failure-monitor.ts` (제거된 oversample warn 로그 telemetry 정합)
- `apps/api/src/eval/multihop-accuracy.ts` (enrichRelatedNodes 동치 계약)

**변경 요약**: G-OLD-8 가드 폐기 커밋. `serving-guard.ts`(isMisgradableRow) 삭제 + routes.ts의 /next C-1 오버샘플(×3)·전 풀 재조회(2000) 로직을 단순 LIMIT 단일 쿼리로 복원, /grade의 C-1 422 가드 제거. 마이그 0044로 old 525행이 status='deprecated' 전이 → status='active' 필터가 데이터 정본으로 자연 배제·404 차단 (재도입 조건 = 0044 롤백 명시 주석). routes.test.ts는 C-1/D-02 가드 테스트 6건을 0044 이후 계약 테스트 4건(G-OLD-7 자연 배제·정직 exhausted·deprecated 채점 404·기존 채점 계약 불변)으로 재작성. 전 코드베이스 grep 확증: serving-guard/isMisgradableRow 잔존 참조 0 (public 표면 isServable은 shared 계약 정본으로 의도적 존속 = 잔여 위험 백스톱).

---

## ── 4-PASS REVIEW ──────────────────

리뷰 방식: 독립 에이전트 5개 (scope/Surgeon/Architect/Advocate/Contract) + 발견별 적대적 반증
리뷰 범위: 변경 파일 3개 + 연관 파일 9개 (위 목록)

### Pass 1 (Surgeon): ✅ 13건 확인 / 🔴 0건 / 🟠 0건 / MINOR 2건 / N/A 3건

확인 (증거):

1. PASS — apps/api/src/study/routes.ts:929-947 /next 단일 쿼리 복원: bind 순서 검증(userId→exam_type→(subject)→LIMIT countNum, nextBinds:920-923 와 placeholder 순서 1:1 일치), `.all()` 결과 빈 배열 시 :965-971 정직 exhausted 응답 — 크래시 경로 없음
2. PASS — apps/api/src/study/routes.ts:1094-1111 /grade question lookup: status='active' 필터 + `.first()` null → 404 QUESTION_NOT_FOUND (:1110-1111), deprecated 행 자연 차단 경로 확인. answer null/'' → 422 (:1114-1115) 선행 가드 존속
3. PASS — 제거 심볼 잔존 참조 0: 전 코드베이스 grep `isMisgradableRow|serving-guard|OVERSAMPLE|FULL_POOL|full-pool refetch` = apps/ packages/ scripts/ 히트 0 (serving-guard.ts 삭제 완결, dangling import 없음 — typecheck·lint 무오류로 이중 확증)
4. PASS — ★G-OLD-8 선행조건(마이그 적용) 라이브 검산: production D1 read-only 쿼리 실행 결과 exam_type='1st' status별 = active 521 / deprecated 525 — 0044 적용 완료 실증(routes.ts:925-928 주석의 데이터 전제가 실제 DB 상태와 일치). staging 은 deprecated 450/active 0 (-MC 미적재 드리프트 — 코드 결함 아님, 정직 exhausted/NO_QUESTION 동작)
5. PASS — Async/await: 변경 경로 전 D1 호출 awaited (routes.ts:931-947 /next 쿼리, :1094-1104 lookup, :978-1007 Promise.all enrichment). 유일 fire-and-forget = emitLearningTelemetry:740-763 (catch attached + waitUntil try/catch — 의도된 기존 패턴, 빈 catch 아님: :759-762 void promise 처리)
6. PASS — 에러 처리: 변경 부위 빈 catch 0건 (routes.ts:949-953 next query catch = logger.error + 503, :1105-1108 lookup catch 동일). stub/TODO/placeholder 0건 (변경 diff 33+/159− 전수 열람)
7. PASS — 테스트 재작성 정합: routes.test.ts:2166-2248 신규 4건이 0044 이후 데이터 상태(deprecated+superseded_by 백링크)를 정확 재현, vi import 제거 후 잔존 `vi.` 사용 0 (grep 확인). 실행 = api 49파일 785 PASS/2 skip, typecheck·lint 무오류
8. PASS — 롤백 상호참조 정합: routes.ts:927-928 '재도입 조건 = 0044 롤백' 주석 ↔ 0044*rollback.sql:9-12 'G-OLD-8 이후 롤백 금지' 분기 상호 일치. 0044 마이그:44-66 트리거 재생성 = 0038 원문 구조(status/superseded_by/valid*\* ABORT 유지)
9. PASS — 공개 표면 백스톱 존속: public/routes.ts:164-175 isServable + :455-471 위치라벨 fill_blank 채점 422 거부 + :563-567 reveal 거부 전부 불변, public routes.test.ts:154,297,313,433 가드 테스트 4건 존속. shared/public-learning-contract.ts 와이어 계약 무변경
10. PASS — silent-failure-monitor.ts:26-29 추적 이벤트 = streak_silent_failure/weak_delta_silent_failure 만 — 제거된 'next oversample window exhausted' 는 logger.warn 휘발 로그였고 telemetry 이벤트 아님 → monitor 정합 파손 0
11. PASS — eval/multihop-accuracy.ts:51-66 parseRelatedNodes ↔ routes.ts:530-574 enrichRelatedNodes 파싱 술어 동치 유지 (양쪽 무변경, cross-ref 주석 :522-528 존속), eval 테스트 17 PASS
12. PASS — index.ts:175-176 라우터 마운트 무변경 (createStudyRoutes/createPublicRoutes 유일 런타임 호출측), /api/study CORS :111 · /api/public credentials:false :135 불변
13. PASS — G-OLD-8 게이트 요소 대조 (plan:80): serving-guard/OVERSAMPLE/full-pool refetch 제거 ✓ / 관련 테스트 개정 ✓ / D-18 동치 불변식(= routes.ts:1655-1657 'available = /next 풀과 동치' 주석, 리뷰 INDEX:74 의 ':1668 주석')은 텍스트가 삭제된 적 없이 존속 — 가드 제거로 SQL 이 유일 필터가 되며 의미적 참이 복원됨 (별도 주석 편집 불요 판정)

N/A:

- 산식 정밀도/numeric_value vs value 혼용: 본 변경셋에 산식·calc 채점 로직 접촉 0 (gradeCalc 호출부 routes.ts:706-716 무변경, packages/learning-modes 무접촉)
- Formula Engine 동적 실행: 변경 파일에 Formula Engine 코드 없음 (0044 SQL 은 UPDATE/트리거만, eval·public·monitor 무변경 확인)
- Graceful Degradation 유사도<0.60: 검색/RAG 경로 본 변경셋 무접촉 (search/ 미변경)

반론 (Devil's Advocate): 적재는 Hard Limit 상 draft-only + 인간 검수 후 approved/active 이며 answer-integrity 영속 스크립트(G-OLD-1)와 4지선다 MC 계약 게이트가 데이터 측에서 방어한다 — 코드 백스톱 없이도 실질 발생 확률은 낮다. **재반론**: 그 게이트들은 -MC·old 클래스 워터마크 대상에 결부된 스크립트라 '신규 회차 기출 적재' 같은 미래 파이프라인이 동일 결함을 새 id 로 만들면 자동 발동 보장이 없고, 발동 실패 시 실패 모드가 '무음 오채점'(최악 클래스)이다 (→ MINOR-1). 또한 staging 리허설은 1st active 0행이라 본 커밋 핵심 경로의 실데이터 검증이 production 직행이 된다 (→ MINOR-2).

### Pass 2 (Architect): ✅ 14건 확인 / 🔴 0건 / 🟠 0건 / MINOR 2건 / N/A 4건

확인 (증거):

1. PASS — Import 방향: apps/api/src/study/routes.ts:24-73 임포트 전수 = @thepick/shared·learning-modes·srs(packages) + apps 내 상대경로만, packages→apps 역의존 0. serving-guard import 제거 후 전 레포 grep 'serving-guard|isMisgradableRow' 잔존 참조 0건 (git status: serving-guard.ts D 삭제 확인)
2. PASS — Workers 제약: 변경분 fs/path/Node 전용 API 0. 구 2-pass 오버샘플(×3)+전 풀 재조회(2000행) 제거 → /next 단일 쿼리(routes.ts:929-948) = rows_read·CPU 순감소 (10K 유저 스케일 개선 방향)
3. PASS — D1 스키마 일치: ExamQuestionRow(routes.ts:216-233) ↔ 0001:120-133 + 0032(input_type/distractors/calc_variables) 컬럼 정합. status='deprecated' 는 0001:128 CHECK(status IN ('active','deprecated','flagged')) 허용값 — 0044 UPDATE 위반 없음
4. PASS — 트리거 브래킷·롤백 정합: migrations/0044:24-25 DROP → :30-41 전이 UPDATE → :44-66 0038 원문 재생성. 롤백 런북 0044_rollback.sql:9-12 'G-OLD-8 이후 롤백 금지' 분기 실재 = routes.ts:928 주석 참조와 정확 일치
5. PASS — Temporal Graph 규칙: 0044 의 exam_questions status UPDATE 는 plan §9 Q1 A안(트리거 브래킷 상태머신) 결재 범위 내. knowledge_nodes/formulas UPDATE 0 (Hard Limit 무접촉). superseded_by 백링크 = EXISTS 가드로 dangling 참조 0 (라이브 실측 NULL=4 = 구조훼손 4건 정확)
6. PASS — 소비 표면 전수 정합: 인증 routes.ts:940(/next), :1100(/grade lookup) status='active'. 공개 public/routes.ts:243(overview), :291(/next), :393(/grade), :521(/reveal) status='active' + isServable(:164,:254,:328) 백스톱 존속. deprecated 전이 = 전 표면 일관 배제, 유출 경로 0
7. PASS — 라이브 데이터 정본 실측 (본 리뷰 직접, SELECT-only): production status 분포 deprecated=525 / active old 술어(1st+fill_blank+비MC)=0 / active 1st=521 / deprecated superseded_by NULL=4. staging: d1_migrations 0044=1 / active old=0. G-OLD-8 데이터 선행조건 성립 확증
8. PASS — silent-failure-monitor 정합: SILENT_FAILURE_EVENTS(silent-failure-monitor.ts:26-29) = streak_silent_failure·weak_delta_silent_failure 2종만. 제거된 'next oversample window exhausted' warn 은 logger.warn 이지 telemetry emit 아님 → 모니터 쿼리(:95-102) 무영향. grep 'oversample' apps/api/src = 0건
9. PASS — eval 파싱 동치 계약: eval/multihop-accuracy.ts:51-65 parseRelatedNodes 술어(JSON.parse/Array 검사/typeof string && length>0) ↔ routes.ts:530-548 enrichRelatedNodes 동치 유지, 본 diff 무접촉 (routes.ts:522-528 drift 방어 주석 존속)
10. PASS — index.ts 배선 불변: index.ts:111 CORS, :175 app.route('/api/study', createStudyRoutes()) 변경 0. 공개 표면 mount 무접촉
11. PASS — 테스트 계약 재작성: routes.test.ts diff = C-1/D-02 가드 테스트 6건 → 0044 이후 계약 4건(G-OLD-7 자연 배제 :2194 / 정직 exhausted :2210 / deprecated 채점 404 :2218 / 기존 채점 계약 불변 :2233). vi import 잔여물 제거 정합. 직접 실행 = 101/101 PASS (2.97s)
12. PASS — /grade 404 계약 연계: 인증 웹 클라 grep 'QUESTION_NOT_GRADABLE' = public/api.ts 만(공개 표면 유지분) → 인증 표면 dead 매핑 0. QUESTION_NOT_FOUND 는 기존 존재 코드(routes.ts:1111)라 클라 신규 처리 불요
13. PASS — 문서 정합: docs/architecture/ARCHITECTURE.md·docs/backend/BACKEND_MIDPOINT_REVIEW_20260707.md 에 serving-guard 참조 0. promo-1st-p4-frontend-ledger.md:81,113 참조는 당일 작업 원장(역사 보존 관례) — living doc 드리프트 아님
14. PASS — 로컬 테스트 스키마 경계: d1-from-sqlite.ts:44-85 SCENARIO_MIGRATIONS = 0001~0037(0038/0044 미포함)이나 routes.test.ts 는 deprecated 상태를 직접 시드(트리거는 BEFORE UPDATE 라 INSERT 무관), 0044 전이 자체는 scenarios/migration-0044-old-rows-retirement.test.ts 가 '0044 미만 전 마이그 + 0044 원문 적용' 체인으로 별도 재현(:28-29) — 커버 공백 없음

N/A:

- Ontology Lock: 신규 노드/엣지 ID 생성 0 (본 변경 = 코드 삭제 + status 필터 의존 전환)
- truth_weight 정렬: RAG/검색 정렬 코드 무접촉 (study 서빙 ORDER BY 는 진도 가중치이지 truth_weight 아님)
- IndexedDB↔D1 동기화: 클라이언트/sw.js 무접촉
- i18n: 신규 사용자 노출 문자열 0 (API error 코드 상수만, 한국어는 코드 주석 한정)

반론 (Devil's Advocate): 적용·게이트 실행이 동일 세션 터미널에서 이미 수행됐고 영속만 커밋 대기 중일 수 있다(오케스트레이터가 G-OLD-8 4-Pass 후 일괄 영속 예정) — 그 경우 게이트 리포트 발견은 '커밋 번들에 동봉 확인' 체크로 축소된다. 반대로 만약 향후 다른 환경(신규 staging 재생성 등)에 D1 마이그 없이 이 Worker 코드가 먼저 배포되면 old 행 클래스가 무가드 서빙된다 — 배포 순서 결합이 코드가 아닌 운영 절차에만 존재한다 (→ MINOR-3, MINOR-4).

### Pass 3 (Advocate): ✅ 14건 확인 / 🔴 0건 / 🟠 0건 / MINOR 2건 / N/A 3건

확인 (증거):

1. PASS — 보안(인증 경계): apps/api/src/study/routes.ts:801-805 requireAuth 전 라우트 미들웨어 불변, 테스트 routes.test.ts:325-331·538-548 미인증 401 계약 유지
2. PASS — 보안(rate-limit): routes.ts:1031-1042 /grade 20/min enumeration oracle 차단 + :766-796 study-read 60/min 그룹 분리 — 가드 폐기 diff가 미접촉, 테스트 :709-731·1037-1075 존속
3. PASS — 보안(입력 검증): routes.ts:156-168 gradeSchema(zod, userAnswer max 2000)·:108-122 requireExamId·:124 examTypeSchema·:833-840 count 정수 범위 — 전부 불변. /next 신규 단순 쿼리(:931-947)는 subjectClause 상수 문자열 + bind 파라미터화(:919-923)로 injection 표면 0
4. PASS — 보안(API키/XSS): routes.ts·public/routes.ts·public-learning-contract.ts 전문 — 하드코딩 시크릿 0(JWT_SECRET env 주입, public/routes.ts:53-54), innerHTML 사용 0(서버 코드), QuestionCard.tsx 확인 범위 innerHTML 0
5. PASS — 정답 안전(사전 비노출): routes.ts:354-355 choices에 정답 라벨 비노출 + :390-391 correctLabel 채점 후만 + public-learning-contract.ts:27·37 answer/explanation 서빙 비노출 계약 — diff 미접촉 불변
6. PASS — 정답 안전(채점 계약 불변): routes.test.ts:2229-2247 1차 -MC 행 MC 채점 200 + 2차 fill_blank 텍스트 정답 채점 불변 계약 테스트 실재. :502-525 G-WS1 결합 테스트(셔플→채점 전단사) 존속
7. PASS — 정답 안전(오답 36 차단 경로): routes.test.ts:2216-2227 deprecated 채점 404 + :2194-2206 G-OLD-7 /next 자연 배제(서빙 전부 -MC) + migrations/0044:30-41 전이 술어가 old 행 정의와 1:1 — 데이터 정본 차단 기계화 확인
8. PASS — 상태 표현(빈 데이터 정직성): routes.test.ts:2208-2214 active 0건 시 exhausted:true 정직 응답(무필터 폴백·재조회 부활 없음), routes.ts:965-971 exhausted 경로 확인
9. PASS — 잔존 참조 0: grep 전 코드베이스(apps/packages/scripts) isMisgradableRow·serving-guard = 0건, git status D serving-guard.ts + diff 3파일 33+/159− 스코프 요약과 일치
10. PASS — 공개 표면 백스톱 존속: public/routes.ts:164-175 isServable + :60-61 FIXED_EXAM_TYPE/FIXED_STATUS 서버 고정 + public/**tests**/routes.test.ts:297-308 MC-in-disguise 422 QUESTION_NOT_GRADABLE 테스트 존속 — 의도적 존속 주장 실코드 확증
11. PASS — telemetry 정합: apps/api/src/scheduled/silent-failure-monitor.ts:26-29 추적 이벤트는 streak_silent_failure·weak_delta_silent_failure 2종뿐, 폐기된 oversample warn 로그와 결합 0(모니터 stale 없음)
12. PASS — eval 동치 계약: routes.ts:522-529 enrichRelatedNodes drift 방어 주석 존속 + 본 diff는 파싱 술어 미개정 → eval/multihop-accuracy.ts parseRelatedNodes(:51) 동치 의무 비발동
13. PASS — 롤백 런북 안전 서사: 0044_rollback.sql:9-12 G-OLD-8 이후 롤백 금지 + 유일 안전 경로(재적용 또는 가드 revert 선행) 명문화, routes.ts:927-928 재도입 조건 주석과 상호 정합
14. PASS — 사용자 격리: routes.test.ts:733-751·817-844·2150-2163 /grade progress·weak 집계·weakTop 전부 user 격리 테스트 존속(diff 무회귀)

N/A:

- 오프라인/Service Worker: 본 diff는 서버 라우트·마이그·테스트만 — SW 캐싱 전략 변경 0 (sw.js 미접촉, IDB↔D1 동기화 stub은 기지 RC-3 별건)
- 접근성(터치 44px/aria): 본 diff에 UI 컴포넌트 변경 0 — QuestionCard.tsx는 연관 열람만(에러 UX 판정용), 마크업 변경 없음
- 산식/Formula Engine: diff에 계산 경로 접촉 0 — gradeCalc는 packages/learning-modes 기존 경로(routes.ts:706-716 불변)

반론 (Devil's Advocate): 0044는 1회성 마이그이고 적용 시점에 라이브 인증 사용자 0(plan §8 실측 — test 계정뿐)이라 deprecated 전이 크로스 시점의 404 기술 에러 노출 창에 실제 사용자가 걸릴 확률은 사실상 0에 가깝다. **재반론**: deprecated 전이는 이제 상태머신으로 정착됐으므로(향후 개정·교체마다 재사용) 창은 반복 발생한다 — 1회성 논리로 기각하면 다음 전이 때 되살아난다 (→ MINOR-6). 또한 신규 적재가 misgradable 행을 active로 재유입하면 인증 표면은 무음 오채점 클래스가 재발한다 — 백스톱 부활이 아니라 주석 경계 보강이 적정 처분 (→ MINOR-5).

### Pass 4 (Contract): ✅ 14건 확인 / 🔴 0건 / 🟠 1건 / MINOR 2건 / N/A 3건

확인 (증거):

1. PASS — apps/api/src/study/routes.ts:929-947 /next 오버샘플(×3)·전 풀 재조회 폐기 후 status='active' 필터 단일 쿼리 LIMIT 복원 = plan §2-3('가드 없이 자연 배제·D-02 발동 0') 정합
2. PASS — apps/api/src/study/routes.ts:925-928 재도입 조건(0044 롤백) 주석이 런북 실파일(docs/runbooks/migration-rollback/0044_rollback.sql)과 정확 매칭, 롤백 런북 :9-12 에 'G-OLD-8 이후 롤백 금지' 분기 실재(상호 참조 정합)
3. PASS — apps/api/src/study/routes.ts:1099-1101,1118-1119 /grade C-1 422 가드 제거 후 status='active' lookup 이 deprecated 를 404 로 자연 차단(주석-구현-테스트 3중 일치)
4. PASS — serving-guard.ts 삭제 확인(Read = 파일 부재) + 전 코드베이스 grep serving-guard/isMisgradableRow/MISGRADABLE/oversample = 잔존 참조 0 (스코프 요약 주장 재검증)
5. PASS — migrations/0044:44-66 ↔ migrations/0038:42-64 diff = byte-동일 + docs/runbooks/migration-rollback/0044_rollback.sql:28-50 도 byte-동일 — '정책 불변(ADR-046 default-deny)' 주장 기계 검증
6. PASS — production 라이브 실측(wrangler d1 execute --remote, SELECT-only 2회): 1st active 521 / deprecated 525 / active 비-MC 0 / superseded_by 521 전부 active -MC 짝(끊김 0) / NULL 4 — plan §2 목표 상태·워터마크(525/521/4)와 정확 일치 = G-OLD-8 선행 '마이그 적용 확인' 충족
7. PASS — apps/api/src/study/**tests**/routes.test.ts:2166-2248 0044 이후 계약 테스트 4건(G-OLD-7 자연 배제 = 서빙 전부 -MC / 정직 exhausted / deprecated 채점 404 / 1차 MC·2차 fill_blank 채점 계약 불변) 실재 + vitest 실행 101/101 PASS
8. PASS — apps/api/src/**tests**/scenarios/migration-0044-old-rows-retirement.test.ts:10-11,63-64 0044 전이 자체는 별도 시나리오 테스트가 '전 마이그(0044 제외) 적용 → 시드 → 0044 원문 적용' 으로 유일 재현(routes.test.ts 시드 재현과 역할 분담 정합)
9. PASS — Hard Rule 16/17: routes.ts:811,1020 requireExamId 시그니처 유지 + EXAM_IDS 경유(routes.test.ts:271 withExamId), 'son-hae-pyeong-ga-sa' 리터럴 신규 0
10. PASS — Hard Limit: knowledge_nodes/formulas UPDATE 0 (0044 는 exam_questions 한정 + L3 plan §9 Q1~Q5 진산 결재 ☑ 2026-07-12), LLM 수식계산·동적 실행·신규 TODO/stub/빈 catch 도입 0 (routes.ts:757-762 catch 는 주석+폴백 보유 선재 패턴)
11. PASS — packages/shared/src/public-learning-contract.ts:1-19 + apps/api/src/public/routes.ts:164-175 공개 표면 isServable 은 shared 계약 정본 소비로 의도적 존속(스코프 요약 '잔여 위험 백스톱' 주장과 일치), git status 상 public 3파일 무변경
12. PASS — apps/api/src/scheduled/silent-failure-monitor.ts:26-29 추적 이벤트 = streak_silent_failure/weak_delta_silent_failure 한정, 폐기된 'next oversample window exhausted' warn 로그 참조 0 = telemetry 정합 유지
13. PASS — apps/api/src/eval/multihop-accuracy.ts:51-66 ↔ routes.ts:530-548 parseRelatedNodes/enrichRelatedNodes 파싱 술어(JSON.parse·Array 검사·string+length 필터) 동치 유지, 본 변경 무접촉(G-6a-2 동반 갱신 의무 미발동)
14. PASS — apps/api/src/index.ts:175-176 createStudyRoutes 유일 런타임 마운트(/api/study) + /api/public 분리 마운트 불변(가드 폐기가 라우팅 표면 미변경)

N/A:

- 수치/임계값 constants ↔ 교재 원문: 본 변경에 constants/산식 수치 변경 0 (0044 워터마크 525/521/36/4 는 production 실측 대조로 PASS 처리)
- BATCH 순서: 콘텐츠 적재 아님(상태 전이 마이그·가드 폐기)
- 노드 ID 네이밍(CONCEPT-001/F-01/INS-01): 신규 노드·엣지 ID 생성 0

반론 (Devil's Advocate): task 원장이 in_progress 이므로 게이트 리포트 영속은 가드 폐기 커밋 직전·직후 단계로 예정돼 있을 수 있고, 게이트 자체는 이미 실행됐으나 출력이 세션 로그에만 남았을 가능성이 있다. **재반론(적대 검증 결과)**: verify-old-rows-retirement.mjs 는 writeFile 0 · stdout+exit code 전용 → 실행됐어도 세션 로그에만 잔존 = plan §4:67 영속 의무 미충족이며, git status 실측 = 가드 폐기 커밋이 지금 조립 중 — '시기상조' 반증 기각, MAJOR-1 CONFIRMED (→ 아래).

---

## 확정 발견 상세 (적대적 반증 통과분)

### 🟠 MAJOR-1 [Contract] — G-OLD-4~7 게이트 리포트 미영속: §9 Q5 감사 갈음 조건(plan+마이그+게이트 리포트 영속) 미충족 상태에서 가드 폐기 단계 진입

- **파일**: `docs/plans/old-rows-retirement-0044.plan.md:67, 80, 109`
- **내용**: plan §4 비채택 기록은 status_transitions 감사행 확장을 비채택하는 대신 '감사는 본 plan+마이그 파일+G-OLD 리포트 영속으로 갈음(§9 Q5)'을 조건으로 결재받았고, §5 G-OLD-8 은 '마이그 적용 확인 후에만' 가드 폐기를 허용한다. 리포에 G-OLD pre/post 게이트 리포트 산출물이 없다(docs/audit·.claude/reports·.jjokjipge grep '0044/G-OLD' = 런북·plan·마이그 파일뿐). 본 리뷰가 production SELECT-only 라이브 재검산으로 데이터 무결(active 521·비-MC 0·링크 끊김 0·NULL 4)은 독립 확증했으므로 실위험은 0이나, 결재의 감사 대체물 자체가 부재한 채 G-OLD-8 커밋이 완성되면 유일한 영속 감사 증거가 남지 않는다.
- **확인 증거**:
  - docs/plans/old-rows-retirement-0044.plan.md:67 — '감사는 본 plan+마이그 파일+G-OLD 리포트 영속으로 갈음(§9 Q5)'
  - grep -rln 'G-OLD-4|G-OLD-5|0044' docs/audit .claude/reports .jjokjipge = 히트 0 (리포트 파일 부재)
  - 라이브 재검산(wrangler d1 execute --remote SELECT-only): 1st status active 521/deprecated 525 · active 비-MC 0 · superseded_by 521 전부 active 짝(broken 0) · NULL 4 — plan §2 목표 상태 정확 일치 = '마이그 적용 확인' 사실 충족
  - scripts/verify-old-rows-retirement.mjs:1-13 — pre/post 게이트 스크립트 실재(실행·영속만 미완)
- **적대적 반증 판정 (CONFIRMED, severity keep)**: (1) plan 인용 3곳(67/80/109) 전부 정확. (2) 리포트 부재 = 레포 전역(untracked 포함) grep 히트가 plan 본문 + 선작성 번들 4-Pass 리뷰뿐. (3) '스크립트가 자동 영속' 기각: verify-old-rows-retirement.mjs 는 writeFile 0, stdout+exit code 전용. (4) 'G-OLD-8 미진입이라 시기상조' 기각: git status 실측 = serving-guard.ts 삭제 + study 2파일 수정(미커밋) = 가드 폐기 커밋이 지금 조립 중. (5) 강화: 기존 4-Pass MAJOR-3(CONFIRMED)이 스크립트에 G-OLD-6·7 러너 부재를 확정 — 리포트 영속은 커밋의 우연한 부산물로 성립 불가, 의도적 실행·영속 필요. 데이터 실위험 0(라이브 재검산 무결)이나 본질은 L3 결재(Q5) 감사 대체물 의무 위반으로 데이터 상태와 독립. 수리 저비용·완전 가역(post 게이트 SELECT-only = CRITICAL 아님)이되 G-OLD-8 완료 선언을 정당하게 차단(= MINOR 아님) → MAJOR 유지.
- **처분 권고**: `scripts/verify-old-rows-retirement.mjs post --env production` 실행 출력을 docs/audit/ (또는 .claude/reports/) 에 리포트 파일로 영속하고 G-OLD-8 커밋에 동봉(또는 커밋 메시지에 리포트 경로 참조) 후 완료 선언.

### 🟡 MINOR-1 [Surgeon] — 인증 /grade 재도입 조건 주석이 '0044 롤백'만 명시, 동일 결함 클래스의 신규 적재 경로에 인증 표면 코드 백스톱 0 (공개 표면과 비대칭)

- **파일**: `apps/api/src/study/routes.ts:925-928, 1118-1119`
- **내용**: 가드 폐기 후 인증 표면의 유일 방어선 = status='active' 데이터 상태. 주석은 재도입 조건을 '0044 롤백' 단일 경로로 명시하나, 향후 적재(BATCH/수동)가 exam_type='1st' + input_type='fill_blank' + 위치라벨 answer 행을 status='active' 로 넣으면 gradeAnswerByType 의 fill_blank 경로(routes.ts:697-698)가 위치라벨 문자열('2')을 정답 기준으로 gradeFillBlank 비교 → 로그 한 줄 없는 무음 오채점(정답 100% Hard Stop 위반 클래스). 공개 표면은 동일 시나리오를 isServable 서빙 제외(public/routes.ts:164-175) + 채점 422 거부(:455-471)로 기계 차단 — 의도적 비대칭(plan G-OLD-8 결재 사항)이나 주석이 그 잔여 위험 경계를 과소 기술. production 라이브 검산: 현재 active 1st 행 521 = 전부 -MC (현시점 위험 실재 0 — 위험은 장래 적재 시나리오 한정).
- **처분 권고**: routes.ts:927-928 주석에 '재도입 조건 = 0044 롤백 또는 동일 클래스(1st fill_blank 위치라벨 answer) 행의 신규 active 적재' 추가 + 적재 게이트(answer-integrity/G-GAP 류)에 해당 술어의 신규 행 검사를 carry-over 등재.

### 🟡 MINOR-2 [Surgeon] — staging 데이터 드리프트로 G-OLD-8 이후 서빙 경로의 staging 리허설 무의미 (1st active 0행, -MC 미적재)

- **파일**: N/A (환경 데이터 상태)
- **내용**: staging D1 라이브 검산 = exam_type='1st' deprecated 450 / active 0 (-MC 521 미적재, old 도 525 아닌 450 = production 과 분모 자체 상이). 본 커밋 핵심 경로(active 필터 단일 쿼리가 -MC 만 서빙)는 staging 에서 후보 0 → 항상 exhausted/NO_QUESTION 이라 실데이터 검증이 production 직행. 코드 결함 아님(공핍 시 정직 exhausted 로 안전) + 로컬 테스트(routes.test.ts:2194-2207)가 시나리오 커버(보상 통제)하나, 직전 4-Pass MAJOR-1(staging 게이트 항진식)과 동근의 리허설 공백.
- **처분 권고**: staging -MC 동기화를 후속 원장에 기록.

### 🟡 MINOR-3 [Architect] — G-OLD-8 선행 게이트(0044 production/staging 적용 + G-OLD-4~7) 증거가 레포에 미영속, 코드 주석은 적용을 기정사실로 서술

- **파일**: `apps/api/src/study/routes.ts:925-928`
- **내용**: plan §5 G-OLD-8 은 가드 폐기 커밋을 '마이그 적용 확인 후에만' 허용, §9 실행 순서 = production 적용 → G-OLD-4~7 → 가드 폐기 커밋 → incident 원장·CLAUDE.md 동기. 레포 내 0044 production 적용·G-OLD-4~7 post PASS 리포트 미영속. 본 리뷰가 라이브 SELECT-only 실측으로 선행조건 성립을 직접 확증(production deprecated=525·active old 0·active 1st 521·NULL 4 / staging d1_migrations 0044=1·active old 0) — 코드 자체는 안전. 다만 산출물 영속 의무 관점에서 post PASS 출력 영속 + incident 원장·CLAUDE.md 동기가 본 커밋과 함께 닫혀야 함 (MAJOR-1 과 동근 — 게이트 리포트 영속 시 함께 해소).
- **처분 권고**: verify-old-rows-retirement.mjs post --env production/staging PASS 출력 영속 + incident 원장·CLAUDE.md '현재 상태' 동기(plan §9 마지막 단계 이행).

### 🟡 MINOR-4 [Architect] — 재도입 조건 주석의 신규 적재 재유입 경로 누락 (인증 표면 구조 백스톱 부재 비대칭의 표식 결손)

- **파일**: `apps/api/src/study/routes.ts:925-928, 1118-1119`
- **내용**: 제거된 isMisgradableRow 는 '525행'이 아니라 '데이터 클래스'(fill_blank + 위치라벨 answer + 보기 계약 불능)를 방어했다. exam_questions.status DEFAULT 'active'(0001:128)이므로 향후 1차 재적재·타 회차 보강 적재가 -MC 규율 없이 위치라벨 answer 행을 넣으면 인증 /next 즉시 서빙 + /grade gradeFillBlank fallback(routes.ts:682) 무음 오채점 클래스 재발. 공개 표면 isServable(:164,:254,:328) 존속과 비대칭. plan §7 이 RC-2(servable 물질화 컬럼)를 별도 카드로 명시 이월했으므로 설계 위반 아님(Silent Pivot 아님) — 주석의 재도입 조건이 단일 경로 서술이라 후임 세션 망각 위험 표식 결손. (무분별한 구조 판정 재도입은 2차 텍스트·수치 정답 오차단으로 계약 테스트 37건 파손 실측(ledger :81) — 정본 해소는 RC-2.)
- **처분 권고**: routes.ts:928 주석 1줄 보강 — 재도입 조건에 '신규 1차 적재 시 G-OLD-1류 answer-계약 게이트 의무 + RC-2 servable 물질화 카드 포인터' 추가 (코드 변경 0).

### 🟡 MINOR-5 [Advocate] — 인증 표면 백스톱 비대칭: 미래 적재 회귀 시 무음 오채점 재발 경로 (기결 결정의 잔여 위험 관측)

- **파일**: `apps/api/src/study/routes.ts:1118-1119`
- **내용**: 공개 표면 isServable(public/routes.ts:164-175)은 MC-in-disguise 행을 서빙·채점 양쪽 기계 차단하는 백스톱 존속, 인증 /next·/grade 는 순수 status='active' 필터만(routes.ts:940, 1100 — 추가 자격 판정 0). 0044 롤백 없이도 가능한 제3 경로(미래 BATCH 적재·데이터 수리의 misgradable 행 active 재유입) 발생 시 인증 표면 fill_blank 폴백 채점(routes.ts:697-698)이 위치라벨 정답과 텍스트 답안 대조 = 사실상 전건 오답 처리 무음 오채점 재발. 완화 = G-OLD-1 answer-integrity 36/36 pre/post 동일 실행(plan :73) + Hard Limit draft-only 프로세스.
- **처분 권고**: routes.ts:925-928 주석 재도입 조건에 '0044 롤백 또는 misgradable 행 신규 적재 발견' 병기 + 적재 게이트(quality) 측 fill_blank×위치라벨 answer 조합 거부 체크 존재 여부 별건 확인 카드.

### 🟡 MINOR-6 [Advocate] — 웹 에러 UX: deprecated 전이 문항 채점 404가 '채점 실패 (HTTP 404)' 기술 에러로 노출 (Graceful 안내 부재)

- **파일**: `apps/web/src/components/QuestionCard.tsx:157-160`
- **내용**: 가드 폐기로 old 행 채점 거부가 422(전용 코드) → 404 QUESTION_NOT_FOUND 로 바뀌었는데, 인증 웹 QuestionCard /grade 핸들러는 401/429/422 만 전용 문구(:136-160), 404 는 `채점 실패 (HTTP ${res.status})` 원시 노출. 발생 창 = 문항이 서빙된 채 열려있는 동안 deprecated 전이가 적용되는 크로스 시점 한정(빈도 극소)이나, deprecated 전이는 상태머신으로 정착돼 향후 개정·교체마다 창이 반복 발생. 공개 표면은 동일 코드에 Graceful 문구 보유(public/api.ts:25) — 인증 표면만 공백.
- **처분 권고**: QuestionCard /grade 404 분기 추가: '이 문제는 교체(개정)되었습니다. 다음 문제로 넘어가 주세요.' + 다음 문제 버튼 유도(공개 표면 톤 정합).

### 🟡 MINOR-7 [Contract] — 테스트 헬퍼 status 파라미터 타입에 CHECK 제약 밖 유령 값 'historical' (선재)

- **파일**: `apps/api/src/study/__tests__/routes.test.ts:119`
- **내용**: seedExamQuestion 의 `status?: 'active' | 'historical'` — exam_questions.status CHECK 는 ('active','deprecated','flagged')(0001:128, plan §1 :15)로 'historical' 은 부재 값. 사용처 0건(grep = 타입 선언 1건뿐)이라 무해하나 0044 이후 상태머신 정착 시점에 헬퍼 타입이 실제 상태 집합과 어긋난 채 잔존 = 후속 테스트 작성자 오도 가능(사용 시 CHECK 즉시 실패로 무음 아님).
- **처분 권고**: 타입을 `'active' | 'deprecated' | 'flagged'` 로 정정 (G-OLD 계약 테스트는 이미 raw INSERT 로 deprecated 주입 중 — 헬퍼 확장 여지).

### 🟡 MINOR-8 [Contract, 적대 반증에서 MAJOR→MINOR 하향] — G-OLD-8 명세 항목 'D-18 동치 불변식 주석 복원 + 관련 테스트 개정' 부분 미이행 (명세 추적성 갭)

- **파일**: (부재가 결함 — plan §5:80, §7:90 대비)
- **내용**: plan §5 G-OLD-8 스코프는 'D-18 동치 불변식 주석 복원 + 관련 테스트 개정'을 명시하고 §7 동승 처분도 재확인하나, 본 변경셋은 study 3파일만 접촉 + 전 소스 grep 'D-18' = 0건. **적대 반증 판정 (severity downgrade)**: 발견의 사실 핵은 생존(주석 라벨 복원 반쪽이 문면 어디에도 흔적 없이 누락 = 실측 사실)하되 2가지 정정 — (1) 지목 위치(public/routes.ts)는 오귀속: D-18 원 앵커 = study/routes.ts:1653-1674 통계·categoryAvailable 구간(5-페르소나 INDEX:74), 공개 표면 문구는 파생 표현. (2) 기능적 불변식 자체는 이미 복원·기계검증 — 가드 폐기로 /next·/grade·통계가 전부 동일 status='active' 술어 공유(발산 클래스 구조 소멸), 신규 G-OLD-7·8 테스트 4건이 deprecated 자연 배제 검증('관련 테스트 개정' 실질 이행), 기존 G1 테스트(routes.test.ts:1550)가 풀==available 동치 상시 감시. 런타임 결함 0, 잔여 = 명세 추적성(주석 라벨 + 통계 분모 deprecated 시드 테스트 1건) 갭.
- **처분 권고**: study/routes.ts 통계 섹션 주석에 D-18 복원 명문화(+선택적으로 public 헤더 1줄) + deprecated 행 시드 통계 분모 배제 테스트 1건 추가 후 G-OLD-8 완료 선언.

---

## 판정

**판정: 완료 가능** (CRITICAL 0건)

- CRITICAL 0 / MAJOR 1 / MINOR 8 (전건 적대적 반증 통과분).
- 단서: **MAJOR-1(G-OLD-4~7 게이트 리포트 미영속)은 G-OLD-8 "완료 선언" 전 즉시 처분 대상** — 코드 결함 아님(데이터 무결은 본 리뷰 라이브 재검산으로 독립 확증), 처분 = `verify-old-rows-retirement.mjs post` PASS 출력 영속 + 커밋 동봉(저비용·완전 가역·SELECT-only). MINOR-3(동근)·MINOR-8(D-18 주석 라벨)도 동일 마감 커밋에서 함께 닫는 것을 권고.
- 코드 정합성: 변경 3파일 + 연관 9파일 전수, api 785 PASS / typecheck·lint 무오류 / production·staging 라이브 SELECT-only 검산 = plan §2 목표 상태 정확 일치.

────────────────────────────────────
