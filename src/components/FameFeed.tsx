import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  Send,
  Heart,
  MessageCircle,
  Share2,
  MoreHorizontal,
  Bookmark,
  Loader2,
  WifiOff,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// --- 1. AutoPlay Video Component (Updated for Sound) ---
const AutoPlayVideo = ({ src }: { src: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (videoRef.current) {
          if (entry.isIntersecting) {
            // Sound ke saath play karne ki koshish
            const playPromise = videoRef.current.play();

            if (playPromise !== undefined) {
              playPromise.catch(() => {
                // Agar browser block kare toh muted mode mein play ho jaye (Auto-fallback)
                if (videoRef.current) {
                  videoRef.current.muted = true;
                  videoRef.current.play();
                }
              });
            }
          } else {
            videoRef.current.pause();
          }
        }
      },
      { threshold: 0.6 },
    );

    if (videoRef.current) observer.observe(videoRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <video
      ref={videoRef}
      src={src}
      loop
      muted={false} // Default sound ON rakha hai
      playsInline
      className="w-full h-auto max-h-[500px] object-contain block bg-black cursor-pointer"
      onClick={(e) => {
        // User click karke sound toggle kar sake
        const v = e.currentTarget;
        v.muted = !v.muted;
      }}
    />
  );
};

const FameFeed = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeComment, setActiveComment] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  const fetchPosts = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const { data: joinData, error: joinError } = await supabase
        .from("posts")
        .select(`*, comments:comments(*)`)
        .order("created_at", { ascending: false });

      if (joinError) throw joinError;
      setPosts(joinData ?? []);
    } catch (err: any) {
      setFetchError(err?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
    const channel = supabase
      .channel("fame-feed-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        () => fetchPosts(),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "comments" },
        () => fetchPosts(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleLike = async (id: string, currentLikes: number) => {
    const { error } = await supabase
      .from("posts")
      .update({ likes_count: (currentLikes || 0) + 1 })
      .eq("id", id);
    if (error) console.error("Like error:", error);
  };

  const handleAddComment = async (postId: string) => {
    if (!commentText.trim()) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const authorName =
      user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";

    try {
      const { error } = await supabase
        .from("comments")
        .insert([
          { post_id: postId, content: commentText, author: authorName },
        ]);
      if (error) throw error;
      setCommentText("");
      fetchPosts();
    } catch (err: any) {
      console.error("Comment error:", err.message);
    }
  };

  const handleShare = async (post: any) => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "FameFeed",
          text: post.content,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert("Link copied! 🚀");
      }
    } catch (err) {
      console.log("Share failed");
    }
  };

  if (loading)
    return (
      <div className="w-full flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 size={32} className="animate-spin text-blue-500" />
        <p className="text-xs font-black text-white/30 uppercase tracking-widest">
          Loading Vibe...
        </p>
      </div>
    );

  if (fetchError)
    return (
      <div className="w-full flex flex-col items-center justify-center py-24 gap-4 px-6 text-center">
        <WifiOff size={36} className="text-red-400/60" />
        <p className="text-sm font-black text-white/40">Offline Mode?</p>
        <button
          onClick={fetchPosts}
          className="px-6 py-2 bg-blue-600 rounded-2xl text-xs font-black text-white"
        >
          Retry
        </button>
      </div>
    );

  return (
    <div className="w-full bg-transparent">
      {posts.map((post, index) => (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          key={post.id}
          className={`w-full bg-white/5 backdrop-blur-xl border-b border-white/10 ${index === 0 ? "border-t border-white/10" : ""}`}
        >
          {/* Header */}
          <div className="px-4 pt-4 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-black shadow-lg uppercase">
                {post.author ? post.author[0] : "V"}
              </div>
              <div>
                <h4 className="text-sm font-black text-white">
                  {post.author || "Vibe User"}
                </h4>
                <p className="text-[9px] text-blue-400 font-black uppercase tracking-widest">
                  Verified Vibe
                </p>
              </div>
            </div>
            <MoreHorizontal size={18} className="text-white/30" />
          </div>

          {/* Content */}
          {post.content && (
            <div className="px-4 pb-3">
              <p className="text-white/80 text-sm font-medium leading-relaxed">
                {post.content}
              </p>
            </div>
          )}

          {/* Media Section with Autoplay */}
          {post.media_url && (
            <div className="w-full bg-black overflow-hidden border-y border-white/5">
              {post.media_url
                .toLowerCase()
                .match(/\.(mp4|webm|ogg|mov|m4v)/) ? (
                <AutoPlayVideo src={post.media_url} />
              ) : (
                <img
                  src={post.media_url}
                  className="w-full h-auto object-cover block"
                  alt="Post content"
                  loading="lazy"
                />
              )}
            </div>
          )}

          {/* Actions */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <button
                  onClick={() => handleLike(post.id, post.likes_count)}
                  className="flex items-center gap-2 group"
                >
                  <Heart
                    size={20}
                    className={`${post.likes_count > 0 ? "fill-red-500 text-red-500" : "text-white/40"} transition-transform group-active:scale-125`}
                  />
                  <span className="text-xs font-black text-white/60">
                    {post.likes_count || 0}
                  </span>
                </button>
                <button
                  onClick={() =>
                    setActiveComment(activeComment === post.id ? null : post.id)
                  }
                  className="flex items-center gap-2"
                >
                  <MessageCircle
                    size={20}
                    className={
                      activeComment === post.id
                        ? "text-blue-400"
                        : "text-white/40"
                    }
                  />
                  <span className="text-xs font-black text-white/60">
                    {post.comments?.length || 0}
                  </span>
                </button>
                <button
                  onClick={() => handleShare(post)}
                  className="text-white/40 active:text-blue-400"
                >
                  <Share2 size={20} />
                </button>
              </div>
              <Bookmark size={20} className="text-white/20" />
            </div>

            {/* Comment Section */}
            <AnimatePresence>
              {activeComment === post.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="pt-4 overflow-hidden"
                >
                  <div className="flex gap-2 mb-4">
                    <input
                      type="text"
                      placeholder="Write a comment..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-2xl text-xs px-4 py-3 text-white outline-none focus:border-blue-500/50"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleAddComment(post.id)
                      }
                    />
                    <button
                      onClick={() => handleAddComment(post.id)}
                      className="bg-blue-600 text-white p-3 rounded-2xl shadow-lg shadow-blue-500/20 active:scale-90 transition-transform"
                    >
                      <Send size={14} />
                    </button>
                  </div>
                  {/* Comments List */}
                  <div className="space-y-3 max-h-52 overflow-y-auto pr-2 custom-scrollbar">
                    {post.comments?.map((c: any) => (
                      <div
                        key={c.id}
                        className="flex gap-3 items-start animate-in slide-in-from-left-2"
                      >
                        <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-[10px] font-black text-blue-400 border border-white/10 uppercase shrink-0">
                          {c.author ? c.author[0] : "U"}
                        </div>
                        <div className="bg-white/5 px-3 py-2 rounded-2xl flex-1 border border-white/5">
                          <p className="text-[10px] font-black text-blue-400 mb-0.5">
                            {c.author || "User"}
                          </p>
                          <p className="text-xs text-white/70 font-medium leading-relaxed">
                            {c.content}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default FameFeed;
