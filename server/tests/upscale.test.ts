// Тесты фонового HD-апскейла (services/upscale.ts) БЕЗ реального ONNX-инференса:
// Python-процесс подменяется fake-spawn'ом, файловая система — реальная во
// временных каталогах. Ни одного платного вызова, ни Gemini, ни клиентских фото.
//
// Run: `npm test --prefix server`

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  UpscaleQueue,
  readUpscaleConfig,
  readPngSize,
  readJpegSize,
  readImageSize,
  kindFromName,
  validateSourcePath,
  type UpscaleConfig,
  type SpawnLike,
  type ChildLike,
} from '../services/upscale';
import { isInternalArtifactName } from '../routes/photos';

// ---------------------------------------------------------------------------
// Хелперы
// ---------------------------------------------------------------------------

/** Минимальный PNG-буфер: валидные сигнатура и IHDR (ширина/высота), паддинг
 *  нулями до нужного размера. Достаточно для readPngSize + порога minResultBytes. */
function makePng(width: number, height: number, totalBytes = 20 * 1024): Buffer {
  const buf = Buffer.alloc(Math.max(totalBytes, 33));
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8); // длина IHDR
  buf.write('IHDR', 12, 'latin1');
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  buf[24] = 8; // bit depth
  buf[25] = 6; // color type RGBA
  return buf;
}

/** Минимальный JPEG-буфер для Node-парсера: SOI + APP0(JFIF) + SOF0/SOF2 +
 *  EOI, паддинг нулями до totalBytes. Опции воспроизводят повреждения. */
function makeJpeg(
  width: number,
  height: number,
  opts: {
    totalBytes?: number;
    progressive?: boolean;
    fillBytes?: boolean;
    truncateBeforeSof?: boolean;
    badSegmentLength?: boolean;
  } = {},
): Buffer {
  const {
    totalBytes = 20 * 1024, progressive = false, fillBytes = false,
    truncateBeforeSof = false, badSegmentLength = false,
  } = opts;
  const parts: number[] = [0xff, 0xd8]; // SOI
  const app0 = [0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0]; // JFIF
  parts.push(0xff, 0xe0, 0, app0.length + 2, ...app0);
  if (badSegmentLength) {
    parts.push(0xff, 0xdb, 0x00, 0x01); // DQT с длиной 1 (< 2) — некорректно
    const buf = Buffer.alloc(Math.max(totalBytes, parts.length));
    Buffer.from(parts).copy(buf, 0);
    return buf;
  }
  if (truncateBeforeSof) return Buffer.from(parts); // обрыв: SOF так и не встретится
  if (fillBytes) parts.push(0xff, 0xff, 0xff); // fill-байты FF перед маркером
  const sofMarker = progressive ? 0xc2 : 0xc0;
  const sof = [8, height >> 8, height & 0xff, width >> 8, width & 0xff, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  parts.push(0xff, sofMarker, 0, sof.length + 2, ...sof);
  parts.push(0xff, 0xd9); // EOI
  const buf = Buffer.alloc(Math.max(totalBytes, parts.length));
  Buffer.from(parts).copy(buf, 0);
  return buf;
}

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'upscale-test-'));
}

function writeSource(dir: string, name: string, w = 100, h = 150): string {
  const p = path.join(dir, name);
  fs.writeFileSync(p, makePng(w, h));
  return p;
}

function writeJpegSource(dir: string, name: string, w = 100, h = 150): string {
  const p = path.join(dir, name);
  fs.writeFileSync(p, makeJpeg(w, h));
  return p;
}

function argOf(args: string[], flag: string): string {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : '';
}

class FakeChild extends EventEmitter implements ChildLike {
  stderr = new EventEmitter() as ChildLike['stderr'];
  killed = false;
  kill(signal?: NodeJS.Signals): boolean {
    this.killed = true;
    setImmediate(() => this.emit('close', null, signal ?? 'SIGKILL'));
    return true;
  }
}

interface FakeSpawnState {
  calls: number;
  maxConcurrent: number;
  lastChild: FakeChild | null;
}

/** Фабрика fake-spawn с заданным поведением "python-процесса". */
function makeFakeSpawn(
  behavior: (args: string[], child: FakeChild) => void,
  delayMs = 0,
): { spawnFn: SpawnLike; state: FakeSpawnState } {
  const state: FakeSpawnState = { calls: 0, maxConcurrent: 0, lastChild: null };
  let concurrent = 0;
  const spawnFn: SpawnLike = (_cmd, args) => {
    state.calls += 1;
    concurrent += 1;
    state.maxConcurrent = Math.max(state.maxConcurrent, concurrent);
    const child = new FakeChild();
    state.lastChild = child;
    setTimeout(() => {
      concurrent -= 1;
      behavior(args, child);
    }, delayMs);
    return child;
  };
  return { spawnFn, state };
}

/** Успешное поведение: пишет валидный 2x результат в -o в формате,
 *  соответствующем расширению выходного пути (как настоящий upscale.py),
 *  и завершается с кодом 0. */
function successBehavior(args: string[], child: FakeChild): void {
  const src = argOf(args, '-i');
  const out = argOf(args, '-o');
  const size = readImageSize(fs.readFileSync(src), kindFromName(path.basename(src))!);
  const outBuf = kindFromName(path.basename(out)) === 'png'
    ? makePng(size!.width * 2, size!.height * 2, 30 * 1024)
    : makeJpeg(size!.width * 2, size!.height * 2, { totalBytes: 30 * 1024 });
  fs.writeFileSync(out, outBuf);
  child.emit('close', 0, null);
}

function makeConfig(tempDir: string, overrides: Partial<UpscaleConfig> = {}): () => UpscaleConfig {
  return () => ({
    enabled: true,
    upscaleDir: '/fake-upscale-dir',
    tempDir,
    timeoutMs: 5_000,
    minAvailableRamMb: 0,
    maxQueueSize: 10,
    maxResultDimensionPx: 4000,
    minResultBytes: 10 * 1024,
    ...overrides,
  });
}

interface QueueSetup {
  queue: UpscaleQueue;
  state: FakeSpawnState;
  logs: string[];
}

function makeQueue(
  tempDir: string,
  behavior: (args: string[], child: FakeChild) => void,
  cfgOverrides: Partial<UpscaleConfig> = {},
  delayMs = 0,
): QueueSetup {
  const { spawnFn, state } = makeFakeSpawn(behavior, delayMs);
  const logs: string[] = [];
  const queue = new UpscaleQueue({
    config: makeConfig(tempDir, cfgOverrides),
    spawnFn,
    availableRamMb: () => 4_000,
    // venv/upscale.py "существуют", nice/ionice — нет (dev-платформа).
    fileExists: (p) => !p.startsWith('/usr/bin/'),
    log: (line) => logs.push(line),
  });
  return { queue, state, logs };
}

function logged(logs: string[], event: string, reason?: string): boolean {
  return logs.some((l) => {
    const j = JSON.parse(l);
    return j.event === event && (reason === undefined || j.reason === reason);
  });
}

// ---------------------------------------------------------------------------
// 1. Выключенный флаг
// ---------------------------------------------------------------------------

test('UPSCALE_ENABLED=false: ничего не запускается, дефолт конфига — false', async () => {
  const dir = makeTempDir();
  const src = writeSource(dir, 'gen_aaa.png');
  const { queue, state } = makeQueue(dir, successBehavior, { enabled: false });

  const r = queue.enqueue(src);
  await queue.idle();

  assert.deepEqual(r, { queued: false, reason: 'disabled' });
  assert.equal(state.calls, 0);

  const prev = process.env.UPSCALE_ENABLED;
  delete process.env.UPSCALE_ENABLED;
  try {
    assert.equal(readUpscaleConfig().enabled, false, 'флаг обязан быть false по умолчанию');
  } finally {
    if (prev !== undefined) process.env.UPSCALE_ENABLED = prev;
  }
});

// ---------------------------------------------------------------------------
// 2–4. Валидация путей
// ---------------------------------------------------------------------------

test('невалидное имя файла отклоняется', async () => {
  const dir = makeTempDir();
  const evil = writeSource(dir, 'evil.png');
  const { queue, state } = makeQueue(dir, successBehavior);

  assert.deepEqual(queue.enqueue(evil), { queued: false, reason: 'bad_name' });
  // .original/.tmp-артефакты не могут быть поставлены повторно (нет петли):
  assert.equal(validateSourcePath(path.join(dir, 'gen_a.original.png'), dir).ok, false);
  assert.equal(validateSourcePath(path.join(dir, 'gen_a.upscale-ff.tmp.png'), dir).ok, false);
  // относительный путь:
  assert.deepEqual(validateSourcePath('gen_a.png', dir), { ok: false, reason: 'not_absolute' });
  await queue.idle();
  assert.equal(state.calls, 0);
});

test('путь вне temp-photos отклоняется (включая ../ traversal)', async () => {
  const dir = makeTempDir();
  const outsideDir = makeTempDir();
  const outside = writeSource(outsideDir, 'gen_bbb.png');
  const { queue, state } = makeQueue(dir, successBehavior);

  assert.deepEqual(queue.enqueue(outside), { queued: false, reason: 'outside_temp_dir' });
  const traversal = path.join(dir, '..', path.basename(outsideDir), 'gen_bbb.png');
  assert.deepEqual(queue.enqueue(traversal), { queued: false, reason: 'outside_temp_dir' });
  await queue.idle();
  assert.equal(state.calls, 0);
});

test('symlink отклоняется', async (t) => {
  const dir = makeTempDir();
  const target = writeSource(dir, 'gen_real.png');
  const link = path.join(dir, 'gen_link.png');
  try {
    fs.symlinkSync(target, link, 'file');
  } catch {
    t.skip('нет прав на создание symlink на этой платформе (Windows без dev-mode)');
    return;
  }
  const { queue, state } = makeQueue(dir, successBehavior);
  assert.deepEqual(queue.enqueue(link), { queued: false, reason: 'not_regular_file' });
  await queue.idle();
  assert.equal(state.calls, 0);
});

// ---------------------------------------------------------------------------
// 5–6. Очередь
// ---------------------------------------------------------------------------

test('строго одна активная задача (concurrency=1)', async () => {
  const dir = makeTempDir();
  const s1 = writeSource(dir, 'gen_c1.png');
  const s2 = writeSource(dir, 'gen_c2.png');
  const s3 = writeSource(dir, 'gen_c3.png');
  const { queue, state } = makeQueue(dir, successBehavior, {}, 20);

  assert.equal(queue.enqueue(s1).queued, true);
  assert.equal(queue.enqueue(s2).queued, true);
  assert.equal(queue.enqueue(s3).queued, true);
  await queue.idle();

  assert.equal(state.calls, 3);
  assert.equal(state.maxConcurrent, 1, 'параллельных запусков быть не должно');
});

test('переполнение очереди и дубликаты пропускаются безопасно', async () => {
  const dir = makeTempDir();
  const s1 = writeSource(dir, 'gen_q1.png');
  const s2 = writeSource(dir, 'gen_q2.png');
  const s3 = writeSource(dir, 'gen_q3.png');
  const { queue, logs } = makeQueue(dir, successBehavior, { maxQueueSize: 1 }, 30);

  assert.equal(queue.enqueue(s1).queued, true); // сразу станет активной
  assert.deepEqual(queue.enqueue(s1), { queued: false, reason: 'duplicate' });
  assert.equal(queue.enqueue(s2).queued, true); // единственное место в очереди
  assert.deepEqual(queue.enqueue(s3), { queued: false, reason: 'queue_full' });
  await queue.idle();

  assert.ok(logged(logs, 'skipped', 'queue_full'));
  // s3 остался обычным изображением — пользователь ничего не потерял:
  assert.equal(readPngSize(fs.readFileSync(s3))!.width, 100);
});

// ---------------------------------------------------------------------------
// 7–11. Отказы, после которых оригинал обязан остаться нетронутым
// ---------------------------------------------------------------------------

async function expectOriginalIntact(setup: QueueSetup, src: string, original: Buffer): Promise<void> {
  await setup.queue.idle();
  assert.ok(fs.readFileSync(src).equals(original), 'оригинал должен остаться байт-в-байт');
  const leftovers = fs.readdirSync(path.dirname(src)).filter((n) => n.includes('.tmp.'));
  assert.deepEqual(leftovers, [], 'tmp-файлы должны быть удалены');
  const p = path.parse(src);
  const backup = path.join(p.dir, `${p.name}.original${p.ext}`);
  assert.ok(!fs.existsSync(backup), 'бэкап не создаётся при неудаче');
}

test('нехватка RAM: задача пропускается, оригинал нетронут', async () => {
  const dir = makeTempDir();
  const src = writeSource(dir, 'gen_ram.png');
  const original = fs.readFileSync(src);
  const { spawnFn, state } = makeFakeSpawn(successBehavior);
  const logs: string[] = [];
  const queue = new UpscaleQueue({
    config: makeConfig(dir, { minAvailableRamMb: 1800 }),
    spawnFn,
    availableRamMb: () => 100, // симулируем занятый сервер
    fileExists: (p) => !p.startsWith('/usr/bin/'),
    log: (l) => logs.push(l),
  });

  assert.equal(queue.enqueue(src).queued, true);
  await expectOriginalIntact({ queue, state, logs }, src, original);
  assert.equal(state.calls, 0);
  assert.ok(logged(logs, 'skipped', 'low_ram'));
});

test('timeout: процесс убивается, tmp удаляется, оригинал нетронут', async () => {
  const dir = makeTempDir();
  const src = writeSource(dir, 'gen_to.png');
  const original = fs.readFileSync(src);
  // Поведение: никогда не завершается сам (close придёт только от kill).
  const setup = makeQueue(dir, () => { /* висит */ }, { timeoutMs: 40 });

  assert.equal(setup.queue.enqueue(src).queued, true);
  await expectOriginalIntact(setup, src, original);
  assert.equal(setup.state.lastChild?.killed, true, 'дочерний процесс должен быть убит');
  assert.ok(logged(setup.logs, 'failed', 'timeout'));
});

test('exit code != 0: оригинал нетронут', async () => {
  const dir = makeTempDir();
  const src = writeSource(dir, 'gen_ec.png');
  const original = fs.readFileSync(src);
  const setup = makeQueue(dir, (_args, child) => child.emit('close', 5, null));

  assert.equal(setup.queue.enqueue(src).queued, true);
  await expectOriginalIntact(setup, src, original);
  assert.ok(logged(setup.logs, 'failed', 'exit_code'));
});

test('некорректный PNG на выходе: оригинал нетронут', async () => {
  const dir = makeTempDir();
  const src = writeSource(dir, 'gen_bad.png');
  const original = fs.readFileSync(src);
  const setup = makeQueue(dir, (args, child) => {
    fs.writeFileSync(argOf(args, '-o'), Buffer.alloc(20 * 1024, 0xab)); // не PNG
    child.emit('close', 0, null);
  });

  assert.equal(setup.queue.enqueue(src).queued, true);
  await expectOriginalIntact(setup, src, original);
  assert.ok(logged(setup.logs, 'failed', 'output_invalid_image'));
});

test('неверное разрешение (не 2x): оригинал нетронут', async () => {
  const dir = makeTempDir();
  const src = writeSource(dir, 'gen_wr.png', 100, 150);
  const original = fs.readFileSync(src);
  const setup = makeQueue(dir, (args, child) => {
    fs.writeFileSync(argOf(args, '-o'), makePng(100, 150, 30 * 1024)); // 1x вместо 2x
    child.emit('close', 0, null);
  });

  assert.equal(setup.queue.enqueue(src).queued, true);
  await expectOriginalIntact(setup, src, original);
  assert.ok(logged(setup.logs, 'failed', 'wrong_resolution'));
});

test('M-1: вход крупнее лимита (результат > 4000 px) пропускается до spawn, оригинал нетронут', async () => {
  const dir = makeTempDir();
  const src = writeSource(dir, 'gen_big.png', 2100, 50); // 2100*2=4200 > 4000
  const original = fs.readFileSync(src);
  const setup = makeQueue(dir, successBehavior);

  assert.equal(setup.queue.enqueue(src).queued, true);
  await expectOriginalIntact(setup, src, original);
  assert.equal(setup.state.calls, 0, 'python не должен запускаться вовсе');
  assert.ok(logged(setup.logs, 'skipped', 'source_too_large'));
});

test('подозрительно маленький результат: оригинал нетронут', async () => {
  const dir = makeTempDir();
  const src = writeSource(dir, 'gen_small.png', 100, 150);
  const original = fs.readFileSync(src);
  const setup = makeQueue(dir, (args, child) => {
    fs.writeFileSync(argOf(args, '-o'), makePng(200, 300, 1024)); // < minResultBytes
    child.emit('close', 0, null);
  });

  assert.equal(setup.queue.enqueue(src).queued, true);
  await expectOriginalIntact(setup, src, original);
  assert.ok(logged(setup.logs, 'failed', 'output_too_small'));
});

// ---------------------------------------------------------------------------
// 12. Успех: атомарная замена + бэкап
// ---------------------------------------------------------------------------

test('успех: файл заменён на 2x, mtime сохранён (M-2), оригинал в .original.png, tmp нет', async () => {
  const dir = makeTempDir();
  const src = writeSource(dir, 'gen_okay.png', 100, 150);
  const original = fs.readFileSync(src);
  // M-2: TTL-часы не должны сбрасываться заменой — фиксируем "старый" mtime.
  const past = new Date(Date.now() - 5 * 60_000);
  fs.utimesSync(src, past, past);
  const setup = makeQueue(dir, successBehavior);

  assert.equal(setup.queue.enqueue(src).queued, true);
  await setup.queue.idle();

  const replaced = readPngSize(fs.readFileSync(src));
  assert.deepEqual(replaced, { width: 200, height: 300 }, 'по прежнему URL теперь HD 2x');

  const mtimeAfter = fs.statSync(src).mtimeMs;
  assert.ok(
    Math.abs(mtimeAfter - past.getTime()) < 10,
    `mtime итогового файла обязан равняться mtime исходника (получено расхождение ${Math.abs(mtimeAfter - past.getTime())}ms)`,
  );

  const backup = src.replace(/\.png$/, '.original.png');
  assert.ok(fs.existsSync(backup), 'бэкап оригинала должен существовать');
  assert.ok(fs.readFileSync(backup).equals(original), 'бэкап равен исходным байтам');

  const leftovers = fs.readdirSync(dir).filter((n) => n.includes('.tmp.'));
  assert.deepEqual(leftovers, [], 'временных файлов не осталось');
  assert.ok(logged(setup.logs, 'done'));
});

// ---------------------------------------------------------------------------
// 13. TTL-очистка и публичная недоступность артефактов
// ---------------------------------------------------------------------------

test('артефакты upscale скрыты из публичного API; TTL-cron покрывает их по определению', () => {
  // Публичные роуты photos.ts обязаны отдавать 404 для внутренних файлов —
  // для всех трёх расширений:
  assert.equal(isInternalArtifactName('gen_abc.original.png'), true);
  assert.equal(isInternalArtifactName('gen_abc.original.jpg'), true);
  assert.equal(isInternalArtifactName('gen_abc.original.jpeg'), true);
  assert.equal(isInternalArtifactName('gen_abc.upscale-1a2b3c.tmp.png'), true);
  assert.equal(isInternalArtifactName('gen_abc.upscale-1a2b3c.tmp.jpg'), true);
  assert.equal(isInternalArtifactName('gen_abc.upscale-1a2b3c.tmp.jpeg'), true);
  assert.equal(isInternalArtifactName('gen_abc.png'), false, 'обычный результат остаётся публичным');
  assert.equal(isInternalArtifactName('gen_abc.jpg'), false, 'обычный jpg-результат остаётся публичным');
  assert.equal(isInternalArtifactName('src_abc.jpg'), false, 'загрузки пользователя не затронуты');

  // TTL-очистка: VPS-cron (server/scripts/cleanup-temp-photos.sh) выполняет
  // `find "$TEMP_DIR" -type f -mmin +TTL -delete` — БЕЗ фильтра по имени,
  // т.е. gen_*.png, gen_*.original.png и любые *.tmp.png удаляются одинаково.
  // Проверяем, что скрипт не сузили до конкретных масок:
  const script = fs.readFileSync(
    path.join(__dirname, '..', 'scripts', 'cleanup-temp-photos.sh'),
    'utf8',
  );
  assert.match(script, /find "\$TEMP_DIR" -type f -mmin \+"\$TTL_MIN"/);
  assert.ok(!script.includes('-name'), 'cleanup не должен фильтровать по имени файла');
});

// ---------------------------------------------------------------------------
// generation.ts: enqueue для обоих форматов Gemini (png и jpg), без guard
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// JPEG: unit-тесты парсера размеров
// ---------------------------------------------------------------------------

test('readJpegSize: baseline, progressive, fill-байты; повреждения отклоняются', () => {
  assert.deepEqual(readJpegSize(makeJpeg(320, 240)), { width: 320, height: 240 }, 'baseline SOF0');
  assert.deepEqual(readJpegSize(makeJpeg(321, 241, { progressive: true })), { width: 321, height: 241 }, 'progressive SOF2');
  assert.deepEqual(readJpegSize(makeJpeg(100, 200, { fillBytes: true })), { width: 100, height: 200 }, 'fill-байты FF перед маркером');
  assert.equal(readJpegSize(makeJpeg(100, 200, { truncateBeforeSof: true })), null, 'усечённый до SOF');
  assert.equal(readJpegSize(makeJpeg(100, 200, { badSegmentLength: true })), null, 'сегмент с длиной < 2');
  assert.equal(readJpegSize(makePng(100, 200)), null, 'PNG-байты — не JPEG');
  assert.equal(readJpegSize(Buffer.from([0xff, 0xd8, 0xff])), null, 'обрыв сразу после SOI');
  assert.equal(readJpegSize(Buffer.alloc(64, 0xab)), null, 'мусор без SOI');
  // Повреждение после SOI: не-маркерные байты вместо сегмента
  const broken = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), Buffer.alloc(64, 0x00)]);
  assert.equal(readJpegSize(broken), null, 'повреждённый поток после APP0 без SOF');
});

// ---------------------------------------------------------------------------
// JPEG: несовпадение сигнатуры и расширения — skip до spawn
// ---------------------------------------------------------------------------

test('JPEG-байты под именем .png отклоняются до запуска python', async () => {
  const dir = makeTempDir();
  const src = path.join(dir, 'gen_lies-png.png');
  fs.writeFileSync(src, makeJpeg(100, 150));
  const original = fs.readFileSync(src);
  const setup = makeQueue(dir, successBehavior);

  assert.equal(setup.queue.enqueue(src).queued, true);
  await expectOriginalIntact(setup, src, original);
  assert.equal(setup.state.calls, 0, 'python не должен запускаться');
  assert.ok(logged(setup.logs, 'skipped', 'source_invalid_image'));
});

test('PNG-байты под именем .jpg отклоняются до запуска python', async () => {
  const dir = makeTempDir();
  const src = path.join(dir, 'gen_lies-jpg.jpg');
  fs.writeFileSync(src, makePng(100, 150));
  const original = fs.readFileSync(src);
  const setup = makeQueue(dir, successBehavior);

  assert.equal(setup.queue.enqueue(src).queued, true);
  await expectOriginalIntact(setup, src, original);
  assert.equal(setup.state.calls, 0);
  assert.ok(logged(setup.logs, 'skipped', 'source_invalid_image'));
});

test('повреждённый JPEG-исходник отклоняется до spawn', async () => {
  const dir = makeTempDir();
  const src = path.join(dir, 'gen_broken.jpg');
  fs.writeFileSync(src, makeJpeg(100, 150, { truncateBeforeSof: true }));
  const setup = makeQueue(dir, successBehavior);

  assert.equal(setup.queue.enqueue(src).queued, true);
  await setup.queue.idle();
  assert.equal(setup.state.calls, 0);
  assert.ok(logged(setup.logs, 'skipped', 'source_invalid_image'));
});

test('неизвестное расширение (gen_x.webp) отклоняется по имени', async () => {
  const dir = makeTempDir();
  const evil = path.join(dir, 'gen_x.webp');
  fs.writeFileSync(evil, makePng(100, 150));
  const { queue, state } = makeQueue(dir, successBehavior);
  assert.deepEqual(queue.enqueue(evil), { queued: false, reason: 'bad_name' });
  await queue.idle();
  assert.equal(state.calls, 0);
});

// ---------------------------------------------------------------------------
// JPEG: лимиты и валидация результата
// ---------------------------------------------------------------------------

test('JPEG крупнее лимита входа пропускается до spawn', async () => {
  const dir = makeTempDir();
  const src = writeJpegSource(dir, 'gen_bigjpg.jpg', 2100, 50); // 4200 > 4000
  const original = fs.readFileSync(src);
  const setup = makeQueue(dir, successBehavior);

  assert.equal(setup.queue.enqueue(src).queued, true);
  await expectOriginalIntact(setup, src, original);
  assert.equal(setup.state.calls, 0);
  assert.ok(logged(setup.logs, 'skipped', 'source_too_large'));
});

test('слишком маленький JPEG-результат не заменяет источник, tmp удалён', async () => {
  const dir = makeTempDir();
  const src = writeJpegSource(dir, 'gen_smalljpg.jpg', 100, 150);
  const original = fs.readFileSync(src);
  const setup = makeQueue(dir, (args, child) => {
    fs.writeFileSync(argOf(args, '-o'), makeJpeg(200, 300, { totalBytes: 1024 })); // < minResultBytes
    child.emit('close', 0, null);
  });

  assert.equal(setup.queue.enqueue(src).queued, true);
  await expectOriginalIntact(setup, src, original);
  assert.ok(logged(setup.logs, 'failed', 'output_too_small'));
});

test('JPEG-выход с PNG-сигнатурой отклоняется, оригинал нетронут', async () => {
  const dir = makeTempDir();
  const src = writeJpegSource(dir, 'gen_pngout.jpg', 100, 150);
  const original = fs.readFileSync(src);
  const setup = makeQueue(dir, (args, child) => {
    fs.writeFileSync(argOf(args, '-o'), makePng(200, 300, 30 * 1024)); // не тот формат
    child.emit('close', 0, null);
  });

  assert.equal(setup.queue.enqueue(src).queued, true);
  await expectOriginalIntact(setup, src, original);
  assert.ok(logged(setup.logs, 'failed', 'output_invalid_image'));
});

test('PNG-выход с JPEG-сигнатурой отклоняется, оригинал нетронут', async () => {
  const dir = makeTempDir();
  const src = writeSource(dir, 'gen_jpgout.png', 100, 150);
  const original = fs.readFileSync(src);
  const setup = makeQueue(dir, (args, child) => {
    fs.writeFileSync(argOf(args, '-o'), makeJpeg(200, 300, { totalBytes: 30 * 1024 }));
    child.emit('close', 0, null);
  });

  assert.equal(setup.queue.enqueue(src).queued, true);
  await expectOriginalIntact(setup, src, original);
  assert.ok(logged(setup.logs, 'failed', 'output_invalid_image'));
});

// ---------------------------------------------------------------------------
// JPEG: полный успех .jpg и .jpeg
// ---------------------------------------------------------------------------

async function expectJpegSuccess(name: string): Promise<void> {
  const dir = makeTempDir();
  const src = writeJpegSource(dir, name, 100, 150);
  const original = fs.readFileSync(src);
  const past = new Date(Date.now() - 5 * 60_000);
  fs.utimesSync(src, past, past);
  const spawnedOutputs: string[] = [];
  const setup = makeQueue(dir, (args, child) => {
    spawnedOutputs.push(argOf(args, '-o'));
    successBehavior(args, child);
  });

  assert.equal(setup.queue.enqueue(src).queued, true);
  await setup.queue.idle();

  const ext = path.extname(name);
  // python получил выходной путь с ТЕМ ЖЕ расширением (формат сохранения)
  assert.equal(spawnedOutputs.length, 1);
  assert.ok(spawnedOutputs[0].endsWith(`.tmp${ext}`), `-o должен оканчиваться на .tmp${ext}`);

  // файл заменён на 2x JPEG по тому же пути (тот же URL)
  const replaced = fs.readFileSync(src);
  assert.deepEqual(readJpegSize(replaced), { width: 200, height: 300 });
  assert.ok(replaced[0] === 0xff && replaced[1] === 0xd8 && replaced[2] === 0xff, 'JPEG-сигнатура результата');

  // mtime сохранён (M-2)
  assert.ok(Math.abs(fs.statSync(src).mtimeMs - past.getTime()) < 10, 'mtime обязан сохраниться');

  // backup оригинала с тем же расширением
  const backup = path.join(dir, `${path.parse(name).name}.original${ext}`);
  assert.ok(fs.existsSync(backup), `бэкап ${path.basename(backup)} должен существовать`);
  assert.ok(fs.readFileSync(backup).equals(original), 'бэкап равен исходным байтам');

  // временных файлов не осталось
  assert.deepEqual(fs.readdirSync(dir).filter((n) => n.includes('.tmp')), []);
  assert.ok(logged(setup.logs, 'done'));
}

test('успех .jpg: атомарная замена, original, mtime, тот же URL, tmp нет', async () => {
  await expectJpegSuccess('gen_okjpg.jpg');
});

test('успех .jpeg: атомарная замена, original, mtime, тот же URL, tmp нет', async () => {
  await expectJpegSuccess('gen_okjpeg.jpeg');
});

test('generation.ts вызывает enqueueUpscale в обоих роутах без PNG-only guard', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'routes', 'generation.ts'), 'utf8');
  const calls = src.match(/enqueueUpscale\(/g) ?? [];
  assert.equal(calls.length, 2, 'ожидаются ровно два вызова: single и pair');
  assert.ok(!src.includes("if (ext === '.png')"), 'PNG-only guard должен быть удалён');
  const wrapped = src.match(/try \{ enqueueUpscale\(resultPath\); \} catch/g) ?? [];
  assert.equal(wrapped.length, 2, 'оба вызова обязаны быть в try/catch (fire-and-forget)');
});
