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
  Zap,
  Volume2,
  VolumeX,
  Sparkles,
} from "lucide-react";
import AgoraRTC from "agora-rtc-sdk-ng";

// --- 🔑 आपकी Testing Mode APP ID ---
const APP_ID = "32da697dcd144f20be80fb0fd0e5392e";
const CHANNEL = "facelook_real_pro_live";

const ConnectionPanel = () => {
  const [inCall, setInCall] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerOff, setIsSpeakerOff] = useState(false);
  const [remoteUser, setRemoteUser] = useState<any>(null);

  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);

  const rtc = useRef<any>({
    client: AgoraRTC.createClient({ mode: "rtc", codec: "vp8" }),
    localAudioTrack: null,
    localVideoTrack: null,
  });

  const startCall = async () => {
    // SECURITY CHECK: HTTPS (Open in New Tab)
    if (!window.isSecureContext) {
      alert(
        "⚠️ Error: For security, video call works only on HTTPS. Please click the 'Open in New Tab' icon in Replit (Top Right).",
      );
      return;
    }

    setIsSearching(true);

    try {
      // 1. Join Agora (Token is null because ID is in testing mode)
      await rtc.current.client.join(APP_ID, CHANNEL, null, null);

      // 2. Create Real Microphone and Camera Tracks
      const [audioTrack, videoTrack] =
        await AgoraRTC.createMicrophoneAndCameraTracks();
      rtc.current.localAudioTrack = audioTrack;
      rtc.current.localVideoTrack = videoTrack;

      setIsSearching(false);
      setInCall(true);

      // 3. Show YOUR Video (Local) - logic restored
      setTimeout(() => {
        if (localVideoRef.current && rtc.current.localVideoTrack) {
          rtc.current.localVideoTrack.play(localVideoRef.current);
        }
      }, 500);

      // 4. Handle Partner Video (Remote User Joining) - logic restored
      rtc.current.client.on(
        "user-published",
        async (user: any, mediaType: string) => {
          await rtc.current.client.subscribe(user, mediaType);
          if (mediaType === "video") {
            setRemoteUser(user);
            setTimeout(() => {
              if (remoteVideoRef.current && user.videoTrack) {
                user.videoTrack.play(remoteVideoRef.current);
              }
            }, 500);
          }
          if (mediaType === "audio") user.audioTrack.play();
        },
      );

      rtc.current.client.on("user-left", (user: any) => {
        endCall(); // Auto-cut if partner leaves
      });

      // 5. Publish to Agora Server (Make it Real Call!)
      await rtc.current.client.publish([
        rtc.current.localAudioTrack,
        rtc.current.localVideoTrack,
      ]);
    } catch (err: any) {
      console.error(err);
      alert("Connection Failed: " + err.message);
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
    window.location.reload(); // Hard refresh to release camera for next call
  };

  const toggleMic = () => {
    if (rtc.current.localAudioTrack) {
      rtc.current.localAudioTrack.setEnabled(isMuted);
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (rtc.current.localVideoTrack) {
      rtc.current.localVideoTrack.setEnabled(isVideoOff);
      setIsVideoOff(!isVideoOff);
    }
  };

  const toggleSpeaker = () => {
    if (remoteUser?.audioTrack) {
      isSpeakerOff
        ? remoteUser.audioTrack.play()
        : remoteUser.audioTrack.stop();
    }
    setIsSpeakerOff(!isSpeakerOff);
  };

  return (
    <div className="px-5">
      {/* 🌟 FINAL HANDSHAKE DESIGN CARD (Medium-Sized) */}
      <motion.div
        whileTap={{ scale: 0.96 }}
        onClick={startCall}
        className="glass rounded-[2.5rem] p-10 border border-primary/40 bg-gradient-to-br from-primary/10 via-black/40 to-primary/5 shadow-2xl cursor-pointer group relative overflow-hidden"
      >
        <div className="flex justify-between items-center mb-10 relative z-10">
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/20 border border-primary/30">
            <ShieldCheck size={16} className="text-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest text-primary/80">
              Global Link Secure
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-500 text-[10px] font-bold uppercase tracking-widest">
              Live Now
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-6 relative z-10">
          {/* Bigger Squircle Images */}
          <div className="w-24 h-24 rounded-[2.2rem] rotate-[-6deg] border-2 border-primary/40 overflow-hidden shadow-2xl group-hover:rotate-0 transition-all duration-500">
            <img
              src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300"
              className="w-full h-full object-cover grayscale group-hover:grayscale-0"
              alt="u1"
            />
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
          <div className="w-24 h-24 rounded-[2.2rem] rotate-[6deg] border-2 border-secondary/40 overflow-hidden shadow-2xl group-hover:rotate-0 transition-all duration-500">
            <img
              src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300"
              className="w-full h-full object-cover grayscale group-hover:grayscale-0"
              alt="u2"
            />
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center gap-3 relative z-10">
          <div className="flex gap-1.5 h-8 items-end">
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                animate={{ height: [6, 26, 6] }}
                transition={{
                  repeat: Infinity,
                  duration: 0.6,
                  delay: i * 0.08,
                }}
                className="w-1 bg-gradient-to-t from-primary to-secondary rounded-full opacity-50"
              />
            ))}
          </div>
          <p className="text-[12px] font-black tracking-[0.5em] uppercase text-primary/60 group-hover:text-primary transition-colors animate-pulse">
            Searching for lucky friend...
          </p>
        </div>
      </motion.div>

      {/* 📽️ REAL-TIME CALL OVERLAY (Logic restored, Design upgraded) */}
      <AnimatePresence>
        {inCall && (
          <motion.div
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[500] bg-[#020202]"
          >
            {/* Main Stream (THE MATCH) */}
            <div
              ref={remoteVideoRef}
              className="w-full h-full flex items-center justify-center overflow-hidden"
            >
              {!remoteUser && (
                <div className="text-center">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="mb-6 inline-block p-8 rounded-full bg-primary/5 border border-primary/10 backdrop-blur-3xl"
                  >
                    <Sparkles size={60} className="text-primary/30" />
                  </motion.div>
                  <p className="text-xs font-black tracking-[0.6em] uppercase text-primary/60 animate-pulse">
                    Connecting with lucky friend...
                  </p>
                </div>
              )}
            </div>

            {/* Self Video Stream (YOU) */}
            <div
              ref={localVideoRef}
              className="absolute top-12 right-6 w-32 h-48 rounded-[2rem] border-2 border-primary/40 bg-black shadow-[0_0_40px_rgba(0,0,0,0.8)] z-[510] overflow-hidden"
            />

            {/* Controls Bar (Floating Pill) */}
            <div className="absolute bottom-12 left-0 right-0 flex justify-center items-center z-[520]">
              <div className="flex items-center gap-4 bg-black/80 backdrop-blur-2xl px-8 py-5 rounded-[3.5rem] border border-primary/20 shadow-2xl ring-1 ring-white/5">
                <button
                  onClick={toggleMic}
                  className={`p-4 rounded-2xl transition-all ${isMuted ? "bg-red-500/80 text-black" : "bg-primary/10 text-primary"}`}
                >
                  {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                </button>

                <button
                  onClick={toggleSpeaker}
                  className={`p-4 rounded-2xl transition-all ${isSpeakerOff ? "bg-red-500/80 text-black" : "bg-primary/10 text-primary"}`}
                >
                  {isSpeakerOff ? <VolumeX size={24} /> : <Volume2 size={24} />}
                </button>

                <button
                  onClick={endCall}
                  className="mx-2 p-6 rounded-[2.2rem] bg-red-600 text-black shadow-2xl shadow-red-600/40 hover:scale-110 active:scale-95 transition-all"
                >
                  <PhoneOff size={32} fill="black" />
                </button>

                <button
                  onClick={toggleVideo}
                  className={`p-4 rounded-2xl transition-all ${isVideoOff ? "bg-red-500/80 text-black" : "bg-primary/10 text-primary"}`}
                >
                  {isVideoOff ? <CameraOff size={24} /> : <Camera size={24} />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🔍 SEARCHING MODAL */}
      {isSearching && (
        <div className="fixed inset-0 z-[600] bg-black flex flex-col items-center justify-center">
          <div className="w-14 h-14 border-4 border-primary border-t-transparent rounded-full animate-spin mb-8 shadow-2xl shadow-primary/20" />
          <p className="text-primary font-black tracking-[0.5em] uppercase text-[10px] animate-pulse">
            Searching for lucky friend...
          </p>
        </div>
      )}
    </div>
  );
};

export default ConnectionPanel;
