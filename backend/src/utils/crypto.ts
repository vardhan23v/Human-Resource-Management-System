import crypto from 'crypto';
import { env } from '../config/env';

/** AES-256-GCM for secrets at rest. Key = LINKEDIN_TOKEN_KEY (32 bytes, base64/hex) or derived from JWT_SECRET. */
function key(): Buffer {
  const raw = process.env.LINKEDIN_TOKEN_KEY;
  if (raw) {
    const b = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
    if (b.length === 32) return b;
  }
  return crypto.createHash('sha256').update(`dayflow-token-key:${env.JWT_SECRET}`).digest();
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return `v1.${iv.toString('base64')}.${c.getAuthTag().toString('base64')}.${enc.toString('base64')}`;
}

export function decrypt(blob: string): string {
  const [v, iv, tag, data] = blob.split('.');
  if (v !== 'v1') throw new Error('Unknown cipher version');
  const d = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8');
}
