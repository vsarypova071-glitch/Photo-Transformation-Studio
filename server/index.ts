import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import paymentRouter from './routes/payment';
import balanceRouter from './routes/balance';
import orderRouter from './routes/order';
import creditsRouter from './routes/credits';
import photosRouter from './routes/photos';
import generationRouter from './routes/generation';
import stylesRouter from './routes/styles';
import referralsRouter from './routes/referrals';
import { flags, summary as featureSummary } from './featureFlags';

const app = express();
app.set('trust proxy', 1); // nginx reverse proxy — correct req.ip for rate-limiter
const PORT = Number(process.env.PORT || 3000);

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://ai-fotosessia.ru,http://localhost:5173,http://localhost:8080')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function cors(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
}

app.use(cors);

// YooKassa webhook отдельно: raw body не нужен (подпись через HTTPS),
// но express.json должен быть до маршрута. Лимит 1mb достаточно для callback.
app.use(express.json({ limit: '1mb' }));

const generationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много запросов. Попробуйте позже.', code: 'rate_limited' },
});

const stylesLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много запросов. Попробуйте позже.', code: 'rate_limited' },
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'beget-api', ts: new Date().toISOString() });
});

// Источник правды для фронта: какие фичи включены, лимиты.
// Не зависит от feature flags — всегда доступен.
app.get('/api/config', (_req, res) => {
  res.json(featureSummary());
});

app.use('/api/payment', paymentRouter);
app.use('/api/balance', balanceRouter);
app.use('/api/order', orderRouter);
app.use('/api/credits', creditsRouter);
app.use('/api/photos', photosRouter);
app.use('/api/generation', generationLimiter, generationRouter);
// Каталог стилей — читается всеми, не за feature flag.
// Если миграция 002 ещё не применена, route сам деградирует в пустой список.
app.use('/api/styles', stylesLimiter, stylesRouter);

// Referrals — за feature flag. При flag=false роуты не mount'ятся,
// и /api/referrals/* возвращает 404 как будто endpoint'ов нет.
if (flags.enableReferrals) {
  app.use('/api/referrals', referralsRouter);
  console.log('[api] referrals enabled');
}

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[unhandled]', err?.stack || err?.message || err);
  res.status(500).json({ error: 'Internal error' });
});

app.listen(PORT, () => {
  console.log(`[api] listening on :${PORT}`);
  console.log(`[api] allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
});
