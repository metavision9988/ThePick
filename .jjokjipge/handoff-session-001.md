# Session Handoff — 2026-04-12

## 완료된 작업

### Step 0-1: 모노레포 초기화 + 개발 환경 (DONE)

- 루트 설정: package.json, pnpm-workspace.yaml, turbo.json, tsconfig.base.json, .eslintrc.json, .prettierrc, .gitignore, .env.example
- apps/ 4개: web(Astro+React), api(Workers+Hono), admin-web, batch
- packages/ 6개: shared, parser, parser-1st-exam, formula-engine, study-material-generator, quality
- modules/ 3개: content, learning, exam (Hexagonal: domain/application/infrastructure)
- packages/shared/src/errors.ts: AppError, ErrorCode, ok(), gracefulDegradation()
- packages/shared/src/types.ts: NodeType(7), EdgeType(13), TRUTH_WEIGHTS, ConfusionType(8), FSRSState
- .jjokjipge/ 세션 추적 초기화
- Husky pre-commit hook (pnpm lint-staged)
- pnpm lint: 13/13 통과
- pnpm typecheck: 13/13 통과

## 다음 작업

### Step 0-2: DB 스키마 마이그레이션 (L3)

- DEFCON L3 — plan 작성 → 인간 승인 → 코딩
- D1 9개 테이블 생성 (기본 6 + 확장 3)
- Drizzle ORM 스키마 정의
- 기존 프로젝트 참조: /home/soo/ThePick/apps/api/src/db/schema.ts (Drizzle 패턴)
- 새 스키마는 Graph RAG 기반 (knowledge_nodes, knowledge_edges, formulas, constants 등)
- migrations/0001_initial_schema.sql, 0002_1st_exam_extension.sql

## 핵심 문서 위치

- 설계서: docs/쪽집게(ThePick) — 구현 설계서 및 개발 로드맵.md
- 재정립서: docs/쪽집게(ThePick) — 구현 재정립서 v2.0.md
- 아키텍처: docs/architecture/ARCHITECTURE.md
- 프로젝트 규칙: CLAUDE.md
- 4-Pass 리뷰: .claude/rules/auto-review-protocol.md
- 세션 상태: .jjokjipge/state.json

## 주의 사항

- Step 0-2는 L3 → plan 없이 코드 수정 시 protect-l3.sh Hook이 차단
- 기존 ThePick DB 스키마는 15개 테이블이지만 새 프로젝트는 9개 테이블 (구조 완전히 다름, Drizzle 패턴만 참조)
- ontology-registry.json도 L3 → Step 0-8에서 plan 필수
- 아직 git commit 없음 (Step 0-1 완료 후 커밋 필요)

## 긴급 이슈: 세션 모니터 Hook 출력 문제

- Stop Hook의 stdout/stderr 출력이 사용자에게 보이지 않을 수 있음
- 해결 방향: Hook이 파일(`/tmp/claude-session-warning.txt`)에 경고를 쓰고, `.claude/rules/session-health.md`에서 AI가 그 파일을 읽도록 전환
- 새 세션 시작 시 이 문제 먼저 확인 + 수정
