import { useState, useEffect, useRef, useCallback, memo } from "react";
import { supabase } from "../lib/supabaseClient";
import { smartTime } from "../lib/timeAgo";
import { useOnlineUsers } from "../context/OnlineUsersContext";
import { memGet, memSet } from "../lib/memCache";
import { useProfileViewer } from "../context/ProfileViewerContext";
import { useDataCache } from "../context/DataCacheContext";
import { usePageVisibility } from "../hooks/usePageVisibility";
import { subscribeWhileVisible } from "../lib/realtimeVisibility";
import { revokeObjectUrl } from "../lib/objectUrl";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { MagnetButton } from "./MagnetSystem";
import { maskProfanity, sanitizeText } from "../lib/profanityFilter";
import {
  Plus, Users, Lock, Globe, ChevronLeft, Settings, Send,
  Heart, Camera, Shield, X, Check, ImageIcon, Loader2, Trash2,
  Share2, MessageCircle, FileText, Bell, MoreVertical, MoreHorizontal, Pencil,
  UserPlus, UserMinus, Crown, ShieldCheck, Ban, Eye, LogOut, Pin,
  Megaphone, Calendar, MapPin, Clock, CalendarPlus, ChevronRight,
  Reply, ImageIcon as ImagePlus, Video as VideoIcon,
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
  pinned_announcement?: string | null;
  pinned_at?: string | null;
  profiles?: { avatar_url: string | null; full_name: string | null } | null;
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
  is_hidden?: boolean;
  hidden_by_name?: string | null;
  hidden_by_id?: string | null;
}

interface CircleEvent {
  id: string;
  circle_id: string;
  created_by: string;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string | null;
  location: string | null;
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
  media_url?: string | null;
  reply_to_id?: string | null;
  created_at: string;
}

interface ChatReaction {
  emoji: string;
  count: number;
  mine: boolean;
}


// ── Group Card ─────────────────────────────────────────────────────────────────
const GroupCard = ({
  group, isMember, onJoin, onLeave, onClick, justJoined,
}: {
  group: Group; isMember: boolean; onJoin: () => void; onLeave?: () => void; onClick: () => void; justJoined?: boolean;
}) => (
  <div
    className="bg-[#d4f0e2] rounded-xl overflow-hidden flex flex-col"
    style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}
  >
    <div
      className="w-full aspect-square cursor-pointer"
      style={{
        backgroundImage: group.cover_url ? `url('${group.cover_url}')` : "none",
        backgroundColor: group.cover_url ? "transparent" : "#f3f4f6",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      onClick={onClick}
    />
    <div className="p-2 flex flex-col gap-1.5">
      <p className="text-[12px] font-black text-gray-900 truncate leading-tight">{group.name}</p>
      <div className="flex items-center gap-1 text-gray-400">
        {group.privacy === "private" ? <Lock size={9} /> : <Globe size={9} />}
        <span className="text-[9px] font-semibold">{group.member_count ?? 0} members</span>
      </div>
      {isMember || justJoined ? (
        <div className="flex gap-1">
          <button
            onClick={onClick}
            className="flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all active:scale-95 bg-green-50 text-green-700 border border-green-200"
          >
            {justJoined ? "✓ Joined!" : "View"}
          </button>
          {!justJoined && onLeave && (
            <button
              onClick={e => { e.stopPropagation(); onLeave(); }}
              className="py-1.5 px-2 rounded-lg text-[10px] font-black transition-all active:scale-95 bg-white border-2 border-red-400 text-red-500"
            >
              Leave
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={onJoin}
          className="w-full py-1.5 rounded-lg text-[10px] font-black transition-all active:scale-95 bg-blue-600 text-white"
        >
          Join
        </button>
      )}
    </div>
  </div>
);

// ── Module-level helpers (no component state needed) ───────────────────────────
const haptic = (ms = 8) => { try { navigator.vibrate?.(ms); } catch (_) {} };
const isVideoUrl = (url: string) => /\.(mp4|webm|ogg|mov|m4v)/i.test(url.split("?")[0]);

function CirclePostVideo({ url }: { url: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);
  const pageVisible = usePageVisibility();

  useEffect(() => {
    const video = videoRef.current;
    if (!video || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.35 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (inView && pageVisible) {
      void video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [inView, pageVisible]);

  return (
    <video
      ref={videoRef}
      src={url}
      muted
      playsInline
      loop
      controls
      preload="metadata"
      className="w-full object-contain"
      style={{ maxHeight: "60vh" }}
    />
  );
}

// ── Memoized Post Card ─────────────────────────────────────────────────────────
interface PostCardProps {
  post: GroupPost;
  currentUserId: string | null;
  canModerate: boolean;
  canAdmin: boolean;
  likedPostIds: Set<string>;
  likingPostIds: Set<string>;
  viewCounts: Record<string, number>;
  groupOwnerId: string;
  latestComment?: CircleComment | null;
  onLike: (post: GroupPost) => void;
  onComment: (post: GroupPost) => void;
  onShare: (post: GroupPost) => void;
  onOptions: (post: GroupPost) => void;
  onReview: (postId: string, status: "approved" | "rejected") => void;
  onViewers: (postId: string) => void;
}

function OnlineDot({ authorId }: { authorId: string }) {
  const onlineIds = useOnlineUsers();
  if (!onlineIds.has(authorId)) return null;
  return (
    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 z-10"
      style={{ background: "#00F0FF", borderColor: "#090a0f", boxShadow: "0 0 6px #00F0FF" }} />
  );
}

const CirclePostCard = memo(({
  post, currentUserId, canModerate, canAdmin,
  likedPostIds, likingPostIds, viewCounts, groupOwnerId, latestComment,
  onLike, onComment, onShare, onOptions, onReview, onViewers,
}: PostCardProps) => {
  const canEdit = post.author_id === currentUserId || canModerate;
  return (
    <div className="mx-3 mb-3 rounded-3xl overflow-hidden border border-white/[0.08]"
      style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(20px)", boxShadow: "0 8px 32px rgba(0,0,0,0.45)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-white font-black text-sm"
          style={{ boxShadow: "0 0 0 2px rgba(0,240,255,0.35), 0 0 12px rgba(0,240,255,0.15)", background: "linear-gradient(135deg,#1e3a8a,#2563eb)" }}>
          {post.author_avatar
            ? <img src={post.author_avatar} className="w-full h-full object-cover" alt="" loading="lazy" decoding="async"/>
            : (post.author_name || "M")[0].toUpperCase()}
          <OnlineDot authorId={post.author_id} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-white font-bold text-sm leading-none">{post.author_name}</p>
            {post.author_id === groupOwnerId && (
              <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full"
                style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#000" }}>👑</span>
            )}
            {post.status === "pending" && (
              <span className="text-[8px] font-black text-amber-300 px-1.5 py-0.5 rounded-full border border-amber-500/30"
                style={{ background: "rgba(245,158,11,0.15)" }}>PENDING</span>
            )}
          </div>
          <p className="text-[10px] text-gray-500 mt-0.5">{smartTime(post.created_at)}</p>
        </div>
        {canEdit && (
          <button onClick={() => { haptic(); onOptions(post); }} className="p-2 rounded-full text-gray-600 active:bg-white/10 transition-colors">
            <MoreVertical size={16} />
          </button>
        )}
      </div>

      {post.content && <p className="px-4 pb-3 text-[13px] text-gray-300 leading-relaxed">{maskProfanity(post.content)}</p>}

      {post.media_url && (
        <div className="w-full" style={{ background: "rgba(0,0,0,0.4)" }}>
          {isVideoUrl(post.media_url) ? (
            <CirclePostVideo url={post.media_url} />
          ) : (
            <img src={post.media_url} className="w-full object-cover" style={{ maxHeight: "60vh" }} loading="lazy" alt="" decoding="async"/>
          )}
        </div>
      )}

      {post.status === "pending" && (
        post.author_id === currentUserId && !canModerate ? (
          <div className="mx-4 mb-2 flex items-center gap-2 px-3 py-2.5 rounded-xl border border-amber-500/20"
            style={{ background: "rgba(245,158,11,0.08)" }}>
            <Clock size={12} className="text-amber-400 shrink-0 animate-pulse" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-black text-amber-300">Awaiting admin review</p>
              <p className="text-[10px] text-amber-500/70 mt-0.5">Only you can see this until approved</p>
            </div>
          </div>
        ) : canModerate ? (
          <div className="mx-4 mb-2 flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-amber-500/20"
            style={{ background: "rgba(245,158,11,0.08)" }}>
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={12} className="text-amber-400 shrink-0" />
              <span className="text-[11px] font-black text-amber-300">Pending approval</span>
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => { haptic(); onReview(post.id, "rejected"); }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-red-400 font-black text-[10px] border border-red-500/30 active:scale-95 transition-transform"
                style={{ background: "rgba(239,68,68,0.1)" }}>
                <X size={11} /> Reject
              </button>
              <button onClick={() => { haptic(); onReview(post.id, "approved"); }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-green-300 font-black text-[10px] border border-green-500/30 active:scale-95 transition-transform"
                style={{ background: "rgba(34,197,94,0.12)" }}>
                <Check size={11} /> Approve
              </button>
            </div>
          </div>
        ) : null
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 px-4 py-3 border-t border-white/[0.06]">
        <button
          onClick={() => { haptic(); onLike(post); }}
          disabled={likingPostIds.has(post.id)}
          aria-label={likedPostIds.has(post.id) ? "Unlike post" : "Like post"}
          className="flex items-center gap-1.5 active:scale-90 transition-transform disabled:opacity-60"
        >
          <Heart size={19} className={likedPostIds.has(post.id) ? "fill-red-500 text-red-500" : "text-gray-600"} />
          <span className="text-xs font-bold text-gray-500">{post.likes_count || 0}</span>
        </button>
        <button onClick={() => onComment(post)} className="flex items-center gap-1.5 active:scale-90 transition-transform">
          <MessageCircle size={19} className={post.comments_muted ? "text-amber-500" : "text-gray-600"} />
          <span className="text-xs font-bold text-gray-500">{post.comments_count || 0}</span>
        </button>
        <button onClick={() => onShare(post)} className="flex items-center gap-1.5 active:scale-90 transition-transform">
          <Share2 size={18} className="text-gray-600" />
          <span className="text-xs font-bold text-gray-500">{post.shares_count || 0}</span>
        </button>
        <MagnetButton
          postId={post.id}
          postType="circle"
          postOwnerId={groupOwnerId}
          currentUserId={currentUserId}
          dark={true}
        />
        {post.status !== "pending" && (
          <button
            onClick={() => { if (canAdmin) { haptic(); onViewers(post.id); } }}
            className={`flex items-center gap-1 ml-auto ${canAdmin ? "active:scale-90 transition-transform" : ""}`}
          >
            <Eye size={15} className="text-gray-700" />
            <span className="text-[11px] font-bold text-gray-700">{viewCounts[post.id] ?? 0}</span>
          </button>
        )}
      </div>

      {/* Latest comment preview */}
      {(() => {
        const totalCount = post.comments_count || 0;
        if (!latestComment && totalCount === 0) return null;
        return (
          <div className="px-4 pb-3 pt-0.5 cursor-pointer" onClick={() => onComment(post)}>
            {totalCount > 1 && (
              <p className="text-[11px] text-gray-600 font-medium mb-1.5">
                View {totalCount - 1} more comment{totalCount - 1 > 1 ? "s" : ""}...
              </p>
            )}
            {latestComment && (
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-[9px] font-black text-[#00F0FF]"
                  style={{ background: "rgba(0,240,255,0.1)", border: "1px solid rgba(0,240,255,0.2)" }}>
                  {latestComment.author_avatar
                    ? <img src={latestComment.author_avatar} className="w-full h-full object-cover" alt="" loading="lazy" decoding="async"/>
                    : (latestComment.author_name || "M")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0 rounded-2xl px-3 py-1.5" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <span className="text-[#00F0FF] text-[11px] font-black">{latestComment.author_name}</span>
                  <span className="text-[12px] text-gray-400 ml-1.5 leading-snug">
                    {latestComment.content.length > 90 ? latestComment.content.slice(0, 90) + "…" : latestComment.content}
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}, (prev, next) =>
  prev.post === next.post &&
  prev.likedPostIds.has(prev.post.id) === next.likedPostIds.has(next.post.id) &&
  prev.likingPostIds.has(prev.post.id) === next.likingPostIds.has(next.post.id) &&
  prev.viewCounts[prev.post.id] === next.viewCounts[next.post.id] &&
  prev.canModerate === next.canModerate &&
  prev.canAdmin === next.canAdmin
);

// ── Main Component ─────────────────────────────────────────────────────────────
interface Props {
  userProfile: any;
  currentUserId: string | null;
}

type GroupTab = "posts" | "review" | "chat" | "members" | "about";
type MemberRole = "admin" | "moderator" | "member";

export default function CirclePage({ userProfile, currentUserId }: Props) {
  const { openProfile } = useProfileViewer();
  const dataCache = useDataCache();
  const isPageVisible = usePageVisibility();
  const cachedGroups = dataCache.cacheRef.current.circleList;
  const [view, setView] = useState<"dashboard" | "group">("dashboard");
  const [groups, setGroups] = useState<Group[]>(() => cachedGroups?.data ?? []);
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
  const [loading, setLoading] = useState(() => !cachedGroups?.data);
  const [membersLoading, setMembersLoading] = useState(false);
  const [postsLoading, setPostsLoading] = useState(false);
  const [myInvites, setMyInvites] = useState<CircleInvite[]>([]);
  const [newInviteCount, setNewInviteCount] = useState(0);
  const inviteSubRef = useRef<(() => void) | null>(null);

  // Create group form
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", privacy: "public" as "public" | "private" });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    return () => revokeObjectUrl(coverPreview);
  }, [coverPreview]);

  // Group settings (admin)
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ rules: "", post_approval: false });
  const [savingSettings, setSavingSettings] = useState(false);

  // Post in group
  const [postText, setPostText] = useState("");
  const [postMedia, setPostMedia] = useState<File | null>(null);
  const [postMediaPreview, setPostMediaPreview] = useState<string | null>(null);
  const postMediaPreviewRef = useRef<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [postComments, setPostComments] = useState<CircleComment[]>([]);
  const [latestCircleComments, setLatestCircleComments] = useState<Record<string, CircleComment | null>>({});
  const [likingPostIds, setLikingPostIds] = useState<Set<string>>(new Set());
  const [circleCommentAction, setCircleCommentAction] = useState<{ comment: CircleComment; postId: string; x: number; y: number } | null>(null);
  const [editingCircleComment, setEditingCircleComment] = useState<{ id: string; text: string } | null>(null);
  const longPressCommentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressCommentPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [commentText, setCommentText] = useState("");
  const [commenting, setCommenting] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteResults, setInviteResults] = useState<any[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);

  useEffect(() => {
    if (postMediaPreviewRef.current) {
      URL.revokeObjectURL(postMediaPreviewRef.current);
      postMediaPreviewRef.current = null;
    }
    if (!postMedia) {
      setPostMediaPreview(null);
      return;
    }
    const previewUrl = URL.createObjectURL(postMedia);
    postMediaPreviewRef.current = previewUrl;
    setPostMediaPreview(previewUrl);
    return () => {
      URL.revokeObjectURL(previewUrl);
      if (postMediaPreviewRef.current === previewUrl) {
        postMediaPreviewRef.current = null;
      }
    };
  }, [postMedia]);

  // Chat
  const [chatMessages, setChatMessages] = useState<GroupMessage[]>([]);
  const [chatText, setChatText] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [chatLoaded, setChatLoaded] = useState(false);
  const [chatInputFocused, setChatInputFocused] = useState(false);
  const [commentInputFocused, setCommentInputFocused] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatSubRef = useRef<any>(null);
  const memberSubRef = useRef<any>(null);
  const postSubRef = useRef<any>(null);
  const commentSubRef = useRef<(() => void) | null>(null);
  const postSubCleanupRef = useRef<(() => void) | null>(null);
  const memberSubCleanupRef = useRef<(() => void) | null>(null);
  const chatSubCleanupRef = useRef<(() => void) | null>(null);
  const selectedGroupIdRef = useRef<string | null>(null);
  const commentRequestRef = useRef(0);
  const commentIdsRef = useRef<Set<string>>(new Set());
  const likingPostIdsRef = useRef<Set<string>>(new Set());
  // Chat reactions
  const [msgReactions, setMsgReactions] = useState<Record<string, ChatReaction[]>>({});
  const [emojiBarMsgId, setEmojiBarMsgId] = useState<string | null>(null);
  // Reply-to
  const [replyTo, setReplyTo] = useState<GroupMessage | null>(null);
  // Media
  const [chatMedia, setChatMedia] = useState<File | null>(null);
  const [chatMediaPreview, setChatMediaPreview] = useState<string | null>(null);
  const [uploadingChatMedia, setUploadingChatMedia] = useState(false);
  const chatMediaRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => revokeObjectUrl(chatMediaPreview);
  }, [chatMediaPreview]);

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

  useEffect(() => {
    return () => revokeObjectUrl(editGroupCoverPrev);
  }, [editGroupCoverPrev]);

  // Circle Events
  const [circleEvents, setCircleEvents]       = useState<CircleEvent[]>([]);
  const [eventRsvpCounts, setEventRsvpCounts] = useState<Record<string, { going: number; maybe: number; not_going: number }>>({});
  const [myRsvps, setMyRsvps]                 = useState<Record<string, string>>({});
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [eventForm, setEventForm]             = useState({ title: "", description: "", event_date: "", event_time: "", location: "" });
  const [savingEvent, setSavingEvent]         = useState(false);
  const [rsvpLoading, setRsvpLoading]         = useState<string | null>(null);

  // Pinned Announcement
  const [pinnedEditing, setPinnedEditing] = useState(false);
  const [pinnedText, setPinnedText]       = useState("");
  const [savingPin, setSavingPin]         = useState(false);

  // About tab — inline rules editing
  const [rulesEditing, setRulesEditing]   = useState(false);
  const [rulesText, setRulesText]         = useState("");
  const [savingRules, setSavingRules]     = useState(false);

  const savePinnedAnnouncement = async (text: string | null) => {
    if (!selectedGroup || !canAdmin) return;
    setSavingPin(true);
    const { error } = await supabase
      .from("circles")
      .update({ pinned_announcement: text || null, pinned_at: text ? new Date().toISOString() : null })
      .eq("id", selectedGroup.id);
    if (error) { toast.error("Failed to save announcement."); setSavingPin(false); return; }
    setSelectedGroup(prev => prev ? { ...prev, pinned_announcement: text || null, pinned_at: text ? new Date().toISOString() : null } : prev);
    setGroups(prev => prev.map(g => g.id === selectedGroup.id ? { ...g, pinned_announcement: text || null } : g));
    setPinnedEditing(false);
    setSavingPin(false);
    toast.success(text ? "📌 Announcement pinned!" : "Announcement removed.");
  };

  const saveRulesInline = async () => {
    if (!selectedGroup || !canAdmin) return;
    setSavingRules(true);
    const { error } = await supabase
      .from("circles")
      .update({ rules: rulesText.trim() || null })
      .eq("id", selectedGroup.id);
    setSavingRules(false);
    if (error) { toast.error("Failed to save rules."); return; }
    setSelectedGroup(prev => prev ? { ...prev, rules: rulesText.trim() || null } : prev);
    setGroups(prev => prev.map(g => g.id === selectedGroup.id ? { ...g, rules: rulesText.trim() || null } : g));
    setRulesEditing(false);
    toast.success("📋 Group rules updated!");
  };

  // Post options bottom sheet
  const [postSheet, setPostSheet] = useState<GroupPost | null>(null);
  // Member management bottom sheet
  const [memberSheet, setMemberSheet] = useState<any | null>(null);
  // Pull-to-refresh
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const pullStartY = useRef(0);
  const pullDelta = useRef(0);
  const postsScrollRef = useRef<HTMLDivElement>(null);
  // Menu dropdown
  const [showMenuDropdown, setShowMenuDropdown] = useState(false);
  // Description expand
  const [descExpanded, setDescExpanded] = useState(false);

  // Post Reach (views)
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [viewersPostId, setViewersPostId] = useState<string | null>(null);
  const [viewersList, setViewersList] = useState<any[]>([]);
  const [viewersLoading, setViewersLoading] = useState(false);
  const viewedInSession = useRef<Set<string>>(new Set());

  const canModerate = currentRole === "admin" || currentRole === "moderator";
  const canAdmin = currentRole === "admin";

  // Original circle creator — has supreme authority over all members including other admins
  const isCreator = selectedGroup?.created_by === currentUserId;

  const canManageMember = (member: any) => {
    if (!currentUserId || member.user_id === currentUserId) return false;
    // The original creator can NEVER be managed by anyone
    if (member.user_id === selectedGroup?.created_by) return false;
    // Original creator can manage everyone else (including other admins)
    if (isCreator) return true;
    // Other admins: can manage moderators and regular members only (not other admins)
    if (currentRole === "admin") return member.role !== "admin";
    // Moderators: can only manage plain members (not other moderators or admins)
    if (currentRole === "moderator") return member.role === "member";
    return false;
  };

  const fetchCirclePosts = useCallback(async (circleId: string, reviewer = canModerate) => {
    if (!isPageVisible) return;
    setPostsLoading(true);
    let query = supabase
      .from("circle_posts")
      .select("id, circle_id, author_id, author_name, author_avatar, content, media_url, created_at, likes_count, comments_count, shares_count, status, comments_muted")
      .eq("circle_id", circleId)
      .order("created_at", { ascending: false })
      .limit(50);

    // Reviewers (admin/mod) see all posts; regular members see approved + their own pending
    if (reviewer) {
      query = query.in("status", ["approved", "pending"]);
    } else if (currentUserId) {
      query = query.or(`status.eq.approved,and(status.eq.pending,author_id.eq.${currentUserId})`);
    } else {
      query = query.eq("status", "approved");
    }
    const { data, error } = await query;
    if (error) {
      toast.error("Circle posts are unavailable. Please run the circle_posts setup SQL.");
      setGroupPosts([]);
      setPendingPosts([]);
      setPostsLoading(false);
      return;
    }
    if (selectedGroupIdRef.current && selectedGroupIdRef.current !== circleId) {
      setPostsLoading(false);
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
      const { data: likedRows, error: likesErr } = await supabase
        .from("circle_post_likes")
        .select("post_id")
        .eq("user_id", currentUserId)
        .in("post_id", rows.map(post => post.id));
      if (likesErr) {
        // Fetch failed — leave existing likedPostIds untouched so UI doesn't wipe state
        console.warn("[CirclePage] circle_post_likes fetch failed:", likesErr.message);
      } else {
        setLikedPostIds(new Set((likedRows ?? []).map((row: any) => row.post_id)));
      }
    } else if (!currentUserId) {
      // Only clear if genuinely logged out
      setLikedPostIds(new Set());
    }
    // All rows are already filtered correctly by the query above
    setGroupPosts(rows);
    const pending = reviewer ? rows.filter(post => post.status === "pending") : [];
    setPendingPosts(pending);
    setPostsLoading(false);
    dataCache.setCirclePosts(circleId, { data: rows, fetchedAt: Date.now() });
    dataCache.setCirclePending(circleId, { data: pending, fetchedAt: Date.now() });

    // Fetch latest comment preview for each post (FB-style single comment below card)
    if (rows.length > 0) {
      const ids = rows.map(p => p.id);
      supabase
        .from("circle_post_comments")
        .select("id, post_id, author_id, author_name, author_avatar, content, created_at")
        .in("post_id", ids)
        .order("created_at", { ascending: false })
        .limit(100)
        .then(({ data }) => {
          if (!data || selectedGroupIdRef.current !== circleId) return;
          const map: Record<string, CircleComment | null> = {};
          for (const row of data as CircleComment[]) {
            if (!map[row.post_id]) map[row.post_id] = row;
          }
          setLatestCircleComments(prev => {
            const next = { ...prev, ...map };
            return Object.fromEntries(
              Object.entries(next).filter(([postId]) => ids.includes(postId)).slice(-50),
            );
          });
        });
    }

    // ── Post Reach: record views + fetch counts ───────────────────────────────
    if (currentUserId && rows.length > 0) {
      const approvedIds = rows.filter(p => p.status === "approved").map(p => p.id);
      const newlyViewed = approvedIds.filter(id => !viewedInSession.current.has(id));
      if (newlyViewed.length > 0) {
        newlyViewed.forEach(id => viewedInSession.current.add(id));
        // Await upsert so the current user's view is committed before we fetch counts
        await supabase.from("circle_post_views")
          .upsert(newlyViewed.map(id => ({ post_id: id, viewer_id: currentUserId })), { onConflict: "post_id,viewer_id" });
      }
      // Now fetch view counts — includes the rows we just upserted
      const { data: viewRows } = await supabase
        .from("circle_post_views")
        .select("post_id")
        .in("post_id", rows.map(p => p.id))
        .limit(500);
      if (viewRows) {
        const counts: Record<string, number> = {};
        for (const row of viewRows as any[]) counts[row.post_id] = (counts[row.post_id] || 0) + 1;
        setViewCounts(counts);
      }
    }
  }, [canModerate, currentUserId, isPageVisible]);

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
    // Serve from cache instantly if still fresh (5-min TTL)
    const cKey = "circleGroups";
    const hit = memGet<Group[]>(cKey);
    if (hit) { setGroups(hit); setLoading(false); return; }

    // Step 1 — fetch circles without relational join (avoids PostgREST FK dependency)
    const { data, error } = await supabase
      .from("circles")
      .select("id, name, description, cover_url, privacy, member_count, created_by, admin_id, created_at, rules, post_approval, pinned_announcement, pinned_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      toast.error("Circles table not available.");
      setLoading(false);
      return;
    }
    if (data) {
      let groupsData = data as Group[];
      const ids = groupsData.map(g => g.id);
      if (ids.length > 0) {
        // Step 2 — real member counts from circle_members
        const { data: memberRows } = await supabase
          .from("circle_members")
          .select("circle_id")
          .in("circle_id", ids)
          .limit(1000);
        if (memberRows) {
          const counts: Record<string, number> = {};
          for (const row of memberRows as any[]) {
            counts[row.circle_id] = (counts[row.circle_id] || 0) + 1;
          }
          groupsData = groupsData.map(g => ({ ...g, member_count: counts[g.id] ?? 0 }));
        }
        // Step 3 — manually fetch creator profiles and merge (no FK join needed)
        const adminIds = [...new Set(groupsData.map(g => g.admin_id).filter(Boolean))] as string[];
        if (adminIds.length > 0) {
          const { data: profileRows } = await supabase
            .from("profiles")
            .select("id, avatar_url, full_name")
            .in("id", adminIds);
          if (profileRows) {
            const pm: Record<string, { avatar_url: string | null; full_name: string | null }> = {};
            for (const p of profileRows as any[]) pm[p.id] = { avatar_url: p.avatar_url, full_name: p.full_name };
            groupsData = groupsData.map(g => ({ ...g, profiles: g.admin_id ? (pm[g.admin_id] ?? null) : null }));
          }
        }
      }
      setGroups(groupsData);
      dataCache.setCache("circleList", { data: groupsData, fetchedAt: Date.now() });
      memSet(cKey, groupsData);
    }
    setLoading(false);
  };

  const fetchMyMemberships = async () => {
    if (!currentUserId) return;
    const mKey = `myCircles_${currentUserId}`;
    const hit = memGet<string[]>(mKey);
    if (hit) { setMyGroupIds(new Set(hit)); return; }
    const { data } = await supabase
      .from("circle_members")
      .select("circle_id")
      .eq("user_id", currentUserId)
      .limit(100);
    if (data) {
      const ids = data.map((r: any) => r.circle_id);
      setMyGroupIds(new Set(ids));
      memSet(mKey, ids);
    }
  };

  useEffect(() => {
    fetchGroups();
    fetchMyMemberships();
    fetchMyInvites();
  }, [currentUserId]);

  // ── Invite notification chime (Web Audio API, zero deps) ─────────────────────
  const playInviteChime = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      // Two-note ascending chime: G5 → B5
      const notes = [784, 988];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.15);
        gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + i * 0.15 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.35);
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 0.35);
      });
    } catch (_) {}
  };

  // ── Realtime subscription for incoming Circle invites ────────────────────────
  useEffect(() => {
    if (!currentUserId) return;
    inviteSubRef.current?.();
    const cleanup = subscribeWhileVisible(
      () => supabase
        .channel(`circle-invites-${currentUserId}`)
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "circle_invites",
          filter: `invitee_id=eq.${currentUserId}`,
        }, async () => {
          await fetchMyInvites();
          setNewInviteCount(c => c + 1);
          playInviteChime();
          haptic(18);
          toast("📨 You have a new Circle invite!", {
            duration: 4000,
            action: { label: "View", onClick: () => setView("dashboard") },
          });
        })
        .subscribe(),
      { onVisible: () => void fetchMyInvites() },
    );
    inviteSubRef.current = cleanup;
    return () => {
      cleanup();
      if (inviteSubRef.current === cleanup) inviteSubRef.current = null;
    };
  }, [currentUserId, fetchMyInvites]);

  // ── Cleanup realtime subscriptions on unmount ────────────────────────────────
  useEffect(() => {
    return () => {
      chatSubCleanupRef.current?.();
      memberSubCleanupRef.current?.();
      postSubCleanupRef.current?.();
      commentSubRef.current?.();
      inviteSubRef.current?.();
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
        const { error: upErr } = await supabase.storage.from("circles").upload(path, coverFile, { upsert: true });
        if (upErr) {
          toast.error(`Cover photo upload failed: ${upErr.message}. Please try again.`);
          setCreating(false);
          return;
        }
        const { data: pub } = supabase.storage.from("circles").getPublicUrl(path);
        cover_url = pub.publicUrl;
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
        // Attach current user's profile so avatar shows immediately without a full refresh
        const { data: myProfile } = await supabase.from("profiles").select("avatar_url, full_name").eq("id", currentUserId).single();
        const createdGroup: Group = {
          ...newGroup,
          member_count: 1,
          profiles: myProfile ? { avatar_url: myProfile.avatar_url, full_name: myProfile.full_name } : null,
        };
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

  // ── Leave Group ───────────────────────────────────────────────────────────────
  const handleLeave = async (groupId: string) => {
    if (!currentUserId) return;
    setMyGroupIds(prev => { const n = new Set(prev); n.delete(groupId); return n; });
    const { error } = await supabase
      .from("circle_members")
      .delete()
      .eq("circle_id", groupId)
      .eq("user_id", currentUserId);
    if (error) {
      setMyGroupIds(prev => new Set([...prev, groupId]));
      toast.error("Could not leave the Circle. Please try again.");
      return;
    }
    const grp = groups.find(g => g.id === groupId);
    if (grp) {
      await supabase
        .from("circles")
        .update({ member_count: Math.max((grp.member_count ?? 1) - 1, 0) })
        .eq("id", groupId);
    }
    if (view === "group") {
      setView("dashboard");
      setSelectedGroup(null);
      selectedGroupIdRef.current = null;
      commentRequestRef.current += 1;
      commentSubRef.current?.();
      commentSubRef.current = null;
      fetchGroups();
    }
    toast.success("You have left the Circle. 👋");
  };

  // ── Circle Events ────────────────────────────────────────────────────────────
  const fetchCircleEvents = async (circleId: string) => {
    if (!isPageVisible) return;
    const { data: events } = await supabase
      .from("circle_events")
      .select("id,circle_id,created_by,title,description,event_date,event_time,location,created_at")
      .eq("circle_id", circleId)
      .order("event_date", { ascending: true })
      .limit(50);
    if (!events || selectedGroupIdRef.current !== circleId) return;
    setCircleEvents(events);
    if (events.length === 0) return;
    const { data: rsvps } = await supabase
      .from("circle_event_rsvps")
      .select("event_id, user_id, status")
        .in("event_id", events.map(e => e.id))
        .limit(500);
    if (selectedGroupIdRef.current !== circleId) return;
    if (rsvps) {
      const counts: Record<string, { going: number; maybe: number; not_going: number }> = {};
      const mine: Record<string, string> = {};
      for (const r of rsvps) {
        if (!counts[r.event_id]) counts[r.event_id] = { going: 0, maybe: 0, not_going: 0 };
        if (r.status === "going")      counts[r.event_id].going++;
        else if (r.status === "maybe") counts[r.event_id].maybe++;
        else                           counts[r.event_id].not_going++;
        if (r.user_id === currentUserId) mine[r.event_id] = r.status;
      }
      setEventRsvpCounts(counts);
      setMyRsvps(mine);
    }
  };

  const createEvent = async () => {
    if (!selectedGroup || !canAdmin || !eventForm.title.trim() || !eventForm.event_date) return;
    setSavingEvent(true);
    const { data, error } = await supabase
      .from("circle_events")
      .insert([{
        circle_id: selectedGroup.id,
        created_by: currentUserId,
        title: eventForm.title.trim(),
        description: eventForm.description.trim() || null,
        event_date: eventForm.event_date,
        event_time: eventForm.event_time || null,
        location: eventForm.location.trim() || null,
      }])
      .select()
      .single();
    setSavingEvent(false);
    if (error) { toast.error("Failed to create event."); return; }
    setCircleEvents(prev => [...prev, data].sort((a, b) => a.event_date.localeCompare(b.event_date)));
    setShowCreateEvent(false);
    setEventForm({ title: "", description: "", event_date: "", event_time: "", location: "" });
    toast.success("🎉 Event created!");
  };

  const deleteEvent = async (eventId: string) => {
    if (!canAdmin) return;
    await supabase.from("circle_events").delete().eq("id", eventId);
    setCircleEvents(prev => prev.filter(e => e.id !== eventId));
    toast.success("Event deleted.");
  };

  const rsvpEvent = async (eventId: string, status: string) => {
    if (!currentUserId) return;
    haptic();
    setRsvpLoading(eventId);
    const current = myRsvps[eventId];
    if (current === status) {
      await supabase.from("circle_event_rsvps").delete().eq("event_id", eventId).eq("user_id", currentUserId);
      setMyRsvps(prev => { const n = { ...prev }; delete n[eventId]; return n; });
      setEventRsvpCounts(prev => {
        const n = { ...prev };
        if (n[eventId]) {
          if (status === "going")      n[eventId] = { ...n[eventId], going:     Math.max(0, n[eventId].going - 1) };
          else if (status === "maybe") n[eventId] = { ...n[eventId], maybe:     Math.max(0, n[eventId].maybe - 1) };
          else                         n[eventId] = { ...n[eventId], not_going: Math.max(0, n[eventId].not_going - 1) };
        }
        return n;
      });
    } else {
      await supabase.from("circle_event_rsvps").upsert({ event_id: eventId, user_id: currentUserId, status }, { onConflict: "event_id,user_id" });
      const old = current;
      setMyRsvps(prev => ({ ...prev, [eventId]: status }));
      setEventRsvpCounts(prev => {
        const n = { ...prev };
        if (!n[eventId]) n[eventId] = { going: 0, maybe: 0, not_going: 0 };
        if (old === "going")      n[eventId] = { ...n[eventId], going:     Math.max(0, n[eventId].going - 1) };
        else if (old === "maybe") n[eventId] = { ...n[eventId], maybe:     Math.max(0, n[eventId].maybe - 1) };
        else if (old === "not_going") n[eventId] = { ...n[eventId], not_going: Math.max(0, n[eventId].not_going - 1) };
        if (status === "going")      n[eventId] = { ...n[eventId], going:     n[eventId].going + 1 };
        else if (status === "maybe") n[eventId] = { ...n[eventId], maybe:     n[eventId].maybe + 1 };
        else                         n[eventId] = { ...n[eventId], not_going: n[eventId].not_going + 1 };
        return n;
      });
    }
    setRsvpLoading(null);
  };

  const formatEventDate = (dateStr: string, timeStr: string | null) => {
    const d = new Date(dateStr + "T00:00:00");
    const date = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
    if (!timeStr) return date;
    const [h, m] = timeStr.split(":");
    const hr = parseInt(h);
    return `${date} · ${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`;
  };

  // ── Share Circle (single unified native share, original media, English) ─────
  const shareCircle = async (group: Group) => {
    const link = `${window.location.origin}?circle=${group.id}`;
    const titleLine = group.name;
    const bodyLine  = (group as any).description
      ? ((group as any).description as string).slice(0, 140)
      : `Join the "${group.name}" circle and connect with the community on Flicks.`;
    const mediaUrl = (group as any).cover_url || (group as any).avatar_url || "";
    try {
      const { universalShare } = await import("../lib/universalShare");
      const result = await universalShare({
        title: titleLine,
        text: `${titleLine}\n${bodyLine}`,
        url: link,
        mediaUrl: mediaUrl || undefined,
        type: "circle",
      });
      if (result === "copied") toast.success("Link copied to clipboard");
    } catch {
      navigator.clipboard.writeText(link).catch(() => {});
      toast.success("Link copied to clipboard");
    }
  };

  // ── Robust member fetch: tries FK join, falls back to separate profiles query ─
  const fetchMembersWithProfiles = async (circleId: string): Promise<any[]> => {
    // Attempt 1: join query via FK
    const { data: joinData, error: joinErr } = await supabase
      .from("circle_members")
      .select("id, circle_id, user_id, role, created_at, profiles(id, full_name, avatar_url)")
      .eq("circle_id", circleId)
      .order("created_at", { ascending: true })
      .limit(500);

    if (joinErr) {
      console.error("[CirclePage] circle_members join error:", joinErr.message, joinErr);
    }

    // If join worked AND at least one row has profile data, use it
    const joinedOk = (joinData ?? []).length > 0 && (joinData ?? []).some((r: any) => r.profiles?.full_name);
    if (joinedOk) return joinData!;

    // Attempt 2: fetch members without join, then batch-fetch profiles separately
    const { data: rawMembers, error: rawErr } = await supabase
      .from("circle_members")
      .select("id, circle_id, user_id, role, created_at")
      .eq("circle_id", circleId)
      .order("created_at", { ascending: true })
      .limit(500);

    if (rawErr) {
      console.error("[CirclePage] circle_members raw error:", rawErr.message, rawErr);
      // Return whatever join gave us (might be empty array but at least not null)
      return joinData ?? [];
    }

    if (!rawMembers || rawMembers.length === 0) return [];

    const userIds = [...new Set((rawMembers as any[]).map((m: any) => m.user_id))];
    const { data: profileRows, error: profErr } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", userIds);

    if (profErr) {
      console.error("[CirclePage] profiles fetch error:", profErr.message, profErr);
    }

    const profileMap: Record<string, any> = {};
    for (const p of (profileRows ?? []) as any[]) profileMap[p.id] = p;

    return (rawMembers as any[]).map((m: any) => ({
      ...m,
      profiles: profileMap[m.user_id] ?? null,
    }));
  };

  // ── Open Group Profile ───────────────────────────────────────────────────────
  const openGroup = async (group: Group) => {
    selectedGroupIdRef.current = group.id;
    commentRequestRef.current += 1;
    postSubCleanupRef.current?.();
    memberSubCleanupRef.current?.();
    postSubCleanupRef.current = null;
    memberSubCleanupRef.current = null;
    postSubRef.current = null;
    memberSubRef.current = null;
    commentSubRef.current?.();
    commentSubRef.current = null;
    setSelectedGroup(group);
    setView("group");
    setGroupTab("posts");
    setChatLoaded(false);
    setNewMemberCount(0);
    setCommentPostId(null);
    setPostComments([]);
    commentIdsRef.current.clear();
    setLatestCircleComments({});

    // Restore per-circle cache instantly if available
    const cachedPosts = dataCache.cacheRef.current.circlePosts[group.id];
    const cachedPending = dataCache.cacheRef.current.circlePending[group.id];
    const cachedMembers = dataCache.cacheRef.current.circleMembers[group.id];
    if (cachedPosts) setGroupPosts(cachedPosts.data);
    if (cachedPending) setPendingPosts(cachedPending.data);
    if (cachedMembers) {
      setGroupMembers(cachedMembers.data);
      const realCount = cachedMembers.data.length;
      setSelectedGroup(prev => prev ? { ...prev, member_count: realCount } : prev);
    } else {
      setGroupMembers([]);
    }

    // Fetch members with robust fallback
    setMembersLoading(true);
    const members = await fetchMembersWithProfiles(group.id);
    setMembersLoading(false);
    if (selectedGroupIdRef.current !== group.id) return;

    const realCount = members.length;
    setGroupMembers(members);
    dataCache.setCircleMembers(group.id, { data: members, fetchedAt: Date.now() });
    // Override stale circles.member_count with the real count from circle_members
    setSelectedGroup(prev => prev ? { ...prev, member_count: realCount } : prev);

    const myRow = members.find((m: any) => m.user_id === currentUserId);
    const role = (myRow?.role as MemberRole | undefined) ?? null;
    setCurrentRole(role);
    setIsAdmin(role === "admin");
    setSettingsForm({ rules: group.rules ?? "", post_approval: group.post_approval ?? false });
    await fetchCirclePosts(group.id, role === "admin" || role === "moderator");
    fetchCircleEvents(group.id);

    postSubCleanupRef.current?.();
    const postCleanup = subscribeWhileVisible(() => {
      const postCh = supabase
      .channel(`circle-posts-${group.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "circle_posts",
        filter: `circle_id=eq.${group.id}`,
      }, (payload) => {
        // Append new post directly — no full DB refetch needed
        const newPost = payload.new as GroupPost;
        const isReviewer = role === "admin" || role === "moderator";
        const visible =
          newPost.status === "approved" ||
          isReviewer ||
          newPost.author_id === currentUserId;
        if (visible) {
          const normalized: GroupPost = {
            ...newPost,
            status: newPost.status ?? "approved",
            likes_count: newPost.likes_count ?? 0,
            comments_count: newPost.comments_count ?? 0,
            shares_count: newPost.shares_count ?? 0,
          };
          setGroupPosts(prev =>
              prev.some(p => p.id === normalized.id)
                ? prev
                : [normalized, ...prev].slice(0, 50),
          );
          if (isReviewer && normalized.status === "pending") {
            setPendingPosts(prev =>
                prev.some(p => p.id === normalized.id)
                  ? prev
                  : [normalized, ...prev].slice(0, 50),
            );
          }
        }
      })
      .on("postgres_changes", {
        event: "DELETE",
        schema: "public",
        table: "circle_posts",
        filter: `circle_id=eq.${group.id}`,
      }, (payload) => {
        const deletedId = (payload.old as any)?.id;
        if (deletedId) {
          setGroupPosts(prev => prev.filter(p => p.id !== deletedId));
          setPendingPosts(prev => prev.filter(p => p.id !== deletedId));
        }
      })
      .subscribe();
      postSubRef.current = postCh;
      return postCh;
    }, {
      onVisible: () => {
        if (selectedGroupIdRef.current === group.id) {
          void fetchCirclePosts(group.id, role === "admin" || role === "moderator");
        }
      },
    });
    postSubCleanupRef.current = postCleanup;

    // Real-time member subscription (for owner new-member notifications)
    memberSubCleanupRef.current?.();
    // Debounce member refetch — avoid burst DB reads when multiple members join/leave at once
    let memberDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    const memberCleanup = subscribeWhileVisible(() => {
      const memberCh = supabase
      .channel(`members-${group.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "circle_members",
        filter: `circle_id=eq.${group.id}`,
      }, (payload) => {
        const newRow = payload.new as any;
        if (payload.eventType === "INSERT" && newRow.user_id !== currentUserId) {
          setNewMemberCount(c => c + 1);
        }
        // Debounce full profile refetch — max one refetch per 4 seconds
        if (memberDebounceTimer) clearTimeout(memberDebounceTimer);
        memberDebounceTimer = setTimeout(async () => {
          if (selectedGroupIdRef.current !== group.id) return;
          const refreshed = await fetchMembersWithProfiles(group.id);
          setGroupMembers(refreshed);
          setSelectedGroup(prev => prev ? { ...prev, member_count: refreshed.length } : prev);
        }, 4000);
      })
      .subscribe();
      memberSubRef.current = memberCh;
      return memberCh;
    }, {
      onVisible: () => {
        if (selectedGroupIdRef.current !== group.id) return;
        void fetchMembersWithProfiles(group.id).then(refreshed => {
          setGroupMembers(refreshed);
          setSelectedGroup(prev => prev ? { ...prev, member_count: refreshed.length } : prev);
        });
      },
    });
    memberSubCleanupRef.current = () => {
      if (memberDebounceTimer) clearTimeout(memberDebounceTimer);
      memberCleanup();
    };
  };

  // ── Build reactions map from raw rows ────────────────────────────────────────
  const buildReactionMap = useCallback((rows: any[], uid: string | null) => {
    const map: Record<string, ChatReaction[]> = {};
    for (const r of rows) {
      if (!map[r.message_id]) map[r.message_id] = [];
      const existing = map[r.message_id].find(x => x.emoji === r.emoji);
      if (existing) { existing.count++; if (r.user_id === uid) existing.mine = true; }
      else map[r.message_id].push({ emoji: r.emoji, count: 1, mine: r.user_id === uid });
    }
    return map;
  }, []);

  // ── Load chat messages ─────────────────────────────────────────────────────
  // Kept separate from subscription setup so visibility resume can rehydrate
  // missed messages without tearing down and recreating the active channel.
  const loadChatMessages = useCallback(async (groupId: string): Promise<boolean> => {
    setChatLoaded(false);
    const { data, error } = await supabase
      .from("group_messages")
      .select("id,group_id,sender_id,sender_name,sender_avatar,content,media_url,reply_to_id,created_at")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true })
      .limit(100);

    if (error) {
      toast.error("Chat unavailable — table may not exist yet.");
      setChatLoaded(true);
      return false;
    }
    const msgs = (data as GroupMessage[]) ?? [];
    setChatMessages(msgs);

    // Load reactions for these messages
    if (msgs.length > 0) {
      const { data: rxns } = await supabase
        .from("group_message_reactions")
        .select("message_id, user_id, emoji")
        .in("message_id", msgs.map(m => m.id))
        .limit(500);
      if (rxns) setMsgReactions(buildReactionMap(rxns, currentUserId));
    }
    setChatLoaded(true);
    return true;
  }, [currentUserId, buildReactionMap]);

  // ── Load chat messages + subscribe ──────────────────────────────────────────
  const loadChat = useCallback(async (groupId: string) => {
    chatSubCleanupRef.current?.();
    chatSubCleanupRef.current = null;
    chatSubRef.current = null;

    const loaded = await loadChatMessages(groupId);
    if (!loaded || selectedGroupIdRef.current !== groupId) return;

    // Subscribe to new messages + reaction changes only while visible.
    const chatCleanup = subscribeWhileVisible(() => {
      const ch = supabase
      .channel(`chat-${groupId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "group_messages",
        filter: `group_id=eq.${groupId}`,
      }, (payload) => {
        setChatMessages(prev => {
          const msg = payload.new as GroupMessage;
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg].slice(-100);
        });
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
      })
      .subscribe();
      chatSubRef.current = ch;
      return ch;
    }, { onVisible: () => void loadChatMessages(groupId) });
    chatSubCleanupRef.current = chatCleanup;
  }, [loadChatMessages]);

  useEffect(() => {
    if (groupTab === "chat" && selectedGroup) {
      loadChat(selectedGroup.id);
    }
    // Cleanup chat subscription when leaving chat tab
    if (groupTab !== "chat") {
      chatSubCleanupRef.current?.();
      chatSubCleanupRef.current = null;
      chatSubRef.current = null;
    }
  }, [groupTab, selectedGroup, loadChat]);

  // Auto scroll chat to bottom
  useEffect(() => {
    if (chatLoaded) {
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [chatLoaded, chatMessages.length]);

  // ── Send chat message ────────────────────────────────────────────────────────
  const sendChatMessage = async () => {
    const hasText = chatText.trim().length > 0;
    const hasMedia = !!chatMedia;
    if (!hasText && !hasMedia) return;
    if (!currentUserId || !selectedGroup || sendingChat) return;
    setSendingChat(true);
    const content = chatText.trim();
    setChatText("");
    const capturedReply = replyTo;
    const capturedMedia = chatMedia;
    setReplyTo(null);
    setChatMedia(null);
    setChatMediaPreview(null);

    let media_url: string | null = null;
    if (capturedMedia) {
      setUploadingChatMedia(true);
      const ext = capturedMedia.name.split(".").pop() ?? "jpg";
      const path = `circle-chat/${selectedGroup.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("circles").upload(path, capturedMedia, { upsert: true });
      if (!upErr) {
        const { data: pub } = supabase.storage.from("circles").getPublicUrl(path);
        media_url = pub.publicUrl;
      }
      setUploadingChatMedia(false);
    }

    const { error } = await supabase.from("group_messages").insert([{
      group_id: selectedGroup.id,
      sender_id: currentUserId,
      sender_name: userProfile?.full_name || "Member",
      sender_avatar: userProfile?.avatar_url || null,
      content: content || "",
      media_url,
      reply_to_id: capturedReply?.id ?? null,
    }]);

    if (error) {
      toast.error("Message not sent. Please try again.");
      setChatText(content);
    }
    setSendingChat(false);
  };

  // ── Toggle chat reaction ──────────────────────────────────────────────────────
  const toggleChatReaction = async (messageId: string, emoji: string) => {
    if (!currentUserId) return;
    haptic();
    const current = msgReactions[messageId]?.find(r => r.mine);
    if (current?.emoji === emoji) {
      // Remove
      await supabase.from("group_message_reactions").delete()
        .eq("message_id", messageId).eq("user_id", currentUserId);
      setMsgReactions(prev => {
        const arr = (prev[messageId] ?? []).map(r =>
          r.emoji === emoji ? { ...r, count: Math.max(0, r.count - 1), mine: false } : r
        ).filter(r => r.count > 0);
        return { ...prev, [messageId]: arr };
      });
    } else {
      // Remove old if any, then add new
      if (current) {
        await supabase.from("group_message_reactions").delete()
          .eq("message_id", messageId).eq("user_id", currentUserId);
      }
      await supabase.from("group_message_reactions").upsert(
        { message_id: messageId, user_id: currentUserId, emoji },
        { onConflict: "message_id,user_id" }
      );
      setMsgReactions(prev => {
        const arr = [...(prev[messageId] ?? [])].map(r => ({ ...r, mine: false, count: r.mine ? Math.max(0, r.count - 1) : r.count })).filter(r => r.count > 0);
        const ex = arr.find(r => r.emoji === emoji);
        if (ex) ex.count++; ex && (ex.mine = true);
        if (!ex) arr.push({ emoji, count: 1, mine: true });
        return { ...prev, [messageId]: arr };
      });
    }
    setEmojiBarMsgId(null);
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
        const { error: upErr } = await supabase.storage.from("circles").upload(path, postMedia, { upsert: true });
        if (!upErr) {
          const { data: pub } = supabase.storage.from("circles").getPublicUrl(path);
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
    if (!currentUserId || likingPostIdsRef.current.has(post.id)) return;

    // Serialize this post's toggle. Rapid taps must never issue two mutations
    // from the same stale likedPostIds snapshot.
    likingPostIdsRef.current.add(post.id);
    setLikingPostIds(prev => new Set(prev).add(post.id));
    const wasLiked = likedPostIds.has(post.id);

    try {
      const mutation = wasLiked
        ? await supabase
            .from("circle_post_likes")
            .delete()
            .eq("post_id", post.id)
            .eq("user_id", currentUserId)
        : await supabase
            .from("circle_post_likes")
            .upsert(
              { post_id: post.id, user_id: currentUserId },
              { onConflict: "post_id,user_id", ignoreDuplicates: true },
            );

      if (mutation.error) throw mutation.error;

      // The unique (post_id, user_id) row is the source of truth. Read only
      // this post's count; never derive a new count from stale card state.
      const { count, error: countError } = await supabase
        .from("circle_post_likes")
        .select("post_id", { count: "exact", head: true })
        .eq("post_id", post.id);
      if (countError) throw countError;

      const nextCount = count ?? 0;
      setLikedPostIds(prev => {
        const next = new Set(prev);
        if (wasLiked) next.delete(post.id);
        else next.add(post.id);
        return next;
      });
      setGroupPosts(prev => prev.map(p =>
        p.id === post.id ? { ...p, likes_count: nextCount } : p,
      ));

    } catch (error: any) {
      toast.error(`Could not ${wasLiked ? "unlike" : "like"} this post.`);
      console.warn("[CirclePage] like toggle failed:", error?.message || error);
    } finally {
      likingPostIdsRef.current.delete(post.id);
      setLikingPostIds(prev => {
        const next = new Set(prev);
        next.delete(post.id);
        return next;
      });
    }
  };

  const reviewPost = async (postId: string, status: "approved" | "rejected") => {
    if (!selectedGroup || !canModerate) return;

    // Grab the post so we can notify its author
    const post = pendingPosts.find(p => p.id === postId);

    const { error } = await supabase.from("circle_posts").update({ status }).eq("id", postId);
    if (error) {
      toast.error(`Review failed: ${error.message}`);
      return;
    }

    // Notify the post author (skip if they are the reviewer themselves)
    if (post && post.author_id && post.author_id !== currentUserId) {
      const notifType = status === "approved" ? "circle_post_approved" : "circle_post_rejected";
      const notifContent = status === "approved"
        ? `Your post in "${selectedGroup.name}" was approved and is now live!`
        : `Your post in "${selectedGroup.name}" was reviewed and not approved.`;
      await supabase.from("notifications").insert({
        notifier_id: post.author_id,
        actor_id: currentUserId,
        type: notifType,
        entity_id: postId,
        entity_type: "circle_post",
        content: notifContent,
        is_read: false,
      });
    }

    await fetchCirclePosts(selectedGroup.id);
    toast.success(status === "approved" ? "Post approved — author notified." : "Post rejected — author notified.");
  };

  const toggleCommentsMuted = async (post: GroupPost) => {
    if (!canModerate) return;
    const next = !post.comments_muted;
    await supabase.from("circle_posts").update({ comments_muted: next }).eq("id", post.id);
    setGroupPosts(prev => prev.map(p => p.id === post.id ? { ...p, comments_muted: next } : p));
    setPendingPosts(prev => prev.map(p => p.id === post.id ? { ...p, comments_muted: next } : p));
    toast.success(next ? "Comments muted for this post." : "Comments unmuted.");
  };

  const syncCircleCommentCount = async (postId: string): Promise<number | null> => {
    const { count, error: countError } = await supabase
      .from("circle_post_comments")
      .select("id", { count: "exact", head: true })
      .eq("post_id", postId);
    if (countError) {
      console.warn("[CirclePage] comment count fetch failed:", countError.message);
      return null;
    }

    const nextCount = count ?? 0;
    setGroupPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, comments_count: nextCount } : p,
    ));
    return nextCount;
  };

  const closeComments = () => {
    commentRequestRef.current += 1;
    setCommentPostId(null);
    setPostComments([]);
    commentIdsRef.current.clear();
    setCommentLoading(false);
    commentSubRef.current?.();
    commentSubRef.current = null;
  };

  const openComments = (post: GroupPost) => {
    if (!isPageVisible) return;
    const requestId = ++commentRequestRef.current;
    commentSubRef.current?.();
    commentSubRef.current = null;
    commentIdsRef.current.clear();
    setCommentPostId(post.id);
    setCommentText("");
    setCommentLoading(true);

    const loadComments = async () => {
      const { data, count, error } = await supabase
        .from("circle_post_comments")
        .select(
          "id,post_id,author_id,author_name,author_avatar,content,created_at,is_hidden,hidden_by_name,hidden_by_id",
          { count: "exact" },
        )
        .eq("post_id", post.id)
        .order("created_at", { ascending: true })
        .limit(100);
      if (requestId !== commentRequestRef.current) return;
      if (error) {
        setPostComments([]);
        setCommentLoading(false);
        toast.error("Comments are unavailable right now.");
        return;
      }

      const comments = ((data as CircleComment[]) ?? []).slice(-100);
      commentIdsRef.current = new Set(comments.map(comment => comment.id));
      setPostComments(comments);
      setGroupPosts(prev => prev.map(p =>
        p.id === post.id
          ? { ...p, comments_count: count ?? comments.length }
          : p,
      ));
      setLatestCircleComments(prev => ({
        ...prev,
        [post.id]: comments[comments.length - 1] ?? null,
      }));
      setCommentLoading(false);
    };

    void loadComments();
    commentSubRef.current = subscribeWhileVisible(
      () => supabase
        .channel(`circle-comments-${post.id}`)
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "circle_post_comments",
          filter: `post_id=eq.${post.id}`,
        }, (payload) => {
          if (requestId !== commentRequestRef.current) return;
          const row = payload.new as CircleComment;
          if (!row.id || commentIdsRef.current.has(row.id)) return;
          commentIdsRef.current.add(row.id);
          setPostComments(prev => [...prev, row].slice(-100));
          setLatestCircleComments(prev => ({ ...prev, [post.id]: row }));
          setGroupPosts(prev => prev.map(p =>
            p.id === post.id
              ? { ...p, comments_count: (p.comments_count || 0) + 1 }
              : p,
          ));
        })
        .subscribe(),
      { onVisible: () => void loadComments() },
    );
  };

  const sendComment = async () => {
    const post = groupPosts.find(p => p.id === commentPostId);
    if (!commentText.trim() || !currentUserId || !commentPostId || !post || post.comments_muted) return;
    setCommenting(true);
    try {
      // ── Profanity filter on circle comment ─────────────────────────────
      const { cleaned: cleanContent, hadProfanity } = sanitizeText(commentText.trim());
      if (hadProfanity) {
        toast.warning("Offensive words detected and masked automatically.");
      }
      const { data, error } = await supabase
        .from("circle_post_comments")
        .insert({
          post_id: commentPostId,
          author_id: currentUserId,
          author_name: userProfile?.full_name || "Member",
          author_avatar: userProfile?.avatar_url || null,
          content: cleanContent,
        })
        .select("id,post_id,author_id,author_name,author_avatar,content,created_at")
        .single();
      if (error) throw error;

      setCommentText("");
      if (data) {
        const newComment = data as CircleComment;
        commentIdsRef.current.add(newComment.id);
        setPostComments(prev => [...prev, newComment].slice(-100));
        setLatestCircleComments(prev => ({ ...prev, [commentPostId]: newComment }));
      }
      // Reconcile from the comments table instead of incrementing a stale
      // denormalized counter. No post-list refetch is needed.
      await syncCircleCommentCount(commentPostId);
    } catch (error: any) {
      toast.error(`Comment failed: ${error?.message || "Please try again."}`);
    } finally {
      setCommenting(false);
    }
  };

  const handleCircleCommentDelete = async (commentId: string, postId: string) => {
    const { error } = await supabase
      .from("circle_post_comments")
      .delete()
      .eq("id", commentId);
    if (error) {
      toast.error(`Comment delete failed: ${error.message}`);
      return;
    }
    commentIdsRef.current.delete(commentId);
    setPostComments(prev => {
      const next = prev.filter(c => c.id !== commentId);
      const latest = [...next].reverse()[0] || null;
      setLatestCircleComments(lc => ({ ...lc, [postId]: latest }));
      return next;
    });
    await syncCircleCommentCount(postId);
    setCircleCommentAction(null);
    toast.success("Comment deleted.");
  };

  const handleCircleCommentHide = async (commentId: string, postId: string) => {
    const hiderName = userProfile?.full_name || "Moderator";
    await supabase.from("circle_post_comments")
      .update({ is_hidden: true, hidden_by_name: hiderName, hidden_by_id: currentUserId })
      .eq("id", commentId);
    setPostComments(prev => prev.map(c => c.id === commentId ? { ...c, is_hidden: true, hidden_by_name: hiderName } as any : c));
    setCircleCommentAction(null);
    toast.success("Comment hidden.");
  };

  const handleCircleCommentReport = async (comment: CircleComment, postId: string) => {
    await supabase.from("reports").insert({
      reporter_id: currentUserId,
      reported_user_id: comment.author_id,
      post_id: postId,
      reason: `Reported circle comment: "${(comment.content || "").slice(0, 100)}"`,
      status: "pending",
    });
    setCircleCommentAction(null);
    toast.success("Report sent.");
  };

  const saveCircleCommentEdit = async () => {
    if (!editingCircleComment) return;
    const { id, text } = editingCircleComment;
    if (!text.trim()) return;
    const { cleaned } = sanitizeText(text.trim());
    await supabase.from("circle_post_comments").update({ content: cleaned }).eq("id", id);
    setPostComments(prev => prev.map(c => c.id === id ? { ...c, content: cleaned } : c));
    setEditingCircleComment(null);
    toast.success("Comment updated.");
  };

  const sharePost = async (post: GroupPost) => {
    const url = `${window.location.origin}?circle=${selectedGroup?.id}&post=${post.id}`;
    const circleName = selectedGroup?.name || "Circle";
    const titleLine = circleName;
    const bodyLine  = post.content
      ? post.content.slice(0, 160)
      : `New post from "${circleName}" — check it out on Flicks.`;
    const { universalShare } = await import("../lib/universalShare");
    const outcome = await universalShare({
      title: titleLine,
      text: `${titleLine}\n${bodyLine}`,
      url,
      mediaUrl: post.media_url || (selectedGroup as any)?.cover_url,
      type: "circle",
    });
    if (outcome === "copied") toast.success("Link copied to clipboard");
    const nextCount = (post.shares_count || 0) + 1;
    await supabase.from("circle_posts").update({ shares_count: nextCount }).eq("id", post.id);
    setGroupPosts(prev => prev.map(p => p.id === post.id ? { ...p, shares_count: nextCount } : p));
    // Notify the circle post author with rich metadata
    if (post.author_id && post.author_id !== currentUserId) {
      const sharerProfile = await supabase.from("profiles").select("full_name").eq("id", currentUserId).maybeSingle();
      const sharerName = sharerProfile?.data?.full_name || "Someone";
      const thumbnail = (post.media_url || (selectedGroup as any)?.cover_url) ?? null;
      const shareTitle = `Circle post in ${circleName}`;
      const shareDesc = (post.content || "").slice(0, 120) + ((post.content?.length || 0) > 120 ? "…" : "");
      await supabase.from("notifications").insert({
        notifier_id: post.author_id,
        actor_id: currentUserId,
        type: "circle_share",
        entity_id: post.id,
        content: JSON.stringify({
          thumbnail_url: thumbnail,
          share_title: shareTitle,
          share_description: shareDesc,
          text: `${sharerName} shared your circle post.`,
        }),
        is_read: false,
      });
    }
  };

  const refreshMembers = async (circleId = selectedGroup?.id) => {
    if (!circleId) return;
    const data = await fetchMembersWithProfiles(circleId);
    setGroupMembers(data);
    setSelectedGroup(prev => prev ? { ...prev, member_count: data.length } : prev);
    const myRow = data.find((m: any) => m.user_id === currentUserId);
    const role = (myRow?.role as MemberRole | undefined) ?? null;
    setCurrentRole(role);
    setIsAdmin(role === "admin");
  };

  const fetchViewers = async (postId: string) => {
    setViewersPostId(postId);
    setViewersLoading(true);
    const { data } = await supabase
      .from("circle_post_views")
      .select("viewer_id, viewed_at, profiles(full_name, avatar_url)")
      .eq("post_id", postId)
      .order("viewed_at", { ascending: false })
      .limit(100);
    setViewersList(data ?? []);
    setViewersLoading(false);
  };

  const updateMemberRole = async (member: any, role: MemberRole) => {
    if (!canAdmin) return;
    // Only original creator can promote to Admin or demote an Admin
    if (role === "admin" && !isCreator) return;
    if (member.role === "admin" && !isCreator) return;
    // Creator cannot be demoted by anyone
    if (member.user_id === selectedGroup?.created_by) return;
    const { error } = await supabase.from("circle_members").update({ role }).eq("id", member.id);
    if (error) { toast.error("Failed to update role."); return; }
    await refreshMembers();
    toast.success(
      role === "admin" ? "👑 Promoted to Admin!" :
      role === "moderator" ? "⭐ Promoted to Moderator." :
      "Role updated."
    );
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

    // Try INSERT first; if the invite already exists (23505 unique violation),
    // reset it to pending via UPDATE — avoids upsert's RLS double-check issue.
    const { error: insertErr } = await supabase.from("circle_invites").insert({
      circle_id: selectedGroup.id,
      inviter_id: currentUserId,
      invitee_id: profile.id,
      status: "pending",
    });

    if (insertErr) {
      if (insertErr.code === "23505") {
        // Invite already exists — reset to pending
        const { error: updateErr } = await supabase
          .from("circle_invites")
          .update({ status: "pending", inviter_id: currentUserId })
          .eq("circle_id", selectedGroup.id)
          .eq("invitee_id", profile.id);
        if (updateErr) {
          toast.error(`Invite failed: ${updateErr.message}`);
          return;
        }
      } else {
        toast.error(`Invite failed: ${insertErr.message}`);
        return;
      }
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
      const { error: upErr } = await supabase.storage.from("circles").upload(path, editGroupCoverFile, { upsert: true });
      if (!upErr) {
        const { data: pub } = supabase.storage.from("circles").getPublicUrl(path);
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
  const allGroupsForGrid = groups;

  // ═══════════════════════════ RENDER ═══════════════════════════════════════════

  // ── GROUP PROFILE VIEW ────────────────────────────────────────────────────────
  if (view === "group" && selectedGroup) {
    const isMember = myGroupIds.has(selectedGroup.id);

    return (
      <div className="min-h-screen flex flex-col" style={{
        background: "#090a0f",
        backgroundImage: "radial-gradient(circle at top,#1e3a8a22,transparent 45%),radial-gradient(circle at bottom,#00e5ff18,transparent 55%)"
      }}>
        {/* ── CINEMATIC HERO ──────────────────────────────────────────── */}
        <div className="relative w-full flex-shrink-0" style={{ height: 220 }}>
          {/* Cover image */}
          <div className="absolute inset-0" style={{
            backgroundImage: selectedGroup.cover_url ? `url('${selectedGroup.cover_url}')` : "none",
            backgroundColor: !selectedGroup.cover_url ? "#1a1f35" : "transparent",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }} />
          {/* Gradient overlay */}
          <div className="absolute inset-0" style={{
            background: "linear-gradient(to bottom, rgba(9,10,15,0.15) 0%, rgba(9,10,15,0.0) 30%, rgba(9,10,15,0.92) 100%)"
          }} />

          {/* Back */}
          <button
            onClick={() => {
              setView("dashboard");
              setSelectedGroup(null);
              selectedGroupIdRef.current = null;
              commentRequestRef.current += 1;
              commentSubRef.current?.();
              commentSubRef.current = null;
              setNewMemberCount(0);
              chatSubCleanupRef.current?.();
              memberSubCleanupRef.current?.();
              postSubCleanupRef.current?.();
              chatSubCleanupRef.current = null;
              memberSubCleanupRef.current = null;
              postSubCleanupRef.current = null;
              chatSubRef.current = null;
              memberSubRef.current = null;
              postSubRef.current = null;
            }}
            className="absolute top-4 left-4 w-10 h-10 rounded-full flex items-center justify-center border border-white/20 z-10 active:scale-90 transition-transform"
            style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }}
          >
            <ChevronLeft size={20} className="text-white" />
          </button>

          {/* Admin buttons */}
          {canModerate && (
            <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
              <button
                onClick={() => openEditGroup(selectedGroup)}
                className="w-10 h-10 rounded-full flex items-center justify-center border border-white/20 active:scale-90 transition-transform"
                style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }}
              >
                <Pencil size={16} className="text-white" />
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="w-10 h-10 rounded-full flex items-center justify-center border border-white/20 active:scale-90 transition-transform"
                style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }}
              >
                <Settings size={18} className="text-white" />
              </button>
              {selectedGroup.created_by === currentUserId && (
                <button
                  onClick={() => setConfirmDeleteGroup(true)}
                  className="w-10 h-10 rounded-full flex items-center justify-center border border-red-500/30 active:scale-90 transition-transform"
                  style={{ background: "rgba(239,68,68,0.18)", backdropFilter: "blur(12px)" }}
                >
                  <Trash2 size={16} className="text-red-400" />
                </button>
              )}
            </div>
          )}

          {/* Floating Avatar — overlaps hero bottom */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 z-20">
            <div
              className="w-24 h-24 rounded-full overflow-hidden border-2 border-white/10 flex items-center justify-center text-white font-black text-2xl"
              style={{ boxShadow: "0 0 0 3px rgba(0,240,255,0.5), 0 0 24px rgba(0,240,255,0.25), 0 8px 32px rgba(0,0,0,0.7)", background: "linear-gradient(135deg,#1e3a8a,#2563eb)" }}
            >
              {(selectedGroup.cover_url || selectedGroup.profiles?.avatar_url) ? (
                <img
                  src={selectedGroup.cover_url || selectedGroup.profiles?.avatar_url || ""}
                  className="w-full h-full object-cover"
                  alt={selectedGroup.name}
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                (selectedGroup.name || "C")[0].toUpperCase()
              )}
            </div>
          </div>
        </div>

        {/* Circle Info */}
        <div className="flex flex-col items-center pt-14 pb-4 px-4">
          <h2 className="text-white font-black text-xl text-center leading-tight">{selectedGroup.name}</h2>
          <div className="flex items-center gap-2 mt-1.5">
            {currentRole === "admin" && (
              <span className="text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1"
                style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#000" }}>
                👑 Admin
              </span>
            )}
            {currentRole === "moderator" && (
              <span className="text-[10px] font-black px-2.5 py-1 rounded-full text-white border border-blue-500/40"
                style={{ background: "rgba(59,130,246,0.2)" }}>
                ⭐ Moderator
              </span>
            )}
          </div>
          {/* Member avatars + count */}
          <div className="flex items-center gap-2 mt-2">
            {/* Avatar stack — up to 6 DPs */}
            {groupMembers.length > 0 && (
              <div className="flex items-center">
                {groupMembers.slice(0, 6).map((m: any, i: number) => (
                  <div
                    key={m.id ?? i}
                    className="w-7 h-7 rounded-full border-2 overflow-hidden flex items-center justify-center text-white font-black text-[10px] shrink-0"
                    style={{
                      marginLeft: i === 0 ? 0 : -8,
                      zIndex: 6 - i,
                      borderColor: "#090a0f",
                      background: "linear-gradient(135deg,#1e3a8a,#2563eb)",
                      position: "relative",
                    }}
                  >
                    {m.profiles?.avatar_url
                      ? <img src={m.profiles.avatar_url} className="w-full h-full object-cover" alt="" loading="lazy" decoding="async" />
                      : (m.profiles?.full_name || "?")[0].toUpperCase()}
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-1">
              {selectedGroup.privacy === "private" ? <Lock size={10} className="text-gray-500" /> : <Globe size={10} className="text-gray-500" />}
              <span className="text-[12px] text-gray-400 font-semibold">
                {selectedGroup.member_count ?? groupMembers.length} Members
              </span>
            </div>
          </div>

          {/* Description — truncated with "More" expand */}
          {selectedGroup.description && (
            <div className="mt-2 max-w-xs text-center">
              <p className={`text-[12px] text-gray-500 leading-relaxed ${descExpanded ? "" : "line-clamp-2"}`}>
                {selectedGroup.description}
              </p>
              {selectedGroup.description.length > 80 && (
                <button
                  onClick={() => setDescExpanded(v => !v)}
                  className="text-[11px] font-black text-[#00F0FF] mt-0.5 active:opacity-70"
                >
                  {descExpanded ? "Less" : "More"}
                </button>
              )}
            </div>
          )}

          {/* Join button for non-members */}
          {!isMember && (
            <div className="mt-3">
              <button
                onClick={() => handleJoin(selectedGroup.id)}
                className="flex items-center gap-1.5 px-5 py-2 rounded-full border border-[#00F0FF]/30 text-[12px] font-black text-[#00F0FF] active:scale-95 transition-transform"
                style={{ background: "rgba(0,240,255,0.08)", backdropFilter: "blur(12px)" }}
              >
                <Users size={13} /> Join Circle
              </button>
            </div>
          )}
        </div>

        {/* ── COMPACT NAV BAR ─────────────────────────────────────────── */}
        <div className="px-3 pb-2 sticky top-0 z-20 pt-1" style={{ background: "#090a0f" }}>
          <div className="flex items-center rounded-2xl border border-white/[0.08] px-2 py-1.5 gap-2"
            style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(20px)" }}>
            {/* Posts — always visible primary tab */}
            <button
              onClick={() => setGroupTab("posts")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[12px] font-black transition-all ${
                groupTab === "posts" ? "text-[#090a0f]" : "text-gray-400"
              }`}
              style={groupTab === "posts" ? { background: "#00F0FF", boxShadow: "0 0 12px rgba(0,240,255,0.4)" } : {}}
            >
              <FileText size={13} />
              Posts
            </button>

            {/* Active section label (when not on Posts) */}
            {groupTab !== "posts" && (
              <div className="flex-1 flex items-center gap-1.5 px-2 min-w-0">
                <span className="text-[12px] font-black text-[#00F0FF] truncate capitalize">
                  {groupTab === "review" ? "Post Approval" : groupTab === "members" ? (canModerate ? "Admin" : "Members") : groupTab}
                </span>
                {pendingPosts.length > 0 && groupTab === "review" && (
                  <span className="w-4 h-4 rounded-full text-white text-[8px] font-black flex items-center justify-center shrink-0"
                    style={{ background: "#ff5d5d" }}>{pendingPosts.length}</span>
                )}
              </div>
            )}
            {groupTab === "posts" && <div className="flex-1" />}

            {/* Menu / Options button */}
            <div className="relative">
              <button
                onClick={() => setShowMenuDropdown(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-black transition-all relative border ${
                  showMenuDropdown ? "text-[#090a0f] border-transparent" : "text-gray-300 border-white/10"
                }`}
                style={showMenuDropdown ? { background: "#00F0FF", boxShadow: "0 0 10px rgba(0,240,255,0.35)" } : { background: "rgba(255,255,255,0.07)" }}
              >
                <MoreHorizontal size={15} />
                <span>Menu</span>
                {pendingPosts.length > 0 && canModerate && !showMenuDropdown && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-[8px] font-black flex items-center justify-center"
                    style={{ background: "#ff5d5d" }}>{pendingPosts.length}</span>
                )}
                {newMemberCount > 0 && canModerate && !showMenuDropdown && pendingPosts.length === 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-[8px] font-black flex items-center justify-center"
                    style={{ background: "#ff5d5d" }}>{newMemberCount}</span>
                )}
              </button>

              {/* Dropdown */}
              {showMenuDropdown && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowMenuDropdown(false)} />
                  <div
                    className="absolute right-0 top-full mt-2 w-52 rounded-2xl border border-white/[0.10] overflow-hidden z-40 shadow-2xl"
                    style={{ background: "rgba(13,14,22,0.97)", backdropFilter: "blur(24px)" }}
                  >
                    {([
                      canModerate && { id: "review" as const, icon: Eye, label: "Post Approval", badge: pendingPosts.length > 0 ? pendingPosts.length : 0, desc: "Review pending posts" },
                      { id: "chat" as const, icon: MessageCircle, label: "Chat", badge: 0, desc: "Group chat" },
                      { id: "members" as const, icon: Users, label: canModerate ? "Admin" : "Members", badge: newMemberCount > 0 && canModerate ? newMemberCount : 0, desc: canModerate ? "Manage members & roles" : "View members" },
                      { id: "about" as const, icon: Shield, label: "About & Settings", badge: 0, desc: "Info, rules, leave group" },
                    ].filter(Boolean) as { id: GroupTab; icon: any; label: string; badge: number; desc: string }[]).map(item => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setGroupTab(item.id);
                          if (item.id === "members") setNewMemberCount(0);
                          setShowMenuDropdown(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left border-b border-white/[0.06] last:border-0 active:bg-white/10 transition-colors relative"
                        style={groupTab === item.id ? { background: "rgba(0,240,255,0.07)" } : {}}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${groupTab === item.id ? "text-[#00F0FF]" : "text-white/50"}`}
                          style={{ background: groupTab === item.id ? "rgba(0,240,255,0.12)" : "rgba(255,255,255,0.06)" }}>
                          <item.icon size={15} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-black ${groupTab === item.id ? "text-[#00F0FF]" : "text-white"}`}>{item.label}</p>
                          <p className="text-[10px] text-white/30">{item.desc}</p>
                        </div>
                        {item.badge > 0 && (
                          <span className="w-5 h-5 rounded-full text-white text-[9px] font-black flex items-center justify-center shrink-0"
                            style={{ background: "#ff5d5d" }}>{item.badge}</span>
                        )}
                        {groupTab === item.id && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#00F0FF" }} />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── POSTS TAB ──────────────────────────────────────────────────────── */}
        {groupTab === "posts" && (
          <div
            ref={postsScrollRef}
            className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: "none" }}
            onTouchStart={(e) => {
              if (postsScrollRef.current && postsScrollRef.current.scrollTop === 0) {
                pullStartY.current = e.touches[0].clientY;
              }
            }}
            onTouchMove={(e) => {
              if (pullStartY.current > 0) {
                pullDelta.current = e.touches[0].clientY - pullStartY.current;
              }
            }}
            onTouchEnd={async () => {
              if (pullDelta.current > 64 && !pullRefreshing && selectedGroup) {
                setPullRefreshing(true);
                await fetchCirclePosts(selectedGroup.id, canModerate);
                setPullRefreshing(false);
              }
              pullStartY.current = 0;
              pullDelta.current = 0;
            }}
          >
            {/* Pull-to-refresh indicator */}
            {pullRefreshing && (
              <div className="flex items-center justify-center gap-2 py-3 border-b border-white/[0.06]"
                style={{ background: "rgba(0,240,255,0.06)" }}>
                <Loader2 size={14} className="animate-spin text-[#00F0FF]" />
                <span className="text-[11px] font-black text-[#00F0FF]">Refreshing…</span>
              </div>
            )}

            {/* ── Pinned Announcement ──────────────────────────────────── */}
            <AnimatePresence>
              {(selectedGroup.pinned_announcement || (canAdmin && pinnedEditing)) && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22 }}
                  className="mx-3 mt-3 mb-1 rounded-2xl overflow-hidden border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 shadow-sm"
                >
                  {/* Header row */}
                  <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <Pin size={13} className="text-amber-500 shrink-0 -rotate-45" />
                      <span className="text-[11px] font-black text-amber-700 uppercase tracking-wider">Pinned Announcement</span>
                    </div>
                    {canAdmin && !pinnedEditing && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setPinnedText(selectedGroup.pinned_announcement || ""); setPinnedEditing(true); }}
                          className="p-1.5 rounded-full bg-amber-100 active:bg-amber-200 text-amber-600"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => savePinnedAnnouncement(null)}
                          className="p-1.5 rounded-full bg-red-100 active:bg-red-200 text-red-500"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Edit mode */}
                  {pinnedEditing ? (
                    <div className="px-4 pb-4 pt-1">
                      <textarea
                        value={pinnedText}
                        onChange={e => setPinnedText(e.target.value)}
                        placeholder="Write your announcement here…"
                        rows={3}
                        maxLength={400}
                        autoFocus
                        className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2.5 text-[13px] text-gray-800 outline-none focus:ring-2 focus:ring-amber-300/50 resize-none"
                      />
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-amber-500">{pinnedText.length}/400</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setPinnedEditing(false)}
                            className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-[12px] font-black active:scale-95 transition-transform"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => savePinnedAnnouncement(pinnedText.trim())}
                            disabled={savingPin || !pinnedText.trim()}
                            className="px-4 py-2 rounded-xl bg-amber-500 text-white text-[12px] font-black disabled:opacity-50 active:scale-95 transition-transform flex items-center gap-1.5"
                          >
                            {savingPin ? <Loader2 size={12} className="animate-spin" /> : <Pin size={12} className="-rotate-45" />}
                            Pin It
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Display mode */
                    <div className="px-4 pb-4 pt-1">
                      <p className="text-[13px] text-amber-900 leading-snug whitespace-pre-wrap">{selectedGroup.pinned_announcement}</p>
                      {selectedGroup.pinned_at && (
                        <p className="text-[10px] text-amber-500/60 mt-1.5">
                          {new Date(selectedGroup.pinned_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Admin "Add Announcement" button — shown when no pin exists */}
            {canAdmin && !selectedGroup.pinned_announcement && !pinnedEditing && (
              <div className="flex justify-end px-3 pt-2">
                <button
                  onClick={() => { setPinnedText(""); setPinnedEditing(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 border border-amber-200 text-amber-700 text-[11px] font-black active:scale-95 transition-transform"
                >
                  <Megaphone size={12} />
                  Add Announcement
                </button>
              </div>
            )}

            {/* ── Events Strip ─────────────────────────────────────────── */}
            {(circleEvents.length > 0 || canAdmin) && (
              <div className="mt-3 mb-1">
                {/* Header */}
                <div className="flex items-center justify-between px-4 mb-2">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-violet-500" />
                    <span className="text-[11px] font-black text-gray-700 uppercase tracking-wider">Events</span>
                    {circleEvents.length > 0 && (
                      <span className="bg-violet-100 text-violet-700 text-[9px] font-black px-1.5 py-0.5 rounded-full">{circleEvents.length}</span>
                    )}
                  </div>
                  {canAdmin && (
                    <button
                      onClick={() => { haptic(); setShowCreateEvent(true); }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-100 border border-violet-200 text-violet-700 text-[10px] font-black active:scale-95 transition-transform"
                    >
                      <CalendarPlus size={11} />
                      New Event
                    </button>
                  )}
                </div>

                {circleEvents.length === 0 && canAdmin ? (
                  <div className="mx-4 p-4 rounded-2xl border border-dashed border-violet-200 bg-violet-50 text-center">
                    <Calendar size={22} className="text-violet-300 mx-auto mb-1" />
                    <p className="text-[11px] font-black text-violet-400">No events yet — tap "New Event" to create one</p>
                  </div>
                ) : (
                  <div className="flex gap-3 px-4 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
                    {circleEvents.map(ev => {
                      const counts = eventRsvpCounts[ev.id] ?? { going: 0, maybe: 0, not_going: 0 };
                      const mine   = myRsvps[ev.id];
                      const today  = new Date(); today.setHours(0, 0, 0, 0);
                      const evDate = new Date(ev.event_date + "T00:00:00");
                      const isPast = evDate < today;
                      const dayN   = evDate.toLocaleDateString("en-IN", { day: "numeric" });
                      const monN   = evDate.toLocaleDateString("en-IN", { month: "short" });
                      return (
                        <motion.div
                          key={ev.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className={`shrink-0 w-56 rounded-2xl border overflow-hidden shadow-sm ${isPast ? "border-gray-200 bg-gray-50 opacity-70" : "border-violet-200 bg-gradient-to-br from-white to-violet-50"}`}
                        >
                          {/* Date badge + admin delete */}
                          <div className={`flex items-center justify-between px-3 pt-2.5 pb-1 ${isPast ? "bg-gray-100" : "bg-violet-600"}`}>
                            <div className="flex items-center gap-2">
                              <div className="text-center">
                                <div className={`text-[18px] font-black leading-none ${isPast ? "text-gray-500" : "text-white"}`}>{dayN}</div>
                                <div className={`text-[9px] font-black uppercase tracking-wider ${isPast ? "text-gray-400" : "text-violet-200"}`}>{monN}</div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-[12px] font-black truncate leading-snug ${isPast ? "text-gray-600" : "text-white"}`}>{ev.title}</p>
                                {isPast && <span className="text-[9px] font-black text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded-full">Past</span>}
                              </div>
                            </div>
                            {canAdmin && (
                              <button onClick={() => { haptic(12); deleteEvent(ev.id); }} className={`p-1 rounded-full ${isPast ? "bg-gray-200 text-gray-400" : "bg-white/20 text-white/80"} active:scale-90`}>
                                <X size={11} />
                              </button>
                            )}
                          </div>

                          {/* Details */}
                          <div className="px-3 py-2 space-y-0.5">
                            {ev.event_time && (
                              <div className="flex items-center gap-1.5">
                                <Clock size={10} className="text-violet-400 shrink-0" />
                                <span className="text-[10px] text-gray-600">
                                  {(() => { const [h, m] = ev.event_time.split(":"); const hr = parseInt(h); return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`; })()}
                                </span>
                              </div>
                            )}
                            {ev.location && (
                              <div className="flex items-center gap-1.5">
                                <MapPin size={10} className="text-violet-400 shrink-0" />
                                <span className="text-[10px] text-gray-600 truncate">{ev.location}</span>
                              </div>
                            )}
                            {ev.description && (
                              <p className="text-[10px] text-gray-500 leading-snug line-clamp-2 pt-0.5">{ev.description}</p>
                            )}
                          </div>

                          {/* RSVP row */}
                          {!isPast && (
                            <div className="px-3 pb-3 pt-1">
                              {rsvpLoading === ev.id ? (
                                <div className="flex justify-center py-1"><Loader2 size={14} className="animate-spin text-violet-400" /></div>
                              ) : (
                                <div className="flex gap-1">
                                  {([
                                    { key: "going",     label: "✅ Going",   count: counts.going,     active: "bg-green-500 text-white border-green-500" },
                                    { key: "maybe",     label: "🤔 Maybe",   count: counts.maybe,     active: "bg-amber-400 text-white border-amber-400" },
                                    { key: "not_going", label: "❌ Nope",    count: counts.not_going, active: "bg-red-400 text-white border-red-400" },
                                  ] as const).map(opt => (
                                    <button
                                      key={opt.key}
                                      onClick={() => rsvpEvent(ev.id, opt.key)}
                                      className={`flex-1 flex flex-col items-center py-1 rounded-xl border text-[9px] font-black transition-all active:scale-95 ${mine === opt.key ? opt.active : "bg-white border-gray-200 text-gray-500"}`}
                                    >
                                      <span>{opt.label}</span>
                                      <span className={`text-[10px] font-black mt-0.5 ${mine === opt.key ? "text-white/90" : "text-gray-400"}`}>{opt.count}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          {isPast && (
                            <div className="px-3 pb-2.5 text-center">
                              <span className="text-[10px] text-gray-400">{counts.going} went · {counts.maybe} maybe · {counts.not_going} couldn't</span>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* About */}
            {selectedGroup.rules && (
              <div className="bg-[#d4f0e2] border-b border-gray-100 px-4 py-3">
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
              <div className="mx-3 mb-3 rounded-3xl border border-white/[0.08] px-4 py-3"
                style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(20px)" }}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-700 flex items-center justify-center text-white font-black text-sm shrink-0 overflow-hidden"
                    style={{ boxShadow: "0 0 0 2px rgba(0,240,255,0.3)" }}>
                    {userProfile?.avatar_url ? (
                      <img src={userProfile.avatar_url} className="w-full h-full object-cover" alt="" loading="lazy" decoding="async"/>
                    ) : (
                      (userProfile?.full_name || "U")[0]
                    )}
                  </div>
                  <div className="flex-1">
                    <textarea
                      value={postText}
                      onChange={e => setPostText(e.target.value)}
                      placeholder="Post something in this Circle…"
                      className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none resize-none border border-white/10 placeholder:text-white/25 focus:border-[#00F0FF]/40"
                      style={{ background: "rgba(255,255,255,0.06)" }}
                      rows={2}
                    />
                    {postMedia && (
                      <div className="relative mt-2 w-20 h-20 rounded-lg overflow-hidden">
                        {postMediaPreview && (
                          <img src={postMediaPreview} className="w-full h-full object-cover" alt="" loading="lazy" decoding="async"/>
                        )}
                        <button onClick={() => setPostMedia(null)} className="absolute top-1 right-1 bg-black/70 rounded-full p-0.5">
                          <X size={10} className="text-white" />
                        </button>
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <button onClick={() => mediaInputRef.current?.click()}
                        className="p-1.5 rounded-lg text-white/40 border border-white/10"
                        style={{ background: "rgba(255,255,255,0.06)" }}>
                        <ImageIcon size={16} />
                      </button>
                      <input ref={mediaInputRef} type="file" accept="image/*,video/*" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) setPostMedia(f); e.target.value = ""; }} />
                      <button
                        onClick={handleGroupPost}
                        disabled={!postText.trim() || posting}
                        className="flex items-center gap-1.5 text-[#090a0f] px-4 py-1.5 rounded-xl text-sm font-bold disabled:opacity-40 active:scale-95 transition-transform"
                        style={{ background: "linear-gradient(135deg,#00F0FF,#2563eb)" }}
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

              {postsLoading ? (
                <div className="flex flex-col items-center py-16">
                  <Loader2 size={26} className="animate-spin text-blue-400 mb-3" />
                  <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Loading Posts…</p>
                </div>
              ) : groupPosts.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-gray-300">
                  <FileText size={32} className="mb-3 opacity-40" />
                  <p className="text-xs font-black uppercase tracking-widest">No posts yet</p>
                  {isMember && <p className="text-[11px] text-gray-400 mt-1">Be the first to post!</p>}
                </div>
              ) : (
                groupPosts.map(post => (
                  <CirclePostCard
                    key={post.id}
                    post={post}
                    currentUserId={currentUserId}
                    canModerate={canModerate}
                    canAdmin={canAdmin}
                    likedPostIds={likedPostIds}
                    likingPostIds={likingPostIds}
                    viewCounts={viewCounts}
                    groupOwnerId={selectedGroup?.created_by || selectedGroup?.admin_id || ""}
                    latestComment={latestCircleComments[post.id] ?? null}
                    onLike={handleLikePost}
                    onComment={openComments}
                    onShare={sharePost}
                    onOptions={(p) => setPostSheet(p)}
                    onReview={reviewPost}
                    onViewers={fetchViewers}
                  />
                ))
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
            {/* Leave Circle is now in the tab bar — no floating button needed */}
          </div>
        )}

        {/* ── REVIEW TAB ─────────────────────────────────────────────────────── */}
        {groupTab === "review" && canModerate && (
          <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
            <div className="px-4 py-3 border-b border-white/[0.06]"
              style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(12px)" }}>
              <p className="text-[13px] font-black text-white">Pending Post Review</p>
              <p className="text-[10px] text-white/35 mt-0.5">Approve posts to make them visible to all members.</p>
            </div>
            {pendingPosts.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-white/20">
                <ShieldCheck size={34} className="mb-3 opacity-40" />
                <p className="text-xs font-black uppercase tracking-widest">Nothing to review</p>
              </div>
            ) : (
              <div className="space-y-3 p-3">
                {pendingPosts.map(post => (
                  <div key={post.id} className="rounded-3xl border border-amber-500/20 overflow-hidden"
                    style={{ background: "rgba(245,158,11,0.04)", backdropFilter: "blur(20px)", boxShadow: "0 8px 32px rgba(0,0,0,0.35)" }}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="w-9 h-9 rounded-full bg-blue-700 flex items-center justify-center text-white font-black text-sm shrink-0 overflow-hidden"
                        style={{ boxShadow: "0 0 0 2px rgba(0,240,255,0.3)" }}>
                        {post.author_avatar ? <img src={post.author_avatar} className="w-full h-full object-cover" alt="" loading="lazy" decoding="async"/> : (post.author_name || "M")[0].toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-bold text-sm">{post.author_name}</p>
                        <p className="text-[10px] text-amber-400 font-bold">Waiting for approval</p>
                      </div>
                    </div>
                    {post.content && <p className="px-4 pb-3 text-[13px] text-white/70 leading-snug">{maskProfanity(post.content)}</p>}
                    {post.media_url && <img src={post.media_url} className="w-full object-cover max-h-80" alt="" loading="lazy" decoding="async"/>}
                    <div className="flex gap-2 p-3 border-t border-white/[0.06]">
                      <button onClick={() => reviewPost(post.id, "rejected")}
                        className="flex-1 py-2.5 rounded-xl text-red-400 font-black text-[12px] flex items-center justify-center gap-1.5 border border-red-500/25"
                        style={{ background: "rgba(239,68,68,0.08)" }}>
                        <X size={14} /> Reject
                      </button>
                      <button onClick={() => reviewPost(post.id, "approved")}
                        className="flex-1 py-2.5 rounded-xl text-[#090a0f] font-black text-[12px] flex items-center justify-center gap-1.5"
                        style={{ background: "linear-gradient(135deg,#00F0FF,#22c55e)" }}>
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
          <div className="flex flex-col flex-1 overflow-hidden" style={{ height: "calc(100vh - 220px)" }}
            onClick={() => emojiBarMsgId && setEmojiBarMsgId(null)}>
            {!isMember ? (
              <div className="flex flex-col items-center justify-center flex-1 py-12 px-6 text-center">
                <MessageCircle size={40} className="text-gray-200 mb-3" />
                <p className="text-sm font-black text-gray-400 mb-4">Join this Circle to chat</p>
                <button onClick={() => handleJoin(selectedGroup.id)}
                  className="text-white px-6 py-3 rounded-2xl font-black text-sm active:scale-95 transition-transform"
                  style={{ background: "linear-gradient(135deg,#2563eb,#4f46e5)" }}>
                  Join Circle
                </button>
              </div>
            ) : (
              <>
                {/* ── Messages scroll area ──────────────────────────── */}
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
                  {!chatLoaded ? (
                    <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-blue-400" /></div>
                  ) : chatMessages.length === 0 ? (
                    <div className="flex flex-col items-center py-12 text-gray-300">
                      <MessageCircle size={32} className="mb-2 opacity-40" />
                      <p className="text-xs font-black uppercase tracking-widest">No messages yet</p>
                      <p className="text-[11px] text-gray-400 mt-1">Say hello! 👋</p>
                    </div>
                  ) : chatMessages.map((msg, i) => {
                    const isMe = msg.sender_id === currentUserId;
                    const showAvatar = i === 0 || chatMessages[i - 1].sender_id !== msg.sender_id;
                    const showName   = showAvatar && !isMe;
                    const reactions  = msgReactions[msg.id] ?? [];
                    const repliedMsg = msg.reply_to_id ? chatMessages.find(m => m.id === msg.reply_to_id) : null;
                    const isVideo    = msg.media_url && isVideoUrl(msg.media_url);
                    return (
                      <div key={msg.id} className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : ""} ${showAvatar && i > 0 ? "mt-3" : ""}`}>
                        {/* Avatar */}
                        {!isMe && (
                          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-[10px] shrink-0 overflow-hidden self-end mb-4"
                            style={{ opacity: showAvatar ? 1 : 0 }}>
                            {msg.sender_avatar
                              ? <img src={msg.sender_avatar} className="w-full h-full object-cover" alt="" loading="lazy"  decoding="async"/>
                              : (msg.sender_name || "M")[0].toUpperCase()}
                          </div>
                        )}

                        <div className={`max-w-[76%] flex flex-col ${isMe ? "items-end" : "items-start"} relative`}>
                          {showName && <span className="text-[9px] font-black text-gray-400 mb-0.5 px-1">{msg.sender_name}</span>}

                          {/* Emoji bar (shown on long press) */}
                          <AnimatePresence>
                            {emojiBarMsgId === msg.id && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.85, y: 6 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.85, y: 6 }}
                                transition={{ type: "spring", damping: 22, stiffness: 380 }}
                                className={`absolute bottom-full mb-1 z-50 flex items-center gap-1 rounded-2xl px-2 py-1.5 border border-white/10 ${isMe ? "right-0" : "left-0"}`}
                                style={{ background: "rgba(20,22,35,0.95)", backdropFilter: "blur(20px)", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}
                                onClick={e => e.stopPropagation()}
                              >
                                {["❤️","👍","😂","🔥","😮"].map(em => (
                                  <button key={em} onClick={() => toggleChatReaction(msg.id, em)}
                                    className={`text-[20px] active:scale-75 transition-transform px-0.5 rounded-xl ${reactions.find(r => r.emoji === em && r.mine) ? "bg-[#00F0FF]/15" : ""}`}>
                                    {em}
                                  </button>
                                ))}
                                <div className="w-px h-5 bg-white/10 mx-0.5" />
                                <button onClick={() => { setReplyTo(msg); setEmojiBarMsgId(null); }}
                                  className="p-1 rounded-xl active:bg-white/10 text-white/50">
                                  <Reply size={15} />
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Bubble */}
                          <div
                            className={`px-3 py-2 rounded-2xl text-sm leading-snug select-none ${
                              isMe ? "text-white rounded-br-sm" : "text-white/90 rounded-bl-sm"
                            }`}
                            style={isMe
                              ? { background: "linear-gradient(135deg,#2563eb,#4f46e5)", boxShadow: "0 4px 16px rgba(37,99,235,0.3)" }
                              : { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }}
                            onTouchStart={() => {
                              longPressTimer.current = setTimeout(() => { haptic(16); setEmojiBarMsgId(msg.id); }, 550);
                            }}
                            onTouchMove={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } }}
                            onTouchEnd={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } }}
                            onContextMenu={e => { e.preventDefault(); setEmojiBarMsgId(msg.id); }}
                          >
                            {/* Reply preview */}
                            {repliedMsg && (
                              <div className={`text-[11px] rounded-xl px-2 py-1.5 mb-1.5 border-l-2 ${isMe ? "bg-white/20 border-white/60 text-white/80" : "bg-gray-50 border-blue-300 text-gray-500"}`}>
                                <p className="font-black text-[10px] mb-0.5">{repliedMsg.sender_name}</p>
                                <p className="truncate">{repliedMsg.content || "📎 Media"}</p>
                              </div>
                            )}
                            {/* Media */}
                            {msg.media_url && (
                              <div className="mb-1.5 rounded-xl overflow-hidden">
                                {isVideo
                                  ? <video src={msg.media_url} controls muted playsInline className="w-full max-h-52 object-cover"  preload="none"/>
                                  : <img src={msg.media_url} className="w-full max-h-52 object-cover cursor-pointer" alt="" loading="lazy"  decoding="async"/>}
                              </div>
                            )}
                            {/* Text */}
                            {msg.content && <span>{msg.content}</span>}
                          </div>

                          {/* Reactions + timestamp row */}
                          <div className={`flex items-center gap-1.5 mt-0.5 px-1 ${isMe ? "flex-row-reverse" : ""}`}>
                            <span className="text-[8px] text-gray-400 shrink-0">
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            {reactions.length > 0 && (
                              <div className="flex gap-0.5">
                                {reactions.map(r => (
                                  <button key={r.emoji} onClick={() => toggleChatReaction(msg.id, r.emoji)}
                                    className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-black border transition-all active:scale-90 ${r.mine ? "border-[#00F0FF]/40 text-[#00F0FF]" : "border-white/10 text-white/50"}`}
                                    style={{ background: r.mine ? "rgba(0,240,255,0.12)" : "rgba(255,255,255,0.05)" }}>
                                    {r.emoji} {r.count > 1 && <span>{r.count}</span>}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>

                {/* ── Input area ───────────────────────────────────── */}
                <div className="flex-shrink-0 border-t border-white/[0.06]"
                  style={{ background: "rgba(9,10,15,0.85)", backdropFilter: "blur(20px)" }}>
                  {/* Reply banner */}
                  <AnimatePresence>
                    {replyTo && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.06] overflow-hidden"
                        style={{ background: "rgba(0,240,255,0.06)" }}>
                        <div className="w-0.5 h-8 rounded-full shrink-0" style={{ background: "#00F0FF" }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-black text-[#00F0FF]">Replying to {replyTo.sender_name}</p>
                          <p className="text-[11px] text-white/50 truncate">{replyTo.content || "📎 Media"}</p>
                        </div>
                        <button onClick={() => setReplyTo(null)}
                          className="p-1 rounded-full shrink-0 text-white/50"
                          style={{ background: "rgba(255,255,255,0.08)" }}>
                          <X size={12} />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Media preview */}
                  <AnimatePresence>
                    {chatMediaPreview && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="px-4 py-2 flex items-center gap-3 border-b border-white/[0.06] overflow-hidden"
                        style={{ background: "rgba(255,255,255,0.04)" }}>
                        <div className="relative shrink-0">
                          {chatMedia && isVideoUrl(chatMedia.name)
                            ? <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center"><VideoIcon size={20} className="text-white/60" /></div>
                            : <img src={chatMediaPreview} className="w-14 h-14 rounded-xl object-cover" alt="" loading="lazy" decoding="async"/>}
                          <button onClick={() => { setChatMedia(null); setChatMediaPreview(null); }}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center border border-white/20">
                            <X size={10} />
                          </button>
                        </div>
                        <p className="text-[11px] text-white/40 truncate flex-1">{chatMedia?.name}</p>
                        {uploadingChatMedia && <Loader2 size={16} className="animate-spin text-[#00F0FF] shrink-0" />}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Input row — focus mode: image btn fades out when typing */}
                  <div className="px-3 py-2.5 flex items-center gap-2 transition-all duration-200">
                    {/* Media picker */}
                    <input ref={chatMediaRef} type="file" accept="image/*,video/*" className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        setChatMedia(f);
                        const url = URL.createObjectURL(f);
                        setChatMediaPreview(url);
                        e.target.value = "";
                      }} />
                    {/* Image button — collapses in focus mode */}
                    <AnimatePresence initial={false}>
                      {!chatInputFocused && (
                        <motion.div
                          key="chat-img-btn"
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: "auto" }}
                          exit={{ opacity: 0, width: 0 }}
                          transition={{ duration: 0.18, ease: "easeInOut" }}
                          className="overflow-hidden shrink-0"
                        >
                          <button
                            onClick={() => chatMediaRef.current?.click()}
                            className="w-9 h-9 rounded-full flex items-center justify-center text-white/50 active:scale-90 transition-transform shrink-0 border border-white/10"
                            style={{ background: "rgba(255,255,255,0.07)" }}
                          >
                            <ImagePlus size={17} />
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <input
                      type="text"
                      value={chatText}
                      onChange={e => setChatText(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendChatMessage())}
                      onFocus={() => setChatInputFocused(true)}
                      onBlur={() => setChatInputFocused(false)}
                      placeholder="Message the circle…"
                      className="flex-1 rounded-2xl px-4 py-2.5 text-sm text-white outline-none transition-all duration-200 border placeholder:text-white/25"
                      style={{
                        background: "rgba(255,255,255,0.07)",
                        borderColor: chatInputFocused ? "rgba(0,240,255,0.4)" : "rgba(255,255,255,0.1)",
                        boxShadow: chatInputFocused ? "0 0 0 2px rgba(0,240,255,0.1)" : "none",
                      }}
                    />

                    <button
                      onClick={sendChatMessage}
                      disabled={(!chatText.trim() && !chatMedia) || sendingChat}
                      className="w-10 h-10 rounded-full flex items-center justify-center text-[#090a0f] disabled:opacity-40 active:scale-90 transition-all shrink-0 font-black"
                      style={{
                        background: "linear-gradient(135deg,#00F0FF,#2563eb)",
                        boxShadow: chatInputFocused ? "0 4px 16px rgba(0,240,255,0.35)" : "0 2px 8px rgba(0,240,255,0.2)",
                      }}
                    >
                      {sendingChat || uploadingChatMedia
                        ? <Loader2 size={16} className="animate-spin" />
                        : <Send size={16} />}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── MEMBERS TAB ──────────────────────────────────────────────────── */}
        {groupTab === "members" && (
          <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
            {/* Members count header */}
            <div className="px-4 py-3 flex items-center justify-between border-b border-white/[0.06]"
              style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(12px)" }}>
              <div>
                <p className="text-[13px] font-black text-white">
                  {groupMembers.length} Member{groupMembers.length !== 1 ? "s" : ""} Joined
                </p>
                <p className="text-[10px] text-white/40 mt-0.5">Real-time · Updates live</p>
              </div>
              {newMemberCount > 0 && canModerate && (
                <div className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 border border-[#00F0FF]/30"
                  style={{ background: "rgba(0,240,255,0.08)" }}>
                  <Bell size={12} className="text-[#00F0FF]" />
                  <span className="text-[11px] font-black text-[#00F0FF]">+{newMemberCount} New</span>
                </div>
              )}
            </div>

            {/* Members grid */}
            <div className="grid grid-cols-2 gap-3 p-3">
              {membersLoading ? (
                <div className="col-span-2 flex flex-col items-center py-14">
                  <Loader2 size={24} className="animate-spin text-[#00F0FF] mb-2" />
                  <p className="text-[11px] font-black text-white/40 uppercase tracking-widest">Loading Members…</p>
                </div>
              ) : null}
              {!membersLoading && groupMembers.map((m: any) => (
                <div key={m.id}
                  className="flex flex-col items-center p-4 rounded-3xl border border-white/[0.08] relative"
                  style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(20px)", boxShadow: "0 8px 32px rgba(0,0,0,0.35)" }}>
                  {/* Avatar */}
                  <div className="relative mb-2">
                    <div
                      className="w-16 h-16 rounded-full bg-blue-700 flex items-center justify-center text-white font-black text-xl overflow-hidden cursor-pointer"
                      style={{
                        boxShadow: m.role === "admin"
                          ? "0 0 0 2.5px #f59e0b, 0 0 14px rgba(245,158,11,0.35)"
                          : m.role === "moderator"
                            ? "0 0 0 2.5px #3b82f6, 0 0 14px rgba(59,130,246,0.35)"
                            : "0 0 0 2px rgba(0,240,255,0.35), 0 0 12px rgba(0,240,255,0.1)"
                      }}
                      onClick={() => m.user_id && openProfile(m.user_id)}
                    >
                      {m.profiles?.avatar_url ? (
                        <img src={m.profiles.avatar_url} className="w-full h-full object-cover" alt="" loading="lazy" decoding="async"/>
                      ) : (
                        (m.profiles?.full_name || "M")[0].toUpperCase()
                      )}
                    </div>
                    <OnlineDot authorId={m.user_id} />
                  </div>
                  {/* Name */}
                  <p className="text-[12px] font-bold text-white truncate w-full text-center leading-tight">
                    {m.profiles?.full_name || "Member"}
                    {m.user_id === currentUserId && (
                      <span className="text-[10px] text-white/30 font-medium"> (you)</span>
                    )}
                  </p>
                  {/* Role badge */}
                  <span className={`mt-1 text-[9px] font-black px-2 py-0.5 rounded-full ${
                    m.role === "admin"
                      ? "text-amber-300 border border-amber-500/40"
                      : m.role === "moderator"
                        ? "text-blue-300 border border-blue-500/40"
                        : "text-white/40 border border-white/15"
                  }`}
                    style={{
                      background: m.role === "admin"
                        ? "rgba(245,158,11,0.12)"
                        : m.role === "moderator"
                          ? "rgba(59,130,246,0.12)"
                          : "rgba(255,255,255,0.04)"
                    }}>
                    {m.role === "admin" ? "👑 Admin" : m.role === "moderator" ? "⭐ Mod" : "Member"}
                  </span>
                  {/* Action button */}
                  {m.user_id !== currentUserId && (
                    <div className="mt-3 w-full">
                      {canManageMember(m) ? (
                        <button
                          onClick={() => { haptic(); setMemberSheet(m); }}
                          className="w-full flex items-center justify-center gap-1 py-1.5 rounded-xl text-[10px] font-black text-white/70 border border-white/10 active:scale-95 transition-transform"
                          style={{ background: "rgba(255,255,255,0.07)" }}
                        >
                          <MoreVertical size={11} />
                          Manage
                        </button>
                      ) : (
                        <button
                          onClick={() => { haptic(); m.user_id && openProfile(m.user_id); }}
                          className="w-full py-1.5 rounded-xl text-[10px] font-black text-[#00F0FF] border border-[#00F0FF]/25 active:scale-95 transition-transform"
                          style={{ background: "rgba(0,240,255,0.07)" }}
                        >
                          View
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {!membersLoading && groupMembers.length === 0 && (
                <div className="col-span-2 flex flex-col items-center py-12 text-white/30">
                  <Users size={32} className="mb-2 opacity-40" />
                  <p className="text-xs font-black uppercase tracking-widest">No members yet</p>
                </div>
              )}
            </div>

            {canAdmin && (
              <div className="px-3 pb-3">
                <div className="rounded-3xl border border-white/[0.08] p-4"
                  style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(20px)" }}>
                  <div className="flex items-center gap-2 mb-3">
                    <UserPlus size={15} className="text-[#00F0FF]" />
                    <p className="text-[12px] font-black text-white">Invite friends</p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={inviteSearch}
                      onChange={e => setInviteSearch(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && searchInvitees()}
                      placeholder="Search profile name…"
                      className="flex-1 rounded-xl px-3 py-2 text-[12px] text-white outline-none border border-white/10 placeholder:text-white/30 focus:border-[#00F0FF]/40"
                      style={{ background: "rgba(255,255,255,0.06)" }}
                    />
                    <button onClick={searchInvitees} disabled={inviteLoading || !inviteSearch.trim()}
                      className="px-3 rounded-xl text-[#090a0f] text-[11px] font-black disabled:opacity-40"
                      style={{ background: "#00F0FF" }}>
                      {inviteLoading ? <Loader2 size={13} className="animate-spin" /> : "Search"}
                    </button>
                  </div>
                  {inviteResults.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {inviteResults.map(person => (
                        <div key={person.id} className="flex items-center gap-2 py-1.5 border-t border-white/[0.06]">
                          <div className="w-8 h-8 rounded-full bg-blue-700 text-white flex items-center justify-center font-black overflow-hidden"
                            style={{ boxShadow: "0 0 0 1.5px rgba(0,240,255,0.3)" }}>
                            {person.avatar_url ? <img src={person.avatar_url} className="w-full h-full object-cover" alt="" loading="lazy" decoding="async"/> : (person.full_name || "U")[0]}
                          </div>
                          <p className="flex-1 text-[12px] font-bold text-white truncate">{person.full_name || "Member"}</p>
                          <button onClick={() => sendInvite(person)}
                            className="text-[10px] font-black text-[#090a0f] px-3 py-1.5 rounded-xl"
                            style={{ background: "#00F0FF" }}>
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
            <div className="px-3 pb-6">
              <div className="rounded-3xl border border-[#00F0FF]/15 p-4"
                style={{ background: "rgba(0,240,255,0.05)", backdropFilter: "blur(12px)" }}>
                <p className="text-[12px] font-black text-white mb-1">Invite more members</p>
                <p className="text-[11px] text-white/40 mb-3">Share this Circle so others can join</p>
                <button
                  onClick={() => shareCircle(selectedGroup)}
                  className="w-full flex items-center justify-center gap-1.5 text-[#090a0f] py-2.5 rounded-xl text-[12px] font-black active:scale-95 transition-transform"
                  style={{ background: "linear-gradient(135deg,#00F0FF,#2563eb)" }}
                >
                  <Share2 size={13} /> Share Circle
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── ABOUT TAB ──────────────────────────────────────────────────── */}
        {groupTab === "about" && (
          <div className="flex-1 overflow-y-auto pb-6 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>

            {/* ── Membership Actions ──────────────────────────────────────── */}
            <div className="mx-3 mt-3 rounded-3xl border border-white/[0.08] overflow-hidden"
              style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(20px)" }}>
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
                <Settings size={13} className="text-[#00F0FF]" />
                <span className="text-[12px] font-black text-white">Settings</span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {/* Follow/Unfollow — share the circle */}
                <button
                  onClick={() => shareCircle(selectedGroup)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-white/[0.06] transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-[#00F0FF]"
                    style={{ background: "rgba(0,240,255,0.1)" }}>
                    <Share2 size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-black text-white">Share Circle</p>
                    <p className="text-[10px] text-white/30">Invite friends via link</p>
                  </div>
                  <ChevronRight size={14} className="text-white/20" />
                </button>

                {/* Join — only for non-members */}
                {!isMember && (
                  <button
                    onClick={() => handleJoin(selectedGroup.id)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-white/[0.06] transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-green-400"
                      style={{ background: "rgba(34,197,94,0.1)" }}>
                      <UserPlus size={15} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-black text-white">Join Circle</p>
                      <p className="text-[10px] text-white/30">Become a member</p>
                    </div>
                    <ChevronRight size={14} className="text-white/20" />
                  </button>
                )}

                {/* Leave — only for non-admin members */}
                {isMember && !isAdmin && (
                  <button
                    onClick={() => handleLeave(selectedGroup.id)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-red-500/10 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-red-400"
                      style={{ background: "rgba(239,68,68,0.1)" }}>
                      <LogOut size={15} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-black text-red-400">Leave Circle</p>
                      <p className="text-[10px] text-white/30">You can rejoin later</p>
                    </div>
                    <ChevronRight size={14} className="text-red-400/30" />
                  </button>
                )}
              </div>
            </div>

            {/* ── Group Info Card ────────────────────────────────────────── */}
            <div className="mx-3 mt-3 rounded-3xl border border-white/[0.08] px-4 py-4"
              style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(20px)", boxShadow: "0 8px 32px rgba(0,0,0,0.35)" }}>
              <div className="flex items-center gap-2 mb-3">
                {selectedGroup.privacy === "private" ? <Lock size={13} className="text-white/40" /> : <Globe size={13} className="text-[#00F0FF]" />}
                <span className="text-[12px] font-black text-white/70 capitalize">{selectedGroup.privacy} Group</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 border border-[#00F0FF]/20"
                  style={{ background: "rgba(0,240,255,0.07)" }}>
                  <Users size={11} className="text-[#00F0FF]" />
                  <span className="text-[11px] font-black text-[#00F0FF]">{selectedGroup.member_count ?? groupMembers.length} Members</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 border border-green-500/20"
                  style={{ background: "rgba(34,197,94,0.07)" }}>
                  <FileText size={11} className="text-green-400" />
                  <span className="text-[11px] font-black text-green-400">{groupPosts.length} Posts</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 border border-violet-500/20"
                  style={{ background: "rgba(139,92,246,0.07)" }}>
                  <Calendar size={11} className="text-violet-400" />
                  <span className="text-[11px] font-black text-violet-400">{circleEvents.length} Events</span>
                </div>
              </div>
            </div>

            {/* ── Pinned Announcement ─────────────────────────────────────── */}
            <div className="mx-3 mt-3 rounded-3xl border border-amber-500/20 overflow-hidden"
              style={{ background: "rgba(245,158,11,0.06)", backdropFilter: "blur(20px)" }}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-amber-500/10">
                <div className="flex items-center gap-2">
                  <Megaphone size={13} className="text-amber-400" />
                  <span className="text-[12px] font-black text-amber-300">Pinned Announcement</span>
                </div>
                {canAdmin && (
                  <button
                    onClick={() => { setPinnedEditing(true); setPinnedText(selectedGroup.pinned_announcement ?? ""); }}
                    className="text-[10px] font-black text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1 active:scale-95 transition-transform"
                    style={{ background: "rgba(245,158,11,0.1)" }}
                  >
                    <Pencil size={10} /> {selectedGroup.pinned_announcement ? "Edit" : "Add"}
                  </button>
                )}
              </div>
              <div className="px-4 py-3">
                {selectedGroup.pinned_announcement ? (
                  <>
                    <p className="text-[13px] text-amber-200 leading-relaxed whitespace-pre-wrap">{selectedGroup.pinned_announcement}</p>
                    {selectedGroup.pinned_at && (
                      <p className="text-[10px] text-amber-500 mt-1.5">
                        Pinned {new Date(selectedGroup.pinned_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    )}
                    {canAdmin && (
                      <button
                        onClick={() => savePinnedAnnouncement(null)}
                        className="mt-2 text-[10px] font-black text-red-400 flex items-center gap-1"
                      >
                        <X size={10} /> Remove announcement
                      </button>
                    )}
                  </>
                ) : (
                  <p className="text-[12px] text-amber-400/60 italic">{canAdmin ? "Tap 'Add' to pin an announcement for all members." : "No announcement yet."}</p>
                )}
              </div>
            </div>

            {/* ── Group Rules ─────────────────────────────────────────────── */}
            <div className="mx-3 mt-3 rounded-3xl border border-white/[0.08] overflow-hidden"
              style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(20px)" }}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={13} className="text-[#00F0FF]" />
                  <span className="text-[12px] font-black text-white">Group Rules</span>
                </div>
                {canAdmin && !rulesEditing && (
                  <button
                    onClick={() => { setRulesEditing(true); setRulesText(selectedGroup.rules ?? ""); }}
                    className="text-[10px] font-black text-[#00F0FF] border border-[#00F0FF]/25 px-2.5 py-1 rounded-lg flex items-center gap-1 active:scale-95 transition-transform"
                    style={{ background: "rgba(0,240,255,0.07)" }}
                  >
                    <Pencil size={10} /> {selectedGroup.rules ? "Edit" : "Add"}
                  </button>
                )}
              </div>
              <div className="px-4 py-3">
                {rulesEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={rulesText}
                      onChange={e => setRulesText(e.target.value)}
                      rows={5}
                      placeholder={"1. Be respectful to all members\n2. No spam or self-promotion\n3. Stay on topic"}
                      className="w-full rounded-xl px-3 py-2.5 text-[13px] text-white outline-none resize-none border border-white/10 placeholder:text-white/20 focus:border-[#00F0FF]/40"
                      style={{ background: "rgba(255,255,255,0.06)" }}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={saveRulesInline}
                        disabled={savingRules}
                        className="flex-1 text-[#090a0f] text-[12px] font-black py-2 rounded-xl disabled:opacity-50 flex items-center justify-center gap-1 active:scale-95 transition-transform"
                        style={{ background: "linear-gradient(135deg,#00F0FF,#2563eb)" }}
                      >
                        {savingRules ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                        Save Rules
                      </button>
                      <button
                        onClick={() => setRulesEditing(false)}
                        className="px-4 text-white/60 text-[12px] font-black py-2 rounded-xl active:scale-95 transition-transform border border-white/10"
                        style={{ background: "rgba(255,255,255,0.06)" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : selectedGroup.rules ? (
                  <div className="space-y-2">
                    {selectedGroup.rules.split("\n").filter(Boolean).map((rule, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full text-[#00F0FF] text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5 border border-[#00F0FF]/30"
                          style={{ background: "rgba(0,240,255,0.1)" }}>{i + 1}</span>
                        <p className="text-[13px] text-white/60 leading-relaxed">{rule.replace(/^\d+\.\s*/, "")}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] text-white/25 italic">{canAdmin ? "Tap 'Add' to set group rules." : "No rules set yet."}</p>
                )}
              </div>
            </div>

            {/* ── Admins & Moderators ─────────────────────────────────────── */}
            <div className="mx-3 mt-3 rounded-3xl border border-white/[0.08] overflow-hidden"
              style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(20px)" }}>
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
                <Crown size={13} className="text-amber-400" />
                <span className="text-[12px] font-black text-white">Admins &amp; Moderators</span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {groupMembers.filter((m: any) => m.role === "admin" || m.role === "moderator").length === 0 ? (
                  <p className="px-4 py-3 text-[12px] text-white/25 italic">No admins listed.</p>
                ) : (
                  groupMembers
                    .filter((m: any) => m.role === "admin" || m.role === "moderator")
                    .map((m: any) => (
                      <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm overflow-hidden shrink-0 cursor-pointer"
                          style={{
                            background: m.role === "admin" ? "linear-gradient(135deg,#f59e0b,#d97706)" : "linear-gradient(135deg,#3b82f6,#2563eb)",
                            boxShadow: m.role === "admin" ? "0 0 0 2px rgba(245,158,11,0.4)" : "0 0 0 2px rgba(59,130,246,0.4)"
                          }}
                          onClick={() => m.user_id && openProfile(m.user_id)}
                        >
                          {m.profiles?.avatar_url
                            ? <img src={m.profiles.avatar_url} className="w-full h-full object-cover" alt="" loading="lazy" decoding="async"/>
                            : (m.profiles?.full_name || "A")[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-white truncate">
                            {m.profiles?.full_name || "Member"}
                            {m.user_id === currentUserId && <span className="text-[10px] text-white/30 font-medium ml-1">(you)</span>}
                          </p>
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${m.role === "admin" ? "text-amber-300 border border-amber-500/30" : "text-blue-300 border border-blue-500/30"}`}
                            style={{ background: m.role === "admin" ? "rgba(245,158,11,0.12)" : "rgba(59,130,246,0.12)" }}>
                            {m.role === "admin" ? "👑 Admin" : "⭐ Moderator"}
                          </span>
                        </div>
                        {m.user_id !== currentUserId && (
                          <button
                            onClick={() => m.user_id && openProfile(m.user_id)}
                            className="text-[10px] font-black text-[#00F0FF] border border-[#00F0FF]/25 px-3 py-1.5 rounded-xl active:scale-95 transition-transform"
                            style={{ background: "rgba(0,240,255,0.07)" }}
                          >
                            Message
                          </button>
                        )}
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* ── Upcoming Events ─────────────────────────────────────────── */}
            <div className="mx-3 mt-3 rounded-3xl border border-white/[0.08] overflow-hidden"
              style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(20px)" }}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <Calendar size={13} className="text-violet-400" />
                  <span className="text-[12px] font-black text-white">Upcoming Events</span>
                </div>
                {canAdmin && (
                  <button
                    onClick={() => setShowCreateEvent(true)}
                    className="flex items-center gap-1 text-[10px] font-black text-violet-300 border border-violet-500/30 px-2.5 py-1 rounded-lg active:scale-95 transition-transform"
                    style={{ background: "rgba(139,92,246,0.1)" }}
                  >
                    <Plus size={10} /> Create
                  </button>
                )}
              </div>
              {circleEvents.length === 0 ? (
                <div className="px-4 py-5 flex flex-col items-center text-center">
                  <Calendar size={28} className="text-white/15 mb-2" />
                  <p className="text-[11px] font-black text-white/25 uppercase tracking-widest">No events yet</p>
                  {canAdmin && <p className="text-[11px] text-white/20 mt-1">Tap 'Create' to add the first event</p>}
                </div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {circleEvents.map(ev => {
                    const counts = eventRsvpCounts[ev.id] ?? { going: 0, maybe: 0, not_going: 0 };
                    const myRsvp = myRsvps[ev.id];
                    return (
                      <div key={ev.id} className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 border border-violet-500/25"
                            style={{ background: "rgba(139,92,246,0.12)" }}>
                            <span className="text-[9px] font-black text-violet-400 uppercase leading-none">
                              {new Date(ev.event_date + "T00:00:00").toLocaleDateString("en-IN", { month: "short" })}
                            </span>
                            <span className="text-[16px] font-black text-violet-300 leading-none">
                              {new Date(ev.event_date + "T00:00:00").getDate()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-black text-white truncate">{ev.title}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5">
                              {ev.event_time && (
                                <span className="flex items-center gap-1 text-[10px] text-white/40">
                                  <Clock size={9} /> {formatEventDate("", ev.event_time).replace(" · ", "")}
                                </span>
                              )}
                              {ev.location && (
                                <span className="flex items-center gap-1 text-[10px] text-white/40">
                                  <MapPin size={9} /> {ev.location}
                                </span>
                              )}
                            </div>
                            {ev.description && (
                              <p className="text-[11px] text-white/35 mt-1 leading-relaxed line-clamp-2">{ev.description}</p>
                            )}
                            {/* RSVP counts */}
                            <div className="flex gap-2 mt-2">
                              <span className="text-[10px] text-white/30">{counts.going} Going</span>
                              <span className="text-[10px] text-white/20">·</span>
                              <span className="text-[10px] text-white/30">{counts.maybe} Maybe</span>
                            </div>
                          </div>
                          {canAdmin && (
                            <button onClick={() => deleteEvent(ev.id)}
                              className="p-1.5 rounded-full shrink-0 border border-red-500/20"
                              style={{ background: "rgba(239,68,68,0.1)" }}>
                              <Trash2 size={12} className="text-red-400" />
                            </button>
                          )}
                        </div>
                        {/* RSVP buttons */}
                        <div className="flex gap-2 mt-2.5">
                          {[
                            { status: "going", label: "✅ Going" },
                            { status: "maybe", label: "🤔 Maybe" },
                            { status: "not_going", label: "❌ Can't Go" },
                          ].map(opt => (
                            <button
                              key={opt.status}
                              onClick={() => rsvpEvent(ev.id, opt.status)}
                              disabled={rsvpLoading === ev.id}
                              className={`flex-1 py-1.5 rounded-xl text-[10px] font-black border transition-all active:scale-95 ${
                                myRsvp === opt.status
                                  ? "text-[#090a0f] border-[#00F0FF]"
                                  : "text-white/50 border-white/10"
                              }`}
                              style={{ background: myRsvp === opt.status ? "#00F0FF" : "rgba(255,255,255,0.05)" }}
                            >
                              {rsvpLoading === ev.id ? <Loader2 size={10} className="animate-spin mx-auto" /> : opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Invite / Share ──────────────────────────────────────────── */}
            <div className="mx-3 mt-3 rounded-3xl border border-[#00F0FF]/15 p-4"
              style={{ background: "rgba(0,240,255,0.05)", backdropFilter: "blur(12px)" }}>
              <p className="text-[12px] font-black text-white mb-1">Invite friends to this Circle</p>
              <p className="text-[11px] text-white/40 mb-3">Share so more people can join and participate</p>
              <button
                onClick={() => shareCircle(selectedGroup)}
                className="w-full flex items-center justify-center gap-1.5 text-[#090a0f] py-2.5 rounded-xl text-[12px] font-black active:scale-95 transition-transform"
                style={{ background: "linear-gradient(135deg,#00F0FF,#2563eb)" }}
              >
                <Share2 size={13} /> Share Circle
              </button>
            </div>

            {/* ── Admin Quick Actions ─────────────────────────────────────── */}
            {canAdmin && (
              <div className="mx-3 mt-3 rounded-3xl border border-white/[0.08] overflow-hidden"
              style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(20px)" }}>
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
                  <Settings size={13} className="text-white/40" />
                  <span className="text-[12px] font-black text-white">Admin Settings</span>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  <button
                    onClick={() => { setShowSettings(true); setSettingsForm({ rules: selectedGroup.rules ?? "", post_approval: selectedGroup.post_approval ?? false }); }}
                    className="w-full flex items-center gap-3 px-4 py-3 active:bg-white/[0.03] transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-[#00F0FF]/20"
                      style={{ background: "rgba(0,240,255,0.08)" }}>
                      <Settings size={14} className="text-[#00F0FF]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[13px] font-bold text-white">Circle Settings</p>
                      <p className="text-[10px] text-white/35">Post approval, visibility, rules</p>
                    </div>
                    <ChevronRight size={14} className="text-white/20" />
                  </button>
                  <button
                    onClick={() => { setGroupTab("members"); }}
                    className="w-full flex items-center gap-3 px-4 py-3 active:bg-white/[0.03] transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-amber-500/20"
                      style={{ background: "rgba(245,158,11,0.08)" }}>
                      <UserPlus size={14} className="text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[13px] font-bold text-white">Manage Members</p>
                      <p className="text-[10px] text-white/35">Invite, promote, or remove members</p>
                    </div>
                    <ChevronRight size={14} className="text-white/20" />
                  </button>
                  <button
                    onClick={() => setShowCreateEvent(true)}
                    className="w-full flex items-center gap-3 px-4 py-3 active:bg-white/[0.03] transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-violet-500/20"
                      style={{ background: "rgba(139,92,246,0.08)" }}>
                      <CalendarPlus size={14} className="text-violet-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[13px] font-bold text-white">Create Event</p>
                      <p className="text-[10px] text-white/35">Schedule a group event with RSVP</p>
                    </div>
                    <ChevronRight size={14} className="text-white/20" />
                  </button>
                  <button
                    onClick={() => { setShowEditGroup(true); setEditGroupForm({ name: selectedGroup.name, description: selectedGroup.description ?? "" }); }}
                    className="w-full flex items-center gap-3 px-4 py-3 active:bg-white/[0.03] transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-green-500/20"
                      style={{ background: "rgba(34,197,94,0.08)" }}>
                      <Pencil size={14} className="text-green-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[13px] font-bold text-white">Edit Group Info</p>
                      <p className="text-[10px] text-white/35">Change name, description or cover</p>
                    </div>
                    <ChevronRight size={14} className="text-white/20" />
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ── Create Event Bottom Sheet ──────────────────────────────────── */}
        <AnimatePresence>
          {showCreateEvent && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[350] flex items-end bg-black/50 backdrop-blur-sm"
              onClick={() => setShowCreateEvent(false)}>
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 320 }}
                className="w-full bg-[#d4f0e2] rounded-t-3xl pb-10 overflow-hidden max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden"
                style={{ scrollbarWidth: "none" }}
                onClick={e => e.stopPropagation()}>
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-2 sticky top-0 bg-[#d4f0e2] z-10">
                  <div className="w-10 h-1 rounded-full bg-gray-200" />
                </div>
                {/* Header */}
                <div className="flex items-center justify-between px-5 pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center">
                      <CalendarPlus size={16} className="text-violet-600" />
                    </div>
                    <div>
                      <p className="text-[15px] font-black text-gray-900">Create Event</p>
                      <p className="text-[10px] text-gray-400">{selectedGroup?.name}</p>
                    </div>
                  </div>
                  <button onClick={() => setShowCreateEvent(false)} className="p-1.5 rounded-full bg-gray-100">
                    <X size={16} className="text-gray-500" />
                  </button>
                </div>
                {/* Form */}
                <div className="px-5 py-4 space-y-4">
                  {/* Title */}
                  <div>
                    <label className="text-[11px] font-black text-gray-500 uppercase tracking-wider mb-1.5 block">Event Title *</label>
                    <input
                      value={eventForm.title}
                      onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="e.g. Movie Night, Cricket Match…"
                      maxLength={80}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[14px] text-gray-900 font-semibold outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-300"
                    />
                  </div>
                  {/* Date + Time row */}
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-[11px] font-black text-gray-500 uppercase tracking-wider mb-1.5 block">Date *</label>
                      <div className="relative">
                        <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-400 pointer-events-none" />
                        <input
                          type="date"
                          value={eventForm.event_date}
                          onChange={e => setEventForm(f => ({ ...f, event_date: e.target.value }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-3 text-[13px] text-gray-800 outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-300"
                        />
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="text-[11px] font-black text-gray-500 uppercase tracking-wider mb-1.5 block">Time</label>
                      <div className="relative">
                        <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-400 pointer-events-none" />
                        <input
                          type="time"
                          value={eventForm.event_time}
                          onChange={e => setEventForm(f => ({ ...f, event_time: e.target.value }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-3 text-[13px] text-gray-800 outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-300"
                        />
                      </div>
                    </div>
                  </div>
                  {/* Location */}
                  <div>
                    <label className="text-[11px] font-black text-gray-500 uppercase tracking-wider mb-1.5 block">Location</label>
                    <div className="relative">
                      <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-400 pointer-events-none" />
                      <input
                        value={eventForm.location}
                        onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))}
                        placeholder="e.g. Rooftop, DM for details…"
                        maxLength={100}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-3 text-[13px] text-gray-800 outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-300"
                      />
                    </div>
                  </div>
                  {/* Description */}
                  <div>
                    <label className="text-[11px] font-black text-gray-500 uppercase tracking-wider mb-1.5 block">Description</label>
                    <textarea
                      value={eventForm.description}
                      onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Tell members what to expect, what to bring…"
                      rows={3}
                      maxLength={300}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[13px] text-gray-800 outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-300 resize-none"
                    />
                    <p className="text-[10px] text-gray-400 text-right mt-1">{eventForm.description.length}/300</p>
                  </div>
                  {/* Submit */}
                  <button
                    onClick={createEvent}
                    disabled={savingEvent || !eventForm.title.trim() || !eventForm.event_date}
                    className="w-full py-4 rounded-2xl bg-violet-600 text-white text-[14px] font-black disabled:opacity-40 active:scale-[0.98] transition-transform flex items-center justify-center gap-2 shadow-lg shadow-violet-200"
                  >
                    {savingEvent ? <Loader2 size={18} className="animate-spin" /> : <CalendarPlus size={18} />}
                    {savingEvent ? "Creating…" : "Create Event 🎉"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Post Options Bottom Sheet ──────────────────────────────────── */}
        <AnimatePresence>
          {postSheet && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[350] flex items-end bg-black/50 backdrop-blur-sm"
              onClick={() => setPostSheet(null)}>
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 320 }}
                className="w-full bg-[#d4f0e2] rounded-t-3xl pb-10 overflow-hidden"
                onClick={e => e.stopPropagation()}>
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 rounded-full bg-gray-200" />
                </div>
                {/* Post preview */}
                <div className="px-5 py-3 border-b border-gray-100">
                  <p className="text-[13px] font-black text-gray-900 truncate">{postSheet.content || "Media post"}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">by {postSheet.author_name}</p>
                </div>
                {/* Actions */}
                <div className="py-2">
                  {postSheet.author_id === currentUserId && (
                    <button
                      onClick={() => { haptic(); setEditingPost({ id: postSheet.id, content: postSheet.content }); setEditPostText(postSheet.content); setPostSheet(null); }}
                      className="w-full flex items-center gap-4 px-5 py-4 text-blue-600 active:bg-blue-50 text-[14px] font-semibold"
                    >
                      <Pencil size={18} className="shrink-0" />
                      Edit Post
                    </button>
                  )}
                  {canModerate && (
                    <button
                      onClick={() => { haptic(); toggleCommentsMuted(postSheet); setPostSheet(null); }}
                      className="w-full flex items-center gap-4 px-5 py-4 text-amber-600 active:bg-amber-50 text-[14px] font-semibold border-t border-gray-50"
                    >
                      <Ban size={18} className="shrink-0" />
                      {postSheet.comments_muted ? "Unmute Comments" : "Mute Comments"}
                    </button>
                  )}
                  <button
                    onClick={() => { haptic(); setConfirmDeletePost(postSheet.id); setPostSheet(null); }}
                    className="w-full flex items-center gap-4 px-5 py-4 text-red-500 active:bg-red-50 text-[14px] font-semibold border-t border-gray-50"
                  >
                    <Trash2 size={18} className="shrink-0" />
                    Delete Post
                  </button>
                  <button
                    onClick={() => setPostSheet(null)}
                    className="w-full flex items-center justify-center px-5 py-4 text-gray-400 active:bg-[#c4e8d4] text-[14px] font-semibold border-t border-gray-100 mt-1"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Member Management Bottom Sheet ─────────────────────────────── */}
        <AnimatePresence>
          {memberSheet && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[350] flex items-end bg-black/50 backdrop-blur-sm"
              onClick={() => setMemberSheet(null)}>
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 320 }}
                className="w-full bg-[#d4f0e2] rounded-t-3xl pb-10 overflow-hidden"
                onClick={e => e.stopPropagation()}>
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 rounded-full bg-gray-200" />
                </div>
                {/* Member info */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                  <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-base overflow-hidden shrink-0"
                    style={{ boxShadow: memberSheet.role === "admin" ? "0 0 0 2px #f59e0b" : memberSheet.role === "moderator" ? "0 0 0 2px #3b82f6" : "0 0 0 1px #e5e7eb" }}>
                    {memberSheet.profiles?.avatar_url
                      ? <img src={memberSheet.profiles.avatar_url} className="w-full h-full object-cover" alt="" loading="lazy"  decoding="async"/>
                      : (memberSheet.profiles?.full_name || "M")[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-[14px] font-black text-gray-900">{memberSheet.profiles?.full_name || "Member"}</p>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                      memberSheet.role === "admin"
                        ? "text-amber-700 bg-amber-50 border-amber-200"
                        : memberSheet.role === "moderator"
                          ? "text-blue-700 bg-blue-50 border-blue-200"
                          : "text-gray-500 bg-[#c4e8d4] border-gray-200"
                    }`}>
                      {memberSheet.role === "admin" ? "👑 Admin" : memberSheet.role === "moderator" ? "⭐ Moderator" : "Member"}
                    </span>
                  </div>
                </div>
                {/* Actions */}
                <div className="py-2">
                  <button
                    onClick={() => { haptic(); memberSheet.user_id && openProfile(memberSheet.user_id); setMemberSheet(null); }}
                    className="w-full flex items-center gap-4 px-5 py-4 text-blue-600 active:bg-blue-50 text-[14px] font-semibold"
                  >
                    <Eye size={18} className="shrink-0" />
                    View Profile
                  </button>
                  {/* Make Admin / Remove Admin — only original creator can do this */}
                  {isCreator && memberSheet.user_id !== selectedGroup?.created_by && (
                    memberSheet.role === "admin" ? (
                      <button
                        onClick={() => { haptic(); updateMemberRole(memberSheet, "member"); setMemberSheet(null); }}
                        className="w-full flex items-center gap-4 px-5 py-4 text-amber-600 active:bg-amber-50 text-[14px] font-semibold border-t border-gray-50"
                      >
                        <Shield size={18} className="shrink-0" />
                        Remove Admin Role
                      </button>
                    ) : (
                      <button
                        onClick={() => { haptic(); updateMemberRole(memberSheet, "admin"); setMemberSheet(null); }}
                        className="w-full flex items-center gap-4 px-5 py-4 text-yellow-600 active:bg-yellow-50 text-[14px] font-semibold border-t border-gray-50"
                      >
                        <Shield size={18} className="shrink-0" />
                        Make Admin 👑
                      </button>
                    )
                  )}
                  {/* Make Moderator / Remove Moderator — admin can do this for non-admin members */}
                  {canAdmin && memberSheet.role !== "admin" && (
                    <button
                      onClick={() => { haptic(); updateMemberRole(memberSheet, memberSheet.role === "moderator" ? "member" : "moderator"); setMemberSheet(null); }}
                      className="w-full flex items-center gap-4 px-5 py-4 text-blue-600 active:bg-blue-50 text-[14px] font-semibold border-t border-gray-50"
                    >
                      <Shield size={18} className="shrink-0" />
                      {memberSheet.role === "moderator" ? "Remove Moderator ⭐" : "Make Moderator ⭐"}
                    </button>
                  )}
                  {/* Remove from Circle */}
                  {canManageMember(memberSheet) && (
                    <button
                      onClick={() => { haptic(20); removeMember(memberSheet); setMemberSheet(null); }}
                      className="w-full flex items-center gap-4 px-5 py-4 text-red-500 active:bg-red-50 text-[14px] font-semibold border-t border-gray-50"
                    >
                      <UserMinus size={18} className="shrink-0" />
                      Remove from Circle
                    </button>
                  )}
                  <button
                    onClick={() => setMemberSheet(null)}
                    className="w-full flex items-center justify-center px-5 py-4 text-gray-400 active:bg-[#c4e8d4] text-[14px] font-semibold border-t border-gray-100 mt-1"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Post Reach / Viewers Sheet ──────────────────────────────────── */}
        <AnimatePresence>
          {viewersPostId && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[300] flex items-end justify-center bg-black/50 backdrop-blur-sm"
              onClick={() => { setViewersPostId(null); setViewersList([]); }}>
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
                className="w-full max-w-lg bg-[#d4f0e2] rounded-t-3xl max-h-[70vh] flex flex-col"
                onClick={e => e.stopPropagation()}>

                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1 shrink-0">
                  <div className="w-10 h-1 rounded-full bg-gray-200" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <Eye size={15} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-[14px] font-black text-gray-900">Post Reach</p>
                      <p className="text-[10px] text-gray-400">
                        {viewersLoading ? "Loading…" : `${viewersList.length} unique viewer${viewersList.length !== 1 ? "s" : ""}`}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => { setViewersPostId(null); setViewersList([]); }}
                    className="p-1.5 rounded-full bg-gray-100">
                    <X size={18} className="text-gray-500" />
                  </button>
                </div>

                {/* Viewer list */}
                <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
                  {viewersLoading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 size={22} className="animate-spin text-blue-400" />
                    </div>
                  ) : viewersList.length === 0 ? (
                    <div className="flex flex-col items-center py-14 text-gray-300">
                      <Eye size={32} className="mb-2 opacity-40" />
                      <p className="text-xs font-black uppercase tracking-widest">No views yet</p>
                      <p className="text-[11px] text-gray-400 mt-1">Share the post to reach more members</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50 px-1">
                      {viewersList.map((v: any, i: number) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-3">
                          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-sm overflow-hidden shrink-0">
                            {v.profiles?.avatar_url
                              ? <img src={v.profiles.avatar_url} className="w-full h-full object-cover" alt="" loading="lazy"  decoding="async"/>
                              : (v.profiles?.full_name || "?")[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-bold text-gray-900 truncate">
                              {v.profiles?.full_name || "Member"}
                              {v.viewer_id === currentUserId && (
                                <span className="text-[10px] text-gray-400 font-medium ml-1">(you)</span>
                              )}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {new Date(v.viewed_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                          <div className="w-5 h-5 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
                            <Eye size={10} className="text-blue-500" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-gray-100 bg-[#c4e8d4]/50 shrink-0">
                  <p className="text-[10px] text-gray-400 text-center">
                    Visible only to Admins · Updates in real-time as members view this post
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Comment Drawer */}
        <AnimatePresence>
          {commentPostId && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[300] flex items-end justify-center bg-black/50 backdrop-blur-sm"
              onClick={closeComments}>
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
                className="w-full max-w-lg bg-[#d4f0e2] rounded-t-3xl max-h-[75vh] flex flex-col"
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <h3 className="font-black text-gray-900 text-base flex items-center gap-2"><MessageCircle size={17} className="text-blue-600" /> Comments</h3>
                  <button onClick={closeComments} className="p-1.5 rounded-full bg-gray-100"><X size={18} className="text-gray-500" /></button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                  {commentLoading ? (
                    <div className="flex justify-center py-8"><Loader2 size={22} className="animate-spin text-blue-500" /></div>
                  ) : postComments.length === 0 ? (
                    <div className="text-center py-10 text-gray-300">
                      <MessageCircle size={30} className="mx-auto mb-2 opacity-50" />
                      <p className="text-xs font-black uppercase tracking-widest">No comments yet</p>
                    </div>
                  ) : postComments.map(comment => {
                    const isCommenter = comment.author_id === currentUserId;
                    const commentPost = groupPosts.find(p => p.id === commentPostId);
                    const isPostOwner = commentPost?.author_id === currentUserId;
                    const isLongPressed = circleCommentAction?.comment?.id === comment.id;
                    return (
                      <div
                        key={comment.id}
                        onPointerDown={e => {
                          longPressCommentPos.current = { x: e.clientX, y: e.clientY };
                          longPressCommentTimer.current = setTimeout(() => {
                            try { navigator.vibrate?.(8); } catch (_) {}
                            setCircleCommentAction({ comment, postId: commentPostId!, x: longPressCommentPos.current.x, y: longPressCommentPos.current.y });
                          }, 600);
                        }}
                        onPointerUp={() => { if (longPressCommentTimer.current) { clearTimeout(longPressCommentTimer.current); longPressCommentTimer.current = null; } }}
                        onPointerCancel={() => { if (longPressCommentTimer.current) { clearTimeout(longPressCommentTimer.current); longPressCommentTimer.current = null; } }}
                        className={`flex gap-2.5 rounded-xl transition-colors select-none ${isLongPressed ? "bg-black/5" : ""}`}
                      >
                        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-xs overflow-hidden shrink-0 mt-0.5">
                          {comment.author_avatar ? <img src={comment.author_avatar} className="w-full h-full object-cover" alt="" loading="lazy"  decoding="async"/> : (comment.author_name || "M")[0]}
                        </div>
                        <div className={`rounded-2xl px-3 py-2 flex-1 ${(comment as any).is_hidden && !isPostOwner && !canModerate ? "bg-gray-50 border border-dashed border-gray-200" : "bg-gray-100"}`}>
                          <p style={{ color: "#800000", fontSize: 12, fontWeight: 900 }}>{comment.author_name}</p>
                          {(comment as any).is_hidden && !isPostOwner && !canModerate ? (
                            <p className="text-[13px] text-gray-400 italic mt-0.5">💬 Comment hidden by {(comment as any).hidden_by_name || "moderator"}</p>
                          ) : (comment as any).is_hidden && (isPostOwner || canModerate) ? (
                            <>
                              <p className="text-[13px] text-gray-300 mt-0.5 line-through">{maskProfanity(comment.content)}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">🙈 Hidden by {(comment as any).hidden_by_name}</p>
                            </>
                          ) : (
                            <p className="text-[14px] text-gray-800 mt-0.5 leading-snug">{maskProfanity(comment.content)}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {groupPosts.find(p => p.id === commentPostId)?.comments_muted ? (
                  <div className="px-4 py-4 border-t border-gray-100 text-center text-[12px] font-black text-amber-700 bg-amber-50">
                    Comments are muted for this post.
                  </div>
                ) : (
                  <div
                    className="px-3 py-3 border-t flex items-center gap-2 transition-all duration-200"
                    style={{
                      borderColor: commentInputFocused ? "rgba(37,99,235,0.18)" : "rgba(229,231,235,1)",
                      background: commentInputFocused ? "rgba(255,255,255,1)" : undefined,
                    }}
                  >
                    <input
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendComment())}
                      onFocus={() => setCommentInputFocused(true)}
                      onBlur={() => setCommentInputFocused(false)}
                      placeholder="Write a comment…"
                      className="flex-1 bg-gray-100 border rounded-2xl px-4 py-2.5 text-sm outline-none transition-all duration-200"
                      style={{
                        boxShadow: commentInputFocused ? "0 0 0 2px rgba(37,99,235,0.22)" : "none",
                        borderColor: commentInputFocused ? "rgba(37,99,235,0.3)" : "rgba(229,231,235,1)",
                      }}
                    />
                    <button
                      onClick={sendComment}
                      disabled={!commentText.trim() || commenting}
                      className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center disabled:opacity-40 active:scale-90 transition-all"
                      style={{
                        boxShadow: commentInputFocused ? "0 4px 16px rgba(37,99,235,0.4)" : "0 2px 8px rgba(37,99,235,0.2)",
                      }}
                    >
                      {commenting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                    </button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Circle Comment Floating Context Menu (long-press) */}
        <AnimatePresence>
          {circleCommentAction && (() => {
            const ac = circleCommentAction.comment;
            const postId = circleCommentAction.postId;
            const { x, y } = circleCommentAction;
            const isCommenter = ac.author_id === currentUserId;
            const commentPost = groupPosts.find(p => p.id === postId);
            const isPostOwner = commentPost?.author_id === currentUserId;

            type MenuItem = { icon: string; label: string; action: () => void; danger?: boolean };
            const items: MenuItem[] = [];
            if (isCommenter) {
              items.push({ icon: "✏️", label: "Edit", action: () => { setEditingCircleComment({ id: ac.id, text: ac.content }); setCircleCommentAction(null); } });
              items.push({ icon: "🗑️", label: "Delete", action: () => handleCircleCommentDelete(ac.id, postId), danger: true });
              if (!(ac as any).is_hidden) items.push({ icon: "🙈", label: "Hide from Others", action: () => handleCircleCommentHide(ac.id, postId) });
            }
            if ((isPostOwner || canModerate) && !isCommenter) {
              items.push({ icon: "🗑️", label: "Delete", action: () => handleCircleCommentDelete(ac.id, postId), danger: true });
              if (!(ac as any).is_hidden) items.push({ icon: "🙈", label: "Hide Comment", action: () => handleCircleCommentHide(ac.id, postId) });
            }
            if (!isCommenter && !isPostOwner && !canModerate) {
              items.push({ icon: "🚩", label: "Report", action: () => handleCircleCommentReport(ac, postId), danger: true });
            }

            const menuW = 210;
            const rowH = 46;
            const headerH = 52;
            const menuH = headerH + items.length * rowH;
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const left = Math.min(Math.max(x - menuW / 2, 8), vw - menuW - 8);
            const showAbove = y + menuH + 16 > vh;
            const top = showAbove ? Math.max(y - menuH - 12, 8) : y + 12;

            return (
              <>
                <div className="fixed inset-0 z-[400]" onPointerDown={() => setCircleCommentAction(null)} />
                <motion.div
                  key="circle-ca-float"
                  initial={{ opacity: 0, scale: 0.82 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.82 }}
                  transition={{ type: "spring", damping: 22, stiffness: 400 }}
                  className="fixed z-[401] bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100/80"
                  style={{ top, left, width: menuW, transformOrigin: showAbove ? "bottom center" : "top center" }}
                  onPointerDown={e => e.stopPropagation()}
                >
                  <div className="px-3.5 py-2.5 bg-gray-50 border-b border-gray-100">
                    <p style={{ color: "#800000", fontSize: 11, fontWeight: 900 }} className="truncate">{ac.author_name}</p>
                    <p className="text-[11px] text-gray-500 truncate leading-snug mt-0.5">{(ac.content || "").slice(0, 55)}</p>
                  </div>
                  {items.map((item, i) => (
                    <button
                      key={i}
                      onClick={item.action}
                      className={`w-full flex items-center gap-2.5 px-3.5 py-[11px] text-left text-[14px] font-semibold active:bg-gray-100 transition-colors ${item.danger ? "text-red-600" : "text-gray-800"} ${i > 0 ? "border-t border-gray-50" : ""}`}
                    >
                      <span className="text-[17px] leading-none">{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                </motion.div>
              </>
            );
          })()}
        </AnimatePresence>

        {/* Edit Circle Comment Sheet */}
        <AnimatePresence>
          {editingCircleComment && (
            <motion.div
              key="circle-edit-comment-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[400] flex items-end justify-center bg-black/60 backdrop-blur-sm"
              onClick={() => setEditingCircleComment(null)}
            >
              <motion.div
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 320 }}
                className="w-full max-w-lg bg-white rounded-t-3xl p-5 pb-10 shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex justify-center mb-4"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
                <h3 className="font-black text-gray-900 text-base mb-3 flex items-center gap-2">✏️ Edit Comment</h3>
                <textarea
                  value={editingCircleComment.text}
                  onChange={e => setEditingCircleComment(prev => prev ? { ...prev, text: e.target.value } : null)}
                  rows={3}
                  className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-[15px] text-gray-800 outline-none focus:ring-2 focus:ring-blue-400/30 resize-none mb-4"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button onClick={() => setEditingCircleComment(null)}
                    className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-600 font-black text-sm">
                    Cancel
                  </button>
                  <button onClick={saveCircleCommentEdit} disabled={!editingCircleComment.text.trim()}
                    className="flex-1 py-3 rounded-2xl bg-blue-600 text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-40">
                    <Check size={16} /> Save
                  </button>
                </div>
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
                className="w-full max-w-lg bg-[#d4f0e2] rounded-t-3xl p-5 pb-10"
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
                className="bg-[#d4f0e2] rounded-3xl p-6 w-full max-w-xs shadow-2xl"
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
                className="w-full max-w-lg bg-[#d4f0e2] rounded-t-3xl p-6 pb-10"
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
                    style={{ background: editGroupCoverPrev ? undefined : "#e5e7eb" }}>
                    {editGroupCoverPrev
                      ? <img src={editGroupCoverPrev} className="w-full h-full object-cover" alt="" loading="lazy"  decoding="async"/>
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
                className="bg-[#d4f0e2] rounded-3xl p-6 w-full max-w-xs shadow-2xl"
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
                className="w-full max-w-lg bg-[#d4f0e2] rounded-t-3xl p-6 pb-10"
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
    <div className="min-h-screen bg-[#d4f0e2] pb-28">
      {/* Header */}
      <div className="bg-[#d4f0e2] border-b border-gray-100 px-4 pt-12 pb-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-black text-gray-900">Your Circles</h1>
          <p className="text-[11px] text-gray-400 font-medium">Groups & communities you love</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Invite bell */}
          <button
            onClick={() => { setNewInviteCount(0); fetchMyInvites(); }}
            className="relative w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center active:scale-95 transition-transform"
          >
            <Bell size={17} className={newInviteCount > 0 ? "text-blue-600" : "text-gray-500"} />
            <AnimatePresence>
              {newInviteCount > 0 && (
                <motion.span
                  key="invite-badge"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 shadow"
                >
                  {newInviteCount > 9 ? "9+" : newInviteCount}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-black active:scale-95 transition-transform"
          >
            <Plus size={16} strokeWidth={2.5} />
            Create
          </button>
        </div>
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
            <div className="bg-blue-50 border-b border-blue-100 px-4 py-3" onAnimationStart={() => setNewInviteCount(0)}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12px] font-black text-blue-900">Circle Invites</p>
                {newInviteCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full"
                  >
                    {newInviteCount} New
                  </motion.span>
                )}
              </div>
              <div className="space-y-2">
                {myInvites.map(invite => (
                  <div key={invite.id} className="bg-[#d4f0e2] border border-blue-100 rounded-2xl p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-gray-200 flex items-center justify-center">
                      {(invite.circles?.profiles?.avatar_url || invite.circles?.cover_url)
                        ? <img src={invite.circles?.profiles?.avatar_url || invite.circles?.cover_url || ""} className="w-full h-full object-cover" alt="" loading="lazy"  decoding="async"/>
                        : <span className="text-gray-500 font-black text-sm">{(invite.circles?.name || "C")[0].toUpperCase()}</span>
                      }
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
            <div className="bg-[#d4f0e2] border-b border-gray-100 py-3">
              <p className="text-[12px] font-black text-gray-700 px-4 mb-2">My Circles</p>
              <div className="flex gap-4 overflow-x-auto px-4 no-scrollbar pb-1">
                {myGroups.map(g => (
                  <button
                    key={g.id}
                    onClick={() => openGroup(g)}
                    className="flex-shrink-0 flex flex-col items-center gap-1.5"
                  >
                    <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-blue-500 shadow-sm bg-gray-200 flex items-center justify-center">
                      {(g.profiles?.avatar_url || g.cover_url)
                        ? <img src={g.profiles?.avatar_url || g.cover_url || ""} className="w-full h-full object-cover" alt={g.name} loading="lazy"  decoding="async"/>
                        : <span className="text-gray-500 font-black text-base">{(g.name || "C")[0].toUpperCase()}</span>
                      }
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
              {allGroupsForGrid.length > 0 ? "All Circles" : "No circles yet"}
            </p>
            {allGroupsForGrid.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {allGroupsForGrid.map(g => (
                  <GroupCard
                    key={g.id}
                    group={g}
                    isMember={myGroupIds.has(g.id)}
                    justJoined={justJoinedIds.has(g.id)}
                    onJoin={() => handleJoin(g.id)}
                    onLeave={() => handleLeave(g.id)}
                    onClick={() => openGroup(g)}
                  />
                ))}
              </div>
            )}
            {groups.length === 0 && (
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
              className="w-full max-w-lg bg-[#d4f0e2] rounded-t-3xl p-6 pb-10 max-h-[90vh] overflow-y-auto"
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
                  <img src={coverPreview} className="w-full h-full object-cover" alt="" loading="lazy"  decoding="async"/>
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
                        : "bg-[#c4e8d4] border-gray-200 text-gray-500"
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
