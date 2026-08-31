import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { usePageVisibility } from "../hooks/usePageVisibility";

interface FlicksStudioProps {
  userId: string | null;
}

interface CreatorProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  is_official_creator: boolean;
  creator_id: string | null;
  total_posts_count: number;
  total_likes_received: number;
  followers_count: number;
  creator_email: string | null;
  creator_mobile: string | null;
  creator_city: string | null;
  creator_address: string | null;
  creator_pin: string | null;
  creator_category: string | null;
}

const RED = "#EF4444";
const GOLD = "#F59E0B";
const DARK = "#0f0f13";
const CARD = "#18181f";
const CARD2 = "#1e1e27";

const CONTENT_CATEGORIES = [
  "Shorts / Reels", "Tech", "Gaming", "Comedy",
  "Education", "Vlogging", "Lifestyle", "Others",
];

function generateCreatorId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `FLICKS-CR-${suffix}`;
}

function ProgressBar({ value, max, label, sublabel, color = RED }: {
  value: number; max: number; label: string; sublabel: string; color?: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-white/80 text-[13px] font-bold">{label}</span>
        <span className="text-white/50 text-[11px]">{value.toLocaleString()} / {max.toLocaleString()}</span>
      </div>
      <div className="w-full rounded-full overflow-hidden" style={{ height: 10, background: "rgba(255,255,255,0.07)" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          style={{
            height: "100%", borderRadius: 999,
            background: `linear-gradient(90deg, ${color}, ${pct >= 100 ? "#22c55e" : GOLD})`,
            boxShadow: `0 0 8px ${color}80`,
          }}
        />
      </div>
      <p className="text-[11px] mt-1.5" style={{ color: pct >= 100 ? "#22c55e" : "rgba(255,255,255,0.4)" }}>
        {pct >= 100 ? "✅ Target reached!" : sublabel}
      </p>
    </div>
  );
}

const iBase: React.CSSProperties = {
  background: "rgba(255,255,255,0.055)", border: "1px solid rgba(255,255,255,0.1)",
  color: "#fff", borderRadius: 12, padding: "11px 14px", fontSize: 14, width: "100%", outline: "none",
};

function SField({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-white/55 text-[10px] font-black uppercase tracking-widest">
        {label}{req && <span style={{ color: RED }}> *</span>}
      </label>
      {children}
    </div>
  );
}

function ErrMsg({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-[10px] mt-0.5" style={{ color: RED }}>{msg}</p>;
}

export default function FlicksStudio({ userId }: FlicksStudioProps) {
  const isPageVisible = usePageVisibility();
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  /* ── Join form (State 1 → State 2) ── */
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinForm, setJoinForm] = useState({ fullName: "", gmail: "", mobile: "", city: "", address: "", pinCode: "", category: "" });
  const [joinErrors, setJoinErrors] = useState<Record<string, string>>({});
  const [joining, setJoining] = useState(false);

  /* ── Edit profile (State 2) ── */
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ gmail: "", mobile: "", city: "", address: "", pinCode: "", category: "" });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editSaving, setEditSaving] = useState(false);

  /* ── Name change request ── */
  const [showNameChange, setShowNameChange] = useState(false);
  const [ncForm, setNcForm] = useState({ requestedName: "", reason: "" });
  const [ncSubmitting, setNcSubmitting] = useState(false);

  /* ── KYC ── */
  const [showKycModal, setShowKycModal] = useState(false);
  const [kycForm, setKycForm] = useState({ accountHolder: "", accountNumber: "", ifsc: "", bank: "", pan: "" });
  const [kycSaving, setKycSaving] = useState(false);

  /* ── Animated title ── */
  const [titleIndex, setTitleIndex] = useState(0);
  const TITLES = [
    { text: "🚀 Flicks Studio", color: RED },
    { text: "💰 Your Money Maker Tools", color: GOLD },
  ];

  /* ── Creator ID copy ── */
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    if (!isPageVisible) return;
    fetchProfile();
  }, [userId, isPageVisible]);

  useEffect(() => {
    if (!isPageVisible) return;
    const id = setInterval(() => setTitleIndex(i => (i + 1) % TITLES.length), 2500);
    return () => clearInterval(id);
  }, [isPageVisible]);

  async function fetchProfile() {
    if (!userId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, is_official_creator, creator_id, total_posts_count, total_likes_received, followers_count, creator_email, creator_mobile, creator_city, creator_address, creator_pin, creator_category")
        .eq("id", userId)
        .single();
      if (data) {
        setProfile({
          ...data,
          is_official_creator: data.is_official_creator ?? false,
          creator_id: data.creator_id ?? null,
          total_posts_count: data.total_posts_count ?? 0,
          total_likes_received: data.total_likes_received ?? 0,
          followers_count: data.followers_count ?? 0,
          creator_email: data.creator_email ?? null,
          creator_mobile: data.creator_mobile ?? null,
          creator_city: data.creator_city ?? null,
          creator_address: data.creator_address ?? null,
          creator_pin: data.creator_pin ?? null,
          creator_category: data.creator_category ?? null,
        });
      }
    } catch (e) { console.warn("[FlicksStudio] fetchProfile:", e); }
    finally { setLoading(false); }
  }

  /* ── Validation helpers ── */
  function validateCreatorFields(f: { gmail: string; mobile: string; city: string; address: string; pinCode: string; category: string }) {
    const e: Record<string, string> = {};
    if (!f.gmail.trim() || !/^[^\s@]+@gmail\.com$/i.test(f.gmail.trim())) e.gmail = "Valid @gmail.com required";
    if (!f.mobile.trim() || !/^\d{10}$/.test(f.mobile.trim())) e.mobile = "Valid 10-digit number required";
    if (!f.city.trim()) e.city = "City required";
    if (!f.address.trim()) e.address = "Permanent address required";
    if (!f.pinCode.trim() || !/^\d{6}$/.test(f.pinCode.trim())) e.pinCode = "Valid 6-digit pin required";
    if (!f.category) e.category = "Select a category";
    return e;
  }

  /* ── Handlers ── */
  async function handleJoinSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const errs = { ...validateCreatorFields(joinForm), ...(!joinForm.fullName.trim() ? { fullName: "Full name required" } : {}) };
    setJoinErrors(errs);
    if (Object.keys(errs).length || !userId) return;
    setJoining(true);
    try {
      const newId = generateCreatorId();
      await supabase.from("profiles").update({
        is_official_creator: true, creator_id: newId,
        full_name: joinForm.fullName.trim(),
        creator_email: joinForm.gmail.trim(), creator_mobile: joinForm.mobile.trim(),
        creator_city: joinForm.city.trim(), creator_address: joinForm.address.trim(),
        creator_pin: joinForm.pinCode.trim(), creator_category: joinForm.category,
      }).eq("id", userId);
      setShowJoinModal(false);
      setJoinForm({ fullName: "", gmail: "", mobile: "", city: "", address: "", pinCode: "", category: "" });
      await fetchProfile();
    } catch (e) { console.warn("[FlicksStudio] join:", e); }
    finally { setJoining(false); }
  }

  function openEditModal() {
    if (!profile) return;
    setEditForm({
      gmail: profile.creator_email || "", mobile: profile.creator_mobile || "",
      city: profile.creator_city || "", address: profile.creator_address || "",
      pinCode: profile.creator_pin || "", category: profile.creator_category || "",
    });
    setEditErrors({});
    setShowEditModal(true);
  }

  async function handleEditSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const errs = validateCreatorFields(editForm);
    setEditErrors(errs);
    if (Object.keys(errs).length || !userId) return;
    setEditSaving(true);
    try {
      await supabase.from("profiles").update({
        creator_email: editForm.gmail.trim(), creator_mobile: editForm.mobile.trim(),
        creator_city: editForm.city.trim(), creator_address: editForm.address.trim(),
        creator_pin: editForm.pinCode.trim(), creator_category: editForm.category,
      }).eq("id", userId);
      setShowEditModal(false);
      await fetchProfile();
    } catch (e) { console.warn("[FlicksStudio] edit:", e); }
    finally { setEditSaving(false); }
  }

  async function handleNameChangeSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!ncForm.requestedName.trim() || !ncForm.reason.trim() || !userId || !profile) return;
    setNcSubmitting(true);
    try {
      await supabase.from("name_change_requests").insert({
        profile_id: userId,
        current_name: profile.full_name || "",
        requested_name: ncForm.requestedName.trim(),
        reason: ncForm.reason.trim(),
      });
      setShowNameChange(false);
      setNcForm({ requestedName: "", reason: "" });
      alert("Your request has been successfully received. The Flicks Verification Team will review it within 24 to 72 hours.");
    } catch (e) { console.warn("[FlicksStudio] name change:", e); }
    finally { setNcSubmitting(false); }
  }

  function handlePayoutClick() {
    if (!profile) return;
    if (profile.total_posts_count < 1000 || profile.total_likes_received < 5000 || profile.followers_count < 2000) {
      alert("Error: You have not fulfilled the required stats (Followers, Likes, or Posts) to access this verification segment. You are currently not eligible for Flicks Monetization.");
      return;
    }
    setShowKycModal(true);
  }

  async function handleKycSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setKycSaving(true);
    await new Promise(r => setTimeout(r, 1200));
    setKycSaving(false);
    setShowKycModal(false);
    alert("✅ KYC details submitted! Our team will verify within 2–5 business days.");
  }

  function handleCopyId() {
    if (!profile?.creator_id) return;
    navigator.clipboard.writeText(profile.creator_id).catch(() => {});
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  }

  const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
  const ncWordCount = wordCount(ncForm.reason);

  const setJoinField = (k: keyof typeof joinForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setJoinForm(f => ({ ...f, [k]: e.target.value }));
    if (joinErrors[k]) setJoinErrors(p => { const n = { ...p }; delete n[k]; return n; });
  };
  const setEditField = (k: keyof typeof editForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setEditForm(f => ({ ...f, [k]: e.target.value }));
    if (editErrors[k]) setEditErrors(p => { const n = { ...p }; delete n[k]; return n; });
  };

  /* ── Guards ── */
  if (loading) return (
    <div className="w-full min-h-screen flex items-center justify-center" style={{ background: DARK }}>
      <div className="w-8 h-8 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
    </div>
  );

  if (!userId || !profile) return (
    <div className="w-full min-h-screen flex items-center justify-center p-6" style={{ background: DARK }}>
      <p className="text-white/40 text-center text-sm">Sign in to access Flicks Studio.</p>
    </div>
  );

  /* ══════════════ SHARED MODAL COMPONENTS ══════════════ */

  /* Name Change Modal */
  const NameChangeModal = (
    <AnimatePresence>
      {showNameChange && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center p-3"
          style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(10px)" }}
          onClick={() => setShowNameChange(false)}
        >
          <motion.div
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", damping: 24, stiffness: 260 }}
            className="w-full max-w-md rounded-3xl overflow-hidden"
            style={{ background: CARD, border: "1px solid rgba(99,102,241,0.35)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 py-4 flex items-start justify-between"
              style={{ borderBottom: "1px solid rgba(99,102,241,0.2)", background: "rgba(99,102,241,0.08)" }}>
              <div>
                <h2 className="text-white font-black text-lg">✏️ Request Name Change</h2>
                <p className="text-white/40 text-xs mt-0.5">Requests are reviewed within 24–72 hours</p>
              </div>
              <button onClick={() => setShowNameChange(false)} className="text-white/30 hover:text-white/70 text-xl ml-3">✕</button>
            </div>
            <form onSubmit={handleNameChangeSubmit} className="p-5 flex flex-col gap-4">
              <div
                className="rounded-xl px-4 py-3"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-0.5">Current Name (Locked)</p>
                <p className="text-white/70 text-sm font-bold">{profile.full_name || "—"}</p>
              </div>

              <SField label="Requested New Name" req>
                <input
                  type="text"
                  placeholder="Enter your new full name"
                  value={ncForm.requestedName}
                  onChange={e => setNcForm(f => ({ ...f, requestedName: e.target.value }))}
                  style={iBase}
                  onFocus={e => (e.target.style.borderColor = "#6366f1")}
                  onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                  required
                />
              </SField>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-white/55 text-[10px] font-black uppercase tracking-widest">
                    Reason for Change <span style={{ color: RED }}>*</span>
                  </label>
                  <span className="text-[10px] font-bold" style={{ color: ncWordCount > 200 ? RED : "rgba(255,255,255,0.35)" }}>
                    {ncWordCount} / 200 words
                  </span>
                </div>
                <textarea
                  rows={4}
                  placeholder="Explain why you need this name change (max 200 words)..."
                  value={ncForm.reason}
                  onChange={e => {
                    const words = e.target.value.trim().split(/\s+/).filter(Boolean).length;
                    if (words <= 200 || e.target.value.length < ncForm.reason.length) {
                      setNcForm(f => ({ ...f, reason: e.target.value }));
                    }
                  }}
                  style={{ ...iBase, resize: "none" }}
                  onFocus={e => (e.target.style.borderColor = "#6366f1")}
                  onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={ncSubmitting || !ncForm.requestedName.trim() || ncWordCount === 0 || ncWordCount > 200}
                className="w-full py-3.5 rounded-2xl font-black text-white text-[14px] uppercase tracking-wide active:scale-95 transition-transform disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                  boxShadow: "0 4px 18px rgba(99,102,241,0.4)",
                }}
              >
                {ncSubmitting ? "Submitting..." : "📩 Submit Name Change Request"}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  /* ══════════════ STATE 1: NORMAL USER GATEWAY ══════════════ */
  if (!profile.is_official_creator) {
    return (
      <div className="w-full min-h-screen pb-32" style={{ background: DARK }}>
        <div className="relative w-full overflow-hidden flex flex-col items-center justify-center px-6 py-16 text-center"
          style={{ background: "linear-gradient(160deg, #1a0505 0%, #0f0f13 60%)" }}>
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(circle at 50% 40%, rgba(239,68,68,0.18) 0%, transparent 65%)" }} />
          <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.6, ease: "backOut" }} className="relative mb-6">
            <div className="w-24 h-24 rounded-full flex items-center justify-center text-5xl"
              style={{ background: `linear-gradient(135deg, ${RED}, #b91c1c)`, boxShadow: "0 0 40px rgba(239,68,68,0.55), 0 0 80px rgba(239,68,68,0.22)" }}>
              🚀
            </div>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="text-2xl font-black text-white leading-tight mb-3">
            Join the Flicks<br /><span style={{ color: RED }}>Creator Economy</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            className="text-white/50 text-sm leading-relaxed max-w-xs mb-8">
            Get your Official Creator badge, unique Creator ID, track your growth, and unlock monetization when you hit the milestones.
          </motion.p>
          <motion.button initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            whileTap={{ scale: 0.95 }} onClick={() => setShowJoinModal(true)}
            className="px-8 py-4 rounded-2xl font-black text-base text-white tracking-wide uppercase"
            style={{ background: `linear-gradient(135deg, ${RED}, #b91c1c)`, boxShadow: "0 4px 24px rgba(239,68,68,0.5), 0 0 0 1px rgba(239,68,68,0.3)" }}>
            🎯 Apply Now — Activate Creator Account
          </motion.button>
        </div>

        <div className="px-4 py-8">
          <p className="text-white/40 text-[11px] font-black uppercase tracking-widest text-center mb-5">What you unlock as a creator</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: "⚡", title: "Creator Badge", desc: "Animated badge on all your posts" },
              { icon: "🪪", title: "Creator ID", desc: "Unique FLICKS-CR-XXXX identity" },
              { icon: "💰", title: "Monetization", desc: "Earn once you hit the targets" },
              { icon: "🔥", title: "Viral Boost", desc: "Priority in feed for creators" },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="rounded-2xl p-4" style={{ background: CARD, border: "1px solid rgba(239,68,68,0.12)" }}>
                <p className="text-2xl mb-2">{icon}</p>
                <p className="text-white text-[13px] font-black mb-1">{title}</p>
                <p className="text-white/40 text-[11px] leading-snug">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Join Modal */}
        <AnimatePresence>
          {showJoinModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center p-3"
              style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(8px)" }}
              onClick={() => setShowJoinModal(false)}>
              <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 70, opacity: 0 }}
                transition={{ type: "spring", damping: 24, stiffness: 260 }}
                className="w-full max-w-lg rounded-3xl overflow-hidden"
                style={{ background: CARD, border: "1px solid rgba(239,68,68,0.3)", maxHeight: "92vh", overflowY: "auto" }}
                onClick={e => e.stopPropagation()}>
                <div className="sticky top-0 z-10 px-5 py-4 flex items-start justify-between"
                  style={{ borderBottom: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.08)" }}>
                  <div>
                    <h2 className="text-white font-black text-lg leading-tight">🚀 Creator Application</h2>
                    <p className="text-white/40 text-xs mt-0.5">Fill all fields to activate your creator account instantly</p>
                  </div>
                  <button type="button" onClick={() => setShowJoinModal(false)} className="text-white/30 hover:text-white/70 text-xl ml-3">✕</button>
                </div>
                <form onSubmit={handleJoinSubmit} className="p-5 flex flex-col gap-4">
                  <SField label="Full Name" req>
                    <input type="text" placeholder="Your real full name" value={joinForm.fullName} onChange={setJoinField("fullName")}
                      style={iBase} onFocus={e => (e.target.style.borderColor = RED)} onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} />
                    <ErrMsg msg={joinErrors.fullName} />
                  </SField>

                  <div className="grid grid-cols-2 gap-3">
                    <SField label="Professional Gmail" req>
                      <input type="email" placeholder="you@gmail.com" value={joinForm.gmail} onChange={setJoinField("gmail")}
                        style={iBase} onFocus={e => (e.target.style.borderColor = RED)} onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} />
                      <ErrMsg msg={joinErrors.gmail} />
                    </SField>
                    <SField label="Active Mobile" req>
                      <input type="tel" placeholder="10-digit" maxLength={10} value={joinForm.mobile} onChange={setJoinField("mobile")}
                        style={iBase} onFocus={e => (e.target.style.borderColor = RED)} onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} />
                      <ErrMsg msg={joinErrors.mobile} />
                    </SField>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <SField label="City / Location" req>
                      <input type="text" placeholder="City, State" value={joinForm.city} onChange={setJoinField("city")}
                        style={iBase} onFocus={e => (e.target.style.borderColor = RED)} onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} />
                      <ErrMsg msg={joinErrors.city} />
                    </SField>
                    <SField label="Pin Code" req>
                      <input type="text" placeholder="6-digit" maxLength={6} value={joinForm.pinCode} onChange={setJoinField("pinCode")}
                        style={iBase} onFocus={e => (e.target.style.borderColor = RED)} onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} />
                      <ErrMsg msg={joinErrors.pinCode} />
                    </SField>
                  </div>

                  <SField label="Full Permanent Address" req>
                    <textarea rows={3} placeholder="House/Flat no., Street, Landmark, District..." value={joinForm.address}
                      onChange={setJoinField("address")} style={{ ...iBase, resize: "none" }}
                      onFocus={e => (e.target.style.borderColor = RED)} onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} />
                    <ErrMsg msg={joinErrors.address} />
                  </SField>

                  <SField label="Content Category / Hobby" req>
                    <select value={joinForm.category} onChange={setJoinField("category")}
                      style={{ ...iBase, appearance: "none", cursor: "pointer" }}
                      onFocus={e => (e.target.style.borderColor = RED)} onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}>
                      <option value="" style={{ background: CARD }}>— Select category —</option>
                      {CONTENT_CATEGORIES.map(c => <option key={c} value={c} style={{ background: CARD }}>{c}</option>)}
                    </select>
                    <ErrMsg msg={joinErrors.category} />
                  </SField>

                  <div className="rounded-xl px-4 py-3 flex items-center gap-2"
                    style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)" }}>
                    <span className="text-lg">🪪</span>
                    <p className="text-[11px]" style={{ color: "rgba(245,158,11,0.85)" }}>
                      A unique <strong>Creator ID</strong> (e.g. FLICKS-CR-A7K2R9) will be auto-generated and permanently assigned.
                    </p>
                  </div>

                  <button type="submit" disabled={joining}
                    className="w-full py-4 rounded-2xl font-black text-white text-[15px] uppercase tracking-wide active:scale-95 transition-transform"
                    style={{ background: joining ? "rgba(239,68,68,0.35)" : `linear-gradient(135deg, ${RED}, #b91c1c)`, boxShadow: joining ? "none" : "0 4px 20px rgba(239,68,68,0.4)" }}>
                    {joining ? "Activating..." : "🎯 Activate Creator Account"}
                  </button>
                  <p className="text-center text-white/25 text-[10px]">By applying you confirm all information is genuine.</p>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  /* ══════════════ STATE 2: CREATOR DASHBOARD ══════════════ */
  const postsGoal = 1000; const likesGoal = 5000; const followGoal = 2000;
  const posts = profile.total_posts_count ?? 0;
  const likes = profile.total_likes_received ?? 0;
  const follows = profile.followers_count ?? 0;
  const allTargetsMet = posts >= postsGoal && likes >= likesGoal && follows >= followGoal;
  const currentTitle = TITLES[titleIndex];

  return (
    <div className="w-full min-h-screen pb-32" style={{ background: DARK }}>

      {/* ── Animated Header ── */}
      <div className="w-full px-4 pt-6 pb-5 text-center"
        style={{ background: "linear-gradient(180deg, #1a0505 0%, #0f0f13 100%)" }}>
        <AnimatePresence mode="wait">
          <motion.h1
            key={currentTitle.text}
            initial={{ opacity: 0, y: 10, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="text-xl font-black leading-tight"
            style={{ color: currentTitle.color, textShadow: `0 0 20px ${currentTitle.color}80, 0 0 40px ${currentTitle.color}40` }}
          >
            {currentTitle.text}
          </motion.h1>
        </AnimatePresence>
        <p className="text-white/35 text-[11px] mt-1 uppercase tracking-widest font-bold">Official Creator Dashboard</p>

        {/* Creator ID badge */}
        {profile.creator_id && (
          <motion.button initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}
            onClick={handleCopyId} whileTap={{ scale: 0.95 }}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full font-black text-[12px] tracking-wider uppercase"
            style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(239,68,68,0.12))", border: "1px solid rgba(245,158,11,0.4)", color: "#FCD34D", boxShadow: "0 0 12px rgba(245,158,11,0.15)" }}>
            <span>🪪</span>
            <span>ID: {profile.creator_id}</span>
            <AnimatePresence mode="wait">
              {copiedId
                ? <motion.span key="copied" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }} style={{ color: "#22c55e" }}>✓ Copied!</motion.span>
                : <motion.span key="copy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ color: "rgba(255,255,255,0.35)" }}>📋</motion.span>}
            </AnimatePresence>
          </motion.button>
        )}
      </div>

      <div className="px-4 flex flex-col gap-4">

        {/* ── Passport + Warning ── */}
        <div className="rounded-3xl p-4 flex gap-4" style={{ background: CARD, border: "1px solid rgba(239,68,68,0.15)" }}>
          <div className="shrink-0 rounded-xl overflow-hidden flex items-center justify-center bg-white/5"
            style={{ width: 112, height: 128, border: "2px solid rgba(239,68,68,0.4)" }}>
            {profile.avatar_url
              ? <img src={profile.avatar_url} className="w-full h-full object-cover" alt="Profile"  decoding="async"/>
              : <div className="flex flex-col items-center gap-1"><span className="text-3xl">👤</span><span className="text-white/30 text-[9px] text-center leading-tight px-1">No photo</span></div>}
          </div>
          <div className="flex-1 flex flex-col justify-center gap-2">
            <div className="rounded-2xl p-3" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
              <p className="text-[11px] font-black uppercase tracking-wider mb-1.5" style={{ color: GOLD }}>⚠️ Important Notice</p>
              <p className="text-[11px] text-white/55 leading-relaxed">
                Ensure all profile details are 100% original. Use "Edit Profile" to update your contact details.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase" style={{ background: "rgba(239,68,68,0.18)", color: RED }}>⚡ Creator</span>
              <span className="text-white/60 text-[12px] font-bold">{profile.full_name || "Creator"}</span>
            </div>
            {/* Edit + Name Change buttons */}
            <div className="flex gap-2">
              <button onClick={openEditModal}
                className="flex-1 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide active:scale-95 transition-transform"
                style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#FCA5A5" }}>
                ✏️ Edit Profile
              </button>
              <button onClick={() => setShowNameChange(true)}
                className="flex-1 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide active:scale-95 transition-transform"
                style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc" }}>
                🔤 Name Change
              </button>
            </div>
          </div>
        </div>

        {/* ── Big 3 Goals ── */}
        <div className="rounded-3xl p-5" style={{ background: CARD, border: "1px solid rgba(239,68,68,0.15)" }}>
          <p className="text-white/90 font-black text-sm mb-4 uppercase tracking-widest">🎯 The Big 3 Goals</p>
          <ProgressBar value={posts} max={postsGoal} label="🔥 System Posts"
            sublabel={`🔥 ${Math.max(postsGoal - posts, 0).toLocaleString()} more posts required`} color={RED} />
          <ProgressBar value={likes} max={likesGoal} label="💪 Received Likes"
            sublabel={`💪 ${Math.max(likesGoal - likes, 0).toLocaleString()} more organic likes required`} color="#EC4899" />
          <ProgressBar value={follows} max={followGoal} label="🤝 Community Followers"
            sublabel={`🤝 ${Math.max(followGoal - follows, 0).toLocaleString()} more permanent followers required`} color="#8B5CF6" />
        </div>

        {/* ── Locked Wallet ── */}
        <div className="rounded-3xl p-5 flex items-center justify-between" style={{ background: CARD, border: "1px solid rgba(239,68,68,0.15)" }}>
          <div>
            <p className="text-white/40 text-[11px] font-bold uppercase tracking-widest mb-1">Wallet Balance</p>
            <p className="text-3xl font-black text-white tracking-wider">🪙 00.00</p>
            <p className="text-white/30 text-[10px] mt-1">₹ — Locked until targets met</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider"
              style={{ background: "linear-gradient(135deg, rgba(239,68,68,0.3), rgba(245,158,11,0.25))", border: "1px solid rgba(239,68,68,0.4)", color: "#FCA5A5" }}>
              🔒 Locked
            </span>
            <span className="text-white/20 text-[9px] text-right">Releases at target</span>
          </div>
        </div>

        {/* ── KYC button ── */}
        <motion.button whileTap={{ scale: 0.97 }} onClick={handlePayoutClick}
          className="w-full py-4 rounded-2xl font-black text-[14px] uppercase tracking-wide"
          style={{
            background: allTargetsMet ? "linear-gradient(135deg, #16a34a, #15803d)" : `linear-gradient(135deg, ${RED}, #b91c1c)`,
            boxShadow: allTargetsMet ? "0 4px 20px rgba(22,163,74,0.4)" : "0 4px 20px rgba(239,68,68,0.35)",
            color: "white",
          }}>
          {allTargetsMet ? "🏦 Link Bank Account & KYC Form" : "🔒 Link Bank Account & KYC Form"}
        </motion.button>

        {/* ── Stats Mini Row ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Posts", value: posts, icon: "📝", goal: postsGoal, color: RED },
            { label: "Likes", value: likes, icon: "❤️", goal: likesGoal, color: "#EC4899" },
            { label: "Followers", value: follows, icon: "👥", goal: followGoal, color: "#8B5CF6" },
          ].map(({ label, value, icon, goal, color }) => (
            <div key={label} className="rounded-2xl p-3 text-center"
              style={{ background: CARD2, border: `1px solid ${value >= goal ? "#22c55e30" : "rgba(255,255,255,0.05)"}` }}>
              <p className="text-xl mb-1">{icon}</p>
              <p className="font-black text-white text-base">{value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value}</p>
              <p className="text-white/35 text-[10px] font-bold mt-0.5">{label}</p>
              {value >= goal && <p className="text-[9px] mt-1" style={{ color: "#22c55e" }}>✅</p>}
            </div>
          ))}
        </div>

        {/* ── Legal Policy ── */}
        <div className="rounded-3xl p-5 mt-1" style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.18)" }}>
          <p className="font-black text-[12px] uppercase tracking-widest mb-3" style={{ color: GOLD }}>📜 Monetization Policy & Legal Terms</p>
          <div className="flex flex-col gap-2 text-white/50 text-[11px] leading-relaxed">
            <p>• <strong className="text-white/70">Minimum Payout:</strong> ₹1,000 per withdrawal request.</p>
            <p>• <strong className="text-white/70">Eligibility:</strong> 1,000 posts, 5,000 organic likes, and 2,000 followers required.</p>
            <p>• <strong className="text-white/70">Anti-Fraud Warning:</strong> Bots/purchased engagement = permanent ban.</p>
            <p>• <strong className="text-white/70">KYC Required:</strong> PAN card, bank account, and government ID mandatory.</p>
            <p>• <strong className="text-white/70">Processing Time:</strong> 5–7 business days after verification.</p>
            <p>• Flicks India reserves the right to modify payout structures with 30 days' prior notice.</p>
          </div>
        </div>
      </div>

      {/* ── Edit Profile Modal ── */}
      <AnimatePresence>
        {showEditModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center p-3"
            style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
            onClick={() => setShowEditModal(false)}>
            <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 70, opacity: 0 }}
              transition={{ type: "spring", damping: 24, stiffness: 260 }}
              className="w-full max-w-lg rounded-3xl overflow-hidden"
              style={{ background: CARD, border: "1px solid rgba(239,68,68,0.3)", maxHeight: "92vh", overflowY: "auto" }}
              onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 z-10 px-5 py-4 flex items-start justify-between"
                style={{ borderBottom: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.08)" }}>
                <div>
                  <h2 className="text-white font-black text-lg">✏️ Edit Profile Details</h2>
                  <p className="text-white/40 text-xs mt-0.5">Update your creator contact & category info</p>
                </div>
                <button type="button" onClick={() => setShowEditModal(false)} className="text-white/30 hover:text-white/70 text-xl ml-3">✕</button>
              </div>

              <form onSubmit={handleEditSubmit} className="p-5 flex flex-col gap-4">
                {/* Full Name — locked */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-white/55 text-[10px] font-black uppercase tracking-widest">Full Name (Locked)</label>
                    <button type="button" onClick={() => { setShowEditModal(false); setShowNameChange(true); }}
                      className="text-[10px] font-black px-2.5 py-1 rounded-full active:scale-95 transition-transform"
                      style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.35)", color: "#a5b4fc" }}>
                      Request Name Change ✏️
                    </button>
                  </div>
                  <div className="w-full rounded-xl px-4 py-3 text-white/40 text-sm font-bold cursor-not-allowed"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    {profile.full_name || "—"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <SField label="Professional Gmail" req>
                    <input type="email" placeholder="you@gmail.com" value={editForm.gmail} onChange={setEditField("gmail")}
                      style={iBase} onFocus={e => (e.target.style.borderColor = RED)} onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} />
                    <ErrMsg msg={editErrors.gmail} />
                  </SField>
                  <SField label="Active Mobile" req>
                    <input type="tel" placeholder="10-digit" maxLength={10} value={editForm.mobile} onChange={setEditField("mobile")}
                      style={iBase} onFocus={e => (e.target.style.borderColor = RED)} onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} />
                    <ErrMsg msg={editErrors.mobile} />
                  </SField>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <SField label="City / Location" req>
                    <input type="text" placeholder="City, State" value={editForm.city} onChange={setEditField("city")}
                      style={iBase} onFocus={e => (e.target.style.borderColor = RED)} onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} />
                    <ErrMsg msg={editErrors.city} />
                  </SField>
                  <SField label="Pin Code" req>
                    <input type="text" placeholder="6-digit" maxLength={6} value={editForm.pinCode} onChange={setEditField("pinCode")}
                      style={iBase} onFocus={e => (e.target.style.borderColor = RED)} onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} />
                    <ErrMsg msg={editErrors.pinCode} />
                  </SField>
                </div>

                <SField label="Full Permanent Address" req>
                  <textarea rows={3} placeholder="House/Flat no., Street, Landmark, District..." value={editForm.address}
                    onChange={setEditField("address")} style={{ ...iBase, resize: "none" }}
                    onFocus={e => (e.target.style.borderColor = RED)} onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} />
                  <ErrMsg msg={editErrors.address} />
                </SField>

                <SField label="Content Category / Hobby" req>
                  <select value={editForm.category} onChange={setEditField("category")}
                    style={{ ...iBase, appearance: "none", cursor: "pointer" }}
                    onFocus={e => (e.target.style.borderColor = RED)} onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}>
                    <option value="" style={{ background: CARD }}>— Select category —</option>
                    {CONTENT_CATEGORIES.map(c => <option key={c} value={c} style={{ background: CARD }}>{c}</option>)}
                  </select>
                  <ErrMsg msg={editErrors.category} />
                </SField>

                <button type="submit" disabled={editSaving}
                  className="w-full py-4 rounded-2xl font-black text-white text-[15px] uppercase tracking-wide active:scale-95 transition-transform"
                  style={{ background: editSaving ? "rgba(239,68,68,0.35)" : `linear-gradient(135deg, ${RED}, #b91c1c)`, boxShadow: editSaving ? "none" : "0 4px 20px rgba(239,68,68,0.4)" }}>
                  {editSaving ? "Saving..." : "💾 Save Changes"}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Name Change Modal ── */}
      {NameChangeModal}

      {/* ── KYC Modal ── */}
      <AnimatePresence>
        {showKycModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}
            onClick={() => setShowKycModal(false)}>
            <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              transition={{ type: "spring", damping: 22, stiffness: 280 }}
              className="w-full max-w-md rounded-3xl overflow-hidden"
              style={{ background: CARD, border: "1px solid rgba(22,163,74,0.3)" }}
              onClick={e => e.stopPropagation()}>
              <div className="px-5 py-4 border-b" style={{ borderColor: "rgba(22,163,74,0.2)", background: "rgba(22,163,74,0.07)" }}>
                <h2 className="text-white font-black text-lg">🏦 Bank Account & KYC</h2>
                <p className="text-white/40 text-xs mt-0.5">Your details are encrypted and stored securely</p>
              </div>
              <form onSubmit={handleKycSubmit} className="p-5 flex flex-col gap-4">
                {[
                  { label: "Account Holder Name", key: "accountHolder", placeholder: "As per bank records" },
                  { label: "Account Number", key: "accountNumber", placeholder: "Enter account number" },
                  { label: "IFSC Code", key: "ifsc", placeholder: "e.g. SBIN0001234" },
                  { label: "Bank Name", key: "bank", placeholder: "e.g. State Bank of India" },
                  { label: "PAN Number", key: "pan", placeholder: "e.g. ABCDE1234F" },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <label className="text-white/60 text-[11px] font-bold uppercase tracking-wider mb-1.5 block">{label}</label>
                    <input type="text" placeholder={placeholder} value={kycForm[key as keyof typeof kycForm]}
                      onChange={e => setKycForm(f => ({ ...f, [key]: e.target.value }))} required
                      className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none placeholder-white/20"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
                  </div>
                ))}
                <button type="submit" disabled={kycSaving}
                  className="w-full py-4 rounded-2xl font-black text-white text-[15px] uppercase tracking-wide active:scale-95 transition-transform"
                  style={{ background: kycSaving ? "rgba(22,163,74,0.35)" : "linear-gradient(135deg, #16a34a, #15803d)", boxShadow: kycSaving ? "none" : "0 4px 20px rgba(22,163,74,0.4)" }}>
                  {kycSaving ? "Submitting..." : "Submit KYC Details"}
                </button>
                <p className="text-center text-white/25 text-[10px]">Bank details used solely for payout processing.</p>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
