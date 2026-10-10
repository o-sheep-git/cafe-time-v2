import type { SpriteId } from './sprites';

/**
 * スプライトを画像に差し替えるための表。
 * 画像は public/sprites/ に置き、ここに「スプライトの id: パス」を書く。
 * 画像の1ピクセルが店内の1ドットになる（拡大はゲーム側で行う）。
 *
 * 例:
 *   'menu.blend': '/sprites/menu-blend.png',
 */
export const SPRITE_OVERRIDES: Partial<Record<SpriteId, string>> = {};

const loaded = new Map<string, HTMLImageElement>();

/** 読み込み済みの差し替え画像を返す（まだなら null。読み込みは裏で始める） */
export function overrideImage(id: SpriteId, onLoad?: () => void): HTMLImageElement | null {
  const src = SPRITE_OVERRIDES[id];
  if (!src || typeof Image === 'undefined') return null;
  let img = loaded.get(src);
  if (!img) {
    img = new Image();
    img.decoding = 'async';
    if (onLoad) img.addEventListener('load', onLoad, { once: true });
    img.src = src;
    loaded.set(src, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}
