#!/bin/bash

# Выводим информацию о действиях
echo "Проверка зависимостей для GDriveAutoBackup..."

# Проверяем наличие Node.js
if ! command -v node &> /dev/null; then
    echo "Ошибка: Node.js не установлен. Пожалуйста, установите Node.js и повторите попытку."
    exit 1
else
    echo "Node.js установлен: $(node --version)"
fi

# Проверяем наличие MySQL client (для mysqldump)
if ! command -v mysqldump &> /dev/null; then
    echo "Ошибка: MySQL client не установлен. Пожалуйста, установите mysql-client и повторите попытку."
    exit 1
else
    echo "MySQL client установлен: $(mysqldump --version | head -n 1)"
fi

# Устанавливаем npm пакеты
echo "Устанавливаем npm зависимости..."
npm install

# Делаем скрипт запуска исполняемым
echo "Делаем скрипт запуска исполняемым..."
chmod +x run-backup.sh

# Создаем директорию для временных файлов, если её нет
if [ ! -d "temp" ]; then
    echo "Создаем директорию temp..."
    mkdir temp
fi

# Проверяем наличие файла .env
if [ ! -f ".env" ]; then
    echo "Файл .env не найден. Используем шаблон..."
    cp .env.example .env 2>/dev/null || echo "Файл .env.example тоже не найден. Пожалуйста, создайте файл .env вручную."
    echo "Пожалуйста, отредактируйте файл .env с вашими настройками."
fi

echo "Настройка завершена!"
echo "Для получения токена Google Drive выполните: npm run get-token"
echo "Для настройки автоматического запуска используйте crontab -e"
echo "Например: 0 2 * * * $(pwd)/run-backup.sh >> $(pwd)/backup.log 2>&1" 