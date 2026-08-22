import { Router } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { pool } from '../../db/pool';

const router=Router();
router.use(authMiddleware);
router.use(requireRole('ADMIN','HR','MANAGER'));

router.get('/attendance-summary', async(req,res,next)=>{
  try{
    const companyId=(req as any).user.companyId;
    const month=req.query.month as string || new Date().toISOString().slice(0,7);
    // per employee monthly summary
    const [rows]:any=await pool.execute(
      `SELECT e.id, e.name, d.name as department,
              SUM(CASE WHEN a.status='PRESENT' THEN 1 ELSE 0 END) as present,
              SUM(CASE WHEN a.status='HALF_DAY' THEN 1 ELSE 0 END) as half,
              SUM(CASE WHEN a.status='LEAVE' THEN 1 ELSE 0 END) as onLeave,
              SUM(CASE WHEN a.status='ABSENT' THEN 1 ELSE 0 END) as absent,
              SUM(CASE WHEN a.late_flag=1 THEN 1 ELSE 0 END) as late
       FROM employees e
       LEFT JOIN attendances a ON a.employee_id=e.id AND DATE_FORMAT(a.date,"%Y-%m")=?
       LEFT JOIN departments d ON d.id=e.department_id
       WHERE e.company_id=? GROUP BY e.id, e.name, d.name`,
      [month, companyId]
    );
    res.json({ data: rows });
  }catch(e){next(e);}
});

router.get('/leave-utilization', async(req,res,next)=>{
  try{
    const companyId=(req as any).user.companyId;
    const year=parseInt((req.query.year as string)||String(new Date().getFullYear()),10);
    const [rows]:any=await pool.execute(
      `SELECT lt.name, lt.code, COUNT(lr.id) as requests, COALESCE(SUM(CASE WHEN lr.status='APPROVED' THEN lr.days ELSE 0 END),0) as approvedDays
       FROM leave_types lt LEFT JOIN leave_requests lr ON lr.leave_type_id=lt.id AND YEAR(lr.start_date)=? AND lr.company_id=?
       WHERE lt.company_id=? GROUP BY lt.id, lt.name, lt.code`,
      [year, companyId, companyId]
    );
    res.json({ data: rows });
  }catch(e){next(e);}
});

router.get('/headcount', async(req,res,next)=>{
  try{
    const companyId=(req as any).user.companyId;
    const [rows]:any=await pool.execute(
      `SELECT d.name as department, COUNT(e.id) as count FROM departments d LEFT JOIN employees e ON e.department_id=d.id AND e.lifecycle_state='ACTIVE' WHERE d.company_id=? GROUP BY d.id, d.name`,
      [companyId]
    );
    const [total]:any=await pool.execute('SELECT COUNT(*) as total FROM employees WHERE company_id=? AND lifecycle_state="ACTIVE"', [companyId]);
    res.json({ data: { byDepartment: rows, total: total[0].total }});
  }catch(e){next(e);}
});

router.get('/late-arrivals', async(req,res,next)=>{
  try{
    const companyId=(req as any).user.companyId;
    const month=req.query.month as string || new Date().toISOString().slice(0,7);
    const [rows]:any=await pool.execute(
      `SELECT e.name, a.date, a.check_in FROM attendances a JOIN employees e ON e.id=a.employee_id WHERE a.company_id=? AND a.late_flag=1 AND DATE_FORMAT(a.date,"%Y-%m")=? ORDER BY a.date`,
      [companyId, month]
    );
    res.json({ data: rows });
  }catch(e){next(e);}
});

router.get('/export/attendance', async(req,res,next)=>{
  try{
    const companyId=(req as any).user.companyId;
    const from=req.query.from as string || new Date(new Date().setDate(1)).toISOString().slice(0,10);
    const to=req.query.to as string || new Date().toISOString().slice(0,10);
    const [rows]:any=await pool.execute(
      `SELECT e.name, e.id as employeeId, a.date, a.check_in, a.check_out, a.worked_minutes, a.status FROM attendances a JOIN employees e ON e.id=a.employee_id WHERE a.company_id=? AND a.date BETWEEN ? AND ? ORDER BY a.date, e.name`,
      [companyId, from, to]
    );
    // csv
    let csv='Employee,Date,Check In,Check Out,Worked Minutes,Status\n';
    for(const r of rows) csv+=`"${r.name}",${r.date},${r.check_in||''},${r.check_out||''},${r.worked_minutes||0},${r.status}\n`;
    res.header('Content-Type','text/csv');
    res.attachment(`attendance-${from}-${to}.csv`);
    res.send(csv);
  }catch(e){next(e);}
});

router.get('/dashboard-stats', async(req,res,next)=>{
  try{
    const companyId=(req as any).user.companyId;
    const today=new Date().toISOString().slice(0,10);
    const [head]:any=await pool.execute('SELECT COUNT(*) as total FROM employees WHERE company_id=? AND lifecycle_state="ACTIVE"', [companyId]);
    const [present]:any=await pool.execute('SELECT COUNT(*) as c FROM attendances WHERE company_id=? AND date=? AND status IN ("PRESENT","HALF_DAY")',[companyId, today]);
    const [pending]:any=await pool.execute('SELECT COUNT(*) as c FROM leave_requests WHERE company_id=? AND status="PENDING"', [companyId]);
    const [pendingReg]:any=await pool.execute('SELECT COUNT(*) as c FROM regularizations WHERE company_id=? AND status="PENDING"', [companyId]);
    // attendance trend last 7 days
    const [trend]:any=await pool.execute(
      `SELECT date, COUNT(*) as present FROM attendances WHERE company_id=? AND date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND status IN ('PRESENT','HALF_DAY','LEAVE') GROUP BY date ORDER BY date`,
      [companyId]
    );
    // leaves by type this month
    const [leavesByType]:any=await pool.execute(
      `SELECT lt.name, COUNT(lr.id) as count FROM leave_requests lr JOIN leave_types lt ON lt.id=lr.leave_type_id WHERE lr.company_id=? AND DATE_FORMAT(lr.start_date,"%Y-%m")=DATE_FORMAT(CURDATE(),"%Y-%m") GROUP BY lt.name`,
      [companyId]
    );
    // birthdays this week (if dob)
    const [birthdays]:any=await pool.execute(
      `SELECT name, dob FROM employees WHERE company_id=? AND dob IS NOT NULL AND WEEK(dob,1)=WEEK(CURDATE(),1) LIMIT 10`,
      [companyId]
    );
    res.json({ data: { headcount: head[0].total, presentToday: present[0].c, pendingLeaves: pending[0].c, pendingRegularizations: pendingReg[0].c, trend, leavesByType, birthdays }});
  }catch(e){next(e);}
});

export default router;
