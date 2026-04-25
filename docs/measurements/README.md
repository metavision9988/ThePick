# `docs/measurements/` — 외부 계약 실측 산출물

가-1 Group A (실 Claude API / pdfplumber / Vision OCR smoke) 측정 결과 보존.

## 파일 명명

```
{YYYYMMDD}-{target}-smoke.md       # 요약 (커밋 대상)
raw/{YYYYMMDD}-{target}-{seq}.json # 원본 응답 (gitignore — PII / 비용 일부 노출 가능)
```

## 측정값 유효 기간

- **90일 자동 만료** — 실 외부 시스템(Anthropic 모델 / pdfplumber / Vision)의 변경에 따른 시간 부패 방지
- 만료 시 해당 산출물 상단에 `EXPIRED: {date}` 마킹 + 재측정 트리거
- 재측정 트리거:
  - Anthropic 모델 버전 변경 (`claude-haiku-4-5` 등)
  - pdfplumber 메이저 버전 업데이트
  - Vision 모델 변경
  - Workers 런타임 변경
  - 90일 경과

## 요약 산출물 필수 항목

```
- 측정 일시 (UTC + KST)
- 측정 환경 (Node 버전, pdfplumber 버전, Anthropic SDK 버전, 모델 ID)
- 호출 횟수 / 누적 비용 (USD)
- 응답 shape (TypeScript 타입 또는 JSON Schema)
- p50 / p99 latency
- 에러 분포 (timeout / 429 / non-retryable / malformed JSON 등)
- 발견 사항 (응답 잘림 / 토큰 한계 / 비용 이상 등)
- 다음 단계 (Mock 설계 입력값으로 사용할 파라미터 목록)
```

## 보안

- 원본 JSON은 gitignore — `docs/measurements/raw/`
- 요약 본문에 사용자 데이터 / API 키 / 토큰 절대 미포함
- 의심 시 commit 전 `scripts/check-no-secrets.sh` 가 차단
