# Phase N 기술부채 리뷰 — quality-engineer

- ts: `20260714-012918`
- 관점: 테스트 부채 — "프로덕션에서 뭐가 물릴까?"
- 합계: CRITICAL 0 / MAJOR 3 / MINOR 2

---

## QA-1 (MAJOR) — 정답 100% Hard Stop 구조 가드(serving-guard) 삭제 → 인증 학습 오채점 회귀 테스트가 데이터-상태 스냅샷으로 대체

- 파일: `apps/api/src/study/routes.ts` (697-698, 1121-1122) + 삭제된 `apps/api/src/study/serving-guard.ts` (49행)

P4 C-1 에서 도입했던 serving-guard.ts 가 0044 완결(b6f2a9f)과 함께 삭제. 동시에 routes.test.ts '★C-1 서빙 가드' describe 블록 전체(8 it, 특히 `/grade — old 행 채점 → 422 QUESTION_NOT_GRADABLE`) 제거. 인증 `/study/grade` fill_blank 분기(697-698)는 parseMcAnswerLabels 위치라벨 가드 없이 gradeFillBlank 직접 호출 — 공개 표면 routes.ts:475 는 가드 유지하는데 인증 경로 미유지 = 비대칭 재발. answer='2'(위치라벨) 활성 1차 fill_blank 행 서빙 시 '2' 입력이 '정답' 오채점(정답오류 36 인시던트와 동일 클래스). 대체물 migration-0044 test 는 '행이 deprecated 상태다' 데이터 스냅샷만 검증, '활성 MC-in-disguise 행이 나타나면 거부되는가' 구조 불변식 미검증.

- **★교차: devops DO-1(CRITICAL, 무음 오채점 알림 미배선)과 동일 근본(라이브 채점 무음 오채점 안전망 공백). RC-2 진앙 — 구조 백스톱(QA-1) + 관측 백스톱(DO-1) 양쪽 결손.**
- 반론: 현재 해당 클래스 행 전부 0044 로 deprecated → active 필터 404 자연 배제 = 오늘 오채점 물리적 불가(latent). routes.ts:929 주석이 '신규 1차 적재 = answer-계약 게이트 의무' 프로세스 게이트 명시 → CRITICAL 아닌 MAJOR. 다만 프로세스 게이트≠테스트, 인증 경로엔 구조 백스톱 자체 부재.
- Horizon: 다음 1차 콘텐츠 적재(BE-1 보기추출 = 로드맵 확정, 활성 1차 MC 대량삽입) 또는 수동 active insert — 6개월 내. 인시던트 이력상 재발 확률 높음.
- 권고: 인증 study 경로에 공개 isServable 동형 구조 가드 복원(단일 정본 공유) 또는 fill_blank 분기에 parseMcAnswerLabels!==null → 422 + 회귀 테스트('활성 1차 fill_blank 위치라벨 answer 오채점 안 함')를 데이터-스냅샷과 별도 영속. 데이터 불변식에만 의존 금지.

## QA-2 (MAJOR) — CI ×3 perf slack 이 PRF-01/PRF-02 회귀-검출 BREAKER 게이트를 실제 실행 환경(CI)에서 무력화

- 파일: `packages/quality/src/__tests__/prf-02-naive-vs-tarjan.test.ts` (79, 138) + `packages/formula-engine/.../prf-01-formula-engine-perf.test.ts` (47,59)

PRF-01/02 는 '지수 퇴행 회귀 검출'·'Tarjan 도입 트리거' 목적의 BREAKER. CI 편차 완화 위해 `CI_SLACK = CI ? 3 : 1` 도입, 모든 임계 ×3. 결과: N=10K naive DFS Tarjan-트리거(prf-02:138)가 CI 에서 p99 200ms×3=600ms 에서만 발화 → 알고리즘이 실제 최대 3배 퇴행해도 CI green 유지. 로컬 원값은 개발자 수동 실행 시에만 유효, 매 push 판정처는 CI. ×3 은 편차 흡수를 넘어 회귀 흡수 구간까지 삼킴.

- 반론: 공유 CI 러너 편차 실측 ~2×+(2026-07-12 p99 6.3/5ms, 67.9/60ms) → flaky red 방지 정당. 6배 이상 폭주는 여전히 포착 → MINOR 강등 가능하나, '지수 퇴행 검출' 명시 목적 대비 3배 맹점은 목적 훼손 수준 → MAJOR 유지.
- Horizon: 그래프 노드 증가(~800→BATCH 확장) 또는 formula-engine/graph-integrity 회귀 6~24개월 — 트리거가 잡아야 할 사건을 CI 에서 놓침.
- 권고: ×N 곱셈 대신 (1) CI 상대-회귀 baseline(직전 커밋 Δ% 임계) 또는 (2) 반복수 증가+중앙값/CPU-time 통계 흡수. 최소 ×3→×1.5 축소, Tarjan 트리거 임계만은 절대값 유지.

## QA-3 (MAJOR) — PRF-01 성능 골든이 6/51 산식 동결 + 커버리지 단언 영구 green (산식 실개수 99+/157 증가)

- 파일: `packages/formula-engine/src/__tests__/prf-01-formula-engine-perf.test.ts` (29-36 6 sample, 66/146-153 totalFormulas=51·coverage>=10%)

'51 산식 처리 속도' 검증한다며 6 sample 측정, 나머지 선형 비례 '추정'(69,146). '51 expansion 은 BATCH-1 적재 시 derive 의무'(9-13) 미이행. 코드 레지스트리 F-01~F-99(D1 157건)인데 totalFormulas=51 하드코딩(66), 진행 단언 `coveragePercent >= 10`(151) → sample 6개인 한 영구 통과 = self-fulfilling green(커버리지 나빠져도/산식 100개 추가돼도 red 안 됨). 복잡 산식(삼각·지수·복소수 예정) p99 회귀 불가시.

- 반론: AST 파싱 지배적·구조 유사도 높아 6 sample 대표성 일부. handoff-032부터 PARTIAL 정직 표기(은폐 아님). 그러나 1년+ 방치 + 51→99+ 로 대표성 가정 붕괴 + 단언식이 회귀를 구조적으로 못 잡음 → MAJOR.
- Horizon: formula-engine trig/exp 확장(별건 L3) 적재 직후 — 신규 복잡산식 성능/캐시 회귀 측정 대상 미포함. 이미 1년+ stale.
- 권고: totalFormulas 를 레지스트리 동적 도출, sample 을 등록 산식 전수/대표계층 샘플링 fixture-derive 를 BATCH 로더 연동. 커버리지 단언은 영구-green 하한 대신 실목표(80%)/회귀-only.

## QA-4 (MINOR) — G-S5 북극성 골든 통계 유의도 N=19(measurable) < 감사 자체 N≥30 기준 + 확대셋 N=34 미검수(순환편향 차단)

- 파일: `docs/plans/s5-6-measurements/g-s5-v2-facts-20260707.md` (+ golden v2 N=34)

3차 실측(N=19 진성 multi 8) graph depth1/2 모두 순손실·graphOnlyRecovery 0 신호 일관되나, 06-02 다각감사가 절대값 임계 규칙에 'N≥30 한정' 못박음. golden 확대(draft N=34) 검수는 '생성자=승인자 순환편향'으로 Fable 위임 정직 거절 = 진산 R5 대기. 북극성 측정이 통계적 결론 도달 경로가 인간 게이트에 막혀 '측정은 있으나 유의도는 구조적 미달' 상시 부채.

- 반론: 코드 회귀 아닌 측정과학 부채, CLAUDE.md·feasibility·memory 광범위 문서화(은폐 아님). RULE #5 상 GO/NO-GO 인간 결정 → AI 강행 불가. 스팟 5/5 반증 실패 등 대체 백스톱 존재 → MINOR.
- Horizon: graph-walk 재설계(S5-8) 착수 판단 시점 — N<30 채로 GO/NO-GO 시 과잉일반화(06-02 이미 교정) 재발 위험.
- 권고: 순환편향 없는 독립 라벨러/게이트 설계(측정대상 vector/graph 미노출) 또는 N<30 구간 부트스트랩 신뢰구간 병기. 결론 표현은 '시기상조' 유지.

## QA-5 (MINOR) — E2E mock-server 는 응답 shape 만 satisfies 컴파일 강제, 채점/경계 '행위'는 손수 재구현 (행위 계약 드리프트가 테스트 통과)

- 파일: `apps/web/e2e/mock-server/server.ts` (333/373/383/397/404 satisfies Public\*Result)

RC-5 로 계약 shared 단일화 + satisfies 로 응답 shape 컴파일 강제는 좋으나 shape 만 보장. mock 의 채점 판정·exam_type=1st 서버고정·status=active 경계·MC-in-disguise 422·choice_id defect 이벤트는 손수 로직. 서버 public/routes.ts 가 경계/채점 규칙을 바꿔도 mock 동일 shape 반환 green 유지 → 프론트 E2E 가 실제와 다른 채점 행위 검증 가능.

- 반론: E2E mock 목적은 프론트 렌더/플로우, 서버 채점은 api/routes.test.ts 가 실 SQLite 커버 = 설계상 정상 분업(MINOR). 다만 안전-임계 행위(2차 누출·flagged)가 mock 에서 느슨하면 프론트 잘못된 UX 가정 굳힘.
- Horizon: 서버 public 계약 채점/경계 규칙 개정 시(2차 확장, distractor BATCH) — mock 행위 stale, 거짓 green 6~18개월.
- 권고: 핵심 안전행위(경계강제·MC-in-disguise 거부·정답 비노출)에 서버 routes.test.ts 와 공유하는 '계약 행위 golden'(입력→기대 status/error 표) 배치, 또는 최소 mock 에 회귀 위험 명시 + 서버 계약 변경 시 mock 동반 갱신 체크리스트.

---

## checkedItems (증거 기반 PASS/N-A)

- PASS — 공개 표면 채점 안전: public/routes.ts:169-180 isServable + 475 parseMcAnswerLabels 가드 + routes.test.ts:178-183,371-383 (MC-in-disguise 서빙·채점 422 회귀 2건) 실 SQLite 커버 — 공개 경로 구조 백스톱 건재
- PASS — 공개 경계 강제 회귀(2차/flagged 누출): public/routes.ts:392,535 양쪽 WHERE + routes.test.ts:159-176,346-357,497-505 3표면 회귀
- PASS — choiceId 왕복/위조 거부: choice-id.test.ts:26-60 왕복·타문항·길이·캐시격리(D-27)·결정성. 24-hex 절단 충돌 확률 무시가능(강등)
- PASS — choice_id defect 텔레메트리: routes.test.ts:268-316 unresolved/malformed 버킷 분리 + 정상복원 미발행 3케이스 (D-17)
- PASS — 마이그 0044 상태머신: scenarios/migration-0044:78-146 백링크 有/無·트리거 byte-동일·멱등·비대상 무접촉 (단 구조 불변식 아님 = QA-1)
- N/A — Formula Engine 산식 정확도 골든(수치 100%): 본 리뷰 범위 변경 없음. PRF-01 은 '성능' 골든이며 '정확도' 골든과 별개(별도 스코프)
- PASS — 신규 .mjs 스크립트 테스트 존재: deploy-lib.test.mjs, public-analytics-reader.test.mjs (node:test 기반 — grep 0 은 프레임워크 차이일 뿐 실재)
- PASS — streak-strip 순수 헬퍼 테스트: streak-strip.test.ts 15 assertion (D-29)
