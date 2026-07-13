# 4-Pass Review — D-22 (RC-3 정리) 공개 choiceId HMAC secret 중앙화 리팩터

- **타임스탬프:** 20260714-011011
- **리뷰 방식:** 독립 에이전트 5개(scope / Surgeon / Architect / Advocate / Contract) + 발견별 적대적 반증
- **판정:** **완료 가능** (CRITICAL 0 / MAJOR 0 / MINOR 5)

---

## 스코프

**변경 파일 (3):**

- `apps/api/src/public/choice-id.ts`
- `apps/api/src/public/routes.ts`
- `apps/api/src/public/__tests__/choice-id.test.ts`

**연관 파일 (4):**

- `apps/api/src/public/__tests__/routes.test.ts`
- `apps/api/src/index.ts`
- `docs/runbooks/secret-rotation.md`
- `apps/api/src/public/analytics.ts`

**요약:** D-22(RC-3 정리) 순수 리팩터 — 공개 표면 choiceId HMAC secret 해석을 3개 핸들러(serve:343 / grade:441 / reveal:576)에 분산돼 있던 `c.env.JWT_SECRET ?? ''` 를 choice-id.ts 의 단일 헬퍼 `resolvePublicChoiceSecret(env)` 로 중앙화하고, routes.ts import·3개 호출부를 이 헬퍼로 교체했다. 헬퍼는 `env.JWT_SECRET ?? ''` 반환으로 동작 byte-identical(폴백 `''` → hmacHex 가 CHOICE_ID_FALLBACK_KEY 로 승격, 결정성 보존). 목적은 미래 CHOICE_ID_SECRET 분리(secret-rotation.md §7-1)의 zero-touch seam 을 1곳에 확보하는 것이며, choice-id.test.ts 에 헬퍼 단위 테스트 3건이 추가됐다.

---

── 4-PASS REVIEW ──────────────────

리뷰 방식: 독립 에이전트 5개(scope / Surgeon / Architect / Advocate / Contract) + 발견별 적대적 반증
리뷰 범위: 변경 파일 3개 + 연관 파일 4개 (상단 스코프 목록)

### Pass 1 (Surgeon) — Bottom-Up, 코드 정합성

✅ 9건 확인 / 🔴 0건 / 🟠 0건(생존) / N/A 4건

**확인:**

- **PASS Null/Undefined** — choice-id.ts:40 `resolvePublicChoiceSecret` 는 `env.JWT_SECRET ?? ''` 로 undefined 시 `''` 반환, hmacHex(choice-id.ts:86) `secret.length>0 ? secret : CHOICE_ID_FALLBACK_KEY` 가 `''` 를 폴백 상수로 승격 → 빈 키 importKey 거부 크래시 경로 없음
- **PASS Null/Undefined** — routes.ts:402/545 `.first<GradeRow>()` null 반환은 408/554 에서 명시 처리(404), 리팩터 무변경
- **PASS Async 누락** — 3 호출부 모두 `const secret = resolvePublicChoiceSecret(c.env)`(sync) 후 awaited 소비: serve 344 buildPublicChoices, grade 442 resolveChoiceId·467 issueChoiceId, reveal 579 issueChoiceId — 전부 동일 핸들러 스코프 내 await, 누락 0
- **PASS 행위 동치** — choice-id.ts:40 `env.JWT_SECRET ?? ''` 은 구 인라인 `c.env.JWT_SECRET ?? ''` 와 연산 동일(`??` 는 null/undefined 에만 발동, `''` 는 통과) = byte-identical, JWT_SECRET='' 케이스도 동일
- **PASS 타입 정합** — helper param `{readonly JWT_SECRET?: string}`(choice-id.ts:39)에 PublicRouteBindings(routes.ts:52-62, JWT_SECRET?: string 보유) 상위집합 전달 = 구조적 호환 컴파일
- **PASS 잔여 인라인 0** — routes.ts 내 `JWT_SECRET ?? ''` 인라인 잔존 없음(343/441/576 3곳 전부 helper 로 이관, import 48행)
- **PASS 빈 catch** — analytics.ts:72-75 catch 는 console.warn 포함(무음 아님), routes.ts 모든 try/catch(255/328/404/547)는 logger.error+응답 반환, 빈 catch 0
- **PASS 테스트 정합** — choice-id.test.ts:70-85 helper 3건(설정/미설정/issueChoiceId 흐름) + routes.test.ts:219 issueChoiceId(JWT_SECRET) 직접사용이 helper 반환값(JWT_SECRET 설정 시)과 일치
- **PASS stub/TODO/placeholder** — choice-id.ts 헬퍼는 실 로직(`return env.JWT_SECRET ?? ''`) 보유, TODO/HACK/빈 body 0
- **N/A** Formula Engine/동적실행 — 스코프 파일에 math.js·eval·new Function 없음(choiceId=HMAC 서명일 뿐)
- **N/A** 산식 정밀도(부동소수·numeric_value) — 스코프 파일에 수식 계산 없음, HMAC/hex 정수 연산만
- **N/A** 경계값 빈배열/NaN/음수(FSRS) — 스코프에 노드배열·산식변수·interval 없음
- **N/A** Vectorize/Claude API/pdfplumber await — 스코프 파일에 해당 호출 없음(D1 쿼리는 index.ts/routes.ts 기존 경로, 리팩터 무접촉)

**반론(Devil's Advocate):** JWT_SECRET 이 실제 빈 문자열('')로 바인딩된 프로덕션 오설정 시나리오 — 이 경우 helper 는 `''` 를 반환하고 hmacHex 는 CHOICE_ID_FALLBACK_KEY(dev/test 상수)로 서명하게 된다. 리팩터 전후 동작 동일이므로 회귀는 아니나, 이는 secret 미설정을 조용히 폴백 키로 승격하는 선재 설계 특성이다(D-22 스코프 밖, 회전 런북 §3 secret put 절차가 이를 보완). → MINOR 발견 5건 중 secret-rotation.md 런북 stale 로 연결(하단).

### Pass 2 (Architect) — Top-Down, 연계 검증

✅ 9건 확인 / 🔴 0건 / 🟠 0건(생존) / N/A 3건

**확인:**

- **PASS Import 방향** — choice-id.ts(choice-id.ts:39,93,105 export)는 routes.ts 가 단방향 import(routes.ts:44-49), choice-id.ts 는 routes.ts 를 역참조하지 않음 — 순환 0. apps/api 내부 모듈 간 이동이라 packages/ 단방향 규칙 대상 아님
- **PASS byte-identical 동작** — helper 반환 `env.JWT_SECRET ?? ''`(choice-id.ts:40) = 기존 inline `c.env.JWT_SECRET ?? ''` 와 동일, 폴백 `''` → hmacHex(choice-id.ts:86)가 CHOICE_ID_FALLBACK_KEY 승격 = 결정성 보존. 3 call site(routes.ts:343/441/576) 전부 동일 치환
- **PASS 구조적 타입 정합** — helper param `{ readonly JWT_SECRET?: string }`(choice-id.ts:39) ↔ 호출 인자 c.env(PublicRouteBindings, routes.ts:52-62 JWT_SECRET?: string) 정합, index.ts:67 Bindings.JWT_SECRET?: string 도 정합
- **PASS serve↔grade↔reveal seam 왕복** — 세 핸들러가 같은 요청 내 동일 c.env → 동일 secret 해석 → issueChoiceId/resolveChoiceId 대칭(routes.ts:202,442,467,579), routes.test.ts:219-236,302-309,483 가 issueChoiceId(JWT_SECRET,...) 로 forge 해 실핸들러 왕복 검증
- **PASS Workers 제약** — fs/path 미사용, crypto.subtle(Web Crypto, choice-id.ts:63-88)만 사용, helper 는 순수 문자열 반환 = CPU/번들 영향 무시가능(diff +47/-5)
- **PASS 테스트 커버리지** — choice-id.test.ts:70-85 resolvePublicChoiceSecret 3 케이스(설정값 반환/미설정 '' 폴백/issueChoiceId 흐름 동치) 추가, 기존 왕복·위조·캐시격리 테스트(choice-id.test.ts:16-68) 보존
- **PASS 무음 실패 없음** — helper 에 try-catch·데이터 삭제 경로 없음(순수 반환), AE 기록 실패는 analytics.ts:72-75 warn 로깅, grade defect 신호는 routes.ts:454-461 분리 버킷 발행 = 무음 오채점 진단 가능
- **PASS i18n** — 이번 변경분에 사용자 노출 한국어 하드코딩 신규 0(주석만 한국어), 에러 응답은 코드 리터럴('NO_QUESTION' 등)·ErrorCode enum 사용(routes.ts:336,410,439)
- **PASS 정답 안전(연계 확인)** — secret 중앙화가 correctOriginalIndices 판정 경로(routes.ts:463) 불변 — choiceId 는 위치 식별자, 정답 판정은 parseMcChoices 로만(choice-id.ts:16-17 계약 보존)
- **N/A** D1 스키마 일치 — 이번 refactor 는 스키마·쿼리 무변경(exam_questions SELECT 문 routes.ts:245-252,316-320,395-402 불변), Drizzle 타입 접점 없음
- **N/A** Ontology Lock / truth_weight 정렬 / Temporal Graph(INSERT+SUPERSEDES) — 공개 채점 표면 리팩터로 노드/엣지 ID 생성·RAG truth_weight 정렬·knowledge_nodes UPDATE 경로 전무
- **N/A** IndexedDB↔D1 동기화 / Hexagonal domain→infra — 대상 코드가 apps/api edge worker(공개 라우트)라 오프라인 큐·modules/ 도메인 계층 해당 없음

**반론(Devil's Advocate):** helper seam 이 "다른 모듈/설정과 만나는 지점"에서 전환 비용을 과소 표현할 수 있다 — 미래 CHOICE_ID_SECRET 분리는 함수 1곳이 아니라 파라미터 타입 확장·PublicRouteBindings·wrangler 바인딩 3표면을 건드려야 한다(하단 MINOR-3). 또한 연계 런북 secret-rotation.md 가 리팩터 후 line-ref/서술 stale(하단 MINOR-2/4/5). 코드 동작 자체는 무결하나 문서 정합은 미동기.

### Pass 3 (Advocate) — Cross-Cutting, UX + 보안

✅ 10건 확인 / 🔴 0건 / 🟠 0건(생존) / N/A 3건

**확인:**

- **PASS byte-identity** — choice-id.ts:40 `env.JWT_SECRET ?? ''` == 이전 인라인 `c.env.JWT_SECRET ?? ''`, 3 호출부 routes.ts:343/441/576 전수 교체 확인. 결정성 보존('' → hmacHex:86 이 CHOICE_ID_FALLBACK_KEY 로 승격)
- **PASS 정답 안전(Hard Stop)** — choiceId 는 위치 식별자일 뿐 정답 비노출(choice-id.ts:16-17). grade 채점 로직 무변경, correctChoiceIds 발급이 resolveChoiceId 와 동일 secret var 사용(routes.ts:441,467) — 복원↔재발급 secret 정합
- **PASS 입력 검증** — GradeBodySchema(questionId≤128·choiceId≤64·answer≤2000) / RevealBodySchema Zod 검증(routes.ts:97-108), safeParse 실패 시 400 VALIDATION_ERROR(routes.ts:387,530)
- **PASS 에러 UX 정보 누출 없음** — D1 catch 는 raw err 미노출, 일반 ErrorCode.INTERNAL_ERROR 500 만 반환(routes.ts:256,330,405,548). 미존재·2차·flagged·deprecated 전부 동일 404 로 수렴(routes.ts:409) = 정보 노출 최소화
- **PASS 빈 catch/TODO/stub/placeholder 0** — choice-id.ts:67-70 catch 는 캐시 evict 후 rethrow(무음 아님), analytics.ts:72-75 console.warn, routes.ts 전 catch log+return. 스코프 전 파일 grep 상 TODO/HACK/FIXME 부재
- **PASS API 키 하드코딩 없음** — JWT_SECRET 은 바인딩(index.ts:67, routes.ts:59). CHOICE_ID_FALLBACK_KEY(choice-id.ts:47)는 dev/test 도메인분리 상수로 F-3 하 보안경계 아님 명문화(choice-id.ts:44-46) — 실 secret 아님
- **PASS 폴백 결정성·격리** — hmacHex:85-90 이 빈 secret → FALLBACK_KEY 승격, keyMaterial 별 캐시 격리(choice-id.ts:58-74). 테스트 choice-id.test.ts:43-60(폴백 왕복·캐시키 충돌 없음)·75-84(헬퍼 seam 흐름) 커버
- **PASS 헬퍼 최소권한 타입** — resolvePublicChoiceSecret({ readonly JWT_SECRET?: string })(choice-id.ts:39) 는 전체 env 보다 좁은 구조적 타입 = 과다 권한 노출 없음. c.env(PublicRouteBindings) 구조 호환
- **PASS 상태 표현(빈 데이터)** — overview 는 서빙가능 0 시 404 아닌 total:0 + subjects:[] 반환(routes.ts:278-283), 테스트 routes.test.ts:460-466 검증 = 지도 빈상태를 에러 아닌 정상 표현
- **PASS 회귀 커버리지** — routes.test.ts 는 헬퍼 경유 3핸들러 전부 실 SQLite 통합으로 왕복 검증(serve 112-140/grade 211-227/reveal 470-485) + secret 회전 신호 분리(268-294). choice-id.test.ts:70-85 헬퍼 단위 3건 신규
- **N/A** XSS/innerHTML — 전 파일 백엔드(Hono API·crypto), DOM 조작·innerHTML 부재
- **N/A** 오프라인/Service Worker 캐싱 — 스코프는 서버 API, SW·캐시 전략 코드 없음(캐시 헤더는 index.ts:140 cachePolicyMiddleware 별도 계층)
- **N/A** 접근성(터치44px·키보드·aria-label) — 프론트 UI 파일 스코프 외, 백엔드 JSON 응답만

**반론(Devil's Advocate):** 새벽 on-call 이 secret 회전 blast radius 를 판단할 때 secret-rotation.md 를 열면 §0/§7-1 이 리팩터 이전 상태('3곳 흩어짐', line 338/436/571)를 서술한다. 회전 스파이크 조사 중 routes.ts:436 으로 점프하면 parseMcChoices 계약 블록에 착지해 실제 secret 해석부(441/choice-id.ts:40)를 놓칠 수 있다 → MINOR-4. choiceId 회전 blast radius 자체(§2.2 in-flight 스파이크·자가교정)는 여전히 정확하므로 오판 유발 수준은 아님.

### Pass 4 (Contract) — 기획 대조, Silent Pivot 탐지

✅ 8건 확인 / 🔴 0건 / 🟠 0건(생존) / N/A 3건

**확인:**

- **PASS** — choice-id.ts:39-41 resolvePublicChoiceSecret 은 `env.JWT_SECRET ?? ''` 반환 = 기존 인라인 `c.env.JWT_SECRET ?? ''`(routes.ts:343/441/576)와 byte-identical, 폴백 '' → hmacHex(choice-id.ts:86)가 CHOICE_ID_FALLBACK_KEY 로 승격 = 결정성 보존. Silent Pivot(기획≠구현) 없음
- **PASS** — routes.ts:44-49 import 4종 전부 소비 — CHOICE_ID_HEX_LENGTH(455), issueChoiceId(202/467/579), resolveChoiceId(442), resolvePublicChoiceSecret(343/441/576). dead/unused import 0
- **PASS** — 핸들러 내 잔존 직접 `c.env.JWT_SECRET` 읽기 0 — 3개 secret 해석 전부 헬퍼 경유(343/441/576). JWT_SECRET 은 바인딩 타입 선언(routes.ts:59)으로만 등장 = 중앙화 완결(RC-3 단일 진실원 달성)
- **PASS** — choice-id.test.ts:70-85 헬퍼 단위 3건 = (a)JWT_SECRET 설정→그대로 반환(72) (b)미설정/undefined→''(76-77) (c)해석결과가 issueChoiceId 로 동일 흐름(82-83). 스코프 서술 '3건 추가'와 정합, 왕복 결정성 검증
- **PASS Hard Rule 15/17** — 리팩터는 apps/api(애플리케이션 계층, 범용 shared/formula-engine/parser 아님). 신규 `if(examId===...)` 분기 0. '1st'=FIXED_EXAM_TYPE(routes.ts:65) = exam_type 판별자(1차/2차)이지 exam_id 리터럴 아님 → Rule 17(EXAM_IDS 경유) 대상 아님. 전부 선재 코드, D-22 무접촉
- **PASS stub/TODO/HACK/placeholder/빈catch 0** — getHmacKey .catch(choice-id.ts:67-70)는 캐시 evict 후 rethrow(무음 아님), analytics catch(72-75)는 console.warn, routes.ts 전 catch(255/329/404/546)는 logger.error 전파
- **PASS 문서-의도 정합** — choice-id.ts:35-37 미래 seam 주석(`env.CHOICE_ID_SECRET ?? env.JWT_SECRET ?? ''`)이 secret-rotation.md:143-145 §7 item1 권고(폴백=JWT_SECRET)와 방향 일치
- **PASS index.ts 무변경 정합** — JWT_SECRET 바인딩(67)·PUBLIC_ANALYTICS(62) 선언, /api/public 마운트(176)·credentials:false CORS(135) 유지. D-22 로 인한 배선 드리프트 0
- **N/A** 노드 ID 네이밍 컨벤션(CONCEPT-001/F-01/INS-01) — 본 리팩터에 온톨로지 노드 생성/수정 없음(순수 코드 seam)
- **N/A** 수치/임계값 ↔ 교재 constants 대조 — constants/formulas 테이블 무접촉, CHOICE_ID_HEX_LENGTH=24(choice-id.ts:26) 불변, 교재 원문 수치 없음
- **N/A** BATCH N→N+1 순서 게이트 — 콘텐츠 배치 적재 아님, 리팩터 스코프 무관

**반론(Devil's Advocate):** 코드 docstring(choice-id.ts:35-37)이 secret-rotation.md §7-1 을 명시 근거로 인용하는데, 정작 그 런북은 리팩터 이전 상태('3곳 흩어짐', line-ref 338/436/571)를 그대로 서술 → 코드-문서 한 묶음이 미동기(MINOR-1/2/5). 다만 코드 동작은 byte-identical 로 무결(Silent Pivot 아님), 순수 문서 드리프트라 MINOR 수준.

판정: **완료 가능** (4-Pass 전 Pass CRITICAL 0)

────────────────────────────────────

---

## 확정 발견 (적대적 반증 통과분) — CRITICAL 0 / MAJOR 0 / MINOR 5

> 전 5건 = `docs/runbooks/secret-rotation.md` 및 seam 주석 정밀도 관련 **순수 문서 드리프트**. 런타임·배포·채점 동작 영향 0. 코드 동작은 byte-identical.

### MINOR-1 (Surgeon) — secret-rotation.md §0/§7 line-refs + '3개 핸들러 각자' 서술이 이번 중앙화로 stale

- **파일:** `docs/runbooks/secret-rotation.md` (line 20-22, 49, 53)
- **상세:** 런북 §0 설계관측(line 20-22)은 `apps/api/src/public/routes.ts:338,436,571 — 별도 CHOICE_ID_SECRET 부재` 및 '두 무관한 관심사가 한 secret 에... 3개 핸들러가 각자'로 서술하나, 이번 D-22 리팩터가 정확히 그 seam(resolvePublicChoiceSecret, choice-id.ts:39)을 신설해 3곳을 단일화했다. 또한 import 5줄 추가(routes.ts:44-49)로 실제 호출부가 338/436/571 → 343/441/576 으로 이동해 line-ref 가 어긋난다(§2.2 line 49 'choice-id.ts:10', line 53 'routes.ts:443-455'도 동일 drift). 런타임 무영향(순수 문서). on-call 이 §7-1 '이 함수 1곳만 바꾸면'을 읽을 때 §0의 '부재'/'각자' 서술과 모순 인지 가능성.
- **확증:**
  - choice-id.ts:39-41 — resolvePublicChoiceSecret 신설(단일 seam)이 §0 line 22 '별도 CHOICE_ID_SECRET 부재'/'3개 핸들러 각자' 서술을 무효화
  - routes.ts:343,441,576 — 실제 3 호출부가 helper 로 단일화(각자 인라인 아님) = 런북 서술과 불일치
  - routes.ts:44-49 — import 블록 5줄 추가로 이하 라인 시프트, 런북 §0 line 21 '338,436,571' ref 가 현 343/441/576 과 불일치
- **반론:** §3~§5 절차(wrangler secret put, 스모크, --alert 관측)는 line-ref 무관하게 유효하므로 대응 자체는 안 깨진다. 다만 회전 스파이크 진단 중 §0 ref 로 점프하면 엉뚱한 라인을 보게 되어 조사 지연 리스크는 존재.
- **제안 수정:** §0 설계관측을 '단일 seam resolvePublicChoiceSecret(choice-id.ts:39)에 중앙화됨 — §7-1 분리 시 1곳 변경'으로 갱신하고 §0/§2.2 line-ref 를 현 라인(choice-id.ts:39, routes.ts:343/441/576, D-17 발행 routes.ts:448-462)으로 정정.

### MINOR-2 (Architect) — secret-rotation.md 가 D-22 리팩터 후 stale (seam 주석이 근거로 지목한 §7-1/§0 이 pre-refactor 상태 서술)

- **파일:** `docs/runbooks/secret-rotation.md` (line 20-22, 143-144, 53)
- **상세:** D-22 리팩터의 seam 주석(choice-id.ts:35-37)이 명시적으로 secret-rotation.md §7-1 을 근거로 인용하는데, 정작 그 runbook 은 리팩터 이전 상태를 그대로 서술한다. (1) §0 관측(line 20-22)·§7-1(143-144)이 참조하는 `apps/api/src/public/routes.ts:338,436,571` 는 실제 위치와 어긋난다 — 실측 secret 해석 지점은 343/441/576(sed 결과 338/436/571 은 빈 줄/무관 라인). (2) §0 note 의 '별도 CHOICE_ID_SECRET 부재' + choice-id.ts:31 이 기술한 '3개 핸들러가 각자 c.env.JWT_SECRET ?? "" 를 반복' 서술은 D-22 가 정확히 제거한 상태 = 이제 단일 helper 로 모임(grep 결과 handler body 내 inline JWT_SECRET 사용 0, 3곳 모두 resolvePublicChoiceSecret(c.env)). (3) §2.2(line 53) 의 `public/routes.ts:443-455` 는 defect 발행 로직 실측 442-461 과 overlap 이나 라인 소폭 drift.
- **확증:**
  - choice-id.ts:35-37 — seam 주석이 'docs/runbooks/secret-rotation.md §7-1 의 zero-touch seam'으로 runbook 을 직접 인용(양방향 연계 확정)
  - grep 결과: routes.ts handler body 내 inline `JWT_SECRET ?? ''` 0건, 3 call site(343/441/576) 전부 resolvePublicChoiceSecret(c.env) — runbook §0 의 '각자 c.env.JWT_SECRET ?? "" 반복' 서술은 현재 거짓
  - `sed -n '338p;436p;571p' routes.ts` = 빈 줄/무관 라인, 실 secret 해석 = 343/441/576 → runbook §0/§7-1 line ref 5행 drift
  - choice-id.ts:31 주석이 runbook 과 동일한 '3개 핸들러 각자 반복' 표현을 과거형('반복하던')으로 이미 정정 — runbook 만 현재형 stale
- **반론:** runbook 은 이번 change set 의 직접 산출물이 아니고 라인 drift 는 동작 영향 0 이라 '스코프 밖·무해'로 볼 수도 있으나, 리팩터 코드 주석이 §7-1 을 근거로 못박은 이상 두 문서는 한 묶음이며, 미동기 시 다음 CHOICE_ID_SECRET 분리 세션이 stale refs 를 신뢰하다 오독할 실 시나리오 존재.
- **제안 수정:** §0 note·§7-1 을 D-22 반영으로 갱신: 라인 refs 338/436/571→343/441/576, '각자 c.env.JWT_SECRET ?? "" 반복'→'단일 helper resolvePublicChoiceSecret(choice-id.ts:39) 경유', §7-1 은 'seam 이미 확보됨, 분리 시 helper 1곳 + 타입/바인딩만'으로 축소 서술.

### MINOR-3 (Architect) — '이 함수 1곳만 바꾸면 자동 전환' seam 주석이 타입/바인딩 변경 표면을 누락(경미 과장)

- **파일:** `apps/api/src/public/choice-id.ts` (line 36-37, 39)
- **상세:** choice-id.ts:36-37 주석은 미래 CHOICE_ID_SECRET 분리를 '이 함수 1곳만 `env.CHOICE_ID_SECRET ?? env.JWT_SECRET ?? ''` 로 바꾸면 3개 호출부가 자동 전환'이라 서술한다. 호출부 zero-touch 는 사실이나(3곳 모두 c.env 만 넘김), 함수 body 에서 env.CHOICE_ID_SECRET 를 읽으려면 (a) 파라미터 타입 `{ readonly JWT_SECRET?: string }`(line 39) 을 CHOICE_ID_SECRET 포함으로 확장, (b) PublicRouteBindings(routes.ts:52-62) 에 CHOICE_ID_SECRET 필드 추가, (c) wrangler.toml secret 바인딩 추가 — 즉 '함수 1곳'이 아니라 최소 3표면 변경 필요.
- **확증:**
  - choice-id.ts:39 — 파라미터 타입이 `{ readonly JWT_SECRET?: string }` 로 좁게 고정 → CHOICE_ID_SECRET 접근 불가, 타입 확장 선행 필수
  - routes.ts:52-62 PublicRouteBindings 에 JWT_SECRET?만 존재, CHOICE_ID_SECRET 필드 부재 → c.env.CHOICE_ID_SECRET 는 현재 타입상 없음
  - index.ts:51-74 Bindings 타입에도 CHOICE_ID_SECRET 미선언 → 런타임 주입 위한 wrangler 바인딩+타입 양쪽 추가 필요
- **반론:** 주석의 핵심 의도(secret 해석 로직의 '분기·해석' 지점을 1곳으로 모았다)는 정확하고 호출부가 실제로 zero-touch 인 것도 맞다 — '1곳만'을 로직 표면 한정으로 읽으면 과장이 아니다. 타입/바인딩 추가는 어떤 새 env var 도입에도 공통인 기계적 작업이라 seam 가치를 훼손하지 않음. 코드 결함이 아닌 문구 정밀도 nit 수준.
- **제안 수정:** 선택 — 주석을 '해석 로직은 이 함수 1곳 + 파라미터 타입/PublicRouteBindings/wrangler 바인딩에 CHOICE_ID_SECRET 추가'로 미세 보정하거나, 그대로 두되 리뷰 기록에 전환 표면 3곳을 남긴다(무해).

### MINOR-4 (Advocate) — secret-rotation.md 런북이 D-22 seam 중앙화와 미동기 (JWT_SECRET 재사용 위치 line 참조 stale + §7-1 전제조건이 이미 충족됨을 미반영)

- **파일:** `docs/runbooks/secret-rotation.md` (line 20-22, 143-145)
- **상세:** 이 리팩터는 choiceId HMAC secret 해석을 3개 핸들러 인라인(`c.env.JWT_SECRET ?? ''`)에서 choice-id.ts:39-41 단일 헬퍼로 중앙화했다. 그런데 스코프에 포함된 운영 런북 secret-rotation.md 는 이 변경 이전 상태를 서술한다: (1) §0 line 21-22 는 여전히 `apps/api/src/public/routes.ts:338,436,571 — 별도 CHOICE_ID_SECRET 부재`로 JWT_SECRET 재사용이 routes.ts 3곳 인라인에 있다고 명시하나, 리팩터 후 그 3곳은 `resolvePublicChoiceSecret(c.env)` 호출(343/441/576)로 바뀌었고 실제 `?? ''` seam 은 choice-id.ts:40 단일점으로 이동했다. (2) §7-1(143-145)은 CHOICE_ID_SECRET 분리를 '미래 carry-over'로 권고하나, 이 리팩터의 명시 목적이 바로 그 zero-touch seam 확보였다 — 이제 분리 시 choice-id.ts:40 1줄만 바꾸면 되는 seam 이 실재하는데 런북은 이를 반영하지 않아, on-call/유지보수자가 런북만 읽으면 seam 존재를 모른다. 순수 문서 드리프트로 런타임 영향 0, 보고만.
- **확증:**
  - routes.ts:343 — `const secret = resolvePublicChoiceSecret(c.env);` (serve), 441(grade), 576(reveal) 3곳 모두 헬퍼 경유 — 인라인 `JWT_SECRET ?? ''` 부재
  - choice-id.ts:39-41 — resolvePublicChoiceSecret 이 `env.JWT_SECRET ?? ''` 반환 = 유일 seam 지점(단일 진실원)
  - secret-rotation.md:21-22 — `routes.ts:338,436,571 — 별도 CHOICE_ID_SECRET 부재` 서술이 리팩터 후 실제 위치(choice-id.ts:40)와 불일치
  - secret-rotation.md:53 — D-17 defect 위치를 `public/routes.ts:443-455` 로 인용하나 현재 발행 블록은 routes.ts:448-461 로 시프트
- **반론:** 런북 line 참조는 원래 근사치이고 문서는 코드와 별도 수명주기라 매 리팩터마다 동기화 안 하는 게 관행일 수 있으나, 이 문서는 새벽 on-call 이 secret 회전 blast radius 를 판단하는 운영 문서이고 리팩터가 바로 §7-1 권고를 구현 가능케 한 seam 을 만든 것이라 '위치가 어디냐'가 실제 대응 정확도에 직결. 다만 choiceId 동작·회전 blast radius(§2.2)는 여전히 정확하므로 오판 유발 수준 아님 → MINOR 타당.

### MINOR-5 (Contract) — secret-rotation.md 인라인 코드 참조가 D-22 라인 시프트로 stale (338/436/571 → 343/441/576, 443-455 → 448-462)

- **파일:** `docs/runbooks/secret-rotation.md` (line 22, 53)
- **상세:** D-22 리팩터가 choice-id 임포트를 1줄에서 6줄 멀티라인(routes.ts:44-49)으로 바꾸면서 그 아래 전 라인이 +5 시프트됐다. 그러나 in-scope 인 secret-rotation.md 는 리팩터 전 라인 번호를 그대로 참조한다: (1) line 22 '설계 관측' = `routes.ts:338,436,571` 이나 실제 secret 해석 호출부는 343/441/576. (2) line 53 §2.2 = `routes.ts:443-455` 이나 실제 choice_id_unresolved defect 블록은 448-462. 더 근본적으로 line 20-22 §7 권고는 '공개 choiceId 가 3개 흩어진 사이트에서 JWT_SECRET 재사용, 별도 CHOICE_ID_SECRET 부재'라고 서술하는데 — D-22 가 이미 그 분리용 단일 seam(choice-id.ts:39 resolvePublicChoiceSecret)을 구축했으므로 '흩어진 3 사이트' 서술 자체가 outdated. 코드 동작은 byte-identical 로 무결(Silent Pivot 아님) — 순수 문서 드리프트.
- **확증:**
  - routes.ts:343 — serve `const secret = resolvePublicChoiceSecret(c.env);` (runbook:22 은 338)
  - routes.ts:441 — grade 동일 호출 (runbook:22 은 436)
  - routes.ts:576 — reveal 동일 호출 (runbook:22 은 571) = 일관 +5 시프트
  - routes.ts:448-462 — choice_id_unresolved defect 발행 블록 (runbook:53 은 443-455)
  - secret-rotation.md:143-145 — §7 item1 'CHOICE_ID_SECRET 분리, 폴백=JWT_SECRET' 은 choice-id.ts:36 seam(`env.CHOICE_ID_SECRET ?? env.JWT_SECRET ?? ''`)로 이미 부분 이행됨
- **반론:** 'runbook 은 사람이 읽는 산문, ±5줄은 무해'라 반박할 수 있으나 — 이 runbook 의 정확한 사용 시점은 secret 회전 라이브 인시던트(§4 on-call 대응)다. 회전 직후 스파이크를 조사하려 routes.ts:436 으로 점프하면 parseMcChoices 계약 블록 한복판에 착지해 secret 해석부(441)를 놓치고, §7 을 읽은 담당자는 '3곳 흩어짐'이라 믿고 seam 이 이미 있는데 재구축하려 든다 = 인시던트 시간 낭비. 리팩터가 건드린 파일이 참조 대상이고 runbook 도 in-scope 이므로 라인 갱신(또는 choice-id.ts:39 단일 seam 으로 리다이렉트)이 리팩터 범위에 포함됐어야 한다.
- **제안 수정:** secret-rotation.md:22 참조를 routes.ts:343,441,576 으로 갱신하고, §7 item1 에 '2026-07-14 D-22 로 단일 seam resolvePublicChoiceSecret(choice-id.ts:39) 확보 — 분리 시 이 함수 1곳만 개정'을 추가해 흩어짐 서술을 정정. line 53 은 448-462 로 갱신.

---

## 판정

**완료 가능** — 4-Pass 전 Pass CRITICAL 0건. 확정 발견 5건 전부 MINOR(순수 문서 드리프트, `secret-rotation.md` 런북 stale + seam 주석 정밀도). 런타임·배포·채점 동작 byte-identical 로 무결(Silent Pivot 없음). MINOR 5건은 런북 후속 동기화 시 일괄 반영 권고(코드 변경 불요).
