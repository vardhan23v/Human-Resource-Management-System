import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/** Hamburger drawer shown under 760px (the pill nav is hidden there). */
export default function MobileNav() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [loc.pathname]);
  useEffect(() => { const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false); document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey); }, []);
  if (!user) return null;
  const hr = ['ADMIN', 'HR'].includes(user.role);
  const links = [
    ['/directory', 'Employees'], ['/attendance', 'Attendance'], ['/leave', 'Time Off'],
    ...(['ADMIN', 'HR', 'MANAGER'].includes(user.role) ? [['/team', 'My Team']] : []),
    ...(hr ? [['/dashboard', 'Dashboard'], ['/reports', 'Reports'], ['/payroll', 'Payroll']] : [['/payroll', 'My Payslips']]),
    ['/notifications', 'Notifications'],
    ...(user.role === 'ADMIN' ? [['/settings', 'Settings']] : []),
  ];
  return (
    <>
      <button className="icon-btn mobile-only" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)} style={{ width: 36, height: 36, borderRadius: 999, border: '1px solid var(--neutral-200)', background: 'var(--card)', cursor: 'pointer', color: 'var(--neutral-700)' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
      </button>
      {open && (
        <div className="drawer-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <nav className="drawer" aria-label="Main menu">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <b style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>Dayflow</b>
              <button aria-label="Close menu" onClick={() => setOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: 18, cursor: 'pointer', color: 'inherit' }}>✕</button>
            </div>
            {links.map(([to, label]) => <Link key={to} to={to} className={`drawer-link ${loc.pathname.startsWith(to) ? 'active' : ''}`}>{label}</Link>)}
            <Link to={`/profile/${user.employeeId}`} className="drawer-link">My profile</Link>
            <button className="drawer-link" onClick={logout} style={{ color: 'var(--danger)', textAlign: 'left', background: 'transparent', border: 'none', font: 'inherit', cursor: 'pointer' }}>Log out</button>
          </nav>
        </div>
      )}
    </>
  );
}
