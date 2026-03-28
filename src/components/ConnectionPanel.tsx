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
  ShieldCheck,
  Zap,
  Volume2,
  VolumeX,
  Sparkles,
} from "lucide-react";
import AgoraRTC from "agora-rtc-sdk-ng";

const APP_ID = "32da697dcd144f20be80fb0fd0e5392e";
const CHANNEL = "facelook_pro_live";

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

  // 🛠️ FIX: FORCE DUAL VIDEO PLAYBACK
  useEffect(() => {
    if (inCall) {
      if (remoteUser && remoteVideoRef.current) {
        remoteUser.videoTrack?.play(remoteVideoRef.current);
      }
      if (rtc.current.localVideoTrack && localVideoRef.current) {
        rtc.current.localVideoTrack.play(localVideoRef.current);
      }
    }
  }, [remoteUser, inCall]);

  const startCall = async () => {
    if (!window.isSecureContext) return alert("Use HTTPS Mode!");
    setIsSearching(true);

    try {
      await rtc.current.client.join(APP_ID, CHANNEL, null, null);
      const [audioTrack, videoTrack] =
        await AgoraRTC.createMicrophoneAndCameraTracks();
      rtc.current.localAudioTrack = audioTrack;
      rtc.current.localVideoTrack = videoTrack;

      setInCall(true);
      setIsSearching(false);

      rtc.current.client.on(
        "user-published",
        async (user: any, mediaType: string) => {
          await rtc.current.client.subscribe(user, mediaType);
          if (mediaType === "video") setRemoteUser(user);
          if (mediaType === "audio") user.audioTrack.play();
        },
      );

      rtc.current.client.on("user-left", () => endCall());
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
    rtc.current.localAudioTrack?.close();
    rtc.current.localVideoTrack?.close();
    await rtc.current.client.leave();
    setInCall(false);
    setRemoteUser(null);
    window.location.reload();
  };

  const toggleMic = () => {
    rtc.current.localAudioTrack.setEnabled(isMuted);
    setIsMuted(!isMuted);
  };

  const toggleVideo = () => {
    rtc.current.localVideoTrack.setEnabled(isVideoOff);
    setIsVideoOff(!isVideoOff);
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
      {/* 🌟 PREMIUM SQUIRCLE CARD */}
      <motion.div
        whileTap={{ scale: 0.97 }}
        onClick={startCall}
        className="relative overflow-hidden glass rounded-[2.5rem] p-8 border border-primary/20 bg-gradient-to-br from-primary/10 via-black/40 to-secondary/10 cursor-pointer group shadow-2xl"
      >
        <div className="flex justify-between items-center mb-10 relative z-10">
          <div className="flex items-center gap-2 bg-primary/10 px-4 py-1.5 rounded-full border border-primary/30">
            <ShieldCheck size={14} className="text-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest text-primary/80">
              Secure Node
            </span>
          </div>
          <div className="flex items-center gap-2 bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/30">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-500 font-bold text-[10px] uppercase tracking-widest">
              Live
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4 relative z-10">
          {/* Bigger Squircle Images */}
          <div className="w-24 h-24 rounded-[2rem] rotate-[-5deg] border-2 border-primary/40 overflow-hidden shadow-2xl group-hover:rotate-0 transition-transform duration-500">
            <img
              src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300"
              className="w-full h-full object-cover grayscale group-hover:grayscale-0"
              alt="u1"
            />
          </div>

          <div className="flex flex-col items-center">
            <Zap className="text-yellow-500 animate-bounce" size={28} />
            <ArrowRightLeft className="text-primary/40" size={20} />
          </div>

          <div className="w-24 h-24 rounded-[2rem] rotate-[5deg] border-2 border-secondary/40 overflow-hidden shadow-2xl group-hover:rotate-0 transition-transform duration-500">
            <img
              src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300"
              className="w-full h-full object-cover grayscale group-hover:grayscale-0"
              alt="u2"
            />
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center relative z-10">
          <p className="text-[11px] font-black tracking-[0.5em] uppercase text-primary/60 group-hover:text-primary transition-all">
            Tap to Match
          </p>
        </div>
      </motion.div>

      {/* 📽️ FULLSCREEN CALL UI */}
      <AnimatePresence>
        {inCall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] bg-[#050505]"
          >
            {/* 🌌 Animated Background Grid */}
            <div className="absolute inset-0 opacity-20 bg-[linear-gradient(to_right,#0ea5e912_1px,transparent_1px),linear-gradient(to_bottom,#0ea5e912_1px,transparent_1px)] bg-[size:30px_30px]" />

            {/* Remote Partner (Main View) */}
            <div
              ref={remoteVideoRef}
              className="w-full h-full relative z-10 flex items-center justify-center"
            >
              {!remoteUser && (
                <div className="text-center">
                  <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="mb-6 inline-block p-6 rounded-3xl bg-primary/5 border border-primary/20"
                  >
                    <Sparkles size={50} className="text-primary/40" />
                  </motion.div>
                  <h2 className="text-primary font-black tracking-[0.5em] uppercase text-xs animate-pulse">
                    Your lucky friend is here!
                  </h2>
                </div>
              )}
            </div>

            {/* Self Video (Floating) */}
            <div
              ref={localVideoRef}
              className="absolute top-12 right-6 w-32 h-48 rounded-[2.5rem] border-2 border-primary/30 bg-black shadow-2xl z-[510] overflow-hidden"
            />

            {/* Controls Bar */}
            <div className="absolute bottom-10 left-0 right-0 flex justify-center items-center z-[520]">
              <div className="flex items-center gap-3 bg-black/60 backdrop-blur-3xl px-6 py-4 rounded-[3rem] border border-primary/20">
                <button
                  onClick={toggleMic}
                  className={`p-4 rounded-2xl transition-all ${isMuted ? "bg-red-500 text-black" : "bg-primary/10 text-primary"}`}
                >
                  {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                </button>

                <button
                  onClick={toggleSpeaker}
                  className={`p-4 rounded-2xl transition-all ${isSpeakerOff ? "bg-red-500 text-black" : "bg-primary/10 text-primary"}`}
                >
                  {isSpeakerOff ? <VolumeX size={22} /> : <Volume2 size={22} />}
                </button>

                <button
                  onClick={endCall}
                  className="mx-2 p-6 rounded-[2rem] bg-red-600 text-black shadow-[0_0_30px_rgba(220,38,38,0.4)] hover:scale-105 transition-all"
                >
                  <PhoneOff size={30} fill="black" />
                </button>

                <button
                  onClick={toggleVideo}
                  className={`p-4 rounded-2xl transition-all ${isVideoOff ? "bg-red-500 text-black" : "bg-primary/10 text-primary"}`}
                >
                  {isVideoOff ? <CameraOff size={22} /> : <Camera size={22} />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🔍 SEARCHING MODAL */}
      <AnimatePresence>
        {isSearching && (
          <motion.div className="fixed inset-0 z-[600] bg-black flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mb-6" />
            <p className="text-primary font-black tracking-[0.4em] uppercase text-[10px]">
              Your lucky friend is here!
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ConnectionPanel;
