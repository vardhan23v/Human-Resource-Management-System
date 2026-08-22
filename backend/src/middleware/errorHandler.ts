import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error('[error]', err);
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  // database unreachable / misconfigured — surface a clear, actionable message
  const DB_CODES = ['ECONNREFUSED','ENOTFOUND','ETIMEDOUT','ER_ACCESS_DENIED_ERROR','ER_BAD_DB_ERROR','PROTOCOL_CONNECTION_LOST','HANDSHAKE_NO_SSL_SUPPORT'];
  if (err && DB_CODES.includes(err.code)) {
    return res.status(503).json({ error: { code: 'DATABASE_UNAVAILABLE', message: 'Database is not reachable. The API is running but DATABASE_URL / DB_* env vars are missing or wrong.' } });
  }
  // handle validation etc
  if (err.message && err.status) {
    return res.status(err.status).json({ error: { code: 'ERROR', message: err.message }});
  }
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
}
