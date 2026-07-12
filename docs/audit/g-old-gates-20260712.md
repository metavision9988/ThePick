# G-OLD 게이트 실행 리포트 — 0044 old 행 처분 (2026-07-12)

> plan §9 Q5 감사 갈음 조건 이행: plan + 마이그 파일 + **본 게이트 리포트** 영속.
> 실행 주체 = Fable 5 (진산 §9 결재 2026-07-12 하 위임 집행). 전 검산 = SELECT-only 재실행 가능.

## 적용 이력

- staging: `wrangler d1 migrations apply thepick-db-staging --env staging --remote` → 0044 ✅ (0038~0042 는 07-10 동기화로 기적용)
- production: `wrangler d1 migrations apply thepick-db-production --env production --remote` → 0041·0042·0044 ✅ (0038 은 원장상 기적용 — post 트리거 검산으로 실체 확인)
- pre 백업: R2 thepick-backups/d1/production/20260712T081529Z.sql (G-OLD-3, 2.8MB)

## production pre 게이트 (적용 전 실행분 재현 기록)

```
G-OLD-1a~d PASS (corrections 36/36·exclusions 4·pending 0) / G-OLD-2a old=525 active=525 / G-OLD-2b MC=521 / G-OLD-3 백업 완료
```

## production post 게이트 (본 리포트 생성 시점 재실행)

```
PASS  G-OLD-1a corrections 정본 무결(pending 0)
PASS  G-OLD-1b corrections 36건 — 36
PASS  G-OLD-1c exclusions 4건 — Q-2019-05-021,Q-2024-10-048,Q-2025-11-047,Q-2025-11-048
PASS  G-OLD-1d -MC answer == corrected 36/36 — rows=36
snapshot(production): {"old_total":525,"old_active":0,"old_deprecated":525,"mc_total":521,"active_1st":521,"active_1st_non_mc":0}
PASS  G-OLD-4a old 전부 deprecated (active 0) — deprecated=525/525 active=0
PASS  G-OLD-4b superseded_by 521건 전부 active -MC 짝 실재 — 521
PASS  G-OLD-4c NULL 4건 == 구조훼손 목록 — Q-2019-05-021,Q-2024-10-048,Q-2025-11-047,Q-2025-11-048
PASS  G-OLD-5 active 1st == 521 == 전부 MC — active=521 nonMc=0
PASS  G-OLD-post 트리거 재생성(prevent_exam_questions_body_update) — enforce_exam_questions_year_not_null,enforce_exam_questions_content_not_null,enforce_exam_questions_status_not_null,enforce_exam_questions_created_at_not_null,prevent_exam_questions_body_update
🟢 PASS — 9/9 checks (post, production)
```

## staging post 게이트 (재실행)

```
PASS  G-OLD-1a corrections 정본 무결(pending 0)
PASS  G-OLD-1b corrections 36건 — 36
PASS  G-OLD-1c exclusions 4건 — Q-2019-05-021,Q-2024-10-048,Q-2025-11-047,Q-2025-11-048
PASS  G-OLD-1d(staging) -MC 교정 리포트만 — rows=0/36
snapshot(staging): {"old_total":450,"old_active":0,"old_deprecated":450,"mc_total":0,"active_1st":0,"active_1st_non_mc":0}
PASS  G-OLD-4a old 전부 deprecated (active 0) — deprecated=450/450 active=0
PASS  G-OLD-4(staging) dangling 링크 0 (linked+null == deprecated) — linked=0 null=450 deprecated=450
PASS  G-OLD-5(staging) active 1st 비MC == 0 — active=0
PASS  G-OLD-post 트리거 재생성(prevent_exam_questions_body_update) — enforce_exam_questions_year_not_null,enforce_exam_questions_content_not_null,enforce_exam_questions_status_not_null,enforce_exam_questions_created_at_not_null,prevent_exam_questions_body_update
🟢 PASS — 8/8 checks (post, staging)
```

## G-OLD-6 공개 표면 스모크 (재실행)

```
PASS  경계 — 미존재 id 404 QUESTION_NOT_FOUND — status=404 error=QUESTION_NOT_FOUND

🟢 PASS — 14/14 checks (https://thepick-api-production.metavision9988.workers.dev)
```

## G-OLD-7 기계화

- apps/api/src/study/**tests**/routes.test.ts ★G-OLD-7 테스트 — deprecated 자연 배제 + -MC 서빙 (api 785 PASS 포함)

## 관측 (staging 데이터 드리프트 — 정직 기록)

- staging 1st = deprecated 450 / active 0 (-MC 미적재·분모 상이) — 데이터 처분 마이그의 staging 리허설 검출력 한계. 후속: staging -MC 동기화 카드(선택).
