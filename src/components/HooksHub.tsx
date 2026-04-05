import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import {
  Anchor, Plus, ArrowLeft, X, Users, Heart, FileText,
  DollarSign, Send, CheckSquare, Square, Loader2, Star,
  ChevronRight, Zap, Share2, Copy, MessageCircle, Upload,
  PlayCircle, Image as ImgIcon, Video as VideoIcon, Check,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface HookPage {
  id: string; owner_id: string; name: string; description: string;
  category: string; cover_url: string; avatar_url: string;
  follower_count: number; hook_count: number; post_count: number;
  like_count: number; is_monetized: boolean; created_at: string;
  _member_count?: number;
}
interface PagePost {
  id: string; page_id: string; author_id: string; content: string;
  media_url: string; media_type: string; likes_count: number; created_at: string;
}
interface Friend { id: string; full_name: string; avatar_url: string; }

const CATEGORIES = ["General","Business","Entertainment","Education","Sports","Food","Travel","Tech","Art","Music"];
const STORAGE_BUCKET = "avatars";

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
          ? <img src={preview} className="w-full h-full object-cover" alt="" />
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
    <div className="relative h-24 w-full"
      style={{
        background: pg.cover_url
          ? `url(${pg.cover_url}) center/cover no-repeat`
          : "linear-gradient(135deg,#2563eb 0%,#7c3aed 100%)",
      }}
    >
      <div className="absolute inset-0 bg-black/20" />
      {/* Avatar overlapping */}
      <div className="absolute -bottom-6 left-3 w-14 h-14 rounded-full border-4 border-white shadow-md overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-black text-lg">
        {pg.avatar_url
          ? <img src={pg.avatar_url} className="w-full h-full object-cover" alt="" />
          : pg.name[0].toUpperCase()}
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

// ── Hook Modal (Invite Friends) ────────────────────────────────────────────────
const HookModal = ({ pageId, pageName, userId, onClose }:
  { pageId: string; pageName: string; userId: string; onClose: () => void }) => {
  const [friends, setFriends]   = useState<Friend[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);
  const [sentIds, setSentIds]   = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("profiles").select("id,full_name,avatar_url").neq("id", userId).limit(50);
      setFriends(data || []);
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
                  {f.avatar_url ? <img src={f.avatar_url} className="w-full h-full object-cover" alt="" /> : f.full_name[0]}
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

// ── Share Modal ────────────────────────────────────────────────────────────────
const ShareModal = ({ page, onClose }: { page: HookPage; onClose: () => void }) => {
  const [copied, setCopied] = useState(false);
  const pageUrl = `${window.location.origin}/?page=${page.id}`;
  const waText  = encodeURIComponent(`🔗 Dekho yeh amazing page: *${page.name}*\n${page.description || ""}\n\n${pageUrl}`);

  const copy = async () => {
    await navigator.clipboard.writeText(pageUrl).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  const shareWA    = () => window.open(`https://wa.me/?text=${waText}`, "_blank");
  const shareNative = async () => {
    if (navigator.share) await navigator.share({ title: page.name, text: page.description || "", url: pageUrl });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[500] flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 26, stiffness: 260 }}
        className="w-full max-w-lg bg-white rounded-t-3xl shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 className="font-black text-gray-800 text-[16px] flex items-center gap-2"><Share2 size={18} className="text-blue-600" /> Page Share Karo</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-3">
          {/* Link copy */}
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
            <p className="flex-1 text-[12px] text-gray-500 font-medium truncate">{pageUrl}</p>
            <motion.button whileTap={{ scale: 0.9 }} onClick={copy}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-black transition-colors ${copied ? "bg-green-500 text-white" : "bg-blue-600 text-white"}`}>
              {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
            </motion.button>
          </div>
          {/* WhatsApp */}
          <motion.button whileTap={{ scale: 0.97 }} onClick={shareWA}
            className="w-full flex items-center gap-3 p-4 rounded-2xl bg-green-50 border border-green-100 text-left">
            <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center shrink-0">
              <MessageCircle size={20} className="text-white" />
            </div>
            <div><p className="font-black text-gray-800 text-[13px]">WhatsApp par Share Karo</p><p className="text-[10px] text-gray-400 font-medium">Friends ko directly bhejo</p></div>
          </motion.button>
          {/* Native share */}
          {typeof navigator !== "undefined" && "share" in navigator && (
            <motion.button whileTap={{ scale: 0.97 }} onClick={shareNative}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-blue-50 border border-blue-100 text-left">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                <Share2 size={20} className="text-white" />
              </div>
              <div><p className="font-black text-gray-800 text-[13px]">More Options</p><p className="text-[10px] text-gray-400 font-medium">Instagram, Twitter, aur zyada</p></div>
            </motion.button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
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
    const { data: cur } = await supabase.from("hook_pages").select("post_count").eq("id", pageId).single();
    await supabase.from("hook_pages").update({ post_count: (cur?.post_count || 0) + 1 }).eq("id", pageId);
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
                ? <img src={mediaPreview} className="w-full max-h-48 object-cover" alt="" />
                : <video src={mediaPreview} className="w-full max-h-48" controls />
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
  const [form, setForm]       = useState({ name: "", description: "", category: "General" });
  const [coverFile, setCoverFile]   = useState<File | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverPrev, setCoverPrev]   = useState("");
  const [avatarPrev, setAvatarPrev] = useState("");
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState("");

  const create = async () => {
    if (!form.name.trim()) { setErr("Page ka naam zaroori hai"); return; }
    setSaving(true);
    const [cover_url, avatar_url] = await Promise.all([
      coverFile  ? uploadFile(coverFile,  "hook-covers")  : Promise.resolve(""),
      avatarFile ? uploadFile(avatarFile, "hook-avatars") : Promise.resolve(""),
    ]);
    const { data, error } = await supabase.from("hook_pages")
      .insert([{ owner_id: userId, name: form.name.trim(), description: form.description.trim(), category: form.category, cover_url: cover_url || "", avatar_url: avatar_url || "" }])
      .select().single();
    setSaving(false);
    if (error) { setErr("Page nahi ban saka. Supabase SQL tables setup karein."); return; }
    onCreated(data as HookPage);
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

          {/* Avatar */}
          <div className="flex items-end gap-4">
            <div className="w-20 shrink-0">
              <p className="text-[11px] font-black text-gray-500 uppercase tracking-wide mb-1">Profile Pic</p>
              <div onClick={() => document.getElementById("av-pick")?.click()}
                className="w-20 h-20 rounded-full bg-gray-100 border-2 border-dashed border-gray-200 flex items-center justify-center cursor-pointer hover:border-blue-400 overflow-hidden">
                {avatarPrev ? <img src={avatarPrev} className="w-full h-full object-cover" alt="" />
                  : <Upload size={18} className="text-gray-400" />}
              </div>
              <input id="av-pick" type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) { setAvatarFile(f); setAvatarPrev(URL.createObjectURL(f)); } }} />
            </div>
            <div className="flex-1">
              <label className="text-[11px] font-black text-gray-500 uppercase tracking-wide mb-1 block">Page ka Naam *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Jaise: My Cooking Page"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[14px] font-semibold text-gray-800 outline-none focus:border-blue-500 transition-colors" />
            </div>
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
  const [shareModal, setShareModal] = useState(false);
  const [addPost, setAddPost]     = useState(false);
  const [livePage, setLivePage]   = useState<HookPage>(page);
  const [memberCount, setMemberCount] = useState(initialMemberCount);
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);

  const fetchPosts = async () => {
    setLoading(true);
    const { data } = await supabase.from("hook_page_posts").select("*").eq("page_id", page.id).order("created_at", { ascending: false });
    setPosts(data || []);
    setLoading(false);
  };

  const refreshPage = async () => {
    const { data } = await supabase.from("hook_pages").select("*").eq("id", page.id).single();
    if (data) { setLivePage(data as HookPage); onPageUpdated(data as HookPage); }
  };

  const fetchMemberCount = async () => {
    const { count } = await supabase.from("hook_members").select("id", { count: "exact", head: true }).eq("page_id", page.id);
    setMemberCount(count || 0);
    const { data: myRow } = await supabase.from("hook_members").select("id").eq("page_id", page.id).eq("user_id", userId).maybeSingle();
    setIsFollowing(!!myRow);
  };

  useEffect(() => {
    fetchPosts(); fetchMemberCount();

    // Real-time subscription for member count
    const ch = supabase.channel(`hook-members-${page.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "hook_members", filter: `page_id=eq.${page.id}` },
        () => fetchMemberCount())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [page.id]);

  const toggleFollow = async () => {
    if (isFollowing) {
      await supabase.from("hook_members").delete().eq("page_id", page.id).eq("user_id", userId);
      setIsFollowing(false); setMemberCount(p => Math.max(0, p - 1));
    } else {
      await supabase.from("hook_members").upsert([{ page_id: page.id, user_id: userId }], { onConflict: "page_id,user_id" });
      setIsFollowing(true); setMemberCount(p => p + 1);
    }
  };

  const likePost = async (postId: string, cur: number) => {
    await supabase.from("hook_page_posts").update({ likes_count: cur + 1 }).eq("id", postId);
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes_count: cur + 1 } : p));
    await supabase.from("hook_pages").update({ like_count: (livePage.like_count || 0) + 1 }).eq("id", page.id);
    setLivePage(prev => ({ ...prev, like_count: (prev.like_count || 0) + 1 }));
  };

  const isOwner = page.owner_id === userId;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* ── Facebook-style Banner ──────────────────────────────────────────── */}
      <div className="relative bg-white border-b border-gray-100 shadow-sm">
        {/* Banner */}
        <div className="relative w-full" style={{ height: 160 }}>
          <div className="absolute inset-0"
            style={{
              background: livePage.cover_url
                ? `url(${livePage.cover_url}) center/cover no-repeat`
                : "linear-gradient(135deg,#2563eb 0%,#7c3aed 100%)",
            }} />
          <div className="absolute inset-0 bg-black/15" />
          <button onClick={onBack}
            className="absolute top-3 left-3 w-9 h-9 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white z-10">
            <ArrowLeft size={18} />
          </button>
        </div>

        {/* Round profile pic — overlapping banner */}
        <div className="px-4">
          <div className="flex items-end justify-between -mt-10 mb-3 relative z-10">
            <div className="w-20 h-20 rounded-full border-4 border-white shadow-xl overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-black shrink-0">
              {livePage.avatar_url
                ? <img src={livePage.avatar_url} className="w-full h-full object-cover" alt="" />
                : livePage.name[0].toUpperCase()}
            </div>
            {/* Action buttons */}
            <div className="flex items-center gap-2 pb-1">
              {!isOwner && (
                <motion.button whileTap={{ scale: 0.93 }} onClick={toggleFollow}
                  className="px-4 py-2 rounded-xl text-[12px] font-black border-2 transition-all"
                  style={{
                    background: isFollowing ? "white" : "linear-gradient(135deg,#2563eb,#7c3aed)",
                    borderColor: isFollowing ? "#d1d5db" : "transparent",
                    color: isFollowing ? "#374151" : "white",
                  }}>
                  {isFollowing ? "✓ Following" : "+ Follow"}
                </motion.button>
              )}
              {isOwner && (
                <motion.button whileTap={{ scale: 0.93 }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black border-2 transition-all"
                  style={{
                    background: livePage.is_monetized ? "linear-gradient(135deg,#f59e0b,#d97706)" : "white",
                    borderColor: livePage.is_monetized ? "#f59e0b" : "#e5e7eb",
                    color: livePage.is_monetized ? "white" : "#f59e0b",
                  }}>
                  <DollarSign size={13} />
                  {livePage.is_monetized ? "Monetized" : "Monetize"}
                </motion.button>
              )}
              <motion.button whileTap={{ scale: 0.93 }} onClick={() => setShareModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-black bg-gray-100 text-gray-700 border border-gray-200">
                <Share2 size={14} /> Share
              </motion.button>
            </div>
          </div>

          {/* Name + description */}
          <h1 className="font-black text-gray-800 text-[18px] leading-tight">{livePage.name}</h1>
          <p className="text-[11px] text-blue-600 font-bold mt-0.5">{livePage.category}</p>
          {livePage.description && <p className="text-[13px] text-gray-500 font-medium leading-snug mt-1 mb-2">{livePage.description}</p>}

          {/* Stats Row */}
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
        {posts.map(post => (
          <motion.div key={post.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4">
              {post.content && <p className="text-[14px] text-gray-700 font-medium leading-relaxed mb-3">{post.content}</p>}
              {post.media_url && post.media_type === "image" && (
                <img src={post.media_url} className="w-full rounded-xl object-cover max-h-72" alt="" />
              )}
              {post.media_url && post.media_type === "video" && (
                <video src={post.media_url} className="w-full rounded-xl max-h-72" controls />
              )}
            </div>
            <div className="flex items-center gap-2 px-4 pb-3 pt-2 border-t border-gray-50">
              <motion.button whileTap={{ scale: 0.88 }} onClick={() => likePost(post.id, post.likes_count)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 text-red-500 text-[12px] font-black">
                <Heart size={14} fill="currentColor" /> {post.likes_count}
              </motion.button>
              <div className="flex-1" />
              <motion.button whileTap={{ scale: 0.92 }} onClick={() => setHookModal(true)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-white text-[12px] font-black"
                style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}>
                <Anchor size={13} /> Hook
              </motion.button>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {hookModal  && <HookModal pageId={page.id} pageName={livePage.name} userId={userId} onClose={() => { setHookModal(false); refreshPage(); }} />}
        {shareModal && <ShareModal page={livePage} onClose={() => setShareModal(false)} />}
        {addPost    && <AddPostModal pageId={page.id} userId={userId} onClose={() => setAddPost(false)} onPosted={() => { fetchPosts(); refreshPage(); }} />}
      </AnimatePresence>
    </div>
  );
};

// ── Main HooksHub ──────────────────────────────────────────────────────────────
const HooksHub = ({ userId }: { userId: string }) => {
  const [myPages, setMyPages]       = useState<HookPage[]>([]);
  const [suggested, setSuggested]   = useState<HookPage[]>([]);
  const [memberCounts, setMemberCounts]   = useState<Record<string, number>>({});
  const [followingPages, setFollowingPages] = useState<Record<string, boolean>>({});
  const [loading, setLoading]       = useState(true);
  const [activePage, setActivePage] = useState<HookPage | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchPages = useCallback(async () => {
    setLoading(true);
    const [{ data: mine }, { data: all }] = await Promise.all([
      supabase.from("hook_pages").select("*").eq("owner_id", userId).order("created_at", { ascending: false }),
      supabase.from("hook_pages").select("*").neq("owner_id", userId).order("hook_count", { ascending: false }).limit(12),
    ]);
    const pages = [...(mine || []), ...(all || [])];
    setMyPages(mine || []);
    setSuggested(all || []);

    if (pages.length) {
      const ids = pages.map(p => p.id);
      // Fetch real member counts + current user's follow status in parallel
      const [countsArr, { data: myFollows }] = await Promise.all([
        Promise.all(ids.map(async id => {
          const { count } = await supabase
            .from("hook_members")
            .select("id", { count: "exact", head: true })
            .eq("page_id", id);
          return { id, count: count || 0 };
        })),
        supabase.from("hook_members").select("page_id").eq("user_id", userId).in("page_id", ids),
      ]);
      const counts: Record<string, number> = {};
      countsArr.forEach(({ id, count }) => { counts[id] = count; });
      setMemberCounts(counts);

      const following: Record<string, boolean> = {};
      (myFollows || []).forEach(row => { following[row.page_id] = true; });
      setFollowingPages(following);
    }
    setLoading(false);
  }, [userId]);

  // Toggle follow directly from the card on the listing screen
  const toggleFollowOnCard = async (e: React.MouseEvent, pg: HookPage) => {
    e.stopPropagation();
    const already = !!followingPages[pg.id];
    // Optimistic update
    setFollowingPages(prev => ({ ...prev, [pg.id]: !already }));
    setMemberCounts(prev => ({ ...prev, [pg.id]: Math.max(0, (prev[pg.id] || 0) + (already ? -1 : 1)) }));
    if (already) {
      await supabase.from("hook_members").delete().eq("page_id", pg.id).eq("user_id", userId);
    } else {
      await supabase.from("hook_members").upsert([{ page_id: pg.id, user_id: userId }], { onConflict: "page_id,user_id" });
    }
    // Refresh real count from DB to confirm
    const { count } = await supabase
      .from("hook_members")
      .select("id", { count: "exact", head: true })
      .eq("page_id", pg.id);
    setMemberCounts(prev => ({ ...prev, [pg.id]: count || 0 }));
  };

  useEffect(() => {
    fetchPages();
    // Real-time: any member join/leave refreshes counts
    const ch = supabase.channel("hook-hub-members")
      .on("postgres_changes", { event: "*", schema: "public", table: "hook_members" }, () => fetchPages())
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
