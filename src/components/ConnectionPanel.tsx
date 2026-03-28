import React, { useState, useRef } from "react";
import {
  Video,
  MessageSquare,
  Star,
  X,
  Mic,
  Camera,
  PhoneOff,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import AgoraRTC from "agora-rtc-sdk-ng";

// --- Types ---
interface Profile {
  name: string;
  initials: string;
  img: string;
}

// --- Components ---
const ProfileCircle = ({
  profile,
  isMe = false,
}: {
  profile: Profile;
  isMe?: boolean;
}) => (
  <div className="flex flex-col items-center gap-2">
    <div
      className={`relative w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-2 ${isMe ? "border-primary" : "border-accent"} shadow-lg bg-muted`}
    >
      {profile.img ? (
        <img
          src={profile.img}
          alt={profile.name}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center font-bold text-lg bg-secondary text-white">
          {profile.initials}
        </div>
      )}
    </div>
    <span className="text-[10px] md:text-xs text-muted-foreground font-bold uppercase tracking-tighter">
      {profile.name}
    </span>
  </div>
);

const ConnectionLine = () => (
  <div className="flex items-center gap-0 flex-1 mx-1 md:mx-4">
    <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent animate-pulse" />
    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center animate-bounce">
      <Star size={14} className="text-primary fill-primary" />
    </div>
    <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent animate-pulse" />
  </div>
);

const ConnectionPanel = () => {
  const [inCall, setInCall] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const localVideoRef = useRef<HTMLDivElement>(null);

  // Agora Client Setup
  const rtc = useRef<any>({
    client: AgoraRTC.createClient({ mode: "rtc", codec: "vp8" }),
    localAudioTrack: null,
    localVideoTrack: null,
  });

  const videoProfiles: [Profile, Profile] = [
    {
      name: "Ayesha & Kabir",
      initials: "AY",
      img: "https://images.unsplash.com/photo-1622708782465-3b6bc63f82f6?w=400&q=80",
    },
    {
      name: "Zain & Sana",
      initials: "ZN",
      img: "https://images.unsplash.com/photo-1516714435131-44d6b64dc6a2?w=400&q=80",
    },
  ];

  const startCall = async () => {
    setIsSearching(true);
    setTimeout(async () => {
      try {
        rtc.current.localAudioTrack =
          await AgoraRTC.createMicrophoneAudioTrack();
        rtc.current.localVideoTrack = await AgoraRTC.createCameraVideoTrack();

        setIsSearching(false);
        setInCall(true);

        setTimeout(() => {
          if (localVideoRef.current) {
            rtc.current.localVideoTrack.play(localVideoRef.current);
          }
        }, 500);
      } catch (err) {
        console.error(err);
        alert("Camera permission denied!");
        setIsSearching(false);
      }
    }, 3000);
  };

  const endCall = () => {
    rtc.current.localAudioTrack?.close();
    rtc.current.localVideoTrack?.close();
    setInCall(false);
  };

  return (
    <div className="space-y-6 px-4 md:px-8">
      {/* --- Video Chat Section --- */}
      <motion.div
        whileTap={{ scale: 0.98 }}
        onClick={startCall}
        className="glass rounded-2xl p-5 md:p-6 cursor-pointer border border-primary/20 hover:border-primary/50 transition-all shadow-xl"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-primary/20">
            <Video size={18} className="text-primary" />
          </div>
          <span className="text-xs font-black uppercase tracking-[0.2em] text-foreground">
            Live Connect
          </span>
          <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-500 text-[10px] font-black italic uppercase">
              Match
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <ProfileCircle profile={videoProfiles[0]} />
          <ConnectionLine />
          <ProfileCircle profile={videoProfiles[1]} />
        </div>
        <p className="text-center text-[10px] font-bold text-primary uppercase tracking-widest mt-4 animate-pulse">
          Tap to connect video call
        </p>
      </motion.div>

      {/* --- Text Chat Section --- */}
      <div className="glass rounded-2xl p-5 md:p-6 border border-white/10 opacity-80">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare size={18} className="text-secondary" />
          <span className="text-xs font-bold uppercase tracking-widest text-secondary">
            Text Chat
          </span>
          <span className="ml-auto px-2.5 py-0.5 rounded-full bg-secondary/10 text-secondary text-[10px] font-semibold">
            ACTIVE
          </span>
        </div>
        <div className="flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold">
            SR
          </div>
          <ConnectionLine />
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
            AL
          </div>
        </div>
      </div>

      {/* --- Fullscreen Searching Overlay --- */}
      <AnimatePresence>
        {isSearching && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="flex items-center gap-6 mb-8">
              <div className="w-24 h-24 rounded-full border-4 border-primary bg-primary/10 flex items-center justify-center text-3xl font-black text-primary animate-pulse">
                YOU
              </div>
              <div className="text-4xl font-black italic text-foreground/20">
                VS
              </div>
              <img
                src={videoProfiles[0].img}
                className="w-24 h-24 rounded-full border-4 border-accent object-cover shadow-2xl"
              />
            </div>
            <h2 className="text-2xl font-black italic text-foreground tracking-tighter uppercase">
              Finding your match...
            </h2>
            <div className="mt-8 w-48 h-1 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="w-full h-full bg-primary"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Video Call Fullscreen --- */}
      <AnimatePresence>
        {inCall && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25 }}
            className="fixed inset-0 z-[200] bg-black"
          >
            {/* Background (Partner) */}
            <div className="w-full h-full flex items-center justify-center">
              <img
                src={videoProfiles[0].img}
                className="w-full h-full object-cover opacity-60 blur-sm scale-110"
              />
              <p className="absolute text-white/50 text-xs font-black uppercase tracking-[0.3em] animate-pulse">
                Waiting for partner...
              </p>
            </div>
            {/* My Camera Preview */}
            <div
              ref={localVideoRef}
              className="absolute top-10 right-6 w-32 h-44 rounded-2xl border-2 border-white/20 bg-gray-900 shadow-2xl z-50 overflow-hidden"
            />

            {/* Bottom Controls */}
            <div className="absolute bottom-12 left-0 right-0 flex justify-center items-center gap-6 z-[60]">
              <button className="p-4 rounded-full bg-white/10 backdrop-blur-md text-white border border-white/20">
                <Mic />
              </button>
              <button
                onClick={endCall}
                className="p-5 rounded-full bg-red-600 text-white shadow-lg active:scale-90 transition-transform"
              >
                <PhoneOff size={28} />
              </button>
              <button className="p-4 rounded-full bg-white/10 backdrop-blur-md text-white border border-white/20">
                <Camera />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ConnectionPanel;
