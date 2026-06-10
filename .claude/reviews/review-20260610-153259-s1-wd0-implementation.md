리뷰 방식: 독립 에이전트 5-페르소나 (s1-independent-review 워크플로우)

# S1 (WS-0 즉시 지혈) 구현 리뷰 — design-audit

- 날짜: 2026-06-10 15:32:59
- 대상: S1 (WS-0 즉시 지혈) 변경분, 미커밋, L2 (마이그/formula-engine/constants 미접촉)
- 리뷰 방식: 독립 에이전트 5-페르소나 (Surgeon / Architect / Advocate / Contract / Debt) + 발견별 적대적 반증 (실코드 file:line 대조)
- 판정: **완료 가능** (critical 0 / major 0 / minor 4 — 전부 선재·범위외·정당 트레이드오프 또는 커밋 위생 노트, S1 코드 결함 0)

---

## 1. 리뷰 범위 (10 파일)

| #   | 파일                                                    | WS-0 항목                                                                                                                 |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | `scripts/verify-engine-contracts.ts`                    | 0a (VITEST_PACKAGES +learning-modes 116·srs 35) / 0c (KNOWN_STUB_PACKAGES + checkKnownStubsIntegrity tripwire, Cat7 편입) |
| 2   | `.github/workflows/ci.yml`                              | 0a (test 필터 +learning-modes·srs)                                                                                        |
| 3   | `packages/srs/src/types.ts`                             | 0b (FsrsRating/FSRS_RATINGS 정본 이관)                                                                                    |
| 4   | `packages/srs/src/fsrs.ts`                              | 0b (import 출처 learning-modes→types.js)                                                                                  |
| 5   | `packages/srs/src/index.ts`                             | 0b (FSRS_RATINGS/FsrsRating barrel export)                                                                                |
| 6   | `packages/srs/package.json`                             | 0b (@thepick/learning-modes 역의존 제거)                                                                                  |
| 7   | `packages/learning-modes/src/types.ts`                  | 0b (FSRS_RATINGS/FsrsRating 제거 — srs 로 이관)                                                                           |
| 8   | `apps/api/src/study/routes.ts`                          | 0b (FsrsRating import 출처 변경) / 0f (buildShuffledChoices distractor 안전 가드)                                         |
| 9   | `apps/api/src/eval/__tests__/multihop-accuracy.test.ts` | 0e (parseRelatedNodes 무절단 비동치 잠금 +1)                                                                              |
| 10  | `apps/api/src/study/__tests__/routes.test.ts`           | 0e (malformed related_nodes route 바인딩 +1) / 0f (distractor 가드 +3)                                                    |

연관 파일 (변경 없음, 검증 대조 대상): `apps/api/src/db/schema.ts`, `migrations/0034_study_reviews.sql`, `packages/learning-modes/package.json`, `packages/study-material-generator/src/index.ts`, `packages/payment/src/{index,providers/mock}.ts`, `packages/parser-1st-exam/src/`, `apps/api/src/study/{normalize,multiple-choice,fill-blank}.ts`, `apps/web/.../QuestionCard.tsx`, `docs/plans/.../MASTER_PLAN.md`, `docs/plans/.../OPUS48_EXECUTION_PLAYBOOK.md`.

### 검증된 기반 사실 (재확인 가능)

- api 676 passed / 0 failed · srs 35 · learning-modes 116 · multihop 17 · verify-engine-contracts Overall PASS · `pnpm -r lint` clean(변경분).
- `pnpm -r typecheck` 의 `apps/admin-web GraphVisualizer.tsx:17` FAIL 은 **기존** 결함(NodeType Table-KG 확장 미추종) — 본 변경과 인과 무관(admin-web 은 srs/learning-modes/api 미의존). 본 리뷰 비귀속.

---

## 2. 페르소나별 발견 요약

### ① Surgeon (런타임 정합·null/async/경계·fail-safe)

- 신규 발견 없음(확증). 적대 반증으로 3건 기각(`S1-SURG-01/02/03`): 0f normalize over-collapse·tripwire false-negative·`buildShuffledChoices` /next↔/grade 비대칭 — 전부 위해 경로 0의 의도된 fail-safe.

### ② Architect (결합도·경계·단일 진실원)

- 확증 2건(전부 minor): `ARCH-1`(schema.ts FSRS_RATINGS 이중 진실원), `ARCH-3`(tripwire false-negative — 서브디렉토리 우회).
- 적대 반증으로 2건 기각(`ARCH-2`: stubMarker 정확매칭 false-positive = 의도된 결정성 / `ARCH-4`: srs/types.ts 주석 스코프 + fan-out 사실오류).

### ③ Advocate (UX·정답 안전·보안)

- 신규 발견 없음(확증). 정답 안전: 0f 가드 로그는 `collisionIndexPairs`(index 쌍)·`answerCollides`(bool)만 — **정답 원문 누출 0** 확인(routes.ts:425 주석 + :436-437). 적대 반증으로 2건 기각(`ADV-1`: tripwire 스코프 문서 과장 / `ADV-2`: answer index-0 가정 = WS-1 상속 부채, 가드 제어흐름 미참여).

### ④ Contract (요구사항 대조·Silent Pivot·scope creep)

- 확증 1건(minor, 하향): `C-1`(multihop-accuracy.ts 코어 변경 = WS-4c 결재 게이트 항목이 미커밋 working tree 에 혼입). 적대 반증으로 1건 기각(`C-2`: 0d 미구현 = 결재 대기 정당 분리, S1 스코프 명시 제외).

### ⑤ Debt (기술부채·6개월~2년 horizon)

- 확증 1건(minor): `DEBT-2`(tripwire 비재귀+`.ts` 한정 false-negative — ARCH-3 와 동일 진앙). 적대 반증으로 2건 기각(`DEBT-1`: payment/parser-1st-exam 테스트 부재 = 선재·이미 roadmap 추적 / `DEBT-3`: normalize dedup 술어 = 채점 동치와 일관, 제안 fix 가 오히려 유해 / `DEBT-4`: floor 게이트 = 수용된 트레이드오프).

---

## 3. 적대 반증 결과 (확증 / 기각)

### 확증 (생존, 전부 minor)

| id     | 페르소나  | severity | 파일:라인                                        | 핵심                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------ | --------- | -------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ARCH-1 | Architect | minor    | `apps/api/src/db/schema.ts:149`                  | FSRS_RATINGS 로컬 리터럴이 srs 정본(`packages/srs/src/types.ts:16-17`)과 이중(실제 3중: `migrations/0034_study_reviews.sql:24` raw CHECK 포함) 진실원. 정본 이관은 명확해졌으나 schema 소비처가 정본 미재사용 → drift 표면 잔존. **선재 코드**(2026-05-12 commit fa4eb677), WS-0 diff 가 schema.ts 무접촉 = 본 변경 회귀 아님. devil's advocate 실증: srs barrel(`index.ts:35`)이 ts-fsrs 동반 export → `@thepick/srs` 직접 import 시 무거운 의존이 Drizzle 순수선언/Workers 번들에 유입 위험 = "그냥 import" 무료 아님. 마이그 SQL CHECK 는 어떤 TS 패키지도 import 불가 = 구조적 불가피. ⇒ minor 정확. 권고: schema.ts:149 위 "정본=@thepick/srs/types, 변경 시 동시 갱신" 주석 1줄 + verify-engine-contracts 동치 tripwire 1줄 + `migrations/0034:13` stale 주석(learning-modes 참조) 정정.          |
| ARCH-3 | Architect | minor    | `scripts/verify-engine-contracts.ts:1343`        | tripwire stub 판정이 `readdirSync(srcPath)` (non-recursive) + `.ts` 한정 → `src/generators/build.ts` 하위 실구현 + `index.ts='export {};'` 유지 시 PASS(false-negative). 재현 확인: nonIndex=[] 우회 → violations=0. 저자가 동 파일 L789(Cat10)에서 "readdirSync non-recursive" 한계를 이미 주석화했으나 checkKnownStubsIntegrity 엔 미적용 = 일관성 공백. defense-in-depth 2차 장치(테스트 자체는 수동 등록 시 정상 실행)·의도된 stub 1개 대상·서브디렉토리 신규는 PR 리뷰서 conspicuous = minor.                                                                                                                                                                                                                                                                                                      |
| DEBT-2 | Debt      | minor    | `scripts/verify-engine-contracts.ts:1343-1348`   | ARCH-3 와 동일 진앙. 추가 확증: payment 서브디렉토리 전례 실재(`packages/payment/src/providers/mock.ts`), 라이선스 헤더 주석 추가 시 stubMarker 정확매칭 즉시 FAIL(과민). 통상 착수(src 루트 flat `*.ts`)는 잡으므로 secondary 경로 = minor. 권고: `readdirSync(srcPath,{recursive:true})` + 확장자 화이트리스트(.ts/.tsx/.js/.mjs) + "src 하위 非index 소스 수 > 0" 1차 트립.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| C-1    | Contract  | minor    | `apps/api/src/eval/multihop-accuracy.ts:351-360` | `formatReportMarkdown` 판정기준 헤드라인이 "hit-rate − baseline" → "hit-rate@5 와 mean-recall@5 동급 헤드라인" + "hit-rate 단독 해석 금지" 경고(+8/-4) 신설. 출처 "감사 §5 #6"(`g-s5-multipersona-audit-20260602.md:82`) = MASTER_PLAN §4c "G-S5 잣대 강화 3종"(WS-4, **전 항목 결재 의존**). S1 5항목(0a/0b/0c/0e/0f) 어디에도 미귀속. **그러나 S1-저작 Silent Pivot 아님**: 대화시작 git status 스냅샷에 이미 `M`, HEAD(9503f68)는 구 헤드라인 보유 = **선세션(06-02) 미커밋 잔여물**. 0e 실제 diff 는 test-only 로 정합. 실질 위험 = 커밋 위생(git add 를 10-파일 S1 세트로 한정하지 않으면 잔여물·sw.js·AuthForm·settings.json 동반 입력). markdown 문자열 변경(로직 결함 0·가역). ⇒ major→minor 하향. 권고: 커밋 staging 한정 + 이 파일은 WS-4c 결재 후 별도 커밋(또는 06-02 감사 결재 귀속 명시). |

### 기각 (참고 요약, 14건)

- `S1-SURG-01` (Surgeon): 0f normalize over-collapse(①/1, 5번/5) — 기전 참이나 위해 0(fail-safe 거부→fill_blank), production distractor 코퍼스 미존재 = 순수 가설. 본인 "오작동 아님" 자인. **dropped**.
- `S1-SURG-02` / `ARCH-2` / `S1-SURG-03` (tripwire/marker 변형): non-recursive false-negative·정확매칭 false-positive·/next↔/grade 비대칭 — 전부 의도된 결정성/방어선이며 정상 전환 경로(index.ts 우선 수정)에선 동작. **dropped**.
- `ARCH-4` (Architect): srs/types.ts 주석 스코프 — 주석은 타입정의 적정 스코프, learning-modes fan-out 불변(여전히 shared only), 사실오류 포함. **dropped**.
- `ADV-1` (Advocate): tripwire "silent PASS" 스코프 과장 — 인용 부정확(ci.yml 에 "silent PASS" 문구 없음), 코드는 좁은 스코프(stub 1건 전환) 내 정확. **dropped**.
- `ADV-2` (Advocate): answer index-0 가정 vs label/index 채점 상충 — WS-1 "MC 채점 3중 모순"(결재 #2) 상속 부채, `answerCollides` 제어흐름 미참여(로그용). 가드는 순수 텍스트 중복만 검사 = 제약 #3(WS-1 직교) 준수. **dropped**.
- `C-2` (Contract): 0d 모드 UI 미구현 — S1 스코프 명시 제외 + `[결재-경량]`(MASTER_PLAN:113) 진산 미결정 = 자율 구현 시 오히려 결재 위반. plan ☐9 추적 중. **dropped**.
- `DEBT-1` (Debt): payment/parser-1st-exam 테스트 0 미감시 — payment production throw·호출처 0(orphan), roadmap+직전 리뷰(quality C-2/C-7) 이미 추적 = "false sense of coverage" 미성립. tripwire 스코프 의도적 한정. **dropped**.
- `DEBT-3` (Debt): normalize 의미 누수 — 가드 술어 = 채점(`fill-blank.ts:24-37`) 동치 술어와 일관(누수 아님). 제안 fix(공백만 접기)가 오히려 채점 모호성 노출 = 신규 결함 도입. **dropped**.
- `DEBT-4` (Debt): floor 게이트 단방향·이중 명단 — 수용된 트레이드오프, 이번 diff 가 둘 다 동기 등록(ci.yml:67-68 + verify:183-184), 카운트 실측 일치. **dropped**.

---

## 4. 심각도 매트릭스 (전수 file:line)

| severity    | count | 항목                                                                                                                                                                                                     |
| ----------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🔴 critical | **0** | —                                                                                                                                                                                                        |
| 🟠 major    | **0** | —                                                                                                                                                                                                        |
| 🟡 minor    | **4** | ARCH-1 `apps/api/src/db/schema.ts:149` · ARCH-3 `scripts/verify-engine-contracts.ts:1343` · DEBT-2 `scripts/verify-engine-contracts.ts:1343-1348` · C-1 `apps/api/src/eval/multihop-accuracy.ts:351-360` |

minor 4건 성격: ARCH-3/DEBT-2 = 동일 진앙(tripwire 비재귀 보강 갭, defense-in-depth 2차). ARCH-1 = 선재 잔존 부채(WS-0 무접촉). C-1 = 선세션 미커밋 잔여물 커밋 위생 노트(S1-저작 결함 아님). **S1 변경분 자체에 귀속되는 코드 결함 0건.**

---

## 5. S1 항목별 (0a~0f) PASS 근거

### 0a — CI 게이트 등록 (learning-modes 116 / srs 35) — PASS

- `scripts/verify-engine-contracts.ts:176-184` VITEST_PACKAGES 에 learning-modes(116)·srs(35) 추가 + `.github/workflows/ci.yml:64-68` test 필터 동시 등록(이중 명단 동기 — DEBT-4 확인). required 카운트 실측(learning-modes 116/srs 35 PASS)과 일치 = 단방향 감소 차단 floor(CRITICAL-A1, verify:1285) 정합.

### 0b — FsrsRating/FSRS_RATINGS 정본 이관 (learning-modes → srs) — PASS

- 의존방향: `packages/srs/package.json` 에서 `@thepick/learning-modes` 제거 → srs→learning-modes 역의존 차단(plan §7.3:375 정합). `packages/srs/src/types.ts:14-17` 정본 선언 + `index.ts:26/33` barrel export + `fsrs.ts:14-19` import 출처를 `./types.js` 로 전환. `packages/learning-modes/src/types.ts:17-18` 에서 제거(주석으로 이관 명시).
- 소비처 census 전수: srs 내부(types/fsrs/index 3) + `apps/api/src/study/routes.ts:64` 출처 learning-modes→srs 전환. **빌드 깨짐 0** (api 676 PASS·srs 35·learning-modes 116). FSRS 개념=SRS 엔진 소유 = Engine-First 정합(shared 아님). 잔존: schema.ts 로컬 중복(ARCH-1, 선재·범위외).

### 0c — KNOWN_STUB 무결성 tripwire 신설 (Cat7 편입) — PASS (보강 갭 minor)

- `scripts/verify-engine-contracts.ts:1310-1397` checkKnownStubsIntegrity + KNOWN_STUB_PACKAGES(study-material-generator 1건) + Cat7 boolean 배열 편입(:1458/1466). false-positive: stubMarker 정확매칭은 `.prettierrc semi:true` 로 `export {};` 강제 정규화 → prettier 재포맷 불일치 시나리오 불가(ARCH-2 기각). false-negative: 비재귀 서브디렉토리 우회(ARCH-3/DEBT-2 minor) — 통상 착수(index.ts 우선 교체)는 감지, 서브디렉토리 우선은 secondary 경로. 정상 전환 경로(index.ts='export {};'→실 export)에서 즉시 FAIL = 핵심 가치 작동.

### 0d — 모드 UI 노출 정책 — N/A (S1 스코프 외, 결재 대기)

- S1 프롬프트 스코프(0a/0b/0c/0e/0f)에 0d 미포함. MASTER_PLAN:113 `[결재-경량]`·☐9 진산 결재 대기 = 정당 분리(C-2 기각). 본 변경셋에 0d 작업 부재 확인(diff grep 0건).

### 0e — 계약 테스트 추가 (enrichRelatedNodes 무수정) — PASS

- `multihop-accuracy.test.ts:71-79` 무절단 비동치 잠금(+1, 25개>20 무절단 검증). `routes.test.ts:70-85` malformed related_nodes route 바인딩(+1, 비배열 JSON→빈 relatedNodes surface, raw INSERT = UPDATE 트리거 차단 우회). **enrichRelatedNodes(study/routes.ts, L3 user path) 무수정 확인** (diff 가 study/routes.ts 의 0f 가드만 변경, enrichRelatedNodes 본문 무접촉) = 진짜 단일화는 plan §5 carry-over 정합(test-only).

### 0f — distractor 안전 가드 (buildShuffledChoices) — PASS

- `apps/api/src/study/routes.ts:420-446` normalizeAnswer 동치·중복 distractor 검출 → 충돌 시 `return null` (fill_blank fallback, 안전 강등). WS-1(MC 채점 3중 모순, 결재 #2) **직교**: answer 라벨/텍스트 모호성 해소 미시도, 순수 normalize 동치·중복 텍스트만 검사(`originalTexts`=answer+distractors). **정답 안전**: 로그(routes.ts:436-437) = index 쌍(`collisionIndexPairs`)+bool(`answerCollides`)만, 정답 원문 누출 0. fail-safe: 위해 경로 0(최악=정상 MC→fill_blank 강등 UX 손실, 오채점 불가). 테스트 +3(routes.test.ts:103-138: 정답동치 distractor·distractor간 중복·전부 distinct).

---

## 6. 판정

**완료 가능** (critical 0 / major 0).

S1 변경분 자체에 귀속되는 코드 결함은 0건이다. minor 4건은 (1) 선재 기술부채(ARCH-1, WS-0 무접촉), (2) 신규 안전망의 보강 갭(ARCH-3/DEBT-2, 동일 진앙·defense-in-depth 2차), (3) 선세션 미커밋 잔여물의 커밋 위생 노트(C-1, S1-저작 아님)다.

### 커밋 전 권고 (차단 아님, 위생)

1. **C-1 커밋 분리**: `git add` 를 10-파일 S1 세트로 한정하여 선세션 미커밋 잔여물(`multihop-accuracy.ts` 코어 + `s5-6-g-s5-analysis.md` + sw.js/AuthForm/settings.json 등)과 물리 분리. multihop-accuracy.ts 코어(mean-recall headline)는 WS-4c 결재 후 별도 커밋.
2. **ARCH-1 (저비용)**: `apps/api/src/db/schema.ts:149` 위 "정본=@thepick/srs/types, 변경 시 srs/src/types.ts:16 동시 갱신 의무" 주석 1줄 + `migrations/0034_study_reviews.sql:13` stale 주석(learning-modes 참조) 정정. 선택: verify-engine-contracts 동치 tripwire 1줄.
3. **ARCH-3/DEBT-2 (선택)**: checkKnownStubsIntegrity 의 `readdirSync` 를 recursive 전환 또는 최소한 `scripts/verify-engine-contracts.ts:1343` 에 "non-recursive — 하위 디렉토리 실구현 미감지" 한계 주석(L789 선례 일관).
