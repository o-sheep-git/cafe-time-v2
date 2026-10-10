import { useEffect, useRef } from 'react';
import type { Season } from '../game/data';
import { sceneHour } from '../debug';
import { drawScene, type SceneEnv } from '../scene/renderer';

export interface ActiveEvent {
  id: string;
  /** performance.now() の値 */
  startedAt: number;
  durationMs: number;
  seed: number;
}

interface Props {
  decor: ReadonlySet<string>;
  order: string | null;
  orderStartedAt: number;
  /** 目標の雨の強さ 0..1 */
  rain: number;
  season: Season;
  motion: boolean;
  event: ActiveEvent | null;
  /** 画面下の UI が覆う高さ（CSS ピクセル）。0 なら避けない */
  insetBottom: number;
}

const FPS = 12;
/** 動きを減らしているときの描き直しの間隔 */
const STILL_INTERVAL_MS = 15_000;

/** 画面の大きさから、1ドットの大きさと店内の解像度を決める */
export function sceneSize(vw: number, vh: number): { scale: number; W: number; H: number } {
  const scale = Math.max(1, Math.min(Math.round(vh / 200), Math.floor(vw / 176)));
  return { scale, W: Math.ceil(vw / scale), H: Math.ceil(vh / scale) };
}

export function SceneCanvas(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const redrawRef = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: false });
    if (!canvas || !ctx) return;

    let size = { scale: 1, W: 0, H: 0 };
    let rain = propsRef.current.rain;
    let lastFrame = 0;
    let raf = 0;

    const resize = () => {
      size = sceneSize(window.innerWidth, window.innerHeight);
      canvas.width = size.W;
      canvas.height = size.H;
      canvas.style.width = `${size.W * size.scale}px`;
      canvas.style.height = `${size.H * size.scale}px`;
      draw(performance.now());
    };

    const draw = (time: number) => {
      const p = propsRef.current;
      const dt = Math.min(1, Math.max(0, (time - lastFrame) / 1000));
      lastFrame = time;
      // 雨はゆっくり強まり、ゆっくりやむ
      rain += (p.rain - rain) * (p.motion ? Math.min(1, dt * 0.25) : 1);
      if (Math.abs(p.rain - rain) < 0.004) rain = p.rain;

      const now = Date.now();
      const hour = sceneHour(now);
      const ev = p.event;
      const env: SceneEnv = {
        hour,
        minute: (hour % 1) * 60,
        rain,
        season: p.season,
        decor: p.decor,
        order: p.order,
        orderAgeMs: p.order ? Math.max(0, now - p.orderStartedAt) : 0,
        t: time / 1000,
        event: ev ? { id: ev.id, p: (time - ev.startedAt) / ev.durationMs, seed: ev.seed } : null,
        motion: p.motion,
        insetBottom: p.insetBottom > 0 ? Math.round(p.insetBottom / size.scale) : 0,
      };
      ctx.imageSmoothingEnabled = false;
      drawScene(ctx, size.W, size.H, env);
    };
    redrawRef.current = () => draw(performance.now());

    const loop = (time: number) => {
      raf = requestAnimationFrame(loop);
      const interval = propsRef.current.motion ? 1000 / FPS : STILL_INTERVAL_MS;
      if (time - lastFrame >= interval) draw(time);
    };

    resize();
    raf = requestAnimationFrame(loop);
    window.addEventListener('resize', resize);
    const onVisible = () => {
      if (!document.hidden) draw(performance.now());
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // 動きを減らしていても、状態が変わったらすぐ描き直す
  useEffect(() => {
    redrawRef.current();
  }, [props.decor, props.order, props.rain, props.season, props.motion, props.event, props.insetBottom]);

  return <canvas ref={canvasRef} className="scene" role="img" aria-label="カフェの店内。右に窓、手前に自分のテーブル。" />;
}
