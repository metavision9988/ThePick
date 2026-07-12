# 4-Pass 리뷰 — D-21(5-페르소나 RC-6) web 배포 추적성 복원

- 타임스탬프: `20260712-223342`
- 리뷰 방식: 독립 에이전트 5개(scope/Surgeon/Architect/Advocate/Contract) + 발견별 적대적 반증
- 판정: **완료 가능** (CRITICAL 0 / MAJOR 0 / MINOR 6)

## 스코프

**변경 파일(6):**

- `apps/web/scripts/deploy-lib.mjs`
- `apps/web/scripts/deploy-production.mjs`
- `apps/web/scripts/__tests__/deploy-lib.test.mjs`
- `apps/web/package.json`
- `package.json`
- `docs/plans/promo-1st-p4-frontend-ledger.md`

**연관 파일(4):**

- `apps/web/scripts/check-deploy-env.mjs`
- `.github/workflows/ci.yml`
- `apps/web/astro.config.mjs`
- `.github/workflows/ops.yml`

**요약:** D-21(5-페르소나 RC-6) 처분 — web production 배포물↔git SHA 추적성 복원. 구
`deploy:production` 인라인 셸 체인(`--commit-dirty=true` 무조건 은폐)을 오케스트레이터
스크립트(`deploy-production.mjs`)로 대체: env게이트(`check-deploy-env.mjs` 위임) → git 계보
수집 → astro build → `dist/version.json` 스탬프 → wrangler pages deploy(`--commit-hash/message`

- 실제 dirty 반영). 순수 함수(`buildVersionInfo`/`buildWranglerArgs`)는 `deploy-lib.mjs`로
  분리하고 `node:test` 6개로 커버, 루트 `test:scripts` 글롭을 `apps/web/scripts/__tests__`로
  확장해 CI(`ci.yml:84`)에 배선. operator 명령(`deploy:production`)은 불변이며 실배포는
  미수행(운영자 행위).

── 4-PASS REVIEW ──────────────────
리뷰 방식: 독립 에이전트 5개(scope/Surgeon/Architect/Advocate/Contract) + 발견별 적대적 반증
리뷰 범위: 변경 파일 6개 + 연관 파일 4개 (위 스코프 목록)

## Pass 1 (Surgeon): ✅ 9건 확인 / 🔴 0건 / 🟠 2건 / N/A 4건

**관점: "이 코드 단독으로 터지는 경로가 있는가?"**

확인(PASS):

1. Null/Undefined — `deploy-lib.mjs:19-38·49-72`: 모든 입력 필드 `typeof` 가드 후 사용,
   `?? null`/`?? sha.slice(0,7)` 안전 기본값. D1 `.first()` null 경로 = N/A(스코프에 D1 쿼리 없음).
2. Async/await 누락 — `deploy-production.mjs:26-32` git()/run()은 `execFileSync`(동기) 사용,
   빌드 스크립트에 적합. await 대상 async 호출 자체가 없음.
3. 경계값(빈문자열) — `deploy-lib.mjs:20·26·50·53·56`: sha/builtAt/distDir/projectName
   `length===0` 명시 거부. `commitSubject` 빈값은 `?? ''`(69)로 허용(의도적).
4. 경계값(dirty 스푸리어스) — `.gitignore:6` `dist/` 무시 확인 → `deploy-production.mjs:40`
   dirty 계산(build 前)이 dist 산출물로 오탐되지 않음.
5. 에러 처리(빈 catch 0건) — grep 결과 catch 문 0건, `deploy-lib.mjs` throw 7건 전부 입력검증
   fail-loud. `execFileSync` 미try = 의도적 fail-fast, 무음 데이터 삭제 없음.
6. dirty 은폐 폐기 — `deploy-lib.mjs:70` `--commit-dirty=${dirty?'true':'false'}` +
   `deploy-production.mjs:42-46` dirty 경고 로그. 구 무조건 은폐 제거 확인, `deploy-lib.test.mjs:70-81` 커버.
7. 테스트 배선 — `package.json:10` test:scripts 글롭이 `apps/web/scripts/__tests__/*.test.mjs`
   포함, `ci.yml:83-84` 배선. `deploy-lib.test.mjs:11-88` node:test 6개.
8. env 게이트 정합 — `check-deploy-env.mjs:11-20` PUBLIC_API_BASE_URL 미설정/localhost/비-https
   exit 1(fail-closed), astro build 인라인 前 차단. process.env 상속 전파.
9. version.json 추적성 경로 — `deploy-production.mjs:51-62` build 後 스탬프 → `65-76` wrangler가
   동일 `DIST_DIR='dist'` 배포 → 정적 `/version.json` 서빙. `astro.config.mjs:12` output:'static' outDir=dist 일치.

N/A: 산식 정밀도/numeric_value·Formula Engine 동적실행·IndexedDB↔D1 동기화·유사도<0.60 거부(배포
스코프에 해당 로직 부재).

🟠 MINOR 2건:

- **[S-M1]** `deploy-production.mjs:35` — `check-deploy-env.mjs`가 cwd 의존 상대경로로 호출.
  문서화된 `pnpm --filter`(cwd=apps/web) 밖(repo 루트)에서 직접 실행 시 경로 오해석. 단
  execFileSync 즉시 throw(fail-loud)하고 astro build·wrangler도 동일 cwd 가정 공유(일관적).
  → `import.meta.url` 기준 경로 고정 권고.
- **[S-M2]** `deploy-production.mjs:24` — wrangler `--branch`가 git HEAD 아닌 하드코딩
  `'main'`. sha/dirty/subject는 HEAD 실측이나 branch만 상수 → 비-main HEAD 배포 시 메타 부정확.
  권위 키는 sha라 추적성은 담보. → git 실측 또는 '배포정책 상수' 주석 권고.

반론(Devil's Advocate): operator가 CI 컨텍스트나 스크립트 래퍼에서 repo 루트 cwd로 이 스크립트를
자동화 호출하면 첫 게이트에서 'Cannot find module' 실패 — 배포가 아예 시작되지 못한다(안전 방향이나
원인 진단이 혼란스러울 수 있음).

## Pass 2 (Architect): ✅ 7건 확인 / 🔴 0건 / 🟠 3건 / N/A 5건

**관점: "이 코드가 다른 모듈과 만나면 터지는가?"**

확인(PASS):

1. Import 방향 — `deploy-production.mjs:20`은 `./deploy-lib.mjs`(부수효과 없는 순수 함수)만
   import, packages/ 역방향 의존 0. `deploy-lib.mjs`는 외부 import 0.
2. 셸 인젝션 차단 — `deploy-production.mjs:26-32` execFileSync(argv 배열, 셸 미경유),
   `deploy-lib.mjs:69` `--commit-message=${commitSubject}`도 argv 원소 전달 → 인젝션 불가.
3. 빈 catch/stub/TODO 0 — 두 스크립트 try-catch 없이 execFileSync throw 전파(fail-loud).
   placeholder·TODO·HACK grep 0건.
4. CI 배선 정합 — `package.json:10` 글롭 확장, `ci.yml:84` `pnpm test:scripts`. 실측
   `node --test` → 19 pass(root 13 + web 6) 0 fail, 원장 §8.4 '19(13+6)' 일치.
5. 글롭 확장 현행 안전 — `scripts/__tests__/build-querybody-golden.test.mjs` 1건 +
   `apps/web/scripts/__tests__/deploy-lib.test.mjs` 1건 실존, 두 패턴 매치.
6. 실행 순서 정합 — env게이트(35)→git계보(38-41)→astro build(49)→version.json 스탬프(61)→wrangler
   deploy(65). version.json이 build 후 dist 기록, wrangler가 dist 전체 배포하므로 배포 포함.
7. dirty 표면화 정합 — `deploy-lib.mjs:70` + `deploy-production.mjs:42-46` console.warn +
   version.json.dirty 기록. 구 무조건 은폐 대비 실제 상태 반영(테스트 `deploy-lib.test.mjs:70-81`).

N/A: D1 스키마/Drizzle·Ontology Lock/truth_weight/Temporal Graph·IndexedDB↔D1/Hexagonal·
i18n(운영자 CLI 로그, 사용자 UI 아님)·Workers 제약(빌드 파이프라인 Node, Workers 런타임 아님).

🟠 MINOR 3건:

- **[A-M1]** `deploy-production.mjs:24` — version.json.branch 및 `--branch`가 실측 아닌 상수
  `'main'`. sha/dirty/subject는 측정하면서 branch만 하드코딩 → D-21 '계보 수집' 의도와 부분 불일치.
  version.json 소비자 관점에서 branch는 '측정된 계보'로 오인될 수 있는 유일한 비측정 필드.
  → 의도가 '배포 타겟 고정'이면 주석, '실계보'면 checkoutBranch 별도 필드 권고.
- **[A-M2]** `deploy-production.mjs:35` — 상대경로(`./scripts/check-deploy-env.mjs`·dist·pnpm
  exec)는 cwd=apps/web에서만 정상. 루트 등 타 cwd 직접 실행 시 침묵 오동작 가능(단 fail-loud라 무해).
  → `process.chdir(...)` 고정 또는 cwd basename 검증 권고(선택).
- **[A-M3]** `deploy-production.mjs:65-76` — step5 `pnpm exec wrangler`가 workspace 미선언 →
  전역 wrangler(4.78.0)로 폴백, 핀 버전(api 4.83.0) 우회 + 클린 환경 배포 실패. 실측:
  apps/web/package.json에 wrangler 부재(grep 0), `.bin/wrangler` 부재(대조군 astro는 존재),
  `pnpm exec wrangler --version` → 4.78.0(전역 PATH). **적대적 반증 결과: 사실 100% 정확, 반증 실패
  (refuted=false)이나 severity MAJOR→MINOR 하향** — production 라이브·operator 머신 전역 wrangler
  상존·CI/컨테이너 배포 경로 부재·`--commit-*` 플래그 4.78→4.83 안정·선재 조건(구 인라인 체인 승계,
  D-21 신규 회귀 아님)으로 impact horizon이 latent. → apps/web devDeps에 `wrangler ^4.83.0` 명시
  또는 `pnpm exec wrangler --version` 선검증 게이트 권고.

반론(Devil's Advocate): operator가 hotfix를 별도 브랜치 체크아웃 상태에서 배포하면
version.json.branch='main'이나 실제 HEAD는 다른 브랜치 → 사후 인시던트 조사 시 '어느 브랜치가
라이브인가'를 sha로만 역추적해야 하고 branch 필드는 오히려 오도한다.

## Pass 3 (Advocate): ✅ 6건 확인 / 🔴 0건 / 🟠 1건 / N/A 6건

**관점: "수험생과 공격자, 둘 다 만족하는가?"**

확인(PASS):

1. 보안(셸 인젝션) — `deploy-production.mjs:26-32` execFileSync(cmd, argsArray). commitSubject가
   `--commit-message`로 흘러도 `deploy-lib.mjs:69` argv 원소 전달 → 셸 메타문자 인젝션 불가.
2. 보안(시크릿 하드코딩) — `check-deploy-env.mjs:11`·`deploy-production.mjs:59` apiBase=env, 코드
   내 토큰/키 0건. `ops.yml:50-51` CLOUDFLARE_API_TOKEN/ACCOUNT_ID는 `${{ secrets.* }}` 참조.
3. 보안(입력 검증) — `check-deploy-env.mjs:12-20` PUBLIC_API_BASE_URL 미설정/localhost/비-https
   exit 1 차단(빌드타임 localhost 폴백 무음 API 실패 방어). `deploy-lib.mjs:20-28,50-61` 필수 필드 검증.
4. 무음 실패 없음(fail-loud) — `deploy-production.mjs` catch 블록 0건, check-deploy-env exit
   1·astro·wrangler 실패 전부 execFileSync throw로 중단. stub/TODO/빈catch 0건.
5. 상태 표면화(운영자 UX) — `deploy-production.mjs:42-46` dirty 시 🟡 경고 + version.json/CF 메타
   dirty=true. `check-deploy-env.mjs:22-23` beacon 토큰 미설정 시 🟡 경고.
6. 테스트 배선 — `package.json:10` 글롭 + `ci.yml:83-84` 스텝. `deploy-lib.test.mjs:41-47,83-88`
   필수필드 누락·dirty 비-boolean throw 케이스 커버(무음 통과 차단).

추가 PASS: `astro.config.mjs:7` PUBLIC_SITE_URL 폴백 하드코딩 승격 금지 주석 준수(명명·문서화된 기본값).

N/A: 에러 UX(교재 O장 안내)·상태 표현(로딩/빈데이터/오프라인 UI)·오프라인 SW 캐싱·접근성·
XSS(innerHTML)·정답 안전(OX/빈칸/변형) — 배포 추적성 인프라, 학습자 노출/렌더링 경로 없음.

🟠 MINOR 1건:

- **[Ad-M1]** `deploy-lib.mjs:29-37` — 공개 version.json이 내부 commitSubject(및 full SHA·branch)를
  무인증 노출. `curl https://thepick-study.pages.dev/version.json`로 누구나 조회(ledger §8.4:132 설계).
  레포 커밋 제목이 내부 마이그 번호·아키텍처 용어('fix(0044): old 525행 처분' 등)를 담아 배포 계보·
  미해결 이슈 정찰 표면. 추적성(D-21)은 sha/shortSha/builtAt/dirty만으로 100% 달성. → 공개 페이로드에서
  commitSubject 제외 또는 트렁케이트, 제목은 wrangler `--commit-message`(CF 내부 메타)에만 스탬프 권고.

반론(Devil's Advocate): 이 노출은 의도적·문서화된 설계(ledger §8.4)이고 GitHub 공개 레포라면 어차피
노출된다. '404 3주 인시던트' 재발 차단 운영 편익이 정보 노출 리스크를 상회할 수 있어 수용 가능한
트레이드오프일 수 있음 — 그래서 MINOR(보고만).

## Pass 4 (Contract): ✅ 10건 확인 / 🔴 0건 / 🟠 0건 / N/A 4건

**관점: "원장(promo-1st-p4-frontend-ledger.md §8.4) 대로 만들었는가?"**

확인(PASS):

1. 원장 대조(구조) — `deploy-production.mjs:20,52-76` = 순수함수(deploy-lib) 분리 + 오케스트레이션이
   원장 §8.4(ledger:129-135) '신설, 구 인라인 셸 체인 대체'와 1:1 정합. Silent Pivot 0.
2. version.json 필드 계약 — `deploy-lib.mjs:29-37` 7필드(sha·shortSha·branch·dirty·commitSubject·
   builtAt·apiBase)가 ledger:132 명세와 완전 일치, 추가·누락 0.
3. wrangler 인자 계약 — `deploy-lib.mjs:62-71` `--commit-hash`·`--commit-message`·`--commit-dirty`
   (실제 dirty)가 ledger:131 '무조건 true 은폐 폐기 → dirty 표면화'와 정합. `:40` dirty 실제 산정.
4. operator 명령 불변 — `apps/web/package.json:10` `deploy:production`:'node ./scripts/deploy-production.mjs'
   명령명 유지, ledger:134 'operator 명령 불변' 정합. 진입점만 인라인 셸→스크립트 교체.
5. 게이트 배선 — `package.json:10` 글롭 추가 + `ci.yml:83-84` = ledger:133 정합.
   `deploy-lib.test.mjs` test() 6개(:11,:32,:41,:49,:70,:83) = 원장 'node:test 6' 정합.
6. env 게이트 위임(carry-over 이행) — `deploy-production.mjs:35` 선행 + `check-deploy-env.mjs:11-20`
   = 원장 §6 MINOR(ledger:74)·§8.3(ledger:121) 정합.
7. 배포 실체 정합 — `deploy-production.mjs:23` PROJECT_NAME='thepick-study' + `astro.config.mjs:7`
   기본값 일치, memory project_deployment_reality 정합. BRANCH='main' = production 브랜치.
8. 빌드→스탬프 순서 — `:49` astro build 후 `:61` writeFileSync(dist/version.json). build가 dist를
   clean하므로 스탬프가 build 뒤라야 유실 없음(순서 정확).
9. stub/TODO/빈catch 전수 — 세 파일(deploy-lib 72줄·deploy-production 78줄·check-deploy-env 27줄)에
   stub/TODO/HACK/placeholder 0, 빈 catch 0. try-catch 부재 = execFileSync throw 전파(fail-fast) 계약.
10. 실배포 미수행 정직성 — ledger:135 '실배포는 운영자 행위'. 코드베이스에 자동 배포 트리거 0
    (ops.yml은 backup+smoke만, wrangler pages deploy 부재). 무음 배포 0.

N/A: Hard Rule 15/16/17(exam ID 리터럴·시험 분기·examId wrapper 전수 스캔 0건 — 대상은 배포 인프라,
packages/ 범용계층 아님)·노드 ID 컨벤션·constants↔교재 원문 대조·배치 순서(콘텐츠 파이프라인 무관,
D1/knowledge_nodes write 0).

반론(Devil's Advocate): 원장이 'operator 명령 불변'을 주장하나, 진입점이 인라인 셸→외부 스크립트로
바뀌면서 스크립트 파일 삭제·이름 변경·cwd 변화 등 새 취약 표면이 생긴다. Pass 1/2의 상대경로·wrangler
해소 MINOR가 이 표면의 실증 — 계약상 '불변'이라도 견고성 부채는 신규 발생.

판정: **완료 가능** (CRITICAL 0 / MAJOR 0 / MINOR 6)
────────────────────────────────────

## 확정 발견 (적대적 반증 통과분)

| #     | Severity | Pass      | 파일:라인                   | 요지                                                                                                                           |
| ----- | -------- | --------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| S-M1  | MINOR    | Surgeon   | deploy-production.mjs:35    | check-deploy-env.mjs cwd 의존 상대경로 호출 (fail-loud, import.meta.url 고정 권고)                                             |
| S-M2  | MINOR    | Surgeon   | deploy-production.mjs:24    | `--branch`가 git HEAD 아닌 하드코딩 'main' (sha는 실측, branch만 상수)                                                         |
| A-M1  | MINOR    | Architect | deploy-production.mjs:24    | version.json.branch가 실측 아닌 상수 — D-21 '계보 수집' 의도와 부분 불일치                                                     |
| A-M2  | MINOR    | Architect | deploy-production.mjs:35    | 상대경로군 cwd=apps/web 전용 — 타 cwd 직접 실행 시 오동작(fail-loud)                                                           |
| A-M3  | MINOR    | Architect | deploy-production.mjs:65-76 | `pnpm exec wrangler` workspace 미선언 → 전역 4.78.0 폴백(핀 4.83.0 우회). 적대검증: 사실 정확·MAJOR→MINOR 하향(latent horizon) |
| Ad-M1 | MINOR    | Advocate  | deploy-lib.mjs:29-37        | 공개 version.json이 내부 commitSubject·full SHA·branch 무인증 노출(정보 노출 표면)                                             |

**MAJOR 이월: 없음.** CRITICAL 0 · MAJOR 0 · MINOR 6(전부 보고만). A-M3는 최초 MAJOR 제기였으나
발견별 적대적 반증에서 impact horizon이 latent(선재 조건 승계·D-21 신규 회귀 아님·operator 전역
wrangler 상존)으로 확인되어 MINOR 하향, 사실 정확성은 refuted=false로 유지.

## 판정

**완료 가능** — CRITICAL 0건. MINOR 6건은 전부 보고만(견고성/추적성 부채, 즉시 수정 불요). D-21
목표(배포물↔SHA 추적성 복원, dirty 은폐 폐기)는 실코드·원장·CI 배선·테스트 전수 대조로 정합 확인.
