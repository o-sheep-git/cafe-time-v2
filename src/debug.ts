/**
 * 開発用の小さな仕掛け。URL に ?debug を付けたときだけ有効になる。
 *   ?debug&hour=20.5   … 店内の時刻を固定する
 * コンソールからは window.__cafe で操作できる（App.tsx を参照）。
 */
const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();

export const DEBUG = params.has('debug');

let hourOverride: number | null = null;
if (DEBUG && params.has('hour')) {
  const h = Number(params.get('hour'));
  if (Number.isFinite(h)) hourOverride = ((h % 24) + 24) % 24;
}

export function setHourOverride(h: number | null): void {
  hourOverride = h;
}

/** 店内の時刻（0..24 の小数）。ふだんは端末のローカル時刻 */
export function sceneHour(now: number): number {
  if (hourOverride != null) return hourOverride;
  const d = new Date(now);
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}
