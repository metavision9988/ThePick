# 📋 쪽집게 UI/UX + 프론트엔드 아키텍처 + 확장성 전략

> **DEV COVEN 합동 산출물 — Frontend Master Plan v1.0**
> PWA, 오프라인, 반응형, 관리자, 확장성을 포괄하는 전체 프론트엔드 설계
>
> 작성일: 2026-04-07
> 핵심 원칙: **"모바일 퍼스트, 오프라인 퍼스트, 확장 가능한 구조"**

---

## 목차

1. [설계 원칙 + 기술 결정](#1-설계-원칙--기술-결정)
2. [PWA 아키텍처](#2-pwa-아키텍처)
3. [오프라인 + 로컬 스토리지 전략](#3-오프라인--로컬-스토리지-전략)
4. [반응형 UI 설계](#4-반응형-ui-설계)
5. [학습자 앱 화면 설계](#5-학습자-앱-화면-설계)
6. [학습 진도 관리 시스템](#6-학습-진도-관리-시스템)
7. [관리자 CMS 설계](#7-관리자-cms-설계)
8. [기능 우선순위 + 확장 전략](#8-기능-우선순위--확장-전략)
9. [프론트엔드 프로젝트 구조](#9-프론트엔드-프로젝트-구조)
10. [개발 로드맵 (프론트엔드)](#10-개발-로드맵)

---

## 1. 설계 원칙 + 기술 결정

### 1.1 3대 원칙

```
1. Mobile First, Offline First
   → 수험생 = 지하철/버스/카페에서 5분 짬짬이 학습
   → 터널에서도 끊기면 안 됨
   → 모바일이 주(80%), 태블릿(15%), 데스크탑(5%)

2. 트래픽 최소화, 로컬 최대화
   → 학습 데이터는 IndexedDB에 캐싱
   → 서버 호출은 동기화 + 신규 컨텐츠 다운로드만
   → 월 데이터 사용량 목표: 50MB 이하

3. 확장 가능한 플러그인 구조
   → 핵심(Core) + 플러그인(Plugin) 분리
   → 새 기능 추가 시 기존 코드 수정 최소화
   → 새 시험 과목 추가 = 플러그인 추가 수준
```

### 1.2 기술 결정 (ADR)

| 결정 사항   | 선택                           | 근거                                                        |
| ----------- | ------------------------------ | ----------------------------------------------------------- |
| 앱 형태     | **PWA** (네이티브 앱 X)        | 설치 없이 즉시 사용, 스토어 심사 불필요, 업데이트 즉시 반영 |
| 프레임워크  | **Astro + React Islands**      | 정적 페이지 빠름, 인터랙티브 부분만 React, 번들 최소화      |
| 상태관리    | **Zustand** + IndexedDB 동기화 | 경량, React 외부에서도 접근, 오프라인 상태 관리             |
| CSS         | **Tailwind CSS** + shadcn/ui   | 모바일 반응형 기본 내장, 일관된 디자인 시스템               |
| 로컬 DB     | **IndexedDB** (Dexie.js 래퍼)  | 용량 무제한(실질적), 구조화 쿼리, 오프라인 핵심             |
| 동기화      | **Background Sync API**        | 오프라인 중 학습 → 온라인 복귀 시 자동 동기화               |
| 푸시 알림   | **Web Push API**               | 복습 알림, 네이티브 앱 불필요                               |
| 반응형 기준 | 360px / 768px / 1024px         | 모바일 / 태블릿 / 데스크탑                                  |

### 1.3 왜 PWA인가 (네이티브 앱 대비)

| 비교 항목 | PWA                                | 네이티브 앱          |
| --------- | ---------------------------------- | -------------------- |
| 설치      | 홈화면 추가 (1탭)                  | 스토어 다운로드      |
| 업데이트  | 자동 (Service Worker)              | 스토어 심사 1~3일    |
| 오프라인  | Service Worker 캐싱                | 기본 지원            |
| 푸시 알림 | Web Push (Android 완전, iOS 16.4+) | 완전 지원            |
| 개발 비용 | 1 코드베이스                       | iOS + Android 별도   |
| 성능      | 충분 (학습 앱 수준)                | 더 빠름 (3D/게임 등) |

**결론:** 학습 앱은 PWA로 충분. 네이티브가 필요한 시점(카메라 OCR, 위젯)은 Phase 3 이후 판단.

---

## 2. PWA 아키텍처

### 2.1 Service Worker 전략

```
┌─────────────────────────────────────────────────────────────────────┐
│  Service Worker 캐싱 전략                                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [Cache First] — 정적 에셋 (변경 거의 없음)                        │
│  ├── HTML 셸 (app-shell.html)                                      │
│  ├── CSS/JS 번들                                                    │
│  ├── 폰트, 아이콘                                                  │
│  └── 이미지 (로고, UI 요소)                                        │
│                                                                     │
│  [StaleWhileRevalidate] — 학습 컨텐츠 (가끔 업데이트)              │
│  ├── knowledge_nodes 데이터                                         │
│  ├── constants 데이터                                               │
│  ├── 기출 문제 데이터                                               │
│  └── 플래시카드 데이터                                              │
│                                                                     │
│  [NetworkFirst] — 동적 데이터 (자주 변경)                           │
│  ├── 학습 진도 동기화                                               │
│  ├── FSRS 스케줄 업데이트                                           │
│  └── 사용자 프로필                                                  │
│                                                                     │
│  [NetworkOnly] — 실시간 필수                                        │
│  ├── AI 튜터 질의응답                                               │
│  ├── 결제/구독 처리                                                 │
│  └── 관리자 CMS 작업                                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 manifest.json 핵심 설정

```json
{
  "name": "쪽집게 — 손해평가사 합격",
  "short_name": "쪽집게",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#1D9E75",
  "background_color": "#FFFFFF",
  "categories": ["education"],
  "description": "손해평가사 1차+2차 AI 학습 서비스",
  "screenshots": [],
  "icons": [
    { "src": "/icons/192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### 2.3 설치 프로모션 전략

```
[첫 방문]
 → 일반 웹으로 체험 (로그인 불필요)
 → 기출 3문항 무료 풀이 제공

[3회차 방문 or 회원가입 시]
 → "홈 화면에 추가하면 오프라인 학습 가능" 배너 표시
 → Install Prompt 트리거

[설치 후]
 → 오프라인 학습 데이터 자동 다운로드
 → 복습 알림 활성화 안내
```

---

## 3. 오프라인 + 로컬 스토리지 전략

### 3.1 IndexedDB 스키마 (Dexie.js)

```typescript
// lib/local-db.ts
import Dexie from 'dexie';

class JjokjipgeDB extends Dexie {
  // 학습 컨텐츠 (서버에서 동기화)
  knowledgeNodes!: Table<LocalKnowledgeNode>;
  constants!: Table<LocalConstant>;
  examQuestions!: Table<LocalExamQuestion>;
  flashcards!: Table<LocalFlashcard>;
  mnemonicCards!: Table<LocalMnemonicCard>;

  // 사용자 학습 데이터 (로컬 우선, 서버 동기화)
  userProgress!: Table<LocalUserProgress>;
  studySessions!: Table<LocalStudySession>;
  offlineActions!: Table<OfflineAction>; // 오프라인 중 발생한 액션 큐

  constructor() {
    super('jjokjipge');
    this.version(1).stores({
      knowledgeNodes: 'id, type, examScope, lv1, lv2, [examScope+lv1]',
      constants: 'id, category, confusionLevel, examScope',
      examQuestions: 'id, examType, subject, year, [subject+year]',
      flashcards: 'id, targetId, confusionType, [confusionType+status]',
      mnemonicCards: 'id, targetId, method',
      userProgress: 'id, nodeId, cardType, nextReview, [cardType+nextReview]',
      studySessions: 'id, date, subject, mode',
      offlineActions: '++id, timestamp, synced',
    });
  }
}
```

### 3.2 데이터 계층 (서버 vs 로컬)

```
┌─────────────────────────────────────────────────────────────────────┐
│  데이터 계층 아키텍처                                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [서버 (D1) — 원본 데이터]                                         │
│  ├── knowledge_nodes: ~1,140 노드 (전체)                           │
│  ├── constants: ~150 항목 (전체)                                    │
│  ├── exam_questions: ~825 문항 (전체)                               │
│  ├── formulas: ~125 산식 (전체)                                     │
│  ├── user_progress: 모든 사용자 (전체)                              │
│  └── revision_changes: 개정 이력 (전체)                             │
│                                                                     │
│  [IndexedDB — 로컬 캐시]                                           │
│  ├── 학습 중인 과목의 nodes/constants/questions만 다운로드           │
│  │   예: "1차 상법만 학습 중" → 상법 관련 ~170 노드만 로컬         │
│  ├── userProgress: 전부 로컬 (이것이 오프라인 학습의 핵심)          │
│  ├── flashcards: 오늘의 복습 카드 50장 미리 다운로드                │
│  └── offlineActions: 오프라인 중 학습 기록 → 온라인 시 동기화       │
│                                                                     │
│  [메모리 (Zustand) — 현재 세션]                                     │
│  ├── currentSession: 현재 학습 세션 상태                            │
│  ├── currentCard: 현재 보고 있는 카드/문제                          │
│  └── uiState: 모달, 필터, 설정 등                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.3 오프라인 동기화 프로토콜

```
[오프라인 중 학습]
  사용자가 카드 학습 → userProgress 로컬 업데이트
                     → offlineActions 큐에 추가
                     → UI 정상 동작 (사용자는 온/오프라인 구분 불가)

[온라인 복귀]
  1. offlineActions 큐에서 미동기화 액션 추출
  2. 타임스탬프 순서대로 서버에 배치 전송
  3. 서버 응답 확인 후 synced=true 마킹
  4. 서버의 최신 데이터(다른 기기 학습분) pull
  5. 충돌 해결: 서버 타임스탬프 > 로컬 → 서버 우선
                로컬 타임스탬프 > 서버 → 로컬 우선 (학습 데이터 유실 방지)
```

### 3.4 트래픽 최소화 전략

| 전략                 | 방법                                   | 절감 효과               |
| -------------------- | -------------------------------------- | ----------------------- |
| 초기 다운로드 최소화 | 학습 중인 과목만 다운로드              | 전체 대비 ~25%          |
| 차분(Delta) 동기화   | 변경된 항목만 동기화 (updated_at 기준) | API 호출 90% 감소       |
| 이미지 최소화        | SVG 우선, WebP 압축, lazy loading      | 이미지 트래픽 80% 감소  |
| API 응답 압축        | Brotli 압축 (Cloudflare 자동)          | 응답 크기 70% 감소      |
| 프리페치             | 다음 복습 카드 50장 미리 캐싱          | 학습 중 네트워크 호출 0 |
| 배치 동기화          | 실시간 대신 5분 간격 배치              | API 호출 수 95% 감소    |

### 3.5 예상 로컬 스토리지 사용량

| 데이터             | 항목 수  | 예상 크기 | 비고                    |
| ------------------ | -------- | --------- | ----------------------- |
| 1과목 nodes        | ~170     | ~200KB    | JSON                    |
| 2과목 nodes        | ~220     | ~250KB    | JSON                    |
| 3과목 nodes        | ~280     | ~320KB    | JSON                    |
| 2차 nodes          | ~620     | ~700KB    | JSON                    |
| constants 전체     | ~150     | ~50KB     | JSON                    |
| 기출 전체          | ~825문항 | ~2MB      | 지문 포함               |
| flashcards         | ~500장   | ~300KB    | 진행 중인 것만          |
| userProgress       | ~2,000   | ~200KB    |                         |
| **합계 (전 과목)** |          | **~4MB**  | IndexedDB 한도의 ~0.01% |

---

## 4. 반응형 UI 설계

### 4.1 브레이크포인트

```
[Mobile]    0 ~ 767px     1컬럼, 풀스크린 카드, 바텀 네비게이션
[Tablet]  768 ~ 1023px    2컬럼 가능, 사이드바 접기, 탑 네비게이션
[Desktop] 1024px+         3컬럼, 사이드바 고정, 넓은 대시보드
```

### 4.2 레이아웃 패턴

```
[Mobile — 주력]
┌──────────────────────┐
│  상태바 (D-23, 진도) │  ← 항상 보이는 미니 상태
├──────────────────────┤
│                      │
│                      │
│    메인 컨텐츠       │  ← 카드/문제/해설이 풀스크린
│    (풀스크린)        │
│                      │
│                      │
├──────────────────────┤
│ 🏠  📖  📊  ⚙️     │  ← 바텀 네비게이션 (4탭)
└──────────────────────┘

[Tablet — 학습 최적화]
┌────────────┬─────────────────────┐
│            │                     │
│  사이드바   │    메인 컨텐츠      │
│  (과목/    │    (카드/문제)       │
│   토픽     │                     │
│   필터)    │                     │
│            │                     │
└────────────┴─────────────────────┘

[Desktop — 관리자/대시보드]
┌────────┬───────────────────┬──────────┐
│        │                   │          │
│ 사이드바│   메인 컨텐츠     │  보조    │
│ (네비) │   (카드/문제)     │  패널    │
│        │                   │  (해설/  │
│        │                   │   통계)  │
└────────┴───────────────────┴──────────┘
```

### 4.3 핵심 인터랙션 (모바일 특화)

```
[플래시카드 학습]
  탭(중앙)     → 정답 보기/숨기기
  스와이프 ←   → 모름 (FSRS: Again)
  스와이프 →   → 앎 (FSRS: Good)
  스와이프 ↑   → 애매함 (FSRS: Hard)
  스와이프 ↓   → 관련 기출 보기
  더블탭       → 북마크

[기출 풀이]
  탭(선지)     → 선택
  스와이프 ←→  → 이전/다음 문제
  핀치 줌      → 수식/도표 확대

[복습 알림]
  Web Push     → "오늘 복습할 카드 15장 있습니다"
  탭           → 바로 복습 모드 진입
```

---

## 5. 학습자 앱 화면 설계

### 5.1 Information Architecture

```
[홈] — 오늘의 학습 허브
├── 오늘의 복습 카드 (FSRS 기반, 카운트 표시)
├── 빠른 이어하기 (최근 학습 이어서)
├── D-day 위젯 (시험일까지 남은 일수)
├── 오늘의 진도 바 (목표 대비 달성률)
└── 개정사항 알림 (새 개정 있으면 배너)

[학습] — 메인 학습 영역
├── 과목 선택 (1차 3과목 / 2차 2과목)
│   └── 토픽 선택 (LV2/LV3 기반)
├── 학습 모드 선택
│   ├── 플래시카드 (암기)
│   ├── 기출 풀이 (실전)
│   ├── 약점 공략 (혼동 유형별)
│   ├── 산식 연습 (계산기)
│   └── 모의시험 (시뮬레이션)
└── 학습 설정
    ├── 카드 수 (10/20/30/50)
    ├── 난이도 필터
    └── 혼동 유형 필터

[분석] — 학습 대시보드
├── 과목별 진도율 (도넛 차트)
├── 취약 영역 히트맵 (어디가 약한지)
├── 정답률 추이 (라인 차트)
├── 혼동 유형별 정확도 (레이더 차트)
├── 합격 예측 (예상 점수 + 합격 확률)
└── 주간 리포트

[설정]
├── 프로필 / 구독
├── 알림 설정 (복습 시간, 빈도)
├── 학습 목표 (일일 카드 수, D-day)
├── 데이터 관리 (오프라인 다운로드, 캐시 초기화)
├── 다크모드
└── 접근성 (글꼴 크기, 고대비)
```

### 5.2 핵심 화면 상세

#### 홈 화면

```
┌──────────────────────────┐
│  D-23  📊 72%  🔥 5일연속│  ← 미니 상태바
├──────────────────────────┤
│                          │
│  오늘의 복습              │
│  ┌────────────────────┐  │
│  │  📋 15장 남음      │  │  ← 탭하면 바로 복습 시작
│  │  ▓▓▓▓▓▓▓░░░ 70%   │  │
│  │  [바로 시작]        │  │
│  └────────────────────┘  │
│                          │
│  이어하기                 │
│  ┌────────────────────┐  │
│  │  🔖 농학 > 재배환경 │  │  ← 최근 학습 위치
│  │  어제 12문항 중 8번  │  │
│  └────────────────────┘  │
│                          │
│  ⚠️ 개정 알림            │
│  ┌────────────────────┐  │
│  │  밭작물 수확감소    │  │  ← 2025.12.26 개정
│  │  5개 항목 변경됨    │  │
│  │  [확인하기]         │  │
│  └────────────────────┘  │
│                          │
├──────────────────────────┤
│  🏠   📖   📊   ⚙️     │
└──────────────────────────┘
```

#### 플래시카드 화면

```
┌──────────────────────────┐
│  ← 뒤로   3/15   ⭐ 북마크│
├──────────────────────────┤
│                          │
│                          │
│   경작불능 판정 기준은?   │  ← 질문 (앞면)
│                          │
│                          │
│       [탭하여 정답 보기]  │
│                          │
│                          │
│──────────────────────────│
│                          │
│  🔴 암기필수              │  ← 혼동등급 태그
│  혼동: 분질미는 60%       │
│                          │
├──────────────────────────┤
│  ←모름    ↑애매    앎→   │  ← 스와이프 가이드
└──────────────────────────┘

[탭 후 — 뒷면]
┌──────────────────────────┐
│  ← 뒤로   3/15   ⭐ 북마크│
├──────────────────────────┤
│                          │
│   정답: 65%              │  ← 정답
│                          │
│   단, 분질미는 60%        │  ← 예외 강조
│                          │
│   암기법: "육오(65)가     │  ← 자동 매칭된 암기법
│   기본, 분(가루)질미는    │
│   부(60)드러워서 더 낮아" │
│                          │
│   📄 관련 기출 3문항      │  ← 탭하면 기출 연결
│   📖 교재 p.507          │
│                          │
├──────────────────────────┤
│  ←모름    ↑애매    앎→   │
└──────────────────────────┘
```

---

## 6. 학습 진도 관리 시스템

### 6.1 진도 추적 모델

```typescript
// 사용자 학습 상태 3계층

interface UserLearningState {
  // Level 1: 과목별 전체 진도
  subjects: {
    [subjectId: string]: {
      totalNodes: number;
      learnedNodes: number; // 1회 이상 학습
      masteredNodes: number; // FSRS stability > 30일
      progressPercent: number;
      estimatedScore: number; // 합격 예측 점수
      weakAreas: WeakArea[]; // 취약 영역 TOP 5
    };
  };

  // Level 2: 토픽별 상세 진도
  topics: {
    [topicId: string]: {
      totalCards: number;
      dueCards: number; // 오늘 복습 필요
      correctRate: number; // 최근 7일 정답률
      avgFsrsStability: number; // 평균 기억 안정도
      confusionTypes: string[]; // 이 토픽의 주요 혼동 유형
    };
  };

  // Level 3: 카드별 FSRS 상태
  cards: {
    [cardId: string]: {
      difficulty: number;
      stability: number;
      interval: number;
      nextReview: Date;
      totalReviews: number;
      correctCount: number;
      lastConfusionType: string;
    };
  };
}
```

### 6.2 합격 예측 모델

```
예상 점수 = Σ(토픽별 가중치 × 토픽 mastery)

토픽 mastery = f(
  정답률(최근 7일),
  FSRS 평균 stability,
  기출 출제 빈도,
  혼동 유형별 오답 이력
)

합격 확률 = sigmoid(예상 점수 - 합격선)

표시 예시:
"현재 예상: 58점 / 합격선 60점"
"A등급 토픽 4개만 더 마스터하면 합격 확률 85%"
```

### 6.3 오프라인 진도 저장 흐름

```
[학습 중 (온/오프라인 무관)]
  카드 응답 → Zustand 상태 업데이트 (즉시 반영)
           → IndexedDB userProgress 업데이트 (영구 저장)
           → offlineActions 큐에 추가 (동기화 대기)

[오프라인 → 온라인 전환]
  Background Sync 트리거
  → offlineActions에서 미전송 액션 추출
  → POST /api/sync/progress (배치)
  → 서버 응답 성공 → synced=true

[다른 기기에서 접속]
  → GET /api/sync/progress?since={lastSync}
  → 서버의 최신 데이터로 IndexedDB 업데이트
  → 충돌 시: 더 최근 타임스탬프 우선
```

---

## 7. 관리자 CMS 설계

### 7.1 관리자 앱 구조

```
[관리자 CMS] — 별도 라우트 /admin (데스크탑 전용)
├── 대시보드
│   ├── 전체 사용자 수 / 활성 사용자
│   ├── 일일 학습 세션 수
│   ├── 오답 신고 현황
│   └── 시스템 상태 (API 응답시간, 에러율)
│
├── 콘텐츠 관리
│   ├── Graph Visualizer (노드/엣지 시각화 + 검수)
│   │   ├── 서브그래프 필터 (과목/토픽/상태)
│   │   ├── 노드 클릭 → 상세 편집
│   │   └── 상태 변경 (draft → review → approved)
│   ├── Constants 관리 (매직넘버 검수)
│   ├── 산식(Formulas) 관리 + 테스트 실행
│   ├── 기출문제 관리 (정답 확인, 태깅)
│   ├── 개정이력 관리 (revision_changes)
│   └── 암기법 카드 관리 (AI 생성 검수)
│
├── 사용자 관리
│   ├── 사용자 목록 / 검색
│   ├── 구독 상태 관리
│   └── 학습 통계 조회
│
├── 문제 생성 관리
│   ├── AI 생성 문제 검수 큐
│   ├── 오답 신고 처리 큐
│   └── 문제 품질 통계
│
└── 시스템 설정
    ├── 파이프라인 실행 (배치 처리)
    ├── 동기화 상태 모니터링
    └── 캐시 관리
```

### 7.2 콘텐츠 워크플로우 (RAR Cycle)

```
[AI 자동 생성/추출]
       │
       ▼
   ┌────────┐
   │ draft  │  ← 모든 AI 산출물은 여기서 시작
   └───┬────┘
       │ 관리자 1차 검토
       ▼
   ┌────────┐
   │ review │  ← 관리자가 내용 확인 중
   └───┬────┘
       │ 승인 (또는 반려 → draft로 되돌림)
       ▼
  ┌──────────┐
  │ approved │  ← 사용자에게 노출 가능
  └───┬──────┘
      │ 최종 검증 후
      ▼
  ┌───────────┐
  │ published │  ← 프로덕션 데이터
  └───────────┘

규칙:
- draft → 사용자 노출 절대 금지
- review → 사용자 노출 절대 금지
- approved → 사용자 노출 가능 (신규 컨텐츠 태그)
- published → 검증 완료 데이터
```

---

## 8. 기능 우선순위 + 확장 전략

### 8.1 3계층 아키텍처 (Core + Service + Plugin)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 3: Plugin (추후 확장)                                       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                      │
│  게이미피케이션 | 스터디그룹 | 오디오모드 | Apple Watch              │
│  AI코칭 | 시험전략 | SNS공유 | 위젯 | 다른시험과목플러그인          │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 2: Service (Phase별 단계 추가)                              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                │
│  기출풀이 | 플래시카드 | 모의시험 | 약점공략 | 대시보드             │
│  문제생성 | 암기법생성 | 합격예측 | 개정알림 | AI튜터               │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 1: Core (최초 구축, 변경 최소)                              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                               │
│  GraphRAG엔진 | FormulaEngine | FSRS엔진 | 혼동감지엔진           │
│  IndexedDB동기화 | PWA ServiceWorker | 인증 | API 라우팅            │
│  DB 스키마 | Ontology Registry | 관리자CMS기본                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.2 전체 기능 우선순위 매트릭스

| 우선순위                    | 기능                                | 시점      | 근거                |
| --------------------------- | ----------------------------------- | --------- | ------------------- |
| **P0 — 없으면 서비스 불가** |                                     |           |                     |
|                             | PWA 셸 + Service Worker             | Phase 0   | 앱의 뼈대           |
|                             | IndexedDB + 오프라인 동기화         | Phase 0   | 오프라인 학습 핵심  |
|                             | 사용자 인증 (JWT)                   | Phase 0   | 진도 저장의 전제    |
|                             | 기출 풀이 모드                      | Phase 1   | 수험생 최초 가치    |
|                             | FSRS 복습 모드                      | Phase 1   | 암기 서비스의 핵심  |
|                             | 학습 진도 저장/복원                 | Phase 1   | 오프라인+멀티기기   |
| **P1 — 차별화 핵심**        |                                     |           |                     |
|                             | 플래시카드 (스와이프)               | Phase 1   | 모바일 학습 핵심 UX |
|                             | 혼동 유형별 약점 공략               | Phase 2   | 경쟁사 없는 기능    |
|                             | 암기법 자동 매칭 + AI 생성          | Phase 2   | 최대 차별화         |
|                             | 개정사항 알림 + 최우선 학습         | Phase 2   | 시의성 = 출제 예측  |
|                             | 합격 예측 + 학습 대시보드           | Phase 2   | 사용자 동기 부여    |
|                             | 관리자 CMS (Graph Visualizer)       | Phase 1~2 | 콘텐츠 품질 보증    |
| **P2 — 서비스 완성도**      |                                     |           |                     |
|                             | 모의시험 모드 (타이머+채점)         | Phase 2   | 실전 감각           |
|                             | OX/빈칸 자동 생성                   | Phase 2   | 컨텐츠 확장         |
|                             | 기출 변형 생성                      | Phase 2   | 연습량 3배 확장     |
|                             | 산식 인터랙티브 계산기              | Phase 2   | 2차 계산 연습       |
|                             | 1차→2차 브릿지 학습 경로            | Phase 2   | 통합 학습 가치      |
|                             | 복습 알림 (Web Push)                | Phase 2   | 리텐션 핵심         |
|                             | 다크모드                            | Phase 2   | 야간 학습           |
| **P3 — 성장 후 추가**       |                                     |           |                     |
|                             | AI 튜터 (Graph RAG 질의응답)        | Phase 3   | API 비용 큼         |
|                             | 게이미피케이션 (스트릭, 레벨, 배지) | Phase 3   | 리텐션 강화         |
|                             | 오디오 모드 (TTS 복습)              | Phase 3   | 이동 중 학습        |
|                             | 스터디 그룹 / 랭킹                  | Phase 3+  | 소셜 기능           |
|                             | 홈 위젯 (Android/iOS)               | Phase 3+  | 네이티브 필요시     |
|                             | 다른 시험 과목 플러그인             | Phase 3+  | 사업 확장           |

### 8.3 확장 가능한 설계 패턴

```
[새 시험 과목 추가 시]
기존 코드 수정: 0
추가 작업:
1. ontology-registry.json에 새 과목 ID 추가
2. DB에 새 knowledge_nodes/constants/exam_questions INSERT
3. examScope 필터에 새 값 추가
→ 끝. UI, 엔진, FSRS, 동기화 등은 모두 examScope로 자동 분기.

[새 학습 모드 추가 시]
기존 코드 수정: 0
추가 작업:
1. /study/[mode]/ 새 라우트 추가 (Astro 페이지)
2. React Island 컴포넌트 개발
3. 학습 세션 타입에 새 모드 추가
→ Core 엔진(FSRS, GraphRAG, IndexedDB)은 그대로 사용.

[새 암기법 추가 시]
기존 코드 수정: 0
추가 작업:
1. mnemonic_cards.memorization_method에 새 값 추가
2. 해당 암기법 생성 프롬프트 템플릿 추가
3. 해당 암기법 표시 UI 컴포넌트 추가
→ 매칭 엔진의 매트릭스에 행 하나 추가.
```

---

## 9. 프론트엔드 프로젝트 구조

```
apps/web/                          # 학습자 PWA
├── public/
│   ├── manifest.json
│   ├── sw.js                      # Service Worker
│   └── icons/
├── src/
│   ├── pages/                     # Astro 페이지 (라우팅)
│   │   ├── index.astro            # 홈
│   │   ├── study/
│   │   │   ├── flashcard.astro    # 플래시카드
│   │   │   ├── exam.astro         # 기출 풀이
│   │   │   ├── weakness.astro     # 약점 공략
│   │   │   ├── mock.astro         # 모의시험
│   │   │   └── calculator.astro   # 산식 계산기
│   │   ├── analysis/
│   │   │   ├── dashboard.astro    # 대시보드
│   │   │   └── prediction.astro   # 합격 예측
│   │   └── settings.astro         # 설정
│   │
│   ├── components/                # React Islands
│   │   ├── core/                  # 공통 UI
│   │   │   ├── BottomNav.tsx
│   │   │   ├── StatusBar.tsx
│   │   │   ├── SwipeCard.tsx
│   │   │   └── ProgressBar.tsx
│   │   ├── study/                 # 학습 모드별
│   │   │   ├── FlashcardDeck.tsx
│   │   │   ├── ExamQuiz.tsx
│   │   │   ├── WeaknessTrainer.tsx
│   │   │   └── MockExam.tsx
│   │   ├── analysis/              # 분석 차트
│   │   │   ├── ProgressDonut.tsx
│   │   │   ├── WeaknessHeatmap.tsx
│   │   │   └── ScorePrediction.tsx
│   │   └── admin/                 # 관리자 (조건부 로딩)
│   │
│   ├── lib/                       # 유틸리티
│   │   ├── local-db.ts            # Dexie.js IndexedDB
│   │   ├── sync-engine.ts         # 오프라인 동기화
│   │   ├── fsrs-client.ts         # FSRS 클라이언트 (로컬 계산)
│   │   ├── confusion-detector.ts  # 혼동 유형 감지 (로컬)
│   │   └── push-manager.ts        # Web Push 관리
│   │
│   ├── stores/                    # Zustand
│   │   ├── session-store.ts       # 현재 학습 세션
│   │   ├── progress-store.ts      # 진도 상태
│   │   └── ui-store.ts            # UI 상태
│   │
│   └── styles/
│       └── global.css             # Tailwind 설정

apps/admin-web/                    # 관리자 CMS (데스크탑)
├── src/
│   ├── pages/
│   │   ├── index.astro            # 대시보드
│   │   ├── content/               # 콘텐츠 관리
│   │   │   ├── graph.astro        # Graph Visualizer
│   │   │   ├── constants.astro    # Constants 관리
│   │   │   ├── formulas.astro     # 산식 관리
│   │   │   └── questions.astro    # 문제 관리
│   │   ├── users.astro            # 사용자 관리
│   │   └── system.astro           # 시스템 설정
│   └── components/
│       ├── GraphViewer.tsx         # D3.js 그래프
│       ├── ContentEditor.tsx      # 노드/상수 편집기
│       └── ReviewQueue.tsx        # 검수 큐
```

---

## 10. 개발 로드맵 (프론트엔드)

### Phase 0 (Week 1~4) — 뼈대

```
[프론트엔드 태스크]
├── PWA 셸 구축 (manifest.json, sw.js, app-shell)
├── IndexedDB 스키마 + Dexie.js 설정
├── Zustand 스토어 기본 구조
├── 반응형 레이아웃 (바텀네비, 기본 페이지 구조)
├── 관리자 Graph Visualizer 기본 (D3.js)
└── 오프라인 감지 + 상태 표시 UI

[테스트]
├── PWA 설치 테스트 (Android Chrome, iOS Safari)
├── IndexedDB CRUD 테스트
├── 오프라인 → 온라인 전환 테스트
└── 반응형 브레이크포인트 테스트 (360/768/1024)
```

### Phase 1 (Week 5~10) — 핵심 학습 기능

```
[프론트엔드 태스크]
├── 플래시카드 UI (SwipeCard 컴포넌트)
├── 기출 풀이 UI (ExamQuiz 컴포넌트)
├── FSRS 클라이언트 (로컬 스케줄 계산)
├── 오프라인 동기화 엔진 (Background Sync)
├── 학습 진도 저장/복원
├── 관리자 CMS 콘텐츠 편집기
└── 사용자 인증 UI (로그인/회원가입)

[테스트]
├── 스와이프 제스처 정확도 (모바일 실기기)
├── FSRS 로컬 계산 = 서버 계산 일치 확인
├── 오프라인 50장 학습 → 온라인 동기화 정합성
├── 멀티 기기 동기화 (모바일 + 태블릿)
└── 학습 세션 중 앱 종료 → 재접속 시 이어하기
```

### Phase 2 (Week 11~14) — 서비스 완성

```
[프론트엔드 태스크]
├── 약점 공략 모드 UI
├── 모의시험 모드 UI (타이머 + 채점)
├── 학습 대시보드 (차트 4종)
├── 합격 예측 UI
├── 암기법 표시 UI (두문자어/연상법/Memory Palace)
├── 개정사항 알림 배너
├── 복습 알림 (Web Push 설정)
├── 다크모드
├── 관리자 CMS 검수 큐 + 통계
└── 1차→2차 브릿지 UI

[테스트]
├── 모의시험 채점 정확도 100%
├── 대시보드 수치 = 실제 학습 데이터 일치
├── Web Push 알림 수신 (Android + iOS)
├── 다크모드 전체 화면 깨짐 없음
└── 관리자 CMS → 콘텐츠 변경 → 학습자 앱 반영 E2E
```

### Phase 3 (Week 15~16) — 런칭 + 확장 준비

```
[프론트엔드 태스크]
├── 성능 최적화 (Core Web Vitals)
├── 베타 사용자 피드백 반영
├── 에러 바운더리 + 폴백 UI
├── 로딩 스켈레톤
├── 접근성 (A11y) 기본 점검
└── Plugin 인터페이스 준비 (향후 확장용 hook 포인트)

[성능 목표]
├── LCP < 2.5초 (모바일 4G)
├── FID < 100ms
├── CLS < 0.1
├── TTI < 3초
├── 오프라인 시작 < 1초 (Service Worker)
└── IndexedDB 쿼리 < 50ms
```

---

## 부록: 기술 결정 요약 (ADR)

| ADR     | 결정                             | 핵심 근거                                 |
| ------- | -------------------------------- | ----------------------------------------- |
| ADR-F01 | PWA (네이티브 X)                 | 1 코드베이스, 즉시 업데이트, 충분한 성능  |
| ADR-F02 | Astro + React Islands            | 정적 빠름 + 인터랙티브만 React, 번들 최소 |
| ADR-F03 | IndexedDB (Dexie.js)             | 용량 무제한, 구조화 쿼리, 오프라인 핵심   |
| ADR-F04 | Zustand (Redux X)                | 경량, React 외부 접근, 간결한 API         |
| ADR-F05 | Background Sync                  | 오프라인 학습 후 자동 동기화              |
| ADR-F06 | Web Push (네이티브 X)            | PWA와 일관, 별도 앱 불필요                |
| ADR-F07 | Tailwind + shadcn/ui             | 반응형 기본 내장, 일관된 디자인 시스템    |
| ADR-F08 | 3계층 구조 (Core/Service/Plugin) | 기능 추가 시 기존 코드 수정 0 목표        |
| ADR-F09 | 관리자 CMS 별도 앱               | 학습자 번들에 관리자 코드 미포함          |
| ADR-F10 | FSRS 클라이언트 로컬 실행        | 오프라인에서도 복습 스케줄 계산 가능      |

---

_"수험생에게 앱은 교재이자 선생이자 코치다._
_한 손에 들어야 하고, 전철에서 작동해야 하고, 끊겨도 멈추면 안 된다._
_이것이 모바일 퍼스트, 오프라인 퍼스트의 이유다."_

— DEV COVEN Frontend Master Plan v1.0
