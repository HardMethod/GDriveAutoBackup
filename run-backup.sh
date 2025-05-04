#!/bin/bash
cd "$(dirname "$0")"

# Проверяем параметры запуска
if [ "$1" == "--website-only" ]; then
  echo "Запуск бэкапа только сайта..."
  node index.js --website-only
elif [ "$1" == "--database-only" ]; then
  echo "Запуск бэкапа только базы данных..."
  node index.js --database-only
else
  echo "Запуск полного бэкапа..."
  node index.js --run-now
fi 