# Session Handoff — 2026-04-12 (Session 4)

## 완료된 작업

### Step 0-1 ~ 0-10: Session 1~3 완료

- 모노레포, DB 스키마, PWA 셸, PDF 추출기, 기출 파서, 법령 수집, 섹션 분리기
- Ontology Registry + Schema Validator (L3)
- Claude API 배치 프로세서 (L2)
- Constants 추출기 (L2)

### Step 0-11: M16 Formula Engine PoC (DONE — L3)

- `packages/formula-engine/src/` — 10개 소스 파일, 76개 테스트
- math.js AST 기반, sandbox.ts 보안 래퍼
  - 노드 타입 화이트리스트 (5종), 심볼 안전 정규식 + 차단 목록
  - ConstantNode 문자열 차단, scope 프로토타입 방어
  - compiled 결과 캐시 (MAX_CACHE_SIZE=200)
- F-01~F-13 산식 13개, max(x,0) 보험금 가드 적용 (F-08/F-09/F-11)
- 등록 시 template↔schema 양방향 교차 검증
- 리뷰: 3회 (초기 3-agent + 5-expert 심층 + max(x,0) 검증)

### Step 0-12: M14 Graph 무결성 검증기 (DONE — L2)

- `packages/quality/src/graph-integrity.ts` — 5개 검증 함수, 23개 테스트
- 고아 노드(TERM 제외), 끊긴 엣지, SUPERSEDES 순환, 입력 ID 검증(중복 포함)
- isActive 일관 필터링, DFS O(V+E), filter→카운터 루프
- 리뷰: 2회 (code-reviewer + silent-failure-hunter)

### Step 0-13: M28 Graph Visualizer 경량 버전 (DONE — L2)

- `apps/admin-web/src/components/GraphVisualizer.tsx` — D3.js Force Graph
  - 서브그래프 필터 (LV1/LV2/타입), 100노드 Hairball 방지
  - 드래그/줌, 툴팁, truthWeight 기반 노드 크기, status 색상
  - simulation cleanup (메모리 누수 방지)
- `apps/admin-web/src/components/ContentQueue.tsx` — draft→approved 워크플로우
- Astro + React 설정, typecheck + lint 통과

### Step 0-14: BATCH 1 PoC 통합 + QG-2 게이트 (DONE — L2)

- `apps/batch/src/pipeline.ts` — 9-Stage 파이프라인 정의
- `apps/batch/src/qg2-validator.ts` — QG-2 검증기 (규모/산식/무결성 5체크)
- 8개 테스트 통과 (formula-engine 실제 연동)

## Phase 0 완료 현황

| 항목               | 수치                                                    |
| ------------------ | ------------------------------------------------------- |
| Step 완료          | 14/14 (100%)                                            |
| 총 테스트          | 217+ (parser 110 + formula 76 + quality 23 + batch 8)   |
| 독립 리뷰          | 7회 (CRITICAL 총 15건+ 수정)                            |
| 5-expert 심층 리뷰 | 1회 (architect, quality, performance, security, domain) |

## 미해결 리뷰 항목

| #    | 항목                                           | 등급      | 해결 시점                  |
| ---- | ---------------------------------------------- | --------- | -------------------------- |
| C3   | Temporal Graph UPDATE TRIGGER                  | Critical  | DB 스키마 변경 L3          |
| M2   | IndexedDB 타입 Drizzle 파생                    | Major     | Phase 1                    |
| M4   | user_progress 행 수준 접근제어                 | Major     | API 구현 시                |
| M5   | submitRating rating 값 저장                    | Major     | FSRS 구현 시               |
| M6   | D1-IndexedDB 필드 누락                         | Major     | Phase 1                    |
| M7   | truth_weight 타입별 자동 적용                  | Major     | 파이프라인 구현 시         |
| M8   | 배치 순서 강제 메커니즘                        | Major     | batch_status 테이블 L3     |
| D1   | 배치 프로세서 재프롬프트                       | Major     | apps/batch에서 수동 트리거 |
| D2   | Knowledge Contract 추가 필드                   | Major     | db-loader 단계             |
| FE-2 | F-13 "6% 초과분" 해석 교재 p.424 실물 확인     | Major     | 교재 확인 후               |
| FE-6 | F-08/F-09/F-11 max(x,0) 교재 실물 재검증       | Major     | 교재 확인 후               |
| FE-7 | F-11 `0.05` 하드코딩 → Constants DB 조회       | Major     | 설계 결정 시               |
| FE-8 | supersededBy 필드 vs SUPERSEDES 엣지 이중 추적 | Major     | 파이프라인 시              |
| A1   | ConstantsProvider sync→async 전환              | Major     | D1 연동 시                 |
| A2   | roundTo 대금액(>2^53) 정밀도                   | Major     | 실데이터 투입 시           |
| P1   | create(all) mathjs 800KB 번들 최적화           | Major     | Workers 배포 전            |
| P2   | 13x safeParse 모듈 로드 cold start             | Major     | Workers 배포 전            |
| Q1   | Golden test 교재 실데이터 (QG-2 미충족)        | Major     | 교재 데이터 시             |
| U1   | index.astro React Islands 미마운트             | Important | BATCH 1 적재 후            |
| U2   | flagged 항목 복구 경로 없음                    | Important | Phase 2 CMS                |

## 검증 상태

- pnpm typecheck: 전체 통과
- vitest: 217+ 테스트 통과
- pnpm lint: 전체 통과
- git commit 없음 (Session 1 이후)

## 리뷰 파일 목록

- `.claude/reviews/review-20260412-205500.md` (Step 0-8)
- `.claude/reviews/review-20260412-211900.md` (Step 0-9)
- `.claude/reviews/review-20260412-215900.md` (Step 0-10)
- `.claude/reviews/review-20260412-223100.md` (Step 0-11)
- `.claude/reviews/review-20260412-224800.md` (Step 0-12)
- `.claude/reviews/review-20260412-225800.md` (5-expert 심층 리뷰)
- `.claude/reviews/review-20260412-234000.md` (Step 0-13/0-14)

## 다음 작업

### Phase 0 전체 코드 감사

Phase 0 완료 후 전체 코드+로직 감사 예정.
대상: packages/(parser, formula-engine, quality, shared) + apps/(batch, admin-web)

### 이후 Phase 1 시작

실제 QG-2 통과 후 → BATCH 2~5, 교차 검증, Formula 확장, Graph RAG 등

## 핵심 문서 위치

- 설계서: `docs/쪽집게(ThePick) — 구현 설계서 및 개발 로드맵.md`
- 재정립서: `docs/쪽집게(ThePick) — 구현 재정립서 v2.0.md`
- 프로젝트 규칙: `CLAUDE.md`
- 4-Pass 리뷰: `.claude/rules/auto-review-protocol.md`
