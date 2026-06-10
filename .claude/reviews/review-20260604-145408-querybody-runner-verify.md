# 독립 리뷰 — queryBody 측정입력 무결성 + 러너 `--maxDepth` 변경

**리뷰 방식: 독립 에이전트 5개** (워크플로우 `wf_f5b13834-ef4` / Task `wy1mbt5z6`, 단일 메시지 병렬, 메인 작성맥락 미인지)
**리뷰 일시**: 2026-06-04 14:54
**원본 findings(전문·raw 인용)**: `/tmp/claude-1000/-home-soo-ClaudePro-ThePick/cd987353-7c51-4891-8035-20e6e781f508/tasks/wy1mbt5z6.output`
**스킬/프로토콜**: `.claude/rules/auto-review-protocol.md` (4-Pass + 증거기반 + 반론의무)

## 리뷰 범위 (변경 + 연관)

| 파일                                                                                                                                         | 종류               | 변경                                                               |
| :------------------------------------------------------------------------------------------------------------------------------------------- | :----------------- | :----------------------------------------------------------------- |
| `scripts/build-querybody-golden.mjs`                                                                                                         | 신규 (데이터 변환) | 골든 content → queryBody 파생 (제거전용·결정적·answer-leak assert) |
| `docs/plans/s5-6-measurements/golden-pilot-approved.querybody.json`                                                                          | 신규 (측정 입력)   | measurable 6 측정셋 (4→6 회복)                                     |
| `docs/plans/s5-6-measurements/querybody-removal-log.md`                                                                                      | 신규 (감사 로그)   | 문항별 원본→queryBody·제거 segment                                 |
| `scripts/measure-s5-6-multihop-accuracy.ts`                                                                                                  | 수정 (L2 코드)     | `--maxDepth` CLI 인자 추가 (감사 §5 #1 재측정용)                   |
| 연관: `golden-pilot-approved.json`(원본·무변경 확인), `graph-search-route.ts`(route 계약 대조), `multihop-accuracy.ts`(채점코어·미변경 확인) |                    |                                                                    |

## 판정 — **CRITICAL 0 / MAJOR 0 / MINOR 6 · 5/5 에이전트 PASS**

| 에이전트(렌즈)                | 판정    | findings | confirmedChecks |
| :---------------------------- | :------ | :------- | :-------------- |
| 추출 ANSWER-LEAK 헌터         | ✅ PASS | MINOR 1  | 6               |
| 추출 CONTENT-LOSS 헌터        | ✅ PASS | MINOR 1  | 7               |
| 추출 정책정합+순환편향 감사관 | ✅ PASS | MINOR 1  | 7               |
| 러너 4-Pass Surgeon+Architect | ✅ PASS | MINOR 1  | 5               |
| 러너 4-Pass Advocate+Contract | ✅ PASS | MINOR 2  | 6               |

### 핵심 무결성 확인 (증거 기반 — 추정 0)

- **answer-VALUE leak 0건**: measured 6 전수에 정답값/워크드풀이/해설 토큰 부재 (Q-012 결실완료·이론서103, Q-014 ①120·②110·③95·④4.8·⑤2.8, Q-015 19,600,000·자기부담금액을안분 전부 absent). 스크립트 내장 leakTokens assert EXIT=0.
- **부분집합 가드**: queryBody 모든 비공백 라인이 원본 content substring = 추가·수정 텍스트 0 (INJECTED 0건).
- **정답지 무변경**: `relatedNodesRaw`(채점 정답지) 6문항 전부 원본과 바이트 동일 — 파생이 정답지 미조작.
- **순환편향**: `build-querybody-golden.mjs` 검색호출(vector/graph) 0 = 문자열 제거뿐. 결정성 재실행 diff 0.
- **정책 정합**: 자료표 KEPT / 정답값·중복표·해설 REMOVED 7문항 전수 준수. Q-004 자료표 임의삭제로 회복시키지 않음(583자 정직 제외).
- **러너 route 계약**: maxDepth 1..4 강제·미주입 시 키 제거(원측정 byte-동치)·fabricate 가드(env+golden) 유지·coverage maxDepth provenance 각인.

## MINOR 6건 — 처리(disposition)

| #   | 출처              | 내용                                                                                               | 처리                                                                                                                                                         |
| :-- | :---------------- | :------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 추출 ANSWER-LEAK  | Q-012 등 expected CROP 노드명(오디/두릅/고구마)이 자료표에 본문으로 잔존 → vector "명칭-동형" 회수 | **별건(결재 큐 #6)**. 변환 결함 아님(출제가 준 표·진산 자료표 유지 결정). 재측정 리포트에 baseline recall 명칭-동형 각주 의무                                |
| 2   | 추출 CONTENT-LOSS | Q-004 자료표 유지로 583자 >500 측정 제외 = graph 표적 1건 잔류 누락                                | **의도된 trade-off(결재 #2)**. 정정 불필요. 헤드라인 N 옆 "Q-004 제외=정책 결과(정답누락 아님)" 명기                                                         |
| 3   | 추출 정책·순환    | #1과 동일(CROP 명칭 vector-friendliness), disclosure 완료                                          | **별건(#6)**. mean-recall 헤드라인 각주 유지                                                                                                                 |
| 4   | 러너 Surgeon      | `MAX_DEPTH_CEILING=4`가 route `MAX_ALLOWED_DEPTH` 하드코딩 복제 → desync 위험                      | **수정(주석 강화)**: route가 권위 게이트(>4 면 400)라 desync 돼도 안전 거부 명시                                                                             |
| 5   | 러너 Advocate     | `--maxDepth 1.5` → parseInt 1 무음 절단                                                            | **수정 완료**: 정수 문자열 정규식 강제(`/^[0-9]+$/`), 소수·비정수·음수 throw. 재검증 통과(1.5/-1 거부, 2/4 통과)                                             |
| 6   | 러너 Advocate     | 신규 CLI parseArgs 분기 단위테스트 부재(기존 --limit 동일)                                         | **수용+근거**: 러너는 CLI 전용·remote 게이트(미import). 검증 = 런타임 스모크 6케이스(9/0/abc/1.5/-1 throw, 1/2/4 통과) 영속. 채점 코어는 vitest 22 PASS 커버 |

## 반론(Devil's Advocate) — 영속 caveat

에이전트 공통 지적: **정답값 leak 은 0(무결)이나, fill-in-the-blank 문항은 expected 엔티티명(CROP)이 "출제가 준 자료표"에 본문으로 들어있어, 정답값을 다 빼도 vector 가 명칭 일치로 회수**한다. ⇒ N=6 재측정에서 baseline(vector) recall 의 일부는 "명칭-동형" 아티팩트일 수 있다.

**재측정 해석 규칙(의무)**:

1. graph 의 진짜 가치 = query 에 **이름이 없는** expected 노드(F-103 산식, INS-27 보장방식, LAW 등)를 edge 로 회수하는가 = graphOnlyRecovery 의 **비-명칭 노드** 분리 집계.
2. mean-recall@5 헤드라인에 "baseline recall 일부 = 명칭-동형(결재 큐 #6 미해결)" 각주.
3. 또 다른 사각: 본 검증은 substring 매칭 → 정답의 _의미 패러프레이즈_ 잔존은 못 잡음(단 measured 6 제거대상은 전부 리터럴 정답값/표/해설, 패러프레이즈 흔적 0).
4. content 원본 transcription 정확성(교재 대조)은 범위 밖 — 진산 검수 동결분 전제.

## 결론

- 코드(러너) **CRITICAL 0 / MAJOR 0** → "완료" 선언 가능. MINOR #4·#5 수정 완료, #6 근거 수용.
- 측정 입력(queryBody) 무결성 **PASS** — 정답값 leak 0, 문제내용 손실 0, 순환편향(채점층) 0, 정답지 무변경.
- 잔여 = **명칭-동형 편향(결재 큐 #6)** = queryBody 층에서 해결 불가(진산 자료표 유지 결정)·재측정 해석 각주로 관리.
- **다음 게이트**: 진산 queryBody draft 확인 + REMOTE 인증(`THEPICK_API_BASE`) → `--maxDepth 1` & `2` 재측정.

---

## 추가 검토 — 오프라인 후속 #5/#6 (2026-06-04, 독립 에이전트 2개)

**리뷰 방식: 독립 에이전트 2개** (feature-dev:code-reviewer + general-purpose, 병렬, 메인 작성맥락 미인지)
**대상 변경**:

- #6 `apps/api/src/eval/multihop-accuracy.ts` `formatReportMarkdown` — mean-recall@5 동급 헤드라인 + hit-rate binary 과대 경고 prose 추가 (감사 §5 #6)
- #5 `docs/plans/s5-6-measurements/s5-6-g-s5-analysis.md` §2 — node-ID 드리프트 캐비엇 추가 (감사 §5 #5)

**판정: 2/2 PASS — CRITICAL 0 / MAJOR 0 / MINOR 1**

| 에이전트      | 판정                | 핵심 confirmedChecks                                                                                                                                                                                                                 |
| :------------ | :------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 코드(포맷터)  | ✅ PASS, 0 findings | prose-only(scoreQuestion/aggregate/buildBucket/fmtBucket 산식 미변경) · 결정성·워터마크 보존 · G-6a 테스트 단언 비충돌 · markdown 구조 무결                                                                                          |
| 콘텐츠 정확성 | ✅ PASS, MINOR 1    | 캐비엇 audit §1 정합 · fabricate 0(ID 인용 _말리는_ 방향) · hit-rate binary 경고 = scoreQuestion(`bHit>0`) 정확 · **교차검증: baseline hit-rate 100% ≠ mean-recall 73.3% → hit-rate binary 자체 입증** · 결론(NO-GO 시기상조) 왜곡 0 |

**MINOR (수정 완료)**: 캐비엇 헤더 날짜 혼동 가능(정정 작성 06-04 vs 재현 실행 06-02) → 헤더를 "정정 기재 2026-06-04 / 재현 실행 2026-06-02"로 명료화.

**반론(영속)**: maxDepth=1 가역성의 근거는 N=1(Q-012 단건) 라이브 재현뿐. 캐비엇은 "Q-012 가역"(국소 명제)만 주장하므로 과장 아니나, 독자의 "graph regression 일반 가역" 과대확장 위험 → 캐비엇이 "결론(NO-GO 시기상조)에만 묶음"으로 차단. ⇒ maxDepth=1 **전수** 재측정(감사 §5 #1) 의무 재확인.

**eval 회귀**: `npx vitest run src/eval` = **22 PASS** (변경 전후 동일).
