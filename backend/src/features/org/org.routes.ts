import { Router } from 'express';
import { pool } from '../../db/pool';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { getSettings, updateSettings } from './org.service';

const router=Router();
router.use(authMiddleware);
router.get('/', requireRole('ADMIN'), async(req,res,next)=>{ try{ const s=await getSettings((req as any).user.companyId); res.json({ data:s}); }catch(e){next(e);} });
router.patch('/', requireRole('ADMIN'), async(req,res,next)=>{ try{ const s=await updateSettings((req as any).user.companyId, req.body); res.json({ data:s}); }catch(e){next(e);} });
/** Company branding (ADMIN): name + logo (data URI or URL, ≤ 1.5 MB). */
router.patch('/company', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { name, logoUrl } = req.body || {};
    if (logoUrl && String(logoUrl).length > 1_500_000) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Logo too large (max ~1 MB)' } });
    const sets: string[] = []; const params: any[] = [];
    if (typeof name === 'string' && name.trim().length >= 2) { sets.push('name=?'); params.push(name.trim()); }
    if (logoUrl !== undefined) { sets.push('logo_url=?'); params.push(logoUrl || null); }
    if (!sets.length) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Nothing to update' } });
    params.push((req as any).user.companyId);
    await pool.execute(`UPDATE companies SET ${sets.join(', ')} WHERE id=?`, params);
    res.json({ data: { updated: true } });
  } catch (e) { next(e); }
});

export default router;
