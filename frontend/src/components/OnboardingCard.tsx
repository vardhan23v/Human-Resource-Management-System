import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { useToast } from './Toast';
import Skeleton from './Skeleton';

/** Self-service onboarding checklist with a progress ring; steps link to the profile tab that completes them. */
export default function OnboardingCard({ onGoTo, compact }: { onGoTo?: (tab: string) => void; compact?: boolean }) {
  const toast = useToast();
  const [ob, setOb] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => api('/api/employees/me/onboarding').then(r => setOb(r.data)).catch(() => setOb({ steps: [], progress: 100, complete: true }));
  useEffect(() => { load(); }, []);
  if (!ob) return <div className="card"><Skeleton lines={3} /></div>;
  if (ob.complete && compact) return null;
  const r = 26, c = 2 * Math.PI * r;
  return (
    <div className="card fade-up" style={{ borderLeft: ob.complete ? '4px solid var(--success)' : '4px solid var(--accent)' }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r={r} fill="none" stroke="var(--neutral-100)" strokeWidth="6" /><circle cx="32" cy="32" r={r} fill="none" stroke={ob.complete ? 'var(--success)' : 'var(--accent)'} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - ob.progress / 100)} transform="rotate(-90 32 32)" style={{ transition: 'stroke-dashoffset 800ms var(--ease-out)' }} /><text x="32" y="36" textAnchor="middle" fontSize="13" fontWeight="800" fill="currentColor">{ob.progress}%</text></svg>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 16, fontFamily: 'var(--font-display)' }}>{ob.complete ? 'Onboarding complete 🎉' : 'Welcome aboard — let’s get you set up'}</div>
          <div style={{ fontSize: 13, color: 'var(--neutral-500)', marginTop: 2 }}>{ob.complete ? `Finished ${ob.completedAt ? new Date(ob.completedAt).toLocaleDateString() : ''}` : `${ob.steps.filter((s: any) => s.done).length} of ${ob.steps.length} steps done`}</div>
        </div>
      </div>
      {!compact && (
        <div style={{ display: 'grid', gap: 6, marginTop: 16 }}>
          {ob.steps.map((s: any, i: number) => (
            <div key={s.key} className="fade-up" style={{ '--i': i, display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px', borderRadius: 12, background: s.done ? 'transparent' : 'var(--surface-2)', border: '1px solid var(--hairline)' } as any}>
              <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, background: s.done ? 'var(--success-light)' : 'var(--neutral-100)', color: s.done ? 'var(--success)' : 'var(--neutral-400)' }}>{s.done ? '✓' : i + 1}</span>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13, textDecoration: s.done ? 'line-through' : undefined, color: s.done ? 'var(--neutral-500)' : undefined }}>{s.title}</div>{!s.done && <div style={{ fontSize: 12, color: 'var(--neutral-500)' }}>{s.hint}</div>}</div>
              {!s.done && (s.key === 'policy'
                ? <button className="btn btn-primary btn-sm btn-press" disabled={busy} onClick={async () => { setBusy(true); try { const r = await api('/api/employees/me/onboarding/accept-policy', { method: 'POST' }); setOb(r.data); toast.success('Policy acknowledged'); } catch (e: any) { toast.error(e.message); } finally { setBusy(false); } }}>I accept</button>
                : <button className="btn btn-ghost btn-sm" onClick={() => onGoTo?.(s.href)}>Go</button>)}
            </div>))}
        </div>
      )}
    </div>
  );
}
