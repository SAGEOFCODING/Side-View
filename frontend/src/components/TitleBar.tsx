"use client";

import { useEffect, useState } from "react";
import { Minus, Square, Copy, X, Pin, PinOff } from "lucide-react";

export function TitleBar() {
  const [isElectron, setIsElectron] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.electron) {
      queueMicrotask(() => setIsElectron(true));
      document.body.classList.add("is-electron");

      // Get initial states from main process
      window.electron.getWindowState().then((state) => {
        setIsMaximized(state.isMaximized);
        setIsPinned(state.isAlwaysOnTop);
      });

      // Synchronize state via callbacks returning unsubscribe functions
      const unsubMaximized = window.electron.onMaximized((max) => {
        setIsMaximized(max);
      });

      const unsubAlwaysOnTop = window.electron.onAlwaysOnTopChanged((pin) => {
        setIsPinned(pin);
      });

      return () => {
        unsubMaximized();
        unsubAlwaysOnTop();
        document.body.classList.remove("is-electron");
      };
    }
  }, []);

  if (!isElectron) return null;

  const handleMinimize = () => window.electron?.minimize();
  
  const handleMaximizeToggle = () => {
    if (isMaximized) {
      window.electron?.unmaximize();
    } else {
      window.electron?.maximize();
    }
  };

  const handleClose = () => window.electron?.close();
  const handlePinToggle = () => window.electron?.toggleAlwaysOnTop();

  return (
    <header 
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      className="w-full h-10 bg-[#09090b]/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 fixed top-0 left-0 right-0 z-50 select-none"
    >
      {/* Brand Label */}
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 animate-pulse" />
        <span className="text-xs font-bold tracking-wider text-zinc-400 font-sans uppercase">
          SideView
        </span>
        {isPinned && (
          <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded-full font-medium">
            Pinned
          </span>
        )}
      </div>

      {/* Control Buttons */}
      <div 
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        className="flex items-center gap-1"
      >
        {/* Toggle Pin / Always on Top */}
        <button
          onClick={handlePinToggle}
          title={isPinned ? "Unpin Window" : "Pin Window (Always on Top)"}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
            isPinned 
              ? "bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 border border-purple-500/20" 
              : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
          }`}
        >
          {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
        </button>

        {/* Minimize */}
        <button
          onClick={handleMinimize}
          title="Minimize"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:bg-white/5 hover:text-zinc-300 transition-all"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        {/* Maximize / Restore */}
        <button
          onClick={handleMaximizeToggle}
          title={isMaximized ? "Restore Down" : "Maximize"}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:bg-white/5 hover:text-zinc-300 transition-all"
        >
          {isMaximized ? <Copy className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
        </button>

        {/* Close */}
        <button
          onClick={handleClose}
          title="Close"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:bg-red-500/20 hover:text-red-400 transition-all"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
}
