// Integration tests for payment flow hardening.
// No real money, no real Postgres, no real YooKassa — all deps mocked via the
// createPaymentRouter() factory.
//
// Run: `npm test --prefix server`

import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createPaymentRouter, type PaymentRouterDeps } from '../routes/payment';

// ============================================================================
// Mock DB & YooKassa
// ============================================================================

type QueryRow = Record<string, unknown>;
type QueryResult = { rows: QueryRow[] };
type QueryHandler = (sql: string, params?: unknown[]) => Promise<QueryResult> | QueryResult;
interface SqlCall { sql: string; params?: unknown[]; }

function makeMockDb(handler: QueryHandler) {
  const calls: SqlCall[] = [];

  const wrappedQuery = async (sql: string, params?: unknown[]) => {
    calls.push({ sql, params });
    return await handler(sql, params);
  };

  const pool = {
    query: wrappedQuery,
    connect: async () => ({
      query: wrappedQuery,
      release: () => {},
    }),
  };

  return { pool: pool as any, calls };
}

function pickByFragment(handlers: Array<[RegExp | string, QueryResult | ((sql: string, p?: unknown[]) => QueryResult)]>): QueryHandler {
  return (sql, params) => {
    for (const [match, resp] of handlers) {
      const hit = match instanceof RegExp ? match.test(sql) : sql.includes(match);
      if (hit) return typeof resp === 'function' ? resp(sql, params) : resp;
    }
    return { rows: [] };
  };
}

// ============================================================================
// Helpers
// ============================================================================

async function startApp(deps: PaymentRouterDeps): Promise<{ url: string; close: () => Promise<void> }> {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/payment', createPaymentRouter(deps));
  await new Promise<void>((resolve) => {
    const s = app.listen(0, () => resolve());
    (app as any).__server = s;
  });
  const server: Server = (app as any).__server;
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((r) => server.close(() => r())),
  };
}

const validEnv = () => ({ user: 'yk_user', pass: 'yk_pass_long_random' });
const basicAuth = (user: string, pass: string) =>
  'Basic ' + Buffer.from(`${user}:${pass}`, 'utf-8').toString('base64');

// Wait long enough for async post-ack webhook processing
const tick = () => new Promise((r) => setTimeout(r, 200));

// Fake YooKassa createPayment — returns a stub payment object
const fakeCreatePayment: PaymentRouterDeps['createPayment'] = async (p) => ({
  id: 'pay_fake_' + p.orderId.slice(0, 8),
  status: 'pending',
  confirmation: { type: 'redirect', confirmation_url: 'https://yookassa.ru/checkout/fake' },
});

// ============================================================================
// /api/payment/create — input validation
// ============================================================================

test('payment/create: missing userSessionId → 400', async () => {
  const { pool } = makeMockDb(() => ({ rows: [] }));
  const app = await startApp({ db: pool, createPayment: fakeCreatePayment });
  try {
    const r = await fetch(`${app.url}/api/payment/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tariffId: 'basic' }),
    });
    assert.equal(r.status, 400);
    const body = await r.json() as { error: string };
    assert.match(body.error, /userSessionId/i);
  } finally { await app.close(); }
});

test('payment/create: invalid tariff → 400', async () => {
  const { pool } = makeMockDb(() => ({ rows: [] }));
  const app = await startApp({ db: pool, createPayment: fakeCreatePayment });
  try {
    const r = await fetch(`${app.url}/api/payment/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userSessionId: 'sess_x',
        tariffId: 'mega_premium_unknown',
        customerEmail: 'x@y.z',
      }),
    });
    assert.equal(r.status, 400);
    const body = await r.json() as { error: string };
    assert.match(body.error, /Invalid tariff/i);
  } finally { await app.close(); }
});

test('payment/create: missing/invalid email → 400', async () => {
  const { pool } = makeMockDb(() => ({ rows: [] }));
  const app = await startApp({ db: pool, createPayment: fakeCreatePayment });
  try {
    const r = await fetch(`${app.url}/api/payment/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userSessionId: 'sess_x',
        tariffId: 'basic',
        customerEmail: 'not-an-email',
      }),
    });
    assert.equal(r.status, 400);
  } finally { await app.close(); }
});

test('payment/create: valid tariff → creates order + returns paymentUrl', async () => {
  const ORDER_ID = '11111111-1111-1111-1111-111111111111';
  const { pool, calls } = makeMockDb(pickByFragment([
    // no existing balance
    [/SELECT balance FROM credit_accounts/, { rows: [] }],
    // no existing paid order
    [/payment_status = 'succeeded'/i, { rows: [] }],
    // no pending duplicate
    [/payment_status = 'pending'/i, { rows: [] }],
    // INSERT new order returns id
    [/INSERT INTO orders/, { rows: [{ id: ORDER_ID }] }],
    // email upsert
    [/INSERT INTO credit_accounts/, { rows: [{ id: 'acc-1' }] }],
    // UPDATE orders SET payment_id
    [/UPDATE orders SET payment_id/, { rows: [] }],
  ]));

  let createPaymentCalled = false;
  const captureCreate: PaymentRouterDeps['createPayment'] = async (p) => {
    createPaymentCalled = true;
    assert.equal(p.tariffId, 'basic');
    assert.equal(p.price, 479);
    assert.equal(p.photosCount, 5);
    return {
      id: 'pay_stub_xyz',
      status: 'pending',
      confirmation: { type: 'redirect', confirmation_url: 'https://yookassa.ru/checkout/stub' },
    };
  };

  const app = await startApp({ db: pool, createPayment: captureCreate });
  try {
    const r = await fetch(`${app.url}/api/payment/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userSessionId: 'sess_x',
        customerKey: 'cust_unit_test',
        tariffId: 'basic',
        customerEmail: 'unit@test.local',
        styleIds: ['style1', 'style2'],
        isFullBody: false,
      }),
    });
    assert.equal(r.status, 200);
    const body = await r.json() as { orderId: string; paymentId: string; paymentUrl: string };
    assert.equal(body.orderId, ORDER_ID);
    assert.equal(body.paymentId, 'pay_stub_xyz');
    assert.match(body.paymentUrl, /yookassa\.ru/);
    assert.equal(createPaymentCalled, true);
    // payment_id propagated back to orders
    assert.ok(calls.some((c) => /UPDATE orders SET payment_id/.test(c.sql) && c.params?.[0] === 'pay_stub_xyz'));
  } finally { await app.close(); }
});

test('payment/create: balance_not_empty guard → 409', async () => {
  const { pool } = makeMockDb(pickByFragment([
    [/SELECT balance FROM credit_accounts/, { rows: [{ balance: 7 }] }],
  ]));
  const app = await startApp({ db: pool, createPayment: fakeCreatePayment });
  try {
    const r = await fetch(`${app.url}/api/payment/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userSessionId: 'sess_x',
        customerKey: 'cust_with_credits',
        tariffId: 'basic',
        customerEmail: 'x@y.z',
      }),
    });
    assert.equal(r.status, 409);
    const body = await r.json() as { code: string; balance: number };
    assert.equal(body.code, 'balance_not_empty');
    assert.equal(body.balance, 7);
  } finally { await app.close(); }
});

// ============================================================================
// /api/payment/webhook — auth
// ============================================================================

test('webhook: env not configured → 503 (fail-closed)', async () => {
  const { pool } = makeMockDb(() => ({ rows: [] }));
  const app = await startApp({
    db: pool,
    webhookEnv: () => ({ user: '', pass: '' }),
  });
  try {
    const r = await fetch(`${app.url}/api/payment/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'payment.succeeded' }),
    });
    assert.equal(r.status, 503);
  } finally { await app.close(); }
});

test('webhook: no Authorization header → 401', async () => {
  const { pool } = makeMockDb(() => ({ rows: [] }));
  const app = await startApp({ db: pool, webhookEnv: validEnv });
  try {
    const r = await fetch(`${app.url}/api/payment/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'payment.succeeded' }),
    });
    assert.equal(r.status, 401);
    assert.equal(r.headers.get('www-authenticate'), 'Basic realm="yookassa-webhook"');
  } finally { await app.close(); }
});

test('webhook: wrong basic auth → 401', async () => {
  const { pool } = makeMockDb(() => ({ rows: [] }));
  const app = await startApp({ db: pool, webhookEnv: validEnv });
  try {
    const r = await fetch(`${app.url}/api/payment/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: basicAuth('attacker', 'guess'),
      },
      body: JSON.stringify({ event: 'payment.succeeded' }),
    });
    assert.equal(r.status, 401);
  } finally { await app.close(); }
});

// ============================================================================
// /api/payment/webhook — defense layer 2 & 3: order matching + YK re-verify
// ============================================================================

test('webhook: valid auth + body says succeeded + YK says PENDING → no credit', async () => {
  const ORDER_ID = '22222222-2222-2222-2222-222222222222';
  const PAY_ID = 'pay_unverified';
  const { pool, calls } = makeMockDb(pickByFragment([
    [/FOR UPDATE/, { rows: [{
      id: ORDER_ID, customer_key: 'cust_x', photos_count: 5,
      tariff_id: 'basic', credits_purchased: 0,
      payment_status: 'pending', generation_status: 'waiting',
    }] }],
  ]));

  // YK re-verification returns "pending" — must NOT credit
  const getPayment: PaymentRouterDeps['getPayment'] = async () => ({
    id: PAY_ID, status: 'pending',
  });

  const app = await startApp({ db: pool, getPayment, webhookEnv: validEnv });
  try {
    const r = await fetch(`${app.url}/api/payment/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: basicAuth('yk_user', 'yk_pass_long_random'),
      },
      body: JSON.stringify({
        event: 'payment.succeeded',
        object: { id: PAY_ID, status: 'succeeded', metadata: { order_id: ORDER_ID } },
      }),
    });
    assert.equal(r.status, 200);
    await tick();
    // No credit_transactions insert
    assert.ok(!calls.some((c) => /INSERT INTO credit_transactions/.test(c.sql)),
      'credit_transactions must not be inserted when YK says not-succeeded');
    // No balance update
    assert.ok(!calls.some((c) => /UPDATE credit_accounts SET balance/.test(c.sql)),
      'balance must not be updated when YK says not-succeeded');
  } finally { await app.close(); }
});

test('webhook: valid auth + YK returns null (unknown payment) → no credit', async () => {
  const { pool, calls } = makeMockDb(() => ({ rows: [] }));
  const getPayment: PaymentRouterDeps['getPayment'] = async () => null;

  const app = await startApp({ db: pool, getPayment, webhookEnv: validEnv });
  try {
    const r = await fetch(`${app.url}/api/payment/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: basicAuth('yk_user', 'yk_pass_long_random'),
      },
      body: JSON.stringify({
        event: 'payment.succeeded',
        object: { id: 'pay_fake', status: 'succeeded', metadata: { order_id: 'fake-order' } },
      }),
    });
    assert.equal(r.status, 200);
    await tick();
    assert.ok(!calls.some((c) => /INSERT INTO credit_transactions/.test(c.sql)),
      'must not credit when YK does not recognise the payment');
  } finally { await app.close(); }
});

test('webhook: crosswire blocked — body payment.id ≠ stored order.payment_id', async () => {
  const ORDER_ID = '33333333-3333-3333-3333-333333333333';
  const ATTACKER_PAY_ID = 'pay_attacker_real_succeeded';

  // FOR UPDATE has both id AND payment_id in WHERE; with a mismatching payment_id
  // the lookup returns NO rows.
  const { pool, calls } = makeMockDb(pickByFragment([
    [/FOR UPDATE/, (sql, params) => {
      // simulate WHERE id=$1 AND payment_id=$2 — mismatch => empty
      const [, paymentIdParam] = params as [string, string];
      if (paymentIdParam === ATTACKER_PAY_ID) return { rows: [] };
      return { rows: [{
        id: ORDER_ID, customer_key: 'cust_victim', photos_count: 50,
        tariff_id: 'premium', credits_purchased: 0,
        payment_status: 'pending', generation_status: 'waiting',
      }] };
    }],
  ]));

  // YK confirms the attacker's payment really did succeed (they paid for THEIR
  // order). The attacker tries to bind that succeeded payment to the victim's
  // pending order via forged metadata.
  const getPayment: PaymentRouterDeps['getPayment'] = async () => ({
    id: ATTACKER_PAY_ID, status: 'succeeded',
  });

  const app = await startApp({ db: pool, getPayment, webhookEnv: validEnv });
  try {
    const r = await fetch(`${app.url}/api/payment/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: basicAuth('yk_user', 'yk_pass_long_random'),
      },
      body: JSON.stringify({
        event: 'payment.succeeded',
        object: {
          id: ATTACKER_PAY_ID,           // attacker's real succeeded payment
          status: 'succeeded',
          metadata: { order_id: ORDER_ID }, // victim's order_id (forged)
        },
      }),
    });
    assert.equal(r.status, 200);
    await tick();
    assert.ok(!calls.some((c) => /INSERT INTO credit_transactions/.test(c.sql)),
      'crosswire attack must not credit victim order with attacker payment');
  } finally { await app.close(); }
});

test('webhook: valid auth + YK confirms succeeded + matching order → credit accrued', async () => {
  const ORDER_ID = '44444444-4444-4444-4444-444444444444';
  const PAY_ID = 'pay_legit_succeeded';

  const txInserted: SqlCall[] = [];
  const balanceUpdates: SqlCall[] = [];

  const { pool, calls } = makeMockDb((sql, params) => {
    // Match FOR UPDATE with both id and payment_id
    if (/FOR UPDATE/.test(sql)) {
      return { rows: [{
        id: ORDER_ID, customer_key: 'cust_real', photos_count: 15,
        tariff_id: 'standard', credits_purchased: 0,
        payment_status: 'pending', generation_status: 'waiting',
        referral_code: null,
      }] };
    }
    if (/INSERT INTO credit_accounts/.test(sql)) {
      return { rows: [{ id: 'acc-real' }] };
    }
    if (/INSERT INTO credit_transactions/.test(sql)) {
      txInserted.push({ sql, params });
      return { rows: [{ id: 'tx-1' }] };
    }
    if (/UPDATE credit_accounts SET balance/.test(sql)) {
      balanceUpdates.push({ sql, params });
      return { rows: [] };
    }
    return { rows: [] };
  });

  const getPayment: PaymentRouterDeps['getPayment'] = async () => ({
    id: PAY_ID, status: 'succeeded',
  });

  const app = await startApp({ db: pool, getPayment, webhookEnv: validEnv });
  try {
    const r = await fetch(`${app.url}/api/payment/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: basicAuth('yk_user', 'yk_pass_long_random'),
      },
      body: JSON.stringify({
        event: 'payment.succeeded',
        object: {
          id: PAY_ID,
          status: 'succeeded',
          metadata: { order_id: ORDER_ID },
        },
      }),
    });
    assert.equal(r.status, 200);
    await tick();
    assert.equal(txInserted.length, 1, 'exactly one credit_transactions insert');
    assert.equal(balanceUpdates.length, 1, 'exactly one balance update');
    // tx amount equals photos_count for that tariff
    assert.equal(txInserted[0].params?.[2], 15);
    assert.equal(balanceUpdates[0].params?.[0], 15);
    // idempotency key bound to order_id
    assert.equal(txInserted[0].params?.[3], `topup_order_${ORDER_ID}`);
    // BEGIN/COMMIT present
    assert.ok(calls.some((c) => c.sql === 'BEGIN'));
    assert.ok(calls.some((c) => c.sql === 'COMMIT'));
  } finally { await app.close(); }
});
