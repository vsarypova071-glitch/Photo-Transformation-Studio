// Фоновый бесплатный HD-апскейл результатов генерации (Real-ESRGAN-General-x4v3,
// ONNX Runtime CPU на этом же VPS). Философия безопасности:
//
//   1. Upscale НИКОГДА не участвует в ответе API, кредитах и транзакции
//      генерации — он только тихо улучшает уже сохранённый gen_<id>.png.
//   2. Оригинал не перезаписывается напрямую: результат пишется во временный
//      файл рядом, валидируется и только потом атомарно rename'ится поверх.
//      Любая ошибка на любом шаге ⇒ оригинал остаётся нетронутым, tmp удаляется.
//   3. Очередь в памяти, строго один worker (на VPS всего 2 ядра — второе
//      всегда остаётся API и PostgreSQL). Потеря очереди при рестарте PM2
//      допустима by design: оригиналы полностью рабочие.
//   4. Выключено по умолчанию (UPSCALE_ENABLED=false). Без флага модуль —
//      чистый no-op.
//
// Python-процесс запускается ТОЛЬКО по фиксированным путям внутри UPSCALE_DIR
// (venv/bin/python + upscale.py), через spawn без shell. Пользовательский ввод
// в аргументы не попадает: путь к файлу генерируется сервером (gen_<uuid>.png)
// и дополнительно валидируется здесь.

import { spawn as nodeSpawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Конфигурация (читается лениво при каждом обращении — тестируемо и позволяет
// включать флаг без пересборки, как в featureFlags.ts)
// ---------------------------------------------------------------------------

export interface UpscaleConfig {
  enabled: boolean;
  upscaleDir: string;
  tempDir: string;
  timeoutMs: number;
  minAvailableRamMb: number;
  maxQueueSize: number;
  /** Предохранитель: не принимать результат крупнее этого по любой стороне. */
  maxResultDimensionPx: number;
  /** Подозрительно маленький результат отклоняется. */
  minResultBytes: number;
}

function readBool(name: string): boolean {
  const raw = (process.env[name] ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function readInt(name: string, def: number, min: number, max: number): number {
  const n = Number(process.env[name] ?? def);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

export function readUpscaleConfig(): UpscaleConfig {
  return {
    enabled: readBool('UPSCALE_ENABLED'),
    upscaleDir: process.env.UPSCALE_DIR || '/opt/upscale',
    tempDir: process.env.PHOTO_TEMP_DIR || '/var/www/ai-fotosessia.ru/temp-photos',
    timeoutMs: readInt('UPSCALE_TIMEOUT_MS', 180_000, 1_000, 600_000),
    // 1800: пик python может достигать ~1.5 ГБ на максимально допустимом входе
    // (2000 px по стороне) — запас гварда обязан его перекрывать (ревью L-3).
    minAvailableRamMb: readInt('UPSCALE_MIN_AVAILABLE_RAM_MB', 1800, 0, 1_000_000),
    maxQueueSize: readInt('UPSCALE_MAX_QUEUE_SIZE', 10, 1, 100),
    // M-1: согласовано с MAX_INPUT_DIMENSION=2000 в upscale.py (вход ≤2000 px
    // по стороне ⇒ результат ≤4000). Больший вход означал бы float32-буфер
    // x4-результата в python на гигабайты — за пределами RAM этого VPS.
    maxResultDimensionPx: 4000,
    minResultBytes: 10 * 1024,
  };
}

// ---------------------------------------------------------------------------
// Валидация путей и PNG
// ---------------------------------------------------------------------------

/** Имя результата генерации: gen_<uuid>.png (см. generation.ts). Только .png —
 *  jpg-результаты Gemini сознательно не апскейлятся (модель и валидация
 *  заточены под PNG-пайплайн). */
const GEN_PNG_RE = /^gen_[A-Za-z0-9-]{1,64}\.png$/;

export type PathCheck = { ok: true; base: string } | { ok: false; reason: string };

export function validateSourcePath(filePath: string, tempDir: string): PathCheck {
  if (typeof filePath !== 'string' || filePath.length === 0 || filePath.includes('\0')) {
    return { ok: false, reason: 'empty_or_nul_path' };
  }
  if (!path.isAbsolute(filePath)) return { ok: false, reason: 'not_absolute' };
  const resolved = path.resolve(filePath);
  // Строго: файл лежит НЕПОСРЕДСТВЕННО в temp-папке (не в подпапке, без ../).
  if (path.dirname(resolved) !== path.resolve(tempDir)) {
    return { ok: false, reason: 'outside_temp_dir' };
  }
  const base = path.basename(resolved);
  if (!GEN_PNG_RE.test(base)) return { ok: false, reason: 'bad_name' };
  return { ok: true, base };
}

/** Минимальная безопасная проверка PNG: сигнатура + IHDR + размеры.
 *  Полное декодирование не выполняем (без новых зависимостей); повреждённый
 *  глубже IHDR файл отсеется проверками размера и соотношения 2x. */
export function readPngSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 33) return null;
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buf.subarray(0, 8).equals(sig)) return null;
  if (buf.toString('latin1', 12, 16) !== 'IHDR') return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  if (width === 0 || height === 0) return null;
  return { width, height };
}

async function readPngSizeFromFile(filePath: string): Promise<{ width: number; height: number } | null> {
  let fh: fsp.FileHandle | null = null;
  try {
    fh = await fsp.open(filePath, 'r');
    const buf = Buffer.alloc(33);
    const { bytesRead } = await fh.read(buf, 0, 33, 0);
    if (bytesRead < 33) return null;
    return readPngSize(buf);
  } catch {
    return null;
  } finally {
    await fh?.close().catch(() => {});
  }
}

/** MemAvailable из /proc/meminfo (Linux); fallback — os.freemem(). */
export function defaultAvailableRamMb(): number {
  try {
    const meminfo = fs.readFileSync('/proc/meminfo', 'latin1');
    const m = meminfo.match(/^MemAvailable:\s+(\d+)\s+kB/m);
    if (m) return Math.floor(Number(m[1]) / 1024);
  } catch {
    // не Linux — используем freemem
  }
  return Math.floor(os.freemem() / (1024 * 1024));
}

// ---------------------------------------------------------------------------
// Очередь
// ---------------------------------------------------------------------------

export interface ChildLike {
  on(event: 'close', cb: (code: number | null, signal: NodeJS.Signals | null) => void): unknown;
  on(event: 'error', cb: (err: Error) => void): unknown;
  kill(signal?: NodeJS.Signals): boolean;
  stderr?: { on(event: 'data', cb: (chunk: Buffer) => void): unknown } | null;
}

export type SpawnLike = (
  cmd: string,
  args: string[],
  opts: { stdio: Array<'ignore' | 'pipe'>; shell: false; windowsHide: true },
) => ChildLike;

export interface UpscaleDeps {
  config?: () => UpscaleConfig;
  spawnFn?: SpawnLike;
  availableRamMb?: () => number;
  /** Проверка существования бинарника/скрипта (в тестах подменяется). */
  fileExists?: (p: string) => boolean;
  log?: (line: string) => void;
}

export type EnqueueResult = { queued: true } | { queued: false; reason: string };

export class UpscaleQueue {
  private readonly config: () => UpscaleConfig;
  private readonly spawnFn: SpawnLike;
  private readonly availableRamMb: () => number;
  private readonly fileExists: (p: string) => boolean;
  private readonly log: (line: string) => void;

  private queue: string[] = [];
  private queued = new Set<string>();
  private active = false;

  constructor(deps: UpscaleDeps = {}) {
    this.config = deps.config ?? readUpscaleConfig;
    this.spawnFn = deps.spawnFn ?? (nodeSpawn as unknown as SpawnLike);
    this.availableRamMb = deps.availableRamMb ?? defaultAvailableRamMb;
    this.fileExists = deps.fileExists ?? ((p) => fs.existsSync(p));
    this.log = deps.log ?? ((line) => console.log(line));
  }

  private note(event: string, extra: Record<string, unknown> = {}): void {
    // Только серверные имена файлов и причины — никаких пользовательских данных.
    this.log(JSON.stringify({ tag: 'upscale', event, ...extra }));
  }

  /** Fire-and-forget постановка в очередь. Никогда не бросает. */
  enqueue(filePath: string): EnqueueResult {
    try {
      const cfg = this.config();
      if (!cfg.enabled) return { queued: false, reason: 'disabled' };

      const check = validateSourcePath(filePath, cfg.tempDir);
      if (!check.ok) {
        this.note('rejected', { reason: check.reason });
        return { queued: false, reason: check.reason };
      }
      const resolved = path.resolve(filePath);

      let st: fs.Stats;
      try {
        st = fs.lstatSync(resolved);
      } catch {
        this.note('rejected', { file: check.base, reason: 'not_found' });
        return { queued: false, reason: 'not_found' };
      }
      if (st.isSymbolicLink() || !st.isFile()) {
        this.note('rejected', { file: check.base, reason: 'not_regular_file' });
        return { queued: false, reason: 'not_regular_file' };
      }

      if (this.queued.has(resolved)) return { queued: false, reason: 'duplicate' };
      if (this.queue.length >= cfg.maxQueueSize) {
        this.note('skipped', { file: check.base, reason: 'queue_full' });
        return { queued: false, reason: 'queue_full' };
      }

      this.queued.add(resolved);
      this.queue.push(resolved);
      this.note('enqueued', { file: check.base, pending: this.queue.length });
      this.kick();
      return { queued: true };
    } catch (e: any) {
      this.note('enqueue_error', { reason: String(e?.message ?? e).slice(0, 200) });
      return { queued: false, reason: 'internal_error' };
    }
  }

  /** Для тестов: дождаться полного опустошения очереди. */
  async idle(): Promise<void> {
    while (this.active || this.queue.length > 0) {
      await new Promise((r) => setTimeout(r, 5));
    }
  }

  get pendingCount(): number {
    return this.queue.length + (this.active ? 1 : 0);
  }

  private kick(): void {
    if (this.active) return;
    const next = this.queue.shift();
    if (!next) return;
    this.active = true;
    void this.runTask(next)
      .catch((e: any) => this.note('task_crash', { reason: String(e?.message ?? e).slice(0, 200) }))
      .finally(() => {
        this.active = false;
        this.queued.delete(next);
        this.kick();
      });
  }

  private async runTask(src: string): Promise<void> {
    const cfg = this.config();
    const base = path.basename(src);
    const startedAt = Date.now();

    // Повторная проверка непосредственно перед работой (файл мог истечь по TTL).
    let st: fs.Stats;
    try {
      st = await fsp.lstat(src);
    } catch {
      this.note('skipped', { file: base, reason: 'source_gone' });
      return;
    }
    if (st.isSymbolicLink() || !st.isFile()) {
      this.note('skipped', { file: base, reason: 'not_regular_file' });
      return;
    }

    const ram = this.availableRamMb();
    if (ram < cfg.minAvailableRamMb) {
      this.note('skipped', { file: base, reason: 'low_ram', availableMb: ram });
      return;
    }

    const srcSize = await readPngSizeFromFile(src);
    if (!srcSize) {
      this.note('skipped', { file: base, reason: 'source_not_png' });
      return;
    }
    const expectedW = srcSize.width * 2;
    const expectedH = srcSize.height * 2;
    if (expectedW > cfg.maxResultDimensionPx || expectedH > cfg.maxResultDimensionPx) {
      this.note('skipped', { file: base, reason: 'source_too_large', w: srcSize.width, h: srcSize.height });
      return;
    }

    const python = path.join(cfg.upscaleDir, 'venv', 'bin', 'python');
    const script = path.join(cfg.upscaleDir, 'upscale.py');
    if (!this.fileExists(python) || !this.fileExists(script)) {
      this.note('skipped', { file: base, reason: 'runtime_missing' });
      return;
    }

    const tmp = src.replace(/\.png$/, `.upscale-${crypto.randomBytes(6).toString('hex')}.tmp.png`);
    let renamed = false;
    try {
      // nice/ionice — только если реально есть (на dev-Windows их нет).
      const inner = [python, script, '-i', src, '-o', tmp];
      let cmd: string;
      let args: string[];
      if (this.fileExists('/usr/bin/nice') && this.fileExists('/usr/bin/ionice')) {
        cmd = '/usr/bin/nice';
        args = ['-n', '19', '/usr/bin/ionice', '-c', '3', ...inner];
      } else {
        cmd = inner[0];
        args = inner.slice(1);
      }

      const run = await this.runChild(cmd, args, cfg.timeoutMs);
      if (run.timedOut) {
        this.note('failed', { file: base, reason: 'timeout', timeoutMs: cfg.timeoutMs });
        return;
      }
      if (run.code !== 0) {
        this.note('failed', { file: base, reason: 'exit_code', code: run.code, stderr: run.stderrTail });
        return;
      }

      // --- Валидация результата ---
      let outStat: fs.Stats;
      try {
        outStat = await fsp.stat(tmp);
      } catch {
        this.note('failed', { file: base, reason: 'no_output' });
        return;
      }
      if (!outStat.isFile() || outStat.size < cfg.minResultBytes) {
        this.note('failed', { file: base, reason: 'output_too_small', bytes: outStat.size });
        return;
      }
      const outSize = await readPngSizeFromFile(tmp);
      if (!outSize) {
        this.note('failed', { file: base, reason: 'output_not_png' });
        return;
      }
      if (outSize.width !== expectedW || outSize.height !== expectedH) {
        this.note('failed', {
          file: base, reason: 'wrong_resolution',
          got: `${outSize.width}x${outSize.height}`, expected: `${expectedW}x${expectedH}`,
        });
        return;
      }
      // Исходник всё ещё на месте (мог быть удалён TTL-очисткой за время работы)?
      let srcStat: fs.Stats;
      try {
        srcStat = await fsp.lstat(src);
        if (!srcStat.isFile()) throw new Error('gone');
      } catch {
        this.note('skipped', { file: base, reason: 'source_expired_during_upscale' });
        return;
      }

      // M-2: перенести atime/mtime оригинала на tmp ДО rename — TTL-часы файла
      // (cron `find -mmin` и resolveFile считают возраст по mtime) не должны
      // сбрасываться заменой. Побочная защита: если cron удалит исходник в
      // микро-окне между lstat выше и rename ниже, rename воссоздаст файл уже
      // с ИСТЁКШИМ mtime — resolveFile ответит 410 и не отдаст его, а ближайший
      // проход cron (≤5 мин) удалит. Реанимация живого файла невозможна.
      await fsp.utimes(tmp, srcStat.atime, srcStat.mtime);

      // --- Бэкап оригинала + атомарная замена ---
      const backup = src.replace(/\.png$/, '.original.png');
      await fsp.copyFile(src, backup);
      await fsp.rename(tmp, src);
      renamed = true;
      this.note('done', {
        file: base,
        ms: Date.now() - startedAt,
        result: `${outSize.width}x${outSize.height}`,
        bytes: outStat.size,
      });
    } catch (e: any) {
      this.note('failed', { file: base, reason: 'unexpected', message: String(e?.message ?? e).slice(0, 200) });
    } finally {
      if (!renamed) await fsp.unlink(tmp).catch(() => {});
    }
  }

  private runChild(
    cmd: string,
    args: string[],
    timeoutMs: number,
  ): Promise<{ code: number | null; timedOut: boolean; stderrTail: string }> {
    return new Promise((resolve) => {
      let child: ChildLike;
      try {
        child = this.spawnFn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'], shell: false, windowsHide: true });
      } catch (e: any) {
        resolve({ code: null, timedOut: false, stderrTail: String(e?.message ?? e).slice(0, 300) });
        return;
      }
      let timedOut = false;
      let stderrTail = '';
      let settled = false;
      const timer = setTimeout(() => {
        timedOut = true;
        try { child.kill('SIGKILL'); } catch { /* уже завершился */ }
      }, timeoutMs);
      child.stderr?.on('data', (chunk: Buffer) => {
        stderrTail = (stderrTail + chunk.toString('utf8')).slice(-300);
      });
      child.on('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ code: null, timedOut, stderrTail: String(err?.message ?? err).slice(0, 300) });
      });
      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ code, timedOut, stderrTail });
      });
    });
  }
}

// ---------------------------------------------------------------------------
// Singleton для production-использования
// ---------------------------------------------------------------------------

const defaultQueue = new UpscaleQueue();

/** Fire-and-forget: поставить только что записанный gen_<id>.png в очередь
 *  фонового HD-апскейла. Безопасно вызывать всегда — при выключенном флаге,
 *  плохом пути или переполнении очереди просто вернёт { queued: false }. */
export function enqueueUpscale(filePath: string): EnqueueResult {
  return defaultQueue.enqueue(filePath);
}
