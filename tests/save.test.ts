import { describe, expect, it } from 'vitest';
import { HOUR, MAX_SESSION_MS, MINUTE } from '../src/game/data';
import {
  BACKUP_KEY, CORRUPT_KEY, SAVE_KEY, createNewSave, exportSave, importSave, loadSave, sanitizeSave, writeSave,
} from '../src/game/save';
import { finishSession, startSession } from '../src/game/session';
import type { SaveData } from '../src/game/types';
import { MemoryStorage, at } from './helpers';

const T0 = at(2026, 10, 10, 9, 0);

function played(): SaveData {
  let s = createNewSave(T0);
  for (let i = 0; i < 5; i++) {
    const start = T0 + i * 2 * HOUR;
    s = finishSession(startSession(s, 'blend', start), start + 50 * MINUTE, start + 50 * MINUTE).state;
  }
  return s;
}

describe('保存と読み込み', () => {
  it('はじめては新しいデータになる', () => {
    const r = loadSave(new MemoryStorage(), T0);
    expect(r.status).toBe('new');
    expect(r.save.history).toEqual([]);
    expect(r.save.unlockedMenus).toEqual(['blend']);
  });
  it('書いたものがそのまま読める', () => {
    const st = new MemoryStorage();
    const s = played();
    expect(writeSave(st, s, T0)).toBe(true);
    const r = loadSave(st, T0 + 20 * HOUR);
    expect(r.status).toBe('ok');
    expect(r.save).toEqual(s);
  });
  it('進行中の作業も保存され、読み込みで復元される', () => {
    const st = new MemoryStorage();
    const s = startSession(played(), 'iced', T0 + 20 * HOUR);
    writeSave(st, s, T0 + 20 * HOUR);
    const r = loadSave(st, T0 + 21 * HOUR);
    expect(r.save.active).toEqual({ startedAt: T0 + 20 * HOUR, menuId: 'iced', lastSeenAt: T0 + 20 * HOUR });
  });
  it('本体が壊れていたらバックアップから戻し、壊れた本体は取っておく', () => {
    const st = new MemoryStorage();
    const s = played();
    writeSave(st, s, T0);
    writeSave(st, { ...s, updatedAt: T0 + HOUR }, T0 + HOUR); // ここでバックアップができる
    expect(st.getItem(BACKUP_KEY)).not.toBeNull();
    st.setItem(SAVE_KEY, '{"version":1,"history":[{"id":');
    const r = loadSave(st, T0 + 2 * HOUR);
    expect(r.status).toBe('recovered');
    expect(r.save.totalWorkMs).toBe(s.totalWorkMs);
    expect(st.getItem(CORRUPT_KEY)).toContain('"history"');
  });
  it('どちらも読めなければ最初からになる', () => {
    const st = new MemoryStorage();
    st.setItem(SAVE_KEY, 'not json');
    st.setItem(BACKUP_KEY, '[1,2,3]');
    const r = loadSave(st, T0);
    expect(r.status).toBe('reset');
    expect(r.save.points).toBe(0);
  });
  it('保存領域が使えなくても遊べる', () => {
    expect(loadSave(null, T0).status).toBe('unavailable');
    const broken = { getItem() { throw new Error('denied'); }, setItem() {}, removeItem() {} };
    expect(loadSave(broken, T0).status).toBe('unavailable');
    const st = new MemoryStorage();
    st.failWrites = true;
    expect(writeSave(st, played(), T0)).toBe(false);
    expect(writeSave(null, played(), T0)).toBe(false);
  });
  it('バックアップは頻繁には取り直さない', () => {
    const st = new MemoryStorage();
    const s = played();
    writeSave(st, { ...s, updatedAt: T0 }, T0);
    writeSave(st, { ...s, updatedAt: T0 + 1000, points: 1 }, T0 + 1000);
    const firstBackup = st.getItem(BACKUP_KEY);
    writeSave(st, { ...s, updatedAt: T0 + 2000, points: 2 }, T0 + 2000);
    expect(st.getItem(BACKUP_KEY)).toBe(firstBackup);
    writeSave(st, { ...s, updatedAt: T0 + HOUR, points: 3 }, T0 + HOUR);
    expect(st.getItem(BACKUP_KEY)).not.toBe(firstBackup);
  });
});

describe('異常な保存データ', () => {
  it('オブジェクトでなければ新しいデータ', () => {
    for (const v of [null, undefined, 1, 'x', [], true]) {
      expect(sanitizeSave(v, T0).history).toEqual([]);
    }
  });
  it('壊れた項目は既定値になる', () => {
    const s = sanitizeSave({
      totalWorkMs: 'many', points: -100, visits: NaN, history: 'x', active: 3, seen: [1], settings: { bgmVolume: 9, weather: 'storm', soundOn: 'yes' },
      unlockedMenus: [1, null, 'iced'], lastMenuId: 'nothing',
    }, T0);
    expect(s.totalWorkMs).toBe(0);
    expect(s.points).toBe(0);
    expect(s.visits).toBe(0);
    expect(s.active).toBeNull();
    expect(s.seen).toEqual({});
    expect(s.settings.bgmVolume).toBe(1);
    expect(s.settings.weather).toBe('auto');
    expect(s.settings.soundOn).toBe(false);
    expect(s.unlockedMenus).toEqual(['blend', 'iced']);
    expect(s.lastMenuId).toBe('blend');
  });
  it('壊れた履歴の行だけ読み飛ばす', () => {
    const good = { id: 'a', start: T0, end: T0 + HOUR, menuId: 'blend', points: 60 };
    const s = sanitizeSave({
      totalWorkMs: 0,
      history: [
        good,
        null,
        { start: T0, end: T0 - 1 },
        { start: 'x', end: T0 },
        { start: T0, end: T0 + MAX_SESSION_MS * 3 },
        { start: T0 + 400 * 24 * HOUR, end: T0 + 400 * 24 * HOUR + HOUR },
        { start: 5, end: 10 },
        { id: 'a', start: T0 - 3 * HOUR, end: T0 - 2 * HOUR, menuId: 42, points: -3 },
      ],
    }, T0 + 2 * HOUR);
    expect(s.history).toHaveLength(2);
    expect(s.history[0].start).toBe(T0 - 3 * HOUR); // 開始順に並ぶ
    expect(s.history[0]).toMatchObject({ menuId: 'blend', points: 0 });
    expect(new Set(s.history.map((h) => h.id)).size).toBe(2);
    // 累計が欠けていたら履歴から数え直す
    expect(s.totalWorkMs).toBe(2 * HOUR);
    expect(s.points).toBe(60);
    expect(s.visits).toBe(2);
    expect(s.visitDays).toBe(1);
  });
  it('累計が履歴の合計より小さいことはない', () => {
    const s = sanitizeSave({ totalWorkMs: 5, points: 3, history: [{ start: T0, end: T0 + HOUR, menuId: 'tea', points: 60 }] }, T0 + HOUR);
    expect(s.totalWorkMs).toBe(HOUR);
    expect(s.points).toBe(3); // なじみは保存値を尊重する
  });
  it('進行中の作業が壊れていたら捨てる / 未来すぎる開始も捨てる', () => {
    expect(sanitizeSave({ active: { startedAt: 'x' } }, T0).active).toBeNull();
    expect(sanitizeSave({ active: { startedAt: T0 + 30 * 24 * HOUR, menuId: 'blend' } }, T0).active).toBeNull();
    const ok = sanitizeSave({ active: { startedAt: T0, menuId: 'blend', lastSeenAt: T0 - 5 } }, T0 + HOUR).active;
    expect(ok).toEqual({ startedAt: T0, menuId: 'blend', lastSeenAt: T0 });
  });
  it('なじみに見合うメニューは必ず解放されている', () => {
    const s = sanitizeSave({ points: 7000, unlockedMenus: [] }, T0);
    expect(s.unlockedMenus).toEqual(['blend', 'iced', 'tea', 'jelly', 'cheesecake', 'pudding']);
  });
  it('__proto__ などの妙なキーを持ち込まない', () => {
    const s = sanitizeSave(JSON.parse('{"seen":{"__proto__":5,"cat":2,"x":"y"}}'), T0);
    expect(s.seen).toEqual({ cat: 2 });
    expect(({} as Record<string, unknown>).cat).toBeUndefined();
  });
});

describe('書き出しと読み込み', () => {
  it('書き出したものを読み込むと同じ内容になる', () => {
    const s = played();
    const r = importSave(exportSave(s, T0 + 20 * HOUR), T0 + 21 * HOUR);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect({ ...r.save, updatedAt: 0 }).toEqual({ ...s, updatedAt: 0 });
  });
  it('進行中の作業は引き継がない', () => {
    const s = startSession(played(), 'blend', T0 + 20 * HOUR);
    const r = importSave(exportSave(s, T0 + 21 * HOUR), T0 + 90 * 24 * HOUR);
    expect(r.ok && r.save.active).toBeNull();
    expect(r.ok && r.save.history.length).toBe(5);
  });
  it('包みのない素のセーブデータも読める', () => {
    const r = importSave(JSON.stringify(played()), T0 + 20 * HOUR);
    expect(r.ok).toBe(true);
  });
  it('関係のないファイルは断る', () => {
    expect(importSave('こんにちは', T0).ok).toBe(false);
    expect(importSave('[]', T0).ok).toBe(false);
    expect(importSave('{"name":"package"}', T0).ok).toBe(false);
    expect(importSave('{"app":"other","save":{"history":[],"points":1}}', T0).ok).toBe(false);
    expect(importSave('{"app":"cafe-time","save":null}', T0).ok).toBe(false);
  });
  it('手で編集された値も安全な範囲に直される', () => {
    const r = importSave('{"app":"cafe-time","save":{"history":[],"points":1e99,"totalWorkMs":-4}}', T0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.save.points).toBe(1e9);
    expect(r.save.totalWorkMs).toBe(0);
  });
});
