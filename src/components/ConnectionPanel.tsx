import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PhoneOff,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Sparkles,
  Users,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import AgoraRTC from "agora-rtc-sdk-ng";

// --- 🔑 CONFIG ---
const APP_ID = "fc434988dc0545b49355a6ace8aaadd6";
const TOKEN =
  "007eJxTYJjIdUjct3rFtRcMzWuVEyIPl1a877GUt5t4RmxKilIV9zsFhrRkE2MTSwuLlGQDUxPTJBNLY1PTRLPE5FSLxMTElBSzM9ePZzYEMjJMyzNiZmSAQBCflyENqCgnPz9btyg1MYeBAQBAhSKt";
const CHANNEL_NAME = "facelook-real";

const ConnectionPanel = () => {
  const [inCall, setInCall] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [remoteUser, setRemoteUser] = useState<any>(null);

  // Refs for Video Anchors
  const localRef = useRef<HTMLDivElement>(null);
  const remoteRef = useRef<HTMLDivElement>(null);

  const rtc = useRef<any>({
    client: AgoraRTC.createClient({ mode: "rtc", codec: "vp8" }),
    localAudioTrack: null,
    localVideoTrack: null,
  });

  // 🛠️ FORCE PLAY LOGIC (Deep Fix)
  const handleRemoteVideo = useCallback(async (user: any) => {
    if (user.videoTrack && remoteRef.current) {
      await user.videoTrack.play(remoteRef.current, { fit: "cover" });
    }
  }, []);

  const handleLocalVideo = useCallback(async () => {
    if (rtc.current.localVideoTrack && localRef.current) {
      await rtc.current.localVideoTrack.play(localRef.current, {
        fit: "cover",
      });
    }
  }, []);

  useEffect(() => {
    if (inCall) {
      const timer = setTimeout(() => {
        handleLocalVideo();
        if (remoteUser) handleRemoteVideo(remoteUser);
      }, 500); // Small delay to let DOM settle
      return () => clearTimeout(timer);
    }
  }, [inCall, remoteUser, handleLocalVideo, handleRemoteVideo]);

  const startCall = async () => {
    if (!window.isSecureContext) return alert("Please use HTTPS!");
    setIsSearching(true);
    try {
      await rtc.current.client.join(APP_ID, CHANNEL_NAME, TOKEN, null);
      const [audio, video] = await AgoraRTC.createMicrophoneAndCameraTracks();
      rtc.current.localAudioTrack = audio;
      rtc.current.localVideoTrack = video;

      rtc.current.client.on(
        "user-published",
        async (user: any, mediaType: string) => {
          if (rtc.current.client.remoteUsers.length > 1) return; // 1v1 Pair Only
          await rtc.current.client.subscribe(user, mediaType);
          if (mediaType === "video") setRemoteUser(user);
          if (mediaType === "audio") user.audioTrack.play();
        },
      );

      rtc.current.client.on("user-left", () => endCall());
      await rtc.current.client.publish([audio, video]);

      setInCall(true);
      setIsSearching(false);
    } catch (err) {
      console.error(err);
      setIsSearching(false);
    }
  };

  const endCall = async () => {
    rtc.current.localAudioTrack?.close();
    rtc.current.localVideoTrack?.close();
    await rtc.current.client.leave();
    setInCall(false);
    setRemoteUser(null);
    window.location.reload();
  };

  return (
    <div className="flex items-center justify-center p-4 min-h-[400px] bg-slate-50">
      {/* 🌟 PREMIUM LIGHT GLASS CARD */}
      <AnimatePresence>
        {!inCall && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-[320px] bg-white/80 backdrop-blur-xl rounded-[2.5rem] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-white"
          >
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-full border border-blue-100">
                <ShieldCheck size={14} className="text-blue-500" />
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">
                  Secure 1v1
                </span>
              </div>
              <Users size={18} className="text-slate-300" />
            </div>

            <div className="flex justify-center items-center gap-4 mb-10">
              <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-tr from-blue-100 to-white p-1 border border-white shadow-sm overflow-hidden rotate-[-6deg]">
                <img
                  src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200"
                  className="w-full h-full object-cover rounded-[1.8rem]"
                  alt="p1"
                />
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-200 z-10">
                <Sparkles size={18} />
              </div>
              <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-tr from-pink-100 to-white p-1 border border-white shadow-sm overflow-hidden rotate-[6deg]">
                <img
                  src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200"
                  className="w-full h-full object-cover rounded-[1.8rem]"
                  alt="p2"
                />
              </div>
            </div>

            <button
              onClick={startCall}
              className="group w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-3 active:scale-95"
            >
              FIND LUCKY FRIEND
              <ArrowRight
                size={18}
                className="group-hover:translate-x-1 transition-transform"
              />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 📽️ CLEAN VIDEO INTERFACE (LIGHT) */}
      <AnimatePresence>
        {inCall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] bg-white"
          >
            {/* Main Stream (Remote) */}
            <div
              ref={remoteRef}
              className="w-full h-full bg-slate-50 flex items-center justify-center relative overflow-hidden"
            >
              {!remoteUser && (
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin mb-6" />
                  <p className="text-xs font-bold text-blue-400 uppercase tracking-[0.4em] animate-pulse">
                    Searching Partner...
                  </p>
                </div>
              )}
            </div>

            {/* Self View (Floating - Soft Rounding) */}
            <div
              ref={localRef}
              className="absolute top-10 right-6 w-32 h-44 rounded-[2rem] bg-white border-4 border-white shadow-2xl z-[510] overflow-hidden"
            />

            {/* Minimalist Controls */}
            <div className="absolute bottom-10 left-0 right-0 flex justify-center z-[520]">
              <div className="flex items-center gap-4 bg-white/90 backdrop-blur-md px-8 py-4 rounded-full border border-slate-100 shadow-xl">
                <button
                  onClick={() => {
                    rtc.current.localAudioTrack.setEnabled(isMuted);
                    setIsMuted(!isMuted);
                  }}
                  className={`p-4 rounded-full transition-all ${isMuted ? "bg-red-50 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
                >
                  {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                </button>

                <button
                  onClick={endCall}
                  className="p-6 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-100 transition-all hover:scale-110 active:scale-95"
                >
                  <PhoneOff size={28} fill="white" />
                </button>

                <button
                  onClick={() => {
                    rtc.current.localVideoTrack.setEnabled(isVideoOff);
                    setIsVideoOff(!isVideoOff);
                  }}
                  className={`p-4 rounded-full transition-all ${isVideoOff ? "bg-red-50 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
                >
                  {isVideoOff ? <CameraOff size={22} /> : <Camera size={22} />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🔍 SEARCHING STATE */}
      {isSearching && (
        <div className="fixed inset-0 z-[600] bg-white flex flex-col items-center justify-center">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-8"
          >
            <Sparkles size={40} className="text-blue-500" />
          </motion.div>
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.5em] animate-pulse">
            Matching you now...
          </p>
        </div>
      )}
    </div>
  );
};

export default ConnectionPanel;
