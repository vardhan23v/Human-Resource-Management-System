import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { auditLog } from '../../middleware/audit';
import { env } from '../../config/env';
import { buildAuthorizationUrl, verifyState, completeConnection, getStatus, disconnect, createPost, isConfigured, checkCredentials } from './linkedin.service';
import { requireRole } from '../../middleware/auth';

const router = Router();

function back(res: any, userId: string | null, params: Record<string, string>) {
  const q = new URLSearchParams(params).toString();
  res.redirect(`${env.FRONTEND_URL.replace(/\/+$/, '')}/linkedin/return?${q}`);
}

/** OAuth callback — public (LinkedIn redirects the browser here); the user is bound via the signed state. */
router.get('/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query as Record<string, string | undefined>;
  let userId: string | null = null;
  try {
    userId = verifyState(state);
    if (error) return back(res, userId, { status: 'error', code: error === 'user_cancelled_authorize' || error === 'user_cancelled_login' ? 'LINKEDIN_DENIED' : error, message: error_description || 'LinkedIn authorization was not completed.' });
    if (!code) return back(res, userId, { status: 'error', code: 'LINKEDIN_NO_CODE', message: 'LinkedIn did not return an authorization code.' });
    await completeConnection(userId, code);
    await auditLog(req, 'LINKEDIN_CONNECT', 'linkedin_accounts', userId);
    return back(res, userId, { status: 'connected' });
  } catch (e: any) {
    console.error('[linkedin callback]', e?.code || e?.message);
    return back(res, userId, { status: 'error', code: e?.code || 'LINKEDIN_CALLBACK_FAILED', message: e?.message || 'Could not connect LinkedIn.' });
  }
});

router.use(authMiddleware);

router.get('/status', async (req, res, next) => {
  try { res.json({ data: await getStatus(req.user!.id) }); } catch (e) { next(e); }
});

/** Admin-only: verifies the configured client id/secret against LinkedIn and echoes the redirect URI in use. */
router.get('/diagnostics', requireRole('ADMIN'), async (_req, res, next) => {
  try { res.json({ data: { redirectUri: env.LINKEDIN_REDIRECT_URI, frontendUrl: env.FRONTEND_URL, clientIdSuffix: env.LINKEDIN_CLIENT_ID.slice(-4), apiVersion: env.LINKEDIN_API_VERSION, credentials: await checkCredentials() } }); } catch (e) { next(e); }
});

router.get('/connect', (req, res, next) => {
  try {
    if (!isConfigured()) return res.status(503).json({ error: { code: 'LINKEDIN_NOT_CONFIGURED', message: 'LinkedIn integration is not configured on this server.' } });
    res.json({ data: { url: buildAuthorizationUrl(req.user!.id) } });
  } catch (e) { next(e); }
});

router.post('/disconnect', async (req, res, next) => {
  try {
    const removed = await disconnect(req.user!.id);
    if (removed) await auditLog(req, 'LINKEDIN_DISCONNECT', 'linkedin_accounts', req.user!.id);
    res.json({ data: { disconnected: removed } });
  } catch (e) { next(e); }
});

router.post('/posts', async (req, res, next) => {
  try {
    const result = await createPost(req.user!.id, { text: req.body?.text, url: req.body?.url, title: req.body?.title });
    await auditLog(req, 'LINKEDIN_POST', 'linkedin_posts', result.postUrn || undefined, null, { hasUrl: !!req.body?.url, length: String(req.body?.text || '').length });
    res.status(201).json({ data: result });
  } catch (e) { next(e); }
});

export default router;
