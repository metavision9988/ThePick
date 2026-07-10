#!/usr/bin/env bash
# backup-d1-to-r2 — production D1 전체 export → R2 오프사이트 백업 (5-페르소나 P5 D-03).
#
# 사용: bash scripts/backup-d1-to-r2.sh   (요구: wrangler 인증 세션, apps/api 컨텍스트)
# 산출: r2://thepick-backups/d1/production/<UTC타임스탬프>.sql
#
# 배경: D1 DR 이 Time Travel 30일 단일 의존 — 30일+ 잠복 결함 발견 시 복구 불가.
# 본 스크립트 = 수동/주기 오프사이트 스냅샷(RPO = 실행 주기). 자동화(주간 cron)는
# GitHub Actions schedule + CLOUDFLARE_API_TOKEN 시크릿 등록(진산 행위) 후 배선 —
# docs/runbooks/migration-rollback.md §DR 참조.
set -euo pipefail

cd "$(dirname "$0")/../apps/api"

TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$(mktemp -d)/d1-prod-$TS.sql"
KEY="d1/production/$TS.sql"

echo "→ export thepick-db-production (remote)"
npx wrangler d1 export thepick-db-production --env production --remote --output "$OUT"
SIZE=$(wc -c <"$OUT")
if [ "$SIZE" -lt 100000 ]; then
  echo "🔴 export 크기 비정상(${SIZE}B < 100KB) — 업로드 중단(빈/절단 덤프 방어)" >&2
  exit 1
fi

echo "→ upload r2://thepick-backups/$KEY (${SIZE}B)"
npx wrangler r2 object put "thepick-backups/$KEY" --file "$OUT" --remote

rm -f "$OUT"
echo "🟢 backup complete: $KEY (${SIZE}B)"
