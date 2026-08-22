import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import { useTheme } from '../hooks/useTheme';
import Avatar from './Avatar';

type Cmd = { id: string; label: string; hint?: string; group: 'Actions' | 'Go to' | 'People'; run: () => void; kbd?: string; photo?: string | null };

/** Global ⌘K palette: navigation, actions, and (HR/Admin) people search. */
export default function CommandPalette() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const { toggle, resolved } = useTheme();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [people, setPeople] = useState<any[]>([]);
  const [idx, setIdx] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(v => !v); } };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey); window.addEventListener('dayflow:palette', onOpen);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('dayflow:palette', onOpen); };
  }, []);
  useEffect(() => { if (open) { setQ(''); setIdx(0); setTimeout(() => input.current?.focus(), 10); } }, [open]);
  useEffect(() => {
    if (!open || q.trim().length < 2 || !user || !['ADMIN', 'HR', 'MANAGER'].includes(user.role)) { setPeople([]); return; }
    const t = setTimeout(() => api(`/api/employees?search=${encodeURIComponent(q)}&limit=5`).then(r => setPeople(r.data || [])).catch(() => {}), 200);
    return () => clearTimeout(t);
  }, [q, open, user]);

  const cmds = useMemo<Cmd[]>(() => {
    if (!user) return [];
    const hr = ['ADMIN', 'HR'].includes(user.role);
    const list: Cmd[] = [
      { id: 'checkin', group: 'Actions', label: 'Check in / out', hint: 'Attendance', kbd: 'c', run: async () => { try { const t = await api('/api/attendance/today'); const open = t.data && t.data.check_in && !t.data.check_out; await api(open ? '/api/attendance/check-out' : '/api/attendance/check-in', { method: 'POST' }); toast.success(open ? 'Checked out' : 'Checked in'); } catch (e: any) { toast.error(e.message); } } },
      { id: 'leave', group: 'Actions', label: 'Request time off', kbd: 'n', run: () => nav('/leave?new=1') },
      { id: 'theme', group: 'Actions', label: `Switch to ${resolved === 'dark' ? 'light' : 'dark'} mode`, kbd: 't', run: toggle },
      { id: 'profile', group: 'Go to', label: 'My profile', run: () => nav(`/profile/${user.employeeId}`) },
      { id: 'dir', group: 'Go to', label: 'Employees', run: () => nav('/directory') },
      { id: 'att', group: 'Go to', label: 'Attendance', run: () => nav('/attendance') },
      { id: 'lv', group: 'Go to', label: 'Time off', run: () => nav('/leave') },
      { id: 'pay', group: 'Go to', label: 'Payroll', run: () => nav('/payroll') },
      { id: 'notif', group: 'Go to', label: 'Notifications', run: () => nav('/notifications') },
      { id: 'onb', group: 'Go to', label: 'My onboarding', run: () => nav(`/profile/${user.employeeId}?tab=onboarding`) },
      { id: 'logout', group: 'Actions', label: 'Log out', run: () => logout() },
    ];
    if (['ADMIN', 'HR', 'MANAGER'].includes(user.role)) list.splice(4, 0, { id: 'team', group: 'Go to', label: 'My team', run: () => nav('/team') });
    if (hr) list.splice(4, 0, { id: 'dash', group: 'Go to', label: 'Dashboard', run: () => nav('/dashboard') }, { id: 'rep', group: 'Go to', label: 'Reports', run: () => nav('/reports') });
    if (user.role === 'ADMIN') list.push({ id: 'set', group: 'Go to', label: 'Settings', run: () => nav('/settings') }, { id: 'docs', group: 'Go to', label: 'API docs', run: () => window.open(`${(import.meta as any).env?.VITE_API_URL || ''}/api/docs`, '_blank') });
    return list;
  }, [user, resolved, toggle]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = s ? cmds.filter(c => c.label.toLowerCase().includes(s) || c.hint?.toLowerCase().includes(s)) : cmds;
    const ppl: Cmd[] = people.map(p => ({ id: `p-${p.id}`, group: 'People', label: p.name, hint: p.designation || p.departmentName, photo: p.photo_url, run: () => nav(`/profile/${p.id}`) }));
    return [...ppl, ...base];
  }, [q, cmds, people]);
  useEffect(() => setIdx(0), [filtered.length]);

  if (!open || !user) return null;
  const choose = (c: Cmd) => { setOpen(false); c.run(); };
  return (
    <div className="modal-backdrop" style={{ alignItems: 'flex-start', paddingTop: '12vh' }} onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="modal palette" role="dialog" aria-modal="true" aria-label="Command palette" style={{ width: 'min(600px, 92vw)', padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--hairline)' }}>
          <span style={{ color: 'var(--neutral-400)' }}>⌘K</span>
          <input ref={input} value={q} onChange={e => setQ(e.target.value)} placeholder="Type a command or search people…" aria-label="Command" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 15, color: 'var(--neutral-900)' }}
            onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(filtered.length - 1, i + 1)); } if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(0, i - 1)); } if (e.key === 'Enter' && filtered[idx]) choose(filtered[idx]); if (e.key === 'Escape') setOpen(false); }} />
          <kbd className="kbd">esc</kbd>
        </div>
        <div role="listbox" style={{ maxHeight: 380, overflowY: 'auto', padding: 6 }}>
          {filtered.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--neutral-500)', fontSize: 13 }}>No matches</div>}
          {(['People', 'Actions', 'Go to'] as const).map(g => {
            const items = filtered.filter(c => c.group === g); if (!items.length) return null;
            return (<div key={g}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--neutral-400)', padding: '8px 10px 4px' }}>{g}</div>
              {items.map(c => { const i = filtered.indexOf(c); return (
                <div key={c.id} role="option" aria-selected={i === idx} onMouseEnter={() => setIdx(i)} onClick={() => choose(c)} className={`palette-item ${i === idx ? 'active' : ''}`}>
                  {c.group === 'People' ? <Avatar src={c.photo} name={c.label} size={24} /> : <span style={{ width: 24, textAlign: 'center', color: 'var(--neutral-400)' }}>{c.group === 'Go to' ? '→' : '⚡'}</span>}
                  <span style={{ flex: 1 }}>{c.label}{c.hint && <span style={{ color: 'var(--neutral-500)', fontSize: 12, marginLeft: 8 }}>{c.hint}</span>}</span>
                  {c.kbd && <kbd className="kbd">{c.kbd}</kbd>}
                </div>); })}
            </div>);
          })}
        </div>
      </div>
    </div>
  );
}
