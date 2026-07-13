# 4-Pass 리뷰 보고서 — 공개 무인증 채점 정합성 신호(choice_id_unresolved) 추가

- **타임스탬프:** 20260713-104323
- **리뷰 방식:** 독립 에이전트 5개(scope / Surgeon / Architect / Advocate / Contract) + 발견별 적대적 반증
- **판정:** 완료 가능 (CRITICAL 0 / MAJOR 0 / MINOR 6)

## 스코프

- **변경 파일 (3):**
  - `apps/api/src/public/routes.ts`
  - `apps/api/src/public/analytics.ts`
  - `apps/api/src/public/__tests__/routes.test.ts`
- **연관 파일 (1):**
  - `apps/api/src/public/choice-id.ts` (resolveChoiceId/submittedIndex null 반환 계약 + HMAC 복원 로직 = 발행 조건 진앙)
- **요약:** 공개 무인증 채점 경로(routes.ts POST grade, MC 분기)에서 `resolveChoiceId` 가 `submittedIndex=null` 을 반환할 때(secret 회전·choiceId 위조·손상) `recordPublicEvent 'defect' + defectReason 'choice_id_unresolved'` 를 발행하도록 12줄 추가 — 무음 오채점을 텔레메트리로 관측 가능하게 만든 정합성 신호(콘텐츠 422 결함율과 분리 버킷). `isCorrect` 채점 로직(null→false)은 불변, AE 는 fire-and-forget(바인딩 없으면 no-op). analytics.ts 는 defectReason JSDoc 에 정합성 신호 분리 명시(4줄), routes.test.ts 는 null 경로 발행 검증 + 정상 채점 미발행 거짓양성 차단 테스트 2건 신규(50줄). 실배포 미수행.

---

── 4-PASS REVIEW ──────────────────
리뷰 방식: 독립 에이전트 5개(scope/Surgeon/Architect/Advocate/Contract) + 발견별 적대적 반증
리뷰 범위: 변경 파일 3개 + 연관 파일 1개 (routes.ts, analytics.ts, routes.test.ts + choice-id.ts)

## Pass 1 (Surgeon): ✅ 7건 확인 / 🔴 0건 / 🟠 1건 / N/A 3건

**관점: "이 코드 단독으로 터지는 경로가 있는가?"**

확인:

- PASS — routes.ts:437-442 resolveChoiceId await 정상, D1 first()/all() 전부 await(routes.ts:319,390,530), issueChoiceId await(routes.ts:459,571): Async 누락 크래시 경로 없음
- PASS — routes.ts:448 recordPublicEvent 는 analytics.ts:47 동기 void 함수(내부 writeDataPoint fire-and-forget) → await 불요가 정확, 미await 로 인한 부동 Promise·미처리 rejection 없음(analytics.ts:68 catch 로 봉인)
- PASS — routes.ts:455 submittedIndex null→isCorrect false 채점 불변 확인, null 이 mc.correctOriginalIndices.has() 에 전달되기 전 `!== null` 가드로 차단(NaN·undefined 미도달)
- PASS — analytics.ts:52 `if (ae === undefined) return` no-op + analytics.ts:59,62,64 null/undefined 좌표 전부 `?? ''` 폴백: row.subject null(routes.ts:449) 안전 처리, 크래시 없음
- PASS — analytics.ts:68-71 catch 는 console.warn 로깅(빈 catch 아님, 무음 삭제 금지 준수), AE 실패가 학습 응답 흐름 차단 안 함
- PASS — choice-id.ts:96 길이 가드 + 97-101 루프 매칭 후 null 반환 = 위조/손상 방어 계약 정합, routes.ts:418 choiceId===undefined 는 resolveChoiceId 도달 전 400 차단(undefined 미전달)
- PASS — routes.test.ts:268-283 null 경로 defect 발행 1건 검증 + 285-292 정상 채점 미발행(거짓양성 차단) 검증, blob[5] 레이아웃(analytics.ts:63)과 테스트 인덱싱 정합 확인
- N/A — Formula Engine 동적 코드 실행: 본 변경 경로에 math.js·수식 연산 없음(공개 채점은 parseMcChoices/gradeFillBlank 문자열 매칭만, routes.ts:421,485)
- N/A — 산식 부동소수점·numeric_value vs value 혼용: 본 스코프에 수치 산식 계산 부재
- N/A — 빈 배열/노드 0건 경계: choice_id_unresolved 경로는 mc.ok 보장 후(routes.ts:421-435) 진입, originalTexts 비어있음 불가

반론 (Devil's Advocate):

- 🟠 MINOR — choice_id_unresolved 버킷이 secret 회전 신호와 단순 위조·stale·잘못된 길이 choiceId 노이즈를 동일 버킷에 혼입 (routes.ts:443-454). resolveChoiceId 는 (1) 길이≠24(choice-id.ts:96, GradeBodySchema 는 max 64 허용 → 5·30자 등 통과), (2) HMAC 미매칭(위조·타 문항·stale 캐시), (3) secret 회전 = 세 원인 모두 null 을 반환하는데 routes.ts:448 은 이 셋을 구분 없이 단일 defectReason 으로 발행. 공격자가 무작위 24-hex 를 스팸하거나 구버전 클라가 stale choiceId 를 다수 제출하면 정합성 지표가 인위 상승해 실제 secret 회전 인시던트 스파이크를 모방·희석 가능. 코드 주석(routes.ts:444-447)이 이미 인지·수용한 트레이드오프이며 rate-limit(routes.ts:208-222)이 스팸 속도를 완화. 크래시·오채점 경로 아님(isCorrect 는 정상적으로 false).
  - 반증 검토: secret 회전 시 전 MC 채점이 한꺼번에 이 버킷으로 쏟아지는 반면 위조·stale 은 산발적이라 절대량·기울기로 구분 가능하다는 반론이 성립하나, 저트래픽 홍보 초기에는 소수의 봇 스팸이 회전 스파이크와 유사한 곡선을 만들 수 있어 알람 임계 설정 시 오탐 가능. 다만 이는 대시보드 임계·버킷 세분화로 해결할 관측 정책 사안이며, 본 채점 경로의 정답 정확성·크래시 안전성에는 영향 0. → MINOR 확정.

## Pass 2 (Architect): ✅ 6건 확인 / 🔴 0건 / 🟠 3건 / N/A 5건

**관점: "이 코드가 다른 모듈과 만나면 터지는가?"**

확인:

- PASS — Import 방향 단방향: routes.ts:42-45 는 @thepick/shared·@thepick/learning-modes·로컬 ./analytics·./choice-id 만 임포트, analytics.ts·choice-id.ts 는 외부 import 0. 역방향 의존·순환 없음
- PASS — 제어흐름 불변 확인: routes.ts:443-454 defect 발행은 fire-and-forget(반환 무시), :455 isCorrect 계산·:495 grade 이벤트·:511 200 응답 경로 모두 이전과 동일. null→false 채점 로직(:455) 무변경 = 스코프 주장('isCorrect 불변') 실코드 확증
- PASS — Workers 제약: crypto.subtle(choice-id.ts:48,73)·crypto.getRandomValues(routes.ts:137) = Workers-safe. fs/path 미사용. hmacKeyCache(choice-id.ts:43) 는 keyMaterial 극소(운영1+폴백1)로 무한성장 없음. defect 발행은 writeDataPoint 1회 = CPU 무시가능
- PASS — 빈 catch/stub/TODO 없음: analytics.ts:68-71 catch 는 console.warn 로깅(무음 아님), routes.ts 신규 12줄에 stub/placeholder/TODO 0. 신규 코드 전부 실 로직
- PASS — blob 레이아웃 정합: analytics.ts:56-65 [kind,subject,round,inputType,examType,defectReason] 인덱스 0-5, 테스트 routes.test.ts:279-282 가 blobs[0]==='defect' && blobs[5]==='choice_id_unresolved' 로 정확히 검증. doubles[0]=-1(defect 는 isCorrect 미전달, analytics.ts:66) 정합
- PASS — 이중 이벤트 발행 의도 확인: 미복원 choiceId 는 defect(indexes:['defect']) + grade(indexes:['grade'], isCorrect=false) 두 이벤트 발행 — indexes 분리 버킷이라 집계 시 구분 가능. 콘텐츠 결함(422→return, grade 미도달)과 달리 정합성 신호는 채점 계속(200) 후 grade 도 발행 = 설계 의도(회전 시 정답률 오염을 defect 로 교차진단)와 일치
- N/A — Ontology Lock: 본 변경은 knowledge_nodes/edges ID 생성 0(콘텐츠 무접촉, 텔레메트리·채점만). ontology-registry.json 무관
- N/A — truth_weight 정렬(LAW>FORMULA>CONCEPT): 공개 채점 표면에 RAG 결과 LLM 주입 경로 없음. routes.ts 전수 검토 결과 랭킹·정렬 로직 부재
- N/A — Temporal Graph(UPDATE→INSERT+SUPERSEDES): 본 경로는 exam_questions SELECT 전용(routes.ts:390-397,530-537), UPDATE·INSERT 0. user_progress 기록 0(G-1, routes.ts:15)
- N/A — IndexedDB↔D1 동기화: 무인증 공개 표면은 클라 로컬 진도·오프라인 큐 미사용(G-1 무상태). 동기화 경로 부재
- N/A — D1 스키마 변경: 마이그레이션·컬럼 추가 0. GradeRow(routes.ts:80-87) shape 는 기존 SELECT 컬럼과 일치, 변경 없음
- PASS — i18n: 신규 문자열(defectReason 'choice_id_unresolved', analytics.ts JSDoc)은 내부 텔레메트리 식별자·주석 = 사용자 비노출. 에러코드 'QUESTION_NOT_GRADABLE' 등은 기존 코드 상수. 신규 한국어 사용자노출 하드코딩 0

반론 (Devil's Advocate):

- 🟠 MINOR — choice_id_unresolved 가 length-mismatch 쓰레기와 valid-length-unmatched(진짜 stale/회전 신호)를 한 버킷으로 병합 → 인시던트 신호 희석 (choice-id.ts:96,101 + routes.ts:443-453). resolveChoiceId 두 경로: (a) choice-id.ts:96 length≠24 조기 반환 = 명백한 위조/쓰레기, (b) choice-id.ts:101 루프 소진 = 정상 길이이나 매칭 불가 = 진짜 관측 대상. routes.ts:443 은 둘을 구분 없이 발행 → 길이 불일치 쓰레기가 진짜 회전 신호를 희석.
  - 반증 검토: rate limit(60/min)이 쓰레기 유입을 제한하나 다수 IP 분산 공격 시 length-mismatch 쓰레기만으로 회전 인시던트 오탐 스파이크를 인위 생성 가능. → MINOR 확정. 권고: resolveChoiceId 반환을 `{index}|{reason:'malformed'|'unmatched'}` 로 세분화하거나 routes.ts 에서 choiceId.length 선검사해 'choice_id_malformed' vs 'choice_id_unresolved' 분리 발행.
- 🟠 MINOR — defect(choice_id_unresolved)를 유효 문항의 subject/inputType 차원에 귀속 → 'subject별 결함율' 대시보드 오귀속 위험 (routes.ts:448-453 + analytics.ts:38). choice_id_unresolved 는 문항 콘텐츠가 아니라 choiceId(HMAC 서명) 문제인데 row.subject·inputType 을 그대로 blob 에 실어 발행. defectReason 별 버킷팅을 안 하는 소비자는 정합성 신호를 콘텐츠 결함과 섞어 과목 품질 왜곡 진단.
  - 반증 검토: subject 를 실어야 '어느 과목 채점이 회전 영향을 받았나' 진단 가능하므로 차원 자체는 유용. 그러나 소비자가 defectReason 을 분리하지 않으면 콘텐츠 결함율 지표가 오염 — 규약 문서(analytics.ts:34-36)가 유일 방어선. → MINOR 확정. 권고: indexes 에 defectReason 카테고리 포함하거나 정합성 신호를 별도 event kind('integrity')로 분리.
- 🟠 MINOR — 거짓양성 차단 테스트가 '정답 유효 choiceId' 경로만 커버 — '오답이지만 유효 choiceId' 경로 미검증 (routes.test.ts:285-292). D-17 테스트는 정답 위치(index 1) 유효 choiceId 만 제출해 미발행 확인. 발행 조건은 submittedIndex===null(routes.ts:443)이지 isCorrect 가 아니므로 오답-유효 경로도 defect 를 발행하면 안 되는데 AE 캡처로 미검증. 미래에 조건이 `!isCorrect` 로 잘못 리팩터되면 정상 오답 채점이 전부 무음 오채점으로 오분류되나 현 스위트는 통과.
  - 반증 검토: 현 구현은 submittedIndex 기준이라 오답-유효 경로는 실제로 발행 안 함(이미 안전). 그러나 규칙3(테스트 통과=안전 가정 금지) 관점에서 발행 조건과 채점 정오의 독립성을 고정하는 회귀 가드 부재. → MINOR 확정. 권고: 오답-유효 choiceId(index 0)를 postAE 로 제출해 미발행 + grade(isCorrect=false) 발행을 함께 assert 하는 케이스 1건 추가.

## Pass 3 (Advocate): ✅ 8건 확인 / 🔴 0건 / 🟠 1건 / N/A 4건

**관점: "수험생과 공격자, 둘 다 만족하는가?"**

확인:

- PASS 보안(PII 0): defect 이벤트는 subject/inputType/examType + 리터럴 defectReason 만 기록, userId·IP·정답텍스트·choiceId 미기록 — routes.ts:448-453 + analytics.ts:54-67 blob 레이아웃 확인
- PASS 보안(신규 정답유출 0): 위조 choiceId 경로도 correctAnswer/correctChoiceIds 를 반환하나 이는 기존 F-3 설계(choice-id.ts:20-22 '정답은 어차피 드립 노출')로 본 변경이 새 노출 표면을 만들지 않음 — routes.ts:456-460 unchanged
- PASS 정답 안전(채점 불변): isCorrect null→false 로직(routes.ts:455) 및 mc.correctOriginalIndices.has 판정 동일, 위조 choiceId→false 테스트(routes.test.ts:258-266) 미변경 통과 = 오채점 유발 0
- PASS 보안(XSS/injection): defectReason 은 하드코딩 리터럴 'choice_id_unresolved'(routes.ts:452), AE blobs 는 불투명 저장·이 백엔드 경로에서 HTML 렌더 없음 — analytics.ts:54-65
- PASS 에러처리(빈 catch 0): AE writeDataPoint 실패는 console.warn 로 로깅(무음 금지) — analytics.ts:68-71, 빈 catch/TODO/stub 없음
- PASS 비차단성(fire-and-forget): recordPublicEvent 는 void·await 없음, ae===undefined 시 no-op(analytics.ts:52) → 채점 응답 흐름 영향 0
- PASS 입력검증: GradeBodySchema choiceId max(64)(routes.ts:95) + resolveChoiceId 길이 가드 24 불일치 즉시 null(choice-id.ts:96) = 오버플로 방어
- PASS 테스트(거짓양성 차단): 정상 복원 채점이 choice_id_unresolved 미발행 + grade 이벤트 발행 검증 — routes.test.ts:285-292
- N/A 접근성(터치44px/키보드/aria-label): 스코프 4파일 전부 apps/api 백엔드 — 프론트 UI 요소 없음
- N/A 오프라인(Service Worker 캐싱): 스코프 내 SW/PWA 코드 없음(백엔드 JSON 라우트·HMAC·AE만)
- N/A 상태표현 UI(로딩/빈데이터/에러 화면): 백엔드는 JSON+HTTP 상태코드만 반환(overview 빈배열 200·grade 404/422 routes.ts:403-408), 화면 표현은 프론트(스코프 외)
- N/A 에러 UX '교재 O장 참고' Graceful: 무인증 학습 표면은 에러 코드 문자열 반환(ErrorCode.\*), 교재 안내 카피는 프론트 렌더 계층 소관(스코프 외)

반론 (Devil's Advocate):

- 🟠 MINOR — secret 회전 구간에서 정당한 수험생의 정답이 무음 '오답' 처리 — 관측만 추가, 사용자 복구 경로 없음(설계상 out-of-scope) (routes.ts:443-455). JWT_SECRET 이 서빙→채점 사이 회전하면 정당한 정답 choiceId 가 null 로 복원되어 isCorrect=false(routes.ts:455)가 되고, 수험생은 실제 정답에 대해 '오답' + correctAnswer 를 보되 '새로고침 후 재시도' 안내가 없다. 이번 변경은 운영자 관측성만 추가했고 사용자 대면 복구는 다루지 않음(스코프상 isCorrect 로직 불변 = 의도적).
  - 반증 검토: secret 회전은 배포 시점에만 발생하는 희소 이벤트이고 choice-id 는 날짜 무의존(자정 재셔플 0)이라 상시 트리거가 없다. correctChoiceIds·correctAnswer 가 함께 노출되므로 눈썰미 있는 사용자는 자기 선택과 정답 불일치를 인지 가능. 빈도·심각도 모두 낮아 MINOR. → 확정. 권고(선택·별건): 이전 secret 을 한시 병행 검증(dual-key resolveChoiceId)하거나 회전 직후 짧은 창 동안 미복원 시 '문항을 새로 불러오세요' 소프트 힌트 반환. 이번 텔레메트리 변경 스코프 밖 — carry-over 기록만.

## Pass 4 (Contract): ✅ 8건 확인 / 🔴 0건 / 🟠 1건 / N/A 3건

**관점: "구현 스코프 명세대로 만들었는가? (Silent Pivot 탐지)"**

확인:

- PASS Silent Pivot 없음 — routes.ts:414,455 채점 로직 isCorrect(null→false) 불변, 응답 계약 PublicGradeResult(routes.ts:505-510) satisfies 유지, 변경은 텔레메트리 12줄 additive(443-454)뿐. 스코프 명세와 정합
- PASS PII 0 Hard Limit 유지 — routes.ts:448-453 defect 이벤트는 subject/inputType/examType/defectReason 만 기록, questionId·정답 텍스트 미기록. analytics.ts:7,32 'PII 0·문항 id 미기록(로그에서)' 계약과 일치
- PASS user_progress·knowledge_nodes/formulas 미접촉 — 변경 4파일 어디에도 해당 테이블 write 없음(routes.ts 는 exam_questions SELECT-only, G-1 서버 user 데이터 0 계약 준수)
- PASS 빈 catch/stub/TODO 0 — analytics.ts:68-71 catch 는 console.warn 로깅 후 no-op(무음 금지 정책 명시), routes.ts try/catch(398-401,538-541) 전부 logger.error+응답. placeholder/TODO 검색 0건
- PASS 네이밍 컨벤션 정합 — defectReason 'choice_id_unresolved'(routes.ts:452)가 기존 버킷 'serve_build_failed'(349)/'grade_mc_contract:_'(432)/'mc_in_disguise_or_numeric_short_answer'(481)/'reveal_mc_contract:_'(564)와 동일 snake_case 네임스페이스 규약. AE 블롭 cardinality 유한
- PASS fire-and-forget 계약 — analytics.ts:52 ae===undefined 시 no-op, recordPublicEvent 반환 void(routes.ts 발행부 바인딩 미주입 시 채점 영향 0). 스코프 명세 'AE 는 fire-and-forget' 일치
- PASS resolveChoiceId null 계약 진앙 확인 — choice-id.ts:96(길이 불일치) 및 101(매칭 실패) 두 경로 모두 null 반환 = routes.ts:443 발행 트리거. HMAC 복원 로직(90-102) 무상태·결정성, 위조/손상/회전 시 null 계약 정확
- PASS 테스트 발행/거짓양성 검증 — routes.test.ts:268-283 은 24-hex 미매칭 choiceId 로 resolve-null 진성 경로(길이가드 우회) 후 defect 정확히 1건 단언, 285-292 는 정상 복원 시 미발행+grade 발행 단언. 거짓양성 차단 커버
- N/A Hard Rule 15/16/17(멀티시험 격리) — 대상은 apps/api(범용 계층 packages/ 아님). FIXED_EXAM_TYPE='1st'(routes.ts:60)은 exam_type 컬럼값(exam_id 리터럴 아님) → Rule 17 대상 축 무관
- N/A constants↔교재 원문 수치 대조 — 본 변경셋에 수치 상수·임계값 신규 도입 0(choice-id.ts:26 CHOICE_ID_HEX_LENGTH=24 는 기존, 변경 무관). Formula/Constants DB 미접촉
- N/A BATCH 순차 검증 — 본 변경은 콘텐츠 적재(BATCH N) 경로 아님, 무음 오채점 관측 텔레메트리라 배치 게이트 무관

반론 (Devil's Advocate):

- 🟠 MINOR — choice_id_unresolved 정합성 신호가 발행돼도 동일 요청이 'grade'(isCorrect=false) 이벤트를 함께 발행 — 정답률 지표에 무음 오답이 계속 편입(정합성 신호가 정답률 버킷에서 격리 안 됨) (routes.ts:443-500). submittedIndex===null 경로(443-454)에서 defect 발행 뒤 return 없이 흘러 isCorrect=false(455)로 채점 이어가 495행 'grade' 이벤트를 추가 발행. grade 이벤트 blob 에는 defectReason 이 실리지 않으므로(호출측 미전달 → 빈문자열) 과목별 정답률 소비자는 '진짜 오답'과 '복원 불능(무음 오답화)'을 구분·제외할 in-band 수단이 없다. 이 double-emission 자체는 본 변경 이전부터 존재(변경은 defect 신호를 '추가'만 함)하므로 회귀는 아니나 규칙1(전체범위·연관산출물 누적검증)상 정합성 신호 도입으로 드러난 지표 계약 미봉점으로 기록. 채점 결과(200, PublicGradeResult, null→false)는 스코프 명세대로 불변이라 Silent Pivot 아님.
  - 반증 검토: 실제로 깨지는 시나리오 — JWT_SECRET 회전 순간 회전 이전 서빙된 choiceId 로 제출되는 모든 채점이 복원 불능 → 대량의 grade(isCorrect=false)가 발행되어 그 시간창 과목별 정답률이 인위적으로 급락. 운영자는 defect 스파이크로 인시던트는 감지하나 정답률 대시보드는 이미 오염. 반대 논거: 발행 계약상 defect·grade 는 별도 kind 라 소비 쿼리에서 조인/차감 가능하고, 회전은 드문 운영 이벤트이며 grade 계속 발행은 '학습 응답 연속성' 관점에선 의도된 동작일 수 있음 → CRITICAL/MAJOR 아님. → MINOR 확정. 권고: analytics.ts JSDoc 에 'grade 버킷은 정합성 실패를 포함할 수 있음' 계약을 명시하거나 unresolved 경로에서 grade 이벤트에 식별 차원을 실어 정답률 집계 제외를 in-band 로 가능하게 함. 채점 응답(200/null→false)은 불변 유지.

판정: 완료 가능 (CRITICAL 0 / MAJOR 0 / MINOR 6)
────────────────────────────────────

## 확정 발견 요약 (반증 통과분만)

| #   | 심각도 | Pass      | 제목                                                                                              | 위치                                    |
| --- | ------ | --------- | ------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 1   | MINOR  | Surgeon   | choice_id_unresolved 버킷이 secret 회전 신호와 위조·stale·잘못된 길이 노이즈를 동일 버킷에 혼입   | routes.ts:443-454                       |
| 2   | MINOR  | Architect | length-mismatch 쓰레기와 valid-length-unmatched(진짜 회전 신호) 병합 → 인시던트 신호 희석         | choice-id.ts:96,101 + routes.ts:443-453 |
| 3   | MINOR  | Architect | defect 를 유효 문항의 subject/inputType 차원에 귀속 → 'subject별 결함율' 오귀속 위험              | routes.ts:448-453 + analytics.ts:38     |
| 4   | MINOR  | Architect | 거짓양성 차단 테스트가 '정답 유효' 경로만 커버 — '오답이지만 유효' 경로 미검증                    | routes.test.ts:285-292                  |
| 5   | MINOR  | Advocate  | secret 회전 구간 정당 수험생 정답이 무음 '오답' 처리 — 사용자 복구 경로 없음(설계상 out-of-scope) | routes.ts:443-455                       |
| 6   | MINOR  | Contract  | defect 발행돼도 동일 요청이 'grade'(isCorrect=false) 함께 발행 → 정답률 버킷에 무음 오답 편입     | routes.ts:443-500                       |

**CRITICAL 0 / MAJOR 0 → "완료 가능"**

MINOR 6건은 전부 관측 정책·지표 계약·테스트 커버리지 개선 권고이며, 본 변경의 정답 정확성·크래시 안전성·채점 계약(null→false 불변)에는 영향 0. carry-over 로 기록.
