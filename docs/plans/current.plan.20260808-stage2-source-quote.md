---
phase: 3
step: 역이식 STAGE 2 — source_quote 축 신설 + 백필 (AutoVerify 관문)
approved_by: 진산 (2026-08-08, "stage 2 진행") — 근거 = 결재 대시보드 §A #7 (권고 (a) 백필 포함)
risk_level: L3
scope:
  # --- L3: DB 스키마 + 가드 트리거 ---
  - migrations/0047_source_quote_axis.sql
  - apps/api/src/db/schema.ts # 타입 파생 (NC-1: Drizzle = 타입 전용)
  - apps/api/src/__tests__/scenarios/migration-0047-source-quote.test.ts
  - apps/api/src/__tests__/helpers/d1-from-sqlite.ts # SCENARIO_MIGRATIONS 등재 (드리프트 가드)
  # --- 미검증 표기 (감사 코어 — L3 아님, read-only) ---
  - packages/quality/src/production-audit.ts
  - packages/quality/src/index.ts
  - packages/quality/src/__tests__/production-audit.test.ts
  - scripts/run-graph-integrity-production.ts
  # --- 적재 계약 (2-3 의 실체 — 독립 리뷰 MAJOR: 원 scope 누락분 정직 등재) ---
  - apps/batch/src/loader/draft-loader.ts # INSERT 에 source_quote 컬럼
  - apps/batch/src/__tests__/loader.test.ts # 픽스처에 원문(노드 한정)
  - packages/parser/src/schema-validator.ts # 계약 타입에 source_quote (optional)
  # --- 백필 산출물 (production 미적용 — 별도 인증 게이트) ---
  - docs/batch-load/stage2-source-quote/ # 추출 스크립트 + 백필 SQL + 검수 시트
  # --- 진행 추적·문서 (동커밋 갱신 의무) ---
  - docs/plans/catchall-역이식-체크리스트.md
  - docs/plans/APPROVAL_DASHBOARD.md
  - docs/plans/current.plan.md
  - docs/plans/current.plan.20260807-decision9-effectivity.md
  - .jjokjipge/handoff-20260807-backport.md
  - .claude/reviews/review-20260808-stage2-source-quote.md # 독립 리뷰 2렌즈 보고서
---

> 직전 plan(결정 #9 (C) 집행 = 마이그 0045·0046)은
> `docs/plans/current.plan.20260807-decision9-effectivity.md` 로 보존 이관.

## 목적

**카드가 "무엇을 근거로 그렇게 말하는지"를 데이터로 들고 있게 한다.**

지금 노드는 출처를 **포인터**(`page_ref`·`book_page`·`source_url`)로만 가진다. 그래서 검수는
"사람이 PDF 를 열어서 대조하는 것"이 유일한 경로이고, 그것이 이 프로젝트의 결재 병목 원인이다
(분석 §2 — catchall 이 같은 문제를 `source_quote` 로 풀었다).

`source_quote` = 그 카드의 근거가 된 **원문 문장 그 자체**. 이게 있어야 STAGE 3 의 검사기
(인용 진위·앵커 충분성·값 정합)가 **대조할 대상**을 갖는다. 없으면 STAGE 3 는 검사할 게 없다.

⚠️ **이 plan 은 "칸을 만들고 규율을 걸고 법령 59장을 채울 준비까지"** 다.
production 쓰기(ALTER·백필)는 **전부 별도 인증 게이트** — 여기서는 SQL 작성·로컬 검증까지.

## 대상 변경

### 2-1 원문 칸 (마이그 0047)

`knowledge_nodes` / `formulas` / `constants` 3종에 `source_quote TEXT` 추가.
선례 = 0041 의 `ALTER TABLE … ADD COLUMN`(0019/0016 과 동일 패턴).

### 2-2 백필 허용 규칙 편입 (같은 마이그)

현 `prevent_{knowledge_nodes,formulas,constants}_update` 가드는 **새 컬럼을 아예 모른다** —
즉 지금 그대로 두면 `source_quote` 는 값→값 UPDATE 가 **무음 통과**한다(0041 이 겪은 것과 같은 구멍).
0041 패턴 그대로 화이트리스트에 편입한다:

```
OR (OLD.source_quote IS NOT NULL AND NEW.source_quote IS NOT OLD.source_quote)
```

⇒ **NULL→값 1회만 허용**, 값→값·값→NULL 은 ABORT. 백필의 합법 경로이자 사후 위조 차단.

### 2-3 신규 적재 원문 필수 — ★적용 범위 결정 (설계 결정 ①)

체크리스트 완료 판정은 _"원문 없이 넣으려 하면 거부 / **공백만 넣어도 거부**"_ = **INSERT 시점 게이트**다.
문제는 범위다 — 무조건 걸면 `INSERT INTO knowledge_nodes` 표면 **21곳**(테스트 픽스처 다수)이 전부 깨진다.

**채택: `batch_id IS NOT NULL` 인 행에만 강제.**

- 근거: 체크리스트 문면이 **"새로 적재하는 _서식_"** 이라고 범위를 이미 한정하고 있다.
  `batch_id` 는 "이 행은 배치 적재분"이라는 **행 스스로의 선언**이며, 실측상
  적재 경로(`draft-loader.ts:317`, `gap-P*-insert.sql` = `'BATCH-GAP-P1'`)는 **항상** 채우고
  테스트 픽스처는 **한 곳도** 쓰지 않는다(전수 grep). 즉 의미와 실측이 같은 선을 그린다.
- **공백 거부**: `trim(NEW.source_quote) = ''` 도 ABORT. 빈 문자열은 "채웠다"의 가장 흔한 위조다.
- ⚠️ **막지 않는 것(정직 기록)**: batch_id 없는 수기 INSERT·테스트·마이그레이션은 게이트 밖이다.
  이건 구멍이 아니라 **의도된 경계**다 — 적재 서식 강제이지 전역 NOT NULL 이 아니며,
  전역화하려면 기존 857 행 백필 완료가 선행이다(그게 2-4, 그리고 그 뒤가 STAGE 3).
- **formulas/constants 는 INSERT 게이트 제외**: 두 테이블에는 `batch_id` 류 적재 선언 컬럼이
  **없다**(schema 실측). 칸(2-1)과 백필 규율(2-2)은 걸되 적재 의무화는 별건으로 이월한다
  (분석 §T1-1 도 이 축을 "WS-3c variant 24 교재 대조 큐"로 별도 지목).

### 2-4 법령 59장 백필 (LAW-144~202)

- **왜 여기부터**: 조문은 **본문이 곧 내용**이라 원문 부착이 기계적이고, 숫자가 많아 STAGE 3 효과 측정이 선명하다.
- **★현 description 은 원문이 아니다**(실측): `LAW-144` 는 _"① … 2의2. 「산림조합법」에 따른 …"_ 처럼
  조문을 **요약·재구성**했고 편집 주석(_"(법령 원문 기준 — … CROSS_REF.)"_)까지 붙어 있다.
  ⇒ `source_quote` 는 description 복사가 **아니라** 법령 PDF 에서 **축자 추출**해야 한다.
- 경로: `docs/batch-load/gap-P1/extract_law.py`(pdfplumber) 재사용 → 조문 단위 절단 →
  **결정론 추출**(LLM 생성 금지) → 노드별 매핑 → 백필 SQL(`UPDATE … SET source_quote = ?`).
- 산출: `docs/batch-load/stage2-source-quote/` (추출 스크립트·매핑 JSON·백필 SQL·검수 시트).
- ⚠️ **production 적용은 별도 인증 게이트** — 여기서는 SQL 생성 + 로컬 하네스 검증까지.

### 2-5 미검증 표기 (감사 코어)

무결성 러너 리포트에 **`source_quote` 커버리지**를 명시한다 —
`approved+active 노드 N 중 원문 보유 M (M/N)`. 그리고 STAGE 3 검사기가 붙었을 때
_"게이트 PASS = 전수 검증"_ 으로 읽히지 않도록 **미보유분을 `측정 대상 아님`으로 분리 표기**.

★이음길 교훈(분석 §3): 일부만 검사하고 전부 검사한 것처럼 보이는 상태가 가장 위험하다.

## 설계 결정 (RULE #1 — 기획과 다른 판단은 여기 명시)

| #   | 갈림길                 | 채택                                           | 근거                                                                                                  |
| --- | ---------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| ①   | 2-3 INSERT 게이트 범위 | **batch_id 선언분만**                          | 체크리스트 문면("적재 서식")과 실측(적재=항상 / 픽스처=전무)이 일치. 전역 강제는 857 백필 후에나 가능 |
| ②   | `source_quote` 출처    | **법령 PDF 축자 추출** (description 복사 금지) | 실측상 description 은 요약·편집본. 복사하면 "원문 대조"가 자기 자신 대조가 되어 STAGE 3 가 공허해진다 |
| ③   | 백필 실행 시점         | **SQL 생성까지 / 적용은 별도 게이트**          | production 쓰기 = 진산 인증 관행(0038·0044·0045 선례). 2-4 는 "채울 준비 완료"로 닫는다               |

## 위험 분석

| 위험                                                                                                                                                                                                                                                                                                               | 완화                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 새 컬럼이 **가드 밖**이라 값→값 UPDATE 무음 통과 (0041 이 겪은 구멍의 재발)                                                                                                                                                                                                                                        | 2-2 를 **같은 마이그에** 넣는다. 칸만 만들고 가드를 미루면 그 사이가 무방비                                                                                                                                                                                                      |
| 2-3 게이트가 **정당한 적재를 막는다**                                                                                                                                                                                                                                                                              | 범위 = batch_id 선언분. 기존 표면 21곳 중 적재 경로만 대상 — 전수 회귀로 확인                                                                                                                                                                                                    |
| `source_quote` 를 description 복사로 채워 **검증이 자기 대조**가 됨                                                                                                                                                                                                                                                | 설계 결정 ② + 백필 스크립트에 동일성 검사(quote == description 이면 fail-loud)                                                                                                                                                                                                   |
| 백필 원문이 **LLM 생성/환각**                                                                                                                                                                                                                                                                                      | 결정론 추출만(pdfplumber). 스크립트에 "생성 금지" 명문 + 추출 원문 ↔ PDF 재현 가능                                                                                                                                                                                               |
| 1.2MB **전문 대조**로 청크 없이 가면 STAGE 3 가 공허 PASS (catchall W1 실증)                                                                                                                                                                                                                                       | 본 plan 범위 밖이나, `source_quote` 를 **조문 단위**로 끊어 저장해 STAGE 3 청크 대조의 전제를 미리 만든다                                                                                                                                                                        |
| ★**백필 대상 59 = 캘리브레이션 burned 코퍼스** — LAW-144~202 는 2026-07-14 위임 일괄 승격 63(P1 22+P2 37+P3 4)의 부분집합이고, 대시보드 §A #8 이 "이미 승격된 행이라 자기 채점"으로 지목한 바로 그 집합이다. STAGE 3 는 "원문 보유 카드"만 검사할 수 있으므로 **첫 측정 표본 = burned 표본이 구조적으로 강제**된다 | ⚠️ **미완화 — 명시 이월**. STAGE 3 착수 전에 held-out(원문 보유 · 승격 이력 없음) 집합을 별도 확보해야 한다(§A #8 연동). 이 plan 범위에서는 해소하지 않으며, 해소 없이 STAGE 3 수치를 인용하면 06-02 다각 감사가 차단막으로 지정한 순환편향이 기계화된 형태로 되돌아온다         |
| ★**오추출을 나중에 못 고친다** — 0047 이 `source_quote` 를 NULL→값 1회로 고정하므로 적용 후 정정은 값→값 = ABORT                                                                                                                                                                                                   | **적용 전 검수가 유일한 창**이다. 순서를 못박는다: `review-sheet.md` 검수 → 정정 → 추출·게이트·SQL **재생성** → 그 다음 적용. 잔여 리스크 실측: 상법 8건은 기록 페이지축이 틀려 전 문서 폴백 + "최장 본문" 휴리스틱으로 선택됐고, LAW-202(고시)는 조 번호가 없어 페이지 전문이다 |
| 마이그 순서 (0046 뒤)                                                                                                                                                                                                                                                                                              | 0047 슬롯. 0046 과 객체 참조 0 — 단 `prevent_*_update` 재생성이므로 **0041 이후** 적용 필수(파일명 순 = 도구 보장)                                                                                                                                                               |

## 검증 계획 (Binary)

- [x] **G-S2-1** 3종 테이블에 `source_quote` 실재 + 기존 행 전부 NULL (무회귀)
- [x] **G-S2-2** NULL→값 백필 통과 / 값→값 ABORT / 값→NULL ABORT (3종 대칭)
- [x] **G-S2-3** batch_id 있는 INSERT: `source_quote` NULL = ABORT / 공백·whitespace = ABORT / 값 = 통과
- [x] **G-S2-4** batch_id 없는 INSERT = 무게이트 통과 (테스트 픽스처·수기 경로 무회귀)
- [x] **G-S2-5** 0041 기존 화이트리스트(valid\_\*·source_url·batch_run_id·source_id) 무회귀
- [x] **G-S2-6** 러너 리포트에 커버리지 `M/N` 표기 + 미보유분 **"미검증 — 검사 대상 밖"** 분리
- [x] **G-S2-7** 백필 SQL: 생성물 ↔ PDF 추출 원문 일치 · description 동일성 0건 ·
      **58/59 매핑 + 의도적 제외 1**(LAW-202 = 실체인 표가 미적재 → 사유 영속)
- [x] **G-S2-7f** ★꼬리 오염 0 (부칙·별표·페이지 푸터·다음 문서 머리) — 독립 리뷰 CRITICAL 처분으로 신설
- [x] **G-S2-7g** ★description 대비 과대 배수 0 (절단 실패 탐지) — 동상
- [x] **G-REG** 전 워크스페이스 무회귀 (api·quality·scripts·E2E·typecheck·lint·G-1·훅)
- [x] **G-MUT** 변이 검증 — 가드를 하나씩 제거하면 대응 테스트가 red
- [x] **G-REVIEW** 독립 에이전트 리뷰 CRITICAL 0
      — 2렌즈 실행 → raw CRITICAL 2 · MAJOR 8 → **전건 처분**.
      ★처분 목록: typecheck red 상태 체크(재발 클래스) / STAGE 3 진입조건 오표기 / 대시보드 미갱신(정본 이원화) /
      plan scope 누락 3파일 / 존재하지 않는 검증 문구 / burned 코퍼스 미기록 / 오추출 정정 경로 부재 /
      "막게 되는 것" 미기록 / 2-5 어휘 완화 / 857→59 축소 미기록

## 롤백 전략

- 0047: production 미적용 상태이므로 파일 삭제로 롤백. 적용 후에는 `ALTER … DROP COLUMN` 대신
  **가드 트리거만 0041 판본으로 되돌린다**(D1 DROP COLUMN 은 재작성 비용·위험이 크다 — 컬럼은 NULL 로 남겨도 무해).
- 러너 커버리지 표기: 순수 코어 + 리포트 문자열이라 revert 시 기존 동작 그대로.

## 0047 적용이 **막게 되는 것** (독립 리뷰 MAJOR — 정직 기록)

"막지 않는 것"만 적으면 절반이다. 이 마이그는 **기존 산출물의 재실행을 막는다**:

- `docs/batch-load/**` 의 `knowledge_nodes` INSERT 보유 SQL **16개 전부**가 `batch_id` 를 선언하고
  `source_quote` 를 갖지 않는다 → 0047 적용 후 **멱등 재실행이 ABORT**(실측 재현: gap-P1 첫 INSERT 에서 ABORT).
  이 파일들은 "재실행 시 0행"을 설계 속성으로 갖던 산출물이므로, 재실행이 필요하면 **원문 열 추가가 선행**이다.
- 신규 적재분(E0-8 P4~P6 등)은 **`source_quote` 열이 필수**가 된다 — 대시보드 §C 자율 큐에 반영 필요.

## 범위 외 (명시 이월)

- **STAGE 3 검사기**(인용 진위·앵커 충분성·값 정합) — 2-1~2-4 완료가 진입 조건.
- **교재 카드 백필**(법령 외) — STAGE 3 파일럿 결과로 범위 결정(체크리스트 2-4 문면).
- **formulas/constants 적재 의무화** — 적재 선언 컬럼 부재. WS-3c variant 24 큐와 함께 별건.
- **`exam_questions` 정답↔해설 인용**(분석 §T1-1 적용 표면 ③) — 스키마·출처가 다른 축, 별건.
- 러너 CI 배선 (직전 plan 원장 L-4) · 0043(formulas/constants 은퇴) · 0040(WS-6c).

## 승인 기록

- 2026-08-08 진산 **"stage 2 진행"** — 대시보드 §A #7 (권고 (a) 백필 포함) 채택
- (대기) 0047 production 적용 + 59장 백필 실행 = 별도 인증 게이트 (묶어서 상신)
