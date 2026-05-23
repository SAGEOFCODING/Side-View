"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { MonitorPlay, Users, Zap } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  const [joinCode, setJoinCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  const createRoom = () => {
    setIsCreating(true);
    // Generate 5 digit code
    const roomId = Math.floor(10000 + Math.random() * 90000).toString();
    setTimeout(() => {
      router.push(`/room/${roomId}`);
    }, 600); // Small delay for animation
  };

  const joinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = joinCode.trim();
    if (!trimmedInput) return;

    let targetRoomId = trimmedInput;

    // Check if the pasted string is a URL containing the room path
    try {
      if (trimmedInput.includes('/room/')) {
        const parts = trimmedInput.split('/room/');
        const extracted = parts[parts.length - 1].split('?')[0].split('#')[0];
        if (extracted) {
          targetRoomId = extracted;
        }
      }
    } catch (err) {
      console.error("Failed to parse pasted room URL:", err);
    }

    // Alphanumeric room ID validation on client
    if (!/^[a-zA-Z0-9_-]+$/.test(targetRoomId)) {
      alert("Invalid room ID format. Please use only alphanumeric characters, hyphens, or underscores.");
      return;
    }

    setIsJoining(true);
    setTimeout(() => {
      router.push(`/room/${targetRoomId}`);
    }, 600);
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-black to-black noise-bg">
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="max-w-3xl w-full text-center space-y-8 z-10"
      >
        <div className="space-y-4">
          <motion.div 
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-flex items-center justify-center p-3 bg-purple-500/10 rounded-2xl mb-4 border border-purple-500/20"
          >
            <MonitorPlay className="w-8 h-8 text-purple-400" />
          </motion.div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
            SideView
          </h1>
          <p className="text-xl md:text-2xl text-zinc-400 max-w-2xl mx-auto font-light">
            Synchronized screen sharing with live emotional presence. <br className="hidden md:block"/> Watch together, feel together.
          </p>
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="pt-8 flex flex-col md:flex-row items-center justify-center gap-6"
        >
          <button
            onClick={createRoom}
            disabled={isCreating || isJoining}
            className="relative group overflow-hidden rounded-full p-[1px] transition-transform hover:scale-105 active:scale-95"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 rounded-full opacity-70 group-hover:opacity-100 blur transition-opacity duration-500"></span>
            <span className="absolute inset-0 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 rounded-full opacity-100 animate-pulse"></span>
            <div className="relative px-8 py-4 bg-black/80 backdrop-blur-md rounded-full flex items-center gap-3">
              {isCreating ? (
                <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Zap className="w-5 h-5 text-purple-400" />
              )}
              <span className="text-lg font-medium text-white">
                {isCreating ? "Creating Room..." : "Create Private Room"}
              </span>
            </div>
          </button>

          <div className="text-zinc-500 font-medium">OR</div>

          <form onSubmit={joinRoom} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="5-digit Code or URL"
              maxLength={250}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-full px-6 py-4 text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition-colors w-48 md:w-64 text-center text-lg"
            />
            <button
              type="submit"
              disabled={!joinCode || isJoining || isCreating}
              className="px-6 py-4 rounded-full bg-white text-black font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:hover:bg-white"
            >
              {isJoining ? "Joining..." : "Join"}
            </button>
          </form>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="grid md:grid-cols-3 gap-6 pt-16 text-left"
        >
          <FeatureCard 
            icon={<Users className="w-5 h-5 text-purple-400" />}
            title="Personal Co-Watching"
            desc="A cozy picture-in-picture webcam overlay so you never miss a smile."
          />
          <FeatureCard 
            icon={<MonitorPlay className="w-5 h-5 text-pink-400" />}
            title="Any Content"
            desc="Share your screen with system audio. Netflix, Anime, or YouTube."
          />
          <FeatureCard 
            icon={<Zap className="w-5 h-5 text-amber-400" />}
            title="Instant Join"
            desc="No signups required. Just share the link and start watching instantly."
          />
        </motion.div>
      </motion.div>
    </main>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="glass-panel p-6 rounded-2xl flex flex-col gap-3 transition-colors hover:bg-zinc-900/80">
      <div className="w-10 h-10 rounded-full bg-zinc-800/50 flex items-center justify-center border border-zinc-700/50">
        {icon}
      </div>
      <h3 className="text-lg font-medium text-zinc-200">{title}</h3>
      <p className="text-zinc-500 text-sm leading-relaxed">{desc}</p>
    </div>
  );
}
