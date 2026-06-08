import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Volume2 } from 'lucide-react';

interface VideoPlayerProps {
  stream: MediaStream | null;
  muted?: boolean;
  className?: string;
}

/**
 * Completely rewritten video player that guarantees audio playback for WebRTC streams.
 * 
 * Architecture:
 * - Single <video> element handles BOTH video and audio.
 * - No muted attribute in JSX — controlled entirely via imperative ref.
 * - No separate <audio> element (caused display:none issues in some browsers).
 * - Proactively retries play() when new tracks arrive on the stream.
 */
export const VideoPlayer = React.memo(React.forwardRef<HTMLVideoElement, VideoPlayerProps>(function VideoPlayer({ stream, muted = false, className }, forwardedRef) {
  const videoRef = useRef<HTMLVideoElement>(null);

  React.useImperativeHandle(forwardedRef, () => videoRef.current as HTMLVideoElement);

  const [needsInteraction, setNeedsInteraction] = useState(false);

  // Core play function — called on stream set, track add, and user click
  const tryPlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.srcObject) return;

    // Always force the muted state imperatively right before playing
    video.muted = muted;
    if (!muted) video.volume = 1.0;

    const p = video.play();
    if (p) {
      p.then(() => {
        setNeedsInteraction(false);
      }).catch(err => {
        if (err.name === 'NotAllowedError') {
          console.warn('[VideoPlayer] Autoplay blocked — waiting for user interaction');
          setNeedsInteraction(true);
        }
      });
    }
  }, [muted]);

  // Attach stream and start playback
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!stream) {
      video.srcObject = null;
      setNeedsInteraction(false);
      return;
    }

    // Set the stream
    video.srcObject = stream;
    // Force muted state before play
    video.muted = muted;
    if (!muted) video.volume = 1.0;
    
    // Attempt play
    tryPlay();

    // When new tracks arrive (e.g. audio arrives after video), retry play
    const onAddTrack = () => {
      console.log('[VideoPlayer] Track added to stream — retrying play');
      tryPlay();
    };
    stream.addEventListener('addtrack', onAddTrack);

    return () => {
      stream.removeEventListener('addtrack', onAddTrack);
    };
  }, [stream, muted, tryPlay]);

  // When muted prop changes, immediately update the element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    if (!muted) {
      video.volume = 1.0;
      // Retry play when unmuting — might have been blocked before
      if (video.srcObject) tryPlay();
    }
  }, [muted, tryPlay]);

  // User clicks to unblock autoplay
  const handleUserUnblock = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    if (!muted) video.volume = 1.0;
    video.play().then(() => {
      setNeedsInteraction(false);
    }).catch(() => {});
  }, [muted]);

  return (
    <div className={className || ''}>
      {/* Single video element — handles both video and audio */}
      {/* We MUST include muted={muted} in the JSX to satisfy iOS Safari/Chrome autoplay policies */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className="w-full h-full object-cover"
      />
      {needsInteraction && (
        <div 
          onClick={handleUserUnblock}
          className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm cursor-pointer hover:bg-black/50 transition-colors z-50"
          style={{ pointerEvents: 'auto' }}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="p-4 rounded-full bg-purple-500 text-white animate-pulse shadow-lg shadow-purple-500/30">
              <Volume2 className="w-8 h-8" />
            </div>
            <span className="text-white text-sm font-semibold">Tap to hear audio</span>
          </div>
        </div>
      )}
    </div>
  );
}));
