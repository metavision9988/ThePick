#!/usr/bin/env node
/* eslint-env node */
/**
 * deploy-production — web production 배포 오케스트레이터 (D-21 / 5-페르소나 RC-6 처분).
 *
 * 배포물↔git SHA 추적성 복원 (구 package.json 인라인 체인 대체):
 *   1) env Binary Gate (check-deploy-env.mjs — PUBLIC_API_BASE_URL 강제)
 *   2) git 계보 수집 (HEAD SHA·short·dirty·subject)
 *   3) astro build
 *   4) dist/version.json 스탬프 (런타임 조회원 — curl <site>/version.json)
 *   5) wrangler pages deploy — --commit-hash/message + 실제 dirty 상태
 *
 * 실행: PUBLIC_API_BASE_URL=https://... pnpm --filter @thepick/web deploy:production
 * (operator-facing 명령은 불변 — 내부만 추적성 강화)
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildVersionInfo, buildWranglerArgs } from './deploy-lib.mjs';

// cwd 를 apps/web 으로 고정 — 호출 위치(루트·CI 래퍼) 무관하게 상대경로(./scripts, dist, pnpm exec) 견고화.
// (4-Pass MINOR: cwd 의존 상대경로 → import.meta.url 기준 고정)
process.chdir(join(dirname(fileURLToPath(import.meta.url)), '..'));

const DIST_DIR = 'dist';
const PROJECT_NAME = 'thepick-study';
// Cloudflare Pages 배포 타겟 브랜치(=production) — git 체크아웃 브랜치가 아닌 배포 타겟 라벨.
// 실제 HEAD 브랜치는 아래 checkoutBranch 로 실측해 version.json 에 별도 기록.
const BRANCH = 'main';

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function run(cmd, args) {
  try {
    execFileSync(cmd, args, { stdio: 'inherit' });
  } catch (err) {
    // 자식 프로세스 비정상 종료 = fail-loud 중단. 자식이 이미 stdio 로 원인을 출력했으므로
    // Node 내부 스택 덤프 없이 자식 exit code 로 전파(구 `&&` 셸 체인 동등 UX).
    process.exit(typeof err.status === 'number' ? err.status : 1);
  }
}

// 1) env Binary Gate — 실패 시 execFileSync throw → 배포 중단
run('node', ['./scripts/check-deploy-env.mjs']);

// 2) git 계보
const sha = git(['rev-parse', 'HEAD']);
const shortSha = git(['rev-parse', '--short', 'HEAD']);
const dirty = git(['status', '--porcelain']).length > 0;
const commitSubject = git(['log', '-1', '--pretty=%s']);
const checkoutBranch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
if (dirty) {
  console.warn(
    '🟡 워킹트리 dirty 상태로 배포 — version.json·CF 메타에 dirty=true 로 기록됨 (은폐 아님).',
  );
}

// 3) astro build
run('pnpm', ['exec', 'astro', 'build']);

// 4) dist/version.json 스탬프
const versionInfo = buildVersionInfo({
  sha,
  shortSha,
  branch: BRANCH,
  checkoutBranch,
  dirty,
  commitSubject,
  builtAt: new Date().toISOString(),
  apiBase: process.env.PUBLIC_API_BASE_URL ?? null,
});
writeFileSync(join(DIST_DIR, 'version.json'), `${JSON.stringify(versionInfo, null, 2)}\n`, 'utf8');
console.log(`🟢 version.json 스탬프 — ${shortSha}${dirty ? ' (dirty)' : ''} @ ${versionInfo.builtAt}`);

// 5) wrangler pages deploy
run('pnpm', [
  'exec',
  'wrangler',
  ...buildWranglerArgs({
    distDir: DIST_DIR,
    projectName: PROJECT_NAME,
    branch: BRANCH,
    sha,
    commitSubject,
    dirty,
  }),
]);
console.log(`🟢 배포 완료 — commit-hash=${shortSha} project=${PROJECT_NAME}`);
