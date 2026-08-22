import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { ensureSchema } from './db/bootstrap';
import { initSentry } from './utils/observability';
import { storageDriverName } from './utils/storage';
import { mailDriverName } from './utils/mailer';
import { rateLimitDriverName } from './middleware/rateLimit';
import crypto from 'crypto';
import { openapi, docsHtml } from './docs/openapi';

initSentry();

import authRoutes from './features/auth/auth.routes';
import employeeRoutes from './features/employee/employee.routes';
import attendanceRoutes from './features/attendance/attendance.routes';
import holidayRoutes from './features/holiday/holiday.routes';
import orgRoutes from './features/org/org.routes';
import leaveRoutes from './features/leave/leave.routes';
import payrollRoutes from './features/payroll/payroll.routes';
import notificationRoutes from './features/notifications/notifications.routes';
import reportRoutes from './features/reports/reports.routes';
import auditRoutes from './features/audit/audit.routes';
import linkedinRoutes from './features/linkedin/linkedin.routes';

const app = express();

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin: (origin, cb) => {
    // allow same-origin/no-origin (curl, health checks), any listed origin, or '*'
    if (!origin || env.CORS_ORIGINS.includes('*') || env.CORS_ORIGINS.includes(origin)) return cb(null, true);
    // allow Vercel preview deployments of the frontend when the production domain is listed
    if (env.CORS_ORIGINS.some(o => o.endsWith('.vercel.app')) && /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) return cb(null, true);
    return cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// request logging with correlation
app.use((req,res,next)=>{
  const start=Date.now();
  // honour an upstream id (Vercel / proxies) so logs can be correlated end-to-end
  const id = (req.headers['x-request-id'] as string) || crypto.randomBytes(6).toString('hex');
  (req as any).correlationId=id;
  res.setHeader('X-Request-Id', id);
  res.on('finish', ()=> {
    if (req.url === '/api/health') return;
    console.log(JSON.stringify({ level:'info', requestId:id, method:req.method, url:req.originalUrl, status:res.statusCode, ms:Date.now()-start, user:(req as any).user?.id }));
  });
  next();
});

// static storage
app.use('/storage', express.static(path.resolve(env.STORAGE_PATH)));

// optional auto-migrate on first request (serverless bootstrap)
if ((process.env.AUTO_MIGRATE || '').toLowerCase() === 'true') {
  app.use('/api', (req, _res, next) => { if (req.path === '/health') return next(); ensureSchema().then(() => next(), next); });
}

// root landing + health
app.get('/', (_req,res)=> res.json({ name:'Dayflow HRMS API', version: env.APP_VERSION, health:'/api/health', apiDocs:'/api/docs', docs:'https://github.com/vardhan23v/Human-Resource-Management-System' }));
app.get('/api/health', (_req,res)=> res.json({ status:'ok', time: new Date().toISOString(), version: env.APP_VERSION, drivers: { storage: storageDriverName, mail: mailDriverName, rateLimit: rateLimitDriverName, sentry: !!env.SENTRY_DSN }, db: { host: env.DB_HOST, port: env.DB_PORT, name: env.DB_NAME, ssl: env.DB_SSL, fromUrl: !!process.env.DATABASE_URL, serverless: env.IS_VERCEL } }));

// API docs (OpenAPI 3 + Scalar UI; CSP relaxed for the CDN on this one route)
app.get('/api/openapi.json', (_req,res)=> res.json(openapi));
app.get('/api/docs', (_req,res)=> { res.setHeader('Content-Security-Policy', "default-src 'self' https://cdn.jsdelivr.net https://fonts.googleapis.com https://fonts.gstatic.com 'unsafe-inline' 'unsafe-eval' data: blob:"); res.type('html').send(docsHtml); });

// routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/org-settings', orgRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/linkedin', linkedinRoutes);

// 404
app.use('/api', (_req,res)=> res.status(404).json({ error:{ code:'NOT_FOUND', message:'API route not found'}}));

app.use(errorHandler);

export default app;
