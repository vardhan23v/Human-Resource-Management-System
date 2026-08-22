import { pool } from '../../db/pool';
import { v4 as uuid } from 'uuid';
import { storage } from '../../utils/storage';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../utils/errors';
import { paginationParams } from '../../utils/helpers';

export async function listEmployees(actor: any, query: any) {
  const { page, limit, offset } = paginationParams(query);
  const search = query.search?.trim();
  const status = query.status;
  const departmentId = query.departmentId;
  let where = 'WHERE e.company_id=?';
  const params: any[] = [actor.companyId];
  if (search) {
    where += ' AND (e.name LIKE ? OR u.email LIKE ? OR u.login_id LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  if (status) { where += ' AND e.lifecycle_state=?'; params.push(status); }
  if (departmentId) { where += ' AND e.department_id=?'; params.push(departmentId); }

  // Manager can only see direct reports + self
  if (actor.role === 'MANAGER') {
    where += ' AND (e.manager_id=? OR e.user_id=?)';
    params.push(actor.employeeId, actor.id);
  } else if (actor.role === 'EMPLOYEE') {
    throw new ForbiddenError('Employees cannot list all');
  }

  const [rows]: any = await pool.execute(
    `SELECT e.*, u.email, u.login_id, u.role, d.name as departmentName,
            a.check_in as todayCheckIn, a.check_out as todayCheckOut, a.status as todayStatus
     FROM employees e
     JOIN users u ON u.id=e.user_id
     LEFT JOIN departments d ON d.id=e.department_id
     LEFT JOIN attendances a ON a.employee_id=e.id AND a.date=CURDATE()
     ${where}
     ORDER BY e.created_at DESC LIMIT ? OFFSET ?`,
    [...params, String(limit), String(offset)]
  );
  const [countRows]: any = await pool.execute(
    `SELECT COUNT(*) as total FROM employees e JOIN users u ON u.id=e.user_id ${where}`,
    params
  );
  const total = countRows[0].total;
  // derive presence for today
  const enriched = rows.map((r:any)=> ({
    ...r,
    presence: r.todayCheckIn && !r.todayCheckOut ? 'present' : r.todayStatus === 'LEAVE' ? 'on_leave' : r.todayCheckIn ? 'present' : 'absent',
  }));
  return { data: enriched, pagination: { page, limit, total, pages: Math.ceil(total/limit) } };
}

export async function getEmployee(actor: any, id: string) {
  const [rows]: any = await pool.execute(`
    SELECT e.*, u.email, u.login_id, u.role, u.status as userStatus, d.name as departmentName,
           m.name as managerName, c.name as companyName
    FROM employees e
    JOIN users u ON u.id=e.user_id
    LEFT JOIN departments d ON d.id=e.department_id
    LEFT JOIN employees m ON m.id=e.manager_id
    JOIN companies c ON c.id=e.company_id
    WHERE e.id=? AND e.company_id=?
  `, [id, actor.companyId]);
  if (!rows.length) throw new NotFoundError('Employee not found');
  const emp = rows[0];
  // RBAC
  if (actor.role === 'EMPLOYEE' && actor.employeeId !== id) throw new ForbiddenError('Cannot view other employee');
  if (actor.role === 'MANAGER' && actor.employeeId !== emp.manager_id && actor.employeeId !== id) {
    // Allow if direct report? The query already filters but for get we check
    // Do extra check: is this employee a report of actor?
    const [repRows]: any = await pool.execute('SELECT id FROM employees WHERE id=? AND manager_id=?', [id, actor.employeeId]);
    if (!repRows.length && actor.employeeId !== id) throw new ForbiddenError('Manager can only view direct reports');
  }
  // fetch skills/certs/docs
  const [skills]: any = await pool.execute('SELECT * FROM employee_skills WHERE employee_id=?', [id]);
  const [certs]: any = await pool.execute('SELECT * FROM employee_certifications WHERE employee_id=?', [id]);
  const [docs]: any = await pool.execute('SELECT id, file_name, original_name, mime_type, size_bytes, category, created_at FROM employee_documents WHERE employee_id=?', [id]);
  const [salary]: any = await pool.execute('SELECT * FROM salary_structures WHERE employee_id=? ORDER BY effective_from DESC LIMIT 1', [id]);
  return { ...emp, skills, certifications: certs, documents: docs, salaryStructure: salary[0] || null };
}

export async function updateEmployee(actor: any, id: string, data: any) {
  const isSelf = actor.employeeId === id;
  const isPrivileged = ['ADMIN','HR'].includes(actor.role);
  if (!isSelf && !isPrivileged) {
    if (actor.role === 'MANAGER') {
      const [rep]: any = await pool.execute('SELECT id FROM employees WHERE id=? AND manager_id=?', [id, actor.employeeId]);
      if (!rep.length) throw new ForbiddenError('Not authorized');
    } else throw new ForbiddenError('Not authorized');
  }
  const [rows]: any = await pool.execute('SELECT * FROM employees WHERE id=? AND company_id=?', [id, actor.companyId]);
  if (!rows.length) throw new NotFoundError('Employee not found');
  const before = rows[0];
  // field-level control
  const allowedSelfFields = ['phone','address','photo_url','emergency_contact','personal_email','about','what_i_love','interests','dob','gender','marital_status','nationality'];
  const privilegedFields = ['name','first_name','last_name','department_id','designation','employment_type','manager_id','lifecycle_state','location','bank_name','ifsc_code','pan_no','uan_no','emp_code','bank_account_enc'];
  let fields: any = {};
  if (isPrivileged) {
    // HR/Admin can edit everything except they shouldn't directly edit sensitive bank without audit — we allow but will audit
    for (const k of [...allowedSelfFields, ...privilegedFields]) if (k in data) fields[k] = data[k];
    if (data.bankDetails) {
      if (data.bankDetails.accountNumber) fields.bank_account_enc = data.bankDetails.accountNumber; // ideally encrypted
      if (data.bankDetails.bankName) fields.bank_name = data.bankDetails.bankName;
      if (data.bankDetails.ifscCode) fields.ifsc_code = data.bankDetails.ifscCode;
      if (data.bankDetails.panNo) fields.pan_no = data.bankDetails.panNo;
      if (data.bankDetails.uanNo) fields.uan_no = data.bankDetails.uanNo;
    }
    if (data.name && !data.first_name) {
      const parts = data.name.split(' ');
      fields.first_name = parts[0];
      fields.last_name = parts.slice(1).join(' ') || parts[0];
    }
  } else if (isSelf) {
    for (const k of allowedSelfFields) if (k in data) fields[k] = data[k];
    if (data.photoUrl) fields.photo_url = data.photoUrl;
  }
  if (Object.keys(fields).length === 0) throw new BadRequestError('No valid fields to update');
  const setClause = Object.keys(fields).map(k=> `${k}=?`).join(', ');
  const vals = Object.values(fields);
  await (pool as any).execute(`UPDATE employees SET ${setClause}, updated_at=NOW() WHERE id=?`, [...vals, id]);
  // if lifecycle_state changed to EXITED, also update user status
  if (fields.lifecycle_state === 'EXITED') {
    await pool.execute('UPDATE users SET status=? WHERE id=?', ['EXITED', before.user_id]);
  }
  if (fields.lifecycle_state && fields.lifecycle_state !== 'EXITED' && before.lifecycle_state === 'EXITED') {
    await pool.execute('UPDATE users SET status=? WHERE id=?', ['ACTIVE', before.user_id]);
  }
  const [afterRows]: any = await pool.execute('SELECT * FROM employees WHERE id=?', [id]);
  return { before, after: afterRows[0] };
}

export async function uploadDocument(actor: any, employeeId: string, file: Express.Multer.File, category?: string) {
  if (!file) throw new BadRequestError('File required');
  if (file.size > 5*1024*1024) throw new BadRequestError('File max 5MB');
  const allowed = ['application/pdf','image/jpeg','image/png','image/jpg'];
  if (!allowed.includes(file.mimetype)) throw new BadRequestError('Only PDF/JPG/PNG allowed');
  const [empRows]: any = await pool.execute('SELECT id FROM employees WHERE id=? AND company_id=?', [employeeId, actor.companyId]);
  if (!empRows.length) throw new NotFoundError('Employee not found');
  // self or HR/Admin can upload
  if (actor.employeeId !== employeeId && !['ADMIN','HR','MANAGER'].includes(actor.role)) throw new ForbiddenError('Not allowed');
  const id = uuid();
  const ext = (file.originalname.match(/\.[a-z0-9]+$/i) || [''])[0].toLowerCase();
  const key = `uploads/${employeeId}/${id}${ext}`;
  await storage.put(key, file.buffer, file.mimetype);
  await pool.execute('INSERT INTO employee_documents (id, employee_id, file_name, original_name, mime_type, size_bytes, storage_path, storage_key, category, uploaded_by) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [id, employeeId, `${id}${ext}`, file.originalname, file.mimetype, file.size, key, key, category || null, actor.id]);
  return { id, file_name: `${id}${ext}` };
}

export async function addSkill(actor: any, employeeId: string, name: string) {
  if (actor.employeeId !== employeeId && !['ADMIN','HR'].includes(actor.role)) throw new ForbiddenError('Not allowed');
  const id = uuid();
  await pool.execute('INSERT INTO employee_skills (id, employee_id, name) VALUES (?,?,?)', [id, employeeId, name]);
  return { id, name };
}
export async function addCertification(actor: any, employeeId: string, data: any) {
  if (actor.employeeId !== employeeId && !['ADMIN','HR'].includes(actor.role)) throw new ForbiddenError('Not allowed');
  const id = uuid();
  await pool.execute('INSERT INTO employee_certifications (id, employee_id, title, issuer, issued_date) VALUES (?,?,?,?,?)', [id, employeeId, data.title, data.issuer || null, data.issuedDate || null]);
  return { id, ...data };
}
export async function deleteSkill(actor: any, employeeId: string, skillId: string) {
  await pool.execute('DELETE FROM employee_skills WHERE id=? AND employee_id=?', [skillId, employeeId]);
}
export async function deleteCertification(actor: any, employeeId: string, certId: string) {
  await pool.execute('DELETE FROM employee_certifications WHERE id=? AND employee_id=?', [certId, employeeId]);
}

export async function listDepartments(companyId: string) {
  const [rows]: any = await pool.execute('SELECT * FROM departments WHERE company_id=? ORDER BY name', [companyId]);
  return rows;
}
export async function createDepartment(actor: any, name: string) {
  const id = uuid();
  await pool.execute('INSERT INTO departments (id, company_id, name) VALUES (?,?,?)', [id, actor.companyId, name]);
  return { id, name };
}
