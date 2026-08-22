import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';

export default function Notifications(){
  const [items, setItems] = useState<any[]>([]);
  async function load(){ const r=await api('/api/notifications'); setItems(r.data||[]); }
  useEffect(()=>{ load(); },[]);
  return (
    <div className="container" style={{ paddingTop:24, paddingBottom:40, maxWidth:720 }}>
      <PageHeader title="Notifications" subtitle="Approvals, payslips and account activity." actions={<button className="btn btn-ghost btn-sm" onClick={async()=>{ await api('/api/notifications/read-all',{method:'POST'}); load(); }}>Mark all read</button>} />
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {items.length===0 ? <div className="card"><EmptyState icon="bell" title="You're all caught up" hint="Leave decisions, payslips and security events will land here." /></div> :
        items.map((n:any, i:number)=>(
          <div key={n.id} className="notif-item fade-up" style={{ '--i': i, background:'white', border:'1px solid', borderColor: n.is_read? 'var(--neutral-200)':'var(--accent)', borderRadius:12, padding:14, display:'flex', justifyContent:'space-between', opacity: n.is_read?0.7:1 } as any}>
            <div>
              <div style={{ fontWeight:700, fontSize:13 }}>{n.title}</div>
              <div style={{ fontSize:12, color:'var(--neutral-500)', marginTop:4 }}>{n.type} • {new Date(n.created_at).toLocaleString()}</div>
              {n.payload && <div style={{ fontSize:12, marginTop:6, background:'var(--neutral-50)', padding:'6px 8px', borderRadius:6 }}>{JSON.stringify(n.payload)}</div>}
            </div>
            {!n.is_read && <button className="btn btn-ghost btn-sm" onClick={async()=>{ await api(`/api/notifications/${n.id}/read`,{method:'POST'}); load(); }}>Mark read</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
