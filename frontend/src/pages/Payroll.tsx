import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import { useReveal } from '../hooks/useReveal';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';

export default function Payroll(){
  const toast = useToast();
  useReveal();
  const { user } = useAuth();
  const isAdmin = user && ['ADMIN','HR'].includes(user.role);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0,7));
  const [salary, setSalary] = useState<any>(null);

  async function load(){
    const q=new URLSearchParams();
    if(!isAdmin && user?.employeeId) q.set('employeeId', user.employeeId);
    if(month) q.set('month', month);
    const r=await api(`/api/payroll/payslips?${q.toString()}`);
    setPayslips(r.data||[]);
  }
  async function loadSalary(){
    if(user?.employeeId){
      try{ const r=await api(`/api/payroll/salary/${user.employeeId}`); setSalary(r.data);}catch{}
    }
  }
  useEffect(()=>{ load(); loadSalary(); },[month, user]);

  return (
    <div className="container" style={{ paddingTop:24, paddingBottom:40 }}>
      <PageHeader title="Payroll" subtitle="Run, review and finalise monthly payslips." actions={<>
          <input type="month" className="input" value={month} onChange={e=> setMonth(e.target.value)} style={{ width:150 }} />
          {isAdmin && (
            <>
              <button className="btn btn-primary btn-press" onClick={async()=>{
                try{ const r=await api('/api/payroll/run',{method:'POST', body:JSON.stringify({month})}); toast.success(`Payroll run: ${r.data.count} payslips`); load(); }catch(e:any){ toast.error(e.message); }
              }}>Run Payroll</button>
              <button className="btn btn-ghost" onClick={async()=>{ if(confirm('Finalize payroll for '+month+'? Attendance edits will require Admin override.')){ await api('/api/payroll/finalize',{method:'POST', body:JSON.stringify({month})}); toast.success('Finalized'); load(); }}}>Finalize</button>
            </>
          )}
      </>} />

      {salary && !isAdmin && (
        <div className="card fade-up" style={{ '--i': 1, marginBottom:16 } as any}>
          <h4 style={{ margin:'0 0 8px' }}>My Salary Structure</h4>
          <div style={{ fontSize:13, color:'var(--neutral-700)' }}>Monthly: <strong>₹{Number(salary.monthly_wage).toLocaleString('en-IN')}</strong> • Yearly: ₹{Number(salary.yearly_wage).toLocaleString('en-IN')} • Effective: {salary.effective_from.slice(0,10)}</div>
        </div>
      )}

      <div className="table-wrap reveal">
        <table>
          <thead><tr><th>Employee</th><th>Month</th><th>Gross</th><th>Deductions</th><th>Net</th><th>Payable Days</th><th>Status</th><th>PDF</th></tr></thead>
          <tbody>
            {payslips.length===0 ? <tr><td colSpan={8}><EmptyState compact icon="receipt" title={`No payslips for ${month}`} hint={isAdmin ? 'Run payroll to generate payslips for this month.' : 'Payslips appear here once payroll has been run.'} /></td></tr> :
            payslips.map((p:any)=>(
              <tr key={p.id}>
                <td>{p.employeeName||p.employee_id.slice(0,6)}</td>
                <td>{p.month.slice(0,7)}</td>
                <td>₹{Number(p.gross).toLocaleString('en-IN')}</td>
                <td>₹{Number(p.deductions).toLocaleString('en-IN')}</td>
                <td style={{ fontWeight:700 }}>₹{Number(p.net).toLocaleString('en-IN')}</td>
                <td>{p.payable_days}/{p.total_working_days}</td>
                <td>{p.finalized_at ? <span className="badge badge-success">Finalized</span> : <span className="badge badge-neutral">Draft</span>}</td>
                <td><a href={`/api/payroll/payslips/${p.id}/pdf`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">Download</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
