import mysql from 'mysql2/promise';
import { env } from '../config/env';

export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  // Serverless functions are short-lived; keep the pool small so hosted DBs aren't exhausted.
  connectionLimit: env.IS_VERCEL ? 5 : 20,
  ...(env.DB_SSL ? { ssl: { rejectUnauthorized: false } } : {}),
  queueLimit: 0,
  enableKeepAlive: true,
  timezone: '+00:00',
  dateStrings: true,
  charset: 'utf8mb4',
  multipleStatements: true,
});

// helper to get connection and release automatically after query unless transaction
export async function query<T = any>(sql: string, params?: any[]): Promise<T> {
  const [rows] = await pool.execute(sql, params);
  return rows as unknown as T;
}
