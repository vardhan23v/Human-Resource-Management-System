import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';

export default function Directory(){
  const { user } = useAuth();
  const nav = useNavigate();
  const [employees, setEmployees] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [checkStatus, setCheckStatus] = useState<any>(null);
  const [liveSeconds, setLiveSeconds] = useState(0);
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ firstName:'', lastName:'', email:'', departmentId:'', designation:'', dateOfJoining:new Date().toISOString().slice(0,10), role:'EMPLOYEE' });
  const [departments, setDepartments] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  async function load(){
    setLoading(true);
    try{
      const r=await api(`/api/employees?search=${encodeURIComponent(search)}&limit=50`);
      setEmployees(r.data||[]);
      if(user && ['ADMIN','HR'].includes(user.role)){
        const s=await api('/api/reports/dashboard-stats');
        setStats(s.data);
      }
    }catch{} finally{ setLoading(false); }
  }
  async function loadCheck(){ try{ const r=await api('/api/attendance/today'); setCheckStatus(r.data);}catch{} }
  useEffect(()=>{ load(); loadCheck(); api('/api/employees/departments/list').then((r:any)=> setDepartments(r.data||[])).catch(()=>{}); },[search]);

  useEffect(()=>{
    if(!checkStatus?.checkedIn || checkStatus?.checkedOut) return;
    const iv=setInterval(()=> setLiveSeconds(s=>s+1),1000);
    return ()=> clearInterval(iv);
  },[checkStatus]);

  async function toggleCheck(){
    try{
      if(!checkStatus?.checkedIn) await api('/api/attendance/check-in',{method:'POST'});
      else if(checkStatus.checkedIn && !checkStatus.checkedOut) await api('/api/attendance/check-out',{method:'POST'});
      await loadCheck(); await load();
    }catch(e:any){ alert(e.message); }
  }

  const formatSince = ()=>{
    if(!checkStatus?.checkIn) return '';
    const start=new Date(checkStatus.checkIn);
    const diffSec=Math.floor((Date.now()- start.getTime())/1000) + liveSeconds - liveSeconds; // actually compute now-start
    const nowDiff=Math.floor((Date.now()- start.getTime())/1000);
    const h=Math.floor(nowDiff/3600), m=Math.floor((nowDiff%3600)/60);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  };

  return (
    <div className="container" style={{ paddingTop:24, paddingBottom:40 }}>
      {/* Systray */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ background:'white', border:'1px solid var(--neutral-200)', borderRadius:999, padding:'8px 14px', display:'flex', alignItems:'center', gap:10, boxShadow:'var(--shadow-sm)' }}>
            <span style={{ width:8, height:8, borderRadius:999, background: checkStatus?.checkedIn && !checkStatus?.checkedOut ? 'var(--success)' : 'var(--danger)', display:'inline-block' }}></span>
            <span style={{ fontWeight:700, fontSize:13 }}>{checkStatus?.checkedIn && !checkStatus?.checkedOut ? `Checked in since ${formatSince()}` : checkStatus?.checkedOut ? 'Checked out today' : 'Not checked in'}</span>
            <button onClick={toggleCheck} className={`btn btn-primary btn-sm ${!checkStatus?.checkedOut && checkStatus?.checkedIn ? '' : 'checkin-pulse'}`} style={{ borderRadius:999, padding:'6px 14px', background: checkStatus?.checkedIn && !checkStatus?.checkedOut ? 'var(--neutral-900)' : 'var(--accent)' }}>
              {checkStatus?.checkedIn && !checkStatus?.checkedOut ? 'Check Out →' : 'Check In →'}
            </button>
          </div>
          {stats && (
            <div style={{ display:'flex', gap:8 }}>
              <span className="chip">👥 {stats.headcount} total</span>
              <span className="chip" style={{ background:'var(--success-light)', borderColor:'transparent' }}>🟢 {stats.presentToday} present</span>
              <span className="chip" style={{ background:'var(--warn-light)', borderColor:'transparent' }}>⏳ {stats.pendingLeaves} pending</span>
            </div>
          )}
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search employees..." className="input" style={{ width:260 }} />
          {user && ['ADMIN','HR'].includes(user.role) && <button className="btn btn-primary" onClick={()=> setShowNew(true)}>+ NEW</button>}
        </div>
      </div>

      {loading ? (
        <div className="grid-cards">{Array.from({length:8}).map((_,i)=> <div key={i} className="card" style={{ height:140 }}><div className="skeleton" style={{ height:48, width:48, borderRadius:999 }} /><div className="skeleton" style={{ height:14, marginTop:12 }} /><div className="skeleton" style={{ height:10, marginTop:8, width:'60%' }} /></div>)}</div>
      ) : employees.length===0 ? (
        <div style={{ textAlign:'center', padding:60, background:'white', borderRadius:16, border:'1px dashed var(--neutral-200)' }}>
          <div style={{ fontSize:28, marginBottom:8 }}>🫥</div><div style={{ fontWeight:700 }}>No employees found</div><div style={{ color:'var(--neutral-500)', fontSize:13, marginTop:4 }}>Try adjusting search or add a new employee.</div>
        </div>
      ) : (
        <div className="grid-cards">
          {employees.map((emp:any, idx:number)=>(
            <div key={emp.id} onClick={()=> nav(`/profile/${emp.id}`)} className="card hover-lift fade-up" style={{ cursor:'pointer', position:'relative', overflow:'hidden', animationDelay: `${idx*60}ms` }}>
              <div style={{ position:'absolute', top:12, right:12, width:12, height:12, borderRadius:999, background: emp.presence==='present' ? 'var(--success)' : emp.presence==='on_leave' ? '#0EA5E9' : '#F59E0B', border:'2px solid white', boxShadow:'0 0 0 2px rgba(0,0,0,0.06)' }} title={emp.presence} />
              {emp.presence==='on_leave' && <span style={{ position:'absolute', top:10, right:28, fontSize:11 }}>✈️</span>}
              <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                <img src={emp.photo_url || `https://i.pravatar.cc/100?u=${emp.id}`} alt="" style={{ width:56, height:56, borderRadius:999, objectFit:'cover', background:'var(--neutral-100)' }} />
                <div>
                  <div style={{ fontWeight:700, fontSize:14 }}>{emp.name}</div>
                  <div style={{ fontSize:12, color:'var(--neutral-500)' }}>{emp.designation || emp.departmentName || '—'}</div>
                  <div style={{ fontSize:11, color:'var(--neutral-400)', marginTop:2 }}>{emp.login_id}</div>
                </div>
              </div>
              <div style={{ display:'flex', gap:6, marginTop:12, flexWrap:'wrap' }}>
                <span className="badge badge-neutral">{emp.departmentName||'General'}</span>
                {emp.todayCheckIn && <span className="badge badge-success">Checked in {emp.todayCheckIn.slice(11,16)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <div className="modal-backdrop" onClick={()=> setShowNew(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{ width:560 }}>
            <h3 style={{ marginTop:0 }}>Add Employee</h3>
            <p style={{ fontSize:13, color:'var(--neutral-500)', marginTop:4 }}>Login ID & temp password auto-generated & emailed.</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:16 }}>
              <div><label className="label">First Name</label><input className="input" value={newForm.firstName} onChange={e=> setNewForm({...newForm, firstName:e.target.value})} /></div>
              <div><label className="label">Last Name</label><input className="input" value={newForm.lastName} onChange={e=> setNewForm({...newForm, lastName:e.target.value})} /></div>
              <div style={{ gridColumn:'span 2' }}><label className="label">Email</label><input className="input" value={newForm.email} onChange={e=> setNewForm({...newForm, email:e.target.value})} /></div>
              <div><label className="label">Department</label>
                <select className="input" value={newForm.departmentId} onChange={e=> setNewForm({...newForm, departmentId:e.target.value})}>
                  <option value="">Select</option>{departments.map((d:any)=> <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div><label className="label">Role</label>
                <select className="input" value={newForm.role} onChange={e=> setNewForm({...newForm, role:e.target.value})}>
                  <option value="EMPLOYEE">Employee</option><option value="MANAGER">Manager</option>{user?.role==='ADMIN' && <option value="HR">HR</option>}
                </select>
              </div>
              <div><label className="label">Designation</label><input className="input" value={newForm.designation} onChange={e=> setNewForm({...newForm, designation:e.target.value})} /></div>
              <div><label className="label">Date of Joining</label><input type="date" className="input" value={newForm.dateOfJoining} onChange={e=> setNewForm({...newForm, dateOfJoining:e.target.value})} /></div>
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:20 }}>
              <button className="btn btn-ghost" onClick={()=> setShowNew(false)}>Discard</button>
              <button className="btn btn-primary" onClick={async()=>{
                try{
                  const r=await api('/api/auth/employees',{method:'POST', body:JSON.stringify(newForm)});
                  alert(`Created ${r.data.loginId} — temp password: ${r.data.tempPassword}`);
                  setShowNew(false); load();
                }catch(e:any){ alert(e.message); }
              }}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
