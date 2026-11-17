import React, { useState, useEffect, useRef, useCallback } from "react";
import { ReactionBubbles } from "./ReactionBar";
import { useSoundEffects } from "../hooks/useSoundEffects";
import { useProfileViewer } from "../context/ProfileViewerContext";
import { useActiveHide } from "../context/OnlineUsersContext";
import ActiveStatusAvatar from "./ActiveStatusAvatar";
import AutoPlayMutedVideo from "./AutoPlayMutedVideo";
import { motion, AnimatePresence } from "framer-motion";
import AdminDashboard from "./AdminDashboard";
import { isAdminEmail } from "../lib/adminConfig";
import { requestShareModal } from "../lib/shareModal";
import {
  canViewPrivateProfile,
  searchVisibleProfiles
} from "../lib/profileSearch";
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
  ChevronDown,
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
  Image,
  Mic,
  Pencil,
  Download,
  Share2,
  VideoIcon,
  Shield,
  Phone,
  Disc3,
  Play,
  Pause
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { subscribeWhileVisible } from "@/lib/realtimeVisibility";
import { toast } from "sonner";
import { parseMessage } from "../lib/messageParser";
import { ChatSticker } from "./ChatSticker";
import { StickerDrawer } from "./StickerDrawer";
import {
  hasRiskKeyword,
  incrementRiskScore,
  getRiskProfile,
  checkLoveProtectViolation,
  sendSafetyNotification
} from "../lib/safetyEngine";
const CHAT_BUCKET = "chat-images";
const revokeObjectUrl = (url) => {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
};
const formatMusicTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
};
const SUPABASE_STORAGE_BASE = "https://rxwvvhvretostbiknuek.supabase.co/storage/v1/object/public";
const getStoryMediaUrl = (url) => {
  if (!url || !url.trim()) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("data:")) return url;
  const cleanPath = url.startsWith("/") ? url.substring(1) : url;
  return `${SUPABASE_STORAGE_BASE}/stories/${cleanPath}`;
};
const onStoryMediaError = (e) => {
  const el = e.currentTarget;
  el.style.display = "none";
  const parent = el.parentElement;
  if (!parent) return;
  parent.style.background = "linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#1e293b 100%)";
  if (!parent.querySelector(".story-err-fb")) {
    const fb = document.createElement("div");
    fb.className = "story-err-fb";
    fb.style.cssText = "position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;pointer-events:none";
    fb.innerHTML = '<span style="font-size:2rem">\xF0\u0178\u201C\u2013</span><span style="color:rgba(255,255,255,0.35);font-size:10px;font-weight:800;letter-spacing:2px">STORY</span>';
    parent.appendChild(fb);
  }
};
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
    icon: "\xF0\u0178\u2019\xAC",
    label: "WhatsApp",
    divider: "border-[#054C44]",
    searchBg: "bg-white border-stone-200 text-stone-900 placeholder:text-stone-500",
    msgMenuBg: "bg-stone-800 border-stone-700 shadow-2xl",
    pill: "bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30",
    storyRing: "border-[#25D366]",
    sendBtnText: "text-white"
  },
  maroon: {
    wrap: "bg-[#050505]",
    sidebar: "bg-gradient-to-b from-[#2B0B16] to-[#12070C] border-[#E3FF00]/10",
    chat: "bg-[#050505]",
    topbar: "bg-gradient-to-r from-[#2B0B16] to-[#12070C] backdrop-blur-2xl border-[#ffffff]/8",
    input: "bg-[#141414]/82 backdrop-blur-xl border-[#ffffff]/8",
    nav: "bg-gradient-to-r from-[#2B0B16] to-[#12070C] border-[#E3FF00]/10",
    bubbleSent: "bg-gradient-to-br from-[#1E5EFF] to-[#006BFF] text-white shadow-lg shadow-[#1E5EFF]/30 border border-[#1E5EFF]/40",
    bubbleRecv: "bg-white/[0.07] backdrop-blur-md border border-white/8 text-white",
    text1: "text-white",
    text2: "text-[#E3FF00]",
    text3: "text-white/40",
    accent: "bg-[#E3FF00]",
    accentText: "text-[#E3FF00]",
    icon: "\xE2\u0161\xA1",
    label: "Midnight",
    divider: "border-white/8",
    searchBg: "bg-[#050505] border-white/10 text-white placeholder:text-white/25",
    msgMenuBg: "bg-[#1a0418] border-[#E3FF00]/20",
    pill: "bg-[#E3FF00]/15 text-[#E3FF00] border border-[#E3FF00]/30",
    storyRing: "border-[#E3FF00]",
    sendBtnText: "text-[#050505]"
  },
  "dairy-notebook": {
    wrap: "bg-[#fbf0d9]",
    sidebar: "bg-[#fbf0d9]",
    chat: "bg-[#fbf0d9]",
    topbar: "bg-[#fbf0d9]",
    input: "bg-[#fbf0d9] border-stone-300",
    nav: "bg-[#fbf0d9]",
    bubbleSent: "bg-[#fbf0d9] text-[#1a2b4c] shadow-sm rounded-xl",
    bubbleRecv: "bg-white text-[#1a2b4c] shadow-sm border border-stone-200 rounded-xl",
    text1: "#1a2b4c",
    text2: "#1a2b4c/75",
    text3: "#1a2b4c/55",
    accent: "#1a2b4c",
    accentText: "#1a2b4c",
    icon: "\xF0\u0178\u201C\u2013",
    label: "Dairy Notebook",
    divider: "linear-gradient(rgba(209,217,230,0.5) 1px, transparent 1px)",
    searchBg: "bg-[#fbf0d9] text-[#1a2b4c] placeholder:text-[#1a2b4c]/50",
    msgMenuBg: "#fbf0d9 border-stone-200 shadow-sm",
    pill: "#fbf0d9/20 text-[#1a2b4c] border #fbf0d9/30",
    storyRing: "border-[#1a2b4c]",
    sendBtnText: "#1a2b4c"
  },
  comic: {
    wrap: "bg-sky-100",
    sidebar: "bg-white border-blue-200",
    chat: "bg-sky-100",
    topbar: "bg-white/90 backdrop-blur-xl border-black/10",
    input: "bg-white/95 border-black/8",
    nav: "bg-white/90 border-black/10",
    bubbleSent: "bg-gradient-to-b from-[#3399FF] to-[#0066FF] text-white border-2 border-black shadow-[3px_4px_0px_rgba(0,0,0,0.22)]",
    bubbleRecv: "bg-white text-gray-900 border-2 border-black shadow-[3px_4px_0px_rgba(0,0,0,0.12)]",
    text1: "text-gray-900",
    text2: "text-[#0066FF]",
    text3: "text-gray-500",
    accent: "bg-[#E3FF00]",
    accentText: "text-[#0066FF]",
    icon: "\xF0\u0178\u017D\xA8",
    label: "Comic Pop",
    divider: "border-black/10",
    searchBg: "bg-white border-gray-200 text-gray-900 placeholder:text-gray-400",
    msgMenuBg: "bg-white border-gray-200 shadow-xl",
    pill: "bg-[#E3FF00]/30 text-[#0066FF] border border-[#0066FF]/30",
    storyRing: "border-[#E3FF00]",
    sendBtnText: "text-[#050505]"
  }
};
const MessageStatus = ({
  msg,
  userId
}) => {
  if (msg.sender_id !== userId || msg.seen_at) return null;
  if (msg.id.startsWith("temp-"))
    return /* @__PURE__ */ React.createElement("span", { className: "text-[10px] text-white/30 ml-1 italic" }, "Sending\xE2\u20AC\xA6");
  return /* @__PURE__ */ React.createElement("span", { className: "inline-flex items-center gap-0.5 ml-1" }, /* @__PURE__ */ React.createElement("svg", { width: "16", height: "10", viewBox: "0 0 16 10", fill: "none" }, /* @__PURE__ */ React.createElement("path", { d: "M1 5L4 8L9 2", stroke: "rgba(255,255,255,0.45)", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" }), /* @__PURE__ */ React.createElement("path", { d: "M6 5L9 8L14 2", stroke: "rgba(255,255,255,0.45)", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" })));
};
const PETAL_DATA = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  left: `${4 + i * 7 % 92}%`,
  delay: `${i * 0.7 % 9}s`,
  duration: `${7 + i * 1.1 % 7}s`,
  size: 9 + i * 3 % 10,
  color: i % 3 === 0 ? "#f43f5e" : i % 3 === 1 ? "#fb7185" : "#fda4af"
}));
const RosePetals = () => /* @__PURE__ */ React.createElement("div", { className: "absolute inset-0 overflow-hidden pointer-events-none z-0" }, PETAL_DATA.map((p) => /* @__PURE__ */ React.createElement(
  "div",
  {
    key: p.id,
    style: {
      position: "absolute",
      top: -20,
      left: p.left,
      width: p.size,
      height: p.size * 1.3,
      background: p.color,
      borderRadius: "50% 10% 50% 10%",
      opacity: 0.7,
      animation: `petal-fall ${p.duration} ${p.delay} linear infinite, petal-sway ${parseFloat(p.duration) * 0.6}s ${p.delay} ease-in-out infinite`,
      filter: "blur(0.3px)"
    }
  }
)));
const playSound = (type) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === "send") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(1e-3, ctx.currentTime + 0.18);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } else if (type === "receive") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(1e-3, ctx.currentTime + 0.28);
      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    } else {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(350, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(1e-3, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch (_) {
  }
};
const Avatar = ({
  url,
  name,
  size = "md",
  online
}) => {
  const dim = size === "xs" ? 28 : size === "sm" ? 36 : size === "lg" ? 56 : 44;
  return /* @__PURE__ */ React.createElement(ActiveStatusAvatar, { src: url, name, size: dim, online: online === true });
};
const MediaBubble = React.memo(
  ({ url, type }) => {
    if (type.startsWith("image/")) {
      return /* @__PURE__ */ React.createElement(
        "img",
        {
          src: url,
          className: "max-w-[220px] rounded-2xl object-cover cursor-pointer shadow-lg",
          onClick: () => window.open(url, "_blank"),
          decoding: "async",
          crossOrigin: "anonymous"
        }
      );
    }
    if (type.startsWith("video/")) {
      return /* @__PURE__ */ React.createElement(
        "video",
        {
          src: url,
          controls: true,
          muted: true,
          playsInline: true,
          webkitPlaysInline: true,
          crossOrigin: "anonymous",
          preload: "auto",
          className: "max-w-[240px] rounded-2xl shadow-lg bg-black",
          style: { maxHeight: 200 }
        },
        url && /* @__PURE__ */ React.createElement("source", { src: url, type: "video/mp4" })
      );
    }
    if (type.startsWith("audio/")) {
      return /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 bg-white/10 px-3 py-2 rounded-2xl min-w-[200px]" }, /* @__PURE__ */ React.createElement(Music, { size: 16, className: "text-blue-400 shrink-0" }), /* @__PURE__ */ React.createElement("div", { className: "flex flex-col flex-1 min-w-0" }, /* @__PURE__ */ React.createElement("span", { className: "text-[10px] text-white/50 mb-0.5" }, "Audio message"), /* @__PURE__ */ React.createElement(
        "audio",
        {
          src: url,
          controls: true,
          className: "w-full h-8",
          style: { accentColor: "#60a5fa" }
        }
      )));
    }
    return /* @__PURE__ */ React.createElement(
      "a",
      {
        href: url,
        target: "_blank",
        rel: "noreferrer",
        className: "text-blue-400 underline text-xs"
      },
      "Open file"
    );
  }
);
MediaBubble.displayName = "MediaBubble";
const SmokeParticle = ({
  x,
  y,
  onDone
}) => {
  const particles = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    angle: i / 12 * 360,
    dist: 30 + Math.random() * 50,
    size: 6 + Math.random() * 10,
    delay: Math.random() * 0.1
  }));
  useEffect(() => {
    const t = setTimeout(onDone, 800);
    return () => clearTimeout(t);
  }, [onDone]);
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      className: "fixed pointer-events-none z-[999]",
      style: { left: x, top: y }
    },
    particles.map((p) => /* @__PURE__ */ React.createElement(
      motion.div,
      {
        key: p.id,
        initial: { x: 0, y: 0, opacity: 0.8, scale: 1 },
        animate: {
          x: Math.cos(p.angle * Math.PI / 180) * p.dist,
          y: Math.sin(p.angle * Math.PI / 180) * p.dist,
          opacity: 0,
          scale: 0.2
        },
        transition: { duration: 0.7, delay: p.delay, ease: "easeOut" },
        className: "absolute rounded-full bg-gray-400/60",
        style: {
          width: p.size,
          height: p.size,
          marginLeft: -p.size / 2,
          marginTop: -p.size / 2
        }
      }
    ))
  );
};
const EmojiBlast = ({
  emoji,
  onDone
}) => {
  const blasts = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    x: Math.random() * window.innerWidth,
    endY: -120 - Math.random() * 300,
    size: 28 + Math.random() * 32,
    delay: Math.random() * 0.4,
    rotate: (Math.random() - 0.5) * 720
  }));
  useEffect(() => {
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [onDone]);
  return /* @__PURE__ */ React.createElement("div", { className: "fixed inset-0 pointer-events-none z-[9999]" }, blasts.map((b) => /* @__PURE__ */ React.createElement(
    motion.div,
    {
      key: b.id,
      initial: {
        x: b.x,
        y: window.innerHeight,
        opacity: 1,
        rotate: 0,
        scale: 0.5
      },
      animate: {
        y: window.innerHeight + b.endY,
        opacity: 0,
        rotate: b.rotate,
        scale: 1.5
      },
      transition: { duration: 1.4, delay: b.delay, ease: "easeOut" },
      className: "absolute text-4xl select-none",
      style: { fontSize: b.size }
    },
    emoji
  )));
};
const KEYWORD_EMOJI_MAP = [
  // Excitement
  { keywords: ["wow", "amazing", "awesome", "zabardast", "waah", "wah"], emoji: "\xF0\u0178\xA4\xA9" },
  // Support
  { keywords: ["i am with you", "i'm with you", "dont worry", "don't worry", "fikar mat", "tension mat"], emoji: "\xF0\u0178\xA4\u2014" },
  // Food
  { keywords: ["khana", "khaana", "bhookh", "bhukh", "dinner", "lunch", "breakfast", "khana khao", "kha lo"], emoji: "\xF0\u0178\x8D\u2022" },
  // Sleepy
  { keywords: ["good night", "goodnight", "gn ", "sone ja raha", "sone ja rhi", "sone wala", "so jao", "so ja"], emoji: "\xF0\u0178\u02DC\xB4" },
  // Agreement
  { keywords: ["sahi hai", "bilkul", "bilkul sahi", "done", "haan ji", "haan bilkul", "theek hai"], emoji: "\xE2\u0153\u2026" },
  // Wishes
  { keywords: ["happy mothers day", "mothers day", "happy fathers day", "fathers day", "anniversary", "happy anniversary", "happy birthday", "birthday", "congratulations", "congrats", "badhaai", "mubarak"], emoji: "\xF0\u0178\u017D\u2030" },
  // Emotions â€” dil â¤ï¸
  { keywords: ["tum mere dil me ho", "tum mere dil mein ho", "aap mere dil me ho", "aap mere dil mein ho"], emoji: "\xE2\x9D\xA4\xEF\xB8\x8F" },
  // Emotions â€” Love you ðŸ˜
  { keywords: ["love you", "love u", "i love u", "luv you", "luv u", "i love you", "pyaar karta", "pyaar karti", "pyaar hai"], emoji: "\xF0\u0178\u02DC\x8D" },
  // Emotions â€” Miss you ðŸ¥º (expanded)
  { keywords: ["miss you", "miss u", "i miss u", "i miss you", "missing you", "yaad aa raha", "yaad aa rhi", "bahut yaad", "yaad kiya"], emoji: "\xF0\u0178\xA5\xBA" },
  // Emotions â€” Hug ðŸ¤—
  { keywords: ["hug u", "hug you", "i hug u", "i hug you"], emoji: "\xF0\u0178\xA4\u2014" },
  // Emotions â€” Kiss ðŸ˜˜
  { keywords: ["kiss u", "kiss you", "i kiss u", "i kiss you"], emoji: "\xF0\u0178\u02DC\u02DC" },
  // Emotions â€” Waiting â³ (NEW)
  { keywords: ["waiting u", "waiting you", "i am waiting", "wait kar raha", "wait kar rhi"], emoji: "\xE2\x8F\xB3" },
  // Sleep / Wake ðŸŒ™ (NEW)
  { keywords: ["uth jao", "so rhe ho kya", "so rahe ho kya", "kab so kar uthe", "chalo ab so jao", "so gaye kya", "neend aa rhi"], emoji: "\xF0\u0178\u0152\u2122" },
  // Emotions â€” Best friends ðŸ‘¯
  { keywords: ["best friends", "bestfriends", "best friend", "bff", "dost forever", "yaar forever"], emoji: "\xF0\u0178\u2018\xAF" },
  // Gender-Adaptive: asking a female (aaogi = female conjugation)
  { keywords: ["kab aaogi", "kab aogi", "kab ayogi"], emoji: "\xF0\u0178\xA5\xB0" },
  // Gender-Adaptive: asking a male (aaoge = male conjugation)
  { keywords: ["kab aaoge", "kab aoge", "kab ayoge"], emoji: "\xF0\u0178\u02DC\u0160" }
];
const getKeywordEmoji = (text) => {
  const lower = text.toLowerCase();
  for (const { keywords, emoji } of KEYWORD_EMOJI_MAP) {
    if (keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
      return emoji;
    }
  }
  return null;
};
const STORY_MOOD_FILTER = {
  sad: "grayscale(80%) brightness(0.75)",
  happy: "saturate(1.4) brightness(1.05)",
  angry: "saturate(1.8) hue-rotate(330deg) brightness(0.9)",
  party: "saturate(2) contrast(1.15) brightness(1.1)",
  love: "sepia(0.4) saturate(1.6) brightness(1.05)",
  chill: "saturate(0.8) brightness(0.95) hue-rotate(200deg)",
  "vibrant-gold": "sepia(0.35) saturate(2.2) brightness(1.12) contrast(1.08)",
  cyberpunk: "saturate(2.6) hue-rotate(255deg) contrast(1.25) brightness(0.88)",
  noir: "grayscale(100%) contrast(1.45) brightness(0.88)",
  grid: ""
};
const StoryRainOverlay = () => /* @__PURE__ */ React.createElement("div", { className: "absolute inset-0 pointer-events-none overflow-hidden z-10" }, Array.from({ length: 20 }).map((_, i) => /* @__PURE__ */ React.createElement(
  "div",
  {
    key: i,
    className: "perf-rain absolute w-px bg-blue-300/40 rounded-full",
    style: {
      left: `${i / 20 * 100}%`,
      height: `${28 + i % 5 * 9}px`,
      top: "-10%",
      "--perf-duration": `${0.8 + i % 4 * 0.15}s`,
      "--perf-delay": `${i % 6 * 0.2}s`
    }
  }
)));
const StoryNeonOverlay = () => /* @__PURE__ */ React.createElement("div", { className: "perf-neon absolute inset-0 pointer-events-none z-10" });
const StoryAudioWave = () => /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1 justify-center" }, Array.from({ length: 7 }).map((_, i) => /* @__PURE__ */ React.createElement(
  "div",
  {
    key: i,
    className: "perf-wave w-1.5 h-5 rounded-full bg-white/80",
    style: { "--perf-delay": `${i * 0.1}s` }
  }
)));
const StoryHelpSticker = () => /* @__PURE__ */ React.createElement(
  "div",
  {
    className: "perf-pulse absolute top-16 left-1/2 -translate-x-1/2 z-30 px-5 py-2 rounded-full select-none",
    style: { background: "linear-gradient(135deg,#f97316,#ef4444)", "--perf-duration": "1.1s", "--perf-scale": "1.08" }
  },
  /* @__PURE__ */ React.createElement("span", { className: "text-white font-black text-base tracking-widest drop-shadow" }, "\xF0\u0178\u2020\u02DC MADAD")
);
const StoryProgressBar = ({
  total,
  current,
  elapsed,
  duration
}) => /* @__PURE__ */ React.createElement("div", { className: "flex gap-1 px-3 pt-2 z-40 relative" }, Array.from({ length: total }).map((_, i) => /* @__PURE__ */ React.createElement(
  "div",
  {
    key: i,
    className: "h-0.5 flex-1 rounded-full bg-white/30 overflow-hidden"
  },
  i < current ? /* @__PURE__ */ React.createElement("div", { className: "h-full w-full bg-white" }) : i === current ? /* @__PURE__ */ React.createElement(
    motion.div,
    {
      className: "h-full bg-white origin-left",
      style: { scaleX: Math.min(elapsed / duration, 1) }
    }
  ) : null
)));
const _SGRADS = [
  "#6366f1",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4"
];
const _sgradFor = (id) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h << 5) + h ^ id.charCodeAt(i);
  return _SGRADS[Math.abs(h) % _SGRADS.length];
};
const StoryViewCount = ({ storyId }) => {
  const [count, setCount] = React.useState(null);
  React.useEffect(() => {
    supabase.from("story_views").select("id", { count: "exact", head: true }).eq("story_id", storyId).then(({ count: c }) => setCount(c ?? 0));
  }, [storyId]);
  if (count === null) return null;
  return /* @__PURE__ */ React.createElement("div", { className: "absolute bottom-4 right-4 z-20 flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5 border border-white/15" }, /* @__PURE__ */ React.createElement(Eye, { size: 13, className: "text-white/80" }), /* @__PURE__ */ React.createElement("span", { className: "text-white text-[11px] font-bold" }, count));
};
const ChatSystem = ({
  isOpen,
  onClose,
  userId,
  userEmail = "",
  onLogout,
  onUnreadCountChange,
  onReady
}) => {
  const isAdmin = isAdminEmail(userEmail);
  const { openProfile } = useProfileViewer();
  const fetchMsgReactions = useCallback(
    async (uid, otherId) => {
      try {
        const { data: msgData } = await supabase.from("messages").select("id").or(
          `and(sender_id.eq.${uid},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${uid})`
        ).order("created_at", { ascending: false }).limit(200);
        const msgIdsArr = (msgData || []).map((m) => m.id);
        if (msgIdsArr.length === 0) return;
        const { data } = await supabase.from("message_reactions").select("id, message_id, user_id, emoji").in("message_id", msgIdsArr);
        if (!data) return;
        const map = {};
        const rowsById = /* @__PURE__ */ new Map();
        for (const row of data) {
          if (row.id) {
            rowsById.set(String(row.id), {
              id: String(row.id),
              message_id: String(row.message_id),
              user_id: String(row.user_id),
              emoji: String(row.emoji)
            });
          }
          if (!map[row.message_id]) map[row.message_id] = {};
          if (!map[row.message_id][row.emoji])
            map[row.message_id][row.emoji] = [];
          map[row.message_id][row.emoji].push(row.user_id);
        }
        messageReactionRowsRef.current = rowsById;
        setMsgReactions(map);
      } catch (error) {
        console.error("[Chat] fetch message reactions error:", error);
      }
    },
    []
  );
  const handleMsgReact = async (msgId, emoji) => {
    const reactingUserId = userId;
    if (!reactingUserId) {
      console.error("[Reaction] \xE2\x9D\u0152 No user ID \xE2\u20AC\u201D aborting");
      return;
    }
    if (!msgId || msgId.startsWith("temp-")) {
      console.warn("[Reaction] \xE2\u0161\xA0\xEF\xB8\x8F Skipping temp/invalid message id:", msgId);
      return;
    }
    playPop();
    setMsgReactionBarId(null);
    const prev = msgReactions[msgId] ?? {};
    const currentUsers = prev[emoji] ?? [];
    const alreadyReacted = currentUsers.includes(reactingUserId);
    const updated = { ...prev };
    if (alreadyReacted) {
      updated[emoji] = currentUsers.filter((u) => u !== reactingUserId);
      if (updated[emoji].length === 0) delete updated[emoji];
    } else {
      Object.keys(updated).forEach((e) => {
        updated[e] = updated[e].filter((u) => u !== reactingUserId);
        if (updated[e].length === 0) delete updated[e];
      });
      updated[emoji] = [...updated[emoji] ?? [], reactingUserId];
    }
    setMsgReactions((r) => ({ ...r, [msgId]: updated }));
    try {
      if (alreadyReacted) {
        const { error } = await supabase.from("message_reactions").delete().eq("message_id", msgId).eq("user_id", reactingUserId);
        if (error) throw error;
      } else {
        await supabase.from("message_reactions").delete().eq("message_id", msgId).eq("user_id", reactingUserId);
        const { error } = await supabase.from("message_reactions").insert({ message_id: msgId, user_id: reactingUserId, emoji });
        if (error) throw error;
      }
    } catch (err) {
      console.error(
        "[Reaction] \xE2\x9D\u0152 DB error \xE2\u20AC\u201D rolling back optimistic UI:",
        err
      );
      setMsgReactions((r) => ({ ...r, [msgId]: prev }));
      return;
    }
    if (selectedUser) await fetchMsgReactions(reactingUserId, selectedUser.id);
  };
  useEffect(() => {
    injectStyles();
  }, []);
  const [theme, setTheme] = useState(() => {
    if (localStorage.getItem("cx_theme_v") !== "5") {
      localStorage.setItem("cx_theme_v", "5");
      localStorage.setItem("cx_theme", "dairy-notebook");
      return "dairy-notebook";
    }
    const s = localStorage.getItem("cx_theme");
    return s === "dairy-notebook" || s === "whatsapp" || s === "maroon" ? s : "dairy-notebook";
  });
  const [lastMsgDate, setLastMsgDate] = useState(null);
  const [activeStatus, setActiveStatus] = useState(
    () => localStorage.getItem("cx_active_status") !== "false"
  );
  const [soundEnabled, setSoundEnabled] = useState(
    () => localStorage.getItem("cx_sound") !== "false"
  );
  const [loveProtectEnabled, setLoveProtectEnabled] = useState(
    () => localStorage.getItem("cx_love_protect") === "true"
  );
  const [loveProtectPartnerId, setLoveProtectPartnerId] = useState("");
  const [loveProtectInput, setLoveProtectInput] = useState("");
  const [savingLoveProtect, setSavingLoveProtect] = useState(false);
  const [lpSearchQuery, setLpSearchQuery] = useState("");
  const [lpSearchResults, setLpSearchResults] = useState([]);
  const [lpSearchLoading, setLpSearchLoading] = useState(false);
  const [lpSelectedName, setLpSelectedName] = useState("");
  const lpSearchRef = useRef(null);
  const [suspiciousAlert, setSuspiciousAlert] = useState(null);
  const [loveProtectAlert, setLoveProtectAlert] = useState(false);
  const loveProtectPartnerRef = useRef("");
  const suspiciousTimerRef = useRef(null);
  const loveProtectTimerRef = useRef(null);
  const [mutedChats, setMutedChats] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem("cx_muted") || "[]"));
    } catch {
      return /* @__PURE__ */ new Set();
    }
  });
  const [archivedChats, setArchivedChats] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem("cx_archived") || "[]"));
    } catch {
      return /* @__PURE__ */ new Set();
    }
  });
  const [onlineUsers, setOnlineUsers] = useState(/* @__PURE__ */ new Set());
  const presenceChannelRef = useRef(
    null
  );
  const [bottomTab, setBottomTab] = useState("chat");
  const [menuPanel, setMenuPanel] = useState("main");
  const [friendshipMap, setFriendshipMap] = useState(/* @__PURE__ */ new Map());
  const [pendingRequests, setPendingRequests] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [unseenMsgCount, setUnseenMsgCount] = useState(0);
  const [actionLoading, setActionLoading] = useState("");
  const [contacts, setContacts] = useState([]);
  const [messageRequests, setMessageRequests] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [blockedUserIds, setBlockedUserIds] = useState(/* @__PURE__ */ new Set());
  const blockedUserIdsRef = useRef(/* @__PURE__ */ new Set());
  const deletedForMeIdsRef = useRef(/* @__PURE__ */ new Set());
  const lastContactsFetchAtRef = useRef(0);
  const contactsFetchInFlightRef = useRef(false);
  const contactsRefreshTimerRef = useRef(null);
  const rememberDeletedMessage = (messageId) => {
    const ids = deletedForMeIdsRef.current;
    ids.delete(messageId);
    ids.add(messageId);
    while (ids.size > 500) {
      const oldest = ids.values().next().value;
      if (!oldest) break;
      ids.delete(oldest);
    }
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchRequestSeqRef = useRef(0);
  const searchAbortRef = useRef(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingFilePreview, setPendingFilePreview] = useState(
    null
  );
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [msgMenuId, setMsgMenuId] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [showSongLibrary, setShowSongLibrary] = useState(false);
  const [songLibrary, setSongLibrary] = useState([]);
  const [loadingSongLibrary, setLoadingSongLibrary] = useState(false);
  const [songLibraryError, setSongLibraryError] = useState("");
  const [selectedChatTrack, setSelectedChatTrack] = useState(null);
  const [chatMusicPlaying, setChatMusicPlaying] = useState(false);
  const [chatMusicTime, setChatMusicTime] = useState(0);
  const [chatMusicDuration, setChatMusicDuration] = useState(0);
  const chatMusicAudioRef = useRef(null);
  const chatMusicChannelRef = useRef(null);
  const pendingChatMusicSyncRef = useRef(null);
  const lastMusicSeekBroadcastAtRef = useRef(0);
  const chatMusicStateRef = useRef({
    track: selectedChatTrack,
    isPlaying: chatMusicPlaying
  });
  chatMusicStateRef.current = {
    track: selectedChatTrack,
    isPlaying: chatMusicPlaying
  };
  const chatMusicRoomId = selectedUser ? [userId, selectedUser.id].sort().join(":") : null;
  const broadcastChatMusic = useCallback((payload) => {
    const channel = chatMusicChannelRef.current;
    if (!channel) return;
    void channel.send({ type: "broadcast", event: "chat_music_sync", payload }).then((status) => {
      if (status !== "ok") {
        console.warn("[Chat] music sync broadcast failed:", status);
      }
    });
  }, []);
  const publishChatMusicState = useCallback(
    (isPlaying, currentTime, track = selectedChatTrack) => {
      broadcastChatMusic({
        audio_url: track?.audio_url ?? null,
        title: track?.title ?? null,
        artist: track?.artist ?? null,
        isPlaying,
        currentTime: currentTime ?? chatMusicAudioRef.current?.currentTime ?? 0,
        timestamp: Date.now()
      });
    },
    [broadcastChatMusic, selectedChatTrack]
  );
  const syncPendingChatMusic = useCallback(() => {
    const pending = pendingChatMusicSyncRef.current;
    const audio = chatMusicAudioRef.current;
    if (!pending || !audio || audio.readyState < HTMLMediaElement.HAVE_METADATA) return;
    pendingChatMusicSyncRef.current = null;
    const targetTime = pending.currentTime + (pending.isPlaying ? Math.max(0, Date.now() - pending.timestamp) / 1e3 : 0);
    audio.currentTime = Math.max(
      0,
      Math.min(targetTime, Number.isFinite(audio.duration) ? audio.duration : targetTime)
    );
    if (pending.isPlaying) {
      void audio.play().catch((error) => {
        console.warn("[Chat] browser could not start synchronized music:", error);
        toast.info("Tap Play to start the synchronized song.");
      });
    } else {
      audio.pause();
    }
  }, []);
  const selectChatMusicTrack = useCallback(
    (track) => {
      const audio = chatMusicAudioRef.current;
      if (!audio) return;
      const sync = {
        audio_url: track.audio_url,
        title: track.title,
        artist: track.artist,
        isPlaying: true,
        currentTime: 0,
        timestamp: Date.now()
      };
      setSelectedChatTrack(track);
      setChatMusicTime(0);
      setChatMusicDuration(0);
      setChatMusicPlaying(true);
      pendingChatMusicSyncRef.current = sync;
      if (audio.src !== track.audio_url) {
        audio.src = track.audio_url;
        audio.load();
      } else if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
        audio.currentTime = 0;
        pendingChatMusicSyncRef.current = null;
      }
      void audio.play().then(
        () => {
          publishChatMusicState(true, 0, track);
          pendingChatMusicSyncRef.current = null;
        },
        (error) => {
          console.error("[Chat] selected song could not be played:", error);
          setChatMusicPlaying(false);
          publishChatMusicState(false, 0, track);
          toast.error("This song couldn't be played. Try another track.");
        }
      );
    },
    [publishChatMusicState]
  );
  const toggleChatMusicPlayback = useCallback(() => {
    const audio = chatMusicAudioRef.current;
    if (!selectedChatTrack || !audio) {
      setShowSongLibrary(true);
      return;
    }
    if (chatMusicPlaying) {
      audio.pause();
      setChatMusicPlaying(false);
      publishChatMusicState(false);
      return;
    }
    void audio.play().then(
      () => {
        setChatMusicPlaying(true);
        publishChatMusicState(true);
      },
      (error) => {
        console.error("[Chat] song playback could not resume:", error);
        toast.error("This song couldn't be resumed. Please try again.");
      }
    );
  }, [chatMusicPlaying, publishChatMusicState, selectedChatTrack]);
  const seekChatMusic = useCallback(
    (currentTime) => {
      const audio = chatMusicAudioRef.current;
      if (!audio || !selectedChatTrack || !Number.isFinite(currentTime)) return;
      const nextTime = Math.max(
        0,
        Math.min(currentTime, Number.isFinite(audio.duration) ? audio.duration : currentTime)
      );
      audio.currentTime = nextTime;
      setChatMusicTime(nextTime);
      const now = Date.now();
      if (now - lastMusicSeekBroadcastAtRef.current >= 100) {
        lastMusicSeekBroadcastAtRef.current = now;
        publishChatMusicState(chatMusicPlaying, nextTime);
      }
    },
    [chatMusicPlaying, publishChatMusicState, selectedChatTrack]
  );
  const finishChatMusicSeek = useCallback(() => {
    const audio = chatMusicAudioRef.current;
    if (!audio || !selectedChatTrack) return;
    lastMusicSeekBroadcastAtRef.current = Date.now();
    publishChatMusicState(chatMusicPlaying, audio.currentTime);
  }, [chatMusicPlaying, publishChatMusicState, selectedChatTrack]);
  useEffect(() => {
    setShowSongLibrary(false);
    setSelectedChatTrack(null);
    setChatMusicPlaying(false);
    setChatMusicTime(0);
    setChatMusicDuration(0);
    pendingChatMusicSyncRef.current = null;
    const audio = chatMusicAudioRef.current;
    audio?.pause();
    if (audio) {
      audio.removeAttribute("src");
      audio.load();
    }
  }, [chatMusicRoomId]);
  useEffect(() => {
    if (!showSongLibrary || !selectedUser?.id) return;
    let cancelled = false;
    setLoadingSongLibrary(true);
    setSongLibraryError("");
    void supabase.from("songs").select("id, title, artist, audio_url").order("title", { ascending: true }).limit(100).then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        console.error("[Chat] song library fetch failed:", error);
        setSongLibrary([]);
        setSongLibraryError("Couldn't load songs. Please try again.");
        return;
      }
      setSongLibrary(
        (data || []).flatMap((track) => {
          if (typeof track.title !== "string" || typeof track.audio_url !== "string" || !track.audio_url.startsWith("https://")) {
            return [];
          }
          return [{
            id: String(track.id ?? track.audio_url),
            title: track.title,
            artist: typeof track.artist === "string" && track.artist.trim() ? track.artist : "Unknown artist",
            audio_url: track.audio_url
          }];
        })
      );
    }).finally(() => {
      if (!cancelled) setLoadingSongLibrary(false);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedUser?.id, showSongLibrary]);
  useEffect(() => {
    if (!isOpen || bottomTab !== "chat" || !chatMusicRoomId) return;
    const audio = chatMusicAudioRef.current;
    const channel = supabase.channel(`chat_music_sync:${chatMusicRoomId}`, {
      config: { broadcast: { self: false }, private: true }
    });
    chatMusicChannelRef.current = channel;
    channel.on("broadcast", { event: "chat_music_sync" }, ({ payload }) => {
      const sync = payload;
      if (!sync || typeof sync.isPlaying !== "boolean" || typeof sync.currentTime !== "number" || !Number.isFinite(sync.currentTime) || typeof sync.timestamp !== "number" || !Number.isFinite(sync.timestamp)) {
        console.warn("[Chat] ignored invalid music sync payload");
        return;
      }
      const audioUrl = typeof sync.audio_url === "string" && sync.audio_url.startsWith("https://") ? sync.audio_url : null;
      if (audioUrl) {
        const track = {
          id: audioUrl,
          title: typeof sync.title === "string" ? sync.title : "Unknown track",
          artist: typeof sync.artist === "string" ? sync.artist : "Unknown artist",
          audio_url: audioUrl
        };
        setSelectedChatTrack(track);
      } else {
        setSelectedChatTrack(null);
      }
      const elapsed = sync.isPlaying ? Math.max(0, Date.now() - sync.timestamp) / 1e3 : 0;
      const currentTime = Math.max(0, sync.currentTime + elapsed);
      const nextSync = {
        audio_url: audioUrl,
        title: typeof sync.title === "string" ? sync.title : null,
        artist: typeof sync.artist === "string" ? sync.artist : null,
        isPlaying: sync.isPlaying,
        currentTime: sync.currentTime,
        timestamp: sync.timestamp
      };
      setChatMusicPlaying(sync.isPlaying);
      setChatMusicTime(currentTime);
      const audio2 = chatMusicAudioRef.current;
      if (!audio2 || !audioUrl) {
        audio2?.pause();
        return;
      }
      pendingChatMusicSyncRef.current = nextSync;
      if (audio2.src !== audioUrl) {
        audio2.src = audioUrl;
        audio2.load();
        setChatMusicDuration(0);
      }
      syncPendingChatMusic();
    }).subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error("[Chat] music sync channel failed:", status, chatMusicRoomId);
        toast.error("Shared music sync is unavailable in this chat.");
      }
    });
    return () => {
      if (chatMusicChannelRef.current === channel) {
        chatMusicChannelRef.current = null;
      }
      pendingChatMusicSyncRef.current = null;
      audio?.pause();
      setChatMusicPlaying(false);
      setSelectedChatTrack(null);
      setChatMusicTime(0);
      setChatMusicDuration(0);
      setShowSongLibrary(false);
      const { track } = chatMusicStateRef.current;
      const removeChannel = () => {
        void supabase.removeChannel(channel);
      };
      if (track && audio) {
        void channel.send({
          type: "broadcast",
          event: "chat_music_sync",
          payload: {
            audio_url: track.audio_url,
            title: track.title,
            artist: track.artist,
            isPlaying: false,
            currentTime: audio.currentTime,
            timestamp: Date.now()
          }
        }).then(removeChannel).catch((error) => {
          console.warn("[Chat] couldn't broadcast music stop on room exit:", error);
          removeChannel();
        });
      } else {
        removeChannel();
      }
    };
  }, [bottomTab, chatMusicRoomId, isOpen, syncPendingChatMusic]);
  const [smokeParticles, setSmokeParticles] = useState([]);
  const [emojiBlast, setEmojiBlast] = useState(null);
  const [showEmojiGrid, setShowEmojiGrid] = useState(false);
  const [showInputEmoji, setShowInputEmoji] = useState(false);
  const [showStickerDrawer, setShowStickerDrawer] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const smokeIdRef = useRef(0);
  const blastIdRef = useRef(0);
  const [myProfile, setMyProfile] = useState(null);
  const [editBio, setEditBio] = useState("");
  const [editSchool, setEditSchool] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [stories, setStories] = useState([]);
  const [storyGroups, setStoryGroups] = useState([]);
  const [loadingStories, setLoadingStories] = useState(false);
  const [showStoryEditor, setShowStoryEditor] = useState(false);
  const [storyFile, setStoryFile] = useState(null);
  const [storyFiles, setStoryFiles] = useState([]);
  const [storyPreviews, setStoryPreviews] = useState([]);
  const [storyPreviewUrl, setStoryPreviewUrl] = useState("");
  const [storyCaption, setStoryCaption] = useState("");
  const [storyEmoji, setStoryEmoji] = useState("");
  const [storyMood, setStoryMood] = useState("");
  const [storyIsHelp, setStoryIsHelp] = useState(false);
  const [storyUploadProgress, setStoryUploadProgress] = useState(0);
  const [uploadingStory, setUploadingStory] = useState(false);
  const [viewingStory, setViewingStory] = useState(null);
  const [viewerGroupIdx, setViewerGroupIdx] = useState(0);
  const [viewerStoryIdx, setViewerStoryIdx] = useState(0);
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [editingStory, setEditingStory] = useState(null);
  const [deletingStory, setDeletingStory] = useState(false);
  const storyInputRef = useRef(null);
  const storyAudioRef = useRef(null);
  const storyVideoRef = useRef(null);
  const storyTimerRef = useRef(null);
  const storyDeadlineRef = useRef(null);
  const storyElapsedRef = useRef(0);
  const [storyElapsed, setStoryElapsed] = useState(0);
  const [storyPaused, setStoryPaused] = useState(false);
  const storyViewedRef = useRef(/* @__PURE__ */ new Set());
  const [selectedMusic, setSelectedMusic] = useState(null);
  const [selectedMusicName, setSelectedMusicName] = useState("");
  const musicInputRef = useRef(null);
  const [muteStoryVideo, setMuteStoryVideo] = useState(false);
  const [viewerEditing, setViewerEditing] = useState(false);
  const [viewerEditCaption, setViewerEditCaption] = useState("");
  const [viewerEditMood, setViewerEditMood] = useState("");
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  useEffect(() => {
    return () => {
      revokeObjectUrl(pendingFilePreview);
      storyPreviews.forEach(revokeObjectUrl);
      if (!storyPreviews.includes(storyPreviewUrl)) revokeObjectUrl(storyPreviewUrl);
    };
  }, [pendingFilePreview, storyPreviews, storyPreviewUrl]);
  const clearStoryPreviews = () => {
    const urls = new Set(storyPreviews);
    if (storyPreviewUrl) urls.add(storyPreviewUrl);
    urls.forEach(revokeObjectUrl);
    setStoryPreviews([]);
    setStoryPreviewUrl("");
    setStoryFiles([]);
    setStoryFile(null);
  };
  const [panicMode, setPanicMode] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [showCallMenu, setShowCallMenu] = useState(false);
  const [deletingForMe, setDeletingForMe] = useState(null);
  const [msgReactionBarId, setMsgReactionBarId] = useState(null);
  const [msgReactions, setMsgReactions] = useState({});
  const [chatMsgAction, setChatMsgAction] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceSecondsLeft, setVoiceSecondsLeft] = useState(300);
  const [voiceStatus, setVoiceStatus] = useState(
    "listening"
  );
  const messagesEndRef = useRef(null);
  const messagesPaneRef = useRef(null);
  const messageLoadInFlightRef = useRef(false);
  const olderLoadInFlightRef = useRef(false);
  const oldestMessageCursorRef = useRef(null);
  const lastMessageLoadAtRef = useRef(0);
  const conversationKeyRef = useRef("");
  const messagesRef = useRef([]);
  const messageReactionRowsRef = useRef(
    /* @__PURE__ */ new Map()
  );
  const fileInputRef = useRef(null);
  const searchDebounceRef = useRef(null);
  const prevMsgCount = useRef(0);
  const autoScrollRafRef = useRef(0);
  const typingChannelRef = useRef(
    null
  );
  const typingTimeoutRef = useRef(null);
  const panicClickRef = useRef({ count: 0, timer: null });
  const recognitionRef = useRef(null);
  const voiceTimerRef = useRef(null);
  const voiceTimeoutsRef = useRef(/* @__PURE__ */ new Set());
  const voiceActiveRef = useRef(false);
  const pendingFileRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const longPressMsgPos = useRef({ x: 0, y: 0 });
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const T = THEME_CFG[theme];
  const panelBg = theme === "dairy-notebook" ? "bg-[#fbf0d9]" : theme === "whatsapp" ? "bg-[#075E54]" : theme === "maroon" ? "bg-[#050505]" : "bg-sky-100";
  const { playPop, playSwoosh } = useSoundEffects();
  const isActiveHidden = useActiveHide();
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
  useEffect(() => {
    loveProtectPartnerRef.current = loveProtectPartnerId;
  }, [loveProtectPartnerId]);
  useEffect(() => {
    if (!userId) return;
    supabase.from("love_protect_links").select("partner_id, is_active").eq("user_id", userId).eq("is_active", true).maybeSingle().then(async ({ data }) => {
      const row = data;
      if (row?.partner_id) {
        setLoveProtectPartnerId(row.partner_id);
        setLoveProtectInput(row.partner_id);
        setLoveProtectEnabled(true);
        localStorage.setItem("cx_love_protect", "true");
        const { data: prof } = await supabase.from("profiles").select("full_name, username").eq("id", row.partner_id).maybeSingle();
        if (prof) {
          const name = prof.full_name || prof.username || "";
          setLpSelectedName(name);
          setLpSearchQuery(name);
        }
      }
    });
  }, [userId]);
  const messageCount = messages.length;
  const lastMessageId = messages[messages.length - 1]?.id;
  useEffect(() => {
    const countIncreased = messageCount > prevMsgCount.current;
    if (countIncreased) {
      const last = messages[messages.length - 1];
      if (last?.sender_id !== userId && soundEnabled) playSound("receive");
      cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        autoScrollRafRef.current = 0;
      });
    }
    prevMsgCount.current = messageCount;
    return () => cancelAnimationFrame(autoScrollRafRef.current);
  }, [messageCount, lastMessageId, userId, soundEnabled]);
  const fetchMyProfile = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("id, full_name, username, avatar_url, bio, school, location").eq("id", userId).single();
    if (data) {
      setMyProfile(data);
      setEditBio(data.bio || "");
      setEditSchool(data.school || "");
      setEditLocation(data.location || "");
    }
  }, [userId]);
  const fetchFriendships = useCallback(async () => {
    const { data } = await supabase.from("friendships").select("id, sender_id, receiver_id, status").or(`sender_id.eq.${userId},receiver_id.eq.${userId}`).limit(500);
    if (!data) return;
    const map = /* @__PURE__ */ new Map();
    for (const row of data) {
      const otherId = row.sender_id === userId ? row.receiver_id : row.sender_id;
      map.set(otherId, {
        id: row.id,
        status: row.status,
        direction: row.sender_id === userId ? "sent" : "received"
      });
    }
    setFriendshipMap(map);
  }, [userId]);
  const fetchPendingRequests = useCallback(async () => {
    const { data } = await supabase.from("friendships").select("id, sender_id, created_at").eq("receiver_id", userId).eq("status", "pending").order("created_at", { ascending: false }).limit(100);
    if (!data || data.length === 0) {
      setPendingRequests([]);
      setPendingCount(0);
      return;
    }
    const senderIds = data.map((r) => r.sender_id);
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, username, avatar_url").in("id", senderIds).limit(100);
    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
    const reqs = data.map((r) => ({
      id: r.id,
      sender_id: r.sender_id,
      created_at: r.created_at,
      profile: profileMap.get(r.sender_id) || {
        id: r.sender_id,
        full_name: "Unknown",
        username: "",
        avatar_url: ""
      }
    }));
    setPendingRequests(reqs);
    setPendingCount(reqs.length);
    if (reqs.length > 0) {
      setAlerts((prev) => {
        const newAlerts = reqs.filter((r) => !prev.find((a) => a.id === `req-${r.id}`)).map((r) => ({
          id: `req-${r.id}`,
          text: `${r.profile.full_name} sent you a friend request`,
          time: new Date(r.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
          }),
          read: false
        }));
        return [...newAlerts, ...prev].slice(0, 50);
      });
    }
  }, [userId]);
  const fetchContacts = useCallback(async () => {
    const now = Date.now();
    if (now - lastContactsFetchAtRef.current < 1200) return;
    if (contactsFetchInFlightRef.current) return;
    lastContactsFetchAtRef.current = now;
    contactsFetchInFlightRef.current = true;
    setLoadingContacts(true);
    try {
      const { data: friendRows } = await supabase.from("friendships").select("sender_id, receiver_id").or(`sender_id.eq.${userId},receiver_id.eq.${userId}`).eq("status", "accepted").limit(500);
      const friendIds = (friendRows || []).map(
        (r) => r.sender_id === userId ? r.receiver_id : r.sender_id
      );
      const friendIdSet = new Set(friendIds);
      const { data: blockRows } = await supabase.from("user_blocks").select("blocker_id, blocked_id").or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`).limit(500);
      const blockedSet = /* @__PURE__ */ new Set();
      for (const b of blockRows || []) {
        if (b.blocker_id === userId) blockedSet.add(b.blocked_id);
        if (b.blocked_id === userId) blockedSet.add(b.blocker_id);
      }
      blockedUserIdsRef.current = blockedSet;
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
      const { data: msgs } = await supabase.from("messages").select("sender_id, receiver_id, content, media_type, created_at").or(`sender_id.eq.${userId},receiver_id.eq.${userId}`).order("created_at", { ascending: false }).limit(500);
      const contactMap = /* @__PURE__ */ new Map();
      const partnerIds = /* @__PURE__ */ new Set();
      for (const msg of msgs || []) {
        const otherId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
        if (!otherId || blockedSet.has(otherId)) continue;
        partnerIds.add(otherId);
        if (!contactMap.has(otherId)) {
          contactMap.set(otherId, {
            last_message: msg.content || "",
            last_message_at: msg.created_at,
            last_media_type: msg.media_type
          });
        }
      }
      const { data: unreadRows } = await supabase.from("messages").select("sender_id").eq("receiver_id", userId).is("seen_at", null).limit(500);
      const unreadMap = /* @__PURE__ */ new Map();
      for (const row of unreadRows || []) {
        if (blockedSet.has(row.sender_id)) continue;
        unreadMap.set(row.sender_id, (unreadMap.get(row.sender_id) || 0) + 1);
      }
      const allIds = /* @__PURE__ */ new Set([...friendIds, ...partnerIds]);
      [...allIds].forEach((id) => {
        if (blockedSet.has(id)) allIds.delete(id);
      });
      let profiles = [];
      if (allIds.size > 0) {
        const { data } = await supabase.from("profiles").select("id, full_name, username, avatar_url, last_seen, is_private_mode").in("id", [...allIds]);
        profiles = data || [];
      }
      const privateNonFriends = profiles.filter(
        (profile) => profile.is_private_mode === true && !friendIdSet.has(profile.id)
      );
      const privateAccessResults = await Promise.all(
        privateNonFriends.map(async (profile) => ({
          id: profile.id,
          allowed: await canViewPrivateProfile(profile.id)
        }))
      );
      const privateAllowedIds = new Set(
        privateAccessResults.filter((result) => result.allowed).map((result) => result.id)
      );
      const friendsResult = [];
      const requestsResult = [];
      for (const p of profiles) {
        if (blockedSet.has(p.id)) continue;
        if (p.is_private_mode === true && !friendIdSet.has(p.id) && !privateAllowedIds.has(p.id)) {
          continue;
        }
        const c = {
          id: p.id,
          full_name: p.full_name || p.username || "Unknown",
          username: p.username || "",
          avatar_url: p.avatar_url || "",
          is_private_mode: p.is_private_mode === true,
          ...contactMap.get(p.id) || {},
          unread_count: unreadMap.get(p.id) || 0
        };
        if (friendIdSet.has(p.id)) {
          friendsResult.push(c);
        } else if (partnerIds.has(p.id)) {
          requestsResult.push(c);
        }
      }
      const byRecency = (a, b) => (b.last_message_at || "") > (a.last_message_at || "") ? 1 : -1;
      friendsResult.sort(byRecency);
      requestsResult.sort(byRecency);
      setContacts(friendsResult);
      setMessageRequests(requestsResult);
    } finally {
      setLoadingContacts(false);
      contactsFetchInFlightRef.current = false;
    }
  }, [userId]);
  const scheduleContactsRefresh = useCallback(() => {
    if (contactsRefreshTimerRef.current) clearTimeout(contactsRefreshTimerRef.current);
    contactsRefreshTimerRef.current = setTimeout(() => {
      contactsRefreshTimerRef.current = null;
      void fetchContacts();
    }, 250);
  }, [fetchContacts]);
  useEffect(() => () => {
    if (contactsRefreshTimerRef.current) clearTimeout(contactsRefreshTimerRef.current);
  }, []);
  const fetchStories = useCallback(async () => {
    setLoadingStories(true);
    try {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1e3).toISOString();
      const { data } = await supabase.from("stories").select(
        "id, user_id, image_url, caption, emoji, mood, media_type, is_help_request, music_url, created_at, profiles(id, full_name, username, avatar_url)"
      ).gte("created_at", cutoff).order("created_at", { ascending: true }).limit(100);
      if (data) {
        const blocked = blockedUserIdsRef.current;
        const mapped = data.map((s) => ({
          ...s,
          profile: Array.isArray(s.profiles) ? s.profiles[0] : s.profiles
        })).filter((s) => !blocked.has(s.user_id));
        setStories(mapped);
        const map = /* @__PURE__ */ new Map();
        for (const s of mapped) {
          if (!map.has(s.user_id)) {
            map.set(s.user_id, {
              user_id: s.user_id,
              profile: s.profile,
              stories: []
            });
          }
          map.get(s.user_id).stories.push(s);
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
  const uploadStory = async () => {
    const filesToUpload = storyFiles.length > 0 ? storyFiles : storyFile ? [storyFile] : [];
    if (filesToUpload.length === 0) return;
    setUploadingStory(true);
    setStoryUploadProgress(0);
    let musicPublicUrl = null;
    if (selectedMusic) {
      try {
        const mExt = selectedMusic.name.split(".").pop() || "mp3";
        const mName = `stories/music-${userId}-${Date.now()}.${mExt}`;
        const { error: mErr } = await supabase.storage.from("avatars").upload(mName, selectedMusic, { upsert: true });
        if (!mErr) {
          const { data: mUrl } = supabase.storage.from("avatars").getPublicUrl(mName);
          musicPublicUrl = mUrl.publicUrl;
        }
      } catch (_) {
      }
    }
    let done = 0;
    for (const file of filesToUpload) {
      try {
        const ext = file.name.split(".").pop() || "jpg";
        const fileName = `stories/${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("stories").upload(fileName, file, { upsert: true });
        if (upErr) throw upErr;
        const { error: dbErr } = await supabase.from("stories").insert({
          user_id: userId,
          image_url: fileName,
          caption: storyCaption || null,
          emoji: storyEmoji || null,
          mood: storyMood || null,
          is_help_request: storyIsHelp || null,
          media_type: file.type.startsWith("audio/") ? "voice" : file.type.startsWith("video/") ? "video" : "image",
          music_url: musicPublicUrl || null
        });
        if (dbErr) {
          console.error("[ChatSystem upload] DB insert failed:", dbErr.message);
          toast.error("Story save failed: " + dbErr.message);
          setUploadingStory(false);
          return;
        }
      } catch (e) {
        const msg = e?.message || "";
        if (msg.includes("does not exist") || msg.includes("relation")) {
          toast.error(
            "Stories table missing. Run the stories SQL setup first."
          );
        } else if (msg.includes("storage") || msg.includes("bucket")) {
          toast.error(
            "Storage bucket error. Check Supabase storage permissions."
          );
        } else if (msg.includes("row-level") || msg.includes("policy")) {
          toast.error("Permission denied. Check Supabase RLS policies.");
        } else {
          console.warn("[uploadStory]", msg);
        }
      }
      done++;
      setStoryUploadProgress(Math.round(done / filesToUpload.length * 100));
    }
    toast.success(
      filesToUpload.length > 1 ? `${filesToUpload.length} stories posted! \xF0\u0178\u0152\u0178` : "Story posted! \xF0\u0178\u0152\xB9"
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
  const deleteStory = async (story) => {
    setDeletingStory(true);
    try {
      const { error } = await supabase.from("stories").delete().eq("id", story.id).eq("user_id", userId);
      if (error) throw error;
      setStories((prev) => prev.filter((s) => s.id !== story.id));
      setViewingStory(null);
      toast.success("Story deleted \xE2\u0153\u201C");
    } catch (e) {
      toast.error("Could not delete story: " + (e?.message || "Unknown error"));
    } finally {
      setDeletingStory(false);
    }
  };
  const deleteViewerStory = async () => {
    const group = storyGroups[viewerGroupIdx];
    const story = group?.stories[viewerStoryIdx];
    if (!story) return;
    const { error } = await supabase.from("stories").delete().eq("id", story.id).eq("user_id", userId);
    if (error) {
      toast.error("Could not delete story");
      return;
    }
    toast.success("Story deleted \xE2\u0153\u201C");
    const newGroups = storyGroups.map(
      (g, gi) => gi === viewerGroupIdx ? {
        ...g,
        stories: g.stories.filter((_, si) => si !== viewerStoryIdx)
      } : g
    ).filter((g) => g.stories.length > 0);
    setStoryGroups(newGroups);
    if (newGroups.length === 0) {
      setStoryViewerOpen(false);
      setViewingStory(null);
      return;
    }
    const newGroupIdx = Math.min(viewerGroupIdx, newGroups.length - 1);
    const newStoryIdx = Math.min(
      viewerStoryIdx,
      newGroups[newGroupIdx].stories.length - 1
    );
    setViewerGroupIdx(newGroupIdx);
    setViewerStoryIdx(newStoryIdx);
    setStoryElapsed(0);
  };
  const saveViewerEdit = async () => {
    const group = storyGroups[viewerGroupIdx];
    const story = group?.stories[viewerStoryIdx];
    if (!story) return;
    const { error } = await supabase.from("stories").update({ caption: viewerEditCaption, mood: viewerEditMood || null }).eq("id", story.id).eq("user_id", userId);
    if (error) {
      toast.error("Could not save changes");
      return;
    }
    const newGroups = storyGroups.map(
      (g, gi) => gi === viewerGroupIdx ? {
        ...g,
        stories: g.stories.map(
          (s, si) => si === viewerStoryIdx ? {
            ...s,
            caption: viewerEditCaption,
            mood: viewerEditMood || null
          } : s
        )
      } : g
    );
    setStoryGroups(newGroups);
    setViewerEditing(false);
    toast.success("Story updated \xE2\u0153\xA8");
  };
  const updateStory = async () => {
    if (!editingStory) return;
    setUploadingStory(true);
    try {
      const { error } = await supabase.from("stories").update({ caption: storyCaption, emoji: storyEmoji }).eq("id", editingStory.id).eq("user_id", userId);
      if (error) throw error;
      setStories(
        (prev) => prev.map(
          (s) => s.id === editingStory.id ? { ...s, caption: storyCaption, emoji: storyEmoji } : s
        )
      );
      toast.success("Story updated \xE2\u0153\xA8");
      setShowStoryEditor(false);
      setEditingStory(null);
      setStoryCaption("");
      setStoryEmoji("");
      clearStoryPreviews();
      setStoryFile(null);
    } catch (e) {
      toast.error("Update failed: " + (e?.message || "Unknown error"));
    } finally {
      setUploadingStory(false);
    }
  };
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
    fetchStories
  ]);
  const contactsRef = useRef([]);
  const messageRequestsRef = useRef([]);
  const mutedChatsRef = useRef(/* @__PURE__ */ new Set());
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
    const handler = async (e) => {
      const detail = e.detail;
      if (!detail?.userId || detail.userId === userId) return;
      await fetchContacts();
      const existing = contactsRef.current.find((c) => c.id === detail.userId) || messageRequestsRef.current.find((c) => c.id === detail.userId);
      let target = existing;
      if (!target) {
        const { data: profile, error } = await supabase.from("profiles").select("id, full_name, username, avatar_url, is_private_mode").eq("id", detail.userId).maybeSingle();
        if (error || !profile) {
          toast.error("This conversation is unavailable.");
          return;
        }
        target = {
          id: profile.id,
          full_name: profile.full_name || profile.username || detail.full_name || "User",
          username: profile.username || "",
          avatar_url: profile.avatar_url || detail.avatar_url || "",
          is_private_mode: profile.is_private_mode === true,
          unread_count: 0
        };
      }
      await handleSelectContact(target);
    };
    window.addEventListener("flicks:open-chat", handler);
    onReady?.();
    return () => window.removeEventListener("flicks:open-chat", handler);
  }, [userId, fetchContacts, onReady]);
  useEffect(() => {
    storyElapsedRef.current = storyElapsed;
  }, [storyElapsed]);
  useEffect(() => {
    if (!storyViewerOpen || storyPaused || storyGroups.length === 0) return;
    const startedAt = Date.now() - storyElapsedRef.current * 1e3;
    const deadline = startedAt + 15e3;
    storyDeadlineRef.current = deadline;
    let advanced = false;
    let intervalId = null;
    const stopTimer = () => {
      if (intervalId !== null) clearInterval(intervalId);
      intervalId = null;
      storyTimerRef.current = null;
    };
    const tick = () => {
      if (document.hidden) {
        stopTimer();
        return;
      }
      const now = Date.now();
      if (now >= deadline) {
        if (advanced) return;
        advanced = true;
        stopTimer();
        storyDeadlineRef.current = null;
        const group = storyGroups[viewerGroupIdx];
        const totalInGroup = group?.stories.length ?? 0;
        if (viewerStoryIdx + 1 < totalInGroup) {
          setViewerStoryIdx(viewerStoryIdx + 1);
        } else if (viewerGroupIdx + 1 < storyGroups.length) {
          setViewerGroupIdx(viewerGroupIdx + 1);
          setViewerStoryIdx(0);
        } else {
          setStoryViewerOpen(false);
          setViewingStory(null);
        }
        return;
      }
      setStoryElapsed(Math.min(15, Math.max(0, (now - startedAt) / 1e3)));
    };
    const startTimer = (resuming = false) => {
      if (intervalId !== null || document.hidden) return;
      intervalId = window.setInterval(tick, 1e3);
      storyTimerRef.current = intervalId;
      if (resuming) tick();
    };
    const handleVisibilityChange = () => {
      if (document.hidden) stopTimer();
      else startTimer(true);
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    startTimer();
    tick();
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stopTimer();
    };
  }, [
    storyViewerOpen,
    storyPaused,
    viewerGroupIdx,
    viewerStoryIdx,
    storyGroups
  ]);
  useEffect(() => {
    storyElapsedRef.current = 0;
    setStoryElapsed(0);
  }, [viewerGroupIdx, viewerStoryIdx]);
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
      audio.play().catch(() => {
      });
      storyAudioRef.current = audio;
    }
    return stopAudio;
  }, [storyViewerOpen, viewerGroupIdx, viewerStoryIdx, storyGroups]);
  useEffect(() => {
    const stopVideo = () => {
      storyVideoRef.current?.pause();
      if (storyVideoRef.current) storyVideoRef.current.currentTime = 0;
    };
    const handleVisibility = () => {
      if (document.hidden) {
        stopVideo();
        storyAudioRef.current?.pause();
      } else if (storyViewerOpen && !storyPaused) {
        storyVideoRef.current?.play().catch(() => {
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    if (!storyViewerOpen) {
      stopVideo();
      storyAudioRef.current?.pause();
    }
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [storyViewerOpen, storyPaused]);
  useEffect(() => {
    if (!storyViewerOpen) return;
    const group = storyGroups[viewerGroupIdx];
    const story = group?.stories[viewerStoryIdx];
    if (!story || storyViewedRef.current.has(story.id)) return;
    storyViewedRef.current.add(story.id);
    supabase.from("story_views").insert({ story_id: story.id, viewer_id: userId }).then(() => {
    });
  }, [storyViewerOpen, viewerGroupIdx, viewerStoryIdx, storyGroups, userId]);
  useEffect(() => {
    if (!isOpen || !userId) return;
    const cleanup = subscribeWhileVisible(() => {
      const ch = supabase.channel("cx-presence", {
        config: { presence: { key: userId } }
      });
      ch.on("presence", { event: "sync" }, () => {
        const state = ch.presenceState();
        const ids = /* @__PURE__ */ new Set();
        Object.values(state).flat().forEach((p) => {
          if (p.user_id) ids.add(p.user_id);
        });
        setOnlineUsers(ids);
      }).subscribe((status) => {
        if (status === "SUBSCRIBED") {
          if (activeStatus && !isActiveHidden) {
            void ch.track({ user_id: userId });
          }
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          console.warn("[Presence] Realtime channel status:", status);
          return;
        }
      });
      presenceChannelRef.current = ch;
      return ch;
    }, { onVisible: () => setOnlineUsers(/* @__PURE__ */ new Set()) });
    return () => {
      cleanup();
      presenceChannelRef.current = null;
    };
  }, [isOpen, userId, activeStatus, isActiveHidden]);
  useEffect(() => {
    const ch = presenceChannelRef.current;
    if (!ch) return;
    if (activeStatus && !isActiveHidden) {
      ch.track({ user_id: userId });
    } else {
      ch.untrack();
    }
  }, [activeStatus, userId, isActiveHidden]);
  useEffect(() => {
    if (!isOpen) return;
    const cleanup = subscribeWhileVisible(
      () => supabase.channel(`friendships-rt-${userId}`).on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "friendships", filter: `receiver_id=eq.${userId}` },
        (p) => {
          const row = p.new;
          if (row.receiver_id === userId || row.sender_id === userId) {
            fetchFriendships();
            if (row.receiver_id === userId && row.status === "pending")
              fetchPendingRequests();
          }
        }
      ).on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "friendships", filter: `receiver_id=eq.${userId}` },
        (p) => {
          const row = p.new;
          if (row.receiver_id === userId || row.sender_id === userId) {
            fetchFriendships();
            fetchPendingRequests();
            if (row.status === "accepted") fetchContacts();
          }
        }
      ).subscribe(),
      { onVisible: () => {
        void fetchFriendships();
        void fetchPendingRequests();
        void fetchContacts();
      } }
    );
    return () => {
      cleanup();
    };
  }, [isOpen, userId, fetchFriendships, fetchPendingRequests, fetchContacts]);
  useEffect(() => {
    if (!isOpen) return;
    const cleanup = subscribeWhileVisible(
      () => supabase.channel(`alerts-rt-${userId}`).on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${userId}` },
        (p) => {
          const msg = p.new;
          if (msg.receiver_id === userId) {
            const sender = contactsRef.current.find(
              (c) => c.id === msg.sender_id
            );
            if (sender && !mutedChatsRef.current.has(msg.sender_id)) {
              setAlerts(
                (prev) => [
                  {
                    id: `msg-${msg.id}`,
                    text: `${sender.full_name}: ${msg.content || "\xF0\u0178\u201C\u017D Media"}`,
                    time: (/* @__PURE__ */ new Date()).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit"
                    }),
                    read: false
                  },
                  ...prev
                ].slice(0, 50)
              );
            }
          }
        }
      ).subscribe()
    );
    return () => {
      cleanup();
    };
  }, [isOpen, userId]);
  const fetchUnseenCount = useCallback(async () => {
    if (!userId) return;
    const { count } = await supabase.from("messages").select("id", { count: "exact", head: true }).eq("receiver_id", userId).is("seen_at", null);
    setUnseenMsgCount(count ?? 0);
  }, [userId]);
  useEffect(() => {
    if (!userId) return;
    fetchUnseenCount();
    return subscribeWhileVisible(
      () => supabase.channel(`unseen-count-${userId}`).on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${userId}` },
        (p) => {
          const msg = p.new;
          if (msg.receiver_id === userId && !msg.seen_at) {
            setUnseenMsgCount((prev) => prev + 1);
          }
        }
      ).on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `receiver_id=eq.${userId}` },
        (p) => {
          const msg = p.new;
          const old = p.old;
          if (msg.receiver_id === userId && msg.seen_at && !old?.seen_at) {
            setUnseenMsgCount((prev) => Math.max(0, prev - 1));
          }
        }
      ).subscribe(),
      { onVisible: () => {
        void fetchUnseenCount();
      } }
    );
  }, [userId, fetchUnseenCount]);
  useEffect(() => {
    onUnreadCountChange?.(pendingCount + unseenMsgCount);
  }, [pendingCount, unseenMsgCount, onUnreadCountChange]);
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchAbortRef.current?.abort();
    searchAbortRef.current = null;
    const requestSeq = ++searchRequestSeqRef.current;
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      const q = searchQuery.trim();
      const controller = new AbortController();
      searchAbortRef.current = controller;
      const { data, error } = await searchVisibleProfiles(q, 20);
      if (controller.signal.aborted || requestSeq !== searchRequestSeqRef.current) return;
      if (error) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }
      setSearchResults(
        (data || []).map((p) => ({
          id: p.id,
          full_name: p.full_name || p.username || "Unknown",
          username: p.username || "",
          avatar_url: p.avatar_url || "",
          is_private_mode: p.is_private_mode === true
        }))
      );
      setIsSearching(false);
    }, 500);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchAbortRef.current?.abort();
    };
  }, [searchQuery, userId]);
  const loadOlderMessages = useCallback(async () => {
    if (!selectedUser || !userId || !oldestMessageCursorRef.current || !hasOlderMessages || olderLoadInFlightRef.current) return;
    const myId = String(userId).trim();
    const partnerId = String(selectedUser.id || "").trim();
    const cursor = oldestMessageCursorRef.current;
    const pane = messagesPaneRef.current;
    olderLoadInFlightRef.current = true;
    setLoadingOlderMessages(true);
    const previousHeight = pane?.scrollHeight ?? 0;
    try {
      const { data, error } = await supabase.from("messages").select("id, sender_id, receiver_id, content, media_url, media_type, created_at, seen_at, reply_to_id").in("sender_id", [myId, partnerId]).in("receiver_id", [myId, partnerId]).lt("created_at", cursor).order("created_at", { ascending: false }).limit(200);
      if (error) {
        console.error("[Chat] load older messages error:", error.message);
        return;
      }
      const rows = (data || []).map((m) => ({
        ...m,
        id: String(m.id || "").trim(),
        sender_id: String(m.sender_id || "").trim(),
        receiver_id: String(m.receiver_id || "").trim(),
        content: m.content ?? ""
      })).reverse();
      if (rows.length) {
        oldestMessageCursorRef.current = rows[0].created_at;
        setMessages((prev) => {
          const merged = new Map(prev.map((message) => [message.id, message]));
          rows.forEach((message) => merged.set(message.id, { ...merged.get(message.id), ...message }));
          return [...merged.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
        });
      }
      setHasOlderMessages(rows.length === 200);
      requestAnimationFrame(() => {
        if (pane) pane.scrollTop += pane.scrollHeight - previousHeight;
      });
    } finally {
      olderLoadInFlightRef.current = false;
      setLoadingOlderMessages(false);
    }
  }, [hasOlderMessages, selectedUser, userId]);
  useEffect(() => {
    if (!isOpen || !selectedUser || !userId) return;
    const myId = String(userId).trim();
    const partnerId = String(selectedUser.id || "").trim();
    if (!myId || !partnerId) return;
    setIsOtherTyping(false);
    setShowChatMenu(false);
    setPanicMode(false);
    setReplyTo(null);
    setShowInputEmoji(false);
    const conversationKey = `${myId}:${partnerId}`;
    conversationKeyRef.current = conversationKey;
    oldestMessageCursorRef.current = null;
    setHasOlderMessages(false);
    setMessages([]);
    setMsgReactions({});
    messageReactionRowsRef.current = /* @__PURE__ */ new Map();
    const load = async () => {
      if (messageLoadInFlightRef.current) return;
      messageLoadInFlightRef.current = true;
      setLoadingMessages(true);
      if (!myId || !partnerId) {
        setLoadingMessages(false);
        return;
      }
      let { data, error } = await supabase.from("messages").select(
        "id, sender_id, receiver_id, content, media_url, media_type, created_at, seen_at, reply_to_id"
      ).in("sender_id", [myId, partnerId]).in("receiver_id", [myId, partnerId]).order("created_at", { ascending: false }).limit(200);
      if (error) {
        console.error("[Chat] fetchMessages error:", error.message);
        setLoadingMessages(false);
        messageLoadInFlightRef.current = false;
        return;
      }
      const rows = (data || []).map((m) => ({
        ...m,
        id: String(m.id || "").trim(),
        sender_id: String(m.sender_id || "").trim(),
        receiver_id: String(m.receiver_id || "").trim(),
        content: m.content ?? ""
      }));
      if (conversationKeyRef.current !== conversationKey) {
        setLoadingMessages(false);
        messageLoadInFlightRef.current = false;
        return;
      }
      const orderedRows = rows.reverse();
      const isInitialWindow = oldestMessageCursorRef.current === null;
      if (isInitialWindow) {
        oldestMessageCursorRef.current = orderedRows[0]?.created_at ?? null;
        setHasOlderMessages(orderedRows.length === 200);
      }
      setMessages((prev) => {
        if (conversationKeyRef.current !== conversationKey || prev.length === 0)
          return orderedRows;
        const merged = new Map(prev.map((message) => [message.id, message]));
        orderedRows.forEach((message) => merged.set(message.id, { ...merged.get(message.id), ...message }));
        return [...merged.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
      });
      setLoadingMessages(false);
      messageLoadInFlightRef.current = false;
      lastMessageLoadAtRef.current = Date.now();
      await supabase.from("messages").update({ seen_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("receiver_id", myId).eq("sender_id", partnerId).is("seen_at", null);
    };
    load().then(() => fetchMsgReactions(myId, partnerId));
    const convKey = [myId, partnerId].sort().join("-");
    const isConversationMessage = (row) => {
      if (!row) return false;
      const sid = String(row.sender_id || "").trim();
      const rid = String(row.receiver_id || "").trim();
      if (sid || rid) {
        return sid === myId && rid === partnerId || sid === partnerId && rid === myId;
      }
      return Boolean(row.id && messagesRef.current.some((m) => m.id === row.id));
    };
    const applyReactionChange = (payload) => {
      const nextRaw = payload.new;
      const oldRaw = payload.old;
      const oldFromCache = oldRaw?.id ? messageReactionRowsRef.current.get(String(oldRaw.id)) : void 0;
      const oldRow = oldRaw?.message_id ? {
        id: oldRaw.id ? String(oldRaw.id) : void 0,
        message_id: String(oldRaw.message_id),
        user_id: String(oldRaw.user_id || ""),
        emoji: String(oldRaw.emoji || "")
      } : oldFromCache;
      const nextRow = nextRaw?.message_id ? {
        id: nextRaw.id ? String(nextRaw.id) : void 0,
        message_id: String(nextRaw.message_id),
        user_id: String(nextRaw.user_id || ""),
        emoji: String(nextRaw.emoji || "")
      } : void 0;
      const messageId = nextRow?.message_id || oldRow?.message_id;
      if (!messageId || !messagesRef.current.some((message) => message.id === messageId)) {
        return;
      }
      const removeReaction = (current, row) => {
        if (!row?.emoji || !row.user_id) return;
        const users = current[row.emoji] || [];
        const remaining = users.filter((id) => id !== row.user_id);
        if (remaining.length) current[row.emoji] = remaining;
        else delete current[row.emoji];
      };
      const addReaction = (current, row) => {
        if (!row?.emoji || !row.user_id) return;
        const users = current[row.emoji] || [];
        if (!users.includes(row.user_id)) {
          current[row.emoji] = [...users, row.user_id];
        }
      };
      if (oldRow?.id) messageReactionRowsRef.current.delete(oldRow.id);
      if (nextRow?.id) messageReactionRowsRef.current.set(nextRow.id, nextRow);
      setMsgReactions((previous) => {
        const current = Object.fromEntries(
          Object.entries(previous[messageId] || {}).map(([emoji, users]) => [
            emoji,
            [...users]
          ])
        );
        if (payload.eventType === "DELETE" || payload.eventType === "UPDATE") {
          removeReaction(current, oldRow);
        }
        if (payload.eventType !== "DELETE") addReaction(current, nextRow);
        const next = { ...previous };
        if (Object.keys(current).length) next[messageId] = current;
        else delete next[messageId];
        return next;
      });
    };
    const createConversationChannel = () => supabase.channel(`conv-${convKey}`).on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (p) => {
        const msg = p.new;
        const sid = String(msg.sender_id || "").trim();
        const rid = String(msg.receiver_id || "").trim();
        if (!isConversationMessage(msg)) return;
        if (deletedForMeIdsRef.current.has(msg.id)) return;
        setMessages((prev) => {
          if (prev.find((m) => m.id === msg.id)) return prev;
          const next = [...prev, msg];
          return next.sort((a, b) => a.created_at.localeCompare(b.created_at));
        });
        scheduleContactsRefresh();
        if (rid === myId && sid === partnerId) {
          supabase.from("messages").update({ seen_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", msg.id).then(() => {
          });
          if (msg.content) {
            const kwEmoji = getKeywordEmoji(msg.content);
            if (kwEmoji) {
              setEmojiBlast({ id: ++blastIdRef.current, emoji: kwEmoji });
            }
          }
          getRiskProfile(sid).then((profile) => {
            if (profile?.is_flagged) {
              const senderName = contactsRef.current.find((c) => c.id === sid)?.full_name || "Unknown";
              if (suspiciousTimerRef.current)
                clearTimeout(suspiciousTimerRef.current);
              setSuspiciousAlert({ senderName });
              suspiciousTimerRef.current = setTimeout(
                () => setSuspiciousAlert(null),
                8e3
              );
            }
          });
          if (loveProtectPartnerRef.current && sid === loveProtectPartnerRef.current) {
            console.log(
              "[LoveProtect] Incoming message from partner \xE2\u20AC\u201D running violation check.",
              { partnerId: loveProtectPartnerRef.current, msgId: msg.id }
            );
            checkLoveProtectViolation(loveProtectPartnerRef.current).then(
              (violated) => {
                console.log("[LoveProtect] Violation result:", violated);
                if (violated) {
                  if (loveProtectTimerRef.current)
                    clearTimeout(loveProtectTimerRef.current);
                  setLoveProtectAlert(true);
                  sendSafetyNotification(
                    myId,
                    "love_protect",
                    "Warning: Your partner's communication pattern shows suspicious inconsistencies."
                  );
                  loveProtectTimerRef.current = setTimeout(
                    () => setLoveProtectAlert(false),
                    15e3
                  );
                }
              }
            );
          }
        }
      }
    ).on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "messages" },
      (p) => {
        const msg = p.new;
        if (isConversationMessage(msg)) {
          setMessages(
            (prev) => prev.map((m) => m.id === msg.id ? { ...m, ...msg } : m)
          );
          scheduleContactsRefresh();
        }
      }
    ).on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "messages" },
      (p) => {
        const deleted = p.old;
        const deletedId = String(deleted?.id || "");
        if (deletedId && isConversationMessage(deleted)) {
          setMessages((prev) => prev.filter((m) => m.id !== deletedId));
          setMsgReactions((prev) => {
            if (!(deletedId in prev)) return prev;
            const next = { ...prev };
            delete next[deletedId];
            return next;
          });
          for (const [reactionId, row] of messageReactionRowsRef.current) {
            if (row.message_id === deletedId) {
              messageReactionRowsRef.current.delete(reactionId);
            }
          }
          scheduleContactsRefresh();
        }
      }
    ).on(
      "postgres_changes",
      { event: "*", schema: "public", table: "message_reactions" },
      applyReactionChange
    ).subscribe();
    const cleanupConversationChannel = subscribeWhileVisible(
      createConversationChannel,
      {
        onVisible: () => {
          if (Date.now() - lastMessageLoadAtRef.current > 15e3) void load();
        }
      }
    );
    const typingKey = [myId, partnerId].sort().join("-");
    const createTypingChannel = () => {
      const typingCh = supabase.channel(`typing-${typingKey}`, {
        config: { presence: { key: myId } }
      });
      typingCh.on("presence", { event: "sync" }, () => {
        const state = typingCh.presenceState();
        const other = (state[selectedUser.id] || [])[0];
        setIsOtherTyping(other?.is_typing === true);
      }).subscribe();
      typingChannelRef.current = typingCh;
      return typingCh;
    };
    const cleanupTypingChannel = subscribeWhileVisible(createTypingChannel);
    return () => {
      cleanupConversationChannel();
      cleanupTypingChannel();
      typingChannelRef.current = null;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [isOpen, selectedUser, userId, scheduleContactsRefresh, fetchMsgReactions]);
  const sendFriendRequest = async (targetId) => {
    setActionLoading(targetId);
    try {
      if (!await canViewPrivateProfile(targetId)) {
        toast.error("This private profile is unavailable.");
        return;
      }
      const { error } = await supabase.from("friendships").insert({
        sender_id: userId,
        receiver_id: targetId,
        status: "pending"
      });
      if (error) {
        toast.error(`Request failed: ${error.message}`);
        return;
      }
      toast.success("Friend request sent!");
      await fetchFriendships();
    } catch (err) {
      toast.error(err?.message ?? "Error");
    } finally {
      setActionLoading("");
    }
  };
  const acceptRequest = async (req) => {
    setActionLoading(req.id);
    try {
      const { error } = await supabase.from("friendships").update({ status: "accepted" }).eq("id", req.id);
      if (error) {
        toast.error(`Error: ${error.message}`);
        return;
      }
      toast.success("Request accepted!");
      await Promise.all([
        fetchFriendships(),
        fetchPendingRequests(),
        fetchContacts()
      ]);
    } finally {
      setActionLoading("");
    }
  };
  const rejectRequest = async (req) => {
    setActionLoading(req.id);
    try {
      await supabase.from("friendships").update({ status: "rejected" }).eq("id", req.id);
      await Promise.all([fetchFriendships(), fetchPendingRequests()]);
    } finally {
      setActionLoading("");
    }
  };
  const handleSelectContact = async (user) => {
    if (blockedUserIds.has(user.id)) {
      toast.error("This conversation is unavailable.");
      return;
    }
    const friendship = friendshipMap.get(user.id);
    if (user.is_private_mode === true && friendship?.status !== "accepted" && !await canViewPrivateProfile(user.id)) {
      toast.error("This private profile is only available to friends or mutual connections.");
      return;
    }
    setSelectedUser(user);
    setContacts(
      (prev) => prev.map((c) => c.id === user.id ? { ...c, unread_count: 0 } : c)
    );
    setMessageRequests(
      (prev) => prev.map((c) => c.id === user.id ? { ...c, unread_count: 0 } : c)
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
  const handleSelectFromSearch = (user) => {
    if (blockedUserIds.has(user.id)) {
      toast.error("This conversation is unavailable.");
      return;
    }
    void handleSelectContact({ ...user });
  };
  const sendMessage = async (overrideText) => {
    const text = (typeof overrideText === "string" ? overrideText : newMessage).trim();
    const fileToSend = pendingFileRef.current || pendingFile;
    if (!text && !fileToSend) {
      console.warn("sendMessage: nothing to send \xE2\u20AC\u201D aborting");
      return;
    }
    if (!selectedUser) {
      console.warn("sendMessage: no selectedUser \xE2\u20AC\u201D aborting");
      return;
    }
    if (selectedUser.is_private_mode === true && friendshipMap.get(selectedUser.id)?.status !== "accepted" && !await canViewPrivateProfile(selectedUser.id)) {
      toast.error("You can only message private profiles as a friend or mutual connection.");
      setSelectedUser(null);
      return;
    }
    if (isSending) {
      console.warn("sendMessage: already sending \xE2\u20AC\u201D aborting (isSending=true)");
      return;
    }
    if (fileToSend) {
      pendingFileRef.current = null;
      setPendingFile(null);
      clearPendingFile();
      uploadAndSendFile(fileToSend);
      if (!text) {
        setNewMessage("");
        return;
      }
    }
    setIsSending(true);
    const replyRef = replyTo;
    setReplyTo(null);
    if (soundEnabled) playSound("send");
    const realSenderId = userId;
    const tempId = `temp-${Date.now()}`;
    const tempMsg = {
      id: tempId,
      sender_id: realSenderId,
      receiver_id: selectedUser.id,
      content: text,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      reply_to_id: replyRef?.id
    };
    setMessages((prev) => {
      const next = [...prev, tempMsg];
      return next.length > 200 ? next.slice(-200) : next;
    });
    const kwEmoji = getKeywordEmoji(text);
    if (kwEmoji) {
      setEmojiBlast({ id: ++blastIdRef.current, emoji: kwEmoji });
    }
    if (hasRiskKeyword(text)) {
      incrementRiskScore(realSenderId);
    }
    const insertPayload = {
      sender_id: realSenderId,
      receiver_id: selectedUser.id,
      content: text
    };
    if (replyRef?.id) insertPayload.reply_to_id = replyRef.id;
    try {
      const { data, error } = await supabase.from("messages").insert(insertPayload).select("id,sender_id,receiver_id,content,media_url,media_type,created_at,seen_at,reply_to_id,reply_preview,reactions,is_edited").single();
      if (data) {
        setNewMessage("");
        setMessages(
          (prev) => prev.map((m) => m.id === tempId ? data : m)
        );
        scheduleContactsRefresh();
      } else if (error) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        console.error("[ChatSystem] sendMessage Supabase error:", error);
        const errMsg = (error.message || "").toLowerCase();
        const errCode = (error.code || "").toLowerCase();
        const isQuota = errMsg.includes("read-only") || errMsg.includes("quota") || errMsg.includes("readonly") || errMsg.includes("storage full") || errMsg.includes("disk") || errCode === "25006" || errCode === "53100" || error.status === 503 || error.status === 507;
        if (isQuota) {
          toast.error("Server busy \xE2\u20AC\u201D please try again in a few minutes.", {
            duration: 6e3
          });
        } else {
          const reason = error.code === "PGRST301" || error.code?.startsWith("42") ? "Permission denied \xE2\u20AC\u201D check Supabase RLS policies" : errMsg.includes("network") ? "Network error \xE2\u20AC\u201D check your connection" : error.message || "Unknown error";
          toast.error(`Message failed: ${reason}`, { duration: 5e3 });
        }
      }
    } catch (ex) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      console.error("[ChatSystem] sendMessage uncaught exception:", ex);
      toast.error(`Unexpected error: ${ex?.message || "Unknown"}`);
    } finally {
      setIsSending(false);
    }
  };
  const saveEditMsg = async () => {
    if (!editingMsg) return;
    const { id, text } = editingMsg;
    if (!text.trim()) return;
    await supabase.from("messages").update({ content: text.trim() }).eq("id", id);
    setMessages(
      (prev) => prev.map(
        (m) => m.id === id ? { ...m, content: text.trim(), is_edited: true } : m
      )
    );
    setEditingMsg(null);
  };
  const deleteMessage = async (msg, e) => {
    if (msg.sender_id !== userId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    setMsgMenuId(null);
    if (soundEnabled) playSound("delete");
    const newId = ++smokeIdRef.current;
    setSmokeParticles((prev) => [
      ...prev,
      {
        id: newId,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      }
    ]);
    const { error } = await supabase.from("messages").delete().eq("id", msg.id);
    if (error) {
      toast.error("Delete failed: " + error.message);
      setMessages(
        (prev) => [...prev, msg].sort((a, b) => a.created_at.localeCompare(b.created_at))
      );
    } else {
      toast.success("Message deleted for everyone \xF0\u0178\u2014\u2018\xEF\xB8\x8F");
    }
  };
  const deleteMessageAt = async (msg, x, y) => {
    if (msg.sender_id !== userId) return;
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    setChatMsgAction(null);
    if (soundEnabled) playSound("delete");
    const newId = ++smokeIdRef.current;
    setSmokeParticles((prev) => [...prev, { id: newId, x, y }]);
    const { error } = await supabase.from("messages").delete().eq("id", msg.id);
    if (error) {
      toast.error("Delete failed: " + error.message);
      setMessages(
        (prev) => [...prev, msg].sort((a, b) => a.created_at.localeCompare(b.created_at))
      );
    } else {
      toast.success("Message deleted for everyone \xF0\u0178\u2014\u2018\xEF\xB8\x8F");
    }
  };
  const sendSticker = async (stickerUrl) => {
    if (!selectedUser || !stickerUrl) return;
    setIsSending(true);
    const tempId = `temp-sticker-${Date.now()}`;
    const tempMsg = {
      id: tempId,
      sender_id: userId,
      receiver_id: selectedUser.id,
      content: "",
      media_url: stickerUrl,
      media_type: "image/png",
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    setMessages((prev) => {
      const next = [...prev, tempMsg];
      return next.length > 200 ? next.slice(-200) : next;
    });
    try {
      const { data, error } = await supabase.from("messages").insert({
        sender_id: userId,
        receiver_id: selectedUser.id,
        content: "",
        media_url: stickerUrl,
        media_type: "image/png"
      }).select(
        "id,sender_id,receiver_id,content,media_url,media_type,created_at,seen_at,reply_to_id,reply_preview,reactions,is_edited"
      ).single();
      if (data) {
        setMessages(
          (prev) => prev.map((m) => m.id === tempId ? data : m)
        );
        scheduleContactsRefresh();
        if (soundEnabled) playSound("send");
      } else if (error) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        toast.error(`Sticker failed: ${error.message}`);
      }
    } catch (ex) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      console.error("[ChatSystem] sendSticker uncaught exception:", ex);
      toast.error(`Unexpected error: ${ex?.message || "Unknown"}`);
    } finally {
      setIsSending(false);
    }
  };
  const handleMediaUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const MAX_BYTES = 100 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      toast.error("File too large. Maximum allowed size is 100 MB.");
      return;
    }
    setPendingFile(file);
    pendingFileRef.current = file;
    if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
      const objectUrl = URL.createObjectURL(file);
      clearPendingFile();
      setPendingFile(file);
      pendingFileRef.current = file;
      setPendingFilePreview(objectUrl);
    } else {
      clearPendingFile();
      setPendingFile(file);
      pendingFileRef.current = file;
      setPendingFilePreview(null);
    }
    const label = file.type.startsWith("video/") ? "\xF0\u0178\u017D\xA5 Video" : file.type.startsWith("audio/") ? "\xF0\u0178\u017D\xB5 Audio" : "\xF0\u0178\u2013\xBC\xEF\xB8\x8F Image";
    toast.success(`${label} attached \xE2\u20AC\u201D tap Send or say "Bhej do" to send`);
  };
  const clearPendingFile = () => {
    revokeObjectUrl(pendingFilePreview);
    setPendingFile(null);
    setPendingFilePreview(null);
    pendingFileRef.current = null;
  };
  const uploadAndSendFile = async (file) => {
    if (!selectedUser) return;
    setIsUploadingMedia(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `${userId}-${Date.now()}.${ext}`;
      const { error: storageError } = await supabase.storage.from(CHAT_BUCKET).upload(fileName, file, { contentType: file.type, upsert: false });
      if (storageError) {
        console.error("Supabase Storage Error:", storageError);
        toast.error(
          `Media upload failed: ${storageError.message}. Make sure the "${CHAT_BUCKET}" bucket exists in Supabase Storage.`,
          { duration: 6e3 }
        );
        return;
      }
      const { data: urlData } = supabase.storage.from(CHAT_BUCKET).getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;
      const insertPayload = {
        sender_id: userId,
        receiver_id: selectedUser.id,
        content: "",
        media_url: publicUrl,
        media_type: file.type
      };
      const { data, error: dbError } = await supabase.from("messages").insert(insertPayload).select("id,sender_id,receiver_id,content,media_url,media_type,created_at,seen_at,reply_to_id,reply_preview,reactions,is_edited").single();
      if (dbError) {
        console.error("Supabase DB Insert Error:", dbError);
        toast.error(`Media message failed: ${dbError.message}`, {
          duration: 5e3
        });
        return;
      }
      if (data) {
        setMessages((prev) => {
          if (prev.find((m) => m.id === data.id)) return prev;
          const next = [...prev, data];
          return next.length > 200 ? next.slice(-200) : next;
        });
        scheduleContactsRefresh();
        if (soundEnabled) playSound("send");
      }
    } catch (err) {
      console.error("Unexpected media upload error:", err);
      toast.error(`Upload failed: ${err?.message || "Unknown error"}`);
    } finally {
      setIsUploadingMedia(false);
    }
  };
  const saveProfileSettings = async () => {
    setSavingProfile(true);
    const { error } = await supabase.from("profiles").update({ bio: editBio, school: editSchool, location: editLocation }).eq("id", userId);
    setSavingProfile(false);
    if (error) toast.error("Save failed: " + error.message);
    else {
      toast.success("Profile updated!");
      fetchMyProfile();
    }
  };
  const formatTime = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    const now = /* @__PURE__ */ new Date();
    return d.toDateString() === now.toDateString() ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString([], { month: "short", day: "numeric" });
  };
  const lastMsgPreview = (c) => {
    if (c.last_media_type) {
      if (c.last_media_type.startsWith("image/")) return "\xF0\u0178\u201C\xB7 Photo";
      if (c.last_media_type.startsWith("video/")) return "\xF0\u0178\u017D\xA5 Video";
      if (c.last_media_type.startsWith("audio/")) return "\xF0\u0178\u017D\xB5 Audio";
      return "\xF0\u0178\u201C\u017D File";
    }
    return c.last_message || "";
  };
  const toggleMute = (id) => setMutedChats((prev) => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const toggleArchive = (id) => setArchivedChats((prev) => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const stopVoiceMode = useCallback(() => {
    voiceActiveRef.current = false;
    if (voiceTimerRef.current) {
      clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    voiceTimeoutsRef.current.forEach((timer) => clearTimeout(timer));
    voiceTimeoutsRef.current.clear();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
      }
      recognitionRef.current = null;
    }
    setVoiceMode(false);
    setVoiceSecondsLeft(300);
    setVoiceStatus("listening");
  }, []);
  useEffect(() => {
    if (!voiceMode) return;
    const tick = () => {
      if (document.hidden) return;
      setVoiceSecondsLeft((prev) => {
        if (prev <= 1) {
          stopVoiceMode();
          return 0;
        }
        return prev - 1;
      });
    };
    const stopTimer = () => {
      if (!voiceTimerRef.current) return;
      clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    };
    const startTimer = () => {
      if (document.hidden || voiceTimerRef.current || !voiceActiveRef.current) return;
      voiceTimerRef.current = window.setInterval(tick, 1e3);
    };
    const handleVisibilityChange = () => {
      if (document.hidden) stopTimer();
      else startTimer();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    startTimer();
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stopTimer();
    };
  }, [voiceMode, stopVoiceMode]);
  const scheduleVoiceTimeout = (callback, delay) => {
    const timer = setTimeout(() => {
      voiceTimeoutsRef.current.delete(timer);
      if (voiceActiveRef.current) callback();
    }, delay);
    voiceTimeoutsRef.current.add(timer);
  };
  useEffect(() => {
    if (!isOpen) stopVoiceMode();
    return () => {
      stopVoiceMode();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (panicClickRef.current.timer) {
        clearTimeout(panicClickRef.current.timer);
        panicClickRef.current.timer = null;
      }
    };
  }, [isOpen]);
  const startVoiceMode = () => {
    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Voice not supported in this browser. Try Chrome.");
      return;
    }
    voiceActiveRef.current = true;
    setVoiceMode(true);
    setVoiceSecondsLeft(300);
    setVoiceStatus("listening");
    const createRecognition = () => {
      const rec2 = new SpeechRecognition();
      rec2.continuous = true;
      rec2.interimResults = false;
      rec2.lang = "hi-IN";
      rec2.onresult = (e) => {
        if (!voiceActiveRef.current) return;
        setVoiceStatus("processing");
        const latest = e.results[e.resultIndex];
        if (!latest || !latest[0]) {
          setVoiceStatus("listening");
          return;
        }
        const raw = latest[0].transcript.trim().toLowerCase().replace(/[à¥¤,.!?]+$/, "").trim();
        if (!raw) {
          setVoiceStatus("listening");
          return;
        }
        if (/^(send|à¤­à¥‡à¤œ à¤¦à¥‹|à¤­à¥‡à¤œà¥‹|à¤­à¥‡à¤œà¤¨à¤¾|send karo|message send|message bhejo|bhej do|bhejo)$/.test(
          raw
        )) {
          setNewMessage((prev) => {
            sendMessage(prev);
            return prev;
          });
          scheduleVoiceTimeout(() => setVoiceStatus("listening"), 600);
          return;
        }
        if (/^(clear|clear chat|wipe|wipe chat|sab saaf|sab saaf karo|à¤¸à¤¬ à¤¸à¤¾à¤«|à¤¸à¤¬ à¤¸à¤¾à¤« à¤•à¤°à¥‹|saaf karo|chat saaf|saaf)$/.test(
          raw
        )) {
          messages.forEach((m) => rememberDeletedMessage(m.id));
          setMessages([]);
          toast.success("\xF0\u0178\xA7\xB9 Chat cleared!");
          scheduleVoiceTimeout(() => setVoiceStatus("listening"), 600);
          return;
        }
        if (/^(panic|panic mode|emergency|à¤ªà¥ˆà¤¨à¤¿à¤•|à¤ªà¥ˆà¤¨à¤¿à¤• à¤®à¥‹à¤¡)$/.test(raw)) {
          setPanicMode(true);
          scheduleVoiceTimeout(() => setVoiceStatus("listening"), 600);
          return;
        }
        if (/^(stop|stop voice|band karo|band kar|à¤¬à¤‚à¤¦ à¤•à¤°à¥‹|à¤°à¥à¤•à¥‹|mic band|voice band)$/.test(
          raw
        )) {
          stopVoiceMode();
          toast.success("\xF0\u0178\u201D\u2021 Voice mode stopped");
          return;
        }
        const writeMatch = raw.match(
          /^(?:likh|likho|likhna|write|type|à¤²à¤¿à¤–|à¤²à¤¿à¤–à¥‹|à¤²à¤¿à¤–à¤¨à¤¾)\s+(.+)/
        );
        if (writeMatch) {
          const msg = writeMatch[1].trim();
          setNewMessage(msg);
          toast.success(`\xE2\u0153\x8D\xEF\xB8\x8F "${msg}"`);
          scheduleVoiceTimeout(() => setVoiceStatus("listening"), 600);
          return;
        }
        setNewMessage((prev) => prev ? prev + " " + raw : raw);
        scheduleVoiceTimeout(() => setVoiceStatus("listening"), 600);
      };
      rec2.onerror = () => {
        scheduleVoiceTimeout(() => setVoiceStatus("listening"), 500);
      };
      rec2.onend = () => {
        if (voiceActiveRef.current) {
          scheduleVoiceTimeout(() => {
            if (voiceActiveRef.current) {
              try {
                rec2.start();
              } catch {
              }
            }
          }, 300);
        }
      };
      return rec2;
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
  const handleTyping = () => {
    const ch = typingChannelRef.current;
    if (!ch) return;
    ch.track({ is_typing: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      ch.track({ is_typing: false });
    }, 2e3);
  };
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
  const deleteForMe = (msgId) => {
    rememberDeletedMessage(msgId);
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    setMsgMenuId(null);
    setDeletingForMe(null);
  };
  const INPUT_EMOJIS = [
    "\xE2\x9D\xA4\xEF\xB8\x8F",
    "\xF0\u0178\u201D\xA5",
    "\xF0\u0178\u02DC\u201A",
    "\xF0\u0178\u02DC\x8D",
    "\xF0\u0178\xA5\xB0",
    "\xF0\u0178\u02DC\xAD",
    "\xF0\u0178\xA4\xA3",
    "\xF0\u0178\u2019\u20AC",
    "\xE2\u0153\xA8",
    "\xF0\u0178\u017D\u2030",
    "\xF0\u0178\u02DC\u0160",
    "\xF0\u0178\xA5\xBA",
    "\xF0\u0178\u02DC\xA4",
    "\xF0\u0178\u2019\xAF",
    "\xF0\u0178\u2013\u2022",
    "\xF0\u0178\u0152\xB9",
    "\xF0\u0178\u2019\u2022",
    "\xF0\u0178\xA4\xAF",
    "\xF0\u0178\u02DC\x8F",
    "\xF0\u0178\xAB\xB6",
    "\xF0\u0178\u2019\xAA",
    "\xF0\u0178\u2122\x8F",
    "\xF0\u0178\u02DC\u02C6",
    "\xF0\u0178\xA4\xA9",
    "\xF0\u0178\u2018\u20AC",
    "\xF0\u0178\xAB\xA0",
    "\xF0\u0178\u2019\u201D",
    "\xF0\u0178\xA5\xB9"
  ];
  const visibleContacts = contacts.filter((c) => !archivedChats.has(c.id));
  const archivedContactsList = contacts.filter((c) => archivedChats.has(c.id));
  const filteredMessages = chatSearch.trim() ? messages.filter(
    (m) => m.content?.toLowerCase().includes(chatSearch.toLowerCase())
  ) : messages;
  const unreadAlerts = alerts.filter((a) => !a.read).length;
  const FriendActionBtn = ({ user }) => {
    const fs = friendshipMap.get(user.id);
    const loading = actionLoading === user.id || actionLoading === fs?.id;
    if (fs?.status === "accepted")
      return /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: () => handleSelectFromSearch(user),
          className: `flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${T.pill}`
        },
        /* @__PURE__ */ React.createElement(MessageSquare, { size: 11 }),
        " Chat"
      );
    if (fs?.status === "pending" && fs.direction === "sent")
      return /* @__PURE__ */ React.createElement(
        "span",
        {
          className: `flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black opacity-40 ${T.pill}`
        },
        /* @__PURE__ */ React.createElement(Clock, { size: 11 }),
        " Sent"
      );
    if (fs?.status === "pending" && fs.direction === "received")
      return /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: () => {
            const req = pendingRequests.find((r) => r.sender_id === user.id);
            if (req) acceptRequest(req);
          },
          disabled: loading,
          className: "flex items-center gap-1 px-3 py-1.5 rounded-xl bg-green-500/20 text-green-400 border border-green-500/30 text-xs font-black disabled:opacity-40"
        },
        loading ? /* @__PURE__ */ React.createElement(Loader2, { size: 11, className: "animate-spin" }) : /* @__PURE__ */ React.createElement(UserCheck, { size: 11 }),
        " ",
        "Accept"
      );
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => sendFriendRequest(user.id),
        disabled: loading,
        className: `flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black transition-all disabled:opacity-40 ${T.pill}`
      },
      loading ? /* @__PURE__ */ React.createElement(Loader2, { size: 11, className: "animate-spin" }) : /* @__PURE__ */ React.createElement(UserPlus, { size: 11 }),
      " ",
      "Add"
    );
  };
  return /* @__PURE__ */ React.createElement(AnimatePresence, null, isOpen && /* @__PURE__ */ React.createElement(
    motion.div,
    {
      initial: { y: "100%" },
      animate: { y: 0 },
      exit: { y: "100%" },
      transition: { type: "spring", stiffness: 300, damping: 30 },
      className: `chat-shell fixed inset-0 z-[150] isolate flex h-[100dvh] min-h-0 flex-col ${T.wrap} overflow-hidden`,
      style: {
        top: "env(safe-area-inset-top, 0px)",
        height: "calc(100dvh - env(safe-area-inset-top, 0px))",
        backgroundColor: theme === "dairy-notebook" ? "#fbf0d9" : theme === "whatsapp" ? "#075E54" : theme === "maroon" ? "#050505" : "#e0e7ff"
      },
      onClick: (e) => e.stopPropagation(),
      onPointerDown: (e) => e.stopPropagation()
    },
    /* @__PURE__ */ React.createElement(AnimatePresence, null, panicMode && /* @__PURE__ */ React.createElement(
      motion.div,
      {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        className: "absolute inset-0 z-[999] bg-white flex flex-col items-center justify-center select-none"
      },
      /* @__PURE__ */ React.createElement(
        motion.div,
        {
          animate: { rotate: [0, -5, 5, -5, 5, 0] },
          transition: {
            duration: 0.5,
            repeat: Infinity,
            repeatDelay: 2
          },
          className: "text-[120px] leading-none mb-8"
        },
        "\xF0\u0178\u2013\u2022"
      ),
      /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: handlePanicUnlock,
          className: "w-16 h-16 rounded-full overflow-hidden border-2 border-gray-200 active:scale-95 transition-all shadow-lg"
        },
        myProfile?.avatar_url ? /* @__PURE__ */ React.createElement(
          "img",
          {
            src: myProfile.avatar_url,
            alt: "",
            className: "w-full h-full object-cover",
            decoding: "async",
            crossOrigin: "anonymous"
          }
        ) : /* @__PURE__ */ React.createElement("div", { className: "w-full h-full bg-gray-100 flex items-center justify-center text-2xl" }, "\xF0\u0178\u2018\xA4")
      ),
      /* @__PURE__ */ React.createElement("div", { className: "mt-6 flex gap-2" }, [0, 1, 2].map((i) => /* @__PURE__ */ React.createElement(
        motion.div,
        {
          key: i,
          className: "w-2 h-2 rounded-full bg-gray-200",
          animate: { scale: [1, 1.5, 1] },
          transition: {
            duration: 0.8,
            delay: i * 0.25,
            repeat: Infinity
          }
        }
      )))
    )),
    smokeParticles.map((p) => /* @__PURE__ */ React.createElement(
      SmokeParticle,
      {
        key: p.id,
        x: p.x,
        y: p.y,
        onDone: () => setSmokeParticles((prev) => prev.filter((s) => s.id !== p.id))
      }
    )),
    emojiBlast && /* @__PURE__ */ React.createElement(
      EmojiBlast,
      {
        key: emojiBlast.id,
        emoji: emojiBlast.emoji,
        onDone: () => setEmojiBlast(null)
      }
    ),
    /* @__PURE__ */ React.createElement(AnimatePresence, null, suspiciousAlert && /* @__PURE__ */ React.createElement(
      motion.div,
      {
        key: "suspicious-alert",
        initial: { y: -60, opacity: 0 },
        animate: { y: 0, opacity: 1 },
        exit: { y: -60, opacity: 0 },
        transition: { type: "spring", stiffness: 300, damping: 26 },
        className: "absolute top-16 left-3 right-3 z-[700] pointer-events-none"
      },
      /* @__PURE__ */ React.createElement(
        "div",
        {
          className: "rounded-2xl px-4 py-3 flex items-start gap-3 shadow-2xl border border-red-500/40",
          style: {
            background: "linear-gradient(135deg,rgba(220,38,38,0.95) 0%,rgba(153,27,27,0.97) 100%)"
          }
        },
        /* @__PURE__ */ React.createElement("span", { className: "text-2xl shrink-0 mt-0.5" }, "\xE2\u0161\xA0\xEF\xB8\x8F"),
        /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", { className: "text-white font-black text-sm tracking-wide leading-tight" }, "Warning: Suspicious Activity Detected"), /* @__PURE__ */ React.createElement("p", { className: "text-red-200 font-black text-sm tracking-wide leading-tight mt-0.5" }, "\xE0\xA4\u0161\xE0\xA5\u2021\xE0\xA4\xA4\xE0\xA4\xBE\xE0\xA4\xB5\xE0\xA4\xA8\xE0\xA5\u20AC: \xE0\xA4\xB8\xE0\xA4\u201A\xE0\xA4\xA6\xE0\xA4\xBF\xE0\xA4\u2014\xE0\xA5\x8D\xE0\xA4\xA7 \xE0\xA4\u2014\xE0\xA4\xA4\xE0\xA4\xBF\xE0\xA4\xB5\xE0\xA4\xBF\xE0\xA4\xA7\xE0\xA4\xBF"), /* @__PURE__ */ React.createElement("p", { className: "text-red-200/80 text-[11px] mt-1" }, "Message from", " ", /* @__PURE__ */ React.createElement("span", { className: "font-black text-white" }, suspiciousAlert.senderName), " ", "\xE2\u20AC\u201D this user has been flagged by our Safety Engine."))
      )
    )),
    /* @__PURE__ */ React.createElement(AnimatePresence, null, loveProtectAlert && /* @__PURE__ */ React.createElement(
      motion.div,
      {
        key: "love-protect-alert",
        initial: { y: -60, opacity: 0 },
        animate: { y: 0, opacity: 1 },
        exit: { y: -60, opacity: 0 },
        transition: { type: "spring", stiffness: 300, damping: 26 },
        className: "absolute top-16 left-3 right-3 z-[700] pointer-events-auto",
        style: { display: "block" }
      },
      /* @__PURE__ */ React.createElement(
        "div",
        {
          className: "rounded-2xl px-4 py-3 flex items-start gap-3 shadow-2xl border border-pink-500/40",
          style: {
            background: "linear-gradient(135deg,rgba(190,24,93,0.96) 0%,rgba(131,24,67,0.97) 100%)"
          }
        },
        /* @__PURE__ */ React.createElement("span", { className: "text-2xl shrink-0 mt-0.5" }, "\xF0\u0178\u2019\u201D"),
        /* @__PURE__ */ React.createElement("div", { className: "flex-1" }, /* @__PURE__ */ React.createElement("p", { className: "text-white font-black text-sm tracking-wide" }, "Love Protect \xE2\u20AC\u201D System Alert"), /* @__PURE__ */ React.createElement("p", { className: "text-pink-200 text-[11px] mt-1 leading-relaxed" }, "Warning: Your partner's communication pattern shows suspicious inconsistencies. No chat content is visible to protect your privacy.")),
        /* @__PURE__ */ React.createElement(
          "button",
          {
            type: "button",
            onClick: (e) => {
              e.stopPropagation();
              setLoveProtectAlert(false);
            },
            className: "text-pink-300 hover:text-white mt-0.5 shrink-0"
          },
          /* @__PURE__ */ React.createElement(X, { size: 15 })
        )
      )
    )),
    /* @__PURE__ */ React.createElement(AnimatePresence, null, chatMsgAction && (() => {
      const { msg: am, x, y } = chatMsgAction;
      const isMine = am.sender_id === userId;
      const QUICK_EMOJIS = ["\xE2\x9D\xA4\xEF\xB8\x8F", "\xF0\u0178\u2018\x8D", "\xF0\u0178\u02DC\u201A", "\xF0\u0178\u201D\xA5", "\xF0\u0178\u02DC\xAE"];
      const menuW = 220;
      const reactionH = 54;
      const rowH = 46;
      const rowCount = isMine ? 3 : 2;
      const menuH = reactionH + rowCount * rowH;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const left = Math.min(
        Math.max(x - menuW / 2, 8),
        vw - menuW - 8
      );
      const showAbove = y + menuH + 20 > vh;
      const top = showAbove ? Math.max(y - menuH - 14, 8) : y + 14;
      return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
        "div",
        {
          className: "fixed inset-0 z-[700] bg-black/20 backdrop-blur-[1px]",
          onPointerDown: () => setChatMsgAction(null)
        }
      ), /* @__PURE__ */ React.createElement(
        motion.div,
        {
          key: "chat-msg-action-float",
          initial: { opacity: 0, scale: 0.82 },
          animate: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 0.82 },
          transition: {
            type: "spring",
            damping: 20,
            stiffness: 420
          },
          className: "fixed z-[701] bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100",
          style: {
            top,
            left,
            width: menuW,
            transformOrigin: showAbove ? "bottom center" : "top center"
          },
          onPointerDown: (e) => e.stopPropagation()
        },
        /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-around px-3 py-3 bg-gray-50 border-b border-gray-100" }, QUICK_EMOJIS.map((emoji) => /* @__PURE__ */ React.createElement(
          motion.button,
          {
            key: emoji,
            whileTap: { scale: 0.8 },
            whileHover: { scale: 1.3 },
            onClick: () => {
              handleMsgReact(am.id, emoji);
              setChatMsgAction(null);
            },
            className: "text-[24px] leading-none"
          },
          emoji
        ))),
        /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => {
              setReplyTo(am);
              setChatMsgAction(null);
            },
            className: "w-full flex items-center gap-3 px-4 py-[13px] text-left text-[14px] font-semibold text-gray-800 active:bg-gray-100 transition-colors"
          },
          /* @__PURE__ */ React.createElement(
            "svg",
            {
              width: "15",
              height: "15",
              viewBox: "0 0 24 24",
              fill: "none",
              stroke: "currentColor",
              strokeWidth: "2.5",
              className: "text-gray-500"
            },
            /* @__PURE__ */ React.createElement("polyline", { points: "9 17 4 12 9 7" }),
            /* @__PURE__ */ React.createElement("path", { d: "M20 18v-2a4 4 0 0 0-4-4H4" })
          ),
          "Reply"
        ),
        isMine && !am.media_url && /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => {
              setEditingMsg({ id: am.id, text: am.content });
              setChatMsgAction(null);
            },
            className: "w-full flex items-center gap-3 px-4 py-[13px] text-left text-[14px] font-semibold text-blue-600 active:bg-blue-50 transition-colors border-t border-gray-50"
          },
          /* @__PURE__ */ React.createElement(Pencil, { size: 15, className: "text-blue-500" }),
          "Edit"
        ),
        /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => {
              deleteForMe(am.id);
              setChatMsgAction(null);
            },
            className: "w-full flex items-center gap-3 px-4 py-[13px] text-left text-[14px] font-semibold text-gray-600 active:bg-gray-100 transition-colors border-t border-gray-50"
          },
          /* @__PURE__ */ React.createElement(EyeOff, { size: 15, className: "text-gray-400" }),
          "Delete for Me"
        ),
        isMine && /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => deleteMessageAt(am, x, y),
            className: "w-full flex items-center gap-3 px-4 py-[13px] text-left text-[14px] font-semibold text-red-600 active:bg-red-50 transition-colors border-t border-gray-50"
          },
          /* @__PURE__ */ React.createElement(Trash2, { size: 15, className: "text-red-500" }),
          "Delete for Everyone"
        )
      ));
    })()),
    /* @__PURE__ */ React.createElement(AnimatePresence, null, storyViewerOpen && storyGroups.length > 0 && (() => {
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
      return /* @__PURE__ */ React.createElement(
        motion.div,
        {
          key: "sv",
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          className: "fixed inset-0 z-[400] bg-black flex flex-col touch-none",
          onPointerDown: () => setStoryPaused(true),
          onPointerUp: () => setStoryPaused(false),
          onPointerLeave: () => setStoryPaused(false)
        },
        /* @__PURE__ */ React.createElement(
          StoryProgressBar,
          {
            total: totalInGroup,
            current: viewerStoryIdx,
            elapsed: storyElapsed,
            duration: 15
          }
        ),
        /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2.5 px-3 py-2 z-20" }, aUrl ? /* @__PURE__ */ React.createElement(
          "img",
          {
            src: aUrl,
            className: "w-9 h-9 rounded-full object-cover border-2 border-white/60",
            decoding: "async",
            crossOrigin: "anonymous"
          }
        ) : /* @__PURE__ */ React.createElement(
          "div",
          {
            className: "w-9 h-9 rounded-full border-2 border-white/60 flex items-center justify-center text-white font-black text-sm shrink-0",
            style: { background: _sgradFor(group.user_id) }
          },
          pName[0]
        ), /* @__PURE__ */ React.createElement("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ React.createElement("p", { className: "text-white font-bold text-[13px] leading-none truncate" }, pName), /* @__PURE__ */ React.createElement("p", { className: "text-white/60 text-[10px] mt-0.5" }, viewerStoryIdx + 1, "/", totalInGroup, " \xC2\xB7", " ", Math.max(0, Math.ceil(15 - storyElapsed)), "s")), story.music_url && /* @__PURE__ */ React.createElement(Music, { size: 14, className: "text-white/60 shrink-0" }), story.user_id === userId && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: (e) => {
              e.stopPropagation();
              setViewerEditCaption(story.caption || "");
              setViewerEditMood(story.mood || "");
              setViewerEditing((v) => !v);
              setStoryPaused(true);
            },
            className: "w-9 h-9 rounded-full bg-black/40 flex items-center justify-center border border-white/20"
          },
          /* @__PURE__ */ React.createElement(Pencil, { size: 15, className: "text-white" })
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: (e) => {
              e.stopPropagation();
              deleteViewerStory();
            },
            className: "w-9 h-9 rounded-full bg-red-500/30 flex items-center justify-center border border-red-400/40"
          },
          /* @__PURE__ */ React.createElement(Trash2, { size: 15, className: "text-red-300" })
        )), /* @__PURE__ */ React.createElement(
          "button",
          {
            onPointerDown: (e) => e.stopPropagation(),
            onPointerUp: (e) => e.stopPropagation(),
            onClick: () => {
              setStoryViewerOpen(false);
              setViewingStory(null);
              setViewerEditing(false);
            },
            className: "w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center border border-white/30"
          },
          /* @__PURE__ */ React.createElement(X, { size: 20, className: "text-white" })
        )),
        viewerEditing && story.user_id === userId && /* @__PURE__ */ React.createElement(
          motion.div,
          {
            initial: { opacity: 0, y: -8 },
            animate: { opacity: 1, y: 0 },
            exit: { opacity: 0, y: -8 },
            className: "mx-3 mb-2 rounded-2xl overflow-hidden z-40 relative",
            style: {
              background: "rgba(0,0,0,0.75)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,0.12)"
            },
            onPointerDown: (e) => e.stopPropagation(),
            onPointerUp: (e) => e.stopPropagation()
          },
          /* @__PURE__ */ React.createElement("div", { className: "p-3 flex flex-col gap-2" }, /* @__PURE__ */ React.createElement(
            "input",
            {
              value: viewerEditCaption,
              onChange: (e) => setViewerEditCaption(e.target.value),
              placeholder: "Edit caption\xE2\u20AC\xA6",
              className: "w-full rounded-xl px-3 py-2 text-sm text-white bg-white/10 border border-white/15 outline-none font-medium"
            }
          ), /* @__PURE__ */ React.createElement("div", { className: "flex gap-1.5 flex-wrap" }, [
            { k: "", l: "None" },
            { k: "happy", l: "\xF0\u0178\u02DC\u0160" },
            { k: "sad", l: "\xF0\u0178\u02DC\xA2" },
            { k: "love", l: "\xE2\x9D\xA4\xEF\xB8\x8F" },
            { k: "angry", l: "\xF0\u0178\u02DC\xA1" },
            { k: "party", l: "\xF0\u0178\u017D\u2030" },
            { k: "chill", l: "\xF0\u0178\u02DC\u0152" }
          ].map((m) => /* @__PURE__ */ React.createElement(
            "button",
            {
              key: m.k,
              onClick: () => setViewerEditMood(m.k),
              className: `px-2.5 py-1 rounded-full text-xs font-bold border transition-all ${viewerEditMood === m.k ? "bg-white/25 text-white border-white/50" : "bg-white/8 text-white/50 border-white/15"}`
            },
            m.l
          ))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(
            "button",
            {
              onClick: () => {
                setViewerEditing(false);
                setStoryPaused(false);
              },
              className: "flex-1 py-1.5 rounded-xl text-xs text-white/50 bg-white/5 border border-white/10"
            },
            "Cancel"
          ), /* @__PURE__ */ React.createElement(
            "button",
            {
              onClick: () => {
                saveViewerEdit();
                setStoryPaused(false);
              },
              className: "flex-1 py-1.5 rounded-xl text-xs text-white font-black",
              style: {
                background: "linear-gradient(135deg,#f43f5e,#ef4444)"
              }
            },
            "Save"
          )))
        ),
        /* @__PURE__ */ React.createElement("div", { className: "flex-1 relative overflow-hidden" }, /* @__PURE__ */ React.createElement(AnimatePresence, { mode: "wait" }, /* @__PURE__ */ React.createElement(
          motion.div,
          {
            key: story.id,
            initial: { opacity: 0, scale: 1.04 },
            animate: { opacity: 1, scale: 1 },
            exit: { opacity: 0, scale: 0.96 },
            transition: { duration: 0.22 },
            className: "absolute inset-0"
          },
          isVoice ? /* @__PURE__ */ React.createElement(
            "div",
            {
              className: "w-full h-full flex flex-col items-center justify-center gap-6",
              style: {
                background: `linear-gradient(160deg,${_sgradFor(group.user_id)},#0f172a)`
              }
            },
            /* @__PURE__ */ React.createElement(
              motion.div,
              {
                className: "w-28 h-28 rounded-full border-4 border-white/40 overflow-hidden shadow-2xl",
                animate: {
                  scale: [1, 1.07, 1],
                  boxShadow: [
                    "0 0 0 0 rgba(255,255,255,0.2)",
                    "0 0 0 18px rgba(255,255,255,0)",
                    "0 0 0 0 rgba(255,255,255,0)"
                  ]
                },
                transition: { duration: 1.4, repeat: Infinity }
              },
              aUrl ? /* @__PURE__ */ React.createElement(
                "img",
                {
                  src: aUrl,
                  className: "w-full h-full object-cover",
                  decoding: "async",
                  crossOrigin: "anonymous"
                }
              ) : /* @__PURE__ */ React.createElement(
                "div",
                {
                  className: "w-full h-full flex items-center justify-center text-white font-black text-4xl",
                  style: {
                    background: _sgradFor(group.user_id)
                  }
                },
                pName[0]
              )
            ),
            /* @__PURE__ */ React.createElement(StoryAudioWave, null),
            story.caption && /* @__PURE__ */ React.createElement("p", { className: "text-white/80 text-sm font-medium px-6 text-center" }, story.caption),
            /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement(Mic, { size: 14, className: "text-white/50" }), /* @__PURE__ */ React.createElement("span", { className: "text-white/50 text-[11px]" }, "Voice Story"))
          ) : story.media_type === "video" ? story.mood === "grid" ? /* @__PURE__ */ React.createElement("div", { className: "relative w-full h-full" }, /* @__PURE__ */ React.createElement(
            "video",
            {
              ref: storyVideoRef,
              src: getStoryMediaUrl(story.image_url),
              className: "w-full h-full object-cover",
              autoPlay: true,
              muted: true,
              playsInline: true,
              preload: "metadata",
              loop: true,
              onError: onStoryMediaError
            }
          ), /* @__PURE__ */ React.createElement("div", { className: "absolute inset-0 pointer-events-none grid grid-cols-2 grid-rows-2" }, [0, 1, 2, 3].map((j) => /* @__PURE__ */ React.createElement("div", { key: j, className: "border border-white/10" })))) : /* @__PURE__ */ React.createElement(
            "video",
            {
              ref: storyVideoRef,
              src: getStoryMediaUrl(story.image_url),
              className: "w-full h-full object-cover",
              autoPlay: true,
              muted: true,
              playsInline: true,
              preload: "metadata",
              loop: true,
              style: { filter: moodFilter },
              onError: onStoryMediaError
            }
          ) : story.mood === "grid" ? /* @__PURE__ */ React.createElement("div", { className: "w-full h-full grid grid-cols-2 grid-rows-2" }, [0, 1, 2, 3].map((j) => /* @__PURE__ */ React.createElement(
            "img",
            {
              key: j,
              src: getStoryMediaUrl(story.image_url),
              className: "w-full h-full object-cover",
              style: {
                transform: j % 2 === 1 ? "scaleX(-1)" : void 0
              },
              draggable: false,
              decoding: "async",
              crossOrigin: "anonymous",
              onError: onStoryMediaError
            }
          ))) : /* @__PURE__ */ React.createElement("div", { className: "w-full h-full relative" }, /* @__PURE__ */ React.createElement(
            "img",
            {
              src: getStoryMediaUrl(story.image_url),
              className: "w-full h-full object-cover",
              style: { filter: moodFilter },
              draggable: false,
              crossOrigin: "anonymous",
              decoding: "async",
              onError: onStoryMediaError
            }
          ), isSad && /* @__PURE__ */ React.createElement(StoryRainOverlay, null), isParty && /* @__PURE__ */ React.createElement(StoryNeonOverlay, null)),
          story.is_help_request && /* @__PURE__ */ React.createElement(StoryHelpSticker, null),
          (story.caption || story.emoji) && /* @__PURE__ */ React.createElement("div", { className: "absolute bottom-16 left-4 right-4 z-20" }, /* @__PURE__ */ React.createElement("div", { className: "bg-black/40 backdrop-blur-md rounded-2xl px-4 py-3 inline-block max-w-full" }, story.emoji && /* @__PURE__ */ React.createElement("span", { className: "text-2xl mr-2" }, story.emoji), story.caption && /* @__PURE__ */ React.createElement("span", { className: "text-white text-sm font-medium leading-snug" }, story.caption))),
          /* @__PURE__ */ React.createElement("div", { className: "absolute bottom-4 left-4 z-20 flex gap-2" }, /* @__PURE__ */ React.createElement(
            "button",
            {
              onPointerDown: (e) => e.stopPropagation(),
              onPointerUp: (e) => e.stopPropagation(),
              onClick: (e) => {
                e.stopPropagation();
                const url = getStoryMediaUrl(story.image_url);
                requestShareModal(
                  {
                    id: `story-${story.id}`,
                    title: "Flicks Story",
                    content: story.caption || "Watch this story on Flicks India.",
                    media_url: url,
                    type: "story",
                    author: story.profile?.full_name || "Flicks India",
                    share_url: `${window.location.origin}/?story=${encodeURIComponent(story.id)}`
                  },
                  e.currentTarget
                );
              },
              className: "w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/20"
            },
            /* @__PURE__ */ React.createElement(Share2, { size: 15, className: "text-white" })
          ), /* @__PURE__ */ React.createElement(
            "button",
            {
              onPointerDown: (e) => e.stopPropagation(),
              onPointerUp: (e) => e.stopPropagation(),
              onClick: (e) => {
                e.stopPropagation();
                const a = document.createElement("a");
                a.href = getStoryMediaUrl(story.image_url);
                a.download = `flicks-story`;
                a.target = "_blank";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              },
              className: "w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/20"
            },
            /* @__PURE__ */ React.createElement(Download, { size: 15, className: "text-white" })
          )),
          story.user_id === userId && /* @__PURE__ */ React.createElement(StoryViewCount, { storyId: story.id })
        )), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "absolute left-0 top-0 w-1/3 h-full z-30",
            onClick: (e) => {
              e.stopPropagation();
              setStoryElapsed(0);
              if (viewerStoryIdx > 0)
                setViewerStoryIdx((i) => i - 1);
              else if (viewerGroupIdx > 0) {
                setViewerGroupIdx((g) => g - 1);
                setViewerStoryIdx(
                  storyGroups[viewerGroupIdx - 1].stories.length - 1
                );
              }
            },
            onPointerDown: (e) => e.stopPropagation(),
            onPointerUp: (e) => e.stopPropagation()
          }
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "absolute right-0 top-0 w-1/3 h-full z-30",
            onClick: (e) => {
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
            },
            onPointerDown: (e) => e.stopPropagation(),
            onPointerUp: (e) => e.stopPropagation()
          }
        ), (viewerStoryIdx > 0 || viewerGroupIdx > 0) && /* @__PURE__ */ React.createElement("div", { className: "absolute left-2 top-1/2 -translate-y-1/2 z-30 pointer-events-none" }, /* @__PURE__ */ React.createElement(ChevronLeft, { size: 26, className: "text-white/50" })), (viewerStoryIdx + 1 < totalInGroup || viewerGroupIdx + 1 < storyGroups.length) && /* @__PURE__ */ React.createElement("div", { className: "absolute right-2 top-1/2 -translate-y-1/2 z-30 pointer-events-none" }, /* @__PURE__ */ React.createElement(ChevronRight, { size: 26, className: "text-white/50" })))
      );
    })()),
    /* @__PURE__ */ React.createElement(AnimatePresence, null, showStoryEditor && (storyPreviewUrl || storyPreviews.length > 0) && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
      motion.div,
      {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        className: "fixed inset-0 z-[280] bg-black/70 backdrop-blur-sm",
        onClick: () => {
          clearStoryPreviews();
          setShowStoryEditor(false);
        }
      }
    ), /* @__PURE__ */ React.createElement(
      motion.div,
      {
        initial: { y: "100%", opacity: 0 },
        animate: { y: 0, opacity: 1 },
        exit: { y: "100%", opacity: 0 },
        transition: { type: "spring", stiffness: 300, damping: 28 },
        className: "fixed bottom-0 left-0 right-0 z-[290] rounded-t-3xl overflow-hidden max-h-[90vh] overflow-y-auto",
        style: {
          background: "rgba(15,5,30,0.97)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.1)"
        }
      },
      /* @__PURE__ */ React.createElement("div", { className: "p-5" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between mb-4" }, /* @__PURE__ */ React.createElement("p", { className: "text-white font-black text-base" }, storyFiles.length > 1 ? `Post ${storyFiles.length} Stories \xE2\u0153\xA8` : "Create Story \xE2\u0153\xA8"), /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: () => {
            clearStoryPreviews();
            setShowStoryEditor(false);
          },
          className: "w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60"
        },
        /* @__PURE__ */ React.createElement(X, { size: 14 })
      )), storyPreviews.length > 1 ? /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 overflow-x-auto pb-2 no-scrollbar mb-4" }, storyPreviews.map((url, i) => /* @__PURE__ */ React.createElement(
        "div",
        {
          key: i,
          className: "flex-shrink-0 w-20 h-28 rounded-xl overflow-hidden bg-white/10 relative"
        },
        storyFiles[i]?.type.startsWith("audio/") ? /* @__PURE__ */ React.createElement(
          "div",
          {
            className: "w-full h-full flex items-center justify-center",
            style: {
              background: "linear-gradient(135deg,#6366f1,#ec4899)"
            }
          },
          /* @__PURE__ */ React.createElement(Mic, { size: 20, className: "text-white" })
        ) : storyFiles[i]?.type.startsWith("video/") ? /* @__PURE__ */ React.createElement("div", { className: "w-full h-full relative" }, /* @__PURE__ */ React.createElement(
          "video",
          {
            src: url,
            className: "w-full h-full object-cover",
            muted: true,
            playsInline: true,
            webkitPlaysInline: true,
            crossOrigin: "anonymous",
            preload: "auto"
          },
          url && /* @__PURE__ */ React.createElement("source", { src: url, type: "video/mp4" })
        ), /* @__PURE__ */ React.createElement("div", { className: "absolute inset-0 flex items-center justify-center bg-black/30" }, /* @__PURE__ */ React.createElement(
          VideoIcon,
          {
            size: 18,
            className: "text-white"
          }
        ))) : /* @__PURE__ */ React.createElement(
          "img",
          {
            src: url,
            className: "w-full h-full object-cover",
            decoding: "async",
            crossOrigin: "anonymous"
          }
        ),
        /* @__PURE__ */ React.createElement("div", { className: "absolute bottom-1 right-1 bg-black/50 rounded-full px-1.5 py-0.5" }, /* @__PURE__ */ React.createElement("span", { className: "text-white text-[9px] font-bold" }, i + 1))
      ))) : /* @__PURE__ */ React.createElement("div", { className: "relative w-full h-52 rounded-2xl overflow-hidden mb-4" }, storyMood === "grid" ? /* @__PURE__ */ React.createElement("div", { className: "w-full h-full grid grid-cols-2 grid-rows-2" }, [0, 1, 2, 3].map(
        (j) => storyFile?.type.startsWith("video/") ? /* @__PURE__ */ React.createElement("div", { className: "relative w-full h-full" }, /* @__PURE__ */ React.createElement(
          "video",
          {
            src: storyPreviewUrl,
            className: "w-full h-full object-cover",
            muted: true,
            playsInline: true,
            webkitPlaysInline: true,
            crossOrigin: "anonymous",
            preload: "auto",
            loop: true,
            autoPlay: true
          },
          storyPreviewUrl && /* @__PURE__ */ React.createElement("source", { src: storyPreviewUrl, type: "video/mp4" })
        ), /* @__PURE__ */ React.createElement("div", { className: "absolute inset-0 pointer-events-none grid grid-cols-2 grid-rows-2" }, [0, 1, 2, 3].map((k) => /* @__PURE__ */ React.createElement("div", { key: k, className: "border border-white/10" })))) : /* @__PURE__ */ React.createElement(
          "img",
          {
            key: j,
            src: storyPreviewUrl,
            className: "w-full h-full object-cover",
            style: {
              transform: j % 2 === 1 ? "scaleX(-1)" : void 0
            },
            decoding: "async"
          }
        )
      )) : storyFile?.type.startsWith("video/") ? /* @__PURE__ */ React.createElement(
        "video",
        {
          src: storyPreviewUrl,
          className: "w-full h-full object-cover",
          style: {
            filter: STORY_MOOD_FILTER[storyMood] || ""
          },
          muted: true,
          playsInline: true,
          preload: "metadata",
          loop: true,
          autoPlay: true
        }
      ) : /* @__PURE__ */ React.createElement(
        "img",
        {
          src: storyPreviewUrl,
          className: "w-full h-full object-cover",
          style: {
            filter: STORY_MOOD_FILTER[storyMood] || ""
          },
          decoding: "async"
        }
      ), storyMood === "sad" && /* @__PURE__ */ React.createElement(StoryRainOverlay, null), storyMood === "party" && /* @__PURE__ */ React.createElement(StoryNeonOverlay, null), storyIsHelp && /* @__PURE__ */ React.createElement(StoryHelpSticker, null), (storyCaption || storyEmoji) && /* @__PURE__ */ React.createElement("div", { className: "absolute bottom-3 left-0 right-0 text-center px-4" }, /* @__PURE__ */ React.createElement("span", { className: "text-white font-black text-base bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm" }, storyEmoji, " ", storyCaption))), /* @__PURE__ */ React.createElement(
        "input",
        {
          value: storyCaption,
          onChange: (e) => setStoryCaption(e.target.value),
          placeholder: "Add a caption...",
          className: "w-full rounded-2xl px-4 py-3 text-base font-bold text-white outline-none border border-white/10 mb-3",
          style: { background: "rgba(255,255,255,0.08)" }
        }
      ), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 mb-3 flex-wrap" }, ["\xF0\u0178\u0152\xB9", "\xE2\x9D\xA4\xEF\xB8\x8F", "\xF0\u0178\u201D\xA5", "\xE2\u0153\xA8", "\xF0\u0178\u02DC\x8D", "\xF0\u0178\u2019\xAB", "\xF0\u0178\u017D\u2030", "\xF0\u0178\u2019\u2022"].map(
        (em) => /* @__PURE__ */ React.createElement(
          "button",
          {
            key: em,
            onClick: () => setStoryEmoji(storyEmoji === em ? "" : em),
            className: `w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${storyEmoji === em ? "bg-white/25 scale-110" : "bg-white/8 hover:bg-white/15"}`
          },
          em
        )
      )), storyFiles.some((f) => f.type.startsWith("video/")) && /* @__PURE__ */ React.createElement(
        "button",
        {
          type: "button",
          onClick: () => setMuteStoryVideo((v) => !v),
          className: `w-full py-2.5 rounded-2xl text-sm font-black border-2 mb-3 transition-all flex items-center justify-center gap-2 ${muteStoryVideo ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/50" : "bg-white/5 text-white/50 border-white/10"}`
        },
        muteStoryVideo ? "\xF0\u0178\u201D\u2021 Video Muted (Music Plays Over)" : "\xF0\u0178\u201D\u0160 Mute Video (Play Music Over It)"
      ), /* @__PURE__ */ React.createElement("p", { className: "text-[10px] font-black text-white/40 uppercase tracking-widest mb-1.5" }, "Filter"), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-3" }, [
        { k: "", l: "\xE2\u0153\xA8 None" },
        { k: "happy", l: "\xF0\u0178\u02DC\u0160 Happy" },
        { k: "sad", l: "\xF0\u0178\u02DC\xA2 Sad" },
        { k: "love", l: "\xE2\x9D\xA4\xEF\xB8\x8F Love" },
        { k: "angry", l: "\xF0\u0178\u02DC\xA1 Angry" },
        { k: "party", l: "\xF0\u0178\u017D\u2030 Party" },
        { k: "chill", l: "\xF0\u0178\u02DC\u0152 Chill" },
        { k: "vibrant-gold", l: "\xF0\u0178\u0152\u0178 Gold" },
        { k: "cyberpunk", l: "\xE2\u0161\xA1 Cyber" },
        { k: "noir", l: "\xF0\u0178\u017D\u017E Noir" },
        { k: "grid", l: "\xE2\u2013\xA6 Grid" }
      ].map((m) => /* @__PURE__ */ React.createElement(
        "button",
        {
          key: m.k,
          onClick: () => setStoryMood(m.k),
          className: `flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${storyMood === m.k ? "bg-white/20 text-white border-white/40" : "bg-white/5 text-white/50 border-white/10"}`
        },
        m.l
      ))), /* @__PURE__ */ React.createElement("p", { className: "text-[10px] font-black text-white/40 uppercase tracking-widest mb-1.5" }, "Background Music"), /* @__PURE__ */ React.createElement(
        "input",
        {
          ref: musicInputRef,
          type: "file",
          accept: "audio/*",
          id: "music-upload",
          className: "hidden",
          onChange: (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setSelectedMusic(f);
            setSelectedMusicName(f.name);
            e.target.value = "";
          }
        }
      ), /* @__PURE__ */ React.createElement(
        "button",
        {
          type: "button",
          onClick: () => musicInputRef.current?.click(),
          className: `w-full py-2.5 rounded-2xl text-sm font-black border-2 mb-3 transition-all flex items-center justify-center gap-2 ${selectedMusic ? "bg-purple-500/20 text-purple-300 border-purple-500/50" : "bg-white/5 text-white/50 border-white/10"}`
        },
        /* @__PURE__ */ React.createElement(Music, { size: 15 }),
        selectedMusic ? `\xF0\u0178\u017D\xB5 ${selectedMusicName.slice(0, 28)}${selectedMusicName.length > 28 ? "\xE2\u20AC\xA6" : ""}` : "\xF0\u0178\u017D\xB5 Add Background Music"
      ), selectedMusic && /* @__PURE__ */ React.createElement(
        "button",
        {
          type: "button",
          onClick: () => {
            setSelectedMusic(null);
            setSelectedMusicName("");
          },
          className: "w-full py-1.5 rounded-xl text-xs text-red-400/70 mb-3"
        },
        "\xE2\u0153\u2022 Remove music"
      ), /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: () => setStoryIsHelp((v) => !v),
          className: `w-full py-2.5 rounded-2xl text-sm font-black border-2 mb-4 transition-all ${storyIsHelp ? "bg-orange-500/20 text-orange-300 border-orange-500/50" : "bg-white/5 text-white/40 border-white/10"}`
        },
        "\xF0\u0178\u2020\u02DC",
        " ",
        storyIsHelp ? "Madad Request ON" : "Mark as Madad Request"
      ), uploadingStory && /* @__PURE__ */ React.createElement("div", { className: "mb-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between mb-1" }, /* @__PURE__ */ React.createElement("span", { className: "text-xs text-white/60 font-bold" }, "Uploading\xE2\u20AC\xA6"), /* @__PURE__ */ React.createElement("span", { className: "text-xs text-white/40" }, storyUploadProgress, "%")), /* @__PURE__ */ React.createElement("div", { className: "w-full h-1.5 rounded-full bg-white/10 overflow-hidden" }, /* @__PURE__ */ React.createElement(
        motion.div,
        {
          className: "h-full rounded-full",
          style: {
            background: "linear-gradient(90deg,#f43f5e,#ef4444)",
            width: `${storyUploadProgress}%`
          },
          transition: { duration: 0.3 }
        }
      ))), /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: uploadStory,
          disabled: uploadingStory,
          className: "w-full py-3.5 rounded-2xl text-white font-black text-base flex items-center justify-center gap-2 disabled:opacity-60 transition-all",
          style: {
            background: "linear-gradient(135deg,#f43f5e,#ef4444)"
          }
        },
        uploadingStory ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Loader2, { size: 16, className: "animate-spin" }), " ", "Posting", " ", storyFiles.length > 1 ? `${storyFiles.length} Stories` : "", "...") : `Post ${storyFiles.length > 1 ? storyFiles.length + " Stories" : "Story"} \xF0\u0178\u0152\xB9`
      ))
    ))),
    /* @__PURE__ */ React.createElement("div", { className: "relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden" }, bottomTab === "chat" && !selectedUser && /* @__PURE__ */ React.createElement("div", { className: `flex min-h-0 flex-1 flex-col overflow-hidden` }, /* @__PURE__ */ React.createElement(
      "div",
      {
        className: `flex items-center gap-2 px-4 py-3 border-b ${T.divider} shrink-0`
      },
      /* @__PURE__ */ React.createElement("div", { className: "min-w-0 shrink-0" }, /* @__PURE__ */ React.createElement(
        "p",
        {
          className: `text-lg font-black tracking-tight ${T.text1}`
        },
        "Messages"
      ), /* @__PURE__ */ React.createElement("p", { className: `text-[10px] font-semibold ${T.text3}` }, visibleContacts.length, " conversations")),
      /* @__PURE__ */ React.createElement("div", { className: "relative min-w-0 flex-1" }, /* @__PURE__ */ React.createElement(
        Search,
        {
          size: 13,
          className: `absolute left-2.5 top-1/2 -translate-y-1/2 ${T.text3}`
        }
      ), /* @__PURE__ */ React.createElement(
        "input",
        {
          type: "text",
          "aria-label": "Search friends or messages",
          placeholder: "Search friends or messages...",
          value: searchQuery,
          onChange: (e) => setSearchQuery(e.target.value),
          className: `h-9 w-full rounded-xl pl-8 pr-8 text-xs font-semibold outline-none border ${T.searchBg}`
        }
      ), searchQuery && /* @__PURE__ */ React.createElement(
        "button",
        {
          type: "button",
          "aria-label": "Clear search",
          onClick: () => setSearchQuery(""),
          className: `absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full ${panelBg} flex items-center justify-center ${T.text3}`
        },
        /* @__PURE__ */ React.createElement(X, { size: 11 })
      )),
      /* @__PURE__ */ React.createElement(
        "button",
        {
          type: "button",
          onClick: onClose,
          "aria-label": "Close messages",
          className: `w-8 h-8 rounded-xl ${panelBg} border ${T.divider} flex items-center justify-center ${T.text3} shrink-0`
        },
        /* @__PURE__ */ React.createElement(X, { size: 15 })
      )
    ), /* @__PURE__ */ React.createElement("div", { className: "chat-scroll-pane flex min-h-0 flex-1 flex-col overflow-y-auto" }, searchQuery.trim() ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
      "p",
      {
        className: `text-[10px] font-black uppercase tracking-widest px-5 pt-3 pb-1 ${T.text3}`
      },
      "Search Results"
    ), isSearching ? /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-center py-8" }, /* @__PURE__ */ React.createElement(
      Loader2,
      {
        size: 18,
        className: `animate-spin ${T.text3}`
      }
    )) : searchResults.length === 0 ? /* @__PURE__ */ React.createElement("p", { className: `text-xs px-5 py-3 ${T.text3}` }, "No users found") : searchResults.map((user) => /* @__PURE__ */ React.createElement(
      "div",
      {
        key: user.id,
        className: "flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
      },
      /* @__PURE__ */ React.createElement(
        Avatar,
        {
          url: user.avatar_url,
          name: user.full_name
        }
      ),
      /* @__PURE__ */ React.createElement("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ React.createElement(
        "p",
        {
          className: `text-sm font-black truncate ${T.text1}`
        },
        user.full_name
      ), /* @__PURE__ */ React.createElement("p", { className: `text-[10px] ${T.text3}` }, "@", user.username)),
      /* @__PURE__ */ React.createElement(FriendActionBtn, { user })
    ))) : /* @__PURE__ */ React.createElement(React.Fragment, null, loadingContacts ? /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-center py-10" }, /* @__PURE__ */ React.createElement(
      Loader2,
      {
        size: 20,
        className: `animate-spin ${T.text3}`
      }
    )) : visibleContacts.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "flex flex-col items-center justify-center py-16 gap-3 px-6 text-center" }, /* @__PURE__ */ React.createElement(
      "div",
      {
        className: `w-16 h-16 rounded-3xl ${panelBg} border ${T.divider} flex items-center justify-center`
      },
      /* @__PURE__ */ React.createElement(MessageSquare, { size: 28, className: T.text3 })
    ), /* @__PURE__ */ React.createElement("p", { className: `text-base font-black ${T.text3}` }, "No chats yet"), /* @__PURE__ */ React.createElement("p", { className: `text-xs ${T.text3}` }, "Add friends and start chatting")) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
      "p",
      {
        className: `text-[10px] font-black uppercase tracking-widest px-5 pt-3 pb-1 ${T.text3}`
      },
      "Recent Chats"
    ), visibleContacts.map((c) => /* @__PURE__ */ React.createElement("div", { key: c.id }, /* @__PURE__ */ React.createElement(
      motion.div,
      {
        initial: { opacity: 0, x: -8 },
        animate: { opacity: 1, x: 0 },
        className: "flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors cursor-pointer relative",
        onClick: () => handleSelectContact(c)
      },
      /* @__PURE__ */ React.createElement(
        Avatar,
        {
          url: c.avatar_url,
          name: c.full_name,
          online: onlineUsers.has(c.id)
        }
      ),
      /* @__PURE__ */ React.createElement("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ React.createElement(
        "p",
        {
          className: `text-sm font-black truncate ${T.text1}`
        },
        c.full_name
      ), /* @__PURE__ */ React.createElement(
        "p",
        {
          className: `text-[10px] font-semibold shrink-0 ml-2 ${(c.unread_count ?? 0) > 0 ? "text-red-400" : T.text3}`
        },
        c.last_message_at ? formatTime(c.last_message_at) : ""
      )), /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-1" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1 min-w-0 flex-1" }, mutedChats.has(c.id) && /* @__PURE__ */ React.createElement(VolumeX, { size: 10, className: T.text3 }), /* @__PURE__ */ React.createElement(
        "p",
        {
          className: `text-xs truncate ${(c.unread_count ?? 0) > 0 ? `font-semibold ${T.text1}` : T.text3}`
        },
        lastMsgPreview(c) || "Start a conversation"
      )), (c.unread_count ?? 0) > 0 && /* @__PURE__ */ React.createElement("span", { className: "shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center leading-none" }, (c.unread_count ?? 0) > 99 ? "99+" : c.unread_count))),
      /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: (e) => {
            e.stopPropagation();
            setMsgMenuId(
              msgMenuId === `contact-${c.id}` ? null : `contact-${c.id}`
            );
          },
          className: `w-7 h-7 rounded-lg flex items-center justify-center ${T.text3} hover:bg-white/10 shrink-0`
        },
        /* @__PURE__ */ React.createElement(MoreVertical, { size: 14 })
      ),
      /* @__PURE__ */ React.createElement(AnimatePresence, null, msgMenuId === `contact-${c.id}` && /* @__PURE__ */ React.createElement(
        motion.div,
        {
          initial: { opacity: 0, scale: 0.9 },
          animate: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 0.9 },
          className: `absolute right-10 top-1/2 -translate-y-1/2 z-50 rounded-2xl border shadow-xl overflow-hidden min-w-[140px] ${T.msgMenuBg}`,
          onClick: (e) => e.stopPropagation()
        },
        /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => {
              toggleMute(c.id);
              setMsgMenuId(null);
            },
            className: `flex items-center gap-2 w-full px-4 py-3 text-sm font-bold hover:bg-white/5 ${T.text1}`
          },
          mutedChats.has(c.id) ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Volume2, { size: 14 }), " Unmute") : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(VolumeX, { size: 14 }), " Mute")
        ),
        /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => {
              toggleArchive(c.id);
              setMsgMenuId(null);
            },
            className: `flex items-center gap-2 w-full px-4 py-3 text-sm font-bold hover:bg-white/5 ${T.text1}`
          },
          /* @__PURE__ */ React.createElement(EyeOff, { size: 14 }),
          " Hide Chat"
        ),
        /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: async () => {
              const fs = friendshipMap.get(c.id);
              if (!fs) return;
              await supabase.from("friendships").delete().eq("id", fs.id);
              await Promise.all([
                fetchFriendships(),
                fetchContacts()
              ]);
              setMsgMenuId(null);
              toast.success("Friend removed.");
            },
            className: "flex items-center gap-2 w-full px-4 py-3 text-sm font-bold text-red-400 hover:bg-red-500/10"
          },
          /* @__PURE__ */ React.createElement(UserX, { size: 14 }),
          " Unfriend"
        )
      ))
    ))))))), bottomTab === "chat" && selectedUser && /* @__PURE__ */ React.createElement("div", { className: `relative flex min-h-0 flex-1 flex-col overflow-hidden` }, /* @__PURE__ */ React.createElement(
      "audio",
      {
        ref: chatMusicAudioRef,
        hidden: true,
        preload: "auto",
        onLoadedMetadata: syncPendingChatMusic,
        onDurationChange: (event) => setChatMusicDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0),
        onTimeUpdate: (event) => setChatMusicTime(event.currentTarget.currentTime),
        onEnded: () => {
          setChatMusicPlaying(false);
          publishChatMusicState(false);
        }
      }
    ), theme === "maroon" && /* @__PURE__ */ React.createElement("div", { className: "absolute inset-0 pointer-events-none overflow-hidden", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("div", { className: "absolute inset-0", style: { backgroundImage: "radial-gradient(circle,rgba(255,255,255,0.04) 1px,transparent 1px)", backgroundSize: "18px 18px" } }), /* @__PURE__ */ React.createElement("div", { className: "absolute", style: { top: "6%", right: "10%", width: 130, height: 130, borderRadius: "50%", background: "radial-gradient(circle,rgba(255,255,220,0.10) 0%,transparent 70%)", boxShadow: "0 0 80px 35px rgba(255,255,200,0.04)" } }), /* @__PURE__ */ React.createElement("div", { className: "absolute top-0 left-0 right-0", style: { height: "35%", background: "linear-gradient(to bottom,rgba(43,11,22,0.55),transparent)" } }), /* @__PURE__ */ React.createElement("div", { className: "absolute bottom-0 left-0 right-0", style: { height: "30%", background: "linear-gradient(to top,rgba(43,11,22,0.50),transparent)" } }), /* @__PURE__ */ React.createElement("div", { className: "absolute", style: { bottom: "12%", left: "-6%", width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle,rgba(30,94,255,0.09) 0%,transparent 70%)" } }), /* @__PURE__ */ React.createElement("div", { className: "absolute", style: { top: "18%", right: "-6%", width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle,rgba(227,255,0,0.06) 0%,transparent 70%)" } }), /* @__PURE__ */ React.createElement("svg", { className: "absolute bottom-0 left-0 w-full", viewBox: "0 0 390 70", preserveAspectRatio: "xMidYMax meet", fill: "white", style: { opacity: 0.07 } }, /* @__PURE__ */ React.createElement("path", { d: "M0,70 L0,48 L12,48 L12,38 L22,38 L22,30 L28,30 L28,38 L38,38 L38,48 L50,48 L50,32 L60,32 L60,22 L66,22 L66,16 L72,16 L72,22 L82,22 L82,32 L92,32 L92,42 L104,42 L104,35 L114,35 L114,28 L120,28 L120,35 L130,35 L130,48 L142,48 L142,36 L152,36 L152,24 L158,24 L158,36 L168,36 L168,48 L180,48 L180,38 L192,38 L192,28 L198,28 L198,18 L204,18 L204,28 L210,28 L210,38 L222,38 L222,48 L234,48 L234,40 L244,40 L244,30 L250,30 L250,20 L256,20 L256,30 L262,30 L262,40 L274,40 L274,50 L286,50 L286,42 L296,42 L296,32 L302,32 L302,42 L312,42 L312,50 L324,50 L324,44 L334,44 L334,36 L340,36 L340,26 L346,26 L346,36 L356,36 L356,44 L368,44 L368,50 L380,50 L380,44 L390,44 L390,70 Z" })), /* @__PURE__ */ React.createElement("div", { className: "absolute inset-0", style: { background: "radial-gradient(ellipse at 50% 50%,transparent 42%,rgba(5,5,5,0.45) 100%)" } })), theme === "comic" && /* @__PURE__ */ React.createElement("div", { className: "absolute inset-0 pointer-events-none overflow-hidden", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("div", { className: "absolute", style: { top: "-15%", left: "-10%", width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle,rgba(255,230,50,0.30) 0%,rgba(255,200,30,0.10) 45%,transparent 70%)" } }), /* @__PURE__ */ React.createElement("div", { className: "absolute", style: { top: "-22%", left: "-18%", width: 430, height: 430, borderRadius: "50%", background: "conic-gradient(from 0deg,transparent 0deg,rgba(255,220,30,0.06) 12deg,transparent 24deg,rgba(255,220,30,0.06) 36deg,transparent 48deg,rgba(255,220,30,0.06) 60deg,transparent 72deg,rgba(255,220,30,0.06) 84deg,transparent 96deg,rgba(255,220,30,0.06) 108deg,transparent 120deg,rgba(255,220,30,0.06) 132deg,transparent 144deg,rgba(255,220,30,0.06) 156deg,transparent 168deg,rgba(255,220,30,0.06) 180deg,transparent 192deg,rgba(255,220,30,0.06) 204deg,transparent 216deg,rgba(255,220,30,0.06) 228deg,transparent 240deg,rgba(255,220,30,0.06) 252deg,transparent 264deg,rgba(255,220,30,0.06) 276deg,transparent 288deg,rgba(255,220,30,0.06) 300deg,transparent 312deg,rgba(255,220,30,0.06) 324deg,transparent 336deg,rgba(255,220,30,0.06) 348deg,transparent 360deg)" } }), /* @__PURE__ */ React.createElement("svg", { className: "absolute", style: { top: "8%", right: "12%", opacity: 0.45, width: 110 }, viewBox: "0 0 110 55", fill: "white" }, /* @__PURE__ */ React.createElement("ellipse", { cx: "55", cy: "40", rx: "44", ry: "18" }), /* @__PURE__ */ React.createElement("ellipse", { cx: "38", cy: "30", rx: "24", ry: "20" }), /* @__PURE__ */ React.createElement("ellipse", { cx: "72", cy: "29", rx: "26", ry: "18" }), /* @__PURE__ */ React.createElement("ellipse", { cx: "55", cy: "22", rx: "20", ry: "16" })), /* @__PURE__ */ React.createElement("svg", { className: "absolute", style: { top: "20%", left: "18%", opacity: 0.3, width: 75 }, viewBox: "0 0 75 40", fill: "white" }, /* @__PURE__ */ React.createElement("ellipse", { cx: "37", cy: "28", rx: "30", ry: "14" }), /* @__PURE__ */ React.createElement("ellipse", { cx: "25", cy: "22", rx: "17", ry: "14" }), /* @__PURE__ */ React.createElement("ellipse", { cx: "50", cy: "21", rx: "18", ry: "12" })), /* @__PURE__ */ React.createElement("div", { className: "absolute top-0 left-0 w-36 h-36", style: { backgroundImage: "radial-gradient(circle,rgba(0,102,255,0.13) 1.5px,transparent 1.5px)", backgroundSize: "13px 13px" } }), /* @__PURE__ */ React.createElement("div", { className: "absolute top-0 right-0 w-36 h-36", style: { backgroundImage: "radial-gradient(circle,rgba(0,102,255,0.13) 1.5px,transparent 1.5px)", backgroundSize: "13px 13px" } }), /* @__PURE__ */ React.createElement("div", { className: "absolute bottom-0 left-0 w-36 h-36", style: { backgroundImage: "radial-gradient(circle,rgba(0,102,255,0.13) 1.5px,transparent 1.5px)", backgroundSize: "13px 13px" } }), /* @__PURE__ */ React.createElement("div", { className: "absolute bottom-0 right-0 w-36 h-36", style: { backgroundImage: "radial-gradient(circle,rgba(0,102,255,0.13) 1.5px,transparent 1.5px)", backgroundSize: "13px 13px" } }), /* @__PURE__ */ React.createElement("svg", { className: "absolute bottom-0 left-0 w-full", viewBox: "0 0 390 80", preserveAspectRatio: "xMidYMax meet", fill: "rgba(25,40,100,0.15)" }, /* @__PURE__ */ React.createElement("path", { d: "M0,80 L0,55 L12,55 L12,44 L22,44 L22,34 L28,34 L28,44 L38,44 L38,55 L50,55 L50,38 L60,38 L60,26 L66,26 L66,18 L72,18 L72,26 L82,26 L82,38 L92,38 L92,50 L104,50 L104,40 L114,40 L114,30 L120,30 L120,40 L130,40 L130,55 L142,55 L142,42 L152,42 L152,28 L158,28 L158,42 L168,42 L168,55 L180,55 L180,44 L192,44 L192,32 L198,32 L198,20 L204,20 L204,32 L210,32 L210,44 L222,44 L222,55 L234,55 L234,46 L244,46 L244,34 L250,34 L250,22 L256,22 L256,34 L262,34 L262,46 L274,46 L274,58 L286,58 L286,48 L296,48 L296,36 L302,36 L302,48 L312,48 L312,58 L324,58 L324,50 L334,50 L334,40 L340,40 L340,28 L346,28 L346,40 L356,40 L356,50 L368,50 L368,58 L380,58 L380,50 L390,50 L390,80 Z" })), /* @__PURE__ */ React.createElement("div", { className: "absolute select-none pointer-events-none", style: { top: "28%", left: "4%", opacity: 0.09, fontSize: 72, fontWeight: 900, color: "#0066FF", fontStyle: "italic", transform: "rotate(-12deg)", letterSpacing: -2 } }, "BOOM!"), /* @__PURE__ */ React.createElement("div", { className: "absolute select-none pointer-events-none", style: { bottom: "28%", right: "2%", opacity: 0.09, fontSize: 56, fontWeight: 900, color: "#FF3366", fontStyle: "italic", transform: "rotate(9deg)", letterSpacing: -1 } }, "YEAH!"), /* @__PURE__ */ React.createElement("div", { className: "absolute select-none pointer-events-none", style: { top: "14%", right: "28%", fontSize: 14, opacity: 0.55 } }, "\xE2\u0153\xA6"), /* @__PURE__ */ React.createElement("div", { className: "absolute select-none pointer-events-none", style: { top: "40%", left: "8%", fontSize: 10, opacity: 0.4 } }, "\xE2\u0153\xA6"), /* @__PURE__ */ React.createElement("div", { className: "absolute select-none pointer-events-none", style: { top: "62%", right: "14%", fontSize: 12, opacity: 0.4 } }, "\xE2\u0153\xA6"), /* @__PURE__ */ React.createElement("div", { className: "absolute select-none pointer-events-none", style: { bottom: "18%", left: "32%", fontSize: 9, opacity: 0.35 } }, "\xE2\u0153\xA6"), /* @__PURE__ */ React.createElement("div", { className: "absolute inset-0", style: { background: "radial-gradient(ellipse at 50% 50%,transparent 50%,rgba(186,230,255,0.25) 100%)" } })), /* @__PURE__ */ React.createElement(
      "div",
      {
        className: `relative z-50 flex w-full flex-nowrap items-center justify-between gap-1 px-2 py-1.5 border-b ${T.topbar} ${T.divider} shrink-0 sm:gap-1.5 sm:px-3`
      },
      /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: () => {
            setSelectedUser(null);
            setMessages([]);
            setShowChatSearch(false);
            setChatSearch("");
            setShowEmojiGrid(false);
            setShowChatMenu(false);
            setShowCallMenu(false);
          },
          className: `h-7 w-7 shrink-0 rounded-lg bg-white/10 border ${T.divider} flex items-center justify-center ${T.text1} hover:bg-white/20 active:scale-90 transition-all sm:h-8 sm:w-8 sm:rounded-xl`,
          "aria-label": "Back to conversations"
        },
        /* @__PURE__ */ React.createElement(ArrowLeft, { size: 16 })
      ),
      /* @__PURE__ */ React.createElement(
        "div",
        {
          className: "flex min-w-0 flex-1 items-center gap-1.5 cursor-pointer sm:gap-2",
          onClick: () => {
            openProfile?.(selectedUser.id);
            handlePanicUnlock();
          }
        },
        /* @__PURE__ */ React.createElement("div", { className: "shrink-0" }, /* @__PURE__ */ React.createElement(
          Avatar,
          {
            url: selectedUser.avatar_url,
            name: selectedUser.full_name,
            size: "xs",
            online: onlineUsers.has(selectedUser.id)
          }
        )),
        /* @__PURE__ */ React.createElement("div", { className: "flex min-w-0 flex-1 items-center gap-1" }, /* @__PURE__ */ React.createElement(
          "p",
          {
            title: selectedUser.full_name,
            className: `min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-[clamp(0.625rem,3.5vw,0.875rem)] font-black leading-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:text-sm ${T.text1}`
          },
          selectedUser.full_name
        ), isOtherTyping ? /* @__PURE__ */ React.createElement(
          "span",
          {
            title: "Typing",
            "aria-label": "Typing",
            className: "flex shrink-0 items-center gap-[3px]"
          },
          [0, 1, 2].map((i) => /* @__PURE__ */ React.createElement(
            "span",
            {
              key: i,
              className: "w-1 h-1 rounded-full bg-emerald-400 inline-block",
              style: {
                animation: `bounce 1s ${i * 0.2}s infinite`
              }
            }
          ))
        ) : /* @__PURE__ */ React.createElement(
          "span",
          {
            title: onlineUsers.has(selectedUser.id) ? "Online" : "Offline",
            "aria-label": onlineUsers.has(selectedUser.id) ? "Online" : "Offline",
            className: `h-1.5 w-1.5 shrink-0 rounded-full ${onlineUsers.has(selectedUser.id) ? "bg-green-400" : "bg-white/40"}`
          }
        ))
      ),
      /* @__PURE__ */ React.createElement("div", { className: "flex shrink-0 flex-nowrap items-center gap-1 sm:gap-1.5" }, /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: () => {
            setShowChatSearch(!showChatSearch);
            setShowCallMenu(false);
            setShowChatMenu(false);
          },
          className: `h-7 w-7 shrink-0 rounded-lg bg-white/10 border ${T.divider} flex items-center justify-center ${T.text1} hover:bg-white/20 sm:h-8 sm:w-8`,
          "aria-label": showChatSearch ? "Close chat search" : "Search this chat"
        },
        /* @__PURE__ */ React.createElement(Search, { size: 14 })
      ), /* @__PURE__ */ React.createElement("div", { className: "relative z-[60] shrink-0" }, /* @__PURE__ */ React.createElement(
        "button",
        {
          type: "button",
          "aria-label": "Call options",
          "aria-haspopup": "menu",
          "aria-expanded": showCallMenu,
          onClick: (e) => {
            e.stopPropagation();
            setShowChatMenu(false);
            setShowCallMenu((open) => !open);
          },
          className: `flex h-7 min-w-7 items-center justify-center gap-0.5 rounded-lg bg-white/10 border px-1 ${T.divider} ${T.accentText} hover:bg-white/20 active:scale-90 transition-all sm:h-8 sm:min-w-8 sm:gap-1 sm:px-1.5`
        },
        /* @__PURE__ */ React.createElement(Phone, { size: 13 }),
        /* @__PURE__ */ React.createElement(ChevronDown, { size: 10 })
      ), /* @__PURE__ */ React.createElement(AnimatePresence, null, showCallMenu && /* @__PURE__ */ React.createElement(
        motion.div,
        {
          initial: { opacity: 0, scale: 0.95, y: 4 },
          animate: { opacity: 1, scale: 1, y: 0 },
          exit: { opacity: 0, scale: 0.95, y: 4 },
          role: "menu",
          className: `absolute right-0 top-full z-[9999] mt-2 min-w-[160px] overflow-hidden rounded-xl border shadow-2xl ${T.msgMenuBg} text-white`,
          onClick: (e) => e.stopPropagation()
        },
        /* @__PURE__ */ React.createElement(
          "button",
          {
            type: "button",
            role: "menuitem",
            onClick: () => {
              setShowCallMenu(false);
              toast.info("\xF0\u0178\u201D\u0160 Voice call \xE2\u20AC\u201D coming soon!");
            },
            className: `flex w-full items-center gap-2 px-4 py-3 text-sm font-bold hover:bg-white/8 ${T.text1}`
          },
          /* @__PURE__ */ React.createElement(Phone, { size: 15 }),
          " Audio Call"
        ),
        /* @__PURE__ */ React.createElement(
          "button",
          {
            type: "button",
            role: "menuitem",
            onClick: () => {
              setShowCallMenu(false);
              toast.info("\xF0\u0178\u201C\xB9 Video call \xE2\u20AC\u201D coming soon!");
            },
            className: `flex w-full items-center gap-2 px-4 py-3 text-sm font-bold hover:bg-white/8 ${T.text1}`
          },
          /* @__PURE__ */ React.createElement(VideoIcon, { size: 15 }),
          " Video Call"
        )
      ))), /* @__PURE__ */ React.createElement(
        "button",
        {
          type: "button",
          onClick: () => {
            setShowChatSearch(false);
            setShowCallMenu(false);
            setShowChatMenu(false);
            setShowSongLibrary(true);
          },
          "aria-label": "Open shared song library",
          "aria-haspopup": "dialog",
          className: `h-7 w-7 shrink-0 rounded-lg bg-white/10 border ${T.divider} flex items-center justify-center ${T.text1} hover:bg-white/20 active:scale-90 transition-all sm:h-8 sm:w-8`
        },
        /* @__PURE__ */ React.createElement(
          Disc3,
          {
            size: 15,
            className: chatMusicPlaying ? "animate-spin" : ""
          }
        )
      ), /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: () => setPanicMode((p) => !p),
          title: "Panic Mode",
          "aria-label": panicMode ? "Turn off panic mode" : "Panic mode",
          className: `h-7 w-7 shrink-0 rounded-lg border flex items-center justify-center text-xs transition-all hover:bg-white/20 sm:h-8 sm:w-8 sm:text-sm ${panicMode ? "bg-red-500/30 border-red-400/40 animate-pulse" : `bg-white/5 ${T.divider}`}`
        },
        "\xF0\u0178\u201D\xB4"
      ), /* @__PURE__ */ React.createElement("div", { className: "relative z-[60] shrink-0" }, /* @__PURE__ */ React.createElement(
        "button",
        {
          type: "button",
          "aria-label": "Chat options",
          "aria-haspopup": "menu",
          "aria-expanded": showChatMenu,
          onClick: () => {
            setShowCallMenu(false);
            setShowChatMenu((open) => !open);
          },
          className: `h-7 w-7 rounded-lg bg-white/10 border ${T.divider} flex items-center justify-center ${T.text1} hover:bg-white/20 sm:h-8 sm:w-8`
        },
        /* @__PURE__ */ React.createElement(MoreVertical, { size: 16 })
      ), /* @__PURE__ */ React.createElement(AnimatePresence, null, showChatMenu && /* @__PURE__ */ React.createElement(
        motion.div,
        {
          initial: { opacity: 0, scale: 0.9, y: 4 },
          animate: { opacity: 1, scale: 1, y: 0 },
          exit: { opacity: 0, scale: 0.9, y: 4 },
          role: "menu",
          className: `absolute right-0 top-full z-[9999] mt-2 rounded-2xl border shadow-2xl overflow-hidden min-w-[170px] ${T.msgMenuBg} text-white`,
          onClick: (e) => e.stopPropagation()
        },
        /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => {
              messages.forEach((m) => rememberDeletedMessage(m.id));
              setMessages([]);
              setShowChatMenu(false);
              toast.success("Chat wiped locally \xF0\u0178\xA7\xBD");
            },
            className: `flex items-center gap-2 w-full px-4 py-3 text-sm font-bold hover:bg-white/8 ${T.text1}`
          },
          "\xF0\u0178\xA7\xBD Wipe Chat"
        ),
        /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => {
              if (selectedUser) {
                toggleArchive(selectedUser.id);
                setSelectedUser(null);
                setMessages([]);
                setShowChatMenu(false);
              }
            },
            className: `flex items-center gap-2 w-full px-4 py-3 text-sm font-bold hover:bg-white/8 ${T.text1}`
          },
          "\xF0\u0178\u2122\u02C6 Hide Chat"
        ),
        friendshipMap.get(selectedUser.id)?.status === "accepted" && /* @__PURE__ */ React.createElement(
          "button",
          {
            disabled: actionLoading === friendshipMap.get(selectedUser.id)?.id,
            onClick: async () => {
              const friendship = friendshipMap.get(selectedUser.id);
              if (!friendship || friendship.status !== "accepted") return;
              setActionLoading(friendship.id);
              try {
                const { error } = await supabase.from("friendships").delete().eq("id", friendship.id);
                if (error) {
                  toast.error("Could not disconnect this connection.");
                  return;
                }
                await Promise.all([fetchFriendships(), fetchContacts()]);
                toggleArchive(selectedUser.id);
                setSelectedUser(null);
                setMessages([]);
                setShowChatMenu(false);
                toast.success("Connection removed.");
              } finally {
                setActionLoading("");
              }
            },
            className: "flex w-full items-center gap-2 px-4 py-3 text-sm font-bold text-red-300 hover:bg-red-500/10 disabled:opacity-50"
          },
          /* @__PURE__ */ React.createElement(UserX, { size: 15 }),
          " Disconnect connection"
        ),
        /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => {
              setPanicMode(true);
              setShowChatMenu(false);
            },
            className: "flex items-center gap-2 w-full px-4 py-3 text-sm font-bold text-red-400 hover:bg-red-500/10"
          },
          "\xF0\u0178\u2013\u2022 Panic Mode"
        )
      ))))
    ), /* @__PURE__ */ React.createElement(AnimatePresence, null, showSongLibrary && /* @__PURE__ */ React.createElement(
      motion.div,
      {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        className: "fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm",
        role: "presentation",
        onClick: () => setShowSongLibrary(false)
      },
      /* @__PURE__ */ React.createElement(
        motion.section,
        {
          initial: { opacity: 0, y: 16, scale: 0.97 },
          animate: { opacity: 1, y: 0, scale: 1 },
          exit: { opacity: 0, y: 12, scale: 0.98 },
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": "chat-song-library-title",
          className: "flex max-h-[min(80dvh,680px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#17131d] text-white shadow-2xl",
          onClick: (event) => event.stopPropagation()
        },
        /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between border-b border-white/10 px-4 py-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", { id: "chat-song-library-title", className: "text-sm font-black" }, "Shared song library"), /* @__PURE__ */ React.createElement("p", { className: "mt-0.5 text-[11px] text-white/50" }, "Listen together in this chat")), /* @__PURE__ */ React.createElement(
          "button",
          {
            type: "button",
            onClick: () => setShowSongLibrary(false),
            "aria-label": "Close song library",
            className: "grid h-8 w-8 place-items-center rounded-lg text-white/65 hover:bg-white/10 hover:text-white"
          },
          /* @__PURE__ */ React.createElement(X, { size: 17 })
        )),
        selectedChatTrack && /* @__PURE__ */ React.createElement("div", { className: "border-b border-white/10 px-4 py-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3" }, /* @__PURE__ */ React.createElement(Disc3, { className: `shrink-0 text-fuchsia-300 ${chatMusicPlaying ? "animate-spin" : ""}`, size: 24 }), /* @__PURE__ */ React.createElement("div", { className: "min-w-0 flex-1" }, /* @__PURE__ */ React.createElement("p", { className: "truncate text-sm font-bold" }, selectedChatTrack.title), /* @__PURE__ */ React.createElement("p", { className: "truncate text-xs text-white/50" }, selectedChatTrack.artist)), /* @__PURE__ */ React.createElement(
          "button",
          {
            type: "button",
            onClick: toggleChatMusicPlayback,
            "aria-label": chatMusicPlaying ? "Pause shared music" : "Play shared music",
            className: "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fuchsia-500 text-white hover:bg-fuchsia-400"
          },
          chatMusicPlaying ? /* @__PURE__ */ React.createElement(Pause, { size: 16 }) : /* @__PURE__ */ React.createElement(Play, { size: 16, fill: "currentColor" })
        )), /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "range",
            min: 0,
            max: chatMusicDuration || 0,
            step: 0.01,
            value: Math.min(chatMusicTime, chatMusicDuration || chatMusicTime),
            disabled: !chatMusicDuration,
            "aria-label": "Seek shared music",
            onChange: (event) => seekChatMusic(Number(event.target.value)),
            onPointerUp: finishChatMusicSeek,
            onKeyUp: finishChatMusicSeek,
            className: "mt-3 w-full accent-fuchsia-400 disabled:opacity-40"
          }
        ), /* @__PURE__ */ React.createElement("div", { className: "flex justify-between text-[10px] tabular-nums text-white/40" }, /* @__PURE__ */ React.createElement("span", null, formatMusicTime(chatMusicTime)), /* @__PURE__ */ React.createElement("span", null, formatMusicTime(chatMusicDuration)))),
        /* @__PURE__ */ React.createElement("div", { className: "min-h-0 flex-1 overflow-y-auto p-2" }, loadingSongLibrary ? /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-center gap-2 py-10 text-sm text-white/55" }, /* @__PURE__ */ React.createElement(Loader2, { size: 16, className: "animate-spin" }), " Loading songs\xE2\u20AC\xA6") : songLibraryError ? /* @__PURE__ */ React.createElement("div", { className: "px-4 py-8 text-center text-sm text-rose-200" }, songLibraryError) : songLibrary.length === 0 ? /* @__PURE__ */ React.createElement("p", { className: "px-4 py-8 text-center text-sm text-white/50" }, "No songs are available yet.") : songLibrary.map((track) => /* @__PURE__ */ React.createElement(
          "div",
          {
            key: track.id,
            className: "flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.06]"
          },
          /* @__PURE__ */ React.createElement(Music, { size: 17, className: "shrink-0 text-fuchsia-300" }),
          /* @__PURE__ */ React.createElement("div", { className: "min-w-0 flex-1" }, /* @__PURE__ */ React.createElement("p", { className: "truncate text-sm font-bold" }, track.title), /* @__PURE__ */ React.createElement("p", { className: "truncate text-xs text-white/50" }, track.artist)),
          /* @__PURE__ */ React.createElement(
            "button",
            {
              type: "button",
              onClick: () => selectChatMusicTrack(track),
              className: "shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-fuchsia-500"
            },
            selectedChatTrack?.id === track.id && chatMusicPlaying ? "Playing" : "Select & Play"
          )
        )))
      )
    )), /* @__PURE__ */ React.createElement(AnimatePresence, null, voiceMode && /* @__PURE__ */ React.createElement(
      motion.div,
      {
        initial: { height: 0, opacity: 0 },
        animate: { height: "auto", opacity: 1 },
        exit: { height: 0, opacity: 0 },
        className: "overflow-hidden shrink-0"
      },
      /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3 px-4 py-2.5 bg-red-500/15 border-b border-red-500/20" }, /* @__PURE__ */ React.createElement("div", { className: "relative shrink-0" }, /* @__PURE__ */ React.createElement("div", { className: "absolute inset-0 rounded-full bg-red-500/40 animate-ping" }), /* @__PURE__ */ React.createElement("div", { className: "w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white text-base relative z-10" }, "\xF0\u0178\u017D\u2122\xEF\xB8\x8F")), /* @__PURE__ */ React.createElement("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ React.createElement("p", { className: "text-xs font-black text-red-400 uppercase tracking-wider" }, voiceStatus === "listening" ? "Listening\xE2\u20AC\xA6" : "Processing\xE2\u20AC\xA6"), /* @__PURE__ */ React.createElement("p", { className: "text-[10px] text-white/40 font-semibold" }, "Say: Likh [msg] \xC2\xB7 Send \xC2\xB7 Sab Saaf \xC2\xB7 Panic Mode \xC2\xB7 Band Karo")), /* @__PURE__ */ React.createElement("div", { className: "text-right shrink-0" }, /* @__PURE__ */ React.createElement("p", { className: "text-base font-black text-red-400 tabular-nums" }, String(Math.floor(voiceSecondsLeft / 60)).padStart(
        2,
        "0"
      ), ":", String(voiceSecondsLeft % 60).padStart(2, "0")), /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: stopVoiceMode,
          className: "text-[10px] font-black text-white/50 hover:text-red-400 uppercase tracking-wider transition-colors"
        },
        "Stop"
      )))
    )), /* @__PURE__ */ React.createElement(AnimatePresence, null, showChatSearch && /* @__PURE__ */ React.createElement(
      motion.div,
      {
        initial: { height: 0, opacity: 0 },
        animate: { height: "auto", opacity: 1 },
        exit: { height: 0, opacity: 0 },
        className: `px-4 py-2 border-b overflow-hidden ${T.divider}`
      },
      /* @__PURE__ */ React.createElement("div", { className: "relative" }, /* @__PURE__ */ React.createElement(
        Search,
        {
          size: 13,
          className: `absolute left-3 top-1/2 -translate-y-1/2 ${T.text3}`
        }
      ), /* @__PURE__ */ React.createElement(
        "input",
        {
          autoFocus: true,
          type: "text",
          placeholder: "Search in conversation...",
          value: chatSearch,
          onChange: (e) => setChatSearch(e.target.value),
          className: `w-full rounded-2xl pl-9 pr-4 py-2 text-sm font-semibold outline-none border ${T.searchBg}`
        }
      ))
    )), /* @__PURE__ */ React.createElement(
      "div",
      {
        ref: messagesPaneRef,
        className: "chat-scroll-pane flex min-h-0 flex-1 flex-col items-stretch overflow-y-auto px-4 pt-20 pb-4 space-y-2",
        onClick: () => {
          setMsgMenuId(null);
          setShowEmojiGrid(false);
          setShowInputEmoji(false);
        }
      },
      hasOlderMessages && /* @__PURE__ */ React.createElement("div", { className: "absolute left-0 right-0 top-2 z-10 flex justify-center pointer-events-none" }, /* @__PURE__ */ React.createElement(
        "button",
        {
          type: "button",
          onClick: (event) => {
            event.stopPropagation();
            void loadOlderMessages();
          },
          disabled: loadingOlderMessages,
          className: `pointer-events-auto rounded-full px-3 py-1 text-[11px] font-bold border ${T.divider} ${T.text1} bg-black/30 backdrop-blur-sm disabled:opacity-50`
        },
        loadingOlderMessages ? "Loading older\xE2\u20AC\xA6" : "Load older messages"
      )),
      loadingMessages ? /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-center py-10" }, /* @__PURE__ */ React.createElement(
        Loader2,
        {
          size: 20,
          className: `animate-spin ${T.text3}`
        }
      )) : filteredMessages.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "flex flex-col items-center justify-center py-16 gap-3 text-center" }, /* @__PURE__ */ React.createElement("p", { className: "text-5xl" }, "\xF0\u0178\u2018\u2039"), /* @__PURE__ */ React.createElement("p", { className: `text-base font-black ${T.text1}` }, chatSearch ? "No messages found" : `Hello ${selectedUser?.full_name?.split(" ")[0] || "there"}. It is good to connect with you.`), /* @__PURE__ */ React.createElement("p", { className: `text-xs ${T.text3}` }, chatSearch ? "" : "Pehla message bhejo!")) : (() => {
        const lastSeenMsgId = filteredMessages.filter((m) => String(m.sender_id || "").trim() === String(userId || "").trim() && m.seen_at).slice(-1)[0]?.id ?? null;
        return filteredMessages.map((msg) => {
          const isMine = String(msg.sender_id || "").trim() === String(userId || "").trim();
          const quotedMsg = msg.reply_to_id ? messages.find((m) => m.id === msg.reply_to_id) : null;
          return /* @__PURE__ */ React.createElement(
            motion.div,
            {
              key: msg.id,
              initial: { opacity: 0, y: 8 },
              animate: { opacity: 1, y: 0 },
              drag: "x",
              dragConstraints: { left: 0, right: 64 },
              dragElastic: { left: 0, right: 0.25 },
              dragDirectionLock: true,
              onDragEnd: (_e, info) => {
                if (info.offset.x > 48) {
                  setReplyTo(msg);
                  setMsgMenuId(null);
                }
              },
              onPointerDown: (e) => {
                longPressMsgPos.current = {
                  x: e.clientX,
                  y: e.clientY
                };
                longPressTimerRef.current = setTimeout(() => {
                  try {
                    navigator.vibrate?.(10);
                  } catch (_) {
                  }
                  setChatMsgAction({
                    msg,
                    x: longPressMsgPos.current.x,
                    y: longPressMsgPos.current.y
                  });
                  setMsgMenuId(null);
                }, 550);
              },
              onPointerUp: () => {
                if (longPressTimerRef.current)
                  clearTimeout(longPressTimerRef.current);
              },
              onPointerLeave: () => {
                if (longPressTimerRef.current)
                  clearTimeout(longPressTimerRef.current);
              },
              className: `flex w-full ${isMine ? "justify-end" : "justify-start"} group relative select-none`,
              style: { cursor: "default" }
            },
            /* @__PURE__ */ React.createElement(
              "div",
              {
                className: `absolute ${isMine ? "left-0" : "right-0"} top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center opacity-0 group-active:opacity-60 pointer-events-none transition-opacity`
              },
              /* @__PURE__ */ React.createElement(
                "svg",
                {
                  width: "12",
                  height: "12",
                  viewBox: "0 0 24 24",
                  fill: "none",
                  stroke: "currentColor",
                  strokeWidth: "2.5",
                  className: "text-white/60"
                },
                /* @__PURE__ */ React.createElement("polyline", { points: "9 18 15 12 9 6" })
              )
            ),
            /* @__PURE__ */ React.createElement("div", { className: "relative max-w-[78%]" }, quotedMsg && /* @__PURE__ */ React.createElement(
              "div",
              {
                className: `mb-1 px-3 py-1.5 rounded-xl border-l-4 border-blue-400 bg-white/8 backdrop-blur-sm max-w-full`
              },
              /* @__PURE__ */ React.createElement("p", { className: "text-[10px] font-black text-blue-400 mb-0.5" }, quotedMsg.sender_id === userId ? "You" : selectedUser?.full_name?.split(" ")[0]),
              /* @__PURE__ */ React.createElement(
                "p",
                {
                  className: `text-[11px] font-semibold truncate ${T.text3}`
                },
                quotedMsg.content || "\xF0\u0178\u201C\u017D Media"
              )
            ), /* @__PURE__ */ React.createElement("div", { className: theme === "comic" ? "relative overflow-visible" : "" }, theme === "comic" && isMine && /* @__PURE__ */ React.createElement("div", { className: "absolute inset-0 rounded-[20px] pointer-events-none overflow-hidden", style: { backgroundImage: "radial-gradient(circle,rgba(0,0,0,0.06) 1px,transparent 1px)", backgroundSize: "7px 7px", zIndex: 1 } }), /* @__PURE__ */ React.createElement(
              "div",
              {
                className: `px-4 py-2.5 ${theme === "comic" ? "rounded-[20px]" : "rounded-2xl"} ${isMine ? `${T.bubbleSent}${theme !== "comic" ? " rounded-tr-sm" : ""}` : `${T.bubbleRecv}${theme !== "comic" ? " rounded-tl-sm" : ""}`}`
              },
              msg.media_url && msg.media_type ? /* @__PURE__ */ React.createElement(
                MediaBubble,
                {
                  url: msg.media_url,
                  type: msg.media_type
                }
              ) : editingMsg?.id === msg.id ? /* @__PURE__ */ React.createElement(
                "div",
                {
                  className: "min-w-[180px]",
                  onClick: (e) => e.stopPropagation()
                },
                /* @__PURE__ */ React.createElement(
                  "textarea",
                  {
                    className: "w-full rounded-xl px-2 py-1.5 text-base font-bold outline-none resize-none bg-white/20 border border-white/30 text-inherit",
                    rows: 2,
                    value: editingMsg.text,
                    onChange: (e) => setEditingMsg(
                      (prev) => prev ? { ...prev, text: e.target.value } : null
                    ),
                    autoFocus: true
                  }
                ),
                /* @__PURE__ */ React.createElement("div", { className: "flex gap-1.5 mt-1.5" }, /* @__PURE__ */ React.createElement(
                  "button",
                  {
                    onClick: () => setEditingMsg(null),
                    className: "flex-1 py-1 rounded-lg bg-white/15 text-[11px] font-bold opacity-70"
                  },
                  "Cancel"
                ), /* @__PURE__ */ React.createElement(
                  "button",
                  {
                    onClick: saveEditMsg,
                    className: "flex-1 py-1 rounded-lg bg-blue-500 text-white text-[11px] font-bold"
                  },
                  "Save"
                ))
              ) : /* @__PURE__ */ React.createElement(React.Fragment, null, (() => {
                const parsed = parseMessage(msg.content || "");
                if (parsed.sticker) {
                  return /* @__PURE__ */ React.createElement(
                    ChatSticker,
                    {
                      type: parsed.sticker,
                      originalText: parsed.originalText,
                      isEdited: msg.is_edited
                    }
                  );
                }
                return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("p", { className: "text-sm font-medium leading-snug break-words" }, msg.content), msg.is_edited && /* @__PURE__ */ React.createElement("p", { className: "text-[10px] opacity-40 italic mt-0.5" }, "(edited)"));
              })()),
              /* @__PURE__ */ React.createElement(
                "p",
                {
                  className: `text-[10px] mt-0.5 font-medium ${isMine ? theme === "comic" ? "text-white/60" : "text-white/50" : T.text3} text-right flex items-center justify-end gap-1`
                },
                formatTime(msg.created_at),
                /* @__PURE__ */ React.createElement(MessageStatus, { msg, userId })
              )
            ), theme === "comic" && isMine && /* @__PURE__ */ React.createElement("svg", { className: "absolute right-4 top-full -mt-[2px] z-20", width: "20", height: "13", viewBox: "0 0 20 13", style: { filter: "drop-shadow(1px 2px 0px rgba(0,0,0,0.35))" } }, /* @__PURE__ */ React.createElement("polygon", { points: "2,0 20,0 13,13", fill: "#0066FF" }), /* @__PURE__ */ React.createElement("polyline", { points: "2,0 13,13", fill: "none", stroke: "black", strokeWidth: "1.5", strokeLinejoin: "round" }), /* @__PURE__ */ React.createElement("line", { x1: "20", y1: "0", x2: "13", y2: "13", stroke: "black", strokeWidth: "1.5", strokeLinejoin: "round" })), theme === "comic" && !isMine && /* @__PURE__ */ React.createElement("svg", { className: "absolute left-4 top-full -mt-[2px] z-20", width: "20", height: "13", viewBox: "0 0 20 13", style: { filter: "drop-shadow(-1px 2px 0px rgba(0,0,0,0.25))" } }, /* @__PURE__ */ React.createElement("polygon", { points: "0,0 18,0 7,13", fill: "white" }), /* @__PURE__ */ React.createElement("polyline", { points: "18,0 7,13", fill: "none", stroke: "black", strokeWidth: "1.5", strokeLinejoin: "round" }), /* @__PURE__ */ React.createElement("line", { x1: "0", y1: "0", x2: "7", y2: "13", stroke: "black", strokeWidth: "1.5", strokeLinejoin: "round" }))), isMine && msg.id === lastSeenMsgId && /* @__PURE__ */ React.createElement(
              motion.div,
              {
                key: lastSeenMsgId ?? void 0,
                initial: { opacity: 0, y: 6, scale: 0.85 },
                animate: { opacity: 1, y: 0, scale: 1 },
                transition: { type: "spring", stiffness: 340, damping: 26 },
                className: `flex flex-col items-end gap-0.5 ${theme === "comic" ? "mt-4" : "mt-1.5"} mr-1`
              },
              /* @__PURE__ */ React.createElement("span", { className: `text-[11px] font-semibold tracking-wide ${theme === "comic" ? "text-gray-500" : "text-white/45"}` }, "Seen by"),
              /* @__PURE__ */ React.createElement("div", { className: "relative" }, selectedUser?.avatar_url ? /* @__PURE__ */ React.createElement(
                "img",
                {
                  src: selectedUser.avatar_url,
                  alt: selectedUser.full_name || "",
                  className: "w-8 h-8 rounded-full object-cover border-[1.5px] border-[#E3FF00]"
                }
              ) : /* @__PURE__ */ React.createElement("div", { className: "w-8 h-8 rounded-full bg-[#E3FF00]/15 border-[1.5px] border-[#E3FF00] flex items-center justify-center text-[11px] font-black text-[#E3FF00]" }, (selectedUser?.full_name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()), /* @__PURE__ */ React.createElement("span", { className: "absolute -bottom-0.5 -right-0.5 w-[13px] h-[13px] rounded-full bg-emerald-500 border border-[#050505] flex items-center justify-center shadow-sm" }, /* @__PURE__ */ React.createElement("svg", { width: "7", height: "7", viewBox: "0 0 7 7", fill: "none" }, /* @__PURE__ */ React.createElement("path", { d: "M1.5 3.5L3 5L5.5 2", stroke: "white", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round" })))),
              /* @__PURE__ */ React.createElement("span", { className: `text-[10px] ${theme === "comic" ? "text-gray-400" : "text-white/40"}` }, formatTime(msg.seen_at))
            ), msgReactions[msg.id] && Object.keys(msgReactions[msg.id]).length > 0 && /* @__PURE__ */ React.createElement(
              ReactionBubbles,
              {
                reactions: msgReactions[msg.id],
                currentUserId: userId,
                align: isMine ? "right" : "left"
              }
            ))
          );
        });
      })(),
      /* @__PURE__ */ React.createElement("div", { ref: messagesEndRef })
    ), /* @__PURE__ */ React.createElement(
      "div",
      {
        className: "shrink-0 px-3",
        style: {
          background: theme === "comic" ? "linear-gradient(to top,rgba(255,255,255,0.97) 0%,rgba(240,249,255,0.85) 100%)" : "linear-gradient(to top,rgba(5,5,5,0.92) 0%,rgba(5,5,5,0.70) 100%)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)"
        }
      },
      /* @__PURE__ */ React.createElement(AnimatePresence, null, replyTo && /* @__PURE__ */ React.createElement(
        motion.div,
        {
          initial: { height: 0, opacity: 0 },
          animate: { height: "auto", opacity: 1 },
          exit: { height: 0, opacity: 0 },
          className: `flex items-center gap-2 px-4 py-2 border-b ${T.divider} ${panelBg}`
        },
        /* @__PURE__ */ React.createElement("div", { className: "w-0.5 h-8 rounded-full bg-blue-400 shrink-0" }),
        /* @__PURE__ */ React.createElement("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ React.createElement("p", { className: "text-[10px] font-black text-blue-400" }, replyTo.sender_id === userId ? "You" : selectedUser?.full_name?.split(" ")[0]), /* @__PURE__ */ React.createElement("p", { className: `text-[11px] truncate ${T.text3}` }, replyTo.content || "\xF0\u0178\u201C\u017D Media")),
        /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => setReplyTo(null),
            className: `w-6 h-6 rounded-full bg-white/10 flex items-center justify-center ${T.text3} hover:bg-white/20`
          },
          /* @__PURE__ */ React.createElement(X, { size: 11 })
        )
      )),
      /* @__PURE__ */ React.createElement(AnimatePresence, null, showInputEmoji && /* @__PURE__ */ React.createElement(
        motion.div,
        {
          initial: { height: 0, opacity: 0 },
          animate: { height: "auto", opacity: 1 },
          exit: { height: 0, opacity: 0 },
          className: `border-b ${T.divider} overflow-hidden`
        },
        /* @__PURE__ */ React.createElement("div", { className: "p-3 grid grid-cols-7 gap-1.5" }, INPUT_EMOJIS.map((em) => /* @__PURE__ */ React.createElement(
          "button",
          {
            key: em,
            onClick: () => setNewMessage((prev) => prev + em),
            className: "w-9 h-9 rounded-xl text-xl flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all"
          },
          em
        )))
      )),
      /* @__PURE__ */ React.createElement(AnimatePresence, null, pendingFile && /* @__PURE__ */ React.createElement(
        motion.div,
        {
          initial: { height: 0, opacity: 0 },
          animate: { height: "auto", opacity: 1 },
          exit: { height: 0, opacity: 0 },
          className: `flex items-center gap-3 px-4 py-2 border-b ${T.divider} ${panelBg}`
        },
        pendingFile.type.startsWith("image/") && pendingFilePreview && /* @__PURE__ */ React.createElement(
          "img",
          {
            src: pendingFilePreview,
            className: "w-12 h-12 rounded-xl object-cover shrink-0",
            decoding: "async"
          }
        ),
        pendingFile.type.startsWith("video/") && pendingFilePreview && /* @__PURE__ */ React.createElement(
          "video",
          {
            src: pendingFilePreview,
            className: "w-16 h-12 rounded-xl object-cover shrink-0 bg-black",
            muted: true,
            playsInline: true,
            preload: "none"
          }
        ),
        pendingFile.type.startsWith("audio/") && /* @__PURE__ */ React.createElement("div", { className: "w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0" }, /* @__PURE__ */ React.createElement(Music, { size: 18, className: "text-blue-400" })),
        /* @__PURE__ */ React.createElement("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ React.createElement(
          "p",
          {
            className: `text-xs font-bold ${T.text1} truncate`
          },
          pendingFile.name
        ), /* @__PURE__ */ React.createElement("p", { className: `text-[10px] ${T.text3}` }, pendingFile.type.startsWith("video/") ? "\xF0\u0178\u017D\xA5 Video" : pendingFile.type.startsWith("audio/") ? " \xEF\xBF\xBD\xEF\xBF\xBD\xEF\xBF\xBD Audio" : "\xF0\u0178\u2013\xBC\xEF\xB8\x8F Image", " \xC2\xB7 ", (pendingFile.size / (1024 * 1024)).toFixed(1), " MB")),
        /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: clearPendingFile,
            className: `w-6 h-6 rounded-full bg-white/10 flex items-center justify-center ${T.text3} hover:bg-red-500/50 transition-colors`
          },
          /* @__PURE__ */ React.createElement(X, { size: 11 })
        )
      )),
      /* @__PURE__ */ React.createElement(
        "div",
        {
          className: "flex items-center gap-2 px-3 rounded-[32px] border border-white/[0.08] mt-2 mb-[max(12px,env(safe-area-inset-bottom))] transition-all duration-300",
          style: {
            minHeight: 56,
            background: theme === "comic" ? "rgba(255,255,255,0.95)" : "rgba(20,20,20,0.88)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: inputFocused ? theme === "comic" ? "0 6px 28px rgba(0,0,0,0.14), 0 0 0 2px rgba(37,211,102,0.35)" : "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1.5px rgba(227,255,0,0.22)" : theme === "comic" ? "0 4px 20px rgba(0,0,0,0.10), 0 0 0 1.5px rgba(0,0,0,0.09)" : "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(227,255,0,0.05)"
          }
        },
        /* @__PURE__ */ React.createElement(AnimatePresence, { initial: false }, !inputFocused && /* @__PURE__ */ React.createElement(
          motion.div,
          {
            key: "left-btns",
            initial: { opacity: 0, width: 0 },
            animate: { opacity: 1, width: "auto" },
            exit: { opacity: 0, width: 0 },
            transition: { duration: 0.18, ease: "easeInOut" },
            className: "flex items-center gap-2 overflow-hidden shrink-0",
            style: { willChange: "opacity, width" }
          },
          /* @__PURE__ */ React.createElement(
            motion.button,
            {
              whileTap: { scale: 0.9 },
              animate: { scale: [1, 1.05, 1] },
              transition: { duration: 2, repeat: Infinity, ease: "easeInOut" },
              onClick: () => setShowStickerDrawer((p) => !p),
              className: `w-9 h-9 rounded-2xl border ${T.divider} flex items-center justify-center text-lg hover:bg-white/20 shrink-0 transition-all ${showStickerDrawer ? "bg-white/20" : "bg-white/10"}`
            },
            /* @__PURE__ */ React.createElement(Image, { size: 16, strokeWidth: 1.5 })
          ),
          /* @__PURE__ */ React.createElement(
            "button",
            {
              onClick: () => fileInputRef.current?.click(),
              disabled: isUploadingMedia,
              className: `w-9 h-9 rounded-2xl border flex items-center justify-center shrink-0 disabled:opacity-40 transition-colors ${pendingFile ? "bg-blue-500 border-blue-400 text-white" : "bg-white/10 ${T.divider} ${T.text3} hover:bg-white/20"}`
            },
            isUploadingMedia ? /* @__PURE__ */ React.createElement(Loader2, { size: 15, className: "animate-spin" }) : /* @__PURE__ */ React.createElement(Paperclip, { size: 15 })
          )
        )),
        /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "file",
            ref: fileInputRef,
            className: "hidden",
            onChange: handleMediaUpload,
            accept: "image/*,video/*,audio/*"
          }
        ),
        /* @__PURE__ */ React.createElement(
          "textarea",
          {
            value: newMessage,
            onChange: (e) => {
              setNewMessage(e.target.value);
              handleTyping();
            },
            onKeyDown: (e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            },
            onFocus: () => setInputFocused(true),
            onBlur: () => setInputFocused(false),
            placeholder: "Type a message...",
            rows: 1,
            className: `flex-1 rounded-full px-4 py-2.5 text-base font-medium outline-none border resize-none overflow-y-auto transition-all duration-200 ${T.searchBg}`,
            style: { maxHeight: inputFocused ? 96 : 52 }
          }
        ),
        /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => {
              sendMessage();
            },
            disabled: !newMessage.trim() && !pendingFile || isSending || isUploadingMedia,
            className: `w-11 h-11 rounded-full flex items-center justify-center ${T.sendBtnText} shrink-0 active:scale-90 disabled:opacity-40 transition-all ${T.accent}`,
            style: { boxShadow: inputFocused ? "0 4px 22px rgba(227,255,0,0.45)" : "0 4px 18px rgba(227,255,0,0.30)" }
          },
          isSending || isUploadingMedia ? /* @__PURE__ */ React.createElement(Loader2, { size: 16, className: "animate-spin" }) : /* @__PURE__ */ React.createElement(Send, { size: 16 })
        ),
        /* @__PURE__ */ React.createElement(AnimatePresence, { initial: false }, !inputFocused && /* @__PURE__ */ React.createElement(
          motion.div,
          {
            key: "mic-btn",
            initial: { opacity: 0, width: 0 },
            animate: { opacity: 1, width: "auto" },
            exit: { opacity: 0, width: 0 },
            transition: { duration: 0.18, ease: "easeInOut" },
            className: "overflow-hidden shrink-0",
            style: { willChange: "opacity, width" }
          },
          /* @__PURE__ */ React.createElement(
            "button",
            {
              onClick: () => voiceMode ? stopVoiceMode() : startVoiceMode(),
              className: `w-9 h-9 rounded-2xl border flex items-center justify-center text-base shrink-0 active:scale-90 transition-all
                              ${voiceMode ? "bg-red-500 border-red-400 animate-pulse text-white" : `bg-white/10 ${T.divider} hover:bg-white/20`}`
            },
            "\xF0\u0178\u017D\u2122\xEF\xB8\x8F"
          )
        ))
      )
    )), bottomTab === "story" && /* @__PURE__ */ React.createElement("div", { className: `flex flex-col flex-1 overflow-hidden` }, /* @__PURE__ */ React.createElement(
      "div",
      {
        className: `flex items-center justify-between px-5 pt-5 pb-3 border-b ${T.divider} shrink-0`
      },
      /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", { className: `text-xl font-black ${T.text1}` }, "Stories"), /* @__PURE__ */ React.createElement("p", { className: `text-xs font-semibold ${T.text3}` }, "24-hour moments")),
      /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: onClose,
          className: `w-8 h-8 rounded-xl ${panelBg} border ${T.divider} flex items-center justify-center ${T.text3}`
        },
        /* @__PURE__ */ React.createElement(X, { size: 15 })
      )
    ), /* @__PURE__ */ React.createElement("div", { className: "flex-1 overflow-y-auto px-4 py-6" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => storyInputRef.current?.click(),
        className: `flex items-center gap-4 p-4 rounded-2xl border ${T.divider} bg-white/5 mb-6 w-full hover:bg-white/10 active:scale-98 transition-all`
      },
      /* @__PURE__ */ React.createElement(
        "div",
        {
          className: `w-14 h-14 rounded-full border-2 border-dashed ${T.storyRing} flex items-center justify-center text-2xl`
        },
        "+"
      ),
      /* @__PURE__ */ React.createElement("div", { className: "text-left" }, /* @__PURE__ */ React.createElement("p", { className: `text-base font-black ${T.text1}` }, "Add to Your Story"), /* @__PURE__ */ React.createElement("p", { className: `text-xs ${T.text3}` }, "Share a photo with caption & emoji"))
    ), /* @__PURE__ */ React.createElement(
      "input",
      {
        ref: storyInputRef,
        type: "file",
        accept: "image/*,video/*,audio/*",
        multiple: true,
        className: "hidden",
        onChange: (e) => {
          const allFiles = Array.from(e.target.files || []).slice(
            0,
            10
          );
          if (allFiles.length === 0) return;
          const oversized = allFiles.find(
            (f) => f.type.startsWith("video/") && f.size > 30 * 1024 * 1024
          );
          if (oversized) {
            toast.error("Please shorten your file under 30MB");
            e.target.value = "";
            return;
          }
          const files = allFiles;
          clearStoryPreviews();
          const previews = files.map((f) => URL.createObjectURL(f));
          setStoryFiles(files);
          setStoryPreviews(previews);
          setStoryFile(files[0]);
          setStoryPreviewUrl(previews[0] || "");
          setShowStoryEditor(true);
          e.target.value = "";
        }
      }
    ), /* @__PURE__ */ React.createElement(
      "p",
      {
        className: `text-[10px] font-black uppercase tracking-widest mb-3 ${T.text3}`
      },
      "Recent Stories"
    ), loadingStories ? /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-center py-10" }, /* @__PURE__ */ React.createElement(
      Loader2,
      {
        size: 20,
        className: `animate-spin ${T.text3}`
      }
    )) : storyGroups.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "flex flex-col items-center justify-center py-16 gap-3 text-center" }, /* @__PURE__ */ React.createElement("p", { className: "text-5xl" }, "\xF0\u0178\u201D\xA5"), /* @__PURE__ */ React.createElement("p", { className: `text-base font-black ${T.text3}` }, "No stories available. Start the fire! \xF0\u0178\u201D\xA5"), /* @__PURE__ */ React.createElement("p", { className: `text-xs ${T.text3}` }, "Be the first to post a story today")) : /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-3" }, storyGroups.map((group, gi) => {
      const story = group.stories[0];
      const pName = group.profile?.full_name || "User";
      const aUrl = group.profile?.avatar_url;
      return /* @__PURE__ */ React.createElement(
        motion.button,
        {
          key: group.user_id,
          onClick: () => {
            setViewerGroupIdx(gi);
            setViewerStoryIdx(0);
            setStoryElapsed(0);
            storyViewedRef.current.clear();
            setStoryViewerOpen(true);
          },
          className: `relative h-48 rounded-2xl overflow-hidden border ${T.divider} cursor-pointer`,
          whileTap: { scale: 0.97 }
        },
        story.media_type === "voice" ? /* @__PURE__ */ React.createElement(
          "div",
          {
            className: "w-full h-full flex flex-col items-center justify-center gap-2",
            style: {
              background: `linear-gradient(160deg,${_sgradFor(group.user_id)},#0f172a)`
            }
          },
          /* @__PURE__ */ React.createElement(Mic, { size: 24, className: "text-white/80" }),
          /* @__PURE__ */ React.createElement("span", { className: "text-white/50 text-xs" }, "Voice Story")
        ) : story.media_type === "video" ? /* @__PURE__ */ React.createElement(
          AutoPlayMutedVideo,
          {
            src: getStoryMediaUrl(story.image_url),
            className: "w-full h-full object-cover",
            style: {
              filter: STORY_MOOD_FILTER[story.mood ?? ""] ?? ""
            },
            preload: "metadata",
            onError: onStoryMediaError
          }
        ) : /* @__PURE__ */ React.createElement(
          "img",
          {
            src: getStoryMediaUrl(story.image_url),
            className: "w-full h-full object-cover",
            style: {
              filter: STORY_MOOD_FILTER[story.mood ?? ""] ?? ""
            },
            decoding: "async",
            crossOrigin: "anonymous",
            onError: onStoryMediaError
          }
        ),
        /* @__PURE__ */ React.createElement("div", { className: "absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" }),
        group.stories.length > 1 && /* @__PURE__ */ React.createElement("div", { className: "absolute top-2 right-2 bg-black/60 rounded-full px-2 py-0.5" }, /* @__PURE__ */ React.createElement("span", { className: "text-white text-[10px] font-black" }, group.stories.length)),
        story.is_help_request && /* @__PURE__ */ React.createElement("div", { className: "absolute top-2 left-2 bg-orange-500 rounded-full px-1.5 py-0.5" }, /* @__PURE__ */ React.createElement("span", { className: "text-white text-[10px] font-black" }, "\xF0\u0178\u2020\u02DC")),
        /* @__PURE__ */ React.createElement("div", { className: "absolute top-2 left-2" }, aUrl ? /* @__PURE__ */ React.createElement(
          "img",
          {
            src: aUrl,
            className: "w-8 h-8 rounded-full object-cover border border-white/60",
            decoding: "async",
            crossOrigin: "anonymous"
          }
        ) : /* @__PURE__ */ React.createElement(
          "div",
          {
            className: "w-8 h-8 rounded-full border border-white/60 flex items-center justify-center text-white font-black text-sm",
            style: {
              background: _sgradFor(group.user_id)
            }
          },
          pName[0]
        )),
        /* @__PURE__ */ React.createElement("div", { className: "absolute bottom-2 left-2 right-2" }, story.caption && /* @__PURE__ */ React.createElement("p", { className: "text-white text-xs font-black truncate" }, story.emoji, " ", story.caption), /* @__PURE__ */ React.createElement("p", { className: "text-white/60 text-[10px]" }, pName.split(" ")[0]))
      );
    })))), bottomTab === "alert" && /* @__PURE__ */ React.createElement("div", { className: `flex flex-col flex-1 overflow-hidden` }, /* @__PURE__ */ React.createElement(
      "div",
      {
        className: `flex items-center justify-between px-5 pt-5 pb-3 border-b ${T.divider} shrink-0`
      },
      /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", { className: `text-xl font-black ${T.text1}` }, "Alerts"), /* @__PURE__ */ React.createElement("p", { className: `text-xs font-semibold ${T.text3}` }, unreadAlerts, " unread")),
      /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, alerts.length > 0 && /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: () => setAlerts(
            (prev) => prev.map((a) => ({ ...a, read: true }))
          ),
          className: `text-xs font-black px-3 py-1.5 rounded-xl ${T.pill}`
        },
        "Mark all read"
      ), /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: onClose,
          className: `w-8 h-8 rounded-xl ${panelBg} border ${T.divider} flex items-center justify-center ${T.text3}`
        },
        /* @__PURE__ */ React.createElement(X, { size: 15 })
      ))
    ), /* @__PURE__ */ React.createElement("div", { className: "flex-1 overflow-y-auto" }, pendingCount > 0 && /* @__PURE__ */ React.createElement(
      "div",
      {
        className: `mx-4 mt-4 p-4 rounded-2xl border ${T.divider} bg-blue-500/10 cursor-pointer hover:bg-blue-500/20 transition-all`,
        onClick: () => {
          setBottomTab("menu");
          setMenuPanel("requests");
        }
      },
      /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center" }, /* @__PURE__ */ React.createElement(Users, { size: 18, className: "text-blue-400" })), /* @__PURE__ */ React.createElement("div", { className: "flex-1" }, /* @__PURE__ */ React.createElement("p", { className: `text-sm font-black ${T.text1}` }, pendingCount, " Friend Request", pendingCount > 1 ? "s" : ""), /* @__PURE__ */ React.createElement("p", { className: `text-xs ${T.text3}` }, "Tap to view")), /* @__PURE__ */ React.createElement("span", { className: "w-6 h-6 rounded-full bg-red-500 text-white text-xs font-black flex items-center justify-center" }, pendingCount))
    ), alerts.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "flex flex-col items-center justify-center py-20 gap-3 text-center px-6" }, /* @__PURE__ */ React.createElement("p", { className: "text-5xl" }, "\xF0\u0178\u201D\u201D"), /* @__PURE__ */ React.createElement("p", { className: `text-base font-black ${T.text3}` }, "All clear!"), /* @__PURE__ */ React.createElement("p", { className: `text-xs ${T.text3}` }, "Chat and system notifications appear here")) : /* @__PURE__ */ React.createElement("div", { className: "py-2" }, alerts.map((a) => /* @__PURE__ */ React.createElement(
      "div",
      {
        key: a.id,
        className: `flex items-start gap-3 px-4 py-3.5 hover:bg-white/5 cursor-pointer ${!a.read ? "bg-blue-500/5" : ""}`,
        onClick: () => setAlerts(
          (prev) => prev.map(
            (x) => x.id === a.id ? { ...x, read: true } : x
          )
        )
      },
      /* @__PURE__ */ React.createElement(
        "div",
        {
          className: `w-2 h-2 rounded-full mt-2 shrink-0 ${a.read ? "bg-transparent" : "bg-blue-400"}`
        }
      ),
      /* @__PURE__ */ React.createElement("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ React.createElement(
        "p",
        {
          className: `text-sm font-bold leading-snug ${T.text1}`
        },
        a.text
      ), /* @__PURE__ */ React.createElement(
        "p",
        {
          className: `text-[10px] font-medium mt-0.5 ${T.text3}`
        },
        a.time
      ))
    ))))), bottomTab === "menu" && /* @__PURE__ */ React.createElement("div", { className: `flex flex-col flex-1 overflow-hidden` }, /* @__PURE__ */ React.createElement(
      "div",
      {
        className: `flex items-center justify-between px-5 pt-5 pb-3 border-b ${T.divider} shrink-0`
      },
      /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, menuPanel !== "main" && /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: () => setMenuPanel("main"),
          className: `w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center ${T.text1}`
        },
        /* @__PURE__ */ React.createElement(ArrowLeft, { size: 16 })
      ), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", { className: `text-xl font-black ${T.text1}` }, menuPanel === "main" ? "Menu" : menuPanel === "settings" ? "Settings" : menuPanel === "archive" ? "Archive" : "Requests"))),
      /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: onClose,
          className: `w-8 h-8 rounded-xl ${panelBg} border ${T.divider} flex items-center justify-center ${T.text3}`
        },
        /* @__PURE__ */ React.createElement(X, { size: 15 })
      )
    ), menuPanel === "main" && /* @__PURE__ */ React.createElement("div", { className: "flex-1 overflow-y-auto py-4 px-4 space-y-2" }, myProfile && /* @__PURE__ */ React.createElement(
      "div",
      {
        className: `flex items-center gap-4 p-4 rounded-2xl border ${T.divider} ${panelBg} mb-4`
      },
      /* @__PURE__ */ React.createElement(
        Avatar,
        {
          url: myProfile.avatar_url,
          name: myProfile.full_name,
          size: "lg",
          online: activeStatus && !isActiveHidden
        }
      ),
      /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", { className: `text-base font-black ${T.text1}` }, myProfile.full_name), /* @__PURE__ */ React.createElement("p", { className: `text-xs ${T.text3}` }, "@", myProfile.username), myProfile.bio && /* @__PURE__ */ React.createElement("p", { className: `text-xs mt-0.5 italic ${T.text2}` }, '"', myProfile.bio, '"'), myProfile.school && /* @__PURE__ */ React.createElement("p", { className: `text-xs ${T.text3}` }, "\xF0\u0178\u017D\u201C ", myProfile.school), myProfile.location && /* @__PURE__ */ React.createElement("p", { className: `text-xs ${T.text3}` }, "\xF0\u0178\u201C\x8D ", myProfile.location))
    ), [
      {
        icon: /* @__PURE__ */ React.createElement(Settings, { size: 18 }),
        label: "Settings",
        desc: "Bio, school, location, status",
        action: () => setMenuPanel("settings")
      },
      {
        icon: /* @__PURE__ */ React.createElement("span", { className: "text-base" }, "\xF0\u0178\u2019\u2022"),
        label: "Love Protect",
        desc: loveProtectEnabled ? `\xF0\u0178\u201D\u2019 Monitoring \xE2\u20AC\u201D ${loveProtectPartnerId ? "Partner linked" : "No partner set"}` : "\xF0\u0178\u201D\u201C Guard your relationship",
        action: () => setMenuPanel("settings")
      },
      {
        icon: /* @__PURE__ */ React.createElement(Archive, { size: 18 }),
        label: "Archive",
        desc: `${archivedContactsList.length} hidden chat${archivedContactsList.length !== 1 ? "s" : ""}`,
        action: () => setMenuPanel("archive"),
        badge: 0
      },
      {
        icon: /* @__PURE__ */ React.createElement(Users, { size: 18 }),
        label: "Message Requests",
        desc: `${pendingCount} pending`,
        action: () => setMenuPanel("requests"),
        badge: pendingCount
      },
      ...isAdmin ? [
        {
          icon: /* @__PURE__ */ React.createElement(Shield, { size: 18, className: "text-amber-400" }),
          label: "Admin Dashboard",
          desc: "Moderate users & content",
          action: () => setShowAdminDashboard(true),
          badge: 0
        }
      ] : []
    ].map((item) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: item.label,
        onClick: item.action,
        className: `flex items-center justify-between w-full p-4 rounded-2xl border ${T.divider} ${panelBg} hover:bg-white/10 transition-all text-left`
      },
      /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3" }, /* @__PURE__ */ React.createElement(
        "div",
        {
          className: `w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center ${T.text2}`
        },
        item.icon
      ), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", { className: `text-sm font-black ${T.text1}` }, item.label), /* @__PURE__ */ React.createElement("p", { className: `text-[10px] ${T.text3}` }, item.desc))),
      /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, item.badge ? /* @__PURE__ */ React.createElement("span", { className: "w-5 h-5 bg-red-500 rounded-full text-white text-[10px] font-black flex items-center justify-center" }, item.badge) : null, /* @__PURE__ */ React.createElement(
        ChevronLeft,
        {
          size: 14,
          className: `rotate-180 ${T.text3}`
        }
      ))
    )), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: onLogout || onClose,
        className: "flex items-center gap-3 w-full p-4 rounded-2xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-all text-left mt-4"
      },
      /* @__PURE__ */ React.createElement("div", { className: "w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400" }, /* @__PURE__ */ React.createElement(LogOut, { size: 18 })),
      /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", { className: "text-sm font-black text-red-400" }, "Logout"), /* @__PURE__ */ React.createElement("p", { className: `text-[10px] ${T.text3}` }, "Sign out of your account"))
    )), menuPanel === "settings" && /* @__PURE__ */ React.createElement("div", { className: "flex-1 overflow-y-auto py-4 px-4 space-y-4" }, /* @__PURE__ */ React.createElement(
      "div",
      {
        className: "p-4 rounded-2xl border",
        style: {
          borderColor: loveProtectEnabled ? "rgba(244,63,94,0.55)" : "rgba(255,255,255,0.08)",
          background: loveProtectEnabled ? "linear-gradient(135deg,rgba(244,63,94,0.14) 0%,rgba(131,24,67,0.09) 100%)" : "rgba(255,255,255,0.05)"
        }
      },
      /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between mb-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-lg" }, "\xF0\u0178\u2019\u2022"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", { className: `text-sm font-black ${T.text1}` }, "Love Protect"), /* @__PURE__ */ React.createElement("p", { className: `text-[10px] ${T.text3}` }, loveProtectEnabled ? "\xF0\u0178\u201D\u2019 Monitoring active" : "\xF0\u0178\u201D\u201C Protection off"))), /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: () => {
            const next = !loveProtectEnabled;
            setLoveProtectEnabled(next);
            localStorage.setItem("cx_love_protect", String(next));
            if (!next) {
              setLoveProtectPartnerId("");
              loveProtectPartnerRef.current = "";
              supabase.from("love_protect_links").update({ is_active: false }).eq("user_id", userId ?? "").then(() => {
              });
            }
          },
          className: `relative w-12 h-6 rounded-full transition-all border ${loveProtectEnabled ? "bg-pink-500 border-pink-400" : "bg-gray-500 border-gray-400"}`
        },
        /* @__PURE__ */ React.createElement(
          "div",
          {
            className: `absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${loveProtectEnabled ? "left-6" : "left-0.5"}`
          }
        )
      )),
      /* @__PURE__ */ React.createElement(AnimatePresence, null, loveProtectEnabled && /* @__PURE__ */ React.createElement(
        motion.div,
        {
          initial: { height: 0, opacity: 0 },
          animate: { height: "auto", opacity: 1 },
          exit: { height: 0, opacity: 0 },
          className: "overflow-hidden"
        },
        /* @__PURE__ */ React.createElement("p", { className: `text-[10px] font-black uppercase tracking-wider mb-1.5 ${T.text3}` }, "Search Partner by Name"),
        /* @__PURE__ */ React.createElement("div", { className: "relative mb-2" }, /* @__PURE__ */ React.createElement(
          "input",
          {
            value: lpSearchQuery,
            onChange: (e) => {
              const q = e.target.value;
              setLpSearchQuery(q);
              if (lpSelectedName && q !== lpSelectedName) {
                setLoveProtectPartnerId("");
                setLpSelectedName("");
                loveProtectPartnerRef.current = "";
              }
              if (lpSearchRef.current) clearTimeout(lpSearchRef.current);
              if (!q.trim()) {
                setLpSearchResults([]);
                return;
              }
              setLpSearchLoading(true);
              lpSearchRef.current = setTimeout(async () => {
                const { data } = await searchVisibleProfiles(q, 6);
                setLpSearchResults(data || []);
                setLpSearchLoading(false);
              }, 350);
            },
            placeholder: "Type your partner's name\xE2\u20AC\xA6",
            className: `w-full rounded-xl px-3 py-2.5 text-sm font-semibold outline-none border focus:ring-2 focus:ring-pink-500/30 ${T.searchBg}`
          }
        ), lpSearchLoading && /* @__PURE__ */ React.createElement(Loader2, { size: 13, className: "absolute right-3 top-3 animate-spin text-pink-400" })),
        lpSearchResults.length > 0 && !loveProtectPartnerId && /* @__PURE__ */ React.createElement("div", { className: `rounded-xl border ${T.divider} overflow-hidden mb-2` }, lpSearchResults.map((p) => /* @__PURE__ */ React.createElement(
          "button",
          {
            key: p.id,
            type: "button",
            onClick: (e) => {
              e.stopPropagation();
              setLoveProtectPartnerId(p.id);
              loveProtectPartnerRef.current = p.id;
              setLpSelectedName(p.full_name || p.username || "");
              setLpSearchQuery(p.full_name || p.username || "");
              setLpSearchResults([]);
            },
            className: `w-full flex items-center gap-3 px-3 py-2.5 hover:bg-pink-500/10 text-left transition-all`
          },
          p.avatar_url ? /* @__PURE__ */ React.createElement("img", { src: p.avatar_url, alt: "", className: "w-8 h-8 rounded-full object-cover shrink-0" }) : /* @__PURE__ */ React.createElement("div", { className: "w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center text-[11px] font-black text-pink-400 shrink-0" }, (p.full_name || p.username || "?")[0].toUpperCase()),
          /* @__PURE__ */ React.createElement("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ React.createElement("p", { className: `text-sm font-black truncate ${T.text1}` }, p.full_name || p.username), /* @__PURE__ */ React.createElement("p", { className: `text-[10px] truncate ${T.text3}` }, "@", p.username))
        ))),
        loveProtectPartnerId && lpSelectedName && /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 mb-2 px-3 py-2 rounded-xl bg-pink-500/10 border border-pink-500/30" }, /* @__PURE__ */ React.createElement("span", { className: "text-pink-400 text-sm" }, "\xF0\u0178\u2019\u2022"), /* @__PURE__ */ React.createElement("p", { className: `text-sm font-black flex-1 text-pink-300` }, lpSelectedName), /* @__PURE__ */ React.createElement(
          "button",
          {
            type: "button",
            onClick: (e) => {
              e.stopPropagation();
              setLoveProtectPartnerId("");
              setLpSelectedName("");
              setLpSearchQuery("");
              setLpSearchResults([]);
              loveProtectPartnerRef.current = "";
            },
            className: "text-pink-400/60 hover:text-pink-400 transition-colors"
          },
          /* @__PURE__ */ React.createElement(X, { size: 14 })
        )),
        /* @__PURE__ */ React.createElement(
          "button",
          {
            type: "button",
            onClick: async (e) => {
              e.stopPropagation();
              e.preventDefault();
              const pid = loveProtectPartnerId.trim();
              if (!pid || !userId) {
                toast.error("Please select a partner from the search results first.");
                return;
              }
              setSavingLoveProtect(true);
              const { error } = await supabase.from("love_protect_links").upsert(
                { user_id: userId, partner_id: pid, is_active: true },
                { onConflict: "user_id" }
              );
              setSavingLoveProtect(false);
              if (error) {
                toast.error("Failed to link partner. Please try again.");
              } else {
                setLoveProtectInput(pid);
                toast.success("\xF0\u0178\u2019\u2022 Love Protect linked!");
              }
            },
            disabled: savingLoveProtect || !loveProtectPartnerId.trim() || loveProtectPartnerId.trim() === loveProtectInput,
            className: "w-full py-2.5 rounded-xl text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50",
            style: { background: "linear-gradient(135deg,#f43f5e,#be185d)" }
          },
          savingLoveProtect ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Loader2, { size: 13, className: "animate-spin" }), " Linking\xE2\u20AC\xA6") : loveProtectInput && loveProtectPartnerId === loveProtectInput ? "\xE2\u0153\u2026 Linked" : "\xF0\u0178\u201D\u2014 Link Partner"
        ),
        loveProtectPartnerId && /* @__PURE__ */ React.createElement(
          "button",
          {
            type: "button",
            onClick: async (e) => {
              e.stopPropagation();
              console.log("[LoveProtect] Manual test triggered for:", loveProtectPartnerId);
              const violated = await checkLoveProtectViolation(loveProtectPartnerId);
              console.log("[LoveProtect] Manual test result:", violated);
              if (loveProtectTimerRef.current) clearTimeout(loveProtectTimerRef.current);
              setLoveProtectAlert(true);
              loveProtectTimerRef.current = setTimeout(() => setLoveProtectAlert(false), 15e3);
              toast.info(
                violated ? "\xF0\u0178\u2019\u201D Violation detected \xE2\u20AC\u201D alert is now visible!" : "\xE2\u0153\u2026 No violation yet. Alert shown for UI test (check console for DB result)."
              );
            },
            className: "w-full mt-2 py-2 rounded-xl border border-pink-500/40 text-pink-400 font-black text-xs flex items-center justify-center gap-1.5 hover:bg-pink-500/10 transition-all"
          },
          "\xF0\u0178\xA7\xAA Test Alert Now"
        ),
        /* @__PURE__ */ React.createElement("p", { className: `text-[10px] mt-2 leading-relaxed ${T.text3}` }, "If your partner sends romantic messages to multiple people within 1 hour, you'll receive a private system alert \xE2\u20AC\u201D no chat content is revealed.")
      ))
    ), /* @__PURE__ */ React.createElement(
      "div",
      {
        className: `p-4 rounded-2xl border ${T.divider} bg-white/5`
      },
      /* @__PURE__ */ React.createElement(
        "p",
        {
          className: `text-xs font-black uppercase tracking-widest mb-3 ${T.text3}`
        },
        "Chat Theme"
      ),
      /* @__PURE__ */ React.createElement("div", { className: "flex gap-3" }, ["dairy-notebook", "maroon", "whatsapp", "comic"].map((t) => /* @__PURE__ */ React.createElement(
        "button",
        {
          key: t,
          type: "button",
          onClick: (e) => {
            e.stopPropagation();
            setTheme(t);
          },
          className: `flex-1 py-3 rounded-2xl border-2 transition-all font-black text-xs ${theme === t ? `border-[#E3FF00] bg-[#E3FF00]/10 ${T.text1}` : `border-transparent ${panelBg} ${T.text3}`}`
        },
        /* @__PURE__ */ React.createElement("div", { className: "text-xl mb-1" }, THEME_CFG[t].icon),
        THEME_CFG[t].label
      )))
    ), /* @__PURE__ */ React.createElement(
      "div",
      {
        className: `p-4 rounded-2xl border ${T.divider} ${panelBg}`
      },
      /* @__PURE__ */ React.createElement(
        "p",
        {
          className: `text-xs font-black uppercase tracking-widest mb-3 ${T.text3}`
        },
        "Active Status"
      ),
      /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", { className: `text-sm font-black ${T.text1}` }, "Active Status"), /* @__PURE__ */ React.createElement("p", { className: `text-xs ${T.text3}` }, activeStatus && !isActiveHidden ? "You appear Online \xF0\u0178\u0178\xA2" : "You appear Offline \xF0\u0178\u201D\xB4")), /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: () => setActiveStatus(!activeStatus),
          className: `relative w-12 h-6 rounded-full transition-all border ${activeStatus && !isActiveHidden ? "bg-green-500 border-green-400" : "bg-gray-500 border-gray-400"}`
        },
        /* @__PURE__ */ React.createElement(
          "div",
          {
            className: `absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${activeStatus && !isActiveHidden ? "left-6" : "left-0.5"}`
          }
        )
      ))
    ), /* @__PURE__ */ React.createElement(
      "div",
      {
        className: `p-4 rounded-2xl border ${T.divider} ${panelBg}`
      },
      /* @__PURE__ */ React.createElement(
        "p",
        {
          className: `text-xs font-black uppercase tracking-widest mb-3 ${T.text3}`
        },
        "Notification Sound"
      ),
      /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", { className: `text-sm font-black ${T.text1}` }, "Message Sounds"), /* @__PURE__ */ React.createElement("p", { className: `text-xs ${T.text3}` }, soundEnabled ? "\xF0\u0178\u201D\u0160 Sound On \xE2\u20AC\u201D ping on message" : "\xF0\u0178\u201D\u2021 Muted \xE2\u20AC\u201D no sound")), /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: () => setSoundEnabled((s) => !s),
          className: `relative w-12 h-6 rounded-full transition-all border ${soundEnabled ? "bg-blue-500 border-blue-400" : "bg-gray-500 border-gray-400"}`
        },
        /* @__PURE__ */ React.createElement(
          "div",
          {
            className: `absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${soundEnabled ? "left-6" : "left-0.5"}`
          }
        )
      ))
    ), /* @__PURE__ */ React.createElement(
      "div",
      {
        className: `p-4 rounded-2xl border ${T.divider} bg-white/5`
      },
      /* @__PURE__ */ React.createElement(
        "p",
        {
          className: `text-xs font-black uppercase tracking-widest mb-3 ${T.text3}`
        },
        "Personal Info"
      ),
      /* @__PURE__ */ React.createElement("div", { className: "space-y-3" }, [
        {
          icon: /* @__PURE__ */ React.createElement(Info, { size: 14 }),
          label: "Bio",
          value: editBio,
          setter: setEditBio,
          placeholder: "Write a short bio..."
        },
        {
          icon: /* @__PURE__ */ React.createElement(GraduationCap, { size: 14 }),
          label: "School",
          value: editSchool,
          setter: setEditSchool,
          placeholder: "Your school or college..."
        },
        {
          icon: /* @__PURE__ */ React.createElement(MapPin, { size: 14 }),
          label: "Location",
          value: editLocation,
          setter: setEditLocation,
          placeholder: "City, Country..."
        }
      ].map((f) => /* @__PURE__ */ React.createElement("div", { key: f.label }, /* @__PURE__ */ React.createElement(
        "p",
        {
          className: `text-[10px] font-black uppercase tracking-wider mb-1.5 flex items-center gap-1 ${T.text3}`
        },
        f.icon,
        " ",
        f.label
      ), /* @__PURE__ */ React.createElement(
        "input",
        {
          value: f.value,
          onChange: (e) => f.setter(e.target.value),
          placeholder: f.placeholder,
          className: `w-full rounded-xl px-3 py-2.5 text-sm font-semibold outline-none border focus:ring-2 focus:ring-blue-500/30 ${T.searchBg}`
        }
      ))), /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: saveProfileSettings,
          disabled: savingProfile,
          className: `w-full py-3 rounded-2xl text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60 ${T.accent}`
        },
        savingProfile ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Loader2, { size: 14, className: "animate-spin" }), " ", "Saving...") : "Save Changes"
      ))
    )), menuPanel === "archive" && /* @__PURE__ */ React.createElement("div", { className: "flex-1 overflow-y-auto" }, archivedContactsList.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "flex flex-col items-center justify-center py-20 gap-3 text-center px-6" }, /* @__PURE__ */ React.createElement("p", { className: "text-5xl" }, "\xF0\u0178\u201C\xA6"), /* @__PURE__ */ React.createElement("p", { className: `text-base font-black ${T.text3}` }, "No hidden chats"), /* @__PURE__ */ React.createElement("p", { className: `text-xs ${T.text3}` }, "Use 3-dot menu on a chat to hide it here")) : /* @__PURE__ */ React.createElement("div", { className: "py-2" }, /* @__PURE__ */ React.createElement(
      "p",
      {
        className: `text-[10px] font-black uppercase tracking-widest px-5 pt-3 pb-1 ${T.text3}`
      },
      "Hidden Chats (",
      archivedContactsList.length,
      ")"
    ), archivedContactsList.map((c) => /* @__PURE__ */ React.createElement(
      "div",
      {
        key: c.id,
        className: "flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 cursor-pointer",
        onClick: () => {
          handleSelectContact(c);
          setBottomTab("chat");
          setMenuPanel("main");
        }
      },
      /* @__PURE__ */ React.createElement(Avatar, { url: c.avatar_url, name: c.full_name }),
      /* @__PURE__ */ React.createElement("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ React.createElement(
        "p",
        {
          className: `text-sm font-black truncate ${T.text1}`
        },
        c.full_name
      ), /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-1" }, /* @__PURE__ */ React.createElement(
        "p",
        {
          className: `text-xs truncate flex-1 ${(c.unread_count ?? 0) > 0 ? `font-semibold ${T.text1}` : T.text3}`
        },
        lastMsgPreview(c) || "No messages"
      ), (c.unread_count ?? 0) > 0 && /* @__PURE__ */ React.createElement("span", { className: "shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center leading-none" }, (c.unread_count ?? 0) > 99 ? "99+" : c.unread_count))),
      /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: (e) => {
            e.stopPropagation();
            toggleArchive(c.id);
          },
          className: `flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black ${T.pill}`
        },
        /* @__PURE__ */ React.createElement(Eye, { size: 11 }),
        " Unhide"
      )
    )))), menuPanel === "requests" && /* @__PURE__ */ React.createElement("div", { className: "flex-1 overflow-y-auto" }, pendingRequests.length === 0 && messageRequests.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "flex flex-col items-center justify-center py-20 gap-3 text-center px-6" }, /* @__PURE__ */ React.createElement("p", { className: "text-5xl" }, "\xF0\u0178\u201C\xA8"), /* @__PURE__ */ React.createElement("p", { className: `text-base font-black ${T.text3}` }, "No requests"), /* @__PURE__ */ React.createElement("p", { className: `text-xs ${T.text3}` }, "Friend requests and messages from people you don't know appear here")) : /* @__PURE__ */ React.createElement("div", { className: "py-2" }, messageRequests.length > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
      "p",
      {
        className: `text-[10px] font-black uppercase tracking-widest px-5 pt-3 pb-1 ${T.text3}`
      },
      "Message Requests (",
      messageRequests.length,
      ")"
    ), messageRequests.map((c) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: `mr-${c.id}`,
        onClick: () => handleSelectContact(c),
        className: "w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-left"
      },
      /* @__PURE__ */ React.createElement(Avatar, { url: c.avatar_url, name: c.full_name }),
      /* @__PURE__ */ React.createElement("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ React.createElement(
        "p",
        {
          className: `text-sm font-black truncate ${T.text1}`
        },
        c.full_name
      ), /* @__PURE__ */ React.createElement(
        "p",
        {
          className: `text-[11px] truncate ${T.text3}`
        },
        c.last_message || "Sent you a message"
      )),
      (c.unread_count || 0) > 0 && /* @__PURE__ */ React.createElement(
        "div",
        {
          className: `w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center text-white ${T.accent}`
        },
        c.unread_count
      )
    ))), pendingRequests.length > 0 && /* @__PURE__ */ React.createElement(
      "p",
      {
        className: `text-[10px] font-black uppercase tracking-widest px-5 pt-3 pb-1 ${T.text3}`
      },
      "Incoming Friend Requests (",
      pendingCount,
      ")"
    ), pendingRequests.map((req) => {
      const busy = actionLoading === req.id;
      return /* @__PURE__ */ React.createElement(
        motion.div,
        {
          key: req.id,
          initial: { opacity: 0, x: -10 },
          animate: { opacity: 1, x: 0 },
          className: "flex items-center gap-3 px-4 py-3.5 hover:bg-white/5"
        },
        /* @__PURE__ */ React.createElement(
          Avatar,
          {
            url: req.profile.avatar_url,
            name: req.profile.full_name
          }
        ),
        /* @__PURE__ */ React.createElement("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ React.createElement(
          "p",
          {
            className: `text-sm font-black truncate ${T.text1}`
          },
          req.profile.full_name
        ), /* @__PURE__ */ React.createElement("p", { className: `text-[10px] ${T.text3}` }, "@", req.profile.username)),
        /* @__PURE__ */ React.createElement("div", { className: "flex gap-1.5 shrink-0" }, /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => acceptRequest(req),
            disabled: busy,
            className: "w-9 h-9 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center text-green-400 hover:bg-green-500/40 disabled:opacity-40"
          },
          busy ? /* @__PURE__ */ React.createElement(
            Loader2,
            {
              size: 13,
              className: "animate-spin"
            }
          ) : /* @__PURE__ */ React.createElement(Check, { size: 13 })
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => rejectRequest(req),
            disabled: busy,
            className: "w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/20 disabled:opacity-40"
          },
          /* @__PURE__ */ React.createElement(X, { size: 13 })
        ))
      );
    }))))),
    !selectedUser && /* @__PURE__ */ React.createElement(
      "div",
      {
        className: `shrink-0 border-t ${T.nav} ${T.divider}`,
        style: { zIndex: 60 }
      },
      /* @__PURE__ */ React.createElement("div", { className: "flex items-center px-2 pb-safe" }, [
        {
          tab: "chat",
          icon: /* @__PURE__ */ React.createElement(MessageSquare, { size: 22 }),
          label: "Chat",
          badge: 0
        },
        {
          tab: "story",
          icon: /* @__PURE__ */ React.createElement(BookOpen, { size: 22 }),
          label: "Story",
          badge: 0
        },
        {
          tab: "alert",
          icon: /* @__PURE__ */ React.createElement(Bell, { size: 22 }),
          label: "Alert",
          badge: unreadAlerts
        },
        {
          tab: "menu",
          icon: /* @__PURE__ */ React.createElement(LayoutGrid, { size: 22 }),
          label: "Menu",
          badge: pendingCount
        }
      ].map(({ tab, icon, label, badge }) => /* @__PURE__ */ React.createElement(
        "button",
        {
          key: tab,
          onClick: (e) => {
            e.stopPropagation();
            e.preventDefault();
            setBottomTab(tab);
            if (tab !== "menu") setMenuPanel("main");
          },
          className: `flex-1 flex flex-col items-center gap-1 py-3.5 transition-all relative ${bottomTab === tab ? T.accentText : T.text3}`
        },
        /* @__PURE__ */ React.createElement(
          "div",
          {
            className: `relative transition-transform ${bottomTab === tab ? "scale-110" : "scale-100"}`
          },
          icon,
          badge > 0 && /* @__PURE__ */ React.createElement("span", { className: "absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] font-black flex items-center justify-center" }, badge > 9 ? "9+" : badge)
        ),
        /* @__PURE__ */ React.createElement(
          "span",
          {
            className: `text-[10px] font-black uppercase tracking-widest ${bottomTab === tab ? T.accentText : T.text3}`
          },
          label
        ),
        bottomTab === tab && /* @__PURE__ */ React.createElement(
          motion.div,
          {
            layoutId: "nav-indicator",
            className: `absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full ${T.accent}`
          }
        )
      )))
    ),
    /* @__PURE__ */ React.createElement(AnimatePresence, null, showAdminDashboard && isAdmin && /* @__PURE__ */ React.createElement(
      AdminDashboard,
      {
        onClose: () => setShowAdminDashboard(false),
        currentUserId: userId,
        currentUserEmail: userEmail
      }
    )),
    /* @__PURE__ */ React.createElement(
      StickerDrawer,
      {
        isOpen: showStickerDrawer,
        onClose: () => setShowStickerDrawer(false),
        onStickerSelect: sendSticker
      }
    )
  ));
};
export default React.memo(ChatSystem);
//# sourceMappingURL=out.js.map
