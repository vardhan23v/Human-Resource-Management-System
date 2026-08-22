import { pool } from '../../db/pool';
import { v4 as uuid } from 'uuid';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../utils/errors';
import { pool as db } from '../../db/pool';
import { parseJsonColumn } from '../../utils/json';

export async function getOrgSettings(companyId: string) {
  const [rows]: any = await pool.execute('SELECT setting_key, setting_value FROM org_settings WHERE company_id=?', [companyId]);
  const map: any = {};
  for (const r of rows) map[r.setting_key] = parseJsonColumn(r.setting_value);
  return map;
}

export async function checkIn(actor: any, ip?: string, device?: string) {
  const empId = actor.employeeId;
  if (!empId) throw new BadRequestError('No employee profile');
  const today = new Date().toISOString().slice(0,10);
  const [existing]: any = await pool.execute('SELECT * FROM attendances WHERE employee_id=? AND date=?', [empId, today]);
  if (existing.length && existing[0].check_in && !existing[0].check_out) throw new BadRequestError('Already checked in, please check out first');
  if (existing.length && existing[0].check_out) throw new BadRequestError('Already checked out today');
  const nowUtc = new Date().toISOString().slice(0,19).replace('T',' ');
  if (existing.length) {
    await pool.execute('UPDATE attendances SET check_in=?, status=?, ip_address=?, device_info=?, source=? WHERE id=?', [nowUtc, 'PRESENT', ip || null, device || null, 'WEB', existing[0].id]);
    return { id: existing[0].id, checkIn: nowUtc };
  } else {
    const id = uuid();
    // determine late flag
    const settings = await getOrgSettings(actor.companyId);
    const grace = settings.graceMinutes ?? 15;
    // grace time is e.g., 09:15; we compare now vs 09:00+ grace? Simplified: if checkIn after 09:15 IST
    // For now compute IST hour
    const now = new Date();
    const istOffset = 5.5*60;
    const istMinutes = now.getUTCHours()*60 + now.getUTCMinutes() + istOffset;
    const lateThreshold = 9*60 + grace; // 9am + grace
    const lateFlag = istMinutes > lateThreshold ? 1 : 0;
    await pool.execute('INSERT INTO attendances (id, employee_id, company_id, date, check_in, status, late_flag, source, ip_address, device_info) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [id, empId, actor.companyId, today, nowUtc, 'PRESENT', lateFlag, 'WEB', ip || null, device || null]);
    return { id, checkIn: nowUtc, lateFlag };
  }
}

export async function checkOut(actor: any) {
  const empId = actor.employeeId;
  const today = new Date().toISOString().slice(0,10);
  const [rows]: any = await pool.execute('SELECT * FROM attendances WHERE employee_id=? AND date=?', [empId, today]);
  if (!rows.length || !rows[0].check_in) throw new BadRequestError('No open check-in found');
  if (rows[0].check_out) throw new BadRequestError('Already checked out');
  const nowUtc = new Date().toISOString().slice(0,19).replace('T',' ');
  const checkIn = new Date(rows[0].check_in);
  const checkOut = new Date(nowUtc);
  const diffMin = Math.round((checkOut.getTime() - checkIn.getTime())/60000);
  let status = 'PRESENT';
  let extra = 0;
  if (diffMin < 4*60) status = 'HALF_DAY';
  else if (diffMin < 8*60) status = 'HALF_DAY';
  else { status='PRESENT'; extra = Math.max(0, diffMin - 8*60); }
  await pool.execute('UPDATE attendances SET check_out=?, worked_minutes=?, extra_minutes=?, status=?, updated_at=NOW() WHERE id=?', [nowUtc, diffMin, extra, status, rows[0].id]);
  return { checkOut: nowUtc, workedMinutes: diffMin, status };
}

export async function getTodayStatus(actor: any) {
  const empId = actor.employeeId;
  const today = new Date().toISOString().slice(0,10);
  const [rows]: any = await pool.execute('SELECT * FROM attendances WHERE employee_id=? AND date=?', [empId, today]);
  if (!rows.length) return { checkedIn: false, checkedOut: false };
  const a = rows[0];
  return { checkedIn: !!a.check_in, checkedOut: !!a.check_out, checkIn: a.check_in, checkOut: a.check_out, workedMinutes: a.worked_minutes, status: a.status };
}

export async function listAttendance(actor: any, query: any) {
  // if employee, only own; HR/Admin/manager can filter by employeeId
  const page = Math.max(1, parseInt(query.page||'1',10));
  const limit = Math.min(100, parseInt(query.limit||'20',10));
  const offset = (page-1)*limit;
  let employeeId = query.employeeId;
  if (actor.role === 'EMPLOYEE') employeeId = actor.employeeId;
  else if (actor.role === 'MANAGER' && employeeId) {
    // verify is report
    const [rep]: any = await pool.execute('SELECT id FROM employees WHERE id=? AND manager_id=?', [employeeId, actor.employeeId]);
    if (!rep.length && employeeId !== actor.employeeId) throw new ForbiddenError('Manager can only view direct reports');
  }
  const date = query.date; // specific date for admin day view
  const month = query.month; // YYYY-MM
  let where = 'WHERE a.company_id=?';
  const params: any[] = [actor.companyId];
  if (employeeId) { where += ' AND a.employee_id=?'; params.push(employeeId); }
  if (actor.role === 'MANAGER' && !employeeId) {
    // list only reports + self
    where += ' AND (e.manager_id=? OR e.id=?)';
    params.push(actor.employeeId, actor.employeeId);
  }
  if (date) { where += ' AND a.date=?'; params.push(date); }
  else if (month) { where += ' AND DATE_FORMAT(a.date, "%Y-%m")=?'; params.push(month); }
  if (!employeeId && actor.role === 'EMPLOYEE') { where += ' AND a.employee_id=?'; params.push(actor.employeeId); }

  // For month view summary chips: we need counts but also return rows
  const [rows]: any = await pool.execute(
    `SELECT a.*, e.name as employeeName, e.photo_url FROM attendances a JOIN employees e ON e.id=a.employee_id ${where} ORDER BY a.date DESC LIMIT ? OFFSET ?`,
    [...params, String(limit), String(offset)]
  );
  const [cnt]: any = await pool.execute(`SELECT COUNT(*) as total FROM attendances a JOIN employees e ON e.id=a.employee_id ${where}`, params);
  // summary if month
  let summary: any = null;
  if (month && employeeId) {
    const [all]: any = await pool.execute(`SELECT status, COUNT(*) as c FROM attendances a WHERE a.employee_id=? AND DATE_FORMAT(a.date,"%Y-%m")=? GROUP BY status`, [employeeId, month]);
    const map: any = {}; for (const r of all) map[r.status]=r.c;
    summary = { present: map['PRESENT']||0, halfDay: map['HALF_DAY']||0, absent: map['ABSENT']||0, leave: map['LEAVE']||0 };
    // total working days in month approx 22? We'll compute via calendar?
  }
  return { data: rows, pagination: { page, limit, total: cnt[0].total }, summary };
}

export async function getAttendanceCalendar(actor: any, employeeId: string, yearMonth: string) {
  // yearMonth YYYY-MM
  const targetEmp = employeeId || actor.employeeId;
  if (actor.role === 'EMPLOYEE' && targetEmp !== actor.employeeId) throw new ForbiddenError('Not allowed');
  const [rows]: any = await pool.execute('SELECT date, status, check_in, check_out, worked_minutes FROM attendances WHERE employee_id=? AND DATE_FORMAT(date,"%Y-%m")=? ORDER BY date', [targetEmp, yearMonth]);
  return rows;
}

// Regularization
export async function requestRegularization(actor: any, data: any) {
  const empId = actor.employeeId;
  if (!empId) throw new BadRequestError('No employee');
  const { date, requestedCheckIn, requestedCheckOut, reason } = data;
  if (!date || !reason) throw new BadRequestError('date and reason required');
  const id = uuid();
  await pool.execute('INSERT INTO regularizations (id, employee_id, company_id, date, requested_check_in, requested_check_out, reason, status) VALUES (?,?,?,?,?,?,?,?)',
    [id, empId, actor.companyId, date, requestedCheckIn || null, requestedCheckOut || null, reason, 'PENDING']);
  return { id };
}
export async function listRegularizations(actor: any, query: any) {
  let where = 'WHERE r.company_id=?';
  const params: any[] = [actor.companyId];
  if (query.status) { where += ' AND r.status=?'; params.push(query.status); }
  if (actor.role === 'EMPLOYEE') { where += ' AND r.employee_id=?'; params.push(actor.employeeId); }
  else if (actor.role === 'MANAGER') {
    where += ' AND (e.manager_id=? OR r.employee_id=?)'; params.push(actor.employeeId, actor.employeeId);
  }
  const [rows]: any = await pool.execute(
    `SELECT r.*, e.name as employeeName FROM regularizations r JOIN employees e ON e.id=r.employee_id ${where} ORDER BY r.created_at DESC LIMIT 50`,
    params
  );
  return rows;
}
export async function decideRegularization(actor: any, id: string, action: 'APPROVED'|'REJECTED', comment?: string) {
  if (!['ADMIN','HR','MANAGER'].includes(actor.role)) throw new ForbiddenError('Not authorized');
  const [rows]: any = await pool.execute('SELECT * FROM regularizations WHERE id=? AND company_id=?', [id, actor.companyId]);
  if (!rows.length) throw new NotFoundError('Request not found');
  const req = rows[0];
  if (req.status !== 'PENDING') throw new BadRequestError('Already decided');
  if (actor.role === 'MANAGER') {
    const [rep]: any = await pool.execute('SELECT id FROM employees WHERE id=? AND manager_id=?', [req.employee_id, actor.employeeId]);
    if (!rep.length) throw new ForbiddenError('Manager can only decide for direct reports');
  }
  await pool.execute('UPDATE regularizations SET status=?, decided_by=?, decision_comment=?, decided_at=NOW() WHERE id=?', [action, actor.id, comment || null, id]);
  if (action === 'APPROVED') {
    // apply to attendance
    const checkIn = req.requested_check_in;
    const checkOut = req.requested_check_out;
    let worked = null, status='PRESENT';
    if (checkIn && checkOut) {
      const diff = Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime())/60000);
      worked = diff;
      if (diff < 4*60) status='HALF_DAY';
      else if (diff < 8*60) status='HALF_DAY';
    }
    const [att]: any = await pool.execute('SELECT id FROM attendances WHERE employee_id=? AND date=?', [req.employee_id, req.date]);
    if (att.length) {
      await pool.execute('UPDATE attendances SET check_in=?, check_out=?, worked_minutes=?, status=?, source=? WHERE id=?', [checkIn, checkOut, worked, status, 'REGULARIZED', att[0].id]);
    } else {
      await pool.execute('INSERT INTO attendances (id, employee_id, company_id, date, check_in, check_out, worked_minutes, status, source) VALUES (?,?,?,?,?,?,?,?,?)',
        [uuid(), req.employee_id, actor.companyId, req.date, checkIn, checkOut, worked, status, 'REGULARIZED']);
    }
  }
  return { id, status: action };
}

export async function autoCloseMissedCheckouts() {
  // for cron: close yesterday's open check-ins
  const yesterday = new Date(Date.now()-24*60*60*1000).toISOString().slice(0,10);
  const [rows]: any = await pool.execute('SELECT id, check_in FROM attendances WHERE date=? AND check_in IS NOT NULL AND check_out IS NULL', [yesterday]);
  for (const r of rows) {
    const ci = new Date(r.check_in);
    const co = new Date(ci); co.setHours(20,0,0,0); // assume 8pm auto-close
    const diff = Math.round((co.getTime()-ci.getTime())/60000);
    await pool.execute('UPDATE attendances SET check_out=?, worked_minutes=?, status=?, source=? WHERE id=?', [co.toISOString().slice(0,19).replace('T',' '), diff, diff < 4*60 ? 'HALF_DAY':'PRESENT', 'AUTO_CLOSED', r.id]);
  }
}
