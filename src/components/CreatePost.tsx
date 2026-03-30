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
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handlePost = async () => {
    if (!content && !image) return;
    setLoading(true);

    try {
      let imageUrl = "";
      if (image) {
        const fileName = `post-${Date.now()}`;
        const { data: uploadData } = await supabase.storage
          .from("posts-bucket")
          .upload(fileName, image);
        if (uploadData) {
          imageUrl = supabase.storage
            .from("posts-bucket")
            .getPublicUrl(fileName).data.publicUrl;
        }
      }

      await supabase.from("posts").insert({
        user_id: userProfile.id,
        content,
        image_url: imageUrl,
      });

      setContent("");
      setImage(null);
      setPreview(null);
      onClose();
      alert("Post Live! 🚀");
    } catch (err) {
      alert(
        "Post failed! Make sure 'posts-bucket' exists in Supabase Storage.",
      );
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
              <h3 className="text-xl font-black text-slate-800">Create Post</h3>
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
                  src={userProfile.avatar_url}
                  className="w-12 h-12 rounded-2xl object-cover border-2 border-blue-50"
                />
                <div>
                  <p className="text-sm font-black text-slate-800">
                    {userProfile.full_name}
                  </p>
                  <span className="flex items-center gap-1 text-[8px] font-bold uppercase bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md w-fit">
                    <Globe size={10} /> Public
                  </span>
                </div>
              </div>

              <textarea
                placeholder="What's on your mind? 🔥"
                className="w-full min-h-[120px] text-lg font-medium text-slate-700 outline-none resize-none"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />

              {preview && (
                <div className="relative rounded-3xl overflow-hidden border-4 border-slate-50">
                  <img src={preview} className="w-full max-h-64 object-cover" />
                  <button
                    onClick={() => {
                      setImage(null);
                      setPreview(null);
                    }}
                    className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <div className="flex gap-2">
                  <label className="p-3 bg-blue-50 text-blue-600 rounded-2xl cursor-pointer">
                    <ImageIcon size={20} />
                    <input
                      type="file"
                      hidden
                      accept="image/*"
                      onChange={handleImageChange}
                    />
                  </label>
                  <button className="p-3 bg-yellow-50 text-yellow-600 rounded-2xl">
                    <Smile size={20} />
                  </button>
                </div>

                <button
                  onClick={handlePost}
                  disabled={loading || (!content && !image)}
                  className="flex items-center gap-2 px-8 py-4 rounded-2xl font-black text-xs uppercase bg-blue-600 text-white disabled:bg-slate-100 disabled:text-slate-400"
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
