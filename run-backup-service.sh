#!/bin/bash

# Добавляем общие пути в PATH
export PATH="$PATH:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

# Если используется nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Находим node в системе
if command -v node >/dev/null 2>&1; then
    if [ "$1" == "--website-only" ]; then
        echo "Запуск бэкапа только сайта (Service Account)..."
        node /var/www/GDriveAutoBackup/service-account.js --website-only
    elif [ "$1" == "--database-only" ]; then
        echo "Запуск бэкапа только базы данных (Service Account)..."
        node /var/www/GDriveAutoBackup/service-account.js --database-only
    else
        echo "Запуск полного бэкапа (Service Account)..."
        node /var/www/GDriveAutoBackup/service-account.js
    fi
else
    echo "Error: Node.js not found in system"
    exit 1
fi 