import React, { useEffect, useRef } from 'react';

/** Accessible modal: focus trap, Esc to close, restores focus, aria-modal. Uses existing .modal-backdrop/.modal styles. */
export default function Modal({ open, onClose, title, children, width = 480, footer }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; width?: number; footer?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const restore = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    restore.current = document.activeElement as HTMLElement;
    const root = ref.current!;
    const focusables = () => Array.from(root.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'));
    (focusables()[0] || root).focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab') {
        const f = focusables(); if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; restore.current?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabIndex={-1} style={{ width: `min(${width}px, 92vw)`, outline: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 id="modal-title" style={{ margin: 0 }}>{title}</h3>
          <button className="icon-btn" aria-label="Close" onClick={onClose} style={{ width: 32, height: 32, borderRadius: 999, border: '1px solid var(--neutral-200)', background: 'var(--card)', cursor: 'pointer', color: 'var(--neutral-700)' }}>✕</button>
        </div>
        {children}
        {footer && <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>{footer}</div>}
      </div>
    </div>
  );
}
