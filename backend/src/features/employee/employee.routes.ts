import { Router } from 'express';
import multer from 'multer';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { listEmployees, getEmployee, updateEmployee, uploadDocument, addSkill, addCertification, deleteSkill, deleteCertification, listDepartments, createDepartment } from './employee.service';
import { auditLog } from '../../middleware/audit';
import { storage, legacyKey } from '../../utils/storage';

const router = Router();
// Files are buffered in memory (5 MB cap) and handed to the storage adapter (local disk or S3/R2).
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5*1024*1024 } });

router.use(authMiddleware);

// Directory / list
router.get('/', async (req, res, next) => {
  try {
    const result = await listEmployees((req as any).user, req.query);
    res.json(result);
  } catch (e) { next(e); }
});

router.get('/departments/list', async (req, res, next) => {
  try {
    const rows = await listDepartments((req as any).user.companyId);
    res.json({ data: rows });
  } catch (e) { next(e); }
});
router.post('/departments', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { name } = req.body;
    const dep = await createDepartment((req as any).user, name);
    res.status(201).json({ data: dep });
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const emp = await getEmployee((req as any).user, req.params.id);
    res.json({ data: emp });
  } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { before, after } = await updateEmployee((req as any).user, req.params.id, req.body);
    await auditLog(req as any, 'UPDATE_EMPLOYEE', 'Employee', req.params.id, before, after);
    res.json({ data: after });
  } catch (e) { next(e); }
});

router.post('/:id/documents', upload.single('file'), async (req, res, next) => {
  try {
    const result = await uploadDocument((req as any).user, req.params.id, (req as any).file, req.body.category);
    await auditLog(req as any, 'UPLOAD_DOCUMENT', 'EmployeeDocument', result.id, null, { employeeId: req.params.id });
    res.status(201).json({ data: result });
  } catch (e) { next(e); }
});

router.get('/:id/documents/:docId/download', async (req, res, next) => {
  try {
    // permission check via getEmployee
    await getEmployee((req as any).user, req.params.id);
    const [rows]: any = await (await import('../../db/pool')).pool.execute('SELECT * FROM employee_documents WHERE id=? AND employee_id=?', [req.params.docId, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: { code:'NOT_FOUND', message:'Document not found'}});
    const doc = rows[0];
    const file = await storage.get(doc.storage_key || legacyKey(doc.storage_path));
    if (!file) return res.status(404).json({ error: { code:'NOT_FOUND', message:'File is no longer available'}});
    res.setHeader('Content-Type', doc.mime_type || file.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.original_name)}"`);
    res.send(file.body);
  } catch (e) { next(e); }
});

router.post('/:id/skills', async (req, res, next) => {
  try {
    const skill = await addSkill((req as any).user, req.params.id, req.body.name);
    res.status(201).json({ data: skill });
  } catch (e) { next(e); }
});
router.delete('/:id/skills/:skillId', async (req, res, next) => {
  try {
    await deleteSkill((req as any).user, req.params.id, req.params.skillId);
    res.json({ data: { message: 'Deleted' }});
  } catch(e){ next(e);}
});
router.post('/:id/certifications', async (req, res, next) => {
  try {
    const cert = await addCertification((req as any).user, req.params.id, req.body);
    res.status(201).json({ data: cert });
  } catch(e){ next(e); }
});
router.delete('/:id/certifications/:certId', async (req, res, next) => {
  try {
    await deleteCertification((req as any).user, req.params.id, req.params.certId);
    res.json({ data: { message: 'Deleted' }});
  } catch(e){ next(e);}
});

export default router;
