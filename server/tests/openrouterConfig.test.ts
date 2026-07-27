// Тесты выбора режима direct/gateway в server/services/openrouter.ts.
// readConfig() читает env заново при каждом вызове (не кэширует на уровне
// модуля), поэтому можно мутировать process.env между кейсами в одном файле.
//
// Run: `npm test --prefix server`

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readConfig, generateImage, OpenRouterError } from '../services/openrouter';

const ENV_KEYS = [
  'OPENROUTER_API_KEY', 'OPENROUTER_MODEL',
  'AI_GATEWAY_URL', 'AI_GATEWAY_TOKEN', 'AI_CALL_TIMEOUT_MS',
] as const;

let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = {};
  for (const k of ENV_KEYS) { savedEnv[k] = process.env[k]; delete process.env[k]; }
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

test('direct mode (no AI_GATEWAY_URL): uses OpenRouter directly, 90s timeout', () => {
  process.env.OPENROUTER_API_KEY = 'sk-or-real-key';
  const cfg = readConfig();
  assert.equal(cfg.endpoint, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(cfg.apiKey, 'sk-or-real-key');
  assert.equal(cfg.timeoutMs, 90_000);
  assert.equal(cfg.model, 'google/gemini-2.5-flash-image-preview');
});

test('direct mode without OPENROUTER_API_KEY -> throws no_api_key', () => {
  assert.throws(() => readConfig(), (e: unknown) => {
    assert.ok(e instanceof OpenRouterError);
    assert.equal(e.code, 'no_api_key');
    assert.equal(e.status, 503);
    return true;
  });
});

test('gateway mode (AI_GATEWAY_URL set): routes to gateway with AI_GATEWAY_TOKEN, 130s timeout', () => {
  process.env.AI_GATEWAY_URL = 'https://5-129-232-49.sslip.io/v1/chat/completions';
  process.env.AI_GATEWAY_TOKEN = 'gw-token-for-ai-fotosessia';
  // OPENROUTER_API_KEY намеренно НЕ задан — в gateway-режиме он не нужен,
  // реальный ключ живёт только на Gateway.
  const cfg = readConfig();
  assert.equal(cfg.endpoint, 'https://5-129-232-49.sslip.io/v1/chat/completions');
  assert.equal(cfg.apiKey, 'gw-token-for-ai-fotosessia');
  assert.equal(cfg.timeoutMs, 130_000);
});

test('gateway mode without AI_GATEWAY_TOKEN -> throws no_api_key (does not silently fall back to direct)', () => {
  process.env.AI_GATEWAY_URL = 'https://5-129-232-49.sslip.io/v1/chat/completions';
  process.env.OPENROUTER_API_KEY = 'sk-or-real-key'; // тоже не должен использоваться как fallback
  assert.throws(() => readConfig(), (e: unknown) => {
    assert.ok(e instanceof OpenRouterError);
    assert.equal(e.code, 'no_api_key');
    return true;
  });
});

test('AI_CALL_TIMEOUT_MS overrides the mode default in both modes', () => {
  process.env.OPENROUTER_API_KEY = 'sk-or-real-key';
  process.env.AI_CALL_TIMEOUT_MS = '45000';
  assert.equal(readConfig().timeoutMs, 45_000);

  process.env.AI_GATEWAY_URL = 'https://5-129-232-49.sslip.io/v1/chat/completions';
  process.env.AI_GATEWAY_TOKEN = 'gw-token';
  assert.equal(readConfig().timeoutMs, 45_000);
});

test('OPENROUTER_MODEL override applies in gateway mode too', () => {
  process.env.AI_GATEWAY_URL = 'https://5-129-232-49.sslip.io/v1/chat/completions';
  process.env.AI_GATEWAY_TOKEN = 'gw-token';
  process.env.OPENROUTER_MODEL = 'google/gemini-3.1-flash-lite';
  assert.equal(readConfig().model, 'google/gemini-3.1-flash-lite');
});

// ---------------------------------------------------------------------------
// End-to-end: подменяем global fetch, проверяем что generateImage() реально
// использует резолвленные endpoint/apiKey, а не какие-то захардкоженные.
// ---------------------------------------------------------------------------

test('generateImage() in gateway mode actually calls the gateway URL with the gateway token', async () => {
  process.env.AI_GATEWAY_URL = 'https://5-129-232-49.sslip.io/v1/chat/completions';
  process.env.AI_GATEWAY_TOKEN = 'gw-token-xyz';

  const originalFetch = globalThis.fetch;
  let capturedUrl: string | undefined;
  let capturedAuth: string | undefined;
  globalThis.fetch = (async (url: any, init: any) => {
    capturedUrl = String(url);
    capturedAuth = init?.headers?.Authorization;
    return new Response(JSON.stringify({
      choices: [{ message: { images: [{ image_url: { url: 'data:image/png;base64,aGk=' } }] } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;

  try {
    const result = await generateImage({ prompt: 'test', imageInput: 'https://example.com/photo.jpg' });
    assert.equal(capturedUrl, 'https://5-129-232-49.sslip.io/v1/chat/completions');
    assert.equal(capturedAuth, 'Bearer gw-token-xyz');
    assert.equal(result.imageDataUrl, 'data:image/png;base64,aGk=');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('generateImage() in direct mode (default) still calls openrouter.ai — no behavior change', async () => {
  process.env.OPENROUTER_API_KEY = 'sk-or-real-key';

  const originalFetch = globalThis.fetch;
  let capturedUrl: string | undefined;
  let capturedAuth: string | undefined;
  globalThis.fetch = (async (url: any, init: any) => {
    capturedUrl = String(url);
    capturedAuth = init?.headers?.Authorization;
    return new Response(JSON.stringify({
      choices: [{ message: { images: [{ image_url: { url: 'data:image/png;base64,aGk=' } }] } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;

  try {
    await generateImage({ prompt: 'test', imageInput: 'https://example.com/photo.jpg' });
    assert.equal(capturedUrl, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(capturedAuth, 'Bearer sk-or-real-key');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
