import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { AppLoader } from '../App';
import { api } from '../utils/api';

const HINTS: Record<string, string> = {
  unauthorized_scope_error: 'The LinkedIn app is missing a product. In the Developer Portal → Products, add "Sign In with LinkedIn using OpenID Connect" (for openid/profile/email) and "Share on LinkedIn" (for w_member_social), wait until both show as Added, then try again.',
  LINKEDIN_DENIED: 'You cancelled on the LinkedIn consent screen. Click "Try again" and choose Allow.',
  LINKEDIN_INVALID_STATE: 'The sign-in link expired (10-minute limit) or was reused. Start again from the LinkedIn tab.',
  LINKEDIN_ALREADY_LINKED: 'That LinkedIn account is already connected to another Dayflow user. Disconnect it there first.',
  LINKEDIN_PERMISSION: 'The LinkedIn app is missing a product. In the Developer Portal → Products, add "Sign In with LinkedIn using OpenID Connect" and "Share on LinkedIn".',
  LINKEDIN_API_ERROR: 'LinkedIn rejected the token exchange. Most often the Client Secret on the server is wrong or was regenerated — update LINKEDIN_CLIENT_SECRET and redeploy.',
  LINKEDIN_NOT_CONFIGURED: 'The API has no LinkedIn credentials configured.',
  DATABASE_UNAVAILABLE: 'The API could not reach the database.',
};

/** Landing route for the LinkedIn OAuth callback redirect. Success → profile tab; failure → persistent explanation. */
export default function LinkedInReturn() {
  const [q] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const { user, loading } = useAuth();
  const [retrying, setRetrying] = useState(false);
  const status = q.get('status'); const code = q.get('code') || 'LINKEDIN_CALLBACK_FAILED'; const message = (q.get('message') || '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'");

  useEffect(() => {
    if (loading || status !== 'connected') return;
    toast.success('LinkedIn connected');
    nav(user?.employeeId ? `/profile/${user.employeeId}?tab=linkedin` : '/directory', { replace: true });
  }, [loading, status]);

  if (loading || status === 'connected') return <AppLoader label="Finishing LinkedIn sign-in…" />;

  async function retry() {
    setRetrying(true);
    try { const r = await api('/api/linkedin/connect'); window.location.assign(r.data.url); }
    catch (e: any) { toast.error('Could not start LinkedIn sign-in', e.message); setRetrying(false); }
  }

  return (
    <div className="container" style={{ paddingTop: 48, paddingBottom: 40, maxWidth: 640 }}>
      <div className="card fade-up" style={{ padding: 28 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--danger-light)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20 }}>!</div>
          <div><h3 style={{ margin: 0 }}>LinkedIn connection failed</h3><div style={{ fontSize: 12, color: 'var(--neutral-500)', fontFamily: 'ui-monospace, Menlo, monospace' }}>{code}</div></div>
        </div>
        {message && <div style={{ background: 'var(--neutral-50)', border: '1px solid var(--neutral-200)', borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 12, wordBreak: 'break-word' }}>{message}</div>}
        <p style={{ fontSize: 13, color: 'var(--neutral-700)', margin: '0 0 18px', lineHeight: 1.5 }}>{HINTS[code] || 'Something went wrong while talking to LinkedIn. Try again; if it keeps failing, share this code with your administrator.'}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary btn-press" style={{ background: '#0A66C2' }} disabled={retrying} onClick={retry}>{retrying ? 'Redirecting…' : 'Try again'}</button>
          <Link className="btn btn-ghost" to={user?.employeeId ? `/profile/${user.employeeId}?tab=linkedin` : '/directory'}>Back to profile</Link>
        </div>
      </div>
    </div>
  );
}
