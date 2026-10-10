import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  /** 外側をクリックしても閉じない（答えが必要な確認に使う） */
  modal?: boolean;
  hideTitle?: boolean;
}

/** <dialog> を使ったパネル。フォーカスの閉じ込めと Esc はブラウザに任せる */
export function Dialog({ title, onClose, children, className, modal, hideTitle }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!el.open) el.showModal();
    return () => {
      if (el.open) el.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={`panel dialog ${className ?? ''}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        if (!modal) onClose();
      }}
      onClick={(e) => {
        if (!modal && e.target === ref.current) onClose();
      }}
    >
      <div className="dialog-body">
        <header className="dialog-head">
          <h2 className={hideTitle ? 'visually-hidden' : undefined}>{title}</h2>
          {!modal && (
            <button type="button" className="btn ghost close" onClick={onClose} aria-label="閉じる">
              とじる
            </button>
          )}
        </header>
        {children}
      </div>
    </dialog>
  );
}
