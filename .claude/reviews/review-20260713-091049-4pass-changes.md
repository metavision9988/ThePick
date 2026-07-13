# 4-Pass 독립 리뷰 보고서 — MINOR 하드닝 번들 (D-27/D-29)

- 생성: 2026-07-13 09:10:49
- 리뷰 방식: **독립 에이전트 5개(scope/Surgeon/Architect/Advocate/Contract) + 발견별 적대적 반증**
- 판정: **완료 가능** (CRITICAL 0 / MAJOR 0 / MINOR 6)

## 스코프

**변경 파일 (5)**

- `apps/api/src/public/choice-id.ts`
- `apps/api/src/public/__tests__/choice-id.test.ts`
- `apps/web/src/components/public/streak-strip.ts`
- `apps/web/src/components/public/__tests__/streak-strip.test.ts`
- `apps/web/src/components/public/StreakPanel.tsx`

**연관 파일 (4)**

- `apps/api/src/public/routes.ts`
- `apps/web/src/lib/local-progress/db.ts`
- `apps/web/src/lib/local-progress/index.ts`
- `apps/web/src/components/public/PublicPracticeApp.tsx`

**요약**: MINOR 하드닝 번들(D-27/D-29). `choice-id.ts` 는 HMAC importKey 를 매 `issueChoiceId` 호출마다 재수행하던 것을 keyMaterial 별 CryptoKey Map 캐싱(rejection evict, per-isolate)으로 전환 — 공개 채점 hot-path(`resolveChoiceId` 가 보기 수만큼 `issueChoiceId` 반복) CPU 절감, 왕복·결정성·폴백 출력 불변. `StreakPanel.tsx` 는 `loadStreakView` 의 studiedDates map + todayCount filter 이중 순회를 순수 함수 `buildStreakStrip`(`streak-strip.ts` 신규)으로 추출·단일 순회화하고 테스트 커버리지 0→4 추가. 실배포는 미수행이며 D-32(reviews GC) 는 자율 제외.

---

── 4-PASS REVIEW ──────────────────
리뷰 방식: 독립 에이전트 5개(scope/Surgeon/Architect/Advocate/Contract) + 발견별 적대적 반증
리뷰 범위: 변경 파일 5개 + 연관 파일 4개 (상기 목록)

## Pass 1 (Surgeon): ✅ 12건 확인 / 🔴 0건 / 🟠 2건(MINOR) / N/A 3건

**관점: "이 코드 단독으로 터지는 경로가 있는가?"**

확인:

- **PASS** Null/Undefined: `routes.ts:397·525` `.first<GradeRow>()` 반환 null 은 line 403·531 `if (row === null)` 로 즉시 404 처리 후 반환 — null deref 경로 없음. row.answer null 은 407·534 에서 422 가드.
- **PASS** Null/Undefined: `choice-id.ts:96` resolveChoiceId 길이 불일치 즉시 null 반환, 100-101 매칭 실패 null 반환 — 호출측 `routes.ts:443` `submittedIndex !== null && ...has(...)` 로 null 안전 소비.
- **PASS** Async/await: `choice-id.ts:72` `await getHmacKey`, 73 `await crypto.subtle.sign`, 98 `await issueChoiceId` — 반환 Promise 전부 await. `routes.ts:197·339·437·447·559` issueChoiceId/resolveChoiceId/buildPublicChoices 전부 await 됨(부동 Promise 없음).
- **PASS** Async: `StreakPanel.tsx:60-68` loadStreakView().then().catch() 로 Promise 소비 + cancelled 가드(59·69-71)로 unmount 후 setState 차단.
- **PASS** 경계값: `streak-strip.ts:31-35` 빈 reviewedAts → studiedDates 공집합 → days 전 false·todayCount 0 (test:31-36 검증). stripDays 루프 38-40 은 stripDays=30 상수로 항상 유효 길이 생성.
- **PASS** 경계값: buildStreakStrip 같은 날 중복 reviewedAt → Set 집약으로 스트립 1칸·todayCount 누적(test:44-49). 음수/NaN 산식 없음(날짜 버킷팅만).
- **PASS** 에러처리: 빈 catch 0건 — `choice-id.ts:52-55` catch 는 cache evict + rethrow(무음 삼킴 아님). `StreakPanel.tsx:64-68` catch 는 console.warn + setFailed(전파적 degrade). `routes.ts:249·323·398·526` catch 는 logger.error + 500 반환.
- **PASS** Graceful Degradation: `routes.ts` isServable(164-175)·parseMcChoices.ok 미통과 문항은 서빙/채점 거부(422/404) + AE 'defect' 이벤트 — 정답 100% fail-safe 유지. choice-id 스코프 무관(N/A 유사도 0.60).
- **N/A** 산식 정밀도(부동소수점·numeric_value vs value): 본 스코프(choice-id HMAC·streak 날짜 버킷팅)에 수치 연산 없음 — Formula Engine 미경유. streak todayCount 는 정수 증분(`streak-strip.ts:34`).
- **N/A** Formula Engine 동적 코드 실행: 스코프에 math.js·eval·Function 생성 0. choice-id 는 crypto.subtle.sign(HMAC AST 무관), streak 는 Date 산술만.
- **PASS** stub/TODO/placeholder 0건: choice-id.ts·streak-strip.ts·StreakPanel.tsx·routes.ts 전수 확인 — 빈 함수·TODO·HACK 주석 없음(모든 함수 body 실로직).
- **PASS** 캐시 정합성: `choice-id.ts:43-59` hmacKeyCache 는 keyMaterial 키(secret|fallback 2종 상한)로 Promise<CryptoKey> dedup, rejection 시 delete(53) 로 poison 방지·재시도 보장. HMAC 출력 결정성 불변(test:11-19·44-55 cross-secret 격리 검증).
- **PASS** 왕복 결정성: issueChoiceId(qId,idx)→resolveChoiceId 왕복(test:21-26) + 폴백키 왕복(test:38-42) — 캐싱 전환 후에도 출력 동일(bytesToHex 61-68 슬라이스 24hex 불변).
- **PASS** streak 순서 정합: buildStreakStrip days[last]=오늘(`streak-strip.ts:38` i=0 마지막 push) ↔ `StreakPanel.tsx:110` isToday=마지막 인덱스 — 인덱스 계약 일치(test:25-26).
- **PASS** 조회창≥스트립창: `StreakPanel.tsx:32` cutoff=now-(30+1)일 ⊇ streak-strip 스트립창 now-29..now — 최고 칸 KST 경계 누락 없음(주석 30-31 근거 확인).

반론(Devil's Advocate): `buildStreakStrip` 는 순수 함수에 try/catch·Number.isFinite 가드가 없어, `reviewedAt` 에 손상된 ISO(Invalid Date)가 1건이라도 들어오면 `todayDateString(new Date(iso))` 경로에서 `new Date(NaN).toISOString()` RangeError 로 **스트립 전체 계산이 throw** 된다. 실사용 write 경로(recordReview)는 항상 유효 ISO 를 쓰므로 도달 불가에 가깝고, 도달해도 StreakPanel.tsx:64-68 .catch 가 패널만 접어 앱 크래시는 아니나 — import 경유(importLocalProgress) 오염 시 스트릭 패널이 영구 은닉될 수 있다. → **MINOR-1/MINOR-5 로 적출**.

## Pass 2 (Architect): ✅ 9건 확인 / 🔴 0건 / 🟠 1건(MINOR) / N/A 3건 / PRE-EXISTING 1건

**관점: "이 코드가 다른 모듈과 만나면 터지는가?"**

확인:

- **PASS** Import 방향(단방향): `streak-strip.ts:8` 이 @thepick/learning-modes(todayDateString, `packages/learning-modes/src/session-progress.ts:39` export)를 import — apps/web → packages 하류 방향, 역참조 0. choice-id.ts 는 crypto/TextEncoder 외 패키지 import 0.
- **PASS** Workers 제약(fs/path 금지·Web Crypto): `choice-id.ts:34,48,73` 은 TextEncoder·crypto.subtle.importKey·crypto.subtle.sign 만 사용(Workers 호환), fs/path 미사용. 모듈 레벨 hmacKeyCache(:43)·encoder(:34)는 per-isolate 전역 — 요청 무관 파생키 캐시라 Workers 전역 상태 안티패턴에 해당 안 함(가변 요청 상태 아님).
- **PASS** 크로스-모듈 결정성 불변(핵심): issueChoiceId 출력은 (keyMaterial, message)에만 의존(`choice-id.ts:70-74`) — 캐시는 importKey 를 keyMaterial 당 1회로 줄이는 순수 CPU 최적화일 뿐 출력값 불변. serve(`routes.ts:197`)→grade(`routes.ts:437` resolveChoiceId, :447 재발급)→reveal(:559) 의 무상태 왕복이 isolate 간에도 동일 HMAC 산출 = 스킴의 stateless 계약 보존. `choice-id.test.ts:44-55`(D-27) 가 secret 별 캐시 격리·warm 후 결정성 검증.
- **PASS** 캐시 rejection evict 정합: getHmacKey(:45-59) 는 miss 시 importKey().catch(delete+rethrow) 프라미스를 저장 — 실패 시 캐시 자가 정리(고착 0), 다음 호출 재시도. get→set 사이 await 없음(단일 스레드 isolate 내 원자적)이라 동시 요청 경합 0. 빈 catch·무음 삼킴 없음(rethrow).
- **PASS** 캐시 무한성장 없음: keyMaterial 종류 = 운영 secret 1(JWT_SECRET) + dev 폴백 1(CHOICE_ID_FALLBACK_KEY, :32) 극소 → Map ≤2 엔트리(`choice-id.ts:37-42` 주석과 실코드 일치). 폴백 해소는 hmacHex:71 secret.length>0 분기로 확정.
- **PASS** buildStreakStrip 소비자 계약: 유일 소비자 `StreakPanel.tsx:34` 이 {days, todayCount} 구조분해 — `streak-strip.ts:12-17` StreakStrip 인터페이스와 일치. now 는 loadStreakView 에서 1회 생성(`StreakPanel.tsx:28`)해 buildStreakStrip 과 cutoff 계산에 동일 인스턴스 전달 = 시각 일관성.
- **PASS** KST 일경계/무DST 안전성: `buildStreakStrip:38-39` 는 now-i\*DAY_MS 를 todayDateString(KST)로 변환 — 한국 무DST라 24h 고정 스텝이 연속 KST 날짜에 1:1 대응(스킵·중복 0). 31일 조회(`StreakPanel:32`) vs 30일 버킷은 초과분이 루프 미도달로 무해, `streak-strip.test:38-42` 가 스트립 밖 이력 → 전 칸 false 확증.
- **PASS** todayCount 크로스-모듈 일관성: 신 코드는 store.countReviewsOnKstDate(`store.ts:149`) 대신 fetched reviews 에서 todayDateString 동치로 직접 집계(`streak-strip.ts:33-34`) — 오늘은 항상 31일 윈도우 ⊂ 이므로 누락 0, 양쪽 모두 KST todayDateString 기준이라 값 일치. `streak-strip.test:44-49` 가 중복 reviewedAt → 스트립 1칸·todayCount 누적 검증.
- **N/A** D1 스키마 일치/Drizzle: 이 변경셋은 D1 쿼리·스키마 무접촉(`routes.ts` 의 exam_questions 쿼리는 기존, 이번 diff 아님). `local-progress/db.ts:101-108` Dexie 스토어도 미변경.
- **N/A** Ontology Lock / truth_weight 정렬 / Temporal Graph(INSERT+SUPERSEDES): 노드/엣지 ID 생성·RAG 주입·knowledge_nodes UPDATE 경로가 변경셋에 없음(choiceId·streak strip 은 지식그래프 무관).
- **N/A** IndexedDB↔D1 동기화: local-progress 는 서버 동기화 없는 클라 단독 쓰기 스토어(`db.ts:5-7` 명시, G-1). StreakPanel 은 reviews read-only(:33) 만 — 동기화 큐 경로 무접촉.
- **PASS** Hexagonal/에러 처리 UX: `StreakPanel.tsx:64-68` IDB 실패 시 console.warn + setFailed → 패널만 접고 학습 흐름 유지(무음 삼킴 아님, Graceful). streak-strip.ts 는 순수 함수라 부작용·throw 유발 I/O 0.
- **PRE-EXISTING(비-회귀)** i18n: `StreakPanel.tsx:83,87-88,101,107` 한국어 하드코딩('연속 학습','오늘','목표','일 연속 · 최장','최근 N일 학습 기록') — 공개 홍보 표면 전체가 한국어 단일 서비스 정책(pre-existing)이며 이번 diff(buildStreakStrip 추출)로 신규 도입된 문자열 0. 이번 변경의 회귀 아님.

반론(Devil's Advocate): DAY_MS 상수가 `streak-strip.ts:10` 과 `StreakPanel.tsx:14` 에 이중 선언돼 있고, 두 값이 '31일 조회 ↔ 30일 버킷'이라는 암묵 계약을 형성한다. 한쪽만 변경되면(예: 조회 여유 로직 리팩터) 조회창 < 스트립창 이 되어 최고(最古) 칸이 무음 누락되며, streak-strip.test 는 reviewedAts 직접 주입이라 StreakPanel 의 DB 조회 경로 드리프트를 못 잡는다. → **MINOR-2/MINOR-3/MINOR-6 로 적출**.

## Pass 3 (Advocate): ✅ 13건 확인 / 🔴 0건 / 🟠 2건(MINOR) / N/A 2건

**관점: "수험생과 공격자, 둘 다 만족하는가?"**

확인:

- **PASS** 보안(입력검증): `choice-id.ts:71` keyMaterial 은 secret(env JWT_SECRET, `routes.ts:338/436/556`) 파생만 = 사용자 무제어 → hmacKeyCache Map 은 ≤2 엔트리로 유계, 사용자 주입 unbounded 성장/DoS 경로 0.
- **PASS** 보안(캐시 무결성): `choice-id.ts:52-55` importKey rejection 시 .catch 가 delete 후 rethrow, 캐시된 rejecting promise 에 체이닝돼 poisoned 키 고착 없고 호출측이 rejection 정상 수신.
- **PASS** 정답 안전: `choice-id.ts:16-18` choiceId 는 위치 식별자로 정답여부 무관, 정답 판정은 `routes.ts:443` correctOriginalIndices.has(submittedIndex) 서버 단독 수행 = 캐시 변경이 채점 정확도 불변.
- **PASS** 결정성: `choice-id.ts:45-59` 캐시 키=keyMaterial, `choice-id.test.ts:44-55` D-27 격리 테스트가 secret별 상이 choiceId + warm 후 결정성 재확인.
- **PASS** 보안(XSS/innerHTML): 변경 3파일 전수 innerHTML/dangerouslySetInnerHTML 0, `StreakPanel.tsx:109-121` dot 렌더는 style 객체 바인딩만(문자열 주입 없음).
- **PASS** 무음실패 금지: `StreakPanel.tsx:66` console.warn 로 IDB 실패 로깅 후 패널만 접음(빈 catch 0), `PublicPracticeApp.tsx:120` persistReview 실패도 warn.
- **PASS** 상태 표현: `StreakPanel.tsx:74` failed→null, 93-94 로딩 skeleton(aria-hidden), 85-90 view 존재 시만 오늘/목표 표기 = 로딩/실패/데이터 3상태 처리.
- **PASS** 접근성(터치타겟): dot 은 비인터랙티브 장식(`StreakPanel.tsx:112` span), 인터랙티브 '모드 선택' 버튼은 `PublicPracticeApp.tsx:201` minHeight:44 확보.
- **PASS** 타임존 정확성: `streak-strip.ts:38-39` KST(무 DST) 기준 now-i\*DAY_MS 가 연속 KST 날짜로 매핑, `StreakPanel.tsx:32` STRIP_DAYS+1 쿠션이 최고칸 경계 커버, `streak-strip.test.ts:14-49` 6 엣지 커버.
- **PASS** stub/TODO/placeholder: 변경 3파일 + routes.ts 전수 TODO/HACK/빈 catch/placeholder 0 (routes.ts catch 전부 logger.error+응답 반환).
- **N/A** 에러 UX(교재 O장 안내): 본 D-27/D-29 hardening 은 채점/서빙 카피 미변경, ErrorPanel/StatusPanels(`PublicPracticeApp.tsx:21,235`) 는 스코프 밖 기존물.
- **N/A** 오프라인 Service Worker: 변경분에 SW 캐싱 전략 접점 0(streak/choice-id 는 IDB·HMAC 순수 로직).
- **PASS** 오프라인 데이터 경로: `db.ts:5-7` local-progress 는 IndexedDB 영속 전용(서버 동기화 0, G-1), 인메모리 임시저장 금지 준수.
- **관측(MINOR 승격)**: 30일 학습 스트립 aria-label 이 `최근 30일 학습 기록` 고정 문자열이라 정량 정보 미전달(스크린리더 데이터 공백) + buildStreakStrip 이 손상된 reviewedAt ISO 무검증(import 경유 오염 시 버킷 오류) → **MINOR-4/MINOR-5 로 적출**.

반론(Devil's Advocate): reviewedAt 은 정상 경로에서 항상 `new Date().toISOString()` 로 기록되지만, export/import 봉투가 validateExport 에서 reviewedAt 의 ISO 형식까지 검증하지 않으면 손상 문자열이 reviews 에 적재될 수 있고, 그러면 다음 StreakPanel 렌더에서 스트릭 패널이 영구 은닉된다(사용자에겐 '스트릭이 사라진' UX). '도달 불가'는 로컬 쓰기 경로 한정 전제이며 import 경로가 반례. heat-strip aria 요약도 tooltip/셀 title 조차 없어 비시각 경로가 완전 공백이므로 최소 요약 수치는 필요.

## Pass 4 (Contract): ✅ 8건 확인 / 🔴 0건 / 🟠 1건(MINOR) / N/A 2건

**관점: "구현 재정립서 v2.0 / production-quality 대로 만들었는가?"**

확인:

- **PASS** `choice-id.ts:71` hmacHex 가 secret.length>0?secret:FALLBACK 로 keyMaterial 을 먼저 해소한 뒤 getHmacKey(45) 에 전달 → 캐시 키 = 해소된 keyMaterial 이라 빈 secret/폴백이 항상 동일 키로 수렴, 결정성·왕복 불변 (test 38-42·44-55 왕복·격리 검증).
- **PASS** `choice-id.ts:52-56` importKey rejection 시 .catch 가 map 에서 delete 후 rethrow, .set(56) 은 동기 실행이라 microtask .catch 보다 선행 → 거부 프로미스 고착 없음, 다음 호출 재시도. 빈 catch 아님(에러 전파).
- **PASS** `choice-id.ts:43` hmacKeyCache 는 파생 CryptoKey 메모이제이션(재계산 가능·keyMaterial 종류 극소 2종)으로 무한성장/상태데이터 저장 아님 → G-1(서버 상태 0)·'인메모리 임시저장 금지'(데이터 대상) 규칙과 상충 없음, 주석 37-42 근거 명시.
- **PASS** `streak-strip.ts:31-35` 단일 순회로 studiedDates 버킷 + todayCount 동시 집계, 38-41 days 열거 → `StreakPanel:110` isToday=index(stripDays-1) 정합, 기존 이중순회 대비 산출 동치 (test 14-49 오늘/어제/5일전/빈이력/범위밖/동일날중복 6분기).
- **PASS** `StreakPanel.tsx:64-68` 및 `PublicPracticeApp.tsx:119-121·49-51` 의 catch 는 전부 console.warn 로깅 + 흐름 폴백(패널 접기/warn), 빈 catch 0 (production-quality 빈catch 금지 준수).
- **PASS** 수치 상수 CHOICE_ID_HEX_LENGTH=24(`choice-id:26`)·STRIP_DAYS=30(`StreakPanel:13`)·DEFAULT_DAILY_GOAL=20(`db:78`)·CHOICE_ID_FALLBACK_KEY(`choice-id:32`) 전부 명명 상수, 하드코딩 리터럴 산포 없음 (production-quality 하드코딩 금지 준수).
- **N/A** knowledge_nodes/formulas/constants/ontology-registry UPDATE·노드ID 생성(CONCEPT/F/INS) 없음: 스코프 4파일 전수 grep 결과 해당 테이블·ID 컨벤션 접촉 0 (Hard Limit 무관).
- **N/A** Formula Engine·동적코드실행·LLM 수식계산·BATCH 적재 순서: choice-id/streak-strip/routes 어디에도 math.js·eval·batch 경로 없음 (choice-id 는 HMAC-SHA256 crypto.subtle 만, routes 는 parseMcChoices/gradeFillBlank 재사용).
- **PASS** `routes.ts:44` choice-id import·197/447/559 issueChoiceId·437 resolveChoiceId 호출부는 캐싱 도입으로 시그니처·반환 계약 불변, 채점 경계(exam_type='1st'·status='active' 양쪽 WHERE 393/521) 무변경 → 이번 하드닝이 서빙/채점 정답100% 계약을 건드리지 않음 확인.
- **PASS** Silent Pivot 없음: 스코프 설명('왕복·결정성·폴백 불변'·'이중→단일 순회'·'실배포 미수행'·'D-32 자율제외')과 실코드 일치, 계획 외 기능추가·경계완화·미신고 동작변경 0.

반론(Devil's Advocate): DAY_MS 상수가 streak-strip.ts 와 StreakPanel.tsx 에 이중 선언(=86400000)이라 순수 추출의 '단일 정본화' 의도와 상충. 두 값이 상수 리터럴로 고정돼 현 시점 런타임 드리프트 경로는 없으나, 향후 한 파일의 DAY_MS 만 조정되면 cutoff 창(31일)과 strip 창(30일)의 여유 1일 완충이 무음으로 깨질 여지가 이론상 존재. → **MINOR-6 로 적출**.

판정: **완료 가능** (4-Pass 전 Pass CRITICAL 0건)
────────────────────────────────────

---

## 확정 발견 (적대적 반증 통과분만) — CRITICAL 0 / MAJOR 0 / MINOR 6

### MINOR-1 — buildStreakStrip: 손상된 reviewedAt(Invalid Date) 1건이 스트립 전체를 throw → 패널 전면 은닉(레코드 스킵 아님)

- **파일**: `apps/web/src/components/public/streak-strip.ts:31-35` (Pass: Surgeon)
- **상세**: `buildStreakStrip` 는 reviewedAts 각 원소에 `new Date(iso)` → `todayDateString(date)` 를 적용한다. `todayDateString`(`session-progress.ts:43`)은 `new Date(now.getTime()+offset).toISOString()` 를 호출하는데, iso 가 파싱 불가면 date 가 Invalid Date(getTime()=NaN)가 되고 `new Date(NaN).toISOString()` 은 RangeError 를 던진다. 순수 함수에 try/catch·Number.isFinite 가드가 없어, 손상 레코드 1건이 30일 스트립 계산 전체를 중단시킨다. 실사용 경로에서는 recordReview 가 항상 `new Date().toISOString()` 로 유효 ISO 만 기록하므로 도달 불가에 가깝고, 도달하더라도 `StreakPanel.tsx:64-68` 의 .catch 가 setFailed(true)로 패널만 접고 학습 흐름은 유지(graceful degradation)한다 = 앱 크래시 아님. 다만 '한 칸 스킵'이 아니라 '스트릭 패널 통째 소실'로 degrade 되는 점, 그리고 신규 테스트(streak-strip.test.ts)에 invalid-iso 케이스가 없는 점이 관측 사항. 하드닝 번들의 취지(커버리지 0→4)에 비추어 방어 케이스 1건 추가 권고 수준.
- **확인**:
  - `streak-strip.ts:32` `const date = todayDateString(new Date(iso));` — iso 무검증 직접 파싱
  - `packages/learning-modes/src/session-progress.ts:43-44` `new Date(now.getTime()+offsetHours*HOUR_IN_MS).toISOString()` — NaN 입력 시 toISOString RangeError
  - `StreakPanel.tsx:33` `recent.map((r) => r.reviewedAt)` 로 IDB reviews.reviewedAt 원문을 그대로 전달(정규화 없음)
  - `StreakPanel.tsx:64-68` .catch → console.warn + setFailed(true) → line 74 `if (failed) return null` (패널 전면 은닉으로 degrade)
  - `apps/web/src/components/public/__tests__/streak-strip.test.ts:13-49` — invalid-iso/손상 reviewedAt 케이스 부재(빈 배열·중복·범위밖만 커버)
- **반론(Devil's Advocate)**: recordReview 는 항상 유효 ISO 를 쓰지만, export/import(`index.ts:31-37` importLocalProgress) 로 타 기기·수기 편집된 봉투가 유입되면 validateExport 가 reviewedAt 의 ISO 형식까지 검증하지 않을 경우 손상 문자열이 reviews 에 적재될 수 있고, 그러면 다음 StreakPanel 렌더에서 스트릭 패널이 영구 은닉된다(사용자에겐 '스트릭이 사라진' UX). 즉 '도달 불가'는 로컬 쓰기 경로 한정 전제이며 import 경로가 반례가 될 수 있다.
- **제안 수정**: buildStreakStrip 루프에서 `const d = new Date(iso); if (Number.isNaN(d.getTime())) continue;` 로 손상 레코드만 스킵(패널은 유지) + 테스트에 invalid-iso 1건 추가. 또는 import 경계(validateExport)에서 reviewedAt ISO 형식 검증으로 원천 차단.

### MINOR-2 — DAY_MS 상수 이중 선언 — streak-strip.ts:10 과 StreakPanel.tsx:14 중복

- **파일**: `apps/web/src/components/public/StreakPanel.tsx:14` (Pass: Surgeon)
- **상세**: D-29 추출로 순회 로직이 streak-strip.ts 로 이동하며 DAY_MS(24*60*60\*1000)가 `streak-strip.ts:10` 에 신설됐으나, `StreakPanel.tsx:14` 의 기존 DAY_MS 도 cutoffIso 계산(line 32)에 여전히 사용되어 동일 상수가 두 파일에 병존한다. 값이 동일해 현재 버그는 아니나, 한쪽만 바뀌면(예: 조회 여유 로직 변경) 스트립 창(streak-strip)과 조회 창(StreakPanel)이 어긋날 소지. production-quality.md '하드코딩 0건/명명 상수' 취지상 단일 export 상수 공유가 바람직.
- **확인**:
  - `streak-strip.ts:10` `const DAY_MS = 24 * 60 * 60 * 1000;`
  - `StreakPanel.tsx:14` `const DAY_MS = 24 * 60 * 60 * 1000;` (동일 리터럴)
  - `StreakPanel.tsx:32` `now.getTime() - (STRIP_DAYS + 1) * DAY_MS` — 조회 컷오프에서 소비
  - `streak-strip.ts:39` `now.getTime() - i * DAY_MS` — 스트립 칸 계산에서 소비(두 곳이 같은 날 단위 가정 공유)
- **반론(Devil's Advocate)**: 두 DAY_MS 는 값이 같아 현재 어떤 입력에서도 불일치를 낳지 않으므로 '버그'로 승격 불가. 그러나 향후 StreakPanel 의 조회 여유(+1일)나 streak-strip 의 칸 계산 중 한쪽만 리팩터되면 조회창<스트립창 이 되어 오래된 칸이 무음 누락되는 회귀가 가능 — 지금 결함이 아니라 미래 회귀 표면이라는 점에서 MINOR 관측에 그친다.
- **제안 수정**: DAY_MS 를 streak-strip.ts 에서 export 하여 StreakPanel 이 재사용하거나 공용 상수 모듈로 추출. 기능 영향 없음(순수 정리).

### MINOR-3 — DAY_MS 상수가 StreakPanel.tsx 와 streak-strip.ts 에 이중 선언 — 드리프트 위험 (조회창↔버킷 계약)

- **파일**: `apps/web/src/components/public/streak-strip.ts:10`, `StreakPanel.tsx:14` (Pass: Architect)
- **상세**: D-29 추출로 buildStreakStrip 이 자체 DAY_MS(=86400000, `streak-strip.ts:10`)를 갖게 됐으나, 호출 측 `StreakPanel.tsx:14` 도 동일 DAY_MS 를 별도 선언해 cutoffIso 계산(line 32)에 쓴다. 두 상수는 '스트립 조회 윈도우(31일)'와 '스트립 버킷 스텝(30일)'이라는 짝을 이루는 값이라 한쪽만 바뀌면 조회 윈도우와 버킷 경계가 어긋난다(예: streak-strip 만 DAY_MS 를 밀리초→초로 오변경 시 컴파일 통과·런타임 무음 오집계). 순수 함수 독립성 측면에서 각자 선언이 방어적이라는 반론도 성립하므로 저위험이나, 단일 명명 상수(예: @thepick/learning-modes 또는 constants.ts 공유) 경유가 안전.
- **확인**:
  - `streak-strip.ts:10` `const DAY_MS = 24 * 60 * 60 * 1000;` — 버킷 루프(line 39 `now.getTime() - i * DAY_MS`)에서 소비
  - `StreakPanel.tsx:14` `const DAY_MS = 24 * 60 * 60 * 1000;` — cutoffIso 조회(line 32 `(STRIP_DAYS + 1) * DAY_MS`)에서 소비, 두 값이 짝(31일 조회 vs 30일 버킷)
  - `StreakPanel.tsx:32-38` — cutoff 는 STRIP_DAYS+1 여유로 31일 조회, buildStreakStrip 은 STRIP_DAYS=30 만 버킷팅. 한 DAY_MS 만 변경되면 이 여유 계약이 무음으로 깨짐
- **반론(Devil's Advocate)**: 각 파일이 자기 DAY_MS 를 갖는 것은 streak-strip.ts 를 완전 독립 순수 모듈로 유지하는 의도적 선택일 수 있고, 두 값이 동시에 같은 커밋에서 관리될 가능성이 높아 실제 드리프트 확률은 낮다. 그러나 두 값이 '31일 조회 ↔ 30일 버킷'이라는 암묵 계약을 형성하므로 리뷰어가 한쪽만 고치면 테스트(streak-strip.test 는 reviewedAts 를 직접 주입, StreakPanel 의 DB 조회 경로는 미검증)로 못 잡는다.
- **제안 수정**: DAY_MS 를 단일 명명 상수(streak-strip.ts 에서 export 하거나 local-progress constants 로 승격)로 두고 StreakPanel 이 그것을 import — 조회 윈도우/버킷 스텝이 같은 정의를 공유하도록.

### MINOR-4 — 30일 학습 스트립 aria-label 이 정량 정보 미전달 (스크린리더 데이터 공백)

- **파일**: `apps/web/src/components/public/StreakPanel.tsx:103-122` (Pass: Advocate)
- **상세**: `role="img"` 컨테이너의 aria-label 이 `최근 30일 학습 기록` 고정 문자열이라(107행) 시각장애 사용자는 실제로 며칠 학습했는지·오늘 포함 여부를 알 수 없다. 개별 dot 은 순수 장식 span(112-119행, aria 없음)이라 스크린리더가 데이터를 못 읽는다. 본 D-29 리팩터로 StreakPanel 이 수정된 파일이므로 동시 개선 여지. 예: `최근 30일 중 N일 학습, 오늘 학습 ${todayCount>0?'완료':'미완료'}` 처럼 buildStreakStrip 결과(days.filter(Boolean).length·todayCount)를 aria-label 에 주입. 모바일 80%·접근성 체크리스트 대상. 기능·정답 안전 무관, 순수 인지 접근성.
- **확인**:
  - `StreakPanel.tsx:107` aria-label=`최근 ${STRIP_DAYS}일 학습 기록` — 정량치(학습일수·오늘여부) 미포함
  - `StreakPanel.tsx:112-119` 개별 dot span 은 aria 속성 0 = 스크린리더 미노출(role=img 컨테이너로 묶여 자식 무시)
  - `streak-strip.ts:37-41` buildStreakStrip 이 days:boolean[] + todayCount 를 이미 반환 = aria 정량화에 필요한 데이터 가용(추가 계산 0)
- **반론(Devil's Advocate)**: heat-strip 은 관례적으로 요약 aria-label 로 충분하다는 반론 가능(GitHub contribution grid 등도 셀별 상세는 tooltip 전용). 다만 여기선 tooltip/셀 title 조차 없어 비시각 경로가 완전 공백이므로 최소 요약 수치는 필요.
- **제안 수정**: aria-label 을 `최근 ${STRIP_DAYS}일 중 ${view.days.filter(Boolean).length}일 학습, 오늘 ${view.todayCount}회` 형태로 view 값 주입.

### MINOR-5 — buildStreakStrip 이 손상된 reviewedAt ISO 를 무검증 처리 (import 경유 오염 시 버킷 오류)

- **파일**: `apps/web/src/components/public/streak-strip.ts:31-35` (Pass: Advocate)
- **상세**: reviewedAts 각 원소를 `new Date(iso)` 후 todayDateString 으로 버킷팅하는데(32-33행) iso 가 손상(Invalid Date)이면 todayDateString 산출이 미정의 버킷으로 흐르거나 studiedDates 에 예상 밖 키가 들어간다. reviews 는 local-progress import 경로(`index.ts:35` importLocalProgress)로 사용자가 주입 가능한 데이터라 신뢰 경계 밖 값이 들어올 수 있다. 정오/정답에는 영향 없고 스트립 시각화만 왜곡되며 리팩터 이전 인라인 코드도 동일 거동이라 회귀는 아님. Advocate 입력검증 렌즈에서 방어적 가드(Number.isNaN(new Date(iso).getTime()) 시 skip) 권고.
- **확인**:
  - `streak-strip.ts:32` `const date = todayDateString(new Date(iso));` — iso 유효성 사전 검사 없음
  - `local-progress/index.ts:35` importLocalProgress 노출 = reviewedAt 이 export 파일 경유 외부 주입 가능 경로 존재
  - `streak-strip.test.ts:9-49` 테스트가 전부 유효 ISO 픽스처만 사용 = Invalid Date 엣지 미커버(테스트 통과≠안전)
- **반론(Devil's Advocate)**: reviewedAt 은 앱이 채점 시 `new Date().toISOString()` 로만 기록(정상 경로)하고 validateExport(export.ts, 범위 밖)가 import 시 형식을 이미 검증할 수 있어 실 오염 확률은 낮다 — 이 경우 순수 방어적 가드로 격하. 다만 검증 위임 지점이 streak-strip 밖이라 이 함수 단독으로는 무방비.
- **제안 수정**: 루프 내에서 `const d = new Date(iso); if (Number.isNaN(d.getTime())) continue;` 가드 추가, 또는 validateExport 가 reviewedAt ISO 형식을 보증함을 주석으로 명시.

### MINOR-6 — DAY_MS 상수가 streak-strip.ts 와 StreakPanel.tsx 에 이중 선언 (DRY 경미)

- **파일**: `apps/web/src/components/public/StreakPanel.tsx:14` (Pass: Contract)
- **상세**: streak-strip 추출(D-29) 후 DAY_MS(=24*60*60*1000)가 `streak-strip.ts:10` 과 `StreakPanel.tsx:14` 두 곳에 동일 리터럴로 병존한다. `StreakPanel:32` 는 cutoff 조회(STRIP_DAYS+1)*DAY_MS 에, `streak-strip:39` 는 strip 열거에 각각 자기 복제본을 쓴다. 현재 값은 동일해 동작 영향은 0이나, 한쪽만 바뀌면(예: 테스트용 시간 스케일) cutoff 조회 창과 strip 열거 창이 어긋나 최고(最古) 칸이 조용히 누락될 수 있다. 순수 추출의 의도가 '단일 정본화'였다면 상수도 streak-strip.ts 에서 export 해 단일화하는 것이 정합.
- **확인**:
  - `apps/web/src/components/public/streak-strip.ts:10` — const DAY_MS = 24*60*60\*1000 (strip 열거 base)
  - `apps/web/src/components/public/StreakPanel.tsx:14` — const DAY_MS = 24*60*60\*1000 (cutoff 조회 base, 동일 리터럴 재선언)
  - `apps/web/src/components/public/StreakPanel.tsx:32` — cutoffIso 계산에 로컬 DAY_MS 사용, streak-strip:39 는 별도 DAY_MS 사용 — 두 창의 정합이 두 상수 동기화에 암묵 의존
- **반론(Devil's Advocate)**: 두 값이 상수 리터럴로 고정돼 있어 런타임 드리프트 경로가 없고, DST 없는 KST 에서 24h 고정 감산은 항상 안전하므로 현 시점 실장애 시나리오는 없다 — 그래서 CRITICAL/MAJOR 가 아닌 순수 유지보수성 MINOR. 다만 향후 누가 한 파일의 DAY_MS 만 조정하면 cutoff 창(31일)과 strip 창(30일)의 여유 1일 완충이 깨질 여지가 이론상 존재.
- **제안 수정**: streak-strip.ts 에서 export const DAY_MS 하고 StreakPanel.tsx 는 import 로 소비해 단일 정본화 (또는 cutoff 계산도 buildStreakStrip 이 파라미터로 흡수). 동작 변경 0의 순수 정리이므로 다음 하드닝 배치에 묶어도 무방.

---

## 종합 판정

- CRITICAL 0 / MAJOR 0 / MINOR 6
- 6건 전부 MINOR(방어적 가드 권고 2 + DAY_MS 이중선언 정리 3 + aria-label 정량화 1)로, 왕복·결정성·정답 안전·채점 계약을 건드리지 않는 순수 하드닝/유지보수성 관측이다. Silent Pivot·stub·빈 catch·하드코딩 위반 0.
- **판정: 완료 가능** (CRITICAL 0). MINOR 6 은 차기 하드닝 배치로 이월 가능.
