import type { Landmarks2D, Point2D } from './types';

const POSE_CONNECTIONS: Array<[number, number]> = [
  [11, 12], [11, 23], [12, 24], [23, 24],
  [11, 13], [13, 15],
  [12, 14], [14, 16],
  [23, 25], [25, 27], [27, 31],
  [24, 26], [26, 28], [28, 32]
];

export function drawPose(ctx: CanvasRenderingContext2D, landmarks: Landmarks2D, opts: { color?: string; pointColor?: string } = {}) {
  if (!landmarks || !landmarks[0]) return;
  const lm = landmarks[0];
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.lineWidth = 3;
  ctx.strokeStyle = opts.color || '#4da3ff';
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  for (const [a, b] of POSE_CONNECTIONS) {
    const pa = lm[a];
    const pb = lm[b];
    if (!pa || !pb) continue;
    ctx.moveTo(pa.x * w, pa.y * h);
    ctx.lineTo(pb.x * w, pb.y * h);
  }
  ctx.stroke();
  ctx.fillStyle = opts.pointColor || '#eaf2ff';
  for (let i = 0; i < lm.length; i++) {
    const p = lm[i];
    if (!p) continue;
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function speedToColor(speedPxPerSec: number): string {
  const s = Math.max(0, Math.min(1, speedPxPerSec / 1500));
  const r = Math.round(255 * s);
  const g = Math.round(160 * (1 - s) + 40 * s);
  const b = Math.round(255 * (1 - s));
  return `rgb(${r},${g},${b})`;
}

export function drawRing(ctx: CanvasRenderingContext2D, x: number, y: number, { radius = 14, color = '#ffd166', width = 3 }: { radius?: number; color?: string; width?: number } = {}) {
  ctx.save();
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.95;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(2, radius * 0.4), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  vx: number,
  vy: number,
  { color = '#4da3ff', scale = 0.05, maxLen = 120, width = 4 }: { color?: string; scale?: number; maxLen?: number; width?: number } = {}
) {
  const len = Math.hypot(vx, vy);
  if (!isFinite(len) || len <= 0) return;
  const dirx = vx / len;
  const diry = vy / len;
  let L = Math.min(maxLen, len * scale);
  L = Math.max(10, L);
  const tox = x + dirx * L;
  const toy = y + diry * L;
  ctx.save();
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.95;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(tox, toy);
  ctx.stroke();
  const headLen = Math.max(8, Math.min(18, L * 0.25));
  const angle = Math.atan2(diry, dirx);
  const left = angle + Math.PI - Math.PI / 6;
  const right = angle + Math.PI + Math.PI / 6;
  ctx.beginPath();
  ctx.moveTo(tox, toy);
  ctx.lineTo(tox + Math.cos(left) * headLen, toy + Math.sin(left) * headLen);
  ctx.moveTo(tox, toy);
  ctx.lineTo(tox + Math.cos(right) * headLen, toy + Math.sin(right) * headLen);
  ctx.stroke();
  ctx.restore();
}

export function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, { color = '#eaf2ff', bg = 'rgba(0,0,0,0.55)' }: { color?: string; bg?: string } = {}) {
  ctx.save();
  ctx.font = '600 14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  const padX = 8, padY = 6;
  const metrics = ctx.measureText(text);
  const w = Math.ceil(metrics.width) + padX * 2;
  const h = 20 + padY * 2;
  const rx = 8;
  const bx = x, by = y;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(bx + rx, by);
  ctx.arcTo(bx + w, by, bx + w, by + h, rx);
  ctx.arcTo(bx + w, by + h, bx, by + h, rx);
  ctx.arcTo(bx, by + h, bx, by, rx);
  ctx.arcTo(bx, by, bx + w, by, rx);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillText(text, bx + padX, by + h - padY - 6);
  ctx.restore();
}

export function drawFootOverlay(ctx: CanvasRenderingContext2D, pos: Point2D | null, vel: { x: number; y: number } | null, labelText?: string) {
  if (!pos) return;
  const speed = vel ? Math.hypot(vel.x, vel.y) : 0;
  const color = speedToColor(speed);
  drawRing(ctx, pos.x, pos.y, { color });
  if (vel) drawArrow(ctx, pos.x, pos.y, vel.x, vel.y, { color });
  if (labelText) {
    const lx = pos.x + 14;
    const ly = pos.y - 14;
    drawLabel(ctx, labelText, lx, Math.max(0, ly));
  }
}
