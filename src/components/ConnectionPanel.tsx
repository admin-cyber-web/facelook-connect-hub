import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Video,
  PhoneOff,
  ArrowRightLeft,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Monitor,
  ShieldCheck,
  Star,
  Zap,
} from "lucide-react";
import AgoraRTC from "agora-rtc-sdk-ng";

const APP_ID = "32da697dcd144f20be80fb0fd0e5392e";
const CHANNEL = "facelook_pro_live";

const ConnectionPanel = () => {
  const [inCall, setInCall] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [remoteUser, setRemoteUser] = useState<any>(null);

  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  const rtc = useRef<any>({
    client: AgoraRTC.createClient({ mode: "rtc", codec: "vp8" }),
    localAudioTrack: null,
    localVideoTrack: null,
  });

  const startCall = async () => {
    if (!window.isSecureContext)
      return alert("Please use HTTPS (Open in New Tab)");
    setIsSearching(true);

    try {
      await rtc.current.client.join(APP_ID, CHANNEL, null, null);
      const [audioTrack, videoTrack] =
        await AgoraRTC.createMicrophoneAndCameraTracks();
      rtc.current.localAudioTrack = audioTrack;
      rtc.current.localVideoTrack = videoTrack;

      setInCall(true);
      setIsSearching(false);

      // Play Local Video
      setTimeout(() => {
        if (localVideoRef.current)
          rtc.current.localVideoTrack.play(localVideoRef.current);
      }, 200);

      // Handle Remote User
      rtc.current.client.on(
        "user-published",
        async (user: any, mediaType: string) => {
          await rtc.current.client.subscribe(user, mediaType);
          if (mediaType === "video") {
            setRemoteUser(user);
            setTimeout(() => {
              if (remoteVideoRef.current)
                user.videoTrack.play(remoteVideoRef.current);
            }, 200);
          }
          if (mediaType === "audio") user.audioTrack.play();
        },
      );

      // Auto-Disconnect if partner leaves
      rtc.current.client.on("user-left", () => {
        endCall();
      });

      await rtc.current.client.publish([
        rtc.current.localAudioTrack,
        rtc.current.localVideoTrack,
      ]);
    } catch (err) {
      console.error(err);
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

  const toggleMic = () => {
    rtc.current.localAudioTrack.setEnabled(!isMuted);
    setIsMuted(!isMuted);
  };

  const toggleVideo = () => {
    rtc.current.localVideoTrack.setEnabled(isVideoOff);
    setIsVideoOff(!isVideoOff);
  };

  return (
    <div className="px-5">
      {/* 🌟 PREMIUM MEDIUM-SIZED CARD */}
      <motion.div
        whileHover={{ y: -5 }}
        whileTap={{ scale: 0.97 }}
        onClick={startCall}
        className="relative overflow-hidden glass rounded-[2.5rem] p-8 border border-white/20 bg-gradient-to-br from-primary/20 via-white/5 to-secondary/10 cursor-pointer group shadow-2xl shadow-primary/10"
      >
        {/* Background Decorative Glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 blur-[80px] rounded-full group-hover:bg-primary/40 transition-all" />

        <div className="flex justify-between items-center mb-8 relative z-10">
          <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10">
            <Zap size={14} className="text-yellow-400 fill-yellow-400" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">
              Instant Match
            </span>
          </div>
          <div className="flex items-center gap-2 bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/20">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-500 font-bold text-[10px] uppercase tracking-widest">
              Live
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-6 relative z-10">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-4 border-white/20 overflow-hidden shadow-2xl ring-4 ring-primary/20">
              <img
                src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200"
                className="w-full h-full object-cover transition-transform group-hover:scale-110"
              />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-primary p-1.5 rounded-full border-2 border-white shadow-lg">
              <Video size={12} className="text-white" />
            </div>
          </div>

          <div className="flex flex-col items-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
              className="p-3 rounded-full bg-white/5 border border-white/10 shadow-inner"
            >
              <ArrowRightLeft className="text-primary" size={24} />
            </motion.div>
          </div>

          <div className="relative">
            <div className="w-20 h-20 rounded-full border-4 border-white/20 overflow-hidden shadow-2xl ring-4 ring-secondary/20">
              <img
                src="https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200"
                className="w-full h-full object-cover transition-transform group-hover:scale-110"
              />
            </div>
            <div className="absolute -bottom-2 -left-2 bg-secondary p-1.5 rounded-full border-2 border-white shadow-lg">
              <Star size={12} className="text-white fill-white" />
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center relative z-10">
          <div className="flex gap-1.5 mb-4">
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                animate={{ height: [4, 12, 4] }}
                transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }}
                className="w-1.5 bg-primary/50 rounded-full"
              />
            ))}
          </div>
          <p className="text-[12px] font-black tracking-[0.4em] uppercase text-white/60 group-hover:text-white transition-colors">
            Tap to Start Chatting
          </p>
        </div>
      </motion.div>

      {/* 📽️ FULLSCREEN CALL UI */}
      <AnimatePresence>
        {inCall && (
          <motion.div
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[500] bg-black"
          >
            {/* Remote Partner (Main View) */}
            <div
              ref={remoteVideoRef}
              className="w-full h-full flex items-center justify-center bg-[#0a0a0a]"
            >
              {!remoteUser && (
                <div className="text-center">
                  <div className="relative w-24 h-24 mx-auto mb-6">
                    <div className="absolute inset-0 border-4 border-primary/20 rounded-full animate-ping" />
                    <div className="relative w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                      <Monitor size={40} className="text-primary/40" />
                    </div>
                  </div>
                  <p className="text-white/20 text-[10px] font-black tracking-[0.5em] uppercase animate-pulse">
                    Searching for partner...
                  </p>
                </div>
              )}
            </div>

            {/* Self Video (Floating) */}
            <motion.div
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              ref={localVideoRef}
              className="absolute top-12 right-6 w-32 h-48 rounded-3xl border-2 border-white/20 bg-black shadow-2xl z-[510] overflow-hidden shadow-primary/20 ring-4 ring-black/50"
            />

            {/* Controls Bar (Floating Pill) */}
            <div className="absolute bottom-12 left-0 right-0 flex justify-center items-center z-[520]">
              <div className="flex items-center gap-4 bg-white/5 backdrop-blur-2xl px-8 py-5 rounded-[3rem] border border-white/10 shadow-2xl ring-1 ring-white/5">
                <button
                  onClick={toggleMic}
                  className={`p-4 rounded-full transition-all ${isMuted ? "bg-red-500 text-white" : "hover:bg-white/10 text-white/70"}`}
                >
                  {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                </button>

                <button
                  onClick={endCall}
                  className="p-6 rounded-full bg-red-600 text-white shadow-2xl shadow-red-600/40 hover:scale-110 active:scale-95 transition-all"
                >
                  <PhoneOff size={32} />
                </button>

                <button
                  onClick={toggleVideo}
                  className={`p-4 rounded-full transition-all ${isVideoOff ? "bg-red-500 text-white" : "hover:bg-white/10 text-white/70"}`}
                >
                  {isVideoOff ? <CameraOff size={24} /> : <Camera size={24} />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🔍 SEARCHING MODAL */}
      <AnimatePresence>
        {isSearching && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[600] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center"
          >
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6 shadow-2xl shadow-primary/20" />
            <h2 className="text-xl font-black text-white italic tracking-tighter uppercase">
              Connecting...
            </h2>
            <p className="text-primary font-bold tracking-[0.4em] uppercase text-[9px] mt-2 animate-pulse">
              Finalizing Secure Stream
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ConnectionPanel;
