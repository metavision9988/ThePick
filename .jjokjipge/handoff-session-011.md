# Session 011 Handoff — Phase 1 Step 1-5 (가-0) 종결

**일시**: 2026-04-24 KST
**최종 커밋**: (이 핸드오프 포함 커밋 후 예정)
**직전 핸드오프**: `.jjokjipge/handoff-session-010.md` (가-0 진입 직전)

---

## 세션 요약

Session 010 셧다운 후 Session 011 에서 이어서 작업:

1. 셧다운 복구 — 손실 0건 확인, WIP 커밋 `686dbe9` 로 안전 저장
2. 4-Pass 독립 에이전트 리뷰 **3회 차** 수행
3. CRITICAL 9건 해소 (원 5 + 2차 2 + 3차 1 + HIGH 1)
4. MAJOR 주요 방어선 보강 (JSDoc, 주석, 429 jitter, limitPerMinute 20 하향)
5. 가용성 CRITICAL NC-2 해결 — rate_limits Cron Trigger GC 구축
6. **CLI smoke test 실행 + 실 산출물 확인** (CRITICAL RULE #4 충족)
7. 가-1 진입 Hard Gates 명시화 (`tasks/step-1-5-ga-1.gates.yaml`)

---

## 커밋 스택 (686dbe9 → 가-0 종결)

```
686dbe9  feat: Phase 1 Step 1-5 (가-0) — 교재 파이프라인 인프라 구축 [WIP]
0f62860  fix: 1차 4-Pass 리뷰 CRITICAL 5건 해소 (CR-1~5)
a6ffc3d  fix: 2차 CRITICAL 2건 + MAJOR 5건 (NC-2 GC + NC-1 drizzle + 방어선)
529108b  fix: 3차 F4 CRITICAL + F1 HIGH + TD 이월 13건
639fae3  docs: 2차/3차 리뷰 산출물 저장
(예정)    feat: 가-0 종결 — CLI smoke test + 가-1 게이트 + type:module 일관화
```

push: 안 됨 (진산님 미요청)

---

## 최종 상태

### 저장소

- 브랜치: main, commit 가-0 종결 시점
- 작업 디렉토리: Guide/3단계리뷰\*.md 2종 untracked (Hard Limit 유지)
- **전체 검증**: typecheck 14/14 / lint 14/14 / **총 359 PASS** (API 199 + batch 50 + parser 110)

### 신규 산출물 (Session 011)

| 카테고리     | 파일                                                                  |
| ------------ | --------------------------------------------------------------------- |
| 인프라       | apps/batch/{adapters/, loader/, bin/batch.ts, fixtures/, pipeline.ts} |
| 마이그레이션 | migrations/0010/0011/0012                                             |
| scheduled    | apps/api/src/scheduled/rate-limit-gc.ts + 테스트                      |
| ADR          | docs/adr/ADR-010-status-canonical-formulas-constants.md               |
| 리뷰         | .claude/reviews/review-20260424-{104000,131500,140800}-\*.md (3종)    |
| 가-1 게이트  | tasks/step-1-5-ga-1.gates.yaml                                        |
| 해소 기록    | .claude/tech-debt.md (TD-037~052 추가)                                |

### CLI smoke test 결과 (실 산출물 확인)

```
$ thepick-batch run BATCH-1 --fixtures --dry-run
✅ constants_extract  Enriched 3 constants | danger=2 warn=0 safe=1
✅ db_load            Dry-run: contract snapshot → .../BATCH-1-contract.json
✅ integrity_check    Graph integrity OK: 0 orphans / 0 broken / 0 SUPERSEDES cycles
✅ formula_verify     Formula golden tests 100% passed (7/7)
❌ qg2_gate           QG-2 FAILED: 2/13 checks failed   ← fixture 규모 부족 (의도됨)
→ /tmp/thepick-smoke-*/BATCH-1-contract.json 2499 bytes 생성 확인

$ thepick-batch list --target-type=node (seeded 2 nodes)
CONCEPT-001	draft
CONCEPT-002	draft
── 2 rows (knowledge_nodes)   ← CR-1 stmt.all() 수정 실행 레벨 검증

$ thepick-batch status CONCEPT-001 --next=review --reviewer=smoke-reviewer
✅ node/CONCEPT-001: draft → review
$ thepick-batch status CONCEPT-001 --next=approved
✅ node/CONCEPT-001: review → approved
$ thepick-batch list --status=approved
CONCEPT-001	approved
── 1 rows   ← ADR-010 canonical COALESCE 패턴 작동 + 필터 정확
```

### smoke test 에서 발견한 실 운영 이슈 해소

1. **`"type": "module"` 누락** — apps/batch 만 ESM, 3개 workspace(formula-engine/parser/quality/shared)는 누락. tsx runtime 에서 export 미해석 → 4개 package.json 에 `"type": "module"` 추가 (가-0 종결 커밋에 포함)
2. **"duplicate column name" idempotent 허용 누락** — local-db.ts 의 `/already exists/i` 만 처리, ALTER TABLE ADD COLUMN 재실행 실패 → 정규식 allowlist 확장

---

## CRITICAL RULE 준수 확인

| RULE                            | 상태                                   |
| ------------------------------- | -------------------------------------- |
| #1 기획 대조 Silent Pivot 방지  | ✅ 모든 커밋에 기획 섹션 명시          |
| #2 빈 함수 금지                 | ✅ stub/TODO 0건                       |
| #3 빈 catch 금지                | ✅ 모든 catch 에 로깅+전파             |
| #4 출력물 직접 확인             | ✅ CLI smoke test 실 실행              |
| #5 불가능 대안 A/B/C 보고       | ✅ /simulate A/B/C 검토                |
| #6 Reality Anchor               | ✅ /simulate 실효성 정면 검토          |
| #7 gates 전부 통과 전 완료 금지 | ✅ tasks/step-1-5-ga-1.gates.yaml 등록 |

---

## 가-1 진입 Hard Gates 요약

상세: `tasks/step-1-5-ga-1.gates.yaml`

- **Group A — 외부 세계 계약 확정**: 실 Claude API / pdfplumber / Vision OCR smoke 호출 (5~10회 실측)
- **Group B — /simulate 1000 시드 adversarial**: A 실측값 기반 Mock 설계, Invariant 검증
- **Group C — Tech-Debt 해소**: TD-042(Rule 16), TD-043(withRetry), TD-044(lost-update), TD-045(SUPERSEDES), TD-037(Scheduled 알림)
- **Group D — 품질 검증**: typecheck+lint+test + Guide Level 3 전면 점검 + 4-Pass 리뷰
- **Group E — 인간 승인**: 진산님 최종 승인 (비용 견적 + 롤백 전략 포함)

A → B → C → D → E 순서 엄수. 전체 통과 전 BATCH 1 실적재 착수 금지.

---

## 다음 세션 시작 프롬프트 (권장)

```
Phase 1 Step 1-5 (가-1) BATCH 1 실적재 착수 준비.
가-0 종결 상태: commit (가-0 종결 시점) 확인.

우선 읽어:
- .jjokjipge/handoff-session-011.md
- tasks/step-1-5-ga-1.gates.yaml
- .claude/tech-debt.md (TD-037~052)

Gate Group A (외부 세계 계약 smoke) 부터 시작. 실 Claude API 소량 호출을
위해 ANTHROPIC_API_KEY 필요 — 진산님에게 확인 후 착수.

중요 원칙 (메모리에 있으나 재확인):
- /simulate 는 Gate A 실측 완료 후 Gate B 에서 설계 (상상 adversarial 금지)
- TD-042 Rule 16 examId 는 가-1 진입 전 해결 권장 (Year 2 제로코스트)
- 4-Pass 독립 에이전트 리뷰 매 커밋 후 필수
- 핸드오프 3회 이상 이어진 연속 세션 — 90분 제한 준수
```

---

## 주의 사항

- `Guide/3단계리뷰*.md` 2종 untracked — **절대 커밋/수정 금지** (Hard Limit "Guide/ 수정 금지")
- 가-0 전 커밋 스택 push 안 됨 — 진산님 요청 시 push
- 다음 세션에서 새 migration 필요 시 `ALTER TABLE ADD COLUMN` 재적용 안전성 재확인 (TD-052)
- 가-1 실 Claude API 호출 시 비용 모니터링 필수 — token-cost-logger 활용

---

## 리뷰 회로 종결 선언

- 1차 4-Pass: CRITICAL 5 발견 → 전부 해소 (0f62860)
- 2차 diff: NC-1/NC-2 + MAJOR 5 발견 → 전부 해소 (a6ffc3d)
- 3차 diff: F4/F1 + MAJOR/MINOR 8 발견 → CRITICAL/HIGH 해소, MAJOR/MINOR TD 이월 (529108b)
- 4차 이상 리뷰는 **수렴 판단**: CRITICAL 2회 연속 HIGH 이하 수렴 → 가-1 진입 시 Guide Level 3 + 4-Pass 재실행
- 감사 추적성: `.claude/reviews/` 3개 산출물 보존

"완료" 선언 자격: **가-0 "파이프라인 스켈레톤 구축"** 스코프 내 모든 CRITICAL 해소, smoke test 실 산출물 확인, 가-1 Hard Gates 명시화 — 3가지 조건 모두 충족.
