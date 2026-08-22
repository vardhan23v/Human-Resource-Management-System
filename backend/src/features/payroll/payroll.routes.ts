import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { payrollRunSchema } from '../../utils/schemas';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { storage, legacyKey } from '../../utils/storage';
import { getSalaryStructure, listSalaryStructures, upsertSalaryStructure, runPayroll, finalizePayroll, listPayslips, getPayslip, generatePayslipPdf } from './payroll.service';
import { auditLog } from '../../middleware/audit';

const router=Router();
router.use(authMiddleware);

router.get('/salary/:employeeId', async(req,res,next)=>{ try{ const s=await getSalaryStructure((req as any).user, req.params.employeeId); res.json({ data:s}); }catch(e){next(e);} });
router.get('/salary-structures/list', requireRole('ADMIN','HR'), async(req,res,next)=>{ try{ const rows=await listSalaryStructures((req as any).user); res.json({ data:rows}); }catch(e){next(e);} });
router.post('/salary', requireRole('ADMIN','HR'), async(req,res,next)=>{ try{ const r=await upsertSalaryStructure((req as any).user, req.body); await auditLog(req as any,'UPSERT_SALARY','SalaryStructure', r.id, null, r); res.json({ data:r}); }catch(e){next(e);} });

router.post('/run', validate(payrollRunSchema), requireRole('ADMIN','HR'), async(req,res,next)=>{ try{ const r=await runPayroll((req as any).user, req.body.month); await auditLog(req as any,'RUN_PAYROLL','Payslip', undefined, null, r); res.json({ data:r}); }catch(e){next(e);} });
router.post('/finalize', requireRole('ADMIN'), async(req,res,next)=>{ try{ const r=await finalizePayroll((req as any).user, req.body.month); await auditLog(req as any,'FINALIZE_PAYROLL','Payslip', undefined, null, r); res.json({ data:r}); }catch(e){next(e);} });
router.get('/payslips', async(req,res,next)=>{ try{ const rows=await listPayslips((req as any).user, req.query); res.json({ data:rows}); }catch(e){next(e);} });
router.get('/payslips/:id', async(req,res,next)=>{ try{ const p=await getPayslip((req as any).user, req.params.id); res.json({ data:p}); }catch(e){next(e);} });
router.get('/payslips/:id/pdf', async(req,res,next)=>{ try{
  const p=await getPayslip((req as any).user, req.params.id);
  const monthDate = typeof p.month==='string'? p.month.slice(0,10): new Date(p.month).toISOString().slice(0,10);
  const send = (buf:Buffer)=>{ res.setHeader('Content-Type','application/pdf'); res.setHeader('Content-Disposition',`attachment; filename="payslip-${monthDate.slice(0,7)}.pdf"`); res.send(buf); };
  if(p.pdf_url){
    const existing = await storage.get(legacyKey(p.pdf_url));
    if(existing) return send(existing.body);
  }
  const gen=await generatePayslipPdf(p.company_id, p.employee_id, monthDate); // (re)generate if missing (e.g. ephemeral storage)
  if(gen) return send(gen.pdf);
  res.status(404).json({ error:{ code:'NOT_FOUND', message:'PDF not found'}});
}catch(e){next(e);} });

export default router;
