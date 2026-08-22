import { Router } from 'express';
import { parseJsonColumn } from '../../utils/json';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { pool } from '../../db/pool';

const router=Router();
router.use(authMiddleware);
router.use(requireRole('ADMIN','HR'));

router.get('/', async(req,res,next)=>{
  try{
    const companyId=(req as any).user.companyId;
    const limit=Math.min(100, parseInt(req.query.limit as string||'50',10));
    const entity=req.query.entity as string;
    let sql='SELECT * FROM audit_logs WHERE company_id=?';
    const params:any[]=[companyId];
    if(entity){ sql+=' AND entity=?'; params.push(entity); }
    sql+=' ORDER BY created_at DESC LIMIT ?'; params.push(String(limit));
    const [rows]:any=await pool.execute(sql, params);
    res.json({ data: rows.map((r:any)=> ({ ...r, before: parseJsonColumn(r.before_json), after: parseJsonColumn(r.after_json) })) });
  }catch(e){next(e);}
});

export default router;
