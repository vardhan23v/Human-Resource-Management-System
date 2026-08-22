import { pool } from '../../db/pool';
import { parseJsonColumn } from '../../utils/json';

export async function getSettings(companyId:string){
  const [rows]:any=await pool.execute('SELECT setting_key, setting_value FROM org_settings WHERE company_id=?',[companyId]);
  const out:any={}; for(const r of rows) out[r.setting_key]=parseJsonColumn(r.setting_value);
  return out;
}
export async function updateSettings(companyId:string, data:any){
  for(const [k,v] of Object.entries(data)){
    await pool.execute('INSERT INTO org_settings (company_id, setting_key, setting_value) VALUES (?,?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)',[companyId,k,JSON.stringify(v)]);
  }
  return getSettings(companyId);
}
