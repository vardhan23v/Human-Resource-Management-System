import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { useReveal } from '../hooks/useReveal';
import PageHeader from '../components/PageHeader';
import { useToast } from '../components/Toast';

export default function Settings(){
  const toast = useToast();
  useReveal();
  const [settings, setSettings] = useState<any>(null);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [newHoliday, setNewHoliday] = useState({ date:'', name:'' });
  const [newType, setNewType] = useState({ name:'', code:'', annualQuota:12, carryForwardCap:0, isPaid:true });

  async function load(){
    const s=await api('/api/org-settings');
    setSettings(s.data);
    const h=await api('/api/holidays');
    setHolidays(h.data||[]);
    const t=await api('/api/leave/types');
    setTypes(t.data||[]);
  }
  useEffect(()=>{ load(); },[]);

  if(!settings) return <div className="container" style={{ paddingTop:24 }}><div className="skeleton" style={{ height:300 }} /></div>;

  return (
    <div className="container" style={{ paddingTop:24, paddingBottom:40 }}>
      <PageHeader title="Organisation settings" subtitle="Work hours, holidays and leave policies for your company." />
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div className="card fade-up" style={{ '--i': 1 } as any}>
          <h3 style={{ marginTop:0 }}>General</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div><label className="label">Timezone</label><input className="input" value={settings.timezone} onChange={e=> setSettings({...settings, timezone:e.target.value})} /></div>
            <div><label className="label">Week-off days (0=Sun)</label><input className="input" value={JSON.stringify(settings.weekOffDays)} onChange={e=> { try{ setSettings({...settings, weekOffDays: JSON.parse(e.target.value)});}catch{}}} /></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div><label className="label">Working hours threshold</label><input className="input" type="number" value={settings.workingHoursThreshold} onChange={e=> setSettings({...settings, workingHoursThreshold: Number(e.target.value)})} /></div>
              <div><label className="label">Grace minutes</label><input className="input" type="number" value={settings.graceMinutes} onChange={e=> setSettings({...settings, graceMinutes: Number(e.target.value)})} /></div>
            </div>
            <div><label className="label">Approval flow</label>
              <select className="input" value={settings.approvalFlow} onChange={e=> setSettings({...settings, approvalFlow:e.target.value})}>
                <option value="SINGLE">Single (HR/Manager)</option><option value="MULTI">Multi-level (Manager → HR)</option>
              </select>
            </div>
            <button className="btn btn-primary btn-press" onClick={async()=>{ await api('/api/org-settings',{method:'PATCH', body:JSON.stringify(settings)}); toast.success('Saved'); }}>Save Settings</button>
          </div>
        </div>

        <div className="card fade-up" style={{ '--i': 2 } as any}>
          <h3 style={{ marginTop:0 }}>Holidays</h3>
          <div style={{ maxHeight:240, overflow:'auto', marginBottom:12 }}>
            {holidays.map((h:any)=>(
              <div key={h.id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--neutral-100)', fontSize:13 }}>
                <span>{h.name}</span><span style={{ color:'var(--neutral-500)' }}>{h.date.slice(0,10)}</span>
                <button onClick={async()=>{ await api(`/api/holidays/${h.id}`,{method:'DELETE'}); load(); }} style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--danger)' }}>✕</button>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <input type="date" className="input" value={newHoliday.date} onChange={e=> setNewHoliday({...newHoliday, date:e.target.value})} />
            <input className="input" placeholder="Name" value={newHoliday.name} onChange={e=> setNewHoliday({...newHoliday, name:e.target.value})} />
            <button className="btn btn-primary btn-sm btn-press" onClick={async()=>{ await api('/api/holidays',{method:'POST', body:JSON.stringify(newHoliday)}); setNewHoliday({date:'',name:''}); load(); }}>Add</button>
          </div>
        </div>
      </div>

      <div className="card fade-up" style={{ '--i': 3, marginTop:16 } as any}>
        <h3 style={{ marginTop:0 }}>Leave Policies</h3>
        <div className="table-wrap reveal">
          <table><thead><tr><th>Name</th><th>Code</th><th>Quota</th><th>Carry Cap</th><th>Paid</th></tr></thead>
          <tbody>{types.map((t:any)=> <tr key={t.id}><td>{t.name}</td><td>{t.code}</td><td>{t.annual_quota}</td><td>{t.carry_forward_cap}</td><td>{t.is_paid? 'Yes':'No'}</td></tr>)}</tbody></table>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr', gap:8, marginTop:12 }}>
          <input className="input" placeholder="Name" value={newType.name} onChange={e=> setNewType({...newType, name:e.target.value})} />
          <input className="input" placeholder="CODE" value={newType.code} onChange={e=> setNewType({...newType, code:e.target.value.toUpperCase()})} />
          <input className="input" type="number" placeholder="Quota" value={newType.annualQuota} onChange={e=> setNewType({...newType, annualQuota:Number(e.target.value)})} />
          <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13 }}><input type="checkbox" checked={newType.isPaid} onChange={e=> setNewType({...newType, isPaid:e.target.checked})} /> Paid</label>
          <button className="btn btn-primary btn-sm btn-press" onClick={async()=>{ await api('/api/leave/types',{method:'POST', body:JSON.stringify(newType)}); load(); }}>Create</button>
        </div>
      </div>
    </div>
  );
}
