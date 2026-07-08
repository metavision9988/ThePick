# 핸드오프: Fable 5 → Opus 4.8 — 1차 무료·무인증·홍보 서비스 구현 (2026-07-08)

> **미션**: `docs/plans/promo-1st-free-service-scope-20260708.md`(rev2, 독립 2렌즈 검증 C3/M9/m9 전건 반영 — **스코프 정본**)를 **구현**한다. 산출 = 실제 돌아가는 1차 무료 서비스(4지선다 랜덤 풀이 + 암기).
> 선독 의무: 스코프 정본 전문 + `docs/backend/BACKEND_MIDPOINT_REVIEW_20260707.md` §9.5·§10 + 본 문서 §2(거버넌스)·§5(지뢰).

## 1. ★거버넌스 변경 (2026-07-08 진산 발화 — 최우선)

> 진산: **"결재해달라는 거 하지 마. 개발 구현해서 결과물을 보고하는 것이 더 효과적. 봐도 몰라서 그래."**

- **결재 큐 상신 금지.** 갈림길은 스스로 결정하고 **결정 기록**(결정+사유+기각 대안, "위임" 라벨)을 남긴 뒤 구현 진행. 진산 사후 거부권.
- **보고는 결과물 중심**: 돌아가는 URL·화면·수치("525문항 중 498 보기 추출 PASS" 식). 결재 요청·옵션 나열 금지.
- **불변 (위임 밖 — 이것만은 유지)**: ①정답 정확성 100% 게이트(불일치 1건 = 원인 규명 전 진행 금지) ②AI 생성/추출 데이터 = draft 적재 + **인간 검수를 기계·독립에이전트 다중 검증으로 대체**하되 검증 리포트 영속(§4-P3) ③Hard Limit 전부(UPDATE 금지 테이블·동적실행 금지·온톨로지 Lock 등) ④파괴적/불가역 production 작업은 실행 전 브리핑 1줄(대기 아님 — 고지) ⑤독립 리뷰 프로토콜(4-Pass 등) 스킵 금지.
- **커밋·push = 자율**(07-08 선례: 진산 push 지시 후 상시 진행 중).

## 2. 위임 결정 기록 (Fable 5, 2026-07-08 — 재논의 금지, 바로 구현)

| #   | 결정                                                                                                                                                                    | 사유 (요지)                                                                                                            |
| :-- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- |
| G-1 | **D-1 = A안 로컬 전용** (진도·FSRS·스트릭 = IndexedDB, 서버 user 데이터 0)                                                                                              | PII 0·법무 회피 정합·동기화 stub 회피. 증발 한계는 `navigator.storage.persist()`+내보내기로 완화(스코프 §2)            |
| G-2 | **D-2 = A안 공개 API + 서버 채점** (`/api/public/*`)                                                                                                                    | 정답은 어느 안이든 드립 노출(제품 요건) — A 실익 = 유출 속도 제어·flagged 즉시 차단·검수분 즉시 반영·홍보 지표 원천    |
| G-3 | **BE-1 방법 = 7b 정본 (pdfplumber 추출 + 공식 정답지 cross-check)** + 독립 에이전트(원문 PDF 재추출) 적대 대조를 검수 대체층으로                                        | 결정적·재현 가능·환각 표면 최소. Claude 직접 추출은 검증 렌즈로만                                                      |
| G-4 | **v1 스코프 = 기출-only** — 노드 의존 기능(근거보기·지형도 장절 축·카드플립 노드소스)은 v1 제외                                                                         | 1차 approved 노드 ≈ 0(전량 draft) — 노드 승급은 콘텐츠 정확성 인간 게이트 성격이 강해 본 위임 범위에서 제외(후속 트랙) |
| G-5 | **홍보 URL = `thepick-study.pages.dev` 기본값** (커스텀 도메인 확보 시 config 주입 교체 — 하드코딩 금지)                                                                | 실배포 프로젝트 실재·비용 0·즉시 사용. thepick.app 은 타인 보유 — CORS 에서 제거                                       |
| G-6 | **lab/\*.jsx 없이 진행** — `docs/사용자UIUX/` 방법론 md 2종 + `docs/design/claudeDesign/*.jsx` 8종을 명세로 재구현                                                      | 반입 = 진산 행위(대체 불가)·스택 격차로 어차피 재구현이 정석(기확인)                                                   |
| G-7 | **디자인 = 3안 내부 생성 → 자체 선정 1안 구현 + 기각 2안 스크린샷 보고**                                                                                                | "3안 제출→진산 선택" 규율을 위임 체제에 맞게 변형 — 선택권은 사후 거부권으로 보존                                      |
| G-8 | Email Routing(콘솔 행위)은 요청하지 않는다 — 알림 최소선은 **cron 무음실패 감시 로그 + /status 노출 강화**로 대체, Email Routing 은 보고서에 "진산 5분 행위" 1줄 안내만 | 결재/행위 요청 최소화 원칙                                                                                             |

## 3. 구현 순서 (P0→P5 — 각 P 종료 시 독립 리뷰 + 결과물 보고)

### P0. 공개 전 차단물 제거 (반나절)

- `apps/web/src/components/AuthForm.tsx:127-160` **PUBLIC*TEST*\* 자동로그인 블록 제거**(빌드타임 인라인 — 기존 런칭 차단 원장 이행). production 빌드에 해당 env 미설정 확인 + 테스트 계정 D1 삭제. dev 편의가 필요하면 dev 환경 한정 분기(번들 크리덴셜 금지).
- CORS 화이트리스트(`apps/api/src/index.ts:34-46`)에서 미보유 `thepick.app` 제거.

### P1. BE-2 공개 학습 표면 `/api/public/*` (핵심 코드)

신설 라우터(requireAuth 없음). 기존 study 내부 함수를 **추출·재사용**(복붙 금지 — 단일 진실원):

1. `GET /api/public/questions/next` — 랜덤 서빙. WHERE **`exam_type='1st'` 서버 고정(클라 파라미터 금지) AND `status='active'`**. 필터 = subject(3과목)/round. projection = 기존 NextQuestionOut 계열(answer·explanation 비노출, `routes.ts:1009-1024` 참조).
2. `POST /api/public/grade` — ★셔플 매핑 = 서버 소유 유지. **userId 시드 대신 보기별 불투명 `choiceId` 발급→choiceId 로 채점**(스코프 §3 BE-2② — 클라 시드 금지, KST 자정 재셔플 carry-over 동시 해소). 채점 응답 = 정오+correctAnswer+explanation(없으면 필드 생략·프론트 빈상태 처리). **채점 쿼리에도 exam_type='1st' AND status='active' 강제**(현 `/grade` 는 id 직조회 — 이 갭이 2차/flagged 누출 경로였음). 회귀 테스트 2건 의무(2차 id 채점 거부·flagged 서빙 제외).
3. rate limit = **`ratelimit` unsafe binding 신규 네임스페이스**(wrangler.toml:73-101 의 SEARCH_RATE_LIMITER_IP 패턴 복제, 키 = 해시 IP). D1 `rate_limits` 는 user 키 전제 — 사용 금지.
4. `middleware/cache-policy.ts` 에 `/api/public/` 명시 매핑(서빙 캐시 검토/채점 no-store) + **credentials 없는 별도 CORS**.
5. user_progress 기록 = 없음(G-1). Analytics Engine 바인딩 + 익명 이벤트 3종(serve/grade/card — PII 0) 이 서버측 유일 기록.

### P2. 로컬 진도 계층 (D-1 구현)

- `apps/web` 에 **로컬 쓰기 스토어 신설**(현 `lib/db.ts` = D1→IDB read-only 미러 — 그대로 두고 별도 스토어). 스키마 = 카드별 FSRS 상태+스트릭+세션, **export/import 가능 구조**(BE-7 선확보 겸 증발 완화).
- `@thepick/srs` 를 web 의존성에 추가(ts-fsrs 순수 구현 — 브라우저 번들 확증됨). `navigator.storage.persist()` 요청.

### P3. BE-1 보기 추출 BATCH (크리티컬 패스 — L3 급 주의)

- 정본 절차 = `docs/plans/phase3-learning-ux-modes.plan.md` 7b~7f. 소스 = `docs/manual/` 기출 PDF 7회분.
- 파이프라인: pdfplumber 로 ①~④ 보기 추출(결정적 스크립트, apps/batch) → **공식 정답지 cross-check**(정답 위치 보기 텍스트 실재 검증) → 추출 실패/모호 문항은 **정직 제외 목록**(무음 skip 금지).
- ★**적재 지뢰**: `migrations/0038` 트리거가 **distractors 직접 UPDATE 를 ABORT**(답안안전 default-deny). `input_type` 은 화이트리스트 허용. → distractors 채움 = **`INSERT + superseded_by`**(트리거 메시지 명시 경로). **착수 전 ADR-046 + `docs/plans/tr-0-backend-c7-trigger-redesign.plan.md` 정독 의무** — 기결 D-4=(a) SUPERSEDES(2026-05-30)와 정합해야 함.
- 검수 대체(§1 불변②): 3중 = 결정적 cross-check 100% + 독립 에이전트 원문 PDF 재추출 대조(회차별) + 라운드트립(추출 보기로 채점 시 공식 정답 재현 100%). 리포트 `docs/plans/` 영속. 회차 단위 검증 통과분부터 **부분 라이브**.
- 기출 정답 원칙(불변): 공식 정답과 100% 일치 — 불일치 1건이라도 원인 규명 후 재실행.

### P4. 프론트 (FE-1~9)

- **리디자인**: FE-2 4지선다(기존 `QuestionCard→MultipleChoice.tsx` 완비·휴면 — 스타일·플로우 재설계) / FE-4 빵꾸노트(기존 `FillBlank.tsx` + M9 단계 힌트 신규). mock 으로 즉시 병행(라이브만 P3 게이트).
- **신규**: FE-1 랜딩(+OG/twitter 메타·sitemap·robots — 현재 0) / FE-5 카드플립+FSRS 4버튼(로컬) / FE-7 스트릭 / FE-8 결과 공유(클라 canvas 이미지 중심) / FE-3 픽커 / FE-9 상태 4종+접근성(44px·모바일 80%).
- 규율: `~/.claude/AESTHETIC.md` 선독 → G-7 방식(3안 자체 선정+기각안 보고). 시안 명세 = `docs/사용자UIUX/` md 2종 + claudeDesign jsx 8종.

### P5. 지형도 + 마감

- BE-3 지형도 API(기출 축: subject×round×문항 트리 — 노드 축 없음, G-4) + FE-6.
- BE-6③ 지표: Cloudflare Web Analytics 스니펫(Pages) + AE 이벤트 배선 확인.
- 종합: E2E 추가(공개 표면 스모크·MC 풀이 사이클), `pnpm build/test/lint/typecheck/g1:check` 전체 green, wrangler 배포(staging→production), **결과물 보고**(URL+화면+수치).

## 4. 검증·보고 의무 (모든 P 공통)

- P 종료마다: 독립 리뷰(4-Pass — `4pass-review` 스킬, P3 는 +원문 대조 에이전트) CRITICAL 0 후 다음 P. 리뷰 파일 `review-*` prefix.
- 테스트 현 기준선: api 730+/web 31+/E2E 20/formula-engine 359 — **회귀 0**.
- 보고 형식: "무엇이 돌아가는가"(URL·스크린샷·수치) → 결정 기록 링크 → 다음 P. 결재 요청 문구 금지(§1).

## 5. 지뢰 목록 (실측 확증 — 밟기 전에 읽어라)

1. **0038 트리거**: distractors UPDATE = ABORT → INSERT+superseded_by (§3-P3). input_type 은 UPDATE 허용.
2. **requireAuth 전면**(`study/routes.ts:824-828`) — public 라우터는 별도 신설. 기존 study 라우트에 우회 추가 금지.
3. **셔플시드 = userId 의존**(`learning-modes/shuffle.ts:32-36`) — public 은 choiceId 설계로 대체(클라 시드 금지).
4. **`/grade` 는 exam_type 무필터 id 직조회**(`routes.ts:1118`) + 스키마 default '2nd' — public 채점에 1st 고정 필수.
5. **cache-policy 기본 no-store floor** — `/api/public/` 미매핑 시 전 요청 D1 직행.
6. **D1 rate_limits = (user_id, bucket_minute) PK** — IP 키 유용 금지, ratelimit 바인딩 사용.
7. **현 IDB(`web/lib/db.ts`) = read-only 미러** — 로컬 진도는 신설 스토어.
8. **KST 자정 재셔플 carry-over**(`routes.ts:432-433`) — choiceId 채점이면 자연 해소, 기존 경로 수정은 범위 외.
9. **g1 게이트**: added-lines 에 "가능합니다" 류 금지어 — 문서 작성 시 주의.
10. **Drizzle = 타입 전용**(NC-1) — 런타임은 raw prepared statement 관례 유지.
11. **quality-gate 훅**: any/console.log/빈 catch/TODO 감지 — 상용 품질 원칙 전부 적용.
12. **워크스페이스**: 메인(main) = 1호 트랙. `../ThePick-jeongi`(2호)와 동시 wrangler deploy 금지.

## 6. 현재 상태 스냅샷 (2026-07-08 세션 종료 시점)

- git: main = origin 동기(`6f494df`), 워킹트리 클린. 테스트 전체 green(§4 기준선).
- production: Worker+Pages 배포 유지, D1 = nodes 857/edges 1,347/questions 545/formulas 157/constants 193. wrangler 세션 유효(선례상 draft 적재·배포 직접 실행 가능).
- 이 스코프와 무관한 대기물(건드리지 말 것): G-S5 GO/NO-GO·golden 검수·RW production 적용·M1 exams/ 골격·2호 트랙 — 별도 원장.

_작성: Fable 5 (토큰 한도 임박 인계) · 스코프 정본 rev2 기반 · 위임 결정 G-1~G-8 은 본 문서가 기록 원본._
