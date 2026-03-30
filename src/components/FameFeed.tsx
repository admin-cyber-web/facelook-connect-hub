import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  Image as ImageIcon,
  Send,
  X,
  Loader2,
  Heart,
  MessageCircle,
  Share2,
  MoreHorizontal,
  Bookmark,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const FameFeed = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeComment, setActiveComment] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🔄 1. Fetch Posts Logic
  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from("posts")
        .select(`*, comments:comments(*)`)
        .order("created_at", { ascending: false });

      if (error) {
        const { data: postsOnly } = await supabase
          .from("posts")
          .select("*")
          .order("created_at", { ascending: false });
        if (postsOnly) setPosts(postsOnly);
      } else if (data) {
        setPosts(data);
      }
    } catch (err) {
      console.error("Fetch error:", err);
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

  // 🚀 2. Handle Post Publish
  const handlePost = async () => {
    if (!text && !file) return;
    setLoading(true);
    try {
      let imageUrl = "";
      if (file) {
        const fileName = `${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage
          .from("posts")
          .upload(fileName, file);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage
          .from("posts")
          .getPublicUrl(fileName);
        imageUrl = urlData.publicUrl;
      }

      const { error: insErr } = await supabase
        .from("posts")
        .insert([
          { content: text, image_url: imageUrl, author: "You", likes_count: 0 },
        ]);

      if (insErr) throw insErr;
      setText("");
      setFile(null);
      setPreview(null);
    } catch (err: any) {
      alert("Post failed: " + err.message);
    }
    setLoading(false);
  };

  // ❤️ 3. Handle Like
  const handleLike = async (id: string, currentLikes: number) => {
    const { error } = await supabase
      .from("posts")
      .update({ likes_count: (currentLikes || 0) + 1 })
      .eq("id", id);
    if (error) console.error("Like error:", error);
  };

  // 💬 4. Handle Comment
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

  // 📤 5. Share Function
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

  return (
    <div className="max-w-xl mx-auto p-4 pb-24 bg-transparent min-h-screen font-sans">
      {/* --- GLASS COMPOSER (POST BOX) --- */}
      <div className="bg-white/10 backdrop-blur-2xl rounded-[2.5rem] p-6 shadow-2xl border border-white/20 mb-8 mt-20">
        <div className="flex gap-4 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shrink-0 shadow-lg flex items-center justify-center text-white font-black">
            Y
          </div>
          <textarea
            placeholder="What's the vibe today?"
            className="w-full bg-white/5 border-none focus:ring-0 text-white placeholder:text-white/40 text-base h-16 resize-none p-2 rounded-xl"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        {preview && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative mb-4 rounded-3xl overflow-hidden border border-white/20"
          >
            <img
              src={preview}
              className="w-full h-64 object-cover"
              alt="Preview"
            />
            <button
              onClick={() => {
                setFile(null);
                setPreview(null);
              }}
              className="absolute top-3 right-3 bg-black/60 p-2 rounded-full text-white backdrop-blur-md hover:bg-red-500 transition-colors"
            >
              <X size={18} />
            </button>
          </motion.div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          <input
            type="file"
            hidden
            ref={fileInputRef}
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setFile(f);
                setPreview(URL.createObjectURL(f));
              }
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 text-white/60 font-bold text-sm hover:text-blue-400 transition-all"
          >
            <div className="p-2 bg-white/5 rounded-xl">
              <ImageIcon size={20} />
            </div>
            Media
          </button>
          <button
            onClick={handlePost}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-2xl font-black text-xs tracking-widest shadow-xl shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <Send size={18} />
            )}
            POST VIBE
          </button>
        </div>
      </div>

      {/* --- FEED SECTION --- */}
      <div className="space-y-6">
        {posts.map((post) => (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            key={post.id}
            className="bg-white/10 backdrop-blur-xl rounded-[3rem] overflow-hidden shadow-xl border border-white/10"
          >
            {/* Post Header */}
            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white font-black shadow-inner">
                  {post.author ? post.author[0] : "U"}
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">
                    {post.author}
                  </h4>
                  <p className="text-[9px] text-blue-400 font-black uppercase tracking-[0.2em]">
                    Verified Vibe
                  </p>
                </div>
              </div>
              <button className="text-white/30 hover:text-white transition-colors">
                <MoreHorizontal />
              </button>
            </div>

            {/* Post Body */}
            <div className="px-8 pb-4">
              <p className="text-white/80 text-sm leading-relaxed font-medium">
                {post.content}
              </p>
            </div>

            {post.image_url && (
              <div className="px-4 pb-4">
                <img
                  src={post.image_url}
                  className="w-full h-auto rounded-[2.5rem] object-cover border border-white/10 shadow-2xl"
                  alt="Post content"
                />
              </div>
            )}

            {/* Post Actions */}
            <div className="px-8 py-6 bg-white/5 border-t border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-8">
                  <button
                    onClick={() => handleLike(post.id, post.likes_count)}
                    className="flex items-center gap-2 group"
                  >
                    <Heart
                      size={22}
                      className={`transition-all ${post.likes_count > 0 ? "fill-red-500 text-red-500 scale-125 shadow-red-500" : "text-white/40 group-hover:text-red-400"}`}
                    />
                    <span className="text-xs font-black text-white/60">
                      {post.likes_count || 0}
                    </span>
                  </button>
                  <button
                    onClick={() =>
                      setActiveComment(
                        activeComment === post.id ? null : post.id,
                      )
                    }
                    className="flex items-center gap-2 group text-white/40 hover:text-blue-400 transition-colors"
                  >
                    <MessageCircle
                      size={22}
                      className={
                        activeComment === post.id ? "text-blue-400" : ""
                      }
                    />
                    <span className="text-xs font-black text-white/60">
                      {post.comments?.length || 0}
                    </span>
                  </button>
                  <button
                    onClick={() => handleShare(post)}
                    className="text-white/40 hover:text-green-400 transition-colors"
                  >
                    <Share2 size={22} />
                  </button>
                </div>
                <Bookmark
                  size={22}
                  className="text-white/20 hover:text-yellow-400 transition-colors"
                />
              </div>

              {/* Comment Section (Glass Style) */}
              <AnimatePresence>
                {activeComment === post.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="pt-6 overflow-hidden"
                  >
                    <div className="flex gap-2 mb-6">
                      <input
                        type="text"
                        placeholder="Add a comment..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-2xl text-xs px-5 py-3 text-white placeholder:text-white/20 focus:ring-1 focus:ring-blue-500/50 outline-none"
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
                        <Send size={16} />
                      </button>
                    </div>

                    <div className="space-y-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                      {post.comments?.map((c: any) => (
                        <div
                          key={c.id}
                          className="flex gap-3 items-start animate-in slide-in-from-left-2 duration-300"
                        >
                          <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-[10px] font-black text-blue-400 border border-white/10 uppercase">
                            {c.author ? c.author[0] : "U"}
                          </div>
                          <div className="bg-white/5 p-3 rounded-2xl flex-1 border border-white/5">
                            <p className="text-[10px] font-black text-blue-400 mb-1">
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
    </div>
  );
};

export default FameFeed;
