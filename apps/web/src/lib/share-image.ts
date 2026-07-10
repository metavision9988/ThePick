/**
 * share-image — 세션 결과 공유 이미지 클라이언트 canvas 생성 (FE-8).
 *
 * 서버 무접촉(PII 0·G-1 정합). 디자인 정본 준수: 플랫, 그라디언트 금지,
 * indigo 단일 강조, 트로피/폭죽 금지, 수치 중심.
 */

export interface ShareImageInput {
  readonly correct: number;
  readonly total: number;
  readonly streakDays: number;
  readonly modeLabel: string;
  /** 하단 표기 URL (G-5 — 호출 측이 site 주입, 하드코딩 금지). */
  readonly siteUrl: string;
}

const W = 800;
const H = 420;

const COLORS = {
  bg: '#f9fafb',
  card: '#ffffff',
  border: '#e5e7eb',
  text: '#111827',
  sub: '#6b7280',
  indigo: '#4f46e5',
} as const;

const FONT = "Pretendard, 'Pretendard Variable', -apple-system, sans-serif";

/** 캔버스에 결과 카드 렌더 — 순수 그리기(다운로드/공유는 호출 측). */
export function drawShareCard(canvas: HTMLCanvasElement, input: ShareImageInput): boolean {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (ctx === null) return false;

  // 바탕 + 카드 (near-white 위 1px 보더 카드 — 그림자 없음).
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = COLORS.card;
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 2;
  roundRect(ctx, 24, 24, W - 48, H - 48, 12);
  ctx.fill();
  ctx.stroke();

  // 워드마크 + 모드.
  ctx.fillStyle = COLORS.text;
  ctx.font = `500 26px ${FONT}`;
  ctx.textBaseline = 'top';
  ctx.fillText('쪽집게', 64, 64);
  ctx.fillStyle = COLORS.sub;
  ctx.font = `400 17px ${FONT}`;
  ctx.fillText(`손해평가사 1차 기출 · ${input.modeLabel}`, 64, 100);

  // 정답률 hero 숫자 (indigo, tabular 감각).
  const pct = input.total > 0 ? Math.round((input.correct / input.total) * 100) : 0;
  ctx.fillStyle = COLORS.indigo;
  ctx.font = `500 96px ${FONT}`;
  ctx.fillText(`${pct}%`, 64, 158);

  ctx.fillStyle = COLORS.text;
  ctx.font = `400 24px ${FONT}`;
  ctx.fillText(`${input.correct} / ${input.total} 정답`, 64, 272);

  if (input.streakDays > 0) {
    ctx.fillStyle = COLORS.sub;
    ctx.font = `400 19px ${FONT}`;
    ctx.fillText(`${input.streakDays}일 연속 학습`, 64, 308);
  }

  // 하단 URL.
  ctx.fillStyle = COLORS.sub;
  ctx.font = `400 17px ${FONT}`;
  ctx.fillText(input.siteUrl, 64, H - 76);

  return true;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** canvas → PNG Blob (toBlob 콜백의 Promise 래핑, 실패 시 null). */
export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    } catch {
      resolve(null);
    }
  });
}

/** 공유(가능하면 navigator.share) → 실패/미지원 시 다운로드 폴백. 반환 = 사용한 방식. */
export async function shareOrDownload(
  blob: Blob,
  fileName: string,
): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], fileName, { type: 'image/png' });
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[] }) => Promise<void>;
  };
  if (typeof nav.share === 'function' && typeof nav.canShare === 'function') {
    try {
      if (nav.canShare({ files: [file] })) {
        await nav.share({ files: [file] });
        return 'shared';
      }
    } catch {
      // 사용자 취소·미지원 — 다운로드 폴백.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return 'downloaded';
}
