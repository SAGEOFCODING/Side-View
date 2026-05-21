import React, { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';

interface VideoPlayerProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  stream: MediaStream | null;
  muted?: boolean;
}

export function VideoPlayer({ stream, muted = false, ...props }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playBlocked, setPlayBlocked] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (stream) {
      // Only reassign srcObject if the stream actually changed
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }
      
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          setPlayBlocked(false);
        }).catch(e => {
          if (e.name === 'NotAllowedError') {
            setPlayBlocked(true);
          } else if (e.name !== 'AbortError') {
            console.error('Auto-play failed:', e);
          }
          // AbortError is expected when component re-renders and interrupts play — ignore it
        });
      }
    } else {
      // Stream is null — clear the video element so it doesn't show a frozen frame
      video.srcObject = null;
      setPlayBlocked(false);
    }
  }, [stream]);

  const handleManualPlay = () => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {
        // Ignore errors from manual play attempt
      });
      setPlayBlocked(false);
    }
  };

  return (
    <div className={`relative ${props.className || ''}`}>
      <video
        ref={videoRef}
        muted={muted}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
        {...props}
      />
      {playBlocked && (
        <div 
          onClick={handleManualPlay}
          className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm cursor-pointer hover:bg-black/40 transition-colors z-50"
        >
          <div className="p-4 rounded-full bg-purple-500/80 text-white animate-pulse">
            <Play className="w-8 h-8 ml-1" />
          </div>
        </div>
      )}
    </div>
  );
}
