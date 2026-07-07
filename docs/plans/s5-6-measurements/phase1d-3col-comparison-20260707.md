# Phase 1-D 3열 비교 측정 — vector vs graph vs lexical (2026-07-07, #8 재상신 자료)

> **RULE #5**: 사실만 못박는다. GO/NO-GO 판정 = 진산.
> 환경 = `wrangler dev --env production --remote` **동일 세션·동일 빌드**(production 무배포 — plan rev3 M-4).
> 환경 무결 검증: graph 열이 production 07-07 실측과 **수치 완전 일치**(73.7/68.4/−5.3/reg 1) = confound 0.
> golden = v2 querybody(N=34, measured 19 — `g-s5-v2-facts-20260707.md` §1과 동일 분모·제외집합 3열 동일 0/0).

## 1. 3열 비교표 (measured=19)

| 지표              | **vector (baseline)** |    **graph (depth1)** | **lexical (D안, ε=0.03)** |
| :---------------- | --------------------: | --------------------: | ------------------------: |
| hit-rate@5        |                 73.7% |  68.4% (**Δ −5.3%p**) |      **78.9% (Δ +5.3%p)** |
| mean-recall@5     |                 39.0% |      36.3% (Δ −2.8%p) |          40.1% (Δ +1.1%p) |
| onlyRecovery      |                     — |      **0** (3차 연속) |     **1** (Q-2022-08-049) |
| regression (악화) |                     — | **1** (Q-2020-06-050) |                     **0** |

- **ε 감도 스윕**(M-5 — 측정셋 유래 파라미터의 과적합 검증): ε ∈ {0.01, 0.03, 0.05} 전 구간 **hit 78.9% 동일·regression 0 동일·onlyRecovery 동일(같은 문항)**. recall 만 ε=0.05 에서 41.2%(+2.1%p)로 소폭 상승. ⇒ 결과는 ε 튜닝 산물이 아님.
- onlyRecovery 의미 각주(rev3 C-N1): lexical 의 onlyRecovery = **pool 내 rank(topK+1..10] 표적의 top-K 진입**(주입 없음) — graph 의 외부 노드 주입 회수와 의미 상이.

## 2. 개선 귀속 (G-1D-5 순환 공정성 — 정직 분해)

- **hit 개선 = 정확히 1문항**(Q-2022-08-049, 1/19 = +5.26%p 전량). 해당 문항은 hop 재검(07-07)에서 multi→single 정정된 문항 — expected INV-054 의 **name 에 정답 어구('과실손해조사'·'복분자')가 그대로 포함 = NAMED 세그먼트**(명칭-동형 아티팩트의 직격 수혜 — lexical LIKE 매칭이 구조적으로 유리한 클래스).
- **NOT-NAMED 세그먼트 개선 = 0.** ⇒ "+5.3%p"를 lexical 일반 능력으로 읽으면 과대해석(Anchor 3 그대로).
- **가장 단단한 사실 = regression 0**: graph 는 개선 없이 악화만(1~3문항 파괴), lexical 은 악화 0 + NAMED 1 개선 + recall 소폭 개선. "무해 vs 유해"의 대비가 hit 숫자보다 강한 신호.

## 3. 게이트 이행 원장 (G-1D-1~6)

| Gate    | 판정                                                                                                                                                                                                                       |
| :------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G-1D-1  | ✅ /api/search 무접촉(user-search/routes/multi-path diff 0 — keyword-fallback read-only import) + api 738 전체 PASS                                                                                                        |
| G-1D-2  | ✅ mode 미지정 = lexicalFusion 키 부재(테스트) + graph 열 동일 세션 수치 = production 07-07 완전 일치                                                                                                                      |
| G-1D-2b | ✅ lex 전원 0 완전 동치(동점 포함 120 시행) + ε=0 동점-lex 개입 의도 테스트 분리(rev3 M-N1)                                                                                                                                |
| G-1D-3  | 🟡 부분 — ε 0.01/0.03 독립 2실행이 recall 자릿수까지 완전 동일(per-question 동작 동일 = 간접 재현성). 동일-config 명시 2회는 dev 세션 Vectorize 504 간헐(문서화된 ~1/5 클래스)로 미완 — production 적용 시 확정 권장(원장) |
| G-1D-3′ | ✅ property 테스트(20풀 × 60셔플 × ε 3종 — 키-시퀀스 유일 + 인접 불변식) + rev1 순환 반례 단일 출력 회귀 가드                                                                                                              |
| G-1D-4  | ✅ baseline 열 3열 상호 일치(73.68…% 동일) + 제외집합(no_seed 0·unmeasurable 0) 전 열 동일                                                                                                                                 |
| G-1D-5  | ✅ NAMED/NOT-NAMED 분해 = §2 (golden 무변경 — 판별은 expected 노드 name↔query 어구 대조)                                                                                                                                   |
| G-1D-6  | 🟡 부분 — lexical_search_ok 로그 라인 배선(구현 완료·테스트 관측). dev 세션 p95 표는 미산출(504 간헐로 표본 오염) — production 적용 후 산출 원장                                                                           |

## 4. #8 재상신 팩트 요약 (판정 = 진산)

1. **graph(현 알고리즘) = 4차 실측 일관 유해**: onlyRecovery 0 × 3연속 + depth1 −5.3%p·depth2 −15.8%p.
2. **lexical(D안) = 무해 + 조건부 개선**: regression 0(전 ε), hit +5.3%p — 단 개선 전량이 NAMED 1문항(명칭-동형 수혜) — NOT-NAMED 일반화 근거는 본 표본에 없음.
3. 비용: D안 신규 표면 = 격리 route 분기 + 재정렬 함수 + 러너 플래그(학습자 경로 0접촉·production 무배포 상태).
4. 캐비앗 승계: golden v2 = 진산 일괄 위임(스팟·hop 재검 백스톱) / N=19 / 손해평가 도메인 한정.
