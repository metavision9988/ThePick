# 산식 동기 manifest plan (WS-3c) — 코드↔D1 equation_template 대조 장치

> **상태**: DRAFT. **L3 (산식 계수 = 서비스 사망 영역).** 본 plan 은 _무엇을 왜 어떻게_ +
> 대안 비교(PITR) + 검증 게이트까지다. **formula-engine·loader 코드 착수 = 진산 결재 후**(§9).
> 자율 착수 금지 — 본 문서(plan) 작성만 자율 범위(OPUS48_EXECUTION_PLAYBOOK.md:161 "3c는 L3 —
> plan 작성까지, formula-engine 코드 접촉은 승인 후").
> **진입 결재**: MASTER_PLAN §6 #5 ☑ (2026-06-11 "추천한 것으로", WS-3c 착수 승인).
> **근거 실측**: production read-only(2026-06-13) + 3축 병렬 탐사(wf_04f20616 — 코드/문서/QG).
> **Binary Gate 종착**: MASTER_PLAN.md:149 G-WS3 ⑤ "manifest: 68 engine-backed ID 전수 D1 대조 스크립트 PASS".

---

## 0. Reality Anchor (이 장치가 막는 것 / 못 막는 것 — 먼저)

**막는 것**: 코드 레지스트리(F-01~F-68)와 D1 formulas 의 **equation_template 문자열이 어긋났는지**를
기계가 자동 탐지 (현재 대조 테스트 0건 = 2027 개정 시 한쪽만 고쳐 65↔60 클래스 오류가 무음 통과).

**못 막는 것 (정직)**:

1. **89건은 영영 못 막는다 (계산 사각)**. D1 157행 중 코드 레지스트리에 있는 건 68개뿐. 나머지
   **89건(F-69~F-157 등)은 formula-engine 미등록 = math.js AST 평가 불가 = QG 정확도 검증 사각**.
   대조 manifest 가 이 89건을 display-only 로 분류하면 "정확성 검증 영구 부재"를 명문화하는 것이다 —
   이 분류 자체가 RULE #5 인간 결재 사안(§9). 본 plan 은 89건을 *탐지*하지 *해소*하지 않는다.
2. **5중 보관의 근본 해소가 아니다**. 계수는 ①코드 equationTemplate ②D1 formulas ③D1 constants(분해)
   ④노드 desc·엣지 condition 자유텍스트 ⑤골든 기대값 의 5처에 중복 존재(§1). 본 plan 의 대조는
   ①↔② 단 1쌍만 본다. 단일 진실원화(ConstantsProvider D1 연동·supersededBy 활성)는 **2027 R-BATCH
   이월 별건 L3**(OPUS48 작업B 4항). 본 plan = "탐지 게이트"이지 "근본 수술"이 아니다.
3. **런타임 소비자 0 — 지금은 회귀해도 학습자 영향 0**. D1 equation_template 을 평가하는 학습자 경로는
   없다(apps/api·web 에 formula-engine import 0). 따라서 본 장치의 가치는 *현재 사용자 보호*가 아니라
   **2027 개정 시 드리프트 조기 경보** + RC-3(학습자 배선) 진입 전 안전망 선설치다. ROI 의 절박도는
   "지금"이 아니라 "개정·배선 시점"에 발생한다 — 그 전에 깔아두는 보험.
4. **production 미적재 컬럼 3종**. equation_display·expected_inputs·graceful_degradation 은 D1
   0/157(loader 가 INSERT 자체를 안 함). manifest 가 이들을 대조 범위에 넣으면 157건 전부 "불일치"로
   뜬다 — 대조 범위 결정(§4 PITR)이 선결.

> ⇒ 본 plan 은 "동기됐다"를 단언하지 않는다. **대조 도구를 만들어 실행하면 *현재 동기 상태(일치 N /
> 불일치 M)가 사실로 측정*된다**. 측정 결과·89건 분류·근본 해소 GO 는 전부 진산(§9).

---

## 1. 측정이 확정한 사실 (file:line — 코드·문서·QG 3축 cycle-closed)

### 1.1 "코드 68"의 실체 (engine-backed)

- formula-engine 의 `ALL_FORMULAS` = batch1~5-definitions.ts 의 `FormulaDefinition` 객체 **정확히
  68개**(F-01~F-68: 13+17+8+15+15). `packages/formula-engine/src/formulas/index.ts:14-20` 스프레드.
- 평가 경로: `engine.ts:calculate()` → `getFormula(id)` → `parseFormula(equationTemplate)`(ast-parser.ts:45)
  → math.js `safeParse`(AST 화이트리스트 5종·함수 16종) → `safeEvaluate`(AST node ≤200·depth ≤15·
  wall-clock ≤50ms). 동적 실행(evaluate/compile/simplify/derivative/resolve/chain) = **throwing stub
  완전 차단**(sandbox.ts:117-151 stub 블록). ⇒ **Hard Limit "동적 코드 실행 금지" 준수 확인**.
- "68" 수의 코드 측 자기 명시: `engine.ts:42`("F-01~F-68"), `sandbox.ts:243`, `qg2-validator.ts:40`
  (`CUMULATIVE_FORMULA_THRESHOLDS['BATCH-5']=68`).

### 1.2 "D1 157"의 실체 (production read-only, 2026-06-13)

| 컬럼                 | 채움               | 비고                                                                            |
| :------------------- | :----------------- | :------------------------------------------------------------------------------ |
| equation_template    | **157/157**        | math.js AST 실수식. 예 F-01 `damaged_fruits / (damaged_fruits + normal_fruits)` |
| variables_schema     | 157/157            |                                                                                 |
| node_id              | 157/157            | F-xx 1:1 (단 ★코드 측 FormulaDefinition.nodeId 는 68개 전부 미설정)             |
| is_current_active    | 157/157            |                                                                                 |
| equation_display     | **0/157**          | loader INSERT 컬럼 목록에서 제외(draft-loader.ts:388-391)                       |
| expected_inputs      | **0/157**          | 〃                                                                              |
| graceful_degradation | **0/157**          | 〃                                                                              |
| version_year         | 2025=13 / 2026=144 | per-batch ctx.versionYear bind (코드 68개는 전부 2025 — 사문)                   |

- D1 진실원 = BATCH contract: `batch-processor.ts:234` 프롬프트("equation_template: math.js 파서
  호환 수식") → `draft-loader.ts:380-411` INSERT. 코드 미등록 89건 ID = F-71/F-86/F-98~F-130(BATCH-6
  전후)/F-131~F-151/F-152~F-157 (batch-loadmap.md:45,57,58 — `formula_id_pattern` `^F-\d{2}$`→`^F-\d{2,3}$`).

### 1.3 RC-5 — 계수 5중 보관처 (동기 검증 기계 0건)

F-06 단감 인정피해율(`1.0115 * defoliation_rate - 0.0014 * elapsed_days`)을 표본 추적:

| #   | 보관처                                                  | file:line                                          |
| :-- | :------------------------------------------------------ | :------------------------------------------------- |
| 1   | 코드 equationTemplate 인라인                            | `batch1-definitions.ts:174`                        |
| 2   | D1 `formulas.equation_template`                         | `docs/batch-load/batch-1-v2/batch-1-insert.sql:97` |
| 3   | D1 `constants`(분해: CONST-001=1.0115·CONST-002=0.0014) | `batch-1-insert.sql:107-108`                       |
| 4   | 노드 description + 엣지 condition 자유텍스트            | `batch-1-insert.sql:23,30,70,165`                  |
| 5   | 골든 기대값(`toBeCloseTo(0.4132,4)` + 손계산 주석)      | `batch1-golden.test.ts:97-98`                      |

- supersededBy 사문: `schema.ts:277` superseded_by 컬럼 + `types.ts:42` SUPERSEDES 엣지 = **선언만,
  산식 계수 버전관리 소비 0**. INSERT+SUPERSEDES 패턴은 있으나 개정 동기 장치로 미작동.

### 1.4 소비자 지형 (MASTER_PLAN "batch QG 단 1곳"의 정밀 분해)

- (a) **런타임 계산 소비자 0**: apps/api·web·admin-web 에 `@thepick/formula-engine` import 0건(grep).
- (b) **QG 정확도 검증**: `qg2-validator.ts:118` `calculate(...)` = **코드 레지스트리만** 호출,
  **D1 formulas 를 안 읽음** → D1 적재물 정확성은 QG-2 가 전혀 검증 안 함. 골든은 BATCH-1 일 때만
  로드(`batch.ts:254-261`), 그 외 배치는 산식 정확도 stage skip.
- (c) **D1 equation_template reader**: `table-fetcher.ts:339,410` — Vectorize 임베딩 텍스트 합성(검색
  가시화), **계산 아님**.

### 1.5 정규화 재료·대조 선례 (이미 존재 — 재활용 가능)

- 정규화: `packages/parser/src/normalizer.ts:32,64,89,169` — `SHA-256(equation_template + '|::|' +
canonical variables_schema)` 해시 스킴 보유. F-01 코드(`batch1-definitions.ts:17`) ==
  contract(`batch-1-sample-extract.json:90`) byte-identical 확인됨. ⚠️ **경로 주의(독립 검증 반론 2)**:
  normalizer.ts 가 parser·quality 2곳 존재하나 본 스킴은 **parser** 본. 코드 착수 시 재활용 = parser→
  quality 임포트 방향(auto-review Pass2 단방향 규칙) 위반 위험 → §3.2 모듈 경로 결정 선결.
- 대조 스크립트 선례: `scripts/run-graph-integrity-production.ts`(wrangler --remote --json 덤프 → 순수
  코어 대조 → 리포트 + **fabricate 차단**: 덤프 부재 시 명시 에러) + `scripts/verify-engine-contracts.ts`
  (gate 미달 `exit 1` CI 차단, execFileSync injection 차단).

---

## 2. WS-3c 산출물 범위 (OPUS48 작업B 5항 정합)

| #   | 산출물                                          | 본 plan 위치                   | 비고                                        |
| :-- | :---------------------------------------------- | :----------------------------- | :------------------------------------------ |
| 1   | 코드 68 vs D1 157 차분 조사                     | §1.1·1.2 (repo 기준 완료)      | 라이브 1:1 대조는 진산 wrangler 인증 게이트 |
| 2   | engine-backed/display-only 구분 명문            | §3 + §9 결재(89건 분류)        | ADR 부재 → 본 plan 이 첫 정의               |
| 3   | equation_template vs D1 문자열 대조 테스트 설계 | §3·§4 PITR                     | 코드 착수 = 결재 후                         |
| 4   | supersededBy/ConstantsProvider 실구현           | **2027 R-BATCH 이월**(별건 L3) | §0 못-막는것 2                              |
| 5   | Binary Gate + 결재란                            | §5·§9                          |                                             |

---

## 3. 설계 (대조 장치 — 코드 착수는 결재 후)

### 3.1 engine-backed / display-only 구분 정의 (본 plan 신규 명문)

- **engine-backed**: 코드 `ALL_FORMULAS` 레지스트리에 id 가 존재 = math.js AST 평가 가능 = 골든 검증
  대상 = D1 과 equation_template 문자열 대조 의무. **현 68건(F-01~F-68)**.
- **display-only**: D1 에만 존재(코드 미등록) = 평가 불가 = 검색 임베딩 가시화 전용. **현 89건**.
  ⚠️ 이 분류는 "정확성 기계 검증 영구 부재"를 함의 → §9 진산 결재(승격 vs 영구 전시).
- 코드 측 기계 강제: 현재 enum/플래그 없음. 본 plan 채택 시 `FormulaDefinition` 에 식별 불요(레지스트리
  존재 자체가 engine-backed) — manifest 가 `ALL_FORMULAS.map(f=>f.id)` 를 engine-backed 집합으로 산출.

### 3.2 대조 manifest 구조 (산출물 — 코드 착수 결재 후)

```
manifest = {
  generatedAt, codeFormulaCount: 68, d1FormulaCount: <측정>,
  engineBacked: [ { id, codeTemplate, d1Template, match: bool, normalizedMatch: bool } ],  // 68건
  displayOnly:  [ { id, d1Template } ],                                                      // 89건(측정)
  drift: [ { id, kind: 'template-mismatch'|'code-missing-in-d1'|'d1-missing-in-code' } ],
  unpopulatedColumns: { equation_display, expected_inputs, graceful_degradation }            // 정직 표기
}
```

- 대조 스크립트 = `scripts/run-formula-sync-manifest.ts`(가칭, run-graph-integrity 선례 모방):
  wrangler --remote --json 으로 `SELECT id,equation_template,variables_schema,version_year,node_id
FROM formulas` 덤프 → 순수 코어가 `ALL_FORMULAS` 와 대조 → 리포트. **read-only**. fabricate
  차단(덤프 부재/빈 시 명시 에러). ⚠️ **모듈 경로 결정(반론 2)**: 정규화 스킴 재활용 시 임포트
  단방향 보전 — (i) parser normalizer 를 `packages/shared` 승격 (ii) 스크립트 전용 복제 (iii) quality 가
  parser 의존 추가 중 택1 = §9 결재. 권고 = **(ii) 복제**(정규화 ≤30줄·parser 진화와 결합 불요·
  shared 승격은 영향면 큼).
- 대조 테스트 1건(`*.test.ts`): repo 고정 픽스처(또는 batch-insert.sql 파싱)로 engine-backed 68건
  template 일치를 CI 에서 검증 (라이브 의존 0 — CI 게이트화).

### 3.3 Hard Limit 준수 (대조 방식 제약)

- equation_template 을 **evaluate/compile/parse 로 실행하지 않는다** — 순수 문자열/AST-구조 대조만
  (sandbox throwing stub 정합). LLM 수식계산 금지 → 결정적 대조만. 정답값 검증은 기존 골든(AST 파서)
  소관이고 본 장치 범위 밖.

---

## 4. PITR (권고 default — 진산 1줄 조정 가능)

| 축                | 선택지                                                                        | 권고                                | 근거                                                                                                                                                                                                                                                                                |
| :---------------- | :---------------------------------------------------------------------------- | :---------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 대조 정규화       | (A) 문자열 byte-eq (B) parser SHA-256 스킴 재활용 (C) math.js AST 정규형 hash | **B** (C 비채택 권고)               | B = normalizer 재활용. ★C 는 `safeParse` 필수 = §5 **G-WS3c-6("대조 경로 parse 실행 0")과 직접 모순**(독립 검증 반론 3) → C 채택 시 G-WS3c-6 재정의(engine-backed 한정 safeParse 허용·evaluate 0) 필요. 표기차(`ceil(x)`vs`ceil( x )`)는 B 의 공백 정규화로 흡수 가능 → C 불요 권고 |
| version_year      | (A) 비교 키 제외 (B) 코드값 사문 명문화                                       | **A + B**                           | 코드 68 전부 2025 vs D1 per-batch ctx = 코드값 미사용 사실 명문                                                                                                                                                                                                                     |
| 미적재 3컬럼      | (A) 대조 범위 제외·정직 표기 (B) equation_display 백필 트랙                   | **A** (B 는 별건)                   | 157 전건 불일치 노이즈 차단. 백필=별도 결재                                                                                                                                                                                                                                         |
| 89건 display-only | (A) 영구 전시 분류 (B) engine 승격 로드맵                                     | **결재 보류**(§9)                   | RULE #5 — "검증 영구 부재 명문화" = 인간 결정. RC-3(WS-5f) 교차                                                                                                                                                                                                                     |
| 대조 실행 면      | (A) CI 고정 픽스처 (B) 라이브 wrangler (C) 둘 다                              | **C** (A 우선 배선, B 진산 인증 시) | A=무인증 CI 게이트, B=실 production 진실                                                                                                                                                                                                                                            |

---

## 5. Binary Gate (manifest 완료 판정 — 코드 착수 후)

- **G-WS3c-1 (차분 정확)**: manifest.engineBacked.length === 68 AND displayOnly 합 === d1Count − 68.
- **G-WS3c-2 (대조 결정성)**: 동일 입력 2회 실행 = byte-동일 리포트 (Date 외).
- **G-WS3c-3 (drift 검출 실증)**: 코드 1건 template 을 의도 변조 → 스크립트가 template-mismatch 1건
  검출 (음성 회귀 가드 — "0 drift"가 "안 봄" 아닌 "봄").
- **G-WS3c-4 (G-WS3 ⑤ 충족)**: engine-backed 68 ID 전수 D1 대조 PASS (MASTER_PLAN.md:149).
- **G-WS3c-5 (read-only·fabricate 차단)**: production 쓰기 0 + 덤프 부재 시 명시 에러(가짜 PASS 0).
- **G-WS3c-6 (Hard Limit)**: 대조 경로에 evaluate/compile/parse 실행 0 (grep) — 순수 대조만.
  ★ PITR-C(AST 정규형 hash) 채택 시 본 게이트가 `safeParse` 와 충돌(반론 3) → C 비채택(권고 B) 유지
  시 충돌 없음. C 채택 결재 시 본 게이트를 "engine-backed 한정 safeParse 허용·evaluate 0" 로 재정의 의무.

---

## 6. 위험·회귀 표면

- **회귀 표면**: 신규 `scripts/run-formula-sync-manifest.ts` + 대조 테스트 + (선택)순수 코어 모듈.
  formula-engine **평가 경로 무접촉**(읽기 전용 `ALL_FORMULAS` 참조만) = engine.ts/sandbox.ts/ast-parser.ts
  불변. loader 무접촉.
- **F-55 TODO 선결 처분**: `batch5-definitions.ts`(F-55 시설물 자기부담금) constraints 에 `// TODO:
교차검증 필요…` 주석 존재 = CLAUDE.md Hard Limit/production-quality.md TODO 금지 위반. 본 plan 코드
  착수 전 처분 방향 결재(§9) — 단 formula-engine 접촉이라 L3.

---

## 7. 시퀀싱

```
[자율·완료] §1 실측 (repo + production read-only) → 본 plan 영속
[결재 #5 ☑ 후속] §9 결재 (89건 분류·PITR 채택·F-55 처분) ─┐
                                                          ├→ 코드 착수(L3): manifest 스크립트 + 대조 테스트
[병렬·이월] supersededBy/ConstantsProvider 단일진실원화 ──┘    → G-WS3c-1~6 + 4-Pass → G-WS3 ⑤ 충족
            = 2027 R-BATCH 별건 L3 plan
```

## 8. ROI 정직

- 본 장치는 **현 사용자 0 영향**(런타임 미배선). 가치 = 2027 개정·RC-3 배선 시점의 드리프트 조기경보
  보험. 비용 = 스크립트 1 + 테스트 1(소). engine-backed 68 한정이라 작다.
- **89건 display-only 의 "검증 영구 부재"가 진짜 리스크** — 본 plan 은 이를 *가시화*하지 *해소*하지
  않는다. 해소(engine 승격 or BATCH 정확도 게이트)는 별건·진산 결재.

## 9. 진산 결재란 (RULE #5 — AI 판정 금지)

```
[ ] WS-3c 코드 착수 승인 (manifest 스크립트 + 대조 테스트 — L3, formula-engine 읽기전용 참조)
[ ] PITR 채택/조정: 정규화 ____(B 권고·C 채택 시 G-WS3c-6 재정의) / version_year ____ / 미적재컬럼 ____ / 실행면 ____
[ ] 정규화 모듈 경로 — (i) shared 승격 / (ii) 복제(권고) / (iii) quality→parser 의존 (반론 2)
[ ] ★89건 display-only 분류 결정 — (a) 영구 전시(검증 부재 명문화) / (b) engine 승격 로드맵 신설
[ ] F-55 TODO 주석 처분 — (a) constraint 타입 확장 구현 / (b) 주석 제거+이슈 등재 / (c) 현행 유지 사유 명문
[ ] supersededBy/ConstantsProvider 단일진실원화 = 2027 R-BATCH 이월 확인 (본 plan 범위 밖)
[ ] MASTER_PLAN "소비자 batch QG 단 1곳" 표현 §1.4 3분해로 정밀화 여부
```

- **코드 착수 = 위 체크 + 진산 "진행" 후**(L3, 자율 금지). plan 작성·실측은 자율 완료분.
- 각 단계 완료 = 해당 Binary Gate + 4-Pass(코드정합) + 리포트 출력 확인 후 "완료" 선언.
