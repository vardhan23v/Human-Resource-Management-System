import { useAuth } from '../context/AuthContext';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../utils/api';

export default function Header() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const [show, setShow] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [notifCount, setNotifCount] = useState(0);
  const [bump, setBump] = useState(false);

  useEffect(()=>{
    if(!user) return;
    api('/api/notifications').then((r:any)=>{ const c=r.data.filter((n:any)=>!n.is_read).length; setNotifCount(c); if(c>0){ setBump(true); setTimeout(()=>setBump(false),500);} }).catch(()=>{});
    const onKey = (e:KeyboardEvent)=>{ if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); (document.getElementById('global-search') as any)?.focus(); } };
    window.addEventListener('keydown', onKey); return ()=> window.removeEventListener('keydown', onKey);
  },[user]);

  useEffect(()=>{
    if(q.length<2 || !user || !['ADMIN','HR'].includes(user.role)) { setResults([]); return; }
    const t=setTimeout(async()=>{
      try{ const r=await api(`/api/employees?search=${encodeURIComponent(q)}&limit=5`); setResults(r.data||[]);}catch{}
    },300);
    return ()=> clearTimeout(t);
  },[q, user]);

  if(!user) return null;
  const isActive = (p:string)=> loc.pathname.startsWith(p) ? 'active' : '';
  return (
    <div className="topnav">
      <div className="container topnav-inner">
        <div style={{ display:'flex', alignItems:'center', gap:24 }}>
          <Link to="/directory" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none', color:'inherit' }}>
            <div className="brand-mark" style={{ width:32, height:32, borderRadius:8, background:'var(--accent)', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontFamily:'var(--font-display)' }}>D</div>
            <span style={{ fontWeight:800, fontFamily:'var(--font-display)', letterSpacing:'-0.02em' }}>Dayflow</span>
            <span style={{ fontSize:12, color:'var(--neutral-400)', fontWeight:600 }}>{user.companyName || ''}</span>
          </Link>
          <nav className="nav-links">
            <Link className={isActive('/directory')} to="/directory">Employees</Link>
            <Link className={isActive('/attendance')} to="/attendance">Attendance</Link>
            <Link className={isActive('/leave')} to="/leave">Time Off</Link>
            {['ADMIN','HR'].includes(user.role) && <Link className={isActive('/dashboard')} to="/dashboard">Dashboard</Link>}
            {['ADMIN','HR'].includes(user.role) && <Link className={isActive('/payroll')} to="/payroll">Payroll</Link>}
            {user.role==='ADMIN' && <Link className={isActive('/settings')} to="/settings">Settings</Link>}
          </nav>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {['ADMIN','HR'].includes(user.role) && (
            <div style={{ position:'relative' }}>
              <input id="global-search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search ⌘K" style={{ width:220, padding:'8px 12px 8px 32px', borderRadius:999, border:'1px solid var(--neutral-200)', background:'white', fontSize:13, outline:'none' }} />
              <span style={{ position:'absolute', left:10, top:9, color:'var(--neutral-400)', fontSize:12 }}>⌘K</span>
              {results.length>0 && (
                <div className="dropdown" style={{ position:'absolute', top:40, left:0, right:0, background:'white', borderRadius:12, boxShadow:'var(--shadow-lg)', border:'1px solid var(--neutral-200)', overflow:'hidden', zIndex:30 }}>
                  {results.map((r:any)=>(
                    <div key={r.id} className="search-hit" onClick={()=>{ nav(`/profile/${r.id}`); setQ(''); setResults([]); }} style={{ padding:'10px 12px', display:'flex', alignItems:'center', gap:10, cursor:'pointer', borderBottom:'1px solid var(--neutral-100)' }}>
                      <div className="avatar" style={{ width:28, height:28, fontSize:12 }}>{r.name?.slice(0,1)}</div>
                      <div><div style={{ fontWeight:600, fontSize:13 }}>{r.name}</div><div style={{ fontSize:11, color:'var(--neutral-500)' }}>{r.designation||r.departmentName}</div></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <button className="icon-btn" aria-label="Notifications" onClick={()=> nav('/notifications')} style={{ position:'relative', background:'white', border:'1px solid var(--neutral-200)', width:36, height:36, borderRadius:999, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color:'var(--neutral-700)' }}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>{notifCount>0 && <span className={bump?'pop':''} style={{ position:'absolute', top:-2, right:-2, background:'var(--danger)', color:'white', fontSize:10, fontWeight:800, width:18, height:18, borderRadius:999, display:'flex', alignItems:'center', justifyContent:'center' }}>{notifCount}</span>}
          </button>
          <div style={{ position:'relative' }}>
            <button onClick={()=> setShow(v=>!v)} style={{ display:'flex', alignItems:'center', gap:8, background:'transparent', border:'none', cursor:'pointer' }}>
              <div className="avatar">{user.name?.slice(0,1) || user.email.slice(0,1).toUpperCase()}</div>
            </button>
            {show && (
              <div className="dropdown" style={{ position:'absolute', right:0, top:44, width:200, background:'white', borderRadius:12, boxShadow:'var(--shadow-lg)', border:'1px solid var(--neutral-200)', overflow:'hidden', zIndex:30 }}>
                <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--neutral-100)' }}>
                  <div style={{ fontWeight:700, fontSize:13 }}>{user.name||user.email}</div>
                  <div style={{ fontSize:11, color:'var(--neutral-500)' }}>{user.loginId} • {user.role}</div>
                </div>
                <button onClick={()=>{ setShow(false); nav(`/profile/${user.employeeId}`); }} style={{ width:'100%', textAlign:'left', padding:'10px 14px', background:'transparent', border:'none', cursor:'pointer', fontSize:13 }}>My Profile</button>
                <button onClick={logout} style={{ width:'100%', textAlign:'left', padding:'10px 14px', background:'transparent', border:'none', cursor:'pointer', fontSize:13, color:'var(--danger)' }}>Log Out</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
