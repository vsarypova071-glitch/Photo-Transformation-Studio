#!/usr/bin/env bash
# test-webhook.sh — диагностика доступности webhook-эндпоинта ЮKassa.
#
# Запуск (с локальной машины или с VPS):
#   bash scripts/test-webhook.sh
#   bash scripts/test-webhook.sh --env server/.env   # читать крепы из другого файла
#
# Что проверяет:
#   1. Webhook-URL доступен по HTTPS (TCP connect + TLS)
#   2. 401 без авторизации  → Basic Auth настроен правильно
#   3. 200 с правильным Basic Auth → сервер принимает вебхук
#   4. pm2-логи за последние 30 строк (если запущен с VPS / есть pm2)
#   5. nginx пропускает Content-Type: application/json (не блокирует заголовок)
#
# Что НЕ проверяет:
#   — реальный платёж (для этого нужен живой payment_id из ЮKassa)
#   — начисление кредитов (бизнес-логика проверяется отдельно)

set -euo pipefail

# ── Цвета ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✅ $*${NC}"; }
fail() { echo -e "${RED}❌ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $*${NC}"; }
info() { echo -e "   $*"; }

# ── Читаем переменные ───────────────────────────────────────────────────────
ENV_FILE=".env"
if [[ "${1:-}" == "--env" && -n "${2:-}" ]]; then ENV_FILE="$2"; fi

load_var() {
  local name="$1"
  grep -E "^${name}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d'=' -f2- | tr -d '\r'
}

WEBHOOK_USER=$(load_var YOOKASSA_WEBHOOK_USER)
WEBHOOK_PASS=$(load_var YOOKASSA_WEBHOOK_PASS)
APP_URL=$(load_var APP_URL)
APP_URL="${APP_URL:-https://www.ai-fotosessia.ru}"

# Нормализуем: добавляем www. если нет
if [[ "$APP_URL" == "https://ai-fotosessia.ru" ]]; then
  APP_URL="https://www.ai-fotosessia.ru"
fi

WEBHOOK_URL="${APP_URL}/api/payment/webhook"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          WEBHOOK DIAGNOSTIC — $(date '+%Y-%m-%d %H:%M:%S')         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  Target: $WEBHOOK_URL"
echo "  Auth:   ${WEBHOOK_USER}:***"
echo ""

# ── 0. Проверяем что curl есть ──────────────────────────────────────────────
if ! command -v curl &>/dev/null; then
  fail "curl не найден. Установите curl и повторите."
  exit 1
fi

# ── 1. DNS + TCP connect ────────────────────────────────────────────────────
echo "── Тест 1: DNS + TLS-соединение ────────────────────────────────"
HOST=$(echo "$WEBHOOK_URL" | sed 's|https://||' | cut -d'/' -f1)
if curl -s --connect-timeout 10 --max-time 15 -o /dev/null "https://${HOST}"; then
  ok "Хост $HOST доступен по HTTPS"
else
  fail "Не удаётся подключиться к $HOST"
  info "Проверьте: nginx запущен? Домен разрезолвится? Firewall?"
fi

# ── 2. Без авторизации → 401 ────────────────────────────────────────────────
echo ""
echo "── Тест 2: запрос БЕЗ авторизации → ожидаем 401 ────────────────"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  --connect-timeout 10 --max-time 15 \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"event":"payment.waiting_for_capture","object":{"id":"test"}}' \
  "$WEBHOOK_URL" 2>/dev/null || echo "000")

if [[ "$HTTP_CODE" == "401" ]]; then
  ok "Вернул 401 — Basic Auth настроен и защищает эндпоинт"
elif [[ "$HTTP_CODE" == "503" ]]; then
  fail "Вернул 503 — YOOKASSA_WEBHOOK_USER/PASS не заданы в .env на сервере!"
  info "Решение: выполните  bash scripts/push-env-to-vps.sh"
elif [[ "$HTTP_CODE" == "000" ]]; then
  fail "Не удалось подключиться к $WEBHOOK_URL (curl timeout / network error)"
elif [[ "$HTTP_CODE" == "404" ]]; then
  fail "Вернул 404 — nginx не знает маршрут /api/payment/webhook"
  info "Проверьте nginx proxy_pass и location блоки"
else
  warn "Неожиданный ответ без авторизации: HTTP $HTTP_CODE"
fi

# ── 3. С правильными кредами → 200 ─────────────────────────────────────────
echo ""
echo "── Тест 3: запрос С авторизацией → ожидаем 200 ─────────────────"

if [[ -z "$WEBHOOK_USER" || -z "$WEBHOOK_PASS" ]]; then
  warn "YOOKASSA_WEBHOOK_USER/PASS не найдены в $ENV_FILE — пропускаем тест 3"
else
  # Минимально валидный payload (сервер ответит 200 до обработки, потом getPayment упадёт — это нормально)
  PAYLOAD='{"event":"payment.succeeded","object":{"id":"test_diag_000","status":"succeeded","metadata":{"order_id":"test_order_diag"}}}'

  RESPONSE_CODE=$(curl -s -o /tmp/webhook_response.txt -w "%{http_code}" \
    --connect-timeout 10 --max-time 20 \
    -X POST \
    -u "${WEBHOOK_USER}:${WEBHOOK_PASS}" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" \
    "$WEBHOOK_URL" 2>/dev/null || echo "000")

  RESPONSE_BODY=$(cat /tmp/webhook_response.txt 2>/dev/null || echo "")

  if [[ "$RESPONSE_CODE" == "200" ]]; then
    ok "Вернул 200 — эндпоинт доступен и принимает авторизацию"
    info "Тело ответа: $RESPONSE_BODY"
  elif [[ "$RESPONSE_CODE" == "401" ]]; then
    fail "Вернул 401 — НЕВЕРНЫЕ креды! Пароль в .env не совпадает с паролем в URL вебхука в ЮKassa"
    info "Локально: user=${WEBHOOK_USER} pass=${WEBHOOK_PASS}"
    info "Убедитесь, что в ЮKassa зарегистрирован URL: https://${WEBHOOK_USER}:${WEBHOOK_PASS}@${HOST}/api/payment/webhook"
  elif [[ "$RESPONSE_CODE" == "503" ]]; then
    fail "Вернул 503 — YOOKASSA_WEBHOOK_USER/PASS не заданы на сервере (fail-closed)"
    info "Решение: bash scripts/push-env-to-vps.sh"
  elif [[ "$RESPONSE_CODE" == "429" ]]; then
    fail "Вернул 429 — Rate limit! Вебхук попал под ограничение (уже исправлено в коде — задеплойте server)"
  elif [[ "$RESPONSE_CODE" == "000" ]]; then
    fail "Curl не смог подключиться (timeout/network)"
  else
    warn "HTTP $RESPONSE_CODE. Тело: $RESPONSE_BODY"
  fi
fi

# ── 4. pm2 логи (только если запущен на сервере) ────────────────────────────
echo ""
echo "── Тест 4: PM2 логи (последние webhook-строки) ──────────────────"
if command -v pm2 &>/dev/null; then
  echo "  Ищем '[webhook]' в логах pm2..."
  pm2 logs --nostream --lines 200 2>/dev/null | grep '\[webhook\]' | tail -20 || true
  echo ""
  ok "Логи выведены выше (пусто = вебхук никогда не доходил до сервера)"
else
  info "pm2 не найден — запустите этот скрипт на VPS или проверьте логи вручную:"
  info "  pm2 logs poto-api --lines 200 | grep webhook"
fi

# ── 5. Итог ─────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════════════"
echo "  ИТОГ"
echo "══════════════════════════════════════════════════════════════════"
echo ""
echo "  Правильный URL для личного кабинета ЮKassa:"
echo "  https://${WEBHOOK_USER:-USER}:${WEBHOOK_PASS:-PASS}@${HOST}/api/payment/webhook"
echo ""
echo "  Если тест 3 показал 200 — вебхук технически работает."
echo "  Если нет — выполните: bash scripts/push-env-to-vps.sh"
echo "  После фикса: bash deploy.sh server && bash scripts/test-webhook.sh"
echo ""
