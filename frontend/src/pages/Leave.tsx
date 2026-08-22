import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function Leave(){
  const { user } = useAuth();
  const isApprover = user && ['ADMIN','HR','MANAGER'].includes(user.role);
  const [activeTab, setActiveTab] = useState<'timeoff'|'allocation'>('timeoff');
  const [requests, setRequests] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ leaveTypeId:'', startDate:'', endDate:'', halfDay:false, remarks:'', attachmentUrl:'' });
  const [computedDays, setComputedDays] = useState<number| null>(null);
  const [search, setSearch] = useState('');

  async function load(){
    const [req, bal, types, hol] = await Promise.all([
      api('/api/leave/requests').catch(()=>({data:[]})),
      api('/api/leave/balances').catch(()=>({data:[]})),
      api('/api/leave/types').catch(()=>({data:[]})),
      api('/api/holidays?year='+new Date().getFullYear()).catch(()=>({data:[]})),
    ]);
    setRequests(req.data||[]); setBalances(bal.data||[]); setLeaveTypes(types.data||[]); setHolidays(hol.data||[]);
    if((types.data||[]).length && !form.leaveTypeId) setForm(f=>({...f, leaveTypeId: types.data[0].id}));
  }
  useEffect(()=>{ load(); },[]);

  useEffect(()=>{
    if(form.startDate && form.endDate && form.leaveTypeId){
      // quick calc excluding weekends/holidays locally for preview
      const holSet=new Set(holidays.map((h:any)=> h.date.slice(0,10)));
      let count=0;
      let cur=new Date(form.startDate+'T00:00:00Z'), end=new Date(form.endDate+'T00:00:00Z');
      if(form.halfDay) setComputedDays(0.5);
      else {
        while(cur<=end){
          const iso=cur.toISOString().slice(0,10), dow=cur.getUTCDay();
          if(dow!==0 && dow!==6 && !holSet.has(iso)) count++;
          cur.setUTCDate(cur.getUTCDate()+1);
        }
        setComputedDays(count);
      }
    } else setComputedDays(null);
  },[form.startDate, form.endDate, form.halfDay, holidays, form.leaveTypeId]);

  const filtered = requests.filter((r:any)=> !search || r.employeeName?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="container" style={{ paddingTop:24, paddingBottom:40 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div style={{ display:'flex', gap:12, alignItems:'center' }}>
          <h2 style={{ margin:0 }}>Time Off</h2>
          {isApprover && (
            <div className="tabs">
              <button className={`tab ${activeTab==='timeoff'?'active':''}`} onClick={()=> setActiveTab('timeoff')}>Time Off</button>
              <button className={`tab ${activeTab==='allocation'?'active':''}`} onClick={()=> setActiveTab('allocation')}>Allocation</button>
            </div>
          )}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <input value={search} onChange={e=> setSearch(e.target.value)} placeholder="Search" className="input" style={{ width:180 }} />
          <button className="btn btn-primary" onClick={()=> setShowNew(true)}>+ NEW</button>
        </div>
      </div>

      {/* balance chips */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16 }}>
        {balances.map((b:any)=>(
          <div key={b.id} className="chip" style={{ background:'white' }}>
            <span style={{ fontWeight:700 }}>{b.name}</span> — {(Number(b.allocated)+Number(b.carried_forward)-Number(b.used)).toFixed(1)} days available
            <span style={{ width:60, height:6, background:'var(--neutral-200)', borderRadius:999, overflow:'hidden', display:'inline-block', marginLeft:6 }}>
              <span style={{ display:'block', height:'100%', width: `${Math.min(100, ((b.allocated - b.used)/b.allocated)*100)}%`, background:'var(--accent)' }} />
            </span>
          </div>
        ))}
        {balances.length===0 && <span style={{ fontSize:13, color:'var(--neutral-500)' }}>No balances yet</span>}
      </div>

      <div style={{ display:'grid', gridTemplateColumns: isApprover? '1fr' : '2fr 1fr', gap:16 }}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Start Date</th><th>End Date</th><th>Type</th><th>Status</th>{isApprover && <th>Action</th>}</tr></thead>
            <tbody>
              {filtered.length===0 ? <tr><td colSpan={6} style={{ textAlign:'center', padding:20, color:'var(--neutral-500)' }}>No requests</td></tr> :
              filtered.map((r:any)=>(
                <tr key={r.id}>
                  <td><div style={{ display:'flex', alignItems:'center', gap:8 }}><img src={`https://i.pravatar.cc/32?u=${r.employee_id}`} style={{ width:24, height:24, borderRadius:999 }} alt="" />{r.employeeName}</div></td>
                  <td>{r.start_date.slice(0,10)}</td>
                  <td>{r.end_date.slice(0,10)}</td>
                  <td><span className="badge badge-neutral">{r.leaveTypeName||r.code}</span></td>
                  <td><span className={`badge ${r.status==='APPROVED'?'badge-success': r.status==='REJECTED'?'badge-warn': r.status==='PENDING'?'badge-neutral':'badge-neutral'}`} style={{ background: r.status==='APPROVED'?'var(--success-light)': r.status==='REJECTED'?'var(--danger-light)': r.status==='PENDING'?'var(--warn-light)':'' }}>{r.status}</span></td>
                  {isApprover && <td>{r.status==='PENDING' ? (
                    <div style={{ display:'flex', gap:6 }}>
                      <button className="btn btn-primary btn-sm" style={{ background:'var(--success)' }} onClick={async()=>{ await api(`/api/leave/requests/${r.id}/decide`,{method:'POST', body:JSON.stringify({action:'APPROVED'})}); load(); }}>Approve</button>
                      <button className="btn btn-ghost btn-sm" style={{ color:'var(--danger)' }} onClick={async()=>{ const c=prompt('Reason'); await api(`/api/leave/requests/${r.id}/decide`,{method:'POST', body:JSON.stringify({action:'REJECTED', comment:c})}); load(); }}>Reject</button>
                    </div>
                  ) : r.status==='CANCELLATION_REQUESTED' ? (
                    <div style={{ display:'flex', gap:6 }}><button className="btn btn-primary btn-sm" onClick={async()=>{ await api(`/api/leave/requests/${r.id}/decide`,{method:'POST', body:JSON.stringify({action:'APPROVED'})}); load(); }}>Confirm Cancel</button></div>
                  ) : '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!isApprover && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div className="card">
              <h4 style={{ margin:'0 0 12px' }}>Year Calendar</h4>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8 }}>
                {Array.from({length:12}).map((_,m)=>{
                  const monthName=new Date(2025,m,1).toLocaleString('en-US',{month:'short'});
                  // filter requests by month
                  const monthReqs=requests.filter((r:any)=> new Date(r.start_date).getMonth()===m);
                  return (
                    <div key={m} style={{ border:'1px solid var(--neutral-200)', borderRadius:10, padding:8, background:'white' }}>
                      <div style={{ fontWeight:700, fontSize:12, marginBottom:6 }}>{monthName}</div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:2 }}>
                        {Array.from({length:30}).map((_,d)=>{
                          const day=d+1; const iso=`2025-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                          const hasLeave=monthReqs.some((r:any)=> iso>=r.start_date.slice(0,10) && iso<=r.end_date.slice(0,10));
                          const color= hasLeave ? (monthReqs.find((r:any)=> iso>=r.start_date.slice(0,10) && iso<=r.end_date.slice(0,10))?.status==='APPROVED' ? 'var(--success)' : 'var(--warn)') : 'transparent';
                          return <div key={day} title={iso} style={{ width:10, height:10, borderRadius:2, background: color, border:'1px solid var(--neutral-100)' }} />;
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display:'flex', gap:12, marginTop:10, fontSize:11 }}>
                <span><span style={{ display:'inline-block', width:10, height:10, background:'var(--success)', borderRadius:2, marginRight:4 }} />Validated</span>
                <span><span style={{ display:'inline-block', width:10, height:10, background:'var(--warn)', borderRadius:2, marginRight:4 }} />To Approve</span>
                <span><span style={{ display:'inline-block', width:10, height:10, background:'var(--danger)', borderRadius:2, marginRight:4 }} />Refused</span>
              </div>
            </div>
            <div className="card">
              <h4 style={{ margin:'0 0 8px' }}>Public Holidays</h4>
              {holidays.map((h:any)=> <div key={h.id} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', fontSize:13, borderBottom:'1px solid var(--neutral-100)' }}><span>{h.name}</span><span style={{ color:'var(--neutral-500)' }}>{h.date.slice(0,10)}</span></div>)}
              {holidays.length===0 && <div style={{ fontSize:13, color:'var(--neutral-500)' }}>No holidays</div>}
            </div>
          </div>
        )}
      </div>

      {activeTab==='allocation' && isApprover && (
        <div className="card" style={{ marginTop:16 }}>
          <h3 style={{ marginTop:0 }}>Leave Allocation — Balance Overview</h3>
          <div className="table-wrap">
            <table><thead><tr><th>Employee</th><th>Leave Type</th><th>Allocated</th><th>Used</th><th>Available</th></tr></thead>
            <tbody>
              {balances.map((b:any)=> <tr key={b.id}><td>—</td><td>{b.name}</td><td>{b.allocated}</td><td>{b.used}</td><td>{(b.allocated - b.used).toFixed(1)}</td></tr>)}
            </tbody></table>
          </div>
        </div>
      )}

      {showNew && (
        <div className="modal-backdrop" onClick={()=> setShowNew(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{ width:520 }}>
            <h3 style={{ marginTop:0 }}>New Time-Off Request</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:12, marginTop:12 }}>
              <div><label className="label">Time-off Type</label>
                <select className="input" value={form.leaveTypeId} onChange={e=> setForm({...form, leaveTypeId:e.target.value})}>
                  {leaveTypes.map((t:any)=> <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}
                </select>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div><label className="label">From</label><input type="date" className="input" value={form.startDate} onChange={e=> setForm({...form, startDate:e.target.value})} /></div>
                <div><label className="label">To</label><input type="date" className="input" value={form.endDate} onChange={e=> setForm({...form, endDate:e.target.value})} /></div>
              </div>
              <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13 }}><input type="checkbox" checked={form.halfDay} onChange={e=> setForm({...form, halfDay:e.target.checked})} /> Half-day</label>
              {computedDays!==null && <div style={{ background:'var(--accent-weak)', padding:'10px 12px', borderRadius:8, fontSize:13, transition:'all 200ms' }}>This request uses <strong>{computedDays} days</strong> <span style={{ color:'var(--neutral-500)' }}>(excludes weekends & holidays)</span></div>}
              <div><label className="label">Remarks</label><textarea className="input" value={form.remarks} onChange={e=> setForm({...form, remarks:e.target.value})} rows={2} /></div>
              <div><label className="label">Attachment (medical certificate)</label><input className="input" placeholder="URL or upload later" value={form.attachmentUrl} onChange={e=> setForm({...form, attachmentUrl:e.target.value})} /></div>
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:16 }}>
              <button className="btn btn-ghost" onClick={()=> setShowNew(false)}>Discard</button>
              <button className="btn btn-primary" onClick={async()=>{
                try{
                  const r=await api('/api/leave/requests',{method:'POST', body:JSON.stringify({ leaveTypeId: form.leaveTypeId, startDate: form.startDate, endDate: form.endDate, halfDay: form.halfDay, remarks: form.remarks, attachmentUrl: form.attachmentUrl })});
                  alert(`Request submitted — ${r.data.days} days`); setShowNew(false); load();
                }catch(e:any){ alert(e.message); }
              }}>Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
