/**
 * ThePick IndexedDB Schema (Dexie.js)
 *
 * 9 stores mirroring D1 tables for offline-first PWA.
 * revision_changes는 관리자 전용 데이터로 클라이언트 동기화 대상에서 제외.
 * Only indexed fields are listed — Dexie stores all properties.
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
