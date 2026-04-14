# Session Handoff — 2026-04-12 (Session 2)

## 완료된 작업

### Step 0-1: 모노레포 초기화 + 개발 환경 (DONE — Session 1)

- 루트 설정, apps/ 4개, packages/ 6개, modules/ 3개
- Husky pre-commit hook, pnpm lint/typecheck 13/13 통과

### Step 0-2: DB 스키마 마이그레이션 (DONE — L3 plan 승인 후 실행)

- `migrations/0001_initial_schema.sql` — 기본 6개 테이블 + PRAGMA foreign_keys = ON
- `migrations/0002_1st_exam_extension.sql` — ALTER 3건 + 신규 3개 테이블 (mnemonic_cards, user_progress, topic_clusters)
- `apps/api/src/db/schema.ts` — Drizzle ORM 9개 테이블, **enum 옵션 12개 컬럼** 적용 (타입 안전성 확보)
- `apps/api/src/index.ts` — Hono 미들웨어 `PRAGMA foreign_keys = ON` per-connection 강제
- 정합성 이슈 4건 해결 (ConfusionLevel safe, ContentStatus flagged, subject ALTER 중복, English 값 통일)

### Step 0-3: PWA 셸 + IndexedDB 초기화 (DONE)

- `apps/web/public/manifest.json` + `sw.js` (4종 캐싱) + placeholder 아이콘
- `src/layouts/BaseLayout.astro` (반응형 셸 + SW 등록)
- `src/lib/db.ts` — Dexie.js 8개 store
- `src/stores/` — Zustand 3개 (session, progress, ui)
- `src/i18n/` — 타입 안전 다국어 (types, context, hook, locales ko/en, utils)
- `src/components/OfflineIndicator.tsx`, `ErrorDisplay.tsx`

### Step 0-4: M01 PDF 텍스트 추출기 (DONE)

- `packages/parser/scripts/extract_pdf.py` — pdfplumber 페이지별 텍스트+표 → JSON
- `packages/parser/src/pdf-extractor.ts` — child_process 래퍼 (pages 검증, ENOENT 친절 메시지, stderr 로깅)
- Python venv: `packages/parser/.venv/` (pdfplumber 설치됨)

### Step 0-5: M03 기출문제 파서 → QG-1 (DONE)

- `packages/parser-1st-exam/src/exam-question-parser.ts` — 1차 기출 파서
- `packages/parser-1st-exam/src/types.ts` — ParsedQuestion, ExamMetadata, 과목 패턴
- 4개 연도 (2019/2023/2024/2025) × 75문항 = 300문항 파싱 통과, 보기 누락 0건
- QG-1 정답 대조: `applyAnswers()` → questionNumber 기반 Record 매핑 (정답 데이터 별도 확보 필요)

### Step 0-7: M06 섹션 분리기 (DONE)

- `packages/parser/src/section-splitter.ts` — 교재 텍스트 → 계층 섹션 트리 (chapter/section/subsection/item)
- `packages/parser/src/table-extractor.ts` — 표 → 구조화 JSON (headers + rows)
- BATCH 1 (p.403-434) 검증: 21개 섹션, 7개 표 정상 추출

### 전문가 리뷰 수정 (5개 페르소나 × Critical/Major 수정)

- **C1+C2**: sw.js — SYNC_COMPLETE 거짓말 제거, 3개 캐싱 전략 catch 로깅, PII NetworkOnly 전환
- **C5+C6+C7**: 파서 — footer 필터, 비연속 번호 tolerance±3, applyAnswers questionNumber 기반, 2차 시험 거부, 보기<4 경고
- **C8**: pdf-extractor — pythonPath 외부 주입 제거, pages 정규식 검증, stderr 로깅
- **C9**: PRAGMA foreign_keys = ON (migration + Hono middleware)
- **M1**: Drizzle text() → enum 옵션 12개 컬럼

## 다음 작업

### Step 0-8: M08 Ontology Registry + Schema Validator (L3)

- **DEFCON L3** — plan 작성 → 인간 승인 → 코딩
- `packages/parser/src/ontology-registry.json` — BATCH 1 범위 허용 ID 목록
- `packages/parser/src/schema-validator.ts` — 미등록 ID → 거부 + 재수행
- Critical C4 해결 항목 (현재 ontology-registry.json 파일 자체가 미존재)
- 검증: 미등록 ID → 거부, 등록된 ID → 통과

### 이후 크리티컬 패스

```
Step 0-8 (Ontology) ──┐
                       ├──→ Step 0-9 (배치 프로세서)
Step 0-7 ✅ ──────────┘        └──→ Step 0-10 (Constants)
                                        └──→ Step 0-11 (Formula PoC [L3])
```

### 병렬 가능 (0-8과 독립)

- Step 0-6 (법령 수집기) — L2, Phase 1에서 사용

## 미해결 리뷰 항목 (다음 Step/Phase에서 해결)

| #   | 항목                           | 등급     | 해결 시점                                |
| --- | ------------------------------ | -------- | ---------------------------------------- |
| C3  | Temporal Graph UPDATE TRIGGER  | Critical | DB 스키마 변경 L3 — 0-8과 함께 또는 별도 |
| M2  | IndexedDB 타입 Drizzle 파생    | Major    | Phase 0 내                               |
| M4  | user_progress 행 수준 접근제어 | Major    | API 구현 시                              |
| M5  | submitRating rating 값 저장    | Major    | Step 1-10 (FSRS)                         |
| M6  | D1↔IndexedDB 필드 누락         | Major    | Phase 0 내                               |
| M7  | truth_weight 타입별 자동 적용  | Major    | 파이프라인 구현 시                       |
| M8  | 배치 순서 강제 메커니즘        | Major    | batch_status 테이블 L3                   |

## 핵심 문서 위치

- 설계서: `docs/쪽집게(ThePick) — 구현 설계서 및 개발 로드맵.md`
- 재정립서: `docs/쪽집게(ThePick) — 구현 재정립서 v2.0.md`
- 아키텍처: `docs/architecture/ARCHITECTURE.md`
- 프로젝트 규칙: `CLAUDE.md`
- 4-Pass 리뷰: `.claude/rules/auto-review-protocol.md`

## 주의 사항

- Step 0-8은 L3 → plan 없이 코드 수정 시 protect-l3.sh Hook이 차단
- ontology-registry.json도 L3 → 허용 ID 체계 결정이 전체 데이터에 영향
- 아직 git commit 없음 (Step 0-1 이후 한번도 커밋 안 됨)
- pnpm typecheck 13/13, pnpm lint 13/13 통과 상태
