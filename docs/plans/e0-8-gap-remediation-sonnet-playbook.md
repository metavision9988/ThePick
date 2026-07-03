# E0-8 갭 보강 BATCH — Sonnet급 실행 플레이북 v1.0 (2026-07-02)

> **목적**: E0-8 역감사(`docs/audit/content-coverage-20260702.md`)가 확정한 적재 갭을 **Sonnet급
> 모델 세션에서 정확하게 보강 적재**하기 위한 수행 지침 + 검토·검수 프로토콜. 토큰 비용 절감을 위해
> 실행 모델을 낮추되, **정확도는 모델 신뢰가 아니라 게이트가 담보**하도록 설계한다.
> **작성**: Fable 5 (진산 지시 2026-07-02 "sonnet에서 완벽히 진행 가능하도록 수행 지침·검토·검수
> 프롬프트 문서"). 선례 형식 = `master-remediation-20260610/OPUS48_EXECUTION_PLAYBOOK.md`.
> **실행 게이트**: 본 플레이북의 각 패키지 실행 = **§8 결재란에서 해당 패키지 체크 후** (E0-8 갭
> 처분 결재의 A군 채택과 동일 행위 — 체크 = 그 갭을 "보강"으로 처분).
> **모델 표기**: "Sonnet급" = 현행 `claude-sonnet-4-6` (작성 시점 최신 Sonnet. 상위 모델 = Fable 5).

---

## 0. 왜 Sonnet급으로 감당되는 구조인가 (사실 — 낙관 아님)

1. **작업 성격 = 절차화된 구조화 추출.** 출처 원문(법령 조문/교재 절)을 정해진 스키마(노드 7타입·
   엣지·draft SQL)로 옮기는 일 — BATCH-1~7 + L1/L2 + R1/R2 에서 방법론·산출물 형식이 이미 확립
   (`docs/plans/batch-loadmap.md`, `docs/batch-load/` 15종 선례). 새 설계 판단이 필요 없다.
2. **정확도 담보 = 기계 게이트 5중** (모델 무관): ① Ontology Lock(허용 ID 패턴 강제) ② schema-validator
   (packages/quality) ③ production 무결성 러너(고아·끊김·순환·도달성) ④ QG 게이트(산식·정답 대조)
   ⑤ **draft-only 적재 + 진산 검수 후에만 approved** (Hard Limit — DB 트리거로 기계 강제).
3. **원문 대조 가능성**: 모든 신규 노드는 출처 발췌를 병기하는 검수표로 산출 → 진산이 행당 수초로
   원문 대비 검증. AI 자기 채점은 어차피 금지(RULE #4) — 이 구조는 상위 모델이어도 동일했다.
4. **잔존 리스크와 그 처분**: 도메인 미묘 판단(혼동 유형·산식 변수·표 구조)은 Sonnet 약점 후보 →
   **§6 에스컬레이션 규칙으로 판단을 멈추고 올리게** 설계. 판단하지 않으면 틀릴 수 없다.
5. **품질 실측 게이트**: 최소 패키지(P1, 조문 22)를 파일럿으로 먼저 실행 → 진산 검수 FIX율 실측 →
   FIX율 기준(§8) 통과 후에만 대형(P5, 교재 1권)에 진입. 측정 전 "된다" 단언은 하지 않는다.

## 1. 불변 규칙 (모든 세션 시작 시 복창 — 위반 = 즉시 중단)

1. **draft-only**: 모든 INSERT 는 status='draft'. approved 전이는 진산 검수 후 status_transitions 경유만.
2. **UPDATE 금지**: knowledge_nodes / formulas 기존 행 UPDATE 절대 금지 — 수정 필요 시 신규 노드 INSERT
   - SUPERSEDES 엣지 (Temporal Graph). D군 라벨 수리도 동일.
3. **Ontology Lock**: `packages/parser/src/ontology-registry.json` 패턴 밖 ID 생성 금지. 신규 ID = 기존
   타입별 최대 번호 + 1 연번 (production 실측 최대값 기준 — §3 step2 에서 확인).
4. **LLM 수식 계산 금지 / 동적 코드 실행 금지 / Constants 는 원문 수치 그대로** (환산·추론 금지 —
   65↔60 클래스 오류는 서비스 사망급).
5. **BATCH 순차**: 한 패키지의 기계 검증 + 진산 검수 완료 전 다음 패키지 착수 금지.
6. **production 쓰기 = 진산 인증 게이트**: Sonnet 세션은 SQL 파일 생성까지. `wrangler --remote` 쓰기
   실행은 진산 확인 후 별도 단계 (읽기 SELECT 는 허용).
7. **formula-engine / migrations / constants 코드 파일 = L3 접촉 금지** (plan 없이 수정 시 Hook 차단).
8. **완료 선언 = Binary Gate 전부 PASS + 독립 리뷰 CRITICAL 0 + 출력물 직접 확인 후만.** 자기 채점 금지.
9. **모르면 멈춘다**: §6 에스컬레이션 조건 도달 시 작업 중단 + 보고. 꼼수·추정 적재 금지.

## 2. 작업 패키지 분할 (권고 순서 = 파일럿 → 소형 → 대형)

| 패키지 | 내용 (E0-8 리포트 §2 대응)                                                 | 규모                      | 난도      | 순서 근거                                                                                       |
| ------ | -------------------------------------------------------------------------- | ------------------------- | --------- | ----------------------------------------------------------------------------------------------- |
| **P1** | A-3 법령 조문 22 (법률 제8조·제11조 / 시행령 12 / 상법 제642조+책임보험 7) | 노드 ~22+엣지             | 하        | ★파일럿 — L1/L2 선례와 완전 동형, FIX율 실측용                                                  |
| **P2** | A-2 부록 요령 전문(15조문±)+운영규정+목적물고시 (book 807~826)             | 노드 ~30±                 | 하~중     | P1 과 동일 방법론 (법령 축)                                                                     |
| **P3** | A-5 개정 2차 B-항목 4건                                                    | 노드 ~4-8                 | 하        | 개정 문서 축 — 소형                                                                             |
| **P4** | A-4 교재 2권 내 실질 누락 ~25단위 (감수과실수 사슬 8 포함)                 | 노드 ~40-70               | **중~상** | 산식·표 다수 → §6 에스컬레이션 빈발 예상 구간                                                   |
| **P5** | A-1 교재 1권 4개 장+미경과비율표 (book 1~389)                              | 노드 [미측정 — 수백 추정] | 중        | 최대 규모 — **P1~P3 FIX율 게이트 통과 후만** + 장 단위 서브배치(P5a 제1장 … P5e 별표) 분할 의무 |
| **P6** | D군 라벨·앵커 오류 의심 7건 + 미시행 개정 선반영 4건 수리                  | SUPERSEDES ~11            | 중        | 신규 적재 아닌 수리 — 규칙 2 절차. 검수 근거는 inventory 에 확보됨                              |

**대상 목록의 정본** = `docs/audit/content-coverage-inventory-20260702.md` 의 해당 묶음 ❌(누락)·부분 행.
패키지 시작 시 반드시 그 표에서 대상 행을 옮겨 적고 시작한다 (기억으로 재구성 금지).

## 3. 공통 수행 절차 (패키지당 8단계 — 순서 고정)

1. **컨텍스트 로드**: CLAUDE.md 전문 → 본 플레이북 §1 복창 → `content-coverage-inventory-20260702.md`
   해당 묶음 → `batch-loadmap.md` 해당 축 선례 → `docs/batch-load/` 동형 배치의 `*-knowledge-graph.json`
   - `*-insert.sql` 1쌍 정독 (산출물 형식의 GT).
2. **실태 재확인 (스키마 존재 ≠ 데이터 아님 교훈)**: production 읽기 1-쿼리로 대상 ID 대역 최대 번호
   실측 (`cd apps/api && npx wrangler d1 execute thepick-db-production --remote --json --command
"SELECT type, MAX(id) FROM knowledge_nodes GROUP BY type"` 류. **SELECT 외 금지**).
3. **출처 원문 추출**: `docs/manual/` 해당 PDF → 텍스트. 추출 스니펫(pypdf, 페이지 마커):

   ```python
   from pypdf import PdfReader
   r = PdfReader('docs/manual/<파일>.pdf')
   for i, pg in enumerate(r.pages, 1):
       print(f'\n===PDF_PAGE {i}===\n{pg.extract_text() or ""}')
   ```

   ★교재 이론서: **인쇄본 book_page = PDF_PAGE − 7**. ★book_page 는 chapter 별 자체 축(법령은 법령
   PDF 자체 페이지) — E0-8 prestage §3 준수. 표가 깨져 나오면 §6-3 에스컬레이션.

4. **노드/엣지 설계**: 출처 단위별 노드(name·type·chapter·book_page·description=원문 충실 요약),
   엣지는 기존 노드와의 관계(REQUIRES/DEPENDS_ON/CROSS_REF 류 — 기존 엣지 type 어휘만 사용, 신조어
   금지). description 에 수치가 들어가면 **원문 문장 그대로** 인용 우선.
5. **draft SQL 생성**: `docs/batch-load/gap-<패키지>-insert.sql` — 선례 SQL 과 동일 컬럼·형식.
   status='draft' 고정. 함께 `gap-<패키지>-knowledge-graph.json` (선례 형식) 생성.
6. **로컬 기계 검증** (전부 PASS 전 검수 요청 금지):
   - `pnpm --filter @thepick/quality test` 회귀 0
   - 신규 ID 중복/패턴 검사: 생성 SQL 의 ID 를 production 덤프와 대조하는 1회용 스크립트 (중복 0)
   - SQL 행수 = 설계 노드/엣지 수와 일치 (TD-S45-1 무음 skip 교훈 — 행수 검산 명시)
   - `pnpm g1:check` + lint (문서·SQL 정합)
7. **독립 리뷰 + 검수표 산출** (§4·§5 프로토콜) → **진산 검수** (§7 형식). FIX 반영 후 재검증.
8. **적재 집행 (진산 게이트)**: 진산 확인 후 wrangler 적재 → 카운트 검산(행수 = INSERT 수) →
   **무결성 러너 재실행**(`scripts/run-graph-integrity-production.ts` — 고아·끊김·순환 0 확인) →
   `batch-loadmap.md` + inventory 문서에 결과 기록 → 커밋.

## 4. 검토·검수 프로토콜 (Binary Gates — 패키지 공통 G-GAP-1~7)

| #       | 게이트         | 판정 방법 (기계적)                                                                    |
| ------- | -------------- | ------------------------------------------------------------------------------------- |
| G-GAP-1 | 대상 완전성    | inventory 대상 행 수 = 산출 노드가 커버하는 출처 단위 수 (누락 0 — 대조표 첨부)       |
| G-GAP-2 | ID 무결성      | 신규 ID 전수: registry 패턴 매치 + production 중복 0 (스크립트 출력 첨부)             |
| G-GAP-3 | 원문 충실      | 검수표의 노드별 "원문 발췌" 열이 실제 PDF 텍스트와 일치 (리뷰어 표본 ≥30% 재대조)     |
| G-GAP-4 | 수치 무변조    | description·엣지 내 모든 수치(%·원·cm·계수)가 원문과 문자 일치 — **전수** (표본 아님) |
| G-GAP-5 | draft-only     | SQL 에 status='draft' 외 값 0건 + approved 전이문 0건 (grep 증명)                     |
| G-GAP-6 | 행수 검산      | SQL INSERT 행수 = json 노드+엣지 수 = 검수표 행수 (3중 일치)                          |
| G-GAP-7 | 적재 후 무결성 | (step8) 러너 gatePass + 신규 노드 고아 0 (신규 노드는 엣지 ≥1 의무 — 출처 추적성)     |

**독립 리뷰 의무** (자가 리뷰 금지 — 프로젝트 헌법): 산출 세션과 **다른 세션/에이전트**가 리뷰.
구성 = ① 원문 대조 리뷰어(G-GAP-3·4 담당 — 위양성 사냥: "이 노드의 발췌가 정말 그 페이지에 있나")
② 구조 리뷰어(G-GAP-1·2·5·6 + 엣지 타당성 — 위음성 사냥: "대상 행인데 노드가 안 나온 것") ③ (P4·P5
한정) 도메인 스팟체크를 **상위 모델(Fable) 1회** — 산식·표·혼동 소지 노드만 표본. 리뷰 보고서는
`.claude/reviews/review-YYYYMMDD-HHMMSS-gap-<패키지>.md` 영속 (review-gate hook 정합).

## 5. 세션별 복붙 프롬프트

### 5.1 실행 세션 (Sonnet — 패키지당 1세션)

```
ThePick 갭 보강 BATCH 실행 세션이다. 패키지: <P1|P2|...> (docs/plans/e0-8-gap-remediation-sonnet-playbook.md §2).

순서: (1) CLAUDE.md 전문 + 플레이북 §1 불변규칙 9개를 읽고 요약 복창하라.
(2) 플레이북 §3 의 8단계를 step1 부터 순서대로 수행하라. step7(진산 검수)·step8(적재)은 인간 게이트 —
    step6 까지 완료 후 검수표를 제시하고 멈춘다.
(3) §6 에스컬레이션 조건에 하나라도 걸리면 해당 항목을 건너뛰지 말고 "ESCALATE: <사유>" 로 표시해
    별도 목록으로 산출하라. 추정으로 채우는 것은 금지다.
(4) 산출물: gap-<패키지>-insert.sql / gap-<패키지>-knowledge-graph.json / 검수표(§7 형식) /
    ESCALATE 목록 / G-GAP-1~6 자체 점검표(증거 포함 — 단 자체 점검은 참고용, 판정은 독립 리뷰).
자율 금지: production 쓰기, formula-engine·migrations·constants 코드 접촉, 기존 노드 UPDATE,
approved 전이, 다음 패키지 선착수, git push.
```

### 5.2 독립 리뷰 세션 (Sonnet — 실행과 다른 세션)

```
ThePick 갭 보강 산출물 독립 리뷰 세션이다. 대상: gap-<패키지>-* 3종 + G-GAP 점검표.
너는 산출 과정을 모른다 — 적대적으로 반증하라 (플레이북 §4).
(1) G-GAP-3: 검수표 행 ≥30% 무작위 표본 — 출처 PDF 를 직접 추출해 발췌 일치 재확인. 불일치 = CRITICAL.
(2) G-GAP-4: 수치 포함 노드 전수 — 원문 문자 일치 확인. 불일치 = CRITICAL (Hard Stop 클래스).
(3) G-GAP-1·2·5·6: 기계 검증 재실행 (스크립트/grep — 실행 출력 원문 첨부).
(4) 엣지 타당성: 신규 엣지 표본 10건 — 관계 타입이 원문 서술로 정당화되는지.
(5) 위음성: inventory 대상 행 중 산출물에 없는 단위 수색.
보고: .claude/reviews/review-<ts>-gap-<패키지>.md — CRITICAL/MAJOR/MINOR + 증거 + 반론(Devil's
Advocate) 1개 이상. "0건" 보고에는 확인 증거 3개 이상 필수. CRITICAL 0 전까지 검수 요청 금지.
```

### 5.3 P4·P5 도메인 스팟체크 세션 (Fable — 표본만, 저토큰)

```
ThePick 갭 보강 <패키지> 도메인 스팟체크다. 대상: 산식·표·계수·혼동 소지로 플래그된 노드 표본
(리뷰어 지정 ≤15건). 각각 출처 원문과 대조해 (a) 산식/표 구조 왜곡 (b) 조건·단서 누락 (c) 적용
범위(품목·보장방식) 오귀속을 판정하라. 판정 근거 = 원문 인용. 발견 = CRITICAL 로 실행 세션에 반환.
```

## 6. 에스컬레이션 규칙 (Sonnet 이 멈춰야 하는 순간 — 판단 금지 목록)

1. **산식 발견**: 새 산식(equation)이 출처에 등장 → 노드는 만들되 formulas 테이블·engine 등록은
   **금지** — "산식 후보" 로 ESCALATE (formula-engine = L3, WS-3c §9 ④ 89건 분류 결재와 연동).
2. **수치 상수 신규**: constants 성격 수치(요율·임계·계수 표) → 노드 description 에 원문 인용만,
   constants 테이블 INSERT 는 ESCALATE (검증 게이트 QG-2 연동 필요).
3. **표 구조 복잡** (병합 셀·다단 표·그림 의존): Table-as-Micro-KG(ADR-032) 판단 필요 → ESCALATE.
   pypdf 추출이 깨진 표도 동일 (Vision 재추출 = 상위 모델/별도 절차).
4. **기존 노드와 중복 의심**: 동일 개념이 이미 있는 듯하면 신규 발급하지 말고 ESCALATE (의미 중복
   판단 = 인간/상위 모델).
5. **출제영역 관련성 판단**: "이건 시험에 안 나올 것 같다" 류 스코프 판단 금지 — 대상 목록(inventory)
   에 있으면 적재, 없으면 건너뜀. 목록 자체에 의문이 생기면 ESCALATE.
6. **미시행 개정 병기** (2026.8.15 시행분 등): 현행/장래 중 택일하지 말고 양쪽을 note 로 병기해
   ESCALATE (시행시점 축 = E0-8 발견 ⑦, 정책 미결).
7. **같은 문제 2회 수정 실패**: zoom-out 의무 — 중단·보고 (진산 확립 규율).

## 7. 진산 검수표 형식 (행당 수초 검수 목표)

| 신규 ID | name | 출처 (chapter, page) | 원문 발췌 (핵심 1~2문장) | 엣지 (대상 ID·타입) | 플래그 |
| ------- | ---- | -------------------- | ------------------------ | ------------------- | ------ |

- 플래그 열: 수치 포함 / ESCALATE 연관 / 신규 엣지 다수 등 — 진산 주의 유도.
- 검수 액션 = 행당 APPROVE / FIX(사유) / REJECT. FIX·REJECT 율을 패키지별 기록 (§8 게이트 입력).

## 8. 실행 결재란 + 품질 게이트 (진산 — RULE #5)

> 체크 = 해당 갭을 "보강 적재"로 처분 (E0-8 리포트 §2 A군 처분과 동일 효력). **미체크 패키지 착수 금지.**

```
[x] P1 법령 조문 22 (파일럿)          — 착수 승인 ★진산 2026-07-02 ("이거 하고 나서 sonnet 5로 플레이북 진행" = P1 파일럿 착수 승인. P2~P5 = P1 검수 FIX율 게이트 후). ✅ 실행·production draft 적재 완료(LAW-144~165, 커밋 0b9baec/6f83d37).
[x] P2 부록 요령·규정·고시            — ★진산 2026-07-02 "P2 착수" + override 결재: P1 검수 FIX율 게이트 **명시 생략 승인**(근거 = P1 독립 적대검증 2회 CRITICAL 0 = 품질 신호 수용, Opus 실행이라 Sonnet FIX율 프록시 무의미). P1 draft 검수는 approved 전이 전 별도 진행. **불변규칙 #5 예외 = 이 override 결재로 명문화.** Opus 4.8 실행.
[x] P3 개정 2차 B-항목 4              — ★진산 2026-07-03 "P3 착수" (P2 override 연속 = 패키지별 독립 리뷰 CRITICAL 0 게이트로 FIX율 대체). Opus 4.8 실행. B-항목3b·3c·4b·5d (inventory ❌ 4건 = E0-8 A-5)
[ ] P4 교재 2권 실질 누락 ~25         — P1~P3 FIX율 게이트 통과 후
[ ] P5 교재 1권 (장별 서브배치 5)     — P4 와 동일 게이트 + 서브배치별 순차 검수
[ ] P6 D군 라벨 수리 11 (SUPERSEDES)  — 별도 (신규 적재 아님·수리)
[~] 품질 게이트 확정: P1 파일럿 FIX율 게이트 = ★진산 override(2026-07-02)로 **명시 생략** — P1 을
    Opus 4.8 이 실행해 Sonnet-FIX율 프록시가 무의미 + 독립 적대검증 2회 CRITICAL 0 을 품질 신호로 수용.
    ⇒ P2~ 는 Opus 실행 + 패키지별 독립 리뷰 CRITICAL 0 게이트로 대체(Sonnet 전환 시 본 게이트 재활성).
```

- ★ **P1 법률 2조문 결재 (진산 2026-07-02, A안)**: 계획 검토에서 제8조·제11조가 기존 approved
  LAW-001/002(교재 개관장 요약본)로 존재함이 발견됨(inventory:41·45·281). **A안 채택** = 법령 원문
  노드 신규 생성(LAW-144·145) + LAW-001/002·CONCEPT-137·INV-087 과 CROSS_REF 연결 ⇒ **P1 = 22노드
  확정(LAW-144~165)**. 에스컬레이션 규칙 4(중복 의심)는 이 2건에 한해 A안 결재로 예외(단 CROSS_REF
  필수·문언 차별화). 상세 = `.jjokjipge/handoff-sonnet-gap-p1.md` §3·§6. 나머지 20건(시행령 12·상법 8)은 inventory ❌ 행과 완전 일치(clean).
- **B군(스코프 제외)·C군(자료 한계)은 본 플레이북 범위 밖** — E0-8 리포트 §2 에서 별도 처분.
- 파일럿 실측 전 "Sonnet 으로 전 패키지 완주" 를 단정하지 않는다 (G-1 — 실측이 잣대).

## 9. 참조 (실행 세션 필독 순서)

1. `CLAUDE.md` (전문 — G-1·Hard Limit·L3)
2. 본 플레이북 §1→§3→§6
3. `docs/audit/content-coverage-inventory-20260702.md` (대상 정본)
4. `docs/plans/batch-loadmap.md` + `docs/batch-load/` 선례 1쌍
5. `docs/audit/e0-8-prestage-d1-inventory-20260612.md` §3 (페이지축 함정)
6. `.claude/rules/production-quality.md` + `auto-review-protocol.md`
