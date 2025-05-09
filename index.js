require('dotenv').config();
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { google } = require('googleapis');
const { execSync } = require('child_process');
const schedule = require('node-schedule');

// Создаем папку для временных файлов
const TEMP_DIR = path.join(__dirname, 'temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR);
}

// Функция для авторизации в Google Drive
async function getGoogleDriveClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

// Функция для создания бэкапа сайта
async function backupWebsite() {
  return new Promise((resolve, reject) => {
    const websitePath = process.env.WEBSITE_PATH;
    const date = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
    const outputFile = path.join(TEMP_DIR, `website_backup_${date}.zip`);
    const output = fs.createWriteStream(outputFile);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`Бэкап сайта создан: ${outputFile}`);
      resolve(outputFile);
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);
    archive.directory(websitePath, false);
    archive.finalize();
  });
}

// Функция для создания бэкапа базы данных
async function backupDatabase() {
  const date = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
  const outputFile = path.join(TEMP_DIR, `db_backup_${date}.sql`);

  try {
    // Используем mysqldump для создания бэкапа
    execSync(
      `mysqldump -h ${process.env.DB_HOST} -u ${process.env.DB_USER} -p${process.env.DB_PASSWORD} ${process.env.DB_NAME} > ${outputFile}`,
      { stdio: 'inherit' }
    );

    // Сжимаем дамп БД
    const zipFile = `${outputFile}.zip`;
    const output = fs.createWriteStream(zipFile);
    const archive = archiver('zip', { zlib: { level: 9 } });

    return new Promise((resolve, reject) => {
      output.on('close', () => {
        // Удаляем несжатый файл
        fs.unlinkSync(outputFile);
        console.log(`Бэкап базы данных создан: ${zipFile}`);
        resolve(zipFile);
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);
      archive.file(outputFile, { name: path.basename(outputFile) });
      archive.finalize();
    });
  } catch (error) {
    console.error('Ошибка при создании бэкапа базы данных:', error);
    throw error;
  }
}

// Функция для загрузки файла на Google Drive
async function uploadToGoogleDrive(filePath) {
  try {
    const drive = await getGoogleDriveClient();
    const fileName = path.basename(filePath);

    const fileMetadata = {
      name: fileName,
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID]
    };

    const media = {
      mimeType: 'application/zip',
      body: fs.createReadStream(filePath)
    };

    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id'
    });

    console.log(`Файл загружен на Google Drive, ID: ${response.data.id}`);
    return response.data.id;
  } catch (error) {
    console.error('Ошибка при загрузке файла на Google Drive:', error);
    throw error;
  }
}

// Функция для удаления старых бэкапов из Google Drive
async function deleteOldBackups(days = 7) {
  try {
    const drive = await getGoogleDriveClient();
    
    // Получаем дату, старше которой будем удалять файлы
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffTime = cutoffDate.toISOString();

    // Находим файлы в папке для бэкапов
    const response = await drive.files.list({
      q: `'${process.env.GOOGLE_DRIVE_FOLDER_ID}' in parents and createdTime < '${cutoffTime}'`,
      fields: 'files(id, name, createdTime)',
      spaces: 'drive'
    });

    const files = response.data.files;
    if (files.length) {
      console.log(`Найдено ${files.length} старых бэкапов для удаления`);
      
      for (const file of files) {
        await drive.files.delete({ fileId: file.id });
        console.log(`Удален старый бэкап: ${file.name}`);
      }
    } else {
      console.log('Старых бэкапов для удаления не найдено');
    }
  } catch (error) {
    console.error('Ошибка при удалении старых бэкапов:', error);
  }
}

// Функция очистки временной директории
function cleanupTempDir() {
  try {
    const files = fs.readdirSync(TEMP_DIR);
    for (const file of files) {
      fs.unlinkSync(path.join(TEMP_DIR, file));
    }
    console.log('Временные файлы удалены');
  } catch (error) {
    console.error('Ошибка при очистке временных файлов:', error);
  }
}

// Основная функция для запуска бэкапа
async function runBackup() {
  console.log('Запуск процесса бэкапа:', new Date().toISOString());
  
  try {
    const backupTasks = [];
    const backupFiles = [];
    
    // Проверяем, нужно ли бэкапить сайт
    if (process.env.BACKUP_WEBSITE === 'true') {
      console.log('Включен бэкап сайта');
      backupTasks.push(backupWebsite());
    } else {
      console.log('Бэкап сайта отключен в настройках');
    }
    
    // Проверяем, нужно ли бэкапить базу данных
    if (process.env.BACKUP_DATABASE === 'true') {
      console.log('Включен бэкап базы данных');
      backupTasks.push(backupDatabase());
    } else {
      console.log('Бэкап базы данных отключен в настройках');
    }
    
    // Проверка наличия задач для бэкапа
    if (backupTasks.length === 0) {
      console.log('Ошибка: не выбрано ни одного источника для бэкапа. Проверьте настройки BACKUP_WEBSITE и BACKUP_DATABASE.');
      return;
    }
    
    // Выполняем все задачи бэкапа параллельно
    const results = await Promise.all(backupTasks);
    
    // Загружаем полученные файлы на Google Drive
    const uploadTasks = results.map(file => uploadToGoogleDrive(file));
    await Promise.all(uploadTasks);

    // Удаляем старые бэкапы
    await deleteOldBackups();

    // Очищаем временную директорию
    cleanupTempDir();
    
    console.log('Процесс бэкапа успешно завершен');
  } catch (error) {
    console.error('Ошибка при выполнении бэкапа:', error);
  }
}

// Запускаем бэкап по расписанию
const job = schedule.scheduleJob(process.env.BACKUP_SCHEDULE, runBackup);
console.log(`Задача бэкапа запланирована: ${process.env.BACKUP_SCHEDULE}`);

// Возможность запустить бэкап вручную
if (process.argv.includes('--run-now')) {
  runBackup();
}

// Возможность запустить только бэкап сайта
if (process.argv.includes('--website-only')) {
  process.env.BACKUP_WEBSITE = 'true';
  process.env.BACKUP_DATABASE = 'false';
  runBackup();
}

// Возможность запустить только бэкап базы данных
if (process.argv.includes('--database-only')) {
  process.env.BACKUP_WEBSITE = 'false';
  process.env.BACKUP_DATABASE = 'true';
  runBackup();
} 