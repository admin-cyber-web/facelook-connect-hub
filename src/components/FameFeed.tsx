import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabaseClient";
import { smartTime } from "../lib/timeAgo";
import { useOnlineUsers } from "../context/OnlineUsersContext";
import { memGet, memSet } from "../lib/memCache";
import { toast } from "sonner";
import { ReactionBar, ReactionBubbles } from "./ReactionBar";
import { ErrorBoundary } from "./ErrorBoundary";
import { MagnetButton, PostVoiceStrip, MagnetVoice } from "./MagnetSystem";
import { useSoundEffects } from "../hooks/useSoundEffects";
import { useProfileViewer } from "../context/ProfileViewerContext";
import { useDataCache } from "../context/DataCacheContext";
import { isAdminEmail } from "../lib/adminConfig";
import AdsterraAd from "./AdsterraAd";
import PeopleYouMayKnow from "./PeopleYouMayKnow";
import NewInYourArea from "./NewInYourArea";
import type { LocalProfile } from "../lib/recommendationEngine";
import { sharePost } from "../lib/sharePost";
import { RichCaption } from "./RichCaption";
import AutoPlayMutedVideo from "./AutoPlayMutedVideo";
import { maskProfanity, sanitizeText } from "../lib/profanityFilter";
import { resolveMediaUrl } from "../lib/mediaUrl";
import {
  Send,
  Heart,
  MessageCircle,
  Share2,
  MoreVertical,
  Loader2,
  Trash2,
  EyeOff,
  Flag,
  X,
  Volume2,
  VolumeX,
  Image as ImageIcon,
  Play,
  Users,
  Film,
  Plus,
  Eye,
  SmilePlus,
  Ban,
  ShieldOff,
  Check,
  Link2,
  TrendingUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SharePopup, { type SharePostData, type ShareAnchor, type ShareMode } from "./SharePopup";

// ── Reaction config ─────────────────────────────────────────────────────────
const REACTIONS = [
  { type: "like", emoji: "👍", label: "Like" },
  { type: "fire", emoji: "🔥", label: "Fire" },
  { type: "haha", emoji: "😂", label: "Haha" },
  { type: "wow", emoji: "😮", label: "Wow" },
  { type: "sad", emoji: "😢", label: "Sad" },
  { type: "angry", emoji: "😡", label: "Angry" },
];
// keep legacy "love" reactions (❤️) rendering correctly
const reactionEmoji = (type?: string) => {
  if (type === "love") return "❤️";
  return REACTIONS.find((r) => r.type === type)?.emoji ?? "👍";
};

// ── PostViewTracker — fires onView once when post scrolls into view ─────────
const PostViewTracker = memo(({
  postId,
  onView,
  children,
}: {
  postId: string;
  onView: (id: string) => void;
  children: React.ReactNode;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const fired = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !fired.current) {
          fired.current = true;
          onView(postId);
        }
      },
      { threshold: 0.5 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [postId, onView]);
  return <div ref={ref}>{children}</div>;
});

// ── Inline video ───────────────────────────────────────────────────────────────
const FeedVideo = memo(({ src }: { src: string }) => {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!ref.current) return;
        if (entry.isIntersecting) {
          ref.current.muted = false;
          ref.current.play().catch(() => {
            if (ref.current) {
              ref.current.muted = true;
              setMuted(true);
              ref.current.play().catch(() => {});
            }
          });
        } else {
          ref.current.pause();
        }
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [src]);
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!ref.current) return;
    ref.current.muted = !ref.current.muted;
    setMuted(ref.current.muted);
  };
  return (
    <div
      className="relative w-full bg-black"
      style={{ aspectRatio: "9/16", maxHeight: "85vh" }}
    >
      <video
        ref={ref}
        src={src}
        loop
        muted={muted}
        playsInline
        className="w-full h-full object-cover"
       preload="none"/>
      <button
        onClick={toggle}
        className="absolute bottom-3 right-3 p-2 bg-black/75 rounded-full border border-white/15"
      >
        {muted ? (
          <VolumeX size={16} className="text-red-400" />
        ) : (
          <Volume2 size={16} className="text-blue-500" />
        )}
      </button>
    </div>
  );
});

// ── YouTube embed ──────────────────────────────────────────────────────────────
const YouTubeEmbed = memo(({ url }: { url: string }) => {
  const m = url.match(
    /^.*(youtu.be\/|v\/|embed\/|watch\?v=|\/shorts\/)([^#&?]*).*/,
  );
  const id = m?.[2]?.length === 11 ? m[2] : null;
  if (!id) return null;
  return (
    <div className="w-full bg-black" style={{ aspectRatio: "16/9" }}>
      <iframe
        src={`https://www.youtube.com/embed/${id}?controls=1&modestbranding=1`}
        className="w-full h-full"
        allow="accelerometer; autoplay; encrypted-media"
        title="Video"
      />
    </div>
  );
});

// ── Smart media renderer ───────────────────────────────────────────────────────
const PostMedia = memo(({ post }: { post: any }) => {
  const url = post.media_url || post.image_url || post.cover_url || null;
  if (!url) return null;
  const isYT =
    post.metadata?.is_youtube ||
    url.includes("youtube.com") ||
    url.includes("youtu.be");
  if (isYT) return <YouTubeEmbed url={url} />;
  const isVid =
    post.type === "video" ||
    /\.(mp4|webm|ogg|mov|m4v)/i.test(url.split("?")[0]) ||
    url.includes("rapidcdn.app");
  if (isVid) return <FeedVideo src={url} />;
  return (
    <div className="w-full bg-black">
      <img
        src={url}
        loading="lazy"
        className="w-full object-cover"
        style={{ maxHeight: "70vh" }}
        alt=""
       decoding="async"/>
    </div>
  );
});

// ── Mobile detection — used for Lite mode throughout FameFeed ────────────────
const IS_MOBILE = typeof navigator !== "undefined" &&
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

// ── Post caption — 2-line clamp + "...more" toggle ────────────────────────────
const CLAMP_THRESHOLD = 90;

const PostCaption = memo(({ content }: { content: string }) => {
  const [expanded, setExpanded] = useState(false);
  const isLong = content.length > CLAMP_THRESHOLD;
  return (
    <div className="px-4 pb-2">
      <p
        className={`text-[15px] font-semibold text-white leading-relaxed whitespace-pre-wrap break-words ${!expanded && isLong ? "line-clamp-2" : ""}`}
      >
        {content}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-blue-600 text-[12px] font-semibold mt-0.5"
        >
          {expanded ? "...less" : "...more"}
        </button>
      )}
    </div>
  );
});

// ── Static Demo Hindi Circles (forceful inject — always show) ─────────────────
const DEMO_HINDI_CIRCLES = [
  {
    id: "demo-yaaden",
    name: "Yaaden",
    created_by_name: "Rahul Sharma",
    cover_url:
      "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&q=80",
    member_count: 1284,
    description: "Purani yaadein, naye andaaz mein",
  },
  {
    id: "demo-tum-bin",
    name: "Tum Bin",
    created_by_name: "Anjali Singh",
    cover_url:
      "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&q=80",
    member_count: 2341,
    description: "Ishq ki barishon mein bheeg jao",
  },
  {
    id: "demo-apna-circle",
    name: "Apna Circle",
    created_by_name: "Amit Patel",
    cover_url:
      "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&q=80",
    member_count: 3102,
    description: "Dosti, hansi aur yaarana",
  },
  {
    id: "demo-barsaate",
    name: "Barsaate",
    created_by_name: "Priya Verma",
    cover_url:
      "https://images.unsplash.com/photo-1501691223387-dd0500403074?w=400&q=80",
    member_count: 876,
    description: "Baarish ke mausam ki baatein",
  },
  {
    id: "demo-aawaz",
    name: "Aawaz",
    created_by_name: "Vikram Malhotra",
    cover_url:
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&q=80",
    member_count: 4567,
    description: "Sangeet ki duniya, apni aawaz",
  },
  {
    id: "demo-hasi",
    name: "Hasi ka Khajana",
    created_by_name: "Sneha Kapoor",
    cover_url:
      "https://images.unsplash.com/photo-1527224857830-43a7acc85260?w=400&q=80",
    member_count: 5890,
    description: "Roz ek naya thumka, roz naya joke",
  },
  {
    id: "demo-timepass",
    name: "Time Pass",
    created_by_name: "Sandeep Joshi",
    cover_url:
      "https://images.unsplash.com/photo-1614294149010-950b698f72c0?w=400&q=80",
    member_count: 2198,
    description: "Chill karo, game karo, hangout karo",
  },
];

// ── Demo Circles Row (cinematic, same card size as Trending Flicks) ────────────
const DemoCirclesRow = memo(({ onCircleClick }: { onCircleClick: () => void }) => (
  <div
    className="border-b border-white/5 pt-2 pb-1"
    style={{ background: "#0F172A" }}
  >
    <p className="text-[13px] font-black text-white/70 px-4 mb-2 tracking-wide">
      👥 Trending Circles
    </p>
    <div className="flex gap-3 overflow-x-auto px-4 pb-2 no-scrollbar">
      {DEMO_HINDI_CIRCLES.map((circle) => (
        <motion.div
          key={circle.id}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={onCircleClick}
          className="flex-shrink-0 relative rounded-2xl overflow-hidden cursor-pointer select-none shadow-md"
          style={{ width: 168, height: 312 }}
        >
          {/* Cinematic cover image */}
          <img
            src={circle.cover_url}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            alt={circle.name}
           decoding="async"/>
          {/* Cinematic gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
          {/* Top badge */}
          <div className="absolute top-2.5 left-2.5">
            <span className="bg-black/65 border border-white/30 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
              Circle
            </span>
          </div>
          {/* Member count badge top-right */}
          <div className="absolute top-2.5 right-2.5 flex items-center gap-0.5 bg-black/70 rounded-full px-2 py-0.5 border border-white/20">
            <Users size={9} className="text-white/80" />
            <span className="text-white text-[9px] font-bold">
              {circle.member_count >= 1000
                ? `${(circle.member_count / 1000).toFixed(1)}K`
                : circle.member_count}
            </span>
          </div>
          {/* Bottom info */}
          <div className="absolute bottom-0 left-0 right-0 px-3 py-3">
            <p className="text-white text-[13px] font-black leading-tight truncate drop-shadow-lg">
              {circle.name}
            </p>
            <p className="text-white/70 text-[10px] font-medium leading-tight mt-0.5 truncate">
              {circle.description}
            </p>
            <p
              style={{
                fontSize: 10,
                color: "#34d399",
                fontStyle: "italic",
                fontFamily: "Georgia, serif",
                fontWeight: 700,
                marginTop: 4,
                letterSpacing: "0.03em",
              }}
            >
              ✦ by {circle.created_by_name}
            </p>
            {/* Join button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCircleClick();
              }}
              className="mt-2 w-full py-2 rounded-xl text-[11px] font-black text-white active:scale-95 transition-all"
              style={{
                background: "linear-gradient(135deg, #00c853, #00e676)",
                color: "#003300",
                boxShadow: "0 0 12px rgba(0,200,83,0.45)",
              }}
            >
              ⭕ Join Circle
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  </div>
));

// ── Demo Hook Pages (fallback when DB has no hook_pages yet) ───────────────────
const DEMO_HOOK_PAGES = [
  {
    id: "demo-hp-1",
    name: "Bollywood Beats",
    category: "Music",
    cover_url:
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&q=80",
    follower_count: 4200,
    owner_name: "DJ Rahul",
  },
  {
    id: "demo-hp-2",
    name: "Fitness Zone",
    category: "Health",
    cover_url:
      "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&q=80",
    follower_count: 8100,
    owner_name: "Coach Priya",
  },
  {
    id: "demo-hp-3",
    name: "Tech Talks India",
    category: "Technology",
    cover_url:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&q=80",
    follower_count: 3500,
    owner_name: "Amit Dev",
  },
  {
    id: "demo-hp-4",
    name: "Art Studio",
    category: "Art",
    cover_url:
      "https://images.unsplash.com/photo-1547826039-bfc35e0f1ea8?w=400&q=80",
    follower_count: 6700,
    owner_name: "Sneha Arts",
  },
  {
    id: "demo-hp-5",
    name: "Cricket Fever",
    category: "Sports",
    cover_url:
      "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=400&q=80",
    follower_count: 12000,
    owner_name: "Cricket Fan",
  },
];

// ── Demo Hook Pages Row (shown when no real hook_pages in DB yet) ──────────────
const DemoHookPagesRow = ({ onPageClick }: { onPageClick: () => void }) => (
  <div
    className="border-b border-white/5 pt-3 pb-1"
    style={{ background: "#0F172A" }}
  >
    <div className="flex items-center justify-between px-4 mb-2">
      <p className="text-[13px] font-black text-white/70 tracking-wide">
        ⚡ Hook Pages — Discover
      </p>
      <button
        onClick={onPageClick}
        className="text-[10px] font-black text-orange-500 uppercase tracking-wider"
      >
        See All →
      </button>
    </div>
    <div className="flex gap-3 overflow-x-auto px-4 pb-2 no-scrollbar">
      {DEMO_HOOK_PAGES.map((page) => (
        <motion.div
          key={page.id}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={onPageClick}
          className="flex-shrink-0 relative rounded-2xl overflow-hidden cursor-pointer select-none shadow-md"
          style={{ width: 168, height: 312 }}
        >
          <img
            src={page.cover_url}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            alt={page.name}
           decoding="async"/>
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
          <div className="absolute top-2.5 left-2.5">
            <span className="bg-black/65 border border-white/30 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
              ⚡ Page
            </span>
          </div>
          <div className="absolute top-2.5 right-2.5 flex items-center gap-0.5 bg-black/70 rounded-full px-2 py-0.5 border border-white/20">
            <Users size={9} className="text-white/80" />
            <span className="text-white text-[9px] font-bold">
              {page.follower_count >= 1000
                ? `${(page.follower_count / 1000).toFixed(1)}K`
                : page.follower_count}
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 px-3 py-3">
            <p className="text-white text-[13px] font-black leading-tight truncate drop-shadow-lg">
              {page.name}
            </p>
            <p className="text-white/70 text-[10px] font-medium leading-tight mt-0.5 truncate">
              {page.category}
            </p>
            <p
              style={{
                fontSize: 10,
                color: "#34d399",
                fontStyle: "italic",
                fontFamily: "Georgia, serif",
                fontWeight: 700,
                marginTop: 4,
                letterSpacing: "0.03em",
              }}
            >
              ✦ by {page.owner_name}
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPageClick();
              }}
              className="mt-2 w-full py-2 rounded-xl text-[11px] font-black active:scale-95 transition-all"
              style={{
                background: "linear-gradient(135deg, #ff6b00, #ff9500)",
                color: "#fff",
                boxShadow: "0 0 12px rgba(255,107,0,0.45)",
              }}
            >
              ⚡ HOOK
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  </div>
);

// ── Trending Flicks Row (real data, real-time) ─────────────────────────────────
const FLICK_GRADS = [
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
  "#f97316",
  "#84cc16",
];

// ── Latest Surveys Widget ──────────────────────────────────────────────────────
// ── Survey image with built-in fallback & URL sanitisation ────────────────────
const SurveyThumb = ({ rawUrl, question }: { rawUrl: string | null; question: string }) => {
  const [errored, setErrored] = useState(false);
  // Trim the URL and resolve via the shared helper (handles Supabase paths + absolute URLs)
  // surveys bucket: https://rxwvvhvretostbiknuek.supabase.co/storage/v1/object/public/surveys/<filename>
  const resolved = rawUrl?.trim() ? resolveMediaUrl(rawUrl.trim(), "surveys") : null;
  const showImg  = resolved && !errored && resolved !== "/placeholder-avatar.png";

  return (
    /* Fixed-height container — layout NEVER shifts while loading */
    <div className="w-full aspect-video rounded-lg overflow-hidden bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 relative">
      {showImg ? (
        <img
          src={resolved}
          alt={question}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover rounded-lg"
          onError={() => setErrored(true)}
        />
      ) : (
        /* Fallback — pretty gradient tile with emoji */
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 select-none">
          <span className="text-4xl">🗳️</span>
          <span className="text-white/30 text-[10px] font-bold uppercase tracking-widest">Survey</span>
        </div>
      )}
    </div>
  );
};

const LatestSurveysWidget = ({
  currentUserId,
  onNavigateToSurveys,
}: {
  currentUserId: string;
  onNavigateToSurveys?: () => void;
}) => {
  const [surveys, setSurveys]         = useState<any[]>([]);
  const [loaded, setLoaded]           = useState(false);
  const [voteCounts, setVoteCounts]   = useState<Record<string, Record<string, number>>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("surveys")
        .select("id, question, image_url, media_url, user_id, created_at, survey_options(id, text)")
        .order("created_at", { ascending: false })
        .limit(3);
      if (cancelled) return;
      setSurveys(data || []);
      setLoaded(true);
      if (data && data.length > 0) {
        const ids = data.map((s: any) => s.id);
        const { data: votes } = await supabase
          .from("votes")
          .select("survey_id, option_id")
          .in("survey_id", ids);
        if (!cancelled && votes) {
          const map: Record<string, Record<string, number>> = {};
          votes.forEach((v: any) => {
            if (!map[v.survey_id]) map[v.survey_id] = {};
            map[v.survey_id][v.option_id] = (map[v.survey_id][v.option_id] || 0) + 1;
          });
          setVoteCounts(map);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!loaded || surveys.length === 0) return null;

  return (
    <div className="pt-3 pb-2 border-b border-white/5" style={{ background: "#0F172A" }}>
      {/* Section header */}
      <div className="flex items-center justify-between px-4 mb-3">
        <p className="text-[13px] font-black text-white/70 tracking-wide">🗳️ Latest Surveys</p>
        {onNavigateToSurveys && (
          <button
            onClick={onNavigateToSurveys}
            className="text-[11px] font-bold text-indigo-400/70 hover:text-indigo-400 transition-colors">
            See all →
          </button>
        )}
      </div>

      {/* Cards — horizontal scroll on mobile, single column on md+ */}
      <div className="flex gap-3 overflow-x-auto px-4 pb-2 no-scrollbar sm:flex-col sm:overflow-x-visible sm:gap-2">
        {surveys.map((survey, idx) => (
          <motion.div
            key={survey.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.07 }}
            onClick={onNavigateToSurveys}
            className="flex-shrink-0 w-56 sm:w-full rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>

            {/* ── Image banner (full-width, fixed aspect-ratio, object-cover) ── */}
            <SurveyThumb rawUrl={survey.image_url || survey.media_url} question={survey.question} />

            {/* ── Card body ── */}
            <div className="px-3 py-2.5">
              <p className="text-white text-[12px] font-bold leading-snug line-clamp-2 mb-2">
                {survey.question}
              </p>

              {/* ── Vote progress bars (only if votes exist) ── */}
              {(() => {
                const opts: any[] = (survey.survey_options || []).slice(0, 2);
                const counts = voteCounts[survey.id] || {};
                const total  = Object.values(counts).reduce((a: number, b: number) => a + b, 0);
                if (!opts.length || total === 0) return null;
                return (
                  <div className="mb-2.5 flex flex-col gap-1">
                    {opts.map((opt: any) => {
                      const pct = Math.round(((counts[opt.id] || 0) / total) * 100);
                      return (
                        <div key={opt.id} className="flex items-center gap-1.5">
                          <p className="text-white/55 text-[10px] truncate flex-shrink-0" style={{ width: 52 }}>
                            {opt.text}
                          </p>
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${pct}%`, background: "linear-gradient(90deg,#6366f1,#8b5cf6)" }}
                            />
                          </div>
                          <span className="text-white/40 text-[10px] flex-shrink-0" style={{ width: 26, textAlign: "right" }}>
                            {pct}%
                          </span>
                        </div>
                      );
                    })}
                    <p className="text-white/25 text-[9px] mt-0.5">{total.toLocaleString()} votes</p>
                  </div>
                );
              })()}

              <div className="flex items-center gap-2">
                {/* Vote button */}
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={e => { e.stopPropagation(); onNavigateToSurveys?.(); }}
                  className="flex-1 py-1.5 rounded-lg text-[11px] font-black text-white"
                  style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                  Vote
                </motion.button>

                {/* Debate button with glow pulse */}
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={e => { e.stopPropagation(); onNavigateToSurveys?.(); }}
                  className="relative flex-1 py-1.5 rounded-lg text-[11px] font-black overflow-hidden"
                  style={{ background: "rgba(236,72,153,0.15)", border: "1px solid rgba(236,72,153,0.4)", color: "#ec4899" }}>
                  <motion.span
                    className="absolute inset-0 rounded-lg pointer-events-none"
                    animate={{ boxShadow: ["0 0 0px rgba(236,72,153,0)", "0 0 10px rgba(236,72,153,0.6)", "0 0 0px rgba(236,72,153,0)"] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  />
                  ⚔️ Debate
                </motion.button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// Pure display component — data is fetched once at FameFeed level, no per-instance channels
const TrendingFlicksRow = ({
  flicks,
  loaded,
  onFlickClick,
}: {
  flicks: any[];
  loaded: boolean;
  onFlickClick: (flick: any) => void;
}) => {
  if (!loaded) return null;
  if (flicks.length === 0)
    return (
      <div
        className="pt-2 pb-3 px-4 border-b border-white/5"
        style={{ background: "#0F172A" }}
      >
        <p className="text-[13px] font-black text-white/70 mb-2 tracking-wide">
          🔥 Trending Flicks
        </p>
        <div
          className="flex flex-col items-center justify-center py-6 gap-2 rounded-2xl border border-white/10"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          <span className="text-3xl">🎬</span>
          <p className="text-sm font-bold text-white/40">
            No Trending Flicks yet
          </p>
          <p className="text-xs text-white/20">
            Post something to be the first!
          </p>
        </div>
      </div>
    );
  return (
    <div
      className="border-b border-white/5 pt-2 pb-1"
      style={{ background: "#0F172A" }}
    >
      <p className="text-[13px] font-black text-white/70 px-4 mb-2 tracking-wide">
        🔥 Trending Flicks
      </p>
      <div className="flex gap-3 overflow-x-auto px-4 pb-2 no-scrollbar">
        {flicks.map((flick, i) => {
          const isYT =
            flick.media_url?.includes("youtube.com") ||
            flick.media_url?.includes("youtu.be");
          const isVid =
            !isYT &&
            flick.media_url &&
            /\.(mp4|webm|ogg|mov|m4v)/i.test(flick.media_url.split("?")[0]);
          const isImg = flick.media_url && !isVid && !isYT;
          return (
            <motion.div
              key={flick.id}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => onFlickClick(flick)}
              className="flex-shrink-0 relative rounded-2xl overflow-hidden cursor-pointer select-none shadow-md"
              style={{
                width: 168,
                height: 297,
                background: `linear-gradient(160deg, ${FLICK_GRADS[i % FLICK_GRADS.length]} 0%, #1e1b4b 100%)`,
              }}
            >
              {/* Real thumbnail */}
              {isImg && (
                <img
                  src={flick.media_url}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                  alt=""
                 decoding="async"/>
              )}
              {isVid && (
                <AutoPlayMutedVideo
                  src={flick.media_url}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
              {/* Subtle play indicator — small badge in corner so the auto-playing video isn't covered */}
              {isVid && (
                <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center border border-white/40">
                  <VolumeX size={13} className="text-white" />
                </div>
              )}
              {!isVid && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/15">
                  <div className="w-12 h-12 rounded-full bg-black/70 flex items-center justify-center border-2 border-white/40">
                    <Play size={20} fill="white" className="text-white ml-1" />
                  </div>
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 to-transparent px-2.5 py-2.5">
                <div className="flex items-center gap-1 mb-0.5">
                  <Heart size={11} className="text-red-400" fill="#f87171" />
                  <span className="text-white text-[11px] font-bold">
                    {flick.likes_count || 0}
                  </span>
                </div>
                <p className="text-white text-[11px] font-semibold truncate">
                  @{flick.author || "user"}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

// ── Suggested Pages Row (horizontal scroll, 3-4 visible) ───────────────────────
const SuggestedPagesRow = ({
  pages,
  hookedIds,
  followerCounts,
  ownerNames,
  onHook,
  onPageClick,
}: {
  pages: any[];
  hookedIds: string[];
  followerCounts: { [key: string]: number };
  ownerNames: Record<string, string>;
  onHook: (e: React.MouseEvent, pageId: string) => void;
  onPageClick: (page: any) => void;
}) => {
  if (pages.length === 0) return null;
  return (
    <div
      className="border-b border-white/5 pt-3 pb-1"
      style={{ background: "#0F172A" }}
    >
      <p className="text-[13px] font-black text-white/70 px-4 mb-2 tracking-wide">
        📄 Trending Pages
      </p>
      <div className="flex gap-3.5 overflow-x-auto px-4 pb-2 no-scrollbar">
        {pages.map((page) => {
          const grad = gradForSugg(page.id || page.name || "p");
          const hooked = hookedIds.includes(page.id);
          const count = followerCounts[page.id] ?? page.member_count ?? 0;
          const ownerId = page.owner_id;
          const ownerName = ownerId ? ownerNames[ownerId] : null;
          // Creator avatar: from attached profiles or page.avatar_url
          const creatorAvatar =
            page.profiles?.avatar_url || page.avatar_url || null;
          const creatorInitial = (page.profiles?.full_name ||
            ownerName ||
            "P")[0]?.toUpperCase();
          return (
            <motion.div
              key={page.id}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => onPageClick(page)}
              className="flex-shrink-0 relative rounded-2xl overflow-hidden cursor-pointer select-none shadow-md"
              style={{
                width: 168,
                height: 312,
                backgroundImage: page.cover_url
                  ? `url('${page.cover_url}')`
                  : "none",
                backgroundColor: page.cover_url ? "transparent" : "#1f2937",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              {/* Cinematic gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
              {/* Top: Page badge */}
              <div className="absolute top-2.5 left-2.5">
                <span className="bg-black/65 border border-white/30 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Page
                </span>
              </div>
              {/* Top-right: follower count */}
              <div className="absolute top-2.5 right-2.5 flex items-center gap-0.5 bg-black/70 rounded-full px-2 py-0.5 border border-white/20">
                <Users size={9} className="text-white/80" />
                <span className="text-white text-[9px] font-bold">
                  {count >= 1000 ? `${(count / 1000).toFixed(1)}K` : count}
                </span>
              </div>
              {/* Bottom info */}
              <div className="absolute bottom-0 left-0 right-0 px-3 py-3">
                {/* Creator row */}
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div
                    className="w-5 h-5 rounded-full overflow-hidden border border-white/40 shrink-0 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-black"
                    style={{ fontSize: 8 }}
                  >
                    {creatorAvatar ? (
                      <img
                        src={creatorAvatar}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        alt=""
                       decoding="async"/>
                    ) : (
                      creatorInitial
                    )}
                  </div>
                  {ownerName && (
                    <p
                      style={{
                        fontSize: 9,
                        color: "#34d399",
                        fontStyle: "italic",
                        fontFamily: "Georgia, serif",
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                      }}
                    >
                      ✦ by @{ownerName}
                    </p>
                  )}
                </div>
                <p className="text-white text-[13px] font-black leading-tight truncate drop-shadow-lg">
                  {page.name}
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onHook(e, page.id);
                  }}
                  className="mt-2 w-full py-2 rounded-xl text-[11px] font-black active:scale-95 transition-all"
                  style={
                    hooked
                      ? {
                          background: "rgba(255,255,255,0.15)",
                          border: "2px solid #f87171",
                          color: "#f87171",
                        }
                      : {
                          background:
                            "linear-gradient(135deg, #ff6b00, #ff9500)",
                          color: "#fff",
                          boxShadow: "0 0 12px rgba(255,107,0,0.5)",
                        }
                  }
                >
                  {hooked ? "✓ Hooked" : "⚡ HOOK"}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

// ── Suggested Circles Row (horizontal scroll, 3-4 visible) ─────────────────────
const SuggestedCirclesRow = ({
  circles,
  joinedIds,
  memberCounts,
  ownerNames,
  onJoin,
  onCircleClick,
}: {
  circles: any[];
  joinedIds: string[];
  memberCounts: { [key: string]: number };
  ownerNames: Record<string, string>;
  onJoin: (e: React.MouseEvent, circleId: string) => void;
  onCircleClick: (circle: any) => void;
}) => {
  if (circles.length === 0) return null;
  return (
    <div
      className="border-b border-white/5 pt-3 pb-1"
      style={{ background: "#0F172A" }}
    >
      <p className="text-[13px] font-black text-white/70 px-4 mb-2 tracking-wide">
        👥 Circles
      </p>
      <div className="flex gap-3.5 overflow-x-auto px-4 pb-2 no-scrollbar">
        {circles.map((circle) => {
          const grad = gradForSugg(circle.id || circle.name || "c");
          const joined = joinedIds.includes(circle.id);
          const count = memberCounts[circle.id] ?? circle.member_count ?? 0;
          const ownerId = circle.owner_id || circle.created_by;
          const ownerName = ownerId ? ownerNames[ownerId] : null;
          return (
            <div
              key={circle.id}
              className="flex-shrink-0 rounded-2xl overflow-hidden flex flex-col cursor-pointer border border-white/10"
              style={{
                width: 168,
                height: 312,
                background: "rgba(30,10,45,0.95)",
                boxShadow: "0 2px 18px rgba(0,0,0,0.4)",
              }}
              onClick={() => onCircleClick(circle)}
            >
              <div
                className="w-full relative overflow-hidden"
                style={{ height: 168, background: grad }}
              >
                {circle.cover_url ? (
                  <img
                    src={circle.cover_url}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    alt={circle.name}
                   decoding="async"/>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Users size={36} className="text-white/50" />
                  </div>
                )}
              </div>
              <div className="p-3 flex flex-col gap-1 flex-1">
                <p className="text-[13px] font-black text-white/90 truncate leading-tight">
                  {circle.name}
                </p>
                <p className="text-[11px] text-white/40">{count} Members</p>
                {ownerName && (
                  <p
                    style={{
                      fontSize: 10,
                      fontStyle: "italic",
                      color: "#34d399",
                      fontFamily: "Georgia, serif",
                      letterSpacing: "0.04em",
                      fontWeight: 700,
                    }}
                  >
                    ✦ by @{ownerName}
                  </p>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onJoin(e, circle.id);
                  }}
                  className={`w-full py-2.5 rounded-xl text-[12px] font-black mt-auto transition-all active:scale-95 ${
                    joined
                      ? "bg-transparent border-2 border-red-400 text-red-400"
                      : ""
                  }`}
                  style={
                    joined
                      ? {}
                      : {
                          background:
                            "linear-gradient(135deg, #00c853, #00e676)",
                          color: "#003300",
                          boxShadow: "0 0 14px rgba(0,200,83,0.55)",
                        }
                  }
                >
                  {joined ? "LEAVE" : "⭕ Join Circle"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── In-Feed Suggestion Card (native post style) ────────────────────────────────
const SUGG_GRADS = [
  "#6366f1",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
];

function gradForSugg(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h) ^ id.charCodeAt(i);
  return SUGG_GRADS[Math.abs(h) % SUGG_GRADS.length];
}

// Seeded Fisher-Yates shuffle — deterministic per seed, stable within a render
function seededShuffle<T>(arr: T[], seed: number): T[] {
  if (arr.length === 0) return [];
  const a = [...arr];
  let s = (seed * 1664525 + 1013904223) & 0x7fffffff;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const InFeedSuggestionCard = ({
  item,
  actionDone,
  onAction,
}: {
  item: any;
  actionDone: boolean;
  onAction: (id: string) => void;
}) => {
  const isGroup = item.type === "group" || item.type === "circle";
  const grad = gradForSugg(item.id || item.name || "x");
  return (
    <motion.article
      layout
      className="border-b border-white/5"
      style={{ background: "linear-gradient(175deg,#1a0822,#0d0814,#0F172A)" }}
    >
      {/* Header — like a post author row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          className="w-10 h-10 rounded-full overflow-hidden border border-white/10 shrink-0"
          style={{ background: `linear-gradient(135deg, ${grad}, #1e1b4b)` }}
        >
          {item.cover_url ? (
            <img
              src={item.cover_url}
              className="w-full h-full object-cover"
              loading="lazy"
              alt={item.name}
             decoding="async"/>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Users size={16} className="text-white/80" />
            </div>
          )}
        </div>
        <div>
          <p className="text-white/90 font-bold text-sm leading-none">
            {item.name || "Community"}
          </p>
          <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-wide mt-0.5">
            {isGroup ? "👥 Suggested Circle" : "📄 Suggested Page"}
          </p>
        </div>
      </div>

      {/* Big cover photo */}
      <div
        className="w-full relative bg-black/20"
        style={{ aspectRatio: "16/9" }}
      >
        {item.cover_url ? (
          <img
            src={item.cover_url}
            className="w-full h-full object-cover"
            loading="lazy"
            alt={item.name}
           decoding="async"/>
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${grad}, #1e1b4b)` }}
          >
            <Users size={52} className="text-white/40" />
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3">
          <p className="text-white/80 text-[11px] font-semibold">
            {item.member_count ?? 0} members
            {item.privacy ? ` · ${item.privacy}` : ""}
          </p>
        </div>
      </div>

      {/* Optional description */}
      {item.description && (
        <div className="px-4 pt-2 pb-0">
          <p className="text-[13px] text-gray-600 line-clamp-2 leading-snug">
            {item.description}
          </p>
        </div>
      )}

      {/* Big action button */}
      <div className="px-4 py-3">
        <button
          onClick={() => {
            if (!actionDone) onAction(item.id);
          }}
          className={`w-full py-3.5 rounded-2xl font-black text-sm transition-all active:scale-[0.98] ${
            actionDone
              ? "bg-gray-100 text-gray-400 cursor-default"
              : "bg-blue-600 text-white"
          }`}
        >
          {actionDone
            ? isGroup
              ? "Joined ✓"
              : "Following ✓"
            : isGroup
              ? "Join Circle"
              : "Follow"}
        </button>
      </div>
    </motion.article>
  );
};

// ── In-Feed Hooks Strip — mirrors DemoCirclesRow exactly, uses <img decoding="async"> not backgroundImage ──
const InFeedHooksStrip = ({
  pages,
  hookedIds,
  ownerNames,
  followerCounts,
  onHook,
  onPageClick,
  seed,
}: {
  pages: any[];
  hookedIds: string[];
  ownerNames: Record<string, string>;
  followerCounts: Record<string, number>;
  onHook: (e: React.MouseEvent, pageId: string) => void;
  onPageClick: (page: any) => void;
  seed?: number;
}) => {
  if (pages.length === 0) return null;
  const displayed = seededShuffle(pages, seed ?? 0).slice(0, 5);
  return (
    <div
      className="border-b border-white/5 pt-3 pb-1"
      style={{ background: "#0F172A" }}
    >
      <div className="flex items-center justify-between px-4 mb-2">
        <p className="text-[13px] font-black text-white/70 tracking-wide">
          ⚡ Hook Pages — Discover
        </p>
        <button
          onClick={() => onPageClick(null)}
          className="text-[10px] font-black text-orange-500 uppercase tracking-wider"
        >
          See All →
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 pb-2 no-scrollbar">
        {displayed.map((page) => {
          const hooked = hookedIds.includes(page.id);
          const count =
            followerCounts[page.id] ??
            page.followers_count ??
            page.follower_count ??
            0;
          const ownerName = page.owner_id ? ownerNames[page.owner_id] : null;
          return (
            <motion.div
              key={page.id}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => onPageClick(page)}
              className="flex-shrink-0 relative rounded-2xl overflow-hidden cursor-pointer select-none shadow-md"
              style={{ width: 168, height: 312, background: "#1f2937" }}
            >
              {/* Cover image — same <img decoding="async"> approach as DemoCirclesRow */}
              {page.cover_url ? (
                <img
                  src={page.cover_url}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                  alt={page.name}
                 decoding="async"/>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-4xl opacity-30">⚡</span>
                </div>
              )}
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
              {/* Top-left badge */}
              <div className="absolute top-2.5 left-2.5">
                <span className="bg-black/65 border border-white/30 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  ⚡ Page
                </span>
              </div>
              {/* Top-right follower count */}
              <div className="absolute top-2.5 right-2.5 flex items-center gap-0.5 bg-black/70 rounded-full px-2 py-0.5 border border-white/20">
                <Users size={9} className="text-white/80" />
                <span className="text-white text-[9px] font-bold">
                  {count >= 1000 ? `${(count / 1000).toFixed(1)}K` : count}
                </span>
              </div>
              {/* Bottom info */}
              <div className="absolute bottom-0 left-0 right-0 px-3 py-3">
                <p className="text-white text-[13px] font-black leading-tight truncate drop-shadow-lg">
                  {page.name}
                </p>
                {page.category && (
                  <p className="text-white/70 text-[10px] font-medium leading-tight mt-0.5 truncate">
                    {page.category}
                  </p>
                )}
                {ownerName && (
                  <p
                    style={{
                      fontSize: 10,
                      color: "#34d399",
                      fontStyle: "italic",
                      fontFamily: "Georgia, serif",
                      fontWeight: 700,
                      marginTop: 4,
                      letterSpacing: "0.03em",
                    }}
                  >
                    ✦ by @{ownerName}
                  </p>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onHook(e, page.id);
                  }}
                  className="mt-2 w-full py-2 rounded-xl text-[11px] font-black active:scale-95 transition-all"
                  style={
                    hooked
                      ? {
                          background: "rgba(255,255,255,0.15)",
                          border: "2px solid #f87171",
                          color: "#f87171",
                        }
                      : {
                          background:
                            "linear-gradient(135deg, #ff6b00, #ff9500)",
                          color: "#fff",
                          boxShadow: "0 0 12px rgba(255,107,0,0.45)",
                        }
                  }
                >
                  {hooked ? "✓ Hooked" : "⚡ HOOK"}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

// ── Facebook-Style In-Feed Hook Page Card ──────────────────────────────────────
const InFeedHookPageCard = ({
  page,
  hooked,
  ownerName,
  followerCount,
  onHook,
  onPageClick,
}: {
  page: any;
  hooked: boolean;
  ownerName?: string;
  followerCount: number;
  onHook: (e: React.MouseEvent, pageId: string) => void;
  onPageClick: (page: any) => void;
}) => {
  const grad = gradForSugg(page.id || page.name || "x");
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-b border-white/5 cursor-pointer"
      style={{ background: "linear-gradient(175deg,#1a0822,#0d0814,#0F172A)" }}
      onClick={() => onPageClick(page)}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          className="w-10 h-10 rounded-full overflow-hidden border border-white/10 shrink-0"
          style={{ background: `linear-gradient(135deg, ${grad}, #1e1b4b)` }}
        >
          {page.avatar_url || page.cover_url ? (
            <img
              src={page.avatar_url || page.cover_url}
              className="w-full h-full object-cover"
              loading="lazy"
              alt={page.name}
             decoding="async"/>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Film size={16} className="text-white/80" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white/90 font-black text-sm leading-none truncate">
            {page.name || "Page"}
          </p>
          {ownerName && (
            <p
              style={{
                fontSize: 10,
                fontStyle: "italic",
                color: "#34d399",
                fontWeight: 700,
                marginTop: 2,
              }}
            >
              ✦ by @{ownerName}
            </p>
          )}
        </div>
        <span className="text-[10px] text-blue-400 font-black uppercase tracking-wide bg-blue-900/30 px-2 py-1 rounded-full shrink-0">
          📄 Page
        </span>
      </div>

      {/* Banner */}
      <div
        className="w-full relative bg-black/20"
        style={{ aspectRatio: "16/9" }}
      >
        {page.cover_url ? (
          <img
            src={page.cover_url}
            className="w-full h-full object-cover"
            loading="lazy"
            alt={page.name}
           decoding="async"/>
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${grad}, #1e1b4b)` }}
          >
            <Film size={52} className="text-white/40" />
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3">
          <p className="text-white/80 text-[11px] font-semibold">
            {followerCount} Followers
            {page.category ? ` · ${page.category}` : ""}
          </p>
        </div>
      </div>

      {/* Bio / Description — 2-3 lines */}
      {(page.description || page.category) && (
        <div className="px-4 pt-3 pb-1">
          {page.description ? (
            <p className="text-white/50 text-[13px] leading-relaxed line-clamp-3">
              {page.description}
            </p>
          ) : (
            <p className="text-white/30 text-[12px] italic">
              {page.category} page on Flicks
            </p>
          )}
        </div>
      )}

      {/* Hook button */}
      <div className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={(e) => onHook(e, page.id)}
          className={`w-full py-3.5 rounded-2xl font-black text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
            hooked ? "bg-gray-100 text-gray-500 border-2 border-gray-200" : ""
          }`}
          style={
            hooked
              ? {}
              : {
                  background: "linear-gradient(135deg, #ff6b00, #ff9500)",
                  color: "#fff",
                  boxShadow: "0 4px 18px rgba(255,107,0,0.45)",
                }
          }
        >
          {hooked ? "✓ Hooked" : "⚡ Hook (Follow)"}
        </button>
      </div>
    </motion.article>
  );
};

// ── Suggestion Placeholder (zero-demo) ─────────────────────────────────────────
const SuggestionPlaceholder = ({
  forType,
  onAction,
}: {
  forType: "page" | "circle";
  onAction?: () => void;
}) => (
  <div
    className="border-b border-white/5 px-4 py-8 flex flex-col items-center gap-4"
    style={{ background: "#0F172A" }}
  >
    <div className="w-16 h-16 rounded-full bg-blue-900/30 flex items-center justify-center">
      <Users size={30} className="text-blue-400" />
    </div>
    <div className="text-center">
      <p className="text-white/80 font-black text-base">
        {forType === "page" ? "No Pages yet" : "No Circles yet"}
      </p>
      <p className="text-white/30 text-[12px] mt-1">
        Be the first to create one!
      </p>
    </div>
    {onAction && (
      <button
        onClick={onAction}
        className="flex items-center justify-center gap-2 px-8 py-3 rounded-2xl bg-blue-600 text-white font-black text-sm active:scale-[0.98] transition-transform"
      >
        <Plus size={16} />{" "}
        {forType === "page" ? "Create Page" : "Create Circle"}
      </button>
    )}
  </div>
);

// ── Single Full-Width Vertical Reel ───────────────────────────────────────────
const SingleReelBlock = ({ post }: { post: any }) => {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!ref.current) return;
        if (entry.isIntersecting) {
          ref.current.muted = true;
          ref.current.play().catch(() => {});
        } else {
          ref.current.pause();
        }
      },
      { threshold: 0.5 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [post.media_url]);

  const isYT =
    post.media_url?.includes("youtube.com") ||
    post.media_url?.includes("youtu.be");

  return (
    <div
      className="bg-black relative w-full feed-reel"
      style={{ aspectRatio: "9/16", maxHeight: "80vh" }}
    >
      {isYT ? (
        <div className="w-full h-full flex items-center justify-center bg-zinc-900">
          <Play size={40} className="text-white/40" />
        </div>
      ) : (
        <video
          ref={ref}
          src={post.media_url}
          className="w-full h-full object-cover"
          loop
          muted={muted}
          playsInline
          preload="metadata"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
      {!isYT && (
        <button
          onClick={() => {
            if (ref.current) {
              ref.current.muted = !ref.current.muted;
              setMuted(ref.current.muted);
            }
          }}
          className="absolute top-4 right-4 p-2 bg-black/40 backdrop-blur-sm rounded-full border border-white/10"
        >
          {muted ? (
            <VolumeX size={16} className="text-white" />
          ) : (
            <Volume2 size={16} className="text-white" />
          )}
        </button>
      )}
      <div className="absolute bottom-4 left-4 right-14 text-white pointer-events-none">
        <p className="font-bold text-sm drop-shadow-lg">
          @{post.author || "user"}
        </p>
        {post.content && (
          <p className="text-xs opacity-80 mt-1 line-clamp-2">
            {maskProfanity(post.content)}
          </p>
        )}
      </div>
      <div className="absolute right-3 bottom-16 flex flex-col items-center gap-4">
        <button
          onClick={() => setLiked(!liked)}
          className="flex flex-col items-center"
        >
          <Heart
            size={26}
            fill={liked ? "#ff2d55" : "none"}
            className={liked ? "text-[#ff2d55]" : "text-white"}
          />
          <span className="text-white text-[10px] font-bold mt-1">
            {post.likes_count || 0}
          </span>
        </button>
        <button
          className="flex flex-col items-center"
          onClick={() => {
            sharePost({
              postId: post.id,
              caption: post.content,
              mediaUrl: post.media_url,
              mediaType: post.type || (post.media_url ? "image" : null),
              authorName: post.author,
              metaTitle: post.meta_title,
              metaDescription: post.meta_description,
            });
          }}
        >
          <Share2 size={24} fill="white" className="text-white" />
          <span className="text-white text-[10px] font-bold mt-1">Share</span>
        </button>
      </div>
    </div>
  );
};

// ── Cinematic Post Divider ─────────────────────────────────────────────────────
const FeedDivider = () => (
  <div
    style={{
      position: "relative",
      height: 2,
      margin: "0 0",
      overflow: "visible",
    }}
  >
    {/* Main gradient line — orange 30% + dark green, fades at both ends */}
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          "linear-gradient(90deg, transparent 0%, rgba(34,85,34,0.6) 12%, rgba(255,115,0,0.55) 38%, rgba(255,140,0,0.75) 50%, rgba(255,115,0,0.55) 62%, rgba(34,85,34,0.6) 88%, transparent 100%)",
        height: 1.5,
        top: "50%",
        transform: "translateY(-50%)",
      }}
    />
    {/* Soft orange glow bloom */}
    <div
      style={{
        position: "absolute",
        left: "20%",
        right: "20%",
        top: "50%",
        transform: "translateY(-50%)",
        height: 6,
        background:
          "radial-gradient(ellipse at center, rgba(255,120,0,0.28) 0%, transparent 70%)",
        filter: "blur(3px)",
        pointerEvents: "none",
      }}
    />
  </div>
);

// ── Fullscreen Flick Player Modal ─────────────────────────────────────────────
const FlickPlayerModal = ({
  flick,
  onClose,
}: {
  flick: any;
  onClose: () => void;
}) => {
  const isYT =
    flick.media_url?.includes("youtube.com") ||
    flick.media_url?.includes("youtu.be");
  const isVid =
    !isYT &&
    flick.media_url &&
    /\.(mp4|webm|ogg|mov|m4v)/i.test(flick.media_url.split("?")[0]);

  const getYtEmbedUrl = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
    return match
      ? `https://www.youtube.com/embed/${match[1]}?autoplay=1&playsinline=1`
      : url;
  };

  return (
    <AnimatePresence>
      <motion.div
        key="flick-modal"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[999] bg-black flex flex-col"
        onClick={onClose}
      >
        {/* Close button */}
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white border border-white/20"
          >
            <X size={20} />
          </button>
        </div>

        {/* Author tag */}
        <div className="absolute top-4 left-4 z-10">
          <p className="text-white text-[13px] font-bold drop-shadow-lg">
            @{flick.author || "user"}
          </p>
        </div>

        {/* Video / Embed */}
        <div
          className="flex-1 flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {isYT && (
            <iframe
              src={getYtEmbedUrl(flick.media_url)}
              className="w-full h-full"
              allow="autoplay; fullscreen"
              allowFullScreen
              style={{ border: "none", maxHeight: "100dvh" }}
            />
          )}
          {isVid && (
            <video
              src={flick.media_url}
              className="w-full h-full object-contain"
              autoPlay
              controls
              playsInline
              style={{ maxHeight: "100dvh" }}
            />
          )}
          {!isVid && !isYT && flick.media_url && (
            <img
              src={flick.media_url}
              className="w-full h-full object-contain"
              alt=""
              style={{ maxHeight: "100dvh" }}
             decoding="async"/>
          )}
          {!flick.media_url && (
            <div className="flex flex-col items-center gap-3 text-white/50">
              <Film size={48} strokeWidth={1} />
              <p className="text-[13px]">No media available</p>
            </div>
          )}
        </div>

        {/* Caption */}
        {flick.content && (
          <div className="absolute bottom-8 left-4 right-16 z-10">
            <p className="text-white text-[13px] font-medium drop-shadow-lg line-clamp-3">
              {flick.content}
            </p>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

// ── Main Feed ─────────────────────────────────────────────────────────────────
interface FameFeedProps {
  onPostClick?: () => void;
  onImageSelect?: (file: File) => void;
  userProfile?: any;
  suggestions?: { id: string; full_name: string; avatar_url?: string }[];
  onNavigateToCircles?: () => void;
  onNavigateToPages?: () => void;
  onNavigateToFlicks?: () => void;
  onNavigateToSurveys?: () => void;
  isAdmin?: boolean;
  localProfile?: LocalProfile;
}

// ── Hidden Posts Archive Drawer ───────────────────────────────────────────────
const HiddenPostsDrawer = ({
  hiddenIds,
  currentUserId,
  onUnhide,
  onClearAll,
  onClose,
}: {
  hiddenIds: Set<string>;
  currentUserId: string | null;
  onUnhide: (id: string) => void;
  onClearAll: () => void;
  onClose: () => void;
}) => {
  const [allFetched, setAllFetched] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ids = [...hiddenIds];
    if (ids.length === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("posts")
      .select("id, content, media_url, type, author, author_id")
      .in("id", ids)
      .then(({ data }) => {
        setAllFetched(data || []);
        setLoading(false);
      });
  }, []); // fetch once on mount; parent hiddenIds drives the live filter

  // Filter as user unhides: posts disappear from list instantly
  const displayPosts = allFetched.filter((p) => hiddenIds.has(p.id));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[800] bg-black/50 backdrop-blur-sm flex flex-col justify-end"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 280, damping: 30 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.18}
        onDragEnd={(_, info) => {
          if (info.offset.y > 80) onClose();
        }}
        className="rounded-t-3xl flex flex-col border-t border-white/10"
        style={{
          maxHeight: "82vh",
          paddingBottom: "env(safe-area-inset-bottom)",
          background: "rgba(18,4,28,0.98)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-3 mb-1" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <EyeOff size={17} className="text-white/50" />
            <h2 className="font-black text-white text-base">Hidden Posts</h2>
            {hiddenIds.size > 0 && (
              <span className="bg-white/10 text-white/50 text-[11px] font-bold px-2 py-0.5 rounded-full">
                {hiddenIds.size}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hiddenIds.size > 0 && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={onClearAll}
                className="text-red-400 text-[12px] font-bold px-3 py-1.5 rounded-full bg-red-900/30 active:scale-95 transition-transform"
              >
                Clear All
              </motion.button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-transform"
            >
              <X size={16} className="text-white/50" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-14">
              <Loader2 size={24} className="animate-spin text-pink-400" />
            </div>
          ) : displayPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                <EyeOff size={28} className="text-white/20" />
              </div>
              <p className="text-white/40 font-semibold text-sm">
                Koi hidden post nahi hai
              </p>
              <p className="text-white/20 text-xs text-center leading-relaxed">
                Jab koi post hide karoge,{"\n"}woh yahan dikhega
              </p>
            </div>
          ) : (
            displayPosts.map((post) => {
              const name = post.author || "User";
              const content = post.content || "";
              const isVideo =
                post.type === "video" ||
                /\.(mp4|webm|mov|m4v)/i.test(post.media_url || "");

              return (
                <div
                  key={post.id}
                  className="flex items-start gap-3 rounded-2xl p-3.5 border border-white/10"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                >
                  {/* Avatar placeholder */}
                  <div className="w-10 h-10 rounded-full bg-pink-900/40 flex items-center justify-center shrink-0">
                    <span className="text-pink-300 font-black text-sm">
                      {name[0]}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-white/80 truncate">
                      {name}
                    </p>
                    {content ? (
                      <p className="text-[12px] text-white/40 mt-0.5 line-clamp-2 leading-snug">
                        {maskProfanity(content)}
                      </p>
                    ) : post.media_url ? (
                      <p className="text-[12px] text-white/30 mt-0.5 italic">
                        {isVideo ? "🎬 Video post" : "📷 Image post"}
                      </p>
                    ) : null}
                  </div>

                  {/* Unhide CTA */}
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={() => onUnhide(post.id)}
                    className="flex items-center gap-1.5 bg-pink-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-full shrink-0"
                  >
                    <Eye size={13} /> Unhide
                  </motion.button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        {displayPosts.length > 0 && (
          <div className="px-5 py-3 border-t border-white/10">
            <p className="text-[11px] text-white/30 text-center">
              Unhide karne se post wapas feed mein aa jaayega
            </p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

type FeedCommentMenuItem = {
  icon: string;
  label: string;
  action: () => void;
  danger?: boolean;
};

type FeedBlock = { type: string; post?: any; key: string; seed?: number };

const FameFeed = ({
  onPostClick,
  onImageSelect,
  userProfile,
  suggestions = [],
  onNavigateToCircles,
  onNavigateToPages,
  onNavigateToFlicks,
  onNavigateToSurveys,
  isAdmin: isAdminProp = false,
  localProfile = {},
}: FameFeedProps) => {
  const { openProfile } = useProfileViewer();
  const { playPop, playSwoosh } = useSoundEffects();
  const dataCache = useDataCache();
  const cachedPosts = dataCache.cacheRef.current.famePosts;
  const cachedFlicks = dataCache.cacheRef.current.fameFlicks;
  const [posts, setPosts] = useState<any[]>(() => cachedPosts?.data ?? []);
  // Mirror of posts in a ref so callbacks can read the current count synchronously
  // without being listed as a dep (which would break memoised callbacks).
  const postsRef = useRef<any[]>(cachedPosts?.data ?? []);
  const [loading, setLoading] = useState(() => !cachedPosts?.data);
  const [activeComment, setActiveComment] = useState<string | null>(null);
  const [commentSheetId, setCommentSheetId] = useState<string | null>(null);
  const [latestCommentPreviews, setLatestCommentPreviews] = useState<
    Record<
      string,
      { author: string; content: string; authorId?: string } | null
    >
  >({});
  const [commentTickerMap, setCommentTickerMap] = useState<
    Record<
      string,
      Array<{ author: string; content: string; authorId?: string }>
    >
  >({});
  const [tickerIdx, setTickerIdx] = useState(0);
  // Visibility-aware ticker — stops when screen is off / app is backgrounded
  useEffect(() => {
    let t: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (!t) t = setInterval(() => setTickerIdx((i) => i + 1), 3200);
    };
    const stop = () => {
      if (t) { clearInterval(t); t = null; }
    };
    if (!document.hidden) start();
    const onViz = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onViz);
    return () => { stop(); document.removeEventListener("visibilitychange", onViz); };
  }, []);

  const [feedCommentAction, setFeedCommentAction] = useState<{
    comment: any;
    postId: string;
    x: number;
    y: number;
  } | null>(null);
  const [editingFeedComment, setEditingFeedComment] = useState<{
    id: string;
    text: string;
  } | null>(null);
  const [editingPost, setEditingPost] = useState<{
    id: string;
    text: string;
  } | null>(null);
  const longPressCommentTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const longPressCommentPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [commentText, setCommentText] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const onlineUserIds = useOnlineUsers();
  // Robust admin detection: direct email match (isAdminEmail also checks same list)
  const isAdmin =
    isAdminProp ||
    (!!currentUserEmail &&
      ["tiwarijhumki@gmail.com", "textilevikhyat@gmail.com"].includes(
        currentUserEmail.trim().toLowerCase(),
      ));
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [userReactions, setUserReactions] = useState<{
    [postId: string]: string;
  }>({});
  const [reactionBarPostId, setReactionBarPostId] = useState<string | null>(
    null,
  );
  const [sharePopupData, setSharePopupData] = useState<{
    post: any;
    anchor: ShareAnchor;
  } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deletingPostIdsRef = useRef<Set<string>>(new Set()); // guard Realtime UPDATE from restoring a deleted post
  const [viewedPostIds, setViewedPostIds] = useState<Set<string>>(new Set());
  // Ref mirror for synchronous deduplication inside incrementView callback
  const viewedPostIdsRef = useRef<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<{
    postId: string;
    commentId: string;
    author: string;
  } | null>(null);
  const [replyText, setReplyText] = useState("");
  const [insightsPostId, setInsightsPostId] = useState<string | null>(null);
  const [insightsData, setInsightsData] = useState<any[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsTab, setInsightsTab] = useState("all");
  const [reportModal, setReportModal] = useState<{
    postId: string;
    targetId?: string;
    reason: string;
    anchor: { top: number; right: number };
  } | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [showHiddenArchive, setShowHiddenArchive] = useState(false);
  const [pageSuggestions, setPageSuggestions] = useState<any[]>([]);
  const [groupSuggestions, setGroupSuggestions] = useState<any[]>([]);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);
  const [inFeedDoneIds, setInFeedDoneIds] = useState<Set<string>>(new Set());
  const [peopleSuggestions, setPeopleSuggestions] = useState<any[]>([]);
  const [sentRequestIds, setSentRequestIds] = useState<string[]>([]);
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());
  const [blockConfirm, setBlockConfirm] = useState<{
    userId: string;
    name: string;
  } | null>(null);
  const [hookedPageIds, setHookedPageIds] = useState<string[]>([]);
  const [pageFollowerCounts, setPageFollowerCounts] = useState<{
    [key: string]: number;
  }>({});
  const [joinedCircleIds, setJoinedCircleIds] = useState<string[]>([]);
  const [circleMemberCounts, setCircleMemberCounts] = useState<{
    [key: string]: number;
  }>({});
  const [trendingFlicks, setTrendingFlicks] = useState<any[]>(
    () => cachedFlicks?.data ?? [],
  );
  const [flicksLoaded, setFlicksLoaded] = useState(() => !!cachedFlicks?.data);
  const [flickModal, setFlickModal] = useState<any | null>(null);
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [commentReactionBarId, setCommentReactionBarId] = useState<
    string | null
  >(null);
  const [commentReactions, setCommentReactions] = useState<
    Record<string, Record<string, string[]>>
  >({});
  // author cache: author_id → avatar_url / full_name / is_verified / is_official_creator
  const [authorAvatars, setAuthorAvatars] = useState<Record<string, string>>(
    {},
  );
  const [authorNames, setAuthorNames] = useState<Record<string, string>>({});
  const [authorVerified, setAuthorVerified] = useState<Record<string, boolean>>(
    {},
  );
  const [authorCreator, setAuthorCreator] = useState<Record<string, boolean>>(
    {},
  );
  // follow state for creator inline buttons: author_id → is following
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [followingInProgress, setFollowingInProgress] = useState<
    Record<string, boolean>
  >({});
  const [postMagnetData, setPostMagnetData] = useState<
    Record<
      string,
      {
        linkers: Array<{ full_name: string; avatar_url: string | null }>;
        voices: MagnetVoice[];
      }
    >
  >({});
  const fetchedAvatarIds = useRef<Set<string>>(new Set());

  const batchFetchAvatars = useCallback(
    async (ids: string[], opts?: { force?: boolean }) => {
      const force = !!opts?.force;
      const fresh = ids.filter(
        (id) => id && (force || !fetchedAvatarIds.current.has(id)),
      );
      if (fresh.length === 0) return;
      const { data } = await supabase
        .from("profiles")
        .select("id, avatar_url, full_name, is_verified, is_official_creator")
        .in("id", fresh);
      if (data) {
        const avatars: Record<string, string> = {};
        const names: Record<string, string> = {};
        const verified: Record<string, boolean> = {};
        const creators: Record<string, boolean> = {};
        for (const p of data as any[]) {
          if (p.avatar_url) {
            avatars[p.id] = p.avatar_url;
            // Only cache HITS — misses stay un-cached so a later DP upload
            // gets picked up by the self-healing render-time effect.
            fetchedAvatarIds.current.add(p.id);
          }
          if (p.full_name) names[p.id] = p.full_name;
          if (p.is_verified) verified[p.id] = true;
          if (p.is_official_creator) creators[p.id] = true;
        }
        if (Object.keys(avatars).length)
          setAuthorAvatars((prev) => ({ ...prev, ...avatars }));
        if (Object.keys(names).length)
          setAuthorNames((prev) => ({ ...prev, ...names }));
        if (Object.keys(verified).length)
          setAuthorVerified((prev) => ({ ...prev, ...verified }));
        if (Object.keys(creators).length)
          setAuthorCreator((prev) => ({ ...prev, ...creators }));
      }
    },
    [],
  );

  // Live re-sync when ANY user updates their profile name (Settings → Save Changes)
  // Refs hold latest maps so the event handler always reads fresh data without
  // being listed as a useEffect dep (which would cause the effect to re-register
  // the window listener on every batchFetchAvatars call → infinite loop).
  const authorNamesRef = useRef<Record<string, string>>({});
  const authorAvatarsRef = useRef<Record<string, string>>({});
  useEffect(() => { authorNamesRef.current = authorNames; }, [authorNames]);
  useEffect(() => { authorAvatarsRef.current = authorAvatars; }, [authorAvatars]);
  // Keep postsRef in sync so incrementView can read current counts synchronously
  useEffect(() => { postsRef.current = posts; }, [posts]);

  useEffect(() => {
    const handler = () => {
      fetchedAvatarIds.current.clear();
      const ids = Array.from(
        new Set([
          ...Object.keys(authorNamesRef.current),
          ...Object.keys(authorAvatarsRef.current),
        ]),
      );
      if (ids.length > 0) batchFetchAvatars(ids);
    };
    window.addEventListener("flicks-profile-updated", handler);
    window.addEventListener("flicks-avatar-updated", handler);
    return () => {
      window.removeEventListener("flicks-profile-updated", handler);
      window.removeEventListener("flicks-avatar-updated", handler);
    };
    // batchFetchAvatars is useCallback([]) — stable reference, safe single dep
  }, [batchFetchAvatars]);
  // Unique channel ID per mount — prevents "cannot add callbacks after subscribe()" error
  const channelId = useRef(`fame-rt-${Date.now()}`);

  // ── Pagination ───────────────────────────────────────────────────────────
  const PAGE_SIZE = 10;
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageRef = useRef(0);

  // ── On-demand comment cache ──────────────────────────────────────────────
  const [commentsMap, setCommentsMap] = useState<Record<string, any[]>>({});
  const loadedCommentsRef = useRef<Set<string>>(new Set());

  // ── DB se current user ki liked post IDs fetch karo ─────────────────────
  const fetchLikedPostIds = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from("likes")
        .select("post_id, reaction_type")
        .eq("user_id", uid)
        .limit(1000);
      if (error) {
        console.warn("[FameFeed] fetchLikedPostIds error:", error.message);
        return;
      }
      const ids = new Set<string>((data || []).map((r: any) => r.post_id));
      setLikedIds(ids);
      const reactions: { [postId: string]: string } = {};
      (data || []).forEach((r: any) => {
        if (r.reaction_type) reactions[r.post_id] = r.reaction_type;
      });
      setUserReactions(reactions);
    } catch (e) {
      console.warn("[FameFeed] fetchLikedPostIds exception:", e);
    }
  };

  // ── Profile suggestions fetch — always show, never filter sent-request users
  const fetchPeopleSuggestions = async (uid: string) => {
    const cacheKey = `peopleSugg_${uid}`;
    const cached = memGet<any[]>(cacheKey);
    if (cached) {
      setPeopleSuggestions(cached);
      return;
    }
    try {
      let res = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, fame_points")
        .neq("id", uid)
        .limit(12);
      // Fallback if fame_points column doesn't exist
      if (res.error?.code === "42703") {
        res = (await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .neq("id", uid)
          .limit(12)) as any;
      }
      const { data: profiles, error } = res;
      if (error) {
        console.warn("[FameFeed] fetchPeopleSuggestions error:", error.message);
        return;
      }
      // Sort newest-first by id (UUIDs are roughly time-ordered in Supabase)
      const sorted = (profiles || []).reverse();
      setPeopleSuggestions(sorted);
      memSet(cacheKey, sorted);
    } catch (e) {
      console.warn("[FameFeed] fetchPeopleSuggestions error:", e);
    }
  };

  // ── Send Friend Request handler ───────────────────────────────────────────
  const handleSendFriendRequest = async (
    e: React.MouseEvent,
    targetUserId: string,
  ) => {
    e.stopPropagation();
    if (!currentUserId || sentRequestIds.includes(targetUserId)) return;

    const { error } = await supabase.from("friendships").insert({
      sender_id: currentUserId,
      receiver_id: targetUserId,
      status: "pending",
    });

    if (error) {
      if (
        !error.message?.includes("duplicate") &&
        !error.message?.includes("unique")
      ) {
        toast.error("Could not send friend request. Please try again.");
      }
      return;
    }

    setSentRequestIds((prev) => [...prev, targetUserId]);
    toast.success("Friend request sent!");
  };

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(async ({ data }) => {
        try {
          const uid = data.user?.id ?? null;
          setCurrentUserId(uid);
          setCurrentUserEmail(data.user?.email ?? null);
          if (uid) {
            // ── Restore hidden posts from localStorage (survives refresh) ──
            try {
              const saved = localStorage.getItem(`flicks_hidden_${uid}`);
              if (saved) setHiddenIds(new Set(JSON.parse(saved)));
            } catch {}
            fetchLikedPostIds(uid);
            fetchPeopleSuggestions(uid);
            // Fetch already-sent friend requests (cached 5 min)
            try {
              const frKey = `sentReqs_${uid}`;
              const frCached = memGet<string[]>(frKey);
              if (frCached) {
                setSentRequestIds(frCached);
              } else {
                const { data: sentRows } = await supabase
                  .from("friendships")
                  .select("receiver_id")
                  .eq("sender_id", uid)
                  .limit(500);
                if (sentRows) {
                  const ids = sentRows.map((r: any) => r.receiver_id);
                  setSentRequestIds(ids);
                  memSet(frKey, ids);
                }
              }
            } catch (e) {
              console.warn("[FameFeed] friend_requests fetch error:", e);
            }

            // Fetch already-hooked pages (cached 5 min)
            try {
              const hpKey = `hookedPages_${uid}`;
              const hpCached = memGet<string[]>(hpKey);
              if (hpCached) {
                setHookedPageIds(hpCached);
              } else {
                const { data: hookedRows } = await supabase
                  .from("page_followers")
                  .select("page_id")
                  .eq("user_id", uid)
                  .limit(500);
                if (hookedRows) {
                  const ids = hookedRows.map((r: any) => r.page_id);
                  setHookedPageIds(ids);
                  memSet(hpKey, ids);
                }
              }
            } catch (e) {
              console.warn("[FameFeed] page_followers fetch error:", e);
            }

            // Fetch already-joined circles (cached 5 min)
            try {
              const cmKey = `joinedCircles_${uid}`;
              const cmCached = memGet<string[]>(cmKey);
              if (cmCached) {
                setJoinedCircleIds(cmCached);
              } else {
                const { data: circleRows } = await supabase
                  .from("circle_members")
                  .select("circle_id")
                  .eq("user_id", uid)
                  .limit(500);
                if (circleRows) {
                  const ids = circleRows.map((r: any) => r.circle_id);
                  setJoinedCircleIds(ids);
                  memSet(cmKey, ids);
                }
              }
            } catch (e) {
              console.warn("[FameFeed] circle_members fetch error:", e);
            }

            // Fetch blocked users (cached 5 min)
            try {
              const buKey = `blockedUsers_${uid}`;
              const buCached = memGet<string[]>(buKey);
              if (buCached) {
                setBlockedUserIds(new Set(buCached));
              } else {
                const { data: blockedRows } = await supabase
                  .from("user_blocks")
                  .select("blocked_id")
                  .eq("blocker_id", uid)
                  .limit(500);
                if (blockedRows) {
                  const ids = blockedRows.map((r: any) => r.blocked_id);
                  setBlockedUserIds(new Set(ids));
                  memSet(buKey, ids);
                }
              }
            } catch (e) {
              console.warn("[FameFeed] user_blocks fetch error:", e);
            }
          }
        } catch (e) {
          console.error("[FameFeed] auth useEffect error:", e);
        }
      })
      .catch((e) => console.error("[FameFeed] getUser error:", e));
  }, []);

  // ── Fetch owner profile names once suggestions are loaded ─────────────────
  useEffect(() => {
    const ownerIds = [
      ...pageSuggestions.map((p: any) => p.owner_id).filter(Boolean),
      ...groupSuggestions
        .map((c: any) => c.owner_id || c.created_by)
        .filter(Boolean),
    ];
    const uniqueIds = [...new Set(ownerIds)] as string[];
    if (uniqueIds.length === 0) return;
    supabase
      .from("profiles")
      .select("id, full_name, username")
      .in("id", uniqueIds)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, string> = {};
        data.forEach((p: any) => {
          map[p.id] = p.username || p.full_name || "user";
        });
        setOwnerNames(map);
      });
  }, [pageSuggestions, groupSuggestions]);

  // ── Fetch real follower counts once page suggestions are loaded ──────────
  useEffect(() => {
    if (pageSuggestions.length === 0) return;
    const ids = pageSuggestions.map((p: any) => p.id);
    supabase
      .from("page_followers")
      .select("page_id")
      .in("page_id", ids)
      .then(({ data }) => {
        if (!data) return;
        const counts: { [key: string]: number } = {};
        data.forEach((r: any) => {
          counts[r.page_id] = (counts[r.page_id] || 0) + 1;
        });
        setPageFollowerCounts(counts);
      });
  }, [pageSuggestions]);

  // ── Fetch real member counts from circle_members table ───────────────────
  useEffect(() => {
    if (groupSuggestions.length === 0) return;
    const ids = groupSuggestions.map((c: any) => c.id).filter(Boolean);
    if (ids.length === 0) return;
    supabase
      .from("circle_members")
      .select("circle_id")
      .in("circle_id", ids)
      .then(({ data }) => {
        if (!data) return;
        const counts: { [key: string]: number } = {};
        data.forEach((r: any) => {
          counts[r.circle_id] = (counts[r.circle_id] || 0) + 1;
        });
        setCircleMemberCounts(counts);
      });
  }, [groupSuggestions]);

  // ── Hook / Unhook a page (toggle) ────────────────────────────────────────
  const handleHookPage = async (e: React.MouseEvent, pageId: string) => {
    e.stopPropagation();
    if (!currentUserId) return;

    const alreadyHooked = hookedPageIds.includes(pageId);

    if (alreadyHooked) {
      // Optimistic leave
      setHookedPageIds((prev) => prev.filter((id) => id !== pageId));
      setPageFollowerCounts((prev) => ({
        ...prev,
        [pageId]: Math.max((prev[pageId] || 1) - 1, 0),
      }));

      const { error } = await supabase
        .from("page_followers")
        .delete()
        .eq("user_id", currentUserId)
        .eq("page_id", pageId);

      if (error) {
        setHookedPageIds((prev) => [...prev, pageId]);
        setPageFollowerCounts((prev) => ({
          ...prev,
          [pageId]: (prev[pageId] || 0) + 1,
        }));
        toast.error("Could not unfollow this page. Please try again.");
        return;
      }
      toast.success("Page unhooked.");
    } else {
      // Optimistic join
      setHookedPageIds((prev) => [...prev, pageId]);
      setPageFollowerCounts((prev) => ({
        ...prev,
        [pageId]: (prev[pageId] || 0) + 1,
      }));

      const { error } = await supabase.from("page_followers").insert({
        user_id: currentUserId,
        page_id: pageId,
      });

      if (error) {
        if (
          !error.message?.includes("duplicate") &&
          !error.message?.includes("unique")
        ) {
          setHookedPageIds((prev) => prev.filter((id) => id !== pageId));
          setPageFollowerCounts((prev) => ({
            ...prev,
            [pageId]: Math.max((prev[pageId] || 1) - 1, 0),
          }));
          toast.error("Could not hook this page. Please try again.");
        }
        return;
      }
      toast.success("Page hooked!");
    }
  };

  // ── Join / Leave a Circle (toggle) ────────────────────────────────────────
  const handleJoinCircle = async (e: React.MouseEvent, circleId: string) => {
    e.stopPropagation();
    if (!currentUserId) return;

    const alreadyJoined = joinedCircleIds.includes(circleId);

    if (alreadyJoined) {
      // Optimistic leave
      setJoinedCircleIds((prev) => prev.filter((id) => id !== circleId));
      setCircleMemberCounts((prev) => ({
        ...prev,
        [circleId]: Math.max((prev[circleId] || 1) - 1, 0),
      }));

      const { error } = await supabase
        .from("circle_members")
        .delete()
        .eq("user_id", currentUserId)
        .eq("circle_id", circleId);

      if (error) {
        setJoinedCircleIds((prev) => [...prev, circleId]);
        setCircleMemberCounts((prev) => ({
          ...prev,
          [circleId]: (prev[circleId] || 0) + 1,
        }));
        toast.error("Could not leave the circle. Please try again.");
        return;
      }
      toast.success("You have left the Circle. 👋");
    } else {
      // Optimistic join
      setJoinedCircleIds((prev) => [...prev, circleId]);
      setCircleMemberCounts((prev) => ({
        ...prev,
        [circleId]: (prev[circleId] || 0) + 1,
      }));

      const { error } = await supabase.from("circle_members").insert({
        user_id: currentUserId,
        circle_id: circleId,
      });

      if (error) {
        if (
          !error.message?.includes("duplicate") &&
          !error.message?.includes("unique")
        ) {
          setJoinedCircleIds((prev) => prev.filter((id) => id !== circleId));
          setCircleMemberCounts((prev) => ({
            ...prev,
            [circleId]: Math.max((prev[circleId] || 1) - 1, 0),
          }));
          toast.error("Could not join the circle. Please try again.");
        }
        return;
      }
      toast.success("Welcome to the Circle! ⭕");
    }
  };

  const loadComments = useCallback(
    async (postId: string, force = false) => {
      if (!force && loadedCommentsRef.current.has(postId)) return;
      loadedCommentsRef.current.add(postId);
      setCommentsMap((prev) => ({ ...prev, [postId]: prev[postId] ?? [] }));
      try {
        const { data, error } = await supabase
          .from("comments")
          .select(
            "id, content, author, user_id, parent_id, created_at, is_hidden, hidden_by_name, hidden_by_id",
          )
          .eq("post_id", postId)
          .order("created_at");
        if (error) {
          console.warn("[FameFeed] loadComments error:", error.message);
          return;
        }
        setCommentsMap((prev) => ({ ...prev, [postId]: data ?? [] }));
        if (data && data.length > 0) {
          const latest =
            [...data].reverse().find((c: any) => !c.parent_id) ||
            data[data.length - 1];
          setLatestCommentPreviews((prev) => ({
            ...prev,
            [postId]: {
              author: latest.author,
              content: latest.content,
              authorId: latest.user_id,
            },
          }));
        }
        const cAuthorIds = [
          ...new Set(
            (data ?? [])
              .filter((c: any) => c.user_id)
              .map((c: any) => c.user_id as string),
          ),
        ];
        if (cAuthorIds.length > 0) batchFetchAvatars(cAuthorIds);
      } catch (e) {
        console.warn("[FameFeed] loadComments exception:", e);
      }
    },
    [batchFetchAvatars],
  );

  const fetchLatestCommentPreviews = useCallback(async (postIds: string[]) => {
    if (postIds.length === 0) return;
    try {
      const { data, error } = await supabase
        .from("comments")
        .select("post_id, content, author, user_id, created_at")
        .in("post_id", postIds)
        .is("parent_id", null)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) {
        console.warn(
          "[FameFeed] fetchLatestCommentPreviews error:",
          error.message,
        );
        return;
      }
      if (!data) return;
      const map: Record<
        string,
        { author: string; content: string; authorId?: string }
      > = {};
      const tickerMap: Record<
        string,
        Array<{ author: string; content: string; authorId?: string }>
      > = {};
      for (const row of data as any[]) {
        if (!map[row.post_id]) {
          map[row.post_id] = {
            author: row.author,
            content: row.content,
            authorId: row.user_id,
          };
        }
        if (!tickerMap[row.post_id]) tickerMap[row.post_id] = [];
        if (tickerMap[row.post_id].length < 4) {
          tickerMap[row.post_id].push({
            author: row.author,
            content: row.content,
            authorId: row.user_id,
          });
        }
      }
      setLatestCommentPreviews((prev) => ({ ...prev, ...map }));
      setCommentTickerMap((prev) => ({ ...prev, ...tickerMap }));
    } catch (e) {
      console.warn("[FameFeed] fetchLatestCommentPreviews exception:", e);
    }
  }, []);

  const handleFeedCommentDelete = async (commentId: string, postId: string) => {
    try {
      const { error } = await supabase
        .from("comments")
        .delete()
        .eq("id", commentId);
      if (error) {
        console.warn("[FameFeed] comment delete error:", error.message);
        toast.error("Delete nahi ho saka.");
        return;
      }
    } catch (e) {
      console.warn("[FameFeed] comment delete exception:", e);
      toast.error("Delete nahi ho saka.");
      return;
    }
    setCommentsMap((prev) => {
      const next = (prev[postId] || []).filter((c: any) => c.id !== commentId);
      const latestTop = [...next].reverse().find((c: any) => !c.parent_id);
      setLatestCommentPreviews((lp) => ({
        ...lp,
        [postId]: latestTop
          ? {
              author: latestTop.author,
              content: latestTop.content,
              authorId: latestTop.user_id,
            }
          : null,
      }));
      return { ...prev, [postId]: next };
    });
    setFeedCommentAction(null);
    toast.success("Comment deleted.");
  };

  const handleFeedCommentHide = async (commentId: string, postId: string) => {
    const hiderName = userProfile?.full_name || "Someone";
    try {
      await supabase
        .from("comments")
        .update({
          is_hidden: true,
          hidden_by_name: hiderName,
          hidden_by_id: currentUserId,
        })
        .eq("id", commentId);
    } catch (e) {
      console.warn("[FameFeed] comment hide exception:", e);
    }
    setCommentsMap((prev) => ({
      ...prev,
      [postId]: (prev[postId] || []).map((c: any) =>
        c.id === commentId
          ? { ...c, is_hidden: true, hidden_by_name: hiderName }
          : c,
      ),
    }));
    setFeedCommentAction(null);
    toast.success("Comment hidden.");
  };

  const handleFeedCommentReport = async (comment: any, postId: string) => {
    const post = visiblePosts.find((p: any) => p.id === postId);
    try {
      const { error: commentReportErr } = await supabase
        .from("reports")
        .insert({
          reporter_id: currentUserId,
          target_id: comment.user_id ?? comment.author_id,
          post_id: postId,
          reason: `Reported comment: "${(comment.content || "").slice(0, 100)}"`,
        });
      if (commentReportErr)
        console.warn(
          "[FameFeed] comment report insert error:",
          commentReportErr.message,
        );
      if (post?.author_id && post.author_id !== currentUserId) {
        await supabase.from("notifications").insert({
          notifier_id: post.author_id,
          actor_id: currentUserId,
          type: "comment_report",
          entity_id: postId,
          content: `${userProfile?.full_name || "Someone"} reported a comment on your post.`,
          is_read: false,
        });
      }
    } catch (e) {
      console.warn("[FameFeed] comment report exception:", e);
    }
    setFeedCommentAction(null);
    toast.success("Your report has been sent to the post owner.");
  };

  const savePostEdit = async () => {
    if (!editingPost) return;
    const { id, text } = editingPost;
    if (!text.trim()) return;
    const { cleaned } = sanitizeText(text.trim());
    await supabase.from("posts").update({ content: cleaned }).eq("id", id);
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, content: cleaned } : p)),
    );
    setEditingPost(null);
    toast.success("Post updated.");
  };

  const saveFeedCommentEdit = async () => {
    if (!editingFeedComment) return;
    const { id, text } = editingFeedComment;
    const postId = feedCommentAction?.postId || commentSheetId || "";
    if (!text.trim()) return;
    try {
      const { cleaned } = sanitizeText(text.trim());
      await supabase.from("comments").update({ content: cleaned }).eq("id", id);
      setCommentsMap((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).map((c: any) =>
          c.id === id ? { ...c, content: cleaned } : c,
        ),
      }));
    } catch (e) {
      console.warn("[FameFeed] comment edit exception:", e);
    }
    setEditingFeedComment(null);
    toast.success("Comment updated.");
  };

  const fetchPosts = async (reset = false) => {
    if (!reset && (loadingMore || !hasMore)) return;
    if (reset) {
      pageRef.current = 0;
      setHasMore(true);
    }
    const from = pageRef.current * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let data: any[] | null = null;
    try {
      // ── Atomic join: pull the author's profile (avatar/name/verified) in the
      //    SAME request so the feed always renders with a real dp on first paint.
      //    Falls back to a no-join query if the FK embed isn't available.
      let res = await supabase
        .from("posts")
        .select(
          "id, author, author_id, content, media_url, image_url, type, likes_count, comments_count, created_at, metadata, cover_url, views_count, shares_count, visibility, meta_title, meta_description, author_profile:profiles!posts_author_id_fkey(avatar_url, full_name, is_verified, is_private_mode, last_seen, is_official_creator, state, district, city)",
        )
        .order("created_at", { ascending: false })
        .range(from, to);

      if (res.error) {
        console.warn(
          "[FameFeed] join with explicit FK failed, retrying:",
          res.error.message,
        );
        res = await supabase
          .from("posts")
          .select(
            "id, author, author_id, content, media_url, image_url, type, likes_count, comments_count, created_at, metadata, cover_url, views_count, shares_count, visibility, meta_title, meta_description, author_profile:profiles(avatar_url, full_name, is_verified, is_private_mode, last_seen, is_official_creator, state, district, city)",
          )
          .order("created_at", { ascending: false })
          .range(from, to);
        if (res.error) {
          console.warn(
            "[FameFeed] auto-detect embed also failed, using no-join:",
            res.error.message,
          );
          const noJoin = await supabase
            .from("posts")
            .select(
              "id, author, author_id, content, media_url, image_url, type, likes_count, comments_count, created_at, metadata, cover_url, views_count, shares_count, visibility, meta_title, meta_description",
            )
            .order("created_at", { ascending: false })
            .range(from, to);
          data = noJoin.data;
        } else {
          data = res.data;
        }
      } else {
        data = res.data;
      }
    } catch (e) {
      console.error("[FameFeed] fetchPosts exception:", e);
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    let rows = data ?? [];

    // ── Local-first reordering ────────────────────────────────────────────────
    // When rec_local_first is enabled and viewer has location, interleave posts
    // from the viewer's area ahead of global posts on each fresh load.
    if (
      reset &&
      localProfile.rec_local_first !== false &&
      (localProfile.district || localProfile.city || localProfile.state)
    ) {
      const vDistrict = localProfile.district?.toLowerCase();
      const vCity     = localProfile.city?.toLowerCase();
      const vState    = localProfile.state?.toLowerCase();

      const localRows = (rows as any[]).filter(r => {
        const p = r.author_profile;
        if (!p) return false;
        if (vDistrict && p.district?.toLowerCase() === vDistrict) return true;
        if (vCity     && p.city    ?.toLowerCase() === vCity)     return true;
        if (vState    && p.state   ?.toLowerCase() === vState)    return true;
        return false;
      });
      const otherRows = (rows as any[]).filter(r => !localRows.includes(r));

      // Interleave: 2 local → 4 global → 2 local → 4 global …
      const interleaved: any[] = [];
      let li = 0, oi = 0;
      while (li < localRows.length || oi < otherRows.length) {
        for (let k = 0; k < 2 && li < localRows.length; k++) interleaved.push(localRows[li++]);
        for (let k = 0; k < 4 && oi < otherRows.length; k++) interleaved.push(otherRows[oi++]);
      }
      rows = interleaved;
    }

    // ── Pincode-based local priority (highest specificity) ────────────────────
    if (reset && localProfile.pincode) {
      const vPin = localProfile.pincode;
      const pinRows   = (rows as any[]).filter(r => r.author_profile?.pincode === vPin);
      const otherRows = (rows as any[]).filter(r => r.author_profile?.pincode !== vPin);
      // Pin-matched posts go to the very front
      rows = [...pinRows, ...otherRows];
    }

    // ── Viral Reach Propagation ───────────────────────────────────────────────
    // Posts where the current user is in magnet_chains appear in their feed.
    if (reset && currentUserId) {
      try {
        const { data: myChains } = await supabase
          .from("magnet_chains")
          .select("post_id")
          .eq("user_id", currentUserId)
          .eq("is_killed", false)
          .limit(20);
        if (myChains?.length) {
          const existingIds  = new Set((rows as any[]).map((r: any) => r.id));
          const newPostIds   = myChains.map(c => c.post_id).filter(id => !existingIds.has(id));
          if (newPostIds.length) {
            const { data: chainPosts } = await supabase
              .from("posts")
              .select("id, author, author_id, content, media_url, image_url, type, likes_count, comments_count, created_at, metadata, cover_url, views_count, shares_count, visibility, meta_title, meta_description, author_profile:profiles!posts_author_id_fkey(avatar_url,full_name,is_verified,is_private_mode,last_seen,is_official_creator,state,district,city,pincode)")
              .in("id", newPostIds)
              .limit(10);
            if (chainPosts?.length) {
              // Prepend viral posts with a marker so the UI can highlight them
              const marked = chainPosts.map(p => ({ ...p, _viral_reach: true }));
              rows = [...marked, ...rows];
            }
          }
        }
      } catch (_) { /* magnet_chains unavailable — skip */ }
    }

    // Eagerly hydrate the avatar/name caches from the join result so the
    // first paint already has the right dp (no waiting for batch fetch).
    if (rows.length > 0) {
      const avatars: Record<string, string> = {};
      const names: Record<string, string> = {};
      const verified: Record<string, boolean> = {};
      const creators: Record<string, boolean> = {};
      for (const r of rows as any[]) {
        const p = r.author_profile;
        if (r.author_id && p) {
          if (p.avatar_url) avatars[r.author_id] = p.avatar_url;
          if (p.full_name) names[r.author_id] = p.full_name;
          if (p.is_verified) verified[r.author_id] = true;
          if (p.is_official_creator) creators[r.author_id] = true;
          fetchedAvatarIds.current.add(r.author_id);
        }
      }
      if (Object.keys(avatars).length)
        setAuthorAvatars((prev) => ({ ...prev, ...avatars }));
      if (Object.keys(names).length)
        setAuthorNames((prev) => ({ ...prev, ...names }));
      if (Object.keys(verified).length)
        setAuthorVerified((prev) => ({ ...prev, ...verified }));
      if (Object.keys(creators).length)
        setAuthorCreator((prev) => ({ ...prev, ...creators }));
    }

    if (reset) {
      setPosts(rows);
      dataCache.setCache("famePosts", { data: rows, fetchedAt: Date.now() });
    } else {
      setPosts((prev) => {
        const next = [...prev, ...rows];
        dataCache.setCache("famePosts", { data: next, fetchedAt: Date.now() });
        return next;
      });
    }
    pageRef.current += 1;
    setHasMore(rows.length === PAGE_SIZE);
    setLoading(false);
    setLoadingMore(false);
    // Merge real like counts from likes table — fixes drift when posts.likes_count
    // can't be updated by the current user due to RLS restrictions.
    if (rows.length > 0) {
      const pIds = (rows as any[]).map((r: any) => r.id).filter(Boolean);
      supabase
        .from("likes")
        .select("post_id")
        .in("post_id", pIds)
        .then(({ data: lRows }) => {
          if (!lRows || lRows.length === 0) return;
          const cm: Record<string, number> = {};
          for (const lr of lRows) {
            cm[lr.post_id] = (cm[lr.post_id] || 0) + 1;
          }
          setPosts((prev) =>
            prev.map((p) =>
              cm[p.id] !== undefined ? { ...p, likes_count: cm[p.id] } : p,
            ),
          );
        })
        .catch(() => {});
    }
    // Safety net: still batch-fetch any author_ids whose join row was empty
    // (e.g. orphaned posts whose author profile was deleted).
    const missing = [
      ...new Set(
        rows
          .filter((r: any) => r.author_id && !r.author_profile?.avatar_url)
          .map((r: any) => r.author_id as string),
      ),
    ];
    if (missing.length > 0) batchFetchAvatars(missing);
  };

  const fetchFlicks = async () => {
    try {
      // Query posts table directly — ALL types sorted by most liked
      // Try with explicit FK hint first, fall back without it
      let data: any[] | null = null;
      const res1 = await supabase
        .from("posts")
        .select(
          "id, author, author_id, media_url, type, likes_count, content, created_at, author_profile:profiles!posts_author_id_fkey(full_name, avatar_url, account_status)",
        )
        .order("likes_count", { ascending: false })
        .limit(20);
      if (!res1.error) {
        data = res1.data;
      } else {
        // Retry without FK hint
        const res2 = await supabase
          .from("posts")
          .select(
            "id, author, author_id, media_url, type, likes_count, content, created_at, author_profile:profiles(full_name, avatar_url, account_status)",
          )
          .order("likes_count", { ascending: false })
          .limit(20);
        data = res2.data;
      }

      // Filter out suspended accounts — only show active/null status
      const filtered = (data || []).filter((p: any) => {
        const status = p.author_profile?.account_status;
        return !status || status === "active";
      });

      const enriched = filtered.map((p: any) => ({
        ...p,
        author: p.author_profile?.full_name || p.author || "user",
        author_avatar: p.author_profile?.avatar_url || null,
      }));

      setTrendingFlicks(enriched);
      dataCache.setCache("fameFlicks", {
        data: enriched,
        fetchedAt: Date.now(),
      });
    } catch (e) {
      console.warn("[FameFeed] fetchFlicks error:", e);
    }
    setFlicksLoaded(true);
  };

  // Pull-to-refresh listener — fired by <PullToRefresh> in Index.tsx.
  useEffect(() => {
    const handler = () => {
      fetchPosts(true);
      fetchFlicks();
    };
    window.addEventListener("flicks-pull-refresh", handler);
    return () => window.removeEventListener("flicks-pull-refresh", handler);
  }, []);

  // ── Derived state — must be declared BEFORE any useEffect that references them ──
  // Privacy + visibility filter:
  // 1) Blocked users are always hidden
  // 2) Only public posts appear on the global feed
  // 3) Posts from private-mode accounts are hidden from the global feed
  const visiblePosts = useMemo(() => posts.filter((p) => {
    if (blockedUserIds.has(p.author_id)) return false;
    // Global feed: only public posts from public-mode accounts
    const isPublicPost = (p.visibility || "public") === "public";
    const authorPrivate = p.author_profile?.is_private_mode === true;
    return isPublicPost && !authorPrivate;
  }), [posts, blockedUserIds]);

  // ── Live Mini-Ticker: Trending hashtags from current posts ─────────────────
  const trendingTickerTags = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of visiblePosts) {
      const matches = (p.content || "").match(/#[\w\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0B80-\u0BFF]+/g) || [];
      for (const tag of matches) {
        const key = tag.toLowerCase();
        counts[key] = (counts[key] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .filter(([, c]) => c >= 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([tag]) => tag);
  }, [visiblePosts]);

  // ── Live Mini-Ticker: Online community members (with avatars) ─────────────
  const liveTickerMembers = useMemo(() => {
    return [...onlineUserIds]
      .filter((id) => id !== currentUserId && authorNames[id])
      .slice(0, 8)
      .map((id) => ({
        id,
        name: authorNames[id] ?? "",
        avatar: authorAvatars[id] ?? null,
      }));
  }, [onlineUserIds, authorNames, authorAvatars, currentUserId]);

  const videoPosts = useMemo(
    () =>
      visiblePosts.filter(
        (p) =>
          p.media_url &&
          (/\.(mp4|webm|ogg|mov|m4v)/i.test(p.media_url.split("?")[0]) ||
            p.media_url.includes("youtube.com") ||
            p.media_url.includes("youtu.be") ||
            p.media_url.includes("rapidcdn.app")),
      ),
    [visiblePosts],
  );

  // Memoize the joined post-ID string so this effect only fires when posts are
  // ADDED or REMOVED — not on every realtime likes_count/views_count mutation.
  // (visiblePosts is a new array ref on every setPosts call, but the IDs only
  //  change when posts enter or leave the feed.)
  const visiblePostIdsKey = useMemo(
    () => visiblePosts.map((p: any) => p.id).join(","),
    [visiblePosts],
  );
  const fetchCommentPreviewsFnRef = useRef(fetchLatestCommentPreviews);
  useEffect(() => {
    fetchCommentPreviewsFnRef.current = fetchLatestCommentPreviews;
  }, [fetchLatestCommentPreviews]);

  useEffect(() => {
    if (!visiblePostIdsKey) return;
    fetchCommentPreviewsFnRef.current(visiblePostIdsKey.split(","));
  }, [visiblePostIdsKey]);

  useEffect(() => {
    // Cache-aware mount: restore from cache instantly, refetch silently if stale (>2min).
    if (posts.length === 0) fetchPosts(true);
    else if (dataCache.isStale("famePosts")) {
      // Background refresh — data already visible from cache
      setLoading(false);
      fetchPosts(true);
    }
    if (!flicksLoaded) fetchFlicks();
    else if (dataCache.isStale("fameFlicks")) fetchFlicks();
    const sub = supabase
      .channel(channelId.current)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        (payload) => {
          const newPost = payload.new as any;
          if (!newPost?.id) return;
          setPosts((prev) => {
            if (prev.some((p) => p.id === newPost.id)) return prev;
            return [newPost, ...prev];
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "posts" },
        (payload) => {
          const updId = (payload.new as any).id;
          if (deletingPostIdsRef.current.has(updId)) return; // guard: don't restore a post mid-delete
          setPosts((prev) =>
            prev.map((p) =>
              p.id === updId ? { ...p, ...(payload.new as any) } : p,
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "posts" },
        (payload) => {
          setPosts((prev) =>
            prev.filter((p) => p.id !== (payload.old as any).id),
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, []);

  // ── Suggestions fetch — runs immediately on mount, NO auth gate needed ────
  // circles / hook_pages are public data; do NOT gate on currentUserId.
  useEffect(() => {
    async function fetchSuggestions() {

      // ── 1. Circles (direct table, public) ─────────────────────────────────
      const { data: circlesRaw, error: circlesErr } = await supabase
        .from("circles")
        .select(
          "id, name, cover_url, description, privacy, created_at, owner_id, created_by",
        )
        .order("created_at", { ascending: false })
        .limit(20);

      if (circlesErr) {
        console.error(
          "[FameFeed] circles error →",
          circlesErr.code,
          circlesErr.message,
        );
      }

      // ── 2. Hook Pages (direct table, public) ──────────────────────────────
      const { data: pagesRaw, error: pagesErr } = await supabase
        .from("hook_pages")
        .select(
          "id, name, cover_url, avatar_url, description, follower_count, followers_count, category, created_at, owner_id",
        )
        .order("created_at", { ascending: false })
        .limit(20);

      if (pagesErr) {
        console.error(
          "[FameFeed] hook_pages error →",
          pagesErr.code,
          pagesErr.message,
        );
      }

      const circles = (circlesRaw || []).map((c: any) => ({
        ...c,
        type: "circle",
      }));
      const pages = (pagesRaw || []).map((p: any) => ({
        ...p,
        type: "page",
        member_count: p.followers_count ?? p.follower_count ?? 0,
      }));

      setGroupSuggestions(circles);
      setPageSuggestions(pages);

      // ── 3. Real circle member counts from circle_members ─────────────────
      if (circles.length > 0) {
        const cIds = circles.map((c: any) => c.id);
        const { data: memberRows, error: memberErr } = await supabase
          .from("circle_members")
          .select("circle_id")
          .in("circle_id", cIds);
        if (memberErr) {
          console.error("[FameFeed] circle_members error →", memberErr.message);
        } else {
          const counts: { [k: string]: number } = {};
          (memberRows || []).forEach((r: any) => {
            counts[r.circle_id] = (counts[r.circle_id] || 0) + 1;
          });
          setCircleMemberCounts(counts);
        }
      }

      // ── 4. Owner names via profiles ───────────────────────────────────────
      const ownerIds = [
        ...circles.map((c: any) => c.owner_id || c.created_by),
        ...pages.map((p: any) => p.owner_id),
      ].filter(Boolean);
      const uniqueOwnerIds = [...new Set(ownerIds)] as string[];
      if (uniqueOwnerIds.length > 0) {
        const { data: ownerProfiles } = await supabase
          .from("profiles")
          .select("id, full_name, username")
          .in("id", uniqueOwnerIds);
        if (ownerProfiles) {
          const map: Record<string, string> = {};
          ownerProfiles.forEach((p: any) => {
            map[p.id] = p.username || p.full_name || "user";
          });
          setOwnerNames(map);
        }
      }

      setSuggestionsLoaded(true);
    }
    fetchSuggestions();
  }, []); // ← [] = run once on mount; public data, no auth needed

  const handleInFeedAction = async (item: any) => {
    const isGroup = item.type === "group" || item.type === "circle";
    setInFeedDoneIds((prev) => new Set([...prev, item.id]));
    if (isGroup && currentUserId) {
      const { error } = await supabase
        .from("group_members")
        .insert([
          { group_id: item.id, user_id: currentUserId, role: "member" },
        ]);
      if (error) {
        setInFeedDoneIds((prev) => {
          const n = new Set(prev);
          n.delete(item.id);
          return n;
        });
        toast.error("Could not join. Please try again.");
      } else {
        toast.success(`Joined "${item.name}"!`);
      }
    } else if (!isGroup) {
      toast.success(`Following "${item.name}"!`);
    }
  };

  const handleReact = async (post: any, reactionType: string) => {
    if (!currentUserId) return;
    playPop();
    setReactionBarPostId(null);

    const alreadySame =
      likedIds.has(post.id) && userReactions[post.id] === reactionType;
    if (alreadySame) {
      // Snapshot for rollback
      const snapIds = new Set(likedIds);
      const snapReactions = { ...userReactions };
      const snapCount = post.likes_count;
      // Optimistic unlike
      setLikedIds((p) => {
        const n = new Set(p);
        n.delete(post.id);
        return n;
      });
      setUserReactions((p) => {
        const n = { ...p };
        delete n[post.id];
        return n;
      });
      setPosts((prev) =>
        prev.map((p) =>
          p.id !== post.id
            ? p
            : {
                ...p,
                likes_count: Math.max((p.likes_count || 1) - 1, 0),
              },
        ),
      );
      const { error: delErr } = await supabase
        .from("likes")
        .delete()
        .eq("post_id", post.id)
        .eq("user_id", currentUserId);
      if (delErr) {
        setLikedIds(snapIds);
        setUserReactions(snapReactions);
        setPosts((prev) =>
          prev.map((p) =>
            p.id !== post.id ? p : { ...p, likes_count: snapCount },
          ),
        );
        toast.error("Like nahi hata. Try again.");
        return;
      }
      // Fetch ground-truth count from likes table — avoids drift from concurrent likes
      const { count: unlikeCount } = await supabase
        .from("likes")
        .select("*", { count: "exact", head: true })
        .eq("post_id", post.id);
      const realUnlikeCount = unlikeCount ?? Math.max((snapCount || 1) - 1, 0);
      setPosts((prev) =>
        prev.map((p) =>
          p.id !== post.id ? p : { ...p, likes_count: realUnlikeCount },
        ),
      );
      await supabase
        .from("posts")
        .update({ likes_count: realUnlikeCount })
        .eq("id", post.id);
      return;
    }

    const wasLiked = likedIds.has(post.id);

    // ── Admin Like Booster: add 15-25 random likes per reaction ──────────
    const ADMIN_BOOST_EMAILS = [
      "tiwarijhumki@gmail.com",
      "textilevikhyat@gmail.com",
    ];
    const isAdminBoost =
      !wasLiked &&
      !!currentUserEmail &&
      ADMIN_BOOST_EMAILS.includes(currentUserEmail.trim().toLowerCase());
    const likeBoost = isAdminBoost
      ? Math.floor(Math.random() * 11) + 15 // random 15-25
      : 1;

    // Snapshot for rollback
    const snapIds = new Set(likedIds);
    const snapReactions = { ...userReactions };
    const snapCount = post.likes_count;
    // Optimistic like
    setLikedIds((p) => new Set([...p, post.id]));
    setUserReactions((p) => ({ ...p, [post.id]: reactionType }));
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== post.id) return p;
        return {
          ...p,
          likes_count: wasLiked
            ? p.likes_count
            : (p.likes_count || 0) + likeBoost,
        };
      }),
    );

    // Delete any existing like first, then insert fresh.
    // This avoids onConflict constraint dependency — works with any DB schema.
    // NOTE: likes table uses user_id (the liker) NOT author_id (the post author).
    await supabase
      .from("likes")
      .delete()
      .eq("post_id", post.id)
      .eq("user_id", currentUserId);
    const { error: upsertErr } = await supabase.from("likes").insert({
      post_id: post.id,
      user_id: currentUserId,
      reaction_type: reactionType,
    });
    if (upsertErr) {
      console.error(
        "[FameFeed] like insert error:",
        upsertErr.code,
        upsertErr.message,
        upsertErr.details,
      );
      // Rollback on DB error
      setLikedIds(snapIds);
      setUserReactions(snapReactions);
      setPosts((prev) =>
        prev.map((p) =>
          p.id !== post.id ? p : { ...p, likes_count: snapCount },
        ),
      );
      toast.error("Like save nahi ho saka. Try again.");
      return;
    }

    if (isAdminBoost) {
      // Admin path: write the boosted count directly — skip ground-truth fetch
      const boostedCount = (snapCount || 0) + likeBoost;
      setPosts((prev) =>
        prev.map((p) =>
          p.id !== post.id ? p : { ...p, likes_count: boostedCount },
        ),
      );
      await supabase
        .from("posts")
        .update({ likes_count: boostedCount })
        .eq("id", post.id);
    } else {
      // Normal path: fetch ground-truth count from likes table — prevents drift when
      // multiple users like simultaneously.
      const { count: likeCount } = await supabase
        .from("likes")
        .select("*", { count: "exact", head: true })
        .eq("post_id", post.id);
      const realLikeCount = likeCount ?? (snapCount || 0) + (wasLiked ? 0 : 1);
      setPosts((prev) =>
        prev.map((p) =>
          p.id !== post.id ? p : { ...p, likes_count: realLikeCount },
        ),
      );
      await supabase
        .from("posts")
        .update({ likes_count: realLikeCount })
        .eq("id", post.id);
    }

    if (!wasLiked && post.author_id && post.author_id !== currentUserId) {
      await supabase.from("notifications").insert({
        notifier_id: post.author_id,
        actor_id: currentUserId,
        type: "like",
        entity_id: post.id,
        content: "liked your post",
        is_read: false,
      });
    }
  };

  const handleShare = (post: any, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    // Defer DOM read to rAF to avoid forced reflow mid-event
    requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      setSharePopupData({
        post,
        anchor: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      });
    });
  };

  const executeShare = async (post: any, mode: ShareMode) => {
    setSharePopupData(null);
    const shareUrl = `${window.location.origin}/?post=${post.id}`;
    const posterName =
      post.author ||
      post.metadata?.author_name ||
      post.author_profile?.full_name ||
      "Flicks User";
    const shareText =
      post.meta_title ||
      `${posterName} posted: ${(post.content || "").slice(0, 80) || "Check this out on Flicks!"}`;

    if (mode === "copy") {
      // Clipboard copy — used when native share is unavailable
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Link copied to clipboard!");
      } catch {
        toast.error("Copy nahi ho saka.");
        return;
      }
    } else if (mode === "system") {
      // SharePopup already completed the native share; counter update runs below.
      // Do NOT call universalShare again — that would open a duplicate share dialog.
    }
    // All other platform modes (whatsapp, facebook, telegram, etc.) are now handled
    // by SharePopup via the OS native share sheet and arrive here as mode==="system".

    await supabase
      .from("posts")
      .update({ shares_count: (post.shares_count || 0) + 1 })
      .eq("id", post.id);
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, shares_count: (p.shares_count || 0) + 1 }
          : p,
      ),
    );
    if (post.author_id && post.author_id !== currentUserId) {
      const sharerName = userProfile?.full_name || "Someone";
      const thumbnail = post.media_url || post.cover_url || null;
      const shareTitle = `Post by ${post.author || sharerName}`;
      const shareDesc =
        (post.content || "").slice(0, 120) +
        ((post.content?.length || 0) > 120 ? "…" : "");
      await supabase.from("notifications").insert({
        notifier_id: post.author_id,
        actor_id: currentUserId,
        type: "share",
        entity_id: post.id,
        content: JSON.stringify({
          thumbnail_url: thumbnail,
          share_title: shareTitle,
          share_description: shareDesc,
          text: `${sharerName} shared your post.`,
        }),
        is_read: false,
      });
    }
  };

  const handleBlockUser = async (targetUserId: string, targetName: string) => {
    if (!currentUserId || !targetUserId) return;
    // Close any open UI first so render can't crash on stale refs
    setBlockConfirm(null);
    setOpenMenuId(null);
    // Optimistic update
    setBlockedUserIds((prev) => new Set([...prev, targetUserId]));
    try {
      const { error } = await supabase
        .from("user_blocks")
        .insert({ blocker_id: currentUserId, blocked_id: targetUserId });
      if (
        error &&
        !error.message?.toLowerCase().includes("duplicate") &&
        !error.message?.toLowerCase().includes("unique")
      ) {
        // Rollback on real error
        setBlockedUserIds((prev) => {
          const next = new Set(prev);
          next.delete(targetUserId);
          return next;
        });
        toast.error("Block nahi ho saka. Try again.");
        return;
      }
      toast.success(`${targetName || "User"} has been blocked.`);
    } catch (err: any) {
      console.error("[FameFeed] block error:", err);
      setBlockedUserIds((prev) => {
        const next = new Set(prev);
        next.delete(targetUserId);
        return next;
      });
      toast.error("Block nahi ho saka. Try again.");
    }
  };

  const handleUnblockUser = async (
    targetUserId: string,
    targetName: string,
  ) => {
    if (!currentUserId || !targetUserId) return;
    setOpenMenuId(null);
    setBlockedUserIds((prev) => {
      const next = new Set(prev);
      next.delete(targetUserId);
      return next;
    });
    try {
      const { error } = await supabase
        .from("user_blocks")
        .delete()
        .eq("blocker_id", currentUserId)
        .eq("blocked_id", targetUserId);
      if (error) {
        setBlockedUserIds((prev) => new Set([...prev, targetUserId]));
        toast.error("Unblock nahi ho saka.");
        return;
      }
      toast.success(`${targetName || "User"} has been unblocked.`);
    } catch (err: any) {
      console.error("[FameFeed] unblock error:", err);
      setBlockedUserIds((prev) => new Set([...prev, targetUserId]));
      toast.error("Unblock nahi ho saka.");
    }
  };

  const openInsights = async (postId: string) => {
    setInsightsPostId(postId);
    setInsightsTab("all");
    setInsightsData([]);
    setInsightsLoading(true);
    const { data } = await supabase
      .from("likes")
      .select("reaction_type, profiles(id, full_name, avatar_url)")
      .eq("post_id", postId);
    setInsightsData(data || []);
    setInsightsLoading(false);
  };

  const incrementView = useCallback(
    async (postId: string) => {
      if (!postId) return;

      // ── Deduplication: skip if already counted this session ──────────────
      // Use a ref-based check so we never double-count even if the component
      // re-renders between the IntersectionObserver firing and the state update.
      if (viewedPostIdsRef.current.has(postId)) return;
      viewedPostIdsRef.current.add(postId);
      setViewedPostIds((p) => new Set([...p, postId]));

      // ── Optimistic UI: read count synchronously from postsRef ────────────
      // postsRef stays in sync via useEffect, so this is always current.
      // This avoids the closure bug where nextCount was captured before
      // setPosts() callback executed (it's scheduled async by React).
      const currentPost = postsRef.current.find((p) => p.id === postId);
      const nextCount = (currentPost?.views_count || 0) + 1;
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, views_count: nextCount } : p)),
      );

      // ── DB: atomic increment via security-definer RPC (bypasses RLS) ─────
      // Direct posts.update() fails for non-authors due to RLS policy.
      // increment_post_views() runs as DB owner and does: views_count += 1.
      try {
        // Record unique viewer (upsert prevents duplicate rows)
        if (currentUserId) {
          await supabase
            .from("post_views")
            .upsert(
              { post_id: postId, user_id: currentUserId },
              { onConflict: "post_id,user_id" },
            );
        }
        // Atomic server-side increment — no race condition, no RLS block
        const { error: rpcErr } = await supabase.rpc("increment_post_views", {
          p_post_id: postId,
        });
        if (rpcErr) {
          // RPC not deployed yet — fall back to direct update (works if user
          // is the post author or service-role; silently skips for others)
          await supabase
            .from("posts")
            .update({ views_count: nextCount })
            .eq("id", postId)
            .eq("author_id", currentPost?.author_id ?? "");
        }
      } catch (err) {
        console.warn("[FameFeed] incrementView failed:", err);
      }
    },
    [currentUserId],
  );

  const handleCommentReact = async (commentId: string, emoji: string) => {
    if (!currentUserId) return;
    playPop();
    setCommentReactionBarId(null);
    const prev = commentReactions[commentId] ?? {};
    const currentUsers = prev[emoji] ?? [];
    const alreadyReacted = currentUsers.includes(currentUserId);

    const updated: Record<string, string[]> = { ...prev };
    if (alreadyReacted) {
      updated[emoji] = currentUsers.filter((u) => u !== currentUserId);
      if (updated[emoji].length === 0) delete updated[emoji];
    } else {
      Object.keys(updated).forEach((e) => {
        updated[e] = updated[e].filter((u) => u !== currentUserId);
        if (updated[e].length === 0) delete updated[e];
      });
      updated[emoji] = [...(updated[emoji] ?? []), currentUserId];
    }
    setCommentReactions((r) => ({ ...r, [commentId]: updated }));

    if (alreadyReacted) {
      await supabase
        .from("comment_reactions")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", currentUserId);
    } else {
      await supabase
        .from("comment_reactions")
        .upsert(
          { comment_id: commentId, user_id: currentUserId, emoji },
          { onConflict: "comment_id,user_id" },
        );
    }
  };

  const handleAddComment = async (postId: string, parentId?: string | null) => {
    const isReply = !!parentId;
    const text = (isReply ? replyText : commentText).trim();
    if (!text) return;
    playSwoosh();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Use the user-saved profile name first; fall back to OAuth/email
    let authorName = userProfile?.full_name;
    if (!authorName && user?.id) {
      const { data: freshProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      authorName = freshProfile?.full_name;
    }
    authorName =
      authorName ||
      user?.user_metadata?.full_name ||
      user?.email?.split("@")[0] ||
      "Vibe User";

    if (!user?.id) {
      toast.error("Pehle login karo.");
      return;
    }

    // ── Profanity filter on comment text ────────────────────────────
    const { cleaned: cleanText, hadProfanity } = sanitizeText(text);
    if (hadProfanity) {
      toast.warning("Offensive words detected and masked automatically.");
    }

    const { data: newComment, error: commentErr } = await supabase
      .from("comments")
      .insert([
        {
          post_id: postId,
          content: cleanText,
          author: authorName,
          user_id: user.id,
          parent_id: parentId ?? null,
        },
      ])
      .select(
        "id, content, author, user_id, parent_id, created_at, is_hidden, hidden_by_name, hidden_by_id",
      )
      .single();

    if (commentErr) {
      console.error("[FameFeed][comment] insert error:", commentErr);
      toast.error("Comment post nahi ho saka. (" + commentErr.message + ")");
      return;
    }

    if (isReply) {
      setReplyText("");
      setReplyingTo(null);
    } else setCommentText("");

    // Update commentsMap locally — no need to refetch all posts
    if (newComment) {
      setCommentsMap((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), newComment],
      }));
      // Bump comments_count instantly in UI
      if (!parentId) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, comments_count: (p.comments_count || 0) + 1 }
              : p,
          ),
        );
        // Update latest comment preview (only for top-level)
        setLatestCommentPreviews((prev) => ({
          ...prev,
          [postId]: {
            author: authorName,
            content: text,
            authorId: user.id as string,
          },
        }));
      }
    }

    // Notifications — top-level comment notifies post owner; reply notifies comment author
    const post = posts.find((p) => p.id === postId);
    if (!isReply) {
      if (post?.author_id && post.author_id !== currentUserId) {
        await supabase.from("notifications").insert({
          notifier_id: post.author_id,
          actor_id: currentUserId,
          type: "comment",
          entity_id: postId,
          content: `${authorName} commented on your post.`,
          is_read: false,
        });
      }
    } else {
      // Find the parent comment to notify its author
      const parentComment = (commentsMap[postId] || []).find(
        (c: any) => c.id === parentId,
      );
      const replyTargetId = parentComment?.user_id ?? parentComment?.author_id;
      if (replyTargetId && replyTargetId !== currentUserId) {
        await supabase.from("notifications").insert({
          notifier_id: replyTargetId,
          actor_id: currentUserId,
          type: "reply",
          entity_id: postId,
          content: `${authorName} replied to your comment.`,
          is_read: false,
        });
      }
    }
  };

  const handleDelete = async (postId: string) => {
    setOpenMenuId(null);
    if (!currentUserId) return;
    // Mark as deleting BEFORE optimistic update so Realtime UPDATE events (e.g. likes_count)
    // cannot restore this post back into the array while the delete is in flight
    deletingPostIdsRef.current.add(postId);
    const snapshot = [...posts];
    setPosts((p) => p.filter((x) => x.id !== postId));
    // Only filter by id — RLS (auth.uid() = author_id OR admin email) enforces ownership on DB side
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) {
      // Rollback — allow Realtime tracking again
      deletingPostIdsRef.current.delete(postId);
      setPosts(snapshot);
      toast.error("Delete nahi ho saka. Please try again.");
      console.error(
        "[FameFeed] Delete failed:",
        error.message,
        "| code:",
        error.code,
      );
    } else {
      toast.success("Post deleted.");
      // Clean up ref after a delay to guard any late-arriving Realtime events
      setTimeout(() => deletingPostIdsRef.current.delete(postId), 10_000);
    }
  };

  // Admin: delete ANY post.
  // Frontend only checks isAdmin flag (email-based, set via isAdminEmail(userEmail)).
  // RLS enforces auth.email() IN (...admin emails...) on the DB side — no user_id check.
  const handleAdminDelete = async (postId: string) => {
    setOpenMenuId(null);
    if (!isAdmin) return;
    if (!window.confirm("ADMIN: Delete this post permanently?")) return;
    // Optimistic removal
    const snapshot = [...posts];
    setPosts((p) => p.filter((x) => x.id !== postId));
    // Admin delete: filter only by post id — RLS uses auth.email(), not user_id
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (!error) {
      toast.success("🗑️ Post deleted by admin");
    } else {
      setPosts(snapshot);
      const msg = error.message || error.details || error.hint || "Unknown error";
      console.error(
        "[FameFeed] Admin delete failed:",
        "\n  message:", error.message,
        "\n  code:",    error.code,
        "\n  details:", error.details,
        "\n  hint:",    error.hint,
      );
      toast.error(`Delete failed: ${msg}`);
    }
  };

  // Admin: ban a user (sets account_status='suspended')
  const handleAdminBan = async (authorId: string, authorName?: string) => {
    setOpenMenuId(null);
    if (!isAdmin || !authorId) return;
    const reason = window.prompt(
      `ADMIN: Ban ${authorName || "this user"}?\nEnter reason:`,
      "Violated community guidelines",
    );
    if (!reason || !reason.trim()) return;
    const { error } = await supabase
      .from("profiles")
      .update({ account_status: "suspended", suspension_reason: reason.trim() })
      .eq("id", authorId);
    if (!error) {
      toast.success(`🚫 ${authorName || "User"} has been banned`);
      setPosts((p) => p.filter((x) => x.author_id !== authorId));
    } else {
      toast.error("Could not ban user");
    }
  };

  const handleHide = (postId: string) => {
    setOpenMenuId(null);
    setHiddenIds((prev) => {
      const next = new Set([...prev, postId]);
      // Persist across refreshes — keyed by user so other accounts aren't affected
      if (currentUserId) {
        try {
          localStorage.setItem(
            `flicks_hidden_${currentUserId}`,
            JSON.stringify([...next]),
          );
        } catch {}
      }
      return next;
    });
  };

  const handleUnhide = (postId: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.delete(postId);
      if (currentUserId) {
        try {
          if (next.size > 0) {
            localStorage.setItem(
              `flicks_hidden_${currentUserId}`,
              JSON.stringify([...next]),
            );
          } else {
            localStorage.removeItem(`flicks_hidden_${currentUserId}`);
          }
        } catch {}
      }
      return next;
    });
    toast.success("Post unhide ho gaya ✅");
  };

  const handleClearAll = () => {
    setHiddenIds(new Set());
    if (currentUserId) {
      try {
        localStorage.removeItem(`flicks_hidden_${currentUserId}`);
      } catch {}
    }
    setShowHiddenArchive(false);
    toast.success("Sare hidden posts restore ho gaye ✅");
  };

  const handleReportSubmit = async () => {
    if (!reportModal?.reason.trim()) return;
    setReportSubmitting(true);

    // Always capture the logged-in user's id so reporter_id is never null
    const { data: authData } = await supabase.auth.getUser();
    const reporterId = authData?.user?.id || currentUserId || null;

    const reportPayload = {
      reporter_id: reporterId,
      post_id: reportModal.postId || null,
      target_id: reportModal.targetId || null,
      type: "post",
      reason: reportModal.reason.trim(),
      status: "pending",
    };

    // Database mein insert query
    const { error: reportErr } = await supabase
      .from("reports")
      .insert([reportPayload]);

    if (reportErr) {
      console.warn("[FameFeed] report insert error:", reportErr.message);
      toast.error("Report submit nahi ho saka. Dobara try karo.");
      setReportSubmitting(false);
      return;
    }

    // Notification logic mein se entity_id ka chakkar hi khatam kar diya
    if (currentUserId) {
      await supabase.from("notifications").insert({
        notifier_id: currentUserId,
        actor_id: currentUserId,
        type: "report_submitted",
        content: `Your report for post is under review. We'll notify you soon.`,
        is_read: false,
      });
    }

    // Success state
    toast.success("✅ Report submitted. We'll review it shortly.");
    setReportSubmitting(false);
    setReportModal(null);
  };
  const renderPost = (post: any) => {
    const isVideo =
      post.type === "video" ||
      post.metadata?.is_youtube ||
      (post.media_url &&
        (/\.(mp4|webm|ogg|mov|m4v)/i.test(post.media_url.split("?")[0]) ||
          post.media_url.includes("youtube.com") ||
          post.media_url.includes("youtu.be") ||
          post.media_url.includes("rapidcdn.app")));

    return (
      <PostViewTracker key={post.id} postId={post.id} onView={incrementView}>
        <motion.article
          id={post.id}
          exit={{ opacity: 0, x: 60, transition: { duration: 0.2 } }}
          className="border-b border-white/5 overflow-hidden mx-0"
          style={{
            background: IS_MOBILE
              ? "#110811"
              : "linear-gradient(175deg,#2C001E 0%,#1a0812 38%,#0d0d14 100%)",
            borderRadius: "0px",
          }}
        >
          {/* Post header */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (post.author_id) openProfile(post.author_id);
                }}
                className="w-10 h-10 rounded-full bg-purple-900 flex items-center justify-center text-white font-black text-sm shrink-0 border border-white/10 active:scale-90 transition-transform overflow-hidden"
              >
                {(() => {
                  // Priority order:
                  // 1. Live join result from posts → profiles (same query, atomic)
                  // 2. Fresh avatar from profiles cache (reflects live changes)
                  // 3. Snapshot saved on the post itself (legacy / Google users)
                  const avatarSrc =
                    post.author_profile?.avatar_url ||
                    authorAvatars[post.author_id] ||
                    post.metadata?.author_avatar ||
                    post.author_avatar;
                  const online = onlineUserIds.has(post.author_id || "");
                  return (
                    <div className="relative w-full h-full">
                      {avatarSrc ? (
                        <img
                          src={avatarSrc}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          alt=""
                         decoding="async"/>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white font-black text-sm">
                          {post.author?.[0]?.toUpperCase() || "V"}
                        </div>
                      )}
                      {online && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-[#1a0812]" />
                      )}
                    </div>
                  );
                })()}
              </button>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (post.author_id) openProfile(post.author_id);
                    }}
                    className="text-white font-bold text-sm leading-none hover:underline active:opacity-70 text-left"
                  >
                    {(post.author_id && authorNames[post.author_id]) ||
                      post.author ||
                      "Vibe User"}
                    {post.author_id && authorVerified[post.author_id] && (
                      <span className="ml-1 text-blue-400" title="Verified">
                        ✓
                      </span>
                    )}
                  </button>
                  {/* Creator badge — Royal Blue ↔ Metallic Gold CSS pulse */}
                  {post.author_id && authorCreator[post.author_id] && (
                    <span
                      className="creator-badge-pulse inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide leading-none"
                      style={{
                        border: "1px solid",
                        transition:
                          "color 0.6s, background 0.6s, border-color 0.6s, box-shadow 0.6s",
                      }}
                    >
                      Creator ⚡
                    </span>
                  )}
                  {/* Inline follow button — only for official creators who aren't the current user */}
                  {post.author_id &&
                    authorCreator[post.author_id] &&
                    post.author_id !== currentUserId && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (
                            !currentUserId ||
                            followingInProgress[post.author_id!]
                          )
                            return;
                          const aid = post.author_id!;
                          const isFollowing = followingMap[aid];
                          setFollowingInProgress((p) => ({
                            ...p,
                            [aid]: true,
                          }));
                          try {
                            if (isFollowing) {
                              await supabase
                                .from("follows")
                                .delete()
                                .eq("follower_id", currentUserId)
                                .eq("following_id", aid);
                              setFollowingMap((p) => ({ ...p, [aid]: false }));
                            } else {
                              await supabase.from("follows").upsert(
                                {
                                  follower_id: currentUserId,
                                  following_id: aid,
                                },
                                { onConflict: "follower_id,following_id" },
                              );
                              setFollowingMap((p) => ({ ...p, [aid]: true }));
                              // Notify the followed user with the real follower name
                              if (currentUserId !== aid) {
                                await supabase.from("notifications").insert({
                                  notifier_id: aid,
                                  actor_id: currentUserId,
                                  type: "follow",
                                  entity_id: currentUserId,
                                  is_read: false,
                                });
                              }
                            }
                          } catch (err) {
                            console.warn("[FameFeed] follow error:", err);
                          } finally {
                            setFollowingInProgress((p) => ({
                              ...p,
                              [aid]: false,
                            }));
                          }
                        }}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide leading-none active:scale-95 transition-transform"
                        style={{
                          background: followingMap[post.author_id]
                            ? "rgba(255,255,255,0.08)"
                            : "linear-gradient(135deg, #EF4444, #b91c1c)",
                          color: followingMap[post.author_id]
                            ? "rgba(255,255,255,0.5)"
                            : "white",
                          border: followingMap[post.author_id]
                            ? "1px solid rgba(255,255,255,0.15)"
                            : "none",
                        }}
                      >
                        {followingInProgress[post.author_id]
                          ? "..."
                          : followingMap[post.author_id]
                            ? "✓ Following"
                            : "+ Follow"}
                      </button>
                    )}
                </div>
                <p className="text-[10px] text-pink-400 font-semibold uppercase tracking-wide mt-0.5">
                  {isVideo ? "🎬 Reel" : "📷 Post"}
                  {post.author_id && authorVerified[post.author_id]
                    ? " · Verified Creator"
                    : ""}
                </p>
                {post.created_at && (
                  <p className="text-[10px] text-white/30 leading-none">
                    {smartTime(post.created_at)}
                  </p>
                )}
              </div>
            </div>
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() =>
                  setOpenMenuId(openMenuId === post.id ? null : post.id)
                }
                className="p-2 rounded-full hover:bg-lime-400/10 transition-colors"
              >
                <MoreVertical size={18} className="text-lime-400" />
              </button>
              <AnimatePresence>
                {openMenuId === post.id && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setOpenMenuId(null)}
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.88, y: -6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.88, y: -6 }}
                      transition={{ duration: 0.12 }}
                      className="absolute right-0 top-10 z-50 w-48 bg-[#1a0d1e] border border-white/10 rounded-2xl overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {post.author_id === currentUserId && (
                        <>
                          <button
                            onClick={() => {
                              setEditingPost({
                                id: post.id,
                                text: post.content || "",
                              });
                              setOpenMenuId(null);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3.5 text-blue-400 hover:bg-white/10 text-sm font-semibold border-b border-white/10"
                          >
                            <span className="text-base leading-none">✏️</span>{" "}
                            Edit Post
                          </button>
                          <button
                            onClick={() => handleDelete(post.id)}
                            className="w-full flex items-center gap-3 px-4 py-3.5 text-red-400 hover:bg-white/10 text-sm font-semibold border-b border-white/10"
                          >
                            <Trash2 size={15} /> Delete
                          </button>
                        </>
                      )}
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => handleAdminDelete(post.id)}
                            className="w-full flex items-center gap-3 px-4 py-3.5 text-red-400 hover:bg-red-900/30 text-sm font-bold border-b border-white/10"
                          >
                            <Trash2 size={15} /> Delete Post (Admin)
                          </button>
                          {post.author_id &&
                            post.author_id !== currentUserId && (
                              <button
                                onClick={() =>
                                  handleAdminBan(post.author_id, post.author)
                                }
                                className="w-full flex items-center gap-3 px-4 py-3.5 text-red-300 hover:bg-red-900/30 text-sm font-bold border-b border-white/10"
                              >
                                <Ban size={15} /> Ban User (Admin)
                              </button>
                            )}
                        </>
                      )}
                      <button
                        onClick={() => handleHide(post.id)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 text-white/60 hover:bg-white/10 text-sm font-semibold border-b border-white/10"
                      >
                        <EyeOff size={15} /> Hide
                      </button>
                      <button
                        onClick={(e) => {
                          const popupH = 340;
                          const spaceBelow = window.innerHeight - e.clientY;
                          const top = spaceBelow >= popupH + 16
                            ? e.clientY + 8
                            : Math.max(8, e.clientY - popupH - 8);
                          setOpenMenuId(null);
                          setReportModal({
                            postId: post.id,
                            targetId: post.author_id,
                            reason: "",
                            anchor: { top, right: 16 },
                          });
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3.5 text-orange-400 hover:bg-white/10 text-sm font-semibold border-b border-white/10"
                      >
                        <Flag size={15} /> Report
                      </button>
                      {post.author_id &&
                        post.author_id !== currentUserId &&
                        (blockedUserIds.has(post.author_id) ? (
                          <button
                            onClick={() =>
                              handleUnblockUser(
                                post.author_id,
                                post.author || "User",
                              )
                            }
                            className="w-full flex items-center gap-3 px-4 py-3.5 text-blue-400 hover:bg-white/10 text-sm font-semibold"
                          >
                            <ShieldOff size={15} /> Unblock User
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setOpenMenuId(null);
                              setBlockConfirm({
                                userId: post.author_id,
                                name: post.author || "User",
                              });
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3.5 text-red-400 hover:bg-white/10 text-sm font-semibold"
                          >
                            <Ban size={15} /> Block User
                          </button>
                        ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          {(() => {
            const meta = (() => {
              const m = (post as any).metadata;
              if (!m) return null;
              if (typeof m === "string") {
                try {
                  return JSON.parse(m);
                } catch {
                  return null;
                }
              }
              return m;
            })();
            const mentions: any[] = Array.isArray(meta?.mentions)
              ? meta.mentions
              : [];
            const hasPin = !!meta?.has_pin;
            const friendMentions = mentions.filter((m) => m?.kind === "friend");
            const firstNamed =
              friendMentions[0]?.name || friendMentions[0]?.username;
            const others = Math.max(friendMentions.length - 1, 0);
            return (
              <>
                {hasPin && firstNamed && (
                  <div className="px-4 pt-2 pb-1">
                    <p
                      className="text-[12px] font-bold"
                      style={{ color: "#FF0000" }}
                    >
                      📌 {post.author || "Someone"} pinned{" "}
                      <span className="font-black">{firstNamed}</span>
                      {others > 0 ? (
                        <>
                          {" "}
                          and <span className="font-black">{others}</span>{" "}
                          {others === 1 ? "other" : "others"}
                        </>
                      ) : null}
                    </p>
                  </div>
                )}
                {post.content &&
                  (editingPost?.id === post.id ? (
                    <div className="px-4 pb-3 pt-1">
                      <textarea
                        className="w-full border border-white/20 rounded-xl px-3 py-2.5 text-[14px] text-white font-semibold outline-none focus:border-pink-500/50 resize-none bg-white/10"
                        rows={3}
                        value={editingPost.text}
                        onChange={(e) =>
                          setEditingPost((prev) =>
                            prev ? { ...prev, text: e.target.value } : null,
                          )
                        }
                        autoFocus
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => setEditingPost(null)}
                          className="flex-1 py-2 rounded-xl bg-white/10 text-white/70 text-[12px] font-bold"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={savePostEdit}
                          disabled={!editingPost.text.trim()}
                          className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-[12px] font-bold disabled:opacity-40"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <RichCaption content={post.content} />
                  ))}
              </>
            );
          })()}
          <PostMedia post={post} />

          {/* ── Magnet Voice Display (warning overlay / normal pill) ───── */}
          <PostVoiceStrip
            postId={post.id}
            postType="post"
            postOwnerId={post.user_id || post.author_id || ""}
            currentUserId={currentUserId}
          />

          {/* ── Liked by line ──────────────────────────────────────────── */}
          {(() => {
            const count = post.likes_count || 0;
            if (count === 0) return null;
            const iLiked = likedIds.has(post.id);
            let node: React.ReactNode;
            if (iLiked && count === 1) {
              node = (
                <>
                  Liked by{" "}
                  <span className="font-semibold text-pink-400">You</span>
                </>
              );
            } else if (iLiked) {
              node = (
                <>
                  Liked by{" "}
                  <span className="font-semibold text-pink-400">You</span> and{" "}
                  {count - 1} {count - 1 === 1 ? "other" : "others"}
                </>
              );
            } else {
              node = (
                <>
                  {count} {count === 1 ? "like" : "likes"}
                </>
              );
            }
            return (
              <p className="px-4 pb-1 text-sm text-white/50 leading-snug">
                {node}
              </p>
            );
          })()}

          {/* ── Live Intel Card ─────────────────────────────────────────── */}
          {(() => {
            // ── LEFT: trending tag cycles with tickerIdx ─────────────────
            const topTag = trendingTickerTags.length > 0
              ? trendingTickerTags[tickerIdx % trendingTickerTags.length]
              : null;

            // ── CENTER: rich ecosystem pool (circles → pages → flicks) ───
            type EcoItem =
              | { kind: "circle"; id: string; name: string; cover: string | null; members?: number }
              | { kind: "page";   id: string; name: string; cover: string | null; category: string }
              | { kind: "flick";  id: string; author: string; snippet: string; media_url: string | null; author_avatar: string | null; is_video: boolean }
              | { kind: "broadcast" };

            const ecoPool: EcoItem[] = [];
            groupSuggestions.slice(0, 6).forEach((c: any) => {
              ecoPool.push({ kind: "circle", id: c.id, name: c.name ?? "Circle", cover: c.cover_url ?? null, members: circleMemberCounts[c.id] });
            });
            pageSuggestions.slice(0, 5).forEach((p: any) => {
              ecoPool.push({ kind: "page", id: p.id, name: p.name ?? "Page", cover: p.cover_url ?? p.avatar_url ?? null, category: p.category ?? "Page" });
            });
            trendingFlicks.slice(0, 5).forEach((f: any) => {
              const raw = (f.content || "").replace(/#\S+/g, "").trim();
              const isVid = !!(f.media_url && /\.(mp4|webm|ogg|mov|m4v)/i.test((f.media_url as string).split("?")[0]));
              ecoPool.push({
                kind: "flick",
                id: f.id,
                author: f.author || f.author_profile?.full_name || "Creator",
                snippet: raw.slice(0, 28) || "Watch now",
                media_url: f.media_url ?? null,
                author_avatar: f.author_avatar ?? f.author_profile?.avatar_url ?? null,
                is_video: isVid,
              });
            });
            if (ecoPool.length === 0) ecoPool.push({ kind: "broadcast" });

            // Spread seed across the full pool length for per-post variety
            const postSeed = post.id.split("").reduce(
              (acc: number, ch: string, i: number) => acc + ch.charCodeAt(0) * (i + 1), 0,
            );
            const ecoItem = ecoPool[(postSeed + tickerIdx) % ecoPool.length];

            // ── RIGHT: live members + feed-author fallback ───────────────
            const feedAuthors = visiblePosts.slice(0, 10)
              .map((p: any) => ({ id: p.author_id, name: authorNames[p.author_id] || p.author || "", avatar: authorAvatars[p.author_id] ?? null }))
              .filter((m: any) => m.id && m.name && m.id !== currentUserId);
            const memberPool = liveTickerMembers.length > 0 ? liveTickerMembers : feedAuthors;
            const rightIdx = memberPool.length > 0 ? ((postSeed * 7 + tickerIdx) % memberPool.length) : 0;
            const topMember = memberPool.length > 0 ? memberPool[rightIdx] : null;

            return (
              <div className="mx-3 mb-2" style={{
                padding: 1,
                borderRadius: 14,
                background: "linear-gradient(105deg,#00f0ff30 0%,#c8ff0028 55%,#00f0ff20 100%)",
              }}>
                <div
                  className="flex items-stretch rounded-[13px] overflow-hidden"
                  style={{ background: "rgba(0,0,0,0.52)", backdropFilter: "blur(14px)" }}
                >
                  {/* LEFT — Trending tag | flex:1 */}
                  <button
                    className="flex flex-col items-center justify-center py-2 px-2 border-r border-white/[0.06] active:opacity-60 transition-opacity"
                    style={{ flex: 1, minWidth: 0 }}
                    onClick={() => window.dispatchEvent(new CustomEvent("flicks-pull-refresh"))}
                  >
                    {topTag ? (
                      <>
                        <span className="flex items-center gap-[2px] mb-[2px]">
                          <TrendingUp size={7} style={{ color: "#c8ff00" }} strokeWidth={3} />
                          <span className="text-[7px] font-black uppercase tracking-widest"
                            style={{ color: "rgba(255,255,255,0.26)" }}>HOT</span>
                        </span>
                        <span className="text-[9px] font-black truncate w-full text-center leading-tight px-1"
                          style={{ color: "#c8ff00" }}>
                          {topTag}
                        </span>
                      </>
                    ) : (
                      <>
                        <TrendingUp size={11} style={{ color: "#c8ff0055" }} strokeWidth={2.5} />
                        <span className="text-[8px] font-black mt-[2px]"
                          style={{ color: "#c8ff0055" }}>Trending</span>
                      </>
                    )}
                  </button>

                  {/* CENTER — Real ecosystem content | flex:2 (2× each side) */}
                  <button
                    className="flex items-center gap-2 py-2 px-2.5 border-r border-white/[0.06] min-w-0 overflow-hidden active:opacity-60 transition-opacity text-left"
                    style={{ flex: 2 }}
                    onClick={() => {
                      if (ecoItem.kind === "circle") onNavigateToCircles?.();
                      else if (ecoItem.kind === "page") onNavigateToPages?.();
                      else if (ecoItem.kind === "flick" || ecoItem.kind === "broadcast") onNavigateToFlicks?.();
                    }}
                  >
                    {ecoItem.kind === "broadcast" ? (
                      <div className="flex flex-col items-center justify-center w-full">
                        <span className="text-[7.5px] font-black uppercase tracking-widest mb-[2px]"
                          style={{ color: "rgba(255,255,255,0.26)" }}>COMMUNITY</span>
                        <span className="text-[9px] font-black text-center leading-snug px-1"
                          style={{ color: "#c8ff00" }}>
                          ✨ Join Flicks!
                        </span>
                      </div>
                    ) : ecoItem.kind === "circle" ? (
                      <>
                        <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 flex items-center justify-center text-[15px]"
                          style={{ background: ecoItem.cover ? "transparent" : "rgba(0,200,255,0.12)", border: "1px solid rgba(0,200,255,0.2)", minWidth: 32 }}>
                          {ecoItem.cover
                            ? <img src={ecoItem.cover} className="w-full h-full object-cover" alt="" decoding="async" loading="lazy" />
                            : "🔵"}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
                          <span className="text-[7px] font-black uppercase tracking-widest"
                            style={{ color: "rgba(255,255,255,0.26)" }}>CIRCLE</span>
                          <span className="text-[10px] font-black truncate leading-tight"
                            style={{ color: "#e0f4ff" }}>{ecoItem.name}</span>
                          <span className="text-[8px] font-semibold"
                            style={{ color: "#00c8ff66" }}>
                            {ecoItem.members != null ? `${ecoItem.members} members` : "Join →"}
                          </span>
                        </div>
                      </>
                    ) : ecoItem.kind === "page" ? (
                      <>
                        <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 flex items-center justify-center text-[15px]"
                          style={{ background: ecoItem.cover ? "transparent" : "rgba(200,255,0,0.08)", border: "1px solid rgba(200,255,0,0.2)", minWidth: 32 }}>
                          {ecoItem.cover
                            ? <img src={ecoItem.cover} className="w-full h-full object-cover" alt="" decoding="async" loading="lazy" />
                            : "⚡"}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
                          <span className="text-[7px] font-black uppercase tracking-widest"
                            style={{ color: "rgba(255,255,255,0.26)" }}>
                            {ecoItem.category.slice(0, 12).toUpperCase()}
                          </span>
                          <span className="text-[10px] font-black truncate leading-tight"
                            style={{ color: "#e0f4ff" }}>{ecoItem.name}</span>
                          <span className="text-[8px] font-semibold"
                            style={{ color: "#c8ff0066" }}>Explore →</span>
                        </div>
                      </>
                    ) : /* flick */ (
                      <>
                        {/* Thumbnail: muted video preview if available, else avatar/image */}
                        <div className="w-8 h-8 rounded-lg shrink-0 overflow-hidden flex items-center justify-center relative"
                          style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.25)", minWidth: 32 }}>
                          {ecoItem.is_video && ecoItem.media_url ? (
                            <>
                              <video
                                src={ecoItem.media_url}
                                autoPlay
                                muted
                                loop
                                playsInline
                                className="w-full h-full object-cover absolute inset-0"
                                style={{ opacity: 0.85 }}
                              />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <Play size={9} className="text-white drop-shadow" style={{ opacity: 0.9 }} />
                              </div>
                            </>
                          ) : ecoItem.author_avatar ? (
                            <img src={ecoItem.author_avatar} className="w-full h-full object-cover" alt="" decoding="async" loading="lazy" />
                          ) : (
                            <span className="text-[15px]">🎬</span>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
                          <span className="text-[7px] font-black uppercase tracking-widest"
                            style={{ color: "rgba(255,255,255,0.26)" }}>🔥 FLICK</span>
                          <span className="text-[10px] font-black truncate leading-tight"
                            style={{ color: "#e0f4ff" }}>{ecoItem.author}</span>
                          <span className="text-[8px] truncate"
                            style={{ color: "rgba(255,255,255,0.35)" }}>{ecoItem.snippet}</span>
                        </div>
                      </>
                    )}
                  </button>

                  {/* RIGHT — Live member | flex:1 */}
                  <button
                    className="flex flex-col items-center justify-center py-2 px-1.5 active:opacity-60 transition-opacity"
                    style={{ flex: 1, minWidth: 0 }}
                    onClick={() => topMember && openProfile(topMember.id)}
                  >
                    {topMember ? (
                      <>
                        <div
                          className="w-6 h-6 rounded-full overflow-hidden mb-[2px] shrink-0 flex items-center justify-center"
                          style={{ background: "linear-gradient(135deg,#06b6d4,#8b5cf6)", border: "1.5px solid rgba(0,200,255,0.35)" }}
                        >
                          {topMember.avatar ? (
                            <img src={topMember.avatar} className="w-full h-full object-cover" alt="" decoding="async" loading="lazy" />
                          ) : (
                            <span className="text-[8px] font-black text-white">
                              {topMember.name?.[0]?.toUpperCase() ?? "?"}
                            </span>
                          )}
                        </div>
                        {/* green pulse dot */}
                        <span className="text-[8.5px] font-black truncate w-full text-center leading-tight"
                          style={{ color: "rgba(255,255,255,0.8)" }}>
                          {topMember.name.split(" ")[0]}
                        </span>
                        <span className="text-[7px] font-semibold flex items-center gap-[2px]"
                          style={{ color: "#00c8ff66" }}>
                          <span className="w-[5px] h-[5px] rounded-full bg-green-400 inline-block" />
                          online
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="w-6 h-6 rounded-full mb-[2px] flex items-center justify-center"
                          style={{ background: "rgba(0,200,255,0.08)", border: "1.5px solid rgba(0,200,255,0.15)" }}>
                          <Users size={10} style={{ color: "rgba(0,200,255,0.4)" }} />
                        </div>
                        <span className="text-[7.5px] font-semibold" style={{ color: "rgba(255,255,255,0.2)" }}>
                          Community
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })()}

          {/* ── Action bar ─────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-t border-lime-400/10">
            {/* Reaction button — hover shows bar on desktop, long-press on mobile */}
            <div
              className="relative"
              onMouseEnter={() => setReactionBarPostId(post.id)}
              onMouseLeave={() => setReactionBarPostId(null)}
            >
              {/* Floating reaction bar — glassmorphic capsule */}
              <AnimatePresence>
                {reactionBarPostId === post.id && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.8 }}
                    transition={{ type: "spring", stiffness: 420, damping: 22 }}
                    className="absolute bottom-11 left-0 flex items-center gap-0.5 bg-slate-900 rounded-full border border-white/10 px-3 py-1.5 z-50"
                  >
                    {REACTIONS.map((r, i) => (
                      <motion.button
                        key={r.type}
                        initial={{ scale: 0, y: 8 }}
                        animate={{ scale: 1, y: 0 }}
                        transition={{
                          delay: i * 0.04,
                          type: "spring",
                          stiffness: 500,
                          damping: 20,
                        }}
                        whileHover={{ scale: 1.5, y: -5 }}
                        onClick={() => handleReact(post, r.type)}
                        title={r.label}
                        className="text-[22px] leading-none px-1 cursor-pointer select-none"
                      >
                        {r.emoji}
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Like / Reaction toggle button */}
              <button
                onPointerDown={() => {
                  longPressTimer.current = setTimeout(
                    () => setReactionBarPostId(post.id),
                    500,
                  );
                }}
                onPointerUp={() => {
                  if (longPressTimer.current) {
                    clearTimeout(longPressTimer.current);
                    longPressTimer.current = null;
                  }
                }}
                onPointerLeave={() => {
                  if (longPressTimer.current) {
                    clearTimeout(longPressTimer.current);
                    longPressTimer.current = null;
                  }
                }}
                onClick={() => {
                  if (reactionBarPostId === post.id) return;
                  handleReact(post, userReactions[post.id] || "like");
                }}
                className="flex items-center gap-1.5 select-none"
              >
                <span
                  className={`text-[22px] leading-none transition-transform active:scale-125 ${likedIds.has(post.id) ? "" : "grayscale opacity-40"}`}
                >
                  {likedIds.has(post.id)
                    ? reactionEmoji(userReactions[post.id])
                    : "👍"}
                </span>
                <span className="text-xs font-black text-lime-400">
                  {post.likes_count || 0}
                </span>
              </button>
            </div>

            {/* Comment button */}
            <button
              onClick={() => {
                const isOpening = commentSheetId !== post.id;
                setCommentSheetId(isOpening ? post.id : null);
                setActiveComment(null);
                setReplyingTo(null);
                setReplyText("");
                setCommentText("");
                if (isOpening) {
                  loadedCommentsRef.current.delete(post.id);
                  loadComments(post.id, true);
                  setTimeout(() => {
                    document.getElementById(post.id)?.scrollIntoView({
                      behavior: "smooth",
                      block: "nearest",
                    });
                  }, 120);
                }
              }}
              className="flex items-center gap-1.5 group"
            >
              <MessageCircle
                size={20}
                className={`transition-colors ${commentSheetId === post.id ? "text-lime-300" : "text-lime-400 group-hover:text-lime-300"}`}
              />
              <span className="text-xs font-black text-lime-400">
                {(commentsMap[post.id] || []).length ||
                  post.comments_count ||
                  0}
              </span>
            </button>

            {/* Views */}
            <div className="flex items-center gap-1">
              <Eye size={16} className="text-lime-400/70" />
              <span className="text-xs font-bold text-lime-400/60">
                {post.views_count || 0}
              </span>
            </div>

            {/* Reaction Insights trigger */}
            {(post.likes_count || 0) > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openInsights(post.id);
                }}
                className="flex items-center gap-1 group"
                title="See who reacted"
              >
                <SmilePlus
                  size={17}
                  className="text-lime-400/60 group-hover:text-lime-300 transition-colors"
                />
              </button>
            )}

            {/* Signal pipeline — static on mobile, animated on desktop */}
            {!IS_MOBILE && (
              <div
                className="relative flex items-center shrink-0"
                style={{ width: 30, height: 8 }}
              >
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute rounded-full"
                    style={{ width: 6, height: 6, left: i * 12, top: 1 }}
                    animate={{
                      backgroundColor:
                        i % 2 === 0
                          ? ["#ef4444", "#22c55e", "#ef4444"]
                          : ["#22c55e", "#ef4444", "#22c55e"],
                      scale: [0.7, 1.25, 0.7],
                      boxShadow: [
                        "0 0 0px #ef4444",
                        "0 0 5px #22c55e",
                        "0 0 0px #ef4444",
                      ],
                    }}
                    transition={{
                      duration: 1.1,
                      repeat: Infinity,
                      delay: i * 0.32,
                      ease: "easeInOut",
                    }}
                  />
                ))}
                <motion.div
                  className="absolute rounded-full"
                  style={{
                    width: 5,
                    height: 5,
                    top: 1.5,
                    background: "#fff",
                    boxShadow: "0 0 6px #a3e635",
                  }}
                  animate={{ x: [-3, 26], opacity: [0, 1, 1, 0] }}
                  transition={{
                    duration: 0.75,
                    repeat: Infinity,
                    repeatDelay: 0.55,
                    ease: "linear",
                  }}
                />
              </div>
            )}

            {/* 🔗 Link — viral chain button */}
            <MagnetButton
              postId={post.id}
              postType="post"
              postOwnerId={post.user_id || post.author_id || ""}
              currentUserId={currentUserId}
              dark={true}
              myName={userProfile?.full_name || "Someone"}
              onBridgeChat={() => {}}
              onMagnetLoad={(d) =>
                setPostMagnetData((prev) => ({ ...prev, [post.id]: d }))
              }
            />

            {/* Share */}
            <button
              onClick={(e) => handleShare(post, e)}
              className="flex items-center gap-1.5 group ml-auto"
            >
              <Share2
                size={19}
                className="text-lime-400 group-hover:text-lime-300 transition-colors"
              />
              {(post.shares_count || 0) > 0 && (
                <span className="text-xs font-black text-lime-400">
                  {post.shares_count}
                </span>
              )}
            </button>
          </div>

          {/* ── Chain trace row — who joined the link chain ──────────────── */}
          {(() => {
            const d = postMagnetData[post.id];
            if (!d || d.linkers.length === 0) return null;
            return (
              <div className="px-4 pb-2 pt-0 flex items-center gap-1.5 flex-wrap">
                <span className="text-[9px] font-black text-lime-400/50 uppercase tracking-widest">
                  🔗 Chain:
                </span>
                {d.linkers.map((linker, i) => {
                  const isLast = i === 0;
                  return (
                    <span
                      key={i}
                      className={`inline-flex items-center gap-0.5 px-1.5 py-[3px] rounded-full text-[10px] font-black border transition-all ${
                        isLast
                          ? "animate-pulse text-pink-400 border-pink-500/40 bg-pink-500/10"
                          : "text-lime-400/70 border-lime-400/20 bg-lime-400/5"
                      }`}
                    >
                      <div
                        className="w-[12px] h-[12px] rounded-full overflow-hidden bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0"
                        style={{ fontSize: 5, color: "#fff", fontWeight: 900 }}
                      >
                        {linker.avatar_url ? (
                          <img
                            src={linker.avatar_url}
                            className="w-full h-full object-cover"
                            alt=""
                           decoding="async"/>
                        ) : (
                          linker.full_name?.[0]?.toUpperCase()
                        )}
                      </div>
                      {linker.full_name?.split(" ")[0]}
                      {isLast && (
                        <span className="text-[8px] ml-0.5 opacity-70 font-bold">
                          ✓ latest
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            );
          })()}

          {/* ── Voice section — post owner / first linker broadcasts ──────── */}
          {(() => {
            const d = postMagnetData[post.id];
            if (!d || d.voices.length === 0) return null;
            const warnings = d.voices.filter(
              (v) => v.is_warning && v.status_text,
            );
            const normals = d.voices.filter(
              (v) => !v.is_warning && v.status_text,
            );
            return (
              <div className="px-3 pb-2 space-y-1">
                {warnings.map((v) => (
                  <div
                    key={v.id}
                    className="animate-pulse text-red-400 bg-red-950/30 px-3 py-1.5 rounded-lg border border-red-500/20 font-medium flex items-center gap-2"
                  >
                    <span className="text-base leading-none">🐦</span>
                    <span className="text-[12px] font-black flex-1">
                      {v.status_text}
                    </span>
                    <span className="text-[9px] text-red-500/70 font-black uppercase shrink-0">
                      ⚡ Owner
                    </span>
                  </div>
                ))}
                {normals.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-900/20 border border-purple-500/20"
                  >
                    <span className="text-base leading-none">🐦</span>
                    <span className="text-[11px] text-purple-300 font-semibold flex-1">
                      {v.status_text}
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* ── Comment preview / news-ticker ────────────────────────────── */}
          {(() => {
            const preview = latestCommentPreviews[post.id];
            const tickerItems = commentTickerMap[post.id]?.length
              ? commentTickerMap[post.id]
              : preview
                ? [preview]
                : [];
            const totalCount =
              (commentsMap[post.id] || []).filter((c: any) => !c.parent_id)
                .length ||
              post.comments_count ||
              0;
            if (tickerItems.length === 0 && totalCount === 0) return null;
            const activeIdx =
              tickerItems.length > 1 ? tickerIdx % tickerItems.length : 0;
            const activeItem = tickerItems[activeIdx] ?? null;
            return (
              <div
                className="px-4 pb-3 pt-0.5 cursor-pointer"
                onClick={() => {
                  const isOpening = commentSheetId !== post.id;
                  setCommentSheetId(isOpening ? post.id : null);
                  if (isOpening) {
                    loadedCommentsRef.current.delete(post.id);
                    loadComments(post.id, true);
                    setTimeout(() => {
                      document.getElementById(post.id)?.scrollIntoView({
                        behavior: "smooth",
                        block: "nearest",
                      });
                    }, 120);
                  }
                }}
              >
                {totalCount > 1 && (
                  <p className="text-[11px] text-white/30 font-medium mb-1.5">
                    View all {totalCount} comment{totalCount > 1 ? "s" : ""}…
                  </p>
                )}
                {activeItem && (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${post.id}-tick-${activeIdx}`}
                      initial={{ opacity: 0, y: 7 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -7 }}
                      transition={{ duration: 0.32, ease: "easeInOut" }}
                      className="flex items-start gap-2"
                    >
                      <div className="w-6 h-6 rounded-full bg-pink-900/50 flex items-center justify-center text-[9px] font-black text-pink-300 shrink-0 overflow-hidden border border-white/10">
                        {authorAvatars[activeItem.authorId || ""] ? (
                          <img
                            src={authorAvatars[activeItem.authorId || ""]}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            alt=""
                           decoding="async"/>
                        ) : (
                          activeItem.author?.[0]?.toUpperCase() || "V"
                        )}
                      </div>
                      <div
                        className="flex-1 min-w-0 bg-white/8 rounded-2xl px-3 py-2"
                        style={{ background: "rgba(255,255,255,0.06)" }}
                      >
                        <span
                          style={{
                            color: "#f9a8d4",
                            fontSize: 13,
                            fontWeight: 900,
                          }}
                        >
                          {activeItem.author}
                        </span>
                        <span className="text-[14px] text-white/70 ml-1.5 leading-snug font-medium">
                          {(() => {
                            const safe = maskProfanity(activeItem.content);
                            return safe.length > 100
                              ? safe.slice(0, 100) + "…"
                              : safe;
                          })()}
                        </span>
                      </div>
                      {tickerItems.length > 1 && (
                        <div className="flex flex-col gap-0.5 self-center shrink-0 mr-0.5">
                          {tickerItems.map((_, i) => (
                            <div
                              key={i}
                              className={`w-1 h-1 rounded-full transition-all duration-300 ${i === activeIdx ? "bg-pink-400 scale-125" : "bg-white/20"}`}
                            />
                          ))}
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>
            );
          })()}

          {/* ── Inline Comment Section ────────────────────────────────── */}
          <AnimatePresence>
            {commentSheetId === post.id &&
              (() => {
                const inlineComments = commentsMap[post.id] || [];
                const inlineTopLevel = inlineComments.filter(
                  (c: any) => !c.parent_id,
                );
                return (
                  <motion.div
                    key={`inline-comments-${post.id}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 340, damping: 32 }}
                    className="overflow-hidden border-t border-white/10"
                  >
                    <div style={{ background: "rgba(10,2,16,0.92)" }}>
                      {/* Header */}
                      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
                        <span className="text-sm font-black text-white flex items-center gap-1.5">
                          <MessageCircle size={14} className="text-pink-400" />
                          Comments
                          {inlineTopLevel.length > 0 && (
                            <span className="text-white/30 font-semibold text-xs">
                              ({inlineTopLevel.length})
                            </span>
                          )}
                        </span>
                        <button
                          onClick={() => {
                            setCommentSheetId(null);
                            setReplyingTo(null);
                            setReplyText("");
                            setCommentText("");
                          }}
                          className="p-1 rounded-full bg-white/10 active:scale-90 transition-transform"
                        >
                          <X size={14} className="text-white/60" />
                        </button>
                      </div>

                      {/* Reply-to banner */}
                      {replyingTo?.postId === post.id && (
                        <div className="flex items-center justify-between px-4 py-1.5 bg-blue-900/30 border-b border-blue-500/20">
                          <span className="text-[11px] text-blue-400 font-semibold">
                            ↩ Replying to {replyingTo.author}
                          </span>
                          <button
                            onClick={() => {
                              setReplyingTo(null);
                              setReplyText("");
                            }}
                          >
                            <X size={12} className="text-white/40" />
                          </button>
                        </div>
                      )}

                      {/* Comment list */}
                      <div className="max-h-64 overflow-y-auto px-4 py-2 space-y-2.5">
                        {commentsMap[post.id] === undefined ? (
                          <div className="flex justify-center py-6">
                            <Loader2
                              size={20}
                              className="animate-spin text-pink-400"
                            />
                          </div>
                        ) : inlineTopLevel.length === 0 ? (
                          <div className="text-center py-8 text-white/20">
                            <MessageCircle
                              size={28}
                              className="mx-auto mb-1.5 opacity-40"
                            />
                            <p className="text-[11px] font-black uppercase tracking-widest">
                              Pehle comment karo!
                            </p>
                          </div>
                        ) : (
                          inlineTopLevel.map((c: any) => {
                            const replies = inlineComments.filter(
                              (r: any) => r.parent_id === c.id,
                            );
                            const isPostOwner =
                              post?.author_id === currentUserId ||
                              post?.user_id === currentUserId;
                            const isLongPressed =
                              feedCommentAction?.comment?.id === c.id;
                            return (
                              <div
                                key={c.id}
                                onPointerDown={(e) => {
                                  longPressCommentPos.current = {
                                    x: e.clientX,
                                    y: e.clientY,
                                  };
                                  longPressCommentTimer.current = setTimeout(
                                    () => {
                                      try {
                                        navigator.vibrate?.(8);
                                      } catch (_) {}
                                      setFeedCommentAction({
                                        comment: c,
                                        postId: post.id,
                                        x: longPressCommentPos.current.x,
                                        y: longPressCommentPos.current.y,
                                      });
                                    },
                                    600,
                                  );
                                }}
                                onPointerUp={() => {
                                  if (longPressCommentTimer.current) {
                                    clearTimeout(longPressCommentTimer.current);
                                    longPressCommentTimer.current = null;
                                  }
                                }}
                                onPointerCancel={() => {
                                  if (longPressCommentTimer.current) {
                                    clearTimeout(longPressCommentTimer.current);
                                    longPressCommentTimer.current = null;
                                  }
                                }}
                                className={`rounded-xl transition-colors select-none ${isLongPressed ? "bg-white/5" : ""}`}
                              >
                                <div className="flex gap-2.5 py-1">
                                  <button
                                    onClick={() => {
                                      const uid = c.user_id ?? c.author_id;
                                      if (uid) openProfile(uid);
                                    }}
                                    className="w-8 h-8 rounded-full bg-pink-900/50 flex items-center justify-center text-[10px] font-black text-pink-300 shrink-0 overflow-hidden border border-white/10 active:scale-90 transition-transform"
                                  >
                                    {authorAvatars[
                                      c.user_id ?? c.author_id ?? ""
                                    ] ? (
                                      <img
                                        src={
                                          authorAvatars[
                                            c.user_id ?? c.author_id ?? ""
                                          ]
                                        }
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                        alt=""
                                       decoding="async"/>
                                    ) : (
                                      c.author?.[0]
                                    )}
                                  </button>
                                  <div
                                    className={`flex-1 min-w-0 rounded-2xl px-3 py-2 ${c.is_hidden && !isPostOwner ? "border border-dashed border-white/10" : ""}`}
                                    style={{
                                      background:
                                        c.is_hidden && !isPostOwner
                                          ? "rgba(255,255,255,0.03)"
                                          : "rgba(255,255,255,0.08)",
                                    }}
                                  >
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span
                                        style={{
                                          color: "#f9a8d4",
                                          fontSize: 12,
                                          fontWeight: 900,
                                        }}
                                      >
                                        {c.author}
                                      </span>
                                      {c.created_at && (
                                        <span className="text-[10px] text-white/30 font-normal">
                                          {smartTime(c.created_at)}
                                        </span>
                                      )}
                                    </div>
                                    {c.is_hidden && !isPostOwner ? (
                                      <p className="text-[13px] text-white/30 italic mt-0.5">
                                        💬 Comment hidden by{" "}
                                        {c.hidden_by_name || "admin"}
                                      </p>
                                    ) : c.is_hidden && isPostOwner ? (
                                      <>
                                        <p className="text-[14px] text-white/20 mt-0.5 leading-snug line-through">
                                          {c.content}
                                        </p>
                                        <p className="text-[10px] text-white/30 mt-0.5">
                                          🙈 Hidden by {c.hidden_by_name}
                                        </p>
                                      </>
                                    ) : (
                                      <p className="text-[14px] text-white/80 mt-0.5 leading-snug">
                                        {c.content}
                                      </p>
                                    )}
                                    {!c.is_hidden && (
                                      <div className="flex items-center gap-3 mt-1.5 relative">
                                        <button
                                          onClick={() =>
                                            setReplyingTo({
                                              postId: post.id,
                                              commentId: c.id,
                                              author: c.author,
                                            })
                                          }
                                          className="text-[11px] text-blue-400 font-bold"
                                        >
                                          Reply
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setCommentReactionBarId(
                                              commentReactionBarId === c.id
                                                ? null
                                                : c.id,
                                            );
                                          }}
                                          className="text-[11px] text-white/40 font-bold"
                                        >
                                          😊 React
                                        </button>
                                        <AnimatePresence>
                                          {commentReactionBarId === c.id && (
                                            <>
                                              <div
                                                className="fixed inset-0 z-40"
                                                onClick={() =>
                                                  setCommentReactionBarId(null)
                                                }
                                              />
                                              <div className="absolute left-0 bottom-full mb-1 z-50">
                                                <ReactionBar
                                                  onReact={(emoji) =>
                                                    handleCommentReact(
                                                      c.id,
                                                      emoji,
                                                    )
                                                  }
                                                  onClose={() =>
                                                    setCommentReactionBarId(
                                                      null,
                                                    )
                                                  }
                                                />
                                              </div>
                                            </>
                                          )}
                                        </AnimatePresence>
                                      </div>
                                    )}
                                    {commentReactions[c.id] &&
                                      Object.keys(commentReactions[c.id])
                                        .length > 0 && (
                                        <div className="mt-1">
                                          <ReactionBubbles
                                            reactions={commentReactions[c.id]}
                                            currentUserId={currentUserId}
                                          />
                                        </div>
                                      )}
                                  </div>
                                </div>
                                {replies.length > 0 && (
                                  <div className="ml-9 mt-1 space-y-1.5 border-l-2 border-white/10 pl-2.5">
                                    {replies.map((r: any) => (
                                      <div key={r.id} className="flex gap-2">
                                        <button
                                          onClick={() => {
                                            const uid =
                                              r.user_id ?? r.author_id;
                                            if (uid) openProfile(uid);
                                          }}
                                          className="w-6 h-6 rounded-full bg-pink-900/40 flex items-center justify-center text-[9px] font-black text-pink-300 shrink-0 overflow-hidden border border-white/10"
                                        >
                                          {authorAvatars[
                                            r.user_id ?? r.author_id ?? ""
                                          ] ? (
                                            <img
                                              src={
                                                authorAvatars[
                                                  r.user_id ?? r.author_id ?? ""
                                                ]
                                              }
                                              className="w-full h-full object-cover"
                                              loading="lazy"
                                              alt=""
                                             decoding="async"/>
                                          ) : (
                                            r.author?.[0]
                                          )}
                                        </button>
                                        <div
                                          className="rounded-2xl px-3 py-1.5 flex-1"
                                          style={{
                                            background:
                                              "rgba(255,255,255,0.07)",
                                          }}
                                        >
                                          <span
                                            style={{
                                              color: "#f9a8d4",
                                              fontSize: 12,
                                              fontWeight: 900,
                                            }}
                                          >
                                            {r.author}
                                          </span>
                                          <span className="text-[11px] text-white/30 font-medium mx-1">
                                            replied to
                                          </span>
                                          <span
                                            style={{
                                              color: "#fca5a5",
                                              fontSize: 12,
                                              fontWeight: 700,
                                            }}
                                          >
                                            {c.author}
                                          </span>
                                          <p className="text-[13px] text-white/70 mt-0.5">
                                            {r.content}
                                          </p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Input */}
                      <div
                        className="px-3 py-3 border-t border-white/10 flex items-center gap-2 sticky bottom-0"
                        style={{ background: "rgba(10,2,16,0.95)" }}
                      >
                        <input
                          autoFocus
                          type="text"
                          placeholder={
                            replyingTo?.postId === post.id
                              ? `Reply to ${replyingTo.author}…`
                              : "Write a comment…"
                          }
                          className="flex-1 border border-white/10 rounded-2xl px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-pink-500/30 placeholder-white/30"
                          style={{ background: "rgba(255,255,255,0.08)" }}
                          value={
                            replyingTo?.postId === post.id
                              ? replyText
                              : commentText
                          }
                          onChange={(e) =>
                            replyingTo?.postId === post.id
                              ? setReplyText(e.target.value)
                              : setCommentText(e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key !== "Enter") return;
                            replyingTo?.postId === post.id
                              ? handleAddComment(post.id, replyingTo.commentId)
                              : handleAddComment(post.id);
                          }}
                        />
                        <button
                          onClick={() =>
                            replyingTo?.postId === post.id
                              ? handleAddComment(post.id, replyingTo.commentId)
                              : handleAddComment(post.id)
                          }
                          className="w-10 h-10 rounded-full bg-pink-600 text-white flex items-center justify-center active:scale-90 transition-transform shrink-0"
                        >
                          <Send size={15} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })()}
          </AnimatePresence>
        </motion.article>
      </PostViewTracker>
    );
  };

  // ── Infinite Discovery Engine ──────────────────────────────────────────────
  // Strict sequence anchored to each Circles widget:
  //   Post  2 → Circles row          (intro)
  //   Post  6 → Hook Pages Discover  (+4 after circles)
  //   Post 10 → Trending Flicks      (+4 after hooks)
  //   Post 14 → Circles row          (+4 after flicks → repeats)
  //   Post 18 → Hook Pages Discover
  //   Post 22 → Trending Flicks
  //   … and so on every 12 posts
  const feedBlocks = useMemo(() => {
    const blocks: FeedBlock[] = [];
    if (visiblePosts.length === 0) return blocks;

    // Strict loop: circles → +4 → hook-card → +4 → reels-row → +4 → (circles again)
    const LOOP_WIDGETS = [
      { gap: 4, type: "hook-card" },    // Hook Pages Discover
      { gap: 4, type: "survey-row" },   // Latest Surveys
      { gap: 4, type: "reels-row" },    // Trending Flicks
      { gap: 4, type: "circles-row" },  // Circles (repeat)
    ];

    const widgetAtPost = new Map<number, string>();
    const MAX = visiblePosts.length + 30;

    // Intro circles at post 2, then strict loop
    widgetAtPost.set(2, "circles-row");
    let pos = 2;
    let loopIdx = 0;
    while (pos <= MAX) {
      const nextW = LOOP_WIDGETS[loopIdx % LOOP_WIDGETS.length];
      pos += nextW.gap;
      if (pos <= MAX) widgetAtPost.set(pos, nextW.type);
      loopIdx++;
    }

    let circleSeed = 7;
    let pageSeed = 13;
    let peopleSeed = 31;
    let flickSeed = 5;
    let reelCursor = 0;

    visiblePosts.forEach((post, idx) => {
      const postNum = idx + 1; // 1-based

      // ── Individual post ──────────────────────────────────────────────────
      blocks.push({ type: "post", post, key: `p-${post.id}` });

      // ── Widget injection ─────────────────────────────────────────────────
      const wType = widgetAtPost.get(postNum);
      if (wType) {
        if (wType === "circles-row") {
          blocks.push({
            type: "circles-row",
            key: `widget-circles-${postNum}`,
            seed: circleSeed++,
          });
        } else if (wType === "people-row") {
          blocks.push({
            type: "people-row",
            key: `widget-people-${postNum}`,
            seed: peopleSeed++,
          });
        } else if (wType === "reels-row") {
          // Always inject flicks slot; InFeedHooksStrip handles empty-data gracefully
          blocks.push({
            type: "reels-row",
            key: `widget-flicks-${postNum}`,
            seed: flickSeed++,
          });
        } else if (wType === "hook-card") {
          blocks.push({
            type: "hook-card",
            key: `widget-hook-${postNum}`,
            seed: pageSeed++,
          });
        }
        // Full-width video reel pinned after every circles widget (if real videos exist)
        if (wType === "circles-row" && videoPosts.length > 0) {
          blocks.push({
            type: "single-reel",
            post: videoPosts[reelCursor % videoPosts.length],
            key: `sr-${postNum}`,
          });
          reelCursor++;
        }
      }
    });

    return blocks;
  }, [visiblePosts, videoPosts, flicksLoaded]);

  return (
    <div className="bg-[#0F172A] min-h-screen pb-32" style={{ willChange: "transform" }}>
      {/* ── "What's on your mind" bar ──────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b border-white/8"
        style={{
          background: "rgba(20,5,28,0.95)",
          borderBottomColor: "rgba(255,255,255,0.06)",
        }}
      >
        {userProfile?.avatar_url ? (
          <img
            src={userProfile.avatar_url}
            loading="lazy"
            className="w-10 h-10 rounded-full object-cover border border-white/20 cursor-pointer shrink-0"
            onClick={onPostClick}
           decoding="async"/>
        ) : (
          <div
            onClick={onPostClick}
            className="w-10 h-10 rounded-full bg-purple-900 flex items-center justify-center text-white font-black text-sm border border-white/10 cursor-pointer shrink-0"
          >
            {userProfile?.full_name?.[0] || "U"}
          </div>
        )}
        <div
          onClick={onPostClick}
          className="flex-1 py-2.5 px-4 rounded-full text-white/30 text-sm font-medium border border-white/10 cursor-pointer"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          What's on your mind?
        </div>
        <button
          className="p-2 active:scale-90 transition-transform shrink-0"
          onClick={() => galleryInputRef.current?.click()}
        >
          <ImageIcon size={22} className="text-pink-400" />
        </button>
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            onImageSelect?.(f);
            onPostClick?.();
            e.target.value = "";
          }}
        />
      </div>

      {/* ── Hidden Posts Archive Banner (shows only when posts are hidden) ── */}
      {hiddenIds.size > 0 && (
        <motion.button
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setShowHiddenArchive(true)}
          className="w-full flex items-center justify-between px-4 py-2.5 border-b border-yellow-500/20 active:opacity-80 transition-opacity"
          style={{ background: "rgba(30,18,4,0.95)" }}
        >
          <div className="flex items-center gap-2">
            <EyeOff size={14} className="text-yellow-400 shrink-0" />
            <span className="text-yellow-300 text-[13px] font-bold">
              {hiddenIds.size} {hiddenIds.size === 1 ? "post" : "posts"} hidden
              from your feed
            </span>
          </div>
          <span className="text-yellow-400 text-[11px] font-black bg-yellow-400/10 border border-yellow-400/20 px-3 py-1 rounded-full shrink-0">
            View Archive →
          </span>
        </motion.button>
      )}

      {/* ── Loading ───────────────────────────────────────────────────── */}
      {loading && (
        <div
          className="flex flex-col items-center justify-center py-12"
          style={{ background: "#0F172A" }}
        >
          <Loader2 className="animate-spin text-pink-400 mb-2" size={26} />
          <p className="text-white/30 text-[10px] font-black uppercase tracking-widest">
            Loading Feed
          </p>
        </div>
      )}

      {/* ── People Discovery — New in Your Area ────────────────────────── */}
      {currentUserId && localProfile.rec_new_users !== false && (
        localProfile.district || localProfile.city || localProfile.state
      ) && (
        <div className="px-3 mt-1 mb-1">
          <NewInYourArea
            currentUserId={currentUserId}
            localProfile={localProfile}
            onProfileClick={(uid) => openProfile(uid)}
          />
        </div>
      )}

      {/* ── People You May Know ───────────────────────────────────────────── */}
      {currentUserId && (
        <div className="py-2">
          <PeopleYouMayKnow
            currentUserId={currentUserId}
            localProfile={localProfile}
            onProfileClick={(uid) => openProfile(uid)}
          />
        </div>
      )}

      {/* ── Dynamic Feed — Infinite Discovery Engine ──────────────────── */}
      {(() => {
        let postCount = 0;
        return feedBlocks.map((block, blockIdx) => {
        // ── Individual post ────────────────────────────────────────
        if (block.type === "post") {
          const bPost = block.post!;
          // ── Hidden post: inline placeholder at the exact same position ──
          if (hiddenIds.has(bPost.id)) {
            return (
              <motion.div
                key={block.key}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="border-b border-white/5 px-4 py-3 flex items-center justify-between"
                style={{ background: "rgba(30,10,40,0.8)" }}
              >
                <div className="flex items-center gap-2.5">
                  <EyeOff size={15} className="text-white/30" />
                  <span className="text-white/30 text-[13px] font-medium">
                    Post hidden from your feed
                  </span>
                </div>
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={() => handleUnhide(bPost.id)}
                  className="text-blue-400 text-[12px] font-bold px-3 py-1.5 rounded-full bg-blue-900/30 shrink-0"
                >
                  Undo
                </motion.button>
              </motion.div>
            );
          }
          postCount++;
          const showAd = postCount % 4 === 0;
          return (
            <ErrorBoundary
              key={block.key}
              fallback={
                <div
                  className="border-b border-white/5 px-4 py-6 text-center text-white/20 text-xs"
                  style={{ background: "rgba(15,5,20,0.9)" }}
                >
                  Yeh post load nahi ho saki
                </div>
              }
            >
              {renderPost(bPost)}
              <FeedDivider />
              {showAd && (
                <div className="px-4">
                  <AdsterraAd />
                </div>
              )}
            </ErrorBoundary>
          );
        }

        // ── Trending Flicks (shuffled) ─────────────────────────────
        if (block.type === "reels-row") {
          const shuffled = seededShuffle(trendingFlicks, block.seed ?? 0);
          return (
            <div key={block.key}>
              <TrendingFlicksRow
                flicks={shuffled}
                loaded={flicksLoaded}
                onFlickClick={(flick) => setFlickModal(flick)}
              />
              <FeedDivider />
            </div>
          );
        }

        // ── Trending Circles (real DB first, DemoCircles as fallback) ───
        if (block.type === "circles-row") {
          const shuffled = seededShuffle(groupSuggestions, block.seed ?? 0);
          const hasReal = shuffled.length > 0;
          return (
            <div key={block.key}>
              {hasReal ? (
                <SuggestedCirclesRow
                  circles={shuffled}
                  joinedIds={joinedCircleIds}
                  memberCounts={circleMemberCounts}
                  ownerNames={ownerNames}
                  onJoin={handleJoinCircle}
                  onCircleClick={() => onNavigateToCircles?.()}
                />
              ) : (
                <DemoCirclesRow onCircleClick={() => onNavigateToCircles?.()} />
              )}
              <FeedDivider />
            </div>
          );
        }

        // ── Hooks Discovery Strip — real DB data, DemoHookPagesRow fallback ──
        if (block.type === "hook-card") {
          const hasReal = pageSuggestions.length > 0;
          return (
            <div key={block.key}>
              {hasReal ? (
                <InFeedHooksStrip
                  pages={pageSuggestions}
                  hookedIds={hookedPageIds}
                  ownerNames={ownerNames}
                  followerCounts={pageFollowerCounts}
                  onHook={handleHookPage}
                  onPageClick={() => onNavigateToPages?.()}
                  seed={block.seed}
                />
              ) : (
                <DemoHookPagesRow onPageClick={() => onNavigateToPages?.()} />
              )}
              <FeedDivider />
            </div>
          );
        }

        // ── People You May Know (shuffled) ─────────────────────────
        if (block.type === "people-row") {
          const visible = peopleSuggestions.filter(
            (u) => !blockedUserIds.has(u.id),
          );
          if (visible.length === 0) return null;
          const shuffled = seededShuffle(visible, block.seed ?? 0);
          const GRAD = [
            "#6366f1",
            "#ec4899",
            "#f59e0b",
            "#10b981",
            "#3b82f6",
            "#8b5cf6",
            "#ef4444",
            "#06b6d4",
          ];
          return (
            <div
              key={block.key}
              className="border-b border-white/5 pt-3 pb-2"
              style={{ background: "#0F172A" }}
            >
              <p className="text-[13px] font-black text-white/70 px-4 mb-2 tracking-tight">
                👥 People You May Know
              </p>
              <div className="flex gap-3 overflow-x-auto px-4 pb-2 no-scrollbar scroll-smooth">
                {shuffled.map((u, i) => {
                  const isSent = sentRequestIds.includes(u.id);
                  const firstName = (u.full_name || "User").split(" ")[0];
                  return (
                    <motion.div
                      key={u.id}
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        delay: i * 0.04,
                        type: "spring",
                        stiffness: 240,
                        damping: 20,
                      }}
                      className="flex-shrink-0 relative rounded-2xl overflow-hidden border border-gray-200 shadow-md cursor-pointer"
                      style={{
                        width: 120,
                        height: 212,
                        background: IS_MOBILE ? "#1a1030" : `linear-gradient(160deg,${GRAD[i % GRAD.length]} 0%,#1e1b4b 100%)`,
                      }}
                      onClick={() => openProfile(u.id)}
                    >
                      {u.avatar_url ? (
                        <img
                          src={u.avatar_url}
                          loading="lazy"
                          className="w-full h-full object-cover"
                         decoding="async"/>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white font-black text-5xl">
                          {(u.full_name || "U")[0].toUpperCase()}
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent pt-10 pb-3 px-2.5 flex flex-col items-center gap-2">
                        <p className="text-white text-xl font-black truncate w-full text-center leading-tight drop-shadow-sm">
                          {firstName}
                        </p>
                        {u.fame_points > 0 && (
                          <p className="text-white/70 text-[11px] font-black leading-none">
                            ⭐ {u.fame_points} Fame
                          </p>
                        )}
                        <motion.button
                          whileTap={{ scale: 0.94 }}
                          onClick={(e) => handleSendFriendRequest(e, u.id)}
                          disabled={isSent}
                          className={`w-full py-2.5 rounded-xl font-black text-[13px] leading-tight flex flex-col items-center justify-center transition-all ${isSent ? "bg-gray-200 text-gray-500 cursor-default" : "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-900/30"}`}
                        >
                          {isSent ? (
                            <span className="text-[11px] font-black">
                              Request Sent
                            </span>
                          ) : (
                            <>
                              <span>MAKE</span>
                              <span>FRIEND</span>
                            </>
                          )}
                        </motion.button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        }

        // ── Latest Surveys ──────────────────────────────────────────
        if (block.type === "survey-row") {
          return (
            <div key={block.key}>
              <LatestSurveysWidget
                currentUserId={currentUserId || ""}
                onNavigateToSurveys={onNavigateToSurveys}
              />
              <FeedDivider />
            </div>
          );
        }

        // ── Single full-width reel separator ───────────────────────
        if (block.type === "single-reel" && block.post) {
          return (
            <div key={block.key}>
              <SingleReelBlock post={block.post} />
              <FeedDivider />
            </div>
          );
        }

        return null;
      }); })()}

      {!loading && visiblePosts.length === 0 && (
        <div
          className="flex flex-col items-center py-20 text-white/20"
          style={{ background: "#0F172A" }}
        >
          <p className="font-black uppercase tracking-widest text-xs">
            No posts yet
          </p>
        </div>
      )}

      {/* ── Load More ─────────────────────────────────────────────────── */}
      {!loading && hasMore && visiblePosts.length > 0 && (
        <div
          className="flex justify-center py-6"
          style={{ background: "#0F172A" }}
        >
          <button
            onClick={() => {
              setLoadingMore(true);
              fetchPosts();
            }}
            disabled={loadingMore}
            className="flex items-center gap-2 px-6 py-2.5 bg-pink-700 text-white font-bold text-sm rounded-full shadow active:scale-95 transition-transform disabled:opacity-60"
          >
            {loadingMore ? (
              <Loader2 size={16} className="animate-spin" />
            ) : null}
            {loadingMore ? "Loading…" : "Load More Posts"}
          </button>
        </div>
      )}

      {/* ── Report modal ──────────────────────────────────────────────── */}
      {createPortal(
        <AnimatePresence>
          {reportModal && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                style={{ zIndex: 99998 }}
                onClick={() => setReportModal(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ type: "spring", damping: 28, stiffness: 340 }}
                style={{
                  position: "fixed",
                  top: reportModal.anchor.top,
                  right: reportModal.anchor.right,
                  zIndex: 99999,
                }}
                className="w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4"
                onClick={(e) => e.stopPropagation()}
              >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center">
                    <Flag size={15} className="text-orange-500" />
                  </div>
                  <span className="text-gray-900 font-black text-sm">Report Post</span>
                </div>
                <button
                  onClick={() => setReportModal(null)}
                  className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="space-y-1.5 mb-4">
                {[
                  "Spam or misleading",
                  "Inappropriate content",
                  "Hate speech",
                  "Harassment",
                  "Other",
                ].map((r) => (
                  <button
                    key={r}
                    onClick={() =>
                      setReportModal((p) => (p ? { ...p, reason: r } : p))
                    }
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                      reportModal.reason === r
                        ? "bg-orange-50 border-orange-300 text-orange-700"
                        : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <button
                onClick={handleReportSubmit}
                disabled={!reportModal.reason || reportSubmitting}
                className="w-full py-3 rounded-2xl text-white font-black text-sm disabled:opacity-40"
                style={{ background: "linear-gradient(135deg,#f97316,#dc2626)" }}
              >
                {reportSubmitting ? "Submitting…" : "Submit Report"}
              </button>
            </motion.div>
          </>
        )}
        </AnimatePresence>,
        document.body
      )}

      {/* ── Block Confirmation Dialog ─────────────────────────────────── */}
      <AnimatePresence>
        {blockConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[250] flex items-center justify-center bg-black/70 backdrop-blur-sm px-6"
            onClick={() => setBlockConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.88, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.88, y: 16 }}
              transition={{ type: "spring", damping: 24, stiffness: 300 }}
              className="w-full max-w-xs rounded-3xl p-6 shadow-2xl border border-white/10"
              style={{ background: "rgba(20,5,30,0.98)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-14 h-14 rounded-2xl bg-red-900/40 border border-red-700/30 flex items-center justify-center mx-auto mb-4">
                <Ban size={28} className="text-red-400" />
              </div>
              <h3 className="text-white font-black text-lg text-center mb-1">
                Block {blockConfirm.name}?
              </h3>
              <p className="text-white/40 text-sm text-center mb-6 leading-relaxed">
                Their posts will be hidden from your feed. You can unblock
                anytime from the post menu or Settings.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setBlockConfirm(null)}
                  className="flex-1 py-3.5 rounded-2xl border border-white/10 text-white/60 font-black text-sm hover:bg-white/10 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    handleBlockUser(blockConfirm.userId, blockConfirm.name)
                  }
                  className="flex-1 py-3.5 rounded-2xl bg-red-600 text-white font-black text-sm hover:bg-red-700 transition"
                >
                  Block
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Reaction Insights Modal ───────────────────────────────────── */}
      {createPortal(
        <AnimatePresence>
          {insightsPostId && (
            <motion.div
              key="insights-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 99999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 16px",
                background: "rgba(0,0,0,0.6)",
              }}
              onClick={() => setInsightsPostId(null)}
            >
              <motion.div
                key="insights-sheet"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ type: "spring", damping: 28, stiffness: 340 }}
                className="w-full max-w-md rounded-3xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden border border-white/10"
                style={{ background: "rgba(18,5,28,0.98)" }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                  <h3 className="font-black text-white text-base flex items-center gap-2">
                    <SmilePlus size={18} className="text-pink-400" /> Reactions
                  </h3>
                  <button
                    onClick={() => setInsightsPostId(null)}
                    className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    <X size={17} className="text-white/50" />
                  </button>
                </div>

                {/* Reaction type tabs */}
                {(() => {
                  const typesPresent = [
                    "all",
                    ...Array.from(
                      new Set(insightsData.map((r: any) => r.reaction_type)),
                    ),
                  ];
                  const filtered =
                    insightsTab === "all"
                      ? insightsData
                      : insightsData.filter(
                          (r: any) => r.reaction_type === insightsTab,
                        );
                  return (
                    <>
                      <div className="flex items-center gap-2 px-4 py-3 overflow-x-auto no-scrollbar border-b border-white/10">
                        {typesPresent.map((type) => {
                          const r = REACTIONS.find((x) => x.type === type);
                          const label =
                            type === "all"
                              ? `All ${insightsData.length}`
                              : `${r?.emoji ?? type} ${insightsData.filter((d: any) => d.reaction_type === type).length}`;
                          return (
                            <button
                              key={type}
                              onClick={() => setInsightsTab(type)}
                              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-bold transition-all ${
                                insightsTab === type
                                  ? "bg-pink-600 text-white shadow"
                                  : "text-white/50 hover:bg-white/10"
                              }`}
                              style={
                                insightsTab !== type
                                  ? { background: "rgba(255,255,255,0.08)" }
                                  : {}
                              }
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>

                      {/* Reactor list */}
                      <div className="overflow-y-auto flex-1 px-4 py-3 space-y-1">
                        {insightsLoading ? (
                          <div className="flex justify-center py-10">
                            <Loader2
                              size={28}
                              className="animate-spin text-pink-400"
                            />
                          </div>
                        ) : filtered.length === 0 ? (
                          <div className="flex flex-col items-center py-12 gap-3 text-white/20">
                            <SmilePlus size={40} className="opacity-30" />
                            <p className="text-sm font-semibold">
                              No reactions yet
                            </p>
                          </div>
                        ) : (
                          filtered.map((item: any, i: number) => {
                            const profile = item.profiles;
                            const emoji =
                              REACTIONS.find(
                                (r) => r.type === item.reaction_type,
                              )?.emoji ?? "👍";
                            const initials = (profile?.full_name ||
                              "?")[0].toUpperCase();
                            return (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -12 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.03 }}
                                onClick={() => {
                                  if (profile?.id) {
                                    openProfile(profile.id);
                                    setInsightsPostId(null);
                                  }
                                }}
                                className="flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer transition-colors hover:bg-white/8"
                                style={{ background: "rgba(255,255,255,0.04)" }}
                              >
                                {/* Avatar + emoji badge */}
                                <div className="relative shrink-0">
                                  {profile?.avatar_url ? (
                                    <img
                                      src={profile.avatar_url}
                                      alt={profile.full_name}
                                      loading="lazy"
                                      className="w-10 h-10 rounded-full object-cover border-2 border-white/20 shadow"
                                     decoding="async"/>
                                  ) : (
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-700 to-purple-800 flex items-center justify-center text-white font-black text-sm border-2 border-white/20 shadow">
                                      {initials}
                                    </div>
                                  )}
                                  <span className="absolute -bottom-1 -right-1 text-base leading-none bg-black/60 rounded-full p-0.5 shadow">
                                    {emoji}
                                  </span>
                                </div>
                                {/* Name */}
                                <p className="font-bold text-white/80 text-sm flex-1 truncate">
                                  {profile?.full_name || "Unknown"}
                                </p>
                              </motion.div>
                            );
                          })
                        )}
                      </div>
                    </>
                  );
                })()}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      {/* ── Feed Comment Floating Context Menu (long-press) ─────────── */}
      <AnimatePresence>
        {feedCommentAction &&
          (() => {
            const ac = feedCommentAction.comment;
            const postId = feedCommentAction.postId;
            const { x, y } = feedCommentAction;
            const isCommenter = (ac.user_id ?? ac.author_id) === currentUserId;
            const sheetPost = visiblePosts.find((p: any) => p.id === postId);
            const isPostOwner =
              sheetPost?.author_id === currentUserId ||
              sheetPost?.user_id === currentUserId;

            const items: FeedCommentMenuItem[] = [];
            if (isCommenter) {
              items.push({
                icon: "✏️",
                label: "Edit",
                action: () => {
                  setEditingFeedComment({ id: ac.id, text: ac.content });
                  setFeedCommentAction(null);
                },
              });
              items.push({
                icon: "🗑️",
                label: "Delete",
                action: () => handleFeedCommentDelete(ac.id, postId),
                danger: true,
              });
              if (!ac.is_hidden)
                items.push({
                  icon: "🙈",
                  label: "Hide from Others",
                  action: () => handleFeedCommentHide(ac.id, postId),
                });
            }
            if (isPostOwner && !isCommenter) {
              items.push({
                icon: "🗑️",
                label: "Delete",
                action: () => handleFeedCommentDelete(ac.id, postId),
                danger: true,
              });
              if (!ac.is_hidden)
                items.push({
                  icon: "🙈",
                  label: "Hide Comment",
                  action: () => handleFeedCommentHide(ac.id, postId),
                });
            }
            if (!isCommenter && !isPostOwner) {
              items.push({
                icon: "🚩",
                label: "Report",
                action: () => handleFeedCommentReport(ac, postId),
                danger: true,
              });
            }

            const menuW = 210;
            const rowH = 46;
            const headerH = 52;
            const menuH = headerH + items.length * rowH;
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const left = Math.min(Math.max(x - menuW / 2, 8), vw - menuW - 8);
            const showAbove = y + menuH + 16 > vh;
            const top = showAbove ? Math.max(y - menuH - 12, 8) : y + 12;

            return (
              <>
                <div
                  className="fixed inset-0 z-[600]"
                  onPointerDown={() => setFeedCommentAction(null)}
                />
                <motion.div
                  key="feed-ca-float"
                  initial={{ opacity: 0, scale: 0.82 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.82 }}
                  transition={{ type: "spring", damping: 22, stiffness: 400 }}
                  className="fixed z-[601] rounded-2xl shadow-2xl overflow-hidden border border-white/10"
                  style={{
                    top,
                    left,
                    width: menuW,
                    transformOrigin: showAbove ? "bottom center" : "top center",
                    background: "rgba(20,5,30,0.97)",
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <div
                    className="px-3.5 py-2.5 border-b border-white/10"
                    style={{ background: "rgba(255,255,255,0.05)" }}
                  >
                    <p
                      style={{
                        color: "#f9a8d4",
                        fontSize: 11,
                        fontWeight: 900,
                      }}
                      className="truncate"
                    >
                      {ac.author || ac.author_name}
                    </p>
                    <p className="text-[11px] text-white/40 truncate leading-snug mt-0.5">
                      {(ac.content || "").slice(0, 55)}
                    </p>
                  </div>
                  {items.map((item, i) => (
                    <button
                      key={i}
                      onClick={item.action}
                      className={`w-full flex items-center gap-2.5 px-3.5 py-[11px] text-left text-[14px] font-semibold hover:bg-white/10 transition-colors ${item.danger ? "text-red-400" : "text-white/80"} ${i > 0 ? "border-t border-white/8" : ""}`}
                    >
                      <span className="text-[17px] leading-none">
                        {item.icon}
                      </span>
                      {item.label}
                    </button>
                  ))}
                </motion.div>
              </>
            );
          })()}
      </AnimatePresence>

      {/* ── Share Popup (context-aware, anchored to button) ────────── */}
      {sharePopupData &&
        createPortal(
          <SharePopup
            post={sharePopupData.post as SharePostData}
            anchor={sharePopupData.anchor}
            onClose={() => setSharePopupData(null)}
            onShare={(mode, post) => executeShare(post, mode)}
          />,
          document.body,
        )}

      {/* ── Edit Feed Comment Sheet ───────────────────────────────────── */}
      <AnimatePresence>
        {editingFeedComment && (
          <motion.div
            key="feed-edit-comment-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[600] flex items-end justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setEditingFeedComment(null)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="w-full max-w-lg rounded-t-3xl p-5 pb-10 shadow-2xl border-t border-white/10"
              style={{ background: "rgba(20,5,30,0.98)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center mb-4">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>
              <h3 className="font-black text-white text-base mb-3 flex items-center gap-2">
                ✏️ Edit Comment
              </h3>
              <textarea
                value={editingFeedComment.text}
                onChange={(e) =>
                  setEditingFeedComment((prev) =>
                    prev ? { ...prev, text: e.target.value } : null,
                  )
                }
                rows={3}
                className="w-full border border-white/10 rounded-2xl px-4 py-3 text-[15px] text-white/80 outline-none focus:ring-2 focus:ring-pink-400/30 resize-none mb-4 bg-white/5"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingFeedComment(null)}
                  className="flex-1 py-3 rounded-2xl bg-white/10 text-white/60 font-black text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={saveFeedCommentEdit}
                  disabled={!editingFeedComment.text.trim()}
                  className="flex-1 py-3 rounded-2xl bg-pink-700 text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <Check size={16} /> Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Fullscreen Flick Player Modal ────────────────────────────── */}
      {flickModal && (
        <FlickPlayerModal
          flick={flickModal}
          onClose={() => setFlickModal(null)}
        />
      )}

      {/* ── Hidden Posts Archive Drawer ───────────────────────────────── */}
      <AnimatePresence>
        {showHiddenArchive && (
          <HiddenPostsDrawer
            hiddenIds={hiddenIds}
            currentUserId={currentUserId}
            onUnhide={handleUnhide}
            onClearAll={handleClearAll}
            onClose={() => setShowHiddenArchive(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default FameFeed;
