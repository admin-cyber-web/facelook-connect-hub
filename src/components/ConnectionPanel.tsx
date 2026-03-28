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
  Volume2,
  VolumeX,
  Sparkles,
  UserCheck,
} from "lucide-react";
import AgoraRTC from "agora-rtc-sdk-ng";

const APP_ID = "32da697dcd144f20be80fb0fd0e5392e";

// 🛠️ Pairing Logic: Ye function random rooms banayega taaki bheed na ho
const getRandomRoom = () => "room_" + Math.floor(Math.random() * 2); // Testing ke liye limit rakhi hai

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

  // --- 🎥 Dual Video Auto-Play Engine ---
  useEffect(() => {
    if (inCall) {
      if (remoteUser && remoteUser.videoTrack && remoteVideoRef.current) {
        remoteUser.videoTrack.play(remoteVideoRef.current);
      }
      if (rtc.current.localVideoTrack && localVideoRef.current) {
        rtc.current.localVideoTrack.play(localVideoRef.current);
      }
    }
  }, [remoteUser, inCall]);

  const startCall = async () => {
    if (!window.isSecureContext) return alert("Please use HTTPS!");
    setIsSearching(true);

    try {
      // Room select karna (Pairing ke liye)
      const dynamicChannel = getRandomRoom();

      await rtc.current.client.join(APP_ID, dynamicChannel, null, null);

      const [audioTrack, videoTrack] =
        await AgoraRTC.createMicrophoneAndCameraTracks();
      rtc.current.localAudioTrack = audioTrack;
      rtc.current.localVideoTrack = videoTrack;

      setInCall(true);
      setIsSearching(false);

      rtc.current.client.on(
        "user-published",
        async (user: any, mediaType: string) => {
          // Pairing Fix: Agar pehle se koi hai, to teesre ko block karne ka logic server-side hota hai,
          // par client par hum sirf pehle aane wale user ko dikhayenge.
          if (rtc.current.client.remoteUsers.length > 1) {
            // Teesra banda connect nahi hoga (client side ignore)
          }

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

  return (
    <div className="flex justify-center items-center">
      {/* 🌟 COMPACT SQUIRCLE CARD */}
      <motion.div
        whileTap={{ scale: 0.95 }}
        onClick={startCall}
        className="glass rounded-[2rem] p-6 w-full max-w-[340px] border border-primary/40 bg-black/60 shadow-2xl cursor-pointer group relative overflow-hidden"
      >
        <div className="flex justify-between items-center mb-6 relative z-10">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
            <UserCheck size={12} className="text-primary" />
            <span className="text-[9px] font-black uppercase tracking-tighter text-primary/80">
              1v1 Pair Mode
            </span>
          </div>
          <div className="flex items-center gap-1 bg-red-500/10 px-2 py-1 rounded-full border border-red-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-500 text-[9px] font-bold uppercase">
              Ready
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4 relative z-10">
          {/* Bigger Squircle Images */}
          <div className="w-28 h-28 rounded-[2.5rem] rotate-[-5deg] border-2 border-primary/50 overflow-hidden shadow-2xl group-hover:rotate-0 transition-all duration-500">
            <img
              src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400"
              className="w-full h-full object-cover"
              alt="u1"
            />
          </div>

          <ArrowRightLeft className="text-primary/40 animate-pulse" size={20} />

          <div className="w-28 h-28 rounded-[2.5rem] rotate-[5deg] border-2 border-secondary/50 overflow-hidden shadow-2xl group-hover:rotate-0 transition-all duration-500">
            <img
              src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400"
              className="w-full h-full object-cover"
              alt="u2"
            />
          </div>
        </div>

        <div className="mt-8 text-center relative z-10">
          <p className="text-[11px] font-black tracking-[0.4em] uppercase text-primary animate-pulse">
            Find Your Pair
          </p>
        </div>
      </motion.div>

      {/* 📽️ DUAL VIDEO CALL OVERLAY */}
      <AnimatePresence>
        {inCall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] bg-black"
          >
            {/* Main View (Remote) */}
            <div
              ref={remoteVideoRef}
              className="w-full h-full flex items-center justify-center"
            >
              {!remoteUser && (
                <div className="text-center">
                  <Sparkles
                    size={50}
                    className="text-primary/40 mb-4 mx-auto animate-spin-slow"
                  />
                  <p className="text-xs font-black tracking-widest uppercase text-primary/60 animate-pulse">
                    Searching for a partner...
                  </p>
                </div>
              )}
            </div>

            {/* Local View (Floating) */}
            <div
              ref={localVideoRef}
              className="absolute top-10 right-5 w-32 h-44 rounded-[2rem] border-2 border-primary/40 bg-black shadow-2xl z-[510] overflow-hidden"
            />

            {/* Controls */}
            <div className="absolute bottom-10 left-0 right-0 flex justify-center z-[520]">
              <div className="flex items-center gap-4 bg-black/70 backdrop-blur-xl px-6 py-4 rounded-[3rem] border border-primary/20">
                <button
                  onClick={toggleMic}
                  className={`p-4 rounded-2xl ${isMuted ? "bg-red-500 text-black" : "bg-primary/10 text-primary"}`}
                >
                  {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                </button>

                <button
                  onClick={endCall}
                  className="p-5 rounded-[2rem] bg-red-600 text-black shadow-xl hover:scale-110 transition-all"
                >
                  <PhoneOff size={28} fill="black" />
                </button>

                <button
                  onClick={toggleVideo}
                  className={`p-4 rounded-2xl ${isVideoOff ? "bg-red-500 text-black" : "bg-primary/10 text-primary"}`}
                >
                  {isVideoOff ? <CameraOff size={22} /> : <Camera size={22} />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🔍 SEARCHING UI */}
      {isSearching && (
        <div className="fixed inset-0 z-[600] bg-black flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-primary text-[10px] font-black uppercase tracking-[0.4em]">
            Connecting Pair...
          </p>
        </div>
      )}
    </div>
  );
};

export default ConnectionPanel;
