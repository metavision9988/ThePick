/**
 * Vitest 설정 — apps/admin-web (Step 037 CRIT-QPHASE1-1).
 *
 * - environment: jsdom (React 19 + D3 + setInterval/AbortController 시뮬레이션)
 * - @vitejs/plugin-react: JSX 변환 + Fast Refresh (테스트는 Refresh 미사용)
 * - setupFiles: @testing-library/jest-dom matchers 자동 활성화
 * - globals: false — describe/it/expect 명시 import 강제 (no_globals 정합)
 */

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist', '.astro'],
  },
});
