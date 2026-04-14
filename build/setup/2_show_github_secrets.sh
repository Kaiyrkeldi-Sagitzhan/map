#!/bin/bash
# Запусти этот скрипт НА СЕРВЕРЕ
# Показывает все значения которые нужно вставить в GitHub Secrets
#
# Использование:
#   bash build/setup/2_show_github_secrets.sh

set -euo pipefail

KEY_FILE="$HOME/.ssh/kzmap_deploy"

if [ ! -f "$KEY_FILE" ]; then
  echo "[✗] Приватный ключ $KEY_FILE не найден."
  exit 1
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "  Добавь эти секреты в GitHub:"
echo "  Settings → Secrets and variables → Actions → New secret"
echo "════════════════════════════════════════════════════════"
echo ""
echo "── SSH_HOST ────────────────────────────────────────────"
ip addr show | grep 'inet ' | grep -v '127.0.0.1' | awk '{print $2}' | cut -d/ -f1 | head -1
echo ""
echo "── SSH_USER ────────────────────────────────────────────"
whoami
echo ""
echo "── SSH_PORT ────────────────────────────────────────────"
echo "22"
echo ""
echo "── DEPLOY_PATH ─────────────────────────────────────────"
echo "/home/$(whoami)/map"
echo ""
echo "── SSH_PRIVATE_KEY ─────────────────────────────────────"
cat "$KEY_FILE"
echo ""
echo "════════════════════════════════════════════════════════"
echo "  Ссылка на секреты:"
echo "  https://github.com/Kaiyrkeldi-Sagitzhan/map/settings/secrets/actions"
echo "════════════════════════════════════════════════════════"
echo ""
