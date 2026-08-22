import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
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

function Protected({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div style={{ padding:40, textAlign:'center' }}>Loading…</div>;
  if (!user) return <Navigate to="/signin" state={{ from: loc }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/directory" replace />;
  return <>{children}</>;
}

function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      {user && <Header />}
      {children}
    </div>
  );
}

export default function App(){
  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/directory" element={<Protected><Directory /></Protected>} />
            <Route path="/profile/:id" element={<Protected><Profile /></Protected>} />
            <Route path="/attendance" element={<Protected><Attendance /></Protected>} />
            <Route path="/leave" element={<Protected><Leave /></Protected>} />
            <Route path="/payroll" element={<Protected roles={['ADMIN','HR','MANAGER','EMPLOYEE']}><Payroll /></Protected>} />
            <Route path="/settings" element={<Protected roles={['ADMIN']}><Settings /></Protected>} />
            <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
            <Route path="/dashboard" element={<Protected roles={['ADMIN','HR']}><Dashboard /></Protected>} />
            <Route path="/" element={<Navigate to="/directory" replace />} />
            <Route path="*" element={<div style={{ padding:40, textAlign:'center' }}><h3>404 — Not found</h3><a href="/directory">Go home</a></div>} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  );
}
