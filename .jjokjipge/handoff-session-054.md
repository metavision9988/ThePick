# Session 054 핸드오프 — ThePick (쪽집게, 손해평가사 자격시험 AI 학습 서비스)

> **본 세션(047) 종착**: 2차 시험 진입 + BATCH-Q-2025-11-2ND 적재 완료
> **누적**: 545 exam_questions (1차 525 + 2차 20)
> **다음 세션(054)** 입장 시 본 파일을 가장 먼저 읽고 verify 진입 → 단계 1B 진행

## 브랜치 & 컨텍스트

- 브랜치: main
- 마지막 커밋: 93f3be0 (Session 046 종착, Engine Quality Test 완료 보고서)
- 미커밋 변경: 5 modified (이전 세션 carry-over) + untracked 본 세션(047) 추가 5+ 파일

## 본 세션(047)에서 한 일

### A. 진산 4건 검토 + 전략 plan 영속화 (Q1~Q4)

- `docs/plans/2nd-exam-and-engine-validation-strategy.md` 신규 작성 — 단계 1~5 권장 실행 순서
- **Reality Anchor 적용 결과**:
  - Q1 (2차 11회 적재): ✅ 즉시 가능
  - Q2 (학습자료 22종): ⚠️ 단계적 가능 (5 카테고리 우선순위)
  - Q3 (Self-Test 시뮬레이션): ❌ 원안 불가 (3 이유) → ✅ "Engine RAG 신뢰성 검증"으로 재정의
  - Q4 (2차 모의고사 자동 출제 — 진산 "프로젝트 핵심"): ⚠️ 즉시 X, 6 조건 충족 시 Phase 2 가능

### B. ★ BATCH-Q-2025-11-2ND 적재 완료 (Q1)

- 진산 자료: `docs/manual/2차시험정답지/25년_11회_기출문제및해설.pdf` (30p, 557KB)
- PyMuPDF 텍스트 추출 (1차 이미지형과 다름) → 20문항 100% 추출
- ID 패턴: `Q-2025-11-2ND-001~020` (D-Q1-1 채택)
- exam_type='2nd' / subject='1과목 (이론)' (Q1~10) / '2과목 (손해평가)' (Q11~20) / D-Q1-5 권장 단순 매핑 채택
- D-Q1-4 raw 통째 → content (answer/explanation NULL, 추후 정제) 채택
- 점수 분포: 1과목 5점×5 + 15점×5 + 2과목 동일 = 200점 (5점 단답형 10건 + 15점 풀이형 10건)

### C. ★ 특수문자 cleanup + flagged 분류 (진산 피드백 반영)

- 진산 발화: "숫자/영어/한국어/○※ 외 안 됨"
- **U+0001 (515개) + Private Use Area E000~F8FF (~280개)** = PDF 폰트 임베딩으로 분수/수식 위치에 들어간 깨진 글리프
- 단순 제거 시 "14× = 6주" 같은 수식 손실 → cleanup + 깨진 문자 1+ 발견 문항 = `status='flagged'`
- **status 분포**: 9 active (Q1/2/3/4/5/9/12/14/15) + 11 flagged (Q6/7/8/10/11/13/16/17/18/19/20, 깨진 수식 1~187개)
- TD-S47-2 carry-over: flagged 11건 Vision 재추출 또는 인간 정제 의무

### D. ★ 진산 Q15 복수정답 보존 (D-Q1-6 채택)

- "■ 같은날 사고 보는 경우" vs "■ 각각 다른날 사고로 보는 경우" 두 해석 모두 본문에 보존 (큐넷 학원 해설 그대로)
- handoff-053 carry-over 패턴 정합 (1차 복수정답 보존과 동일 정책)

### E. verify 영속 검증

- entry run1≡run2 PASS 일치 (timestamp 제외 IDENTICAL, TD-VRF-001 미발현)
- post-Q1 run3 → Cat1 FAIL (batch 326/327) 발생, run4 retry → PASS 327/327
- **★ TD-VRF-001 발현 확인** — Q1 적재(데이터)와 무관한 flaky test (격리 batch 실행 327/327 정합). handoff-053 carry-over 패턴.

## 수정된 파일 (미커밋)

### Modified (5) — 이전 세션 carry-over (본 세션 신규 수정 X)

- `docs/architecture/LLM_CONTAINMENT.md` (Session 043)
- `docs/engines/parser/research.md` (Session 043)
- `docs/plans/batch-loadmap.md` (★ 본 세션 047 갱신 — Layer 5 2차 11회 추가, 545 exam_questions, Layer 5 2차 14%)
- `packages/parser/src/batch-processor.ts` (Session 043 M-5 fix)
- `packages/parser/src/ontology-registry.json` (Session 043 TD-S43-1 fix v1.2.0)

### Untracked 본 세션 047 신규 (영속 데이터)

- `docs/plans/2nd-exam-and-engine-validation-strategy.md` ★ 4건 검토 결과 plan
- `docs/batch-load/batch-Q-2025-11-2nd/` (디렉토리, 5 파일):
  - `raw-extract.json` (PyMuPDF 추출 raw, 63KB)
  - `cleaned-extract.json` (cleanup + flagged 분류, 20문항)
  - `review-sample.md` (진산 검수용 5건)
  - `raw-all-20.md` (전체 20문항 raw markdown)
  - `build-sql.py` (SQL 변환기)
  - `batch-Q-2025-11-2nd-insert.sql` (20 INSERT 문)
- `.claude/reports/sprint1-step5-5-verify-session-047-entry-run{1,2}.json` (entry verify)
- `.claude/reports/sprint1-step5-5-verify-session-047-after-q1-run{3,4}.json` (post-Q1 verify)
- `.jjokjipge/handoff-session-054.md` (본 핸드오프)

## 누적 통합 통계 (production D1, 2026-05-06 Session 047 종착)

```
knowledge_nodes : 794
knowledge_edges : 1274
formulas        : 157
constants       : 193
revisions       : 39
exam_questions  : 545 (1차 525 active + 2차 9 active + 2차 11 flagged) ★ Layer 5 1차 100% / 2차 14% ★
```

## 주요 결정 / 발견

### ★ 정답+해설 PDF 추출 패턴 (1차와 다름)

- **1차 정답지**: 이미지형 (PyMuPDF dpi=200 PNG → multimodal 추출) — 큐넷 공식만
- **2차 11회 정답+해설**: 텍스트 추출 가능 (학원 해설 통합) — pdfplumber/PyMuPDF text mode + cleanup 의무

### ★ 깨진 수식 글리프 — TD-S47-2 carry-over

- U+0001 + Private Use Area E000~F8FF는 PDF에서 분수/수식 위치에 폰트 임베딩으로 사용
- text mode 추출 시 매핑 안 되어 깨짐 (Adobe Reader 본 PDF는 정상 표시)
- **해결책**: dpi=300 PNG 변환 후 Vision multimodal 재추출 (1차 패턴) 또는 인간 정제

### ★ 본문 가공 정책 (D-Q1-4 권장 A 채택)

- raw 통째 → `content` 보존
- answer/explanation = NULL (추후 정제 세션에서 INSERT + SUPERSEDES 패턴)
- 자동 분리는 데이터 손실 위험 (정답이 본문 안에 흩어짐, 풀이/공식이 학습 가치 高)

### ★ Q3 재정의 — Self-Test → "Engine RAG 신뢰성 검증"

- Hard Rule "LLM에게 수식 계산 금지" + CRITICAL RULE #4 "AI 자기 채점 금지" + 데이터 누설 방지
- 올바른 패턴: Question → Graph RAG retrieve → Constants/Formula compute → answer ↕ Ground truth
- 1차 525 = retrieve 정확도 60%+ (memory 합격률 60% 정합) / 2차 20 = Formula 100% 의무
- 단계 2 (세션 050~051)에서 vitest spec 자동화

### ★ Q4 — 2차 모의고사 자동 출제 (진산 "프로젝트 핵심")

- 가능 조건 6개: ① Engine RAG 60%+ ② Formula Engine 100% ③ source_node_ids[] FK 의무 ④ status 'mock_draft' 추가 마이그레이션 ⑤ Few-shot data ⑥ packages/study-material-generator 구현
- Phase 2 진입 후 가능 (Q3 검증 통과 + Q2-A/C 적재 후)

### ★ TD-S47-1 — 학습 UX 구조화/표 표현 (carry-over)

- 진산 발화: "텍스트만 나열하면 안 되고 실제 기출처럼 구조화나 표 형태로 표현 잘 되야 함"
- 본 세션 영역 외 (별도 검토 — 진산 발화 시 plan 작성)
- 영향: PDF 표 데이터 → HTML/Markdown 표 변환 + 풀이 식 → KaTeX/MathJax 렌더링 + 학습 카드 디자인 시스템 (DESIGN.md)

## 다음 할 일 (단계 1B 진입)

### 1. 차세션(054) entry verify 영속 2회 (의무)

```bash
/home/soo/ClaudePro/ThePick/packages/quality/node_modules/.bin/tsx /home/soo/ClaudePro/ThePick/scripts/verify-engine-contracts.ts --json > .claude/reports/sprint1-step5-5-verify-session-054-entry-run1.json
# (run2 동일)
# run1≡run2 PASS 일치 확인 (★ 절대 경로 의무, cwd 잔존 시 ERR_MODULE_NOT_FOUND)
# TD-VRF-001 flaky 발현 시 재실행 (Cat1 batch 326/327 → 327로 회복)
```

### 2. **★ 단계 1B — Q2-B 품목별 기출 풀이 8건 → 525+20 related_nodes 매핑 (TD-S46-4 직격)**

- 자료 (8건, `docs/manual/2차시험정답지/`):
  - `자료6번_과실손해보장기출모음.pdf`
  - `자료9번_수확감소밭작물_보험금기출.pdf`
  - `자료11번_인삼+해가림+생산비보장(노지).pdf`
  - `자료번호15_수입안정보장_11년간기출.pdf`
  - `자료번호17번_가축_11년간기출(배포용).pdf`
  - `5번_종합과수_기출문제모음.pdf`
  - `시잘부2_품목별_표본구간정리.pdf`
  - `시잘부3_과수품목_피해율정리.pdf`
- 작업: 각 자료가 다루는 BATCH-1~7 + L1/L2 노드 식별 → 545 exam_questions 와 매핑 → `related_nodes` JSON 컬럼 채움
- LLM 1차 추출 + 진산 spot check (D-Q2-1 hybrid 채택)

### 3. 단계 1C — Q2-E 출제 패턴 분석 → topic_clusters 메타데이터

- `2차2과목_10년간_기출분석.pdf` (37KB, 가장 작음)
- 출제 빈도/우선순위 데이터로 topic_clusters 노드 생성

### 4. 단계 2 (세션 050~051) — Q3 Engine RAG blind 평가 자동화

- vitest spec: `packages/quality/src/tests/exam-rag-eval.spec.ts`
- 1차 525 객관식 blind retrieval (정답 마스킹) + Formula Engine 호출
- 합격 기준 단계적: M1=60% / M2=80% / M3=95%

## 주의사항

### ★ exam_questions 테이블 핵심 제약 (재확인)

- **status CHECK 'active'/'deprecated'/'flagged'** ('draft' 미지원)
- **UPDATE 차단** (Temporal Guard 트리거, INSERT + SUPERSEDES 패턴 의무)
- **NOT NULL: id, year, content** (다른 컬럼 NULL 허용)
- **L3 영역 (DB 스키마 변경)** — `points` 컬럼 추가 시 plan + 인간 승인 의무

### ★ 본문 cleanup 정책 (재현 의무)

```python
broken_pattern = re.compile(r'[\x00-\x08\x0B\x0C\x0E-\x1F-﻿­]')
dash_pattern = re.compile(r'[–—―]')  # → '-'
# 깨진 문자 1+ → status='flagged'
```

### ★ TD-S47-2 — flagged 11건 정제 의무

- Q6/7/8/10/11/13/16/17/18/19/20 — 깨진 수식 1~187개
- 옵션 A: PyMuPDF dpi=300 PNG → Vision multimodal 재추출
- 옵션 B: 인간 직접 정제 (PDF 보고 분수/수식 raw 입력)
- INSERT + SUPERSEDES 패턴 (UPDATE 금지)

### ★ TD-S46-2 (carry-over) — 2차 5~10회 정답지 미보유

- 큐넷 공식 발표 X. 카페/블로그 풀이 수집 의무
- 진산 자료 확보 후 6세션 분할 적재 (~144문항 추정)

### ★ TD-S46-4 (carry-over, 단계 1B 직격) — related_nodes 매핑

- 525 + 20 = **545 문항 ↔ BATCH-1~7 + L1/L2 노드 매핑** Level 3 핵심 자산
- 단계 1B Q2-B 품목별 8건이 본 작업의 직격 자료

### ★ TD-S46-3 (carry-over) — 1차 explanation NULL

- 큐넷 정답지 해설 X. 카페/블로그 해설 수집 후 INSERT + SUPERSEDES 의무
- 2차 11회는 학원 해설 포함 (content에 통합 보존, 정제 추후)

### ★ TD-S46-5 (carry-over) — 농학개론 자료 미보유

- 1차 3과목 재배학·원예작물학 (CONCEPT-215 영역) BATCH-1~7 외
- 175 questions × 7회 = 175 questions 적재됐으나 노드 매핑 자료 미확보

### ★ TD-S47-1 (신규 carry-over) — 학습 UX 구조화/표 표현

- 진산 발화: "텍스트만 나열하면 안 되고 실제 기출처럼 구조화나 표 형태로 표현"
- 별도 검토 트리거 발화 시 plan 작성 (영역: PDF 표 → HTML 표 / 풀이 → KaTeX 수식 / 디자인 시스템)

### ★ TD-VRF-001 (handoff-053 carry-over, 본 세션 047 발현 확인)

- verify Cat1 batch 326/327 flaky (격리 실행 327 정합)
- run3 FAIL → run4 retry PASS 패턴
- 데이터 적재(코드 변경 X)와 무관한 timing race
- 차세션 entry 시 발현 시 즉시 retry로 PASS 확보

### 일반 운영 주의

- **wrangler cwd 주의** — Bash tool 세션 종료 시 cwd 리셋. 절대 경로 사용 권장
- **wrangler 검증 쿼리 컬럼명** — knowledge_edges = `from_node`/`to_node`, exam_questions = id/question_number/content/answer/explanation/exam_type/status
- **migration 0010~0019 staging+production 적용 완료** — BATCH-N+ 추가 마이그레이션 X
- **L3 영역 변경 시 plan + 인간 승인 의무** — 본 세션 ontology-registry.json 변경 0
- **Untracked Guide/3단계리뷰\*.md 2건** — 진산 자료 (Hard Limit `Guide/` 보존)
- **누적 이월 MAJOR ~111건** (handoff-053 §3.2). Phase 2 진입 시 일괄 갱신
- **handoff-042 §9 엔진 추출 carry-over** — Layer 1+2+3+4+5(1차+2차 일부)+6 충족하지만 Layer 5 2차 14% + 사용자 앱 PWA + Level 3 미충족 → 발화 시 보류 의무

### ★ 차세션(054) 1차 읽기 의무 문서 (우선순위 순)

1. `.jjokjipge/handoff-session-054.md` (본 세션, 1순위)
2. `docs/plans/batch-loadmap.md` (Layer 5 1차 100% / 2차 14% / 545 exam_questions)
3. `docs/plans/2nd-exam-and-engine-validation-strategy.md` ★ 본 세션 신규 plan (단계 1~5)
4. `.jjokjipge/handoff-session-053.md` (1차 100%, 직전 세션)
5. `docs/batch-load/batch-Q-2025-11-2nd/` 본 세션 신규 5 파일 (적재 패턴 참고)
6. `.jjokjipge/handoff-session-042.md` §9 (엔진 추출 carry-over 보류 의무)

### session-health 본 세션(047)

- 시작 ~3.4시간 경과 (90분 임계 초과)
- 차세션(054) 진입 시 신규 세션 권장

이 핸드오프 프롬프트를 읽고 프로젝트 CLAUDE.md를 확인한 후 작업을 이어가세요.
