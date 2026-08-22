import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function Profile(){
  const { id } = useParams();
  const { user } = useAuth();
  const [emp, setEmp] = useState<any>(null);
  const [tab, setTab] = useState<'resume'|'private'|'salary'|'security'>('resume');
  const [edit, setEdit] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [salary, setSalary] = useState<any>(null);
  const [newSkill, setNewSkill] = useState('');
  const [wage, setWage] = useState(50000);

  async function load(){
    try{
      const r=await api(`/api/employees/${id}`);
      setEmp(r.data);
      setEdit({ phone: r.data.phone||'', address: r.data.address||'', about: r.data.about||'', what_i_love: r.data.what_i_love||'', interests: r.data.interests||'', personal_email: r.data.personal_email||'', location: r.data.location||'' });
      if(r.data.salaryStructure){
        setSalary(r.data.salaryStructure);
        setWage(Number(r.data.salaryStructure.monthly_wage));
      } else {
        // try fetch payroll salary
        try{ const s=await api(`/api/payroll/salary/${id}`); if(s.data){ setSalary(s.data); setWage(Number(s.data.monthly_wage)); } }catch{}
      }
    }catch(e:any){ alert(e.message); }
  }
  useEffect(()=>{ load(); },[id]);

  if(!emp) return <div className="container" style={{ paddingTop:40 }}><div className="skeleton" style={{ height:200 }} /></div>;

  const isOwn = user?.employeeId===id;
  const canViewSalary = (user && (['ADMIN','HR'].includes(user.role) || isOwn)) && tab==='salary';
  const canEdit = user && (['ADMIN','HR'].includes(user.role) || isOwn);

  async function save(){
    setSaving(true);
    try{
      await api(`/api/employees/${id}`, { method:'PATCH', body: JSON.stringify(edit) });
      await load(); alert('Saved');
    }catch(e:any){ alert(e.message); } finally{ setSaving(false); }
  }

  // salary calc preview
  const preview = (()=> {
    const monthly=wage;
    const basic=monthly*0.5, hra=basic*0.5, std=4167, bonus=basic*0.0833, lta=basic*0.0833, fixed=Math.max(0, monthly-(basic+hra+std+bonus+lta));
    return [
      { name:'Basic Salary', amount: basic, rule:'50% of wage', pct:'50%' },
      { name:'House Rent Allowance', amount: hra, rule:'50% of Basic', pct:'50%' },
      { name:'Standard Allowance', amount: std, rule:'Fixed', pct:'16.67%' },
      { name:'Performance Bonus', amount: bonus, rule:'8.33% of Basic', pct:'8.33%' },
      { name:'Leave Travel Allowance', amount: lta, rule:'8.33% of Basic', pct:'8.33%' },
      { name:'Fixed Allowance', amount: fixed, rule:'Remainder', pct: ((fixed/monthly)*100).toFixed(2)+'%' },
    ];
  })();
  const pfEmp = wage*0.5*0.12, pfEmpr = pfEmp, pt=200;

  return (
    <div className="container" style={{ paddingTop:24, paddingBottom:40 }}>
      <div className="card" style={{ display:'flex', gap:20, alignItems:'center', padding:20 }}>
        <div style={{ position:'relative' }}>
          <img src={emp.photo_url || `https://i.pravatar.cc/200?u=${emp.id}`} style={{ width:88, height:88, borderRadius:999, objectFit:'cover' }} alt="" />
          {canEdit && <button style={{ position:'absolute', bottom:0, right:0, width:28, height:28, borderRadius:999, background:'var(--accent)', color:'white', border:'2px solid white', cursor:'pointer' }}>✏️</button>}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <h2 style={{ margin:0 }}>{emp.name}</h2>
            <span className="badge badge-success">{emp.lifecycle_state}</span>
          </div>
          <div style={{ display:'flex', gap:18, marginTop:6, fontSize:13, color:'var(--neutral-500)', flexWrap:'wrap' }}>
            <span>{emp.login_id}</span><span>•</span><span>{emp.email}</span><span>•</span><span>{emp.phone||'—'}</span>
          </div>
        </div>
        <div style={{ textAlign:'right', fontSize:13, color:'var(--neutral-700)', minWidth:180 }}>
          <div><strong>Company</strong> {emp.companyName}</div>
          <div><strong>Department</strong> {emp.departmentName||'—'}</div>
          <div><strong>Manager</strong> {emp.managerName||'—'}</div>
          <div><strong>Location</strong> {emp.location||'—'}</div>
        </div>
      </div>

      <div style={{ marginTop:16, display:'flex', gap:8 }} className="tabs">
        {(['resume','private','salary','security'] as const).map(t=>(
          <button key={t} className={`tab ${tab===t?'active':''}`} onClick={()=> setTab(t)} style={{ textTransform:'capitalize' }}>{t==='resume'?'Resume':t==='private'?'Private Info':t==='salary'?'Salary Info':'Security'}</button>
        ))}
      </div>

      {tab==='resume' && (
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16, marginTop:16 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {[
              { key:'about', title:'About', placeholder:'Tell us about yourself' },
              { key:'what_i_love', title:'What I love about my job', placeholder:'Share what excites you' },
              { key:'interests', title:'My interests and hobbies', placeholder:'Your hobbies & interests' },
            ].map(block=>(
              <div key={block.key} className="card">
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}><h4 style={{ margin:0 }}>{block.title}</h4>{canEdit && <button onClick={save} className="btn btn-ghost btn-sm">✏️</button>}</div>
                {edit && <textarea className="input" value={edit[block.key]} onChange={e=> setEdit({...edit, [block.key]:e.target.value})} placeholder={block.placeholder} rows={3} style={{ marginTop:10 }} />}
              </div>
            ))}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div className="card">
              <div style={{ display:'flex', justifyContent:'space-between' }}><h4 style={{ margin:0 }}>Skills</h4><button className="btn btn-ghost btn-sm" onClick={async()=>{ if(!newSkill) return; await api(`/api/employees/${id}/skills`,{method:'POST', body:JSON.stringify({name:newSkill})}); setNewSkill(''); load(); }}>+ Add</button></div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:12 }}>
                {(emp.skills||[]).map((s:any)=> <span key={s.id} className="chip">{s.name} <button onClick={async()=>{ await api(`/api/employees/${id}/skills/${s.id}`,{method:'DELETE'}); load(); }} style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--neutral-400)' }}>×</button></span>)}
                {(!emp.skills||emp.skills.length===0) && <span style={{ fontSize:13, color:'var(--neutral-400)' }}>No skills yet</span>}
              </div>
              <input className="input" value={newSkill} onChange={e=> setNewSkill(e.target.value)} placeholder="Add a skill" style={{ marginTop:10 }} />
            </div>
            <div className="card">
              <h4 style={{ margin:'0 0 10px' }}>Certification</h4>
              {(emp.certifications||[]).map((c:any)=> <div key={c.id} style={{ padding:'8px 10px', background:'var(--neutral-50)', borderRadius:8, marginBottom:6, fontSize:13 }}>{c.title} <span style={{ color:'var(--neutral-500)' }}>{c.issuer?`• ${c.issuer}`:''}</span></div>)}
              <button className="btn btn-ghost btn-sm" onClick={async()=>{ const title=prompt('Certification title'); if(title){ await api(`/api/employees/${id}/certifications`,{method:'POST', body:JSON.stringify({title})}); load(); } }}>+ Add Certification</button>
            </div>
          </div>
        </div>
      )}

      {tab==='private' && (
        <div className="card" style={{ marginTop:16 }}>
          <h3 style={{ marginTop:0 }}>Private Info</h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <div><label className="label">Date of Birth</label><input className="input" type="date" value={emp.dob?.slice(0,10)||''} onChange={e=> setEdit({...edit, dob:e.target.value})} disabled={!canEdit} /></div>
            <div><label className="label">Gender</label><select className="input" value={emp.gender||''} disabled><option>{emp.gender||'—'}</option></select></div>
            <div style={{ gridColumn:'span 2' }}><label className="label">Residing Address</label><textarea className="input" value={edit.address} onChange={e=> setEdit({...edit, address:e.target.value})} rows={2} /></div>
            <div><label className="label">Personal Email</label><input className="input" value={edit.personal_email} onChange={e=> setEdit({...edit, personal_email:e.target.value})} /></div>
            <div><label className="label">Nationality</label><input className="input" value={emp.nationality||''} disabled /></div>
            <div><label className="label">Marital Status</label><input className="input" value={emp.marital_status||''} disabled /></div>
            <div><label className="label">Date of Joining</label><input className="input" value={emp.date_of_joining?.slice(0,10)||''} disabled /></div>
          </div>
          <h4 style={{ marginTop:20 }}>Bank Details</h4>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, background:'var(--neutral-50)', padding:16, borderRadius:12 }}>
            <div><label className="label">Account Number</label><input className="input" value={emp.bank_account_enc||''} disabled={true} placeholder="Encrypted" /></div>
            <div><label className="label">Bank Name</label><input className="input" value={emp.bank_name||''} disabled /></div>
            <div><label className="label">IFSC Code</label><input className="input" value={emp.ifsc_code||''} disabled /></div>
            <div><label className="label">PAN No</label><input className="input" value={emp.pan_no||''} disabled /></div>
            <div><label className="label">UAN No</label><input className="input" value={emp.uan_no||''} disabled /></div>
            <div><label className="label">Emp Code</label><input className="input" value={emp.emp_code||''} disabled /></div>
          </div>
          <div style={{ marginTop:16, display:'flex', justifyContent:'flex-end' }}>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Saving…':'Save changes'}</button>
          </div>
        </div>
      )}

      {tab==='salary' && (
        <div className="card" style={{ marginTop:16 }}>
          {user && ['ADMIN','HR'].includes(user.role) || isOwn ? (
            <>
              <h3 style={{ marginTop:0 }}>Salary Info</h3>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:16 }}>
                <div><label className="label">Month Wage (₹)</label><input className="input" type="number" value={wage} onChange={e=> setWage(Number(e.target.value))} /></div>
                <div><label className="label">Yearly Wage (₹)</label><input className="input" value={wage*12} disabled /></div>
                <div><label className="label">Wage Type</label><input className="input" value="Fixed wage" disabled /></div>
              </div>
              <div style={{ display:'flex', gap:12, fontSize:13, marginBottom:12 }}>
                <span>No. of working days / week: <strong>5</strong></span><span>Break Time: <strong>1 hr</strong></span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Component</th><th>Rule</th><th>Amount (₹/mo)</th></tr></thead>
                  <tbody>
                    {preview.map(c=> (
                      <tr key={c.name}><td>{c.name}</td><td>{c.rule} {c.pct}</td><td>₹{c.amount.toFixed(2)}</td></tr>
                    ))}
                    <tr style={{ fontWeight:700, background:'var(--accent-weak)' }}><td>Total</td><td>Must not exceed wage</td><td>₹{preview.reduce((s,c)=>s+c.amount,0).toFixed(2)} / ₹{wage.toFixed(2)}</td></tr>
                  </tbody>
                </table>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginTop:16 }}>
                <div className="card" style={{ background:'var(--neutral-50)' }}><strong>Provident Fund</strong><div style={{ fontSize:13, marginTop:6 }}>Employee 12% of Basic: ₹{pfEmp.toFixed(2)} + Employer 12%: ₹{pfEmpr.toFixed(2)}</div></div>
                <div className="card" style={{ background:'var(--neutral-50)' }}><strong>Tax Deductions</strong><div style={{ fontSize:13, marginTop:6 }}>Professional Tax: ₹{pt}/month deducted from gross</div></div>
              </div>
              {user && ['ADMIN','HR'].includes(user.role) && (
                <div style={{ display:'flex', justifyContent:'flex-end', marginTop:16 }}>
                  <button className="btn btn-primary" onClick={async()=>{
                    try{ await api('/api/payroll/salary',{method:'POST', body:JSON.stringify({ employeeId:id, monthlyWage:wage, yearlyWage:wage*12 })}); alert('Salary structure updated'); load(); }catch(e:any){ alert(e.message); }
                  }}>Save Salary Structure</button>
                </div>
              )}
            </>
          ) : <div style={{ padding:20, textAlign:'center', color:'var(--neutral-500)' }}>You don't have permission to view salary</div>}
        </div>
      )}

      {tab==='security' && (
        <div className="card" style={{ marginTop:16, maxWidth:480 }}>
          <h3 style={{ marginTop:0 }}>Security</h3>
          <ChangePassword />
        </div>
      )}
    </div>
  );
}

function ChangePassword(){
  const [cur, setCur]=useState(''), [nxt,setNxt]=useState(''), [msg,setMsg]=useState('');
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div><label className="label">Current Password</label><input type="password" className="input" value={cur} onChange={e=>setCur(e.target.value)} /></div>
      <div><label className="label">New Password</label><input type="password" className="input" value={nxt} onChange={e=>setNxt(e.target.value)} /></div>
      {msg && <div style={{ fontSize:13, color: msg.includes('success')? 'var(--success)':'var(--danger)' }}>{msg}</div>}
      <button className="btn btn-primary" onClick={async()=>{
        try{ await api('/api/auth/change-password',{method:'POST', body:JSON.stringify({currentPassword:cur, newPassword:nxt})}); setMsg('Password changed successfully'); }catch(e:any){ setMsg(e.message); }
      }}>Change Password</button>
    </div>
  );
}
