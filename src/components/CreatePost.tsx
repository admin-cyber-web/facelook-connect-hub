import { useState } from "react";
import { Image as ImageIcon, X, Send, Loader2, Globe } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";

interface CreatePostProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: any;
}

const CreatePost = ({ isOpen, onClose, userProfile }: CreatePostProps) => {
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const ADMIN_EMAIL = "your-email@gmail.com";

  // --- 1. Smart URL Detection (YouTube & Direct Videos) ---
  const getMediaInfoFromUrl = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const url = text.match(urlRegex)?.[0];

    if (!url) return { finalUrl: "", type: "text", isYoutube: false };

    // YouTube Detection
    const ytRegExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|\/shorts\/)([^#\&\?]*).*/;
    const ytMatch = url.match(ytRegExp);
    if (ytMatch && ytMatch[2].length === 11) {
      return {
        finalUrl: `https://www.youtube.com/embed/${ytMatch[2]}`,
        type: "video",
        isYoutube: true,
      };
    }

    // Direct Video Link Detection (RapidCDN, Dropbox, etc.)
    const isDirectVideo =
      /\.(mp4|webm|ogg|mov|m4v)/i.test(url.split("?")[0]) ||
      url.includes("rapidcdn.app") ||
      url.includes("raw=1");

    if (isDirectVideo) {
      return { finalUrl: url, type: "video", isYoutube: false };
    }

    return { finalUrl: "", type: "text", isYoutube: false };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const handlePost = async () => {
    if (!content && !file) return;
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const authorName =
        user?.user_metadata?.full_name ||
        userProfile?.full_name ||
        user?.email?.split("@")[0] ||
        "Vibe User";

      let finalMediaUrl = "";
      let mediaType = "text";
      let isYoutube = false;

      // 1. Link Detection (If no file is selected)
      if (!file) {
        const detection = getMediaInfoFromUrl(content);
        finalMediaUrl = detection.finalUrl;
        mediaType = detection.type;
        isYoutube = detection.isYoutube;
      }

      // 2. File Upload Logic
      if (file) {
        mediaType = file.type.startsWith("video/") ? "video" : "image";
        const fileName = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("posts")
          .upload(fileName, file, { cacheControl: "3600", upsert: false });

        if (uploadError)
          throw new Error(`Upload failed: ${uploadError.message}`);

        if (uploadData) {
          const { data } = supabase.storage
            .from("posts")
            .getPublicUrl(fileName);
          finalMediaUrl = data.publicUrl;
          isYoutube = false;
        }
      }

      // 3. Database Insert
      const { error: insertError } = await supabase.from("posts").insert([
        {
          author_id: user?.id || userProfile?.id,
          content: content,
          media_url: finalMediaUrl,
          author: authorName,
          type: mediaType,
          is_admin_post: user?.email === ADMIN_EMAIL,
          metadata: { is_youtube: isYoutube },
        },
      ]);

      if (insertError) throw insertError;

      setContent("");
      setFile(null);
      setPreview(null);
      onClose();
    } catch (err: any) {
      console.error("Error Details:", err);
      alert(`Error: ${err.message || "Post failed."}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="bg-white w-full max-w-lg rounded-t-[3rem] sm:rounded-[3rem] overflow-hidden shadow-2xl"
          >
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-800">New Vibe</h3>
              <button
                onClick={onClose}
                className="p-2 bg-slate-100 rounded-full text-slate-400"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <img
                  src={
                    userProfile?.avatar_url ||
                    `https://ui-avatars.com/api/?name=${userProfile?.full_name || "User"}&background=random`
                  }
                  className="w-12 h-12 rounded-2xl object-cover border-2 border-blue-50"
                  alt="Avatar"
                />
                <div>
                  <p className="text-sm font-black text-slate-800">
                    {userProfile?.full_name || "You"}
                  </p>
                  <span className="flex items-center gap-1 text-[8px] font-bold uppercase bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md">
                    <Globe size={10} /> Public
                  </span>
                </div>
              </div>

              <textarea
                placeholder="Paste a link (Insta/YouTube) or write something... 🔥"
                className="w-full min-h-[120px] text-lg font-medium text-slate-700 outline-none resize-none"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />

              {preview && (
                <div className="relative rounded-3xl overflow-hidden border-4 border-slate-50 shadow-sm bg-black">
                  {file?.type.startsWith("video/") ? (
                    <video
                      src={preview}
                      className="w-full max-h-64 object-contain"
                      controls
                    />
                  ) : (
                    <img
                      src={preview}
                      className="w-full max-h-64 object-cover"
                      alt="Preview"
                    />
                  )}
                  <button
                    onClick={() => {
                      setFile(null);
                      setPreview(null);
                    }}
                    className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <label className="p-3 bg-blue-50 text-blue-600 rounded-2xl cursor-pointer">
                  <ImageIcon size={20} />
                  <input
                    type="file"
                    hidden
                    accept="image/*,video/*"
                    onChange={handleFileChange}
                  />
                </label>

                <button
                  onClick={handlePost}
                  disabled={loading || (!content && !file)}
                  className="flex items-center gap-2 px-8 py-4 rounded-2xl font-black text-xs uppercase bg-blue-600 text-white disabled:bg-slate-100 shadow-lg"
                >
                  {loading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <Send size={16} /> Post Vibe
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CreatePost;
