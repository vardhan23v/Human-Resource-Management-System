import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

type Kind = 'success' | 'error' | 'info';
type ToastItem = { id: number; kind: Kind; title: string; message?: string; duration: number; exiting?: boolean };
type Ctx = {
  toast: (title: string, opts?: { kind?: Kind; message?: string; duration?: number }) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
};

const ToastContext = createContext<Ctx>(null as any);
export const useToast = () => useContext(ToastContext);

const ICON: Record<Kind, string> = { success: '✓', error: '!', info: 'i' };

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems(s => s.map(t => (t.id === id ? { ...t, exiting: true } : t)));
    setTimeout(() => setItems(s => s.filter(t => t.id !== id)), 240);
  }, []);

  const toast = useCallback<Ctx['toast']>((title, opts = {}) => {
    const id = ++seq.current;
    const duration = opts.duration ?? 3600;
    setItems(s => [...s.slice(-4), { id, kind: opts.kind || 'info', title, message: opts.message, duration }]);
    setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  const value = useMemo<Ctx>(() => ({
    toast,
    success: (t, m) => toast(t, { kind: 'success', message: m }),
    error: (t, m) => toast(t, { kind: 'error', message: m, duration: 5000 }),
    info: (t, m) => toast(t, { kind: 'info', message: m }),
  }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {items.map(t => (
          <div key={t.id} className={`toast toast-${t.kind} toast-enter ${t.exiting ? 'toast-exit' : ''}`} role="status" onClick={() => dismiss(t.id)}>
            <div className="toast-icon">{ICON[t.kind]}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{t.title}</div>
              {t.message && <div style={{ color: 'var(--neutral-500)', marginTop: 2 }}>{t.message}</div>}
            </div>
            <div className="toast-bar" style={{ animationDuration: `${t.duration}ms` }} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
