# Session Handoff — 2026-04-12 (Session 3)

## 완료된 작업

### Step 0-1 ~ 0-7: 이전 세션 완료 (Session 1~2)

- 모노레포 초기화, DB 스키마, PWA 셸, PDF 추출기, 기출 파서, 섹션 분리기

### Step 0-8: M08 Ontology Registry + Schema Validator (DONE — L3 plan 승인)

- `packages/parser/src/ontology-registry.json` — 7 노드타입 ID 패턴, 13 엣지타입, 7 상수카테고리
- `packages/parser/src/ontology-registry.ts` — 런타임 검증(assertRegistryShape) + RegExp 캐시 + 8개 헬퍼
- `packages/parser/src/schema-validator.ts` — Knowledge Contract JSON 검증기 (13종 에러코드)
- `packages/shared/src/types.ts` — ConstantCategory 타입 추가
- 독립 에이전트 3개 리뷰 → Critical 3건 + High 5건 수정 완료
- 리뷰: `.claude/reviews/review-20260412-205500.md`

### Step 0-9: M07 Claude API 배치 프로세서 (DONE — L2)

- `packages/parser/src/batch-processor.ts` — Claude API DI 클라이언트, 30초 타임아웃, 3회 지수 백오프 재시도, 토큰 비용 로깅, Ontology Lock 검증 연동
- 시스템 프롬프트: 7개 노드 ID 규칙 + 13 엣지타입 + 7 상수카테고리 + JSON 스키마 명시
- 방어적 처리: response.content null 체크, stop_reason max_tokens 경고, 빈 contract throw, 스택 트레이스 로깅
- 재프롬프트는 호출자(apps/batch)에서 수동 트리거 방식
- 독립 에이전트 2개 리뷰 → Critical 2건 + High 3건 수정 완료
- 리뷰: `.claude/reviews/review-20260412-211900.md`

### Step 0-10: M09 Constants 추출기 (DONE — L2)

- `packages/parser/src/constants-extractor.ts` — numeric_value 파싱 + unit 추출 + confusion_level 자동 태깅
- 날짜 카테고리/패턴 감지로 오파싱 방지, per-constant try-catch 에러 격리
- 타입 안전 ConfusionLevel 상수 (as 단언 제거)
- EnrichedConstant JSDoc: DB 적재 시 appliesTo/versionYear 추가 필요 명시
- 독립 에이전트 2개 리뷰 → Critical 2건 + High 1건 수정 완료
- 리뷰: `.claude/reviews/review-20260412-215900.md`

### 인프라 수정

- `.claude/settings.json` Stop Hook 정리: review-reminder.sh + session-monitor.sh 제거 (글로벌에서 처리)
- protect-l3.sh 절대 경로로 변경

## 미결 질문 (다음 세션에서 결정)

### Q1: confusion_level 임계값

설계서 예시에서 단감 1.0115 vs 떫은감 0.9662(4.5%)를 "warn"으로 분류하나, 현재 구현은 10% 이내이므로 "danger"로 태깅함.

- A (현행 유지): 자동 휴리스틱은 danger, 인간 QG 검수 시 조정
- B (spec 충실): 카테고리별 차별 임계값 적용

## Session 4 완료 작업

### Step 0-11: M16 Formula Engine PoC (DONE — L3 plan 승인)

- `packages/formula-engine/src/` — 10개 소스 파일
- math.js AST 파서 기반, sandbox.ts 보안 래퍼 (노드 타입 화이트리스트)
- F-01~F-13 산식 13개 정의, 72개 테스트 통과
- 독립 에이전트 3개 리뷰 → CRITICAL 4건 수정 완료
- 리뷰: `.claude/reviews/review-20260412-223100.md`

### Step 0-12: M14 Graph 무결성 검증기 (DONE — L2)

- `packages/quality/src/graph-integrity.ts` — 고아 노드/끊긴 엣지/SUPERSEDES 순환 검증
- 입력 ID 검증 (빈 ID, 중복 ID), isActive 일관 필터링, DFS O(V+E)
- 22개 테스트 통과
- 독립 에이전트 2개 리뷰 → CRITICAL 0건, HIGH 수정 완료
- 리뷰: `.claude/reviews/review-20260412-224800.md`

### Step 0-13: M28 Graph Visualizer 경량 버전 (DONE — L2)

- `apps/admin-web/src/components/GraphVisualizer.tsx` — D3.js Force Graph, 서브그래프 필터, 100노드 제한, 드래그/줌
- `apps/admin-web/src/components/ContentQueue.tsx` — draft→review→approved→published 워크플로우
- `apps/admin-web/src/types/graph.ts`, `pages/index.astro`, `astro.config.mjs`
- typecheck + lint 통과

### Step 0-14: BATCH 1 PoC 통합 + QG-2 게이트 (DONE — L2)

- `apps/batch/src/pipeline.ts` — 9-Stage 파이프라인 오케스트레이터
- `apps/batch/src/qg2-validator.ts` — QG-2 검증기 (규모/산식/무결성 5개 체크)
- 8개 테스트 통과 (mock 데이터 + formula engine 연동)
- typecheck + lint 통과

### Phase 0 완료 🎉

실제 QG-2 게이트 통과는 교재 PDF + Claude API로 BATCH 1 실행 후.

## 미해결 리뷰 항목

| #    | 항목                                                        | 등급     | 해결 시점                  |
| ---- | ----------------------------------------------------------- | -------- | -------------------------- |
| C3   | Temporal Graph UPDATE TRIGGER                               | Critical | DB 스키마 변경 L3          |
| M2   | IndexedDB 타입 Drizzle 파생                                 | Major    | Phase 0 내                 |
| M4   | user_progress 행 수준 접근제어                              | Major    | API 구현 시                |
| M5   | submitRating rating 값 저장                                 | Major    | Step 1-10 (FSRS)           |
| M6   | D1-IndexedDB 필드 누락                                      | Major    | Phase 0 내                 |
| M7   | truth_weight 타입별 자동 적용                               | Major    | 파이프라인 구현 시         |
| M8   | 배치 순서 강제 메커니즘                                     | Major    | batch_status 테이블 L3     |
| D1   | 배치 프로세서 재프롬프트                                    | Major    | apps/batch에서 수동 트리거 |
| D2   | Knowledge Contract 추가 필드                                | Major    | db-loader 단계             |
| FE-1 | ~~F-11 max(x,0)~~ 적용 완료 (도메인 전문가 CRITICAL 판정)   | ✅ Done  | Session 4                  |
| FE-2 | F-13 "6% 초과분" 해석 교재 p.424 실물 확인                  | Major    | 교재 확인 후               |
| FE-6 | F-08/F-09/F-11 max(x,0) 적용 — 교재 실물로 정답 재검증 필요 | Major    | 교재 확인 후               |
| FE-7 | F-11 `0.05` 하드코딩 → Constants DB 조회 필요 여부          | Major    | 설계 결정 시               |
| FE-8 | supersededBy 필드 vs SUPERSEDES 엣지 이중 추적 동기화       | Major    | 파이프라인 구현 시         |
| FE-3 | mathjs 선별 import (번들 700KB+ 최적화)                     | Major    | Workers 배포 전            |
| FE-4 | ConstantsProvider async 전환                                | Major    | D1 연동 시                 |
| FE-5 | AST 캐시 LRU 제한                                           | Minor    | Workers 배포 전            |

## 현재 상태

- pnpm typecheck: 13/13 통과
- vitest run (parser): 110/110 통과
- pnpm lint: 13/13 통과
- git commit 없음 (Session 1 이후)

## 핵심 문서 위치

- 설계서: `docs/쪽집게(ThePick) — 구현 설계서 및 개발 로드맵.md`
- 재정립서: `docs/쪽집게(ThePick) — 구현 재정립서 v2.0.md`
- 프로젝트 규칙: `CLAUDE.md`
- 4-Pass 리뷰: `.claude/rules/auto-review-protocol.md`
- 리뷰 결과: `.claude/reviews/review-2026041*.md` (3개)
