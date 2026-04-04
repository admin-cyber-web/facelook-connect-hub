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
import ConnectionPanel from "@/components/ConnectionPanel";
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
  Food:      { icon: "🍱", target: 50,  perAd: 5,  badge: "bg-orange-100 text-orange-700", bar: "bg-orange-400" },
  Medicine:  { icon: "💊", target: 200, perAd: 20, badge: "bg-green-100 text-green-700",   bar: "bg-green-500"  },
  Clothing:  { icon: "👕", target: 100, perAd: 10, badge: "bg-blue-100 text-blue-700",     bar: "bg-blue-500"   },
  Shoes:     { icon: "👟", target: 80,  perAd: 8,  badge: "bg-purple-100 text-purple-700", bar: "bg-purple-500" },
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
}

// ── Frame Mode full-screen view ────────────────────────────────────────────────
function FrameModePage({ onBack, userProfile }: { onBack: () => void; userProfile: any }) {
  const [requests, setRequests]       = useState<FrameRequest[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successCode, setSuccessCode] = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const [adWatching, setAdWatching]   = useState<string | null>(null);
  const [supported, setSupported]     = useState<Set<string>>(new Set());
  const [helpPopup, setHelpPopup]     = useState<string | null>(null);
  const [formData, setFormData]       = useState({
    needy_name: "", address: "", category: "Food" as FrameCategory, mobile: "", description: "",
  });
  const [photoFile, setPhotoFile]       = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Fetch requests from DB + realtime
  useEffect(() => {
    fetchRequests();
    const ch = supabase
      .channel("frame-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "frame_requests" }, fetchRequests)
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, []);

  const fetchRequests = async () => {
    try {
      const { data } = await supabase
        .from("frame_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
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
    const code      = Math.floor(100000 + Math.random() * 900000).toString();
    const catCfg    = FRAME_CATS[formData.category];
    try {
      await supabase.from("frame_requests").insert({
        request_code: code,
        user_id:      userProfile?.id || "",
        user_name:    userProfile?.full_name || "Anonymous",
        user_avatar:  userProfile?.avatar_url || "",
        needy_name:   formData.needy_name,
        needy_photo_url,
        address:      formData.address,
        category:     formData.category,
        mobile:       formData.mobile,
        description:  formData.description,
        collected_amount: 0,
        target_amount:    catCfg.target,
        support_count:    0,
        status:           "active",
      });
      setSuccessCode(code);
      setShowForm(false);
      setShowSuccess(true);
      setFormData({ needy_name: "", address: "", category: "Food", mobile: "", description: "" });
      setPhotoFile(null);
      setPhotoPreview("");
      fetchRequests();
    } catch (_) {
      alert("Submit failed. Please run the SQL setup in Supabase first.");
    }
    setSubmitting(false);
  };

  const handleWatchAd = async (reqId: string) => {
    setAdWatching(reqId);
    // Simulate rewarded ad (2s)
    await new Promise(r => setTimeout(r, 2000));
    const req    = requests.find(r => r.id === reqId);
    if (!req) { setAdWatching(null); return; }
    const cat    = FRAME_CATS[req.category as FrameCategory];
    const perAd  = cat?.perAd || 5;
    const target = req.target_amount;
    const newAmt = Math.min((req.collected_amount || 0) + perAd, target);
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

  const fld = (k: keyof typeof formData, v: string) =>
    setFormData(prev => ({ ...prev, [k]: v }));

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-amber-50 via-white to-amber-50 overflow-y-auto pb-10">

      {/* ── Sticky Header ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-50 w-full bg-white/90 backdrop-blur-xl border-b-2 border-amber-200 flex items-center gap-3 px-4 py-3 shadow-sm">
        <button onClick={onBack} className="p-2 rounded-xl bg-amber-100 border border-amber-200 text-amber-700 active:scale-95">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <p className="text-sm font-black text-amber-900 leading-none">FACELOOK FRAME</p>
          <p className="text-[10px] text-amber-600 font-semibold">Ab Har Zarooratmand Hoga Frame</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-black text-xs shadow-md shadow-amber-200 relative"
        >
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500" />
          <Handshake size={14} /> Submit Help Request
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

              {/* Reporter (auto-filled) */}
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
                {/* Needy person's photo */}
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

                {/* Needy name */}
                <div>
                  <p className="text-xs font-black text-gray-700 mb-1.5">Zarooratmand ka Naam *</p>
                  <input value={formData.needy_name} onChange={e => fld("needy_name", e.target.value)}
                    placeholder="Jaise: Ramesh Kumar" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-amber-400/40" />
                </div>

                {/* Category */}
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
                  <p className="text-[10px] text-amber-600 mt-1 font-semibold">
                    Target: ₹{FRAME_CATS[formData.category].target} · Ad se +₹{FRAME_CATS[formData.category].perAd} per watch
                  </p>
                </div>

                {/* Address */}
                <div>
                  <p className="text-xs font-black text-gray-700 mb-1.5">Pura Address *</p>
                  <textarea value={formData.address} onChange={e => fld("address", e.target.value)}
                    placeholder="Gali, Mohalla, Sheher, State..."
                    rows={3} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-amber-400/40 resize-none" />
                </div>

                {/* Mobile */}
                <div>
                  <p className="text-xs font-black text-gray-700 mb-1.5">Mobile No. *</p>
                  <input value={formData.mobile} onChange={e => fld("mobile", e.target.value)}
                    placeholder="+91 XXXXX XXXXX" type="tel"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-amber-400/40" />
                </div>

                {/* Description */}
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
                <p className="font-black text-gray-900 text-base leading-snug">
                  आपका एक छोटा सा प्रयास
                </p>
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
                    <Video size={18} /> Watch Ad & Help (+₹{FRAME_CATS[(requests.find(r=>r.id===helpPopup)?.category as FrameCategory) || "Food"]?.perAd || 5})
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

      {/* ── Help Wall header strip ─────────────────────────────────────────── */}
      <div className="w-full px-4 pt-5 pb-3 flex items-center justify-between">
        <p className="text-xs font-black text-amber-700 uppercase tracking-widest flex items-center gap-2">
          <Handshake size={13} /> Frame Wall — Active Requests
        </p>
        {loading && <Loader2 size={14} className="animate-spin text-amber-400" />}
      </div>

      {/* ── Request Cards ──────────────────────────────────────────────────── */}
      {!loading && requests.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <p className="text-5xl mb-4">🙏</p>
          <p className="font-black text-gray-600 text-base">Abhi koi request nahi hai</p>
          <p className="text-sm text-gray-400 mt-1">Pehli help request submit karein!</p>
          <button onClick={() => setShowForm(true)}
            className="mt-4 px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-black text-sm shadow-md">
            Submit Help Request ➕
          </button>
        </div>
      )}

      <div className="px-4 space-y-4 pb-6">
        <AnimatePresence>
          {requests.map((req) => {
            const cat      = FRAME_CATS[req.category as FrameCategory] || FRAME_CATS.Food;
            const pct      = Math.min(100, Math.round((req.collected_amount / req.target_amount) * 100));
            const done     = req.status === "completed" || pct >= 100;
            const isSupp   = supported.has(req.id);
            const timeAgo  = (() => {
              const d = (Date.now() - new Date(req.created_at).getTime()) / 1000;
              if (d < 3600) return `${Math.floor(d / 60)}m ago`;
              if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
              return `${Math.floor(d / 86400)}d ago`;
            })();

            return (
              <motion.div key={req.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className={`bg-white rounded-3xl border-2 overflow-hidden shadow-sm ${done ? "border-green-200" : "border-amber-100"}`}
              >
                {/* Reporter + Needy row */}
                <div className="px-4 pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    {/* Reporter */}
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
                    <span className={`text-[10px] font-black px-2 py-1 rounded-full ${cat.badge}`}>
                      {cat.icon} {req.category}
                    </span>
                  </div>

                  {/* Needy info row */}
                  <div className="flex items-start gap-3 mb-3">
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
                        <span>₹{req.collected_amount} collected</span>
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
                <div className="px-4 pb-4 flex items-center justify-between border-t border-gray-50 pt-3">
                  <button onClick={() => handleSupport(req.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all ${isSupp ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>
                    <Heart size={13} fill={isSupp ? "#D97706" : "none"} stroke={isSupp ? "#D97706" : "currentColor"} />
                    {req.support_count} Support{req.support_count !== 1 ? "s" : ""}
                  </button>
                  {!done && (
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => setHelpPopup(req.id)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-xs font-black shadow-sm"
                    >
                      <Video size={13} /> Help Karein
                    </motion.button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
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
  const [pendingFile, setPendingFile] = useState<File | null>(null);
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

                {/* ── Facelook Fun Call Button — edge-to-edge ─────────────── */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setIsVideoCallOpen(true)}
                  className="w-full flex items-center justify-between px-5 py-4 bg-gradient-to-r from-violet-800 via-purple-800 to-indigo-900 border-y border-violet-500/20 shadow-lg active:opacity-90 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                      <Video size={20} className="text-white" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-black text-white tracking-wide">FACELOOK FUN CALL</p>
                      <p className="text-[10px] text-violet-300">Stranger se video call karo</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-green-400 uppercase tracking-wider">LIVE</span>
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <PhoneCall size={18} className="text-green-400" />
                  </div>
                </motion.button>

                {/* ── Facelook Frame Gateway ──────────────────────────────── */}
                <div className="w-full border-t-2 border-b-2 border-amber-500/30 bg-gradient-to-r from-[#1a0a00]/80 via-[#2a1500]/60 to-[#1a0a00]/80 backdrop-blur-xl py-5 px-6 relative overflow-hidden">
                  {/* Golden halo glow */}
                  <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 via-transparent to-amber-500/5 pointer-events-none" />
                  <div className="absolute -top-px left-0 w-full h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
                  <div className="absolute -bottom-px left-0 w-full h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />

                  <div className="flex items-center gap-5 relative z-10">
                    {/* Humanity illustration — two people reaching toward each other */}
                    <div className="shrink-0 w-[72px] h-[56px]">
                      <svg viewBox="0 0 72 56" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                        {/* Left person */}
                        <circle cx="13" cy="11" r="7" fill="#F59E0B" fillOpacity="0.9"/>
                        <path d="M4 26 Q13 19 22 26 L22 44 Q13 48 4 44 Z" fill="#FDE68A" fillOpacity="0.7"/>
                        {/* Left arm reaching right */}
                        <path d="M22 33 Q32 28 38 33" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round"/>
                        {/* Right person */}
                        <circle cx="59" cy="11" r="7" fill="#D97706" fillOpacity="0.9"/>
                        <path d="M50 26 Q59 19 68 26 L68 44 Q59 48 50 44 Z" fill="#FCD34D" fillOpacity="0.7"/>
                        {/* Right arm reaching left */}
                        <path d="M50 33 Q42 28 36 33" stroke="#D97706" strokeWidth="3" strokeLinecap="round"/>
                        {/* Joined hands / heart at center */}
                        <path d="M35 30 C35 27 39 27 39 30 C39 33 35 36 35 36 C35 36 31 33 31 30 C31 27 35 27 35 30Z" fill="#EF4444" fillOpacity="0.85"/>
                      </svg>
                    </div>

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
                  onImageSelect={(f) => setPendingFile(f)}
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
        onClose={() => { setIsPostOpen(false); setPendingFile(null); }}
        userProfile={profile}
        initialFile={pendingFile}
      />
    </div>
  );
};

export default Index;
