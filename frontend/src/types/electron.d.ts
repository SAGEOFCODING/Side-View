interface Window {
  electron?: {
    minimize: () => void;
    maximize: () => void;
    unmaximize: () => void;
    close: () => void;
    toggleAlwaysOnTop: () => Promise<boolean>;
    getWindowState: () => Promise<{ isMaximized: boolean; isAlwaysOnTop: boolean }>;
    onMaximized: (callback: (isMaximized: boolean) => void) => () => void;
    onAlwaysOnTopChanged: (callback: (isAlwaysOnTop: boolean) => void) => () => void;
  };
}
