/**
 * BATCH 1 파이프라인 오케스트레이터
 *
 * 실행 순서:
 *   Stage 1: PDF 추출 (M01)
 *   Stage 2: 섹션 분리 (M06)
 *   Stage 3: Claude API 배치 구조화 (M07 + M08 검증)
 *   Stage 4: Constants 추출 (M09)
 *   Stage 5: DB 적재 (status='draft')
 *   Stage 6: Graph 무결성 검증 (M14)
 *   Stage 7: 인간 검수 (M28 Graph Visualizer)
 *   Stage 8: Formula Engine 검증 (M16)
 *   Stage 9: QG-2 게이트
 *
 * 현재 PoC: Stage 6~9만 코드로 실행 가능.
 * Stage 1~5는 실제 PDF + Claude API 필요 (수동 실행).
 */

export type PipelineStage =
  | 'pdf_extract'
  | 'section_split'
  | 'batch_structurize'
  | 'constants_extract'
  | 'db_load'
  | 'integrity_check'
  | 'human_review'
  | 'formula_verify'
  | 'qg2_gate';

export interface StageResult {
  readonly stage: PipelineStage;
  readonly status: 'success' | 'failed' | 'skipped';
  readonly message: string;
  readonly durationMs?: number;
}

export interface PipelineResult {
  readonly batchId: string;
  readonly stages: readonly StageResult[];
  readonly qg2Passed: boolean;
}

/**
 * 파이프라인 Stage 순서 정의.
 * 각 Stage는 이전 Stage 성공 시에만 진행.
 */
export const PIPELINE_STAGES: readonly PipelineStage[] = [
  'pdf_extract',
  'section_split',
  'batch_structurize',
  'constants_extract',
  'db_load',
  'integrity_check',
  'human_review',
  'formula_verify',
  'qg2_gate',
] as const;

/**
 * 배치별 범위 정의
 */
export const BATCH_CONFIGS = {
  'BATCH-1': {
    batchId: 'BATCH-1',
    pageRange: 'p.403~434',
    description: '적과전 종합위험',
    expectedNodes: 60,
    expectedEdges: 200,
    expectedFormulas: 13,
  },
  'BATCH-2': {
    batchId: 'BATCH-2',
    pageRange: 'p.435~500',
    description: '종합위험 수확감소 16종',
    expectedNodes: 80,
    expectedEdges: 300,
    expectedFormulas: 17,
  },
  'BATCH-3': {
    batchId: 'BATCH-3',
    pageRange: 'p.501~521',
    description: '논작물(벼, 맥류)',
    expectedNodes: 40,
    expectedEdges: 120,
    expectedFormulas: 8,
  },
  'BATCH-4': {
    batchId: 'BATCH-4',
    pageRange: 'p.522~576',
    description: '밭작물',
    expectedNodes: 60,
    expectedEdges: 200,
    expectedFormulas: 15,
  },
  'BATCH-5': {
    batchId: 'BATCH-5',
    pageRange: 'p.577~647',
    description: '시설작물 + 수입감소',
    expectedNodes: 60,
    expectedEdges: 200,
    expectedFormulas: 15,
  },
} as const;

/** BATCH 1 호환 alias */
export const BATCH1_CONFIG = BATCH_CONFIGS['BATCH-1'];
