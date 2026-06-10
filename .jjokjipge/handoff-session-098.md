# Session 098 진입 핸드오프 — ThePick (쪽집게)

> **본 핸드오프 = 098** (handoff-097 후속 = Session 097 종착).
> **종착 한 줄**: 진산 **결재 #2(golden query = 출제 본문만)** → **queryBody 파생**(measurable 4→6,
> graph 유효 multi-hop 표본 1→3) + 러너 `--maxDepth` 추가 + 오프라인 후속 #5/#6 →
> **독립 검증 7 에이전트(CRITICAL 0 / MAJOR 0)** → 진산 queryBody **확인 완료**.
> ★ **잔여 = REMOTE 인증(`THEPICK_API_BASE`) 단 하나** → maxDepth 1&2 재측정 → §7 재매핑 → GO/NO-GO.
> ⚠️ 이번 세션 산출물 **전부 미커밋** (진산 커밋 요청 시 진행). 전부 가역·production 미접촉.

---

## 브랜치 & 컨텍스트

- 브랜치 `main`. 마지막 커밋 `6c47b4e`(handoff-097). **이번 세션 변경 전부 working tree(미커밋·미스테이징)**.
- ⚠️ ultracode 모드 세션이었음. 차세션 opt-in 시 동일.
- 🚧 **G-1 기계강제 hook 활성** (`.husky/pre-commit` → `scripts/g1-forbidden-phrase.mjs`): docs/{research,plans,feasibility}
  새 줄 "가능합니다/완전자동/출판급" 류 = 커밋 차단. **커밋 전 `npm run g1:check` 권장** (본 세션 신규 docs 多).
- 🚧 **review-gate hook 활성**: 코드 변경 시 `.claude/reviews/review-*.md` 산출물 요구.
  이번 세션 충족물 = `.claude/reviews/review-20260604-145408-querybody-runner-verify.md`.
- **production Worker** = Version `07b5f47d` (graph 라우트 포함). `/api/search` 불변. production env 아직 Phase 2
  default(PASSWORD_MIN=4, HIBP=false) — launch toggle 대상([[feedback_test_env_password_dont_nag]]).

## 이번 세션(097)에서 한 일

1. **현 상태 브리핑** — 1차 NO-GO "시기상조" 교정 맥락 통독·요약.
2. ★ **진산 결재 #2** (`decision-card-q2-querybody-separation.md`): golden query = "출제 본문(발문+보기+빈칸+자료표)"만,
   **정답값·중복정답표·해설 제외**(A안 + 자료표 포함). AskUserQuestion 2회. 근거: 러너가 `content` 통째 전송
   (measure-s5-6:117) → route `query.max(500)`(graph-search-route.ts:79) 400 → graph 표적 multi-hop 4 중 3건(75%) 탈락.
3. ★ **queryBody 파생** (자율, 원본 골든 무변경): `scripts/build-querybody-golden.mjs`(제거전용·결정적·answer-leak assert)
   → `golden-pilot-approved.querybody.json`(측정셋 6) + `querybody-removal-log.md`(감사). **measurable 4 → 6**.
4. **러너 `--maxDepth`** (`scripts/measure-s5-6-multihop-accuracy.ts`): maxDepth=1 재측정용. 미주입 시 키 제거(원측정
   byte-동치), 1..4 정수 강제(소수·음수 throw), coverage provenance 각인.
5. **오프라인 후속 #6** (`apps/api/src/eval/multihop-accuracy.ts` formatReportMarkdown): mean-recall@5 동급 헤드라인
   - hit-rate binary 과대 경고 prose. **#5** (`s5-6-g-s5-analysis.md` §2): node-ID 드리프트 캐비엇.
6. ★ **독립 검증 7 에이전트** (CRITICAL 0 / MAJOR 0 / MINOR 8 전부 처리·별건):
   - 워크플로우 wf_f5b13834 (5): 추출 answer-leak/content-loss/정책·순환편향 + 러너 4-Pass 2패스 → 5/5 PASS.
   - 후속 #5/#6 (2): 코드 정합 + 콘텐츠 정확성 → 2/2 PASS.
   - 영속: `.claude/reviews/review-20260604-145408-querybody-runner-verify.md`(2 섹션). eval 코어 **22 PASS** 회귀 0.
7. 게이트 #1 = 진산 queryBody **확인 완료** (2026-06-04 "그냥 출제된 문제일 뿐" = 본문 정확).

## queryBody 회복 결과 (measurable 4 → 6)

```
Q-031 / Q-2022-08-045 / Q-2023-09-045   변경 0 (정답 미내장 LAW)    ✅측정 single
Q-2025-11-2ND-012   391 → 181   정답매핑·해설 제거 (= regression 문항 query 정화)   ✅측정 multi
Q-2025-11-2ND-014   501 → 270   중복 정답표 제거                                     ✅측정 multi
Q-2025-11-2ND-015   922 → 398   워크드 풀이·해설 제거                                ✅측정 multi
Q-2025-11-2ND-004   595 → 583   ➡정답만 제거(자료표 유지) = 여전히 >500            ⛔미회복(정직)
```

→ graph 유효 표본 multi-hop **1 → 3**(Q-012/014/015). 1차 측정 치명약점(N=1) 해소.

## 핵심 산출물 위치

| 파일                                                                    | 역할                                                                                           |
| :---------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------- |
| `docs/plans/s5-6-measurements/decision-card-q2-querybody-separation.md` | ★ 결재 #2 카드 (§7 결재됨 / §9 진산 인사이트=근거 UX)                                          |
| `docs/plans/s5-6-measurements/golden-pilot-approved.querybody.json`     | ★ **측정 입력**(measurable 6, content=queryBody). 진산 확인·검증 PASS, REMOTE 대기             |
| `docs/plans/s5-6-measurements/querybody-removal-log.md`                 | 감사 로그 (문항별 원본→queryBody·제거 segment)                                                 |
| `scripts/build-querybody-golden.mjs`                                    | queryBody 변환 (제거전용·결정적·answer-leak assert). `node scripts/build-querybody-golden.mjs` |
| `scripts/measure-s5-6-multihop-accuracy.ts`                             | 측정 러너 (`--maxDepth` 추가). root 에서 `./apps/api/node_modules/.bin/tsx`                    |
| `apps/api/src/eval/multihop-accuracy.ts`                                | 채점 코어 (formatReportMarkdown mean-recall 헤드라인 #6)                                       |
| `docs/plans/s5-6-measurements/s5-6-g-s5-analysis.md`                    | 1차 분석 (§2 node-ID 캐비엇 #5)                                                                |
| `.claude/reviews/review-20260604-145408-querybody-runner-verify.md`     | 독립 검증 7 에이전트 영속                                                                      |
| `golden-pilot-approved.json`                                            | 진산 검수 동결 원본 (불변 — 정답·해설 보존처)                                                  |

## 다음 할 일 (차세션 1차 액션)

### A. ★ REMOTE 재측정 (잔여 게이트 = 진산 인증 단 하나)

진산 Cloudflare 인증 세션에서 `THEPICK_API_BASE=<production Worker URL>` 주입 → Claude 가 실행:

```
cd /home/soo/ClaudePro/ThePick
G=docs/plans/s5-6-measurements/golden-pilot-approved.querybody.json
THEPICK_API_BASE=<url> ./apps/api/node_modules/.bin/tsx scripts/measure-s5-6-multihop-accuracy.ts --golden $G --maxDepth 1
THEPICK_API_BASE=<url> ./apps/api/node_modules/.bin/tsx scripts/measure-s5-6-multihop-accuracy.ts --golden $G --maxDepth 2
```

→ 두 리포트 산출 → §7 분기 재매핑 → feasibility R5 / 진산 GO/NO-GO(RULE #5).

**재측정 해석 규칙 (의무 — 검증이 밝힌 잔여 편향)**:

1. fill-in-blank 자료표에 expected CROP 노드명(오디/두릅/고구마)이 본문 잔존 → vector 명칭일치 회수 = baseline recall 일부 아티팩트(결재 큐 #6, queryBody 층 해결불가).
2. ⇒ graph 진짜 가치 = **query 에 이름 없는 expected 노드**(F-103 산식·INS-27 보장방식·LAW)를 edge 로 회수 = graphOnlyRecovery **비-명칭 노드 분리 집계**.
3. mean-recall@5 를 hit-rate 와 **동급** 으로 읽기(hit-rate binary = expected N중 1회수도 hit=1 → baseline 과대).
4. N=6 신호(통계 일반화 아님). 손해평가 도메인 한정.

### B. 진산 결재 큐 잔여 6항 (`g-s5-multipersona-audit-20260602.md` §4)

#1 −25/−33% 절대값 임계 사용 여부 / #3 graph 재설계 (a)hop감쇠 vs (b)truthWeight우선권제거 / #4 §7 NO-GO 규칙
N≥30 한정 / #5 unmeasurable 분모제외 재확인 / #6 expected "추론경로" 재정의 / #7 Q-012 라벨 동의.

### C. ★ 진산 인사이트 carry-over — 근거 기반 학습 UX (결재 카드 §9)

"queryBody = 출제된 문제 / 분리된 정답·해설 = 학습자 정답확인·해설(근거 기반·정확)." 보존된 정답·해설을 학습자
노출용으로 = 문항당 구조화 {question, answer, explanation, sources(FK)} 필요. = [[project_source_citation_requirement]]

- [[project_multi_source_choice_basis_track]] (Phase B pilot 시범 → Phase C 545 전수 BATCH+공식해설집).
  **G-S5 측정 완료 직후 Phase B 진입 결재 상신 의무.** 즉시 행동 없음 — 측정 우선.

### D. (보류) 기존 게이트 — 측정과 별개

게이트 #3 마이그 0038 + 백필(`wrangler --remote`, 진산 전용, 학습자 study 경로용 — 측정엔 불필요).
Phase 2/3 closure TR-1~TR-4 (~109h, graph 판단 후 직렬).

## 주의사항

- ⛔ **GO/STOP = 진산** (RULE #5). 메인은 🟢🟡🔴 사실 + §7 매핑만.
- ⛔ **측정 fabricate 금지** — REMOTE + golden + env 주입만 유효(러너 `assertRemoteMeasurementInputs` 가드).
- ⛔ graph A 통합 코드 착수 = §7 GO + 별도 결재 후. 백필/마이그 production 적용 = 진산 인증.
- ⛔ AI 페르소나/에이전트 = 의심·플래그만, 정답 확정 금지. 주장은 메인이 production raw 재현 후 사실 확정
  ([[feedback_cycle_closure_realcode_gate]]).
- **커밋 미실행** — 진산 요청 시. 커밋 전 `npm run g1:check` + review-gate 산출물 존재 확인.
- 원본 골든 `golden-pilot-approved.json` **불변** (정답·해설 보존처 — 절대 수정 금지).

## 차세션 1차 액션 (순서)

1. CLAUDE.md "현재 상태"(Session 096 블록까지) + 본 handoff-098 통독.
2. memory `project_s5_6_eval_measurement_gate`(Session 097 갱신분) + `feedback_multipersona_accuracy_audit` 통독.
3. `decision-card-q2-querybody-separation.md` + `querybody-removal-log.md` 통독 (측정 입력 확인).
4. **진산 REMOTE 인증 받아 A(maxDepth 1&2 재측정) 실행** → 해석 규칙 적용 → 진산 GO/NO-GO. 또는 진산 지시 우선.
