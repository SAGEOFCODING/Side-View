const { app, BrowserWindow } = require('electron');
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
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    }
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

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
