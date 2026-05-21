"use client";

import { motion } from 'framer-motion';
import { VideoPlayer } from './VideoPlayer';
import { User } from 'lucide-react';

interface WebcamOverlayProps {
  stream: MediaStream | null;
  muted?: boolean;
  isLocal?: boolean;
  name: string;
}

export function WebcamOverlay({ stream, muted, isLocal, name }: WebcamOverlayProps) {
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
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-zinc-900">
            <User className="w-10 h-10 text-zinc-600" />
          </div>
        )}
        
        {/* Overlays */}
        <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-2xl pointer-events-none" />
        
        <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded-md text-xs font-medium text-white flex items-center gap-2">
          {isLocal ? "You" : name}
        </div>
      </div>
    </motion.div>
  );
}
