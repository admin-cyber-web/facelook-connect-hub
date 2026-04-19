import React, { useState, useRef, useEffect, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import { useProfileViewer } from "../context/ProfileViewerContext";
import { useSoundEffects } from "../hooks/useSoundEffects";
import {
  Heart,
  MessageCircle,
  Share2,
  Music,
  VolumeX,
  Plus,
  Check,
  Eye,
  MoreVertical,
  Trash2,
  EyeOff,
  Flag,
  X,
  Send,
  BadgeCheck,
  Loader2,
  Flame,
  Pencil,
} from "lucide-react";
import { MagnetButton, CreatorVoice, useMagnet } from "./MagnetSystem";
import { toast } from "sonner";

// -- Utilities --
const formatCount = (n: number): string => {
  if (!n) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(".0", "") + "M";
  if (n >= 1_000)
    return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(".0", "") + "K";
  return String(n);
};

const getLuckFactor = (id: string): number => {
  if (!id) return 1;
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 10) + 1;
};

const isVerified = (postId: string) => getLuckFactor(postId) >= 6;

const seededRnd = (postId: string, salt: number) => {
  const luck = getLuckFactor(postId + salt);
  const x = Math.sin(luck * 9301 + salt * 49297 + 233567) * 10000;
  return x - Math.floor(x);
};

const getBonusEngagement = (
  post: any,
): { likes: number; views: number; shares: number } => {
  if (!post?.created_at) return { likes: 0, views: 0, shares: 0 };
  const ageHrs = (Date.now() - new Date(post.created_at).getTime()) / 3_600_000;
  if (ageHrs < 1) return { likes: 0, views: 0, shares: 0 };

  const luck = getLuckFactor(post.id);
  const r = (salt: number) => seededRnd(post.id, salt);

  if (luck <= 4)
    return {
      likes: Math.floor(50 + r(1) * 50),
      views: Math.floor(200 + r(2) * 300),
      shares: Math.floor(r(3) * 10),
    };
  if (luck <= 8)
    return {
      likes: Math.floor(100 + r(1) * 400),
      views: Math.floor(600 + r(2) * 1400),
      shares: Math.floor(10 + r(3) * 50),
    };
  return {
    likes: Math.floor(500 + r(1) * 4500),
    views: Math.floor(1000 + r(2) * 9000),
    shares: Math.floor(50 + r(3) * 450),
  };
};

const HUMAN_STEPS = [
  0, 0, 2, 0, 0, 5, 1, 0, 3, 0, 0, 7, 0, 2, 0, 0, 1, 4, 0, 0,
];

// -- Video Fallback --
const VideoFallback = ({ title }: { title?: string }) => (
  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
    <div className="text-5xl mb-4">🎬</div>
    <p className="text-white/40 text-xs font-bold uppercase tracking-widest text-center px-8">
      {title || "Video unavailable"}
    </p>
  </div>
);

// -- Media Component --
const FlickMedia = ({ post, videoRef, isMuted, isActive }: any) => {
  const [videoFailed, setVideoFailed] = useState(false);
  const url = post?.media_url || post?.video_url || "";
  const isYouTube = url.includes("youtube.com") || url.includes("youtu.be");

  if (isYouTube) {
    if (!isActive) return <div className="w-full h-full bg-black" />;
    const match = url.match(
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|\/shorts\/)([^#&?]*).*/,
    );
    const videoId = match?.[2]?.length === 11 ? match[2] : null;
    if (!videoId) return <VideoFallback title={post?.content} />;
    const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=${isMuted ? 1 : 0}&loop=1&playlist=${videoId}&controls=0&modestbranding=1`;
    return (
      <div className="relative w-full h-full bg-black overflow-hidden pointer-events-none">
        <iframe
          src={embedUrl}
          className="absolute inset-0 w-full h-[120%] -top-[10%] scale-[1.5]"
          allow="autoplay; encrypted-media"
          title="Flick"
        />
      </div>
    );
  }
  if (videoFailed || !url) return <VideoFallback title={post?.content} />;
  return (
    <video
      ref={videoRef}
      src={url}
      className="w-full h-full object-cover"
      loop
      muted={isMuted}
      playsInline
      preload="metadata"
      onError={() => setVideoFailed(true)}
    />
  );
};

// -- Comment Drawer --
const CommentDrawer = ({
  post,
  currentUserId,
  onClose,
}: {
  post: any;
  currentUserId: string | null;
  onClose: () => void;
}) => {
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const { playSwoosh } = useSoundEffects();

  useEffect(() => {
    if (!post?.id) return;
    supabase
      .from("comments")
      .select("id, content, author_id, created_at")
      .eq("post_id", post.id)
      .order("created_at")
      .then(({ data }) => setComments(data || []));
  }, [post?.id]);

  const send = async () => {
    if (!text.trim() || !currentUserId || !post?.id) return;
    setSending(true);
    playSwoosh();
    const { data } = await supabase
      .from("comments")
      .insert([
        { post_id: post.id, content: text.trim(), author_id: currentUserId },
      ])
      .select()
      .single();
    if (data) setComments((prev) => [...prev, data]);
    setText("");
    setSending(false);
  };

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 300 }}
      className="fixed bottom-0 left-0 right-0 max-w-[500px] mx-auto bg-zinc-900/98 backdrop-blur-xl rounded-t-3xl z-[200] border-t border-white/10 shadow-2xl"
      style={{ maxHeight: "65vh", display: "flex", flexDirection: "column" }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <MessageCircle size={18} className="text-blue-400" />
          <span className="text-white font-black text-base">
            {comments.length} Comments
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full bg-white/10 text-white/60 hover:bg-white/20"
        >
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        {comments.length === 0 && (
          <p className="text-white/30 text-sm text-center py-8">
            No comments yet.
          </p>
        )}
        {comments.map((c: any, i: number) => (
          <div key={c.id || i} className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-black text-white shrink-0">
              {(c.author_id || "U")[0].toUpperCase()}
            </div>
            <div>
              <p className="text-white/80 text-[11px] font-black mb-0.5">
                User
              </p>
              <p className="text-white/70 text-sm leading-snug">{c.content}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 py-3 border-t border-white/10 flex gap-2 shrink-0 pb-safe">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          placeholder="Add a comment…"
          className="flex-1 bg-white/10 text-white px-4 py-2.5 rounded-full outline-none border border-white/10 focus:border-blue-500/60"
        />
        <button
          onClick={send}
          disabled={!text.trim() || sending}
          className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center disabled:opacity-40"
        >
          {sending ? (
            <Loader2 size={16} className="animate-spin text-white" />
          ) : (
            <Send size={16} className="text-white" />
          )}
        </button>
      </div>
    </motion.div>
  );
};

function CreatorVoiceOnCard({
  postId,
  postType,
  currentUserId,
}: {
  postId: string;
  postType: string;
  currentUserId: string | null;
}) {
  const { voice } = useMagnet(postId, postType, currentUserId);
  return <CreatorVoice voice={voice} />;
}

// -- FlickCard (Safe Render) --
const FlickCard = memo(
  ({
    post,
    isActive,
    currentUserId,
    onDelete,
    onHide,
    onReport,
    onEdit,
    onBridgeChat,
  }: any) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [likedByMe, setLikedByMe] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editText, setEditText] = useState(post?.content || "");
    const [editSaving, setEditSaving] = useState(false);
    const { openProfile } = useProfileViewer();
    const { playPop, playSwoosh } = useSoundEffects();

    const bonus = getBonusEngagement(post);
    const baseLikes = (post?.likes_count || 0) + bonus.likes;
    const baseViews = (post?.views_count || 0) + bonus.views;
    const baseShares = (post?.shares_count || 0) + bonus.shares;

    const [liveLikes, setLiveLikes] = useState(baseLikes);
    const [liveViews, setLiveViews] = useState(baseViews);
    const tickRef = useRef(0);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const createdAt = post?.created_at
      ? new Date(post.created_at).getTime()
      : Date.now();
    const ageHrs = (Date.now() - createdAt) / 3_600_000;
    const isViral = getLuckFactor(post?.id || "0") >= 9;

    const scheduleTick = useCallback(() => {
      if (!isActive || ageHrs < 1) return;
      const delay = 800 + Math.random() * 2200;
      timerRef.current = setTimeout(() => {
        const step = HUMAN_STEPS[tickRef.current % HUMAN_STEPS.length];
        tickRef.current++;
        const viewStep = isViral
          ? step * 3 + Math.floor(Math.random() * 5)
          : step;
        if (step > 0) setLiveLikes((prev) => prev + step);
        if (viewStep > 0) setLiveViews((prev) => prev + viewStep);
        scheduleTick();
      }, delay);
    }, [isActive, ageHrs, isViral]);

    useEffect(() => {
      setLiveLikes(baseLikes);
      setLiveViews(baseViews);
    }, [baseLikes, baseViews]);
    useEffect(() => {
      if (isActive) scheduleTick();
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }, [isActive, scheduleTick]);

    useEffect(() => {
      if (!videoRef.current) return;
      if (isActive) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {
          if (videoRef.current) {
            videoRef.current.muted = true;
            setIsMuted(true);
            videoRef.current.play();
          }
        });
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    }, [isActive]);

    const handleLike = async (e: React.MouseEvent) => {
      e.stopPropagation();
      playPop();
      const newVal = !likedByMe;
      setLikedByMe(newVal);
      setLiveLikes((prev) => prev + (newVal ? 1 : -1));
      try {
        if (newVal) {
          await supabase
            .from("likes")
            .upsert(
              {
                post_id: post.id,
                user_id: currentUserId,
                reaction_type: "like",
              },
              { onConflict: "post_id,user_id" },
            );
          await supabase
            .from("posts")
            .update({ likes_count: (post.likes_count || 0) + 1 })
            .eq("id", post.id);
        } else {
          await supabase
            .from("likes")
            .delete()
            .eq("post_id", post.id)
            .eq("user_id", currentUserId);
          await supabase
            .from("posts")
            .update({ likes_count: Math.max((post.likes_count || 1) - 1, 0) })
            .eq("id", post.id);
        }
      } catch (_) {}
    };

    const luck = getLuckFactor(post?.id || "0");
    const verified = isVerified(post?.id || "0");

    return (
      <div className="relative w-full h-[100dvh] bg-black snap-start flex items-center justify-center overflow-hidden shrink-0">
        <FlickMedia
          post={post}
          videoRef={videoRef}
          isMuted={isMuted}
          isActive={isActive}
        />
        {!menuOpen && !showComments && (
          <div
            className="absolute inset-0 z-10"
            onClick={() => setIsMuted(!isMuted)}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/75 pointer-events-none z-20" />

        {isActive && post?.id && (
          <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none">
            <CreatorVoiceOnCard
              postId={post.id}
              postType="flick"
              currentUserId={currentUserId}
            />
          </div>
        )}

        {luck >= 9 && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-14 left-4 z-50 flex items-center gap-1.5 bg-gradient-to-r from-orange-500 to-red-500 px-3 py-1.5 rounded-full shadow-lg"
          >
            <Flame size={13} fill="white" className="text-white" />
            <span className="text-white text-[11px] font-black uppercase tracking-wide">
              Viral
            </span>
          </motion.div>
        )}

        <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5 z-40 text-white">
          <div className="relative mb-1">
            <div
              className="w-12 h-12 rounded-full border-2 border-white bg-zinc-800 flex items-center justify-center font-bold text-lg overflow-hidden cursor-pointer"
              onClick={() => post?.author_id && openProfile(post.author_id)}
            >
              {(post?.author || post?.username || "V")[0].toUpperCase()}
            </div>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-[#ff2d55] rounded-full p-0.5 border-2 border-black">
              <Plus size={14} />
            </div>
          </div>

          <button onClick={handleLike} className="flex flex-col items-center">
            <Heart
              size={32}
              fill={likedByMe ? "#ff2d55" : "none"}
              className={likedByMe ? "text-[#ff2d55]" : "text-white"}
            />
            <span className="text-[11px] font-bold mt-1">
              {formatCount(liveLikes)}
            </span>
          </button>

          <button
            onClick={() => setShowComments(true)}
            className="flex flex-col items-center"
          >
            <MessageCircle size={32} className="text-white" />
            <span className="text-[11px] font-bold mt-1">
              {post?.comments?.length || 0}
            </span>
          </button>

          <div className="flex flex-col items-center">
            <Eye size={30} />
            <span className="text-[11px] font-bold mt-1">
              {formatCount(liveViews)}
            </span>
          </div>
          <button
            onClick={() => navigator.share({ url: window.location.href })}
            className="flex flex-col items-center"
          >
            <Share2 size={30} />
            <span className="text-[11px] font-bold mt-1">
              {formatCount(baseShares)}
            </span>
          </button>

          <MagnetButton
            postId={post?.id}
            postType="flick"
            postOwnerId={post?.author_id || ""}
            currentUserId={currentUserId}
            onBridgeChat={onBridgeChat}
            dark
          />
        </div>

        <div className="absolute bottom-8 left-4 right-16 text-white z-40 pointer-events-none">
          <div className="flex items-center gap-2 mb-1.5">
            <h3
              className="font-black text-base drop-shadow-lg pointer-events-auto"
              onClick={() => post?.author_id && openProfile(post.author_id)}
            >
              @{post?.author || post?.username || "vibe_user"}
            </h3>
            {verified ? (
              <BadgeCheck size={18} className="text-blue-400" />
            ) : (
              <span className="bg-blue-500/80 p-0.5 rounded-full">
                <Check size={10} />
              </span>
            )}
          </div>
          <p className="text-sm opacity-90 mb-4 line-clamp-2 leading-snug">
            {post?.content || post?.caption}
          </p>
        </div>

        <AnimatePresence>
          {showComments && (
            <>
              <div
                className="fixed inset-0 z-[190] bg-black/50"
                onClick={() => setShowComments(false)}
              />
              <CommentDrawer
                post={post}
                currentUserId={currentUserId}
                onClose={() => setShowComments(false)}
              />
            </>
          )}
        </AnimatePresence>
      </div>
    );
  },
);

// -- Main App --
export default function FlicksApp({
  onBack,
  onBridgeChat,
}: {
  onBack?: () => void;
  onBridgeChat?: (userId: string, userName: string) => void;
}) {
  const [flicks, setFlicks] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    (async () => {
      const isVideoPost = (p: any): boolean =>
        p.type === "video" ||
        /\.(mp4|webm|ogg|mov|m4v)/i.test(
          (p.media_url || p.video_url || "").split("?")[0],
        ) ||
        (p.media_url || "").includes("youtube.com") ||
        (p.media_url || "").includes("rapidcdn.app");

      const normalizeFlickRow = (row: any) => ({
        _source: "flicks",
        id: `flick_${row.id}`,
        _raw_id: row.id,
        author_id: row.author_id || row.user_id || null,
        author: row.username || row.author || "User",
        content: row.caption || row.content || "",
        media_url: row.video_url || row.media_url || "",
        type: "video",
        likes_count: row.likes_count ?? 0,
        created_at: row.created_at || new Date().toISOString(),
      });

      try {
        const [postsResult, flicksResult] = await Promise.all([
          supabase
            .from("posts")
            .select("*")
            .or("type.eq.video,media_url.ilike.%.mp4%")
            .order("created_at", { ascending: false })
            .limit(50),
          supabase
            .from("flicks")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(50),
        ]);

        const fromPosts = (postsResult.data || [])
          .filter(isVideoPost)
          .map((p) => ({ ...p, _source: "posts" }));
        const fromFlicks = (flicksResult.data || []).map(normalizeFlickRow);

        const merged = [...fromPosts, ...fromFlicks].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        setFlicks(merged);
      } catch (err) {
        console.error("Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const newIndex = Math.round(
      containerRef.current.scrollTop / containerRef.current.clientHeight,
    );
    if (newIndex !== currentIndex) setCurrentIndex(newIndex);
  };

  const visibleFlicks = flicks.filter((p) => !hiddenIds.has(p.id));

  if (loading)
    return (
      <div className="h-screen w-full bg-black flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    );

  return (
    <div className="fixed inset-0 bg-black z-[100] overflow-hidden">
      {onBack && (
        <button
          onClick={onBack}
          className="fixed top-12 left-4 z-[110] p-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-white"
        >
          <X size={20} />
        </button>
      )}

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
      >
        {visibleFlicks.length === 0 ? (
          <div className="h-full flex items-center justify-center text-white/40 font-bold uppercase tracking-widest">
            Abhi koi Flick nahi hai
          </div>
        ) : (
          visibleFlicks.map((flick, index) => (
            <FlickCard
              key={`${flick._source}-${flick.id}-${index}`}
              post={flick}
              isActive={index === currentIndex}
              currentUserId={currentUserId}
              onHide={(id: string) =>
                setHiddenIds((prev) => new Set([...prev, id]))
              }
              onBridgeChat={onBridgeChat}
            />
          ))
        )}
      </div>
    </div>
  );
}
