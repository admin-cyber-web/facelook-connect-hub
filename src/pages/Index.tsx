import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Session } from "@supabase/supabase-js";
import {
  Camera,
  Loader2,
  Lock,
  ChevronRight,
  ChevronLeft,
  LogOut,
  User,
  BookOpen,
  MapPin,
  Phone,
  MessageSquare,
  Palette,
  EyeOff,
  Ban,
  KeyRound,
  Globe,
  Languages,
  Save,
  Shield,
  CheckCircle,
  Video,
  PhoneCall,
  ArrowLeft,
  Heart,
  AlertTriangle,
  Star,
  Handshake,
} from "lucide-react";

// DHAYAN DEIN: Sirf ye ek supabase import rehna chahiye
import { supabase } from "@/lib/supabaseClient";

import Header from "@/components/Header";
import GolSlider from "@/components/GolSlider";
import FameFeed from "@/components/FameFeed";
import FlicksFeed from "@/components/FlicksFeed";
import CreatePost from "@/components/CreatePost";
import ChatSystem from "@/components/ChatSystem";
import SnapyStudio from "@/components/SnapyStudio";
import MovieGame from "@/components/MovieGame";
// ── Reusable styled blocks ───────────────────────────────────────────────────
const GlassCard = ({ children, className = "", noPadding = false }: any) => (
  <div
    className={`bg-white/10 backdrop-blur-2xl border-y sm:border border-white/10 shadow-lg w-full ${noPadding ? "p-0" : "p-4"} ${className}`}
  >
    {children}
  </div>
);

const SettingRow = ({ icon, title, desc, color, onClick, right }: any) => (
  <div
    onClick={onClick}
    className="flex items-center justify-between p-4 hover:bg-white/10 rounded-2xl cursor-pointer transition-all border border-transparent hover:border-white/10 group"
  >
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
    {right || (
      <ChevronRight
        size={16}
        className="text-white/30 group-hover:text-white"
      />
    )}
  </div>
);

// Simple pill toggle
const Toggle = ({ on, onToggle }: { on: boolean; onToggle: () => void }) => (
  <button
    onClick={(e) => {
      e.stopPropagation();
      onToggle();
    }}
    className={`relative w-12 h-6 rounded-full transition-all duration-300 border ${on ? "bg-blue-600 border-blue-500" : "bg-white/10 border-white/20"}`}
  >
    <div
      className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${on ? "left-6" : "left-0.5"}`}
    />
  </button>
);

// ── Video Call avatar colours (fallback when no photo) ───────────────────────
const AVATAR_COLORS = [
  "from-violet-600 to-purple-700",
  "from-blue-600 to-cyan-500",
  "from-pink-600 to-rose-500",
  "from-emerald-600 to-teal-500",
];

// ── Mock Help Feed data for Frame Mode ────────────────────────────────────────
const HELP_POSTS = [
  { id: 1, user: "Riya S.", initials: "RS", category: "Education", need: "12th class ki books chahiye, ghar mein afford nahi ho pata 📚", time: "2h ago", helpers: 3 },
  { id: 2, user: "Mohammed K.", initials: "MK", category: "Health", need: "Dawai ke liye paise nahi hain, koi madad kar sakta hai? 🤝", time: "5h ago", helpers: 7 },
  { id: 3, user: "Priya M.", initials: "PM", category: "Career", need: "Job ki talash mein hoon, koi referral dega? 🙏", time: "1d ago", helpers: 2 },
  { id: 4, user: "Arjun T.", initials: "AT", category: "Food", need: "Aaj khaana nahi tha, koi help karega? Bahut zaroorat hai 🍱", time: "3h ago", helpers: 5 },
];

const HEROES = [
  { initials: "SA", color: "from-amber-500 to-yellow-400", helped: 12 },
  { initials: "NJ", color: "from-orange-500 to-red-400",  helped: 9  },
  { initials: "PK", color: "from-yellow-500 to-amber-400", helped: 6  },
];

const CAT_COLORS: Record<string, string> = {
  Education: "bg-blue-100 text-blue-700",
  Health:    "bg-green-100 text-green-700",
  Career:    "bg-purple-100 text-purple-700",
  Food:      "bg-orange-100 text-orange-700",
};

// ── Frame Mode full-screen view ────────────────────────────────────────────────
function FrameModePage({ onBack, userProfile }: { onBack: () => void; userProfile: any }) {
  const [reportOpen, setReportOpen] = useState(false);
  const [helped, setHelped] = useState<Set<number>>(new Set());

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-amber-50 via-white to-amber-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-xl border-b-2 border-amber-300/60 px-4 py-3 flex items-center gap-3 shadow-sm">
        <button
          onClick={onBack}
          className="p-2 rounded-xl bg-amber-100 border border-amber-200 text-amber-700 active:scale-95 transition-all"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <span className="text-2xl">🤲</span>
          <div>
            <p className="text-sm font-black text-amber-900 leading-none">FACELOOK FRAME</p>
            <p className="text-[10px] text-amber-600 font-semibold">Ab Har Zarooratmand Hoga Frame</p>
          </div>
        </div>
        <button
          onClick={() => setReportOpen(!reportOpen)}
          className="flex items-center gap-1 px-3 py-2 rounded-xl bg-red-100 border border-red-200 text-red-600 text-xs font-black active:scale-95"
        >
          <AlertTriangle size={14} /> Report
        </button>
      </div>

      {reportOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-4 p-4 rounded-2xl bg-red-50 border-2 border-red-200"
        >
          <p className="text-sm font-bold text-red-800 mb-2">🚨 Report an Issue</p>
          <textarea
            placeholder="Kya problem hai? Describe karein..."
            className="w-full bg-white border border-red-200 rounded-xl px-3 py-2 text-sm text-red-900 placeholder:text-red-300 outline-none resize-none"
            rows={3}
          />
          <button
            onClick={() => setReportOpen(false)}
            className="mt-2 w-full py-2 rounded-xl bg-red-500 text-white font-black text-xs"
          >
            Submit Report
          </button>
        </motion.div>
      )}

      {/* Hero Wall */}
      <div className="px-4 pt-5 pb-3">
        <p className="text-xs font-black text-amber-700 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Star size={12} fill="currentColor" /> Hero Wall — Top Helpers
        </p>
        <div className="flex gap-3">
          {HEROES.map((h, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${h.color} flex items-center justify-center text-white font-black text-lg border-4 border-amber-300 shadow-md`}>
                {h.initials}
              </div>
              <p className="text-[10px] font-bold text-amber-700">{h.helped} helped</p>
            </div>
          ))}
          <div className="flex flex-col items-center gap-1 justify-center">
            <div className="w-14 h-14 rounded-full bg-amber-100 border-4 border-dashed border-amber-300 flex items-center justify-center">
              <span className="text-amber-400 text-xl font-black">+</span>
            </div>
            <p className="text-[10px] font-bold text-amber-500">Be a Hero</p>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px mx-4 bg-amber-200 my-2" />

      {/* Help Feed */}
      <div className="px-4 pb-8 space-y-3 pt-2">
        <p className="text-xs font-black text-amber-700 uppercase tracking-widest flex items-center gap-2">
          <Handshake size={12} /> Help Feed — Zarooratmand Log
        </p>
        {HELP_POSTS.map((post) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl border-2 border-amber-100 shadow-sm overflow-hidden"
          >
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-black text-sm border-2 border-amber-200">
                  {post.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-gray-900 truncate">{post.user}</p>
                  <p className="text-[10px] text-gray-400">{post.time}</p>
                </div>
                <span className={`text-[10px] font-black px-2 py-1 rounded-full ${CAT_COLORS[post.category] || "bg-gray-100 text-gray-600"}`}>
                  {post.category}
                </span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{post.need}</p>
            </div>
            <div className="px-4 pb-3 flex items-center justify-between border-t border-amber-50 pt-3">
              <span className="text-[11px] text-amber-600 font-bold">{post.helpers} log madad kar rahe hain</span>
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => setHelped(prev => { const s = new Set(prev); s.has(post.id) ? s.delete(post.id) : s.add(post.id); return s; })}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all ${helped.has(post.id) ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-700 border border-amber-200"}`}
              >
                <Heart size={13} fill={helped.has(post.id) ? "white" : "none"} />
                {helped.has(post.id) ? "Helped ✓" : "I'll Help"}
              </motion.button>
            </div>
          </motion.div>
        ))}

        {/* CTA Card */}
        <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-3xl p-5 text-white text-center shadow-lg">
          <p className="text-2xl mb-1">🌟</p>
          <p className="font-black text-sm">Aap bhi kisi ki madad kar sakte hain</p>
          <p className="text-xs text-white/80 mt-1">Frame Mode mein share karein apni zaroorat ya kisi ki zaroorat poori karein</p>
        </div>
      </div>
    </div>
  );
}

// ── Personal Info sub-view (outside Index to prevent focus loss) ──────────────
interface PersonalInfoViewProps {
  lang: "en" | "hi";
  setSettingsView: (v: "main" | "personal" | "blocklist") => void;
  personalForm: { full_name: string; bio: string; school: string; mobile: string; location: string };
  setPersonalForm: React.Dispatch<React.SetStateAction<{ full_name: string; bio: string; school: string; mobile: string; location: string }>>;
  isSavingPersonal: boolean;
  personalSaved: boolean;
  handleSavePersonalInfo: () => void;
}

const PersonalInfoView = React.memo(({
  lang,
  setSettingsView,
  personalForm,
  setPersonalForm,
  isSavingPersonal,
  personalSaved,
  handleSavePersonalInfo,
}: PersonalInfoViewProps) => {
  const t = (en: string, hi: string) => (lang === "hi" ? hi : en);
  return (
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
          {
            key: "full_name",
            label: t("Full Name", "पूरा नाम"),
            placeholder: t("Your full name", "आपका नाम"),
          },
          {
            key: "bio",
            label: t("Bio", "परिचय"),
            placeholder: t("Tell the world about you", "अपने बारे में लिखें"),
          },
          {
            key: "school",
            label: t("School / College", "स्कूल / कॉलेज"),
            placeholder: t("Your school", "आपका स्कूल"),
          },
          {
            key: "mobile",
            label: t("Mobile", "मोबाइल"),
            placeholder: "+92 300 0000000",
          },
          {
            key: "location",
            label: t("Location", "स्थान"),
            placeholder: t("City, Country", "शहर, देश"),
          },
        ].map(({ key, label, placeholder }) => (
          <div key={key} className="space-y-1">
            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">
              {label}
            </p>
            <input
              type="text"
              placeholder={placeholder}
              value={(personalForm as any)[key]}
              onChange={(e) =>
                setPersonalForm((prev) => ({ ...prev, [key]: e.target.value }))
              }
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
            <>
              <CheckCircle size={16} /> {t("Saved!", "सहेजा!")}
            </>
          ) : (
            <>
              <Save size={16} /> {t("Save Changes", "बदलाव सहेजें")}
            </>
          )}
        </button>
      </GlassCard>
    </div>
  );
});

// ── Component ────────────────────────────────────────────────────────────────
const Index = ({ session }: { session: Session }) => {
  const userId = session.user.id;
  const userEmail = session.user.email || "";

  // Core UI
  const [activeFeature, setActiveFeature] = useState("Fame");
  const [isUploading, setIsUploading] = useState(false);
  const [isPostOpen, setIsPostOpen] = useState(false);
  const [showNav, setShowNav] = useState(true);
  const [bgImage, setBgImage] = useState(
    localStorage.getItem("facelook-bg") || "",
  );
  const lastScrollY = useRef(0);

  // Chat
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Frame Mode
  const [isFrameMode, setIsFrameMode] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<{ id: string; full_name: string; avatar_url: string }[]>([]);

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
  const [settingsView, setSettingsView] = useState<
    "main" | "personal" | "blocklist"
  >("main");
  const [isSavingPersonal, setIsSavingPersonal] = useState(false);
  const [personalSaved, setPersonalSaved] = useState(false);
  const [personalForm, setPersonalForm] = useState({
    full_name: "",
    bio: "",
    school: "",
    mobile: "",
    location: "",
  });

  // Settings toggles
  const [lang, setLang] = useState<"en" | "hi">(
    (localStorage.getItem("facelook-lang") as "en" | "hi") || "en",
  );
  const [profileLocked, setProfileLocked] = useState(false);
  const [profileHidden, setProfileHidden] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // ── Fetch online users for Video Call section ─────────────────────────────
  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .neq("id", userId)
      .limit(3)
      .then(({ data }) => { if (data) setOnlineUsers(data); });
  }, [userId]);

  // ── Fetch & Realtime (Updated for Auto-Refresh) ──────────────────────────────
  useEffect(() => {
    // 1. Pehli baar profile load karo
    fetchProfile();

    // 2. Auth Listener: Jaise hi login ho, bina refresh profile update ho jaye
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        fetchProfile();
      }
    });

    // 3. Scroll logic for Navbar
    const handleScroll = () => {
      if (window.scrollY > lastScrollY.current && window.scrollY > 100)
        setShowNav(false);
      else setShowNav(true);
      lastScrollY.current = window.scrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      subscription.unsubscribe(); // Subscription band karna zaroori hai
    };
  }, [userId]);


  // Yahan se fetchProfile shuru ho raha hai
  const fetchProfile = async () => {
    // ── Fetch profile row from DB first ──────────────────────────────────
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

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
        await supabase
          .from("profiles")
          .update({
            avatar_url: merged.avatar_url,
            full_name: merged.full_name,
          })
          .eq("id", userId);
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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const fileName = `${userId}-${Date.now()}.png`;
      await supabase.storage.from("avatars").upload(fileName, file);
      const publicUrl = supabase.storage.from("avatars").getPublicUrl(fileName)
        .data.publicUrl;
      await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", userId);
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
      setTimeout(() => {
        setPersonalSaved(false);
        setSettingsView("main");
      }, 1200);
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
    await supabase
      .from("profiles")
      .update({ profile_locked: next })
      .eq("id", userId);
  };

  const handleToggleProfileHidden = async () => {
    const next = !profileHidden;
    setProfileHidden(next);
    await supabase
      .from("profiles")
      .update({ profile_hidden: next })
      .eq("id", userId);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // ── Labels (language) ────────────────────────────────────────────────────
  const t = (en: string, hi: string) => (lang === "hi" ? hi : en);


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
        <p className="text-sm font-black text-white">
          {t("Blocked Users", "अवरुद्ध उपयोगकर्ता")}
        </p>
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
              "जिन उपयोगकर्ताओं को आप ब्लॉक करते हैं वे यहाँ दिखेंगे।",
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
          desc={
            resetSent
              ? t("Email sent! Check inbox", "ईमेल भेज दिया!")
              : t("Send reset link to email", "ईमेल पर लिंक भेजें")
          }
          color={resetSent ? "text-green-400" : "text-orange-400"}
          onClick={resetSent ? undefined : handlePasswordReset}
          right={
            resetSent ? (
              <CheckCircle size={16} className="text-green-400" />
            ) : undefined
          }
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
              <span
                className={`text-[10px] font-black ${lang === "en" ? "text-white" : "text-white/30"}`}
              >
                EN
              </span>
              <Toggle on={lang === "hi"} onToggle={toggleLang} />
              <span
                className={`text-[10px] font-black ${lang === "hi" ? "text-white" : "text-white/30"}`}
              >
                HI
              </span>
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
          desc={
            profileLocked
              ? t("Profile is locked", "लॉक है")
              : t("Anyone can view your profile", "सभी देख सकते हैं")
          }
          color="text-yellow-400"
          onClick={handleToggleProfileLock}
          right={
            <Toggle on={profileLocked} onToggle={handleToggleProfileLock} />
          }
        />
        <SettingRow
          icon={<EyeOff size={18} />}
          title={t("Hide Profile", "प्रोफ़ाइल छुपाएं")}
          desc={
            profileHidden
              ? t("Hidden from discovery", "खोज से छुपाया")
              : t("Visible in search", "खोज में दिखता है")
          }
          color="text-red-400"
          onClick={handleToggleProfileHidden}
          right={
            <Toggle on={profileHidden} onToggle={handleToggleProfileHidden} />
          }
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
      <div
        className={`fixed inset-0 ${bgImage ? "bg-slate-900/50 backdrop-blur-[2px]" : "bg-transparent"} pointer-events-none`}
      />

      {/* ── Frame Mode overlay (slides in from right, covers everything) ──── */}
      <AnimatePresence>
        {isFrameMode && (
          <motion.div
            key="framemode"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed inset-0 z-[9999] overflow-hidden"
          >
            <FrameModePage onBack={() => setIsFrameMode(false)} userProfile={profile} />
          </motion.div>
        )}
      </AnimatePresence>

      {activeFeature !== "Flicks" && (
        <Header
          onProfileClick={() => setActiveFeature("Face")}
          userId={userId}
        />
      )}

      <main
        className={`relative z-10 transition-all duration-500 
          ${activeFeature === "Flicks" ? "pt-0 pb-0" : "pt-0 pb-40"} 
          ${activeFeature === "Flicks" ? "w-full" : "max-w-2xl mx-auto px-0 sm:px-0"}`}
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
              <div className="w-full overflow-y-auto">

                {/* ── Video Call Section ─────────────────────────────────── */}
                <div className="w-full px-4 pt-4 pb-3">
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-3">Live Online</p>
                  <div className="flex gap-4 overflow-x-auto pb-1 no-scrollbar">
                    {/* Current user */}
                    {[{ id: userId, full_name: profile.full_name || "You", avatar_url: profile.avatar_url }, ...onlineUsers].slice(0, 4).map((u, i) => (
                      <div key={u.id} className="flex flex-col items-center gap-1.5 shrink-0">
                        <div className="relative">
                          <div className={`w-16 h-16 rounded-full border-[3px] border-violet-500/60 shadow-lg shadow-violet-900/30 overflow-hidden bg-gradient-to-br ${AVATAR_COLORS[i % 4]}`}>
                            {u.avatar_url ? (
                              <img src={u.avatar_url} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-white font-black text-xl">
                                {(u.full_name || "U")[0].toUpperCase()}
                              </div>
                            )}
                          </div>
                          <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-green-400 border-2 border-[#07001a] shadow" />
                        </div>
                        <p className="text-[10px] font-bold text-white/70 text-center max-w-[60px] truncate">
                          {i === 0 ? "You" : u.full_name?.split(" ")[0] || "User"}
                        </p>
                      </div>
                    ))}
                    {/* Pad with placeholders if < 4 */}
                    {Array.from({ length: Math.max(0, 4 - Math.min(4, 1 + onlineUsers.length)) }).map((_, i) => (
                      <div key={`pad-${i}`} className="flex flex-col items-center gap-1.5 shrink-0">
                        <div className="relative">
                          <div className={`w-16 h-16 rounded-full border-[3px] border-white/10 shadow-lg overflow-hidden bg-gradient-to-br ${AVATAR_COLORS[(1 + onlineUsers.length + i) % 4]}`}>
                            <div className="w-full h-full flex items-center justify-center text-white/40 font-black text-xl">?</div>
                          </div>
                          <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-gray-500 border-2 border-[#07001a]" />
                        </div>
                        <p className="text-[10px] font-bold text-white/30 text-center">Offline</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Facelook Fun Call Button ────────────────────────────── */}
                <div className="w-full px-4 pb-4">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setIsChatOpen(true)}
                    className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-gradient-to-r from-violet-700 to-purple-800 border border-violet-500/30 shadow-xl shadow-purple-900/40 active:scale-95 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                        <Video size={20} className="text-white" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-black text-white tracking-wide">FACELOOK FUN CALL</p>
                        <p className="text-[10px] text-violet-300">Dosto ke saath jodo</p>
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                      <PhoneCall size={20} className="text-green-400" />
                    </div>
                  </motion.button>
                </div>

                {/* ── Facelook Frame Gateway ──────────────────────────────── */}
                <div className="w-full border-t-2 border-b-2 border-amber-500/30 bg-gradient-to-r from-[#1a0a00]/80 via-[#2a1500]/60 to-[#1a0a00]/80 backdrop-blur-xl py-5 px-6 relative overflow-hidden">
                  {/* Golden halo glow */}
                  <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 via-transparent to-amber-500/5 pointer-events-none" />
                  <div className="absolute -top-px left-0 w-full h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
                  <div className="absolute -bottom-px left-0 w-full h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />

                  <div className="flex items-center gap-5 relative z-10">
                    {/* Icon side */}
                    <div className="text-5xl shrink-0 drop-shadow-lg select-none">🤲✨</div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black text-amber-500/70 uppercase tracking-widest mb-0.5">Premium Gateway</p>
                      <p className="text-lg font-black bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-400 bg-clip-text text-transparent leading-tight">
                        FACELOOK FRAME
                      </p>
                      <p className="text-[11px] text-amber-200/60 font-semibold mt-0.5 leading-snug">
                        Ab Har Zarooratmand Hoga Frame
                      </p>
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setIsFrameMode(true)}
                        className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-black text-[11px] uppercase tracking-wider shadow-lg shadow-amber-900/40 active:scale-95 transition-all"
                      >
                        <Star size={13} fill="black" />
                        ENTER FRAME MODE
                      </motion.button>
                    </div>
                  </div>
                </div>

                {/* ── Normal Fame Feed ────────────────────────────────────── */}
                <FameFeed
                  onPostClick={() => setIsPostOpen(true)}
                  userProfile={profile}
                />
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
                        <img
                          src={profile.avatar_url}
                          className="w-full h-full object-cover rounded-[1.8rem]"
                        />
                      ) : (
                        <div className="w-full h-full rounded-[1.8rem] bg-blue-600 flex items-center justify-center text-white font-black text-4xl">
                          {profile.full_name?.[0] || "U"}
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
                    <h2 className="text-2xl font-black text-white mt-4 tracking-tight">
                      {profile.full_name || userEmail.split("@")[0]}
                    </h2>
                    <p className="text-blue-400 font-bold text-[10px] uppercase tracking-widest">
                      @{profile.username || userEmail.split("@")[0]}
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

            {/* 3. FLICKS ───────────────────────────────────────────────────── */}
            {activeFeature === "Flicks" && (
              <div className="fixed inset-0 z-[300] bg-black">
                <FlicksFeed />
              </div>
            )}

            {/* 4. SNAPY ────────────────────────────────────────────────────── */}
            {activeFeature === "Snapy" && (
              <SnapyStudio userId={userId} />
            )}

            {/* 5. TASK (Movie Game) ────────────────────────────────────────── */}
            {activeFeature === "Task" && (
              <MovieGame
                userId={userId}
                userProfile={profile}
              />
            )}

            {/* 6. SETTINGS ─────────────────────────────────────────────────── */}
            {activeFeature === "Settings" && (
              <AnimatePresence mode="wait">
                {settingsView === "main" && (
                  <motion.div
                    key="main"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <MainSettingsView />
                  </motion.div>
                )}
                {settingsView === "personal" && (
                  <motion.div
                    key="personal"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <PersonalInfoView
                      lang={lang}
                      setSettingsView={setSettingsView}
                      personalForm={personalForm}
                      setPersonalForm={setPersonalForm}
                      isSavingPersonal={isSavingPersonal}
                      personalSaved={personalSaved}
                      handleSavePersonalInfo={handleSavePersonalInfo}
                    />
                  </motion.div>
                )}
                {settingsView === "blocklist" && (
                  <motion.div
                    key="blocklist"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <BlockListView />
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Chat System ───────────────────────────────────────────────────────── */}
      <ChatSystem
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        userId={userId}
      />

      {/* Chat FAB ──────────────────────────────────────────────────────────── */}
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

      {/* Bottom Nav ────────────────────────────────────────────────────────── */}
      <motion.div
        animate={{ y: showNav && activeFeature !== "Flicks" ? 0 : 120 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
        className="fixed bottom-0 left-0 w-full z-[200] pb-7 px-3 pointer-events-none"
      >
        <div className="max-w-md mx-auto pointer-events-auto">
          <GolSlider
            onFeatureChange={(f) => {
              setActiveFeature(f);
              setSettingsView("main");
            }}
          />
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
