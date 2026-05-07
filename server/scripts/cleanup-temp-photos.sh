#!/usr/bin/env bash
# cleanup-temp-photos.sh
# Удаляет файлы старше 30 минут из директории временных фото.
# Папка /var/www/ai-fotosessia.ru/temp-photos появится в Phase 2 (генерация на Beget).
# Сейчас скрипт безопасно ничего не удаляет, если папки нет.
#
# Запускается по cron каждые 5 минут (см. server/scripts/install-cron.sh).
#
# ВАЖНО: НЕ ТРОГАЕМ orders, credit_accounts, credit_transactions — это история платежей.

set -u

TEMP_DIR="${POTO_TEMP_PHOTO_DIR:-/var/www/ai-fotosessia.ru/temp-photos}"
TTL_MIN="${POTO_TEMP_PHOTO_TTL_MIN:-30}"

if [ ! -d "$TEMP_DIR" ]; then
  # Нет папки — нечего удалять. Это нормально, пока генерация не на Beget.
  exit 0
fi

# Удаляем только файлы (не директории), старше TTL_MIN минут.
# -mmin +N  →  старше N минут
find "$TEMP_DIR" -type f -mmin +"$TTL_MIN" -print -delete 2>/dev/null | wc -l > /tmp/poto-cleanup.last
