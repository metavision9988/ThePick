# docs/audit/ — 설계·아키텍처 정합성 감사 홈

> 엔진 선택이 옳은가 / 엔진 간 파이프라인이 목표를 떠받치는가 / 6개월~2년 뒤 설계가 버티는가.
> _변경분_ 을 보는 4-Pass·5-persona-debt 와 **다른 층** (설계/아키텍처).

## 구성

- **`DESIGN_AUDIT_PROMPT_v1.0.md`** — 실행 프롬프트 사양(목표 재정립 → 엔진 지도 → 7 페르소나 독립 감사
  → 적대 반증 → 진앙 종합). 사람이 읽는 사양이자 새 세션/모델용 붙여넣기 프롬프트(모드 B).
- **`.claude/workflows/design-audit.js`** — 위 사양의 자동 실행 장치(5단계 다중 페르소나 병렬 + realcode 반증
  - 보고서 자가 영속).
- **`DESIGN_AUDIT_REPORT_<YYYYMMDD-HHMMSS>.md`** — 매 실행 산출 보고서(감사 후 생성).

## 실행

```
# 자동 (권장) — 다중 페르소나 자동 병렬
Workflow({ scriptPath: ".claude/workflows/design-audit.js" })

# 수동 — DESIGN_AUDIT_PROMPT_v1.0.md §4 프롬프트를 새 세션에 붙여넣기
```

## 가드(전 단계 강제)

실코드/실데이터 게이트(stale 문서 진실원 금지·"스키마≠populate") · G-1("가능합니다" 금지·천장 인용) ·
RULE #5(GO/STOP=인간, AI는 🟢🟡🔴+선택지) · 반환각(file:line 인용·주관어 금지·환각 자수) ·
중복 금지(4-Pass·5-persona-debt 와 층 분리).

## 언제

대규모 구현 착수 전 / Phase 경계 / "설계가 제대로 됐나 전체+세부 점검" 요청 시. 매 마일스톤 재실행.
