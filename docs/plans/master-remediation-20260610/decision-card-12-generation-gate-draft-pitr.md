# 결정 카드 #12 — 생성층 게이트 선행 원칙 명문화 + exam_questions draft 표현 PITR (WS-6a·6c)

> 작성: 2026-06-12 / 상태: **결재 대기** (MASTER_PLAN §6 #12 ☐ — S11 진입 조건: 플레이북 S11 = "결재 #12/#13 후")
> 배경: Phase 2 생성 엔진 착수 전 AI 생성물 환각 차단 DB 게이트 0중(MASTER_PLAN.md:74 §2.1-8). ADR-046 D-6(distractor→exam_questions SUPERSEDES INSERT)은 결재 완료된 확정 경로인데, exam_questions 에는 draft 를 표현할 방법 자체가 없어 Hard Limit "AI 생성 데이터는 draft 상태로만 적재"(CLAUDE.md Hard Limit)와 정면 충돌.

## 실코드 근거 (2026-06-12 전수 실파일 확인)

- **draft 표현 3중 부재**:
  1. status CHECK 에 'draft' 없음 — `migrations/0001_initial_schema.sql:128` `CHECK(status IN ('active','deprecated','flagged'))`
  2. status UPDATE 동결 — `migrations/0038_exam_questions_metadata_update_allow.sql:53` D-2 ABORT 목록에 status 포함. **production 라이브** (§6 #11 집행 완료 2026-06-11, MASTER_PLAN.md:247)
  3. 전이 로그 우회로도 불가 — `migrations/0010_status_transitions_and_page_ref_guard.sql:27` `target_type CHECK(... IN ('node','formula','constant'))` = **exam_question 미커버** (0010 의 status 전이 기계는 3종 전용)
- **게이트 후행 리스크**: MASTER_PLAN.md:74(생성층 역순 리스크) + :94(생성 본체 = 게이트 선행 후 별도 Epic) + :189(M20~M24 진입 = WS-6 게이트 전부 PASS + G-1 R1~R5 전수 + ai-adapter 단일 정본 결정)
- **S11 의존**: OPUS48_EXECUTION_PLAYBOOK.md:39·212-223 — S11 항목 2 = 본 카드 채택안으로 ADR 구체 설계 + Binary Gate "AI 생성물이 exam_questions 에 무게이트 적재되는 경로 0". G-WS6 ④ = ADR 2건(6c·6e) Accepted (MASTER_PLAN.md:184 — 6c 는 본 카드, 6e 는 결재 #13)
- **표기 정정**: MASTER_PLAN.md:179 "mock 테이블(0020+ 슬롯)"은 stale — `migrations/` 최신 = 0038, 실 차기 슬롯 = **0039+**

## (a) 게이트 선행 원칙 명문화 (WS-6a — Phase 2 진입 규칙, 코드 0줄)

"생성 코드 1줄 전 DB 게이트 마이그 선행"(MASTER_PLAN.md:177)을 Phase 2 진입 체크리스트(+CLAUDE.md 급 규칙)로 명문화할지 여부. G-WS6 ⑤(MASTER_PLAN.md:184, 원문 = "Phase 2 진입 체크리스트에 6f 게이트 명문")가 이미 Phase 2 진입 체크리스트의 존재를 게이트 항목으로 전제 (⑤ 자체는 6f containment 대상 — (a)의 게이트 선행 원칙 명문화는 6a 별도 항목). 미명문화 시 §2.1-8 역순 리스크(게이트 0중 상태의 생성 착수)가 규칙 부재로 남음. 비용 = 문서 작업만 [추정 1h 미만].

## (b) exam_questions draft 표현 PITR — 2안 비교 (WS-6c, L3·plan 선행)

| 기준                           | (b-1) CHECK 재정의 (테이블 재생성)                                                                                                                                                                                     | (b-2) mock_exam_questions 별도 테이블 (0039+ 슬롯)                                               |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| production 545 본체 접촉       | 재생성 = 545행 복사 + 트리거·인덱스 재부착(0005:111 status NOT NULL 등 INSERT 트리거 4종 · 0038:42 body_update 트리거 · 0037:21 부분 복합 인덱스 등 인덱스 6종 — 0001:132-133·0002:34-35·0032:26 포함) — 불가역 고위험 | **무접촉** (신규 테이블 INSERT 만)                                                               |
| 기결재 0038 D-2(status 동결)   | **충돌** — draft→active 전이를 열려면 D-2 재결재 + 트리거 재설계 필수                                                                                                                                                  | **불변** (본체 status 동결 유지)                                                                 |
| Hard Limit "draft 로만 적재"   | 동일 테이블 내 status 값 구분 — 소비측 WHERE 필터 1건 누락 = 학습자 노출 사고면                                                                                                                                        | 테이블 격리 자체가 차단막 — 본체 유입 = 인간 검수 후 INSERT 승격만                               |
| 스키마·소비측                  | 단일 테이블 유지(조회 경로 불변)                                                                                                                                                                                       | 22컬럼(0038:12-18 허용6+보호16) 동기 의무 = 드리프트 위험 + 승격 INSERT·소비 이원 조회 설계 필요 |
| 지연 비용                      | 행·트리거 누적될수록 재생성 비용 증가 (MASTER_PLAN.md:179 명기)                                                                                                                                                        | [추정] 낮음 (슬롯 번호 외 지연 민감도 없음)                                                      |
| D-6 distractor SUPERSEDES 정합 | 동일 테이블 draft 행 + superseded_by                                                                                                                                                                                   | draft 스테이징 → 검수 → 본체 INSERT+SUPERSEDES — 구체 설계 = S11 ADR 몫                          |

## 권고 (결정은 진산 — RULE #5)

**(a) 명문화 채택 + (b-2) mock(격리 스테이징) 테이블**. 근거: ① production 본체 무접촉 = 가역 ② 기결재 0038 D-2 불변 ③ Hard Limit 의 "격리 후 인간 검수" 의도와 구조 정합 ④ (b-1) 재생성 비용은 지연될수록 증가. 단 (b-2)의 컬럼 드리프트·승격 경로는 S11 ADR + L3 plan 에서 Binary Gate("무게이트 적재 경로 0")로 못박는 조건부. 두 안 모두 SQL 작성·production 적용 = L3 plan 승인 후이며 본 카드 채택만으로 코드 착수하지 않음(2026-05-29 실수 로그 절차 — approved_by 명시 전환 선행).

> 진산 확인란: (a) ☐ 게이트 선행 원칙 명문화 채택 / ☐ (a) 보류 ‖ (b) ☐ b-1 CHECK 재정의 / ☐ b-2 mock_exam_questions 테이블 / ☐ (b) 보류
