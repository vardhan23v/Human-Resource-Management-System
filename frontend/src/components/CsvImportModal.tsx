import { useState } from 'react';
import Modal from './Modal';
import { api } from '../utils/api';
import { useToast } from './Toast';

const COLS = ['firstName', 'lastName', 'email', 'role', 'department', 'designation', 'dateOfJoining', 'monthlyWage', 'managerEmail'];
const TEMPLATE = COLS.join(',') + '\nAsha,Rao,asha.rao@example.com,EMPLOYEE,Engineering,Backend Developer,2026-09-01,65000,\n';

/** Minimal RFC-4180-ish CSV parser (quotes, commas, CRLF). */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) { const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += ch; }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter(r => r.some(c => c.trim()));
  const keys = head.map(h => h.trim());
  return body.map(r => Object.fromEntries(keys.map((k, i) => [k, (r[i] || '').trim()])));
}

export default function CsvImportModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [result, setResult] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const problems = rows.map((r, i) => !r.firstName || !r.lastName || !/^\S+@\S+\.\S+$/.test(r.email || '') ? `Row ${i + 1}: first name, last name and a valid email are required` : null).filter(Boolean) as string[];
  const reset = () => { setRows([]); setResult(null); };
  const submit = async () => {
    setBusy(true);
    try { const r = await api('/api/auth/employees/bulk', { method: 'POST', body: JSON.stringify({ rows: rows.map(x => ({ ...x, monthlyWage: x.monthlyWage ? Number(x.monthlyWage) : undefined, role: x.role || 'EMPLOYEE' })) }) }); setResult(r.data); toast.success(`Imported ${r.data.created} employee${r.data.created === 1 ? '' : 's'}`, r.data.failed ? `${r.data.failed} failed — see below` : undefined); onDone(); }
    catch (e: any) { toast.error('Import failed', e.message); } finally { setBusy(false); }
  };
  const downloadResults = () => { if (!result) return; const csv = ['row,ok,email,loginId,tempPassword,error', ...result.results.map((r: any) => [r.row, r.ok, r.email, r.loginId || '', r.tempPassword || '', JSON.stringify(r.error || '')].join(','))].join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'import-results.csv'; a.click(); };
  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Import employees from CSV" width={720}
      footer={result ? <><button className="btn btn-ghost" onClick={downloadResults}>Download results (with temp passwords)</button><button className="btn btn-primary" onClick={() => { reset(); onClose(); }}>Done</button></>
        : <><a className="btn btn-ghost" href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`} download="employees-template.csv">Download template</a><button className="btn btn-primary btn-press" disabled={!rows.length || problems.length > 0 || busy} onClick={submit}>{busy ? 'Importing…' : `Import ${rows.length || ''}`}</button></>}>
      {result ? (
        <div className="table-wrap" style={{ maxHeight: 360 }}><table><thead><tr><th>#</th><th>Email</th><th>Status</th><th>Login ID</th><th>Temp password</th></tr></thead><tbody>
          {result.results.map((r: any) => <tr key={r.row}><td>{r.row}</td><td>{r.email}</td><td>{r.ok ? <span className="badge badge-success">Created</span> : <span className="badge badge-warn" title={r.error}>{r.error}</span>}</td><td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{r.loginId || '—'}</td><td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{r.tempPassword || '—'}</td></tr>)}
        </tbody></table></div>
      ) : (
        <>
          <p style={{ fontSize: 13, color: 'var(--neutral-500)', margin: '0 0 12px' }}>Columns: <code>{COLS.join(', ')}</code>. <b>firstName, lastName, email</b> are required; role defaults to EMPLOYEE. Up to 500 rows. Each person receives a Login ID and temp password (also emailed when email is configured).</p>
          <label className="csv-drop">
            <input type="file" accept=".csv,text/csv" hidden onChange={e => { const f = e.target.files?.[0]; if (!f) return; f.text().then(t => { try { setRows(parseCsv(t)); } catch { toast.error('Could not parse that CSV'); } }); }} />
            <span style={{ fontSize: 24 }}>📄</span><span style={{ fontWeight: 600 }}>{rows.length ? `${rows.length} rows loaded — choose another file to replace` : 'Choose a CSV file'}</span>
          </label>
          {problems.length > 0 && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--danger)', background: 'var(--danger-light)', padding: '8px 10px', borderRadius: 8 }}>{problems.slice(0, 3).map(p => <div key={p}>{p}</div>)}{problems.length > 3 && <div>…and {problems.length - 3} more</div>}</div>}
          {rows.length > 0 && <div className="table-wrap" style={{ marginTop: 12, maxHeight: 260 }}><table><thead><tr>{COLS.slice(0, 6).map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>{rows.slice(0, 50).map((r, i) => <tr key={i}>{COLS.slice(0, 6).map(c => <td key={c}>{r[c] || <span style={{ color: 'var(--neutral-400)' }}>—</span>}</td>)}</tr>)}</tbody></table></div>}
        </>
      )}
    </Modal>
  );
}
