import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { verifySignedToken } from '../services/signedPhotoLink';

const TEMP_DIR = process.env.PHOTO_TEMP_DIR || '/var/www/ai-fotosessia.ru/temp-photos';
const TTL_MIN = Number(process.env.PHOTO_TTL_MINUTES ?? 30);

// Гарантируем существование директории при старте (для cron).
fs.mkdirSync(TEMP_DIR, { recursive: true });

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, TEMP_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeExt = ALLOWED_EXT.has(ext) ? ext : '.jpg';
      cb(null, `src_${crypto.randomUUID()}${safeExt}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image uploads are allowed'));
      return;
    }
    cb(null, true);
  },
});

const router = Router();

// POST /api/photos/upload — multipart/form-data (field name: "photo")
router.post('/upload', (req, res) => {
  upload.single('photo')(req, res, (err: any) => {
    if (err) {
      const msg = err?.message || 'Upload failed';
      return res.status(400).json({ error: msg, code: err?.code });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const filename = req.file.filename;
    res.json({
      filename,
      url: `/api/photos/${filename}`,
      sizeBytes: req.file.size,
      ttlMinutes: TTL_MIN,
    });
  });
});

function mimeFor(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

function downloadFilename(originalExt: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
  const ext = originalExt === '.png' ? '.png'
            : originalExt === '.webp' ? '.webp'
            : '.jpg';
  return `ai-fotosessia-result-${stamp}${ext}`;
}

interface ResolvedFile {
  ok: true;
  filePath: string;
  size: number;
  mime: string;
  ext: string;
}
interface ResolveError {
  ok: false;
  status: number;
  body: { error: string; code?: string };
}

// Внутренние артефакты фонового upscale (бэкап оригинала gen_<id>.original.png
// и временные gen_<id>.upscale-<random>.tmp.png) не должны быть доступны через
// публичный API — для клиента существует только gen_<id>.png.
export function isInternalArtifactName(name: string): boolean {
  return /\.original\.\w+$/i.test(name) || /\.tmp\.\w+$/i.test(name) || name.includes('.upscale-');
}

function resolveFile(rawName: string): ResolvedFile | ResolveError {
  const safe = path.basename(rawName);
  if (isInternalArtifactName(safe)) {
    return { ok: false, status: 404, body: { error: 'Photo not found or expired' } };
  }
  const filePath = path.resolve(TEMP_DIR, safe);
  if (!filePath.startsWith(path.resolve(TEMP_DIR))) {
    return { ok: false, status: 400, body: { error: 'Bad filename' } };
  }
  let stats: fs.Stats;
  try {
    stats = fs.statSync(filePath);
  } catch {
    return { ok: false, status: 404, body: { error: 'Photo not found or expired' } };
  }
  if (!stats.isFile()) {
    return { ok: false, status: 404, body: { error: 'Photo not found or expired' } };
  }
  const ageMin = (Date.now() - stats.mtimeMs) / 60_000;
  if (ageMin > TTL_MIN) {
    fs.unlink(filePath, () => {}); // ускоряем cleanup
    return { ok: false, status: 410, body: { error: 'Photo expired', code: 'expired' } };
  }
  return {
    ok: true,
    filePath,
    size: stats.size,
    mime: mimeFor(safe),
    ext: path.extname(safe).toLowerCase(),
  };
}

// GET /api/photos/signed/:token — временная подписанная ссылка (по умолчанию 10 мин)
// для server-to-server fetch (AI Gateway/OpenRouter), а не для браузера.
// Токен несёт имя файла + срок действия внутри HMAC-подписи — путь не принимает
// имя файла напрямую, поэтому обход путей структурно невозможен (resolveFile
// ниже дополнительно перепроверяет через path.basename/containment).
// ВАЖНО: token/URL сюда никогда не логировать.
router.get('/signed/:token', (req, res) => {
  const result = verifySignedToken(req.params.token);
  if (!result.ok) {
    if (result.reason === 'expired') {
      return res.status(410).json({ error: 'Link expired', code: 'expired' });
    }
    return res.status(404).json({ error: 'Not found' });
  }

  const r = resolveFile(result.filename);
  if (!r.ok) return res.status(r.status).json(r.body);

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', r.mime);
  res.setHeader('Content-Length', String(r.size));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(r.filePath);
});

// GET /api/photos/:filename — обычная отдача (для <img src>)
router.get('/:filename', (req, res) => {
  const r = resolveFile(req.params.filename);
  if (!r.ok) return res.status(r.status).json(r.body);

  const ageMin = (Date.now() - fs.statSync(r.filePath).mtimeMs) / 60_000;
  const remainingSec = Math.max(0, Math.floor((TTL_MIN * 60) - ageMin * 60));
  res.setHeader('Cache-Control', `public, max-age=${remainingSec}, immutable`);
  res.setHeader('Content-Type', r.mime);
  res.setHeader('Content-Length', String(r.size));
  res.sendFile(r.filePath);
});

// GET /api/photos/download/:filename — принудительное скачивание с человеческим
// именем файла. Подходит для desktop <a href download> и mobile fallback.
// CORS: тот же origin — спецзаголовков не нужно.
router.get('/download/:filename', (req, res) => {
  const r = resolveFile(req.params.filename);
  if (!r.ok) return res.status(r.status).json(r.body);

  // Content-Length и поток обязаны относиться к ОДНОМУ открытому файлу:
  // фоновый upscale атомарно заменяет gen_<id>.png, и между stat в resolveFile
  // и открытием стрима файл может стать другим (другого размера). Поэтому:
  // open → fstat(fd) → createReadStream по этому же fd.
  fs.open(r.filePath, 'r', (openErr, fd) => {
    if (openErr) {
      return res.status(404).json({ error: 'Photo not found or expired' });
    }
    fs.fstat(fd, (statErr, st) => {
      if (statErr || !st.isFile()) {
        fs.close(fd, () => {});
        return res.status(404).json({ error: 'Photo not found or expired' });
      }

      const dlName = downloadFilename(r.ext);
      // Двойное кодирование: ASCII-fallback + UTF-8 (RFC 5987) — наш dlName ASCII,
      // но оставляем оба для совместимости с любыми будущими именами.
      const asciiName = dlName;
      const utf8Name = encodeURIComponent(dlName);

      res.setHeader('Content-Type', r.mime);
      res.setHeader('Content-Length', String(st.size));
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
      );
      // Безопасность: не позволять браузеру угадывать MIME
      res.setHeader('X-Content-Type-Options', 'nosniff');

      // autoClose закрывает fd при end/error/destroy; на обрыв соединения
      // клиентом явно останавливаем чтение.
      const stream = fs.createReadStream(r.filePath, { fd, autoClose: true });
      stream.on('error', () => res.destroy());
      res.on('close', () => stream.destroy());
      stream.pipe(res);
    });
  });
});

export default router;
