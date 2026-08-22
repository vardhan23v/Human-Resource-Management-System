import dotenv from 'dotenv';
dotenv.config();

const IS_VERCEL = !!process.env.VERCEL;

/** Optional single-URL DB config (mysql://user:pass@host:port/db) — overrides discrete DB_* vars when present. */
function parseDatabaseUrl(url?: string) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: u.port ? parseInt(u.port, 10) : 3306,
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, ''),
      ssl: u.searchParams.get('ssl') === 'true' || u.searchParams.get('sslmode') === 'require' || u.searchParams.has('ssl-mode'),
    };
  } catch { return null; }
}
const dbUrl = parseDatabaseUrl(process.env.DATABASE_URL);

export const env = {
  PORT: parseInt(process.env.PORT || '4000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_VERCEL,
  DB_HOST: dbUrl?.host || process.env.DB_HOST || 'localhost',
  DB_PORT: dbUrl?.port || parseInt(process.env.DB_PORT || '3306', 10),
  DB_USER: dbUrl?.user || process.env.DB_USER || 'root',
  DB_PASSWORD: dbUrl?.password ?? (process.env.DB_PASSWORD || ''),
  DB_NAME: dbUrl?.database || process.env.DB_NAME || 'dayflow',
  /** Hosted MySQL providers (Aiven, PlanetScale, Railway, TiDB) require TLS. */
  DB_SSL: (process.env.DB_SSL || '').toLowerCase() === 'true' || !!dbUrl?.ssl,
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-me-32chars-long',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-32chars-long',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  /** Comma-separated list of allowed origins. */
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  CORS_ORIGINS: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(s => s.trim()).filter(Boolean),
  /** On Vercel the filesystem is read-only except /tmp — files there are ephemeral. */
  STORAGE_PATH: process.env.STORAGE_PATH || (IS_VERCEL ? '/tmp/dayflow-storage' : './storage'),
  EMAIL_FROM: process.env.EMAIL_FROM || 'noreply@dayflow.local',
  /** Where OAuth callbacks send the browser back to (defaults to the first CORS origin). */
  FRONTEND_URL: process.env.FRONTEND_URL || (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',')[0].trim(),
  /** LinkedIn OAuth 2.0 — see README §LinkedIn integration. Leave unset to disable the feature. */
  LINKEDIN_CLIENT_ID: process.env.LINKEDIN_CLIENT_ID || '',
  LINKEDIN_CLIENT_SECRET: process.env.LINKEDIN_CLIENT_SECRET || '',
  LINKEDIN_REDIRECT_URI: process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:4000/api/linkedin/callback',
  /** Versioned Posts API month (YYYYMM). LinkedIn sunsets versions after ~1 year; bump when they 426. */
  LINKEDIN_API_VERSION: process.env.LINKEDIN_API_VERSION || '202601',
  APP_VERSION: '2.2.0',
  /** File storage: local (default) or s3 (AWS S3 / Cloudflare R2 / MinIO). */
  STORAGE_DRIVER: (process.env.STORAGE_DRIVER || 'local') as 'local' | 's3',
  S3_BUCKET: process.env.S3_BUCKET || '',
  S3_REGION: process.env.S3_REGION || 'auto',
  S3_ENDPOINT: process.env.S3_ENDPOINT || '',
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID || '',
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY || '',
  /** Email: Resend API key, or an SMTP URL (smtp://user:pass@host:587). Neither → log only. */
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  SMTP_URL: process.env.SMTP_URL || '',
  /** Distributed rate limiting via Upstash Redis REST. */
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || '',
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || '',
  /** Error monitoring. */
  SENTRY_DSN: process.env.SENTRY_DSN || '',
};
