# 5-페르소나 독립 병렬 심층 리뷰 — 2026-07-02 일괄 결재 집행 변경셋

> **대상**: 커밋 `926c1ba` 이후 워킹트리 전체 — 일괄 결재 집행 7건 (코드 4: #19 QG-2·#13 표벡터 필터+4c
> 잣대강화·#10 weak_score·WS-3c manifest / 문서 3: ADR-014 개정+WS-2b plan·#12 체크리스트+WS-6c plan·
> 골든 빌더 일반화). 병렬 에이전트 7개 작성분.
> **방식**: 독립 5-페르소나 병렬 (①정합성 ②아키텍처 ③UX·보안 ④요구사항/Silent Pivot ⑤기술부채 —
> 서로 결론 모름) → CRITICAL/MAJOR 전건 **적대적 반증 에이전트 10개** 교차검증 (워크플로우
> `wf_a380e268-c13`, 총 15 에이전트).
> **판정: CRITICAL 0 / MAJOR 10 (반증 기각 0 — 전건 실코드 재현 확증) / MINOR 15.**
> **MAJOR 전건 즉시 수정 완료** (아래 §2) + 수정 후 재검증 전부 green (§4).

## 1. 발견 요약 (CONFIRMED — 전건 refuter 실코드 재현)

| #   | 심각도 | 위치                          | 요지                                                                                                             | 처리                                                                                             |
| --- | ------ | ----------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1   | MAJOR  | build-querybody-golden.mjs:75 | ANSWER_KEY_LINE_RE 가 직결 서식 보기('①보험의 목적')를 정답 매핑으로 무음 과제거                                 | ✅ 빈칸 원형 증거 기반 분류 (증거 없으면 본문 유지)                                              |
| 2   | MAJOR  | 동:79                         | WORKED_RESULT_RE 가 자료표 조건 줄('보험가입금액 = 20,000,000원')을 무음 과제거 + MANUAL_OVERRIDE 로도 보존 불가 | ✅ 산식 연산 증거 필수 + allowGenericLeaks 보존 경로 신설 (leak 는 광역 유지 = 양방향 fail-loud) |
| 3   | MAJOR  | 동:157                        | 중복 정답표 anchor 구간 내 비중복 고유 본문 무음 소실                                                            | ✅ 원본 권역 부분문자열 판별(랩핑 대응) + 고유 본문 throw                                        |
| 4·7 | MAJOR  | 테스트:10                     | G-WS4 ② 게이트 테스트가 어떤 러너에도 미배선 + 헤더 실행 커맨드 파손                                             | ✅ `pnpm test`(root)·CI ci.yml 스텝 배선 + 헤더 정정                                             |
| 5·8 | MAJOR  | measure-runner:187            | debug 우회·expandedNodes 의 소비자 0 — G-WS4 ③④ 실행 불가 (고아 기능)                                            | ✅ 러너 `--debug` 배선 + 디버그 측정 파일(`querybody.debug.json`, Q-004 포함 7문항) 신설         |
| 6   | MAJOR  | ws-6c plan                    | WS-2b·WS-6c 가 마이그 슬롯 0039 이중 예약 (Silent Pivot 경로)                                                    | ✅ ws-6c → 0040 재번호 + 양 plan 상호 참조·재실측 의무 명문                                      |
| 9   | MAJOR  | 골든 빌더 전반                | 어휘 휴리스틱 과제거 방향 기계 가드 0                                                                            | ✅ #1~3 가드 + 회귀 테스트 3건 (13/13)                                                           |
| 10  | MAJOR  | run-formula-sync:105          | engine-backed 스프레드 2곳 복제 + "레지스트리 동일 집합" 주장 미검증                                             | ✅ getAllFormulas() 동치 고정 테스트 추가 (batch6+ 등록 시 기계 강제 파손 → 갱신 환기)           |

**반증 기각 (refuted)**: 0건 — 15개 반증 에이전트 전원 "성립" 판정 (전부 scratchpad 실행 재현 포함).

## 2. MINOR 15건 처분

- **즉시 수정 2**: 카드 #19 집행 기록 수치(quality 71→통합 85 각주) / MAX_QUERY stale 참조 주석
  (GRAPH_QUERY_PUBLIC_MAX_LENGTH 정본 명기 + DEBUG 상한 동기).
- **보고·carry-over 13** (원문은 wf_a380e268-c13 산출물): NOISE_LINE '적중' 오폭 가능(과제거 가드
  일반화 시 흡수 후보) / parseDump 2행+ 결손 미검증 / 임계 68 이중 선언(quality↔batch) / quality 배럴
  node:crypto 편입 / debug 자기신고제(유료화 전 게이트 재결재 — ADR-047·plan 기록 존재) / 어휘
  휴리스틱 일반 한계(removal-log 진산 검수 = 백스톱, Phase 0b 검수 의무) / WS-3c ①만으로 집행한
  시퀀스 해석(④⑤ 미결 유지로 정합 처리됨) / MASTER_PLAN §3 행 stale(후속 동기 대상) / sha256Hex
  3벌째 복제(결재 (ii) 범위) / scripts/\*.mjs ESLint 사각(선재—심화 기록) / **Hard Rule 16**: subject
  집계 쿼리 examId 인라인 경계 부재(Year-1 관례 — WS-5f/Year2 전환 시 래퍼화 carry-over).
- **선재 flake 관찰**: 전체 turbo 병렬 실행에서 batch 1건·api 1건이 간헐 실패 후 단독/재실행 연속
  green (wall-clock 의존 의심) — 본 변경셋 무관(HEAD 에서도 재현 안 됨), CI 야간 재발 시 추적.

## 3. 페르소나별 확인 증거 (0건 아님 — 발견 10 + PASS 확인 33건)

각 페르소나 checkedEvidence 3건+ 및 Devil's Advocate 반론 포함 — 원문 `wf_a380e268-c13` 산출.
대표: 카드 6종 권고↔구현 1:1 대조 전건 일치(④) / expandedNodes description 제외·approved 한정
노출(③) / 표벡터 필터 top1Score·graceful 왜곡 동시 해소(②) / weak_score [0,1] 치역·429/503 계약
불변(①) / formula-sync 55건 워터마크 deep-equal 고정(⑤).

## 4. 수정 후 재검증 (RAW)

- turbo `pnpm test`: **Tasks 17/17 successful** + scripts 테스트 **13 pass / 0 fail** (신규 배선 경유)
- 골든 빌더: GT byte-동치 유지 + 과제거 가드 테스트 3건 신규 (13/13) / quality 15/15 (동치 테스트 포함)
- batch 332/332 · api 711(+2 skip) · E2E **20/20** · typecheck 17/17 · lint 17/17
- 산출물: `golden-pilot-approved.querybody{.json,.debug.json}` — 정본 불변(git clean) + 디버그판 신설

판정: **완료 가능** (CRITICAL 0 · MAJOR 0 잔존 · MINOR 13 carry-over 기록).
