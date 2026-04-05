import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import {
  Anchor, Plus, ArrowLeft, X, Users, Heart, FileText,
  TrendingUp, DollarSign, Send, CheckSquare, Square,
  Image as ImageIcon, Loader2, Star, ChevronRight, Zap,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface HookPage {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  category: string;
  cover_url: string;
  avatar_url: string;
  follower_count: number;
  hook_count: number;
  post_count: number;
  like_count: number;
  is_monetized: boolean;
  created_at: string;
}

interface PagePost {
  id: string;
  page_id: string;
  author_id: string;
  content: string;
  media_url: string;
  likes_count: number;
  created_at: string;
}

interface Friend {
  id: string;
  full_name: string;
  avatar_url: string;
}

const CATEGORIES = ["General", "Business", "Entertainment", "Education", "Sports", "Food", "Travel", "Tech", "Art", "Music"];

// ── Avatar helper ─────────────────────────────────────────────────────────────
const Avatar = ({ url, name, size = 40, rounded = "full" }: { url?: string; name?: string; size?: number; rounded?: string }) => (
  <div
    className={`shrink-0 overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-black`}
    style={{ width: size, height: size, borderRadius: rounded === "full" ? "50%" : 12 }}
  >
    {url
      ? <img src={url} className="w-full h-full object-cover" alt="" />
      : <span style={{ fontSize: size * 0.38 }}>{(name || "?")[0].toUpperCase()}</span>
    }
  </div>
);

// ── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) => (
  <div className="flex-1 flex flex-col items-center gap-1 p-3 rounded-2xl bg-white border border-gray-100 shadow-sm">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>{icon}</div>
    <p className="text-[20px] font-black text-gray-800 leading-tight">{value.toLocaleString()}</p>
    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
  </div>
);

// ── Hook Modal (Invite Friends) ───────────────────────────────────────────────
const HookModal = ({ pageId, pageName, userId, onClose }: { pageId: string; pageName: string; userId: string; onClose: () => void }) => {
  const [friends, setFriends]       = useState<Friend[]>([]);
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [loading, setLoading]       = useState(true);
  const [sending, setSending]       = useState(false);
  const [sentIds, setSentIds]       = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .neq("id", userId)
        .limit(40);
      setFriends(data || []);
      setLoading(false);
    })();
  }, [userId]);

  const toggleAll = () => {
    if (selected.size === friends.length) setSelected(new Set());
    else setSelected(new Set(friends.map(f => f.id)));
  };

  const toggle = (id: string) => {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const sendHooks = async () => {
    if (selected.size === 0) return;
    setSending(true);
    const rows = Array.from(selected).map(invitee_id => ({
      page_id: pageId, inviter_id: userId, invitee_id, status: "pending",
    }));
    await supabase.from("hook_invites").upsert(rows, { onConflict: "page_id,invitee_id" });
    await supabase.from("hook_pages").update({ hook_count: selected.size }).eq("id", pageId);
    setSentIds(new Set(selected));
    setSelected(new Set());
    setSending(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[500] flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 26, stiffness: 260 }}
        className="w-full max-w-lg bg-white rounded-t-3xl overflow-hidden shadow-2xl"
        style={{ maxHeight: "82vh", display: "flex", flexDirection: "column" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2">
              <Anchor size={18} className="text-blue-600" />
              <h2 className="font-black text-gray-800 text-[16px]">Hook Friends</h2>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">Invite karo — <span className="font-bold text-blue-600">{pageName}</span></p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X size={20} /></button>
        </div>

        {/* Select All */}
        <div className="px-5 py-2.5 border-b border-gray-50 flex items-center justify-between">
          <p className="text-[12px] font-bold text-gray-500">{friends.length} Friends</p>
          <button onClick={toggleAll} className="flex items-center gap-1.5 text-[12px] font-black text-blue-600">
            {selected.size === friends.length ? <CheckSquare size={14} /> : <Square size={14} />}
            Select All
          </button>
        </div>

        {/* Friends list */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-blue-500" />
            </div>
          )}
          {!loading && friends.map(f => {
            const isSent = sentIds.has(f.id);
            const isSel  = selected.has(f.id);
            return (
              <motion.div
                key={f.id} whileTap={{ scale: 0.98 }}
                onClick={() => !isSent && toggle(f.id)}
                className={`flex items-center gap-3 px-5 py-3 border-b border-gray-50 transition-colors cursor-pointer ${isSel ? "bg-blue-50" : "hover:bg-gray-50"} ${isSent ? "opacity-60 cursor-default" : ""}`}
              >
                <Avatar url={f.avatar_url} name={f.full_name} size={44} />
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

        {/* Send button */}
        <div className="p-4 border-t border-gray-100">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={sendHooks}
            disabled={selected.size === 0 || sending}
            className="w-full py-3.5 rounded-2xl font-black text-[14px] flex items-center justify-center gap-2 transition-all"
            style={{
              background: selected.size > 0
                ? "linear-gradient(135deg,#2563eb,#1d4ed8)"
                : "#e5e7eb",
              color: selected.size > 0 ? "#fff" : "#9ca3af",
            }}
          >
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Anchor size={18} />}
            {sending ? "Bhej raha hoon..." : `Hook Bhejo (${selected.size})`}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Create Page Modal ─────────────────────────────────────────────────────────
const CreatePageModal = ({ userId, onClose, onCreated }: { userId: string; onClose: () => void; onCreated: (p: HookPage) => void }) => {
  const [form, setForm]   = useState({ name: "", description: "", category: "General" });
  const [saving, setSaving] = useState(false);
  const [err, setErr]     = useState("");

  const create = async () => {
    if (!form.name.trim()) { setErr("Page ka naam zaroori hai"); return; }
    setSaving(true);
    const { data, error } = await supabase
      .from("hook_pages")
      .insert([{ owner_id: userId, name: form.name.trim(), description: form.description.trim(), category: form.category }])
      .select()
      .single();
    setSaving(false);
    if (error) { setErr("Page nahi ban saka. SQL tables setup karein."); return; }
    onCreated(data as HookPage);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[500] flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 26, stiffness: 260 }}
        className="w-full max-w-lg bg-white rounded-t-3xl overflow-hidden shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 className="font-black text-gray-800 text-[16px]">Naya Hook Page</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[11px] font-black text-gray-500 uppercase tracking-wide mb-1 block">Page ka Naam *</label>
            <input
              value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Jaise: My Cooking Page"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[14px] font-semibold text-gray-800 outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div>
            <label className="text-[11px] font-black text-gray-500 uppercase tracking-wide mb-1 block">Description</label>
            <textarea
              value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Page kiske baare mein hai..."
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[14px] font-semibold text-gray-800 outline-none focus:border-blue-500 resize-none transition-colors"
            />
          </div>
          <div>
            <label className="text-[11px] font-black text-gray-500 uppercase tracking-wide mb-1 block">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(c => (
                <button
                  key={c} onClick={() => setForm(p => ({ ...p, category: c }))}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-black border transition-all ${form.category === c ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-500 border-gray-200"}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          {err && <p className="text-red-500 text-[12px] font-bold">{err}</p>}
          <motion.button
            whileTap={{ scale: 0.97 }} onClick={create} disabled={saving}
            className="w-full py-3.5 rounded-2xl font-black text-[14px] text-white flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg,#2563eb,#1d4ed8)" }}
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            {saving ? "Ban raha hai..." : "Page Banao"}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Add Post Modal ────────────────────────────────────────────────────────────
const AddPostModal = ({ pageId, userId, onClose, onPosted }: { pageId: string; userId: string; onClose: () => void; onPosted: () => void }) => {
  const [content, setContent] = useState("");
  const [saving, setSaving]   = useState(false);

  const post = async () => {
    if (!content.trim()) return;
    setSaving(true);
    await supabase.from("hook_page_posts").insert([{ page_id: pageId, author_id: userId, content: content.trim() }]);
    await supabase.rpc !== undefined &&
      supabase.from("hook_pages").select("post_count").eq("id", pageId).single().then(({ data }) => {
        if (data) supabase.from("hook_pages").update({ post_count: (data.post_count || 0) + 1 }).eq("id", pageId);
      });
    setSaving(false);
    onPosted();
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[500] flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 26, stiffness: 260 }}
        className="w-full max-w-lg bg-white rounded-t-3xl overflow-hidden shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 className="font-black text-gray-800 text-[16px]">Page Post</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <textarea
            value={content} onChange={e => setContent(e.target.value)}
            placeholder="Page par kya share karna hai..."
            rows={4} autoFocus
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[14px] font-semibold text-gray-800 outline-none focus:border-blue-500 resize-none"
          />
          <motion.button
            whileTap={{ scale: 0.97 }} onClick={post} disabled={saving || !content.trim()}
            className="w-full py-3.5 rounded-2xl font-black text-[14px] text-white flex items-center justify-center gap-2"
            style={{ background: content.trim() ? "linear-gradient(135deg,#2563eb,#1d4ed8)" : "#e5e7eb", color: content.trim() ? "#fff" : "#9ca3af" }}
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            {saving ? "Post ho raha hai..." : "Post Karo"}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Page Dashboard ────────────────────────────────────────────────────────────
const PageDashboard = ({ page, userId, onBack, onPageUpdated }: { page: HookPage; userId: string; onBack: () => void; onPageUpdated: (p: HookPage) => void }) => {
  const [posts, setPosts]         = useState<PagePost[]>([]);
  const [loading, setLoading]     = useState(true);
  const [hookModal, setHookModal] = useState<string | null>(null);
  const [addPost, setAddPost]     = useState(false);
  const [livePage, setLivePage]   = useState<HookPage>(page);

  const fetchPosts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("hook_page_posts")
      .select("*")
      .eq("page_id", page.id)
      .order("created_at", { ascending: false });
    setPosts(data || []);
    setLoading(false);
  };

  const refreshPage = async () => {
    const { data } = await supabase.from("hook_pages").select("*").eq("id", page.id).single();
    if (data) { setLivePage(data as HookPage); onPageUpdated(data as HookPage); }
  };

  useEffect(() => { fetchPosts(); }, [page.id]);

  const likePost = async (postId: string, currentLikes: number) => {
    await supabase.from("hook_page_posts").update({ likes_count: currentLikes + 1 }).eq("id", postId);
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes_count: currentLikes + 1 } : p));
    await supabase.from("hook_pages").update({ like_count: (livePage.like_count || 0) + 1 }).eq("id", page.id);
    setLivePage(prev => ({ ...prev, like_count: (prev.like_count || 0) + 1 }));
  };

  const isOwner = page.owner_id === userId;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Cover + Header */}
      <div className="relative">
        <div
          className="h-32 w-full"
          style={{
            background: livePage.cover_url
              ? `url(${livePage.cover_url}) center/cover`
              : "linear-gradient(135deg,#2563eb 0%,#7c3aed 100%)",
          }}
        />
        <button
          onClick={onBack}
          className="absolute top-3 left-3 w-9 h-9 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="px-4 pb-4 bg-white border-b border-gray-100">
          <div className="flex items-end gap-3 -mt-8 mb-3">
            <div className="w-16 h-16 rounded-2xl border-4 border-white shadow-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-black">
              {livePage.avatar_url
                ? <img src={livePage.avatar_url} className="w-full h-full object-cover rounded-xl" alt="" />
                : livePage.name[0].toUpperCase()
              }
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <h1 className="font-black text-gray-800 text-[17px] leading-tight truncate">{livePage.name}</h1>
              <p className="text-[11px] text-blue-600 font-bold">{livePage.category}</p>
            </div>
            {isOwner && (
              <motion.button
                whileTap={{ scale: 0.94 }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black border-2"
                style={{
                  background: livePage.is_monetized ? "linear-gradient(135deg,#f59e0b,#d97706)" : "white",
                  borderColor: livePage.is_monetized ? "#f59e0b" : "#e5e7eb",
                  color: livePage.is_monetized ? "white" : "#f59e0b",
                }}
              >
                <DollarSign size={13} />
                {livePage.is_monetized ? "Monetized" : "Monetize"}
              </motion.button>
            )}
          </div>
          {livePage.description && (
            <p className="text-[12px] text-gray-500 font-medium mb-3 leading-snug">{livePage.description}</p>
          )}
          {/* Stats Row */}
          <div className="flex gap-2">
            <StatCard icon={<Anchor size={18} className="text-blue-600" />} label="Hooks" value={livePage.hook_count || 0} color="bg-blue-50" />
            <StatCard icon={<FileText size={18} className="text-purple-600" />} label="Posts" value={livePage.post_count || 0} color="bg-purple-50" />
            <StatCard icon={<Heart size={18} className="text-red-500" />} label="Likes" value={livePage.like_count || 0} color="bg-red-50" />
          </div>
        </div>
      </div>

      {/* Add Post bar (owner only) */}
      {isOwner && (
        <div className="px-4 py-3 bg-white border-b border-gray-100">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setAddPost(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-gray-200 bg-gray-50 text-gray-400 text-[13px] font-semibold"
          >
            <ImageIcon size={16} />
            Page par kuch share karo...
          </motion.button>
        </div>
      )}

      {/* Posts */}
      <div className="flex-1 p-4 space-y-3">
        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 size={24} className="animate-spin text-blue-500" />
          </div>
        )}
        {!loading && posts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-300">
            <FileText size={40} strokeWidth={1.2} />
            <p className="text-[12px] font-black uppercase tracking-widest">Abhi koi post nahi</p>
          </div>
        )}
        {posts.map(post => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
          >
            <div className="p-4">
              <p className="text-[14px] text-gray-700 font-medium leading-relaxed">{post.content}</p>
              {post.media_url && (
                <img src={post.media_url} className="mt-3 w-full rounded-xl object-cover max-h-64" alt="" />
              )}
            </div>
            <div className="flex items-center gap-2 px-4 pb-3 border-t border-gray-50 pt-3">
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => likePost(post.id, post.likes_count)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 text-red-500 text-[12px] font-black"
              >
                <Heart size={14} fill="currentColor" /> {post.likes_count}
              </motion.button>
              <div className="flex-1" />
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => setHookModal(post.id)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-white text-[12px] font-black"
                style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}
              >
                <Anchor size={13} />
                Hook
              </motion.button>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {hookModal && (
          <HookModal
            pageId={page.id}
            pageName={livePage.name}
            userId={userId}
            onClose={() => { setHookModal(null); refreshPage(); }}
          />
        )}
        {addPost && (
          <AddPostModal
            pageId={page.id}
            userId={userId}
            onClose={() => setAddPost(false)}
            onPosted={() => { fetchPosts(); refreshPage(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Main HooksHub ─────────────────────────────────────────────────────────────
const HooksHub = ({ userId }: { userId: string }) => {
  const [myPages, setMyPages]           = useState<HookPage[]>([]);
  const [suggested, setSuggested]       = useState<HookPage[]>([]);
  const [loading, setLoading]           = useState(true);
  const [activePage, setActivePage]     = useState<HookPage | null>(null);
  const [showCreate, setShowCreate]     = useState(false);

  const fetchPages = async () => {
    setLoading(true);
    const [{ data: mine }, { data: all }] = await Promise.all([
      supabase.from("hook_pages").select("*").eq("owner_id", userId).order("created_at", { ascending: false }),
      supabase.from("hook_pages").select("*").neq("owner_id", userId).order("hook_count", { ascending: false }).limit(12),
    ]);
    setMyPages(mine || []);
    setSuggested(all || []);
    setLoading(false);
  };

  useEffect(() => { fetchPages(); }, [userId]);

  if (activePage) {
    return (
      <PageDashboard
        page={activePage}
        userId={userId}
        onBack={() => { setActivePage(null); fetchPages(); }}
        onPageUpdated={updated => setActivePage(updated)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Hero */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-md">
              <Anchor size={18} className="text-white" />
            </div>
            <div>
              <h1 className="font-black text-gray-800 text-[18px] leading-tight">Hooks</h1>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Viral karo apna page</p>
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-white text-[12px] font-black shadow-lg"
            style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}
          >
            <Plus size={15} />
            Page Banao
          </motion.button>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-blue-500" />
        </div>
      )}

      {!loading && (
        <>
          {/* My Pages */}
          {myPages.length > 0 && (
            <section className="mb-2">
              <div className="flex items-center gap-2 px-4 mb-3">
                <Star size={13} className="text-amber-500 fill-amber-500" />
                <h2 className="font-black text-gray-700 text-[12px] uppercase tracking-widest">Mere Pages</h2>
              </div>
              <div className="space-y-2 px-4">
                {myPages.map(pg => (
                  <motion.div
                    key={pg.id} whileTap={{ scale: 0.98 }}
                    onClick={() => setActivePage(pg)}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3 p-3 cursor-pointer"
                  >
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-xl font-black shrink-0"
                      style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}
                    >
                      {pg.avatar_url
                        ? <img src={pg.avatar_url} className="w-full h-full object-cover rounded-xl" alt="" />
                        : pg.name[0].toUpperCase()
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-gray-800 text-[14px] truncate">{pg.name}</p>
                      <p className="text-[11px] text-blue-600 font-bold">{pg.category}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-gray-400 font-bold flex items-center gap-0.5"><Anchor size={9} /> {pg.hook_count}</span>
                        <span className="text-[10px] text-gray-400 font-bold flex items-center gap-0.5"><FileText size={9} /> {pg.post_count}</span>
                        <span className="text-[10px] text-gray-400 font-bold flex items-center gap-0.5"><Heart size={9} /> {pg.like_count}</span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 shrink-0" />
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* No pages yet */}
          {myPages.length === 0 && (
            <div className="mx-4 mb-4 p-5 bg-white rounded-2xl border border-dashed border-blue-200 flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
                <Anchor size={26} className="text-blue-400" />
              </div>
              <div className="text-center">
                <p className="font-black text-gray-700 text-[14px]">Apna pehla Page banao!</p>
                <p className="text-[12px] text-gray-400 mt-1">Hook ke zariye friends ko invite karo aur viral ho jao.</p>
              </div>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => setShowCreate(true)}
                className="px-5 py-2.5 rounded-xl text-white text-[13px] font-black"
                style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}
              >
                Create Page
              </motion.button>
            </div>
          )}

          {/* Suggested Pages */}
          {suggested.length > 0 && (
            <section>
              <div className="flex items-center gap-2 px-4 mb-3">
                <Zap size={13} className="text-purple-500 fill-purple-500" />
                <h2 className="font-black text-gray-700 text-[12px] uppercase tracking-widest">Suggested Pages</h2>
              </div>
              <div className="px-4 space-y-2">
                {suggested.map(pg => (
                  <motion.div
                    key={pg.id} whileTap={{ scale: 0.98 }}
                    onClick={() => setActivePage(pg)}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3 p-3 cursor-pointer"
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-black shrink-0"
                      style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }}
                    >
                      {pg.avatar_url
                        ? <img src={pg.avatar_url} className="w-full h-full object-cover rounded-xl" alt="" />
                        : pg.name[0].toUpperCase()
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-gray-800 text-[13px] truncate">{pg.name}</p>
                      <p className="text-[10px] text-purple-500 font-bold">{pg.category}</p>
                      <p className="text-[10px] text-gray-400 font-semibold mt-0.5">{pg.hook_count} Hooks · {pg.post_count} Posts</p>
                    </div>
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-50 text-blue-600 text-[10px] font-black">
                        <TrendingUp size={10} /> Follow
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {suggested.length === 0 && myPages.length > 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-gray-300">
              <Users size={36} strokeWidth={1.2} />
              <p className="text-[11px] font-black uppercase tracking-widest mt-2">Doosre pages abhi nahi hain</p>
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {showCreate && (
          <CreatePageModal
            userId={userId}
            onClose={() => setShowCreate(false)}
            onCreated={pg => { setShowCreate(false); setMyPages(prev => [pg, ...prev]); setActivePage(pg); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default HooksHub;
