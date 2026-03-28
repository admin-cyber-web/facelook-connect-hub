import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase"; // पक्का कर लो कि path सही है
import {
  Image as ImageIcon,
  Send,
  X,
  Loader2,
  Heart,
  MessageCircle,
  Share2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const FameFeed = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🔄 1. रियल-टाइम में पोस्ट्स लाना (Fetch & Listen)
  useEffect(() => {
    fetchPosts();

    // जब भी कोई नई पोस्ट 'posts' टेबल में आए, उसे तुरंत लिस्ट में जोड़ दो
    const subscription = supabase
      .channel("public:posts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        (payload) => {
          setPosts((prev) => [payload.new, ...prev]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) console.error("Fetch Error:", error.message);
    else if (data) setPosts(data);
  };

  // 📸 2. फोटो सेलेक्ट करना
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  // 🚀 3. पोस्ट पब्लिश करना (Image + Text)
  const handlePost = async () => {
    if (!text && !file) return;
    setLoading(true);

    try {
      let imageUrl = "";

      // अगर फोटो है, तो उसे 'post' बाकेट में अपलोड करो
      if (file) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("post") // तुम्हारा बाकेट नाम
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("post")
          .getPublicUrl(fileName);
        imageUrl = urlData.publicUrl;
      }

      // डेटाबेस में सेव करो
      const { error: insertError } = await supabase
        .from("posts") // तुम्हारी टेबल का नाम
        .insert([
          {
            content: text,
            image_url: imageUrl,
            author: "Me", // यहाँ बाद में असली User का नाम आएगा
          },
        ]);

      if (insertError) throw insertError;

      // सब रिसेट कर दो
      setText("");
      setFile(null);
      setPreview(null);
    } catch (err: any) {
      alert("Error: " + err.message);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-xl mx-auto p-4 pb-24 font-sans">
      <h2 className="text-center text-xl font-black text-slate-800 mb-8 uppercase tracking-widest">
        Fame Feed
      </h2>

      {/* --- Create Post Card --- */}
      <div className="bg-white rounded-[2.5rem] p-5 shadow-xl shadow-slate-200/50 mb-10 border border-slate-100">
        <textarea
          placeholder="Share your vibe..."
          className="w-full bg-transparent border-none focus:ring-0 text-sm h-12 resize-none"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        {preview && (
          <div className="relative mt-2 rounded-2xl overflow-hidden border border-slate-100">
            <img
              src={preview}
              className="w-full h-48 object-cover"
              alt="preview"
            />
            <button
              onClick={() => {
                setFile(null);
                setPreview(null);
              }}
              className="absolute top-2 right-2 bg-black/50 p-1 rounded-full text-white"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-50">
          <input
            type="file"
            hidden
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 text-blue-600 font-bold text-xs bg-blue-50 px-4 py-2 rounded-xl active:scale-95 transition-transform"
          >
            <ImageIcon size={18} /> Gallery
          </button>
          <button
            onClick={handlePost}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold text-xs flex items-center gap-2 disabled:opacity-50 active:scale-95 transition-transform"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Send size={16} />
            )}{" "}
            POST
          </button>
        </div>
      </div>

      {/* --- Posts List --- */}
      <div className="space-y-6">
        <AnimatePresence>
          {posts.map((post) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                  {post.author?.[0]}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">
                    {post.author}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">
                    Just Now
                  </p>
                </div>
              </div>

              <p className="text-sm text-slate-600 mb-4">{post.content}</p>

              {post.image_url && (
                <div className="rounded-2xl overflow-hidden mb-4 shadow-inner border border-slate-50">
                  <img
                    src={post.image_url}
                    className="w-full h-auto max-h-[400px] object-cover"
                    alt="post"
                  />
                </div>
              )}

              <div className="flex items-center gap-6 pt-3 border-t border-slate-50">
                <button className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-red-500 transition-colors">
                  <Heart size={18} /> 0
                </button>
                <button className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-blue-500 transition-colors">
                  <MessageCircle size={18} /> 0
                </button>
                <button className="ml-auto text-slate-400 hover:text-slate-600">
                  <Share2 size={18} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default FameFeed;
