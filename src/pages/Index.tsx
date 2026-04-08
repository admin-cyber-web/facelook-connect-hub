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
  Share2,
  Trash2,
  HelpCircle,
  Utensils,
  Pill,
  Shirt,
  GraduationCap,
  Radio,
  UserRound,
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
import ConnectionPanel from "@/components/ConnectionPanel";
import CirclePage from "@/components/CirclePage";
import HooksHub from "@/components/HooksHub";
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
  const ADMIN_EMAIL = "tiwarijhumki@gmail.com";
  const isAdmin = userEmail === ADMIN_EMAIL;

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
        .select("*")
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

    console.log("Asli Insert Result:", { data, error });

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
        await navigator.share({ title: "Facelook Frame", text: "Zarooratmand ki madad karein!", url: window.location.origin });
      } else {
        await navigator.clipboard.writeText(window.location.origin);
        alert("Link copy ho gaya! Share karein apne doston ke saath 🤝");
      }
    } catch (_) {}
  };

  const handleShareRequest = async (req: FrameRequest) => {
    const shareText = `🙏 *Madad Karen!* — Facelook Frame\n\n👤 Zarooratmand: *${req.needy_name}*\n📦 Zaroorat: *${req.category}*\n🎯 Target Amount: *₹${req.target_amount}*\n📍 Address: ${req.address}\n\nAd dekh kar help karein ya share karein:\n🔗 ${window.location.origin}\n\n🆔 Request Code: *#${req.request_code}*\n\n— Facelook Frame Team 🤝`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Help ${req.needy_name} — Facelook Frame`,
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
          <p className="text-sm font-black text-amber-900 leading-none">FACELOOK FRAME</p>
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
              className="fixed bottom-0 left-0 w-full z-[61] bg-white rounded-t-3xl border-t-2 border-amber-200 max-h-[92vh] overflow-y-auto"
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
                    <img src={userProfile.avatar_url} className="w-10 h-10 rounded-full object-cover border-2 border-amber-300" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-amber-400 flex items-center justify-center text-white font-black">
                      {(userProfile?.full_name || "U")[0]}
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-sm text-gray-900">{userProfile?.full_name || "Anonymous"}</p>
                    <p className="text-[10px] text-gray-500">Verified Facelook User</p>
                  </div>
                </div>
              </div>

              <div className="px-4 py-4 space-y-4">
                <div>
                  <p className="text-xs font-black text-gray-700 mb-2">Zarooratmand ki Photo</p>
                  <label className="flex flex-col items-center justify-center w-full h-32 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 cursor-pointer overflow-hidden">
                    {photoPreview ? (
                      <img src={photoPreview} className="w-full h-full object-cover" />
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
                    placeholder="Jaise: Ramesh Kumar" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-amber-400/40" />
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
                    rows={3} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-amber-400/40 resize-none" />
                </div>

                <div>
                  <p className="text-xs font-black text-gray-700 mb-1.5">Mobile No. *</p>
                  <input value={formData.mobile} onChange={e => fld("mobile", e.target.value)}
                    placeholder="+91 XXXXX XXXXX" type="tel"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-amber-400/40" />
                </div>

                <div>
                  <p className="text-xs font-black text-gray-700 mb-1.5">Zaroorat ka Karan (Optional)</p>
                  <textarea value={formData.description} onChange={e => fld("description", e.target.value)}
                    placeholder="Thodi si aur baat..."
                    rows={2} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-amber-400/40 resize-none" />
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
              <div className="bg-white rounded-3xl p-6 w-full max-w-sm text-center border-2 border-amber-300 shadow-2xl">
                <div className="text-5xl mb-3">✅</div>
                <p className="text-lg font-black text-amber-900 mb-2">Request Submit Ho Gayi!</p>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">
                  हमें भरोसा है कि आपकी यह कोशिश किसी की ज़िंदगी बदल देगी।<br/>
                  <span className="text-amber-700 font-bold">Facelook Frame Team</span> jald hi verify karegi.
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
              className="fixed bottom-0 left-0 w-full z-[71] bg-white rounded-t-3xl border-t-2 border-amber-200 px-5 pt-5 pb-8"
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
                    className="w-full py-4 rounded-2xl bg-gray-100 text-gray-700 font-black text-sm flex items-center justify-center gap-2">
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
              className="fixed bottom-24 right-4 z-[81] bg-white rounded-3xl border-2 border-amber-300 shadow-2xl p-5 w-72"
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
                <div key={req.id} className="flex items-center justify-between bg-white rounded-2xl px-3 py-2 border border-yellow-200">
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
                className={`bg-white rounded-3xl border-2 overflow-hidden shadow-sm ${req.is_priority ? "border-yellow-400 shadow-yellow-100" : done ? "border-green-200" : "border-amber-100"}`}
              >
                {req.is_priority ? (
                  <div className="bg-gradient-to-r from-yellow-400 to-amber-400 px-4 py-1.5 flex items-center gap-2">
                    <Star size={11} className="text-white fill-white" />
                    <p className="text-[10px] font-black text-white uppercase tracking-widest">Priority Mission</p>
                  </div>
                ) : (
                  <div className="bg-blue-50 border-b border-blue-100 px-4 py-1.5 flex items-center gap-1.5">
                    <Shield size={10} className="text-blue-500 shrink-0" />
                    <p className="text-[10px] font-black text-blue-600 tracking-wide">Under Facelook Verification</p>
                  </div>
                )}

                <div className="px-4 pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="relative shrink-0">
                      {req.user_avatar ? (
                        <img src={req.user_avatar} className="w-10 h-10 rounded-full object-cover border-2 border-amber-200" />
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
                      <img src={req.needy_photo_url} className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-100 shrink-0" />
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

// ── Personal Info sub-view (outside Index to prevent focus loss) ──────────────
interface PersonalInfoViewProps {
  lang: "en" | "hi";
  setSettingsView: (v: "main" | "personal" | "blocklist") => void;
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
      window.dispatchEvent(new CustomEvent("facelook-avatar-updated", { detail: { url: publicUrl } }));
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
                <img src={avatarPreview} className="w-full h-full object-cover" alt="Profile" />
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
const Index = ({ session }: { session: Session }) => {
  const userId = session.user.id;
  const userEmail = session.user.email || "";

  // Core UI
  const [activeFeature, setActiveFeature] = useState("Fame");
  const [isUploading, setIsUploading] = useState(false);
  const [isPostOpen, setIsPostOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showNav, setShowNav] = useState(true);
  const [bgImage, setBgImage] = useState(
    localStorage.getItem("facelook-bg") || "",
  );
  const lastScrollY = useRef(0);

  // Chat
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatBadgeCount, setChatBadgeCount] = useState(0);

  // Frame Mode
  const [isFrameMode, setIsFrameMode] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<{ id: string; full_name: string; avatar_url: string }[]>([]);
  const [myFrameRequests, setMyFrameRequests] = useState<FrameRequest[]>([]);
  // Agora Video Call modal
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false);

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

  // ── Reel posts (real videos/posts for Flicks strip) ──────────────────────
  const [reelPosts, setReelPosts] = useState<any[]>([]);

  // ── Current user's own reels ──────────────────────────────────────────────
  const [myReels, setMyReels]           = useState<any[]>([]);
  const [reelUploadPct, setReelUploadPct] = useState(0);   // 0 = idle
  const [reelUploading, setReelUploading] = useState(false);
  const reelInputRef = useRef<HTMLInputElement>(null);

  const fetchMyReels = () => {
    supabase.from("posts")
      .select("id, media_url, type, content, created_at")
      .eq("author_id", userId)
      .eq("type", "video")
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => { if (data) setMyReels(data); });
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
    supabase.from("profiles").select("id, full_name, avatar_url")
      .neq("id", userId).limit(8)
      .then(({ data }) => { if (data) setOnlineUsers(data); });

    supabase.from("posts")
      .select("id, author, author_id, media_url, type, metadata, content")
      .order("created_at", { ascending: false })
      .limit(15)
      .then(({ data }) => { if (data) setReelPosts(data); });

    fetchMyReels();
  }, [userId]);

  // ── My Frame Requests — fetch + realtime ──────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("frame_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setMyFrameRequests(data as FrameRequest[]); });

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
      window.dispatchEvent(new CustomEvent("facelook-profile-updated"));
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
          desc={t("Facelook", "फेसलुक")}
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
            <FrameModePage onBack={() => setIsFrameMode(false)} userProfile={profile} userEmail={userEmail} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Agora Video Call bottom-sheet (FACELOOK FUN CALL) ───────────────── */}
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
                  <p className="text-sm font-black text-white">FACELOOK FUN CALL</p>
                  <p className="text-[10px] text-violet-400">Stranger se live video call karo</p>
                </div>
                <button
                  onClick={() => setIsVideoCallOpen(false)}
                  className="p-2 rounded-xl bg-white/10 text-white/50 hover:text-white text-xs font-black"
                >
                  ✕ Close
                </button>
              </div>
              <ConnectionPanel />
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
          userId={userId}
        />
      )}

      <main
        className={`relative z-10 transition-all duration-500 
          ${activeFeature === "Flicks" ? "pt-0 pb-0" : "pt-0 pb-24"} 
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
              <div className="w-full overflow-y-auto bg-[#f0f2f5] min-h-screen">

                {/* ── Feature Cards: Fun Call + Frame (Section B style) ────── */}
                <div className="px-3 pt-3 pb-1 grid grid-cols-2 gap-2.5">

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

                  {/* ── Facelook Frame Card ──────────────────────────────────── */}
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
                      <span className="text-[11px] font-black text-gray-800 leading-none">Facelook Frame</span>
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

                {/* ── Flicks Strip (real posts, 3× size, 3 visible) ────────── */}
                <div className="pt-2 pb-1">
                  <p className="text-[12px] font-black text-gray-700 px-3 mb-2">Flicks</p>
                  <div className="flex gap-3 overflow-x-auto px-3 pb-2 no-scrollbar">

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
                        width: "calc((100vw - 48px) / 3)",
                        height: "calc((100vw - 48px) / 3 * 1.78)",
                        maxWidth: "160px",
                        maxHeight: "280px",
                        border: myReels.length > 0 ? "2.5px solid #3b82f6" : "2.5px dashed #6366f1",
                        background: "linear-gradient(160deg,#6366f1 0%,#1e1b4b 100%)",
                      }}
                    >
                      {/* Case B: has reels → show latest thumbnail */}
                      {myReels.length > 0 && myReels[0].media_url && (
                        <video
                          src={myReels[0].media_url}
                          className="w-full h-full object-cover"
                          muted playsInline preload="metadata"
                        />
                      )}

                      {/* Case A: no reels → show avatar + upload hint */}
                      {myReels.length === 0 && !reelUploading && (
                        <>
                          {profile.avatar_url ? (
                            <img src={profile.avatar_url} loading="lazy" className="w-full h-full object-cover opacity-60" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/30 font-black text-4xl">
                              {(profile.full_name || "Y")[0]}
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
                          className="flex-shrink-0 relative rounded-2xl overflow-hidden border border-gray-200 shadow-sm"
                          style={{ width: "calc((100vw - 48px) / 3)", height: "calc((100vw - 48px) / 3 * 1.78)", maxWidth: "160px", maxHeight: "280px", background: `linear-gradient(160deg,${GRAD[i % GRAD.length]} 0%,#1e1b4b 100%)` }}
                          onClick={() => setActiveFeature("Flicks")}
                        >
                          {thumb && !isVid ? (
                            <img src={thumb} loading="lazy" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/40">
                              <Video size={32} />
                            </div>
                          )}
                          {isVid && (
                            <div className="absolute top-2 right-2 bg-black/50 rounded-full p-1">
                              <Video size={10} className="text-white" />
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-6 pb-2 px-2">
                            <p className="text-white text-[10px] font-black truncate">{post.author || "User"}</p>
                          </div>
                        </div>
                      );
                    })}

                    {/* Placeholder if no posts yet */}
                    {reelPosts.length === 0 && [0,1].map(i => (
                      <div key={i} className="flex-shrink-0 rounded-2xl bg-gray-200 border border-gray-200"
                        style={{ width: "calc((100vw - 48px) / 3)", height: "calc((100vw - 48px) / 3 * 1.78)", maxWidth: "160px", maxHeight: "280px" }} />
                    ))}
                  </div>
                </div>

                {/* ── What's on your mind + News Feed ─────────────────────── */}
                <div className="mt-2">
                  <FameFeed
                    onPostClick={() => setIsPostOpen(true)}
                    onImageSelect={(f) => setPendingFile(f)}
                    userProfile={profile}
                    suggestions={onlineUsers}
                    onNavigateToCircles={() => setActiveFeature("Circle")}
                    onNavigateToPages={() => setActiveFeature("Circle")}
                    onNavigateToFlicks={() => setActiveFeature("Flicks")}
                  />
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
            )}

            {/* 3. FLICKS ───────────────────────────────────────────────────── */}
            {activeFeature === "Flicks" && (
              <div className="fixed inset-0 z-[300] bg-black">
                <FlicksFeed onBack={() => setActiveFeature("Fame")} />
              </div>
            )}

            {/* 4. CIRCLE (Groups) ──────────────────────────────────────────── */}
            {activeFeature === "Circle" && (
              <div className="min-h-screen bg-gray-50">
                <CirclePage userProfile={profile} currentUserId={userId} />
              </div>
            )}

            {/* 5. SNAPY ────────────────────────────────────────────────────── */}
            {activeFeature === "Snapy" && (
              <SnapyStudio userId={userId} />
            )}

            {/* HOOKS ───────────────────────────────────────────────────────── */}
            {activeFeature === "Hooks" && (
              <HooksHub userId={userId} />
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
        onLogout={handleLogout}
        onUnreadCountChange={setChatBadgeCount}
      />

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
        onFeatureChange={(f) => {
          if (f === "Circle") { setActiveFeature("Circle"); return; }
          setActiveFeature(f);
          setSettingsView("main");
        }}
      />

      <CreatePost
        isOpen={isPostOpen}
        onClose={() => { setIsPostOpen(false); setPendingFile(null); }}
        userProfile={profile}
        initialFile={pendingFile}
      />
    </div>
  );
};

export default Index;
