import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { useProfileViewer } from "../context/ProfileViewerContext";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { MagnetButton } from "./MagnetSystem";
import {
  Plus, Users, Lock, Globe, ChevronLeft, Settings, Send,
  Heart, Camera, Shield, X, Check, ImageIcon, Loader2, Trash2,
  Share2, MessageCircle, FileText, Bell, MoreVertical, Pencil,
  UserPlus, UserMinus, Crown, ShieldCheck, Ban, Eye,
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
  circle_id?: string;
  group_id?: string;
  author_id: string;
  author_name: string;
  author_avatar?: string | null;
  content: string;
  media_url?: string | null;
  created_at: string;
  likes_count: number;
  comments_count?: number;
  shares_count?: number;
  status?: "pending" | "approved" | "rejected";
  comments_muted?: boolean;
}

interface CircleComment {
  id: string;
  post_id: string;
  author_id: string;
  author_name: string;
  author_avatar?: string | null;
  content: string;
  created_at: string;
}

interface CircleInvite {
  id: string;
  circle_id: string;
  inviter_id: string;
  invitee_id: string;
  status: "pending" | "accepted" | "rejected";
  circles?: Group;
}

interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string | null;
  content: string;
  created_at: string;
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
  group, isMember, onJoin, onClick, justJoined,
}: {
  group: Group; isMember: boolean; onJoin: () => void; onClick: () => void; justJoined?: boolean;
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
          isMember || justJoined
            ? "bg-green-50 text-green-700 border border-green-200"
            : "bg-blue-600 text-white"
        }`}
      >
        {justJoined ? "✓ Joined!" : isMember ? "View" : "Join"}
      </button>
    </div>
  </div>
);

// ── Main Component ─────────────────────────────────────────────────────────────
interface Props {
  userProfile: any;
  currentUserId: string | null;
}

type GroupTab = "posts" | "review" | "chat" | "members";
type MemberRole = "admin" | "moderator" | "member";

export default function CirclePage({ userProfile, currentUserId }: Props) {
  const { openProfile } = useProfileViewer();
  const [view, setView] = useState<"dashboard" | "group">("dashboard");
  const [groups, setGroups] = useState<Group[]>([]);
  const [myGroupIds, setMyGroupIds] = useState<Set<string>>(new Set());
  const [justJoinedIds, setJustJoinedIds] = useState<Set<string>>(new Set());
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [groupTab, setGroupTab] = useState<GroupTab>("posts");
  const [groupPosts, setGroupPosts] = useState<GroupPost[]>([]);
  const [pendingPosts, setPendingPosts] = useState<GroupPost[]>([]);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [newMemberCount, setNewMemberCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentRole, setCurrentRole] = useState<MemberRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [myInvites, setMyInvites] = useState<CircleInvite[]>([]);

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
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [postComments, setPostComments] = useState<CircleComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commenting, setCommenting] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteResults, setInviteResults] = useState<any[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);

  // Chat
  const [chatMessages, setChatMessages] = useState<GroupMessage[]>([]);
  const [chatText, setChatText] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [chatLoaded, setChatLoaded] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatSubRef = useRef<any>(null);
  const memberSubRef = useRef<any>(null);
  const postSubRef = useRef<any>(null);
  const commentSubRef = useRef<any>(null);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  // Edit / Delete state
  const [postMenuId, setPostMenuId]             = useState<string | null>(null);
  const [editingPost, setEditingPost]           = useState<{ id: string; content: string } | null>(null);
  const [editPostText, setEditPostText]         = useState("");
  const [editPostSaving, setEditPostSaving]     = useState(false);
  const [confirmDeletePost, setConfirmDeletePost] = useState<string | null>(null);
  const [showEditGroup, setShowEditGroup]       = useState(false);
  const [editGroupForm, setEditGroupForm]       = useState({ name: "", description: "" });
  const [editGroupCoverFile, setEditGroupCoverFile] = useState<File | null>(null);
  const [editGroupCoverPrev, setEditGroupCoverPrev] = useState<string | null>(null);
  const [editGroupSaving, setEditGroupSaving]   = useState(false);
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(false);
  const [deletingGroup, setDeletingGroup]       = useState(false);

  const canModerate = currentRole === "admin" || currentRole === "moderator";
  const canAdmin = currentRole === "admin";

  const canManageMember = (member: any) => {
    if (!currentUserId || member.user_id === currentUserId) return false;
    if (currentRole === "admin") return member.role !== "admin";
    if (currentRole === "moderator") return member.role !== "admin";
    return false;
  };

  const fetchCirclePosts = useCallback(async (circleId: string, reviewer = canModerate) => {
    let query = supabase
      .from("circle_posts")
      .select("id, circle_id, author_id, author_name, author_avatar, content, media_url, created_at, likes_count, comments_count, shares_count, status, comments_muted")
      .eq("circle_id", circleId)
      .order("created_at", { ascending: false })
      .limit(50);

    query = reviewer ? query.in("status", ["approved", "pending"]) : query.eq("status", "approved");
    const { data, error } = await query;
    if (error) {
      toast.error("Circle posts are unavailable. Please run the circle_posts setup SQL.");
      setGroupPosts([]);
      setPendingPosts([]);
      return;
    }
    const rows = ((data as GroupPost[]) ?? []).map(post => ({
      ...post,
      status: post.status ?? "approved",
      likes_count: post.likes_count ?? 0,
      comments_count: post.comments_count ?? 0,
      shares_count: post.shares_count ?? 0,
    }));
    if (currentUserId && rows.length > 0) {
      const { data: likedRows } = await supabase
        .from("circle_post_likes")
        .select("post_id")
        .eq("user_id", currentUserId)
        .in("post_id", rows.map(post => post.id));
      setLikedPostIds(new Set((likedRows ?? []).map((row: any) => row.post_id)));
    } else {
      setLikedPostIds(new Set());
    }
    setGroupPosts(reviewer ? rows : rows.filter(post => post.status === "approved"));
    setPendingPosts(rows.filter(post => post.status === "pending"));
  }, [canModerate, currentUserId]);

  const fetchMyInvites = useCallback(async () => {
    if (!currentUserId) return;
    const { data } = await supabase
      .from("circle_invites")
      .select("id, circle_id, inviter_id, invitee_id, status, circles(id, name, description, privacy, cover_url, rules, post_approval, created_by, admin_id, member_count)")
      .eq("invitee_id", currentUserId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(10);
    setMyInvites((data as CircleInvite[]) ?? []);
  }, [currentUserId]);

  // ── Fetch all groups ─────────────────────────────────────────────────────────
  const fetchGroups = async () => {
    const { data, error } = await supabase
      .from("circles")
      .select("id, name, description, cover_url, privacy, member_count, created_by, admin_id, created_at, rules, post_approval")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      toast.error("Circles table not available.");
      setLoading(false);
      return;
    }
    if (data) setGroups(data as Group[]);
    setLoading(false);
  };

  const fetchMyMemberships = async () => {
    if (!currentUserId) return;
    const { data } = await supabase
      .from("circle_members")
      .select("circle_id")
      .eq("user_id", currentUserId);
    if (data) setMyGroupIds(new Set(data.map((r: any) => r.circle_id)));
  };

  useEffect(() => {
    fetchGroups();
    fetchMyMemberships();
    fetchMyInvites();
  }, [currentUserId]);

  // ── Cleanup realtime subscriptions on unmount ────────────────────────────────
  useEffect(() => {
    return () => {
      if (chatSubRef.current) supabase.removeChannel(chatSubRef.current);
      if (memberSubRef.current) supabase.removeChannel(memberSubRef.current);
      if (postSubRef.current) supabase.removeChannel(postSubRef.current);
      if (commentSubRef.current) supabase.removeChannel(commentSubRef.current);
    };
  }, []);

  // ── Create Group ─────────────────────────────────────────────────────────────
  const handleCreateGroup = async () => {
    if (!form.name.trim()) return;
    if (!currentUserId) { toast.error("Please log in to create a Circle."); return; }
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
        .from("circles")
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

      if (error) { toast.error(`Failed to create Circle: ${error.message}`); return; }

      if (newGroup) {
        await supabase.from("circle_members").insert([{ circle_id: newGroup.id, user_id: currentUserId, role: "admin" }]);
        const createdGroup: Group = { ...newGroup, member_count: 1 };
        setGroups(prev => [createdGroup, ...prev]);
        setMyGroupIds(prev => new Set([...prev, newGroup.id]));
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
    setJustJoinedIds(prev => new Set([...prev, groupId]));
    setMyGroupIds(prev => new Set([...prev, groupId]));
    await supabase.from("circle_members").insert([{ circle_id: groupId, user_id: currentUserId, role: "member" }]);
    await supabase.from("circles").update({ member_count: (groups.find(g => g.id === groupId)?.member_count ?? 0) + 1 }).eq("id", groupId);
    fetchGroups();
    toast.success("Joined! Welcome to the Circle 🎉");
  };

  // ── Share Circle ─────────────────────────────────────────────────────────────
  const shareCircle = (group: Group) => {
    const link = `${window.location.origin}?circle=${group.id}`;
    const text = `Join "${group.name}" on Flicks! 🔥`;
    if (navigator.share) {
      navigator.share({ title: group.name, text, url: link }).catch(() => {});
    } else {
      navigator.clipboard.writeText(link);
      toast.success("Invite link copied! Share it anywhere 🔗");
    }
  };

  const shareOnWhatsApp = (group: Group) => {
    const link = `${window.location.origin}?circle=${group.id}`;
    const text = encodeURIComponent(`Join "${group.name}" on Flicks! 🔥 ${link}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  // ── Open Group Profile ───────────────────────────────────────────────────────
  const openGroup = async (group: Group) => {
    setSelectedGroup(group);
    setView("group");
    setGroupTab("posts");
    setChatLoaded(false);
    setNewMemberCount(0);

    // Fetch members
    const { data: members } = await supabase
      .from("circle_members")
      .select("*, profiles(full_name, avatar_url)")
      .eq("circle_id", group.id)
      .limit(50);
    setGroupMembers(members ?? []);

    const myRow = (members ?? []).find((m: any) => m.user_id === currentUserId);
    const role = (myRow?.role as MemberRole | undefined) ?? null;
    setCurrentRole(role);
    setIsAdmin(role === "admin");
    setSettingsForm({ rules: group.rules ?? "", post_approval: group.post_approval ?? false });
    await fetchCirclePosts(group.id, role === "admin" || role === "moderator");

    if (postSubRef.current) supabase.removeChannel(postSubRef.current);
    const postCh = supabase
      .channel(`circle-posts-${group.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "circle_posts",
        filter: `circle_id=eq.${group.id}`,
      }, () => {
        fetchCirclePosts(group.id, role === "admin" || role === "moderator");
      })
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "circle_post_likes",
      }, () => {
        fetchCirclePosts(group.id, role === "admin" || role === "moderator");
      })
      .subscribe();
    postSubRef.current = postCh;

    // Real-time member subscription (for owner new-member notifications)
    if (memberSubRef.current) supabase.removeChannel(memberSubRef.current);
    const memberCh = supabase
      .channel(`members-${group.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "circle_members",
        filter: `circle_id=eq.${group.id}`,
      }, (payload) => {
        const newRow = payload.new as any;
        // Refresh members list
        supabase
          .from("circle_members")
          .select("*, profiles(full_name, avatar_url)")
          .eq("circle_id", group.id)
          .limit(50)
          .then(({ data }) => {
            if (data) setGroupMembers(data);
          });
        if (payload.eventType === "INSERT") {
          setSelectedGroup(prev => prev ? { ...prev, member_count: (prev.member_count ?? 0) + 1 } : prev);
        }
        if (payload.eventType === "DELETE") {
          setSelectedGroup(prev => prev ? { ...prev, member_count: Math.max((prev.member_count ?? 1) - 1, 0) } : prev);
        }
        if (payload.eventType === "INSERT" && newRow.user_id !== currentUserId) {
          setNewMemberCount(c => c + 1);
        }
      })
      .subscribe();
    memberSubRef.current = memberCh;
  };

  // ── Load chat messages + subscribe ──────────────────────────────────────────
  const loadChat = useCallback(async (groupId: string) => {
    setChatLoaded(false);
    const { data, error } = await supabase
      .from("group_messages")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true })
      .limit(100);

    if (error) {
      toast.error("Chat unavailable — table may not exist yet.");
      setChatLoaded(true);
      return;
    }
    setChatMessages((data as GroupMessage[]) ?? []);
    setChatLoaded(true);

    // Subscribe to new messages
    if (chatSubRef.current) supabase.removeChannel(chatSubRef.current);
    const ch = supabase
      .channel(`chat-${groupId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "group_messages",
        filter: `group_id=eq.${groupId}`,
      }, (payload) => {
        setChatMessages(prev => {
          const msg = payload.new as GroupMessage;
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
      })
      .subscribe();
    chatSubRef.current = ch;
  }, []);

  useEffect(() => {
    if (groupTab === "chat" && selectedGroup) {
      loadChat(selectedGroup.id);
    }
    // Cleanup chat subscription when leaving chat tab
    if (groupTab !== "chat" && chatSubRef.current) {
      supabase.removeChannel(chatSubRef.current);
      chatSubRef.current = null;
    }
  }, [groupTab, selectedGroup]);

  // Auto scroll chat to bottom
  useEffect(() => {
    if (chatLoaded) {
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [chatLoaded, chatMessages.length]);

  // ── Send chat message ────────────────────────────────────────────────────────
  const sendChatMessage = async () => {
    if (!chatText.trim() || !currentUserId || !selectedGroup || sendingChat) return;
    setSendingChat(true);
    const content = chatText.trim();
    setChatText("");

    const { error } = await supabase.from("group_messages").insert([{
      group_id: selectedGroup.id,
      sender_id: currentUserId,
      sender_name: userProfile?.full_name || "Member",
      sender_avatar: userProfile?.avatar_url || null,
      content,
    }]);

    if (error) {
      toast.error("Message not sent. Please try again.");
      setChatText(content);
    }
    setSendingChat(false);
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
      const postStatus = canModerate || !selectedGroup.post_approval ? "approved" : "pending";
      const { error } = await supabase.from("circle_posts").insert([{
        circle_id: selectedGroup.id,
        author_id: currentUserId,
        author_name: userProfile?.full_name || "Member",
        author_avatar: userProfile?.avatar_url || null,
        content: postText.trim(),
        media_url,
        likes_count: 0,
        comments_count: 0,
        shares_count: 0,
        status: postStatus,
      }]);
      if (error) {
        toast.error(`Post not submitted: ${error.message}`);
        return;
      }
      setPostText("");
      setPostMedia(null);
      await fetchCirclePosts(selectedGroup.id);
      toast.success(postStatus === "pending" ? "Post sent for review." : "Post published.");
    } finally {
      setPosting(false);
    }
  };

  // ── Like Post ─────────────────────────────────────────────────────────────────
  const handleLikePost = async (post: GroupPost) => {
    if (!currentUserId) return;
    const liked = likedPostIds.has(post.id);
    setLikedPostIds(prev => {
      const next = new Set(prev);
      liked ? next.delete(post.id) : next.add(post.id);
      return next;
    });
    setGroupPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes_count: Math.max((p.likes_count || 0) + (liked ? -1 : 1), 0) } : p));

    if (liked) {
      await supabase.from("circle_post_likes").delete().eq("post_id", post.id).eq("user_id", currentUserId);
      await supabase.from("circle_posts").update({ likes_count: Math.max((post.likes_count || 1) - 1, 0) }).eq("id", post.id);
    } else {
      await supabase.from("circle_post_likes").upsert({ post_id: post.id, user_id: currentUserId }, { onConflict: "post_id,user_id" });
      await supabase.from("circle_posts").update({ likes_count: (post.likes_count || 0) + 1 }).eq("id", post.id);
    }
  };

  const reviewPost = async (postId: string, status: "approved" | "rejected") => {
    if (!selectedGroup || !canModerate) return;
    const { error } = await supabase.from("circle_posts").update({ status }).eq("id", postId);
    if (error) {
      toast.error(`Review failed: ${error.message}`);
      return;
    }
    await fetchCirclePosts(selectedGroup.id);
    toast.success(status === "approved" ? "Post approved." : "Post rejected.");
  };

  const toggleCommentsMuted = async (post: GroupPost) => {
    if (!canModerate) return;
    const next = !post.comments_muted;
    await supabase.from("circle_posts").update({ comments_muted: next }).eq("id", post.id);
    setGroupPosts(prev => prev.map(p => p.id === post.id ? { ...p, comments_muted: next } : p));
    setPendingPosts(prev => prev.map(p => p.id === post.id ? { ...p, comments_muted: next } : p));
    toast.success(next ? "Comments muted for this post." : "Comments unmuted.");
  };

  const openComments = async (post: GroupPost) => {
    setCommentPostId(post.id);
    setCommentLoading(true);
    const { data } = await supabase
      .from("circle_post_comments")
      .select("*")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true })
      .limit(100);
    setPostComments((data as CircleComment[]) ?? []);
    setCommentLoading(false);

    if (commentSubRef.current) supabase.removeChannel(commentSubRef.current);
    const ch = supabase
      .channel(`circle-comments-${post.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "circle_post_comments",
        filter: `post_id=eq.${post.id}`,
      }, (payload) => {
        const row = payload.new as CircleComment;
        setPostComments(prev => prev.some(c => c.id === row.id) ? prev : [...prev, row]);
      })
      .subscribe();
    commentSubRef.current = ch;
  };

  const sendComment = async () => {
    const post = groupPosts.find(p => p.id === commentPostId);
    if (!commentText.trim() || !currentUserId || !commentPostId || !post || post.comments_muted) return;
    setCommenting(true);
    const content = commentText.trim();
    const { data, error } = await supabase.from("circle_post_comments").insert({
      post_id: commentPostId,
      author_id: currentUserId,
      author_name: userProfile?.full_name || "Member",
      author_avatar: userProfile?.avatar_url || null,
      content,
    }).select().single();
    if (!error) {
      setCommentText("");
      if (data) {
        setPostComments(prev => prev.some(c => c.id === data.id) ? prev : [...prev, data as CircleComment]);
      }
      const nextCount = (post.comments_count || 0) + 1;
      await supabase.from("circle_posts").update({ comments_count: nextCount }).eq("id", commentPostId);
      setGroupPosts(prev => prev.map(p => p.id === commentPostId ? { ...p, comments_count: nextCount } : p));
    } else {
      toast.error(`Comment failed: ${error.message}`);
    }
    setCommenting(false);
  };

  const sharePost = async (post: GroupPost) => {
    const url = `${window.location.origin}?circle=${selectedGroup?.id}&post=${post.id}`;
    const text = post.content || `Post from ${selectedGroup?.name || "Circle"}`;
    if (navigator.share) {
      await navigator.share({ title: selectedGroup?.name || "Circle post", text, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Post link copied.");
    }
    const nextCount = (post.shares_count || 0) + 1;
    await supabase.from("circle_posts").update({ shares_count: nextCount }).eq("id", post.id);
    setGroupPosts(prev => prev.map(p => p.id === post.id ? { ...p, shares_count: nextCount } : p));
  };

  const refreshMembers = async (circleId = selectedGroup?.id) => {
    if (!circleId) return;
    const { data } = await supabase
      .from("circle_members")
      .select("*, profiles(full_name, avatar_url)")
      .eq("circle_id", circleId)
      .limit(100);
    if (data) {
      setGroupMembers(data);
      const myRow = data.find((m: any) => m.user_id === currentUserId);
      const role = (myRow?.role as MemberRole | undefined) ?? null;
      setCurrentRole(role);
      setIsAdmin(role === "admin");
    }
  };

  const updateMemberRole = async (member: any, role: MemberRole) => {
    if (!canAdmin || member.role === "admin") return;
    await supabase.from("circle_members").update({ role }).eq("id", member.id);
    await refreshMembers();
    toast.success(role === "moderator" ? "Member promoted to Moderator." : "Role updated.");
  };

  const removeMember = async (member: any) => {
    if (!selectedGroup || !canManageMember(member)) return;
    await supabase.from("circle_members").delete().eq("id", member.id);
    await supabase.from("circles").update({ member_count: Math.max((selectedGroup.member_count ?? groupMembers.length) - 1, 0) }).eq("id", selectedGroup.id);
    await refreshMembers();
    setSelectedGroup(prev => prev ? { ...prev, member_count: Math.max((prev.member_count ?? groupMembers.length) - 1, 0) } : prev);
    toast.success("Member removed.");
  };

  const searchInvitees = async () => {
    if (!inviteSearch.trim() || !selectedGroup || !canAdmin) return;
    setInviteLoading(true);
    const memberIds = new Set(groupMembers.map((m: any) => m.user_id));
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .ilike("full_name", `%${inviteSearch.trim()}%`)
      .limit(10);
    setInviteResults((data ?? []).filter((p: any) => p.id !== currentUserId && !memberIds.has(p.id)));
    setInviteLoading(false);
  };

  const sendInvite = async (profile: any) => {
    if (!selectedGroup || !currentUserId || !canAdmin) return;
    const { error } = await supabase.from("circle_invites").upsert({
      circle_id: selectedGroup.id,
      inviter_id: currentUserId,
      invitee_id: profile.id,
      status: "pending",
    }, { onConflict: "circle_id,invitee_id" });
    if (error) {
      toast.error(`Invite failed: ${error.message}`);
      return;
    }
    await supabase.from("notifications").insert({
      notifier_id: profile.id,
      actor_id: currentUserId,
      type: "circle_invite",
      entity_id: selectedGroup.id,
      entity_type: "circle",
      content: `${userProfile?.full_name || "Someone"} invited you to join ${selectedGroup.name}`,
      is_read: false,
    }).then(() => {});
    toast.success(`Invite sent to ${profile.full_name || "member"}.`);
  };

  const respondToInvite = async (invite: CircleInvite, status: "accepted" | "rejected") => {
    if (!currentUserId) return;
    await supabase.from("circle_invites").update({ status }).eq("id", invite.id);
    if (status === "accepted") {
      await supabase.from("circle_members").upsert({
        circle_id: invite.circle_id,
        user_id: currentUserId,
        role: "member",
      }, { onConflict: "circle_id,user_id" });
      const circle = groups.find(g => g.id === invite.circle_id);
      await supabase.from("circles").update({ member_count: ((circle?.member_count ?? 0) + 1) }).eq("id", invite.circle_id);
      setMyGroupIds(prev => new Set([...prev, invite.circle_id]));
      await fetchGroups();
      toast.success("Circle invite accepted.");
    } else {
      toast.success("Circle invite rejected.");
    }
    await fetchMyInvites();
  };

  // ── Save Settings ─────────────────────────────────────────────────────────────
  const saveSettings = async () => {
    if (!selectedGroup) return;
    setSavingSettings(true);
    await supabase.from("circles").update({ rules: settingsForm.rules, post_approval: settingsForm.post_approval }).eq("id", selectedGroup.id);
    setSelectedGroup(prev => prev ? { ...prev, rules: settingsForm.rules, post_approval: settingsForm.post_approval } : prev);
    setSavingSettings(false);
    setShowSettings(false);
  };

  // ── Edit Group Post ────────────────────────────────────────────────────────────
  const saveEditPost = async () => {
    if (!editingPost || !editPostText.trim()) return;
    setEditPostSaving(true);
    await supabase.from("circle_posts").update({ content: editPostText.trim() }).eq("id", editingPost.id);
    setGroupPosts(prev => prev.map(p => p.id === editingPost.id ? { ...p, content: editPostText.trim() } : p));
    setEditPostSaving(false);
    setEditingPost(null);
  };

  const deleteGroupPost = async (postId: string) => {
    if (!canModerate && !groupPosts.some(post => post.id === postId && post.author_id === currentUserId)) return;
    await supabase.from("circle_posts").delete().eq("id", postId);
    setGroupPosts(prev => prev.filter(p => p.id !== postId));
    setPendingPosts(prev => prev.filter(p => p.id !== postId));
    setConfirmDeletePost(null);
  };

  // ── Edit Group (Profile) ───────────────────────────────────────────────────────
  const openEditGroup = (group: Group) => {
    setEditGroupForm({ name: group.name, description: group.description || "" });
    setEditGroupCoverFile(null);
    setEditGroupCoverPrev(group.cover_url || null);
    setShowEditGroup(true);
  };

  const saveEditGroup = async () => {
    if (!selectedGroup || !editGroupForm.name.trim()) return;
    setEditGroupSaving(true);
    let cover_url = selectedGroup.cover_url;
    if (editGroupCoverFile) {
      const ext = editGroupCoverFile.name.split(".").pop();
      const path = `group-covers/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, editGroupCoverFile, { upsert: true });
      if (!upErr) {
        const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
        cover_url = pub.publicUrl;
      }
    }
    const updates = { name: editGroupForm.name.trim(), description: editGroupForm.description.trim() || null, cover_url };
    await supabase.from("circles").update(updates).eq("id", selectedGroup.id);
    const updated = { ...selectedGroup, ...updates };
    setSelectedGroup(updated);
    setGroups(prev => prev.map(g => g.id === selectedGroup.id ? updated : g));
    toast.success("Circle updated!");
    setEditGroupSaving(false);
    setShowEditGroup(false);
  };

  // ── Delete Group ──────────────────────────────────────────────────────────────
  const deleteGroup = async () => {
    if (!selectedGroup) return;
    setDeletingGroup(true);
    await supabase.from("circle_posts").delete().eq("circle_id", selectedGroup.id);
    await supabase.from("group_messages").delete().eq("group_id", selectedGroup.id);
    await supabase.from("circle_members").delete().eq("circle_id", selectedGroup.id);
    await supabase.from("circles").delete().eq("id", selectedGroup.id);
    setGroups(prev => prev.filter(g => g.id !== selectedGroup.id));
    setMyGroupIds(prev => { const s = new Set(prev); s.delete(selectedGroup.id); return s; });
    setDeletingGroup(false);
    setConfirmDeleteGroup(false);
    setView("dashboard");
    setSelectedGroup(null);
    toast.success("Circle deleted.");
  };

  const myGroups = groups.filter(g => myGroupIds.has(g.id));
  const suggestedGroups = groups.filter(g => !myGroupIds.has(g.id));

  // ═══════════════════════════ RENDER ═══════════════════════════════════════════

  // ── GROUP PROFILE VIEW ────────────────────────────────────────────────────────
  if (view === "group" && selectedGroup) {
    const isMember = myGroupIds.has(selectedGroup.id);

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Cover + Back */}
        <div className="relative w-full flex-shrink-0" style={{ height: 180, background: selectedGroup.cover_url ? undefined : gradFor(selectedGroup.id) }}>
          {selectedGroup.cover_url && (
            <img src={selectedGroup.cover_url} className="w-full h-full object-cover" alt={selectedGroup.name} />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/70" />

          {/* Back */}
          <button
            onClick={() => {
              setView("dashboard");
              setSelectedGroup(null);
              setNewMemberCount(0);
              if (chatSubRef.current) { supabase.removeChannel(chatSubRef.current); chatSubRef.current = null; }
              if (memberSubRef.current) { supabase.removeChannel(memberSubRef.current); memberSubRef.current = null; }
            }}
            className="absolute top-4 left-4 w-9 h-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/20"
          >
            <ChevronLeft size={20} className="text-white" />
          </button>

          {/* Admin settings + edit/delete */}
          {canModerate && (
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <button
                onClick={() => openEditGroup(selectedGroup)}
                className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/20"
              >
                <Pencil size={16} className="text-white" />
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/20"
              >
                <Settings size={18} className="text-white" />
              </button>
              {selectedGroup.created_by === currentUserId && (
                <button
                  onClick={() => setConfirmDeleteGroup(true)}
                  className="w-9 h-9 rounded-full bg-red-500/60 backdrop-blur-md flex items-center justify-center border border-red-300/30"
                >
                  <Trash2 size={16} className="text-white" />
                </button>
              )}
            </div>
          )}

          {/* Title */}
          <div className="absolute bottom-3 left-4 right-4">
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="text-white font-black text-lg drop-shadow-lg">{selectedGroup.name}</h2>
              {currentRole === "admin" && <span className="bg-yellow-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full">ADMIN</span>}
              {currentRole === "moderator" && <span className="bg-blue-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full">MOD</span>}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                {selectedGroup.privacy === "private" ? <Lock size={10} className="text-white/80" /> : <Globe size={10} className="text-white/80" />}
                <span className="text-white/80 text-[11px] font-semibold">
                  {selectedGroup.privacy} · {selectedGroup.member_count ?? groupMembers.length} members
                </span>
              </div>
              {/* Share button */}
              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  onClick={() => shareOnWhatsApp(selectedGroup)}
                  className="flex items-center gap-1 bg-green-500/90 text-white text-[10px] font-black px-2.5 py-1 rounded-full active:scale-95 transition-transform"
                >
                  <Share2 size={10} />
                  WhatsApp
                </button>
                <button
                  onClick={() => shareCircle(selectedGroup)}
                  className="flex items-center gap-1 bg-white/20 backdrop-blur-sm text-white text-[10px] font-black px-2.5 py-1 rounded-full border border-white/30 active:scale-95 transition-transform"
                >
                  <Share2 size={10} />
                  Copy Link
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="bg-white border-b border-gray-100 flex sticky top-0 z-20">
          {([
            { id: "posts" as const, icon: FileText, label: "Posts", show: true },
            { id: "review" as const, icon: Eye, label: `Review${pendingPosts.length > 0 ? ` ${pendingPosts.length}` : ""}`, show: canModerate },
            { id: "chat" as const, icon: MessageCircle, label: "Chat", show: true },
            { id: "members" as const, icon: Users, label: `${canModerate ? "Admin" : "Members"}${newMemberCount > 0 && canModerate ? ` +${newMemberCount}` : ""}`, show: true },
          ]).filter(tab => tab.show).map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setGroupTab(tab.id);
                if (tab.id === "members") setNewMemberCount(0);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[12px] font-black border-b-2 transition-colors relative ${
                groupTab === tab.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-400"
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
              {tab.id === "members" && newMemberCount > 0 && canModerate && (
                <span className="absolute top-1.5 right-4 w-4 h-4 bg-red-500 rounded-full text-white text-[8px] font-black flex items-center justify-center">
                  {newMemberCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── POSTS TAB ──────────────────────────────────────────────────────── */}
        {groupTab === "posts" && (
          <div className="flex-1 overflow-y-auto">
            {/* About */}
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
                        {selectedGroup.post_approval && !canModerate ? "Submit" : "Post"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Posts list */}
            <div className="space-y-0">
              {groupPosts.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-gray-300">
                  <FileText size={32} className="mb-3 opacity-40" />
                  <p className="text-xs font-black uppercase tracking-widest">No posts yet</p>
                  {isMember && <p className="text-[11px] text-gray-400 mt-1">Be the first to post!</p>}
                </div>
              ) : (
                groupPosts.map(post => {
                  const canEdit = post.author_id === currentUserId || canModerate;
                  return (
                    <div key={post.id} className="bg-white border-b border-gray-100">
                      <div className="flex items-center gap-3 px-4 py-3">
                        <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-sm shrink-0 overflow-hidden border border-gray-100">
                          {post.author_avatar ? (
                            <img src={post.author_avatar} className="w-full h-full object-cover" alt="" />
                          ) : (
                            (post.author_name || "M")[0].toUpperCase()
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="text-gray-900 font-bold text-sm leading-none">{post.author_name}</p>
                            {post.status === "pending" && (
                              <span className="text-[8px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">PENDING</span>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-400 mt-0.5">{new Date(post.created_at).toLocaleDateString()}</p>
                        </div>
                        {canEdit && (
                          <div className="relative">
                            <button onClick={() => setPostMenuId(postMenuId === post.id ? null : post.id)}
                              className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400">
                              <MoreVertical size={16} />
                            </button>
                            <AnimatePresence>
                              {postMenuId === post.id && (
                                <motion.div initial={{ opacity: 0, scale: 0.9, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.9, y: -4 }} transition={{ duration: 0.12 }}
                                  className="absolute right-0 top-8 z-50 w-32 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden"
                                  onClick={e => e.stopPropagation()}>
                                  {post.author_id === currentUserId && (
                                    <button onClick={() => { setEditingPost({ id: post.id, content: post.content }); setEditPostText(post.content); setPostMenuId(null); }}
                                      className="w-full flex items-center gap-2 px-4 py-3 text-blue-600 hover:bg-blue-50 text-[12px] font-semibold border-b border-gray-50">
                                      <Pencil size={13} /> Edit
                                    </button>
                                  )}
                                  <button onClick={() => { setConfirmDeletePost(post.id); setPostMenuId(null); }}
                                    className="w-full flex items-center gap-2 px-4 py-3 text-red-500 hover:bg-red-50 text-[12px] font-semibold">
                                    <Trash2 size={13} /> Delete
                                  </button>
                                  {canModerate && (
                                    <button onClick={() => { toggleCommentsMuted(post); setPostMenuId(null); }}
                                      className="w-full flex items-center gap-2 px-4 py-3 text-amber-600 hover:bg-amber-50 text-[12px] font-semibold border-t border-gray-50">
                                      <Ban size={13} /> {post.comments_muted ? "Unmute" : "Mute"}
                                    </button>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                      </div>
                      {post.content && <p className="px-4 pb-2 text-[13px] text-gray-800 leading-snug">{post.content}</p>}
                      {post.media_url && (
                        <div className="w-full bg-gray-100">
                          <img src={post.media_url} className="w-full object-cover" style={{ maxHeight: "60vh" }} loading="lazy" alt="" />
                        </div>
                      )}
                      <div className="flex items-center gap-4 px-4 py-2.5">
                        <button onClick={() => handleLikePost(post)} className="flex items-center gap-1.5">
                          <Heart size={20} className={likedPostIds.has(post.id) ? "fill-red-500 text-red-500" : "text-gray-400"} />
                          <span className="text-xs font-bold text-gray-500">{post.likes_count || 0}</span>
                        </button>
                        <button onClick={() => openComments(post)} className="flex items-center gap-1.5">
                          <MessageCircle size={20} className={post.comments_muted ? "text-amber-500" : "text-gray-400"} />
                          <span className="text-xs font-bold text-gray-500">{post.comments_count || 0}</span>
                        </button>
                        <button onClick={() => sharePost(post)} className="flex items-center gap-1.5">
                          <Share2 size={19} className="text-gray-400" />
                          <span className="text-xs font-bold text-gray-500">{post.shares_count || 0}</span>
                        </button>
                        <MagnetButton
                          postId={post.id}
                          postType="circle"
                          postOwnerId={selectedGroup?.created_by || selectedGroup?.admin_id || ""}
                          currentUserId={currentUserId}
                          dark={false}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Not a member CTA */}
            {!isMember && (
              <div className="fixed bottom-24 left-0 right-0 flex justify-center px-4 z-50">
                <button
                  onClick={() => handleJoin(selectedGroup.id)}
                  className="flex items-center gap-2 text-white px-8 py-3.5 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-transform"
                  style={{ background: "linear-gradient(135deg,#2563eb,#4f46e5)" }}
                >
                  <Users size={16} />
                  Join this Circle
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── REVIEW TAB ─────────────────────────────────────────────────────── */}
        {groupTab === "review" && canModerate && (
          <div className="flex-1 overflow-y-auto bg-gray-50">
            <div className="bg-white border-b border-gray-100 px-4 py-3">
              <p className="text-[13px] font-black text-gray-900">Pending Post Review</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Approve posts to make them visible to all members.</p>
            </div>
            {pendingPosts.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-gray-300">
                <ShieldCheck size={34} className="mb-3 opacity-40" />
                <p className="text-xs font-black uppercase tracking-widest">Nothing to review</p>
              </div>
            ) : (
              <div className="space-y-3 p-3">
                {pendingPosts.map(post => (
                  <div key={post.id} className="bg-white rounded-2xl border border-amber-100 overflow-hidden shadow-sm">
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-sm shrink-0 overflow-hidden">
                        {post.author_avatar ? <img src={post.author_avatar} className="w-full h-full object-cover" alt="" /> : (post.author_name || "M")[0].toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="text-gray-900 font-bold text-sm">{post.author_name}</p>
                        <p className="text-[10px] text-amber-600 font-bold">Waiting for approval</p>
                      </div>
                    </div>
                    {post.content && <p className="px-4 pb-3 text-[13px] text-gray-800 leading-snug">{post.content}</p>}
                    {post.media_url && <img src={post.media_url} className="w-full object-cover max-h-80" alt="" />}
                    <div className="flex gap-2 p-3 border-t border-gray-50">
                      <button onClick={() => reviewPost(post.id, "rejected")} className="flex-1 py-2.5 rounded-xl bg-red-50 text-red-600 font-black text-[12px] flex items-center justify-center gap-1.5">
                        <X size={14} /> Reject
                      </button>
                      <button onClick={() => reviewPost(post.id, "approved")} className="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-black text-[12px] flex items-center justify-center gap-1.5">
                        <Check size={14} /> Approve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── CHAT TAB ──────────────────────────────────────────────────────── */}
        {groupTab === "chat" && (
          <div className="flex flex-col flex-1 overflow-hidden" style={{ height: "calc(100vh - 220px)" }}>
            {!isMember ? (
              <div className="flex flex-col items-center justify-center flex-1 py-12 px-6 text-center">
                <MessageCircle size={40} className="text-gray-200 mb-3" />
                <p className="text-sm font-black text-gray-400 mb-4">Join this Circle to chat</p>
                <button
                  onClick={() => handleJoin(selectedGroup.id)}
                  className="text-white px-6 py-3 rounded-2xl font-black text-sm active:scale-95 transition-transform"
                  style={{ background: "linear-gradient(135deg,#2563eb,#4f46e5)" }}
                >
                  Join Circle
                </button>
              </div>
            ) : (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
                  {!chatLoaded ? (
                    <div className="flex justify-center py-12">
                      <Loader2 size={24} className="animate-spin text-blue-400" />
                    </div>
                  ) : chatMessages.length === 0 ? (
                    <div className="flex flex-col items-center py-12 text-gray-300">
                      <MessageCircle size={32} className="mb-2 opacity-40" />
                      <p className="text-xs font-black uppercase tracking-widest">No messages yet</p>
                      <p className="text-[11px] text-gray-400 mt-1">Say hello! 👋</p>
                    </div>
                  ) : (
                    chatMessages.map((msg, i) => {
                      const isMe = msg.sender_id === currentUserId;
                      const showAvatar = i === 0 || chatMessages[i - 1].sender_id !== msg.sender_id;
                      return (
                        <div key={msg.id} className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                          {/* Avatar */}
                          {!isMe && (
                            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-[10px] shrink-0 overflow-hidden"
                              style={{ opacity: showAvatar ? 1 : 0 }}>
                              {msg.sender_avatar
                                ? <img src={msg.sender_avatar} className="w-full h-full object-cover" alt="" />
                                : (msg.sender_name || "M")[0].toUpperCase()}
                            </div>
                          )}
                          <div className={`max-w-[72%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                            {showAvatar && !isMe && (
                              <span className="text-[9px] font-black text-gray-400 mb-0.5 px-1">{msg.sender_name}</span>
                            )}
                            <div className={`px-3 py-2 rounded-2xl text-sm leading-snug ${
                              isMe
                                ? "text-white rounded-br-sm"
                                : "bg-white text-gray-800 rounded-bl-sm border border-gray-100"
                            }`}
                              style={isMe ? { background: "linear-gradient(135deg,#2563eb,#4f46e5)" } : {}}>
                              {msg.content}
                            </div>
                            <span className="text-[8px] text-gray-400 mt-0.5 px-1">
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input bar */}
                <div className="bg-white border-t border-gray-100 px-3 py-2.5 flex items-center gap-2 flex-shrink-0">
                  <input
                    type="text"
                    value={chatText}
                    onChange={e => setChatText(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendChatMessage())}
                    placeholder="Message the circle…"
                    className="flex-1 bg-gray-100 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-400/30"
                  />
                  <button
                    onClick={sendChatMessage}
                    disabled={!chatText.trim() || sendingChat}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white disabled:opacity-40 active:scale-90 transition-transform shrink-0"
                    style={{ background: "linear-gradient(135deg,#2563eb,#4f46e5)" }}
                  >
                    {sendingChat ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── MEMBERS TAB ──────────────────────────────────────────────────── */}
        {groupTab === "members" && (
          <div className="flex-1 overflow-y-auto bg-gray-50">
            {/* Members count header */}
            <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-black text-gray-900">
                  {groupMembers.length} Member{groupMembers.length !== 1 ? "s" : ""} Joined
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">Real-time · Updates live</p>
              </div>
              {newMemberCount > 0 && canModerate && (
                <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-xl px-3 py-1.5">
                  <Bell size={12} className="text-green-600" />
                  <span className="text-[11px] font-black text-green-700">+{newMemberCount} New</span>
                </div>
              )}
            </div>

            {/* Members list */}
            <div className="divide-y divide-gray-100">
              {groupMembers.map((m: any) => (
                <div key={m.id} className="bg-white flex items-center gap-3 px-4 py-3">
                  <div
                    className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-sm overflow-hidden shrink-0 cursor-pointer"
                    style={{ boxShadow: m.role === "admin" ? "0 0 0 2px #f59e0b" : m.role === "moderator" ? "0 0 0 2px #3b82f6" : "0 0 0 1px #e5e7eb" }}
                    onClick={() => m.user_id && openProfile(m.user_id)}
                  >
                    {m.profiles?.avatar_url ? (
                      <img src={m.profiles.avatar_url} className="w-full h-full object-cover" alt="" />
                    ) : (
                      (m.profiles?.full_name || "M")[0].toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-gray-900 truncate">
                      {m.profiles?.full_name || "Member"}
                      {m.user_id === currentUserId && (
                        <span className="text-[10px] text-gray-400 font-medium ml-1">(you)</span>
                      )}
                    </p>
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border ${
                      m.role === "admin"
                        ? "text-amber-700 bg-amber-50 border-amber-200"
                        : m.role === "moderator"
                          ? "text-blue-700 bg-blue-50 border-blue-200"
                          : "text-gray-500 bg-gray-50 border-gray-200"
                    }`}>
                      {m.role === "admin" ? "Admin" : m.role === "moderator" ? "Moderator" : "Member"}
                    </span>
                  </div>
                  {m.user_id !== currentUserId && (
                    <div className="flex items-center gap-1.5">
                      {canAdmin && m.role !== "admin" && (
                        <button
                          onClick={() => updateMemberRole(m, m.role === "moderator" ? "member" : "moderator")}
                          className="text-[10px] font-black text-blue-600 border border-blue-200 px-2 py-1.5 rounded-xl bg-blue-50 active:scale-95 transition-transform"
                        >
                          {m.role === "moderator" ? "Member" : "Mod"}
                        </button>
                      )}
                      {canManageMember(m) && (
                        <button
                          onClick={() => removeMember(m)}
                          className="text-[10px] font-black text-red-600 border border-red-200 px-2 py-1.5 rounded-xl bg-red-50 active:scale-95 transition-transform"
                        >
                          Kick
                        </button>
                      )}
                      <button
                        onClick={() => m.user_id && openProfile(m.user_id)}
                        className="text-[10px] font-black text-blue-600 border border-blue-200 px-3 py-1.5 rounded-xl bg-blue-50 active:scale-95 transition-transform"
                      >
                        View
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {groupMembers.length === 0 && (
                <div className="flex flex-col items-center py-12 text-gray-300">
                  <Users size={32} className="mb-2 opacity-40" />
                  <p className="text-xs font-black uppercase tracking-widest">No members yet</p>
                </div>
              )}
            </div>

            {canAdmin && (
              <div className="p-4 pb-0">
                <div className="bg-white border border-gray-100 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <UserPlus size={15} className="text-blue-600" />
                    <p className="text-[12px] font-black text-gray-900">Invite friends</p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={inviteSearch}
                      onChange={e => setInviteSearch(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && searchInvitees()}
                      placeholder="Search profile name…"
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none focus:ring-2 focus:ring-blue-400/30"
                    />
                    <button onClick={searchInvitees} disabled={inviteLoading || !inviteSearch.trim()} className="px-3 rounded-xl bg-blue-600 text-white text-[11px] font-black disabled:opacity-40">
                      {inviteLoading ? <Loader2 size={13} className="animate-spin" /> : "Search"}
                    </button>
                  </div>
                  {inviteResults.length > 0 && (
                    <div className="mt-3 divide-y divide-gray-100">
                      {inviteResults.map(person => (
                        <div key={person.id} className="flex items-center gap-2 py-2">
                          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-black overflow-hidden">
                            {person.avatar_url ? <img src={person.avatar_url} className="w-full h-full object-cover" alt="" /> : (person.full_name || "U")[0]}
                          </div>
                          <p className="flex-1 text-[12px] font-bold text-gray-800 truncate">{person.full_name || "Member"}</p>
                          <button onClick={() => sendInvite(person)} className="text-[10px] font-black bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-xl">
                            Invite
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Share to invite */}
            <div className="p-4">
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                <p className="text-[12px] font-black text-blue-800 mb-2">Invite more members</p>
                <p className="text-[11px] text-blue-600 mb-3">Share this Circle so others can join</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => shareOnWhatsApp(selectedGroup)}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-green-500 text-white py-2.5 rounded-xl text-[12px] font-black active:scale-95 transition-transform"
                  >
                    <Share2 size={13} /> WhatsApp
                  </button>
                  <button
                    onClick={() => shareCircle(selectedGroup)}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 text-white py-2.5 rounded-xl text-[12px] font-black active:scale-95 transition-transform"
                  >
                    <Share2 size={13} /> Copy Link
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Close post menu on outside tap */}
        {postMenuId && <div className="fixed inset-0 z-40" onClick={() => setPostMenuId(null)} />}

        {/* Comment Drawer */}
        <AnimatePresence>
          {commentPostId && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[300] flex items-end justify-center bg-black/50 backdrop-blur-sm"
              onClick={() => { setCommentPostId(null); setPostComments([]); if (commentSubRef.current) { supabase.removeChannel(commentSubRef.current); commentSubRef.current = null; } }}>
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
                className="w-full max-w-lg bg-white rounded-t-3xl max-h-[75vh] flex flex-col"
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <h3 className="font-black text-gray-900 text-base flex items-center gap-2"><MessageCircle size={17} className="text-blue-600" /> Comments</h3>
                  <button onClick={() => setCommentPostId(null)} className="p-1.5 rounded-full bg-gray-100"><X size={18} className="text-gray-500" /></button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                  {commentLoading ? (
                    <div className="flex justify-center py-8"><Loader2 size={22} className="animate-spin text-blue-500" /></div>
                  ) : postComments.length === 0 ? (
                    <div className="text-center py-10 text-gray-300">
                      <MessageCircle size={30} className="mx-auto mb-2 opacity-50" />
                      <p className="text-xs font-black uppercase tracking-widest">No comments yet</p>
                    </div>
                  ) : postComments.map(comment => (
                    <div key={comment.id} className="flex gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-xs overflow-hidden shrink-0">
                        {comment.author_avatar ? <img src={comment.author_avatar} className="w-full h-full object-cover" alt="" /> : (comment.author_name || "M")[0]}
                      </div>
                      <div className="bg-gray-100 rounded-2xl px-3 py-2 flex-1">
                        <p className="text-[11px] font-black text-gray-900">{comment.author_name}</p>
                        <p className="text-[13px] text-gray-700 leading-snug">{comment.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {groupPosts.find(p => p.id === commentPostId)?.comments_muted ? (
                  <div className="px-4 py-4 border-t border-gray-100 text-center text-[12px] font-black text-amber-700 bg-amber-50">
                    Comments are muted for this post.
                  </div>
                ) : (
                  <div className="px-3 py-3 border-t border-gray-100 flex items-center gap-2">
                    <input
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendComment())}
                      placeholder="Write a comment…"
                      className="flex-1 bg-gray-100 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm outline-none"
                    />
                    <button onClick={sendComment} disabled={!commentText.trim() || commenting} className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center disabled:opacity-40">
                      {commenting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                    </button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edit Post Modal */}
        <AnimatePresence>
          {editingPost && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[300] flex items-end justify-center bg-black/50 backdrop-blur-sm"
              onClick={() => setEditingPost(null)}>
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
                className="w-full max-w-lg bg-white rounded-t-3xl p-5 pb-10"
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-black text-gray-800 text-base flex items-center gap-2"><Pencil size={16} className="text-blue-600" /> Post Edit Karo</h3>
                  <button onClick={() => setEditingPost(null)} className="p-1.5 rounded-full bg-gray-100"><X size={18} className="text-gray-500" /></button>
                </div>
                <textarea value={editPostText} onChange={e => setEditPostText(e.target.value)} rows={4}
                  className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-400/30 resize-none mb-4" />
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
        </AnimatePresence>

        {/* Confirm Delete Post */}
        <AnimatePresence>
          {confirmDeletePost && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[300] flex items-center justify-center px-6 bg-black/50 backdrop-blur-sm"
              onClick={() => setConfirmDeletePost(null)}>
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl"
                onClick={e => e.stopPropagation()}>
                <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
                  <Trash2 size={22} className="text-red-500" />
                </div>
                <p className="text-gray-900 font-black text-center text-base mb-1">Post Delete Karo?</p>
                <p className="text-gray-400 text-center text-[12px] mb-5">Yeh post hamesha ke liye delete ho jayegi.</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDeletePost(null)} className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-600 font-black text-sm">Cancel</button>
                  <button onClick={() => deleteGroupPost(confirmDeletePost)} className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-black text-sm">Delete</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edit Group Modal */}
        <AnimatePresence>
          {showEditGroup && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[300] flex items-end justify-center bg-black/50 backdrop-blur-sm"
              onClick={() => setShowEditGroup(false)}>
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
                className="w-full max-w-lg bg-white rounded-t-3xl p-6 pb-10"
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-gray-900 font-black text-lg flex items-center gap-2"><Pencil size={18} className="text-blue-600" /> Circle Edit Karo</h3>
                  <button onClick={() => setShowEditGroup(false)} className="p-1.5 rounded-full bg-gray-100"><X size={18} className="text-gray-500" /></button>
                </div>

                {/* Cover picker */}
                <div className="mb-4">
                  <p className="text-[11px] font-black text-gray-500 uppercase tracking-wide mb-1.5">Cover Photo</p>
                  <div className="relative w-full aspect-[3/1] rounded-2xl overflow-hidden bg-gray-100 border-2 border-dashed border-gray-200 cursor-pointer"
                    onClick={() => coverInputRef.current?.click()}
                    style={{ background: editGroupCoverPrev ? undefined : (selectedGroup ? gradFor(selectedGroup.id) : "#e5e7eb") }}>
                    {editGroupCoverPrev
                      ? <img src={editGroupCoverPrev} className="w-full h-full object-cover" alt="" />
                      : <div className="absolute inset-0 flex items-center justify-center text-white/60 text-sm font-black">Change Cover</div>}
                    <div className="absolute bottom-2 right-2 bg-black/50 rounded-full p-1.5"><Camera size={14} className="text-white" /></div>
                  </div>
                  <input ref={coverInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) { setEditGroupCoverFile(f); setEditGroupCoverPrev(URL.createObjectURL(f)); } e.target.value = ""; }} />
                </div>

                <label className="block text-[11px] font-black text-gray-500 uppercase tracking-wide mb-1.5">Circle Name *</label>
                <input value={editGroupForm.name} onChange={e => setEditGroupForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-none mb-4 focus:ring-2 focus:ring-blue-400/30" />

                <label className="block text-[11px] font-black text-gray-500 uppercase tracking-wide mb-1.5">Description</label>
                <textarea value={editGroupForm.description} onChange={e => setEditGroupForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Circle ke baare mein batao…" rows={3}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-none resize-none mb-5 focus:ring-2 focus:ring-blue-400/30" />

                <button onClick={saveEditGroup} disabled={editGroupSaving || !editGroupForm.name.trim()}
                  className="w-full py-4 rounded-2xl bg-blue-600 text-white font-black text-sm disabled:opacity-40 active:scale-[0.98] transition-transform flex items-center justify-center gap-2">
                  {editGroupSaving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <><Check size={16} /> Save Changes</>}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Confirm Delete Circle */}
        <AnimatePresence>
          {confirmDeleteGroup && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[300] flex items-center justify-center px-6 bg-black/50 backdrop-blur-sm"
              onClick={() => setConfirmDeleteGroup(false)}>
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl"
                onClick={e => e.stopPropagation()}>
                <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
                  <Trash2 size={22} className="text-red-500" />
                </div>
                <p className="text-gray-900 font-black text-center text-base mb-1">Circle Delete Karo?</p>
                <p className="text-gray-400 text-center text-[12px] mb-5">Yeh circle, iske posts, aur saare messages hamesha ke liye delete ho jayenge.</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDeleteGroup(false)} className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-600 font-black text-sm">Cancel</button>
                  <button onClick={deleteGroup} disabled={deletingGroup}
                    className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-40">
                    {deletingGroup ? <Loader2 size={16} className="animate-spin" /> : null}
                    {deletingGroup ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

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
          {/* Pending Invites */}
          {myInvites.length > 0 && (
            <div className="bg-blue-50 border-b border-blue-100 px-4 py-3">
              <p className="text-[12px] font-black text-blue-900 mb-2">Circle Invites</p>
              <div className="space-y-2">
                {myInvites.map(invite => (
                  <div key={invite.id} className="bg-white border border-blue-100 rounded-2xl p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-blue-600 shrink-0" style={{ background: invite.circles?.cover_url ? undefined : gradFor(invite.circle_id) }}>
                      {invite.circles?.cover_url && <img src={invite.circles.cover_url} className="w-full h-full object-cover" alt="" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-black text-gray-900 truncate">{invite.circles?.name || "Circle"}</p>
                      <p className="text-[10px] text-gray-500">You were invited to join</p>
                    </div>
                    <button onClick={() => respondToInvite(invite, "rejected")} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                      <X size={14} className="text-gray-500" />
                    </button>
                    <button onClick={() => respondToInvite(invite, "accepted")} className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center">
                      <Check size={14} className="text-white" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* My Circles */}
          {myGroups.length > 0 && (
            <div className="bg-white border-b border-gray-100 py-3">
              <p className="text-[12px] font-black text-gray-700 px-4 mb-2">My Circles</p>
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
          <div className="px-3 py-3">
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
                    justJoined={justJoinedIds.has(g.id)}
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
