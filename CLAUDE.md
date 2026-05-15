# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 정의

**쪽집게(ThePick)** — 손해평가사 자격시험(1차+2차) AI 학습 서비스

- Graph RAG 기반 교재 835쪽 + 기출 ~581문항(7회분, 제5~11회) 구조화
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

## 상용 품질 원칙 (★ 최우선)

이 서비스는 상용 출시를 목표한다. "당장 돌아가는 코드"가 아닌 "10K 유저, 매년 개정, 다른 시험 확장에서도 버티는 코드"를 작성한다.

- any 타입 금지 → 정확한 타입/제네릭
- 하드코딩 금지 → Constants DB 또는 명명된 상수
- 인메모리 임시 저장 금지 → D1/IndexedDB 영구 경로
- TODO/HACK 주석 금지 → 즉시 구현 or 기획 보고
- 빈 catch 금지 → 에러 로깅 + 전파/폴백
- `import *` 금지 → 선택적 임포트 (번들 최적화)
- 테스트 없이 완료 금지 → Golden Test 포함
- 상세: `.claude/rules/production-quality.md`
- Hook: `quality-gate.sh`가 any/console.log/빈catch/TODO 자동 감지

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

## 현재 상태 (2026-05-15 기준 — 3축 분리)

> ⚠️ 본 섹션은 2026-04-16~2026-05-15 약 1개월 stale였고, 그 사이 G-AUDIT 외부 검토
> 체인의 거짓 전제 2건(CRIT-2/3)을 유발한 단일 오염원이었다. 갱신 경위·검증:
> `docs/Graph_RAG+Graph_Walk/REMEDIATION 타당성 검증 — Claude Code 실코드 대조 v1.0.md`.
> **이 섹션은 handoff/WBS 갱신 시 동기 의무 (오염 재발 방지).**

- **인프라 축**: Phase 3 launch chain — production 배포 완료. production D1
  마이그레이션 0001~0037 적용(`.claude/reports/production-migration-status.md`),
  Worker 배포, 인증/login_history smoke PASS, ADR-034/035/036 retrofit.
- **콘텐츠 축**: BATCH-1~7 + L1/L2(법령) + R1/R2(개정) **production 적재 완료**
  (Session 041~045). 누적 ≈ knowledge_nodes 794 / knowledge_edges ~1274 /
  formulas 157 / constants 193 / exam_questions 545.
  - 출처: `docs/plans/batch-loadmap.md:41~78,148` per-BATCH "production 적재 완료"
    기록 + 산술 검산(75+118+84+123+98+70+20+84+65+24+26+6+1=794) + handoff
    066/068/069 3건 교차확인. 전부 status='draft' 강제 적재(인간 검수 전).
  - ⚠️ **라이브 D1 count 미실행**(Cloudflare 인증=진산 통제 자격증명).
    `wrangler d1 execute thepick-db-production --remote "SELECT COUNT(*)..."`
    1회 직접 실행 후 본 수치 확정은 후속 권고(REMEDIATION 검증 §2.2 W2).
- **실 평가 축 (미완)**: Phase 2 Eval MVP baseline·검색 품질·multi-hop 정답률
  **미측정**. Graph walk **미구현** — knowledge_edges ~1274 적재됐으나 런타임
  검색 경로가 엣지를 순회하지 않음(단일 노드 벡터 조회 + Truth Weight 재정렬).
  현 시점 사실상 Vector RAG. ★ 진짜 핵심 잔여 위험(REMEDIATION 검증 CRIT-4).
- **다음 진입 조건**: 진산 결재 5건 처리 중 — 결재-2(본 갱신) 완료. 잔여
  결재-3(Graph walk T1, L3 plan 선행)·4(REMEDIATION 처리계획)·5(Pattern A ADR).

## 최근 실수

- 2026-04-12: ARCHITECTURE.md + 구현 설계서 작성 후 4-Pass 자동 리뷰를 실행하지 않음. 사용자 지적 후 셀프 점검에서 7건 발견(IndexedDB≠D1 혼동, 배치 흐름 순서 오류 등). → review-reminder.sh Stop Hook 추가로 재발 방지
- 2026-04-12: 세션 모니터 Hook이 4시간 동안 경고를 주지 않음. 원인: stderr 출력이 사용자에게 안 보임 + 대화 중간 점검 메커니즘 부재. → stdout 출력 + exit 2 + session-health.md 규칙 추가
- 2026-04-12: 4-Pass 자가 리뷰에서 0건 보고 → 독립 다각도 리뷰에서 CRITICAL 9건 + MAJOR 10건 발견. 원인 5가지: (1) 자기 확인 편향 — 코드 작성자=리뷰어라 의도를 기억하고 문제를 못 봄, (2) 스코프 축소 — 변경 파일만 검사하고 연관 파일 무시, (3) N/A=통과 착각, (4) 분석 깊이 부족 — 테스트 통과에 안심, (5) 독립성 제로. → 대책: 독립 에이전트 리뷰 의무화 + 증거 기반 보고 + 반론 의무 + auto-review-protocol.md 전면 개정
- 2026-05-15: G-AUDIT 외부 감사 보고서 §12 핵심정정 #2에서 "knowledge_nodes 미적재 / vectorCount=topic_cluster·smoke"로 단정 → 사실은 BATCH-1~7 production 적재 완료(794 노드). 원인: stale한 본 CLAUDE.md "현재 상태"(Phase 0)만 신뢰하고 `docs/plans/batch-loadmap.md`를 미열람(스코프 축소). 이 1차 환각이 외부 Review B+C(코드 미열람)→REMEDIATION CRIT-2/3로 5-Layer 연쇄 증폭. 차단: 진산이 처리계획 진입 전 "타당성 검증" 게이트 지시 → Claude Code 실코드 대조로 거짓 전제 발견. → 대책: (1) "현재 상태" 섹션을 handoff/WBS 갱신 시 동기 의무화, (2) 외부 SPDP 결과는 실코드 대조 Cycle-Closure로 닫는 패턴 영속(REMEDIATION 검증 §4 메타교훈), (3) 루트 문서 stale = 모든 하위 작업 진앙 — 30일+ 미갱신 감지 시 환기
