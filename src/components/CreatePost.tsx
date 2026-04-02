import { useState } from "react";
import {
  Image as ImageIcon,
  X,
  Send,
  Loader2,
  Smile,
  Globe,
} from "lucide-react";
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

  // Replace with your actual admin email
  const ADMIN_EMAIL = "your-email@gmail.com";

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
      // 1. Direct fetch current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // 2. Identify Name
      const authorName =
        user?.user_metadata?.full_name ||
        user?.user_metadata?.name ||
        userProfile?.full_name ||
        user?.email?.split("@")[0] ||
        "Vibe User";

      let finalMediaUrl = "";
      let mediaType = "text";

      // 3. File Upload Logic
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
        }
      }

      // 4. Database Insert (Matching your new Schema)
      const { error: insertError } = await supabase.from("posts").insert([
        {
          author_id: user?.id || userProfile?.id,
          content: content,
          media_url: finalMediaUrl,
          author: authorName,
          type: mediaType, // Correct column name
          is_admin_post: user?.email === ADMIN_EMAIL, // Marks if it's you
        },
      ]);

      if (insertError) throw insertError;

      // Success Reset
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
            {/* Header */}
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-800">New Vibe</h3>
              <button
                onClick={onClose}
                className="p-2 bg-slate-100 rounded-full text-slate-400 hover:bg-slate-200"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* User Info Preview */}
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
                  <span className="flex items-center gap-1 text-[8px] font-bold uppercase bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md w-fit">
                    <Globe size={10} /> Public
                  </span>
                </div>
              </div>

              {/* Text Area */}
              <textarea
                placeholder="Share your vibe... 🔥"
                className="w-full min-h-[120px] text-lg font-medium text-slate-700 outline-none resize-none placeholder:text-slate-300"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />

              {/* Media Preview */}
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
                    className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full backdrop-blur-md z-10"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <div className="flex gap-2">
                  <label className="p-3 bg-blue-50 text-blue-600 rounded-2xl cursor-pointer hover:bg-blue-100 transition-all">
                    <ImageIcon size={20} />
                    <input
                      type="file"
                      hidden
                      accept="image/*,video/*"
                      onChange={handleFileChange}
                    />
                  </label>
                </div>

                <button
                  onClick={handlePost}
                  disabled={loading || (!content && !file)}
                  className="flex items-center gap-2 px-8 py-4 rounded-2xl font-black text-xs uppercase bg-blue-600 text-white disabled:bg-slate-100 disabled:text-slate-400 shadow-lg active:scale-95 transition-all"
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
