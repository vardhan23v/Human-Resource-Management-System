import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { ensureSchema } from './db/bootstrap';

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
app.use((req,_res,next)=>{
  const start=Date.now();
  const id=Math.random().toString(36).slice(2,8);
  (req as any).correlationId=id;
  console.log(`[${id}] ${req.method} ${req.url}`);
  const origEnd = _res.end.bind(_res);
  // @ts-ignore
  _res.end = (...args:any[])=> {
    console.log(`[${id}] -> ${_res.statusCode} ${Date.now()-start}ms`);
    return origEnd(...args);
  };
  next();
});

// static storage
app.use('/storage', express.static(path.resolve(env.STORAGE_PATH)));

// optional auto-migrate on first request (serverless bootstrap)
if ((process.env.AUTO_MIGRATE || '').toLowerCase() === 'true') {
  app.use('/api', (req, _res, next) => { if (req.path === '/health') return next(); ensureSchema().then(() => next(), next); });
}

// root landing + health
app.get('/', (_req,res)=> res.json({ name:'Dayflow HRMS API', version:'2.1.0', health:'/api/health', docs:'https://github.com/vardhan23v/Human-Resource-Management-System' }));
app.get('/api/health', (_req,res)=> res.json({ status:'ok', time: new Date().toISOString(), version:'2.1.0', db: { host: env.DB_HOST, port: env.DB_PORT, name: env.DB_NAME, ssl: env.DB_SSL, fromUrl: !!process.env.DATABASE_URL, serverless: env.IS_VERCEL } }));

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

// 404
app.use('/api', (_req,res)=> res.status(404).json({ error:{ code:'NOT_FOUND', message:'API route not found'}}));

app.use(errorHandler);

export default app;
