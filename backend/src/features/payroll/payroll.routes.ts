import { Router } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { getSalaryStructure, listSalaryStructures, upsertSalaryStructure, runPayroll, finalizePayroll, listPayslips, getPayslip, generatePayslipPdf } from './payroll.service';
import { auditLog } from '../../middleware/audit';

const router=Router();
router.use(authMiddleware);

router.get('/salary/:employeeId', async(req,res,next)=>{ try{ const s=await getSalaryStructure((req as any).user, req.params.employeeId); res.json({ data:s}); }catch(e){next(e);} });
router.get('/salary-structures/list', requireRole('ADMIN','HR'), async(req,res,next)=>{ try{ const rows=await listSalaryStructures((req as any).user); res.json({ data:rows}); }catch(e){next(e);} });
router.post('/salary', requireRole('ADMIN','HR'), async(req,res,next)=>{ try{ const r=await upsertSalaryStructure((req as any).user, req.body); await auditLog(req as any,'UPSERT_SALARY','SalaryStructure', r.id, null, r); res.json({ data:r}); }catch(e){next(e);} });

router.post('/run', requireRole('ADMIN','HR'), async(req,res,next)=>{ try{ const r=await runPayroll((req as any).user, req.body.month); await auditLog(req as any,'RUN_PAYROLL','Payslip', undefined, null, r); res.json({ data:r}); }catch(e){next(e);} });
router.post('/finalize', requireRole('ADMIN'), async(req,res,next)=>{ try{ const r=await finalizePayroll((req as any).user, req.body.month); await auditLog(req as any,'FINALIZE_PAYROLL','Payslip', undefined, null, r); res.json({ data:r}); }catch(e){next(e);} });
router.get('/payslips', async(req,res,next)=>{ try{ const rows=await listPayslips((req as any).user, req.query); res.json({ data:rows}); }catch(e){next(e);} });
router.get('/payslips/:id', async(req,res,next)=>{ try{ const p=await getPayslip((req as any).user, req.params.id); res.json({ data:p}); }catch(e){next(e);} });
router.get('/payslips/:id/pdf', async(req,res,next)=>{ try{
  const p=await getPayslip((req as any).user, req.params.id);
  if(p.pdf_url){
    const fs=require('fs'); const path=require('path'); const full=path.join(process.cwd(), p.pdf_url.replace('/storage', 'storage'));
    // alternative: env.STORAGE_PATH
    if(fs.existsSync(full)) return res.download(full, `payslip-${p.month}.pdf`);
  }
  // generate on fly
  const fp=await generatePayslipPdf(p.company_id, p.employee_id, typeof p.month==='string'? p.month.slice(0,10): new Date(p.month).toISOString().slice(0,10));
  if(fp) return res.download(fp);
  res.status(404).json({ error:{ code:'NOT_FOUND', message:'PDF not found'}});
}catch(e){next(e);} });

export default router;
