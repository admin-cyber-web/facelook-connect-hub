import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  Send,
  Heart,
  MessageCircle,
  Share2,
  MoreHorizontal,
  Bookmark,
  Loader2,
  Newspaper,
  WifiOff,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const FameFeed = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeComment, setActiveComment] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  const fetchPosts = async () => {
    console.log("[FameFeed] fetchPosts() called");
    setLoading(true);
    setFetchError(null);
    try {
      // Primary query: posts + comments join
      const { data: joinData, error: joinError } = await supabase
        .from("posts")
        .select(`*, comments:comments(*)`)
        .order("created_at", { ascending: false });

      if (joinError) {
        console.warn("[FameFeed] Join query failed, retrying without join...");
        // Fallback: posts only
        const { data: postsOnly, error: fallbackError } = await supabase
          .from("posts")
          .select("*")
          .order("created_at", { ascending: false });

        if (fallbackError) {
          console.error("[FameFeed] Fallback failed:", fallbackError.message);
          setFetchError(`DB error: ${fallbackError.message}`);
        } else {
          console.log(
            "[FameFeed] Fallback Success — posts:",
            postsOnly?.length ?? 0,
          );
          setPosts(postsOnly ?? []);
        }
      } else {
        console.log("[FameFeed] Success — posts:", joinData?.length ?? 0);
        setPosts(joinData ?? []);
      }
    } catch (err: any) {
      console.error("[FameFeed] Unexpected error:", err);
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
    try {
      const { error } = await supabase
        .from("comments")
        .insert([{ post_id: postId, content: commentText, author: "You" }]);
      if (error) throw error;
      setCommentText("");
      fetchPosts();
    } catch (err: any) {
      console.error("Comment error:", err.message);
    }
  };

  const handleShare = async (post: any) => {
    const shareData = {
      title: "Facelook Connect",
      text: post.content || "Check out this vibe!",
      url: window.location.href,
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(window.location.href);
        alert("Link copied! 🚀");
      }
    } catch (err) {
      console.log("Cancelled");
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading)
    return (
      <div className="w-full flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 size={32} className="animate-spin text-blue-500" />
        <p className="text-xs font-black text-white/30 uppercase tracking-widest">
          Loading Feed…
        </p>
      </div>
    );

  // ── Error state ─────────────────────────────────────────────────────────────
  if (fetchError)
    return (
      <div className="w-full flex flex-col items-center justify-center py-24 gap-4 px-6">
        <WifiOff size={36} className="text-red-400/60" />
        <p className="text-sm font-black text-white/40 text-center">
          Could not load posts
        </p>
        <p className="text-[11px] text-red-400/60 font-mono text-center break-all">
          {fetchError}
        </p>
        <button
          onClick={fetchPosts}
          className="mt-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-2xl text-xs font-black text-white active:scale-95 transition-all"
        >
          Retry
        </button>
      </div>
    );

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (posts.length === 0)
    return (
      <div className="w-full flex flex-col items-center justify-center py-24 gap-3 text-white/20">
        <Newspaper size={40} />
        <p className="text-sm font-black">No posts yet</p>
        <p className="text-xs text-white/15">
          Be the first to share something!
        </p>
      </div>
    );

  return (
    <div className="w-full bg-transparent font-sans">
      {posts.map((post, index) => (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          key={post.id}
          className={`w-full bg-white/5 backdrop-blur-xl border-b border-white/10 ${
            index === 0 ? "border-t border-white/10" : ""
          }`}
        >
          {/* Post Header */}
          <div className="px-4 pt-4 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white font-black shadow-inner text-sm">
                {post.author ? post.author[0] : "U"}
              </div>
              <div>
                <h4 className="text-sm font-black text-white">{post.author}</h4>
                <p className="text-[9px] text-blue-400 font-black uppercase tracking-[0.2em]">
                  Verified Vibe
                </p>
              </div>
            </div>
            <button className="text-white/30 hover:text-white transition-colors p-1">
              <MoreHorizontal size={18} />
            </button>
          </div>

          {/* Post Body */}
          {post.content && (
            <div className="px-4 pb-3">
              <p className="text-white/80 text-sm leading-relaxed font-medium">
                {post.content}
              </p>
            </div>
          )}

          {/* Updated to use media_url as per your Supabase Table */}
          {post.media_url && (
            <div className="pb-3">
              <img
                src={post.media_url}
                className="w-full h-auto object-cover"
                alt="Post content"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            </div>
          )}

          {/* Post Actions */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <button
                  onClick={() => handleLike(post.id, post.likes_count)}
                  className="flex items-center gap-2 group"
                >
                  <Heart
                    size={20}
                    className={`transition-all ${
                      post.likes_count > 0
                        ? "fill-red-500 text-red-500"
                        : "text-white/40 group-hover:text-red-400"
                    }`}
                  />
                  <span className="text-xs font-black text-white/60">
                    {post.likes_count || 0}
                  </span>
                </button>
                <button
                  onClick={() =>
                    setActiveComment(activeComment === post.id ? null : post.id)
                  }
                  className="flex items-center gap-2 group text-white/40 hover:text-blue-400 transition-colors"
                >
                  <MessageCircle
                    size={20}
                    className={activeComment === post.id ? "text-blue-400" : ""}
                  />
                  <span className="text-xs font-black text-white/60">
                    {post.comments?.length || 0}
                  </span>
                </button>
                <button
                  onClick={() => handleShare(post)}
                  className="text-white/40 hover:text-green-400 transition-colors"
                >
                  <Share2 size={20} />
                </button>
              </div>
              <Bookmark
                size={20}
                className="text-white/20 hover:text-yellow-400 transition-colors cursor-pointer"
              />
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
                      placeholder="Add a comment..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-2xl text-xs px-4 py-3 text-white placeholder:text-white/20 focus:ring-1 focus:ring-blue-500/50 outline-none"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleAddComment(post.id)
                      }
                    />
                    <button
                      onClick={() => handleAddComment(post.id)}
                      className="bg-blue-600 text-white p-3 rounded-2xl hover:bg-blue-500 transition-all"
                    >
                      <Send size={14} />
                    </button>
                  </div>

                  <div className="space-y-3 max-h-52 overflow-y-auto">
                    {post.comments?.map((c: any) => (
                      <div key={c.id} className="flex gap-3 items-start">
                        <div className="w-7 h-7 rounded-xl bg-white/10 flex items-center justify-center text-[10px] font-black text-blue-400 border border-white/10 uppercase shrink-0">
                          {c.author ? c.author[0] : "U"}
                        </div>
                        <div className="bg-white/5 px-3 py-2 rounded-2xl flex-1 border border-white/5">
                          <p className="text-[10px] font-black text-blue-400 mb-0.5">
                            {c.author}
                          </p>
                          <p className="text-xs text-white/70 font-medium">
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
