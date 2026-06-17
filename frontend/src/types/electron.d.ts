interface Window {
  electron?: {
    minimize: () => void;
    maximize: () => void;
    unmaximize: () => void;
    close: () => void;
    toggleAlwaysOnTop: () => void;
    getWindowState: () => Promise<{ isMaximized: boolean; isAlwaysOnTop: boolean }>;
    onMaximized: (callback: (isMaximized: boolean) => void) => () => void;
    onAlwaysOnTopChanged: (callback: (isAlwaysOnTop: boolean) => void) => () => void;
  };
  electronAPI?: {
    onShowScreenPicker: (callback: (sources: any[]) => void) => void;
    selectScreenSource: (sourceId: string | null) => void;
  };
}
