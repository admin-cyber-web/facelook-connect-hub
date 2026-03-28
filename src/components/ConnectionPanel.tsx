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

  const localRef = useRef<HTMLDivElement>(null);
  const remoteRef = useRef<HTMLDivElement>(null);

  const rtc = useRef<any>({
    client: AgoraRTC.createClient({ mode: "rtc", codec: "vp8" }),
    localAudioTrack: null,
    localVideoTrack: null,
  });

  // 🛡️ THE FIX: Force Video Ingestion
  useEffect(() => {
    if (inCall) {
      const timer = setTimeout(() => {
        if (rtc.current.localVideoTrack && localRef.current) {
          rtc.current.localVideoTrack.play(localRef.current, { fit: "cover" });
        }
        if (remoteUser?.videoTrack && remoteRef.current) {
          remoteUser.videoTrack.play(remoteRef.current, { fit: "cover" });
        }
      }, 500);
      return () => clearTimeout(timer);
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
    <div className="w-full min-h-screen bg-slate-50 flex items-center justify-center p-4">
      {/* 🌟 START SCREEN (No Overlap) */}
      {!inCall && !isSearching && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 flex flex-col items-center"
        >
          <div className="flex -space-x-6 mb-8">
            <img
              src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200"
              className="w-24 h-24 rounded-3xl object-cover border-4 border-white shadow-lg -rotate-6"
            />
            <img
              src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200"
              className="w-24 h-24 rounded-3xl object-cover border-4 border-white shadow-lg rotate-6 z-10"
            />
          </div>

          <h1 className="text-2xl font-black text-slate-800 mb-2">Facelook</h1>
          <p className="text-slate-400 text-sm mb-10">Start 1v1 Random Match</p>

          <button
            onClick={startCall}
            className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-blue-100"
          >
            START MATCH <ArrowRight size={20} />
          </button>
        </motion.div>
      )}

      {/* 📽️ VIDEO SCREEN (Clean Layout) */}
      <AnimatePresence>
        {inCall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black flex flex-col z-[1000]"
          >
            {/* Main Remote View */}
            <div
              ref={remoteRef}
              className="flex-1 w-full bg-slate-900 relative overflow-hidden flex items-center justify-center"
            >
              {!remoteUser && (
                <div className="text-center">
                  <Sparkles
                    size={40}
                    className="text-blue-500 mb-4 animate-bounce mx-auto"
                  />
                  <p className="text-blue-400 font-bold uppercase tracking-widest text-[10px]">
                    Finding Partner...
                  </p>
                </div>
              )}
            </div>

            {/* Floating Local View (Now correctly positioned) */}
            <div
              ref={localRef}
              className="absolute top-6 right-6 w-28 h-40 md:w-40 md:h-56 rounded-2xl border-2 border-white/20 bg-slate-800 shadow-2xl z-[1010] overflow-hidden"
            />

            {/* Controls Bar */}
            <div className="h-32 w-full flex items-center justify-center bg-black/80 backdrop-blur-xl border-t border-white/10 z-[1020]">
              <div className="flex items-center gap-6">
                <button
                  onClick={() => {
                    rtc.current.localAudioTrack.setEnabled(isMuted);
                    setIsMuted(!isMuted);
                  }}
                  className={`p-4 rounded-full transition-all ${isMuted ? "bg-red-500 text-white" : "bg-white/10 text-white"}`}
                >
                  {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                </button>

                <button
                  onClick={endCall}
                  className="p-6 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-xl transform active:scale-90 transition-all"
                >
                  <PhoneOff size={32} fill="white" />
                </button>

                <button
                  onClick={() => {
                    rtc.current.localVideoTrack.setEnabled(isVideoOff);
                    setIsVideoOff(!isVideoOff);
                  }}
                  className={`p-4 rounded-full transition-all ${isVideoOff ? "bg-red-500 text-white" : "bg-white/10 text-white"}`}
                >
                  {isVideoOff ? <CameraOff size={24} /> : <Camera size={24} />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🔍 SEARCHING UI */}
      {isSearching && (
        <div className="fixed inset-0 z-[2000] bg-white flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-6" />
          <p className="text-blue-600 font-black uppercase tracking-[0.4em] text-[10px]">
            Connecting...
          </p>
        </div>
      )}
    </div>
  );
};

export default ConnectionPanel;
