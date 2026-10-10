export interface SessionRecord {
  id: string;
  /** epoch ms */
  start: number;
  /** epoch ms */
  end: number;
  menuId: string;
  /** この作業で得た「なじみ」 */
  points: number;
}

export interface ActiveSession {
  startedAt: number;
  menuId: string;
  /** ページが動いていることを最後に確認できた時刻 */
  lastSeenAt: number;
}

export type WeatherSetting = 'auto' | 'clear' | 'rain';
export type MotionSetting = 'auto' | 'reduced';

export interface Settings {
  soundOn: boolean;
  bgmOn: boolean;
  bgmVolume: number;
  cafeVolume: number;
  rainVolume: number;
  weather: WeatherSetting;
  motion: MotionSetting;
  showSeconds: boolean;
}

export interface SaveData {
  version: 1;
  createdAt: number;
  updatedAt: number;
  totalWorkMs: number;
  /** 常連度のもとになる「なじみ」の累計 */
  points: number;
  /** 記録された作業の回数 */
  visits: number;
  /** 作業した日数 */
  visitDays: number;
  lastVisitDay: string | null;
  lastBonusDay: string | null;
  lastMenuId: string;
  unlockedMenus: string[];
  history: SessionRecord[];
  active: ActiveSession | null;
  /** 見かけた出来事の回数 */
  seen: Record<string, number>;
  settings: Settings;
}

export interface Receipt {
  recorded: boolean;
  start: number;
  end: number;
  durationMs: number;
  menuId: string;
  points: number;
  visitBonus: number;
  levelBefore: number;
  levelAfter: number;
  /** この会計で到達した常連度のレベル */
  reached: number[];
}
