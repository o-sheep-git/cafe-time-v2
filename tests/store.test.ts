import { describe, expect, it } from 'vitest';
import { HOUR, MINUTE } from '../src/game/data';
import { SAVE_KEY } from '../src/game/save';
import { finishSession, startSession, updateSettings } from '../src/game/session';
import { GameStore } from '../src/game/store';
import { MemoryStorage, at } from './helpers';

const T0 = at(2026, 10, 10, 9, 0);

describe('ストア', () => {
  it('変更のたびに保存され、開き直すと復元される', () => {
    const st = new MemoryStorage();
    const a = new GameStore(st, T0);
    expect(a.loadStatus).toBe('new');
    a.update((s) => startSession(s, 'blend', T0), T0);
    const b = new GameStore(st, T0 + 5 * MINUTE);
    expect(b.loadStatus).toBe('ok');
    expect(b.getState().active?.startedAt).toBe(T0);
  });

  it('リロードしても進行中の作業の経過は実時間で続く', () => {
    const st = new MemoryStorage();
    new GameStore(st, T0).update((s) => startSession(s, 'blend', T0), T0);
    const b = new GameStore(st, T0 + 40 * MINUTE);
    const { state } = finishSession(b.getState(), T0 + 40 * MINUTE, T0 + 40 * MINUTE);
    expect(state.totalWorkMs).toBe(40 * MINUTE);
  });

  it('heartbeat は間隔をあけて書き込み、購読者には知らせない', () => {
    const st = new MemoryStorage();
    const a = new GameStore(st, T0);
    a.update((s) => startSession(s, 'blend', T0), T0);
    let calls = 0;
    a.subscribe(() => calls++);
    a.heartbeat(T0 + 1000);
    expect(JSON.parse(st.getItem(SAVE_KEY)!).active.lastSeenAt).toBe(T0);
    a.heartbeat(T0 + 20_000);
    expect(JSON.parse(st.getItem(SAVE_KEY)!).active.lastSeenAt).toBe(T0 + 20_000);
    expect(calls).toBe(0);
  });

  it('flush でいまの状態が書き込まれる', () => {
    const st = new MemoryStorage();
    const a = new GameStore(st, T0);
    a.update((s) => startSession(s, 'blend', T0), T0);
    a.flush(T0 + 3000);
    expect(JSON.parse(st.getItem(SAVE_KEY)!).active.lastSeenAt).toBe(T0 + 3000);
  });

  it('古いタブが、新しいタブの記録を巻き戻さない', () => {
    const st = new MemoryStorage();
    const a = new GameStore(st, T0);
    a.update((s) => startSession(s, 'blend', T0), T0);
    const b = new GameStore(st, T0 + MINUTE);
    // b のタブで作業を終える
    b.update((s) => finishSession(s, T0 + HOUR, T0 + HOUR).state, T0 + HOUR);
    expect(b.getState().history).toHaveLength(1);
    // a はまだ作業中のつもりで書き込もうとする
    a.heartbeat(T0 + HOUR + 20_000);
    a.flush(T0 + HOUR + 30_000);
    expect(a.getState().active).toBeNull();
    expect(a.getState().history).toHaveLength(1);
    expect(JSON.parse(st.getItem(SAVE_KEY)!).history).toHaveLength(1);
    // a で設定を変えても、b の記録は残る
    a.update((s) => updateSettings(s, { soundOn: true }), T0 + 2 * HOUR);
    const c = new GameStore(st, T0 + 3 * HOUR);
    expect(c.getState().history).toHaveLength(1);
    expect(c.getState().settings.soundOn).toBe(true);
  });

  it('保存できなくても動き続け、失敗がわかる', () => {
    const st = new MemoryStorage();
    const a = new GameStore(st, T0);
    st.failWrites = true;
    a.update((s) => startSession(s, 'blend', T0), T0);
    expect(a.saveFailed).toBe(true);
    expect(a.getState().active).not.toBeNull();
    const none = new GameStore(null, T0);
    none.update((s) => startSession(s, 'blend', T0), T0);
    expect(none.loadStatus).toBe('unavailable');
    expect(none.saveFailed).toBe(false);
  });
});
