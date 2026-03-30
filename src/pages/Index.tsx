import { useState, useEffect, useRef } from "react";
import Header from "@/components/Header";
import GolSlider from "@/components/GolSlider";
import ConnectionPanel from "@/components/ConnectionPanel";
import MatchmakingSection from "@/components/MatchmakingSection";
import FameFeed from "@/components/FameFeed";
import FlicksFeed from "@/components/FlicksFeed";
import CreatePost from "@/components/CreatePost";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Loader2,
  Lock,
  ChevronRight,
  LogOut,
  User,
  BookOpen,
  Home,
  Image as ImageIcon,
  MessageSquare,
  Send,
  X,
  Users,
  Palette,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

// --- Glass Style Wrapper Component (Fixed for Wall-to-Wall touch) ---
const GlassCard = ({ children, className = "", noPadding = false }: any) => (
  <div
    className={`bg-white/10 backdrop-blur-2xl border-y sm:border-x border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] w-full ${noPadding ? "p-0" : "p-4"} ${className}`}
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
  const [activeFeature, setActiveFeature] = useState("Fame");
  const [isUploading, setIsUploading] = useState(false);
  const [isPostOpen, setIsPostOpen] = useState(false);

  // --- 🎨 THEME STATE (Added White Gray) ---
  const [bgImage, setBgImage] = useState(
    localStorage.getItem("facelook-bg") ||
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1964",
  );

  // --- 💬 CHAT STATES ---
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");

  const [profile, setProfile] = useState({
    id: "ec047c60-4960-4083-b798-1749c0ab85dc",
    full_name: "Loading...",
    username: "user",
    avatar_url: "",
    school: "",
    village: "",
    total_posts: 0,
    total_friends: 0,
    total_likes: 0,
    pending_requests: 0,
  });

  useEffect(() => {
    fetchProfile();
  }, []);

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
        .upsert({ ...profile, avatar_url: publicUrl });
      setProfile((prev) => ({ ...prev, avatar_url: publicUrl }));
    } catch (err) {
      alert("Upload error!");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full bg-cover bg-center bg-fixed transition-all duration-700 relative overflow-x-hidden"
      style={{ backgroundImage: `url('${bgImage}')` }}
    >
      {/* Dark Frost Overlay */}
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] pointer-events-none" />

      <Header onProfileClick={() => setActiveFeature("Face")} />

      {/* --- Main Content (Width set to full for mobile wall-touch) --- */}
      <main className="pt-24 pb-40 w-full max-w-2xl mx-auto min-h-screen relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeFeature}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full space-y-4"
          >
            {/* 1. FAME (WALL-TO-WALL FEED) */}
            {activeFeature === "Fame" && (
              <div className="flex flex-col gap-4">
                <div className="px-4">
                  {" "}
                  {/* Composer ko thoda space dena professional lagta hai */}
                  <GlassCard
                    className="p-4 rounded-[2rem] flex items-center gap-4 cursor-pointer"
                    onClick={() => setIsPostOpen(true)}
                  >
                    <img
                      src={profile.avatar_url}
                      className="w-10 h-10 rounded-xl object-cover border border-white/20"
                    />
                    <div className="flex-1 bg-white/10 py-3 px-6 rounded-2xl text-white/60 text-sm font-bold">
                      What's on your mind?
                    </div>
                    <div className="p-2 text-white bg-blue-600/50 rounded-xl">
                      <ImageIcon size={20} />
                    </div>
                  </GlassCard>
                </div>

                <ConnectionPanel />

                {/* Feed Cards flush with walls */}
                <div className="w-full">
                  <FameFeed />
                </div>
              </div>
            )}

            {/* 2. FACE (PROFILE SECTION) */}
            {activeFeature === "Face" && (
              <div className="space-y-4 w-full">
                <GlassCard className="sm:rounded-[3rem] p-6 overflow-hidden relative border-x-0 sm:border-x">
                  <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-blue-500/40 to-indigo-600/40" />
                  <div className="relative z-10 flex flex-col items-center mt-6">
                    <div className="w-28 h-28 rounded-[2.2rem] bg-white/20 p-1 backdrop-blur-md shadow-2xl relative">
                      {profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          className="w-full h-full object-cover rounded-[1.8rem]"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl font-black text-white">
                          {profile.full_name[0]}
                        </div>
                      )}
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
                    <h2 className="text-2xl font-black text-white mt-4 drop-shadow-lg">
                      {profile.full_name}
                    </h2>
                    <p className="text-blue-300 font-black text-[10px] uppercase tracking-widest">
                      @{profile.username}
                    </p>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mt-8 border-t border-white/10 pt-6">
                    {[
                      { l: "Buddies", v: profile.total_friends },
                      { l: "Posts", v: profile.total_posts },
                      { l: "Likes", v: profile.total_likes },
                      {
                        l: "Pending",
                        v: profile.pending_requests,
                        c: "text-blue-400",
                      },
                    ].map((s, i) => (
                      <div key={i} className="text-center">
                        <p
                          className={`text-lg font-black ${s.c || "text-white"}`}
                        >
                          {s.v}
                        </p>
                        <p className="text-[8px] font-bold text-white/40 uppercase tracking-tighter">
                          {s.l}
                        </p>
                      </div>
                    ))}
                  </div>
                </GlassCard>

                <div className="grid grid-cols-2 gap-0 sm:gap-3 w-full">
                  <GlassCard className="p-4 sm:rounded-3xl flex items-center gap-3 border-r border-white/10 sm:border-r-0">
                    <Home size={18} className="text-blue-400" />
                    <div>
                      <p className="text-[8px] font-black text-white/40 uppercase">
                        Village
                      </p>
                      <p className="text-xs font-bold text-white">
                        {profile.village || "Not Set"}
                      </p>
                    </div>
                  </GlassCard>
                  <GlassCard className="p-4 sm:rounded-3xl flex items-center gap-3">
                    <BookOpen size={18} className="text-purple-400" />
                    <div>
                      <p className="text-[8px] font-black text-white/40 uppercase">
                        School
                      </p>
                      <p className="text-xs font-bold text-white truncate w-24">
                        {profile.school || "Not Set"}
                      </p>
                    </div>
                  </GlassCard>
                </div>
              </div>
            )}

            {/* 3. SETTINGS (THEME ENGINE + WHITE GRAY) */}
            {activeFeature === "Settings" && (
              <div className="space-y-4">
                <GlassCard className="sm:rounded-[2.5rem] p-6 border-x-0 sm:border-x">
                  <div className="flex items-center gap-3 mb-6">
                    <Palette className="text-blue-400" size={24} />
                    <h2 className="text-xl font-black text-white">
                      App Appearance
                    </h2>
                  </div>
                  <div className="grid grid-cols-4 gap-3 mb-8">
                    {[
                      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000",
                      "https://images.unsplash.com/photo-1475275083424-b4ff81625b60?q=80&w=1000",
                      "https://images.unsplash.com/photo-1531306728370-e2ebd9d7bb99?q=80&w=1000",
                      "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1000",
                      "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=1000",
                      "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?q=80&w=1000",
                      "https://images.unsplash.com/photo-1465447142348-e9952c393450?q=80&w=1000", // Added White Gray Theme
                    ].map((url, i) => (
                      <button
                        key={i}
                        onClick={() => handleThemeChange(url)}
                        className={`h-16 rounded-2xl overflow-hidden border-2 transition-all ${bgImage === url ? "border-blue-500 scale-90" : "border-transparent"}`}
                      >
                        <img src={url} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3 ml-2">
                      Account Control
                    </p>
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

            {activeFeature === "Flicks" && <FlicksFeed />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* --- 💬 GLASS CHAT SYSTEM --- */}
      <button
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-32 right-6 w-16 h-16 bg-blue-600/80 backdrop-blur-lg text-white rounded-full shadow-2xl flex items-center justify-center z-[80] border-2 border-white/20 active:scale-90"
      >
        <MessageSquare size={28} fill="currentColor" />
        <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full border-2 border-white text-[10px] font-black flex items-center justify-center animate-pulse">
          3
        </span>
      </button>

      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="fixed inset-x-0 bottom-0 z-[150] bg-slate-900/60 backdrop-blur-3xl h-[85vh] sm:h-[600px] sm:w-[400px] sm:right-6 sm:left-auto sm:bottom-6 rounded-t-[3rem] sm:rounded-[3rem] shadow-2xl flex flex-col overflow-hidden border border-white/10"
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
                  className="bg-white/5 p-4 rounded-2xl flex items-center gap-4 cursor-pointer border border-white/5 hover:bg-white/10"
                >
                  <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center font-bold text-blue-400 border border-blue-500/20">
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
                      className={`max-w-[80%] p-4 rounded-[1.8rem] text-sm font-bold ${msg.sender_id === profile.id ? "bg-blue-600 text-white rounded-tr-none" : "bg-white/10 text-white border border-white/10 rounded-tl-none backdrop-blur-md"}`}
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
                  className="flex-1 bg-white/10 h-12 px-6 rounded-2xl font-bold text-white outline-none placeholder:text-white/20"
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

      <CreatePost
        isOpen={isPostOpen}
        onClose={() => setIsPostOpen(false)}
        userProfile={profile}
      />

      <div className="fixed bottom-0 left-0 w-full z-50 pointer-events-none pb-4">
        <div className="max-w-2xl mx-auto pointer-events-auto w-full">
          <GolSlider onFeatureChange={setActiveFeature} />
        </div>
      </div>
    </div>
  );
};

export default Index;
