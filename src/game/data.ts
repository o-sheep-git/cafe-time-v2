/**
 * ゲームデータ。メニュー・常連度・アンロック条件・出来事はすべてここで編集できる。
 * 既存の id は変えないこと（セーブデータが参照している）。
 */

export const CAFE_NAME = '喫茶 とまり木';

// ---- 作業時間まわりの定数 -------------------------------------------------
export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

/** これより短い作業は記録しない */
export const MIN_SESSION_MS = 1 * MINUTE;
/** 1回の作業として数える上限。これを超えたら自動でお会計になる */
export const MAX_SESSION_MS = 12 * HOUR;
/** ページが止まっていた時間がこれを超えたら「おかえりなさい」と確認する */
export const AWAY_GAP_MS = 15 * MINUTE;
/** その日最初の来店ボーナスがつく最短の作業時間 */
export const VISIT_BONUS_MIN_MS = 5 * MINUTE;
/** その日最初の来店ボーナス（なじみ） */
export const VISIT_BONUS = 20;
/** 1日のうち、これを超えた分のなじみは半分になる（累計作業時間はそのまま） */
export const DAILY_FULL_RATE_MS = 6 * HOUR;
export const OVER_RATE = 0.5;
/** 保存しておく作業履歴の件数 */
export const HISTORY_LIMIT = 3000;

// ---- メニュー ---------------------------------------------------------------
export interface MenuItem {
  id: string;
  name: string;
  note: string;
  hot: boolean;
}

export const MENU: MenuItem[] = [
  { id: 'blend', name: 'ブレンドコーヒー', note: '深煎りの、いつもの一杯。', hot: true },
  { id: 'iced', name: 'アイスコーヒー', note: '氷がゆっくり溶けていく。', hot: false },
  { id: 'tea', name: '紅茶', note: 'ポットでたっぷり。', hot: true },
  { id: 'jelly', name: 'コーヒーゼリー', note: 'ほろ苦くて、少しだけ甘い。', hot: false },
  { id: 'cheesecake', name: 'チーズケーキ', note: 'しっとり焼いた、店の定番。', hot: false },
  { id: 'pudding', name: 'プリン', note: 'かためで、カラメルは濃いめ。', hot: false },
];

export const DEFAULT_MENU_ID = 'blend';

export function menuById(id: string): MenuItem | undefined {
  return MENU.find((m) => m.id === id);
}

export function menuName(id: string): string {
  return menuById(id)?.name ?? 'いつもの';
}

// ---- 常連度 -----------------------------------------------------------------
export type Unlock =
  | { type: 'menu'; id: string }
  | { type: 'decor'; id: DecorId };

export type DecorId =
  | 'flower'
  | 'books'
  | 'picture'
  | 'plant'
  | 'seasonal'
  | 'tablelamp'
  | 'clock'
  | 'record'
  | 'mymug';

export interface RankDef {
  level: number;
  /** 必要な「なじみ」。おおよそ 1分の作業 = 1 */
  points: number;
  name: string;
  unlock: Unlock;
  /** 到達したあと、手帳に残るひとこと */
  note: string;
}

/**
 * 目安（1日2時間・週5日で 週あたり約700）:
 *  Lv2 = 初回の25分 / Lv4 = 3日目 / Lv6 = 2週目 / Lv10 = 2か月 / Lv15 = 7か月ほど
 *  tests/balance.test.ts が利用パターン別の日数を確かめている。
 */
export const RANKS: RankDef[] = [
  { level: 1, points: 0, name: 'はじめてのお客さん', unlock: { type: 'menu', id: 'blend' },
    note: '窓際の席に座った。ブレンドコーヒーを頼んだ。' },
  { level: 2, points: 45, name: 'また来た人', unlock: { type: 'menu', id: 'iced' },
    note: 'アイスコーヒーも頼めるようになった。' },
  { level: 3, points: 150, name: '見覚えのある人', unlock: { type: 'decor', id: 'flower' },
    note: '窓辺に一輪挿しが置かれるようになった。' },
  { level: 4, points: 360, name: 'ときどき来る人', unlock: { type: 'menu', id: 'tea' },
    note: '紅茶をすすめてもらった。' },
  { level: 5, points: 720, name: '顔なじみ', unlock: { type: 'decor', id: 'books' },
    note: '奥の棚に本が並んだ。誰かの置いていったものらしい。' },
  { level: 6, points: 1300, name: 'よく来る人', unlock: { type: 'menu', id: 'jelly' },
    note: 'コーヒーゼリーを出してもらえるようになった。' },
  { level: 7, points: 2100, name: 'いつもの人', unlock: { type: 'decor', id: 'picture' },
    note: '壁に小さな絵が掛かった。' },
  { level: 8, points: 3200, name: '窓際の人', unlock: { type: 'menu', id: 'cheesecake' },
    note: 'チーズケーキが品書きに加わった。' },
  { level: 9, points: 4600, name: 'なじみの客', unlock: { type: 'decor', id: 'plant' },
    note: 'カウンターの脇に鉢植えが増えた。' },
  { level: 10, points: 6300, name: '常連さん', unlock: { type: 'menu', id: 'pudding' },
    note: 'プリンを頼めるようになった。' },
  { level: 11, points: 8500, name: '窓際の常連', unlock: { type: 'decor', id: 'seasonal' },
    note: 'カウンターに季節の飾りが置かれるようになった。' },
  { level: 12, points: 11000, name: '気心の知れた常連', unlock: { type: 'decor', id: 'tablelamp' },
    note: 'いつもの席に小さなランプが置かれた。' },
  { level: 13, points: 14000, name: '古くからの常連', unlock: { type: 'decor', id: 'clock' },
    note: '壁に古い振り子時計が掛かった。ちゃんと動いている。' },
  { level: 14, points: 17500, name: '店になじんだ人', unlock: { type: 'decor', id: 'record' },
    note: 'カウンターにレコードプレーヤーが置かれた。' },
  { level: 15, points: 21500, name: 'とまり木の人', unlock: { type: 'decor', id: 'mymug' },
    note: '自分用のカップを用意してもらった。席には小さな札。' },
];

// ---- 窓辺の出来事 -----------------------------------------------------------
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export interface EventDef {
  id: string;
  name: string;
  caption: string;
  /** 演出の長さ（秒） */
  duration: number;
  /** 動きのある演出か（動きを減らす設定のときは出さない） */
  moving: boolean;
  /** この常連度から起きる */
  minLevel: number;
  when: {
    rain?: boolean;
    /** 時刻の範囲 [from, to)。日をまたぐ場合は from > to */
    hours?: [number, number];
    seasons?: Season[];
  };
  /** 抽選されず、条件が変わったときにだけ記録される出来事 */
  ambient?: boolean;
}

export const EVENTS: EventDef[] = [
  { id: 'cat', name: '通りすがりの猫', caption: '窓の外を、猫が通りすぎていった。', duration: 16, moving: true, minLevel: 1,
    when: { rain: false, hours: [6, 21] } },
  { id: 'bird', name: '窓辺の小鳥', caption: '小鳥が窓辺にとまっている。', duration: 14, moving: false, minLevel: 1,
    when: { rain: false, hours: [5, 17] } },
  { id: 'petals', name: '花びら', caption: '花びらが風に流れていく。', duration: 18, moving: true, minLevel: 1,
    when: { rain: false, hours: [6, 19], seasons: ['spring'] } },
  { id: 'leaves', name: '落ち葉', caption: '落ち葉がひらひらと舞っている。', duration: 18, moving: true, minLevel: 1,
    when: { rain: false, hours: [6, 19], seasons: ['autumn'] } },
  { id: 'snow', name: '風花', caption: '雪がちらついている。', duration: 40, moving: true, minLevel: 1,
    when: { rain: false, seasons: ['winter'] } },
  { id: 'umbrella', name: '雨の日の傘', caption: '傘がひとつ、窓の下を通っていった。', duration: 14, moving: true, minLevel: 1,
    when: { rain: true, hours: [7, 23] } },
  { id: 'star', name: '流れ星', caption: '流れ星が見えた気がする。', duration: 3, moving: true, minLevel: 3,
    when: { rain: false, hours: [20, 5] } },
  { id: 'catsit', name: 'ひと休みする猫', caption: '猫が窓辺でひと休みしている。', duration: 50, moving: false, minLevel: 6,
    when: { rain: false, hours: [9, 20] } },
  { id: 'lights', name: '灯りがともる', caption: '店内の灯りがともった。', duration: 0, moving: false, minLevel: 1, when: {}, ambient: true },
  { id: 'rainstart', name: '降りはじめ', caption: '雨が降りはじめた。', duration: 0, moving: false, minLevel: 1, when: {}, ambient: true },
  { id: 'rainstop', name: '雨あがり', caption: '雨があがったようだ。', duration: 0, moving: false, minLevel: 1, when: {}, ambient: true },
];

/** 作業中、出来事の抽選を行う間隔 */
export const EVENT_ROLL_INTERVAL_MS = 30_000;
/** 1回の抽選で出来事が起きる確率（平均して12〜13分に一度） */
export const EVENT_ROLL_CHANCE = 1 / 25;
/** 作業をはじめてから最初の出来事までの最短時間 */
export const EVENT_WARMUP_MS = 3 * MINUTE;
