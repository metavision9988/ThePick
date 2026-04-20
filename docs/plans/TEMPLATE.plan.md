# current.plan.md 템플릿

> 이 파일은 L3 영역(결제/인증/Formula/DB 스키마) 수정 전 반드시 작성한다.
> 작성 후 `docs/plans/current.plan.md` 로 복사하여 `protect-l3.sh` 훅을 통과시킨다.
> 완료된 plan은 `docs/plans/archive/YYYYMMDD-<name>.plan.md` 로 이동.

---

phase: 1
step: 1-2
approved_by: TBD
scope:

- path/to/file1.ts
- path/to/file2.sql
  risk_level: L3

---

## 목적

이 변경이 왜 필요한가? (1~2문장)

## 대상 파일

- `path/to/file1.ts` — 변경 내용 요약
- `path/to/file2.sql` — 변경 내용 요약

## 위험 분석

| 위험 | 완화 |
| ---- | ---- |
| ...  | ...  |

## 검증 계획

- [ ] Golden Test 전수 재실행
- [ ] typecheck 통과
- [ ] lint 통과
- [ ] 독립 에이전트 리뷰 (4-Pass 또는 5-페르소나)

## 롤백 전략

실패 시 어떻게 되돌리는가?

## 승인 기록

- Claude 독립 리뷰 링크: `.claude/reviews/...`
- 진산님 승인 메시지 요약: ...
