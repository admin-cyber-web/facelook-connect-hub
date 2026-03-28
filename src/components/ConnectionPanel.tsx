import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Video,
  Star,
  PhoneOff,
  User,
  Mic,
  Camera,
  ArrowRightLeft,
} from "lucide-react";
import AgoraRTC from "agora-rtc-sdk-ng";

// --- 🔑 आपकी असली AGORA APP ID सेट कर दी है ---
const APP_ID = "e7f6e9aeecf14b2ba10e3f40be9f56e7";
const CHANNEL = "facelook_live";

// --- इमेजेस (आप इन्हें अपनी पसंद से बदल सकते हैं) ---
const models = {
  girl: "https://images.unsplash.com/photo-1516714435131-44d6b64dc6a2?w=400&q=80",
  boy: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80",
};

const ConnectionPanel = () => {
  const [inCall, setInCall] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);

  // Agora Client Setup
  const rtc = useRef<any>({
    client: AgoraRTC.createClient({ mode: "rtc", codec: "vp8" }),
    localAudioTrack: null,
    localVideoTrack: null,
  });

  const startCall = async () => {
    setIsSearching(true);
    setTimeout(async () => {
      try {
        // Agora Join
        await rtc.current.client.join(APP_ID, CHANNEL, null, null);
        rtc.current.localAudioTrack =
          await AgoraRTC.createMicrophoneAudioTrack();
        rtc.current.localVideoTrack = await AgoraRTC.createCameraVideoTrack();

        setIsSearching(false);
        setInCall(true);

        // अपनी वीडियो दिखाना
        setTimeout(() => {
          if (localVideoRef.current)
            rtc.current.localVideoTrack.play(localVideoRef.current);
        }, 500);

        // दूसरे यूजर को सुनना/देखना
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
        console.error(err);
        alert("Camera Error! Make sure you are using HTTPS.");
        setIsSearching(false);
      }
    }, 3000); // 3 सेकंड का ड्रामा
  };

  const endCall = async () => {
    rtc.current.localAudioTrack?.close();
    rtc.current.localVideoTrack?.close();
    await rtc.current.client.leave();
    setInCall(false);
  };

  return (
    <div className="space-y-6 px-4 md:px-8">
      {/* 🌟 New Connection Design: Handshake Concept */}
      <motion.div
        whileTap={{ scale: 0.98 }}
        onClick={startCall}
        className="glass rounded-3xl p-6 cursor-pointer border border-primary/20 shadow-xl bg-gradient-to-br from-primary/5 to-secondary/5 group overflow-hidden"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Video size={18} className="text-primary" />
            <span className="text-xs font-black uppercase tracking-widest text-foreground">
              Live Connect
            </span>
          </div>
          <div className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black animate-pulse uppercase tracking-widest">
            Live
          </div>
        </div>

        {/* Handshake Logic */}
        <div className="flex items-center justify-center relative">
          {/* Boy Circle */}
          <motion.div
            initial={{ x: -20 }}
            animate={{ x: 0 }}
            className="flex flex-col items-center z-10"
          >
            <div className="w-20 h-20 rounded-full border-4 border-accent shadow-2xl overflow-hidden bg-muted">
              <img
                src={models.boy}
                className="w-full h-full object-cover"
                alt="Boy"
              />
            </div>
            <span className="text-[10px] font-bold text-accent uppercase tracking-wider mt-2">
              Rahul
            </span>
          </motion.div>

          {/* Connection Visuals (Arrows and Shake Icon) */}
          <div className="relative flex items-center w-32 -mx-4 group-hover:scale-105 transition-transform duration-500">
            <div className="w-full h-[2px] bg-gradient-to-r from-accent via-primary to-accent animate-ping" />
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white border-2 border-white shadow-xl rotate-[-20deg]">
                <ArrowRightLeft size={24} className="stroke-[3]" />
              </div>
            </motion.div>
          </div>

          {/* Girl Circle */}
          <motion.div
            initial={{ x: 20 }}
            animate={{ x: 0 }}
            className="flex flex-col items-center z-10"
          >
            <div className="w-20 h-20 rounded-full border-4 border-primary shadow-2xl overflow-hidden bg-muted">
              <img
                src={models.girl}
                className="w-full h-full object-cover"
                alt="Girl"
              />
            </div>
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider mt-2">
              Ayesha
            </span>
          </motion.div>
        </div>

        {/* 📞 Bottom Calling Animation */}
        <div className="mt-8 pt-4 border-t border-white/5 flex flex-col items-center">
          <div className="w-full flex items-center justify-center gap-1 opacity-60">
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0.2, scaleY: 0.5 }}
                animate={{ opacity: 1, scaleY: 1.5 }}
                transition={{
                  repeat: Infinity,
                  duration: 0.5,
                  delay: i * 0.1,
                  repeatType: "mirror",
                }}
                className="w-[3px] h-3 bg-primary rounded-full"
              />
            ))}
            <span className="text-[10px] text-primary/80 mx-2 font-bold uppercase tracking-widest">
              Click to start call
            </span>
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0.2, scaleY: 0.5 }}
                animate={{ opacity: 1, scaleY: 1.5 }}
                transition={{
                  repeat: Infinity,
                  duration: 0.5,
                  delay: (6 - i) * 0.1,
                  repeatType: "mirror",
                }}
                className="w-[3px] h-3 bg-secondary rounded-full"
              />
            ))}
          </div>
        </div>
      </motion.div>

      {/* --- Fullscreen Searching Overlay (Matching) --- */}
      <AnimatePresence>
        {isSearching && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="flex items-center gap-6 mb-10">
              <img
                src={models.girl}
                className="w-20 h-20 rounded-full border-4 border-primary object-cover"
                alt="Matching Girl"
              />
              <div className="flex flex-col items-center">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-ping mb-2" />
                <Star
                  size={30}
                  className="text-white fill-white animate-spin-slow"
                />
              </div>
              <img
                src={models.boy}
                className="w-20 h-20 rounded-full border-4 border-accent object-cover"
                alt="Matching Boy"
              />
            </div>
            <h2 className="text-2xl font-black italic text-foreground tracking-tighter uppercase">
              Connecting to Cloud...
            </h2>
            <div className="mt-6 flex gap-1 items-center justify-center">
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ repeat: Infinity, duration: 1, delay: i * 0.3 }}
                  className="w-3 h-3 rounded-full bg-primary"
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Video Call Fullscreen --- */}
      <AnimatePresence>
        {inCall && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.1, opacity: 0 }}
            transition={{ type: "spring", damping: 25 }}
            className="fixed inset-0 z-[200] bg-black"
          >
            {/* Main Remote Video (Partner) */}
            <div
              ref={remoteVideoRef}
              className="w-full h-full bg-gray-900 flex items-center justify-center overflow-hidden"
            >
              <img
                src={models.girl}
                className="w-full h-full object-cover opacity-30 blur-sm scale-110"
              />
              <p className="absolute text-white/40 text-xs font-black uppercase tracking-[0.3em] animate-pulse">
                Waiting for partner...
              </p>
            </div>

            {/* Local Video Preview (You - Small Box) */}
            <div
              ref={localVideoRef}
              className="absolute top-10 right-6 w-32 h-48 rounded-2xl border-2 border-white/20 bg-gray-900 shadow-2xl z-50 overflow-hidden"
            />

            {/* Bottom Controls */}
            <div className="absolute bottom-12 left-0 right-0 flex justify-center items-center gap-6 z-[60]">
              <button
                onClick={endCall}
                className="p-6 rounded-full bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.5)] active:scale-90 transition-transform"
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
