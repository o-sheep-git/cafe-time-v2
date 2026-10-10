/** ローカル時刻にもとづく日付まわりの小さな道具。 */

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** ローカル日付のキー（YYYY-MM-DD） */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function startOfDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** 翌日の 0:00（サマータイムのある地域でも実際の日付境界になる） */
export function startOfNextDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
}

/** 月曜はじまりの週の先頭 */
export function startOfWeek(ms: number): number {
  const d = new Date(ms);
  const offset = (d.getDay() + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset).getTime();
}

export function overlapMs(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

export interface DaySegment {
  day: string;
  dayStart: number;
  dayEnd: number;
  from: number;
  to: number;
  ms: number;
}

/** 区間をローカル日付ごとに分ける（日付をまたぐ作業のため） */
export function splitByLocalDay(start: number, end: number): DaySegment[] {
  const out: DaySegment[] = [];
  if (!(end > start)) return out;
  let cursor = start;
  // 念のための上限（最大でも数十日ぶん）
  for (let i = 0; i < 64 && cursor < end; i++) {
    const dayStart = startOfDay(cursor);
    const dayEnd = startOfNextDay(cursor);
    const to = Math.min(end, dayEnd);
    out.push({ day: dayKey(cursor), dayStart, dayEnd, from: cursor, to, ms: to - cursor });
    cursor = to;
  }
  return out;
}

/** 1:05:09 / 5:09 */
export function formatClock(ms: number, withSeconds = true): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (!withSeconds) return `${h}:${pad2(m)}`;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}

/** 2時間5分 / 45分 / 1分未満 */
export function formatDuration(ms: number): string {
  const totalMin = Math.floor(Math.max(0, ms) / 60_000);
  if (totalMin < 1) return '1分未満';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
}

export function formatTimeOfDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getHours()}:${pad2(d.getMinutes())}`;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export function formatDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}）`;
}

export function formatDateWithYear(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}年${formatDate(ms)}`;
}
