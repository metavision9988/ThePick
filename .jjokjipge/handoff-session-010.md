# Session Handoff — 2026-04-22~23 (Session 10)

## 세션 요약

Session 10 (약 68분 경과, 새 세션 권고 시점) — **Phase 1 Step 1-4 완료 → 시나리오 v2 → Level 3 감사 → 6-페르소나 전면 중간 감사 → 감사 재정렬 → Step 1-5 (나) 진도 API 완료 → Step 1-5 (가-0) 파이프라인 인프라 plan 착수 승인 직후**.

**마지막 메시지:** 진산님 "승인할테니 바로 착수해줘. 그런데 메모리 세션이 충분한가.. 새로운 세션이 좋을지 판단해줘"

**판단:** 새 세션 권고. 이유 아래.

---

## 완료된 주요 작업 (이 세션)

### 1. Step 1-5 (나) 진도 API 엔진 통합 검증 완료 — 커밋 `6935475`

- `/api/progress/{summary, review, due}` 3 엔드포인트 신설
- `require-auth` 미들웨어 generic 확장 + `/api/progress/*` **첫 실전 마운트**
- user_progress 기존 테이블 활용 (FSRS 알고리즘은 Phase 2 이월)
- CORS 확장 (auth + progress 공유 팩토리)
- 테스트: 161 → 184 PASS (+23). 시나리오 21 → 27 (🎯 엔진 통합 그룹 S22~S27 신규)
- 4-Pass 독립 에이전트 리뷰 (Surgeon/Architect/Advocate/Contract) 완료. Critical 1건(CORS) 즉시 해소, Major 2건(`require-auth` 빈 sub 방어 / 테스트 픽스처 FSRS 필드 명시) 즉시 해소. Major 2건(CSRF, enumeration) + Minor 5건 TD-029~036 이월.

### 2. 6-페르소나 전면 중간 감사 (Session 9 말) + Session 10 응답 재정렬

- `.claude/reviews/comprehensive-audit-20260422-221644.md` 원본 감사 (Session 9 커밋 f3785ad)
- `.claude/reviews/audit-response-20260423.md` 진산님 응답 반영 재정렬
- **기각:** 교재 저작권 / ChatGPT 경쟁 리스크
- **이월:** 법무 3종 + 회원탈퇴 + 이메일 인증 → 런칭 직전 1주 스프린트
- **지엽 묻지 않음:** 가격 / 첫결제 / Hedgehog

### 3. 메모리 6건 신규 + MEMORY.md 갱신

위치: `/home/soo/.claude/projects/-home-soo-ClaudePro-ThePick/memory/`

- `project_vision_mvp_generalization.md` — 쪽집게 = 자격증 도메인별 훈련 엔진 MVP. 북극성은 생성물 신뢰성·정확성.
- `project_source_citation_requirement.md` — 출처 추적성 필수. 근거 0건 = approved 불가.
- `feedback_copyright_skip.md` — 교재 저작권 재언급 금지.
- `feedback_no_granular_decisions.md` — 지엽 결정 delegation 금지. 전략 아키텍처만.
- `project_launch_legal_bundle_deferred.md` — 런칭 직전 법무/계정 묶음 이월.
- (기존) feedback/project/reference memory 유지.

### 4. tech-debt.md 신규 TD-029 ~ TD-036 (8건) 등록

핵심:

- **TD-029** Progress /review CSRF (Phase 2 프론트 통합 전)
- **TD-030** knowledge_nodes ID enumeration rate-limit (Step 1-5 가 적재 전)
- **TD-031** UPSERT lost-update race — 복합 UNIQUE + atomic (Phase 2 FSRS 동시)
- **TD-033** FSRS 초기값 상수화
- **TD-036** Year 2 멀티시험 시그니처 `(examId, userId)` 전환

---

## 현재 상태 (저장소)

- **브랜치:** main, commit `6935475`, push 안 됨 (진산님 미요청)
- **작업 디렉토리:** clean (staged 변경 없음), untracked: `Guide/3단계리뷰-*.md` 2종 (진산님 추가, 건드리지 말 것 — CLAUDE.md Hard Limit "Guide/ 수정 금지")
- **테스트 184 PASS / typecheck 0 errors / lint 14 workspaces Done / build 263.82 KiB**

---

## 다음 작업 (Step 1-5 가-0 진입) — 진산님 승인 완료

### 목표

**Step 1-5 (가-0) 교재 파이프라인 인프라 구축** — BATCH 1~5 자동 적재를 위한 전체 파이프라인 스켈레톤.

### 로드맵 실측 결과 (Explore 에이전트 2026-04-23 조사)

- **기획 문서:** `docs/쪽집게(ThePick) — 구현 설계서 및 개발 로드맵.md` §5 Phase 1 W7-8
- **BATCH 구조:**
  - BATCH 1 = PoC (적과전 종합위험, 403~434p, 40+노드, 7+산식) ★ 전체 파이프라인 검증
  - BATCH 2~5 = MVP 필수 (수확감소/논/밭/시설+수입감소)
  - BATCH 6~7 = Post-MVP (v2.1 재분류, Phase 4 이후)
- **품질 게이트:** QG-2 (BATCH 1 산식 100% + 40+노드 + 80+엣지) → 미통과 시 프롬프트 재설계
- **파서 패키지 기존 구현:**
  - `packages/parser/` ~500줄 (batch-processor, section-splitter, schema-validator, constants-extractor, ontology-registry.json 활성)
  - `packages/parser-1st-exam/` ~400줄 (exam-question-parser 프로덕션 수준)
- **입력 자료:** `docs/manual/` 26개 파일 14MB (이론서 4.9MB + 기출 7회분 + 법령 + 개정안)

### Step 1-5 (가-0) 에 담길 내용 (plan 초안 — 진산님 진입 후 반드시 L3 plan 작성)

1. **pdfplumber Python subprocess wrapper** (apps/batch 에 배치 실행기)
2. **Claude Haiku 배치 구조화** (재시도 3회 + 타임아웃 + 토큰 비용 로깅)
3. **Vision OCR wrapper** (표/도형 페이지)
4. **배치 검증 파이프라인** (schema-validator + ontology lock + FK 무결성 + 산식 AST 파싱)
5. **draft → review → approved 상태 머신** (CLI 로 상태 전이, 관리자 UI 는 Phase 2)
6. **BATCH 1 dry-run CLI**
7. **26년 개정사항 선반영**: 손해정도비율 20%→10% 등 Constants 선주입

### 고정 원칙 (변동 없음)

- LLM 수식 계산 금지 → Formula Engine AST 만
- Constants DB 만 쿼리 (LLM 추론 금지)
- AI 생성 = draft 적재, 사람 검수 후 approved
- **출처 추적성 필수** (2026-04-23 진산님 요구) — 모든 노드/산식/상수에 page_ref 첨부
- Hard Rule #6: 배치 순서 엄수 (N 검증 없이 N+1 착수 금지)
- DEFCON L3 (Formula Engine / Constants / Ontology Lock / DB 스키마 변경)

---

## 새 세션 권고 이유

1. **경과 68분** — 임계값 60분 초과 (session-health.md 기준). 90분까진 22분 남았으나, 다음 작업이 대형 신규 인프라라 30분 이상 지속 가능성 높음.
2. **컨텍스트 누적 과다** — 이 세션에서 읽은 큰 파일: scenarios.test.ts 802줄, 4-Pass 리뷰 4 에이전트 결과, 6-페르소나 감사, plan archive, tech-debt, 다수 DB 마이그레이션 등.
3. **다음 작업 성격** — Step 1-5 (가-0) 은 **완전히 새로운 도메인** (Python subprocess, Claude API, Vision OCR, 파서 패키지 기존 코드 분석). 클린 컨텍스트에서 파서 ~900줄 분석 후 plan 작성하는 게 안전.
4. **L3 영역** — Formula Engine + Constants + Ontology Lock 관련 다중 L3 경계. plan → 인간 승인 → 코딩 프로토콜 엄수 필요.

---

## 새 세션 시작 프롬프트 (권장)

다음 내용을 새 세션 첫 메시지에 붙여주시면 됩니다:

```
Phase 1 Step 1-5 (가-0) 교재 파이프라인 인프라 구축 착수.
진산님 승인 완료 (Session 10, 2026-04-23).

우선 핸드오프 읽어:
.jjokjipge/handoff-session-010.md

그 다음 기획 문서 + 파서 패키지 현황 파악 후 L3 plan 작성해줘.
plan 승인 받고 구현 착수.

중요 원칙 (메모리에 있으나 재확인):
- 쪽집게 = 자격증 도메인별 훈련 엔진 MVP, 북극성 = 생성물 신뢰성·정확성
- 출처 추적성 필수 (모든 노드/산식에 page_ref)
- 지엽 결정 묻지 말 것 (가격/일정/세부 숫자)
- 교재 저작권 재언급 금지
- 법무 3종은 런칭 직전 묶음으로 이월
- 4-Pass 독립 에이전트 리뷰 필수
```

---

## 주의 사항

- `Guide/3단계리뷰*.md` 2종 untracked — **절대 커밋/수정 금지** (Hard Limit)
- 마지막 커밋 `6935475` push 안 됨 — 진산님 요청 시 push
- staging/production 배포 본 세션에서 안 함 — Step 1-5 (가-0) 완료 후 BATCH 1 실행 전 staging 재배포 검토
- 4-Pass 리뷰 결과는 `.claude/reviews/review-20260423-step1-5-naa.md` 에 고정
