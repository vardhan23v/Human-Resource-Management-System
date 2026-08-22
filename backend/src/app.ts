import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';

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
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
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

// health
app.get('/api/health', (_req,res)=> res.json({ status:'ok', time: new Date().toISOString(), version:'2.0.0' }));

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
