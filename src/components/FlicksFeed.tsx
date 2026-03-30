import React, { useState, useRef, useEffect, memo } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import {
  Heart,
  MessageCircle,
  Share2,
  Music,
  Volume2,
  VolumeX,
  Plus,
  Check,
} from "lucide-react";

// Reliable Direct MP4 Links (Pexels CDN)
const VIDEO_DATA = [
  "https://player.vimeo.com/external/370331493.sd.mp4?s=338d350efc21bc4485544400c6a0665353909787&profile_id=139&oauth2_token_id=57447761",
  "https://player.vimeo.com/external/517090025.sd.mp4?s=f024765798e947f6311e9f1a04d538676f2f9f8e&profile_id=139&oauth2_token_id=57447761",
  "https://player.vimeo.com/external/485601140.sd.mp4?s=3e54545229415494d49a466860d5b4d4f828a2b5&profile_id=139&oauth2_token_id=57447761",
  "https://player.vimeo.com/external/394939023.sd.mp4?s=734e5656111f62939c4a856f6a7597f1f83c66f7&profile_id=139&oauth2_token_id=57447761",
];

const FlickCard = memo(
  ({
    videoUrl,
    isActive,
    index,
  }: {
    videoUrl: string;
    isActive: boolean;
    index: number;
  }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isMuted, setIsMuted] = useState(true);

    // Force Play Logic
    useEffect(() => {
      if (videoRef.current) {
        if (isActive) {
          videoRef.current.currentTime = 0;
          const playPromise = videoRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch((error) =>
              console.log("Autoplay blocked:", error),
            );
          }
        } else {
          videoRef.current.pause();
        }
      }
    }, [isActive]);

    return (
      <div className="relative w-full h-full bg-black overflow-hidden">
        {/* Real Video Element - Poster added for no black screen */}
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-cover"
          loop
          muted={isMuted}
          playsInline
          autoPlay
          disablePictureInPicture
        />

        {/* UI Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60 pointer-events-none" />

        {/* Mute Button - Only UI element on top */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsMuted(!isMuted);
          }}
          className="absolute top-10 right-4 z-50 p-2 bg-white/10 backdrop-blur-md rounded-full text-white border border-white/20"
        >
          {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>

        {/* Right Sidebar Actions */}
        <div className="absolute right-4 bottom-24 flex flex-col items-center gap-6 z-40 text-white">
          <div className="relative mb-2">
            <div className="w-12 h-12 rounded-full border-2 border-white bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold">
              U{index}
            </div>
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-[#ff2d55] rounded-full p-0.5">
              <Plus size={12} />
            </div>
          </div>
          <div className="flex flex-col items-center">
            <Heart
              size={34}
              fill={isActive ? "#ff2d55" : "none"}
              className={isActive ? "text-[#ff2d55]" : ""}
            />
            <span className="text-[10px] font-bold mt-1">45.2K</span>
          </div>
          <div className="flex flex-col items-center">
            <MessageCircle size={34} />
            <span className="text-[10px] font-bold mt-1">1.2K</span>
          </div>
          <Share2 size={32} />
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="w-10 h-10 rounded-full border-4 border-zinc-800 bg-black flex items-center justify-center"
          >
            <Music size={16} />
          </motion.div>
        </div>

        {/* Bottom Text */}
        <div className="absolute bottom-8 left-4 right-20 text-white z-40">
          <h3 className="font-bold text-lg mb-1 flex items-center gap-1">
            @user_prime_{index}{" "}
            <Check size={14} className="bg-blue-500 rounded-full p-0.5" />
          </h3>
          <p className="text-sm opacity-90 line-clamp-2">
            Experience the flow with React + Framer Motion. Smooth as butter! 🚀
            #viral #coding
          </p>
        </div>
      </div>
    );
  },
);

export default function FlicksApp() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const onDragEnd = (_: any, info: PanInfo) => {
    const swipeThreshold = 80;
    if (
      info.offset.y < -swipeThreshold &&
      currentIndex < VIDEO_DATA.length - 1
    ) {
      setCurrentIndex((prev) => prev + 1);
    } else if (info.offset.y > swipeThreshold && currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  return (
    <div className="fixed inset-0 bg-black flex justify-center">
      <div className="relative w-full max-w-[450px] h-full overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            onDragEnd={onDragEnd}
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -100 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute inset-0 cursor-grab active:cursor-grabbing"
          >
            <FlickCard
              videoUrl={VIDEO_DATA[currentIndex]}
              isActive={true}
              index={currentIndex + 1}
            />
          </motion.div>
        </AnimatePresence>

        {/* Vertical Pagination Indicator */}
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-50">
          {VIDEO_DATA.map((_, i) => (
            <div
              key={i}
              className={`w-1 rounded-full transition-all duration-300 ${i === currentIndex ? "h-6 bg-white" : "h-1.5 bg-white/20"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
