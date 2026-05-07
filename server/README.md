# Beget API server (poto-transformation-studio)

Минимальный Express-бэкенд для оплаты ЮKassa и работы с заказами.
Заменяет Supabase Edge Functions: `create-payment`, `yookassa-webhook`,
`check-order`, `find-recent-order`, `get-balance`.

> Phase 1 — только оплата. Генерация (OpenRouter), хранилище фото и cleanup-cron — Phase 2.

## Endpoints

| Метод | Путь                      | Что делает                                                   |
|-------|---------------------------|--------------------------------------------------------------|
| GET   | `/api/health`             | healthcheck                                                  |
| POST  | `/api/payment/create`     | создать заказ в БД и платёж в ЮKassa, вернуть `paymentUrl`   |
| POST  | `/api/payment/webhook`    | обработать колбэк ЮKassa, начислить кредиты в `credit_accounts` |
| GET   | `/api/order/check`        | статус заказа (`?order_id=`)                                 |
| GET   | `/api/order/find-recent`  | последний оплаченный заказ за 24ч (`?customer_key=`)         |
| GET   | `/api/balance`            | баланс кошелька (`?customer_key=`)                           |

## Локальный запуск

```bash
cd server
cp .env.example .env   # заполнить значениями
npm install
npm run dev            # tsx watch index.ts → http://localhost:3000
```

## Применить схему БД

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

Идемпотентно — можно гонять повторно.

## Сборка / production

```bash
npm install --omit=dev   # production deps
npm install              # подтянуть tsx/typescript для сборки
npm run build            # tsc → dist/
node dist/index.js
```

## Деплой на Beget

### Вариант A — Node.js хостинг Beget

1. Залить содержимое `server/` в директорию приложения (исключая `node_modules`, `dist`).
2. В панели Beget → Node.js → создать приложение, указать:
   - Файл запуска: `dist/index.js`
   - Версия Node: 20+
3. По SSH:
   ```bash
   cd ~/path/to/app
   npm ci
   npm run build
   ```
4. Прописать env-переменные в панели Beget (раздел «Переменные окружения»):
   `DATABASE_URL`, `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`, `APP_URL`, `ALLOWED_ORIGINS`, `NODE_ENV=production`, `PORT` (тот, что Beget даёт приложению).
5. Перезапустить приложение из панели.

### Вариант B — VPS Beget + PM2 (если есть VPS)

```bash
# на сервере
cd ~/poto-api
npm ci
npm run build
npm i -g pm2
pm2 start dist/index.js --name poto-api --time
pm2 save
pm2 startup
```

В Nginx (`/etc/nginx/sites-enabled/...`) проксировать `/api/*` → `http://127.0.0.1:3000`:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Origin $http_origin;
    proxy_read_timeout 60s;
}
```

## Webhook ЮKassa

В личном кабинете ЮKassa → Интеграция → HTTP-уведомления:

- URL: `https://ai-fotosessia.ru/api/payment/webhook`
- События: `payment.succeeded`, `payment.canceled` (минимум).

Webhook отвечает `200 OK` сразу, обработка идёт в фоне — это требование ЮKassa
(timeout у них 30 сек).

## Проверка после деплоя

```bash
# 1. Health
curl https://ai-fotosessia.ru/api/health

# 2. Создание платежа (тестовый запрос)
curl -X POST https://ai-fotosessia.ru/api/payment/create \
  -H "Content-Type: application/json" \
  -H "Origin: https://ai-fotosessia.ru" \
  -d '{
    "tariffId":"basic",
    "userSessionId":"anon_test",
    "customerKey":"cust_test_123",
    "customerEmail":"test@example.com",
    "styleIds":[],
    "originalImageUrl":null,
    "isFullBody":false
  }'
# Ожидаем: { "orderId":"...", "paymentId":"...", "paymentUrl":"https://yoomoney..." }
```

При `invalid_credentials` от ЮKassa в логах сервера будет:
```
[yookassa] create payment failed { code: 'invalid_credentials', ... }
```
→ Проверить `YOOKASSA_SHOP_ID` (только цифры) и `YOOKASSA_SECRET_KEY` (`live_...`/`test_...` без пробелов).

## Безопасность

- `.env` не коммитить (см. `.gitignore`).
- Все секреты только на сервере. На фронт идёт **только** `VITE_API_URL`.
- БД-креды должны быть **без префикса `VITE_`** — иначе попадут в client bundle.
