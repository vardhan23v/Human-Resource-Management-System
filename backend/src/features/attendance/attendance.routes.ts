import { Router } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { checkIn, checkOut, getTodayStatus, listAttendance, getAttendanceCalendar, requestRegularization, listRegularizations, decideRegularization } from './attendance.service';
import { auditLog } from '../../middleware/audit';

const router = Router();
router.use(authMiddleware);

router.post('/check-in', async (req, res, next) => {
  try { const r = await checkIn((req as any).user, req.ip, req.headers['user-agent']); await auditLog(req as any, 'CHECK_IN','Attendance', r.id); res.json({ data: r }); } catch(e){next(e);}
});
router.post('/check-out', async (req, res, next) => {
  try { const r = await checkOut((req as any).user); await auditLog(req as any,'CHECK_OUT','Attendance', (req as any).user.employeeId); res.json({ data: r });}catch(e){next(e);}
});
router.get('/today', async (req,res,next)=>{ try{ const r=await getTodayStatus((req as any).user); res.json({ data:r}); }catch(e){next(e);} });
router.get('/', async (req,res,next)=>{ try{ const r=await listAttendance((req as any).user, req.query); res.json(r);}catch(e){next(e);} });
router.get('/calendar', async (req,res,next)=>{ try{ const empId = req.query.employeeId as string || (req as any).user.employeeId; const ym = req.query.month as string || new Date().toISOString().slice(0,7); const rows=await getAttendanceCalendar((req as any).user, empId, ym); res.json({ data: rows}); }catch(e){next(e);} });

router.post('/regularizations', async (req,res,next)=>{ try{ const r=await requestRegularization((req as any).user, req.body); await auditLog(req as any,'REQUEST_REGULARIZATION','Regularization', r.id); res.status(201).json({ data:r}); }catch(e){next(e);} });
router.get('/regularizations/list', async (req,res,next)=>{ try{ const rows=await listRegularizations((req as any).user, req.query); res.json({ data:rows}); }catch(e){next(e);} });
router.post('/regularizations/:id/decide', requireRole('ADMIN','HR','MANAGER'), async (req,res,next)=>{ try{ const r=await decideRegularization((req as any).user, req.params.id, req.body.action, req.body.comment); await auditLog(req as any,'DECIDE_REGULARIZATION','Regularization', req.params.id, null, r); res.json({ data:r}); }catch(e){next(e);} });

export default router;
