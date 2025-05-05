#!/bin/bash
cd "$(dirname "$0")"

# Проверяем параметры запуска
if [ "$1" == "--website-only" ]; then
  echo "Запуск бэкапа только сайта (Service Account)..."
  node service-account.js --website-only
elif [ "$1" == "--database-only" ]; then
  echo "Запуск бэкапа только базы данных (Service Account)..."
  node service-account.js --database-only
else
  echo "Запуск полного бэкапа (Service Account)..."
  node service-account.js
fi 