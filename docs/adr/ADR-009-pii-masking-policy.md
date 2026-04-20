# ADR-009: PII 마스킹 정책 공식화 (logger `PII_KEYS` 근거 카탈로그)

- **상태:** Accepted
- **결정일:** 2026-04-18 (Session 8)
- **결정자:** 진산 + Claude Opus 4.7
- **관련 문서:**
  - `packages/shared/src/logger.ts` (Session 7 CRITICAL 해소 구현)
  - ADR-002 (Payment BuyerInfo 처리)
  - `docs/architecture/THREAT_MODEL.md` (T-7 로그 유출)
  - PIPA (개인정보보호법) 제23조, PCI-DSS 3.2.1, OWASP Logging Cheat Sheet

## 맥락 (Context)

Session 7에서 `logger.ts` 구현 시 PII 마스킹을 즉각 반영(독립 리뷰 CRITICAL 해소). 33개 PII 키(인증 19 + 결제 5 + 한국 개인식별 9)를 하드코딩하면서 "각 키를 왜 마스킹 대상에 포함했는지" 근거는 logger.ts 파일 주석 한 줄("PIPA §23 + OWASP")에만 있음. 미래에 키 추가/제거 결정이 나왔을 때 **왜 어떤 키는 마스킹하고 어떤 키는 안 하는지** 판단 근거 부재 = 기술 부채.

Session 7 핸드오프가 `ADR-007 = PII 정책 공식화` 번호로 예약했으나 Session 8에서 ADR-007이 "멀티시험 Year 2 이월"로 사용됨. 본 ADR이 **ADR-009**로 재할당 (ADR-008 = Graceful Degradation).

## 결정 (Decision)

logger.ts의 마스킹 키 33종(인증 19 + 결제 5 + 한국 개인식별 9)을 **법률/표준 근거별로 카탈로그화**하여 향후 추가/제거 판단 기준을 확립한다.

### PII_KEYS 카탈로그 (logger.ts:51-63 대응)

#### 1. 인증/토큰 (OWASP Logging Cheat Sheet: "Never log authentication credentials")

| 키 (정규화 소문자)                                        | 타입           | 근거              | 노출 시 피해                |
| --------------------------------------------------------- | -------------- | ----------------- | --------------------------- |
| `password`, `pwd`                                         | 평문 암호      | OWASP A07         | 계정 탈취                   |
| `token`, `apikey`, `api_key`                              | API 토큰       | OWASP A02         | 서비스 권한 탈취            |
| `secret`, `clientsecret`                                  | OAuth 시크릿   | RFC 6749 §2.3     | 3rd-party 인증 우회         |
| `authorization`, `authheader`, `authtoken`, `bearertoken` | HTTP 인증 헤더 | RFC 7235          | 세션 탈취                   |
| `jwt`, `refreshtoken`, `accesstoken`                      | JWT/OAuth 토큰 | RFC 7519          | 세션/재인증 탈취            |
| `sessionid`, `csrftoken`                                  | 세션/CSRF      | OWASP A01         | 세션 하이재킹               |
| `privatekey`, `encryptionkey`                             | 암호학적 키    | NIST SP 800-57    | 암복호화 권한 탈취          |
| `cookie`                                                  | HTTP 쿠키      | RFC 6265 §4.1.2.5 | 인증 쿠키 유출 시 세션 탈취 |

#### 2. 결제 (PCI-DSS 3.2.1 Requirement 3.4 "Protect stored cardholder data")

| 키                  | 타입           | 근거            | 노출 시 피해                          |
| ------------------- | -------------- | --------------- | ------------------------------------- |
| `cardnumber`, `pan` | 카드 번호(PAN) | PCI-DSS Req 3.4 | 부정 사용 + 법적 제재                 |
| `cvc`, `cvv`        | CVV            | PCI-DSS Req 3.2 | CVV는 **저장 자체가 금지** 대상       |
| `cardholdername`    | 카드 소유자명  | PCI-DSS Req 3.3 | CDE(Cardholder Data Environment) 범위 |

#### 3. 한국 개인식별정보 (PIPA 제23조 민감정보 + 제24조 고유식별정보)

| 키                                           | 타입           | 근거                  | 노출 시 피해        |
| -------------------------------------------- | -------------- | --------------------- | ------------------- |
| `ssn`, `rrn`, `residentnumber`, `personalid` | 주민등록번호   | PIPA §24 제1항        | 7년 이하 징역 (§71) |
| `passport`                                   | 여권번호       | PIPA §24              | 국외여행 신원 도용  |
| `driverlicense`                              | 운전면허번호   | PIPA §24              | 행정 본인확인 도용  |
| `nationalid`                                 | 외국인등록번호 | PIPA §24              | 외국인 신원 도용    |
| `businessregistrationnumber`, `bizregnumber` | 사업자등록번호 | PIPA §23 + 국세기본법 | 세무 권한 도용      |

### RAW_DUMP_KEYS 카탈로그 (logger.ts:73-76 대응)

전체 값이 JSON 블롭이라 개별 키 필터링이 불가능 → 전체 치환.

| 키                                      | 방어 대상                           |
| --------------------------------------- | ----------------------------------- |
| `rawpayload`, `body`, `raw`, `formdata` | HTTP body (결제/회원가입 full dump) |
| `headers`                               | Authorization 헤더 누설             |
| `params`, `queryparams`, `searchparams` | URL 쿼리 스트링 내 token 누설       |

**제외 (logger.ts:70 주석):** `query` — DB SQL 쿼리 로깅과 충돌. 웹 요청 query string은 `queryParams`/`searchParams` 키 사용.

### 이메일 부분 마스킹 (logger.ts:81 `EMAIL_PATTERN`)

- 정책: `alice@example.com` → `al***@example.com` (앞 2자 유지 + 도메인 유지)
- 근거: 수험생 문의 응대 시 기술팀이 "이 사용자" 식별 필요. 완전 마스킹은 지원 불가. 부분 마스킹이 절충
- 대안: 완전 해시(SHA-256 truncated) — Phase 3 CS 도구 설계 시 재검토

### JWT 값 정규식 탐지 (logger.ts:82 `JWT_PATTERN`)

- `/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g`
- 근거: JWT가 키 이름 없이 본문/에러 메시지에 등장하는 경우(stacktrace, 문자열 연결 에러 등) 정규식으로 탐지 후 `[MASKED_JWT]` 치환
- 한계: JWT 외 토큰 포맷(opaque token, PASETO 등)은 미탐지. 해당 포맷 도입 시 본 ADR Addendum

### Stack trace 경로 redact (logger.ts:85-89 production only)

- 대상 패턴: `/home/{user}/`, `/Users/{user}/`, `C:\Users\{user}\`
- 치환: `[REDACTED_HOME]/`
- 근거: 사용자 홈 경로 누설 방지 (OSINT 대상 축소). production 환경만 활성 (개발 시 디버깅 편의 유지)

### 마스킹 적용 범위 (재귀 + 가드)

- 최대 깊이: 6 (logger.ts:91 `MAX_MASK_DEPTH`) — 순환 참조 방지
- 원인 체인: 최대 8 (logger.ts:92 `MAX_CAUSE_DEPTH`) — Error.cause 체이닝 가드
- 배열/객체 전부 재귀 적용 (logger.ts serializeValueInner)

## 결과 (Consequences)

### 긍정적

- 각 마스킹 키의 법률/표준 근거가 1:1 매핑되어 추가/제거 시 의사결정 추적 가능
- PIPA §23/§24, PCI-DSS, OWASP 감사 시 본 ADR 단독 제출 가능
- Logger 테스트(`logger.test.ts` 33 tests)가 본 카탈로그의 validation fixture 역할

### 부정적

- 신규 키 추가 시 본 ADR도 함께 업데이트 (Addendum) 필요 → 개발자 부담
- PIPA §24 고유식별정보는 해외(EU GDPR Art.9 특수범주 개인정보)와 기준이 달라 i18n 확장 시 재검토 필요

### 중립

- 이메일 부분 마스킹 정책은 "완전 해시"로 강화 가능하나 CS 도구 설계 트레이드오프 (Phase 3 결정)

## 후속 조치

- [ ] Phase 1 Step 1-1 PBKDF2 auth 구현 시 회원가입/로그인 라우트에 `logger.info(..., { email, user_id })` 호출 → 본 ADR 이메일 정책 자동 적용 확인
- [ ] Phase 1 Step 1-2 webhook 구현 시 결제 PG response dump에 `rawpayload` 키 사용 (RAW_DUMP_KEYS 적용)
- [ ] Phase 3 CS 도구 설계 시 이메일 부분 마스킹 vs 완전 해시 재검토 + 본 ADR Addendum
- [ ] `docs/architecture/THREAT_MODEL.md` T-7(로그 유출)에 본 ADR 링크 추가
- [ ] Logger 마스킹 키 추가/제거 PR은 ADR-009 수정과 동반 원칙 (CONTRIBUTING.md 반영 — Phase 1)

## 참고

- PIPA 제23조 민감정보: https://www.law.go.kr/법령/개인정보보호법/제23조
- PIPA 제24조 고유식별정보: https://www.law.go.kr/법령/개인정보보호법/제24조
- PCI-DSS 3.2.1 Requirement 3: https://www.pcisecuritystandards.org/
- OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- Session 7 리뷰(logger CRITICAL 해소): `.claude/reviews/review-20260418-110346.md`

## 수정 이력

- 2026-04-18 (Session 8): 초안 작성. Session 7 logger.ts 구현의 사후 문서화 (ADR 번호 재할당 완료)
