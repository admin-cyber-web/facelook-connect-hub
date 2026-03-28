import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PhoneOff,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import AgoraRTC from "agora-rtc-sdk-ng";

// --- 🔑 AGORA PRODUCTION CONFIG ---
const APP_ID = "fc434988dc0545b49355a6ace8aaadd6";
const TOKEN =
  "007eJxTYJjIdUjct3rFtRcMzWuVEyIPl1a877GUt5t4RmxKilIV9zsFhrRkE2MTSwuLlGQDUxPTJBNLY1PTRLPE5FSLxMTElBSzM9ePZzYEMjJMyzNiZmSAQBCflyENqCgnPz9btyg1MYeBAQBAhSKt";

// ⚠️ MATCHED CHANNEL NAME (टोकन जनरेट करते समय जो नाम था)
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

  // 🛡️ NO-FAIL VIDEO ENGINE
  useEffect(() => {
    if (inCall) {
      const playInterval = setInterval(() => {
        if (
          rtc.current.localVideoTrack &&
          localRef.current &&
          localRef.current.childElementCount === 0
        ) {
          rtc.current.localVideoTrack.play(localRef.current, { fit: "cover" });
        }
        if (
          remoteUser?.videoTrack &&
          remoteRef.current &&
          remoteRef.current.childElementCount === 0
        ) {
          remoteUser.videoTrack.play(remoteRef.current, { fit: "cover" });
        }
      }, 1000);
      return () => clearInterval(playInterval);
    }
  }, [inCall, remoteUser]);

  const startCall = async () => {
    setIsSearching(true);
    try {
      await rtc.current.client.join(APP_ID, CHANNEL_NAME, TOKEN, null);
      const [audio, video] = await AgoraRTC.createMicrophoneAndCameraTracks();
      rtc.current.localAudioTrack = audio;
      rtc.current.localVideoTrack = video;

      rtc.current.client.on(
        "user-published",
        async (user: any, mediaType: string) => {
          if (rtc.current.client.remoteUsers.length > 1) return;
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
      console.error("Agora Connection Error:", err);
      setIsSearching(false);
    }
  };

  const endCall = async () => {
    rtc.current.localAudioTrack?.stop();
    rtc.current.localAudioTrack?.close();
    rtc.current.localVideoTrack?.stop();
    rtc.current.localVideoTrack?.close();
    await rtc.current.client.leave();
    setInCall(false);
    setRemoteUser(null);
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 w-screen h-screen bg-white overflow-hidden m-0 p-0 border-none">
      {/* 🌟 ULTRA-CLEAN START SCREEN (Zero Gaps) */}
      {!inCall && !isSearching && (
        <div className="w-full h-full flex items-center justify-center p-0 m-0">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-[350px] flex flex-col items-center bg-white px-6"
          >
            <div className="flex -space-x-4 mb-8">
              <div className="w-24 h-24 rounded-[2.5rem] bg-slate-100 border-4 border-white shadow-xl overflow-hidden -rotate-6">
                <img
                  src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="w-24 h-24 rounded-[2.5rem] bg-slate-100 border-4 border-white shadow-xl overflow-hidden rotate-6">
                <img
                  src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <h1 className="text-xl font-black text-slate-800 tracking-tighter uppercase mb-2">
              Facelook Live
            </h1>
            <p className="text-blue-500 font-bold text-[10px] tracking-[0.4em] uppercase mb-10">
              Pairing Algorithm Active
            </p>

            <button
              onClick={startCall}
              className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-blue-200"
            >
              START MATCHING <ArrowRight size={20} />
            </button>
          </motion.div>
        </div>
      )}

      {/* 📽️ IMMERSIVE VIDEO SCREEN (No White Space) */}
      <AnimatePresence>
        {inCall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[1000] bg-black m-0 p-0 border-none"
          >
            {/* PARTNER VIEW (FILLS SCREEN) */}
            <div
              ref={remoteRef}
              className="absolute inset-0 w-full h-full bg-slate-900 flex items-center justify-center overflow-hidden m-0 p-0 border-none"
            >
              {!remoteUser && (
                <div className="text-center">
                  <Sparkles
                    size={40}
                    className="text-blue-500 mb-4 animate-bounce mx-auto"
                  />
                  <p className="text-blue-400 font-bold text-[10px] tracking-[0.5em] uppercase">
                    Matching...
                  </p>
                </div>
              )}
            </div>

            {/* YOUR VIEW (TIGHT CORNER) */}
            <div
              ref={localRef}
              className="absolute top-4 right-4 w-28 h-40 md:w-40 md:h-56 rounded-2xl border border-white/20 bg-black shadow-2xl z-[1010] overflow-hidden"
            />

            {/* MINIMALIST OVERLAY CONTROLS */}
            <div className="absolute bottom-8 left-0 right-0 flex justify-center px-4 z-[1020]">
              <div className="w-full max-w-[280px] flex items-center justify-around bg-black/30 backdrop-blur-3xl px-6 py-4 rounded-full border border-white/10 shadow-2xl">
                <button
                  onClick={() => {
                    rtc.current.localAudioTrack.setEnabled(isMuted);
                    setIsMuted(!isMuted);
                  }}
                  className={`p-3 rounded-xl transition-all ${isMuted ? "bg-red-500 text-white" : "bg-white/10 text-white"}`}
                >
                  {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                </button>

                <button
                  onClick={endCall}
                  className="p-5 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-xl active:scale-90 transition-all"
                >
                  <PhoneOff size={28} fill="white" />
                </button>

                <button
                  onClick={() => {
                    rtc.current.localVideoTrack.setEnabled(isVideoOff);
                    setIsVideoOff(!isVideoOff);
                  }}
                  className={`p-3 rounded-xl transition-all ${isVideoOff ? "bg-red-500 text-white" : "bg-white/10 text-white"}`}
                >
                  {isVideoOff ? <CameraOff size={22} /> : <Camera size={22} />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🔍 SEARCHING (Full White Screen) */}
      {isSearching && (
        <div className="fixed inset-0 z-[2000] bg-white flex flex-col items-center justify-center m-0 p-0 border-none">
          <div className="w-10 h-10 border-[3px] border-blue-100 border-t-blue-600 rounded-full animate-spin mb-6" />
          <p className="text-blue-600 font-bold tracking-[0.5em] text-[9px] uppercase animate-pulse">
            Establishing Node...
          </p>
        </div>
      )}
    </div>
  );
};

export default ConnectionPanel;
