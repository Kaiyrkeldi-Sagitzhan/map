#!/bin/bash
# Запусти этот скрипт НА СЕРВЕРЕ
# Добавляет deploy ключ в authorized_keys с ограничениями
#
# Использование:
#   bash build/setup/1_add_deploy_key.sh

set -euo pipefail

KEY_FILE="$HOME/.ssh/kzmap_deploy.pub"
AUTH_FILE="$HOME/.ssh/authorized_keys"
DEPLOY_SCRIPT="/home/ask/map/build/rebuild.sh"

# Проверяем что публичный ключ существует
if [ ! -f "$KEY_FILE" ]; then
  echo "[✗] Файл $KEY_FILE не найден."
  echo "    Создай ключ: ssh-keygen -t ed25519 -C 'github-ci-deploy' -f ~/.ssh/kzmap_deploy"
  exit 1
fi

PUB_KEY=$(cat "$KEY_FILE")

# Проверяем что ключ ещё не добавлен
if grep -qF "$PUB_KEY" "$AUTH_FILE" 2>/dev/null; then
  echo "[!] Ключ уже есть в $AUTH_FILE — пропускаем."
  exit 0
fi

# Добавляем с ограничениями
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"
touch "$AUTH_FILE"
chmod 600 "$AUTH_FILE"

echo "command=\"bash $DEPLOY_SCRIPT 1\",no-pty,no-port-forwarding,no-X11-forwarding,no-agent-forwarding,restrict $PUB_KEY" >> "$AUTH_FILE"

echo "[✓] Ключ добавлен в $AUTH_FILE"
echo ""
echo "Проверка (последняя строка authorized_keys):"
tail -1 "$AUTH_FILE"
