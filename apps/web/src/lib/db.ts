/**
 * ThePick IndexedDB Schema (Dexie.js)
 *
 * 9 stores mirroring D1 tables for offline-first PWA.
 * revision_changes는 관리자 전용 데이터로 클라이언트 동기화 대상에서 제외.
 * Only indexed fields are listed — Dexie stores all properties.
 *
 * ⚠️ 현 단계 (가-1) 동기화 방향: D1 → IndexedDB 단방향 read only.
 * `offlineActions` 큐 schema 만 정의. enqueue/replay 로직은 Phase 2 본격 구현 (BE C-3 명시 이월).
 * 클라이언트 진도 변경 → D1 동기화 경로는 현재 미구현 — 학습자 진도는 IndexedDB 만 갱신.
 * Phase 2 진입 시 sync-engine 모듈 신설 + Background Sync API 활용 예정.
 */

import Dexie, { type Table } from 'dexie';

// --- Row types (client-side subset of D1 schema) ---

export interface IKnowledgeNode {
  id: string;
  type: string;
  name: string;
  description: string | null;
  lv1Insurance: string | null;
  lv2Crop: string | null;
  lv3Investigation: string | null;
  pageRef: string | null;
  /**
   * ADR-030 / migrations/0019 — 사용자 노출용 본문 페이지 ("교재 본문 p.396 참고").
   * D1 컬럼 자체는 NULLABLE (ALTER TABLE ADD COLUMN 제약 + 기존 row 호환), 다만
   * 신규 INSERT 는 트리거 enforce_book_page_on_insert 가 NOT NULL 강제.
   * Phase 2 sync engine 활성 시 D1 → IndexedDB mirror 의무 (수험자 "근거 보기" UX 1급).
   */
  bookPage: number | null;
  /** ADR-030 / migrations/0019 — PDF 추적용 페이지. 본문/PDF offset 분리 (수험자 노출 X). */
  pdfPage: number | null;
  /** ADR-030 — 챕터 타이틀 (예: "제1장 농업재해보험 손해평가 개관"). 법령 노드 등 NULL 허용. */
  chapter: string | null;
  /** ADR-030 — 절 타이틀 (예: "제3절 현지조사 내용"). NULL 허용. */
  section: string | null;
  batchId: string | null;
  versionYear: number;
  supersededBy: string | null;
  truthWeight: number;
  status: string;
  examScope: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IKnowledgeEdge {
  id: string;
  fromNode: string;
  toNode: string;
  edgeType: string;
  condition: string | null;
  priority: number;
  isActive: number;
  createdAt: string;
}

export interface IFormula {
  id: string;
  name: string;
  equationTemplate: string;
  equationDisplay: string | null;
  variablesSchema: string;
  constraints: string | null;
  expectedInputs: string | null;
  gracefulDegradation: string | null;
  pageRef: string | null;
  nodeId: string | null;
  versionYear: number;
  supersededBy: string | null;
  createdAt: string;
}

export interface IConstant {
  id: string;
  category: string;
  name: string;
  value: string;
  numericValue: number | null;
  appliesTo: string;
  insuranceType: string | null;
  confusionRisk: string | null;
  confusionLevel: string | null;
  unit: string | null;
  pageRef: string | null;
  versionYear: number;
  examFrequency: number | null;
  relatedFormula: string | null;
  examScope: string | null;
  createdAt: string;
}

export interface IExamQuestion {
  id: string;
  year: number;
  round: number | null;
  questionNumber: number | null;
  subject: string | null;
  content: string;
  answer: string | null;
  explanation: string | null;
  validFrom: string | null;
  validUntil: string | null;
  supersededBy: string | null;
  relatedNodes: string | null;
  relatedConstants: string | null;
  status: string;
  examType: string;
  topicCluster: string | null;
  memorizationType: string | null;
  confusionType: string | null;
  createdAt: string;
}

export interface IMnemonicCard {
  id: string;
  targetType: string;
  targetId: string;
  confusionType: string | null;
  memorizationMethod: string;
  content: string;
  reverseVerified: number | null;
  examScope: string | null;
  status: string | null;
  createdAt: string;
}

export interface IUserProgress {
  id: string;
  userId: string;
  nodeId: string | null;
  cardId: string | null;
  cardType: string;
  fsrsDifficulty: number;
  fsrsStability: number;
  fsrsInterval: number;
  fsrsNextReview: string | null;
  totalReviews: number;
  correctCount: number;
  lastConfusionType: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ITopicCluster {
  id: string;
  name: string;
  lv1: string | null;
  lv2: string | null;
  lv3: string | null;
  examFrequency: number;
  questionIds: string | null;
  isCovered: number;
  source: string | null;
  createdAt: string;
}

export interface IOfflineAction {
  id?: number;
  userId: string;
  action: string;
  payload: string;
  createdAt: string;
  synced: number;
}

// --- Database ---

class ThePick extends Dexie {
  knowledgeNodes!: Table<IKnowledgeNode, string>;
  knowledgeEdges!: Table<IKnowledgeEdge, string>;
  formulas!: Table<IFormula, string>;
  constants!: Table<IConstant, string>;
  examQuestions!: Table<IExamQuestion, string>;
  mnemonicCards!: Table<IMnemonicCard, string>;
  userProgress!: Table<IUserProgress, string>;
  topicClusters!: Table<ITopicCluster, string>;
  offlineActions!: Table<IOfflineAction, number>;

  constructor() {
    super('thepick');

    this.version(1).stores({
      knowledgeNodes: 'id, type, lv1Insurance, lv2Crop, status, examScope',
      knowledgeEdges: 'id, fromNode, toNode, edgeType, isActive',
      formulas: 'id, nodeId, versionYear',
      constants: 'id, category, confusionLevel, versionYear, examScope',
      examQuestions: 'id, year, status, examType, subject, topicCluster',
      mnemonicCards: 'id, targetId, confusionType, memorizationMethod',
      userProgress: 'id, userId, nodeId, fsrsNextReview',
      offlineActions: '++id, userId, synced, createdAt',
    });

    // v2: topicClusters 추가 (Phase 0 감사에서 D1 스키마 누락 발견).
    // v1 배포 이력 없으나, Dexie 마이그레이션 패턴 유지를 위해 분리.
    // 향후 스토어 추가/인덱스 변경 시 version(3)으로 증분할 것.
    this.version(2).stores({
      topicClusters: 'id, lv1, examFrequency, isCovered',
    });
  }
}

export const db = new ThePick();
