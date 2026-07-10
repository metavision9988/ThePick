import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

// G-5 (promo-1st 위임 결정): 홍보 URL 기본값 = 실배포 Pages 프로젝트.
// 커스텀 도메인 확보 시 PUBLIC_SITE_URL 주입으로 교체 (하드코딩 승격 금지).
const site = process.env.PUBLIC_SITE_URL ?? 'https://thepick-study.pages.dev';

export default defineConfig({
  site,
  integrations: [react(), tailwind()],
  output: 'static',
});
