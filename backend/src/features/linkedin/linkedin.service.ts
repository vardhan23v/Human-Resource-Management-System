import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { pool } from '../../db/pool';
import { env } from '../../config/env';
import { encrypt, decrypt } from '../../utils/crypto';
import { AppError, BadRequestError, NotFoundError } from '../../utils/errors';

/**
 * LinkedIn integration — official APIs only.
 *  - Profile:  "Sign In with LinkedIn using OpenID Connect"  → scopes openid profile email → GET /v2/userinfo
 *  - Posting:  "Share on LinkedIn"                            → scope  w_member_social      → POST /rest/posts
 * Access tokens (60-day, no refresh token for standard apps) are AES-256-GCM encrypted at rest and never leave the server.
 */
const AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const REVOKE_URL = 'https://www.linkedin.com/oauth/v2/revoke';
const USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';
const POSTS_URL = 'https://api.linkedin.com/rest/posts';
const SCOPES = ['openid', 'profile', 'email', 'w_member_social'];
const TIMEOUT_MS = 10_000;

export class LinkedInError extends AppError {
  constructor(statusCode: number, code: string, message: string, details?: any) { super(statusCode, code, message, details); }
}

export function isConfigured() { return !!(env.LINKEDIN_CLIENT_ID && env.LINKEDIN_CLIENT_SECRET); }
function assertConfigured() {
  if (!isConfigured()) throw new LinkedInError(503, 'LINKEDIN_NOT_CONFIGURED', 'LinkedIn integration is not configured on this server.');
}

async function http(url: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), init.timeoutMs ?? TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new LinkedInError(504, 'LINKEDIN_TIMEOUT', 'LinkedIn did not respond in time. Please try again.');
    throw new LinkedInError(502, 'LINKEDIN_NETWORK', 'Could not reach LinkedIn. Please try again.');
  } finally { clearTimeout(t); }
}

/** Map LinkedIn HTTP failures to user-facing errors (never leaks tokens). */
async function raise(res: Response, fallback: string): Promise<never> {
  const body: any = await res.json().catch(() => ({}));
  const msg = body?.message || body?.error_description || body?.error || fallback;
  if (res.status === 401) throw new LinkedInError(401, 'LINKEDIN_TOKEN_INVALID', 'Your LinkedIn connection has expired. Please reconnect.', { linkedin: msg });
  if (res.status === 403) throw new LinkedInError(403, 'LINKEDIN_PERMISSION', 'LinkedIn refused this action — the app lacks the required permission (product) for it.', { linkedin: msg });
  if (res.status === 429) throw new LinkedInError(429, 'LINKEDIN_RATE_LIMITED', 'LinkedIn rate limit reached. Please try again later.', { linkedin: msg });
  if (res.status === 426) throw new LinkedInError(502, 'LINKEDIN_API_VERSION', `LinkedIn rejected API version ${env.LINKEDIN_API_VERSION}. Set LINKEDIN_API_VERSION to a current YYYYMM.`, { linkedin: msg });
  throw new LinkedInError(502, 'LINKEDIN_API_ERROR', msg || fallback, { status: res.status });
}

// ───────────── OAuth ─────────────

/** Stateless CSRF state: short-lived JWT bound to the app user (works across serverless instances). */
export function buildAuthorizationUrl(userId: string) {
  assertConfigured();
  const state = jwt.sign({ sub: userId, n: crypto.randomBytes(8).toString('hex'), p: 'linkedin' }, env.JWT_SECRET, { expiresIn: '10m' });
  const q = new URLSearchParams({ response_type: 'code', client_id: env.LINKEDIN_CLIENT_ID, redirect_uri: env.LINKEDIN_REDIRECT_URI, scope: SCOPES.join(' '), state });
  return `${AUTH_URL}?${q}`;
}

export function verifyState(state?: string): string {
  if (!state) throw new BadRequestError('Missing OAuth state');
  try {
    const p: any = jwt.verify(state, env.JWT_SECRET);
    if (p.p !== 'linkedin' || !p.sub) throw new Error('bad');
    return p.sub as string;
  } catch { throw new LinkedInError(400, 'LINKEDIN_INVALID_STATE', 'Invalid or expired sign-in state. Please start again.'); }
}

async function exchangeCode(code: string) {
  const res = await http(TOKEN_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: env.LINKEDIN_REDIRECT_URI, client_id: env.LINKEDIN_CLIENT_ID, client_secret: env.LINKEDIN_CLIENT_SECRET }),
  });
  if (!res.ok) await raise(res, 'Token exchange failed');
  return res.json() as Promise<{ access_token: string; expires_in: number; scope?: string }>;
}

async function fetchUserInfo(accessToken: string) {
  const res = await http(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) await raise(res, 'Could not read LinkedIn profile');
  return res.json() as Promise<{ sub: string; name?: string; given_name?: string; family_name?: string; picture?: string; email?: string }>;
}

export async function completeConnection(userId: string, code: string) {
  assertConfigured();
  const [urows]: any = await pool.execute('SELECT id, company_id FROM users WHERE id=?', [userId]);
  if (!urows.length) throw new NotFoundError('User not found');
  const tok = await exchangeCode(code);
  const me = await fetchUserInfo(tok.access_token);

  // Duplicate guard: one LinkedIn member ↔ one app user
  const [dup]: any = await pool.execute('SELECT user_id FROM linkedin_accounts WHERE linkedin_member_id=? AND user_id<>?', [me.sub, userId]);
  if (dup.length) throw new LinkedInError(409, 'LINKEDIN_ALREADY_LINKED', 'This LinkedIn account is already connected to another Dayflow user.');

  const expiresAt = new Date(Date.now() + (tok.expires_in || 3600) * 1000);
  await pool.execute(
    `INSERT INTO linkedin_accounts (id, user_id, company_id, linkedin_member_id, name, first_name, last_name, picture_url, email, scopes, access_token_enc, expires_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE linkedin_member_id=VALUES(linkedin_member_id), name=VALUES(name), first_name=VALUES(first_name), last_name=VALUES(last_name),
       picture_url=VALUES(picture_url), email=VALUES(email), scopes=VALUES(scopes), access_token_enc=VALUES(access_token_enc), expires_at=VALUES(expires_at)`,
    [uuid(), userId, urows[0].company_id, me.sub, me.name || null, me.given_name || null, me.family_name || null, me.picture || null, me.email || null,
     tok.scope || SCOPES.join(' '), encrypt(tok.access_token), expiresAt]);
  return { profile: publicProfile(await getRow(userId)), companyId: urows[0].company_id as string };
}

// ───────────── Account state ─────────────

async function getRow(userId: string) {
  const [rows]: any = await pool.execute('SELECT * FROM linkedin_accounts WHERE user_id=?', [userId]);
  return rows[0] || null;
}

/** Safe shape for the client — never includes the token. */
function publicProfile(r: any) {
  if (!r) return null;
  const expired = new Date(r.expires_at).getTime() < Date.now();
  return {
    memberId: r.linkedin_member_id,
    urn: `urn:li:person:${r.linkedin_member_id}`,
    name: r.name, firstName: r.first_name, lastName: r.last_name, picture: r.picture_url, email: r.email,
    scopes: String(r.scopes || '').split(/[ ,]+/).filter(Boolean),
    canPost: String(r.scopes || '').includes('w_member_social') && !expired,
    profileUrl: null as string | null, // vanity URL requires r_basicprofile (partner-only) — not available via OIDC
    connectedAt: r.created_at, expiresAt: r.expires_at, expired,
  };
}

/** Admin diagnostic: probes LinkedIn's token endpoint with client credentials. A wrong secret yields `invalid_client`. */
export async function checkCredentials() {
  if (!isConfigured()) return { ok: false, reason: 'not_configured' };
  try {
    const res = await http(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: env.LINKEDIN_CLIENT_ID, client_secret: env.LINKEDIN_CLIENT_SECRET }) });
    const body: any = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, reason: 'client_credentials_accepted' };
    const err = String(body?.error || '');
    // unauthorized_client / access_denied = credentials fine but 2-legged flow not enabled (normal). invalid_client = bad id/secret.
    if (err === 'invalid_client') return { ok: false, reason: 'invalid_client', detail: body?.error_description };
    return { ok: true, reason: err || `http_${res.status}`, detail: body?.error_description };
  } catch (e: any) { return { ok: false, reason: e?.code || 'network' }; }
}

export async function getStatus(userId: string) {
  const r = await getRow(userId);
  return { configured: isConfigured(), connected: !!r, profile: publicProfile(r) };
}

export async function disconnect(userId: string) {
  const r = await getRow(userId);
  if (!r) return false;
  // Best-effort revoke at LinkedIn; local removal happens regardless.
  try {
    await http(REVOKE_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: env.LINKEDIN_CLIENT_ID, client_secret: env.LINKEDIN_CLIENT_SECRET, token: decrypt(r.access_token_enc) }), timeoutMs: 5000 });
  } catch { /* ignore */ }
  await pool.execute('DELETE FROM linkedin_accounts WHERE user_id=?', [userId]);
  return true;
}

// ───────────── Posting ─────────────

export async function createPost(userId: string, input: { text: string; url?: string; title?: string }) {
  const r = await getRow(userId);
  if (!r) throw new LinkedInError(400, 'LINKEDIN_NOT_CONNECTED', 'Connect your LinkedIn account first.');
  if (new Date(r.expires_at).getTime() < Date.now()) throw new LinkedInError(401, 'LINKEDIN_TOKEN_INVALID', 'Your LinkedIn connection has expired. Please reconnect.');
  if (!String(r.scopes).includes('w_member_social')) throw new LinkedInError(403, 'LINKEDIN_PERMISSION', 'Posting requires the w_member_social permission. Reconnect to grant it.');

  const text = String(input.text || '').trim();
  if (!text) throw new BadRequestError('Post text is required');
  if (text.length > 3000) throw new BadRequestError('Post text must be 3000 characters or fewer');
  let url: string | undefined;
  if (input.url) {
    try { const u = new URL(String(input.url).trim()); if (!['http:', 'https:'].includes(u.protocol)) throw 0; url = u.toString(); }
    catch { throw new BadRequestError('Article URL must be a valid http(s) link'); }
  }

  const body: any = {
    author: `urn:li:person:${r.linkedin_member_id}`,
    commentary: text,
    visibility: 'PUBLIC',
    distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };
  if (url) body.content = { article: { source: url, title: (input.title || '').trim().slice(0, 200) || url } };

  const res = await http(POSTS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${decrypt(r.access_token_enc)}`, 'Content-Type': 'application/json', 'X-Restli-Protocol-Version': '2.0.0', 'LinkedIn-Version': env.LINKEDIN_API_VERSION },
    body: JSON.stringify(body),
  });
  if (!res.ok) await raise(res, 'LinkedIn rejected the post');
  const postUrn = res.headers.get('x-restli-id') || res.headers.get('x-linkedin-id') || null;
  return { postUrn, url: postUrn ? `https://www.linkedin.com/feed/update/${postUrn}/` : null };
}
