import { pool } from '../../db/pool';
import { v4 as uuid } from 'uuid';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../utils/errors';
import { computeWorkingDays } from '../../utils/helpers';
import { parseJsonColumn } from '../../utils/json';

async function getHolidaysSet(companyId:string, year:number){
  const [rows]:any=await pool.execute('SELECT date FROM holidays WHERE company_id=? AND year=?',[companyId,year]);
  return new Set<string>(rows.map((r:any)=> String(r.date).slice(0,10)));
}
async function getSettingsMap(companyId:string){
  const [rows]:any=await pool.execute('SELECT setting_key, setting_value FROM org_settings WHERE company_id=?',[companyId]);
  const m:any={}; for(const r of rows) m[r.setting_key]=parseJsonColumn(r.setting_value);
  return m;
}

export async function listLeaveTypes(companyId:string){
  const [rows]:any=await pool.execute('SELECT * FROM leave_types WHERE company_id=? ORDER BY name',[companyId]);
  return rows;
}
export async function createLeaveType(companyId:string, data:any){
  const id=uuid();
  await pool.execute('INSERT INTO leave_types (id, company_id, name, code, annual_quota, carry_forward_cap, accrual_type, is_paid) VALUES (?,?,?,?,?,?,?,?)',[id, companyId, data.name, data.code.toUpperCase(), data.annualQuota||0, data.carryForwardCap||0, data.accrual||'YEARLY', data.isPaid?1:0]);
  return { id, ...data };
}
export async function updateLeaveType(companyId:string, id:string, data:any){
  const fields:any={}; if(data.name) fields.name=data.name; if(data.annualQuota!==undefined) fields.annual_quota=data.annualQuota; if(data.carryForwardCap!==undefined) fields.carry_forward_cap=data.carryForwardCap;
  if(Object.keys(fields).length===0) throw new BadRequestError('No fields');
  const set=Object.keys(fields).map(k=>`${k}=?`).join(','); const vals=Object.values(fields);
  await (pool as any).execute(`UPDATE leave_types SET ${set} WHERE id=? AND company_id=?`,[...vals,id,companyId]);
  return { id, ...fields };
}

export async function getBalances(employeeId:string, year?:number){
  const y=year||new Date().getFullYear();
  const [rows]:any=await pool.execute(`SELECT lb.*, lt.name, lt.code, lt.annual_quota FROM leave_balances lb JOIN leave_types lt ON lt.id=lb.leave_type_id WHERE lb.employee_id=? AND lb.year=?`,[employeeId,y]);
  return rows;
}
export async function ensureBalances(employeeId:string, companyId:string, year:number){
  const [types]:any=await pool.execute('SELECT * FROM leave_types WHERE company_id=?',[companyId]);
  for(const t of types){
    const [ex]:any=await pool.execute('SELECT id FROM leave_balances WHERE employee_id=? AND leave_type_id=? AND year=?',[employeeId, t.id, year]);
    if(!ex.length){
      const allocated = t.accrual_type==='YEARLY'? t.annual_quota : Math.round((t.annual_quota/12)* (new Date().getMonth()+1) *100)/100;
      await pool.execute('INSERT INTO leave_balances (id, employee_id, leave_type_id, year, allocated, used, carried_forward) VALUES (?,?,?,?,?,?,?)',[uuid(), employeeId, t.id, year, allocated, 0, 0]);
    }
  }
}

export async function applyLeave(actor:any, data:any){
  const empId=actor.employeeId;
  if(!empId) throw new BadRequestError('No employee profile');
  const { leaveTypeId, startDate, endDate, halfDay, remarks, attachmentUrl } = data;
  if(!leaveTypeId || !startDate || !endDate) throw new BadRequestError('leaveTypeId, startDate, endDate required');
  if(new Date(startDate) > new Date(endDate)) throw new BadRequestError('startDate must be before endDate');
  // past? allow but warn
  const [ltRows]:any=await pool.execute('SELECT * FROM leave_types WHERE id=? AND company_id=?',[leaveTypeId, actor.companyId]);
  if(!ltRows.length) throw new NotFoundError('Leave type not found');
  const lt=ltRows[0];
  // overlap detection
  const [overlap]:any=await pool.execute(`SELECT id FROM leave_requests WHERE employee_id=? AND status IN ('PENDING','APPROVED') AND NOT (end_date < ? OR start_date > ?)`,[empId, startDate, endDate]);
  if(overlap.length) throw new BadRequestError('Overlapping leave already exists');
  // compute working days excluding holidays/weekends
  const year=new Date(startDate).getFullYear();
  const holidays=await getHolidaysSet(actor.companyId, year);
  const settings=await getSettingsMap(actor.companyId);
  const weekOff = settings.weekOffDays || [0,6];
  let days = computeWorkingDays(startDate, endDate, holidays, weekOff);
  if(halfDay) days = 0.5;
  if(days<=0) throw new BadRequestError('No working days in range (holidays/weekends)');
  // balance check (except unpaid)
  if(lt.is_paid){
    await ensureBalances(empId, actor.companyId, year);
    const [balRows]:any=await pool.execute('SELECT * FROM leave_balances WHERE employee_id=? AND leave_type_id=? AND year=?',[empId, leaveTypeId, year]);
    const bal=balRows[0];
    const available = (bal.allocated + bal.carried_forward) - bal.used;
    if(available < days) throw new BadRequestError(`Insufficient balance. Available: ${available}, required: ${days}`);
  }
  const id=uuid();
  await pool.execute('INSERT INTO leave_requests (id, employee_id, company_id, leave_type_id, start_date, end_date, days, half_day, remarks, attachment_url, status) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [id, empId, actor.companyId, leaveTypeId, startDate, endDate, days, halfDay?1:0, remarks||null, attachmentUrl||null, 'PENDING']);
  // also ensure balance row exists for next year if spanning? simplify
  return { id, days };
}

export async function listLeaveRequests(actor:any, query:any){
  let where='WHERE lr.company_id=?';
  const params:any[]=[actor.companyId];
  if(query.status) { where+=' AND lr.status=?'; params.push(query.status); }
  if(query.employeeId){
    // RBAC
    if(actor.role==='EMPLOYEE' && query.employeeId!==actor.employeeId) throw new ForbiddenError('Not allowed');
    if(actor.role==='MANAGER'){
      const [rep]:any=await pool.execute('SELECT id FROM employees WHERE id=? AND manager_id=?',[query.employeeId, actor.employeeId]);
      if(!rep.length && query.employeeId!==actor.employeeId) throw new ForbiddenError('Manager only direct reports');
    }
    where+=' AND lr.employee_id=?'; params.push(query.employeeId);
  } else {
    if(actor.role==='EMPLOYEE'){ where+=' AND lr.employee_id=?'; params.push(actor.employeeId); }
    else if(actor.role==='MANAGER'){ where+=' AND (e.manager_id=? OR lr.employee_id=?)'; params.push(actor.employeeId, actor.employeeId); }
  }
  const [rows]:any=await pool.execute(
    `SELECT lr.*, e.name as employeeName, e.photo_url, lt.name as leaveTypeName, lt.code FROM leave_requests lr JOIN employees e ON e.id=lr.employee_id JOIN leave_types lt ON lt.id=lr.leave_type_id ${where} ORDER BY lr.created_at DESC LIMIT 100`,
    params
  );
  return rows;
}

export async function decideLeave(actor:any, id:string, action:'APPROVED'|'REJECTED', comment?:string){
  if(!['ADMIN','HR','MANAGER'].includes(actor.role)) throw new ForbiddenError('Not authorized');
  const [rows]:any=await pool.execute('SELECT * FROM leave_requests WHERE id=? AND company_id=?',[id, actor.companyId]);
  if(!rows.length) throw new NotFoundError('Leave not found');
  const lr=rows[0];
  if(lr.status!=='PENDING' && lr.status!=='CANCELLATION_REQUESTED') throw new BadRequestError('Only pending requests can be decided');
  if(actor.role==='MANAGER'){
    const [rep]:any=await pool.execute('SELECT id FROM employees WHERE id=? AND manager_id=?',[lr.employee_id, actor.employeeId]);
    if(!rep.length) throw new ForbiddenError('Manager can only decide direct reports');
    // if multi-level, manager approval forwards to HR; simplified: manager can approve only if org setting is SINGLE? We'll allow but if multi-level, HR finalizes.
  }
  const settings=await getSettingsMap(actor.companyId);
  const multi = settings.approvalFlow==='MULTI';
  // For MULTI, Manager approval is intermediate? We'll implement: if multi and actor is MANAGER and action APPROVED, we still set APPROVED (could be two-step). Simplify: treat as approved.

  if(action==='APPROVED'){
    // check handling cancellation
    if(lr.status==='CANCELLATION_REQUESTED'){
      // cancel: revert balance
      await pool.execute('UPDATE leave_requests SET status=?, decided_by=?, decision_comment=?, decided_at=NOW() WHERE id=?',['CANCELLED', actor.id, comment||null, id]);
      // revert balance
      const year=new Date(lr.start_date).getFullYear();
      await pool.execute('UPDATE leave_balances SET used = GREATEST(0, used - ?) WHERE employee_id=? AND leave_type_id=? AND year=?',[lr.days, lr.employee_id, lr.leave_type_id, year]);
      // remove attendance LEAVE markers? Optional
      return { id, status:'CANCELLED' };
    }
    // approve normal
    // deduct balance (if paid)
    const [ltRows]:any=await pool.execute('SELECT is_paid FROM leave_types WHERE id=?',[lr.leave_type_id]);
    if(ltRows[0]?.is_paid){
      const year=new Date(lr.start_date).getFullYear();
      await ensureBalances(lr.employee_id, actor.companyId, year);
      await pool.execute('UPDATE leave_balances SET used = used + ? WHERE employee_id=? AND leave_type_id=? AND year=?',[lr.days, lr.employee_id, lr.leave_type_id, year]);
    }
    // create/update attendance records for each day as LEAVE (excluding holidays/weekends)
    const holidays=await getHolidaysSet(actor.companyId, new Date(lr.start_date).getFullYear());
    const weekOff=settings.weekOffDays||[0,6];
    let cur=new Date(lr.start_date+'T00:00:00Z'); const end=new Date(lr.end_date+'T00:00:00Z');
    while(cur<=end){
      const iso=cur.toISOString().slice(0,10);
      const dow=cur.getUTCDay();
      if(!weekOff.includes(dow) && !holidays.has(iso)){
        const [ex]:any=await pool.execute('SELECT id FROM attendances WHERE employee_id=? AND date=?',[lr.employee_id, iso]);
        if(ex.length) await pool.execute('UPDATE attendances SET status=? WHERE id=?',['LEAVE',ex[0].id]);
        else await pool.execute('INSERT INTO attendances (id, employee_id, company_id, date, status, source) VALUES (?,?,?,?,?,?)',[uuid(), lr.employee_id, actor.companyId, iso, 'LEAVE','SYSTEM']);
      }
      cur.setUTCDate(cur.getUTCDate()+1);
    }
  }
  await pool.execute('UPDATE leave_requests SET status=?, decided_by=?, decision_comment=?, decided_at=NOW() WHERE id=?',[action, actor.id, comment||null, id]);
  // notification handled in route
  return { id, status: action };
}

export async function cancelLeave(actor:any, id:string, reason?:string){
  const [rows]:any=await pool.execute('SELECT * FROM leave_requests WHERE id=? AND employee_id=?',[id, actor.employeeId]);
  if(!rows.length) throw new NotFoundError('Leave not found');
  const lr=rows[0];
  if(lr.status==='PENDING'){
    await pool.execute('UPDATE leave_requests SET status=?, cancellation_reason=? WHERE id=?',['CANCELLED', reason||null, id]);
    return { id, status:'CANCELLED' };
  }
  if(lr.status==='APPROVED'){
    // future only
    if(new Date(lr.start_date) <= new Date()) throw new BadRequestError('Cannot cancel past/ongoing leave');
    await pool.execute('UPDATE leave_requests SET status=?, cancellation_reason=? WHERE id=?',['CANCELLATION_REQUESTED', reason||null, id]);
    return { id, status:'CANCELLATION_REQUESTED' };
  }
  throw new BadRequestError('Cannot cancel in current status');
}

export async function getLeaveCalendar(actor:any, employeeId:string, year:number){
  const emp = employeeId || actor.employeeId;
  if(actor.role==='EMPLOYEE' && emp!==actor.employeeId) throw new ForbiddenError('Not allowed');
  const [rows]:any=await pool.execute('SELECT start_date, end_date, status, leave_type_id FROM leave_requests WHERE employee_id=? AND YEAR(start_date)=?',[emp,year]);
  return rows;
}
