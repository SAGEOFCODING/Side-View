import React, { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';

interface VideoPlayerProps {
  stream: MediaStream | null;
  muted?: boolean;
  className?: string;
}

export const VideoPlayer = React.memo(React.forwardRef<HTMLVideoElement, VideoPlayerProps>(function VideoPlayer({ stream, muted = false, className }, forwardedRef) {
  const internalRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Expose the internal video element to the parent (for PiP)
  React.useImperativeHandle(forwardedRef, () => internalRef.current as HTMLVideoElement);

  const videoRef = internalRef;
  const [playBlocked, setPlayBlocked] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !audio) return;

    if (stream) {
      // Only reassign srcObject if the stream actually changed
      if (video.srcObject !== stream) video.srcObject = stream;
      if (audio.srcObject !== stream) audio.srcObject = stream;
      
      const playPromise = video.play();
      const audioPlayPromise = audio.play();

      if (playPromise !== undefined) {
        playPromise.then(() => {
          setPlayBlocked(false);
        }).catch(e => {
          if (e.name === 'NotAllowedError') {
            setPlayBlocked(true);
          } else if (e.name !== 'AbortError') {
            console.error('Auto-play failed:', e);
          }
        });
      }

      // Audio might fail independently due to Auto-Play policy! We MUST block the UI so the user can click to play.
      if (audioPlayPromise !== undefined) {
        audioPlayPromise.catch(e => {
           if (e.name === 'NotAllowedError') {
             setPlayBlocked(true);
           } else if (e.name !== 'AbortError') {
             console.error('Audio auto-play failed:', e);
           }
        });
      }
    } else {
      // Stream is null — clear elements
      video.srcObject = null;
      audio.srcObject = null;
      setPlayBlocked(false);
    }
    
    return () => {
      // Clean up properly on stream change
      if (video.srcObject === stream) video.srcObject = null;
      if (audio.srcObject === stream) audio.srcObject = null;
    };
  }, [stream]);

  // Explicitly force the audio element muted state to sync with the React prop.
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = muted;
      if (!muted) {
        audioRef.current.volume = 1.0;
      }
    }
  }, [muted]);

  const handleManualPlay = () => {
    if (videoRef.current && audioRef.current) {
      videoRef.current.play().catch(() => {});
      audioRef.current.play().catch(() => {});
      setPlayBlocked(false);
    }
  };

  return (
    <div className={className || ''}>
      <video
        ref={videoRef}
        muted={true}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      <audio 
        ref={audioRef}
        muted={muted}
        autoPlay
        playsInline
        className="hidden"
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
}));
