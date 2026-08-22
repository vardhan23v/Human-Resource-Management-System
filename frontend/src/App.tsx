import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import CustomCursor from './components/CustomCursor';
import PageTransition from './components/PageTransition';
import Header from './components/Header';
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
import { useRipple } from './hooks/useRipple';

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

function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  useRipple();
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {user && <Header />}
      <PageTransition>{children}</PageTransition>
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
              <Route path="/signin" element={<SignIn />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/directory" element={<Protected><Directory /></Protected>} />
              <Route path="/profile/:id" element={<Protected><Profile /></Protected>} />
              <Route path="/attendance" element={<Protected><Attendance /></Protected>} />
              <Route path="/leave" element={<Protected><Leave /></Protected>} />
              <Route path="/payroll" element={<Protected roles={['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE']}><Payroll /></Protected>} />
              <Route path="/settings" element={<Protected roles={['ADMIN']}><Settings /></Protected>} />
              <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
              <Route path="/dashboard" element={<Protected roles={['ADMIN', 'HR']}><Dashboard /></Protected>} />
              <Route path="/" element={<Navigate to="/directory" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
