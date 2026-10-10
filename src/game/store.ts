import { SAVE_KEY, loadSave, sanitizeSave, writeSave, type LoadStatus, type StorageLike } from './save';
import { touchSession } from './session';
import type { SaveData } from './types';

/** 進行中の作業の「動いている印」を書き込む間隔 */
const HEARTBEAT_WRITE_MS = 15_000;
/** 最後に書き込んだ時刻を入れておくキー。別のタブのほうが新しいかどうかを安く確かめるため */
export const REV_KEY = 'cafe-time:rev';

export function browserStorage(): StorageLike | null {
  try {
    const s = window.localStorage;
    const probe = 'cafe-time:probe';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

/** セーブデータを持ち、変更のたびに保存する。React からは useSyncExternalStore で読む */
export class GameStore {
  private state: SaveData;
  private listeners = new Set<() => void>();
  private lastWrite = 0;
  /** このタブが知っている、保存領域の版 */
  private knownRev = 0;
  readonly loadStatus: LoadStatus;
  /** 直近の保存に失敗したか */
  saveFailed = false;

  constructor(
    private storage: StorageLike | null,
    now: number,
  ) {
    const loaded = loadSave(storage, now);
    this.state = loaded.save;
    this.loadStatus = loaded.status;
    this.knownRev = this.readRev();
  }

  private readRev(): number {
    try {
      const n = Number(this.storage?.getItem(REV_KEY));
      return Number.isFinite(n) ? n : 0;
    } catch {
      return 0;
    }
  }

  /**
   * 別のタブが先に書き込んでいたら、そちらを読み直す。
   * 古い状態のまま上書きして、記録を巻き戻してしまうのを防ぐ。
   */
  private adoptNewer(): boolean {
    if (!this.storage) return false;
    const rev = this.readRev();
    if (rev <= this.knownRev) return false;
    const loaded = loadSave(this.storage, Date.now());
    this.knownRev = rev;
    if (loaded.status !== 'ok') return false;
    this.state = loaded.save;
    return true;
  }

  getState = (): SaveData => this.state;

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  private persist(now: number, forceBackup = false): void {
    this.state = { ...this.state, updatedAt: now };
    this.saveFailed = this.storage != null && !writeSave(this.storage, this.state, now, forceBackup);
    this.lastWrite = now;
    if (this.storage && !this.saveFailed) {
      const rev = Math.max(now, this.knownRev + 1);
      try {
        this.storage.setItem(REV_KEY, String(rev));
        this.knownRev = rev;
      } catch {
        /* 版が書けなくても本体は保存できている */
      }
    }
  }

  update(fn: (s: SaveData) => SaveData, now = Date.now(), forceBackup = false): void {
    const adopted = this.adoptNewer();
    const next = fn(this.state);
    if (next === this.state) {
      if (adopted) this.emit();
      return;
    }
    this.state = next;
    this.persist(now, forceBackup);
    this.emit();
  }

  /** 作業中、ページが動いていることを記録する（画面は更新しない） */
  heartbeat(now: number): void {
    const due = now - this.lastWrite >= HEARTBEAT_WRITE_MS || now < this.lastWrite;
    if (due && this.adoptNewer()) {
      this.lastWrite = now;
      this.emit();
      return;
    }
    const next = touchSession(this.state, now);
    if (next === this.state) return;
    this.state = next;
    if (due) this.persist(now);
  }

  /** タブを隠す・閉じる前に、いまの状態を書き込む */
  flush(now = Date.now()): void {
    if (this.adoptNewer()) {
      this.emit();
      return;
    }
    if (this.state.active) this.state = touchSession(this.state, now);
    this.persist(now);
  }

  /** 別のタブでの変更を取り込む */
  listenToOtherTabs(): () => void {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== SAVE_KEY || !e.newValue) return;
      try {
        this.state = sanitizeSave(JSON.parse(e.newValue), Date.now());
        this.knownRev = Math.max(this.knownRev, this.readRev());
        this.emit();
      } catch {
        /* 読めない値は無視する */
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }
}
