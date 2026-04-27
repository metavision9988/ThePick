# Session 012 → 013 Start Prompt

새 Claude Code 세션 시작 후 **첫 입력**으로 다음 중 하나 붙여넣기:

---

## 옵션 A — 핸드오프 읽고 진입 (권고)

```
.jjokjipge/handoff-session-012.md 읽고 BATCH-1 적재 진행해줘
```

## 옵션 B — 직접 트리거 (메모리 자동 인지)

```
BATCH-1 적재
```

## 옵션 C — 검토 + 진입

```
.jjokjipge/handoff-session-012.md 읽고 직전 Phase 0 + 0.5 종결 상태 (12 commit, CRITICAL 0건) 확인 후 BATCH-1 적재 진행해줘
```

---

## 자동 로드되는 컨텍스트

- 진산님 메모리 (project_content_build_engine_as_core.md, project_batch_load_workflow.md 등 14건)
- CLAUDE.md (프로젝트 룰)
- .claude/rules/ (auto-review-protocol, dev-guide, production-quality, session-health)

## BATCH-1 핵심

- 자료: docs/manual/2026년 「농업재해보험·손해평가의 이론과 실무」 이론서\_수정본(26.3.31.).pdf
- 페이지: p.403~434 (32p)
- 영역: 적과전 종합위험
- 목표: 60 노드 / 200 엣지 / 13 산식
- dry-run: D1 INSERT SKIP, JSON + Golden 산출만
