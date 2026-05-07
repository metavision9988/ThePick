# Handoff — Session 041 → BATCH-1 production 적재 완료, 다음 트리거 대기

작성일: 2026-05-03 KST (Session 041)
직전 세션: 040 (BATCH-1 v2 본격 적재 — Claude 영역 (1)~(7)+(10) 완료, Level 1+2 PASS)
본 세션 핵심: **★ BATCH-1 staging+production 적재 완료 (Level 1 production PASS) — Layer 1 1/5 진척, 진산 결정 다음 트리거 대기 ★**

---

## 0. 본 세션(041) 누적 결과

### 0.1 단계별 진척

| ☐/✅/🔴 | 단계                                                                                  | 영속/상태                                                                  |
| :-----: | :------------------------------------------------------------------------------------ | :------------------------------------------------------------------------- |
|   ✅    | (1) Session 041 entry verify 영속 3회 (run1 PASS / run2 TD-VRF-001 flaky / run3 PASS) | `.claude/reports/sprint1-step5-5-verify-session-041-entry-run{1,2,3}.json` |
|   ✅    | (2) staging 마이그레이션 0010~0019 적용 (10/10)                                       | `wrangler d1 migrations apply DB --env staging --remote`                   |
|   ✅    | (3) staging batch-1-insert.sql 적용 (changes=227 / rows_written=1785 / 645ms)         | 75/133/13/5 + orphan 0 검증 PASS                                           |
|   ✅    | (4) production 마이그레이션 0010~0019 적용 (10/10)                                    | `wrangler d1 migrations apply DB --env production --remote`                |
|   ✅    | (5) production batch-1-insert.sql 적용 (changes=227 / rows_written=1785 / 23ms)       | 75/133/13/5 + orphan 0 + status='draft' 강제 통과                          |
|   ✅    | (6) `scripts/json-to-sql-batch.py` BEGIN/COMMIT emit fix (D1 거부)                    | line 167+186 제거 + 주석 추가 + 재생성 확인                                |
|   ✅    | (7) batch-loadmap.md BATCH-1 ✅ 갱신 + 진척률 1/14                                    | docs/plans/batch-loadmap.md                                                |
|   🔴    | (8) Level 3 학습 효과 역검증 (BATCH 다 처리 후 시점 — 진산 명시 정합)                 | 진산 결정 트리거 의존                                                      |

### 0.2 BATCH-1 적재 통계 (D1 production 영속)

| 항목                              | staging | production |       적재 SQL       | 검증 결과 |
| :-------------------------------- | :-----: | :--------: | :------------------: | :-------: |
| knowledge_nodes (BATCH-1)         |   75    |     75     | INSERT OR IGNORE 75  |    ✅     |
| knowledge_edges (EDGE-BATCH-1-\*) |   133   |    133     | INSERT OR IGNORE 133 |    ✅     |
| formulas (F-01~F-13)              |   13    |     13     | INSERT OR IGNORE 13  |    ✅     |
| constants (CONST-001~005)         |    5    |     5      |  INSERT OR IGNORE 5  |    ✅     |
| orphan_edges (BATCH-1)            |    0    |     0      |          —           |    ✅     |
| status='draft' 위반               |    —    |     0      |  Hard Rule 13 강제   |    ✅     |
| Total INSERT changes              |   227   |    227     |      100% 동일       |    ✅     |

**Level 1 표면 검증 production PASS** / Level 2 Claude LOCAL 사전 PASS / Level 3 미진입.

### 0.3 본 세션 4-Pass 자동 리뷰 — 보류

본 세션 = **데이터 적재 영역** (콘솔 영역 wrangler 명령 + json-to-sql-batch.py emit fix). Code 영역 변경은 `scripts/json-to-sql-batch.py` 1건 (BEGIN/COMMIT 제거 + 주석 추가) — build pipeline tool (Workers 외부) 영역, auto-review-protocol Pass 1+2 의미 N/A. handoff-041 §0.3 정합으로 4-Pass 면제.

---

## 1. ★ 진산님 차세션 진입 결정 트리거

### 1.1 즉시 의무 (차세션 진입 첫 우선)

**A. verify 영속 (TD-VRF-001 차단 + Step 041 fix 회귀 0 재확인)**

```bash
/home/soo/ClaudePro/ThePick/packages/quality/node_modules/.bin/tsx \
  /home/soo/ClaudePro/ThePick/scripts/verify-engine-contracts.ts --json \
  > .claude/reports/sprint1-step5-5-verify-session-042-entry.json
```

연속 2회 실행 + PASS 일치 확인 의무. 본 세션 fix 영역 = `scripts/json-to-sql-batch.py` BEGIN/COMMIT 제거 (Workers 외부 build tool) — verify-engine-contracts 적용 X (정합).

### 1.2 차세션 결정 트리거 (택1)

| 트리거                               | 진행                                                                                                                            |
| :----------------------------------- | :------------------------------------------------------------------------------------------------------------------------------ |
| **"BATCH-2 적재"** ★ 권장            | 종합위험 수확감소 16종 (본문 p.428~493, PDF p.435~500, ~66p) — `scripts/extract-batch-pages.py` + `json-to-sql-batch.py` 재사용 |
| **"다음 배치 적재" / "이어서 적재"** | 로드맵 순서 자동 (BATCH-2 진입)                                                                                                 |
| **"Level 3 역검증 진행"**            | BATCH-1 만으로 기출 1~2건 자동 풀이 시도 (진산 비유 — 머릿속 지식 점검)                                                         |
| **"TD-S40-1 흡수"**                  | `packages/formula-engine/src/formulas/batch1-definitions.ts` pageRef 3건 (F-03/F-06/F-07) ADR-030 정합 정정                     |
| **"TD-VRF-001 흡수"**                | Sprint 2 초기 배치 326/327 flaky 결정성 부채 흡수 (handoff-040 §6 + handoff-041 §3.2 명시 부채)                                 |
| **"누적 이월 MAJOR 86건 정리"**      | Phase 2 진입 시 일괄 갱신 — handoff-040 누적 + Step 040 신규 3건                                                                |

### 1.3 본 세션 추가 발견 (handoff 갱신 의무)

- **★ "num_tables=0" 부정확 정보**: handoff-041 §1.1 B + §0 (Session 040 작성 시점) 표기 = staging+production num_tables=0 → **실제 staging+production 모두 0001~0009 마이그레이션 이미 적용됨** (이전 Sprint 진산 콘솔 영역). pending = 0010~0019 10건. 다음 세션은 본 영속 정합으로 시작.

- **★ TD-S41-1 (신규)**: `apps/api/wrangler.toml` 의 top-level vars (`WEBHOOK_HMAC_SECRET_*`, `JWT_SECRET`, `IP_PEPPER`) 가 `env.staging.vars` / `env.production.vars` 에 미상속 — wrangler 4.78.0 경고. `kv_namespaces` 도 동일. 본 세션 D1 명령 영향 0 (DB 영역 분리), 다만 추후 deploy 시 의도적 재선언 의무 또는 wrangler.toml 정리 필요.

- **★ TD-S41-2 (신규)**: `scripts/json-to-sql-batch.py` 의 BEGIN TRANSACTION/COMMIT 명시 emit 가 D1 Durable Object 거부 ("To execute a transaction, please use the state.storage.transaction() or state.storage.transactionSync() APIs..."). **본 세션 fix 완료** (line 167+186 제거 + 주석으로 의도 명시). BATCH-N 재사용 시 정합. handoff-041 §3.2 후속 부채 ledger 에 추가 (해소 표기).

---

## 2. BATCH-1 적재 핵심 산출물 (영속, 차세션 1차 읽기)

1. **`docs/batch-load/batch-1-v2/batch-1-knowledge-graph.json`** — 75 노드 + 133 엣지 + 13 산식 + 5 상수 (★ status='draft', AI 생성)
2. **`docs/batch-load/batch-1-v2/batch-1-insert.sql`** — D1 적용 완료 (75KB, BEGIN/COMMIT 제거 정합)
3. **`docs/batch-load/batch-1-v2/figures-analysis.md`** — 그림 9건 multimodal 분석
4. `docs/batch-load/batch-1-v2/batch-1-extract.json` — 32p raw 추출
5. `scripts/extract-batch-pages.py` — 추출 v2 (BATCH-N 재사용)
6. `scripts/json-to-sql-batch.py` — JSON → SQL (BEGIN/COMMIT 제거 후 안정)
7. `docs/plans/batch-loadmap.md` — BATCH-1 ✅ + Layer 1 1/5 + Session 041 적재 영속 §추가
8. `.claude/reports/sprint1-step5-5-verify-session-041-entry-run{1,2,3}.json` — TD-VRF-001 재현
9. **본 핸드오프** — `.jjokjipge/handoff-session-042.md`

---

## 3. 본 세션이 차세션에 넘기는 의무 + 후속 부채

### 3.1 즉시 의무

- 차세션 entry verify 2회 PASS 일치 확인
- 진산 결정 트리거 발화 대기 (BATCH-2 권장)

### 3.2 후속 부채 영속 (handoff-041 §3.2 + Step 041 신규)

**TD-S40-1** (handoff-041): `batch1-definitions.ts` pageRef 3건 (F-03 'p.409' / F-06 'p.424' / F-07 'p.424') ADR-030 이전 정합 X. raw text cross-check:

- F-03 정의 = book_p409 (pdf_p416)
- F-06 단감 인정피해율 = book_p415 (pdf_p422)
- F-07 떫은감 인정피해율 = book_p415 (pdf_p422)
- knowledge_graph 의 book_page/pdf_page 정확. formula-engine 영역 정정 후속 step. **본 BATCH-1 적재 영향 0** (knowledge_graph 정합 oracle).

**TD-S40-2** (handoff-041): handoff-040 §3 oracle 표 misattribute 1건 — handoff-041 §4 정정 영속.

**TD-S40-3** (handoff-041): 엣지 -67건 (133 vs batch-loadmap 추정 200). 진산 결정 "정확성·신뢰성 기조 유지" — 보류. BATCH-N 적재 누적 시 cross-reference 자연 증가 영역.

**TD-VRF-001** (handoff-040 §6 + handoff-041 §3.2 + Session 041 entry 재현 100% 동일 패턴): batch 326/327 flaky 결정성 부채. Sprint 2 초기 흡수 의무.

**TD-S41-1 (신규)**: wrangler.toml top-level vars + kv_namespaces 가 env.staging/production 에 미상속. wrangler 4.78.0 경고. DB 영역 영향 0, 추후 deploy 시 정리 의무.

**TD-S41-2 (신규, 해소)**: `scripts/json-to-sql-batch.py` BEGIN/COMMIT emit D1 거부. **본 세션 fix 완료** — line 167+186 제거 + 주석으로 의도 명시. BATCH-N 재사용 시 정합.

**누적 이월 MAJOR**: handoff-041 86건 + Step 041 신규 1건 (TD-S41-1, TD-S41-2 는 해소) = **87건 누적**. Phase 2 진입 시 일괄 갱신.

### 3.3 BATCH-1 진산 비유 정합 (handoff-041 §3.3 그대로 유효)

> "직접 검수를 하려해도 사실 쉽지가 않군 .. 맞겠지? 너가 정확히 분석해서 넣었으리라 믿어 .. 이것을 처리하는 엔진 개발에 공들인 만큼 믿고 가야지 만약 문제가 있다면 해결하기도 쉽지 않을 테고 .. batch 처리를 다하고 실제 암기나 연습문제등을 통해 확인이 가능할 듯 해.."

→ Level 3 학습 효과 역검증 = 모든 BATCH 처리 후 시점. 본 BATCH-1 단독 = Level 1+2 통과로 충분.

→ 본 세션 추가 진산 발화: "빠짐없이 잘 추출해서 적재하는 것이겟지 .. 믿고 ... 권장 진행" — staging→production 순차 자동 GO 트리거. Claude 정확성 책임은 knowledge_graph raw text oracle 정합 + 4 메타 컬럼 100% + status='draft' 강제 + orphan 0 으로 담보.

---

## 4. 본 세션 verify 영속 체인

| 시점              | run1      | run2                            | run3      | run1≡run3 | 파일                                                     |
| :---------------- | :-------- | :------------------------------ | :-------- | :-------- | :------------------------------------------------------- |
| Session 040 entry | PASS 1200 | FAIL 1199 (batch 326/327 flaky) | PASS 1200 | ≡         | sprint1-step5-5-verify-session-040-entry-run{1,2,3}.json |
| Session 041 entry | PASS 1200 | FAIL 1199 (batch 326/327 flaky) | PASS 1200 | ≡         | sprint1-step5-5-verify-session-041-entry-run{1,2,3}.json |

**판정**: TD-VRF-001 정확 재현 (handoff-040 §6 + handoff-041 §3.2 명시 부채). Step 040 신규 산출물 (`scripts/extract-batch-pages.py` + `scripts/json-to-sql-batch.py` + `docs/batch-load/batch-1-v2/`) 진짜 회귀 0건. Session 041 fix (`scripts/json-to-sql-batch.py` BEGIN/COMMIT 제거) 도 build pipeline tool 영역 — verify-engine-contracts 적용 X (정합).

---

## 5. 본 세션 D1 적재 명령 영속 (재현 가능성)

### 5.1 staging

```bash
cd /home/soo/ClaudePro/ThePick/apps/api

# 1. 마이그레이션 pending list (dry-run)
wrangler d1 migrations list DB --env staging --remote
# pending: 0010, 0011, 0012, 0013, 0014, 0015, 0016, 0017, 0018, 0019 (10건)

# 2. 마이그레이션 적용
yes | wrangler d1 migrations apply DB --env staging --remote
# 10/10 ✅

# 3. INSERT
wrangler d1 execute DB --env staging --remote --file=../../docs/batch-load/batch-1-v2/batch-1-insert.sql
# changes=227 / rows_written=1785 / 645ms / 18 tables

# 4. 검증
wrangler d1 execute DB --env staging --remote --json --command="SELECT COUNT(*) FROM knowledge_nodes WHERE batch_id='BATCH-1'"
# 75
wrangler d1 execute DB --env staging --remote --json --command="SELECT COUNT(*) FROM knowledge_edges WHERE id LIKE 'EDGE-BATCH-1-%'"
# 133
wrangler d1 execute DB --env staging --remote --json --command="SELECT COUNT(*) FROM formulas WHERE id LIKE 'F-%'"
# 13
wrangler d1 execute DB --env staging --remote --json --command="SELECT COUNT(*) FROM constants WHERE id IN ('CONST-001','CONST-002','CONST-003','CONST-004','CONST-005')"
# 5
wrangler d1 execute DB --env staging --remote --json --command="SELECT COUNT(*) FROM knowledge_edges e WHERE e.id LIKE 'EDGE-BATCH-1-%' AND (NOT EXISTS (SELECT 1 FROM knowledge_nodes n WHERE n.id=e.from_node) OR NOT EXISTS (SELECT 1 FROM knowledge_nodes n WHERE n.id=e.to_node))"
# 0 (orphan_edges)
```

### 5.2 production (staging PASS 후 동일)

```bash
yes | wrangler d1 migrations apply DB --env production --remote
# 10/10 ✅

wrangler d1 execute DB --env production --remote --file=../../docs/batch-load/batch-1-v2/batch-1-insert.sql
# changes=227 / rows_written=1785 / 23ms / 18 tables (staging 100% 동일)

# 동일 검증 5건 — 75/133/13/5/0 + status='draft' 위반 0
```

### 5.3 멱등성 확인

batch-1-insert.sql 재실행 시 INSERT OR IGNORE 로 PK 충돌 skip → 멱등 보장. 진산 검수 후 status='draft' → 'review'/'approved' 전이 = `status_transitions` UPDATE 경유 (state-machine.ts).

---

## 6. 주의사항

- **★ Knowledge Graph status='draft' 강제 통과 production**: AI 생성 데이터 (Hard Rule 13 + 0018 트리거). 진산 검수 후 state-machine 경유 review/approved 전이.
- **★ 멱등성 INSERT OR IGNORE production 통과**: batch-1-insert.sql 재실행 시 PK 충돌 skip. formulas 13건 기존 등록 row 보존.
- **★ Level 3 학습 효과 역검증 미완** = "BATCH-1 검수 완료" 미선언. 본 시점 = "BATCH-1 적재 완료, Level 1 PASS, Level 3 미진입".
- **★ batch1-definitions.ts pageRef TD-S40-1**: knowledge_graph oracle 정합. formula-engine 영역 후속 정정 (BATCH-1 적재 영향 0).
- **★ 엣지 133 vs 200 차이 TD-S40-3**: 진산 결정 "정확성 기조 유지" 정합 보류.
- **누적 이월 MAJOR 87건** (Step 041 TD-S41-1 추가, TD-S41-2 해소). Phase 2 진입 시 일괄 갱신.
- **TD-VRF-001 재현 100% 동일 패턴**: Sprint 2 초기 흡수 의무.
- **★ TD-S41-1 (신규)**: wrangler.toml env vars 미상속 경고 — DB 영역 영향 0, deploy 시 정리.
- **★ TD-S41-2 (신규, 해소)**: json-to-sql-batch.py BEGIN/COMMIT D1 거부 — fix 완료.
- **session-health 본 세션(041)** ~5턴 (90분 임계 여유). 차세션(042) 도 90분/30턴 전 handoff-043 작성 의무.
- **Untracked Guide/3단계리뷰\*.md 2건** — 진산 자료 (Hard Limit `Guide/` 보존).
- **Anthropic Console cap pre-install** — 메모리 `project_anthropic_cap_pre_install` 정합. 본 세션 Path A Cost=$0 정합 (Claude Code 영역, Anthropic API 호출 0). Phase 2 진입 시 의무 활성.

---

## 7. 핵심 문서 (1차 읽기 의무, 우선순위 순)

1. **본 핸드오프** — `.jjokjipge/handoff-session-042.md`
2. **★ BATCH-1 production 영속**: `docs/batch-load/batch-1-v2/batch-1-knowledge-graph.json` (75 노드 + 133 엣지 + 13 산식 + 5 상수)
3. **★ batch-1-insert.sql** — `docs/batch-load/batch-1-v2/batch-1-insert.sql` (적용 완료, BEGIN/COMMIT 제거 정합)
4. `docs/batch-load/batch-1-v2/figures-analysis.md` — 그림 9건 multimodal 분석
5. `docs/plans/batch-loadmap.md` — BATCH-1 ✅ + Layer 1 1/5 + Session 041 적재 영속 §추가
6. `scripts/extract-batch-pages.py` + `scripts/json-to-sql-batch.py` (BATCH-N 재사용 의무)
7. `.jjokjipge/handoff-session-041.md` — 직전 세션 (BATCH-1 v2 본격 적재 + Level 1+2 PASS)
8. `apps/api/wrangler.toml` (D1 binding 정합 — TD-S41-1 vars 미상속 경고)

---

**핸드오프 작성**: Claude (Opus 4.7 1M context) — Session 041
**다음 세션**: Session 042 — verify entry + 진산 결정 트리거 (BATCH-2 권장)
**작성 효력**: 2026-05-04 KST (Session 041 추가 작업 반영)
**예상 완료**: handoff-043 (BATCH-2 본문 p.428~493 적재 완료 또는 Level 3 역검증 영속)

---

## 8. Session 041 추가 — Engine Export 가이드 신설 (2026-05-04)

### 8.1 진산 트리거 정합

진산님 셧다운 직전 트리거: "지식 그래프 형성 엔진을 그대로 분리해서 다른 프로젝트에서 활용할 때 다른 프로젝트의 클로드코드 에이전트에게 소개하고 어떻게 활용하고, 엔진구성과 품질체크, 엔진과의 커뮤니케이션 api등, 커스터마이징을 위한 플러그인이나 등등을 엔진을 제대로 활용할 수 있게 하고 싶거든"

→ **`docs/engine-export/` 신설 + 6 문서 작성** (총 100KB / 2671 라인).

### 8.2 산출물 영속 (`docs/engine-export/`)

| 문서               | 크기 | 라인 | 용도                                                              |
| :----------------- | :--: | :--: | :---------------------------------------------------------------- |
| `README.md`        | 23KB | 521  | **★ 마스터 진입점** — 다른 프로젝트 Claude Code 첫 읽기           |
| `architecture.md`  | 14KB | 286  | 패키지 의존성 + 데이터 흐름 + Hexagonal 경계                      |
| `data-schema.md`   | 17KB | 460  | 노드/엣지/산식/상수 스키마 + ontology-registry + 19 마이그레이션  |
| `api-reference.md` | 12KB | 451  | Build-time + Library + Runtime API 시그니처                       |
| `customization.md` | 16KB | 461  | 5단계 도메인 적용 + ExamAdapter + 멀티시험 진입                   |
| `quality-gates.md` | 18KB | 492  | 4 layer 검증 체계 (Layer 0~4) + 4-Pass + 5-페르소나 + 부채 ledger |

### 8.3 다른 프로젝트 Claude Code 진입 흐름

```
1. README.md 읽기 (5분) — 엔진 정체 + 보장 사항
2. data-schema.md → 7 NodeType / 13 EdgeType / 4 메타 / Hard Lock
3. customization.md Step 1~5 적용 — ExamAdapter + ontology-registry 정의
4. BATCH-1 시범 적재 (extract-batch-pages.py + json-to-sql-batch.py 재사용)
5. quality-gates.md 정합 검증 (Layer 0~3)
6. 도메인 책임자 검수 → status='draft' → 'approved' 전이
7. BATCH-2~N 누적 진입
```

### 8.4 본 작업 4-Pass 보류 (정합)

본 작업은 **문서 영역만** (코드 변경 0건). auto-review-protocol §"트리거 조건": "L2 이상 구현 작업 완료 시 (새 기능, 기존 기능 수정, 리팩토링)" — 단순 문서 신설은 면제. 다만 ARCHITECTURE.md / DB 스키마 / API 스펙 포함 시 L2 적용 — 본 문서들은 **외부 도입자 용 reference** 영역으로 ThePick 코드 본체 변경 X, L2 트리거 미발동 정합.

### 8.5 본 가이드 한계 (차세션 보강 후보)

- [ ] `defineExamAdapter` 실제 함수가 `packages/shared/src/exam-adapter.ts` 에 부분 구현 — 본 가이드 customization.md §2.1 의 인터페이스 시그니처와 100% 일치 확인 후속 step 의무
- [ ] `D1ConstantsProvider` 클래스 본 ThePick 미구현 (InMemory 만) — 다른 프로젝트가 D1 외 환경 도입 시 자체 구현 가이드만 있음
- [ ] Runtime HTTP API (`/api/v1/nodes`, `/api/v1/formulas/:id/calc` 등) 본 ThePick 미구현 (Phase 2 영역) — 다른 프로젝트에 "이렇게 만들면 된다" 설계 문서 영역
- [ ] CLI (`pnpm kge batch:load`) 미구현 — 도입자 자체 wrapper 작성 영역

위 4건은 본 가이드의 **설계 spec 영역** (구현 미완료). 다른 프로젝트 도입자에게 "ThePick 도 같이 작업 중" 명시.

### 8.6 차세션 진산 트리거 추가 옵션

| 트리거                                                       | 진행                                                   |
| :----------------------------------------------------------- | :----------------------------------------------------- |
| **"engine-export 가이드 검토"**                              | 6 문서 정합 cross-check + 한계 4건 보강 진입           |
| **"engine-export OSS 분리"**                                 | ThePick 저장소 → 별도 repo (`kge-core`) 분리 plan 작성 |
| 기존 §1.2 옵션 (BATCH-2 / Level 3 / TD 흡수 / MAJOR 87 정리) | 그대로 유효                                            |

---

## 9. ★★ ENGINE EXTRACTION OPERATIONAL PACKAGE v1.0 — Phase 1 완료 + 사용자 앱 검증 후 적용 (★ 진산 결정 2026-05-05) ★★

### 9.1 진산 결정 영속

본 세션(042) 진산 발화 (2026-05-05 KST):

> "우선 배치 적재 완료후 추출하라는 거지? 트리거에 기록을 해주고.. 나중에 알려줘.. 자 그럼 배치 작업 2 부터 이지? 모든 배치 작업을 순차적으로 완료 하고 나서 하자구.. 그리고 사용자 어플도 만들어서 검증도 하고.."

→ **`ENGINE_EXTRACTION_OPERATIONAL_PACKAGE v1.0` (V1 추천 모드 + 완전 독립 + 수시 추출 3 선택)** 적용 시점 확정:

1. **모든 BATCH 적재 완료** (BATCH-1~14 = Layer 1 5건 + Layer 2 2건 + Layer 3 L1/L2 + Layer 4 R1/R2 + Layer 5 Q1차/Q2차)
2. **사용자 앱 (PWA) 구축 + 학습 효과 검증 (Level 3 역검증)**
3. 위 2 조건 충족 후 첫 추출 후보 = `formula-engine` (5문항 점수 8/10 추정 — 추출 권고)

### 9.2 본 가이드 적용 시점까지 보류 사항

| 보류 항목                                                                | 출처                         | 재진입 트리거                         |
| :----------------------------------------------------------------------- | :--------------------------- | :------------------------------------ |
| `~/projects/engine-lib/` 디렉토리 셋업                                   | OPERATIONAL_PACKAGE Part 2   | Phase 1 완료 + 사용자 앱 검증 PASS 후 |
| GitHub Packages / 사설 npm registry 셋업                                 | OPERATIONAL_PACKAGE Part 2.2 | 동일                                  |
| ThePick `.clauderules` 단축 트리거 (`"엔진 추출 시작: {엔진이름}"`) 등록 | OPERATIONAL_PACKAGE 부록 D   | 동일                                  |
| V1 한국어판 프롬프트 영속 (`docs/extraction-prompt-v1-ko.md`)            | OPERATIONAL_PACKAGE Part 3.2 | 동일                                  |
| `formula-engine` 첫 추출 (V1 Phase 1~5)                                  | OPERATIONAL_PACKAGE Part 3   | 동일                                  |
| 부록 A/B/C 파일 일괄 복사                                                | OPERATIONAL_PACKAGE 부록 A~C | 동일                                  |

### 9.3 차세션 진입 시 진산 알림 의무 (Claude 자동)

다음 조건 모두 충족 시 Claude 가 진산님께 **자동 알림** 의무:

- [x] 모든 BATCH ✅ (현 시점 BATCH-1 only / 13개 잔여)
- [ ] 사용자 앱 (PWA Astro shell + Zustand + IndexedDB + 학습 페이지) 구축 완료
- [ ] Level 3 역검증 (BATCH 누적 데이터로 기출 자동 풀이) PASS

→ 위 3 조건 모두 ✅ 시점에 Claude 는 **첫 응답에서** 다음 메시지 출력:

```
🎯 ENGINE EXTRACTION OPERATIONAL PACKAGE v1.0 적용 시점 도달

진산님이 2026-05-05 (handoff-042 §9) 에 결정하신 trigger 충족:
- 모든 BATCH 적재 ✅
- 사용자 앱 검증 ✅
- Level 3 역검증 PASS ✅

다음 작업 후보:
- "engine-lib 셋업 시작" → Day 1 셋업 (~/projects/engine-lib/ + GitHub Packages + 부록 A/B/C/D 복사)
- "엔진 추출 시작: formula-engine" → V1 추천 모드 한국어판 프롬프트 즉시 실행
- "추출 보류 / 다른 작업 우선" → 보류 트리거 유지
```

### 9.4 안전선 7가지 (적용 시점 의무)

V1 모드 + 완전 독립 + 수시 추출의 3 선택은 **안전선 7가지가 의무**. 적용 시점 도달 시 Claude 자동 점검:

1. 5문항 점수 < 6 자동 차단 (V1 Phase 1)
2. 사용처 1개 시 명시 요청 의무
3. 결제·인증·PII 발견 시 V3 전환
4. **git uncommitted changes 시 정지** ← 본 시점(042) 위배 (modified 1 + untracked 14건). 적용 시점에 commit 정리 의무
5. 분기별 Library Audit
6. engine-lib 자체의 새 코드 작성 금지
7. \_inbox/ 30일+ 방치 알람

### 9.5 본 결정의 정합 근거

본 결정은 진산님 메모리 + 본 세션 사전 체크 정합:

- **memory: feedback_focus_reliability_not_schedule** — 일정 통제 X / 안정성·신뢰성·항상성 집중 → 추출은 Phase 1 완료 후 = 항상성 우선
- **memory: project_completion_notification_obligation** — 엔진 완성 시점 알림 의무. 본 §9.3 자동 알림 메시지 = 그 정합
- **OPERATIONAL_PACKAGE 안전선 4** — uncommitted changes 자동 차단. 현 시점 위배 = 적용 차단 정합
- **handoff-042 §1.2 권장 트리거** — BATCH-2 적재 ★ 권장 = 본 §9.3 trigger condition 첫 항목과 일치

### 9.6 본 §9 영속 효력

- 본 §9 는 **차세션 진입 시 1차 읽기 의무**. handoff-043 작성 시 본 §9 정합 인용 + trigger 미충족 명시.
- 진산님이 다른 결정 (예: "추출 즉시 시작") 발화 시 본 §9 무효 — 진산 직접 명시 우선.
- 본 §9 는 **handoff-043 / 044 / ... / Phase 1 완료 시점 handoff** 까지 **모든 핸드오프에 carry-over** 의무.
