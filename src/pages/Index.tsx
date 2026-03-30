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
  X,
  User,
  BookOpen,
  Heart,
  Home,
  Phone,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

// --- Reusable Setting & Detail Items ---
const DetailItem = ({ icon, label, value }: any) => (
  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
    <div className="text-blue-600">{icon}</div>
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
        {label}
      </p>
      <p className="text-sm font-bold text-slate-800">{value || "Not Added"}</p>
    </div>
  </div>
);

const Index = () => {
  const [activeFeature, setActiveFeature] = useState("Fame");
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState("Posts");

  const [profile, setProfile] = useState({
    id: "ec047c60-4960-4083-b798-1749c0ab85dc",
    full_name: "Your Identity",
    username: "fame_user",
    bio: "Living the fame life",
    avatar_url: "",
    mobile: "",
    current_location: "India",
    past_location: "",
    school: "",
    best_friend: "",
    village: "",
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data, error } = await supabase
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
      const fileExt = file.name.split(".").pop();
      const fileName = `${profile.id}-${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      await supabase.from("profiles").upsert({
        ...profile,
        avatar_url: publicUrl,
      });

      setProfile((prev) => ({ ...prev, avatar_url: publicUrl }));
      alert("DP Updated! 🔥");
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const saveProfile = async () => {
    setIsUploading(true);
    try {
      const { error } = await supabase.from("profiles").upsert({
        ...profile,
        updated_at: new Date().toISOString(),
      });
      if (!error) {
        setIsEditing(false);
        alert("Profile Synced! ✅");
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

      <main className="pt-24 pb-40 max-w-2xl mx-auto px-4">
        <AnimatePresence mode="wait">
          {/* 🌟 MAIN FEED SECTIONS 🌟 */}
          {activeFeature === "Fame" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              <ConnectionPanel />
              <FameFeed />
            </motion.div>
          )}

          {activeFeature === "Flicks" && <FlicksFeed />}

          {/* 👤 FULL SCREEN PROFILE SECTION 👤 */}
          {activeFeature === "Face" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-0 z-[60] bg-white overflow-y-auto pb-20"
            >
              {/* Profile Header & Close */}
              <div className="relative h-64 bg-gradient-to-br from-blue-600 to-purple-700 p-6">
                <button
                  onClick={() => setActiveFeature("Fame")}
                  className="absolute top-8 right-6 p-3 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40 transition-all"
                >
                  <X size={24} />
                </button>

                <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <div className="w-40 h-40 rounded-[3rem] bg-white p-2 shadow-2xl relative">
                    <div className="w-full h-full rounded-[2.5rem] overflow-hidden bg-slate-100 border-4 border-white">
                      {profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          className="w-full h-full object-cover"
                          alt="Profile"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-5xl font-black text-blue-200">
                          {profile.full_name[0]}
                        </div>
                      )}
                    </div>
                    <label className="absolute bottom-2 right-2 bg-blue-600 p-3 rounded-2xl text-white shadow-xl cursor-pointer border-4 border-white active:scale-90 transition-all">
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
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Profile Info */}
              <div className="mt-20 px-6 text-center space-y-2">
                <h2 className="text-3xl font-black text-slate-800">
                  {profile.full_name}
                </h2>
                <p className="text-blue-600 font-black text-sm tracking-widest uppercase">
                  @{profile.username}
                </p>
                <p className="text-slate-500 max-w-sm mx-auto italic">
                  "{profile.bio}"
                </p>

                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="mt-4 px-6 py-2 bg-slate-100 rounded-full text-[10px] font-black text-slate-500 uppercase flex items-center gap-2 mx-auto"
                  >
                    <Edit3 size={14} /> Customize Identity
                  </button>
                )}
              </div>

              {/* Dynamic Edit Form / Searchable Data */}
              <div className="px-6 mt-8 space-y-4">
                {isEditing ? (
                  <div className="bg-slate-50 p-6 rounded-[2.5rem] space-y-4 border border-slate-200">
                    <h3 className="font-black text-xs uppercase text-slate-400 ml-2">
                      Searchable Details
                    </h3>
                    <input
                      className="w-full p-4 rounded-2xl border-2 border-white bg-white outline-none font-bold"
                      placeholder="Full Name"
                      value={profile.full_name}
                      onChange={(e) =>
                        setProfile({ ...profile, full_name: e.target.value })
                      }
                    />
                    <input
                      className="w-full p-4 rounded-2xl border-2 border-white bg-white outline-none font-bold"
                      placeholder="Mobile Number"
                      value={profile.mobile}
                      onChange={(e) =>
                        setProfile({ ...profile, mobile: e.target.value })
                      }
                    />
                    <input
                      className="w-full p-4 rounded-2xl border-2 border-white bg-white outline-none font-bold"
                      placeholder="Current Location"
                      value={profile.current_location}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          current_location: e.target.value,
                        })
                      }
                    />
                    <input
                      className="w-full p-4 rounded-2xl border-2 border-white bg-white outline-none font-bold"
                      placeholder="School/College Name"
                      value={profile.school}
                      onChange={(e) =>
                        setProfile({ ...profile, school: e.target.value })
                      }
                    />
                    <input
                      className="w-full p-4 rounded-2xl border-2 border-white bg-white outline-none font-bold"
                      placeholder="Best Friend Name"
                      value={profile.best_friend}
                      onChange={(e) =>
                        setProfile({ ...profile, best_friend: e.target.value })
                      }
                    />
                    <input
                      className="w-full p-4 rounded-2xl border-2 border-white bg-white outline-none font-bold"
                      placeholder="Village / Hometown"
                      value={profile.village}
                      onChange={(e) =>
                        setProfile({ ...profile, village: e.target.value })
                      }
                    />
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => setIsEditing(false)}
                        className="flex-1 py-4 bg-slate-200 rounded-2xl font-black text-xs"
                      >
                        CANCEL
                      </button>
                      <button
                        onClick={saveProfile}
                        className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black text-xs shadow-lg shadow-blue-200"
                      >
                        SAVE PROFILE
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <DetailItem
                      icon={<Phone size={18} />}
                      label="Mobile"
                      value={profile.mobile}
                    />
                    <DetailItem
                      icon={<MapPin size={18} />}
                      label="Lives in"
                      value={profile.current_location}
                    />
                    <DetailItem
                      icon={<BookOpen size={18} />}
                      label="Education"
                      value={profile.school}
                    />
                    <DetailItem
                      icon={<Heart size={18} />}
                      label="Best Buddy"
                      value={profile.best_friend}
                    />
                    <DetailItem
                      icon={<Home size={18} />}
                      label="Village"
                      value={profile.village}
                    />
                  </div>
                )}
              </div>

              {/* Profile Tabs: Post, Friends, Pending, Blocked */}
              <div className="mt-10 px-6">
                <div className="flex bg-slate-100 p-2 rounded-3xl justify-between">
                  {["Posts", "Buddies", "Pending", "Hidden"].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveProfileTab(tab)}
                      className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase transition-all ${activeProfileTab === tab ? "bg-white text-blue-600 shadow-sm" : "text-slate-400"}`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className="mt-8 min-h-[300px] bg-slate-50/50 rounded-[2.5rem] p-6 border-2 border-dashed border-slate-100 flex items-center justify-center">
                  <p className="text-slate-300 font-black italic">
                    Displaying {activeProfileTab} Content...
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ⚙️ SETTINGS FEATURE ⚙️ */}
          {activeFeature === "Settings" && (
            <div className="px-2 space-y-6">
              {/* Previous Settings logic here... */}
              <h2 className="text-xl font-black text-slate-800 ml-4">
                App Controls
              </h2>
              {/* ... (Same as previous SettingItem block) */}
            </div>
          )}

          {/* Other Features */}
          {(activeFeature === "Post" || activeFeature === "Task") && (
            <MatchmakingSection />
          )}
        </AnimatePresence>
      </main>

      {/* Navigation Footer */}
      <div className="fixed bottom-0 left-0 w-full z-50 pointer-events-none">
        <div className="max-w-2xl mx-auto pointer-events-auto px-4">
          <GolSlider onFeatureChange={setActiveFeature} />
        </div>
      </div>
    </div>
  );
};

export default Index;
