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
  Sun,
  Moon,
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

  // 🌓 Theme Logic (LocalStorage se uthayega)
  const [isLightMode, setIsLightMode] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved === "light";
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem("theme", isLightMode ? "light" : "dark");
  }, [isLightMode]);

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
    <div
      className={`min-h-screen transition-colors duration-500 pb-20 ${isLightMode ? "bg-[#F3F4F6]" : "bg-[#0a0a0a]"}`}
    >
      <div className="max-w-xl mx-auto font-sans">
        {/* --- HEADER --- */}
        <div className="flex justify-between items-center p-6 sticky top-0 z-50 backdrop-blur-md">
          <h1
            className={`text-2xl font-black italic tracking-tighter ${isLightMode ? "text-gray-900" : "text-white"}`}
          >
            FACELOOK
          </h1>
          <button
            onClick={() => setIsLightMode(!isLightMode)}
            className={`p-2.5 rounded-2xl transition-all ${isLightMode ? "bg-white shadow-lg text-gray-600" : "bg-white/10 text-yellow-400"}`}
          >
            {isLightMode ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        </div>

        {/* --- COMPOSER (Input Box) --- */}
        <div className="px-4 mb-6">
          <div
            className={`${isLightMode ? "bg-white border-gray-200" : "bg-white/10 border-white/20"} rounded-[2rem] p-5 shadow-xl border`}
          >
            <div className="flex gap-4 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shrink-0 flex items-center justify-center text-white font-black">
                Y
              </div>
              <textarea
                placeholder="What's happening?"
                className={`w-full bg-transparent border-none focus:ring-0 text-sm h-12 resize-none p-1 ${isLightMode ? "text-gray-800 placeholder:text-gray-400" : "text-white placeholder:text-white/40"}`}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>

            {preview && (
              <div className="relative mb-4 rounded-2xl overflow-hidden border border-white/10">
                <img
                  src={preview}
                  className="w-full h-48 object-cover"
                  alt="Preview"
                />
                <button
                  onClick={() => {
                    setFile(null);
                    setPreview(null);
                  }}
                  className="absolute top-2 right-2 bg-black/60 p-1.5 rounded-full text-white"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <div
              className={`flex items-center justify-between pt-3 border-t ${isLightMode ? "border-gray-100" : "border-white/10"}`}
            >
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
                className={`flex items-center gap-2 font-bold text-xs ${isLightMode ? "text-gray-500" : "text-white/60"}`}
              >
                <ImageIcon size={18} />
                Media
              </button>
              <button
                onClick={handlePost}
                disabled={loading}
                className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold text-xs transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Send size={16} />
                )}
                Post
              </button>
            </div>
          </div>
        </div>

        {/* --- FEED SECTION (WALL-TO-WALL) --- */}
        <div className="space-y-3">
          {posts.map((post) => (
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              key={post.id}
              className={`${isLightMode ? "bg-white border-y border-gray-200" : "bg-white/5 border-y border-white/10"} w-full shadow-sm`}
            >
              {/* Header */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xs ${isLightMode ? "bg-gray-100 text-gray-700" : "bg-white/10 text-white"}`}
                  >
                    {post.author ? post.author[0] : "U"}
                  </div>
                  <div>
                    <h4
                      className={`text-sm font-black ${isLightMode ? "text-gray-800" : "text-white"}`}
                    >
                      {post.author}
                    </h4>
                    <p className="text-[10px] text-blue-500 font-bold uppercase tracking-wider">
                      Vibe Verified
                    </p>
                  </div>
                </div>
                <MoreHorizontal
                  className={isLightMode ? "text-gray-400" : "text-white/30"}
                  size={18}
                />
              </div>

              {/* Text Body */}
              <div className="px-4 pb-3">
                <p
                  className={`text-sm leading-relaxed ${isLightMode ? "text-gray-600" : "text-white/80"}`}
                >
                  {post.content}
                </p>
              </div>

              {/* Image (Wall-to-Wall) */}
              {post.image_url && (
                <div className="w-full bg-black/10">
                  <img
                    src={post.image_url}
                    className="w-full h-auto max-h-[500px] object-cover"
                    alt="Post"
                  />
                </div>
              )}

              {/* Action Bar */}
              <div className="px-4 py-4 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <button
                    onClick={() => handleLike(post.id, post.likes_count)}
                    className="flex items-center gap-1.5 group"
                  >
                    <Heart
                      size={20}
                      className={`${post.likes_count > 0 ? "fill-red-500 text-red-500" : isLightMode ? "text-gray-400" : "text-white/40"}`}
                    />
                    <span
                      className={`text-xs font-bold ${isLightMode ? "text-gray-500" : "text-white/60"}`}
                    >
                      {post.likes_count || 0}
                    </span>
                  </button>
                  <button
                    onClick={() =>
                      setActiveComment(
                        activeComment === post.id ? null : post.id,
                      )
                    }
                    className={`flex items-center gap-1.5 ${isLightMode ? "text-gray-400" : "text-white/40"}`}
                  >
                    <MessageCircle size={20} />
                    <span className="text-xs font-bold">
                      {post.comments?.length || 0}
                    </span>
                  </button>
                  <button
                    onClick={() => handleShare(post)}
                    className={isLightMode ? "text-gray-400" : "text-white/40"}
                  >
                    <Share2 size={20} />
                  </button>
                </div>
                <Bookmark
                  size={20}
                  className={isLightMode ? "text-gray-400" : "text-white/20"}
                />
              </div>

              {/* Comments Display */}
              <AnimatePresence>
                {activeComment === post.id && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    className="px-4 pb-4 overflow-hidden"
                  >
                    <div className="flex gap-2 mb-4 border-t pt-4 border-white/5">
                      <input
                        type="text"
                        placeholder="Write a comment..."
                        className={`flex-1 text-xs px-4 py-2.5 rounded-full outline-none border ${isLightMode ? "bg-gray-50 border-gray-200 text-gray-800" : "bg-white/5 border-white/10 text-white"}`}
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleAddComment(post.id)
                        }
                      />
                    </div>
                    {/* Simplified Comments List */}
                    <div className="space-y-3">
                      {post.comments?.slice(0, 3).map((c: any) => (
                        <div key={c.id} className="flex gap-2 items-start">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold ${isLightMode ? "bg-gray-100 text-gray-600" : "bg-white/10 text-blue-400"}`}
                          >
                            {c.author[0]}
                          </div>
                          <div
                            className={`p-2 rounded-xl flex-1 text-xs ${isLightMode ? "bg-gray-50" : "bg-white/5"}`}
                          >
                            <span className="font-bold mr-2 text-blue-500">
                              {c.author}
                            </span>
                            <span
                              className={
                                isLightMode ? "text-gray-600" : "text-white/70"
                              }
                            >
                              {c.content}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FameFeed;
