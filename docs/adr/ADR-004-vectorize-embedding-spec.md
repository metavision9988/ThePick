# ADR-004: Vectorize 임베딩 모델 및 스펙

- **상태:** Accepted (스펙), PoC 구현 Phase 1 HK-01
- **결정일:** 2026-04-18 (v2.1 재정립서 §3-1 정식화)
- **결정자:** 진산 + Claude Opus 4.7
- **관련 문서:** 구현 재정립서 v2.0 §3-1 Vectorize 구체 스펙

## 맥락 (Context)

쪽집게의 3계층 데이터 아키텍처 중 **맥락 계층**은 Cloudflare Vectorize 인덱스를 사용한다. Graph RAG 검색 시 메타데이터 필터로 후보 노드를 좁힌 뒤, 벡터 유사도로 해설 본문을 매칭하는 경로에 사용된다.

**선결 과제:**

1. 임베딩 모델 선정 — 한국어 성능 + 비용 + Workers 호환성
2. 차원 수 결정 — Vectorize 인덱스 비용에 영향
3. 메타데이터 필터 키 확정 — 쿼리 최적화
4. Graceful Degradation 임계값 검증 (유사도 < 0.60)

## 결정 (Decision)

### 1. 후보 모델 3종 + PoC 비교 (Phase 1 HK-01)

| 모델                       | 제공자                | 차원 | 한국어 성능          | 비용                               | Workers AI 지원 |
| -------------------------- | --------------------- | ---- | -------------------- | ---------------------------------- | --------------- |
| **bge-m3**                 | BAAI (via Workers AI) | 1024 | ★★★★ (다국어 최적화) | Workers AI 무료 티어 + 초과분 저렴 | ✅ 네이티브     |
| **bge-small-en-v1.5**      | BAAI (via Workers AI) | 384  | ★★☆ (영어 중심)      | 가장 저렴                          | ✅ 네이티브     |
| **text-embedding-3-small** | OpenAI                | 1536 | ★★★★                 | 유료 (API 별도 호출)               | ❌ (외부 API)   |

**1차 선정:** `bge-m3` (Workers AI 네이티브 + 한국어 ★★★★ + 차원 1024 적정)

### 2. 선정 기준 (PoC 합격 조건)

HK-01 단계에서 교재 BATCH 1 샘플 데이터로 검증:

- **유사 주제 간 유사도:** 동일 산식의 해설 vs 부연 설명 > **0.75**
- **다른 주제 간 유사도:** "적과전 종합위험" vs "벼 수확감소" < **0.40**
- **Graceful Degradation 임계값:** **0.60** 이하는 RAG 결과 거부 + "교재 O장 O절 참고" 안내
- **성능:** 단일 쿼리 Workers AI 호출 < 500ms

3개 모델 모두 위 기준 충족 시, **bge-m3 우선 채택** (한국어 품질 + 비용 균형).

### 3. 메타데이터 필터 스키마

```typescript
interface VectorMetadata {
  exam_id: string; // 시험 격리 필터 (ADR-007 반영 — Year 2 대비)
  // Year 1: 'son-hae-pyeong-ga-sa' 고정값
  // Year 2+: adapter 별 시험 ID
  node_id: string; // knowledge_node 연결
  lv1_insurance: '농업재해보험' | '종합위험' | '특정위험';
  lv2_crop: string; // 예: 'rice', 'apple', 'onion'
  exam_scope: '1차_상법' | '1차_법령' | '1차_농학' | '2차_실무';
  node_type: 'CONCEPT' | 'LAW' | 'FORMULA' | 'INVESTIGATION' | 'TERM';
  revision_year: number; // 2026 등 (Temporal Graph)
  source_page: number;
  is_active: boolean; // Temporal 처리
}
```

**`exam_id` 필터 원칙** (ADR-007 연동):

- 모든 Vectorize 쿼리는 `exam_id` 메타데이터 필터를 **필수**로 포함해야 한다
- 단일 Vectorize 인덱스 + `exam_id` 필터 방식 (시험별 인덱스 분리 금지 — Workers AI 호출 최적화)
- Year 1 구현은 하드코딩 `'son-hae-pyeong-ga-sa'` 허용, Year 2 Phase 4 리팩토링 시 adapter 주입 전환

### 4. 인덱싱 정책

- **approved 상태 노드만 임베딩** (`draft`, `review` 제외)
- 매년 교재 개정 시 **신규 인덱스 + 구 인덱스 병행 운영 (30일)** 후 전환
- 삭제는 하지 않음. `is_active=false` 마스킹만.

### 5. 쿼리 전략

1. **메타데이터 필터 먼저 적용** (예: `exam_id='son-hae-pyeong-ga-sa' AND exam_scope='2차_실무' AND lv2_crop='apple'`). `exam_id` 필터는 필수.
2. 남은 후보 중 벡터 유사도 Top-K (K=5) 추출
3. 유사도 < 0.60 → Graceful Degradation
4. Top-1 유사도 × Truth Weight 로 LLM 주입 순서 결정

## 결과 (Consequences)

### 긍정적

- Workers AI 네이티브 모델로 Edge 지연 최소화 (<500ms)
- 한국어 성능 확보 (bge-m3)
- 메타데이터 필터로 검색 정확도 대폭 향상
- Graceful Degradation 정량 기준 명시 → 서비스 품질 타협 불가

### 부정적

- bge-m3 1024차원 → 인덱스 저장/쿼리 비용이 384차원 모델보다 높음 (실측 필요)
- Workers AI 가격 정책 변경 시 비용 변동 가능
- 연 1회 개정 시 **전체 재임베딩** 비용 발생 (수천 노드 × $0.001 수준 → 관리 가능)

### 중립

- 영어 중심 모델(bge-small-en) 성능 열위는 예상되나, 영문 법령 인용이 거의 없으므로 실무 영향 미미

## 후속 조치 (Phase 1 HK-01)

- [ ] 교재 BATCH 1 샘플 50개 노드로 3개 모델 유사도 매트릭스 측정
- [ ] 측정 결과를 `docs/analysis/embedding-model-benchmark.md` 로 기록
- [ ] 최종 채택 모델 + 파라미터를 ADR-004 Addendum 으로 추가

## 참고

- Cloudflare Vectorize: https://developers.cloudflare.com/vectorize/
- bge-m3 모델 카드: https://huggingface.co/BAAI/bge-m3
- 재정립서 v2.0 §3-1

## 수정 이력

- 2026-04-18: 초안 작성 (v2.1 재정립서 스펙 정식화)
- 2026-04-18 (Session 8): `exam_id` 메타데이터 필터 필수 원칙 추가 (ADR-007 멀티시험 전환 연동)
