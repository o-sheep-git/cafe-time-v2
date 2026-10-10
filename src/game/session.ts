import {
  AWAY_GAP_MS,
  DAILY_FULL_RATE_MS,
  HISTORY_LIMIT,
  MAX_SESSION_MS,
  MIN_SESSION_MS,
  MINUTE,
  OVER_RATE,
  VISIT_BONUS,
  VISIT_BONUS_MIN_MS,
  menuById,
} from './data';
import { availableMenus, rankForPoints } from './progress';
import { dayKey, overlapMs, splitByLocalDay } from './time';
import type { ActiveSession, Receipt, SaveData, SessionRecord, Settings } from './types';

/** 進行中の作業の経過時間。開始時刻と現在時刻だけから求める */
export function elapsedMs(active: ActiveSession, now: number): number {
  const raw = now - active.startedAt;
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(raw, MAX_SESSION_MS);
}

export type ActiveStatus =
  /** ふつうに作業中 */
  | { kind: 'ok' }
  /** 上限に達した。自動でお会計にする */
  | { kind: 'overtime'; endAt: number }
  /** ページがしばらく止まっていた。どう扱うか本人に確認する */
  | { kind: 'away'; lastSeenAt: number; gapMs: number; canContinue: boolean };

export function assessActive(active: ActiveSession, now: number): ActiveStatus {
  const limit = active.startedAt + MAX_SESSION_MS;
  const lastSeenAt = Math.min(Math.max(active.lastSeenAt, active.startedAt), limit);
  const gapMs = now - lastSeenAt;
  if (gapMs > AWAY_GAP_MS) {
    return { kind: 'away', lastSeenAt, gapMs, canContinue: now < limit };
  }
  if (now >= limit) return { kind: 'overtime', endAt: limit };
  return { kind: 'ok' };
}

export function startSession(state: SaveData, menuId: string, now: number): SaveData {
  if (state.active) return state;
  const allowed = availableMenus(state.points, state.unlockedMenus);
  const chosen = allowed.includes(menuId) ? menuId : allowed[0];
  return {
    ...state,
    active: { startedAt: now, menuId: chosen, lastSeenAt: now },
    lastMenuId: chosen,
    updatedAt: now,
  };
}

/** ページが動いていることを記録する */
export function touchSession(state: SaveData, now: number): SaveData {
  if (!state.active) return state;
  // 時計が巻き戻っていたら開始時刻より前にはしない
  const lastSeenAt = Math.max(state.active.startedAt, now);
  if (lastSeenAt === state.active.lastSeenAt) return state;
  return { ...state, active: { ...state.active, lastSeenAt } };
}

export function discardSession(state: SaveData, now: number): SaveData {
  if (!state.active) return state;
  return { ...state, active: null, updatedAt: now };
}

function workedInRange(history: readonly SessionRecord[], from: number, to: number): number {
  let sum = 0;
  // 履歴は開始時刻順。新しいほうから見て、範囲より十分古くなったら打ち切る
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (h.start < from - MAX_SESSION_MS - MINUTE) break;
    sum += overlapMs(h.start, h.end, from, to);
  }
  return sum;
}

export interface Reward {
  /** 作業時間ぶんのなじみ */
  base: number;
  visitBonus: number;
  points: number;
}

/**
 * 作業に対する「なじみ」。
 * 1分 = 1。1日のうち6時間を超えた分は半分。その日最初の5分以上の作業に来店ボーナス。
 */
export function computeReward(state: SaveData, start: number, end: number): Reward {
  let base = 0;
  for (const seg of splitByLocalDay(start, end)) {
    const before = workedInRange(state.history, seg.dayStart, seg.dayEnd);
    const fullLeft = Math.max(0, DAILY_FULL_RATE_MS - before);
    const fullMs = Math.min(seg.ms, fullLeft);
    base += fullMs / MINUTE + ((seg.ms - fullMs) / MINUTE) * OVER_RATE;
  }
  const eligible = end - start >= VISIT_BONUS_MIN_MS && state.lastBonusDay !== dayKey(start);
  const visitBonus = eligible ? VISIT_BONUS : 0;
  const baseInt = Math.floor(base + 1e-9);
  return { base: baseInt, visitBonus, points: baseInt + visitBonus };
}

function newId(start: number, history: readonly SessionRecord[]): string {
  const base = start.toString(36);
  let id = base;
  let n = 1;
  const taken = new Set(history.slice(-50).map((h) => h.id));
  while (taken.has(id)) id = `${base}-${n++}`;
  return id;
}

/**
 * 作業を終えて記録する。endAt は「いつ終わったことにするか」。
 * 1分に満たない作業は記録しない。
 */
export function finishSession(
  state: SaveData,
  endAt: number,
  now: number,
): { state: SaveData; receipt: Receipt | null } {
  const active = state.active;
  if (!active) return { state, receipt: null };

  const start = active.startedAt;
  const end = Math.min(Math.max(endAt, start), start + MAX_SESSION_MS);
  const durationMs = end - start;
  const levelBefore = rankForPoints(state.points).level;

  if (durationMs < MIN_SESSION_MS) {
    return {
      state: { ...state, active: null, updatedAt: now },
      receipt: {
        recorded: false, start, end, durationMs, menuId: active.menuId,
        points: 0, visitBonus: 0, levelBefore, levelAfter: levelBefore, reached: [],
      },
    };
  }

  const reward = computeReward(state, start, end);
  const points = state.points + reward.points;
  const levelAfter = rankForPoints(points).level;
  const reached: number[] = [];
  for (let lv = levelBefore + 1; lv <= levelAfter; lv++) reached.push(lv);

  const record: SessionRecord = {
    id: newId(start, state.history),
    start,
    end,
    menuId: active.menuId,
    points: reward.points,
  };
  let history = [...state.history, record];
  if (history.length > 1 && history[history.length - 2].start > record.start) {
    history.sort((a, b) => a.start - b.start);
  }
  if (history.length > HISTORY_LIMIT) history = history.slice(history.length - HISTORY_LIMIT);

  const day = dayKey(start);
  const next: SaveData = {
    ...state,
    active: null,
    totalWorkMs: state.totalWorkMs + durationMs,
    points,
    visits: state.visits + 1,
    visitDays: state.lastVisitDay === day ? state.visitDays : state.visitDays + 1,
    lastVisitDay: day,
    lastBonusDay: reward.visitBonus > 0 ? day : state.lastBonusDay,
    lastMenuId: menuById(active.menuId) ? active.menuId : state.lastMenuId,
    unlockedMenus: availableMenus(points, state.unlockedMenus),
    history,
    updatedAt: now,
  };

  return {
    state: next,
    receipt: {
      recorded: true, start, end, durationMs, menuId: active.menuId,
      points: reward.points, visitBonus: reward.visitBonus, levelBefore, levelAfter, reached,
    },
  };
}

export function recordSeen(state: SaveData, eventId: string): SaveData {
  return { ...state, seen: { ...state.seen, [eventId]: (state.seen[eventId] ?? 0) + 1 } };
}

export function updateSettings(state: SaveData, patch: Partial<Settings>): SaveData {
  return { ...state, settings: { ...state.settings, ...patch } };
}

export function selectMenu(state: SaveData, menuId: string): SaveData {
  if (state.active) return state;
  if (!availableMenus(state.points, state.unlockedMenus).includes(menuId)) return state;
  return { ...state, lastMenuId: menuId };
}
