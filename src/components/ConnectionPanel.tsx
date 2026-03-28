import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PhoneOff,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Sparkles,
  ShieldCheck,
  Users,
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

  const localRef = useRef<HTMLDivElement>(null);
  const remoteRef = useRef<HTMLDivElement>(null);

  const rtc = useRef<any>({
    client: AgoraRTC.createClient({ mode: "rtc", codec: "vp8" }),
    localAudioTrack: null,
    localVideoTrack: null,
  });

  // 🛠️ VIDEO AUTO-PLAY ENGINE (म्यूट-अनम्यूट की ज़रूरत नहीं पड़ेगी)
  useEffect(() => {
    const initVideo = async () => {
      if (inCall) {
        // Local Video Play
        if (rtc.current.localVideoTrack && localRef.current) {
          await rtc.current.localVideoTrack.play(localRef.current, {
            fit: "cover",
          });
        }
        // Remote Video Play (When partner joins)
        if (remoteUser?.videoTrack && remoteRef.current) {
          await remoteUser.videoTrack.play(remoteRef.current, { fit: "cover" });
        }
      }
    };
    const timer = setTimeout(initVideo, 800); // 0.8s delay for DOM stability
    return () => clearTimeout(timer);
  }, [inCall, remoteUser, isVideoOff]); // isVideoOff added to re-trigger if needed

  const startCall = async () => {
    if (!window.isSecureContext) return alert("Use HTTPS!");
    setIsSearching(true);
    try {
      await rtc.current.client.join(APP_ID, CHANNEL_NAME, TOKEN, null);
      const [audio, video] = await AgoraRTC.createMicrophoneAndCameraTracks();
      rtc.current.localAudioTrack = audio;
      rtc.current.localVideoTrack = video;

      rtc.current.client.on(
        "user-published",
        async (user: any, mediaType: string) => {
          if (rtc.current.client.remoteUsers.length > 1) return; // Strict 1v1 Pair
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
    <div className="w-full h-full flex items-center justify-center bg-slate-50 p-0 m-0 overflow-hidden">
      {/* 🌟 EDGE-TO-EDGE CLEAN CARD */}
      <AnimatePresence>
        {!inCall && !isSearching && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-[320px] bg-white rounded-[2.5rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] border border-slate-100 overflow-hidden"
          >
            {/* Top Bar inside card */}
            <div className="flex justify-between items-center px-6 pt-6 mb-4">
              <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-full border border-blue-100">
                <ShieldCheck size={12} className="text-blue-500" />
                <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">
                  Secure 1v1
                </span>
              </div>
              <Users size={18} className="text-slate-200" />
            </div>

            {/* Profile Section with NO extra gaps */}
            <div className="flex flex-col items-center px-6 pb-8">
              <div className="flex items-center justify-center gap-2 mb-8 mt-4">
                <div className="w-28 h-28 rounded-[2.5rem] bg-slate-100 border-4 border-white shadow-xl overflow-hidden -rotate-6">
                  <img
                    src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="w-28 h-28 rounded-[2.5rem] bg-slate-100 border-4 border-white shadow-xl overflow-hidden rotate-6 ml-[-20px] relative z-10">
                  <img
                    src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              <button
                onClick={startCall}
                className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-[0.3em] rounded-2xl transition-all shadow-[0_15px_30px_-5px_rgba(37,99,235,0.3)] active:scale-95"
              >
                Find Lucky Match
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 📽️ FULLSCREEN VIDEO (No White Gaps) */}
      <AnimatePresence>
        {inCall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] bg-black"
          >
            {/* Partner View */}
            <div
              ref={remoteRef}
              className="w-full h-full bg-slate-900 flex items-center justify-center relative overflow-hidden"
            >
              {!remoteUser && (
                <div className="flex flex-col items-center">
                  <Sparkles
                    size={40}
                    className="text-blue-500 mb-4 animate-bounce"
                  />
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.6em] animate-pulse">
                    Matching...
                  </p>
                </div>
              )}
            </div>

            {/* Your View (Floating) */}
            <div
              ref={localRef}
              className="absolute top-6 right-6 w-32 h-44 rounded-[2rem] bg-black border-2 border-white/20 shadow-2xl z-[510] overflow-hidden"
            />

            {/* Simple Floating Controls */}
            <div className="absolute bottom-10 left-0 right-0 flex justify-center z-[520]">
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-2xl px-6 py-4 rounded-full border border-white/10 shadow-2xl">
                <button
                  onClick={() => {
                    rtc.current.localAudioTrack.setEnabled(isMuted);
                    setIsMuted(!isMuted);
                  }}
                  className={`p-4 rounded-full transition-all ${isMuted ? "bg-red-500 text-white" : "bg-white/10 text-white hover:bg-white/20"}`}
                >
                  {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                </button>

                <button
                  onClick={endCall}
                  className="p-6 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-xl transition-all active:scale-90"
                >
                  <PhoneOff size={28} fill="white" />
                </button>

                <button
                  onClick={() => {
                    rtc.current.localVideoTrack.setEnabled(isVideoOff);
                    setIsVideoOff(!isVideoOff);
                  }}
                  className={`p-4 rounded-full transition-all ${isVideoOff ? "bg-red-500 text-white" : "bg-white/10 text-white hover:bg-white/20"}`}
                >
                  {isVideoOff ? <CameraOff size={22} /> : <Camera size={22} />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🔍 SEARCHING MODAL (Edge-to-Edge White) */}
      {isSearching && (
        <div className="fixed inset-0 z-[600] bg-white flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-4 border-blue-50 border-t-blue-600 rounded-full animate-spin mb-6" />
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.5em] animate-pulse">
            Entering Channel...
          </p>
        </div>
      )}
    </div>
  );
};

export default ConnectionPanel;
