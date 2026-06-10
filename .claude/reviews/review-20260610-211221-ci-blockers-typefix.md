리뷰 방식: 독립 에이전트 (quality-engineer 단일 리뷰어 4-Pass — 작은 변경 2건 경량 티어)

# CI typecheck 블로커 2건 해소 리뷰 — 기존 RC-5 type-drift 수리

- 날짜: 2026-06-10 21:12
- 맥락: design-audit 후속 S1 검증 중 발견된 **기존**(S1 무관) `pnpm -r typecheck` FAIL 2건 수리.
  진산 위임("너가 결정해서 정리 구현해줘", 2026-06-10) 하 즉시 수정 결정 — 미해소 시 CI typecheck
  단계에서 차단되어 S1-0a 의 test 게이트(151건)가 실행 불가.
- 변경 2건:
  1. `apps/admin-web/src/components/GraphVisualizer.tsx:17-31` — NODE_COLORS(Record<NodeType,string>)에
     Table-KG 4종(TABLE/ROW_HEADER/COL_HEADER/CELL, ADR-032) teal 계열 추가 (+6줄, 삭제 0)
  2. `apps/batch/src/__tests__/pipeline.integration.test.ts:258-270` — 의도적-위반 픽스처에 ADR-030
     필수 필드 book_page/pdf_page 추가 (+5줄, 삭제 0; 리뷰 Minor-1 흡수로 주석 정밀화)

## 리뷰 결과 (독립 에이전트 원문 요약)

- **Pass 1 (Surgeon)**: NodeType 11종 전수 커버 1:1 일치(shared/types.ts:12-23 대조, tsc 기계 강제) /
  hex 유효 / 픽스처 의도 보존 — `isValidNodeType` 검증(schema-validator.ts:1005-1013)은 페이지 필드와
  독립 경로, 테스트는 여전히 batch_structurize failed + 후속 skipped + qg2Passed=false 단언(:294-297).
  표적 테스트 직접 실행 1 passed.
- **Pass 2 (Architect)**: admin-web 내 `Record<NodeType` 전수 맵 = 이번 1곳뿐(grep) + 잔여 NodeType
  사용은 비전수로 자동 호환 + shared TRUTH_WEIGHTS 이미 11종 커버 — 일관성 균열 0.
- **Pass 3 (Contract)**: diff = 색상 6줄 + 픽스처 4줄뿐, 기존 값 무변경, Hard Limit/L3 무접촉,
  ADR-030/032 서술 정합.
- **Pass 4 (실행)**: admin-web tsc 0에러 / batch tsc 0에러 / admin-web vitest 21 PASS / batch vitest
  327 PASS / 표적 테스트 1 PASS. **전체 `pnpm -r typecheck` exit 0 (error TS 0건) 최초 달성.**

## 발견

| 등급     | 건수 | 처리                                                                                                                                                                                                                                                                  |
| -------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Critical | 0    | —                                                                                                                                                                                                                                                                     |
| Major    | 0    | —                                                                                                                                                                                                                                                                     |
| Minor    | 2    | ① 픽스처 주석 "위반은 type 하나뿐" 부정확(빈 title/content 도 런타임 위반) → **즉시 흡수**(주석 정밀화, 본 보고서 시점 반영 완료) ② CELL `#ccfbf1` 저대비 + ROW_HEADER↔CROP 색 근접 — stroke 2.5px 상시(GraphVisualizer.tsx:167-169)로 완화 확인, admin 도구라 보고만 |

리뷰어 반론(채택): 본 테스트는 INVALID_NODE_TYPE 검출을 단독 고정하지 않음(빈 필드 위반만으로도
Stage 3 FAIL 가능) — schema-validator 단위 테스트 몫의 기존 약점, 본 변경 범위 밖 기록.

## 판정

**완료 가능** (Critical 0 / Major 0). 두 수정 모두 기존 드리프트의 최소 수리이며 동작 변경은
의도된 효과(Table 노드 teal 렌더, 픽스처 typecheck 정합)뿐.
