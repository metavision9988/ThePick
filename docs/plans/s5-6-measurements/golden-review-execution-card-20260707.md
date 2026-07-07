# G-S5 golden 검수 실행 카드 — 진산 최소부담 패킷 (2026-07-07)

> **합의 시퀀스(진산 2026-07-07)**: 검수 → 재측정(N≥30) → 사실 기반 GO/NO-GO.
> 검수만이 유일한 진산 선결 — **이 검수는 AI 위임 불가**(라벨 생성자=승인자 순환편향, 06-02 감사가 진산 검수를 표적정의층 차단막으로 지정).
> 대상: `golden-expansion-draft-20260702.md` 신규 22문항(pilot 12는 기검수·동결). 독립 적대검증 = APPROVE 21 / FIX 1 반영본.

## 방식 택1 (회신 = 한 줄이면 충분)

- **옵션 A — 전수**: 22행 각각 APPROVE/FIX/REJECT (행당 수초, 총 ~5분). 검수표 = 위 draft.md 표(문항·정답·expected 노드·증거 인용 나란히).
- **옵션 B — 스팟체크 (권장, ~2분)**: 아래 무작위 5문항만 정밀 검수 → 5/5 무결이면 나머지 17 일괄 승인, 1건이라도 결함이면 옵션 A 전환. (무작위 추출 = draft 순번 해시 기반 고정: **#3, #7, #12, #16, #21**.)
- **옵션 C — 반려**: 특정 축(과목/유형) 보강 지시.

## 회신 예시

- "B, 5건 확인 이상없음" → 22문항 병합 동결 → queryBody 파생 → N=34 재측정 → 결과 들고 GO/NO-GO 상신
- "A, #5 FIX(사유), 나머지 APPROVE" → FIX 반영 후 동결·재측정

## 검수 후 자동 진행(AI, 결재 불요)

동결 파일 생성(`golden-pilot-approved.v2.json`) → answer-leak assert 파생(queryBody) → REMOTE 재측정(depth1·baseline) → 사실표(graphOnlyRecovery/regression/hit-rate Δ) → **GO/NO-GO 상신 = 그때 진산**.
