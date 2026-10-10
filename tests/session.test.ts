import { describe, expect, it } from 'vitest';
import { AWAY_GAP_MS, HISTORY_LIMIT, HOUR, MAX_SESSION_MS, MINUTE, VISIT_BONUS } from '../src/game/data';
import { createNewSave } from '../src/game/save';
import {
  assessActive, computeReward, discardSession, elapsedMs, finishSession, recordSeen, selectMenu,
  startSession, touchSession,
} from '../src/game/session';
import type { SaveData } from '../src/game/types';
import { at } from './helpers';

const T0 = at(2026, 10, 10, 9, 0);

function work(state: SaveData, start: number, minutes: number, menu = 'blend'): SaveData {
  const s = startSession(state, menu, start);
  return finishSession(s, start + minutes * MINUTE, start + minutes * MINUTE).state;
}

describe('経過時間', () => {
  it('開始時刻と現在時刻の差で決まる', () => {
    const s = startSession(createNewSave(T0), 'blend', T0);
    expect(elapsedMs(s.active!, T0 + 90 * MINUTE)).toBe(90 * MINUTE);
  });
  it('時計が巻き戻っても負にならない', () => {
    const s = startSession(createNewSave(T0), 'blend', T0);
    expect(elapsedMs(s.active!, T0 - HOUR)).toBe(0);
  });
  it('上限で止まる', () => {
    const s = startSession(createNewSave(T0), 'blend', T0);
    expect(elapsedMs(s.active!, T0 + 100 * HOUR)).toBe(MAX_SESSION_MS);
    expect(elapsedMs({ ...s.active!, startedAt: NaN }, T0)).toBe(0);
  });
});

describe('作業の開始と終了', () => {
  it('開始すると進行中の作業が保存される', () => {
    const s = startSession(createNewSave(T0), 'blend', T0);
    expect(s.active).toEqual({ startedAt: T0, menuId: 'blend', lastSeenAt: T0 });
  });
  it('二重に開始しても上書きされない', () => {
    const s = startSession(createNewSave(T0), 'blend', T0);
    expect(startSession(s, 'blend', T0 + HOUR)).toBe(s);
  });
  it('まだ頼めないメニューでは、頼めるものに置き換わる', () => {
    const s = startSession(createNewSave(T0), 'pudding', T0);
    expect(s.active!.menuId).toBe('blend');
  });
  it('終了すると履歴・累計・なじみが増える', () => {
    const s = startSession(createNewSave(T0), 'blend', T0);
    const { state, receipt } = finishSession(s, T0 + 25 * MINUTE, T0 + 25 * MINUTE);
    expect(state.active).toBeNull();
    expect(state.totalWorkMs).toBe(25 * MINUTE);
    expect(state.history).toHaveLength(1);
    expect(state.history[0]).toMatchObject({ start: T0, end: T0 + 25 * MINUTE, menuId: 'blend', points: 45 });
    expect(state.points).toBe(25 + VISIT_BONUS);
    expect(state.visits).toBe(1);
    expect(state.visitDays).toBe(1);
    expect(receipt).toMatchObject({ recorded: true, durationMs: 25 * MINUTE, points: 45, visitBonus: VISIT_BONUS });
  });
  it('はじめての25分でアイスコーヒーが解放される', () => {
    const { state, receipt } = finishSession(startSession(createNewSave(T0), 'blend', T0), T0 + 25 * MINUTE, T0 + 25 * MINUTE);
    expect(receipt!.reached).toEqual([2]);
    expect(state.unlockedMenus).toEqual(['blend', 'iced']);
  });
  it('1分に満たない作業は記録しない', () => {
    const s = startSession(createNewSave(T0), 'blend', T0);
    const { state, receipt } = finishSession(s, T0 + 30_000, T0 + 30_000);
    expect(state.active).toBeNull();
    expect(state.history).toHaveLength(0);
    expect(state.totalWorkMs).toBe(0);
    expect(receipt!.recorded).toBe(false);
  });
  it('終了時刻が開始より前でも壊れない', () => {
    const s = startSession(createNewSave(T0), 'blend', T0);
    const { state, receipt } = finishSession(s, T0 - HOUR, T0);
    expect(receipt!.recorded).toBe(false);
    expect(state.totalWorkMs).toBe(0);
  });
  it('上限を超える終了時刻は上限に丸める', () => {
    const s = startSession(createNewSave(T0), 'blend', T0);
    const { state } = finishSession(s, T0 + 200 * HOUR, T0 + 200 * HOUR);
    expect(state.totalWorkMs).toBe(MAX_SESSION_MS);
    expect(state.history[0].end).toBe(T0 + MAX_SESSION_MS);
  });
  it('進行中の作業がなければ何もしない', () => {
    const s = createNewSave(T0);
    expect(finishSession(s, T0, T0)).toEqual({ state: s, receipt: null });
    expect(discardSession(s, T0)).toBe(s);
  });
  it('記録せずにやめられる', () => {
    const s = discardSession(startSession(createNewSave(T0), 'blend', T0), T0 + HOUR);
    expect(s.active).toBeNull();
    expect(s.history).toHaveLength(0);
  });
  it('履歴は上限件数までで、累計は減らない', () => {
    let s = createNewSave(T0);
    s = { ...s, history: Array.from({ length: HISTORY_LIMIT }, (_, i) => ({
      id: `h${i}`, start: T0 - (HISTORY_LIMIT - i) * HOUR, end: T0 - (HISTORY_LIMIT - i) * HOUR + 10 * MINUTE, menuId: 'blend', points: 10,
    })), totalWorkMs: HISTORY_LIMIT * 10 * MINUTE };
    const next = work(s, T0, 30);
    expect(next.history).toHaveLength(HISTORY_LIMIT);
    expect(next.history.at(-1)!.start).toBe(T0);
    expect(next.totalWorkMs).toBe(HISTORY_LIMIT * 10 * MINUTE + 30 * MINUTE);
  });
});

describe('なじみの計算', () => {
  it('来店ボーナスは1日1回、5分以上の作業につく', () => {
    let s = createNewSave(T0);
    expect(computeReward(s, T0, T0 + 4 * MINUTE)).toEqual({ base: 4, visitBonus: 0, points: 4 });
    s = work(s, T0, 4);
    expect(s.lastBonusDay).toBeNull();
    s = work(s, T0 + 10 * MINUTE, 10);
    expect(s.points).toBe(4 + 10 + VISIT_BONUS);
    s = work(s, T0 + HOUR, 10);
    expect(s.points).toBe(4 + 10 + VISIT_BONUS + 10);
    expect(s.visitDays).toBe(1);
    // 翌日はまたつく
    s = work(s, at(2026, 10, 11, 9, 0), 10);
    expect(s.points).toBe(4 + 10 + VISIT_BONUS + 10 + 10 + VISIT_BONUS);
    expect(s.visitDays).toBe(2);
  });
  it('1日6時間を超えた分は半分になる（累計作業時間はそのまま）', () => {
    let s = createNewSave(T0);
    s = work(s, at(2026, 10, 10, 6, 0), 5 * 60);
    expect(s.points).toBe(300 + VISIT_BONUS);
    s = work(s, at(2026, 10, 10, 12, 0), 3 * 60);
    // 残り1時間は等倍、2時間は半分
    expect(s.points).toBe(300 + VISIT_BONUS + 60 + 60);
    expect(s.totalWorkMs).toBe(8 * HOUR);
  });
  it('日付をまたぐ作業は、日ごとに分けて数える', () => {
    let s = createNewSave(T0);
    s = work(s, at(2026, 10, 10, 13, 0), 6 * 60); // 10日はもう6時間
    const r = computeReward(s, at(2026, 10, 10, 23, 0), at(2026, 10, 11, 1, 0));
    // 10日の1時間は半分、11日の1時間は等倍
    expect(r.base).toBe(30 + 60);
    expect(r.visitBonus).toBe(0);
  });
  it('長い1回より、同じ時間を分けたほうが不利にならない', () => {
    const long = work(createNewSave(T0), T0, 120);
    let split = work(createNewSave(T0), T0, 60);
    split = work(split, T0 + 2 * HOUR, 60);
    expect(split.points).toBe(long.points);
  });
});

describe('離席と長時間放置', () => {
  const s = startSession(createNewSave(T0), 'blend', T0);
  it('動いているあいだは ok', () => {
    const t = touchSession(s, T0 + 3 * HOUR);
    expect(assessActive(t.active!, T0 + 3 * HOUR + MINUTE)).toEqual({ kind: 'ok' });
  });
  it('しばらく止まっていたら確認する', () => {
    const t = touchSession(s, T0 + 30 * MINUTE);
    const st = assessActive(t.active!, T0 + 30 * MINUTE + AWAY_GAP_MS + 1);
    expect(st).toMatchObject({ kind: 'away', lastSeenAt: T0 + 30 * MINUTE, canContinue: true });
  });
  it('何日も放置されていたら続きは選べず、最後に確認できた時刻で終えられる', () => {
    const t = touchSession(s, T0 + 2 * HOUR);
    const now = T0 + 5 * 24 * HOUR;
    const st = assessActive(t.active!, now);
    expect(st).toMatchObject({ kind: 'away', lastSeenAt: T0 + 2 * HOUR, canContinue: false });
    if (st.kind !== 'away') throw new Error();
    const { state } = finishSession(t, st.lastSeenAt, now);
    expect(state.totalWorkMs).toBe(2 * HOUR);
  });
  it('開いたまま上限に達したら自動で終わる', () => {
    const t = touchSession(s, T0 + MAX_SESSION_MS - 1000);
    expect(assessActive(t.active!, T0 + MAX_SESSION_MS + 5)).toEqual({ kind: 'overtime', endAt: T0 + MAX_SESSION_MS });
  });
  it('lastSeenAt が壊れていても開始〜上限の範囲に収める', () => {
    const st = assessActive({ startedAt: T0, menuId: 'blend', lastSeenAt: T0 + 999 * HOUR }, T0 + 1000 * HOUR);
    expect(st).toMatchObject({ kind: 'away', lastSeenAt: T0 + MAX_SESSION_MS, canContinue: false });
    const st2 = assessActive({ startedAt: T0, menuId: 'blend', lastSeenAt: 0 }, T0 + HOUR);
    expect(st2).toMatchObject({ kind: 'away', lastSeenAt: T0 });
  });
  it('時計が巻き戻っても lastSeenAt は開始より前にならない', () => {
    expect(touchSession(s, T0 - HOUR).active!.lastSeenAt).toBe(T0);
  });
});

describe('その他の操作', () => {
  it('作業中はメニューを変えられない / 解放済みだけ選べる', () => {
    const s = { ...createNewSave(T0), points: 50, unlockedMenus: ['blend', 'iced'] };
    expect(selectMenu(s, 'iced').lastMenuId).toBe('iced');
    expect(selectMenu(s, 'pudding').lastMenuId).toBe('blend');
    const a = startSession(s, 'blend', T0);
    expect(selectMenu(a, 'iced')).toBe(a);
  });
  it('見かけた出来事を数える', () => {
    let s = recordSeen(createNewSave(T0), 'cat');
    s = recordSeen(s, 'cat');
    expect(s.seen).toEqual({ cat: 2 });
  });
});
