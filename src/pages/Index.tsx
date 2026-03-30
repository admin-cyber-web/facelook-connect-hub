import { useState, useEffect } from "react";
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
  Edit3,
  MapPin,
  Lock,
  ShieldCheck,
  UserMinus,
  ChevronRight,
  LogOut,
  Bell,
  User,
  BookOpen,
  Heart,
  Home,
  Phone,
  Settings,
  Users,
  Image as ImageIcon,
  ThumbsUp,
  Clock,
  MessageSquare,
  Send,
  X,
  Star,
  Flame,
  Film,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

// --- Setting Item Component (FB Style) ---
const SettingRow = ({ icon, title, desc, color }: any) => (
  <div className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl cursor-pointer transition-all border border-transparent hover:border-slate-100">
    <div className="flex items-center gap-4">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center bg-white shadow-sm border border-slate-50 ${color}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold text-slate-800">{title}</p>
        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">
          {desc}
        </p>
      </div>
    </div>
    <ChevronRight size={16} className="text-slate-300" />
  </div>
);

const Index = () => {
  const [activeFeature, setActiveFeature] = useState("Fame");
  const [isUploading, setIsUploading] = useState(false);
  const [isPostOpen, setIsPostOpen] = useState(false);

  // --- 💬 CHAT STATES ---
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");

  const [profile, setProfile] = useState({
    id: "ec047c60-4960-4083-b798-1749c0ab85dc",
    full_name: "Loading...",
    username: "user",
    bio: "Setting up my vibe...",
    avatar_url: "",
    mobile: "",
    current_location: "",
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

  // --- Real-time Message Subscription ---
  useEffect(() => {
    if (!selectedUser) return;

    const channel = supabase
      .channel("chat-room")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
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
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;
      await supabase
        .from("profiles")
        .upsert({ ...profile, avatar_url: publicUrl });
      setProfile((prev) => ({ ...prev, avatar_url: publicUrl }));
      alert("DP Updated! 🔥");
    } catch (err) {
      alert("Upload error!");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 overflow-x-hidden relative">
      <Header onProfileClick={() => setActiveFeature("Face")} />

      <main className="pt-24 pb-40 max-w-2xl mx-auto px-4 min-h-screen">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeFeature}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full space-y-6"
          >
            {/* 1. FAME (MAIN FEED) */}
            {activeFeature === "Fame" && (
              <div className="flex flex-col gap-6">
                <div
                  onClick={() => setIsPostOpen(true)}
                  className="bg-white p-4 rounded-[2.5rem] shadow-sm border border-white flex items-center gap-4 cursor-pointer hover:shadow-md transition-all"
                >
                  <img
                    src={profile.avatar_url}
                    className="w-10 h-10 rounded-xl object-cover"
                  />
                  <div className="flex-1 bg-slate-50 py-3 px-6 rounded-2xl text-slate-400 text-sm font-bold">
                    What's on your mind?
                  </div>
                  <div className="p-2 text-blue-600 bg-blue-50 rounded-xl">
                    <ImageIcon size={20} />
                  </div>
                </div>
                <ConnectionPanel />
                <FameFeed />
              </div>
            )}

            {/* 2. FACE (PROFILE SECTION) */}
            {activeFeature === "Face" && (
              <div className="space-y-6">
                <div className="bg-white rounded-[3rem] p-6 shadow-xl border border-white overflow-hidden relative">
                  <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-blue-500 to-indigo-600" />
                  <div className="relative z-10 flex flex-col items-center mt-6">
                    <div className="w-28 h-28 rounded-[2.2rem] bg-white p-1 shadow-lg overflow-hidden relative">
                      {profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          className="w-full h-full object-cover rounded-[1.8rem]"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-100 flex items-center justify-center text-3xl font-black text-blue-200">
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
                    <h2 className="text-2xl font-black text-slate-800 mt-4">
                      {profile.full_name}
                    </h2>
                    <p className="text-blue-600 font-black text-[10px] uppercase tracking-widest">
                      @{profile.username}
                    </p>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mt-8 border-t border-slate-50 pt-6">
                    <div className="text-center">
                      <p className="text-lg font-black text-slate-800">
                        {profile.total_friends}
                      </p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
                        Buddies
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-black text-slate-800">
                        {profile.total_posts}
                      </p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
                        Posts
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-black text-slate-800">
                        {profile.total_likes}
                      </p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
                        Likes
                      </p>
                    </div>
                    <div className="text-center text-blue-600 font-black">
                      <p className="text-lg">{profile.pending_requests}</p>
                      <p className="text-[8px] uppercase">Pending</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white p-4 rounded-3xl border flex items-center gap-3">
                    <Home size={18} className="text-blue-500" />
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase">
                        Village
                      </p>
                      <p className="text-xs font-bold">
                        {profile.village || "Not Set"}
                      </p>
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-3xl border flex items-center gap-3">
                    <BookOpen size={18} className="text-purple-500" />
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase">
                        School
                      </p>
                      <p className="text-xs font-bold truncate w-24">
                        {profile.school || "Not Set"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. SETTINGS */}
            {activeFeature === "Settings" && (
              <div className="bg-white rounded-[2.5rem] shadow-xl p-6">
                <h2 className="text-xl font-black mb-6">Settings & Privacy</h2>
                <div className="space-y-6">
                  <div>
                    <p className="text-[10px] font-black text-blue-600 uppercase mb-3 ml-2">
                      Account
                    </p>
                    <SettingRow
                      icon={<User size={18} />}
                      title="Personal Info"
                      desc="Update name and location"
                      color="text-blue-600"
                    />
                    <SettingRow
                      icon={<Lock size={18} />}
                      title="Password"
                      desc="Change credentials"
                      color="text-slate-700"
                    />
                  </div>
                  <button className="w-full py-4 bg-red-50 text-red-500 rounded-2xl font-black text-xs uppercase">
                    <LogOut size={16} className="inline mr-2" /> Logout
                  </button>
                </div>
              </div>
            )}

            {/* 4. FLICKS & OTHERS */}
            {activeFeature === "Flicks" && <FlicksFeed />}
            {activeFeature === "Flame" && (
              <div className="p-20 text-center text-slate-300 font-black italic">
                Flame Content...
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* --- 💬 FLOATING CHAT SYSTEM --- */}
      <button
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-32 right-6 w-16 h-16 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center z-[80] active:scale-90 border-4 border-white"
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
            className="fixed inset-x-0 bottom-0 z-[150] bg-white h-[85vh] sm:h-[600px] sm:w-[400px] sm:right-6 sm:left-auto sm:bottom-6 rounded-t-[3rem] sm:rounded-[3rem] shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="p-6 bg-blue-600 text-white flex items-center justify-between">
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
            <div className="flex-1 bg-slate-50 overflow-y-auto p-4">
              {!selectedUser ? (
                <div
                  onClick={() =>
                    setSelectedUser({ id: "dummy", full_name: "Rahul Kumar" })
                  }
                  className="bg-white p-4 rounded-2xl flex items-center gap-4 cursor-pointer border border-slate-100"
                >
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center font-bold text-blue-600">
                    R
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-black">Rahul Kumar</p>
                    <p className="text-[10px] text-slate-400">Click to chat</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {chatMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${msg.sender_id === profile.id ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] p-4 rounded-[1.8rem] text-sm font-bold ${msg.sender_id === profile.id ? "bg-blue-600 text-white rounded-tr-none" : "bg-white text-slate-800 rounded-tl-none"}`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedUser && (
              <div className="p-4 bg-white border-t flex gap-2">
                <input
                  type="text"
                  placeholder="Type a message..."
                  className="flex-1 bg-slate-100 h-12 px-6 rounded-2xl font-bold outline-none"
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
        <div className="max-w-2xl mx-auto pointer-events-auto px-4">
          <GolSlider onFeatureChange={setActiveFeature} />
        </div>
      </div>
    </div>
  );
};

export default Index;
