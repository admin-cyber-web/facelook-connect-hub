import React, { useState, useEffect, useRef, useCallback } from "react";
import { ReactionBar, ReactionBubbles } from "./ReactionBar";
import { useSoundEffects } from "../hooks/useSoundEffects";
import { useProfileViewer } from "../context/ProfileViewerContext";
import { motion, AnimatePresence } from "framer-motion";
import AdminDashboard from "./AdminDashboard";
import { isAdminEmail } from "../lib/adminConfig";
import { resolveMediaUrl } from "../lib/mediaUrl";
import AdsterraAd from "./AdsterraAd";
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Send,
  Paperclip,
  Music,
  Loader2,
  MessageSquare,
  UserPlus,
  UserCheck,
  Clock,
  Check,
  Users,
  Bell,
  BookOpen,
  Settings,
  LogOut,
  Archive,
  MoreVertical,
  Trash2,
  EyeOff,
  Eye,
  Volume2,
  VolumeX,
  UserX,
  LayoutGrid,
  Info,
  MapPin,
  GraduationCap,
  ArrowLeft,
  Camera,
  Plus,
  Smile,
  Mic,
  Pencil,
  Download,
  Share2,
  VideoIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

// ── Storage bucket (must match the bucket created in Supabase dashboard) ───────
const CHAT_BUCKET = "chat-images";

// ── Story media URL resolver ────────────────────────────────────────────────────
// Stories are uploaded to path "stories/<filename>" WITHIN the "stories" bucket.
// resolveMediaUrl() strips the "stories/" prefix (thinking it's the bucket name),
// which breaks the URL. This helper preserves the full path instead.
const SUPABASE_STORAGE_BASE = "https://rxwvvhvretostbiknuek.supabase.co/storage/v1/object/public";
const getStoryMediaUrl = (url: string): string => {
  if (!url || !url.trim()) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("data:")) return url;
  const cleanPath = url.startsWith("/") ? url.substring(1) : url;
  return `${SUPABASE_STORAGE_BASE}/stories/${cleanPath}`;
};

// Fired when a story <img> or <video> fails to load.
// Hides the broken element and shows a gradient + emoji on the parent container.
const onStoryMediaError = (e: React.SyntheticEvent<HTMLImageElement | HTMLVideoElement>) => {
  const el = e.currentTarget;
  el.style.display = "none";
  const parent = el.parentElement;
  if (!parent) return;
  parent.style.background = "linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#1e293b 100%)";
  if (!parent.querySelector(".story-err-fb")) {
    const fb = document.createElement("div");
    fb.className = "story-err-fb";
    fb.style.cssText =
      "position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;pointer-events:none";
    fb.innerHTML =
      '<span style="font-size:2rem">📖</span>' +
      '<span style="color:rgba(255,255,255,0.35);font-size:10px;font-weight:800;letter-spacing:2px">STORY</span>';
    parent.appendChild(fb);
  }
};

// ── Types ──────────────────────────────────────────────────────────────────────
type Theme = "whatsapp" | "water" | "nature" | "velvet";
type BottomTab = "chat" | "story" | "alert" | "menu";
type MenuPanel = "main" | "settings" | "archive" | "requests";

interface Profile {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string;
  bio?: string;
  school?: string;
  location?: string;
  last_seen?: string;
}
interface ChatContact extends Profile {
  last_message?: string;
  last_message_at?: string;
  last_media_type?: string;
  unread_count?: number;
}
interface FriendshipInfo {
  id: string;
  status: "pending" | "accepted" | "rejected";
  direction: "sent" | "received";
}
interface FriendRequest {
  id: string;
  sender_id: string;
  created_at: string;
  profile: Profile;
}
interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  media_url?: string;
  media_type?: string;
  created_at: string;
  seen_at?: string;
  reply_to_id?: string;
  reply_preview?: string;
  reactions?: Record<string, string[]>;
  is_edited?: boolean;
}
interface Story {
  id: string;
  user_id: string;
  image_url: string;
  caption?: string;
  emoji?: string;
  mood?: string;
  media_type?: string;
  is_help_request?: boolean;
  music_url?: string;
  created_at: string;
  profile?: Profile;
}
interface StoryGroup {
  user_id: string;
  profile: Profile;
  stories: Story[];
}
interface ChatSystemProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userEmail?: string;
  onLogout?: () => void;
  onUnreadCountChange?: (count: number) => void;
}

// ── Inject global keyframes once ───────────────────────────────────────────────
const STYLE_ID = "cx-keyframes";
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    @keyframes petal-fall {
      0%   { transform: translateY(-40px) rotate(0deg) scale(1);   opacity: 0.85; }
      80%  { opacity: 0.6; }
      100% { transform: translateY(110vh) rotate(600deg) scale(0.5); opacity: 0; }
    }
    @keyframes petal-sway {
      0%,100% { margin-left: 0px; }
      33%      { margin-left: 18px; }
      66%      { margin-left: -12px; }
    }
  `;
  document.head.appendChild(s);
}

// ── Theme config ───────────────────────────────────────────────────────────────
const THEME_CFG = {
  whatsapp: {
    wrap: "bg-[#075E54]",
    sidebar: "bg-[#075E54] border-[#054C44]",
    chat: "bg-[#E5DDD5]",
    topbar: "bg-[#075E54] border-[#054C44]",
    input: "bg-[#F0F0F0] border-stone-300",
    nav: "bg-[#075E54] border-[#054C44]",
    bubbleSent: "bg-[#DCF8C6] text-stone-900 shadow-sm",
    bubbleRecv: "bg-white text-stone-900 shadow-sm border border-stone-100",
    text1: "text-white",
    text2: "text-white/75",
    text3: "text-white/55",
    accent: "bg-[#25D366]",
    accentText: "text-[#25D366]",
    icon: "💬",
    label: "WhatsApp",
    divider: "border-[#054C44]",
    searchBg:
      "bg-white border-stone-200 text-stone-900 placeholder:text-stone-500",
    msgMenuBg: "bg-stone-800 border-stone-700 shadow-2xl",
    pill: "bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30",
    storyRing: "border-[#25D366]",
  },
  water: {
    wrap: "bg-gradient-to-b from-sky-950 via-blue-950 to-slate-950",
    sidebar: "bg-sky-950/95 border-sky-800/40",
    chat: "bg-gradient-to-b from-sky-900/98 to-blue-950/98",
    topbar: "bg-sky-950/90 backdrop-blur-2xl border-sky-800/30",
    input: "bg-sky-900/80 backdrop-blur-2xl border-sky-700/40",
    nav: "bg-sky-950/98 border-sky-800/40",
    bubbleSent:
      "bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg shadow-blue-900/40",
    bubbleRecv:
      "bg-white/10 backdrop-blur-md border border-white/10 text-white",
    text1: "text-white",
    text2: "text-sky-300",
    text3: "text-white/40",
    accent: "bg-sky-500",
    accentText: "text-sky-400",
    icon: "💧",
    label: "Water",
    divider: "border-sky-800/40",
    searchBg: "bg-white/5 border-white/10 text-white placeholder:text-white/25",
    msgMenuBg: "bg-slate-800 border-slate-700",
    pill: "bg-sky-500/20 text-sky-300 border border-sky-500/30",
    storyRing: "border-sky-400",
  },
  nature: {
    wrap: "bg-gradient-to-b from-stone-100 via-green-50 to-emerald-50",
    sidebar: "bg-stone-50/98 border-stone-200",
    chat: "bg-gradient-to-b from-green-50 to-emerald-50",
    topbar: "bg-white/95 backdrop-blur-2xl border-stone-200",
    input: "bg-white/95 backdrop-blur-2xl border-stone-200",
    nav: "bg-white/98 border-stone-200",
    bubbleSent: "bg-emerald-500 text-white shadow-md shadow-emerald-200",
    bubbleRecv: "bg-white text-stone-800 border border-stone-200 shadow-sm",
    text1: "text-stone-900",
    text2: "text-emerald-700",
    text3: "text-stone-400",
    accent: "bg-emerald-500",
    accentText: "text-emerald-600",
    icon: "🌿",
    label: "Nature",
    divider: "border-stone-200",
    searchBg:
      "bg-stone-100 border-stone-200 text-stone-900 placeholder:text-stone-400",
    msgMenuBg: "bg-white border-stone-200 shadow-xl",
    pill: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    storyRing: "border-emerald-400",
  },
  velvet: {
    wrap: "bg-gradient-to-b from-rose-950 via-red-950 to-slate-950",
    sidebar: "bg-rose-950/95 border-rose-800/40",
    chat: "bg-gradient-to-b from-rose-950/98 to-red-950/98",
    topbar: "bg-rose-950/90 backdrop-blur-2xl border-rose-800/30",
    input: "bg-rose-900/80 backdrop-blur-2xl border-rose-700/40",
    nav: "bg-rose-950/98 border-rose-800/40",
    bubbleSent:
      "bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-lg shadow-rose-900/50",
    bubbleRecv:
      "bg-white/10 backdrop-blur-md border border-white/10 text-white",
    text1: "text-white",
    text2: "text-rose-300",
    text3: "text-white/40",
    accent: "bg-rose-500",
    accentText: "text-rose-400",
    icon: "🌹",
    label: "Velvet",
    divider: "border-rose-800/40",
    searchBg: "bg-white/5 border-white/10 text-white placeholder:text-white/25",
    msgMenuBg: "bg-rose-900 border-rose-700",
    pill: "bg-rose-500/20 text-rose-300 border border-rose-500/30",
    storyRing: "border-rose-400",
  },
};

// ── Rose Petals (velvet theme only) ───────────────────────────────────────────
const PETAL_DATA = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  left: `${4 + ((i * 7) % 92)}%`,
  delay: `${(i * 0.7) % 9}s`,
  duration: `${7 + ((i * 1.1) % 7)}s`,
  size: 9 + ((i * 3) % 10),
  color: i % 3 === 0 ? "#f43f5e" : i % 3 === 1 ? "#fb7185" : "#fda4af",
}));

const RosePetals = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
    {PETAL_DATA.map((p) => (
      <div
        key={p.id}
        style={{
          position: "absolute",
          top: -20,
          left: p.left,
          width: p.size,
          height: p.size * 1.3,
          background: p.color,
          borderRadius: "50% 10% 50% 10%",
          opacity: 0.7,
          animation: `petal-fall ${p.duration} ${p.delay} linear infinite, petal-sway ${parseFloat(p.duration) * 0.6}s ${p.delay} ease-in-out infinite`,
          filter: "blur(0.3px)",
        }}
      />
    ))}
  </div>
);

// ── Sound ─────────────────────────────────────────────────────────────────────
const playSound = (type: "send" | "receive" | "delete") => {
  try {
    const ctx = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === "send") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } else if (type === "receive") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    } else {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(350, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch (_) {}
};

// ── Avatar ────────────────────────────────────────────────────────────────────
const Avatar = ({
  url,
  name,
  size = "md",
  online,
}: {
  url?: string;
  name?: string;
  size?: "sm" | "md" | "lg";
  online?: boolean;
}) => {
  const dim =
    size === "sm"
      ? "w-9 h-9 text-xs"
      : size === "lg"
        ? "w-14 h-14 text-xl"
        : "w-11 h-11 text-sm";
  return (
    <div className="relative shrink-0">
      {url ? (
        <img
          src={url}
          className={`${dim} rounded-full object-cover border-2 border-white/20`}
          decoding="async"
          crossOrigin="anonymous"
        />
      ) : (
        <div
          className={`${dim} rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-black`}
        >
          {name?.[0]?.toUpperCase() || "?"}
        </div>
      )}
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${online ? "bg-green-400 animate-pulse" : "bg-red-400"}`}
        />
      )}
    </div>
  );
};

// ── MediaBubble (memoized to prevent re-renders during scroll) ───────────────
const MediaBubble = React.memo(
  ({ url, type }: { url: string; type: string }) => {
    if (type.startsWith("image/")) {
      return (
        <img
          src={url}
          className="max-w-[220px] rounded-2xl object-cover cursor-pointer shadow-lg"
          onClick={() => window.open(url, "_blank")}
          decoding="async"
          crossOrigin="anonymous"
        />
      );
    }

    if (type.startsWith("video/")) {
      return (
        <video
          src={url}
          controls
          preload="metadata"
          playsInline
          className="max-w-[240px] rounded-2xl shadow-lg bg-black"
          style={{ maxHeight: 200 }}
        />
      );
    }

    if (type.startsWith("audio/")) {
      return (
        <div className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded-2xl min-w-[200px]">
          <Music size={16} className="text-blue-400 shrink-0" />
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-[10px] text-white/50 mb-0.5">
              Audio message
            </span>
            <audio
              src={url}
              controls
              className="w-full h-8"
              style={{ accentColor: "#60a5fa" }}
            />
          </div>
        </div>
      );
    }

    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="text-blue-400 underline text-xs"
      >
        Open file
      </a>
    );
  },
);

MediaBubble.displayName = "MediaBubble";
// ── Smoke Particle ────────────────────────────────────────────────────────────
const SmokeParticle = ({
  x,
  y,
  onDone,
}: {
  x: number;
  y: number;
  onDone: () => void;
}) => {
  const particles = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    angle: (i / 12) * 360,
    dist: 30 + Math.random() * 50,
    size: 6 + Math.random() * 10,
    delay: Math.random() * 0.1,
  }));
  useEffect(() => {
    const t = setTimeout(onDone, 800);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div
      className="fixed pointer-events-none z-[999]"
      style={{ left: x, top: y }}
    >
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 0.8, scale: 1 }}
          animate={{
            x: Math.cos((p.angle * Math.PI) / 180) * p.dist,
            y: Math.sin((p.angle * Math.PI) / 180) * p.dist,
            opacity: 0,
            scale: 0.2,
          }}
          transition={{ duration: 0.7, delay: p.delay, ease: "easeOut" }}
          className="absolute rounded-full bg-gray-400/60"
          style={{
            width: p.size,
            height: p.size,
            marginLeft: -p.size / 2,
            marginTop: -p.size / 2,
          }}
        />
      ))}
    </div>
  );
};

// ── Emoji Blast ───────────────────────────────────────────────────────────────
const EmojiBlast = ({
  emoji,
  onDone,
}: {
  emoji: string;
  onDone: () => void;
}) => {
  const blasts = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    x: Math.random() * window.innerWidth,
    endY: -120 - Math.random() * 300,
    size: 28 + Math.random() * 32,
    delay: Math.random() * 0.4,
    rotate: (Math.random() - 0.5) * 720,
  }));
  useEffect(() => {
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]">
      {blasts.map((b) => (
        <motion.div
          key={b.id}
          initial={{
            x: b.x,
            y: window.innerHeight,
            opacity: 1,
            rotate: 0,
            scale: 0.5,
          }}
          animate={{
            y: window.innerHeight + b.endY,
            opacity: 0,
            rotate: b.rotate,
            scale: 1.5,
          }}
          transition={{ duration: 1.4, delay: b.delay, ease: "easeOut" }}
          className="absolute text-4xl select-none"
          style={{ fontSize: b.size }}
        >
          {emoji}
        </motion.div>
      ))}
    </div>
  );
};

// ── Story mood filter map ─────────────────────────────────────────────────────
const STORY_MOOD_FILTER: Record<string, string> = {
  sad: "grayscale(80%) brightness(0.75)",
  happy: "saturate(1.4) brightness(1.05)",
  angry: "saturate(1.8) hue-rotate(330deg) brightness(0.9)",
  party: "saturate(2) contrast(1.15) brightness(1.1)",
  love: "sepia(0.4) saturate(1.6) brightness(1.05)",
  chill: "saturate(0.8) brightness(0.95) hue-rotate(200deg)",
  "vibrant-gold": "sepia(0.35) saturate(2.2) brightness(1.12) contrast(1.08)",
  cyberpunk: "saturate(2.6) hue-rotate(255deg) contrast(1.25) brightness(0.88)",
  noir: "grayscale(100%) contrast(1.45) brightness(0.88)",
  grid: "",
};

// ── Rain overlay ──────────────────────────────────────────────────────────────
const StoryRainOverlay = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
    {Array.from({ length: 20 }).map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-px bg-blue-300/40 rounded-full"
        style={{
          left: `${(i / 20) * 100}%`,
          height: `${28 + Math.random() * 44}px`,
          top: "-10%",
        }}
        animate={{ y: ["0%", "130%"], opacity: [0.7, 0] }}
        transition={{
          duration: 0.8 + Math.random() * 0.5,
          repeat: Infinity,
          delay: Math.random() * 1.4,
          ease: "linear",
        }}
      />
    ))}
  </div>
);

// ── Neon overlay ──────────────────────────────────────────────────────────────
const StoryNeonOverlay = () => (
  <motion.div
    className="absolute inset-0 pointer-events-none z-10"
    animate={{
      background: [
        "radial-gradient(circle at 30% 40%, rgba(236,72,153,0.25) 0%, transparent 60%)",
        "radial-gradient(circle at 70% 60%, rgba(99,102,241,0.25) 0%, transparent 60%)",
        "radial-gradient(circle at 50% 20%, rgba(245,158,11,0.25) 0%, transparent 60%)",
        "radial-gradient(circle at 30% 40%, rgba(236,72,153,0.25) 0%, transparent 60%)",
      ],
    }}
    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
  />
);

// ── Audio wave ────────────────────────────────────────────────────────────────
const StoryAudioWave = () => (
  <div className="flex items-center gap-1 justify-center">
    {Array.from({ length: 7 }).map((_, i) => (
      <motion.div
        key={i}
        className="w-1.5 rounded-full bg-white/80"
        animate={{ height: ["8px", `${16 + i * 4}px`, "8px"] }}
        transition={{
          duration: 0.7,
          repeat: Infinity,
          delay: i * 0.1,
          ease: "easeInOut",
        }}
      />
    ))}
  </div>
);

// ── Help sticker ──────────────────────────────────────────────────────────────
const StoryHelpSticker = () => (
  <motion.div
    className="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-5 py-2 rounded-full select-none"
    style={{ background: "linear-gradient(135deg,#f97316,#ef4444)" }}
    animate={{ scale: [1, 1.08, 1], rotate: [-2, 2, -2] }}
    transition={{ duration: 1.1, repeat: Infinity }}
  >
    <span className="text-white font-black text-base tracking-widest drop-shadow">
      🆘 MADAD
    </span>
  </motion.div>
);

// ── Progress segments ─────────────────────────────────────────────────────────
const StoryProgressBar = ({
  total,
  current,
  elapsed,
  duration,
}: {
  total: number;
  current: number;
  elapsed: number;
  duration: number;
}) => (
  <div className="flex gap-1 px-3 pt-2 z-40 relative">
    {Array.from({ length: total }).map((_, i) => (
      <div
        key={i}
        className="h-0.5 flex-1 rounded-full bg-white/30 overflow-hidden"
      >
        {i < current ? (
          <div className="h-full w-full bg-white" />
        ) : i === current ? (
          <motion.div
            className="h-full bg-white origin-left"
            style={{ scaleX: Math.min(elapsed / duration, 1) }}
          />
        ) : null}
      </div>
    ))}
  </div>
);

// ── Gradient helper ───────────────────────────────────────────────────────────
const _SGRADS = [
  "#6366f1",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
];
const _sgradFor = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h) ^ id.charCodeAt(i);
  return _SGRADS[Math.abs(h) % _SGRADS.length];
};

// ── Story Circle (group-aware) ────────────────────────────────────────────────
const StoryCircle = ({
  story,
  onClick,
}: {
  story: Story;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-1.5 shrink-0"
  >
    <div className="w-14 h-14 rounded-full p-0.5 bg-gradient-to-br from-rose-400 via-pink-500 to-red-400">
      <div className="w-full h-full rounded-full overflow-hidden border-2 border-white/10">
        {story.media_type === "voice" ? (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: _sgradFor(story.user_id) }}
          >
            <Mic size={18} className="text-white/80" />
          </div>
        ) : (
          <img
            src={getStoryMediaUrl(story.image_url)}
            className="w-full h-full object-cover"
            decoding="async"
            crossOrigin="anonymous"
            onError={onStoryMediaError}
          />
        )}
      </div>
    </div>
    <span className="text-[9px] font-black text-white/60 max-w-[52px] truncate">
      {story.profile?.full_name?.split(" ")[0] || "Story"}
    </span>
  </button>
);

// ── Story view count (shown to story owner only) ──────────────────────────────
const StoryViewCount = ({ storyId }: { storyId: string }) => {
  const [count, setCount] = React.useState<number | null>(null);
  React.useEffect(() => {
    supabase
      .from("story_views")
      .select("id", { count: "exact", head: true })
      .eq("story_id", storyId)
      .then(({ count: c }) => setCount(c ?? 0));
  }, [storyId]);
  if (count === null) return null;
  return (
    <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5 border border-white/15">
      <Eye size={13} className="text-white/80" />
      <span className="text-white text-[11px] font-bold">{count}</span>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
const ChatSystem: React.FC<ChatSystemProps> = ({
  isOpen,
  onClose,
  userId,
  userEmail = "",
  onLogout,
  onUnreadCountChange,
}) => {
  const isAdmin = isAdminEmail(userEmail);
  const { openProfile } = useProfileViewer();

  // ── Message Reactions ─────────────────────────────────────────────────────
  const fetchMsgReactions = useCallback(
    async (uid: string, otherId: string) => {
      try {
        const { data: msgData } = await supabase
          .from("messages")
          .select("id")
          .or(
            `and(sender_id.eq.${uid},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${uid})`,
          );
        const msgIdsArr = (msgData || []).map((m: any) => m.id as string);
        if (msgIdsArr.length === 0) return;
        const { data } = await supabase
          .from("message_reactions")
          .select("message_id, user_id, emoji")
          .in("message_id", msgIdsArr);
        if (!data) return;
        const map: Record<string, Record<string, string[]>> = {};
        for (const row of data) {
          if (!map[row.message_id]) map[row.message_id] = {};
          if (!map[row.message_id][row.emoji])
            map[row.message_id][row.emoji] = [];
          map[row.message_id][row.emoji].push(row.user_id);
        }
        setMsgReactions(map);
      } catch (_) {}
    },
    [],
  );

  const handleMsgReact = async (msgId: string, emoji: string) => {
    // ── Step 1: get real auth user ID directly from Supabase session ──────────
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    const reactingUserId = authUser?.id ?? userId;

    if (!reactingUserId) {
      console.error("[Reaction] ❌ No user ID — aborting");
      return;
    }
    if (!msgId || msgId.startsWith("temp-")) {
      console.warn("[Reaction] ⚠️ Skipping temp/invalid message id:", msgId);
      return;
    }

    playPop();
    setMsgReactionBarId(null);

    // ── Step 2: compute optimistic state ─────────────────────────────────────
    const prev = msgReactions[msgId] ?? {};
    const currentUsers = prev[emoji] ?? [];
    const alreadyReacted = currentUsers.includes(reactingUserId);

    const updated: Record<string, string[]> = { ...prev };
    if (alreadyReacted) {
      updated[emoji] = currentUsers.filter((u) => u !== reactingUserId);
      if (updated[emoji].length === 0) delete updated[emoji];
    } else {
      // one reaction per user — remove any previous emoji first
      Object.keys(updated).forEach((e) => {
        updated[e] = updated[e].filter((u) => u !== reactingUserId);
        if (updated[e].length === 0) delete updated[e];
      });
      updated[emoji] = [...(updated[emoji] ?? []), reactingUserId];
    }

    // ── Step 3: apply optimistic UI immediately ───────────────────────────────
    setMsgReactions((r) => ({ ...r, [msgId]: updated }));

    // ── Step 4: write to DB with full error logging ───────────────────────────
    try {
      if (alreadyReacted) {
        const { error } = await supabase
          .from("message_reactions")
          .delete()
          .eq("message_id", msgId)
          .eq("user_id", reactingUserId);
        if (error) throw error;
      } else {
        // First delete any existing reaction from this user on this message
        await supabase
          .from("message_reactions")
          .delete()
          .eq("message_id", msgId)
          .eq("user_id", reactingUserId);

        const { error } = await supabase
          .from("message_reactions")
          .insert({ message_id: msgId, user_id: reactingUserId, emoji });
        if (error) throw error;
      }
    } catch (err: any) {
      console.error(
        "[Reaction] ❌ DB error — rolling back optimistic UI:",
        err,
      );
      // Rollback optimistic update on failure
      setMsgReactions((r) => ({ ...r, [msgId]: prev }));
      return;
    }

    // ── Step 5: re-fetch to sync both users (after successful DB write) ───────
    if (selectedUser) await fetchMsgReactions(reactingUserId, selectedUser.id);
  };

  useEffect(() => {
    injectStyles();
  }, []);

  // ── Persisted state ───────────────────────────────────────────────────────
  const [theme, setTheme] = useState<Theme>(() => {
    const s = localStorage.getItem("cx_theme") as Theme;
    return s === "whatsapp" || s === "water" || s === "nature" || s === "velvet"
      ? s
      : "whatsapp";
  });
  const [activeStatus, setActiveStatus] = useState(
    () => localStorage.getItem("cx_active_status") !== "false",
  );
  const [soundEnabled, setSoundEnabled] = useState(
    () => localStorage.getItem("cx_sound") !== "false",
  );
  const [mutedChats, setMutedChats] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem("cx_muted") || "[]"));
    } catch {
      return new Set();
    }
  });
  const [archivedChats, setArchivedChats] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem("cx_archived") || "[]"));
    } catch {
      return new Set();
    }
  });

  // ── Online users via Supabase Presence ────────────────────────────────────
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null,
  );

  // ── Navigation ────────────────────────────────────────────────────────────
  const [bottomTab, setBottomTab] = useState<BottomTab>("chat");
  const [menuPanel, setMenuPanel] = useState<MenuPanel>("main");

  // ── Friendship ────────────────────────────────────────────────────────────
  const [friendshipMap, setFriendshipMap] = useState<
    Map<string, FriendshipInfo>
  >(new Map());
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [unseenMsgCount, setUnseenMsgCount] = useState(0);
  const [actionLoading, setActionLoading] = useState("");
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [messageRequests, setMessageRequests] = useState<ChatContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());
  // Mirror of blockedUserIds — read by callbacks without adding the state to
  // their deps (otherwise fetchContacts → setBlockedUserIds → fetchStories
  // identity changes → bootstrap effect re-runs → infinite loop & flicker).
  const blockedUserIdsRef = useRef<Set<string>>(new Set());
  const deletedForMeIdsRef = useRef<Set<string>>(new Set());

  // ── Search ────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // ── Active chat ───────────────────────────────────────────────────────────
  const [selectedUser, setSelectedUser] = useState<ChatContact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingFilePreview, setPendingFilePreview] = useState<string | null>(
    null,
  );
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [msgMenuId, setMsgMenuId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);

  // ── Fun ───────────────────────────────────────────────────────────────────
  const [smokeParticles, setSmokeParticles] = useState<
    { id: number; x: number; y: number }[]
  >([]);
  const [emojiBlast, setEmojiBlast] = useState<{
    id: number;
    emoji: string;
  } | null>(null);
  const [showEmojiGrid, setShowEmojiGrid] = useState(false);
  const [showInputEmoji, setShowInputEmoji] = useState(false);
  const smokeIdRef = useRef(0);
  const blastIdRef = useRef(0);

  // ── Profile ───────────────────────────────────────────────────────────────
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [editBio, setEditBio] = useState("");
  const [editSchool, setEditSchool] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // ── Alerts ────────────────────────────────────────────────────────────────
  const [alerts, setAlerts] = useState<
    { id: string; text: string; time: string; read: boolean }[]
  >([]);

  // ── Stories ───────────────────────────────────────────────────────────────
  const [stories, setStories] = useState<Story[]>([]);
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [loadingStories, setLoadingStories] = useState(false);
  const [showStoryEditor, setShowStoryEditor] = useState(false);
  const [storyFile, setStoryFile] = useState<File | null>(null);
  const [storyFiles, setStoryFiles] = useState<File[]>([]);
  const [storyPreviews, setStoryPreviews] = useState<string[]>([]);
  const [storyPreviewUrl, setStoryPreviewUrl] = useState("");
  const [storyCaption, setStoryCaption] = useState("");
  const [storyEmoji, setStoryEmoji] = useState("");
  const [storyMood, setStoryMood] = useState("");
  const [storyIsHelp, setStoryIsHelp] = useState(false);
  const [storyUploadProgress, setStoryUploadProgress] = useState(0);
  const [uploadingStory, setUploadingStory] = useState(false);
  const [viewingStory, setViewingStory] = useState<Story | null>(null);
  const [viewerGroupIdx, setViewerGroupIdx] = useState(0);
  const [viewerStoryIdx, setViewerStoryIdx] = useState(0);
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const [deletingStory, setDeletingStory] = useState(false);
  const storyInputRef = useRef<HTMLInputElement>(null);
  const storyAudioRef = useRef<HTMLAudioElement | null>(null);
  const storyTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [storyElapsed, setStoryElapsed] = useState(0);
  const [storyPaused, setStoryPaused] = useState(false);
  const storyViewedRef = useRef<Set<string>>(new Set());
  const [selectedMusic, setSelectedMusic] = useState<File | null>(null);
  const [selectedMusicName, setSelectedMusicName] = useState<string>("");
  const musicInputRef = useRef<HTMLInputElement>(null);
  const [muteStoryVideo, setMuteStoryVideo] = useState(false);
  const [viewerEditing, setViewerEditing] = useState(false);
  const [viewerEditCaption, setViewerEditCaption] = useState("");
  const [viewerEditMood, setViewerEditMood] = useState("");
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);

  // ── Advanced features state ────────────────────────────────────────────────
  const [panicMode, setPanicMode] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [deletingForMe, setDeletingForMe] = useState<string | null>(null);
  const [msgReactionBarId, setMsgReactionBarId] = useState<string | null>(null);
  const [msgReactions, setMsgReactions] = useState<
    Record<string, Record<string, string[]>>
  >({});
  const [chatMsgAction, setChatMsgAction] = useState<{
    msg: Message;
    x: number;
    y: number;
  } | null>(null);
  const [editingMsg, setEditingMsg] = useState<{
    id: string;
    text: string;
  } | null>(null);

  // ── Voice Mode state ───────────────────────────────────────────────────────
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceSecondsLeft, setVoiceSecondsLeft] = useState(300);
  const [voiceStatus, setVoiceStatus] = useState<"listening" | "processing">(
    "listening",
  );

  // ── Refs ──────────────────────────────────────────────────────────────────
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevMsgCount = useRef(0);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null,
  );
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panicClickRef = useRef<{
    count: number;
    timer: ReturnType<typeof setTimeout> | null;
  }>({ count: 0, timer: null });
  const recognitionRef = useRef<any>(null);
  const voiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceActiveRef = useRef(false);
  const pendingFileRef = useRef<File | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressMsgPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const T = THEME_CFG[theme];
  const { playPop, playSwoosh } = useSoundEffects();

  // ── Persist ───────────────────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem("cx_theme", theme);
  }, [theme]);
  useEffect(() => {
    localStorage.setItem("cx_active_status", String(activeStatus));
  }, [activeStatus]);
  useEffect(() => {
    localStorage.setItem("cx_sound", String(soundEnabled));
  }, [soundEnabled]);
  useEffect(() => {
    localStorage.setItem("cx_muted", JSON.stringify([...mutedChats]));
  }, [mutedChats]);
  useEffect(() => {
    localStorage.setItem("cx_archived", JSON.stringify([...archivedChats]));
  }, [archivedChats]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    if (messages.length > prevMsgCount.current) {
      const last = messages[messages.length - 1];
      if (last?.sender_id !== userId && soundEnabled) playSound("receive");
    }
    prevMsgCount.current = messages.length;
  }, [messages, userId, soundEnabled]);

  // ── Fetch my profile ──────────────────────────────────────────────────────
  const fetchMyProfile = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url, bio, school, location")
      .eq("id", userId)
      .single();
    if (data) {
      setMyProfile(data as Profile);
      setEditBio(data.bio || "");
      setEditSchool(data.school || "");
      setEditLocation(data.location || "");
    }
  }, [userId]);

  // ── Fetch friendships ─────────────────────────────────────────────────────
  const fetchFriendships = useCallback(async () => {
    const { data } = await supabase
      .from("friendships")
      .select("id, sender_id, receiver_id, status")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
    if (!data) return;
    const map = new Map<string, FriendshipInfo>();
    for (const row of data) {
      const otherId =
        row.sender_id === userId ? row.receiver_id : row.sender_id;
      map.set(otherId, {
        id: row.id,
        status: row.status,
        direction: row.sender_id === userId ? "sent" : "received",
      });
    }
    setFriendshipMap(map);
  }, [userId]);

  // ── Fetch pending requests ────────────────────────────────────────────────
  const fetchPendingRequests = useCallback(async () => {
    const { data } = await supabase
      .from("friendships")
      .select("id, sender_id, created_at")
      .eq("receiver_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (!data || data.length === 0) {
      setPendingRequests([]);
      setPendingCount(0);
      return;
    }
    const senderIds = data.map((r) => r.sender_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url")
      .in("id", senderIds);
    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
    const reqs: FriendRequest[] = data.map((r) => ({
      id: r.id,
      sender_id: r.sender_id,
      created_at: r.created_at,
      profile: profileMap.get(r.sender_id) || {
        id: r.sender_id,
        full_name: "Unknown",
        username: "",
        avatar_url: "",
      },
    }));
    setPendingRequests(reqs);
    setPendingCount(reqs.length);
    if (reqs.length > 0) {
      setAlerts((prev) => {
        const newAlerts = reqs
          .filter((r) => !prev.find((a) => a.id === `req-${r.id}`))
          .map((r) => ({
            id: `req-${r.id}`,
            text: `${r.profile.full_name} sent you a friend request`,
            time: new Date(r.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            read: false,
          }));
        return [...newAlerts, ...prev].slice(0, 50);
      });
    }
  }, [userId]);

  // ── Fetch contacts ────────────────────────────────────────────────────────
  const fetchContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      // 1. Friends list
      const { data: friendRows } = await supabase
        .from("friendships")
        .select("sender_id, receiver_id")
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .eq("status", "accepted");
      const friendIds = (friendRows || []).map((r) =>
        r.sender_id === userId ? r.receiver_id : r.sender_id,
      );
      const friendIdSet = new Set(friendIds);

      // 2. Block lists (both directions — hide blockers and blocked)
      const { data: blockRows } = await supabase
        .from("user_blocks")
        .select("blocker_id, blocked_id")
        .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
      const blockedSet = new Set<string>();
      for (const b of blockRows || []) {
        if (b.blocker_id === userId) blockedSet.add(b.blocked_id);
        if (b.blocked_id === userId) blockedSet.add(b.blocker_id);
      }
      blockedUserIdsRef.current = blockedSet;
      // Only push a new state object when the membership actually changed,
      // otherwise React will see a brand new Set and re-render everything.
      setBlockedUserIds((prev) => {
        if (prev.size === blockedSet.size) {
          let same = true;
          for (const id of blockedSet) {
            if (!prev.has(id)) {
              same = false;
              break;
            }
          }
          if (same) return prev;
        }
        return blockedSet;
      });

      // 3. Every message conversation (last message per partner)
      const { data: msgs } = await supabase
        .from("messages")
        .select("sender_id, receiver_id, content, media_type, created_at")
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order("created_at", { ascending: false });

      const contactMap = new Map<
        string,
        {
          last_message: string;
          last_message_at: string;
          last_media_type?: string;
        }
      >();
      const partnerIds = new Set<string>();
      for (const msg of msgs || []) {
        const otherId =
          msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
        if (!otherId || blockedSet.has(otherId)) continue;
        partnerIds.add(otherId);
        if (!contactMap.has(otherId)) {
          contactMap.set(otherId, {
            last_message: msg.content || "",
            last_message_at: msg.created_at,
            last_media_type: msg.media_type,
          });
        }
      }

      // 4. Per-sender unread count
      const { data: unreadRows } = await supabase
        .from("messages")
        .select("sender_id")
        .eq("receiver_id", userId)
        .is("seen_at", null);
      const unreadMap = new Map<string, number>();
      for (const row of unreadRows || []) {
        if (blockedSet.has(row.sender_id)) continue;
        unreadMap.set(row.sender_id, (unreadMap.get(row.sender_id) || 0) + 1);
      }

      // 5. Resolve every profile we need (friends + chat partners)
      const allIds = new Set<string>([...friendIds, ...partnerIds]);
      [...allIds].forEach((id) => {
        if (blockedSet.has(id)) allIds.delete(id);
      });
      let profiles: any[] = [];
      if (allIds.size > 0) {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, username, avatar_url, last_seen")
          .in("id", [...allIds]);
        profiles = data || [];
      }

      const friendsResult: ChatContact[] = [];
      const requestsResult: ChatContact[] = [];
      for (const p of profiles) {
        if (blockedSet.has(p.id)) continue;
        const c: ChatContact = {
          id: p.id,
          full_name: p.full_name || p.username || "Unknown",
          username: p.username || "",
          avatar_url: p.avatar_url || "",
          ...(contactMap.get(p.id) || {}),
          unread_count: unreadMap.get(p.id) || 0,
        };
        if (friendIdSet.has(p.id)) {
          friendsResult.push(c);
        } else if (partnerIds.has(p.id)) {
          // Non-friend you've exchanged messages with → message request
          requestsResult.push(c);
        }
      }
      const byRecency = (a: ChatContact, b: ChatContact) =>
        (b.last_message_at || "") > (a.last_message_at || "") ? 1 : -1;
      friendsResult.sort(byRecency);
      requestsResult.sort(byRecency);
      setContacts(friendsResult);
      setMessageRequests(requestsResult);
    } finally {
      setLoadingContacts(false);
    }
  }, [userId]);

  // ── Fetch stories ─────────────────────────────────────────────────────────
  const fetchStories = useCallback(async () => {
    setLoadingStories(true);
    try {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("stories")
        .select(
          "id, user_id, image_url, caption, emoji, mood, media_type, is_help_request, music_url, created_at, profiles(id, full_name, username, avatar_url)",
        )
        .gte("created_at", cutoff)
        .order("created_at", { ascending: true })
        .limit(100);
      if (data) {
        const blocked = blockedUserIdsRef.current;
        const mapped: Story[] = data
          .map((s: any) => ({
            ...s,
            profile: Array.isArray(s.profiles) ? s.profiles[0] : s.profiles,
          }))
          .filter((s: Story) => !blocked.has(s.user_id));
        setStories(mapped);
        // Build groups keyed by user_id
        const map = new Map<string, StoryGroup>();
        for (const s of mapped) {
          if (!map.has(s.user_id)) {
            map.set(s.user_id, {
              user_id: s.user_id,
              profile: s.profile as Profile,
              stories: [],
            });
          }
          map.get(s.user_id)!.stories.push(s);
        }
        setStoryGroups(Array.from(map.values()));
      }
    } catch (_) {
      setStories([]);
      setStoryGroups([]);
    } finally {
      setLoadingStories(false);
    }
  }, []);

  // ── Upload stories (batch multi-file) ────────────────────────────────────
  const uploadStory = async () => {
    const filesToUpload =
      storyFiles.length > 0 ? storyFiles : storyFile ? [storyFile] : [];
    if (filesToUpload.length === 0) return;
    setUploadingStory(true);
    setStoryUploadProgress(0);

    // ── Upload background music first (if selected) ──────────────────────────
    let musicPublicUrl: string | null = null;
    if (selectedMusic) {
      try {
        const mExt = selectedMusic.name.split(".").pop() || "mp3";
        const mName = `stories/music-${userId}-${Date.now()}.${mExt}`;
        const { error: mErr } = await supabase.storage
          .from("avatars")
          .upload(mName, selectedMusic, { upsert: true });
        if (!mErr) {
          const { data: mUrl } = supabase.storage
            .from("avatars")
            .getPublicUrl(mName);
          musicPublicUrl = mUrl.publicUrl;
        }
      } catch (_) {}
    }

    let done = 0;
    for (const file of filesToUpload) {
      try {
        const ext = file.name.split(".").pop() || "jpg";
        const fileName = `stories/${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("stories")
          .upload(fileName, file, { upsert: true });
        if (upErr) throw upErr;
        const { error: dbErr } = await supabase.from("stories").insert({
          user_id: userId,
          image_url: fileName,
          caption: storyCaption || null,
          emoji: storyEmoji || null,
          mood: storyMood || null,
          is_help_request: storyIsHelp || null,
          media_type: file.type.startsWith("audio/")
            ? "voice"
            : file.type.startsWith("video/")
              ? "video"
              : "image",
          music_url: musicPublicUrl || null,
        });
        if (dbErr) {
          console.error("[ChatSystem upload] DB insert failed:", dbErr.message);
          toast.error("Story save failed: " + dbErr.message);
          setUploadingStory(false);
          return;
        }
      } catch (e: any) {
        const msg = e?.message || "";
        if (msg.includes("does not exist") || msg.includes("relation")) {
          toast.error(
            "Stories table missing. Run the stories SQL setup first.",
          );
        } else if (msg.includes("storage") || msg.includes("bucket")) {
          toast.error(
            "Storage bucket error. Check Supabase storage permissions.",
          );
        } else if (msg.includes("row-level") || msg.includes("policy")) {
          toast.error("Permission denied. Check Supabase RLS policies.");
        } else {
          console.warn("[uploadStory]", msg);
        }
      }
      done++;
      setStoryUploadProgress(Math.round((done / filesToUpload.length) * 100));
    }
    toast.success(
      filesToUpload.length > 1
        ? `${filesToUpload.length} stories posted! 🌟`
        : "Story posted! 🌹",
    );
    setShowStoryEditor(false);
    setStoryFile(null);
    setStoryFiles([]);
    setStoryPreviews([]);
    setStoryPreviewUrl("");
    setStoryCaption("");
    setStoryEmoji("");
    setStoryMood("");
    setStoryIsHelp(false);
    setStoryUploadProgress(0);
    setSelectedMusic(null);
    setSelectedMusicName("");
    setMuteStoryVideo(false);
    fetchStories();
    setUploadingStory(false);
  };

  // ── Delete story ───────────────────────────────────────────────────────────
  const deleteStory = async (story: Story) => {
    setDeletingStory(true);
    try {
      const { error } = await supabase
        .from("stories")
        .delete()
        .eq("id", story.id)
        .eq("user_id", userId);
      if (error) throw error;
      setStories((prev) => prev.filter((s) => s.id !== story.id));
      setViewingStory(null);
      toast.success("Story deleted ✓");
    } catch (e: any) {
      toast.error("Could not delete story: " + (e?.message || "Unknown error"));
    } finally {
      setDeletingStory(false);
    }
  };

  // ── Delete story from viewer ───────────────────────────────────────────────
  const deleteViewerStory = async () => {
    const group = storyGroups[viewerGroupIdx];
    const story = group?.stories[viewerStoryIdx];
    if (!story) return;
    const { error } = await supabase
      .from("stories")
      .delete()
      .eq("id", story.id)
      .eq("user_id", userId);
    if (error) {
      toast.error("Could not delete story");
      return;
    }
    toast.success("Story deleted ✓");
    // Rebuild storyGroups without this story
    const newGroups = storyGroups
      .map((g, gi) =>
        gi === viewerGroupIdx
          ? {
              ...g,
              stories: g.stories.filter((_, si) => si !== viewerStoryIdx),
            }
          : g,
      )
      .filter((g) => g.stories.length > 0);
    setStoryGroups(newGroups);
    if (newGroups.length === 0) {
      setStoryViewerOpen(false);
      setViewingStory(null);
      return;
    }
    const newGroupIdx = Math.min(viewerGroupIdx, newGroups.length - 1);
    const newStoryIdx = Math.min(
      viewerStoryIdx,
      newGroups[newGroupIdx].stories.length - 1,
    );
    setViewerGroupIdx(newGroupIdx);
    setViewerStoryIdx(newStoryIdx);
    setStoryElapsed(0);
  };

  // ── Save caption/mood edit from viewer ────────────────────────────────────
  const saveViewerEdit = async () => {
    const group = storyGroups[viewerGroupIdx];
    const story = group?.stories[viewerStoryIdx];
    if (!story) return;
    const { error } = await supabase
      .from("stories")
      .update({ caption: viewerEditCaption, mood: viewerEditMood || null })
      .eq("id", story.id)
      .eq("user_id", userId);
    if (error) {
      toast.error("Could not save changes");
      return;
    }
    // Update local state
    const newGroups = storyGroups.map((g, gi) =>
      gi === viewerGroupIdx
        ? {
            ...g,
            stories: g.stories.map((s, si) =>
              si === viewerStoryIdx
                ? {
                    ...s,
                    caption: viewerEditCaption,
                    mood: viewerEditMood || null,
                  }
                : s,
            ),
          }
        : g,
    );
    setStoryGroups(newGroups);
    setViewerEditing(false);
    toast.success("Story updated ✨");
  };

  // ── Update story (caption + emoji only) ───────────────────────────────────
  const updateStory = async () => {
    if (!editingStory) return;
    setUploadingStory(true);
    try {
      const { error } = await supabase
        .from("stories")
        .update({ caption: storyCaption, emoji: storyEmoji })
        .eq("id", editingStory.id)
        .eq("user_id", userId);
      if (error) throw error;
      setStories((prev) =>
        prev.map((s) =>
          s.id === editingStory.id
            ? { ...s, caption: storyCaption, emoji: storyEmoji }
            : s,
        ),
      );
      toast.success("Story updated ✨");
      setShowStoryEditor(false);
      setEditingStory(null);
      setStoryCaption("");
      setStoryEmoji("");
      setStoryPreviewUrl("");
      setStoryFile(null);
    } catch (e: any) {
      toast.error("Update failed: " + (e?.message || "Unknown error"));
    } finally {
      setUploadingStory(false);
    }
  };

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    fetchFriendships();
    fetchPendingRequests();
    fetchContacts();
    fetchMyProfile();
    fetchStories();
  }, [
    isOpen,
    fetchFriendships,
    fetchPendingRequests,
    fetchContacts,
    fetchMyProfile,
    fetchStories,
  ]);

  // ── External "Open chat with this user" trigger (from UserProfileModal) ──
  // Bind once per session — read latest state via refs to avoid re-binding
  // (and re-rendering) on every contacts/blocks change, which was causing
  // the contact list to flicker.
  const contactsRef = useRef<ChatContact[]>([]);
  const messageRequestsRef = useRef<ChatContact[]>([]);
  // mutedChatsRef: stable ref so the alerts channel doesn't teardown on every
  // contacts-fetch (removing contacts/mutedChats from the dep array below)
  const mutedChatsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    contactsRef.current = contacts;
  }, [contacts]);
  useEffect(() => {
    messageRequestsRef.current = messageRequests;
  }, [messageRequests]);
  useEffect(() => {
    mutedChatsRef.current = mutedChats;
  }, [mutedChats]);

  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (
        e as CustomEvent<{
          userId: string;
          full_name?: string;
          avatar_url?: string;
        }>
      ).detail;
      if (!detail?.userId || detail.userId === userId) return;

      // Refresh contacts so block list / requests are current
      await fetchContacts();

      const existing =
        contactsRef.current.find((c) => c.id === detail.userId) ||
        messageRequestsRef.current.find((c) => c.id === detail.userId);
      const stub: ChatContact = existing || {
        id: detail.userId,
        full_name: detail.full_name || "User",
        username: "",
        avatar_url: detail.avatar_url || "",
        unread_count: 0,
      };
      handleSelectContact(stub);
    };
    window.addEventListener("flicks:open-chat", handler as EventListener);
    return () =>
      window.removeEventListener("flicks:open-chat", handler as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, fetchContacts]);

  // ── Story viewer: 15s countdown timer ────────────────────────────────────
  useEffect(() => {
    if (!storyViewerOpen || storyPaused || storyGroups.length === 0) return;
    storyTimerRef.current = setInterval(() => {
      setStoryElapsed((e) => {
        if (e + 0.1 >= 15) {
          // advance to next story
          const group = storyGroups[viewerGroupIdx];
          const totalInGroup = group?.stories.length ?? 0;
          if (viewerStoryIdx + 1 < totalInGroup) {
            setViewerStoryIdx((i) => i + 1);
          } else if (viewerGroupIdx + 1 < storyGroups.length) {
            setViewerGroupIdx((g) => g + 1);
            setViewerStoryIdx(0);
          } else {
            setStoryViewerOpen(false);
            setViewingStory(null);
          }
          return 0;
        }
        return e + 0.1;
      });
    }, 100);
    return () => {
      if (storyTimerRef.current) clearInterval(storyTimerRef.current);
    };
  }, [
    storyViewerOpen,
    storyPaused,
    viewerGroupIdx,
    viewerStoryIdx,
    storyGroups,
  ]);

  // ── Story viewer: reset elapsed on story change ───────────────────────────
  useEffect(() => {
    setStoryElapsed(0);
  }, [viewerGroupIdx, viewerStoryIdx]);

  // ── Story viewer: music autoplay (with full cleanup) ─────────────────────
  useEffect(() => {
    const stopAudio = () => {
      if (storyAudioRef.current) {
        storyAudioRef.current.pause();
        storyAudioRef.current.src = "";
        storyAudioRef.current.load();
        storyAudioRef.current = null;
      }
    };
    if (!storyViewerOpen) {
      stopAudio();
      return;
    }
    const group = storyGroups[viewerGroupIdx];
    const story = group?.stories[viewerStoryIdx];
    stopAudio();
    if (story?.music_url) {
      const audio = new Audio(story.music_url);
      audio.volume = 0.4;
      audio.loop = true;
      audio.play().catch(() => {});
      storyAudioRef.current = audio;
    }
    return stopAudio;
  }, [storyViewerOpen, viewerGroupIdx, viewerStoryIdx, storyGroups]);

  // ── Story viewer: view tracking ───────────────────────────────────────────
  useEffect(() => {
    if (!storyViewerOpen) return;
    const group = storyGroups[viewerGroupIdx];
    const story = group?.stories[viewerStoryIdx];
    if (!story || storyViewedRef.current.has(story.id)) return;
    storyViewedRef.current.add(story.id);
    supabase
      .from("story_views")
      .insert({ story_id: story.id, viewer_id: userId })
      .then(() => {});
  }, [storyViewerOpen, viewerGroupIdx, viewerStoryIdx, storyGroups, userId]);

  // ── Presence: track who's actually online ─────────────────────────────────
  useEffect(() => {
    if (!isOpen || !userId) return;
    const ch = supabase.channel("cx-presence", {
      config: { presence: { key: userId } },
    });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState<{ user_id: string }>();
      const ids = new Set<string>();
      Object.values(state)
        .flat()
        .forEach((p: any) => {
          if (p.user_id) ids.add(p.user_id);
        });
      setOnlineUsers(ids);
    }).subscribe(async (status) => {
      if (status === "SUBSCRIBED" && activeStatus) {
        await ch.track({ user_id: userId });
      }
    });
    presenceChannelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      presenceChannelRef.current = null;
    };
  }, [isOpen, userId]);

  // ── When activeStatus toggles, update presence tracking ───────────────────
  useEffect(() => {
    const ch = presenceChannelRef.current;
    if (!ch) return;
    if (activeStatus) {
      ch.track({ user_id: userId });
    } else {
      ch.untrack();
    }
  }, [activeStatus, userId]);

  // ── Realtime: friendships ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const ch = supabase
      .channel(`friendships-rt-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "friendships" },
        (p) => {
          const row = p.new as any;
          if (row.receiver_id === userId || row.sender_id === userId) {
            fetchFriendships();
            if (row.receiver_id === userId && row.status === "pending")
              fetchPendingRequests();
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "friendships" },
        (p) => {
          const row = p.new as any;
          if (row.receiver_id === userId || row.sender_id === userId) {
            fetchFriendships();
            fetchPendingRequests();
            if (row.status === "accepted") fetchContacts();
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [isOpen, userId, fetchFriendships, fetchPendingRequests, fetchContacts]);

  // ── Realtime: new messages → alert ────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const ch = supabase
      .channel(`alerts-rt-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (p) => {
          const msg = p.new as Message;
          if (msg.receiver_id === userId) {
            const sender = contactsRef.current.find(
              (c) => c.id === msg.sender_id,
            );
            if (sender && !mutedChatsRef.current.has(msg.sender_id)) {
              setAlerts((prev) =>
                [
                  {
                    id: `msg-${msg.id}`,
                    text: `${sender.full_name}: ${msg.content || "📎 Media"}`,
                    time: new Date().toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
                    read: false,
                  },
                  ...prev,
                ].slice(0, 50),
              );
            }
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // contacts/mutedChats accessed via refs — channel no longer tears down on every fetch
  }, [isOpen, userId]);

  // ── Unseen message count (always-on, drives FAB badge) ────────────────────
  const fetchUnseenCount = useCallback(async () => {
    if (!userId) return;
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("receiver_id", userId)
      .is("seen_at", null);
    setUnseenMsgCount(count ?? 0);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    fetchUnseenCount();
    const ch = supabase
      .channel(`unseen-count-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (p) => {
          const msg = p.new as any;
          if (msg.receiver_id === userId && !msg.seen_at) {
            setUnseenMsgCount((prev) => prev + 1);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        (p) => {
          const msg = p.new as any;
          const old = p.old as any;
          // Only decrement when a message was just marked as seen — avoids a full
          // DB round-trip on every single message update event
          if (msg.receiver_id === userId && msg.seen_at && !old?.seen_at) {
            setUnseenMsgCount((prev) => Math.max(0, prev - 1));
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, fetchUnseenCount]);

  // ── Report total unread count to parent (for FAB badge) ──────────────────
  useEffect(() => {
    onUnreadCountChange?.(pendingCount + unseenMsgCount);
  }, [pendingCount, unseenMsgCount, onUnreadCountChange]);

  // ── Search debounce ───────────────────────────────────────────────────────
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      const q = searchQuery.trim();
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url")
        .neq("id", userId)
        .or(`full_name.ilike.%${q}%,username.ilike.%${q}%`)
        .limit(20);
      setSearchResults(
        (data || []).map((p) => ({
          id: p.id,
          full_name: p.full_name || p.username || "Unknown",
          username: p.username || "",
          avatar_url: p.avatar_url || "",
        })),
      );
      setIsSearching(false);
    }, 300);
  }, [searchQuery, userId]);

  // ── Messages for selected chat ────────────────────────────────────────────
  useEffect(() => {
    if (!selectedUser) return;
    setIsOtherTyping(false);
    setShowChatMenu(false);
    setPanicMode(false);
    setReplyTo(null);
    setShowInputEmoji(false);

    // Clear stale messages immediately so old chat doesn't flash on screen
    setMessages([]);

    const load = async () => {
      setLoadingMessages(true);

      // Normalise IDs — trim whitespace to guard against subtle format differences
      const myId = (userId || "").trim();
      const partnerId = (selectedUser.id || "").trim();

      // Guard: abort if either ID is missing (can happen on first mount)
      if (!myId || !partnerId) {
        setLoadingMessages(false);
        return;
      }

      // ── Primary fetch: select only columns guaranteed to exist ───────────
      // Using .in() on both columns is equivalent to
      //   (sender_id IN (me,partner) AND receiver_id IN (me,partner))
      // which matches exactly the messages between these two users.
      let { data, error } = await supabase
        .from("messages")
        .select(
          "id, sender_id, receiver_id, content, media_url, media_type, created_at, seen_at, reply_to_id",
        )
        .in("sender_id", [myId, partnerId])
        .in("receiver_id", [myId, partnerId])
        .order("created_at", { ascending: true })
        .limit(200);

      // ── Fallback: if above fails (e.g. RLS or column issue) try simpler query
      if (error) {
        console.error("[Chat] fetchMessages primary error:", error.message);
        const fallback = await supabase
          .from("messages")
          .select(
            "id, sender_id, receiver_id, content, created_at, seen_at, reply_to_id",
          )
          .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
          .order("created_at", { ascending: true })
          .limit(200);

        if (!fallback.error && fallback.data) {
          // Filter to this conversation only on the JS side
          data = fallback.data.filter(
            (m: any) =>
              (m.sender_id.trim() === myId &&
                m.receiver_id.trim() === partnerId) ||
              (m.sender_id.trim() === partnerId &&
                m.receiver_id.trim() === myId),
          ) as any;
        } else {
          console.error(
            "[Chat] fetchMessages fallback error:",
            fallback.error?.message,
          );
          setLoadingMessages(false);
          return;
        }
      }

      // Normalise every row so comparisons are reliable
      const rows: Message[] = (data || []).map((m: any) => ({
        ...m,
        id: String(m.id || "").trim(),
        sender_id: String(m.sender_id || "").trim(),
        receiver_id: String(m.receiver_id || "").trim(),
        content: m.content ?? "",
      }));

      setMessages(rows);
      setLoadingMessages(false);

      // Mark all received messages as seen
      await supabase
        .from("messages")
        .update({ seen_at: new Date().toISOString() })
        .eq("receiver_id", myId)
        .eq("sender_id", partnerId)
        .is("seen_at", null);
    };

    // Retry once after 800 ms in case userId arrived slightly after selectedUser
    const runLoad = async () => {
      await load();
      // If still empty and userId exists, retry once (handles async auth init)
      if (!userId) {
        setTimeout(() => load(), 800);
      }
    };
    runLoad().then(() => fetchMsgReactions(userId, selectedUser.id));

    // ── Chat Realtime via custom-all-channel ─────────────────────────────────
    // Track when realtime last delivered a message (for the manual-fetch fallback)
    let lastRtReceived = Date.now();
    // Only run the polling fallback when realtime is confirmed broken
    let realtimeHealthy = false;

    const convKey = [userId, selectedUser.id].sort().join("-");
    const ch = supabase
      .channel(`conv-${convKey}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (p) => {
          const msg = p.new as Message;
          const sid = String(msg.sender_id || "").trim();
          const rid = String(msg.receiver_id || "").trim();
          const myId = String(userId || "").trim();
          const pid = String(selectedUser.id || "").trim();
          const relevant =
            (sid === myId && rid === pid) || (sid === pid && rid === myId);

          if (!relevant) return;

          // Skip messages the user deleted for themselves — don't let realtime bounce them back
          if (deletedForMeIdsRef.current.has(msg.id)) return;

          lastRtReceived = Date.now();

          // Safely append — skip if already in list (optimistic duplicate guard)
          setMessages((prev) =>
            prev.find((m) => m.id === msg.id) ? prev : [...prev, msg],
          );
          fetchContacts();

          // Auto-mark as seen when the message is addressed to us
          if (rid === myId && sid === pid) {
            supabase
              .from("messages")
              .update({ seen_at: new Date().toISOString() })
              .eq("id", msg.id)
              .then(() => {});
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        (p) => {
          const msg = p.new as Message;
          const relevant =
            msg.sender_id === userId || msg.receiver_id === userId;
          if (relevant) {
            lastRtReceived = Date.now();
            // Merge ALL updated fields (content, seen_at, any future fields)
            setMessages((prev) =>
              prev.map((m) => (m.id === msg.id ? { ...m, ...msg } : m)),
            );
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages" },
        (p) => {
          const deletedId = (p.old as { id: string })?.id;
          if (deletedId) {
            setMessages((prev) => prev.filter((m) => m.id !== deletedId));
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        (p) => {
          const row = (p.new ?? p.old) as {
            message_id: string;
            user_id: string;
            emoji: string;
          } | null;
          if (!row) return;
          setMsgReactions((prev) => {
            const msgId = row.message_id;
            const cur = { ...(prev[msgId] ?? {}) };
            if (p.eventType === "DELETE") {
              const old = p.old as {
                message_id: string;
                user_id: string;
                emoji: string;
              };
              if (cur[old.emoji]) {
                cur[old.emoji] = cur[old.emoji].filter(
                  (u) => u !== old.user_id,
                );
                if (cur[old.emoji].length === 0) delete cur[old.emoji];
              }
            } else {
              Object.keys(cur).forEach((e) => {
                cur[e] = cur[e].filter((u) => u !== row.user_id);
                if (cur[e].length === 0) delete cur[e];
              });
              if (!cur[row.emoji]) cur[row.emoji] = [];
              if (!cur[row.emoji].includes(row.user_id))
                cur[row.emoji].push(row.user_id);
            }
            return { ...prev, [msgId]: cur };
          });
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          realtimeHealthy = true;
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          realtimeHealthy = false;
          void 0; // realtime error — polling fallback handles it silently;
        }
      });

    // ── Polling fallback — only fires when realtime is broken or backgrounded ──
    const fallbackInterval = setInterval(async () => {
      // Skip entirely when the app/tab is hidden — no need to wake the radio
      if (document.hidden) return;
      // Skip when realtime is healthy — avoid double-fetching on every message
      if (realtimeHealthy) return;

      const myId = String(userId || "").trim();
      const partnerId = String(selectedUser.id || "").trim();
      if (!myId || !partnerId) return;

      // ① Messages — use .in() on both columns (avoids compound OR parsing issues)
      const { data: freshMsgs } = await supabase
        .from("messages")
        .select(
          "id, sender_id, receiver_id, content, media_url, media_type, created_at, seen_at, reply_to_id",
        )
        .in("sender_id", [myId, partnerId])
        .in("receiver_id", [myId, partnerId])
        .order("created_at", { ascending: true })
        .limit(200);

      if (freshMsgs) {
        const freshIds = new Set((freshMsgs as Message[]).map((m) => m.id));
        setMessages((prev) => {
          const prevIds = new Set(prev.map((m) => m.id));
          // Add messages that arrived while offline — but never re-add ones deleted for me
          const toAdd = (freshMsgs as Message[]).filter(
            (m) => !prevIds.has(m.id) && !deletedForMeIdsRef.current.has(m.id),
          );
          // Remove messages that were deleted on the DB side
          const surviving = prev.filter(
            (m) => m.id.startsWith("temp-") || freshIds.has(m.id),
          );
          if (toAdd.length === 0 && surviving.length === prev.length)
            return prev;
          return [...surviving, ...toAdd].sort((a, b) =>
            a.created_at.localeCompare(b.created_at),
          );
        });
      }

      // ② Reactions — full re-sync using the proven fetchMsgReactions path
      // This does a complete replace of setMsgReactions, not a partial merge,
      // so additions AND removals are always reflected correctly.
      await fetchMsgReactions(userId, selectedUser.id);
    }, 3_000);

    // Typing presence channel
    const typingKey = [userId, selectedUser.id].sort().join("-");
    const typingCh = supabase.channel(`typing-${typingKey}`, {
      config: { presence: { key: userId } },
    });
    typingCh
      .on("presence", { event: "sync" }, () => {
        const state = typingCh.presenceState<{ is_typing?: boolean }>();
        const other = (state[selectedUser.id] || [])[0] as
          | { is_typing?: boolean }
          | undefined;
        setIsOtherTyping(other?.is_typing === true);
      })
      .subscribe();
    typingChannelRef.current = typingCh;

    return () => {
      clearInterval(fallbackInterval);
      supabase.removeChannel(ch);
      supabase.removeChannel(typingCh);
      typingChannelRef.current = null;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [selectedUser, userId, fetchContacts, fetchMsgReactions]);

  // ── Friend actions ────────────────────────────────────────────────────────
  const sendFriendRequest = async (targetId: string) => {
    setActionLoading(targetId);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const senderId = session?.user?.id ?? userId;
      const { error } = await supabase.from("friendships").insert({
        sender_id: senderId,
        receiver_id: targetId,
        status: "pending",
      });
      if (error) {
        toast.error(`Request failed: ${error.message}`);
        return;
      }
      toast.success("Friend request sent!");
      await fetchFriendships();
    } catch (err: any) {
      toast.error(err?.message ?? "Error");
    } finally {
      setActionLoading("");
    }
  };
  const acceptRequest = async (req: FriendRequest) => {
    setActionLoading(req.id);
    try {
      const { error } = await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("id", req.id);
      if (error) {
        toast.error(`Error: ${error.message}`);
        return;
      }
      toast.success("Request accepted!");
      await Promise.all([
        fetchFriendships(),
        fetchPendingRequests(),
        fetchContacts(),
      ]);
    } finally {
      setActionLoading("");
    }
  };
  const rejectRequest = async (req: FriendRequest) => {
    setActionLoading(req.id);
    try {
      await supabase
        .from("friendships")
        .update({ status: "rejected" })
        .eq("id", req.id);
      await Promise.all([fetchFriendships(), fetchPendingRequests()]);
    } finally {
      setActionLoading("");
    }
  };

  // ── Open chat ─────────────────────────────────────────────────────────────
  const handleSelectContact = (user: ChatContact) => {
    if (blockedUserIds.has(user.id)) {
      toast.error("This conversation is unavailable.");
      return;
    }
    setSelectedUser(user);
    // Optimistically zero out the unread badge the moment the chat is opened
    setContacts((prev) =>
      prev.map((c) => (c.id === user.id ? { ...c, unread_count: 0 } : c)),
    );
    setMessageRequests((prev) =>
      prev.map((c) => (c.id === user.id ? { ...c, unread_count: 0 } : c)),
    );
    setSearchQuery("");
    setSearchResults([]);
    setShowChatSearch(false);
    setChatSearch("");
    setShowEmojiGrid(false);
    setShowInputEmoji(false);
    setMsgMenuId(null);
    setReplyTo(null);
  };
  const handleSelectFromSearch = (user: Profile) => {
    if (blockedUserIds.has(user.id)) {
      toast.error("This conversation is unavailable.");
      return;
    }
    handleSelectContact({ ...user } as ChatContact);
  };

  // ── Send message ─────────────────────────────────────────────────────────
  const sendMessage = async (overrideText?: string) => {
    // 1. Grab text and any staged file
    const text = (
      typeof overrideText === "string" ? overrideText : newMessage
    ).trim();
    const fileToSend = pendingFileRef.current || pendingFile;

    // 2. Nothing to send
    if (!text && !fileToSend) {
      console.warn("sendMessage: nothing to send — aborting");
      return;
    }
    if (!selectedUser) {
      console.warn("sendMessage: no selectedUser — aborting");
      return;
    }
    if (isSending) {
      console.warn("sendMessage: already sending — aborting (isSending=true)");
      return;
    }

    // 3. File upload (runs independently, does not block text send)
    if (fileToSend) {
      pendingFileRef.current = null;
      setPendingFile(null);
      setPendingFilePreview(null);
      uploadAndSendFile(fileToSend);
      if (!text) {
        setNewMessage("");
        return;
      }
    }

    // 4. Text message — wrap in try/finally so isSending ALWAYS resets
    setIsSending(true);
    const replyRef = replyTo;
    setReplyTo(null);
    if (soundEnabled) playSound("send");

    // Always use the authenticated user ID to satisfy RLS policies
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    const realSenderId = authUser?.id ?? userId;

    const tempId = `temp-${Date.now()}`;
    const tempMsg: Message = {
      id: tempId,
      sender_id: realSenderId,
      receiver_id: selectedUser.id,
      content: text,
      created_at: new Date().toISOString(),
      reply_to_id: replyRef?.id,
    };
    setMessages((prev) => [...prev, tempMsg]);

    const insertPayload: Record<string, unknown> = {
      sender_id: realSenderId,
      receiver_id: selectedUser.id,
      content: text,
    };
    if (replyRef?.id) insertPayload.reply_to_id = replyRef.id;

    try {
      const { data, error } = await supabase
        .from("messages")
        .insert(insertPayload)
        .select()
        .single();

      if (data) {
        setNewMessage("");
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? (data as Message) : m)),
        );
        fetchContacts();
      } else if (error) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        console.error("[ChatSystem] sendMessage Supabase error:", error);
        const errMsg = (error.message || "").toLowerCase();
        const errCode = (error.code || "").toLowerCase();
        const isQuota =
          errMsg.includes("read-only") ||
          errMsg.includes("quota") ||
          errMsg.includes("readonly") ||
          errMsg.includes("storage full") ||
          errMsg.includes("disk") ||
          errCode === "25006" ||
          errCode === "53100" ||
          error.status === 503 ||
          error.status === 507;
        if (isQuota) {
          toast.error("Server busy — please try again in a few minutes.", {
            duration: 6000,
          });
        } else {
          const reason =
            error.code === "PGRST301" || error.code?.startsWith("42")
              ? "Permission denied — check Supabase RLS policies"
              : errMsg.includes("network")
                ? "Network error — check your connection"
                : error.message || "Unknown error";
          toast.error(`Message failed: ${reason}`, { duration: 5000 });
        }
      }
    } catch (ex: any) {
      // Uncaught exception — make sure we clean up the optimistic message
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      console.error("[ChatSystem] sendMessage uncaught exception:", ex);
      toast.error(`Unexpected error: ${ex?.message || "Unknown"}`);
    } finally {
      // ALWAYS unlock the button, no matter what happened above
      setIsSending(false);
    }
  };
  // ── Edit message ─────────────────────────────────────────────────────────
  const saveEditMsg = async () => {
    if (!editingMsg) return;
    const { id, text } = editingMsg;
    if (!text.trim()) return;
    await supabase
      .from("messages")
      .update({ content: text.trim() })
      .eq("id", id);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, content: text.trim(), is_edited: true } : m,
      ),
    );
    setEditingMsg(null);
  };

  // ── Delete message (for everyone) ─────────────────────────────────────────
  const deleteMessage = async (msg: Message, e: React.MouseEvent) => {
    if (msg.sender_id !== userId) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    // Instant local remove so sender sees it gone immediately
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    setMsgMenuId(null);
    if (soundEnabled) playSound("delete");
    const newId = ++smokeIdRef.current;
    setSmokeParticles((prev) => [
      ...prev,
      {
        id: newId,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      },
    ]);
    const { error } = await supabase.from("messages").delete().eq("id", msg.id);
    if (error) {
      toast.error("Delete failed: " + error.message);
      // Restore the message if DB delete failed
      setMessages((prev) =>
        [...prev, msg].sort((a, b) => a.created_at.localeCompare(b.created_at)),
      );
    } else {
      toast.success("Message deleted for everyone 🗑️");
    }
  };

  const deleteMessageAt = async (msg: Message, x: number, y: number) => {
    if (msg.sender_id !== userId) return;
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    setChatMsgAction(null);
    if (soundEnabled) playSound("delete");
    const newId = ++smokeIdRef.current;
    setSmokeParticles((prev) => [...prev, { id: newId, x, y }]);
    const { error } = await supabase.from("messages").delete().eq("id", msg.id);
    if (error) {
      toast.error("Delete failed: " + error.message);
      setMessages((prev) =>
        [...prev, msg].sort((a, b) => a.created_at.localeCompare(b.created_at)),
      );
    } else {
      toast.success("Message deleted for everyone 🗑️");
    }
  };

  // ── Media upload ──────────────────────────────────────────────────────────
  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const MAX_BYTES = 100 * 1024 * 1024; // 100 MB
    if (file.size > MAX_BYTES) {
      toast.error("File too large. Maximum allowed size is 100 MB.");
      return;
    }

    setPendingFile(file);
    pendingFileRef.current = file;

    if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
      const objectUrl = URL.createObjectURL(file);
      setPendingFilePreview(objectUrl);
    } else {
      setPendingFilePreview(null);
    }

    const label = file.type.startsWith("video/")
      ? "🎥 Video"
      : file.type.startsWith("audio/")
        ? "🎵 Audio"
        : "🖼️ Image";
    toast.success(`${label} attached — tap Send or say "Bhej do" to send`);
  };

  const clearPendingFile = () => {
    if (pendingFilePreview) URL.revokeObjectURL(pendingFilePreview);
    setPendingFile(null);
    setPendingFilePreview(null);
    pendingFileRef.current = null;
  };

  const uploadAndSendFile = async (file: File): Promise<void> => {
    if (!selectedUser) return;
    setIsUploadingMedia(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `${userId}-${Date.now()}.${ext}`;

      // ── Step 1: Upload to storage ────────────────────────────────────────
      const { error: storageError } = await supabase.storage
        .from(CHAT_BUCKET)
        .upload(fileName, file, { contentType: file.type, upsert: false });
      if (storageError) {
        console.error("Supabase Storage Error:", storageError);
        toast.error(
          `Media upload failed: ${storageError.message}. Make sure the "${CHAT_BUCKET}" bucket exists in Supabase Storage.`,
          { duration: 6000 },
        );
        return;
      }

      // ── Step 2: Get public URL ───────────────────────────────────────────
      const { data: urlData } = supabase.storage
        .from(CHAT_BUCKET)
        .getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;

      // ── Step 3: Insert message row ───────────────────────────────────────
      const insertPayload = {
        sender_id: userId,
        receiver_id: selectedUser.id,
        content: "",
        media_url: publicUrl,
        media_type: file.type,
      };

      const { data, error: dbError } = await supabase
        .from("messages")
        .insert(insertPayload)
        .select()
        .single();

      if (dbError) {
        console.error("Supabase DB Insert Error:", dbError);
        toast.error(`Media message failed: ${dbError.message}`, {
          duration: 5000,
        });
        return;
      }

      if (data) {
        setMessages((prev) =>
          prev.find((m) => m.id === (data as Message).id)
            ? prev
            : [...prev, data as Message],
        );
        fetchContacts();
        if (soundEnabled) playSound("send");
      }
    } catch (err: any) {
      console.error("Unexpected media upload error:", err);
      toast.error(`Upload failed: ${err?.message || "Unknown error"}`);
    } finally {
      setIsUploadingMedia(false);
    }
  };

  // ── Save profile ──────────────────────────────────────────────────────────
  const saveProfileSettings = async () => {
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({ bio: editBio, school: editSchool, location: editLocation })
      .eq("id", userId);
    setSavingProfile(false);
    if (error) toast.error("Save failed: " + error.message);
    else {
      toast.success("Profile updated!");
      fetchMyProfile();
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const formatTime = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    return d.toDateString() === now.toDateString()
      ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString([], { month: "short", day: "numeric" });
  };
  const lastMsgPreview = (c: ChatContact) => {
    if (c.last_media_type) {
      if (c.last_media_type.startsWith("image/")) return "📷 Photo";
      if (c.last_media_type.startsWith("video/")) return "🎥 Video";
      if (c.last_media_type.startsWith("audio/")) return "🎵 Audio";
      return "📎 File";
    }
    return c.last_message || "";
  };
  const toggleMute = (id: string) =>
    setMutedChats((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const toggleArchive = (id: string) =>
    setArchivedChats((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  // ── Voice Mode ────────────────────────────────────────────────────────────
  const stopVoiceMode = () => {
    voiceActiveRef.current = false;
    if (voiceTimerRef.current) {
      clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setVoiceMode(false);
    setVoiceSecondsLeft(300);
    setVoiceStatus("listening");
  };

  const startVoiceMode = () => {
    const SpeechRecognition =
      (window as any).webkitSpeechRecognition ||
      (window as any).SpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Voice not supported in this browser. Try Chrome.");
      return;
    }

    voiceActiveRef.current = true;
    setVoiceMode(true);
    setVoiceSecondsLeft(300);
    setVoiceStatus("listening");

    // 5-minute countdown
    voiceTimerRef.current = setInterval(() => {
      setVoiceSecondsLeft((prev) => {
        if (prev <= 1) {
          stopVoiceMode();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const createRecognition = () => {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = "hi-IN";

      rec.onresult = (e: any) => {
        setVoiceStatus("processing");

        // Grab only the latest spoken segment (not the full accumulated list)
        const latest = e.results[e.resultIndex];
        if (!latest || !latest[0]) {
          setVoiceStatus("listening");
          return;
        }

        // Clean: lowercase + strip trailing punctuation (। . ! ?)
        const raw = latest[0].transcript
          .trim()
          .toLowerCase()
          .replace(/[।,.!?]+$/, "")
          .trim();

        if (!raw) {
          setVoiceStatus("listening");
          return;
        }

        // ── SEND ──────────────────────────────────────────────────────────
        if (
          /^(send|भेज दो|भेजो|भेजना|send karo|message send|message bhejo|bhej do|bhejo)$/.test(
            raw,
          )
        ) {
          setNewMessage((prev) => {
            sendMessage(prev);
            return prev;
          });
          setTimeout(() => setVoiceStatus("listening"), 600);
          return;
        }

        // ── CLEAR CHAT ────────────────────────────────────────────────────
        if (
          /^(clear|clear chat|wipe|wipe chat|sab saaf|sab saaf karo|सब साफ|सब साफ करो|saaf karo|chat saaf|saaf)$/.test(
            raw,
          )
        ) {
          messages.forEach((m) => deletedForMeIdsRef.current.add(m.id));
          setMessages([]);
          toast.success("🧹 Chat cleared!");
          setTimeout(() => setVoiceStatus("listening"), 600);
          return;
        }

        // ── PANIC MODE ────────────────────────────────────────────────────
        if (/^(panic|panic mode|emergency|पैनिक|पैनिक मोड)$/.test(raw)) {
          setPanicMode(true);
          setTimeout(() => setVoiceStatus("listening"), 600);
          return;
        }

        // ── STOP VOICE ────────────────────────────────────────────────────
        if (
          /^(stop|stop voice|band karo|band kar|बंद करो|रुको|mic band|voice band)$/.test(
            raw,
          )
        ) {
          stopVoiceMode();
          toast.success("🔇 Voice mode stopped");
          return;
        }

        // ── WRITE / LIKH (strip command word, put rest in input) ──────────
        const writeMatch = raw.match(
          /^(?:likh|likho|likhna|write|type|लिख|लिखो|लिखना)\s+(.+)/,
        );
        if (writeMatch) {
          const msg = writeMatch[1].trim();
          setNewMessage(msg);
          toast.success(`✍️ "${msg}"`);
          setTimeout(() => setVoiceStatus("listening"), 600);
          return;
        }

        // ── FALLBACK: only if no command matched → append to input ────────
        setNewMessage((prev) => (prev ? prev + " " + raw : raw));
        setTimeout(() => setVoiceStatus("listening"), 600);
      };

      rec.onerror = () => {
        setTimeout(() => setVoiceStatus("listening"), 500);
      };

      rec.onend = () => {
        // Auto-restart if still in voice mode
        if (voiceActiveRef.current) {
          setTimeout(() => {
            if (voiceActiveRef.current) {
              try {
                rec.start();
              } catch {}
            }
          }, 300);
        }
      };

      return rec;
    };

    const rec = createRecognition();
    recognitionRef.current = rec;
    try {
      rec.start();
    } catch {
      toast.error("Could not access microphone.");
      stopVoiceMode();
    }
  };

  // ── Typing tracker ────────────────────────────────────────────────────────
  const handleTyping = () => {
    const ch = typingChannelRef.current;
    if (!ch) return;
    ch.track({ is_typing: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      ch.track({ is_typing: false });
    }, 2000);
  };

  // ── Panic mode triple-click handler ───────────────────────────────────────
  const handlePanicUnlock = () => {
    if (!panicMode) return;
    panicClickRef.current.count += 1;
    if (panicClickRef.current.timer) clearTimeout(panicClickRef.current.timer);
    if (panicClickRef.current.count >= 3) {
      panicClickRef.current.count = 0;
      setPanicMode(false);
    } else {
      panicClickRef.current.timer = setTimeout(() => {
        panicClickRef.current.count = 0;
      }, 800);
    }
  };

  // ── Delete for Me (local only) ────────────────────────────────────────────
  const deleteForMe = (msgId: string) => {
    // Persist the ID so realtime + polling never re-add this message
    deletedForMeIdsRef.current.add(msgId);
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    setMsgMenuId(null);
    setDeletingForMe(null);
  };

  // ── Status text component (replaces ticks) ────────────────────────────────
  const MessageStatus = ({ msg }: { msg: Message }) => {
    if (msg.sender_id !== userId) return null;
    const isTemp = msg.id.startsWith("temp-");
    if (isTemp)
      return (
        <span className="text-[10px] text-white/30 ml-1 italic">Sending…</span>
      );
    if (msg.seen_at)
      return (
        <span className="text-[10px] text-blue-400 ml-1 font-black">Seen</span>
      );
    return <span className="text-[10px] text-white/40 ml-1">Delivered</span>;
  };

  // ── Emoji list for input picker ────────────────────────────────────────────
  const INPUT_EMOJIS = [
    "❤️",
    "🔥",
    "😂",
    "😍",
    "🥰",
    "😭",
    "🤣",
    "💀",
    "✨",
    "🎉",
    "😊",
    "🥺",
    "😤",
    "💯",
    "🖕",
    "🌹",
    "💕",
    "🤯",
    "😏",
    "🫶",
    "💪",
    "🙏",
    "😈",
    "🤩",
    "👀",
    "🫠",
    "💔",
    "🥹",
  ];

  const visibleContacts = contacts.filter((c) => !archivedChats.has(c.id));
  const archivedContactsList = contacts.filter((c) => archivedChats.has(c.id));
  const filteredMessages = chatSearch.trim()
    ? messages.filter((m) =>
        m.content?.toLowerCase().includes(chatSearch.toLowerCase()),
      )
    : messages;
  const unreadAlerts = alerts.filter((a) => !a.read).length;

  // ── Friend Action Button ──────────────────────────────────────────────────
  const FriendActionBtn = ({ user }: { user: Profile }) => {
    const fs = friendshipMap.get(user.id);
    const loading = actionLoading === user.id || actionLoading === fs?.id;
    if (fs?.status === "accepted")
      return (
        <button
          onClick={() => handleSelectFromSearch(user)}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${T.pill}`}
        >
          <MessageSquare size={11} /> Chat
        </button>
      );
    if (fs?.status === "pending" && fs.direction === "sent")
      return (
        <span
          className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black opacity-40 ${T.pill}`}
        >
          <Clock size={11} /> Sent
        </span>
      );
    if (fs?.status === "pending" && fs.direction === "received")
      return (
        <button
          onClick={() => {
            const req = pendingRequests.find((r) => r.sender_id === user.id);
            if (req) acceptRequest(req);
          }}
          disabled={loading}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-green-500/20 text-green-400 border border-green-500/30 text-xs font-black disabled:opacity-40"
        >
          {loading ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <UserCheck size={11} />
          )}{" "}
          Accept
        </button>
      );
    return (
      <button
        onClick={() => sendFriendRequest(user.id)}
        disabled={loading}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black transition-all disabled:opacity-40 ${T.pill}`}
      >
        {loading ? (
          <Loader2 size={11} className="animate-spin" />
        ) : (
          <UserPlus size={11} />
        )}{" "}
        Add
      </button>
    );
  };

  // ── Story Row ─────────────────────────────────────────────────────────────
  const StoryRow = () => (
    <div className={`border-b ${T.divider} px-4 py-3 shrink-0`}>
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1">
        {/* Your Story */}
        <button
          onClick={() => storyInputRef.current?.click()}
          className="flex flex-col items-center gap-1.5 shrink-0"
        >
          <div
            className={`w-14 h-14 rounded-full border-2 border-dashed ${T.storyRing} flex items-center justify-center relative`}
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            {myProfile?.avatar_url ? (
              <img
                src={myProfile.avatar_url}
                className="w-full h-full rounded-full object-cover"
                decoding="async"
                crossOrigin="anonymous"
              />
            ) : (
              <Plus size={20} className={T.text3} />
            )}
            <span
              className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-white font-black text-[10px]"
              style={{ background: "linear-gradient(135deg,#f43f5e,#ef4444)" }}
            >
              +
            </span>
          </div>
          <span className={`text-[9px] font-black ${T.text3}`}>Your Story</span>
        </button>

        {/* Friend stories — grouped */}
        {loadingStories ? (
          <div className="flex items-center justify-center w-14 h-14">
            <Loader2 size={16} className={`animate-spin ${T.text3}`} />
          </div>
        ) : storyGroups.length === 0 ? (
          <div
            className={`flex items-center gap-2 text-xs font-bold ${T.text3} italic px-2`}
          >
            No stories yet. Start the fire! 🔥
          </div>
        ) : (
          storyGroups.slice(0, 6).map((group, gi) => (
            <StoryCircle
              key={group.user_id}
              story={group.stories[0]}
              onClick={() => {
                setViewerGroupIdx(gi);
                setViewerStoryIdx(0);
                setStoryElapsed(0);
                storyViewedRef.current.clear();
                setStoryViewerOpen(true);
              }}
            />
          ))
        )}
      </div>
      <input
        ref={storyInputRef}
        type="file"
        accept="image/*,video/*,audio/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const allFiles = Array.from(e.target.files || []).slice(0, 10);
          if (allFiles.length === 0) return;
          const oversized = allFiles.find(
            (f) => f.type.startsWith("video/") && f.size > 30 * 1024 * 1024,
          );
          if (oversized) {
            toast.error("Please shorten your file under 30MB");
            e.target.value = "";
            return;
          }
          const files = allFiles;
          if (files.length === 1) {
            setStoryFile(files[0]);
            setStoryFiles([files[0]]);
            setStoryPreviews([URL.createObjectURL(files[0])]);
            setStoryPreviewUrl(URL.createObjectURL(files[0]));
          } else {
            setStoryFiles(files);
            setStoryPreviews(files.map((f) => URL.createObjectURL(f)));
            setStoryFile(files[0]);
            setStoryPreviewUrl(URL.createObjectURL(files[0]));
          }
          setShowStoryEditor(true);
          e.target.value = "";
        }}
      />
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={`fixed inset-0 z-[150] flex flex-col ${T.wrap} overflow-hidden`}
        >
          {/* ── PANIC MODE OVERLAY ───────────────────────────────────────── */}
          <AnimatePresence>
            {panicMode && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-[999] bg-white flex flex-col items-center justify-center select-none"
              >
                <motion.div
                  animate={{ rotate: [0, -5, 5, -5, 5, 0] }}
                  transition={{
                    duration: 0.5,
                    repeat: Infinity,
                    repeatDelay: 2,
                  }}
                  className="text-[120px] leading-none mb-8"
                >
                  🖕
                </motion.div>
                <button
                  onClick={handlePanicUnlock}
                  className="w-16 h-16 rounded-full overflow-hidden border-2 border-gray-200 active:scale-95 transition-all shadow-lg"
                >
                  {myProfile?.avatar_url ? (
                    <img
                      src={myProfile.avatar_url}
                      alt=""
                      className="w-full h-full object-cover"
                      decoding="async"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center text-2xl">
                      👤
                    </div>
                  )}
                </button>
                <div className="mt-6 flex gap-2">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 rounded-full bg-gray-200"
                      animate={{ scale: [1, 1.5, 1] }}
                      transition={{
                        duration: 0.8,
                        delay: i * 0.25,
                        repeat: Infinity,
                      }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Rose petals ──────────────────────────────────────────────── */}
          {theme === "velvet" && <RosePetals />}

          {/* ── Smoke particles ──────────────────────────────────────────── */}
          {smokeParticles.map((p) => (
            <SmokeParticle
              key={p.id}
              x={p.x}
              y={p.y}
              onDone={() =>
                setSmokeParticles((prev) => prev.filter((s) => s.id !== p.id))
              }
            />
          ))}

          {/* ── Emoji blast ───────────────────────────────────────────────── */}
          {emojiBlast && (
            <EmojiBlast
              key={emojiBlast.id}
              emoji={emojiBlast.emoji}
              onDone={() => setEmojiBlast(null)}
            />
          )}

          {/* ── Chat Message Floating Action Menu (long-press) ─────────── */}
          <AnimatePresence>
            {chatMsgAction &&
              (() => {
                const { msg: am, x, y } = chatMsgAction;
                const isMine = am.sender_id === userId;
                const QUICK_EMOJIS = ["❤️", "👍", "😂", "🔥", "😮"];

                const menuW = 220;
                const reactionH = 54;
                const rowH = 46;
                const rowCount = isMine ? 3 : 2;
                const menuH = reactionH + rowCount * rowH;
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                const left = Math.min(
                  Math.max(x - menuW / 2, 8),
                  vw - menuW - 8,
                );
                const showAbove = y + menuH + 20 > vh;
                const top = showAbove ? Math.max(y - menuH - 14, 8) : y + 14;

                return (
                  <>
                    <div
                      className="fixed inset-0 z-[700] bg-black/20 backdrop-blur-[1px]"
                      onPointerDown={() => setChatMsgAction(null)}
                    />
                    <motion.div
                      key="chat-msg-action-float"
                      initial={{ opacity: 0, scale: 0.82 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.82 }}
                      transition={{
                        type: "spring",
                        damping: 20,
                        stiffness: 420,
                      }}
                      className="fixed z-[701] bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100"
                      style={{
                        top,
                        left,
                        width: menuW,
                        transformOrigin: showAbove
                          ? "bottom center"
                          : "top center",
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      {/* Quick-react row */}
                      <div className="flex items-center justify-around px-3 py-3 bg-gray-50 border-b border-gray-100">
                        {QUICK_EMOJIS.map((emoji) => (
                          <motion.button
                            key={emoji}
                            whileTap={{ scale: 0.8 }}
                            whileHover={{ scale: 1.3 }}
                            onClick={() => {
                              handleMsgReact(am.id, emoji);
                              setChatMsgAction(null);
                            }}
                            className="text-[24px] leading-none"
                          >
                            {emoji}
                          </motion.button>
                        ))}
                      </div>
                      {/* Reply */}
                      <button
                        onClick={() => {
                          setReplyTo(am);
                          setChatMsgAction(null);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-[13px] text-left text-[14px] font-semibold text-gray-800 active:bg-gray-100 transition-colors"
                      >
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          className="text-gray-500"
                        >
                          <polyline points="9 17 4 12 9 7" />
                          <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                        </svg>
                        Reply
                      </button>
                      {/* Edit — own text messages only */}
                      {isMine && !am.media_url && (
                        <button
                          onClick={() => {
                            setEditingMsg({ id: am.id, text: am.content });
                            setChatMsgAction(null);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-[13px] text-left text-[14px] font-semibold text-blue-600 active:bg-blue-50 transition-colors border-t border-gray-50"
                        >
                          <Pencil size={15} className="text-blue-500" />
                          Edit
                        </button>
                      )}
                      {/* Delete for Me */}
                      <button
                        onClick={() => {
                          deleteForMe(am.id);
                          setChatMsgAction(null);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-[13px] text-left text-[14px] font-semibold text-gray-600 active:bg-gray-100 transition-colors border-t border-gray-50"
                      >
                        <EyeOff size={15} className="text-gray-400" />
                        Delete for Me
                      </button>
                      {/* Delete for Everyone — only sender */}
                      {isMine && (
                        <button
                          onClick={() => deleteMessageAt(am, x, y)}
                          className="w-full flex items-center gap-3 px-4 py-[13px] text-left text-[14px] font-semibold text-red-600 active:bg-red-50 transition-colors border-t border-gray-50"
                        >
                          <Trash2 size={15} className="text-red-500" />
                          Delete for Everyone
                        </button>
                      )}
                    </motion.div>
                  </>
                );
              })()}
          </AnimatePresence>

          {/* ── Full Instagram-style Story viewer ─────────────────────────── */}
          <AnimatePresence>
            {storyViewerOpen &&
              storyGroups.length > 0 &&
              (() => {
                const group = storyGroups[viewerGroupIdx];
                const story = group?.stories[viewerStoryIdx];
                if (!group || !story) return null;
                const totalInGroup = group.stories.length;
                const isVoice = story.media_type === "voice";
                const moodFilter = STORY_MOOD_FILTER[story.mood ?? ""] ?? "";
                const isSad = story.mood === "sad";
                const isParty = story.mood === "party";
                const pName = group.profile?.full_name || "User";
                const aUrl = group.profile?.avatar_url;
                return (
                  <motion.div
                    key="sv"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[400] bg-black flex flex-col touch-none"
                    onPointerDown={() => setStoryPaused(true)}
                    onPointerUp={() => setStoryPaused(false)}
                    onPointerLeave={() => setStoryPaused(false)}
                  >
                    {/* Progress bar */}
                    <StoryProgressBar
                      total={totalInGroup}
                      current={viewerStoryIdx}
                      elapsed={storyElapsed}
                      duration={15}
                    />
                    {/* Header */}
                    <div className="flex items-center gap-2.5 px-3 py-2 z-20">
                      {aUrl ? (
                        <img
                          src={aUrl}
                          className="w-9 h-9 rounded-full object-cover border-2 border-white/60"
                          decoding="async"
                          crossOrigin="anonymous"
                        />
                      ) : (
                        <div
                          className="w-9 h-9 rounded-full border-2 border-white/60 flex items-center justify-center text-white font-black text-sm shrink-0"
                          style={{ background: _sgradFor(group.user_id) }}
                        >
                          {pName[0]}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-[13px] leading-none truncate">
                          {pName}
                        </p>
                        <p className="text-white/60 text-[10px] mt-0.5">
                          {viewerStoryIdx + 1}/{totalInGroup} ·{" "}
                          {Math.max(0, Math.ceil(15 - storyElapsed))}s
                        </p>
                      </div>
                      {story.music_url && (
                        <Music size={14} className="text-white/60 shrink-0" />
                      )}
                      {/* Owner-only: Edit + Delete */}
                      {story.user_id === userId && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewerEditCaption(story.caption || "");
                              setViewerEditMood(story.mood || "");
                              setViewerEditing((v) => !v);
                              setStoryPaused(true);
                            }}
                            className="w-9 h-9 rounded-full bg-black/40 flex items-center justify-center border border-white/20"
                          >
                            <Pencil size={15} className="text-white" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteViewerStory();
                            }}
                            className="w-9 h-9 rounded-full bg-red-500/30 flex items-center justify-center border border-red-400/40"
                          >
                            <Trash2 size={15} className="text-red-300" />
                          </button>
                        </>
                      )}
                      <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onPointerUp={(e) => e.stopPropagation()}
                        onClick={() => {
                          setStoryViewerOpen(false);
                          setViewingStory(null);
                          setViewerEditing(false);
                        }}
                        className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center border border-white/30"
                      >
                        <X size={20} className="text-white" />
                      </button>
                    </div>
                    {/* Inline edit panel — only shown to owner */}
                    {viewerEditing && story.user_id === userId && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="mx-3 mb-2 rounded-2xl overflow-hidden z-40 relative"
                        style={{
                          background: "rgba(0,0,0,0.75)",
                          backdropFilter: "blur(16px)",
                          border: "1px solid rgba(255,255,255,0.12)",
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onPointerUp={(e) => e.stopPropagation()}
                      >
                        <div className="p-3 flex flex-col gap-2">
                          <input
                            value={viewerEditCaption}
                            onChange={(e) =>
                              setViewerEditCaption(e.target.value)
                            }
                            placeholder="Edit caption…"
                            className="w-full rounded-xl px-3 py-2 text-sm text-white bg-white/10 border border-white/15 outline-none font-medium"
                          />
                          <div className="flex gap-1.5 flex-wrap">
                            {[
                              { k: "", l: "None" },
                              { k: "happy", l: "😊" },
                              { k: "sad", l: "😢" },
                              { k: "love", l: "❤️" },
                              { k: "angry", l: "😡" },
                              { k: "party", l: "🎉" },
                              { k: "chill", l: "😌" },
                            ].map((m) => (
                              <button
                                key={m.k}
                                onClick={() => setViewerEditMood(m.k)}
                                className={`px-2.5 py-1 rounded-full text-xs font-bold border transition-all ${viewerEditMood === m.k ? "bg-white/25 text-white border-white/50" : "bg-white/8 text-white/50 border-white/15"}`}
                              >
                                {m.l}
                              </button>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setViewerEditing(false);
                                setStoryPaused(false);
                              }}
                              className="flex-1 py-1.5 rounded-xl text-xs text-white/50 bg-white/5 border border-white/10"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => {
                                saveViewerEdit();
                                setStoryPaused(false);
                              }}
                              className="flex-1 py-1.5 rounded-xl text-xs text-white font-black"
                              style={{
                                background:
                                  "linear-gradient(135deg,#f43f5e,#ef4444)",
                              }}
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                    {/* Story content */}
                    <div className="flex-1 relative overflow-hidden">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={story.id}
                          initial={{ opacity: 0, scale: 1.04 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={{ duration: 0.22 }}
                          className="absolute inset-0"
                        >
                          {isVoice ? (
                            <div
                              className="w-full h-full flex flex-col items-center justify-center gap-6"
                              style={{
                                background: `linear-gradient(160deg,${_sgradFor(group.user_id)},#0f172a)`,
                              }}
                            >
                              <motion.div
                                className="w-28 h-28 rounded-full border-4 border-white/40 overflow-hidden shadow-2xl"
                                animate={{
                                  scale: [1, 1.07, 1],
                                  boxShadow: [
                                    "0 0 0 0 rgba(255,255,255,0.2)",
                                    "0 0 0 18px rgba(255,255,255,0)",
                                    "0 0 0 0 rgba(255,255,255,0)",
                                  ],
                                }}
                                transition={{ duration: 1.4, repeat: Infinity }}
                              >
                                {aUrl ? (
                                  <img
                                    src={aUrl}
                                    className="w-full h-full object-cover"
                                    decoding="async"
                                    crossOrigin="anonymous"
                                  />
                                ) : (
                                  <div
                                    className="w-full h-full flex items-center justify-center text-white font-black text-4xl"
                                    style={{
                                      background: _sgradFor(group.user_id),
                                    }}
                                  >
                                    {pName[0]}
                                  </div>
                                )}
                              </motion.div>
                              <StoryAudioWave />
                              {story.caption && (
                                <p className="text-white/80 text-sm font-medium px-6 text-center">
                                  {story.caption}
                                </p>
                              )}
                              <div className="flex items-center gap-1.5">
                                <Mic size={14} className="text-white/50" />
                                <span className="text-white/50 text-[11px]">
                                  Voice Story
                                </span>
                              </div>
                            </div>
                          ) : story.media_type === "video" ? (
                            story.mood === "grid" ? (
                              <div className="w-full h-full grid grid-cols-2 grid-rows-2">
                                {[0, 1, 2, 3].map((j) => (
                                  <video
                                    key={j}
                                    src={getStoryMediaUrl(story.image_url)}
                                    className="w-full h-full object-cover"
                                    autoPlay
                                    muted={!!story.music_url}
                                    playsInline
                                    loop
                                    onError={onStoryMediaError}
                                  />
                                ))}
                              </div>
                            ) : (
                              <video
                                src={getStoryMediaUrl(story.image_url)}
                                className="w-full h-full object-cover"
                                autoPlay
                                muted={!!story.music_url}
                                playsInline
                                loop
                                style={{ filter: moodFilter }}
                                onError={onStoryMediaError}
                              />
                            )
                          ) : story.mood === "grid" ? (
                            <div className="w-full h-full grid grid-cols-2 grid-rows-2">
                              {[0, 1, 2, 3].map((j) => (
                                <img
                                  key={j}
                                  src={getStoryMediaUrl(story.image_url)}
                                  className="w-full h-full object-cover"
                                  style={{
                                    transform:
                                      j % 2 === 1 ? "scaleX(-1)" : undefined,
                                  }}
                                  draggable={false}
                                  decoding="async"
                                  crossOrigin="anonymous"
                                  onError={onStoryMediaError}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="w-full h-full relative">
                              <img
                                src={getStoryMediaUrl(story.image_url)}
                                className="w-full h-full object-cover"
                                style={{ filter: moodFilter }}
                                draggable={false}
                                crossOrigin="anonymous"
                                decoding="async"
                                onError={onStoryMediaError}
                              />
                              {isSad && <StoryRainOverlay />}
                              {isParty && <StoryNeonOverlay />}
                            </div>
                          )}
                          {story.is_help_request && <StoryHelpSticker />}
                          {(story.caption || story.emoji) && (
                            <div className="absolute bottom-16 left-4 right-4 z-20">
                              <div className="bg-black/40 backdrop-blur-md rounded-2xl px-4 py-3 inline-block max-w-full">
                                {story.emoji && (
                                  <span className="text-2xl mr-2">
                                    {story.emoji}
                                  </span>
                                )}
                                {story.caption && (
                                  <span className="text-white text-sm font-medium leading-snug">
                                    {story.caption}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                          {/* Share & Download */}
                          <div className="absolute bottom-4 left-4 z-20 flex gap-2">
                            <button
                              onPointerDown={(e) => e.stopPropagation()}
                              onPointerUp={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                const url = getStoryMediaUrl(story.image_url);
                                if (navigator.share) {
                                  navigator
                                    .share({ title: "Flicks Story", url })
                                    .catch(() => {});
                                } else {
                                  navigator.clipboard.writeText(url);
                                  toast.success("Link copied!");
                                }
                              }}
                              className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/20"
                            >
                              <Share2 size={15} className="text-white" />
                            </button>
                            <button
                              onPointerDown={(e) => e.stopPropagation()}
                              onPointerUp={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                const a = document.createElement("a");
                                a.href = getStoryMediaUrl(story.image_url);
                                a.download = `flicks-story`;
                                a.target = "_blank";
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                              }}
                              className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/20"
                            >
                              <Download size={15} className="text-white" />
                            </button>
                          </div>
                          {/* View count for owner */}
                          {story.user_id === userId && (
                            <StoryViewCount storyId={story.id} />
                          )}
                        </motion.div>
                      </AnimatePresence>
                      {/* Tap zones */}
                      <button
                        className="absolute left-0 top-0 w-1/3 h-full z-30"
                        onClick={(e) => {
                          e.stopPropagation();
                          setStoryElapsed(0);
                          if (viewerStoryIdx > 0)
                            setViewerStoryIdx((i) => i - 1);
                          else if (viewerGroupIdx > 0) {
                            setViewerGroupIdx((g) => g - 1);
                            setViewerStoryIdx(
                              storyGroups[viewerGroupIdx - 1].stories.length -
                                1,
                            );
                          }
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onPointerUp={(e) => e.stopPropagation()}
                      />
                      <button
                        className="absolute right-0 top-0 w-1/3 h-full z-30"
                        onClick={(e) => {
                          e.stopPropagation();
                          setStoryElapsed(0);
                          if (viewerStoryIdx + 1 < totalInGroup)
                            setViewerStoryIdx((i) => i + 1);
                          else if (viewerGroupIdx + 1 < storyGroups.length) {
                            setViewerGroupIdx((g) => g + 1);
                            setViewerStoryIdx(0);
                          } else {
                            setStoryViewerOpen(false);
                            setViewingStory(null);
                          }
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onPointerUp={(e) => e.stopPropagation()}
                      />
                      {(viewerStoryIdx > 0 || viewerGroupIdx > 0) && (
                        <div className="absolute left-2 top-1/2 -translate-y-1/2 z-30 pointer-events-none">
                          <ChevronLeft size={26} className="text-white/50" />
                        </div>
                      )}
                      {(viewerStoryIdx + 1 < totalInGroup ||
                        viewerGroupIdx + 1 < storyGroups.length) && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 z-30 pointer-events-none">
                          <ChevronRight size={26} className="text-white/50" />
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })()}
          </AnimatePresence>

          {/* ── Story editor modal (multi-file, mood, madad) ─────────────── */}
          <AnimatePresence>
            {showStoryEditor &&
              (storyPreviewUrl || storyPreviews.length > 0) && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[280] bg-black/70 backdrop-blur-sm"
                    onClick={() => setShowStoryEditor(false)}
                  />
                  <motion.div
                    initial={{ y: "100%", opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: "100%", opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 28 }}
                    className="fixed bottom-0 left-0 right-0 z-[290] rounded-t-3xl overflow-hidden max-h-[90vh] overflow-y-auto"
                    style={{
                      background: "rgba(15,5,30,0.97)",
                      backdropFilter: "blur(20px)",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-white font-black text-base">
                          {storyFiles.length > 1
                            ? `Post ${storyFiles.length} Stories ✨`
                            : "Create Story ✨"}
                        </p>
                        <button
                          onClick={() => setShowStoryEditor(false)}
                          className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      {/* Multi-file preview thumbnails */}
                      {storyPreviews.length > 1 ? (
                        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar mb-4">
                          {storyPreviews.map((url, i) => (
                            <div
                              key={i}
                              className="flex-shrink-0 w-20 h-28 rounded-xl overflow-hidden bg-white/10 relative"
                            >
                              {storyFiles[i]?.type.startsWith("audio/") ? (
                                <div
                                  className="w-full h-full flex items-center justify-center"
                                  style={{
                                    background:
                                      "linear-gradient(135deg,#6366f1,#ec4899)",
                                  }}
                                >
                                  <Mic size={20} className="text-white" />
                                </div>
                              ) : storyFiles[i]?.type.startsWith("video/") ? (
                                <div className="w-full h-full relative">
                                  <video
                                    src={url}
                                    className="w-full h-full object-cover"
                                    muted
                                    playsInline
                                    preload="none"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                    <VideoIcon
                                      size={18}
                                      className="text-white"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <img
                                  src={url}
                                  className="w-full h-full object-cover"
                                  decoding="async"
                                  crossOrigin="anonymous"
                                />
                              )}
                              <div className="absolute bottom-1 right-1 bg-black/50 rounded-full px-1.5 py-0.5">
                                <span className="text-white text-[9px] font-bold">
                                  {i + 1}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="relative w-full h-52 rounded-2xl overflow-hidden mb-4">
                          {storyMood === "grid" ? (
                            <div className="w-full h-full grid grid-cols-2 grid-rows-2">
                              {[0, 1, 2, 3].map((j) =>
                                storyFile?.type.startsWith("video/") ? (
                                  <video
                                    key={j}
                                    src={storyPreviewUrl}
                                    className="w-full h-full object-cover"
                                    muted
                                    playsInline
                                    loop
                                    autoPlay
                                  />
                                ) : (
                                  <img
                                    key={j}
                                    src={storyPreviewUrl}
                                    className="w-full h-full object-cover"
                                    style={{
                                      transform:
                                        j % 2 === 1 ? "scaleX(-1)" : undefined,
                                    }}
                                    decoding="async"
                                  />
                                ),
                              )}
                            </div>
                          ) : storyFile?.type.startsWith("video/") ? (
                            <video
                              src={storyPreviewUrl}
                              className="w-full h-full object-cover"
                              style={{
                                filter: STORY_MOOD_FILTER[storyMood] || "",
                              }}
                              muted
                              playsInline
                              loop
                              autoPlay
                            />
                          ) : (
                            <img
                              src={storyPreviewUrl}
                              className="w-full h-full object-cover"
                              style={{
                                filter: STORY_MOOD_FILTER[storyMood] || "",
                              }}
                              decoding="async"
                            />
                          )}
                          {storyMood === "sad" && <StoryRainOverlay />}
                          {storyMood === "party" && <StoryNeonOverlay />}
                          {storyIsHelp && <StoryHelpSticker />}
                          {(storyCaption || storyEmoji) && (
                            <div className="absolute bottom-3 left-0 right-0 text-center px-4">
                              <span className="text-white font-black text-base bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">
                                {storyEmoji} {storyCaption}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      {/* Caption */}
                      <input
                        value={storyCaption}
                        onChange={(e) => setStoryCaption(e.target.value)}
                        placeholder="Add a caption..."
                        className="w-full rounded-2xl px-4 py-3 text-base font-bold text-white outline-none border border-white/10 mb-3"
                        style={{ background: "rgba(255,255,255,0.08)" }}
                      />
                      {/* Emoji picker */}
                      <div className="flex gap-2 mb-3 flex-wrap">
                        {["🌹", "❤️", "🔥", "✨", "😍", "💫", "🎉", "💕"].map(
                          (em) => (
                            <button
                              key={em}
                              onClick={() =>
                                setStoryEmoji(storyEmoji === em ? "" : em)
                              }
                              className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${storyEmoji === em ? "bg-white/25 scale-110" : "bg-white/8 hover:bg-white/15"}`}
                            >
                              {em}
                            </button>
                          ),
                        )}
                      </div>
                      {/* Mute video toggle — only shown when a video file is selected */}
                      {storyFiles.some((f) => f.type.startsWith("video/")) && (
                        <button
                          type="button"
                          onClick={() => setMuteStoryVideo((v) => !v)}
                          className={`w-full py-2.5 rounded-2xl text-sm font-black border-2 mb-3 transition-all flex items-center justify-center gap-2 ${muteStoryVideo ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/50" : "bg-white/5 text-white/50 border-white/10"}`}
                        >
                          {muteStoryVideo
                            ? "🔇 Video Muted (Music Plays Over)"
                            : "🔊 Mute Video (Play Music Over It)"}
                        </button>
                      )}
                      {/* Mood / Filter selector */}
                      <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1.5">
                        Filter
                      </p>
                      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-3">
                        {[
                          { k: "", l: "✨ None" },
                          { k: "happy", l: "😊 Happy" },
                          { k: "sad", l: "😢 Sad" },
                          { k: "love", l: "❤️ Love" },
                          { k: "angry", l: "😡 Angry" },
                          { k: "party", l: "🎉 Party" },
                          { k: "chill", l: "😌 Chill" },
                          { k: "vibrant-gold", l: "🌟 Gold" },
                          { k: "cyberpunk", l: "⚡ Cyber" },
                          { k: "noir", l: "🎞 Noir" },
                          { k: "grid", l: "▦ Grid" },
                        ].map((m) => (
                          <button
                            key={m.k}
                            onClick={() => setStoryMood(m.k)}
                            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${storyMood === m.k ? "bg-white/20 text-white border-white/40" : "bg-white/5 text-white/50 border-white/10"}`}
                          >
                            {m.l}
                          </button>
                        ))}
                      </div>
                      {/* Background music upload */}
                      <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1.5">
                        Background Music
                      </p>
                      <input
                        ref={musicInputRef}
                        type="file"
                        accept="audio/*"
                        id="music-upload"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          setSelectedMusic(f);
                          setSelectedMusicName(f.name);
                          e.target.value = "";
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => musicInputRef.current?.click()}
                        className={`w-full py-2.5 rounded-2xl text-sm font-black border-2 mb-3 transition-all flex items-center justify-center gap-2 ${selectedMusic ? "bg-purple-500/20 text-purple-300 border-purple-500/50" : "bg-white/5 text-white/50 border-white/10"}`}
                      >
                        <Music size={15} />
                        {selectedMusic
                          ? `🎵 ${selectedMusicName.slice(0, 28)}${selectedMusicName.length > 28 ? "…" : ""}`
                          : "🎵 Add Background Music"}
                      </button>
                      {selectedMusic && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMusic(null);
                            setSelectedMusicName("");
                          }}
                          className="w-full py-1.5 rounded-xl text-xs text-red-400/70 mb-3"
                        >
                          ✕ Remove music
                        </button>
                      )}
                      {/* Madad toggle */}
                      <button
                        onClick={() => setStoryIsHelp((v) => !v)}
                        className={`w-full py-2.5 rounded-2xl text-sm font-black border-2 mb-4 transition-all ${storyIsHelp ? "bg-orange-500/20 text-orange-300 border-orange-500/50" : "bg-white/5 text-white/40 border-white/10"}`}
                      >
                        🆘{" "}
                        {storyIsHelp
                          ? "Madad Request ON"
                          : "Mark as Madad Request"}
                      </button>
                      {/* Upload progress */}
                      {uploadingStory && (
                        <div className="mb-3">
                          <div className="flex justify-between mb-1">
                            <span className="text-xs text-white/60 font-bold">
                              Uploading…
                            </span>
                            <span className="text-xs text-white/40">
                              {storyUploadProgress}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <motion.div
                              className="h-full rounded-full"
                              style={{
                                background:
                                  "linear-gradient(90deg,#f43f5e,#ef4444)",
                                width: `${storyUploadProgress}%`,
                              }}
                              transition={{ duration: 0.3 }}
                            />
                          </div>
                        </div>
                      )}
                      {/* Post button */}
                      <button
                        onClick={uploadStory}
                        disabled={uploadingStory}
                        className="w-full py-3.5 rounded-2xl text-white font-black text-base flex items-center justify-center gap-2 disabled:opacity-60 transition-all"
                        style={{
                          background: "linear-gradient(135deg,#f43f5e,#ef4444)",
                        }}
                      >
                        {uploadingStory ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />{" "}
                            Posting{" "}
                            {storyFiles.length > 1
                              ? `${storyFiles.length} Stories`
                              : ""}
                            ...
                          </>
                        ) : (
                          `Post ${storyFiles.length > 1 ? storyFiles.length + " Stories" : "Story"} 🌹`
                        )}
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
          </AnimatePresence>

          {/* ═══════ MAIN CONTENT ═══════════════════════════════════════════ */}
          <div className="flex-1 flex flex-col overflow-hidden relative z-10">
            {/* ════ CHAT LIST ══════════════════════════════════════════════ */}
            {bottomTab === "chat" && !selectedUser && (
              <div className={`flex flex-col flex-1 overflow-hidden`}>
                {/* Header */}
                <div
                  className={`flex items-center justify-between px-5 pt-5 pb-3 border-b ${T.divider} shrink-0`}
                >
                  <div>
                    <p
                      className={`text-xl font-black tracking-tight ${T.text1}`}
                    >
                      Messages
                    </p>
                    <p className={`text-xs font-semibold ${T.text3}`}>
                      {visibleContacts.length} conversations
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Theme switcher moved to Settings → Chat Theme */}
                    <button
                      onClick={onClose}
                      className={`w-8 h-8 rounded-xl bg-white/10 border ${T.divider} flex items-center justify-center ${T.text3}`}
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>

                {/* Full-width Search Bar */}
                <div className={`px-4 py-3 border-b ${T.divider} shrink-0`}>
                  <div className="relative">
                    <Search
                      size={16}
                      className={`absolute left-4 top-1/2 -translate-y-1/2 ${T.text3}`}
                    />
                    <input
                      type="text"
                      placeholder="Search friends or messages..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full rounded-3xl pl-11 pr-10 py-3 text-sm font-semibold outline-none border-2 focus:ring-0 transition-all ${T.searchBg}`}
                      style={{ fontSize: 15 }}
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center ${T.text3}`}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Story Row (only when not searching) */}
                {!searchQuery.trim() && <StoryRow />}

                {/* List */}
                <div className="flex-1 overflow-y-auto">
                  {searchQuery.trim() ? (
                    <>
                      <p
                        className={`text-[10px] font-black uppercase tracking-widest px-5 pt-3 pb-1 ${T.text3}`}
                      >
                        Search Results
                      </p>
                      {isSearching ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2
                            size={18}
                            className={`animate-spin ${T.text3}`}
                          />
                        </div>
                      ) : searchResults.length === 0 ? (
                        <p className={`text-xs px-5 py-3 ${T.text3}`}>
                          No users found
                        </p>
                      ) : (
                        searchResults.map((user) => (
                          <div
                            key={user.id}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                          >
                            <Avatar
                              url={user.avatar_url}
                              name={user.full_name}
                            />
                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-sm font-black truncate ${T.text1}`}
                              >
                                {user.full_name}
                              </p>
                              <p className={`text-[10px] ${T.text3}`}>
                                @{user.username}
                              </p>
                            </div>
                            <FriendActionBtn user={user} />
                          </div>
                        ))
                      )}
                    </>
                  ) : (
                    <>
                      {loadingContacts ? (
                        <div className="flex items-center justify-center py-10">
                          <Loader2
                            size={20}
                            className={`animate-spin ${T.text3}`}
                          />
                        </div>
                      ) : visibleContacts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 px-6 text-center">
                          <div
                            className={`w-16 h-16 rounded-3xl bg-white/5 border ${T.divider} flex items-center justify-center`}
                          >
                            <MessageSquare size={28} className={T.text3} />
                          </div>
                          <p className={`text-base font-black ${T.text3}`}>
                            No chats yet
                          </p>
                          <p className={`text-xs ${T.text3}`}>
                            Add friends and start chatting
                          </p>
                        </div>
                      ) : (
                        <>
                          <p
                            className={`text-[10px] font-black uppercase tracking-widest px-5 pt-3 pb-1 ${T.text3}`}
                          >
                            Recent Chats
                          </p>
                          {(() => {
                            let contactCount = 0;
                            return visibleContacts.map((c) => {
                              contactCount++;
                              const showAd = contactCount % 5 === 0;
                              return (
                            <div key={c.id}>
                            <motion.div
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors cursor-pointer relative"
                              onClick={() => handleSelectContact(c)}
                            >
                              <Avatar
                                url={c.avatar_url}
                                name={c.full_name}
                                online={onlineUsers.has(c.id)}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <p
                                    className={`text-sm font-black truncate ${T.text1}`}
                                  >
                                    {c.full_name}
                                  </p>
                                  <p
                                    className={`text-[10px] font-semibold shrink-0 ml-2 ${(c.unread_count ?? 0) > 0 ? "text-red-400" : T.text3}`}
                                  >
                                    {c.last_message_at
                                      ? formatTime(c.last_message_at)
                                      : ""}
                                  </p>
                                </div>
                                <div className="flex items-center justify-between gap-1">
                                  <div className="flex items-center gap-1 min-w-0 flex-1">
                                    {mutedChats.has(c.id) && (
                                      <VolumeX size={10} className={T.text3} />
                                    )}
                                    <p
                                      className={`text-xs truncate ${(c.unread_count ?? 0) > 0 ? `font-semibold ${T.text1}` : T.text3}`}
                                    >
                                      {lastMsgPreview(c) ||
                                        "Start a conversation"}
                                    </p>
                                  </div>
                                  {(c.unread_count ?? 0) > 0 && (
                                    <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center leading-none">
                                      {(c.unread_count ?? 0) > 99
                                        ? "99+"
                                        : c.unread_count}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMsgMenuId(
                                    msgMenuId === `contact-${c.id}`
                                      ? null
                                      : `contact-${c.id}`,
                                  );
                                }}
                                className={`w-7 h-7 rounded-lg flex items-center justify-center ${T.text3} hover:bg-white/10 shrink-0`}
                              >
                                <MoreVertical size={14} />
                              </button>
                              <AnimatePresence>
                                {msgMenuId === `contact-${c.id}` && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className={`absolute right-10 top-1/2 -translate-y-1/2 z-50 rounded-2xl border shadow-xl overflow-hidden min-w-[140px] ${T.msgMenuBg}`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      onClick={() => {
                                        toggleMute(c.id);
                                        setMsgMenuId(null);
                                      }}
                                      className={`flex items-center gap-2 w-full px-4 py-3 text-sm font-bold hover:bg-white/5 ${T.text1}`}
                                    >
                                      {mutedChats.has(c.id) ? (
                                        <>
                                          <Volume2 size={14} /> Unmute
                                        </>
                                      ) : (
                                        <>
                                          <VolumeX size={14} /> Mute
                                        </>
                                      )}
                                    </button>
                                    <button
                                      onClick={() => {
                                        toggleArchive(c.id);
                                        setMsgMenuId(null);
                                      }}
                                      className={`flex items-center gap-2 w-full px-4 py-3 text-sm font-bold hover:bg-white/5 ${T.text1}`}
                                    >
                                      <EyeOff size={14} /> Hide Chat
                                    </button>
                                    <button
                                      onClick={async () => {
                                        const fs = friendshipMap.get(c.id);
                                        if (!fs) return;
                                        await supabase
                                          .from("friendships")
                                          .delete()
                                          .eq("id", fs.id);
                                        await Promise.all([
                                          fetchFriendships(),
                                          fetchContacts(),
                                        ]);
                                        setMsgMenuId(null);
                                        toast.success(`${c.full_name} blocked`);
                                      }}
                                      className="flex items-center gap-2 w-full px-4 py-3 text-sm font-bold text-red-400 hover:bg-red-500/10"
                                    >
                                      <UserX size={14} /> Block (Kick)
                                    </button>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                            {showAd && (
                              <div className="px-4">
                                <AdsterraAd />
                              </div>
                            )}
                            </div>
                          );
                        });
                      })()}
                    </>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ════ FULL-SCREEN CHAT ════════════════════════════════════════ */}
            {bottomTab === "chat" && selectedUser && (
              <div className={`flex flex-col flex-1 overflow-hidden`}>
                {/* Top Bar */}
                <div
                  className={`flex items-center gap-3 px-4 py-3 border-b ${T.topbar} ${T.divider} shrink-0`}
                >
                  <button
                    onClick={() => {
                      setSelectedUser(null);
                      setMessages([]);
                      setShowChatSearch(false);
                      setChatSearch("");
                      setShowEmojiGrid(false);
                    }}
                    className={`w-10 h-10 rounded-2xl bg-white/10 border ${T.divider} flex items-center justify-center ${T.text1} hover:bg-white/20 active:scale-90 transition-all`}
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <div
                    className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
                    onClick={() => {
                      openProfile?.(selectedUser.id);
                      handlePanicUnlock();
                    }}
                  >
                    <Avatar
                      url={selectedUser.avatar_url}
                      name={selectedUser.full_name}
                      size="md"
                      online={onlineUsers.has(selectedUser.id)}
                    />
                    <div className="min-w-0">
                      <p
                        className={`text-base font-black truncate leading-tight ${T.text1}`}
                      >
                        {selectedUser.full_name}
                      </p>
                      {isOtherTyping ? (
                        <p className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                          Typing
                          <span className="flex gap-[3px] items-center">
                            {[0, 1, 2].map((i) => (
                              <span
                                key={i}
                                className="w-1 h-1 rounded-full bg-emerald-400 inline-block"
                                style={{
                                  animation: `bounce 1s ${i * 0.2}s infinite`,
                                }}
                              />
                            ))}
                          </span>
                        </p>
                      ) : (
                        <p
                          className={`text-[11px] font-semibold ${onlineUsers.has(selectedUser.id) ? "text-green-400" : "text-red-400"}`}
                        >
                          {onlineUsers.has(selectedUser.id)
                            ? "● Online"
                            : "● Offline"}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowChatSearch(!showChatSearch)}
                    className={`w-9 h-9 rounded-xl bg-white/10 border ${T.divider} flex items-center justify-center ${T.text1} hover:bg-white/20`}
                  >
                    <Search size={16} />
                  </button>
                  {/* Punch/boxing emoji blast removed per design overhaul */}
                  {/* Panic toggle */}
                  <button
                    onClick={() => setPanicMode((p) => !p)}
                    title="Panic Mode"
                    className={`w-9 h-9 rounded-xl border flex items-center justify-center text-base transition-all hover:bg-white/20 ${panicMode ? "bg-red-500/30 border-red-400/40 animate-pulse" : `bg-white/5 ${T.divider}`}`}
                  >
                    🔴
                  </button>
                  {/* 3-dot chat menu */}
                  <div className="relative">
                    <button
                      onClick={() => setShowChatMenu((p) => !p)}
                      className={`w-9 h-9 rounded-xl bg-white/10 border ${T.divider} flex items-center justify-center ${T.text1} hover:bg-white/20`}
                    >
                      <MoreVertical size={16} />
                    </button>
                    <AnimatePresence>
                      {showChatMenu && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9, y: 4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, y: 4 }}
                          style={{ zIndex: 9999 }}
                          className={`absolute right-0 top-12 rounded-2xl border shadow-2xl overflow-hidden min-w-[170px] ${T.msgMenuBg} text-white`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => {
                              // Mark every current message as "deleted for me" so the
                              // 3-second polling fallback never re-adds them from DB
                              messages.forEach((m) =>
                                deletedForMeIdsRef.current.add(m.id),
                              );
                              setMessages([]);
                              setShowChatMenu(false);
                              toast.success("Chat wiped locally 🧽");
                            }}
                            className={`flex items-center gap-2 w-full px-4 py-3 text-sm font-bold hover:bg-white/8 ${T.text1}`}
                          >
                            🧽 Wipe Chat
                          </button>
                          <button
                            onClick={() => {
                              if (selectedUser) {
                                toggleArchive(selectedUser.id);
                                setSelectedUser(null);
                                setMessages([]);
                                setShowChatMenu(false);
                              }
                            }}
                            className={`flex items-center gap-2 w-full px-4 py-3 text-sm font-bold hover:bg-white/8 ${T.text1}`}
                          >
                            🙈 Hide Chat
                          </button>
                          <button
                            onClick={() => {
                              setPanicMode(true);
                              setShowChatMenu(false);
                            }}
                            className="flex items-center gap-2 w-full px-4 py-3 text-sm font-bold text-red-400 hover:bg-red-500/10"
                          >
                            🖕 Panic Mode
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* ── Voice Mode Banner ─────────────────────────────────── */}
                <AnimatePresence>
                  {voiceMode && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden shrink-0"
                    >
                      <div className="flex items-center gap-3 px-4 py-2.5 bg-red-500/15 border-b border-red-500/20">
                        {/* Glowing pulsing mic */}
                        <div className="relative shrink-0">
                          <div className="absolute inset-0 rounded-full bg-red-500/40 animate-ping" />
                          <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white text-base relative z-10">
                            🎙️
                          </div>
                        </div>
                        {/* Status + timer */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-red-400 uppercase tracking-wider">
                            {voiceStatus === "listening"
                              ? "Listening…"
                              : "Processing…"}
                          </p>
                          <p className="text-[10px] text-white/40 font-semibold">
                            Say: Likh [msg] · Send · Sab Saaf · Panic Mode ·
                            Band Karo
                          </p>
                        </div>
                        {/* Countdown MM:SS */}
                        <div className="text-right shrink-0">
                          <p className="text-base font-black text-red-400 tabular-nums">
                            {String(Math.floor(voiceSecondsLeft / 60)).padStart(
                              2,
                              "0",
                            )}
                            :{String(voiceSecondsLeft % 60).padStart(2, "0")}
                          </p>
                          <button
                            onClick={stopVoiceMode}
                            className="text-[10px] font-black text-white/50 hover:text-red-400 uppercase tracking-wider transition-colors"
                          >
                            Stop
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* In-chat search */}
                <AnimatePresence>
                  {showChatSearch && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className={`px-4 py-2 border-b overflow-hidden ${T.divider}`}
                    >
                      <div className="relative">
                        <Search
                          size={13}
                          className={`absolute left-3 top-1/2 -translate-y-1/2 ${T.text3}`}
                        />
                        <input
                          autoFocus
                          type="text"
                          placeholder="Search in conversation..."
                          value={chatSearch}
                          onChange={(e) => setChatSearch(e.target.value)}
                          className={`w-full rounded-2xl pl-9 pr-4 py-2 text-sm font-semibold outline-none border ${T.searchBg}`}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Messages */}
                <div
                  className="flex-1 overflow-y-auto px-4 pt-20 pb-4 space-y-2"
                  onClick={() => {
                    setMsgMenuId(null);
                    setShowEmojiGrid(false);
                    setShowInputEmoji(false);
                  }}
                >
                  {loadingMessages ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2
                        size={20}
                        className={`animate-spin ${T.text3}`}
                      />
                    </div>
                  ) : filteredMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                      <p className="text-5xl">👋</p>
                      <p className={`text-base font-black ${T.text1}`}>
                        {chatSearch
                          ? "No messages found"
                          : `Hi ${selectedUser?.full_name?.split(" ")[0] || "there"}, kaise ho?`}
                      </p>
                      <p className={`text-xs ${T.text3}`}>
                        {chatSearch ? "" : "Pehla message bhejo!"}
                      </p>
                    </div>
                  ) : (
                    filteredMessages.map((msg) => {
                      const isMine =
                        String(msg.sender_id || "").trim() ===
                        String(userId || "").trim();
                      const quotedMsg = msg.reply_to_id
                        ? messages.find((m) => m.id === msg.reply_to_id)
                        : null;
                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          drag="x"
                          dragConstraints={{ left: 0, right: 64 }}
                          dragElastic={{ left: 0, right: 0.25 }}
                          dragDirectionLock
                          onDragEnd={(_e, info) => {
                            if (info.offset.x > 48) {
                              setReplyTo(msg);
                              setMsgMenuId(null);
                            }
                          }}
                          onPointerDown={(e) => {
                            longPressMsgPos.current = {
                              x: e.clientX,
                              y: e.clientY,
                            };
                            longPressTimerRef.current = setTimeout(() => {
                              try {
                                navigator.vibrate?.(10);
                              } catch (_) {}
                              setChatMsgAction({
                                msg,
                                x: longPressMsgPos.current.x,
                                y: longPressMsgPos.current.y,
                              });
                              setMsgMenuId(null);
                            }, 550);
                          }}
                          onPointerUp={() => {
                            if (longPressTimerRef.current)
                              clearTimeout(longPressTimerRef.current);
                          }}
                          onPointerLeave={() => {
                            if (longPressTimerRef.current)
                              clearTimeout(longPressTimerRef.current);
                          }}
                          className={`flex ${isMine ? "justify-end" : "justify-start"} group relative select-none`}
                          style={{ cursor: "default" }}
                        >
                          {/* Swipe hint icon */}
                          <div
                            className={`absolute ${isMine ? "left-0" : "right-0"} top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center opacity-0 group-active:opacity-60 pointer-events-none transition-opacity`}
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              className="text-white/60"
                            >
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                          </div>
                          <div className="relative max-w-[78%]">
                            {/* Quote block for replied message */}
                            {quotedMsg && (
                              <div
                                className={`mb-1 px-3 py-1.5 rounded-xl border-l-4 border-blue-400 bg-white/8 backdrop-blur-sm max-w-full`}
                              >
                                <p className="text-[10px] font-black text-blue-400 mb-0.5">
                                  {quotedMsg.sender_id === userId
                                    ? "You"
                                    : selectedUser?.full_name?.split(" ")[0]}
                                </p>
                                <p
                                  className={`text-[11px] font-semibold truncate ${T.text3}`}
                                >
                                  {quotedMsg.content || "📎 Media"}
                                </p>
                              </div>
                            )}
                            <div
                              className={`px-4 py-2.5 rounded-2xl ${isMine ? `${T.bubbleSent} rounded-tr-sm` : `${T.bubbleRecv} rounded-tl-sm`}`}
                            >
                              {msg.media_url && msg.media_type ? (
                                <MediaBubble
                                  url={msg.media_url}
                                  type={msg.media_type}
                                />
                              ) : editingMsg?.id === msg.id ? (
                                <div
                                  className="min-w-[180px]"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <textarea
                                    className="w-full rounded-xl px-2 py-1.5 text-base font-bold outline-none resize-none bg-white/20 border border-white/30 text-inherit"
                                    rows={2}
                                    value={editingMsg.text}
                                    onChange={(e) =>
                                      setEditingMsg((prev) =>
                                        prev
                                          ? { ...prev, text: e.target.value }
                                          : null,
                                      )
                                    }
                                    autoFocus
                                  />
                                  <div className="flex gap-1.5 mt-1.5">
                                    <button
                                      onClick={() => setEditingMsg(null)}
                                      className="flex-1 py-1 rounded-lg bg-white/15 text-[11px] font-bold opacity-70"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={saveEditMsg}
                                      className="flex-1 py-1 rounded-lg bg-blue-500 text-white text-[11px] font-bold"
                                    >
                                      Save
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <p className="text-lg font-bold leading-snug break-words">
                                    {msg.content}
                                  </p>
                                  {msg.is_edited && (
                                    <p className="text-[10px] opacity-40 italic mt-0.5">
                                      (edited)
                                    </p>
                                  )}
                                </>
                              )}
                              <p
                                className={`text-[10px] mt-0.5 font-medium ${isMine ? "text-white/50" : T.text3} text-right flex items-center justify-end gap-1`}
                              >
                                {formatTime(msg.created_at)}
                                <MessageStatus msg={msg} />
                              </p>
                            </div>
                            {/* Reaction Bubbles */}
                            {msgReactions[msg.id] &&
                              Object.keys(msgReactions[msg.id]).length > 0 && (
                                <ReactionBubbles
                                  reactions={msgReactions[msg.id]}
                                  currentUserId={userId}
                                  align={isMine ? "right" : "left"}
                                />
                              )}
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className={`border-t ${T.divider} ${T.input} shrink-0`}>
                  {/* Reply preview bar */}
                  <AnimatePresence>
                    {replyTo && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className={`flex items-center gap-2 px-4 py-2 border-b ${T.divider} bg-white/5`}
                      >
                        <div className="w-0.5 h-8 rounded-full bg-blue-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-black text-blue-400">
                            {replyTo.sender_id === userId
                              ? "You"
                              : selectedUser?.full_name?.split(" ")[0]}
                          </p>
                          <p className={`text-[11px] truncate ${T.text3}`}>
                            {replyTo.content || "📎 Media"}
                          </p>
                        </div>
                        <button
                          onClick={() => setReplyTo(null)}
                          className={`w-6 h-6 rounded-full bg-white/10 flex items-center justify-center ${T.text3} hover:bg-white/20`}
                        >
                          <X size={11} />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Emoji grid (input picker) */}
                  <AnimatePresence>
                    {showInputEmoji && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className={`border-b ${T.divider} overflow-hidden`}
                      >
                        <div className="p-3 grid grid-cols-7 gap-1.5">
                          {INPUT_EMOJIS.map((em) => (
                            <button
                              key={em}
                              onClick={() => setNewMessage((prev) => prev + em)}
                              className="w-9 h-9 rounded-xl text-xl flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all"
                            >
                              {em}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Pending file preview strip */}
                  <AnimatePresence>
                    {pendingFile && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className={`flex items-center gap-3 px-4 py-2 border-b ${T.divider} bg-white/5`}
                      >
                        {pendingFile.type.startsWith("image/") &&
                          pendingFilePreview && (
                            <img
                              src={pendingFilePreview}
                              className="w-12 h-12 rounded-xl object-cover shrink-0"
                              decoding="async"
                            />
                          )}
                        {pendingFile.type.startsWith("video/") &&
                          pendingFilePreview && (
                            <video
                              src={pendingFilePreview}
                              className="w-16 h-12 rounded-xl object-cover shrink-0 bg-black"
                              muted
                              playsInline
                              preload="none"
                            />
                          )}
                        {pendingFile.type.startsWith("audio/") && (
                          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
                            <Music size={18} className="text-blue-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-xs font-bold ${T.text1} truncate`}
                          >
                            {pendingFile.name}
                          </p>
                          <p className={`text-[10px] ${T.text3}`}>
                            {pendingFile.type.startsWith("video/")
                              ? "🎥 Video"
                              : pendingFile.type.startsWith("audio/")
                                ? " ��� Audio"
                                : "🖼️ Image"}
                            {" · "}
                            {(pendingFile.size / (1024 * 1024)).toFixed(1)} MB
                          </p>
                        </div>
                        <button
                          onClick={clearPendingFile}
                          className={`w-6 h-6 rounded-full bg-white/10 flex items-center justify-center ${T.text3} hover:bg-red-500/50 transition-colors`}
                        >
                          <X size={11} />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex items-end gap-2 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
                    {/* Emoji button — left of textarea */}
                    <button
                      onClick={() => setShowInputEmoji((p) => !p)}
                      className={`w-10 h-10 rounded-2xl border ${T.divider} flex items-center justify-center text-xl hover:bg-white/20 shrink-0 transition-all ${showInputEmoji ? "bg-white/20" : "bg-white/10"}`}
                    >
                      😊
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingMedia}
                      className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 disabled:opacity-40 transition-colors
                        ${pendingFile ? "bg-blue-500 border-blue-400 text-white" : `bg-white/10 ${T.divider} ${T.text3} hover:bg-white/20`}`}
                    >
                      {isUploadingMedia ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Paperclip size={16} />
                      )}
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      onChange={handleMediaUpload}
                      accept="image/*,video/*,audio/*"
                    />
                    <textarea
                      value={newMessage}
                      onChange={(e) => {
                        setNewMessage(e.target.value);
                        handleTyping();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      placeholder="Type a message..."
                      rows={1}
                      className={`flex-1 rounded-full px-5 py-2.5 text-base font-medium outline-none border resize-none max-h-28 overflow-y-auto ${T.searchBg} focus:ring-2 focus:ring-[#25D366]/40`}
                    />
                    <button
                      onClick={() => {
                        sendMessage();
                      }}
                      disabled={
                        (!newMessage.trim() && !pendingFile) ||
                        isSending ||
                        isUploadingMedia
                      }
                      className={`w-11 h-11 rounded-full flex items-center justify-center text-white shrink-0 active:scale-90 disabled:opacity-40 shadow-lg ${T.accent}`}
                    >
                      {isSending || isUploadingMedia ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Send size={16} />
                      )}
                    </button>
                    {/* Mic / Voice Mode button */}
                    <button
                      onClick={() =>
                        voiceMode ? stopVoiceMode() : startVoiceMode()
                      }
                      className={`w-10 h-10 rounded-2xl border flex items-center justify-center text-lg shrink-0 active:scale-90 transition-all
                        ${voiceMode ? "bg-red-500 border-red-400 animate-pulse text-white" : `bg-white/10 ${T.divider} hover:bg-white/20`}`}
                    >
                      🎙️
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ════ STORY TAB ══════════════════════════════════════════════ */}
            {bottomTab === "story" && (
              <div className={`flex flex-col flex-1 overflow-hidden`}>
                <div
                  className={`flex items-center justify-between px-5 pt-5 pb-3 border-b ${T.divider} shrink-0`}
                >
                  <div>
                    <p className={`text-xl font-black ${T.text1}`}>Stories</p>
                    <p className={`text-xs font-semibold ${T.text3}`}>
                      24-hour moments
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className={`w-8 h-8 rounded-xl bg-white/10 border ${T.divider} flex items-center justify-center ${T.text3}`}
                  >
                    <X size={15} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-6">
                  <button
                    onClick={() => storyInputRef.current?.click()}
                    className={`flex items-center gap-4 p-4 rounded-2xl border ${T.divider} bg-white/5 mb-6 w-full hover:bg-white/10 active:scale-98 transition-all`}
                  >
                    <div
                      className={`w-14 h-14 rounded-full border-2 border-dashed ${T.storyRing} flex items-center justify-center text-2xl`}
                    >
                      +
                    </div>
                    <div className="text-left">
                      <p className={`text-base font-black ${T.text1}`}>
                        Add to Your Story
                      </p>
                      <p className={`text-xs ${T.text3}`}>
                        Share a photo with caption & emoji
                      </p>
                    </div>
                  </button>
                  <input
                    ref={storyInputRef}
                    type="file"
                    accept="image/*,video/*,audio/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const allFiles = Array.from(e.target.files || []).slice(
                        0,
                        10,
                      );
                      if (allFiles.length === 0) return;
                      const oversized = allFiles.find(
                        (f) =>
                          f.type.startsWith("video/") &&
                          f.size > 30 * 1024 * 1024,
                      );
                      if (oversized) {
                        toast.error("Please shorten your file under 30MB");
                        e.target.value = "";
                        return;
                      }
                      const files = allFiles;
                      setStoryFiles(files);
                      setStoryPreviews(
                        files.map((f) => URL.createObjectURL(f)),
                      );
                      setStoryFile(files[0]);
                      setStoryPreviewUrl(URL.createObjectURL(files[0]));
                      setShowStoryEditor(true);
                      e.target.value = "";
                    }}
                  />
                  <p
                    className={`text-[10px] font-black uppercase tracking-widest mb-3 ${T.text3}`}
                  >
                    Recent Stories
                  </p>
                  {loadingStories ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2
                        size={20}
                        className={`animate-spin ${T.text3}`}
                      />
                    </div>
                  ) : storyGroups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                      <p className="text-5xl">🔥</p>
                      <p className={`text-base font-black ${T.text3}`}>
                        No stories available. Start the fire! 🔥
                      </p>
                      <p className={`text-xs ${T.text3}`}>
                        Be the first to post a story today
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {storyGroups.map((group, gi) => {
                        const story = group.stories[0];
                        const pName = group.profile?.full_name || "User";
                        const aUrl = group.profile?.avatar_url;
                        return (
                          <motion.button
                            key={group.user_id}
                            onClick={() => {
                              setViewerGroupIdx(gi);
                              setViewerStoryIdx(0);
                              setStoryElapsed(0);
                              storyViewedRef.current.clear();
                              setStoryViewerOpen(true);
                            }}
                            className={`relative h-48 rounded-2xl overflow-hidden border ${T.divider} cursor-pointer`}
                            whileTap={{ scale: 0.97 }}
                          >
                            {story.media_type === "voice" ? (
                              <div
                                className="w-full h-full flex flex-col items-center justify-center gap-2"
                                style={{
                                  background: `linear-gradient(160deg,${_sgradFor(group.user_id)},#0f172a)`,
                                }}
                              >
                                <Mic size={24} className="text-white/80" />
                                <span className="text-white/50 text-xs">
                                  Voice Story
                                </span>
                              </div>
                            ) : (
                              <img
                                src={getStoryMediaUrl(story.image_url)}
                                className="w-full h-full object-cover"
                                style={{
                                  filter:
                                    STORY_MOOD_FILTER[story.mood ?? ""] ?? "",
                                }}
                                decoding="async"
                                crossOrigin="anonymous"
                                onError={onStoryMediaError}
                              />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                            {group.stories.length > 1 && (
                              <div className="absolute top-2 right-2 bg-black/60 rounded-full px-2 py-0.5">
                                <span className="text-white text-[10px] font-black">
                                  {group.stories.length}
                                </span>
                              </div>
                            )}
                            {story.is_help_request && (
                              <div className="absolute top-2 left-2 bg-orange-500 rounded-full px-1.5 py-0.5">
                                <span className="text-white text-[10px] font-black">
                                  🆘
                                </span>
                              </div>
                            )}
                            <div className="absolute top-2 left-2">
                              {aUrl ? (
                                <img
                                  src={aUrl}
                                  className="w-8 h-8 rounded-full object-cover border border-white/60"
                                  decoding="async"
                                  crossOrigin="anonymous"
                                />
                              ) : (
                                <div
                                  className="w-8 h-8 rounded-full border border-white/60 flex items-center justify-center text-white font-black text-sm"
                                  style={{
                                    background: _sgradFor(group.user_id),
                                  }}
                                >
                                  {pName[0]}
                                </div>
                              )}
                            </div>
                            <div className="absolute bottom-2 left-2 right-2">
                              {story.caption && (
                                <p className="text-white text-xs font-black truncate">
                                  {story.emoji} {story.caption}
                                </p>
                              )}
                              <p className="text-white/60 text-[10px]">
                                {pName.split(" ")[0]}
                              </p>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ════ ALERT TAB ══════════════════════════════════════════════ */}
            {bottomTab === "alert" && (
              <div className={`flex flex-col flex-1 overflow-hidden`}>
                <div
                  className={`flex items-center justify-between px-5 pt-5 pb-3 border-b ${T.divider} shrink-0`}
                >
                  <div>
                    <p className={`text-xl font-black ${T.text1}`}>Alerts</p>
                    <p className={`text-xs font-semibold ${T.text3}`}>
                      {unreadAlerts} unread
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {alerts.length > 0 && (
                      <button
                        onClick={() =>
                          setAlerts((prev) =>
                            prev.map((a) => ({ ...a, read: true })),
                          )
                        }
                        className={`text-xs font-black px-3 py-1.5 rounded-xl ${T.pill}`}
                      >
                        Mark all read
                      </button>
                    )}
                    <button
                      onClick={onClose}
                      className={`w-8 h-8 rounded-xl bg-white/10 border ${T.divider} flex items-center justify-center ${T.text3}`}
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {pendingCount > 0 && (
                    <div
                      className={`mx-4 mt-4 p-4 rounded-2xl border ${T.divider} bg-blue-500/10 cursor-pointer hover:bg-blue-500/20 transition-all`}
                      onClick={() => {
                        setBottomTab("menu");
                        setMenuPanel("requests");
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                          <Users size={18} className="text-blue-400" />
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-black ${T.text1}`}>
                            {pendingCount} Friend Request
                            {pendingCount > 1 ? "s" : ""}
                          </p>
                          <p className={`text-xs ${T.text3}`}>Tap to view</p>
                        </div>
                        <span className="w-6 h-6 rounded-full bg-red-500 text-white text-xs font-black flex items-center justify-center">
                          {pendingCount}
                        </span>
                      </div>
                    </div>
                  )}
                  {alerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6">
                      <p className="text-5xl">🔔</p>
                      <p className={`text-base font-black ${T.text3}`}>
                        All clear!
                      </p>
                      <p className={`text-xs ${T.text3}`}>
                        Chat and system notifications appear here
                      </p>
                    </div>
                  ) : (
                    <div className="py-2">
                      {alerts.map((a) => (
                        <div
                          key={a.id}
                          className={`flex items-start gap-3 px-4 py-3.5 hover:bg-white/5 cursor-pointer ${!a.read ? "bg-blue-500/5" : ""}`}
                          onClick={() =>
                            setAlerts((prev) =>
                              prev.map((x) =>
                                x.id === a.id ? { ...x, read: true } : x,
                              ),
                            )
                          }
                        >
                          <div
                            className={`w-2 h-2 rounded-full mt-2 shrink-0 ${a.read ? "bg-transparent" : "bg-blue-400"}`}
                          />
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm font-bold leading-snug ${T.text1}`}
                            >
                              {a.text}
                            </p>
                            <p
                              className={`text-[10px] font-medium mt-0.5 ${T.text3}`}
                            >
                              {a.time}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ════ MENU TAB ════════════════════════════════════════════════ */}
            {bottomTab === "menu" && (
              <div className={`flex flex-col flex-1 overflow-hidden`}>
                <div
                  className={`flex items-center justify-between px-5 pt-5 pb-3 border-b ${T.divider} shrink-0`}
                >
                  <div className="flex items-center gap-2">
                    {menuPanel !== "main" && (
                      <button
                        onClick={() => setMenuPanel("main")}
                        className={`w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center ${T.text1}`}
                      >
                        <ArrowLeft size={16} />
                      </button>
                    )}
                    <div>
                      <p className={`text-xl font-black ${T.text1}`}>
                        {menuPanel === "main"
                          ? "Menu"
                          : menuPanel === "settings"
                            ? "Settings"
                            : menuPanel === "archive"
                              ? "Archive"
                              : "Requests"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className={`w-8 h-8 rounded-xl bg-white/10 border ${T.divider} flex items-center justify-center ${T.text3}`}
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Main menu */}
                {menuPanel === "main" && (
                  <div className="flex-1 overflow-y-auto py-4 px-4 space-y-2">
                    {myProfile && (
                      <div
                        className={`flex items-center gap-4 p-4 rounded-2xl border ${T.divider} bg-white/5 mb-4`}
                      >
                        <Avatar
                          url={myProfile.avatar_url}
                          name={myProfile.full_name}
                          size="lg"
                          online={activeStatus}
                        />
                        <div>
                          <p className={`text-base font-black ${T.text1}`}>
                            {myProfile.full_name}
                          </p>
                          <p className={`text-xs ${T.text3}`}>
                            @{myProfile.username}
                          </p>
                          {myProfile.bio && (
                            <p className={`text-xs mt-0.5 italic ${T.text2}`}>
                              "{myProfile.bio}"
                            </p>
                          )}
                          {myProfile.school && (
                            <p className={`text-xs ${T.text3}`}>
                              🎓 {myProfile.school}
                            </p>
                          )}
                          {myProfile.location && (
                            <p className={`text-xs ${T.text3}`}>
                              📍 {myProfile.location}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    {[
                      {
                        icon: <Settings size={18} />,
                        label: "Settings",
                        desc: "Bio, school, location, status",
                        action: () => setMenuPanel("settings"),
                      },
                      {
                        icon: <Archive size={18} />,
                        label: "Archive",
                        desc: `${archivedContactsList.length} hidden chat${archivedContactsList.length !== 1 ? "s" : ""}`,
                        action: () => setMenuPanel("archive"),
                        badge: 0,
                      },
                      {
                        icon: <Users size={18} />,
                        label: "Message Requests",
                        desc: `${pendingCount} pending`,
                        action: () => setMenuPanel("requests"),
                        badge: pendingCount,
                      },
                      ...(isAdmin
                        ? [
                            {
                              icon: (
                                <Shield size={18} className="text-amber-400" />
                              ),
                              label: "Admin Dashboard",
                              desc: "Moderate users & content",
                              action: () => setShowAdminDashboard(true),
                              badge: 0,
                            },
                          ]
                        : []),
                    ].map((item) => (
                      <button
                        key={item.label}
                        onClick={item.action}
                        className={`flex items-center justify-between w-full p-4 rounded-2xl border ${T.divider} bg-white/5 hover:bg-white/10 transition-all text-left`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center ${T.text2}`}
                          >
                            {item.icon}
                          </div>
                          <div>
                            <p className={`text-sm font-black ${T.text1}`}>
                              {item.label}
                            </p>
                            <p className={`text-[10px] ${T.text3}`}>
                              {item.desc}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.badge ? (
                            <span className="w-5 h-5 bg-red-500 rounded-full text-white text-[10px] font-black flex items-center justify-center">
                              {item.badge}
                            </span>
                          ) : null}
                          <ChevronLeft
                            size={14}
                            className={`rotate-180 ${T.text3}`}
                          />
                        </div>
                      </button>
                    ))}
                    <button
                      onClick={onLogout || onClose}
                      className="flex items-center gap-3 w-full p-4 rounded-2xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-all text-left mt-4"
                    >
                      <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
                        <LogOut size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-red-400">
                          Logout
                        </p>
                        <p className={`text-[10px] ${T.text3}`}>
                          Sign out of your account
                        </p>
                      </div>
                    </button>
                  </div>
                )}

                {/* Settings */}
                {menuPanel === "settings" && (
                  <div className="flex-1 overflow-y-auto py-4 px-4 space-y-4">
                    <div
                      className={`p-4 rounded-2xl border ${T.divider} bg-white/5`}
                    >
                      <p
                        className={`text-xs font-black uppercase tracking-widest mb-3 ${T.text3}`}
                      >
                        Chat Theme
                      </p>
                      <div className="flex gap-3">
                        {(
                          ["whatsapp", "water", "nature", "velvet"] as Theme[]
                        ).map((t) => (
                          <button
                            key={t}
                            onClick={() => setTheme(t)}
                            className={`flex-1 py-3 rounded-2xl border-2 transition-all font-black text-xs ${theme === t ? `border-blue-500 bg-blue-500/10 ${T.text1}` : `border-transparent bg-white/5 ${T.text3}`}`}
                          >
                            <div className="text-xl mb-1">
                              {THEME_CFG[t].icon}
                            </div>
                            {THEME_CFG[t].label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div
                      className={`p-4 rounded-2xl border ${T.divider} bg-white/5`}
                    >
                      <p
                        className={`text-xs font-black uppercase tracking-widest mb-3 ${T.text3}`}
                      >
                        Active Status
                      </p>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`text-sm font-black ${T.text1}`}>
                            Active Status
                          </p>
                          <p className={`text-xs ${T.text3}`}>
                            {activeStatus
                              ? "You appear Online 🟢"
                              : "You appear Offline 🔴"}
                          </p>
                        </div>
                        <button
                          onClick={() => setActiveStatus(!activeStatus)}
                          className={`relative w-12 h-6 rounded-full transition-all border ${activeStatus ? "bg-green-500 border-green-400" : "bg-gray-500 border-gray-400"}`}
                        >
                          <div
                            className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${activeStatus ? "left-6" : "left-0.5"}`}
                          />
                        </button>
                      </div>
                    </div>
                    <div
                      className={`p-4 rounded-2xl border ${T.divider} bg-white/5`}
                    >
                      <p
                        className={`text-xs font-black uppercase tracking-widest mb-3 ${T.text3}`}
                      >
                        Notification Sound
                      </p>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`text-sm font-black ${T.text1}`}>
                            Message Sounds
                          </p>
                          <p className={`text-xs ${T.text3}`}>
                            {soundEnabled
                              ? "🔊 Sound On — ping on message"
                              : "🔇 Muted — no sound"}
                          </p>
                        </div>
                        <button
                          onClick={() => setSoundEnabled((s) => !s)}
                          className={`relative w-12 h-6 rounded-full transition-all border ${soundEnabled ? "bg-blue-500 border-blue-400" : "bg-gray-500 border-gray-400"}`}
                        >
                          <div
                            className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${soundEnabled ? "left-6" : "left-0.5"}`}
                          />
                        </button>
                      </div>
                    </div>
                    <div
                      className={`p-4 rounded-2xl border ${T.divider} bg-white/5`}
                    >
                      <p
                        className={`text-xs font-black uppercase tracking-widest mb-3 ${T.text3}`}
                      >
                        Personal Info
                      </p>
                      <div className="space-y-3">
                        {[
                          {
                            icon: <Info size={14} />,
                            label: "Bio",
                            value: editBio,
                            setter: setEditBio,
                            placeholder: "Write a short bio...",
                          },
                          {
                            icon: <GraduationCap size={14} />,
                            label: "School",
                            value: editSchool,
                            setter: setEditSchool,
                            placeholder: "Your school or college...",
                          },
                          {
                            icon: <MapPin size={14} />,
                            label: "Location",
                            value: editLocation,
                            setter: setEditLocation,
                            placeholder: "City, Country...",
                          },
                        ].map((f) => (
                          <div key={f.label}>
                            <p
                              className={`text-[10px] font-black uppercase tracking-wider mb-1.5 flex items-center gap-1 ${T.text3}`}
                            >
                              {f.icon} {f.label}
                            </p>
                            <input
                              value={f.value}
                              onChange={(e) => f.setter(e.target.value)}
                              placeholder={f.placeholder}
                              className={`w-full rounded-xl px-3 py-2.5 text-sm font-semibold outline-none border focus:ring-2 focus:ring-blue-500/30 ${T.searchBg}`}
                            />
                          </div>
                        ))}
                        <button
                          onClick={saveProfileSettings}
                          disabled={savingProfile}
                          className={`w-full py-3 rounded-2xl text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60 ${T.accent}`}
                        >
                          {savingProfile ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />{" "}
                              Saving...
                            </>
                          ) : (
                            "Save Changes"
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Archive */}
                {menuPanel === "archive" && (
                  <div className="flex-1 overflow-y-auto">
                    {archivedContactsList.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6">
                        <p className="text-5xl">📦</p>
                        <p className={`text-base font-black ${T.text3}`}>
                          No hidden chats
                        </p>
                        <p className={`text-xs ${T.text3}`}>
                          Use 3-dot menu on a chat to hide it here
                        </p>
                      </div>
                    ) : (
                      <div className="py-2">
                        <p
                          className={`text-[10px] font-black uppercase tracking-widest px-5 pt-3 pb-1 ${T.text3}`}
                        >
                          Hidden Chats ({archivedContactsList.length})
                        </p>
                        {archivedContactsList.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 cursor-pointer"
                            onClick={() => {
                              handleSelectContact(c);
                              setBottomTab("chat");
                              setMenuPanel("main");
                            }}
                          >
                            <Avatar url={c.avatar_url} name={c.full_name} />
                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-sm font-black truncate ${T.text1}`}
                              >
                                {c.full_name}
                              </p>
                              <div className="flex items-center justify-between gap-1">
                                <p
                                  className={`text-xs truncate flex-1 ${(c.unread_count ?? 0) > 0 ? `font-semibold ${T.text1}` : T.text3}`}
                                >
                                  {lastMsgPreview(c) || "No messages"}
                                </p>
                                {(c.unread_count ?? 0) > 0 && (
                                  <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center leading-none">
                                    {(c.unread_count ?? 0) > 99
                                      ? "99+"
                                      : c.unread_count}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleArchive(c.id);
                              }}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black ${T.pill}`}
                            >
                              <Eye size={11} /> Unhide
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Requests */}
                {menuPanel === "requests" && (
                  <div className="flex-1 overflow-y-auto">
                    {pendingRequests.length === 0 &&
                    messageRequests.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6">
                        <p className="text-5xl">📨</p>
                        <p className={`text-base font-black ${T.text3}`}>
                          No requests
                        </p>
                        <p className={`text-xs ${T.text3}`}>
                          Friend requests and messages from people you don't
                          know appear here
                        </p>
                      </div>
                    ) : (
                      <div className="py-2">
                        {/* Message requests (non-friend chats) */}
                        {messageRequests.length > 0 && (
                          <>
                            <p
                              className={`text-[10px] font-black uppercase tracking-widest px-5 pt-3 pb-1 ${T.text3}`}
                            >
                              Message Requests ({messageRequests.length})
                            </p>
                            {messageRequests.map((c) => (
                              <button
                                key={`mr-${c.id}`}
                                onClick={() => handleSelectContact(c)}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-left"
                              >
                                <Avatar url={c.avatar_url} name={c.full_name} />
                                <div className="flex-1 min-w-0">
                                  <p
                                    className={`text-sm font-black truncate ${T.text1}`}
                                  >
                                    {c.full_name}
                                  </p>
                                  <p
                                    className={`text-[11px] truncate ${T.text3}`}
                                  >
                                    {c.last_message || "Sent you a message"}
                                  </p>
                                </div>
                                {(c.unread_count || 0) > 0 && (
                                  <div
                                    className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center text-white ${T.accent}`}
                                  >
                                    {c.unread_count}
                                  </div>
                                )}
                              </button>
                            ))}
                          </>
                        )}
                        {pendingRequests.length > 0 && (
                          <p
                            className={`text-[10px] font-black uppercase tracking-widest px-5 pt-3 pb-1 ${T.text3}`}
                          >
                            Incoming Friend Requests ({pendingCount})
                          </p>
                        )}
                        {pendingRequests.map((req) => {
                          const busy = actionLoading === req.id;
                          return (
                            <motion.div
                              key={req.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="flex items-center gap-3 px-4 py-3.5 hover:bg-white/5"
                            >
                              <Avatar
                                url={req.profile.avatar_url}
                                name={req.profile.full_name}
                              />
                              <div className="flex-1 min-w-0">
                                <p
                                  className={`text-sm font-black truncate ${T.text1}`}
                                >
                                  {req.profile.full_name}
                                </p>
                                <p className={`text-[10px] ${T.text3}`}>
                                  @{req.profile.username}
                                </p>
                              </div>
                              <div className="flex gap-1.5 shrink-0">
                                <button
                                  onClick={() => acceptRequest(req)}
                                  disabled={busy}
                                  className="w-9 h-9 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center text-green-400 hover:bg-green-500/40 disabled:opacity-40"
                                >
                                  {busy ? (
                                    <Loader2
                                      size={13}
                                      className="animate-spin"
                                    />
                                  ) : (
                                    <Check size={13} />
                                  )}
                                </button>
                                <button
                                  onClick={() => rejectRequest(req)}
                                  disabled={busy}
                                  className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/20 disabled:opacity-40"
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ════ BOTTOM NAV (z-[60] inside fixed context = always on top) ═══ */}
          {!selectedUser && (
            <div
              className={`shrink-0 border-t ${T.nav} ${T.divider}`}
              style={{ zIndex: 60 }}
            >
              <div className="flex items-center px-2 pb-safe">
                {[
                  {
                    tab: "chat" as BottomTab,
                    icon: <MessageSquare size={22} />,
                    label: "Chat",
                    badge: 0,
                  },
                  {
                    tab: "story" as BottomTab,
                    icon: <BookOpen size={22} />,
                    label: "Story",
                    badge: 0,
                  },
                  {
                    tab: "alert" as BottomTab,
                    icon: <Bell size={22} />,
                    label: "Alert",
                    badge: unreadAlerts,
                  },
                  {
                    tab: "menu" as BottomTab,
                    icon: <LayoutGrid size={22} />,
                    label: "Menu",
                    badge: pendingCount,
                  },
                ].map(({ tab, icon, label, badge }) => (
                  <button
                    key={tab}
                    onClick={() => {
                      setBottomTab(tab);
                      if (tab !== "menu") setMenuPanel("main");
                    }}
                    className={`flex-1 flex flex-col items-center gap-1 py-3.5 transition-all relative ${bottomTab === tab ? T.accentText : T.text3}`}
                  >
                    <div
                      className={`relative transition-transform ${bottomTab === tab ? "scale-110" : "scale-100"}`}
                    >
                      {icon}
                      {badge > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] font-black flex items-center justify-center">
                          {badge > 9 ? "9+" : badge}
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-black uppercase tracking-widest ${bottomTab === tab ? T.accentText : T.text3}`}
                    >
                      {label}
                    </span>
                    {bottomTab === tab && (
                      <motion.div
                        layoutId="nav-indicator"
                        className={`absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full ${T.accent}`}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* ── Admin Dashboard overlay ───────────────────────────────────── */}
          <AnimatePresence>
            {showAdminDashboard && isAdmin && (
              <AdminDashboard
                onClose={() => setShowAdminDashboard(false)}
                currentUserId={userId}
                currentUserEmail={userEmail}
              />
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ChatSystem;
