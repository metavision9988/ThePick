# Hard Rules — Content Build Engine 통합 명세 (v2.2, 31개)

> 본 엔진의 31 Hard Rule 통합 색인. v2.1 (25) → v2.2 (31, 검토서 review2 흡수).
> v2.2: production-quality.md 의 Rule 15~17 흡수 (감사 R-1) + 결정 7/8/9 의 Rule 26~28 신설.
> 위반 시 **모든 plan 에서 최우선 차단** (메모리 `project_content_build_engine_as_core.md`).
> 상위: [`CONTENT_BUILD_ENGINE.md`](./CONTENT_BUILD_ENGINE.md)

---

## Core 5 Rule (북극성 직접 — BATCH-1 전 강제, business-panel B+ 권고 v2.2)

> 본 31 Rule 중 **북극성 (생성물 신뢰성·정확성) 직접 위반 시 사망** 5건 + Source Citation.
> BATCH-1 dry-run 진입 전 enforcement 의무. 나머지 26 Rule 은 **Auxiliary** —
> BATCH-1 결과 retrospective 검증 후 본격 enforcement 또는 deprecated 결정.

| #   | Rule                                                     | 북극성 연결                      | enforcement 시점                          |
| :-- | :------------------------------------------------------- | :------------------------------- | :---------------------------------------- |
| 3   | LLM 수식 계산 금지 (Formula Engine math.js AST 만)       | 산식 정확성 → 학습자 시험 정답   | **BATCH-1 전**                            |
| 4   | Constants LLM 추론 금지 (DB 쿼리만)                      | 수치 정확성 → 학습자 정답        | **BATCH-1 전**                            |
| 6   | Ontology Lock (`ontology-registry.json` 외 ID 생성 금지) | 데이터 무결성 → 검색 정확성      | **BATCH-1 전**                            |
| 7   | draft → approved state machine                           | 인간 검수 → 생성물 신뢰성        | **BATCH-1 전**                            |
| 8   | BATCH 순차 (전 BATCH 검증 없이 다음 진행 금지)           | 검증 누적 → 시스템 자가 검증     | **BATCH-1 전**                            |
| +   | Source Citation FK (page_ref NOT NULL + 법조문/기출 ID)  | 출처 추적성 → 학습자 "근거 보기" | **BATCH-1 전** (마이그레이션 0010 트리거) |

**Auxiliary 26 Rule (1, 2, 5, 9~31 의 Core 외)**:

- enforcement 자체는 그대로 유지 (코드/CI/D1 트리거 등)
- 그러나 **신설 enforcement 메커니즘 (ESLint 룰, 새 트리거, runtime 검증) 은 BATCH-1 후 후순위**
- BATCH-1 dry-run 결과 → 위반 0건이면 deprecated 후보 / 위반 발생이면 본격 enforcement
- 근거: 87건 다각 검토 발견 처리 시간 (~30~40 spread) vs MVP-α 일정 — 가설 기반 26 Rule 보다 데이터 기반 재설계가 정확

→ 본 분류는 메모리 `project_content_build_engine_as_core.md` v2.2 와 정합.

---

## 기존 Hard Rule 1~14 (v1)

| #   | 규칙                                                     | 출처                 | 차단                                       |
| :-- | :------------------------------------------------------- | :------------------- | :----------------------------------------- |
| 1   | knowledge_nodes UPDATE 금지                              | Hard Limit           | D1 트리거 `prevent_knowledge_nodes_update` |
| 2   | formulas / constants UPDATE 금지                         | Hard Limit           | D1 트리거                                  |
| 3   | LLM 수식 계산 금지 (Formula Engine math.js AST 만)       | Hard Limit           | code review                                |
| 4   | Constants LLM 추론 금지 (DB 쿼리만)                      | Hard Limit           | code review                                |
| 5   | 동적 코드 실행 금지 (`equation_template` 포함)           | Hard Limit           | code review                                |
| 6   | Ontology Lock — `ontology-registry.json` 외 ID 생성 금지 | Hard Limit           | `validateKnowledgeContract`                |
| 7   | AI 생성 데이터는 `draft` 상태로만 적재                   | Hard Limit           | state-machine                              |
| 8   | BATCH 순차 실행 (전 BATCH 검증 없이 다음 진행 금지)      | Hard Limit           | Loader                                     |
| 9   | 농학 미출제 영역 명시적 라벨링 필수                      | Hard Limit           | 검수                                       |
| 10  | shared 노드 수정 시 1차/2차 양쪽 검토                    | Hard Limit           | 검수                                       |
| 11  | 암기법 역방향 검증 실패 시 폐기                          | Hard Limit           | code                                       |
| 12  | `.env*` 파일 커밋 금지                                   | Hard Limit           | `scripts/check-no-secrets.sh`              |
| 13  | Guide/ 디렉토리 수정 금지                                | Hard Limit           | git pre-commit                             |
| 14  | Truth Weight 강제 정렬 (LAW > FORMULA > CONCEPT)         | RAG 결과 LLM 주입 시 | code review                                |

---

## production-quality.md 흡수 (15~17, 감사 R-1, v2.2 정정)

기존 production-quality.md 의 Rule 15~17 을 본 통합 색인에 흡수:

| #   | 규칙                                                                                        | 출처                                   | 차단                              |
| :-- | :------------------------------------------------------------------------------------------ | :------------------------------------- | :-------------------------------- |
| 15  | 범용 계층 내 시험 특화 분기 금지 (`if examId === ...` 코어 모듈에)                          | production-quality.md (Year 2 ADR-007) | ESLint `no-restricted-syntax`     |
| 16  | 데이터 조회 시 시험 경계 강제 (2단계 — Year 1 시그니처 + Year 2 WHERE 절)                   | production-quality.md (TD-042)         | code review                       |
| 17  | 시험 ID 리터럴 단일 선언 (`packages/shared/src/constants/exam-ids.ts`) + `ExamId` 타입 경유 | production-quality.md                  | ESLint `Literal[value='...']` AST |

---

## v2.0 신설 (18~24, 검토서 §3 결함 A~G, 번호 정정 v2.2)

기존 v2.1 의 15~21 → v2.2 에서 18~24로 재번호 (Rule 15~17 충돌 해소).

| #      | 규칙                                                                      | 출처                | 차단                 |
| :----- | :------------------------------------------------------------------------ | :------------------ | :------------------- |
| **18** | 모든 RAG 검색은 3-Stage Hybrid Search 의무. Vectorize 단독 결과 사용 금지 | 결함 C / ADR-012    | 운영 RAG code review |
| **19** | 모든 운영 RAG 쿼리는 `is_current_active=1` 필터 의무. 재귀 CTE 사용 금지  | 결함 B / ADR-013    | code review          |
| **20** | 신규 BATCH 적재는 CBIV 6단계 통과 후에만 D1 INSERT                        | 결함 D, G / ADR-014 | Loader 거부          |
| **21** | 유사도 < 0.60 시 Multi-Path Fallback 의무 (단일 안내문 금지)              | 결함 A / ADR-015    | 운영 RAG 단위 테스트 |
| **22** | FSRS 사용자 학습 데이터는 Event Sourcing. LWW 패턴 사용 금지              | 결함 E / ADR-016    | sync-service runtime |
| **23** | `packages/exams/_common/` 네임스페이스 예약. Year 1 데이터 적재 금지      | 결함 F / ADR-017    | git pre-commit       |
| **24** | Golden Test 영구 보존 + CI/CD 자동 재실행. 진산님 승인 없이 삭제 금지     | 결함 D, G / ADR-014 | git pre-commit       |

---

## v2.1 신설 (25~28, 검토서 §4 메타 반론 MR-1~4)

| #      | 규칙                                                                                                                    | 출처           | 차단                   |
| :----- | :---------------------------------------------------------------------------------------------------------------------- | :------------- | :--------------------- |
| **25** | CBIV 회귀 검증은 D1 Preview Database 환경에서만. in-memory SQLite 는 로컬 1차 검증용                                    | MR-1 / ADR-018 | runner factory 거부    |
| **26** | 모든 RAG 폴백 경로는 Concurrent Execution + Short-circuit 의무. 순차 호출 금지                                          | MR-2 / ADR-019 | 운영 RAG code review   |
| **27** | FSRS Event Sourcing 은 Snapshotting Pattern 의무 (매 N건 체크포인트 + 월 1회 무결성 cron)                               | MR-3 / ADR-020 | sync-service runtime   |
| **28** | 의미 중복 검증은 Ontology 타입별 Adaptive Threshold 의무. 단일 스칼라 임계값 금지. Constants 는 임계값 무관 exact-match | MR-4 / ADR-021 | CBIV Stage 2 직접 참조 |

---

## v2.2 신설 (29~31, 검토서 review2 결정 7/8/9 흡수)

| #      | 규칙                                                                                                                    | 출처            | 차단                    |
| :----- | :---------------------------------------------------------------------------------------------------------------------- | :-------------- | :---------------------- |
| **29** | AI 추천의 자동 채택 금지. 모든 검수 결정은 인간의 명시적 액션 (1-click 포함) 필요. AI 추천 정확도 월 1회 monitoring     | 결정 7 (B)      | 검수 API 거부           |
| **30** | 검수자 진행률 표시는 누적 통계만. 비교 통계 (평균/최대/최소) 표시 금지. 배지/칭호 영구 미도입 (1인 검수자 burnout 방지) | 결정 8 (A)      | UI 컴포넌트 review      |
| **31** | Rollback 기한은 24시간 또는 다음 BATCH 적재 진입 전, 둘 중 더 빠른 시점. 큐 3 (CBIV 차단 정정) 은 1시간 (긴급)          | 결정 9 (A 변형) | review_decisions 트리거 |

---

## 무결성 위배 시 차단 메커니즘 (전체)

| 위반            | 차단 메커니즘                                                       |
| :-------------- | :------------------------------------------------------------------ |
| Rule 1, 2       | D1 트리거 `prevent_X_update` (`RAISE(ABORT)`)                       |
| Rule 3, 4, 5    | Hard Limit + 코드 review (lint 룰 Phase 1 후반 이월)                |
| Rule 6          | `validateKnowledgeContract` + schema-validator                      |
| Rule 7          | state-machine `transitionStatus` 거부                               |
| Rule 8          | Loader                                                              |
| Rule 12         | `scripts/check-no-secrets.sh` pre-commit                            |
| Rule 13         | git pre-commit hook                                                 |
| Rule 14         | RAG 응답 코드 review                                                |
| **Rule 15**     | ESLint `no-restricted-syntax` (코어에 examId 분기)                  |
| **Rule 16**     | code review (data 조회 시그니처에 examId 의무)                      |
| **Rule 17**     | ESLint `Literal[value='son-hae-pyeong-ga-sa']` AST                  |
| **Rule 18**     | 운영 RAG 코드 review + 통합 테스트                                  |
| **Rule 19**     | code review (재귀 CTE grep)                                         |
| **Rule 20**     | Loader 가 CBIV 통과 표시 없으면 INSERT 거부                         |
| **Rule 21**     | 운영 RAG 단위 테스트                                                |
| **Rule 22, 27** | sync-service runtime 검증                                           |
| **Rule 23**     | git pre-commit (`packages/exams/_common/manual/` 추가 검사)         |
| **Rule 24**     | git pre-commit + 진산님 승인 절차                                   |
| **Rule 25**     | CBIV runner factory 거부 (`d1-preview-runner.ts` 만 export)         |
| **Rule 26**     | 운영 RAG 코드 review (순차 호출 grep)                               |
| **Rule 28**     | CBIV Stage 2 가 ontology-registry.json 직접 참조                    |
| **Rule 29**     | 검수 API: AI 추천 자동 채택 endpoint 부재 (의도적)                  |
| **Rule 30**     | 검수 UI 컴포넌트 review (비교 통계 표시 grep)                       |
| **Rule 31**     | review_decisions 테이블 트리거 (rollback_deadline NOT NULL + CHECK) |

---

## 본 31 Rule 의 무결성 (Vows)

본 엔진의 코어를 깨는 변경은 모든 plan 에서 **최우선 차단**:

- 위반 발견 시 plan 즉시 차단 / 재설계 강제
- 새 자격증 plugin 추가 시에도 본 31 Rule 그대로 적용
- 코어 변경 PR 은 본 31 Rule 자체 검증 의무

본 무결성이 깨지면:

- 학습자 잘못된 정보 노출 → 시험 망함 → 서비스 사망
- BATCH 누적 시 시스템 자가 검증 능력 상실 → 자살
- 멀티시험 확장 비용 폭증 → 본 엔진의 핵심 가치 (공통 코어) 무효
- 진산님 비전 (북극성: 생성물 신뢰성·정확성) 직접 위반
- **검수자 (진산님 1인) burnout → 시스템 SPOF 사망** (Rule 30)

→ **본 프로젝트 전체 의미 0** (진산님 명시).

---

## 부록: Year 1 ↔ Year 2 Rule 적용 차이

| Rule | Year 1                                                         | Year 2                                               |
| :--- | :------------------------------------------------------------- | :--------------------------------------------------- |
| 15   | Year 1 한시 예외 (코어/도메인 모노레포 혼재)                   | 엄격 적용 (`packages/exams/{id}/`)                   |
| 16   | Year 1: 함수 시그니처에 `examId` 의무 / 내부 WHERE 절 미적용   | Year 2: 시그니처 + WHERE 절 둘 다                    |
| 17   | `EXAM_IDS.SON_HAE_PYEONG_GA_SA` 단일 선언 + `ExamId` 타입 경유 | 그대로 (확장 — 새 자격증 추가 시 EXAM_IDS 에만 추가) |
| 23   | placeholder README 만 (Year 1 데이터 적재 금지)                | 본격 활용 (민법 / 상법)                              |
