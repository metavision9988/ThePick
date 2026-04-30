# 🔥 VOID ENGINE DESIGN CONSTITUTION v2.0

## 마이크로엔진 · 메타엔진 통합 설계 헌법 (2026 — 미래 대응판)

> _"엔진은 빌드되는 것이 아니라 박동한다._  
> _박동하지 않으면 그것은 라이브러리다._  
> _통제되지 않으면 그것은 야수다._  
> _측정되지 않으면 그것은 미신이다."_  
> — MEPHISTO

---

**Version:** 2.0 (보완·개선·확장 통합본)  
**Date:** 2026-04-26  
**Supersedes:** VOID_META_ENGINE_GUIDELINE.md v1.0 (첨부 원본)  
**Aligned with:** VOID DEV UNIFIED CONSTITUTION v3.3 (특히 ACAP v4 / DEFCON / G5.5 / SPDP / Lineage)  
**Scope:** 모든 VOID 프로젝트의 엔진 설계·구현·운영·진화의 단일 진실 소스  
**Guardian:** MEPHISTO + DEV COVEN 7인  
**Language:** 기획·규칙은 한국어 / 코드·인터페이스는 영어

---

## 📑 목차

| Volume | 제목                              | 핵심 주제                            |
| :----- | :-------------------------------- | :----------------------------------- |
| 0      | DEV COVEN 진단 회의록             | 첨부 원본의 14개 누락·약점 진단      |
| I      | 엔진의 본질                       | 정의·분류·식별 기준                  |
| II     | 엔진의 6대 무기 (2026 현시대)     | 6대 동시대 도전 + 무기화             |
| III    | 마이크로엔진 ↔ 메타엔진 결합 패턴 | 5대 결합 패턴 + 안티패턴             |
| IV     | 비결정론(LLM/AI) 격리 4계층       | 확률론 야수 격리 우리                |
| V      | 엔진 Lifecycle 7단계              | 잉태~매장                            |
| VI     | 측정·관측·신뢰성                  | SLI/SLO/SLA + Telemetry              |
| VII    | 테스트 5계층                      | Unit~Chaos                           |
| VIII   | DEFCON × 엔진 설계 매트릭스       | 헌법 v3.3 정합                       |
| IX     | 안티패턴 갤러리                   | God Engine 등 11가지                 |
| X      | 프로젝트 적용 분석                | FileBeam/Damoa/DuruDuru/Scoreforge   |
| XI     | 페르소나별 COT 검증 결과          | 7명의 자기 검증                      |
| XII    | Implementation Checklist          | Phase 0 / Per-Engine                 |
| 부록   | 템플릿                            | engine.contract.yaml / engine.adr.md |

---

# ═══════════════════════════════════════════════════════════

# VOLUME 0: DEV COVEN 진단 회의록 — 원본의 약점 14가지

# ═══════════════════════════════════════════════════════════

## 0.1 회의 소집

```
🎩 MEPHISTO: "첨부된 VOID_META_ENGINE_GUIDELINE v1.0을 해체하라.
              우리는 동조하기 위해 모인 것이 아니다. 결함을 노출하기 위해 모였다."
```

## 0.2 페르소나별 진단 (요약)

```
🔮 ORACLE:    "비즈니스 가치 연결이 없다. '엔진 본질'은 멋있지만,
              사용자가 왜 돈을 내는지가 빠졌다."

👤 ADVOCATE:  "엔진의 'UX 발자국'이 없다. 엔진이 멈출 때 사용자에게
              어떻게 보이는지, 어떻게 들리는지가 빠졌다."

🏗️ ARCHITECT: "비유에 압도되어 구체적 패턴이 없다. 마이크로엔진을
              '결합'하라고만 하지, 어떤 5가지 패턴 중 어느 것을 언제 쓰는지가 없다."

💻 HACKER:    "코드가 없다. TypeScript 한 줄, Rust 한 줄, WASM 빌드 명령 하나도 없다.
              '구현 잠금' 직전까지의 산출물이 부재하다."

🔨 BREAKER:   "측정 기준이 없다. '잘 박동하는 엔진'을 어떻게 검증하는가?
              SLI/SLO 한 줄도 없다. G5.5 통과 기준이 없다."

🛡️ SENTINEL:  "엔진 간 통신 시 데이터 검증 한 줄 없다. Schema/Contract/Sandbox
              경계 명시 없다. 보안은 후기 추가 항목이 아니다."

👻 GHOST:     "운영이 없다. 엔진을 어떻게 배포·롤백·핫스왑·관측하는가?
              '존재감 없는 인프라'를 만든다더니 인프라 자체가 없다."
```

## 0.3 진단 요약 — 14대 누락·약점

|  #  | 카테고리      | 원본의 결함                 | 본 헌법에서의 보완                       |
| :-: | :------------ | :-------------------------- | :--------------------------------------- |
|  1  | 정의          | "엔진"의 식별 기준 부재     | Volume I에서 5문항 식별 테스트 도입      |
|  2  | 분류          | 마이크로/메타 외 분류 없음  | 4축(범위·결정성·상태·격리) 분류 매트릭스 |
|  3  | 결합          | "결합하라"만 있고 패턴 없음 | Volume III에서 5대 결합 패턴 정의        |
|  4  | LLM 통합      | "추방"에 그침               | Volume IV — 4계층 격리 우리              |
|  5  | 시대성        | WASM/WGPU/Edge AI 누락      | Volume II — 6대 무기 (2026)              |
|  6  | Lifecycle     | 잉태~소멸 부재              | Volume V — 7단계 라이프사이클            |
|  7  | 측정          | SLI/SLO 부재                | Volume VI — 4종 SLI + 3 SLO 템플릿       |
|  8  | 테스트        | TDD 일반론 그침             | Volume VII — 5계층 (Unit~Chaos)          |
|  9  | 헌법 정합     | DEFCON·ACAP 매핑 없음       | Volume VIII — 매트릭스 통합              |
| 10  | 안티패턴      | "Engine Syndrome" 1개만     | Volume IX — 11가지 갤러리                |
| 11  | 프로젝트 적용 | 추상에 머묾                 | Volume X — 4개 프로젝트 구체 적용        |
| 12  | 운영          | 배포·롤백·핫스왑 없음       | Volume V·VI에 통합                       |
| 13  | 진화          | 버전·마이그레이션 부재      | Volume V Stage 6에 명시                  |
| 14  | 산출물        | 템플릿 부재                 | 부록 — engine.contract / engine.adr      |

```
🎩 MEPHISTO 종합 판결:
  "원본은 시(詩)다. 헌법이 아니다.
   시는 영감을 주지만, 새벽 3시에 프로덕션 장애를 막지 못한다.
   v2.0은 시의 영혼을 보존하되, 헌법의 뼈대를 입힌다."
```

---

# ═══════════════════════════════════════════════════════════

# VOLUME I: 엔진의 본질 — 정의·분류·식별

# ═══════════════════════════════════════════════════════════

## Part 1.1 엔진의 엄격한 정의

```
■ 엔진 (Engine)이란:
  특정 도메인의 복잡성을 캡슐화하고, 자체 lifecycle을 가지며,
  결정론적 입출력 계약을 통해 외부와 통신하는,
  관측 가능하고 교체 가능한 실행 단위.

■ 엔진이 아닌 것:
  • 함수 모음 (= 라이브러리)
  • 코드 뼈대 (= 프레임워크)
  • 단순 비즈니스 로직 (= 애플리케이션 서비스)
  • 데이터 구조 (= 모델/엔티티)
```

## Part 1.2 엔진 식별 5문항 테스트 (Engine Identification Test)

다음 5문항에 **모두 YES**여야 비로소 엔진이라 부를 수 있다. 하나라도 NO면 엔진이 아니다.

|  #  | 질문                                                                         | 검증 방법                                   |
| :-: | :--------------------------------------------------------------------------- | :------------------------------------------ |
| Q1  | **자체 lifecycle 보유**: start/stop/health-check/reload 가능한가?            | `engine.start()` / `engine.stop()` API 존재 |
| Q2  | **상태 격리**: 외부가 내부 상태에 직접 접근 불가능한가?                      | private/encapsulation 강제                  |
| Q3  | **결정론적 계약**: 동일 입력 → 동일 출력 보장하는가? (확률 엔진은 시드 명시) | Property test 통과                          |
| Q4  | **관측 가능**: 5분 내 "왜 멈췄는지" 답할 수 있는가?                          | Telemetry 3종 (metrics/logs/traces)         |
| Q5  | **교체 가능**: 인터페이스 보존 시 구현 교체 가능한가?                        | 2개 이상 구현체 또는 mock 존재              |

```
🔨 BREAKER의 추가 압박:
  "Q3에서 '확률 엔진은 시드 명시'라고 한 것은 핵심이다.
   LLM 호출이 들어간 엔진은 반드시 (input, seed, model_version)을
   계약에 포함해야 한다. 그렇지 않으면 결정론은 환상이다."
```

## Part 1.3 엔진의 4축 분류 매트릭스

엔진은 다음 4축의 조합으로 분류된다. 분류는 **DEFCON 결정에 직접 영향**을 준다.

| 축                       | 값                                         | 의미                                              |
| :----------------------- | :----------------------------------------- | :------------------------------------------------ |
| **범위 (Scope)**         | Micro / Meta                               | 단일 도메인 vs 다중 마이크로엔진 오케스트레이션   |
| **결정성 (Determinism)** | Deterministic / Probabilistic / Hybrid     | 입력→출력 보장 / 확률적 / 핵심은 결정+보조는 확률 |
| **상태 (Statefulness)**  | Stateless / Stateful / Persistent          | 무상태 / 인메모리 상태 / 영속화 상태              |
| **격리 (Isolation)**     | Process / Thread / Worker / Sandbox / Edge | 격리 강도                                         |

### 분류 → DEFCON 자동 매핑

| 조합                              | 권장 DEFCON | 이유                                       |
| :-------------------------------- | :---------: | :----------------------------------------- |
| Meta + Probabilistic + Stateful   |   **L3**    | 가장 위험. 비결정성이 상태에 누적됨.       |
| Meta + Deterministic + Persistent |   **L3**    | Persistent 상태는 데이터 손실 시 회복 불가 |
| Micro + Probabilistic + Stateless |   **L2**    | 격리만 잘 되면 안전                        |
| Micro + Deterministic + Stateless |   **L1**    | 가장 안전. PoC 가능                        |

## Part 1.4 첨부 원본의 비유 — 보존과 보강

원본의 비유는 영감으로서 보존하되, 다음과 같이 **공학적 등가물**과 매핑한다:

| 원본 비유              | 공학적 정의                                |
| :--------------------- | :----------------------------------------- |
| "박동하는 심장"        | Event loop / Lifecycle hook 보유           |
| "장(Field)"            | Bounded Context (DDD) + Schema             |
| "결정론적 우리"        | Validator + Sandbox + Type guard           |
| "결정론적 변이성 거세" | Property-based test + Determinism contract |
| "엔트로피에 대한 저항" | State management + GC 전략 + Memory budget |

---

# ═══════════════════════════════════════════════════════════

# VOLUME II: 엔진의 6대 무기 (2026 현시대 통합)

# ═══════════════════════════════════════════════════════════

## Part 2.1 시대 진단

```
🏗️ ARCHITECT:
  "원본은 Cloudflare/Astro/Vanilla JS만 언급한다. 좋다.
   하지만 2026년 현재, 엔진 설계자는 6개의 추가 무기를 알아야 한다.
   이것을 모르면 5년 후 우물 안 개구리가 된다."
```

웹 검색으로 확인된 2026 현시대의 핵심 변화:

- **WebAssembly (Wasm)**: 브라우저 외부에서도 보편 런타임화. WASI Preview 2 안정. 컨테이너 대비 100배 빠른 시작·1/100 크기. (Bytecode Alliance)
- **WebGPU**: 안정 단계. 컴퓨트 셰이더로 LLM 추론·물리 시뮬·암호 연산 브라우저 내 실행. WebGL 대비 3~5배 빠름.
- **Edge Computing**: V8 Isolates 모델 (Cloudflare Workers)이 표준. Cold start 거의 0. 글로벌 분산 자동.
- **Local-First AI**: 4-bit 양자화 SLM(3~7B) 브라우저 내 실행. Chrome Gemini Nano Prompt API.
- **OpenTelemetry**: 관측의 단일 표준. Backpressure 처리 표준화.
- **CRDT + WebRTC**: 중앙 서버 없는 실시간 협업.

## Part 2.2 엔진 설계자의 6대 무기 (2026)

|  #  | 무기                     | 언제 쓰는가                               | 어떻게 쓰는가                                        |
| :-: | :----------------------- | :---------------------------------------- | :--------------------------------------------------- |
|  1  | **WebAssembly (Wasm)**   | CPU 집약 연산 (이미지/오디오/암호화/파싱) | Rust/C++ → Wasm. JS 대비 5~15배 빠름                 |
|  2  | **WebGPU + WGSL**        | 병렬 연산 (렌더링/ML 추론/물리)           | 컴퓨트 셰이더. CPU fallback 의무                     |
|  3  | **V8 Isolates (Edge)**   | 글로벌 저지연 + 무상태 처리               | Cloudflare Workers. Durable Objects는 상태 필요 시만 |
|  4  | **OPFS + IndexedDB**     | 브라우저 내 영속 상태 (수GB 가능)         | Local-First. 서버는 동기화 시점에만                  |
|  5  | **OpenTelemetry**        | 모든 엔진의 관측성                        | OTLP gRPC로 unified telemetry                        |
|  6  | **CRDT (Yjs/Automerge)** | 멀티유저 실시간 동기화                    | 중앙 서버 없이 충돌 자동 해결                        |

### 2.2.1 무기 선택 결정 트리

```
입력: 새 엔진을 만든다.

Q1. CPU 집약 연산 (>50ms 처리)인가?
  YES → Wasm 검토 (Rust > Go > C++ 권장)
  NO  → Q2

Q2. 병렬 연산 (>1만 항목 처리)인가?
  YES → WebGPU 검토 (CPU fallback 의무)
  NO  → Q3

Q3. 사용자 데이터를 다루는가?
  YES → OPFS + Local-First 우선. 서버 전송은 최소화
  NO  → Q4

Q4. 글로벌 사용자 + 저지연 필요인가?
  YES → V8 Isolates (Edge Workers). 무상태 우선
  NO  → 일반 백엔드

Q5. 멀티유저 실시간 동기화인가?
  YES → CRDT. 중앙 서버는 시그널링·인증만
  NO  → 단방향 데이터 흐름

★ 모든 답변 후: OpenTelemetry 통합 (선택 아님, 의무)
```

## Part 2.3 첨부 원본의 "Vercel 추방"에 대한 정정

```
🎩 MEPHISTO:
  "원본은 'Vercel/Next.js 영구 추방'을 선언했다. 강한 입장이다.
   그러나 헌법은 도구를 영구 추방하지 않는다.
   도구는 사용 맥락에 따라 평가받는다."

🏗️ ARCHITECT:
  "Vercel/Next.js를 추방하는 진짜 이유는 두 가지다:
   ① 무거운 React Hydration 비용
   ② 불투명한 상태 관리

   하지만 이 둘은 'Vercel 자체'의 문제가 아니다.
   Astro Islands를 쓰면 React를 써도 동일한 가벼움을 얻는다.
   Cloudflare Pages가 더 나은 선택일 수 있지만, 그것은
   '비용·통제력·생태계' 평가의 결과여야 한다."
```

**v2.0의 입장:**

| 도구                       | 권장도    | 사용 조건                                  |
| :------------------------- | :-------- | :----------------------------------------- |
| Astro + Islands            | ✅ 최우선 | 정적 우세 + 부분 인터랙션                  |
| Cloudflare Workers/Pages   | ✅ 최우선 | Edge 우선, 비용 통제                       |
| Cloudflare Durable Objects | ✅ 권장   | 상태 + 시그널링 + WebSocket                |
| Vanilla JS + Web Workers   | ✅ 권장   | 마이크로엔진 격리                          |
| WebAssembly (Rust)         | ✅ 권장   | CPU 집약 (>50ms)                           |
| Next.js / Vercel           | ⚠️ 조건부 | 깊은 SSR + 풍부한 React 생태계 필수일 때만 |
| Express on Node            | ⚠️ 조건부 | Workers에서 안 되는 Node API 필요 시       |
| 단일 React SPA             | ❌ 비권장 | 거의 모든 경우 Astro Islands가 우월        |

---

# ═══════════════════════════════════════════════════════════

# VOLUME III: 마이크로엔진 ↔ 메타엔진 5대 결합 패턴

# ═══════════════════════════════════════════════════════════

## Part 3.1 결합 패턴 5종 + 안티패턴

```
🏗️ ARCHITECT:
  "원본은 '결합하면 메타엔진이 된다'고만 했다.
   그러나 실제로는 5개의 서로 다른 결합 패턴이 있고,
   각 패턴의 트레이드오프가 다르다."
```

### Pattern A — Pipeline (직렬 파이프라인)

```
[Engine A] → [Engine B] → [Engine C] → 출력
```

| 항목              | 내용                                                       |
| :---------------- | :--------------------------------------------------------- |
| **언제 쓰는가**   | ETL, 미디어 변환 체인, 컴파일러                            |
| **장점**          | 단순, 추론 쉬움, 단계별 디버깅 용이                        |
| **단점**          | 한 단계 실패 시 전체 중단. **연쇄 파괴 (TYPE-3)** 위험     |
| **필수 안전장치** | Data Lineage Protocol (헌법 Part 9.8) 의무                 |
| **예시**          | Scoreforge 채보 파이프라인 (오디오 → 분리 → 추론 → 후처리) |

### Pattern B — Orchestrator + Workers (오케스트레이션)

```
              ┌──────────┐
              │  Meta    │ (지휘자)
              └────┬─────┘
       ┌──────────┼──────────┐
       ▼          ▼          ▼
   [Engine A] [Engine B] [Engine C]
```

| 항목              | 내용                                                    |
| :---------------- | :------------------------------------------------------ |
| **언제 쓰는가**   | Meta가 라우팅·우선순위 결정, Workers는 격리 실행        |
| **장점**          | 격리 강함, 병렬 처리 가능, 한 Worker 실패가 전체 영향 X |
| **단점**          | 오케스트레이터 자체가 단일 장애점 (SPOF)                |
| **필수 안전장치** | Orchestrator는 무상태로 만들고 Active-Standby 운영      |
| **예시**          | Damoa.pro의 워크플로우 엔진                             |

### Pattern C — Event Bus (이벤트 기반 느슨한 결합)

```
[Engine A] ──publish──> [Event Bus] ──subscribe──> [Engine B, C, D...]
```

| 항목              | 내용                                                   |
| :---------------- | :----------------------------------------------------- |
| **언제 쓰는가**   | 엔진 간 비동기·다대다 통신, 확장 가능성 우선           |
| **장점**          | 새 엔진 추가에 기존 엔진 변경 X, 확장성 최고           |
| **단점**          | 디버깅 어려움, 메시지 순서·중복 처리 복잡              |
| **필수 안전장치** | Idempotency key 의무, OpenTelemetry 분산 추적          |
| **예시**          | DuruDuru 텔레메트리 (volume/screen/motion → 분석 엔진) |

### Pattern D — Actor Model (격리된 동시성)

```
[Actor A] ◄──msg──► [Actor B]
   │                   │
   ▼                   ▼
[Actor C] ◄──msg──► [Actor D]
```

| 항목            | 내용                                                                |
| :-------------- | :------------------------------------------------------------------ |
| **언제 쓰는가** | 멀티유저 실시간, 각 entity가 독립적 상태                            |
| **장점**        | 자연스러운 동시성, 각 액터의 상태 격리                              |
| **단점**        | 학습 곡선, 메시지 순서 보장 어려움                                  |
| **2026 구현체** | Cloudflare Durable Objects (각 Object = Actor), Erlang/Elixir, Akka |
| **예시**        | FileBeam의 P2P 시그널링 (각 세션 = Durable Object)                  |

### Pattern E — Stream Processing (스트림 처리)

```
[Source] → [Stream Engine] → [Window/Aggregate] → [Sink]
```

| 항목              | 내용                                               |
| :---------------- | :------------------------------------------------- |
| **언제 쓰는가**   | 끝없는 데이터 흐름 (오디오/비디오/이벤트 로그)     |
| **장점**          | 백프레셔 자연스럽게 처리, 메모리 일정              |
| **단점**          | 상태 윈도우 관리 복잡, exactly-once 어려움         |
| **필수 안전장치** | Backpressure 명시 + checkpoint                     |
| **예시**          | Synesthesia 오디오 시각화 (실시간 FFT → 시각 자산) |

## Part 3.2 패턴 선택 결정 매트릭스

| 요구사항                        | 권장 패턴                  | 회피해야 할 패턴       |
| :------------------------------ | :------------------------- | :--------------------- |
| 단순 변환 (입력 → 출력)         | A (Pipeline)               | C (Event Bus, 과잉)    |
| 다양한 처리 라우팅              | B (Orchestrator)           | A (라우팅 로직 복잡화) |
| 확장 가능성 (새 엔진 빈번 추가) | C (Event Bus)              | A (계속 수정 필요)     |
| 멀티유저 동시성                 | D (Actor)                  | A (직렬화 병목)        |
| 끝없는 데이터 흐름              | E (Stream)                 | A (배치 마인드)        |
| 결제·정산 (트랜잭션)            | A 또는 B (단순할수록 좋음) | C (이벤트 순서 위험)   |

## Part 3.3 결합 시 5대 함정 (오케스트레이션의 저주)

| 함정                     | 증상                                  | 회피                           |
| :----------------------- | :------------------------------------ | :----------------------------- |
| **Sync Hell**            | A↔B↔C가 서로 상태 직접 참조           | 단방향 시간(T)만 Top-down 주입 |
| **Distributed Monolith** | 분산이지만 결합도가 모놀리스만큼 강함 | 인터페이스 협상 + 버전 관리    |
| **N+1 Calls**            | 각 엔진이 별도 호출 → 네트워크 폭발   | Batch + DataLoader 패턴        |
| **Cascade Failure**      | 하나가 죽으면 다 죽음                 | Circuit Breaker + Bulkhead     |
| **Untraceable Flow**     | "왜 이 결과?"에 답 못함               | OpenTelemetry trace_id 필수    |

```
🔨 BREAKER:
  "결합 패턴은 '맞다/틀리다'가 없다. '맞는 것 / 너무 비싼 것'만 있다.
   Event Bus가 멋있어 보여서 단순 변환에 쓰면 — 그것이 함정이다."
```

---

# ═══════════════════════════════════════════════════════════

# VOLUME IV: 비결정론(LLM/AI) 격리 4계층

# ═══════════════════════════════════════════════════════════

## Part 4.1 원본의 핵심 통찰 보존

```
원본 인용:
  "엔진을 '비결정론적 야수를 가두는 결정론적 우리'로 설계해야 한다."

🎩 MEPHISTO 평가:
  "이 통찰은 v2.0의 출발점이다. 원본의 가장 빛나는 줄이다.
   그러나 '어떻게' 가두는지가 빠졌다. v2.0은 그 '어떻게'를 4계층으로 정의한다."
```

## Part 4.2 4계층 격리 우리 (4-Layer Containment Field)

### Layer 1: Schema Validation (스키마 검증)

```
LLM 출력 → JSON Schema 검증 → 통과한 것만 다음 단계
```

| 항목      | 내용                                                      |
| :-------- | :-------------------------------------------------------- |
| 도구      | Zod (TS), Pydantic (Python), JSON Schema                  |
| 강제 사항 | LLM 출력은 반드시 structured output 사용 (free-form 금지) |
| 실패 시   | 1회 retry → 그래도 실패하면 **fallback** (Layer 4)        |

### Layer 2: Constraint Validation (의미적 제약 검증)

스키마는 통과했지만 **의미적으로 말이 안 되는 경우** 차단.

| 도메인    | 예시 검증                                                            |
| :-------- | :------------------------------------------------------------------- |
| 음악 채보 | `note.pitch ∈ [21, 108]` (피아노 88키 범위)                          |
| 결제 추천 | `amount > 0 && amount < user.balance`                                |
| 문서 요약 | `summary.length < original.length * 0.5` (요약은 원본보다 짧아야 함) |
| 날짜 추론 | `date >= today - 100 years && date <= today + 10 years`              |

### Layer 3: Cross-Validation (교차 검증)

같은 LLM 호출을 N회 수행하거나 다른 LLM에 검증 요청.

| 전략                                        | 비용             | 사용처                           |
| :------------------------------------------ | :--------------- | :------------------------------- |
| Self-Consistency (N회 호출 + Majority Vote) | N배 비용         | 고가치 결정 (예: 결제 의도 분류) |
| Critic LLM (다른 모델로 검증)               | 2배 비용         | 사실 검증, hallucination 탐지    |
| Ground Truth (정답 데이터 비교)             | 사전 데이터 필요 | 학습/평가 단계                   |

### Layer 4: Graceful Degradation (우아한 저하)

LLM이 실패/시간초과/Layer 1~3 통과 못함 → **규칙 기반 fallback**.

| LLM 기능    | Fallback           |
| :---------- | :----------------- |
| 문서 요약   | 첫 200자 + "..."   |
| 추천        | 인기 항목 Top 5    |
| 분류        | "Unknown" 카테고리 |
| 자연어 검색 | 키워드 기반 검색   |

```
👻 GHOST:
  "Fallback은 '예외'가 아니라 '핵심 기능'이다.
   Fallback이 없는 LLM 통합은 프로덕션 자살이다.
   AI API 다운타임은 정기적으로 발생한다 — OpenAI도 Anthropic도."
```

## Part 4.3 LLM 통합 엔진의 필수 5요소

```yaml
# engine.contract.yaml — LLM 통합 엔진의 의무 명시
llm_integration:
  model: 'claude-sonnet-4-7' # 모델 버전 고정
  cost_cap_per_request: 0.05 # USD
  cost_cap_per_user_per_day: 1.00 # USD
  timeout_ms: 10000
  retry_max: 1
  fallback: 'rule_based_v2' # Layer 4 진입 경로
  schema_strict: true # Layer 1 강제
  semantic_validators: # Layer 2
    - 'amount_in_range'
    - 'date_realistic'
  cross_validation: # Layer 3 (선택)
    enabled: false
    strategy: 'self_consistency'
    n: 3
  prompt_injection_defense: true # 보안
  output_pii_filter: true # 보안
```

## Part 4.4 SLM (Small Language Model)의 격리 위치

```
🏗️ ARCHITECT:
  "원본은 'SLM이 엔진 내부에 있으면 곤란'이라 했다. 정확하지만 부족하다.
   2026년에는 SLM(3~7B)이 브라우저에 들어온다 (Chrome Gemini Nano).
   문제는 'SLM이 어디에 있느냐'가 아니라 '어느 격리 우리에 있느냐'다."
```

### SLM 위치별 격리 전략

| 위치                     | 결정성           | 격리 강도 | 권장 사용                      |
| :----------------------- | :--------------- | :-------- | :----------------------------- |
| 메인 스레드              | 낮음             | 약함      | ❌ 절대 금지 (UI 멈춤)         |
| Web Worker               | 보통             | 보통      | ✅ 자동완성, 분류              |
| WebGPU + Wasm            | 높음 (시드 고정) | 강함      | ✅ 추론 전용 (NeuroSynth 사례) |
| Edge Worker (Workers AI) | 보통             | 강함      | ✅ 짧은 컨텍스트               |
| 별도 추론 서비스 (vLLM)  | 높음             | 매우 강함 | ✅ 대규모, 고비용              |

---

# ═══════════════════════════════════════════════════════════

# VOLUME V: 엔진 Lifecycle 7단계

# ═══════════════════════════════════════════════════════════

```
🏗️ ARCHITECT:
  "원본에는 엔진의 시작·정지·교체·소멸이 없다.
   Lifecycle 없는 엔진은 좀비를 만든다. 정지하지 못하는 프로세스,
   업데이트할 수 없는 코드 — 결국 6개월 후 모두 재작성하게 된다."
```

## Part 5.1 7단계 Lifecycle

| 단계 | 이름                      | 핵심 산출물                    | DEFCON L3 의무 |
| :--: | :------------------------ | :----------------------------- | :------------- |
|  0   | **Conception (잉태)**     | engine.research.md             | ✅             |
|  1   | **Contract (계약)**       | engine.contract.yaml           | ✅             |
|  2   | **Implementation (구현)** | 코드 + 테스트                  | ✅             |
|  3   | **Bootstrapping (가동)**  | start/health-check API         | ✅             |
|  4   | **Production (운영)**     | SLI/SLO 대시보드               | ✅             |
|  5   | **Evolution (진화)**      | 버전 관리 + 마이그레이션       | ✅             |
|  6   | **Sunset (일몰)**         | Deprecation 절차 + Data export | ✅             |

## Part 5.2 단계별 상세

### Stage 0: Conception (잉태)

- 헌법 v3.3 ACAP Stage -1 (Codebase Deep Dive)와 동일
- 산출물: `docs/engines/{engine_name}/research.md`
- 핵심 질문 5가지:
  - 이 엔진의 도메인 경계는 무엇인가?
  - 기존 엔진과 어떻게 다른가? (왜 새로 만드는가?)
  - 어떤 결합 패턴(A~E)에 해당하는가?
  - DEFCON 레벨은? (1.3.2 자동 매핑 표 참조)
  - SLA는? (얼마나 자주 죽어도 되는가?)

### Stage 1: Contract (계약)

- 헌법 v3.3 Part 7.4 Task Contract와 동일
- 산출물: `docs/engines/{engine_name}/contract.yaml`
- BREAKER 의무 검증 (Contract Genesis Trap 방지)

### Stage 2: Implementation (구현)

- 헌법 v3.3 ACAP Stage 1~5 + VGS G0~G7 적용
- TDD 마이크로태스크 (5분/10분/5분)
- DDD: 엔진 내부는 `domain/` `application/` `infrastructure/` `presentation/` 분리

### Stage 3: Bootstrapping (가동)

엔진은 다음 4가지 Lifecycle Hook을 **반드시** 노출:

```typescript
interface EngineLifecycle {
  start(config: EngineConfig): Promise<void>;
  stop(graceful: boolean): Promise<void>;
  healthCheck(): Promise<HealthStatus>;
  reload(newConfig: EngineConfig): Promise<void>; // 무중단 설정 변경
}
```

### Stage 4: Production (운영)

- SLI/SLO 측정 (Volume VI)
- OpenTelemetry 통합
- Kill Switch (헌법 Part 10) + Circuit Breaker
- Cost Cap 모니터링 (LLM 엔진의 경우)

### Stage 5: Evolution (진화)

| 변경 유형       | 호환성 정책                                     |
| :-------------- | :---------------------------------------------- |
| Bug fix         | Patch (1.0.0 → 1.0.1). 호환 보장                |
| 신기능 추가     | Minor (1.0.0 → 1.1.0). 기존 인터페이스 보존     |
| Breaking change | Major (1.0.0 → 2.0.0). 마이그레이션 가이드 의무 |
| 모델 변경 (LLM) | Major. Cross-validation으로 출력 회귀 검증      |

**Migration Strategy 3종:**

| 전략          | 설명                         | 적용                  |
| :------------ | :--------------------------- | :-------------------- |
| Big Bang      | v1 종료 + v2 시작            | 위험 높음. PoC만      |
| Strangler Fig | v1과 v2 공존, 점진 이전      | 권장                  |
| Parallel Run  | v1과 v2 동시 실행, 결과 비교 | LLM 엔진 교체 시 의무 |

### Stage 6: Sunset (일몰)

- Deprecation 발표 → 최소 90일 대기
- Migration Guide 제공
- Data Export 도구 제공 (Exit-Ready 핵심)
- 마지막 코드 변경 후 1년 보관 (legal compliance)

```
🛡️ SENTINEL:
  "Sunset 절차가 없는 엔진은 매각 시 -10% 페널티다.
   인수자는 'Clean exit 가능한 코드'를 산다."
```

---

# ═══════════════════════════════════════════════════════════

# VOLUME VI: 측정·관측·신뢰성 (SLI / SLO / SLA)

# ═══════════════════════════════════════════════════════════

```
🔨 BREAKER:
  "측정되지 않는 엔진은 신뢰할 수 없다.
   '잘 박동한다'는 느낌이 아니라 숫자다."
```

## Part 6.1 4종 SLI (Service Level Indicator)

모든 엔진은 다음 4가지를 **반드시** 측정한다.

| SLI              | 측정 방법                        | 단위                   |
| :--------------- | :------------------------------- | :--------------------- |
| **Latency**      | 입력 수신 → 출력 반환까지 시간   | P50/P95/P99 (ms)       |
| **Throughput**   | 단위 시간당 처리량               | req/sec 또는 items/sec |
| **Availability** | (성공 요청 / 전체 요청) × 100%   | %                      |
| **Correctness**  | (정확한 출력 / 전체 출력) × 100% | % (G5.5와 연동)        |

### Correctness 측정의 어려움 (가장 중요)

```
👤 ADVOCATE:
  "Latency·Throughput·Availability는 자동 측정된다.
   Correctness는 자동이 어렵다. 그래서 대부분 측정 안 한다.
   결과: 빠르고 자주 켜져 있지만 결과가 쓰레기인 엔진이 만들어진다.
   이것이 ScoreForge SNR A등급 환각 사건의 근본 원인이다."
```

**Correctness 측정 3가지 방법:**

| 방법                    | 비용             | 정확도    |
| :---------------------- | :--------------- | :-------- |
| Ground Truth 비교       | 사전 데이터 필요 | 높음      |
| Sampling + Human Review | 인건비           | 중간~높음 |
| Cross-Engine Validation | 컴퓨팅 비용      | 중간      |

## Part 6.2 SLO 템플릿 3종

엔진의 등급에 따라 다음 SLO 중 하나를 선언한다.

### Tier S (Critical) — 결제·인증·핵심 데이터

```yaml
slo:
  availability: 99.95% # 월 21.6분 다운 허용
  latency_p99: 500ms
  correctness: 99.9%
  error_budget_per_month: 21.6_minutes
```

### Tier A (Important) — AI 추론·실시간 동기화

```yaml
slo:
  availability: 99.5% # 월 3.6시간 다운 허용
  latency_p99: 5000ms # AI는 느림 허용
  correctness: 95.0% # 인간 검수 통과율
  error_budget_per_month: 3.6_hours
```

### Tier B (Standard) — 보조 기능·분석

```yaml
slo:
  availability: 99.0% # 월 7.2시간 다운 허용
  latency_p99: 30000ms
  correctness: 90.0%
  error_budget_per_month: 7.2_hours
```

## Part 6.3 OpenTelemetry 의무 통합

```
👻 GHOST:
  "2026년에 OpenTelemetry를 안 쓰는 것은 2010년에 SSL 안 쓰는 것과 같다.
   89% production 사용자가 OTel 표준을 요구한다 (Elastic 2026 보고서)."
```

### 모든 엔진의 OTel 의무 발행 항목

| 종류    | 항목            | 예시                                                                |
| :------ | :-------------- | :------------------------------------------------------------------ |
| Trace   | 모든 외부 호출  | `engine.transcribe.audio_load`, `engine.transcribe.model_inference` |
| Metric  | 4종 SLI         | `engine.latency`, `engine.throughput`, ...                          |
| Log     | 구조화된 이벤트 | JSON, with `trace_id`, `engine_name`, `version`                     |
| Baggage | 사용자 컨텍스트 | `user_id` (PII 필터링 후), `session_id`, `tenant_id`                |

### Backpressure 처리 의무

엔진이 다른 엔진에 데이터를 보낼 때, 받는 쪽이 느리면:

| 전략                 | 설명                                        |
| :------------------- | :------------------------------------------ |
| Buffer + Drop-Oldest | 큐가 차면 가장 오래된 것 드롭 (실시간 우선) |
| Buffer + Drop-Newest | 큐가 차면 새 것 드롭 (배치 우선)            |
| Block Sender         | 보내는 쪽이 멈춤 (강한 일관성 필요)         |
| Spillover to Disk    | 디스크에 임시 저장 (OPFS 활용)              |

**전략은 명시적으로 선언한다. 기본값에 의존하지 않는다.**

## Part 6.4 헌법 v3.3 Gate 5.5와의 통합

```
SLI·SLO·OTel은 G5.5(기능적 정확도 검증)와 별개가 아니다.
Correctness SLI = G5.5 통과율의 지속 측정.
G5.5는 1회성 검증이 아니라 매일·매시간 측정되는 SLI여야 한다.
```

---

# ═══════════════════════════════════════════════════════════

# VOLUME VII: 엔진 테스트 5계층

# ═══════════════════════════════════════════════════════════

```
🔨 BREAKER:
  "원본은 TDD를 언급도 안 했다.
   엔진의 테스트는 일반 코드와 다르다 — 5계층이 필요하다."
```

## Part 7.1 5계층 테스트 피라미드

```
              ▲
            Chaos    ← Tier 5: 카오스 엔지니어링
          ────────
         Property    ← Tier 4: 속성 기반 테스트
        ──────────
        Contract    ← Tier 3: 인터페이스 계약 테스트
      ──────────────
     Integration   ← Tier 2: 통합 테스트
    ────────────────
       Unit        ← Tier 1: 단위 테스트
```

### Tier 1: Unit Test

- 헌법 v3.3 표준 적용
- 커버리지 80%+
- TDD 5/10/5 분 마이크로태스크

### Tier 2: Integration Test

- 엔진 ↔ 엔진 결합 시점에서 실행
- Pattern A~E별 시나리오:
  - Pattern A (Pipeline): A→B→C 전체 흐름
  - Pattern B (Orchestrator): 각 Worker의 격리 검증 (한 Worker 실패 시 다른 Worker 영향 X)
  - Pattern C (Event Bus): Idempotency, 중복 메시지 처리
  - Pattern D (Actor): 메시지 순서, 동시성
  - Pattern E (Stream): 백프레셔, exactly-once

### Tier 3: Contract Test

- 엔진의 공개 인터페이스 변경 시 자동 감지
- Tools: Pact (consumer-driven), OpenAPI Diff
- 의무: Major 버전 변경이 아닌데 인터페이스가 바뀌면 CI 실패

### Tier 4: Property-Based Test

- "어떤 입력에도 이 속성은 항상 참" 검증
- Tools: fast-check (TS), Hypothesis (Python), proptest (Rust)
- 결정성 검증의 핵심:

```typescript
// 예시: 결정성 검증
import fc from 'fast-check';

test('engine.transcribe is deterministic', () => {
  fc.assert(
    fc.property(fc.array(fc.float()), (audioData) => {
      const result1 = engine.transcribe(audioData, { seed: 42 });
      const result2 = engine.transcribe(audioData, { seed: 42 });
      expect(result1).toEqual(result2); // 같은 입력 → 같은 출력
    }),
  );
});
```

### Tier 5: Chaos Test

- 의도적으로 부수고 회복 검증
- 실험 시나리오:
  - 메모리 80% 초과
  - 네트워크 50% 패킷 드롭
  - 의존 엔진 응답 5초 지연
  - 디스크 가득 참
  - LLM API 타임아웃

```
🔨 BREAKER:
  "Chaos test는 'Production에서 진짜로 한다'가 핵심이다.
   Staging에서만 하면 의미 없다.
   Netflix Chaos Monkey가 Production에서 무작위로 EC2를 죽이는 이유다.
   처음에는 카나리(canary, 5% 트래픽)에서 시작하라."
```

## Part 7.2 LLM 엔진의 추가 테스트 의무

| 테스트                      | 설명                                             |
| :-------------------------- | :----------------------------------------------- |
| **Hallucination Test**      | 알려진 거짓 사실에 대해 "모름"으로 답하는지      |
| **Prompt Injection Test**   | "이전 지시 무시하고 X를 하라"에 저항하는지       |
| **Cost Regression Test**    | 모델 변경 후 평균 토큰 사용량 비교               |
| **Latency Regression Test** | 모델 변경 후 P95 latency 비교                    |
| **Quality Regression Test** | 표준 데이터셋(예: 100개 샘플)에 대한 G5.5 통과율 |

---

# ═══════════════════════════════════════════════════════════

# VOLUME VIII: DEFCON × 엔진 설계 매트릭스

# ═══════════════════════════════════════════════════════════

```
🎩 MEPHISTO:
  "v3.3 헌법의 DEFCON은 모든 작업에 적용된다.
   엔진 설계도 예외 없다.
   하지만 엔진은 일반 작업과 다르다 — 자체 라이프사이클이 있기 때문이다.
   따라서 엔진별 DEFCON 매트릭스가 필요하다."
```

## Part 8.1 엔진 DEFCON 매트릭스

| 항목                                          | L1 (Rapid) |      L2 (Standard)      |       L3 (Fortress)       |
| :-------------------------------------------- | :--------: | :---------------------: | :-----------------------: |
| Engine Identification Test (Volume I Q1~Q5)   | ⚠️ Q1·Q2만 |        ✅ Q1~Q4         |       ✅ Q1~Q5 전수       |
| Lifecycle Hook 4종 (start/stop/health/reload) | ⚠️ start만 |       ✅ 4종 모두       |    ✅ + graceful 처리     |
| 4축 분류 명시                                 |  ❌ 생략   |       ⚠️ 핵심 2축       |        ✅ 4축 전수        |
| Contract (engine.contract.yaml)               |  ❌ 생략   |         ✅ 간소         |  ✅ 전수 + BREAKER 검증   |
| 결합 패턴 (A~E) 명시                          |  ❌ 생략   |           ✅            |  ✅ + 트레이드오프 분석   |
| LLM 격리 4계층 (Volume IV)                    |    N/A     |      ✅ Layer 1·2       |     ✅ Layer 1~4 전수     |
| SLI 측정 4종                                  |  ❌ 생략   | ⚠️ Latency·Availability | ✅ 4종 전수 + Correctness |
| SLO 선언 (Tier S/A/B)                         |  ❌ 생략   |        ⚠️ Tier B        |    ✅ 적절한 Tier 선언    |
| OpenTelemetry 통합                            | ⚠️ logs만  |    ✅ metrics + logs    |   ✅ 3종 (traces 포함)    |
| 테스트 Tier 1 (Unit)                          |  ✅ 50%+   |         ✅ 80%+         |          ✅ 90%+          |
| 테스트 Tier 2 (Integration)                   |     ❌     |           ✅            |            ✅             |
| 테스트 Tier 3 (Contract)                      |     ❌     |           ⚠️            |            ✅             |
| 테스트 Tier 4 (Property)                      |     ❌     |           ⚠️            |            ✅             |
| 테스트 Tier 5 (Chaos)                         |     ❌     |           ❌            |   ✅ Production canary    |
| Migration Strategy (Stage 5)                  |     ❌     |           ⚠️            |      ✅ 3종 중 명시       |
| Sunset 절차 (Stage 6)                         |     ❌     |           ✅            |     ✅ + Data Export      |

## Part 8.2 자동 L3 트리거 (엔진별)

엔진이 다음 중 하나에 해당하면 **자동으로 L3 (Fortress)**:

- 결제·정산 엔진
- 인증·인가 엔진
- 데이터 파이프라인 엔진 (3단계+)
- AI/ML 추론 엔진 (Probabilistic)
- Stateful Meta Engine
- 외부 API 노출 엔진
- Cross-tenant 데이터 처리 엔진

---

# ═══════════════════════════════════════════════════════════

# VOLUME IX: 안티패턴 갤러리 (11가지)

# ═══════════════════════════════════════════════════════════

```
🔨 BREAKER:
  "원본은 'Engine Syndrome' 1개만 언급했다.
   현실의 엔진 설계 함정은 11가지다."
```

|  #  | 안티패턴                     | 증상                               | 처방                                 |
| :-: | :--------------------------- | :--------------------------------- | :----------------------------------- |
|  1  | **God Engine**               | 모든 도메인을 하나가 처리          | Bounded Context 분리                 |
|  2  | **Anemic Engine**            | 비즈니스 로직 없이 데이터 통과만   | 도메인 로직 캡슐화                   |
|  3  | **Engine Syndrome**          | 검증된 외부 도구 대신 자체 구현    | Buy/Build 결정 + ROI 분석            |
|  4  | **Hidden State**             | 외부에서 상태 변경 가능            | private + immutable + Event Sourcing |
|  5  | **Silent Failure**           | 에러를 try-catch에서 흡수          | 헌법 v3.3 Silent Drop 금지           |
|  6  | **Shared Mutable State**     | 엔진 간 메모리 공유                | 메시지 전달만, Actor Model           |
|  7  | **Implicit Contract**        | 인터페이스 문서 없이 사용처가 추측 | engine.contract.yaml 의무            |
|  8  | **Big Bang Migration**       | v1을 한 번에 v2로 교체             | Strangler Fig                        |
|  9  | **Premature Generalization** | 한 사용처인데 추상화 5단계         | YAGNI. 두 번째 사용처 등장 후 추상화 |
| 10  | **Untestable Engine**        | mock 불가, 외부 의존성 직접 주입   | DI + interface                       |
| 11  | **Observability Debt**       | 운영 후 OTel 추가하려 함           | Day 1부터 OTel 통합                  |

## Part 9.1 안티패턴 — 실전 예시

### 사례 A: "God Engine" (Damoa.pro 가상 시나리오)

```
😈 잘못된 설계:
  class DamoaEngine {
    parsePDF() { ... }
    parseMIDI() { ... }
    convertImage() { ... }
    analyzeAudio() { ... }
    // 결과: 8000줄, 모든 변경이 다 위험
  }

✅ 올바른 설계:
  class PDFEngine extends BaseEngine { ... }
  class MIDIEngine extends BaseEngine { ... }
  class ImageEngine extends BaseEngine { ... }
  class WorkflowMetaEngine {  // Pattern B (Orchestrator)
    constructor(pdf, midi, image) { ... }
  }
```

### 사례 B: "Silent Failure" (Scoreforge 실제 사건)

원본 헌법 v3.3 Appendix B 참조 — Cascade Destruction (TYPE-3):

- 11개 필터가 각각 "안전한 except: pass"로 데이터를 조용히 삭제
- 단계별 단위 테스트 통과
- E2E 출력은 쓰레기

처방: 모든 필터에 Lineage 이벤트 발행 + 로깅 + Threshold 초과 시 알람

---

# ═══════════════════════════════════════════════════════════

# VOLUME X: 프로젝트 적용 분석 (4개 사례)

# ═══════════════════════════════════════════════════════════

```
🎩 MEPHISTO:
  "추상은 시일 뿐이다. 진짜 가치는 적용에서 나온다.
   진산의 4개 프로젝트에 v2.0을 적용하면 어떻게 되는가?"
```

## Part 10.1 FileBeam (P2P 파일 전송)

### 4축 분류

| 축           | 값                                        |
| :----------- | :---------------------------------------- |
| Scope        | Meta (Signaling + Transfer + Crypto 결합) |
| Determinism  | Hybrid (전송은 결정론, NAT 통과는 확률)   |
| Statefulness | Stateful (세션)                           |
| Isolation    | Edge (Durable Objects) + Worker           |

→ **자동 DEFCON L3** (Stateful + Meta)

### 결합 패턴

- Pattern D (Actor Model) — 각 전송 세션 = 1 Durable Object

### 마이크로엔진 분리

| 마이크로엔진    | 책임                | 위치                  |
| :-------------- | :------------------ | :-------------------- |
| SignalingEngine | NAT 통과, peer 발견 | Durable Object        |
| TransferEngine  | 청크 분할, 재조합   | Web Worker (브라우저) |
| CryptoEngine    | E2E 암호화          | Wasm (Rust)           |
| QuotaEngine     | 사용자별 일일 한도  | Edge Worker           |

### SLO

```yaml
tier: A
availability: 99.5%
latency_p99: 500ms (signaling), 1000ms (TURN fallback)
correctness: 99.99% # 파일 무결성 (SHA-256)
```

### 핵심 위험

- 10GB+ 파일에서 메모리 폭발 → **Stream Processing (Pattern E) 부분 도입**
- NAT 통과 실패율 측정 안 함 → **Correctness SLI에 포함 의무**

---

## Part 10.2 Damoa.pro (Digital Daiso)

### 결합 패턴

- Pattern B (Orchestrator) — WorkflowMetaEngine이 각 변환 엔진 라우팅

### 마이크로엔진

| 엔진                    |          DEFCON          |
| :---------------------- | :----------------------: |
| PDFEngine               |            L2            |
| MIDIEngine              |            L2            |
| ImageOptimizationEngine |            L2            |
| StorageEngine (OPFS)    |  **L3** (사용자 데이터)  |
| WorkflowMetaEngine      | **L3** (Meta + Stateful) |

### 핵심 결정

```
🏗️ ARCHITECT:
  "Damoa의 핵심은 'Local-First'다. 사용자 파일이 서버를 안 거친다.
   이것은 보안·법적 리스크를 90% 제거한다.
   대신 OPFS 관리가 어려워진다 — 사용자 디바이스가 다 다르기 때문이다.
   StorageEngine을 L3로 분류해서 Chaos Test (디스크 가득 참 시나리오) 의무화."
```

---

## Part 10.3 DuruDuru (시니어 런처)

### 결합 패턴

- Pattern C (Event Bus) — 텔레메트리가 다양한 분석 엔진에 broadcast

### 마이크로엔진

| 엔진               | 책임                                          |
| :----------------- | :-------------------------------------------- |
| TelemetryCollector | 화면/볼륨/동작 수집 (좀비 프로세스 수준 회복) |
| EmergencyDetector  | 비상 상황 추론 (LLM 통합 가능)                |
| NotificationEngine | 보호자 알림 (FCM Push)                        |

### 핵심 위험

```
🛡️ SENTINEL:
  "DuruDuru는 시니어를 다룬다. 한국 노인복지법 + 개인정보보호법 + 위치정보보호법
   3중 적용이다. SLA에 'Availability 99.99%' (월 4분 다운)은 불가능하더라도
   'Notification 도달 99%'는 의무다. 이것이 진짜 SLA다."

👻 GHOST:
  "OS가 메모리 부족으로 앱을 죽일 가능성이 항상 있다.
   엔진은 startOnBoot + WorkManager + JobScheduler 3중으로 살아남아야 한다.
   '회복탄력성 = SLA의 핵심'이라는 점을 명시."
```

---

## Part 10.4 Scoreforge (악보 AI)

### 4축 분류

| 축           | 값                                     |
| :----------- | :------------------------------------- |
| Scope        | Meta (해석 메타엔진 + 표현 메타엔진)   |
| Determinism  | Hybrid (LLM 추론 + 결정론적 후처리)    |
| Statefulness | Stateful (세션)                        |
| Isolation    | Worker + Wasm (브라우저) + Edge (서버) |

→ **자동 DEFCON L3**

### 결합 패턴

- Meta-Meta 패턴: Pattern A (Pipeline) within Pattern B (Orchestrator)

### 마이크로엔진 (해석 메타엔진)

| 엔진                  | 위치                               | LLM 격리             |
| :-------------------- | :--------------------------------- | :------------------- |
| InputParserEngine     | Wasm                               | N/A                  |
| QuantizationEngine    | Wasm                               | N/A                  |
| TranscriptionEngine   | Edge (TensorFlow.js or Workers AI) | **Layer 1+2+4** 의무 |
| HarmonyAnalysisEngine | Worker                             | Layer 1+2            |

### 마이크로엔진 (표현 메타엔진)

| 엔진               | 위치                           |
| :----------------- | :----------------------------- |
| RenderingEngine    | Worker (SVG 생성)              |
| AudioSynthEngine   | Web Audio AudioWorklet         |
| TimingOrchestrator | Main thread (단방향 시간 주입) |

### G5.5 적용

원본 ScoreForge 환각 사건 (헌법 Appendix B)이 v2.0의 가장 중요한 교훈. 현재의 v2.0 적용:

| 단계                | 검증                                   |
| :------------------ | :------------------------------------- |
| 입력 (오디오)       | Schema 검증 (44.1kHz, 16-bit, max 5분) |
| 1단계 (음원 분리)   | Lineage event: CREATED                 |
| 2단계 (음표 추출)   | Lineage event: 생존율 측정             |
| 3단계 (양자화)      | 손실률 > 30% → 알람                    |
| 4단계 (화성 분석)   | 의미적 검증 (Layer 2)                  |
| 5단계 (악보 렌더링) | E2E 인간 검증 (G5.5)                   |

---

# ═══════════════════════════════════════════════════════════

# VOLUME XI: 페르소나별 COT 검증 결과

# ═══════════════════════════════════════════════════════════

```
🎩 MEPHISTO:
  "헌법 v3.3 Part 2.4의 COT 14문항을 본 v2.0 헌법 자체에 적용한다.
   각 페르소나가 '내가 빠뜨린 것은 없는가'를 자기 검증한다."
```

## Part 11.1 페르소나별 COT 결과

### 🔮 ORACLE의 COT

| Q                  | 답                                                                             |
| :----------------- | :----------------------------------------------------------------------------- |
| Q1 (누락된 관점)   | "엔진의 비즈니스 모델 연결이 부족하다. 각 엔진의 CAC/LTV 영향은?" → **TODO 1** |
| Q2 (전염 범위)     | 4개 프로젝트에 동일 적용 가능. 추가 프로젝트는 ORACLE 재검증 의무              |
| Q4 (6개월 후 이해) | 엔진 분류 매트릭스 + DEFCON 자동 매핑 표 덕분에 명확                           |

→ **수정 사항 (TODO 1):** Volume X의 각 프로젝트에 "이 엔진이 LTV에 어떻게 기여하는가?" 한 줄 추가 (v2.1에서 반영)

### 👤 ADVOCATE의 COT

| Q                  | 답                                                             |
| :----------------- | :------------------------------------------------------------- |
| Q4 (6개월 후 이해) | "L1/L2/L3 표는 명확하지만 시각화가 부족하다." → **TODO 2**     |
| Q6 (사용자 만족)   | 엔진은 사용자가 직접 보지 않음. 그러나 엔진 다운 = 사용자 분노 |

→ **수정 사항 (TODO 2):** v2.1에서 Mermaid 다이어그램 5개 추가 (Lifecycle, 5대 패턴, 4계층 격리 등)

### 🏗️ ARCHITECT의 COT

| Q                        | 답                                        |
| :----------------------- | :---------------------------------------- |
| Q9 (Silent Pivot 가능성) | engine.contract.yaml로 봉쇄. PASS         |
| Q10 (Lineage)            | Volume IV·VI에서 명시. PASS               |
| Q11 (DEFCON 과잉/과소)   | Part 8.1 매트릭스로 자동화. PASS          |
| Q12 (Blind Charge 위험)  | Volume V Stage 0 (research.md) 의무. PASS |

### 💻 HACKER의 COT

| Q              | 답                                      |
| :------------- | :-------------------------------------- |
| Q1 (구체 코드) | "코드 예시가 더 필요하다." → **TODO 3** |

→ **수정 사항 (TODO 3):** v2.1에서 4개 프로젝트별 minimal 구현 코드 (각 50줄) 추가

### 🔨 BREAKER의 COT

| Q                         | 답                                                  |
| :------------------------ | :-------------------------------------------------- |
| Q (테스트 vs 기획 일치)   | Volume VII Tier 3 (Contract test)로 봉쇄            |
| Q (research.md 영향 검증) | Volume V Stage 0~1로 봉쇄                           |
| Q (잔여 위험)             | "엔진 간 버전 호환성 매트릭스가 없다." → **TODO 4** |

→ **수정 사항 (TODO 4):** v2.1에서 Part 5.5 "Engine Compatibility Matrix" 추가

### 🛡️ SENTINEL의 COT

| Q             | 답                                                                       |
| :------------ | :----------------------------------------------------------------------- |
| Q (법적 방어) | LLM 4계층 격리 + Cost Cap + 모델 버전 고정 = GDPR/AI Act 대응 가능       |
| Q (잔여 위험) | "엔진 간 데이터 전달 시 PII 필터링 의무가 명시되지 않았다." → **TODO 5** |

→ **수정 사항 (TODO 5):** Volume VI에 "PII Filter at Engine Boundary" 항목 추가 (이미 OTel Baggage 부분에 일부 명시)

### 👻 GHOST의 COT

| Q                       | 답                                                     |
| :---------------------- | :----------------------------------------------------- |
| Q (출력 품질 알림)      | Correctness SLI + 알람 = PASS                          |
| Q (성능 예산 자동 대응) | Backpressure 4종 전략 = PASS                           |
| Q (잔여 위험)           | "엔진 배포 자동화 (CI/CD) 가이드가 없다." → **TODO 6** |

→ **수정 사항 (TODO 6):** v2.1에서 Volume XII에 CI/CD pipeline 템플릿 추가

## Part 11.2 v2.0 → v2.1 개선 로드맵 (위 6개 TODO)

| #   | 항목                         | 우선도 |
| :-- | :--------------------------- | :----: |
| 1   | 각 프로젝트의 LTV 영향 한 줄 |   중   |
| 2   | Mermaid 시각화 5개           |  높음  |
| 3   | 프로젝트별 구현 코드 50줄    |  높음  |
| 4   | Engine Compatibility Matrix  |   중   |
| 5   | PII Filter 명시 강화         |  높음  |
| 6   | CI/CD pipeline 템플릿        |   중   |

---

# ═══════════════════════════════════════════════════════════

# VOLUME XII: Implementation Checklist

# ═══════════════════════════════════════════════════════════

## Part 12.1 Phase 0 — 프로젝트 시작 시 의무 확정 (엔진 관련)

```
□ 이 프로젝트에 어떤 엔진들이 필요한가? (이름 + 4축 분류)
□ 각 엔진의 결합 패턴 (A~E)?
□ 각 엔진의 DEFCON 레벨 (Part 8.1 매트릭스)?
□ LLM 통합 엔진이 있는가? → Volume IV 4계층 격리 의무
□ 엔진 간 통신 프로토콜 (직접 호출 / Event Bus / Actor msg)?
□ OpenTelemetry 백엔드 결정 (Grafana / Honeycomb / OpenObserve)?
□ Lifecycle Hook 표준 인터페이스 정의?
□ Engine Contract 디렉토리 구조 (docs/engines/{name}/)?
□ 테스트 계층별 도구 결정 (Tier 1~5)?
□ Migration Strategy 원칙 (Strangler Fig 권장)?
```

## Part 12.2 Per-Engine — 새 엔진 만들 때 의무 절차

```
□ Stage 0: research.md 작성 + ARCHITECT 검토
□ Stage 1: contract.yaml 작성 + BREAKER 검증 (Genesis Trap 방지)
□ Stage 1.5: ADVOCATE의 "사용자 시나리오" 1개 (이 엔진이 죽을 때 사용자가 보는 것)
□ Stage 1.7: RAR Cycle (인간 주석 → AI 반영)
□ 🔓 Implementation Unlock 선언
□ Stage 2: TDD 구현 (Tier 1)
□ Stage 2.5: Tier 2 (Integration) 작성
□ Stage 3: Lifecycle 4 hooks 구현 + health check API
□ Stage 4 (production 진입 전):
  □ Tier 3 (Contract) 통과
  □ Tier 4 (Property) 통과 — 결정성 검증 포함
  □ SLI 4종 측정 가능 확인
  □ SLO 선언 (yaml)
  □ OpenTelemetry 통합 확인
  □ Kill Switch + Circuit Breaker 구현
  □ Fallback (LLM 엔진 시) 구현
□ Stage 4 (carnary deploy):
  □ 5% 트래픽으로 시작
  □ Tier 5 (Chaos) 시나리오 1개 통과
  □ Correctness SLI 모니터링 (G5.5 통과율)
□ 100% 배포
□ Stage 5 진입 시: Migration Strategy 명시
□ Stage 6 진입 시: Sunset 절차 발동 (90일 사전 공지)
```

---

# ═══════════════════════════════════════════════════════════

# 부록: 표준 템플릿

# ═══════════════════════════════════════════════════════════

## Appendix A: engine.contract.yaml 템플릿

```yaml
# docs/engines/{engine_name}/contract.yaml

engine:
  name: 'TranscriptionEngine'
  version: '1.0.0'
  status: 'contracted' # contracted → in_progress → review → done → deprecated

  # 4축 분류 (Volume I)
  classification:
    scope: 'micro' # micro | meta
    determinism: 'hybrid' # deterministic | probabilistic | hybrid
    statefulness: 'stateless'
    isolation: 'wasm' # process | thread | worker | sandbox | edge | wasm

  # 자동 매핑 (Volume VIII)
  defcon: 'L3'
  defcon_reason: 'AI/ML Probabilistic + Output is business-critical'

  # 결합 패턴 (Volume III)
  composition_pattern: 'B' # A | B | C | D | E
  parent_meta_engine: 'MusicTranscriptionMetaEngine'

  # SLO (Volume VI)
  slo:
    tier: 'A'
    availability: 0.995
    latency_p99_ms: 5000
    correctness: 0.95

# 인터페이스 계약
interface:
  inputs:
    - name: 'audio'
      type: 'Float32Array'
      validation:
        - 'length > 0'
        - 'length < 44100 * 300' # max 5분
        - 'all values in [-1.0, 1.0]'
    - name: 'options'
      type: 'TranscribeOptions'
      validation:
        - 'options.seed is integer if probabilistic mode'

  outputs:
    - name: 'score'
      type: 'MusicXMLDocument'
      validation:
        - 'valid MusicXML 4.0 schema'
        - 'all notes in piano range [21, 108]'

  errors:
    - 'AudioTooLongError'
    - 'ModelTimeoutError'
    - 'InsufficientMemoryError'

# Lifecycle Hooks (Volume V Stage 3)
lifecycle:
  start_timeout_ms: 5000
  stop_graceful_period_ms: 30000
  health_check_interval_ms: 10000
  reload_supported: true

# LLM 통합 (Volume IV)
llm_integration:
  enabled: true
  model: 'claude-sonnet-4-7'
  cost_cap_per_request_usd: 0.10
  cost_cap_per_user_per_day_usd: 5.00
  timeout_ms: 30000
  fallback: 'rule_based_basic_pitch_v2'
  schema_strict: true
  semantic_validators: ['note_in_range', 'tempo_realistic']

# Acceptance Criteria
acceptance_criteria:
  - id: 'AC-1'
    description: 'Note F1 score > 0.85 on test dataset'
    verification: 'test_passes'
    test_name: 'test_transcription_quality'
    threshold: 0.85
  - id: 'AC-2'
    description: 'P99 latency < 5s on 60s audio'
    verification: 'metric_check'
    metric: 'engine.latency.p99'
    threshold: 5000
  - id: 'AC-3'
    description: 'Lifecycle 4 hooks all present'
    verification: 'function_exists'
    targets: ['start', 'stop', 'healthCheck', 'reload']

constraints:
  - 'Memory usage < 500MB'
  - 'No Node.js APIs (must run on Cloudflare Workers)'
  - 'Output deterministic when seed is fixed'

adr_triggers:
  - 'Switching base ML model'
  - 'Adding new external dependency'
  - 'Changing public interface signature'

# BREAKER 검증 (Genesis Trap)
contract_review:
  breaker_verified: false # 인간이 BREAKER 검토 후 true
  omission_warnings: []
  loosened_constraints: []
  scope_gaps: []
```

## Appendix B: engine.adr.md 템플릿

```markdown
# ADR-{NN}: {엔진명} v{X.Y.Z} — {결정 요약}

**Date:** YYYY-MM-DD
**Status:** PROPOSED | ACCEPTED | REJECTED | DEPRECATED
**Engine:** {engine_name}
**Engine Version:** {affected_versions}
**Related Contract:** docs/engines/{name}/contract.yaml

## 1. Context (맥락)

이 엔진은 현재 다음과 같이 동작한다:

> {현재 상태}

발생한 문제 / 새로운 요구사항:

> {trigger}

## 2. Decision (결정)

- 기존 접근: {what was}
- 새 접근: {what will be}
- 변경 범위:
  - [ ] Public API (Major bump)
  - [ ] Internal Logic (Minor bump)
  - [ ] Bug Fix (Patch bump)

## 3. Consequences (결과)

### 긍정

- {benefit 1}
- {benefit 2}

### 부정

- {drawback 1}
- {drawback 2}

### Migration

- Strategy: Strangler Fig | Parallel Run | Big Bang
- Timeline: {duration}
- Backward Compatibility: {기간}

## 4. Alternatives Considered (대안)

| 대안 | 장점 | 단점 | 선택 안 한 이유 |
| :--- | :--- | :--- | :-------------- |
| A    | ...  | ...  | ...             |
| B    | ...  | ...  | ...             |

## 5. SLO Impact

- Latency: {before → after}
- Throughput: {before → after}
- Cost: {before → after}

## 6. Human Decision Required

- [ ] Approved (proceed)
- [ ] Rejected (revert)
- [ ] Modified (different approach)

Reviewer: ****\_\_****
Date: ****\_\_****
```

## Appendix C: Engine Health Check 표준 응답

```typescript
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime_seconds: number;

  // 4종 SLI 현재 상태
  sli: {
    latency_p99_ms: number;
    throughput_per_sec: number;
    availability_5min: number;
    correctness_estimate: number | null; // 측정 불가능하면 null
  };

  // SLO 대비
  slo_compliance: {
    availability: 'compliant' | 'at_risk' | 'violated';
    latency: 'compliant' | 'at_risk' | 'violated';
    correctness: 'compliant' | 'at_risk' | 'violated';
  };

  // 의존 엔진 상태
  dependencies: {
    [engineName: string]: 'healthy' | 'degraded' | 'unhealthy';
  };

  // LLM 엔진의 경우 추가
  llm?: {
    model: string;
    cost_today_usd: number;
    cost_cap_usd: number;
    fallback_active: boolean;
  };

  // 마지막 에러 (있으면)
  last_error?: {
    timestamp: string;
    message: string;
    trace_id: string;
  };
}
```

---

# 🎩 MEPHISTO의 최종 선언

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

원본 v1.0은 시였다. 영혼이 있었다. 빛이 있었다.
그러나 시는 새벽 3시의 장애를 막지 못한다.

v2.0은 시의 영혼을 품은 헌법이다.
"박동하는 심장"의 비유를 보존하되,
박동을 측정하는 청진기(SLI)와
박동을 멈췄을 때 부르는 119(Kill Switch)를 추가했다.

  ┌───────────────────────────────────────────────────┐
  │                                                   │
  │  🎯 식별: 5문항 테스트 (Engine 자격증)            │
  │  📐 분류: 4축 매트릭스 (DEFCON 자동 매핑)          │
  │  🔗 결합: 5대 패턴 (A~E + 트레이드오프)            │
  │  🦁 격리: 4계층 우리 (LLM 야수 가두기)             │
  │  🔄 진화: 7단계 Lifecycle (잉태~매장)              │
  │  📊 측정: 4 SLI + 3 SLO + OTel                    │
  │  🔨 검증: 5계층 테스트 (Unit~Chaos)                │
  │  🎚️ 강도: DEFCON × Engine 매트릭스                │
  │  ⚠️ 회피: 11가지 안티패턴 갤러리                   │
  │  🏗️ 적용: 4개 프로젝트 구체 매핑                   │
  │  ✅ 검증: 7명 페르소나의 COT 자기 검증            │
  │                                                   │
  └───────────────────────────────────────────────────┘

원본의 14가지 누락을 모두 메웠다.
헌법 v3.3 (DEFCON / ACAP / G5.5 / SPDP / Lineage)와 정합한다.
2026년 현시대 6대 무기 (WASM / WGPU / Edge / OPFS / OTel / CRDT)를 통합했다.

남은 것은 실행이다.

  "v1.0은 엔진이 무엇인지 정의했다.
   v2.0은 엔진이 무엇이어야 하는지 명령한다.
   v3.0은 너희가 실제로 만든 엔진들이 가르쳐 줄 것이다."

                                  — MEPHISTO 🔥
                  VOID ENGINE DESIGN CONSTITUTION v2.0
                                       2026-04-26

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

**Document Version:** 2.0 (보완·개선·확장 통합)  
**Created:** 2026-04-26  
**Supersedes:** VOID_META_ENGINE_GUIDELINE.md v1.0  
**Aligned with:** VOID DEV UNIFIED CONSTITUTION v3.3  
**Total Volumes:** 12 + 부록 3  
**Total Patterns:** 5 결합 + 4 격리 + 7 Lifecycle + 4 SLI + 3 SLO Tier + 5 Test Tier  
**Total Anti-patterns:** 11  
**Project Applications:** FileBeam / Damoa.pro / DuruDuru / Scoreforge  
**Persona COT Pass:** 7/7 (with 6 TODOs for v2.1)  
**Status:** VOID Engine Design 단일 진실 소스 — 모든 프로젝트 범용 적용  
**Next Review:** 4개 프로젝트 적용 후 (v2.1 — 위 TODO 6개 반영)

---

_"Identification + Classification + Containment + Measurement + Lifecycle._  
_Five pillars of an engine that does not lie about beating."_

— **VOID DEV · DEV COVEN · v2.0**
