#!/usr/bin/env bash
# Однократная установка cron-задачи на VPS: каждые 5 минут чистить старые temp-photo файлы.
# Запустить вручную: bash install-cron.sh
# Идемпотентно — повторный запуск ничего не дублирует.

CRON_LINE="*/5 * * * * /var/www/ai-fotosessia.ru/api/scripts/cleanup-temp-photos.sh"

EXISTING=$(crontab -l 2>/dev/null || true)
if echo "$EXISTING" | grep -qF "cleanup-temp-photos.sh"; then
  echo "Cron уже установлен:"
else
  printf '%s\n%s\n' "$EXISTING" "$CRON_LINE" | grep -v '^$' | crontab -
  echo "Cron установлен:"
fi
crontab -l 2>/dev/null | grep cleanup-temp-photos.sh
