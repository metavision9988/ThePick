/**
 * @thepick/learning-modes/normalize — 답안 normalize.
 *
 * plan §4.1 fill_blank + multiple_choice 채점 공통 의존. 기존 apps/api/src/study/routes.ts
 * `normalizeAnswer()`를 본 패키지로 격리. apps/api는 Step 3-UX-5에서 import 전환.
 *
 * 정합:
 *   - 사용자가 "②" / "2" / "2번" 어느 형태로 입력해도 동일 정답으로 매칭
 *   - 원형숫자 ①~⑩ → 1~10
 *   - '번' 접미사 제거 ('호' 접미사는 향후 carry-over)
 *   - 회귀: Pass 1 CRIT-1 (regex character class 어긋남 시 silent corruption 차단)
 *     Pass 3 CRIT-3 / Pass 1 M1 ('호$' 분기 carry-over)
 */
export function normalizeAnswer(s: string): string {
  const circledNumbers = '①②③④⑤⑥⑦⑧⑨⑩';
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[①-⑩]/g, (m) => {
      const idx = circledNumbers.indexOf(m);
      return idx === -1 ? m : String(idx + 1);
    })
    .replace(/번$/, '');
}
