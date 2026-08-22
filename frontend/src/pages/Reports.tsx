import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Skeleton from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { useReveal } from '../hooks/useReveal';

const API = ((import.meta as any).env?.VITE_API_URL || '').replace(/\/+$/, '');

/** Hand-rolled horizontal bar list (no chart lib). */
function Bars({ rows, max, color = 'var(--accent)' }: { rows: { label: string; value: number; sub?: string }[]; max?: number; color?: string }) {
  const m = max ?? Math.max(1, ...rows.map(r => r.value));
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {rows.map((r, i) => (
        <div key={r.label} className="fade-up" style={{ '--i': i } as any}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}><span style={{ fontWeight: 600 }}>{r.label}</span><span style={{ color: 'var(--neutral-500)' }}>{r.sub ?? r.value}</span></div>
          <div style={{ height: 8, background: 'var(--neutral-100)', borderRadius: 999, overflow: 'hidden' }}><div className="bar-fill" style={{ width: `${(r.value / m) * 100}%`, height: '100%', background: color, borderRadius: 999, '--i': i } as any} /></div>
        </div>
      ))}
    </div>
  );
}

export default function Reports() {
  const toast = useToast();
  useReveal();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [year] = useState(new Date().getFullYear());
  const [summary, setSummary] = useState<any[] | null>(null);
  const [leave, setLeave] = useState<any[] | null>(null);
  const [head, setHead] = useState<any | null>(null);
  const [late, setLate] = useState<any[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, l, h, la] = await Promise.all([
          api(`/api/reports/attendance-summary?month=${month}`), api(`/api/reports/leave-utilization?year=${year}`), api('/api/reports/headcount'), api(`/api/reports/late-arrivals?month=${month}`)]);
        setSummary(s.data); setLeave(l.data); setHead(h.data); setLate(la.data);
      } catch (e: any) { toast.error('Could not load reports', e.message); }
    })();
  }, [month]);

  const downloadCsv = async (path: string, name: string) => {
    try {
      const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
    } catch (e: any) { toast.error(e.message); }
  };
  const toCsv = (rows: any[], name: string) => { if (!rows?.length) return; const keys = Object.keys(rows[0]); const csv = [keys.join(','), ...rows.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(','))].join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = name; a.click(); };

  const from = `${month}-01`, to = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).toISOString().slice(0, 10);
  const totals = summary ? summary.reduce((a, r) => ({ present: a.present + Number(r.present), half: a.half + Number(r.half), leave: a.leave + Number(r.onLeave), absent: a.absent + Number(r.absent), late: a.late + Number(r.late) }), { present: 0, half: 0, leave: 0, absent: 0, late: 0 }) : null;

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 40 }}>
      <PageHeader title="Reports" subtitle="Attendance, leave and headcount — exportable." actions={<>
        <input type="month" className="input" value={month} onChange={e => setMonth(e.target.value)} style={{ width: 160 }} />
        <button className="btn btn-ghost" onClick={() => downloadCsv(`/api/reports/export/attendance?from=${from}&to=${to}`, `attendance-${month}.csv`)}>Export attendance CSV</button>
      </>} />

      {!summary ? <div className="grid-2"><div className="card"><Skeleton lines={4} /></div><div className="card"><Skeleton lines={4} /></div></div> : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            {[['Present days', totals!.present, 'var(--success)'], ['Half days', totals!.half, 'var(--warn)'], ['Leave days', totals!.leave, 'var(--accent)'], ['Late arrivals', totals!.late, 'var(--danger)']].map(([l, v, c], i) => (
              <div key={String(l)} className="card hover-lift fade-up" style={{ '--i': i, borderLeft: `4px solid ${c}` } as any}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--neutral-500)' }}>{l}</div>
                <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-display)', marginTop: 4 }}>{v as number}</div>
                <div style={{ fontSize: 12, color: 'var(--neutral-500)' }}>in {month}</div>
              </div>))}
          </div>

          <div className="grid-2" style={{ marginBottom: 16 }}>
            <div className="card reveal">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}><h4 style={{ margin: 0 }}>Headcount by department</h4><span className="badge badge-neutral">{head?.total} total</span></div>
              {head?.byDepartment?.length ? <Bars rows={head.byDepartment.map((d: any) => ({ label: d.department, value: Number(d.count) }))} /> : <EmptyState compact title="No departments" />}
            </div>
            <div className="card reveal">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}><h4 style={{ margin: 0 }}>Leave utilisation {year}</h4><button className="btn btn-ghost btn-sm" onClick={() => toCsv(leave!, `leave-utilization-${year}.csv`)}>CSV</button></div>
              {leave?.length ? <Bars color="var(--accent-2)" rows={leave.map((l: any) => ({ label: l.name, value: Number(l.approvedDays), sub: `${Number(l.approvedDays)} days · ${l.requests} requests` }))} /> : <EmptyState compact title="No leave data" />}
            </div>
          </div>

          <div className="card reveal" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}><h4 style={{ margin: 0 }}>Attendance by employee — {month}</h4><button className="btn btn-ghost btn-sm" onClick={() => toCsv(summary, `attendance-summary-${month}.csv`)}>CSV</button></div>
            <div className="table-wrap"><table>
              <thead><tr><th>Employee</th><th>Department</th><th>Present</th><th>Half</th><th>Leave</th><th>Absent</th><th>Late</th><th style={{ width: 180 }}>Attendance</th></tr></thead>
              <tbody>{summary.map((r: any) => { const tot = Number(r.present) + Number(r.half) + Number(r.onLeave) + Number(r.absent); const pct = tot ? Math.round(((Number(r.present) + Number(r.half) * 0.5) / tot) * 100) : 0; return (
                <tr key={r.id}><td style={{ fontWeight: 600 }}>{r.name}</td><td>{r.department || '—'}</td><td>{r.present}</td><td>{r.half}</td><td>{r.onLeave}</td><td>{r.absent}</td><td style={{ color: Number(r.late) ? 'var(--danger)' : undefined }}>{r.late}</td>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ flex: 1, height: 6, background: 'var(--neutral-100)', borderRadius: 999, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: pct >= 90 ? 'var(--success)' : pct >= 70 ? 'var(--warn)' : 'var(--danger)' }} /></div><span style={{ fontSize: 12, width: 36, textAlign: 'right' }}>{pct}%</span></div></td></tr>); })}</tbody>
            </table></div>
          </div>

          <div className="card reveal">
            <h4 style={{ margin: '0 0 12px' }}>Late arrivals — {month}</h4>
            {late?.length ? <div className="table-wrap"><table><thead><tr><th>Employee</th><th>Date</th><th>Checked in</th></tr></thead><tbody>{late.map((l: any, i: number) => <tr key={i}><td>{l.name}</td><td>{String(l.date).slice(0, 10)}</td><td>{l.check_in ? new Date(l.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td></tr>)}</tbody></table></div>
              : <EmptyState compact icon="sun" title="No late arrivals" hint="Everyone beat the grace period this month." />}
          </div>
        </>
      )}
    </div>
  );
}
