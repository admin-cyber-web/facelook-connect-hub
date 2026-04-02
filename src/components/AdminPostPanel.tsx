import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  Send,
  Link,
  Image as ImageIcon,
  Video,
  X,
  CheckCircle,
} from "lucide-react";

export default function AdminPostPanel({ onClose }: { onClose: () => void }) {
  const [postType, setPostType] = useState<"text" | "image" | "video">("text");
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from("posts").insert([
        {
          content: content,
          media_url: mediaUrl,
          type: postType,
          author: "Admin", // Aapka display name
          is_admin_post: true,
          created_at: new Date().toISOString(),
          likes_count: 0,
        },
      ]);

      if (error) throw error;

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-300">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-black text-white tracking-tight">
          Create Admin Post
        </h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/5 rounded-full text-zinc-500"
        >
          <X size={20} />
        </button>
      </div>

      {/* Selector */}
      <div className="flex gap-2 mb-6 bg-black/40 p-1 rounded-xl">
        {(["text", "image", "video"] as const).map((type) => (
          <button
            key={type}
            onClick={() => setPostType(type)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold capitalize transition-all ${
              postType === type
                ? "bg-white text-black"
                : "text-zinc-500 hover:text-white"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      <form onSubmit={handlePublish} className="space-y-4">
        {/* Media URL Input (For Image/Video) */}
        {postType !== "text" && (
          <div className="relative">
            <Link
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
              size={16}
            />
            <input
              type="url"
              placeholder={`Paste ${postType} link (.mp4, .jpg, etc.)`}
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:border-blue-500 outline-none"
              required
            />
          </div>
        )}

        {/* Caption/Content */}
        <textarea
          placeholder="What's on your mind, Admin?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full bg-black/50 border border-white/10 rounded-xl py-3 px-4 text-sm text-white min-h-[120px] focus:border-blue-500 outline-none resize-none"
        />

        <button
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          {loading ? (
            "Publishing..."
          ) : success ? (
            <CheckCircle size={20} />
          ) : (
            <>
              <Send size={18} /> Post to Dashboard
            </>
          )}
        </button>
      </form>
    </div>
  );
}
