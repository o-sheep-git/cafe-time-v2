import { EVENTS, type EventDef, type Season } from './data';
import type { WeatherSetting } from './types';

/**
 * 天候。将来ここに種類を足していく（例: 'cloudy' | 'snow'）。
 * 足したら weatherAt と、scene / audio の対応する分岐を追加する。
 */
export type WeatherKind = 'clear' | 'rain';

export interface Weather {
  kind: WeatherKind;
  /** 0..1 */
  intensity: number;
}

export function seasonOf(month: number): Season {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

/** 0..1 の決まった乱数（同じ引数なら同じ値） */
export function hash01(a: number, b = 0): number {
  let h = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul((b | 0) + 0x7f4a7c15, 0x85ebca6b)) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39) >>> 0;
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

const RAINY_DAY_CHANCE = [0.2, 0.2, 0.25, 0.25, 0.25, 0.42, 0.38, 0.25, 0.35, 0.28, 0.22, 0.2];
/** 天気が切り替わる単位（時間） */
const WEATHER_BLOCK_HOURS = 3;

/**
 * その時刻の天気。外部APIは使わず、日付から決まる。
 * 雨の日は3時間ごとに降ったりやんだりする。
 */
export function weatherAt(ms: number, setting: WeatherSetting = 'auto'): Weather {
  if (setting === 'clear') return { kind: 'clear', intensity: 0 };
  if (setting === 'rain') return { kind: 'rain', intensity: 0.8 };
  const d = new Date(ms);
  const dayNum = d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate();
  const rainyDay = hash01(dayNum, 11) < RAINY_DAY_CHANCE[d.getMonth()];
  if (!rainyDay) return { kind: 'clear', intensity: 0 };
  const block = Math.floor(d.getHours() / WEATHER_BLOCK_HOURS);
  if (hash01(dayNum, 100 + block) < 0.65) {
    return { kind: 'rain', intensity: 0.5 + hash01(dayNum, 200 + block) * 0.5 };
  }
  return { kind: 'clear', intensity: 0 };
}

function hourInRange(hour: number, range: [number, number]): boolean {
  const [from, to] = range;
  return from <= to ? hour >= from && hour < to : hour >= from || hour < to;
}

export interface EventContext {
  hour: number;
  season: Season;
  raining: boolean;
  level: number;
  reducedMotion: boolean;
}

export function eligibleEvents(ctx: EventContext): EventDef[] {
  return EVENTS.filter((e) => {
    if (e.ambient) return false;
    if (e.minLevel > ctx.level) return false;
    if (e.moving && ctx.reducedMotion) return false;
    if (e.when.rain !== undefined && e.when.rain !== ctx.raining) return false;
    if (e.when.hours && !hourInRange(ctx.hour, e.when.hours)) return false;
    if (e.when.seasons && !e.when.seasons.includes(ctx.season)) return false;
    return true;
  });
}

export function pickEvent(ctx: EventContext, rnd: number): EventDef | null {
  const list = eligibleEvents(ctx);
  if (list.length === 0) return null;
  return list[Math.min(list.length - 1, Math.floor(rnd * list.length))];
}
