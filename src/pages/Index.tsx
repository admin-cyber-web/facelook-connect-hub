import { useState, useEffect } from "react";
import Header from "@/components/Header";
import GolSlider from "@/components/GolSlider";
import ConnectionPanel from "@/components/ConnectionPanel";
import MatchmakingSection from "@/components/MatchmakingSection";
import FameFeed from "@/components/FameFeed";
import FlicksFeed from "@/components/FlicksFeed";
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
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
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

  const fetchProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", profile.id)
      .maybeSingle();
    if (data) setProfile(data);
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
      alert("Upload error! Make sure 'avatars' bucket exists.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 overflow-x-hidden">
      <Header />

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
                <ConnectionPanel />
                <FameFeed />
              </div>
            )}

            {/* 2. FACE (PROFILE SECTION - INLINE) */}
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
                          alt="DP"
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

                  {/* STATS SECTION */}
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
                    <div className="text-center">
                      <p className="text-lg font-black text-blue-600">
                        {profile.pending_requests}
                      </p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
                        Pending
                      </p>
                    </div>
                  </div>
                </div>

                {/* SEARCHABLE INFO CARDS */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-3">
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
                  <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-3">
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

            {/* 3. SETTINGS (FB STYLE) */}
            {activeFeature === "Settings" && (
              <div className="space-y-4">
                <div className="bg-white rounded-[2.5rem] shadow-xl border border-white p-6">
                  <h2 className="text-xl font-black text-slate-800 mb-6 px-2">
                    Settings & Privacy
                  </h2>

                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-3 ml-2">
                      Account
                    </p>
                    <SettingRow
                      icon={<User size={18} />}
                      title="Personal Info"
                      desc="Update name, mobile, and location"
                      color="text-blue-600"
                    />
                    <SettingRow
                      icon={<Lock size={18} />}
                      title="Password"
                      desc="Change your security credentials"
                      color="text-slate-700"
                    />
                  </div>

                  <div className="space-y-1 mt-6">
                    <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-3 ml-2">
                      Safety
                    </p>
                    <SettingRow
                      icon={<ShieldCheck size={18} />}
                      title="Privacy Checkup"
                      desc="Who can see your posts"
                      color="text-green-600"
                    />
                    <SettingRow
                      icon={<UserMinus size={18} />}
                      title="Blocked People"
                      desc="Manage your block list"
                      color="text-red-500"
                    />
                  </div>

                  <div className="mt-8 pt-6 border-t border-slate-50">
                    <button className="w-full py-4 bg-red-50 text-red-500 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                      <LogOut size={16} /> Logout Account
                    </button>
                  </div>
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

      {/* FIXED FOOTER WITH SLIDER */}
      <div className="fixed bottom-0 left-0 w-full z-50 pointer-events-none pb-4">
        <div className="max-w-2xl mx-auto pointer-events-auto px-4">
          <GolSlider onFeatureChange={setActiveFeature} />
        </div>
      </div>
    </div>
  );
};

export default Index;
