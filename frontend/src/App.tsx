import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import CustomCursor from './components/CustomCursor';
import PageTransition from './components/PageTransition';
import Header from './components/Header';
import Footer from './components/Footer';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import Directory from './pages/Directory';
import Profile from './pages/Profile';
import Attendance from './pages/Attendance';
import Leave from './pages/Leave';
import Payroll from './pages/Payroll';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';
import Dashboard from './pages/Dashboard';
import LinkedInReturn from './pages/LinkedInReturn';
import Reports from './pages/Reports';
import Team from './pages/Team';
import CommandPalette from './components/CommandPalette';
import ShortcutsHelp from './components/ShortcutsHelp';
import { useShortcuts } from './hooks/useShortcuts';
import { useToast } from './components/Toast';
import { api } from './utils/api';
import { useState, useCallback, useMemo } from 'react';
import { useRipple } from './hooks/useRipple';
import { useTheme } from './hooks/useTheme';
import ThemeToggle from './components/ThemeToggle';

export function AppLoader({ label = 'Loading your workspace…' }: { label?: string }) {
  return (
    <div className="app-loader">
      <div className="logo-pulse" style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 22, fontFamily: 'var(--font-display)' }}>D</div>
      <div style={{ fontSize: 13, color: 'var(--neutral-500)', fontWeight: 600 }}>{label}</div>
    </div>
  );
}

function Protected({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <AppLoader />;
  if (!user) return <Navigate to="/signin" state={{ from: loc }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/directory" replace />;
  return <>{children}</>;
}

/** Auth pages are for signed-out visitors; a signed-in user goes straight to the app. */
function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <AppLoader />;
  if (user) return <Navigate to="/directory" replace />;
  return <>{children}</>;
}

function NotFound() {
  return (
    <div className="container fade-up" style={{ padding: '80px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 72, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--accent-light)', lineHeight: 1 }}>404</div>
      <h3 style={{ margin: '12px 0 6px' }}>This page wandered off</h3>
      <p style={{ color: 'var(--neutral-500)', fontSize: 14, marginBottom: 20 }}>The link may be broken or the page may have moved.</p>
      <Link to="/directory" className="btn btn-primary btn-press">Go home</Link>
    </div>
  );
}

/** Keyboard shortcuts + help sheet; only active when signed in. */
function Shortcuts() {
  const { user } = useAuth(); const toast = useToast(); const { toggle } = useTheme();
  const [help, setHelp] = useState(false);
  const checkIn = useCallback(async () => { try { const t = await api('/api/attendance/today'); const open = t.data && t.data.check_in && !t.data.check_out; await api(open ? '/api/attendance/check-out' : '/api/attendance/check-in', { method: 'POST' }); toast.success(open ? 'Checked out' : 'Checked in'); } catch (e: any) { toast.error(e.message); } }, [toast]);
  const handlers = useMemo(() => ({ checkIn, theme: toggle, help: () => setHelp(true) }), [checkIn, toggle]);
  useShortcuts(handlers);
  if (!user) return null;
  return <ShortcutsHelp open={help} onClose={() => setHelp(false)} />;
}

function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  useRipple();
  useTheme();
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">Skip to content</a>
      {user && <Header />}
      {user && <CommandPalette />}
      <Shortcuts />
      {!user && <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 45 }}><ThemeToggle /></div>}
      <main id="main"><PageTransition>{children}</PageTransition></main>
      {user && <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <CustomCursor />
          <Layout>
            <Routes>
              <Route path="/signin" element={<PublicOnly><SignIn /></PublicOnly>} />
              <Route path="/signup" element={<PublicOnly><SignUp /></PublicOnly>} />
              <Route path="/directory" element={<Protected><Directory /></Protected>} />
              <Route path="/profile/:id" element={<Protected><Profile /></Protected>} />
              <Route path="/attendance" element={<Protected><Attendance /></Protected>} />
              <Route path="/leave" element={<Protected><Leave /></Protected>} />
              <Route path="/payroll" element={<Protected roles={['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE']}><Payroll /></Protected>} />
              <Route path="/settings" element={<Protected roles={['ADMIN']}><Settings /></Protected>} />
              <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
              <Route path="/dashboard" element={<Protected roles={['ADMIN', 'HR']}><Dashboard /></Protected>} />
              <Route path="/reports" element={<Protected roles={['ADMIN', 'HR', 'MANAGER']}><Reports /></Protected>} />
              <Route path="/team" element={<Protected roles={['ADMIN', 'HR', 'MANAGER']}><Team /></Protected>} />
              <Route path="/linkedin/return" element={<Protected><LinkedInReturn /></Protected>} />
              <Route path="/" element={<Navigate to="/directory" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
