import nodemailer from 'nodemailer';
import { env } from '../config/env';

export const transporter = nodemailer.createTransport(
  env.NODE_ENV === 'development'
    ? { jsonTransport: true } // console-like in dev (logs to console)
    : { jsonTransport: true }
);

export async function sendMail(to: string, subject: string, html: string) {
  const info = await transporter.sendMail({ from: env.EMAIL_FROM, to, subject, html });
  console.log('[mail]', { to, subject, info: (info as any).message || info });
}
