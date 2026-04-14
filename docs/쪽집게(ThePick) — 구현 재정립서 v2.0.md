# 쪽집게(ThePick) — 구현 재정립서 v2.0

> 8개 기획문서 + 프론트엔드 아키텍처 + QA 마스터플랜을 통합한 Single Source of Truth
>
> v1.0 대비 변경: 프론트엔드 아키텍처 추가, 스키마 패치(v1.1) 반영, 기술스택 불일치 수정, 테스트 전략 통합, 확장성 전략 추가
>
> **v2.1 수정 (2026-04-14):** DEV COVEN 종합 리뷰 반영 — 기출 수 정정(825→~581), 인증 설계 추가, Vectorize 스펙 구체화, 교재 오류 메커니즘, 개정 영향 매핑, 동기화 충돌 보강, Hard Rules 16개, 재활용율 현실 조정
>
> 원본 문서: 통합 기획서 v1.1, 파이프라인 설계서, 1차 시험 기획서, QA 마스터플랜, 프론트엔드 마스터플랜, 스키마 확장 SQL 2종, 서비스맵 HTML
>
> 작성일: 2026-04-12

---

## 1. 프로젝트 정의

**쪽집게(ThePick)** — 손해평가사 자격시험(1차+2차) AI 학습 서비스

| 항목           | 값                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------- |
| 도메인         | 손해평가사 자격시험 (1차 객관식 3과목 + 2차 실기)                                           |
| 핵심 가치      | 835쪽 교재 + 기출 ~581문항(7회분)을 Graph RAG로 구조화 → AI가 정확한 해설/문제 생성         |
| 차별점         | 지식 그래프 기반 조건부 라우팅 + 룰 엔진 산식 연산 + 혼동 유형 자동 감지 + 암기법 자동 매칭 |
| 합격 기준(1차) | 매 과목 40점+, 전 과목 평균 60점+                                                           |
| 합격 기준(2차) | 100% 서술형/계산형                                                                          |
| MVP 목표       | 100명 베타 사용자, 16주 개발                                                                |

### 1차 시험 3과목

| 과목               | 핵심 전략                                   | 데이터 소스                           | 난이도 |
| ------------------ | ------------------------------------------- | ------------------------------------- | ------ |
| 상법 보험편        | 정방향 법조문 Graph (제638~730조)           | 법제처 원문 + 기출 ~175문항 (7회분)   | ★★☆    |
| 농어업재해보험법령 | 법령 계층 Graph + 개정 추적                 | 본법+시행령+고시 + 기출 ~175문항      | ★★★    |
| 농학개론           | **역공학 Graph RAG** (기출→지식체계 재구성) | 기출 ~175문항 + 이론서 스캔 + 웹 자료 | ★★★★★  |

### 2차 시험

| 과목                 | 핵심                    | 데이터 소스                                                 |
| -------------------- | ----------------------- | ----------------------------------------------------------- |
| 손해평가 이론과 실무 | 산식 연산 + 조건부 분기 | 교재 835쪽 (5대 보장방식 × 70+ 품목 × 16종 조사 × 80+ 산식) |

---

## 2. 기술 스택

> **v1.0 수정사항:** 프론트엔드를 Svelte → React Islands로 변경 (기존 SYSTEM_ARCHITECTURE 및 CLAUDE.md와 일치하도록)

| 계층           | 기술                           | 비고                                                 |
| -------------- | ------------------------------ | ---------------------------------------------------- |
| **프론트엔드** | **Astro + React Islands**      | SSG + Islands Architecture, Tailwind CSS + shadcn/ui |
| **상태관리**   | **Zustand** + IndexedDB 동기화 | 경량, React 외부 접근 가능                           |
| **로컬 DB**    | **IndexedDB (Dexie.js)**       | 오프라인 학습 핵심, 전 과목 ~4MB                     |
| **앱 형태**    | **PWA**                        | Service Worker + Background Sync + Web Push          |
| **백엔드**     | Cloudflare Workers + Hono      | Edge Runtime                                         |
| **DB (구조)**  | Cloudflare D1 (SQLite)         | 9개 테이블 (6개 기본 + 3개 확장)                     |
| **DB (벡터)**  | Cloudflare Vectorize           | 메타데이터 필터 + 유사도 검색                        |
| **ORM**        | Drizzle ORM                    | 타입 안전, D1 네이티브                               |
| **AI**         | Claude API (Haiku 배치)        | 구조화 파이프라인 + 학습자료 생성                    |
| **AI (OCR)**   | Claude Vision API              | 농학개론 이론서 스캔 처리                            |
| **산식 엔진**  | math.js AST 파서               | eval()/new Function() 절대 금지                      |
| **간격반복**   | FSRS-5                         | Python 참조 구현 포팅, 클라이언트에서도 로컬 실행    |
| **PDF 파싱**   | pdfplumber (Python subprocess) | 교재/기출 텍스트 추출                                |
| **시각화**     | D3.js Force Graph              | Graph Visualizer (관리자, 서브그래프 단위만)         |
| **테스트**     | Vitest + Playwright            | 단위/통합/E2E                                        |
| **코드품질**   | ESLint + Prettier + husky      | lint-staged, 커밋 전 자동                            |

---

## 3. 3계층 데이터 아키텍처

```
[정밀 계층] D1: constants 테이블
  수치/날짜/임계값 → 룰 엔진이 DB에서 직접 조회, LLM 추론 금지

[구조 계층] D1: knowledge_nodes + edges + formulas
  개념관계/조건분기/절차흐름 → 메타데이터 필터 후 검색

[맥락 계층] Vectorize: 임베딩
  해설/부연설명/사례 → 벡터 유사도 검색
```

### 방어 장치 4종

| 장치                 | 규칙                                                                  |
| -------------------- | --------------------------------------------------------------------- |
| Truth Weight         | LAW(10) > FORMULA(8) > INVESTIGATION(7) > CONCEPT(5) > TERM(3)        |
| Temporal Graph       | UPDATE 금지. 개정 시 신규 노드 + SUPERSEDES 엣지. 구 엣지 is_active=0 |
| Graceful Degradation | 유사도 < 0.60 → 해설 거부 + "교재 O장 O절 참고" 안내                  |
| Constants 직접 조회  | LLM에게 숫자 추론 절대 금지. DB 쿼리로만 가져옴                       |

### 3-1. Vectorize 구체 스펙 (v2.1 추가)

> DEV COVEN HI-03: 임베딩 모델·차원·메타데이터 필터 스펙 미정 해결

| 항목                 | 스펙                                                                                                            |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| 후보 모델 (PoC 비교) | bge-m3 (Workers AI, 1024차원, 한국어★★★★), bge-small-en-v1.5 (384차원), text-embedding-3-small (1536차원, 유료) |
| 선정 기준            | 동일 주제 유사도 > 0.75, 다른 주제 < 0.40, Graceful Degradation 0.60 검증                                       |
| 메타데이터 필터      | lv1_insurance, lv2_crop, exam_scope, node_type                                                                  |
| 인덱스 전략          | approved 노드만 임베딩 (draft/review 제외)                                                                      |
| PoC 시점             | Phase 1 Step 1-8 선행작업 (HK-01)                                                                               |
| **DEFCON**           | **L3** (인덱스 차원 = 생성 후 변경 불가)                                                                        |

---

## 4. Graph RAG 4-Level 메타데이터 스키마

```
LV1: 보장방식 (Insurance Type) — 8종
 └── LV2: 품목/작물군 (Crop Category) — 70+종
      └── LV3: 조사 종류 (Investigation Type) — 16종
           └── LV4: 구성 요소 (시기/방법/산식/조건/상수)
```

### 노드 유형 (7종)

| 타입          | truth_weight | 1차  | 2차  | 공유 | 합계 |
| ------------- | ------------ | ---- | ---- | ---- | ---- |
| LAW           | 10           | ~100 | ~50  | ~30  | ~120 |
| FORMULA       | 8            | ~30  | ~105 | ~10  | ~125 |
| INVESTIGATION | 7            | —    | ~20  | —    | ~20  |
| INSURANCE     | 6            | —    | ~8   | —    | ~8   |
| CROP          | 6            | ~40  | ~70  | ~40  | ~70  |
| CONCEPT       | 5            | ~300 | ~150 | ~50  | ~400 |
| TERM          | 3            | ~200 | ~120 | ~20  | ~300 |

### 엣지 유형 (13종)

> **v1.0 수정:** 11종 → 13종 (CROSS_REF + DIFFERS_FROM 추가)

APPLIES_TO, REQUIRES_INVESTIGATION, PREREQUISITE, USES_FORMULA, DEPENDS_ON, GOVERNED_BY, DEFINED_AS, EXCEPTION, TIME_CONSTRAINT, SUPERSEDES, SHARED_WITH, DIFFERS_FROM, **CROSS_REF**

### 통합 규모 추정

| 범위                  | 노드       | 엣지       | 상수     | 산식     |
| --------------------- | ---------- | ---------- | -------- | -------- |
| 1차 3과목             | ~670       | ~1,400     | ~100     | ~30      |
| 2차 손해평가          | ~620       | ~1,500     | ~70      | ~105     |
| 공유 노드 (중복 제거) | -150       | -300       | -20      | -10      |
| **합계**              | **~1,140** | **~2,600** | **~150** | **~125** |

---

## 5. DB 스키마 (9+1개 테이블)

> **v1.0 수정:** formulas에 `expected_inputs`, constants에 `unit` 필드 누락 → v1.1 패치 반영
> **v2.1 수정:** 인증용 `users` 테이블 추가 (10번째), PII 정책 명시

### 5-1. 인증 최소 설계 + PII 정책 (v2.1 추가)

> DEV COVEN HI-02 + HI-08: 인증 체계 완전 부재 + 개인정보보호법 대응

| 항목          | 결정                                                                                                                             |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| MVP 인증      | 이메일+비밀번호 (WebCrypto PBKDF2-SHA256, Workers 호환) or Cloudflare Access                                                     |
| 베타 기간     | 초대 코드 기반 가입 제한                                                                                                         |
| 테이블        | `users` (id, email, hashed_password, role, invite_code, created_at)                                                              |
| PII 범위      | email + 학습 이력 (user_progress)                                                                                                |
| 보관 정책     | D1: 탈퇴 후 30일 내 삭제. IndexedDB: 앱 재접속 시 자동 정리 (서버 410 응답 → 클라이언트 DB clear). 미접속 시 브라우저 quota 의존 |
| 관리자 접근   | 통계만 가능, 개별 학습 이력 접근 불가                                                                                            |
| 로그 마스킹   | userId를 해시로 변환하여 로깅                                                                                                    |
| 개인정보 동의 | 회원가입 시 수집·이용 동의 UI 필수                                                                                               |

### 기본 6개 테이블

| 테이블             | 역할                 | v1.1 패치 사항                                                                      |
| ------------------ | -------------------- | ----------------------------------------------------------------------------------- |
| `knowledge_nodes`  | 지식 노드            | `exam_scope` 필드 추가 ('1st_sub1'~'shared')                                        |
| `knowledge_edges`  | 노드 간 관계         | —                                                                                   |
| `formulas`         | 산식 (룰 엔진용)     | **`expected_inputs TEXT` 추가** (LLM이 찾아야 할 변수명/타입)                       |
| `constants`        | 매직 넘버 레지스트리 | **`unit TEXT` 추가** (%, 원, 주, kg — 단위 혼동 방지), `exam_scope` 추가            |
| `revision_changes` | 개정 이력 추적       | —                                                                                   |
| `exam_questions`   | 기출문제 (시간축)    | `exam_type`, `subject`, `topic_cluster`, `memorization_type`, `confusion_type` 추가 |

### 1차 확장 3개 테이블

| 테이블           | 역할             | 핵심 필드                                                                     |
| ---------------- | ---------------- | ----------------------------------------------------------------------------- |
| `mnemonic_cards` | 암기법 카드      | target_id, confusion_type, memorization_method, content, **reverse_verified** |
| `user_progress`  | 학습 진도 + FSRS | fsrs_difficulty/stability/interval/next_review, **last_confusion_type**       |
| `topic_clusters` | 농학개론 역공학  | lv1/lv2/lv3, exam_frequency, **is_covered** (미출제 영역 식별)                |

---

## 6. 프론트엔드 아키텍처

> **v1.0에서 완전 누락된 섹션 — v2.0 신규 추가**

### 6.1 3대 원칙

```
1. Mobile First, Offline First
   모바일 80%, 태블릿 15%, 데스크탑 5%
   터널에서도 학습 가능해야 함

2. 트래픽 최소화, 로컬 최대화
   학습 데이터는 IndexedDB에 캐싱
   서버 호출은 동기화 + 신규 컨텐츠 다운로드만
   월 데이터 사용량 목표: 50MB 이하

3. 3계층 확장 구조 (Core/Service/Plugin)
   새 기능 추가 시 기존 코드 수정 최소화
   새 시험 과목 추가 = 플러그인 수준
```

### 6.2 PWA 전략

| 캐싱 전략            | 대상                                         | 비고           |
| -------------------- | -------------------------------------------- | -------------- |
| Cache First          | HTML 셸, CSS/JS, 폰트, 아이콘                | 거의 변경 없음 |
| StaleWhileRevalidate | knowledge_nodes, constants, 기출, 플래시카드 | 가끔 업데이트  |
| NetworkFirst         | 학습 진도 동기화, FSRS 스케줄, 프로필        | 자주 변경      |
| NetworkOnly          | AI 튜터, 결제, 관리자 CMS                    | 실시간 필수    |

### 6.3 오프라인 동기화 프로토콜

```
[오프라인 학습]
  카드 응답 → Zustand 즉시 반영 → IndexedDB 영구 저장 → offlineActions 큐 추가

[온라인 복귀]
  Background Sync 트리거 → offlineActions 배치 전송 → 서버 확인 후 synced=true
  충돌 해결: 최근 타임스탬프 우선 (학습 데이터 유실 방지)

[v2.1 추가 — 충돌 시나리오 대응 (DEV COVEN HI-07)]
  - offlineActions에 트랜잭션 ID 추가 → 중복 처리 방지 (멱등성)
  - 서버 측: 마지막 처리 트랜잭션 ID 저장 → 재전송 시 스킵
  - 삭제된 노드에 대한 학습 기록 → "orphan progress"로 아카이브
  - 두 기기 동시 학습 → 타임스탬프 우선 + 양쪽 기록 모두 보존
  - 앱 강제 종료 → IndexedDB 트랜잭션 단위 쓰기 (반쪽 데이터 방지)
```

### 6.4 IndexedDB 예상 사용량

| 데이터                    | 크기                               |
| ------------------------- | ---------------------------------- |
| 전 과목 nodes (~1,140)    | ~1.5MB                             |
| constants (~150)          | ~50KB                              |
| 기출 전체 (~581문항)      | ~1.5MB                             |
| flashcards + userProgress | ~500KB                             |
| **합계**                  | **~4MB** (IndexedDB 한도의 ~0.01%) |

### 6.5 FSRS 클라이언트 로컬 실행

오프라인에서도 복습 스케줄 계산 가능하도록 FSRS를 클라이언트에서 실행.
서버와의 차이는 동기화 시점에 보정.

### 6.6 관리자 CMS — 별도 앱

```
apps/admin-web/  ← 학습자 PWA 번들에 미포함 (데스크탑 전용)
├── Graph Visualizer (D3.js, 서브그래프 단위)
├── 콘텐츠 검수 큐 (draft→review→approved→published)
├── Constants 검수 UI (혼동등급 확인)
├── 사용자 관리 / 통계
└── 파이프라인 실행 관리
```

---

## 7. 7개 Layer × 28개 모듈

> **v1.0 대비 변경 없음** (정확히 반영됨)

```
Layer 1: 데이터 수집 (5개)  — M01~M05
Layer 2: 구조화 파이프라인 (6개) — M06~M11
Layer 3: 데이터 품질 검증 (3개)  — M12~M14
Layer 4: Core 엔진 (5개)       — M15~M19
Layer 5: 컨텐츠 생성 (5개)      — M20~M24
Layer 6: 학습 서비스 (3개)      — M25~M27
Layer 7: 관리자 도구 (1개)      — M28
```

### 모듈 간 데이터 흐름

```
M01/M02/M03/M04 → M06 → M07 → M08 → M09/M10 → DB적재 → M14 → M12/M13
                                                                  ↓
                                                            [품질 게이트]
                                                                  ↓
                                                    M15/M16/M17/M18/M19
                                                                  ↓
                                                    M20/M21/M22/M23/M24
                                                                  ↓
                                                       M25/M26/M27/M28
```

---

## 8. 테스트 전략 + 품질 게이트

> **v1.0에서 미흡했던 섹션 — 102개 테스트 항목의 핵심만 발췌**

### 100% 필수 테스트 7개 (절대 타협 불가)

| 모듈               | 테스트                  | 실패 시                   |
| ------------------ | ----------------------- | ------------------------- |
| M03 기출 파서      | 기출 정답 100% 정확     | 서비스 사망               |
| M09 Constants      | 수치/날짜 값 100%       | 65%를 60%로 → 서비스 사망 |
| M13 정답 대조      | Graph↔기출 100% 일치    | 해설과 정답 충돌          |
| M16 Formula Engine | 산식 계산 100%          | 보험금 오산정             |
| M17 FSRS           | Python 참조와 100% 일치 | 복습 주기 오류            |
| M21 OX/빈칸        | 생성 문제 정답 100%     | AI 생성 오답              |
| M22 기출 변형      | 변형 후 정답 100%       | 정답 뒤바뀜               |

### 8개 품질 게이트

| 게이트 | 시점   | 절대 조건                     |
| ------ | ------ | ----------------------------- |
| QG-1   | P0 W2  | 기출 정답 100%                |
| QG-2   | P0 W4  | BATCH 1 산식 100%             |
| QG-3   | P1 W6  | 기출↔Graph 100%               |
| QG-4   | P1 W8  | 1차 3과목 삼각 검증           |
| QG-5   | P1 W10 | 엔진 5개 모듈 통과            |
| QG-6   | P2 W12 | 생성 컨텐츠 정답 100%         |
| QG-7   | P2 W14 | 통합 테스트 8건 통과          |
| QG-8   | P3 W16 | 베타 오답 신고 0건, P95 < 3초 |

### Hard Stop 조건

1. 기출 정답과 불일치하는 해설이 사용자에게 노출
2. Formula Engine이 잘못된 계산 결과 반환
3. OX/빈칸 문제의 정답이 틀림
4. 개정 전 내용을 현행으로 표시

→ 즉시 해당 기능 비활성화 + 원인 규명 + 재검증 후에만 복원

---

## 9. 혼동 유형 감지 + 암기법 매칭

> **v1.0 대비 변경 없음** (정확히 반영됨)

### 8종 혼동 유형 + 암기법 매칭

| 유형        | 감지 소스                        | 1순위 암기법               |
| ----------- | -------------------------------- | -------------------------- |
| 숫자/수치   | constants confusion_level=danger | Peg System + 대비표        |
| 소수점 계수 | constants category=coefficient   | 숫자분해법 + 반복연산      |
| 날짜/기간   | constants category=date          | Memory Palace + 달력       |
| 긍부정      | nodes type=LAW                   | OX 반전 훈련               |
| 예외        | edges type=EXCEPTION             | 대비 스토리                |
| 절차 순서   | edges type=PREREQUISITE          | Memory Palace + 플로우차트 |
| 작물간 교차 | edges type=DIFFERS_FROM          | 교차 비교표                |
| 나열 누락   | nodes + 기출분석                 | 두문자어(Acronym)          |

### 개인화 로직

```
사용자 오답 패턴 → 혼동 유형별 집계 → 해당 유형 카드 비중 자동 증가
FSRS: confusion_level=danger → 초기 난이도↑ → 복습 주기↓
```

---

## 10. 학습 서비스 4개 모드

| 모드      | 핵심 기능                                             |
| --------- | ----------------------------------------------------- |
| 기출 풀이 | 회차/과목/토픽별 필터 → 풀이 → 해설 → 오답→FSRS       |
| 복습/약점 | FSRS 스케줄 기반 카드 + 혼동유형별 집중 훈련          |
| 모의시험  | 과목당 25문항 × 3과목, 타이머, 합격판정               |
| AI 튜터   | 자연어 질의 → Graph RAG 검색 → truth_weight 정렬 해설 |

---

## 11. 기능 우선순위 (Core/Service/Plugin)

> **v1.0에서 완전 누락 — v2.0 신규 추가**

### 3계층 확장 구조

```
Plugin (Phase 3+): 게이미피케이션, 스터디그룹, 오디오모드, 다른시험플러그인
Service (Phase별): 기출풀이, 플래시카드, 모의시험, 약점공략, 문제생성, AI튜터
Core (최초 구축): GraphRAG, FormulaEngine, FSRS, 혼동감지, IndexedDB, PWA, 인증, DB스키마
```

### P0~P3 우선순위

| 우선순위 | 기능                                                              | 시점      |
| -------- | ----------------------------------------------------------------- | --------- |
| **P0**   | PWA셸, IndexedDB, 인증, 기출풀이, FSRS, 학습진도                  | Phase 0~1 |
| **P1**   | 플래시카드, 약점공략, 암기법매칭, 개정알림, 대시보드, 관리자CMS   | Phase 1~2 |
| **P2**   | 모의시험, 문제생성, 산식계산기, Web Push, 다크모드, 1차→2차브릿지 | Phase 2   |
| **P3**   | AI튜터, 게이미피케이션, 오디오모드, 스터디그룹, 다른시험확장      | Phase 3+  |

### 확장 설계 원칙

```
새 시험 과목 추가: ontology-registry.json에 ID 추가 + DB에 데이터 INSERT → 끝
새 학습 모드 추가: Astro 페이지 1개 + React Island 1개 → Core 엔진 그대로
새 암기법 추가: 매칭 매트릭스에 행 1개 + 생성 프롬프트 1개 → 끝
```

---

## 12. 1차-2차 통합 시너지

공유 노드 ~150개 (전체의 ~13%):

- 보험 기본 개념 (상법 ↔ 2차): ~30개
- 재해보험 법령 (법령 ↔ 2차): ~80개
- 작물 재배 특성 (농학 ↔ 2차): ~40개

**효과:** "1차 준비가 2차의 50%를 선행 학습하는 효과"
`exam_scope='shared'` 노드는 FSRS가 1차/2차 학습 이력을 공유

---

## 13. 다른 시험 확장 가능성

> **v1.0에서 완전 누락 — v2.0 신규 추가**

| 시험          | 유형      | Core 재사용율 | 핵심 추가 개발                    |
| ------------- | --------- | ------------- | --------------------------------- |
| 세무사/회계사 | 법률+계산 | 70%           | 세율표 UI, 분개 시뮬레이터        |
| 공인중개사    | 법률형    | 75%           | 판례 DB, 부동산 온톨로지          |
| 소방설비기사  | 이론+법령 | 65%           | 도면 시각화, 유량/압력 계산       |
| 전기기사      | 이론+계산 | 55%           | KaTeX 수식, 회로도, 공식유도Graph |

**핵심 결론:** 손해평가사가 가장 복잡(법령+산식+조건분기+매직넘버+개정추적). 이걸 만들면 나머지는 더 단순한 부분집합.

**v2.1 추가 — 확장 시점 확정 (DEV COVEN CR-01):**

- Phase 4 (Week 17~18): 공인중개사 PoC (연 ~20만 응시, 75% 재사용)
- 손해평가사 단독 월 99만원으로는 Claude API 비용 미달 → 확장이 생존 조건
- 첫 확장 대상: **공인중개사** (법률형 시험, 판례 DB + 부동산 온톨로지 추가)

### 15-1. 기존 프로젝트 재활용율 현실 조정 (v2.1 추가)

> DEV COVEN MD-03: "100% 복사"는 과대 추정

| 모듈         | 설계서 재활용율 | 현실 재활용율 | 추가 작업                               |
| ------------ | --------------- | ------------- | --------------------------------------- |
| FSRS (616줄) | 100% 복사       | **70%**       | Hexagonal 어댑터 + port 인터페이스 정의 |
| i18n (250줄) | 90%             | **80%**       | 시험 도메인 용어 키 체계 재설계         |
| 기출 정규식  | 80%             | **60%**       | pdfplumber 연동 + 회차별 포맷 5종 대응  |

---

## 14. 파이프라인 (교재 → 구조화)

### 8단계

```
Stage 1: PDF → pdfplumber → 페이지별 raw text
Stage 2: 정규식 → 절/항/호/목 분리 + 표 추출
Stage 3: Claude API 배치 → JSON (Ontology Lock 적용)
Stage 4: Ontology Lock + 스키마 검증 → 미등록 ID 거부/재수행
Stage 5: D1 INSERT (status='draft')
Stage 6: Graph Visualizer → 인간 검수 (draft→review→approved→published)
Stage 7: approved 노드만 Vectorize 임베딩
Stage 8: 학습자료 자동 생성
```

### 배치 분리 계획

| Batch   | 범위                   | 페이지    | 우선순위                 |
| ------- | ---------------------- | --------- | ------------------------ |
| BATCH 1 | 적과전 종합위험        | p.403~434 | **P0-PoC**               |
| BATCH 2 | 종합위험 수확감소 16종 | p.435~500 | P1-A                     |
| BATCH 3 | 논작물                 | p.501~521 | P1-B                     |
| BATCH 4 | 밭작물                 | p.522~576 | P1-C                     |
| BATCH 5 | 시설작물 + 수입감소    | p.577~647 | P1-D                     |
| BATCH 6 | 가축재해보험           | p.648~757 | **Post-MVP** ← v2.1 조정 |
| BATCH 7 | 1권 전체 (이론/약관)   | p.1~388   | **Post-MVP** ← v2.1 조정 |
| BATCH 8 | 부록 (용어/법령)       | p.758~835 | 전 단계                  |

### 14-1. 26년 개정사항 영향 매핑 (v2.1 추가)

> DEV COVEN CR-05: 개정사항이 어느 배치에서, 어떤 우선순위로 처리되는지 명시

| 개정 항목                           | 영향 범위                     | 반영 시점           | 영향받는 데이터                           |
| ----------------------------------- | ----------------------------- | ------------------- | ----------------------------------------- |
| 손해정도비율 20%→10%                | Constants 값 변경             | **BATCH 1 전 즉시** | constants 테이블 기존 값 무효화           |
| 예찰조사 신설                       | 신규 INVESTIGATION 노드       | BATCH 2 착수 시     | ontology-registry.json ID 추가 필요       |
| 과수4종 종합위험 추가               | 신규 INSURANCE 노드           | BATCH 2~5 해당 배치 | 배치별 병행 처리                          |
| 신규품목 (녹두/생강/참깨)           | 신규 CROP 노드                | 해당 BATCH (4~5)    | ontology-registry.json ID 추가 필요       |
| 온주밀감 잔존비율 계수 변경         | Constants 값 변경 + 산식 계수 | BATCH 2 전          | F-XX 산식 계수 업데이트, Golden Test 수정 |
| 블루베리 괄호 오류 (교재 오류)      | errata_note 추가              | BATCH 2 착수 시     | Hard Rule #15 적용 — 약관 원문 우선       |
| 옥수수 손해액 공식 오류 (교재 오류) | errata_note 추가              | BATCH 4 착수 시     | Hard Rule #15 적용 — 약관 원문 우선       |

**Hard Rule #16 보강**: 개정사항은 해당 배치 착수 전에 Constants/Ontology에 선반영한다

---

## 15. 패키지 구조

> **v1.0에서 ontology-registry.json 위치, formula-engine 내부 구조 누락 → 반영**

```
packages/
├── parser/src/
│   ├── pdf-extractor.ts
│   ├── section-splitter.ts
│   ├── table-extractor.ts
│   ├── batch-processor.ts
│   ├── ontology-registry.json       ← Ontology Lock (허용 ID)
│   ├── schema-validator.ts          ← 미등록 ID 거부 + 재수행
│   ├── db-loader.ts
│   ├── constants-extractor.ts
│   ├── revision-detector.ts
│   └── vectorize-loader.ts
│
├── parser-1st-exam/src/
│   ├── exam-question-parser.ts
│   ├── topic-clusterer.ts
│   ├── confusion-detector.ts
│   ├── mnemonic-generator.ts
│   ├── commercial-law-parser.ts
│   ├── cross-ref-detector.ts        ← CROSS_REF 엣지 감지
│   ├── insurance-law-parser.ts
│   ├── decree-parser.ts
│   ├── notice-parser.ts
│   ├── revision-tracker.ts
│   ├── vision-ocr.ts
│   ├── curriculum-reconstructor.ts
│   ├── web-supplement.ts
│   └── answer-triangulator.ts
│
├── formula-engine/src/              ← v1.0에서 내부구조 누락
│   ├── ast-parser.ts                ← math.js AST (eval 금지)
│   ├── variable-mapper.ts           ← expected_inputs 기반
│   ├── constants-resolver.ts        ← D1 직접 조회
│   └── engine.ts                    ← 통합 엔진
│
├── study-material-generator/src/
│   ├── flashcard-generator.ts
│   ├── formula-card-generator.ts
│   ├── flowchart-generator.ts
│   ├── condition-tree-generator.ts
│   ├── comparison-matrix.ts
│   └── revision-banner.ts
│
└── quality/src/
    ├── triangulation-checker.ts
    ├── answer-matcher.ts
    └── graph-integrity.ts

apps/
├── web/                             ← 학습자 PWA
│   ├── public/ (manifest.json, sw.js, icons/)
│   ├── src/pages/ (Astro 라우팅)
│   ├── src/components/ (React Islands)
│   ├── src/lib/ (local-db, sync-engine, fsrs-client)
│   └── src/stores/ (Zustand)
│
├── admin-web/                       ← 관리자 CMS (별도)
│   └── src/ (Graph Visualizer, 검수 큐, 콘텐츠 편집)
│
├── api/                             ← Cloudflare Workers API
│   └── src/ (routes, middleware, Hono)
│
└── batch/                           ← 배치 작업 (AI 생성)
    └── jobs/
```

---

## 16. 개발 로드맵 (16주)

### Phase 0: Foundation + PoC (4주)

```
Week 1-2: 인프라 + 데이터 수집
  M01, M02, M03, DB 스키마 9개 테이블
  PWA 셸 + IndexedDB + Zustand 기본 구조
  QG-1: 기출 정답 100%

Week 3-4: 구조화 PoC (BATCH 1)
  M06~M09, M14, M16 PoC, M28 경량 Graph Visualizer
  QG-2: BATCH 1 산식 100%
```

### Phase 1: Data Pipeline + Core Engine (6주)

```
Week 5-6: 2차 BATCH 2~5 + 1차 상법
  QG-3: 기출↔Graph 100%

Week 7-8: 1차 법령 + 농학 역공학
  M04, M11, M05, M12
  QG-4: 1차 3과목 삼각 검증

Week 9-10: Core 엔진
  M15~M19
  QG-5: 엔진 5개 모듈 통과
```

### Phase 2: Content + Service (4주)

```
Week 11-12: 컨텐츠 생성 (M20~M23, M24는 Post-MVP ← v2.1 조정)
  QG-6: 생성 컨텐츠 정답 100%

Week 13-14: 학습 서비스 UI (M25~M27, M28 고급 기능은 Post-MVP ← v2.1 조정)
  QG-7: 통합 테스트 8건 통과
  ※ BATCH 6~7 (가축재해보험, 이론/약관)은 Post-MVP로 이동 ← v2.1 (HI-01)
```

### Phase 3: Launch Ready (2주)

```
Week 15-16: 최종 검증 + 베타
  QG-8: 오답 신고 0건, P95 < 3초
```

### Phase 4: 확장 PoC (v2.1 추가, Week 17~18)

```
Week 17-18: 공인중개사 PoC
  기출 10문항 Graph 구조화 → Core 재사용율 실측 → 확장 Go/No-Go 판정
```

---

## 17. Hard Rules (16개)

> **v1.0에서 11개 → 14개 → v2.1에서 16개로 확장** (DEV COVEN HI-05, SENTINEL 반영)

```
1.  UPDATE 금지: 개정 시 신규 노드 + SUPERSEDES 엣지
2.  LLM 연산 금지: Formula Engine만 연산
3.  Truth Weight 강제 정렬
4.  Graceful Degradation: 유사도 < 0.60 → 거부
5.  Constants 직접 조회: DB 쿼리로만
6.  배치 순서 엄수: BATCH N 검증 없이 N+1 금지
7.  인간 검수 필수: AI 데이터는 draft로만 적재
8.  Ontology Lock: ontology-registry.json 외 ID 거부
9.  동적 코드 실행 금지: math.js AST 파서로만 실행
10. Hairball 방지: Graph Visualizer 서브그래프 단위만
11. 기출 정답 최우선: Graph↔기출 충돌 → flagged
12. 농학 커버리지 경고: 미출제 영역 명시적 라벨링
13. 1차-2차 공유 무결성: shared 노드 수정 시 양쪽 검토
14. 암기법 역방향 검증: "권점자"→원래 3항목 복원 실패 시 폐기
15. 교재 오류 시 약관 원문 우선: 교재 인쇄 오류 발견 시 약관 원문을 진실로 채택,
    errata_note로 표시 + 학습 UI에서 경고 배너 ← v2.1 추가
16. API 키 클라이언트 노출 금지: Claude API 키는 Workers 프록시로만 사용,
    클라이언트 번들에 절대 포함하지 않음 ← v2.1 추가
```

---

## 18. Phase 0 즉시 착수 순서

```
1. DB 스키마 마이그레이션 (9개 테이블, v1.1 패치 포함)
2. PWA 셸 + IndexedDB 초기화 (오프라인 인프라)
3. M01 PDF 추출기
4. M03 기출 파서 → QG-1 (기출 정답 100%)
5. M06 섹션 분리기 + M07 배치 프로세서 (Ontology Lock)
6. M08 Schema Validator
7. M09 Constants 추출기 (expected_inputs + unit 반영)
8. M16 Formula Engine PoC (AST 파서)
9. M28 Graph Visualizer 경량 버전 (서브그래프, Hairball 방지)
→ QG-2 통과 후 Phase 1 진입
```

---

## v1.0 → v2.0 변경 이력 요약

| 영역               | v1.0 상태                              | v2.0 수정                                                           |
| ------------------ | -------------------------------------- | ------------------------------------------------------------------- |
| **프론트엔드**     | Svelte로 기재 (기존 문서와 불일치)     | React Islands로 수정 (CLAUDE.md, SYSTEM_ARCH와 일치)                |
| **PWA/오프라인**   | 완전 누락                              | §6 전체 추가 (Service Worker, IndexedDB, Background Sync, Web Push) |
| **스키마 패치**    | v1.0 기준 (expected_inputs, unit 누락) | v1.1 패치 반영 (formulas.expected_inputs, constants.unit)           |
| **엣지 유형**      | 11종                                   | 12종 (CROSS_REF 추가 — 상법 준용 관계)                              |
| **Hard Rules**     | 11개                                   | 14개 (v1.1 방어패치 3건 + 1차 전용 3건)                             |
| **formula-engine** | 내부 구조 미명시                       | ast-parser/variable-mapper/constants-resolver/engine 4파일 명시     |
| **테스트 전략**    | 품질 게이트만 나열                     | 100% 필수 7개 테스트 + Hard Stop 4개 조건 상세화                    |
| **기능 우선순위**  | 누락                                   | P0~P3 4단계 + Core/Service/Plugin 3계층 추가                        |
| **확장성**         | 누락                                   | 다른 시험 재사용율 분석 + 확장 설계 원칙 추가                       |
| **관리자 CMS**     | §7에 간략 언급                         | 별도 앱(admin-web) 분리 + 콘텐츠 워크플로우 명시                    |
| **Phase 0**        | PWA 셸 없음                            | PWA 셸 + IndexedDB를 2순위로 추가                                   |

---

---

## v2.0 → v2.1 변경 이력 요약 (2026-04-14, DEV COVEN 리뷰 반영)

| 영역           | v2.0 상태            | v2.1 수정                                           |
| -------------- | -------------------- | --------------------------------------------------- |
| **기출 수**    | 825문항 (11회분)     | ~581문항 (7회분, 제5~11회) — 실제 docs/manual/ 확인 |
| **엣지 유형**  | "12종" 기재          | 13종으로 정정 (실제 나열은 13개였음)                |
| **인증**       | 완전 누락            | §5-1 인증 최소 설계 + PII 정책 추가                 |
| **Vectorize**  | "유사도 검색"만 언급 | §3-1 모델·차원·필터 구체 스펙 추가                  |
| **동기화**     | 충돌 해결 1줄        | §6.3 트랜잭션 ID, 멱등성, 5개 시나리오 보강         |
| **Hard Rules** | 14개                 | 16개 (#15 교재 오류, #16 API 키 보호)               |
| **개정 매핑**  | 미작성               | §14-1 26년 개정 7건 영향 매핑 추가                  |
| **배치 범위**  | BATCH 6~7 = P2       | Post-MVP로 이동 (1차 시험 집중)                     |
| **확장 시점**  | 미정                 | Phase 4 공인중개사 PoC (Week 17~18)                 |
| **재활용율**   | 최대 100%            | FSRS 70%, i18n 80%, 기출 정규식 60%로 현실 조정     |
| **Won't Do**   | 없음                 | 구현 설계서 §10-1에 11개 항목 명시                  |

_"설계는 끝났다. 두 번. 첫 번째는 뼈를 세웠고, 두 번째는 빈 곳을 메웠다._
_이제 진짜로 Claude Code에게 바톤을 넘긴다."_

— DEV COVEN 구현 재정립서 v2.0
