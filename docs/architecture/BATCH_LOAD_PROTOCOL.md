# BATCH Load Protocol — 적재 절차 정식 명세 (v2.1)

> Content Build Engine 의 적재 절차. Claude Code 자동 진행 워크플로우 + 검수 체크리스트.
> v1 (8단계) → **v2.0 (10단계, CBIV 통합)** → v2.1 (D1 Preview).
> 상위: [`CONTENT_BUILD_ENGINE.md`](./CONTENT_BUILD_ENGINE.md)
> 메모리: `project_batch_load_workflow.md`

---

## 1. 진산님 트리거 키워드

| 키워드                                   | 동작                 |
| :--------------------------------------- | :------------------- |
| `"BATCH-N 적재"` / `"BATCH N 적재"`      | 특정 BATCH 진행      |
| `"다음 배치 적재"` / `"다음 BATCH 적재"` | 로드맵 다음 ☐ 자동   |
| `"계속 적재"` / `"이어서 적재"`          | 직전 핸드오프 이어서 |

---

## 2. Claude Code 자동 진행 절차 — 10단계 (v2.0, CBIV 통합)

### Stage 1: 다음 ☐ BATCH 식별

- `docs/plans/batch-loadmap.md` 읽기 → 다음 ☐ + 입력 자료 결정

### Stage 2: PDF 추출

- `packages/parser/scripts/extract_pdf.py` Python subprocess
- 결과 → `/tmp/batch-N-extract.json`

### Stage 3: 도메인 분석 (Opus 4.7 직접)

- 추출 본문 + 표 → Knowledge Graph JSON
- Ontology Lock 자체 준수 ([`ONTOLOGY.md`](./ONTOLOGY.md))
- 모든 노드 `page_ref` 필수

### Stage 4: Level 1 (표면) 검증

- Ontology Lock ID 형식
- schema-validator JSON 통과
- graph-integrity (고아 / 끊긴 / 순환 0건)

### Stage 5: Level 2 (내용) 검증

- qg2-validator Golden Test 100%
- page_ref 무작위 5건 실제 교재 대조
- 26년 개정 SUPERSEDES 적용 (필요 시)

### Stage 6: Level 3 (학습 효과) 역검증

- 본 BATCH 영역 기출 1~2건 자동 풀이
- 적재 노드/산식만으로 정답 도출 → 일치율 100%

### **Stage 6.5: CBIV 6단계 자동 검증 (v2.0 신설)**

[`CBIV.md`](./CBIV.md) 참조. 30초 이내:

1. 참조 무결성 (외래키 + exam_id) → 실패 시 즉시 차단
2. 의미 중복 (**Adaptive Threshold**, v2.1) → flag → Stage 7.5 인간 결정
3. 상수 일관성 (exact-match) → 실패 시 즉시 차단
4. SUPERSEDES 체인 (DFS 순환) → 실패 시 즉시 차단
5. **회귀 Golden Test** (BATCH-1~N-1 모두 재실행, **D1 Preview Database** v2.1) → 1건 fail 시 즉시 차단
6. 출제영역 정합성 → 경고 → Stage 7 인간 결정

CBIV 통과 표시가 없으면 Stage 8 거부 (Hard Rule 20).

### Stage 7: 진산님 검수

- Level 1~3 결과 + CBIV 결과 + Stage 6 경고

### **Stage 7.5: 의미 중복 인간 결정 (v2.0 신설)**

- CBIV Stage 2 flag 항목을 [`ADMIN_REVIEW_UI.md`](./ADMIN_REVIEW_UI.md) 큐 1 에서 처리
- Merge / Reject / Keep Both 결정 (One-click + AI 추천)

### Stage 8: D1 INSERT — **PR-based 워크플로우** (R-5 정정 v2.2)

기존 직접 CLI INSERT 방식 → **GitHub PR 통합** (CI/CD + audit log + Rollback git revert 패턴):

1. Claude Code 가 BATCH 적재 PR 생성:
   - 제목: "BATCH-N 적재 — {영역} ({N} 노드 / {M} 산식)"
   - 본문: Stage 1~7 결과 + CBIV 리포트 + sample 검수 자료
   - Files: `migrations/load_batch_N.sql` (INSERT 스크립트) + `docs/measurements/golden-tests/batch-N-golden.json`
2. **CI 자동 실행** (`cbiv-regression.yml`):
   - D1 Preview 환경 회귀 Golden 재실행 (Rule 25)
   - 실패 시 PR 코멘트 자동 + 머지 차단 (Rule 24)
3. **Stage 7.5** 의미 중복 인간 결정 → admin-web 큐 1
4. **진산님 PR 머지** → CI 가 wrangler d1 execute 자동 실행
5. audit log: PR 번호 + 머지 commit hash + reviewer_id
6. 모든 노드 `status='draft'` (Hard Limit)

**근거** (감사 R-5):

- 직접 CLI = audit 추적 어려움, Rollback 메커니즘 모호
- PR-based = git 히스토리가 audit log, revert PR 패턴이 Rollback (Rule 31)
- CI = CBIV (Rule 25) + secret scan + lint 통합 게이트
- 메모리 `project_batch_load_workflow.md` 와 정합 (Claude Code 가 PR 생성도 직접 처리)

### Stage 9: 핸드오프 + 로드맵 갱신

- `.jjokjipge/handoff-batch-N.md`
- Cross-link 예약 메모 (Layer 7 입력)
- `docs/plans/batch-loadmap.md` ☐ → ✅

### **Stage 10: Golden Test 영구 보존 + CI/CD 등록 (v2.0 신설)**

```
docs/measurements/golden-tests/
├── _registry.json
├── batch-1-golden.json       (BATCH-1 의 30+ Golden Test 영구 보존)
└── ...
```

GitHub Actions `cbiv-regression.yml`:

- BATCH 적재 PR 마다 BATCH-1~N 회귀 자동 실행 (결정 4)
- 1건 실패 → CI 실패 → PR 머지 차단
- PR 코멘트 자동 알림 (결정 5)

Hard Rule 24 (Golden 영구 보존), Hard Rule 25 (D1 Preview), Hard Rule 20 (CBIV 통과 후 적재).

---

## 3. 검수 체크리스트 (4단계 검증, v2.0)

상세: [`VALIDATION_FRAMEWORK.md`](./VALIDATION_FRAMEWORK.md)

### Level 1 — 표면 (Stage 4)

- [ ] Ontology Lock ID 형식
- [ ] schema-validator 통과
- [ ] graph-integrity 0 위반
- [ ] sample 노드 5건 진산님 검수

### Level 2 — 내용 (Stage 5)

- [ ] qg2-validator Golden 100%
- [ ] page_ref 무작위 5건 일치
- [ ] 산식 1건 변수명 정합
- [ ] 26년 개정 SUPERSEDES

### Level 3 — 학습 효과 (Stage 6)

- [ ] 기출 1~2건 자동 풀이 100%
- [ ] 혼동 유형 노드 명확
- [ ] 누락 페이지 식별
- [ ] 출처 추적성 100%

### **Level 4 — Cross-BATCH = CBIV (Stage 6.5, v2.0)**

- [ ] 참조 무결성 ✓
- [ ] 의미 중복 처리 (Adaptive Threshold + 진산님 결정)
- [ ] 상수 일관성 (exact-match) ✓
- [ ] SUPERSEDES 체인 ✓
- [ ] **회귀 Golden Test 100% (D1 Preview)** ★ 핵심
- [ ] 출제영역 정합성 (경고 처리)

---

## 4. 검증 실패 시 처리 (v2.1)

| 단계 실패                    | 대응                                                                                       |
| :--------------------------- | :----------------------------------------------------------------------------------------- |
| Level 1                      | JSON 재생성 (Ontology 강화)                                                                |
| Level 2                      | 노드/산식 정정 — 적재 후라면 SUPERSEDES                                                    |
| Level 3                      | 누락 노드 추가 / 다음 BATCH 이월                                                           |
| **CBIV Stage 1/3/4/5**       | **즉시 차단**, root-cause-analyzer 분석, [`ADMIN_REVIEW_UI.md`](./ADMIN_REVIEW_UI.md) 큐 3 |
| **CBIV Stage 2 (의미 중복)** | flag → 큐 1 인간 결정                                                                      |
| **CBIV Stage 6 (출제영역)**  | 경고 → 큐 2 인간 결정                                                                      |

---

## 5. dry-run vs 실 적재 (시범 단계, v1 유지)

| 단계                      | dry-run                                | 실 적재 (검증 통과 후)     |
| :------------------------ | :------------------------------------- | :------------------------- |
| Stage 1~7.5               | ✅ 동일                                | ✅ 동일                    |
| Stage 8 D1 INSERT         | ❌ 건너뜀                              | ✅ 진행                    |
| Stage 10 Golden Test 보존 | dry-run 산출만 (Git 보존, D1 미반영)   | ✅ Git + D1 둘 다 (결정 2) |
| 산출물 위치               | `docs/measurements/batch-N-draft.json` | D1 + Git Golden            |

---

## 6. 산출물 (BATCH 단위, v2.0 보강)

```
.jjokjipge/handoff-batch-N.md             # 핸드오프 + Cross-link 예약
docs/measurements/batch-N-draft.json       # dry-run JSON
docs/measurements/golden-tests/batch-N-golden.json  # ★ Golden 영구 보존 (v2.0)
docs/measurements/cbiv-reports/batch-N-cbiv-{date}.md  # ★ CBIV 결과 리포트 (v2.0)
docs/plans/batch-loadmap.md                # ☐ → ✅
.claude/reviews/review-{date}-batch-N.md   # 검수 산출물 (선택)
```

---

## 7. CI/CD 연동 (v2.0/v2.1)

`.github/workflows/cbiv-regression.yml` (검토서 §3):

```yaml
on:
  pull_request:
    paths:
      - 'packages/parser/**'
      - 'packages/formula-engine/**'
      - 'packages/cbiv/**'
      - 'migrations/**'
      - 'docs/measurements/golden-tests/**'

jobs:
  regression:
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      # 임시 D1 Preview 프로비저닝 (PR 단위, v2.1)
      - run: |
          DB_NAME="cbiv-pr-${{ github.event.pull_request.number }}"
          wrangler d1 create $DB_NAME --preview
      - run: wrangler d1 migrations apply $DB_NAME --preview
      - run: pnpm cbiv:seed --target $DB_NAME --preview
      - run: pnpm cbiv:regression --target $DB_NAME --preview
      # CBIV 실패 시 PR 코멘트 자동 (결정 5)
      - if: failure()
        run: pnpm cbiv:report-pr ${{ github.event.pull_request.number }}
      # 임시 D1 폐기 (성공/실패 무관)
      - if: always()
        run: wrangler d1 delete $DB_NAME --preview --yes
```

---

## 8. 본 프로토콜의 무결성 (v2.2, 31 Hard Rule 흡수)

- 모든 BATCH 적재는 본 10단계 절차 준수
- Stage 4~6.5 검증 우회 금지 (Hard Rule 20)
- 진산님 검수 (Stage 7) 통과 없이 D1 INSERT 금지
- **CBIV 통과 표시 없이 D1 INSERT 거부** (Hard Rule 20)
- **Golden Test 영구 보존 (Stage 10) 의무** (Hard Rule 24)
- **D1 Preview Database 만 사용** (Hard Rule 25, in-memory 금지)
- 단일 BATCH 검증만으로 적재 금지 — Cross-BATCH 회귀 검증 의무
