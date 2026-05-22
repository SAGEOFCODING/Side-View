"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { VideoPlayer } from './VideoPlayer';
import { User, MicOff } from 'lucide-react';

interface WebcamOverlayProps {
  stream: MediaStream | null;
  muted?: boolean;
  isLocal?: boolean;
  name: string;
  isMicMuted?: boolean;
  isCameraOff?: boolean;
}

export const WebcamOverlay = React.memo(function WebcamOverlay({ stream, muted, isLocal, name, isMicMuted, isCameraOff }: WebcamOverlayProps) {
  return (
    <motion.div
      drag
      dragMomentum={false}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className="z-50 cursor-move group relative"
    >
      <div className="relative w-24 h-36 md:w-32 md:h-48 rounded-2xl overflow-hidden glass-panel shadow-2xl transition-transform hover:scale-[1.02] active:scale-95">
        {stream && !isCameraOff ? (
          <VideoPlayer 
            stream={stream} 
            muted={isLocal || muted} 
            className="relative w-full h-full"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-md gap-3 border border-white/5">
            <div className="w-12 h-12 rounded-full bg-zinc-900/60 flex items-center justify-center border border-white/10 shadow-inner">
              <User className="w-6 h-6 text-zinc-500" />
            </div>
            <span className="text-[10px] text-zinc-500 font-semibold tracking-wider uppercase">Camera Off</span>
          </div>
        )}
        
        {/* Ring overlay */}
        <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-2xl pointer-events-none" />
        
        {/* Name badge + mic indicator */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
          <div className="px-2 py-1 bg-black/60 backdrop-blur-md rounded-md text-xs font-medium text-white truncate max-w-[70%]">
            {isLocal ? "You" : name}
          </div>
          {isMicMuted && (
            <div className="w-6 h-6 bg-red-500/80 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg border border-red-500/20">
              <MicOff className="w-3 h-3 text-white" />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
});
