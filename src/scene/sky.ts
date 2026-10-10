import { clamp, hex, lerp, mix, type RGB } from './color';

export interface Sky {
  top: RGB;
  bottom: RGB;
  /** 外の明るさ 0..1 */
  light: number;
  /** 店内の灯りの強さ 0..1 */
  lamp: number;
  /** 店内の色にかける係数 */
  roomTint: RGB;
  /** 窓の外の色にかける係数 */
  outTint: RGB;
}

interface Key {
  h: number;
  top: RGB;
  bottom: RGB;
  tint: RGB;
  light: number;
}

const NIGHT = { top: hex('#10162e'), bottom: hex('#1c2444'), tint: [0.6, 0.54, 0.58] as RGB, light: 0 };

/** 時刻ごとの空と店内の色。あいだはなめらかに補間する */
const KEYS: Key[] = [
  { h: 0, ...NIGHT },
  { h: 4.5, ...NIGHT },
  { h: 5.5, top: hex('#2c3160'), bottom: hex('#8a6a86'), tint: [0.68, 0.6, 0.62], light: 0.1 },
  { h: 6.5, top: hex('#7f96c8'), bottom: hex('#f4c098'), tint: [0.95, 0.86, 0.78], light: 0.6 },
  { h: 8.5, top: hex('#86bfe6'), bottom: hex('#d8eef2'), tint: [1, 0.98, 0.94], light: 1 },
  { h: 15.5, top: hex('#86bfe6'), bottom: hex('#d8eef2'), tint: [1, 1, 0.97], light: 1 },
  { h: 17, top: hex('#7ea4d2'), bottom: hex('#f8d090'), tint: [1, 0.92, 0.8], light: 0.8 },
  { h: 18.2, top: hex('#58508c'), bottom: hex('#f08c5c'), tint: [0.96, 0.78, 0.66], light: 0.45 },
  { h: 19.2, top: hex('#2a2c5a'), bottom: hex('#7c4c6e'), tint: [0.74, 0.62, 0.62], light: 0.12 },
  { h: 20.2, ...NIGHT },
  { h: 24, ...NIGHT },
];

const RAIN_GRAY: RGB = [150, 160, 172];

export function skyAt(hour: number, rain: number): Sky {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = b.h > a.h ? clamp((h - a.h) / (b.h - a.h), 0, 1) : 0;

  let top = mix(a.top, b.top, t);
  let bottom = mix(a.bottom, b.bottom, t);
  let tint = mix(a.tint, b.tint, t);
  let light = lerp(a.light, b.light, t);

  if (rain > 0) {
    const lum = (c: RGB) => (c[0] * 0.3 + c[1] * 0.5 + c[2] * 0.2) / 255;
    const gray = (c: RGB): RGB => {
      const l = 0.25 + lum(c) * 0.7;
      return [RAIN_GRAY[0] * l, RAIN_GRAY[1] * l, RAIN_GRAY[2] * l];
    };
    top = mix(top, gray(top), 0.8 * rain);
    bottom = mix(bottom, gray(bottom), 0.8 * rain);
    tint = mix(tint, [tint[0] * 0.84, tint[1] * 0.86, tint[2] * 0.92], rain);
    light *= 1 - 0.45 * rain;
  }

  const lamp = clamp((0.78 - light) / 0.5, 0, 1);
  // 灯りがともると、店内は少し暖かい色になる
  const roomTint: RGB = [
    Math.min(1, tint[0] + lamp * 0.16),
    Math.min(1, tint[1] + lamp * 0.08),
    Math.min(1, tint[2] + lamp * 0.0),
  ];
  const dayOut: RGB = rain > 0 ? mix([1, 1, 1], [0.72, 0.76, 0.82], rain) : [1, 1, 1];
  const outTint = mix([0.2, 0.22, 0.38], dayOut, clamp(light * 1.15, 0, 1));
  // 夕焼けは外も少し赤く
  const dusk = clamp(1 - Math.abs(h - 18) / 1.6, 0, 1) * (1 - rain);
  const outWarm = mix(outTint, [outTint[0] * 1.08, outTint[1] * 0.86, outTint[2] * 0.78], dusk);

  return { top, bottom, light, lamp, roomTint, outTint: outWarm };
}
