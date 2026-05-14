/**
 * ADR-040 §8.1 #8 흡수 (Session 078, 2026-05-14) — production binding `__mock` prefix 부재 회귀.
 *
 * 사유: apps/web/e2e/mock-server (port 8787)는 spec 전용 Hono 인스턴스이며 admin 엔드포인트
 *   `/__mock/health`, `/__mock/state`, `/__mock/reset`, `/__mock/override`를 노출한다.
 *   동일 prefix가 production apps/api 번들에 실수로 섞이면 admin 엔드포인트가 외부에 노출되어
 *   state reset / override 등의 공격 표면이 생성된다.
 *
 * 검증 방법: apps/api/src 트리 전체를 스캔하여 `__mock` 문자열이 0건임을 확인.
 *   - 본 테스트 파일 자체는 스캔 대상에서 제외 (self-reference 무한 루프 차단).
 *   - 정적 스캔은 런타임 fetch 대비 빠르고 D1 binding 의존이 없어 환경 격리.
 *   - 향후 production 코드에 `__mock`이 합법적으로 필요한 경우는 본 테스트를 명시적으로
 *     완화하도록 강제 (silent 누락 차단).
 *
 * 정합 ref: apps/web/e2e/mock-server/server.ts:97-118 (admin endpoint 정의).
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SRC_ROOT = join(__dirname, '..');
const SELF_PATH = __filename;

function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      files.push(...collectSourceFiles(full));
      continue;
    }
    if (!entry.endsWith('.ts') && !entry.endsWith('.tsx')) continue;
    if (full === SELF_PATH) continue;
    files.push(full);
  }
  return files;
}

describe('production source must not contain mock admin routes', () => {
  it('no __mock substring exists in apps/api/src (excluding this test)', () => {
    const offenders: Array<{ file: string; line: number; text: string }> = [];
    for (const file of collectSourceFiles(SRC_ROOT)) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((text, idx) => {
        if (text.includes('__mock')) {
          offenders.push({ file, line: idx + 1, text: text.trim() });
        }
      });
    }
    expect(
      offenders,
      `__mock prefix detected in production source. mock-server admin 엔드포인트가 ` +
        `apps/api 번들에 누출되면 외부 공격 표면이 생성된다. 발견 위치:\n` +
        offenders.map((o) => `  ${o.file}:${o.line} — ${o.text}`).join('\n'),
    ).toEqual([]);
  });
});
