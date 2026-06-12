#!/usr/bin/env bash
# push-env-to-vps.sh — синхронизирует переменные из локального .env на VPS.
#
# БЕЗОПАСЕН: добавляет только отсутствующие переменные, НЕ перезаписывает существующие.
# DATABASE_URL и другие VPS-специфичные переменные не трогает.
#
# Запуск:
#   bash scripts/push-env-to-vps.sh          # читает из .env
#   bash scripts/push-env-to-vps.sh --check  # только показывает расхождения, не меняет

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✅ $*${NC}"; }
fail() { echo -e "${RED}❌ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $*${NC}"; }
info() { echo -e "${CYAN}ℹ️  $*${NC}"; }
added(){ echo -e "${GREEN}➕ $*${NC}"; }

CHECK_ONLY=false
[[ "${1:-}" == "--check" ]] && CHECK_ONLY=true

VPS="root@62.113.111.113"
SSH_KEY="$HOME/.ssh/id_ed25519"
SSH="ssh -i $SSH_KEY"
VPS_ENV="/var/www/ai-fotosessia.ru/api/.env"
LOCAL_ENV=".env"

# Переменные, которые синхронизируем из локального .env на VPS.
# DATABASE_URL — специфична для VPS и сюда не входит.
VARS_TO_SYNC=(
  "PORT"
  "NODE_ENV"
  "APP_URL"
  "ALLOWED_ORIGINS"
  "YOOKASSA_SHOP_ID"
  "YOOKASSA_SECRET_KEY"
  "YOOKASSA_WEBHOOK_USER"
  "YOOKASSA_WEBHOOK_PASS"
  "OPENROUTER_API_KEY"
  "OPENROUTER_MODEL"
  "DIAGNOSTIC_TOKEN"
  "ENABLE_REFERRALS"
  "ENABLE_SUBSCRIPTIONS"
  "ENABLE_CLUB"
  "ENABLE_ARCHIVE"
  "DAILY_GENERATION_LIMIT"
  "FREE_ARCHIVE_TTL_MINUTES"
)

load_local_var() {
  grep -E "^${1}=" "$LOCAL_ENV" 2>/dev/null | head -1 | cut -d'=' -f2- | tr -d '\r' || true
}

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           ENV SYNC: local → VPS                             ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  VPS:   $VPS_ENV"
echo "  Local: $LOCAL_ENV"
[[ "$CHECK_ONLY" == true ]] && echo "  Режим: CHECK ONLY (изменений не будет)" || echo "  Режим: APPLY"
echo ""

# Проверяем SSH
echo "── Проверяем SSH-соединение ────────────────────────────────────"
if ! $SSH -i "$SSH_KEY" -o ConnectTimeout=10 -o BatchMode=yes "$VPS" "echo ok" &>/dev/null; then
  fail "Нет SSH-соединения с $VPS"
  info "Убедитесь что ssh-agent запущен и ключ добавлен: ssh-add $SSH_KEY"
  exit 1
fi
ok "SSH OK"

# Читаем текущий VPS .env
echo ""
echo "── Читаем текущий .env на VPS ──────────────────────────────────"
VPS_ENV_CONTENT=$($SSH "$VPS" "cat $VPS_ENV 2>/dev/null || echo ''")
if [[ -z "$VPS_ENV_CONTENT" ]]; then
  warn "VPS .env пуст или не существует. Создадим с нуля."
fi
ok "Прочитан"

# Сравниваем и синхронизируем
echo ""
echo "── Сравнение переменных ────────────────────────────────────────"

ADDED_COUNT=0
ALREADY_COUNT=0
SKIPPED_COUNT=0
DIFF_COUNT=0

for VAR in "${VARS_TO_SYNC[@]}"; do
  LOCAL_VAL=$(load_local_var "$VAR")

  # Есть ли переменная на VPS
  VPS_VAL=$(echo "$VPS_ENV_CONTENT" | grep -E "^${VAR}=" | head -1 | cut -d'=' -f2- | tr -d '\r' || true)

  if [[ -z "$LOCAL_VAL" ]]; then
    # Нет в локальном .env — пропускаем
    SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
    continue
  fi

  if [[ -z "$VPS_VAL" ]]; then
    # На VPS отсутствует — добавляем
    if [[ "$CHECK_ONLY" == true ]]; then
      warn "MISSING on VPS: $VAR"
    else
      $SSH "$VPS" "echo '${VAR}=${LOCAL_VAL}' >> $VPS_ENV"
      added "Добавлено: $VAR"
    fi
    ADDED_COUNT=$((ADDED_COUNT + 1))
  elif [[ "$VPS_VAL" != "$LOCAL_VAL" ]]; then
    # Значения различаются — НЕ перезаписываем автоматически, но предупреждаем
    DIFF_COUNT=$((DIFF_COUNT + 1))
    warn "РАЗНИЦА: $VAR"
    echo "    VPS:   ${VPS_VAL:0:40}..."
    echo "    Local: ${LOCAL_VAL:0:40}..."
    echo "    → Обновите вручную если нужно: ssh $VPS \"sed -i 's|^${VAR}=.*|${VAR}=${LOCAL_VAL}|' $VPS_ENV\""
  else
    ALREADY_COUNT=$((ALREADY_COUNT + 1))
    ok "OK: $VAR"
  fi
done

echo ""
echo "── Итог ────────────────────────────────────────────────────────"
[[ "$CHECK_ONLY" == false && "$ADDED_COUNT" -gt 0 ]] && ok "Добавлено переменных: $ADDED_COUNT"
[[ "$CHECK_ONLY" == true && "$ADDED_COUNT" -gt 0 ]] && warn "Отсутствует на VPS: $ADDED_COUNT (запустите без --check для исправления)"
[[ "$ALREADY_COUNT" -gt 0 ]] && ok "Уже совпадали: $ALREADY_COUNT"
[[ "$DIFF_COUNT" -gt 0 ]] && warn "Значения различаются (не перезаписаны автоматически): $DIFF_COUNT"
[[ "$SKIPPED_COUNT" -gt 0 ]] && info "Нет в локальном .env (пропущено): $SKIPPED_COUNT"

if [[ "$CHECK_ONLY" == false && "$ADDED_COUNT" -gt 0 ]]; then
  echo ""
  info "Перезапускаем PM2 чтобы переменные применились..."
  $SSH "$VPS" "pm2 restart all" && ok "PM2 перезапущен"
  echo ""
  ok "Готово! Теперь запустите: bash scripts/test-webhook.sh"
fi

# Специальная проверка webhook-переменных
echo ""
echo "── Критичная проверка: webhook auth переменные ─────────────────"
WH_USER=$(echo "$VPS_ENV_CONTENT" | grep "^YOOKASSA_WEBHOOK_USER=" | cut -d'=' -f2- || true)
WH_PASS=$(echo "$VPS_ENV_CONTENT" | grep "^YOOKASSA_WEBHOOK_PASS=" | cut -d'=' -f2- || true)

# Если добавляли — перечитаем
if [[ "$ADDED_COUNT" -gt 0 && "$CHECK_ONLY" == false ]]; then
  VPS_ENV_CONTENT=$($SSH "$VPS" "cat $VPS_ENV 2>/dev/null || echo ''")
  WH_USER=$(echo "$VPS_ENV_CONTENT" | grep "^YOOKASSA_WEBHOOK_USER=" | cut -d'=' -f2- || true)
  WH_PASS=$(echo "$VPS_ENV_CONTENT" | grep "^YOOKASSA_WEBHOOK_PASS=" | cut -d'=' -f2- || true)
fi

if [[ -z "$WH_USER" || -z "$WH_PASS" ]]; then
  fail "YOOKASSA_WEBHOOK_USER или YOOKASSA_WEBHOOK_PASS отсутствуют на VPS!"
  fail "Вебхук вернёт 503 для ЛЮБОГО запроса ЮKassa → кредиты не начислятся никогда!"
else
  ok "YOOKASSA_WEBHOOK_USER: $WH_USER"
  ok "YOOKASSA_WEBHOOK_PASS: (задан, ${#WH_PASS} символов)"
  echo ""
  HOST=$(echo "$(load_local_var APP_URL)" | sed 's|https://||' | sed 's|http://||')
  [[ -z "$HOST" ]] && HOST="www.ai-fotosessia.ru"
  echo "  ╔══════════════════════════════════════════════════════════════╗"
  echo "  ║  URL для личного кабинета ЮKassa → Интеграция → Вебхуки    ║"
  echo "  ╠══════════════════════════════════════════════════════════════╣"
  echo "  ║  https://${WH_USER}:${WH_PASS}@${HOST}/api/payment/webhook"
  echo "  ╚══════════════════════════════════════════════════════════════╝"
fi
