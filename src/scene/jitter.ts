/** Deterministic 0..1 jitter, so every visit (and every capture) places things identically. */
export function jitter(i: number, salt = 0): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}
