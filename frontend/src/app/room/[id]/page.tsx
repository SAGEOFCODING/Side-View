"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useStore } from "@/store/useStore";
import { WebcamOverlay } from "@/components/WebcamOverlay";
import { VideoPlayer } from "@/components/VideoPlayer";
import { Mic, MicOff, Video, VideoOff, MonitorUp, StopCircle, Link, Check, LogIn } from "lucide-react";

export default function RoomPage() {
  const params = useParams();
  const roomId = params.id as string;
  
  const [hasJoined, setHasJoined] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const { startScreenShare, stopScreenShare, getMedia } = useWebRTC(roomId, hasJoined);
  const { localUser, remoteUsers, setRoomId, resetStore } = useStore();
  
  // Hardware and State Cleanup on Unmount
  useEffect(() => {
    return () => {
      // 1. Stop all hardware tracks safely
      const state = useStore.getState();
      if (state.localUser.stream) {
        state.localUser.stream.getTracks().forEach(track => track.stop());
      }
      if (state.localUser.screenStream) {
        state.localUser.screenStream.getTracks().forEach(track => track.stop());
      }
      
      // 2. Wipe the global store to prevent state bleeding into the next room
      state.resetStore();
    };
  }, []);
  
  const [micMuted, setMicMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    setRoomId(roomId);
  }, [roomId, setRoomId]);

  const handleJoin = async () => {
    setIsStarting(true);
    setPermissionError(null);
    try {
      const { stream, error } = await getMedia();
      if (!stream) {
        setPermissionError(`Camera access denied/unavailable: ${error}. Joining without camera.`);
        // We do NOT return here, allowing them to join the room anyway!
      }
      setHasJoined(true);
    } catch (err: any) {
      console.error(err);
      setPermissionError(`An error occurred: ${err.message || 'Unknown error'}`);
      // Fallback: still let them in even if it completely crashed
      setHasJoined(true);
    } finally {
      setIsStarting(false);
    }
  };

  const toggleMic = () => {
    if (localUser.stream) {
      const audioTrack = localUser.stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localUser.stream) {
      const videoTrack = localUser.stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoOff(!videoTrack.enabled);
      }
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Pre-join screen
  if (!hasJoined) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen bg-[#050505] p-6 relative overflow-hidden">
        {/* Background gradient effects */}
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
          
          {permissionError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 text-red-400 text-sm font-medium">
              {permissionError}
            </div>
          )}

          <button
            onClick={handleJoin}
            disabled={isStarting}
            className="w-full py-4 px-6 rounded-2xl bg-white text-black font-semibold text-lg flex items-center justify-center gap-3 hover:bg-gray-100 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isStarting ? (
              <div className="w-6 h-6 border-3 border-black/20 border-t-black rounded-full animate-spin" />
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
    <main className="relative flex-1 bg-black w-full h-full overflow-hidden flex flex-col">
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/4 left-1/4 w-[40vw] h-[40vw] bg-purple-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[40vw] h-[40vw] bg-blue-600/10 rounded-full blur-[120px]" />
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 md:p-8 min-h-0">
        {activeScreenShare ? (
          <div className="w-full max-w-6xl w-full aspect-video rounded-3xl overflow-hidden glass-panel shadow-2xl relative border border-white/5 bg-black/40">
            <VideoPlayer 
              stream={activeScreenShare} 
              muted={!!localUser.screenStream}
              className="w-full h-full object-contain"
            />
            {/* Elegant overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/20 pointer-events-none" />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 bg-white/5 rounded-3xl flex items-center justify-center mb-6 border border-white/10 shadow-xl">
              <MonitorUp className="w-10 h-10 text-white/40" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Theater is empty</h2>
            <p className="text-gray-400 max-w-md mx-auto text-lg">
              Waiting for someone to start a screen share. When they do, it will appear right here in cinematic mode.
            </p>
          </div>
        )}
      </div>

      {/* Floating Webcams Container - Absolute positioned to avoid pushing UI */}
      <div className="absolute top-6 right-6 z-40 flex flex-col gap-4 max-h-[80vh] overflow-y-auto hide-scrollbar">
        <WebcamOverlay stream={localUser.stream} isLocal muted name="You" />
        {Object.entries(remoteUsers).map(([id, user]) => (
          <WebcamOverlay 
            key={id} 
            stream={user.stream} 
            muted={false}
            name={`Guest ${id.substring(0,4)}`}
          />
        ))}
      </div>

      {/* Bottom Control Bar */}
      <div className="relative z-30 p-6 flex justify-center">
        <div className="glass-panel px-8 py-4 rounded-full flex items-center gap-6 shadow-2xl border border-white/10 bg-black/40 backdrop-blur-xl">
          <button 
            onClick={toggleMic}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              micMuted 
                ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' 
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {micMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>
          
          <button 
            onClick={toggleVideo}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              videoOff 
                ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' 
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {videoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
          </button>

          <div className="w-px h-8 bg-white/10 mx-2" />

          {localUser.screenStream ? (
            <button 
              onClick={() => stopScreenShare(localUser.screenStream!)}
              className="px-6 h-14 rounded-full bg-red-500 text-white font-medium flex items-center gap-2 hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
            >
              <StopCircle className="w-5 h-5" />
              Stop Sharing
            </button>
          ) : (
            <button 
              onClick={startScreenShare}
              className="px-6 h-14 rounded-full bg-white text-black font-medium flex items-center gap-2 hover:bg-gray-100 transition-colors shadow-lg shadow-white/10"
            >
              <MonitorUp className="w-5 h-5" />
              Share Screen
            </button>
          )}

          <div className="w-px h-8 bg-white/10 mx-2" />

          <button 
            onClick={copyLink}
            className="w-14 h-14 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all"
            title="Copy room link"
          >
            {copied ? <Check className="w-6 h-6 text-green-400" /> : <Link className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </main>
  );
}
