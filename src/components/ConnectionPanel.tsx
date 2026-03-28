import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Video,
  Star,
  PhoneOff,
  Mic,
  Camera,
  ArrowRightLeft,
  ShieldCheck,
} from "lucide-react";
import AgoraRTC from "agora-rtc-sdk-ng";

// --- 🔑 AGORA SETTINGS ---
const APP_ID = "e7f6e9aeecf14b2ba10e3f40be9f56e7";
const CHANNEL = "facelook_live";

// --- MODELS IMAGES ---
const models = {
  girl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&q=80",
  boy: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80",
};

const ConnectionPanel = () => {
  const [inCall, setInCall] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);

  const rtc = useRef<any>({
    client: AgoraRTC.createClient({ mode: "rtc", codec: "vp8" }),
    localAudioTrack: null,
    localVideoTrack: null,
  });

  // --- 🛡️ CAMERA PERMISSION & START CALL LOGIC ---
  const startCall = async () => {
    // Check for Secure Context (HTTPS)
    if (!window.isSecureContext) {
      alert(
        "⚠️ Error: Video call requires a secure (HTTPS) connection. Please open the preview in a new tab!",
      );
      return;
    }

    try {
      // Step 1: Request Camera/Mic Permissions from Browser
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

      setIsSearching(true);

      // Step 2: Agora Connection Logic
      setTimeout(async () => {
        try {
          await rtc.current.client.join(APP_ID, CHANNEL, null, null);
          rtc.current.localAudioTrack =
            await AgoraRTC.createMicrophoneAudioTrack();
          rtc.current.localVideoTrack = await AgoraRTC.createCameraVideoTrack();

          setIsSearching(false);
          setInCall(true);

          // Play Local Video
          setTimeout(() => {
            if (localVideoRef.current)
              rtc.current.localVideoTrack.play(localVideoRef.current);
          }, 500);

          // Handle Remote User Joining
          rtc.current.client.on(
            "user-published",
            async (user: any, mediaType: string) => {
              await rtc.current.client.subscribe(user, mediaType);
              if (mediaType === "video" && remoteVideoRef.current) {
                user.videoTrack.play(remoteVideoRef.current);
              }
            },
          );

          await rtc.current.client.publish([
            rtc.current.localAudioTrack,
            rtc.current.localVideoTrack,
          ]);
        } catch (err) {
          console.error("Agora Error:", err);
          setIsSearching(false);
        }
      }, 2500);
    } catch (err) {
      alert(
        "❌ Permission Denied! Please allow camera and microphone access to start the call.",
      );
      console.error("User denied permissions", err);
    }
  };

  const endCall = async () => {
    rtc.current.localAudioTrack?.close();
    rtc.current.localVideoTrack?.close();
    await rtc.current.client.leave();
    setInCall(false);
  };

  return (
    <div className="space-y-6 px-4 md:px-8">
      {/* 🌟 MAIN DESIGN CARD */}
      <motion.div
        whileTap={{ scale: 0.97 }}
        onClick={startCall}
        className="glass rounded-[2.5rem] p-8 cursor-pointer border border-white/10 shadow-2xl bg-gradient-to-b from-white/5 to-primary/5 relative overflow-hidden group"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2 bg-primary/20 px-3 py-1 rounded-full">
            <Video size={14} className="text-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest text-primary">
              Live Connect
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-500 text-[10px] font-bold uppercase tracking-widest">
              Random Match
            </span>
          </div>
        </div>

        {/* Handshake Visual Area */}
        <div className="flex items-center justify-center relative py-4">
          {/* Boy Profile */}
          <div className="flex flex-col items-center z-10">
            <div className="w-24 h-24 rounded-full border-4 border-white/10 shadow-2xl overflow-hidden ring-4 ring-primary/20">
              <img
                src={models.boy}
                className="w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0 transition-all duration-500"
                alt="Boy"
              />
            </div>
            <span className="text-[10px] font-bold text-white/40 uppercase mt-3 tracking-widest">
              Active User
            </span>
          </div>

          {/* Connection Bridge */}
          <div className="flex items-center w-24 -mx-2">
            <div className="h-[2px] flex-1 bg-gradient-to-r from-primary/50 to-secondary/50 relative">
              <motion.div
                animate={{ left: ["0%", "100%"] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                className="absolute top-[-4px] w-2 h-2 rounded-full bg-white shadow-[0_0_10px_#fff]"
              />
            </div>
            <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner rotate-[-15deg] group-hover:rotate-0 transition-transform">
              <ArrowRightLeft size={18} className="text-white" />
            </div>
            <div className="h-[2px] flex-1 bg-gradient-to-r from-secondary/50 to-primary/50" />
          </div>

          {/* Girl Profile */}
          <div className="flex flex-col items-center z-10">
            <div className="w-24 h-24 rounded-full border-4 border-white/10 shadow-2xl overflow-hidden ring-4 ring-secondary/20">
              <img
                src={models.girl}
                className="w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0 transition-all duration-500"
                alt="Girl"
              />
            </div>
            <span className="text-[10px] font-bold text-white/40 uppercase mt-3 tracking-widest">
              Match Partner
            </span>
          </div>
        </div>

        {/* 📞 Calling Pulse Footer */}
        <div className="mt-10 flex flex-col items-center gap-3">
          <div className="flex gap-1 h-4 items-center">
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                animate={{ height: [4, 16, 4] }}
                transition={{
                  repeat: Infinity,
                  duration: 0.6,
                  delay: i * 0.05,
                }}
                className="w-1 bg-primary/40 rounded-full"
              />
            ))}
          </div>
          <span className="text-[11px] font-black text-white tracking-[0.3em] uppercase opacity-60 group-hover:opacity-100 transition-opacity">
            Tap to start calling
          </span>
        </div>
      </motion.div>

      {/* --- MATCHING MODAL --- */}
      <AnimatePresence>
        {isSearching && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="relative mb-12">
              <div className="w-32 h-32 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <ShieldCheck size={40} className="text-primary animate-pulse" />
              </div>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic">
              Securing Connection...
            </h2>
            <p className="text-white/40 text-[10px] mt-2 tracking-[0.2em] font-bold">
              PLEASE ALLOW CAMERA PERMISSION
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- VIDEO CALL OVERLAY --- */}
      <AnimatePresence>
        {inCall && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="fixed inset-0 z-[200] bg-[#050505]"
          >
            {/* Background Stream Placeholder */}
            <div
              ref={remoteVideoRef}
              className="w-full h-full flex items-center justify-center overflow-hidden"
            >
              <img
                src={models.girl}
                className="w-full h-full object-cover opacity-20 blur-xl scale-110"
              />
              <div className="absolute flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center border border-white/10 mb-4 animate-pulse">
                  <User size={30} className="text-white/20" />
                </div>
                <p className="text-white/30 text-[10px] font-black tracking-[0.5em] uppercase">
                  Connecting Stream
                </p>
              </div>
            </div>

            {/* Self Video (Floating Box) */}
            <div
              ref={localVideoRef}
              className="absolute top-12 right-6 w-36 h-52 rounded-3xl border-2 border-white/10 bg-black shadow-2xl z-50 overflow-hidden ring-4 ring-black/50"
            />

            {/* Call Controls */}
            <div className="absolute bottom-16 left-0 right-0 flex justify-center items-center gap-8 z-[60]">
              <button className="p-4 rounded-full bg-white/5 border border-white/10 text-white">
                <Mic />
              </button>
              <button
                onClick={endCall}
                className="p-6 rounded-full bg-red-600 text-white shadow-[0_0_30px_rgba(220,38,38,0.4)] active:scale-90 transition-transform"
              >
                <PhoneOff size={32} />
              </button>
              <button className="p-4 rounded-full bg-white/5 border border-white/10 text-white">
                <Camera />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ConnectionPanel;
