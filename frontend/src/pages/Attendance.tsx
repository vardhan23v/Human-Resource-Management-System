import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import EmptyState from '../components/EmptyState';
import Avatar from '../components/Avatar';
import { useReveal } from '../hooks/useReveal';
import PageHeader from '../components/PageHeader';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';

export default function Attendance(){
  const toast = useToast();
  useReveal();
  const { user } = useAuth();
  const isAdmin = user && ['ADMIN','HR','MANAGER'].includes(user.role);
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [month, setMonth] = useState(new Date().toISOString().slice(0,7));
  const [adminRows, setAdminRows] = useState<any[]>([]);
  const [empRows, setEmpRows] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [regularizations, setRegularizations] = useState<any[]>([]);
  const [showReg, setShowReg] = useState(false);
  const [regForm, setRegForm] = useState({ date: new Date().toISOString().slice(0,10), reason:'', requestedCheckIn:'09:00', requestedCheckOut:'18:00' });

  async function loadAdmin(){
    try{
      const r=await api(`/api/attendance?date=${date}&limit=100&search=${encodeURIComponent(search)}`);
      // Actually our attendance list supports date filter; if date provided it filters by that date, but need to fetch all for date
      setAdminRows(r.data||[]);
    }catch{}
  }
  async function loadEmp(){
    const empId = user?.employeeId;
    if(!empId) return;
    try{
      const r=await api(`/api/attendance?employeeId=${empId}&month=${month}&limit=100`);
      setEmpRows(r.data||[]);
      setSummary(r.summary||null);
      const cal=await api(`/api/attendance/calendar?employeeId=${empId}&month=${month}`);
      // could use cal for heatmap
    }catch{}
  }
  async function loadRegs(){ try{ const r=await api('/api/attendance/regularizations/list'); setRegularizations(r.data||[]); }catch{} }

  useEffect(()=>{ if(isAdmin) loadAdmin(); else loadEmp(); loadRegs(); },[date, month, search, user]);
  useEffect(()=>{ if(!isAdmin) loadEmp(); },[month]);

  return (
    <div className="container" style={{ paddingTop:24, paddingBottom:40 }}>
      <PageHeader title="Attendance" subtitle="Check in, review the team, and fix anomalies." />

      {isAdmin ? (
        <>
          <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              <button className="btn btn-ghost btn-sm" onClick={()=> { const d=new Date(date); d.setDate(d.getDate()-1); setDate(d.toISOString().slice(0,10)); }}>←</button>
              <input type="date" className="input" value={date} onChange={e=> setDate(e.target.value)} style={{ width:160 }} />
              <button className="btn btn-ghost btn-sm" onClick={()=> { const d=new Date(date); d.setDate(d.getDate()+1); setDate(d.toISOString().slice(0,10)); }}>→</button>
              <span className="chip">Day view</span>
            </div>
            <input value={search} onChange={e=> setSearch(e.target.value)} placeholder="Search" className="input" style={{ width:220 }} />
            <button className="btn btn-ghost" onClick={()=> window.open(`/api/reports/export/attendance?from=${date}&to=${date}`,'_blank')}>Export CSV</button>
            <button className="btn btn-primary btn-press" onClick={()=> setShowReg(true)}>Request Regularization</button>
          </div>
          <div className="table-wrap reveal">
            <table>
              <thead><tr><th>Emp</th><th>Check In</th><th>Check Out</th><th>Work Hours</th><th>Extra Hours</th><th>Status</th></tr></thead>
              <tbody>
                {adminRows.length===0 ? <tr><td colSpan={6}><EmptyState compact icon="calendar" title={`No attendance on ${date}`} hint="Weekend, holiday, or nobody has checked in yet." /></td></tr> :
                adminRows.map((r:any)=>(
                  <tr key={r.id}>
                    <td><div style={{ display:'flex', alignItems:'center', gap:8 }}><Avatar src={r.photo_url} name={r.employeeName} size={28} />{r.employeeName||r.employee_id.slice(0,6)}</div></td>
                    <td>{r.check_in?.slice(11,16)||'—'}</td>
                    <td>{r.check_out?.slice(11,16)||'—'}</td>
                    <td>{r.worked_minutes ? `${Math.floor(r.worked_minutes/60).toString().padStart(2,'0')}:${String(r.worked_minutes%60).padStart(2,'0')}` : '—'}</td>
                    <td>{r.extra_minutes ? `${Math.floor(r.extra_minutes/60)}h ${r.extra_minutes%60}m` : '—'}</td>
                    <td><span className={`badge ${r.status==='PRESENT'?'badge-success': r.status==='LEAVE'?'badge-warn':'badge-neutral'}`}>{r.status}</span>{r.late_flag? ' ⏰':''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* regularization queue for approvers */}
          {isAdmin && regularizations.length>0 && (
            <div className="card fade-up" style={{ '--i': 1, marginTop:16 } as any}>
              <h4 style={{ marginTop:0 }}>Regularization Requests</h4>
              <div className="table-wrap reveal">
                <table><thead><tr><th>Employee</th><th>Date</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>{regularizations.map((rq:any)=>(
                  <tr key={rq.id}><td>{rq.employeeName}</td><td>{rq.date.slice(0,10)}</td><td>{rq.reason}</td><td><span className="badge badge-neutral">{rq.status}</span></td><td>{rq.status==='PENDING' && (
                    <div style={{ display:'flex', gap:6 }}><button className="btn btn-primary btn-sm btn-press" onClick={async()=>{ await api(`/api/attendance/regularizations/${rq.id}/decide`,{method:'POST', body:JSON.stringify({action:'APPROVED'})}); loadRegs(); }}>Approve</button><button className="btn btn-ghost btn-sm" onClick={async()=>{ await api(`/api/attendance/regularizations/${rq.id}/decide`,{method:'POST', body:JSON.stringify({action:'REJECTED'})}); loadRegs(); }}>Reject</button></div>
                  )}</td></tr>
                ))}</tbody></table>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={()=>{ const [y,m]=month.split('-').map(Number); const d=new Date(y,m-2,1); setMonth(d.toISOString().slice(0,7)); }}>←</button>
            <select className="input" value={month} onChange={e=> setMonth(e.target.value)} style={{ width:140 }}>
              {Array.from({length:12}).map((_,i)=>{ const d=new Date(new Date().getFullYear(),i,1); const v=d.toISOString().slice(0,7); return <option key={v} value={v}>{d.toLocaleDateString('en-US',{month:'short', year:'numeric'})}</option>; })}
            </select>
            <button className="btn btn-ghost btn-sm" onClick={()=>{ const [y,m]=month.split('-').map(Number); const d=new Date(y,m,1); setMonth(d.toISOString().slice(0,7)); }}>→</button>
            {summary && (
              <div style={{ display:'flex', gap:8 }}>
                <span className="chip">Present: {summary.present||0}</span>
                <span className="chip">Leaves: {summary.leave||0}</span>
                <span className="chip">Total working: {(summary.present||0)+(summary.leave||0)+(summary.absent||0)}</span>
              </div>
            )}
            <button className="btn btn-primary btn-sm btn-press" onClick={()=> setShowReg(true)}>Request Correction</button>
          </div>
          <div className="table-wrap reveal">
            <table>
              <thead><tr><th>Date</th><th>Check In</th><th>Check Out</th><th>Work Hours</th><th>Extra Hours</th></tr></thead>
              <tbody>
                {empRows.length===0 ? <tr><td colSpan={5}><EmptyState compact icon="calendar" title={`No attendance in ${month}`} hint="Your check-ins for this month will appear here." /></td></tr> :
                empRows.map((r:any)=>(
                  <tr key={r.id}><td>{r.date.slice(0,10)}</td><td>{r.check_in?.slice(11,16)||'—'}</td><td>{r.check_out?.slice(11,16)||'—'}</td><td>{r.worked_minutes ? `${Math.floor(r.worked_minutes/60)}:${String(r.worked_minutes%60).padStart(2,'0')}`:'—'}</td><td>{r.extra_minutes||'—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* heatmap */}
          <div className="card fade-up" style={{ '--i': 2, marginTop:16 } as any}>
            <h4 style={{ margin:'0 0 12px' }}>Monthly Calendar</h4>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:6 }}>
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=> <div key={d} style={{ fontSize:11, fontWeight:700, color:'var(--neutral-500)', textAlign:'center' }}>{d}</div>)}
              {empRows.map((r:any, i:number)=>(
                <div key={r.id} style={{ height:48, borderRadius:8, background: r.status==='PRESENT'?'var(--success-light)': r.status==='LEAVE'?'var(--warn-light)': r.status==='ABSENT'?'var(--neutral-100)':'white', border:'1px solid var(--hairline)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontSize:12, animationDelay: `${i*20}ms` }} className="fade-up">
                  <span style={{ fontWeight:700 }}>{new Date(r.date).getDate()}</span><span style={{ fontSize:10, color:'var(--neutral-500)' }}>{r.worked_minutes? `${Math.floor(r.worked_minutes/60)}h`: r.status}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {showReg && (
        <div className="modal-backdrop" onClick={()=> setShowReg(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <h3 style={{ marginTop:0 }}>Request Regularization</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:12 }}>
              <div><label className="label">Date</label><input type="date" className="input" value={regForm.date} onChange={e=> setRegForm({...regForm, date:e.target.value})} /></div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div><label className="label">Requested Check In</label><input type="time" className="input" value={regForm.requestedCheckIn} onChange={e=> setRegForm({...regForm, requestedCheckIn:e.target.value})} /></div>
                <div><label className="label">Requested Check Out</label><input type="time" className="input" value={regForm.requestedCheckOut} onChange={e=> setRegForm({...regForm, requestedCheckOut:e.target.value})} /></div>
              </div>
              <div><label className="label">Reason</label><textarea className="input" value={regForm.reason} onChange={e=> setRegForm({...regForm, reason:e.target.value})} rows={2} /></div>
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:16 }}>
              <button className="btn btn-ghost" onClick={()=> setShowReg(false)}>Discard</button>
              <button className="btn btn-primary btn-press" onClick={async()=>{
                try{
                  await api('/api/attendance/regularizations',{method:'POST', body:JSON.stringify({ date: regForm.date, requestedCheckIn: regForm.date+' '+regForm.requestedCheckIn+':00', requestedCheckOut: regForm.date+' '+regForm.requestedCheckOut+':00', reason: regForm.reason })});
                  toast.success('Request submitted for approval'); setShowReg(false); loadRegs();
                }catch(e:any){ toast.error(e.message); }
              }}>Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
