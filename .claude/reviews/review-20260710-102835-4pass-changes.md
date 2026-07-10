# 4-Pass 독립 리뷰 — promo-1st P4 공개 학습 표면 (FE-1~9)

- **일시**: 2026-07-10 10:28:35 (KST)
- **파일**: `review-20260710-102835-4pass-changes.md`
- **리뷰 방식**: 독립 에이전트 5개 (scope / Surgeon / Architect / Advocate / Contract) + 발견별 적대적 반증(반증 통과분만 확정 발견으로 등재)
- **확정 발견 합계**: **CRITICAL 0 / MAJOR 4 / MINOR 24** (반증 격추·강등 반영 후)
- **판정**: **완료 가능** (CRITICAL 0. MAJOR 4는 아래 처분 방향과 함께 등재 — Pretendard CDN 2건은 동일 근원의 렌즈별 병기)

## 변경셋 요약

promo-1st P4 공개 학습 표면(FE-1~9) 구현: 신규 React 공개 컴포넌트 19종(`apps/web/src/components/public/` — 4지선다/빈칸/플립덱 연습, 로컬 streak, 결과/공유)과 `pages/{index,practice}.astro`, `lib/{hangul-hint,share-image}`, e2e `public-practice.spec` + mock server 공개 핸들러 추가. 기존 파일은 `apps/api/src/public/routes.ts`에 POST /reveal(P4-D1) 추가, BaseLayout(OG 메타·Pretendard·44px input)·tailwind·astro.config(site)·sw.js(v3 + /api/public NetworkOnly)·robots/sitemap 수정. 소비 계약은 `/api/public/*`(choiceId 불투명 채점, learning-modes 단일 정본 재사용)과 `lib/local-progress`(100% 로컬 진도, G-1). **핵심 검증축 = 정답 안전(서버 기준 정오 표식)**.

## 리뷰 범위

**변경 파일 39개**:
apps/api/src/public/routes.ts · apps/api/src/public/\_\_tests\_\_/routes.test.ts · apps/web/astro.config.mjs · apps/web/e2e/helpers/fixtures.ts · apps/web/e2e/helpers/mock-api.ts · apps/web/e2e/mock-server/server.ts · apps/web/e2e/mock-server/state.ts · apps/web/e2e/mock-server/types.ts · apps/web/e2e/public-practice.spec.ts · apps/web/public/sw.js · apps/web/public/robots.txt · apps/web/public/sitemap.xml · apps/web/src/layouts/BaseLayout.astro · apps/web/src/pages/index.astro · apps/web/src/pages/practice.astro · apps/web/tailwind.config.mjs · apps/web/src/components/public/{PublicPracticeApp,PracticePicker,PublicQuestionCard,ChoiceRow,ResultBlock,BlankNote,FlipDeck,StreakPanel,PracticeSummary,LandingEmbed,StatusPanels}.tsx · apps/web/src/components/public/{api,types,constants,rating}.ts · apps/web/src/components/public/icons.tsx · apps/web/src/components/public/\_\_tests\_\_/{PublicQuestionCard.test.tsx,api.test.ts,rating.test.ts} · apps/web/src/lib/hangul-hint.ts · apps/web/src/lib/\_\_tests\_\_/hangul-hint.test.ts · apps/web/src/lib/share-image.ts · docs/plans/promo-1st-p4-frontend-ledger.md

**연관 파일 25개**:
apps/api/src/index.ts · apps/api/src/public/{choice-id,rate-limit,analytics}.ts · apps/api/src/auth/rate-limit.ts · apps/web/src/lib/local-progress/{index,db,store,export}.ts · packages/learning-modes/src/{index,types,normalize,shuffle,session-progress}.ts · packages/learning-modes/src/input-types/{mc-choices,mc-answer,fill-blank,multiple-choice}.ts · apps/web/src/components/OfflineIndicator.tsx · apps/web/playwright.config.ts · apps/web/vitest.config.ts · docs/design/AESTHETIC.md · docs/design/claudeDesign · docs/plans/promo-1st-free-service-scope-20260708.md · .jjokjipge/handoff-to-opus-promo-1st-20260708.md

---

── 4-PASS REVIEW ──────────────────
리뷰 방식: 독립 에이전트 5개 (scope/Surgeon/Architect/Advocate/Contract) + 발견별 적대적 반증
리뷰 범위: 변경 파일 39개 + 연관 파일 25개 (위 목록)

**Pass 1 (Surgeon): ✅ 21건 확인 / 🔴 0건 / 🟠 0건 / MINOR 7건 / N/A 4건**

확인 (전수는 §Pass별 확인 항목 참조, 대표 발췌):

- apps/api/src/public/routes.ts:262-276 — /questions/next D1 .all() try/catch + 후보 0건(빈 배열) → 404 NO_QUESTION 정직 강하 (경계값·에러 처리)
- apps/api/src/public/routes.ts:327-347,438-457 — /grade·/reveal .first() 반환 null 체크 후 404, answer NULL/'' → 422 (Null 크래시 경로 없음)
- apps/api/src/public/routes.ts:154-177,384-404 — isServable fail-safe: MC-in-disguise(위치라벨 answer fill_blank)·essay/calc 를 서빙·채점 양쪽 거부 = 오채점 차단, Formula Engine 미경유 문자열 폴백 금지
- packages/learning-modes/src/input-types/mc-choices.ts:72-78 — 무음 원소 filter 금지(위치 오염→오답이 정답 처리 차단), 비문자/빈 원소 전수 거부
- apps/web/src/lib/local-progress/store.ts:59-109 — recordReview 단일 rw 트랜잭션에 cards/reviews/streak/meta 4스토어 전부 포함 (부분 커밋 경로 0)
- grep TODO/HACK/FIXME/any — 스코프 신규 코드 전체 0건 (exit 1)

반론(Devil's Advocate): JWT_SECRET 회전이 서빙→제출 사이에 끼면 정답 선택자가 무음 오채점된다(MINOR-1). 재현 창은 in-flight 문항 1건/유저·자가 치유이나 "해석 불가 ≠ 오답" 구분 부재는 계약 정확성 결손이며, 테스트(routes.test.ts:234)는 위조 케이스만 고정하고 회전 케이스는 미커버다.

**Pass 2 (Architect): ✅ 16건 확인 / 🔴 0건 / 🟠 1건 / MINOR 5건 / N/A 4건**

확인 (대표 발췌):

- packages/learning-modes/src/index.ts:15 등 — Import 방향 단방향(learning-modes 의존 = @thepick/shared 뿐, web dependencies = @thepick/{learning-modes,shared,srs}) — 역방향 위반 0
- apps/api/src/public/routes.ts:236-237/:331/:443 — 시험 경계 3중 강제: exam_type='1st' AND status='active' 서버 고정(클라 파라미터 경로 0) + 회귀 테스트 5건
- apps/api/src/index.ts:135 + packages/shared/src/constants/cors.ts:66 — '/api/public/\*' credentials:false 별도 CORS + Retry-After expose 헤더 등재 → api.ts:90-94 판독 배선 완결
- apps/web/e2e/mock-server/server.ts:313-378 ↔ routes.ts — mock ↔ 실서버 응답 shape·에러코드 문자열 동형(계약 드리프트 0)
- apps/web/src/lib/local-progress/store.ts:57,152 + StreakPanel.tsx:34-42 — KST 일경계 단일 정본(todayDateString/dayBoundsUtc, ADR-041) 공유

반론(Devil's Advocate): sw.js '/api/public NetworkOnly'(P4-D7)는 cross-origin 요청이 45행에서 선제 제외되는 현 구성에서 도달 불가 방어다 — 코드는 무해한 선제 방어로 옳으나, 향후 same-origin 프록시 전환 시에만 실효되므로 원장의 인과 서술("현 SWR 버킷이 /next 캐시")은 실코드와 어긋난다(MINOR-10, 문서 정정 대상).

**Pass 3 (Advocate): ✅ 23건 확인 / 🔴 0건 / 🟠 2건 / MINOR 8건 / N/A 3건**

확인 (대표 발췌):

- 정답 안전(Hard Stop): 채점·정답은 서버 단독 — routes.ts:316-421이 유일 정오 판정, 서빙 projection(:293-303)에 answer/explanation 부재, 클라 자가판정 코드 0
- XSS: 공개 컴포넌트·pages 전체 grep — dangerouslySetInnerHTML/innerHTML/eval/new Function 0건, share-image 는 canvas 순수 그리기
- PII 0: AE 이벤트 = kind/subject/round/inputType/examType/정오만(analytics.ts:45-56), IP·userId·본문·정답 텍스트 미기록, 진도 100% 로컬 IndexedDB
- 상태 4종(FE-9): 로딩 스켈레톤(role=status)/빈 NO_QUESTION/에러+재시도/오프라인(navigator.onLine 선판정 + OfflineIndicator)
- 터치 44px+: 전역 CSS(BaseLayout.astro:74-93) + 주요 CTA minHeight 44~48 전수 / MC = fieldset/legend + sr-only radio + 정오 표식 아이콘+텍스트 이중 채널

반론(Devil's Advocate): "테스트 통과 = 안전" 가정을 기각하고 테스트 미커버 영역을 파고든 결과가 MAJOR-2(FlipDeck 전역 Space 키가 포커스된 '건너뜀' 버튼의 표준 활성화를 가로채 정답 강제 노출 — e2e 는 클릭 경로만 커버)와 MINOR-21(aria-live 영역이 콘텐츠와 동시 마운트 — SR 낭독 누락 가능, 실기기 검증 필요)이다.

**Pass 4 (Contract): ✅ 25건 확인 / 🔴 0건 / 🟠 1건 / MINOR 4건 / N/A 2건 (+선재 관찰 2건)**

확인 (대표 발췌):

- P4-D1(reveal additive) 원장 정합 — /grade 기노출 정보만 반환(isCorrect 필드 부재 테스트 고정), AE 'card' 기록, 신규 유출 표면 0 논거 주석 실재(routes.ts:424-427)
- P4-D4 FSRS rating 매핑 원장 1:1 — rating.ts:11-22(MC good/again, blank 힌트≥1=hard, easy 자평 전용) + 골든 5건 + '자동 채점 easy 불가' 전수 루프
- M9 힌트 사다리 방법론 정합 — hangul-hint.ts:91-98 초성→첫글자→글자수→첫어절 = 방법론 문서 :142 순서 그대로, 사용 힌트 수 FSRS 반영
- 디자인 하드룰 — bold 700 사용 0건, 신호등 정오색 금지 준수(indigo/amber/emerald), 그림자·그라디언트·폭죽/트로피·과장 카피 0건 (AESTHETIC.md:47·55 대조)
- Binary Gate 주장 실측 재현 — pnpm --filter @thepick/web test = 74/74 PASS(신규 public 테스트 5파일 포함) / pnpm --filter @thepick/api test = 770 PASS·2 skip·48 파일(회귀 0) — 본 리뷰 세션 직접 실행
- Hard Rule 17 — 시험 식별 리터럴 신규 유입 0, FIXED_EXAM_TYPE='1st' 명명 상수 + AE 상수 주입

반론(Devil's Advocate): 디자인 시안 정본(claudeDesign/index.html:9)이 동일 jsdelivr 링크를 쓰므로 "시안 충실 이식"이라는 방어가 성립할 수 있으나, P4 원장 §1.1 서체 행은 "tailwind.config + 전역 CSS"만 기록하고 외부 CDN 런타임 의존이라는 갈림길이 위임 결정 기록(P4-D1~D7)에 없다 — 위임 체제(갈림길 = 결정+사유 기록 의무)에서 미기록 이탈이므로 MAJOR-4 유지(적대 반증 keep).

**판정: 완료 가능** (4-Pass CRITICAL 0. MAJOR 4 처분 방향 하단 등재)
────────────────────────────────────

---

## 확정 발견 (적대적 반증 통과분만 — CRITICAL 0 / MAJOR 4 / MINOR 24)

> 반증 기록: MAJOR 후보 중 반증으로 강등 1건(→MINOR-12), 유지(keep) 4건. 격추(refuted) 발견은 본 목록에 없음.

### MAJOR (4건)

#### MAJOR-1 [Architect] BaseLayout 전 페이지 critical path 에 외부 CDN(jsdelivr) render-blocking 스타일시트 도입 — 단일 벤더 원칙·PWA 오프라인 캐시 불가·서드파티 장애 결합

- **파일**: `apps/web/src/layouts/BaseLayout.astro:52-55`
- **내용**: Pretendard 를 cdn.jsdelivr.net 원격 stylesheet 로 로드. (1) Cloudflare 단일 벤더 원칙인데 홍보 진입 표면(랜딩/practice)의 첫 렌더가 서드파티 CDN 가용성에 결합. (2) sw.js:45 가 cross-origin 을 SW 에서 제외 → 폰트 CSS/woff2 는 PWA 캐시 불가. (3) `<link rel=stylesheet>` 는 render-blocking — jsdelivr 지연 = 랜딩 LCP 직격, preconnect 도 없음.
- **확인 증거**: BaseLayout.astro:52-55 CDN 링크 실재 / sw.js:44-47 cross-origin skip / tailwind.config.mjs Pretendard 선두 + system 폴백(CDN 실패 시 기능 저해 0 병기) / AESTHETIC.md:46 Pretendard 요구 자체는 정본(수단만 문제)
- **반론**: 디자인 시안 정본도 동일 링크·폴백 체인으로 FOUT 진행·홍보 초기 트래픽에서 jsdelivr 가용성은 사실상 무문제일 수 있고, self-host 는 라이선스+서브셋 반입 작업 필요.
- **적대 반증 판정(keep)**: 핵심 골격 사실·반증 실패. 단 "오프라인·재방문 시 매번 재다운로드" 부속 주장은 과장으로 정정 — 라이브 헤더 실측 결과 jsdelivr 응답 = `cache-control: public, max-age=31536000, immutable` + 버전 고정 URL 로 재방문은 브라우저 HTTP 디스크 캐시로 충족(단 HTTP 캐시는 evict 가능 = 계약 아님, 최초 방문 오프라인이면 실패, SW 캐시 불가 자체는 여전히 참). 잔존 = ① 최초 방문 서드파티 render-blocking CSS(preconnect 조차 없음) = 랜딩 LCP 가 jsdelivr RTT/가용성에 결합, ② 명시 원칙(Cloudflare 단일 벤더) 위반 + "기존 나쁜 패턴 복제 금지" 클래스(시안 HTML CDN 링크의 production 복제). 수정 저비용 → MAJOR 유지.
- **수정 방향**: Pretendard 서브셋 woff2 를 `apps/web/public/fonts/` self-host(+ @font-face, font-display:swap) → 동일 오리진화로 sw.js CacheFirst 자동 적용. 최소 완화라도 preconnect + 비동기 로드 전환.

#### MAJOR-2 [Advocate] FlipDeck 전역 Space 키 핸들러가 포커스된 버튼의 표준 Space 활성화를 가로챔 — 키보드 사용자가 '건너뜀'을 누르려다 의도치 않게 정답이 공개됨

- **파일**: `apps/web/src/components/public/FlipDeck.tsx:57-76`
- **내용**: window keydown 에서 `e.key === ' ' && revealed === null` 이면 preventDefault 후 doFlip(). e.target 가드는 input/textarea 만 제외(:60) — **버튼 미제외**. Tab 으로 '건너뜀'(:159-166) 포커스 후 Space(버튼 표준 활성화 키) → click 억제 + 카드 플립 = **정답 강제 노출**. 방법론 §M2(머릿속 인출 후 확인)의 '스스로 답 생성' 단계 파괴 + 앞면 복귀 경로 없음(자평 강제). :175 에서 'Space' 단축키를 UI 에 명시 광고하므로 실사용 경로.
- **확인 증거**: FlipDeck.tsx:59-64 가드 범위 / :159-166 앞면 포커스 가능 '건너뜀' 버튼 / :8 '정답은 플립 전에 노출 금지' 컴포넌트 명시 하드 룰 / e2e public-practice.spec.ts:91 — 클릭 경로만 커버(키보드 미커버)
- **반론**: Tab+Space 사용자 비율 낮음·본인 무료 연습 카드라 데이터 피해 0·Enter 활성화는 정상 동작. 반론의 반론: Space 는 버튼 활성화 표준 키 — '기본 동작이 배신하는' 클래스 결함이고 수정 3줄.
- **적대 반증 판정(keep)**: 전 주장 실코드 확증(preventDefault 가 keydown 에서 기본 동작을 취소하면 keyup click 미발화 → 건너뜀 대신 강제 공개, reveal 후 건너뜀 버튼 소멸 = 복구 경로 없음). 기존 가드·테스트의 키보드 경로 커버 0. 영향 유계(무료 연습·카드 1장·Enter 우회)라 상향은 없으나, 자체 하드 룰 위반 + 복구 불가 + 수정 저비용 = MAJOR 유지.
- **수정 방향**: 키 핸들러 가드에 `HTMLButtonElement/HTMLSelectElement/HTMLAnchorElement` 제외 추가(또는 `e.target !== document.body` 화이트리스트). PublicQuestionCard.tsx:107-108 의 1–5 키 핸들러도 동일 가드 통일 권장(저위험).

#### MAJOR-3 [Advocate] Pretendard 제3자 CDN 스타일시트 — SRI(integrity) 부재 + 오프라인 PWA 미캐시 + 단일 벤더 원칙 긴장 (MAJOR-1 과 동일 근원, 보안 렌즈)

- **파일**: `apps/web/src/layouts/BaseLayout.astro:52-55`
- **내용**: CDN `<link>` 에 integrity/crossorigin 부재 → CDN 변조 시 악성 CSS 주입(피싱성 UI 재구성, CSS 셀렉터 기반 입력 정찰) 표면. 폰트 미로드 시 공유 이미지(share-image.ts:29 FONT='Pretendard...')도 폴백 렌더로 디자인 정본 이탈 카드 생성. 무인증·PII 0 표방 표면에서 방문자 IP 가 제3자에 전송.
- **확인 증거**: BaseLayout.astro:52-55 integrity/crossorigin 없는 cross-origin stylesheet / sw.js:44-46 CDN 자산 SW 캐시 제외 / share-image.ts:29 Pretendard 우선 canvas FONT / 원장 :18 — 서체 = Pretendard 400/500 이 디자인 정본
- **반론**: jsdelivr 대형 CDN·@v1.3.9 버전 고정·CSS 는 JS 실행 불가 — MINOR 로 볼 수도. 반론의 반론: 무인증 홍보 표면은 첫인상=전환률, SRI 1줄로 변조 축이 닫힘.
- **적대 반증 판정(keep)**: 완화 가드 전무 실측(\_headers 없음·CSP 0건·자가호스팅 woff2 없음). sw.js:75 주석이 CacheFirst 대상에 '폰트' 를 명시하나 유일한 폰트가 cross-origin = SW 자체 설계 의도와도 모순(발견보다 강화). 버전 핀은 upstream 변경만 막고 CDN측 변조/오배포는 못 막음. **부가 정정: 제안 fix 의 SRI(b안)는 CSS 파일만 보호하고 CSS 가 당기는 woff2 는 SRI 불가 — 자가호스팅(a안)이 유일한 완결 해법이므로 a안 1순위 집행**. 문서화된 진산 결정(단일 벤더) + 전 트래픽 무인증 표면 + 보상 통제 0 = MAJOR 유지.
- **수정 방향**: (a, 1순위) woff2 서브셋 자가 호스팅 → SW CacheFirst 자동 편입. (b, 차선) integrity+crossorigin=anonymous + preconnect.

#### MAJOR-4 [Contract] Pretendard 외부 CDN 런타임 의존 신규 도입 — 위임 결정 기록 누락(Silent Pivot 소지)

- **파일**: `apps/web/src/layouts/BaseLayout.astro:52-55`
- **내용**: git diff 로 본 변경 신규 도입 확인. 문제 3축: ① 진산 명시 원칙 "Cloudflare 로 대체 가능하면 무조건 Cloudflare" — 폰트는 Pages 정적 자산으로 self-host 자명. ② PWA 오프라인·CDN 장애 시 폰트 미캐시(폴백 강하 — 기능 손상 0이나 '오프라인 PWA' 표방과 긴장). ③ 무인증·PII 0 표방 표면에서 방문자 IP 제3자 전송. **결정 기록 관점: P4 원장 §1.1 은 서체 이식 위치를 "tailwind.config + 전역 CSS" 로만 기록 — 외부 CDN 런타임 의존이라는 갈림길이 위임 결정 기록(P4-D1~D7)에 없음** = 위임 체제(갈림길 = 결정+사유 기록 의무) 미기록 이탈.
- **확인 증거**: git diff 신규 추가 확인 / sw.js:44-47 / 원장 §1.1 서체 행 CDN 언급 없음 / claudeDesign/index.html:9 동일 CDN 링크(이식 출처)
- **반론**: '시안 충실 이식' 해석 가능·단일 벤더 원칙의 명시 표적은 SaaS 였음·폴백 체인으로 기능 손상 0 — 다만 그 경우에도 위임 결정 기록에는 남겼어야 함.
- **적대 반증 판정(keep)**: git log -S 로 과거 커밋 0건(본 변경 신규) 확증. 반증 3축 전부 실패: '시안 이식' 은 원장이 다른 기전을 명기한 사실을 못 덮고, 'SaaS 표적' 이라도 기록 의무는 남으며, '기능 손상 0' 은 발견이 주장한 바 아님. 위임 체제 갈림길 미기록 + 진산 명시 원칙 긴장 + SW 설계 의도 모순 = MAJOR 유지 (기능 손상 0·P5 전 수정 가능 = CRITICAL 아님 / 미기록 Silent Pivot 소지 = MINOR 아님).
- **수정 방향**: (a안, 권고) woff2 서브셋 self-host + @font-face 전환. 또는 (b안) P4 원장 §2 에 'CDN 유지' 위임 결정을 사유와 함께 명기하고 진산 사후 거부권에 노출.

> **MAJOR 통합 처분 노트**: MAJOR-1/3/4 는 동일 근원(BaseLayout CDN 1줄)의 성능/보안/계약 3렌즈 병기 — 자가호스팅 1건 집행으로 3건 동시 해소 + 원장 결정 기록 1줄 추가. MAJOR-2 는 3줄 가드 수정.

### MINOR (24건)

#### Surgeon (7건)

**MINOR-1** `apps/api/src/public/routes.ts:367-374` — JWT_SECRET 회전 시 in-flight MC 문항 무음 오채점(정답 선택→오답 표시). resolveChoiceId 매칭 실패 null → isCorrect=false, correctChoiceIds 신규 시드 재발급으로 프론트 위치라벨 원문 폴백 노출. 위조와 회전이 서버에서 구분 불가가 근본 원인. [확인: choice-id.ts:69-81 / routes.ts:374 / routes.test.ts:234-242(회전 케이스 미커버) / PublicQuestionCard.tsx:38-43] [반론: 회전은 드문 운영 이벤트·영향 창 = 화면 위 문항 1개, 위조를 400 구분 응답하면 오라클 제공 우려 — 다만 '회전 직후 오채점 창' 은 운영 원장에 명기가 정직] [fix: 24-hex 형식이면서 null 인 경우 422 CHOICE_ID_STALE(재서빙 유도) 검토, 최소 logger.warn + 배포 원장 명기]

**MINOR-2** `apps/web/src/components/public/PublicPracticeApp.tsx:56-97` — fetchNext 경합: AbortController·세션 신선도 검사 부재로 이전 세션 in-flight 응답이 새 세션에 착지(모드 불일치 문항 렌더, blank 세션에 MC 착지 시 /grade 400 CHOICE_ID_REQUIRED 강하). 오채점은 없음(문항 id 와 표시 문항 항상 일치). [확인: :60-76 신선도 검사 없음 / :80-82 finally 조기 loading 해제 / :190-194 모드 선택 복귀 시 미취소 / routes.ts:355-357 에러 강하] [반론: 늦은 발사가 먼저 resolve 하는 역전 필요 = 재현 확률 낮음] [fix: 세션 세대 카운터(ref) 스냅샷 불일치 시 결과 폐기 또는 AbortController 결속]

**MINOR-3** `apps/web/src/components/public/PracticeSummary.tsx:72-82` — doShare 예외 시 shareState 'busy' 고착(공유 버튼 영구 비활성) + unhandled rejection. shareOrDownload 의 File 생성(share-image.ts:114)·다운로드 폴백(:129-137)은 try 비보호. [확인: :73-81 복구 전이 없음·void 호출(:141) / share-image.ts:119-128 try 는 nav.share 분기만 / :99-107 canvasToPngBlob 은 방어됨] [반론: 대상 브라우저에서 File/createObjectURL 은 사실상 항상 성공 — 그래도 무음 실패 계열] [fix: doShare try/catch → setShareState('failed') 전이('생성 실패 — 다시 시도' 라벨 재사용)]

**MINOR-4** `apps/web/src/components/public/PublicQuestionCard.tsx:120-128` — 복수정답 문항에서 정답을 맞힌 경우 나머지 정답 보기 표식 미표시. gradeStateOf 가 `isAnswerChoice && !grade.isCorrect` 조건 — isCorrect=true 면 다른 정답 보기 'none'. ResultBlock 도 정답 시 정답 텍스트 미표시 = 복수정답 정보 완전 소실. 채점 자체는 정확(정답 안전 위반 아님, 표시 결손). [확인: :126 실코드 / mc-answer.ts:5-13 production 복수정답 6건 실측 주석 / routes.test.ts:217-232 서버는 전체 correctChoiceIds 반환 / ResultBlock.tsx:31-35] [반론: 단일 정답 519/525 절대 다수·오학습 위험 제한적] [fix: 조건에서 !grade.isCorrect 제거(my-correct 우선순위 유지)]

**MINOR-5** `apps/web/src/components/public/api.ts:15` — API_BASE localhost 폴백 무음: production 빌드에서 PUBLIC_API_BASE_URL 미주입 시 공개 표면 전체가 조용히 localhost:8787 호출. 선재 4파일 동일 패턴 복제(신규 결함 아님·sw.js:69 과거 사고와 동일 뿌리). [확인: grep 동일 패턴 5파일 / .env.example:8 문서화 존재 / sw.js:68-69 과거 사고 주석] [반론: dev 필수 폴백·배포는 P5 소관·이 파일만 고치면 오히려 드리프트 — 일괄 처리가 맞음] [fix: P5 배포 체크리스트에 Binary Gate 등재 또는 공용 모듈로 PROD fail-loud 5파일 일괄(별건 카드)]

**MINOR-6** `apps/web/public/sw.js:159-164` — syncOfflineActions NOT IMPLEMENTED stub 잔존(규칙 3 보고 의무 이행 표기). **선재 코드·CLAUDE.md RC-3 정직 표기 기결 원장 항목** — 본 P4 변경분 아니고 공개 표면(G-1 로컬 진도)은 이 경로 미사용(영향 0). [확인: sw.js:159-164 / CLAUDE.md 스택 섹션 원장 등재 / store.ts Dexie 직접 기록 = sync 태그 미경유] [반론: 규칙대로면 stub=CRITICAL 이나 기결 이연 항목의 중복 상신이 됨 — 단 매 리뷰 표기는 유지해야 원장이 은닉처가 안 됨] [fix: 조치 불요, 미사용 재확인만]

**MINOR-7** `apps/web/src/components/public/StreakPanel.tsx:32-42` — 30일 스트립 최고(最古) 칸 부분 누락: cutoff 가 KST 일 경계가 아닌 instant(now−30d) 기준이라 29일 전 날짜의 이른 시각 리뷰가 조회 누락 → 학습일인데 빈 dot 가능. 스트릭 수치(getStreak 정본)는 무영향. [확인: :32 instant cutoff / :38-41 KST 버킷 / store.ts:149-154 정본 dayBoundsUtc 존재(재사용 미적용)] [반론: 맨 끝 1칸·하루 지나면 밀려남·1줄 수정] [fix: cutoff = dayBoundsUtc(todayDateString(now−29d)).startUtc]

#### Architect (5건)

**MINOR-8** `apps/web/public/robots.txt:6` (+ sitemap.xml:4,9) — 절대 URL 하드코딩: astro.config 는 PUBLIC_SITE_URL env 주입(G-5)인데 robots/sitemap 은 thepick-study.pages.dev 리터럴 = 이중 진실원, 커스텀 도메인 전환 시 무음 drift. [확인: astro.config.mjs:5-7 / robots.txt:6 / sitemap.xml:4,9 / 원장 P4-D5 drift 조건 미명시] [반론: 현 배포 도메인과 정확 일치·커스텀 도메인 미확보 = 지금 틀린 값 없음] [fix: Astro endpoint 화(Astro.site 파생) 또는 P5 도메인 전환 체크리스트에 2파일 명기]

**MINOR-9** `apps/web/src/components/public/PracticeSummary.tsx:58` — siteUrl 폴백 리터럴이 astro.config 기본값과 2벌 중복(G-5 리터럴 단일 선언 정신과 긴장). Astro 빌드에선 SITE 항상 정의 = 폴백 dead code 이나 vitest/비 Astro 경로에서 살아남. [확인: :58 / astro.config.mjs:7 동일 리터럴 / share-image.ts:13-14 주입식 설계 의도 명시] [반론: 마케팅 문자열이라 drift 실해 작음] [fix: 폴백 제거 후 SITE 부재 시 URL 줄 생략(또는 상수 모듈 승격)]

**MINOR-10** `apps/web/public/sw.js:49-58` — '/api/public NetworkOnly'(P4-D7)는 same-origin 에만 실효 — 현 구성(dev·prod 모두 cross-origin API)에선 도달 불가 방어. 코드는 무해한 선제 방어(향후 same-origin 프록시 대비)로 옳으나 **원장 P4-D7 의 근거 서술("현 SWR 버킷이 /next 캐시 → 재서빙")이 실코드와 어긋남**(문서-코드 정합성). [확인: sw.js:44-47 cross-origin 선제 제외 / api.ts:15 항상 절대 URL 타 오리진 / 원장 §2 P4-D7 서술 / index.ts:135 CORS = cross-origin 정상 경로] [반론: same-origin 합류 순간 실효 = 선제 방어로서 코드 옳음, 문제는 결정 기록 인과뿐(실행 영향 0)] [fix: 원장 사유를 "현 구성 cross-origin = SW 미경유(45행), same-origin 전환 대비 선제 차단" 으로 정정]

**MINOR-11** `apps/web/src/components/public/PublicPracticeApp.tsx:61-72` — 중복 회피 재시도(문항당 최대 3회 서빙 fetch)가 공개 rate limit(60req/60s/IP)을 최대 3배 소모 — 좁은 필터·NAT 공유 IP(스터디카페 등) 환경에서 세션 중반 429 조기 도달 경로. [확인: :63-72 재시도 루프 / wrangler.toml:254-257 limit 60/60s / rate-limit.ts:29-34 per-IP 단일 축 / StatusPanels.tsx:43-55 429 정직 안내 UI 존재] [반론: 521 풀에서 중복 3연속 확률 낮음·429 도 무음 아님 — 실측 전 과설계 우려] [fix: P5 관측 후 excludeIds 파라미터/조기 중단 검토, 3→2 축소 검토]

**MINOR-12** `apps/api/src/public/routes.ts:368-374` (+ PublicQuestionCard.tsx:38-43) — 해석 불가(위조·stale·secret 로테이션) choiceId 를 4xx 거부가 아닌 '오답' 채점 — "해석 불가 ≠ 오답" 무구분. secret drift 시 정답 선택자 오답 처리 + 정답 하이라이트 0개 + 위치라벨 폴백 오도 + AE 지표 오염 + FSRS again 오기록. **[적대 반증: MAJOR→MINOR 강등]** 사실 주장 4건 전부 정확(거짓 양성 아님)이나, 서빙·채점이 동일 Worker·동일 `c.env.JWT_SECRET ?? ''` = 단일 배포 내 drift 불가능, choiceId 는 날짜 무의존 결정적(stale 탭도 secret 불변이면 정상 채점) → 유일 피해 시나리오 = 로테이션 배포가 서빙→제출 사이에 끼는 경우, 피해 = in-flight 문항 1건/유저·다음 fetchNext 자가 치유. 위조의 200 오답 흡수는 무인증 표면 방어적 기본값 + 테스트 고정 의도 설계(Silent Pivot 아님). [확인: choice-id.ts:69-81 / routes.ts:374-379 / PublicQuestionCard.tsx:38-43 + routes.ts:203 cryptoShuffle / routes.test.ts:234] [fix: null 시 400 CHOICE_ID_INVALID + 클라 재서빙 + AE 미기록(지표 보호) — 계약 정확성 개선으로 유지 가치]

#### Advocate (8건)

**MINOR-13** `apps/web/src/components/public/PublicPracticeApp.tsx:126-137` — '건너뜀'만 반복 시 세션 무한(진행 '1/10' 고정) + 건너뜀마다 서버 서빙·rate limit 소모(재시도 포함 최대 3회). [확인: :152-159 skipped 미집계 / :61-71 재시도 / routes.ts:210-224 선행 rate limit] [반론: '넘기며 훑기' 는 정당한 사용 패턴 — 강제 종료가 오히려 방해, 데이터 오염 없음(집계는 채점분만)] [fix: skippedCount 포함 종료 또는 '채점 n · 건너뜀 m' 정직 표기]

**MINOR-14** `apps/web/src/components/public/BlankNote.tsx:46-65` — 힌트 버튼 연타 시 /reveal 중복 호출: in-flight 가드 부재 → AE 'card' 지표 이중 계상 + rate limit 소모(기능 피해 0). FlipDeck 은 revealing 가드(:40) 보유 = 비대칭. [확인: :46-53 플래그 없음 / FlipDeck.tsx:39-41 대조군 / routes.ts:490-494 성공마다 AE 기록] [반론: 더블탭 드묾·AE 는 근사 지표 — 단 '카드 소비 지표'(analytics.ts:5)가 홍보 성과 원천이므로 값싼 가드 가치 있음] [fix: hintLoading state + 진입 가드 + disabled]

**MINOR-15** `apps/web/public/robots.txt:6` — (MINOR-8 동일 사안, Advocate 렌즈) 배포 URL 하드코딩 — G-5 env 주입 설계와 드리프트, CLAUDE.md "config 주입, 하드코딩 금지" 명시와 긴장. [확인: robots.txt:6 / sitemap.xml:4,9 / astro.config.mjs:5-7] [반론: 현 값이 곧 진실·전환 시 몇 초 수정 — 단 '고쳐야 한다는 사실' 미기록 = 무음 드리프트이므로 최소 원장 등재 필요] [fix: MINOR-8 과 통합 처분]

**MINOR-16** `apps/api/src/public/routes.ts:219-221` — 429 Retry-After '60' 하드코딩: 실제 limit/period 는 wrangler.toml unsafe binding 선언 — period 변경 시 사용자 안내 수치 오류. 프론트는 그대로 표시(StatusPanels.tsx:55). [확인: :220 리터럴 / StatusPanels.tsx:43,55 / auth/rate-limit.ts:12-15 선언 위치] [반론: Retry-After 는 힌트성 헤더·60초 보수 기본값 무해] [fix: 명명 상수 PUBLIC_RATE_LIMIT_WINDOW_SEC 승격 + wrangler.toml 값 핀 주석]

**MINOR-17** `apps/api/src/public/routes.ts:173-175` — 진성 '순수 숫자' 단답 fill_blank 문항 영구 미서빙: MC-in-disguise 판별(parseMcAnswerLabels)이 정답 텍스트만으로는 진성 숫자 단답('3','2,3','④')과 비구분 → 서빙·채점·reveal 전부 거부, 손실이 어디에도 미집계. 현 production 525건은 전부 위치라벨(원장 실측) = 현 실손실 0. [확인: :173-175 / mc-answer.ts:44-72 비구분 파싱 / :386-394,479-484 동일 거부 / 원장 :51 정직 기록] [반론: 1차 객관식 특성상 진성 숫자 단답 부재 가능성 높음 — 단 BE-1 후 데이터 변화 시 무음으로 삼키는 구조는 기록 필요] [fix: 콘텐츠 트랙에 '숫자-단답 존재 1-쿼리 실측' 원장 항목 추가. 코드 변경은 실측 전 불요(현 fail-safe 가 정답 100% 원칙 부합)]

**MINOR-18** `apps/web/src/components/public/api.ts:15` — (MINOR-5 동일 사안, Advocate 렌즈) localhost 폴백 = 배포 footgun, 기계 강제(빌드 fail-loud) 없음. [확인: api.ts:15 / .env.example:2-8 / sw.js:68-69 / 원장 :52 P5 게이트 명시] [반론: 지배 관례·dev 필수·현 study 표면 동작 중이면 신규 위험 0] [fix: MINOR-5 와 통합 처분 — P5 Binary Gate 등재]

**MINOR-19** `apps/web/src/components/public/StreakPanel.tsx:32-42` — (MINOR-7 동일 사안, Advocate 렌즈) 가장 오래된 dot 과소집계(UTC instant cutoff vs KST 버킷). [확인: :32 / :34,39 / store.ts:149-154] [반론: 시각 1픽셀 수준 — 단 '수치로만 말한다' 디자인 원칙에 흠집] [fix: MINOR-7 과 통합 처분]

**MINOR-20** `apps/web/src/components/public/ResultBlock.tsx:22` — 결과·오류 aria-live 영역이 콘텐츠와 동시 마운트: live region 은 '기존 영역의 내용 변경' 알림 메커니즘이라 영역 자체 신규 삽입 패턴은 NVDA/VoiceOver 조합에 따라 낭독 누락 가능. 정오 판정 = 핵심 피드백(모바일 80%·접근성 축). [확인: ResultBlock.tsx:22 + PublicQuestionCard.tsx:186-193 조건부 통째 마운트 / FlipDeck.tsx:130-131 동일 패턴 / StatusPanels.tsx:48 role=alert 동일 클래스] [반론: role=alert 는 대부분 삽입 시에도 낭독·시각 변화 동반 — 실기기 SR 검증 없이 단정 불가, '검증 필요' 수준 기록이 정직] [fix: 상존 빈 aria-live 컨테이너에 내용만 채우는 구조(또는 role=status + aria-describedby)]

#### Contract (4건)

**MINOR-21** `apps/web/public/sitemap.xml:4,9` (robots.txt:6 동일) — (MINOR-8/15 동일 사안, Contract 렌즈) G-5 'config 주입' 원칙과의 드리프트 표면. P4-D5 원장에 "정적 추가" 기록 실재 = Silent Pivot 아님. [확인: robots.txt:6 / sitemap.xml:4,9 / astro.config.mjs:7(대조군 G-5 정합) / 원장 §2 P4-D5] [반론: public/ 파일은 빌드타임 env 치환 불가가 Astro 기본·2 URL 에 @astrojs/sitemap 은 과설계 가능] [fix: P5 체크리스트 1줄 등재(또는 @astrojs/sitemap 자동화) — MINOR-8/15 와 통합 처분]

**MINOR-22** `apps/web/src/components/public/PublicQuestionCard.tsx:34-43` — correctChoiceTexts 폴백이 원본 위치라벨("3")을 셔플된 화면에 노출: 화면 번호는 셔플 후 재부여라 폴백 "3" ≠ 화면 ③ 가능 — 정답 안전 인접 오해 표면. 단 정상 경로는 동일 HMAC 재발급으로 매칭 항상 성립 — 도달 조건 = secret 회전·데이터 결함뿐, 테스트도 '무음 빈 문자열 금지' 의도로 폴백 고정. [확인: :38,42 / routes.ts:375-379 재발급 보장 / choice-id.ts:18 결정성 / PublicQuestionCard.test.tsx:53-60] [반론: 폴백 없이 빈 문자열이 더 나쁜 UX·도달 확률 극저] [fix: 폴백 시 위치라벨 대신 "정답 표식을 불러오지 못했다 — 다음 문제로" 안내(셔플 화면에서 위치라벨은 의미 왜곡 = 비노출이 정직)]

**MINOR-23** `apps/api/src/public/routes.ts:490-494` — AE 'card' 이벤트에 카드플립 소비와 빵꾸노트 힌트 요청 무구분 혼입 → BE-6③ '카드 소비 지표' 해석 시 과대 집계. P4-D1 원장이 두 용도 모두 명기 = Silent Pivot 아님, 이벤트 3종 계약 준수. [확인: :490 무조건 'card' / BlankNote.tsx:52 힌트 호출 / FlipDeck.tsx:44 플립 호출 / 원장 §2 P4-D1] [반론: inputType blob 으로 사후 부분 분리 가능 — 단 플립이 fill_blank 도 지원(P4-D3)해 완전 분리 불가] [fix: 집계 문서에 "card = reveal 총량(플립+힌트)" 정의 정직화 또는 RevealBodySchema optional source('flip'|'hint') blob 추가]

**MINOR-24** `apps/web/src/pages/index.astro:11-15` (+ constants.ts:50-57) — 랜딩·픽커 production 스냅샷 하드코딩(521문항·7회분·3과목·과목명 3종) — 신선도 관리 장치 부재. 완화 실재: constants.ts 헤더가 '불일치 시 NO_QUESTION 정직 강하(무음 오동작 없음)' 명기 + 서버 목록 API 미제공 사유 기록 = 원칙 긴장이 문서화로 완충됨. [확인: index.astro:11-15(원장 §4 일치) / constants.ts:50-57 / e2e fixtures 표기 교차 / git log 8007a0b '521' 정합] [반론: 홍보 카피 수치는 사람 손 갱신이 정상·오동작 경로 없음 — '서비스 사망' 급 하드코딩과 클래스 다름] [fix: BE-1 콘텐츠 승급 체크리스트에 '랜딩 수치 + FIRST_EXAM_SUBJECTS/ROUNDS 동기' 등재(v2 목록 API 시 상수 제거)]

---

## Pass별 확인 항목 전수 (증거 기반 보고 — 규칙 2)

### Pass 1 — SURGEON (✅ 21 / N/A 4)

1. PASS: apps/api/src/public/routes.ts:262-276 — /questions/next D1 .all() try/catch + 후보 0건(빈 배열) → 404 NO_QUESTION 정직 강하 (경계값·에러 처리)
2. PASS: apps/api/src/public/routes.ts:327-347,438-457 — /grade·/reveal .first() 반환 null 체크 후 404, answer NULL/'' → 422 (Null 크래시 경로 없음)
3. PASS: apps/api/src/public/routes.ts:183-204,376-379,472-476 — buildPublicChoices/issueChoiceId 루프 await 전수 정합 (await 누락 0)
4. PASS: apps/api/src/public/routes.ts:236-260 — SQL 동적 부분은 상수(LIMIT=SERVE_CANDIDATE_LIMIT, IN 플레이스홀더)뿐, 사용자 입력은 전부 bind (인젝션 경로 0)
5. PASS: apps/api/src/public/routes.ts:154-177,384-404 — isServable fail-safe: MC-in-disguise·essay/calc 서빙·채점 양쪽 거부 = 오채점 차단, Formula Engine 미경유 문자열 폴백 금지
6. PASS: packages/learning-modes/src/input-types/mc-choices.ts:72-78 — 무음 원소 filter 금지(위치 오염→오답이 정답 처리 차단), 비문자/빈 원소 전수 거부
7. PASS: packages/learning-modes/src/input-types/mc-answer.ts:51-69 — 범위 밖('0','6'+)/중복 토큰('3,3')/비정형(',3') 거부, MC_MAX_CHOICES = CHOICE_LABELS 파생(리터럴 드리프트 0)
8. PASS: packages/learning-modes/src/input-types/fill-blank.ts:28-30 — normalize 후 빈 문자열 양쪽 오답 처리 (빈 입력 경계)
9. PASS: apps/api/src/public/choice-id.ts:75-80 — 제출 choiceId 길이 가드 + 매칭 실패 null (보기수 ≤5 HMAC 재계산, 무상태 계약 정합)
10. PASS: apps/api/src/public/analytics.ts:44-60 — writeDataPoint try/catch + console.warn (빈 catch 0, fire-and-forget 이 학습 응답 미차단)
11. PASS: apps/api/src/public/rate-limit.ts:26-34 — 바인딩 미설정 시 auth handleMissingBinding 재사용 = prod fail-closed (auth/rate-limit.ts:54-72 대조)
12. PASS: apps/web/src/components/public/api.ts:72-103 — fetch reject→network, res.json() 파싱 실패→code null 폴백(무음 데이터 삭제 아님, 사용자 문구 정본 매핑)
13. PASS: apps/web/src/lib/local-progress/store.ts:59-109 — recordReview 단일 rw 트랜잭션에 4스토어 전부 포함 (부분 커밋 경로 0)
14. PASS: apps/web/src/lib/local-progress/export.ts:134-179 — import 검증 실패 시 사유 포함 throw (무음 부분 적재 금지), Infinity/Invalid Date/중복 cardId 의미 검증
15. PASS: apps/web/src/lib/hangul-hint.ts:39-44,53-60 — codePointAt undefined 가드 + 비한글 마스킹 (순수 함수, DOM 무접촉)
16. PASS: packages/learning-modes/src/session-progress.ts:53-58,75-79 — isOneDayApart Date.parse 실패 false / dayBoundsUtc 무효 날짜 throw (silent corruption 차단)
17. PASS: PublicQuestionCard.tsx:54-60 + BlankNote.tsx:34-42 + FlipDeck.tsx:33-37 — question.id 교체 시 입력·grade·힌트 상태 전수 초기화 (stale 결과 잔존 차단)
18. PASS: apps/web/src/components/public/StreakPanel.tsx:62-78 — IDB 불가 환경(프라이빗 모드) catch→warn→패널 접힘, cancelled 플래그로 unmount setState 차단
19. PASS: apps/web/public/sw.js:49-58 — /api/public/ NetworkOnly 등재 (랜덤 서빙 /next SWR 캐시 오염 차단)
20. PASS: apps/api/src/public/\_\_tests\_\_/routes.test.ts:135-159,272-309,340-355 — 2차/flagged 경계 회귀가 서빙·채점·reveal 3표면 전부 커버, MC-in-disguise·essay 422 커버
21. PASS: grep TODO/HACK/FIXME/any — apps/web/src/components/public + lib/{hangul-hint,share-image,local-progress} + apps/api/src/public 전체 0건 (exit 1)
22. N/A: Formula Engine 동적 코드 실행 — 본 스코프에 산식 연산 코드 0 (공개 표면은 calc 채점 자체를 422 거부, routes.ts:397-404)
23. N/A: Vectorize/Claude API/pdfplumber await — 본 스코프 호출 0 (public 표면 = D1 + Analytics Engine 만)
24. N/A: 산식 정밀도·FSRS 음수 interval — 수치 연산은 정답률 %(Math.round) 표시용뿐, FSRS 전이는 @thepick/srs 정본 위임(store.ts:64)
25. N/A: 유사도<0.60 Graceful Degradation — RAG 검색 경로 본 스코프 밖

### Pass 2 — ARCHITECT (✅ 16 / N/A 4)

1. PASS — Import 방향(packages 단방향): learning-modes/src/index.ts:15 의존=@thepick/shared 뿐, mc-answer.ts:20 은 패키지 내부 참조, routes.ts:22-33 은 shared+learning-modes+api 내부만, web dependencies = @thepick/{learning-modes,shared,srs} — 역방향 위반 0
2. PASS — todayDateString 이중 정의 의혹 해소: shuffle.ts:26 이 session-progress.ts 정본을 re-export (구현 1벌)
3. PASS — 클라이언트 srs/learning-modes runtime 소비 계약: store.ts:13-14 = D-1 위임 결재(2026-07-08) 개정 계약 정합. 채점 함수·정답 데이터 클라 미유입 — 채점은 전부 서버 /api/public/grade
4. PASS — Workers 제약: routes.ts:139 crypto.getRandomValues, choice-id.ts:45-52 crypto.subtle(HMAC) = Web Crypto 만, fs/path 0. 요청당 HMAC ≤5+α회·후보 10행 — CPU 예산 미미
5. PASS — D1 스키마 일치: ServeRow/GradeRow(routes.ts:55-74) 컬럼 = exam_questions 실 shape, raw prepared statement(NC-1 정합), 테스트 스키마 동형
6. PASS — 시험 경계 강제 3중: serve :236-237 / grade :331 / reveal :443 전부 exam_type='1st' AND status='active' 서버 고정 + 회귀 테스트 5건
7. PASS — CORS 배선: index.ts:135 '/api/public/\*' credentials:false 별도 CORS + CORS_ALLOWED_ORIGINS 에 thepick-study.pages.dev 포함, Retry-After = CORS_EXPOSED_HEADERS 등재 → api.ts:90-94 판독 배선 완결
8. PASS — learning-modes 단일 정본 재사용(복붙 0): routes.ts:172,359,464 parseMcChoices / :174,386,479 parseMcAnswerLabels / :396 gradeFillBlank — answer 해석 재구현 없음
9. PASS — mock-server ↔ 실서버 계약 동형: server.ts:313-378 응답 shape·에러코드 문자열 = routes.ts 일치, fixtures PublicQuestionFixture = PublicQuestion 필드 동형
10. PASS — E2E 네트워크 경로 정합: playwright.config.ts:95-113 webServer(4321+8787 mock) = api.ts:15 API_BASE 기본값 일치 → island 실 cross-origin fetch 로 mock 도달
11. PASS — Temporal Graph: 공개 라우트 전체 SELECT only(UPDATE/INSERT 0), AE 는 append 이벤트 — UPDATE 금지 Hard Limit 무접촉
12. PASS — KST 일경계 단일 정본: store.ts:57 todayDateString + :152 dayBoundsUtc = 서버 study 경로 동일 함수(ADR-041), StreakPanel 동일 함수. computeStreakUpdate changed=false 는 same-day 한정 → store.ts:103 write skip 안전
13. PASS — grade/reveal 경계 동형성: reveal(:428-504)이 grade 와 동일 WHERE·동일 MC-in-disguise 거부(:479)·essay/calc 422(:487) — 정보 노출 표면 grade 와 등가(P4-D1 주장 실코드 확증)
14. PASS — 프론트 정오 표식 = 서버 기준: gradeStateOf 가 서버 correctChoiceIds/isCorrect 만 소비(클라 자가판정 0), FlipDeck·BlankNote 도 서버 reveal 1회 수신(클라 선보유 금지 이행)
15. PASS — local-progress 는 기존 D1 미러 DB 와 격리: db.ts:99 'thepick-local-progress' 고유 DB명(지뢰 #7 회피), export.ts 봉투 검증 fail-loud
16. PASS — IndexedDB↔D1 동기화: local-progress 는 G-1 설계상 서버 동기화 없음(db.ts:2-6 명시), sw.js:159-164 stub 은 선재 legacy(RC-3 정직 표기 기존재) — 본 변경분 아님
17. N/A — Ontology Lock: 본 스코프에 knowledge_nodes/edges ID 생성 0 (exam_questions 소비만)
18. N/A — truth_weight 정렬: RAG/검색/LLM 주입 경로 무접촉
19. N/A — Hexagonal(modules/ domain→infrastructure): 해당 구조 비대상(Hono route + React island + 순수 lib)
20. N/A→결재 정합 — i18n: 한국어 하드코딩은 P4-D6 위임 결정(원장 §2 — 지배 관례 채택 + 에러코드→문구 단일 매핑 api.ts:18-29)으로 명시 처분됨

### Pass 3 — ADVOCATE (✅ 23 / N/A 3)

1. PASS 정답 안전(Hard Stop): 채점·정답은 서버 단독 — routes.ts:316-421 /grade 가 유일 정오 판정, 서빙 projection(:293-303)에 answer/explanation 부재, 클라 자가판정 코드 0
2. PASS 정답 안전(MC 계약 단일 정본): parseMcChoices 무음 filter 금지·위치 정합·중복 보기 거부, 복수정답 correctOriginalIndices 집합 채점(:374) + 테스트 '복수정답 2,3'
3. PASS 정답 안전(fail-safe): isServable 이 채점 불가 문항 서빙 자체를 거부(:166-177) + 양방향 오채점 차단(:386-404) + 회귀 테스트
4. PASS 경계 강제: exam_type='1st'·status='active' 서버 고정 3경로 + 회귀 테스트 (routes.test.ts:135,148,272,279,340)
5. PASS choiceId 불투명성: HMAC-SHA256 절단 24hex, 정답 위치와 무관, 위조/타문항 → null → 오답 처리 + 테스트
6. PASS XSS: 공개 컴포넌트·pages 전체 grep — dangerouslySetInnerHTML/innerHTML/eval/new Function 0건, share-image 는 canvas 순수 그리기
7. PASS API 키/비밀 하드코딩: 클라 번들 시크릿 0 — api.ts:15 공개 URL env 만, choice-id.ts:32 폴백 상수는 서버측·F-3 하 보안 영향 0 주석 정합
8. PASS 입력 검증: 서버 Zod(GradeBodySchema max 128/64/2000, RevealBodySchema) + 쿼리 정규화(subject 100 가드·round 양의 정수·inputType 화이트리스트) + SQL 전부 bind
9. PASS rate limit: 전 핸들러 선행 per-IP(:210-224), 해시 IP(SHA-256+pepper), prod fail-closed/dev fail-open, CF-Connecting-IP 만 신뢰
10. PASS PII 0: AE = kind/subject/round/inputType/examType/정오만, IP·userId·본문·정답 텍스트 미기록, user_progress 기록 0, 진도 100% 로컬 IndexedDB
11. PASS CORS/credentials: /api/public/\* credentials:false 별도 CORS + 마운트 분리 — 인증 쿠키 표면과 격리
12. PASS 에러 UX(Graceful): 에러코드→사용자 문구 단일 매핑(api.ts:18-29), 기술 에러 비노출, 해설 없음 빈 상태 문구
13. PASS 상태 4종(FE-9): 로딩 스켈레톤(role=status)/빈 NO_QUESTION(+e2e)/에러+재시도/오프라인(navigator.onLine 선판정 + OfflineIndicator role=status)
14. PASS 오프라인/SW 전략: /api/public NetworkOnly(P4-D7), navigation NetworkFirst 폴백, 해시 자산 CacheFirst, CACHE_VERSION v3 bump, 랜딩 임베드 오프라인 무음 축퇴(빈 껍데기 비노출)
15. PASS 터치 44px+: 전역 CSS(BaseLayout.astro:74-93) + 주요 CTA minHeight 44~48 전수(PublicQuestionCard/FlipDeck/PracticePicker/PracticeSummary/BlankNote)
16. PASS 접근성 구조: fieldset/legend + sr-only radio 그룹 + focus-within ring + 정오 표식 sr-only 텍스트(색맹 이중 채널) + select sr-only 라벨 + dot strip role=img aria-label + 장식 aria-hidden
17. PASS 로컬 진도 견고성: 기록 실패해도 학습 흐름 유지 + warn(무음 금지), StreakPanel IDB 불가 패널 접힘, persist 요청 + export 안전망
18. PASS 공유 이미지: 서버 무접촉 canvas(PII 0), navigator.share 실패 시 다운로드 폴백 + ObjectURL revoke, 미리보기 = 실생성물(가짜 UI 금지), 실패 상태 표기
19. PASS 빈 catch 0건: 스코프 내 catch 전부 로깅 또는 의미 있는 폴백+주석 (routes.ts / api.ts / share-image.ts / LandingEmbed.tsx)
20. PASS stub/TODO/placeholder: 신규 P4 코드 0건 — 유일 NOT IMPLEMENTED = sw.js:159-164 선재(RC-3 기결·warn 으로 무음 아님)
21. PASS 랜딩 정직성: 수치 = 실데이터(7회분·521문항·3과목 — P3 적재 정합), 과장 카피·그라디언트·트로피 금지 준수, '진도는 이 기기에만' 프라이버시 고지
22. PASS SEO/크롤러 경계: robots.txt /auth/·/study/ Disallow, OG/canonical 은 공개 2페이지만 옵트인
23. PASS e2e/테스트 커버리지(참고): 공개 플로우 5시나리오 e2e + 서버 경계·채점 회귀 31 케이스 — 단 '테스트 통과=안전' 가정 안 함(키보드 Space 충돌·SR 낭독은 미커버 영역에서 발견)
24. N/A LLM 수식 계산·Formula Engine·Constants DB: 공개 표면은 essay/calc 를 서빙·채점에서 배제 — 산식 경로 부재로 비적용
25. N/A IndexedDB↔D1 동기화: 공개 표면 진도는 G-1 설계상 서버 동기화 없음 — 항목 자체 비대상
26. N/A i18n 키 체계: P4-D6 위임 결정으로 한국어 상수 + 단일 매핑 모듈 관례 확정 — 재논의 금지 원장 확인

### Pass 4 — CONTRACT (✅ 25 / N/A 2 / 선재 관찰 2)

1. PASS: 정답 안전(핵심 검증축) — 채점·정답 파생 전부 서버 전용, 클라 정답 선보유 0, 자가판정 경로 없음 (routes.ts:315-422/424-504, PublicQuestionCard.tsx:72-76, BlankNote.tsx:8-9·72)
2. PASS: 서빙 projection answer/explanation 비노출 — routes.ts:81-92·293-303 (내부 ServeRow 에만 존재)
3. PASS: 경계 강제 3경로 — exam_type='1st' + status='active' 서버 고정·클라 파라미터 경로 없음 + 회귀 테스트 '★회귀: 2차/flagged reveal 거부 → 404'
4. PASS: P4-D1(reveal additive) 원장 정합 — /grade 기노출 동일 정보만 반환(isCorrect 필드 없음 테스트 고정), AE 'card' 기록, 신규 유출 표면 0 논거 주석 실재
5. PASS: learning-modes 단일 정본 재사용(복붙 0) — routes.ts:23-29 임포트, mc-choices.ts:8-13 '인증·공개 경로 공유 정본' 명시
6. PASS: MC-in-disguise fail-safe(정답 100% 불변 게이트) — 채점 422(:386-395)·reveal 동일(:479-484)·서빙 차단(:166-177) — BE-1 미승급 문항을 오채점 없이 정직 제외
7. PASS: essay/calc 공개 표면 거부 — :397-404·486-488 = 'LLM/문자열 폴백 수식 채점 금지' Hard Limit 정합
8. PASS: choiceId 불투명·무상태 계약 — HMAC-SHA256 24hex, 채점은 correctOriginalIndices 로만
9. PASS: G-1 로컬 전용 진도 — 서버 user 데이터 기록 0, 진도 = lib/local-progress(Dexie), 스트릭 KST 정본 공유
10. PASS: P4-D4 FSRS rating 매핑 원장 1:1 — rating.ts:11-22 + 골든 5건 + '자동 채점 easy 불가' 전수 루프
11. PASS: M9 힌트 사다리 방법론 정합 — hangul-hint.ts:91-98 = 방법론 문서 :142 순서 그대로, 사용 힌트 수 FSRS 반영
12. PASS: P4-D3(플립 = MC 포함) — FlipDeck.tsx:78·94-127 앞면 보기 동봉/뒷면 emerald 표식, 플립 전 정답 비노출(e2e 검증)
13. PASS: P4-D2(랜딩 B안 + 실패 축퇴) — 정적 소개+CTA+LandingEmbed, catch → collapsed(빈 껍데기 비노출), e2e 시나리오 실재
14. PASS: P4-D5 — astro.config site = PUBLIC_SITE_URL ?? pages.dev(G-5), OG/twitter/canonical = Astro.site 파생, OG 이미지 = icon-512 재사용
15. PASS: P4-D6 — 에러코드→문구 단일 매핑 + '코드 원문 노출 금지' 정규식 테스트 + UI 는 error.message 만 소비
16. PASS: P4-D7 — sw.js CACHE_VERSION v2→v3 + /api/public NetworkOnly
17. PASS: 디자인 하드룰 — bold 700 사용 0건(전수 grep), 신호등 정오색 금지 준수(indigo/amber/emerald = 원장 §1.1 계약), 그림자·그라디언트·폭죽/트로피·과장 카피 0건 (AESTHETIC.md:47·55 대조)
18. PASS: 접근성 — 전역 44px(텍스트 입력 보강 신규) + 전 인터랙티브 minHeight 44/48, sr-only 라디오/라벨, aria-live 결과 패널, role=alert/status
19. PASS: FE-9 상태 4종 — StatusPanels(로딩/빈/에러/오프라인 + Retry-After 표기), api.ts offline kind 선분류
20. PASS: 공개 표면 격리 — index.ts:135 credentials:false 별도 CORS·:176 별도 라우터 마운트(기존 study 라우트 무접촉 = 지뢰 #2), 인증 컴포넌트 무변경(원장 §1.2 '인증 경로 회귀 0' 정합)
21. PASS: rate limit — 해시 IP 키, D1 rate_limits 미사용(지뢰 #6), 미설정 시 auth 동일 fail-closed(prod) 재사용
22. PASS: AE PII 0 — 기록 차원 = kind/subject/round/inputType/examType/정오 뿐
23. PASS: Binary Gate 주장 실측 재현 — `pnpm --filter @thepick/web test` = **74/74 PASS**(신규 public 테스트 5파일 포함) / `pnpm --filter @thepick/api test` = **770 PASS·2 skip·48 파일**(회귀 0) — 본 리뷰 세션 직접 실행
24. PASS: e2e 커버리지 — public-practice.spec.ts 5 시나리오 + mock 계약 실서버 shape 정합(필드 일치 대조)
25. PASS: Hard Rule 17 — 시험 식별 리터럴 신규 유입 0, FIXED_EXAM_TYPE='1st' 명명 상수(routes.ts:48) + AE 상수 주입(analytics.ts:26 'm-9 드리프트 방지')
26. N/A: 노드 ID 네이밍·constants↔교재 수치·BATCH 순서·Ontology Lock·knowledge_nodes/formulas UPDATE 금지·draft-only 적재 — 본 변경셋은 그래프·산식·콘텐츠 적재 무접촉(git status 전수 확인, DB 접촉 = exam_questions SELECT-only: routes.ts:264·328·440)
27. N/A: Drizzle NC-1 — 신규 쿼리 3개 전부 raw prepared statement, drizzle 런타임 임포트 0
28. 관찰(선재·본 변경 아님): sw.js:159-164 syncOfflineActions NOT IMPLEMENTED stub — CLAUDE.md 'RC-3 정직 표기 2026-06-11' 기결 원장 항목, 공개 표면은 이 경로 미사용
29. 관찰(정직 보고 확인): 원장 §3 — 빵꾸노트 라이브 데이터 0(fill_blank 서빙 자격 production 부재)·/api/public/\* 미배포(P5 게이트) 가 무음 아닌 명시 기록으로 실재 — RULE #4 정합

---

## 처분 요약 (후속 액션 큐)

| #                                | 발견                                      | 처분 방향                                                                  | 시급도 |
| -------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------- | ------ |
| MAJOR-1/3/4                      | Pretendard jsdelivr CDN (동일 근원 3렌즈) | woff2 서브셋 self-host(a안 1순위) + P4 원장 결정 기록 1줄 — **P5 배포 전** | 높음   |
| MAJOR-2                          | FlipDeck Space 키 가로채기                | 키 핸들러 버튼류 제외 가드 3줄 + 1–5 키 핸들러 통일                        | 높음   |
| MINOR-1/12                       | choiceId 해석 불가 = 오답 흡수            | 422/400 구분 응답 + AE 미기록 검토(운영 원장에 회전 창 명기 선행)          | 중     |
| MINOR-5/18                       | API_BASE localhost 폴백                   | P5 배포 체크리스트 Binary Gate 등재(5파일 일괄 fail-loud 별건 카드)        | P5     |
| MINOR-8/15/21                    | robots/sitemap URL 하드코딩               | P5 도메인 전환 체크리스트 등재(또는 endpoint 화)                           | P5     |
| MINOR-7/19                       | StreakPanel cutoff 경계                   | dayBoundsUtc 1줄 수정                                                      | 낮음   |
| MINOR-2/3/4/13/14/16/20/22/23/24 | 개별 소수리                               | 각 항목 fix 방향 참조(대부분 수 줄)                                        | 낮음   |
| MINOR-6                          | sw.js stub (선재·기결)                    | 조치 불요 — 원장 유지                                                      | —      |
| MINOR-10/17                      | 문서 정정·콘텐츠 트랙 원장 등재           | 원장 P4-D7 사유 정정 + '숫자-단답 실측' 항목 추가                          | 낮음   |

## 판정

**완료 가능** — 4-Pass CRITICAL 0건. MAJOR 4건(실질 근원 2건: CDN 폰트 1 + Space 키 1)은 P5 배포 게이트 전 해소 또는 다음 단계 초기 태스크로 명시 이월 대상(auto-review-protocol "완료 선언 기준" — MAJOR 는 phase 종료 전 해결 또는 명시 이월).
