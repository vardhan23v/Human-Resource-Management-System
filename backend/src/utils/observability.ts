import { env } from '../config/env';

/** Optional Sentry — initialised only when SENTRY_DSN is set. */
let sentry: any = null;
export function initSentry() {
  if (!env.SENTRY_DSN || sentry) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    sentry = require('@sentry/node');
    sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV, release: `dayflow-api@${env.APP_VERSION}`, tracesSampleRate: 0.1 });
  } catch (e) { console.error('[sentry] init failed', e); }
}
export function captureError(err: unknown, context?: Record<string, any>) {
  if (!sentry) return;
  try { sentry.withScope((scope: any) => { if (context) scope.setContext('request', context); sentry.captureException(err); }); } catch { /* ignore */ }
}
