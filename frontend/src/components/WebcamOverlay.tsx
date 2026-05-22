"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { VideoPlayer } from './VideoPlayer';
import { User, MicOff, ExternalLink } from 'lucide-react';

interface WebcamOverlayProps {
  stream: MediaStream | null;
  muted?: boolean;
  isLocal?: boolean;
  name: string;
  isMicMuted?: boolean;
  isCameraOff?: boolean;
  iceStatus?: string;
  index?: number;
}

export const WebcamOverlay = React.memo(function WebcamOverlay({ stream, muted, isLocal, name, isMicMuted, isCameraOff, iceStatus, index = 0 }: WebcamOverlayProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const handlePiP = (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent drag
    if (videoRef.current && document.pictureInPictureEnabled) {
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(console.error);
      } else {
        videoRef.current.requestPictureInPicture().catch(console.error);
      }
    }
  };
  return (
    <motion.div
      drag
      dragMomentum={false}
      initial={{ y: index * 200, scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className="absolute top-4 right-4 z-50 cursor-move group pointer-events-auto"
    >
      <div 
        className="relative w-32 h-48 rounded-2xl overflow-hidden glass-panel shadow-2xl transition-shadow resize"
        style={{ minWidth: '120px', minHeight: '160px', maxWidth: '80vw', maxHeight: '80vh' }}
      >
        {stream && !isCameraOff ? (
          <VideoPlayer 
            ref={videoRef}
            stream={stream} 
            muted={isLocal || muted} 
            className="relative w-full h-full pointer-events-none"
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

        {/* Hover Controls */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={handlePiP}
            title="Picture-in-Picture"
            className="p-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-md text-white transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>

        {/* Firewall Blocked Overlay */}
        {(iceStatus === 'failed' || iceStatus === 'disconnected') && !isLocal && (
          <div className="absolute inset-0 bg-red-950/90 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-4 text-center border border-red-500/50 rounded-2xl">
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1">Firewall Blocked</span>
            <span className="text-[9px] text-zinc-300 leading-tight">TURN Server Required</span>
          </div>
        )}
        
        {/* Name badge + mic indicator */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
          <div className="px-2 py-1 bg-black/60 backdrop-blur-md rounded-md text-xs font-medium text-white truncate max-w-[70%]">
            {name}
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
