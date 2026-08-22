import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import AuthHero from '../components/AuthHero';
import { useToast } from '../components/Toast';

export default function SignIn(){
  const { login } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  async function submit(e:any){
    e.preventDefault(); setErr(''); setLoading(true);
    try{ await login(identifier, password); nav('/directory'); }catch(e:any){ setErr(e.message); } finally{ setLoading(false); }
  }

  return (
    <div className="auth-shell">
      <AuthHero />
      <div className="auth-form">
      <div className="auth-card fade-up" style={{ '--i': 2 } as any}>
        <h2 style={{ margin:'0 0 6px', fontSize:24 }}>Welcome back 👋</h2>
        <p style={{ color:'var(--neutral-500)', fontSize:13, margin:'0 0 22px' }}>Sign in with your Login ID or Email</p>
        {err && <div className="fade-up" role="alert" style={{ background:'var(--danger-light)', color:'var(--danger)', padding:'10px 12px', borderRadius:8, fontSize:13, marginBottom:16 }}>{err}</div>}
        <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label className="label">Login ID / Email</label>
            <input className="input" value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder="OIJODO20220001 or email" required />
          </div>
          <div>
            <label className="label">Password</label>
            <div style={{ position:'relative' }}>
              <input className="input" type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required style={{ paddingRight:40 }} />
              <button type="button" onClick={()=> setShow(v=>!v)} style={{ position:'absolute', right:10, top:10, background:'transparent', border:'none', cursor:'pointer', color:'var(--neutral-500)' }}>{show?'🙈':'👁️'}</button>
            </div>
            <div style={{ textAlign:'right', marginTop:6 }}>
              <a href="#" onClick={e=>{e.preventDefault(); setForgot(true);}} style={{ fontSize:12, color:'var(--accent)', textDecoration:'none', fontWeight:600 }}>Forgot password?</a>
            </div>
          </div>
          <button className="btn btn-primary btn-press" disabled={loading} style={{ width:'100%', justifyContent:'center', marginTop:4 }}>{loading?'Signing in…':'Sign in'}</button>
        </form>
        <p style={{ textAlign:'center', fontSize:13, marginTop:18, color:'var(--neutral-500)' }}>Don't have an Account? <Link to="/signup" style={{ color:'var(--accent)', fontWeight:700, textDecoration:'none' }}>Sign Up</Link></p>
        <div style={{ marginTop:18, background:'var(--neutral-50)', borderRadius:10, padding:12, fontSize:12, color:'var(--neutral-500)' }}>
          <strong>Demo logins</strong> (Password123):<br/>Admin: admin@dayflow.local / OIARME20220001<br/>HR: hr@dayflow.local<br/>Employee: john.doe@dayflow.local
        </div>
        {forgot && (
          <div className="modal-backdrop" onClick={()=> setForgot(false)}>
            <div className="modal" onClick={e=>e.stopPropagation()}>
              <h3 style={{ marginTop:0 }}>Reset password</h3>
              <p style={{ fontSize:13, color:'var(--neutral-500)' }}>Enter your email — we'll send a reset link.</p>
              <input className="input" value={resetEmail} onChange={e=>setResetEmail(e.target.value)} placeholder="email" style={{ marginTop:12 }} />
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16 }}>
                <button className="btn btn-ghost" onClick={()=> setForgot(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={async()=>{ try{ const r=await api('/api/auth/forgot-password',{method:'POST', body:JSON.stringify({email:resetEmail})}); toast.success('Reset email sent', r.data.token? `Dev token: ${r.data.token}`: undefined); setForgot(false);}catch(e:any){toast.error('Could not send reset link', e.message);} }}>Send link</button>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
