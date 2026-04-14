# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 정의

**쪽집게(ThePick)** — 손해평가사 자격시험(1차+2차) AI 학습 서비스

- Graph RAG 기반 교재 835쪽 + 기출 825문항 구조화
- 룰 엔진 산식 연산 + 혼동 유형 자동 감지 + FSRS 간격반복

## 스택

- Frontend: Astro + React Islands + Tailwind CSS + shadcn/ui (PWA)
- State: Zustand + IndexedDB (Dexie.js) 오프라인 동기화
- Backend: Cloudflare Workers + Hono (Edge)
- ORM: Drizzle ORM (D1 네이티브)
- DB: Cloudflare D1 (9개 테이블) + Vectorize (벡터 검색)
- AI: Claude API (Haiku 배치 구조화 + Vision OCR)
- Formula Engine: math.js AST 파서
- PDF: pdfplumber (Python subprocess)
- Test: Vitest + Playwright
- Lint: ESLint + Prettier + husky (lint-staged)
- 시각화: D3.js Force Graph

## 명령어

```
# build: (Astro 프로젝트 초기화 후 확정)
# test:  (Vitest 도입 후 확정)
# lint:  (ESLint + Prettier 도입 후 확정)
# dev:   (확정 후 업데이트)
```

## 아키텍처

3계층 데이터: 정밀(constants DB) → 구조(Graph nodes/edges) → 맥락(Vectorize 임베딩)
7 Layer × 28 모듈: 수집(5) → 구조화(6) → 품질검증(3) → Core엔진(5) → 생성(5) → 학습서비스(3) → 관리자(1)
모노레포: apps/(web PWA, admin-web, api Workers, batch) + packages/(parser, parser-1st-exam, formula-engine, study-material-generator, quality)
상세: `docs/쪽집게(ThePick) — 구현 재정립서 v2.0.md` 참조
구현: `docs/쪽집게(ThePick) — 구현 설계서 및 개발 로드맵.md` 참조
아키텍처 다이어그램: `docs/architecture/ARCHITECTURE.md` 참조 (Mermaid DaC — 시스템 조감도, 데이터 흐름, 의존관계, 배치 파이프라인, 오프라인 동기화, Hexagonal 규칙)

## Hard Limit (절대 제약)

- `.env*` 파일 커밋 금지
- Guide/ 디렉토리 수정 금지 (하네스 원본 문서)
- knowledge_nodes, formulas 테이블 UPDATE 금지 (개정 시 신규 노드 + SUPERSEDES 엣지)
- LLM에게 수식 계산 절대 금지 (Formula Engine AST 파서로만)
- 동적 코드 실행 금지 (equation_template 포함)
- Constants는 DB 쿼리로만 조회 (LLM 추론 금지)
- Ontology Lock: ontology-registry.json 외 ID 생성 금지
- AI 생성 데이터는 draft 상태로만 적재 (인간 검수 후 approved)
- BATCH 순차 실행 (전 배치 검증 없이 다음 배치 금지)
- 농학 미출제 영역 명시적 라벨링 필수
- shared 노드 수정 시 1차/2차 양쪽 검토
- 암기법 역방향 검증 실패 시 폐기 (두문자어→원래 항목 복원)

## L3 영역 (plan 필수 + 인간 승인 후 코딩)

- `packages/formula-engine/` — 산식 연산 (계산 오류 = 서비스 사망)
- `**/constants*` — 매직 넘버 (65%를 60%로 잘못 입력 = 서비스 사망)
- `**/ontology-registry*` — 허용 ID 목록
- DB 스키마 변경 (마이그레이션)
- 사용자 데이터 처리 (user_progress)

## 린터 강제 사항

(ESLint + Prettier 도입 시 업데이트)

## 현재 상태

- VOID DEV HARNESS 설정 완료 (Session Monitor + 4-Pass Auto Review 포함)
- 기획 문서 9종 분석 → 구현 재정립서 v2.0 작성 완료 (프론트엔드/PWA/확장성 포함)
- 기획 원본 문서는 `docs/plans/`로 이동
- Phase 0 착수 대기 (DB 스키마 + PWA 셸부터)

## 최근 실수

- 2026-04-12: ARCHITECTURE.md + 구현 설계서 작성 후 4-Pass 자동 리뷰를 실행하지 않음. 사용자 지적 후 셀프 점검에서 7건 발견(IndexedDB≠D1 혼동, 배치 흐름 순서 오류 등). → review-reminder.sh Stop Hook 추가로 재발 방지
- 2026-04-12: 세션 모니터 Hook이 4시간 동안 경고를 주지 않음. 원인: stderr 출력이 사용자에게 안 보임 + 대화 중간 점검 메커니즘 부재. → stdout 출력 + exit 2 + session-health.md 규칙 추가
- 2026-04-12: 4-Pass 자가 리뷰에서 0건 보고 → 독립 다각도 리뷰에서 CRITICAL 9건 + MAJOR 10건 발견. 원인 5가지: (1) 자기 확인 편향 — 코드 작성자=리뷰어라 의도를 기억하고 문제를 못 봄, (2) 스코프 축소 — 변경 파일만 검사하고 연관 파일 무시, (3) N/A=통과 착각, (4) 분석 깊이 부족 — 테스트 통과에 안심, (5) 독립성 제로. → 대책: 독립 에이전트 리뷰 의무화 + 증거 기반 보고 + 반론 의무 + auto-review-protocol.md 전면 개정
