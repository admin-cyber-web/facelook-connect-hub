import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Video,
  PhoneOff,
  ArrowRightLeft,
  ShieldCheck,
  User,
  Star,
} from "lucide-react";
import AgoraRTC from "agora-rtc-sdk-ng";

// --- 🔑 आपकी फाइनल Testing Mode APP ID ---
const APP_ID = "32da697dcd144f20be80fb0fd0e5392e";
const CHANNEL = "facelook_real_connection"; // इसे नहीं बदलना

const ConnectionPanel = () => {
  const [inCall, setInCall] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [remoteUid, setRemoteUid] = useState<any>(null);

  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);

  const rtc = useRef<any>({
    client: AgoraRTC.createClient({ mode: "rtc", codec: "vp8" }),
    localAudioTrack: null,
    localVideoTrack: null,
  });

  const startFinalRealCall = async () => {
    // 🛡️ SECURITY CHECK: HTTPS (Open in New Tab)
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

      // 3. Show YOUR Video (Local)
      setTimeout(() => {
        if (localVideoRef.current && rtc.current.localVideoTrack) {
          rtc.current.localVideoTrack.play(localVideoRef.current);
        }
      }, 500);

      // 4. Handle Partner Video (Remote User Joining)
      rtc.current.client.on(
        "user-published",
        async (user: any, mediaType: string) => {
          await rtc.current.client.subscribe(user, mediaType);
          if (mediaType === "video") {
            setRemoteUid(user.uid);
            setTimeout(() => {
              if (remoteVideoRef.current && user.videoTrack) {
                user.videoTrack.play(remoteVideoRef.current);
              }
            }, 500);
          }
          if (mediaType === "audio") user.audioTrack.play();
        },
      );

      rtc.current.client.on("user-unpublished", (user: any) => {
        if (user.uid === remoteUid) setRemoteUid(null);
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

  const endRealCall = async () => {
    if (rtc.current.localVideoTrack) {
      rtc.current.localVideoTrack.stop();
      rtc.current.localVideoTrack.close();
    }
    if (rtc.current.localAudioTrack) rtc.current.localAudioTrack.close();
    await rtc.current.client.leave();
    window.location.reload(); // Hard refresh to release camera for next call
  };

  return (
    <div className="px-6 py-4 space-y-6">
      {/* 🌟 FINAL HANDSHAKE DESIGN CARD */}
      <motion.div
        whileTap={{ scale: 0.96 }}
        onClick={startFinalRealCall}
        className="glass rounded-[2.5rem] p-10 border border-primary/40 bg-gradient-to-br from-primary/10 via-transparent to-primary/5 shadow-2xl cursor-pointer group relative overflow-hidden ring-4 ring-primary/5 hover:border-primary/60 transition-colors"
      >
        <div className="flex justify-between items-center mb-10 relative z-10">
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/20 border border-primary/30">
            <ShieldCheck size={16} className="text-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest text-primary">
              Global Link Secure
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-500 text-[10px] font-bold uppercase tracking-widest">
              Random Match
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-6 relative z-10">
          <div className="w-24 h-24 rounded-full border-4 border-white/20 overflow-hidden shadow-2xl relative ring-8 ring-primary/5">
            <img
              src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200"
              className="w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0 transition-all"
              alt="user1"
            />
          </div>
          <div className="flex flex-col items-center">
            <div className="p-4 rounded-full bg-white flex items-center justify-center shadow-xl rotate-[-15deg] group-hover:rotate-0 transition-transform">
              <ArrowRightLeft className="text-primary stroke-[3px]" size={28} />
            </div>
            <div className="w-14 h-[2px] bg-white/10 mt-3 rounded-full" />
          </div>
          <div className="w-24 h-24 rounded-full border-4 border-white/20 overflow-hidden shadow-2xl relative ring-8 ring-secondary/5">
            <img
              src="https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200"
              className="w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0 transition-all"
              alt="user2"
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
          <p className="text-[12px] font-black tracking-[0.5em] uppercase text-white/70 group-hover:text-primary transition-colors animate-pulse">
            Start Real-Time Video Call
          </p>
        </div>
      </motion.div>

      {/* 📽️ REAL-TIME CALL OVERLAY */}
      <AnimatePresence>
        {inCall && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="fixed inset-0 z-[500] bg-black"
          >
            {/* Main Stream (THE MATCH) */}
            <div
              ref={remoteVideoRef}
              className="w-full h-full flex items-center justify-center overflow-hidden"
            >
              {!remoteUid && (
                <div className="text-center opacity-40">
                  <Star
                    size={60}
                    className="mx-auto mb-6 text-primary animate-spin-slow"
                  />
                  <p className="text-xs font-black tracking-[0.6em] uppercase text-white animate-pulse">
                    Looking for partner...
                  </p>
                </div>
              )}
            </div>

            {/* Self Video Stream (YOU) */}
            <div
              ref={localVideoRef}
              className="absolute top-12 right-6 w-36 h-52 rounded-3xl border-2 border-white/20 bg-black shadow-2xl z-[510] overflow-hidden shadow-primary/20 ring-4 ring-black/50"
            />

            {/* Call Controls */}
            <div className="absolute bottom-16 left-0 right-0 flex justify-center z-[520]">
              <button
                onClick={endRealCall}
                className="p-7 rounded-full bg-red-600 text-white shadow-[0_0_40px_rgba(220,38,38,0.6)] active:scale-95 transition-transform"
              >
                <PhoneOff size={36} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🔍 CONNECTING SCREEN */}
      {isSearching && (
        <div className="fixed inset-0 z-[600] bg-black/98 backdrop-blur-3xl flex flex-col items-center justify-center">
          <div className="relative mb-8">
            <div className="w-24 h-24 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-2xl shadow-primary/30" />
          </div>
          <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase mb-2">
            Connecting to Agora Node...
          </h2>
          <p className="text-primary font-bold text-[10px] tracking-[0.4em] uppercase animate-pulse">
            Initializing Secure Stream
          </p>
        </div>
      )}
    </div>
  );
};

export default ConnectionPanel;
