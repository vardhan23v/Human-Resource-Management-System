import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { useToast } from './Toast';
import Skeleton from './Skeleton';

type Status = { configured: boolean; connected: boolean; profile: null | {
  memberId: string; urn: string; name?: string; firstName?: string; lastName?: string; picture?: string; email?: string;
  scopes: string[]; canPost: boolean; profileUrl: string | null; connectedAt: string; expiresAt: string; expired: boolean;
} };

export const LinkedInLogo = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg>
);

/** LinkedIn connection + composer. Tokens never reach this component — only the safe status payload. */
export default function LinkedInCard() {
  const toast = useToast();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [posting, setPosting] = useState(false);
  const [lastPost, setLastPost] = useState<{ url: string | null } | null>(null);

  async function load() {
    try { const r = await api('/api/linkedin/status'); setStatus(r.data); }
    catch (e: any) { toast.error('Could not load LinkedIn status', e.message); setStatus({ configured: false, connected: false, profile: null }); }
  }
  useEffect(() => { load(); }, []);

  async function connect() {
    setBusy(true);
    try { const r = await api('/api/linkedin/connect'); window.location.assign(r.data.url); }
    catch (e: any) { toast.error('Could not start LinkedIn sign-in', e.message); setBusy(false); }
  }
  async function disconnect() {
    if (!confirm('Disconnect LinkedIn? Stored credentials will be removed.')) return;
    setBusy(true);
    try { await api('/api/linkedin/disconnect', { method: 'POST' }); toast.success('LinkedIn disconnected'); setLastPost(null); await load(); }
    catch (e: any) { toast.error('Could not disconnect', e.message); }
    finally { setBusy(false); }
  }
  async function publish(e: React.FormEvent) {
    e.preventDefault();
    setPosting(true);
    try {
      const r = await api('/api/linkedin/posts', { method: 'POST', body: JSON.stringify({ text, url: url || undefined, title: title || undefined }) });
      setLastPost(r.data); setText(''); setUrl(''); setTitle('');
      toast.success('Posted to LinkedIn', r.data.url ? 'Open it from the link below.' : undefined);
    } catch (e: any) { toast.error('Could not post to LinkedIn', e.message); }
    finally { setPosting(false); }
  }

  if (!status) return <div className="card"><Skeleton lines={3} /></div>;

  if (!status.configured) return (
    <div className="card fade-up" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
      <span style={{ color: '#0A66C2' }}><LinkedInLogo size={28} /></span>
      <div><div style={{ fontWeight: 700 }}>LinkedIn integration is not configured</div>
        <div style={{ fontSize: 13, color: 'var(--neutral-500)' }}>An administrator needs to set <code>LINKEDIN_CLIENT_ID</code> / <code>LINKEDIN_CLIENT_SECRET</code> on the API.</div></div>
    </div>
  );

  if (!status.connected || !status.profile) return (
    <div className="card fade-up" style={{ display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: '#0A66C2', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LinkedInLogo size={22} /></div>
        <div><div style={{ fontWeight: 700 }}>Connect LinkedIn</div>
          <div style={{ fontSize: 13, color: 'var(--neutral-500)' }}>Show your LinkedIn profile here and share updates from Dayflow.</div></div>
      </div>
      <button className="btn btn-primary btn-press" style={{ background: '#0A66C2' }} disabled={busy} onClick={connect}><LinkedInLogo /> {busy ? 'Redirecting…' : 'Connect LinkedIn'}</button>
    </div>
  );

  const p = status.profile;
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="card fade-up" style={{ '--i': 1 } as any}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          {p.picture ? <img src={p.picture} alt="" style={{ width: 64, height: 64, borderRadius: 999, objectFit: 'cover' }} referrerPolicy="no-referrer" />
            : <div className="avatar" style={{ width: 64, height: 64, fontSize: 22 }}>{(p.firstName || p.name || '?').slice(0, 1)}</div>}
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 800, fontSize: 18, fontFamily: 'var(--font-display)' }}>{p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim()}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
              <span className={`badge ${p.expired ? 'badge-warn' : 'badge-success'}`}>{p.expired ? 'Connection expired' : 'Connected to LinkedIn'}</span>
              {p.email && <span style={{ fontSize: 12, color: 'var(--neutral-500)' }}>{p.email}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {p.expired && <button className="btn btn-primary btn-sm btn-press" style={{ background: '#0A66C2' }} disabled={busy} onClick={connect}>Reconnect</button>}
            <a className="btn btn-ghost btn-sm" href="https://www.linkedin.com/in/me/" target="_blank" rel="noreferrer">View on LinkedIn ↗</a>
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={disconnect} style={{ color: 'var(--danger)' }}>Disconnect</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 16, fontSize: 13 }}>
          <Field label="First name" value={p.firstName} />
          <Field label="Last name" value={p.lastName} />
          <Field label="Member URN" value={p.urn} mono />
          <Field label="Public profile URL" value={p.profileUrl || 'Not provided by LinkedIn for this app'} muted={!p.profileUrl} />
          <Field label="Permissions" value={p.scopes.join(', ')} mono />
          <Field label="Token expires" value={new Date(p.expiresAt).toLocaleDateString()} />
        </div>
      </div>

      <form className="card fade-up" style={{ '--i': 2 } as any} onSubmit={publish}>
        <h4 style={{ margin: '0 0 4px' }}>Create LinkedIn post</h4>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--neutral-500)' }}>Published as <b>{p.name}</b> to your main feed. Text and an optional article link are supported; image posts aren't enabled for this app.</p>
        <textarea className="input" rows={5} maxLength={3000} value={text} onChange={e => setText(e.target.value)} placeholder="What do you want to share?" required style={{ resize: 'vertical', fontFamily: 'inherit' }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 11, color: 'var(--neutral-400)', marginTop: 4 }}>{text.length}/3000</div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginTop: 8 }}>
          <input className="input" type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="Optional article / project URL (https://…)" />
          <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Link title (optional)" maxLength={200} disabled={!url} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12, color: 'var(--neutral-500)' }}>
            {lastPost && (lastPost.url ? <a href={lastPost.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontWeight: 600 }}>View your last post ↗</a> : 'Last post published.')}
          </div>
          <button className="btn btn-primary btn-press" style={{ background: '#0A66C2' }} disabled={posting || !p.canPost || !text.trim()}><LinkedInLogo /> {posting ? 'Posting…' : 'Post to LinkedIn'}</button>
        </div>
        {!p.canPost && <div style={{ marginTop: 10, fontSize: 12, color: '#92400E', background: 'var(--warn-light)', padding: '8px 10px', borderRadius: 8 }}>Posting needs an active connection with the <code>w_member_social</code> permission — reconnect to grant it.</div>}
      </form>
    </div>
  );
}

function Field({ label, value, mono, muted }: { label: string; value?: string | null; mono?: boolean; muted?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-500)' }}>{label}</div>
      <div style={{ marginTop: 2, fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined, fontSize: mono ? 12 : 13, color: muted ? 'var(--neutral-400)' : 'inherit', wordBreak: 'break-all' }}>{value || '—'}</div>
    </div>
  );
}
