import { memo, useMemo, useState } from 'react';
import { EVENTS, RANKS, menuName } from '../game/data';
import { rankForPoints } from '../game/progress';
import { computeStats, groupHistory } from '../game/stats';
import { formatDateWithYear, formatDuration, formatTimeOfDay } from '../game/time';
import type { SaveData } from '../game/types';
import { menuSpriteId } from '../scene/sprites';
import { Dialog } from './Dialog';
import { RankLine } from './RankLine';
import { SpriteIcon } from './SpriteIcon';

export type NotebookTab = 'log' | 'rank' | 'window';

interface Props {
  state: SaveData;
  /** 分単位に丸めた現在時刻（毎秒の描き直しを避ける） */
  nowMinute: number;
  initialTab: NotebookTab;
  onClose: () => void;
}

const TABS: { id: NotebookTab; label: string }[] = [
  { id: 'log', label: 'きろく' },
  { id: 'rank', label: '常連' },
  { id: 'window', label: '窓辺' },
];

const HISTORY_SHOWN = 200;

/** 手帳。作業の記録、常連度、窓辺で見かけたもの */
export const Notebook = memo(function Notebook({ state, nowMinute, initialTab, onClose }: Props) {
  const [tab, setTab] = useState<NotebookTab>(initialTab);
  return (
    <Dialog title="手帳" onClose={onClose} className="notebook">
      <div className="tabs" role="tablist" aria-label="手帳のページ">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="notebook-page"
            className={`tab${tab === t.id ? ' on' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="page" id="notebook-page" role="tabpanel" aria-labelledby={`tab-${tab}`} tabIndex={0}>
        {tab === 'log' && <LogPage state={state} now={nowMinute} />}
        {tab === 'rank' && <RankPage state={state} />}
        {tab === 'window' && <WindowPage state={state} />}
      </div>
    </Dialog>
  );
});

function LogPage({ state, now }: { state: SaveData; now: number }) {
  const stats = computeStats(state, now);
  const days = useMemo(() => groupHistory(state.history, HISTORY_SHOWN), [state.history]);
  const mymug = rankForPoints(state.points).level >= RANKS.length;
  return (
    <>
      <dl className="stats">
        <div>
          <dt>今日</dt>
          <dd>{stats.todayMs >= 60_000 ? formatDuration(stats.todayMs) : '—'}</dd>
        </div>
        <div>
          <dt>今週</dt>
          <dd>{stats.weekMs >= 60_000 ? formatDuration(stats.weekMs) : '—'}</dd>
        </div>
        <div>
          <dt>これまで</dt>
          <dd>{stats.totalMs >= 60_000 ? formatDuration(stats.totalMs) : '—'}</dd>
        </div>
      </dl>
      <p className="stats-sub">
        {stats.visits > 0 ? `${stats.visitDays}日 通って、${stats.visits}回 作業をした。` : 'まだ何も書かれていない。'}
      </p>
      {days.map((d) => (
        <section key={d.day} className="log-day">
          <h3>
            {formatDateWithYear(d.day)}
            <span>{formatDuration(d.totalMs)}</span>
          </h3>
          <ul>
            {d.sessions.map((s) => (
              <li key={s.id}>
                <SpriteIcon id={menuSpriteId(s.menuId, mymug)} scale={1} box={24} />
                <span className="log-time">
                  {formatTimeOfDay(s.start)} – {formatTimeOfDay(s.end)}
                </span>
                <span className="log-dur">{formatDuration(s.end - s.start)}</span>
                <span className="log-menu">{menuName(s.menuId)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {state.history.length > HISTORY_SHOWN && (
        <p className="hint">これより前の記録も保存されています（設定の「書き出す」で、すべて取り出せます）。</p>
      )}
    </>
  );
}

function RankPage({ state }: { state: SaveData }) {
  const level = rankForPoints(state.points).level;
  const reached = RANKS.filter((r) => r.level <= level).reverse();
  return (
    <>
      <RankLine points={state.points} />
      <p className="hint">
        作業をした時間のぶんだけ、この店に少しずつなじんでいきます。その日はじめての来店には、ささやかなおまけ。急がなくても、減ることはありません。
      </p>
      <ol className="steps" reversed>
        {level < RANKS.length && <li className="future">この先も、少しずつ。</li>}
        {reached.map((r) => (
          <li key={r.level}>
            <strong>{r.name}</strong>
            <span>{r.note}</span>
          </li>
        ))}
      </ol>
    </>
  );
}

function WindowPage({ state }: { state: SaveData }) {
  const seen = EVENTS.filter((e) => (state.seen[e.id] ?? 0) > 0);
  return (
    <>
      <p className="hint">作業のあいまに、ふと目に入ったもの。見逃しても、またそのうち。</p>
      {seen.length === 0 ? (
        <p className="empty">まだ何も書かれていない。</p>
      ) : (
        <ul className="seen">
          {seen.map((e) => (
            <li key={e.id}>
              <strong>{e.name}</strong>
              <span>{e.caption}</span>
              <em>{state.seen[e.id]}回</em>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
