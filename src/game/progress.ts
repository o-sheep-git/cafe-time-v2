import { MENU, RANKS, type RankDef } from './data';

export function rankForPoints(points: number): RankDef {
  let current = RANKS[0];
  for (const r of RANKS) {
    if (points >= r.points) current = r;
    else break;
  }
  return current;
}

export function nextRank(points: number): RankDef | null {
  return RANKS.find((r) => r.points > points) ?? null;
}

export interface RankProgress {
  rank: RankDef;
  next: RankDef | null;
  /** 次のレベルまでの進み具合 0..1 */
  fraction: number;
  /** 次のレベルまでに必要な残りのなじみ */
  remaining: number;
}

export function rankProgress(points: number): RankProgress {
  const rank = rankForPoints(points);
  const next = nextRank(points);
  if (!next) return { rank, next, fraction: 1, remaining: 0 };
  const span = next.points - rank.points;
  const fraction = span > 0 ? Math.min(1, Math.max(0, (points - rank.points) / span)) : 1;
  return { rank, next, fraction, remaining: Math.max(0, next.points - points) };
}

/** 常連度から決まる、注文できるメニュー */
export function menusForLevel(level: number): string[] {
  const out: string[] = [];
  for (const r of RANKS) {
    if (r.level <= level && r.unlock.type === 'menu') out.push(r.unlock.id);
  }
  return out;
}

/** 常連度から決まる、店内の変化 */
export function decorForLevel(level: number): Set<string> {
  const out = new Set<string>();
  for (const r of RANKS) {
    if (r.level <= level && r.unlock.type === 'decor') out.add(r.unlock.id);
  }
  return out;
}

/** セーブ済みの解放状況と常連度を合わせた、実際に注文できるメニュー（品書きの順） */
export function availableMenus(points: number, saved: readonly string[]): string[] {
  const set = new Set<string>([...menusForLevel(rankForPoints(points).level), ...saved]);
  return MENU.filter((m) => set.has(m.id)).map((m) => m.id);
}

/** メニューが解放される常連度のレベル（なければ null） */
export function levelForMenu(menuId: string): number | null {
  const r = RANKS.find((x) => x.unlock.type === 'menu' && x.unlock.id === menuId);
  return r ? r.level : null;
}

/** 残りのなじみを「あと約◯分」の形に */
export function formatRemaining(remaining: number): string {
  if (remaining <= 0) return '';
  if (remaining < 60) return `約${Math.max(1, Math.round(remaining / 5) * 5)}分`;
  const hours = remaining / 60;
  if (hours < 10) {
    const h = Math.floor(hours);
    const m = Math.round((remaining - h * 60) / 10) * 10;
    if (m === 60) return `約${h + 1}時間`;
    return m === 0 ? `約${h}時間` : `約${h}時間${m}分`;
  }
  return `約${Math.round(hours)}時間`;
}
