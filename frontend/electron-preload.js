/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require('electron');

// Expose Screen Share Picker APIs
contextBridge.exposeInMainWorld('electronAPI', {
  // Listen for the main process telling us to show the screen sharing picker
  onShowScreenPicker: (callback) => {
    ipcRenderer.on('show-screen-picker', (event, sources) => callback(sources));
  },
  // Send the selected source ID (or null if cancelled) back to the main process
  selectScreenSource: (sourceId) => {
    ipcRenderer.invoke('screen-source-selected', sourceId);
  }
});

// Expose Custom TitleBar APIs for window control and pinning
contextBridge.exposeInMainWorld('electron', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  unmaximize: () => ipcRenderer.send('window-unmaximize'),
  close: () => ipcRenderer.send('window-close'),
  toggleAlwaysOnTop: () => ipcRenderer.send('window-toggle-pin'),
  getWindowState: () => ipcRenderer.invoke('window-get-state'),
  onMaximized: (callback) => {
    const handler = (event, isMaximized) => callback(isMaximized);
    ipcRenderer.on('window-maximized-state', handler);
    return () => ipcRenderer.removeListener('window-maximized-state', handler);
  },
  onAlwaysOnTopChanged: (callback) => {
    const handler = (event, isPinned) => callback(isPinned);
    ipcRenderer.on('window-pinned-state', handler);
    return () => ipcRenderer.removeListener('window-pinned-state', handler);
  }
});
