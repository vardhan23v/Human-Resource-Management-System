import { useEffect, useState } from 'react';
import { api } from '../utils/api';

export default function Dashboard(){
  const [stats, setStats] = useState<any>(null);
  useEffect(()=>{ api('/api/reports/dashboard-stats').then((r:any)=> setStats(r.data)).catch(()=>{}); },[]);
  if(!stats) return <div className="container" style={{ paddingTop:24 }}><div className="skeleton" style={{ height:200 }} /></div>;
  return (
    <div className="container" style={{ paddingTop:24, paddingBottom:40 }}>
      <h2 style={{ margin:'0 0 16px' }}>Dashboard</h2>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, marginBottom:16 }}>
        <Stat label="Headcount" value={stats.headcount} sub="Active employees" />
        <Stat label="Present today" value={stats.presentToday} sub={`${stats.headcount? Math.round(stats.presentToday/stats.headcount*100):0}% attendance`} accent />
        <Stat label="Pending approvals" value={stats.pendingLeaves + stats.pendingRegularizations} sub={`${stats.pendingLeaves} leave • ${stats.pendingRegularizations} regularization`} />
        <Stat label="Leaves this month" value={stats.leavesByType?.reduce((s:any,x:any)=> s+Number(x.count),0) || 0} sub="Across all types" />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16 }}>
        <div className="card">
          <h4 style={{ margin:'0 0 12px' }}>Attendance % Trend (7 days)</h4>
          <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:120 }}>
            {(stats.trend||[]).map((t:any, i:number)=> {
              const pct = stats.headcount? Math.min(100, Math.round(t.present/stats.headcount*100)):0;
              return (
                <div key={t.date} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                  <div style={{ width:'100%', background:'var(--accent)', borderRadius:'6px 6px 0 0', height: `${pct}%`, minHeight: pct? '8px':'2px', transition:`height 600ms ease-out ${i*80}ms` }} />
                  <span style={{ fontSize:10, color:'var(--neutral-500)' }}>{t.date.slice(5)}</span>
                  <span style={{ fontSize:10, fontWeight:700 }}>{pct}%</span>
                </div>
              );
            })}
            {(stats.trend||[]).length===0 && <div style={{ fontSize:13, color:'var(--neutral-500)' }}>No data yet</div>}
          </div>
        </div>
        <div className="card">
          <h4 style={{ margin:'0 0 12px' }}>Leaves this month by type</h4>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {(stats.leavesByType||[]).map((l:any)=> (
              <div key={l.name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:13 }}>
                <span>{l.name}</span><span style={{ background:'var(--accent-weak)', padding:'2px 8px', borderRadius:999, fontWeight:700 }}>{l.count}</span>
              </div>
            ))}
            {(stats.leavesByType||[]).length===0 && <div style={{ fontSize:13, color:'var(--neutral-500)' }}>No leaves this month</div>}
          </div>
          <h4 style={{ margin:'16px 0 8px' }}>Birthdays this week</h4>
          {(stats.birthdays||[]).map((b:any)=> <div key={b.name} style={{ fontSize:13, padding:'6px 0', borderBottom:'1px solid var(--neutral-100)' }}>🎂 {b.name} — {b.dob.slice(5)}</div>)}
          {(stats.birthdays||[]).length===0 && <div style={{ fontSize:13, color:'var(--neutral-500)' }}>No birthdays this week</div>}
        </div>
      </div>
    </div>
  );
}
function Stat({ label, value, sub, accent }:any){
  return (
    <div className="card" style={{ borderLeft: accent? '4px solid var(--accent)':'1px solid rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize:12, letterSpacing:'0.04em', textTransform:'uppercase', fontWeight:700, color:'var(--neutral-500)' }}>{label}</div>
      <div style={{ fontSize:28, fontWeight:800, marginTop:4 }}>{value}</div>
      <div style={{ fontSize:12, color:'var(--neutral-500)', marginTop:2 }}>{sub}</div>
    </div>
  );
}
