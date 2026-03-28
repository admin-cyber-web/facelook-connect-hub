import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PhoneOff,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Sparkles,
  Users2,
  Shield,
} from "lucide-react";
import AgoraRTC from "agora-rtc-sdk-ng";

// --- 🔑 CONFIG (New App ID & Token) ---
const APP_ID = "fc434988dc0545b49355a6ace8aaadd6";
const TOKEN =
  "007eJxTYJjIdUjct3rFtRcMzWuVEyIPl1a877GUt5t4RmxKilIV9zsFhrRkE2MTSwuLlGQDUxPTJBNLY1PTRLPE5FSLxMTElBSzM9ePZzYEMjJMyzNiZmSAQBCflyENqCgnPz9btyg1MYeBAQBAhSKt";
const CHANNEL_NAME = "facelook-real";

// --- 🎥 MINI VIDEO COMPONENT (To ensure 100% playback) ---
const VideoStream = ({ track, isLocal }: { track: any; isLocal: boolean }) => {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (track && container.current) {
      track.play(container.current, { fit: "cover" });
    }
    return () => track?.stop();
  }, [track]);

  return (
    <div
      ref={container}
      className={`w-full h-full bg-black/40 ${isLocal ? "scale-x-[-1]" : ""}`}
    />
  );
};

const ConnectionPanel = () => {
  const [inCall, setInCall] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [remoteUser, setRemoteUser] = useState<any>(null);

  const rtc = useRef<any>({
    client: AgoraRTC.createClient({ mode: "rtc", codec: "vp8" }),
    localAudioTrack: null,
    localVideoTrack: null,
  });

  const startCall = async () => {
    if (!window.isSecureContext)
      return alert("Security Error: HTTPS required!");
    setIsSearching(true);
    try {
      await rtc.current.client.join(APP_ID, CHANNEL_NAME, TOKEN, null);
      const [audio, video] = await AgoraRTC.createMicrophoneAndCameraTracks();
      rtc.current.localAudioTrack = audio;
      rtc.current.localVideoTrack = video;

      setInCall(true);
      setIsSearching(false);

      rtc.current.client.on(
        "user-published",
        async (user: any, mediaType: string) => {
          if (rtc.current.client.remoteUsers.length > 1) return; // Strict 1v1
          await rtc.current.client.subscribe(user, mediaType);
          if (mediaType === "video") setRemoteUser(user);
          if (mediaType === "audio") user.audioTrack.play();
        },
      );

      rtc.current.client.on("user-left", () => endCall());
      await rtc.current.client.publish([audio, video]);
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
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      {/* 💎 NEW PREMIUM CARD DESIGN */}
      {!inCall && !isSearching && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative w-[340px] group"
        >
          {/* Neon Glow Background */}
          <div className="absolute -inset-1 bg-gradient-to-r from-primary to-blue-600 rounded-[2.5rem] blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>

          <div className="relative bg-black border border-white/10 rounded-[2.5rem] p-8 overflow-hidden">
            <div className="flex justify-between items-start mb-8">
              <div className="p-3 bg-primary/10 rounded-2xl">
                <Shield className="text-primary" size={24} />
              </div>
              <div className="flex items-center gap-2 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-red-500 text-[10px] font-black uppercase tracking-tighter">
                  Live Pair
                </span>
              </div>
            </div>

            <div className="flex justify-center gap-[-20px] mb-10">
              {/* Massive Profile Squircle 1 */}
              <div className="w-32 h-32 rounded-[3rem] border-4 border-black shadow-2xl overflow-hidden -rotate-6 group-hover:rotate-0 transition-transform duration-500 z-10">
                <img
                  src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400"
                  className="w-full h-full object-cover"
                />
              </div>
              {/* Massive Profile Squircle 2 */}
              <div className="w-32 h-32 rounded-[3rem] border-4 border-black shadow-2xl overflow-hidden rotate-6 group-hover:rotate-0 transition-transform duration-500 ml-[-30px]">
                <img
                  src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <button
              onClick={startCall}
              className="w-full py-5 bg-primary text-black font-black uppercase tracking-[0.3em] rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(14,165,233,0.4)]"
            >
              Start Lucky Match
            </button>
          </div>
        </motion.div>
      )}

      {/* 📽️ FULLSCREEN 1v1 VIDEO UI */}
      <AnimatePresence>
        {inCall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] bg-black"
          >
            {/* Remote View (Partner) */}
            <div className="w-full h-full flex items-center justify-center bg-[#050505]">
              {remoteUser?.videoTrack ? (
                <VideoStream track={remoteUser.videoTrack} isLocal={false} />
              ) : (
                <div className="text-center">
                  <Sparkles
                    size={60}
                    className="text-primary/20 mb-6 mx-auto animate-bounce"
                  />
                  <p className="text-[10px] font-black tracking-[0.5em] uppercase text-primary animate-pulse">
                    Waiting for partner...
                  </p>
                </div>
              )}
            </div>

            {/* Local View (Floating Self) */}
            <div className="absolute top-8 right-6 w-36 h-52 rounded-[2.5rem] border-2 border-primary/30 bg-black shadow-2xl z-[510] overflow-hidden">
              {rtc.current.localVideoTrack && (
                <VideoStream
                  track={rtc.current.localVideoTrack}
                  isLocal={true}
                />
              )}
            </div>

            {/* Controls */}
            <div className="absolute bottom-10 left-0 right-0 flex justify-center z-[520]">
              <div className="flex items-center gap-4 bg-black/60 backdrop-blur-3xl px-8 py-5 rounded-[3rem] border border-white/10">
                <button
                  onClick={() => {
                    rtc.current.localAudioTrack.setEnabled(isMuted);
                    setIsMuted(!isMuted);
                  }}
                  className={`p-4 rounded-2xl ${isMuted ? "bg-red-500 text-white" : "bg-white/10 text-primary"}`}
                >
                  {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                </button>

                <button
                  onClick={endCall}
                  className="p-6 rounded-[2.5rem] bg-red-600 text-white shadow-2xl hover:scale-110 active:scale-95 transition-all"
                >
                  <PhoneOff size={32} fill="white" />
                </button>

                <button
                  onClick={() => {
                    rtc.current.localVideoTrack.setEnabled(isVideoOff);
                    setIsVideoOff(!isVideoOff);
                  }}
                  className={`p-4 rounded-2xl ${isVideoOff ? "bg-red-500 text-white" : "bg-white/10 text-primary"}`}
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
        <div className="fixed inset-0 z-[600] bg-black flex flex-col items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full mb-8 shadow-[0_0_30px_#0ea5e9]"
          />
          <p className="text-primary text-xs font-black uppercase tracking-[0.5em] animate-pulse">
            Initializing Secure Pair...
          </p>
        </div>
      )}
    </div>
  );
};

export default ConnectionPanel;
