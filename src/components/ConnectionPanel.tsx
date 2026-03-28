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
  Users,
} from "lucide-react";
import AgoraRTC from "agora-rtc-sdk-ng";

const APP_ID = "32da697dcd144f20be80fb0fd0e5392e";

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

  // 🛠️ DUAL VIDEO AUTO-MOUNT (दोनों तरफ वीडियो दिखाने का पक्का इलाज)
  useEffect(() => {
    let timeout: any;
    if (inCall) {
      timeout = setTimeout(() => {
        if (rtc.current.localVideoTrack && localVideoRef.current) {
          rtc.current.localVideoTrack.play(localVideoRef.current);
        }
        if (remoteUser?.videoTrack && remoteVideoRef.current) {
          remoteUser.videoTrack.play(remoteVideoRef.current);
        }
      }, 800); // 0.8s का डिले ताकि DOM तैयार हो जाए
    }
    return () => clearTimeout(timeout);
  }, [inCall, remoteUser]);

  const startCall = async () => {
    if (!window.isSecureContext) return alert("Please use HTTPS!");
    setIsSearching(true);

    try {
      // 🎲 Pairing Logic: 2-2 के जोड़े बनाने के लिए रैंडम रूम्स (1 से 10 के बीच)
      // इससे 3 लोगों का एक साथ जुड़ना बंद हो जाएगा।
      const pairRoom = "room_" + Math.floor(Math.random() * 5);

      await rtc.current.client.join(APP_ID, pairRoom, null, null);

      const [audioTrack, videoTrack] =
        await AgoraRTC.createMicrophoneAndCameraTracks();
      rtc.current.localAudioTrack = audioTrack;
      rtc.current.localVideoTrack = videoTrack;

      setInCall(true);
      setIsSearching(false);

      // पार्टनर के आने पर:
      rtc.current.client.on(
        "user-published",
        async (user: any, mediaType: string) => {
          // अगर रूम में पहले से 2 लोग हैं तो तीसरे को इग्नोर करो (1v1 Pair)
          if (rtc.current.client.remoteUsers.length > 1) return;

          await rtc.current.client.subscribe(user, mediaType);
          if (mediaType === "video") {
            setRemoteUser(user);
          }
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
    rtc.current.localAudioTrack?.stop();
    rtc.current.localAudioTrack?.close();
    rtc.current.localVideoTrack?.stop();
    rtc.current.localVideoTrack?.close();
    await rtc.current.client.leave();
    setInCall(false);
    setRemoteUser(null);
    window.location.reload(); // रिफ्रेश जरूरी है ताकि कैमरा फ्री हो जाए
  };

  return (
    <div className="flex justify-center items-center px-4">
      {/* 🌟 COMPACT CARD (Size Reduced, Images Increased) */}
      <motion.div
        whileTap={{ scale: 0.95 }}
        onClick={startCall}
        className="glass rounded-[2.5rem] p-6 w-full max-w-[320px] border border-primary/40 bg-black/60 shadow-2xl cursor-pointer group relative overflow-hidden"
      >
        <div className="flex justify-between items-center mb-6 relative z-10">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 border border-primary/40">
            <Users size={12} className="text-primary" />
            <span className="text-[9px] font-black uppercase tracking-widest text-primary/80">
              1v1 Lucky Match
            </span>
          </div>
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_#ef4444]" />
        </div>

        <div className="flex items-center justify-center gap-4 relative z-10">
          {/* BIGGER SQUIRCLE IMAGES */}
          <div className="w-28 h-28 rounded-[2.5rem] rotate-[-8deg] border-2 border-primary/50 overflow-hidden shadow-2xl group-hover:rotate-0 transition-all duration-500">
            <img
              src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400"
              className="w-full h-full object-cover"
            />
          </div>

          <ArrowRightLeft className="text-primary/50 animate-pulse" size={24} />

          <div className="w-28 h-28 rounded-[2.5rem] rotate-[8deg] border-2 border-secondary/50 overflow-hidden shadow-2xl group-hover:rotate-0 transition-all duration-500">
            <img
              src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-[11px] font-black tracking-[0.5em] uppercase text-primary/80 group-hover:text-primary animate-pulse">
            Find Lucky Pair
          </p>
        </div>
      </motion.div>

      {/* 📽️ DUAL VIDEO CALL UI */}
      <AnimatePresence>
        {inCall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] bg-black"
          >
            {/* MAIN VIEW (Remote Partner) */}
            <div
              ref={remoteVideoRef}
              className="w-full h-full flex items-center justify-center relative bg-[#050505]"
            >
              {!remoteUser && (
                <div className="text-center">
                  <Sparkles
                    size={60}
                    className="text-primary/20 mb-6 mx-auto animate-bounce"
                  />
                  <p className="text-[10px] font-black tracking-[0.6em] uppercase text-primary animate-pulse px-10">
                    Searching for your lucky friend...
                  </p>
                </div>
              )}
            </div>

            {/* SELF VIEW (Floating Squircle) */}
            <div
              ref={localVideoRef}
              className="absolute top-10 right-5 w-32 h-48 rounded-[2rem] border-2 border-primary/40 bg-black shadow-2xl z-[510] overflow-hidden"
            />

            {/* CONTROLS (Primary Colors Only) */}
            <div className="absolute bottom-10 left-0 right-0 flex justify-center z-[520]">
              <div className="flex items-center gap-4 bg-black/70 backdrop-blur-2xl px-6 py-4 rounded-[3rem] border border-primary/20 shadow-2xl">
                <button
                  onClick={() => {
                    rtc.current.localAudioTrack.setEnabled(isMuted);
                    setIsMuted(!isMuted);
                  }}
                  className={`p-4 rounded-2xl ${isMuted ? "bg-red-500 text-black" : "bg-primary/20 text-primary"}`}
                >
                  {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                </button>

                <button
                  onClick={endCall}
                  className="p-6 rounded-[2.2rem] bg-red-600 text-black shadow-xl hover:scale-105 transition-all"
                >
                  <PhoneOff size={30} fill="black" />
                </button>

                <button
                  onClick={() => {
                    rtc.current.localVideoTrack.setEnabled(isVideoOff);
                    setIsVideoOff(!isVideoOff);
                  }}
                  className={`p-4 rounded-2xl ${isVideoOff ? "bg-red-500 text-black" : "bg-primary/20 text-primary"}`}
                >
                  {isVideoOff ? <CameraOff size={22} /> : <Camera size={22} />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🔍 SEARCHING MODAL */}
      {isSearching && (
        <div className="fixed inset-0 z-[600] bg-black flex flex-col items-center justify-center px-6">
          <div className="w-14 h-14 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6" />
          <p className="text-primary text-[10px] font-black uppercase tracking-[0.5em] text-center">
            Initializing Secure Pair...
          </p>
        </div>
      )}
    </div>
  );
};

export default ConnectionPanel;
