# 🗂️ 02. DECOMPOSITION PATTERN CATALOG

## 7가지 분할 패턴 — 어느 것이 내 프로젝트에 맞는가

> **"한 가지 패턴이 모든 프로젝트에 맞는다고 말하는 사람은 두 가지 중 하나다.**
> **거짓말쟁이거나, 한 가지 패턴만 본 사람이거나."**
>
> — ARCHITECT

---

**버전:** v1.0
**선행 문서:** 01. Diagnosis Framework (PDS 완료 필수)
**연계 문서:** 03. Role Definition, 05. Planning Workbook

---

# 0. 패턴 카탈로그 개요

## 0.1 7개 패턴 한눈에 보기

|   #   | 패턴                 | 적용 조건                          | 분할 단위 수 | 솔로 적합도 |
| :---: | :------------------- | :--------------------------------- | :----------: | :---------: |
| **0** | **Single Module**    | Tiny~Small 또는 Monolithic         |      1       |    ★★★★★    |
| **1** | **Phase-based**      | 시간 축으로 명확한 단계            |    시간순    |    ★★★★★    |
| **2** | **5-Plane Hybrid**   | Medium~Large SaaS, 분할 자연스러움 |    5 + CC    |    ★★★★☆    |
| **3** | **Pipeline Stage**   | 데이터 변환 체인                   |     3~6      |    ★★★★☆    |
| **4** | **Domain Vertical**  | DDD 명확한 Bounded Context         |     3~5      |    ★★★★☆    |
| **5** | **Core-Plugin**      | 코어 + 무한 확장 가능 부속         |    1 + N     |    ★★★★★    |
| **6** | **Hybrid Composite** | 위 둘 이상 조합                    |     가변     |    ★★★☆☆    |

## 0.2 패턴 선택 결정 트리

```
                     ┌────────────────────────────┐
                     │  PDS 결과: 분할 결정?       │
                     └─────────────┬──────────────┘
                          ┌────────┴────────┐
                         NO                YES
                          │                 │
                          ▼                 ▼
                   ┌─────────────┐   ┌─────────────────┐
                   │ Pattern 0   │   │ 분할의 동기는?  │
                   │ Single Mod  │   └────┬────────────┘
                   └─────────────┘        │
                              ┌───────────┼───────────┬─────────────┐
                              ▼           ▼           ▼             ▼
                       ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
                       │시간축으로│ │도메인이  │ │파이프라인│ │코어+확장 │
                       │명확     │ │분명함    │ │체인     │ │무한      │
                       └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘
                            │            │            │            │
                            ▼            ▼            ▼            ▼
                       ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
                       │Pattern 1 │ │Pattern 2 │ │Pattern 3 │ │Pattern 5 │
                       │Phase-    │ │5-Plane or│ │Pipeline  │ │Core-     │
                       │based     │ │Pattern 4 │ │Stage     │ │Plugin    │
                       └──────────┘ └────┬─────┘ └──────────┘ └──────────┘
                                         │
                                    ┌────┴────┐
                                    ▼         ▼
                              ┌──────────┐ ┌──────────┐
                              │SaaS+다중 │ │순수 도메인│
                              │책임 영역 │ │(B2C, 단일)│
                              └────┬─────┘ └────┬─────┘
                                   ▼            ▼
                              ┌──────────┐ ┌──────────┐
                              │Pattern 2 │ │Pattern 4 │
                              │5-Plane   │ │Domain    │
                              │Hybrid    │ │Vertical  │
                              └──────────┘ └──────────┘
```

---

# Pattern 0: Single Module (분할 안 함)

## 정체성

```
"분할 안 하는 것도 정당한 패턴이다."

이걸 명시적으로 패턴 0으로 둔 이유:
  - "분할은 무조건 좋다"는 환상 차단
  - Tiny/Small 프로젝트는 분할 = 손해
  - 분할 안 함을 부끄러워하지 않게
```

## 적용 조건

```
✓ PDS classification: Tiny 또는 Small
✓ 또는 Cognitive: Tightly Coupled / Monolithic
✓ 또는 시간 예산 < 2주
```

## 구조

```
project-root/
├── src/
│   ├── domain/         # DDD 4계층 (단일 도메인)
│   ├── application/
│   ├── infrastructure/
│   └── presentation/
├── tests/
├── docs/
│   ├── research.md
│   ├── plan.md
│   └── adr/
├── CLAUDE.md
└── package.json
```

## 운영 모델

```
- 단일 Claude Code 세션
- 헌법 v3.3 ACAP v4 그대로 적용
- DEFCON: 보통 L1 또는 L2
- 04. Info Sharing 불필요 (단일 세션)
- 03. Role Definition 간소화 (페르소나 빠른 전환만)
```

## 분할로 갈 신호 (재진단 트리거)

```
다음 신호 발생 시 → 01. Diagnosis 재실행:

  □ 한 파일이 1000줄 초과
  □ 한 폴더에 모듈 10개 초과
  □ 같은 영역 코드를 일주일에 5회 이상 수정
  □ "이 부분만 분리하고 싶다"는 충동 3회 이상
  □ 새 기능 추가 시 5개 이상 파일 동시 수정
```

## 적용 예시 (VOID 포트폴리오)

| 프로젝트                     | 적용 이유                                 |
| :--------------------------- | :---------------------------------------- |
| VOID TIME Burn               | 단일 도구, 7점 복잡도, 3주 예상           |
| VOID DROP                    | P2P 전송 단순, 인증 외 비즈니스 로직 적음 |
| 라이브러리 (LibForge 패키지) | 재사용 단위, 작음                         |
| PoC / 실험 코드              | 검증 후 폐기 또는 본 프로젝트 흡수        |

## 페르소나 검증

```
🔮 ORACLE: "분할 안 함이 비즈니스 가치 손실인가? — 작은 프로젝트는 분할 셋업 비용이 가치 < 0"
🏛️ ARCHITECT: "구조적으로 단일 모듈이 적절한가? — DDD 4계층만으로 충분"
👤 ADVOCATE: "솔로 개발자에게 인지 부담 최소? ✓"
```

---

# Pattern 1: Phase-based (시간축 분할)

## 정체성

```
"공간이 아니라 시간으로 분할한다."

같은 코드베이스를 시간순으로 단계별로 빌드.
한 단계가 끝나야 다음 단계.
"동시에 여러 단계 작업"은 의도적으로 금지.
```

## 적용 조건

```
✓ Medium 이상이지만 도메인이 명확히 안 분리됨
✓ 출시 시점이 단계별로 명확함 (예: MVP → Pro → Launch)
✓ 한 단계의 결과를 봐야 다음 단계 설계 가능 (학습 의존성)
✓ 솔로 개발자의 인지 한계가 부담될 때
```

## 구조

```
시간순 Phase:
  Phase 0: Foundation (1~2주) — 골격
  Phase 1: MVP (3~6주) — 핵심 기능
  Phase 2: Pro (2~4주) — 수익화
  Phase 3: Launch (1~2주) — 마케팅
  ...

각 Phase의 산출물:
  - 배포 가능한 버전
  - 비즈니스 마일스톤 달성
  - 다음 Phase의 설계 정보 (학습)
```

## 운영 모델

```
- 단일 Claude Code 세션 (또는 Phase 내 임시 세션 분리)
- Phase 간 명확한 마일스톤
- 04. Info Sharing의 SSOT는 Phase별 갱신
- 다중 세션 운영은 권장하지 않음
- DEFCON: Phase 0 = L2, Phase 1+ = L2~L3 (도메인에 따라)
```

## 산출물

```
docs/
├── phases/
│   ├── PHASE_0_FOUNDATION.md     # 종료 조건, 산출물
│   ├── PHASE_1_MVP.md
│   ├── PHASE_2_PRO.md
│   └── PHASE_3_LAUNCH.md
├── research.md
└── plan.md (Phase별 갱신)
```

## 분할의 재해석

```
이 패턴은 "공간 분할"이 아니다.
같은 코드베이스에서 시간순 진행.
하지만 헌법 v3.3의 ACAP v4를 Phase별로 재시작:
  Phase 0 → ACAP -1 ~ 5 완주
  Phase 1 → ACAP -1 ~ 5 다시 (새 연구, 새 계획)
```

## 적용 예시

| 프로젝트       | Phase 분할                                                                |
| :------------- | :------------------------------------------------------------------------ |
| ScoreForge Pro | P0 Golden Set → P1 Pipeline → P2 UI → P3 결제 → P4 AI 편곡                |
| VOID CODEX     | P0 Foundation → P1 Memo → P2 Grimoire → P3 Constellation → P4 Marketplace |
| Agora          | P0 PoC → P1 Beta (현재) → P2 GA                                           |

## 페르소나 검증

```
🔮 ORACLE: "Phase별 비즈니스 마일스톤 명확한가? ✓ 각 Phase 끝 = 출시 가능"
🏛️ ARCHITECT: "시간 의존성이 합리적? ✓ Phase 1을 알아야 Phase 2 설계"
🔨 BREAKER: "Phase 폭발 위험? Phase가 4주 초과하면 → 헌법 v3.3 7.2 적용"
```

---

# Pattern 2: 5-Plane Hybrid

## 정체성

```
"수평(레이어) + 수직(도메인) + 직교(횡단)의 균형."

레이어만 분할 = Conway 위반, 매트릭스 폭발
도메인만 분할 = 횡단 관심사 (auth, log) 흩어짐
→ 5-Plane Hybrid: 핵심 5층 + Cross-Cutting 직교
```

## 적용 조건

```
✓ Medium~Large SaaS
✓ 사용자 + Admin + 결제 + UI/UX 명확한 영역
✓ 인지 부하 진단 24+ (Decomposable)
✓ 솔로 Max 사용자
```

## 5-Plane 구조

|        Plane         | 책임                            | 페르소나 매핑      |
| :------------------: | :------------------------------ | :----------------- |
|   **P0 Orchestra**   | 거버넌스, 통합, 배포, SSOT      | MEPHISTO + GHOST   |
|  **P1 Foundation**   | 도메인 모델, DB, API 계약, 타입 | ARCHITECT          |
|    **P2 Engine**     | 비즈니스 로직, 알고리즘, AI     | ARCHITECT + HACKER |
|    **P3 Service**    | User API + Admin API            | HACKER + SENTINEL  |
|  **P4 Experience**   | UI, i18n, 접근성                | ADVOCATE           |
| **CC Cross-Cutting** | Auth, Log, Monitoring, Security | SENTINEL + GHOST   |

## 의존 그래프 (Acyclic)

```
  P0 (관찰만, 의존 없음)

  P1 (의존 없음 — 가장 안쪽)
   ↑
  P2 → P1, CC
   ↑
  P3 → P1, P2, CC
   ↑
  P4 → P3, CC (P2 직접 의존 금지)

  CC → P1만
```

## 운영 모델

```
- 다중 Claude Code 세션 (활성 ≤ 3)
- Plane 브랜치 + 단일 main (단일 폴더)
- NOTICE 시스템 필수 (04. Info Sharing)
- 일일 정렬 의식 (P0가 매일 아침 5분)
- DEFCON Mixed: P1=L3, P3=L2/L3, P4=L1/L2
```

## 적용 예시

| 프로젝트   | 5-Plane 매핑                                                                                          |
| :--------- | :---------------------------------------------------------------------------------------------------- |
| VOID BILL  | P0 배포, P1 견적/고객 도메인, P2 15-rule 린터, P3 사용자/Admin API, P4 견적 에디터 UI, CC OAuth+Polar |
| VOID CODEX | P0 운영, P1 Book/Memo/Grimoire 모델, P2 AI 변환, P3 reader/admin, P4 React UI, CC 인증                |

## 셋업 비용

```
첫 적용: 1주 (8개 방법론 문서 따라)
재사용: 1일 (이전 프로젝트 인프라 복사)

손익분기: 4주 프로젝트에서 흑자
12주 프로젝트에서 50% 시간 절감
```

## 페르소나 검증

```
🏛️ ARCHITECT: "Plane 의존이 acyclic? ✓ P4는 P2 직접 의존 금지"
🔨 BREAKER: "6개 세션 동시 = 카오스? — 활성 ≤ 3 룰로 방어"
👤 ADVOCATE: "솔로가 6 Plane 머리에 들고? — 일일 정렬 + Dashboard로 보완"
🛡️ SENTINEL: "결제 격리? P3 Admin = L3 자동, secret 분리"
```

---

# Pattern 3: Pipeline Stage

## 정체성

```
"데이터가 흐르는 방향대로 자른다."

Pipeline = 입력 → 변환 1 → 변환 2 → ... → 출력
각 변환 단계가 "한 영역(섹터)".
변환 사이의 인터페이스 = "전송 데이터 형식".
```

## 적용 조건

```
✓ 데이터 변환이 3+단계
✓ 각 단계가 명확한 입출력 형식
✓ 단계별로 다른 알고리즘/외부 서비스
✓ TYPE-3 Cascade Destruction 위험 (Lineage 의무)
```

## 구조 예시 (ScoreForge)

```
[입력: MP3]
   ↓
┌─────────────────────────────┐
│ Stage 1: 오디오 전처리       │  ← Demucs (4-stem 분리)
│ packages/stage-1-audio/     │
└─────────────┬───────────────┘
              │ [WAV stems]
              ▼
┌─────────────────────────────┐
│ Stage 2: 채보 (Transcription)│  ← MT3 또는 Basic-Pitch
│ packages/stage-2-transcribe/│
└─────────────┬───────────────┘
              │ [MIDI]
              ▼
┌─────────────────────────────┐
│ Stage 3: 음악 표기법 변환    │  ← MusicXML 생성
│ packages/stage-3-notation/  │
└─────────────┬───────────────┘
              │ [MusicXML]
              ▼
┌─────────────────────────────┐
│ Stage 4: 렌더링              │  ← OSMD
│ packages/stage-4-render/    │
└─────────────┬───────────────┘
              ▼
[출력: 악보 SVG]
```

## 횡단 관심사

```
Pipeline 패턴에는 다음이 항상 직교:

  Cross-Pipeline:
    - Lineage 시스템 (헌법 v3.3 Part 9.8)
    - 진행 상태 관찰 (UI에 진행률 표시)
    - 에러 복구 (Stage 실패 시 fallback)
    - Dogfooding (인간 검증 G5.5)
```

## 운영 모델

```
- 다중 세션: Stage별 1개씩 (3~6개)
- 활성 세션 ≤ 3 룰 적용
- Stage 간 인터페이스가 가장 중요 (Contract.yaml 의무)
- 데이터 손실률 측정 자동화
- DEFCON: 보통 L3 (출력 품질이 비즈니스 핵심)
```

## 핵심 위험: 합성 효과

```
각 Stage의 단위 테스트 통과 ≠ E2E 통과.

3 Stage 파이프라인:
  Stage 1 정확도 90%
  Stage 2 정확도 90%
  Stage 3 정확도 90%
  → 합성 정확도 = 0.9 × 0.9 × 0.9 = 73%

이 위험을 막는 게 Lineage 시스템.
```

## 적용 예시

| 프로젝트    | Pipeline Stage                            |
| :---------- | :---------------------------------------- |
| ScoreForge  | 4 stages 위 그림                          |
| VOID MIX    | 입력 → 분석 → 자동 믹싱 → 마스터링 → 출력 |
| Synesthesia | 오디오 → 분리 → 분석 → WebGL 시각화       |

## 페르소나 검증

```
🏛️ ARCHITECT: "각 Stage 인터페이스 명시? ✓ Contract 필수"
🔨 BREAKER: "Cascade Destruction 방어? ✓ Lineage 시스템 의무"
🔮 ORACLE: "최종 출력 품질이 비즈니스 핵심? ✓ G5.5 인간 검증"
```

---

# Pattern 4: Domain Vertical

## 정체성

```
"DDD Bounded Context를 그대로 분할 단위로."

각 도메인이 독립 영역.
도메인 간 통신 = Domain Event 또는 명시적 API.
횡단 관심사는 별도 (shared 모듈).
```

## 적용 조건

```
✓ 명확히 다른 도메인이 3+개 (예: 책 / 메모 / 그리무어 / 성좌도)
✓ 도메인별 다른 비즈니스 규칙
✓ Bounded Context가 안정적 (자주 안 변함)
✓ DDD 학습이 어느 정도 됨
```

## 구조 예시 (VOID CODEX)

```
project-root/
├── packages/
│   ├── domain-book/          ← 책 도메인 (수직)
│   │   ├── src/
│   │   │   ├── domain/
│   │   │   ├── application/
│   │   │   ├── infrastructure/
│   │   │   └── presentation/
│   │   └── docs/
│   ├── domain-memo/          ← 메모 도메인
│   ├── domain-grimoire/      ← 그리무어 도메인
│   ├── domain-constellation/ ← 성좌도 도메인
│   └── shared/               ← 횡단 (auth, log, ui-kit)
└── apps/
    └── web/                  ← 통합 진입점
```

## 5-Plane과의 차이

| 비교           | 5-Plane (Pattern 2)      | Domain Vertical (Pattern 4)        |
| :------------- | :----------------------- | :--------------------------------- |
| 분할 기준      | 책임 (UI/Service/Engine) | 도메인 (Book/Memo)                 |
| 한 도메인 변경 | 5 Plane 모두 만짐        | 1 Vertical만 만짐                  |
| 횡단 관심사    | CC (직교)                | shared 모듈                        |
| 적합 시점      | 영역별 책임이 다양할 때  | 도메인이 안정적이고 분리 깔끔할 때 |
| 솔로 부담      | 중간 (6개 세션)          | 낮음 (3~5개 세션)                  |

## 운영 모델

```
- 도메인별 Claude Code 세션 (3~5개)
- 도메인 간 통신: Domain Event (이벤트 버스) 또는 명시적 API
- shared 모듈은 변경 빈도 낮게 유지
- DEFCON: 도메인별 다름
```

## 적용 예시

| 프로젝트                           | Domain Vertical 분할                   |
| :--------------------------------- | :------------------------------------- |
| VOID CODEX (4-도메인 모델 채택 시) | book / memo / grimoire / constellation |
| 대형 ERP                           | inventory / sales / accounting / hr    |
| 소셜 네트워크                      | user / post / message / notification   |

## 페르소나 검증

```
🏛️ ARCHITECT: "Bounded Context 안정성? — 자주 변하면 5-Plane이 더 나음"
🔮 ORACLE: "도메인이 비즈니스 가치를 명확히 분리? ✓"
🔨 BREAKER: "Cross-domain 호출이 사이클 만드나? — Event 버스로 회피"
```

---

# Pattern 5: Core-Plugin

## 정체성

```
"핵심 엔진은 안정 + 부속은 무한 확장."

Core: 변경이 거의 없음, L3 통제
Plugin: 자주 추가/제거됨, L1~L2 통제
```

## 적용 조건

```
✓ 핵심 기능 + 무한 확장 가능 부속
✓ Plugin 단위가 작고 독립적 (1~3일 구현)
✓ Plugin 추가/제거가 시스템 무결성에 영향 안 줌
✓ "온라인 다이소" 모델
```

## 구조 예시 (VOID UTIL)

```
project-root/
├── packages/
│   ├── core/                 ← 안정. 거의 안 변함
│   │   ├── src/
│   │   │   ├── engine/       # Plugin 등록/실행
│   │   │   ├── routing/      # URL → Plugin 매핑
│   │   │   ├── registry/     # 메타데이터
│   │   │   └── shared-ui/    # 공통 UI
│   │   └── docs/
│   ├── plugins/              ← 무한 확장
│   │   ├── plugin-pdf-merge/
│   │   ├── plugin-image-resize/
│   │   ├── plugin-csv-tools/
│   │   └── ... (수십 개)
│   └── plugin-template/      ← 새 Plugin 빠른 시작용
└── apps/
    └── web/                  ← 통합 페이지
```

## 운영 모델

```
- Core 세션 1개 (안정 유지, 변경 시 ADR)
- Plugin 세션 N개 (병렬 가능)
- Plugin 셋업이 30분 안에 가능 (template + scaffold)
- DEFCON:
    Core: L3 (변경 = 모든 Plugin 영향)
    Plugin: L1~L2 (대부분 가벼움)
```

## Plugin 인터페이스 (안정성 핵심)

```typescript
// packages/core/src/plugin-interface.ts
export interface VoidPlugin {
  id: string;
  name: string;
  description: string;
  version: string;

  // 진입점
  render(container: HTMLElement, props: PluginProps): Promise<void>;

  // 라이프사이클
  onMount?(): void;
  onUnmount?(): void;

  // 메타
  category: PluginCategory;
  defcon: 'L1' | 'L2' | 'L3';
}
```

## Plugin 추가 워크플로우

```
1. scripts/new-plugin.sh "plugin-name"
   → packages/plugins/plugin-name/ 생성
   → 템플릿 복사

2. 단일 Claude Code 세션
   → 헌법 v3.3 ACAP v4 간소화 (DEFCON L1)
   → 1~3일에 완성

3. Core의 Registry에 등록
   → packages/core/src/registry/index.ts에 import 추가
   → 자동 라우팅 활성

4. 배포 — 다른 Plugin에 영향 없음
```

## 적용 예시

| 프로젝트            | Core-Plugin 분할                                |
| :------------------ | :---------------------------------------------- |
| VOID UTIL Hub       | Core (engine + routing) + 100개 utility plugins |
| 브라우저 확장       | Manifest + 다수 content scripts                 |
| Headless CMS        | Core + 다수 field plugins                       |
| VS Code 확장 시스템 | API + 수만 개 extensions                        |

## 페르소나 검증

```
🔮 ORACLE: "Plugin이 비즈니스 가치 빠르게 추가? ✓ '온라인 다이소' 100개 채우기 가능"
🏛️ ARCHITECT: "Core 안정성? — 인터페이스 한 번 정하면 못 바꿈 = L3 통제"
👤 ADVOCATE: "Plugin 셋업 30분 안? ✓ 템플릿 + scaffold"
🔨 BREAKER: "Plugin 간 충돌? — 격리된 sandbox + 명시적 인터페이스"
```

---

# Pattern 6: Hybrid Composite

## 정체성

```
"한 패턴으로 안 되면, 여러 패턴을 합친다."

진짜 큰 프로젝트는 종종 한 패턴으로 안 잡힘.
Phase + 5-Plane + Pipeline의 조합 등.
단, 조합은 신중히 — 너무 복잡해지면 카오스.
```

## 적용 조건

```
✓ XLarge 프로젝트
✓ 여러 도메인 + 다단계 pipeline + Phase 출시 명확
✓ 솔로 Max 사용자 + 6개월+ 기간
✓ 다른 패턴 단독으로는 어색함
```

## 조합 예시 1: Phase + 5-Plane

```
시간 축 (Phase) ──► P0  P1  P2  P3  P4  CC  ◄─ 공간 축 (5-Plane)

Phase 0:           셋업+계약    스켈레톤
Phase 1 (MVP):     ████  ████  ████  ████
Phase 2 (Pro):     ████  ████  ████  ████  ████  ████
Phase 3 (Launch):  마무리, 배포
```

각 Phase 안에서 5-Plane 분할 운영. Phase가 끝나면 다음 Phase 시작.

## 조합 예시 2: 5-Plane + Domain Vertical (P2/P3 안에서)

```
P0 Orchestra
P1 Foundation
P2 Engine ────┬── P2-A: book engine
              ├── P2-B: memo engine
              └── P2-C: grimoire engine
P3 Service ───┬── P3-A: user-book API
              ├── P3-B: user-memo API
              └── P3-Admin: admin API
P4 Experience
CC
```

## 조합 예시 3: Core-Plugin + Pipeline

```
Core (Pattern 5):
  - Plugin Registry
  - Pipeline Engine ★

Plugins:
  - Each Plugin = a complete Pipeline (Pattern 3)
  - Plugin "audio2midi" = 4 stages
  - Plugin "image2text" = 3 stages
```

## 운영 모델

```
- 활성 세션 ≤ 3 룰 절대 사수
- 한 시점에 동작하는 패턴은 명확히 1~2개로 한정
- 04. Info Sharing의 NOTICE 시스템 필수 (조합이 복잡해질수록)
- DEFCON: 조합의 가장 엄격한 영역 따라
- 6개월 운영 후 단순화 검토 (1~2개 패턴으로 환원 가능?)
```

## 위험 신호

```
다음 신호 발생 시 → 패턴 단순화 필요:

  □ 활성 세션 4개 이상 필요한 시점이 매주 발생
  □ "이게 어느 패턴이지?" 자가 질문이 매일 발생
  □ NOTICE 폭주 (하루 10개 이상)
  □ 머지 충돌이 일주일에 3회 이상
  □ 신입 개발자(또는 자기 자신)가 1주일 후 구조 못 따라잡음
```

## 적용 예시

| 프로젝트                | Hybrid 조합                                    |
| :---------------------- | :--------------------------------------------- |
| VOID Synesthesia        | Pipeline (오디오 분석) + Plugin (시각화 효과)  |
| VOID 통합 플랫폼 (가상) | Phase + 5-Plane + Domain Vertical              |
| Spotify 같은 대형 SaaS  | 5-Plane + Domain Vertical (음악/팟캐스트/소셜) |

## 페르소나 검증

```
🏛️ ARCHITECT: "조합이 합리적인가? — 종종 두 단순 패턴 합치는 게 한 복잡 패턴보다 나음"
👤 ADVOCATE: "솔로가 따라잡을 수 있나? — 위 위험 신호 모니터링 필수"
🎩 MEPHISTO: "단순화 가능성 분기마다 검토? ✓ 6개월 후 환원 가능?"
```

---

# 패턴 비교 매트릭스

## 1. 솔로 적합도

| 패턴                | 셋업 비용  |     인지 부하      |    운영 복잡도     | 솔로 적합도 |
| :------------------ | :--------: | :----------------: | :----------------: | :---------: |
| 0. Single Module    | 매우 낮음  |        낮음        |        낮음        |    ★★★★★    |
| 1. Phase-based      |    낮음    |        낮음        |        낮음        |    ★★★★★    |
| 2. 5-Plane Hybrid   | 높음 (1주) |        높음        |        높음        |    ★★★★☆    |
| 3. Pipeline Stage   |    중간    |        중간        |        중간        |    ★★★★☆    |
| 4. Domain Vertical  |    중간    |        중간        |        중간        |    ★★★★☆    |
| 5. Core-Plugin      |    중간    | 낮음 (Plugin 단위) | 낮음 (Plugin 단위) |    ★★★★★    |
| 6. Hybrid Composite | 매우 높음  |     매우 높음      |     매우 높음      |    ★★★☆☆    |

## 2. DEFCON 적합도

| 패턴                |  L1 적합   | L2 적합 | L3 적합  |
| :------------------ | :--------: | :-----: | :------: |
| 0. Single Module    |     ✓      |    ✓    |    △     |
| 1. Phase-based      |     ✓      |    ✓    |    ✓     |
| 2. 5-Plane Hybrid   |     ✗      |    ✓    |    ✓     |
| 3. Pipeline Stage   |     △      |    ✓    |    ✓     |
| 4. Domain Vertical  |     △      |    ✓    |    ✓     |
| 5. Core-Plugin      | ✓ (Plugin) |    ✓    | ✓ (Core) |
| 6. Hybrid Composite |     ✗      |    △    |    ✓     |

## 3. 분할 셋업 시간

| 패턴 | 첫 적용 |  재사용 (2번째 프로젝트)   |
| :--- | :-----: | :------------------------: |
| 0    |   0일   |            0일             |
| 1    |  0.5일  |           1시간            |
| 2    |  5~7일  |            1일             |
| 3    |  2~3일  |           0.5일            |
| 4    |  2~3일  |           0.5일            |
| 5    |   3일   | 1일 (Plugin 템플릿 재사용) |
| 6    |  7일+   |            2일+            |

---

# 패턴 마이그레이션

## 패턴 변경이 필요한 신호

```
Pattern 0 → Pattern 1 (Single → Phase):
  - 프로젝트가 6주 초과
  - 출시 단계가 명확해짐

Pattern 0 → Pattern 5 (Single → Core-Plugin):
  - 비슷한 구조의 작은 모듈이 5개 이상 추가됨
  - "공통 부분 추출" 욕구 발생

Pattern 1 → Pattern 2 (Phase → 5-Plane):
  - Phase가 8주 초과로 늘어남
  - 한 Phase 안에서 여러 책임 영역 명확

Pattern 2 → Pattern 6 (5-Plane → Hybrid):
  - 도메인이 추가로 분리됨
  - Pipeline 영역이 새로 생김

Pattern 6 → Pattern 2 (Hybrid → 5-Plane, 단순화):
  - Hybrid 위험 신호 5개+ 발생
  - 솔로가 따라잡기 힘듦
```

## 마이그레이션 절차

```
1. ADR 작성 (헌법 v3.3 Part 7.5)
   - 현재 패턴의 한계
   - 새 패턴이 해결할 문제
   - 마이그레이션 비용

2. 마이그레이션 Phase 별도 설정
   - 1~2주 별도 Phase
   - 기능 추가 동결
   - 구조만 재정렬

3. 검증
   - 모든 테스트 GREEN 유지
   - G5.5 인간 검증

4. CLAUDE.md 갱신
   - 새 패턴 명시
   - 자주 하는 실수 학습 기록
```

---

# 진산의 5+1개 프로젝트 패턴 매핑 (요약)

| 프로젝트           | PDS Size      | Domain      | 권장 패턴                                 | 이유                    |
| :----------------- | :------------ | :---------- | :---------------------------------------- | :---------------------- |
| **VOID BILL**      | Large         | SaaS        | **Pattern 2 (5-Plane)**                   | 결제+Admin+UI 명확 분리 |
| **VOID CODEX**     | XLarge        | SaaS+Domain | **Pattern 6 (5-Plane + Domain Vertical)** | 4도메인 + 사용자/Admin  |
| **ScoreForge**     | Large         | Pipeline    | **Pattern 3 (Pipeline Stage)**            | 4단계 변환 명확         |
| **VOID UTIL Hub**  | Large         | Hub         | **Pattern 5 (Core-Plugin)**               | Core + 무한 plugins     |
| **VOID TIME Burn** | Small         | Tool        | **Pattern 0 (Single Module)**             | 작음, 분할 손해         |
| **Agora**          | Medium (잔여) | SaaS        | **Pattern 1 (Phase-based)**               | G5.5 검증 Phase만       |

---

# 페르소나 COT 검증 (이 카탈로그)

## 🎩 MEPHISTO

> "7개 패턴이 모든 케이스 커버? 95%+ 커버. 못 잡는 5%는 Pattern 6의 변형으로."

## 🏛️ ARCHITECT

> "패턴 간 마이그레이션 경로 명시? ✓ 변경 신호 + 절차 명시"

## 🔨 BREAKER

> "잘못된 패턴 선택 위험? — 진단(01)을 먼저 하면 위험 ↓. 그래도 첫 적용은 회고 필수"

## 👤 ADVOCATE

> "솔로가 7개 패턴 다 외울 필요 없음. 진단 결과 따라 1~2개만 깊이 알면 됨"

## 🔮 ORACLE

> "Pattern 0 (분할 안 함)이 첫 패턴인 게 핵심. 분할이 무조건 좋다는 환상 차단"

---

# 다음 단계

```
패턴 결정 후:
  → 03. Role Definition Standard (각 Plane/Stage/Domain 역할 정의)
  → 04. Information Sharing Protocol (정보 동기화)
  → 05. Planning Workbook (Stage -1 ~ Stage 0.8)
```

---

**END OF 02. DECOMPOSITION PATTERN CATALOG**

_"There are no universal patterns. Only fitting ones for specific contexts."_
