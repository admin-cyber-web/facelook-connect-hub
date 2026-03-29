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

  // 🔄 1. Fetch Posts Logic with Debugging
  const fetchPosts = async () => {
    try {
      // नोट: अगर comments वाली टेबल posts से linked है तो ये चलेगा
      // अगर एरर आए तो समझो DB में Foreign Key सेट नहीं है
      const { data, error } = await supabase
        .from("posts")
        .select(
          `
          *,
          comments:comments(*)
        `,
        )
        .order("created_at", { ascending: false });

      if (error) {
        // Fallback: अगर comments fetch करने में एरर आए तो सिर्फ posts लाओ
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

    // 🔄 Real-time Subscription (सुनना शुरू करें)
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

      const { error: insErr } = await supabase.from("posts").insert([
        {
          content: text,
          image_url: imageUrl,
          author: "You",
          likes_count: 0,
        },
      ]);

      if (insErr) throw insErr;

      setText("");
      setFile(null);
      setPreview(null);
      // Success! Real-time channel अपने आप fetchPosts चला देगा
    } catch (err: any) {
      alert("Post failed: " + err.message);
    }
    setLoading(false);
  };

  // ❤️ 3. Handle Like Update
  const handleLike = async (id: string, currentLikes: number) => {
    const { error } = await supabase
      .from("posts")
      .update({ likes_count: (currentLikes || 0) + 1 })
      .eq("id", id);

    if (error) console.error("Like error:", error);
  };

  // 💬 4. Handle Comment Add
  const handleAddComment = async (postId: string) => {
    if (!commentText.trim()) return;
    try {
      const { error } = await supabase
        .from("comments")
        .insert([{ post_id: postId, content: commentText, author: "You" }]);

      if (error) throw error;

      setCommentText("");
      // setActiveComment(null); // आप चाहें तो इसे खुला रख सकते हैं
      fetchPosts();
    } catch (err: any) {
      console.error("Comment error:", err.message);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4 pb-24 bg-slate-50 min-h-screen font-sans">
      {/* --- Composer --- */}
      <div className="bg-white rounded-[2.5rem] p-6 shadow-xl shadow-blue-100/50 mb-8 border border-white">
        <div className="flex gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 shrink-0" />
          <textarea
            placeholder="Share your fame moment..."
            className="w-full bg-transparent border-none focus:ring-0 text-base h-16 resize-none"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        {preview && (
          <div className="relative mb-4 rounded-3xl overflow-hidden shadow-md">
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
              className="absolute top-3 right-3 bg-black/40 p-1.5 rounded-full text-white backdrop-blur-md"
            >
              <X size={18} />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-slate-50">
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
            className="flex items-center gap-2 text-slate-500 font-bold text-sm hover:text-blue-600 transition-colors"
          >
            <ImageIcon size={22} className="text-blue-500" /> Gallery
          </button>
          <button
            onClick={handlePost}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded-2xl font-black text-sm shadow-lg shadow-blue-200 transition-all active:scale-95 flex items-center gap-2"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <Send size={18} />
            )}
            VIBE IT
          </button>
        </div>
      </div>

      {/* --- Feed --- */}
      <div className="space-y-8">
        {posts.length === 0 && !loading && (
          <p className="text-center text-slate-400 font-bold py-10">
            No posts yet. Start the vibe! 🚀
          </p>
        )}

        {posts.map((post) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            key={post.id}
            className="bg-white rounded-[3rem] overflow-hidden shadow-sm border border-slate-100"
          >
            {/* Post Header */}
            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                  {post.author ? post.author[0] : "U"}
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-800">
                    {post.author}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    Premium User
                  </p>
                </div>
              </div>
              <MoreHorizontal className="text-slate-300" />
            </div>

            {/* Post Body */}
            <div className="px-6 pb-2">
              <p className="text-slate-700 text-sm leading-relaxed">
                {post.content}
              </p>
            </div>

            {post.image_url && (
              <div className="px-4 pb-2">
                <img
                  src={post.image_url}
                  className="w-full h-auto rounded-[2rem] object-cover shadow-inner"
                  alt="Post content"
                />
              </div>
            )}

            {/* Post Actions */}
            <div className="p-6 pt-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-6">
                  <button
                    onClick={() => handleLike(post.id, post.likes_count)}
                    className="flex items-center gap-2 group"
                  >
                    <Heart
                      size={24}
                      className={`transition-all ${post.likes_count > 0 ? "fill-red-500 text-red-500 scale-110" : "text-slate-300 group-hover:text-red-400"}`}
                    />
                    <span className="text-xs font-black text-slate-500">
                      {post.likes_count || 0}
                    </span>
                  </button>
                  <button
                    onClick={() =>
                      setActiveComment(
                        activeComment === post.id ? null : post.id,
                      )
                    }
                    className="flex items-center gap-2 group text-slate-300 hover:text-blue-500 transition-colors"
                  >
                    <MessageCircle
                      size={24}
                      className={
                        activeComment === post.id ? "text-blue-500" : ""
                      }
                    />
                    <span className="text-xs font-black text-slate-500">
                      {post.comments?.length || 0}
                    </span>
                  </button>
                  <button className="text-slate-300 hover:text-green-500 transition-colors">
                    <Share2 size={24} />
                  </button>
                </div>
                <Bookmark size={24} className="text-slate-200" />
              </div>

              {/* Comment Input Section */}
              <AnimatePresence>
                {activeComment === post.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="pt-4 border-t border-slate-50 overflow-hidden"
                  >
                    <div className="flex gap-2 mb-4">
                      <input
                        type="text"
                        placeholder="Write a comment..."
                        className="flex-1 bg-slate-50 border-none rounded-xl text-xs px-4 py-2 focus:ring-1 focus:ring-blue-100"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleAddComment(post.id)
                        }
                      />
                      <button
                        onClick={() => handleAddComment(post.id)}
                        className="bg-blue-600 text-white p-2 rounded-xl active:scale-90 transition-transform"
                      >
                        <Send size={14} />
                      </button>
                    </div>

                    {/* Display Comments */}
                    <div className="max-h-40 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
                      {post.comments && post.comments.length > 0 ? (
                        post.comments.map((c: any) => (
                          <div key={c.id} className="flex gap-2 items-start">
                            <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600 shrink-0">
                              {c.author ? c.author[0] : "U"}
                            </div>
                            <div className="bg-slate-50 px-3 py-2 rounded-2xl flex-1 border border-slate-100">
                              <p className="text-[10px] font-black text-slate-800">
                                {c.author}
                              </p>
                              <p className="text-[11px] text-slate-600">
                                {c.content}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] text-center text-slate-400 font-bold uppercase py-2">
                          No comments yet
                        </p>
                      )}
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
