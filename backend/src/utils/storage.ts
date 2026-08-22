import fs from 'fs';
import path from 'path';
import { env } from '../config/env';

/**
 * File storage abstraction.
 *  - local: files under STORAGE_PATH (dev / VM deployments)
 *  - s3:    any S3-compatible bucket (AWS S3, Cloudflare R2, MinIO) — set STORAGE_DRIVER=s3 + S3_* env vars
 * Keys are relative ("uploads/abc.pdf", "payslips/<emp>/<month>.pdf"); DB rows store the key.
 */
export type StoredFile = { key: string; size: number; mime: string };

interface Driver {
  put(key: string, body: Buffer, mime: string): Promise<StoredFile>;
  get(key: string): Promise<{ body: Buffer; mime?: string } | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

const local: Driver = {
  async put(key, body, mime) {
    const full = path.resolve(env.STORAGE_PATH, key);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
    return { key, size: body.length, mime };
  },
  async get(key) {
    const full = path.resolve(env.STORAGE_PATH, key);
    if (!fs.existsSync(full)) return null;
    return { body: fs.readFileSync(full) };
  },
  async delete(key) { const full = path.resolve(env.STORAGE_PATH, key); if (fs.existsSync(full)) fs.unlinkSync(full); },
  async exists(key) { return fs.existsSync(path.resolve(env.STORAGE_PATH, key)); },
};

let s3Client: any = null;
function s3(): any {
  if (s3Client) return s3Client;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { S3Client } = require('@aws-sdk/client-s3');
  s3Client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT || undefined,
    forcePathStyle: !!env.S3_ENDPOINT,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
  });
  return s3Client;
}
const s3Driver: Driver = {
  async put(key, body, mime) {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    await s3().send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: body, ContentType: mime }));
    return { key, size: body.length, mime };
  },
  async get(key) {
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    try {
      const out = await s3().send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
      const chunks: Buffer[] = [];
      for await (const c of out.Body as any) chunks.push(Buffer.from(c));
      return { body: Buffer.concat(chunks), mime: out.ContentType };
    } catch (e: any) { if (e?.$metadata?.httpStatusCode === 404 || e?.name === 'NoSuchKey') return null; throw e; }
  },
  async delete(key) { const { DeleteObjectCommand } = require('@aws-sdk/client-s3'); await s3().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key })); },
  async exists(key) { return !!(await this.get(key)); },
};

export const storage: Driver = env.STORAGE_DRIVER === 's3' ? s3Driver : local;
export const storageDriverName = env.STORAGE_DRIVER === 's3' ? `s3:${env.S3_BUCKET}` : `local:${env.STORAGE_PATH}`;

/** Resolve legacy absolute/relative disk paths written before the adapter existed. */
export function legacyKey(storagePath: string) {
  const norm = storagePath.replace(/\\/g, '/');
  const i = norm.lastIndexOf('/uploads/');
  if (i >= 0) return norm.slice(i + 1);
  const j = norm.lastIndexOf('/payslips/');
  if (j >= 0) return norm.slice(j + 1);
  return norm.replace(/^\/?storage\//, '');
}
