#!/usr/bin/env bash
# deploy.sh — безопасный деплой на VPS
# Никогда не удаляет public/style-previews/ и пользовательские assets.
#
# Использование:
#   bash deploy.sh           — деплой frontend + server
#   bash deploy.sh frontend  — только frontend
#   bash deploy.sh server    — только server (API)
#
# Требования на локальной машине: bash, ssh, scp, node/npm/bun, tsc.
# rsync запускается на VPS, поэтому локально не нужен.

set -euo pipefail

VPS="root@62.113.111.113"
SSH_KEY="$HOME/.ssh/id_ed25519"
VPS_PUBLIC="/var/www/ai-fotosessia.ru/public"
VPS_API="/var/www/ai-fotosessia.ru/api/dist"
TMP_DIST="/tmp/poto-new-dist"
TMP_API="/tmp/poto-new-api"

SSH="ssh -i $SSH_KEY"
SCP="scp -i $SSH_KEY"

MODE="${1:-all}"

deploy_frontend() {
  echo "==> [frontend] Building..."
  npm run build

  echo "==> [frontend] Uploading dist/ to VPS temp dir..."
  # Очищаем старый temp и создаём структуру заранее (scp remote setstat fix)
  $SSH "$VPS" "rm -rf $TMP_DIST && mkdir -p $TMP_DIST/assets"
  # Загружаем содержимое dist/ (не саму папку)
  $SCP -r dist/. "$VPS:$TMP_DIST/"

  echo "==> [frontend] Syncing to public/ (style-previews PROTECTED)..."
  $SSH "$VPS" "rsync -av --delete \
    --exclude 'style-previews' \
    $TMP_DIST/ $VPS_PUBLIC/"

  echo "==> [frontend] Cleanup temp..."
  $SSH "$VPS" "rm -rf $TMP_DIST"

  echo "==> [frontend] Done. Protected: $VPS_PUBLIC/style-previews/"
}

deploy_server() {
  echo "==> [server] Building TypeScript..."
  ( cd server && npx tsc )

  echo "==> [server] Uploading server/dist/ to VPS temp dir..."
  $SSH "$VPS" "rm -rf $TMP_API && mkdir -p $TMP_API"
  $SCP -r server/dist/. "$VPS:$TMP_API/"

  echo "==> [server] Syncing to api/dist/..."
  $SSH "$VPS" "rsync -av --delete $TMP_API/ $VPS_API/"

  echo "==> [server] Cleanup temp..."
  $SSH "$VPS" "rm -rf $TMP_API"

  echo "==> [server] Restarting PM2..."
  $SSH "$VPS" "pm2 restart all"

  echo "==> [server] Done."
}

verify() {
  echo ""
  echo "==> Verifying deployment..."
  $SSH "$VPS" "
    echo '--- public/ contents ---'
    ls $VPS_PUBLIC/
    echo ''
    echo '--- style-previews/ (must exist!) ---'
    ls $VPS_PUBLIC/style-previews/ | head -5
    echo ''
    echo '--- kids previews ---'
    ls $VPS_PUBLIC/style-previews/kids/ | wc -l && echo 'files in kids/'
    echo ''
    echo '--- PM2 status ---'
    pm2 list
    echo ''
    echo '--- API health check ---'
    curl -s http://localhost:3000/api/styles | python3 -c 'import sys,json; d=json.load(sys.stdin); print(\"styles count:\", d.get(\"count\", \"?\"))' 2>/dev/null || echo '(health check skipped)'
  "
}

case "$MODE" in
  frontend) deploy_frontend ;;
  server)   deploy_server ;;
  all)      deploy_frontend; deploy_server ;;
  *)        echo "Usage: bash deploy.sh [frontend|server|all]"; exit 1 ;;
esac

verify
echo ""
echo "==> Deploy complete!"
