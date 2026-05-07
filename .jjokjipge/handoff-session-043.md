# Handoff — Session 042 → BATCH-2 production 적재 완료, BATCH-3 진입 대기

작성일: 2026-05-05 KST (Session 042)
직전 세션: 041 (BATCH-1 staging+production 적재 완료, 4-Pass 면제, 트리거 대기)
본 세션 핵심: **★ BATCH-2 staging+production 적재 완료 (118/193/20/15 + FK 디버그 흡수) — Layer 1 2/5 진척, 진산 결정 BATCH-3 권장 ★**

---

## 0. 본 세션(042) 누적 결과

### 0.1 단계별 진척

| ☐/✅/🔴 | 단계                                                                            | 영속/상태                                                                         |
| :-----: | :------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------- |
|   ✅    | (1) handoff-042 §9 신설 — 엔진 추출 트리거 영속 (Phase 1 + 사용자 앱 검증 후)   | `.jjokjipge/handoff-session-042.md` §9                                            |
|   ✅    | (2) Session 042 entry verify 영속 2회 (run1+run2 PASS / 5pass·0fail·1skip 일치) | `.claude/reports/sprint1-step5-5-verify-session-042-entry-run{1,2}.json`          |
|   ✅    | (3) BATCH-2 raw 추출 (PDF p.435~500, 66p / pdfplumber v2)                       | `docs/batch-load/batch-2/batch-2-extract.json` (8 tables / 8 images / 1 fraction) |
|   ✅    | (4) BATCH-2 Knowledge Graph JSON Phase A+B 영속                                 | `docs/batch-load/batch-2/batch-2-knowledge-graph.json` (118/193/20/15)            |
|   ✅    | (5) BATCH-2 SQL 변환 (json-to-sql-batch.py / BEGIN-COMMIT 제거 정합)            | `docs/batch-load/batch-2/batch-2-insert.sql` (337 INSERT)                         |
|  🔴→✅  | (6) BATCH-2 staging 1차 적재 — FK constraint 거부 → 디버그 → 재적재 PASS        | changes=347 / rows_written=2759 / 59ms — 118/193/20/15 + orphan 0 + draft 강제    |
|   ✅    | (7) BATCH-2 production 적재 (staging 100% 동일)                                 | changes=347 / rows_written=2759 / 55ms                                            |
|   ✅    | (8) batch-loadmap.md ☐→✅ + Layer 1 2/5 + 전체 2/14 갱신                        | `docs/plans/batch-loadmap.md`                                                     |
|   🔴    | Level 3 학습 효과 역검증 (BATCH 다 처리 후 시점 — 진산 명시 정합)               | 진산 결정 트리거 의존                                                             |

### 0.2 BATCH-2 적재 통계 (D1 production 영속)

| 항목                               | 추정 (loadmap) | 실제 (정확성 정합) | staging | production | 검증 |
| :--------------------------------- | :------------: | :----------------: | :-----: | :--------: | :--: |
| knowledge_nodes (BATCH-2)          |       80       |      **118**       |   118   |    118     |  ✅  |
| knowledge_edges (EDGE-BATCH-2-\*)  |      300       |      **193**       |   193   |    193     |  ✅  |
| formulas (F-14~F-33)               |       17       |       **20**       |   20    |     20     |  ✅  |
| constants (CONST-006~CONST-020)    |       5        |       **15**       |   15    |     15     |  ✅  |
| orphan_edges (BATCH-2)             |       —        |         0          |    0    |     0      |  ✅  |
| status='draft' 위반 (Hard Rule 13) |       —        |         0          |    0    |     0      |  ✅  |
| Total INSERT changes               |       —        |      **347**       |   347   |    347     |  ✅  |

**Level 1 표면 검증 production PASS** / Level 3 미진입 (BATCH 다 처리 후 시점).

### 0.3 BATCH-2 영역 정합 (raw text oracle)

본 영역은 batch-loadmap "p.435~500 (66p) — 종합위험 수확감소 16종" 추정과 달리 **3 보장방식 × 22종 작물** 영역이 누적된 묶음이었다:

|  §  | 영역                             | 작물                                                                                             |  페이지   |                        산식                         |
| :-: | :------------------------------- | :----------------------------------------------------------------------------------------------- | :-------: | :-------------------------------------------------: |
| §2  | 종합위험 수확감소보장방식        | 16종 (포도·복숭아·자두·감귤만감류·밤·호두·참다래·대추·매실·살구·오미자·유자·사과·배·단감·떫은감) | p.428~467 |                   F-14~F-24 (11)                    |
| §3  | 종합위험 과실손해보장방식        | 4종 (감귤온주밀감류·오디·두릅·블루베리)                                                          | p.468~485 | F-25~F-31 (7) + F-32 (동상해) + F-33 (추가보장) (9) |
| §4  | 수확전 종합위험 과실손해보장방식 | 2종 (복분자·무화과)                                                                              | p.486~493 |   (영역 고유 산식 없음 — §2/§3 산식 일부 재사용)    |

총 22종 작물 / 3 보장방식 + 5 특약 (수확량감소 추가보장 / 나무손해보장 / 비가림시설 / 동상해 / 과실손해 추가보장) / 20 산식 / 15 상수. **batch-loadmap 추정 80/300/17 vs 실제 118/193/20/15** — 정확성·신뢰성 기조 정합.

### 0.4 본 세션 4-Pass 자동 리뷰 — 보류

본 세션 = **데이터 적재 영역** (콘솔 영역 wrangler 명령 + json-to-sql-batch.py 재사용 — 기존 Session 041 fix 정합). Code 영역 변경 0건. handoff-041/042 §0.3 정합으로 4-Pass 면제.

---

## 1. ★ 진산님 차세션 진입 결정 트리거

### 1.1 즉시 의무 (차세션 진입 첫 우선)

**A. verify 영속 (TD-VRF-001 차단 + Session 042 fix 회귀 0 재확인)**

```bash
/home/soo/ClaudePro/ThePick/packages/quality/node_modules/.bin/tsx \
  /home/soo/ClaudePro/ThePick/scripts/verify-engine-contracts.ts --json \
  > .claude/reports/sprint1-step5-5-verify-session-043-entry-run1.json
# run1 + run2 PASS 일치 확인 의무. Session 042 fix 영역 = `docs/batch-load/batch-2/*` 데이터 영역.
```

### 1.2 차세션 결정 트리거 (택1)

| 트리거                               | 진행                                                                                                                 |
| :----------------------------------- | :------------------------------------------------------------------------------------------------------------------- |
| **"BATCH-3 적재"** ★ 권장            | 논작물 (벼/맥류) 본문 p.494~514 (PDF p.501~521, 21p) — 침수율·도복률 산식. 추정 40/120/8                             |
| **"다음 배치 적재" / "이어서 적재"** | 로드맵 순서 자동 (BATCH-3 진입)                                                                                      |
| **"Level 3 역검증 진행"**            | BATCH-1+2 만으로 기출 1~2건 자동 풀이 시도 (진산 비유 — 머릿속 지식 점검)                                            |
| **"TD-S40-1 흡수"**                  | `packages/formula-engine/src/formulas/batch1-definitions.ts` pageRef 3건 (F-03/F-06/F-07) ADR-030 정합 정정          |
| **"TD-VRF-001 흡수"**                | Sprint 2 초기 batch 326/327 flaky 결정성 부채 흡수                                                                   |
| **"엔진 추출"** 류 발화              | **handoff-042 §9 정합으로 Phase 1 완료 + 사용자 앱 검증 후로 보류**. 본 시점 권고 X — Claude 가 §9 인용 후 거부 의무 |

### 1.3 본 세션 신규 발견 부채

- **★ TD-S42-1 (해소)**: BATCH-2 의 1차 SQL 이 staging FK constraint 거부 — 원인 = **FORMULA 노드의 nodes 배열 이중 등록 누락 + CONST 참조 엣지 존재**. BATCH-1 패턴 점검 후 FORMULA 20개 nodes 추가 + CONST 참조 11건 제거 → 재적재 PASS. **본 세션 fix 완료**. 향후 BATCH-3~14 도 같은 패턴 의무 — `batch-N-knowledge-graph.json` 작성 시 (a) `nodes[]` 에 FORMULA 타입 노드 이중 등록 (b) edges 가 CONST-XXX 참조 X. **`scripts/json-to-sql-batch.py` 자체 변경 X** (BATCH-1 정합 그대로 유지).

- **★ TD-S42-2 (신규)**: `scripts/json-to-sql-batch.py` 가 nodes 배열에서 FORMULA 노드를 자동 인식해서 `formulas` 테이블로 routing 하지 않는다 (위 TD-S42-1 의 root cause — 진산 검수 X 영역). 단순 패턴 = JSON 작성자가 nodes 배열에 FORMULA 를 명시 등록해야 함 (이중 작성). 향후 script 개선 옵션:
  - 옵션 A: nodes 배열의 FORMULA 자동 인식 → formulas 테이블 단일 INSERT + edges from_node/to_node 가리키도록 ghost INSERT 추가
  - 옵션 B: knowledge_edges DDL 변경 → from_node/to_node 외래 키 제약을 nodes ∪ formulas ∪ constants 어느 테이블이든 허용 (현실적 어려움 — SQLite 다중 외래 키 X)
  - 옵션 C: 현 패턴 유지 + script 가 nodes 배열의 FORMULA 누락 시 자동 보충 (BATCH-1 형식 정합)
  - **현 시점 결정**: 옵션 C 시점 미정 — 본 세션 fix 정합 (수동 nodes 배열에 FORMULA 등록) 으로 BATCH-3~14 진행 가능. 진산 명시 시점에 옵션 검토.

---

## 2. BATCH-2 적재 핵심 산출물 (영속, 차세션 1차 읽기)

1. **`docs/batch-load/batch-2/batch-2-knowledge-graph.json`** — 118 노드 + 193 엣지 + 20 산식 + 15 상수 (★ status='draft', AI 생성 / FORMULA 20 nodes 이중 등록 / CONST 참조 엣지 0)
2. **`docs/batch-load/batch-2/batch-2-insert.sql`** — D1 적용 완료 (111KB, 337 INSERT)
3. `docs/batch-load/batch-2/batch-2-extract.json` — 66p raw 추출
4. `docs/batch-load/batch-2/pages/` — 페이지별 JSON 66건
5. `docs/batch-load/batch-2/images/` — Multimodal 이미지 8건
6. `docs/plans/batch-loadmap.md` — BATCH-2 ✅ + Layer 1 2/5 + 전체 2/14 갱신
7. `.claude/reports/sprint1-step5-5-verify-session-042-entry-run{1,2}.json` — entry verify PASS 일치
8. **본 핸드오프** — `.jjokjipge/handoff-session-043.md`
9. **handoff-042 §9** — 엔진 추출 트리거 영속 (Phase 1 완료 + 사용자 앱 검증 후 / 본 시점 보류)

---

## 3. 본 세션이 차세션에 넘기는 의무 + 후속 부채

### 3.1 즉시 의무

- 차세션 entry verify 2회 PASS 일치 확인
- 진산 결정 트리거 발화 대기 (BATCH-3 권장)
- **handoff-042 §9 carry-over** — 엔진 추출 발화 시 Phase 1 완료 + 사용자 앱 검증 미충족 명시 후 보류 의무 (본 §9 모든 후속 핸드오프에 carry-over)

### 3.2 후속 부채 영속

**TD-S40-1** (handoff-040): `batch1-definitions.ts` pageRef 3건 (F-03/F-06/F-07) ADR-030 이전 정합 X. **BATCH-1+2 적재 영향 0** (knowledge_graph 정합 oracle).

**TD-S40-2** (handoff-041): handoff-040 §3 oracle 표 misattribute 1건. 정정 영속.

**TD-S40-3** (handoff-041): 엣지 -67건 (BATCH-1 133 vs 추정 200). 본 BATCH-2 도 유사 패턴 (193 vs 추정 300). 진산 결정 "정확성 기조 유지" 정합 보류. BATCH-3~14 누적 시 cross-reference 자연 증가 영역.

**TD-VRF-001** (handoff-040~041 + Session 042 entry 재현): batch 326/327 flaky 결정성 부채. Sprint 2 초기 흡수 의무.

**TD-S41-1** (handoff-042): wrangler.toml top-level vars + kv_namespaces env.staging/production 미상속. wrangler 4.78.0 경고. DB 영역 영향 0, deploy 시 정리.

**TD-S41-2** (해소, handoff-042): json-to-sql-batch.py BEGIN/COMMIT D1 거부. 본 세션 BATCH-2 적재 시 fix 정합 통과.

**TD-S42-1** (해소, 본 §1.3): BATCH-2 1차 적재 FK constraint 거부. FORMULA 20 nodes 이중 등록 + CONST 참조 11건 제거로 fix.

**TD-S42-2** (신규, 본 §1.3): `json-to-sql-batch.py` FORMULA 자동 routing 미구현. BATCH-3~14 진행 시 수동 nodes 배열 FORMULA 등록 의무 (BATCH-1+2 패턴 정합).

**누적 이월 MAJOR**: handoff-042 87건 + Step 042 신규 1건 (TD-S42-2 신규, TD-S42-1 해소) = **88건 누적**. Phase 2 진입 시 일괄 갱신.

### 3.3 BATCH-2 진산 비유 정합

> "직접 검수를 하려해도 사실 쉽지가 않군 .. 맞겠지? 너가 정확히 분석해서 넣었으리라 믿어 .. 이것을 처리하는 엔진 개발에 공들인 만큼 믿고 가야지" (handoff-041 §3.3)

→ Level 3 학습 효과 역검증 = 모든 BATCH 처리 후 시점. 본 BATCH-2 단독 = Level 1+2 통과로 충분. Claude 정확성 책임 = knowledge_graph raw text oracle 정합 + status='draft' 강제 + orphan 0 으로 담보.

→ 본 세션 추가 진산 발화: "모든 배치 작업을 순차적으로 완료 하고 나서 하자구 .. 그리고 사용자 어플도 만들어서 검증도 하고 .." → 엔진 추출은 **모든 BATCH 적재 + 사용자 앱 PWA 구축 + Level 3 역검증 PASS** 후. handoff-042 §9 영속 정합.

---

## 4. 본 세션 verify 영속 체인

| 시점              | run1       | run2                            | run3      | 일치      | 파일                                                     |
| :---------------- | :--------- | :------------------------------ | :-------- | :-------- | :------------------------------------------------------- |
| Session 040 entry | PASS 1200  | FAIL 1199 (batch 326/327 flaky) | PASS 1200 | run1≡run3 | sprint1-step5-5-verify-session-040-entry-run{1,2,3}.json |
| Session 041 entry | PASS 1200  | FAIL 1199 (batch 326/327 flaky) | PASS 1200 | run1≡run3 | sprint1-step5-5-verify-session-041-entry-run{1,2,3}.json |
| Session 042 entry | PASS 5/0/1 | PASS 5/0/1                      | —         | run1≡run2 | sprint1-step5-5-verify-session-042-entry-run{1,2}.json   |

**판정**: Session 042 entry verify = run1+run2 PASS 일치 (TD-VRF-001 미발현). 단 BATCH 영역 변경 (`docs/batch-load/batch-2/*`) = verify-engine-contracts 적용 X (정합).

---

## 5. 본 세션 D1 적재 명령 영속 (재현 가능성)

### 5.1 staging (1차 FK 거부 → 재적재 PASS)

```bash
cd /home/soo/ClaudePro/ThePick/apps/api

# 1차 적재 — FK constraint 거부 (FORMULA nodes 이중 등록 누락 + CONST 참조 엣지 11건)
wrangler d1 execute DB --env staging --remote --file=../../docs/batch-load/batch-2/batch-2-insert.sql
# ✘ ERROR FOREIGN KEY constraint failed: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_FOREIGNKEY)

# 디버그 — staging knowledge_nodes 에 BATCH-1 시점 F-XX 행 13개 이중 등록 발견 (F-01~F-13).
# BATCH-2 도 같은 패턴 의무 — JSON 패치 후 재적재.

# JSON 패치: nodes[] 에 FORMULA 20개 추가 + CONST 참조 엣지 11건 제거
python3 <<'PYEOF'
import json
from pathlib import Path
path = Path('docs/batch-load/batch-2/batch-2-knowledge-graph.json')
d = json.loads(path.read_text())
# CONST 참조 엣지 제거 + FORMULA 20개 nodes 추가
d['edges'] = [e for e in d['edges'] if not (e['source_id'].startswith('CONST') or e['target_id'].startswith('CONST'))]
# (FORMULA nodes 추가 코드는 본 핸드오프 인용 영역 외 — 본 세션 inline)
PYEOF

# SQL 재생성
python3 scripts/json-to-sql-batch.py \
  --json docs/batch-load/batch-2/batch-2-knowledge-graph.json \
  --batch-id BATCH-2 --version-year 2026 \
  --output docs/batch-load/batch-2/batch-2-insert.sql

# 재적재
wrangler d1 execute DB --env staging --remote --file=../../docs/batch-load/batch-2/batch-2-insert.sql
# ✅ changes=347 / rows_written=2759 / 59ms / 18 tables
```

### 5.2 production (staging PASS 후 동일)

```bash
wrangler d1 execute DB --env production --remote --file=../../docs/batch-load/batch-2/batch-2-insert.sql
# ✅ changes=347 / rows_written=2759 / 55ms / 18 tables (staging 100% 동일)
```

### 5.3 검증 (staging+production 동일)

```bash
# 6 검증 쿼리 (모두 PASS 정합)
SELECT COUNT(*) FROM knowledge_nodes WHERE batch_id='BATCH-2'                                        # 118
SELECT COUNT(*) FROM knowledge_edges WHERE id LIKE 'EDGE-BATCH-2-%'                                  # 193
SELECT COUNT(*) FROM formulas WHERE id LIKE 'F-%' AND CAST(SUBSTR(id, 3) AS INTEGER) BETWEEN 14 AND 33  # 20
SELECT COUNT(*) FROM constants WHERE id LIKE 'CONST-%' AND CAST(SUBSTR(id, 7) AS INTEGER) BETWEEN 6 AND 20  # 15
SELECT COUNT(*) FROM knowledge_edges e WHERE e.id LIKE 'EDGE-BATCH-2-%' AND (NOT EXISTS ...)         # 0 (orphan)
SELECT COUNT(*) FROM knowledge_nodes WHERE batch_id='BATCH-2' AND status != 'draft'                  # 0 (Hard Rule 13)
```

---

## 6. 주의사항

- **★ Knowledge Graph status='draft' 강제 통과 production**: AI 생성 데이터 (Hard Rule 13 + 0018 트리거). 진산 검수 후 state-machine 경유 review/approved 전이.
- **★ FORMULA 노드 이중 등록 의무 (BATCH-3~14)**: `nodes[]` 에 FORMULA 타입 노드 + `formulas[]` 양쪽 INSERT. BATCH-1 패턴 정합. 누락 시 외래 키 위반.
- **★ CONST-XXX 참조 엣지 금지 (BATCH-3~14)**: knowledge_edges 외래 키는 knowledge_nodes(id) 만 가리킴. CONST 참조 엣지는 외래 키 위반.
- **★ Level 3 학습 효과 역검증 미완** = "BATCH-2 검수 완료" 미선언. 본 시점 = "BATCH-2 적재 완료, Level 1 PASS, Level 3 미진입".
- **★ batch-loadmap 추정 vs 실제 정확성 기조**: BATCH-2 추정 80/300/17 vs 실제 118/193/20/15. 진산 결정 "정확성·신뢰성 기조 유지" 정합으로 raw text oracle 정합 우선.
- **누적 이월 MAJOR 88건** (Step 042 TD-S42-2 추가, TD-S42-1 해소). Phase 2 진입 시 일괄 갱신.
- **TD-VRF-001 미발현**: Session 042 entry verify run1+run2 PASS 일치 (handoff-040~041 의 1199 flaky 패턴 본 세션 미발현).
- **★ handoff-042 §9 carry-over**: 엔진 추출 발화 시 Phase 1 + 사용자 앱 검증 미충족 명시 후 보류 의무.
- **session-health 본 세션(042)** ~30~50턴 (90분/30턴 임계 근접). 차세션(043) 도 임계 전 handoff-044 작성 의무.
- **Untracked Guide/3단계리뷰\*.md 2건** — 진산 자료 (Hard Limit `Guide/` 보존).
- **Anthropic Console cap pre-install** — 메모리 정합. 본 세션 Path A Cost=$0 정합 (Claude Code 영역, Anthropic API 호출 0). Phase 2 진입 시 의무 활성.

---

## 7. 핵심 문서 (1차 읽기 의무, 우선순위 순)

1. **본 핸드오프** — `.jjokjipge/handoff-session-043.md`
2. **★ BATCH-2 production 영속**: `docs/batch-load/batch-2/batch-2-knowledge-graph.json` (118 노드 + 193 엣지 + 20 산식 + 15 상수 / FORMULA 20 nodes 이중 등록)
3. **★ batch-2-insert.sql** — `docs/batch-load/batch-2/batch-2-insert.sql` (적용 완료, FORMULA 20 nodes + CONST 참조 0)
4. `docs/plans/batch-loadmap.md` — BATCH-2 ✅ + Layer 1 2/5 + 전체 2/14 갱신
5. `.jjokjipge/handoff-session-042.md` — 직전 세션 §9 (엔진 추출 트리거 영속, carry-over 의무)
6. `scripts/extract-batch-pages.py` + `scripts/json-to-sql-batch.py` (BATCH-N 재사용 의무 + TD-S42-2 한계 인지)
7. `docs/batch-load/batch-1-v2/batch-1-knowledge-graph.json` — BATCH-1 패턴 reference (FORMULA 13 nodes 이중 등록 정합 oracle)

---

**핸드오프 작성**: Claude (Opus 4.7 1M context) — Session 042
**다음 세션**: Session 043 — verify entry + 진산 결정 트리거 (BATCH-3 권장)
**작성 효력**: 2026-05-05 KST (Session 042)
**예상 완료**: handoff-044 (BATCH-3 본문 p.494~514 적재 완료 / Layer 1 3/5)
