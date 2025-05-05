# GDriveAutoBackup

Автоматический бэкап сайта и базы данных на Google Drive с помощью Node.js.

## Функциональность

- Создание архива с файлами сайта
- Резервное копирование базы данных MySQL
- Загрузка файлов на Google Drive
- Автоматическое удаление старых бэкапов
- Запуск по расписанию с помощью CRON
- Возможность выборочного бэкапа (только сайт или только БД)
- Поддержка авторизации через Google Service Account
- Организация бэкапов в отдельные папки по дате
- Защита архивов паролем
- Ограничение количества хранимых бэкапов

## Установка

### Ubuntu Linux

1. Установите необходимые зависимости:
```bash
# Установка Node.js
sudo apt update
sudo apt install -y nodejs npm

# Установка MySQL client (для работы с mysqldump)
sudo apt install -y mysql-client
```

2. Сделайте установочный скрипт исполняемым:
```bash
chmod +x setup-ubuntu.sh
```

3. Запустите скрипт установки:
```bash
./setup-ubuntu.sh
```

4. Отредактируйте файл `.env` с вашими настройками

### Windows

1. Установите Node.js
2. Клонируйте репозиторий или скопируйте файлы
3. Установите зависимости:
```bash
npm install
```
4. Создайте файл `.env` с вашими настройками (или отредактируйте существующий)

## Настройка Google Drive API

### Метод 1: Использование сервисного аккаунта (рекомендуется для серверов)

1. Перейдите в [Google Cloud Console](https://console.cloud.google.com/)
2. Создайте новый проект
3. Включите Drive API для проекта
4. Перейдите в "IAM & Admin" → "Service Accounts"
5. Нажмите "+ CREATE SERVICE ACCOUNT"
6. Введите название и нажмите "CREATE AND CONTINUE"
7. Выберите роль "Editor" и нажмите "CONTINUE" и "DONE"
8. В списке сервисных аккаунтов нажмите на созданный аккаунт
9. Перейдите во вкладку "KEYS" и нажмите "ADD KEY" → "Create new key"
10. Выберите JSON и скачайте файл
11. Переименуйте файл в `service-account-key.json` и загрузите его в корневую директорию проекта
12. Создайте папку на Google Drive и предоставьте доступ сервисному аккаунту (email указан в файле ключа)

### Метод 2: Использование OAuth

1. Перейдите в [Google Developer Console](https://console.developers.google.com/)
2. Создайте новый проект
3. Включите Drive API для проекта
4. Создайте учетные данные OAuth для веб-приложения
5. Получите Client ID и Client Secret
6. Настройте URI перенаправления (например, http://localhost:3000)
7. Получите refresh_token, запустив:
```bash
npm run get-token
```

### Получение Refresh Token вручную

Для получения refresh_token выполните следующий код (один раз):

```javascript
const { google } = require('googleapis');
const open = require('open');
const http = require('http');
const url = require('url');

const oauth2Client = new google.auth.OAuth2(
  'YOUR_CLIENT_ID',
  'YOUR_CLIENT_SECRET',
  'YOUR_REDIRECT_URI'
);

const scopes = ['https://www.googleapis.com/auth/drive'];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: scopes,
  prompt: 'consent'
});

// Открываем URL для авторизации
open(authUrl, { wait: false });

// Создаем сервер для получения кода авторизации
http.createServer(async (req, res) => {
  try {
    const { query } = url.parse(req.url, true);
    if (query.code) {
      const { tokens } = await oauth2Client.getToken(query.code);
      console.log('Refresh Token:', tokens.refresh_token);
      console.log('Access Token:', tokens.access_token);
      
      res.end('Успешно получен токен. Вы можете закрыть это окно и проверить консоль.');
      server.close();
    }
  } catch (error) {
    console.error('Ошибка получения токена:', error);
    res.end('Ошибка получения токена');
  }
}).listen(3000, () => {
  console.log('Сервер запущен на порту 3000');
});
```

## Настройка расписания

### В Ubuntu Linux (crontab)

1. Откройте crontab для редактирования:
```bash
crontab -e
```

2. Добавьте строку для запуска бэкапа (например, каждый день в 2:00):
```
0 2 * * * /полный/путь/к/run-backup.sh >> /полный/путь/к/backup.log 2>&1
```

3. Также можно использовать команду напрямую:
```
0 2 * * * cd /полный/путь/к/папке && /usr/bin/node index.js --run-now >> backup.log 2>&1
```

Расписание в формате CRON указывается в следующем формате:
- `0 2 * * *` - каждый день в 2:00
- `0 */12 * * *` - каждые 12 часов
- `0 0 * * 0` - каждое воскресенье в полночь

### В Windows

Расписание бэкапов настраивается в файле `.env` через переменную `BACKUP_SCHEDULE` в формате CRON.

## Запуск

### Метод с сервисным аккаунтом (рекомендуется для серверов)

```bash
# Сделайте скрипт исполняемым
chmod +x run-backup-service.sh

# Полный бэкап (сайт + БД)
./run-backup-service.sh

# Только бэкап сайта
./run-backup-service.sh --website-only

# Только бэкап базы данных
./run-backup-service.sh --database-only
```

### Стандартный метод с OAuth

Для запуска по расписанию:
```bash
node index.js
```

Для ручного запуска бэкапа:
```bash
# Полный бэкап (сайт + БД)
node index.js --run-now
# или
./run-backup.sh

# Только бэкап сайта
node index.js --website-only
# или
./run-backup.sh --website-only
# или
npm run backup:site

# Только бэкап базы данных
node index.js --database-only
# или
./run-backup.sh --database-only
# или
npm run backup:db
```

## Структура проекта

- `index.js` - основной файл скрипта (OAuth)
- `service-account.js` - версия скрипта с использованием сервисного аккаунта
- `.env` - файл с настройками
- `.env.example` - пример файла настроек
- `temp/` - временная директория для файлов перед загрузкой
- `run-backup.sh` - скрипт для запуска в Linux (OAuth)
- `run-backup-service.sh` - скрипт для запуска в Linux (Service Account)
- `setup-ubuntu.sh` - скрипт установки для Ubuntu

## Примечания

- Для работы бэкапа базы данных требуется доступ к утилите `mysqldump`
- На Windows пути к директориям в .env должны использовать двойной обратный слеш: `C:\\path\\to\\website`
- На Linux используйте стандартные пути: `/path/to/website`
- Для автоматических бэкапов через cron добавьте строку:
  ```
  0 2 * * * /путь/к/GDriveAutoBackup/run-backup-service.sh >> /путь/к/GDriveAutoBackup/backup.log 2>&1
  ```

## Настройка

### Основные параметры в .env файле

```ini
# Пути к сайту и настройки БД
WEBSITE_PATH=/путь/к/сайту
BACKUP_WEBSITE=true
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=пароль
DB_NAME=имя_базы
BACKUP_DATABASE=true

# Настройки Google Drive
GOOGLE_DRIVE_FOLDER_ID=id_папки_на_google_drive

# Дополнительные настройки
ARCHIVE_PASSWORD=пароль_для_архивов    # оставьте пустым для архивов без пароля
MAX_BACKUPS=10                         # максимальное количество хранимых бэкапов
BACKUP_SCHEDULE="0 2 * * *"            # расписание в формате CRON
``` 