import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { audio } from './audio/engine';
import { DEBUG, sceneHour, setHourOverride } from './debug';
import { pickEvent, seasonOf, weatherAt } from './game/ambience';
import { CAFE_NAME, EVENTS, EVENT_ROLL_CHANCE, EVENT_ROLL_INTERVAL_MS, EVENT_WARMUP_MS, RANKS, menuName, type EventDef } from './game/data';
import { availableMenus, decorForLevel, rankForPoints } from './game/progress';
import { createNewSave } from './game/save';
import {
  assessActive, computeReward, discardSession, elapsedMs, finishSession, recordSeen, selectMenu, startSession,
  touchSession, updateSettings, type ActiveStatus,
} from './game/session';
import { storage, store } from './game/instance';
import { formatClock } from './game/time';
import type { Receipt as ReceiptData, SaveData, Settings } from './game/types';
import { skyAt } from './scene/sky';
import { AwayDialog } from './ui/AwayDialog';
import { Notebook, type NotebookTab } from './ui/Notebook';
import { OrderSlip } from './ui/OrderSlip';
import { Receipt } from './ui/Receipt';
import { SceneCanvas, type ActiveEvent } from './ui/SceneCanvas';
import { SettingsPanel } from './ui/SettingsPanel';
import { SoundPanel } from './ui/SoundPanel';

/** 「やっぱり続ける」を選べる時間。お会計の画面を開いたまま離れた時間まで数えないため */
const UNDO_WINDOW_MS = 10 * 60_000;

type Panel = { kind: 'notebook'; tab: NotebookTab } | { kind: 'sound' } | { kind: 'settings' } | null;
type AwayStatus = Extract<ActiveStatus, { kind: 'away' }>;

interface ReceiptView {
  receipt: ReceiptData;
  reason?: string;
  /** 「やっぱり続ける」で戻す先 */
  undo: SaveData | null;
}

const LOAD_NOTICE: Record<string, string> = {
  recovered: 'セーブデータの一部が読めなかったため、控えから復元しました。',
  reset: 'セーブデータを読めなかったため、新しくはじめました。書き出したデータがあれば、設定から読み込めます。',
  unavailable: 'このブラウザでは記録を保存できません。ページを閉じると記録は残りません。',
};

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    window.addEventListener('pageshow', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
      window.removeEventListener('pageshow', tick);
    };
  }, [intervalMs]);
  return now;
}

function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(query).matches);
  useEffect(() => {
    const mq = matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

function greeting(hour: number, level: number, visits: number): string {
  if (visits === 0) return 'いらっしゃいませ。窓際の席へどうぞ。';
  if (level >= 12) return hour < 11 ? 'おはようございます。いつもの席、空いていますよ。' : 'いつもの席、空いていますよ。';
  if (hour >= 5 && hour < 11) return 'おはようございます。';
  if (hour >= 11 && hour < 17) return level >= 5 ? 'いらっしゃい。今日は何にしますか。' : 'いらっしゃいませ。';
  if (hour >= 17 && hour < 22) return level >= 5 ? 'こんばんは。おつかれさまです。' : 'こんばんは。';
  return '夜おそくまで、おつかれさまです。';
}

export function App() {
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const now = useNow(1000);
  const [panel, setPanel] = useState<Panel>(null);
  const [away, setAway] = useState<AwayStatus | null>(null);
  const [receipt, setReceipt] = useState<ReceiptView | null>(null);
  const [event, setEvent] = useState<ActiveEvent | null>(null);
  const [caption, setCaption] = useState<{ text: string; key: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(() => LOAD_NOTICE[store.loadStatus] ?? null);
  const [slipHeight, setSlipHeight] = useState(0);
  const slipRef = useRef<HTMLElement>(null);
  const eventRef = useRef<ActiveEvent | null>(null);
  eventRef.current = event;

  const narrow = useMediaQuery('(max-width: 719px)');
  const prefersReduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const motion = !prefersReduced && state.settings.motion !== 'reduced';

  const active = state.active;
  const working = active != null;
  const level = rankForPoints(state.points).level;
  const decor = useMemo(() => decorForLevel(level), [level]);
  const available = useMemo(() => availableMenus(state.points, state.unlockedMenus), [state.points, state.unlockedMenus]);
  const selected = available.includes(state.lastMenuId) ? state.lastMenuId : available[0];

  const minute = Math.floor(now / 60_000) * 60_000;
  const hour = sceneHour(now);
  const weather = useMemo(() => weatherAt(minute, state.settings.weather), [minute, state.settings.weather]);
  const raining = weather.kind === 'rain';
  const rain = raining ? weather.intensity : 0;
  const season = seasonOf(new Date(minute).getMonth() + 1);
  const lampsOn = skyAt(hour, rain).lamp > 0.5;

  const elapsed = active ? elapsedMs(active, now) : 0;
  const pending = active && !away ? computeReward(state, active.startedAt, active.startedAt + elapsed).points : 0;

  // ---- 作業の開始と終了 ----
  const finish = useCallback((endAt: number, reason?: string, allowUndo = false) => {
    const before = store.getState();
    const result = finishSession(before, endAt, Date.now());
    if (!result.receipt) return;
    store.update(() => result.state, Date.now(), true);
    setReceipt({ receipt: result.receipt, reason, undo: allowUndo ? before : null });
    setAway(null);
  }, []);

  const start = () => {
    audio.unlock();
    setReceipt(null);
    store.update((s) => startSession(s, selected, Date.now()));
  };

  const undoFinish = () => {
    const snapshot = receipt?.undo;
    if (!snapshot?.active) return;
    const t = Date.now();
    // 終了ボタンを押す前の状態に戻す（設定と窓辺の記録は今のものを残す）
    store.update((s) => touchSession({ ...snapshot, settings: s.settings, seen: s.seen }, t), t);
    setReceipt(null);
  };

  // ---- 進行中の作業の見守り（離席・長時間放置） ----
  useEffect(() => {
    if (!active || away) return;
    const status = assessActive(active, now);
    if (status.kind === 'ok') store.heartbeat(now);
    else if (status.kind === 'overtime') finish(status.endAt, '長い時間が経ったので、いったんお会計にしました。');
    else setAway(status);
  }, [active, away, now, finish]);

  // 別のタブで作業が終わったときなど、確認する相手がいなくなったら確認を取り下げる
  useEffect(() => {
    if (!active) setAway(null);
  }, [active]);

  // タブを隠す・閉じるときに書き込んでおく
  useEffect(() => {
    const flush = () => {
      const s = store.getState();
      // 離席の確認が必要な状態では、最後に確認できた時刻を上書きしない
      if (s.active && assessActive(s.active, Date.now()).kind !== 'ok') return;
      store.flush();
    };
    const onHide = () => {
      if (document.hidden) flush();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    const off = store.listenToOtherTabs();
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
      off();
    };
  }, []);

  // 作業中はタブが凍結されにくいよう、Web Locks を持っておく（対応ブラウザのみ）
  useEffect(() => {
    if (!working || !('locks' in navigator)) return;
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    void navigator.locks.request('cafe-time:working', { mode: 'shared' }, () => held).catch(() => {});
    return () => release();
  }, [working]);

  // ---- タブのタイトル ----
  const titleClock = working ? formatClock(elapsed, false) : '';
  useEffect(() => {
    document.title = working ? `${titleClock} 作業中 · ${CAFE_NAME}` : CAFE_NAME;
  }, [working, titleClock]);

  // ---- 窓辺の出来事 ----
  const showCaption = useCallback((text: string) => setCaption({ text, key: Date.now() }), []);

  const trigger = useCallback(
    (def: EventDef) => {
      store.update((s) => recordSeen(s, def.id));
      showCaption(def.caption);
      if (def.duration > 0) {
        setEvent({ id: def.id, startedAt: performance.now(), durationMs: def.duration * 1000, seed: Math.floor(Math.random() * 1000) });
      }
    },
    [showCaption],
  );

  useEffect(() => {
    if (!event) return;
    const id = setTimeout(() => setEvent(null), event.durationMs + 200);
    return () => clearTimeout(id);
  }, [event]);

  useEffect(() => {
    if (!caption) return;
    const id = setTimeout(() => setCaption(null), 9000);
    return () => clearTimeout(id);
  }, [caption]);

  const startedAt = active?.startedAt ?? 0;
  useEffect(() => {
    if (!working) return;
    const id = setInterval(() => {
      if (document.hidden || eventRef.current) return;
      if (Date.now() - startedAt < EVENT_WARMUP_MS) return;
      if (Math.random() >= EVENT_ROLL_CHANCE) return;
      const t = Date.now();
      const s = store.getState();
      const w = weatherAt(t, s.settings.weather);
      const def = pickEvent(
        { hour: sceneHour(t), season: seasonOf(new Date(t).getMonth() + 1), raining: w.kind === 'rain', level: rankForPoints(s.points).level, reducedMotion: !motion },
        Math.random(),
      );
      if (def) trigger(def);
    }, EVENT_ROLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [working, startedAt, motion, trigger]);

  // 灯りがともる・雨が降りだす、といった移り変わり
  const prevAmbient = useRef<{ lampsOn: boolean; raining: boolean } | null>(null);
  useEffect(() => {
    const prev = prevAmbient.current;
    prevAmbient.current = { lampsOn, raining };
    if (!prev || !working || document.hidden) return;
    const find = (id: string) => EVENTS.find((e) => e.id === id);
    if (!prev.raining && raining) trigger(find('rainstart')!);
    else if (prev.raining && !raining) trigger(find('rainstop')!);
    else if (!prev.lampsOn && lampsOn) trigger(find('lights')!);
  }, [lampsOn, raining, working, trigger]);

  // ---- 音 ----
  useEffect(() => {
    const s = state.settings;
    audio.update({ soundOn: s.soundOn, bgmOn: s.bgmOn, bgmVolume: s.bgmVolume, cafeVolume: s.cafeVolume, rainVolume: s.rainVolume, rain });
  }, [state.settings, rain]);

  useEffect(() => {
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const changeSettings = useCallback((patch: Partial<Settings>) => {
    audio.unlock();
    store.update((s) => updateSettings(s, patch));
  }, []);

  // ---- 狭い画面では、伝票に隠れないようテーブルの上のものを避ける ----
  useEffect(() => {
    const el = slipRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => setSlipHeight(Math.round(window.innerHeight - el.getBoundingClientRect().top));
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    measure();
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [working]);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 15000);
    return () => clearTimeout(id);
  }, [notice]);

  // ---- 開発用 ----
  useEffect(() => {
    if (!DEBUG) return;
    (window as unknown as Record<string, unknown>).__cafe = {
      store,
      setHour: (h: number | null) => setHourOverride(h),
      trigger: (id: string) => {
        const def = EVENTS.find((e) => e.id === id);
        if (def) trigger(def);
      },
      setPoints: (points: number) => store.update((s) => ({ ...s, points, unlockedMenus: availableMenus(points, s.unlockedMenus) })),
      setLevel: (lv: number) => {
        const points = RANKS[Math.max(1, Math.min(RANKS.length, lv)) - 1].points;
        store.update((s) => ({ ...s, points, unlockedMenus: availableMenus(points, s.unlockedMenus) }));
      },
      shiftStart: (ms: number) => store.update((s) => (s.active ? { ...s, active: { ...s.active, startedAt: s.active.startedAt - ms } } : s)),
    };
  }, [trigger]);

  const sceneOrder = active ? active.menuId : null;

  return (
    <div className="app">
      <SceneCanvas
        decor={decor}
        order={sceneOrder}
        orderStartedAt={active?.startedAt ?? 0}
        rain={rain}
        season={season}
        motion={motion}
        event={event}
        insetBottom={narrow ? slipHeight : 0}
      />

      <div className="caption" aria-live="polite">
        {caption && (
          <p key={caption.key} className={motion ? 'fade' : undefined}>
            {caption.text}
          </p>
        )}
      </div>

      {notice && (
        <div className="panel notice" role="status">
          <p>{notice}</p>
          <button type="button" className="btn ghost" onClick={() => setNotice(null)}>
            とじる
          </button>
        </div>
      )}

      <OrderSlip
        ref={slipRef}
        active={active}
        elapsedMs={elapsed}
        available={available}
        selected={selected}
        points={state.points}
        pending={pending}
        greeting={greeting(hour, level, state.visits)}
        showSeconds={state.settings.showSeconds}
        mymug={decor.has('mymug')}
        onSelect={(id) => store.update((s) => selectMenu(s, id))}
        onStart={start}
        onEnd={() => finish(Date.now(), undefined, true)}
        onOpenRank={() => setPanel({ kind: 'notebook', tab: 'rank' })}
      />

      <header className="topbar">
        <h1 className="sign">{CAFE_NAME}</h1>
        <nav className="topnav" aria-label="メニュー">
          <button type="button" className="btn chip" onClick={() => setPanel({ kind: 'notebook', tab: 'log' })}>
            手帳
          </button>
          <button type="button" className="btn chip" onClick={() => setPanel({ kind: 'sound' })} aria-label={`音（${state.settings.soundOn ? '入' : '切'}）`}>
            音<span className={`led${state.settings.soundOn ? ' on' : ''}`} aria-hidden="true" />
          </button>
          <button type="button" className="btn chip" onClick={() => setPanel({ kind: 'settings' })}>
            設定
          </button>
        </nav>
      </header>

      {panel?.kind === 'notebook' && <Notebook state={state} nowMinute={minute} initialTab={panel.tab} onClose={() => setPanel(null)} />}
      {panel?.kind === 'sound' && (
        <SoundPanel settings={state.settings} raining={raining} supported={audio.supported} onChange={changeSettings} onClose={() => setPanel(null)} />
      )}
      {panel?.kind === 'settings' && (
        <SettingsPanel
          state={state}
          storageOk={storage != null}
          saveFailed={store.saveFailed}
          onChange={changeSettings}
          onImport={(save) => {
            setAway(null);
            setReceipt(null);
            store.update(() => save, Date.now(), true);
          }}
          onReset={() => {
            setAway(null);
            setReceipt(null);
            store.update((s) => ({ ...createNewSave(Date.now()), settings: s.settings }), Date.now(), true);
          }}
          onClose={() => setPanel(null)}
        />
      )}

      {receipt && !away && (
        <Receipt
          receipt={receipt.receipt}
          points={state.points}
          visits={state.visits}
          reason={receipt.reason}
          onClose={() => setReceipt(null)}
          onUndo={receipt.undo && now - receipt.receipt.end < UNDO_WINDOW_MS ? undoFinish : undefined}
        />
      )}

      {away && active && (
        <AwayDialog
          active={active}
          lastSeenAt={away.lastSeenAt}
          now={now}
          canContinue={away.canContinue && now < active.startedAt + 12 * 3_600_000}
          onContinue={() => {
            const t = Date.now();
            store.update((s) => touchSession(s, t), t);
            setAway(null);
          }}
          onEndAtLastSeen={() => finish(away.lastSeenAt, `${menuName(active.menuId)}は、すっかり冷めていました。`)}
          onDiscard={() => {
            store.update((s) => discardSession(s, Date.now()));
            setAway(null);
          }}
        />
      )}
    </div>
  );
}
