# Sprint 1 §5.2 4-Pass 통합 인덱스

**작성일**: 2026-05-02 ~00:35 KST
**작성자**: Claude (Opus 4.7 1M context) — Session 029
**리뷰 방식**: 독립 에이전트 4개 병렬 (silent-failure-hunter / system-architect / security-engineer / quality-engineer)
**리뷰 범위**: commit 2건 (fefa64a P0→P1 재분류 + ba9ad2b §5.2 도구 정비) + 변경 파일 21건 + 연관 파일 8건
**근거 문서**: `.claude/rules/auto-review-protocol.md` (4-Pass 자동 리뷰 프로토콜)

---

## 0. 종합 결과

| Pass          | 에이전트              | ✅ PASS | 🔴 CRITICAL | 🟠 MAJOR | 🟢 MINOR | N/A |
| :------------ | :-------------------- | :-----: | :---------: | :------: | :------: | :-: |
| 1 — SURGEON   | silent-failure-hunter |    -    |      0      |    3     |    4     |  -  |
| 2 — ARCHITECT | system-architect      |   23    |      1      |    3     |    5     |  1  |
| 3 — ADVOCATE  | security-engineer     |   11    |      0      |    3     |    4     |  2  |
| 4 — CONTRACT  | quality-engineer      |    8    |      0      |    4     |    2     |  2  |
| **합계**      | —                     |    —    |    **1**    |  **13**  |  **15**  |  —  |

**판정**: 🔴 **수정 필요** — CRITICAL 1건 즉시 흡수 의무 (auto-review-protocol §"4-Pass 모두 Critical 0건이어야 '완료' 선언 가능").

---

## 1. CRITICAL 흡수 (즉시 의무)

### CRITICAL-F1 (Pass 2) — test-patterns.md §4 fixture 경로 거짓

**증거**: `docs/quality/test-patterns.md` §4 표가 `tests/fixtures/pdf-malicious/` / `tests/fixtures/claude-malformed/` 로 표기. 실제 위치는 `packages/parser/__fixtures__/pdf-malicious/` / `packages/parser/__fixtures__/claude-malformed/`.

**위험**: §5.3 NOT-IMPL 7건 (FUZ-01 / FUZ-02) 신규 구현 시 test-patterns.md 를 진실 소스로 참고하면 fixture 경로 오류로 작업 차단.

**Pass 1 M3 동일 적발** + **Pass 4 MAJOR-4 부분 적발** = 3개 에이전트 독립 적발 → 신뢰도 높음.

**흡수 commit**: 본 4-Pass 흡수 commit (별도 commit) 의무.

---

## 2. MAJOR 13건 분류

### 2.1 즉시 흡수 (본 4-Pass 흡수 commit) — 6건

|  #  | Pass | ID      | 적발 내용                                                                  | 흡수 방법                              |
| :-: | :--: | :------ | :------------------------------------------------------------------------- | :------------------------------------- |
|  1  |  1   | M1      | `round()` 함수에 Infinity/NaN/MAX_SAFE_INTEGER overflow 가드 부재          | round() 가드 추가 + 회귀 테스트        |
|  2  |  1   | M2      | summarize() 가 NaN/Infinity 입력 시 silent 통과                            | 입력 검증 + 회귀 테스트                |
|  3  |  4   | MAJOR-2 | Master Plan §14.2 / §14.3 의 "P0 17건" / "P1 18건" 본문 미갱신             | §14.2 / §14.3 v1.0.1 패치 추가         |
|  4  |  4   | MAJOR-3 | Master Plan §12 line 872 MSW "✅ (이미 사용)" 거짓 — 실제 미설치           | §12 v1.0.1 footnote 추가               |
|  5  |  4   | MAJOR-4 | test-patterns.md §4 fixtures 경로 / §5 ADR-028 경로 / §5 MSW 가정 자기모순 | F1 흡수와 동시 일괄 수정               |
|  6  |  3   | A1      | PDF reader 경고 banner — `__fixtures__/pdf-malicious/` 진입 시 OOM 위험    | pdf-malicious/README.md §0 banner 추가 |

### 2.2 차세션 (handoff-030) 명시 이월 — 7건

|  #  | Pass | ID         | 적발 내용                                                                                  | 이월 사유                                            |
| :-: | :--: | :--------- | :----------------------------------------------------------------------------------------- | :--------------------------------------------------- |
|  7  |  2   | A1         | tsconfig path mapping 이 test-helpers production import 차단 부재                          | ESLint no-restricted-imports + tsconfig 검토 별도 PR |
|  8  |  2   | D1         | Rule 17 예외 nameset 가 `__fixtures__/**` 미포함 (.eslintignore 자체 미생성)               | ESLint Rule 17 도입 시점 (Phase 1 후반)              |
|  9  |  2   | E1         | ADR-028 trigger #4 ("node:sqlite 1% 결손 운영 중 발견") 측정 불가능                        | trigger 정의 재작성 + ADR 별도 patch                 |
| 10  |  3   | A2         | 보안 스캐너 (Snyk / Dependabot) false positive 차단 마커 부재                              | CI 보안 스캐너 도입 시점 (P1 / Phase 2 진입 직전)    |
| 11  |  3   | A4         | Phase 2 진입 트리거 binary 정의 부재 ("BATCH-1 적재 완료" 의 측정 가능 정의 부재)          | ROADMAP Phase 2 진입 게이트 명세 별도 작업           |
| 12  |  4   | MAJOR-1    | commit message 의 위치 변경 transparency 누락 (`tests/` → `packages/parser/__fixtures__/`) | 이미 commit 됨 — handoff-030 §6 ledger 명시          |
| 13  |  3   | A3 (Minor) | Hard Rule 17 예외 패턴 명세 (08-fixture 의 'son-hae-pyeong-ga-sa') ESLint config 의무      | A2 와 동일 시점 (CI 통합)                            |

---

## 3. MINOR 15건 (보고만)

본 통합 인덱스에서는 카운트만 명시. 각 Pass 보고서 본문 참조.

- Pass 1 Minor 4건 — 인지 / 문서화 / 회귀 보강 (미흡수, handoff-030 ledger)
- Pass 2 Minor 5건 — Workers Pool 미세 정합 / 주석 수준 (미흡수)
- Pass 3 Minor 4건 — 문서 완전성 / 미래 추적 항목 (미흡수)
- Pass 4 Minor 2건 — 문서 일관성 미세 (미흡수)

---

## 4. 본 4-Pass 의 Devil's Advocate 종합

각 Pass 가 제시한 "깨질 수 있는 시나리오" 1개+ 종합:

1. **Pass 1**: round() 가드 부재로 NaN/Infinity 입력 시 percentile 함수 silent 빈 배열 → CacheHitTracker DoS 가능
2. **Pass 2**: test-helpers/perf 가 production bundle 에 포함되면 Workers CPU 50ms 한도 압박 가능
3. **Pass 3**: 03-compression-bomb.pdf 가 git clone 시점 IDE / OS thumbnailer 가 자동 디코드 시도 → 개발자 local OOM
4. **Pass 4**: handoff §2.A 의 "tests/fixtures/" 경로 명세가 본 commit 에서 "packages/parser/**fixtures**/" 로 silent pivot

---

## 5. 본 인덱스의 한계 (정직)

1. **CRITICAL 1건 = test-patterns.md 경로 거짓** — 본 1건이 §5.3 진입 차단으로 적절히 흡수되면 Sprint 1 §5.3 진입 가능.
2. **MAJOR 13건 중 7건 이월** — handoff-030 §6 ledger 의무. 본 이월이 Sprint 1 §5.4 종료 게이트의 "MAJOR phase 종료 전 해결 또는 다음 phase 명시 이월" 정합.
3. **본 4-Pass 는 Sprint 1 §5.2 commit 한정** — §5.3 NOT-IMPL 7건 본격 구현 commit 별도 4-Pass 의무.
4. **테스트 카운트 회귀 검증**: shared 33→46 (+13) / api 261 / quality 48 / batch 238 / parser 136 — 회귀 0건 확인.

---

## 6. 본 4-Pass 산출물 보고서

| Pass | 보고서 파일                                                                 |
| :--: | :-------------------------------------------------------------------------- |
|  1   | `.claude/reviews/review-20260502-002814-sprint1-step5-2-pass1-surgeon.md`   |
|  2   | `.claude/reviews/review-20260502-002803-sprint1-step5-2-pass2-architect.md` |
|  3   | `.claude/reviews/review-20260502-002933-sprint1-step5-2-pass3-advocate.md`  |
|  4   | `.claude/reviews/review-20260502-003132-sprint1-step5-2-pass4-contract.md`  |

---

**통합 인덱스 작성**: Claude (Opus 4.7 1M context) — Session 029
**리뷰 방식**: 독립 에이전트 4개 병렬 (auto-review-protocol §"규칙 0" 정합)
**다음 단계**: CRITICAL-F1 + MAJOR 6건 즉시 흡수 → 회귀 게이트 검증 → handoff-030 작성
