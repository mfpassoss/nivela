/* Janela do aplicativo de mesa (Electron). Carrega o mesmo app web, sem depender de internet. */
const { app, BrowserWindow, session, Menu, shell } = require('electron');
const path = require('path');

// áudio pode começar sem clique (o automix emenda sozinho)
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.setName('Nivela');

function createWindow() {
  const win = new BrowserWindow({
    width: 1360, height: 900, minWidth: 900, minHeight: 600,
    backgroundColor: '#0c0b0a',
    title: 'Nivela',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false },
  });
  win.loadFile(path.join(__dirname, '..', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', e => e.preventDefault());
}

app.whenReady().then(() => {
  // o app usa a File System Access API (escolher pasta e lembrar dela); o Electron pede autorização por aqui
  const allowed = new Set(['fileSystem', 'media', 'clipboard-read', 'clipboard-sanitized-write']);
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => cb(allowed.has(permission)));
  session.defaultSession.setPermissionCheckHandler((wc, permission) => allowed.has(permission));
  Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => app.quit());
