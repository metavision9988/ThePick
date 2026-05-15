# S5-1 측정 결과 — CO-1 (CPU) / CO-2 (결정성) 실 Cloudflare D1

- **세션:** 086 (2026-05-15) / 진산 6-A 인증 위임(자동 측정) 결재
- **대상:** `thepick-db-production` (`a9b8d521-...`, served_by v3-prod ICN/APAC)
- **방법:** `wrangler d1 execute --remote --env production` read-only SELECT only
  (전 실행 `rows_written=0`, `nodes_now=794` 불변 재검증 — Hard Limit 무손상)
- **선행 plan:** `docs/plans/graph-walk-s5-integration.plan.md` §1, §6 S5-0 결재

---

## 0. 라이브 D1 무결성 (CLAUDE.md W2 carry-over 동시 해소)

| 테이블          |            라이브 count | CLAUDE.md 기대 | 판정    |
| :-------------- | ----------------------: | -------------: | :------ |
| knowledge_nodes |                     794 |            794 | ✅ 일치 |
| knowledge_edges | 1274 (전부 is_active=1) |          ~1274 | ✅      |
| formulas        |                     157 |            157 | ✅      |
| constants       |                     193 |            193 | ✅      |
| exam_questions  |                     545 |            545 | ✅      |

→ G-AUDIT "knowledge_nodes 0건" 거짓 전제 **라이브 데이터로 확정 반증**.
CLAUDE.md 현재상태 §콘텐츠축 "라이브 D1 count 미실행" W2 carry-over 해소.

## 1. CO-2 — `ORDER BY depth, id` 결정성 ✅ 해소

- `SELECT id FROM knowledge_nodes WHERE id GLOB '*[가-힣]*'` → **0건**.
  production 노드 ID 는 전부 ASCII 패턴(`INS-15`, `F-08`, `CONCEPT-001`).
- graph-walk 최종 `ORDER BY depth ASC, a3.id ASC` 의 정렬 키는 정수(depth) +
  ASCII(id) — collation 무관 결정적. node:sqlite golden 과 동일 보장.
- **잔여(S5-2 흡수)**: D1 SQLite 버전의 `WITH ... AS MATERIALIZED` 지원
  여부 1회 확인 (§2 최적화 선결). 결정성 자체는 ASCII 로 해소.

## 2. CO-1 — 실 D1 `WITH RECURSIVE` CPU 실측 ⚠️ 조건부

최고차수 실시드(narrow=`INS-15` outdeg7 / wide=`INS-21` outdeg40),
maxDepth 2(PoC 기본) 및 5(MAX_ALLOWED_DEPTH), 3회 반복 안정값:

| 구성                 | sql_duration_ms |   rows_read | result_nodes |
| :------------------- | --------------: | ----------: | -----------: |
| depth2 narrow(3종)   |             5.6 |      26,957 |            7 |
| depth5 narrow(3종)   |             4.7 |      26,957 |            7 |
| depth2 WIDE(7종)     |            37.6 |     184,168 |           50 |
| **depth5 WIDE(7종)** |        **54.3** | **240,535** |           51 |

### 2.1 판정

- **narrow 화이트리스트**: ~5ms — Workers free 50ms 충분 여유 ✅.
  depth2≡depth5 (sparse 그래프가 2-hop 에서 소진 — 추가 hop 비용 0).
- **WIDE 화이트리스트 depth5**: **54.3ms — free tier 50ms 초과** ❌
  (Workers 바인딩 오버헤드 가산 시 실 wall 더 큼). depth2 WIDE 37.6ms 는
  미만이나 여유 적음.
- **★ 핵심 결함 — `approved` CTE 비물질화**: 794노드 그래프에 rows_read
  24K~240K 는 비정상. `approved` CTE(`knowledge_nodes` ⋈ `status_transitions`
  ROW_NUMBER 윈도우)가 재귀 매 iteration + 최종 join(a3)마다 **재평가**.
  SQLite 가 다중 참조 CTE 를 기본 비물질화 → 폭증. PoC in-memory sqlite 는
  데이터가 작아 미발현(실 D1 측정이 정확히 잡아낸 항목 = CO-1 존재 이유).

### 2.2 수정 경로 (S5-2/S5-3)

1. `WITH approved AS MATERIALIZED (...)` 힌트 — D1 SQLite 지원 시 1키워드로
   240K→수K rows_read 붕괴 기대. S5-2 에서 지원 여부 선확인(§1 잔여).
2. 미지원 시: `approved` 를 임시 결과(앱 레벨 1쿼리 prefetch 후 IN-list)
   또는 재귀부에서 edge 만 순회·최종 SELECT 에서 approved 1회 검증으로
   재구조화. 단 Reality Anchor #3(폐기노드 경유 차단) 보존 설계 필수.
3. resultCap(기본 50)·maxDepth 기본 2 유지 시 WIDE 도 37.6ms — 기본값
   운용은 free tier 내. depth5 는 paid 전제 or 최적화 후 허용.

## 3. 부수 발견 — production approved 실태 (stale 주석)

- `approved_active_nodes = 488 / 794` (status_transitions node rows 488).
  **production approved 0건 아님.**
- `apps/api/src/search/routes.ts:117` 주석 "stage2Count=0: production
  'approved' 0건 정합" + CLAUDE.md "전부 status='draft' 강제 적재" 는
  **stale**. 488 노드가 status_transitions 로 approved 전이됨.
- 함의: graph-walk 통합 시 순회할 approved 콘텐츠 실재(488) → C 엔드포인트
  실데이터 baseline 측정 가능. routes.ts 주석 정정은 S5-3 동반 처리.

## 3.1 D-1 결재 + MATERIALIZED 재실측 (2026-05-15 추가)

진산 D-1 결재: **의미관계 전체 (SUPERSEDES만 제외) = 12 edge_type**
(`DEPENDS_ON,USES_FORMULA,APPLIES_TO,DEFINED_AS,PREREQUISITE,
REQUIRES_INVESTIGATION,CROSS_REF,GOVERNED_BY,DIFFERS_FROM,SHARED_WITH,
TIME_CONSTRAINT,EXCEPTION`). D-2: MATERIALIZED 최적화 기본 채택.

`WITH approved AS MATERIALIZED` **D1 지원 확인** (구문 오류 0, 실행 성공).
12종 화이트리스트 worst-case 시드(INS-21/INS-26) 재측정:

| 구성                   | sql_duration_ms | rows_read | nodes | free 50ms |
| :--------------------- | --------------: | --------: | ----: | :-------- |
| NO-MAT depth5 WL12     |           195.5 |   803,532 |   158 | ❌❌      |
| MAT depth5 WL12        |            67.3 |   342,332 |   158 | ❌        |
| MAT depth4 WL12        |            41.5 |   238,637 |   132 | ✅        |
| MAT depth3 WL12        |            26.5 |   164,385 |    90 | ✅        |
| MAT depth2 WL12 (기본) |           18–20 |     ~106K | 60–67 | ✅        |

→ MATERIALIZED 효과 2.9x(195→67ms). 기본 depth2 = ~20ms 안전.

### CO-1 최종 해소 — D-2 정책 (구현 기본값)

1. **`approved AS MATERIALIZED` 채택** (S5-2 공통 fragment 에 포함).
2. **기본 maxDepth 2 유지** (~20ms, 충분 여유).
3. **MAX_ALLOWED_DEPTH 5 → 4 하향** — worst-case 시드 + full(12종)
   화이트리스트 에서도 hard ceiling 이 free tier 내(depth4 41.5ms<50ms).
   depth5(67ms)는 명시적 paid opt-in / 추가 최적화 전까지 차단. plan §0
   Reality Anchor #1(Workers CPU 상한) **강화** — 더 보수적 = 자율 적용,
   본 문서·plan·ADR-045 영속.
4. resultCap 기본 50 유지 (CO-3: 최종 랭킹은 Stage 3 단일 진실원).

→ **CO-1 조건부 → 해소** (MATERIALIZED + MAX_DEPTH 4 hard ceiling).

## 4. 진산 결재 상신 항목 (S5 진행 분기) — ✅ 처리 완료

- **D-1 (★ 북극성 — edge_type 화이트리스트 범위)**: 현 PoC 기본
  `['DEPENDS_ON','SHARED_WITH','CROSS_REF']` = 비-SUPERSEDES 1263엣지의
  **34%(430)만 커버**. 핵심 추론 관계 `USES_FORMULA(221)`·`APPLIES_TO(158)`·
  `DEFINED_AS(129)`·`PREREQUISITE(113)` 가 화이트리스트 **밖** → 현 기본값
  으로 통합 시 Graph walk 가 정작 multi-hop 추론 엣지를 안 탄다(Pattern A
  반쪽). 어느 edge_type 을 의미 관계로 순회 허용할지 = 정확성(북극성) 직결
  결재. (SUPERSEDES=시계열, REQUIRES_INVESTIGATION/TIME_CONSTRAINT/EXCEPTION
  등은 의미 검토 필요.)
- **D-2 (CPU 정책)**: 기본값(depth2, narrow~mid)은 free tier 내. depth5 +
  WIDE 는 §2.2 최적화 선결 or paid 전제. 최적화(MATERIALIZED) 우선 권고.
