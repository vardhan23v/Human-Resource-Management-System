import { Router } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { getSettings, updateSettings } from './org.service';

const router=Router();
router.use(authMiddleware);
router.get('/', requireRole('ADMIN'), async(req,res,next)=>{ try{ const s=await getSettings((req as any).user.companyId); res.json({ data:s}); }catch(e){next(e);} });
router.patch('/', requireRole('ADMIN'), async(req,res,next)=>{ try{ const s=await updateSettings((req as any).user.companyId, req.body); res.json({ data:s}); }catch(e){next(e);} });
export default router;
