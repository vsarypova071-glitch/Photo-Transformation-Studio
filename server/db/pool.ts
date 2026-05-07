import { Pool, type PoolConfig } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const url = process.env.DATABASE_URL;

// Beget Cloud Postgres требует SSL (sslmode=require). node-postgres сам не
// разбирает sslmode из URL, поэтому включаем ssl явно когда видим его в строке.
// rejectUnauthorized:false — потому что у managed Postgres часто свой CA,
// который не лежит в системных trusted; цепочка зашифрована, MITM в инфраструктуре
// провайдера моделью угроз не покрывается.
const sslMatch = /[?&]sslmode=([^&]+)/i.exec(url);
const sslMode = sslMatch ? sslMatch[1].toLowerCase() : '';
const wantsSSL = ['require', 'verify-ca', 'verify-full', 'prefer', 'allow', 'no-verify'].includes(sslMode);

const config: PoolConfig = {
  connectionString: url,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
};

if (wantsSSL) {
  config.ssl = { rejectUnauthorized: false };
}

export const db = new Pool(config);

db.on('error', (err) => {
  console.error('[pg pool error]', err.message);
});
