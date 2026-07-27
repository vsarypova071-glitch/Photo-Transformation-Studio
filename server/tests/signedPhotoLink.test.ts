// Unit-тесты для server/services/signedPhotoLink.ts — временных подписанных
// ссылок на фото, которые заменяют base64 в теле запроса к OpenRouter/AI Gateway.
//
// Run: `npm test --prefix server`

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSignedLink, verifySignedToken } from '../services/signedPhotoLink';

test('valid token round-trips to the original filename', () => {
  const { token } = createSignedLink('src_abc-123.jpg', 10 * 60 * 1000);
  const result = verifySignedToken(token);
  assert.equal(result.ok, true);
  assert.equal((result as any).filename, 'src_abc-123.jpg');
});

test('expired token is rejected as expired, not as bad_signature', () => {
  const { token } = createSignedLink('src_abc-123.jpg', -1); // уже истёк
  const result = verifySignedToken(token);
  assert.equal(result.ok, false);
  assert.equal((result as any).reason, 'expired');
});

test('tampered signature is rejected', () => {
  const { token } = createSignedLink('src_abc-123.jpg', 10 * 60 * 1000);
  const [payload, sig] = token.split('.');
  const flippedChar = sig[0] === 'a' ? 'b' : 'a';
  const tampered = `${payload}.${flippedChar}${sig.slice(1)}`;
  const result = verifySignedToken(tampered);
  assert.equal(result.ok, false);
  assert.equal((result as any).reason, 'bad_signature');
});

test('tampered payload (different filename than signed) is rejected', () => {
  const { token } = createSignedLink('src_abc-123.jpg', 10 * 60 * 1000);
  const [, sig] = token.split('.');
  const forgedPayload = Buffer.from('src_OTHER-FILE.jpg|9999999999999', 'utf8').toString('base64url');
  const result = verifySignedToken(`${forgedPayload}.${sig}`);
  assert.equal(result.ok, false);
  assert.equal((result as any).reason, 'bad_signature');
});

test('malformed token (no dot separator) is rejected', () => {
  const result = verifySignedToken('not-a-valid-token');
  assert.equal(result.ok, false);
  assert.equal((result as any).reason, 'malformed');
});

test('empty / garbage input is rejected without throwing', () => {
  for (const bad of ['', '.', 'a.', '.a', 'a'.repeat(5000)]) {
    assert.doesNotThrow(() => verifySignedToken(bad));
    assert.equal(verifySignedToken(bad).ok, false);
  }
});

test('token is reusable within its validity window (not single-use)', () => {
  const { token } = createSignedLink('src_abc-123.jpg', 10 * 60 * 1000);
  const first = verifySignedToken(token);
  const second = verifySignedToken(token);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
});

test('path-traversal filename survives round-trip unmodified (route layer, not this module, must block it)', () => {
  // Этот модуль сам по себе не знает про файловую систему — он только подписывает
  // строку. Защита от directory traversal — в resolveFile() (photos.ts), который
  // применяет path.basename() к результату verifySignedToken(). Тест ниже
  // документирует границу ответственности: сюда может прийти что угодно.
  const { token } = createSignedLink('../../../etc/passwd', 10 * 60 * 1000);
  const result = verifySignedToken(token);
  assert.equal(result.ok, true);
  assert.equal((result as any).filename, '../../../etc/passwd');
});
