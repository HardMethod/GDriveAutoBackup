require('dotenv').config();
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { google } = require('googleapis');
const { execSync } = require('child_process');

// Путь к файлу ключа сервисного аккаунта
const KEY_FILE_PATH = path.join(__dirname, 'service-account-key.json');

// Создаем папку для временных файлов
const TEMP_DIR = path.join(__dirname, 'temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR);
}

// Значения по умолчанию
const DEFAULT_MAX_BACKUPS = process.env.MAX_BACKUPS || 7; // По умолчанию храним 7 бэкапов
const DEFAULT_ARCHIVE_PASSWORD = process.env.ARCHIVE_PASSWORD || ''; // По умолчанию без пароля

// Функция для авторизации в Google Drive через сервисный аккаунт
async function getGoogleDriveClient() {
  // Проверяем наличие файла ключа
  if (!fs.existsSync(KEY_FILE_PATH)) {
    throw new Error(`Файл ключа сервисного аккаунта не найден: ${KEY_FILE_PATH}`);
  }

  // Создаем JWT клиент с помощью файла ключа
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE_PATH,
    scopes: ['https://www.googleapis.com/auth/drive']
  });
  
  const authClient = await auth.getClient();
  return google.drive({ version: 'v3', auth: authClient });
}

// Функция для создания папки на Google Drive
async function createFolder(drive, folderName, parentFolderId) {
  console.log(`Создание папки "${folderName}" в родительской папке ${parentFolderId}...`);
  
  const folderMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentFolderId]
  };
  
  try {
    const response = await drive.files.create({
      resource: folderMetadata,
      fields: 'id'
    });
    
    console.log(`Папка создана с ID: ${response.data.id}`);
    return response.data.id;
  } catch (error) {
    console.error('Ошибка при создании папки:', error);
    throw error;
  }
}

// Функция для проверки существования папки с заданным именем
async function findFolder(drive, folderName, parentFolderId) {
  console.log(`Поиск папки "${folderName}" в родительской папке ${parentFolderId}...`);
  
  try {
    const response = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and '${parentFolderId}' in parents and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive'
    });
    
    if (response.data.files.length > 0) {
      console.log(`Найдена существующая папка "${folderName}" с ID: ${response.data.files[0].id}`);
      return response.data.files[0].id;
    }
    
    console.log(`Папка "${folderName}" не найдена, будет создана новая`);
    return null;
  } catch (error) {
    console.error('Ошибка при поиске папки:', error);
    throw error;
  }
}

// Функция для создания бэкапа сайта
async function backupWebsite(password = '') {
  return new Promise((resolve, reject) => {
    const websitePath = process.env.WEBSITE_PATH;
    const date = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
    const outputFile = path.join(TEMP_DIR, `website_backup_${date}.zip`);
    const output = fs.createWriteStream(outputFile);
    
    // Создаем архив
    let archive;
    if (password) {
      // Если пароль задан, используем специальные опции для защиты паролем
      archive = archiver('zip', { 
        zlib: { level: 9 },
        forceLocalTime: true,
        password: password
      });
      console.log('Создание защищенного паролем архива сайта...');
    } else {
      archive = archiver('zip', { zlib: { level: 9 } });
      console.log('Создание архива сайта без пароля...');
    }

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
async function backupDatabase(password = '') {
  const date = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
  const outputFile = path.join(TEMP_DIR, `db_backup_${date}.sql`);

  try {
    // Используем mysqldump для создания бэкапа
    console.log('Выполнение mysqldump...');
    execSync(
      `mysqldump -h ${process.env.DB_HOST} -u ${process.env.DB_USER} -p${process.env.DB_PASSWORD} ${process.env.DB_NAME} > ${outputFile}`,
      { stdio: 'inherit' }
    );

    // Сжимаем дамп БД
    const zipFile = `${outputFile}.zip`;
    const output = fs.createWriteStream(zipFile);
    
    // Создаем архив
    let archive;
    if (password) {
      // Если пароль задан, используем специальные опции для защиты паролем
      archive = archiver('zip', { 
        zlib: { level: 9 },
        forceLocalTime: true,
        password: password
      });
      console.log('Создание защищенного паролем архива базы данных...');
    } else {
      archive = archiver('zip', { zlib: { level: 9 } });
      console.log('Создание архива базы данных без пароля...');
    }

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
async function uploadToGoogleDrive(filePath, folderId) {
  try {
    const drive = await getGoogleDriveClient();
    const fileName = path.basename(filePath);

    console.log(`Загрузка файла на Google Drive: ${fileName} в папку ${folderId}`);

    const fileMetadata = {
      name: fileName,
      parents: [folderId]
    };

    const media = {
      mimeType: 'application/zip',
      body: fs.createReadStream(filePath)
    };

    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id,name'
    });

    console.log(`Файл успешно загружен: ${response.data.name}, ID: ${response.data.id}`);
    return response.data.id;
  } catch (error) {
    console.error('Ошибка при загрузке файла на Google Drive:', error);
    throw error;
  }
}

// Функция для получения списка папок бэкапов
async function listBackupFolders(parentFolderId) {
  try {
    const drive = await getGoogleDriveClient();
    
    const response = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`,
      fields: 'files(id, name, createdTime)',
      orderBy: 'createdTime',
      spaces: 'drive'
    });
    
    return response.data.files;
  } catch (error) {
    console.error('Ошибка при получении списка папок бэкапа:', error);
    throw error;
  }
}

// Функция для удаления папки с файлами
async function deleteFolder(folderId) {
  try {
    const drive = await getGoogleDriveClient();
    await drive.files.delete({ fileId: folderId });
    console.log(`Папка с ID ${folderId} удалена`);
  } catch (error) {
    console.error(`Ошибка при удалении папки ${folderId}:`, error);
  }
}

// Функция для ограничения числа бэкапов
async function limitBackupCount(maxBackups = DEFAULT_MAX_BACKUPS) {
  try {
    const parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    console.log(`Проверка количества бэкапов (максимум: ${maxBackups})...`);
    
    // Получаем список всех папок бэкапов
    const folders = await listBackupFolders(parentFolderId);
    
    // Если количество папок превышает лимит, удаляем самые старые
    if (folders.length > maxBackups) {
      console.log(`Найдено ${folders.length} бэкапов, необходимо удалить ${folders.length - maxBackups}`);
      
      // Сортируем по дате создания (от старых к новым)
      folders.sort((a, b) => new Date(a.createdTime) - new Date(b.createdTime));
      
      // Удаляем лишние папки (начиная с самых старых)
      const foldersToDelete = folders.slice(0, folders.length - maxBackups);
      
      for (const folder of foldersToDelete) {
        console.log(`Удаление старого бэкапа: ${folder.name} (${folder.createdTime})`);
        await deleteFolder(folder.id);
      }
    } else {
      console.log(`Текущее количество бэкапов (${folders.length}) не превышает лимит (${maxBackups})`);
    }
  } catch (error) {
    console.error('Ошибка при ограничении количества бэкапов:', error);
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
    // Получаем значения из настроек или командной строки
    const archivePassword = process.env.ARCHIVE_PASSWORD || DEFAULT_ARCHIVE_PASSWORD;
    const maxBackups = parseInt(process.env.MAX_BACKUPS || DEFAULT_MAX_BACKUPS);
    
    // Создаем массивы для задач бэкапа
    const backupTasks = [];
    
    // Проверяем, нужно ли бэкапить сайт
    if (process.env.BACKUP_WEBSITE === 'true') {
      console.log('Включен бэкап сайта');
      backupTasks.push(backupWebsite(archivePassword));
    } else {
      console.log('Бэкап сайта отключен в настройках');
    }
    
    // Проверяем, нужно ли бэкапить базу данных
    if (process.env.BACKUP_DATABASE === 'true') {
      console.log('Включен бэкап базы данных');
      backupTasks.push(backupDatabase(archivePassword));
    } else {
      console.log('Бэкап базы данных отключен в настройках');
    }
    
    // Проверка наличия задач для бэкапа
    if (backupTasks.length === 0) {
      console.log('Ошибка: не выбрано ни одного источника для бэкапа. Проверьте настройки BACKUP_WEBSITE и BACKUP_DATABASE.');
      return;
    }
    
    // Создаем клиент Google Drive
    const drive = await getGoogleDriveClient();
    
    // Создаем папку с текущей датой для этого бэкапа
    const backupDate = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const backupFolderName = `Backup_${backupDate}`;
    
    // Проверяем, существует ли уже папка с таким именем
    let backupFolderId = await findFolder(drive, backupFolderName, process.env.GOOGLE_DRIVE_FOLDER_ID);
    
    // Если папка не найдена, создаем её
    if (!backupFolderId) {
      backupFolderId = await createFolder(drive, backupFolderName, process.env.GOOGLE_DRIVE_FOLDER_ID);
    }
    
    // Выполняем все задачи бэкапа параллельно
    const results = await Promise.all(backupTasks);
    
    // Загружаем полученные файлы на Google Drive в созданную папку
    const uploadTasks = results.map(file => uploadToGoogleDrive(file, backupFolderId));
    await Promise.all(uploadTasks);
    
    // Ограничиваем количество бэкапов
    await limitBackupCount(maxBackups);

    // Очищаем временную директорию
    cleanupTempDir();
    
    console.log('Процесс бэкапа успешно завершен');
  } catch (error) {
    console.error('Ошибка при выполнении бэкапа:', error);
  }
}

// Определяем тип бэкапа по параметрам командной строки
if (process.argv.includes('--website-only')) {
  process.env.BACKUP_WEBSITE = 'true';
  process.env.BACKUP_DATABASE = 'false';
  runBackup();
} else if (process.argv.includes('--database-only')) {
  process.env.BACKUP_WEBSITE = 'false';
  process.env.BACKUP_DATABASE = 'true';
  runBackup();
} else {
  runBackup();
} 