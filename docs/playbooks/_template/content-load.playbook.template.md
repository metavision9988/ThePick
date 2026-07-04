# {{종목명}} 콘텐츠 적재 플레이북 — 인스턴스 (템플릿 v1.0)

> **PLAYBOOK-STAMP** — template: `docs/playbooks/_template/content-load.playbook.template.md` · template_version: v1.0 (2026-07-04) · exam: `{{exam_id}}` · instance: `docs/plans/{{exam_id}}-content-load.playbook.md`
>
> **인스턴스화 지침**: 본 파일은 **템플릿 원형**이다. 신규 종목 착수 시 `docs/plans/{{exam_id}}-content-load.playbook.md`로 복사 후 `{{...}}` 토큰을 전수 치환하고 §8 결재란을 비운 채 상신한다(절차: `docs/playbooks/_template/README.md`). **원형(\_template/ 하위)은 수정 금지.**
> **목적**: 대상 인벤토리(`{{인벤토리 경로}}`)가 확정한 적재 대상을, **모델 신뢰가 아니라 기계 게이트로 정확도를 담보하며** 종목별로 적재. 원형 실적 = 1호(손해평가사) e0-8 P1~P3 독립 적대검증 CRITICAL 0.
> **실행 게이트**: 각 패키지 실행 = **§8 결재란에서 해당 패키지 체크 후**(RULE #5). 미체크 패키지 착수 금지.

---

## 0. 왜 절차 게이트로 감당되는 구조인가 (사실 — 낙관 아님)

1. **작업 성격 = 절차화된 구조화 추출.** 출처 원문(`{{원문 종류: 법령 조문/KEC 조항/교재 절}}`)을 정해진 스키마(노드 타입·엣지·draft SQL)로 옮기는 일. 새 설계 판단이 필요 없다(신규 설계 발생 = §6 에스컬레이션).
2. **정확도 담보 = 기계 게이트 5중**(모델 무관): ① Ontology Lock(종목 registry 허용 ID 패턴 강제) ② schema-validator(`packages/quality`) ③ production/스테이징 무결성 러너(고아·끊김·순환·도달성) ④ QG 게이트(산식·정답 대조) ⑤ **draft-only 적재 + 인간 검수 후에만 approved**(Hard Limit).
3. **원문 대조 가능성**: 모든 신규 노드는 출처 발췌를 병기하는 검수표로 산출 → 진산이 행당 수초로 원문 대비 검증(AI 자기 채점 금지 — RULE #4).
4. **잔존 리스크와 그 처분**: 도메인 미묘 판단(혼동 유형·산식 변수·표/그림 구조)은 §6 에스컬레이션으로 **판단을 멈추고 올린다**. 판단하지 않으면 틀릴 수 없다.
5. **품질 실측 게이트**: 최소 패키지(파일럿)를 먼저 실행 → 검수 FIX율 실측 → 게이트(§8) 통과 후에만 대형 패키지 진입. 측정 전 "된다" 단언 금지(G-1).

## 1. 불변 규칙 (모든 세션 시작 시 복창 — 위반 = 즉시 중단) — 【전 종목 공통·수정 금지】

1. **draft-only**: 모든 INSERT는 `status='draft'`. approved 전이는 인간 검수 후 status_transitions 경유만.
2. **UPDATE 금지**: `knowledge_nodes`/`formulas` 기존 행 UPDATE 절대 금지 — 수정 필요 시 신규 노드 INSERT + SUPERSEDES 엣지(Temporal Graph). 라벨 수리도 동일.
3. **Ontology Lock**: 종목 registry(`exams/{{exam_id}}/registry` 또는 `packages/parser/src/ontology-registry.json`) 패턴 밖 ID 생성 금지. 신규 ID = 해당 타입 production/스테이징 실측 최대 번호 + 1 연번. ★ID 패턴 = `{{ID_PATTERN}}`(예: 손해평가사 `CONCEPT-\d{3}` / 전기기사 `ELEC-{SUBJ}-###` — **비가역 소성, 결재 확정 후만**).
4. **LLM 수식 계산 금지 / 동적 코드 실행 금지 / Constants는 원문 수치 그대로**(환산·추론 금지 — 65↔60 클래스 오류 = 서비스 사망급).
5. **BATCH 순차**: 한 패키지의 기계 검증 + 인간 검수 완료 전 다음 패키지 착수 금지.
6. **production/스테이징 쓰기 = 진산 인증 게이트**: 실행 세션은 SQL 파일 생성까지. `wrangler --remote` 쓰기는 진산 확인 후 별도 단계(읽기 SELECT는 허용). ★2호 이하 신규 종목은 **스테이징 D1 한정**(production 무접촉 — 1호 자산 보호).
7. **`formula-engine`/`migrations`/`constants` 코드 파일 = L3 접촉 금지**(plan 없이 수정 시 Hook 차단). 종목별 산식 정의는 종목 팩(`exams/{{exam_id}}/`)에만.
8. **완료 선언 = Binary Gate 전부 PASS + 독립 리뷰 CRITICAL 0 + 출력물 직접 확인 후만.** 자기 채점 금지.
9. **모르면 멈춘다**: §6 에스컬레이션 조건 도달 시 중단 + 보고. 꼼수·추정 적재 금지.

## 2. 작업 패키지 분할 (파일럿 → 소형 → 대형) — 【종목이 채움】

> 대상의 정본 = `{{인벤토리 경로}}`의 누락(❌)·부분 행. 패키지 시작 시 반드시 그 표에서 대상 행을 옮겨 적고 시작(기억으로 재구성 금지).

| 패키지     | 내용 (인벤토리 §대응)                           | 규모        | 난도 | 순서 근거 |
| ---------- | ----------------------------------------------- | ----------- | ---- | --------- |
| **{{P1}}** | {{파일럿 대상 — 선례와 완전 동형·FIX율 실측용}} | 노드 ~{{n}} | 하   | ★파일럿   |
| **{{P2}}** | {{…}}                                           |             |      |           |
| **{{…}}**  | {{…}}                                           |             |      |           |

**파일럿 게이트**: {{P1}} 검수 FIX율 실측 후에만 대형 패키지 진입(§8). 대형은 장/과목 단위 서브배치 분할 의무.

## 3. 공통 수행 절차 (패키지당 8단계 — 순서 고정) — 【골격 불변, 경로만 종목】

1. **컨텍스트 로드**: `CLAUDE.md` 전문 → 본 플레이북 §1 복창 → `{{인벤토리 경로}}` 해당 묶음 → `{{선례 배치 경로}}`(선례 `*-knowledge-graph.json`+`*-insert.sql` 1쌍 정독 = 산출물 형식 GT).
2. **실태 재확인**(스키마 존재 ≠ 데이터): 읽기 1-쿼리로 대상 ID 대역 최대 번호 실측 — `{{d1_read_command 예: cd apps/api && npx wrangler d1 execute {{DB_NAME}} --remote --json --command "SELECT type, MAX(id) FROM knowledge_nodes GROUP BY type"}}`(**SELECT 외 금지**).
3. **출처 원문 추출**: `{{원문 저장소: docs/manual-{{exam}}/}}` 해당 파일 → 텍스트(pypdf/hwp5html, 페이지 마커 병기). ★페이지 오프셋 = `{{book_page↔원문 오프셋}}`(예: 손해평가사 교재 book_page = PDF_PAGE − 7). 표가 깨지면 §6-3 에스컬레이션.
4. **노드/엣지 설계**: 출처 단위별 노드(name·type·`{{chapter/과목}}`·`{{page/조항}}`·description=원문 충실 요약), 엣지는 기존 노드와의 관계(**기존 엣지 type 어휘만** — 신조어 금지). description에 수치가 들어가면 **원문 문장 그대로** 인용 우선.
5. **draft SQL 생성**: `{{산출 경로: docs/batch-load/{{exam}}-<패키지>-insert.sql}}` — 선례 SQL과 동일 컬럼·형식, `status='draft'` 고정. + `<패키지>-knowledge-graph.json`. **버전 스탬프 기입**(README §규약).
6. **로컬 기계 검증**(전부 PASS 전 검수 요청 금지): `pnpm --filter @thepick/quality test` 회귀 0 / 신규 ID 중복·패턴 검사(중복 0) / SQL 행수 = 설계 노드·엣지 수 일치(무음 skip 차단) / `pnpm g1:check` + lint.
7. **독립 리뷰 + 검수표 산출**(§4·§5·§7) → **인간 검수**(§7 형식). FIX 반영 후 재검증.
8. **적재 집행(진산 게이트)**: 진산 확인 후 wrangler 적재 → 카운트 검산(행수 = INSERT 수) → **무결성 러너 재실행**(고아·끊김·순환 0) → `{{loadmap}}` + 인벤토리에 결과 기록 → 커밋(진산 지시 시).

## 4. 검토·검수 프로토콜 (Binary Gates G-GAP-1~7) — 【불변】

| #       | 게이트         | 판정 방법(기계적)                                                                |
| ------- | -------------- | -------------------------------------------------------------------------------- |
| G-GAP-1 | 대상 완전성    | 인벤토리 대상 행 수 = 산출 노드 커버 출처 단위 수(누락 0 — 대조표 첨부)          |
| G-GAP-2 | ID 무결성      | 신규 ID 전수: registry 패턴 매치 + 중복 0(스크립트 출력 첨부)                    |
| G-GAP-3 | 원문 충실      | 검수표 "원문 발췌" 열이 실제 원문과 일치(리뷰어 표본 ≥30% 재대조)                |
| G-GAP-4 | 수치 무변조    | description·엣지 내 모든 수치가 원문과 문자 일치 — **전수**(표본 아님)           |
| G-GAP-5 | draft-only     | SQL에 `status='draft'` 외 값 0 + approved 전이문 0(grep 증명)                    |
| G-GAP-6 | 행수 검산      | SQL INSERT 행수 = json 노드+엣지 수 = 검수표 행수(3중 일치)                      |
| G-GAP-7 | 적재 후 무결성 | (step8) 러너 gatePass + 신규 노드 고아 0(신규 노드는 엣지 ≥1 의무 = 출처 추적성) |

**독립 리뷰 의무**(자가 리뷰 금지): 산출 세션과 **다른 세션/에이전트**가 리뷰. ① 원문 대조 리뷰어(G-GAP-3·4 위양성 사냥) ② 구조 리뷰어(G-GAP-1·2·5·6 + 엣지 타당성 위음성 사냥) ③ 대형·계산 패키지 한정 도메인 스팟체크 상위 모델 1회(산식·표·혼동 노드 표본). 보고서 = `.claude/reviews/review-YYYYMMDD-HHMMSS-{{exam}}-<패키지>.md`(review-gate hook 정합).

## 5. 세션별 복붙 프롬프트 — 【`{{exam}}` 치환】

### 5.1 실행 세션 (패키지당 1세션)

```
ThePick {{종목명}} 콘텐츠 적재 실행 세션이다. 패키지: <P번호> (docs/plans/{{exam_id}}-content-load.playbook.md §2).
순서: (1) CLAUDE.md 전문 + 플레이북 §1 불변규칙 9개를 읽고 요약 복창. (2) §3 8단계를 step1부터 순서대로 —
step7(인간 검수)·step8(적재)은 인간 게이트, step6까지 완료 후 검수표 제시하고 멈춘다. (3) §6 에스컬레이션
조건에 걸리면 건너뛰지 말고 "ESCALATE: <사유>"로 별도 목록 산출(추정 채움 금지). (4) 산출물: <패키지>-insert.sql /
<패키지>-knowledge-graph.json / 검수표(§7) / ESCALATE 목록 / G-GAP-1~6 자체 점검표(참고용, 판정은 독립 리뷰) +
전 산출물에 버전 스탬프. 자율 금지: production/스테이징 쓰기, formula-engine·migrations·constants 접촉,
기존 노드 UPDATE, approved 전이, 다음 패키지 선착수, git push.
```

### 5.2 독립 리뷰 세션 (실행과 다른 세션)

```
ThePick {{종목명}} 적재 산출물 독립 리뷰다. 대상: <패키지>-* 3종 + G-GAP 점검표. 너는 산출 과정을 모른다 —
적대적으로 반증하라(§4). (1) G-GAP-3: 검수표 ≥30% 무작위 표본 — 출처 직접 추출해 발췌 일치 재확인(불일치=CRITICAL).
(2) G-GAP-4: 수치 노드 전수 문자 일치(불일치=CRITICAL, Hard Stop). (3) G-GAP-1·2·5·6: 기계 검증 재실행(출력 첨부).
(4) 엣지 타당성 표본 10건. (5) 위음성: 인벤토리 대상 중 산출물에 없는 단위 수색. 보고: review-<ts>-{{exam}}-<패키지>.md
— CRITICAL/MAJOR/MINOR + 증거 + Devil's Advocate 1개+. "0건" = 확인 증거 3개+ 필수. CRITICAL 0 전 검수 요청 금지.
```

## 6. 에스컬레이션 규칙 (멈춰야 하는 순간 — 판단 금지 목록) — 【불변】

1. **산식 발견**: 새 산식(equation) 등장 → 노드는 만들되 `formulas` 테이블·engine 등록 **금지** = "산식 후보" ESCALATE(formula-engine = L3). ★종목별 산식 엔진 확장(예: 전기 삼각함수·exp·pi)은 별도 L3 plan.
2. **수치 상수 신규**: constants 성격 수치(요율·임계·계수) → 노드 description 원문 인용만, constants 테이블 INSERT는 ESCALATE.
3. **표/그림 구조 복잡**(병합 셀·다단 표·그림/도면 의존): Table-as-Micro-KG(ADR-032) 또는 도면 스키마 판단 필요 → ESCALATE. 추출 깨짐도 동일(Vision/별도 절차 = 상위 모델).
4. **기존 노드와 중복 의심**: 동일 개념이 이미 있는 듯하면 신규 발급 말고 ESCALATE(의미 중복 판단 = 인간/상위 모델. 채택 시 CROSS_REF 필수·문언 차별화).
5. **출제영역 관련성 판단**: 스코프 판단 금지 — 인벤토리에 있으면 적재, 없으면 건너뜀. 목록 자체 의문 시 ESCALATE.
6. **미시행 개정 병기**(장래 시행분): 현행/장래 택일 말고 양쪽 note 병기 + `effective_date` 축 → ESCALATE(시행시점 정책).
7. **같은 문제 2회 수정 실패**: zoom-out 의무 — 중단·보고.

## 7. 인간 검수표 형식 (행당 수초 검수 목표) — 【불변】

| 신규 ID | name | 출처 ({{chapter/과목}}, {{page/조항}}) | 원문 발췌 (핵심 1~2문장) | 엣지 (대상 ID·타입) | 플래그 |
| ------- | ---- | -------------------------------------- | ------------------------ | ------------------- | ------ |

- 플래그 열: 수치 포함 / ESCALATE 연관 / 신규 엣지 다수 등 — 주의 유도.
- 검수 액션 = 행당 APPROVE / FIX(사유) / REJECT. FIX·REJECT율을 패키지별 기록(§8 게이트 입력).

## 8. 실행 결재란 + 품질 게이트 (진산 — RULE #5) — 【인스턴스가 비운 채 상신】

> 체크 = 해당 갭을 "적재"로 처분. **미체크 패키지 착수 금지.**

```
[ ] {{P1}} (파일럿)        — 착수 승인 대기
[ ] {{P2}}                 — {{P1}} FIX율 게이트 후
[ ] {{…}}
[ ] 품질 게이트 확정: {{P1}} 파일럿 FIX율 기준
```

## 9. 참조 (실행 세션 필독 순서) — 【`{{...}}` 치환】

1. `CLAUDE.md`(전문 — G-1·Hard Limit·L3) + `docs/plans/opus-dual-track-playbook-20260704.md`(실행 정본·가드레일)
2. 본 플레이북 §1→§3→§6
3. `{{인벤토리 경로}}`(대상 정본)
4. `{{loadmap}}` + `{{선례 배치 경로}}` 선례 1쌍
5. `docs/FRAMEWORK.md`(프레임워크 6층) + `docs/playbooks/_template/README.md`(버전 스탬프 규약)
6. `.claude/rules/production-quality.md` + `.claude/rules/auto-review-protocol.md`
