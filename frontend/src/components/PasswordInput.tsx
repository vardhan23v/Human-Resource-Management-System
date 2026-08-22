import { useMemo, useState } from 'react';

export function passwordScore(p: string) {
  let s = 0;
  if (p.length >= 8) s++; if (p.length >= 12) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++; if (/\d/.test(p)) s++; if (/[^A-Za-z0-9]/.test(p)) s++;
  return Math.min(4, s);
}
const LABELS = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
const COLORS = ['var(--neutral-200)', 'var(--danger)', 'var(--warn)', 'var(--accent)', 'var(--success)'];

/** Password input with show/hide toggle and an optional strength meter — used on every password form. */
export default function PasswordInput({ value, onChange, placeholder = '••••••••', meter = false, autoComplete = 'current-password', required = true, style }: { value: string; onChange: (v: string) => void; placeholder?: string; meter?: boolean; autoComplete?: string; required?: boolean; style?: React.CSSProperties }) {
  const [show, setShow] = useState(false);
  const score = useMemo(() => passwordScore(value), [value]);
  return (
    <div>
      <div style={{ position: 'relative' }}>
        <input className="input" type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required} autoComplete={autoComplete} style={{ paddingRight: 44, ...style }} />
        <button type="button" onClick={() => setShow(v => !v)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--neutral-500)', padding: 6 }}>
          {show ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
        </button>
      </div>
      {meter && value.length > 0 && (
        <div aria-live="polite" style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 4 }}>{[1, 2, 3, 4].map(i => <span key={i} style={{ flex: 1, height: 4, borderRadius: 999, background: i <= score ? COLORS[score] : 'var(--neutral-200)', transition: 'background 200ms' }} />)}</div>
          <div style={{ fontSize: 11, marginTop: 4, color: 'var(--neutral-500)' }}>{LABELS[score]}{score < 3 && ' — use 8+ characters with upper, lower and a digit'}</div>
        </div>
      )}
    </div>
  );
}
