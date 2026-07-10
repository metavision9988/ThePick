/**
 * 인라인 stroke SVG 아이콘 — claudeDesign shared.jsx 이식.
 * currentColor 상속, 의미 아이콘만(장식 이모지 금지 — 디자인 정본).
 */

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps, size: number): IconProps {
  return {
    width: size,
    height: size,
    viewBox: '0 0 20 20',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    ...props,
  };
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...base(props, 16)}>
      <path d="M4 10.5l4 4 8-9" />
    </svg>
  );
}

export function IconX(props: IconProps) {
  return (
    <svg {...base(props, 16)}>
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

export function IconArrowRight(props: IconProps) {
  return (
    <svg {...base(props, 16)}>
      <path d="M3 10h14M11 4l6 6-6 6" />
    </svg>
  );
}

export function IconFlame(props: IconProps) {
  return (
    <svg {...base(props, 16)}>
      <path d="M10 2.5c.5 2.5-2.5 4-2.5 7a4.5 4.5 0 0 0 9 0c0-1.5-.7-2.8-1.5-3.8-.3 1-.8 1.8-1.5 2.3.3-2.5-1-5-3.5-5.5z" />
    </svg>
  );
}

export function IconChevron(props: IconProps) {
  return (
    <svg {...base(props, 14)}>
      <path d="M7 4l6 6-6 6" />
    </svg>
  );
}

export function IconClock(props: IconProps) {
  return (
    <svg {...base(props, 14)}>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 5.5V10l3 2" />
    </svg>
  );
}
