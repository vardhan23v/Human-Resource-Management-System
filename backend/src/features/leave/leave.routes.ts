import { Router } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { listLeaveTypes, createLeaveType, updateLeaveType, getBalances, applyLeave, listLeaveRequests, decideLeave, cancelLeave, getLeaveCalendar, ensureBalances } from './leave.service';
import { auditLog } from '../../middleware/audit';
import { pool } from '../../db/pool';

const router=Router();
router.use(authMiddleware);

router.get('/types', async(req,res,next)=>{ try{ const rows=await listLeaveTypes((req as any).user.companyId); res.json({ data:rows}); }catch(e){next(e);} });
router.post('/types', requireRole('ADMIN'), async(req,res,next)=>{ try{ const t=await createLeaveType((req as any).user.companyId, req.body); await auditLog(req as any,'CREATE_LEAVE_TYPE','LeaveType', t.id); res.status(201).json({ data:t}); }catch(e){next(e);} });
router.patch('/types/:id', requireRole('ADMIN'), async(req,res,next)=>{ try{ const r=await updateLeaveType((req as any).user.companyId, req.params.id, req.body); res.json({ data:r}); }catch(e){next(e);} });

router.get('/balances', async(req,res,next)=>{ try{ const empId= req.query.employeeId as string || (req as any).user.employeeId; const year= req.query.year? parseInt(req.query.year as string,10): new Date().getFullYear(); await ensureBalances(empId, (req as any).user.companyId, year); const rows=await getBalances(empId, year); res.json({ data:rows}); }catch(e){next(e);} });
router.post('/requests', async(req,res,next)=>{ try{ const r=await applyLeave((req as any).user, req.body); await auditLog(req as any,'APPLY_LEAVE','LeaveRequest', r.id); // notify approvers (in-app)
  try{
    // create notification for HR/Admins
    const [hrs]:any=await pool.execute('SELECT id FROM users WHERE company_id=? AND role IN ("HR","ADMIN")',[(req as any).user.companyId]);
    for(const h of hrs){
      await pool.execute('INSERT INTO notifications (id, user_id, company_id, type, title, payload) VALUES (?,?,?,?,?,?)', [require('uuid').v4(), h.id, (req as any).user.companyId, 'LEAVE_APPLIED', 'New leave request', JSON.stringify({ requestId:r.id, employee: (req as any).user.id })]);
    }
  }catch{}
  res.status(201).json({ data:r}); }catch(e){next(e);} });
router.get('/requests', async(req,res,next)=>{ try{ const rows=await listLeaveRequests((req as any).user, req.query); res.json({ data:rows}); }catch(e){next(e);} });
router.post('/requests/:id/decide', requireRole('ADMIN','HR','MANAGER'), async(req,res,next)=>{ try{ const r=await decideLeave((req as any).user, req.params.id, req.body.action, req.body.comment); await auditLog(req as any,'DECIDE_LEAVE','LeaveRequest', req.params.id, null, r);
  // notify employee
  try{
    const [lrRows]:any=await pool.execute('SELECT employee_id FROM leave_requests WHERE id=?',[req.params.id]);
    if(lrRows.length){
      const [empRows]:any=await pool.execute('SELECT user_id FROM employees WHERE id=?',[lrRows[0].employee_id]);
      if(empRows.length){
        await pool.execute('INSERT INTO notifications (id, user_id, company_id, type, title, payload) VALUES (?,?,?,?,?,?)', [require('uuid').v4(), empRows[0].user_id, (req as any).user.companyId, 'LEAVE_DECIDED', `Leave ${req.body.action}`, JSON.stringify({ requestId:req.params.id, action:req.body.action })]);
      }
    }
  }catch{}
  res.json({ data:r}); }catch(e){next(e);} });
router.post('/requests/:id/cancel', async(req,res,next)=>{ try{ const r=await cancelLeave((req as any).user, req.params.id, req.body.reason); await auditLog(req as any,'CANCEL_LEAVE','LeaveRequest', req.params.id, null, r); res.json({ data:r}); }catch(e){next(e);} });
router.get('/calendar', async(req,res,next)=>{ try{ const empId= req.query.employeeId as string || (req as any).user.employeeId; const year= parseInt((req.query.year as string)|| String(new Date().getFullYear()),10); const rows=await getLeaveCalendar((req as any).user, empId, year); res.json({ data:rows}); }catch(e){next(e);} });

export default router;
