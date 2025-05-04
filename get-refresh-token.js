require('dotenv').config();
const { google } = require('googleapis');
const http = require('http');
const url = require('url');
const open = require('open');

// Создаем OAuth клиент с данными из .env файла
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Указываем необходимые разрешения
const scopes = ['https://www.googleapis.com/auth/drive'];

// Генерируем URL для авторизации
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: scopes,
  // Обязательно указываем prompt: 'consent' для получения refresh_token
  prompt: 'consent'
});

console.log('Откройте эту ссылку в браузере для авторизации:');
console.log(authUrl);

// Пытаемся автоматически открыть URL в браузере
try {
  open(authUrl, { wait: false });
} catch (error) {
  console.log('Не удалось автоматически открыть браузер. Скопируйте ссылку выше и откройте вручную.');
}

// Создаем временный HTTP сервер для обработки callback от Google
let server;
server = http.createServer(async (req, res) => {
  try {
    const { pathname, query } = url.parse(req.url, true);
    
    if (query.code) {
      // Получаем токены
      const { tokens } = await oauth2Client.getToken(query.code);
      
      console.log('\n=== Токены для настройки .env файла ===\n');
      console.log('GOOGLE_REFRESH_TOKEN=' + tokens.refresh_token);
      console.log('\nAccess Token (для информации, не нужно добавлять в .env):');
      console.log(tokens.access_token);
      
      // Отправляем успешный ответ в браузер
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1>Токены успешно получены!</h1>
            <p>Вы можете закрыть это окно и вернуться в консоль.</p>
            <p>Скопируйте значение GOOGLE_REFRESH_TOKEN из консоли в ваш .env файл.</p>
          </body>
        </html>
      `);
      
      // Закрываем сервер после успешного получения токенов
      setTimeout(() => {
        server.close();
        console.log('\nПроцесс завершен. Можете закрыть это окно.');
        process.exit(0);
      }, 1000);
    } else {
      // Если в запросе нет кода
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('Ошибка: Не получен код авторизации');
    }
  } catch (error) {
    console.error('Ошибка при получении токенов:', error);
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end(`Ошибка: ${error.message}`);
  }
});

// Запускаем сервер на порту из URI перенаправления
const port = new URL(process.env.GOOGLE_REDIRECT_URI).port || 3000;
server.listen(port, () => {
  console.log(`\nОжидаем ответ от Google на порту ${port}...`);
}); 