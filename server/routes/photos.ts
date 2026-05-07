import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

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

// GET /api/photos/:filename — отдача с TTL-проверкой
router.get('/:filename', (req, res) => {
  const safe = path.basename(req.params.filename);
  const filePath = path.join(TEMP_DIR, safe);

  // на всякий — не пускать наружу
  if (!filePath.startsWith(path.resolve(TEMP_DIR))) {
    return res.status(400).json({ error: 'Bad filename' });
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      return res.status(404).json({ error: 'Photo not found or expired' });
    }
    const ageMin = (Date.now() - stats.mtimeMs) / 60_000;
    if (ageMin > TTL_MIN) {
      // Просрочено — удаляем (cron всё равно подберёт, но ускорим).
      fs.unlink(filePath, () => {});
      return res.status(410).json({ error: 'Photo expired', code: 'expired' });
    }
    // короткоживущий кэш в браузере — но не дольше TTL
    const remainingSec = Math.max(0, Math.floor((TTL_MIN * 60) - ageMin * 60));
    res.setHeader('Cache-Control', `public, max-age=${remainingSec}, immutable`);
    res.sendFile(filePath);
  });
});

export default router;
