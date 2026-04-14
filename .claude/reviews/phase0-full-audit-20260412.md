# Phase 0 전체 코드+로직 감사 보고서

**일시**: 2026-04-12
**대상**: packages/(parser, formula-engine, quality, shared) + apps/(batch, admin-web, api, web) + migrations/
**방법**: 전문가 5명 병렬 독립 감사 (Surgeon, Architect, Security+Domain, Contract, Quality+Debt)
**파일 수**: 소스 68개 + 테스트 7개 + SQL 2개

---

## 총괄 요약

| 등급      | Surgeon | Architect | Security | Contract | Quality | **합계 (중복 제거)** |
| --------- | ------- | --------- | -------- | -------- | ------- | -------------------- |
| CRITICAL  | 3       | 3         | 0        | 1        | 0       | **6**                |
| MAJOR     | 7       | 9         | 4        | 4        | 0       | **18**               |
| MINOR     | 2       | 5         | 4        | 6        | 0       | **11**               |
| Tech Debt | -       | -         | -        | -        | 26      | **26**               |

### Phase 1 진입 판정: **READY WITH CONDITIONS** (조건부 진입 가능)

- Phase 1 차단 항목: **2건** (C3 UPDATE TRIGGER + Q1 Golden Test)
- 권장 사전 스프린트 항목: **4건** 추가

---

## CRITICAL 발견 사항 (6건)

### C-01. submitRating 스텁 - FSRS 데이터 폐기

- **출처**: Surgeon
- **파일**: `apps/web/src/stores/session.ts:57`
- **증거**: `_rating` 파라미터 무시, `// FSRS scheduling will be wired in Step 1-10` 주석만 존재
- **영향**: 학습자 평가 데이터 전량 폐기. CRITICAL RULE #2 위반 (빈 함수 완료 선언 금지)
- **판정**: Phase 1 FSRS 구현 시 해결 예정이므로 **즉시 수정 불요**, 단 스텁임을 명시적으로 표시 필요
- **해결 시점**: Phase 1 FSRS 스프린트

### C-02. safeEvaluate scope 키 검증 부재 - 프로토타입 오염 경로

- **출처**: Surgeon + Security
- **파일**: `packages/formula-engine/src/sandbox.ts:256-259`
- **증거**: `safeScope: Record<string, number> = {}` - AST 레벨 BLOCKED_SYMBOL_NAMES는 safeParse에만 적용, safeEvaluate 직접 호출 시 scope 키 검증 없음
- **영향**: 현재 engine.ts 경유 경로는 안전하나, 직접 호출자가 `__proto__` 키 주입 가능
- **수정**: `Object.create(null)` 사용 + scope 키 검증 루프 추가
- **해결 시점**: **Pre-Phase-1 스프린트** (L3 영역)

### C-03. FK PRAGMA 미들웨어 에러 미처리

- **출처**: Surgeon
- **파일**: `apps/api/src/index.ts:11-14`
- **증거**: `DB.exec('PRAGMA foreign_keys = ON')` - try-catch 없음, D1 커넥션 풀링에서 PRAGMA 유실 가능
- **영향**: FK 강제 비활성화 -> 끊긴 엣지 참조 허용
- **수정**: try-catch + console.error 래핑
- **해결 시점**: **Pre-Phase-1 스프린트**

### C-04. IndexedDB에 topic_clusters 테이블 누락

- **출처**: Architect
- **파일**: `apps/web/src/lib/db.ts` (누락), `migrations/0002_1st_exam_extension.sql:80-96` (정의됨)
- **증거**: Dexie 스키마에 topicClusters 스토어 미정의
- **영향**: D1->IndexedDB 동기화 시 topic_clusters 데이터 소실 (무음 실패)
- **해결 시점**: **Pre-Phase-1 스프린트**

### C-05. Drizzle .notNull() vs SQL NOT NULL 불일치

- **출처**: Architect
- **파일**: `migrations/0001_initial_schema.sql:26` vs `apps/api/src/db/schema.ts:46`
- **증거**: SQL에서 status, created_at, updated_at은 NOT NULL 미지정 + DEFAULT만 있음. Drizzle는 .notNull() 선언
- **영향**: 원시 SQL 삽입 시 NULL 허용 -> Drizzle 읽기 시 타입 오류
- **수정**: SQL에 NOT NULL 추가 (마이그레이션 0003)
- **해결 시점**: **Pre-Phase-1 스프린트** (DB 스키마 변경 -> L3)

### C-06. parser 패키지 Node.js API 재수출 - Workers 번들링 위험

- **출처**: Architect
- **파일**: `packages/parser/src/index.ts:1-6`, `packages/parser/src/pdf-extractor.ts`
- **증거**: `node:child_process`, `node:path` import가 index.ts에서 재수출. Workers 대상 빌드에서 전체 모듈 그래프 포함
- **영향**: 현재 apps/api는 parser 미사용이라 즉시 문제 없음. 향후 Workers에서 parser 사용 시 빌드 실패
- **수정**: package.json `exports` 필드로 Workers-safe / Node-only 진입점 분리
- **해결 시점**: Phase 1 파이프라인 스프린트

---

## MAJOR 발견 사항 (18건, 중복 제거)

### 코드 정합성 (Surgeon)

| #    | 파일                                         | 설명                                                          | 해결 시점       |
| ---- | -------------------------------------------- | ------------------------------------------------------------- | --------------- |
| M-01 | `parser/src/batch-processor.ts:265`          | JSON 코드블록 regex가 언어 태그 없는 fence 미매칭             | Phase 1         |
| M-02 | `parser/src/section-splitter.ts:144-145`     | endPage가 다음 섹션 시작 페이지로 설정 -> 페이지 참조 부정확  | Phase 1         |
| M-03 | `formula-engine/src/formulas/index.ts:12-43` | 모듈 로드 시 throw -> Workers 전체 크래시                     | Pre-Phase-1     |
| M-04 | `web/src/components/OfflineIndicator.tsx:7`  | 초기 상태 true 하드코딩 -> 오프라인 첫 로드 시 표시 안됨      | Phase 1         |
| M-05 | `quality/src/graph-integrity.ts:158-169`     | DFS 순환 감지 visited 마킹 순서 오류 -> 다중 경로 순환 미탐지 | **Pre-Phase-1** |
| M-06 | `web/src/stores/progress.ts:44-48`           | catch에서 console.error 없음 -> CRITICAL RULE #3 위반         | Pre-Phase-1     |

### 아키텍처 (Architect)

| #    | 설명                                                                                              | 해결 시점   |
| ---- | ------------------------------------------------------------------------------------------------- | ----------- |
| M-07 | IndexedDB IKnowledgeNode에 batchId 누락                                                           | Pre-Phase-1 |
| M-08 | IndexedDB IFormula에 constraints/expectedInputs/gracefulDegradation/supersededBy 4필드 누락       | Pre-Phase-1 |
| M-09 | IndexedDB IConstant에 insuranceType/confusionRisk/pageRef/examFrequency/relatedFormula 5필드 누락 | Pre-Phase-1 |
| M-10 | IndexedDB IExamQuestion에 explanation/validFrom/validUntil 등 7필드 누락                          | Pre-Phase-1 |
| M-11 | SQL edge_type에 CHECK 제약 없음 -> 원시 SQL로 잘못된 타입 삽입 가능                               | Phase 1     |
| M-12 | CardType 유니온 타입 shared/types.ts에 미정의                                                     | Phase 1     |

### 보안+도메인 (Security)

| #    | 파일                                     | 설명                                                | 해결 시점    |
| ---- | ---------------------------------------- | --------------------------------------------------- | ------------ |
| M-13 | `formula-engine/src/ast-parser.ts:41,64` | 캐시 키가 원시 문자열 + clear() 전량 삭제 전략      | Phase 1      |
| M-14 | `formulas/batch1-definitions.ts:17-48`   | F-01/F-02 분모=0 입력 가능 (constraints 미방지)     | Phase 1      |
| M-15 | `formulas/batch1-definitions.ts:112-153` | F-06/F-07 음수 결과 max(0) 미적용 -> 교재 확인 필요 | 교재 확인 후 |

### 설계서 대조 (Contract)

| #    | 설명                                                   | 판정         | 해결 시점   |
| ---- | ------------------------------------------------------ | ------------ | ----------- |
| M-16 | OfflineIndicator.tsx 한국어 하드코딩 -> i18n 키 미사용 | Silent Pivot | Pre-Phase-1 |
| M-17 | ContentQueue.tsx STATUS_LABELS 한국어 하드코딩         | Silent Pivot | Phase 1     |
| M-18 | apps/batch/ 디렉토리 구조 spec과 다름 (jobs/ vs src/)  | Silent Pivot | 문서화      |

---

## MINOR 발견 사항 (11건 요약)

1. batch-processor.ts 모델 ID `claude-haiku-4-5-20251001` 형식 확인 필요
2. i18n getInitialLocale() 미사용 -> localStorage 저장만 하고 복원 안 함
3. GraphVisualizer.tsx `as any` 캐스트 (D3 타이핑 호환성)
4. IndexedDB 전 테이블 created_at/updated_at 미포함
5. modules/ 빈 셸 (Phase 1+ 의도적 스캐폴딩)
6. pnpm-workspace에 modules/\* 포함되나 의존 패키지 없음
7. AccessNode 차단 테스트 케이스 미작성 (safeParse('a.b'))
8. API에 CORS/rate-limit/auth 미들웨어 없음 (Phase 1 구현 예정)
9. F-12 remaining_days 상한 없음
10. Ontology registry에 edge ID 패턴 미정의
11. 파일명 db.ts vs spec의 local-db.ts (경미한 명명 차이)

---

## 기술부채 카탈로그 (26건)

### HIGH (7건)

| 항목                                  | Phase 1 차단 |
| ------------------------------------- | ------------ |
| C3 Temporal Graph UPDATE TRIGGER 없음 | **YES**      |
| sw.js syncOfflineActions() 미구현     | no           |
| study-material-generator 빈 패키지    | no           |
| modules/ 3개 빈 셸                    | no           |
| submitRating 스텁                     | no           |
| math.js 800KB 번들 (create(all))      | no           |
| 13x safeParse 모듈 로드 시 cold start | no           |

### MEDIUM (13건)

GraphVisualizer any 캐스트, OfflineIndicator 한국어, ContentQueue 한국어, IndexedDB 타입 수동 정의 (Drizzle 미파생), D1-IndexedDB 필드 불일치, admin-web React Islands 미마운트, roundTo 대금액 정밀도, ConstantsProvider sync->async 전환, F-11 0.05 하드코딩, supersededBy 이중 추적, batch re-prompt 미자동화, i18n 유틸 중복 로직, 프론트엔드 테스트 커버리지 부재

### LOW (6건)

모델 ID 경직성, 캐시 eviction 전략, icon-192.png 참조 미확인, section-splitter subitem 미도달 코드, 기타

---

## 미해결 항목 20건 재정렬

| #    | 항목                          | 이전 등급 | **신규 등급** | 해결 시점         |
| ---- | ----------------------------- | --------- | ------------- | ----------------- |
| C3   | Temporal Graph UPDATE TRIGGER | Critical  | **Critical**  | **Pre-Phase-1**   |
| Q1   | Golden test 교재 실데이터     | Major     | **Critical**  | **Pre-Phase-1**   |
| M2   | IndexedDB 타입 Drizzle 파생   | Major     | Major         | Pre-Phase-1 권장  |
| M4   | user_progress 접근제어        | Major     | Major         | Phase 1 API       |
| M5   | submitRating rating 저장      | Major     | Major         | Phase 1 FSRS      |
| M6   | D1-IndexedDB 필드 누락        | Major     | Major         | Pre-Phase-1 권장  |
| M8   | 배치 순서 강제                | Major     | Major         | Phase 1           |
| D2   | Knowledge Contract 필드       | Major     | Major         | Phase 1 db-loader |
| FE-2 | F-13 6% 해석                  | Major     | Major         | 교재 확인         |
| FE-7 | F-11 0.05 하드코딩            | Major     | Major         | Pre-Phase-1 권장  |
| A1   | ConstantsProvider async 전환  | Major     | Major         | Phase 1 D1        |
| P1   | math.js 800KB 번들            | Major     | Major         | Pre-Workers       |
| M7   | truth_weight 자동 적용        | Major     | **Minor**     | Phase 1           |
| D1   | 배치 프로세서 재프롬프트      | Major     | **Minor**     | Phase 1           |
| FE-6 | max(x,0) 교재 검증            | Major     | **Minor**     | 교재 확인         |
| FE-8 | supersededBy 이중 추적        | Major     | **Minor**     | 설계 결정         |
| A2   | roundTo 대금액 정밀도         | Major     | **Low**       | 문서화            |
| P2   | safeParse cold start          | Major     | **Minor**     | Pre-Workers       |
| U1   | React Islands 미마운트        | Important | Important     | 데이터 적재 후    |
| U2   | flagged 복구 경로 없음        | Important | Important     | Phase 2           |

---

## Hard Rules 준수 매트릭스

| #   | 규칙                                 | 상태                                            |
| --- | ------------------------------------ | ----------------------------------------------- |
| 1   | .env 커밋 금지                       | PASS                                            |
| 2   | Guide/ 수정 금지                     | N/A                                             |
| 3   | knowledge_nodes/formulas UPDATE 금지 | PASS (코드 내 UPDATE 0건, 단 DB TRIGGER 미설치) |
| 4   | LLM 수식 계산 금지                   | PASS                                            |
| 5   | 동적 코드 실행 금지                  | PASS                                            |
| 6   | Constants DB 쿼리로만                | PASS (설계상)                                   |
| 7   | Ontology Lock                        | PASS                                            |
| 8   | AI 데이터 draft로만                  | PASS                                            |
| 9   | BATCH 순차 실행                      | PASS (설계상)                                   |
| 10  | 농학 미출제 라벨링                   | PASS (스키마)                                   |
| 11  | shared 노드 양쪽 검토                | N/A                                             |
| 12  | 암기법 역방향 검증                   | PASS (스키마)                                   |
| 13  | i18n 하드코딩 금지                   | **FAIL** (OfflineIndicator, ContentQueue)       |

---

## 검증 완료 확인 (전문가 합의)

1. **Formula Engine 보안 아키텍처**: sandbox.ts의 AST 화이트리스트(5종), 함수 오버라이드(12개), 심볼 정규식+차단 목록, 표현식 길이 제한 - 모두 정상 동작 확인
2. **Ontology Registry 정합성**: JSON의 node/edge/formula/constant 패턴 <-> shared/types.ts <-> Drizzle 스키마 - 전수 일치
3. **의존성 방향**: 모든 화살표 단방향 (apps->packages->shared), 순환 참조 0건
4. **Division-by-zero 가드**: constants-extractor.ts의 분모 0 체크, formula-engine의 런타임 에러 처리 정상
5. **innerHTML/XSS**: 애플리케이션 코드 전체에서 innerHTML/dangerouslySetInnerHTML 사용 0건
6. **API 키 노출**: 소스 코드 내 하드코딩된 시크릿 0건

---

## Phase 1 진입 판정

### 판정: READY WITH CONDITIONS

### 차단 항목 (2건 - 반드시 해결 후 진입)

1. **C3 - Temporal Graph UPDATE TRIGGER** (effort: S)
   - knowledge_nodes, formulas 테이블에 BEFORE UPDATE 트리거 추가
   - 10줄 SQL 마이그레이션 - L3 경로 (plan + 승인 필요)

2. **Q1 - Golden Test 교재 실데이터** (effort: 교재 접근 의존)
   - QG-2 게이트 미충족. 설계서 명시: "QG-2 통과 후 Phase 1 시작"
   - 최소 1개 교재 실수치로 F-01~F-13 정확도 100% 검증 필요

### 권장 사전 스프린트 (4건)

3. **C-02 safeEvaluate scope 검증** - Object.create(null) + 키 검증 (L3)
4. **C-05 SQL NOT NULL 정렬** - 마이그레이션 0003 (L3)
5. **M-07~M-10 IndexedDB 필드 동기화** - db.ts에 누락 필드 24개 추가
6. **M-05 graph-integrity DFS 순환 감지 버그** - visited 마킹 순서 수정

### Phase 1 진입 시 해결

- D1-IndexedDB 타입 Drizzle 파생 (M2)
- ConstantsProvider async 전환 (A1)
- 배치 순서 강제 메커니즘 (M8)
- math.js 번들 최적화 (P1)
- OfflineIndicator/ContentQueue i18n 적용 (M-16, M-17)

---

## 의존성 그래프

```
@thepick/shared (leaf - no workspace deps)
  ^
  |--- @thepick/parser (depends: shared)
  |       ^
  |       |--- @thepick/parser-1st-exam (depends: shared, parser)
  |
  |--- @thepick/formula-engine (depends: shared, mathjs)
  |
  |--- @thepick/quality (depends: shared)
  |
  |--- @thepick/study-material-generator (depends: shared) [EMPTY]
  |
  |--- @thepick/api (depends: shared, hono, drizzle-orm, zod)
  |--- @thepick/web (depends: shared, astro, react, zustand, dexie)
  |--- @thepick/admin-web (depends: shared, astro, react, d3)
  |--- @thepick/batch (depends: shared, parser, formula-engine, quality)
```

순환 참조: **0건**
방향 위반: **0건**

---

## 리뷰 방법 투명성

| 전문가          | 역할                     | 에이전트 유형             | 도구 호출 |
| --------------- | ------------------------ | ------------------------- | --------- |
| Surgeon         | 코드 정합성 (Bottom-Up)  | feature-dev:code-reviewer | 51        |
| Architect       | 의존성+스키마 (Top-Down) | system-architect          | 86        |
| Security+Domain | 보안+도메인 정확성       | security-engineer         | 33        |
| Contract        | 설계서 대조              | quality-engineer          | 74        |
| Quality+Debt    | 기술부채+Phase 1 판정    | performance-engineer      | 74        |

총 도구 호출: 318회

---

## 수정 이력

### 2026-04-13: 감사 후 수정 6건 + 리뷰 CRITICAL 수정 3건

**수정 완료 (6건)**:

1. C3+C-05: `migrations/0003_temporal_guard_not_null.sql` 신규 — UPDATE TRIGGER + NOT NULL TRIGGER
2. C-02: `sandbox.ts` — safeEvaluate scope 키 검증 (BLOCKED_SYMBOL_NAMES + SAFE_SYMBOL_PATTERN)
3. C-03: `apps/api/src/index.ts` — FK PRAGMA 실패 시 500 반환 (요청 진행 차단)
4. C-04+M-07~10: `apps/web/src/lib/db.ts` — topicClusters 추가 + 누락 필드 24개 + Dexie v1→v2 마이그레이션
5. M-06: `apps/web/src/stores/progress.ts` — console.error 추가

**4-Pass 리뷰 CRITICAL 수정 (3건)**:

1. FK PRAGMA catch에서 요청 진행 → 500 반환으로 변경
2. IUserProgress.createdAt 추가
3. Dexie version(1) 스키마 유지 + version(2) 증분 추가

**검증**: typecheck 13/13, tests 217/217, lint 통과 (parser no-console은 기존)
**M-05 DFS 오탐**: Surgeon이 보고한 graph-integrity 순환 감지 버그는 표준 visited+inStack DFS 패턴으로 정상 동작 확인

**미해결 (이 세션에서 해결 불가)**:

- Q1: Golden Test 교재 실데이터 — 물리 교재 필요
- C-06: parser Node.js API 재수출 분리 — Phase 1 파이프라인 시 처리
