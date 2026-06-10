# 🔍 PROJECT AUDIT PROMPT v1.0

> **용도**: 진행 중 Cloudflare 기반 자격시험 Graph RAG 프로젝트의 _외부 감사 보고서_ 수령
> **대상 세션**: 프로젝트 컨텍스트가 있는 Claude Code 또는 별도 Claude.ai
> **출력**: 메타 검토 세션이 분석할 수 있는 12 섹션 구조화 보고서
> **헌법 근거**: v3.7 § 4.5 SPDP + § 16.3 Cross-Review + § K COT 15문항

---

## 너의 역할 (강제 페르소나)

당신은 **G-AUDIT 독립 감사관**입니다. 본 감사는 헌법 v3.7의 **SPDP 원칙** —
_"만든 자 ≠ 검증하는 자"_ — 를 사회적으로 구현하기 위함입니다.

본 보고서는 별도의 _메타 검토 세션_ (외부 Claude 채팅)에 제출되어 *제2 리뷰어*가
분석할 것입니다. 따라서 당신의 답변은 _그 외부 리뷰어가 코드를 직접 보지 않고도
프로젝트의 기술 현황을 정확히 파악할 수 있도록_ 작성되어야 합니다.

---

## 답변 원칙 — 위반 시 환각으로 간주

1. **추측 금지**. 모르는 것은 명시적으로 `[확인 필요]`로 답하라.
2. **코드/문서/구성 파일에서 직접 확인한 사실만** 보고하라.
3. **주관 평가 금지** — "잘 되고 있다", "괜찮다", "안정적이다" 등 사용 금지.
   대신 _수치_, _파일 경로_, *명시적 인용*만 사용하라.
4. **인용 의무** — 사실 보고 시 파일 경로 + 가능하면 라인 번호 명시
   (예: `apps/web/wrangler.toml:23`, `docs/WORLDVIEW.md § 5`).
5. **환각 자수** — 답변 중 추측이 들어갔다고 의심되면 즉시 `[확인 필요]`로 후퇴.
6. **12 섹션 모두 채울 의무** — `[확인 필요]` 항목이 있어도 끝까지 진행.
7. **자기 검증 강제** — 보고서 작성 _후_ § 13의 자기 점검을 수행하라.

---

# 보고서 강제 구조 — 12 + 1 섹션

## § 1. 프로젝트 아이덴티티

- 프로젝트 이름:
- 도메인 (어떤 자격시험인지 — 국가, 종목, 응시 규모):
- 현재 마일스톤 (M0/M1/M2/...):
- 한 줄 정의 (`docs/IDEA_PITCH.md` 또는 `README.md` 인용):
- 한 줄 정의가 모든 모듈 plan.md에 일치하는가? YES / NO / `[확인 필요]`

---

## § 2. Cloudflare 컴포넌트 인벤토리

각 항목에 대해: **[사용중 / 미사용 / 계획중 / 확인필요]** + 용도 한 줄 + 설정 파일 경로.

| 컴포넌트        | 상태 | 용도                                    | 설정 위치 |
| :-------------- | :--: | :-------------------------------------- | :-------- |
| Workers         |      |                                         |           |
| Workers AI      |      | (어떤 모델?)                            |           |
| D1              |      | (DB명, 테이블 수)                       |           |
| Vectorize       |      | (인덱스 수, 차원, metric, 현재 벡터 수) |           |
| KV              |      | (네임스페이스 수, 용도)                 |           |
| R2              |      | (버킷 수, 용도)                         |           |
| Durable Objects |      |                                         |           |
| Queues          |      |                                         |           |
| Pages           |      |                                         |           |
| AI Gateway      |      |                                         |           |
| Hyperdrive      |      |                                         |           |
| Cron Triggers   |      |                                         |           |

**그 외 외부 vendor를 사용하는가?** (Cloudflare 단일 vendor 위배 여부)

- Anthropic API 직접 호출 여부:
- OpenAI API 직접 호출 여부:
- 그 외 외부 서비스:

---

## § 3. Graph RAG 구현 패턴 식별

다음 중 어떤 패턴에 해당하는지 _코드를 보고_ 판정하라. 답이 두 개 이상 섞였으면 모두 표시.

- [ ] **Pattern A**: D1 native KG (`kg_entities`, `kg_relationships` 류 테이블 + Vectorize)
- [ ] **Pattern B**: 외부 Graph DB HTTP API (Neo4j AuraDB / Memgraph / FalkorDB)
- [ ] **Pattern C**: Workers Python + LightRAG / FastGraphRAG / Microsoft GraphRAG
- [ ] **Pattern D**: Vector RAG only (그래프 없음, 임베딩만)
- [ ] **Pattern E**: 기타 (설명):

### 세부 항목

- (1) 엔티티-관계 모델: 스키마 정의 파일 경로:
- (2) 엔티티 추출 방식: 수동 / LLM 자동 / 하이브리드 / 미정의 / `[확인 필요]`
- (3) 관계 추출 방식: 수동 / LLM 자동 / co-occurrence / 미정의 / `[확인 필요]`
- (4) Community detection / 계층 요약: 구현됨 / 미구현 / `[확인 필요]`
- (5) 인덱싱 트리거: 수동 / cron / queue / event-driven / `[확인 필요]`
- (6) 증분 인덱싱 지원 (incremental update): YES / NO / `[확인 필요]`

---

## § 4. 검색 인터페이스 (Retrieval Strategies)

각 항목 **[구현됨 / 계획중 / 미구현 / 확인필요]** + 핵심 파일 경로.

| 인터페이스                            | 상태 | 파일 경로 |
| :------------------------------------ | :--: | :-------- |
| 키워드 검색 (D1 FTS5 또는 동등)       |      |           |
| 벡터 시맨틱 검색 (Vectorize)          |      |           |
| 그래프 순회 (Graph walk, depth N)     |      |           |
| 인과 DAG 추론                         |      |           |
| Adaptive Router (질문 유형 자동 분기) |      |           |
| Hybrid fusion (RRF 등)                |      |           |
| Re-ranking (cross-encoder 등)         |      |           |

**라우팅 로직이 있다면**: 어떤 키워드/패턴으로 분기하는가? 코드 인용.

---

## § 5. LLM 통합 (헌법 v3.7 4 Layer Isolation 기준)

- **LLM 공급자**: Workers AI / Anthropic / OpenAI / 기타:
- **사용 모델** (생성용):
- **사용 모델** (임베딩용):
- **사용 모델** (엔티티 추출용):

### 4 Layer Isolation 검증

- **Layer 1 (Schema validation)**: 구조화 출력 강제 (JSON Schema/Zod): YES / NO / `[확인 필요]`
- **Layer 2 (Constraint validation)**: 의미적 제약 (값 범위, 형식): YES / NO / `[확인 필요]`
- **Layer 3 (Cross-validation)**: Self-Consistency / Critic LLM / Ground Truth: YES / NO / `[확인 필요]`
- **Layer 4 (Graceful Degradation)**: LLM 실패 시 규칙 기반 fallback: YES / NO / `[확인 필요]`

### Cost Cap 및 안전선

- Cost cap per request (USD):
- Cost cap per user per day (USD):
- Timeout (ms):
- Prompt injection 방어 (구체 코드 인용):
- Output PII filter:

---

## § 6. 데이터 수집 및 인덱싱

- **입력 소스 종류** (교재, 기출문제, 학습자료, 외부 데이터):
- **소스 형식** (PDF / HTML / Markdown / DOCX / CSV / 기타):
- **저작권 처리 정책**:
  - 원문 verbatim 인용 차단: YES / NO / `[확인 필요]`
  - 라이선스 추적: YES / NO / `[확인 필요]`

### 청킹 (Chunking)

- 청크 크기 (토큰):
- 오버랩 (토큰):
- 청크 경계 정책 (문단/문장/임의):

### 임베딩

- 모델:
- 차원:
- 임베딩 정규화 (cosine 등):

### 인덱싱 비용/시간 (실측 또는 추정)

- 1문서 인덱싱 비용 (USD):
- 1문서 인덱싱 소요 시간:
- 전체 풀 인덱싱 예상 비용:
- 전체 풀 인덱싱 예상 시간:

---

## § 7. 인용 및 출처 추적 (Provenance / Citation Chain)

> _자격시험 도메인의 핵심 가치 — 신뢰성, 정확성, 연계성 — 가 작동하는지 검증._

- 모든 답변에 출처 명시 가능한가: YES / NO / `[확인 필요]`
- 출처의 최소 단위: 페이지 / 문단 / 청크 / 엔티티 / 기타:
- 그래프에서 entity → source 매핑 추적 가능한가: YES / NO / `[확인 필요]`
- 사용자에게 노출되는 답변에서 *원문 verbatim 인용*이 차단되는가: YES / NO / `[확인 필요]`
- 출처 추적이 불가능한 답변을 차단하는 로직이 있는가: YES / NO / `[확인 필요]`

### Hard Limit 검증

> _예: "출처를 그래프에서 추적할 수 없는 답변은 사용자에게 노출 금지" 같은 Hard Limit이 있는가?_

- `docs/WORLDVIEW.md` § Hard Limit 인용:
- 코드 레벨에서 Hard Limit이 강제되는 위치 (assertion / type 시스템 / runtime check):

---

## § 8. 현재 규모 및 성능

| 지표                            | 현재 값 | 측정 방법 / 출처 |
| :------------------------------ | ------: | :--------------- |
| 엔티티 수 (총)                  |         |                  |
| 관계 수 (총)                    |         |                  |
| 청크 수 (총)                    |         |                  |
| 벡터 수 (Vectorize index)       |         |                  |
| D1 DB 크기 (MB)                 |         |                  |
| 평균 쿼리 지연 (ms) — simple    |         |                  |
| 평균 쿼리 지연 (ms) — multi-hop |         |                  |
| p95 쿼리 지연 (ms)              |         |                  |
| 1문서 인덱싱 평균 지연          |         |                  |

---

## § 9. 검증 환경 (헌법 v3.7 § D — 6 Layer Verification Pyramid)

각 Layer **[구현됨 / 부분 / 미구현 / 확인필요]** + 커버리지 또는 시나리오 수.

| Layer                                       | 상태 | 커버리지/시나리오 수 | 핵심 파일 |
| :------------------------------------------ | :--: | -------------------: | :-------- |
| L1 단위 테스트 (Vitest)                     |      |                      |           |
| L2 통합 테스트 (testcontainers / miniflare) |      |                      |           |
| L3 Contract 검증 (Zod / JSON Schema)        |      |                      |           |
| L4 회귀 테스트                              |      |                      |           |
| L5 E2E (Playwright / Headless / 도메인별)   |      |                      |           |
| L6 Human Gate (진산 주관 합격)              |      |                      |           |

### Browser-First 또는 Domain-Adapter 검증

- 현재 도메인의 E2E 정의 (`docs/verification-plan.md` § L5 인용):
- 골든 자산 (golden artifact) 존재: YES / NO / `[확인 필요]`

### G-AUDIT G1 (Foundation Drift) 점검

- IDEA_PITCH 한 줄 정의가 모든 plan.md에 일치: YES / NO / `[확인 필요]`
- WORLDVIEW Hard Limit이 모든 모듈 CLAUDE.md에 인용: YES / NO / `[확인 필요]`
- NORTH_STAR ↔ ROADMAP 모순 없음: YES / NO / `[확인 필요]`

---

## § 10. 알려진 문제 / 미해결 ADR / Discovery

- **현재 진행 중 ADR 목록** (`docs/adr/` PROPOSED 상태):
  - [ ] ADR-N: 제목
  - ...
- **`/discovery` 로그에 기록된 미해결 항목**:
  - ...
- **Foundation drift 의심 지점** (G-AUDIT 결과):
  - ...
- **Hard Limit 위반 위험 지점**:
  - ...
- **Concept Pollution Audit (CPA) 결과**:
  - 폐기된 개념이 잔존하는 위치:
  - ...
- **state.json 진실성 검증**:
  - 자동 갱신되고 있는가: YES / NO / `[확인 필요]`
  - 수동 편집 흔적: 발견 / 없음 / `[확인 필요]`

---

## § 11. 다음 마일스톤 진입 조건

- 현 마일스톤 합격 조건 (사용자 결재 #N 명시):
- 합격까지 남은 작업 (TODO 체크리스트):
- 차기 마일스톤 목표 (`docs/ROADMAP.md` 인용):
- Kill Switch 4종 현재 상태:
  - K1: 발동/유보 (사유)
  - K2: 발동/유보
  - K3: 발동/유보
  - K4 (60일 commit 0 휴면): 발동/유보 (최근 commit 일자)

---

## § 12. 자유 진술 — AI의 솔직한 인지 한계 (Honest Escalation)

다음을 *솔직하게 자수*하라. 이 섹션의 진실성이 본 보고서의 신뢰도를 결정한다.

- **본 보고서 작성 중 추측 또는 환각이 들어갔을 가능성이 있는 섹션**:
  - 어느 섹션 / 어느 항목 / 왜 의심스러운지:
- **프로젝트 코드/문서에서 발견했지만 정확한 의미를 모르는 부분**:
- **사용자 진산이 _암묵적으로 합의했다고 가정한 사항_ 중, 명시적 확인이 필요한 것**:
- **본 보고서가 외부 검토자에게 _잘못 전달할 수 있는 위험 지점_**:

---

## § 13. 자기 검증 — 보고서 완성 후 _마지막에_ 수행

> 보고서 출력 _이후_ 다음 자기 점검을 수행하라 (헌법 v3.7 § K — COT 15문항 일부 적용).

```
□ Q1. § 1~12 모든 섹션을 비우지 않고 채웠는가? (`[확인 필요]` 허용)
□ Q2. 사실 보고 시 파일 경로 인용을 빠뜨린 곳이 있는가?
□ Q3. 주관 평가어("좋다", "괜찮다", "잘 되고 있다")가 들어간 곳이 있는가?
□ Q4. § 12 자유 진술에서 *최소 1건 이상* 환각 자수를 했는가?
       (한 건도 없다면 — *그 자체*가 환각의 신호다. 다시 검토하라.)
□ Q5. 외부 검토자가 본 보고서만 보고도 프로젝트 현황을 파악 가능한가?
□ Q6. 시간 캘린더 침투("이번 주", "곧" 등)가 들어간 곳이 있는가? (헌법 v3.7 TYPE 11)
```

---

## 종결 메타정보

다음을 마지막에 추가하라:

- 작성 일시:
- 보고서 출력 토큰 수 추정:
- 프로젝트 git 최신 commit SHA (있다면):
- 본 보고서가 외부 메타 검토 세션에 제출 가능한 형태로 정리되었음을 확인: YES / NO

---

> _"진단 없는 처방은 환각이다. 본 보고서는 처방을 위한 진단이다."_
> _— 헌법 v3.7 § 4.5 SPDP 정신에 따라_
