import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { smartTime } from "@/lib/timeAgo";
import { memGet, memSet } from "@/lib/memCache";
import { usePageVisibility } from "@/hooks/usePageVisibility";
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
  media_url: string; media_type: string; likes_count: number; created_at: string;
}
interface Friend { id: string; full_name: string; avatar_url: string; }

const CATEGORIES = ["General","Business","Entertainment","Education","Sports","Food","Travel","Tech","Art","Music"];
const STORAGE_BUCKET = "hooks";


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
    const rows = Array.from(selected).map(invitee_id => ({ page_id: pageId, inviter_id: userId, invitee_id, status: "pending" }));
    await supabase.from("hook_invites").upsert(rows, { onConflict: "page_id,invitee_id" });
    const { data: cur } = await supabase.from("hook_pages").select("hook_count").eq("id", pageId).single();
    await supabase.from("hook_pages").update({ hook_count: (cur?.hook_count || 0) + selected.size }).eq("id", pageId);
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
        style={{ maxHeight: "82vh", display: "flex", flexDirection: "column" }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2"><Anchor size={18} className="text-blue-600" /><h2 className="font-black text-gray-800 text-[16px]">Hook Friends</h2></div>
            <p className="text-[11px] text-gray-400 mt-0.5">Invite karo — <span className="font-bold text-blue-600">{pageName}</span></p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X size={20} /></button>
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
            {sending ? "Bhej raha hoon..." : `Hook Bhejo (${selected.size})`}
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
const AddPostModal = ({ pageId, userId, onClose, onPosted }:
  { pageId: string; userId: string; onClose: () => void; onPosted: () => void }) => {
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
    const url = URL.createObjectURL(file);
    setMediaPreview(url);
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
    await supabase.from("hook_page_posts").insert([{
      page_id: pageId, author_id: userId,
      content: content.trim(), media_url, media_type: mediaType,
    }]);
    const { data: cur } = await supabase.from("hook_pages").select("hook_count").eq("id", pageId).single();
    await supabase.from("hook_pages").update({ hook_count: (cur?.hook_count || 0) + 1 }).eq("id", pageId);
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
          <h2 className="font-black text-gray-800 text-[16px]">Page Post</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <textarea value={content} onChange={e => setContent(e.target.value)}
            placeholder="Page par kya share karna hai..." rows={3} autoFocus
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[14px] font-semibold text-gray-800 outline-none focus:border-blue-500 resize-none" />

          {/* Media preview */}
          {mediaPreview && (
            <div className="relative rounded-xl overflow-hidden bg-black">
              {mediaType === "image"
                ? <img src={mediaPreview} className="w-full max-h-48 object-cover" alt="" loading="lazy"  decoding="async"/>
                : <video src={mediaPreview} className="w-full max-h-48" controls  preload="none"/>
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
            style={{ background: (content.trim() || mediaFile) && !saving ? "linear-gradient(135deg,#2563eb,#1d4ed8)" : "#e5e7eb", color: (content.trim() || mediaFile) && !saving ? "#fff" : "#9ca3af" }}>
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            {saving ? "Upload ho raha hai..." : "Post Karo"}
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
  const pageVisible = usePageVisibility();
  const [posts, setPosts]         = useState<PagePost[]>([]);
  const [loading, setLoading]     = useState(true);
  const [hookModal, setHookModal] = useState(false);
  const [addPost, setAddPost]     = useState(false);
  const [livePage, setLivePage]   = useState<HookPage>(page);
  const [memberCount, setMemberCount] = useState(initialMemberCount);
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [followError, setFollowError] = useState<string | null>(null);
  const [followLoading, setFollowLoading] = useState(false);

  // Edit / Delete state
  const [showEditPage, setShowEditPage]       = useState(false);
  const [postMenuId, setPostMenuId]           = useState<string | null>(null);
  const [editingPost, setEditingPost]         = useState<{ id: string; content: string } | null>(null);
  const [editPostText, setEditPostText]       = useState("");
  const [editPostSaving, setEditPostSaving]   = useState(false);
  const [confirmDeletePost, setConfirmDeletePost] = useState<string | null>(null);
  const [showDeletePageConfirm, setShowDeletePageConfirm] = useState(false);
  const [deletingPage, setDeletingPage]       = useState(false);

  const fetchPosts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("hook_page_posts")
      .select("id, page_id, author_id, content, media_url, type, likes_count, created_at")
      .eq("page_id", page.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setPosts(data || []);
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
    if (!pageVisible) return;
    fetchPosts();
    fetchFollowData();
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleFollowRefresh = () => {
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        fetchFollowData();
      }, 1000);
    };
    // Real-time: watch page_followers for this page
    const ch = supabase.channel(`page-followers-${page.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "page_followers",
        filter: `page_id=eq.${page.id}` }, scheduleFollowRefresh)
      .subscribe();
    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      supabase.removeChannel(ch);
    };
  }, [page.id, pageVisible]);

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
    setEditPostSaving(true);
    await supabase.from("hook_page_posts").update({ content: editPostText.trim() }).eq("id", editingPost.id);
    setPosts(prev => prev.map(p => p.id === editingPost.id ? { ...p, content: editPostText.trim() } : p));
    setEditPostSaving(false);
    setEditingPost(null);
  };

  const deletePost = async (postId: string) => {
    await supabase.from("hook_page_posts").delete().eq("id", postId);
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

  const isOwner = page.owner_id === userId;

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

      {/* ── Post bar (owner only) ──────────────────────────────────────────── */}
      {isOwner && (
        <div className="px-4 py-3 bg-white border-b border-gray-100">
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => setAddPost(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-gray-200 bg-gray-50 text-left">
            <div className="flex gap-2">
              <ImgIcon size={16} className="text-blue-400" />
              <VideoIcon size={16} className="text-purple-400" />
            </div>
            <span className="text-gray-400 text-[13px] font-semibold">Photo, Video ya Text post karo...</span>
          </motion.button>
        </div>
      )}

      {/* ── Posts Feed ────────────────────────────────────────────────────── */}
      <div className="flex-1 p-4 space-y-3">
        {loading && <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-blue-500" /></div>}
        {!loading && posts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-300">
            <FileText size={40} strokeWidth={1.2} />
            <p className="text-[12px] font-black uppercase tracking-widest">Abhi koi post nahi</p>
          </div>
        )}
        {posts.map(post => {
          const canEditPost = post.author_id === userId || isOwner;
          return (
            <motion.div key={post.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4">
                {/* Post header with three-dots */}
                {canEditPost && (
                  <div className="flex justify-end mb-2 relative">
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
                          <button onClick={() => { setEditingPost({ id: post.id, content: post.content }); setEditPostText(post.content); setPostMenuId(null); }}
                            className="w-full flex items-center gap-2.5 px-4 py-3 text-blue-600 hover:bg-blue-50 text-[13px] font-semibold border-b border-gray-50">
                            <Pencil size={14} /> Edit
                          </button>
                          <button onClick={() => { setConfirmDeletePost(post.id); setPostMenuId(null); }}
                            className="w-full flex items-center gap-2.5 px-4 py-3 text-red-500 hover:bg-red-50 text-[13px] font-semibold">
                            <Trash2 size={14} /> Delete
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
                {post.content && <p className="text-[14px] text-gray-700 font-medium leading-relaxed mb-3">{post.content}</p>}
                {post.created_at && (
                  <p className="text-[10px] text-gray-400 mb-2 -mt-1">{smartTime(post.created_at)}</p>
                )}
                {post.media_url && post.media_type === "image" && (
                  <img src={post.media_url} className="w-full rounded-xl object-cover max-h-72" alt="" loading="lazy"  decoding="async"/>
                )}
                {post.media_url && post.media_type === "video" && (
                  <video src={post.media_url} className="w-full rounded-xl max-h-72" controls  preload="none"/>
                )}
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

      <AnimatePresence>
        {hookModal  && <HookModal pageId={page.id} pageName={livePage.name} userId={userId} onClose={() => { setHookModal(false); refreshPage(); }} />}
        {addPost    && <AddPostModal pageId={page.id} userId={userId} onClose={() => setAddPost(false)} onPosted={() => { fetchPosts(); refreshPage(); }} />}
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
  const pageVisible = usePageVisibility();
  const [myPages, setMyPages]           = useState<HookPage[]>([]);
  const [suggested, setSuggested]       = useState<HookPage[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [followingPages, setFollowingPages] = useState<Record<string, boolean>>({});
  const [loading, setLoading]           = useState(true);
  const [dbError, setDbError]           = useState<string | null>(null);
  const [activePage, setActivePage]     = useState<HookPage | null>(null);
  const [showCreate, setShowCreate]     = useState(false);
  const pendingOpenRef = useRef<string | null>(initialOpenPageId ?? null);

  // Open specific page from deep-link (home strip click)
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
       supabase.from("hook_pages").select("id, name, description, category, cover_url, avatar_url, owner_id, hook_count, created_at").eq("owner_id", userId).order("created_at", { ascending: false }).limit(50),
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
    if (!pageVisible) return;
    fetchPages();
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const schedulePagesRefresh = () => {
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        fetchPages();
      }, 1000);
    };
    // Real-time: any follow/unfollow refreshes the listing
    const ch = supabase.channel("hub-page-followers")
      .on("postgres_changes", { event: "*", schema: "public", table: "page_followers" }, schedulePagesRefresh)
      .subscribe();
    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      supabase.removeChannel(ch);
    };
  }, [userId, fetchPages, pageVisible]);

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
