import { pool } from '../../db/pool';
import { v4 as uuid } from 'uuid';

export async function listHolidays(companyId: string, year?: number) {
  let sql='SELECT * FROM holidays WHERE company_id=?';
  const p:any[]=[companyId];
  if (year){ sql+=' AND year=?'; p.push(year); }
  sql+=' ORDER BY date';
  const [rows]:any=await pool.execute(sql,p);
  return rows;
}
export async function createHoliday(companyId: string, data:any) {
  const id=uuid();
  const year=new Date(data.date).getFullYear();
  await pool.execute('INSERT INTO holidays (id, company_id, date, name, year) VALUES (?,?,?,?,?)', [id, companyId, data.date, data.name, year]);
  return { id, ...data, year };
}
export async function deleteHoliday(companyId:string, id:string){ await pool.execute('DELETE FROM holidays WHERE id=? AND company_id=?',[id, companyId]); }
export async function bulkCreate(companyId:string, holidays:any[]){
  for(const h of holidays) await createHoliday(companyId,h);
}
