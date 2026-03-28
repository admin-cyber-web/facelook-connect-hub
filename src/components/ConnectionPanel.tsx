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

  // 🛠️ VIDEO FORCE-PLAY ENGINE (Self-Correcting)
  useEffect(() => {
    let interval: any;
    if (inCall) {
      const playVideo = async () => {
        if (
          rtc.current.localVideoTrack &&
          localRef.current &&
          !localRef.current.hasChildNodes()
        ) {
          await rtc.current.localVideoTrack.play(localRef.current, {
            fit: "cover",
          });
        }
        if (
          remoteUser?.videoTrack &&
          remoteRef.current &&
          !remoteRef.current.hasChildNodes()
        ) {
          await remoteUser.videoTrack.play(remoteRef.current, { fit: "cover" });
        }
      };
      // हर 1 सेकंड में चेक करेगा कि वीडियो चल रहा है या नहीं, नहीं तो प्ले कर देगा
      interval = setInterval(playVideo, 1000);
    }
    return () => clearInterval(interval);
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
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center overflow-hidden p-0 m-0">
      {/* 🌟 HAND-TO-HAND MINIMALIST START CARD */}
      {!inCall && !isSearching && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-[90%] max-w-[340px] flex flex-col items-center"
        >
          {/* Main Pairing Box */}
          <div className="w-full bg-white rounded-[3rem] p-8 border border-slate-100 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.08)]">
            <div className="flex justify-center -space-x-4 mb-10">
              <div className="w-24 h-24 rounded-[2.5rem] bg-blue-50 border-4 border-white shadow-xl overflow-hidden -rotate-6">
                <img
                  src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="w-24 h-24 rounded-[2.5rem] bg-pink-50 border-4 border-white shadow-xl overflow-hidden rotate-6 z-10">
                <img
                  src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <h2 className="text-center text-slate-800 font-black text-xl mb-2 tracking-tight">
              Facelook Live
            </h2>
            <p className="text-center text-slate-400 text-xs font-medium mb-8">
              1v1 Private Video Match
            </p>

            <button
              onClick={startCall}
              className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-[1.5rem] flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-blue-200"
            >
              START MATCHING
              <ArrowRight size={20} />
            </button>
          </div>

          <div className="mt-8 flex items-center gap-2 text-slate-300">
            <ShieldCheck size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">
              End-to-End Encrypted
            </span>
          </div>
        </motion.div>
      )}

      {/* 📽️ TRUE FULLSCREEN VIDEO INTERFACE (No Gaps) */}
      <AnimatePresence>
        {inCall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black z-[500]"
          >
            {/* Remote Full View */}
            <div
              ref={remoteRef}
              className="absolute inset-0 bg-slate-900 flex items-center justify-center overflow-hidden"
            >
              {!remoteUser && (
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 border-4 border-blue-100/10 border-t-blue-500 rounded-full animate-spin mb-6" />
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.5em] animate-pulse">
                    Finding Friend...
                  </p>
                </div>
              )}
            </div>

            {/* Your Mini View (Overlay) */}
            <div
              ref={localRef}
              className="absolute top-6 right-6 w-32 h-44 rounded-[2rem] border-2 border-white/20 bg-black shadow-2xl z-[510] overflow-hidden transition-all active:scale-90"
            />

            {/* Simple Glass Controls */}
            <div className="absolute bottom-10 left-0 right-0 flex justify-center px-6 z-[520]">
              <div className="w-full max-w-[320px] bg-white/10 backdrop-blur-3xl px-6 py-5 rounded-[2.5rem] border border-white/10 flex items-center justify-around shadow-2xl">
                <button
                  onClick={() => {
                    rtc.current.localAudioTrack.setEnabled(isMuted);
                    setIsMuted(!isMuted);
                  }}
                  className={`p-4 rounded-2xl transition-all ${isMuted ? "bg-red-500 text-white" : "text-white hover:bg-white/10"}`}
                >
                  {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                </button>

                <button
                  onClick={endCall}
                  className="p-6 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-[0_15px_30px_rgba(220,38,38,0.4)] active:scale-90"
                >
                  <PhoneOff size={32} fill="white" />
                </button>

                <button
                  onClick={() => {
                    rtc.current.localVideoTrack.setEnabled(isVideoOff);
                    setIsVideoOff(!isVideoOff);
                  }}
                  className={`p-4 rounded-2xl transition-all ${isVideoOff ? "bg-red-500 text-white" : "text-white hover:bg-white/10"}`}
                >
                  {isVideoOff ? <CameraOff size={24} /> : <Camera size={24} />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🔍 SEARCHING FULLSCREEN */}
      {isSearching && (
        <div className="fixed inset-0 z-[600] bg-white flex flex-col items-center justify-center">
          <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mb-8">
            <Sparkles size={32} className="text-blue-500 animate-pulse" />
          </div>
          <p className="text-[11px] font-black text-blue-600 uppercase tracking-[0.5em] animate-pulse">
            Pairing...
          </p>
        </div>
      )}
    </div>
  );
};

export default ConnectionPanel;
