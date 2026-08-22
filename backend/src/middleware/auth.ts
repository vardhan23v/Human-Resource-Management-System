import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { pool } from '../db/pool';

export interface AuthUser {
  id: string;
  companyId: string;
  email: string;
  role: 'ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE';
  loginId: string;
  employeeId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    let token: string | null = null;
    if (header?.startsWith('Bearer ')) token = header.slice(7);
    else if ((req as any).cookies?.accessToken) token = (req as any).cookies.accessToken;
    if (!token) throw new UnauthorizedError('Missing token');
    const payload: any = jwt.verify(token, env.JWT_SECRET);
    // optionally check user still active? quick query
    const [rows]: any = await pool.execute('SELECT id, company_id, email, role, login_id, status FROM users WHERE id=?', [payload.sub]);
    if (!rows.length) throw new UnauthorizedError('User not found');
    const u = rows[0];
    if (u.status === 'EXITED') throw new UnauthorizedError('Account deactivated');
    // fetch employeeId
    const [empRows]: any = await pool.execute('SELECT id FROM employees WHERE user_id=?', [u.id]);
    const empId = empRows[0]?.id;
    req.user = {
      id: u.id,
      companyId: u.company_id,
      email: u.email,
      role: u.role,
      loginId: u.login_id,
      employeeId: empId || undefined
    };
    next();
  } catch (e: any) {
    if (e.name === 'JsonWebTokenError' || e.name === 'TokenExpiredError') return next(new UnauthorizedError('Invalid or expired token'));
    next(e);
  }
}

export function requireRole(...roles: AuthUser['role'][]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new UnauthorizedError());
    if (!roles.includes(req.user.role)) return next(new ForbiddenError('Insufficient role'));
    next();
  };
}

// record-level ownership: employee can only access own employeeId unless HR/Admin/Manager (manager check done in service)
export function requireOwnershipOrHR(getEmployeeId: (req: Request) => string | undefined) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new UnauthorizedError());
    if (['ADMIN','HR'].includes(req.user.role)) return next();
    const target = getEmployeeId(req);
    if (!target) return next();
    // allow if target is own employeeId
    if (target === req.user.employeeId) return next();
    // for manager, allow if target reports to manager? This is checked deeper in service layer, here we allow through but service will enforce.
    if (req.user.role === 'MANAGER') return next();
    return next(new ForbiddenError('Access denied to this record'));
  };
}
