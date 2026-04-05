import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { toast } from "sonner";
import {
  Send, Heart, MessageCircle, Share2, MoreVertical,
  Loader2, Trash2, EyeOff, Flag, X, Volume2, VolumeX, Image as ImageIcon,
  Play, Users, Film, Plus,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ── Inline video ───────────────────────────────────────────────────────────────
const FeedVideo = ({ src }: { src: string }) => {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (!ref.current) return;
      if (entry.isIntersecting) {
        ref.current.muted = false;
        ref.current.play().catch(() => {
          if (ref.current) { ref.current.muted = true; setMuted(true); ref.current.play().catch(() => {}); }
        });
      } else { ref.current.pause(); }
    }, { threshold: 0.4 });
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
    <div className="relative w-full bg-black" style={{ aspectRatio: "9/16", maxHeight: "85vh" }}>
      <video ref={ref} src={src} loop muted={muted} playsInline className="w-full h-full object-cover" />
      <button onClick={toggle} className="absolute bottom-3 right-3 p-2 bg-black/50 backdrop-blur-sm rounded-full border border-white/15">
        {muted ? <VolumeX size={16} className="text-red-400" /> : <Volume2 size={16} className="text-blue-500" />}
      </button>
    </div>
  );
};

// ── YouTube embed ──────────────────────────────────────────────────────────────
const YouTubeEmbed = ({ url }: { url: string }) => {
  const m = url.match(/^.*(youtu.be\/|v\/|embed\/|watch\?v=|\/shorts\/)([^#&?]*).*/);
  const id = m?.[2]?.length === 11 ? m[2] : null;
  if (!id) return null;
  return (
    <div className="w-full bg-black" style={{ aspectRatio: "16/9" }}>
      <iframe src={`https://www.youtube.com/embed/${id}?controls=1&modestbranding=1`}
        className="w-full h-full" allow="accelerometer; autoplay; encrypted-media" title="Video" />
    </div>
  );
};

// ── Smart media renderer ───────────────────────────────────────────────────────
const PostMedia = ({ post }: { post: any }) => {
  const url = post.media_url;
  if (!url) return null;
  const isYT = post.metadata?.is_youtube || url.includes("youtube.com") || url.includes("youtu.be");
  if (isYT) return <YouTubeEmbed url={url} />;
  const isVid = post.type === "video" || /\.(mp4|webm|ogg|mov|m4v)/i.test(url.split("?")[0]) || url.includes("rapidcdn.app");
  if (isVid) return <FeedVideo src={url} />;
  return (
    <div className="w-full bg-gray-100">
      <img src={url} loading="lazy" className="w-full object-cover" style={{ maxHeight: "70vh" }} alt="" />
    </div>
  );
};

// ── Post caption — 2-line clamp + "...more" toggle ────────────────────────────
const CLAMP_THRESHOLD = 90;

const PostCaption = ({ content }: { content: string }) => {
  const [expanded, setExpanded] = useState(false);
  const isLong = content.length > CLAMP_THRESHOLD;
  return (
    <div className="px-4 pb-2">
      <p className={`text-[15px] font-semibold text-slate-900 leading-relaxed whitespace-pre-wrap break-words ${!expanded && isLong ? "line-clamp-2" : ""}`}>
        {content}
      </p>
      {isLong && (
        <button onClick={() => setExpanded(v => !v)}
          className="text-blue-600 text-[12px] font-semibold mt-0.5">
          {expanded ? "...less" : "...more"}
        </button>
      )}
    </div>
  );
};

// ── Trending Flicks Row (real data, real-time) ─────────────────────────────────
const FLICK_GRADS = ["#ec4899","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ef4444","#06b6d4","#f97316","#84cc16"];

// Pure display component — data is fetched once at FameFeed level, no per-instance channels
const TrendingFlicksRow = ({ flicks, loaded }: { flicks: any[]; loaded: boolean }) => {
  if (!loaded) return null;
  if (flicks.length === 0) return null; // hide entirely when no real flicks
  return (
    <div className="bg-white py-3">
      <p className="text-[12px] font-black text-gray-700 px-4 mb-2">🔥 Trending Flicks</p>
      <div className="flex gap-2.5 overflow-x-auto px-4 pb-1 no-scrollbar">
        {flicks.map((flick, i) => {
          const isYT = flick.media_url?.includes("youtube.com") || flick.media_url?.includes("youtu.be");
          const isVid = !isYT && flick.media_url && /\.(mp4|webm|ogg|mov|m4v)/i.test(flick.media_url.split("?")[0]);
          const isImg = flick.media_url && !isVid && !isYT;
          return (
            <div key={flick.id}
              className="flex-shrink-0 relative rounded-xl overflow-hidden"
              style={{ width: 108, height: 192, background: `linear-gradient(160deg, ${FLICK_GRADS[i % FLICK_GRADS.length]} 0%, #1e1b4b 100%)` }}>
              {/* Real thumbnail */}
              {isImg && (
                <img src={flick.media_url} className="absolute inset-0 w-full h-full object-cover" loading="lazy" alt="" />
              )}
              {isVid && (
                <video src={flick.media_url} className="absolute inset-0 w-full h-full object-cover" muted playsInline preload="metadata" />
              )}
              {/* Play overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center border border-white/20">
                  <Play size={16} fill="white" className="text-white ml-0.5" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-2">
                <div className="flex items-center gap-1 mb-0.5">
                  <Heart size={9} className="text-red-400" fill="#f87171" />
                  <span className="text-white text-[9px] font-bold">{flick.likes_count || 0}</span>
                </div>
                <p className="text-white text-[9px] font-semibold truncate">@{flick.author || "user"}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Suggested Pages Row (horizontal scroll, 3-4 visible) ───────────────────────
const SuggestedPagesRow = ({
  pages, doneIds, onAction, onCreatePage,
}: {
  pages: any[]; doneIds: Set<string>;
  onAction: (item: any) => void; onCreatePage?: () => void;
}) => {
  if (pages.length === 0) {
    return (
      <div className="bg-white border-b border-gray-100 px-5 py-8 flex flex-col items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-purple-50 flex items-center justify-center">
          <Film size={26} className="text-purple-400" />
        </div>
        <p className="text-gray-800 font-black text-sm text-center">No Pages yet</p>
        <p className="text-gray-400 text-[11px] text-center">Be the first to create a Page!</p>
        {onCreatePage && (
          <button onClick={onCreatePage}
            className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-blue-600 text-white font-black text-[12px] active:scale-[0.98] transition-transform">
            <Plus size={14} /> Create Page
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="bg-white border-b border-gray-100 pt-4 pb-2">
      <p className="text-[12px] font-black text-gray-700 px-4 mb-3">📄 Suggested Pages</p>
      <div className="flex gap-3 overflow-x-auto px-4 pb-3 no-scrollbar">
        {pages.map(page => {
          const grad = gradForSugg(page.id || page.name || "p");
          const done = doneIds.has(page.id);
          return (
            <div key={page.id}
              className="flex-shrink-0 bg-gray-50 rounded-2xl overflow-hidden flex flex-col"
              style={{ width: 132, boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
              <div className="w-full relative overflow-hidden" style={{ height: 100, background: grad }}>
                {page.cover_url && (
                  <img src={page.cover_url} className="w-full h-full object-cover" loading="lazy" alt={page.name} />
                )}
                {!page.cover_url && (
                  <div className="w-full h-full flex items-center justify-center">
                    <Film size={28} className="text-white/50" />
                  </div>
                )}
              </div>
              <div className="p-2.5 flex flex-col gap-1 flex-1">
                <p className="text-[11px] font-black text-gray-900 truncate leading-tight">{page.name}</p>
                <p className="text-[9px] text-gray-400">{page.member_count ?? 0} followers</p>
                <button onClick={() => !done && onAction(page)}
                  className={`w-full py-2 rounded-xl text-[10px] font-black mt-auto transition-all active:scale-95 ${
                    done ? "bg-gray-100 text-gray-400" : "bg-blue-600 text-white"
                  }`}>
                  {done ? "Following ✓" : "Follow"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Suggested Circles Row (horizontal scroll, 3-4 visible) ─────────────────────
const SuggestedCirclesRow = ({
  circles, doneIds, onAction, onCreateCircle,
}: {
  circles: any[]; doneIds: Set<string>;
  onAction: (item: any) => void; onCreateCircle?: () => void;
}) => {
  if (circles.length === 0) {
    return (
      <div className="bg-white border-b border-gray-100 px-5 py-8 flex flex-col items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
          <Users size={26} className="text-blue-400" />
        </div>
        <p className="text-gray-800 font-black text-sm text-center">No Circles yet</p>
        <p className="text-gray-400 text-[11px] text-center">Be the first to create a Circle!</p>
        {onCreateCircle && (
          <button onClick={onCreateCircle}
            className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-blue-600 text-white font-black text-[12px] active:scale-[0.98] transition-transform">
            <Plus size={14} /> Create Circle
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="bg-white border-b border-gray-100 pt-4 pb-2">
      <p className="text-[12px] font-black text-gray-700 px-4 mb-3">👥 Suggested Circles</p>
      <div className="flex gap-3 overflow-x-auto px-4 pb-3 no-scrollbar">
        {circles.map(circle => {
          const grad = gradForSugg(circle.id || circle.name || "c");
          const done = doneIds.has(circle.id);
          return (
            <div key={circle.id}
              className="flex-shrink-0 bg-gray-50 rounded-2xl overflow-hidden flex flex-col"
              style={{ width: 132, boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
              <div className="w-full relative overflow-hidden" style={{ height: 100, background: grad }}>
                {circle.cover_url && (
                  <img src={circle.cover_url} className="w-full h-full object-cover" loading="lazy" alt={circle.name} />
                )}
                {!circle.cover_url && (
                  <div className="w-full h-full flex items-center justify-center">
                    <Users size={28} className="text-white/50" />
                  </div>
                )}
              </div>
              <div className="p-2.5 flex flex-col gap-1 flex-1">
                <p className="text-[11px] font-black text-gray-900 truncate leading-tight">{circle.name}</p>
                <p className="text-[9px] text-gray-400">{circle.member_count ?? 0} members</p>
                <button onClick={() => !done && onAction(circle)}
                  className={`w-full py-2 rounded-xl text-[10px] font-black mt-auto transition-all active:scale-95 ${
                    done ? "bg-gray-100 text-gray-400" : "bg-blue-600 text-white"
                  }`}>
                  {done ? "Joined ✓" : "Join Circle"}
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
const SUGG_GRADS = ["#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#8b5cf6"];

function gradForSugg(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h) ^ id.charCodeAt(i);
  return SUGG_GRADS[Math.abs(h) % SUGG_GRADS.length];
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
    <motion.article layout className="bg-white border-b border-gray-100">
      {/* Header — like a post author row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          className="w-10 h-10 rounded-full overflow-hidden border border-gray-100 shrink-0"
          style={{ background: `linear-gradient(135deg, ${grad}, #1e1b4b)` }}
        >
          {item.cover_url ? (
            <img src={item.cover_url} className="w-full h-full object-cover" alt={item.name} />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Users size={16} className="text-white/80" />
            </div>
          )}
        </div>
        <div>
          <p className="text-gray-900 font-bold text-sm leading-none">{item.name || "Community"}</p>
          <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide mt-0.5">
            {isGroup ? "👥 Suggested Circle" : "📄 Suggested Page"}
          </p>
        </div>
      </div>

      {/* Big cover photo */}
      <div className="w-full relative bg-gray-100" style={{ aspectRatio: "16/9" }}>
        {item.cover_url ? (
          <img
            src={item.cover_url}
            className="w-full h-full object-cover"
            loading="lazy"
            alt={item.name}
          />
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
          <p className="text-[13px] text-gray-600 line-clamp-2 leading-snug">{item.description}</p>
        </div>
      )}

      {/* Big action button */}
      <div className="px-4 py-3">
        <button
          onClick={() => { if (!actionDone) onAction(item.id); }}
          className={`w-full py-3.5 rounded-2xl font-black text-sm transition-all active:scale-[0.98] ${
            actionDone
              ? "bg-gray-100 text-gray-400 cursor-default"
              : "bg-blue-600 text-white"
          }`}
        >
          {actionDone
            ? (isGroup ? "Joined ✓" : "Following ✓")
            : (isGroup ? "Join Circle" : "Follow")}
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
  <div className="bg-white border-b border-gray-100 px-4 py-8 flex flex-col items-center gap-4">
    <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
      <Users size={30} className="text-blue-400" />
    </div>
    <div className="text-center">
      <p className="text-gray-800 font-black text-base">
        {forType === "page" ? "No Pages yet" : "No Circles yet"}
      </p>
      <p className="text-gray-400 text-[12px] mt-1">Be the first to create one!</p>
    </div>
    {onAction && (
      <button
        onClick={onAction}
        className="flex items-center justify-center gap-2 px-8 py-3 rounded-2xl bg-blue-600 text-white font-black text-sm active:scale-[0.98] transition-transform"
      >
        <Plus size={16} /> {forType === "page" ? "Create Page" : "Create Circle"}
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
    const obs = new IntersectionObserver(([entry]) => {
      if (!ref.current) return;
      if (entry.isIntersecting) {
        ref.current.muted = true;
        ref.current.play().catch(() => {});
      } else {
        ref.current.pause();
      }
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [post.media_url]);

  const isYT = post.media_url?.includes("youtube.com") || post.media_url?.includes("youtu.be");

  return (
    <div className="bg-black relative w-full" style={{ aspectRatio: "9/16", maxHeight: "80vh" }}>
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
          {muted ? <VolumeX size={16} className="text-white" /> : <Volume2 size={16} className="text-white" />}
        </button>
      )}
      <div className="absolute bottom-4 left-4 right-14 text-white pointer-events-none">
        <p className="font-bold text-sm drop-shadow-lg">@{post.author || "user"}</p>
        {post.content && <p className="text-xs opacity-80 mt-1 line-clamp-2">{post.content}</p>}
      </div>
      <div className="absolute right-3 bottom-16 flex flex-col items-center gap-4">
        <button onClick={() => setLiked(!liked)} className="flex flex-col items-center">
          <Heart size={26} fill={liked ? "#ff2d55" : "none"} className={liked ? "text-[#ff2d55]" : "text-white"} />
          <span className="text-white text-[10px] font-bold mt-1">{post.likes_count || 0}</span>
        </button>
        <button className="flex flex-col items-center" onClick={() => navigator.share?.({ url: window.location.href })}>
          <Share2 size={24} fill="white" className="text-white" />
          <span className="text-white text-[10px] font-bold mt-1">Share</span>
        </button>
      </div>
    </div>
  );
};

// ── Divider ────────────────────────────────────────────────────────────────────
const FeedDivider = () => <div className="h-2 bg-gray-100" />;

// ── Main Feed ─────────────────────────────────────────────────────────────────
interface FameFeedProps {
  onPostClick?: () => void;
  onImageSelect?: (file: File) => void;
  userProfile?: any;
  suggestions?: { id: string; full_name: string; avatar_url?: string }[];
  onNavigateToCircles?: () => void;
  onNavigateToPages?: () => void;
}

const FameFeed = ({
  onPostClick, onImageSelect, userProfile, suggestions = [],
  onNavigateToCircles, onNavigateToPages,
}: FameFeedProps) => {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeComment, setActiveComment] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [reportModal, setReportModal] = useState<{ postId: string; reason: string } | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [pageSuggestions, setPageSuggestions] = useState<any[]>([]);
  const [groupSuggestions, setGroupSuggestions] = useState<any[]>([]);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);
  const [inFeedDoneIds, setInFeedDoneIds] = useState<Set<string>>(new Set());
  const [trendingFlicks, setTrendingFlicks] = useState<any[]>([]);
  const [flicksLoaded, setFlicksLoaded] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  // Unique channel ID per mount — prevents "cannot add callbacks after subscribe()" error
  const channelId = useRef(`fame-rt-${Date.now()}`);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  const fetchPosts = async () => {
    const { data } = await supabase.from("posts")
      .select(`*, comments:comments(*)`)
      .order("created_at", { ascending: false });
    setPosts(data ?? []);
    setLoading(false);
  };

  const fetchFlicks = async () => {
    try {
      // 1) Try trending_flicks view
      const { data: viewData, error: viewErr } = await supabase
        .from("trending_flicks")
        .select("*")
        .limit(20);
      if (!viewErr && viewData && viewData.length > 0) {
        setTrendingFlicks(viewData);
        setFlicksLoaded(true);
        return;
      }
      // 2) Try dedicated flicks table
      const { data: flicksData, error: flicksErr } = await supabase
        .from("flicks")
        .select("id, author, media_url, type, likes_count, content, cover_url")
        .order("likes_count", { ascending: false })
        .limit(20);
      if (!flicksErr && flicksData && flicksData.length > 0) {
        setTrendingFlicks(flicksData);
        setFlicksLoaded(true);
        return;
      }
      // 3) Fallback: posts table — broad video filter
      const { data: posts } = await supabase
        .from("posts")
        .select("id, author, media_url, type, likes_count, content")
        .or(
          "type.eq.video," +
          "media_url.ilike.%.mp4%," +
          "media_url.ilike.%.webm%," +
          "media_url.ilike.%.mov%," +
          "media_url.ilike.%.m4v%," +
          "media_url.ilike.%youtube%," +
          "media_url.ilike.%rapidcdn%"
        )
        .order("likes_count", { ascending: false })
        .limit(20);
      setTrendingFlicks(posts || []);
    } catch (_) {}
    setFlicksLoaded(true);
  };

  useEffect(() => {
    fetchPosts();
    fetchFlicks();
    const sub = supabase
      .channel(channelId.current)
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => {
        fetchPosts();
        fetchFlicks();
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  useEffect(() => {
    if (currentUserId === null && !suggestionsLoaded) return; // wait for auth check
    async function fetchSuggestions() {
      try {
        // Fetch user's already-joined group IDs to filter them out
        let joinedIds = new Set<string>();
        if (currentUserId) {
          const { data: memberships } = await supabase
            .from("group_members")
            .select("group_id")
            .eq("user_id", currentUserId);
          joinedIds = new Set((memberships || []).map((m: any) => m.group_id));
        }

        // Try community_suggestions view first
        const { data: viewData, error: viewErr } = await supabase
          .from("community_suggestions")
          .select("*")
          .limit(20);

        if (!viewErr && viewData && viewData.length > 0) {
          const filtered = viewData.filter(
            (item: any) => item.type !== "group" && item.type !== "circle" || !joinedIds.has(item.id)
          );
          setPageSuggestions(filtered.filter((i: any) => i.type === "page"));
          setGroupSuggestions(filtered.filter((i: any) => i.type === "group" || i.type === "circle"));
        } else {
          // Fallback: groups table — newest first so user's own new group appears at top
          const { data: groups } = await supabase
            .from("groups")
            .select("id, name, cover_url, description, member_count, privacy, created_at")
            .order("created_at", { ascending: false })
            .limit(20);
          const filtered = (groups || [])
            .filter((g: any) => !joinedIds.has(g.id))
            .map((g: any) => ({ ...g, type: "group" }));
          setGroupSuggestions(filtered);
          setPageSuggestions([]);
        }
      } catch (_) {}
      setSuggestionsLoaded(true);
    }
    fetchSuggestions();
  }, [currentUserId]);

  const handleInFeedAction = async (item: any) => {
    const isGroup = item.type === "group" || item.type === "circle";
    setInFeedDoneIds(prev => new Set([...prev, item.id]));
    if (isGroup && currentUserId) {
      const { error } = await supabase
        .from("group_members")
        .insert([{ group_id: item.id, user_id: currentUserId, role: "member" }]);
      if (error) {
        setInFeedDoneIds(prev => { const n = new Set(prev); n.delete(item.id); return n; });
        toast.error("Could not join. Please try again.");
      } else {
        toast.success(`Joined "${item.name}"!`);
      }
    } else if (!isGroup) {
      toast.success(`Following "${item.name}"!`);
    }
  };

  const handleLike = async (post: any) => {
    if (likedIds.has(post.id)) return;
    setLikedIds(p => new Set([...p, post.id]));
    await supabase.from("posts").update({ likes_count: (post.likes_count || 0) + 1 }).eq("id", post.id);
    fetchPosts();
  };

  const handleAddComment = async (postId: string) => {
    if (!commentText.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("comments").insert([{
      post_id: postId, content: commentText,
      author: user?.user_metadata?.full_name || "Vibe User",
    }]);
    setCommentText("");
    fetchPosts();
  };

  const handleDelete = async (postId: string) => {
    setOpenMenuId(null);
    await supabase.from("posts").delete().eq("id", postId);
    setPosts(p => p.filter(x => x.id !== postId));
  };

  const handleHide = (postId: string) => { setOpenMenuId(null); setHiddenIds(p => new Set([...p, postId])); };

  const handleReportSubmit = async () => {
    if (!reportModal?.reason.trim()) return;
    setReportSubmitting(true);
    await supabase.from("reports").insert([{ post_id: reportModal.postId, reporter_id: currentUserId, reason: reportModal.reason.trim() }]);
    setReportSubmitting(false);
    setReportModal(null);
  };

  const visiblePosts = posts.filter(p => !hiddenIds.has(p.id));

  const videoPosts = useMemo(() =>
    visiblePosts.filter(p =>
      p.media_url && (
        /\.(mp4|webm|ogg|mov|m4v)/i.test(p.media_url.split("?")[0]) ||
        p.media_url.includes("youtube.com") ||
        p.media_url.includes("youtu.be") ||
        p.media_url.includes("rapidcdn.app")
      )
    ), [visiblePosts]);

  const renderPost = (post: any) => {
    const isVideo = post.type === "video" || post.metadata?.is_youtube ||
      (post.media_url && (/\.(mp4|webm|ogg|mov|m4v)/i.test(post.media_url.split("?")[0]) ||
        post.media_url.includes("youtube.com") || post.media_url.includes("youtu.be") || post.media_url.includes("rapidcdn.app")));

    return (
      <motion.article key={post.id} layout
        exit={{ opacity: 0, x: 60, transition: { duration: 0.2 } }}
        className="bg-white border-b border-gray-100"
      >
        {/* Post header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-sm shrink-0 border border-gray-100">
              {post.author?.[0]?.toUpperCase() || "V"}
            </div>
            <div>
              <p className="text-gray-900 font-bold text-sm leading-none">{post.author || "Vibe User"}</p>
              <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide mt-0.5">
                {isVideo ? "🎬 Reel" : "📷 Post"} · Verified Creator
              </p>
            </div>
          </div>
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setOpenMenuId(openMenuId === post.id ? null : post.id)}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors">
              <MoreVertical size={18} className="text-gray-400" />
            </button>
            <AnimatePresence>
              {openMenuId === post.id && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.88, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.88, y: -6 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-0 top-10 z-50 w-44 bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-xl"
                    onClick={e => e.stopPropagation()}
                  >
                    {post.author_id === currentUserId && (
                      <button onClick={() => handleDelete(post.id)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 text-red-500 hover:bg-red-50 text-sm font-semibold border-b border-gray-100">
                        <Trash2 size={15} /> Delete
                      </button>
                    )}
                    <button onClick={() => handleHide(post.id)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 text-gray-600 hover:bg-gray-50 text-sm font-semibold border-b border-gray-100">
                      <EyeOff size={15} /> Hide
                    </button>
                    <button onClick={() => { setOpenMenuId(null); setReportModal({ postId: post.id, reason: "" }); }}
                      className="w-full flex items-center gap-3 px-4 py-3.5 text-orange-500 hover:bg-orange-50 text-sm font-semibold">
                      <Flag size={15} /> Report
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {post.content && <PostCaption content={post.content} />}
        <PostMedia post={post} />

        {/* Action bar */}
        <div className="flex items-center gap-5 px-4 py-2.5">
          <button onClick={() => handleLike(post)} className="flex items-center gap-1.5 group">
            <Heart size={22}
              className={likedIds.has(post.id) ? "fill-red-500 text-red-500" : "text-gray-400 group-hover:text-red-400 transition-colors"} />
            <span className="text-xs font-bold text-gray-500">{post.likes_count || 0}</span>
          </button>
          <button onClick={() => setActiveComment(activeComment === post.id ? null : post.id)}
            className="flex items-center gap-1.5 group">
            <MessageCircle size={22} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
            <span className="text-xs font-bold text-gray-500">{post.comments?.length || 0}</span>
          </button>
          <button onClick={() => navigator.share?.({ url: window.location.href })}
            className="flex items-center gap-1.5 group ml-auto">
            <Share2 size={20} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
          </button>
        </div>

        {/* Inline comments */}
        <AnimatePresence>
          {activeComment === post.id && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-gray-100">
              <div className="px-4 pt-3 pb-1 flex gap-2">
                <input type="text" placeholder="Write a comment…"
                  className="flex-1 bg-gray-100 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-400/30"
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAddComment(post.id)} />
                <button onClick={() => handleAddComment(post.id)}
                  className="bg-blue-600 text-white px-4 rounded-xl">
                  <Send size={16} />
                </button>
              </div>
              <div className="px-4 py-2 space-y-2 max-h-48 overflow-y-auto">
                {post.comments?.map((c: any) => (
                  <div key={c.id} className="flex gap-3 py-1">
                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-black text-blue-600 shrink-0">
                      {c.author?.[0]}
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-blue-600 uppercase tracking-tight">{c.author}</span>
                      <p className="text-xs text-gray-600 mt-0.5 leading-snug">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.article>
    );
  };

  // ── Build dynamic feed blocks ──────────────────────────────────────────────
  const feedBlocks = useMemo(() => {
    const BATCH = 3;
    type Block = { type: string; posts?: any[]; post?: any; key: string };
    const blocks: Block[] = [];
    if (visiblePosts.length === 0) return blocks;

    let postCursor = 0;
    let reelCursor = 0;
    let cycle = 0;

    while (postCursor < visiblePosts.length) {
      // ── Batch 1: first 3 posts ─────────────────────────────────────
      const batch1 = visiblePosts.slice(postCursor, postCursor + BATCH);
      postCursor += BATCH;
      if (batch1.length > 0) blocks.push({ type: "posts", posts: batch1, key: `b1-${cycle}` });

      // ── Pages Row (shown once on first cycle, then every 4 cycles) ──
      if (suggestionsLoaded && (cycle === 0 || cycle % 4 === 0)) {
        blocks.push({ type: "pages-row", key: `pr-${cycle}` });
      }

      // ── Trending Flicks Row (every cycle) ──────────────────────────
      if (videoPosts.length > 0) blocks.push({ type: "reels-row", key: `rr-${cycle}` });

      // ── Batch 2: next 3 posts ──────────────────────────────────────
      const batch2 = visiblePosts.slice(postCursor, postCursor + BATCH);
      postCursor += BATCH;
      if (batch2.length > 0) blocks.push({ type: "posts", posts: batch2, key: `b2-${cycle}` });

      // ── Circles Row (shown once on first cycle, then every 4 cycles) ─
      if (suggestionsLoaded && (cycle === 0 || cycle % 4 === 0)) {
        blocks.push({ type: "circles-row", key: `cr-${cycle}` });
      }

      // ── Single Full-Width Reel (every cycle) ──────────────────────
      if (videoPosts.length > 0) {
        blocks.push({ type: "single-reel", post: videoPosts[reelCursor % videoPosts.length], key: `sr-${cycle}` });
        reelCursor++;
      }

      cycle++;
    }

    return blocks;
  }, [visiblePosts, videoPosts, suggestionsLoaded]);

  return (
    <div className="bg-gray-50">
      {/* ── "What's on your mind" bar ──────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100">
        {userProfile?.avatar_url ? (
          <img src={userProfile.avatar_url} loading="lazy"
            className="w-10 h-10 rounded-full object-cover border border-gray-200 cursor-pointer shrink-0"
            onClick={onPostClick} />
        ) : (
          <div onClick={onPostClick}
            className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-sm border border-gray-200 cursor-pointer shrink-0">
            {userProfile?.full_name?.[0] || "U"}
          </div>
        )}
        <div onClick={onPostClick}
          className="flex-1 bg-gray-100 py-2.5 px-4 rounded-full text-gray-400 text-sm font-medium border border-gray-200 cursor-pointer">
          What's on your mind?
        </div>
        <button className="p-2 active:scale-90 transition-transform shrink-0"
          onClick={() => galleryInputRef.current?.click()}>
          <ImageIcon size={22} className="text-blue-600" />
        </button>
        <input ref={galleryInputRef} type="file" accept="image/*,video/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (!f) return; onImageSelect?.(f); onPostClick?.(); e.target.value = ""; }} />
      </div>

      {/* ── People You May Know — same card size as Flicks ───────────── */}
      {suggestions.length > 0 && (
        <div className="bg-white border-b border-gray-100 pt-3 pb-2">
          <p className="text-[12px] font-black text-gray-700 px-4 mb-2">People You May Know</p>
          <div className="flex gap-3 overflow-x-auto px-4 pb-1 no-scrollbar">
            {suggestions.map((u, i) => {
              const GRAD = ["#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ef4444","#06b6d4"];
              return (
                <div key={u.id} className="flex-shrink-0 relative rounded-2xl overflow-hidden border border-gray-200 shadow-sm"
                  style={{
                    width: "calc((100vw - 48px) / 3)",
                    height: "calc((100vw - 48px) / 3 * 1.4)",
                    maxWidth: "160px",
                    maxHeight: "224px",
                    background: `linear-gradient(160deg,${GRAD[i % GRAD.length]} 0%,#1e1b4b 100%)`,
                  }}
                >
                  {u.avatar_url ? (
                    <img src={u.avatar_url} loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white font-black text-4xl">
                      {(u.full_name || "U")[0].toUpperCase()}
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent pt-8 pb-2.5 px-2 flex flex-col items-center gap-1.5">
                    <p className="text-white text-[10px] font-black truncate w-full text-center leading-tight">
                      {u.full_name?.split(" ")[0] || "User"}
                    </p>
                    <button className="w-full py-1 bg-green-500 text-white text-[9px] font-black rounded-lg leading-none">
                      + Add
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Loading ───────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12 bg-white">
          <Loader2 className="animate-spin text-blue-500 mb-2" size={26} />
          <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Loading Feed</p>
        </div>
      )}

      {/* ── Dynamic Feed ──────────────────────────────────────────────── */}
      {feedBlocks.map(block => {
        if (block.type === "posts") {
          return (
            <div key={block.key}>
              <AnimatePresence>
                {block.posts!.map(post => renderPost(post))}
              </AnimatePresence>
              <FeedDivider />
            </div>
          );
        }
        if (block.type === "reels-row") {
          return (
            <div key={block.key}>
              <TrendingFlicksRow flicks={trendingFlicks} loaded={flicksLoaded} />
              <FeedDivider />
            </div>
          );
        }
        if (block.type === "pages-row") {
          return (
            <div key={block.key}>
              <SuggestedPagesRow
                pages={pageSuggestions}
                doneIds={inFeedDoneIds}
                onAction={handleInFeedAction}
                onCreatePage={onNavigateToPages}
              />
              <FeedDivider />
            </div>
          );
        }
        if (block.type === "circles-row") {
          return (
            <div key={block.key}>
              <SuggestedCirclesRow
                circles={groupSuggestions}
                doneIds={inFeedDoneIds}
                onAction={handleInFeedAction}
                onCreateCircle={onNavigateToCircles}
              />
              <FeedDivider />
            </div>
          );
        }
        if (block.type === "single-reel" && block.post) {
          return (
            <div key={block.key}>
              <SingleReelBlock post={block.post} />
              <FeedDivider />
            </div>
          );
        }
        return null;
      })}

      {!loading && visiblePosts.length === 0 && (
        <div className="flex flex-col items-center py-20 text-gray-300 bg-white">
          <p className="font-black uppercase tracking-widest text-xs">No posts yet</p>
        </div>
      )}

      {/* ── Report modal ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {reportModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setReportModal(null)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="w-full max-w-lg bg-white rounded-t-3xl p-6 pb-10 border-t border-gray-100 shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-gray-900 font-black text-lg flex items-center gap-2">
                  <Flag size={18} className="text-orange-500" /> Report Post
                </h3>
                <button onClick={() => setReportModal(null)} className="p-1.5 rounded-full bg-gray-100 text-gray-500">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-2 mb-5">
                {["Spam or misleading", "Inappropriate content", "Hate speech", "Harassment", "Other"].map(r => (
                  <button key={r} onClick={() => setReportModal(p => p ? { ...p, reason: r } : p)}
                    className={`w-full text-left px-4 py-3.5 rounded-xl text-sm font-semibold border transition-all ${
                      reportModal.reason === r
                        ? "bg-orange-50 border-orange-300 text-orange-700"
                        : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                    }`}>
                    {r}
                  </button>
                ))}
              </div>
              <button onClick={handleReportSubmit} disabled={!reportModal.reason || reportSubmitting}
                className="w-full py-4 rounded-2xl bg-orange-500 text-white font-black text-sm uppercase tracking-wider disabled:opacity-40">
                {reportSubmitting ? "Submitting…" : "Submit Report"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FameFeed;
