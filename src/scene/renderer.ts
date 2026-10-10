/**
 * 店内の描画。低い解像度のキャンバスに四角を並べて描き、CSS で拡大して見せる。
 * 画面の縦横比に合わせて W×H が変わるので、位置はすべて computeLayout の値から決める。
 */
import { hash01 } from '../game/ambience';
import type { Season } from '../game/data';
import { menuById } from '../game/data';
import { clamp, css, hex, mix, mul, type RGB } from './color';
import { overrideImage } from './overrides';
import { skyAt, type Sky } from './sky';
import { SPRITES, STEAM_AT, menuSpriteId, type SpriteId } from './sprites';

export interface SceneEvent {
  id: string;
  /** 進み具合 0..1 */
  p: number;
  seed: number;
}

export interface SceneEnv {
  /** 0..24 の時刻（小数） */
  hour: number;
  minute: number;
  /** 雨の強さ 0..1（なめらかに変化させた値） */
  rain: number;
  season: Season;
  decor: ReadonlySet<string>;
  /** テーブルに出ている注文（作業していないときは null） */
  order: string | null;
  orderAgeMs: number;
  /** アニメーション用の秒数 */
  t: number;
  event: SceneEvent | null;
  /** 動きのある演出を出すか */
  motion: boolean;
  /** 画面下の UI に隠れる高さ（ドット単位）。狭い画面でテーブルの上のものを避けるため */
  insetBottom: number;
}

export interface Layout {
  W: number;
  H: number;
  tableY: number;
  tableH: number;
  tableX: number;
  floorTop: number;
  wainTop: number;
  win: { x0: number; y0: number; x1: number; y1: number };
  counterX1: number;
  counterY: number;
  shelf: { x0: number; x1: number; y1: number; y2: number | null };
  itemScale: number;
  itemBaseY: number;
}

export function computeLayout(W: number, H: number, insetBottom = 0): Layout {
  const itemScale = H >= 300 ? 2 : 1;
  let tableH = clamp(Math.round(H * 0.27), 48, 120);
  if (insetBottom > 0) tableH = Math.max(tableH, insetBottom + 30 * itemScale);
  tableH = Math.min(tableH, Math.round(H * 0.52));
  const tableY = H - tableH;
  const floorTop = tableY - clamp(Math.round(H * 0.07), 10, 26);
  const wainTop = floorTop - clamp(Math.round(H * 0.2), 34, 64);
  const win = { x0: Math.round(W * 0.47), y0: Math.round(wainTop * 0.13), x1: W - 7, y1: wainTop + 1 };
  const counterX1 = Math.round(W * 0.38);
  const counterY = wainTop - 8;
  const y1 = Math.round(wainTop * 0.4);
  const shelf = {
    x0: 6,
    x1: Math.min(Math.round(W * 0.31), win.x0 - 26),
    y1,
    y2: y1 + 22 <= counterY - 24 ? y1 + 22 : null,
  };
  const visible = tableH - insetBottom;
  const itemBaseY = tableY + Math.round(insetBottom > 0 ? Math.max(18 * itemScale, visible * 0.7) : tableH * 0.5);
  return { W, H, tableY, tableH, tableX: Math.round(W * 0.1), floorTop, wainTop, win, counterX1, counterY, shelf, itemScale, itemBaseY };
}

/** 色に時間帯の係数をかけて塗る筆 */
class Brush {
  private cache = new Map<string, string>();
  constructor(
    readonly ctx: CanvasRenderingContext2D,
    private tint: RGB,
  ) {}

  color(h: string): string {
    let c = this.cache.get(h);
    if (!c) {
      c = css(mul(hex(h), this.tint));
      this.cache.set(h, c);
    }
    return c;
  }

  /** 時間帯の色がかかった四角 */
  r(x: number, y: number, w: number, h: number, colorHex: string): void {
    if (w <= 0 || h <= 0) return;
    this.ctx.fillStyle = this.color(colorHex);
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  /** 色をそのまま使う四角（光や半透明に） */
  raw(x: number, y: number, w: number, h: number, cssColor: string): void {
    if (w <= 0 || h <= 0) return;
    this.ctx.fillStyle = cssColor;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  disc(cx: number, cy: number, radius: number, colorHex: string): void {
    this.rawDisc(cx, cy, radius, this.color(colorHex));
  }

  rawDisc(cx: number, cy: number, radius: number, cssColor: string): void {
    this.ctx.fillStyle = cssColor;
    const r = Math.round(radius);
    for (let dy = -r; dy <= r; dy++) {
      const half = Math.floor(Math.sqrt(r * r - dy * dy + r * 0.8));
      this.ctx.fillRect(Math.round(cx) - half, Math.round(cy) + dy, half * 2 + 1, 1);
    }
  }

  sprite(id: SpriteId, x: number, y: number, scale = 1, flip = false): void {
    const s = SPRITES[id];
    const ox = Math.round(x);
    const oy = Math.round(y);
    const img = overrideImage(id);
    if (img) {
      this.ctx.drawImage(img, ox, oy, img.naturalWidth * scale, img.naturalHeight * scale);
      return;
    }
    for (let row = 0; row < s.h; row++) {
      const line = s.rows[row];
      let col = 0;
      while (col < s.w) {
        const ch = line[col];
        if (ch === '.') {
          col++;
          continue;
        }
        let run = 1;
        while (col + run < s.w && line[col + run] === ch) run++;
        const colorHex = (s.pal as Record<string, string>)[ch];
        if (colorHex) {
          const px = flip ? s.w - col - run : col;
          this.ctx.fillStyle = this.color(colorHex);
          this.ctx.fillRect(ox + px * scale, oy + row * scale, run * scale, scale);
        }
        col += run;
      }
    }
  }
}

const NO_TINT: RGB = [1, 1, 1];

/** UI のアイコン用に、スプライトを色そのままで描く */
export function drawSpriteIcon(ctx: CanvasRenderingContext2D, id: SpriteId, x: number, y: number, scale: number): void {
  new Brush(ctx, NO_TINT).sprite(id, x, y, scale);
}

export function drawScene(ctx: CanvasRenderingContext2D, W: number, H: number, env: SceneEnv): void {
  const L = computeLayout(W, H, env.insetBottom);
  const sky = skyAt(env.hour, env.rain);
  const room = new Brush(ctx, sky.roomTint);
  const out = new Brush(ctx, sky.outTint);

  drawWall(room, L);
  drawOutside(out, L, sky, env);
  drawWindowFrame(room, L, env);
  drawWallThings(room, L, env);
  drawCounter(room, L, env, sky);
  drawFloor(room, L);
  if (env.decor.has('plant')) drawPlant(room, L.counterX1 + 5, L.floorTop + 5);
  drawTable(room, L);
  drawSunlight(room, L, sky, env);
  drawTableItems(room, L, env, sky);
  drawLamps(room, L, sky);
}

// ---- 壁と床 -----------------------------------------------------------------

function drawWall(b: Brush, L: Layout): void {
  const { W, wainTop, floorTop } = L;
  b.r(0, 0, W, wainTop, '#e6d2ac');
  for (let x = 3; x < W; x += 8) b.r(x, 0, 1, wainTop, '#dfc9a0');
  b.r(0, 0, W, 4, '#6e452e');
  b.r(0, 4, W, 1, '#8a5c3a');
  // 腰板
  b.r(0, wainTop, W, floorTop - wainTop, '#9a6a44');
  for (let x = 5; x < W; x += 10) b.r(x, wainTop + 3, 1, floorTop - wainTop - 3, '#8a5c3a');
  b.r(0, wainTop, W, 3, '#7a4e34');
  b.r(0, wainTop, W, 1, '#b07c50');
  b.r(0, floorTop - 3, W, 3, '#5e3b28');
}

function drawFloor(b: Brush, L: Layout): void {
  const { W, H, floorTop } = L;
  b.r(0, floorTop, W, H - floorTop, '#a67c56');
  let row = 0;
  for (let y = floorTop + 6; y < H; y += 7, row++) {
    b.r(0, y, W, 1, '#93693f');
    for (let x = (row * 37) % 50; x < W; x += 50) b.r(x, y - 6, 1, 6, '#93693f');
  }
  b.r(0, floorTop, W, 1, '#7a5636');
}

// ---- 窓の外 -----------------------------------------------------------------

const TREE_COLORS: Record<Season, [string, string] | null> = {
  spring: ['#e9a6b8', '#f4c6d2'],
  summer: ['#5d8a50', '#79a664'],
  autumn: ['#c9702e', '#e09a44'],
  winter: null,
};

const HOUSES = [
  { body: '#d8c4a0', roof: '#a8563c' },
  { body: '#b9c2a8', roof: '#5e6e62' },
  { body: '#e0b79a', roof: '#7a5a4a' },
  { body: '#cfc8bc', roof: '#8a4a3a' },
  { body: '#d6b98c', roof: '#6a5a62' },
];

function drawOutside(b: Brush, L: Layout, sky: Sky, env: SceneEnv): void {
  const ctx = b.ctx;
  const x0 = L.win.x0;
  const y0 = L.win.y0;
  const w = L.win.x1 - L.win.x0;
  const h = L.win.y1 - L.win.y0;
  const t = env.motion ? env.t : 0;
  const night = clamp(1 - sky.light * 2.4, 0, 1);

  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, w, h);
  ctx.clip();

  // 空
  const bands = 12;
  for (let i = 0; i < bands; i++) {
    const by = y0 + Math.floor((i * h) / bands);
    b.raw(x0, by, w, Math.ceil(h / bands) + 1, css(mix(sky.top, sky.bottom, i / (bands - 1))));
  }

  // 星と月
  if (night > 0.3 && env.rain < 0.3) {
    const a = (night - 0.3) / 0.7;
    for (let i = 0; i < 26; i++) {
      const sx = x0 + Math.floor(hash01(i, 1) * w);
      const sy = y0 + Math.floor(hash01(i, 2) * h * 0.55);
      const tw = env.motion ? 0.55 + 0.45 * Math.sin(t * (0.4 + hash01(i, 3)) + i) : 0.8;
      b.raw(sx, sy, 1, 1, `rgba(244,240,216,${(a * tw).toFixed(2)})`);
    }
    const mx = x0 + Math.round(w * 0.6);
    const my = y0 + Math.round(h * 0.27);
    b.rawDisc(mx, my, 4, `rgba(244,236,208,${a.toFixed(2)})`);
    b.rawDisc(mx + 2, my - 2, 3, css(mix(sky.top, sky.bottom, 0.2)));
  }

  // 雲
  const cloudColor = css(mix(mul([250, 247, 240], sky.outTint), sky.bottom, 0.3), 0.85 - env.rain * 0.4);
  for (let i = 0; i < 3; i++) {
    const span = w + 70;
    const cx = x0 - 35 + ((hash01(i, 7) * span + t * (0.9 + i * 0.45)) % span);
    const cy = y0 + Math.round(h * (0.12 + 0.13 * i));
    b.raw(cx, cy, 22, 4, cloudColor);
    b.raw(cx + 4, cy - 3, 12, 3, cloudColor);
    b.raw(cx + 9, cy - 5, 6, 2, cloudColor);
    b.raw(cx - 4, cy + 2, 30, 2, cloudColor);
  }

  if (env.event?.id === 'star') drawShootingStar(b, x0, y0, w, h, env.event.p);

  const gy = y0 + h - 8;

  // 遠くの街並み
  const far = css(mix(sky.bottom, mul([58, 66, 100], sky.outTint), 0.5));
  let fx = x0 - 3;
  for (let i = 0; fx < x0 + w; i++) {
    const bw = 8 + Math.floor(hash01(i, 3) * 9);
    const bh = Math.round(h * (0.3 + hash01(i, 4) * 0.2));
    b.raw(fx, gy - bh, bw, bh, far);
    if (night > 0.4) {
      for (let wy = gy - bh + 3; wy < gy - h * 0.24; wy += 5) {
        for (let wx = fx + 2; wx < fx + bw - 2; wx += 4) {
          if (hash01(i * 31 + wx, wy) < 0.28) b.raw(wx, wy, 2, 2, `rgba(242,200,106,${(night * 0.85).toFixed(2)})`);
        }
      }
    }
    fx += bw + (hash01(i, 5) < 0.3 ? 2 : 0);
  }

  // 通りの向かいの家並み
  const houseW = Math.max(26, Math.ceil(w / Math.max(2, Math.round(w / 40))));
  for (let i = 0, hx = x0; hx < x0 + w; i++, hx += houseW) {
    const def = HOUSES[i % HOUSES.length];
    const hh = Math.round(h * 0.2 + hash01(i, 9) * h * 0.08);
    b.r(hx, gy - hh, houseW, hh, def.body);
    b.r(hx - 1, gy - hh - 3, houseW + 2, 3, def.roof);
    b.r(hx + houseW - 1, gy - hh, 1, hh, def.roof);
    const lit = night > 0.35;
    const cols = Math.max(1, Math.floor((houseW - 8) / 9));
    for (let c = 0; c < cols; c++) {
      const wx = hx + 5 + c * 9;
      for (let wy = gy - hh + 4; wy < gy - 12; wy += 9) {
        if (lit && hash01(i * 17 + c, wy) < 0.62) b.raw(wx, wy, 4, 5, `rgba(246,210,122,${(0.5 + night * 0.5).toFixed(2)})`);
        else b.r(wx, wy, 4, 5, '#62748a');
      }
    }
    if (i % 2 === 0) {
      // 1階が店になっている家
      b.r(hx + 3, gy - 12, houseW - 7, 2, '#b5523a');
      for (let sx = hx + 4; sx < hx + houseW - 5; sx += 4) b.r(sx, gy - 12, 2, 2, '#efe3ca');
      if (lit) b.raw(hx + 4, gy - 9, houseW - 9, 8, `rgba(246,210,122,${(0.35 + night * 0.4).toFixed(2)})`);
      else b.r(hx + 4, gy - 9, houseW - 9, 8, '#7a8794');
    } else {
      b.r(hx + Math.floor(houseW / 2) - 2, gy - 9, 5, 9, '#6e452e');
    }
  }

  // 歩道
  b.r(x0, gy, w, 8, env.rain > 0.3 ? '#8f8a82' : '#b9b2a4');
  b.r(x0, gy, w, 1, '#8e887c');

  // 街路樹
  const tx = x0 + Math.round(w * 0.24);
  b.r(tx - 1, gy - 15, 3, 17, '#5a4030');
  const tree = TREE_COLORS[env.season];
  if (tree) {
    b.disc(tx - 6, gy - 19, 6, tree[0]);
    b.disc(tx + 6, gy - 20, 6, tree[0]);
    b.disc(tx, gy - 25, 9, tree[0]);
    b.disc(tx - 3, gy - 28, 5, tree[1]);
    b.disc(tx + 5, gy - 22, 3, tree[1]);
  } else {
    b.r(tx - 1, gy - 26, 1, 12, '#5a4030');
    b.r(tx - 5, gy - 22, 4, 1, '#5a4030');
    b.r(tx - 6, gy - 26, 1, 4, '#5a4030');
    b.r(tx + 2, gy - 20, 5, 1, '#5a4030');
    b.r(tx + 6, gy - 25, 1, 5, '#5a4030');
    b.r(tx + 1, gy - 30, 1, 6, '#5a4030');
  }

  // 街灯
  const lx = x0 + Math.round(w * 0.7);
  b.r(lx, gy - 27, 1, 29, '#2e2a30');
  b.r(lx - 4, gy - 27, 5, 1, '#2e2a30');
  if (sky.lamp > 0.3) {
    const a = clamp((sky.lamp - 0.3) / 0.4, 0, 1);
    b.rawDisc(lx - 3, gy - 24, 9, `rgba(255,220,150,${(0.1 * a).toFixed(3)})`);
    b.rawDisc(lx - 3, gy - 24, 5, `rgba(255,224,160,${(0.16 * a).toFixed(3)})`);
    b.raw(lx - 5, gy - 26, 4, 3, `rgba(255,244,196,${a.toFixed(2)})`);
    if (env.rain > 0.3) b.raw(lx - 4, gy + 2, 2, 5, `rgba(255,224,160,${(0.3 * a).toFixed(2)})`);
  } else {
    b.r(lx - 5, gy - 26, 4, 3, '#d8d6cc');
  }

  drawOutsideEvent(b, x0, y0, w, h, env, t);

  // 雨
  if (env.rain > 0.02) {
    const count = Math.round(((w * h) / 80) * env.rain);
    ctx.fillStyle = 'rgba(214,228,240,0.5)';
    for (let i = 0; i < count; i++) {
      const speed = 95 + hash01(i, 22) * 60;
      const ry = ((hash01(i, 23) * (h + 8) + t * speed) % (h + 8)) - 8;
      const rx = hash01(i, 21) * (w + 24) - ry * 0.22;
      ctx.fillRect(Math.round(x0 + rx), Math.round(y0 + ry), 1, 3);
    }
    // 窓についた水滴
    ctx.fillStyle = `rgba(230,240,248,${(0.35 * env.rain).toFixed(2)})`;
    for (let i = 0; i < Math.round(w / 7); i++) {
      ctx.fillRect(x0 + Math.floor(hash01(i, 41) * w), y0 + Math.floor(hash01(i, 42) * h), 1, 2);
    }
  }

  // ガラスの映り込み
  if (sky.light > 0.25) {
    const a = (0.07 * sky.light * (1 - env.rain * 0.6)).toFixed(3);
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    for (let yy = 0; yy < h; yy++) {
      const sx = x0 + Math.round(w * 0.2 + (h - yy) * 0.45);
      ctx.fillRect(sx, y0 + yy, 7, 1);
      ctx.fillRect(sx + 12, y0 + yy, 3, 1);
    }
  }

  ctx.restore();
}

function drawShootingStar(b: Brush, x0: number, y0: number, w: number, h: number, p: number): void {
  const sx = x0 + w * (0.8 - 0.45 * p);
  const sy = y0 + h * (0.06 + 0.22 * p);
  const fade = Math.sin(Math.PI * clamp(p, 0, 1));
  for (let i = 0; i < 7; i++) {
    b.raw(sx + i * 2, sy - i, 2, 1, `rgba(255,250,220,${(fade * (1 - i / 7)).toFixed(2)})`);
  }
}

function drawOutsideEvent(b: Brush, x0: number, y0: number, w: number, h: number, env: SceneEnv, t: number): void {
  const ev = env.event;
  if (!ev) return;
  const bottom = y0 + h;
  const p = clamp(ev.p, 0, 1);
  switch (ev.id) {
    case 'cat': {
      const rightward = ev.seed % 2 === 0;
      const x = rightward ? x0 - 18 + (w + 36) * p : x0 + w + 2 - (w + 36) * p;
      const frame = Math.floor(t * 4) % 2 === 0 ? 'event.cat.a' : 'event.cat.b';
      b.sprite(frame, x, bottom - 9, 1, !rightward);
      break;
    }
    case 'catsit': {
      // そっと現れて、しばらくして去る
      const rise = clamp(Math.min(p, 1 - p) * 30, 0, 1);
      const blink = env.motion && Math.floor(t * 0.7) % 6 === 0;
      b.sprite(blink ? 'event.catsit.b' : 'event.catsit.a', x0 + Math.round(w * 0.42), bottom - Math.round(10 * rise), 1);
      break;
    }
    case 'bird': {
      const bx = x0 + Math.round(w * 0.58);
      if (p < 0.08) {
        const k = p / 0.08;
        b.sprite('event.bird.b', bx + (1 - k) * 30, bottom - 6 - (1 - k) * 26, 1);
      } else if (p > 0.92) {
        const k = (p - 0.92) / 0.08;
        b.sprite('event.bird.b', bx - k * 34, bottom - 6 - k * 30, 1, true);
      } else {
        const hop = env.motion && Math.floor(t * 1.5) % 5 === 0;
        b.sprite(hop ? 'event.bird.b' : 'event.bird.a', bx, bottom - 6, 1, Math.floor(p * 6) % 2 === 1);
      }
      break;
    }
    case 'umbrella': {
      const rightward = ev.seed % 2 === 0;
      const x = rightward ? x0 - 16 + (w + 32) * p : x0 + w + 1 - (w + 32) * p;
      const bob = Math.floor(t * 3) % 2;
      b.sprite('event.umbrella', x, bottom - 7 + bob, 1);
      break;
    }
    case 'petals':
    case 'leaves':
    case 'snow': {
      const fade = clamp(Math.min(p, 1 - p) * 6, 0, 1);
      const colors =
        ev.id === 'petals' ? ['#f4c6d2', '#e9a6b8'] : ev.id === 'leaves' ? ['#d98a3a', '#b5523a', '#e0b050'] : ['#ffffff', '#e8eef2'];
      const count = ev.id === 'snow' ? 34 : 12;
      const fall = ev.id === 'snow' ? 14 : 20;
      for (let i = 0; i < count; i++) {
        const py = ((hash01(i, ev.seed + 1) * h + t * (fall + hash01(i, 5) * 8)) % (h + 4)) - 2;
        const drift = Math.sin(t * 0.9 + i * 1.7) * 3 - py * (ev.id === 'snow' ? 0.05 : 0.35);
        const px = ((hash01(i, ev.seed + 2) * (w + 30) + drift + w + 30) % (w + 30)) - 4;
        const c = hex(colors[i % colors.length]);
        b.raw(x0 + px, y0 + py, ev.id === 'snow' ? 1 : 2, 1, css(c, fade * 0.9));
        if (ev.id !== 'snow') b.raw(x0 + px + 1, y0 + py + 1, 1, 1, css(c, fade * 0.9));
      }
      break;
    }
  }
}

// ---- 窓枠 -------------------------------------------------------------------

function drawWindowFrame(b: Brush, L: Layout, env: SceneEnv): void {
  const { x0, y0, x1, y1 } = L.win;
  const w = x1 - x0;
  const h = y1 - y0;
  const dark = '#5e3b28';
  const mid = '#7a4e34';

  // カフェカーテン
  const ch = Math.min(11, Math.round(h * 0.14));
  b.r(x0, y0, w, ch, '#ead9b8');
  for (let x = x0 + 2; x < x1; x += 5) b.r(x, y0, 1, ch, '#d9c5a0');
  for (let x = x0; x < x1; x++) {
    const k = (x - x0) % 8;
    const drop = k < 2 ? 0 : k < 4 ? 1 : k < 6 ? 2 : 1;
    b.r(x, y0 + ch, 1, drop, '#ead9b8');
  }
  b.r(x0, y0, w, 1, '#b8963c');

  // 枠と桟
  b.r(x0 - 3, y0 - 3, w + 6, 3, dark);
  b.r(x0 - 3, y0 - 3, 3, h + 4, dark);
  b.r(x1, y0 - 3, 3, h + 4, dark);
  b.r(x0 - 1, y0 - 1, w + 2, 1, mid);
  b.r(x0 - 1, y0, 1, h, mid);
  const panes = Math.max(2, Math.round(w / 46));
  for (let i = 1; i < panes; i++) b.r(x0 + Math.round((w * i) / panes) - 1, y0, 2, h, dark);
  b.r(x0, y0 + Math.round(h * 0.34), w, 2, dark);

  // 窓台
  b.r(x0 - 5, y1, w + 10, 4, '#8a5c3a');
  b.r(x0 - 5, y1, w + 10, 1, '#b07c50');
  b.r(x0 - 4, y1 + 4, w + 8, 1, '#6e452e');

  if (env.decor.has('flower')) drawFlower(b, x1 - Math.max(12, Math.round(w * 0.12)), y1, env.season);
}

const FLOWERS: Record<Season, [string, string]> = {
  spring: ['#e58aa2', '#f4c6d2'],
  summer: ['#e8b83a', '#8a5a2a'],
  autumn: ['#c9608a', '#f0d27a'],
  winter: ['#c0392b', '#f0d27a'],
};

function drawFlower(b: Brush, x: number, base: number, season: Season): void {
  const [petal, center] = FLOWERS[season];
  b.r(x, base - 7, 5, 7, '#8fb0bc');
  b.r(x, base - 7, 1, 7, '#b4d2dc');
  b.r(x + 1, base - 8, 3, 1, '#b4d2dc');
  b.r(x + 2, base - 15, 1, 8, '#5d7a52');
  b.r(x + 3, base - 11, 2, 1, '#5d7a52');
  b.r(x + 1, base - 19, 3, 4, petal);
  b.r(x, base - 18, 5, 2, petal);
  b.r(x + 2, base - 18, 1, 2, center);
}

// ---- 壁のもの ---------------------------------------------------------------

const BOOK_COLORS = ['#8e3c2a', '#5d7a52', '#46607a', '#b8963c', '#6a4a62', '#c9a878', '#4a6a64', '#a8563c'];

function drawShelfBoard(b: Brush, x0: number, x1: number, y: number): void {
  b.r(x0, y, x1 - x0, 2, '#7a4e34');
  b.r(x0, y, x1 - x0, 1, '#96663f');
  b.r(x0 + 1, y + 2, x1 - x0 - 2, 1, '#cdb78e');
  b.r(x0 + 4, y + 2, 1, 4, '#5e3b28');
  b.r(x1 - 5, y + 2, 1, 4, '#5e3b28');
}

type ShelfItem = 'jar' | 'cups' | 'bottle' | 'tin' | 'pot' | 'gap';

function drawShelfItem(b: Brush, kind: ShelfItem, x: number, base: number): number {
  switch (kind) {
    case 'jar':
      b.r(x, base - 9, 6, 9, '#cfe0dc');
      b.r(x + 1, base - 6, 4, 5, '#5a3a28');
      b.r(x, base - 10, 6, 2, '#8c5a3a');
      return 6;
    case 'cups':
      b.r(x, base - 4, 6, 4, '#f1e6d0');
      b.r(x, base - 8, 6, 3, '#e2d4b8');
      b.r(x + 6, base - 3, 1, 2, '#f1e6d0');
      b.r(x + 6, base - 7, 1, 2, '#e2d4b8');
      return 7;
    case 'bottle':
      b.r(x, base - 11, 4, 11, '#5d7a52');
      b.r(x + 1, base - 14, 2, 3, '#4a6a44');
      b.r(x, base - 7, 4, 3, '#e8dcc4');
      return 4;
    case 'tin':
      b.r(x, base - 7, 7, 7, '#b5523a');
      b.r(x, base - 8, 7, 1, '#8e3c2a');
      b.r(x + 1, base - 5, 5, 3, '#ead9b8');
      return 7;
    case 'pot':
      b.r(x + 1, base - 4, 5, 4, '#b0683c');
      b.r(x, base - 8, 7, 4, '#5d7a52');
      b.r(x + 2, base - 10, 3, 2, '#6f9a5a');
      return 7;
    case 'gap':
      return 5;
  }
}

function drawShelfRow(b: Brush, x0: number, x1: number, base: number, items: ShelfItem[], seed: number): void {
  let x = x0;
  for (let i = 0; x < x1 - 8; i++) {
    const kind = items[i % items.length];
    x += drawShelfItem(b, kind, x, base) + 2 + Math.floor(hash01(i, seed) * 4);
  }
}

function drawBooks(b: Brush, x0: number, x1: number, base: number): number {
  let x = x0;
  for (let i = 0; x < x1 - 3; i++) {
    const w = 2 + Math.floor(hash01(i, 61) * 2);
    const h = 8 + Math.floor(hash01(i, 62) * 5);
    const c = BOOK_COLORS[Math.floor(hash01(i, 63) * BOOK_COLORS.length)];
    b.r(x, base - h, w, h, c);
    if (w > 2) b.r(x + 1, base - h + 2, 1, 2, '#ead9b8');
    x += w + (hash01(i, 64) < 0.15 ? 2 : 0);
  }
  return x;
}

function drawWallThings(b: Brush, L: Layout, env: SceneEnv): void {
  const { shelf } = L;
  if (shelf.x1 - shelf.x0 >= 28) {
    drawShelfBoard(b, shelf.x0, shelf.x1, shelf.y1);
    const inner0 = shelf.x0 + 3;
    const inner1 = shelf.x1 - 3;
    if (env.decor.has('books')) {
      const end = drawBooks(b, inner0, inner0 + Math.round((inner1 - inner0) * 0.55), shelf.y1);
      drawShelfRow(b, end + 4, inner1, shelf.y1, ['jar', 'pot', 'tin'], 71);
    } else {
      drawShelfRow(b, inner0 + 2, inner1, shelf.y1, ['jar', 'gap', 'gap', 'bottle', 'gap', 'tin', 'gap'], 72);
    }
    if (shelf.y2 != null) {
      drawShelfBoard(b, shelf.x0, shelf.x1, shelf.y2);
      drawShelfRow(b, inner0, inner1, shelf.y2, ['cups', 'cups', 'jar', 'tin', 'bottle', 'jar', 'cups'], 73);
    }
  }

  // 棚と窓のあいだの壁
  const cx = Math.round((Math.max(shelf.x1, shelf.x0 + 28) + L.win.x0 - 3) / 2);
  if (env.decor.has('clock')) drawClock(b, cx, Math.round(L.wainTop * 0.1) + 6, env);
  if (env.decor.has('picture')) drawPicture(b, cx, Math.round(L.wainTop * 0.52));
}

function drawClock(b: Brush, cx: number, y: number, env: SceneEnv): void {
  b.r(cx - 6, y, 12, 23, '#6e452e');
  b.r(cx - 7, y - 1, 14, 2, '#5e3b28');
  b.r(cx - 5, y + 1, 10, 1, '#8a5c3a');
  b.disc(cx, y + 7, 4, '#f1e4c6');
  const hourAngle = ((env.hour % 12) / 12) * Math.PI * 2;
  const minAngle = (env.minute / 60) * Math.PI * 2;
  for (let i = 1; i <= 3; i++) b.r(cx + Math.round(Math.sin(minAngle) * i), y + 7 - Math.round(Math.cos(minAngle) * i), 1, 1, '#3b302c');
  for (let i = 1; i <= 2; i++) b.r(cx + Math.round(Math.sin(hourAngle) * i), y + 7 - Math.round(Math.cos(hourAngle) * i), 1, 1, '#8e3c2a');
  b.r(cx, y + 7, 1, 1, '#3b302c');
  b.r(cx - 3, y + 13, 6, 8, '#4a2c1c');
  const swing = env.motion ? Math.round(Math.sin(env.t * 2.2) * 1.6) : 0;
  b.r(cx, y + 13, 1, 5, '#b8963c');
  b.r(cx - 1 + swing, y + 17, 2, 2, '#d8b45a');
}

function drawPicture(b: Brush, cx: number, y: number): void {
  b.r(cx - 8, y, 16, 13, '#7a4e34');
  b.r(cx - 8, y, 16, 1, '#96663f');
  b.r(cx - 6, y + 2, 12, 9, '#c4dce2');
  b.r(cx + 2, y + 3, 2, 2, '#f0b060');
  b.r(cx - 6, y + 8, 12, 3, '#7f9a6a');
  b.r(cx - 3, y + 6, 6, 2, '#7f9a6a');
  b.r(cx - 5, y + 9, 3, 2, '#5d7a52');
}

// ---- カウンター -------------------------------------------------------------

function drawCounter(b: Brush, L: Layout, env: SceneEnv, sky: Sky): void {
  const { counterX1: x1, counterY: top, floorTop } = L;
  b.r(0, top + 3, x1, floorTop - top - 3, '#6f4630');
  for (let x = 8; x < x1 - 4; x += 16) {
    b.r(x, top + 7, 11, floorTop - top - 12, '#7d5038');
    b.r(x, top + 7, 11, 1, '#8a5c3a');
  }
  b.r(x1 - 1, top + 3, 1, floorTop - top - 3, '#553424');
  b.r(0, top, x1 + 2, 3, '#c49a6a');
  b.r(0, top, x1 + 2, 1, '#d8b080');
  b.r(0, top + 3, x1 + 1, 1, '#553424');

  const wide = x1 >= 110;
  const mx = Math.max(4, Math.round(x1 * 0.1));
  drawMachine(b, mx, top);
  if (wide) drawCakeDome(b, Math.round(x1 * 0.62), top);
  if (env.decor.has('record')) drawRecord(b, wide ? Math.round(x1 * 0.38) : Math.min(x1 - 22, mx + 26), top, env);
  if (env.decor.has('seasonal')) drawSeasonal(b, x1 - 14, top, env.season, sky);
}

function drawMachine(b: Brush, x: number, top: number): void {
  b.r(x, top - 18, 22, 18, '#a9a6a0');
  b.r(x - 1, top - 19, 24, 2, '#c8c5be');
  b.r(x + 2, top - 14, 18, 6, '#4a4a4e');
  b.r(x + 5, top - 8, 3, 3, '#3a3a3e');
  b.r(x + 14, top - 8, 3, 3, '#3a3a3e');
  b.r(x, top - 2, 22, 2, '#6a6a6e');
  b.r(x + 18, top - 17, 1, 1, '#d9523c');
  b.r(x + 4, top - 12, 4, 1, '#8e8e88');
  for (let i = 0; i < 3; i++) b.r(x + 3 + i * 6, top - 22, 4, 3, i === 1 ? '#e2d4b8' : '#f1e6d0');
}

function drawCakeDome(b: Brush, x: number, top: number): void {
  b.r(x + 4, top - 7, 8, 5, '#f4dc9c');
  b.r(x + 4, top - 8, 8, 1, '#c98a3c');
  b.r(x, top - 2, 16, 2, '#e6dcc8');
  b.r(x + 2, top - 12, 12, 1, '#e4ecea');
  b.r(x + 1, top - 11, 1, 9, '#e4ecea');
  b.r(x + 14, top - 11, 1, 9, '#e4ecea');
  b.r(x + 7, top - 14, 2, 2, '#e4ecea');
  b.r(x + 3, top - 10, 1, 4, '#ffffff');
}

function drawRecord(b: Brush, x: number, top: number, env: SceneEnv): void {
  b.r(x, top - 5, 20, 5, '#6e452e');
  b.r(x, top - 5, 20, 1, '#8a5c3a');
  b.r(x + 2, top - 8, 13, 3, '#2a2424');
  b.r(x + 4, top - 9, 9, 1, '#2a2424');
  b.r(x + 7, top - 8, 3, 1, '#b5523a');
  const spin = env.motion ? Math.floor(env.t * 2) % 4 : 0;
  b.r(x + 4 + spin * 2, top - 7, 2, 1, '#4a4444');
  b.r(x + 17, top - 11, 1, 5, '#c8c5be');
  b.r(x + 13, top - 8, 5, 1, '#c8c5be');
}

function drawSeasonal(b: Brush, x: number, top: number, season: Season, sky: Sky): void {
  switch (season) {
    case 'spring':
      b.r(x + 3, top - 7, 5, 7, '#e8dcc4');
      b.r(x + 5, top - 13, 1, 6, '#6e452e');
      b.r(x + 6, top - 15, 1, 3, '#6e452e');
      b.r(x + 3, top - 16, 1, 4, '#6e452e');
      for (const [dx, dy] of [[2, -17], [4, -14], [7, -16], [6, -12], [8, -14], [1, -14]]) b.r(x + dx, top + dy, 2, 2, '#f4c6d2');
      break;
    case 'summer':
      b.r(x + 3, top - 7, 5, 7, '#8fb0bc');
      b.r(x + 5, top - 13, 1, 6, '#5d7a52');
      b.disc(x + 5, top - 15, 3, '#e8b83a');
      b.r(x + 4, top - 16, 3, 3, '#8a5a2a');
      break;
    case 'autumn':
      b.r(x, top - 7, 11, 7, '#d98a3a');
      b.r(x + 1, top - 8, 9, 1, '#d98a3a');
      b.r(x + 3, top - 7, 1, 7, '#c06a2c');
      b.r(x + 7, top - 7, 1, 7, '#c06a2c');
      b.r(x + 5, top - 10, 2, 2, '#5d7a52');
      break;
    case 'winter': {
      b.r(x + 4, top - 3, 3, 3, '#8c5a3a');
      b.r(x + 1, top - 7, 9, 4, '#4a6a44');
      b.r(x + 2, top - 11, 7, 4, '#5d7a52');
      b.r(x + 4, top - 14, 3, 3, '#5d7a52');
      b.r(x + 5, top - 16, 1, 2, '#f0d27a');
      const glow = sky.lamp > 0.3 ? '#ffe2a0' : '#e8b83a';
      b.r(x + 3, top - 9, 1, 1, '#c0392b');
      b.r(x + 7, top - 6, 1, 1, glow);
      b.r(x + 6, top - 12, 1, 1, '#c0392b');
      b.r(x + 2, top - 5, 1, 1, glow);
      break;
    }
  }
}

function drawPlant(b: Brush, x: number, floorY: number): void {
  b.r(x + 5, floorY - 32, 1, 23, '#4a6a44');
  b.disc(x + 5, floorY - 34, 5, '#5d7a52');
  b.disc(x, floorY - 26, 4, '#6f9a5a');
  b.disc(x + 11, floorY - 28, 4, '#4a6a44');
  b.disc(x + 3, floorY - 19, 4, '#5d7a52');
  b.disc(x + 9, floorY - 17, 3, '#6f9a5a');
  b.disc(x + 6, floorY - 37, 2, '#79a664');
  b.r(x, floorY - 9, 11, 9, '#b0683c');
  b.r(x - 1, floorY - 10, 13, 2, '#c47a4a');
  b.r(x + 9, floorY - 8, 2, 8, '#96563a');
}

// ---- テーブル ---------------------------------------------------------------

function drawTable(b: Brush, L: Layout): void {
  const { W, H, tableY, tableX: x0 } = L;
  // 床に落ちる影
  b.raw(x0 - 5, tableY + 6, 5, H - tableY, 'rgba(50,30,18,0.22)');
  b.r(x0, tableY, W - x0, H - tableY, '#b98558');
  // 角を丸く
  b.r(x0, tableY, 4, 1, '#a67c56');
  b.r(x0, tableY + 1, 2, 1, '#a67c56');
  b.r(x0, tableY + 2, 1, 2, '#a67c56');
  b.r(x0 + 4, tableY, W - x0 - 4, 1, '#d6a878');
  b.r(x0 + 2, tableY + 1, W - x0 - 2, 1, '#c79666');
  b.r(x0, tableY + 4, 2, H - tableY, '#96663f');
  let i = 0;
  for (let y = tableY + 7; y < H; y += 8, i++) {
    const sx = x0 + 6 + Math.floor(hash01(i, 81) * 40);
    const len = 30 + Math.floor(hash01(i, 82) * 70);
    b.r(sx, y, len, 1, '#ad7a4e');
    b.r(sx + len + 18, y + 3, Math.floor(len * 0.7), 1, '#ad7a4e');
    b.r(sx + len * 2 + 40, y + 1, len, 1, '#ad7a4e');
  }
}

function drawSunlight(b: Brush, L: Layout, sky: Sky, env: SceneEnv): void {
  if (sky.light < 0.5 || env.rain > 0.5) return;
  const morning = env.hour < 11 ? 1 : 0.75;
  const strength = (sky.light - 0.5) * 2 * (1 - env.rain * 2) * morning * 0.13;
  if (strength <= 0.005) return;
  const color = `rgba(255,236,186,${strength.toFixed(3)})`;
  const { win, floorTop, H, W } = L;
  const paneW = Math.max(14, Math.round((win.x1 - win.x0) / 2) - 8);
  for (let y = floorTop; y < H; y++) {
    const off = Math.round((y - floorTop) * 0.75);
    const sx = win.x0 + 10 - off;
    b.raw(sx, y, paneW, 1, color);
    b.raw(sx + paneW + 5, y, Math.min(paneW, W - (sx + paneW + 5)), 1, color);
  }
}

function drawTableItems(b: Brush, L: Layout, env: SceneEnv, sky: Sky): void {
  const sc = L.itemScale;
  const baseY = L.itemBaseY;
  const shadow = 'rgba(50,30,18,0.2)';
  const place = (id: SpriteId, cx: number, by: number): [number, number] => {
    const s = SPRITES[id];
    const x = Math.round(cx - (s.w * sc) / 2);
    const y = by - s.h * sc;
    b.raw(x + sc, by - sc, s.w * sc, sc * 2, shadow);
    b.sprite(id, x, y, sc);
    return [x, y];
  };

  const cx = clamp(Math.round(L.W * 0.56), L.tableX + 20 * sc, L.W - 44 * sc);

  if (env.decor.has('tablelamp')) drawTableLamp(b, Math.max(L.tableX + 12 * sc, cx - 46 * sc), baseY - 6 * sc, sc, sky);

  place('table.water', Math.min(L.W - 10 * sc, cx + 30 * sc), baseY - 5 * sc);

  if (env.order) {
    const id = menuSpriteId(env.order, env.decor.has('mymug'));
    const [x, y] = place(id, cx, baseY);
    const steamAt = STEAM_AT[id];
    if (steamAt && menuById(env.order)?.hot && env.orderAgeMs < 45 * 60_000) {
      const strength = 1 - (env.orderAgeMs / (45 * 60_000)) * 0.7;
      for (let k = 0; k < 3; k++) {
        const phase = env.motion ? (env.t * 0.3 + k / 3) % 1 : (k + 1) / 4;
        const sx = x + (steamAt[0] + Math.sin(phase * 6 + k * 2.1) * 2 + (k - 1) * 2) * sc;
        const sy = y + (steamAt[1] - 1 - phase * 11) * sc;
        b.raw(sx, sy, sc, sc * 2, `rgba(255,255,255,${((1 - phase) * 0.34 * strength).toFixed(3)})`);
      }
    }
  } else {
    place('table.menucard', cx, baseY);
  }

  if (env.decor.has('mymug')) place('table.reserved', Math.min(L.W - 12 * sc, cx + 54 * sc), baseY + 5 * sc);
}

function drawTableLamp(b: Brush, x: number, base: number, sc: number, sky: Sky): void {
  const lit = sky.lamp > 0.2;
  b.raw(x - 4 * sc, base - sc, 9 * sc, sc * 2, 'rgba(50,30,18,0.2)');
  b.r(x - 3 * sc, base - 2 * sc, 7 * sc, 2 * sc, '#6e452e');
  b.r(x, base - 10 * sc, sc, 8 * sc, '#b8963c');
  const shade = lit ? '#ffe2a0' : '#e2c088';
  b.r(x - 2 * sc, base - 16 * sc, 5 * sc, 2 * sc, shade);
  b.r(x - 3 * sc, base - 14 * sc, 7 * sc, 2 * sc, shade);
  b.r(x - 4 * sc, base - 12 * sc, 9 * sc, 2 * sc, shade);
  if (lit) {
    const a = clamp((sky.lamp - 0.2) / 0.5, 0, 1);
    b.rawDisc(x, base - 11 * sc, 16 * sc, `rgba(255,206,130,${(0.06 * a).toFixed(3)})`);
    b.rawDisc(x, base - 11 * sc, 9 * sc, `rgba(255,214,140,${(0.09 * a).toFixed(3)})`);
    b.raw(x - 4 * sc, base - 12 * sc, 9 * sc, 2 * sc, `rgba(255,244,200,${(0.6 * a).toFixed(2)})`);
  }
}

// ---- 灯り -------------------------------------------------------------------

function drawLamps(b: Brush, L: Layout, sky: Sky): void {
  const xs = L.W >= 230 ? [Math.round(L.W * 0.1), Math.round(L.W * 0.26)] : [Math.round(L.W * 0.18)];
  const ly = Math.max(12, Math.round(L.wainTop * 0.17));
  for (const x of xs) {
    b.r(x, 4, 1, ly - 4, '#3b302c');
    b.r(x - 2, ly, 5, 1, '#8a5c3a');
    b.r(x - 3, ly + 1, 7, 2, '#b0683c');
    b.r(x - 4, ly + 3, 9, 2, '#c47a4a');
    b.r(x - 5, ly + 5, 11, 1, '#96563a');
    if (sky.lamp > 0.05) {
      const a = sky.lamp;
      b.raw(x - 2, ly + 6, 5, 2, `rgba(255,244,200,${a.toFixed(2)})`);
      for (const [radius, alpha] of [[34, 0.035], [25, 0.045], [16, 0.06], [8, 0.09]] as const) {
        b.rawDisc(x, ly + 9, radius, `rgba(255,198,120,${(alpha * a).toFixed(3)})`);
      }
    } else {
      b.r(x - 2, ly + 6, 5, 2, '#e8dcc4');
    }
  }
}
