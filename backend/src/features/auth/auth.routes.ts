import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { loginSchema, signupSchema } from '../../utils/schemas';
import { signupCompany, login, refresh, logout, forgotPassword, resetPassword, changePassword, getMe, createEmployee } from './auth.service';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { BadRequestError } from '../../utils/errors';
import { auditLog } from '../../middleware/audit';

const router = Router();

// POST /api/auth/signup — company registration (first admin)
router.post('/signup', validate(signupSchema), async (req, res, next) => {
  try {
    const { companyName, name, email, password, confirmPassword, logoUrl } = req.body;
    if (!companyName || !name || !email || !password) throw new BadRequestError('Missing required fields');
    if (password !== confirmPassword) throw new BadRequestError('Passwords do not match');
    if (password.length < 8) throw new BadRequestError('Password min 8 chars');
    const result = await signupCompany({ companyName, name, email, password, logoUrl });
    await auditLog(req as any, 'COMPANY_SIGNUP', 'Company', result.companyId, null, { companyName, adminEmail: email });
    // set cookies
    res.cookie('accessToken', result.accessToken, { httpOnly: true, sameSite: 'lax', maxAge: 15*60*1000 });
    res.cookie('refreshToken', result.refreshToken, { httpOnly: true, sameSite: 'lax', maxAge: 7*24*60*60*1000 });
    res.status(201).json({ data: { user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken } });
  } catch (e) { next(e); }
});

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { identifier, email, loginId, password } = req.body;
    const id = identifier || email || loginId;
    if (!id || !password) throw new BadRequestError('identifier/email and password required');
    const result = await login(id, password, req.ip);
    res.cookie('accessToken', result.accessToken, { httpOnly: true, sameSite: 'lax', maxAge: 15*60*1000 });
    res.cookie('refreshToken', result.refreshToken, { httpOnly: true, sameSite: 'lax', maxAge: 7*24*60*60*1000 });
    res.json({ data: result });
  } catch (e) { next(e); }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const token = req.body.refreshToken || req.cookies?.refreshToken;
    if (!token) throw new BadRequestError('refreshToken required');
    const result = await refresh(token);
    res.cookie('accessToken', result.accessToken, { httpOnly: true, sameSite: 'lax', maxAge: 15*60*1000 });
    res.cookie('refreshToken', result.refreshToken, { httpOnly: true, sameSite: 'lax', maxAge: 7*24*60*60*1000 });
    res.json({ data: result });
  } catch (e) { next(e); }
});

router.post('/logout', async (req, res, next) => {
  try {
    const token = req.body.refreshToken || req.cookies?.refreshToken;
    if (token) await logout(token);
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.json({ data: { message: 'Logged out' } });
  } catch (e) { next(e); }
});

router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) throw new BadRequestError('email required');
    const token = await forgotPassword(email);
    // in dev return token for testing
    res.json({ data: { message: 'If account exists, reset email sent', token } });
  } catch (e) { next(e); }
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) throw new BadRequestError('token and password required');
    await resetPassword(token, password);
    res.json({ data: { message: 'Password reset successful' } });
  } catch (e) { next(e); }
});

router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const me = await getMe((req as any).user.id);
    res.json({ data: me });
  } catch (e) { next(e); }
});

router.post('/change-password', authMiddleware, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) throw new BadRequestError('currentPassword and newPassword required');
    if (newPassword.length < 8) throw new BadRequestError('New password too weak');
    await changePassword((req as any).user.id, currentPassword, newPassword);
    await auditLog(req as any, 'CHANGE_PASSWORD', 'User', (req as any).user.id);
    res.json({ data: { message: 'Password changed' } });
  } catch (e) { next(e); }
});

// Admin/HR creates employee
router.post('/employees', authMiddleware, requireRole('ADMIN','HR'), async (req, res, next) => {
  try {
    const result = await createEmployee((req as any).user, req.body);
    await auditLog(req as any, 'CREATE_EMPLOYEE', 'Employee', result.empId, null, { loginId: result.loginId, email: req.body.email });
    res.status(201).json({ data: result });
  } catch (e) { next(e); }
});

export default router;
