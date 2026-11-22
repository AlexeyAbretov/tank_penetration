# Запуск

[Оглавление](../../README.md)

Нужны Node.js и npm.

```bash
npm install
npm run dev
```

Игра откроется на [http://localhost:8080](http://localhost:8080). Сервер слушает сеть, так что с телефона в той же Wi-Fi можно зайти по адресу компьютера.

| Команда | Что делает |
| --- | --- |
| `npm run dev` | Игра с горячей перезагрузкой |
| `npm run debug` | Дебаг-партия: [http://localhost:8080/index.html?debug](http://localhost:8080/index.html?debug). Флаг работает только на сервере разработки, сохранение лежит отдельно от обычной партии. В настройках переключатель «Пробитие» пишет на снаряде «пробивает» или «не пробивает» и на сам выстрел не влияет. В открытом магазине волны клавиша `M` и кнопка «+» слева от знака досыпают 10000 монет. В магазине после гибели — 10000 очков. Пока витрина закрыта, клавиша молчит. Между шестерёнкой и кнопкой паузы стоят четыре кнопки: тихая пауза, как пробел; перезапуск волны, как `R`; пропуск волны, как `N`; проигрыш, как `F` |
| `npm run build` | Проверка TypeScript и сборка в `dist/`. В папке манифест и service worker: страницу можно поставить на домашний экран |
| `npm run build:html` | Отдельный файл `release/tank-penetration.html`. Его открывают двойным кликом, без сервера |
| `npm run build:html:gift` | Тот же файл для племянника: `release/tank-penetration-gift.html`. Любая покупка в обоих магазинах стоит 1, даже на тяжёлой сложности. Здоровье и урон врагов берёт выбранная сложность |
| `npm run build:html:debug` | Дебаг-партия одним файлом: `release/tank-penetration-debug.html`. Открывается двойным кликом, `?debug` не нужен. Сохранение отдельно от обычной партии |
| `npm run build:apk` | APK для Android: `release/tank-penetration-<version>.apk`. `<version>` — поле `version` в `package.json`. Нужны JDK 21 или новее и Android SDK (Android Studio). Если в PATH стоит JDK 17, команда берёт JDK Android Studio. Файл подписан отладочным ключом: его ставят на телефон, в Google Play он не идёт. Экран альбомный |
| `npm run build:electron` | Один exe для Windows со своим Chromium: `release/tank-penetration-electron-<version>.exe`. `<version>` — поле `version` в `package.json`. Окно 1280×720, его можно растянуть. Первый запуск распаковывает файлы. Партия лежит отдельно от браузера и от exe WebView |
| `npm run build:webview` | Один exe для Windows на системном WebView2: `release/tank-penetration-webview-<version>.exe`. Для сборки нужен .NET SDK 8. Игроку .NET не нужен. Первый запуск распаковывает рантайм. На Windows 11 WebView2 уже стоит, на Windows 10 его ставит Edge. Окно 1280×720, его можно растянуть. Партия лежит отдельно от браузера и от exe Electron |
| `npm run preview` | Локальный просмотр собранной игры |

`npm run dev`, `npm run build` и `npm run preview` работают как раньше. Обычная сборка кладёт страницу, скрипт, картинки, манифест и service worker в `dist/`. Сервер разработки worker не регистрирует. `npm run preview` открывает собранную игру на localhost: её уже можно установить. `npm run build:html` эту папку не заменяет: команда шьёт скрипт, картинки, музыку, звуки боя и шрифт в один HTML. Файл с диска приложением не ставится. `npm run build:apk` сначала пишет в `dist/` ту же игру без service worker, копирует её в проект Android и кладёт APK в `release/` рядом с однофайловым HTML. `npm run build:electron` и `npm run build:webview` тоже сначала пишут в `dist/` игру без service worker, затем кладут свой exe в `release/`. Следующий `npm run build` снова добавляет в `dist/` манифест и worker. Если Android SDK не в `ANDROID_HOME`, скрипт ищет `%LOCALAPPDATA%\Android\Sdk`. Сохранение exe Electron лежит в `%APPDATA%\Tank Penetration\electron`. Сохранение exe WebView лежит в `%LOCALAPPDATA%\Tank Penetration\webview`. Ключи те же, что у страницы в браузере, партии между этими тремя местами не переносятся.

Установленное приложение открывается без адресной строки, в альбомной ориентации. Первый заход скачивает игру. Пока страница и ресурсы качаются, на поле видна полоса загрузки; процент появляется, когда очередь картинок и звуков начинает отвечать. Дальше игра открывается без сети. Новая публикация подменяет кэш и перезагружает уже открытую вкладку. Партия при этом лежит в `localStorage` и с перезагрузкой не пропадает.

Push в ветку, имя которой начинается с `release/release-`, публикует `dist/` на GitHub Pages: [https://alexeyabretov.github.io/tank_penetration/](https://alexeyabretov.github.io/tank_penetration/). В настройках репозитория источник Pages — GitHub Actions. В Chrome и Edge пункт меню «Установить приложение». На iPhone — «Поделиться», затем «На экран Домой».

Публикация релиза на GitHub запускает три сборки и прикрепляет `tank-penetration.html`, `tank-penetration-gift.html` и `tank-penetration-debug.html` к этому релизу. Черновик файлы не собирает: они появляются, когда релиз опубликован. Скачанный файл открывается в браузере без Node.js. Шрифт заголовков лежит в `public/fonts` и вшит в этот файл. Если шрифт не открылся, надписи остаются Impact или системным шрифтом.
