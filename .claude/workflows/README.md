# `.claude/workflows/` — 재사용 멀티에이전트 워크플로우

> Workflow 툴 레지스트리. `Workflow({name})` 또는 스크립트 내 `workflow(name, args)` 로 호출.
> 모든 스크립트는 `export const meta = {...}` 로 시작하는 순수 JS (TS 아님, Date.now/Math.random 불가).

## 등록된 워크플로우

| name            | 용도                                                                                              | 트리거                                             | args                                                                                                   |
| :-------------- | :------------------------------------------------------------------------------------------------ | :------------------------------------------------- | :----------------------------------------------------------------------------------------------------- |
| `4pass-review`  | L2+ 구현 "완료" 선언 직전 코드정합성 4-Pass 독립 리뷰 + 발견별 적대 반증 + `review-*` 보고서      | 모든 L2+ 구현 완료 후 (스킵=CRITICAL RULE #4 위반) | `{changedFiles?,relatedFiles?,context?,gitRef?,label?}` 또는 스코프 문자열, 또는 미지정(git diff 자동) |
| `5persona-debt` | Phase 마일스톤/대규모 묶음 후 6개월~2년 horizon 기술부채 5-페르소나 병렬 리뷰 + 진앙 합의 + INDEX | Phase 0~3 완료 / ADR 5건+패키지 신설 등 묶음       | `{phase?,scope?,prior4PassPath?,focusAreas?}`                                                          |

## 설계 원칙 (auto-review-protocol.md 정합)

- **규칙0 독립성**: 리뷰는 메인 대화가 아닌 독립 서브에이전트가 수행 (의도 편향 0).
- **규칙1 전체범위**: 변경 파일 + 연관 파일(import/호출측/동일 테이블) 전수.
- **규칙2 증거**: 모든 발견·PASS·N/A 에 file:line. 0건 보고도 3개+ 증거.
- **규칙3 반론**: 각 발견에 devil's advocate (깨질 시나리오).
- **적대 반증**: `4pass-review` 는 CRITICAL/MAJOR 발견마다 반증 에이전트가 거짓 양성을 솎아냄 (refuted → 폐기).
- **중복 금지**: `5persona-debt` 는 `prior4PassPath` 로 4-Pass 결과를 받아 단기 버그 중복 지적 차단.
- **보고서 prefix**: 산출물은 `.claude/reviews/review-<ts>-*.md` (4-Pass) / `phase<N>-tech-debt-<ts>-*.md` (5-페르소나) — `review-gate.sh` hook 정합.

## 호출 예

```
Workflow({ name: '4pass-review' })                                  // git diff 자동 스코프
Workflow({ name: '4pass-review', args: { label: 's5-7', context: 'S5-7 A 통합' } })
Workflow({ name: '5persona-debt', args: { phase: 3, prior4PassPath: '.claude/reviews/review-...-4pass-s5-7.md' } })
```

> 일회성 오케스트레이션(예: TR-0 이중 게이트 사전심사)은 인라인 `script` 로 실행되며 세션 디렉토리에 자동 영속된다.
> 반복 가치가 생기면 그 스크립트를 본 디렉토리로 이동해 named 워크플로우로 승격한다.
