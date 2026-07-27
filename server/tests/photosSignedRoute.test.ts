// HTTP-level тесты для GET /api/photos/signed/:token — временной подписанной
// ссылки на фото, которая заменяет base64 в теле запроса к OpenRouter/AI Gateway.
// photosRouter не зависит от Postgres, поэтому поднимаем реальный express-app
// без моков БД (в отличие от payment.test.ts).
//
// Run: `npm test --prefix server`

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import photosRouter from '../routes/photos';
import { createSignedLink } from '../services/signedPhotoLink';

const TEMP_DIR = process.env.PHOTO_TEMP_DIR!;
const FIXTURE_CONTENT = Buffer.from('fake-jpeg-bytes-for-test');
const FIXTURE_NAME = 'src_test-fixture.jpg';

let server: Server;
let baseUrl: string;

before(async () => {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  fs.writeFileSync(path.join(TEMP_DIR, FIXTURE_NAME), FIXTURE_CONTENT);

  const app = express();
  app.use('/api/photos', photosRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const port = (server.address() as AddressInfo).port;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
});

test('valid signed link returns 200 with correct bytes', async () => {
  const { token } = createSignedLink(FIXTURE_NAME, 10 * 60 * 1000);
  const res = await fetch(`${baseUrl}/api/photos/signed/${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const body = Buffer.from(await res.arrayBuffer());
  assert.ok(body.equals(FIXTURE_CONTENT));
});

test('expired signed link returns 410', async () => {
  const { token } = createSignedLink(FIXTURE_NAME, -1000); // истёк секунду назад
  const res = await fetch(`${baseUrl}/api/photos/signed/${token}`);
  assert.equal(res.status, 410);
  const body = await res.json();
  assert.equal(body.code, 'expired');
});

test('tampered signature returns 404 (not 410 — must not leak "almost valid")', async () => {
  const { token } = createSignedLink(FIXTURE_NAME, 10 * 60 * 1000);
  const [payload, sig] = token.split('.');
  const tampered = `${payload}.${'x'.repeat(sig.length)}`;
  const res = await fetch(`${baseUrl}/api/photos/signed/${tampered}`);
  assert.equal(res.status, 404);
});

test('garbage / malformed token returns 404, not 500', async () => {
  const res = await fetch(`${baseUrl}/api/photos/signed/not-a-real-token`);
  assert.equal(res.status, 404);
});

test('signed link is reusable within its validity window (repeat fetch)', async () => {
  const { token } = createSignedLink(FIXTURE_NAME, 10 * 60 * 1000);
  const first = await fetch(`${baseUrl}/api/photos/signed/${token}`);
  const second = await fetch(`${baseUrl}/api/photos/signed/${token}`);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
});

test('path traversal in signed filename is blocked (defense in depth via resolveFile/path.basename)', async () => {
  // createSignedLink() сама по себе — server-internal и никогда не вызывается
  // с недоверенным именем; этот тест проверяет, что ДАЖЕ если бы туда попало
  // "../../../etc/passwd", route всё равно не отдаст произвольный файл с диска.
  const { token } = createSignedLink('../../../etc/passwd', 10 * 60 * 1000);
  const res = await fetch(`${baseUrl}/api/photos/signed/${token}`);
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.notEqual(body.error, undefined);
});

test('unrelated / nonexistent filename inside otherwise-valid signature returns 404', async () => {
  const { token } = createSignedLink('src_does-not-exist.jpg', 10 * 60 * 1000);
  const res = await fetch(`${baseUrl}/api/photos/signed/${token}`);
  assert.equal(res.status, 404);
});

test('existing GET /api/photos/:filename route is unaffected by the new route', async () => {
  const res = await fetch(`${baseUrl}/api/photos/${FIXTURE_NAME}`);
  assert.equal(res.status, 200);
  const body = Buffer.from(await res.arrayBuffer());
  assert.ok(body.equals(FIXTURE_CONTENT));
});

test('no secrets/token/URL are written to stdout or stderr while serving a signed link', async () => {
  const { token, expiresAt } = createSignedLink(FIXTURE_NAME, 10 * 60 * 1000);
  const url = `${baseUrl}/api/photos/signed/${token}`;

  const originalLog = console.log;
  const originalError = console.error;
  const captured: string[] = [];
  console.log = (...args: unknown[]) => { captured.push(args.map(String).join(' ')); };
  console.error = (...args: unknown[]) => { captured.push(args.map(String).join(' ')); };

  try {
    await fetch(url);
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }

  const joined = captured.join('\n');
  assert.ok(!joined.includes(token), 'token must not appear in logs');
  assert.ok(!joined.includes(url), 'full signed URL must not appear in logs');
  assert.ok(!joined.includes(process.env.PHOTO_LINK_SIGNING_SECRET!), 'signing secret must not appear in logs');
  void expiresAt;
});
