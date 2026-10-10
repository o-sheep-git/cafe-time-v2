import { useEffect, useRef } from 'react';
import { drawSpriteIcon } from '../scene/renderer';
import { SPRITES, type SpriteId } from '../scene/sprites';

interface Props {
  id: SpriteId;
  /** 1ドットを何 CSS ピクセルで見せるか */
  scale?: number;
  /** 枠の大きさ（ドット）。スプライトは中央下寄せ */
  box?: number;
}

/** メニューなどのドット絵を小さく見せる */
export function SpriteIcon({ id, scale = 2, box = 24 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const s = SPRITES[id];
    ctx.clearRect(0, 0, box, box);
    drawSpriteIcon(ctx, id, Math.floor((box - s.w) / 2), Math.max(0, box - s.h - 2), 1);
  }, [id, box]);
  return <canvas ref={ref} className="sprite-icon" width={box} height={box} style={{ width: box * scale, height: box * scale }} aria-hidden="true" />;
}
