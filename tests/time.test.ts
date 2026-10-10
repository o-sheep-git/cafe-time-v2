import { describe, expect, it } from 'vitest';
import { HOUR, MINUTE } from '../src/game/data';
import { eligibleEvents, pickEvent, seasonOf, weatherAt } from '../src/game/ambience';
import { createNewSave } from '../src/game/save';
import { finishSession, startSession } from '../src/game/session';
import { computeStats, groupHistory } from '../src/game/stats';
import { dayKey, formatClock, formatDuration, splitByLocalDay, startOfWeek } from '../src/game/time';
import type { SaveData } from '../src/game/types';
import { at } from './helpers';

function work(state: SaveData, start: number, minutes: number): SaveData {
  const end = start + minutes * MINUTE;
  return finishSession(startSession(state, 'blend', start), end, end).state;
}

describe('日付', () => {
  it('ローカル日付のキー', () => {
    expect(dayKey(at(2026, 1, 5, 23, 59))).toBe('2026-01-05');
    expect(dayKey(at(2026, 1, 6, 0, 0))).toBe('2026-01-06');
  });
  it('週は月曜はじまり', () => {
    // 2026-10-10 は土曜日
    expect(startOfWeek(at(2026, 10, 10, 15))).toBe(at(2026, 10, 5));
    expect(startOfWeek(at(2026, 10, 11, 15))).toBe(at(2026, 10, 5)); // 日曜
    expect(startOfWeek(at(2026, 10, 12, 0))).toBe(at(2026, 10, 12));
  });
  it('日付をまたぐ区間を分ける', () => {
    const segs = splitByLocalDay(at(2026, 10, 10, 23, 30), at(2026, 10, 11, 0, 45));
    expect(segs.map((s) => [s.day, s.ms])).toEqual([['2026-10-10', 30 * MINUTE], ['2026-10-11', 45 * MINUTE]]);
    expect(splitByLocalDay(5, 5)).toEqual([]);
    expect(splitByLocalDay(10, 5)).toEqual([]);
  });
  it('表示用の整形', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(65_000)).toBe('1:05');
    expect(formatClock(3_725_000)).toBe('1:02:05');
    expect(formatClock(3_725_000, false)).toBe('1:02');
    expect(formatClock(-5)).toBe('0:00');
    expect(formatDuration(30_000)).toBe('1分未満');
    expect(formatDuration(45 * MINUTE)).toBe('45分');
    expect(formatDuration(2 * HOUR)).toBe('2時間');
    expect(formatDuration(2 * HOUR + 5 * MINUTE)).toBe('2時間5分');
  });
});

describe('手帳の数字', () => {
  it('今日・今週・累計', () => {
    let s = createNewSave(0);
    s = work(s, at(2026, 10, 4, 10), 60); // 先週の日曜
    s = work(s, at(2026, 10, 5, 10), 30); // 月曜
    s = work(s, at(2026, 10, 10, 8), 20); // 今日
    const st = computeStats(s, at(2026, 10, 10, 12));
    expect(st.todayMs).toBe(20 * MINUTE);
    expect(st.weekMs).toBe(50 * MINUTE);
    expect(st.totalMs).toBe(110 * MINUTE);
    expect(st.visits).toBe(3);
    expect(st.visitDays).toBe(3);
  });
  it('日付をまたいだ作業は、今日のぶんだけ今日に数える', () => {
    let s = createNewSave(0);
    s = work(s, at(2026, 10, 9, 23, 0), 120);
    const st = computeStats(s, at(2026, 10, 10, 9));
    expect(st.todayMs).toBe(60 * MINUTE);
    expect(st.totalMs).toBe(120 * MINUTE);
  });
  it('進行中の作業も含める', () => {
    const s = startSession(work(createNewSave(0), at(2026, 10, 10, 8), 20), 'blend', at(2026, 10, 10, 10));
    const st = computeStats(s, at(2026, 10, 10, 10, 30));
    expect(st.todayMs).toBe(50 * MINUTE);
    expect(st.totalMs).toBe(50 * MINUTE);
  });
  it('履歴は新しい順に日ごとにまとまる', () => {
    let s = createNewSave(0);
    s = work(s, at(2026, 10, 9, 10), 30);
    s = work(s, at(2026, 10, 10, 8), 20);
    s = work(s, at(2026, 10, 10, 13), 40);
    const g = groupHistory(s.history);
    expect(g).toHaveLength(2);
    expect(g[0].day).toBe(at(2026, 10, 10));
    expect(g[0].totalMs).toBe(60 * MINUTE);
    expect(g[0].sessions.map((x) => x.start)).toEqual([at(2026, 10, 10, 13), at(2026, 10, 10, 8)]);
  });
});

describe('天気と出来事', () => {
  it('同じ時刻なら同じ天気', () => {
    const t = at(2026, 6, 15, 14);
    expect(weatherAt(t)).toEqual(weatherAt(t));
    expect(weatherAt(t, 'rain').kind).toBe('rain');
    expect(weatherAt(t, 'clear').kind).toBe('clear');
  });
  it('1年を通して、雨は少なすぎも多すぎもしない', () => {
    let rain = 0;
    let n = 0;
    for (let d = 0; d < 365; d++) {
      for (const h of [9, 14, 20]) {
        n++;
        if (weatherAt(at(2026, 1, 1 + d, h)).kind === 'rain') rain++;
      }
    }
    expect(rain / n).toBeGreaterThan(0.08);
    expect(rain / n).toBeLessThan(0.35);
  });
  it('季節', () => {
    expect([1, 4, 7, 10].map(seasonOf)).toEqual(['winter', 'spring', 'summer', 'autumn']);
  });
  it('条件に合う出来事だけが起きる', () => {
    const day = { hour: 14, season: 'autumn' as const, raining: false, level: 1, reducedMotion: false };
    expect(eligibleEvents(day).map((e) => e.id)).toEqual(['cat', 'bird', 'leaves']);
    expect(eligibleEvents({ ...day, raining: true }).map((e) => e.id)).toEqual(['umbrella']);
    expect(eligibleEvents({ ...day, hour: 23, level: 3 }).map((e) => e.id)).toEqual(['star']);
    expect(eligibleEvents({ ...day, reducedMotion: true }).map((e) => e.id)).toEqual(['bird']);
    expect(pickEvent(day, 0.999)!.id).toBe('leaves');
    expect(pickEvent({ ...day, raining: true, hour: 3 }, 0.5)).toBeNull();
  });
});
