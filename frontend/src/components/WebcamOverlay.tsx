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
}

export const WebcamOverlay = React.memo(function WebcamOverlay({ stream, muted, isLocal, name, isMicMuted }: WebcamOverlayProps) {
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
        {stream ? (
          <VideoPlayer 
            stream={stream} 
            muted={isLocal || muted} 
            className="relative w-full h-full"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 gap-2">
            <User className="w-10 h-10 text-zinc-600" />
            <span className="text-[10px] text-zinc-600 font-medium">Camera Off</span>
          </div>
        )}
        
        {/* Ring overlay */}
        <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-2xl pointer-events-none" />
        
        {/* Name badge + mic indicator */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
          <div className="px-2 py-1 bg-black/60 backdrop-blur-md rounded-md text-xs font-medium text-white truncate">
            {isLocal ? "You" : name}
          </div>
          {isMicMuted && (
            <div className="w-6 h-6 bg-red-500/80 backdrop-blur-md rounded-full flex items-center justify-center">
              <MicOff className="w-3 h-3 text-white" />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
});
