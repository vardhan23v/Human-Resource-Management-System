import nodemailer from 'nodemailer';
import { env } from '../config/env';

/**
 * Email adapter. Priority: Resend (RESEND_API_KEY) → SMTP (SMTP_URL) → log-only (jsonTransport).
 * Failures never break the calling flow — they're logged and reported as { sent:false }.
 */
export const mailDriverName = env.RESEND_API_KEY ? 'resend' : env.SMTP_URL ? 'smtp' : 'log';

const smtp = env.SMTP_URL ? nodemailer.createTransport(env.SMTP_URL) : nodemailer.createTransport({ jsonTransport: true });
export const transporter = smtp;

export async function sendMail(to: string, subject: string, html: string): Promise<{ sent: boolean; id?: string; driver: string }> {
  try {
    if (env.RESEND_API_KEY) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, html }),
      });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `Resend ${res.status}`);
      return { sent: true, id: data?.id, driver: 'resend' };
    }
    const info: any = await smtp.sendMail({ from: env.EMAIL_FROM, to, subject, html });
    if (!env.SMTP_URL) { console.log('[mail:log]', { to, subject }); return { sent: false, driver: 'log' }; }
    return { sent: true, id: info?.messageId, driver: 'smtp' };
  } catch (e: any) {
    console.error('[mail] failed', { to, subject, error: e?.message });
    return { sent: false, driver: mailDriverName };
  }
}
