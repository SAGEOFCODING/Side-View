import React, { useEffect, useRef, useState, useCallback } from 'react';
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

  // Master function to attempt playing both elements
  const attemptPlay = useCallback(() => {
    const video = videoRef.current;
    const audio = audioRef.current;

    if (video && video.srcObject) {
      video.play().catch(e => {
        if (e.name === 'NotAllowedError') setPlayBlocked(true);
      });
    }

    if (audio && audio.srcObject && !muted) {
      // Force unmute imperatively right before playing
      audio.muted = false;
      audio.volume = 1.0;
      audio.play().catch(e => {
        if (e.name === 'NotAllowedError') setPlayBlocked(true);
      });
    }
  }, [muted]);

  // Assign stream to both elements
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !audio) return;

    if (stream) {
      if (video.srcObject !== stream) video.srcObject = stream;
      if (audio.srcObject !== stream) audio.srcObject = stream;
      
      // Imperatively set the audio muted state BEFORE playing.
      // React's muted JSX attribute is unreliable for <audio> and <video>.
      audio.muted = muted;
      if (!muted) audio.volume = 1.0;

      attemptPlay();

      // Also listen for new tracks being added to the stream (e.g. audio arriving late).
      const onTrackAdded = () => {
        console.log('[VideoPlayer] New track added to stream, re-attempting play');
        attemptPlay();
      };
      stream.addEventListener('addtrack', onTrackAdded);

      return () => {
        stream.removeEventListener('addtrack', onTrackAdded);
      };
    } else {
      video.srcObject = null;
      audio.srcObject = null;
      setPlayBlocked(false);
    }
  }, [stream, muted, attemptPlay]);

  // Force muted state imperatively whenever the prop changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    audio.muted = muted;
    if (!muted) {
      audio.volume = 1.0;
      // If we're unmuting, try to play in case it was blocked before
      if (audio.srcObject) {
        audio.play().catch(() => {});
      }
    }
  }, [muted]);

  const handleManualPlay = useCallback(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (video) video.play().catch(() => {});
    if (audio) {
      audio.muted = muted;
      if (!muted) audio.volume = 1.0;
      audio.play().catch(() => {});
    }
    setPlayBlocked(false);
  }, [muted]);

  return (
    <div className={className || ''}>
      {/* Video element is ALWAYS muted — it only renders visual frames */}
      <video
        ref={videoRef}
        muted
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      {/* Invisible audio element handles all audio playback independently */}
      {/* We do NOT set muted as a JSX attribute — we control it imperatively via useEffect */}
      <audio 
        ref={audioRef}
        autoPlay
        playsInline
        style={{ display: 'none' }}
      />
      {playBlocked && (
        <div 
          onClick={handleManualPlay}
          className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm cursor-pointer hover:bg-black/40 transition-colors z-50"
        >
          <div className="flex flex-col items-center gap-2">
            <div className="p-4 rounded-full bg-purple-500/80 text-white animate-pulse">
              <Play className="w-8 h-8 ml-1" />
            </div>
            <span className="text-white text-xs font-medium">Tap to unmute</span>
          </div>
        </div>
      )}
    </div>
  );
}));
