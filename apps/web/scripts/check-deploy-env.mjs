#!/usr/bin/env node
/* eslint-env node */
/**
 * check-deploy-env — web 배포 전 env Binary Gate (4-Pass MINOR·5-페르소나 RC-3 처분).
 *
 * 차단(exit 1): PUBLIC_API_BASE_URL 미설정/localhost/비-https —
 *   빌드타임 인라인이라 미설정 배포 = 전 API 호출이 무음으로 localhost 폴백(사고 전력 클래스).
 * 경고(통과): PUBLIC_CF_BEACON_TOKEN 미설정 — Web Analytics 비콘 미출력(지표 없이 배포됨을 표면화).
 */

const apiBase = process.env.PUBLIC_API_BASE_URL;
if (apiBase === undefined || apiBase === '') {
  console.error('🔴 PUBLIC_API_BASE_URL 미설정 — production 번들이 localhost 폴백으로 인라인된다.');
  console.error('   예: PUBLIC_API_BASE_URL=https://thepick-api-production.metavision9988.workers.dev pnpm deploy:production');
  process.exit(1);
}
if (!apiBase.startsWith('https://') || apiBase.includes('localhost')) {
  console.error(`🔴 PUBLIC_API_BASE_URL 부적합: ${apiBase} (https 원격 URL 필요)`);
  process.exit(1);
}

if (!process.env.PUBLIC_CF_BEACON_TOKEN) {
  console.warn('🟡 PUBLIC_CF_BEACON_TOKEN 미설정 — Web Analytics 비콘 없이 배포된다 (대시보드에서 토큰 발급 후 주입).');
}

console.log(`🟢 deploy env OK — API_BASE=${apiBase}`);
