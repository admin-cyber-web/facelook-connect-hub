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

// --- 🔑 AGORA CREDENTIALS INSERTED HERE ---
const APP_ID = "fc434988dc0545b49355a6ace8aaadd6";
const TOKEN =
  "007eJxTYJjIdUjct3rFtRcMzWuVEyIPl1a877GUt5t4RmxKilIV9zsFhrRkE2MTSwuLlGQDUxPTJBNLY1PTRLPE5FSLxMTElBSzM9ePZzYEMjJMyzNiZmSAQBCflyENqCgnPz9btyg1MYeBAQBAhSKt";
const CHANNEL = "flicks-real";

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

  // 🛠️ CRITICAL FIX: Direct Playback Engine
  useEffect(() => {
    const playRemote = async () => {
      if (
        inCall &&
        remoteUser &&
        remoteUser.videoTrack &&
        remoteVideoRef.current
      ) {
        try {
          await remoteUser.videoTrack.play(remoteVideoRef.current);
          console.log("Remote video started successfully");
        } catch (err) {
          console.error("Remote playback failed, retrying...", err);
        }
      }
    };

    const playLocal = async () => {
      if (inCall && rtc.current.localVideoTrack && localVideoRef.current) {
        try {
          await rtc.current.localVideoTrack.play(localVideoRef.current);
          console.log("Local video started successfully");
        } catch (err) {
          console.error("Local playback failed", err);
        }
      }
    };

    if (inCall) {
      playLocal();
      playRemote();
    }
  }, [remoteUser, inCall, isVideoOff]);

  const startCall = async () => {
    if (!window.isSecureContext)
      return alert("Use HTTPS Mode (Open in New Tab)!");
    setIsSearching(true);

    try {
      // Joining with Credentials
      await rtc.current.client.join(APP_ID, CHANNEL, TOKEN, null);

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
          if (mediaType === "video") {
            setRemoteUser(user);
          }
          if (mediaType === "audio") {
            user.audioTrack.play();
          }
        },
      );

      rtc.current.client.on("user-left", () => endCall());

      await rtc.current.client.publish([
        rtc.current.localAudioTrack,
        rtc.current.localVideoTrack,
      ]);
    } catch (err) {
      console.error("Join error:", err);
      setIsSearching(false);
      alert("Connect failed. Check if App ID/Token/Channel matches.");
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
      {/* 🌟 SQUIRCLE CARD DESIGN */}
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
          <div className="w-24 h-24 rounded-[2.2rem] rotate-[-6deg] border-2 border-primary/40 overflow-hidden shadow-2xl group-hover:rotate-0 transition-all duration-500">
            <img
              src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300"
              className="w-full h-full object-cover grayscale group-hover:grayscale-0"
              alt="u1"
            />
          </div>
          <div className="flex flex-col items-center">
            <Zap className="text-yellow-500 animate-bounce" size={28} />
            <ArrowRightLeft className="text-primary/30" size={20} />
          </div>
          <div className="w-24 h-24 rounded-[2.2rem] rotate-[6deg] border-2 border-secondary/40 overflow-hidden shadow-2xl group-hover:rotate-0 transition-all duration-500">
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
            className="fixed inset-0 z-[500] bg-[#020202]"
          >
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_#0ea5e9_0%,transparent_70%)]" />

            {/* Remote Partner (Main View) */}
            <div
              key={remoteUser ? remoteUser.uid : "empty"}
              ref={remoteVideoRef}
              className="w-full h-full relative z-10 flex items-center justify-center"
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
                  <h2 className="text-primary font-black tracking-[0.6em] uppercase text-xs">
                    Your lucky friend is here!
                  </h2>
                </div>
              )}
            </div>

            {/* Self Video (Floating Squircle) */}
            <div
              ref={localVideoRef}
              className="absolute top-12 right-6 w-32 h-46 rounded-[2rem] border-2 border-primary/40 bg-black shadow-[0_0_40px_rgba(0,0,0,0.8)] z-[510] overflow-hidden"
            />

            {/* Controls Bar */}
            <div className="absolute bottom-10 left-0 right-0 flex justify-center items-center z-[520]">
              <div className="flex items-center gap-3 bg-black/80 backdrop-blur-2xl px-6 py-4 rounded-[3rem] border border-primary/20 shadow-2xl">
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
                  className="mx-2 p-6 rounded-[2.2rem] bg-red-600 text-black shadow-2xl hover:scale-105 active:scale-95 transition-all"
                >
                  <PhoneOff size={32} fill="black" />
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
            <div className="w-14 h-14 border-4 border-primary border-t-transparent rounded-full animate-spin mb-8 shadow-2xl shadow-primary/20" />
            <p className="text-primary font-black tracking-[0.5em] uppercase text-[10px] animate-pulse">
              Searching Lucky Friend...
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ConnectionPanel;
