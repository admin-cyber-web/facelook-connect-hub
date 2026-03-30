import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Loader2,
  Lock,
  ChevronRight,
  LogOut,
  User,
  BookOpen,
  MapPin,
  Phone,
  Image as ImageIcon,
  MessageSquare,
  Send,
  X,
  Users,
  Palette,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

// --- Components ---
import Header from "@/components/Header";
import GolSlider from "@/components/GolSlider";
import ConnectionPanel from "@/components/ConnectionPanel";
import FameFeed from "@/components/FameFeed";
import FlicksFeed from "@/components/FlicksFeed";
import CreatePost from "@/components/CreatePost";

// --- Styled Components ---
const GlassCard = ({ children, className = "", noPadding = false }: any) => (
  <div
    className={`bg-white/10 backdrop-blur-2xl border-y sm:border border-white/10 shadow-lg w-full ${noPadding ? "p-0" : "p-4"} ${className}`}
  >
    {children}
  </div>
);

const SettingRow = ({ icon, title, desc, color }: any) => (
  <div className="flex items-center justify-between p-4 hover:bg-white/10 rounded-2xl cursor-pointer transition-all border border-transparent hover:border-white/10 group">
    <div className="flex items-center gap-4">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center bg-white/20 backdrop-blur-md border border-white/10 ${color}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold text-white">{title}</p>
        <p className="text-[10px] text-white/50 font-medium uppercase tracking-tighter">
          {desc}
        </p>
      </div>
    </div>
    <ChevronRight size={16} className="text-white/30 group-hover:text-white" />
  </div>
);

const Index = () => {
  // --- Core States ---
  const [activeFeature, setActiveFeature] = useState("Fame");
  const [isUploading, setIsUploading] = useState(false);
  const [isPostOpen, setIsPostOpen] = useState(false);
  const [showNav, setShowNav] = useState(true);
  const [bgImage, setBgImage] = useState(
    localStorage.getItem("facelook-bg") || "",
  );
  const lastScrollY = useRef(0);

  // --- Chat States ---
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");

  const [profile, setProfile] = useState({
    id: "ec047c60-4960-4083-b798-1749c0ab85dc",
    full_name: "Loading...",
    username: "user",
    avatar_url: "",
    bio: "",
    location: "",
    school: "",
    mobile: "",
    updated_at: "",
  });

  // --- Initial Fetch & Listeners ---
  useEffect(() => {
    fetchProfile();

    // Auto-hide Nav Logic
    const handleScroll = () => {
      if (window.scrollY > lastScrollY.current && window.scrollY > 100)
        setShowNav(false);
      else setShowNav(true);
      lastScrollY.current = window.scrollY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Real-time Chat Subscription
  useEffect(() => {
    if (!selectedUser) return;
    const channel = supabase
      .channel("chat-room")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          if (
            (payload.new.sender_id === profile.id &&
              payload.new.receiver_id === selectedUser.id) ||
            (payload.new.sender_id === selectedUser.id &&
              payload.new.receiver_id === profile.id)
          ) {
            setChatMessages((prev) => [...prev, payload.new]);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedUser]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", profile.id)
      .maybeSingle();
    if (data) setProfile(data);
  };

  const handleThemeChange = (url: string) => {
    setBgImage(url);
    localStorage.setItem("facelook-bg", url);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedUser) return;
    const { error } = await supabase.from("messages").insert({
      sender_id: profile.id,
      receiver_id: selectedUser.id,
      content: newMessage,
    });
    if (!error) setNewMessage("");
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const fileName = `${profile.id}-${Date.now()}.png`;
      await supabase.storage.from("avatars").upload(fileName, file);
      const publicUrl = supabase.storage.from("avatars").getPublicUrl(fileName)
        .data.publicUrl;
      await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", profile.id);
      setProfile((prev) => ({ ...prev, avatar_url: publicUrl }));
    } catch (err) {
      alert("Upload error!");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full bg-[#020617] bg-cover bg-center bg-fixed transition-all duration-700 relative overflow-x-hidden"
      style={{ backgroundImage: bgImage ? `url('${bgImage}')` : "none" }}
      onClick={() => setShowNav(true)}
    >
      {/* Overlay */}
      <div
        className={`fixed inset-0 ${bgImage ? "bg-slate-900/50 backdrop-blur-[2px]" : "bg-transparent"} pointer-events-none`}
      />

      {/* Header (Hidden in Flicks for immersive feel) */}
      {activeFeature !== "Flicks" && (
        <Header onProfileClick={() => setActiveFeature("Face")} />
      )}

      {/* --- Main Content Area --- */}
      <main
        className={`relative z-10 transition-all duration-500 
        ${activeFeature === "Flicks" ? "pt-0 pb-0" : "pt-16 pb-40"} 
        ${activeFeature === "Flicks" ? "w-full" : "max-w-2xl mx-auto px-0 sm:px-4"}`}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeFeature}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            className="w-full"
          >
            {/* 1. FAME: Feed with ZERO GAP */}
            {activeFeature === "Fame" && (
              <div className="flex flex-col gap-0">
                <ConnectionPanel />

                {/* Seamless Post Input */}
                <div
                  className="bg-white/5 backdrop-blur-xl p-4 flex items-center gap-4 border-b border-white/10 active:bg-white/10 cursor-pointer"
                  onClick={() => setIsPostOpen(true)}
                >
                  <img
                    src={
                      profile.avatar_url || "https://via.placeholder.com/150"
                    }
                    className="w-11 h-11 rounded-full object-cover border-2 border-blue-500/30"
                  />
                  <div className="flex-1 bg-white/5 py-2.5 px-6 rounded-full text-white/40 text-sm font-semibold border border-white/5">
                    What's on your mind?
                  </div>
                  <ImageIcon size={22} className="text-blue-400" />
                </div>

                <div className="w-full">
                  <FameFeed />
                </div>
              </div>
            )}

            {/* 2. FACE: Profile Section */}
            {activeFeature === "Face" && (
              <div className="space-y-4">
                <GlassCard className="sm:rounded-[3rem] p-6 overflow-hidden relative border-x-0 sm:border-x">
                  <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-blue-600/40 to-purple-600/40" />
                  <div className="relative z-10 flex flex-col items-center mt-6">
                    <div className="w-28 h-28 rounded-[2.2rem] bg-white/20 p-1 backdrop-blur-md relative shadow-2xl">
                      <img
                        src={
                          profile.avatar_url ||
                          "https://via.placeholder.com/150"
                        }
                        className="w-full h-full object-cover rounded-[1.8rem]"
                      />
                      <label className="absolute bottom-0 right-0 bg-blue-600 p-2 rounded-xl text-white shadow-lg cursor-pointer">
                        {isUploading ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Camera size={14} />
                        )}
                        <input
                          type="file"
                          hidden
                          accept="image/*"
                          onChange={handleAvatarUpload}
                        />
                      </label>
                    </div>
                    <h2 className="text-2xl font-black text-white mt-4 tracking-tight">
                      {profile.full_name}
                    </h2>
                    <p className="text-blue-400 font-bold text-[10px] uppercase tracking-widest">
                      @{profile.username}
                    </p>
                  </div>

                  {profile.bio && (
                    <div className="mt-4 border-t border-white/10 pt-4">
                      <p className="text-xs text-white/60 text-center leading-relaxed">
                        {profile.bio}
                      </p>
                    </div>
                  )}
                </GlassCard>

                <div className="grid grid-cols-2 gap-2">
                  <GlassCard className="rounded-3xl flex items-center gap-3">
                    <MapPin size={18} className="text-blue-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[8px] font-black text-white/40 uppercase">
                        Location
                      </p>
                      <p className="text-xs font-bold text-white truncate">
                        {profile.location || "Not Set"}
                      </p>
                    </div>
                  </GlassCard>
                  <GlassCard className="rounded-3xl flex items-center gap-3">
                    <BookOpen size={18} className="text-purple-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[8px] font-black text-white/40 uppercase">
                        School
                      </p>
                      <p className="text-xs font-bold text-white truncate">
                        {profile.school || "Not Set"}
                      </p>
                    </div>
                  </GlassCard>
                  <GlassCard className="rounded-3xl flex items-center gap-3 col-span-2">
                    <Phone size={18} className="text-green-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[8px] font-black text-white/40 uppercase">
                        Mobile
                      </p>
                      <p className="text-xs font-bold text-white truncate">
                        {profile.mobile || "Not Set"}
                      </p>
                    </div>
                  </GlassCard>
                </div>
              </div>
            )}

            {/* 3. FLICKS: Full Screen TikTok Style */}
            {activeFeature === "Flicks" && (
              <div className="fixed inset-0 z-[300] bg-black">
                <FlicksFeed />
              </div>
            )}

            {/* 4. SETTINGS */}
            {activeFeature === "Settings" && (
              <div className="space-y-4 px-4 sm:px-0">
                <GlassCard className="rounded-[2.5rem] p-6 border border-white/10">
                  <h2 className="text-xl font-black text-white flex items-center gap-3 mb-6">
                    <Palette className="text-blue-400" /> Appearance
                  </h2>
                  <div className="grid grid-cols-4 gap-2 mb-8">
                    {[
                      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe",
                      "https://images.unsplash.com/photo-1475275083424-b4ff81625b60",
                      "https://images.unsplash.com/photo-1531306728370-e2ebd9d7bb99",
                      "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
                    ].map((url, i) => (
                      <button
                        key={i}
                        onClick={() => handleThemeChange(url)}
                        className={`h-16 rounded-2xl overflow-hidden border-2 transition-all ${bgImage === url ? "border-blue-500 scale-90" : "border-transparent"}`}
                      >
                        <img src={url} className="w-full h-full object-cover" />
                      </button>
                    ))}
                    <button
                      onClick={() => handleThemeChange("")}
                      className="h-16 rounded-2xl bg-slate-800 text-[10px] text-white font-bold uppercase"
                    >
                      Default
                    </button>
                  </div>
                  <div className="space-y-1">
                    <SettingRow
                      icon={<User size={18} />}
                      title="Personal Info"
                      desc="Name & Location"
                      color="text-blue-400"
                    />
                    <SettingRow
                      icon={<Lock size={18} />}
                      title="Security"
                      desc="Password & Privacy"
                      color="text-slate-400"
                    />
                  </div>
                  <button className="w-full mt-6 py-4 bg-red-500/20 text-red-400 rounded-2xl font-black text-xs uppercase tracking-widest border border-red-500/20">
                    <LogOut size={16} className="inline mr-2" /> Logout
                  </button>
                </GlassCard>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* --- Floating Chat Overlay --- */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="fixed inset-x-0 bottom-0 z-[150] bg-slate-900/90 backdrop-blur-3xl h-[85vh] sm:h-[600px] sm:w-[400px] sm:right-6 sm:left-auto sm:bottom-6 rounded-t-[3rem] sm:rounded-[3rem] shadow-2xl flex flex-col overflow-hidden border border-white/10"
          >
            <div className="p-6 bg-white/5 border-b border-white/10 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users size={20} />
                <p className="font-black text-sm">
                  {selectedUser ? selectedUser.full_name : "Messenger"}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsChatOpen(false);
                  setSelectedUser(null);
                }}
              >
                <X size={22} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {!selectedUser ? (
                <div
                  onClick={() =>
                    setSelectedUser({ id: "dummy", full_name: "Rahul Kumar" })
                  }
                  className="bg-white/5 p-4 rounded-2xl flex items-center gap-4 cursor-pointer hover:bg-white/10 transition-colors"
                >
                  <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center font-bold text-blue-400">
                    R
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-black text-white">Rahul Kumar</p>
                    <p className="text-[10px] text-white/40">Active Now</p>
                  </div>
                </div>
              ) : (
                chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.sender_id === profile.id ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] p-4 rounded-[1.8rem] text-sm font-bold ${msg.sender_id === profile.id ? "bg-blue-600 text-white rounded-tr-none" : "bg-white/10 text-white border border-white/10 rounded-tl-none"}`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
            </div>
            {selectedUser && (
              <div className="p-4 bg-white/5 border-t border-white/10 flex gap-2">
                <input
                  type="text"
                  placeholder="Type a message..."
                  className="flex-1 bg-white/10 h-12 px-6 rounded-2xl font-bold text-white outline-none"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                />
                <button
                  onClick={sendMessage}
                  className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center"
                >
                  <Send size={18} />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Nav Toggle Trigger */}
      <motion.button
        animate={{
          y: showNav && activeFeature !== "Flicks" ? 0 : 150,
          opacity: showNav ? 1 : 0,
        }}
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-32 right-6 w-16 h-16 bg-blue-600 rounded-full shadow-2xl flex items-center justify-center z-[80] border-2 border-white/20 active:scale-90"
      >
        <MessageSquare size={28} fill="currentColor" />
        <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full border-2 border-white text-[10px] font-black flex items-center justify-center animate-bounce">
          3
        </span>
      </motion.button>

      {/* Production-Grade Bottom Nav */}
      <motion.div
        animate={{ y: showNav && activeFeature !== "Flicks" ? 0 : 120 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
        className="fixed bottom-0 left-0 w-full z-[200] pb-6 px-4 pointer-events-none"
      >
        <div className="max-w-md mx-auto pointer-events-auto">
          <div className="bg-slate-900/60 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-1.5 shadow-2xl">
            <GolSlider onFeatureChange={setActiveFeature} />
          </div>
        </div>
      </motion.div>

      <CreatePost
        isOpen={isPostOpen}
        onClose={() => setIsPostOpen(false)}
        userProfile={profile}
      />
    </div>
  );
};

export default Index;
