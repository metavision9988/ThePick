# Secret 로테이션 Runbook

**작성일**: 2026-07-13 (5-페르소나 D-36 처분, RC-6 운영 대응).
**근거**: `.claude/reviews/phaseN-tech-debt-20260710-143321-INDEX.md` D-36 (secret 로테이션 설계·runbook 부재) +
D-17(choiceId 미복원 텔레메트리) / D-20(AE reader `--alert`) 탐지 루프의 **대응 절차**.
**용도**: production secret(JWT_SECRET·webhook HMAC) 회전 시 blast radius·절차·회전 후 모니터링·롤백.
**핵심 메시지**: JWT_SECRET 회전 직후 `choice_id_unresolved` **스파이크는 예상된 양성**이다 —
악의적 위조와 혼동해 on-call 이 오판하지 않도록 §4 로 구분한다.

---

## 0. Secret 인벤토리 (blast radius 실측 기준)

| Secret                        | 용도                                                    | 주입                                              | 회전 영향 (§2 상세)                             |
| ----------------------------- | ------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------- |
| `JWT_SECRET`                  | ① auth access JWT(HS256) 서명·검증 ② 공개 choiceId HMAC | `wrangler secret put JWT_SECRET --env production` | auth = graceful(≤15분) / 공개 choiceId 스파이크 |
| `WEBHOOK_HMAC_SECRET_*`       | 결제 webhook(mock/polar/portone/toss) HMAC 검증         | 동 (provider별)                                   | 해당 provider webhook 검증만 — 독립             |
| `PUBLIC_CF_BEACON_TOKEN`(web) | Web Analytics 비콘 (secret 아님·공개 토큰)              | web env / 대시보드 발급                           | 지표 비콘만 — 학습 흐름 무관                    |

> ★ **설계 관측(권고 §7)**: 공개 표면 `choiceId` 가 **auth 용 `JWT_SECRET` 을 재사용**한다
> (`apps/api/src/public/routes.ts:338,436,571` — 별도 `CHOICE_ID_SECRET` 부재). 두 무관한 관심사가
> 한 secret 에 결합돼 있어 auth secret 회전이 공개 choiceId 를 불필요하게 깨뜨린다. 분리 권고 = §7.

---

## 1. 언제 회전하는가

- **정기(예방)**: 명시 정책 없음(현). 저위험 무인증 공개 표면 중심이라 상시 회전 불필요.
- **사고(강제)**: JWT_SECRET 유출 의심(로그·번들 노출), webhook secret 유출, 정합성 신호 이상 지속.
- **비회전 사유**: `choiceId` 의 secret 은 **보안 경계가 아니다**(정답은 채점 후 어차피 노출 = F-3).
  choiceId hygiene 만을 위한 회전은 이득 대비 스파이크 비용이 커 권장하지 않는다.

---

## 2. JWT_SECRET 회전 blast radius (실측 grounded)

### 2.1 Auth (인증) — **graceful, 재로그인 불요**

- access token = HS256 JWT, **15분 TTL** (`ACCESS_TOKEN_TTL_SECONDS`, `packages/shared/src/constants/auth.ts:9`). 회전 즉시 구 secret 서명 access 는
  `require-auth` 검증 실패(`auth/middleware/require-auth.ts:53`).
- 그러나 refresh token = **32B opaque, SHA-256 해시로 DB(sessions) 검증** (`auth/session.ts:192-194,297`) —
  **JWT_SECRET 무관**. 따라서 클라의 refresh 흐름이 **신 secret 으로 새 access 를 재발급**
  (`auth/routes.ts:509`)한다.
- ⇒ **영향 = 회전~다음 refresh 사이(최대 15분) 구 access 401**. 표준 refresh-on-401 클라는 **투명 회복**,
  재로그인 0. (현 라이브 = 무인증 공개 표면이라 auth 사용자 자체가 희소.)

### 2.2 공개 choiceId — **스파이크, 자가 교정**

- choiceId = `HMAC-SHA256(JWT_SECRET, "qId:originalIndex")` 앞 24hex (`public/choice-id.ts:10`). 무상태 —
  서빙 시 발급, 채점 시 재계산 매칭.
- 회전 시 **회전 전 서빙된(브라우저에 떠 있는) 문항의 choiceId** 는 신 secret 재계산과 불일치 →
  `resolveChoiceId`=null → **채점 무음 오답화 + `choice_id_unresolved` defect 발행**(D-17,
  `public/routes.ts:443-455`).
- ⇒ **영향 = 회전 시점 in-flight 세션 한정**. 사용자가 새 문항을 로드하면 신 secret choiceId 라 정상 =
  **자가 교정**(수분 내 감쇠). 신규 오채점 없음(재조회분).

### 2.3 Webhook / 기타 — 무영향

- `WEBHOOK_HMAC_SECRET_*` 는 JWT_SECRET 과 독립. 결제 provider별 개별 회전(§6).

---

## 3. 회전 절차 (production)

> **불가역 주의**: secret 교체 후 구 값은 복구 불가(직접 보관 안 함). 롤백(§6)은 **구 값을 다시 알아야** 가능.
> 회전 전 구 값을 안전 보관처(진산 vault)에 백업할 것.

```bash
# 1) (권장) 회전 전 백업 — production 쓰기 전 D1 백업 관행과 동일선상
bash scripts/backup-d1-to-r2.sh   # 사고 회전 시 상태 스냅샷

# 2) 신 secret 주입 (≥32B — MIN_JWT_SECRET_BYTES 미만이면 login 500)
#    값 생성: openssl rand -base64 48  (48B → base64 64자)
wrangler secret put JWT_SECRET --env production
#    → 프롬프트에 신 값 붙여넣기 (셸 히스토리·파일 미기록)

# 3) Worker 재배포 (secret 은 즉시 반영되나, 배포로 버전 스탬프 정합)
pnpm --filter @thepick/api deploy:production
#    → deploy:production 이 배포 후 smoke-public-surface 자동 실행(D-16) = 공개 표면 즉시 검증

# 4) 스모크 확인 (deploy 체인 자동 실행 — 전 체크 PASS 여야 함)
#    ⚠️ 스모크 범위 = 공개 무인증 표면(overview/next/grade/reveal choiceId 왕복)뿐.
#       auth 로그인·refresh 는 미검증 + choiceId 는 길이만 맞으면 통과(hmacHex 는 길이 무검증)이라
#       **too-short JWT_SECRET 도 스모크는 green** → auth 검증은 §5 수동 단계로 별도 확인(FLAG-2).
```

- **길이 하한**: `JWT_SECRET < 32자` = `JWT_SECRET_TOO_SHORT`(`auth/session.ts:55`, 상수 `MIN_JWT_SECRET_BYTES=32`
  `packages/shared/src/constants/auth.ts:28`) → **login 발급 전면 실패**. 단 공개 choiceId(`hmacHex`)는 길이
  무검증이라 too-short 여도 동작 = 스모크가 못 잡음(FLAG-2). 회전 값은 반드시 ≥32자(권장 `openssl rand -base64 48`).
  (검증은 JS string length = ASCII/base64 는 바이트와 동일.)
- **staging 선행(권장)**: `wrangler secret put JWT_SECRET --env staging` + staging 스모크 후 production.

---

## 4. 회전 후 모니터링 — ★ 예상 스파이크 vs 악의 구분

회전 직후 `choice_id_unresolved` **스파이크는 정상**(§2.2 in-flight 세션). D-20 리더로 관측:

```bash
CLOUDFLARE_API_TOKEN=<Account Analytics Read> \
  node scripts/read-public-analytics.mjs --env production --days 1
# → "정합성 신호 계(D-17)" 의 choice_id_unresolved 값 확인
```

| 관측                                                        | 판정           | 대응                                                    |
| ----------------------------------------------------------- | -------------- | ------------------------------------------------------- |
| 회전 직후 `choice_id_unresolved` 소폭↑ → **수분 내 감쇠 0** | ✅ 예상 양성   | 없음 (자가 교정). 회전 정상 완료.                       |
| `choice_id_malformed` 위주 (길이 불일치)                    | ⚠️ 위조 노이즈 | rate-limit 확인. 회전과 무관.                           |
| `choice_id_unresolved` **지속·미감쇠**(회전 후 수시간+)     | 🔴 이상        | 서빙↔채점 secret 불일치 재조사(배포 누락·env 드리프트). |

- `--alert` 는 정합성 신호 ≥1 시 **exit 2**(인프라 실패 exit 1 과 구분, D-20). ⚠️ **주의: exit 2 는
  `choice_id_malformed`(위조) + `choice_id_unresolved`(회전) 를 합산**한다 — 회전 양성을 이유로
  cron 경보를 **통째 억제하지 말 것**(겹친 실제 위조 공격을 실명한다, FLAG-1). 억제할 때는 리더 리포트를
  먼저 확인해 **`unresolved` 우세(회전 양성)일 때만** 한시 억제하고, `malformed` 가 함께 오르면 위조로
  보고 억제하지 않는다. 감쇠 확인(수분) 후 정상화.
- **auth 회복 확인**: 로그인 → 15분 경과 → 자동 갱신으로 세션 유지되는지(재로그인 미요구) 스팟 확인.
  ⚠️ 공개 표면 스모크(§5)는 **auth 경로를 검증하지 않으므로**(FLAG-2) 이 확인은 별도 수동 필수.

---

## 5. 검증 체크리스트 (회전 완료 판정)

- [ ] `wrangler secret put` 성공 + `deploy:production` 스모크 PASS (D-16 자동 체인 — **공개 표면만**)
- [ ] `/api/public/questions/next` → `/grade` 왕복 정상(신 secret choiceId 발급·복원)
- [ ] D-20 리더 — `choice_id_unresolved` 회전 후 수분 내 감쇠(§4)
- [ ] ★**auth 경로 수동 확인(스모크 미포함, FLAG-2)**: (a) 신규 login 성공(= JWT_SECRET ≥32자 아니면 여기서 실패) +
      (b) 기존 refresh 토큰으로 access 재발급 성공 = 재로그인 0. auth 개통 전에도 (a) 는 확인 가능.
- [ ] 구 secret 값 안전 보관(롤백 대비) 확인

---

## 6. 롤백

- **JWT_SECRET**: 구 값을 다시 `wrangler secret put JWT_SECRET --env production` → 재배포. (구 값 보관 전제.)
  롤백 시에도 반대 방향 `choice_id_unresolved` 스파이크 1회 발생(신→구 in-flight 불일치) — §4 동일 관측.
- **Webhook secret**: provider별 개별 `wrangler secret put WEBHOOK_HMAC_SECRET_<PROVIDER>` 되돌림.
- **주의**: 회전을 여러 번 반복하면 매번 in-flight 스파이크 — 회전은 최소 횟수로.

---

## 7. 권고 (carry-over — 별건 결재)

1. **CHOICE_ID_SECRET 분리** (RC-5 shared 단일화 연동): 공개 choiceId 를 `JWT_SECRET` 재사용 대신
   전용 `CHOICE_ID_SECRET`(폴백=JWT_SECRET) 으로 분리 → auth secret 회전이 공개 표면을 안 깨뜨림.
   choiceId 는 보안 경계가 아니라 회전 빈도 0 에 가까워져 스파이크 자체가 사라진다.
2. **dual-key grace** (D-17 4-Pass 제안): `resolveChoiceId(secret, previousSecret?, ...)` 로 회전 유예 창
   동안 구·신 secret 양쪽 매칭 → in-flight 스파이크 제거. 단 auth JWT 는 15분 TTL 로 이미 graceful 이라
   이득은 공개 choiceId 한정 — §7-1(분리)이 선행되면 우선순위 하락.
3. **회전 로그**: 회전 시각·사유·수행자를 별도 원장에 기록(현 부재) — 사고 조사 시 상관 분석용.
