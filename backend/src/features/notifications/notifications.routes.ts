import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { pool } from '../../db/pool';
import { v4 as uuid } from 'uuid';

const router=Router();
router.use(authMiddleware);

router.get('/', async(req,res,next)=>{
  try{
    const userId=(req as any).user.id;
    const [rows]:any=await pool.execute('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50',[userId]);
    res.json({ data: rows.map((r:any)=> ({ ...r, payload: r.payload? JSON.parse(r.payload): null })) });
  }catch(e){next(e);}
});
router.post('/:id/read', async(req,res,next)=>{
  try{
    await pool.execute('UPDATE notifications SET is_read=1, read_at=NOW() WHERE id=? AND user_id=?',[req.params.id, (req as any).user.id]);
    res.json({ data:{ message:'Read' }});
  }catch(e){next(e);}
});
router.post('/read-all', async(req,res,next)=>{
  try{
    await pool.execute('UPDATE notifications SET is_read=1, read_at=NOW() WHERE user_id=? AND is_read=0',[(req as any).user.id]);
    res.json({ data:{ message:'All read' }});
  }catch(e){next(e);}
});

export default router;
