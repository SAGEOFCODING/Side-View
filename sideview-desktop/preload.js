const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  minimize: () => ipcRenderer.send('window-control', 'minimize'),
  maximize: () => ipcRenderer.send('window-control', 'maximize'),
  unmaximize: () => ipcRenderer.send('window-control', 'unmaximize'),
  close: () => ipcRenderer.send('window-control', 'close'),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('window-control-toggle-always-on-top'),
  getWindowState: () => ipcRenderer.invoke('get-window-state'),
  onMaximized: (callback) => {
    const listener = (_, val) => callback(val);
    ipcRenderer.on('window-maximized', listener);
    return () => ipcRenderer.removeListener('window-maximized', listener);
  },
  onAlwaysOnTopChanged: (callback) => {
    const listener = (_, val) => callback(val);
    ipcRenderer.on('window-always-on-top-changed', listener);
    return () => ipcRenderer.removeListener('window-always-on-top-changed', listener);
  }
});
