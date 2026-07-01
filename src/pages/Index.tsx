import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
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
  Video, VolumeX,
  PhoneCall,
  ArrowLeft,
  Heart,
  AlertTriangle,
  Star,
  Handshake,
  Share2,
  Trash2,
  HelpCircle,
  Utensils,
  Pill,
  Shirt,
  GraduationCap,
  Radio,
  UserRound,
  LifeBuoy,
  Copy,
  Info,
  Mail,
} from "lucide-react";

// DHAYAN DEIN: Sirf ye ek supabase import rehna chahiye
import { supabase } from "@/lib/supabaseClient";
import { memGet, memSet, memClear } from "@/lib/memCache";
import { Helmet } from "react-helmet-async";

import Header from "@/components/Header";
import GolSlider from "@/components/GolSlider";
import PullToRefresh from "@/components/PullToRefresh";
import AutoPlayMutedVideo from "@/components/AutoPlayMutedVideo";
import { isAdminEmail } from "@/lib/adminConfig";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useDataCache } from "@/context/DataCacheContext";

// ── Lazy-loaded feature sections (breaks circular deps + improves load time) ──
const FameFeed       = lazy(() => import("@/components/FameFeed"));
const StoryBar       = lazy(() => import("@/components/StoryBar"));
const FlicksFeed     = lazy(() => import("@/components/FlicksFeed"));
const ChatSystem     = lazy(() => import("@/components/ChatSystem"));
const CirclePage     = lazy(() => import("@/components/CirclePage"));
const HooksHub       = lazy(() => import("@/components/HooksHub"));
const TaskBoard      = lazy(() => import("@/components/TaskBoard"));
const SnapyStudio    = lazy(() => import("@/components/SnapyStudio"));
const QuotesMaker    = lazy(() => import("@/components/QuotesMaker"));
const AdminDashboard = lazy(() => import("@/components/AdminDashboard"));
const MagnetDashboard= lazy(() => import("@/components/MagnetDashboard"));
const FlicksStudio   = lazy(() => import("@/components/FlicksStudio"));
const AntakshariArena = lazy(() => import("@/components/AntakshariArena"));
const ConnectionPanel= lazy(() => import("@/components/ConnectionPanel"));
const CreatePost     = lazy(() => import("@/components/CreatePost"));
// ── Reusable styled blocks ───────────────────────────────────────────────────
const GlassCard = ({ children, className = "", noPadding = false }: any) => (
  <div
    className={`bg-white/10 backdrop-blur-2xl border-y sm:border border-white/10 shadow-lg w-full ${noPadding ? "p-0" : "p-4"} ${className}`}
  >
    {children}
  </div>
);

// ── Suspense fallback for lazy sections ──────────────────────────────────────
const SectionLoader = () => (
  <div className="w-full flex items-center justify-center py-20">
    <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
  </div>
);

// ── Light-mode CSS overrides (previously bundled with rose petals, now standalone) ──
const LightModeStyles = () => (
  <style>{`
    .light-mode { color: #1e293b; }
    .light-mode .text-white        { color: #1e293b !important; }
    .light-mode .text-white\\/90   { color: #1e293b !important; }
    .light-mode .text-white\\/80   { color: #334155 !important; }
    .light-mode .text-white\\/70   { color: #475569 !important; }
    .light-mode .text-white\\/60   { color: #64748b !important; }
    .light-mode .text-white\\/50   { color: #64748b !important; }
    .light-mode .text-white\\/40   { color: #94a3b8 !important; }
    .light-mode .text-white\\/30   { color: #94a3b8 !important; }
    .light-mode .text-white\\/20   { color: #cbd5e1 !important; }
    .light-mode .bg-white\\/10     { background-color: rgba(255,255,255,0.85) !important; }
    .light-mode .bg-white\\/5      { background-color: rgba(255,255,255,0.7) !important; }
    .light-mode .border-white\\/10 { border-color: rgba(0,0,0,0.1) !important; }
    .light-mode .border-white\\/20 { border-color: rgba(0,0,0,0.15) !important; }
    .light-mode .bg-slate-900\\/80 { background-color: rgba(255,255,255,0.9) !important; }
    .light-mode .bg-slate-900      { background-color: #f1f5f9 !important; }
    .light-mode .bg-slate-800      { background-color: #e2e8f0 !important; }
    .light-mode .bg-\\[\\#020617\\]  { background-color: #f1f5f9 !important; }
    .light-mode input,
    .light-mode textarea           { color: #1e293b !important; }
    .light-mode input::placeholder,
    .light-mode textarea::placeholder { color: #94a3b8 !important; }
  `}</style>
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

// ── Frame Mode — category config ─────────────────────────────────────────────
const FRAME_CATS = {
  Food:     { icon: "🍱", itemPrice: 200, delivery: 50,  target: 250, perAd: 0.5, badge: "bg-orange-100 text-orange-700", bar: "bg-orange-400" },
  Slipper:  { icon: "🩴", itemPrice: 100, delivery: 30,  target: 130, perAd: 0.5, badge: "bg-purple-100 text-purple-700", bar: "bg-purple-500"  },
  Medicine: { icon: "💊", itemPrice: 500, delivery: 50,  target: 550, perAd: 0.5, badge: "bg-green-100 text-green-700",   bar: "bg-green-500"  },
  Clothes:  { icon: "👕", itemPrice: 800, delivery: 50,  target: 850, perAd: 0.5, badge: "bg-blue-100 text-blue-700",     bar: "bg-blue-500"   },
} as const;
type FrameCategory = keyof typeof FRAME_CATS;

interface FrameRequest {
  id: string;
  request_code: string;
  user_id: string;
  user_name: string;
  user_avatar: string;
  needy_name: string;
  needy_photo_url: string;
  address: string;
  category: string;
  mobile: string;
  description: string;
  collected_amount: number;
  target_amount: number;
  support_count: number;
  status: string;
  created_at: string;
  is_priority?: boolean;
  delivery_charge?: number;
}

// ── Frame Mode full-screen view ────────────────────────────────────────────────
function FrameModePage({ onBack, userProfile, userEmail }: { onBack: () => void; userProfile: any; userEmail?: string }) {
  const ADMIN_EMAILS = ["tiwarijhumki@gmail.com", "textilevikhyat@gmail.com"];
  const isAdmin = !!userEmail && ADMIN_EMAILS.includes(userEmail.toLowerCase());

  const [requests, setRequests]         = useState<FrameRequest[]>([]);
  const [loading, setLoading]           = useState(true);
  const [showForm, setShowForm]         = useState(false);
  const [showSuccess, setShowSuccess]   = useState(false);
  const [successCode, setSuccessCode]   = useState("");
  const [submitting, setSubmitting]     = useState(false);
  const [adWatching, setAdWatching]     = useState<string | null>(null);
  const [supported, setSupported]       = useState<Set<string>>(new Set());
  const [helpPopup, setHelpPopup]       = useState<string | null>(null);
  const [activeTab, setActiveTab]       = useState<"current" | "pending" | "success">("pending");
  const [showPhonePopup, setShowPhonePopup] = useState(false);
  const [settingPriority, setSettingPriority] = useState<string | null>(null);
  const [formData, setFormData]         = useState({
    needy_name: "", address: "", category: "Food" as FrameCategory, mobile: "", description: "",
  });
  const [photoFile, setPhotoFile]         = useState<File | null>(null);
  const [photoPreview, setPhotoPreview]   = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    fetchRequests();
    const ch = supabase
      .channel("frame-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "frame_requests" }, (payload) => {
        setRequests(prev => [payload.new as FrameRequest, ...prev]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "frame_requests" }, (payload) => {
        setRequests(prev => prev.map(r => r.id === (payload.new as FrameRequest).id ? { ...r, ...payload.new as FrameRequest } : r));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "frame_requests" }, (payload) => {
        setRequests(prev => prev.filter(r => r.id !== (payload.old as any).id));
      })
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, []);

  const fetchRequests = async () => {
    try {
      const { data } = await supabase
        .from("frame_requests")
        .select("id, request_code, user_id, user_name, user_avatar, needy_name, needy_photo_url, address, category, mobile, description, collected_amount, target_amount, delivery_charge, support_count, status, is_priority, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (data) setRequests(data);
    } catch (_) {}
    setLoading(false);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!formData.needy_name.trim() || !formData.address.trim() || !formData.mobile.trim()) {
      alert("Naam, address aur mobile zaroori hai!");
      return;
    }
    setSubmitting(true);
    let needy_photo_url = "";
    if (photoFile) {
      setUploadingPhoto(true);
      try {
        const ext  = photoFile.name.split(".").pop();
        const name = `frame-needy/${Date.now()}.${ext}`;
        await supabase.storage.from("avatars").upload(name, photoFile, { upsert: true });
        needy_photo_url = supabase.storage.from("avatars").getPublicUrl(name).data.publicUrl;
      } catch (_) {}
      setUploadingPhoto(false);
    }
    const code   = Math.floor(100000 + Math.random() * 900000).toString();
    const catCfg = FRAME_CATS[formData.category];

    const { data, error } = await supabase.from("frame_requests").insert({
      request_code:     code,
      user_id:          userProfile?.id || "",
      user_name:        userProfile?.full_name || "Anonymous",
      user_avatar:      userProfile?.avatar_url || "",
      needy_name:       formData.needy_name,
      needy_photo_url,
      address:          formData.address,
      category:         formData.category,
      mobile:           formData.mobile,
      description:      formData.description,
      collected_amount: 0,
      target_amount:    catCfg.target,
      delivery_charge:  catCfg.delivery,
      support_count:    0,
      status:           "active",
      is_priority:      false,
    });


    if (error) {
      alert(`Submit failed: ${error.message}`);
      setSubmitting(false);
      return;
    }

    setSuccessCode(code);
    setShowForm(false);
    setShowSuccess(true);
    setFormData({ needy_name: "", address: "", category: "Food", mobile: "", description: "" });
    setPhotoFile(null);
    setPhotoPreview("");
    fetchRequests();
    setSubmitting(false);
  };

  const handleWatchAd = async (reqId: string) => {
    setAdWatching(reqId);
    await new Promise(r => setTimeout(r, 2000));
    const req    = requests.find(r => r.id === reqId);
    if (!req) { setAdWatching(null); return; }
    const target = req.target_amount;
    const newAmt = parseFloat(Math.min((req.collected_amount || 0) + 0.5, target).toFixed(2));
    const done   = newAmt >= target;
    try {
      await supabase.from("frame_requests").update({
        collected_amount: newAmt,
        status: done ? "completed" : "active",
      }).eq("id", reqId);
      setRequests(prev => prev.map(r =>
        r.id === reqId ? { ...r, collected_amount: newAmt, status: done ? "completed" : "active" } : r
      ));
    } catch (_) {}
    setAdWatching(null);
    setHelpPopup(null);
  };

  const handleSetPriority = async (reqId: string, priority: boolean) => {
    setSettingPriority(reqId);
    try {
      await supabase.from("frame_requests").update({ is_priority: priority }).eq("id", reqId);
      setRequests(prev => prev.map(r => r.id === reqId ? { ...r, is_priority: priority } : r));
    } catch (_) {}
    setSettingPriority(null);
  };

  const handleSupport = async (reqId: string) => {
    if (supported.has(reqId)) return;
    setSupported(prev => new Set([...prev, reqId]));
    const req = requests.find(r => r.id === reqId);
    try {
      await supabase.from("frame_requests").update({ support_count: (req?.support_count || 0) + 1 }).eq("id", reqId);
      setRequests(prev => prev.map(r => r.id === reqId ? { ...r, support_count: r.support_count + 1 } : r));
    } catch (_) {}
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Flicks Frame", text: "Zarooratmand ki madad karein!", url: window.location.origin });
      } else {
        await navigator.clipboard.writeText(window.location.origin);
        alert("Link copy ho gaya! Share karein apne doston ke saath 🤝");
      }
    } catch (_) {}
  };

  const handleShareRequest = async (req: FrameRequest) => {
    const shareText = `🙏 *Madad Karen!* — Flicks Frame\n\n👤 Zarooratmand: *${req.needy_name}*\n📦 Zaroorat: *${req.category}*\n🎯 Target Amount: *₹${req.target_amount}*\n📍 Address: ${req.address}\n\nAd dekh kar help karein ya share karein:\n🔗 ${window.location.origin}\n\n🆔 Request Code: *#${req.request_code}*\n\n— Flicks Frame Team 🤝`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Help ${req.needy_name} — Flicks Frame`,
          text: shareText,
          url: window.location.origin,
        });
      } else {
        await navigator.clipboard.writeText(shareText);
        alert("WhatsApp share text copy ho gaya! 🤝");
      }
    } catch (_) {}
  };

  const handleDeleteRequest = async (reqId: string) => {
    const confirmed = window.confirm("Kya aap sach mein is request ko delete karna chahte hain? Ye action undo nahi hoga.");
    if (!confirmed) return;
    const { error } = await supabase.from("frame_requests").delete().eq("id", reqId);
    if (!error) {
      fetchRequests();
    } else {
      alert("Delete failed: " + error.message);
    }
  };

  const fld = (k: keyof typeof formData, v: string) =>
    setFormData(prev => ({ ...prev, [k]: v }));

  const todayStr = new Date().toDateString();
  const tabRequests = {
    current: requests.filter(r => r.is_priority && new Date(r.created_at).toDateString() === todayStr && r.status !== "completed"),
    pending: requests.filter(r => r.status === "active"),
    success: requests.filter(r => r.status === "completed" || Math.round((r.collected_amount / r.target_amount) * 100) >= 100),
  };
  const displayed = tabRequests[activeTab];

  return (
    <div className="h-full w-full bg-gradient-to-b from-amber-50 via-white to-amber-50 overflow-y-auto pb-28">

      {/* ── Sticky Header ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-xl border-b-2 border-amber-200 flex items-center gap-3 px-4 py-2.5 shadow-sm">
        <button onClick={onBack} className="p-2 rounded-xl bg-amber-100 border border-amber-200 text-amber-700 active:scale-95 shrink-0">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-amber-900 leading-none">FLICKS FRAME</p>
          <p className="text-[10px] text-amber-600 font-semibold leading-tight mt-0.5">एक छोटा सा प्रयास, किसी की बड़ी मदद</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-black text-[11px] shadow-md shadow-amber-200 relative shrink-0"
        >
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500" />
          <Handshake size={13} /> Submit Request
        </motion.button>
      </div>

      {/* ── Help Request Form Modal ────────────────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div key="formbg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={() => setShowForm(false)} />
            <motion.div key="formsheet" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed bottom-0 left-0 w-full z-[61] bg-[#d4f0e2] rounded-t-3xl border-t-2 border-amber-200 max-h-[92vh] overflow-y-auto"
            >
              <div className="px-4 pt-4 pb-2 flex items-center justify-between border-b border-amber-100">
                <div>
                  <p className="font-black text-gray-900 text-base">Help Request Form</p>
                  <p className="text-[10px] text-gray-500">Sab fields bharein — Team review karegi</p>
                </div>
                <button onClick={() => setShowForm(false)} className="p-2 rounded-xl bg-gray-100 text-gray-500 text-sm font-black">✕</button>
              </div>

              <div className="px-4 pt-4 pb-2 bg-amber-50 mx-4 mt-4 rounded-2xl border border-amber-100">
                <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-2">Reporting By (Auto)</p>
                <div className="flex items-center gap-3">
                  {userProfile?.avatar_url ? (
                    <img src={userProfile.avatar_url} loading="lazy" className="w-10 h-10 rounded-full object-cover border-2 border-amber-300"  decoding="async"/>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-amber-400 flex items-center justify-center text-white font-black">
                      {(userProfile?.full_name || "U")[0]}
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-sm text-gray-900">{userProfile?.full_name || "Anonymous"}</p>
                    <p className="text-[10px] text-gray-500">Verified Flicks User</p>
                  </div>
                </div>
              </div>

              <div className="px-4 py-4 space-y-4">
                <div>
                  <p className="text-xs font-black text-gray-700 mb-2">Zarooratmand ki Photo</p>
                  <label className="flex flex-col items-center justify-center w-full h-32 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 cursor-pointer overflow-hidden">
                    {photoPreview ? (
                      <img src={photoPreview} loading="lazy" className="w-full h-full object-cover"  decoding="async"/>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-amber-500">
                        <Camera size={28} />
                        <p className="text-xs font-bold">Photo lein ya choose karein</p>
                      </div>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                  </label>
                </div>

                <div>
                  <p className="text-xs font-black text-gray-700 mb-1.5">Zarooratmand ka Naam *</p>
                  <input value={formData.needy_name} onChange={e => fld("needy_name", e.target.value)}
                    placeholder="Jaise: Ramesh Kumar" className="w-full bg-[#c4e8d4] border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-amber-400/40" />
                </div>

                <div>
                  <p className="text-xs font-black text-gray-700 mb-2">Category *</p>
                  <div className="grid grid-cols-4 gap-2">
                    {(Object.keys(FRAME_CATS) as FrameCategory[]).map(cat => (
                      <button key={cat} onClick={() => fld("category", cat)}
                        className={`flex flex-col items-center gap-1 py-2 rounded-xl border-2 text-center transition-all ${formData.category === cat ? "border-amber-500 bg-amber-50" : "border-gray-200 bg-gray-50"}`}>
                        <span className="text-xl">{FRAME_CATS[cat].icon}</span>
                        <span className="text-[10px] font-black text-gray-700">{cat}</span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    <p className="text-[10px] text-amber-700 font-black">
                      Item: ₹{FRAME_CATS[formData.category].itemPrice} + Delivery: ₹{FRAME_CATS[formData.category].delivery} = Total: ₹{FRAME_CATS[formData.category].target}
                    </p>
                    <p className="text-[10px] text-amber-600 mt-0.5">Ad se +₹0.50 per watch</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-black text-gray-700 mb-1.5">Pura Address *</p>
                  <textarea value={formData.address} onChange={e => fld("address", e.target.value)}
                    placeholder="Gali, Mohalla, Sheher, State..."
                    rows={3} className="w-full bg-[#c4e8d4] border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-amber-400/40 resize-none" />
                </div>

                <div>
                  <p className="text-xs font-black text-gray-700 mb-1.5">Mobile No. *</p>
                  <input value={formData.mobile} onChange={e => fld("mobile", e.target.value)}
                    placeholder="+91 XXXXX XXXXX" type="tel"
                    className="w-full bg-[#c4e8d4] border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-amber-400/40" />
                </div>

                <div>
                  <p className="text-xs font-black text-gray-700 mb-1.5">Zaroorat ka Karan (Optional)</p>
                  <textarea value={formData.description} onChange={e => fld("description", e.target.value)}
                    placeholder="Thodi si aur baat..."
                    rows={2} className="w-full bg-[#c4e8d4] border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-amber-400/40 resize-none" />
                </div>

                <motion.button whileTap={{ scale: 0.97 }} onClick={handleSubmit} disabled={submitting || uploadingPhoto}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg"
                >
                  {submitting ? <><Loader2 size={16} className="animate-spin" /> Submit ho raha hai...</> : "Submit Help Request ✅"}
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Success Popup ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSuccess && (
          <>
            <motion.div key="sucbg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm" />
            <motion.div key="sucbox" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
              className="fixed inset-0 z-[71] flex items-center justify-center px-6"
            >
              <div className="bg-[#d4f0e2] rounded-3xl p-6 w-full max-w-sm text-center border-2 border-amber-300 shadow-2xl">
                <div className="text-5xl mb-3">✅</div>
                <p className="text-lg font-black text-amber-900 mb-2">Request Submit Ho Gayi!</p>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">
                  हमें भरोसा है कि आपकी यह कोशिश किसी की ज़िंदगी बदल देगी।<br/>
                  <span className="text-amber-700 font-bold">Flicks Frame Team</span> jald hi verify karegi.
                </p>
                <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl py-3 px-4 mb-4">
                  <p className="text-[10px] text-amber-600 font-black uppercase tracking-widest">Aapka Request Code</p>
                  <p className="text-3xl font-black text-amber-700 tracking-widest mt-1">{successCode}</p>
                  <p className="text-[10px] text-gray-500 mt-1">Ye code sambhal ke rakhen — tracking ke liye</p>
                </div>
                <button onClick={() => setShowSuccess(false)}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-black text-sm">
                  Theek Hai, Shukriya! 🙏
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Help Popup (Watch Ad / Share) ────────────────────────────────── */}
      <AnimatePresence>
        {helpPopup && (
          <>
            <motion.div key="hpbg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm" onClick={() => setHelpPopup(null)} />
            <motion.div key="hpbox" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="fixed bottom-0 left-0 w-full z-[71] bg-[#d4f0e2] rounded-t-3xl border-t-2 border-amber-200 px-5 pt-5 pb-8"
            >
              <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-4" />
              <div className="text-center mb-5">
                <p className="text-3xl mb-2">❤️</p>
                <p className="font-black text-gray-900 text-base leading-snug">आपका एक छोटा सा प्रयास</p>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                  किसी की ज़िंदगी बदल सकता है।<br/>
                  <span className="font-bold text-amber-700">Ad dekh kar help karein</span> — isse zarooratmand ko madad milegi.
                </p>
              </div>
              {adWatching === helpPopup ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <Loader2 size={32} className="animate-spin text-amber-500" />
                  <p className="text-sm font-bold text-amber-700">Ad chal raha hai...</p>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 2, ease: "linear" }}
                      className="h-full bg-gradient-to-r from-amber-400 to-yellow-500 rounded-full" />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => handleWatchAd(helpPopup)}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-200">
                    <Video size={18} /> Watch Ad & Help (+₹0.50)
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={handleShare}
                    className="w-full py-4 rounded-2xl bg-[#b0dcc4] text-gray-700 font-black text-sm flex items-center justify-center gap-2">
                    <Globe size={18} /> Share App 🤝
                  </motion.button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Phone Popup ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showPhonePopup && (
          <>
            <motion.div key="phonebg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm" onClick={() => setShowPhonePopup(false)} />
            <motion.div key="phonebox" initial={{ opacity: 0, scale: 0.85, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.85 }}
              className="fixed bottom-24 right-4 z-[81] bg-[#d4f0e2] rounded-3xl border-2 border-amber-300 shadow-2xl p-5 w-72"
            >
              <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Direct Help / Status</p>
              <p className="text-xs text-gray-500 mb-3">Call ya WhatsApp karein:</p>
              <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-2xl px-4 py-3 text-center mb-3">
                <p className="text-xl font-black text-amber-800 tracking-widest">7-08-08-09-9-08</p>
              </div>
              <a href="tel:7080809908"
                className="block w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-black text-sm text-center">
                📞 Call Now
              </a>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Centred content wrapper (laptop: max-width + auto margins) ──── */}
      <div className="w-full max-w-6xl mx-auto">

      {/* ── Admin Spotlight Mission ───────────────────────────────────────── */}
      {isAdmin && (
        <div className="mx-4 mt-4 mb-2 bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-400 rounded-3xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Star size={16} className="text-yellow-500 fill-yellow-400" />
            <p className="text-xs font-black text-yellow-800 uppercase tracking-widest">Spotlight Mission — Admin Panel</p>
          </div>
          <p className="text-[10px] text-yellow-700 mb-3">Kisi bhi request ko Priority mark karein — wo 'Current' tab mein aayegi.</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {requests.filter(r => r.status === "active").slice(0, 6).map(req => {
              const cat = FRAME_CATS[req.category as FrameCategory] || FRAME_CATS.Food;
              return (
                <div key={req.id} className="flex items-center justify-between bg-[#d4f0e2] rounded-2xl px-3 py-2 border border-yellow-200">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base">{cat.icon}</span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black text-gray-800 truncate">{req.needy_name}</p>
                      <p className="text-[10px] text-gray-400">#{req.request_code}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSetPriority(req.id, !req.is_priority)}
                    disabled={settingPriority === req.id}
                    className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all ${req.is_priority ? "bg-yellow-400 text-black" : "bg-gray-100 text-gray-600 hover:bg-yellow-100"}`}
                  >
                    {settingPriority === req.id ? <Loader2 size={10} className="animate-spin" /> : <Star size={10} fill={req.is_priority ? "currentColor" : "none"} />}
                    {req.is_priority ? "Priority ✓" : "Set Priority"}
                  </button>
                </div>
              );
            })}
            {requests.filter(r => r.status === "active").length === 0 && (
              <p className="text-[10px] text-gray-400 text-center py-2">Koi active request nahi hai</p>
            )}
          </div>
        </div>
      )}

      {/* ── Three Tabs ───────────────────────────────────────────────────── */}
      <div className="mx-4 mt-4 mb-1">
        <div className="flex items-center bg-amber-100/60 rounded-2xl p-1 gap-1">
          {([
            { key: "current", label: "⚡ Current", count: tabRequests.current.length },
            { key: "pending", label: "⏳ Pending", count: tabRequests.pending.length },
            { key: "success", label: "✅ Success", count: tabRequests.success.length },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-black transition-all ${
                activeTab === tab.key
                  ? "bg-white shadow-sm text-amber-800 border border-amber-200"
                  : "text-amber-600 hover:bg-white/50"
              }`}
            >
              {tab.label}
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${activeTab === tab.key ? "bg-amber-500 text-white" : "bg-amber-200 text-amber-700"}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Wall header ───────────────────────────────────────────────────── */}
      <div className="w-full px-4 pt-3 pb-2 flex items-center justify-between">
        <p className="text-xs font-black text-amber-700 uppercase tracking-widest flex items-center gap-2">
          <Handshake size={13} />
          {activeTab === "current" ? "Today's Priority Requests" : activeTab === "pending" ? "Pending Requests" : "Completed Goals 🎉"}
        </p>
        {loading && <Loader2 size={14} className="animate-spin text-amber-400" />}
      </div>

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {!loading && displayed.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <p className="text-5xl mb-4">{activeTab === "success" ? "🎉" : "🙏"}</p>
          <p className="font-black text-gray-600 text-base">
            {activeTab === "current" ? "Aaj koi priority request nahi" : activeTab === "success" ? "Abhi tak koi goal complete nahi" : "Koi active request nahi"}
          </p>
          {activeTab === "pending" && (
            <button onClick={() => setShowForm(true)}
              className="mt-4 px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-black text-sm shadow-md">
              Submit Help Request ➕
            </button>
          )}
        </div>
      )}

      {/* ── Request Cards ──────────────────────────────────────────────────── */}
      <div className="px-4 pb-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <AnimatePresence>
          {displayed.map((req) => {
            const cat    = FRAME_CATS[req.category as FrameCategory] || FRAME_CATS.Food;
            const pct    = Math.min(100, Math.round((req.collected_amount / req.target_amount) * 100));
            const done   = req.status === "completed" || pct >= 100;
            const isSupp = supported.has(req.id);
            const timeAgo = (() => {
              const d = (Date.now() - new Date(req.created_at).getTime()) / 1000;
              if (d < 3600) return `${Math.floor(d / 60)}m ago`;
              if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
              return `${Math.floor(d / 86400)}d ago`;
            })();
            const itemPrice = (cat as any).itemPrice || req.target_amount;
            const delivery  = req.delivery_charge ?? (cat as any).delivery ?? 0;
            const total     = req.target_amount;

            return (
              <motion.div key={req.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className={`bg-[#d4f0e2] rounded-3xl border-2 overflow-hidden shadow-sm ${req.is_priority ? "border-yellow-400 shadow-yellow-100" : done ? "border-green-200" : "border-amber-100"}`}
              >
                {req.is_priority ? (
                  <div className="bg-gradient-to-r from-yellow-400 to-amber-400 px-4 py-1.5 flex items-center gap-2">
                    <Star size={11} className="text-white fill-white" />
                    <p className="text-[10px] font-black text-white uppercase tracking-widest">Priority Mission</p>
                  </div>
                ) : (
                  <div className="bg-blue-50 border-b border-blue-100 px-4 py-1.5 flex items-center gap-1.5">
                    <Shield size={10} className="text-blue-500 shrink-0" />
                    <p className="text-[10px] font-black text-blue-600 tracking-wide">Under Flicks Verification</p>
                  </div>
                )}

                <div className="px-4 pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="relative shrink-0">
                      {req.user_avatar ? (
                        <img src={req.user_avatar} loading="lazy" className="w-10 h-10 rounded-full object-cover border-2 border-amber-200"  decoding="async"/>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-amber-400 flex items-center justify-center text-white font-black text-sm border-2 border-amber-200">
                          {(req.user_name || "U")[0]}
                        </div>
                      )}
                      <span className="absolute -bottom-0.5 -right-0.5 text-[10px] bg-white rounded-full border border-amber-200 px-0.5">📋</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-black text-gray-800 truncate">{req.user_name} ne report kiya</p>
                      <p className="text-[10px] text-gray-400">{timeAgo} · Code: <span className="font-bold text-amber-600">#{req.request_code}</span></p>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-1 rounded-full shrink-0 ${cat.badge}`}>
                      {cat.icon} {req.category}
                    </span>
                  </div>

                  <div className="flex items-start gap-3 mb-2">
                    {req.needy_photo_url ? (
                      <img src={req.needy_photo_url} loading="lazy" className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-100 shrink-0"  decoding="async"/>
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center text-2xl border-2 border-amber-100 shrink-0">
                        {cat.icon}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-gray-900 text-sm">{req.needy_name}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1"><MapPin size={10} /> {req.address}</p>
                      <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5"><Phone size={10} /> {req.mobile}</p>
                      {req.description && <p className="text-[11px] text-gray-600 mt-1 italic">"{req.description}"</p>}
                    </div>
                  </div>

                  {/* Pricing transparency */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 mb-3">
                    <p className="text-[10px] font-black text-amber-700">
                      Item: ₹{itemPrice} | Delivery: ₹{delivery} | Total: ₹{total}
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="px-4 pb-3">
                  {done ? (
                    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-2xl px-3 py-2">
                      <CheckCircle size={16} className="text-green-500 shrink-0" />
                      <p className="text-xs font-black text-green-700">Goal Reached! Team Dispatched 🚚</p>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-1">
                        <span>₹{req.collected_amount.toFixed(2)} collected</span>
                        <span>Target: ₹{req.target_amount} ({pct}%)</span>
                      </div>
                      <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                          className={`h-full ${cat.bar} rounded-full`}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions row */}
                <div className="px-4 pb-4 flex items-center gap-2 border-t border-gray-50 pt-3">
                  <button onClick={() => handleSupport(req.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${isSupp ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>
                    <Heart size={13} fill={isSupp ? "#D97706" : "none"} stroke={isSupp ? "#D97706" : "currentColor"} />
                    {req.support_count}
                  </button>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleShareRequest(req)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-50 border border-green-200 text-green-700 text-xs font-black shrink-0"
                  >
                    <Share2 size={13} /> Share
                  </motion.button>
                  {isAdmin && (
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleDeleteRequest(req.id)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-black shrink-0 hover:bg-red-100 transition-colors"
                      title="Admin: Delete Request"
                    >
                      <Trash2 size={13} />
                    </motion.button>
                  )}
                  {!done ? (
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => setHelpPopup(req.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-xs font-black shadow-sm"
                    >
                      <Video size={13} /> Help Karein
                    </motion.button>
                  ) : (
                    <div className="flex-1" />
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      </div>{/* ── end max-w-6xl centering wrapper ────────────────────────────── */}

      {/* ── Floating Action Button — Direct Help ──────────────────────────── */}
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={() => setShowPhonePopup(v => !v)}
        className="fixed bottom-8 right-4 z-[75] flex flex-col items-center justify-center gap-0.5 px-4 py-3 bg-gradient-to-br from-amber-500 to-yellow-400 rounded-2xl shadow-2xl shadow-amber-300/60 border-2 border-white"
      >
        <PhoneCall size={18} className="text-black" />
        <span className="text-[9px] font-black text-black leading-none">Direct Help</span>
        <span className="text-[9px] font-black text-black leading-none">/ Status</span>
      </motion.button>
    </div>
  );
}

// ── About Us sub-view ──────────────────────────────────────────────────────
const AboutUsView = ({ setSettingsView }: { setSettingsView: (v: any) => void }) => (
  <div className="space-y-4">
    <div className="flex items-center gap-3 px-4 pt-4">
      <button
        onClick={() => setSettingsView("main")}
        className="p-2 bg-white/5 rounded-xl border border-white/10 text-white/60 hover:text-white"
      >
        <ChevronLeft size={16} />
      </button>
      <div className="flex items-center gap-2">
        <Info size={18} style={{ color: "#FFF44F" }} />
        <p className="text-sm font-black text-white">About Us</p>
      </div>
    </div>

    {/* Hero banner */}
    <div
      className="mx-0 rounded-[2.5rem] p-6 text-center space-y-1"
      style={{ background: "linear-gradient(135deg, #2d0010 0%, #800020 60%, #1a0510 100%)", border: "1px solid rgba(128,0,32,0.55)" }}
    >
      <p className="text-4xl mb-2">🇮🇳</p>
      <p className="text-base font-black" style={{ color: "#FFF44F" }}>Flicks India</p>
      <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
        Authentic Community · Creative Expression
      </p>
    </div>

    {/* Content blocks */}
    <div className="mx-0 rounded-[2.5rem] bg-white/5 border border-white/10 p-6 space-y-5">
      {[
        {
          emoji: "🚀",
          title: "Our Story",
          body: "Welcome to Flicks India, your ultimate destination for authentic community connection and creative expression. Flicks India was founded with a singular vision: to create a space where content is not just consumed but felt.",
        },
        {
          emoji: "💡",
          title: "Our Belief",
          body: "We believe that every user has a story to tell, and our platform provides the tools — from AI-powered quote generation to interactive social feeds — to make those stories stand out.",
        },
        {
          emoji: "🛡️",
          title: "Our Mission",
          body: "Our mission is to foster a safe, secure, and positive environment where real-world connections are prioritized over fake news and superficial interactions. We are continuously evolving to bring you the best features that merge cutting-edge technology with user-centric design.",
        },
      ].map(({ emoji, title, body }) => (
        <div key={title} className="flex gap-4 items-start">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shrink-0"
            style={{ background: "rgba(128,0,32,0.35)", border: "1px solid rgba(128,0,32,0.5)" }}
          >
            {emoji}
          </div>
          <div>
            <p className="text-sm font-black text-white mb-1">{title}</p>
            <p className="text-xs text-white/55 leading-relaxed">{body}</p>
          </div>
        </div>
      ))}
    </div>

    <p className="text-[10px] text-white/20 text-center pb-2">
      © 2024–2025 Flicks India · Made with ❤️ in India
    </p>
  </div>
);

// ── Contact Us sub-view ─────────────────────────────────────────────────────
const ContactUsView = ({ setSettingsView }: { setSettingsView: (v: any) => void }) => {
  const [copiedEmail, setCopiedEmail] = React.useState(false);
  const handleCopyEmail = () => {
    navigator.clipboard.writeText("textilevikhyat@gmail.com").then(() => {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    });
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 px-4 pt-4">
        <button
          onClick={() => setSettingsView("main")}
          className="p-2 bg-white/5 rounded-xl border border-white/10 text-white/60 hover:text-white"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-2">
          <Mail size={18} style={{ color: "#FFF44F" }} />
          <p className="text-sm font-black text-white">Contact Us</p>
        </div>
      </div>

      {/* Hero banner */}
      <div
        className="mx-0 rounded-[2.5rem] p-6 text-center space-y-1"
        style={{ background: "linear-gradient(135deg, #2d0010 0%, #800020 60%, #1a0510 100%)", border: "1px solid rgba(128,0,32,0.55)" }}
      >
        <p className="text-4xl mb-2">💌</p>
        <p className="text-base font-black" style={{ color: "#FFF44F" }}>We'd love to hear from you!</p>
        <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
          Feedback, questions, or support — our team is always here.
        </p>
      </div>

      {/* Email card */}
      <div className="mx-0 rounded-[2.5rem] bg-white/5 border border-white/10 p-5 space-y-3">
        <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">📧 General Support</p>
        <p className="text-xs text-white/50 leading-relaxed">
          You can reach us via email at any time. We typically respond within 24–48 hours.
        </p>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <a
            href="mailto:textilevikhyat@gmail.com"
            className="text-sm font-black tracking-wide break-all"
            style={{ color: "#FFF44F" }}
          >
            textilevikhyat@gmail.com
          </a>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={handleCopyEmail}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border transition-all shrink-0 ${
              copiedEmail
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                : "bg-white/5 border-white/15 text-white/50 hover:bg-white/10"
            }`}
          >
            {copiedEmail ? <CheckCircle size={12} /> : <Copy size={12} />}
            {copiedEmail ? "Copied!" : "Copy"}
          </motion.button>
        </div>
      </div>

      {/* Phone card */}
      <div className="mx-0 rounded-[2.5rem] bg-white/5 border border-white/10 p-5 space-y-3">
        <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">📞 Emergency / Direct Support</p>
        <p className="text-xs text-white/50 leading-relaxed">
          For urgent assistance, please call our support team in India.
        </p>
        <a
          href="tel:+917080809908"
          className="flex items-center gap-3 px-4 py-3.5 rounded-2xl active:scale-95 transition-transform"
          style={{
            background: "linear-gradient(135deg, rgba(128,0,32,0.35), rgba(77,0,16,0.45))",
            border: "1px solid rgba(128,0,32,0.6)",
          }}
        >
          <span className="text-2xl">📲</span>
          <div className="flex-1">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-0.5">Tap to Call</p>
            <p className="text-sm font-black" style={{ color: "#FFF44F" }}>+91 70808 09908</p>
          </div>
          <ChevronRight size={16} className="text-white/25" />
        </a>
      </div>

      {/* Feedback card */}
      <div className="mx-0 rounded-[2.5rem] bg-white/5 border border-white/10 p-5">
        <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-2">💬 Feedback</p>
        <p className="text-xs text-white/55 leading-relaxed">
          Your suggestions help us make Flicks India better every day. Please feel free to reach out to us at any time — we read every message.
        </p>
      </div>

      <p className="text-[10px] text-white/20 text-center pb-2">
        Flicks India · Support Team 🇮🇳
      </p>
    </div>
  );
};

// ── Privacy Policy sub-view ────────────────────────────────────────────────
const PrivacyPolicyView = ({ setSettingsView, lang }: { setSettingsView: (v: any) => void; lang: "en" | "hi" }) => {
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
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-emerald-400" />
          <p className="text-sm font-black text-white">{t("Privacy Policy", "गोपनीयता नीति")}</p>
        </div>
      </div>

      <div className="rounded-[2.5rem] bg-white/5 border border-white/10 p-6 space-y-5 mx-0">
        {[
          {
            icon: "🗂️",
            title: t("Data Collection", "डेटा संग्रह"),
            body: t(
              "We collect only minimal data — your email and username — to provide and personalise our services. We never sell your data to third parties.",
              "हम केवल न्यूनतम डेटा (ईमेल और यूज़रनेम) संग्रह करते हैं। आपका डेटा कभी किसी तीसरे पक्ष को नहीं बेचा जाता।"
            ),
          },
          {
            icon: "🎛️",
            title: t("User Control", "उपयोगकर्ता नियंत्रण"),
            body: t(
              "You are in full control of your account. You can delete your posts, data, or your entire account at any time from within the app.",
              "आप कभी भी अपनी पोस्ट, डेटा या पूरा खाता ऐप के अंदर से हटा सकते हैं। आपका नियंत्रण है।"
            ),
          },
          {
            icon: "🔐",
            title: t("Safety & Encryption", "सुरक्षा और एन्क्रिप्शन"),
            body: t(
              "All your chats, posts, and personal information are protected using industry-standard encryption. Your privacy is our top priority.",
              "आपके सभी चैट, पोस्ट और व्यक्तिगत जानकारी उद्योग-मानक एन्क्रिप्शन से सुरक्षित हैं। आपकी गोपनीयता हमारी प्राथमिकता है।"
            ),
          },
        ].map((item) => (
          <div key={item.title} className="flex gap-4">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 flex items-center justify-center text-xl shrink-0">
              {item.icon}
            </div>
            <div>
              <p className="text-sm font-black text-white mb-1">{item.title}</p>
              <p className="text-xs text-white/55 leading-relaxed">{item.body}</p>
            </div>
          </div>
        ))}

        <p className="text-[10px] text-white/25 text-center pt-2">
          {t("Effective from 2024 · Flicks App", "2024 से प्रभावी · फेसलुक ऐप")}
        </p>
      </div>
    </div>
  );
};

// ── Help & Support sub-view ────────────────────────────────────────────────
const FAQS = [
  {
    q: "How do I change my password?",
    a: "Go to Settings → Reset Password. A reset link will be sent to your registered email.",
  },
  {
    q: "How do I report a post?",
    a: "Tap and hold on any post or use the ⋯ menu, then tap 'Report'. Our team reviews reports within 24 hours.",
  },
  {
    q: "Why is my account suspended?",
    a: "Accounts are suspended for violating community guidelines. Contact support@careflicks.in for an appeal.",
  },
  {
    q: "How do I delete my account?",
    a: "Go to Settings → Personal Info → scroll to the bottom → tap 'Delete Account'. This action is permanent.",
  },
];

const HelpSupportView = ({ setSettingsView, lang }: { setSettingsView: (v: any) => void; lang: "en" | "hi" }) => {
  const t = (en: string, hi: string) => (lang === "hi" ? hi : en);
  const [copied, setCopied] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const SUPPORT_EMAIL = "support@careflicks.in";

  const handleCopy = () => {
    navigator.clipboard.writeText(SUPPORT_EMAIL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 px-4 pt-4">
        <button
          onClick={() => setSettingsView("main")}
          className="p-2 bg-white/5 rounded-xl border border-white/10 text-white/60 hover:text-white"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-2">
          <LifeBuoy size={18} className="text-sky-400" />
          <p className="text-sm font-black text-white">{t("Help & Support", "सहायता केंद्र")}</p>
        </div>
      </div>

      {/* Hero banner */}
      <div className="mx-0 rounded-[2.5rem] bg-gradient-to-br from-sky-900/50 to-blue-950/50 border border-sky-500/20 p-6 text-center space-y-1">
        <LifeBuoy size={36} className="text-sky-400 mx-auto mb-3" />
        <p className="text-base font-black text-white">{t("We're here for you 24/7", "हम 24/7 यहाँ हैं")}</p>
        <p className="text-xs text-white/50 leading-relaxed">
          {t("Facing issues? Our team is ready to help around the clock.", "कोई समस्या? हमारी टीम हमेशा मदद के लिए तैयार है।")}
        </p>
      </div>

      {/* Contact card */}
      <div className="mx-0 rounded-[2.5rem] bg-white/5 border border-white/10 p-5 space-y-3">
        <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">{t("Contact Us", "संपर्क करें")}</p>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-white/40 mb-0.5">{t("Email Support", "ईमेल सहायता")}</p>
            <p className="text-sm font-black text-sky-300 tracking-wide">{SUPPORT_EMAIL}</p>
          </div>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={handleCopy}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black border transition-all ${
              copied
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                : "bg-sky-500/15 border-sky-500/30 text-sky-300 hover:bg-sky-500/25"
            }`}
          >
            {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
            {copied ? t("Copied!", "कॉपी हो गया!") : t("Copy Email", "कॉपी करें")}
          </motion.button>
        </div>
      </div>

      {/* FAQ */}
      <div className="mx-0 rounded-[2.5rem] bg-white/5 border border-white/10 p-5 space-y-2">
        <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-3">
          {t("Frequently Asked Questions", "अक्सर पूछे जाने वाले सवाल")}
        </p>
        {FAQS.map((faq, i) => (
          <div key={i} className="border-b border-white/8 last:border-0">
            <button
              className="w-full flex items-center justify-between py-3 text-left gap-3"
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
            >
              <span className="text-xs font-bold text-white/80 leading-snug">{faq.q}</span>
              <ChevronRight
                size={14}
                className={`text-white/30 shrink-0 transition-transform duration-200 ${openFaq === i ? "rotate-90" : ""}`}
              />
            </button>
            <AnimatePresence>
              {openFaq === i && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-xs text-white/45 leading-relaxed pb-3 overflow-hidden"
                >
                  {faq.a}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Personal Info sub-view (outside Index to prevent focus loss) ──────────────
interface PersonalInfoViewProps {
  lang: "en" | "hi";
  setSettingsView: (v: "main" | "personal" | "blocklist" | "privacy" | "help") => void;
  personalForm: { full_name: string; bio: string; school: string; mobile: string; location: string };
  setPersonalForm: React.Dispatch<React.SetStateAction<{ full_name: string; bio: string; school: string; mobile: string; location: string }>>;
  isSavingPersonal: boolean;
  personalSaved: boolean;
  handleSavePersonalInfo: () => void;
  userId: string;
  currentAvatarUrl: string;
  onAvatarUpdated: (url: string) => void;
}

const PersonalInfoView = React.memo(({
  lang,
  setSettingsView,
  personalForm,
  setPersonalForm,
  isSavingPersonal,
  personalSaved,
  handleSavePersonalInfo,
  userId,
  currentAvatarUrl,
  onAvatarUpdated,
}: PersonalInfoViewProps) => {
  const t = (en: string, hi: string) => (lang === "hi" ? hi : en);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>(currentAvatarUrl);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show immediate local preview
    const localUrl = URL.createObjectURL(file);
    setAvatarPreview(localUrl);
    setIsUploadingAvatar(true);

    try {
      const fileName = `${userId}-${Date.now()}.png`;
      const { error: uploadErr } = await supabase.storage.from("avatars").upload(fileName, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const publicUrl = supabase.storage.from("avatars").getPublicUrl(fileName).data.publicUrl;

      await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", userId);

      setAvatarPreview(publicUrl);
      onAvatarUpdated(publicUrl);

      // Broadcast live update to Header and other listeners
      window.dispatchEvent(new CustomEvent("flicks-avatar-updated", { detail: { url: publicUrl } }));
    } catch (err: any) {
      console.error("[DP Upload] error:", err);
      alert("Photo upload nahi ho saki. Dobara try karo.");
      setAvatarPreview(currentAvatarUrl);
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

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

        {/* ── DP Upload Section ── */}
        <div className="flex flex-col items-center gap-3 pb-2">
          <div className="relative">
            {/* Circular Avatar Preview */}
            <div
              className="w-24 h-24 rounded-full overflow-hidden border-4 shadow-xl"
              style={{ borderColor: "rgba(96,165,250,0.6)", boxShadow: "0 0 24px rgba(96,165,250,0.35)" }}
            >
              {avatarPreview ? (
                <img src={avatarPreview} loading="lazy" className="w-full h-full object-cover" alt="Profile"  decoding="async"/>
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-black text-3xl">
                  {personalForm.full_name?.[0]?.toUpperCase() || "?"}
                </div>
              )}
              {/* Uploading overlay */}
              {isUploadingAvatar && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-full">
                  <Loader2 size={22} className="text-white animate-spin" />
                </div>
              )}
            </div>

            {/* Camera edit button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAvatar}
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center border-2 border-slate-900 transition-transform active:scale-90 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #2563eb, #4f46e5)", boxShadow: "0 4px 12px rgba(79,70,229,0.5)" }}
            >
              <Camera size={14} className="text-white" />
            </button>
          </div>

          <p className="text-[10px] text-white/30 font-semibold">
            {isUploadingAvatar ? t("Uploading...", "अपलोड हो रहा है...") : t("Tap camera to change photo", "फ़ोटो बदलने के लिए कैमरा दबाएं")}
          </p>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarFileChange}
          />
        </div>

        {/* ── Form Fields ── */}
        {[
          { key: "full_name", label: t("Full Name", "पूरा नाम"),               placeholder: t("Your full name", "आपका नाम") },
          { key: "bio",       label: t("Bio", "परिचय"),                         placeholder: t("Tell the world about you", "अपने बारे में लिखें") },
          { key: "school",    label: t("School / College", "स्कूल / कॉलेज"),   placeholder: t("Your school", "आपका स्कूल") },
          { key: "mobile",    label: t("Mobile", "मोबाइल"),                     placeholder: "+92 300 0000000" },
          { key: "location",  label: t("Location", "स्थान"),                    placeholder: t("City, Country", "शहर, देश") },
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
});

// ── Component ────────────────────────────────────────────────────────────────
const Index = ({ session, initialAdminOpen }: { session: Session; initialAdminOpen?: boolean }) => {
  const userId = session.user.id;
  const userEmail = session.user.email || "";
  const isAppAdmin = isAdminEmail(userEmail);

  // Core UI
  const [activeFeature, setActiveFeature] = useState("Fame");
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(!!initialAdminOpen && isAppAdmin);
  const [isUploading, setIsUploading] = useState(false);
  const [isPostOpen, setIsPostOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showNav, setShowNav] = useState(true);
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("flicks-dark") !== "false",
  );
  const lastScrollY = useRef(0);

  // Chat
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatBadgeCount, setChatBadgeCount] = useState(0);

  // Allow other components (e.g. UserProfileModal "Message" button) to open
  // the chat panel via a global event. ChatSystem itself listens for the
  // same event and will route to the right conversation/requests panel.
  useEffect(() => {
    const open = () => setIsChatOpen(true);
    window.addEventListener("flicks:open-chat", open);
    return () => window.removeEventListener("flicks:open-chat", open);
  }, []);

  // Magnet Dashboard
  const [showMagnetDashboard, setShowMagnetDashboard] = useState(false);

  // Frame Mode
  const dataCache = useDataCache();
  const cachedOnline = dataCache.cacheRef.current.onlineUsers;
  const cachedReels  = dataCache.cacheRef.current.reelPosts;
  const cachedProfile = dataCache.cacheRef.current.profile;
  const [isFrameMode, setIsFrameMode] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<{ id: string; full_name: string; avatar_url: string }[]>(() => cachedOnline?.data ?? []);
  const [myFrameRequests, setMyFrameRequests] = useState<FrameRequest[]>([]);
  // Agora Video Call modal
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false);

  // ── Body scroll lock ───────────────────────────────────────────────────
  // Whenever ANY full-screen overlay is open, freeze the page behind it so
  // the underlying feed/reels don't scroll or autoplay through touches.
  // Restores the user's scroll position on close.
  useEffect(() => {
    const anyOverlay =
      isChatOpen ||
      isPostOpen ||
      isAdminPanelOpen ||
      isVideoCallOpen ||
      showMagnetDashboard;
    if (!anyOverlay) return;
    const scrollY = window.scrollY;
    document.body.classList.add("body-locked");
    document.body.style.top = `-${scrollY}px`;
    return () => {
      document.body.classList.remove("body-locked");
      document.body.style.top = "";
      window.scrollTo(0, scrollY);
    };
  }, [isChatOpen, isPostOpen, isAdminPanelOpen, isVideoCallOpen, showMagnetDashboard, activeFeature]);

  // Profile
  const [profile, setProfile] = useState(() => {
    const cached = dataCache.cacheRef.current.profile;
    return cached?.data ?? {
      id: userId,
      full_name: "",
      username: "",
      avatar_url: "",
      bio: "",
      location: "",
      school: "",
      mobile: "",
      updated_at: "",
    };
  });

  // Settings sub-views
  const [settingsView, setSettingsView] = useState<
    "main" | "personal" | "blocklist" | "privacy" | "help" | "about" | "contact"
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
    (localStorage.getItem("flicks-lang") as "en" | "hi") || "en",
  );
  const [profileLocked, setProfileLocked] = useState(false);
  const [profileHidden, setProfileHidden] = useState(false);
  const [isPrivateMode, setIsPrivateMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteSubmitted, setDeleteSubmitted] = useState(false);
  const [accountStatus, setAccountStatus] = useState<string>("active");
  const [suspensionReason, setSuspensionReason] = useState<string>("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // ── Hook pages for home strip ──────────────────────────────────────────────
  const [homeHookPages, setHomeHookPages] = useState<any[]>([]);
  const [initialHookPageId, setInitialHookPageId] = useState<string | null>(null);

  // ── Sidebar Circles (desktop right panel) ─────────────────────────────────
  const [sidebarCircles, setSidebarCircles] = useState<any[]>([]);

  // ── Reel posts (real videos/posts for Flicks strip) ──────────────────────
  const [reelPosts, setReelPosts] = useState<any[]>(() => cachedReels?.data ?? []);

  // ── Current user's own reels ──────────────────────────────────────────────
  const [myReels, setMyReels]           = useState<any[]>([]);
  const [reelUploadPct, setReelUploadPct] = useState(0);   // 0 = idle
  const [reelUploading, setReelUploading] = useState(false);
  const reelInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!userId) return;
    const cKey = "homeHookPages";
    const hit = memGet<any[]>(cKey);
    if (hit) { setHomeHookPages(hit); return; }
    supabase
      .from("hook_pages")
      .select("id, name, cover_url, hook_count, category, owner_id")
      .order("hook_count", { ascending: false })
      .limit(10)
      .then(({ data }) => { if (data) { setHomeHookPages(data); memSet(cKey, data); } });
  }, [userId]);

  // ── Fetch top circles for desktop sidebar ──────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const cKey = "sidebarCircles_v1";
    const hit = memGet<any[]>(cKey);
    if (hit) { setSidebarCircles(hit); return; }
    supabase
      .from("circles")
      .select("id, name, cover_url, member_count, category")
      .order("member_count", { ascending: false })
      .limit(10)
      .then(({ data }) => { if (data) { setSidebarCircles(data); memSet(cKey, data); } });
  }, [userId]);

  const fetchMyReels = () => {
    supabase.from("posts")
      .select("id, media_url, type, content, created_at")
      .eq("author_id", userId)
      .eq("type", "video")
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (data) {
          setMyReels(data);
          dataCache.setCache("myReels", { data, fetchedAt: Date.now() });
        }
      });
  };

  const handleReelCardClick = () => {
    if (myReels.length === 0) {
      reelInputRef.current?.click();
    } else {
      setActiveFeature("Flicks");
    }
  };

  const handleReelFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReelUploading(true);
    setReelUploadPct(10);
    try {
      const fileName = `reel_${userId}_${Date.now()}.${file.name.split(".").pop()}`;
      const { data: upData, error: upErr } = await supabase.storage
        .from("posts")
        .upload(fileName, file, { cacheControl: "3600", upsert: false });
      if (upErr) throw upErr;
      setReelUploadPct(75);
      const { data: urlData } = supabase.storage.from("posts").getPublicUrl(fileName);
      await supabase.from("posts").insert([{
        author_id: userId,
        author: profile.full_name || "User",
        content: "",
        media_url: urlData.publicUrl,
        type: "video",
        metadata: { is_youtube: false },
      }]);
      setReelUploadPct(100);
      fetchMyReels();
      setTimeout(() => { setReelUploading(false); setReelUploadPct(0); }, 800);
    } catch {
      setReelUploading(false);
      setReelUploadPct(0);
    }
    e.target.value = "";
  };

  // ── Fetch online users + real reel posts in parallel ─────────────────────
  useEffect(() => {
    if (!userId) return;

    // Online users — skip if cache is still fresh
    if (!dataCache.isStale("onlineUsers")) {
      const hit = dataCache.cacheRef.current.onlineUsers;
      if (hit?.data) setOnlineUsers(hit.data);
    } else {
      supabase.from("profiles").select("id, full_name, avatar_url")
        .neq("id", userId).limit(8)
        .then(({ data }) => {
          if (data) {
            setOnlineUsers(data);
            dataCache.setCache("onlineUsers", { data, fetchedAt: Date.now() });
          }
        });
    }

    // Reel posts — skip if cache is still fresh
    if (!dataCache.isStale("reelPosts")) {
      const hit = dataCache.cacheRef.current.reelPosts;
      if (hit?.data) setReelPosts(hit.data);
    } else {
      supabase.from("posts")
        .select("id, author, author_id, media_url, type, metadata, content")
        .order("created_at", { ascending: false })
        .limit(15)
        .then(({ data }) => {
          if (data) {
            setReelPosts(data);
            dataCache.setCache("reelPosts", { data, fetchedAt: Date.now() });
          }
        });
    }

    fetchMyReels();
  }, [userId]);

  // ── My Frame Requests — fetch + realtime ──────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("frame_requests")
      .select("id, request_code, user_id, user_name, user_avatar, needy_name, needy_photo_url, address, category, mobile, description, collected_amount, target_amount, delivery_charge, support_count, status, is_priority, created_at")
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (data) {
          setMyFrameRequests(data as FrameRequest[]);
          dataCache.setCache("frameRequests", { data: data as FrameRequest[], fetchedAt: Date.now() });
        }
      });

    const myCh = supabase
      .channel(`my-frame-requests-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "frame_requests" }, (payload) => {
        setMyFrameRequests(prev => [payload.new as FrameRequest, ...prev]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "frame_requests" }, (payload) => {
        setMyFrameRequests(prev => prev.map(r => r.id === (payload.new as FrameRequest).id ? { ...r, ...payload.new as FrameRequest } : r));
      })
      .subscribe();
    return () => { myCh.unsubscribe(); };
  }, [userId]);

  // ── Fetch & Realtime (Updated for Auto-Refresh) ──────────────────────────────
  useEffect(() => {
    // 1. Pehli baar profile load karo
    fetchProfile();

    // 2. Auth Listener: Jaise hi login ho, bina refresh profile update ho jaye
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, _session) => {
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

  // ── Live presence heartbeat: stamps profiles.last_seen so the Admin
  //    Dashboard can show "Live now" (active in last 5 minutes).
  //    Wrapped in try/catch so a missing table never crashes the tab.
  useEffect(() => {
    if (!userId) return;
    const ping = () => {
      try {
        supabase.from("profiles")
          .update({ last_seen: new Date().toISOString() })
          .eq("id", userId)
          .then(() => {});
      } catch {
        void 0;
      }
    };
    ping(); // immediate
    const id = setInterval(() => {
      if (document.visibilityState === "visible") ping();
    }, 60 * 1000); // every minute while tab is visible
    const onVis = () => { if (document.visibilityState === "visible") ping(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [userId]);


  // Yahan se fetchProfile shuru ho raha hai — BULLETPROOF VERSION
  const fetchProfile = async () => {
    // Serve from cache instantly if fresh — skip DB hit
    const profileCacheKey = `profile_${userId}`;
    const cachedProfile = memGet<any>(profileCacheKey);
    if (cachedProfile) {
      setProfile((prev) => ({ ...prev, ...cachedProfile }));
      setPersonalForm({
        full_name: cachedProfile.full_name || "",
        bio: cachedProfile.bio || "",
        school: cachedProfile.school || "",
        mobile: cachedProfile.mobile || "",
        location: cachedProfile.location || "",
      });
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    setProfileError(null);

    try {
      // Step A: fetch existing profile (safe even if table missing)
      const { data, error: fetchErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (fetchErr) {
        console.warn("[Profile] DB fetch failed — table likely missing:", fetchErr.message);
        // Build a minimal in-memory profile from session so the UI still works
        const meta = session?.user?.user_metadata ?? {};
        const fallbackProfile = {
          id: userId,
          full_name: meta.full_name || meta.name || userEmail.split("@")[0],
          username: userEmail.split("@")[0],
          avatar_url: meta.picture || meta.avatar_url || "",
          bio: "",
          location: "",
          school: "",
          mobile: "",
          updated_at: "",
        };
        setProfile((prev) => ({ ...prev, ...fallbackProfile }));
        setPersonalForm({
          full_name: fallbackProfile.full_name,
          bio: "",
          school: "",
          mobile: "",
          location: "",
        });
        setProfileLoading(false);
        setProfileError(
          "Database tables not ready yet. Please run the SQL setup in Supabase, then refresh."
        );
        return;
      }

      if (data) {
        // Existing profile — use DB values, but sync Google photo if still empty
        const meta = session?.user?.user_metadata ?? {};
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
        setIsPrivateMode(data.is_private_mode || false);
        setAccountStatus(data.account_status || "active");
        setSuspensionReason(data.suspension_reason || "");
        dataCache.setCache("profile", { data: merged, fetchedAt: Date.now() });
        memSet(profileCacheKey, merged);

        // Update last_seen on every profile fetch so the DB stays fresh (fire-and-forget)
        supabase.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", userId).then(() => {});

        // Silently patch missing avatar/name into DB (fire-and-forget)
        if (!data.avatar_url || !data.full_name) {
          supabase.from("profiles")
            .update({ avatar_url: merged.avatar_url, full_name: merged.full_name })
            .eq("id", userId)
            .then(() => {});
        }
      } else {
        // New Google user — create their profile row from OAuth metadata
        const meta = session?.user?.user_metadata ?? {};
        const newProfile = {
          id: userId,
          full_name: meta.full_name || meta.name || userEmail.split("@")[0],
          username: userEmail.split("@")[0],
          avatar_url: meta.picture || meta.avatar_url || "",
          bio: "",
          location: "",
          school: "",
          mobile: "",
          is_private_mode: false,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Attempt upsert — ignore failure so missing table doesn't freeze the app
        const { error: upsertErr } = await supabase.from("profiles").upsert(newProfile);
        if (upsertErr) {
          console.warn("[Profile] Upsert failed — table likely missing:", upsertErr.message);
          setProfileError(
            "Profile table missing. App will work in read-only mode until SQL is applied."
          );
        }

        setProfile((prev) => ({ ...prev, ...newProfile }));
        setPersonalForm({
          full_name: newProfile.full_name,
          bio: "",
          school: "",
          mobile: "",
          location: "",
        });
      }
    } catch (err: any) {
      console.error("[Profile] fetchProfile CRASHED:", err?.message || err);
      setProfileError("Unexpected error loading profile. Please refresh.");
      // Still populate a minimal profile so the UI doesn't stay blank
      const meta = session?.user?.user_metadata ?? {};
      setProfile((prev) => ({
        ...prev,
        full_name: meta.full_name || meta.name || userEmail.split("@")[0],
        avatar_url: meta.picture || meta.avatar_url || "",
      }));
    } finally {
      setProfileLoading(false);
    }
  };

  // ── Handlers ─────────────────────────────────────────────────────────────
  const toggleDarkMode = (dark: boolean) => {
    setDarkMode(dark);
    localStorage.setItem("flicks-dark", String(dark));
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
      // Broadcast so FameFeed/Header refresh the new dp instantly across the app.
      window.dispatchEvent(new CustomEvent("flicks-avatar-updated", { detail: { url: publicUrl } }));
      window.dispatchEvent(new CustomEvent("flicks-profile-updated"));
    } catch {
      alert("Upload error!");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSavePersonalInfo = async () => {
    setIsSavingPersonal(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        ...personalForm,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
    if (!error) {
      setProfile((prev) => ({ ...prev, ...personalForm }));
      setPersonalSaved(true);

      // Backfill the new name on all existing posts/comments by this user
      // so the saved name shows everywhere, not just on new content.
      const newName = (personalForm.full_name || "").trim();
      if (newName && userId) {
        try {
          await Promise.all([
            supabase.from("posts").update({ author: newName }).eq("author_id", userId),
            supabase.from("comments").update({ author: newName }).eq("author_id", userId),
          ]);
        } catch (backfillErr) {
          console.warn("[Profile] Name backfill warning:", backfillErr);
        }
      }

      window.dispatchEvent(new CustomEvent("flicks-profile-updated"));
      setTimeout(() => {
        setPersonalSaved(false);
        setSettingsView("main");
      }, 1200);
    } else {
      console.error("[Profile] Save failed:", error.message, "| code:", error.code);
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
    localStorage.setItem("flicks-lang", next);
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

  const handleTogglePrivateMode = async () => {
    const next = !isPrivateMode;
    setIsPrivateMode(next);
    await supabase
      .from("profiles")
      .update({ is_private_mode: next })
      .eq("id", userId);
  };

  const handleLogout = async () => {
    dataCache.clearCache();
    memClear();
    await supabase.auth.signOut();
  };

  const handleDeleteAccount = async () => {
    try {
      await supabase.from("deletion_requests").insert({
        user_id: userId,
        email: userEmail,
        requested_at: new Date().toISOString(),
        status: "pending",
      });
    } catch {
      // Table may not exist yet — request is still shown as submitted
    }
    setDeleteSubmitted(true);
    setTimeout(() => {
      dataCache.clearCache();
      memClear();
      supabase.auth.signOut();
    }, 6000);
  };

  // ── Labels (language) ────────────────────────────────────────────────────
  const t = (en: string, hi: string) => (lang === "hi" ? hi : en);


  // ── Settings: Block List sub-view ─────────────────────────────────────────
  const BlockListView = () => {
    const [blockedList, setBlockedList] = React.useState<any[]>([]);
    const [blLoading, setBlLoading] = React.useState(true);
    const [unblocking, setUnblocking] = React.useState<string | null>(null);

    React.useEffect(() => {
      (async () => {
        setBlLoading(true);
        const { data } = await supabase
          .from("user_blocks")
          .select("blocked_id, profiles!user_blocks_blocked_id_fkey(id, full_name, avatar_url)")
          .eq("blocker_id", userId);
        setBlockedList(
          (data || []).map((row: any) => ({
            blockId: row.blocked_id,
            ...row["profiles!user_blocks_blocked_id_fkey"],
          })).filter((r: any) => r.id)
        );
        setBlLoading(false);
      })();
    }, []);

    const handleUnblock = async (blockedId: string) => {
      setUnblocking(blockedId);
      await supabase.from("user_blocks").delete().eq("blocker_id", userId).eq("blocked_id", blockedId);
      setBlockedList(prev => prev.filter((u: any) => u.id !== blockedId));
      setUnblocking(null);
    };

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
            {t("Blocked Users", "अवरुद्ध उपयोगकर्ता")}
          </p>
        </div>
        <GlassCard className="rounded-[2.5rem] border border-white/10 p-0 overflow-hidden">
          {blLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-white/40" />
            </div>
          ) : blockedList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-3 p-6">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Ban size={28} className="text-white/20" />
              </div>
              <p className="text-sm font-black text-white/30">
                {t("No Blocked Users", "कोई अवरुद्ध उपयोगकर्ता नहीं")}
              </p>
              <p className="text-xs text-white/20">
                {t("Users you block will appear here.", "जिन उपयोगकर्ताओं को आप ब्लॉक करते हैं वे यहाँ दिखेंगे।")}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {blockedList.map((u: any) => (
                <div key={u.id} className="flex items-center gap-3 px-5 py-4">
                  <div className="w-10 h-10 rounded-full bg-white/10 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} loading="lazy" className="w-full h-full object-cover" alt=""  decoding="async"/>
                    ) : (
                      <span className="text-white font-black text-base">{(u.full_name || "U")[0].toUpperCase()}</span>
                    )}
                  </div>
                  <p className="flex-1 text-white font-semibold text-sm truncate">{u.full_name || "Unknown User"}</p>
                  <button
                    onClick={() => handleUnblock(u.id)}
                    disabled={unblocking === u.id}
                    className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition disabled:opacity-50 shrink-0"
                  >
                    {unblocking === u.id ? "…" : t("Unblock", "अनब्लॉक")}
                  </button>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    );
  };

  // ── Settings: Main view ────────────────────────────────────────────────────
  const MainSettingsView = () => (
    <div className="space-y-4 px-4 sm:px-0">
      {/* Appearance */}
      <GlassCard className="rounded-[2.5rem] p-6 border border-white/10">
        <h2 className="text-xs font-black text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Palette size={14} /> {t("Appearance", "रूप")}
        </h2>
        <div className="flex gap-3">
          <button
            onClick={() => toggleDarkMode(true)}
            className={`flex-1 h-14 rounded-2xl flex flex-col items-center justify-center gap-1 border-2 transition-all ${darkMode ? "border-blue-500 bg-slate-800" : "border-transparent bg-white/5 opacity-60 hover:opacity-100"}`}
          >
            <span className="text-lg">🌙</span>
            <span className="text-[10px] font-black text-white uppercase">{t("Dark", "डार्क")}</span>
          </button>
          <button
            onClick={() => toggleDarkMode(false)}
            className={`flex-1 h-14 rounded-2xl flex flex-col items-center justify-center gap-1 border-2 transition-all ${!darkMode ? "border-blue-500 bg-slate-100/20" : "border-transparent bg-white/5 opacity-60 hover:opacity-100"}`}
          >
            <span className="text-lg">☀️</span>
            <span className="text-[10px] font-black text-white uppercase">{t("Light", "लाइट")}</span>
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
        <SettingRow
          icon={<Shield size={18} />}
          title={t("Private Profile Mode", "निजी प्रोफ़ाइल मोड")}
          desc={
            isPrivateMode
              ? t("Only friends can view & interact", "केवल दोस्त देख और इंटरैक्ट कर सकते हैं")
              : t("Anyone can view your timeline", "कोई भी आपकी टाइमलाइन देख सकता है")
          }
          color="text-purple-400"
          onClick={handleTogglePrivateMode}
          right={
            <Toggle on={isPrivateMode} onToggle={handleTogglePrivateMode} />
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

      {/* Privacy Policy, Help, About Us & Contact Us */}
      <GlassCard className="rounded-[2.5rem] p-2 border border-white/10">
        <SettingRow
          icon={<Shield size={18} />}
          title={t("Privacy Policy", "गोपनीयता नीति")}
          desc={t("How we protect your data", "डेटा सुरक्षा नीति")}
          color="text-emerald-400"
          onClick={() => setSettingsView("privacy")}
        />
        <SettingRow
          icon={<LifeBuoy size={18} />}
          title={t("Help & Support", "सहायता केंद्र")}
          desc={t("FAQs, contact our team 24/7", "24/7 सहायता उपलब्ध")}
          color="text-sky-400"
          onClick={() => setSettingsView("help")}
        />
        <SettingRow
          icon={<Info size={18} />}
          title={t("About Us", "हमारे बारे में")}
          desc={t("Our story, mission & values", "हमारी कहानी और मिशन")}
          color="text-yellow-400"
          onClick={() => setSettingsView("about")}
        />
        <SettingRow
          icon={<Mail size={18} />}
          title={t("Contact Us", "संपर्क करें")}
          desc={t("Email · Call · Feedback", "ईमेल · कॉल · फ़ीडबैक")}
          color="text-orange-400"
          onClick={() => setSettingsView("contact")}
        />
      </GlassCard>

      {/* Danger Zone */}
      <GlassCard className="rounded-[2.5rem] p-2 border border-red-500/20">
        <h2 className="text-[10px] font-black text-red-400/70 uppercase tracking-widest px-4 pt-3 pb-1 flex items-center gap-2">
          <AlertTriangle size={12} /> Danger Zone
        </h2>
        <SettingRow
          icon={<Trash2 size={18} />}
          title="Delete Account"
          desc="Submit a request to permanently delete your account"
          color="text-red-400"
          onClick={() => { setDeleteSubmitted(false); setShowDeleteDialog(true); }}
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
  // ── Profile error banner (only shown on genuine DB failures, never during normal load)
  const ProfileBanner = () => {
    if (profileError) {
      return (
        <div className="fixed top-0 left-0 right-0 z-[500] bg-amber-500/95 text-white text-xs font-bold text-center py-2 px-4 flex items-center justify-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-white/30 animate-pulse" />
          {profileError}
          <button
            onClick={fetchProfile}
            className="ml-2 px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 text-[10px] font-black uppercase tracking-wide"
          >
            Retry
          </button>
        </div>
      );
    }
    return null;
  };

  // ── Banned / Suspended screen ─────────────────────────────────────────────
  if (accountStatus === "suspended") {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center px-6 text-center"
        style={{ background: "linear-gradient(160deg,#0a0018,#1a0008)" }}>
        <Helmet>
          <title>Account Suspended | Flicks India</title>
          <meta name="robots" content="index, follow" />
        </Helmet>
        <div className="text-7xl mb-6">🚫</div>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: "linear-gradient(135deg,#ef4444,#7f1d1d)" }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <h1 className="text-2xl font-black text-white mb-2">Account Suspended</h1>
        <p className="text-white/60 text-sm font-semibold mb-6">Aapka account suspend kar diya gaya hai.</p>
        {suspensionReason && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-5 py-4 max-w-xs w-full mb-6">
            <p className="text-red-300 text-xs font-black uppercase tracking-widest mb-1">Reason</p>
            <p className="text-white/80 text-sm font-medium leading-relaxed">{suspensionReason}</p>
          </div>
        )}
        <p className="text-white/30 text-xs max-w-xs">
          If you believe this is a mistake, please contact the admin at tiwarijhumki@gmail.com
        </p>
        <button onClick={() => supabase.auth.signOut()} className="mt-8 px-6 py-3 rounded-2xl text-white/70 text-sm font-bold border border-white/15 bg-white/5">
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen w-full transition-colors duration-500 relative overflow-x-hidden ${darkMode ? "bg-[#020617]" : "bg-slate-100 light-mode"}`}
    >
      {/* Page-level Helmet — overrides the app-level default in App.tsx.
          The home-feed branch explicitly resets title + description so that
          navigating back from a post page cleanly reverts all <head> tags. */}
      {(activeFeature === "Settings" || isChatOpen) ? (
        <Helmet>
          <title>{isChatOpen ? "Messages | Flicks India" : "Settings | Flicks India"}</title>
          <meta name="description" content="No Fake News | New India Social App | Full Protected Security | 24 Hours Help Desk" />
          <meta name="robots" content="index, follow" />
        </Helmet>
      ) : (
        <Helmet>
          <title>Flicks India | Your Social Hub</title>
          <meta name="description" content="No Fake News | New India Social App | Full Protected Security | 24 Hours Help Desk" />
          <meta property="og:title" content="Flicks India - Connect &amp; Share" />
          <meta property="og:description" content="No Fake News | New India Social App | Full Protected Security | 24 Hours Help Desk" />
          <meta property="og:image" content="https://i.ibb.co/HT7RvFxs/flicksindia.png" />
          <meta property="og:url" content="https://flicksindia.online/" />
          <meta name="twitter:title" content="Flicks India - Connect &amp; Share" />
          <meta name="twitter:description" content="No Fake News | New India Social App | Full Protected Security | 24 Hours Help Desk" />
          <meta name="twitter:image" content="https://i.ibb.co/HT7RvFxs/flicksindia.png" />
          <meta name="robots" content="index, follow" />
        </Helmet>
      )}

      <ProfileBanner />

      {/* ── Delete Account Modal ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showDeleteDialog && (
          <motion.div
            key="delete-modal-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center px-5"
            style={{ background: "rgba(2,6,23,0.96)", backdropFilter: "blur(24px)" }}
          >
            <motion.div
              key="delete-modal-card"
              initial={{ scale: 0.92, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 16 }}
              transition={{ type: "spring", stiffness: 340, damping: 30 }}
              className="w-full max-w-sm rounded-3xl overflow-hidden border border-white/10"
              style={{ background: "linear-gradient(160deg,#0d1117,#0a0f1a)" }}
            >
              {!deleteSubmitted ? (
                <div className="p-6 space-y-5">
                  {/* Header */}
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0">
                      <Trash2 size={20} className="text-red-400" />
                    </div>
                    <div>
                      <p className="text-white font-black text-base">Delete Account</p>
                      <p className="text-white/40 text-[11px] font-semibold">Requires Admin approval</p>
                    </div>
                  </div>
                  <p className="text-white/65 text-sm leading-relaxed">
                    Are you sure you want to submit a deletion request? Your account will be reviewed by Admin before deletion.
                  </p>
                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={() => setShowDeleteDialog(false)}
                      className="flex-1 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white/60 text-sm font-bold active:scale-95 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteAccount}
                      className="flex-1 py-3.5 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400 text-sm font-black active:scale-95 transition-all hover:bg-red-500/30"
                    >
                      Yes, Delete
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6 space-y-4">
                  {/* Success header */}
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-green-500/20 border border-green-500/30 flex items-center justify-center shrink-0">
                      <CheckCircle size={20} className="text-green-400" />
                    </div>
                    <p className="text-white font-black text-base">Request Submitted</p>
                  </div>
                  {/* Main message */}
                  <p className="text-white/70 text-sm leading-relaxed">
                    Your account deletion request has been submitted and is currently under Admin review.
                  </p>
                  {/* 30-day warning box */}
                  <div
                    className="rounded-2xl px-4 py-3.5 border border-red-500/40 flex items-start gap-3"
                    style={{ background: "rgba(239,68,68,0.10)" }}
                  >
                    <AlertTriangle size={16} className="text-red-400 mt-0.5 shrink-0" />
                    <p className="text-red-300 text-[12.5px] font-semibold leading-relaxed">
                      <span className="font-black text-red-400">Please note: </span>
                      If you log in within the next 30 days, your account will be automatically reactivated.
                    </p>
                  </div>
                  <p className="text-white/25 text-[11px] text-center font-medium pt-1">
                    Signing you out in a few seconds…
                  </p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Magnet Dashboard overlay ───────────────────────────────────────── */}
      <AnimatePresence>
        {showMagnetDashboard && userId && (
          <motion.div
            key="magnetdash"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed inset-0 z-[9999] overflow-hidden overflow-y-auto bg-[#f0f2f5]"
          >
            <Suspense fallback={<SectionLoader />}>
            <MagnetDashboard
              userId={userId}
              viewerUserId={userId}
              userName={profile?.full_name}
              onBack={() => setShowMagnetDashboard(false)}
            />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>

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
            <FrameModePage onBack={() => setIsFrameMode(false)} userProfile={profile} userEmail={userEmail} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Agora Video Call bottom-sheet (FLICKS FUN CALL) ───────────────── */}
      <AnimatePresence>
        {isVideoCallOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="vcbg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[8000] bg-black/70 backdrop-blur-sm"
              onClick={() => setIsVideoCallOpen(false)}
            />
            {/* Sheet */}
            <motion.div
              key="vcsheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="fixed bottom-0 left-0 w-full z-[8001] rounded-t-3xl overflow-hidden bg-[#0d0035] border-t border-violet-500/20"
            >
              {/* Drag handle + close */}
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <div className="w-10 h-1 rounded-full bg-white/20 mx-auto" />
              </div>
              <div className="px-4 pb-2 flex items-center justify-between">
                <div>
                  <p className="text-sm font-black text-white">FLICKS FUN CALL</p>
                  <p className="text-[10px] text-violet-400">Stranger se live video call karo</p>
                </div>
                <button
                  onClick={() => setIsVideoCallOpen(false)}
                  className="p-2 rounded-xl bg-white/10 text-white/50 hover:text-white text-xs font-black"
                >
                  ✕ Close
                </button>
              </div>
              <Suspense fallback={<SectionLoader />}>
                <ConnectionPanel />
              </Suspense>
              <div className="h-8" />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {activeFeature !== "Flicks" && (
        <Header
          onProfileClick={() => setActiveFeature("Face")}
          onHomeClick={() => setActiveFeature("Fame")}
          onSettingsClick={() => { setActiveFeature("Settings"); setSettingsView("main"); }}
          onNavigateToFeature={(feature) => setActiveFeature(feature)}
          onChatClick={() => setIsChatOpen(true)}
          chatBadge={chatBadgeCount}
          userId={userId}
        />
      )}

      <main
        className={`relative z-10 transition-all duration-500 w-full
          ${activeFeature === "Flicks" ? "pt-0 pb-0" : "pt-0 pb-24"}`}
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
              <ErrorBoundary>
              <Suspense fallback={<SectionLoader />}>
              <div className="w-full bg-[#f0f2f5] min-h-screen">

                {/* ── Desktop 3-column grid ─────────────────────────────────── */}
                <div className="lg:grid lg:grid-cols-[260px_1fr_272px] lg:gap-4 lg:px-5 lg:pt-3 lg:items-start">

                {/* ══ LEFT SIDEBAR — desktop only ══════════════════════════════ */}
                <aside className="hidden lg:flex flex-col gap-3 self-start pb-6" style={{ position: 'sticky', top: '80px' }}>

                  {/* Profile quick-card */}
                  <div className="bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
                    <div className="h-12 bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500" />
                    <div className="px-4 pb-4 -mt-7">
                      <div className="w-14 h-14 rounded-full border-4 border-white shadow-md overflow-hidden bg-gray-200 shrink-0">
                        {profile.avatar_url
                          ? <img src={profile.avatar_url} loading="lazy" className="w-full h-full object-cover" alt=""  decoding="async"/>
                          : <div className="w-full h-full flex items-center justify-center bg-violet-500 text-white font-black text-xl">{(profile?.full_name||"U")[0].toUpperCase()}</div>
                        }
                      </div>
                      <p className="font-black text-gray-900 text-sm mt-2 leading-none">{profile?.full_name||"User"}</p>
                      <p className="text-[11px] text-gray-400 font-semibold mt-0.5">@{profile?.username||"user"}</p>
                      {profile?.bio && <p className="text-[11px] text-gray-500 mt-1.5 leading-snug line-clamp-2">{profile.bio}</p>}
                      <div className="mt-2">
                        <span className="text-[10px] font-black text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">⭐ {(profile as any)?.fame_points ?? 0} Fame</span>
                      </div>
                    </div>
                  </div>

                  {/* Navigation shortcuts */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-4 pt-3 pb-1">Explore</p>
                    {([
                      { label: "Fame Feed",    emoji: "🏠", feature: "Fame"         },
                      { label: "Circles",      emoji: "🔵", feature: "Circle"       },
                      { label: "Hook Pages",   emoji: "⚡", feature: "Hooks"        },
                      { label: "Flicks",       emoji: "🎬", feature: "Flicks"       },
                      { label: "Task Board",   emoji: "✅", feature: "Task"         },
                      { label: "Quotes Maker", emoji: "💬", feature: "QuotesMaker"  },
                    ] as const).map(({ label, emoji, feature }) => (
                      <button
                        key={feature}
                        onClick={() => setActiveFeature(feature)}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors text-left border-t border-gray-100 first:border-0"
                      >
                        <span className="text-base leading-none">{emoji}</span>{label}
                      </button>
                    ))}
                  </div>

                  {/* ── Trending Hook Pages — up to 10 (sticky left panel) ── */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-4 pt-3 pb-1">
                      <p className="text-[11px] font-black text-gray-700 uppercase tracking-widest">⚡ Trending Hooks</p>
                      <button
                        onClick={() => { setInitialHookPageId(null); setActiveFeature("Hooks"); }}
                        className="text-[10px] font-black text-orange-500 hover:underline"
                      >See all</button>
                    </div>
                    {(homeHookPages.length > 0 ? homeHookPages : [
                      { id: "lhp-1", name: "Bollywood Beats",  category: "Music",      cover_url: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&q=70", hook_count: 0 },
                      { id: "lhp-2", name: "Cricket Fever",    category: "Sports",     cover_url: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=200&q=70", hook_count: 0 },
                      { id: "lhp-3", name: "Fitness Zone",     category: "Health",     cover_url: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=200&q=70", hook_count: 0 },
                      { id: "lhp-4", name: "Tech Talks India", category: "Technology", cover_url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=200&q=70", hook_count: 0 },
                    ] as any[]).slice(0, 10).map((pg: any) => (
                      <button
                        key={pg.id}
                        onClick={() => { setInitialHookPageId(pg.id ?? null); setActiveFeature("Hooks"); }}
                        className="flex items-center gap-2.5 w-full px-4 py-2 hover:bg-gray-50 transition-colors text-left border-t border-gray-100"
                      >
                        <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-gray-200">
                          {pg.cover_url && <img src={pg.cover_url} className="w-full h-full object-cover" loading="lazy" alt=""  decoding="async"/>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-black text-gray-800 truncate leading-none">{pg.name}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5 font-medium">{pg.category || 'General'}</p>
                        </div>
                        {(pg.hook_count ?? 0) > 0 && (
                          <span className="text-[9px] font-black text-orange-400 shrink-0">
                            {pg.hook_count > 999 ? `${(pg.hook_count / 1000).toFixed(1)}K` : pg.hook_count}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                </aside>

                {/* ══ CENTER COLUMN ════════════════════════════════════════════ */}
                <div className="min-w-0">

                {/* ── Stories Strip ─────────────────────────────────────────── */}
                <StoryBar userProfile={profile} />

                {/* ── Feature Cards: Fun Call + Frame (Section B style) ────── */}
                <div className="px-3 pt-1 pb-1 grid grid-cols-2 gap-2.5">

                  {/* ── Fun Video Call Card ──────────────────────────────────── */}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setIsVideoCallOpen(true)}
                    className="flex flex-col items-start text-left bg-white rounded-2xl overflow-hidden"
                    style={{ border: "1.5px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
                  >
                    {/* Header row */}
                    <div className="flex items-center gap-1.5 px-3 pt-3 pb-1.5 w-full border-b border-gray-100">
                      <div className="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                        <Video size={13} className="text-violet-600" />
                      </div>
                      <span className="text-[11px] font-black text-gray-800 leading-none">Fun Video Call</span>
                    </div>

                    {/* Emoji row */}
                    <div className="flex items-center justify-center gap-1 py-2 w-full">
                      <motion.span
                        className="text-[22px] leading-none"
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 1.6, repeat: Infinity, delay: 0 }}
                      >😊</motion.span>
                      <motion.span
                        className="text-[18px] leading-none"
                        animate={{ y: [0, -5, 0] }}
                        transition={{ duration: 1.4, repeat: Infinity, delay: 0.3 }}
                      >🎉</motion.span>
                      <motion.span
                        className="text-[20px] leading-none"
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 1.8, repeat: Infinity, delay: 0.6 }}
                      >✨</motion.span>
                    </div>

                    {/* Buttons */}
                    <div className="flex flex-col gap-1.5 px-2.5 pb-3 w-full">
                      <div
                        className="flex items-center justify-center gap-1.5 py-1.5 rounded-full"
                        style={{ background: "linear-gradient(90deg,#7c3aed,#6366f1)", boxShadow: "0 2px 8px rgba(99,102,241,0.35)" }}
                      >
                        <UserRound size={11} className="text-white" />
                        <span className="text-[10px] font-black text-white tracking-wide">Stranger Call</span>
                      </div>
                      <div
                        className="flex items-center justify-center gap-1.5 py-1.5 rounded-full"
                        style={{ background: "linear-gradient(90deg,#ef4444,#f97316)", boxShadow: "0 2px 8px rgba(239,68,68,0.30)" }}
                      >
                        <Radio size={11} className="text-white" />
                        <span className="text-[10px] font-black text-white tracking-wide">Live</span>
                      </div>
                    </div>
                  </motion.button>

                  {/* ── Flicks Frame Card ──────────────────────────────────── */}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setIsFrameMode(true)}
                    className="flex flex-col items-start text-left bg-white rounded-2xl overflow-hidden"
                    style={{ border: "1.5px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
                  >
                    {/* Header row */}
                    <div className="flex items-center gap-1.5 px-3 pt-3 pb-1.5 w-full border-b border-gray-100">
                      <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                        <HelpCircle size={13} className="text-blue-600" />
                      </div>
                      <span className="text-[11px] font-black text-gray-800 leading-none">Flicks Frame</span>
                    </div>

                    {/* Category icons — 4-grid */}
                    <div className="grid grid-cols-4 gap-0 px-2 pt-2 pb-1 w-full">
                      {[
                        { icon: <Utensils size={12} className="text-blue-500" />, label: "Food" },
                        { icon: <Pill size={12} className="text-blue-500" />, label: "Med" },
                        { icon: <Shirt size={12} className="text-blue-500" />, label: "Clothes" },
                        { icon: <GraduationCap size={12} className="text-blue-500" />, label: "School" },
                      ].map(({ icon, label }) => (
                        <div key={label} className="flex flex-col items-center gap-0.5">
                          <div className="w-6 h-6 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                            {icon}
                          </div>
                          <span className="text-[7px] font-bold text-blue-400 leading-none">{label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Progress bar */}
                    <div className="px-2.5 pt-1 pb-0.5 w-full">
                      <div className="flex items-center gap-1">
                        <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full bg-blue-500" style={{ width: "50%" }} />
                        </div>
                        <HelpCircle size={9} className="text-blue-400 shrink-0" />
                      </div>
                      <p className="text-[8px] text-gray-400 font-bold mt-0.5">₹250 / ₹500</p>
                    </div>

                    {/* FREE badge */}
                    <div className="px-2.5 pb-3 w-full">
                      <div className="flex items-center gap-1.5">
                        <div className="px-2 py-0.5 rounded" style={{ background: "#fef9c3" }}>
                          <span className="text-[9px] font-black text-yellow-700 tracking-widest">FREE</span>
                        </div>
                        <span className="text-[8px] text-gray-400 font-semibold">₹250 / ₹500</span>
                      </div>
                    </div>
                  </motion.button>
                </div>

                {/* ── Magnet Dashboard full-width card ──────────────────── */}
                <div className="px-3 pb-1">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowMagnetDashboard(true)}
                    className="w-full flex items-center gap-3 bg-white rounded-2xl px-4 py-3 overflow-hidden"
                    style={{ border: "1.5px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "linear-gradient(135deg,#7c3aed,#db2777)" }}>
                      <span className="text-xl">🧲</span>
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-[13px] font-black text-gray-800 leading-none">Magnet Dashboard</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">See your sent & received magnets · Viral chain stats</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="px-2 py-0.5 rounded-full text-[9px] font-black text-white"
                        style={{ background: "linear-gradient(90deg,#7c3aed,#db2777)" }}>
                        Viral Engine
                      </div>
                      <p className="text-[9px] text-gray-400 font-semibold">Public · Anyone can view</p>
                    </div>
                  </motion.button>
                </div>

                {/* ── Hook Pages Discover Strip — mobile only (desktop → right sidebar) ── */}
                <div className="lg:hidden">
                {(() => {
                  const DEMO_HP = [
                    { id: "dhp-1", name: "Bollywood Beats", category: "Music", cover_url: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&q=80", hook_count: 4200 },
                    { id: "dhp-2", name: "Fitness Zone", category: "Health", cover_url: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&q=80", hook_count: 8100 },
                    { id: "dhp-3", name: "Tech Talks India", category: "Technology", cover_url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&q=80", hook_count: 3500 },
                    { id: "dhp-4", name: "Art Studio", category: "Art", cover_url: "https://images.unsplash.com/photo-1547826039-bfc35e0f1ea8?w=400&q=80", hook_count: 6700 },
                    { id: "dhp-5", name: "Cricket Fever", category: "Sports", cover_url: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=400&q=80", hook_count: 12000 },
                  ];
                  const pages: any[] = homeHookPages.length > 0 ? homeHookPages : DEMO_HP;
                  return (
                    <div className="pt-3 pb-1">
                      <div className="flex items-center justify-between px-3 mb-2">
                        <p className="text-[13px] font-black text-gray-700 tracking-wide">⚡ Hook Pages — Discover</p>
                        <button
                          onClick={() => { setInitialHookPageId(null); setActiveFeature("Hooks"); }}
                          className="text-[10px] font-black text-orange-500 uppercase tracking-wider"
                        >See All →</button>
                      </div>
                      <div className="flex gap-3 overflow-x-auto px-3 pb-2 no-scrollbar">
                        {pages.map((pg: any) => (
                          <motion.div
                            key={pg.id}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => { setInitialHookPageId(pg.id ?? null); setActiveFeature("Hooks"); }}
                            className="flex-shrink-0 relative rounded-2xl overflow-hidden cursor-pointer select-none shadow-md"
                            style={{ width: 168, height: 312, background: "#1f2937" }}
                          >
                            {/* Cover image — <img decoding="async"> not backgroundImage so Supabase URLs render */}
                            {pg.cover_url ? (
                              <img
                                src={pg.cover_url}
                                className="absolute inset-0 w-full h-full object-cover"
                                loading="lazy"
                                alt={pg.name}
                               decoding="async"/>
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-5xl opacity-20">⚡</span>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                            <div className="absolute top-2.5 left-2.5">
                              <span className="bg-white/20 backdrop-blur-md border border-white/30 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                                ⚡ Page
                              </span>
                            </div>
                            <div className="absolute top-2.5 right-2.5 bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5 border border-white/20">
                              <span className="text-white text-[9px] font-bold">
                                {((pg.hook_count || pg.follower_count || 0) >= 1000)
                                  ? `${((pg.hook_count || pg.follower_count || 0) / 1000).toFixed(1)}K`
                                  : (pg.hook_count || pg.follower_count || 0)}
                              </span>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 px-3 py-3">
                              <p className="text-white text-[13px] font-black leading-tight truncate drop-shadow-lg">{pg.name}</p>
                              {pg.category && (
                                <p className="text-white/70 text-[10px] font-medium mt-0.5 truncate">{pg.category}</p>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); setInitialHookPageId(pg.id ?? null); setActiveFeature("Hooks"); }}
                                className="mt-2 w-full py-2 rounded-xl text-[11px] font-black active:scale-95 transition-all"
                                style={{ background: "linear-gradient(135deg,#ff6b00,#ff9500)", color: "#fff", boxShadow: "0 0 12px rgba(255,107,0,0.45)" }}
                              >⚡ HOOK</button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                </div>{/* end lg:hidden hook pages */}

                {/* ── Flicks Strip — mobile only (desktop → right sidebar) ──── */}
                <div className="lg:hidden">
                <div className="pt-2 pb-1">
                  <p className="text-[14px] font-black text-gray-700 px-3 mb-2 tracking-wide">Flicks</p>
                  <div className="flex gap-3.5 overflow-x-auto px-3 pb-2 no-scrollbar">

                    {/* Hidden video file input */}
                    <input
                      ref={reelInputRef}
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={handleReelFileSelected}
                    />

                    {/* ── Smart "Your Reels" card ──────────────────────────── */}
                    <motion.div
                      whileTap={{ scale: 0.94 }}
                      onClick={reelUploading ? undefined : handleReelCardClick}
                      className="flex-shrink-0 relative rounded-2xl overflow-hidden shadow-md cursor-pointer"
                      style={{
                        width: "calc((100vw - 48px) / 2.4)",
                        height: "calc((100vw - 48px) / 2.4 * 1.78)",
                        maxWidth: "224px",
                        maxHeight: "392px",
                        border: myReels.length > 0 ? "2.5px solid #3b82f6" : "2.5px dashed #6366f1",
                        background: "linear-gradient(160deg,#6366f1 0%,#1e1b4b 100%)",
                      }}
                    >
                      {/* Case B: has reels → show latest auto-playing muted video */}
                      {myReels.length > 0 && myReels[0].media_url && (
                        <AutoPlayMutedVideo
                          src={myReels[0].media_url}
                          className="w-full h-full object-cover"
                        />
                      )}

                      {/* Case A: no reels → show avatar + upload hint */}
                      {myReels.length === 0 && !reelUploading && (
                        <>
                          {profile.avatar_url ? (
                            <img src={profile.avatar_url} loading="lazy" className="w-full h-full object-cover opacity-60"  decoding="async"/>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/30 font-black text-4xl">
                              {(profile?.full_name || "Y")[0]?.toUpperCase() || "Y"}
                            </div>
                          )}
                          {/* Upload "+" badge */}
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                            <div className="w-10 h-10 rounded-full bg-blue-600 border-2 border-white shadow-lg flex items-center justify-center">
                              <span className="text-white text-[20px] font-black leading-none">+</span>
                            </div>
                            <span className="text-white/90 text-[9px] font-black uppercase tracking-wider mt-1">Upload Reel</span>
                          </div>
                        </>
                      )}

                      {/* Uploading state → progress bar */}
                      {reelUploading && (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 px-3">
                          <Loader2 size={24} className="text-white animate-spin" />
                          <div className="w-full bg-white/20 rounded-full h-1.5">
                            <motion.div
                              className="bg-blue-400 h-1.5 rounded-full"
                              initial={{ width: "0%" }}
                              animate={{ width: `${reelUploadPct}%` }}
                              transition={{ duration: 0.4 }}
                            />
                          </div>
                          <span className="text-white text-[9px] font-black">{reelUploadPct}%</span>
                        </div>
                      )}

                      {/* Play icon overlay when reels exist */}
                      {myReels.length > 0 && !reelUploading && (
                        <div className="absolute top-2 right-2 bg-black/50 rounded-full p-1.5">
                          <Video size={11} className="text-white" />
                        </div>
                      )}

                      {/* Bottom label */}
                      {!reelUploading && (
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 to-transparent pt-6 pb-2 px-2">
                          <p className="text-white text-[10px] font-black truncate">
                            {myReels.length > 0 ? `My Reels (${myReels.length})` : "Your Reel"}
                          </p>
                        </div>
                      )}
                    </motion.div>

                    {/* Real posts from DB */}
                    {reelPosts.slice(0, 9).map((post, i) => {
                      const isVid = post.type === "video" || (post.media_url && (/\.(mp4|webm|ogg|mov|m4v)/i.test(post.media_url.split("?")[0]) || post.media_url.includes("rapidcdn.app")));
                      const thumb = post.media_url;
                      const GRAD = ["#ec4899","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ef4444","#06b6d4","#84cc16","#f97316"];
                      return (
                        <div key={post.id}
                          className="flex-shrink-0 relative rounded-2xl overflow-hidden border border-gray-200 shadow-md"
                          style={{ width: "calc((100vw - 48px) / 2.4)", height: "calc((100vw - 48px) / 2.4 * 1.78)", maxWidth: "224px", maxHeight: "392px", background: `linear-gradient(160deg,${GRAD[i % GRAD.length]} 0%,#1e1b4b 100%)` }}
                          onClick={() => setActiveFeature("Flicks")}
                        >
                          {/* FB-style: video posts auto-play muted; tap → opens with sound */}
                          {isVid && thumb ? (
                            <AutoPlayMutedVideo src={thumb} className="w-full h-full object-cover" />
                          ) : thumb ? (
                            <img src={thumb} loading="lazy" className="w-full h-full object-cover"  decoding="async"/>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/40">
                              <Video size={32} />
                            </div>
                          )}
                          {isVid && (
                            <div className="absolute top-2 right-2 bg-black/55 backdrop-blur-sm rounded-full p-1.5 border border-white/30">
                              <VolumeX size={11} className="text-white" />
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 to-transparent pt-7 pb-2 px-2.5">
                            <p className="text-white text-[11px] font-black truncate">{post.author || "User"}</p>
                          </div>
                        </div>
                      );
                    })}

                    {/* Placeholder if no posts yet */}
                    {reelPosts.length === 0 && [0,1].map(i => (
                      <div key={i} className="flex-shrink-0 rounded-2xl bg-gray-200 border border-gray-200"
                        style={{ width: "calc((100vw - 48px) / 2.4)", height: "calc((100vw - 48px) / 2.4 * 1.78)", maxWidth: "224px", maxHeight: "392px" }} />
                    ))}
                  </div>
                </div>
                </div>{/* end lg:hidden flicks strip */}

                {/* ── What's on your mind + News Feed ─────────────────────── */}
                <div className="mt-2">
                  <PullToRefresh
                    onRefresh={async () => {
                      window.dispatchEvent(new CustomEvent("flicks-pull-refresh"));
                      await new Promise(r => setTimeout(r, 600));
                    }}
                  >
                    <FameFeed
                      onPostClick={() => setIsPostOpen(true)}
                      onImageSelect={(f) => setPendingFile(f)}
                      userProfile={profile}
                      suggestions={onlineUsers}
                      onNavigateToCircles={() => setActiveFeature("Circle")}
                      onNavigateToPages={() => setActiveFeature("Hooks")}
                      onNavigateToFlicks={() => setActiveFeature("Flicks")}
                      isAdmin={isAppAdmin}
                    />
                  </PullToRefresh>
                </div>

                </div>{/* ═══ end CENTER COLUMN ═══ */}

                {/* ══ RIGHT SIDEBAR — desktop only ═════════════════════════════ */}
                <aside className="hidden lg:flex flex-col gap-3 self-start pb-6" style={{ position: 'sticky', top: '80px' }}>

                  {/* ── Active Circles — up to 10 (sticky right panel) ── */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-4 pt-3 pb-1">
                      <p className="text-[11px] font-black text-gray-700 uppercase tracking-widest">🔵 Active Circles</p>
                      <button
                        onClick={() => setActiveFeature("Circle")}
                        className="text-[10px] font-black text-blue-500 hover:underline"
                      >See all</button>
                    </div>
                    {(sidebarCircles.length > 0 ? sidebarCircles : [
                      { id: "dc-1",  name: "Bollywood Fans",     category: "Entertainment", cover_url: "https://images.unsplash.com/photo-1536240478700-b869ad10e2c7?w=200&q=70",  member_count: 0 },
                      { id: "dc-2",  name: "Cricket Warriors",   category: "Sports",        cover_url: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=200&q=70",  member_count: 0 },
                      { id: "dc-3",  name: "Tech Geeks India",   category: "Technology",    cover_url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=200&q=70",  member_count: 0 },
                      { id: "dc-4",  name: "Foodie Nation",      category: "Food",          cover_url: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200&q=70",  member_count: 0 },
                      { id: "dc-5",  name: "Fitness Freaks",     category: "Health",        cover_url: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=200&q=70",  member_count: 0 },
                      { id: "dc-6",  name: "Travel India",       category: "Travel",        cover_url: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=200&q=70",  member_count: 0 },
                      { id: "dc-7",  name: "Music Lovers",       category: "Music",         cover_url: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&q=70",  member_count: 0 },
                      { id: "dc-8",  name: "Startup Talks",      category: "Business",      cover_url: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=200&q=70",  member_count: 0 },
                      { id: "dc-9",  name: "Desi Memes Club",    category: "Comedy",        cover_url: "https://images.unsplash.com/photo-1527224538127-2104bb71c51b?w=200&q=70",  member_count: 0 },
                      { id: "dc-10", name: "Devotional Bhakti",  category: "Spiritual",     cover_url: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=200&q=70",  member_count: 0 },
                    ] as any[]).slice(0, 10).map((c: any) => (
                      <button
                        key={c.id}
                        onClick={() => setActiveFeature("Circle")}
                        className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-gray-50 transition-colors text-left border-t border-gray-100"
                      >
                        <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-gray-200">
                          {c.cover_url && <img src={c.cover_url} className="w-full h-full object-cover" loading="lazy" alt=""  decoding="async"/>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-black text-gray-800 truncate leading-none">{c.name}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5 font-medium">{c.category || 'General'}</p>
                        </div>
                        {(c.member_count ?? 0) > 0 && (
                          <span className="text-[9px] font-black text-blue-400 shrink-0">
                            {c.member_count > 999 ? `${(c.member_count / 1000).toFixed(1)}K` : c.member_count} 👥
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Flicks preview — 3-column thumbnail grid */}
                  {reelPosts.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="flex items-center justify-between px-4 pt-3 pb-2">
                        <p className="text-[11px] font-black text-gray-700 uppercase tracking-widest">🎬 Flicks</p>
                        <button onClick={() => setActiveFeature("Flicks")}
                          className="text-[10px] font-black text-blue-500 hover:underline">Open all</button>
                      </div>
                      <div className="grid grid-cols-3 gap-0.5 px-3 pb-3">
                        {reelPosts.slice(0, 6).map((post, i) => {
                          const GRAD = ["#ec4899","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ef4444"];
                          return (
                            <div key={post.id}
                              className="relative rounded-lg overflow-hidden cursor-pointer"
                              style={{ aspectRatio: "9/16", background: `linear-gradient(160deg,${GRAD[i%GRAD.length]},#1e1b4b)` }}
                              onClick={() => setActiveFeature("Flicks")}
                            >
                              {post.media_url && <img src={post.media_url} className="w-full h-full object-cover" loading="lazy"  decoding="async"/>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                </aside>

                </div>{/* ═══ end desktop grid wrapper ═══ */}

              </div>
              </Suspense>
              </ErrorBoundary>
            )}

            {/* 2. FACE ─────────────────────────────────────────────────────── */}
            {activeFeature === "Face" && (
              <ErrorBoundary>
              <div className="space-y-4">
                <GlassCard className="sm:rounded-[3rem] p-6 overflow-hidden relative border-x-0 sm:border-x">
                  <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-blue-600/40 to-purple-600/40" />
                  <div className="relative z-10 flex flex-col items-center mt-6">
                    <div className="w-28 h-28 rounded-[2.2rem] bg-white/20 p-1 backdrop-blur-md relative shadow-2xl">
                      {profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          className="w-full h-full object-cover rounded-[1.8rem]"
                         decoding="async"/>
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
                      {profile?.full_name || (userEmail || "").split("@")[0] || "User"}
                    </h2>
                    <p className="text-blue-400 font-bold text-[10px] uppercase tracking-widest">
                      @{profile?.username || (userEmail || "").split("@")[0] || "user"}
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

                {/* ── My Frame Requests ──────────────────────────────────── */}
                <GlassCard className="sm:rounded-[2.5rem] border-x-0 sm:border-x border border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Handshake size={14} className="text-amber-400" />
                      <p className="text-xs font-black text-white/80 uppercase tracking-widest">My Frame Requests</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-[10px] font-black text-green-400">Live</span>
                    </div>
                  </div>

                  {myFrameRequests.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
                      <p className="text-2xl">🙏</p>
                      <p className="text-xs font-black text-white/30">Koi request nahi abhi tak</p>
                      <button
                        onClick={() => setIsFrameMode(true)}
                        className="mt-1 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-black"
                      >
                        Submit Help Request
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {myFrameRequests.map(req => {
                        const cat = FRAME_CATS[req.category as keyof typeof FRAME_CATS] || FRAME_CATS.Food;
                        const pct = Math.min(100, Math.round((req.collected_amount / req.target_amount) * 100));
                        const done = req.status === "completed" || pct >= 100;
                        return (
                          <div key={req.id} className="bg-white/5 border border-white/10 rounded-2xl p-3">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-lg shrink-0">{cat.icon}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-black text-white truncate">{req.needy_name}</p>
                                <p className="text-[10px] text-white/40">#{req.request_code}</p>
                              </div>
                              {done ? (
                                <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/20 border border-green-500/30 text-[9px] font-black text-green-400 shrink-0">
                                  <CheckCircle size={9} /> Completed
                                </span>
                              ) : req.is_priority ? (
                                <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-[9px] font-black text-yellow-400 shrink-0">
                                  <Star size={9} fill="currentColor" /> Priority
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-[9px] font-black text-blue-400 shrink-0">
                                  <Shield size={9} /> Verifying
                                </span>
                              )}
                            </div>
                            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <div className={`h-full ${cat.bar} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                            </div>
                            <div className="flex justify-between mt-1">
                              <span className="text-[10px] text-white/40 font-bold">₹{req.collected_amount.toFixed(2)} raised</span>
                              <span className="text-[10px] text-white/40 font-bold">{pct}% of ₹{req.target_amount}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </GlassCard>
              </div>
              </ErrorBoundary>
            )}

            {/* 3. FLICKS ───────────────────────────────────────────────────── */}
            {activeFeature === "Flicks" && (
              <ErrorBoundary>
              <Suspense fallback={<SectionLoader />}>
              <div className="fixed inset-0 z-[300] bg-black">
                <FlicksFeed onBack={() => setActiveFeature("Fame")} isAdmin={isAppAdmin} currentUserEmail={userEmail} />
              </div>
              </Suspense>
              </ErrorBoundary>
            )}

            {/* 4. CIRCLE (Groups) ──────────────────────────────────────────── */}
            {activeFeature === "Circle" && (
              <ErrorBoundary>
              <Suspense fallback={<SectionLoader />}>
              <div className="min-h-screen bg-gray-50">
                <CirclePage userProfile={profile} currentUserId={userId} />
              </div>
              </Suspense>
              </ErrorBoundary>
            )}

            {/* 5. SNAPY (legacy — kept for back-compat) ───────────────────── */}
            {activeFeature === "Snapy" && (
              <ErrorBoundary>
              <Suspense fallback={<SectionLoader />}>
                <SnapyStudio userId={userId} />
              </Suspense>
              </ErrorBoundary>
            )}

            {/* 5. FAME · QUOTES MAKER ─────────────────────────────────────── */}
            {activeFeature === "QuotesMaker" && (
              <ErrorBoundary>
              <Suspense fallback={<SectionLoader />}>
              <QuotesMaker
                userId={userId}
                onClose={() => setActiveFeature("Fame")}
              />
              </Suspense>
              </ErrorBoundary>
            )}

            {/* HOOKS ───────────────────────────────────────────────────────── */}
            {activeFeature === "Hooks" && (
              <ErrorBoundary>
              <Suspense fallback={<SectionLoader />}>
                <HooksHub userId={userId} initialOpenPageId={initialHookPageId} />
              </Suspense>
              </ErrorBoundary>
            )}

            {/* 5. TASK (Personal Task Board) ───────────────────────────────── */}
            {activeFeature === "Task" && (
              <ErrorBoundary>
              <Suspense fallback={<SectionLoader />}>
                <TaskBoard userId={userId} />
              </Suspense>
              </ErrorBoundary>
            )}

            {/* 7. STUDIO (Verified Creator) ────────────────────────────────── */}
            {activeFeature === "Studio" && (
              <ErrorBoundary>
              <Suspense fallback={<SectionLoader />}>
                <FlicksStudio userId={userId} />
              </Suspense>
              </ErrorBoundary>
            )}

            {/* ANTAKSHARI ARENA ──────────────────────────────────────────────── */}
            {activeFeature === "Antakshari" && (
              <ErrorBoundary>
              <Suspense fallback={<SectionLoader />}>
                <AntakshariArena
                  userId={userId}
                  userProfile={profile}
                  onBack={() => setActiveFeature("Fame")}
                />
              </Suspense>
              </ErrorBoundary>
            )}

            {/* 6. SETTINGS ─────────────────────────────────────────────────── */}
            {activeFeature === "Settings" && (
              <ErrorBoundary>
              <div className="w-full min-h-screen pb-32">
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
                      userId={userId}
                      currentAvatarUrl={profile.avatar_url}
                      onAvatarUpdated={(url) => setProfile(prev => ({ ...prev, avatar_url: url }))}
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
                {settingsView === "privacy" && (
                  <motion.div
                    key="privacy"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <PrivacyPolicyView setSettingsView={setSettingsView} lang={lang} />
                  </motion.div>
                )}
                {settingsView === "help" && (
                  <motion.div
                    key="help"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <HelpSupportView setSettingsView={setSettingsView} lang={lang} />
                  </motion.div>
                )}
                {settingsView === "about" && (
                  <motion.div
                    key="about"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <AboutUsView setSettingsView={setSettingsView} />
                  </motion.div>
                )}
                {settingsView === "contact" && (
                  <motion.div
                    key="contact"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <ContactUsView setSettingsView={setSettingsView} />
                  </motion.div>
                )}
              </AnimatePresence>
              </div>
              </ErrorBoundary>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Chat System ───────────────────────────────────────────────────────── */}
      <ErrorBoundary>
      <Suspense fallback={null}>
      <ChatSystem
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        userId={userId}
        userEmail={userEmail}
        onLogout={handleLogout}
        onUnreadCountChange={setChatBadgeCount}
      />
      </Suspense>
      </ErrorBoundary>

      {/* Chat FAB ──────────────────────────────────────────────────────────── */}
      <motion.button
        animate={{
          y: activeFeature !== "Flicks" && !isChatOpen ? 0 : 150,
          opacity: isChatOpen ? 0 : 1,
        }}
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-32 right-6 w-16 h-16 bg-blue-600 rounded-full shadow-2xl flex items-center justify-center z-[80] border-2 border-white/20 active:scale-90"
      >
        <MessageSquare size={28} fill="currentColor" />
        {chatBadgeCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[24px] h-6 px-1 bg-red-500 rounded-full border-2 border-white text-[10px] font-black flex items-center justify-center animate-bounce">
            {chatBadgeCount > 99 ? "99+" : chatBadgeCount}
          </span>
        )}
      </motion.button>

      {/* Side DVD-Tray Nav ──────────────────────────────────────────────── */}
      <GolSlider
        activeFeature={activeFeature}
        hidden={isChatOpen}
        isAdmin={isAppAdmin}
        onFeatureChange={(f) => {
          if (f === "Admin") {
            // Hard guard — even though the slot only renders for admins,
            // double-check email before opening the dashboard.
            if (isAppAdmin) setIsAdminPanelOpen(true);
            return;
          }
          if (f === "Circle") { setActiveFeature("Circle"); return; }
          setActiveFeature(f);
          setSettingsView("main");
        }}
      />

      {/* ── Admin Dashboard modal (gated by email) ──────────────────────── */}
      <AnimatePresence>
        {isAdminPanelOpen && isAppAdmin && (
          <ErrorBoundary>
          <Suspense fallback={null}>
          <AdminDashboard
            onClose={() => setIsAdminPanelOpen(false)}
            currentUserId={userId}
            currentUserEmail={userEmail}
          />
          </Suspense>
          </ErrorBoundary>
        )}
      </AnimatePresence>

      <Suspense fallback={null}>
      <CreatePost
        isOpen={isPostOpen}
        onClose={() => { setIsPostOpen(false); setPendingFile(null); }}
        userProfile={profile}
        initialFile={pendingFile}
      />
      </Suspense>
    </div>
  );
};

export default Index;
