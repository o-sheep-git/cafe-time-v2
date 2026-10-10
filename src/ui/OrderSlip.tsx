import { forwardRef } from 'react';
import { MENU, menuById, menuName } from '../game/data';
import { formatClock, formatTimeOfDay } from '../game/time';
import type { ActiveSession } from '../game/types';
import { menuSpriteId } from '../scene/sprites';
import { RankLine } from './RankLine';
import { SpriteIcon } from './SpriteIcon';

interface Props {
  active: ActiveSession | null;
  elapsedMs: number;
  available: string[];
  selected: string;
  points: number;
  pending: number;
  greeting: string;
  showSeconds: boolean;
  mymug: boolean;
  onSelect: (id: string) => void;
  onStart: () => void;
  onEnd: () => void;
  onOpenRank: () => void;
}

/** 画面下の伝票。注文して作業をはじめる／終える */
export const OrderSlip = forwardRef<HTMLElement, Props>(function OrderSlip(p, ref) {
  if (p.active) {
    return (
      <section ref={ref} className="panel slip working" aria-label="作業中">
        <p className="slip-status">
          <span className="dot" aria-hidden="true" />
          作業中
          <span className="slip-menu">{menuName(p.active.menuId)}</span>
        </p>
        <p className="timer" role="timer" aria-label={`経過時間 ${formatClock(p.elapsedMs, false)}`}>
          {formatClock(p.elapsedMs, p.showSeconds)}
        </p>
        <p className="slip-since">{formatTimeOfDay(p.active.startedAt)} から</p>
        <button key="end" type="button" className="btn" onClick={p.onEnd}>
          作業を終える
        </button>
        <RankLine points={p.points} pending={p.pending} onOpen={p.onOpenRank} />
      </section>
    );
  }

  const selected = menuById(p.selected);
  return (
    <section ref={ref} className="panel slip" aria-label="注文">
      <p className="slip-greeting">{p.greeting}</p>
      <div className="menu-row" role="group" aria-label="お品書き">
        {MENU.map((m) => {
          const unlocked = p.available.includes(m.id);
          if (!unlocked) {
            return (
              <span key={m.id} className="menu-chip locked" role="img" aria-label="まだ頼めないメニュー" title="通っているうちに、頼めるようになります">
                ？
              </span>
            );
          }
          const on = m.id === p.selected;
          return (
            <button
              key={m.id}
              type="button"
              className={`menu-chip${on ? ' on' : ''}`}
              aria-pressed={on}
              aria-label={m.name}
              title={m.name}
              onClick={() => p.onSelect(m.id)}
            >
              <SpriteIcon id={menuSpriteId(m.id, p.mymug)} scale={1.5} box={24} />
            </button>
          );
        })}
      </div>
      <p className="menu-name">
        <strong>{selected?.name ?? 'ブレンドコーヒー'}</strong>
        <span>{selected?.note}</span>
      </p>
      <button key="start" type="button" className="btn primary big" onClick={p.onStart}>
        注文して、作業をはじめる
      </button>
      <RankLine points={p.points} onOpen={p.onOpenRank} />
    </section>
  );
});
