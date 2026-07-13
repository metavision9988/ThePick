# 4-Pass 리뷰 — D-20(RC-6) Analytics Engine 조회 소비자 확장

- 타임스탬프: `20260713-154806`
- 리뷰 방식: **독립 에이전트 5개(scope / Surgeon / Architect / Advocate / Contract) + 발견별 적대적 반증**
- 판정: **완료 가능** (CRITICAL 0)

## 스코프

D-20(RC-6): Cloudflare Analytics Engine 를 writer-only 상태에서 조회 소비자로 확장. 신규 순수 로직 모듈(`scripts/lib/public-analytics-reader.mjs`: DATASETS/INTEGRITY_REASONS 상수 + buildQueries/parseAeResult/summarizeAccuracy/classifyDefects/formatReport, 부수효과 0)과 실행 오케스트레이터(`scripts/read-public-analytics.mjs`: 토큰 env·계정 자동탐색·AE SQL API fetch·`--json`/`--alert` fail-closed exit)를 추가하고, node --test 6종(`scripts/__tests__/`)을 루트 `test:scripts` 글롭에 배선. 읽기 전용이며 production 쓰기 0.

| 구분 | 파일                                                                                                                                                                               |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 변경 | `scripts/lib/public-analytics-reader.mjs`, `scripts/read-public-analytics.mjs`, `scripts/__tests__/public-analytics-reader.test.mjs`, `docs/plans/promo-1st-p4-frontend-ledger.md` |
| 연관 | `apps/api/src/public/analytics.ts`, `apps/api/wrangler.toml`, `package.json`, `.github/workflows/ops.yml`                                                                          |

**계약 의존:** blob/double/index 레이아웃 계약의 유일 원천은 writer 인 `analytics.ts`(blob1=kind..blob6=defectReason, double1=isCorrect, index1=kind — 신규 리더의 파싱 매핑이 이 계약에 의존), dataset 명 정본은 `wrangler.toml [[analytics_engine_datasets]]` 3환경, 테스트 배선은 `package.json test:scripts`, cron/토큰 소비 경로는 `ops.yml`.

---

── 4-PASS REVIEW ──────────────────
리뷰 방식: 독립 에이전트 5개(scope/Surgeon/Architect/Advocate/Contract) + 발견별 적대적 반증
리뷰 범위: 변경 파일 4개 + 연관 파일 4개 (상단 스코프 표)

## Pass 1 (Surgeon): ✅ 9건 확인 / 🔴 0건 / 🟠 1건 / N/A 2건

**관점: "이 코드 단독으로 터지는 경로가 있는가?"**

확인:

- PASS Null/Undefined — `parseAeResult` 가 null·비객체 가드(`public-analytics-reader.mjs:57-59`), `summarizeAccuracy` 가 subject null 가드(line 84), `classifyDefects` 가 reason null 가드(line 103). 크래시 경로 없음. (`analytics.ts` 에는 D1 `.first()` 호출 없음 = N/A)
- PASS Async await 누락 — `read-public-analytics.mjs` cfFetch 는 `await fetch`(line 55)+`await res.text()`(line 60), runQuery await cfFetch(line 85), main 은 await resolveAccountId(line 98)+`await Promise.all([runQuery×3])`(line 106) 전부 await 존재. 누락 0
- PASS 경계값 빈 배열 — `formatReport` 가 kinds.length===0(line 121)·accuracy.length===0(line 125) 분기 처리, `classifyDefects` 는 빈 rows 시 content/integrity=[]·totals=0 반환(line 96-112). 빈 데이터 크래시 없음
- PASS NaN/숫자 안전 — `toCount` 가 Number.isFinite 실패 시 throw(`public-analytics-reader.mjs:70-73`) = 무음 아닌 fail-loud, `summarizeAccuracy` total=0 → accuracyPct=null(line 87)로 0-나눗셈 차단. Number(undefined)=NaN 도 toCount 에서 throw
- PASS 빈 catch 금지 — `read-public-analytics.mjs:64` catch 는 throw new Error(파싱 실패 사유 포함), `:99`/`:111` catch 는 fail(err.message)로 진단 출력+exit, `:133` main().catch 도 fail 경유, `analytics.ts:69` catch 는 console.warn(무음 금지 준수). 빈 catch 0건
- PASS 주입 안전 — `buildQueries` 가 dataset 을 DATASETS 화이트리스트로만 해석(`public-analytics-reader.mjs:39-42`)하고 windowDays 는 assertPositiveInt 정수검증(line 43) 후 SQL 삽입 → 미검증 문자열 보간 없음. parseArgs 도 DATASETS[env] 검증(`read-public-analytics.mjs:40`) + days 정수검증(line 43)
- PASS blob 레이아웃 계약 정합 — writer `analytics.ts` blobs[0..5]=kind/subject/round/inputType/examType/defectReason(line 57-66) + doubles[0]=isCorrect(-1/1/0, line 67) + indexes[0]=kind(line 56) ↔ reader buildQueries blob1=kind(line 46)·blob2=subject(line 47)·double1=isCorrect(line 47)·blob6=reason(line 48). off-by-one 없음(0-index blobs[5]=defectReason = AE 1-index blob6)
- PASS dataset 명 정본 일치 — `wrangler.toml [[analytics_engine_datasets]]` dev=thepick_public_events_dev(line 117)/staging=\_staging(line 189)/production=\_production(line 262) ↔ DATASETS const 3키(`public-analytics-reader.mjs:17-19`) 문자열 완전 일치
- PASS 테스트 배선·실행 — `package.json` test:scripts 글롭 `scripts/__tests__/*.test.mjs`(line 10)가 신규 테스트 포함, node --test 실행 결과 6/6 pass·fail 0(직접 실행 확인). engines node>=22.5.0(line 35)에서 node:test/node:assert 가용
- N/A Formula Engine 동적 실행 — 본 변경셋에 math.js/eval/Function 생성 없음(순수 문자열 SQL 구성·JSON 파싱만). 해당 규칙 대상 코드 부재
- N/A 부동소수점 numeric_value vs value 혼용 — 산식 연산 아님. accuracyPct 는 Math.round((correct/total)\*1000)/10 단일 표현(`public-analytics-reader.mjs:87`)으로 표시용 반올림만, 정밀 계산 경로 아님

반론(Devil's Advocate): `--json` 경로에서 `kinds[].n` 이 AE UInt64 원시 문자열('12')로 유출됨 → accuracy/defects 는 number 인데 kinds[].n 만 string 이라, 기계 소비 시 산술('12'+1='121')로 조용한 오염 가능(🟠 MINOR-1로 보고).

## Pass 2 (Architect): ✅ 12건 확인 / 🔴 0건 / 🟠 3건 / N/A 3건

**관점: "이 코드가 다른 모듈과 만나면 터지는가?"**

확인:

- PASS 계약 정합(핵심) — 라이터 `analytics.ts:57-67` blobs [kind,subject,round,inputType,examType,defectReason]+doubles[isCorrect] ↔ 리더 `reader.mjs:46-48`(blob1=kind/blob2=subject/blob6=reason)+헤더:9-12 — blob1..6·double1·index1 전 항목 현재 정확 일치, 오라벨/오프바이원 0
- PASS dataset 명 계약 — 리더 DATASETS `reader.mjs:16-20` ↔ `wrangler.toml:117`(dev)·189(staging)·262(production) [[analytics_engine_datasets]] — 3환경 문자열 완전 일치
- PASS INTEGRITY_REASONS ↔ 발행측 — 리더 `reader.mjs:26` ['choice_id_malformed','choice_id_unresolved'] ↔ `analytics.ts:36` defectReason JSDoc + 원장 §8.7:172 routes 발행 계약 — D-17 정합성 신호 분리 버킷 매핑 일치
- PASS Import 방향 — `read-public-analytics.mjs:17-24` 가 `./lib/public-analytics-reader.mjs`(동일 scripts/ 하위) 만 import — packages/ 교차·역방향 0, 순수 로직→오케스트레이터 단방향
- PASS 테스트 배선 — `package.json:10` test:scripts 글롭 `scripts/__tests__/*.test.mjs` 가 신규 public-analytics-reader.test.mjs 포함 + `:9` test=turbo+pnpm test:scripts 로 루트 실행 커버(CI ci.yml:84 원장 §8.8:182)
- PASS 주입 안전(SQL) — `buildQueries reader.mjs:39-43` dataset=화이트리스트(미지원 env throw) + assertPositiveInt(windowDays 정수/양수 검증) — 문자열 보간 2요소 모두 검증 후, 인젝션 표면 0
- PASS 무음 실패 금지 — `cfFetch:64` JSON 파싱 실패 throw / `parseAeResult reader.mjs:57-66` success:false·data 부재 throw / `toCount:72` NaN throw / classify-summarize 데이터 조용한 삭제 0 — 빈 catch 0건
- PASS fail-closed(경보 무결성) — `read-public-analytics.mjs:92-94` 토큰 미설정 exit1 / `:125-130` 정합성>0 시 exit1 / `parseArgs:40-45` 미지원 env·비양수 days throw — 미설정/이상 입력에서 통과-무음 없음
- PASS CF AE SQL 엔드포인트/전송 — `read-public-analytics.mjs:85` /accounts/{id}/analytics_engine/sql + `:57` Content-Type text/plain + body=raw SQL — Cloudflare AE SQL API 규약 정합
- PASS 샘플링 보정 — 카운트를 count() 아닌 `sum(_sample_interval)` `reader.mjs:46-48` 로 추정 — AE 고볼륨 샘플링 하 정확 집계, 정답률 total/correct 동일 보정으로 비율 무편향
- PASS 정답률 double1 의미론 — 라이터 `analytics.ts:67` grade 는 항상 isCorrect 정의(1/0), serve/card 만 -1 / 리더 accuracyBySubject 는 blob1='grade' 필터 하 total=sum·correct=double1=1 — grade 표본에 -1 미포함이라 비율 유효
- PASS 다이어그램/기획 정합 — 원장 §8.8:178-186 이 D-20 리더 산출물(순수+오케스트레이터+테스트6+지표3종+D-17 분리 버킷+RC-6 잔여)을 정확히 기술 — Silent Pivot 0
- N/A Workers 런타임 제약(fs/path·CPU50ms·번들) — 두 산출물은 Node CLI/ops 스크립트(global fetch·process.env·console, `package.json:35` node>=22.5.0)로 Workers 배포 대상 아님 — fs/path 미사용
- N/A D1 스키마/Drizzle·Ontology Lock·truth_weight·Temporal Graph(INSERT+SUPERSEDES)·IndexedDB↔D1 — AE 읽기 전용 도구로 D1 쿼리·knowledge nodes/edges·ORM 타입·벡터 미접촉 — 해당 표면 존재 0
- N/A i18n 하드코딩 — `reader.mjs:118-135`·`read-public-analytics.mjs` 한국어 문자열은 운영자 CLI 리포트·에러 표면(사용자 노출 UI 아님)이라 i18n 키 규칙 대상 아님

반론(Devil's Advocate): writer↔reader 가 언어·패키지 경계로 분리돼 있으나 blob 인덱스 계약을 강제하는 교차 테스트가 없음 → 라이터 blobs 배열 중간 삽입 시 subject→round 로 무음 오라벨(🟠 MINOR-2). 또한 `resolveAccountId` 가 AE-Read 와 별개의 Account-list 권한에 의존해 협소 토큰 스코프+ACCOUNT_ID 미주입 조합에서 cron 경보 무음(🟠 MINOR-4). `--json` kinds[].n 문자열 유출은 Pass1과 동일 진앙(🟠 MINOR-3).

## Pass 3 (Advocate): ✅ 9건 확인 / 🔴 0건 / 🟠 3건 / N/A 3건

**관점: "수험생과 공격자, 둘 다 만족하는가?"**

확인:

- PASS 에러 UX — 오류는 운영자 stderr 로 🔴(`read-public-analytics.mjs:50`)·🟡(`read:126`) 프리픽스와 사유 포함해 노출. 이 도구는 수험생 표면이 아닌 ops CLI 이므로 '교재 O장 참고' Graceful 안내는 부적용, 기술 상세 노출이 오히려 적절
- PASS 상태 표현(빈 데이터) — `formatReport` 가 kinds 0건→'(이벤트 없음)'(lib:121), grade 0건→'(grade 이벤트 없음)'(lib:125), defect 0건→contentTotal/integrityTotal 0 라인(lib:132-135) 정상 처리. 실 production 검증도 정합성 0 케이스 통과(원장 §8.8)
- PASS 보안 API키 하드코딩 — 토큰은 process.env.CLOUDFLARE_API_TOKEN(`read:91`)에서만 취득, 로그·에러에 미노출. `wrangler.toml:23-32` dev secret 은 'do-not-use-in-production' 명시 placeholder 이며 본 변경 신규 파일이 아닌 선재 라인
- PASS 보안 SQL 인젝션 — env 는 DATASETS 화이트리스트(lib:39-42), windowDays 는 assertPositiveInt 정수검증(lib:28-32,43) + parseArgs 재검증(read:43-45)으로 이중 방어 → INTERVAL 보간 안전(주석·테스트 test:29-35 로 확인)
- PASS 입력 검증 — parseArgs 가 미지 인자 throw(read:38), --env 미지원 throw(read:40-42), --days 비양수 throw(read:43-45). --env/--days 뒤 인자 누락도 undefined→검증 실패로 안전 처리
- PASS 정답 안전(Hard Stop) — reader 는 집계 지표(정답률·결함율)만 산출하고 문항·정답을 서빙하지 않음 → OX/빈칸 정답 정확성 표면 무관. 오히려 재배학 0% 같은 오답 신호를 표면화(순기능)
- PASS fail-closed — 토큰 미설정(read:92-93)·계정 조회 실패(read:99-101)·쿼리 실패(read:111-113) 전부 fail()→exit 1 로 닫힘, 스코프 요약의 'fail-closed exit' 계약 충족
- PASS 무음 실패 없음 — parseAeResult 는 success:false/data 부재를 throw(lib:56-66), cfFetch 파싱 실패도 throw(read:62-66), analytics.ts writer 실패는 console.warn(analytics.ts:69-72). 빈 catch·stub·TODO·placeholder 0건
- PASS blob 계약 정합 — reader 매핑(lib:9-12: blob1=kind/blob2=subject/blob6=defectReason/double1=isCorrect)이 writer `analytics.ts:57-67` 실배열과 현재 정확 일치(단, 드리프트 가드 부재는 MINOR 로 보고)
- N/A 오프라인 SW 캐싱 — 대상 파일은 node CLI 스크립트로 Service Worker/브라우저 캐시 경로 없음(`scripts/read-public-analytics.mjs` shebang node)
- N/A 접근성(터치44px·키보드·aria) — CLI/config 변경만, 렌더 UI 없음
- N/A 보안 XSS/innerHTML — DOM 조작 없음, 문자열 리포트만 console 출력

반론(Devil's Advocate): (1) INTEGRITY_REASONS 가 writer 계약과 별개 선언 → 문자열 드리프트 시 D-17 보안 알림이 false-negative(정합성 실패를 content 버킷으로 흡수)로 무음(🟠 MINOR-5). (2) `--alert` exit 1 이 보안 정합성 스파이크와 인프라 실패를 동일 코드로 혼동 → alert fatigue 로 실제 보안 이벤트 은폐(🟠 MINOR-6). (3) `--json` kinds[].n 타입 비일관(🟠 MINOR-7).

## Pass 4 (Contract): ✅ 8건 확인 / 🔴 0건 / 🟠 2건 / N/A 4건

**관점: "구현 재정립서 v2.0 대로 만들었는가?"**

확인:

- PASS blob 레이아웃 계약 정합 — writer `analytics.ts:55-68`(indexes:[kind]/blobs:[kind,subject,round,inputType,examType,defectReason]/doubles:[isCorrect]) ↔ reader 헤더 `public-analytics-reader.mjs:9-12` + 쿼리 `:46-48`(blob1=kind,blob2=subject,blob6=reason,double1) 완전 일치. index1=kind 도 일치. 파싱 매핑 오정렬 0
- PASS INTEGRITY_REASONS(reader `:26` ['choice_id_malformed','choice_id_unresolved']) ↔ writer `routes.ts:449-450` 산출 두 값 + `analytics.ts:34-37` JSDoc 계약 3자 정합. D-17 분리 버킷 계약 일치
- PASS Silent Pivot 없음 — ledger §8.8(:178-186)이 산출물 2파일·테스트6·지표3종·sum(\_sample_interval) 샘플보정·읽기전용·RC-6 잔여를 정확히 기술, 실 구현과 1:1 대응. 문서-구현 이탈 0
- PASS 읽기 전용/production write 0 — `read-public-analytics.mjs` 는 GET /accounts(:73) + POST analytics_engine/sql(:85, SELECT only) 뿐. writeDataPoint·D1 write·마이그 0. ledger 'production 쓰기 0' 주장 확증
- PASS 테스트 배선 — `package.json:10` test:scripts 글롭 `scripts/__tests__/*.test.mjs` 이 신규 public-analytics-reader.test.mjs(6 test: :18/:29/:37/:44/:57/:71) 커버. ledger '테스트6·자동배선' 정확
- PASS stub/TODO/placeholder/빈catch 0 — 리더 전 함수 body 실로직 구현. cfFetch catch(:64-66) throw / main catch(:97-113) fail() / analytics.ts catch(:69-72) console.warn. 무음 삼킴 0(CRITICAL RULE #3 준수)
- PASS fail-closed 계약 — parseAeResult(:60-65) 실패·형식이상 throw / 토큰 미설정(:92-94)·미지원 env(:40-42)·비양수 days(:43-45) exit 1. ledger '--alert 정합성≥1 exit 1 / 토큰·env fail-closed' 정확(`read-public-analytics.mjs:125-130`)
- PASS 하드코딩 임계값 계약 — --days 기본 7(:29), accuracyPct 반올림 소수1자리(:87), toCount NaN 차단(:70-74). 교재 원문 대조 대상 constants(수치 산식)는 본 변경에 없음 — 순수 관측 지표
- N/A 노드 ID 컨벤션(CONCEPT-/F-/INS-) — 본 변경은 AE 관측 리더로 knowledge_nodes/edges 생성·수정 0. ontology-registry 무접촉
- N/A Hard Limit(knowledge_nodes/formulas UPDATE 금지·LLM 수식계산·동적 코드실행) — 리더는 SELECT 조회만, math.js·formula-engine·eval 무관. 위반 표면 없음
- N/A BATCH 순차 실행 게이트 — 콘텐츠 적재 파이프라인 아님(관측 소비자). BATCH N/N+1 무관
- N/A(고려) Hard Rule 16 시험경계(examType 필터) — AE dataset 은 Rule 16 지식테이블 목록(user*progress/knowledge*\*/exam_questions 등)에 불포함. 현 공개표면 전건 FIXED_EXAM_TYPE='1st'(`routes.ts:60`)라 blob5 examType 필터 부재가 Year1 무해. Year2 다종목 공유 시 재검토 대상이나 현 스코프 밖

반론(Devil's Advocate): (1) AE dataset 명이 wrangler.toml(정본)과 리더 상수에 이중 선언 → 드리프트 시 CI 무감지(단 fail-loud 라 데이터 오염은 없음, 🟠 MINOR-8). (2) `summarizeAccuracy` '정답률'이 정합성 실패(choice_id_unresolved) grade 를 오답으로 포함해 과목 정답률 하방 오염 — 단 ledger §8.7:174 가 D-20 reader 버킷팅·RC-6 잔여로 명시 이월(Silent Pivot 아님, 🟠 MINOR-9).

판정: **완료 가능** (4-Pass 전체 CRITICAL 0)
────────────────────────────────────

---

## 확정 발견 (적대적 반증 통과분) — CRITICAL 0 / MAJOR 0 / MINOR 9

> 반증 통과 = "실피해 시나리오가 devil's advocate 를 견뎌 살아남은" 발견만 등재. MINOR 전건 별건/이월 처분 후보(RC-6·D-25·RC-5·shared 단일화 카드).

### MINOR-1 — `--json` 출력에서 kinds[].n 이 원시 문자열로 누출 (accuracy/defects 는 number → 타입 불일치)

- Pass: Surgeon · 파일: `scripts/read-public-analytics.mjs:117,120`
- 상세: `main()` 이 `kinds = kindsRows.map((r) => ({ kind: r.kind, n: r.n }))` 로 AE 의 n(UInt64 문자열, 예 '12')을 변환 없이 담고, `--json` 경로(line 120)에서 그대로 직렬화한다. 같은 JSON 문서의 accuracy.total/correct(summarizeAccuracy 의 toCount → number)·defects.contentTotal/integrityTotal(classifyDefects → number)은 number 인데 kinds[].n 만 string 이다. formatReport(text) 경로는 line 122 에서 toCount(k.n) 로 변환하므로 사람이 읽는 출력은 정상이나, `--json` 을 기계 소비(향후 ops.yml 경보·대시보드)하면 kinds[].n 에 산술 시 문자열 연결('12'+1='121') 같은 조용한 오염 가능.
- 확인 근거:
  - `scripts/read-public-analytics.mjs:117` — kinds 는 r.n 을 변환 없이 담음
  - `scripts/read-public-analytics.mjs:120` — JSON.stringify 에 kinds 원시 n 직렬화
  - `scripts/lib/public-analytics-reader.mjs:80-89` — summarizeAccuracy 는 toCount 로 number 화(대조: kinds 는 미변환)
  - `scripts/lib/public-analytics-reader.mjs:122` — formatReport 는 toCount(k.n) 로 텍스트 경로만 방어
- 반론(Devil's Advocate): 현재 `--alert` cron 미배선(ledger:186 RC-6 잔여)이라 `--json` 소비자가 아직 0 이므로 실피해 없음. 그러나 D-25/경보 배선 시 첫 소비자가 kinds count 로 임계 비교하면 문자열 비교('9'>'10' true)로 오탐 가능 — 소비자 생기기 전 선제 정규화가 안전.
- 권장 수정: `main()` line 117 을 `kinds = kindsRows.map((r) => ({ kind: r.kind, n: Number(r.n) }))` 로 정규화하거나, 순수 모듈에 `summarizeKinds(rows)` 를 추가해 toCount 를 단일 경유시켜 JSON/텍스트 두 경로의 타입을 통일.

### MINOR-2 — writer(analytics.ts)↔reader blob 레이아웃 계약에 자동 교차 가드 부재 — writer 재배열 시 무음 지표 오염

- Pass: Architect · 파일: `scripts/lib/public-analytics-reader.mjs:46-48`
- 상세: 리더의 파싱은 blob1=kind/blob2=subject/blob6=defectReason/double1=isCorrect 매핑을 analytics.ts 라이터로부터 복제한 지식이다(리더 헤더 9-12 주석에 명시). 현재 매핑은 라이터와 정확히 일치하나, 두 모듈이 언어·패키지 경계로 분리(라이터=apps/api TS, 리더=scripts .mjs)돼 있고 공유 계약 모듈이 없다. 테스트(`public-analytics-reader.test.mjs:18-27`)는 리더가 blob2 AS subject 등을 생성하는지 리더 자체만 고정할 뿐 라이터 드리프트를 검출하지 못한다. 원장 §8.8:186 이 D-25(blob 스키마 버전 규약)로 별건 이월 추적 중.
- 확인 근거:
  - `apps/api/src/public/analytics.ts:57-66` — 라이터 blobs 배열 순서 [kind,subject,round,inputType,examType,defectReason] = blob1..blob6
  - `scripts/lib/public-analytics-reader.mjs:46-48` — 리더 쿼리가 blob1 AS kind / blob2 AS subject / blob6 AS reason 로 직접 참조(하드코딩 인덱스)
  - `scripts/__tests__/public-analytics-reader.test.mjs:18-27` — 테스트가 리더의 blob 참조를 리더 자신에 대해서만 assert(라이터 대조 테스트 0)
  - `apps/api/src/public/analytics.ts:9`(리더 헤더)·`docs/plans/promo-1st-p4-frontend-ledger.md:186` — 계약이 수동 주석 + D-25 별건 이월로만 관리
- 반론(Devil's Advocate): 누군가 라이터 analytics.ts blobs 배열 중간에 새 차원을 삽입하면 blob2 이후가 한 칸씩 밀려 subject→round, defectReason→'' 로 무음 오라벨되고, 리더/라이터 어느 테스트도 실패하지 않아 과목별 정답률·결함율 지표가 조용히 오염된다(서비스는 안 죽지만 관측성 신호가 거짓이 됨).
- 권장 수정: 라이터 blob 인덱스 상수를 shared 계약(또는 최소한 리더가 import 하는 단일 상수 맵)으로 승격하고, 라이터 blobs 배열 길이/순서를 고정하는 계약 테스트를 추가. 즉시 불가 시 D-25 규약에 '라이터 배열 변경 시 리더 헤더+쿼리 동시 개정' 체크를 명문화.

### MINOR-3 — kinds[].n 이 `--json` 출력에서 문자열(UInt64) 그대로 유출 — accuracy/defects 는 숫자 강제라 다운스트림 타입 불일치

- Pass: Architect · 파일: `scripts/read-public-analytics.mjs:117`
- 상세: 오케스트레이터가 kinds 를 `kindsRows.map(r=>({kind:r.kind, n:r.n}))` 로 만들며 n(AE UInt64 문자열)을 변환하지 않는다. `--json` 경로(:120)는 이 원시 문자열을 그대로 직렬화한다. 반면 accuracy(summarizeAccuracy:81 total/correct)와 defects(classifyDefects:102 toCount)는 숫자로 강제된다. formatReport 텍스트 경로는 toCount(k.n)로 강제(reader.mjs:122)하므로 사람이 읽는 리포트는 무해하나, `--json` 소비자가 받는 kinds.n 만 문자열이라 스키마가 비일관.
- 확인 근거:
  - `scripts/read-public-analytics.mjs:117` — kinds n 을 r.n 원시값으로 보존(변환 없음)
  - `scripts/read-public-analytics.mjs:120` — `--json` 경로가 kinds 를 그대로 JSON.stringify
  - `scripts/lib/public-analytics-reader.mjs:122` — formatReport 는 toCount(k.n)로 강제(텍스트 경로만 정규화)
  - `scripts/lib/public-analytics-reader.mjs:81,102` — accuracy/defects 는 toCount 로 숫자 강제(비대칭)
- 반론(Devil's Advocate): `--json` 산출을 파이프로 받아 kinds[].n 에 산술(예: sum, 정렬 비교)을 수행하는 다운스트림(cron 집계·대시보드)이 있으면 '16'+'12'='1612' 같은 문자열 연결 버그가 조용히 발생.
- 권장 수정: kinds 매핑에서 n:toCount(r.n) 로 통일(리더의 toCount export 또는 오케스트레이터 로컬 변환)해 accuracy/defects 와 출력 타입 일치.

### MINOR-4 — resolveAccountId 가 AE-Read 와 별개의 Account-list 권한에 의존 — 단일 토큰 스코프 협소 시 cron `--alert` 경보 무음

- Pass: Architect · 파일: `scripts/read-public-analytics.mjs:70-82`
- 상세: CLOUDFLARE_ACCOUNT_ID 미주입 시 resolveAccountId 가 /accounts 를 호출해 자동 탐색하는데, 이 엔드포인트는 AE SQL Read 와 다른 'Account 읽기' 권한을 요구한다. 원장 §8.8:186 은 ops.yml `--alert` 배선의 GH 시크릿 CLOUDFLARE_API_TOKEN 이 현재 D1/R2 스코프이며 Analytics Read 추가가 필요하다고 이월했는데, 그 토큰이 Analytics Read 만 갖고 Account list 권한이 없으면 CLOUDFLARE_ACCOUNT_ID 를 반드시 함께 주입해야 한다. 미주입+협소 스코프 조합에서 스크립트는 '계정 조회 실패'로 exit 1(fail-closed 자체는 OK)이나, cron 자동 경보 맥락에서는 정합성 신호가 있어도 `--alert` 로직 도달 전에 죽어 경보가 안 뜨는 무음 위험.
- 확인 근거:
  - `scripts/read-public-analytics.mjs:70-82` — envId 부재 시 /accounts 호출로 계정 자동탐색(별도 권한 필요)
  - `scripts/read-public-analytics.mjs:57` — 단일 Authorization Bearer 토큰이 /accounts 와 /analytics_engine/sql 양쪽에 공유
  - `docs/plans/promo-1st-p4-frontend-ledger.md:186` — RC-6 잔여: ops.yml `--alert` 배선은 시크릿이 Analytics Read 포함 필요(현 D1/R2)로 이월
  - `scripts/read-public-analytics.mjs:75-80` — 계정 0/다수 시 throw(단일계정 가정)
- 반론(Devil's Advocate): ops.yml 주간 cron 에 `--alert` 를 배선하고 토큰을 Analytics-Read-only 로만 갱신하면, choiceId 회전 스파이크(정합성 신호>0)가 실제로 발생해도 resolveAccountId 단계에서 죽어 exit 1 이 '경보'가 아닌 '설정 오류'로 뒤섞여 진단이 지연된다.
- 권장 수정: cron 배선 시 CLOUDFLARE_ACCOUNT_ID 를 GH 시크릿으로 함께 주입(자동탐색 우회)해 토큰 스코프를 AE Read 최소권한으로 유지하고, resolveAccountId 실패 메시지에 'ACCOUNT_ID 주입 권장'을 명시(이미 :79 에 일부 존재 — 자동탐색 실패 경로에도 확장).

### MINOR-5 — 보안 트립와이어(INTEGRITY_REASONS)가 writer 계약과 별개 선언 — 문자열 드리프트 시 D-17 보안 알림이 무음 오분류(false-negative)

- Pass: Advocate · 파일: `scripts/lib/public-analytics-reader.mjs:26`
- 상세: classifyDefects 는 reason 문자열 정확 일치('choice_id_malformed'|'choice_id_unresolved')로만 정합성(보안) 신호를 콘텐츠 결함과 분리한다(lib:96-112). 이 두 상수(lib:26)는 실제 이벤트를 발행하는 writer(routes.ts grade 핸들러 — 원장 §8.7)와 공유 상수·계약 테스트 없이 독립 복제돼 있다. writer 가 사유 문자열의 대소문자/접미사를 바꾸거나 신규 회전 사유를 추가하면, reader 는 매칭 실패로 그 이벤트를 integrity 가 아닌 content 버킷으로 분류(lib:107-108) → integrityTotal 에 안 잡히고 `--alert` 가 exit 1 을 내지 않는다. 즉 secret 회전·choiceId 위조 스파이크(D-17 의 존재 이유)를 놓친다. 현재는 analytics.ts:34-37 JSDoc 이 정확히 이 두 문자열을 명문화하고 reader 가 일치하므로 무해하나, 가드가 없어 드리프트가 무음이다.
- 확인 근거:
  - `scripts/lib/public-analytics-reader.mjs:26` — INTEGRITY_REASONS=['choice_id_malformed','choice_id_unresolved'] 독립 선언
  - `scripts/lib/public-analytics-reader.mjs:104-110` — INTEGRITY_REASONS.includes(reason) 정확일치 분기, else 는 content 버킷(누락 시 보안신호가 content 로 흡수)
  - `apps/api/src/public/analytics.ts:34-37` — writer 측 defectReason 계약이 동일 두 문자열을 JSDoc 로만 선언(공유 export 아님)
  - `docs/plans/promo-1st-p4-frontend-ledger.md:169` — routes.ts 가 발행처(reader 와 별개 파일에서 문자열 재선언)
- 반론(Devil's Advocate): routes.ts 에서 사유를 'choiceId_unresolved'(카멜) 또는 'choice_id_unresolved_v2' 로 리팩터하면, 다음 secret 회전 인시던트에서 전 채점이 resolve-null 로 오답화돼도 reader 의 integrityTotal=0 → `--alert` 무발화 → cron 이 '정상'으로 판정, 실제 보안 이벤트가 콘텐츠 결함율에 섞여 은폐됨. 테스트는 reader 자체 상수로만 검증하므로 이 드리프트를 못 잡는다.
- 권장 수정: 정합성 사유 문자열을 shared 상수(예: apps/api 와 scripts 가 공유하는 단일 모듈 또는 @thepick/shared)로 단일화하거나, 최소한 writer↔reader 문자열 동치를 강제하는 계약 테스트를 추가한다(RC-5 shared 단일화 카드에 편입 권장).

### MINOR-6 — `--alert` exit 1 이 보안 정합성 스파이크와 인프라 실패를 동일 코드로 혼동 — 알림 피로가 실제 보안 이벤트를 가릴 수 있음

- Pass: Advocate · 파일: `scripts/read-public-analytics.mjs:125`
- 상세: cron/운영 알림 소비자 관점에서 (a) 토큰 만료·계정 조회 실패·AE 쿼리 실패(read:92-93,99-101,111-113 fail()→exit 1)와 (b) 정합성 신호 감지(read:125-130 exit 1)가 같은 exit code 1 로 귀결된다. stderr 메시지는 🔴 vs 🟡 로 구분되지만, exit code 만 보고 메일 보내는 흔한 cron 배선에서는 둘이 구분되지 않는다. 인프라 실패(토큰 flaky 등)가 잦아 운영자가 exit 1 에 둔감해지면, 진짜 choiceId 위조/회전 스파이크(보안)를 '또 그 잡 실패'로 무시할 위험(alert fatigue). 현재는 ops.yml 에 reader 가 아직 미배선(원장 §8.8 RC-6 잔여)이라 잠재 위험.
- 확인 근거:
  - `scripts/read-public-analytics.mjs:49-52` — fail() 은 모든 인프라 오류에 exit 1
  - `scripts/read-public-analytics.mjs:125-130` — 정합성 신호도 exit 1(같은 코드)
  - `scripts/read-public-analytics.mjs:126-128` — stderr 🟡 메시지로만 구분(exit code 동일)
  - `docs/plans/promo-1st-p4-frontend-ledger.md:186` — ops.yml `--alert` 배선은 GH 시크릿 Analytics Read 스코프 대기(미가동)
- 반론(Devil's Advocate): 토큰이 주기적으로 만료돼 매일 exit 1 메일이 오는 환경에서, 어느 날 실제 secret 회전으로 정합성 신호 40건이 떠 exit 1 이 나도 운영자가 '토큰 또 만료됐네' 하고 닫으면 보안 인시던트가 지연 대응된다. 특히 `--json` 파이프라인은 stderr 메시지를 안 읽고 exit code 만 검사할 수 있어 구분 정보가 유실된다.
- 권장 수정: 정합성 스파이크에는 인프라 실패와 다른 exit code(예: exit 2)를 부여해 cron 이 보안 신호를 별도 라우팅/에스컬레이션할 수 있게 한다. ops.yml 배선 시점에 정합성 전용 알림 채널 분리(D-19 Email 채널)와 함께 처리 권장.

### MINOR-7 — `--json` 출력의 타입 비일관 — kinds[].n 은 원시 문자열, accuracy/defects 수치는 number

- Pass: Advocate · 파일: `scripts/read-public-analytics.mjs:117`
- 상세: `--json` 소비자 관점에서 출력 스키마가 필드별로 타입이 다르다. kinds 는 read:117 에서 r.n(AE UInt64 원시 문자열, 예 '16')을 그대로 담아 JSON 에 문자열로 나가는 반면, accuracy 는 summarizeAccuracy 가 total/correct 를 Number 변환(lib:80-89), defects 도 classifyDefects 가 toCount 로 number 변환(lib:101-110)한다. 결과적으로 JSON 에서 kinds[].n='16'(string) 이지만 accuracy[].total=16(number), defects.content[].n=number 로 혼재. formatReport 는 toCount(k.n)(lib:122)로 흡수해 텍스트 리포트는 정상이나, `--json` 을 프로그램으로 소비하면 kinds.n 만 별도 coerce 필요.
- 확인 근거:
  - `scripts/read-public-analytics.mjs:117` — kinds=kindsRows.map(r=>({kind:r.kind,n:r.n})) 원시값 유지
  - `scripts/read-public-analytics.mjs:120` — JSON.stringify 로 그대로 직렬화(문자열 n)
  - `scripts/lib/public-analytics-reader.mjs:80-89` — summarizeAccuracy 는 toCount 로 number 반환
  - `scripts/lib/public-analytics-reader.mjs:101-102` — classifyDefects 도 toCount 로 number 반환
- 반론(Devil's Advocate): 장래 이 `--json` 을 대시보드/집계 스크립트가 소비하며 kinds[].n 을 산술 연산(예: 합계 kinds.reduce((a,k)=>a+k.n,0))하면 '16'+'12'='1612' 문자열 연결로 조용히 오집계된다. 텍스트 리포트만 테스트돼 있어(test:71-88) 이 `--json` 타입 비일관은 회귀 가드가 없다.
- 권장 수정: read:117 에서 n:toCount(r.n) 로 number 정규화(lib 의 toCount export 또는 Number 가드) 해 `--json` 스키마 타입을 통일하고, `--json` 형상 단위 테스트 1건 추가.

### MINOR-8 — AE dataset 명이 wrangler.toml(정본)과 리더 상수에 이중 선언 — 드리프트 시 CI 무감지

- Pass: Contract · 파일: `scripts/lib/public-analytics-reader.mjs:16-20`
- 상세: DATASETS 상수(dev/staging/production 3종 dataset 명)가 wrangler.toml [[analytics_engine_datasets]](:117,:189,:262)의 값을 하드코딩 복제한다. 모듈 주석(:15)이 wrangler.toml 을 정본으로 명시하나 컴파일·테스트 링크가 없다. wrangler.toml 에서 dataset 명이 변경되면 리더는 계속 구명(舊名)을 조회한다. production-quality.md '하드코딩 금지 → 명명된 상수' 관점에서는 상수화되어 있으나, 진짜 단일 진실원(wrangler.toml)과의 정합 검증 게이트는 부재. 실해악은 낮음(아래 반론).
- 확인 근거:
  - `scripts/lib/public-analytics-reader.mjs:15-20` — DATASETS 상수 3종 하드코딩 + 주석 'wrangler.toml [[analytics_engine_datasets]] 정본'
  - `apps/api/wrangler.toml:115-117,:187-189,:260-262` — dataset 명 3환경 실 선언(thepick*public_events*{dev,staging,production})
  - `scripts/__tests__/public-analytics-reader.test.mjs:34` — 테스트가 DATASETS 키만 자기참조 검증(wrangler.toml 대조 없음 → 드리프트 무감지)
- 반론(Devil's Advocate): 드리프트가 발생해도 존재하지 않는 dataset 조회 → AE SQL API 오류 → parseAeResult(:60-65)가 throw → 오케스트레이터 fail(exit 1)로 fail-loud 중단. 즉 '조용히 틀린 수치'가 아니라 '요란한 실패'라 데이터 오염 위험은 없다. 그러나 cron `--alert` 경보가 dataset 오타로 매일 exit 1 하면 진짜 정합성 신호와 구분 불가한 잡음이 될 수 있다.
- 권장 수정: 별건(스코프 밖) — 향후 배포 검증 스크립트에서 wrangler.toml 파싱 → DATASETS 대조 게이트 1종 추가하거나, ledger RC-6 잔여(D-25 blob 스키마 버전 규약)에 dataset 명 정합 항목 병기.

### MINOR-9 — summarizeAccuracy '정답률'이 정합성 실패(choice_id_unresolved) grade 를 오답으로 포함 — 리포트에 무경고(단, 문서상 이월 명시)

- Pass: Contract · 파일: `scripts/lib/public-analytics-reader.mjs:79-90`
- 상세: grade 핸들러는 submittedIndex===null(choiceId 미복원) 시 defect 이벤트(routes.ts:451)와 grade 이벤트(isCorrect=false, routes.ts:498)를 '이중 발행'한다. 리더의 accuracyBySubject 쿼리(:47)는 blob1='grade' 전건을 total 에 넣고 double1=1 만 correct 로 세므로, 정합성 실패건이 오답으로 total 을 부풀려 과목 정답률을 하방 오염시킨다. 리더는 integrityTotal 을 별도 계산(classifyDefects)하면서도 accuracy 리포트(formatReport:124-129)에 이 오염 가능성을 각주하지 않는다. Silent Pivot 은 아님 — ledger §8.7(:174)이 'grade double-emission 정답률 오염 = D-20 reader 버킷팅 사안, RC-6 잔여 편입'으로 명시 이월했다.
- 확인 근거:
  - `apps/api/src/public/routes.ts:451,:498` — 동일 요청에서 defect + grade(isCorrect=false) 이중 발행 확인
  - `scripts/lib/public-analytics-reader.mjs:47,:87` — accuracyBySubject 가 grade 전건 total 집계 + accuracyPct=correct/total (정합성 실패 필터 없음)
  - `docs/plans/promo-1st-p4-frontend-ledger.md:174` — '정답률 오염 … D-20 reader 버킷팅 사안 … RC-6 잔여 편입' 명시 이월(=미보고 이탈 아님)
- 반론(Devil's Advocate): ledger §8.8(:184) 실 production 검증 결과 정합성 신호 0 이므로 현재 오염량은 0 이다. secret 회전·choiceId 위조 인시던트가 발생해야만 정답률이 오염되며, 그 시점엔 `--alert` 가 이미 exit 1 경보를 낸다. 따라서 현 트래픽에서 무해하고 문서로 공개돼 있어 Contract 위반은 아니다. 다만 회전 사건 중 정답률 대시보드를 신뢰하는 소비자는 오도될 수 있다.
- 권장 수정: 별건(RC-6 잔여) — formatReport 정답률 섹션에 integrityTotal>0 시 '정합성 실패 N건이 정답률에 오답으로 포함됨' 각주 1줄 추가, 또는 accuracyBySubject 에서 정합성 실패 grade 제외 버킷팅(ledger 이월 항목대로).

---

## 종합 판정

| 지표     | 값                                                    |
| -------- | ----------------------------------------------------- |
| CRITICAL | 0                                                     |
| MAJOR    | 0                                                     |
| MINOR    | 9 (Surgeon 1 / Architect 3 / Advocate 3 / Contract 2) |

**판정: 완료 가능** — 4-Pass 전체 CRITICAL 0. MINOR 9 는 전건 (a) 현 트래픽 무해(정합성 신호 실측 0) + (b) RC-6·D-25·RC-5 shared 단일화 카드로 명시 이월/추적 중인 항목이거나, `--json`/`--alert` cron 미배선으로 소비자가 아직 0 인 선제 정규화 후보. 진앙은 두 갈래로 수렴: ① `--json` 타입 비일관(MINOR-1/3/7, 단일 수정 `n:toCount(r.n)` 로 일괄 해소) ② writer↔reader 문자열/인덱스 계약 자동 가드 부재(MINOR-2/5/8, shared 계약 승격 + 계약 테스트로 일괄 해소). 경보 라우팅 개선(MINOR-4/6)과 정답률 각주(MINOR-9)는 ops.yml `--alert` 배선 시점에 함께 처리 권장.
