/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, ipcMain, desktopCapturer, session } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

// Keep hardware acceleration enabled for smooth GPU rendering and zero UI/WebRTC lag.
// Users should disable hardware acceleration inside Chrome/Edge if they need to bypass DRM black screens.

let mainWindow = null;
let nextServerProcess = null;
global.pendingScreenShareCallback = null;

function checkServerReady(port, callback) {
  const req = http.get(`http://localhost:${port}/`, () => {
    callback(true);
  });
  req.on('error', () => {
    callback(false);
  });
  req.end();
}

function pollServer(port, callback) {
  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    checkServerReady(port, (ready) => {
      if (ready) {
        clearInterval(interval);
        callback(true);
      } else if (attempts > 30) { // 30 seconds timeout
        clearInterval(interval);
        callback(false);
      }
    });
  }, 1000);
}

function startNextServer() {
  return new Promise((resolve, reject) => {
    const isDev = !app.isPackaged;
    if (isDev) {
      console.log('[Electron] Running in development mode. Assuming Next.js is managed externally.');
      resolve(3000);
      return;
    }

    const port = 3000;
    console.log(`[Electron] Starting Next.js production server on port ${port}...`);

    // In a packaged app, cwd will be app's resources or root directory.
    // We run next start using the next binary in node_modules.
    const nextBin = path.join(__dirname, 'node_modules', 'next', 'dist', 'bin', 'next');
    nextServerProcess = spawn('node', [nextBin, 'start', '-p', port.toString()], {
      cwd: __dirname,
      shell: true,
      env: { ...process.env, NODE_ENV: 'production' }
    });

    nextServerProcess.stdout.on('data', (data) => {
      console.log(`[Next.js Server] ${data}`);
    });

    nextServerProcess.stderr.on('data', (data) => {
      console.error(`[Next.js Server Error] ${data}`);
    });

    pollServer(port, (success) => {
      if (success) {
        console.log('[Electron] Next.js server is ready.');
        resolve(port);
      } else {
        reject(new Error('Timed out waiting for Next.js server to start.'));
      }
    });
  });
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    title: 'SideView | Watch Together',
    frame: false, // Make window frameless for custom TitleBar
    webPreferences: {
      preload: path.join(__dirname, 'electron-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Track window maximization state events
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-maximized-state', true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-maximized-state', false);
  });

  // Load the Next.js app
  mainWindow.loadURL(`http://localhost:${port}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Set display media request handler for custom screen sharing
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ 
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 } 
    }).then((sources) => {
      const serializedSources = sources.map(source => ({
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.toDataURL()
      }));

      // Send sources to the renderer process
      if (mainWindow) {
        mainWindow.webContents.send('show-screen-picker', serializedSources);
      }

      // Store the callback and sources globally to resolve when the user selects a source
      global.activeScreenShareSources = sources;
      global.pendingScreenShareCallback = callback;
    }).catch((err) => {
      console.error('[Electron] Error fetching screen capture sources:', err);
      callback({ video: null });
    });
  });
}

app.whenReady().then(() => {
  startNextServer()
    .then((port) => {
      createWindow(port);
    })
    .catch((err) => {
      console.error('[Electron] Failed to start Next.js server:', err);
      app.quit();
    });
});

app.on('window-all-closed', () => {
  // Kill Next.js server process if running
  if (nextServerProcess) {
    nextServerProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow(3000);
  }
});

// IPC Handler to resolve the screen sharing request when the user picks a source
ipcMain.handle('screen-source-selected', async (event, sourceId) => {
  if (global.pendingScreenShareCallback) {
    if (sourceId && global.activeScreenShareSources) {
      const selectedSource = global.activeScreenShareSources.find(s => s.id === sourceId);
      if (selectedSource) {
        global.pendingScreenShareCallback({ video: selectedSource, audio: 'loopback' });
      } else {
        console.warn(`[Electron] Selected source ID ${sourceId} not found in cached sources.`);
        global.pendingScreenShareCallback({ video: null });
      }
    } else {
      // User cancelled or no sources cached
      global.pendingScreenShareCallback({ video: null });
    }
    global.pendingScreenShareCallback = null;
    global.activeScreenShareSources = null;
  }
});

// IPC Handlers for custom TitleBar window controls
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) mainWindow.maximize();
});

ipcMain.on('window-unmaximize', () => {
  if (mainWindow) mainWindow.unmaximize();
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.on('window-toggle-pin', () => {
  if (mainWindow) {
    const isPinned = !mainWindow.isAlwaysOnTop();
    mainWindow.setAlwaysOnTop(isPinned);
    mainWindow.webContents.send('window-pinned-state', isPinned);
  }
});

ipcMain.handle('window-get-state', () => {
  if (mainWindow) {
    return {
      isMaximized: mainWindow.isMaximized(),
      isAlwaysOnTop: mainWindow.isAlwaysOnTop()
    };
  }
  return { isMaximized: false, isAlwaysOnTop: false };
});
