import { useAuth } from '../context/AuthContext';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import ThemeToggle from './ThemeToggle';
import MobileNav from './MobileNav';

export default function Header() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const [show, setShow] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [bump, setBump] = useState(false);

  useEffect(()=>{
    if(!user) return;
    api('/api/notifications').then((r:any)=>{ const c=r.data.filter((n:any)=>!n.is_read).length; setNotifCount(c); if(c>0){ setBump(true); setTimeout(()=>setBump(false),500);} }).catch(()=>{});
    return undefined;
  },[user]);


  if(!user) return null;
  const isActive = (p:string)=> loc.pathname.startsWith(p) ? 'active' : '';
  return (
    <div className="topnav">
      <div className="container topnav-inner">
        <div style={{ display:'flex', alignItems:'center', gap:24 }}>
          <Link to="/directory" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none', color:'inherit' }}>
            {user.companyLogo ? <img className="company-logo brand-mark" src={user.companyLogo} alt="" /> : <div className="brand-mark" style={{ width:32, height:32, borderRadius:8, background:'var(--accent)', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontFamily:'var(--font-display)' }}>D</div>}
            <span style={{ fontWeight:800, fontFamily:'var(--font-display)', letterSpacing:'-0.02em' }}>{user.companyLogo ? user.companyName : 'Dayflow'}</span>
            {!user.companyLogo && <span className="desktop-only" style={{ fontSize:12, color:'var(--neutral-400)', fontWeight:600 }}>{user.companyName || ''}</span>}
          </Link>
          <nav className="nav-links">
            <Link className={isActive('/directory')} to="/directory">Employees</Link>
            <Link className={isActive('/attendance')} to="/attendance">Attendance</Link>
            <Link className={isActive('/leave')} to="/leave">Time Off</Link>
            {['ADMIN','HR','MANAGER'].includes(user.role) && <Link className={isActive('/team')} to="/team">Team</Link>}
            {['ADMIN','HR'].includes(user.role) && <Link className={isActive('/dashboard')} to="/dashboard">Dashboard</Link>}
            {['ADMIN','HR'].includes(user.role) && <Link className={isActive('/reports')} to="/reports">Reports</Link>}
            {['ADMIN','HR'].includes(user.role) && <Link className={isActive('/payroll')} to="/payroll">Payroll</Link>}
            {user.role==='ADMIN' && <Link className={isActive('/settings')} to="/settings">Settings</Link>}
          </nav>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button className="desktop-only" onClick={()=> window.dispatchEvent(new Event('dayflow:palette'))} aria-label="Open command palette" style={{ display:'flex', alignItems:'center', gap:8, width:220, padding:'8px 12px', borderRadius:999, border:'1px solid var(--hairline)', background:'var(--card)', fontSize:13, color:'var(--neutral-400)', cursor:'pointer', textAlign:'left' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            <span style={{ flex:1 }}>{['ADMIN','HR','MANAGER'].includes(user.role) ? 'Search people or commands' : 'Commands'}</span><kbd className="kbd">⌘K</kbd>
          </button>
          <ThemeToggle />
          <button className="icon-btn" aria-label="Notifications" onClick={()=> nav('/notifications')} style={{ position:'relative', background:'var(--card)', border:'1px solid var(--hairline)', width:36, height:36, borderRadius:999, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color:'var(--neutral-700)' }}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>{notifCount>0 && <span className={bump?'pop':''} style={{ position:'absolute', top:-2, right:-2, background:'var(--danger)', color:'white', fontSize:10, fontWeight:800, width:18, height:18, borderRadius:999, display:'flex', alignItems:'center', justifyContent:'center' }}>{notifCount}</span>}
          </button>
          <MobileNav />
          <div style={{ position:'relative' }}>
            <button onClick={()=> setShow(v=>!v)} style={{ display:'flex', alignItems:'center', gap:8, background:'transparent', border:'none', cursor:'pointer' }}>
              {user.photo_url ? <img className="avatar" src={user.photo_url} alt="" /> : <div className="avatar">{user.name?.slice(0,1) || user.email.slice(0,1).toUpperCase()}</div>}
            </button>
            {show && (
              <div className="dropdown" style={{ position:'absolute', right:0, top:44, width:200, background:'var(--card)', borderRadius:12, boxShadow:'var(--shadow-lg)', border:'1px solid var(--hairline)', overflow:'hidden', zIndex:30 }}>
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
