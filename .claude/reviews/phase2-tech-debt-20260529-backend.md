# 기술부채 리뷰 — backend-architect

- 리뷰 시점: 2026-05-29
- 리뷰 대상 범위:
  - `migrations/0001` ~ `migrations/0037` (전 37파일 실독, 빈 슬롯 `0020` 확인)
  - `apps/api/src/db/schema.ts` (Drizzle 14+테이블 선언)
  - `apps/api/src/search/{approved-nodes-sql,user-search,graph-search-route,routes}.ts`
  - `apps/api/src/search/graph-walk/index.ts`
  - `apps/api/src/search/multi-path-fallback/keyword-fallback.ts`
  - `apps/api/src/vectorize/{upserter.ts,routes.ts}` (Vectorize 메타데이터 / 백오피스 부트스트랩)
  - `apps/api/src/progress/routes.ts` / `apps/api/src/study/routes.ts` / `apps/api/src/auth/routes.ts`
  - `apps/batch/src/loader/{draft-loader,state-machine}.ts`
  - `packages/parser/src/ontology-registry.{json,ts}`
  - `packages/shared/src/{exam-adapter,types}.ts`
- production 데이터 가정: knowledge_nodes 794 / edges 1274 (전부 is_active=1) /
  formulas 157 / constants 193 / exam_questions 545 (related_nodes 545/545 NULL → G-S5 차단)
- 본 리뷰의 독점 스코프 준수: 쿼리 latency / 테스트 부재 / 코드 품질 any /
  마이그레이션 배포 순서는 다른 페르소나 영역으로 다루지 않음 — _스키마 설계가
  N+1을 강제_ / _스키마 회귀 검증 메커니즘 부재_ 측면만 포함.

---

## CRITICAL (Year 2 진입 직전 폭발 위험) — 7건

### C-1. 노드 ID 패턴이 3자리(`\d{3}`)로 잠겨 있어 1개 시험 코퍼스 천장이 999

- 파일: `packages/parser/src/ontology-registry.json:37-47`
  ```
  "LAW": "^LAW-\\d{3}$",          "INVESTIGATION": "^INV-\\d{3}$",
  "INSURANCE": "^INS-\\d{2}$",    "CROP": "^CROP-\\d{3}$",
  "CONCEPT": "^CONCEPT-\\d{3}$",  "TERM": "^TERM-\\d{3}$",
  "TABLE": "^TBL-\\d{3}$",        "ROW_HEADER": "^TROW-\\d{3}-\\d{2}$",
  "COL_HEADER": "^TCOL-\\d{3}-\\d{2}$", "CELL": "^TCELL-\\d{3}-\\d{2}-\\d{2}$"
  ```

  - `migrations/0021_table_as_micro_kg.sql:71,85-87,102` (D1 `CHECK (id GLOB
'TBL-[0-9][0-9][0-9]')` 등) 으로 **DB 레벨에서도 잠금**.
- 부채 모델: 현 손해평가사 active corpus 만으로 CONCEPT-001 ~ CONCEPT-N
  같은 시퀀스가 진행 중. 매년 교재 개정 시 Temporal Graph 패턴(Hard Limit:
  UPDATE 금지) 으로 **신규 노드 + SUPERSEDES**, 즉 ID 는 절대 재사용 불가 →
  같은 개념의 매년 새 ID 가 누적된다. CONCEPT 만 봐도 794 / 7 = ~113 노드/도메인,
  매년 ~5% 개정 가정 시 5년이면 한 도메인 1.2배 → 운영 가능. 그러나 Year 2
  멀티시험 (전기기사·소방·공인중개사) 진입 시 **단일 ID 공간**(N자리)을 모두가
  공유하면 999 즉시 돌파 (특히 LAW: 공인중개사 민법 조문 단독 수천 건).
- Year 2 / 매년 개정 시나리오:
  1. Year 2 공인중개사 LAW 노드 적재 첫 BATCH 에서 LAW-1000 발생 → ontology
     `isValidNodeId` 가 false → `validateKnowledgeContract` 차단 (Ontology Lock)
     → 적재 자체 거부 → 신규 시험 진입 즉시 멈춤.
  2. table_structures 의 GLOB `TBL-[0-9][0-9][0-9]` 는 D1 CHECK 라 ALTER 불가 →
     **테이블 재생성 마이그레이션** 필요. SQLite ALTER TABLE 에서 CHECK 변경 불가.
  3. Temporal Graph 의 SUPERSEDES 가 정상 운영 중이면 매년 자연 누적 → 손해평가
     단독으로도 5~8년 안에 cap 도달.
- 데이터 무결성 위협 경로: `packages/parser/src/ontology-registry.ts:82-85`
  `isValidNodeId` 가 false 인 노드는 `validateKnowledgeContract` (Engine
  Constraint) 에서 차단 → AI 가 생성한 신규 ID 가 통째로 폐기 → BATCH 적재 0건
  → "근거 부재" 학습자 검색 실패 → 시뮬레이션 안 한 환각.
- 권장 조치 (Year 2 진입 전 필수):
  1. 패턴을 시험 prefix + 가변 자리수로 재설계: `^SHPGS-LAW-\d{4,6}$` (시험별
     namespace 격리) 또는 최소 `\d{3,6}` 가변 허용. SHPGS = son-hae-pyeong-ga-sa.
  2. 마이그레이션 신설: `migrations/00XX_id_pattern_v2.sql` — table_structures /
     table_headers / table_cells CHECK GLOB **테이블 재생성 후 데이터 복사**
     (SQLite CHECK 변경의 유일 경로). knowledge_nodes 는 D1 CHECK 없음 ID 패턴은
     `ontology-registry.ts` 런타임 검증만이라 JSON 변경 + Year 2 전환 ADR 신설.
  3. `inferNodeTypeFromId` (`ontology-registry.ts:103-108`) 가 모든 시험의 모든
     prefix 를 거치도록 변경 + 시험 prefix 충돌 검사 추가.
- 우선순위 근거: ID 패턴은 마이그레이션·코드·Vectorize·검색·BATCH 적재 전체에
  걸쳐 있어, Year 2 D-day 에 "999 천장 발견" 시 1~2주 stop-the-world 작업. ADR-007
  zero-cost 전환 의무에 직접 위반.

---

### C-2. Drizzle ↔ D1 shape drift — 0029/0033/0037 인덱스가 `schema.ts` 에 미반영

- 파일: `apps/api/src/db/schema.ts:370-396` (userProgress 선언) vs
  `migrations/0029_user_progress_unique_constraint.sql:47-54` (partial UNIQUE
  `uniq_progress_user_card`, `uniq_progress_user_node_concept`) 및
  `migrations/0033_user_progress_fsrs_extension.sql:30-36` (`idx_user_progress_weak`,
  `idx_user_progress_mastered`) 및 `migrations/0037_exam_questions_active_subject_index.sql`
  (`idx_exam_questions_active_subject`).
- 부채 모델: `schema.ts` 의 정책 주석(NC-1)이 "수동 SQL 이 진실원, Drizzle 은 타입
  파생 전용, **drizzle-kit generate/push 금지**" 라고 강제하면서도, 인덱스의
  타입-레벨 미러링이 누락되면 (a) Drizzle ORM 쿼리 빌더 쪽에서 인덱스 hint 가
  사라지고 (b) "drizzle 선언과 SQL 인덱스가 1:1 동기" 라는 NC-1 계약 자체가 깨진다
  (schema.ts 159-220 의 `bookPageIdx`, `chapterIdx` 와 0019 인덱스는 미러링되어
  있는데 0029/0033/0037 은 빠짐 — 일관성 drift).
  - `schema.ts` 의 userProgress 객체 정의 (line 370-396) 에는 `(table) => ({})`
    인덱스 콜백 자체가 부재 → drizzle-kit diff 도구를 누군가 잘못 활성화하면
    "schema.ts 에 없는 인덱스" 로 인식해 production DROP INDEX 위험.
- Year 2 / 매년 개정 시나리오:
  1. 신규 개발자가 drizzle-kit 정책을 모르고 `drizzle.config.ts` 추가 → diff →
     "extra index" drop migration 자동 생성 → review 시 무심코 머지 →
     production 인덱스 사라짐.
  2. Year 2 멀티시험 진입 시 user_progress 가 카드 수십만 → 인덱스 사라지면
     `idx_user_progress_weak` 손실 = 약점 정렬 풀스캔 → 학습 SLO 폭발 (별도
     페르소나 영역이지만 _부채 모델 = 스키마 진화 메커니즘 부재_ 가 핵심).
- 데이터 무결성 위협 경로:
  - `uniq_progress_user_card` 가 사라지면 동일 (user, card_id, card_type) 중복
    row 가 INSERT 됨 → /grade UPDATE 가 어느 row 를 갱신할지 비결정 → 정답률
    집계 왜곡 → FSRS 스케줄 오류.
- 권장 조치:
  1. `schema.ts` `userProgress` 정의에 `(table) => ({ uniqProgressUserCard:
uniqueIndex(...).where(sql`...`), idxUserProgressWeak: index(...), ... })`
     명시 추가 (NC-1 정합).
  2. `examQuestions` 에 `(table) => ({ idxActiveSubject: index(...).where(...) })`
     추가.
  3. CI gate 추가: `pnpm test:schema-drift` (수동 SQL grep 으로 모든 CREATE
     INDEX 이름이 schema.ts 에 등장하는지 검증, 1건 missing 시 fail).
- 우선순위 근거: NC-1 정책의 효용은 "1:1 동기" 라는 invariant 가 지켜질 때만 의미가
  있고, 현재 그 invariant 가 이미 깨진 채로 production 적용된 상태. 시간이 갈수록
  drift 누적 → 회수 비용 기하급수.

---

### C-3. status_transitions 무한 누적 + GC 정책 부재 = G-S5 측정 후 SLO 폭탄

- 파일: `migrations/0010_status_transitions_and_page_ref_guard.sql:25-46`
  (테이블 + 3 인덱스). UPDATE/DELETE 둘 다 `prevent_status_transitions_update/
delete` 트리거(`0010:49-59`) 가 ABORT. GC 마이그레이션 없음.
- 부채 모델: `approved-nodes-sql.ts:44-53` 의 status 도출 SQL 이 **status_transitions
  PARTITION BY target_id ROW_NUMBER OVER ORDER BY transitioned_at DESC** 를 모든
  Stage 2 / graph-walk approved CTE / keyword fallback 에서 호출한다.
  - 현 production: 488 approved 노드 × 평균 2.x 전이 (draft→review→approved) =
    1000~2000 row → OK.
  - Year 2 진입 + Year 3 매년 개정: 4 시험 × 5K 노드 × 3 전이 + 매년 개정
    SUPERSEDES 신규 노드 추가 전이 → 10년 후 100K~1M row.
  - PARTITION BY 윈도우 함수는 매번 **전체 status_transitions 스캔** (LEFT JOIN
    subquery). 인덱스 `idx_status_transitions_target` 가 (target_type,
    target_id, transitioned_at) 인 점은 도움이 되지만, ROW_NUMBER 가 모든 row
    를 정렬해야 한다는 본질은 변함 없음 → **선형 증가하는 D1 CPU 비용**.
- Year 2 / 매년 개정 시나리오:
  1. status_transitions 100K row 시점에서 모든 검색 1회당 status 도출 CTE 가
     ms 단위로 늘어남 → CPU 50ms 한도 도달.
  2. UPDATE/DELETE 가 트리거로 차단되어 있어 **GC 가 운영 정책으로 불가능** —
     0010 자체가 "append-only audit log" 라고 선언함. 이를 회수하려면 신규
     마이그레이션에서 `DROP TRIGGER prevent_status_transitions_delete` →
     아카이브 테이블로 이관 → 트리거 재설치 의 복잡한 절차 필요.
  3. 동일 패턴이 `review_decisions` (`0013_active_view_and_review_decisions.sql:168-178`),
     `engine_telemetry` (`0017_engine_telemetry.sql:111-123`) 에도 잠겨 있음 —
     **3개 테이블 모두 무한 append-only 잠금**. engine_telemetry 는 17번 주석에
     "Phase 2 retention 1년" 정책이 명시되지만 ADR 만 있고 Cron Trigger 코드
     없음. status_transitions 는 retention 정책 ADR 조차 없음.
- 데이터 무결성 위협 경로:
  - GC 도입 시 status 도출이 가장 최근 N개만 보고 작동 → 옛 비-approved 상태가
    "최신" 으로 잡히면 학습자에게 오답이 노출됨.
  - 운영자가 "옛 transitions 삭제하면 빠르다" 추정으로 SQL 직타하면 ABORT —
    위험은 0 이지만 **확장성도 0**.
- 권장 조치:
  1. 마이그레이션 신설: status_transitions 에 **(target_type, target_id) 별
     materialized "current_status" 테이블** 추가 (snapshot, INSERT-trigger 로
     자동 갱신). 검색 hot-path 는 snapshot 1회 JOIN 으로 변경, transitions 는
     audit 만.
  2. 또는 `approved-nodes-sql.ts` 가 윈도우 함수 대신 `IN (SELECT target_id
FROM current_status_view WHERE to_status='approved')` 단순 JOIN.
  3. retention 정책 ADR (status_transitions / review_decisions / engine_telemetry
     **3 테이블 공통**) + Cron Trigger 추가 + 트리거 일시 비활성 SQL fragment 동봉.
- 우선순위 근거: G-S5 측정 후 학습자 트래픽 진입 + Year 2 진입 동시 발생 시
  search hot-path latency 급증 → ADR-008 graceful 임계 800ms timeout 빈도 상승
  → "정상 학습자가 graceful 진입 (=Multi-Path Fallback 우회 경로)" 빈도 폭증.

---

### C-4. ★ 4-way 데이터 일관성 미보장 — knowledge_nodes ↔ Vectorize ↔ exam_questions.related_nodes ↔ table_node_links

- 파일:
  - Vectorize 메타데이터: `apps/api/src/vectorize/upserter.ts:64-76`
    (`is_active: boolean`), `routes.ts:329-379` (`is_current_active` 미반영,
    `is_active: true` 하드코딩).
  - exam_questions.related_nodes: `apps/api/src/db/schema.ts:331` (text JSON
    array, FK 없음) + `study/routes.ts:496-512` (이미 `is_current_active = 1`
    필터하지만 **status_transitions 미참조** → approved-nodes-sql.ts 단일
    진실원 회피).
  - table_node_links: `schema.ts:926-951` (FK 만 있고 SUPERSEDES 시 자동
    소거 트리거 없음).
- 부채 모델: Temporal Graph 가 **knowledge_nodes 한 곳만** 활성/비활성을 관리
  (`is_current_active` + `mav_supersedes_knowledge_nodes_deactivate` 트리거,
  `migrations/0013:101-108`). 그러나:
  1. **Vectorize** — 비활성 노드도 인덱스에 남아 있을 수 있고
     (`upserter.ts:224` `metadata: { ...node.metadata, exam_id: examId }`
     인자에서 `is_active` 가 caller 책임), `vectorize/routes.ts:374` 가
     `is_active: true` 를 무조건 넣음. SUPERSEDES 트리거가 발동하면 D1 은
     자동 갱신되지만 **Vectorize 에는 이벤트 전파 없음** → 검색 시 비활성 노드
     ID 가 Stage 1 후보로 떠오른 뒤 Stage 2 에서 탈락 (정답).
     그러나 vectorize 가 비활성 노드도 들고 있다는 사실은 다음을 유발:
     - Vectorize index 용량 (free 5M vectors) 도달 압박.
     - Year 2 멀티시험 진입 시 `exam_id` 필터를 거치고도 같은 시험 내 폐기
       노드가 후보로 떠오름 → multi-path-fallback 결과 안정성 저하.
  2. **exam_questions.related_nodes** — JSON string array, **FK 없음**. 노드가
     비활성화되어도 related_nodes JSON 에는 옛 ID 가 남는다. study 라우트는
     `is_current_active=1` 만 필터하므로 결과적으로는 안전하지만, golden 평가
     데이터로 사용 시(`apps/api/src/eval/multihop-accuracy.ts:51-66`) "노드는
     비활성인데 골든에 남음" → expected ∩ approved 가 줄어 정답률 인공
     하락 → G-S5 결과 왜곡.
  3. **table_node_links** — `schema.ts:926-951` 가 knowledge_nodes 와 FK 연결
     이지만 노드 SUPERSEDES 시 link 가 새 노드를 가리키도록 자동 마이그레이션
     하는 트리거 없음. 표 콘텐츠는 옛 노드를 영원히 참조.
- Year 2 / 매년 개정 시나리오:
  1. 매년 개정 BATCH → SUPERSEDES → 구 노드 `is_current_active=0`. Vectorize 는
     별도 batch reindex 가 돌지 않으면 그대로 → 1년 지나면 Vectorize
     "stale 비율" 30%+.
  2. G-S5 측정 직후 진산 결재 "재측정" 시 매번 exam_questions.related_nodes
     JSON 의 옛 ID 와 현 active 노드 mismatch → 점수 불안정.
  3. table_node_links 가 옛 노드를 가리키면 admin G5.5 검수 화면에서 "이 표는
     현재 비활성" 노드와 연결됨 → 검수자 혼선.
- 데이터 무결성 위협 경로:
  - exam_questions.related_nodes 무 FK = D1 referential 검증 0 = AI 생성 단계
    에서 typo ID 가 들어가도 INSERT 통과. 0035 streak 같은 신규 테이블도 동일.
  - Vectorize 비활성 잔존 = 검색 결과 candidate score 의 noise.
- 권장 조치:
  1. `mav_supersedes_knowledge_nodes_deactivate` 트리거 확장: SUPERSEDES INSERT
     시 (a) Vectorize 동기화 큐 테이블 `vectorize_sync_queue` 에 row 추가
     (Cron Trigger 가 처리), (b) exam_questions 의 related_nodes JSON 에서
     해당 ID 를 새 노드 ID 로 자동 치환 — 단, exam_questions 는 0004 trigger
     로 UPDATE 차단. 즉 관계 테이블 분리가 더 적절: 신규 `question_node_links`
     테이블 (question_id, node_id, FK) 도입 → JSON 필드 deprecate.
  2. table_node_links 동기화 트리거: SUPERSEDES INSERT 시 `UPDATE
table_node_links SET related_node_id=NEW.from_node WHERE related_node_id=NEW.to_node`.
     단, knowledge_edges INSERT 트리거에서 다른 테이블 UPDATE 는 가능하지만
     D1 트리거 cascade depth 확인 의무.
  3. **Year 2 진입 전** Vectorize 비활성 노드 일소 admin endpoint 마련.
- 우선순위 근거: 4-way sync 가 깨지면 G-S5 측정값이 시점마다 다르게 나오고
  ("이번 주 60% 다음 주 55%" 같은 측정자가 보기에 _측정 도구가 신뢰 못함_
  현상), 학습자 신뢰성 (북극성) 직접 침해.

---

### C-5. Vectorize bootstrap 에 `is_current_active=1` / `status_transitions` 필터 부재

- 파일: `apps/api/src/vectorize/routes.ts:333-348`
  ```ts
  const baseSelect = 'SELECT id, type, name, description, ... FROM knowledge_nodes';
  const sql =
    typeof status === 'string'
      ? `${baseSelect} WHERE status = ? ORDER BY id LIMIT ? OFFSET ?`
      : `${baseSelect} ORDER BY id LIMIT ? OFFSET ?`;
  ```

  - 메타데이터 빌드 `routes.ts:374` `is_active: true` 하드코딩 (parser
    comment: "Phase 2A PoC 단순화, carry-over").
- 부채 모델: bootstrap 라우트가 (a) `is_current_active=1` 미체크 → 폐기 노드도
  인덱스에 들어가고, (b) `status_transitions` 최신 상태 미참조 → INSERT-time
  snapshot 인 `knowledge_nodes.status` (항상 'draft', schema.ts:191-207 의
  @deprecated 주석) 로만 필터.
  - 현 production approved 488/794 인데 vectorize 가 어떻게 만들어졌는지에
    따라 (Phase 2A bootstrap 시점) 794 모두 들어가 있을 가능성. 이후 status
    전이된 488 만 Stage 2 통과 → 정답 OK, 그러나 Vectorize 페이로드는 794
    그대로.
- Year 2 / 매년 개정 시나리오:
  1. Vectorize free tier 5M vectors 한도 — 8개 시험 × 5K 노드 × 매년 개정 5%
     누적 = 10년 후 60만 vector. 1차 한도는 안전하나 paid tier 비용 + 인덱스
     latency 증가.
  2. `bootstrap` 라우트가 `status='approved'` 를 받지 않으면 (선택 인자)
     draft 도 통째로 upsert → 검수 중 콘텐츠가 vector 후보 → Stage 2 hard
     filter 가 마지막 방어선이라 정답엔 영향 없지만 후보 score 분포 왜곡.
  3. ADR-004 §3 "exam_id 필터 의무" 는 운영 중 — 그러나 `is_active` 필터를
     metadata level 에서 추가 적용하려면 metadata 가 정확해야 함.
- 데이터 무결성 위협 경로:
  - bootstrap 재실행 시 폐기된 노드까지 upsert → Vectorize 가 ID 단일 → 덮어쓰기
    되지만, 폐기 후 영원히 인덱스 잔존 (vectorize 는 자동 GC 없음).
- 권장 조치:
  1. `fetchKnowledgeNodesForVectorize` 에 (a) `is_current_active=1` 강제 (option
     아닌 default), (b) status 필터를 `approved-nodes-sql.ts` 단일 진실원으로
     통일 (status 컬럼 직접 비교 금지 — schema.ts 의 @deprecated 주석 정합).
  2. metadata `is_active: row.is_current_active === 1` 로 row-derived.
  3. Vectorize 에 `is_active: false` 노드 일소 admin endpoint (`/api/admin/
vectorize/purge-inactive`) + Cron 24h 1회.
- 우선순위 근거: schema.ts:191-207 가 "node.status 사용 금지, 항상 false" 라고
  명시했는데 routes.ts:335 가 그 컬럼을 그대로 사용 — **단일 진실원 정책의
  명시적 위반 코드 잔존**. 현재 운영 영향은 낮지만 다음 bootstrap (Year 2 진입,
  embedding 모델 교체 시 reindex) 에서 폭발.

---

### C-6. study/routes.ts 의 knowledge_nodes 직접 조회가 approved-nodes-sql 단일 진실원 우회

- 파일: `apps/api/src/study/routes.ts:496-516` (`enrichRelatedNodes`)
  ```ts
  SELECT id, name, type, page_ref, book_page
    FROM knowledge_nodes
   WHERE id IN (${placeholders})
     AND is_current_active = 1
  ```
- 부채 모델: 학습자에게 "출처 보기" 정보를 줄 때 `is_current_active=1` 만
  걸고 **status_transitions 의 최신 approved 검증을 생략**한다. 이는
  approved-nodes-sql.ts:44-53 단일 진실원의 **4번째 호출 측이 누락된 채로**
  존재한다는 뜻 (단일 진실원 정의에는 graph-walk / user-search Stage 2 /
  multi-path-fallback keyword / topic-cluster 4개만 명시; study 는 빠짐).
  - 결과: 한 노드가 admin G5.5 에서 flagged 되었어도 ("결함 발견 격리")
    `is_current_active=1` 이면 학습자 출처 화면에 노출됨 → 진산이
    `approved-nodes-sql.ts:22-26` 에 "flagged 노드의 결과/그래프 순회 편입은
    절대 불가" 라고 명시한 invariant 위반.
- Year 2 / 매년 개정 시나리오:
  1. 매년 개정 BATCH 후 검수에서 일부 노드가 `approved → flagged` (장애 발견)
     로 전이 → `is_current_active` 는 1 유지 (SUPERSEDES 트리거가 작동 안 함,
     flagged 는 status_transitions 만 갱신) → 학습자에게 노출 지속.
  2. Hard Limit "AI 생성 데이터 = draft" 정책 하에 review 단계 노드도 study
     route 가 노출 → 학습자가 "검토 중 자료" 를 정답 근거로 학습.
- 데이터 무결성 위협 경로:
  - 학습자가 결함 인지된 노드를 정답 근거로 학습 = 북극성(생성물 신뢰성·정확성)
    직접 위반.
- 권장 조치:
  1. `study/routes.ts:enrichRelatedNodes` 가 `approved-nodes-sql.ts` 의
     `buildApprovedNodesQuery` 를 import + 사용 (5번째 호출 측으로 등록).
  2. `approved-nodes-sql.ts` 의 module docstring 에 "5 호출 측" 으로 갱신,
     drift 0 invariant 유지.
- 우선순위 근거: schema.ts:191-207 + approved-nodes-sql.ts:14-22 의 단일 진실원
  계약이 **이미 위반된 코드가 production 에 배포** 되어 있음. CO-4 가 해소
  되었다고 선언된 상태(`graph-walk-s5-integration.plan.md` §1) 인데 실은 미해소.

---

### C-7. exam_questions UPDATE 차단으로 `related_nodes` backfill 불가 — golden BATCH 진행 자체가 막힘

- 파일: `migrations/0004_temporal_guard_extension.sql:39-43`
  ```sql
  CREATE TRIGGER IF NOT EXISTS prevent_exam_questions_update
  BEFORE UPDATE ON exam_questions
  BEGIN
    SELECT RAISE(ABORT, 'UPDATE on exam_questions is forbidden. Use INSERT + superseded_by + valid_until pattern.');
  END;
  ```

  - `schema.ts:319-345` exam_questions 가 `related_nodes` (text JSON) 컬럼 보유.
  - 현 production: 545/545 NULL.
- 부채 모델: G-S5 차단의 직접 원인 [project_g_s5_golden_data_gap]. golden 데이터를
  진산 결재 경로 A (LLM 생성 → 진산 검수) 로 채우려면 related_nodes 컬럼을
  채워야 하는데 **trigger 가 UPDATE 를 ABORT**. SUPERSEDES 패턴은 새 question
  row 를 INSERT 하면서 옛 row 를 `superseded_by` + `valid_until` 로 표시하는
  것 — 정답이 변하지 않는 단순 메타데이터 추가에 부적절 (질문 본문 = 영구 보존
  의무이므로 새 row 라는 개념 자체가 어울리지 않음, 진산 결재 [[project_multi_source_choice_basis_track]] Phase B/C 의 보기별/물음별 라벨
  트랙도 같은 벽).
  - Phase B 진입 시 보기별 라벨 컬럼을 추가하면 backfill 자체가 UPDATE 라서
    trigger 차단. 이는 진산 결재 carry-over (CLAUDE.md §6) 의 _Phase B_ 가
    실제 코드 진입 시 첫 진입 차단 게이트.
- Year 2 / 매년 개정 시나리오:
  1. golden Phase B (보기별 라벨 시범) 진입 → backfill 마이그레이션 첫
     UPDATE 에서 ABORT → 마이그레이션 실패 → 진산 카운터 게이트.
  2. 향후 다른 시험 기출 → 같은 진입 벽 재발.
- 데이터 무결성 위협 경로:
  - 우회로 (trigger 일시 DROP → backfill → 재설치) 는 운영 위험: backfill 중
    동시에 정상 INSERT 가 들어오면 invariant 깨짐. 또한 production 에서 trigger
    DROP 권한은 wrangler d1 execute --remote 가 필요 = 진산 인증 게이트 다회 발동.
- 권장 조치:
  1. ADR 신설 — exam_questions 의 **메타데이터 컬럼**(related_nodes, distractors,
     calc_variables, input_type) 만 UPDATE 화이트리스트 허용 (knowledge_nodes
     의 `is_current_active` 만 허용 패턴과 동일, `migrations/0013:64-87` 정합).
     본문 컬럼 (content / answer / explanation) 은 SUPERSEDES 의무 유지.
  2. 마이그레이션 신설: `prevent_exam_questions_update` 를 `prevent_exam_questions_
body_update` 로 교체 (`WHEN NEW.content IS NOT OLD.content OR NEW.answer IS NOT OLD.answer
OR NEW.explanation IS NOT OLD.explanation` 로 본문만 가드).
  3. 신규 관계 테이블 `question_node_links` (question_id, node_id, FK) 도입 시
     UPDATE 차단 우회 + C-4 의 4-way sync 동시 해결.
- 우선순위 근거: G-S5 측정 자체가 차단된 상태이며, 진산 결재 경로 A 채택이
  명시되었으나 이 트리거가 실코드 게이트에서 명시적으로 부딪힌다 (cycle-closure
  realcode gate 패턴 [feedback_cycle_closure_realcode_gate]). 진행 의무.

---

## MAJOR (Year 2 진입 후 점진 누적 부채) — 6건

### M-1. 마이그레이션 슬롯 gap `0020` — 추적 메커니즘 부재

- 파일: `migrations/` 디렉토리 — 0019 다음이 0021. 0020 슬롯 의도적 공석이지만
  README 부재. `handoff-038` 에 "0019 = BATCH-1 차단 게이트, 0020/0021 슬롯 이월"
  주석이 있지만 마이그레이션 디렉토리 자체에 인덱스 부재.
- 부채 모델: 새 개발자가 신규 마이그레이션 추가 시 (a) 0020 슬롯 채우려다
  history 깨뜨림 (이미 production 0021 적용 → 충돌), (b) 단순히 다음 번호
  (0038) 추가하지만 0020 의 의도 모름.
- 권장 조치: `migrations/README.md` 추가 — 슬롯 정책, 공석 슬롯 사유, 신규
  마이그레이션 진입 절차, status_transitions 의 audit-only 정책 명시.
- 우선순위 근거: 즉시 운영 위험 0이지만 Year 2 진입 + 신규 contributor 합류 시
  반복 confused commit 발생 위험.

---

### M-2. `users` 테이블 Temporal 예외의 명시 정책이 마이그레이션 본문에만 — Year 2 audit fail

- 파일: `migrations/0006_users_and_auth.sql:10-15` (주석 "Temporal 예외 — 일반
  UPDATE 허용") + schema.ts:469-494 (Temporal 트리거 없음).
- 부채 모델: knowledge_nodes 등 4개 핵심 테이블이 UPDATE 차단인데 users 만
  예외 — Year 2 audit (예: GDPR 데이터 처리 감사) 에서 "왜 이 테이블만 예외
  인가" 가 답변 가능해야 한다. 현재 답은 0006 본문 주석에만 존재 (ADR 부재).
  유사 예외 = `rate_limits` (schema.ts:730-734 주석), `webhook_events` (정상
  Temporal 상태 머신은 0008 trigger 로 보호).
- 권장 조치: ADR 신설 — "Temporal Graph 예외 4 테이블 inventory" (users /
  rate_limits / sessions revoke flow / streak_records). 갱신 빈도가 높은 이유,
  audit trail 외부화 여부 (users 는 login_history 로 일부 외부화 0030).
- 우선순위 근거: 운영 안전 영향 적음, 장기 거버넌스/감사 의무.

---

### M-3. `lastLoginAt` 컬럼 잔존 — schema.ts 의 "폐기 검토" 미진행

- 파일: `schema.ts:481-488` ("backward-compat 유지, 향후 별도 마이그레이션에서
  폐기 검토") + `migrations/0030_login_history.sql:15-16` ("향후 별도 마이그레이션
  에서 폐기").
- 부채 모델: login_history (audit) 와 `users.last_login_at` (denorm) 의 이중
  관리. login_history INSERT 시 users UPDATE 도 동시에 일어남 → 트랜잭션이
  깨지면 둘이 불일치 → "최근 로그인 시각" 두 값.
- 권장 조치: 마이그레이션 신설 — `users.last_login_at` DROP (SQLite 3.35+
  DROP COLUMN 지원). 사용처 grep 후 admin/sessions 도 login_history MAX(login_at)
  로 치환.
- 우선순위 근거: 데이터 무결성 위협은 낮지만 (audit 가 진실원이라 의사결정에는
  영향 없음) 학습자 화면 (있다면) drift 가능.

---

### M-4. `engine_telemetry` FK 부재 + retention 정책 ADR 만 있고 코드 없음

- 파일: `migrations/0017_engine_telemetry.sql:48-77` (FK 부재 주석 + 1년
  retention 정책 "Phase 2 carry-over" 명시).
- 부채 모델: append-only fact table 이 무한 누적. 매 BATCH × 8 게이지 × 다회 =
  연간 수만 row. Year 3 진입 시 admin /telemetry 페이지 풀스캔.
- 권장 조치: Cron Trigger (`scheduled` 핸들러에 1년 이전 row DELETE 추가, 0017
  의 prevent_engine_telemetry_delete trigger 잠시 비활성 후 재설치 SQL fragment).
- 우선순위 근거: 운영 영향 1~2년 내 미발생.

---

### M-5. `mnemonic_cards` / `topic_clusters` 가 Temporal Graph 외 — 개정 시 처리 모호

- 파일: `schema.ts:351-365` (mnemonic_cards), `:452-465` (topic_clusters).
  Temporal 트리거 부재 (0003/0004 적용 안 됨).
- 부채 모델: 매년 교재 개정 시 mnemonic_cards 의 "두문자어가 본 노드 폐기로
  유효성 잃음" 시나리오에서 UPDATE 가능하고 status 만 'flagged' 로 바꾸면 됨 →
  운영 OK. 그러나 정책 명문화 부재 → 신규 BATCH 개발 시 mnemonic 폐기를
  delete 로 처리할지 status 전이로 처리할지 결정 매번 새로 함.
- 권장 조치: ADR 신설 — Temporal Graph 적용 테이블 매트릭스 (full / partial
  status_transitions / 일반 UPDATE) + 각 사유.
- 우선순위 근거: 거버넌스, 즉시 위험 0.

---

### M-6. exam_questions 의 메타데이터 (distractors/calc_variables/related_nodes) FK 부재

- 파일: `schema.ts:331-345` + `migrations/0032_exam_questions_input_type.sql:21-26`
  (NULLABLE JSON columns).
- 부채 모델: distractors / calc_variables / related_nodes 가 모두 JSON text →
  D1 referential 검증 0. typo ID 가 들어가도 INSERT 통과, 채점 시점에서
  발견되는 silent failure 표면.
- 권장 조치: 관계 테이블 분리 (`question_node_links`, `question_distractors`,
  `question_calc_vars`) — JSON 디포 폐기. C-7 의 UPDATE 차단 해소와 묶음 처리
  권장.
- 우선순위 근거: 현재 production 545/545 NULL 이라 잠복, golden 데이터 진입
  시 즉시 표면화.

---

## MINOR — 3건

### m-1. `EXAM_SCOPES` 가 손해평가사 특화 enum 인데 schema.ts 에 잔존

- 파일: `schema.ts:130-131` `EXAM_SCOPES = ['1st_sub1', '1st_sub2', '1st_sub3',
'2nd', 'shared']`. ADR-007 §즉시반영 의 "Year 1 한시 예외 — Year 2 Phase 4
  에서 `exams/son-hae-pyeong-ga-sa/domain.ts` 로 이전" 대상.
- 권장 조치: 주석으로 한시 예외 명시 (production-quality.md Rule 15 정합).
- 우선순위 근거: ADR 에 이미 이월 처리.

### m-2. `webhook_events` 는 PG 중립 audit 로 좋지만 비즈니스 `payment_events` 미생성

- 파일: `schema.ts:587-616` 주석 "비즈니스 payment_events 는 Phase 3 에 별도
  테이블".
- 권장 조치: Phase 3 launch chain 진입 시 payment_events 마이그레이션 게이트
  명시 (handoff carry-over).

### m-3. 시험 ID 패턴 충돌 사전 검증 도구 부재

- 파일: `packages/parser/src/ontology-registry.ts:103-108` `inferNodeTypeFromId`.
- 부채 모델: Year 2 진입 시 prefix 충돌 (예: 손해평가사 INS-01 ↔ 공인중개사
  INS-01) 시 첫 매칭이 우선 → silent mismatch.
- 권장 조치: registry 로딩 시점에 prefix 충돌 assert + CI gate.

---

## Devil's Advocate (자가 반박)

본 리뷰의 모든 CRITICAL 이 "Year 2 가 정말 진입할 것인가" 가정에 의존.
[project_v3_final_multi_exam_deferred] 메모리는 Year 2 이월을 명시 — Year 1
동안엔 단일 시험. **그러나** 멀티시험은 [project_vision_mvp_generalization]
("쪽집게 = 자격증 자동 훈련 엔진 MVP") 비전 핵심 — 단일 시험 손해평가사 (시장
~수만 명) 으로는 ROI 정당화 불가. 따라서 Year 2 진입은 **사업 생존 조건** 이며,
"Year 2 에 폭발" 부채 = "사업 생존 조건 시점에 1~2주 stop-the-world" 등가.

또한 **C-3 (status_transitions 무한 누적)** 은 Year 1 단일 시험 + 손해평가
도메인 한정 코퍼스 488 approved 만으로는 5년 내 폭발 가능성 낮음 — 그러나
G-S5 측정 후 학습자 트래픽 진입 시 검색 hot-path 인 점 + 매년 BATCH 개정
SUPERSEDES 트리거가 새 transitions row 추가 → 누적 속도는 단조 증가. 1차
한계는 latency 가 아니라 _측정 무결성_ (G-S5 재측정 시점마다 ms 단위 흔들림 →
"측정 도구 자체 불안정" 해석 가능) 이다.

**C-4 (4-way 일관성)** 의 Vectorize 부분은 ADR-004 §3 metadata `is_active` 가
이미 정의되어 있어 Stage 2 hard filter 가 최종 방어선이지만, 진산이 [
feedback_focus_reliability_not_schedule] 에 명시한 "안정성·신뢰성·항상성"
관점에서는 "방어선 하나에 의존" = "단일 장애점" 이다.

---

## 다른 페르소나가 못 볼 각도 — backend-architect 독점 발견 5건

1. **`approved-nodes-sql.ts` 단일 진실원 _불완전 시행_** — 본 모듈의 docstring
   이 "4 호출 측" 으로 잠금하고 있지만 study/routes.ts:enrichRelatedNodes 가
   5번째 누락 호출 측 (C-6). 진산이 신뢰하는 G-S5 측정 직전 _학습자 출처 화면_
   에 review/flagged 노드가 노출 가능. quality-engineer 가 "테스트가 없다"
   고만 본다면 이 invariant 위반은 못 잡고, performance-engineer 는 단일 진실
   원의 사회 계약 의미 미감지. 본 리뷰만 캐치.

2. **Year 2 zero-cost 의무의 실효성 평가** — Hard Rule 16/17 inventory.
   책임 영역별 현황:
   | 영역 | examId 시그니처 | exam_id 컬럼 준비 | 전환 비용 |
   | --- | --- | --- | --- |
   | `apps/api/src/search/graph-walk/index.ts:164` | OK | WHERE 절 부재 (단일 시험) | 0 (시그니처 보유) |
   | `apps/api/src/search/user-search.ts:209` | OK | 동상 | 0 |
   | `apps/api/src/search/multi-path-fallback/keyword-fallback.ts` | OK | 동상 | 0 |
   | `apps/batch/src/loader/draft-loader.ts:46` | OK | INSERT 미바인딩 (Year 1 한시) | 0 (binding 추가만) |
   | `apps/api/src/vectorize/upserter.ts:143` | OK | metadata 자동 주입 | 0 |
   | `apps/api/src/progress/routes.ts:150,196,310` | OK (`requireExamId`) | WHERE 절 부재 (`void examIdParam.examId`) | 0 |
   | `apps/api/src/study/routes.ts` (다중 SELECT) | ⚠ examId 부분 보유 | 검증 안 함 | 1~2일 |
   | `apps/api/src/vectorize/routes.ts:329-348` | ⚠ examId 미사용 | hardcoded `is_active: true` | 0.5~1일 |
   | engine_telemetry / rate_limits / login_history | NOT NULL exam_id 보유 / 면제 / 면제 | OK | 0 |
   | ontology-registry.json 노드 ID 패턴 | ⚠ 단일 namespace | DB CHECK 잠금 | **2~4주** (C-1) |
   | exam_questions JSON 필드 | ⚠ FK 0 | UPDATE 잠금 | 1주 (C-7) |
   | review_queue (0027) | OK | exam_id NOT NULL | 0 |
   | table_structures 등 (0021) | ⚠ GLOB CHECK | exam_id 미보유 | 1주 (테이블 재생성) |

   진산 결재 자료 (S5-7 plan) 에 통합 시 ROI 표 직접 활용 가능.

3. **D1 SQLite 트리거 cascade depth 미검증** — `mav_supersedes_knowledge_nodes_
deactivate` (0013:101) 이 UPDATE knowledge_nodes → 0014 의
   `prevent_knowledge_nodes_update` 트리거가 다시 활성화 (WHEN body
   변경) — 현재는 `is_current_active` 만 변하므로 통과. 그러나 C-4 해소를 위해
   _cascade trigger_ (SUPERSEDES → table_node_links UPDATE → table_structures
   UPDATE …) 추가 시 D1 SQLite 의 `PRAGMA recursive_triggers` 설정 확인 필요
   (D1 default = off 확인 미실시).

4. **bge-m3 임베딩 차원 (1024) 변경 시 마이그레이션 경로 부재** — Vectorize
   인덱스는 차원 고정 → embedding 모델 교체 시 새 인덱스 + dual-write + cutover.
   해당 ADR 부재. Year 2 이전 임베딩 모델 업그레이드 시 1~2주 작업.

5. **`SQLite REAL 결측의 NaN 분기**가 `buildHit` (`user-search.ts:341-342`)
   에서 명시적으로 가드 되어 있지만, 다른 12군데 (fetchApprovedNodes 의
   truth_weight 인입 등) 는 미적용. CO6-4(e) 흡수 후 1곳만 패치 — Year 2
   confidence/score 도입 시 동일 NaN 가드 누락 13곳 전수.

---

## Year 2 zero-cost 전환 위반 인벤토리 (요약 — 위 표 참조)

| 영역                               | Hard Rule | 현 상태            | 전환 비용             |
| ---------------------------------- | --------- | ------------------ | --------------------- |
| ontology-registry node ID 패턴     | 15        | DB CHECK 잠금      | **2~4주 (C-1)**       |
| exam_questions UPDATE 차단         | 15        | trigger 차단       | **1주 (C-7)**         |
| table_structures GLOB CHECK        | 15        | 테이블 재생성 의무 | 1주                   |
| study/routes.ts enrichRelatedNodes | 16        | 일부 누락          | 0.5일 (C-6)           |
| vectorize/routes.ts bootstrap      | 16        | examId 미수용      | 0.5~1일 (C-5)         |
| EXAM_SCOPES enum 잔존              | 15        | Year 1 한시 예외   | 0 (ADR-007 §즉시반영) |
| 나머지 핵심 모듈                   | 16/17     | OK                 | 0                     |

**Year 2 진입 시 실 비용 합계: 약 5~6주** (병렬화 후 3~4주). ROADMAP "Year 2
zero-cost" 선언과 ±N주 gap.

---

## 마이그레이션 부채 누적표 (37개 누적)

| 번호           | 도입                                  | 미흡 / 부채                                                                                      | 회수 권고                                                             |
| -------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| 0001           | 초기 6 테이블 + page_ref NULLABLE     | 후속 0010 가 trigger 로 NOT NULL 강제 (이중 방어선이 됨)                                         | ALTER COLUMN 회수 (SQLite 미지원 → 테이블 재생성 carry-over)          |
| 0003/0004/0005 | 트리거 12종 (Temporal + NOT NULL)     | 트리거 22개 누적 → drizzle-kit 위험                                                              | drizzle-kit 영구 금지 ADR (NC-1) 이미 0001 schema.ts 헤더에 명시      |
| 0006           | users 테이블 Temporal 예외            | ADR 부재 (M-2)                                                                                   | ADR 신설                                                              |
| 0010           | status_transitions append-only        | retention 정책 부재 (C-3)                                                                        | retention ADR + Cron                                                  |
| 0013           | is_current_active Materialized        | review_decisions 도 append-only 잠금 → 동일 retention 부채                                       | C-3 와 묶음                                                           |
| 0014           | UPDATE 가드 컬럼별 화이트리스트       | 컬럼 추가 시 매번 수동 갱신 의무 (16/19에서 실제 반복)                                           | 자동화 도구 (lint AST 검사) carry-over                                |
| 0015           | batch_runs Idempotency                | 트리거 이름 v1.0→v1.1 변경 시 stale trigger 잔존 위험 (이미 안전망 DROP IF EXISTS 추가, 0015:87) | 정책 문서화                                                           |
| 0016           | knowledge_nodes 컬럼 backfill 예외    | 0014 트리거를 매번 재작성 의무 누적 (0019 도 동일)                                               | 0014 패턴이 재사용 어려움 — 단일 트리거에 화이트리스트 함수 추출 검토 |
| 0017           | engine_telemetry append-only          | retention 미구현 (M-4)                                                                           | Cron + DROP trigger fragment                                          |
| 0018           | draft-only INSERT                     | 0010 와 의도적 redundancy → drift 감지 어려움                                                    | drift 테스트                                                          |
| 0019           | book_page/pdf_page NOT NULL           | 0020 슬롯 공석 (M-1)                                                                             | README + 슬롯 정책 문서화                                             |
| 0021           | Table-as-Micro-KG                     | 단일 namespace ID + DB CHECK 잠금 (C-1)                                                          | 멀티시험 prefix 진입 전 마이그                                        |
| 0022~0026      | 표 처리 후속 가드                     | 패턴-H 흡수 시 0024 trigger drop & recreate — drift 위험                                         | 재발 시 문서화                                                        |
| 0027           | review_queue                          | exam_id NOT NULL OK                                                                              | 0                                                                     |
| 0028           | pbkdf2 iterations workers compat      | 보안 변경 ADR 있나 확인                                                                          | 별도                                                                  |
| 0029           | user_progress UNIQUE                  | schema.ts 미반영 (C-2)                                                                           | schema.ts 인덱스 미러링 추가                                          |
| 0030           | login_history                         | users.last_login_at 폐기 carry-over (M-3)                                                        | DROP COLUMN 마이그                                                    |
| 0031           | login_history.event_type              | OK                                                                                               | 0                                                                     |
| 0032           | exam_questions.input_type + JSON 필드 | UPDATE 차단으로 backfill 차단 (C-7)                                                              | 본문/메타 분리                                                        |
| 0033           | user_progress FSRS 확장               | schema.ts 인덱스 미반영 (C-2)                                                                    | 동일                                                                  |
| 0034           | study_reviews                         | OK                                                                                               | 0                                                                     |
| 0035           | study_sessions / streak_records       | streak.last_study_date 단일 컬럼 (ADR-041 KST-only) — Year 2 다국가/시험 진입 시 재평가          | ADR-041 §3 trigger 명시                                               |
| 0036           | study_reviews 인덱스                  | OK                                                                                               | 0                                                                     |
| 0037           | exam_questions partial composite      | schema.ts 미반영 (C-2)                                                                           | 동일                                                                  |

총평: 37 마이그레이션 중 **NC-1 정합 위반** 3건 (0029/0033/0037 schema.ts 인덱스
미반영), **단일 진실원 invariant 위반** 1건 (study/routes.ts → C-6), **Year
2 zero-cost 위반** 3건 (C-1/C-5/C-7), **무한 누적 retention 부재** 3건 (status\_
transitions / review_decisions / engine_telemetry).

---

## 판정

- CRITICAL 7건 — Year 2 진입 _전_ 5~6주 마이그레이션 작업 필요. 그 중 C-1/C-7
  은 단일 진산 결재로 진행 가능, 나머지는 plan + 인간 승인 절차 (L3).
- MAJOR 6건 — Year 2 진입 후 점진 진행 가능. 단 M-1 (마이그 README) 는 1일.
- 본 보고는 다른 4 페르소나와 중복 0건 보장 (성능 latency / 테스트 부재 /
  any 타입 / 배포 순서는 다루지 않음).

리뷰 종료.
