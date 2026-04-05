import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { useProfileViewer } from "../context/ProfileViewerContext";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Plus, Users, Lock, Globe, ChevronLeft, Settings, Send,
  Heart, Camera, Shield, X, Check, ImageIcon, Loader2, Trash2,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Group {
  id: string;
  name: string;
  description: string | null;
  privacy: "public" | "private";
  cover_url: string | null;
  rules: string | null;
  post_approval: boolean;
  created_by: string | null;
  admin_id?: string | null;
  member_count?: number;
}

interface GroupPost {
  id: string;
  group_id: string;
  author_id: string;
  author_name: string;
  author_avatar?: string | null;
  content: string;
  media_url?: string | null;
  created_at: string;
  likes_count: number;
}

const COVER_GRADS = [
  "linear-gradient(135deg,#6366f1,#1e1b4b)",
  "linear-gradient(135deg,#ec4899,#7c3aed)",
  "linear-gradient(135deg,#f59e0b,#ef4444)",
  "linear-gradient(135deg,#10b981,#059669)",
  "linear-gradient(135deg,#3b82f6,#1d4ed8)",
  "linear-gradient(135deg,#8b5cf6,#6d28d9)",
];

function gradFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h) ^ id.charCodeAt(i);
  return COVER_GRADS[Math.abs(h) % COVER_GRADS.length];
}

// ── Group Card ─────────────────────────────────────────────────────────────────
const GroupCard = ({
  group, isMember, onJoin, onClick,
}: {
  group: Group; isMember: boolean; onJoin: () => void; onClick: () => void;
}) => (
  <div
    className="bg-white rounded-xl overflow-hidden flex flex-col"
    style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}
  >
    <div
      className="w-full aspect-square cursor-pointer"
      style={{ background: group.cover_url ? undefined : gradFor(group.id) }}
      onClick={onClick}
    >
      {group.cover_url && (
        <img src={group.cover_url} className="w-full h-full object-cover" loading="lazy" alt={group.name} />
      )}
    </div>
    <div className="p-2 flex flex-col gap-1.5">
      <p className="text-[12px] font-black text-gray-900 truncate leading-tight">{group.name}</p>
      <div className="flex items-center gap-1 text-gray-400">
        {group.privacy === "private" ? <Lock size={9} /> : <Globe size={9} />}
        <span className="text-[9px] font-semibold">{group.member_count ?? 0} members</span>
      </div>
      <button
        onClick={isMember ? onClick : onJoin}
        className={`w-full py-1.5 rounded-lg text-[10px] font-black transition-all active:scale-95 ${
          isMember
            ? "bg-blue-50 text-blue-600 border border-blue-200"
            : "bg-blue-600 text-white"
        }`}
      >
        {isMember ? "View" : "Join"}
      </button>
    </div>
  </div>
);

// ── Main Component ─────────────────────────────────────────────────────────────
interface Props {
  userProfile: any;
  currentUserId: string | null;
}

export default function CirclePage({ userProfile, currentUserId }: Props) {
  const { openProfile } = useProfileViewer();
  const [view, setView] = useState<"dashboard" | "group">("dashboard");
  const [groups, setGroups] = useState<Group[]>([]);
  const [myGroupIds, setMyGroupIds] = useState<Set<string>>(new Set());
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [groupPosts, setGroupPosts] = useState<GroupPost[]>([]);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Create group form
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", privacy: "public" as "public" | "private" });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Group settings (admin)
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ rules: "", post_approval: false });
  const [savingSettings, setSavingSettings] = useState(false);

  // Post in group
  const [postText, setPostText] = useState("");
  const [postMedia, setPostMedia] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());

  const coverInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch all groups ─────────────────────────────────────────────────────────
  const fetchGroups = async () => {
    const { data } = await supabase
      .from("groups")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setGroups(data as Group[]);
    setLoading(false);
  };

  const fetchMyMemberships = async () => {
    if (!currentUserId) return;
    const { data } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", currentUserId);
    if (data) setMyGroupIds(new Set(data.map((r: any) => r.group_id)));
  };

  useEffect(() => {
    fetchGroups();
    fetchMyMemberships();
  }, [currentUserId]);

  // ── Create Group ─────────────────────────────────────────────────────────────
  const handleCreateGroup = async () => {
    if (!form.name.trim()) return;

    // Authentication check
    if (!currentUserId) {
      toast.error("Please log in to create a Circle.");
      return;
    }

    setCreating(true);
    try {
      let cover_url: string | null = null;
      if (coverFile) {
        const ext = coverFile.name.split(".").pop();
        const path = `group-covers/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("avatars").upload(path, coverFile, { upsert: true });
        if (!upErr) {
          const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
          cover_url = pub.publicUrl;
        }
      }

      const { data: newGroup, error } = await supabase
        .from("groups")
        .insert([{
          name: form.name.trim(),
          description: form.description.trim() || null,
          privacy: form.privacy,
          cover_url,
          created_by: currentUserId,
          admin_id: currentUserId,
        }])
        .select()
        .single();

      if (error) {
        toast.error(`Failed to create Circle: ${error.message}`);
        return;
      }

      if (newGroup) {
        // Add creator as admin member
        await supabase.from("group_members").insert([{
          group_id: newGroup.id,
          user_id: currentUserId,
          role: "admin",
        }]);

        // Sync display immediately — add to state without page refresh
        const createdGroup: Group = { ...newGroup, member_count: 1 };
        setGroups(prev => [createdGroup, ...prev]);
        setMyGroupIds(prev => new Set([...prev, newGroup.id]));

        // Reset form & close modal
        setForm({ name: "", description: "", privacy: "public" });
        setCoverFile(null);
        setCoverPreview(null);
        setShowCreate(false);

        toast.success("Circle created successfully!");
      }
    } catch (err: any) {
      toast.error(err?.message || "Something went wrong. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  // ── Join Group ───────────────────────────────────────────────────────────────
  const handleJoin = async (groupId: string) => {
    if (!currentUserId) return;
    await supabase.from("group_members").insert([{ group_id: groupId, user_id: currentUserId, role: "member" }]);
    await supabase.from("groups").update({ member_count: (groups.find(g => g.id === groupId)?.member_count ?? 0) + 1 }).eq("id", groupId);
    setMyGroupIds(prev => new Set([...prev, groupId]));
    fetchGroups();
  };

  // ── Open Group Profile ───────────────────────────────────────────────────────
  const openGroup = async (group: Group) => {
    setSelectedGroup(group);
    setView("group");

    // Fetch posts
    const { data: posts } = await supabase
      .from("group_posts")
      .select("*")
      .eq("group_id", group.id)
      .order("created_at", { ascending: false });
    setGroupPosts((posts as GroupPost[]) ?? []);

    // Fetch members
    const { data: members } = await supabase
      .from("group_members")
      .select("*, profiles(full_name, avatar_url)")
      .eq("group_id", group.id)
      .limit(20);
    setGroupMembers(members ?? []);

    // Check if current user is admin
    const adminRow = (members ?? []).find((m: any) => m.user_id === currentUserId && m.role === "admin");
    setIsAdmin(!!adminRow);

    setSettingsForm({ rules: group.rules ?? "", post_approval: group.post_approval ?? false });
  };

  // ── Post in Group ────────────────────────────────────────────────────────────
  const handleGroupPost = async () => {
    if (!postText.trim() || !currentUserId || !selectedGroup) return;
    setPosting(true);
    try {
      let media_url: string | null = null;
      if (postMedia) {
        const ext = postMedia.name.split(".").pop();
        const path = `group-posts/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("avatars").upload(path, postMedia, { upsert: true });
        if (!upErr) {
          const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
          media_url = pub.publicUrl;
        }
      }

      await supabase.from("group_posts").insert([{
        group_id: selectedGroup.id,
        author_id: currentUserId,
        author_name: userProfile?.full_name || "Member",
        author_avatar: userProfile?.avatar_url || null,
        content: postText.trim(),
        media_url,
        likes_count: 0,
      }]);
      setPostText("");
      setPostMedia(null);
      // Refresh posts
      const { data: posts } = await supabase
        .from("group_posts")
        .select("*")
        .eq("group_id", selectedGroup.id)
        .order("created_at", { ascending: false });
      setGroupPosts((posts as GroupPost[]) ?? []);
    } finally {
      setPosting(false);
    }
  };

  // ── Like Post ─────────────────────────────────────────────────────────────────
  const handleLikePost = async (post: GroupPost) => {
    if (likedPostIds.has(post.id)) return;
    setLikedPostIds(p => new Set([...p, post.id]));
    await supabase.from("group_posts").update({ likes_count: (post.likes_count || 0) + 1 }).eq("id", post.id);
    setGroupPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes_count: p.likes_count + 1 } : p));
  };

  // ── Save Settings ─────────────────────────────────────────────────────────────
  const saveSettings = async () => {
    if (!selectedGroup) return;
    setSavingSettings(true);
    await supabase.from("groups").update({ rules: settingsForm.rules, post_approval: settingsForm.post_approval }).eq("id", selectedGroup.id);
    setSelectedGroup(prev => prev ? { ...prev, rules: settingsForm.rules, post_approval: settingsForm.post_approval } : prev);
    setSavingSettings(false);
    setShowSettings(false);
  };

  const myGroups = groups.filter(g => myGroupIds.has(g.id));
  const suggestedGroups = groups.filter(g => !myGroupIds.has(g.id));

  // ═══════════════════════════ RENDER ═══════════════════════════════════════════

  // ── GROUP PROFILE VIEW ────────────────────────────────────────────────────────
  if (view === "group" && selectedGroup) {
    const isMember = myGroupIds.has(selectedGroup.id);
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Cover + Back */}
        <div className="relative w-full" style={{ height: 200, background: selectedGroup.cover_url ? undefined : gradFor(selectedGroup.id) }}>
          {selectedGroup.cover_url && (
            <img src={selectedGroup.cover_url} className="w-full h-full object-cover" alt={selectedGroup.name} />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/60" />
          <button
            onClick={() => { setView("dashboard"); setSelectedGroup(null); }}
            className="absolute top-4 left-4 w-9 h-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/20"
          >
            <ChevronLeft size={20} className="text-white" />
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowSettings(true)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/20"
            >
              <Settings size={18} className="text-white" />
            </button>
          )}
          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-white font-black text-xl drop-shadow-lg">{selectedGroup.name}</h2>
              {isAdmin && (
                <span className="bg-yellow-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full">ADMIN</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selectedGroup.privacy === "private" ? <Lock size={11} className="text-white/80" /> : <Globe size={11} className="text-white/80" />}
              <span className="text-white/80 text-[11px] font-semibold">{selectedGroup.privacy} · {selectedGroup.member_count ?? 0} members</span>
            </div>
          </div>
        </div>

        {/* About / Description */}
        {(selectedGroup.description || selectedGroup.rules) && (
          <div className="bg-white border-b border-gray-100 px-4 py-3">
            {selectedGroup.description && (
              <p className="text-[13px] text-gray-700 mb-2">{selectedGroup.description}</p>
            )}
            {selectedGroup.rules && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Shield size={13} className="text-amber-600" />
                  <span className="text-[11px] font-black text-amber-700 uppercase tracking-wide">Group Rules</span>
                </div>
                <p className="text-[12px] text-amber-800 whitespace-pre-wrap">{selectedGroup.rules}</p>
              </div>
            )}
          </div>
        )}

        {/* Members row */}
        {groupMembers.length > 0 && (
          <div className="bg-white border-b border-gray-100 px-4 py-3">
            <p className="text-[11px] font-black text-gray-500 uppercase tracking-wide mb-2">Members · {groupMembers.length}</p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {groupMembers.map((m: any) => (
                <div key={m.id} className="flex-shrink-0 flex flex-col items-center gap-1">
                  <div
                    className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-sm overflow-hidden border-2 border-white shadow-sm cursor-pointer"
                    style={{ boxShadow: m.role === "admin" ? "0 0 0 2px #f59e0b" : undefined }}
                    onClick={() => m.user_id && openProfile(m.user_id)}
                  >
                    {m.profiles?.avatar_url ? (
                      <img src={m.profiles.avatar_url} className="w-full h-full object-cover" alt="" />
                    ) : (
                      (m.profiles?.full_name || "M")[0].toUpperCase()
                    )}
                  </div>
                  {m.role === "admin" && (
                    <span className="text-[8px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">Admin</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Post box — only for members */}
        {isMember && (
          <div className="bg-white border-b border-gray-100 px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-sm shrink-0 overflow-hidden">
                {userProfile?.avatar_url ? (
                  <img src={userProfile.avatar_url} className="w-full h-full object-cover" alt="" />
                ) : (
                  (userProfile?.full_name || "U")[0]
                )}
              </div>
              <div className="flex-1">
                <textarea
                  value={postText}
                  onChange={e => setPostText(e.target.value)}
                  placeholder="Post something in this Circle…"
                  className="w-full bg-gray-100 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-none resize-none focus:ring-2 focus:ring-blue-400/30 border border-gray-200"
                  rows={2}
                />
                {postMedia && (
                  <div className="relative mt-2 w-20 h-20 rounded-lg overflow-hidden">
                    <img src={URL.createObjectURL(postMedia)} className="w-full h-full object-cover" alt="" />
                    <button onClick={() => setPostMedia(null)} className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5">
                      <X size={10} className="text-white" />
                    </button>
                  </div>
                )}
                <div className="flex items-center justify-between mt-2">
                  <button onClick={() => mediaInputRef.current?.click()} className="p-1.5 rounded-lg bg-gray-100 text-gray-500">
                    <ImageIcon size={16} />
                  </button>
                  <input ref={mediaInputRef} type="file" accept="image/*,video/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) setPostMedia(f); e.target.value = ""; }} />
                  <button
                    onClick={handleGroupPost}
                    disabled={!postText.trim() || posting}
                    className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-1.5 rounded-xl text-sm font-bold disabled:opacity-40 active:scale-95 transition-transform"
                  >
                    {posting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Post
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Group Posts */}
        <div className="space-y-0">
          {groupPosts.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-gray-300">
              <Users size={32} className="mb-3 opacity-40" />
              <p className="text-xs font-black uppercase tracking-widest">No posts yet</p>
              {isMember && <p className="text-[11px] text-gray-400 mt-1">Be the first to post!</p>}
            </div>
          ) : (
            groupPosts.map(post => (
              <div key={post.id} className="bg-white border-b border-gray-100">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-sm shrink-0 overflow-hidden border border-gray-100">
                    {post.author_avatar ? (
                      <img src={post.author_avatar} className="w-full h-full object-cover" alt="" />
                    ) : (
                      (post.author_name || "M")[0].toUpperCase()
                    )}
                  </div>
                  <div>
                    <p className="text-gray-900 font-bold text-sm leading-none">{post.author_name}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{new Date(post.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                {post.content && <p className="px-4 pb-2 text-[13px] text-gray-800 leading-snug">{post.content}</p>}
                {post.media_url && (
                  <div className="w-full bg-gray-100">
                    <img src={post.media_url} className="w-full object-cover" style={{ maxHeight: "60vh" }} loading="lazy" alt="" />
                  </div>
                )}
                <div className="flex items-center gap-4 px-4 py-2.5">
                  <button onClick={() => handleLikePost(post)} className="flex items-center gap-1.5">
                    <Heart size={20}
                      className={likedPostIds.has(post.id) ? "fill-red-500 text-red-500" : "text-gray-400"} />
                    <span className="text-xs font-bold text-gray-500">{post.likes_count || 0}</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Not a member CTA */}
        {!isMember && (
          <div className="fixed bottom-24 left-0 right-0 flex justify-center px-4 z-50">
            <button
              onClick={() => { handleJoin(selectedGroup.id); setMyGroupIds(prev => new Set([...prev, selectedGroup.id])); }}
              className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-transform"
            >
              Join this Circle
            </button>
          </div>
        )}

        {/* Admin Settings Modal */}
        <AnimatePresence>
          {showSettings && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[300] flex items-end justify-center bg-black/40 backdrop-blur-sm"
              onClick={() => setShowSettings(false)}>
              <motion.div
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
                className="w-full max-w-lg bg-white rounded-t-3xl p-6 pb-10"
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-gray-900 font-black text-lg flex items-center gap-2">
                    <Settings size={18} className="text-blue-600" /> Group Settings
                  </h3>
                  <button onClick={() => setShowSettings(false)} className="p-1.5 rounded-full bg-gray-100">
                    <X size={18} className="text-gray-500" />
                  </button>
                </div>
                <label className="block text-[11px] font-black text-gray-500 uppercase tracking-wide mb-1.5">Group Rules</label>
                <textarea
                  value={settingsForm.rules}
                  onChange={e => setSettingsForm(p => ({ ...p, rules: e.target.value }))}
                  placeholder="Write group rules here…"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-none resize-none mb-4 focus:ring-2 focus:ring-blue-400/30"
                  rows={4}
                />
                <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 mb-6 border border-gray-200">
                  <div>
                    <p className="text-sm font-bold text-gray-900">Post Approval</p>
                    <p className="text-[11px] text-gray-500">Review posts before they go live</p>
                  </div>
                  <button
                    onClick={() => setSettingsForm(p => ({ ...p, post_approval: !p.post_approval }))}
                    className={`w-12 h-6 rounded-full transition-colors relative ${settingsForm.post_approval ? "bg-blue-600" : "bg-gray-300"}`}>
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow-sm ${settingsForm.post_approval ? "left-6" : "left-0.5"}`} />
                  </button>
                </div>
                <button
                  onClick={saveSettings}
                  disabled={savingSettings}
                  className="w-full py-4 rounded-2xl bg-blue-600 text-white font-black text-sm disabled:opacity-40 active:scale-[0.98] transition-transform">
                  {savingSettings ? "Saving…" : "Save Settings"}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── DASHBOARD VIEW ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-black text-gray-900">Your Circles</h1>
          <p className="text-[11px] text-gray-400 font-medium">Groups & communities you love</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-black active:scale-95 transition-transform"
        >
          <Plus size={16} strokeWidth={2.5} />
          Create
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center py-20">
          <Loader2 className="animate-spin text-blue-500 mb-3" size={26} />
          <p className="text-gray-400 text-[11px] font-black uppercase tracking-widest">Loading Circles</p>
        </div>
      ) : (
        <>
          {/* My Circles */}
          {myGroups.length > 0 && (
            <div className="bg-white border-b border-gray-100 py-4">
              <p className="text-[12px] font-black text-gray-700 px-4 mb-3">My Circles</p>
              <div className="flex gap-4 overflow-x-auto px-4 no-scrollbar pb-1">
                {myGroups.map(g => (
                  <button
                    key={g.id}
                    onClick={() => openGroup(g)}
                    className="flex-shrink-0 flex flex-col items-center gap-1.5"
                  >
                    <div
                      className="w-14 h-14 rounded-full overflow-hidden border-2 border-blue-500 shadow-sm"
                      style={{ background: g.cover_url ? undefined : gradFor(g.id) }}
                    >
                      {g.cover_url && <img src={g.cover_url} className="w-full h-full object-cover" alt={g.name} />}
                    </div>
                    <span className="text-[10px] font-bold text-gray-700 max-w-[56px] text-center truncate leading-tight">{g.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Suggested Groups */}
          <div className="px-3 py-4">
            <p className="text-[12px] font-black text-gray-700 mb-3 px-1">
              {suggestedGroups.length > 0 ? "Suggested Circles" : myGroups.length === 0 ? "No circles yet" : "You've joined all circles!"}
            </p>
            {suggestedGroups.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {suggestedGroups.map(g => (
                  <GroupCard
                    key={g.id}
                    group={g}
                    isMember={myGroupIds.has(g.id)}
                    onJoin={() => handleJoin(g.id)}
                    onClick={() => openGroup(g)}
                  />
                ))}
              </div>
            )}
            {suggestedGroups.length === 0 && groups.length === 0 && (
              <div className="flex flex-col items-center py-12 text-gray-300">
                <Users size={40} className="mb-3 opacity-40" />
                <p className="text-xs font-black uppercase tracking-widest text-center">
                  No circles yet. Create the first one!
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Create Group Sheet ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-end justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setShowCreate(false)}>
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="w-full max-w-lg bg-white rounded-t-3xl p-6 pb-10 max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-gray-900 font-black text-lg">Create a Circle</h3>
                <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-full bg-gray-100">
                  <X size={18} className="text-gray-500" />
                </button>
              </div>

              {/* Cover Photo */}
              <div
                className="w-full h-32 rounded-2xl mb-4 overflow-hidden cursor-pointer flex items-center justify-center border-2 border-dashed border-gray-300 relative"
                style={{ background: coverPreview ? undefined : "linear-gradient(135deg,#e0e7ff,#f3f4f6)" }}
                onClick={() => coverInputRef.current?.click()}
              >
                {coverPreview ? (
                  <img src={coverPreview} className="w-full h-full object-cover" alt="" />
                ) : (
                  <div className="flex flex-col items-center text-gray-400 gap-1">
                    <Camera size={24} />
                    <span className="text-xs font-semibold">Add Cover Photo</span>
                  </div>
                )}
                <input ref={coverInputRef} type="file" accept="image/*" className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setCoverFile(f);
                    setCoverPreview(URL.createObjectURL(f));
                    e.target.value = "";
                  }} />
              </div>

              {/* Group Name */}
              <label className="block text-[11px] font-black text-gray-500 uppercase tracking-wide mb-1.5">Circle Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Tech Lovers, Study Group…"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none mb-4 focus:ring-2 focus:ring-blue-400/30"
              />

              {/* Description */}
              <label className="block text-[11px] font-black text-gray-500 uppercase tracking-wide mb-1.5">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="What is this circle about?"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none resize-none mb-4 focus:ring-2 focus:ring-blue-400/30"
                rows={3}
              />

              {/* Privacy */}
              <label className="block text-[11px] font-black text-gray-500 uppercase tracking-wide mb-2">Privacy</label>
              <div className="flex gap-3 mb-6">
                {(["public", "private"] as const).map(opt => (
                  <button
                    key={opt}
                    onClick={() => setForm(p => ({ ...p, privacy: opt }))}
                    className={`flex-1 flex items-center gap-2 justify-center py-3 rounded-xl border text-sm font-bold transition-all ${
                      form.privacy === opt
                        ? "bg-blue-50 border-blue-400 text-blue-700"
                        : "bg-gray-50 border-gray-200 text-gray-500"
                    }`}
                  >
                    {opt === "public" ? <Globe size={15} /> : <Lock size={15} />}
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    {form.privacy === opt && <Check size={14} className="ml-auto" />}
                  </button>
                ))}
              </div>

              <button
                onClick={handleCreateGroup}
                disabled={!form.name.trim() || creating}
                className="w-full py-4 rounded-2xl bg-blue-600 text-white font-black text-sm disabled:opacity-40 active:scale-[0.98] transition-transform"
              >
                {creating ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" /> Creating…
                  </span>
                ) : "Create Circle"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
