/**
 * manual-credit.mjs — восстановление конкретного платежа при сбое вебхука.
 * Это ONE-TIME fix, НЕ замена вебхука. После исправления вебхука не нужен.
 *
 * Запуск на VPS (SSH):
 *   # 1. Скопировать файл на VPS:
 *   scp -i ~/.ssh/id_ed25519 scripts/manual-credit.mjs root@62.113.111.113:/tmp/
 *
 *   # 2. Запустить на VPS:
 *   ssh -i ~/.ssh/id_ed25519 root@62.113.111.113
 *   cd /var/www/ai-fotosessia.ru/api
 *   node /tmp/manual-credit.mjs --customer-key cust_xxx
 *   # или по order-id:
 *   node /tmp/manual-credit.mjs --order-id <uuid>
 *   # dry-run (только показать, не менять):
 *   node /tmp/manual-credit.mjs --customer-key cust_xxx --dry-run
 */

import { readFileSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Загружаем .env ───────────────────────────────────────────────────────────
// Ищем .env в нескольких местах: CWD, CWD/dist, скрипт-директория
const envCandidates = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), 'dist/.env'),
  resolve(__dirname, '../.env'),
  resolve(__dirname, '../../api/dist/.env'),
];

for (const p of envCandidates) {
  try {
    const lines = readFileSync(p, 'utf-8').split('\n');
    for (const line of lines) {
      const m = line.trim().match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    }
    console.log(`Loaded env from: ${p}`);
    break;
  } catch { /* try next */ }
}

// ── pg: ищем в нескольких путях ─────────────────────────────────────────────
const pgCandidates = [
  join(process.cwd(), 'node_modules/pg'),
  join(process.cwd(), '../node_modules/pg'),
  '/var/www/ai-fotosessia.ru/api/node_modules/pg',
];

let Pool;
for (const p of pgCandidates) {
  try {
    const req = createRequire(p + '/package.json');
    const pg = req('pg');
    Pool = pg.Pool || pg.default?.Pool;
    if (Pool) { console.log(`Using pg from: ${p}`); break; }
  } catch { /* try next */ }
}

if (!Pool) {
  // Последняя попытка — динамический import
  try {
    const pg = await import('pg');
    Pool = pg.Pool || pg.default?.Pool;
  } catch {
    console.error('❌ Не удалось загрузить модуль pg. Убедитесь что node_modules/pg доступен.');
    console.error('   Запустите скрипт из /var/www/ai-fotosessia.ru/api/ где установлены зависимости.');
    process.exit(1);
  }
}

// ── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (name) => { const i = args.indexOf(name); return i !== -1 ? args[i + 1] : null; };
const DRY_RUN   = args.includes('--dry-run');
const CUSTOMER_KEY = getArg('--customer-key');
const ORDER_ID  = getArg('--order-id');

if (!CUSTOMER_KEY && !ORDER_ID) {
  console.error('Использование:');
  console.error('  node manual-credit.mjs --customer-key cust_xxx [--dry-run]');
  console.error('  node manual-credit.mjs --order-id <uuid>       [--dry-run]');
  process.exit(1);
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL не найден. Проверьте .env файл.');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    console.log('\n── Ищем заказ ───────────────────────────────────────────────');

    let rows;
    if (ORDER_ID) {
      ({ rows } = await client.query(
        `SELECT id, customer_key, payment_status, generation_status,
                photos_count, credits_purchased, tariff_id, created_at
           FROM orders WHERE id = $1`, [ORDER_ID]
      ));
    } else {
      ({ rows } = await client.query(
        `SELECT id, customer_key, payment_status, generation_status,
                photos_count, credits_purchased, tariff_id, created_at
           FROM orders
          WHERE customer_key = $1
            AND payment_status = 'succeeded'
          ORDER BY created_at DESC LIMIT 10`, [CUSTOMER_KEY]
      ));
    }

    if (rows.length === 0) {
      console.log('❌ Заказ не найден.');
      return;
    }

    console.log(`\nНайдено заказов: ${rows.length}`);
    rows.forEach((r) => {
      const credited = r.generation_status === 'credits_credited' ? '✅' : '⚠️ ';
      console.log(`  ${credited} id=${r.id} pay=${r.payment_status} gen=${r.generation_status} photos=${r.photos_count} credits=${r.credits_purchased ?? 0} created=${r.created_at}`);
    });

    // Выбираем тот, что нужно починить: succeeded, кредиты не начислены
    const order = rows.find(
      (r) => r.payment_status === 'succeeded' &&
             r.generation_status !== 'credits_credited' &&
             (r.credits_purchased ?? 0) === 0
    );

    if (!order) {
      const already = rows.find((r) => r.generation_status === 'credits_credited');
      if (already) {
        console.log('\n✅ Кредиты уже начислены — ничего делать не нужно.');
        console.log('   Попросите пользователя обновить страницу.');
      } else {
        console.log('\n⚠️  Нет заказа с payment=succeeded и credits_purchased=0.');
        console.log('   Возможно, платёж ещё pending или уже обработан.');
      }
      return;
    }

    const customerKey = (order.customer_key || '').trim();
    const photos = Number(order.photos_count || 0);

    if (!customerKey || photos <= 0) {
      console.error('❌ Нет customer_key или photos_count — невозможно начислить.');
      return;
    }

    console.log(`\n🎯 Будем начислять:`);
    console.log(`   order_id    : ${order.id}`);
    console.log(`   customer_key: ${customerKey}`);
    console.log(`   кредитов    : ${photos}`);

    if (DRY_RUN) {
      console.log('\n🔍 DRY RUN — изменений нет. Запустите без --dry-run для применения.');
      return;
    }

    console.log('\n── Начисляем (транзакция) ───────────────────────────────────');
    await client.query('BEGIN');

    const { rows: accRows } = await client.query(
      `INSERT INTO credit_accounts (customer_key) VALUES ($1)
         ON CONFLICT (customer_key) DO UPDATE SET updated_at = now()
         RETURNING id, balance`,
      [customerKey],
    );
    const { id: accountId, balance: oldBalance } = accRows[0];

    const idemKey = `topup_order_${order.id}`;
    const { rows: txInsert } = await client.query(
      `INSERT INTO credit_transactions
         (account_id, order_id, type, amount, idempotency_key, description)
       VALUES ($1,$2,'credit',$3,$4,$5)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING id`,
      [accountId, order.id, photos, idemKey, `Ручное начисление (сбой вебхука) — ${order.tariff_id} (${photos} фото)`],
    );

    if (txInsert.length === 0) {
      await client.query('ROLLBACK');
      console.log('⚠️  Транзакция уже существует — кредиты были начислены ранее (ON CONFLICT).');
      console.log('   Проверьте баланс через: SELECT balance FROM credit_accounts WHERE customer_key = $1');
      return;
    }

    await client.query(`UPDATE credit_accounts SET balance = balance + $1 WHERE id = $2`, [photos, accountId]);
    await client.query(
      `UPDATE orders SET generation_status = 'credits_credited', credits_purchased = $1 WHERE id = $2`,
      [photos, order.id],
    );

    await client.query('COMMIT');

    console.log(`\n✅ Готово!`);
    console.log(`   Баланс: ${oldBalance} → ${oldBalance + photos} (+${photos})`);
    console.log(`\n   Попросите пользователя обновить страницу — Studio откроется автоматически.`);
    console.log(`   (localStorage customer_key = ${customerKey})`);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Ошибка:', e.message);
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
