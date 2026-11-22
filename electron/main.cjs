// Окно Windows: свой Chromium Electron показывает собранную игру.
// Страница — dist рядом с этим файлом. В упакованном exe те же пути внутри архива.

const { app, BrowserWindow, Menu } = require('electron');
const path = require('node:path');

// Профиль отдельно от браузера и от окна WebView. Ключи localStorage те же, каталог другой.
app.setName('Tank Penetration');
app.setPath('userData', path.join(app.getPath('appData'), 'Tank Penetration', 'electron'));
Menu.setApplicationMenu(null);

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    // 1280×720 — поле игры, без рамки окна в этом числе.
    useContentSize: true,
    backgroundColor: '#090505',
    autoHideMenuBar: true,
    title: 'Tank Penetration',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: false,
    },
  });
  win.setMenuBarVisibility(false);
  // Масштаб страницы разъезжает холст. Игра сама подгоняет поле под размер окна.
  win.webContents.setVisualZoomLevelLimits(1, 1);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file:')) {
      event.preventDefault();
    }
  });
  void win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  app.quit();
});
