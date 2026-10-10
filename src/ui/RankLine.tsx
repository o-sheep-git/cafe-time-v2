import { formatRemaining, rankProgress } from '../game/progress';

interface Props {
  /** いま確定しているなじみ */
  points: number;
  /** 進行中の作業で増える見込み */
  pending?: number;
  onOpen?: () => void;
}

/** 常連度と、次の変化までの目安。数字は出しすぎない */
export function RankLine({ points, pending = 0, onOpen }: Props) {
  const base = rankProgress(points);
  const live = rankProgress(points + pending);
  const crossing = live.rank.level > base.rank.level;
  const fraction = crossing ? 1 : live.fraction;
  let hint: string;
  if (crossing) hint = 'お会計のとき、なにかが変わりそう';
  else if (!live.next) hint = 'すっかり、なじみの店';
  else hint = `次の変化まで ${formatRemaining(live.remaining)}`;

  const body = (
    <>
      <span className="rank-name">{base.rank.name}</span>
      <span className="rank-bar" aria-hidden="true">
        <span style={{ width: `${Math.round(fraction * 100)}%` }} />
      </span>
      <span className="rank-hint">{hint}</span>
    </>
  );
  if (!onOpen) return <div className="rankline">{body}</div>;
  return (
    <button type="button" className="rankline" onClick={onOpen} aria-label={`常連度: ${base.rank.name}。${hint}。くわしく見る`}>
      {body}
    </button>
  );
}
