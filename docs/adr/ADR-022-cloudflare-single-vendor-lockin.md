# ADR-022: Cloudflare Single-Vendor Lock-in 5년 수용 + 보호 5장치

- **상태:** Accepted
- **결정일:** 2026-04-27
- **결정자:** 진산
- **관련 ADR:** ADR-006 (Cloudflare 단일 벤더 원칙 — 본 ADR이 보강)
- **관련 헌법:** VOID ENGINE DESIGN CONSTITUTION v3.0 Volume XVII.3 (Single-Vendor Lock-in Profile, 보호 5장치)
- **관련 메모리:** `feedback_single_vendor_cloudflare`
- **트리거:** Engine Hardening Roadmap v1.1 Step 1

---

## 1. Context (맥락)

ADR-006은 Cloudflare 단일 벤더 원칙을 정립했지만 **lock-in의 시간 범위와 보호 장치**는 명시하지 않았다. v3.0 헌법 Volume XVII.3은 단일 벤더 환경에서 다음 5장치를 의무화한다:

1. ADR로 명시 — "다음 N년간 {벤더} 종속 수용"
2. 데이터 export 도구 1년 내 1회 테스트
3. 핵심 데이터는 standard format 저장
4. 비용 모니터링 (벤더 가격 인상 트리거)
5. 벤더 SLA 위반 시 보상 청구 절차 문서화

**ADR-006은 ①번만 부분 충족.** 나머지 ②~⑤는 미명시. 본 ADR이 5장치 전수 명문화.

또한 Engine Hardening Roadmap v1.1 Step 4 (ADR-025 Two-Layer Cost Control)와 Step 1.5 (Anthropic monthly cap)가 본 ADR의 Layer 2 인프라에 의존한다 → 선결 의무.

---

## 2. Decision (결정)

### 2.1 Lock-in 시간 범위

**Cloudflare 종속 수용 기간: 5년 (2026-04-27 ~ 2031-04-27)**

5년 후 재평가 — 기간 내 무조건 종속 유지가 아니라 **"5년간은 종속 비용을 합리적 비용으로 수용한다"**는 의미.

### 2.2 보호 5장치 — 전수 명문화

#### 장치 1 — ADR로 명시 (본 문서)

본 ADR-022 자체가 충족.

#### 장치 2 — 데이터 Export 1년 1회 테스트

**의무 일정:**

- **첫 테스트:** 2027-04-27 (1년 후)
- **이후:** 매년 4월 마지막 금요일

**Export 산출물:**

| 데이터                               | 형식                           | 도구                                          | 검증                                                  |
| :----------------------------------- | :----------------------------- | :-------------------------------------------- | :---------------------------------------------------- |
| D1 (9개 테이블 + Phase 진행 시 추가) | SQL dump (`.sql`) + JSON       | `wrangler d1 export <db> --output=<file>.sql` | 별도 PostgreSQL/SQLite 인스턴스에 import → 행 수 일치 |
| Vectorize (임베딩)                   | JSONL (id + vector + metadata) | Workers script (배치 export)                  | 벡터 dimension·norm 검증                              |
| R2 (객체 저장소)                     | tar.gz (디렉토리 트리 보존)    | `rclone` 또는 Workers script                  | SHA-256 해시 검증                                     |
| KV (key-value)                       | JSON Lines                     | Workers script                                | 키 수 일치                                            |

**Export 테스트 통과 기준:**

- D1 → PostgreSQL import 시 모든 row 보존 (FK 제약 변환 포함)
- 핵심 쿼리 5종 (`select node by id`, `RAG search`, `formula by exam`, `user_progress`, `mnemonic_card`)이 import된 PostgreSQL에서 동일 결과 반환

**테스트 산출물 보관:** `docs/exit-strategy/{YYYY}/export-test-report.md`

#### 장치 3 — 핵심 데이터는 Standard Format 저장

| 데이터                    | 저장 위치 (Cloudflare)          | Standard Format 보장                                                                           |
| :------------------------ | :------------------------------ | :--------------------------------------------------------------------------------------------- |
| 지식 그래프 (nodes/edges) | D1 SQLite                       | ✅ 표준 SQL — PostgreSQL/SQLite 어디든 import                                                  |
| 임베딩 벡터               | Vectorize                       | ⚠️ 형식은 표준 (id+vector+metadata)이나 Vectorize 인덱스 알고리즘은 비공개 → JSONL export 의무 |
| 산식 정의                 | D1 (`equation_template` 컬럼)   | ✅ math.js 호환 표현식 (재계산 가능)                                                           |
| Constants                 | D1 (테이블)                     | ✅ 표준 SQL                                                                                    |
| 사용자 학습 기록          | D1 (`user_progress`)            | ✅ 표준 SQL                                                                                    |
| AI 생성 콘텐츠            | D1 + R2 (원본 PDF/이미지)       | ✅ R2는 S3 호환 API                                                                            |
| 로그                      | Workers Logs / Analytics Engine | ⚠️ Cloudflare 독점 형식 — JSONL export 도구 별도 작성 (Phase 2)                                |

**Hard Rule 26 (신규):** D1 스키마 변경 시 Migration SQL이 PostgreSQL 호환 SQL이어야 한다 (Cloudflare-only DDL 사용 금지).

#### 장치 4 — 비용 모니터링 + 가격 인상 트리거

**모니터링 채널:**

| 채널                               | 빈도     | 알림                                              |
| :--------------------------------- | :------- | :------------------------------------------------ |
| Cloudflare Dashboard 월간 청구서   | 매월 1일 | 진산님 이메일 자동                                |
| Workers/D1/Vectorize/R2 사용량 80% | 실시간   | Cloudflare 콘솔 알림 설정                         |
| Cloudflare 가격 정책 페이지 RSS    | 분기 1회 | 진산님 수동 점검                                  |
| Anthropic 가격 정책 (별도)         | 분기 1회 | 진산님 수동 점검 (Anthropic은 Cloudflare 외 의존) |

**가격 인상 트리거 → ADR 신규 작성 의무:**

- Cloudflare 핵심 서비스(Workers/D1/Vectorize/R2) 단가 ≥20% 인상 발표 시
- 기존 ThePick 월 비용 ≥50% 증가 시
- → ADR-{NN} "Cloudflare 가격 인상 대응" 작성, 대안(AWS/GCP 부분 이전) 평가

#### 장치 5 — 벤더 SLA 위반 시 보상 청구 절차

**Cloudflare SLA (2026-04-27 기준 공시):**

| 서비스       | SLA                     | 위반 시 보상                             |
| :----------- | :---------------------- | :--------------------------------------- |
| Workers Paid | 99.9% (월간 다운 ≤43분) | 다운타임 비례 환불 (subscription credit) |
| D1           | 99.9%                   | 동일                                     |
| R2           | 99.9%                   | 동일                                     |

**보상 청구 절차:**

1. 다운타임 감지 → `dash.cloudflare.com/status` 또는 Workers Logs 증거 수집
2. 영향 시간·서비스·요청 수 기록 → `docs/incidents/{YYYY-MM-DD}-cloudflare-outage.md`
3. Cloudflare 티켓 (`Account → Support`) 제출 — `Refund request: SLA breach` 카테고리
4. credit 수령 후 청구서에 반영 확인

**문서 보관:** `docs/incidents/` 디렉토리 (신규).

---

### 2.3 ADR-006과의 관계

| 항목                 | ADR-006 (기존) | ADR-022 (본 ADR, 보강)         |
| :------------------- | :------------- | :----------------------------- |
| 단일 벤더 원칙       | ✅ 정립        | ✅ 계승                        |
| 채택/배척 매트릭스   | ✅ 정립        | ✅ 계승 (변경 없음)            |
| Lock-in 시간 범위    | 미명시         | ✅ 5년 (2026~2031)             |
| Export 테스트 의무   | 미명시         | ✅ 매년 4월 마지막 금요일      |
| Standard Format 의무 | 부분           | ✅ 표 명시 + Hard Rule 26 신설 |
| 비용 모니터링 절차   | 미명시         | ✅ 4개 채널 + 트리거 정의      |
| SLA 보상 청구 절차   | 미명시         | ✅ 4단계 절차 + 문서 보관 위치 |

**ADR-006 폐기 X. 보강 관계.** 두 ADR을 함께 읽어야 단일 벤더 정책 전수 파악 가능.

---

## 3. Consequences (결과)

### 긍정적

- v3.0 헌법 Vol XVII.3 보호 5장치 100% 충족 — 헌법 정합성 확보
- 5년 종속 수용을 명문화 → 진산님·Claude 모두 의사결정 시 "이 기능을 외부로 옮겨야 하나?" 고민 제거 (5년간은 무조건 Cloudflare)
- Export 테스트 매년 의무화 → 진짜 lock-in 위험 (export 불가 상태) 사전 차단
- 가격 인상·SLA 위반 절차 명시 → 사고 시 즉시 행동 가능

### 부정적 / 수용하는 트레이드오프

- 매년 1회 Export 테스트 부담 (반나절 작업 — 진산님 수동 또는 자동화 스크립트 작성 필요)
- 5년 후 재평가 시점에 마이그레이션 비용 누적 가능성 (단, 그때 Cloudflare가 더 좋아져 있을 가능성도 동등)
- ADR-006 + ADR-022 두 문서를 같이 관리 필요 (인지 비용 증가 — 그러나 추적성 향상)

### 즉시 발생하는 작업 (Engine Hardening Roadmap에 포함)

- **Step 4 (ADR-025) Layer 2 매핑 가능** — Anthropic 콘솔 cap + git pre-commit hook = ThePick의 Cloudflare-아님 부분 보호
- **`docs/exit-strategy/` 디렉토리 신설** (Step 11 또는 별도)
- **`docs/incidents/` 디렉토리 신설** (사고 발생 시)
- **Hard Rule 26** — 다음 마이그레이션 SQL 작성 시점에 적용 (현재 0001~0005 마이그레이션은 PostgreSQL 호환 — 회귀 점검 권고)

---

## 4. Alternatives Considered (대안)

| 대안                              | 장점                                               | 단점                                           | 미선택 이유                                     |
| :-------------------------------- | :------------------------------------------------- | :--------------------------------------------- | :---------------------------------------------- |
| Multi-cloud (AWS + Cloudflare)    | 벤더 위험 분산                                     | 1인 운영자 관리 부담 N배, 청구·SSO·SOC2 파편화 | 메모리 `feedback_single_vendor_cloudflare` 위배 |
| Lock-in 무기한 수용 (재평가 없음) | 단순                                               | 5년 후 시장 변화 미반영                        | Vol XVII.3 매 5년 평가 의무                     |
| Lock-in 1년만 수용                | 자유도 높음                                        | 매년 재평가 비용 + 의사결정 피로               | 상용 서비스 안정성 저하                         |
| 본 ADR (5년 + 매년 Export 테스트) | 헌법 정합 + 진짜 lock-in 위험 차단 + 의사결정 효율 | Export 테스트 부담 (반나절/년)                 | **선택 — 균형점**                               |

---

## 5. Migration / Backward Compatibility

- ADR-006 그대로 유효
- 신규 추가 사항만 본 ADR에 명시 → 기존 코드 변경 없음
- 새 디렉토리 `docs/exit-strategy/` `docs/incidents/`는 빈 상태로 시작, 트리거 발생 시 채움

---

## 6. SLO Impact

해당 없음 — 본 ADR은 운영·계약 결정. 코드 SLO 변경 없음.

단, 간접 효과: Export 테스트가 매년 BATCH 적재 후 데이터 정합성 검증 역할도 수행 (Build SLO `build_correctness` 보강).

---

## 7. Human Decision Required

- [x] Approved (진산님 2026-04-27 — Engine Hardening Roadmap v1.1 승인 메시지에 포함)
- [ ] Rejected
- [ ] Modified

**Reviewer:** 진산
**Date:** 2026-04-27
