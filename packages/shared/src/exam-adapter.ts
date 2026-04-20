/**
 * ExamAdapter — 멀티시험 격리 인터페이스 (타입 전용).
 *
 * 현재 (Year 1, Phase 1~3):
 *   손해평가사 단일 시험 구현. 본 파일의 타입은 선언만 존재하며,
 *   런타임 adapter 구현체는 Year 2 Phase 4 리팩토링 시점에 추가된다.
 *
 * 존재 이유:
 *   Year 2 공인중개사 확장 시 `engine/` (범용) ↔ `exams/{id}/` (시험 특화)
 *   경계를 명확히 하기 위한 타입 계약을 Year 1 내에 선 도입. 본 인터페이스에
 *   맞지 않는 API 설계는 Year 2 리팩토링 비용을 증가시킴.
 *
 * 근거:
 *   - ADR-007: v3.0 멀티시험 전환 Year 2 이월 결정
 *   - 재정립서 v3.0 FINAL §5 (ExamAdapter 인터페이스)
 *   - Hard Rule 15~17 (.claude/rules/production-quality.md)
 */

/**
 * 시험 식별자 (brand type). Year 1은 'son-hae-pyeong-ga-sa' 고정.
 * Year 2 이후 확장. 명명 규칙: 로마자 표기 + kebab-case
 * (예: 'son-hae-pyeong-ga-sa', 'gong-in-jung-gae-sa', 'jeon-gi-gi-sa').
 *
 * brand 타입으로 선언하여 일반 string 대입을 컴파일러가 차단
 * (Hard Rule 17 enforcement). `ExamId` 값은 반드시 `EXAM_IDS` 상수
 * (`packages/shared/src/constants/exam-ids.ts`)를 통해서만 획득.
 */
export type ExamId = string & { readonly __brand: 'ExamId' };

/**
 * 4-Level 메타데이터 범용화 스키마 (v3.0 §6).
 * 현재 D1 스키마는 손해평가사 특화 컬럼명(lv1_insurance 등)을 사용하나,
 * Year 2 Phase 4에서 lv1/lv2/lv3으로 일괄 변경된다. 본 타입은 Year 2 이후
 * 목표 형태를 미리 선언한다 (ADR-007).
 */
export interface LevelTaxonomy {
  /** 도메인 최상위 구분 (예: 손해평가사 보장방식 / 공인중개사 민법영역). */
  readonly lv1: string;
  /** 중간 분류 (예: 손해평가사 품목 / 공인중개사 계약유형). */
  readonly lv2: string;
  /** 세부 분류 (예: 손해평가사 조사종류 / 공인중개사 절차단계). */
  readonly lv3: string;
}

/**
 * Vectorize 메타데이터 필터 (ADR-004 §3 exam_id 필터 필수 원칙).
 * 모든 쿼리는 exam_id 필터를 포함해야 한다.
 */
export interface ExamScopedVectorFilter extends LevelTaxonomy {
  readonly exam_id: ExamId;
  readonly exam_scope: string;
  readonly revision_year: number;
  readonly is_active: boolean;
}

/**
 * 시험 정적 메타데이터. Year 2 Phase 4에 신설될 `exams` 테이블 (v3.0 §7)의
 * row 형태와 대응. Year 1에는 하드코딩 값으로 사용.
 */
export interface ExamConfig {
  readonly id: ExamId;
  readonly displayName: string;
  readonly domain: string;
  readonly hierarchy: {
    readonly lv1Label: string;
    readonly lv2Label: string;
    readonly lv3Label: string;
  };
  readonly questionFormats: ReadonlyArray<
    'multiple_choice' | 'fill_blank' | 'descriptive' | 'case_study'
  >;
  readonly totalSubjects: number;
}

/**
 * 허용 엣지 타입 선언. Year 1에서는 v2.0 13종을 모두 사용하며, Year 2
 * 공인중개사 확장 시 adapter 별로 허용 목록을 축소 선언한다 (ADR-007
 * 반론 1: 엣지 타입 조기 축소 회피).
 */
export type AllowedEdgeTypes = ReadonlyArray<string>;

/**
 * ExamAdapter — 시험별 파서/검증/자료 생성 로직의 격리 계약.
 * 구현체는 Year 2 Phase 4 이후 `exams/{exam-id}/adapter.ts`에 위치.
 *
 * Year 1 내 이 인터페이스에 맞는 시그니처로 손해평가사 로직을 작성하면
 * Year 2 리팩토링 비용이 크게 줄어든다.
 */
export interface ExamAdapter {
  readonly config: ExamConfig;

  /** 허용 엣지 타입 목록. Year 1 손해평가사는 v2.0 13종 전체. */
  readonly allowedEdgeTypes: AllowedEdgeTypes;

  /**
   * 지식 노드 ID 네이밍 컨벤션 검증.
   * Year 1 손해평가사 패턴: 'CONCEPT-001', 'INS-01', 'CROP-001', 'F-01' 등
   * (ontology-registry.json의 정규식 참조). Year 2 공인중개사 이후 prefix
   * (`SHPGS-` 등) 추가 여부는 별도 ADR로 결정.
   */
  validateNodeId(candidate: string): boolean;

  /** 시험별 질문 정답 검증 로직 (OX/빈칸/변형). */
  validateAnswer(questionId: string, userAnswer: string, expectedAnswer: string): Promise<boolean>;

  /** 시험별 Graceful Degradation 메시지 (유사도 < 0.60 시). */
  gracefulDegradationMessage(pageRef: string): string;
}
