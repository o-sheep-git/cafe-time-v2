export type RGB = [number, number, number];

export function hex(h: string): RGB {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

export function mul(a: RGB, m: RGB): RGB {
  return [a[0] * m[0], a[1] * m[1], a[2] * m[2]];
}

export function css(c: RGB, alpha = 1): string {
  const r = Math.max(0, Math.min(255, Math.round(c[0])));
  const g = Math.max(0, Math.min(255, Math.round(c[1])));
  const b = Math.max(0, Math.min(255, Math.round(c[2])));
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
