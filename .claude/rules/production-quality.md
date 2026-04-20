# 상용 품질 코딩 원칙 — ThePick

> 이 규칙은 모든 코드 구현에 적용된다. "당장 동작하는 코드"가 아닌
> "상용 서비스로 성장할 수 있는 코드"를 작성한다.
> 이 원칙을 어기는 구현은 완료로 인정하지 않는다.

## 핵심 질문 (매 구현 전 자문)

```
"이 코드가 10,000명 유저, 매년 교재 개정, 다른 시험 확장에서도 버티는가?"
```

YES가 아니면 구현 방식을 바꿔라.

## 금지 패턴 → 올바른 패턴

| 금지 (땜빵)                   | 올바른 (상용)                      | 이유                           |
| ----------------------------- | ---------------------------------- | ------------------------------ |
| `any` 타입                    | 정확한 타입/제네릭 정의            | 타입 안전성 = 런타임 안전성    |
| 하드코딩 숫자/문자열          | Constants DB 또는 명명된 상수      | 개정 시 코드 수정 불필요       |
| `console.log` 디버깅          | `console.warn/error` + 구조화 로깅 | 프로덕션 로그 추적 가능        |
| 인메모리 임시 저장            | D1/IndexedDB 영구 경로             | 앱 재시작 시 데이터 유실       |
| "나중에 처리" 주석            | 즉시 구현 or 명시적 기획 보고      | TODO는 기술 부채의 씨앗        |
| 빈 catch `{}`                 | 에러 로깅 + 전파 or 폴백           | 무음 실패 = 디버깅 지옥        |
| `import * as lib` 전체 임포트 | 선택적 임포트 (트리쉐이킹)         | 번들 크기 = 콜드스타트 시간    |
| 동기적 대용량 처리            | 스트리밍/페이지네이션/가상화       | 10K 유저 시 메모리 초과        |
| 테스트 없이 "완료"            | Golden Test 포함 구현              | 테스트 없는 코드는 미완성      |
| Node.js 전용 API              | Workers 호환 API (Web Crypto 등)   | Cloudflare Workers 런타임 제약 |

## 구현 시 체크리스트

코드를 작성할 때마다 아래를 확인한다:

1. **타입 안전성**: `any` 0건. 외부 데이터는 Zod/런타임 검증.
2. **에러 처리**: 모든 async/await에 try-catch. 빈 catch 0건. AppError 사용.
3. **번들 최적화**: 선택적 임포트. `import { x } from 'lib'` not `import * as lib`.
4. **Workers 호환**: fs/path 미사용. CPU 50ms 고려. Web Crypto만 사용.
5. **오프라인**: 클라이언트 데이터는 IndexedDB 경로. offlineActions 큐 활용.
6. **확장성**: 하드코딩 0건. 설정/상수는 DB 또는 config에서 로드.
7. **테스트**: 핵심 로직은 Golden Test 포함. 엣지케이스 최소 1건.
8. **보안**: 사용자 입력 검증. innerHTML 금지. API 키 클라이언트 노출 금지.

## "빠른 구현" 요청 시 행동 규칙

사용자가 "빨리", "일단", "대충" 등의 표현을 사용하더라도:

- 상용 품질 원칙을 지킨다
- 범위를 줄이는 것은 OK (기능 축소)
- 품질을 줄이는 것은 NOT OK (땜빵 구현)
- "이 범위로 줄이면 상용 품질로 빠르게 가능합니다"로 대안 제시

## 멀티시험 격리 Hard Rules (15~17) — ADR-007 연동

Year 1은 손해평가사 단일 시험을 구현하나, Year 2 공인중개사 확장 비용을
최소화하기 위해 Year 1 내내 다음 3개 규칙을 지킨다.

> **v3.0 §10.2 본문과의 관계:** 본 Rule 15~17은 v3.0 §10.2의 번호 체계를
> 계승하되, Year 1 실행 맥락에 맞춰 주제 일부를 재해석했다. v3.0 §10.2 원본
> (Rule 16 Ontology 플러그인화, Rule 17 테스트 플러그인화)은 Year 2 Phase 4
> 리팩토링 시점에 본 파일이 업데이트된다. 근거: ADR-007 §"즉시 반영".

### Hard Rule 15 — 범용 계층 내 시험 특화 분기 금지

`packages/formula-engine/`, `packages/parser/`, `packages/shared/` 등
범용 계층 내에 **`if (examId === 'son-hae-pyeong-ga-sa')` 류 분기 금지**.
시험별 특화 로직은 `packages/parser-1st-exam/` (Year 2 이후
`exams/son-hae-pyeong-ga-sa/`) 에만 존재한다. 위반 시 Year 2
adapter 추가 비용이 기하급수적으로 증가한다.

**Year 1 한시 예외 (ADR-007 Year 2 이전 대상으로 고정):**

- `packages/shared/src/types.ts`의 손해평가사 특화 리터럴 허용:
  `NodeType`(INSURANCE/CROP 포함), `TRUTH_WEIGHTS`, `ConstantCategory`
  (`insurance_rate`), `ConfusionType`(`cross_crop`), `ExamScope`(`1st_sub1` 등).
  Year 2 Phase 4에서 `exams/son-hae-pyeong-ga-sa/domain.ts`로 이전.
- `constants` 테이블 조회 / Vectorize 업서트 시 `exam_id` 기본값
  하드코딩(`EXAM_IDS.SON_HAE_PYEONG_GA_SA` 경유 — Rule 17 준수) 허용.
  반드시 주석에 "Year 2 Phase 4 adapter 주입 전환 대상" 명시.
- `packages/parser/src/ontology-registry.json`의 손해평가사 ID 패턴
  (`CONCEPT-\d{3}` 등) 유지. Year 2에 `exams/{id}/ontology.json` 분리.

**신규 코드는 예외 대상에 포함 금지** — 본 예외는 Year 1 시점에 이미 존재하는
코드에만 적용되며, Phase 1 Step 1-1 이후 신규 작성 코드는 Rule 15 본문을
엄격히 준수한다.

### Hard Rule 16 — 데이터 조회 시 시험 경계 강제 (2단계 선언)

시험 지식 테이블(`user_progress`, `knowledge_nodes`, `knowledge_edges`,
`exam_questions`, `mnemonic_cards`, `formulas`, `constants`,
`topic_clusters`, `revision_changes`)의 데이터 조회는 **시험 경계를 반드시
강제**한다. 경계 강제 방법은 D1 스키마 상태에 따라 2단계로 정의.

**Year 1 (exam_id 컬럼 부재 상태, ADR-007 이월):**

- 모든 데이터 조회 래퍼 함수는 **첫 번째 인자로 `examId: ExamId`**를 받는다
  (예: `findNodesByType(examId, type, ...)`)
- 내부 구현은 Year 1에 실제 `WHERE` 절 없이 동작 가능 (단일 시험)
- Vectorize 업서트/쿼리는 메타데이터 `exam_id` 필수 주입 (ADR-004 §3)
- BATCH 파이프라인은 파일명/폴더/메타데이터에서 `exam_id` 추출 후
  함수 파라미터로 주입 (소스 계층에서 경계 확정)

**Year 2 (exam_id 컬럼 도입 후, 마이그레이션 0005 이후):**

- 동일 래퍼 함수가 내부적으로 `WHERE exam_id = ?` 절 주입
- 호출 측 코드는 **변경 불필요** (시그니처가 Year 1에 이미 examId 포함이므로
  zero-cost 전환)
- Vectorize 쿼리는 `exam_id` 메타데이터 필터 + DB `exam_id` 컬럼 이중 방어

**위반 시그널:** 데이터 조회 함수에 `examId` 파라미터가 없다 = Year 2 전환 시
호출 측 전원 수정 필요 = Rule 16 위반 (Year 1 시점에 이미 위반 판정).

### Hard Rule 17 — 시험 ID 리터럴 단일 선언 + `ExamId` 타입 경유

시험 식별 문자열(`'son-hae-pyeong-ga-sa'` 등)은 **런타임 실행 경로의
리터럴로 최대 1곳** (`packages/shared/src/constants/exam-ids.ts`)에서만
선언한다. 나머지는 `ExamId` 타입(`packages/shared/src/exam-adapter.ts`)
경유 전파.

**"런타임 리터럴"의 정의:**

- 적용 대상: 변수 할당, 함수 인자, 비교 대상, 리턴값, DB 컬럼 값
- **예외 (Rule 적용 제외):**
  - JSDoc / 일반 주석 내 문자열
  - ADR / docs 문서 본문의 예시 / 설명
  - 파일 경로, 디렉토리 명, 패키지 명
  - Ontology registry JSON 파일 내 ID 패턴 정규식
  - 테스트 픽스처 파일(`*.test.ts`, `*.fixture.ts`) 내 예시 데이터

**위반 예시 (금지):**

```typescript
const results = await db.query({ exam_id: 'son-hae-pyeong-ga-sa' });
```

**올바른 예시:**

```typescript
import { EXAM_IDS } from '@thepick/shared';
const results = await db.query({ exam_id: EXAM_IDS.SON_HAE_PYEONG_GA_SA });
```

**검증 방법 (Phase 1 이후):** ESLint `no-restricted-syntax` 규칙으로
`Literal[value='son-hae-pyeong-ga-sa']` AST 패턴을 `exam-ids.ts` 외
파일에서 차단. 경로/주석은 AST 단계에서 자연 제외되므로 별도 allowlist
불필요.

## Hook 연동

- `quality-gate.sh`: PreToolUse(Edit|Write)에서 any, console.log, TODO/HACK, 빈 catch 등 자동 감지
- 경고만 출력 (차단 아님) — 맥락에 따라 허용 가능하나 반드시 사유를 밝힐 것
