리뷰 방식: 독립 에이전트 2개 병렬 (Pass1+2 quality-engineer / Pass3+4 general-purpose — 작성 컨텍스트 비공유, 양측 production 리포트 정량 재분석 + 테스트 재실행 포함)

# S4 (WS-2a production 무결성 러너) 구현 리뷰 — 확장 게이트 E0-2

- 날짜: 2026-06-11 08:47
- 변경: ① `packages/quality/src/production-audit.ts` 신규 코어(D1 row 변환·활성엣지→비활성노드·walk 도달성·종합 게이트) ② 테스트 11건 ③ index.ts export ④ `scripts/run-graph-integrity-production.ts` IO 러너(fabricate 차단·read-only·리포트 영속)
- production 실측 4회 수행 (794노드/1274엣지 — **사상 첫 기계 검증**)

## 판정: **수정 필요 → 전건 해소 완료**

| 등급     | 건수      | 발견 → 처리                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CRITICAL | 1         | **C-1 (Pass1·2 교차): SUPERSEDES 엣지를 stale 위반으로 오산입** — "활성 SUPERSEDES → 비활성 to_node"는 0013 트리거의 설계된 steady-state(개정당 1개 필연, Hard Limit 산물). 산입 시 Hard Limit 준수 그래프에서 게이트 영구 통과 불능 + 시계열 기록(EDGE-BATCH-R1-0024~0034, 11건 1:1 확증)이 수리 대상으로 오도. → **즉시 수정**: SUPERSEDES 제외 + 설계 근거 주석 + SUPERSEDES 픽스처 테스트 신규. **재실측: stale 114→103**(리뷰어의 1274−1263=11 예측 정확 일치). 계보 정합은 findSupersedeCycles 별도 담당 유지 |
| MAJOR    | 5         | M-1(Pass1) walk 술어의 approved 차원 누락 — active 783 ⊋ walk-eligible ~488, 133은 하한(전부 진양성)이나 보완집합 단정 불가 → **doc 한계 명시 흡수**, status 덤프 정밀화는 E0-4와 동시 후속 / P3-1 결함 리포트(119) 미표식 병존 → **SUPERSEDED 마커** / P4-1 자매 게이트(G-WS2②·플레이북 G2) stale → **양측 정정 동기** / P4-2 WS-2c+항목5 스코프 축소 미보고 → **마스터 플랜 2c 행 명시 이월 기록** / P4-3 E0-2 문구 개정 결재 부재 → **결재 #18 소급 상신**                                                       |
| MINOR    | 14 (합산) | 흡수 7: 덤프 출처 mtime 기록(P3-3)·row 필수 컬럼 검증(P3-2)·약연결 캐비엇(P3-4)·러너 헤더 stale 문구·StaleEdgeRef edgeType 동봉·테스트 표기(2-1→1)·"11 tests" 서술 정합 / 보고만 7: quality floor 57 ratchet·SupersedeChainTooDeepError 미포착(순환 0 실측·exit1 우연 정합)·is_active NULL 이론 경계(라이브 전부 1 확인)·outDeg 비활성 to 산입(정보 표시 한정)·⑤ 정의 역참조·고아/순환 audit 합성 양성(graph-integrity 단위 위임)·게이트 코드 종속(문서 수치 병기로 절반 완화)                                      |

## production 최종 실측 (4차, 수정 후 — E0-2)

```
게이트: ❌ FAIL (= 러너 목적 달성 — 실 결손 최초 노출)
고아 24 (CONCEPT 7 + LAW 17) · 활성엣지→비활성노드 103 (진앙 = 비활성 11노드)
SUPERSEDES 순환 0 ✓ · 끊긴 엣지 0 ✓ · walk 도달불가 133 (하한·정보)
리포트: docs/plans/master-remediation-20260610/g-ws2-integrity/ (1차본 SUPERSEDED 마커)
```

## PASS 증거 요약 (양 리뷰 합산)

- fabricate 차단 전 경로(부재/parse실패/0행/컬럼누락) exit 1 + 형식 훼손의 가짜 PASS 수렴 경로 미발견(적대 분석) / production 쓰기 0(import 전수) / FAIL 헤드라인·전수 원문·exit 2 = 은닉 장치 0
- Engine-First(코어 IO 0·Workers-safe) / Hard Rule 15(whitelist 주입·코어 도메인 리터럴 0) / 의존 방향 무역류 / exit 3값 의미론 정확
- CONCEPT-023 반증 처리 = **정당한 Cycle-Closure 판정**(명시 정정 기록+코드 회귀 테스트 동반, Silent Pivot 아님 — Pass4 §5)
- 검증: quality 11/11(신규)·70+ 전체 PASS·tsc PASS·술어 정정의 단조 강화 확인(2차 diff 추가 14·탈락 0)

## 반론 기록 (채택)

- 러너는 입력 덤프가 진짜 production인지 증명 불가 — 출처 mtime 기록으로 완화, 교차 확인은 인용자 책임 명시
- 게이트 기준의 코드 종속(gatePass 정의 변경 시 문서 무diff 약화) — E0-2 행에 수치 명문 병기 유지
- walk 의미론이 quality 코어에 내장 — graph-walk 변경(양방향 등) 시 본 술어 stale 위험, 술어 한계 doc 명시
