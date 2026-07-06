# S10 — 회로 생성·풀이 수직 관통 PoC (전기기사, 클래스 A)

> **버려질 스파이크(feasibility PoC)** — 킬러 서비스 "회로도 랜덤 생성"의 수직 관통 실증. production 아님.
> 정본 verdict: `docs/feasibility/exam2-electrical-spike-s10-circuit-poc.md`. 출처 지시: `docs/plans/opus-dual-track-playbook-20260704.md` §3 W2 S10.

## 무엇을 증명하나

인간승인 토폴로지 템플릿(직렬 RLC) → **값만 난수화** → lcapy가 전달함수 H(s) **유도** → sympy 계수 추출 →
f0/Q/ζ 산출(폐형식 교차검증) → schemdraw SVG → **Solver-Validated Gate** → 정적 JSON. 런타임은 JSON+SVG만 소비.

## 가드레일 16 (회로 3원칙) 매핑

| 원칙 | 구현 |
| :-- | :-- |
| ① 무작위 토폴로지 금지 | `templates/rlc_series.json` = 고정 스켈레톤, `randomize()`는 값만 치환 |
| ② Python 툴체인 빌드타임 격리 | 이 디렉토리(사이드카 venv)는 빌드타임 전용. 런타임 반입 금지. 산출 = `out/*.json` + `out/*.svg` |
| ③ Solver Gate 없이 노출 금지 | `solver_gate.py` — G1 유일해/V1 결정론/G4 단위/G2 난이도. 실패 = LOUD `SolverGateError`(사일런트 드롭 0) |

## 실행

```bash
python3 -m venv .venv && .venv/bin/pip install lcapy schemdraw   # 최초 1회
.venv/bin/python src/generate.py --seed 1 --count 3                                    # 저역통과(기본)
.venv/bin/python src/generate.py --template templates/rlc_series_bandpass.json --seed 1 --count 3   # 대역통과
.venv/bin/python src/test_gate.py                      # 다중 템플릿 관통 + 게이트 거부 실증
```

## 게이트 실측 (2026-07-06, 대역통과 템플릿 추가·registry 일반화)

- **다중 템플릿 관통**: 저역통과 + 대역통과 = **단일 파이프라인** 통과(템플릿 교체만). 저역 3 + 대역 23 seed 전부 PASS.
- **V1 대조 rel_err ≈ 0**(≤4e-16 = lcapy 유도 ≡ 폐형식, 공유 키 전수: 극점+BW+차단주파수) + **출력탭 이득 H(0)·H(∞) 기대 일치**.
- **게이트 실검증 10/10**: 다중 템플릿 관통 + G1 특이 4종 LOUD 거부 + **포지티브 컨트롤**(G1 회귀 뮤테이션 가드) + **출력탭 오배선**(L↔C 스왑 H(0) / ★고역통과 오배선 H(∞) — 대역통과와 고역통과 구별) + G2 판별.
- **렌더**: SVG well-formed, 실 `<text>` 라벨(선택가능), 넷리스트 순서 배치 + 접지쪽=출력탭(V_out) 표시. 시각 품질 = 인간 확인 대기.

> 1차 리뷰(`wf_a1fd2c69`) 2 MAJOR(테스트 G1 미검증 / 게이트 분자 맹점) 수정 + 2차 템플릿으로 아키텍처 일반화 실증 — 상세: spike verdict §1.5~1.7.

## 파일

- `templates/rlc_series.json` — 저역통과(출력=C) 템플릿: 인간승인 토폴로지 + 값 범위 + 질문 스펙
- `templates/rlc_series_bandpass.json` — 대역통과(출력=R) 템플릿: 극점 공유·출력탭 상이, 대역폭·차단주파수 질문
- `src/references.py` — 템플릿별 승인 물리(reference_id→{derive/reference/steps}), 동적실행 0
- `src/generate.py` — 난수화·lcapy 풀이·교차검증·SVG·JSON 오케스트레이터
- `src/solver_gate.py` — Solver-Validated Gate (LOUD): G1/V1(극점+H(0)+H(∞))/G4/G2
- `src/test_gate.py` — 다중 템플릿 관통 + 게이트 id 실발화 거부 실증
- `out/` — 생성 산출물(정적 JSON+SVG, 런타임 소비 형태)

## 스코프 한계

클래스 A(1차 회로이론)만. 수변전 단선도·시퀀스(클래스 B·C)는 별도 엔진 = 백로그 BL-3.
