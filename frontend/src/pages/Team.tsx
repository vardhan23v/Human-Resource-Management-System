import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Avatar from '../components/Avatar';
import Skeleton from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { useReveal } from '../hooks/useReveal';

const STATUS: Record<string, [string, string]> = { PRESENT: ['In', 'badge-success'], HALF_DAY: ['Half day', 'badge-warn'], LEAVE: ['On leave', 'badge-neutral'], ABSENT: ['Absent', 'badge-warn'] };

export default function Team() {
  const toast = useToast(); const { user } = useAuth(); useReveal();
  const [data, setData] = useState<any | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = () => api('/api/reports/team').then(r => setData(r.data)).catch(e => toast.error('Could not load team', e.message));
  useEffect(() => { load(); }, []);
  const decide = async (kind: 'leave' | 'reg', id: string, action: 'APPROVED' | 'REJECTED') => {
    setBusy(id);
    try { await api(kind === 'leave' ? `/api/leave/requests/${id}/decide` : `/api/attendance/regularizations/${id}/decide`, { method: 'POST', body: JSON.stringify({ action }) }); toast.success(action === 'APPROVED' ? 'Approved' : 'Rejected'); await load(); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };
  if (!data) return <div className="container" style={{ paddingTop: 24 }}><Skeleton height={32} width={200} style={{ marginBottom: 16 }} /><div className="grid-4">{[0, 1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 90 }} />)}</div></div>;
  const { members, pendingLeaves, pendingRegs, summary } = data;
  const scope = user?.role === 'MANAGER' ? 'your direct reports' : 'everyone in the company';
  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 40 }}>
      <PageHeader title="My team" subtitle={`Today at a glance for ${scope}.`} />
      <div className="grid-4" style={{ marginBottom: 16 }}>
        {[['Team', summary.total, ''], ['In today', summary.present, 'var(--success)'], ['On leave', summary.onLeave, 'var(--accent)'], ['Not in yet', summary.notIn, 'var(--warn)']].map(([l, v, c], i) => (
          <div key={String(l)} className="card fade-up" style={{ '--i': i, borderLeft: c ? `4px solid ${c}` : undefined } as any}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--neutral-500)' }}>{l}</div>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-display)', marginTop: 4 }}>{v as number}</div>
          </div>))}
      </div>
      <div className="grid-2-1">
        <div className="card reveal">
          <h4 style={{ margin: '0 0 12px' }}>Who's in</h4>
          {members.length ? <div style={{ display: 'grid', gap: 4 }}>{members.map((m: any, i: number) => {
            const st = m.onLeave ? ['On leave · ' + m.onLeave, 'badge-neutral'] : STATUS[m.todayStatus] || ['Not in', 'badge-neutral'];
            return (<Link key={m.id} to={`/profile/${m.id}`} className="team-row fade-up" style={{ '--i': i } as any}>
              <Avatar src={m.photo_url} name={m.name} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 14 }}>{m.name}</div><div style={{ fontSize: 12, color: 'var(--neutral-500)' }}>{m.designation || '—'}{m.department ? ` · ${m.department}` : ''}</div></div>
              {m.checkIn && <span style={{ fontSize: 12, color: m.late ? 'var(--danger)' : 'var(--neutral-500)' }}>{new Date(m.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{m.late ? ' · late' : ''}</span>}
              <span className={`badge ${st[1]}`}>{st[0]}</span>
            </Link>); })}</div> : <EmptyState compact title="No team members yet" hint="Assign employees to you as their manager." />}
        </div>
        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <div className="card reveal">
            <h4 style={{ margin: '0 0 12px' }}>Leave approvals <span className="badge badge-warn" style={{ marginLeft: 6 }}>{pendingLeaves.length}</span></h4>
            {pendingLeaves.length ? pendingLeaves.map((r: any) => (
              <div key={r.id} style={{ padding: '10px 0', borderTop: '1px solid var(--hairline)' }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{r.employeeName} <span style={{ color: 'var(--neutral-500)', fontWeight: 400 }}>· {r.type}</span></div>
                <div style={{ fontSize: 12, color: 'var(--neutral-500)', margin: '2px 0 8px' }}>{String(r.start_date).slice(0, 10)} → {String(r.end_date).slice(0, 10)} · {r.days} day{Number(r.days) === 1 ? '' : 's'}{r.reason ? ` · “${r.reason}”` : ''}</div>
                <div style={{ display: 'flex', gap: 6 }}><button className="btn btn-primary btn-sm btn-press" disabled={busy === r.id} onClick={() => decide('leave', r.id, 'APPROVED')}>Approve</button><button className="btn btn-ghost btn-sm" disabled={busy === r.id} onClick={() => decide('leave', r.id, 'REJECTED')}>Reject</button></div>
              </div>)) : <EmptyState compact icon="sun" title="Nothing to approve" />}
          </div>
          <div className="card reveal">
            <h4 style={{ margin: '0 0 12px' }}>Attendance corrections <span className="badge badge-warn" style={{ marginLeft: 6 }}>{pendingRegs.length}</span></h4>
            {pendingRegs.length ? pendingRegs.map((r: any) => (
              <div key={r.id} style={{ padding: '10px 0', borderTop: '1px solid var(--hairline)' }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{r.employeeName}</div>
                <div style={{ fontSize: 12, color: 'var(--neutral-500)', margin: '2px 0 8px' }}>{String(r.date).slice(0, 10)} · {r.reason}</div>
                <div style={{ display: 'flex', gap: 6 }}><button className="btn btn-primary btn-sm btn-press" disabled={busy === r.id} onClick={() => decide('reg', r.id, 'APPROVED')}>Approve</button><button className="btn btn-ghost btn-sm" disabled={busy === r.id} onClick={() => decide('reg', r.id, 'REJECTED')}>Reject</button></div>
              </div>)) : <EmptyState compact icon="calendar" title="No corrections pending" />}
          </div>
        </div>
      </div>
    </div>
  );
}
