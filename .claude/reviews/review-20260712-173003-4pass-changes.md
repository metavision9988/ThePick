# 4-Pass 독립 리뷰 — 0044 old-rows retirement 집행분 (적용 직전 최종 리뷰)

- **일시**: 2026-07-12 17:30:03
- **리뷰 방식**: 독립 에이전트 5개(scope/Surgeon/Architect/Advocate/Contract) + 발견별 적대적 반증
- **판정**: CRITICAL 0 / MAJOR 5 / MINOR 15 → **완료 가능** (MAJOR 는 production 적용 전 해소 또는 명시 이월 의무 — auto-review-protocol §"완료 선언 기준")

## 리뷰 스코프

production exam_questions 의 1차 old 행 525건(`exam_type='1st' AND input_type='fill_blank' AND id NOT LIKE '%-MC'`)을 상태 전이시키는 마이그레이션 0044(트리거 브래킷: DROP → UPDATE 전이 → 0038 원문 트리거 byte-동일 재생성) + LIFO 롤백 런북 + Binary Gate 검산 스크립트(G-OLD-1~5, answer-corrections.json 36교정/4제외 신뢰 경계) + all-migrations 하네스 전이 6케이스 테스트 + plan §9 결재 기록 12줄. 정답 100% Hard Stop 직결의 production D1 데이터 처분.

**변경 파일 5개**:

- `migrations/0044_exam_questions_old_rows_retirement.sql`
- `docs/runbooks/migration-rollback/0044_rollback.sql`
- `scripts/verify-old-rows-retirement.mjs`
- `apps/api/src/__tests__/scenarios/migration-0044-old-rows-retirement.test.ts`
- `docs/plans/old-rows-retirement-0044.plan.md`

**연관 파일 18개**:

migrations/0038·0004·0010·0013·0018·0032·0037, apps/api/src/\_\_tests\_\_/scenarios/migration-0038-metadata-update.test.ts, apps/api/src/\_\_tests\_\_/helpers/d1-from-sqlite.ts, apps/api/src/db/schema.ts, apps/api/src/public/routes.ts, apps/api/src/study/routes.ts, apps/api/src/search/user-search.ts, apps/api/src/eval/multihop-accuracy.ts, apps/api/wrangler.toml, docs/batch-load/promo-mc-distractors/answer-corrections.json, docs/audit/incident-1st-answer-errors-20260710.md, docs/runbooks/migration-rollback/0026_rollback.sql

---

── 4-PASS REVIEW ──────────────────
리뷰 방식: 독립 에이전트 5개 (scope + Surgeon/Architect/Advocate/Contract) + 발견별 적대적 반증
리뷰 범위: 변경 파일 5개 + 연관 파일 18개 (상기 목록)

**Pass 1 (Surgeon): ✅ 19건 확인 / 🔴 0건 / 🟠 1건 / N/A 4건** (MINOR 4건 별도)
확인 (대표, 전수는 §부록 A):

- migrations/0044:44-66 == migrations/0038:42-64 — 재생성 트리거 본문 byte-동일 수동 대조(WHEN 16컬럼 순서·IS NOT 연산자·RAISE 메시지 전문 일치) + 테스트 기계 검증(test:124-132)
- migrations/0044:30-41 — UPDATE 술어 4중(exam_type='1st' AND input_type='fill_blank' AND status='active' AND id NOT LIKE '%-MC')으로 -MC/2차/flagged/기deprecated 무접촉(test:94-104 6케이스 재현) + 멱등성(test:134-143, vitest 직접 실행 6/6 PASS)
- 소비 표면 status='active' 필터 전수 — public/routes.ts:243,291,393,521 + study/routes.ts:945,1126,1608,1614,1622,1632,1644,1674,1841 → deprecated 전이 = 자연 배제, NULL/크래시 경로 없음
- scripts/verify-old-rows-retirement.mjs:57-73,106-110,126-129,145-147 — G-OLD-1 pending 0/36 전수 answer 대조·G-OLD-3 catch = detail 기록 후 FAIL 전파(빈 catch 아님)·G-OLD-4c NULL 4건 정렬 배열 완전일치·실패 시 exit 1

반론: staging G-OLD-4 '짝 실재' 판정이 `COUNT >= 0` 항진식이라 어떤 데이터 상태에서도 PASS — staging 이 부분 -MC 적재 등으로 드리프트하면 무음 통과(→ MAJOR-1). 또한 verify d1() 의 `out.indexOf('[')` JSON 파싱은 wrangler 배너 출력에 취약하나 실패 방향이 크래시(fail-loud)라 무음 오판정은 없음.

**Pass 2 (Architect): ✅ 14건 확인 / 🔴 0건 / 🟠 2건 / N/A 3건** (MINOR 5건 별도)
확인 (대표, 전수는 §부록 A):

- 트리거 브래킷 정합: 0044:24-25 가 0038 body 트리거 + 0004 잔존 트리거 양쪽 DROP, 사이 개입 트리거 없음(0041·0042 에 'exam_questions' grep 0건) — pending 번들(0038→0041→0042→0044) 순서에서 0044 UPDATE 를 ABORT 할 제3 트리거 부재
- D1 스키마 일치: schema.ts:71 EXAM_QUESTION_STATUSES == migrations/0001:128 CHECK — 'deprecated' 전이는 신규 값 아님(테이블 재생성 불필요, plan §1 확증). wrangler.toml:144-148/217-221 DB명·migrations_dir == verify:28,42-43 정합
- Temporal Graph 정합: 상태 전이 UPDATE 는 plan §3 PITR(B안 저장프로시저 = SQLite 불가 실증) + §9 Q1 결재로 개방된 의도적 예외 — 본문 8컬럼 불변, superseded_by = INSERT+SUPERSEDES 완결 단계. mav_supersedes 트리거는 knowledge_edges 전용(0013:101-108)이라 오발동 경로 없음
- 테스트 하네스 production 순서 동형: migration-0044 test:28-31 `f < '0044'` readdir 정렬(0041/0042 포함) — wrangler 사전순 적용과 동일 세계에서 전이 재현, 6/6 PASS 실측

반론: 롤백 런북(0044_rollback)이 d1_migrations 부기 삭제 의무(0026 관례) 없이 자체 완결 체크리스트를 갖고 있어 '이 파일만 따르면 된다'는 착시 — 비상 롤백 후 `migrations apply` 무음 no-op 으로 old 525(오답 36 포함) active 잔존 경로(→ MAJOR-2). plan G-OLD-7 은 '로컬 시나리오 테스트로 기계화'라 명시하나 판정 러너·테스트가 레포 어디에도 없음(→ MAJOR-3).

**Pass 3 (Advocate): ✅ 16건 확인 / 🔴 0건 / 🟠 1건 / N/A 2건** (MINOR 3건 별도)
확인 (대표, 전수는 §부록 A):

- 정답 안전(Hard Stop) 3중: 0044:30-41 UPDATE 는 answer·content 무접촉 / verify:60-69 G-OLD-1d 가 -MC answer == corrected 36/36 을 pre·post 양 시점 기계 검산 / answer-corrections.json corrections 36·exclusions 4·pending [] + 전 id 정형·corrected 1~5, node 스크립트로 리뷰 중 직접 실검증
- 트리거 정책 불변: 0044:44-66 == 0038:42-64 == 0044_rollback:19-41 CREATE TRIGGER 본문 byte-동일 — Python 정규식 추출 대조 실행 True/True (ADR-046 default-deny 드리프트 0)
- 에러 UX·빈 데이터: public/routes.ts:403-405 deprecated id /grade = 404 QUESTION_NOT_FOUND 단일 코드(정보 노출 최소) / :254-278 overview 는 servable 필터 후 집계(0건이어도 빈 배열, 크래시 없음)
- 보안: verify:40-44 execFileSync 배열 인자(shell 미경유) + d1-from-sqlite.ts:9-10 prepared SQL API — OS 명령 실행 경로 0 / wrangler.toml:22-31 production secret 하드코딩 0 / 신규 4파일 전수 열람 TODO·stub·빈 catch 0

반론: G-OLD-8(서빙 가드 폐기) 커밋 이후 비상 롤백이 발생하면 old 오답 36행이 active 복귀하는데 코드 차단막(study/routes.ts:926-933 C-1)도 없는 상태 — 이 이중 조건 시나리오의 복구 경로가 런북에 부재(→ MAJOR-4). 롤백 UPDATE 술어도 0044 산(産) 표식 없이 클래스 전체 복귀라 미래 개입 변경 존재 시 과회수.

**Pass 4 (Contract): ✅ 15건 확인 / 🔴 0건 / 🟠 1건 / N/A 3건** (MINOR 3건 별도)
확인 (대표, 전수는 §부록 A):

- 처분 방식 = 결재된 A안과 1:1 — 0044:24-66 ↔ plan §9 Q1 ☑ A안, 대상 술어 plan §1·§4 와 문자 동일 — Silent Pivot 0. 결재 기록 무결: git diff = plan 12줄(STATUS DRAFT→APPROVED + §9 ☐→☑)만, 신규 4파일은 결재 후 실행 순서 준수(2026-05-29 L3 결재 순서 역전 클래스 재발 없음)
- exam_questions UPDATE 트리거 전수 — grep 'UPDATE ON exam_questions' migrations/\*.sql = 0004:40·0038:43·0044:45 뿐, 브래킷 누수 0. 0004 헤더 계약(상태 변경 = 별도 허용 경로)은 B안 불가 실증 + L3 plan 결재로 취지 충족
- Hard Limit 전수 — knowledge_nodes/formulas 무접촉, 동적 코드 실행 0, LLM 수식 계산 0, draft 규칙 N/A(신규 콘텐츠 행 0), .env·Guide/ 무접촉
- 구조훼손 4건 3원 일치 — answer-corrections.json exclusions == plan:76 G-OLD-4 목록 == incident:23. 수치 워터마크: old 525 / -MC 521 / 36교정+4제외 산술 정합

반론: 스크립트 헤더(11-12행)가 staging 판정 대상으로 '교집합 0·짝 실재·active=MC' 3종을 약속하나 실판정은 1종뿐 — '판정한다고 문서화된 게이트가 판정하지 않는' 명세↔구현 드리프트는 이 프로젝트가 반복 차단해온 무음 실패 클래스이며, §6 이 staging 게이트 통과를 불가역 production 적용의 선결 조건으로 삼는 만큼 리허설의 거짓 안심이 된다(→ MAJOR-1/5 와 동근원).

**판정: 완료 가능** (CRITICAL 0. 단, MAJOR 5건은 production 적용 전 즉시 수정 대상 — 특히 verify:131 항진식 1줄 교체와 0044_rollback 헤더 2줄이 수정 비용 대비 효익 최대)
────────────────────────────────────

---

## 확정 발견 (발견별 적대적 반증 통과분) — CRITICAL 0 / MAJOR 5 / MINOR 15

### MAJOR (5)

#### MAJOR-1 [Surgeon] staging G-OLD-4 링크 불변식 체크가 항진식(vacuous) — 절대 FAIL 불가능한 게이트

- **파일**: `scripts/verify-old-rows-retirement.mjs:131`
- **내용**: staging 분기의 G-OLD-4 판정이 `check('G-OLD-4(staging) 링크 불변식(짝 실재)', links.null_links >= 0, ...)` 인데 COUNT(\*) 는 정의상 항상 >= 0 이므로 어떤 데이터 상태에서도 PASS. 스크립트 헤더(:11-12)는 "staging 은 상대 불변식(교집합 0·짝 실재·active=MC)만 판정"이라 명시하나 '짝 실재' 불변식은 실제로 판정되지 않는다. plan §6 은 staging 선적용 + G-OLD 전 게이트 통과를 production 진입 조건으로 삼는데, staging 에서 superseded_by 가 부재/비active 대상을 가리키는(dangling) 행이 있어도 초록불. linked_ok(:120)·null_links(:123)가 이미 계산돼 있어 진짜 상대 불변식 `linked_ok + null_links === snap.old_deprecated` 판정이 즉시 가능.
- **증거**: verify:131 항진 술어 직접 확인 / verify:11-12 헤더 명세↔구현 불일치 / verify:115-123 판정 재료 완비 / plan:86 §6 staging 게이트 = production 진입 조건
- **적대 반증 (반증 실패 — CONFIRMED, MAJOR 유지)**: 마이그 0044:33-37 CASE 가 dangling _id_ 는 구조적으로 차단하나 EXISTS 가 짝의 status='active'/input_type='multiple_choice' 를 검사하지 않아 드리프트한 staging -MC 행(draft/deprecated)은 현 체크가 무음 통과. 다른 staging 체크(G-OLD-4a=status 카운트, G-OLD-5=비MC 카운트)가 링크 해소를 미커버. production G-OLD-4b 하드 검산은 불가역 적용 _이후_ 발화 — 리허설의 존재 이유가 사전 검출. 제안 수정 불변식은 staging 0-MC 상태에서도 정당 PASS(전량 NULL). '판정한다고 문서화된 게이트가 판정하지 않음' = 1급 무음 실패 클래스, 수정 = 기계산값 활용 1줄.
- **수정안**: verify:131 을 `check('G-OLD-4(staging) 링크 불변식(비NULL 링크 전부 active MC 짝 해소)', links.linked_ok + links.null_links === snap.old_deprecated, ...)` 로 교체

#### MAJOR-2 [Architect] 0044_rollback.sql 에 d1_migrations 부기 삭제 의무 누락 — 기존 runbook 규약(0026) 드리프트

- **파일**: `docs/runbooks/migration-rollback/0044_rollback.sql:1-3`
- **내용**: 레포 규약상 down 실행 후 d1_migrations 행 수동 삭제 의무(wrangler 는 forward 만 추적). 0026_rollback.sql:26-27 은 이를 '적용 후 의무 1번'으로 명시하고 migration-rollback.md:143-145·172 도 총칙으로 못박으나, 0044_rollback 은 자체 '실행 후 의무'(G-OLD-2 재실행 + C-1 가드 확인)를 나열하면서 d1_migrations 삭제 언급 0. 또한 :1 이 참조하는 '런북 §2 LIFO'(migration-rollback.md)는 0021~0026 스코프로 작성돼 '0044' grep 0건.
- **증거**: 0026_rollback:26-27 규약 실재 / migration-rollback.md:143-145,172 총칙(DELETE 예시가 002x LIKE 로 하드스코프) / 0044_rollback 전문 41줄 Read — d1_migrations 0건 / migration-rollback.md '0044' 0건
- **적대 반증 (반증 실패 — CONFIRMED, MAJOR 유지)**: 0044 는 wrangler 추적 디렉토리 소속 + migrations apply 경로 확정 = 부기 row 생성 확정(반증 후보 'd1 execute 단발 적용' 기각). plan 어디에도 down 후 부기 삭제 규정 없음(2차 반증 실패). 실패 경로: 비상 롤백 → 파일 내 체크리스트만 이행 → '0044\_%' row 잔존 → 이후 migrations apply 가 0044 를 영구 skip(무음) → 시스템은 적용됨으로 믿는데 old 525(오답 36) active 잔존 → G-OLD-8 가드 폐기 커밋과 결합 시 오답 재서빙(정답 100% Hard Stop 직결). 런북 DELETE 예시·체크리스트의 002x 하드스코프가 오히려 '0044 는 대상 아님' 오독 여지. 발동 조건 저빈도(비상 롤백)라 CRITICAL 승격은 과잉, 무음 오답 재서빙 결과 + 런북 = 운영 산출물이므로 강등도 부적절.
- **수정안**: 0044*rollback 헤더에 `DELETE FROM d1_migrations WHERE name LIKE '0044*%';` 의무 추가 + migration-rollback.md 를 0044(및 번들 0038/0041/0042)로 확장

#### MAJOR-3 [Architect] G-OLD-7 '로컬 시나리오 테스트로 기계화' 미구현 — production 적용 직후 판정 수단 부재

- **파일**: `docs/plans/old-rows-retirement-0044.plan.md:79`
- **내용**: plan §5 G-OLD-7('D-02 전 풀 재조회 fallback 발동 0')은 '로컬 시나리오 테스트로 기계화'를 명시하고 §9 실행 순서는 적용 직후 'G-OLD-4~7' 판정을 요구하나, verify 스크립트는 G-OLD-1·2·3·4·5+트리거 재생성만 구현(:55-143), apps/api/src/\_\_tests\_\_ 전체 grep 'full-pool|oversample|G-OLD-7|D-02' = 0건. 감시 대상 로그(study/routes.ts:964)는 실재하나 기계 판정 러너 부재 → 적용 당일 즉석 자기 판정 또는 게이트 무음 스킵 위험(Binary Gate 원칙 위반).
- **증거**: plan:79 문언 / verify:55-143 구현 게이트 목록에 G-OLD-6·7 부재 / \_\_tests\_\_ grep 0건 / routes.ts:964 로그 실재
- **적대 반증 (반증 실패 — CONFIRMED, MAJOR 유지)**: 신규 시나리오 테스트(migration-0044 test, 144줄)를 잠재 반증 후보로 직접 열람 — 커버 = 전이·백링크·비대상 무접촉·트리거 byte-동일·멱등뿐, /next 서빙·OVERSAMPLE·refetch 미발동 assert 전무. devil's advocate("G-OLD-7 은 G-OLD-5 의 따름정리") 검토: serving-guard.ts isMisgradableRow(:41-49)는 MC 행도 parseMcChoices(distractors) 계약 불능이면 필터링 — G-OLD-5 는 input_type 만 검증하고 distractors 파싱 계약은 어느 게이트도 미검증이므로 엄밀한 따름정리 아님(-MC 521 의 distractors 무결에 추가 의존하는 개연 명제). APPROVED plan 의 Binary Gate 가 판정 도구 없이 남은 채 불가역 시퀀스가 판정을 요구 = CRITICAL RULE 7 직결.
- **수정안**: ① 0044 시나리오 테스트에 /next 서빙 케이스 추가(deprecated 전이 후 OVERSAMPLE 윈도 전건 servable → refetch 로그 경로 미진입 assert, distractors 계약 포함) 또는 ② plan §5 판정 방식을 'production 로그 관측 + G-OLD-5·distractors 계약 도출'로 명시 개정 — ①이 Binary Gate 원칙에 더 정합

#### MAJOR-4 [Advocate] 0044 비상 롤백 런북 불완결 — d1_migrations 원장 처리 누락 + G-OLD-8 이후 롤백 시 오답 36 재서빙 차단막 부재 시나리오 무경로

- **파일**: `docs/runbooks/migration-rollback/0044_rollback.sql:1-3`
- **내용**: (a) d1_migrations 수동 삭제 의무 부재(MAJOR-2 와 동근원) → 롤백 시 DB 실상태(old 525 active, 오답 36 잔존)와 마이그 원장(0044 적용됨) 발산, `migrations apply` = 'no pending' 무음 no-op 으로 표준 재적용 불가. (b) 더 중요: 헤더는 'C-1 가드 존속 확인'만 요구하는데, G-OLD-8(serving-guard/OVERSAMPLE/full-pool 폐기 커밋)이 이미 나간 뒤 비상 롤백이 발생하면 old 오답 36행이 active 복귀 + 코드 차단막(study/routes.ts:926-933)도 없는 상태 = 인증 학습 경로 오답 재서빙 가능. 이 케이스의 복구 경로(가드 재도입 vs 수동 재적용 vs 원장 삭제 후 apply)가 런북에 없음.
- **증거**: 0026_rollback:26-27 관례 / 0044_rollback:1-3 — d1_migrations·가드부재 분기 없음 / plan:80 G-OLD-8 별도 후속 커밋 예정(폐기 후 롤백 창 실재) / routes.ts:926-933 C-1 = 유일 코드 차단막(폐기 대상)
- **적대 반증 (반증 실패 — CONFIRMED, MAJOR 유지)**: 6/6 선행 런북(0021~0026)이 d1_migrations 의무를 명시하는데 0044 만 이탈 = 규약 파괴 확증. 마스터 런북 체크리스트도 0021~0026 하드코딩으로 0044 미커버. devil's advocate 독법(운영자가 0026 선례에서 즉석 유추 / C-1 확인 의무로 충분)은 문서화된 통제가 아님 — 검출은 있되 경로 없는 비상 상황 + 오답 라이브. docs-only + 이중 조건(가드 폐기 후 + 비상 롤백)이라 CRITICAL 아님, 정답 정확성 Hard Stop 인접이라 강등 부적절. 수정 = 헤더 2줄.
- **수정안**: 헤더에 ① `DELETE FROM d1_migrations WHERE name LIKE '0044_%';` 명기 ② 'G-OLD-8 가드 폐기 커밋 이후 롤백 금지 — 필요 시 0044 수동 재적용(wrangler d1 execute --file)이 유일 안전 경로' 분기 1줄 추가

#### MAJOR-5 [Contract] verify 스크립트 staging G-OLD-4 '짝 실재' 판정 항진 — 헤더가 약속한 상대 불변식 3종 중 실판정 미달

- **파일**: `scripts/verify-old-rows-retirement.mjs:131` (헤더 계약: 11-12)
- **내용**: MAJOR-1 과 동일 지점의 계약(Contract) 렌즈 확정판. ① G-OLD-4(staging) = `links.null_links >= 0` 항진(라벨은 '링크 불변식(짝 실재)') — linked_ok=0·null_links=전량이어도 PASS. ② '교집합 0'(plan §5 G-OLD-2 명세, D-30)은 pre/post 어디에도 미구현. 실판정 존재 상대 불변식은 G-OLD-4a·G-OLD-5(staging)뿐. plan §6 이 staging 게이트 통과를 불가역 적용의 선결 리허설로 규정하므로 이름만 있고 판정 없는 게이트 = 리허설 단계의 거짓 안심(게이트 명세↔구현 드리프트).
- **증거**: verify:131 항진 직접 확인 / verify:11-12 3종 명세 / plan:74 '교집합 0 (D-30)' ↔ verify:86-93 pre 분기 부재 / plan:86 §6 선결 조건
- **적대 반증 (반증 실패 — CONFIRMED, MAJOR 유지)**: detail 문자열 가시성은 자동화·§6 시퀀스가 소비하는 PASS 판정/exit-code 를 고치지 못함. 자매 staging 체크는 '리포트만'으로 정직 라벨인데 이것만 '불변식' 라벨로 PASS 를 찍음. staging 분포 상이(-MC 부재 가능, :71)는 하드 분모 포기의 근거일 뿐 판정 포기의 근거가 아님 — 제안 불변식은 분포 무관(전량 NULL staging 도 정당 PASS)이며 dangling superseded_by 를 검출. production G-OLD-4b/4c 는 불가역 UPDATE _후_ 발화 — 리허설의 목적 훼손. Binary Gate 독트린(기계 판정 가능) + L3 불가역 마이그 리허설 게이트 + 수정 1줄 = MAJOR 유지.
- **수정안**: `check('G-OLD-4(staging) dangling 링크 0', links.linked_ok + links.null_links === snap.old_deprecated, ...)` 교체 + '교집합 0'은 corrections↔exclusions disjoint 로컬 검사 + OLD_PRED∩'%-MC' 정의적 0 취지 주석 명문화

### MINOR (15)

| #   | Pass      | 파일:라인               | 요지                                                                                                                                                                                                                                  |
| --- | --------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| m1  | Surgeon   | 0044_rollback.sql:1-3   | 0026 런북 선례 대비 d1_migrations 행 정리 의무 문구 누락(MAJOR-2 의 문구 차원) — 헤더에 '적용 후 의무' 블록 추가 권고                                                                                                                 |
| m2  | Surgeon   | migrations/0044:43      | "G-OLD 게이트가 대조" 주석 과대 서술 — 원격 post 게이트(verify:140-142)는 트리거 name 존재만 확인, byte 대조는 로컬 테스트(파일 간)뿐. 주석 정확화 또는 post 게이트에 sqlite_master.sql 본문 대조 추가                                |
| m3  | Surgeon   | 0044_rollback.sql:9-16  | 롤백 UPDATE 가 valid_until 을 무조건 NULL 재설정 — pre 게이트에 'old 525 중 valid_until IS NOT NULL == 0' 스냅샷 검증 부재(완전 LIFO 증명 미비). G-OLD-3 R2 백업이 실질 상쇄                                                          |
| m4  | Surgeon   | verify:45               | d1() JSON 파싱이 `out.indexOf('[')` 의존 — wrangler 부가 출력에 취약하나 실패 방향 = JSON.parse 예외 크래시(fail-loud), 무음 오판정 경로 아님. 선택적 개선                                                                            |
| m5  | Architect | verify:86-93            | plan §5 G-OLD-2 명세의 '교집합 0 (D-30)' 검산 미구현 — 술어 상보성으로 정의상 공허참이나 plan↔게이트 1:1 드리프트. COUNT 검산 1줄 또는 각주 권고                                                                                      |
| m6  | Architect | plan:86                 | §6 staging 선적용이 staging d1_migrations 부기 상태를 전제 — 사전 `wrangler d1 migrations list` pre-flight 미부호화. 실패 시 duplicate column fail-loud 라 데이터 리스크 ~0                                                           |
| m7  | Architect | 0044_rollback.sql (N/A) | 4-마이그 번들(0038·0041·0042·0044) 일괄 적용인데 runbook down 은 0044 만 실재 — 0038/0041/0042 는 인라인 주석뿐. 의도적 비대칭이라도 migration-rollback.md 에 번들 절로 명문화 권고                                                   |
| m8  | Architect | migrations/0044:22-23   | 헤더 '0038 이 직전 적용' 부정확(실제 직전 = 0042, 단 0041/0042 는 exam_questions 무접촉) + byte-동일 테스트가 0044_rollback 의 3번째 트리거 사본 미커버 — 테스트 1건 추가 권고                                                        |
| m9  | Architect | d1-from-sqlite.ts:44-84 | [선재 부채 관측] SCENARIO_MIGRATIONS 기본 하네스가 0037 정지 — 기본 시나리오는 0004 전면-ABORT 세계에서 실행(TD-API-001 기문서화, 0044 신규 결함 아님). production 적용 후 간극 4건으로 원장 갱신 권고                                |
| m10 | Advocate  | verify:60-61            | corrections JSON id 무검증 SQL 보간 — 현행 36건 전부 정형(실검증)이나 'SELECT-only' 보장을 기계화하는 `/^Q-\d{4}-\d{2}-\d{3}$/` fail-loud 검증 1줄 부재. execFileSync 배열 인자라 shell injection 은 없음                             |
| m11 | Advocate  | plan:79                 | G-OLD-7 기계화 미구현의 Advocate 렌즈 관측(MAJOR-3 과 동근원) — G-OLD-8 커밋 전 시나리오 테스트 추가 또는 plan 에 'G-OLD-8 커밋 동봉' 시점 명시                                                                                       |
| m12 | Advocate  | 0044_rollback.sql:9-16  | 롤백 술어 과회수 — 0044 산(産) 표식 없이 클래스 전체 active 복귀. 현행은 G-OLD-2a(525 전부 active)로 공집합 차이나 개입 변경 존재 시 부당 복귀. 최소 '0044 직후 LIFO 에만 유효' 헤더 명시 권고                                        |
| m13 | Contract  | migrations/0044:33-37   | superseded_by CASE 의 EXISTS 가 -MC 짝 status/input_type 불문 — 정본 자격 보장이 post 게이트(G-OLD-4b) 의존. EXISTS 에 `AND m.status='active' AND m.input_type='multiple_choice'` 추가 또는 pre 게이트에 -MC 전수 active·MC 검사 추가 |
| m14 | Contract  | plan:17                 | §1 '이력 JOIN 상태 무관 유지' 부분 사실 — 이력(1214·2100)은 맞으나 약점 통계(1622·1632)는 active JOIN 이라 deprecated 카드 통계 소실(test 계정 한정, §8 인지). plan 문면 정밀화 권고                                                  |
| m15 | Contract  | verify:94-110           | G-OLD-3 이 plan 명세('스냅샷 실재 확인')보다 상향(백업 직접 실행·주석 명문화 = Silent Pivot 아님)이나 staging 경로에선 무음 생략(isProd 분기) — staging 요약에 skipped 명시 행 추가 권고                                              |

---

## 부록 A — Pass별 확인 항목 전수 (증거 기반 0건 보고 근거)

### Pass 1 Surgeon (PASS 19 / N/A 4)

1. PASS migrations/0044:44-66 == migrations/0038:42-64 — 재생성 트리거 본문 byte-동일 수동 대조(WHEN 16컬럼 순서·IS NOT 연산자·RAISE 메시지 전문 일치) + 테스트 기계 검증(test:124-132)
2. PASS migrations/0044:30-41 — UPDATE 술어 exam_type='1st' AND input_type='fill_blank' AND status='active' AND id NOT LIKE '%-MC' 로 -MC/2차/flagged/기deprecated 무접촉 (test:94-104 로 6케이스 재현)
3. PASS migrations/0044:33-37 — 상관 EXISTS CASE: UPDATE 가 id 를 변경하지 않으므로 자기간섭(행별 평가 중 다른 행 EXISTS 오염) 경로 없음, 짝 부재 시 NULL (test:86-92)
4. PASS 멱등성 — migrations/0044 재적용 시 WHERE status='active' 가 0행 매치 + DROP IF EXISTS/CREATE IF NOT EXISTS (test:134-143, vitest 직접 실행 6/6 PASS 확인)
5. PASS migrations/0010 전문 — status_transitions 트리거는 전부 status_transitions/knowledge_nodes/formulas/constants 대상, exam_questions UPDATE 에 발화하는 트리거 없음 → 0044 UPDATE 가 target_type CHECK('exam' 부재)와 충돌하는 경로 없음 (0010:25-141)
6. PASS migrations/0013·0018·0041·0042 — grep 'exam_questions' 0건 = 전이 UPDATE 중 간섭 트리거 없음
7. PASS migrations/ 실측 — 0039/0040/0043 파일 부재, 0044 가 0042 다음 유일 pending. 테스트 필터 `f < MIGRATION_0044` (test:28-31) 가 0038·0041·0042 를 정확 포함
8. PASS apps/api/src/db/schema.ts:361-362 — valid_until/superseded_by 는 타입 선언뿐, 런타임 소비자 grep 0건 → datetime('now') 공백 포맷 vs ISO 'T' 바이트 비교 지뢰(06-12 progress/due 클래스) 비해당
9. PASS 소비 표면 status='active' 필터 전수 — public/routes.ts:243,291,393,521 + study/routes.ts:945,1126,1608,1614,1622,1632,1644,1674,1841 → deprecated 전이 = 자연 배제, NULL/크래시 경로 없음
10. PASS scripts/verify-old-rows-retirement.mjs:106-109 — G-OLD-3 catch 는 detail 기록 + 게이트 FAIL 전파(빈 catch 아님), :145-147 실패 시 exit 1
11. PASS scripts/verify-old-rows-retirement.mjs:57-73 — G-OLD-1 pending 0/36건/4건/36 전수 answer 대조, 행 누락 시 byId.get undefined !== corrected 로 mismatch 계상(무음 통과 없음)
12. PASS scripts/verify-old-rows-retirement.mjs:126-129 — G-OLD-4c NULL 4건을 정렬 배열 완전일치로 대조(개수+ID 동시 검증)
13. PASS answer-corrections.json — corrections 36건·exclusions 4건(Q-2019-05-021/Q-2024-10-048/Q-2025-11-047/Q-2025-11-048) == plan §5 G-OLD-4 목록·incident §3 정합
14. PASS apps/api/wrangler.toml:146,219 — 'thepick-db-staging'/'thepick-db-production' == verify:28 DB명 정합
15. PASS scripts/backup-d1-to-r2.sh·scripts/smoke-public-surface.mjs 실재(ls 확인) — G-OLD-3/G-OLD-6 참조 스크립트 유령 아님
16. PASS apps/api/src/\_\_tests\_\_/helpers/d1-from-sqlite.ts:152-159 — first() null 반환 처리 정상(row undefined → null), 테스트 하네스 자체 크래시 경로 없음
17. PASS 테스트 실행 — vitest run migration-0044-old-rows-retirement.test.ts = 6/6 green 직접 확인(출력물 직접 소비, 완료 선언 근거)
18. PASS scripts/verify-old-rows-retirement.mjs:60-61 — corrections id SQL 보간 = \_meta 문서화된 신뢰 경계 내 정적 JSON(Q-YYYY-RR-NNN 패턴), 외부 입력 경로 없음
19. PASS docs/runbooks/migration-rollback/0044_rollback.sql:7,19-41 — 롤백이 0004 트리거를 재생성하지 않음 = 0038 상태로의 정확한 LIFO(0044 만 역전이)
20. N/A 산식 정밀도(numeric_value vs value 혼용·부동소수점) — 본 변경셋에 formula/계산 코드 무접촉 (변경 파일 전수에 수치 연산 없음)
21. N/A Formula Engine 동적 코드 실행 — 변경셋에 수식 평가 경로 없음 (packages/formula-engine 무접촉)
22. N/A Vectorize/Claude API/pdfplumber await 누락 — 변경셋에 해당 호출 없음 (verify 스크립트는 전부 execFileSync 동기)
23. N/A FSRS 음수 interval — 변경셋에 FSRS 코드 무접촉 (plan §8 이 M-9 이력 분열을 test 계정 한정으로 실측 기록)

### Pass 2 Architect (PASS 14 / N/A 3)

1. PASS — 트리거 브래킷 정합: migrations/0044:24-25 가 0038 body 트리거 + 0004 잔존 트리거 양쪽 DROP, 0044:44-66 재생성 본문 == 0038:42-64 byte-동일(육안 전문 대조 + 테스트 기계 검증). vitest 직접 실행 = 6/6 PASS
2. PASS — 브래킷 사이 개입 트리거 없음: migrations/0041·0042 에 'exam_questions' 문자열 0건(grep 실측) → pending 번들(0038→0041→0042→0044) 순서에서 0044 UPDATE 를 ABORT 할 제3 트리거 부재
3. PASS — D1 스키마 일치(Drizzle↔실제 shape): schema.ts:71 EXAM_QUESTION_STATUSES=['active','deprecated','flagged'] == migrations/0001:128 CHECK 동일 / schema.ts:361-365 validUntil·supersededBy·status 컬럼 실재 — 'deprecated' 전이는 신규 값·테이블 재생성 불필요(plan §1 주장 실코드 확증)
4. PASS — 소비 표면 자연 배제: study/routes.ts:945,1126,1608,1622,1632,1644,1674,1841 + public/routes.ts:12(서버 고정 주석),387(/grade 경계),515(/reveal 경계) 전부 status='active' 필터 → deprecated 전이 = 서빙·채점·집계·due 큐에서 자동 제외 (plan §1 '소비' 행 확증)
5. PASS — eval·검색 비결합: eval/multihop-accuracy.ts 의 exam_questions 언급은 주석 :18 뿐(golden 파일 직접 채점 — status 무의존) / search/user-search.ts 도 주석 :495 뿐 — 0044 전이 영향 0
6. PASS — production 마이그 부기 실재: .claude/reports/production-migration-status.md:5,81,127 이 `wrangler d1 migrations list` 추적 체계 확증 → migrations apply 가 0001~0037 재적용 없이 pending 4건만 적용. migrations/ 실측 = 0039/0040/0043 파일 부재(슬롯 예약과 무충돌), 'revision-watch' 하위 디렉토리·README.md 는 .sql 아님 → wrangler·readdir 필터 양쪽에서 자연 제외
7. PASS — wrangler.toml env 정합: apps/api/wrangler.toml:144-148(env.staging thepick-db-staging)·217-221(env.production thepick-db-production)·51/148/221 migrations_dir='../../migrations' — verify 스크립트 DB명 매핑(:28)·d1() cwd=apps/api(:42-43)·--env 전달과 일치
8. PASS — G-OLD-3 백업 게이트 배선: scripts/backup-d1-to-r2.sh:13 자체 `cd apps/api`(verify 가 cwd 미지정 호출해도 안전) / :31 '🟢 backup complete' == verify :104 판정 문자열 / :22-25 100KB 미만 절단 덤프 방어 실재
9. PASS — 게이트↔정본 신뢰 경계 정합: verify :50-53 이 answer-corrections.json 을 정본으로 소비 — corrections 36건·exclusions 4건(JSON 실측 카운트 일치) == plan §5 G-OLD-4 구조훼손 목록(Q-2019-05-021·Q-2024-10-048·Q-2025-11-047·Q-2025-11-048) == incident 문서 :23 — 3원 교차 일치
10. PASS — 테스트 하네스가 production 순서 동형: migration-0044 test :28-31 `f < '0044'` readdir 정렬(0041/0042 포함) — wrangler 사전순 적용과 동일 세계에서 전이 재현. 6 케이스(백링크/NULL/비대상 무접촉/ABORT 유지/byte-동일/멱등) 전부 PASS 실측
11. PASS — Temporal Graph 정합: 상태 전이 UPDATE 는 plan §3 PITR(B안 저장프로시저 = SQLite 불가 실증) + §9 Q1 진산 결재로 개방된 의도적 예외 — 본문 8컬럼 불변, superseded_by 는 P3 에서 INSERT 된 -MC 신행 지시 = INSERT+SUPERSEDES 패턴의 완결 단계. mav_supersedes 자동 flip 트리거는 knowledge_edges 전용(0013:101-108)이라 exam_questions 오발동 경로 없음. status_transitions 감사행 비기록은 target_type CHECK('node','formula','constant')(0010:27) 실측 + §9 Q5 결재로 정합
12. PASS — 롤백 SQL 자체 정합(부기 제외): 0044_rollback:9-16 역전이 술어가 forward 술어와 대칭 + G-OLD-2a pre 게이트(old 525 전부 active)가 '선재 deprecated old 행' 부재를 보증 → 역전이 과포획 리스크 production 기준 0 / :19-41 트리거 재생성 byte-동일(육안)
13. PASS — Workers 제약: 변경셋 전부 Workers 번들 외부 — verify(:15-18 node:child_process/fs)·테스트(d1-from-sqlite.ts:23 node:sqlite)는 scripts/·\_\_tests\_\_/ 한정, apps/api/src 런타임 코드 무변경(이번 변경셋의 Workers CPU·번들 영향 0)
14. PASS — G-OLD-6 스모크 무충돌: scripts/smoke-public-surface.mjs:45 가 inputType=multiple_choice 로 조회 — old fill_blank 행 은퇴 후에도 스모크 전제 불변(active 1차 = MC 521)
15. N/A — Import 방향(packages/ 간 단방향): 변경셋에 packages/ 접촉 0 — 마이그 SQL·scripts/·apps/api 테스트·docs 뿐
16. N/A — Ontology Lock: 신규 노드/엣지 ID 생성 0 (exam_questions 상태 전이만, knowledge_nodes/edges 무접촉)
17. N/A — truth_weight 정렬·IndexedDB↔D1 동기화·Hexagonal·i18n: RAG 주입 순서·오프라인 큐·domain→infrastructure 참조·사용자 노출 문자열 변경 없음(변경셋 = SQL+게이트 스크립트+테스트+plan 12줄)

### Pass 3 Advocate (PASS 16 / N/A 2)

1. PASS 정답 안전(Hard Stop): migrations/0044:30-41 — UPDATE 는 status/valid_until/superseded_by 만 SET, answer·content 무접촉 = 마이그 자체의 정답 훼손 경로 0
2. PASS 정답 안전(게이트): scripts/verify-old-rows-retirement.mjs:60-69 — G-OLD-1d 가 production -MC answer == corrected 36/36 을 pre·post 양 시점 기계 검산(D-14 영속), rows.length===36 AND mismatch 0 이중 판정
3. PASS 정답 안전(정본 무결 실검증): docs/batch-load/promo-mc-distractors/answer-corrections.json — corrections 36/exclusions 4/pending [] + 전 id 정형(Q-\d{4}-\d{2}-\d{3})·corrected 전부 1~5, node 스크립트로 리뷰 중 직접 실검증
4. PASS 트리거 정책 불변: 0044:44-66 == 0038:42-64 == 0044_rollback:19-41 CREATE TRIGGER 본문 byte-동일 — Python 정규식 추출 대조 실행 결과 True/True (ADR-046 default-deny 정책 드리프트 0)
5. PASS 트리거 재생성 테스트: migration-0044-old-rows-retirement.test.ts:106-132 — 전이 후 status/answer UPDATE ABORT + 메타 화이트리스트 허용 + byte-동일 정규식 게이트 재현
6. PASS 에러 UX(공개 표면): apps/api/src/public/routes.ts:403-405 — deprecated id /grade 는 404 QUESTION_NOT_FOUND 단일 코드로 우아 처리(정보 노출 최소, 기술 에러 비노출); :329-332 서빙 풀 0 시 NO_QUESTION 404 명시 처리
7. PASS 빈 데이터 상태: apps/api/src/public/routes.ts:254-278 — overview 는 servable 필터 후 집계라 old 배제 후에도 -MC 521 로 total 정상, 0건이어도 빈 subjects 배열 반환(크래시 경로 없음)
8. PASS 인증 표면 자연 배제: apps/api/src/study/routes.ts:945,1126,1608-1681 — 서빙·채점·집계 전부 status='active' 필터 = deprecated 전이로 오답 old 행 전 표면 배제(plan §1 소비 행 주장 실코드 확인)
9. PASS 이력 보존: apps/api/src/study/routes.ts:1660-1668 — study_reviews 오늘 복습 카운트는 exam_questions 무JOIN = 전이 후에도 이력 수치 유지(단 weak 집계 1622·1632 는 active JOIN 이라 old 카드 탈락 — 의도된 배제, 라이브 인증 사용자 0 확인 plan §8)
10. PASS 보안(명령 주입): scripts/verify-old-rows-retirement.mjs:40-44 — execFileSync 배열 인자(shell 미경유) + apps/api/src/\_\_tests\_\_/helpers/d1-from-sqlite.ts:9-10 node:sqlite exec = prepared SQL API, OS 명령 실행 경로 0
11. PASS 보안(자격증명): apps/api/wrangler.toml:22-31 — dev vars 는 do-not-use-in-production 라벨 placeholder, production JWT_SECRET 은 wrangler secret 경유(하드코딩 0); verify 스크립트·마이그에 API 키 리터럴 0
12. PASS 백업 게이트 fail-closed: scripts/verify-old-rows-retirement.mjs:96-110 — G-OLD-3 이 backup-d1-to-r2.sh(실재·실행권한 확인, 성공 마커 'backup complete' :31)를 직접 실행, catch 는 detail 기록 후 FAIL 판정(무음 삼킴 아님·빈 catch 0)
13. PASS 멱등·재실행 안전: migration-0044 test:134-143 — 0044 재적용 무오류+결과 불변; UPDATE 의 status='active' 술어가 기전이 행 재기입 차단(:94-104 비대상 4클래스 무접촉)
14. PASS 비대상 경계: 0044:38-41 — exam_type='1st' AND fill_blank AND active AND NOT '%-MC' 4중 술어 = 2차·MC·flagged·기deprecated 무접촉, G-OLD-2a(525/525)·G-OLD-5(active 1st==521 전부 MC)가 분모 기계 봉인
15. PASS staging 분모 상대화 정직성: scripts/verify-old-rows-retirement.mjs:70-73,91-92,130-137 — staging 은 하드 분모 대신 상대 불변식+리포트로 구분 표기(허위 PASS 제조 없음 — 단 G-OLD-4(staging) 항진식은 MAJOR-1/5 로 별도 확정)
16. PASS stub/TODO/placeholder: 스코프 신규 4파일(0044 SQL·롤백·verify.mjs·test) 전수 열람 — TODO/HACK/빈 함수/빈 catch 0
17. N/A 오프라인 SW 캐싱·접근성(터치 44px·aria)·XSS(innerHTML): 본 변경셋은 D1 마이그+CLI 게이트+테스트로 프론트 UI·Service Worker 파일 무접촉(변경 파일 목록 전수 확인)
18. N/A i18n 사용자 노출 문자열: verify 스크립트 출력은 운영자 콘솔 전용, 학습자 노출 표면 문자열 변경 0

### Pass 4 Contract (PASS 15 / N/A 3)

1. PASS 처분 방식 = 결재된 A안과 1:1 — migrations/0044:24-66 (DROP 2종 → UPDATE 전이 → 트리거 재생성) ↔ plan:44-64 SQL 초안 및 §9 Q1 ☑ A안. 대상 술어가 plan §1·§4 와 문자 동일 — Silent Pivot 0
2. PASS 트리거 byte-동일 계약 — python 추출 대조 실행: 0038:42-64 CREATE TRIGGER 블록 == 0044:44-66 == 0044_rollback.sql:19-41 (0038==0044: True / 0038==rollback: True). 테스트도 동일 계약을 기계 강제(test:124-132) — ADR-046 default-deny 정책 불변 확증
3. PASS exam_questions UPDATE 트리거 전수 — grep 'UPDATE ON exam_questions' migrations/\*.sql = 0004:40·0038:43(+주석 71)·0044:45 뿐. 0044 ①이 DROP 하는 2종 외 잔존 UPDATE 트리거 없음(0005 는 전부 BEFORE INSERT — 0005:97-122). 브래킷 누수 0
4. PASS 0004 헤더 계약 이행 — migrations/0004:13-14 '상태 변경은 Phase 2 에서 저장 프로시저로 별도 허용' → SQLite/D1 저장 프로시저 부재로 B안 불가(plan §3 정직 기록), 마이그+L3 plan 결재로 대체 = 기획 취지(별도 설계·인간 승인) 충족
5. PASS Hard Limit 전수 — knowledge_nodes/formulas 무접촉(0044 는 exam_questions 만), 동적 코드 실행 0, LLM 수식 계산 0, draft 적재 규칙 N/A(신규 콘텐츠 행 0), .env 무접촉, Guide/ 무접촉. superseded_by 백링크 = INSERT+SUPERSEDES 패턴의 exam_questions 대응물로 재정립서:87·624 Temporal 원칙과 정합
6. PASS status CHECK 실재 — migrations/0001:128 `CHECK(status IN ('active','deprecated','flagged'))` = plan §1 인용 문자 정확. 'deprecated' 신규 값 아님 = 테이블 재생성 불필요 주장 확증. schema.ts:5·365 EXAM_QUESTION_STATUSES 에 'deprecated' 포함(타입층 정합)
7. PASS status_transitions 'exam' 부재 — migrations/0010:27 `CHECK(target_type IN ('node','formula','constant'))` = plan §9 Q5 비채택 전제 사실 확인
8. PASS 마이그 슬롯 — ls migrations/ 실측: 0038 다음 0041·0042·0044 (0039/0040/0043 예약 부재·충돌 0), 파일명 sort 상 0038<0041<0042<0044 = plan §6 pending 일괄 순차 적용 서술과 정합. wrangler.toml:51,148,221 migrations_dir 3환경 동일
9. PASS 결재 기록 무결 — git diff = plan 파일 12줄(STATUS DRAFT→APPROVED + §9 Q1~Q5 ☐→☑)만 변경, 본문 명세 무변경. 신규 4파일은 결재 후 실행 순서(plan:109 '선작성→독립 4-Pass') 준수 — L3 결재 순서 역전(2026-05-29 실수 클래스) 재발 없음
10. PASS 구조훼손 4건 목록 3원 일치 — answer-corrections.json exclusions == plan:76 G-OLD-4 목록 == incident-1st-answer-errors-20260710.md:23. corrections 36건·중복 id 0·\_meta.pending=[] 실측(python json 검사)
11. PASS 수치 워터마크 원장 일치 — old 525(incident:9) / -MC 521(플랜·인시던트·verify G-OLD-2b) / 36교정+4제외 = 525 서빙군 분해와 산술 정합(521 교정반영 + 4 제외)
12. PASS verify 스크립트 ↔ 인프라 정합 — DB 명(verify:28) == wrangler.toml:146,219 / --env production·staging == wrangler.toml:134,203 환경 블록. backup-d1-to-r2.sh 실재 + 'backup complete' 마커(:31) + 자체 cd(:13) — G-OLD-3 판정 문자열 매칭 유효
13. PASS 시나리오 테스트 라이브 실행 — vitest 6/6 PASS(전이·백링크·NULL 4클래스·비대상 무접촉·트리거 재생성 후 ABORT/화이트리스트·byte-동일·멱등). 하네스 관례 = migration-0038 테스트와 동일 raw D1(node:sqlite) 계열, before-0044 필터(test:28-31) — 빈 DB no-op 한계를 헤더(:10-12)가 정직 기록
14. PASS 서빙·채점 소비층 자연 배제 — public/routes.ts:288-291·:387-393·:515-521 전부 status='active' 경계 → deprecated 전이 = 전 표면 배제(plan §2.3). C-1 가드(study/routes.ts:67·926-964) 존속 확인 = G-OLD-8(가드 폐기) 별도 커밋 계약 준수(본 changeset 에서 선폐기 없음)
15. PASS 롤백 런북 관례 — 0044_rollback 이 기존 0021~0026 런북 디렉토리 관례 준수, 역전이 술어가 plan §4 다운 명세와 문자 동일 + 이중 active 복귀 경고·G-OLD-2 재실행 의무 헤더(:1-3) 명시(단 d1_migrations 의무 누락 = MAJOR-2/4). 롤백 후 트리거 재생성도 byte-동일(기계 확증)
16. N/A constants 값 ↔ 교재 원문 대조 — 본 변경은 constants/formulas 무접촉(0044 는 exam_questions status/superseded_by/valid_until 3컬럼만 SET)
17. N/A BATCH 순서 게이트 — 콘텐츠 적재 아님(기존 행 상태 전이)
18. N/A 노드 ID 컨벤션(CONCEPT-001 등) — knowledge_nodes 무접촉. 문항 id 는 기존 Q-YYYY-RR-NNN(-MC) 관례 소비만

---

## 처분 권고 (production 적용 전 순서)

1. **즉시 수정 (코드/문서 소액, 적용 전 필수 권고)**: MAJOR-1/5 verify:131 항진식 1줄 교체(기계산값 활용) → MAJOR-2/4 0044_rollback 헤더 2줄(d1_migrations DELETE 의무 + G-OLD-8 이후 롤백 금지 분기) → MAJOR-3 G-OLD-7 처분(시나리오 테스트 추가 ① 권장 또는 plan §5 판정 방식 개정 ②)
2. **동봉 가능 MINOR**: m2(주석 정확화)·m5(교집합 COUNT 1줄)·m8(byte 테스트 rollback 사본 1건)·m10(id 정형 fail-loud 1줄)·m13(EXISTS status 조건)·m14(plan §1 문면)·m15(staging skipped 가시화)
3. **원장 기록만**: m9(TD-API-001 간극 4건 갱신)·m7(번들 down 비대칭 명문화)·m12(LIFO 한정 명시)
4. MAJOR 5건 처분 완료(또는 명시 이월 기록) 후 → plan §6 시퀀스(staging 선적용 → G-OLD 전 게이트 → production) 진입. production 적용 자체는 진산 인증 게이트 불변.
