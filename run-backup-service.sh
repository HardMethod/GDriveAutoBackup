#!/bin/bash

# Добавляем общие пути в PATH
export PATH="$PATH:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

# Если используется nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Находим node в системе
if command -v node >/dev/null 2>&1; then
    # Запускаем скрипт с найденной версией node
    node /var/www/GDriveAutoBackup/service-account.js
else
    echo "Error: Node.js not found in system"
    exit 1
fi 