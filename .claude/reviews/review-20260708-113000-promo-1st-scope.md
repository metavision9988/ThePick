# 독립 검증 통합 인덱스 — promo-1st-free-service-scope-20260708.md (2026-07-08)

── 리뷰 방식: 독립 에이전트 2렌즈 병렬(사실검증 8항목 / 적대 설계비평 4렌즈[누락·권고취약점·순서의존·규칙정합]) — 자가 리뷰 아님.
── 결과: **CRITICAL 3 / MAJOR 9 / MINOR 9 → rev2 전건 반영**. 아키텍처 방향(D-1 A / D-2 A 권고) 전복 없음 — 판단 재료·문면 정직화가 골자.

## CRITICAL 3 (전건 반영)

1. **C-1 D-2 거짓 이분법**: `/grade` 가 정오 무관 correctAnswer+explanation 을 항상 반환(`study/routes.ts:1524-1534`, GradeResultOut.correctAnswer 필수 필드) → 무인증 표면에서 "정답 스크래핑 방어"는 성립하지 않음(문항당 1채점 = 정답 1개, 525문항 ≈ 단일 IP 27분). A/B 실차이 = "보호 vs 노출"이 아니라 **전량 즉시 번들 vs 드립 유출+텔레메트리+운영 통제**. → §2 D-2 공통 전제로 정직 명기, A안 권고는 옳은 이유로 재정렬.
2. **C-2 "스키마 존재≠populate" 3번째 재발 차단**: 1차용 approved 노드 ≈ 0(approved 488 전수 = 2차 실무 도메인, 1차 근거 P1/P2/P3 = 전량 draft) → 지형도 노드 축·카드플립 노드 소스·근거보기는 BE-5 승급 전 공허. → BE-5 를 "(선택)"에서 **노드 의존 기능 전체의 콘텐츠 게이트로 승격**, BE-3/BE-4/FE-5/FE-6 는 기출-only 초기 소스로 재정의 + §5 간선 추가.
3. **C-3 홍보 지표 0**: Analytics Engine 바인딩 0·Web Analytics 0 — 홍보용 서비스인데 방문·퍼널 측정 수단 전무(D-1 로컬 채택 시 공백 확대). → BE-6③ 신설(Web Analytics + AE 익명 이벤트 3종, 단일 벤더 정합).

## MAJOR 9 (전건 반영)

- M-1 "기존 DO 재사용" 오기 — DO 는 레포에 부재. 실체 = `ratelimit` unsafe binding(wrangler.toml:73-101, SEARCH_RATE_LIMITER_IP 가 공개 표면 선례) + D1 per-user 카운터(익명 부적합). → BE-2④ 정정.
- M-2 anonSeed 클라 발급 = 채점 무결성 리스크 + KST 자정 재셔플 carry-over 승계 → **choiceId(불투명 보기 식별자) 채점**으로 교체.
- M-3 공개 표면 2차/flagged 누출 — 현 `/grade` id 직조회에 exam_type 필터 없음(schema default '2nd') → `exam_type='1st'` 서버 고정 + `status='active'` 양쪽 WHERE + 회귀 테스트 2건 명기.
- M-4 홍보 URL 미결 + 미보유 thepick.app 이 CORS 화이트리스트 실재(index.ts:34-46) → §6-0 신설 + BE-6④.
- M-5 D-1 A안 증발 서술 과소 — Safari ITP 7일 자동 삭제(모바일 80% 상충) + 현 IDB = read-only 미러라 로컬 쓰기 스토어는 신설 → §2·F-4 정직화.
- M-6 크리티컬 패스 미명시 — 진짜 최장 폴 = 진산 보기 검수 525 → 부분 검수→부분 라이브 옵션 상신 + FE-4 mock 병행 단서.
- M-7 캐싱/CORS 구체성 — cache-policy 에 `/api/public/` 매핑 부재(기본 no-store) + credentials CORS 유해 → BE-2⑤.
- (사실검증) MAJOR-1 = M-1 동일건 / **MAJOR-2 기존 MC UI 자산 누락** — MultipleChoice.tsx 라디오+단축키+정오 피드백 완비·휴면 → §0·F-6·FE-2/FE-4 "리디자인"으로 재분류(작업량 과대추정 정정).

## MINOR 9 (전건 반영)

F-3 문면 정밀화(/next 도 answer SELECT·응답 비노출) / D-2 재료에 rate limit = 유일 dump 방어선 / BE-3 인덱스는 chapter 만(section 인덱스 없음) / BE-1 방법 계보(7b 정본 = pdfplumber+정답지 cross-check ↔ Claude 직접 — 착수 결재에서 단일화) / FE-1 에 OG·sitemap·robots(현재 0) / 해시 IP 키(PII 0 주장 정합) / Email Routing = 진산 콘솔 행위로 §6-5 등재 / F-4 @thepick/srs web 미도입 명시 / FE-8 이미지 공유(클라 canvas) 중심 재서술.

## 확증된 사실 골격 (참고)

F-2 전면 인증(우회 0)·F-3 서빙 비노출 projection·F-4 ts-fsrs 순수성(node: 참조 0)·F-7 자동로그인 인라인(AuthForm.tsx:127-160)·시안 3종+lab 10개 미반입·7b~7f plan 실재 — 전건 파일:라인 확증. 문서의 골격 판단("무인증이 사업 계층 회피, 크리티컬 패스는 보기 데이터+검수")은 실코드 정합.
