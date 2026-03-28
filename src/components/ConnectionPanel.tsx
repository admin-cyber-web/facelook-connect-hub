import React, { useState, useRef, useEffect } from "react";
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
const CHANNEL = "facelook_room";

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

  const startCall = async () => {
    // 1. Check if HTTPS
    if (!window.isSecureContext) {
      alert(
        "⚠️ ERROR: Camera works ONLY on HTTPS. Click 'Open in New Tab' in Replit (Top Right).",
      );
      return;
    }

    try {
      setIsSearching(true);

      // 2. Step 1: Force Camera Permission from Browser
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      // 3. Step 2: Agora Setup (Async)
      setTimeout(async () => {
        try {
          // Join Agora
          await rtc.current.client.join(APP_ID, CHANNEL, null, null);

          // Create Tracks
          const [audioTrack, videoTrack] =
            await AgoraRTC.createMicrophoneAndCameraTracks();
          rtc.current.localAudioTrack = audioTrack;
          rtc.current.localVideoTrack = videoTrack;

          setIsSearching(false);
          setInCall(true);

          // 4. Step 3: Play Video in UI
          setTimeout(() => {
            if (localVideoRef.current && rtc.current.localVideoTrack) {
              rtc.current.localVideoTrack.play(localVideoRef.current);
            }
          }, 800);

          // Listen for other users
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
        } catch (agoraErr) {
          console.warn(
            "Agora Error (Server issue), but showing local camera anyway.",
          );
          // Fallback: If Agora fails, at least show local camera for testing
          setIsSearching(false);
          setInCall(true);
          setTimeout(() => {
            if (localVideoRef.current) {
              const videoElement = document.createElement("video");
              videoElement.srcObject = stream;
              videoElement.autoplay = true;
              videoElement.style.width = "100%";
              videoElement.style.height = "100%";
              videoElement.style.objectFit = "cover";
              localVideoRef.current?.appendChild(videoElement);
            }
          }, 800);
        }
      }, 2000);
    } catch (err) {
      alert(
        "❌ Permission Denied! Please allow camera access in browser settings.",
      );
      setIsSearching(false);
    }
  };

  const endCall = async () => {
    if (rtc.current.localVideoTrack) {
      rtc.current.localVideoTrack.stop();
      rtc.current.localVideoTrack.close();
    }
    if (rtc.current.localAudioTrack) rtc.current.localAudioTrack.close();
    await rtc.current.client.leave();
    setInCall(false);
    window.location.reload(); // Hard reset for fresh camera state
  };

  return (
    <div className="space-y-6 px-4 md:px-8">
      {/* 🌟 HANDSHAKE UI */}
      <motion.div
        whileTap={{ scale: 0.96 }}
        onClick={startCall}
        className="glass rounded-[2rem] p-6 cursor-pointer border border-primary/20 shadow-xl bg-gradient-to-br from-primary/5 to-transparent relative overflow-hidden group"
      >
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Video size={16} className="text-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest">
              Random Video Match
            </span>
          </div>
          <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-500 text-[10px] font-bold animate-pulse">
            LIVE
          </span>
        </div>

        <div className="flex items-center justify-center gap-4 relative">
          <div className="w-20 h-20 rounded-full border-4 border-white/10 overflow-hidden shadow-2xl z-10">
            <img
              src={models.boy}
              className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all"
            />
          </div>
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10 z-20">
            <ArrowRightLeft size={20} className="text-primary animate-pulse" />
          </div>
          <div className="w-20 h-20 rounded-full border-4 border-white/10 overflow-hidden shadow-2xl z-10">
            <img
              src={models.girl}
              className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all"
            />
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center">
          <div className="flex gap-1 mb-2">
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                animate={{ height: [4, 14, 4] }}
                transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }}
                className="w-1 bg-primary/40 rounded-full"
              />
            ))}
          </div>
          <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] animate-pulse">
            Tap to Connect
          </p>
        </div>
      </motion.div>

      {/* 🔍 SEARCHING OVERLAY */}
      <AnimatePresence>
        {isSearching && (
          <motion.div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-6">
            <div className="w-20 h-20 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6" />
            <h2 className="text-xl font-black text-white uppercase tracking-tighter italic">
              Initializing Camera...
            </h2>
            <p className="text-white/40 text-[10px] mt-2 font-bold uppercase tracking-widest">
              Check for Permission Popup
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 📽️ VIDEO CALL SCREEN */}
      <AnimatePresence>
        {inCall && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="fixed inset-0 z-[200] bg-black"
          >
            {/* Background Stream (Other User) */}
            <div
              ref={remoteVideoRef}
              className="w-full h-full bg-[#0a0a0a] flex flex-col items-center justify-center overflow-hidden"
            >
              <img
                src={models.girl}
                className="w-full h-full object-cover opacity-20 blur-xl"
              />
              <div className="absolute text-center">
                <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <Star size={40} className="text-white/10" />
                </div>
                <p className="text-white/20 text-[10px] font-black tracking-[0.4em] uppercase">
                  Looking for partner...
                </p>
              </div>
            </div>

            {/* Local Preview (YOU) */}
            <div
              ref={localVideoRef}
              className="absolute top-10 right-6 w-36 h-52 rounded-3xl border-2 border-white/20 bg-black shadow-2xl z-[210] overflow-hidden shadow-primary/20 ring-4 ring-black/50"
            />

            {/* Controls */}
            <div className="absolute bottom-16 left-0 right-0 flex justify-center items-center gap-8 z-[220]">
              <button
                onClick={endCall}
                className="p-6 rounded-full bg-red-600 text-white shadow-2xl active:scale-95 transition-transform"
              >
                <PhoneOff size={32} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ConnectionPanel;
