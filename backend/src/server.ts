import app from './app';
import { env } from './config/env';
import fs from 'fs';
import path from 'path';

const storagePath = path.resolve(env.STORAGE_PATH);
fs.mkdirSync(storagePath, { recursive: true });
fs.mkdirSync(path.join(storagePath, 'uploads'), { recursive: true });
fs.mkdirSync(path.join(storagePath, 'payslips'), { recursive: true });

app.listen(env.PORT, () => {
  console.log(`Dayflow backend running on http://localhost:${env.PORT}`);
  console.log(`Env: ${env.NODE_ENV} | DB: ${env.DB_NAME}@${env.DB_HOST}:${env.DB_PORT}`);
});
