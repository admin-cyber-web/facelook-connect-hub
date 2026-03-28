import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PhoneOff,
  ArrowRightLeft,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  ShieldCheck,
  Sparkles,
  Users2,
  Volume2,
  VolumeX,
} from "lucide-react";
import AgoraRTC from "agora-rtc-sdk-ng";

// --- 🔑 AGORA PRODUCTION CONFIG ---
const APP_ID = "fc434988dc0545b49355a6ace8aaadd6";
const TOKEN =
  "007eJxTYJjIdUjct3rFtRcMzWuVEyIPl1a877GUt5t4RmxKilIV9zsFhrRkE2MTSwuLlGQDUxPTJBNLY1PTRLPE5FSLxMTElBSzM9ePZzYEMjJMyzNiZmSAQBCflyENqCgnPz9btyg1MYeBAQBAhSKt";

// ⚠️ IMPORTANT: Temp Token बनाते समय जो 'Channel Name' डाला था, वही यहाँ लिखें।
const CHANNEL_NAME = "facelook-real";

const ConnectionPanel = () => {
  const [inCall, setInCall] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [remoteUser, setRemoteUser] = useState<any>(null);

  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);

  const rtc = useRef<any>({
    client: AgoraRTC.createClient({ mode: "rtc", codec: "vp8" }),
    localAudioTrack: null,
    localVideoTrack: null,
  });

  // 🛠️ ATOMIC DUAL-VIDEO SNAP (दोनों साइड वीडियो फिक्स)
  useEffect(() => {
    const playAll = async () => {
      if (inCall) {
        // Play Local (You)
        if (rtc.current.localVideoTrack && localVideoRef.current) {
          await rtc.current.localVideoTrack.play(localVideoRef.current, {
            fit: "cover",
          });
        }
        // Play Remote (Partner)
        if (remoteUser?.videoTrack && remoteVideoRef.current) {
          await remoteUser.videoTrack.play(remoteVideoRef.current, {
            fit: "cover",
          });
        }
      }
    };
    playAll();
  }, [inCall, remoteUser]);

  const startCall = async () => {
    if (!window.isSecureContext)
      return alert("Security Error: HTTPS is required!");
    setIsSearching(true);

    try {
      // Joining with New App ID and Token
      await rtc.current.client.join(APP_ID, CHANNEL_NAME, TOKEN, null);

      const [audioTrack, videoTrack] =
        await AgoraRTC.createMicrophoneAndCameraTracks();
      rtc.current.localAudioTrack = audioTrack;
      rtc.current.localVideoTrack = videoTrack;

      setInCall(true);
      setIsSearching(false);

      // Handle Remote Partner (1v1 Pair logic)
      rtc.current.client.on(
        "user-published",
        async (user: any, mediaType: string) => {
          // Strict 1v1: Ignore third person
          if (rtc.current.client.remoteUsers.length > 1) return;

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
      console.error("Agora Error:", err);
      setIsSearching(false);
      alert(
        "Connect failed: Token/AppID mismatch or Microphone permission denied.",
      );
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
    <div className="flex justify-center items-center px-4 py-8">
      {/* 🌟 SLIM PRODUCTION CARD (Images: 32x32 size look) */}
      <motion.div
        whileTap={{ scale: 0.95 }}
        onClick={startCall}
        className="glass rounded-[2rem] p-6 w-full max-w-[280px] border border-primary/40 bg-black/70 shadow-2xl cursor-pointer group relative overflow-hidden"
      >
        <div className="flex justify-between items-center mb-6 relative z-10">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 border border-primary/30">
            <Users2 size={12} className="text-primary" />
            <span className="text-[9px] font-black uppercase tracking-widest text-primary/80">
              1v1 Real Match
            </span>
          </div>
          <ShieldCheck size={16} className="text-primary/40" />
        </div>

        <div className="flex items-center justify-center gap-4 relative z-10">
          {/* HUGE SQUIRCLE IMAGES */}
          <div className="w-28 h-28 rounded-[2.5rem] rotate-[-8deg] border-2 border-primary/40 overflow-hidden shadow-2xl group-hover:rotate-0 transition-all duration-500">
            <img
              src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400"
              className="w-full h-full object-cover grayscale group-hover:grayscale-0"
              alt="u1"
            />
          </div>
          <ArrowRightLeft className="text-primary/60 animate-pulse" size={20} />
          <div className="w-28 h-28 rounded-[2.5rem] rotate-[8deg] border-2 border-secondary/40 overflow-hidden shadow-2xl group-hover:rotate-0 transition-all duration-500">
            <img
              src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400"
              className="w-full h-full object-cover grayscale group-hover:grayscale-0"
              alt="u2"
            />
          </div>
        </div>

        <div className="mt-8 text-center relative z-10">
          <p className="text-[11px] font-black tracking-[0.5em] uppercase text-primary/70 group-hover:text-primary transition-all animate-pulse">
            Find Lucky Pair
          </p>
        </div>
      </motion.div>

      {/* 📽️ FULLSCREEN CALL OVERLAY */}
      <AnimatePresence>
        {inCall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] bg-[#020202]"
          >
            {/* MAIN REMOTE STREAM */}
            <div
              ref={remoteVideoRef}
              className="w-full h-full flex items-center justify-center bg-black relative"
            >
              {!remoteUser && (
                <div className="text-center">
                  <Sparkles
                    size={60}
                    className="text-primary/20 mb-6 mx-auto animate-bounce"
                  />
                  <p className="text-[10px] font-black tracking-[0.5em] uppercase text-primary animate-pulse">
                    Searching for your lucky friend...
                  </p>
                </div>
              )}
            </div>

            {/* FLOATING LOCAL STREAM */}
            <div
              ref={localVideoRef}
              className="absolute top-10 right-5 w-32 h-48 rounded-[2.2rem] border-2 border-primary/30 bg-black shadow-2xl z-[510] overflow-hidden"
            />

            {/* CONTROLS (PRO COLORS) */}
            <div className="absolute bottom-12 left-0 right-0 flex justify-center z-[520]">
              <div className="flex items-center gap-4 bg-black/80 backdrop-blur-3xl px-6 py-4 rounded-[3.5rem] border border-primary/20 shadow-2xl">
                <button
                  onClick={() => {
                    rtc.current.localAudioTrack.setEnabled(isMuted);
                    setIsMuted(!isMuted);
                  }}
                  className={`p-4 rounded-2xl ${isMuted ? "bg-red-500 text-black" : "bg-primary/20 text-primary"}`}
                >
                  {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                </button>

                <button
                  onClick={() => {
                    if (remoteUser?.audioTrack) {
                      isSpeakerMuted
                        ? remoteUser.audioTrack.play()
                        : remoteUser.audioTrack.stop();
                      setIsSpeakerMuted(!isSpeakerMuted);
                    }
                  }}
                  className={`p-4 rounded-2xl ${isSpeakerMuted ? "bg-red-500 text-black" : "bg-primary/20 text-primary"}`}
                >
                  {isSpeakerMuted ? (
                    <VolumeX size={24} />
                  ) : (
                    <Volume2 size={24} />
                  )}
                </button>

                <button
                  onClick={endCall}
                  className="p-6 rounded-[2.2rem] bg-red-600 text-black shadow-2xl hover:scale-105 active:scale-95 transition-all"
                >
                  <PhoneOff size={32} fill="black" />
                </button>

                <button
                  onClick={() => {
                    rtc.current.localVideoTrack.setEnabled(isVideoOff);
                    setIsVideoOff(!isVideoOff);
                  }}
                  className={`p-4 rounded-2xl ${isVideoOff ? "bg-red-500 text-black" : "bg-primary/20 text-primary"}`}
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
          <div className="w-14 h-14 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6" />
          <p className="text-primary text-[10px] font-black uppercase tracking-[0.5em] animate-pulse">
            Connecting Secure Node...
          </p>
        </div>
      )}
    </div>
  );
};

export default ConnectionPanel;
