import { overlapMs, startOfDay, startOfNextDay, startOfWeek } from './time';
import type { SaveData, SessionRecord } from './types';
import { elapsedMs } from './session';

export interface Stats {
  todayMs: number;
  weekMs: number;
  totalMs: number;
  visits: number;
  visitDays: number;
}

function sumRange(history: readonly SessionRecord[], from: number, to: number): number {
  let sum = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (h.start < from - 24 * 3_600_000) break;
    sum += overlapMs(h.start, h.end, from, to);
  }
  return sum;
}

/** 手帳に出す数字。進行中の作業も含める */
export function computeStats(state: SaveData, now: number): Stats {
  const dayStart = startOfDay(now);
  const dayEnd = startOfNextDay(now);
  const weekStart = startOfWeek(now);
  let todayMs = sumRange(state.history, dayStart, dayEnd);
  let weekMs = sumRange(state.history, weekStart, dayEnd);
  let totalMs = state.totalWorkMs;
  if (state.active) {
    const end = state.active.startedAt + elapsedMs(state.active, now);
    todayMs += overlapMs(state.active.startedAt, end, dayStart, dayEnd);
    weekMs += overlapMs(state.active.startedAt, end, weekStart, dayEnd);
    totalMs += end - state.active.startedAt;
  }
  return { todayMs, weekMs, totalMs, visits: state.visits, visitDays: state.visitDays };
}

export interface HistoryDay {
  day: number;
  totalMs: number;
  sessions: SessionRecord[];
}

/** 新しい順に、開始日でまとめた履歴 */
export function groupHistory(history: readonly SessionRecord[], limit = 200): HistoryDay[] {
  const out: HistoryDay[] = [];
  const from = Math.max(0, history.length - limit);
  for (let i = history.length - 1; i >= from; i--) {
    const h = history[i];
    const day = startOfDay(h.start);
    let last = out[out.length - 1];
    if (!last || last.day !== day) {
      last = { day, totalMs: 0, sessions: [] };
      out.push(last);
    }
    last.totalMs += h.end - h.start;
    last.sessions.push(h);
  }
  return out;
}
