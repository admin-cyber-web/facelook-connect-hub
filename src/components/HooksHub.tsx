import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { smartTime } from "@/lib/timeAgo";
import { memGet, memSet } from "@/lib/memCache";
import { MagnetButton } from "./MagnetSystem";
import {
  Anchor, Plus, ArrowLeft, X, Users, Heart, FileText,
  DollarSign, Send, CheckSquare, Square, Loader2, Star,
  ChevronRight, Zap, Share2, Upload,
  PlayCircle, Image as ImgIcon, Video as VideoIcon, Check,
  AlertTriangle, MoreVertical, Pencil, Trash2,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface HookPage {
  id: string; owner_id: string; name: string; description: string;
  category: string; cover_url: string; avatar_url: string;
  hook_count: number; created_at: string;
  follower_count?: number;
  like_count?: number;
  is_monetized?: boolean;
  _member_count?: number;
  profiles?: { avatar_url: string | null; full_name: string | null } | null;
}
interface PagePost {
  id: string; page_id: string; author_id: string; content: string;
  media_url: string; media_type: string; type?: string; likes_count: number;
  created_at: string;
  status?: "approved" | "pending_approval" | "rejected" | null;
}
interface Friend { id: string; full_name: string; avatar_url: string; }

const CATEGORIES = ["General","Business","Entertainment","Education","Sports","Food","Travel","Tech","Art","Music"];
const STORAGE_BUCKET = "hooks";

// ── Time-limit duration options ────────────────────────────────────────────────
const DURATION_OPTIONS = [
  { label: "1 Hour",   value: "1h",   ms: 1   * 3_600_000 },
  { label: "6 Hours",  value: "6h",   ms: 6   * 3_600_000 },
  { label: "24 Hours", value: "24h",  ms: 24  * 3_600_000 },
  { label: "3 Days",   value: "3d",   ms: 3   * 86_400_000 },
  { label: "7 Days",   value: "7d",   ms: 7   * 86_400_000 },
  { label: "30 Days",  value: "30d",  ms: 30  * 86_400_000 },
  { label: "No Limit", value: "none", ms: 0 },
] as const;
type DurValue = typeof DURATION_OPTIONS[number]["value"];

const calcExpiresAt = (value: DurValue | string): string | null => {
  const opt = DURATION_OPTIONS.find(d => d.value === value);
  if (!opt || opt.ms === 0) return null;
  return new Date(Date.now() + opt.ms).toISOString();
};

// e.g. "6d 4h left" | "45m left" | "Expired" | "No Limit"
const timeRemaining = (expiresAt: string | null | undefined): string => {
  if (!expiresAt) return "No Limit";
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const totalMins = Math.floor(ms / 60_000);
  const d = Math.floor(totalMins / 1440);
  const h = Math.floor((totalMins % 1440) / 60);
  const m = totalMins % 60;
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
};


// ── Upload helper ──────────────────────────────────────────────────────────────
async function uploadFile(file: File, folder: string): Promise<string | null> {
  const ext  = file.name.split(".").pop();
  const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: true });
  if (error) return null;
  return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

// ── ImagePicker ───────────────────────────────────────────────────────────────
const ImagePicker = ({ label, preview, onChange, aspectClass = "aspect-video", rounded = false }:
  { label: string; preview: string; onChange: (f: File) => void; aspectClass?: string; rounded?: boolean }) => {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <p className="text-[11px] font-black text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <div
        onClick={() => ref.current?.click()}
        className={`relative w-full ${aspectClass} bg-gray-100 border-2 border-dashed border-gray-200 flex items-center justify-center cursor-pointer hover:border-blue-400 transition-colors overflow-hidden ${rounded ? "rounded-full" : "rounded-xl"}`}
      >
        {preview
          ? <img src={preview} className="w-full h-full object-cover" alt="" loading="lazy"  decoding="async"/>
          : <div className="flex flex-col items-center gap-1 text-gray-400">
              <Upload size={20} /><p className="text-[10px] font-bold">Upload</p>
            </div>
        }
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden"
        onChange={e => e.target.files?.[0] && onChange(e.target.files[0])} />
    </div>
  );
};

// ── Page Banner Card (used on landing) ────────────────────────────────────────
const PageBannerCard = ({
  pg, onClick, memberCount, isOwner, isFollowing, onToggleFollow,
}: {
  pg: HookPage; onClick: () => void; memberCount: number;
  isOwner: boolean; isFollowing: boolean; onToggleFollow: (e: React.MouseEvent) => void;
}) => (
  <motion.div whileTap={{ scale: 0.97 }} onClick={onClick}
    className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-white cursor-pointer"
  >
    {/* Banner */}
    <div
      className="relative h-24 w-full"
      style={{
        backgroundImage: pg.cover_url ? `url('${pg.cover_url}')` : "none",
        backgroundColor: pg.cover_url ? "transparent" : "#f3f4f6",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-black/20" />
      {/* Avatar overlapping */}
      <div className="absolute -bottom-6 left-3 w-14 h-14 rounded-full border-4 border-white shadow-md overflow-hidden bg-gray-200 flex items-center justify-center">
        {(pg.profiles?.avatar_url || pg.avatar_url)
          ? <img src={pg.profiles?.avatar_url || pg.avatar_url} className="w-full h-full object-cover" alt="" loading="lazy"  decoding="async"/>
          : <span className="text-gray-500 font-black text-lg">{(pg.name || "H")[0].toUpperCase()}</span>
        }
      </div>
    </div>
    {/* Info */}
    <div className="pt-8 px-3 pb-3">
      <p className="font-black text-gray-800 text-[14px] truncate">{pg.name}</p>
      {pg.description && <p className="text-[11px] text-gray-500 font-medium leading-snug line-clamp-2 mt-0.5">{pg.description}</p>}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
            <Users size={10} className="text-blue-500" /> {memberCount} Followers
          </span>
          <span className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
            <Anchor size={10} className="text-purple-500" /> {pg.hook_count} Hooks
          </span>
        </div>
        {!isOwner && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onToggleFollow}
            className="px-3 py-1 rounded-lg text-[11px] font-black border transition-all"
            style={{
              background: isFollowing ? "white" : "linear-gradient(135deg,#2563eb,#7c3aed)",
              borderColor: isFollowing ? "#d1d5db" : "transparent",
              color: isFollowing ? "#374151" : "white",
            }}
          >
            {isFollowing ? "✓ Joined" : "+ Join"}
          </motion.button>
        )}
      </div>
    </div>
  </motion.div>
);

// ── Edit Page Modal ────────────────────────────────────────────────────────────
const EditPageModal = ({ page, userId, onClose, onSaved }:
  { page: HookPage; userId: string; onClose: () => void; onSaved: (p: HookPage) => void }) => {
  const [form, setForm]         = useState({ name: page.name, description: page.description || "", category: page.category || "General" });
  const [coverFile, setCoverFile]   = useState<File | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverPrev, setCoverPrev]   = useState(page.cover_url || "");
  const [avatarPrev, setAvatarPrev] = useState(page.avatar_url || "");
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState("");

  const save = async () => {
    if (!form.name.trim()) { setErr("Page ka naam zaroori hai"); return; }
    setSaving(true);
    const [cover_url, avatar_url] = await Promise.all([
      coverFile  ? uploadFile(coverFile,  "hook-covers")  : Promise.resolve(page.cover_url  || ""),
      avatarFile ? uploadFile(avatarFile, "hook-avatars") : Promise.resolve(page.avatar_url || ""),
    ]);
    const { data, error } = await supabase.from("hook_pages")
      .update({ name: form.name.trim(), description: form.description.trim(), category: form.category, cover_url: cover_url || "", avatar_url: avatar_url || "" })
      .eq("id", page.id).eq("owner_id", userId)
      .select().single();
    setSaving(false);
    if (error) { setErr("Update failed: " + error.message); return; }
    onSaved(data as HookPage);
    onClose();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[500] flex items-end justify-center overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 26, stiffness: 260 }}
        className="w-full max-w-lg bg-white rounded-t-3xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 className="font-black text-gray-800 text-[16px] flex items-center gap-2"><Pencil size={16} className="text-blue-600" /> Page Edit Karo</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: "76vh" }}>
          <ImagePicker label="Cover Image" preview={coverPrev} aspectClass="aspect-[3/1]"
            onChange={f => { setCoverFile(f); setCoverPrev(URL.createObjectURL(f)); }} />
          <div className="flex items-end gap-4">
            <div className="w-20 shrink-0">
              <ImagePicker label="Avatar" preview={avatarPrev} rounded aspectClass="aspect-square"
                onChange={f => { setAvatarFile(f); setAvatarPrev(URL.createObjectURL(f)); }} />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-[11px] font-black text-gray-500 uppercase tracking-wide mb-1">Page Name *</p>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[14px] font-semibold text-gray-800 outline-none focus:border-blue-500" />
              </div>
              <div>
                <p className="text-[11px] font-black text-gray-500 uppercase tracking-wide mb-1">Category</p>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-gray-800 outline-none focus:border-blue-500 bg-white">
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-black text-gray-500 uppercase tracking-wide mb-1">Description</p>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              rows={3} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] text-gray-800 outline-none focus:border-blue-500 resize-none" />
          </div>
          {err && <p className="text-red-500 text-[12px] font-bold">{err}</p>}
          <motion.button whileTap={{ scale: 0.97 }} onClick={save} disabled={saving}
            className="w-full py-3.5 rounded-2xl font-black text-[14px] text-white flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg,#2563eb,#1d4ed8)" }}>
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
            {saving ? "Save ho raha hai..." : "Changes Save Karo"}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Hook Modal (Invite Friends) ────────────────────────────────────────────────
const HookModal = ({ pageId, pageName, userId, onClose }:
  { pageId: string; pageName: string; userId: string; onClose: () => void }) => {
  const [friends, setFriends]   = useState<Friend[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);
  const [sentIds, setSentIds]   = useState<Set<string>>(new Set());
  const [duration, setDuration] = useState<DurValue>("7d");

  useEffect(() => {
    const fKey = `hookFriends_${userId}`;
    const hit = memGet<Friend[]>(fKey);
    if (hit) { setFriends(hit); setLoading(false); return; }
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("profiles").select("id,full_name,avatar_url").neq("id", userId).limit(50);
      setFriends(data || []);
      memSet(fKey, data || []);
      setLoading(false);
    })();
  }, [userId]);

  const toggleAll = () => selected.size === friends.length ? setSelected(new Set()) : setSelected(new Set(friends.map(f => f.id)));
  const toggle    = (id: string) => setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const sendHooks = async () => {
    if (!selected.size) return;
    setSending(true);
    const expires_at = calcExpiresAt(duration);
    const rows = Array.from(selected).map(invitee_id => ({
      page_id: pageId, inviter_id: userId, invitee_id, status: "pending",
      ...(expires_at ? { expires_at } : {}),
    }));
    await supabase.from("hook_invites").upsert(rows, { onConflict: "page_id,invitee_id" });
    const { data: cur } = await supabase.from("hook_pages").select("hook_count").eq("id", pageId).single();
    await supabase.from("hook_pages").update({ hook_count: (cur?.hook_count || 0) + selected.size }).eq("id", pageId);

    const durLabel = DURATION_OPTIONS.find(d => d.value === duration)?.label || "7 Days";
    const notifRows = Array.from(selected)
      .filter(invitee_id => invitee_id !== userId)
      .map(invitee_id => ({
        notifier_id: invitee_id,
        actor_id: userId,
        type: "hook_invite",
        entity_id: pageId,
        content: `${pageName}|${durLabel}`,
        is_read: false,
      }));
    if (notifRows.length) await supabase.from("notifications").insert(notifRows);

    setSentIds(new Set(selected)); setSelected(new Set()); setSending(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[500] flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 26, stiffness: 260 }}
        className="w-full max-w-lg bg-white rounded-t-3xl overflow-hidden shadow-2xl"
        style={{ maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2"><Anchor size={18} className="text-blue-600" /><h2 className="font-black text-gray-800 text-[16px]">Hook Friends</h2></div>
            <p className="text-[11px] text-gray-400 mt-0.5">Invite karo — <span className="font-bold text-blue-600">{pageName}</span></p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X size={20} /></button>
        </div>

        {/* Duration picker */}
        <div className="px-5 py-3 bg-blue-50 border-b border-blue-100">
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2 flex items-center gap-1">
            <Star size={9} fill="currentColor" /> Posting Access Duration
          </p>
          <div className="flex flex-wrap gap-1.5">
            {DURATION_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setDuration(opt.value as DurValue)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${duration === opt.value ? "bg-blue-600 text-white" : "bg-white text-gray-500 border border-gray-200"}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 py-2.5 border-b border-gray-50 flex items-center justify-between">
          <p className="text-[12px] font-bold text-gray-500">{friends.length} People</p>
          <button onClick={toggleAll} className="flex items-center gap-1.5 text-[12px] font-black text-blue-600">
            {selected.size === friends.length ? <CheckSquare size={14} /> : <Square size={14} />} Select All
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-blue-500" /></div>}
          {!loading && friends.map(f => {
            const isSent = sentIds.has(f.id); const isSel = selected.has(f.id);
            return (
              <motion.div key={f.id} whileTap={{ scale: 0.98 }} onClick={() => !isSent && toggle(f.id)}
                className={`flex items-center gap-3 px-5 py-3 border-b border-gray-50 cursor-pointer transition-colors ${isSel ? "bg-blue-50" : "hover:bg-gray-50"} ${isSent ? "opacity-60 cursor-default" : ""}`}>
                <div className="w-11 h-11 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-black shrink-0">
                  {f.avatar_url ? <img src={f.avatar_url} className="w-full h-full object-cover" alt="" loading="lazy"  decoding="async"/> : (f.full_name?.[0]?.toUpperCase() || "U")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 text-[14px] truncate">{f.full_name}</p>
                  {isSent && <p className="text-[10px] text-green-500 font-black">✓ Hook Bheja</p>}
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSel ? "bg-blue-600 border-blue-600" : "border-gray-300"}`}>
                  {isSel && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                </div>
              </motion.div>
            );
          })}
        </div>
        <div className="p-4 border-t border-gray-100">
          <motion.button whileTap={{ scale: 0.97 }} onClick={sendHooks} disabled={!selected.size || sending}
            className="w-full py-3.5 rounded-2xl font-black text-[14px] flex items-center justify-center gap-2 transition-all"
            style={{ background: selected.size ? "linear-gradient(135deg,#2563eb,#1d4ed8)" : "#e5e7eb", color: selected.size ? "#fff" : "#9ca3af" }}>
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Anchor size={18} />}
            {sending ? "Bhej raha hoon..." : `Hook Bhejo (${selected.size}) · ${DURATION_OPTIONS.find(d => d.value === duration)?.label}`}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Unified Share (single native share intent, original media, English only) ───
const shareHookPage = async (page: HookPage) => {
  const pageUrl = `${window.location.origin}/?page=${page.id}`;
  const media = page.cover_url || page.avatar_url || "";
  const { universalShare } = await import("../lib/universalShare");
  const outcome = await universalShare({
    title: page.name,
    text: `Check out this Hook on Flicks: "${page.name}"`,
    url: pageUrl,
    mediaUrl: media || undefined,
    type: "hook",
  });
  if (outcome === "copied") toast.success("Link copied to clipboard");
};

const shareHookPost = async (page: HookPage, post: PagePost) => {
  const pageUrl = `${window.location.origin}/?hook=${page.id}&post=${post.id}`;
  const media = post.media_url || page.cover_url || page.avatar_url || "";
  const { universalShare } = await import("../lib/universalShare");
  const outcome = await universalShare({
    title: `${page.name} — Hook post`,
    text: post.content
      ? `${post.content}\n\nCheck out this Hook on Flicks`
      : `Check out this Hook post on Flicks`,
    url: pageUrl,
    mediaUrl: media || undefined,
    type: "post",
  });
  if (outcome === "copied") toast.success("Link copied to clipboard");
};

// ── Rich Media Post Modal ──────────────────────────────────────────────────────
const AddPostModal = ({ pageId, userId, isOwner, pageName, onClose, onPosted }:
  { pageId: string; userId: string; isOwner: boolean; pageName: string; onClose: () => void; onPosted: () => void }) => {
  const [content, setContent]   = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video" | "">("");
  const [saving, setSaving]     = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const imgRef  = useRef<HTMLInputElement>(null);
  const vidRef  = useRef<HTMLInputElement>(null);

  const pickFile = (file: File, type: "image" | "video") => {
    setMediaFile(file); setMediaType(type);
    setMediaPreview(URL.createObjectURL(file));
  };

  const clearMedia = () => { setMediaFile(null); setMediaPreview(""); setMediaType(""); };

  const post = async () => {
    if (!content.trim() && !mediaFile) return;
    setSaving(true);
    let media_url = "";
    if (mediaFile) {
      setUploadPct(30);
      media_url = (await uploadFile(mediaFile, "hook-posts")) || "";
      setUploadPct(80);
    }
    // Contributors: post goes to pending_approval queue; owner posts go live immediately
    const status = isOwner ? "approved" : "pending_approval";
    await supabase.from("hook_page_posts").insert([{
      page_id: pageId, author_id: userId,
      content: content.trim(), media_url, media_type: mediaType, status,
    }]);
    if (isOwner) {
      // Only increment hook_count for owner posts that are immediately live
      const { data: cur } = await supabase.from("hook_pages").select("hook_count").eq("id", pageId).single();
      await supabase.from("hook_pages").update({ hook_count: (cur?.hook_count || 0) + 1 }).eq("id", pageId);
    }
    setUploadPct(100);
    setSaving(false); onPosted(); onClose();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[500] flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 26, stiffness: 260 }}
        className="w-full max-w-lg bg-white rounded-t-3xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <div>
            <h2 className="font-black text-gray-800 text-[16px]">
              {isOwner ? "Page Post" : "🤝 Page Partner Post"}
            </h2>
            <p className="text-[10px] text-gray-400 mt-0.5">{pageName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
        </div>

        {/* Contributor approval notice */}
        {!isOwner && (
          <div className="mx-5 mt-4 flex items-start gap-2.5 px-3.5 py-3 rounded-2xl bg-amber-50 border border-amber-200">
            <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] font-black text-amber-700">Owner Approval Required</p>
              <p className="text-[10px] text-amber-600 font-medium mt-0.5">Aapki post owner ke approve karne ke baad public feed par dikhai degi.</p>
            </div>
          </div>
        )}

        <div className="p-5 space-y-4">
          <textarea value={content} onChange={e => setContent(e.target.value)}
            placeholder="Page par kya share karna hai..." rows={3} autoFocus
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[14px] font-semibold text-gray-800 outline-none focus:border-blue-500 resize-none" />

          {/* Media preview */}
          {mediaPreview && (
            <div className="relative rounded-xl overflow-hidden bg-black">
              {mediaType === "image"
                ? <img src={mediaPreview} className="w-full max-h-48 object-cover" alt="" loading="lazy" decoding="async"/>
                : <video src={mediaPreview} className="w-full max-h-48" controls preload="none"/>
              }
              <button onClick={clearMedia}
                className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center text-white">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Media buttons */}
          {!mediaPreview && (
            <div className="flex gap-2">
              <button onClick={() => imgRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 text-[12px] font-black hover:border-blue-400 transition-colors">
                <ImgIcon size={15} className="text-blue-500" /> Image
              </button>
              <button onClick={() => vidRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 text-[12px] font-black hover:border-purple-400 transition-colors">
                <VideoIcon size={15} className="text-purple-500" /> Video
              </button>
            </div>
          )}
          <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && pickFile(e.target.files[0], "image")} />
          <input ref={vidRef} type="file" accept="video/*" className="hidden" onChange={e => e.target.files?.[0] && pickFile(e.target.files[0], "video")} />

          {/* Upload progress */}
          {saving && uploadPct > 0 && uploadPct < 100 && (
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div className="bg-blue-600 h-1.5 rounded-full transition-all" style={{ width: `${uploadPct}%` }} />
            </div>
          )}

          <motion.button whileTap={{ scale: 0.97 }} onClick={post} disabled={saving || (!content.trim() && !mediaFile)}
            className="w-full py-3.5 rounded-2xl font-black text-[14px] flex items-center justify-center gap-2 transition-all"
            style={{
              background: (content.trim() || mediaFile) && !saving
                ? isOwner ? "linear-gradient(135deg,#2563eb,#1d4ed8)" : "linear-gradient(135deg,#7c3aed,#6d28d9)"
                : "#e5e7eb",
              color: (content.trim() || mediaFile) && !saving ? "#fff" : "#9ca3af",
            }}>
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            {saving ? "Upload ho raha hai..." : isOwner ? "Post Karo" : "Submit for Approval"}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Create Page Modal ──────────────────────────────────────────────────────────
const CreatePageModal = ({ userId, onClose, onCreated }:
  { userId: string; onClose: () => void; onCreated: (p: HookPage) => void }) => {
  const [form, setForm]             = useState({ name: "", description: "", category: "General" });
  const [coverFile, setCoverFile]   = useState<File | null>(null);
  const [coverPrev, setCoverPrev]   = useState("");
  const [ownerProfile, setOwnerProfile] = useState<{ avatar_url: string | null; full_name: string | null } | null>(null);
  const [saving, setSaving]         = useState(false);
  const [err, setErr]               = useState("");

  // Auto-load creator's profile on mount — cached 5 min
  useEffect(() => {
    const pKey = `ownerProfile_${userId}`;
    const hit = memGet<{ avatar_url: string | null; full_name: string | null }>(pKey);
    if (hit) { setOwnerProfile(hit); return; }
    supabase.from("profiles").select("avatar_url, full_name").eq("id", userId).single()
      .then(({ data }) => { if (data) { setOwnerProfile(data); memSet(pKey, data); } });
  }, [userId]);

  const create = async () => {
    if (!form.name.trim()) { setErr("Page ka naam zaroori hai"); return; }
    setSaving(true);
    let cover_url = "";
    // Auto-avatar: use the creator's own profile avatar (no manual upload needed)
    const avatar_url = ownerProfile?.avatar_url || "";
    if (coverFile) {
      const url = await uploadFile(coverFile, "hook-covers");
      if (!url) { setErr("Cover image upload failed. Please try again."); setSaving(false); return; }
      cover_url = url;
    }
    const { data, error } = await supabase.from("hook_pages")
      .insert([{ owner_id: userId, name: form.name.trim(), description: form.description.trim(), category: form.category, cover_url, avatar_url }])
      .select().single();
    setSaving(false);
    if (error) { setErr("Page nahi ban saka. Supabase SQL tables setup karein."); return; }
    onCreated({ ...(data as HookPage), profiles: ownerProfile ? { avatar_url: ownerProfile.avatar_url, full_name: ownerProfile.full_name } : null });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[500] flex items-end justify-center overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 26, stiffness: 260 }}
        className="w-full max-w-lg bg-white rounded-t-3xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 className="font-black text-gray-800 text-[16px]">Naya Hook Page</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: "76vh" }}>
          {/* Cover / Banner */}
          <ImagePicker label="Cover Image (Banner) *" preview={coverPrev} aspectClass="aspect-[3/1]"
            onChange={f => { setCoverFile(f); setCoverPrev(URL.createObjectURL(f)); }} />

          {/* Auto-Avatar: creator's profile photo — no manual upload needed */}
          <div className="flex items-center gap-4 p-3.5 bg-blue-50 rounded-2xl border border-blue-100">
            <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-blue-200 shrink-0 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-black text-xl">
              {ownerProfile?.avatar_url
                ? <img src={ownerProfile.avatar_url} className="w-full h-full object-cover" alt="" loading="lazy"  decoding="async"/>
                : (ownerProfile?.full_name?.[0] || "?").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-0.5">✦ Creator — Auto Avatar</p>
              <p className="text-[13px] font-black text-gray-800 truncate">{ownerProfile?.full_name || "Loading..."}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Aapki profile photo is page ka avatar banega</p>
            </div>
          </div>

          {/* Page Name */}
          <div>
            <label className="text-[11px] font-black text-gray-500 uppercase tracking-wide mb-1 block">Page ka Naam *</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Jaise: My Cooking Page"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[14px] font-semibold text-gray-800 outline-none focus:border-blue-500 transition-colors" />
          </div>

          {/* Description */}
          <div>
            <label className="text-[11px] font-black text-gray-500 uppercase tracking-wide mb-1 block">Bio / Description</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Page kiske baare mein hai..." rows={2}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[14px] font-semibold text-gray-800 outline-none focus:border-blue-500 resize-none transition-colors" />
          </div>

          {/* Category */}
          <div>
            <label className="text-[11px] font-black text-gray-500 uppercase tracking-wide mb-1 block">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setForm(p => ({ ...p, category: c }))}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-black border transition-all ${form.category === c ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-500 border-gray-200"}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {err && <p className="text-red-500 text-[12px] font-bold">{err}</p>}
          <motion.button whileTap={{ scale: 0.97 }} onClick={create} disabled={saving}
            className="w-full py-3.5 rounded-2xl font-black text-[14px] text-white flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg,#2563eb,#1d4ed8)" }}>
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            {saving ? "Ban raha hai..." : "Page Banao"}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) => (
  <div className="flex-1 flex flex-col items-center gap-1 p-3 rounded-2xl bg-white border border-gray-100 shadow-sm">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>{icon}</div>
    <p className="text-[20px] font-black text-gray-800 leading-tight">{value.toLocaleString()}</p>
    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
  </div>
);

// ── Page Dashboard ────────────────────────────────────────────────────────────
const PageDashboard = ({ page, userId, onBack, onPageUpdated, initialIsFollowing = false, initialMemberCount = 0 }:
  { page: HookPage; userId: string; onBack: () => void; onPageUpdated: (p: HookPage) => void;
    initialIsFollowing?: boolean; initialMemberCount?: number }) => {
  const [posts, setPosts]         = useState<PagePost[]>([]);
  const [loading, setLoading]     = useState(true);
  const [hookModal, setHookModal] = useState(false);
  const [addPost, setAddPost]     = useState(false);
  const [livePage, setLivePage]   = useState<HookPage>(page);
  const [memberCount, setMemberCount] = useState(initialMemberCount);
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [followError, setFollowError] = useState<string | null>(null);
  const [followLoading, setFollowLoading] = useState(false);

  // Requests / contributor state
  const [activeTab, setActiveTab] = useState<"posts" | "requests" | "approvals">("posts");
  const isOwner = page.owner_id === userId;
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [isContributor, setIsContributor] = useState(false);
  const [contributorExpired, setContributorExpired] = useState(false);
  const [contributorExpiresAt, setContributorExpiresAt] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  // Per-invite duration selection (owner sets when accepting)
  const [acceptDurationMap, setAcceptDurationMap] = useState<Record<string, DurValue>>({});
  // Post approval state
  const [approvingPostId, setApprovingPostId] = useState<string | null>(null);
  const [rejectingPostId, setRejectingPostId] = useState<string | null>(null);

  // Edit / Delete state
  const [showEditPage, setShowEditPage]       = useState(false);
  const [postMenuId, setPostMenuId]           = useState<string | null>(null);
  const [editingPost, setEditingPost]         = useState<{ id: string; content: string; author_id: string } | null>(null);
  const [editPostText, setEditPostText]       = useState("");
  const [editPostSaving, setEditPostSaving]   = useState(false);
  const [confirmDeletePost, setConfirmDeletePost] = useState<string | null>(null);
  const [showDeletePageConfirm, setShowDeletePageConfirm] = useState(false);
  const [deletingPage, setDeletingPage]       = useState(false);

  // Invite / join-request state for non-owner viewers
  const [hasPendingInvite, setHasPendingInvite]   = useState(false); // owner invited this user, waiting for them to accept
  const [hasPendingJoinReq, setHasPendingJoinReq] = useState(false); // user requested to join, waiting for owner
  const [requestingJoin, setRequestingJoin]       = useState(false);
  const [acceptingInvite, setAcceptingInvite]     = useState(false);

  // Post-author profiles (id → profile) for attribution on each card
  const [postAuthors, setPostAuthors] = useState<Record<string, { full_name: string | null; avatar_url: string | null }>>({});

  const fetchPosts = async () => {
    setLoading(true);
    // Owner sees all posts (including pending_approval); others only see approved
    let query = supabase
      .from("hook_page_posts")
      .select("id, page_id, author_id, content, media_url, media_type, type, likes_count, created_at, status")
      .eq("page_id", page.id)
      .order("created_at", { ascending: false })
      .limit(60);
    if (!isOwner) query = query.eq("status", "approved");
    const { data } = await query;
    const rows = data || [];
    setPosts(rows);

    // Fetch author profiles for attribution badges on each post card
    const authorIds = [...new Set(rows.map((p: any) => p.author_id).filter(Boolean))];
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", authorIds);
      if (profiles) {
        const pm: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
        for (const p of profiles as any[]) pm[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url };
        setPostAuthors(pm);
      }
    }

    setLoading(false);
  };

  const refreshPage = async () => {
    const { data } = await supabase.from("hook_pages").select("id, name, cover_url, avatar_url, description, category, owner_id, followers_count, hook_count, created_at").eq("id", page.id).single();
    if (data) { setLivePage(data as HookPage); onPageUpdated(data as HookPage); }
  };

  const fetchFollowData = async () => {
    setFollowError(null);
    // 1. Get authoritative followers_count from hook_pages
    const { data: pg, error: pgErr } = await supabase
      .from("hook_pages").select("followers_count").eq("id", page.id).single();
    if (pgErr) {
      const msg = pgErr.code === "42703"
        ? "followers_count column missing — run latest SQL migration."
        : `Count fetch failed: ${pgErr.message}`;
      setFollowError(msg);
      console.error("[HooksHub] fetchFollowData page error:", pgErr);
    } else {
      setMemberCount((pg as any).followers_count ?? 0);
    }
    // 2. Check if current user is a follower in page_followers
    const { data: myRow, error: pfErr } = await supabase
      .from("page_followers")
      .select("user_id")
      .eq("page_id", page.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (pfErr) {
      const msg = pfErr.code === "42P01"
        ? "page_followers table missing — run SQL: CREATE TABLE page_followers (page_id uuid, user_id uuid, UNIQUE(page_id,user_id));"
        : pfErr.code === "42501" || pfErr.code === "PGRST116"
        ? "RLS policy blocking read on page_followers — check Supabase policies."
        : `Follow status fetch failed: ${pfErr.message}`;
      setFollowError(msg);
      console.error("[HooksHub] fetchFollowData follower error:", pfErr);
    } else {
      setIsFollowing(!!myRow);
    }
  };

  useEffect(() => {
    fetchPosts();
    fetchFollowData();
    checkContributorStatus();
    fetchPendingInvites();
    // Real-time: watch page_followers for this page
    const ch = supabase.channel(`page-followers-${page.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "page_followers",
        filter: `page_id=eq.${page.id}` }, () => fetchFollowData())
      .subscribe();
    // Real-time: watch hook_invites so owner sees new requests instantly
    const invCh = supabase.channel(`hook-invites-${page.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "hook_invites",
        filter: `page_id=eq.${page.id}` }, () => { fetchPendingInvites(); checkContributorStatus(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); supabase.removeChannel(invCh); };
  }, [page.id]);

  const toggleFollow = async () => {
    if (followLoading) return;
    setFollowLoading(true);
    setFollowError(null);
    const wasFollowing = isFollowing;
    // Optimistic update
    setIsFollowing(!wasFollowing);
    setMemberCount(p => Math.max(0, p + (wasFollowing ? -1 : 1)));
    try {
      if (wasFollowing) {
        const { error } = await supabase.from("page_followers")
          .delete().eq("page_id", page.id).eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("page_followers")
          .upsert([{ page_id: page.id, user_id: userId }], { onConflict: "page_id,user_id" });
        if (error) throw error;
        // Notify page owner that someone followed their page
        if (page.owner_id && page.owner_id !== userId) {
          await supabase.from("notifications").insert({
            notifier_id: page.owner_id,
            actor_id: userId,
            type: "hook_follow",
            entity_id: page.id,
            content: page.name,
            is_read: false,
          });
        }
      }
      // Sync count from DB and update hook_pages.followers_count
      const { count, error: cErr } = await supabase
        .from("page_followers").select("user_id", { count: "exact", head: true })
        .eq("page_id", page.id);
      if (!cErr) {
        const trueCount = count ?? 0;
        setMemberCount(trueCount);
        await supabase.from("hook_pages").update({ followers_count: trueCount }).eq("id", page.id);
      }
    } catch (err: any) {
      // Rollback optimistic update
      setIsFollowing(wasFollowing);
      setMemberCount(p => Math.max(0, p + (wasFollowing ? 1 : -1)));
      const msg = err?.code === "42P01"
        ? "page_followers table nahi mili. Supabase mein SQL migration run karo."
        : err?.code === "42501"
        ? "Permission denied — check RLS policies on page_followers."
        : `Follow failed: ${err?.message || "Unknown error"}`;
      setFollowError(msg);
      console.error("[HooksHub] toggleFollow error:", err);
    } finally {
      setFollowLoading(false);
    }
  };

  const likePost = async (postId: string, cur: number) => {
    await supabase.from("hook_page_posts").update({ likes_count: cur + 1 }).eq("id", postId);
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes_count: cur + 1 } : p));
    await supabase.from("hook_pages").update({ like_count: (livePage.like_count || 0) + 1 }).eq("id", page.id);
    setLivePage(prev => ({ ...prev, like_count: (prev.like_count || 0) + 1 }));
  };

  const saveEditPost = async () => {
    if (!editingPost || !editPostText.trim()) return;
    // Permission guard: only owner or the post's own author may edit
    if (!isOwner && editingPost.author_id !== userId) {
      toast.error("Aap is post ko edit nahi kar sakte.");
      setEditingPost(null);
      return;
    }
    setEditPostSaving(true);
    await supabase.from("hook_page_posts")
      .update({ content: editPostText.trim() })
      .eq("id", editingPost.id)
      .eq("author_id", isOwner ? editingPost.author_id : userId); // server-side author lock for contributors
    setPosts(prev => prev.map(p => p.id === editingPost.id ? { ...p, content: editPostText.trim() } : p));
    setEditPostSaving(false);
    setEditingPost(null);
  };

  const deletePost = async (postId: string) => {
    // Permission guard: only owner or the post's own author may delete
    const target = posts.find(p => p.id === postId);
    if (!isOwner && target?.author_id !== userId) {
      toast.error("Sirf apni post delete kar sakte ho.");
      setConfirmDeletePost(null);
      return;
    }
    // Server-side: owner deletes by id; contributor can only delete their own post
    const query = supabase.from("hook_page_posts").delete().eq("id", postId);
    if (!isOwner) query.eq("author_id", userId);
    await query;
    setPosts(prev => prev.filter(p => p.id !== postId));
    setConfirmDeletePost(null);
    const { data: cur } = await supabase.from("hook_pages").select("hook_count").eq("id", page.id).single();
    await supabase.from("hook_pages").update({ hook_count: Math.max((cur?.hook_count || 1) - 1, 0) }).eq("id", page.id);
  };

  const deletePage = async () => {
    setDeletingPage(true);
    await supabase.from("hook_page_posts").delete().eq("page_id", page.id);
    await supabase.from("hook_pages").delete().eq("id", page.id).eq("owner_id", userId);
    setDeletingPage(false);
    onBack();
  };

  // ── Fetch pending invites for owner (includes join requests) ─────────────
  const fetchPendingInvites = async () => {
    if (page.owner_id !== userId) return;
    setInvitesLoading(true);
    const { data } = await supabase
      .from("hook_invites")
      .select("id, page_id, inviter_id, invitee_id, status, expires_at, created_at")
      .eq("page_id", page.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (data && data.length > 0) {
      // Collect all unique user ids (invitees + join-requesters who are their own invitee)
      const ids = [...new Set(data.map((r: any) => r.invitee_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", ids);
      const pm = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));
      setPendingInvites(data.map((r: any) => ({
        ...r,
        invitee: pm[r.invitee_id] || null,
        // isJoinRequest is true when the requesting user sent the row themselves
        isJoinRequest: r.inviter_id === r.invitee_id,
      })));
    } else {
      setPendingInvites([]);
    }
    setInvitesLoading(false);
  };

  // ── Check contributor status + pending invite/join-request for this user ─
  const checkContributorStatus = async () => {
    if (page.owner_id === userId) return;

    // Fetch all hook_invite rows for this page where invitee = current user
    const { data: rows } = await supabase
      .from("hook_invites")
      .select("id, status, expires_at, inviter_id, invitee_id")
      .eq("page_id", page.id)
      .eq("invitee_id", userId);

    const allRows = rows as any[] || [];

    const accepted = allRows.find((r: any) => r.status === "accepted");
    if (accepted) {
      setIsContributor(true);
      const exp = accepted.expires_at;
      setContributorExpiresAt(exp || null);
      setContributorExpired(exp ? new Date(exp) < new Date() : false);
      setHasPendingInvite(false);
      setHasPendingJoinReq(false);
      return;
    }

    setIsContributor(false);
    setContributorExpired(false);

    // Pending invite sent by the page owner to this user
    const ownerInvite = allRows.find(
      (r: any) => r.status === "pending" && r.inviter_id === page.owner_id && r.invitee_id === userId
    );
    setHasPendingInvite(!!ownerInvite);

    // Pending join request submitted by this user themselves
    const joinReq = allRows.find(
      (r: any) => r.status === "pending" && r.inviter_id === userId && r.invitee_id === userId
    );
    setHasPendingJoinReq(!!joinReq);
  };

  // ── Invitee accepts an owner-sent invite on the page ─────────────────────
  const acceptMyInvite = async () => {
    setAcceptingInvite(true);
    const { data: row } = await supabase
      .from("hook_invites")
      .select("id")
      .eq("page_id", page.id)
      .eq("invitee_id", userId)
      .eq("inviter_id", page.owner_id)
      .eq("status", "pending")
      .maybeSingle();
    if (row) {
      await supabase.from("hook_invites").update({ status: "accepted" }).eq("id", (row as any).id);
      // Notify the owner that the invite was accepted
      await supabase.from("notifications").insert({
        notifier_id: page.owner_id,
        actor_id: userId,
        type: "hook_invite_accepted",
        entity_id: page.id,
        content: page.name,
        is_read: false,
      });
      setHasPendingInvite(false);
      setIsContributor(true);
      setContributorExpired(false);
      toast.success("Invite accept kar liya! Ab aap is page par post kar sakte ho.");
    }
    setAcceptingInvite(false);
  };

  // ── Non-invited user requests to join a hook page ─────────────────────────
  const requestToJoin = async () => {
    setRequestingJoin(true);
    // Self-referential row: inviter_id = invitee_id = requesting user (owner identifies this as a join request)
    const { error } = await supabase.from("hook_invites").upsert(
      [{ page_id: page.id, inviter_id: userId, invitee_id: userId, status: "pending" }],
      { onConflict: "page_id,invitee_id" }
    );
    if (!error) {
      // Notify the page owner
      if (page.owner_id !== userId) {
        await supabase.from("notifications").insert({
          notifier_id: page.owner_id,
          actor_id: userId,
          type: "hook_invite",
          entity_id: page.id,
          content: page.name,
          is_read: false,
        });
      }
      setHasPendingJoinReq(true);
      toast.success("Join request bhej di! Owner ke accept karne ka wait karo.");
    } else {
      toast.error("Request bhejne mein dikkat aayi. Dobara try karo.");
    }
    setRequestingJoin(false);
  };

  // ── Accept a pending invite (owner dashboard) ─────────────────────────────
  const acceptInvite = async (inviteId: string, inviteeId: string, inviteeName: string) => {
    setAcceptingId(inviteId);
    // Apply the duration the owner selected for this invite
    const durValue = acceptDurationMap[inviteId] || "7d";
    const expires_at = calcExpiresAt(durValue);
    const durLabel = DURATION_OPTIONS.find(d => d.value === durValue)?.label || "7 Days";
    await supabase.from("hook_invites")
      .update({ status: "accepted", ...(expires_at ? { expires_at } : {}) })
      .eq("id", inviteId);
    // Notify invitee with duration info
    await supabase.from("notifications").insert({
      notifier_id: inviteeId,
      actor_id: userId,
      type: "hook_invite_accepted",
      entity_id: page.id,
      content: `${page.name}||${durLabel}`,
      is_read: false,
    });
    setPendingInvites(prev => prev.filter(i => i.id !== inviteId));
    setAcceptingId(null);
    toast.success(`${inviteeName || "User"} ko ${durLabel} ke liye posting access de diya!`);
  };

  // ── Approve / Reject a pending-approval contributor post ──────────────────
  const approvePost = async (postId: string) => {
    setApprovingPostId(postId);
    await supabase.from("hook_page_posts").update({ status: "approved" }).eq("id", postId);
    // Increment hook_count
    const { data: cur } = await supabase.from("hook_pages").select("hook_count").eq("id", page.id).single();
    await supabase.from("hook_pages").update({ hook_count: (cur?.hook_count || 0) + 1 }).eq("id", page.id);
    // Notify the contributor
    const post = posts.find(p => p.id === postId);
    if (post && post.author_id !== userId) {
      await supabase.from("notifications").insert({
        notifier_id: post.author_id, actor_id: userId,
        type: "hook_invite_accepted", entity_id: page.id,
        content: `${page.name}||post_approved`, is_read: false,
      });
    }
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, status: "approved" } : p));
    setApprovingPostId(null);
    toast.success("Post approve kar diya! Ab public feed par dikhai dega.");
  };

  const rejectPost = async (postId: string) => {
    setRejectingPostId(postId);
    await supabase.from("hook_page_posts").update({ status: "rejected" }).eq("id", postId);
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, status: "rejected" } : p));
    setRejectingPostId(null);
    toast("Post reject kar diya.");
  };

  // ── Reject a pending invite ───────────────────────────────────────────────
  const rejectInvite = async (inviteId: string, inviteeId: string, inviteeName: string) => {
    setRejectingId(inviteId);
    await supabase.from("hook_invites").update({ status: "rejected" }).eq("id", inviteId);
    setPendingInvites(prev => prev.filter(i => i.id !== inviteId));
    setRejectingId(null);
    toast(`${inviteeName || "User"} ki request reject kar di.`);
  };

  // canPost: owner always can; contributor only if accepted & not expired
  const canPost = isOwner || (isContributor && !contributorExpired);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* ── Facebook-style Banner ──────────────────────────────────────────── */}
      <div className="relative bg-white border-b border-gray-100 shadow-sm">
        {/* Banner */}
        <div
          className="relative w-full"
          style={{
            height: 160,
            backgroundImage: livePage.cover_url ? `url('${livePage.cover_url}')` : "none",
            backgroundColor: livePage.cover_url ? "transparent" : "#f3f4f6",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-black/15" />
          <button onClick={onBack}
            className="absolute top-3 left-3 w-9 h-9 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white z-10">
            <ArrowLeft size={18} />
          </button>
        </div>

        {/* Round profile pic — overlapping banner */}
        <div className="px-4">
          <div className="flex items-end justify-between -mt-10 mb-3 relative z-10">
            <div className="w-20 h-20 rounded-full border-4 border-white shadow-xl overflow-hidden bg-gray-200 flex items-center justify-center shrink-0">
              {(livePage.profiles?.avatar_url || livePage.avatar_url)
                ? <img src={livePage.profiles?.avatar_url || livePage.avatar_url} className="w-full h-full object-cover" alt="" loading="lazy"  decoding="async"/>
                : <span className="text-gray-500 font-black text-2xl">{(livePage.name || "H")[0].toUpperCase()}</span>
              }
            </div>
            {/* Action buttons */}
            <div className="flex items-center gap-2 pb-1">
              {!isOwner && (
                <div className="flex items-center gap-2">
                  {/* Follow / Following toggle */}
                  <motion.button
                    whileTap={{ scale: followLoading ? 1 : 0.93 }}
                    onClick={toggleFollow}
                    disabled={followLoading}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-black border-2 transition-all disabled:opacity-60"
                    style={{
                      background: isFollowing ? "white" : "linear-gradient(135deg,#2563eb,#7c3aed)",
                      borderColor: isFollowing ? "#d1d5db" : "transparent",
                      color: isFollowing ? "#374151" : "white",
                    }}>
                    {followLoading
                      ? <><Loader2 size={12} className="animate-spin" /> Saving…</>
                      : isFollowing ? "✓ Following" : "+ Follow"}
                  </motion.button>

                  {/* Contributor access buttons — only one shows at a time */}
                  {isContributor && !contributorExpired && (
                    <div className="flex flex-col items-end gap-0.5">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black bg-purple-50 text-purple-600 border-2 border-purple-200">
                        🤝 Page Partner
                      </div>
                      <span className="text-[9px] text-purple-400 font-bold px-1">
                        {timeRemaining(contributorExpiresAt)}
                      </span>
                    </div>
                  )}
                  {isContributor && contributorExpired && (
                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black bg-orange-50 text-orange-500 border-2 border-orange-200">
                      <AlertTriangle size={12} /> Access Expired
                    </div>
                  )}
                  {!isContributor && hasPendingInvite && (
                    <motion.button
                      whileTap={{ scale: acceptingInvite ? 1 : 0.93 }}
                      onClick={acceptMyInvite}
                      disabled={acceptingInvite}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black bg-green-500 text-white border-2 border-transparent transition-all disabled:opacity-60">
                      {acceptingInvite
                        ? <><Loader2 size={12} className="animate-spin" /> Accepting…</>
                        : <><Check size={12} /> Accept Invite</>}
                    </motion.button>
                  )}
                  {!isContributor && !hasPendingInvite && hasPendingJoinReq && (
                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black bg-gray-100 text-gray-500 border-2 border-gray-200">
                      <Loader2 size={12} className="animate-spin" /> Request Pending…
                    </div>
                  )}
                  {!isContributor && !hasPendingInvite && !hasPendingJoinReq && (
                    <motion.button
                      whileTap={{ scale: requestingJoin ? 1 : 0.93 }}
                      onClick={requestToJoin}
                      disabled={requestingJoin}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black border-2 border-blue-300 bg-blue-50 text-blue-600 transition-all disabled:opacity-60">
                      {requestingJoin
                        ? <><Loader2 size={12} className="animate-spin" /> Sending…</>
                        : <><Plus size={12} /> Request to Post</>}
                    </motion.button>
                  )}
                </div>
              )}
              {isOwner && (
                <>
                  <motion.button whileTap={{ scale: 0.93 }} onClick={() => setShowEditPage(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black border-2 border-blue-200 bg-blue-50 text-blue-600 transition-all">
                    <Pencil size={13} /> Edit
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.93 }} onClick={() => setShowDeletePageConfirm(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black border-2 border-red-200 bg-red-50 text-red-500 transition-all">
                    <Trash2 size={13} />
                  </motion.button>
                </>
              )}
              <motion.button whileTap={{ scale: 0.93 }} onClick={() => shareHookPage(livePage)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-black bg-gray-100 text-gray-700 border border-gray-200">
                <Share2 size={14} /> Share
              </motion.button>
            </div>
          </div>

          {/* Name + description */}
          <h1 className="font-black text-gray-800 text-[18px] leading-tight">{livePage.name}</h1>
          <p className="text-[11px] text-blue-600 font-bold mt-0.5">{livePage.category}</p>
          {livePage.description && <p className="text-[13px] text-gray-500 font-medium leading-snug mt-1 mb-2">{livePage.description}</p>}

          {/* DB Error Banner */}
          {followError && (
            <div className="flex items-start gap-2 mt-2 mb-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200">
              <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-[11px] text-red-700 font-semibold leading-snug">{followError}</p>
            </div>
          )}

          {/* Stats Row — Followers from hook_pages.followers_count */}
          <div className="flex gap-2 mt-3 mb-4">
            <StatCard icon={<Users size={18} className="text-blue-600" />}    label="Followers" value={memberCount}              color="bg-blue-50" />
            <StatCard icon={<Anchor size={18} className="text-purple-600" />} label="Hooks"     value={livePage.hook_count || 0} color="bg-purple-50" />
            <StatCard icon={<Heart size={18} className="text-red-500" />}     label="Likes"     value={livePage.like_count || 0} color="bg-red-50" />
          </div>
        </div>
      </div>

      {/* ── Tab bar (owner only) ──────────────────────────────────────────── */}
      {isOwner && (
        <div className="flex bg-white border-b border-gray-100">
          {(["posts", "approvals", "requests"] as const).map(tab => {
            const pendingPostCount = posts.filter(p => p.status === "pending_approval").length;
            const label =
              tab === "requests"   ? `Requests${pendingInvites.length > 0 ? ` (${pendingInvites.length})` : ""}`
              : tab === "approvals" ? `Approvals${pendingPostCount > 0 ? ` (${pendingPostCount})` : ""}`
              : "Posts";
            return (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === tab ? "text-blue-600 border-blue-500" : "text-gray-400 border-transparent"}`}>
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Post bar (owner or accepted contributor) ───────────────────────── */}
      {canPost && activeTab === "posts" && (
        <div className="px-4 py-3 bg-white border-b border-gray-100">
          {isContributor && !isOwner && (
            <p className="text-[10px] font-black text-purple-500 uppercase tracking-widest mb-2 flex items-center gap-1">
              <Anchor size={10} /> Contributor Access
            </p>
          )}
          {contributorExpired && !isOwner && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-50 border border-orange-200 mb-2">
              <AlertTriangle size={13} className="text-orange-500 shrink-0" />
              <p className="text-[11px] text-orange-700 font-semibold">Contributor access expired. Owner se request karo.</p>
            </div>
          )}
          {!contributorExpired && (
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => setAddPost(true)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-gray-200 bg-gray-50 text-left">
              <div className="flex gap-2">
                <ImgIcon size={16} className="text-blue-400" />
                <VideoIcon size={16} className="text-purple-400" />
              </div>
              <span className="text-gray-400 text-[13px] font-semibold">Photo, Video ya Text post karo...</span>
            </motion.button>
          )}
        </div>
      )}

      {/* ── Requests Panel (owner only) ───────────────────────────────────── */}
      {isOwner && activeTab === "requests" && (
        <div className="flex-1 p-4 space-y-3">
          {invitesLoading && <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-blue-500" /></div>}
          {!invitesLoading && pendingInvites.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-300">
              <Anchor size={40} strokeWidth={1.2} />
              <p className="text-[12px] font-black uppercase tracking-widest">Koi pending request nahi</p>
              <p className="text-[11px] text-gray-400 text-center px-6">Jab koi user hook invite accept karne wala ho, yahan dikhai dega</p>
            </div>
          )}
          {pendingInvites.map(invite => {
            const isJoinRequest = invite.inviter_id === invite.invitee_id;
            const selDur = acceptDurationMap[invite.id] || "7d";
            return (
              <motion.div key={invite.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 shrink-0 flex items-center justify-center">
                    {invite.invitee?.avatar_url
                      ? <img src={invite.invitee.avatar_url} className="w-full h-full object-cover" alt="" loading="lazy" decoding="async" />
                      : <span className="text-gray-500 font-black text-lg">{(invite.invitee?.full_name || "?")[0].toUpperCase()}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-gray-800 text-[14px] truncate">{invite.invitee?.full_name || "Unknown User"}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {isJoinRequest
                        ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-wide"><Plus size={8} /> Join Request</span>
                        : <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-600 text-[9px] font-black uppercase tracking-wide"><Anchor size={8} /> Aapne Invite Kiya</span>
                      }
                      <span className="text-[10px] text-gray-400 font-medium">{smartTime(invite.created_at)}</span>
                    </div>
                    <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                      {isJoinRequest ? "Is page par post karna chahta/chahti hai" : "Invite accept karna chahta/chahti hai"}
                    </p>
                  </div>
                </div>
                {/* Duration selector — owner picks before accepting */}
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Posting Access Duration</p>
                  <div className="flex flex-wrap gap-1.5">
                    {DURATION_OPTIONS.map(opt => (
                      <button key={opt.value}
                        onClick={() => setAcceptDurationMap(prev => ({ ...prev, [invite.id]: opt.value }))}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${selDur === opt.value ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500 border border-gray-200"}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <motion.button whileTap={{ scale: 0.93 }}
                    onClick={() => acceptInvite(invite.id, invite.invitee_id, invite.invitee?.full_name)}
                    disabled={acceptingId === invite.id || rejectingId === invite.id}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl bg-green-500 text-white text-[11px] font-black disabled:opacity-60">
                    {acceptingId === invite.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    Accept · {DURATION_OPTIONS.find(d => d.value === selDur)?.label}
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.93 }}
                    onClick={() => rejectInvite(invite.id, invite.invitee_id, invite.invitee?.full_name)}
                    disabled={acceptingId === invite.id || rejectingId === invite.id}
                    className="flex items-center gap-1 px-3 py-2.5 rounded-xl bg-red-100 text-red-500 text-[11px] font-black disabled:opacity-60">
                    {rejectingId === invite.id ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                    Reject
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Approvals Panel (owner only) ─────────────────────────────────────── */}
      {isOwner && activeTab === "approvals" && (
        <div className="flex-1 p-4 space-y-3">
          {loading && <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-blue-500" /></div>}
          {!loading && posts.filter(p => p.status === "pending_approval").length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-300">
              <CheckSquare size={40} strokeWidth={1.2} />
              <p className="text-[12px] font-black uppercase tracking-widest">Koi pending approval nahi</p>
              <p className="text-[11px] text-gray-400 text-center px-6">Contributors ke posts yahan review ke liye aayenge</p>
            </div>
          )}
          {posts.filter(p => p.status === "pending_approval").map(post => {
            const author = postAuthors[post.author_id];
            return (
              <motion.div key={post.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-yellow-200 shadow-sm overflow-hidden">
                <div className="px-4 pt-4 pb-2">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shrink-0">
                      {author?.avatar_url
                        ? <img src={author.avatar_url} className="w-full h-full object-cover" alt="" loading="lazy" decoding="async" />
                        : <span className="text-white font-black text-[11px]">{(author?.full_name || "?")[0].toUpperCase()}</span>}
                    </div>
                    <div>
                      <span className="font-black text-gray-800 text-[13px]">{author?.full_name || "Unknown"}</span>
                      <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-600 text-[9px] font-black">🤝 Page Partner</span>
                      <p className="text-[10px] text-gray-400">{smartTime(post.created_at)}</p>
                    </div>
                    <div className="ml-auto">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-yellow-50 text-yellow-600 text-[9px] font-black border border-yellow-200">⏳ Awaiting Approval</span>
                    </div>
                  </div>
                  {post.content && <p className="text-[14px] text-gray-700 font-medium leading-relaxed mb-2">{post.content}</p>}
                  {post.media_url && (() => {
                    const mt = post.media_type || post.type || "";
                    const url = post.media_url.toLowerCase();
                    const isVideo = mt === "video" || url.includes(".mp4") || url.includes(".mov") || url.includes(".webm");
                    return isVideo
                      ? <video src={post.media_url} className="w-full rounded-xl mb-2 max-h-64" controls preload="metadata" />
                      : <img src={post.media_url} alt="" className="w-full rounded-xl object-cover mb-2 max-h-64" loading="lazy" />;
                  })()}
                </div>
                <div className="flex gap-2 px-4 pb-4">
                  <motion.button whileTap={{ scale: 0.93 }}
                    onClick={() => approvePost(post.id)}
                    disabled={approvingPostId === post.id || rejectingPostId === post.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-500 text-white text-[12px] font-black disabled:opacity-60">
                    {approvingPostId === post.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    Approve & Publish
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.93 }}
                    onClick={() => rejectPost(post.id)}
                    disabled={approvingPostId === post.id || rejectingPostId === post.id}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-100 text-red-500 text-[12px] font-black disabled:opacity-60">
                    {rejectingPostId === post.id ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                    Reject
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Posts Feed ────────────────────────────────────────────────────── */}
      {activeTab === "posts" && (
      <div className="flex-1 p-4 space-y-3">
        {loading && <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-blue-500" /></div>}
        {!loading && posts.filter(p => p.status === "approved" || !p.status).length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-300">
            <FileText size={40} strokeWidth={1.2} />
            <p className="text-[12px] font-black uppercase tracking-widest">Abhi koi post nahi</p>
          </div>
        )}
        {posts.filter(p => p.status === "approved" || !p.status).map(post => {
          // Strict permission: owner can manage any post; contributors/viewers can only manage their OWN posts
          const canEditPost = isOwner || post.author_id === userId;
          const author = postAuthors[post.author_id];
          const isOwnerPost = post.author_id === page.owner_id;
          return (
            <motion.div key={post.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4">
                {/* Post author header row */}
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
                    {author?.avatar_url
                      ? <img src={author.avatar_url} className="w-full h-full object-cover" alt="" loading="lazy" decoding="async" />
                      : <span className="text-white font-black text-[11px]">{(author?.full_name || "?")[0].toUpperCase()}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-black text-gray-800 text-[13px] truncate">{author?.full_name || "Unknown"}</span>
                      {isOwnerPost
                        ? <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 text-[9px] font-black uppercase tracking-wide">★ Owner</span>
                        : <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-600 text-[9px] font-black">🤝 Page Partner</span>
                      }
                      {post.status === "pending_approval" && isOwner && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-yellow-50 text-yellow-600 text-[9px] font-black">⏳ Pending</span>
                      )}
                    </div>
                    {post.created_at && <p className="text-[10px] text-gray-400 mt-0.5">{smartTime(post.created_at)}</p>}
                  </div>
                  {/* Three-dot menu — only for permitted users */}
                  {canEditPost && (
                    <div className="relative shrink-0">
                      <button onClick={() => setPostMenuId(postMenuId === post.id ? null : post.id)}
                        className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400">
                        <MoreVertical size={16} />
                      </button>
                      <AnimatePresence>
                        {postMenuId === post.id && (
                          <motion.div initial={{ opacity: 0, scale: 0.9, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: -4 }} transition={{ duration: 0.12 }}
                            className="absolute right-0 top-8 z-50 w-36 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden"
                            onClick={e => e.stopPropagation()}>
                            {/* Edit — only owner or post's own author */}
                            {(isOwner || post.author_id === userId) && (
                              <button onClick={() => { setEditingPost({ id: post.id, content: post.content, author_id: post.author_id }); setEditPostText(post.content); setPostMenuId(null); }}
                                className="w-full flex items-center gap-2.5 px-4 py-3 text-blue-600 hover:bg-blue-50 text-[13px] font-semibold border-b border-gray-50">
                                <Pencil size={14} /> Edit
                              </button>
                            )}
                            {/* Delete — owner can delete any; contributor only their own */}
                            <button onClick={() => { setConfirmDeletePost(post.id); setPostMenuId(null); }}
                              className="w-full flex items-center gap-2.5 px-4 py-3 text-red-500 hover:bg-red-50 text-[13px] font-semibold">
                              <Trash2 size={14} /> Delete
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
                {post.content && <p className="text-[14px] text-gray-700 font-medium leading-relaxed mb-3">{post.content}</p>}
                {post.media_url && (() => {
                  const mt = post.media_type || post.type || "";
                  const url = post.media_url.toLowerCase();
                  const isVideo = mt === "video" || url.includes(".mp4") || url.includes(".mov") || url.includes(".webm");
                  const isImage = mt === "image" || (!isVideo && (url.includes(".jpg") || url.includes(".jpeg") || url.includes(".png") || url.includes(".gif") || url.includes(".webp")));
                  const showMedia = isVideo || isImage || (!mt && post.media_url);
                  if (!showMedia) return null;
                  return isVideo
                    ? <video src={post.media_url} className="w-full rounded-xl mt-2 max-h-80" controls preload="metadata" style={{ display: "block" }} />
                    : <img src={post.media_url} alt="Post media" className="w-full rounded-xl object-cover mt-2 max-h-80" loading="lazy" decoding="async" style={{ display: "block" }} />;
                })()}
              </div>
              <div className="flex items-center gap-2 px-4 pb-3 pt-2 border-t border-gray-50">
                <motion.button whileTap={{ scale: 0.88 }} onClick={() => likePost(post.id, post.likes_count)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 text-red-500 text-[12px] font-black">
                  <Heart size={14} fill="currentColor" /> {post.likes_count}
                </motion.button>
                <MagnetButton
                  postId={post.id}
                  postType="hook"
                  postOwnerId={page.owner_id}
                  currentUserId={userId}
                  dark={false}
                />
                <motion.button whileTap={{ scale: 0.88 }} onClick={() => shareHookPost(livePage, post)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 text-[12px] font-black">
                  <Share2 size={13} /> Share
                </motion.button>
                <div className="flex-1" />
                <motion.button whileTap={{ scale: 0.92 }} onClick={() => setHookModal(true)}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-white text-[12px] font-black"
                  style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}>
                  <Anchor size={13} /> Hook
                </motion.button>
              </div>
            </motion.div>
          );
        })}
      </div>
      )}

      <AnimatePresence>
        {hookModal  && <HookModal pageId={page.id} pageName={livePage.name} userId={userId} onClose={() => { setHookModal(false); refreshPage(); }} />}
        {addPost    && <AddPostModal pageId={page.id} userId={userId} isOwner={isOwner} pageName={livePage.name} onClose={() => setAddPost(false)} onPosted={() => { fetchPosts(); refreshPage(); }} />}
        {showEditPage && <EditPageModal page={livePage} userId={userId} onClose={() => setShowEditPage(false)} onSaved={p => { setLivePage(p); onPageUpdated(p); }} />}

        {/* Edit Post Modal */}
        {editingPost && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] flex items-end justify-center"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}
            onClick={e => { if (e.target === e.currentTarget) setEditingPost(null); }}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="w-full max-w-lg bg-white rounded-t-3xl p-5"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-gray-800 text-[16px] flex items-center gap-2"><Pencil size={16} className="text-blue-600" /> Post Edit Karo</h3>
                <button onClick={() => setEditingPost(null)} className="p-1.5 rounded-full bg-gray-100"><X size={18} className="text-gray-500" /></button>
              </div>
              <textarea value={editPostText} onChange={e => setEditPostText(e.target.value)} rows={4}
                className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-[14px] text-gray-800 outline-none focus:border-blue-500 resize-none mb-4" />
              <div className="flex gap-2">
                <button onClick={() => setEditingPost(null)} className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-600 font-black text-sm">Cancel</button>
                <button onClick={saveEditPost} disabled={editPostSaving || !editPostText.trim()}
                  className="flex-1 py-3 rounded-2xl bg-blue-600 text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-40">
                  {editPostSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {editPostSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Confirm Delete Post */}
        {confirmDeletePost && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] flex items-center justify-center px-6"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}
            onClick={() => setConfirmDeletePost(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={22} className="text-red-500" />
              </div>
              <p className="text-gray-900 font-black text-center text-[16px] mb-1">Post Delete Karo?</p>
              <p className="text-gray-400 text-center text-[12px] mb-5">Yeh post hamesha ke liye delete ho jayegi.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDeletePost(null)} className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-600 font-black text-sm">Cancel</button>
                <button onClick={() => deletePost(confirmDeletePost)} className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-black text-sm">Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Confirm Delete Page */}
        {showDeletePageConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] flex items-center justify-center px-6"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}
            onClick={() => setShowDeletePageConfirm(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={22} className="text-red-500" />
              </div>
              <p className="text-gray-900 font-black text-center text-[16px] mb-1">Page Delete Karo?</p>
              <p className="text-gray-400 text-center text-[12px] mb-5">Yeh page aur iske saare posts hamesha ke liye delete ho jayenge.</p>
              <div className="flex gap-2">
                <button onClick={() => setShowDeletePageConfirm(false)} className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-600 font-black text-sm">Cancel</button>
                <button onClick={deletePage} disabled={deletingPage}
                  className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-40">
                  {deletingPage ? <Loader2 size={16} className="animate-spin" /> : null}
                  {deletingPage ? "Deleting…" : "Delete"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Close post menu on outside click */}
      {postMenuId && (
        <div className="fixed inset-0 z-40" onClick={() => setPostMenuId(null)} />
      )}
    </div>
  );
};

// ── Main HooksHub ──────────────────────────────────────────────────────────────
const HooksHub = ({ userId, initialOpenPageId }: { userId: string; initialOpenPageId?: string | null }) => {
  const [myPages, setMyPages]           = useState<HookPage[]>([]);
  const [suggested, setSuggested]       = useState<HookPage[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [followingPages, setFollowingPages] = useState<Record<string, boolean>>({});
  const [loading, setLoading]           = useState(true);
  const [dbError, setDbError]           = useState<string | null>(null);
  const [activePage, setActivePage]     = useState<HookPage | null>(null);
  const [showCreate, setShowCreate]     = useState(false);
  const pendingOpenRef = useRef<string | null>(initialOpenPageId ?? null);

  // ── Listen for notification-click deep-links to a specific hook page ──────
  useEffect(() => {
    const handler = (e: Event) => {
      const hookId = (e as CustomEvent<{ hookId: string }>).detail?.hookId;
      if (!hookId) return;
      // Try to find in already-loaded pages first
      const found = [...myPages, ...suggested].find(p => p.id === hookId);
      if (found) { setActivePage(found); return; }
      // Otherwise fetch directly from DB (notification may point to a page not in current lists)
      supabase.from("hook_pages")
        .select("id, name, description, category, cover_url, avatar_url, owner_id, hook_count, created_at")
        .eq("id", hookId).single()
        .then(({ data }) => { if (data) setActivePage(data as HookPage); });
    };
    window.addEventListener("flicks:open-hook", handler);
    return () => window.removeEventListener("flicks:open-hook", handler);
  }, [myPages, suggested]);

  // ── Open specific page from deep-link (home strip click or initial prop) ──
  useEffect(() => {
    if (!pendingOpenRef.current) return;
    const target = [...myPages, ...suggested].find(p => p.id === pendingOpenRef.current);
    if (target) {
      setActivePage(target);
      pendingOpenRef.current = null;
    } else if (!loading && pendingOpenRef.current) {
      // Not in lists — fetch directly
      supabase.from("hook_pages")
        .select("id, name, description, category, cover_url, avatar_url, owner_id, hook_count, created_at")
        .eq("id", pendingOpenRef.current).single()
        .then(({ data }) => { if (data) { setActivePage(data as HookPage); pendingOpenRef.current = null; } });
    }
  }, [myPages, suggested, loading]);

  const fetchPages = useCallback(async (force = false) => {
    // Serve from cache instantly if still fresh (5-min TTL) and not forced
    const pagesKey = `hookPages_${userId}`;
    if (!force) {
      const hit = memGet<{ mine: HookPage[]; suggested: HookPage[]; memberCounts: Record<string, number>; following: Record<string, boolean> }>(pagesKey);
      if (hit) {
        setMyPages(hit.mine);
        setSuggested(hit.suggested);
        setMemberCounts(hit.memberCounts);
        setFollowingPages(hit.following);
        setLoading(false);
        return;
      }
    }
    setLoading(true);
    setDbError(null);
    // Step 1 — fetch hook_pages without relational join (avoids PostgREST FK dependency)
    const [{ data: mine, error: mErr }, { data: all, error: aErr }] = await Promise.all([
      supabase.from("hook_pages").select("id, name, description, category, cover_url, avatar_url, owner_id, hook_count, created_at").eq("owner_id", userId).order("created_at", { ascending: false }),
      supabase.from("hook_pages").select("id, name, description, category, cover_url, avatar_url, owner_id, hook_count, created_at").neq("owner_id", userId).order("hook_count", { ascending: false }).limit(12),
    ]);
    if (mErr || aErr) {
      const e = mErr || aErr;
      setDbError(`Pages fetch failed: ${e?.message} (code: ${e?.code})`);
      console.error("[HooksHub] fetchPages error:", e);
      setLoading(false);
      return;
    }
    let pages = [...(mine || []), ...(all || [])] as HookPage[];

    // Step 2 — manually fetch owner profiles and merge (no FK join needed)
    const ownerIds = [...new Set(pages.map(p => p.owner_id).filter(Boolean))];
    if (ownerIds.length > 0) {
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, avatar_url, full_name")
        .in("id", ownerIds);
      if (profileRows) {
        const pm: Record<string, { avatar_url: string | null; full_name: string | null }> = {};
        for (const p of profileRows as any[]) pm[p.id] = { avatar_url: p.avatar_url, full_name: p.full_name };
        pages = pages.map(p => ({ ...p, profiles: pm[p.owner_id] ?? null }));
      }
    }

    setMyPages(pages.filter(p => p.owner_id === userId));
    setSuggested(pages.filter(p => p.owner_id !== userId));

    if (pages.length) {
      const ids = pages.map(p => p.id);
      const counts: Record<string, number> = {};
      pages.forEach(p => { counts[p.id] = (p as any).followers_count ?? p.follower_count ?? 0; });
      setMemberCounts(counts);

      const { data: myFollows, error: pfErr } = await supabase
        .from("page_followers")
        .select("page_id")
        .eq("user_id", userId)
        .in("page_id", ids);
      if (pfErr) {
        const msg = pfErr.code === "42P01"
          ? "page_followers table missing — run SQL migration in Supabase."
          : `Follow status load failed: ${pfErr.message} (code: ${pfErr.code})`;
        setDbError(msg);
        console.error("[HooksHub] fetchPages follow status error:", pfErr);
      } else {
        const following: Record<string, boolean> = {};
        (myFollows || []).forEach(row => { following[row.page_id] = true; });
        setFollowingPages(following);
        // Persist full result to 5-min cache
        memSet(pagesKey, {
          mine: pages.filter(p => p.owner_id === userId),
          suggested: pages.filter(p => p.owner_id !== userId),
          memberCounts: counts,
          following,
        });
      }
    }
    setLoading(false);
  }, [userId]);

  // Toggle follow directly from the listing card
  const toggleFollowOnCard = async (e: React.MouseEvent, pg: HookPage) => {
    e.stopPropagation();
    const already = !!followingPages[pg.id];
    const prevCount = memberCounts[pg.id] || 0;
    // Optimistic update
    setFollowingPages(prev => ({ ...prev, [pg.id]: !already }));
    setMemberCounts(prev => ({ ...prev, [pg.id]: Math.max(0, prevCount + (already ? -1 : 1)) }));
    try {
      if (already) {
        const { error } = await supabase.from("page_followers")
          .delete().eq("page_id", pg.id).eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("page_followers")
          .upsert([{ page_id: pg.id, user_id: userId }], { onConflict: "page_id,user_id" });
        if (error) throw error;
      }
      // Get real count and sync it to hook_pages.followers_count
      const { count, error: cErr } = await supabase
        .from("page_followers").select("user_id", { count: "exact", head: true })
        .eq("page_id", pg.id);
      if (!cErr) {
        const trueCount = count ?? 0;
        setMemberCounts(prev => ({ ...prev, [pg.id]: trueCount }));
        await supabase.from("hook_pages").update({ followers_count: trueCount }).eq("id", pg.id);
      }
    } catch (err: any) {
      // Rollback
      setFollowingPages(prev => ({ ...prev, [pg.id]: already }));
      setMemberCounts(prev => ({ ...prev, [pg.id]: prevCount }));
      const msg = err?.code === "42P01"
        ? "page_followers table missing — run SQL migration."
        : `Follow failed: ${err?.message || "Unknown error"} (code: ${err?.code})`;
      setDbError(msg);
      console.error("[HooksHub] toggleFollowOnCard error:", err);
    }
  };

  useEffect(() => {
    fetchPages();
    // Real-time: any follow/unfollow refreshes the listing
    const ch = supabase.channel("hub-page-followers")
      .on("postgres_changes", { event: "*", schema: "public", table: "page_followers" }, () => fetchPages())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, fetchPages]);

  if (activePage) {
    return (
      <PageDashboard
        page={activePage}
        userId={userId}
        initialIsFollowing={!!followingPages[activePage.id]}
        initialMemberCount={memberCounts[activePage.id] || 0}
        onBack={() => { setActivePage(null); fetchPages(); }}
        onPageUpdated={updated => setActivePage(updated)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Hero */}
      <div className="px-4 pt-5 pb-3 bg-white border-b border-gray-100 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-md">
              <Anchor size={18} className="text-white" />
            </div>
            <div>
              <h1 className="font-black text-gray-800 text-[18px] leading-tight">Hooks</h1>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Viral karo apna page</p>
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.93 }} onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-white text-[12px] font-black shadow-md"
            style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}>
            <Plus size={15} /> Page Banao
          </motion.button>
        </div>
      </div>

      {/* DB Error Banner */}
      {dbError && (
        <div className="mx-4 mt-3 flex items-start gap-2 px-3 py-3 rounded-xl bg-red-50 border border-red-200">
          <AlertTriangle size={15} className="text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-black text-red-700 mb-0.5">Database Error</p>
            <p className="text-[11px] text-red-600 font-medium leading-snug break-all">{dbError}</p>
          </div>
          <button onClick={() => setDbError(null)} className="text-red-400 hover:text-red-600 shrink-0">
            <X size={14} />
          </button>
        </div>
      )}

      {loading && <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-blue-500" /></div>}

      {!loading && (
        <>
          {/* My Pages */}
          {myPages.length > 0 && (
            <section className="mt-4 mb-2">
              <div className="flex items-center gap-2 px-4 mb-3">
                <Star size={13} className="text-amber-500 fill-amber-500" />
                <h2 className="font-black text-gray-700 text-[12px] uppercase tracking-widest">Mere Pages</h2>
              </div>
              <div className="grid grid-cols-1 gap-3 px-4">
                {myPages.map(pg => (
                  <PageBannerCard
                    key={pg.id} pg={pg} onClick={() => setActivePage(pg)}
                    memberCount={memberCounts[pg.id] || 0}
                    isOwner={true}
                    isFollowing={false}
                    onToggleFollow={e => toggleFollowOnCard(e, pg)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Empty state */}
          {myPages.length === 0 && (
            <div className="mx-4 mt-4 mb-4 p-5 bg-white rounded-2xl border border-dashed border-blue-200 flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
                <Anchor size={26} className="text-blue-400" />
              </div>
              <div className="text-center">
                <p className="font-black text-gray-700 text-[14px]">Apna pehla Page banao!</p>
                <p className="text-[12px] text-gray-400 mt-1">Hook ke zariye friends ko invite karo aur viral ho jao.</p>
              </div>
              <motion.button whileTap={{ scale: 0.96 }} onClick={() => setShowCreate(true)}
                className="px-5 py-2.5 rounded-xl text-white text-[13px] font-black"
                style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}>
                + Create Page
              </motion.button>
            </div>
          )}

          {/* Suggested Pages */}
          {suggested.length > 0 && (
            <section className="mt-2">
              <div className="flex items-center gap-2 px-4 mb-3">
                <Zap size={13} className="text-purple-500 fill-purple-500" />
                <h2 className="font-black text-gray-700 text-[12px] uppercase tracking-widest">Suggested Pages</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 px-4">
                {suggested.map(pg => (
                  <PageBannerCard
                    key={pg.id} pg={pg} onClick={() => setActivePage(pg)}
                    memberCount={memberCounts[pg.id] || 0}
                    isOwner={false}
                    isFollowing={!!followingPages[pg.id]}
                    onToggleFollow={e => toggleFollowOnCard(e, pg)}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <AnimatePresence>
        {showCreate && (
          <CreatePageModal userId={userId} onClose={() => setShowCreate(false)}
            onCreated={pg => { setShowCreate(false); setMyPages(prev => [pg, ...prev]); setActivePage(pg); }} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default HooksHub;
