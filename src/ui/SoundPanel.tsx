import type { Settings } from '../game/types';
import { Dialog } from './Dialog';

interface Props {
  settings: Settings;
  raining: boolean;
  supported: boolean;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
}

function Volume({ label, value, onChange, disabled, note }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean; note?: string }) {
  return (
    <label className={`volume${disabled ? ' off' : ''}`}>
      <span>
        {label}
        {note && <small>{note}</small>}
      </span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={Math.round(value * 100)}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        aria-valuetext={`${Math.round(value * 100)}パーセント`}
      />
    </label>
  );
}

/** 音の設定。BGM・店内の音・雨音を別々に調整できる */
export function SoundPanel({ settings: s, raining, supported, onChange, onClose }: Props) {
  return (
    <Dialog title="音" onClose={onClose} className="sound">
      {!supported && <p className="hint">このブラウザでは音を鳴らせません。</p>}
      <label className="check big">
        <input type="checkbox" checked={s.soundOn} onChange={(e) => onChange({ soundOn: e.target.checked })} />
        <span>音を鳴らす</span>
      </label>
      <fieldset disabled={!s.soundOn} className="sound-group">
        <legend className="visually-hidden">音量</legend>
        <label className="check">
          <input type="checkbox" checked={s.bgmOn} onChange={(e) => onChange({ bgmOn: e.target.checked })} />
          <span>BGM</span>
        </label>
        <Volume label="BGMの音量" value={s.bgmVolume} disabled={!s.soundOn || !s.bgmOn} onChange={(v) => onChange({ bgmVolume: v })} />
        <Volume label="店内の音" value={s.cafeVolume} disabled={!s.soundOn} onChange={(v) => onChange({ cafeVolume: v })} />
        <Volume
          label="雨音"
          note={raining ? '（いま降っています）' : '（雨の日だけ聞こえます）'}
          value={s.rainVolume}
          disabled={!s.soundOn}
          onChange={(v) => onChange({ rainVolume: v })}
        />
      </fieldset>
    </Dialog>
  );
}
