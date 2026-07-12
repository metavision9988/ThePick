# old 525행 처분 상태머신 마이그 (슬롯 0044) — L3 plan

- **작성**: 2026-07-12 (Fable 5). STATUS: **DRAFT — §9 진산 결재 후 production 적용** (SQL·게이트 스크립트는 선작성 라벨 관례 — TR-0/RW 선례).
- **북극성 연결**: 정답 100% Hard Stop — production old 525행 중 **36건이 오답인 채 status='active'** 로 잔존(`docs/audit/incident-1st-answer-errors-20260710.md`). 서빙은 가드로 한시 차단 중이나 데이터 자체가 거짓 상태.
- **격상 근거**: 5-페르소나 P5 리뷰 **RC-1 최대 진앙**(D-02 CRITICAL 정본 해소 + D-09/D-14/D-18/D-30/D-34 동승) — **인증 1차 학습 오픈 선결 게이트**로 승격 기결(promo 원장 §8.2b).
- **전제 실측**: 2026-07-12 독립 조사(트리거 계보·CHECK·status 소비 전수·매핑·FK·슬롯) — 본문 인용 전부 file:line 검증됨.

## 1. 현 상태 (실측 사실)

| 항목         | 사실                                                                                                                                                                         |
| :----------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| old 행       | 1차 525행 = `exam_type='1st' AND input_type='fill_blank' AND id NOT LIKE '%-MC'` — 전부 status='active', 위치라벨 answer(서빙 부적격), **36건 오답**                         |
| -MC 행       | 521행(구조훼손 4 제외) — 교정 36 반영 완료, 유일 서빙 정본                                                                                                                   |
| 트리거       | production 현행 = **0004 전면 UPDATE ABORT**. 0038(선작성·결재완료·**production 미적용**)도 status/superseded*by/valid*\* ABORT 유지 → **어느 쪽이든 상태 전이 UPDATE 불가** |
| status CHECK | `('active','deprecated','flagged')` (0001:128) — **'deprecated' 기존재** = 신규 값·테이블 재생성 불필요                                                                      |
| SUPERSEDES   | exam*questions 는 컬럼(superseded_by TEXT)만 있고 자동화·감사 경로 0 (0042 트리거는 knowledge*\* 전용, status_transitions CHECK 에 'exam' 없음)                              |
| 참조         | user_progress/study_reviews.card_id → exam_questions **FK 없음**(논리 참조) — 전이해도 DB 차단·cascade 없음, 이력 JOIN 은 상태 무관 유지됨                                   |
| 소비         | 서빙·채점·집계 주 경로 전부 `status='active'` 필터 → **deprecated 전이 = 전 표면 자연 배제** (0037 partial index 도 active 한정)                                             |
| 한시 가드    | `study/serving-guard.ts`(C-1) + full-pool refetch(D-02) — 데이터 상태 결부 임시물, 마이그 후 폐기 대상(D-34)                                                                 |

## 2. 목표 상태 (Binary)

1. old 525 전부 `status='deprecated'` + `valid_until=<적용시각>` + `superseded_by = id||'-MC'`(짝 실재 521) / 구조훼손 4건은 `superseded_by NULL`(짝 없음 — 재적재는 콘텐츠 트랙).
2. `active AND exam_type='1st'` = **정확히 -MC 521 (전부 multiple_choice)**.
3. 학습·공개 전 표면에서 old 행 자연 배제(가드 없이) — D-02 전 풀 재조회 경로 발동 0.
4. 정답 교정 36 이 영속 기계 게이트로 재검산 가능(D-14).

## 3. 처분 방식 — PITR (선택지 비교)

| 안           | 내용                                                                                                     | 판정                                                                                                                                                             |
| :----------- | :------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A (권고)** | **마이그 0044: 트리거 브래킷**(DROP → UPDATE 전이 → 재생성) + status='deprecated' + superseded_by 백링크 | ✅ 표준 마이그 패턴(트리거는 런타임 애플리케이션 실수 차단용, 마이그 = DDL 컨텍스트). 0038 본문 그대로 재생성 = 정책 불변. 감사 = 마이그 파일+게이트 리포트 영속 |
| B            | 저장 프로시저 `deprecate_exam_question()`(0004:13 주석의 Phase 2 구상)                                   | ❌ SQLite/D1 에 저장 프로시저 없음 — 실현 불가                                                                                                                   |
| C            | `input_type` 재분류(0038 화이트리스트 허용 컬럼)로 서빙 풀에서만 배제                                    | ❌ 무마이그 즉시 가능하나 **의미 거짓**(essay 아님) + 오답 36 status='active' 잔존 + 감사성 최악                                                                 |
| D            | 0038 선작성본 자체 개정(상태 전이 화이트리스트 추가)                                                     | ❌ formal sign-off 번들(ADR-046) 불변 원칙 + staging 기적용 — 재결재·드리프트 유발                                                                               |

## 4. 마이그 0044 설계 (선작성 SQL = `migrations/0044_exam_questions_old_rows_retirement.sql`)

> 슬롯: 0039(WS-2b)/0040(WS-6c)/0043(formulas 가드) 예약 실측 → **0044 배정**. 작성 시점 migrations/ 재실측 의무(07-02 슬롯충돌 교훈).

```sql
-- ① 현행 body 가드 일시 해제 (0044 적용 시점의 현행 = 0038 트리거.
--    production 은 pending 순차 적용으로 0038 이 0044 직전에 적용됨 — §6 참조)
DROP TRIGGER IF EXISTS prevent_exam_questions_body_update;
DROP TRIGGER IF EXISTS prevent_exam_questions_update; -- 방어적(0004 잔존 케이스)

-- ② old 525 전이 — 대상 술어 = 1차 + fill_blank + 비-MC id (실측상 old 525 와 정확 일치,
--    사전 게이트 G-OLD-2 가 분모 525 를 기계 검증)
UPDATE exam_questions
   SET status = 'deprecated',
       valid_until = datetime('now'),
       superseded_by = CASE
         WHEN EXISTS (SELECT 1 FROM exam_questions m WHERE m.id = exam_questions.id || '-MC')
           THEN exam_questions.id || '-MC'
         ELSE NULL
       END
 WHERE exam_type = '1st'
   AND input_type = 'fill_blank'
   AND status = 'active'
   AND id NOT LIKE '%-MC';

-- ③ 0038 트리거 원문 재생성 (정책 불변 — 0038 파일 본문과 byte-수준 동일 유지 의무)
CREATE TRIGGER prevent_exam_questions_body_update ... (0038:42-64 CREATE TRIGGER~END; 원문 복제 — WHEN enumeration byte-동일)
```

- **다운 스크립트**(별도 보관, migrations/ 밖 — 런북 규약): 트리거 브래킷 + 역전이(`status='active', superseded_by=NULL, valid_until=NULL` WHERE status='deprecated' AND exam_type='1st' AND input_type='fill_blank' AND id NOT LIKE '%-MC').
- **비채택 기록**: status_transitions 감사행 기록 — target_type CHECK 에 'exam' 부재, CHECK 개정 = 테이블 재생성 과중 → 감사는 본 plan+마이그 파일+G-OLD 리포트 영속으로 갈음(§9 Q5).

## 5. Binary Gates (G-OLD-1~8) + 게이트 스크립트 (`scripts/verify-old-rows-retirement.mjs` 선작성)

| #       | 시점 | 판정 (기계)                                                                                                                                                           |
| :------ | :--- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G-OLD-1 | pre  | **answer-integrity**: production -MC 행 answer == `answer-corrections.json` corrected 36/36 + exclusions 4 실재 + pending=[] (D-14 영속 게이트 — post 에도 동일 실행) |
| G-OLD-2 | pre  | 워터마크: 대상 술어 분모 == **525** / -MC == **521** / 교집합 0 (D-30)                                                                                                |
| G-OLD-3 | pre  | R2 오프사이트 백업 당일 스냅샷 실재(`scripts/backup-d1-to-r2.sh` — 런북 §10)                                                                                          |
| G-OLD-4 | post | old 525 전부 deprecated + superseded_by 521 건 전부 -MC 짝 실재(JOIN 검산) + NULL 4건 == 구조훼손 목록(Q-2019-05-021·Q-2024-10-048·Q-2025-11-047·Q-2025-11-048)       |
| G-OLD-5 | post | `active AND exam_type='1st'` == 521 == 전부 multiple_choice                                                                                                           |
| G-OLD-6 | post | 공개 표면 스모크 14/14 (`smoke-public-surface.mjs`) + api 로컬 전체 회귀 0                                                                                            |
| G-OLD-7 | post | 인증 /next 전 풀 재조회 fallback 로그 발동 0 (D-02 소멸 검증 — 로컬 시나리오 테스트로 기계화)                                                                         |
| G-OLD-8 | 후속 | **가드 폐기 커밋**(별도 4-Pass): serving-guard/OVERSAMPLE/full-pool refetch 제거 + D-18 동치 불변식 주석 복원 + 관련 테스트 개정 — 마이그 적용 확인 후에만            |

- 로컬 시나리오 테스트 선작성: `apps/api/src/__tests__/scenarios/migration-0044-old-rows-retirement.test.ts` (0038/0041/0042/0044 순차 적용 위에서 전이·게이트 재현 — 기존 migration-0038 테스트 관례).

## 6. production 적용 시퀀스 (진산 게이트 — 불가역)

`wrangler d1 migrations apply thepick-db-production --env production --remote` 는 **pending 전부 순차 적용** = **0038 + 0041 + 0042 + 0044 일괄**. 각각의 상태: 0038 = plan·ADR-046 결재 완료(TR-0 게이트 #3 미수행분) / 0041·0042 = RW 선작성(리뷰 C0/M9 처분 완료, production 적용 = 기존 게이트) / 0044 = 본 plan. **staging 은 0042 까지 기적용(07-10 동기화)** → staging 에 0044 선적용·G-OLD 전 게이트 통과 후 production. ⇒ §9 Q3 은 사실상 **TR-0 #3·RW 게이트를 함께 여는 결재**임을 명시(숨김 없음).

## 7. 동승·비동승 처분 (5-페르소나 귀속)

- **동승**: D-14(G-OLD-1 영속 스크립트) / D-30(G-OLD-2) / D-02·D-09·D-34(G-OLD-7·8 폐기 경로) / D-18(마이그 후 공개 521 == 인증 active 분모 자연 정합 — G-OLD-8 에서 주석·테스트 복원).
- **비동승(이월 유지)**: RC-2 servable 물질화 컬럼(D-06) — 0038 화이트리스트 개정 필요 + old 행 배제 후 긴급도 하락 → 별도 카드 / D-05(/grade↔/reveal 중복) = 코드 정리 카드 / old 행 answer 정정 = §9 Q4.

## 8. 리스크

- 트리거 브래킷 사이 창(마이그 트랜잭션 내) — wrangler d1 migrations 는 파일 단위 배치 실행, 동시 트래픽의 UPDATE 는 애플리케이션에 없음(코드 UPDATE 경로 0 실측) → 실위험 극소.
- user_progress 의 old id 참조 이력 — 전이 후에도 JOIN 유지(이력 화면 정상). 신규 학습은 -MC 로만 축적. FSRS 이력 분열(M-9)은 test 계정뿐(라이브 인증 사용자 0) — 이관 비채택(§9 Q4 각주).
- down 시 -MC 와 old 동시 active = 이중 서빙 복귀 — down 은 비상용(런북 LIFO), G-OLD-2 재실행 의무.

## 9. 결재란 (진산 — RULE #5)

| #   | 질문                                                                                                                       | 선택지             | 결정 |
| :-- | :------------------------------------------------------------------------------------------------------------------------- | :----------------- | :--- |
| Q1  | 처분 방식 = **A안**(0044 트리거 브래킷 + deprecated 전이 + superseded_by 백링크)                                           | A / C(임시 재분류) | ☐    |
| Q2  | 구조훼손 4건 = deprecated + superseded_by NULL (재적재 = 콘텐츠 트랙 이월)                                                 | 채택 / 보류        | ☐    |
| Q3  | **production 적용**(= pending 0038·0041·0042·0044 일괄, staging 선검증 후) — TR-0 #3·RW 게이트 동시 해소임을 인지하고 승인 | 승인 / 보류        | ☐    |
| Q4  | old 행 answer 오답 36 = **비정정 유지**(deprecated 후 비서빙 — 정본 지시는 superseded_by, 이력 불변 원칙)                  | 비정정 / 정정      | ☐    |
| Q5  | status_transitions 'exam' 확장 **비채택**(감사 = plan+마이그+게이트 리포트 영속)                                           | 채택 / 확장        | ☐    |

**결재 후 실행 순서**: SQL·게이트 스크립트·시나리오 테스트 선작성(라벨) → 독립 4-Pass → staging 적용+G-OLD 전 게이트 → production 적용(불가역 1줄 고지) → G-OLD-4~7 → 가드 폐기 커밋(G-OLD-8, 별도 4-Pass) → incident 원장·CLAUDE.md 동기.
