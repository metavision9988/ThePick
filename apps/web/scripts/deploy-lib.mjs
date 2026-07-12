/* eslint-env node */
/**
 * deploy-lib — web production 배포 순수 로직 (D-21 / 5-페르소나 RC-6 처분).
 *
 * 부수효과 없는 순수 함수만 노출 (deploy-lib.test.mjs 로 검증).
 * 배포물↔git SHA 추적성 복원: version.json 페이로드 + wrangler --commit-* 인자 구성.
 * 근거: `.claude/reviews/phaseN-tech-debt-20260710-143321-INDEX.md` D-21.
 */

/**
 * 배포 산출물에 스탬프할 버전 정보 (dist/version.json 으로 직렬화).
 * 런타임 "무엇이 라이브인가" 조회원 — 배포물 정체 불명(404 3주 인시던트) 동일 클래스 차단.
 *
 * `branch` = Cloudflare Pages 배포 타겟 라벨(=production, 배포 정책 상수).
 * `checkoutBranch` = 실측 git HEAD 브랜치(계보 진실원 — 4-Pass MINOR: branch 만 비측정 오인 방지).
 *
 * @param {{sha:string, shortSha?:string, branch?:string, checkoutBranch?:string, dirty:boolean,
 *          commitSubject?:string, builtAt:string, apiBase?:string}} input
 * @returns {{sha:string, shortSha:string, branch:string|null, checkoutBranch:string|null,
 *            dirty:boolean, commitSubject:string|null, builtAt:string, apiBase:string|null}}
 */
export function buildVersionInfo({ sha, shortSha, branch, checkoutBranch, dirty, commitSubject, builtAt, apiBase }) {
  if (typeof sha !== 'string' || sha.length === 0) {
    throw new Error('buildVersionInfo: sha(full) 필수');
  }
  if (typeof dirty !== 'boolean') {
    throw new Error('buildVersionInfo: dirty(boolean) 필수');
  }
  if (typeof builtAt !== 'string' || builtAt.length === 0) {
    throw new Error('buildVersionInfo: builtAt(ISO) 필수');
  }
  return {
    sha,
    shortSha: shortSha ?? sha.slice(0, 7),
    branch: branch ?? null,
    checkoutBranch: checkoutBranch ?? null,
    dirty,
    commitSubject: commitSubject ?? null,
    builtAt,
    apiBase: apiBase ?? null,
  };
}

/**
 * wrangler pages deploy 인자 배열 구성 (execFileSync argv — 셸 분해 없음).
 * 구 관행(`--commit-dirty=true` 무조건 은폐) 폐기 → 실제 dirty 상태 표면화 +
 * --commit-hash/--commit-message 로 CF 배포 메타에 git 계보 스탬프.
 *
 * @param {{distDir:string, projectName:string, branch?:string, sha:string,
 *          commitSubject?:string, dirty:boolean}} input
 * @returns {string[]}
 */
export function buildWranglerArgs({ distDir, projectName, branch, sha, commitSubject, dirty }) {
  if (typeof distDir !== 'string' || distDir.length === 0) {
    throw new Error('buildWranglerArgs: distDir 필수');
  }
  if (typeof projectName !== 'string' || projectName.length === 0) {
    throw new Error('buildWranglerArgs: projectName 필수');
  }
  if (typeof sha !== 'string' || sha.length === 0) {
    throw new Error('buildWranglerArgs: sha 필수');
  }
  if (typeof dirty !== 'boolean') {
    throw new Error('buildWranglerArgs: dirty(boolean) 필수');
  }
  return [
    'pages',
    'deploy',
    distDir,
    `--project-name=${projectName}`,
    `--branch=${branch ?? 'main'}`,
    `--commit-hash=${sha}`,
    `--commit-message=${commitSubject ?? ''}`,
    `--commit-dirty=${dirty ? 'true' : 'false'}`,
  ];
}
