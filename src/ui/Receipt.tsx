import { RANKS, menuName, CAFE_NAME } from '../game/data';
import { formatDate, formatDuration, formatTimeOfDay } from '../game/time';
import type { Receipt as ReceiptData } from '../game/types';
import { Dialog } from './Dialog';
import { RankLine } from './RankLine';

interface Props {
  receipt: ReceiptData;
  points: number;
  /** これが何回目の作業の記録か */
  visits: number;
  /** 自動で終わった理由（あれば） */
  reason?: string;
  onClose: () => void;
  /** 「やっぱり続ける」ができるときだけ渡す */
  onUndo?: () => void;
}

/** 作業を終えたときのレシート */
export function Receipt({ receipt: r, points, visits, reason, onClose, onUndo }: Props) {
  const reached = RANKS.filter((x) => r.reached.includes(x.level));
  return (
    <Dialog title="お会計" onClose={onClose} className="receipt" modal hideTitle>
      <p className="receipt-shop">{CAFE_NAME}</p>
      {reason && <p className="receipt-reason">{reason}</p>}
      {r.recorded ? (
        <>
          <dl className="receipt-lines">
            <div>
              <dt>{formatDate(r.start)}</dt>
              <dd>
                {formatTimeOfDay(r.start)} – {formatTimeOfDay(r.end)}
              </dd>
            </div>
            <div>
              <dt>ご注文</dt>
              <dd>{menuName(r.menuId)}</dd>
            </div>
            <div className="receipt-main">
              <dt>作業時間</dt>
              <dd>{formatDuration(r.durationMs)}</dd>
            </div>
          </dl>
          {r.visitBonus > 0 && <p className="receipt-note">{visits <= 1 ? 'はじめてのご来店、ありがとうございます。' : '今日も、ようこそ。'}</p>}
          {reached.map((x) => (
            <p key={x.level} className="receipt-change">
              {x.unlock.type === 'menu' ? x.note : '店内のどこかが、少し変わった気がする。'}
            </p>
          ))}
          <RankLine points={points} />
        </>
      ) : (
        <p className="receipt-note">まだ席についたばかりでした。1分に満たない作業は、記録していません。</p>
      )}
      <div className="dialog-actions">
        <button type="button" className="btn primary" onClick={onClose} autoFocus>
          {r.recorded ? 'ごちそうさま' : 'とじる'}
        </button>
        {onUndo && (
          <button type="button" className="btn ghost" onClick={onUndo}>
            やっぱり、もう少し続ける
          </button>
        )}
      </div>
    </Dialog>
  );
}
