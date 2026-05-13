/**
 * Vitest 설정 — apps/web (ADR-040 §5 #1 흡수).
 *
 * - environment: jsdom (React 19 + sessionStorage / fetch / DOM 시뮬레이션)
 * - @vitejs/plugin-react: JSX 변환
 * - setupFiles: @testing-library/jest-dom matchers 자동 활성화
 * - globals: false — describe/it/expect 명시 import 강제 (apps/admin-web 정합)
 * - resolve.alias: tsconfig.json paths "@/*" → src/* (Astro 동등)
 */

import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist', '.astro'],
  },
});
