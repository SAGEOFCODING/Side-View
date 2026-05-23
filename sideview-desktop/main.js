const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Allowed origin for the loaded page
const ALLOWED_URL = process.env.SIDEVIEW_URL || 'https://sideview-frontend-252675432928.us-central1.run.app';
const ALLOWED_HOST = new URL(ALLOWED_URL).hostname;

// Only allow media-related permissions
const ALLOWED_PERMISSIONS = ['media', 'display-capture', 'screen'];

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    title: "SideView",
    icon: path.join(__dirname, 'icon.png'),
    frame: false, // frameless window
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    }
  });

  // Notify frontend when window maximize state changes natively
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-maximized', true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-maximized', false);
  });

  // Load the NextJS frontend URL
  mainWindow.loadURL(ALLOWED_URL);

  // Restrict permission requests to media-related only
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (ALLOWED_PERMISSIONS.includes(permission)) {
      callback(true);
    } else {
      callback(false);
    }
  });

  // Only grant media permission checks — not all permissions
  mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    // Only allow checks from our own origin, and only for media permissions
    try {
      const originHost = new URL(requestingOrigin).hostname;
      if (originHost === ALLOWED_HOST && ALLOWED_PERMISSIONS.includes(permission)) {
        return true;
      }
    } catch {
      // Invalid URL — deny
    }
    return false;
  });

  // Prevent navigation to external sites
  mainWindow.webContents.on('will-navigate', (event, url) => {
    try {
      const navHost = new URL(url).hostname;
      if (navHost !== ALLOWED_HOST) {
        event.preventDefault();
      }
    } catch {
      event.preventDefault();
    }
  });
}

// Register IPC handlers globally
ipcMain.on('window-control', (event, action) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  switch (action) {
    case 'minimize':
      win.minimize();
      break;
    case 'maximize':
      win.maximize();
      break;
    case 'unmaximize':
      win.unmaximize();
      break;
    case 'close':
      win.close();
      break;
  }
});

ipcMain.handle('window-control-toggle-always-on-top', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return false;
  const nextState = !win.isAlwaysOnTop();
  win.setAlwaysOnTop(nextState, 'screen-saver');
  event.sender.send('window-always-on-top-changed', nextState);
  return nextState;
});

ipcMain.handle('get-window-state', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { isMaximized: false, isAlwaysOnTop: false };
  return {
    isMaximized: win.isMaximized(),
    isAlwaysOnTop: win.isAlwaysOnTop(),
  };
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
