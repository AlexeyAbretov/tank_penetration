// Настройки сборщика Vite: он отдаёт игру в браузер в режиме разработки
// и собирает готовые файлы командой npm run build.

// defineConfig даёт подсказки TypeScript по полям конфига.
import { defineConfig } from 'vite';

// export default — этот объект Vite читает как главный конфиг.
export default defineConfig({
  // Относительные пути к скриптам и картинкам.
  // Игру можно открыть из папки, а не только с корня сайта.
  base: './',
  server: {
    // Локальный сервер разработки слушает порт 8080: http://localhost:8080
    port: 8080,
    // host: true — сервер доступен и с других устройств в той же сети, не только с этого компьютера.
    host: true,
  },
  build: {
    // Готовый JavaScript может использовать синтаксис ES2022 (современные браузеры).
    target: 'es2022',
    rollupOptions: {
      // Две страницы: игра и просмотр спрайтов (preview.html).
      input: {
        main: 'index.html',
        preview: 'preview.html',
      },
    },
  },
});
