import { pool } from '../db/pool';
import { uuid } from '../utils/helpers';
import { Request } from 'express';

export async function auditLog(req: Request, action: string, entity: string, entityId?: string, before?: any, after?: any) {
  try {
    const actorId = (req as any).user?.id || null;
    const companyId = (req as any).user?.companyId || null;
    const ip = req.ip;
    const ua = req.headers['user-agent']?.slice(0, 512) || null;
    await pool.execute(
      'INSERT INTO audit_logs (id, actor_id, company_id, action, entity, entity_id, before_json, after_json, ip_address, user_agent, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,NOW())',
      [uuid(), actorId, companyId, action, entity, entityId || null, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null, ip, ua]
    );
  } catch (e) {
    console.error('audit log failed', e);
  }
}
