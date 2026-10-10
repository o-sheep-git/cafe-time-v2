import { useRef, useState } from 'react';
import { rankForPoints } from '../game/progress';
import { exportFileName, exportSave, importSave } from '../game/save';
import { formatDuration } from '../game/time';
import type { SaveData, Settings, WeatherSetting } from '../game/types';
import { Dialog } from './Dialog';

interface Props {
  state: SaveData;
  storageOk: boolean;
  saveFailed: boolean;
  onChange: (patch: Partial<Settings>) => void;
  onImport: (save: SaveData) => void;
  onReset: () => void;
  onClose: () => void;
}

function summary(s: SaveData): string {
  const total = s.totalWorkMs >= 60_000 ? formatDuration(s.totalWorkMs) : 'なし';
  return `これまでの作業 ${total}／${rankForPoints(s.points).name}／記録 ${s.history.length}件`;
}

/** 設定とセーブデータ */
export function SettingsPanel({ state, storageOk, saveFailed, onChange, onImport, onReset, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<SaveData | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const s = state.settings;

  const doExport = () => {
    try {
      const now = Date.now();
      const blob = new Blob([exportSave(state, now)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exportFileName(now);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setMessage('セーブデータを書き出しました。大切な場所に取っておいてください。');
    } catch {
      setMessage('書き出しに失敗しました。');
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setPending(null);
    try {
      const result = importSave(await file.text(), Date.now());
      if (result.ok) {
        setPending(result.save);
        setMessage(null);
      } else {
        setMessage(result.error);
      }
    } catch {
      setMessage('ファイルを読み取れませんでした。');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <Dialog title="設定" onClose={onClose} className="settings">
      <section>
        <h3>見えかた</h3>
        <label className="check">
          <input type="checkbox" checked={s.showSeconds} onChange={(e) => onChange({ showSeconds: e.target.checked })} />
          <span>経過時間に秒を出す</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={s.motion === 'reduced'} onChange={(e) => onChange({ motion: e.target.checked ? 'reduced' : 'auto' })} />
          <span>動きを減らす</span>
        </label>
        <label className="field">
          <span>窓の外の天気</span>
          <select value={s.weather} onChange={(e) => onChange({ weather: e.target.value as WeatherSetting })}>
            <option value="auto">おまかせ（日によって変わる）</option>
            <option value="clear">いつも晴れ</option>
            <option value="rain">いつも雨</option>
          </select>
        </label>
      </section>

      <section>
        <h3>セーブデータ</h3>
        <p className="hint">
          記録はこのブラウザの中に自動で保存されます。ブラウザのデータを消すと記録も消えるので、ときどき書き出しておくと安心です。
        </p>
        {!storageOk && <p className="warn">このブラウザでは保存ができない設定になっています。ページを閉じると記録は残りません。</p>}
        {saveFailed && <p className="warn">保存に失敗しました。空き容量を確かめるか、いまのうちに書き出しておいてください。</p>}
        <p className="save-summary">{summary(state)}</p>
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={doExport}>
            書き出す
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            読み込む
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="visually-hidden" tabIndex={-1} aria-hidden="true" onChange={(e) => void onFile(e.target.files?.[0])} />
        </div>
        <div aria-live="polite">
          {message && <p className="hint">{message}</p>}
          {pending && (
            <div className="confirm">
              <p>
                読み込むデータ: {summary(pending)}
                <br />
                いまの記録は、このデータに置き換わります。{state.active ? '進行中の作業は記録されません。' : ''}
              </p>
              <div className="dialog-actions">
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => {
                    onImport(pending);
                    setPending(null);
                    setMessage('セーブデータを読み込みました。');
                  }}
                >
                  置き換える
                </button>
                <button type="button" className="btn ghost" onClick={() => setPending(null)}>
                  やめる
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section>
        <h3>最初からやり直す</h3>
        {confirmReset ? (
          <div className="confirm">
            <p>すべての記録と常連度が消えます。元に戻すには、書き出したセーブデータが必要です。</p>
            <div className="dialog-actions">
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  onReset();
                  setConfirmReset(false);
                  setMessage(null);
                }}
              >
                すべて消して、はじめから
              </button>
              <button type="button" className="btn ghost" onClick={() => setConfirmReset(false)}>
                やめる
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn ghost" onClick={() => setConfirmReset(true)}>
            記録を消す…
          </button>
        )}
      </section>
    </Dialog>
  );
}
