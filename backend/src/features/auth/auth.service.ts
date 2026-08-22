import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { pool } from '../../db/pool';
import { env } from '../../config/env';
import { AppError, BadRequestError, UnauthorizedError, NotFoundError } from '../../utils/errors';
import { generatePassword, buildLoginId, hashToken } from '../../utils/helpers';
import { sendMail } from '../../utils/mailer';

function signAccessToken(user: any) {
  return jwt.sign({ sub: user.id, role: user.role, companyId: user.company_id }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as any);
}
function signRefreshToken(user: any) {
  return jwt.sign({ sub: user.id, type: 'refresh' }, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN } as any);
}

export async function signupCompany(data: { companyName: string; name: string; email: string; password: string; logoUrl?: string }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // check email exists
    const [ex]: any = await conn.execute('SELECT id FROM users WHERE email=?', [data.email.toLowerCase()]);
    if (ex.length) throw new BadRequestError('Email already registered');
    const companyId = uuid();
    const initials = data.companyName.split(/\s+/).map(w=>w[0]).join('').slice(0,3).toUpperCase() || 'CO';
    await conn.execute('INSERT INTO companies (id, name, initials, logo_url) VALUES (?,?,?,?)', [companyId, data.companyName, initials, data.logoUrl || null]);
    // default departments
    const depIds = [uuid(), uuid(), uuid()];
    for (const [i, n] of ['Engineering','Human Resources','Sales'].entries()) {
      await conn.execute('INSERT INTO departments (id, company_id, name) VALUES (?,?,?)', [depIds[i], companyId, n]);
    }
    // default leave types
    const lt = [
      { name: 'Paid Time Off', code: 'PAID', quota: 18, cap:5, accrual:'YEARLY', paid:1 },
      { name: 'Sick Leave', code:'SICK', quota:8, cap:0, accrual:'YEARLY', paid:1 },
      { name: 'Casual Leave', code:'CASUAL', quota:6, cap:2, accrual:'YEARLY', paid:1 },
      { name: 'Unpaid Leave', code:'UNPAID', quota:0, cap:0, accrual:'YEARLY', paid:0 },
      { name: 'Comp Off', code:'COMP', quota:0, cap:0, accrual:'MONTHLY', paid:1 },
      { name: 'Maternity Leave', code:'MATERNITY', quota:90, cap:0, accrual:'YEARLY', paid:1 },
    ];
    for (const t of lt) {
      await conn.execute('INSERT INTO leave_types (id, company_id, name, code, annual_quota, carry_forward_cap, accrual_type, is_paid) VALUES (?,?,?,?,?,?,?,?)',
        [uuid(), companyId, t.name, t.code, t.quota, t.cap, t.accrual, t.paid]);
    }
    // default org settings
    const settings: Record<string, any> = {
      timezone: 'Asia/Kolkata',
      weekOffDays: [0,6],
      workingHoursThreshold: 8,
      halfDayThresholdHours: 4,
      graceMinutes: 15,
      approvalFlow: 'SINGLE',
      pfPercent: 12,
      professionalTax: 200,
    };
    for (const [k,v] of Object.entries(settings)) {
      await conn.execute('INSERT INTO org_settings (company_id, setting_key, setting_value) VALUES (?,?,?)', [companyId, k, JSON.stringify(v)]);
    }
    const userId = uuid();
    const loginId = buildLoginId(initials, data.name.split(' ')[0] || 'Admin', data.name.split(' ')[1] || 'User', new Date().getFullYear(), 1);
    const hash = await bcrypt.hash(data.password, 10);
    await conn.execute('INSERT INTO users (id, company_id, login_id, email, password_hash, role, status, email_verified_at) VALUES (?,?,?,?,?,?,?,NOW())',
      [userId, companyId, loginId, data.email.toLowerCase(), hash, 'ADMIN', 'ACTIVE']);
    // create employee row
    const empId = uuid();
    const [first, ...rest] = data.name.split(' ');
    const last = rest.join(' ') || 'User';
    const deptId = depIds[1]; // HR dept for admin
    await conn.execute('INSERT INTO employees (id, user_id, company_id, name, first_name, last_name, department_id, designation, date_of_joining, lifecycle_state) VALUES (?,?,?,?,?,?,?,?,CURDATE(),?)',
      [empId, userId, companyId, data.name, first, last, deptId, 'Administrator', 'ACTIVE']);
    await conn.execute('INSERT INTO join_serials (company_id, year, last_serial) VALUES (?,?,?) ON DUPLICATE KEY UPDATE last_serial=GREATEST(last_serial, VALUES(last_serial))',
      [companyId, new Date().getFullYear(), 1]);
    await conn.commit();
    const user = { id: userId, company_id: companyId, role: 'ADMIN', login_id: loginId };
    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    await pool.execute('INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?,?,?, DATE_ADD(NOW(), INTERVAL 7 DAY))',
      [uuid(), userId, hashToken(refreshToken), null]);
    return { user: { id: userId, email: data.email, loginId, role:'ADMIN', companyId }, accessToken, refreshToken, companyId };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function login(identifier: string, password: string, ip?: string) {
  const idLower = identifier.toLowerCase();
  const [rows]: any = await pool.execute('SELECT * FROM users WHERE email=? OR login_id=?', [idLower, identifier.toUpperCase()]);
  if (!rows.length) throw new UnauthorizedError('Invalid credentials');
  const user = rows[0];
  if (user.locked_until && new Date(user.locked_until) > new Date()) throw new UnauthorizedError('Account locked. Check email to unlock.');
  if (user.status === 'EXITED') throw new UnauthorizedError('Account deactivated');
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    const attempts = (user.failed_login_attempts || 0) + 1;
    let lockUntil = null;
    if (attempts >= 5) lockUntil = new Date(Date.now() + 30*60*1000);
    await pool.execute('UPDATE users SET failed_login_attempts=?, locked_until=? WHERE id=?', [attempts, lockUntil ? lockUntil.toISOString().slice(0,19).replace('T',' ') : null, user.id]);
    throw new UnauthorizedError(attempts >=5 ? 'Account locked after 5 failed attempts' : 'Invalid credentials');
  }
  await pool.execute('UPDATE users SET failed_login_attempts=0, locked_until=NULL WHERE id=?', [user.id]);
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  await pool.execute('INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?,?,?, DATE_ADD(NOW(), INTERVAL 7 DAY))',
    [uuid(), user.id, hashToken(refreshToken), null]);
  return { user: { id: user.id, email: user.email, loginId: user.login_id, role: user.role, companyId: user.company_id, mustChangePassword: !!user.must_change_password }, accessToken, refreshToken };
}

export async function refresh(oldToken: string) {
  let payload: any;
  try { payload = jwt.verify(oldToken, env.JWT_REFRESH_SECRET); } catch { throw new UnauthorizedError('Invalid refresh token'); }
  if (payload.type !== 'refresh') throw new UnauthorizedError('Invalid token type');
  const h = hashToken(oldToken);
  const [rows]: any = await pool.execute('SELECT * FROM refresh_tokens WHERE token_hash=? AND revoked_at IS NULL AND expires_at > NOW()', [h]);
  if (!rows.length) throw new UnauthorizedError('Refresh token expired or revoked');
  const rt = rows[0];
  const [uRows]: any = await pool.execute('SELECT * FROM users WHERE id=?', [payload.sub]);
  if (!uRows.length) throw new UnauthorizedError('User not found');
  const user = uRows[0];
  // rotate
  await pool.execute('UPDATE refresh_tokens SET revoked_at=NOW() WHERE id=?', [rt.id]);
  const accessToken = signAccessToken(user);
  const newRefresh = signRefreshToken(user);
  await pool.execute('INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?,?,?, DATE_ADD(NOW(), INTERVAL 7 DAY))',
    [uuid(), user.id, hashToken(newRefresh), null]);
  return { accessToken, refreshToken: newRefresh };
}

export async function logout(refreshToken: string) {
  const h = hashToken(refreshToken);
  await pool.execute('UPDATE refresh_tokens SET revoked_at=NOW() WHERE token_hash=?', [h]);
}

export async function forgotPassword(email: string) {
  const [rows]: any = await pool.execute('SELECT id FROM users WHERE email=?', [email.toLowerCase()]);
  if (!rows.length) return; // silent
  const userId = rows[0].id;
  const token = uuid() + uuid();
  const h = hashToken(token);
  await pool.execute('INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?,?,?, DATE_ADD(NOW(), INTERVAL 1 HOUR))', [uuid(), userId, h, null]);
  const resetLink = `http://localhost:5173/reset-password?token=${token}`;
  await sendMail(email, 'Dayflow — Reset your password', `<p>Click to reset: <a href="${resetLink}">${resetLink}</a> — valid for 1 hour.</p>`);
  return token; // returned for dev/test, not in prod response
}

export async function resetPassword(token: string, newPassword: string) {
  const h = hashToken(token);
  const [rows]: any = await pool.execute('SELECT * FROM password_reset_tokens WHERE token_hash=? AND used_at IS NULL AND expires_at > NOW()', [h]);
  if (!rows.length) throw new BadRequestError('Invalid or expired reset token');
  const prt = rows[0];
  const hash = await bcrypt.hash(newPassword, 10);
  await pool.execute('UPDATE users SET password_hash=?, must_change_password=0 WHERE id=?', [hash, prt.user_id]);
  await pool.execute('UPDATE password_reset_tokens SET used_at=NOW() WHERE id=?', [prt.id]);
  await pool.execute('UPDATE refresh_tokens SET revoked_at=NOW() WHERE user_id=?', [prt.user_id]);
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const [rows]: any = await pool.execute('SELECT password_hash FROM users WHERE id=?', [userId]);
  if (!rows.length) throw new NotFoundError('User not found');
  const ok = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!ok) throw new BadRequestError('Current password incorrect');
  const hash = await bcrypt.hash(newPassword, 10);
  await pool.execute('UPDATE users SET password_hash=?, must_change_password=0 WHERE id=?', [hash, userId]);
}

export async function createEmployee(actor: any, data: any) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // must be ADMIN/HR
    if (!['ADMIN','HR'].includes(actor.role)) throw new AppError(403,'FORBIDDEN','Only Admin/HR can create employees');
    const companyId = actor.companyId;
    const [cRows]: any = await conn.execute('SELECT initials FROM companies WHERE id=?', [companyId]);
    if (!cRows.length) throw new NotFoundError('Company not found');
    const initials = cRows[0].initials;
    const year = data.dateOfJoining ? new Date(data.dateOfJoining).getFullYear() : new Date().getFullYear();
    // atomic serial increment
    await conn.execute('INSERT INTO join_serials (company_id, year, last_serial) VALUES (?,?,1) ON DUPLICATE KEY UPDATE last_serial=last_serial+1', [companyId, year]);
    const [sRows]: any = await conn.execute('SELECT last_serial FROM join_serials WHERE company_id=? AND year=?', [companyId, year]);
    const serial = sRows[0].last_serial;
    const loginId = buildLoginId(initials, data.firstName, data.lastName, year, serial);
    // check email duplicate
    const [eRows]: any = await conn.execute('SELECT id FROM users WHERE email=?', [data.email.toLowerCase()]);
    if (eRows.length) throw new BadRequestError('Email already exists');
    const userId = uuid();
    const empId = uuid();
    const tempPassword = generatePassword(10);
    const hash = await bcrypt.hash(tempPassword, 10);
    const role = data.role && ['HR','MANAGER','EMPLOYEE'].includes(data.role) ? data.role : 'EMPLOYEE';
    // Only ADMIN can create HR
    if (role === 'HR' && actor.role !== 'ADMIN') throw new AppError(403,'FORBIDDEN','Only Admin can create HR');
    await conn.execute('INSERT INTO users (id, company_id, login_id, email, password_hash, role, status, must_change_password) VALUES (?,?,?,?,?,?,?,1)',
      [userId, companyId, loginId, data.email.toLowerCase(), hash, role, 'ACTIVE']);
    await conn.execute('INSERT INTO employees (id, user_id, company_id, name, first_name, last_name, phone, department_id, designation, employment_type, date_of_joining, manager_id, lifecycle_state, location) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [empId, userId, companyId, `${data.firstName} ${data.lastName}`, data.firstName, data.lastName, data.phone || null, data.departmentId || null, data.designation || null, data.employmentType || 'FULL_TIME', data.dateOfJoining, data.managerId || null, 'ACTIVE', data.location || null]);
    await conn.commit();
    // email temp password (console in dev)
    await sendMail(data.email, 'Welcome to Dayflow — Your Login Credentials', `<p>Your Login ID: <b>${loginId}</b></p><p>Temp Password: <b>${tempPassword}</b></p><p>Please change it on first login.</p>`);
    return { userId, empId, loginId, tempPassword };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function getMe(userId: string) {
  const [rows]: any = await pool.execute(`
    SELECT u.id, u.login_id, u.email, u.role, u.status, u.must_change_password, u.company_id,
           e.id as employeeId, e.name, e.photo_url, e.department_id, d.name as departmentName, c.name as companyName, c.logo_url
    FROM users u
    LEFT JOIN employees e ON e.user_id=u.id
    LEFT JOIN departments d ON d.id=e.department_id
    LEFT JOIN companies c ON c.id=u.company_id
    WHERE u.id=?
  `, [userId]);
  return rows[0] || null;
}
