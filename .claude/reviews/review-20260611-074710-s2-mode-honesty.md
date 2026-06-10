리뷰 방식: 독립 에이전트 2개 병렬 (Pass1+2 quality-engineer / Pass3+4 general-purpose — auto-review-protocol 최소 구성, 작성 컨텍스트 비공유)

# S2 (WS-0d 모드 정직성) 구현 리뷰 — 결재 #9 위임 "비활성 표기"

- 날짜: 2026-06-11 07:47
- 변경: ① /mode 응답 `wired` 필드(서버 단일 진실원 WIRED_MODES={weak,mixed}) ② /mode/start 미배선 모드 422 MODE_NOT_AVAILABLE(UI 우회 차단) ③ ModeSelector "준비 중" disabled + available 숫자 비표시 + 추천 pill 미배선 제외 ④ **별건 결함 수리**: streak '어제' 테스트의 UTC/KST 시간대 윈도우 결함(KST 00~09시 실행 시 항상 실패 — 2026-06-11 아침 발화로 발견) → todayDateString(KST) 기준 통일
- 파일: routes.ts·routes.test.ts(api) / ModeSelector.tsx·types.ts·ModeSelector.wired.test.tsx(web)

## 판정: **조건부 완료 가능 → 조건 이행 완료**

| 등급     | 건수                  | 처리                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CRITICAL | 0                     | —                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| MAJOR    | 1 (양 리뷰 동일 진앙) | **M-1 배포 순서 결합**: web 선배포 + 구 API(wired 필드 부재) 조합이면 fail-closed 로직(`!undefined=true`)이 5모드 전부 "준비 중" 차단. 코드 결함 아님(fail-closed = 정직성 정합·올바른 선택) — 운영 제약 무문서가 결함. **처방 이행: "S2 배포 = Worker(API) 먼저 → Pages 나중" 플레이북 S2 기록 명문** (아래 배포 제약 절)                                                                                                        |
| MINOR    | 7 (합산, 중복 제외)   | m-1 WIRED_MODES 주석 기준 서술 부정확 → **즉시 흡수**(서빙 의미 일치 기준으로 정정 + m-3 게이트 문구 추가) / m-5 gap 테스트 주석 과잉 → **즉시 흡수**(기준 통일로 정정) / m-2 weak 잔여 갭(미시도 우선 정렬 — 기보고·WS-5a 백로그) / m-3 Set=선언≠검증(WS-5a Binary Gate 권고 — 주석 명문 흡수) / m-4 422 'validation' 문구 오도(stale 탭 한정, WS-5a 흡수) / 추천 pill noCards mixed(선재) / api↔web 타입 수동 동기(Year 2 표면) |

## 배포 제약 (M-1 이행 — 운영 명문)

**S2 변경 배포 순서 = ① Worker(API, `pnpm deploy:api`) → ② Pages(web).** 역순(web 먼저)이면 신 web 이 구 API 응답에서 wired 필드를 못 찾아 전 모드 "준비 중" 차단(학습 시작 전면 불가). API 먼저는 무해(구 web 은 wired 미소비). 본 제약은 OPUS48_EXECUTION_PLAYBOOK.md S2 실행 기록에도 영속.

## PASS 증거 요약 (양 리뷰 합산 — 전체는 에이전트 원문)

- 결재 #9 결정문 1:1 정합(준비 중 disabled/로드맵 가시성/백엔드 무삭제 diff 전수 확인/WIRED_MODES 단일 재활성 경로) + /mode/start 422는 additive 강화(Silent Pivot 아님)
- 서버 단일 진실원: web 에 배선 목록 하드코딩 0건(grep) / 타입 캐스트 우회 0건 → wired 필수 필드 tsc 강제
- 과거 데이터 호환: 기존 category 세션 행의 /session/:id·complete·/next?sessionId 전부 WIRED 게이트 무접촉 = 조회·이어하기·종료 정상
- 422 wiredModes 노출 무해(requireAuth 뒤 + /mode 로 이미 얻는 정보의 부분집합)
- 시간대 수정 손계산+실측: KST 03:00 시뮬레이션에서 구코드 결함 재현(2일차→reset 오판) + 신코드 정확('어제' 정합). 고정 오프셋(DST 없음)이라 전 시각 정확
- a11y: aria-label "(준비 중)" SR 전달 + 기존 디자인 토큰(minHeight 44·borderLeft) 보존
- 독립 재실행: api routes 83/83 · web wired 5/5 · api 전체 678/0 · tsc 양측 PASS

## 반론 기록 (Devil's Advocate, 채택)

- "서버 단일 진실원"의 실체는 WIRED_MODES 선언이지 /next 실코드가 아님 — WS-5a 에서 Set 선등재+필터 미구현이면 동일 클래스 부정직 재발 → Set 주석에 선행 게이트 명문으로 완화(m-3 흡수), WS-5a plan Binary Gate 등재 의무
- weak 의 "(N문제)" 표기 vs 실서빙(미시도 우선 정렬·풀 미제한) 의미 간극 잔존 — 결재 #9 범위 밖(기보고), WS-5a 에서 weak WHERE 정합 검토 항목
