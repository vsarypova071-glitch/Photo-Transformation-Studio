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

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://ai-fotosessia.ru,https://www.ai-fotosessia.ru,http://localhost:5173,http://localhost:8080')
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

// /api/payment/create: 10 попыток / 15 мин на IP.
// Предотвращает спам-создание заказов в YooKassa и флуд к payment/create.
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много запросов к оплате. Попробуйте позже.', code: 'rate_limited' },
});

// /api/balance, /api/order, /api/referrals: умеренный лимит.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
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

// Лимитируем только создание платежей, НЕ вебхук.
// YooKassa вебхук приходит с одного IP и не должен попасть в rate limit.
app.use('/api/payment/create', paymentLimiter);
app.use('/api/payment', paymentRouter);
app.use('/api/balance', apiLimiter, balanceRouter);
app.use('/api/order', apiLimiter, orderRouter);
app.use('/api/credits', apiLimiter, creditsRouter);
app.use('/api/photos', photosRouter);
app.use('/api/generation', generationLimiter, generationRouter);
// Каталог стилей — читается всеми, не за feature flag.
// Если миграция 002 ещё не применена, route сам деградирует в пустой список.
app.use('/api/styles', stylesLimiter, stylesRouter);

// Referrals — за feature flag. При flag=false роуты не mount'ятся,
// и /api/referrals/* возвращает 404 как будто endpoint'ов нет.
if (flags.enableReferrals) {
  app.use('/api/referrals', apiLimiter, referralsRouter);
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

  // Webhook config check — видно сразу в pm2 logs после деплоя.
  // Если WEBHOOK_USER/PASS не заданы → вебхук fail-closed → кредиты не начислятся.
  const wbUser = (process.env.YOOKASSA_WEBHOOK_USER || '').trim();
  const wbPass = (process.env.YOOKASSA_WEBHOOK_PASS || '').trim();
  if (!wbUser || !wbPass) {
    console.error('[api] ⚠️  WEBHOOK CONFIG MISSING: YOOKASSA_WEBHOOK_USER and/or YOOKASSA_WEBHOOK_PASS not set!');
    console.error('[api]    Webhook will return 503 for ALL YooKassa callbacks → credits will NEVER be granted!');
    console.error('[api]    Fix: run  bash scripts/push-env-to-vps.sh  then pm2 restart all');
  } else {
    const appUrl = (process.env.APP_URL || 'https://www.ai-fotosessia.ru').replace(/\/$/, '');
    const host = appUrl.replace(/^https?:\/\//, '');
    console.log(`[api] ✅ Webhook auth configured: user=${wbUser}`);
    console.log(`[api]    YooKassa URL: https://${wbUser}:***@${host}/api/payment/webhook`);
  }
});
