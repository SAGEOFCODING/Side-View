"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Monitor, AppWindow, X, Loader2 } from "lucide-react";

interface ScreenSource {
  id: string;
  name: string;
  thumbnail: string;
}

interface ScreenSharePickerProps {
  isOpen: boolean;
  sources: ScreenSource[];
  onSelect: (sourceId: string | null) => void;
}

export function ScreenSharePicker({ isOpen, sources, onSelect }: ScreenSharePickerProps) {
  const [activeTab, setActiveTab] = useState<"screens" | "windows">("screens");

  // Reset tab when modal opens
  useEffect(() => {
    if (isOpen) {
      queueMicrotask(() => setActiveTab("screens"));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const screens = sources.filter((s) => s.id.startsWith("screen:"));
  const windows = sources.filter((s) => s.id.startsWith("window:"));
  const currentSources = activeTab === "screens" ? screens : windows;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => onSelect(null)}
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
        />

        {/* Modal Panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative z-10 w-full max-w-4xl max-h-[85vh] bg-[#0c0c0e]/95 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Share your screen</h2>
              <p className="text-xs text-zinc-400 mt-1">Select a screen or window to share with the room</p>
            </div>
            <button
              onClick={() => onSelect(null)}
              className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Selector */}
          <div className="px-6 py-3 border-b border-white/5 flex gap-4 bg-black/20">
            <button
              onClick={() => setActiveTab("screens")}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                activeTab === "screens"
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Monitor className="w-4 h-4" />
              Screens ({screens.length})
            </button>
            <button
              onClick={() => setActiveTab("windows")}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                activeTab === "windows"
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <AppWindow className="w-4 h-4" />
              Windows ({windows.length})
            </button>
          </div>

          {/* Sources List Grid */}
          <div className="flex-1 overflow-y-auto p-6 min-h-0 bg-black/40">
            {currentSources.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center text-zinc-500">
                <Loader2 className="w-10 h-10 animate-spin text-zinc-600 mb-4" />
                <p>Loading shareable sources...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {currentSources.map((source) => (
                  <motion.button
                    key={source.id}
                    onClick={() => onSelect(source.id)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex flex-col text-left rounded-2xl border border-white/5 hover:border-purple-500/50 bg-[#16161a]/60 hover:bg-[#1a1a20]/80 overflow-hidden group shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {/* Thumbnail Image Container */}
                    <div className="relative aspect-video w-full bg-black flex items-center justify-center border-b border-white/5 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={source.thumbnail}
                        alt={source.name}
                        className="w-full h-full object-contain group-hover:scale-[1.03] transition-transform duration-300"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    </div>

                    {/* Meta info */}
                    <div className="p-3 w-full">
                      <p className="text-sm font-semibold text-zinc-200 group-hover:text-white truncate">
                        {source.name || "Untitled Share"}
                      </p>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-black/40 border-t border-white/5 flex justify-end gap-3">
            <button
              onClick={() => onSelect(null)}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
