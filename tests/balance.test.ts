/**
 * ゲームバランスの確認。実際のロジックで数か月ぶんの利用をなぞり、
 * 進行が速すぎず遅すぎないことを確かめる。数字を変えたらここで様子を見る。
 */
import { describe, expect, it } from 'vitest';
import { MINUTE, RANKS } from '../src/game/data';
import { rankForPoints } from '../src/game/progress';
import { createNewSave } from '../src/game/save';
import { finishSession, startSession } from '../src/game/session';
import type { SaveData } from '../src/game/types';
import { at } from './helpers';

declare const process: { stdout: { write(text: string): void } };

interface Habit {
  /** 1日の作業（分）。複数回に分けて行う */
  sessions: number[];
  /** 週に何日来るか */
  daysPerWeek: number;
}

/** 各レベルに何日目で届いたか（1始まり）。届かなければ Infinity */
function simulate(habit: Habit, days: number): number[] {
  let s: SaveData = createNewSave(at(2026, 1, 5));
  const reachedOn = RANKS.map(() => Infinity);
  reachedOn[0] = 1;
  for (let d = 0; d < days; d++) {
    if (d % 7 >= habit.daysPerWeek) continue;
    let t = at(2026, 1, 5 + d, 9, 0);
    for (const minutes of habit.sessions) {
      const end = t + minutes * MINUTE;
      s = finishSession(startSession(s, 'blend', t), end, end).state;
      t = end + 15 * MINUTE;
    }
    const lv = rankForPoints(s.points).level;
    for (let i = 0; i < lv; i++) reachedOn[i] = Math.min(reachedOn[i], d + 1);
  }
  return reachedOn;
}

const LIGHT: Habit = { sessions: [45], daysPerWeek: 4 };
const TYPICAL: Habit = { sessions: [60, 60], daysPerWeek: 5 };
const HEAVY: Habit = { sessions: [120, 120, 120], daysPerWeek: 6 };

describe('ゲームバランス', () => {
  const light = simulate(LIGHT, 800);
  const typical = simulate(TYPICAL, 800);
  const heavy = simulate(HEAVY, 800);

  it('進み具合の一覧（参考）', () => {
    const rows = RANKS.map((r, i) => `Lv${String(r.level).padStart(2)} ${String(r.points).padStart(6)}  軽め ${String(light[i]).padStart(4)}日  ふつう ${String(typical[i]).padStart(4)}日  多め ${String(heavy[i]).padStart(4)}日  ${r.name}`);
    process.stdout.write(['常連度に届くまでの日数（軽め=45分×週4 / ふつう=2時間×週5 / 多め=6時間×週6）', ...rows, ''].join('\n'));
    expect(rows).toHaveLength(RANKS.length);
  });

  it('はじめての25分で、最初の変化がある', () => {
    const s = createNewSave(0);
    const t = at(2026, 1, 5, 9);
    const { receipt } = finishSession(startSession(s, 'blend', t), t + 25 * MINUTE, t + 25 * MINUTE);
    expect(receipt!.reached).toEqual([2]);
  });

  it('短い作業にも意味がある（10分でも進む）', () => {
    const s = createNewSave(0);
    const t = at(2026, 1, 5, 9);
    const { state } = finishSession(startSession(s, 'blend', t), t + 10 * MINUTE, t + 10 * MINUTE);
    expect(state.points).toBe(30);
  });

  it('ふつうの使い方で、最初の1週間に3つほど変化がある', () => {
    expect(typical[3]).toBeLessThanOrEqual(5); // 紅茶
    expect(typical[4]).toBeLessThanOrEqual(10);
  });

  it('ふつうの使い方で、すべての変化を見るまで数か月かかる', () => {
    expect(typical[9]).toBeGreaterThan(40); // プリンは1か月半より先
    expect(typical[9]).toBeLessThan(100);
    expect(typical[14]).toBeGreaterThan(150);
    expect(typical[14]).toBeLessThan(330);
  });

  it('軽めの使い方でも、1か月のうちにいくつか変化があり、1年半ほどで最後まで届く', () => {
    expect(light[3]).toBeLessThanOrEqual(14);
    expect(light[5]).toBeLessThanOrEqual(45);
    expect(light[14]).toBeLessThan(800);
  });

  it('たくさん作業しても、2か月より早くは終わらない', () => {
    expect(heavy[14]).toBeGreaterThan(60);
  });

  it('変化の間隔が長く空きすぎない（ふつうの使い方で、最長でも7週間ほど）', () => {
    for (let i = 1; i < RANKS.length; i++) expect(typical[i] - typical[i - 1]).toBeLessThanOrEqual(50);
  });

  it('タイマーを回し続けても、ふつうに作業した人の2倍までは進まない', () => {
    const t0 = at(2026, 1, 5, 6);
    const run = (minutes: number) => {
      let s = createNewSave(0);
      for (let d = 0; d < 30; d++) {
        const t = t0 + d * 24 * 60 * MINUTE;
        s = finishSession(startSession(s, 'blend', t), t + minutes * MINUTE, t + minutes * MINUTE).state;
      }
      return s.points;
    };
    const sixHours = run(6 * 60);
    const twelveHours = run(12 * 60);
    expect(twelveHours / sixHours).toBeLessThan(1.5);
    // 短い作業を毎日続けた人が、極端に不利にならない
    expect(run(60) / sixHours).toBeGreaterThan(0.2);
  });
});
