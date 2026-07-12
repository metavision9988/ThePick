/* eslint-env node */
/**
 * deploy-lib 순수 로직 검증 (D-21 / 5-페르소나 RC-6).
 * 루트 `pnpm test:scripts` (node --test) 로 실행 — CI ci.yml:84 배선.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildVersionInfo, buildWranglerArgs } from '../deploy-lib.mjs';

test('buildVersionInfo: 전체 필드 전파', () => {
  const info = buildVersionInfo({
    sha: 'abcdef1234567890',
    shortSha: 'abcdef1',
    branch: 'main',
    checkoutBranch: 'main',
    dirty: false,
    commitSubject: 'fix: something',
    builtAt: '2026-07-12T10:00:00.000Z',
    apiBase: 'https://api.example.workers.dev',
  });
  assert.deepEqual(info, {
    sha: 'abcdef1234567890',
    shortSha: 'abcdef1',
    branch: 'main',
    checkoutBranch: 'main',
    dirty: false,
    commitSubject: 'fix: something',
    builtAt: '2026-07-12T10:00:00.000Z',
    apiBase: 'https://api.example.workers.dev',
  });
});

test('buildVersionInfo: branch(배포타겟)와 checkoutBranch(실측 HEAD) 분리 기록', () => {
  // feature 브랜치에서 production 타겟 배포 시 두 값이 갈린다 — branch 만 보면 오도되던 4-Pass MINOR 해소
  const info = buildVersionInfo({
    sha: 'abc',
    branch: 'main',
    checkoutBranch: 'hotfix/urgent',
    dirty: false,
    builtAt: '2026-07-12T10:00:00.000Z',
  });
  assert.equal(info.branch, 'main');
  assert.equal(info.checkoutBranch, 'hotfix/urgent');
});

test('buildVersionInfo: shortSha 기본값 = sha 앞 7자', () => {
  const info = buildVersionInfo({ sha: 'abcdef1234567890', dirty: true, builtAt: '2026-07-12T10:00:00.000Z' });
  assert.equal(info.shortSha, 'abcdef1');
  assert.equal(info.dirty, true);
  assert.equal(info.branch, null);
  assert.equal(info.checkoutBranch, null);
  assert.equal(info.commitSubject, null);
  assert.equal(info.apiBase, null);
});

test('buildVersionInfo: 필수 필드 누락 시 throw', () => {
  assert.throws(() => buildVersionInfo({ dirty: false, builtAt: 'x' }), /sha/);
  assert.throws(() => buildVersionInfo({ sha: 'x', builtAt: 'x' }), /dirty/);
  assert.throws(() => buildVersionInfo({ sha: 'x', dirty: false }), /builtAt/);
  // dirty 는 boolean 만 — truthy 문자열 거부 (무음 통과 차단)
  assert.throws(() => buildVersionInfo({ sha: 'x', dirty: 'true', builtAt: 'x' }), /dirty/);
});

test('buildWranglerArgs: --commit-hash/message + 실제 dirty 반영', () => {
  const args = buildWranglerArgs({
    distDir: 'dist',
    projectName: 'thepick-study',
    branch: 'main',
    sha: 'abcdef1234567890',
    commitSubject: 'fix: something',
    dirty: false,
  });
  assert.deepEqual(args, [
    'pages',
    'deploy',
    'dist',
    '--project-name=thepick-study',
    '--branch=main',
    '--commit-hash=abcdef1234567890',
    '--commit-message=fix: something',
    '--commit-dirty=false',
  ]);
});

test('buildWranglerArgs: dirty=true 는 은폐 아닌 표면화(true 기록)', () => {
  const args = buildWranglerArgs({
    distDir: 'dist',
    projectName: 'thepick-study',
    sha: 'deadbeef',
    dirty: true,
  });
  assert.ok(args.includes('--commit-dirty=true'));
  assert.ok(args.includes('--commit-hash=deadbeef'));
  assert.ok(args.includes('--branch=main')); // branch 기본값
  assert.ok(args.includes('--commit-message=')); // subject 미지정 = 빈 메시지
});

test('buildWranglerArgs: 필수 필드 누락 시 throw', () => {
  assert.throws(() => buildWranglerArgs({ projectName: 'p', sha: 's', dirty: false }), /distDir/);
  assert.throws(() => buildWranglerArgs({ distDir: 'd', sha: 's', dirty: false }), /projectName/);
  assert.throws(() => buildWranglerArgs({ distDir: 'd', projectName: 'p', dirty: false }), /sha/);
  assert.throws(() => buildWranglerArgs({ distDir: 'd', projectName: 'p', sha: 's', dirty: 1 }), /dirty/);
});
