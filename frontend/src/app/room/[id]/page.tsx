"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useStore } from "@/store/useStore";
import { WebcamOverlay } from "@/components/WebcamOverlay";
import { VideoPlayer } from "@/components/VideoPlayer";
import { ScreenSharePicker } from "@/components/ScreenSharePicker";
import { 
  Mic, MicOff, Video, VideoOff, MonitorUp, StopCircle, 
  Link, Check, LogIn, LogOut, Users, Wifi, WifiOff, Loader2, Eye, EyeOff 
} from "lucide-react";

// Connection status indicator — extracted to module level for React Compiler
type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';

const STATUS_CONFIG = {
  idle: { color: 'bg-zinc-500', text: 'Idle', Icon: WifiOff },
  connecting: { color: 'bg-yellow-500 status-pulse', text: 'Connecting...', Icon: Loader2 },
  connected: { color: 'bg-emerald-500', text: 'Connected', Icon: Wifi },
  reconnecting: { color: 'bg-yellow-500 status-pulse', text: 'Reconnecting...', Icon: Loader2 },
  error: { color: 'bg-red-500', text: 'Connection Error', Icon: WifiOff },
} as const;

function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.Icon;
  
  return (
    <div className="flex items-center gap-2 text-xs text-zinc-400">
      <div className={`w-2 h-2 rounded-full ${config.color}`} />
      <Icon className="w-3 h-3" />
      <span>{config.text}</span>
    </div>
  );
}

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;
  
  const [hasJoined, setHasJoined] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const { startScreenShare, stopScreenShare, getMedia, toggleMic, toggleVideo } = useWebRTC(roomId, hasJoined);
  const { localUser, remoteUsers, connectionStatus, setRoomId, resetStore, setLocalName, hostCinemaMode, cinemaOverrideOff, setCinemaOverrideOff } = useStore();
  
  const [copied, setCopied] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [isControlsHidden, setIsControlsHidden] = useState(false);
  
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSources, setPickerSources] = useState<Array<{ id: string, name: string, thumbnail: string }>>([]);

  // Listen for Electron screen picker events
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.onShowScreenPicker((sources: Array<{ id: string, name: string, thumbnail: string }>) => {
        setPickerSources(sources);
        setPickerOpen(true);
      });
    }
  }, []);

  const handleSelectScreenSource = (sourceId: string | null) => {
    setPickerOpen(false);
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.selectScreenSource(sourceId);
    }
  };

  // Set room ID on mount
  useEffect(() => {
    setRoomId(roomId);
  }, [roomId, setRoomId]);

  // YouTube-style auto-hide controls in cinema mode
  useEffect(() => {
    if (!hostCinemaMode || cinemaOverrideOff) {
      queueMicrotask(() => setIsControlsVisible(true));
      return;
    }
    
    queueMicrotask(() => setIsControlsVisible(true));
    let timeout: ReturnType<typeof setTimeout>;
    
    const handleMouseMove = () => {
      setIsControlsVisible(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setIsControlsVisible(false), 3000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    timeout = setTimeout(() => setIsControlsVisible(false), 3000);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timeout);
    };
  }, [hostCinemaMode, cinemaOverrideOff]);

  // Load saved display name from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedName = localStorage.getItem('sideview-display-name');
      if (savedName) {
        setLocalName(savedName);
      }
    }
  }, [setLocalName]);

  // Hardware and State Cleanup on Unmount
  useEffect(() => {
    return () => {
      const state = useStore.getState();
      if (state.localUser.stream) {
        state.localUser.stream.getTracks().forEach(track => track.stop());
      }
      if (state.localUser.screenStream) {
        state.localUser.screenStream.getTracks().forEach(track => track.stop());
      }
      state.resetStore();
    };
  }, []);

  const handleLeaveRoom = () => {
    if (localUser.stream) {
      localUser.stream.getTracks().forEach(track => track.stop());
    }
    if (localUser.screenStream) {
      localUser.screenStream.getTracks().forEach(track => track.stop());
    }
    resetStore();
    router.push('/');
  };



  // Keyboard shortcuts
  useEffect(() => {
    if (!hasJoined) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      switch (e.key.toLowerCase()) {
        case 'm':
          toggleMic();
          break;
        case 'v':
          toggleVideo();
          break;
        case 'h':
          setIsControlsHidden(prev => !prev);
          break;
        case 'escape':
          handleLeaveRoom();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const handleJoin = async () => {
    setIsStarting(true);
    setPermissionError(null);
    
    // CRITICAL: Unlock browser audio engine during this user gesture.
    // Chrome blocks unmuted audio playback until a user gesture has "touched" the audio system.
    // By creating and playing a silent AudioContext here (during the click), we permanently
    // unlock audio for all future WebRTC streams that arrive seconds/minutes later.
    try {
      const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx!();
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      if (ctx.state === 'suspended') await ctx.resume();
      console.log('[Audio] Browser audio engine unlocked via silent AudioContext');
    } catch (e) {
      console.warn('[Audio] Could not unlock audio context:', e);
    }

    try {
      const { stream, error } = await getMedia();
      if (!stream) {
        setPermissionError(`Camera access denied/unavailable: ${error}. Joining without camera.`);
      }
      setHasJoined(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(err);
      setPermissionError(`An error occurred: ${message}`);
      setHasJoined(true);
    } finally {
      setIsStarting(false);
    }
  };

  const copyLink = () => {
    let url = window.location.href;
    // Convert local URL to public room URL so friends can join from their web browsers
    if (url.includes("localhost:3000") || url.includes("127.0.0.1:3000")) {
      const publicUrl = process.env.NEXT_PUBLIC_PUBLIC_URL || "https://sageofcode.me";
      url = url.replace(/http:\/\/(localhost|127\.0\.0\.1):3000/, publicUrl);
    }
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const participantCount = 1 + Object.keys(remoteUsers).length;
  const isCinemaActive = hostCinemaMode && !cinemaOverrideOff;

  // Pre-join screen
  if (!hasJoined) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen bg-[#050505] p-6 relative overflow-hidden">
        <div className="absolute top-1/4 -left-1/4 w-[50vw] h-[50vw] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 -right-1/4 w-[50vw] h-[50vw] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-md glass-panel p-8 rounded-3xl text-center shadow-2xl border border-white/10"
        >
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-lg shadow-purple-500/20">
            <Video className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Ready to join?</h1>
          <p className="text-gray-400 mb-8 font-medium">Room ID: {roomId}</p>
          
          <div className="mb-6">
            <input 
              type="text" 
              placeholder="Enter your display name..." 
              value={localUser.name || ''}
              onChange={(e) => setLocalName(e.target.value)}
              className="w-full bg-zinc-900/80 border border-white/10 rounded-xl px-4 py-3 text-white text-center font-medium placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all shadow-inner"
              maxLength={20}
              onKeyDown={(e) => {
                 if (e.key === 'Enter' && !isStarting) handleJoin();
              }}
            />
          </div>

          <AnimatePresence>
            {permissionError && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 text-red-400 text-sm font-medium"
              >
                {permissionError}
              </motion.div>
            )}
          </AnimatePresence>

          <button
            id="join-room-btn"
            onClick={handleJoin}
            disabled={isStarting}
            className="w-full py-4 px-6 rounded-2xl bg-white text-black font-semibold text-lg flex items-center justify-center gap-3 hover:bg-gray-100 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isStarting ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <LogIn className="w-6 h-6" />
                Join Room
              </>
            )}
          </button>
        </motion.div>
      </main>
    );
  }

  // Active Screen Share Logic
  const activeScreenShare = localUser.screenStream || 
    Object.values(remoteUsers).find(u => u.screenStream)?.screenStream;

  return (
    <main className={`relative flex-1 bg-black w-full h-full overflow-hidden flex flex-col cinema-mode-transition ${isCinemaActive ? 'yt-fullscreen' : ''} ${isCinemaActive && !isControlsVisible ? 'yt-controls-hidden' : ''} ${isControlsHidden ? 'controls-hidden' : ''}`}>
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0 cinema-bg-blobs">
        <div className="absolute top-1/4 left-1/4 w-[40vw] h-[40vw] bg-purple-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[40vw] h-[40vw] bg-blue-600/10 rounded-full blur-[120px]" />
      </div>

      {/* Top Status Bar */}
      <div className="relative z-30 p-4 flex items-center justify-between cinema-status-bar">
        <div className="flex items-center gap-4">
          <div className="glass-panel px-4 py-2 rounded-full flex items-center gap-3 border border-white/10">
            <Users className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-medium text-zinc-300">{participantCount}</span>
          </div>
          <ConnectionBadge status={connectionStatus} />
        </div>
        <div className="glass-panel px-4 py-2 rounded-full border border-white/10">
          <span className="text-xs text-zinc-500 font-mono">Room: {roomId}</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 md:px-8 min-h-0">
        {activeScreenShare ? (
          <div className="w-full max-w-6xl aspect-video rounded-3xl overflow-hidden glass-panel shadow-2xl relative border border-white/5 bg-black/40 cinema-screen-container">
            <VideoPlayer 
              stream={activeScreenShare} 
              muted={!!localUser.screenStream}
              className="relative w-full h-full"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/20 pointer-events-none" />
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center text-center"
          >
            <div className="w-24 h-24 bg-white/5 rounded-3xl flex items-center justify-center mb-6 border border-white/10 shadow-xl">
              <MonitorUp className="w-10 h-10 text-white/40" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Theater is empty</h2>
            {participantCount === 1 ? (
              <div className="flex flex-col items-center gap-4">
                <p className="text-gray-400 max-w-md mx-auto text-lg">
                  You are the only one here! Copy the link below and send it to a friend so they can join this exact room.
                </p>
                <button
                  onClick={copyLink}
                  className="px-6 py-3 rounded-full bg-purple-600/20 text-purple-400 font-semibold border border-purple-500/30 hover:bg-purple-600/30 transition-all flex items-center gap-2 animate-pulse"
                >
                  <Link className="w-5 h-5" />
                  {copied ? "Link Copied!" : "Copy Room Link"}
                </button>
              </div>
            ) : (
              <p className="text-gray-400 max-w-md mx-auto text-lg">
                Waiting for someone to start a screen share. When they do, it will appear right here in cinematic mode.
              </p>
            )}
            <div className="mt-6 flex items-center gap-2 text-zinc-600 text-sm">
              <span className="hidden md:inline">Press</span>
              <kbd className="hidden md:inline-block px-2 py-1 bg-zinc-800 rounded text-xs font-mono border border-zinc-700">M</kbd>
              <span className="hidden md:inline">to mute ·</span>
              <kbd className="hidden md:inline-block px-2 py-1 bg-zinc-800 rounded text-xs font-mono border border-zinc-700">V</kbd>
              <span className="hidden md:inline">for video ·</span>
              <kbd className="hidden md:inline-block px-2 py-1 bg-zinc-800 rounded text-xs font-mono border border-zinc-700">H</kbd>
              <span className="hidden md:inline">to toggle controls ·</span>
              <kbd className="hidden md:inline-block px-2 py-1 bg-zinc-800 rounded text-xs font-mono border border-zinc-700">Esc</kbd>
              <span className="hidden md:inline">to leave</span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Exit Cinema Mode Button (viewer-only, visible only in cinema mode) */}
      <button
        className="cinema-exit-btn"
        onClick={() => setCinemaOverrideOff(true)}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          ✕
        </span>
      </button>

      {/* Floating Webcams Container */}
      <div className="absolute inset-0 z-40 pointer-events-none cinema-webcam-container">
        <WebcamOverlay 
          stream={localUser.stream} 
          isLocal 
          muted 
          name={localUser.name || "You"} 
          isMicMuted={localUser.micMuted}
          isCameraOff={localUser.cameraOff}
          index={0}
        />
        {Object.entries(remoteUsers).map(([id, user], i) => (
          <WebcamOverlay 
            key={id} 
            stream={user.stream} 
            muted={false}
            name={user.name || `Guest ${id.substring(0,4)}`}
            isMicMuted={user.micMuted}
            isCameraOff={user.cameraOff}
            iceStatus={user.iceStatus}
            index={i + 1}
          />
        ))}
      </div>

      {/* Bottom Control Bar */}
      <div className="relative z-30 p-4 md:p-6 flex justify-center cinema-controls">
        <div className="glass-panel px-4 md:px-8 py-3 md:py-4 rounded-full flex items-center gap-3 md:gap-6 shadow-2xl border border-white/10 bg-black/40 backdrop-blur-xl">
          <button 
            id="toggle-mic-btn"
            onClick={toggleMic}
            title={localUser.micMuted ? "Unmute microphone (M)" : "Mute microphone (M)"}
            className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all ${
              localUser.micMuted 
                ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' 
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {localUser.micMuted ? <MicOff className="w-5 h-5 md:w-6 md:h-6" /> : <Mic className="w-5 h-5 md:w-6 md:h-6" />}
          </button>
          
          <button 
            id="toggle-video-btn"
            onClick={toggleVideo}
            title={localUser.cameraOff ? "Turn on camera (V)" : "Turn off camera (V)"}
            className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all ${
              localUser.cameraOff 
                ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' 
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {localUser.cameraOff ? <VideoOff className="w-5 h-5 md:w-6 md:h-6" /> : <Video className="w-5 h-5 md:w-6 md:h-6" />}
          </button>

          <div className="w-px h-8 bg-white/10" />

          {localUser.screenStream ? (
            <button 
              id="stop-share-btn"
              onClick={() => stopScreenShare(localUser.screenStream!)}
              className="px-4 md:px-6 h-12 md:h-14 rounded-full bg-red-500 text-white font-medium flex items-center gap-2 hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20 text-sm md:text-base"
            >
              <StopCircle className="w-4 h-4 md:w-5 md:h-5" />
              <span className="hidden sm:inline">Stop Sharing</span>
              <span className="sm:hidden">Stop</span>
            </button>
          ) : (
            <button 
              id="share-screen-btn"
              onClick={startScreenShare}
              className="px-4 md:px-6 h-12 md:h-14 rounded-full bg-white text-black font-medium flex items-center gap-2 hover:bg-gray-100 transition-colors shadow-lg shadow-white/10 text-sm md:text-base"
            >
              <MonitorUp className="w-4 h-4 md:w-5 md:h-5" />
              <span className="hidden sm:inline">Share Screen</span>
              <span className="sm:hidden">Share</span>
            </button>
          )}

          <div className="w-px h-8 bg-white/10" />

          <button 
            id="hide-controls-btn"
            onClick={() => setIsControlsHidden(true)}
            className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all"
            title="Hide controls (H)"
          >
            <EyeOff className="w-5 h-5 md:w-6 md:h-6" />
          </button>

          <div className="w-px h-8 bg-white/10" />

          <button 
            id="copy-link-btn"
            onClick={copyLink}
            className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all"
            title="Copy room link"
          >
            {copied ? <Check className="w-5 h-5 md:w-6 md:h-6 text-green-400" /> : <Link className="w-4 h-4 md:w-5 md:h-5" />}
          </button>

          <button 
            id="leave-room-btn"
            onClick={handleLeaveRoom}
            className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-all"
            title="Leave room (Esc)"
          >
            <LogOut className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>
      </div>
      <ScreenSharePicker 
        isOpen={pickerOpen} 
        sources={pickerSources} 
        onSelect={handleSelectScreenSource} 
      />

      {/* Floating Show Controls Button (visible when controls are hidden) */}
      <button
        onClick={() => setIsControlsHidden(false)}
        className={`show-controls-btn ${isControlsHidden ? 'visible' : ''}`}
        title="Show controls (H)"
      >
        <Eye className="w-6 h-6 text-white" />
      </button>
    </main>
  );
}
