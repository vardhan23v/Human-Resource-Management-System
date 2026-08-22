import { Router } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { listHolidays, createHoliday, deleteHoliday } from './holiday.service';

const router=Router();
router.use(authMiddleware);
router.get('/', async(req,res,next)=>{ try{ const y= req.query.year ? parseInt(req.query.year as string,10): undefined; const rows=await listHolidays((req as any).user.companyId, y); res.json({ data:rows}); }catch(e){next(e);} });
router.post('/', requireRole('ADMIN'), async(req,res,next)=>{ try{ const h=await createHoliday((req as any).user.companyId, req.body); res.status(201).json({ data:h}); }catch(e){next(e);} });
router.delete('/:id', requireRole('ADMIN'), async(req,res,next)=>{ try{ await deleteHoliday((req as any).user.companyId, req.params.id); res.json({ data:{ message:'Deleted'}}); }catch(e){next(e);} });
export default router;
