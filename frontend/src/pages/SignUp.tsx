import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import AuthHero from '../components/AuthHero';
import PasswordInput from '../components/PasswordInput';

export default function SignUp(){
  const { signup } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ companyName:'', name:'', email:'', password:'', confirmPassword:'' });
  const [err, setErr] = useState('');
  const [logoPreview, setLogoPreview] = useState<string|null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e:any){
    e.preventDefault(); setErr('');
    if(form.password !== form.confirmPassword) return setErr('Passwords do not match');
    setLoading(true);
    try{ await signup({ ...form, logoUrl: logoPreview }); nav('/directory'); }catch(e:any){ setErr(e.message); } finally{ setLoading(false); }
  }

  return (
    <div className="auth-shell">
      <AuthHero />
      <div className="auth-form">
      <div className="auth-card fade-up" style={{ '--i': 2, width:'min(480px,100%)' } as any}>
        <h2 style={{ margin:'0 0 4px', fontSize:24 }}>Create your company</h2>
        <p style={{ color:'var(--neutral-500)', fontSize:13, margin:'0 0 18px' }}>Sign up registers your Company + first Admin — employees are invited by you.</p>
        {err && <div className="fade-up" role="alert" style={{ background:'var(--danger-light)', color:'var(--danger)', padding:'10px 12px', borderRadius:8, fontSize:13, marginBottom:16 }}>{err}</div>}
        <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:16, padding:'12px', border:'1px dashed var(--neutral-200)', borderRadius:12, background:'var(--neutral-50)' }}>
            <div style={{ width:56, height:56, borderRadius:12, background:'var(--card)', border:'1px solid var(--hairline)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
              {logoPreview ? <img src={logoPreview} alt="logo" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <span style={{ fontSize:20 }}>⬆</span>}
            </div>
            <div>
              <label className="btn btn-ghost btn-sm" style={{ cursor:'pointer' }}>
                Upload Logo
                <input type="file" accept="image/*" hidden onChange={e=>{ const f=e.target.files?.[0]; if(f){ const r=new FileReader(); r.onload=()=> setLogoPreview(r.result as string); r.readAsDataURL(f);} }} />
              </label>
              <div style={{ fontSize:11, color:'var(--neutral-500)', marginTop:4 }}>PNG/JPG up to 5MB</div>
            </div>
          </div>
          <div><label className="label">Company Name</label><input className="input" value={form.companyName} onChange={e=>setForm({...form, companyName:e.target.value})} placeholder="Odoo India" required /></div>
          <div><label className="label">Your Name</label><input className="input" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} placeholder="Arjun Mehta" required /></div>
          <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} placeholder="admin@company.com" required /></div>
          <div>
            <label className="label">Password</label>
            <PasswordInput value={form.password} onChange={v=> setForm({...form, password:v})} placeholder="Min 8 chars, upper/lower/digit" autoComplete="new-password" meter />
          </div>
          <div><label className="label">Confirm Password</label><PasswordInput value={form.confirmPassword} onChange={v=> setForm({...form, confirmPassword:v})} autoComplete="new-password" /></div>
          <button className="btn btn-primary btn-press" disabled={loading} style={{ width:'100%', justifyContent:'center', marginTop:8 }}>{loading?'Creating…':'Sign Up'}</button>
        </form>
        <p style={{ textAlign:'center', fontSize:13, marginTop:16, color:'var(--neutral-500)' }}>Already have an account? <Link to="/signin" style={{ color:'var(--accent)', fontWeight:700, textDecoration:'none' }}>Sign in</Link></p>
      </div>
      </div>
    </div>
  );
}
