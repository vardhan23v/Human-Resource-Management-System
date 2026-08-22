import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { captureError } from '../utils/observability';

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const requestId = (req as any).correlationId;
  if (err instanceof AppError && err.statusCode < 500) {
    // expected client errors — no stack noise
  } else {
    console.error(JSON.stringify({ level: 'error', requestId, method: req.method, url: req.originalUrl, code: err?.code, message: err?.message }));
    captureError(err, { requestId, method: req.method, url: req.originalUrl, user: (req as any).user?.id });
  }
  res.setHeader('X-Request-Id', requestId || '');
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  // database unreachable / misconfigured — surface the driver code so it's actionable
  const DB_CODES = ['ECONNREFUSED','ENOTFOUND','ETIMEDOUT','ECONNRESET','ER_ACCESS_DENIED_ERROR','ER_BAD_DB_ERROR','PROTOCOL_CONNECTION_LOST','HANDSHAKE_NO_SSL_SUPPORT','ER_NO_SUCH_TABLE','HANDSHAKE_SSL_ERROR'];
  if (err && DB_CODES.includes(err.code)) {
    return res.status(503).json({ error: { code: 'DATABASE_UNAVAILABLE', message: `Database error (${err.code}). Check DATABASE_URL / DB_* / DB_SSL env vars.`, details: { driverCode: err.code } } });
  }
  // handle validation etc
  if (err.message && err.status) {
    return res.status(err.status).json({ error: { code: 'ERROR', message: err.message }});
  }
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
}
