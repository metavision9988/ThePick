# 핸드오프 — 역이식 STAGE 4 선결 완료 시점 (2026-08-10, 리부팅 전)

> **재시작 후 이 파일부터 읽고 §7 "재개 지점"으로 가면 된다.**
> 작성 사유: 시스템 리부팅. **미커밋 0 · 상주 프로세스 0 · production 무접촉** — 잃을 상태가 없다.

---

## 1. 지금 상태 (실측)

| 항목                | 값                                                               |
| :------------------ | :--------------------------------------------------------------- |
| 브랜치              | `main` · **origin 대비 8커밋 ahead (push 안 함)**                |
| 마지막 커밋         | `788d64c` 제3의 주소원 + 캘리브레이션 표면 동결 + 표적 비용 추정 |
| 미커밋 변경         | **0** (워킹트리 clean)                                           |
| 리뷰 마커           | 없음 (`.claude/.review-pending` 해제됨)                          |
| 백그라운드 프로세스 | 없음 (wrangler/vitest watch 등 상주 0)                           |
| 역이식 진행         | **21/31** (`grep -c '^- \[x\]'` 실측 — 오늘 체크박스 증감 없음)  |

### 오늘(08-10) 커밋 3건

```
788d64c  제3의 주소원 + 캘리브레이션 표면 동결 + 표적 비용 추정 (잔여 4건 처분)
168215f  백필 검수 재검증 신설 + 이월 8건 처분 (검수 A/B 58/58 · 적재 차단 0)
b61cab9  STAGE 4 선결 ①·② + ★백필 오귀속 인용 적용 전 포착 (독립 리뷰 2렌즈 CRITICAL 4)
```

### 회귀 기준선 (마지막 전건 green)

```
build 3/3 · test 18/18 · typecheck 18/18 · lint 18/18 · G-1 PASS
  api 859 · batch 332 · quality 119 · web 79 · ai-adapter 13 · autoverify 67 · scripts 28
추출 게이트 58/58 위반 0 (의도적 제외 1 = LAW-202)
검수 재검증  A 58/58 · B 58/58 · C 50/58 · C2 48/58 · D 58/58
파일럿       대상 58 · pass 12 · queue 42 · reject 4
```

※ `formula-engine`/`quality` 의 wall-clock 성능 테스트는 **동시 실행 부하에서 간헐 red** — 단독 실행 시 통과.

---

## 2. ★오늘 가장 중요한 사건 — 되돌릴 수 없는 백필에 실릴 뻔한 데이터 결함을 적용 전에 잡았다

독립 리뷰(렌즈 1)가 내 서술 **"실패 9건은 전부 주소 오류"가 거짓**임을 반증했다.

**LAW-178 은 선언 주소(요령 p.817)가 옳았고 인용이 틀렸다** — 저장된 인용이 교재 본문의
다른 서술 조각이었다(오귀속). 3-1 이 진짜 데이터 결함을 잡았는데 내가 "주소 탓"으로 오분류해
덮을 뻔했고, 그 인용은 `backfill-source-quote.sql` 에 실려 있었다.
**0047 은 `source_quote` 를 NULL→값 1회로 고정하므로 적용됐으면 영구 고착이었다.**

근본 원인 = 추출 정규식 2개 결함의 연쇄:

- `^\d+\.\s+\S` 가 **조문 안의 호 열거를 조문 경계로 오인** → 제12조가 43자로 절단 → 60자 하한 미달
  → 전 문서 스캔 폴백
- 헤드 제목 검사가 느슨해(조번호 뒤 40자 창) **본문 서술문을 조문으로 오인** → `max(len)` 이 서술문 선택

⇒ 경계 삭제 + `제N조(제목)` 괄호형 강제. **파급 22건 전부 절단 복원 방향.**
★이 한 줄이 08-08 리뷰가 "진짜 성과"로 꼽은 **인용 절단 8건의 단일 근본원인**이었고,
**LAW-195 응시수수료 `1. 제1차 시험 : 2만원 / 2. 제2차 시험 : 3만3천원` 이 복원됐다**
(CLAUDE.md 가 "65%→60% = 서비스 사망"으로 못박은 상수 클래스가 인용에서 통째로 빠져 있었다).

---

## 3. 오늘 만든 것 (재시작 후 존재를 알아야 할 도구)

| 도구                                                             | 무엇                                                                           |
| :--------------------------------------------------------------- | :----------------------------------------------------------------------------- |
| `docs/batch-load/stage2-source-quote/audit_source_quotes.py`     | **검수 정본 생성기** → `review-audit.md` (A 축자·B 귀속·C 주소·C2 색인·D 꼬리) |
| `docs/batch-load/stage2-source-quote/article_index.py`           | **제3의 주소원** — PDF 구조만 보는 조문 head 색인 → `article-index.json`       |
| `packages/autoverify/src/calibration-surface.ts`                 | **캘리브레이션 표면 동결** — 임계 3 + 제외 규칙군 5(27줄) 지문                 |
| `scripts/estimate-threshold-cost.ts`                             | 표적(AI 저작) 코퍼스에서 임계 1.0 비용 시뮬레이션                              |
| `docs/batch-load/stage2-source-quote/review-verdict-20260810.md` | **검수 소견서** — reject 4 전수 판독 + **진산 표본 감사 8행**                  |
| `docs/audit/description-meta-notes-20260810.md`                  | description 빌드 메타 주석 25건 인벤토리 + 처분 3안                            |

★**폐기됨**: `review-sheet.md` → 폐기 스텁. 검수는 **`review-audit.md`** 로만 한다(정본 이원화 금지).

### 재실행 명령 (경로가 특이하니 그대로 복사)

```bash
# Python (venv 경로 주의)
packages/parser/.venv/bin/python3 docs/batch-load/stage2-source-quote/extract_source_quotes.py
packages/parser/.venv/bin/python3 docs/batch-load/stage2-source-quote/gate_check.py
packages/parser/.venv/bin/python3 docs/batch-load/stage2-source-quote/article_index.py
packages/parser/.venv/bin/python3 docs/batch-load/stage2-source-quote/build_backfill.py
packages/parser/.venv/bin/python3 docs/batch-load/stage2-source-quote/audit_source_quotes.py

# TS (루트에 tsx 없음 — quality 패키지 것을 쓴다)
packages/quality/node_modules/.bin/tsx scripts/run-autoverify-pilot.ts
packages/quality/node_modules/.bin/tsx scripts/estimate-threshold-cost.ts
```

⚠️ 산출물 JSON 은 스크립트가 `indent=1` 로 쓰고 커밋본은 prettier(`indent 2`)다 —
**재실행 후 `npx prettier --write` 하지 않으면 의미 동일·바이트 상이 diff 가 뜬다.**

---

## 4. 오늘 배운 것 (같은 실수 재발 방지 — 재시작 후에도 유효)

1. **검사가 낸 신호를 데이터를 고쳐 0으로 만들지 마라.** 08-08 에 3-1 이 낸 9건을 "검사 입력 결함"으로
   규정하고 청크를 옮겨 지웠는데, 그게 진짜 발견이었다. 오늘 상법 주소를 고치지 않고 **병기만 한** 이유다.
2. **"독립 확증"이라는 단어를 함부로 쓰지 마라.** 두 값이 같다고 독립이 아니다 —
   추출 창(−1..+3)과 청크 창(−1..+2)은 같은 술어였다(리뷰 C-3 로 철회).
3. **임계만 동결하면 동결한 척이다.** 제외 규칙 한 줄이 임계와 같은 효과를 낸다(파일럿 `reject 30→11` 실증).
4. **게이트는 만든 즉시 고의로 깨서 확인한다.** 오늘 검수표에 변이 3종 주입 → 3종 전부 검출로 확인했다.
5. **손 미러를 손으로 검증하지 마라.** 수치 판정을 파이썬으로 다시 짜지 않고 TS 엔진 산출물을 읽는다.
6. **게이트를 리뷰 전에 ☑ 하지 마라.** 오늘 `G-REVIEW` 를 없는 파일을 인용해 체크했다(리뷰 C-1, `[ ]` 원복).

---

## 5. production 상태 — **전부 미적용 · 전부 가역**

```
마이그 0039 · 0045 · 0046 · 0047  →  넷 다 미적용
58장 백필                          →  미실행 (source_quote 커버리지 0/551)
D1 쓰기                            →  0 (오늘 전 작업이 로컬 산출물 + SELECT 만)
```

⇒ 리부팅으로 잃을 production 상태가 없다. 로컬 커밋 8개만 push 대기.

---

## 6. 진산 대기 (재시작 후 물어볼 것)

| #   | 무엇                                                | 권고                                                                                    |
| --- | :-------------------------------------------------- | :-------------------------------------------------------------------------------------- |
| 1   | **표본 감사 8행** (`review-verdict-20260810.md` §6) | `review-audit.md` 에서 머리·꼬리만 훑기 → "전부 이상 없음" / "N번 이상함"               |
| 2   | **주소 정정 10건** (상법 8 + LAW-189·199)           | (a) 로컬 인벤토리 `pdf_page` 만 정정(가역·저위험) ← 권고 / (b) D1 `book_page` = 별건 L3 |
| 3   | **description 메타 주석 25건**                      | 표시 계층 차단 먼저 → SUPERSEDES 재적재는 다음 개정 사이클 → 근본은 적재 계약 게이트    |
| 4   | **held-out 세트 확보** (대시보드 §A #8)             | AI 가 만들 수 없다(데이터 없음). 잴 대상(표면)은 동결 완료                              |
| 5   | 대시보드 §A #10 (0039+0045+0046+0047 적용 + 백필)   | **적용 전 `review-audit.md` 재검수 → 정정 → 재생성 → 적용** 순서 불변                   |

---

## 7. ★재개 지점 (재시작 후 여기서 시작)

### 먼저 확인 (30초)

```bash
git log --oneline -3          # 788d64c 가 HEAD 인가
git status --short            # 비어 있어야 한다
grep -c '^- \[x\]' docs/plans/catchall-역이식-체크리스트.md   # 21
```

### 그다음 갈림길

- **진산이 위 §6 중 하나에 답했다면** → 그 항목 처리. 2·3번은 AI 가 바로 집행 가능(가역).
- **답이 없고 계속 진행하라면** → **STAGE 4 본체**(체크리스트 `## STAGE 4`):
  - `4-1` 빠뜨린 구간 자동 색출 (교재는 법령과 구조가 달라 **이 부분만 새로 만들어야 한다**)
  - `4-2` 시점·극성 검사
  - `4-3` ★정답지 만들기 — **held-out 과 같은 문제**다. 진산 판단 선행 권장
  - `4-4` 신뢰구간 계산기 / `4-5` 승격 후속 작업 원장
- **STAGE 4 착수 전 읽을 것**: `.claude/reviews/review-20260810-stage4-prereq.md` §처분 기록
  (무엇이 해소됐고 무엇이 이월인지 표로 있다)

### 남아 있는 기술 부채 (STAGE 4 이월, 비차단)

`stripNonValues` 잔여 갭 2종(문자만 남고 값은 안 만듦 — 테스트로 고정됨) ·
`G-S3-3` 이름("짜깁기 탐지") ↔ 실제 의미(정확 포함) 불일치 개명 ·
`how` 문자열 계약 스키마 없음(L-m5 는 `address_hit` 필드로 해소, `how` 자체는 사람용) ·
`lcsRatio` 최악 14.1ms(오프라인이라 무해하나 "Workers-safe" 표방과 긴장).

---

## 8. 핵심 문서 지도

| 목적               | 경로                                                              |
| :----------------- | :---------------------------------------------------------------- |
| **진행 단일 정본** | `docs/plans/catchall-역이식-체크리스트.md` (21/31)                |
| 현 작업 plan       | `docs/plans/current.plan.md` (STAGE 3 · 게이트 마감 상태)         |
| **결재 단일 채널** | `docs/plans/APPROVAL_DASHBOARD.md` §A #10 + §이력 08-10 2건       |
| **오늘 리뷰 정본** | `.claude/reviews/review-20260810-stage4-prereq.md` (2렌즈 + 처분) |
| 직전 리뷰          | `.claude/reviews/review-20260808-stage3-autoverify.md` (§9 추기)  |
| **검수 시트**      | `docs/batch-load/stage2-source-quote/review-audit.md`             |
| **검수 소견서**    | `docs/batch-load/stage2-source-quote/review-verdict-20260810.md`  |
| 파일럿 리포트      | `docs/audit/autoverify-pilot/pilot-2026-08-10T14-13-13.md`        |
| 임계 비용 추정     | `docs/audit/autoverify-pilot/threshold-cost-estimate.md`          |
| 메타 주석 인벤토리 | `docs/audit/description-meta-notes-20260810.md`                   |
| 이식원             | `/home/soo/ClaudePro/catchall/packages/extraction/`               |
