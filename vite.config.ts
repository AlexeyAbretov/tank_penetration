// Настройки сборщика Vite: он отдаёт игру в браузер в режиме разработки
// и собирает готовые файлы командой npm run build.
// Манифест и service worker живут только здесь. Однофайловая сборка их не подключает:
// страницу с диска браузер как приложение не ставит.

// defineConfig даёт подсказки TypeScript по полям конфига.
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Иконка домашнего экрана на iOS. Ссылку пишет только эта сборка:
// рядом с однофайловым HTML такого файла нет.
function appleTouchIcon(): Plugin {
  return {
    name: 'apple-touch-icon',
    transformIndexHtml() {
      return [
        {
          tag: 'link',
          attrs: { rel: 'apple-touch-icon', href: './icons/apple-touch-icon.png' },
          injectTo: 'head',
        },
      ];
    },
  };
}

// export default — этот объект Vite читает как главный конфиг.
export default defineConfig({
  // Относительные пути к скриптам и картинкам.
  // GitHub Pages кладёт игру в подкаталог репозитория, не в корень сайта.
  // Точка в начале пути оставляет worker в том же каталоге, что и страница.
  base: './',
  plugins: [
    appleTouchIcon(),
    // Регистрация worker вставляется в страницу при сборке. В dev её нет:
    // иначе кэш держит старые картинки и звуки.
    // Новая публикация на Pages сама подменяет кэш и перезагружает открытую вкладку.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'Tank Penetration',
        short_name: 'Tank Penetration',
        description: 'Волновая оборона в браузере.',
        lang: 'ru',
        dir: 'ltr',
        id: './',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#090505',
        theme_color: '#090505',
        categories: ['games'],
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Без картинок, звука и шрифта установленная игра офлайн не откроется.
        globPatterns: ['**/*.{js,css,html,png,jpg,jpeg,svg,ico,webmanifest,mp3,ogg,wav,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: {
    // Локальный сервер разработки слушает порт 8080: http://localhost:8080
    port: 8080,
    // host: true — сервер доступен и с других устройств в той же сети, не только с этого компьютера.
    host: true,
  },
  build: {
    // Готовый JavaScript может использовать синтаксис ES2022 (современные браузеры).
    target: 'es2022',
  },
});
