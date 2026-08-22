import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import EmptyState from '../components/EmptyState';
import Avatar from '../components/Avatar';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { useSearchParams } from 'react-router-dom';
import { useReveal } from '../hooks/useReveal';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';

export default function Leave(){
  const toast = useToast();
  useReveal();
  const { user } = useAuth();
  const isApprover = user && ['ADMIN','HR','MANAGER'].includes(user.role);
  const [activeTab, setActiveTab] = useState<'timeoff'|'allocation'>('timeoff');
  const [requests, setRequests] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [sp, setSp] = useSearchParams();
  const [showNew, setShowNew] = useState(sp.get('new')==='1');
  useEffect(()=>{ if(sp.get('new')==='1'){ setShowNew(true); sp.delete('new'); setSp(sp, { replace:true }); } },[sp]);
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
      <PageHeader title="Time Off" subtitle="Balances, requests and approvals in one place." actions={<>
        {isApprover && (
          <div className="tabs">
            <button className={`tab ${activeTab==='timeoff'?'active':''}`} onClick={()=> setActiveTab('timeoff')}>Time Off</button>
            <button className={`tab ${activeTab==='allocation'?'active':''}`} onClick={()=> setActiveTab('allocation')}>Allocation</button>
          </div>
        )}
        <input value={search} onChange={e=> setSearch(e.target.value)} placeholder="Search" className="input" style={{ width:180 }} />
        <button className="btn btn-primary btn-press" onClick={()=> setShowNew(true)}>+ New request</button>
      </>} />

      {/* balance chips */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16 }}>
        {balances.map((b:any, i:number)=>(
          <div key={b.id} className="balance-chip fade-up" style={{ '--i': i } as any}>
            <div style={{ display:'flex', justifyContent:'space-between', gap:12, fontSize:13 }}>
              <span style={{ fontWeight:700 }}>{b.name}</span>
              <span style={{ color:'var(--neutral-500)' }}>{Number(b.used).toFixed(0)} / {(Number(b.allocated)+Number(b.carried_forward)).toFixed(0)} used</span>
            </div>
            <div className="bar"><span style={{ width: `${Math.min(100, (Number(b.allocated)+Number(b.carried_forward))>0 ? (Number(b.used)/(Number(b.allocated)+Number(b.carried_forward)))*100 : 0)}%` }} /></div>
            <div style={{ fontSize:12, color:'var(--neutral-500)' }}><b style={{ color:'var(--neutral-900)' }}>{(Number(b.allocated)+Number(b.carried_forward)-Number(b.used)).toFixed(1)}</b> days available</div>
          </div>
        ))}
        {balances.length===0 && <span style={{ fontSize:13, color:'var(--neutral-500)' }}>No balances yet</span>}
      </div>

      <div style={{ display:'grid', gridTemplateColumns: isApprover? '1fr' : '2fr 1fr', gap:16 }}>
        <div className="table-wrap reveal">
          <table>
            <thead><tr><th>Name</th><th>Start Date</th><th>End Date</th><th>Type</th><th>Status</th>{isApprover && <th>Action</th>}</tr></thead>
            <tbody>
              {filtered.length===0 ? <tr><td colSpan={6}><EmptyState compact icon="sun" title="No time-off requests" hint="Requests you submit or need to approve will show up here." action={<button className="btn btn-primary btn-sm btn-press" onClick={()=> setShowNew(true)}>Request time off</button>} /></td></tr> :
              filtered.map((r:any)=>(
                <tr key={r.id}>
                  <td><div style={{ display:'flex', alignItems:'center', gap:8 }}><Avatar src={r.photo_url} name={r.employeeName} size={24} />{r.employeeName}</div></td>
                  <td>{r.start_date.slice(0,10)}</td>
                  <td>{r.end_date.slice(0,10)}</td>
                  <td><span className="badge badge-neutral">{r.leaveTypeName||r.code}</span></td>
                  <td><span className={`badge ${r.status==='APPROVED'?'badge-success': r.status==='REJECTED'?'badge-warn': r.status==='PENDING'?'badge-neutral':'badge-neutral'}`} style={{ background: r.status==='APPROVED'?'var(--success-light)': r.status==='REJECTED'?'var(--danger-light)': r.status==='PENDING'?'var(--warn-light)':'' }}>{r.status}</span></td>
                  {isApprover && <td>{r.status==='PENDING' ? (
                    <div style={{ display:'flex', gap:6 }}>
                      <button className="btn btn-primary btn-sm btn-press" style={{ background:'var(--success)' }} onClick={async()=>{ await api(`/api/leave/requests/${r.id}/decide`,{method:'POST', body:JSON.stringify({action:'APPROVED'})}); load(); }}>Approve</button>
                      <button className="btn btn-ghost btn-sm" style={{ color:'var(--danger)' }} onClick={async()=>{ const c=prompt('Reason'); await api(`/api/leave/requests/${r.id}/decide`,{method:'POST', body:JSON.stringify({action:'REJECTED', comment:c})}); load(); }}>Reject</button>
                    </div>
                  ) : r.status==='CANCELLATION_REQUESTED' ? (
                    <div style={{ display:'flex', gap:6 }}><button className="btn btn-primary btn-sm btn-press" onClick={async()=>{ await api(`/api/leave/requests/${r.id}/decide`,{method:'POST', body:JSON.stringify({action:'APPROVED'})}); load(); }}>Confirm Cancel</button></div>
                  ) : '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!isApprover && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div className="card fade-up" style={{ '--i': 1 } as any}>
              <h4 style={{ margin:'0 0 12px' }}>Year Calendar</h4>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8 }}>
                {Array.from({length:12}).map((_,m)=>{
                  const monthName=new Date(2025,m,1).toLocaleString('en-US',{month:'short'});
                  // filter requests by month
                  const monthReqs=requests.filter((r:any)=> new Date(r.start_date).getMonth()===m);
                  return (
                    <div key={m} style={{ border:'1px solid var(--hairline)', borderRadius:10, padding:8, background:'var(--card)' }}>
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
            <div className="card fade-up" style={{ '--i': 2 } as any}>
              <h4 style={{ margin:'0 0 8px' }}>Public Holidays</h4>
              {holidays.map((h:any)=> <div key={h.id} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', fontSize:13, borderBottom:'1px solid var(--neutral-100)' }}><span>{h.name}</span><span style={{ color:'var(--neutral-500)' }}>{h.date.slice(0,10)}</span></div>)}
              {holidays.length===0 && <EmptyState compact icon="calendar" title="No holidays configured" />}
            </div>
          </div>
        )}
      </div>

      {activeTab==='allocation' && isApprover && (
        <div className="card fade-up" style={{ '--i': 3, marginTop:16 } as any}>
          <h3 style={{ marginTop:0 }}>Leave Allocation — Balance Overview</h3>
          <div className="table-wrap reveal">
            <table><thead><tr><th>Employee</th><th>Leave Type</th><th>Allocated</th><th>Used</th><th>Available</th></tr></thead>
            <tbody>
              {balances.map((b:any)=> <tr key={b.id}><td>—</td><td>{b.name}</td><td>{b.allocated}</td><td>{b.used}</td><td>{(b.allocated - b.used).toFixed(1)}</td></tr>)}
            </tbody></table>
          </div>
        </div>
      )}

      {showNew && (
        <Modal open onClose={()=> setShowNew(false)} title="New time-off request" width={520}>
          <div>
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
              <button className="btn btn-primary btn-press" onClick={async()=>{
                try{
                  const r=await api('/api/leave/requests',{method:'POST', body:JSON.stringify({ leaveTypeId: form.leaveTypeId, startDate: form.startDate, endDate: form.endDate, halfDay: form.halfDay, remarks: form.remarks, attachmentUrl: form.attachmentUrl })});
                  toast.success(`Request submitted — ${r.data.days} days`); setShowNew(false); load();
                }catch(e:any){ toast.error(e.message); }
              }}>Submit</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
