import React, { useState, useRef, useEffect, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import { useProfileViewer } from "../context/ProfileViewerContext";
import { useSoundEffects } from "../hooks/useSoundEffects";
import {
  Heart,
  MessageCircle,
  Share2,
  Plus,
  Check,
  Eye,
  X,
  Send,
  BadgeCheck,
  Loader2,
  Flame,
} from "lucide-react";
import { MagnetButton, CreatorVoice, useMagnet } from "./MagnetSystem";

// -- Safe Formatter --
const formatCount = (n: any): string => {
  const num = Number(n);
  if (!num || isNaN(num)) return "0";
  if (num >= 1_000_000)
    return (num / 1_000_000).toFixed(1).replace(".0", "") + "M";
  if (num >= 1_000)
    return (num / 1_000).toFixed(num >= 10_000 ? 0 : 1).replace(".0", "") + "K";
  return String(num);
};

const getLuckFactor = (id: string): number => {
  if (!id) return 1;
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 10) + 1;
};

// -- Media Component (With Error Boundary) --
const FlickMedia = ({ post, videoRef, isMuted, isActive }: any) => {
  const [videoFailed, setVideoFailed] = useState(false);
  const url = post?.media_url || post?.video_url || "";

  if (videoFailed || !url) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900">
        <p className="text-white/20 text-xs">Video Loading...</p>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      src={url}
      className="w-full h-full object-cover"
      loop
      muted={isMuted}
      playsInline
      preload="auto"
      onError={() => setVideoFailed(true)}
    />
  );
};

// -- Comment Drawer --
const CommentDrawer = ({ post, currentUserId, onClose }: any) => {
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState("");
  const sounds = useSoundEffects(); // Safety check for hook

  useEffect(() => {
    if (!post?._raw_id) return;
    supabase
      .from("comments")
      .select("*")
      .eq("post_id", post._raw_id)
      .then(({ data }) => setComments(data || []));
  }, [post]);

  const send = async () => {
    if (!text.trim() || !currentUserId) return;
    sounds?.playSwoosh?.();
    const { data } = await supabase
      .from("comments")
      .insert([
        {
          post_id: post._raw_id,
          content: text.trim(),
          author_id: currentUserId,
        },
      ])
      .select()
      .single();
    if (data) setComments((prev) => [...prev, data]);
    setText("");
  };

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      className="fixed bottom-0 left-0 right-0 max-w-[500px] mx-auto bg-zinc-900 rounded-t-3xl z-[205] h-[60vh] flex flex-col border-t border-white/10"
    >
      <div className="p-4 border-b border-white/10 flex justify-between items-center">
        <span className="text-white font-bold">{comments.length} Comments</span>
        <X className="text-white cursor-pointer" onClick={onClose} />
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {comments.map((c, i) => (
          <div key={i} className="flex gap-2 text-white/80 text-sm">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex-shrink-0" />
            <p>{c.content}</p>
          </div>
        ))}
      </div>
      <div className="p-4 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 bg-white/10 rounded-full px-4 text-white"
          placeholder="Add comment..."
        />
        <button onClick={send} className="bg-blue-500 p-2 rounded-full">
          <Send size={18} className="text-white" />
        </button>
      </div>
    </motion.div>
  );
};

// -- FlickCard (The Core) --
const FlickCard = memo(
  ({ post, isActive, currentUserId, onBridgeChat }: any) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [likedByMe, setLikedByMe] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [liveLikes, setLiveLikes] = useState(Number(post?.likes_count || 0));
    const sounds = useSoundEffects();
    const { openProfile } = useProfileViewer();

    useEffect(() => {
      if (isActive && videoRef.current) {
        videoRef.current.play().catch(() => {
          setIsMuted(true);
          videoRef.current?.play();
        });
      } else if (videoRef.current) {
        videoRef.current.pause();
      }
    }, [isActive]);

    const handleLike = () => {
      sounds?.playPop?.();
      setLikedByMe(!likedByMe);
      setLiveLikes((prev) => (likedByMe ? prev - 1 : prev + 1));
    };

    if (!post) return null;

    return (
      <div className="relative w-full h-[100dvh] bg-black snap-start flex items-center justify-center overflow-hidden">
        <FlickMedia
          post={post}
          videoRef={videoRef}
          isMuted={isMuted}
          isActive={isActive}
        />

        <div
          className="absolute inset-0 z-10"
          onClick={() => setIsMuted(!isMuted)}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60 pointer-events-none z-20" />

        {/* Right Actions */}
        <div className="absolute right-3 bottom-24 flex flex-col items-center gap-6 z-40">
          <div
            className="w-12 h-12 rounded-full border-2 border-white overflow-hidden"
            onClick={() => openProfile?.(post.author_id)}
          >
            <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-white font-bold">
              {post.author?.[0] || "U"}
            </div>
          </div>

          <button
            onClick={handleLike}
            className="flex flex-col items-center text-white"
          >
            <Heart
              size={35}
              fill={likedByMe ? "#ff2d55" : "none"}
              className={likedByMe ? "text-[#ff2d55]" : "text-white"}
            />
            <span className="text-xs font-bold">{formatCount(liveLikes)}</span>
          </button>

          <button
            onClick={() => setShowComments(true)}
            className="flex flex-col items-center text-white"
          >
            <MessageCircle size={35} />
            <span className="text-xs font-bold">
              {post.comments_count || 0}
            </span>
          </button>

          <div className="flex flex-col items-center text-white">
            <Eye size={35} />
            <span className="text-xs font-bold">
              {formatCount(post.views_count)}
            </span>
          </div>

          <MagnetButton
            postId={post.id}
            postType="flick"
            postOwnerId={post.author_id}
            currentUserId={currentUserId}
            onBridgeChat={onBridgeChat}
            dark
          />
        </div>

        {/* Bottom Info */}
        <div className="absolute bottom-10 left-4 right-16 text-white z-40 pointer-events-none">
          <h3 className="font-bold text-lg">@{post.author || "user"}</h3>
          <p className="text-sm opacity-90 line-clamp-2">{post.content}</p>
        </div>

        <AnimatePresence>
          {showComments && (
            <CommentDrawer
              post={post}
              currentUserId={currentUserId}
              onClose={() => setShowComments(false)}
            />
          )}
        </AnimatePresence>
      </div>
    );
  },
);

// -- Main App --
export default function FlicksApp({ onBack, onBridgeChat }: any) {
  const [flicks, setFlicks] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }) => setCurrentUserId(data.user?.id ?? null));

    const fetchData = async () => {
      try {
        const { data, error } = await supabase
          .from("posts")
          .select("*")
          .eq("type", "video")
          .limit(20);
        if (error) throw error;

        const normalized = (data || []).map((p) => ({
          id: `post_${p.id}`,
          _raw_id: p.id,
          author_id: p.author_id || p.user_id,
          author: p.username || "User",
          content: p.caption || p.content || "",
          media_url: p.video_url || p.media_url,
          likes_count: p.likes_count || 0,
          views_count: p.views_count || 0,
          created_at: p.created_at,
        }));

        setFlicks(normalized);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const onScroll = () => {
    if (!containerRef.current) return;
    const idx = Math.round(
      containerRef.current.scrollTop / containerRef.current.clientHeight,
    );
    if (idx !== currentIndex) setCurrentIndex(idx);
  };

  if (loading)
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <Loader2 className="animate-spin text-cyan-500" size={40} />
      </div>
    );

  return (
    <div className="fixed inset-0 bg-black z-[100]">
      {onBack && (
        <button
          onClick={onBack}
          className="fixed top-10 left-4 z-[110] p-2 bg-black/50 rounded-full text-white"
        >
          <X size={24} />
        </button>
      )}
      <div
        ref={containerRef}
        onScroll={onScroll}
        className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
      >
        {flicks.length === 0 ? (
          <div className="h-full flex items-center justify-center text-white/50">
            No Videos Found
          </div>
        ) : (
          flicks.map((f, i) => (
            <FlickCard
              key={f.id}
              post={f}
              isActive={i === currentIndex}
              currentUserId={currentUserId}
              onBridgeChat={onBridgeChat}
            />
          ))
        )}
      </div>
    </div>
  );
}
