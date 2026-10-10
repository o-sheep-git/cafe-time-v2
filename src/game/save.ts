import { DEFAULT_MENU_ID, HISTORY_LIMIT, MAX_SESSION_MS, MINUTE } from './data';
import { availableMenus } from './progress';
import type { ActiveSession, SaveData, SessionRecord, Settings } from './types';

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'cafe-time:save';
export const BACKUP_KEY = 'cafe-time:save:backup';
export const CORRUPT_KEY = 'cafe-time:save:corrupt';
export const EXPORT_APP_ID = 'cafe-time';

/** これより古い時刻のバックアップがあれば、書き込みのときに取り直す */
const BACKUP_INTERVAL_MS = 10 * MINUTE;

export const DEFAULT_SETTINGS: Settings = {
  soundOn: false,
  bgmOn: true,
  bgmVolume: 0.5,
  cafeVolume: 0.4,
  rainVolume: 0.5,
  weather: 'auto',
  motion: 'auto',
  showSeconds: true,
};

export function createNewSave(now: number): SaveData {
  return {
    version: SAVE_VERSION,
    createdAt: now,
    updatedAt: now,
    totalWorkMs: 0,
    points: 0,
    visits: 0,
    visitDays: 0,
    lastVisitDay: null,
    lastBonusDay: null,
    lastMenuId: DEFAULT_MENU_ID,
    unlockedMenus: [DEFAULT_MENU_ID],
    history: [],
    active: null,
    seen: {},
    settings: { ...DEFAULT_SETTINGS },
  };
}

// ---- 検証 -------------------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function num(v: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function str(v: unknown, fallback: string, maxLen = 64): string {
  return typeof v === 'string' && v.length > 0 && v.length <= maxLen ? v : fallback;
}

function dayStr(v: unknown): string | null {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

/** ずっと未来の時刻を弾くための上限（時計のずれは1日まで許す） */
const FUTURE_SLACK_MS = 24 * 60 * MINUTE;
const EPOCH_2000 = 946_684_800_000;

function sanitizeHistory(v: unknown, now: number): SessionRecord[] {
  if (!Array.isArray(v)) return [];
  const out: SessionRecord[] = [];
  const ids = new Set<string>();
  for (const item of v) {
    if (!isObject(item)) continue;
    const start = num(item.start, NaN);
    const end = num(item.end, NaN);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (start < EPOCH_2000 || end > now + FUTURE_SLACK_MS) continue;
    if (end <= start || end - start > MAX_SESSION_MS + MINUTE) continue;
    let id = str(item.id, Math.floor(start).toString(36));
    while (ids.has(id)) id = `${id}_`;
    ids.add(id);
    out.push({
      id,
      start: Math.floor(start),
      end: Math.floor(end),
      menuId: str(item.menuId, DEFAULT_MENU_ID),
      points: Math.floor(num(item.points, 0, 0, 100_000)),
    });
  }
  out.sort((a, b) => a.start - b.start);
  return out.length > HISTORY_LIMIT ? out.slice(out.length - HISTORY_LIMIT) : out;
}

function sanitizeActive(v: unknown, now: number): ActiveSession | null {
  if (!isObject(v)) return null;
  const startedAt = num(v.startedAt, NaN);
  if (!Number.isFinite(startedAt) || startedAt < EPOCH_2000) return null;
  // 開始が未来すぎるものは壊れているとみなす
  if (startedAt > now + FUTURE_SLACK_MS) return null;
  const lastSeenAt = Math.max(startedAt, num(v.lastSeenAt, startedAt, 0, now + FUTURE_SLACK_MS));
  return { startedAt: Math.floor(startedAt), menuId: str(v.menuId, DEFAULT_MENU_ID), lastSeenAt: Math.floor(lastSeenAt) };
}

function sanitizeSettings(v: unknown): Settings {
  const s = isObject(v) ? v : {};
  const d = DEFAULT_SETTINGS;
  return {
    soundOn: bool(s.soundOn, d.soundOn),
    bgmOn: bool(s.bgmOn, d.bgmOn),
    bgmVolume: num(s.bgmVolume, d.bgmVolume, 0, 1),
    cafeVolume: num(s.cafeVolume, d.cafeVolume, 0, 1),
    rainVolume: num(s.rainVolume, d.rainVolume, 0, 1),
    weather: s.weather === 'clear' || s.weather === 'rain' ? s.weather : 'auto',
    motion: s.motion === 'reduced' ? 'reduced' : 'auto',
    showSeconds: bool(s.showSeconds, d.showSeconds),
  };
}

function sanitizeSeen(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isObject(v)) return out;
  let count = 0;
  for (const [k, n] of Object.entries(v)) {
    if (count++ >= 200) break;
    if (k.length === 0 || k.length > 40 || k === '__proto__') continue;
    const c = Math.floor(num(n, 0, 0, 1_000_000));
    if (c > 0) out[k] = c;
  }
  return out;
}

/**
 * どんな値が来ても、遊べる状態のセーブデータにして返す。
 * 壊れた項目は既定値に、壊れた履歴の行は読み飛ばす。
 */
export function sanitizeSave(raw: unknown, now: number): SaveData {
  if (!isObject(raw)) return createNewSave(now);

  const history = sanitizeHistory(raw.history, now);
  const historyMs = history.reduce((s, h) => s + (h.end - h.start), 0);
  const historyPoints = history.reduce((s, h) => s + h.points, 0);

  // 累計は履歴の合計を下回らない（履歴は件数に上限があるので、上回るのは正常）
  const totalWorkMs = Math.max(historyMs, Math.floor(num(raw.totalWorkMs, historyMs, 0, 1e13)));
  const points = Math.floor(num(raw.points, historyPoints, 0, 1e9));
  const visits = Math.max(history.length, Math.floor(num(raw.visits, history.length, 0, 1e7)));

  const days = new Set<string>();
  for (const h of history) {
    const d = new Date(h.start);
    days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  }
  const visitDays = Math.min(visits, Math.max(days.size, Math.floor(num(raw.visitDays, days.size, 0, 1e6))));

  const savedMenus = Array.isArray(raw.unlockedMenus)
    ? raw.unlockedMenus.filter((m): m is string => typeof m === 'string' && m.length <= 64).slice(0, 100)
    : [];
  const unlockedMenus = availableMenus(points, savedMenus);
  const lastMenu = str(raw.lastMenuId, DEFAULT_MENU_ID);

  return {
    version: SAVE_VERSION,
    createdAt: Math.floor(num(raw.createdAt, now, EPOCH_2000, now + FUTURE_SLACK_MS)),
    updatedAt: Math.floor(num(raw.updatedAt, now, EPOCH_2000, now + FUTURE_SLACK_MS)),
    totalWorkMs,
    points,
    visits,
    visitDays,
    lastVisitDay: dayStr(raw.lastVisitDay),
    lastBonusDay: dayStr(raw.lastBonusDay),
    lastMenuId: unlockedMenus.includes(lastMenu) ? lastMenu : unlockedMenus[0] ?? DEFAULT_MENU_ID,
    unlockedMenus,
    history,
    active: sanitizeActive(raw.active, now),
    seen: sanitizeSeen(raw.seen),
    settings: sanitizeSettings(raw.settings),
  };
}

// ---- 保存と読み込み ---------------------------------------------------------

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type LoadStatus =
  /** はじめての起動 */
  | 'new'
  | 'ok'
  /** 本体が壊れていたのでバックアップから戻した */
  | 'recovered'
  /** 本体もバックアップも読めなかったので最初から */
  | 'reset'
  /** 保存領域が使えない（この場かぎりで遊べる） */
  | 'unavailable';

function parseSaveText(text: string | null): unknown | undefined {
  if (text == null || text === '') return undefined;
  try {
    const v: unknown = JSON.parse(text);
    return isObject(v) ? v : undefined;
  } catch {
    return undefined;
  }
}

export function loadSave(storage: StorageLike | null, now: number): { save: SaveData; status: LoadStatus } {
  if (!storage) return { save: createNewSave(now), status: 'unavailable' };
  let primaryText: string | null;
  let backupText: string | null;
  try {
    primaryText = storage.getItem(SAVE_KEY);
    backupText = storage.getItem(BACKUP_KEY);
  } catch {
    return { save: createNewSave(now), status: 'unavailable' };
  }

  const primary = parseSaveText(primaryText);
  if (primary !== undefined) return { save: sanitizeSave(primary, now), status: 'ok' };

  const backup = parseSaveText(backupText);
  if (primaryText != null && primaryText !== '') {
    // 読めなかった本体は、あとで手作業でも救えるように取っておく
    try {
      storage.setItem(CORRUPT_KEY, primaryText.slice(0, 2_000_000));
    } catch {
      /* 空きがなければあきらめる */
    }
  }
  if (backup !== undefined) return { save: sanitizeSave(backup, now), status: 'recovered' };
  if (primaryText == null && backupText == null) return { save: createNewSave(now), status: 'new' };
  return { save: createNewSave(now), status: 'reset' };
}

/**
 * セーブデータを書き込む。成功したら true。
 * ときどき、書き込む前の正常な本体をバックアップへ回す。
 */
export function writeSave(storage: StorageLike | null, save: SaveData, now: number, forceBackup = false): boolean {
  if (!storage) return false;
  try {
    const text = JSON.stringify(save);
    const prev = storage.getItem(SAVE_KEY);
    const prevParsed = parseSaveText(prev);
    if (prev && prevParsed !== undefined) {
      const backup = parseSaveText(storage.getItem(BACKUP_KEY));
      const backupAt = isObject(backup) ? num(backup.updatedAt, 0) : 0;
      const prevAt = isObject(prevParsed) ? num(prevParsed.updatedAt, 0) : 0;
      if (forceBackup || backup === undefined || now - backupAt > BACKUP_INTERVAL_MS) {
        if (forceBackup || prevAt >= backupAt) {
          try {
            storage.setItem(BACKUP_KEY, prev);
          } catch {
            /* バックアップが取れなくても本体の保存は続ける */
          }
        }
      }
    }
    storage.setItem(SAVE_KEY, text);
    return true;
  } catch {
    return false;
  }
}

// ---- 書き出しと読み込み -----------------------------------------------------

export interface ExportFile {
  app: typeof EXPORT_APP_ID;
  format: 1;
  exportedAt: number;
  save: SaveData;
}

export function exportSave(save: SaveData, now: number): string {
  const file: ExportFile = { app: EXPORT_APP_ID, format: 1, exportedAt: now, save };
  return JSON.stringify(file, null, 2);
}

export type ImportResult = { ok: true; save: SaveData } | { ok: false; error: string };

function looksLikeSave(v: Record<string, unknown>): boolean {
  return Array.isArray(v.history) && ('totalWorkMs' in v || 'points' in v);
}

export function importSave(text: string, now: number): ImportResult {
  if (text.length > 20_000_000) return { ok: false, error: 'ファイルが大きすぎます。' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'ファイルを読み取れませんでした。書き出したセーブデータか確かめてください。' };
  }
  if (!isObject(parsed)) return { ok: false, error: 'セーブデータの形式ではありません。' };

  let body: unknown = parsed;
  if ('save' in parsed) {
    if (parsed.app !== undefined && parsed.app !== EXPORT_APP_ID) {
      return { ok: false, error: 'このゲームのセーブデータではないようです。' };
    }
    body = parsed.save;
  }
  if (!isObject(body) || !looksLikeSave(body)) {
    return { ok: false, error: 'セーブデータの形式ではありません。' };
  }
  const save = sanitizeSave(body, now);
  // 書き出したときに進行中だった作業は引き継がない（長い作業として誤って記録されるのを防ぐ）
  return { ok: true, save: { ...save, active: null, updatedAt: now } };
}

export function exportFileName(now: number): string {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, '0');
  return `cafe-time-save-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.json`;
}
