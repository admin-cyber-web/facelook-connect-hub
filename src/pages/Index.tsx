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
  Check,
  Edit3,
  MapPin,
  Lock,
  Globe,
  ShieldCheck,
  UserMinus,
  ChevronRight,
  LogOut,
  Bell,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

// --- Reusable Setting Item Component ---
const SettingItem = ({ icon, title, desc, color, isToggle = false }: any) => (
  <div className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-[2rem] transition-all cursor-pointer group border border-transparent hover:border-slate-100">
    <div className="flex items-center gap-4">
      <div
        className={`w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center ${color} group-hover:scale-110 transition-transform border border-slate-50`}
      >
        {icon}
      </div>
      <div className="text-left">
        <p className="text-sm font-black text-slate-800">{title}</p>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
          {desc}
        </p>
      </div>
    </div>
    {isToggle ? (
      <div className="w-10 h-6 bg-blue-100 rounded-full relative p-1">
        <div className="w-4 h-4 bg-blue-600 rounded-full shadow-sm ml-auto" />
      </div>
    ) : (
      <ChevronRight
        size={18}
        className="text-slate-300 group-hover:text-blue-500 transition-colors"
      />
    )}
  </div>
);

const Index = () => {
  const [activeFeature, setActiveFeature] = useState("Fame");
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [profile, setProfile] = useState({
    full_name: "Your Identity",
    username: "fame_user",
    bio: "Living the fame life",
    avatar_url: "",
    location: "India",
  });

  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (data) setProfile(data);
    };
    fetchProfile();
  }, []);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const fileName = `avatar-${Date.now()}`;
      await supabase.storage.from("avatars").upload(fileName, file);
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);
      const newUrl = urlData.publicUrl;
      await supabase
        .from("profiles")
        .upsert({
          ...profile,
          avatar_url: newUrl,
          id: "ec047c60-4960-4083-b798-1749c0ab85dc",
        });
      setProfile({ ...profile, avatar_url: newUrl });
      alert("DP Updated! 🔥");
    } catch (err) {
      alert("Upload failed!");
    } finally {
      setIsUploading(false);
    }
  };

  const saveProfile = async () => {
    setIsUploading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({
          ...profile,
          id: "ec047c60-4960-4083-b798-1749c0ab85dc",
          updated_at: new Date().toISOString(),
        });
      if (!error) {
        setIsEditing(false);
        alert("Saved! ✅");
      }
    } catch (err) {
      alert("Save failed!");
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
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="w-full space-y-8"
          >
            {/* 🌟 FAME FEED */}
            {activeFeature === "Fame" && (
              <div className="flex flex-col gap-8">
                <ConnectionPanel />
                <FameFeed />
              </div>
            )}

            {/* 👤 FACE / PROFILE */}
            {activeFeature === "Face" && (
              <div className="px-2">
                <div className="bg-white rounded-[3.5rem] p-8 shadow-2xl border border-white flex flex-col items-center gap-6 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-28 bg-gradient-to-br from-blue-600 to-purple-600" />
                  <div className="relative mt-6 z-10">
                    <div className="w-32 h-32 rounded-[2.8rem] bg-white p-1.5 shadow-2xl overflow-hidden">
                      {profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          className="w-full h-full object-cover rounded-[2.5rem]"
                          alt="Profile"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-100 flex items-center justify-center text-4xl font-black text-blue-200">
                          {profile.full_name ? profile.full_name[0] : "U"}
                        </div>
                      )}
                    </div>
                    <label className="absolute bottom-[-4px] right-[-4px] bg-blue-600 p-3 rounded-2xl text-white shadow-xl cursor-pointer border-4 border-white active:scale-95 transition-transform">
                      {isUploading ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Camera size={18} />
                      )}
                      <input
                        type="file"
                        hidden
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        disabled={isUploading}
                      />
                    </label>
                  </div>

                  <div className="w-full text-center space-y-4 z-10">
                    {isEditing ? (
                      <div className="space-y-4">
                        <input
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-center font-bold outline-none"
                          value={profile.full_name}
                          onChange={(e) =>
                            setProfile({
                              ...profile,
                              full_name: e.target.value,
                            })
                          }
                        />
                        <textarea
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-center text-sm h-24 resize-none outline-none"
                          value={profile.bio}
                          onChange={(e) =>
                            setProfile({ ...profile, bio: e.target.value })
                          }
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => setIsEditing(false)}
                            className="flex-1 bg-slate-100 py-3 rounded-2xl font-black text-xs uppercase"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={saveProfile}
                            className="flex-[2] bg-blue-600 text-white py-3 rounded-2xl font-black text-xs shadow-lg uppercase"
                          >
                            Save Vibe
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <h2 className="text-3xl font-black text-slate-800 tracking-tight">
                          {profile.full_name}
                        </h2>
                        <p className="text-blue-600 font-black text-xs uppercase tracking-widest">
                          @{profile.username}
                        </p>
                        <p className="text-slate-500 text-sm italic">
                          "{profile.bio}"
                        </p>
                        <button
                          onClick={() => setIsEditing(true)}
                          className="mt-4 px-8 py-2 border-2 border-slate-100 rounded-xl text-slate-400 font-black text-[10px] flex items-center gap-2 mx-auto uppercase tracking-widest hover:text-blue-600 hover:border-blue-100 transition-all"
                        >
                          <Edit3 size={14} /> Update Profile
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ⚙️ SETTINGS SECTION (Added Missing Features) ⚙️ */}
            {activeFeature === "Settings" && (
              <div className="px-2 pb-10">
                <div className="bg-white rounded-[3.5rem] shadow-2xl border border-white overflow-hidden">
                  <div className="bg-slate-50 p-8 border-b border-slate-100">
                    <h2 className="text-2xl font-black text-slate-800">
                      Settings
                    </h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                      Manage your experience
                    </p>
                  </div>

                  <div className="p-4 space-y-2">
                    {/* Security Group */}
                    <div className="py-2">
                      <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-3 ml-4">
                        Account Security
                      </h3>
                      <SettingItem
                        icon={<Lock size={18} />}
                        title="Password Reset"
                        desc="Update your login credentials"
                        color="text-blue-500"
                      />
                      <SettingItem
                        icon={<ShieldCheck size={18} />}
                        title="Two-Factor Auth"
                        desc="Secure your account"
                        color="text-indigo-500"
                      />
                    </div>

                    {/* Privacy Group */}
                    <div className="py-2 border-t border-slate-50">
                      <h3 className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em] mb-3 ml-4">
                        Privacy & Safety
                      </h3>
                      <SettingItem
                        icon={<Lock size={18} />}
                        title="Profile Lock"
                        desc="Hide photos from strangers"
                        color="text-slate-700"
                        isToggle
                      />
                      <SettingItem
                        icon={<UserMinus size={18} />}
                        title="Block List"
                        desc="Manage blocked contacts"
                        color="text-red-500"
                      />
                      <SettingItem
                        icon={<MapPin size={18} />}
                        title="Hide Location"
                        desc="Stop sharing city info"
                        color="text-orange-500"
                        isToggle
                      />
                    </div>

                    {/* App Group */}
                    <div className="py-2 border-t border-slate-50">
                      <h3 className="text-[10px] font-black text-green-600 uppercase tracking-[0.2em] mb-3 ml-4">
                        App Preferences
                      </h3>
                      <SettingItem
                        icon={<Globe size={18} />}
                        title="Language"
                        desc="English (US) - Default"
                        color="text-green-600"
                      />
                      <SettingItem
                        icon={<Bell size={18} />}
                        title="Notifications"
                        desc="Push & Email alerts"
                        color="text-yellow-600"
                        isToggle
                      />
                    </div>
                  </div>

                  <div className="p-6 bg-red-50/30">
                    <button className="w-full py-4 bg-white border-2 border-red-100 rounded-3xl text-red-500 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-50 transition-all">
                      <LogOut size={16} /> Logout Everywhere
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 🔥 FLAME / GROUPS */}
            {activeFeature === "Flame" && (
              <div className="space-y-6 px-2">
                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 flex items-center gap-3 ml-4">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />{" "}
                  Active Hubs
                </h2>
                {["#ReactDevs", "#DesignDaily", "#StartupPK"].map((group) => (
                  <div
                    key={group}
                    className="bg-white rounded-[2.5rem] p-6 flex items-center justify-between shadow-sm border border-slate-100"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 text-lg font-black">
                        {group[1]}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-800">
                          {group}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                          12 Active
                        </p>
                      </div>
                    </div>
                    <button className="px-5 py-2 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase">
                      Join
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 🎬 VIDEO FEED & OTHER SECTIONS */}
            {activeFeature === "Flicks" && <FlicksFeed />}
            {(activeFeature === "Film" || activeFeature === "Fun") && (
              <div className="space-y-6 px-2 text-center py-20 text-slate-300 font-black italic uppercase tracking-widest text-xs">
                Feature Coming Soon...
              </div>
            )}
            {(activeFeature === "Post" ||
              activeFeature === "Task" ||
              activeFeature === "Groups" ||
              activeFeature === "Snapy") && <MatchmakingSection />}
          </motion.div>
        </AnimatePresence>
      </main>

      <div className="fixed bottom-0 left-0 w-full z-50 pointer-events-none">
        <div className="max-w-2xl mx-auto pointer-events-auto">
          <GolSlider onFeatureChange={setActiveFeature} />
        </div>
      </div>
    </div>
  );
};

export default Index;
