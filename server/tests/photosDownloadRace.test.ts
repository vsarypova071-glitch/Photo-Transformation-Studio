// M-3: download-эндпоинт обязан отдавать Content-Length и тело от ОДНОГО и
// того же открытого файла. Фоновый upscale атомарно заменяет gen_<id>.png,
// поэтому воспроизводим худший случай: файл подменяется ровно между
// resolveFile (stat по пути) и открытием файла для отдачи. До фикса это давало
// заголовок от SD-файла и тело от HD-файла → обрезанное скачивание.
//
// Подмена делается детерминированно: fs.open монkeypатчится так, что ПЕРЕД
// реальным открытием целевого файла происходит атомарный rename HD поверх SD —
// т.е. ровно та гонка, которую создаёт services/upscale.ts.
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

const TEMP_DIR = process.env.PHOTO_TEMP_DIR!;
const SD_CONTENT = Buffer.alloc(1_000, 0x41); // "SD-версия", 1000 байт
const HD_CONTENT = Buffer.alloc(5_000, 0x42); // "HD-версия", 5000 байт

let server: Server;
let baseUrl: string;

before(async () => {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  const app = express();
  app.use('/api/photos', photosRouter);
  server = app.listen(0);
  await new Promise<void>((r) => server.once('listening', () => r()));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

test('download без подмены: Content-Length совпадает с телом', async () => {
  const name = 'gen_plain-dl.png';
  fs.writeFileSync(path.join(TEMP_DIR, name), SD_CONTENT);

  const res = await fetch(`${baseUrl}/api/photos/download/${name}`);
  const body = Buffer.from(await res.arrayBuffer());

  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-length'), String(SD_CONTENT.length));
  assert.equal(body.length, SD_CONTENT.length);
  assert.ok(body.equals(SD_CONTENT));
});

test('M-3: файл заменён между resolveFile и open — заголовок и тело согласованы (HD)', async () => {
  const name = 'gen_race-dl.png';
  const target = path.join(TEMP_DIR, name);
  fs.writeFileSync(target, SD_CONTENT);
  // HD-замена готовится в той же директории (тот же volume ⇒ rename атомарен),
  // как это делает services/upscale.ts со своим tmp-файлом.
  const staged = path.join(TEMP_DIR, 'gen_race-dl.upscale-test.tmp.png');
  fs.writeFileSync(staged, HD_CONTENT);

  // Патчим fs.open: при первом открытии целевого файла сначала выполняем
  // атомарную замену (SD → HD), затем зовём оригинальный open. Все остальные
  // вызовы проходят насквозь.
  const realOpen = fs.open;
  let swapped = false;
  (fs as any).open = function patchedOpen(...args: any[]) {
    const p = args[0];
    if (!swapped && typeof p === 'string' && path.resolve(p) === path.resolve(target)) {
      swapped = true;
      fs.renameSync(staged, target);
    }
    return (realOpen as any).apply(fs, args);
  };

  try {
    const res = await fetch(`${baseUrl}/api/photos/download/${name}`);
    const body = Buffer.from(await res.arrayBuffer());

    assert.equal(res.status, 200);
    assert.ok(swapped, 'подмена обязана была произойти до открытия файла');
    // Ключевая инварианта фикса: заголовок и тело — от одного открытого файла.
    assert.equal(res.headers.get('content-length'), String(HD_CONTENT.length));
    assert.equal(body.length, HD_CONTENT.length);
    assert.ok(body.equals(HD_CONTENT), 'тело должно быть цельной HD-версией, не смесью');
  } finally {
    (fs as any).open = realOpen;
  }
});
