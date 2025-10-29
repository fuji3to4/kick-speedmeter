import type { Point2D, Point3D, Landmarks2D, Landmarks3D, Side } from './types';

export function distance3D(a?: Point3D | null, b?: Point3D | null): number {
  if (!a || !b) return 0;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function computeSpeed3D(prevPt: Point3D | null, currPt: Point3D | null, dtSec: number): number {
  if (!prevPt || !currPt || !dtSec || dtSec <= 0) return 0;
  const d = distance3D(prevPt, currPt);
  return d / dtSec;
}

export function ema(prev: number | null, curr: number, alpha = 0.3): number {
  if (prev == null) return curr;
  return prev * (1 - alpha) + curr * alpha;
}

export function angleAt(A?: Point2D | null, B?: Point2D | null, C?: Point2D | null): number {
  if (!A || !B || !C) return 0;
  const v1x = A.x - B.x, v1y = A.y - B.y;
  const v2x = C.x - B.x, v2y = C.y - B.y;
  const dot = v1x * v2x + v1y * v2y;
  const m1 = Math.hypot(v1x, v1y);
  const m2 = Math.hypot(v2x, v2y);
  if (m1 === 0 || m2 === 0) return 0;
  const cos = Math.min(1, Math.max(-1, dot / (m1 * m2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

export function pearson(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 3) return 0;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    const xi = x[i];
    const yi = y[i];
    sx += xi; sy += yi; sxx += xi * xi; syy += yi * yi; sxy += xi * yi;
  }
  const cov = sxy - (sx * sy) / n;
  const vx = sxx - (sx * sx) / n;
  const vy = syy - (sy * sy) / n;
  if (vx <= 0 || vy <= 0) return 0;
  return cov / Math.sqrt(vx * vy);
}

export function landmarkBySide(
  landmarks: Landmarks2D | null | undefined,
  side: Side,
  key: 'ankle' | 'foot_index' | 'wrist' | 'index'
) {
  if (!landmarks || !landmarks[0]) return null;
  const lm = landmarks[0];
  const map: Record<Side, Record<'ankle' | 'foot_index' | 'wrist' | 'index', number>> = {
    left: { ankle: 27, foot_index: 31, wrist: 15, index: 19 },
    right: { ankle: 28, foot_index: 32, wrist: 16, index: 20 }
  };
  const idx = map[side]?.[key];
  if (idx == null || !lm[idx]) return null;
  return lm[idx];
}

export function worldLandmarkBySide(
  worldLandmarks: Landmarks3D | null | undefined,
  side: Side,
  key: 'ankle' | 'foot_index' | 'wrist' | 'index'
) {
  if (!worldLandmarks || !worldLandmarks[0]) return null;
  const lm = worldLandmarks[0];
  const map: Record<Side, Record<'ankle' | 'foot_index' | 'wrist' | 'index', number>> = {
    left: { ankle: 27, foot_index: 31, wrist: 15, index: 19 },
    right: { ankle: 28, foot_index: 32, wrist: 16, index: 20 }
  };
  const idx = map[side]?.[key];
  if (idx == null || !lm[idx]) return null;
  return lm[idx];
}

export function kneeAngle(landmarks: Landmarks2D | null | undefined, side: Side): number {
  if (!landmarks || !landmarks[0]) return 0;
  const lm = landmarks[0];
  const map: Record<Side, { hip: number; knee: number; ankle: number }> = {
    left: { hip: 23, knee: 25, ankle: 27 },
    right: { hip: 24, knee: 26, ankle: 28 }
  };
  const m = map[side];
  return angleAt(lm[m.hip], lm[m.knee], lm[m.ankle]);
}

export function clamp(v: number, min: number, max: number): number { return Math.max(min, Math.min(max, v)); }
