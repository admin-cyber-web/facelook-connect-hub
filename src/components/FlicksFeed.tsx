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
import { toast } from "sonner";

// -- Utilities --
const formatCount = (n: any): string => {
  const num = Number(n);
  if (!num || isNaN(num)) return "0";
  if (num >= 1_000_000)
    return (num / 1_000_000).toFixed(1).replace(".0", "") + "M";
  if (num >= 1_000)
    return (num / 1_000).toFixed(num >= 10_000 ? 0 : 1).replace(".0", "") + "K";
  return String(num);
};

// -- Comment Drawer (Full Functionality) --
const CommentDrawer = ({ post, currentUserId, onClose }: any) => {
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const sounds = useSoundEffects();

  useEffect(() => {
    if (!post?._raw_id) return;
    const fetchComments = async () => {
      const { data } = await supabase
        .from("comments")
        .select("*")
        .eq("post_id", post._raw_id)
        .order("created_at", { ascending: true });
      setComments(data || []);
    };
    fetchComments();
  }, [post]);

  const handleSend = async () => {
    if (!text.trim() || !currentUserId) return;
    setSending(true);
    sounds?.playSwoosh?.();

    try {
      const { data, error } = await supabase
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

      if (error) throw error;
      if (data) setComments((prev) => [...prev, data]);
      setText("");
    } catch (err) {
      toast.error("Comment send nahi hua");
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      className="fixed bottom-0 left-0 right-0 max-w-[500px] mx-auto bg-zinc-900/95 backdrop-blur-xl rounded-t-3xl z-[205] h-[70vh] flex flex-col border-t border-white/10 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-4 border-b border-white/10 flex justify-between items-center">
        <span className="text-white font-bold text-lg">
          {comments.length} Comments
        </span>
        <button
          onClick={onClose}
          className="p-2 bg-white/5 rounded-full text-white/50"
        >
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {comments.length === 0 && (
          <p className="text-white/20 text-center py-10">
            Pehla comment aap karein!
          </p>
        )}
        {comments.map((c, i) => (
          <div key={c.id || i} className="flex gap-3 items-start">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-500 flex-shrink-0 flex items-center justify-center text-white font-black">
              {c.author_id ? "U" : "?"}
            </div>
            <div className="flex flex-col">
              <span className="text-white/40 text-[10px] font-bold uppercase">
                User
              </span>
              <p className="text-white/90 text-sm leading-relaxed">
                {c.content}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 flex gap-2 bg-black/20 pb-safe">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 bg-white/10 rounded-full px-5 py-3 text-white outline-none border border-white/5 focus:border-cyan-500/50"
          placeholder="Add a comment..."
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button
          onClick={handleSend}
          disabled={sending || !text.trim()}
          className="bg-cyan-500 w-12 h-12 rounded-full flex items-center justify-center disabled:opacity-50"
        >
          {sending ? (
            <Loader2 className="animate-spin text-white" size={18} />
          ) : (
            <Send size={18} className="text-white" />
          )}
        </button>
      </div>
    </motion.div>
  );
};

// -- FlickCard --
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
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {
          setIsMuted(true);
          videoRef.current?.play();
        });
      } else if (videoRef.current) {
        videoRef.current.pause();
      }
    }, [isActive]);

    const handleLike = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!currentUserId) return toast.error("Please login to like");

      sounds?.playPop?.();
      const isLiking = !likedByMe;
      setLikedByMe(isLiking);
      setLiveLikes((prev) => (isLiking ? prev + 1 : prev - 1));

      const tableName = post._source === "flicks" ? "flicks" : "posts";

      try {
        if (isLiking) {
          await supabase.from("likes").upsert({
            post_id: post._raw_id,
            user_id: currentUserId,
            reaction_type: "like",
          });
          await supabase
            .from(tableName)
            .update({ likes_count: (post.likes_count || 0) + 1 })
            .eq("id", post._raw_id);
        } else {
          await supabase
            .from("likes")
            .delete()
            .eq("post_id", post._raw_id)
            .eq("user_id", currentUserId);
          await supabase
            .from(tableName)
            .update({ likes_count: Math.max((post.likes_count || 1) - 1, 0) })
            .eq("id", post._raw_id);
        }
      } catch (err) {
        console.error("Like error", err);
      }
    };

    const handleShare = async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        if (navigator.share) {
          await navigator.share({
            title: "Check out this Flick!",
            text: post.content,
            url: window.location.href,
          });
        } else {
          navigator.clipboard.writeText(window.location.href);
          toast.success("Link copied!");
        }
      } catch (err) {
        console.log("Share failed", err);
      }
    };

    if (!post) return null;

    return (
      <div className="relative w-full h-[100dvh] bg-black snap-start flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          src={post.media_url}
          className="w-full h-full object-cover"
          loop
          muted={isMuted}
          playsInline
        />

        <div
          className="absolute inset-0 z-10"
          onClick={() => setIsMuted(!isMuted)}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/70 pointer-events-none z-20" />

        {/* Right Side Actions */}
        <div className="absolute right-4 bottom-28 flex flex-col items-center gap-7 z-40">
          <div className="relative mb-2">
            <div
              className="w-12 h-12 rounded-full border-2 border-white overflow-hidden shadow-lg cursor-pointer"
              onClick={() => openProfile?.(post.author_id)}
            >
              <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-white font-bold text-xl uppercase">
                {post.author?.[0] || "V"}
              </div>
            </div>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-cyan-500 rounded-full p-0.5 border-2 border-black">
              <Plus size={14} className="text-white" />
            </div>
          </div>

          <button
            onClick={handleLike}
            className="flex flex-col items-center text-white drop-shadow-md"
          >
            <Heart
              size={36}
              fill={likedByMe ? "#ff2d55" : "none"}
              className={
                likedByMe
                  ? "text-[#ff2d55] scale-110 transition-transform"
                  : "text-white"
              }
            />
            <span className="text-[11px] font-black mt-1">
              {formatCount(liveLikes)}
            </span>
          </button>

          <button
            onClick={() => setShowComments(true)}
            className="flex flex-col items-center text-white drop-shadow-md"
          >
            <MessageCircle size={36} className="text-white" />
            <span className="text-[11px] font-black mt-1">
              {formatCount(post.comments_count || 0)}
            </span>
          </button>

          <button
            onClick={handleShare}
            className="flex flex-col items-center text-white drop-shadow-md"
          >
            <Share2 size={34} className="text-white" />
            <span className="text-[11px] font-black mt-1">Share</span>
          </button>

          <div className="mt-2">
            <MagnetButton
              postId={post.id}
              postType="flick"
              postOwnerId={post.author_id}
              currentUserId={currentUserId}
              onBridgeChat={onBridgeChat}
              dark
            />
          </div>
        </div>

        {/* Bottom Content */}
        <div className="absolute bottom-12 left-4 right-20 text-white z-40 pointer-events-none">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-black text-lg drop-shadow-lg">
              @{post.author || "vibe_user"}
            </h3>
            <BadgeCheck size={18} className="text-cyan-400" />
          </div>
          <p className="text-sm opacity-90 line-clamp-2 leading-snug drop-shadow-md">
            {post.content}
          </p>
        </div>

        <AnimatePresence>
          {showComments && (
            <>
              <div
                className="fixed inset-0 z-[200] bg-black/40"
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
        const { data } = await supabase
          .from("posts")
          .select("*")
          .eq("type", "video")
          .order("created_at", { ascending: false })
          .limit(30);

        const normalized = (data || []).map((p) => ({
          id: `post_${p.id}`,
          _raw_id: p.id,
          _source: "posts",
          author_id: p.author_id || p.user_id,
          author: p.username || "User",
          content: p.caption || p.content || "",
          media_url: p.video_url || p.media_url,
          likes_count: p.likes_count || 0,
          views_count: p.views_count || 0,
          comments_count: 0, // Fetch real count if needed via subquery
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
          className="fixed top-12 left-4 z-[110] p-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-white shadow-xl"
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
          <div className="h-full flex items-center justify-center text-white/20 font-bold">
            KHUDA HAFIZ! NO VIDEOS.
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
