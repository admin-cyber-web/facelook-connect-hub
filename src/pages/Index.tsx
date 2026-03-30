import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Session } from "@supabase/supabase-js";
import {
  Camera, Loader2, Lock, ChevronRight, ChevronLeft, LogOut,
  User, BookOpen, MapPin, Phone, Image as ImageIcon,
  MessageSquare, Send, X, Users, Palette, EyeOff, Ban,
  KeyRound, Globe, Languages, Save, Shield, CheckCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import Header from "@/components/Header";
import GolSlider from "@/components/GolSlider";
import ConnectionPanel from "@/components/ConnectionPanel";
import FameFeed from "@/components/FameFeed";
import FlicksFeed from "@/components/FlicksFeed";
import CreatePost from "@/components/CreatePost";

// ── Reusable styled blocks ───────────────────────────────────────────────────
const GlassCard = ({ children, className = "", noPadding = false }: any) => (
  <div className={`bg-white/10 backdrop-blur-2xl border-y sm:border border-white/10 shadow-lg w-full ${noPadding ? "p-0" : "p-4"} ${className}`}>
    {children}
  </div>
);

const SettingRow = ({ icon, title, desc, color, onClick, right }: any) => (
  <div
    onClick={onClick}
    className="flex items-center justify-between p-4 hover:bg-white/10 rounded-2xl cursor-pointer transition-all border border-transparent hover:border-white/10 group"
  >
    <div className="flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-white/20 backdrop-blur-md border border-white/10 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold text-white">{title}</p>
        <p className="text-[10px] text-white/50 font-medium uppercase tracking-tighter">{desc}</p>
      </div>
    </div>
    {right || <ChevronRight size={16} className="text-white/30 group-hover:text-white" />}
  </div>
);

// Simple pill toggle
const Toggle = ({ on, onToggle }: { on: boolean; onToggle: () => void }) => (
  <button
    onClick={(e) => { e.stopPropagation(); onToggle(); }}
    className={`relative w-12 h-6 rounded-full transition-all duration-300 border ${on ? "bg-blue-600 border-blue-500" : "bg-white/10 border-white/20"}`}
  >
    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${on ? "left-6" : "left-0.5"}`} />
  </button>
);

// ── Component ────────────────────────────────────────────────────────────────
const Index = ({ session }: { session: Session }) => {
  const userId = session.user.id;
  const userEmail = session.user.email || "";

  // Core UI
  const [activeFeature, setActiveFeature] = useState("Fame");
  const [isUploading, setIsUploading] = useState(false);
  const [isPostOpen, setIsPostOpen] = useState(false);
  const [showNav, setShowNav] = useState(true);
  const [bgImage, setBgImage] = useState(localStorage.getItem("facelook-bg") || "");
  const lastScrollY = useRef(0);

  // Chat
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");

  // Profile
  const [profile, setProfile] = useState({
    id: userId,
    full_name: "",
    username: "",
    avatar_url: "",
    bio: "",
    location: "",
    school: "",
    mobile: "",
    updated_at: "",
  });

  // Settings sub-views
  const [settingsView, setSettingsView] = useState<"main" | "personal" | "blocklist">("main");
  const [isSavingPersonal, setIsSavingPersonal] = useState(false);
  const [personalSaved, setPersonalSaved] = useState(false);
  const [personalForm, setPersonalForm] = useState({
    full_name: "", bio: "", school: "", mobile: "", location: "",
  });

  // Settings toggles
  const [lang, setLang] = useState<"en" | "hi">(
    (localStorage.getItem("facelook-lang") as "en" | "hi") || "en"
  );
  const [profileLocked, setProfileLocked] = useState(false);
  const [profileHidden, setProfileHidden] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // ── Fetch & realtime ────────────────────────────────────────────────────────
  useEffect(() => {
    fetchProfile();
    const handleScroll = () => {
      if (window.scrollY > lastScrollY.current && window.scrollY > 100) setShowNav(false);
      else setShowNav(true);
      lastScrollY.current = window.scrollY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!selectedUser) return;
    const channel = supabase.channel("chat-room").on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (payload) => {
        if (
          (payload.new.sender_id === userId && payload.new.receiver_id === selectedUser.id) ||
          (payload.new.sender_id === selectedUser.id && payload.new.receiver_id === userId)
        ) setChatMessages((prev) => [...prev, payload.new]);
      }
    ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedUser]);

  const fetchProfile = async () => {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();

    if (data) {
      // Existing profile — use DB values, but sync Google photo if still empty
      const meta = session.user.user_metadata ?? {};
      const merged = {
        ...data,
        avatar_url: data.avatar_url || meta.picture || meta.avatar_url || "",
        full_name: data.full_name || meta.full_name || meta.name || "",
      };
      setProfile((prev) => ({ ...prev, ...merged }));
      setPersonalForm({
        full_name: merged.full_name,
        bio: data.bio || "",
        school: data.school || "",
        mobile: data.mobile || "",
        location: data.location || "",
      });
      setProfileLocked(data.profile_locked || false);
      setProfileHidden(data.profile_hidden || false);

      // Silently patch missing avatar/name into DB
      if (!data.avatar_url || !data.full_name) {
        await supabase.from("profiles").update({
          avatar_url: merged.avatar_url,
          full_name: merged.full_name,
        }).eq("id", userId);
      }
    } else {
      // New Google user — create their profile row from OAuth metadata
      const meta = session.user.user_metadata ?? {};
      const newProfile = {
        id: userId,
        full_name: meta.full_name || meta.name || userEmail.split("@")[0],
        username: userEmail.split("@")[0],
        avatar_url: meta.picture || meta.avatar_url || "",
        bio: "",
        location: "",
        school: "",
        mobile: "",
        updated_at: new Date().toISOString(),
      };
      await supabase.from("profiles").upsert(newProfile);
      setProfile((prev) => ({ ...prev, ...newProfile }));
      setPersonalForm({
        full_name: newProfile.full_name,
        bio: "",
        school: "",
        mobile: "",
        location: "",
      });
    }
  };

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleThemeChange = (url: string) => {
    setBgImage(url);
    localStorage.setItem("facelook-bg", url);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedUser) return;
    const { error } = await supabase.from("messages").insert({
      sender_id: userId,
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
      const fileName = `${userId}-${Date.now()}.png`;
      await supabase.storage.from("avatars").upload(fileName, file);
      const publicUrl = supabase.storage.from("avatars").getPublicUrl(fileName).data.publicUrl;
      await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", userId);
      setProfile((prev) => ({ ...prev, avatar_url: publicUrl }));
    } catch {
      alert("Upload error!");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSavePersonalInfo = async () => {
    setIsSavingPersonal(true);
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      ...personalForm,
      updated_at: new Date().toISOString(),
    });
    if (!error) {
      setProfile((prev) => ({ ...prev, ...personalForm }));
      setPersonalSaved(true);
      setTimeout(() => { setPersonalSaved(false); setSettingsView("main"); }, 1200);
    }
    setIsSavingPersonal(false);
  };

  const handlePasswordReset = async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (!error) setResetSent(true);
    else alert("Error: " + error.message);
  };

  const toggleLang = () => {
    const next = lang === "en" ? "hi" : "en";
    setLang(next);
    localStorage.setItem("facelook-lang", next);
  };

  const handleToggleProfileLock = async () => {
    const next = !profileLocked;
    setProfileLocked(next);
    await supabase.from("profiles").update({ profile_locked: next }).eq("id", userId);
  };

  const handleToggleProfileHidden = async () => {
    const next = !profileHidden;
    setProfileHidden(next);
    await supabase.from("profiles").update({ profile_hidden: next }).eq("id", userId);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // ── Labels (language) ────────────────────────────────────────────────────
  const t = (en: string, hi: string) => lang === "hi" ? hi : en;

  // ── Settings: Personal Info sub-view ─────────────────────────────────────
  const PersonalInfoView = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3 px-4 pt-4">
        <button
          onClick={() => setSettingsView("main")}
          className="p-2 bg-white/5 rounded-xl border border-white/10 text-white/60 hover:text-white"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-sm font-black text-white">
          {t("Personal Info", "व्यक्तिगत जानकारी")}
        </p>
      </div>

      <GlassCard className="rounded-[2.5rem] p-6 space-y-4 border border-white/10">
        {[
          { key: "full_name", label: t("Full Name", "पूरा नाम"), placeholder: t("Your full name", "आपका नाम") },
          { key: "bio", label: t("Bio", "परिचय"), placeholder: t("Tell the world about you", "अपने बारे में लिखें") },
          { key: "school", label: t("School / College", "स्कूल / कॉलेज"), placeholder: t("Your school", "आपका स्कूल") },
          { key: "mobile", label: t("Mobile", "मोबाइल"), placeholder: "+92 300 0000000" },
          { key: "location", label: t("Location", "स्थान"), placeholder: t("City, Country", "शहर, देश") },
        ].map(({ key, label, placeholder }) => (
          <div key={key} className="space-y-1">
            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">{label}</p>
            <input
              type="text"
              placeholder={placeholder}
              value={(personalForm as any)[key]}
              onChange={(e) => setPersonalForm((prev) => ({ ...prev, [key]: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-white placeholder:text-white/20 outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
            />
          </div>
        ))}

        <button
          onClick={handleSavePersonalInfo}
          disabled={isSavingPersonal}
          className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {isSavingPersonal ? (
            <Loader2 size={16} className="animate-spin" />
          ) : personalSaved ? (
            <><CheckCircle size={16} /> {t("Saved!", "सहेजा!")}</>
          ) : (
            <><Save size={16} /> {t("Save Changes", "बदलाव सहेजें")}</>
          )}
        </button>
      </GlassCard>
    </div>
  );

  // ── Settings: Block List sub-view ─────────────────────────────────────────
  const BlockListView = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3 px-4 pt-4">
        <button
          onClick={() => setSettingsView("main")}
          className="p-2 bg-white/5 rounded-xl border border-white/10 text-white/60 hover:text-white"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-sm font-black text-white">{t("Blocked Users", "अवरुद्ध उपयोगकर्ता")}</p>
      </div>
      <GlassCard className="rounded-[2.5rem] p-6 border border-white/10">
        <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <Ban size={28} className="text-white/20" />
          </div>
          <p className="text-sm font-black text-white/30">
            {t("No Blocked Users", "कोई अवरुद्ध उपयोगकर्ता नहीं")}
          </p>
          <p className="text-xs text-white/20">
            {t(
              "Users you block will appear here.",
              "जिन उपयोगकर्ताओं को आप ब्लॉक करते हैं वे यहाँ दिखेंगे।"
            )}
          </p>
        </div>
      </GlassCard>
    </div>
  );

  // ── Settings: Main view ────────────────────────────────────────────────────
  const MainSettingsView = () => (
    <div className="space-y-4 px-4 sm:px-0">
      {/* Appearance */}
      <GlassCard className="rounded-[2.5rem] p-6 border border-white/10">
        <h2 className="text-xs font-black text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Palette size={14} /> {t("Appearance", "रूप")}
        </h2>
        <div className="grid grid-cols-5 gap-2">
          {[
            "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe",
            "https://images.unsplash.com/photo-1475275083424-b4ff81625b60",
            "https://images.unsplash.com/photo-1531306728370-e2ebd9d7bb99",
            "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
          ].map((url, i) => (
            <button
              key={i}
              onClick={() => handleThemeChange(url)}
              className={`h-14 rounded-2xl overflow-hidden border-2 transition-all ${bgImage === url ? "border-blue-500 scale-90" : "border-transparent opacity-60 hover:opacity-100"}`}
            >
              <img src={url} className="w-full h-full object-cover" />
            </button>
          ))}
          <button
            onClick={() => handleThemeChange("")}
            className={`h-14 rounded-2xl bg-slate-800 text-[9px] text-white font-black uppercase border-2 transition-all ${!bgImage ? "border-blue-500" : "border-transparent"}`}
          >
            {t("None", "कोई नहीं")}
          </button>
        </div>
      </GlassCard>

      {/* Personal Info */}
      <GlassCard className="rounded-[2.5rem] p-2 border border-white/10">
        <SettingRow
          icon={<User size={18} />}
          title={t("Personal Info", "व्यक्तिगत जानकारी")}
          desc={t("Name, Bio, School, Mobile", "नाम, परिचय, स्कूल, मोबाइल")}
          color="text-blue-400"
          onClick={() => setSettingsView("personal")}
        />
      </GlassCard>

      {/* Security */}
      <GlassCard className="rounded-[2.5rem] p-2 border border-white/10">
        <h2 className="text-[10px] font-black text-white/30 uppercase tracking-widest px-4 pt-3 pb-1 flex items-center gap-2">
          <Shield size={12} /> {t("Security", "सुरक्षा")}
        </h2>
        <SettingRow
          icon={<KeyRound size={18} />}
          title={t("Reset Password", "पासवर्ड रीसेट करें")}
          desc={resetSent ? t("Email sent! Check inbox", "ईमेल भेज दिया!") : t("Send reset link to email", "ईमेल पर लिंक भेजें")}
          color={resetSent ? "text-green-400" : "text-orange-400"}
          onClick={resetSent ? undefined : handlePasswordReset}
          right={resetSent ? <CheckCircle size={16} className="text-green-400" /> : undefined}
        />
      </GlassCard>

      {/* Language */}
      <GlassCard className="rounded-[2.5rem] p-2 border border-white/10">
        <SettingRow
          icon={<Languages size={18} />}
          title={t("Language", "भाषा")}
          desc={lang === "en" ? "English (Active)" : "हिंदी (सक्रिय)"}
          color="text-purple-400"
          onClick={toggleLang}
          right={
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black ${lang === "en" ? "text-white" : "text-white/30"}`}>EN</span>
              <Toggle on={lang === "hi"} onToggle={toggleLang} />
              <span className={`text-[10px] font-black ${lang === "hi" ? "text-white" : "text-white/30"}`}>HI</span>
            </div>
          }
        />
      </GlassCard>

      {/* Privacy Controls */}
      <GlassCard className="rounded-[2.5rem] p-2 border border-white/10">
        <h2 className="text-[10px] font-black text-white/30 uppercase tracking-widest px-4 pt-3 pb-1 flex items-center gap-2">
          <EyeOff size={12} /> {t("Privacy Controls", "गोपनीयता")}
        </h2>
        <SettingRow
          icon={<Lock size={18} />}
          title={t("Profile Lock", "प्रोफ़ाइल लॉक")}
          desc={profileLocked ? t("Profile is locked", "लॉक है") : t("Anyone can view your profile", "सभी देख सकते हैं")}
          color="text-yellow-400"
          onClick={handleToggleProfileLock}
          right={<Toggle on={profileLocked} onToggle={handleToggleProfileLock} />}
        />
        <SettingRow
          icon={<EyeOff size={18} />}
          title={t("Hide Profile", "प्रोफ़ाइल छुपाएं")}
          desc={profileHidden ? t("Hidden from discovery", "खोज से छुपाया") : t("Visible in search", "खोज में दिखता है")}
          color="text-red-400"
          onClick={handleToggleProfileHidden}
          right={<Toggle on={profileHidden} onToggle={handleToggleProfileHidden} />}
        />
      </GlassCard>

      {/* Block List */}
      <GlassCard className="rounded-[2.5rem] p-2 border border-white/10">
        <SettingRow
          icon={<Ban size={18} />}
          title={t("Blocked Users", "अवरुद्ध उपयोगकर्ता")}
          desc={t("Manage your block list", "ब्लॉक सूची प्रबंधित करें")}
          color="text-slate-400"
          onClick={() => setSettingsView("blocklist")}
        />
      </GlassCard>

      {/* Privacy Policy */}
      <GlassCard className="rounded-[2.5rem] p-2 border border-white/10">
        <SettingRow
          icon={<Globe size={18} />}
          title={t("Privacy Policy", "गोपनीयता नीति")}
          desc={t("Facelook Connect Hub", "फेसलुक कनेक्ट हब")}
          color="text-blue-300"
          onClick={() => window.open("/privacy", "_blank")}
        />
      </GlassCard>

      {/* Logout */}
      <div className="px-0">
        <button
          onClick={handleLogout}
          className="w-full py-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-2xl font-black text-xs uppercase tracking-widest border border-red-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
        >
          <LogOut size={16} /> {t("Sign Out", "साइन आउट")}
        </button>
      </div>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen w-full bg-[#020617] bg-cover bg-center bg-fixed transition-all duration-700 relative overflow-x-hidden"
      style={{ backgroundImage: bgImage ? `url('${bgImage}')` : "none" }}
      onClick={() => setShowNav(true)}
    >
      {/* Overlay */}
      <div className={`fixed inset-0 ${bgImage ? "bg-slate-900/50 backdrop-blur-[2px]" : "bg-transparent"} pointer-events-none`} />

      {activeFeature !== "Flicks" && (
        <Header onProfileClick={() => setActiveFeature("Face")} userId={userId} />
      )}

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
            {/* 1. FAME ─────────────────────────────────────────────────────── */}
            {activeFeature === "Fame" && (
              <div className="flex flex-col gap-0">
                <ConnectionPanel />
                <div
                  className="bg-white/5 backdrop-blur-xl p-4 flex items-center gap-4 border-b border-white/10 active:bg-white/10 cursor-pointer"
                  onClick={() => setIsPostOpen(true)}
                >
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} className="w-11 h-11 rounded-full object-cover border-2 border-blue-500/30" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-blue-600 border-2 border-blue-500/30 flex items-center justify-center text-white font-black text-sm">
                      {profile.full_name?.[0] || "U"}
                    </div>
                  )}
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

            {/* 2. FACE ─────────────────────────────────────────────────────── */}
            {activeFeature === "Face" && (
              <div className="space-y-4">
                <GlassCard className="sm:rounded-[3rem] p-6 overflow-hidden relative border-x-0 sm:border-x">
                  <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-blue-600/40 to-purple-600/40" />
                  <div className="relative z-10 flex flex-col items-center mt-6">
                    <div className="w-28 h-28 rounded-[2.2rem] bg-white/20 p-1 backdrop-blur-md relative shadow-2xl">
                      {profile.avatar_url ? (
                        <img src={profile.avatar_url} className="w-full h-full object-cover rounded-[1.8rem]" />
                      ) : (
                        <div className="w-full h-full rounded-[1.8rem] bg-blue-600 flex items-center justify-center text-white font-black text-4xl">
                          {profile.full_name?.[0] || "U"}
                        </div>
                      )}
                      <label className="absolute bottom-0 right-0 bg-blue-600 p-2 rounded-xl text-white shadow-lg cursor-pointer">
                        {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                        <input type="file" hidden accept="image/*" onChange={handleAvatarUpload} />
                      </label>
                    </div>
                    <h2 className="text-2xl font-black text-white mt-4 tracking-tight">
                      {profile.full_name || userEmail.split("@")[0]}
                    </h2>
                    <p className="text-blue-400 font-bold text-[10px] uppercase tracking-widest">
                      @{profile.username || userEmail.split("@")[0]}
                    </p>
                  </div>

                  {profile.bio && (
                    <div className="mt-4 border-t border-white/10 pt-4">
                      <p className="text-xs text-white/60 text-center leading-relaxed">{profile.bio}</p>
                    </div>
                  )}
                </GlassCard>

                <div className="grid grid-cols-2 gap-2">
                  <GlassCard className="rounded-3xl flex items-center gap-3">
                    <MapPin size={18} className="text-blue-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[8px] font-black text-white/40 uppercase">Location</p>
                      <p className="text-xs font-bold text-white truncate">{profile.location || "Not Set"}</p>
                    </div>
                  </GlassCard>
                  <GlassCard className="rounded-3xl flex items-center gap-3">
                    <BookOpen size={18} className="text-purple-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[8px] font-black text-white/40 uppercase">School</p>
                      <p className="text-xs font-bold text-white truncate">{profile.school || "Not Set"}</p>
                    </div>
                  </GlassCard>
                  <GlassCard className="rounded-3xl flex items-center gap-3 col-span-2">
                    <Phone size={18} className="text-green-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[8px] font-black text-white/40 uppercase">Mobile</p>
                      <p className="text-xs font-bold text-white truncate">{profile.mobile || "Not Set"}</p>
                    </div>
                  </GlassCard>
                </div>
              </div>
            )}

            {/* 3. FLICKS ───────────────────────────────────────────────────── */}
            {activeFeature === "Flicks" && (
              <div className="fixed inset-0 z-[300] bg-black">
                <FlicksFeed />
              </div>
            )}

            {/* 4. SETTINGS ─────────────────────────────────────────────────── */}
            {activeFeature === "Settings" && (
              <AnimatePresence mode="wait">
                {settingsView === "main" && (
                  <motion.div key="main" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <MainSettingsView />
                  </motion.div>
                )}
                {settingsView === "personal" && (
                  <motion.div key="personal" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <PersonalInfoView />
                  </motion.div>
                )}
                {settingsView === "blocklist" && (
                  <motion.div key="blocklist" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <BlockListView />
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Chat Overlay ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            className="fixed inset-x-0 bottom-0 z-[150] bg-slate-900/90 backdrop-blur-3xl h-[85vh] sm:h-[600px] sm:w-[400px] sm:right-6 sm:left-auto sm:bottom-6 rounded-t-[3rem] sm:rounded-[3rem] shadow-2xl flex flex-col overflow-hidden border border-white/10"
          >
            <div className="p-6 bg-white/5 border-b border-white/10 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users size={20} />
                <p className="font-black text-sm">{selectedUser ? selectedUser.full_name : "Messenger"}</p>
              </div>
              <button onClick={() => { setIsChatOpen(false); setSelectedUser(null); }}>
                <X size={22} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {!selectedUser ? (
                <div
                  onClick={() => setSelectedUser({ id: "dummy", full_name: "Rahul Kumar" })}
                  className="bg-white/5 p-4 rounded-2xl flex items-center gap-4 cursor-pointer hover:bg-white/10 transition-colors"
                >
                  <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center font-bold text-blue-400">R</div>
                  <div className="flex-1">
                    <p className="text-sm font-black text-white">Rahul Kumar</p>
                    <p className="text-[10px] text-white/40">Active Now</p>
                  </div>
                </div>
              ) : (
                chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.sender_id === userId ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] p-4 rounded-[1.8rem] text-sm font-bold ${msg.sender_id === userId ? "bg-blue-600 text-white rounded-tr-none" : "bg-white/10 text-white border border-white/10 rounded-tl-none"}`}>
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
                <button onClick={sendMessage} className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center">
                  <Send size={18} />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat FAB ──────────────────────────────────────────────────────────── */}
      <motion.button
        animate={{ y: showNav && activeFeature !== "Flicks" ? 0 : 150, opacity: showNav ? 1 : 0 }}
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-32 right-6 w-16 h-16 bg-blue-600 rounded-full shadow-2xl flex items-center justify-center z-[80] border-2 border-white/20 active:scale-90"
      >
        <MessageSquare size={28} fill="currentColor" />
        <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full border-2 border-white text-[10px] font-black flex items-center justify-center animate-bounce">3</span>
      </motion.button>

      {/* Bottom Nav ────────────────────────────────────────────────────────── */}
      <motion.div
        animate={{ y: showNav && activeFeature !== "Flicks" ? 0 : 120 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
        className="fixed bottom-0 left-0 w-full z-[200] pb-6 px-4 pointer-events-none"
      >
        <div className="max-w-md mx-auto pointer-events-auto">
          <div className="bg-slate-900/60 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-1.5 shadow-2xl">
            <GolSlider onFeatureChange={(f) => { setActiveFeature(f); setSettingsView("main"); }} />
          </div>
        </div>
      </motion.div>

      <CreatePost isOpen={isPostOpen} onClose={() => setIsPostOpen(false)} userProfile={profile} />
    </div>
  );
};

export default Index;
