# ThePick — 프로젝트 개발 규칙

## 코딩 규칙

- Cloudflare Workers 런타임 제약: Node.js API 일부만 사용 가능, fs/path 등 불가
- D1 SQLite 특성: UPDATE 대신 INSERT + SUPERSEDES 패턴 (Temporal Graph)
- Claude API 호출: 반드시 타임아웃 + 재시도 3회 + 토큰 비용 로깅
- pdfplumber는 Python subprocess로 호출 (Workers 내부 X, 빌드 파이프라인에서만)
- ontology-registry.json에 없는 노드/엣지 ID 생성 금지
- 새 의존성 추가 시 Workers 호환 여부 확인 필수 (CPU 50ms free / 30s paid)

## 테스트 전략

- Formula Engine: 교재 예시값으로 100% 정확도 검증 필수 (소수점 정밀도 포함)
- 기출 파서: 공식 정답과 100% 일치 — 불일치 1건이라도 원인 규명 후 재실행
- Constants 추출: 수치/날짜 오류 0건 (65%를 60%로 잘못 추출하면 서비스 사망)
- Graph 무결성: 고아 노드 0건, 끊긴 엣지 0건, SUPERSEDES 순환 0건
- 품질 게이트 통과 없이 다음 Layer/Batch 진행 금지

## L3 보안 규칙

- Formula Engine: 동적 코드 실행 함수 절대 사용 금지 — math.js AST만 허용
- Constants: 수치 변경 시 반드시 교재 원문 대조 + 기출 정답 역검증
- user_progress: 사용자 학습 데이터 — PII 최소 수집, 로그 마스킹
- DB 스키마 변경: 마이그레이션 SQL 먼저 작성 → plan → 인간 승인

## 자동 리뷰 (L2+ 구현 후 필수, 스킵 불가)

- L2 이상 구현 완료 후, "완료" 선언 전에 4-Pass 리뷰를 반드시 실행한다.
- **자가 리뷰 금지**: 반드시 Agent tool로 독립 서브에이전트를 생성하여 리뷰 위임.
- 코드 작성 컨텍스트에서 직접 4-Pass 실행 = 자기 확인 편향으로 무효.
- 0건 보고 시 실제 확인 증거 3개+ 필수. "해당 없음"과 "검증 완료" 구분.
- Critical 0건이어야 "완료" 선언 가능. 상세: `auto-review-protocol.md`
- 사용자가 리뷰를 요청하지 않아도 자동 수행한다. 이것은 선택이 아닌 의무다.

## 배포 전 체크리스트

- [ ] 타입 체크 통과
- [ ] 린트 통과
- [ ] 테스트 전체 통과 (7개 100% 필수 항목 확인)
- [ ] L3 영역 변경 시 plan + 승인 완료
- [ ] .env.example에 새 환경변수 반영
- [ ] 기출 정답 ↔ Graph 해설 일치 검증 (QG-3)
- [ ] 산식 정확도 100% 검증 (QG-2/QG-5)
