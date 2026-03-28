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
    <div className="px-4">
      {/* 🌟 COMPACT CARD DESIGN */}
      <motion.div
        whileTap={{ scale: 0.98 }}
        onClick={startCall}
        className="glass rounded-3xl p-6 border border-white/10 bg-gradient-to-br from-primary/5 to-transparent cursor-pointer group"
      >
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2 bg-primary/20 px-3 py-1 rounded-full border border-primary/20">
            <ShieldCheck size={12} className="text-primary" />
            <span className="text-[9px] font-black uppercase tracking-widest text-primary">
              P2P Secure
            </span>
          </div>
          <span className="text-red-500 font-bold text-[9px] animate-pulse uppercase tracking-widest">
            Live Now
          </span>
        </div>

        <div className="flex items-center justify-around gap-2">
          <div className="w-16 h-16 rounded-full border-2 border-white/10 overflow-hidden shadow-xl">
            <img
              src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200"
              className="w-full h-full object-cover"
            />
          </div>
          <ArrowRightLeft
            className="text-primary/40 group-hover:text-primary transition-colors"
            size={20}
          />
          <div className="w-16 h-16 rounded-full border-2 border-white/10 overflow-hidden shadow-xl">
            <img
              src="https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center">
          <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-white/40 group-hover:text-white transition-colors">
            Tap to Connect
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
            className="fixed inset-0 z-[500] bg-black"
          >
            {/* Remote Partner (Main View) */}
            <div
              ref={remoteVideoRef}
              className="w-full h-full flex items-center justify-center bg-zinc-900"
            >
              {!remoteUser && (
                <div className="text-center animate-pulse">
                  <Monitor size={48} className="mx-auto mb-4 text-white/10" />
                  <p className="text-white/20 text-[10px] font-black tracking-[0.5em] uppercase">
                    Waiting for partner...
                  </p>
                </div>
              )}
            </div>

            {/* Self Video (Floating) */}
            <div
              ref={localVideoRef}
              className="absolute top-10 right-4 w-28 h-40 rounded-2xl border border-white/20 bg-black shadow-2xl z-[510] overflow-hidden"
            />

            {/* Controls Bar */}
            <div className="absolute bottom-10 left-0 right-0 flex justify-center items-center gap-6 z-[520]">
              <button
                onClick={toggleMic}
                className={`p-4 rounded-full border border-white/10 backdrop-blur-md transition-all ${isMuted ? "bg-red-500 text-white" : "bg-white/10 text-white"}`}
              >
                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>

              <button
                onClick={endCall}
                className="p-6 rounded-full bg-red-600 text-white shadow-[0_0_30px_rgba(220,38,38,0.5)] active:scale-90 transition-transform"
              >
                <PhoneOff size={28} />
              </button>

              <button
                onClick={toggleVideo}
                className={`p-4 rounded-full border border-white/10 backdrop-blur-md transition-all ${isVideoOff ? "bg-red-500 text-white" : "bg-white/10 text-white"}`}
              >
                {isVideoOff ? <CameraOff size={20} /> : <Camera size={20} />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🔍 SEARCHING MODAL */}
      {isSearching && (
        <div className="fixed inset-0 z-[600] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center">
          <div className="w-14 h-14 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-white font-black tracking-widest uppercase text-[10px]">
            Securely Connecting...
          </p>
        </div>
      )}
    </div>
  );
};

export default ConnectionPanel;
