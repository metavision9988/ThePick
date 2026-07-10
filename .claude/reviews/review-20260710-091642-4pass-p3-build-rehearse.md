# 4-Pass 독립 리뷰 — promo-1st P3 빌드/리허설 스크립트 (재작성판)

- **일시**: 2026-07-10 09:16 KST
- **리뷰 방식**: 독립 에이전트 1개(4관점 Surgeon/Architect/Advocate/Contract) + 발견별 근거 대조. 코드 작성 맥락 비공유(의도 편향 차단, 규칙 0).
- **대상**:
  - `scripts/promo-p3/build-mc-inserts.ts` — 원 batch JSON → 신규 `{id}-MC` INSERT SQL 생성 + V1~V5 결정적 게이트 + 교정 오버레이(answer-corrections.json) 적용 + 구조훼손 exclusions
  - `scripts/promo-p3/rehearse-local.ts` — in-memory SQLite(전 마이그 0004/0038 트리거 + old 525 + 신규 MC) R1~R5(+R2b byte-동등) 왕복 검증
- **연관**: `docs/batch-load/promo-mc-distractors/answer-corrections.json`(교정 36·제외 4), `packages/learning-modes/src/input-types/mc-choices.ts`(parseMcChoices 단일 정본)
- **맥락**: P3 = 4지선다 서빙용 신규 MC 행 적재. old 행 무접촉(0004/0038 UPDATE ABORT) 순수 INSERT 전략. 회차별 독립 PDF 대조 7 + 맹검 2차 재확증 3 + R5 Q46 타이브레이커가 원 JSON 정답 36건 오류를 적발 → 교정 오버레이가 필수 안전층으로 격상.

## 판정 요약

| 관점                 | Critical | Major | Minor |
| -------------------- | -------- | ----- | ----- |
| Surgeon (코드정합성) | 0        | 0     | 1     |
| Architect (연계)     | 0        | 1     | 2     |
| Advocate (안전·엣지) | 1        | 0     | 2     |
| Contract (기획대조)  | 1        | 0     | 0     |
| **합계**             | **2**    | **1** | **5** |

초기 판정 = **수정 필요**. 아래 처분 후 재검증 = **완료 가능**(Critical 0 / Major 0 잔존).

## 발견 및 처분

### C-1 (Advocate, Critical) — `loadOverlay()` 파일 부재 무음 빈-반환 → **수정 완료**

- **결함**: answer-corrections.json 부재 시 `{corrections:[], exclusions:[]}` 무음 반환 → 확정 오답 36건이 원본 answer 그대로 SQL 생성 + 구조훼손 4건 미제외 + 전 게이트 green. 실패 시나리오가 디스크에 실재했음(직전 08:41 세대 SQL이 교정 0 반영).
- **수정**: `loadOverlay()` 파일 부재 = `throw`(fail-loud). 오버레이는 이제 필수 안전층 — 부재 시 확정 오답 무음 서빙 위험. `build-mc-inserts.ts:121` 헤더 + throw.
- **재검증**: 음성 테스트 — 파일 삭제 후 빌드 `exit=1` + 메시지 `C-1` 출력 확인.

### C-2 (Contract, Critical) — `_meta.pending` 미소비 → **수정 완료**

- **결함**: `_meta.pending:["Q-2019-05-046"]`(3중 발산 미확정)을 코드가 소비하지 않음 → 계쟁 정답 '4'로 무음 생성·서빙 = 불변식 1(정답 100%) 위반. `_meta.confirmed ↔ corrections.length` 교차검산도 부재.
- **수정**: (a) R5 Q46 타이브레이커로 확정("1", 정답지 400dpi 직접판독 A형·B형 + 손해평가요령 제13조 종합위험방식 풀이 + LAW-179 원문 대조, 2:1 다수) → corrections 편입, `pending:[]`. (b) `loadOverlay()`에 하드 사전조건: `pending` 비어있지 않으면 throw + `confirmed ≠ corrections.length` throw.
- **재검증**: 음성 테스트 2건 — pending 주입 시 `exit=1`+`C-2`, confirmed 불일치 시 `exit=1`+`자기모순`.

### M-1 (Architect, Major) — 리허설이 validation-report 자기주장 무조건 신뢰 → **수정 완료**

- **결함**: ① `report.violations.length===0` 미확인(빌드 exit 1 후에도 남은 회차 SQL 무검증 통과 경로). ② 교정 기대값을 정본 파일이 아닌 report 내 echo(`report.overlay`)로 구성 → report↔정본 신선도 미검증.
- **수정**: rehearse에 (a) `report.violations.length>0` throw, (b) 교정 기대값을 `answer-corrections.json` 직접 로드, (c) report.overlay ↔ 정본 서명(id=corrected 정렬) 대조로 stale report throw. `rehearse-local.ts` 헤더 블록.
- **재검증**: 정상 경로 R1~R5 PASS(정본 로드 경로) 확인.

### m-3 (Advocate, Minor) — R4 old 행 검사 심층방어 → **반영(심층방어)**

- 생성 SQL 텍스트에 `\b(UPDATE|DELETE)\b` 부재 assert 추가(`rehearse-local.ts` 회차 적용부). 트리거 방어 + 코드 사실 이중 보증. 현 빌드는 INSERT만 생성 → 무해하나 회귀 가드.

### m-5 (Surgeon, Minor) — 교정 ∩ 제외 겹침 무음 허용 → **반영**

- `loadOverlay()`에 교정∩제외 겹침 + id 중복 throw 추가. 현재 겹침 0.

### m-1 (Architect, Minor) — 리허설 마이그 전량에 미적용 0041/0042 포함 → **주석 기록(무해)**

- 두 파일 모두 exam_questions 무접촉(grep 확증). 리허설이 production보다 엄격한 트리거 셋에서 도는 것은 의도. 향후 마이그 추가 시 드리프트 축으로 관측.

### m-2 (Architect, Minor) — 생성 SQL `PRAGMA foreign_keys=ON` remote 호환 → **주석 기록(fail-loud)**

- 적용된 마이그 0002/0005/0011에 선례 있어 통과 개연성 높음. 실패해도 fail-loud(원격 적용 시 즉시 에러).

### m-4 (Advocate, Minor) — R3 '①' 단일 마커 오탐 가능 → **주석 기록(fail-loud)**

- 정당한 ① 포함 stem은 오탐 차단하나 fail-loud라 데이터 위험 0(잘못 생성 방지). 현 픽스처에서 미발동.

## 0건 확인 증거 (리뷰어 원본 — 실제 확인)

- **old 행 무접촉**: 생성 stmt = 순수 `INSERT...SELECT` 단일; 0004(BEFORE UPDATE)·0038(BEFORE UPDATE)·0018(knowledge_nodes 대상) 모두 INSERT 무영향; (year,round,question_number) UNIQUE 부재.
- **이스케이프/정규식**: `sqlEscape` `''` 배증 = SQLite 정본, 무손실은 R2b byte-동등 왕복 확증. quoted-atom `'((?:[^']|'')*)'` 경계 월경 불가(직전 MAJOR-1 정정 유효).
- **V5 오적용 차단**: `correction.original !== q.answer` 위반 처리 + 고아 교정/제외 검출 실재.
- **결정성**: Date.now/Math.random 0, 고정 ROUNDS + JSON 배열 순서, stale SQL 선삭제, report 무타임스탬프.

## 처분 후 재검증 (기계 실행)

- `build-mc-inserts.ts`: `pass=521 excluded=4 corrected=36 / total=525 · violations=0 ✅`
- `rehearse-local.ts`: `R1~R5 전부 PASS ✅ (old 525 무변경 · 신규 MC 521 계약+byte-동등 왕복 · 트리거 통과)`
- 음성 테스트: C-1(파일 부재)/C-2(pending)/C-2(confirmed 불일치) 3건 전부 `exit=1` + 정확 메시지.

## 최종 판정: **완료 가능** (Critical 0 / Major 0 잔존, Minor 3 주석 기록·무해)
