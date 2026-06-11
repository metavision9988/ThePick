리뷰 방식: 독립 에이전트 1개 4-Pass 통합 (quality-engineer — 작성 컨텍스트 비공유, search 137 테스트 + tsc 직접 재실행. 소규모 변경 2파일)

# S8 (S5-8 Phase 0a — graph-walk DEFAULT_MAX_DEPTH 2→1) 구현 리뷰

- 날짜: 2026-06-11 13:50 / 결재 #6 (진산 2026-06-11) 집행
- 변경: `graph-walk/index.ts` 상수 2→1 + 실측 근거 주석 / route 테스트 기본값 회귀 게이트 +1

## 판정: **수정 필요 → 전건 해소 완료**

| 등급     | 건수 | 발견 → 처리                                                                                                                                                                                                                                                                                                                                                                  |
| -------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CRITICAL | 0    | —                                                                                                                                                                                                                                                                                                                                                                            |
| MAJOR    | 2    | M-1 결재 기록 드리프트 — 주석은 "#6 승인" 주장하나 정본(S5-8 plan §9) 체크박스 공란·DRAFT 헤더(2026-05-29 실수 로그 동일 클래스) → **§9 0a [x] + 일자·집행 기입 + 헤더 부분결재 표기** / M-2 동일 파일 GraphWalkOptions JSDoc "기본 2" 모순(12줄 거리) → **"기본 1(DEFAULT_MAX_DEPTH)" 정정**                                                                                |
| MINOR    | 4    | 흡수 3: runner provenance 라벨 stale("engine-default" 가 06-01 측정과 동일시될 위험 — resolved 의미 각주+각인에 code-default 1 병기) / plan 문언 차이 추기(route override → 엔진 default 변경 = 동등·더 보수, Silent Pivot 오인 방지) / depth1 인용에 "무익(recall −2.4%)" 병기 / 보고만 1: route:197 no_approved_seed 경로 `?? 0` surface 불일치(pre-existing — 본 diff 밖) |

## PASS 증거 요약

- DEFAULT_MAX_DEPTH 소비처 = 전 코드베이스 1곳(clampInt) — 테스트 import 0·픽스처 의존 0(골든 전부 명시 지정)
- `/api/search/graph` 계약 불변(zod min1 max4·400 정직 거부 잔존 PASS) / `/api/search` 무접촉 / graphWalk 비테스트 호출처 1곳 격리
- eval runner — 06-05 depth1·2 리포트는 명시 주입 측정 = 소급 영향 0
- 주석 실측 수치 = CLAUDE.md 06-05 기록 전 항목 일치 / Phase 1+ (whitelist·comparator·SQL) 침범 0 = 결재 #6 범위 내
- 검증: search 137/137(기본값 1 회귀 게이트 포함)·tsc·lint PASS

## 잔여 게이트 (완료 선언 유보 — 리뷰 반론 채택)

- **G-R0a**: production 배포 후 REMOTE 재측정 regression=0 재확인 — 코드+로컬 PASS 만으로 Phase 0a "완료" 선언 불가. 배포(#11 트랙 또는 별도 위임)와 묶어 처리.
- 기록: clamp 하한(1)=기본값(1) 일치로 상수 0 오설정 시 silent 보정 은폐 가능(저위험) / telemetry 가 no_approved_seed 의 0 과 실효 1 을 혼입 집계 시 depth 분포 왜곡 가능(pre-existing).
