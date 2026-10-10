import { MAX_SESSION_MS } from '../game/data';
import { formatDate, formatDuration, formatTimeOfDay } from '../game/time';
import type { ActiveSession } from '../game/types';
import { Dialog } from './Dialog';

interface Props {
  active: ActiveSession;
  lastSeenAt: number;
  now: number;
  canContinue: boolean;
  onContinue: () => void;
  onEndAtLastSeen: () => void;
  onDiscard: () => void;
}

function when(ms: number, now: number): string {
  const sameDay = new Date(ms).toDateString() === new Date(now).toDateString();
  return sameDay ? formatTimeOfDay(ms) : `${formatDate(ms)} ${formatTimeOfDay(ms)}`;
}

/** ページがしばらく止まっていたとき、作業をどう数えるかを本人に聞く */
export function AwayDialog({ active, lastSeenAt, now, canContinue, onContinue, onEndAtLastSeen, onDiscard }: Props) {
  const untilLastSeen = lastSeenAt - active.startedAt;
  const total = Math.min(now - active.startedAt, MAX_SESSION_MS);
  return (
    <Dialog title="おかえりなさい" onClose={() => {}} modal>
      <p>
        {when(active.startedAt, now)} にはじめた作業が、そのままになっていました。
        <br />
        この画面は {when(lastSeenAt, now)} ごろから止まっていたようです。
      </p>
      <div className="dialog-actions stack">
        {canContinue && (
          <button type="button" className="btn primary" onClick={onContinue} autoFocus>
            ずっと作業していた（{formatDuration(total)}・続ける）
          </button>
        )}
        {untilLastSeen >= 60_000 && (
          <button type="button" className={`btn${canContinue ? '' : ' primary'}`} onClick={onEndAtLastSeen} autoFocus={!canContinue}>
            {when(lastSeenAt, now)} までの作業にする（{formatDuration(untilLastSeen)}）
          </button>
        )}
        <button type="button" className="btn ghost" onClick={onDiscard}>
          この作業は記録しない
        </button>
      </div>
      {!canContinue && <p className="hint">長い時間が経っているため、続きからは再開できません。</p>}
    </Dialog>
  );
}
