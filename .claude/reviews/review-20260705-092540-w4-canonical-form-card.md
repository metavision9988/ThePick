# 독립 리뷰 — W4 수식 canonical form 결정 카드

- **일시**: 2026-07-05 09:25 KST
- **대상**: `docs/plans/decision-card-20260705-formula-canonical-form.md` (진산 결재 상신 예정, L3 설계 카드)
- **선행**: discovery 워크플로우 5 에이전트(`wf_d9f704b3`, formula-engine/D1/web/embedding/전기제약 현황 매핑) → 카드 초안.
- **검증 방식**: 독립 2 에이전트 병렬(자가 리뷰 금지 — 가드레일 #12) — ① 사실검증관(general-purpose, 인용 전수 실코드 대조) ② 설계 비평관(system-architect, reframe·권고 적대 반증).

## ① 사실검증 (A등급 환각 방지) — CRITICAL 0 / MAJOR 0 / MINOR 1

카드의 load-bearing 인용을 실파일 8개 + 근거 리포트 2개로 전수 대조. 판정: **모든 인용 실재·정확**.

- `sandbox.ts:66` SAFE*SYMBOL_PATTERN `/^[a-z]a-z0-9*]\*$/`문자 일치 /`:45-62` ALLOWED_FUNCTIONS 정확히 16종·trig/exp/pi/complex 부재 / throwing stub override 실재.
- `types.ts:34-35` equationTemplate·equationDisplay 2필드·`:47` FormulaScope=Record<string,number> 정확.
- `schema.ts` formulas equation_template NOT NULL / equation_display nullable 정확.
- 임베딩 `name+"\n"+description` verbatim·bge-m3 정확. apps/web KaTeX/MathJax/dangerouslySetInnerHTML grep 0 정확.
- `equation_display 0/157`·F-152~157 대입형 혼재 근거 리포트 실재·수치 일치.
- **MINOR**: "1024d"를 `upserter.ts:34`(모델 리터럴)에 인용했으나 실제 `BGE_M3_DIMENSIONS=1024`는 `:128` → **정정(`:34,128` 병기)**. ✅

## ② 설계 비평 (적대 반증) — CRITICAL 1 / MAJOR 2 / MINOR 4 → **전건 반영**

| #       | 발견                                                                                                                                                                                                                                                               | 처분                                                                                                                                                         |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **C-1** | "재적재 0/greenfield"는 D1 한정. 코드 레지스트리 `FormulaDefinition.equationDisplay`(필수)에 손해평가 68식이 이미 유니코드 평문으로 실재·작동 → ①A는 status quo이고 "LaTeX 전 종목 공통"은 68식 재저작 비용. 딜레마(재저작 vs 종목별 divergence) 누락 = 진산 오도. | ✅ **정정** — §3 "기존 자산 비용" 행 + §3 주(2) + §6 C-1 블록 + §4 두 대안에 68식 status quo·재저작 비용·딜레마 명시. 헤더 비가역성도 정정.                  |
| **M-1** | Hard Rule 15(examId **코드** 분기 금지)를 표시형 **데이터** 규약에 오적용 → LaTeX에 거짓 규칙-준수 가중.                                                                                                                                                           | ✅ **정정** — §3 Hard Rule 15 행 삭제→"표기 일관성·저작 툴링"으로 교체 + §3 주(1) "표시형=데이터 규약, 렌더러 data-driven, Rule 15 무관" + §4 근거 (c) 철회. |
| **M-2** | 복소수 우회(크기/위상 분해)를 "canonical FORM과 독립"이라 단정하나 실은 축 A(ASCII 표기)와 **결합** → romanize 락이 복소수 방침보다 선행하면 재작업.                                                                                                               | ✅ **정정** — §5 D-1에 "축 A와 결합" + §4-1·§6·§8 Q3→Q4 순서(복소수 방침 선행) 명시.                                                                         |
| m-1     | "하이브리드" 등가어 혼용(§1 골격 vs §3 표시분기)                                                                                                                                                                                                                   | ✅ §3 주로 구분 명확화                                                                                                                                       |
| m-2     | "필요조건" 과장(∠·√·단자리첨자는 유니코드 가능)                                                                                                                                                                                                                    | ✅ §4 "표현력 우위/2D 조판 사실"로 완화                                                                                                                      |
| m-3     | 축 C = 실제론 description 산문 내 표기(equation 필드 미포함)                                                                                                                                                                                                       | ✅ §1 row③·§2 축 C·§4-3에 반영(표시형↔임베딩 독립 오히려 보강)                                                                                               |
| m-4     | S10 KaTeX "이미 전제" 과표현(미착수 plan 가정)                                                                                                                                                                                                                     | ✅ §3·§4 "설계 전제(미착수)"로 완화                                                                                                                          |

**비평관 인정 — 권고 골격 건전 근거 3+**: (1) 핵심 reframe "단일 canonical 불가능"은 코드 정합(ASCII 강제 실측), 수사 아님. (2) 축 C S9 게이트·미측정 라벨 = G-1 규율 우수(임베딩 입력이 name+description이라 표시형 결정이 임베딩에 커밋 안 됨 = 실코드 확인). (3) 표현력=조판 사실 vs 검색=측정 분리 정확. (4) D-1 별건 L3 분리 아키텍처 건전. (5) 타이밍 방향(첫 적재 전 확정) 정확.

## 판정

**완료 가능** — 사실검증 CRITICAL 0(환각 없음) + 비평 CRITICAL/MAJOR/MINOR **전건 반영**. 정정 후 카드는 (a) 손해평가 68식 status quo·재저작 비용·딜레마를 정직 제시, (b) Hard Rule 15 오적용 제거, (c) 복소수-축A 결합·순서 반영, (d) 권고를 "LaTeX-for-all"에서 "KaTeX-대응 렌더러 + 복잡식만 LaTeX(68 grandfather)"로 재균형. 확정은 진산(RULE #5, §8 Q1~Q5).

**메타**: 사실검증(환각 사냥)과 설계 비평(과잉확정 사냥)의 분리가 유효 — 사실은 전부 참이었으나 _참인 사실의 불완전 선택_(D1 0/157만 보고 코드 68식 누락)이 권고를 편향시킨 것을 비평관이 포착. "참 ≠ 완전" = 결재 카드 특유의 위험.
