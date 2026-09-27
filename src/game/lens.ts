// The projection lens: its offset from the focal point decides how far the light separates.

export interface LensPos {
  x: number;
  y: number;
}

/** Where the lens starts each visit: well out of focus, low and to one side. */
export const LENS_START: LensPos = { x: -0.72, y: -0.55 };
export const FOCAL: LensPos = { x: 0, y: 0 };
export const FOCUS_THRESHOLD = 0.08;

export function clampLens(p: LensPos): LensPos {
  return { x: Math.max(-1, Math.min(1, p.x)), y: Math.max(-1, Math.min(1, p.y)) };
}

/** 0 when perfectly focused, 1 at the far corners. */
export function separation(p: LensPos): number {
  return Math.min(1, Math.hypot(p.x - FOCAL.x, p.y - FOCAL.y) / Math.SQRT2);
}

export function isFocused(p: LensPos): boolean {
  return separation(p) <= FOCUS_THRESHOLD;
}

export function nudge(p: LensPos, dx: number, dy: number): LensPos {
  return clampLens({ x: p.x + dx, y: p.y + dy });
}

/** Once close, the lens settles into the detent so touch users are not hunting for pixels. */
export function settle(p: LensPos): LensPos {
  return separation(p) <= FOCUS_THRESHOLD * 1.6 ? { ...FOCAL } : p;
}
